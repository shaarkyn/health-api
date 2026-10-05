import { normalizeExerciseName } from "./strength-normalization.js";
import { resolveStrengthPerformance } from "./strength-history.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export const LOAD_UNITS = {
  PER_HAND_KG: "per_hand_kg",
  MACHINE_TOTAL_KG: "machine_total_kg",
  BARBELL_KG: "barbell_kg",
  MACHINE_PER_SIDE_KG: "machine_per_side_kg",
  CABLE_STACK_KG: "cable_stack_kg",
  BODYWEIGHT: "bodyweight"
};

export const EXERCISE_INTELLIGENCE = {
  "DB bench press": { muscle: "chest", pattern: "horizontal_push", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 1.0, variants: ["Chest flat press Prime", "Barbell bench press", "DB incline press"] },
  "Barbell bench press": { muscle: "chest", pattern: "horizontal_push", equipment: "barbell", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 1.05, variants: ["DB bench press", "DB incline press"] },
  "DB incline press": { muscle: "chest", pattern: "incline_push", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 1.0, variants: ["DB bench press", "Barbell bench press"] },
  "Standing multi flight": { muscle: "side_delts", pattern: "lateral_raise", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.4, variants: ["Cable lateral raise"] },
  "One-arm DB row": { muscle: "back", pattern: "horizontal_pull", equipment: "dumbbell", unilateral: true, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.8, variants: ["Low row", "Standing rowing machine"] },
  "Face pull": { muscle: "rear_delts", pattern: "horizontal_abduction", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.35, variants: ["Rear delt pec deck", "Cable rear delt fly"] },
  "Cable overhead triceps extension": { muscle: "triceps", pattern: "elbow_extension", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.45, variants: ["Cable triceps extension"] },
  "Goblet squat": { muscle: "quads", pattern: "knee_dominant", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.9, variants: ["Pendulum squat", "Pivot leg press"] },
  "Low row": { muscle: "back", pattern: "horizontal_pull", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 1.0, variants: ["Standing rowing machine", "Lat pulldown"] },
  "DB shoulder press": { muscle: "shoulders", pattern: "vertical_push", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.9, variants: ["Shoulder press Prime"] },
  "Pivot leg press": { muscle: "quads", pattern: "knee_dominant", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 1.35, variants: ["Pendulum squat", "Leg extension Prime", "DB Bulgarian split squat"] },
  "Prone leg curl Prime": { muscle: "hamstrings", pattern: "knee_flexion", equipment: "machine", unilateral: true, loadUnit: LOAD_UNITS.MACHINE_PER_SIDE_KG, fatigue: 0.85, variants: ["DB Romanian deadlift", "Barbell Romanian deadlift", "Hip thrust"] },
  "Cable curl": { muscle: "biceps", pattern: "elbow_flexion", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.45, variants: ["DB curl", "Hammer curl"] },
  "DB curl": { muscle: "biceps", pattern: "elbow_flexion", equipment: "dumbbell", unilateral: true, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.45, variants: ["Cable curl", "Hammer curl"] },
  "Hammer curl": { muscle: "biceps", pattern: "elbow_flexion", equipment: "dumbbell", unilateral: true, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.45, variants: ["DB curl", "Cable curl"] },
  "Cable triceps extension": { muscle: "triceps", pattern: "elbow_extension", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.45, variants: ["Cable triceps pushdown", "Overhead cable triceps extension"] },
  "Abs bench crunch": { muscle: "core", pattern: "trunk_flexion", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.35, variants: ["Cable crunch", "Roman chair"] },
  "Chest flat press Prime": { muscle: "chest", pattern: "horizontal_push", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.95, variants: ["DB bench press"] },
  "Shoulder press Prime": { muscle: "shoulders", pattern: "vertical_push", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.9, variants: ["DB shoulder press"] },
  "Lat pulldown": { muscle: "back", pattern: "vertical_pull", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.9, variants: ["Low row", "Cable pullover"] },
  "Standing rowing machine": { muscle: "back", pattern: "horizontal_pull", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.95, variants: ["Low row"] },
  "Pendulum squat": { muscle: "quads", pattern: "knee_dominant", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 1.3, variants: ["Pivot leg press"] },
  "Leg extension Prime": { muscle: "quads", pattern: "knee_extension", equipment: "machine", unilateral: true, loadUnit: LOAD_UNITS.MACHINE_PER_SIDE_KG, fatigue: 0.65, variants: ["Pivot leg press", "DB Bulgarian split squat"] },
  "Hip thrust": { muscle: "glutes", pattern: "hip_extension", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 1.0, variants: ["DB Romanian deadlift"] },
  "DB Romanian deadlift": { muscle: "hamstrings", pattern: "hip_hinge", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 1.0, variants: ["Barbell Romanian deadlift", "Prone leg curl Prime"] },
  "Barbell Romanian deadlift": { muscle: "hamstrings", pattern: "hip_hinge", equipment: "barbell", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 1.1, variants: ["DB Romanian deadlift"] },
  "DB Bulgarian split squat": { muscle: "quads", pattern: "unilateral_knee_dominant", equipment: "dumbbell", unilateral: true, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 1.0, variants: ["Pivot leg press", "Leg extension Prime"] },
  "Adduction machine": { muscle: "adductors", pattern: "adduction", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.35, variants: [] },
  "Abduction machine": { muscle: "abductors", pattern: "abduction", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.35, variants: [] },
  "Pec deck": { muscle: "chest", pattern: "horizontal_adduction", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.55, variants: ["DB bench press"] },
  "Rear delt pec deck": { muscle: "rear_delts", pattern: "horizontal_abduction", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.45, variants: ["Cable rear delt fly"] },
  "Cable lateral raise": { muscle: "side_delts", pattern: "lateral_raise", equipment: "cable", unilateral: true, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.35, variants: [] },
  "Cable pullover": { muscle: "back", pattern: "vertical_pull", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.45, variants: ["Lat pulldown"] },
  "Cable rear delt fly": { muscle: "rear_delts", pattern: "horizontal_abduction", equipment: "cable", unilateral: true, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.35, variants: ["Rear delt pec deck"] },
  "Pallof press": { muscle: "core", pattern: "anti_rotation", equipment: "cable", unilateral: true, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.3, variants: ["Cable woodchop"] },
  "Cable woodchop": { muscle: "core", pattern: "rotation", equipment: "cable", unilateral: true, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.3, variants: ["Pallof press"] },
  "Roman chair": { muscle: "core", pattern: "trunk_extension", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.4, variants: ["Abs bench crunch"] },
  "Standing calf raise": { muscle: "calves", pattern: "plantar_flexion", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.45, variants: [] },
  "Cable crunch": { muscle: "core", pattern: "trunk_flexion", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.35, variants: ["Abs bench crunch"] },
  "Cable glute kickback": { muscle: "glutes", pattern: "hip_extension", equipment: "cable", unilateral: true, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.35, variants: ["Glute hyperextension", "Hip thrust"] },
  "Cable pull-through": { muscle: "glutes", pattern: "hip_hinge", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.5, variants: ["DB Romanian deadlift", "Hip thrust"] },
  "Cable hip abduction": { muscle: "abductors", pattern: "abduction", equipment: "cable", unilateral: true, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.3, variants: ["Abduction machine"] },
  "Barbell hip thrust": { muscle: "glutes", pattern: "hip_extension", equipment: "barbell", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 1.0, variants: ["Hip thrust"] },
  "DB reverse lunge": { muscle: "glutes", pattern: "lunge", equipment: "dumbbell", unilateral: true, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.9, variants: ["DB step-up", "DB Bulgarian split squat"] },
  "DB step-up": { muscle: "glutes", pattern: "lunge", equipment: "dumbbell", unilateral: true, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.85, variants: ["DB reverse lunge", "DB Bulgarian split squat"] },
  "DB single-leg Romanian deadlift": { muscle: "hamstrings", pattern: "hip_hinge", equipment: "dumbbell", unilateral: true, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.8, variants: ["DB Romanian deadlift"] },
  "DB sumo squat": { muscle: "quads", pattern: "knee_dominant", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.85, variants: ["Goblet squat"] },
  "Leg press high feet": { muscle: "glutes", pattern: "glute_press", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 1.2, variants: ["Pivot leg press", "Hip thrust"] },
  "Abduction machine forward lean": { muscle: "glutes", pattern: "abduction", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.35, variants: ["Abduction machine"] },
  "Glute hyperextension": { muscle: "glutes", pattern: "hip_extension", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.45, variants: ["Roman chair", "Cable pull-through"] },
  "Cable fly": { muscle: "chest", pattern: "horizontal_adduction", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.5, variants: ["Pec deck", "Low-to-high cable fly"] },
  "Low-to-high cable fly": { muscle: "chest", pattern: "horizontal_adduction", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.45, variants: ["Cable fly"] },
  "Single-arm cable row": { muscle: "back", pattern: "horizontal_pull", equipment: "cable", unilateral: true, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.6, variants: ["One-arm DB row", "Low row"] },
  "Close-grip lat pulldown": { muscle: "back", pattern: "vertical_pull", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.85, variants: ["Lat pulldown"] },
  "Wide-grip low row": { muscle: "back", pattern: "horizontal_pull", equipment: "machine", unilateral: false, loadUnit: LOAD_UNITS.MACHINE_TOTAL_KG, fatigue: 0.8, variants: ["Low row"] },
  "Barbell row": { muscle: "back", pattern: "horizontal_pull", equipment: "barbell", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 1.05, variants: ["One-arm DB row", "Low row"] },
  "DB lateral raise": { muscle: "side_delts", pattern: "lateral_raise", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.35, variants: ["Cable lateral raise", "Standing multi flight"] },
  "DB Arnold press": { muscle: "shoulders", pattern: "vertical_push", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.85, variants: ["DB shoulder press"] },
  "DB rear delt fly": { muscle: "rear_delts", pattern: "horizontal_abduction", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.35, variants: ["Rear delt pec deck", "Face pull"] },
  "DB incline curl": { muscle: "biceps", pattern: "elbow_flexion", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.45, variants: ["DB curl", "Hammer curl"] },
  "Cable rope hammer curl": { muscle: "biceps", pattern: "elbow_flexion", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.45, variants: ["Cable curl", "Hammer curl"] },
  "Cable triceps kickback": { muscle: "triceps", pattern: "elbow_extension", equipment: "cable", unilateral: true, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.35, variants: ["Cable triceps extension"] },
  "DB overhead triceps extension": { muscle: "triceps", pattern: "elbow_extension", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.45, variants: ["Cable overhead triceps extension"] },
  "Single-leg calf raise": { muscle: "calves", pattern: "plantar_flexion", equipment: "dumbbell", unilateral: true, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.35, variants: ["Standing calf raise"] },
  "Barbell back squat": { muscle: "quads", pattern: "knee_dominant", equipment: "barbell", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 1.4, variants: ["Smith machine squat", "Pendulum squat"] },
  "Barbell front squat": { muscle: "quads", pattern: "knee_dominant", equipment: "barbell", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 1.3, variants: ["Barbell back squat", "Goblet squat"] },
  "Smith machine squat": { muscle: "quads", pattern: "knee_dominant", equipment: "smith", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 1.2, variants: ["Barbell back squat", "Pendulum squat"] },
  "Smith machine split squat": { muscle: "glutes", pattern: "lunge", equipment: "smith", unilateral: true, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 0.95, variants: ["DB Bulgarian split squat", "DB reverse lunge"] },
  "Smith machine hip thrust": { muscle: "glutes", pattern: "hip_extension", equipment: "smith", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 1.0, variants: ["Barbell hip thrust", "Hip thrust"] },
  "Smith machine incline press": { muscle: "chest", pattern: "incline_push", equipment: "smith", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 0.95, variants: ["DB incline press"] },
  "Barbell overhead press": { muscle: "shoulders", pattern: "vertical_push", equipment: "barbell", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 1.0, variants: ["DB shoulder press", "Shoulder press Prime"] },
  "DB wrist curl": { muscle: "forearms", pattern: "wrist_flexion", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.25, variants: ["Cable reverse curl", "DB reverse wrist curl"] },
  "DB reverse wrist curl": { muscle: "forearms", pattern: "wrist_extension", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.25, variants: ["Cable reverse curl", "DB wrist curl"] },
  "Cable reverse curl": { muscle: "forearms", pattern: "reverse_curl", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.3, variants: ["DB reverse wrist curl", "Hammer curl"] },
  "DB shrug": { muscle: "traps", pattern: "shrug", equipment: "dumbbell", unilateral: false, loadUnit: LOAD_UNITS.PER_HAND_KG, fatigue: 0.35, variants: ["Barbell shrug", "Smith machine shrug"] },
  "Barbell shrug": { muscle: "traps", pattern: "shrug", equipment: "barbell", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 0.45, variants: ["DB shrug", "Smith machine shrug"] },
  "Smith machine shrug": { muscle: "traps", pattern: "shrug", equipment: "smith", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 0.4, variants: ["Barbell shrug", "DB shrug"] },
  "Cable upright row": { muscle: "traps", pattern: "upright_row", equipment: "cable", unilateral: false, loadUnit: LOAD_UNITS.CABLE_STACK_KG, fatigue: 0.4, variants: ["DB shrug"] },
  "Barbell good morning": { muscle: "lower_back", pattern: "hip_hinge", equipment: "barbell", unilateral: false, loadUnit: LOAD_UNITS.BARBELL_KG, fatigue: 0.9, variants: ["Roman chair"] },

};

// Sheet and import values may be strings with a decimal comma.
function n(v) { if (v == null || v === "") return null; const x = Number(String(v).replace(",", ".")); return Number.isFinite(x) ? x : null; }
function dateKey(v) { return String(v || "").slice(0, 10); }
function dayGap(a, b) { return Math.round(Math.abs(Date.parse(dateKey(a) + "T12:00:00Z") - Date.parse(dateKey(b) + "T12:00:00Z")) / 86400000); }
export function parseRepRange(value) {
  const m = String(value || "").match(/(\d+)\s*[–-]\s*(\d+)/); if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const one = String(value || "").trim().match(/^(\d+)$/); return one ? { min: Number(one[1]), max: Number(one[1]) } : null;
}
function completedRowsForExercise(history, exercise) {
  const canonical = normalizeExerciseName(exercise).toLowerCase();
  return (history || []).filter(r => normalizeExerciseName(r.exercise).toLowerCase() === canonical && String(r.type || "WORK").toUpperCase() === "WORK" && Number(r.completed ?? 1) === 1);
}

function scoreSimilarity(from, to) {
  const a = EXERCISE_INTELLIGENCE[from], b = EXERCISE_INTELLIGENCE[to];
  if (!a || !b) return 0;
  let score = 0;
  if (a.muscle === b.muscle) score += 0.40;
  if (a.pattern === b.pattern) score += 0.35;
  if (a.equipment === b.equipment) score += 0.10;
  if (a.unilateral === b.unilateral) score += 0.05;
  if (a.loadUnit === b.loadUnit) score += 0.10;
  return score;
}

// 1RM of each lift relative to its family's barbell reference (per hand for
// dumbbells: two dumbbells ≈ barbell / 1.15). Machines are lever-specific, so
// a transfer to or from one is a rough guess (third value).
const STRENGTH_RATIO = {
  "Barbell bench press": ["press", 1], "DB bench press": ["press", 1 / 2.3], "DB incline press": ["press", .85 / 2.3], "Smith machine incline press": ["press", .85],
  "Chest flat press Prime": ["press", 1, true], "Barbell overhead press": ["press", .6], "DB shoulder press": ["press", .6 / 2.3], "DB Arnold press": ["press", .55 / 2.3],
  "Barbell row": ["row", 1], "One-arm DB row": ["row", .45], "Low row": ["row", 1, true], "Wide-grip low row": ["row", .85, true], "Lat pulldown": ["row", 1, true], "Close-grip lat pulldown": ["row", 1, true], "Single-arm cable row": ["row", .4, true],
  "Barbell back squat": ["squat", 1], "Barbell front squat": ["squat", .8], "Smith machine squat": ["squat", 1], "Goblet squat": ["squat", .3], "DB sumo squat": ["squat", .3], "DB Bulgarian split squat": ["squat", .2], "Smith machine split squat": ["squat", .45], "Pivot leg press": ["squat", 2.2, true],
  "Barbell Romanian deadlift": ["hinge", 1], "DB Romanian deadlift": ["hinge", 1 / 2.3], "DB single-leg Romanian deadlift": ["hinge", .2], "Barbell hip thrust": ["hinge", 1.3], "Smith machine hip thrust": ["hinge", 1.3], "Hip thrust": ["hinge", 1.3, true], "Barbell good morning": ["hinge", .5]
};
// Ratio of the target's 1RM to the reference's, or null when unrelated.
function transferFactor(from, to) {
  const a = EXERCISE_INTELLIGENCE[from], b = EXERCISE_INTELLIGENCE[to];
  if (!a || !b) return null;
  const x = STRENGTH_RATIO[from], y = STRENGTH_RATIO[to];
  // Two different machines are different levers: same pattern ≠ same kilos.
  if (a.loadUnit === b.loadUnit && a.equipment === b.equipment && a.pattern === b.pattern && a.equipment !== "machine") return { factor: 1, machine: false };
  return x && y && x[0] === y[0] ? { factor: y[1] / x[1], machine: Boolean(x[2] || y[2]) } : null;
}

export const LOAD_RULES = {
  // METAGYM dumbbells: use a practical standard until the exact rack inventory is verified.
  // Light pairs from 2.5 kg are needed for raises, flies and starting loads of women.
  DUMBBELL: { min: 2.5, max: 50, step: 2.5, strict: true },
  // Cable stacks are machine-specific; 2.5 kg is the temporary conservative default.
  CABLE_STACK: { min: 2.5, max: null, step: 2.5, strict: true },
  // Plate-loaded machines and barbells can be built from 1.25 kg plates per side.
  PLATE_LOADED: { min: 2.5, max: null, step: 2.5, strict: false },
  BARBELL: { min: 10, max: null, step: 2.5, strict: true }
};

function loadRule(meta) {
  if (!meta) return LOAD_RULES.PLATE_LOADED;
  if (meta.loadUnit === LOAD_UNITS.PER_HAND_KG) return LOAD_RULES.DUMBBELL;
  if (meta.loadUnit === LOAD_UNITS.CABLE_STACK_KG) return LOAD_RULES.CABLE_STACK;
  if (meta.loadUnit === LOAD_UNITS.BARBELL_KG) return LOAD_RULES.BARBELL;
  return LOAD_RULES.PLATE_LOADED;
}

// mode "up"/"down" rounds in the direction of a load change, so a small
// increase never rounds back to the old weight (2.5 % of 15 kg is 0.4 kg).
function roundToStep(value, step, min = 0, max = null, mode = "nearest") {
  if (value == null || !Number.isFinite(value)) return null;
  const q = value / step, k = mode === "up" ? Math.ceil(q - 1e-9) : mode === "down" ? Math.floor(q + 1e-9) : Math.round(q);
  let rounded = Math.max(min, k * step);
  if (max != null) rounded = Math.min(max, rounded);
  return Math.round(rounded * 100) / 100;
}

export function resolveLoad(exercise, value, mode = "nearest") {
  exercise = normalizeExerciseName(exercise);
  const rule = loadRule(EXERCISE_INTELLIGENCE[exercise]);
  return roundToStep(value, rule.step, rule.min, rule.max, mode);
}
export function loadStep(exercise) { return loadRule(EXERCISE_INTELLIGENCE[normalizeExerciseName(exercise)]).step; }

function normalizeRpe(value) {
  const x = n(value);
  // 0 is used by the sheet/import pipeline for an unknown RPE, not for an
  // actual maximal-effort score.
  return x != null && x > 0 && x <= 10 ? x : null;
}
// Epley with reps in reserve: the load a set implies for one maximal rep, and back.
export function estimateOneRepMax(kg, reps, rir = 2) { return kg * (1 + (reps + rir) / 30); }
export function loadForReps(oneRepMax, reps, rir = 2) { return oneRepMax / (1 + (reps + rir) / 30); }
const rirOf = row => { const rpe = normalizeRpe(row.rpe); return rpe == null ? 2 : clamp(10 - rpe, 0, 5); };
const field = (row, snake, camel) => row?.[snake] ?? row?.[camel];
const failureSet = row => row.toFailure === true || /\[Do selhání\]/.test(String(row.note || ""));

// One entry per workout, newest first, with its best set (highest e1RM).
// Deload, reset and reduced-dose sessions are recognised by their note tags.
export function strengthSessions(rows) {
  const byDate = new Map();
  for (const r of rows || []) {
    const kg = n(field(r, "actual_kg", "actualKg")), reps = n(field(r, "actual_reps", "actualReps")), date = dateKey(r.workout_date ?? r.date);
    // 0 reps at a real load is a failed set: it counts as below the range.
    if (kg == null || kg <= 0 || reps == null || reps < 0 || !date) continue;
    const set = { kg, reps, rpe: normalizeRpe(r.rpe), failure: failureSet(r), plannedReps: field(r, "planned_reps", "plannedReps"), note: String(r.note || ""), e1: estimateOneRepMax(kg, reps, rirOf(r)) };
    const arr = byDate.get(date) || []; arr.push(set); byDate.set(date, arr);
  }
  return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, sets]) => {
    const top = sets.reduce((a, b) => b.e1 > a.e1 ? b : a), notes = sets.map(s => s.note).join(" ");
    const kind = /\[Deload\]/.test(notes) ? "deload" : /\[Reset\]/.test(notes) ? "reset" : /sportovní zátěž/.test(notes) ? "reduced" : "normal";
    // Back-off sets (well below the top load) do not decide the progression.
    return { date, sets, top, work: sets.filter(s => s.kg >= top.kg * 0.9), kind };
  });
}
// Consecutive latest sessions without an e1RM gain; a deload or reset ends the count.
export function stallCount(sessions) {
  const s = (sessions || []).filter(x => x.kind !== "reduced"); let count = 0;
  for (let i = 0; i + 1 < s.length && count < 3; i++) {
    if (s[i].kind === "deload" || s[i].kind === "reset" || s[i + 1].kind === "deload") break;
    if (s[i].top.e1 > s[i + 1].top.e1 * 1.01) break;
    count++;
  }
  return count;
}

// Double progression on one session's working sets: all sets at the top of
// the range with RPE ≤ 8 (or unknown) → heavier; a set below the range or a
// near-maximal set (not a planned failure set) → lighter; otherwise keep the
// load and add a rep.
export function progressionDecision(work, range) {
  if (!work?.length || !range) return { action: "hold", reason: "no-range" };
  const rpes = work.filter(s => !s.failure && s.rpe != null).map(s => s.rpe), maxRpe = rpes.length ? Math.max(...rpes) : null;
  const minReps = Math.min(...work.map(s => s.reps));
  if (minReps < range.min) return { action: "decrease", reason: "below", minReps, maxRpe };
  if (maxRpe != null && maxRpe >= 9.5) return { action: "decrease", reason: "rpe", minReps, maxRpe };
  if (minReps >= range.max && (maxRpe == null || maxRpe <= 8)) return { action: maxRpe != null && maxRpe <= 6.5 ? "increase2" : "increase", reason: "top", minReps, maxRpe };
  return { action: "hold", reason: "reps", minReps, maxRpe };
}
const fmtKg = x => String(Math.round(x * 100) / 100).replace(".", ",");

// The next load from this exercise's own history, anchored on the latest
// normal session (older sessions only add confidence and stall detection).
// opts: targetRir, hold (no increase), deload, convert (dose changed: go via e1RM).
function estimateFromOwnHistory(own, exercise, targetReps, opts = {}) {
  const sessions = strengthSessions(own);
  if (!sessions.length) return null;
  const latest = sessions[0], step = loadStep(exercise), targetRir = opts.targetRir ?? 2;
  const anchor = sessions.find(s => s.kind !== "deload" && s.kind !== "reduced" && dayGap(s.date, latest.date) <= 28) || latest;
  const range = parseRepRange(targetReps) || { min: anchor.top.reps, max: anchor.top.reps };
  // Only a planned range says the rep target changed; "10" may be just the reps done.
  const anchorRange = /[–-]/.test(String(anchor.top.plannedReps || "")) ? parseRepRange(anchor.top.plannedReps) : null;
  const rangeChanged = Boolean(anchorRange && (anchorRange.min !== range.min || anchorRange.max !== range.max));
  const convert = Boolean(opts.convert || rangeChanged || anchor.kind !== "normal" && anchor.kind !== "reset");
  const ref = anchor.top.kg;
  let kg = ref, action = "hold", note = "";
  if (convert) {
    // A different rep target or reserve: same strength, different load.
    const raw = loadForReps(anchor.top.e1, Math.round((range.min + range.max) / 2), targetRir);
    kg = resolveLoad(exercise, raw, raw < ref ? "down" : "nearest");
    if (opts.convert && kg > ref) kg = ref;
    action = kg > ref ? "increase" : kg < ref ? "decrease" : "hold";
    note = "přepočet z " + fmtKg(ref) + " kg × " + anchor.top.reps + " na " + range.min + "–" + range.max + " opakování";
  } else {
    const d = progressionDecision(anchor.work, range);
    action = d.action;
    // Two steps only where they are ≤ 10 % (5 kg on a 15 kg dumbbell is a third).
    if (action === "increase2") kg = resolveLoad(exercise, Math.max(ref * 1.05, ref + (2 * step <= ref * 0.1 ? 2 : 1) * step), "up");
    else if (action === "increase") kg = resolveLoad(exercise, Math.max(ref * 1.025, ref + step), "up");
    else if (action === "decrease") {
      // Far below the range needs more than one step: back to the middle of it.
      const mid = loadForReps(anchor.top.e1, Math.round((range.min + range.max) / 2), targetRir);
      kg = resolveLoad(exercise, Math.min(ref - step, mid), "down");
    }
    note = action.startsWith("increase") ? "+" + fmtKg(kg - ref) + " kg: minule všechny série na horní hranici (" + d.minReps + " opak.)" + (d.maxRpe != null ? " při RPE " + String(d.maxRpe).replace(".", ",") : "")
      : action === "decrease" ? "−" + fmtKg(ref - kg) + " kg: minule " + (d.reason === "below" ? d.minReps + " opak., pod rozsahem" : "RPE " + String(d.maxRpe).replace(".", ",")) : "";
  }
  const decided = action;
  if (opts.hold && action.startsWith("increase")) { kg = ref; action = "hold"; note = "bez zvyšování váhy kvůli regeneraci"; }
  const stalls = stallCount(sessions);
  if (opts.deload) { kg = resolveLoad(exercise, Math.min(kg * 0.9, kg - step), "down"); action = "deload"; note = "odlehčení: váha −10 %"; }
  else if (!convert && stalls >= 2 && !decided.startsWith("increase")) { kg = resolveLoad(exercise, Math.min(ref * 0.9, ref - step), "down"); action = "reset"; note = "stagnace " + stalls + " tréninky: lehčí restart (−10 %) a znovu nahoru"; }
  const repsHint = action === "hold" && !convert && !opts.hold ? Math.min(range.max, Math.max(range.min, Math.min(...anchor.work.map(s => s.reps)) + 1)) : null;
  if (repsHint != null) note = "drž " + fmtKg(kg) + " kg, zkus " + repsHint + " opak. (minule " + Math.min(...anchor.work.map(s => s.reps)) + ")";
  return {
    kg, source: "own-history", confidence: clamp(0.72 + Math.min(sessions.length, 5) * 0.055, 0.72, 1), action, note, repsHint, stalls,
    referenceExercise: exercise, referenceKg: ref, referenceReps: anchor.top.reps, referenceRpe: anchor.top.rpe,
    referenceDate: anchor.date, performanceCount: sessions.length,
    deltaPct: ref ? Math.round((kg / ref - 1) * 1000) / 10 : 0
  };
}

export function estimateStartingLoad({ exercise, history = [], targetReps = "8–15", fallbackKg = null, loadFactor = 1, targetRir = 2, hold = false, deload = false, convert = false }) {
  exercise = normalizeExerciseName(exercise);
  const def = EXERCISE_INTELLIGENCE[exercise];
  const trial = kg => ({ kg: resolveLoad(exercise, Number(kg) * 0.7 * Math.min(1, loadFactor || 1), "down"), source: "catalogue-default", confidence: 0.25, trial: true, action: "trial", note: "zkušební váha – najdi RPE 7" });
  if (!def) return fallbackKg == null ? { kg: null, source: "unknown", confidence: 0 } : trial(fallbackKg);
  const ownEstimate = estimateFromOwnHistory(completedRowsForExercise(history, exercise), exercise, targetReps, { targetRir, hold: hold || loadFactor < 0.95, deload, convert });
  if (ownEstimate) return ownEstimate;
  const range = parseRepRange(targetReps) || { min: 8, max: 12 }, candidates = [];
  for (const name of Object.keys(EXERCISE_INTELLIGENCE)) {
    if (name === exercise) continue;
    const transfer = transferFactor(name, exercise), similarity = scoreSimilarity(name, exercise);
    if (!transfer || transfer.factor === 1 && similarity < 0.85) continue;
    const sessions = strengthSessions(completedRowsForExercise(history, name));
    if (sessions.length) candidates.push({ name, top: sessions[0].top, date: sessions[0].date, similarity, ...transfer });
  }
  candidates.sort((a, b) => Number(b.factor === 1) - Number(a.factor === 1) || b.similarity - a.similarity || String(b.date).localeCompare(String(a.date)));
  const ref = candidates[0];
  if (ref) {
    // Another lift's strength, scaled by the ratio table; conservative (−10 %)
    // and still a trial: the first sets confirm it.
    const oneRm = ref.top.e1 * ref.factor * (ref.factor === 1 ? 1 : 0.9) * (ref.machine ? 0.9 : 1);
    const kg = resolveLoad(exercise, loadForReps(oneRm, Math.round((range.min + range.max) / 2), Math.max(targetRir, 2)) * Math.min(1, loadFactor || 1), "down");
    return { kg, source: "cross-exercise-estimate", confidence: clamp(0.35 + ref.similarity * 0.45 - (ref.machine ? 0.15 : 0), 0.3, 0.9), trial: ref.factor !== 1, action: "transfer", note: "odhad z " + ref.name + ", ověř RPE",
      referenceExercise: ref.name, referenceKg: ref.top.kg, referenceRpe: ref.top.rpe, referenceReps: ref.top.reps, referenceDate: ref.date, similarity: ref.similarity, transferFactor: Math.round(ref.factor * 1000) / 1000 };
  }
  if (fallbackKg != null) return trial(fallbackKg);
  return { kg: null, source: "no-reference", confidence: 0 };
}

const ACTION = { increase2: "increase", increase: "increase_small", hold: "hold", decrease: "reduce", reset: "reduce", deload: "reduce" };
// Reads both the parsed sheet (camelCase) and stored (snake_case) rows, and uses
// the generator's progression, so the analysis and the next plan agree.
export function analyzeCompletedWorkout(parsed, history = []) {
  const date = dateKey(parsed?.date);
  const work = (parsed?.completedRows || []).filter(r => String(r.type || "WORK").toUpperCase() === "WORK").map(r => {
    const plannedKg = n(field(r, "planned_kg", "plannedKg")), plannedReps = field(r, "planned_reps", "plannedReps");
    const done = resolveStrengthPerformance({ actualKg: field(r, "actual_kg", "actualKg"), actualReps: field(r, "actual_reps", "actualReps"), plannedKg, plannedReps });
    return { ...r, exercise: normalizeExerciseName(r.exercise), workout_date: date || r.workout_date, actual_kg: n(done.actualKg), actual_reps: n(done.actualReps), planned_kg: plannedKg, planned_reps: plannedReps, completed: 1, type: "WORK" };
  });
  if (!work.length) return { status: "ok", completedSets: 0, summary: "Zatím nejsou dokončené pracovní série k analýze.", exercises: [], recommendations: [] };
  const byExercise = new Map();
  for (const row of work) { const arr = byExercise.get(row.exercise) || []; arr.push(row); byExercise.set(row.exercise, arr); }
  const exercises = [], recommendations = [];
  for (const [exercise, rows] of byExercise) {
    const usable = rows.filter(r => r.actual_kg != null && r.actual_reps != null);
    const rpes = rows.map(r => normalizeRpe(r.rpe)).filter(x => x != null);
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    const targetReps = rows.find(r => parseRepRange(r.planned_reps))?.planned_reps || "8–12", range = parseRepRange(targetReps);
    const older = completedRowsForExercise(history, exercise).filter(r => dateKey(r.workout_date) !== date);
    const next = usable.length ? estimateFromOwnHistory([...usable, ...older], exercise, targetReps) : null;
    const action = next ? ACTION[next.action] || "hold" : "hold";
    const topReps = usable.length ? Math.max(...usable.map(r => r.actual_reps)) : null, lowReps = usable.length ? Math.min(...usable.map(r => r.actual_reps)) : null;
    const repsVsPlan = range && lowReps != null ? lowReps < range.min ? "below" : lowReps >= range.max ? "top" : "in_range" : null;
    exercises.push({ exercise, sets: rows.length, plannedKg: rows[0]?.planned_kg ?? null, actualKg: usable.length ? Math.max(...usable.map(r => r.actual_kg)) : null, avgRpe: avgRpe == null ? null : Math.round(avgRpe * 10) / 10, topReps, targetReps, repsVsPlan, action, nextKg: next?.kg ?? null, loadUnit: EXERCISE_INTELLIGENCE[exercise]?.loadUnit || null });
    const reason = !next ? "Chybí váha nebo opakování; zátěž zatím ponechat." : action === "increase" || action === "increase_small" ? "Všechny série na horní hranici rozsahu při kontrolovaném RPE; příště " + fmtKg(next.kg) + " kg." : action === "reduce" ? (repsVsPlan === "below" ? "Opakování pod rozsahem plánu" : "Série byla příliš blízko selhání") + "; příště " + fmtKg(next.kg) + " kg." : "Váhu ponech (" + fmtKg(next.kg) + " kg) a přidej opakování, než přidáš kila.";
    recommendations.push({ exercise, action, nextKg: next?.kg ?? null, reason });
  }
  return { status: "ok", completedSets: work.length, workoutDate: parsed.date, summary: `Analyzováno ${work.length} dokončených pracovních sérií ve ${byExercise.size} cvicích.`, exercises, recommendations };
}

export function findExerciseAlternatives(exercise, history = [], requestedMuscle = null) {
  exercise = normalizeExerciseName(exercise);
  const base = EXERCISE_INTELLIGENCE[exercise];
  const targetMuscle = requestedMuscle || base?.muscle;
  return Object.entries(EXERCISE_INTELLIGENCE)
    .filter(([name, meta]) => name !== exercise && (!targetMuscle || meta.muscle === targetMuscle))
    .map(([name, meta]) => ({ name, muscle: meta.muscle, pattern: meta.pattern, equipment: meta.equipment, unilateral: meta.unilateral, loadUnit: meta.loadUnit, similarity: base ? scoreSimilarity(exercise, name) : 0 }))
    .sort((a, b) => b.similarity - a.similarity);
}
