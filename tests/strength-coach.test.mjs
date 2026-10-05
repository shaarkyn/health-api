import test from "node:test";
import assert from "node:assert/strict";
import { generateStrengthPlan, warmupRows, EXERCISES, WEEKLY_SET_TARGETS } from "../src/strength-generator.js";
import { estimateStartingLoad, analyzeCompletedWorkout, EXERCISE_INTELLIGENCE, LOAD_UNITS } from "../src/strength-intelligence.js";
import { estimateStrengthTiming, configureStrengthCoaching } from "../src/strength-timing.js";
import { acuteSportStress } from "../src/strength-balance.js";
import { planValues } from "../src/gym-plan-store.js";
import { parseStrengthSheet } from "../src/strength-history.js";
import { prepareGymSwap } from "../src/coach-gym-adjustment.js";

// sessions: [{date, ex: [[name, kg, reps, rpe, sets, plannedReps?, note?]]}]
const hist = sessions => sessions.flatMap(s => s.ex.flatMap(([exercise, kg, reps, rpe, n = 3, plannedReps = String(reps), note = ""]) =>
  Array.from({ length: n }, (_, i) => ({ workout_date: s.date, type: "WORK", exercise, set_no: i + 1, planned_reps: plannedReps, actual_kg: kg, actual_reps: reps, rpe, completed: 1, note }))));
const ctx = (date, { sets = [], rides = [], next = null, planned = [], recovery = {}, adaptive, sex = "", tss = 200, plannedSessions = [] } = {}) => ({
  status: "ok", date, recovery, adaptive, profile: { sex },
  cycling: { recentRideTss: tss, recentRideHours: 3, recentActivities: rides, plannedWorkouts: planned, nextRide: next },
  sports: { recentActivities: rides }, strength: { recentCompletedSets: sets, plannedSessions }
});
const est = (exercise, sessions, targetReps, extra = {}) => estimateStartingLoad({ exercise, history: hist(sessions), targetReps, fallbackKg: 1, ...extra });
const work = plan => [...new Set(plan.rows.filter(r => r[0] === "WORK").map(r => r[1]))];
const setsOf = (plan, ex) => plan.rows.filter(r => r[0] === "WORK" && r[1] === ex);
const kgOf = (plan, ex) => Number(String(setsOf(plan, ex)[0]?.[3] ?? "").replace(",", "."));

test("double progression: loads go up in the direction of the change, also on small dumbbells and cables", () => {
  assert.equal(est("DB bench press", [{ date: "2026-10-01", ex: [["DB bench press", 15, 10, 5]] }], "6–10").kg, 17.5);
  assert.equal(est("DB bench press", [{ date: "2026-10-01", ex: [["DB bench press", 15, 10, 7.5]] }], "6–10").kg, 17.5);
  assert.equal(est("Cable lateral raise", [{ date: "2026-10-01", ex: [["Cable lateral raise", 7.5, 15, 6]] }], "10–15").kg, 10);
  // Two steps only where they are ≤ 10 %; +5 % never rounds back down.
  assert.equal(est("Low row", [{ date: "2026-10-01", ex: [["Low row", 50, 10, 6]] }], "6–10").kg, 55);
  assert.equal(est("Barbell back squat", [{ date: "2026-10-01", ex: [["Barbell back squat", 80, 8, 6]] }], "5–8").kg, 85);
  // Missing RPE at the top of the range still progresses.
  const noRpe = est("Pivot leg press", [1, 8, 15].map(d => ({ date: `2026-09-${String(d).padStart(2, "0")}`, ex: [["Pivot leg press", 150, 10, null]] })), "6–10");
  assert.equal(noRpe.kg, 155); assert.equal(noRpe.action, "increase");
  // Inside the range: same load, one more rep.
  const hold = est("DB bench press", [{ date: "2026-10-01", ex: [["DB bench press", 20, 8, 7]] }], "6–10");
  assert.equal(hold.kg, 20); assert.equal(hold.repsHint, 9); assert.match(hold.note, /zkus 9 opak/);
});

test("double progression: below the range or near failure goes down, far below goes back to the middle", () => {
  assert.equal(est("Low row", [{ date: "2026-10-01", ex: [["Low row", 50, 6, 10]] }], "6–10").kg, 45);
  assert.equal(est("Low row", [{ date: "2026-10-01", ex: [["Low row", 50, 4, 10]] }], "6–10").kg, 42.5);
  assert.equal(est("Low row", [{ date: "2026-10-01", ex: [["Low row", 50, 10, 9.5]] }], "6–10").kg, 47.5);
  assert.equal(est("DB curl", [{ date: "2026-10-01", ex: [["DB curl", 10, 6, 8]] }], "8–15").action, "decrease");
  // A planned failure set at RPE 10 does not count as "too heavy".
  const rows = hist([{ date: "2026-10-01", ex: [["Cable curl", 15, 15, 8, 2]] }]);
  rows.push({ ...rows[0], set_no: 3, rpe: 10, note: "[Do selhání]", toFailure: true });
  assert.equal(estimateStartingLoad({ exercise: "Cable curl", history: rows, targetReps: "8–15" }).action, "increase");
});

test("the latest session is the anchor, not an average of older lighter sessions", () => {
  const sessions = [["2026-10-01", 22.5], ["2026-09-27", 20], ["2026-09-23", 17.5], ["2026-09-20", 15]].map(([date, kg]) => ({ date, ex: [["DB bench press", kg, 10, 7]] }));
  const e = est("DB bench press", sessions, "6–10");
  assert.equal(e.kg, 25); assert.equal(e.referenceKg, 22.5); assert.equal(e.performanceCount, 4);
});

test("back-off sets do not set the reference: the set with the highest e1RM does", () => {
  const rows = [{ workout_date: "2026-10-01", type: "WORK", exercise: "Barbell back squat", set_no: 1, actual_kg: 100, actual_reps: 6, rpe: 8, completed: 1 },
    { workout_date: "2026-10-01", type: "WORK", exercise: "Barbell back squat", set_no: 2, actual_kg: 85, actual_reps: 8, rpe: 7, completed: 1 }];
  const e = estimateStartingLoad({ exercise: "Barbell back squat", history: rows, targetReps: "5–8" });
  assert.equal(e.referenceKg, 100); assert.equal(e.kg, 100);
});

test("two stalled sessions reset the lift by about 10 % and tag it", () => {
  const sessions = ["2026-10-01", "2026-09-27", "2026-09-23"].map(date => ({ date, ex: [["Low row", 60, 8, 8.5]] }));
  const e = est("Low row", sessions, "6–10");
  assert.equal(e.action, "reset"); assert.equal(e.kg, 52.5); assert.equal(e.stalls, 2);
  const plan = generateStrengthPlan(ctx("2026-10-08", { sets: hist(sessions) }), { focus: "upper", durationMinutes: 60 });
  assert.match(setsOf(plan, "Low row")[0][9], /\[Reset\]/);
  assert.match(plan.rationale, /Stagnace/);
});

test("session time model: about 3×3 at 30 min, 4×3 at 45, 5×3 at 60 and 6×3 at 75", () => {
  for (const [minutes, exercises, minSets] of [[30, 3, 8], [45, 4, 12], [60, 5, 15], [75, 6, 18]]) {
    const plan = generateStrengthPlan(ctx("2026-10-05"), { durationMinutes: minutes });
    assert.equal(work(plan).length, exercises, String(minutes));
    assert.ok(plan.rows.filter(r => r[0] === "WORK").length >= minSets, String(minutes));
    assert.ok(plan.timing.totalSeconds <= minutes * 60);
    assert.ok(work(plan).filter(ex => setsOf(plan, ex).length >= 3).length >= exercises - 1, "main lifts keep three sets");
  }
  // No rest after an exercise's last set; setup 120 s + 75 s per exercise; 5 % buffer (≥ 120 s).
  const row = (ex, n, type = "WORK") => [type, ex, String(n), "", "10", "", "", "", "FALSE", "[Pauza 90 s]", "", "FALSE", ""];
  const t = estimateStrengthTiming([row("A", 1), row("A", 2), row("B", 1)], {}, 60);
  assert.equal(t.restSeconds, 90); assert.equal(t.workSeconds, 3 * 40); assert.equal(t.setupSeconds, 270); assert.equal(t.bufferSeconds, 180);
  assert.equal(estimateStrengthTiming([row("A", 1)], {}, 30).bufferSeconds, 120);
});

test("weekly muscle ledger: two 60-minute sessions a week cover legs, push and pull and rotate the accessories", () => {
  let sets = []; const weekly = {}, accessories = new Set();
  const days = ["2026-09-07", "2026-09-10", "2026-09-14", "2026-09-17"];
  for (const date of days) {
    const plan = generateStrengthPlan(ctx(date, { sets: [...sets].sort((a, b) => b.workout_date.localeCompare(a.workout_date)) }), { durationMinutes: 60 });
    const muscles = work(plan).map(ex => EXERCISES[ex].muscle);
    assert.ok(muscles.includes("quads") && muscles.some(m => m === "hamstrings" || m === "glutes"), date + ": knee and hip movement");
    assert.ok(muscles.includes("chest") || muscles.includes("shoulders"), date + ": push");
    assert.ok(muscles.includes("back"), date + ": pull");
    for (const r of plan.rows.filter(r => r[0] === "WORK")) {
      const m = EXERCISES[r[1]].muscle; weekly[m] = (weekly[m] || 0) + 0.5;
      if (["core", "calves", "side_delts", "rear_delts", "biceps", "triceps"].includes(m)) accessories.add(m);
      sets.push({ workout_date: date, type: "WORK", exercise: r[1], set_no: Number(r[2]), planned_reps: r[4], actual_kg: Number(String(r[3]).replace(",", ".")), actual_reps: 8, rpe: 7, completed: 1, note: r[9] });
    }
    assert.ok(plan.balance.weeklySets.withThisSession.quads >= 3);
  }
  assert.ok(weekly.quads >= 6 && weekly.back >= 6 && weekly.chest >= 3, JSON.stringify(weekly));
  assert.ok(accessories.size >= 2, [...accessories].join());
  assert.equal(WEEKLY_SET_TARGETS.quads, 6);
});

test("leg dose: only an acute load reduces it, walks never, and an explicit lower-body day stays normal", () => {
  const z2 = { date: "2026-10-04", type: "Ride", name: "Z2 endurance", durationHours: 1.5, tss: 65 };
  assert.equal(acuteSportStress(ctx("2026-10-05", { rides: [z2] })).size, 0);
  assert.equal(acuteSportStress(ctx("2026-10-05", { rides: [{ date: "2026-10-04", type: "Walk", durationHours: 3 }] })).size, 0);
  assert.ok(acuteSportStress(ctx("2026-10-05", { rides: [{ date: "2026-10-04", type: "Ride", durationHours: 3 }] })).has("quads"));
  assert.ok(acuteSportStress(ctx("2026-10-05", { rides: [{ date: "2026-10-04", type: "Ride", name: "Endurance", durationHours: 2, tss: 130, ctl: 80 }] })).has("quads"));
  assert.equal(acuteSportStress(ctx("2026-10-05", { rides: [{ date: "2026-10-02", type: "Ride", name: "Threshold", intensity: true }] })).size, 0);
  assert.ok(acuteSportStress(ctx("2026-10-05", { next: { date: "2026-10-06", type: "Ride", name: "VO2max 5x4", intensity: true } })).has("quads"));
  assert.equal(acuteSportStress(ctx("2026-10-05", { next: { date: "2026-10-08", type: "Ride", name: "VO2max 5x4", intensity: true } })).size, 0);
  // A normal block (14-day TSS 850) with an easy ride yesterday: full dose, explicit lower body untouched.
  const lower = generateStrengthPlan(ctx("2026-10-05", { rides: [z2], tss: 850 }), { focus: "lower", durationMinutes: 60 });
  assert.equal(lower.protectedLegs, false);
  assert.ok(lower.loadEstimates.every(x => !x.reducedDose));
  const full = generateStrengthPlan(ctx("2026-10-05", { rides: [z2], tss: 850 }), { durationMinutes: 60 });
  assert.equal(full.planName, "Full Body");
  // Reduced dose = one set less and RPE 7, not a blanket two-set cap on a long session.
  const hard = generateStrengthPlan(ctx("2026-10-05", { next: { date: "2026-10-06", type: "Ride", name: "VO2", intensity: true } }), { durationMinutes: 90 });
  const legs = hard.loadEstimates.filter(x => x.reducedDose);
  assert.ok(legs.length >= 2 && legs.every(x => x.targetRir === 3));
  assert.match(hard.rationale, /intenzivní trénink v příštích 36 h/);
});

test("protected legs: reps and reserve first, then the load from e1RM; never above the history", () => {
  const sets = hist([{ date: "2026-09-20", ex: [["Pivot leg press", 180, 6, 8]] }]);
  const plan = generateStrengthPlan(ctx("2026-10-05", { sets, next: { date: "2026-10-06", type: "Ride", intensity: true, durationHours: 1 } }), { durationMinutes: 60 });
  const rows = setsOf(plan, "Pivot leg press");
  assert.equal(rows[0][4], "8–12");
  assert.equal(kgOf(plan, "Pivot leg press"), 157.5); // 180·(1+8/30) / (1+(10+3)/30)
  assert.match(rows[0][9], /cíl RPE 7 \(3 opakování v rezervě\)/);
  // An easy ride is no reason to change anything: same load, add a rep.
  const easy = generateStrengthPlan(ctx("2026-10-05", { sets: hist([{ date: "2026-09-28", ex: [["Pivot leg press", 180, 8, 7]] }]), rides: [{ date: "2026-10-04", type: "Ride", name: "Z2", durationHours: 1.5, tss: 65 }] }), { focus: "lower", durationMinutes: 60 });
  assert.equal(kgOf(easy, "Pivot leg press"), 180);
  // Without history the trial load is reduced too.
  const fresh = generateStrengthPlan(ctx("2026-10-05", { next: { date: "2026-10-06", type: "Ride", intensity: true } }), { durationMinutes: 60 });
  assert.ok(kgOf(fresh, "Pivot leg press") < 145 * 0.7);
});

test("focus mode: the session length sets the count, main lift then isolation per group", () => {
  const chest = generateStrengthPlan(ctx("2026-10-05"), { focusMuscles: ["chest"], durationMinutes: 60 });
  assert.equal(work(chest).length, 3);
  assert.ok(EXERCISES[work(chest)[0]].warmup, "a main press first");
  assert.ok(work(chest).some(ex => ["Pec deck", "Cable fly", "Low-to-high cable fly"].includes(ex)));
  const arms = generateStrengthPlan(ctx("2026-10-05"), { focusMuscles: ["biceps", "triceps"], durationMinutes: 45 });
  assert.equal(work(arms).length, 4);
  const legs = generateStrengthPlan(ctx("2026-10-05"), { focusMuscles: ["quads", "hamstrings"], durationMinutes: 75 });
  assert.ok(work(legs).includes("Pivot leg press") || work(legs).some(ex => EXERCISES[ex].fatigue >= 1.2));
  // Five groups in 30 minutes: fewer sets, not an error.
  const five = generateStrengthPlan(ctx("2026-10-05"), { focusMuscles: ["chest", "upper_back", "quads", "hamstrings", "biceps"], durationMinutes: 30 });
  assert.equal(work(five).length, 5);
  assert.ok(five.timing.totalSeconds <= 1800);
});

test("every work set has an effort target; failure only on the flagged set; less effort on poor days", () => {
  const sets = hist([{ date: "2026-09-28", ex: [["DB bench press", 25, 8, 8], ["Low row", 55, 8, 8], ["Cable curl", 15, 12, 8], ["Cable triceps extension", 20, 12, 8]] }]);
  const plan = generateStrengthPlan(ctx("2026-10-05", { sets }), { focus: "upper", durationMinutes: 75 });
  for (const r of plan.rows.filter(r => r[0] === "WORK")) {
    if (r[11] === "TRUE") { assert.doesNotMatch(r[9], /cíl RPE/); assert.match(r[9], /technického selhání/); continue; }
    assert.match(r[9], /; cíl RPE \d \(\d opakování v rezervě\)/);
  }
  assert.match(setsOf(plan, "DB bench press")[0][9], /cíl RPE 8 \(2 opakování v rezervě\)/);
  // First (trial) loads aim at RPE 7 and are never taken to failure.
  for (const r of plan.rows.filter(r => r[0] === "WORK" && /zkušební váha/.test(r[9]))) assert.match(r[9], /cíl RPE 7 \(3 opakování v rezervě\)/);
  const arms = generateStrengthPlan(ctx("2026-10-05", { sets }), { focusMuscles: ["biceps", "triceps"], durationMinutes: 45 });
  assert.match(setsOf(arms, "Cable curl")[0][9], /cíl RPE 9 \(1 opakování v rezervě\)/);
  assert.equal(arms.rows.filter(r => r[11] === "TRUE").length, 1);
  assert.doesNotMatch(arms.rows.find(r => r[11] === "TRUE")[9], /cíl RPE/);
  const tired = generateStrengthPlan(ctx("2026-10-05", { sets, recovery: { sleep_duration_minutes: [{ value: 300, sampleTime: "2026-10-05T06:00" }] } }), { focus: "upper", durationMinutes: 75 });
  assert.match(setsOf(tired, "DB bench press")[0][9], /cíl RPE 7 \(3 opakování v rezervě\)/);
  const tiredArms = generateStrengthPlan(ctx("2026-10-05", { sets, recovery: { sleep_duration_minutes: [{ value: 300, sampleTime: "2026-10-05T06:00" }] } }), { focusMuscles: ["biceps", "triceps"], durationMinutes: 45 });
  assert.match(setsOf(tiredArms, "Cable curl")[0][9], /cíl RPE 8 \(2 opakování v rezervě\)/);
  assert.equal(tiredArms.rows.filter(r => r[11] === "TRUE").length, 0);
  // The note survives repeated configuration (trimming) without duplicates.
  const rows = setsOf(plan, "DB bench press").map(r => [...r]);
  configureStrengthCoaching(rows, EXERCISES); configureStrengthCoaching(rows, EXERCISES);
  assert.equal(rows[0][9].match(/cíl RPE/g).length, 1); assert.equal(rows[0][9].match(/\[Pauza/g).length, 1);
});

test("poor recovery changes the session and says so; hard work yesterday blocks the same muscles' main lifts", () => {
  const sets = hist([{ date: "2026-09-28", ex: [["DB bench press", 25, 10, 6], ["Low row", 55, 10, 6]] }]);
  const normal = generateStrengthPlan(ctx("2026-10-05", { sets }), { focus: "upper", durationMinutes: 60 });
  const poor = generateStrengthPlan(ctx("2026-10-05", { sets, adaptive: { recovery: { score: 40 }, strengthVolumeModifier: 0.7 } }), { focus: "upper", durationMinutes: 60 });
  assert.equal(kgOf(normal, "DB bench press"), 27.5);
  assert.equal(kgOf(poor, "DB bench press"), 25, "no load increase on a poor day");
  assert.ok(work(poor).every(ex => setsOf(poor, ex).length <= 2));
  assert.equal(poor.adaptive.budgetMinutes, 45);
  assert.ok(poor.timing.totalSeconds <= 45 * 60);
  assert.match(poor.rationale, /o sérii méně na cvik/); assert.match(poor.rationale, /zkrácený na 45 min/); assert.match(poor.rationale, /bez zvyšování vah/);
  const hard = hist([{ date: "2026-10-04", ex: [["Pivot leg press", 150, 8, 9], ["DB bench press", 20, 8, 9.5], ["Low row", 50, 8, 9], ["DB Romanian deadlift", 25, 10, 9]] }]);
  const today = generateStrengthPlan(ctx("2026-10-05", { sets: hard }), { durationMinutes: 60 });
  const compounds = work(today).filter(ex => EXERCISES[ex].warmup);
  assert.ok(compounds.every(ex => !["quads", "chest", "back", "hamstrings"].includes(EXERCISES[ex].muscle)), compounds.join());
  assert.match(today.rationale, /RPE ≥ 9/);
});

test("starting loads without history are labelled trial loads at ~70 %; related lifts transfer through the ratio table", () => {
  const plan = generateStrengthPlan(ctx("2026-10-05"), { durationMinutes: 60 });
  const leg = setsOf(plan, "Pivot leg press")[0];
  assert.equal(kgOf(plan, "Pivot leg press"), 100); assert.match(leg[9], /zkušební váha – najdi RPE 7/);
  assert.ok(plan.loadEstimates.find(x => x.exercise === "Pivot leg press").trial);
  assert.match(plan.rationale, /Zkušební váhy/);
  const history = hist([{ date: "2026-10-01", ex: [["DB bench press", 25, 8, 8]] }]);
  const ohp = estimateStartingLoad({ exercise: "DB shoulder press", history, targetReps: "6–10", fallbackKg: 10 });
  assert.equal(ohp.source, "cross-exercise-estimate"); assert.ok(ohp.kg >= 12.5 && ohp.kg <= 17.5, String(ohp.kg));
  const bar = estimateStartingLoad({ exercise: "Barbell bench press", history, targetReps: "5–8", fallbackKg: 50 });
  assert.ok(bar.kg >= 47.5 && bar.kg <= 57.5, String(bar.kg));
  // Different machines are different levers: no 1:1 transfer leg press → pendulum squat.
  const pend = estimateStartingLoad({ exercise: "Pendulum squat", history: hist([{ date: "2026-10-01", ex: [["Pivot leg press", 180, 8, 8]] }]), targetReps: "6–10", fallbackKg: 35 });
  assert.equal(pend.source, "catalogue-default");
  assert.equal(EXERCISE_INTELLIGENCE["Smith machine shrug"].loadUnit, LOAD_UNITS.BARBELL_KG);
});

test("warm-ups round down, never repeat a load and stay below the work load", () => {
  assert.deepEqual(warmupRows("DB bench press", 5).map(r => r[3]), ["2,5"]);
  assert.deepEqual(warmupRows("DB bench press", 10).map(r => r[3]), ["2,5", "5", "7,5"]);
  assert.deepEqual(warmupRows("Pivot leg press", 150, false).map(r => r[3]), ["97,5"]);
  const female = generateStrengthPlan(ctx("2026-10-05", { sex: "female" }), { focus: "upper", durationMinutes: 60 });
  const warm = female.rows.filter(r => r[0] === "WARMUP").map(r => r[1] + r[3]);
  assert.equal(new Set(warm).size, warm.length);
});

test("workout analysis reads both key styles and agrees with the next plan", () => {
  const camel = analyzeCompletedWorkout({ date: "2026-10-05", completedRows: [1, 2, 3].map(i => ({ type: "WORK", exercise: "DB bench press", setNo: i, actualKg: 25, actualReps: 10, rpe: 6, plannedKg: 25, plannedReps: "6–10" })) });
  const snake = analyzeCompletedWorkout({ date: "2026-10-05", completedRows: [1, 2, 3].map(i => ({ type: "WORK", exercise: "DB bench press", set_no: i, actual_kg: 25, actual_reps: 10, rpe: 6, planned_kg: 25, planned_reps: "6–10" })) });
  assert.deepEqual(camel.exercises, snake.exercises);
  assert.equal(camel.exercises[0].actualKg, 25); assert.equal(camel.exercises[0].action, "increase"); assert.equal(camel.exercises[0].nextKg, 27.5);
  const low = analyzeCompletedWorkout({ date: "2026-10-05", completedRows: [{ type: "WORK", exercise: "DB bench press", actual_kg: 25, actual_reps: 3, rpe: 7, planned_kg: 25, planned_reps: "6–10" }] });
  assert.equal(low.exercises[0].repsVsPlan, "below"); assert.equal(low.recommendations[0].action, "reduce");
  // Blank actuals on a completed set mean the prescription; the sheet parser feeds it directly.
  const plan = generateStrengthPlan(ctx("2026-10-05"), { focus: "upper", durationMinutes: 45 });
  const values = planValues(plan);
  for (const r of values.slice(7)) if (r[0] === "WORK") { r[6] = r[4].split("–")[1]; r[7] = "6"; r[8] = "TRUE"; }
  const a = analyzeCompletedWorkout(parseStrengthSheet(values), []);
  assert.ok(a.exercises.every(x => x.actualKg != null && ["increase", "increase_small"].includes(x.action)), JSON.stringify(a.exercises));
  const next = generateStrengthPlan(ctx("2026-10-12", { sets: hist([{ date: "2026-10-05", ex: [[a.exercises[0].exercise, a.exercises[0].actualKg, a.exercises[0].topReps, 6, 3, a.exercises[0].targetReps]] }]) }), { focus: "upper", durationMinutes: 45 });
  const nextEstimate = next.loadEstimates.find(x => x.exercise === a.exercises[0].exercise);
  assert.ok(nextEstimate); assert.equal(nextEstimate.kg, a.exercises[0].nextKg);
});

test("an exercise swap brings the new exercise's note, rest, effort and a single warm-up set", () => {
  const sets = hist([{ date: "2026-09-28", ex: [["DB bench press", 25, 8, 8], ["Low row", 55, 8, 8]] }]);
  const plan = generateStrengthPlan(ctx("2026-10-05", { sets }), { focus: "upper", durationMinutes: 60 });
  const values = planValues(plan);
  const pull = work(plan).find(ex => ex === "Lat pulldown" || ex === "Low row");
  assert.ok(pull);
  const swap = prepareGymSwap({ values, history: sets }, pull, pull === "Low row" ? "Standing rowing machine" : "Close-grip lat pulldown", "obsazeno");
  const warm = swap.replacementRows.filter(r => r[0] === "WARMUP"), workRows = swap.replacementRows.filter(r => r[0] === "WORK");
  assert.ok(warm.length <= 1);
  for (const r of warm) assert.equal(Number(r[3].replace(",", ".")) % 2.5, 0);
  for (const r of workRows) { assert.match(r[9], /\[Pauza \d+ s\]/); assert.match(r[9], /cíl RPE|technického selhání/); }
  const bench = prepareGymSwap({ values, history: sets }, "DB bench press", "Barbell bench press", "obsazeno");
  const benchWork = bench.replacementRows.filter(r => r[0] === "WORK");
  assert.doesNotMatch(benchWork[0][9], /jednoručka/); assert.match(benchWork[0][9], /celá osa/);
  assert.ok(bench.kg >= 47.5 && bench.kg <= 57.5);
  // Replacing the first main lift keeps a full ramp, in loads the rack has.
  const ramp = bench.replacementRows.filter(r => r[0] === "WARMUP");
  assert.equal(ramp.length, 3); for (const r of ramp) assert.equal(Number(r[3].replace(",", ".")) % 2.5, 0);
});

test("deload: after six weeks without a break, for a planned recovery week, then back to the pre-deload loads", () => {
  const sessions = [];
  for (let w = 0; w < 6; w++) for (const d of [0, 3]) {
    const date = new Date(Date.UTC(2026, 7, 24 + w * 7 + d)).toISOString().slice(0, 10);
    sessions.push({ date, ex: [["Pivot leg press", 140 + w * 5, 8, 8, 3, "6–10"], ["DB bench press", 20 + w * 2.5, 8, 8, 3, "6–10"]] });
  }
  const sets = hist(sessions).sort((a, b) => b.workout_date.localeCompare(a.workout_date));
  const plan = generateStrengthPlan(ctx("2026-10-05", { sets }), { durationMinutes: 60 });
  assert.equal(plan.deload.active, true); assert.match(plan.planName, /odlehčení/);
  assert.match(plan.rationale, /Odlehčovací týden/); assert.match(plan.rationale, /40 %/);
  assert.ok(plan.rows.filter(r => r[0] === "WORK").every(r => /\[Deload\]/.test(r[9]) && /cíl RPE 6 \(4 opakování v rezervě\)/.test(r[9])));
  assert.ok(work(plan).every(ex => setsOf(plan, ex).length <= 2));
  assert.ok(kgOf(plan, "Pivot leg press") <= 165 * 0.9);
  assert.equal(plan.rows.filter(r => r[11] === "TRUE").length, 0);
  // A recovery week from the week plan is honoured even early in a block.
  const early = generateStrengthPlan({ ...ctx("2026-10-05", { sets: hist(sessions.slice(-2)) }), recoveryWeek: true }, { durationMinutes: 60 });
  assert.equal(early.deload.active, true); assert.match(early.deload.reason, /regenerační týden/);
  assert.equal(generateStrengthPlan(ctx("2026-10-05", { sets: hist(sessions.slice(-2)) }), { durationMinutes: 60, recoveryWeek: true }).deload.active, true);
  // After the deload week the anchor is the last normal session again.
  const deloaded = hist([{ date: "2026-10-05", ex: [["Pivot leg press", 147.5, 8, 6, 2, "6–10", "[Deload]"]] }, { date: "2026-10-08", ex: [["DB bench press", 30, 8, 6, 2, "6–10", "[Deload]"]] }]);
  const after = generateStrengthPlan(ctx("2026-10-15", { sets: [...deloaded, ...sets] }), { durationMinutes: 60 });
  assert.equal(after.deload.active, false);
  const legPress = after.loadEstimates.find(x => x.exercise === "Pivot leg press");
  assert.ok(legPress); assert.equal(legPress.referenceKg, 165);
});

test("an empty plan never reaches storage: fallback exercises or a clear Czech error", () => {
  assert.throws(() => planValues({ date: "2026-10-05", rows: [] }), /Plán neobsahuje žádné série/);
  const all = Object.keys(EXERCISES).map(ex => [ex, 20, 10, 7, 1]);
  const yesterday = generateStrengthPlan(ctx("2026-10-05", { sets: hist([{ date: "2026-10-04", ex: all }]) }), { durationMinutes: 60 });
  assert.ok(work(yesterday).length >= 3); assert.match(yesterday.rationale, /opakují/);
  assert.throws(() => generateStrengthPlan(ctx("2026-10-05"), { durationMinutes: 60, excludeExercises: Object.keys(EXERCISES) }), /nezbyl žádný vhodný cvik/);
});

test("the rationale's time line is accurate and names what the time limit dropped", () => {
  const plan = generateStrengthPlan(ctx("2026-10-05"), { durationMinutes: 30, maxExercises: 6 });
  assert.match(plan.rationale, new RegExp("odhad " + plan.timing.estimatedMinutes + " min z 30 min"));
  assert.match(plan.rationale, /Kvůli času vypadlo: /);
});
