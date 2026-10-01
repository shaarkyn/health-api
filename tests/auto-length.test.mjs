import test from "node:test";
import assert from "node:assert/strict";
import { buildCyclingCoachV2 } from "../src/cycling-coach-v2.js";
import { explainWorkout, structureHow } from "../src/workout-explanation.js";
import { CYCLING_WORKOUTS } from "../src/workout-library.js";
import { renderForEnvironment } from "../src/workout-model.js";

const week = days => ({ days: days.map(([date, planned = [], completed = []]) => ({ date, daily: { training: { planned, completed } } })) });
const ride = (date, hours, extra = {}) => [date, [], [{ type: "Ride", name: "Endurance", durationHours: hours, tss: Math.round(hours * 50), ...extra }]];
const fitness = { wellness: [{ id: "2026-10-01", ctl: 55, atl: 50 }, { id: "2026-10-03", ctl: 55, atl: 50 }] };
const health = date => ({ sleep: [{ type: "sleep", durationMin: 480, endTime: date + "T06:30:00" }] });
// Last week 3 rides, this week 3 rides of similar load (not a recovery week).
const history = [ride("2026-09-22", 1.5), ride("2026-09-24", 1.25), ride("2026-09-26", 2), ride("2026-09-28", 1.5), ride("2026-09-29", 1.25), ride("2026-09-30", 1.5)];

test("no time and no plan: length comes from the usual ride, with the reason", () => {
  const c = buildCyclingCoachV2({ date: "2026-10-01", week: week(history), fitness, health: health("2026-10-01") });
  assert.equal(c.constraints.autoLength, true);
  assert.equal(c.constraints.usualMinutes, 90); // median of 75, 75, 90, 90, 90, 120
  assert.match(c.rationale.at(-1), /^Délka \d+ min: tvůj obvyklý trénink za poslední 3 týdny/);
});

test("lengths differ by day and situation", () => {
  const weekday = buildCyclingCoachV2({ date: "2026-10-01", week: week(history), fitness, health: health("2026-10-01") });
  const saturday = buildCyclingCoachV2({ date: "2026-10-03", week: week(history), fitness, health: health("2026-10-03") });
  assert.equal(saturday.recommendation.session.kind, "long_endurance");
  assert.ok(saturday.constraints.availableMinutes >= 150);
  assert.ok(saturday.constraints.availableMinutes > weekday.constraints.availableMinutes);
  // A recovery week shortens the easy ride.
  const heavy = [ride("2026-09-22", 3, { tss: 200 }), ride("2026-09-24", 3, { tss: 200 }), ride("2026-09-26", 3, { tss: 200 }), ride("2026-09-29", 1, { tss: 40 })];
  const recovery = buildCyclingCoachV2({ date: "2026-10-01", week: week(heavy), fitness, health: health("2026-10-01") });
  assert.equal(recovery.week.recoveryWeek, true);
  assert.ok(recovery.constraints.availableMinutes < recovery.constraints.usualMinutes);
  assert.match(recovery.rationale.at(-1), /regenerační týden/);
  // An explicit time always wins.
  const fixed = buildCyclingCoachV2({ date: "2026-10-03", week: week(history), fitness, availabilityMinutes: 60 });
  assert.equal(fixed.constraints.availableMinutes, 60);
  assert.equal(fixed.constraints.autoLength, false);
});

test("without history the length comes from CTL", () => {
  const c = buildCyclingCoachV2({ date: "2026-10-01", week: week([]), fitness: { wellness: [{ id: "2026-10-01", ctl: 20, atl: 15 }] } });
  assert.equal(c.constraints.usualMinutes, 60);
  assert.match(c.rationale.at(-1), /CTL 20/);
});

test("advice describes the actual main set with watts", () => {
  const ss = renderForEnvironment(CYCLING_WORKOUTS.find(w => w.id === "pfd-ss-3x12-90"), "outdoor");
  const x = explainWorkout(ss, { environment: "outdoor", thresholds: { ftp: 260 } });
  assert.match(x.how.join(" "), /3× 12 min na 91 % FTP \(≈ 237 W\)/);
  assert.match(x.environment[0], /12 min nerušené jízdy/);
  assert.match(x.fueling.at(-1), /~90 g sacharidů/);
  const r = renderForEnvironment(CYCLING_WORKOUTS.find(w => w.id === "research-ronnestad-30-15"), "indoor");
  assert.match(structureHow(JSON.parse(r.structure_json), { system: "vo2max", ftp: 260 })[0], /3 série: 13× 30 s na 120 % FTP \(≈ 312 W\) \/ 15 s lehce/);
  const a = explainWorkout(renderForEnvironment(CYCLING_WORKOUTS.find(w => w.id === "pfd-vo2-5x4x112-75"), "indoor"), { thresholds: { ftp: 260 } });
  assert.notEqual(a.how.join(), x.how.join());
});
