// Signing in with a one-time code sent by e-mail.
// POST /auth/email/start { email } answers the same way for every address, so the
// page never tells who has access; the code is sent in the background, and only to
// active users, invited addresses and the owner. POST /auth/email/verify
// { email, code } signs in. A code is valid for 10 minutes and allows 5 tries; an
// address gets at most one code a minute and 10 a day.
import { signText, sessionSecret, timingSafeEqualString, signedInResponse } from "./dashboard-auth.js";
import { normalizeEmail, mayGetEmailCode, signInEmailUser } from "./tenancy.js";
import { emailConfigured, sendEmail, signInCodeEmail } from "./email-sender.js";
import { siteLang } from "./site-pages.js";

const CODE_SECONDS = 10 * 60;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_DAY = 10;
const STALE_SECONDS = 2 * 24 * 60 * 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPIRED = "Kód už neplatí. Nech si poslat nový.";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function requestLanguage(request) {
  const asked = String(request.headers.get("X-Interface-Language") || "").slice(0, 2);
  return asked === "cs" || asked === "en" ? asked : siteLang(request);
}

export async function handleEmailLogin(request, env, pathname, ctx) {
  if (pathname !== "/auth/email/start" && pathname !== "/auth/email/verify") return null;
  if (request.method !== "POST") return json({ message: "Použij POST." }, 405);
  if (!emailConfigured(env)) return json({ message: "Přihlášení kódem z e-mailu není zapnuté." }, 404);
  if (request.headers.get("Origin") !== new URL(request.url).origin) return json({ message: "Neplatný původ požadavku." }, 403);
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return json({ message: "Zadej platný e-mail." }, 400);
  if (pathname === "/auth/email/start") {
    // Whether a code goes out (and how long that takes) stays out of the answer.
    const work = sendCode(env, email, requestLanguage(request)).catch(error => console.error("Sign-in code e-mail failed", error?.code || error?.message));
    if (ctx?.waitUntil) ctx.waitUntil(work); else await work;
    return json({ status: "ok" });
  }
  return verifyCode(env, email, body?.code);
}

function randomCode() {
  // Rejection sampling keeps all 1,000,000 codes equally likely.
  const limit = Math.floor(0x100000000 / 1e6) * 1e6, buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= limit);
  return String(buffer[0] % 1e6).padStart(6, "0");
}

// Only a keyed hash of the code is stored; it is tied to the address.
function codeHash(env, email, code) {
  return signText("email-code:" + email + ":" + code, sessionSecret(env));
}

// Returns true when a code went out.
export async function sendCode(env, email, lang = "cs", { now = Date.now(), code = randomCode() } = {}) {
  const db = env.DB;
  if (!(await mayGetEmailCode(db, env, email))) return false;
  const seconds = Math.floor(now / 1000), day = new Date(now).toISOString().slice(0, 10);
  // Claimed before sending, so two quick requests never send two codes or pass the daily limit.
  const claimed = await db.prepare(`INSERT INTO email_login_codes(email, code_hash, expires_at, attempts, sent_at, day, day_count) VALUES(?, ?, ?, 0, ?, ?, 1)
    ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at,
      day_count = CASE WHEN day = excluded.day THEN day_count + 1 ELSE 1 END, day = excluded.day
    WHERE email_login_codes.sent_at <= ? AND (email_login_codes.day IS NOT excluded.day OR email_login_codes.day_count < ?)`)
    .bind(email, await codeHash(env, email, code), seconds + CODE_SECONDS, seconds, day, seconds - RESEND_SECONDS, MAX_SENDS_PER_DAY).run();
  if (!(Number(claimed.meta?.changes) > 0)) return false;
  await db.prepare("DELETE FROM email_login_codes WHERE sent_at < ?").bind(seconds - STALE_SECONDS).run().catch(() => {});
  await sendEmail(env, { to: email, ...signInCodeEmail(lang, code) });
  return true;
}

async function verifyCode(env, email, input) {
  const code = String(input || "").replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(code)) return json({ message: "Kód má šest číslic." }, 400);
  const db = env.DB, now = Math.floor(Date.now() / 1000);
  // Every try is counted before the comparison, so parallel guesses cannot get past the limit.
  const row = await db.prepare("UPDATE email_login_codes SET attempts = attempts + 1 WHERE email = ? AND code_hash IS NOT NULL AND expires_at > ? AND attempts < ? RETURNING code_hash, attempts")
    .bind(email, now, MAX_ATTEMPTS).first();
  if (!row) return json({ message: EXPIRED }, 400);
  if (!timingSafeEqualString(row.code_hash, await codeHash(env, email, code))) {
    return json({ message: row.attempts >= MAX_ATTEMPTS ? EXPIRED : "Kód nesedí. Zkontroluj ho, nebo si nech poslat nový." }, 400);
  }
  // Used up, so the same code never signs in twice.
  const used = await db.prepare("UPDATE email_login_codes SET code_hash = NULL WHERE email = ? AND code_hash = ? RETURNING email").bind(email, row.code_hash).first();
  if (!used) return json({ message: EXPIRED }, 400);
  const user = await signInEmailUser(db, env, email);
  if (!user) return json({ message: "Tento e-mail nemá do aplikace přístup." }, 403);
  return signedInResponse(user.id, env);
}
