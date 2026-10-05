import { isIntensity } from './strength-context.js';
const key=v=>String(v||'').slice(0,10);
const age=(a,b)=>(Date.parse(key(b)+'T12:00:00Z')-Date.parse(key(a)+'T12:00:00Z'))/86400000;
// Walking is daily life, not training load for the legs.
function sportMuscles(a){
  const type=String((a.type||'')+' '+(a.name||'')).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  if(/ride|cycl|bike|run|hike|beh|kolo/.test(type))return {endurance:true,muscles:['quads','hamstrings','glutes','calves']};
  if(/climb|boulder|horolez/.test(type))return {muscles:['back','lats','upper_back','biceps','forearms','core','abs']};
  if(/swim|plav/.test(type))return {muscles:['back','lats','upper_back','shoulders','front_delts','side_delts','chest']};
  if(/row|vesl/.test(type))return {muscles:['quads','hamstrings','back','upper_back','lats','biceps']};
  return {muscles:[]};
}
const minutesOf=a=>Number(a.durationHours)*60||Number(a.durationMinutes)||Number(a.moving_time)/60||0;
function unique(list){const seen=new Set();return list.filter(a=>{const id=a.id||[a.start||a.date,a.type,a.name].join('|');if(seen.has(id))return false;seen.add(id);return true;});}
// Other sports affect the dose; only completed gym sets count as strength coverage.
export function sportMuscleLoad(context){
  const load=new Map();
  for(const a of unique([...(context?.sports?.recentActivities||[]),...(context?.cycling?.recentActivities||[])])){
    const days=age(a.date||a.start,context.date);if(!Number.isFinite(days)||days<0||days>3)continue;
    const {muscles}=sportMuscles(a);if(!muscles.length)continue;
    const dose=Math.min(2,Math.max(Number(a.tss)/80||0,minutesOf(a)/90))*(days<=1?1:.5);
    for(const muscle of muscles)load.set(muscle,Math.min(3,(load.get(muscle)||0)+dose));
  }
  return load;
}
// Muscles that need a reduced gym dose today: an intensity session or a long
// one in the last ~24 h or the next ~36 h, or a load ≥ 1.5 × CTL. A normal
// training week alone never reduces the dose. Planned sessions without a
// date are taken as near. Returns muscle → Czech reason.
export function acuteSportStress(context){
  const out=new Map(),recent=unique([...(context?.sports?.recentActivities||[]),...(context?.cycling?.recentActivities||[])]);
  const ctl=Number(recent.find(a=>Number(a?.ctl)>0)?.ctl)||null;
  const planned=unique([context?.cycling?.nextRide,...(context?.cycling?.plannedWorkouts||[])].filter(Boolean));
  const check=(a,future)=>{
    const days=a.date||a.start?age(a.date||a.start,context.date):future?-1:0;
    if(!Number.isFinite(days)||(future?days>0||days<-1:days<0||days>1))return;
    const {muscles,endurance}=sportMuscles({type:a.type||(future?'Ride':''),name:a.name});if(!muscles.length)return;
    const minutes=minutesOf(a),tss=Number(a.tss)||0;
    const why=isIntensity(a)?'intenzivní trénink':minutes>=(endurance?150:90)?'dlouhý trénink':tss>=(ctl?1.5*ctl:120)?'vysoká zátěž (TSS '+Math.round(tss)+')':'';
    if(!why)return;
    const reason=why+(future?' v příštích 36 h':' za posledních 24 h');
    for(const m of muscles)if(!out.has(m))out.set(m,reason);
  };
  for(const a of recent)check(a,false);
  for(const a of planned)check(a,true);
  return out;
}
export function strengthCoverage(context,catalog){
  const last={},sets={};
  for(const row of context?.strength?.recentCompletedSets||[]){
    if(String(row.type||'WORK').toUpperCase()!=='WORK'||row.planned||row.completed===false||row.completed===0)continue;
    const muscle=catalog[row.exercise]?.muscle,days=age(row.workout_date,context.date);if(!muscle||!Number.isFinite(days)||days<0||days>14)continue;
    const date=key(row.workout_date);if(!last[muscle]||date>last[muscle])last[muscle]=date;
    if(days<=7)sets[muscle]=(sets[muscle]||0)+1;
  }
  return {lastStrengthDateByMuscle:last,setsLast7Days:sets,undertrainedMuscles:['quads','hamstrings','chest','back'].filter(m=>!sets[m])};
}
