import test from "node:test";
import assert from "node:assert/strict";
import { isPublicPath, isAuthorizedRequest, handleDashboardLogin, sessionCookie } from "../src/dashboard-auth.js";

const env = { STRENGTH_API_KEY: "test-secret-key" };
const rejectOidc = async () => { throw new Error("invalid"); };
const req = (headers = {}) => new Request("https://petrfitnessdata.eu/app/api/daily", { headers });

function fakeDb(failures = 0) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return { bind: (...args) => ({
        first: async () => { calls.push(["first", sql, args]); return { n: failures }; },
        run: async () => { calls.push(["run", sql, args]); return {}; }
      }) };
    }
  };
}

test("personal data routes are not public", () => {
  for (const path of ["/app/api/daily", "/app/api/sleep", "/app/api/profile", "/app/api/food/log", "/app/api/inbox", "/health/sleep", "/health/db", "/sync/google", "/sync/intervals", "/daily/plan", "/food/resolve", "/auth-test", "/test/intervals", "/test/google-sheets-auth", "/strength/history"]) {
    assert.equal(isPublicPath(path), false, path);
  }
});

test("static pages, login and self-authenticating routes stay public", () => {
  for (const path of ["/", "/app", "/app/dashboard-client.js", "/app/login", "/mcp", "/mcp/health", "/token", "/authorize", "/.well-known/oauth-authorization-server", "/oauth/google/callback", "/automation/strength", "/app/api/food/reference-data"]) {
    assert.equal(isPublicPath(path), true, path);
  }
});

test("anonymous and wrong-key requests are rejected", async () => {
  assert.equal(await isAuthorizedRequest(req(), env, rejectOidc), false);
  assert.equal(await isAuthorizedRequest(req({ Authorization: "Bearer wrong" }), env, rejectOidc), false);
  assert.equal(await isAuthorizedRequest(req({ Authorization: "Bearer a.b.c" }), env, rejectOidc), false);
  assert.equal(await isAuthorizedRequest(req({ Authorization: "Bearer test-secret-key" }), {}, rejectOidc), false);
});

test("API key, GitHub OIDC token and dashboard session are accepted", async () => {
  assert.equal(await isAuthorizedRequest(req({ Authorization: "Bearer test-secret-key" }), env, rejectOidc), true);
  assert.equal(await isAuthorizedRequest(req({ Authorization: "Bearer a.b.c" }), env, async () => ({})), true);
  const cookie = (await sessionCookie(Math.floor(Date.now() / 1000) + 60, env.STRENGTH_API_KEY)).split(";")[0];
  assert.equal(await isAuthorizedRequest(req({ Cookie: cookie }), env, rejectOidc), true);
});

test("expired or forged sessions are rejected", async () => {
  const expired = (await sessionCookie(Math.floor(Date.now() / 1000) - 1, env.STRENGTH_API_KEY)).split(";")[0];
  assert.equal(await isAuthorizedRequest(req({ Cookie: expired }), env, rejectOidc), false);
  const forged = (await sessionCookie(Math.floor(Date.now() / 1000) + 60, "other-secret")).split(";")[0];
  assert.equal(await isAuthorizedRequest(req({ Cookie: forged }), env, rejectOidc), false);
});

const login = (key, db) => handleDashboardLogin(new Request("https://petrfitnessdata.eu/app/login", {
  method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.5" }, body: JSON.stringify({ key })
}), { ...env, DB: db });

test("login sets a session cookie for the correct key", async () => {
  const response = await login("test-secret-key", fakeDb());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Set-Cookie"), /^pfd_session=.+HttpOnly; Secure; SameSite=Lax$/);
});

test("failed logins are recorded and throttled", async () => {
  const db = fakeDb();
  assert.equal((await login("wrong", db)).status, 401);
  assert.ok(db.calls.some(([kind, sql]) => kind === "run" && sql.startsWith("INSERT INTO dashboard_login_failures")));
  const throttled = await login("test-secret-key", fakeDb(10));
  assert.equal(throttled.status, 429);
  assert.equal(throttled.headers.get("Set-Cookie"), null);
});

test("login still works when the throttle table is unavailable", async () => {
  const broken = { prepare() { throw new Error("no such table"); } };
  const original = console.error; console.error = () => {};
  try { assert.equal((await login("test-secret-key", broken)).status, 200); }
  finally { console.error = original; }
});
