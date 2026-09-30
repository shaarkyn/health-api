import test from "node:test";
import assert from "node:assert/strict";
import { handleGoogleLogin, verifyGoogleIdToken, _finishLoginForTest, _resetJwksCacheForTest } from "../src/google-login.js";
import { isAuthorizedRequest, isPublicPath } from "../src/dashboard-auth.js";

const env = { GOOGLE_CLIENT_ID: "client-123", GOOGLE_CLIENT_SECRET: "secret", STRENGTH_API_KEY: "test-secret-key", ALLOWED_GOOGLE_EMAILS: "Owner@Example.com, second@example.com" };
const b64 = value => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "k1" };

async function idToken(overrides = {}, key = privateKey) {
  const claims = { iss: "https://accounts.google.com", aud: "client-123", exp: Math.floor(Date.now() / 1000) + 300, nonce: "n1", email: "owner@example.com", email_verified: true, ...overrides };
  const data = b64({ alg: "RS256", kid: "k1" }) + "." + b64(claims);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return data + "." + Buffer.from(sig).toString("base64url");
}
function googleFetch(token) {
  return async url => String(url).includes("certs")
    ? Response.json({ keys: [jwk] })
    : Response.json(token ? { id_token: token } : { error: "invalid_grant" }, { status: token ? 200 : 400 });
}
const callback = (query, cookie = "pfd_google_login=s1.n1.verifier") => new Request("https://petrfitnessdata.eu/auth/google/callback?" + query, { headers: { Cookie: cookie } });

test("Google login routes are public", () => {
  assert.equal(isPublicPath("/auth/google"), true);
  assert.equal(isPublicPath("/auth/google/callback"), true);
});

test("login start requests only identity scopes with state, nonce and PKCE", async () => {
  const response = await handleGoogleLogin(new Request("https://petrfitnessdata.eu/auth/google"), env, "/auth/google");
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("Location"));
  assert.equal(location.origin, "https://accounts.google.com");
  assert.equal(location.searchParams.get("scope"), "openid email");
  assert.equal(location.searchParams.get("redirect_uri"), "https://petrfitnessdata.eu/auth/google/callback");
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  const [state, nonce] = response.headers.get("Set-Cookie").split(";")[0].split("=")[1].split(".");
  assert.equal(location.searchParams.get("state"), state);
  assert.equal(location.searchParams.get("nonce"), nonce);
  assert.match(response.headers.get("Set-Cookie"), /HttpOnly; SameSite=Lax/);
});

test("login is disabled without an email allowlist", async () => {
  const response = await handleGoogleLogin(new Request("https://petrfitnessdata.eu/auth/google"), { ...env, ALLOWED_GOOGLE_EMAILS: "" }, "/auth/google");
  assert.equal(response.status, 503);
});

test("allowlisted Google account gets a working dashboard session", async () => {
  _resetJwksCacheForTest();
  const response = await _finishLoginForTest(callback("code=c1&state=s1"), env, googleFetch(await idToken()));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), "/app");
  const session = response.headers.getSetCookie().find(c => c.startsWith("pfd_session=")).split(";")[0];
  const request = new Request("https://petrfitnessdata.eu/app/api/daily", { headers: { Cookie: session } });
  assert.equal(await isAuthorizedRequest(request, env, async () => { throw new Error("no"); }), true);
});

test("Google account outside the allowlist is denied", async () => {
  _resetJwksCacheForTest();
  const response = await _finishLoginForTest(callback("code=c1&state=s1"), env, googleFetch(await idToken({ email: "stranger@example.com" })));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Set-Cookie"), null);
});

test("state mismatch is rejected before contacting Google", async () => {
  let called = false;
  const response = await _finishLoginForTest(callback("code=c1&state=other"), env, async () => { called = true; });
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("ID token checks reject forged or mismatched tokens", async () => {
  _resetJwksCacheForTest();
  const f = googleFetch();
  const other = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])).privateKey;
  await assert.rejects(verifyGoogleIdToken(await idToken({}, other), "client-123", "n1", f), /signature/);
  await assert.rejects(verifyGoogleIdToken(await idToken({ aud: "someone-else" }), "client-123", "n1", f), /audience/);
  await assert.rejects(verifyGoogleIdToken(await idToken({ iss: "https://evil.example" }), "client-123", "n1", f), /issuer/);
  await assert.rejects(verifyGoogleIdToken(await idToken({ exp: 1 }), "client-123", "n1", f), /Expired/);
  await assert.rejects(verifyGoogleIdToken(await idToken({ nonce: "other" }), "client-123", "n1", f), /nonce/);
  await assert.rejects(verifyGoogleIdToken(await idToken({ email_verified: false }), "client-123", "n1", f), /verified/);
  assert.equal((await verifyGoogleIdToken(await idToken(), "client-123", "n1", f)).email, "owner@example.com");
});
