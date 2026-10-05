import { estimateStartingLoad, resolveLoad, strengthSessions, stallCount, EXERCISE_INTELLIGENCE } from "./strength-intelligence.js";
import { normalizeExerciseName } from "./strength-normalization.js";
import { isIntensity } from "./strength-context.js";
import { availableAt } from "./gym-equipment.js";
import { sportMuscleLoad, strengthCoverage, acuteSportStress } from './strength-balance.js';
import { trainingStatus } from './training-status.js';
import { configureStrengthCoaching, estimateStrengthTiming, isCompoundDef, defaultRir } from './strength-timing.js';

const DEFAULT_EXECUTION = "BILATERAL";

const EXERCISES = {
  "DB bench press": { pattern: "push", muscle: "chest", unilateral: false, sets: 3, reps: "6–10", baseKg: 16, warmup: true, note: "Hlavní tlak; kg = 1 jednoručka", fatigue: 1.0 },
  "Low row": { pattern: "pull", muscle: "back", unilateral: false, sets: 3, reps: "6–10", baseKg: 20, warmup: true, note: "Hlavní tah; kg = celková zátěž stroje", fatigue: 1.0 },
  "DB shoulder press": { pattern: "push_vertical", muscle: "shoulders", unilateral: false, sets: 3, reps: "6–10", baseKg: 10, warmup: true, note: "Volné váhy; kg = 1 jednoručka", fatigue: 0.9 },
  "Pivot leg press": { pattern: "quad", muscle: "quads", unilateral: false, sets: 3, reps: "6–10", baseKg: 145, warmup: true, note: "Hlavní cvik; kg = celková zátěž stroje", fatigue: 1.35 },
  "Prone leg curl Prime": { pattern: "hamstring", muscle: "hamstrings", unilateral: true, sets: 3, reps: "8–15", baseKg: 40, warmup: false, note: "Hamstringy; kg = zátěž na jednu stranu", fatigue: 0.85 },
  "Cable curl": { pattern: "biceps", muscle: "biceps", unilateral: false, sets: 3, reps: "8–15", baseKg: 15, warmup: false, note: "Biceps; kg = váha na kladce", fatigue: 0.45 },
  "DB curl": { pattern: "biceps", muscle: "biceps", unilateral: true, sets: 3, reps: "8–15", baseKg: 10, warmup: false, note: "Biceps; kg = 1 jednoručka", fatigue: 0.45 },
  "Hammer curl": { pattern: "biceps", muscle: "biceps", unilateral: true, sets: 3, reps: "8–15", baseKg: 10, warmup: false, note: "Biceps; kg = 1 jednoručka", fatigue: 0.45 },
  "Cable triceps extension": { pattern: "triceps", muscle: "triceps", unilateral: false, sets: 3, reps: "8–15", baseKg: 15, warmup: false, note: "Triceps; kg = váha na kladce", fatigue: 0.45 },
  "Abs bench crunch": { pattern: "core", muscle: "core", unilateral: false, sets: 3, reps: "10–20", baseKg: 52.5, warmup: false, note: "Core; kg = celková zátěž stroje", fatigue: 0.35 },
  "Chest flat press Prime": { pattern: "push", muscle: "chest", unilateral: false, sets: 3, reps: "8–12", baseKg: 42.5, warmup: true, note: "Hrudník; Prime stroj", fatigue: 0.95 },
  "Shoulder press Prime": { pattern: "push_vertical", muscle: "shoulders", unilateral: false, sets: 3, reps: "8–12", baseKg: 10, warmup: true, note: "Ramena; Prime stroj", fatigue: 0.9 },
  "Lat pulldown": { pattern: "pull_vertical", muscle: "back", unilateral: false, sets: 3, reps: "8–12", baseKg: 45, warmup: true, note: "Laty; kladka shora", fatigue: 0.9 },
  "Standing rowing machine": { pattern: "pull", muscle: "back", unilateral: false, sets: 3, reps: "8–12", baseKg: 40, warmup: true, note: "Záda; standing rowing machine", fatigue: 0.95 },
  "Pendulum squat": { pattern: "quad", muscle: "quads", unilateral: false, sets: 3, reps: "6–10", baseKg: 35, warmup: true, note: "Kvadricepsy; pendulum squat", fatigue: 1.3 },
  "Leg extension Prime": { pattern: "quad", muscle: "quads", unilateral: true, sets: 2, reps: "10–15", baseKg: 45, warmup: false, note: "Kvadricepsy; ideálně jednostranně", fatigue: 0.65 },
  "Hip thrust": { pattern: "hip_extension", muscle: "glutes", unilateral: false, sets: 3, reps: "6–12", baseKg: 40, warmup: true, note: "Hýždě; hip thrust", fatigue: 1.0 },
  "DB Romanian deadlift": { pattern: "hinge", muscle: "hamstrings", unilateral: false, sets: 3, reps: "8–12", baseKg: 27.5, warmup: true, note: "Hamstringy/hýždě; kg = 1 jednoručka", fatigue: 1.0 },
  "Barbell Romanian deadlift": { pattern: "hinge", muscle: "hamstrings", unilateral: false, sets: 3, reps: "6–10", baseKg: 70, warmup: true, note: "Hamstringy/hýždě; osa", fatigue: 1.1 },
  "DB Bulgarian split squat": { pattern: "unilateral_quad", muscle: "quads", unilateral: true, sets: 3, reps: "8–12", baseKg: 20, warmup: false, note: "Jednostranná síla; kg = 1 jednoručka", fatigue: 1.0 },
  "Adduction machine": { pattern: "adduction", muscle: "adductors", unilateral: false, sets: 2, reps: "15–20", baseKg: 60, warmup: false, note: "Adduktory; stroj", fatigue: 0.35 },
  "Abduction machine": { pattern: "abduction", muscle: "abductors", unilateral: false, sets: 2, reps: "15–20", baseKg: 60, warmup: false, note: "Abduktory; stroj", fatigue: 0.35 },
  "Pec deck": { pattern: "horizontal_push", muscle: "chest", unilateral: false, sets: 3, reps: "10–15", baseKg: 40, warmup: false, note: "Hrudník; pec deck", fatigue: 0.55 },
  "Rear delt pec deck": { pattern: "rear_delt", muscle: "rear_delts", unilateral: false, sets: 3, reps: "10–15", baseKg: 31, warmup: false, note: "Zadní delty; reverse pec deck", fatigue: 0.45 },
  "Cable lateral raise": { pattern: "lateral_raise", muscle: "side_delts", unilateral: true, sets: 3, reps: "10–15", baseKg: 10, warmup: false, note: "Boční delty; jednostranně na kladce", fatigue: 0.35 },
  "Cable pullover": { pattern: "pull_vertical", muscle: "back", unilateral: false, sets: 2, reps: "10–15", baseKg: 35, warmup: false, note: "Laty; kladka", fatigue: 0.45 },
  "Cable rear delt fly": { pattern: "rear_delt", muscle: "rear_delts", unilateral: true, sets: 2, reps: "10–15", baseKg: 15, warmup: false, note: "Zadní delty; jednostranně na kladce", fatigue: 0.35 },
  "Pallof press": { pattern: "anti_rotation", muscle: "core", unilateral: true, sets: 3, reps: "10–15", baseKg: 30, warmup: false, note: "Anti-rotace; jednostranně", fatigue: 0.3 },
  "Cable woodchop": { pattern: "rotation", muscle: "core", unilateral: true, sets: 2, reps: "8–12", baseKg: 25, warmup: false, note: "Rotace; jednostranně", fatigue: 0.3 },
  "Roman chair": { pattern: "trunk_extension", muscle: "core", unilateral: false, sets: 3, reps: "10–15", baseKg: 20, warmup: false, note: "Core/hyperextenze; stroj", fatigue: 0.4 },
  "Standing calf raise": { pattern: "plantar_flexion", muscle: "calves", unilateral: false, sets: 3, reps: "10–20", baseKg: 50, warmup: false, note: "Lýtka; stroj", fatigue: 0.45 },
  "Cable crunch": { pattern: "trunk_flexion", muscle: "core", unilateral: false, sets: 3, reps: "10–20", baseKg: 30, warmup: false, note: "Core; kladka", fatigue: 0.35 },
  "Barbell bench press": { pattern: "push", muscle: "chest", unilateral: false, sets: 3, reps: "5–8", baseKg: 50, warmup: true, note: "Hlavní tlak; benchpress s osou, kg = celá osa", fatigue: 1.05 },
  "DB incline press": { pattern: "push", muscle: "chest", unilateral: false, sets: 3, reps: "8–12", baseKg: 14, warmup: true, note: "Horní hrudník; polohovací lavice 30°, kg = 1 jednoručka", fatigue: 0.95 },
  "One-arm DB row": { pattern: "pull", muscle: "back", unilateral: true, sets: 3, reps: "8–12", baseKg: 22, warmup: false, note: "Záda; opora o lavici, kg = 1 jednoručka", fatigue: 0.8 },
  "Standing multi flight": { pattern: "lateral_raise", muscle: "side_delts", unilateral: false, sets: 3, reps: "10–15", baseKg: 20, warmup: false, note: "Boční ramena; stroj na roztahování ve stoje", fatigue: 0.4 },
  "Face pull": { pattern: "rear_delt", muscle: "rear_delts", unilateral: false, sets: 3, reps: "12–15", baseKg: 20, warmup: false, note: "Zadní ramena a lopatky; lano na kladce", fatigue: 0.35 },
  "Cable overhead triceps extension": { pattern: "triceps", muscle: "triceps", unilateral: false, sets: 3, reps: "10–15", baseKg: 15, warmup: false, note: "Triceps (dlouhá hlava); lano na kladce za hlavou", fatigue: 0.45 },
  "Goblet squat": { pattern: "quad", muscle: "quads", unilateral: false, sets: 3, reps: "8–12", baseKg: 20, warmup: false, note: "Dřep s jednoručkou na hrudi", fatigue: 0.9 },
  // Variations on the same METAGYM stations (added 2026-10-03).
  "Cable glute kickback": { pattern: "glute_kickback", muscle: "glutes", unilateral: true, sets: 3, reps: "10–15", baseKg: 10, warmup: false, note: "Hýždě; manžeta na kotníku, kladka dole, kg = váha na kladce", fatigue: 0.35 },
  "Cable pull-through": { pattern: "hinge", muscle: "glutes", unilateral: false, sets: 3, reps: "10–15", baseKg: 20, warmup: false, note: "Hýždě a hamstringy; lano mezi nohama, pohyb z kyčlí", fatigue: 0.5 },
  "Cable hip abduction": { pattern: "abduction", muscle: "abductors", unilateral: true, sets: 2, reps: "12–20", baseKg: 5, warmup: false, note: "Střední hýžďový sval; unožování ve stoje na kladce", fatigue: 0.3 },
  "Barbell hip thrust": { pattern: "hip_extension", muscle: "glutes", unilateral: false, sets: 3, reps: "8–12", baseKg: 60, warmup: true, note: "Hýždě; záda o polohovací lavici, osa přes pánev s podložkou, kg = celá osa", fatigue: 1.0 },
  "DB reverse lunge": { pattern: "lunge", muscle: "glutes", unilateral: true, sets: 3, reps: "8–12", baseKg: 10, warmup: false, note: "Hýždě a stehna; výpad vzad, kg = 1 jednoručka", fatigue: 0.9 },
  "DB step-up": { pattern: "lunge", muscle: "glutes", unilateral: true, sets: 3, reps: "8–12", baseKg: 10, warmup: false, note: "Hýždě a stehna; výstupy na polohovací lavici, kg = 1 jednoručka", fatigue: 0.85 },
  "DB single-leg Romanian deadlift": { pattern: "hinge", muscle: "hamstrings", unilateral: true, sets: 3, reps: "8–12", baseKg: 12.5, warmup: false, note: "Hamstringy a hýždě, stabilita; kg = 1 jednoručka", fatigue: 0.8 },
  "DB sumo squat": { pattern: "quad", muscle: "quads", unilateral: false, sets: 3, reps: "10–12", baseKg: 20, warmup: false, note: "Široký dřep s jednoručkou; vnitřní stehna a hýždě", fatigue: 0.85 },
  "Leg press high feet": { pattern: "glute_press", muscle: "glutes", unilateral: false, sets: 3, reps: "8–12", baseKg: 120, warmup: true, note: "Hýždě; chodidla vysoko a šířeji na plošině, kg = celková zátěž stroje", fatigue: 1.2 },
  "Abduction machine forward lean": { pattern: "abduction", muscle: "glutes", unilateral: false, sets: 2, reps: "12–20", baseKg: 50, warmup: false, note: "Hýždě; v předklonu na kraji sedáku", fatigue: 0.35 },
  "Glute hyperextension": { pattern: "hip_extension", muscle: "glutes", unilateral: false, sets: 3, reps: "12–15", baseKg: 10, warmup: false, note: "Hýždě; Roman chair s kulatými zády, tlak pánví do opěrky", fatigue: 0.45 },
  "Cable fly": { pattern: "horizontal_push", muscle: "chest", unilateral: false, sets: 3, reps: "10–15", baseKg: 10, warmup: false, note: "Hrudník; rozpažování na kladkách, kg = jedna strana", fatigue: 0.5 },
  "Low-to-high cable fly": { pattern: "horizontal_push", muscle: "chest", unilateral: false, sets: 3, reps: "12–15", baseKg: 7.5, warmup: false, note: "Horní hrudník; kladky dole, tah šikmo nahoru, kg = jedna strana", fatigue: 0.45 },
  "Single-arm cable row": { pattern: "pull", muscle: "back", unilateral: true, sets: 3, reps: "10–12", baseKg: 20, warmup: false, note: "Záda; přítah jednoruč na kladce", fatigue: 0.6 },
  "Close-grip lat pulldown": { pattern: "pull_vertical", muscle: "back", unilateral: false, sets: 3, reps: "8–12", baseKg: 45, warmup: false, note: "Laty; úzký neutrální úchop", fatigue: 0.85 },
  "Wide-grip low row": { pattern: "pull", muscle: "back", unilateral: false, sets: 3, reps: "10–12", baseKg: 35, warmup: false, note: "Horní záda a zadní ramena; široký úchop, lokty do stran", fatigue: 0.8 },
  "Barbell row": { pattern: "pull", muscle: "back", unilateral: false, sets: 3, reps: "6–10", baseKg: 50, warmup: true, note: "Záda; přítah osy v předklonu, kg = celá osa", fatigue: 1.05 },
  "DB lateral raise": { pattern: "lateral_raise", muscle: "side_delts", unilateral: false, sets: 3, reps: "12–15", baseKg: 6, warmup: false, note: "Boční ramena; kg = 1 jednoručka", fatigue: 0.35 },
  "DB Arnold press": { pattern: "push_vertical", muscle: "shoulders", unilateral: false, sets: 3, reps: "8–12", baseKg: 10, warmup: false, note: "Ramena; rotace dlaní, sed na polohovací lavici, kg = 1 jednoručka", fatigue: 0.85 },
  "DB rear delt fly": { pattern: "rear_delt", muscle: "rear_delts", unilateral: false, sets: 3, reps: "12–15", baseKg: 5, warmup: false, note: "Zadní ramena; hrudník opřený o šikmou lavici, kg = 1 jednoručka", fatigue: 0.35 },
  "DB incline curl": { pattern: "biceps", muscle: "biceps", unilateral: false, sets: 3, reps: "10–12", baseKg: 8, warmup: false, note: "Biceps (dlouhá hlava); šikmá lavice, kg = 1 jednoručka", fatigue: 0.45 },
  "Cable rope hammer curl": { pattern: "biceps", muscle: "biceps", unilateral: false, sets: 3, reps: "10–15", baseKg: 15, warmup: false, note: "Biceps a brachialis; lano na kladce", fatigue: 0.45 },
  "Cable triceps kickback": { pattern: "triceps", muscle: "triceps", unilateral: true, sets: 3, reps: "12–15", baseKg: 5, warmup: false, note: "Triceps; jednoruč v předklonu na kladce", fatigue: 0.35 },
  "DB overhead triceps extension": { pattern: "triceps", muscle: "triceps", unilateral: false, sets: 3, reps: "10–12", baseKg: 15, warmup: false, note: "Triceps (dlouhá hlava); jedna jednoručka oběma rukama za hlavou", fatigue: 0.45 },
  "Single-leg calf raise": { pattern: "plantar_flexion", muscle: "calves", unilateral: true, sets: 3, reps: "10–15", baseKg: 10, warmup: false, note: "Lýtka; jednonož s jednoručkou, opora rukou", fatigue: 0.35 },
  "Barbell back squat": { pattern: "quad", muscle: "quads", unilateral: false, sets: 3, reps: "5–8", baseKg: 60, warmup: true, note: "Dřep s osou v kleci; kg = celá osa", fatigue: 1.4 },
  "Barbell front squat": { pattern: "quad", muscle: "quads", unilateral: false, sets: 3, reps: "6–8", baseKg: 45, warmup: true, note: "Čelní dřep s osou v kleci; kg = celá osa", fatigue: 1.3 },
  "Smith machine squat": { pattern: "quad", muscle: "quads", unilateral: false, sets: 3, reps: "8–12", baseKg: 50, warmup: true, note: "Dřep na Smith stroji; kg = kotouče + osa Smithu", fatigue: 1.2 },
  "Smith machine split squat": { pattern: "lunge", muscle: "glutes", unilateral: true, sets: 3, reps: "8–12", baseKg: 30, warmup: false, note: "Hýždě a stehna; bulharský dřep na Smithu, zadní noha na lavici, kg = kotouče + osa", fatigue: 0.95 },
  "Smith machine hip thrust": { pattern: "hip_extension", muscle: "glutes", unilateral: false, sets: 3, reps: "8–12", baseKg: 60, warmup: true, note: "Hýždě; hip thrust pod osou Smithu, záda o lavici, kg = kotouče + osa", fatigue: 1.0 },
  "Smith machine incline press": { pattern: "horizontal_push", muscle: "chest", unilateral: false, sets: 3, reps: "8–12", baseKg: 40, warmup: true, note: "Horní hrudník; šikmá lavice pod Smithem, kg = kotouče + osa", fatigue: 0.95 },
  "Barbell overhead press": { pattern: "push_vertical", muscle: "shoulders", unilateral: false, sets: 3, reps: "5–8", baseKg: 35, warmup: true, note: "Ramena; tlak osy nad hlavu ve stoje z klece, kg = celá osa", fatigue: 1.0 },
  // Forearms, traps and lower back (added 2026-10-05).
  "DB wrist curl": { pattern: "wrist_flexion", muscle: "forearms", unilateral: false, sets: 3, reps: "12–20", baseKg: 8, warmup: false, note: "Předloktí (flexory); předloktí na lavici, dlaně nahoru, kg = 1 jednoručka", fatigue: 0.25 },
  "DB reverse wrist curl": { pattern: "wrist_extension", muscle: "forearms", unilateral: false, sets: 3, reps: "12–20", baseKg: 4, warmup: false, note: "Předloktí (extenzory); předloktí na lavici, dlaně dolů, kg = 1 jednoručka", fatigue: 0.25 },
  "Cable reverse curl": { pattern: "reverse_curl", muscle: "forearms", unilateral: false, sets: 3, reps: "10–15", baseKg: 12.5, warmup: false, note: "Předloktí a brachioradialis; nadhmat na rovné tyči, spodní kladka", fatigue: 0.3 },
  "DB shrug": { pattern: "shrug", muscle: "traps", unilateral: false, sets: 3, reps: "10–15", baseKg: 24, warmup: false, note: "Trapézy; ramena nahoru k uším a výdrž, kg = 1 jednoručka", fatigue: 0.35 },
  "Barbell shrug": { pattern: "shrug", muscle: "traps", unilateral: false, sets: 3, reps: "8–12", baseKg: 60, warmup: false, note: "Trapézy; osa z klece ve výšce stehen, kg = celá osa", fatigue: 0.45 },
  "Smith machine shrug": { pattern: "shrug", muscle: "traps", unilateral: false, sets: 3, reps: "10–15", baseKg: 50, warmup: false, note: "Trapézy; osa Smithu ve výšce stehen, kg = kotouče + osa", fatigue: 0.4 },
  "Cable upright row": { pattern: "upright_row", muscle: "traps", unilateral: false, sets: 3, reps: "10–15", baseKg: 20, warmup: false, note: "Trapézy a boční ramena; tyč na spodní kladce, lokty nejvýš do výšky ramen", fatigue: 0.4 },
  "Barbell good morning": { pattern: "hinge", muscle: "lower_back", unilateral: false, sets: 3, reps: "8–12", baseKg: 30, warmup: true, note: "Spodní záda a hamstringy; osa na zádech z klece, rovná záda, kg = celá osa", fatigue: 0.9 }

};

export const FOCUS_GROUPS = {
  chest: {label:'Hrudník', exercises:['DB bench press','Chest flat press Prime','Barbell bench press','DB incline press','Pec deck','Cable fly','Low-to-high cable fly','Smith machine incline press']},
  upper_back: {label:'Horní záda', exercises:['Low row','Standing rowing machine','One-arm DB row','Single-arm cable row','Wide-grip low row','Barbell row']},
  lats: {label:'Široký sval zádový', exercises:['Lat pulldown','Cable pullover','Close-grip lat pulldown']},
  front_delts: {label:'Přední ramena', exercises:['DB shoulder press','Shoulder press Prime','DB Arnold press','Barbell overhead press']},
  side_delts: {label:'Boční ramena', exercises:['Standing multi flight','Cable lateral raise','DB lateral raise']},
  rear_delts: {label:'Zadní ramena', exercises:['Rear delt pec deck','Cable rear delt fly','Face pull','DB rear delt fly']},
  biceps: {label:'Biceps', exercises:['Cable curl','DB curl','Hammer curl','DB incline curl','Cable rope hammer curl']},
  triceps: {label:'Triceps', exercises:['Cable triceps extension','Cable overhead triceps extension','Cable triceps kickback','DB overhead triceps extension']},
  abs: {label:'Břišní svaly', exercises:['Abs bench crunch','Cable crunch']},
  obliques: {label:'Šikmé břišní svaly', exercises:['Pallof press','Cable woodchop']},
  quads: {label:'Přední stehna', exercises:['Pivot leg press','Pendulum squat','Leg extension Prime','DB Bulgarian split squat','Goblet squat','DB sumo squat','Barbell back squat','Barbell front squat','Smith machine squat']},
  hamstrings: {label:'Zadní stehna', exercises:['Prone leg curl Prime','DB Romanian deadlift','Barbell Romanian deadlift','DB single-leg Romanian deadlift']},
  hips: {label:'Hýždě a kyčle', exercises:['Hip thrust','Abduction machine','Adduction machine','Barbell hip thrust','Leg press high feet','Cable glute kickback','Glute hyperextension','Cable pull-through','Abduction machine forward lean','Cable hip abduction','DB reverse lunge','DB step-up','DB sumo squat','Smith machine hip thrust','Smith machine split squat']},
  calves: {label:'Lýtka', exercises:['Standing calf raise','Single-leg calf raise']},
  forearms: {label:'Předloktí', exercises:['DB wrist curl','DB reverse wrist curl','Cable reverse curl']},
  traps: {label:'Trapézy', exercises:['DB shrug','Barbell shrug','Smith machine shrug','Cable upright row']},
  lower_back: {label:'Spodní záda', exercises:['Roman chair','Barbell good morning']}
};

export function validateFocusMuscles(value){
  if(!Array.isArray(value)||value.length<1||value.length>5)return null;
  const unique=[...new Set(value.map(String))];
  return unique.length===value.length&&unique.every(id=>Object.hasOwn(FOCUS_GROUPS,id))?unique:null;
}

function num(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function dateKey(v) { return String(v || "").slice(0, 10); }
function daysBetween(a, b) {
  const da = new Date(`${dateKey(a)}T12:00:00Z`).getTime();
  const db = new Date(`${dateKey(b)}T12:00:00Z`).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 999;
  return Math.round(Math.abs(da - db) / 86400000);
}
function completedWorkoutDates(history) { return [...new Set((history || []).map(x => dateKey(x.workout_date)).filter(Boolean))].sort((a, b) => b.localeCompare(a)); }
function recoverySignals(context) {
  const recovery = context?.recovery || {};
  let hrv = null, restingHr = null, sleepMin = null;
  for (const [key, value] of Object.entries(recovery)) {
    const k = key.toLowerCase(), arr = Array.isArray(value) ? value : [];
    const latest = [...arr].sort((a, b) => String(b.sampleTime || b.startTime || "").localeCompare(String(a.sampleTime || a.startTime || "")))[0];
    if (!latest) continue;
    const v = num(latest.value ?? latest.minutes ?? latest.durationMinutes); if (v == null) continue;
    if (k.includes("hrv") || k.includes("heart_rate_variability")) hrv = v;
    else if (k.includes("resting") && k.includes("heart")) restingHr = v;
    else if (k.includes("sleep") && (k.includes("duration") || k.includes("minute"))) sleepMin = v;
  }
  return { hrv, restingHr, sleepMin };
}
// Whole-system readiness for loading. The 14-day ride load counts relative to
// the athlete's own CTL when known: a cyclist's normal week is not fatigue.
function recoveryFactor(context) {
  const recentTss = num(context?.cycling?.recentRideTss) || 0, recentHours = num(context?.cycling?.recentRideHours) || 0;
  const recent = context?.cycling?.recentActivities || [], signals = recoverySignals(context);
  const ctl = num(recent.find(a => num(a?.ctl) > 0)?.ctl);
  let factor = 1;
  if (ctl) { const ratio = recentTss / (14 * ctl); if (ratio >= 1.3) factor *= 0.90; else if (ratio >= 1.15) factor *= 0.94; else if (ratio >= 1.05) factor *= 0.97; }
  else if (recentTss >= 900) factor *= 0.90; else if (recentTss >= 750) factor *= 0.94; else if (recentTss >= 600) factor *= 0.97;
  if (recentHours >= 12) factor *= 0.96; else if (recentHours >= 9) factor *= 0.98;
  const intensityCount = recent.slice(0, 4).filter(a => !(a?.date || a?.start) || daysBetween(a.date || a.start, context.date) <= 3).filter(isIntensity).length;
  if (intensityCount >= 3) factor *= 0.94; else if (intensityCount >= 2) factor *= 0.97;
  const next = context?.cycling?.nextRide;
  if (isIntensity(next)) factor *= 0.96; if ((num(next?.durationHours) || 0) >= 2.5) factor *= 0.97;
  if (signals.sleepMin != null) { if (signals.sleepMin < 330) factor *= 0.94; else if (signals.sleepMin < 390) factor *= 0.98; }
  if (signals.hrv != null && signals.hrv < 90) factor *= 0.97;
  if (signals.restingHr != null && signals.restingHr >= 55) factor *= 0.97;
  return clamp(factor, 0.82, 1);
}
// Poor recovery changes the session, not just a rounding of the loads:
// more reps in reserve, a set less per exercise, no load increases and a
// shorter session when the adaptive score is low.
function recoveryState(context) {
  const { sleepMin } = recoverySignals(context), score = num(context?.adaptive?.recovery?.score);
  const lowScore = score != null && score < 55, shortSleep = sleepMin != null && sleepMin < 330, low = lowScore || shortSleep;
  const rirBonus = !low ? 0 : (score != null && score < 40) || (sleepMin != null && sleepMin < 270) ? 2 : 1;
  return { low, lowScore, shortSleep, score, sleepMin, rirBonus, shorten: lowScore ? 0.75 : 1 };
}
function recentMuscleExposure(history, contextDate) {
  const exposure = new Map();
  for (const row of history || []) {
    const def = EXERCISES[normalizeExerciseName(row.exercise)];
    if (!def || String(row.type || "WORK").toUpperCase() !== "WORK") continue;
    if (daysBetween(row.workout_date, contextDate) > 7) continue;
    exposure.set(def.muscle, (exposure.get(def.muscle) || 0) + 1);
  }
  return exposure;
}
function recentMuscleLoad(history, contextDate, maxAge = 14) {
  const load = new Map();
  for (const row of history || []) {
    const def = EXERCISES[normalizeExerciseName(row.exercise)]; if (!def) continue;
    const age = daysBetween(row.workout_date, contextDate); if (age > maxAge) continue;
    const rpe = num(row.rpe), effort = rpe == null ? 0.8 : clamp(rpe / 10, 0.5, 1.1), recency = age <= 3 ? 1 : age <= 7 ? 0.65 : 0.35;
    load.set(def.muscle, (load.get(def.muscle) || 0) + def.fatigue * effort * recency);
  }
  return load;
}
// Completed sets plus the exercises of gym plans on the days around (one row
// each), so a second session in the same week picks different exercises.
function selectionHistory(context) {
  const done = context?.strength?.recentCompletedSets || [];
  const planned = (context?.strength?.plannedSessions || []).flatMap(s => (s.exercises || []).map(exercise => ({ exercise, workout_date: s.date, type: "WORK", rpe: null, set_no: 1, planned: true })));
  return [...done, ...planned];
}
// Exercises per session from its length: about 10 minutes each with warm-ups.
export function exerciseCountFor(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return 5;
  return m <= 35 ? 3 : m <= 50 ? 4 : m <= 65 ? 5 : m <= 80 ? 6 : 7;
}
const LEG_MUSCLES = new Set(["quads", "hamstrings", "glutes", "adductors", "abductors", "calves"]);
const MUSCLE_CZ = { quads: "přední stehna", hamstrings: "zadní stehna", glutes: "hýždě", calves: "lýtka", chest: "hrudník", back: "záda", shoulders: "ramena", side_delts: "boční ramena", rear_delts: "zadní ramena", biceps: "biceps", triceps: "triceps", core: "střed těla", adductors: "adduktory", abductors: "abduktory", forearms: "předloktí", traps: "trapézy", lower_back: "spodní záda" };
// Sex is taken into account, not used to rank muscle groups: the session's
// structure is the same for everyone. It sets the starting loads without
// history and, in a close call between variants of one movement, leans a
// woman's choice towards the glute-biased one.
export function athleteSex(context, options = {}) {
  const sex = options.sex ?? context?.profile?.sex;
  return sex === "female" || sex === "male" ? sex : "";
}
// The catalogue's default loads come from a male athlete's history. Without
// any own or similar exercise history a woman starts lighter; women are
// relatively stronger in the lower body than in the upper body.
export function startingLoadScale(muscle, sex) {
  if (sex !== "female") return 1;
  return LEG_MUSCLES.has(muscle) ? 0.7 : 0.55;
}

// Hard sets per week for an endurance athlete lifting about twice a week:
// legs and trunk carry the sport, the upper body keeps the balance.
export const WEEKLY_SET_TARGETS = { quads: 6, glutes: 6, hamstrings: 6, back: 8, chest: 6, core: 4, shoulders: 3, side_delts: 3, rear_delts: 3, biceps: 3, triceps: 3, calves: 3 };
// A multi-joint lift also trains its synergists; they count as part sets.
const SYNERGISTS = { chest: { triceps: .5, shoulders: .5 }, shoulders: { triceps: .5, side_delts: .3 }, back: { biceps: .5, rear_delts: .5 }, quads: { glutes: .5 }, hamstrings: { glutes: .5 }, glutes: { hamstrings: .3, quads: .3 }, lower_back: { hamstrings: .5, glutes: .3 } };
// Movement slots; the first exercise of a list is the pattern's main one.
const SLOTS = {
  knee: { muscles: ["quads"], ex: ["Pivot leg press", "Pendulum squat", "Barbell back squat", "Smith machine squat", "Barbell front squat", "Goblet squat", "DB sumo squat"], fallback: "legExtension" },
  hip: { muscles: ["hamstrings", "glutes"], ex: ["DB Romanian deadlift", "Barbell Romanian deadlift", "Hip thrust", "Barbell hip thrust", "Cable pull-through", "DB single-leg Romanian deadlift"], fallback: "legCurl" },
  unilateral: { muscles: ["quads", "glutes"], ex: ["DB Bulgarian split squat", "DB reverse lunge", "DB step-up", "Smith machine split squat"] },
  glute: { muscles: ["glutes"], ex: ["Hip thrust", "Barbell hip thrust", "Smith machine hip thrust", "Leg press high feet", "Glute hyperextension", "Cable glute kickback"] },
  legCurl: { muscles: ["hamstrings"], ex: ["Prone leg curl Prime"] },
  legExtension: { muscles: ["quads"], ex: ["Leg extension Prime"] },
  hpush: { muscles: ["chest"], ex: ["DB bench press", "Chest flat press Prime", "Barbell bench press", "DB incline press", "Smith machine incline press"], fallback: "chestFly" },
  chestFly: { muscles: ["chest"], ex: ["Pec deck", "Cable fly", "Low-to-high cable fly"] },
  hpull: { muscles: ["back"], ex: ["Low row", "Standing rowing machine", "One-arm DB row", "Single-arm cable row", "Wide-grip low row", "Barbell row"] },
  vpush: { muscles: ["shoulders"], ex: ["DB shoulder press", "Shoulder press Prime", "DB Arnold press", "Barbell overhead press"] },
  vpull: { muscles: ["back"], ex: ["Lat pulldown", "Close-grip lat pulldown", "Cable pullover"] },
  lateral: { muscles: ["side_delts"], ex: ["Cable lateral raise", "Standing multi flight", "DB lateral raise"] },
  rear: { muscles: ["rear_delts"], ex: ["Rear delt pec deck", "Cable rear delt fly", "Face pull", "DB rear delt fly"] },
  biceps: { muscles: ["biceps"], ex: ["DB curl", "Hammer curl", "Cable curl", "DB incline curl", "Cable rope hammer curl"] },
  triceps: { muscles: ["triceps"], ex: ["Cable triceps extension", "Cable overhead triceps extension", "Cable triceps kickback", "DB overhead triceps extension"] },
  core: { muscles: ["core"], ex: ["Abs bench crunch", "Cable crunch", "Pallof press", "Cable woodchop", "Roman chair"] },
  calves: { muscles: ["calves"], ex: ["Standing calf raise", "Single-leg calf raise"] }
};
const COMPOUND_SLOTS = new Set(["knee", "hip", "unilateral", "glute", "hpush", "hpull", "vpush", "vpull"]);
// Every full-body session keeps one knee- and one hip-dominant movement and a
// push and a pull; the rest fills the biggest weekly deficits.
const MODES = {
  full: { required: [["knee"], ["hip"], ["hpush", "vpush"], ["hpull", "vpull"]], fill: ["hpush", "vpush", "hpull", "vpull", "unilateral", "glute", "legCurl", "legExtension", "core", "rear", "lateral", "biceps", "triceps", "calves", "chestFly"] },
  upper: { required: [["hpush"], ["hpull"], ["vpush"], ["vpull"]], fill: ["rear", "lateral", "biceps", "triceps", "core", "chestFly"] },
  lower: { required: [["knee"], ["hip"]], fill: ["unilateral", "glute", "legCurl", "legExtension", "calves", "core"], weights: { core: .5 } }
};
const isCompound = name => isCompoundDef(EXERCISES[name]);
const region = def => LEG_MUSCLES.has(def.muscle) || def.muscle === "lower_back" ? "legs" : ["back", "biceps", "rear_delts", "traps"].includes(def.muscle) ? "pull" : "push";

// Sets per muscle this week: completed in the last 6 days plus gym sessions
// already planned ahead; compounds credit their synergists.
function weeklyLedger(context) {
  const sets = {};
  const add = (name, n) => {
    const def = EXERCISES[normalizeExerciseName(name)]; if (!def) return;
    sets[def.muscle] = (sets[def.muscle] || 0) + n;
    if (isCompoundDef(def)) for (const [m, f] of Object.entries(SYNERGISTS[def.muscle] || {})) sets[m] = (sets[m] || 0) + n * f;
  };
  for (const row of context?.strength?.recentCompletedSets || []) {
    if (String(row.type || "WORK").toUpperCase() !== "WORK" || row.completed === 0 || row.completed === false) continue;
    const age = (Date.parse(dateKey(context.date) + "T12:00:00Z") - Date.parse(dateKey(row.workout_date) + "T12:00:00Z")) / 86400000;
    if (age >= 0 && age <= 6) add(row.exercise, 1);
  }
  for (const s of context?.strength?.plannedSessions || []) if (dateKey(s.date) > dateKey(context.date) && daysBetween(s.date, context.date) <= 6) for (const ex of s.exercises || []) add(ex, Number(EXERCISES[normalizeExerciseName(ex)]?.sets) || 3);
  return { sets, add };
}

function choosePlan(context, options = {}, env = {}) {
  const history = selectionHistory(context);
  const muscleLoad = recentMuscleLoad(history, context.date);
  const muscleExposure = recentMuscleExposure(history, context.date);
  const dates = completedWorkoutDates(context?.strength?.recentCompletedSets || []);
  const recentWorkoutCount = dates.filter(d => daysBetween(d, context.date) <= 10).length;
  const legReason = ["quads", "hamstrings", "glutes"].map(m => env.acute.get(m)).find(Boolean);
  const weekUpper = options.focusSource === 'week' && options.focus === 'upper';
  const protectLegs = Boolean(legReason) || weekUpper;

  const lastExerciseDate = new Map();
  for (const row of history) {
    const d = dateKey(row.workout_date), exercise = normalizeExerciseName(row.exercise);
    if (d && exercise && (!lastExerciseDate.has(exercise) || daysBetween(d, context.date) < daysBetween(lastExerciseDate.get(exercise), context.date))) lastExerciseDate.set(exercise, d);
  }
  // Only a close call between variants: recency and muscle load still decide.
  const female = athleteSex(context, options) === "female";
  const emphasis = female ? { glutes: -0.2, abductors: -0.1 } : {};
  const sexNote = female ? " Výchozí váhy bez historie a výběr variant cviků zohledňují profil (žena)." : "";
  // Preferences, not filters: an exercise done or planned within 4 days and a
  // muscle trained this week count against it. Ties go to the main exercise.
  const usedPatterns = new Set();
  // A lift with its own recent history is preferred over an untried variant:
  // repeating it about weekly is what lets the load progress.
  const known = new Set((context?.strength?.recentCompletedSets || []).filter(r => daysBetween(r.workout_date, context.date) <= 21).map(r => normalizeExerciseName(r.exercise)));
  const score = (ex, rank = 0) => {
    const def = EXERCISES[ex], last = lastExerciseDate.get(ex);
    const recent = last && daysBetween(last, context.date) <= 4 ? 3 : 0;
    return recent + (muscleExposure.get(def?.muscle) || 0) * 0.3 + (muscleLoad.get(def?.muscle) || 0) * 0.2 + rank * 0.05 + (emphasis[def?.muscle] || 0) + (known.has(ex) && !recent ? -0.4 : 0);
  };

  const forceUpper = options.forceProtectLegs === true || options.focus === "upper" && options.focusSource !== 'week';
  const forceLower = options.focus === "lower";
  const mode = forceUpper || (env.recovery.low && !forceLower) ? "upper" : forceLower ? "lower" : "full";

  // An exercise done in the last two days is left out; so is compound work
  // for a muscle taken to RPE ≥ 9 within ~48 h.
  const used = new Set((options.excludeExercises || []).map(normalizeExerciseName));
  const recentDone = new Set();
  for (const row of context?.strength?.recentCompletedSets || []) {
    const ex = normalizeExerciseName(row.exercise);
    if (ex && daysBetween(row.workout_date, context.date) <= 2) recentDone.add(ex);
  }
  const ledger = weeklyLedger(context), before = { ...ledger.sets };
  const deficit = m => Math.max(0, (WEEKLY_SET_TARGETS[m] || 0) - (ledger.sets[m] || 0));
  const coverage = strengthCoverage(context, EXERCISES).lastStrengthDateByMuscle;
  // Untouched for two weeks: it moves up the queue so nothing is left out for long.
  const value = (slot, weights = {}) => Math.max(...SLOTS[slot].muscles.map(m => (deficit(m) + (WEEKLY_SET_TARGETS[m] && !coverage[m] ? 1.5 : 0)) * (env.blocked.has(m) ? .3 : 1))) * (weights[slot] ?? (COMPOUND_SLOTS.has(slot) ? 1 : .8));

  function build(skipRecent) {
    const taken = new Set(used); if (skipRecent) for (const ex of recentDone) taken.add(ex);
    usedPatterns.clear();
    const chosen = [], slotsUsed = new Set(), { required, fill, weights = {} } = MODES[mode];
    const pick = slot => {
      const def = SLOTS[slot]; if (!def) return null;
      let pool = def.ex.map((ex, rank) => ({ ex, rank })).filter(({ ex }) => EXERCISES[ex] && availableAt(ex) && !taken.has(ex) && !(isCompound(ex) && env.blocked.has(EXERCISES[ex].muscle)));
      // One movement per session: a second hip thrust variant is not variety.
      const fresh = pool.filter(({ ex }) => !usedPatterns.has(EXERCISE_INTELLIGENCE[ex]?.pattern));
      pool = fresh.length ? fresh : pool;
      const ex = pool.sort((a, b) => score(a.ex, a.rank) - score(b.ex, b.rank))[0]?.ex;
      // Isolation is no substitute for a main lift that waits after an RPE ≥ 9 day.
      if (!ex) return def.fallback && !slotsUsed.has(def.fallback) && !def.muscles.every(m => env.blocked.has(m)) ? (slotsUsed.add(def.fallback), pick(def.fallback)) : null;
      taken.add(ex); usedPatterns.add(EXERCISE_INTELLIGENCE[ex]?.pattern); slotsUsed.add(slot);
      ledger.add(ex, Number(EXERCISES[ex].sets) || 3);
      chosen.push(ex); return ex;
    };
    // Required slots in order; between alternatives the bigger deficit wins.
    const groups = required.map(alts => [...alts].sort((a, b) => value(b, weights) - value(a, weights)));
    const ordered = mode === "full" ? [...groups.slice(0, 2), ...groups.slice(2).sort((a, b) => value(b[0], weights) - value(a[0], weights))] : groups;
    for (const alts of ordered) { if (chosen.length >= env.count) break; for (const slot of alts) if (pick(slot)) break; }
    while (chosen.length < env.count) {
      const next = fill.filter(s => !slotsUsed.has(s)).map(s => ({ s, v: value(s, weights) })).sort((a, b) => b.v - a.v);
      let added = false;
      for (const { s } of next) { slotsUsed.add(s); if (pick(s)) { added = true; break; } }
      if (!added) break;
    }
    return chosen;
  }
  let exercises = build(true), reused = false;
  // Everything recent: rather the best exercises again than an empty plan.
  if (!exercises.length) { exercises = build(false); reused = exercises.length > 0; }
  if (!exercises.length && !env.focus) throw new Error("Pro dnešní trénink nezbyl žádný vhodný cvik – všechny dostupné cviky jsou vyloučené nebo dnes nevhodné. Zkus jinou skladbu tréninku.");
  // Main lifts first while fresh, then isolation, each by fatigue.
  exercises = exercises.map((ex, i) => ({ ex, i })).sort((a, b) => Number(isCompound(b.ex)) - Number(isCompound(a.ex)) || EXERCISES[b.ex].fatigue - EXERCISES[a.ex].fatigue || a.i - b.i).map(x => x.ex);

  const base = { muscleExposure: Object.fromEntries(muscleExposure), recentWorkoutCount, muscleLoad, plannedSessions: context?.strength?.plannedSessions || [], ledgerBefore: before, reused };
  if (mode === "upper") return { ...base, name: "Upper Body", exercises, protectedLegs: true, mode,
    rationale: (forceUpper ? "Požadavek uživatele chrání nohy a soustředí trénink na horní část těla; tlak a tah vodorovně i svisle, zbytek doplňuje svaly s největším týdenním deficitem sérií." : "Kvůli slabé regeneraci dnes bez nohou, jen horní část těla.") + sexNote };
  if (mode === "lower") return { ...base, name: "Lower Body", exercises, protectedLegs: false, mode,
    rationale: "Požadavek uživatele soustředí trénink na dolní část těla: jeden cvik na koleno a jeden na kyčel, pak doplňky podle týdenního deficitu sérií." + (legReason ? " Nohy mají dnes rezervu (" + legReason + ")." : "") + sexNote };
  return { ...base, name: protectLegs ? "Full Body · s rezervou" : "Full Body", exercises, protectedLegs: protectLegs, mode, legReason,
    rationale: (protectLegs ? "Vyvážený silový trénink zahrnuje i nohy, ale s rezervou" + (legReason ? " (" + legReason + ")" : " (týdenní plán šetří nohy)") + ": o sérii méně a cíl RPE 7 (3 opakování v rezervě)." : env.blocked.size ? "Vyvážený silový trénink; skladba doplňuje svaly s největším týdenním deficitem sérií." : "Vyvážený silový trénink: jeden cvik na koleno, jeden na kyčel, tlak a tah; zbytek doplňuje svaly s největším týdenním deficitem sérií.") + sexNote };
}

// Three ramp-up sets before the first main lift; a later main lift for
// another body region gets one. Warm-up loads round down and never repeat.
export function warmupRows(exercise, workKg = null, first = true) {
  const def = EXERCISES[exercise]; if (!def?.warmup) return [];
  const reference = num(workKg) ?? def.baseKg; if (reference == null) return [];
  const execution = def.unilateral ? "UNILATERAL" : DEFAULT_EXECUTION, fmt = x => String(x).replace(".", ",");
  const rows = [], seen = new Set();
  for (const [pct, reps] of first ? [[.4, 8], [.65, 5], [.8, 3]] : [[.65, 5]]) {
    const kg = resolveLoad(exercise, reference * pct, "down");
    if (kg == null || kg >= reference || seen.has(kg)) continue;
    seen.add(kg);
    rows.push(["WARMUP", exercise, String(rows.length + 1), fmt(kg), String(reps), "", "", "", "FALSE", "[WARMUP]", rows.length ? "" : "🎥 Video", "", execution]);
  }
  return rows;
}
function assemble(entries) {
  const rows = [], warmed = new Set(); let first = true;
  for (const e of entries) {
    if (!e.work.length) continue;
    const def = EXERCISES[e.exercise], part = region(def);
    if (def.warmup && !warmed.has(part)) { const w = warmupRows(e.exercise, e.kg, first); if (w.length) first = false; warmed.add(part); rows.push(...w); }
    rows.push(...e.work);
  }
  return rows;
}

// Deload: every 6 weeks of training without a break, after 4 weeks when two
// main lifts stall, or when the week plan marks a recovery week.
function deloadState(context, options, history) {
  if (options.recoveryWeek === true || context?.recoveryWeek === true) return { active: true, reason: "regenerační týden v plánu" };
  const dates = completedWorkoutDates(history);
  if (!dates.length || daysBetween(dates[0], context.date) >= 8) return { active: false, weeks: 0, stalled: [] };
  const tagged = new Set(history.filter(r => /\[Deload\]/.test(String(r.note || ""))).map(r => dateKey(r.workout_date)));
  // The deload lasts one week from its first session.
  let first = 0; while (tagged.has(dates[first]) && tagged.has(dates[first + 1])) first++;
  if (tagged.has(dates[0]) && daysBetween(dates[first], context.date) <= 6) return { active: true, reason: "pokračuje odlehčovací týden" };
  let start = dates.at(-1);
  for (let i = 0; i < dates.length; i++) { if (tagged.has(dates[i]) || (dates[i + 1] && daysBetween(dates[i], dates[i + 1]) >= 8)) { start = dates[i]; break; } }
  const weeks = daysBetween(start, context.date) / 7;
  const byExercise = new Map();
  for (const r of history) { const ex = normalizeExerciseName(r.exercise); if (EXERCISES[ex] && isCompound(ex)) byExercise.set(ex, [...(byExercise.get(ex) || []), r]); }
  const stalled = [...byExercise].filter(([, rows]) => { const s = strengthSessions(rows); return s.length && daysBetween(s[0].date, context.date) <= 21 && stallCount(s) >= 2; }).map(([ex]) => ex);
  if (weeks >= 6) return { active: true, reason: Math.floor(weeks) + " týdnů tréninku bez odlehčení", weeks, stalled };
  if (weeks >= 4 && stalled.length >= 2) return { active: true, reason: "stagnace u " + stalled.slice(0, 3).join(", "), weeks, stalled };
  return { active: false, weeks, stalled };
}
// Compound work for a muscle taken to RPE ≥ 9 within ~48 h waits (a planned
// failure set on an isolation exercise does not count).
function blockedMuscles(context) {
  const out = new Map();
  for (const r of context?.strength?.recentCompletedSets || []) {
    const def = EXERCISES[normalizeExerciseName(r.exercise)], rpe = num(r.rpe);
    if (!def || rpe == null || rpe < 9 || daysBetween(r.workout_date, context.date) > 1 || dateKey(r.workout_date) > dateKey(context.date)) continue;
    if (r.toFailure === true || /\[Do selhání\]/.test(String(r.note || "")) || !isCompoundDef(def)) continue;
    out.set(def.muscle, dateKey(r.workout_date));
  }
  return out;
}

// Focused muscle groups: the session length sets the exercise count, spread
// round-robin over the groups (at most three each): a main lift first, then
// isolation of another pattern.
function focusExercises(context, focusMuscles, count, { excluded, protectedLegs, blocked }) {
  const selection = selectionHistory(context), weeklyExposure = recentMuscleExposure(selection, context.date), weeklyLoad = recentMuscleLoad(selection, context.date);
  const lastExerciseDate = new Map();
  for (const row of selection) {
    const exercise = normalizeExerciseName(row.exercise), date = dateKey(row.workout_date);
    if (exercise && date && (!lastExerciseDate.has(exercise) || daysBetween(date, context.date) < daysBetween(lastExerciseDate.get(exercise), context.date))) lastExerciseDate.set(exercise, date);
  }
  const taken = new Set(), byGroup = new Map(focusMuscles.map(g => [g, []])), out = [];
  const best = (group, round) => {
    const patterns = new Set(byGroup.get(group).map(ex => EXERCISE_INTELLIGENCE[ex]?.pattern));
    const candidates = FOCUS_GROUPS[group].exercises.filter(name => EXERCISES[name] && availableAt(name) && !excluded.has(name) && !taken.has(name) && !(isCompound(name) && blocked.has(EXERCISES[name].muscle)));
    const score = name => {
      const def = EXERCISES[name], last = lastExerciseDate.get(name), compound = isCompound(name);
      const recent = last && daysBetween(last, context.date) < 5 ? 2 : 0;
      const legPenalty = protectedLegs && ['quads', 'hamstrings', 'hips', 'calves'].includes(group) ? def.fatigue * 2 : 0;
      // Another pattern of the group first (arms have only one).
      return (round === 0 ? (compound ? 0 : 1) : (compound ? .6 : 0)) + (patterns.has(EXERCISE_INTELLIGENCE[name]?.pattern) ? 1.5 : 0) + recent + (weeklyExposure.get(def.muscle) || 0) * .3 + (weeklyLoad.get(def.muscle) || 0) * .2 + legPenalty;
    };
    return candidates.sort((a, b) => score(a) - score(b))[0];
  };
  for (let round = 0; round < 3 && out.length < count; round++) {
    for (const group of focusMuscles) {
      if (out.length >= count) break;
      const ex = best(group, round);
      if (!ex) { if (!round) throw new Error('Pro partii ' + FOCUS_GROUPS[group].label + ' není dostupný cvik.'); continue; }
      taken.add(ex); byGroup.get(group).push(ex); out.push(ex);
    }
  }
  const groupOf = new Map([...byGroup].flatMap(([g, list]) => list.map(ex => [ex, g])));
  return { exercises: out.map((ex, i) => ({ ex, i })).sort((a, b) => Number(isCompound(b.ex)) - Number(isCompound(a.ex)) || a.i - b.i).map(x => x.ex), groupOf };
}

function setCount(exercise, { muscleLoad, reduced, recovery, deload, volumeModifier, bonus }) {
  const def = EXERCISES[exercise], base = Number(def?.sets) || 3, recentLoad = Number(muscleLoad?.get(def?.muscle) || 0);
  let sets = base;
  if (recentLoad >= 4 || (recentLoad >= 2.5 && base >= 3)) sets -= 1;
  if (reduced) sets -= 1;
  if (recovery.low) sets -= 1;
  if (bonus) sets += 1;
  sets = Math.round(sets * clamp(volumeModifier, 0.6, 1.05));
  if (deload) sets = Math.round(sets * 0.6);
  return clamp(sets, deload || recovery.low ? 1 : 2, 4);
}

export function generateStrengthPlan(context, options = {}) {
  const policy = trainingStatus(context?.athleteState);
  // The gateway explicitly marks its read-only deployment diagnostic; ordinary
  // gym requests and previews still obey the athlete's status.
  if (policy.paused && !options.diagnosticPreview) throw new Error(policy.headline + '. ' + policy.guidance[0]);
  const focusMuscles = options.focusMuscles == null ? null : validateFocusMuscles(options.focusMuscles);
  if (options.focusMuscles != null && !focusMuscles) throw new Error('Vyber 1 až 5 známých partií.');
  const factor = recoveryFactor(context), history = context?.strength?.recentCompletedSets || [], sex = athleteSex(context, options);
  const recovery = recoveryState(context), deload = deloadState(context, options, history), blocked = blockedMuscles(context), acute = acuteSportStress(context);
  const requestedMinutes = Number(options.durationMinutes) > 0 ? Number(options.durationMinutes) : Math.max(60, (Number(options.maxExercises) || 5) * 12);
  const budgetMinutes = Math.max(20, Math.round(requestedMinutes * recovery.shorten));
  const count = Number(options.maxExercises) || exerciseCountFor(budgetMinutes);
  const excluded = new Set((options.excludeExercises || []).map(normalizeExerciseName));
  const chosen = choosePlan(context, options, { acute, recovery, blocked, count, focus: Boolean(focusMuscles) });
  let exercises = chosen.exercises, groupOf = new Map();
  if (focusMuscles) ({ exercises, groupOf } = focusExercises(context, focusMuscles, Math.min(focusMuscles.length * 3, Math.max(focusMuscles.length, count)), { excluded, protectedLegs: chosen.protectedLegs, blocked }));

  // Sets drop only for a muscle still loaded from the last ~48 h; weekly
  // volume is the ledger's job.
  const muscleLoad = recentMuscleLoad(history, context.date, 2), sportLoad = sportMuscleLoad(context);
  for (const [muscle, dose] of sportLoad) muscleLoad.set(muscle, (muscleLoad.get(muscle) || 0) + dose * 1.5);
  // The adaptive volume modifier and a low-recovery set cut answer the same
  // signal; apply only one of them.
  const volumeModifier = recovery.low ? 1 : Number(context?.adaptive?.strengthVolumeModifier) || 1;
  const targetRir = new Map(), entries = [], loadEstimates = [];
  for (const exercise of exercises) {
    const def = EXERCISES[exercise], muscle = def.muscle, compound = isCompound(exercise);
    const reduced = Boolean(chosen.protectedLegs && LEG_MUSCLES.has(muscle) || acute.has(muscle));
    // Reps and reserve are decided first; the load follows from them.
    const reps = reduced && (muscle === "quads" || muscle === "hamstrings") ? "8–12" : def.reps;
    let rir = deload.active ? 4 : reduced ? 3 : defaultRir(def);
    // A reduced leg dose already is the answer to the sport load; poor sleep or
    // a low score still add reserve on top.
    if (!deload.active) rir = Math.min(4, rir + Math.min(2, recovery.rirBonus + (factor < 0.9 && !reduced ? 1 : 0)));
    const estimate = estimateStartingLoad({ exercise, history, targetReps: reps, fallbackKg: def.baseKg == null ? null : def.baseKg * startingLoadScale(muscle, sex), loadFactor: reduced ? factor * 0.9 : factor, targetRir: rir, hold: recovery.low, deload: deload.active, convert: reduced });
    if (estimate.trial && !deload.active) rir = Math.max(rir, 3);
    targetRir.set(exercise, rir);
    const deficit = (WEEKLY_SET_TARGETS[muscle] || 0) - (chosen.ledgerBefore[muscle] || 0);
    const sets = setCount(exercise, { muscleLoad, reduced, recovery, deload: deload.active, volumeModifier, bonus: compound && requestedMinutes >= 75 && deficit >= 5 && !reduced && !recovery.low && factor >= 0.95 });
    const note = def.note + (estimate.note ? "; " + estimate.note : "") + (reduced ? "; sportovní zátěž (" + (acute.get(muscle) || "týdenní plán šetří nohy") + "): méně sérií, víc rezervy" : "") + (deload.active ? " [Deload]" : estimate.action === "reset" ? " [Reset]" : "");
    const kg = estimate.kg, execution = def.unilateral ? "UNILATERAL" : DEFAULT_EXECUTION, work = [];
    for (let i = 0; i < sets; i++) work.push(["WORK", exercise, String(i + 1), kg == null ? "" : String(kg).replace(".", ","), reps, "", "", "", "FALSE", note, i === 0 ? "🎥 Video" : "", "", execution]);
    entries.push({ exercise, kg, work, compound });
    loadEstimates.push({ exercise, sets, reducedDose: reduced, targetRir: rir, ...estimate });
  }

  // Fit the session to the time: extra sets, then isolation sets and whole
  // isolation exercises, before any main lift goes below three sets.
  const configure = rows => configureStrengthCoaching(rows, EXERCISES, { factor, muscleLoad, protectedLegs: chosen.protectedLegs, recoveryScore: recovery.score, targetRir, allowFailure: !deload.active && !recovery.low });
  const keep = new Set(focusMuscles ? [] : [entries.find(e => ["knee", "unilateral"].some(s => SLOTS[s].ex.includes(e.exercise)))?.exercise, entries.find(e => ["hip", "glute"].some(s => SLOTS[s].ex.includes(e.exercise)))?.exercise].filter(Boolean));
  const removable = e => entries.filter(x => x.work.length).length > 1 && (!focusMuscles || entries.some(x => x !== e && x.work.length && groupOf.get(x.exercise) === groupOf.get(e.exercise)));
  const live = () => entries.filter(e => e.work.length).reverse(), dropped = [];
  const steps = [
    () => live().find(e => e.work.length > 3),
    () => live().find(e => !e.compound && e.work.length > 2),
    () => { const e = live().find(x => !x.compound && removable(x)); if (e) { e.work = []; dropped.push(e.exercise); } return e ? null : undefined; },
    () => live().find(e => e.compound && e.work.length > 2),
    () => { const e = live().find(x => x.compound && !keep.has(x.exercise) && removable(x)); if (e) { e.work = []; dropped.push(e.exercise); } return e ? null : undefined; },
    () => live().find(e => e.work.length > 1)
  ];
  let rows = configure(assemble(entries)), timing = estimateStrengthTiming(rows, EXERCISES, requestedMinutes);
  while (timing.totalSeconds > budgetMinutes * 60) {
    let changed = false;
    for (const step of steps) { const e = step(); if (e === null) { changed = true; break; } if (e) { e.work.pop(); changed = true; break; } }
    if (!changed) throw new Error('Zvolené partie se s rozcvičením a pauzami nevejdou do ' + budgetMinutes + ' minut. Vyber méně partií nebo delší čas.');
    rows = configure(assemble(entries)); timing = estimateStrengthTiming(rows, EXERCISES, requestedMinutes);
  }
  for (let i = loadEstimates.length - 1; i >= 0; i--) {
    loadEstimates[i].sets = rows.filter(r => r[0] === 'WORK' && r[1] === loadEstimates[i].exercise).length;
    if (!loadEstimates[i].sets) loadEstimates.splice(i, 1);
  }
  if (!rows.some(r => r[0] === 'WORK')) throw new Error("Pro dnešní trénink nezbyl žádný vhodný cvik. Zkus jinou skladbu tréninku nebo delší čas.");

  // The rationale says what actually changed today.
  const said = [];
  const focusLabels = focusMuscles?.map(id => FOCUS_GROUPS[id].label).join(', ');
  const legCaution = chosen.protectedLegs && focusMuscles?.some(id => ['quads', 'hamstrings', 'hips', 'calves'].includes(id));
  said.push(focusMuscles ? 'Zvolené partie: ' + focusLabels + '. Na každou partii nejdřív hlavní cvik, potom izolace jiného pohybu; zohledněno nedávné posilování, regenerace a cyklistická zátěž.' + (legCaution ? ' Kvůli cyklistické zátěži je potřeba držet rezervu u nohou.' : '') : chosen.rationale);
  if (chosen.reused) said.push("Všechny vhodné cviky byly v posledních 2 dnech, proto se opakují.");
  if (blocked.size) said.push("Po tréninku s RPE ≥ 9 za posledních 48 h dnes bez vícekloubových cviků na " + [...blocked.keys()].map(m => MUSCLE_CZ[m] || m).join(", ") + ".");
  if (recovery.low) said.push("Úpravy kvůli regeneraci (" + [recovery.score != null && recovery.lowScore ? "skóre " + recovery.score : "", recovery.shortSleep ? "spánek " + (Math.round(recovery.sleepMin / 6) / 10).toString().replace(".", ",") + " h" : ""].filter(Boolean).join(", ") + "): o sérii méně na cvik, o " + recovery.rirBonus + " opakování víc v rezervě, bez zvyšování vah" + (recovery.shorten < 1 ? " a trénink zkrácený na " + budgetMinutes + " min" : "") + ".");
  if (deload.active) said.push("Odlehčovací týden (" + deload.reason + "): o 40 % méně sérií, cíl RPE 6 a váhy asi o 10 % nižší; bez série do selhání.");
  const kept = loadEstimates;
  const up = kept.filter(e => e.action === "increase" || e.action === "increase2").map(e => e.exercise + " " + String(e.kg).replace(".", ",") + " kg");
  const resets = kept.filter(e => e.action === "reset").map(e => e.exercise);
  const trials = kept.filter(e => e.trial).map(e => e.exercise);
  if (up.length) said.push("Progrese: " + up.join(", ") + ".");
  if (resets.length) said.push("Stagnace 2 tréninky: " + resets.join(", ") + " – lehčí restart a znovu nahoru.");
  if (trials.length) said.push("Zkušební váhy (zatím bez vlastní historie): " + trials.join(", ") + " – najdi RPE 7, příště se váha upraví podle výkonu.");
  if (sportLoad.size) said.push('Zátěž z ostatních sportů upravuje dávku zapojených svalů; nenahrazuje jejich silový trénink.');
  const fmtDay = d => new Date(d + 'T12:00:00Z').toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
  const nearby = (chosen.plannedSessions || []).map(x => fmtDay(x.date).replace(/\.$/, ''));
  if (nearby.length) said.push('Cviky se liší od plánu na ' + nearby.join(' a ') + '.');
  said.push('Časový plán: odhad ' + timing.estimatedMinutes + ' min z ' + requestedMinutes + ' min včetně rozcvičení, pauz a přechodů mezi stroji' + (budgetMinutes < requestedMinutes ? ' (kvůli regeneraci plán na ' + budgetMinutes + ' min)' : '') + '.' + (dropped.length ? ' Kvůli času vypadlo: ' + dropped.join(', ') + '.' : ''));
  const ledgerAfter = weeklyLedger({ ...context, strength: { ...context?.strength, plannedSessions: [] } });
  for (const r of rows) if (r[0] === 'WORK') ledgerAfter.add(r[1], 1);
  for (const s of context?.strength?.plannedSessions || []) if (dateKey(s.date) > dateKey(context.date) && daysBetween(s.date, context.date) <= 6) for (const ex of s.exercises || []) ledgerAfter.add(ex, Number(EXERCISES[normalizeExerciseName(ex)]?.sets) || 3);
  const round1 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  return {
    date: context.date, planName: focusMuscles ? 'Cílený trénink · ' + focusLabels : deload.active ? chosen.name + ' · odlehčení' : chosen.name,
    rationale: said.filter(Boolean).join(' '), timing, focusMuscles: focusMuscles || [], loadFactor: factor, protectedLegs: chosen.protectedLegs,
    recentCompletedSets: history.length, recentCompletedWorkoutCount: chosen.recentWorkoutCount,
    balance: { sportMuscleLoad: Object.fromEntries(sportLoad), acuteSportStress: Object.fromEntries(acute), strengthCoverage: strengthCoverage(context, EXERCISES), weeklySets: { target: WEEKLY_SET_TARGETS, before: round1(chosen.ledgerBefore), withThisSession: round1(ledgerAfter.sets) } },
    adaptive: { volumeModifier, recoveryScore: recovery.score, legReadiness: context?.adaptive?.legReadiness ?? null, lowRecovery: recovery.low, budgetMinutes },
    deload: { active: deload.active, reason: deload.reason || null, weeksSinceDeload: deload.weeks == null ? null : Math.round(deload.weeks * 10) / 10, stalledLifts: deload.stalled || [] },
    loadEstimates, rows
  };
}

export { EXERCISES };
