// First-run setup: connecting the services and the profile the calorie target
// needs, in one guided window after the first sign-in. Shown until the user
// finishes or skips it; that choice is kept per account on the server
// (dashboard_profile row 3), so it holds on every device.
import { energyBaseline } from "./energy-profile.js";
import { loadEffectiveProfile } from "./profile-suggestions.js";

const SETUP_ROW = 3;

export async function setupStatus(env) {
  const [row, weight, profile] = await Promise.all([
    env.DB.prepare("SELECT profile_json FROM dashboard_profile WHERE user_id = ? AND id = ?").bind(env.USER_ID, SETUP_ROW).first().catch(() => null),
    env.DB.prepare("SELECT value_numeric FROM health_datapoints WHERE user_id = ? AND data_type = 'weight' AND value_numeric IS NOT NULL ORDER BY sample_time DESC, id DESC LIMIT 1").bind(env.USER_ID).first().catch(() => null),
    loadEffectiveProfile(env.DB, env.USER_ID).catch(() => null)
  ]);
  let saved = null;
  try { saved = JSON.parse(row?.profile_json || "null"); } catch { saved = null; }
  const connected = env.CONNECTED_PROVIDERS || [];
  // The same check as the calorie target (index.js): sport hours are needed
  // only when no connected service tracks activities.
  const baseline = energyBaseline(profile, weight ? Number(weight.value_numeric) : null, { isOwner: env.USER_IS_OWNER === true, activityTracked: connected.length > 0 });
  const done = Boolean(saved?.doneAt);
  return { needed: !done && !baseline.ready, done, profileMissing: baseline.missing, connected };
}

// done=true when the user finishes or skips the wizard; false starts it again.
export async function saveSetup(env, done) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS dashboard_profile (user_id INTEGER NOT NULL,id INTEGER NOT NULL,profile_json TEXT NOT NULL,PRIMARY KEY (user_id,id))").run();
  if (!done) {
    await env.DB.prepare("DELETE FROM dashboard_profile WHERE user_id = ? AND id = ?").bind(env.USER_ID, SETUP_ROW).run();
    return setupStatus(env);
  }
  await env.DB.prepare("INSERT INTO dashboard_profile (user_id, id, profile_json) VALUES (?, ?, ?) ON CONFLICT(user_id, id) DO UPDATE SET profile_json = excluded.profile_json")
    .bind(env.USER_ID, SETUP_ROW, JSON.stringify({ doneAt: new Date().toISOString() })).run();
  return setupStatus(env);
}
