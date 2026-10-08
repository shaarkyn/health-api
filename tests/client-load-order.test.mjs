import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync(new URL("../src/dashboard-client.js", import.meta.url), "utf8");

// localToday() and localMonday() read USER_TZ; calling them at load time before
// the const exists stopped the whole script, sign-in screen included.
test("the time zone exists before the first day is computed at load time", () => {
  const zone = client.indexOf("\nconst USER_TZ=");
  const firstDay = client.indexOf("\nlet weekStart=localMonday()");
  assert.ok(zone > 0 && firstDay > 0);
  assert.ok(zone < firstDay);
});
