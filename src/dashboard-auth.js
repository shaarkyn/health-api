import { verifyGitHubActionsToken } from "./github-oidc.js";

const SESSION_COOKIE = "pfd_session";
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_FAILURES = 10;

// Routes reachable without a dashboard session or API key. Everything else
// requires authentication. Routes listed here either serve static/public
// content or enforce their own authentication (MCP bearer, OAuth flow,
// GitHub OIDC, dashboard session inside the OAuth connectors).
const PUBLIC_PATHS = new Set([
  "/",
  "/privacy",
  "/terms",
  "/support",
  "/logo.svg",
  "/manifest.webmanifest",
  "/openapi.json",
  "/app",
  "/app/dashboard-client.js",
  "/app/login",
  "/app/logout",
  "/auth/google",
  "/auth/google/callback",
  "/app/api/food/reference-data",
  "/mcp",
  "/mcp/health",
  "/register",
  "/authorize",
  "/token",
  "/automation/strength",
  "/automation/nutrition",
  "/automation/nutrition-notes"
]);
const PUBLIC_PREFIXES = ["/.well-known/", "/oauth/"];

export function isPublicPath(pathname) {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

// Accepts a signed dashboard session cookie, the STRENGTH_API_KEY bearer
// (API clients and the OAuth-issued access token) or a GitHub Actions OIDC
// token from one of the allowed workflows.
export async function isAuthorizedRequest(request, env, verifyOidc = verifyGitHubActionsToken) {
  const secret = String(env.STRENGTH_API_KEY || "");
  if (!secret) return false;
  if (await verifyDashboardSession(request, secret)) return true;
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice(7).trim();
  if (!token) return false;
  if (timingSafeEqualString(token, secret)) return true;
  if (token.split(".").length !== 3) return false;
  try { await verifyOidc(request); return true; } catch { return false; }
}

export function unauthorizedResponse() {
  return Response.json(
    { status: "error", message: "Přihlas se do dashboardu." },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="health-api"', "Cache-Control": "no-store" } }
  );
}

export async function handleDashboardLogin(request, env) {
  const expected = String(env.STRENGTH_API_KEY || "");
  if (!expected) return Response.json({status:"error",message:"Dashboard authentication is not configured."},{status:503});
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (await recentLoginFailures(env.DB, ip) >= LOGIN_MAX_FAILURES) {
    return Response.json({status:"error",message:"Příliš mnoho pokusů. Zkus to znovu za 15 minut."},{status:429,headers:{"Retry-After":String(LOGIN_WINDOW_SECONDS),"Cache-Control":"no-store"}});
  }
  const body = await request.json().catch(() => ({}));
  const key = String(body?.key || "");
  if (!key || !timingSafeEqualString(key, expected)) {
    await recordLoginFailure(env.DB, ip);
    return Response.json({status:"error",message:"Neplatný přístupový klíč."},{status:401});
  }
  const exp = Math.floor(Date.now()/1000) + SESSION_SECONDS;
  const cookie = await sessionCookie(exp, expected);
  return Response.json({status:"ok",expiresAt:new Date(exp*1000).toISOString()},{headers:{"Set-Cookie":cookie,"Cache-Control":"no-store"}});
}

export function handleDashboardLogout() {
  return new Response(JSON.stringify({status:"ok"}),{status:200,headers:{"content-type":"application/json; charset=utf-8","Set-Cookie":SESSION_COOKIE+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax","Cache-Control":"no-store"}});
}

export async function verifyDashboardSession(request, secret) {
  if (!secret) return false;
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.split(";").map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+"="));
  if (!match) return false;
  const token = match.slice(SESSION_COOKIE.length+1);
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0,dot), sig = token.slice(dot+1);
  const expected = await dashboardHmac(payload, secret);
  if (!timingSafeEqualString(sig, expected)) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
    return Number(data?.exp) > Math.floor(Date.now()/1000);
  } catch { return false; }
}

export async function sessionCookie(exp, secret) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({exp})));
  const signature = await dashboardHmac(payload, secret);
  return SESSION_COOKIE+"="+payload+"."+signature+"; Path=/; Max-Age="+SESSION_SECONDS+"; HttpOnly; Secure; SameSite=Lax";
}

// Throttling fails open when D1 is unavailable so a storage outage never
// locks the owner out; failures are still logged.
async function recentLoginFailures(db, ip) {
  try {
    const since = Math.floor(Date.now()/1000) - LOGIN_WINDOW_SECONDS;
    const row = await db.prepare("SELECT COUNT(*) AS n FROM dashboard_login_failures WHERE ip=? AND failed_at>?").bind(ip, since).first();
    return Number(row?.n) || 0;
  } catch (error) { console.error("Login throttle unavailable", error.message); return 0; }
}
async function recordLoginFailure(db, ip) {
  try {
    const now = Math.floor(Date.now()/1000);
    await db.prepare("INSERT INTO dashboard_login_failures(ip,failed_at) VALUES(?,?)").bind(ip, now).run();
    await db.prepare("DELETE FROM dashboard_login_failures WHERE failed_at<=?").bind(now - LOGIN_WINDOW_SECONDS).run();
  } catch (error) { console.error("Login failure not recorded", error.message); }
}

async function dashboardHmac(value, secret) {
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig = await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return base64url(new Uint8Array(sig));
}
function timingSafeEqualString(a,b) {
  if (a.length !== b.length) return false;
  let x=0; for(let i=0;i<a.length;i++) x |= a.charCodeAt(i)^b.charCodeAt(i); return x===0;
}
function base64url(bytes) {
  let s=""; for(const b of bytes) s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function fromBase64url(s) {
  s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4)s+="=";
  const bin=atob(s); return Uint8Array.from(bin,c=>c.charCodeAt(0));
}
