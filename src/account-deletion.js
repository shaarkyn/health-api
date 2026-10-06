// Deleting an account: the Google grant, every row the user owns, then the user.
// The Google Health API data policy and GDPR both ask that users can delete their data.
// The owner's account holds the app's administration and its earlier data, so it stays.
import { normalizeEmail } from "./tenancy.js";
import { CLEARED_SESSION_COOKIE } from "./dashboard-auth.js";

const CHUNK_ROWS = 5000;
// Tables the app keeps for itself or that D1 manages.
const SKIP = /^(users|schema_meta|sqlite_.*|_cf_.*|d1_migrations)$/;

export class AccountDeletionRefused extends Error {}

// DELETE /app/api/me from Settings. The user confirms by typing the e-mail they sign in with.
export async function handleAccountDeletion(request, env, session, { revoke = revokeGoogleToken } = {}) {
  if (!session.signedIn) return Response.json({ message: "Účet smažeš jen po přihlášení do aplikace." }, { status: 401 });
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ message: "Neplatný původ požadavku." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (!body.email || normalizeEmail(body.email) !== normalizeEmail(session.user?.email)) return Response.json({ message: "Napiš e-mail, kterým se přihlašuješ." }, { status: 400 });
  try { await deleteAccount(env.RAW_DB, session.user, { googleRefreshToken: env.GOOGLE_REFRESH_TOKEN, revoke }); }
  catch (error) {
    if (error instanceof AccountDeletionRefused) return Response.json({ message: error.message }, { status: 400 });
    console.error("Account deletion failed", error.message);
    return Response.json({ message: "Účet se nepodařilo smazat. Zkus to znovu." }, { status: 500 });
  }
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store", "Set-Cookie": CLEARED_SESSION_COOKIE } });
}

export async function deleteAccount(db, user, { googleRefreshToken = null, revoke = revokeGoogleToken } = {}) {
  if (!user?.id) throw new AccountDeletionRefused("Účet neexistuje.");
  if (user.isOwner) throw new AccountDeletionRefused("Účet správce nejde smazat.");
  // Loadwise loses access to the Google account first; a failure here must not keep the data.
  if (googleRefreshToken) await revoke(googleRefreshToken).catch(error => console.error("Google token revocation failed", error.message));
  // A disabled account drops out of the scheduled syncs, which could otherwise write new rows meanwhile.
  await db.prepare("UPDATE users SET disabled=1 WHERE id=?").bind(user.id).run();
  const tables = await tablesWithUserId(db);
  try {
    // In chunks, so years of heart-rate samples never need one huge statement.
    for (const table of tables) {
      for (;;) {
        const result = await db.prepare(`DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE user_id=? LIMIT ${CHUNK_ROWS})`).bind(user.id).run();
        if (!(Number(result.meta?.changes) >= CHUNK_ROWS)) break;
      }
    }
  } catch (error) {
    // The account stays as it was, so deleting it again finishes the job.
    await db.prepare("UPDATE users SET disabled=0 WHERE id=?").bind(user.id).run().catch(() => {});
    throw error;
  }
  await db.batch([
    db.prepare("DELETE FROM user_invites WHERE email=?").bind(normalizeEmail(user.email)),
    db.prepare("DELETE FROM users WHERE id=?").bind(user.id)
  ]);
  // Rows a sync that was already running wrote in the meantime. User ids are never reused (AUTOINCREMENT).
  for (const table of tables) await db.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(user.id).run().catch(error => console.error("Account deletion sweep failed", table, error.message));
}

// Every table with a user_id column, including ones added after this was written.
async function tablesWithUserId(db) {
  const tables = ((await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results || []).map(row => row.name).filter(name => /^[a-z_][a-z0-9_]*$/i.test(name) && !SKIP.test(name));
  const found = [];
  for (const table of tables) {
    const columns = (await db.prepare(`PRAGMA table_info(${table})`).all()).results || [];
    if (columns.some(column => column.name === "user_id")) found.push(table);
  }
  return found;
}

export async function revokeGoogleToken(token, fetchImpl = fetch) {
  const response = await fetchImpl("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
  // 400 means the token was already revoked or expired: nothing left to revoke.
  if (!response.ok && response.status !== 400) throw new Error("Google revoke HTTP " + response.status);
}
