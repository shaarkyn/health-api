const SYSTEMS=["recovery","endurance","tempo","sweet_spot","threshold","vo2max","anaerobic","sprint"];
const HARD_SYSTEMS=new Set(["sweet_spot","threshold","vo2max","anaerobic","sprint"]);
const now=()=>new Date().toISOString();
const n=(v,d=null)=>v===null||v===undefined||v===""?d:Number.isFinite(Number(v))?Number(v):d;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const json=v=>JSON.stringify(v??[]);
const slug=s=>String(s||"workout").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70);
function hash(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function tss(durationMinutes,ifactor){return Math.round((durationMinutes/60)*ifactor*ifactor*100)}
function step(durationMinutes,power,cadence=null,note=null){return {durationMinutes,power,cadence,note}}
function rep(repeats,steps){return {repeats,steps}}
function totalMinutes(structure=[]){return structure.reduce((sum,b)=>sum+(n(b.durationMinutes,0)||0)+(n(b.repeats,1)||1)*(b.steps||[]).reduce((s,x)=>s+n(x.durationMinutes,0),0),0)}
function workingMinutes(structure=[],threshold=88){let out=0;for(const b of structure){if(b.durationMinutes&&n(b.power,0)>=threshold)out+=n(b.durationMinutes,0);for(let r=0;r<(n(b.repeats,1)||1);r++)for(const s of b.steps||[])if(n(s.power,0)>=threshold)out+=n(s.durationMinutes,0)}return Math.round(out*10)/10}
function intervalsDescription(structure=[]){
  const target=s=>{const p=n(s.power);if(p==null)return "55%";return Math.round(p)+"%"};
  const line=s=>"- "+(n(s.durationMinutes,0)*60%60===0?Math.round(n(s.durationMinutes)*1)+"m":Math.round(n(s.durationMinutes)*60)+"s")+" "+target(s)+(s.cadence?" "+String(s.cadence).replace(/[^0-9-]/g,"")+"rpm":"")+(s.note?" "+s.note:"");
  const parts=[];let single=0;
  for(const b of structure){
    if(b.steps?.length){parts.push("Main Set "+(b.repeats||1)+"x\n"+b.steps.map(line).join("\n"))}
    else if(b.durationMinutes){single++;const label=single===1?"Warmup":"Main Set 1x";parts.push(label+"\n"+line({...b,note:b.note||undefined}))}
  }
  if(parts.length){
    const last=structure.at(-1);
    if(last?.durationMinutes&&n(last.power,100)<=60){parts[parts.length-1]="Cooldown\n"+line(last)}
  }
  return parts.join("\n\n");
}
function workout({id,name,sourceName="PFD Coach Lab",sourceKind="original",sourceUrl=null,licenseNote="Original structured workout generated for Petr Fitness Data.",attribution=null,primarySystem,secondarySystem=null,difficulty,ifactor,structure,tags=[],description,cadence="85–95 rpm",popularity=0,verified=1}){
  const durationMinutes=Math.round(totalMinutes(structure));
  return {id,name,source_name:sourceName,source_kind:sourceKind,source_url:sourceUrl,license_note:licenseNote,attribution,external_id:null,primary_system:primarySystem,secondary_system:secondarySystem,duration_minutes:durationMinutes,work_minutes:workingMinutes(structure),difficulty, intensity_factor:ifactor,target_load:tss(durationMinutes,ifactor),cadence,description,intervals_description:intervalsDescription(structure),tags_json:json(tags),structure_json:json(structure),verified,popularity};
}
const WU10=[step(10,55,"90","easy")],WU15=[step(15,58,"90","progressive")],CD10=[step(10,50,"90","easy")];

export const CURATED_WORKOUTS=[
 workout({id:"pfd-rec-45",name:"Recovery Spin 45",primarySystem:"recovery",difficulty:1.2,ifactor:.52,structure:[step(10,50),step(25,53),step(10,48)],tags:["recovery","easy"],description:"Lehká regenerace bez kvalitativního cíle."}),
 workout({id:"pfd-end-60",name:"Endurance 60",primarySystem:"endurance",difficulty:2.0,ifactor:.65,structure:[step(10,55),step(40,67),step(10,50)],tags:["z2","endurance"],description:"Krátká stabilní Z2."}),
 workout({id:"pfd-end-90",name:"Endurance 90",primarySystem:"endurance",difficulty:2.5,ifactor:.68,structure:[step(10,55),step(70,69),step(10,50)],tags:["z2","endurance","90min"],description:"Standardní aerobní jednotka pro všední den."}),
 workout({id:"pfd-end-120",name:"Endurance 120",primarySystem:"endurance",difficulty:3.1,ifactor:.69,structure:[step(15,55),step(95,70),step(10,50)],tags:["z2","endurance"],description:"Dvouhodinová aerobní vytrvalost."}),
 workout({id:"pfd-end-180",name:"Long Endurance 180",primarySystem:"endurance",difficulty:4.0,ifactor:.70,structure:[step(15,55),step(150,70),step(15,50)],tags:["z2","long"],description:"Dlouhá Z2 pro aerobní objem a durability."}),
 workout({id:"pfd-tempo-2x20",name:"Tempo 2×20",primarySystem:"tempo",difficulty:3.4,ifactor:.76,structure:[...WU15,rep(2,[step(20,84,"88-92"),step(5,55)]),step(15,65),...CD10],tags:["tempo"],description:"Kontrolovaný tempo stimul s nízkou cenou za regeneraci."}),
 workout({id:"pfd-tempo-3x15",name:"Tempo 3×15",primarySystem:"tempo",difficulty:4.0,ifactor:.78,structure:[...WU15,rep(3,[step(15,85,"88-92"),step(5,55)]),step(10,65),...CD10],tags:["tempo","durability"],description:"Delší čas v tempu pro muscular endurance."}),
 workout({id:"pfd-ss-3x12",name:"Sweet Spot 3×12",primarySystem:"sweet_spot",secondarySystem:"threshold",difficulty:4.1,ifactor:.82,structure:[...WU15,rep(3,[step(12,90,"88-94"),step(5,55)]),step(9,65),...CD10],tags:["sweet-spot","progression"],description:"Vstupní sweet-spot progression."}),
 workout({id:"pfd-ss-2x20",name:"Sweet Spot 2×20",primarySystem:"sweet_spot",secondarySystem:"threshold",difficulty:4.8,ifactor:.84,structure:[...WU15,rep(2,[step(20,91,"88-94"),step(7,55)]),step(11,65),...CD10],tags:["sweet-spot"],description:"Klasický delší sweet-spot stimul."}),
 workout({id:"pfd-ss-3x20",name:"Sweet Spot 3×20",primarySystem:"sweet_spot",secondarySystem:"threshold",difficulty:6.1,ifactor:.86,structure:[...WU15,rep(3,[step(20,91,"88-94"),step(7,55)]),step(14,65),...CD10],tags:["sweet-spot","durability"],description:"Vysoký čas v sweet spot pro zkušeného jezdce."}),
 workout({id:"pfd-thr-3x10",name:"Threshold 3×10",primarySystem:"threshold",difficulty:4.6,ifactor:.85,structure:[...WU15,rep(3,[step(10,98,"88-94"),step(5,55)]),step(15,65),...CD10],tags:["threshold","progression"],description:"Vstupní threshold progression."}),
 workout({id:"pfd-thr-3x12",name:"Threshold 3×12",primarySystem:"threshold",difficulty:5.3,ifactor:.87,structure:[...WU15,rep(3,[step(12,98,"88-94"),step(5,55)]),step(19,65),...CD10],tags:["threshold","progression"],description:"Střední threshold progression."}),
 workout({id:"pfd-thr-3x15",name:"Threshold 3×15",primarySystem:"threshold",difficulty:6.2,ifactor:.89,structure:[...WU15,rep(3,[step(15,98,"88-94"),step(6,55)]),step(12,65),...CD10],tags:["threshold","progression","durability"],description:"45 minut práce blízko FTP."}),
 workout({id:"pfd-thr-2x20",name:"Threshold 2×20",primarySystem:"threshold",difficulty:6.5,ifactor:.90,structure:[...WU15,rep(2,[step(20,98,"90-95"),step(8,55)]),step(19,65),...CD10],tags:["threshold","durability"],description:"Dlouhé stabilní threshold bloky."}),
 workout({id:"pfd-vo2-6x3",name:"VO₂ 6×3",primarySystem:"vo2max",difficulty:4.8,ifactor:.87,structure:[...WU15,rep(6,[step(3,115,"95-105"),step(3,50)]),step(14,65),...CD10],tags:["vo2max","3min"],description:"Krátké VO₂ intervaly s plnou kontrolou opakovatelnosti.",cadence:"95–105 rpm"}),
 workout({id:"pfd-vo2-4x4",name:"VO₂ 4×4",primarySystem:"vo2max",difficulty:5.2,ifactor:.88,structure:[...WU15,rep(4,[step(4,112,"95-105"),step(4,50)]),step(18,65),...CD10],tags:["vo2max","4min"],description:"Klasický čtyřminutový VO₂ stimul.",cadence:"95–105 rpm"}),
 workout({id:"pfd-vo2-5x4-90",name:"VO₂ 5×4 · 90 min",primarySystem:"vo2max",difficulty:6.1,ifactor:.89,structure:[...WU15,rep(5,[step(4,112,"95-105"),step(4,50)]),step(25,67),...CD10],tags:["vo2max","4min","90min"],description:"VO₂ kvalita vložená do 90min jednotky.",cadence:"95–105 rpm"}),
 workout({id:"pfd-vo2-30-15",name:"VO₂ 30/15 · 3×8",primarySystem:"vo2max",secondarySystem:"anaerobic",difficulty:6.4,ifactor:.91,structure:[...WU15,rep(3,[step(.5,120,"100-110"),step(.25,55),step(.5,120,"100-110"),step(.25,55),step(.5,120,"100-110"),step(.25,55),step(.5,120,"100-110"),step(.25,55),step(.5,120,"100-110"),step(.25,55),step(.5,120,"100-110"),step(.25,55),step(.5,120,"100-110"),step(.25,55),step(.5,120,"100-110"),step(.25,55),step(5,50)]),step(12,65),...CD10],tags:["vo2max","30-15","microbursts"],description:"Microintervaly pro vysokou spotřebu kyslíku a opakovatelnost.",cadence:"100–110 rpm"}),
 workout({id:"pfd-ana-6x90",name:"Anaerobic 6×90 s",primarySystem:"anaerobic",secondarySystem:"vo2max",difficulty:5.7,ifactor:.88,structure:[...WU15,rep(6,[step(1.5,135,"95-110"),step(4,50)]),step(17,65),...CD10],tags:["anaerobic","repeatability"],description:"Opakované 90s nad VO₂ pásmem."}),
 workout({id:"pfd-sprint-8x10",name:"Neuromuscular 8×10 s",primarySystem:"sprint",difficulty:4.2,ifactor:.72,structure:[...WU15,rep(8,[step(.1667,180,"110-125"),step(4.8333,55)]),step(25,67),...CD10],tags:["sprint","neuromuscular"],description:"Krátké sprinty s dlouhou regenerací; kvalita před kvantitou.",cadence:"110–125 rpm"}),

 workout({id:"public-uae-torque-bursts",name:"UAE-style Torque Bursts · scaled",sourceName:"Cycling Weekly · UAE training feature",sourceKind:"public_reference",sourceUrl:"https://www.cyclingweekly.com/fitness/training/how-tadej-pogacar-and-uae-team-emirates-train-to-be-the-1-team-in-cycling",licenseNote:"Publicly described workout principle; this is an independently scaled implementation.",attribution:"Public training feature describing UAE Team Emirates-XRG torque work.",primarySystem:"vo2max",secondarySystem:"sprint",difficulty:7.2,ifactor:.90,structure:[...WU15,rep(7,[step(4,70,"85-90"),step(.5833,130,"50"),step(.25,170,"110-125"),step(3.1667,68,"90")]),step(10,65),...CD10],tags:["pro-inspired","uae","torque","sprint"],description:"Scaled implementation of a publicly described torque-burst concept; not an internal UAE workout.",cadence:"mixed"}),
 workout({id:"public-uae-40-20",name:"UAE-style 40/20 Over-Unders",sourceName:"Cycling Weekly · UAE training feature",sourceKind:"public_reference",sourceUrl:"https://www.cyclingweekly.com/fitness/training/how-tadej-pogacar-and-uae-team-emirates-train-to-be-the-1-team-in-cycling",licenseNote:"Publicly described workout principle; implementation normalized for this app.",attribution:"Public feature describing 3×8 min 40/20 over-unders.",primarySystem:"vo2max",secondarySystem:"threshold",difficulty:6.8,ifactor:.92,structure:[...WU15,rep(3,[step(.6667,115,"95-105"),step(.3333,85,"90-95"),step(.6667,115,"95-105"),step(.3333,85,"90-95"),step(.6667,115,"95-105"),step(.3333,85,"90-95"),step(.6667,115,"95-105"),step(.3333,85,"90-95"),step(.6667,115,"95-105"),step(.3333,85,"90-95"),step(.6667,115,"95-105"),step(.3333,85,"90-95"),step(.6667,115,"95-105"),step(.3333,85,"90-95"),step(.6667,115,"95-105"),step(.3333,85,"90-95"),step(6,55)]),step(11,65),...CD10],tags:["pro-inspired","uae","40-20","over-under"],description:"Amateur-scaled version of publicly described UAE-style 40/20 over-unders.",cadence:"90–105 rpm"}),
 workout({id:"public-uae-steady-torque",name:"UAE-style 3×10 Steady Torque",sourceName:"Cycling Weekly · UAE training feature",sourceKind:"public_reference",sourceUrl:"https://www.cyclingweekly.com/fitness/training/how-tadej-pogacar-and-uae-team-emirates-train-to-be-the-1-team-in-cycling",licenseNote:"Publicly described workout prescription.",attribution:"Public feature describes 3×10 min at 90–95% FTP around 50 rpm with 5 min recovery.",primarySystem:"sweet_spot",secondarySystem:"strength_endurance",difficulty:5.5,ifactor:.84,structure:[...WU15,rep(3,[step(10,92,"50"),step(5,55,"90")]),step(20,68),...CD10],tags:["pro-inspired","uae","torque","low-cadence"],description:"Low-cadence muscular endurance based on a publicly described UAE session.",cadence:"50 rpm work"}),
 workout({id:"public-join-2x20-threshold",name:"Public reference · 2×20 Threshold",sourceName:"JOIN public workout library",sourceKind:"public_reference",sourceUrl:"https://join.cc/workouts/cycling-workouts/2x-20-min-threshold-2hours-00minutes",licenseNote:"Publicly visible workout outline; intensity normalized to 98% FTP by Petr Fitness Data.",attribution:"JOIN publicly describes 2×20 min threshold, 10 min recovery, ~95 rpm.",primarySystem:"threshold",difficulty:6.6,ifactor:.84,structure:[...WU15,rep(2,[step(20,98,"95"),step(10,55)]),step(45,68),...CD10],tags:["public-reference","join","threshold"],description:"Independent normalization of a publicly visible JOIN workout outline.",cadence:"95 rpm"}),
 workout({id:"public-join-increasing-threshold",name:"Public reference · 2×5×3 Threshold",sourceName:"JOIN public workout library",sourceKind:"public_reference",sourceUrl:"https://join.cc/workouts/cycling-workouts/increasing-threshold-sets-1hours-35minutes",licenseNote:"Publicly visible workout outline; target percentages normalized by Petr Fitness Data.",attribution:"JOIN publicly describes two sets of five 3-minute threshold intervals with 15 min between sets.",primarySystem:"threshold",secondarySystem:"vo2max",difficulty:6.0,ifactor:.88,structure:[...WU15,rep(5,[step(3,100,"90-95"),step(2,55)]),step(15,55),rep(5,[step(3,100,"90-95"),step(2,55)]),step(5,65),...CD10],tags:["public-reference","join","threshold","repeatability"],description:"Independent power normalization of JOIN's publicly visible interval pattern."}),
 workout({id:"public-tp-4x4-vo2",name:"Public sample · 4×4 VO₂",sourceName:"TrainingPeaks public sample week",sourceKind:"public_reference",sourceUrl:"https://www.trainingpeaks.com/training-plans/cycling/road-cycling/tp-275216/tc-rad-build-beginner-intermediate-fokus-vo2max",licenseNote:"Public sample workout outline; power target normalized independently.",attribution:"Public TrainingPeaks sample week lists a 4×4 high-intensity session.",primarySystem:"vo2max",difficulty:5.3,ifactor:.87,structure:[...WU15,rep(4,[step(4,112,"90-105"),step(4,50)]),step(3,65),...CD10],tags:["public-reference","trainingpeaks","4x4"],description:"Independent implementation of a public 4×4 VO₂ sample.",cadence:"90–105 rpm"}),
 workout({id:"public-trainerday-tadej-4x3",name:"TrainerDay public · Train Like Tadej 4×3",sourceName:"TrainerDay public community",sourceKind:"public_reference",sourceUrl:"https://app.trainerday.com/workouts/train-like-tadej-4x3min-vo2-max",licenseNote:"Public TrainerDay community workout; intended to be replaced/refreshed through the official API once an approved API key is configured.",attribution:"TrainerDay public community workout.",primarySystem:"vo2max",difficulty:4.7,ifactor:.80,structure:[step(2.5,50),step(2.5,62),step(3,70),step(3,80),step(3,90),step(5,50),rep(4,[step(3,110,"95-105"),step(4,50)]),step(10,52)],tags:["trainerday","public","vo2max"],description:"Public TrainerDay workout included with source attribution.",cadence:"95–105 rpm",popularity:106})
];

export function defaultCapabilities(){return Object.fromEntries(SYSTEMS.map(system=>[system,{system,level:3,confidence:.2,attempts:0,successes:0}]))}

export function rankWorkoutCandidates(workouts,filters={},context={},capabilities=defaultCapabilities()){
  const system=String(filters.system||"").toLowerCase(),duration=n(filters.durationMinutes),durationTolerance=n(filters.durationTolerance,15),targetLoad=n(filters.targetLoad),loadTolerance=n(filters.loadTolerance,35),maxDifficulty=n(filters.maxDifficulty);
  const readiness=String(context.readiness||context?.readiness?.status||"green").toLowerCase(),hardDays=n(context.hardBikeDaysRolling7d??context?.load?.hardBikeDaysRolling7d,0),phase=String(context.phase||context?.constraints?.phase||"").toLowerCase();
  return workouts.map(w=>{
    let score=25;const reasons=[];
    if(system){
      if(w.primary_system===system){score+=25;reasons.push("přesný tréninkový systém");}
      else if(w.secondary_system===system){score+=12;reasons.push("sekundární zásah cílového systému");}
      else score-=35;
    }
    if(duration!=null){
      const diff=Math.abs(n(w.duration_minutes,0)-duration),fit=clamp(1-diff/Math.max(durationTolerance,1),0,1);
      score+=20*fit;if(diff<=5)reasons.push("téměř přesná délka");else if(diff<=durationTolerance)reasons.push("délka v toleranci");
      if(diff>durationTolerance*2)score-=12;
    }
    if(targetLoad!=null){
      const diff=Math.abs(n(w.target_load,0)-targetLoad),fit=clamp(1-diff/Math.max(loadTolerance,1),0,1);score+=12*fit;if(diff<=10)reasons.push("zátěž blízko cíli");
    }
    if(maxDifficulty!=null&&n(w.difficulty,99)>maxDifficulty)score-=25;
    const capability=capabilities[w.primary_system]||{level:3,confidence:.1};
    const readinessOffset=readiness==="green"?.45:readiness==="yellow"?-.25:-1;
    const phaseOffset=phase==="build"?.25:phase==="recovery"?-.8:phase==="taper"?-.3:0;
    const ideal=clamp(n(capability.level,3)+readinessOffset+phaseOffset,1,10);
    const gap=Math.abs(n(w.difficulty,5)-ideal);
    score+=clamp(18-gap*4,0,18);
    if(gap<=.75)reasons.push("obtížnost odpovídá aktuální capability");
    if(readiness==="red"&&HARD_SYSTEMS.has(w.primary_system)){score-=30;reasons.push("penalizace kvůli nízké readiness");}
    if(readiness==="yellow"&&["vo2max","anaerobic","sprint"].includes(w.primary_system))score-=12;
    if(hardDays>=2&&HARD_SYSTEMS.has(w.primary_system)){score-=24;reasons.push("penalizace po dvou kvalitních dnech");}
    if(n(w.verified,0))score+=3;
    score+=Math.min(3,Math.log10(1+n(w.popularity,0))*1.5);
    return {...w,suitability:Math.round(clamp(score,0,100)),capability_level:n(capability.level,3),challenge_gap:Math.round((n(w.difficulty,5)-n(capability.level,3))*10)/10,reasons};
  }).filter(w=>!system||w.primary_system===system||w.secondary_system===system).sort((a,b)=>b.suitability-a.suitability||Math.abs((duration??a.duration_minutes)-a.duration_minutes)-Math.abs((duration??b.duration_minutes)-b.duration_minutes)||a.difficulty-b.difficulty);
}

export function calculateCapabilityUpdate(current,workout,feedback={}){
  const level=n(current?.level,3),difficulty=n(workout?.difficulty,level),completed=clamp(n(feedback.completedPercent,100)/100,0,1),rpe=n(feedback.rpe),survey=String(feedback.survey||"").toLowerCase();
  let delta=0;let success=false;
  if(completed>=.9&&survey!=="failed"){
    success=true;
    if(rpe!=null&&rpe<=6.5)delta=.30;
    else if(rpe!=null&&rpe<=8.5)delta=.18;
    else delta=.08;
    delta*=clamp(.7+(difficulty-level)*.25,.5,1.35);
  } else if(completed>=.75){delta=-.08}
  else delta=-.22;
  if(rpe!=null&&rpe>=9.5&&completed<.95)delta-=.08;
  const next=clamp(level+delta,1,10),attempts=n(current?.attempts,0)+1,successes=n(current?.successes,0)+(success?1:0),confidence=clamp(n(current?.confidence,.2)+.04,0,1);
  return {level:Math.round(next*100)/100,confidence:Math.round(confidence*100)/100,attempts,successes,delta:Math.round(delta*100)/100,success};
}

export async function ensureWorkoutLibrary(db){
  const statements=[
    `CREATE TABLE IF NOT EXISTS workout_library (id TEXT PRIMARY KEY,name TEXT NOT NULL,source_name TEXT NOT NULL,source_kind TEXT NOT NULL,source_url TEXT,license_note TEXT,attribution TEXT,external_id TEXT,primary_system TEXT NOT NULL,secondary_system TEXT,duration_minutes INTEGER NOT NULL,work_minutes REAL NOT NULL DEFAULT 0,difficulty REAL NOT NULL DEFAULT 1,intensity_factor REAL,target_load REAL,cadence TEXT,description TEXT,intervals_description TEXT NOT NULL,tags_json TEXT NOT NULL DEFAULT '[]',structure_json TEXT NOT NULL DEFAULT '[]',verified INTEGER NOT NULL DEFAULT 0,popularity REAL NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS cycling_capabilities (system TEXT PRIMARY KEY,level REAL NOT NULL DEFAULT 3.0,confidence REAL NOT NULL DEFAULT 0.20,attempts INTEGER NOT NULL DEFAULT 0,successes INTEGER NOT NULL DEFAULT 0,last_workout_id TEXT,last_rpe REAL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS workout_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT,workout_id TEXT NOT NULL,scheduled_date TEXT,completed_percent REAL,rpe REAL,survey TEXT,notes TEXT,capability_before REAL,capability_after REAL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS workout_schedule_links (id INTEGER PRIMARY KEY AUTOINCREMENT,workout_id TEXT NOT NULL,scheduled_date TEXT NOT NULL,intervals_external_id TEXT NOT NULL UNIQUE,intervals_event_id TEXT,status TEXT NOT NULL DEFAULT 'scheduled',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  ];
  for(const sql of statements)await db.prepare(sql).run();
  await seedWorkoutLibrary(db);
  for(const system of SYSTEMS)await db.prepare("INSERT OR IGNORE INTO cycling_capabilities(system,level,confidence,attempts,successes) VALUES(?,3.0,0.20,0,0)").bind(system).run();
}
export async function seedWorkoutLibrary(db){
  const sql=`INSERT INTO workout_library(id,name,source_name,source_kind,source_url,license_note,attribution,external_id,primary_system,secondary_system,duration_minutes,work_minutes,difficulty,intensity_factor,target_load,cadence,description,intervals_description,tags_json,structure_json,verified,popularity,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name,source_name=excluded.source_name,source_kind=excluded.source_kind,source_url=excluded.source_url,license_note=excluded.license_note,attribution=excluded.attribution,primary_system=excluded.primary_system,secondary_system=excluded.secondary_system,duration_minutes=excluded.duration_minutes,work_minutes=excluded.work_minutes,difficulty=excluded.difficulty,intensity_factor=excluded.intensity_factor,target_load=excluded.target_load,cadence=excluded.cadence,description=excluded.description,intervals_description=excluded.intervals_description,tags_json=excluded.tags_json,structure_json=excluded.structure_json,verified=excluded.verified,popularity=excluded.popularity,updated_at=excluded.updated_at`;
  for(const w of CURATED_WORKOUTS)await db.prepare(sql).bind(w.id,w.name,w.source_name,w.source_kind,w.source_url,w.license_note,w.attribution,w.external_id,w.primary_system,w.secondary_system,w.duration_minutes,w.work_minutes,w.difficulty,w.intensity_factor,w.target_load,w.cadence,w.description,w.intervals_description,w.tags_json,w.structure_json,w.verified,w.popularity,now()).run();
}
export async function getCapabilities(db){
  await ensureWorkoutLibrary(db);const rows=await db.prepare("SELECT * FROM cycling_capabilities").all();return Object.fromEntries((rows.results||[]).map(x=>[x.system,x]));
}
export async function searchWorkoutLibrary(db,filters={},context={}){
  await ensureWorkoutLibrary(db);
  const rows=await db.prepare("SELECT * FROM workout_library").all(),capabilities=await getCapabilitiesNoEnsure(db);
  const ranked=rankWorkoutCandidates(rows.results||[],filters,context,capabilities);
  const limit=clamp(n(filters.limit,30),1,100);
  return {status:"ok",count:Math.min(limit,ranked.length),total:ranked.length,filters,capabilities,workouts:ranked.slice(0,limit)};
}
async function getCapabilitiesNoEnsure(db){const rows=await db.prepare("SELECT * FROM cycling_capabilities").all();return Object.fromEntries((rows.results||[]).map(x=>[x.system,x]))}
export async function getWorkout(db,id){await ensureWorkoutLibrary(db);return db.prepare("SELECT * FROM workout_library WHERE id=?").bind(id).first()}

export async function recordWorkoutFeedback(db,{workoutId,scheduledDate=null,completedPercent=100,rpe=null,survey="completed",notes=null}){
  await ensureWorkoutLibrary(db);const w=await getWorkout(db,workoutId);if(!w)throw new Error("Workout nebyl nalezen.");
  const current=(await db.prepare("SELECT * FROM cycling_capabilities WHERE system=?").bind(w.primary_system).first())||{system:w.primary_system,level:3,confidence:.2,attempts:0,successes:0};
  const next=calculateCapabilityUpdate(current,w,{completedPercent,rpe,survey});
  await db.prepare(`INSERT INTO cycling_capabilities(system,level,confidence,attempts,successes,last_workout_id,last_rpe,updated_at) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(system) DO UPDATE SET level=excluded.level,confidence=excluded.confidence,attempts=excluded.attempts,successes=excluded.successes,last_workout_id=excluded.last_workout_id,last_rpe=excluded.last_rpe,updated_at=excluded.updated_at`)
    .bind(w.primary_system,next.level,next.confidence,next.attempts,next.successes,w.id,rpe,now()).run();
  await db.prepare("INSERT INTO workout_feedback(workout_id,scheduled_date,completed_percent,rpe,survey,notes,capability_before,capability_after) VALUES(?,?,?,?,?,?,?,?)")
    .bind(w.id,scheduledDate,n(completedPercent,100),rpe,survey,notes,n(current.level,3),next.level).run();
  return {status:"ok",system:w.primary_system,before:n(current.level,3),after:next.level,delta:next.delta,confidence:next.confidence};
}

export function buildIntervalsEvent(workout,date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||"")))throw new Error("Neplatné datum.");
  const externalId="pfd-library:"+workout.id+":"+date;
  const tags=(()=>{try{return JSON.parse(workout.tags_json||"[]")}catch{return[]}})();
  return {external_id:externalId,category:"WORKOUT",start_date_local:date+"T00:00:00",type:"Ride",name:workout.name,description:workout.intervals_description,load_target:Math.round(n(workout.target_load,0)),tags:[...new Set(["PFD Workout Library",...tags])]};
}
export async function scheduleWorkoutInIntervals(env,db,{workoutId,date,confirm=false}){
  if(confirm!==true)throw new Error("Zápis do Intervals.icu vyžaduje potvrzení.");
  const workout=await getWorkout(db,workoutId);if(!workout)throw new Error("Workout nebyl nalezen.");
  if(!env.INTERVALS_API_KEY)throw new Error("Intervals.icu není připojeno.");
  const event=buildIntervalsEvent(workout,date),auth="Basic "+btoa("API_KEY:"+String(env.INTERVALS_API_KEY));
  const response=await fetch("https://intervals.icu/api/v1/athlete/0/events/bulk?upsert=true",{method:"POST",headers:{Authorization:auth,Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify([event])});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error("Intervals.icu HTTP "+response.status);
  const first=Array.isArray(data)?data[0]:data;
  await db.prepare(`INSERT INTO workout_schedule_links(workout_id,scheduled_date,intervals_external_id,intervals_event_id,status) VALUES(?,?,?,?,?)
    ON CONFLICT(intervals_external_id) DO UPDATE SET intervals_event_id=excluded.intervals_event_id,status=excluded.status`)
    .bind(workout.id,date,event.external_id,String(first?.id||first?.event?.id||""),"scheduled").run();
  return {status:"ok",workout:{id:workout.id,name:workout.name},date,externalId:event.external_id,intervalsEventId:first?.id||first?.event?.id||null,response:data};
}

export function buildTrainerDayQuery({system,durationMinutes,durationTolerance=5,name,pageIndex=0}={}){
  const url=new URL("https://api.trainerday.com/api/v1/workouts/find");
  const map={recovery:"recovery",endurance:"endurance",tempo:"Tempo",sweet_spot:"threshold",threshold:"threshold",vo2max:"vo2max",anaerobic:"anaerobic",sprint:"anaerobic"};
  if(system&&map[system])url.searchParams.set("dominantZone",map[system]);
  if(durationMinutes!=null){url.searchParams.set("fromMinutes",String(Math.max(0,Math.round(durationMinutes-durationTolerance))));url.searchParams.set("toMinutes",String(Math.round(durationMinutes+durationTolerance)))}
  if(name)url.searchParams.set("workoutName",String(name));
  url.searchParams.set("pageIndex",String(Math.max(0,Math.round(pageIndex))));
  return url.toString();
}
function inferSystem(item){
  const z=String(item.dominantZone||item.dominant_zone||"").toLowerCase();
  if(z.includes("vo2"))return"vo2max";if(z.includes("anaer"))return"anaerobic";if(z.includes("threshold"))return"threshold";if(z.includes("tempo"))return"tempo";if(z.includes("endurance"))return"endurance";if(z.includes("recovery"))return"recovery";
  const seg=Array.isArray(item.segments)?item.segments:[],mx=Math.max(0,...seg.map(x=>Math.max(n(x?.[1],0),n(x?.[2],0))));
  return mx>=130?"anaerobic":mx>=108?"vo2max":mx>=95?"threshold":mx>=88?"sweet_spot":mx>=76?"tempo":"endurance";
}
export function normalizeTrainerDayWorkout(item){
  const segments=Array.isArray(item?.segments)?item.segments.filter(x=>Array.isArray(x)&&n(x[0])>0):[];if(!segments.length)return null;
  const structure=segments.map(s=>step(n(s[0]),Math.round((n(s[1],n(s[2],60))+n(s[2],n(s[1],60)))/2),null));
  const duration=Math.round(totalMinutes(structure)),avg=Math.sqrt(structure.reduce((sum,s)=>sum+n(s.durationMinutes,0)*Math.pow(n(s.power,60)/100,2),0)/Math.max(duration,1)),system=inferSystem(item);
  const title=String(item.title||item.workoutName||item.name||"TrainerDay workout").trim(),key=String(item.id||item.workoutId||item.workout_id||hash(JSON.stringify(segments)));
  return workout({id:"trainerday-"+slug(key),name:title,sourceName:"TrainerDay public API",sourceKind:"trainerday_public_api",sourceUrl:item.url||item.shareUrl||"https://trainerday.com",licenseNote:"Imported through TrainerDay public workout API for approved applications.",attribution:"TrainerDay public community workout",primarySystem:system,difficulty:clamp(2+workingMinutes(structure)/(system==="vo2max"?8:system==="threshold"?15:30)+(avg-.7)*4,1,10),ifactor:clamp(avg,.45,1.2),structure,tags:["trainerday","public",system],description:String(item.description||"TrainerDay public workout"),popularity:n(item.popularity,0),verified:1});
}
export async function importTrainerDayPublicWorkouts(env,db,query={}){
  if(!env.TRAINERDAY_PUBLIC_API_KEY) return {status:"unavailable",message:"Chybí TRAINERDAY_PUBLIC_API_KEY. Veřejný TrainerDay API klíč je potřeba vyžádat/správně nastavit před importem.",imported:0};
  const headers={Accept:"application/json","x-api-key":String(env.TRAINERDAY_PUBLIC_API_KEY)},maxPages=clamp(n(query.maxPages,1),1,20);
  await ensureWorkoutLibrary(db);let imported=0,received=0,pages=0,lastUrl=null;
  for(let page=0;page<maxPages;page++){
    const url=buildTrainerDayQuery({...query,pageIndex:n(query.pageIndex,0)+page});lastUrl=url;
    const response=await fetch(url,{headers}),data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error("TrainerDay API HTTP "+response.status);
    const list=Array.isArray(data)?data:Array.isArray(data?.workouts)?data.workouts:[];
    received+=list.length;pages++;
    for(const item of list){const w=normalizeTrainerDayWorkout(item);if(!w)continue;await upsertWorkout(db,w);imported++}
    if(!list.length||list.length<25)break;
  }
  return {status:"ok",imported,received,pages,query,lastUrl,rateLimitNote:"Import je omezen na maximálně 20 stran na jeden požadavek, aby respektoval veřejný TrainerDay API limit."};
}
async function upsertWorkout(db,w){
  const sql=`INSERT INTO workout_library(id,name,source_name,source_kind,source_url,license_note,attribution,external_id,primary_system,secondary_system,duration_minutes,work_minutes,difficulty,intensity_factor,target_load,cadence,description,intervals_description,tags_json,structure_json,verified,popularity,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name,source_url=excluded.source_url,primary_system=excluded.primary_system,duration_minutes=excluded.duration_minutes,work_minutes=excluded.work_minutes,difficulty=excluded.difficulty,intensity_factor=excluded.intensity_factor,target_load=excluded.target_load,description=excluded.description,intervals_description=excluded.intervals_description,tags_json=excluded.tags_json,structure_json=excluded.structure_json,popularity=excluded.popularity,updated_at=excluded.updated_at`;
  await db.prepare(sql).bind(w.id,w.name,w.source_name,w.source_kind,w.source_url,w.license_note,w.attribution,w.external_id,w.primary_system,w.secondary_system,w.duration_minutes,w.work_minutes,w.difficulty,w.intensity_factor,w.target_load,w.cadence,w.description,w.intervals_description,w.tags_json,w.structure_json,w.verified,w.popularity,now()).run();
}
export {SYSTEMS};
