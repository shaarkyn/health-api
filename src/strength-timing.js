// Include both sides of unilateral work, equipment setup, rests and a small
// buffer. Gym pace: ~3 s per rep plus getting into position; no rest after an
// exercise's final set (moving on is in the per-exercise setup time).
export function estimateStrengthTiming(rows, catalog, requestedMinutes = 60) {
  let workSeconds = 0, warmupSeconds = 0, restSeconds = 0;
  const exercises = [...new Set(rows.map(r => r[1]))], groups = new Map(), rounds = new Map();
  rows.forEach((r, i) => {
    const def = catalog[r[1]] || {}, warm = r[0] === 'WARMUP';
    const reps = Math.max(...(String(r[4]).match(/\d+/g) || ['12']).map(Number));
    const seconds = reps * 3 * (def.unilateral ? 2 : 1) + 10;
    if (warm) warmupSeconds += seconds; else workSeconds += seconds;
    const rest = Number(String(r[9] || '').match(/\[Pauza (\d+) s\]/)?.[1]) || (warm ? 40 : 90);
    if (r[12] && !warm) { const key = r[12] + ':' + r[2]; groups.set(key, Math.max(groups.get(key) || 0, rest)); rounds.set(r[12], Math.max(rounds.get(r[12]) || 0, Number(r[2]) || 0)); }
    else if (rows.slice(i + 1).some(x => x[1] === r[1])) restSeconds += rest;
  });
  // A superset rests once per round, and not after its last round.
  for (const [key, rest] of groups) { const [id, round] = key.split(':'); if (Number(round) < rounds.get(id)) restSeconds += rest; }
  const setupSeconds = 120 + exercises.length * 75;
  const bufferSeconds = Math.max(120, Math.round(requestedMinutes * 60 * .05));
  const totalSeconds = workSeconds + warmupSeconds + restSeconds + setupSeconds + bufferSeconds;
  return { requestedMinutes, estimatedMinutes: Math.ceil(totalSeconds / 60), totalSeconds, workSeconds, warmupSeconds, restSeconds, setupSeconds, bufferSeconds };
}

// Multi-joint lifts stop two reps short, isolation one rep; the coach adds
// reserve for fatigue, a deload or a first (trial) load.
const ISOLATION = /^(?:hamstring|biceps|triceps|core|lateral_raise|rear_delt|horizontal_push|plantar_flexion|abduction|adduction|wrist_|reverse_curl|shrug|upright_row|glute_kickback)/;
export const isCompoundDef = def => Boolean(def?.warmup || (def?.fatigue >= .8 && !ISOLATION.test(def?.pattern || '')));
export const defaultRir = def => isCompoundDef(def) ? 2 : 1;
export const effortText = rir => 'cíl RPE ' + (10 - rir) + ' (' + rir + ' opakování v rezervě)';
export const restFor = (def, warm) => warm ? 40 : def?.fatigue >= 1.2 ? 150 : def?.warmup ? 120 : 75;
const EFFORT = /; cíl RPE \d+ \(\d+ opakování v rezervě\)/g, FAILURE = /; poslední série do technického selhání, jen při čistém provedení/g;

// targetRir: Map exercise → reps in reserve (default by exercise type).
// allowFailure: false on deload or poor-recovery days.
export function configureStrengthCoaching(rows, catalog, { factor = 1, muscleLoad = new Map(), protectedLegs = false, recoveryScore = null, targetRir = new Map(), allowFailure = true } = {}) {
  for (const r of rows) {
    const def = catalog[r[1]] || {}, warm = r[0] === 'WARMUP';
    r[11] = 'FALSE'; r[12] = '';
    const note = String(r[9] || '').replace(/\s*\[Pauza \d+ s\]/g, '').replace(FAILURE, '').replace(EFFORT, '').trim();
    r[9] = (warm ? note : (note ? note + '; ' : '; ') + effortText(targetRir.get(r[1]) ?? defaultRir(def))) + ' [Pauza ' + restFor(def, warm) + ' s]';
  }
  const names = [...new Set(rows.filter(r => r[0] === 'WORK').map(r => r[1]))];
  const station = name => /^Cable |^Single-arm cable |^Low-to-high cable /.test(name) ? 'cable' : /^DB |^Hammer curl/.test(name) ? 'dumbbells' : '';
  const accessories = names.filter(name => !catalog[name]?.warmup && catalog[name]?.fatigue <= .6 && station(name));
  const overlap = [['chest','triceps'],['chest','shoulders'],['chest','side_delts'],['back','biceps'],['back','rear_delts'],['shoulders','triceps']];
  const compatible = (a,b) => a !== b && !overlap.some(pair => pair.includes(a) && pair.includes(b));
  const used = new Set(); let group = 0;
  for (const name of accessories) {
    if (used.has(name)) continue;
    const other = accessories.find(n => n !== name && !used.has(n) && station(n) === station(name) && compatible(catalog[n].muscle,catalog[name].muscle));
    if (!other || group >= 6) continue;
    const id = 'ABCDEF'[group++]; used.add(name); used.add(other);
    for (const r of rows) if (r[0] === 'WORK' && [name, other].includes(r[1])) r[12] = id;
  }
  // Only one last isolation set reaches technical failure on well-recovered days.
  if (allowFailure && factor >= .97 && (recoveryScore == null || recoveryScore >= 70)) {
    const name = names.find(n => catalog[n]?.fatigue <= .5 && !catalog[n]?.warmup && (muscleLoad.get(catalog[n]?.muscle) || 0) < 2.5 && !/sportovní zátěž|zkušební váha/.test(rows.find(r => r[1] === n)?.[9] || '') && !(protectedLegs && ['quads','hamstrings','glutes','calves'].includes(catalog[n]?.muscle)));
    const last = name && rows.filter(r => r[0] === 'WORK' && r[1] === name).at(-1);
    // The failure set replaces the effort target on that one set.
    if (last) { last[11] = 'TRUE'; last[9] = last[9].replace(EFFORT, '') + '; poslední série do technického selhání, jen při čistém provedení'; }
  }
  return rows;
}
