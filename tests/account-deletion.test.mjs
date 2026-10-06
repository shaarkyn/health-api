import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createD1 } from "./helpers/d1.mjs";
import { ensureTenancy, _resetTenancyForTest } from "../src/tenancy.js";
import { deleteAccount, handleAccountDeletion, revokeGoogleToken, AccountDeletionRefused } from "../src/account-deletion.js";

const env = { OWNER_EMAIL: "owner@example.com" };
const count = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).first()).n;

// The owner and one invited user, each with food and (for the user, more than one chunk of) health data.
async function twoUsers() {
  _resetTenancyForTest();
  const db = createD1();
  await ensureTenancy(db, env);
  db.sqlite.exec(`CREATE TABLE food_logs (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT);
    CREATE TABLE health_datapoints (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, data_type TEXT);
    CREATE TABLE shared_foods (food_key TEXT PRIMARY KEY);
    INSERT INTO shared_foods VALUES ('banana');
    INSERT INTO user_invites(email) VALUES ('friend@example.com');
    INSERT INTO users(email, role) VALUES ('friend@example.com', 'user');`);
  const owner = await db.prepare("SELECT id FROM users WHERE email='owner@example.com'").first();
  const friend = await db.prepare("SELECT id FROM users WHERE email='friend@example.com'").first();
  db.sqlite.exec(`INSERT INTO food_logs(user_id, name) VALUES (${owner.id}, 'oats'), (${friend.id}, 'rice'), (${friend.id}, 'tea');
    INSERT INTO health_datapoints(user_id, data_type) VALUES (${owner.id}, 'steps');
    WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 5003) INSERT INTO health_datapoints(user_id, data_type) SELECT ${friend.id}, 'heart-rate' FROM n;`);
  return { db, owner: { id: owner.id, email: "owner@example.com", isOwner: true }, friend: { id: friend.id, email: "friend@example.com", isOwner: false } };
}

test("deleting an account removes every row of that user and nobody else's", async () => {
  const { db, owner, friend } = await twoUsers();
  const revoked = [];
  await deleteAccount(db, friend, { googleRefreshToken: "refresh-1", revoke: async token => { revoked.push(token); } });
  assert.deepEqual(revoked, ["refresh-1"]);
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM food_logs WHERE user_id=?", friend.id), 0);
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM health_datapoints WHERE user_id=?", friend.id), 0);
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM users WHERE id=?", friend.id), 0);
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM user_invites WHERE email=?", friend.email), 0);
  // The owner's data and the shared catalogue stay.
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM food_logs WHERE user_id=?", owner.id), 1);
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM health_datapoints WHERE user_id=?", owner.id), 1);
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM shared_foods"), 1);
});

test("a failed Google revocation does not keep the data", async () => {
  const { db, friend } = await twoUsers();
  const original = console.error; console.error = () => {};
  try { await deleteAccount(db, friend, { googleRefreshToken: "refresh-1", revoke: async () => { throw new Error("Google down"); } }); }
  finally { console.error = original; }
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM users WHERE id=?", friend.id), 0);
});

test("the owner's account cannot be deleted", async () => {
  const { db, owner } = await twoUsers();
  await assert.rejects(deleteAccount(db, owner), AccountDeletionRefused);
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM food_logs WHERE user_id=?", owner.id), 1);
});

test("when deleting fails half way, the account stays usable so it can be deleted again", async () => {
  const { db, friend } = await twoUsers();
  db.sqlite.exec("CREATE TRIGGER keep BEFORE DELETE ON health_datapoints BEGIN SELECT RAISE(ABORT, 'locked'); END;");
  await assert.rejects(deleteAccount(db, friend), /locked/);
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM users WHERE id=? AND disabled=0", friend.id), 1);
  db.sqlite.exec("DROP TRIGGER keep");
  await deleteAccount(db, friend);
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM health_datapoints WHERE user_id=?", friend.id), 0);
});

const deletion = (body, { origin = "https://petrfitnessdata.eu" } = {}) => new Request("https://petrfitnessdata.eu/app/api/me", { method: "DELETE", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("the endpoint wants a signed-in user from the app who types their own e-mail", async () => {
  const { db, friend } = await twoUsers();
  const scoped = { RAW_DB: db, GOOGLE_REFRESH_TOKEN: "refresh-1" };
  const revoke = async () => {};
  assert.equal((await handleAccountDeletion(deletion({ email: friend.email }), scoped, { signedIn: false, user: friend }, { revoke })).status, 401);
  assert.equal((await handleAccountDeletion(deletion({ email: friend.email }, { origin: "https://evil.example" }), scoped, { signedIn: true, user: friend }, { revoke })).status, 403);
  assert.equal((await handleAccountDeletion(deletion({ email: "someone@example.com" }), scoped, { signedIn: true, user: friend }, { revoke })).status, 400);
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM users WHERE id=?", friend.id), 1);
  const done = await handleAccountDeletion(deletion({ email: " Friend@Example.com " }), scoped, { signedIn: true, user: friend }, { revoke });
  assert.equal(done.status, 200);
  assert.match(done.headers.get("Set-Cookie"), /^pfd_session=; Path=\/; Max-Age=0/);
  assert.equal(done.headers.get("Cache-Control"), "no-store");
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM users WHERE id=?", friend.id), 0);
});

test("the endpoint refuses the owner's account with a message", async () => {
  const { db, owner } = await twoUsers();
  const response = await handleAccountDeletion(deletion({ email: owner.email }), { RAW_DB: db }, { signedIn: true, user: owner });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, "Účet správce nejde smazat.");
});

test("revoking the Google grant: an already revoked token is fine, a Google error is not", async () => {
  const calls = [];
  await revokeGoogleToken("t1", async (url, init) => { calls.push([url, String(init.body)]); return new Response(null, { status: 200 }); });
  assert.deepEqual(calls, [["https://oauth2.googleapis.com/revoke", "token=t1"]]);
  await revokeGoogleToken("t2", async () => new Response(null, { status: 400 }));
  await assert.rejects(revokeGoogleToken("t3", async () => new Response(null, { status: 503 })), /503/);
});

test("Settings offers deleting the account, and the Worker routes it without a cache bump", () => {
  const client = readFileSync(new URL("../src/dashboard-client.js", import.meta.url), "utf8");
  const entry = readFileSync(new URL("../src/entrypoint.js", import.meta.url), "utf8");
  assert.match(client, /<summary>Smazat účet<\/summary>/);
  assert.match(client, /fetch\('\/app\/api\/me',\{method:'DELETE'/);
  assert.match(entry, /url\.pathname === "\/app\/api\/me" && request\.method === "DELETE"\) return handleAccountDeletion\(request, env, session\)/);
  assert.match(entry, /const CACHE_NEUTRAL = .*\|me\$[|)]/);
  // Disconnecting Google Health gives up the access at Google too.
  assert.match(entry, /body\.provider==='google'&&env\.GOOGLE_REFRESH_TOKEN&&!env\.USER_IS_OWNER\) await revokeGoogleToken/);
});
