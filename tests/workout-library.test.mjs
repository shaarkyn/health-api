import test from "node:test";
import assert from "node:assert/strict";
import {
  CURATED_WORKOUTS,
  rankWorkoutCandidates,
  defaultCapabilities,
  calculateCapabilityUpdate,
  buildIntervalsEvent,
  parseWorkoutSearchFilters,
  scheduleWorkoutInIntervals,
  buildTrainerDayQuery,
  normalizeTrainerDayWorkout
} from "../src/workout-library.js";

test("90 minute VO2 search ranks a close duration and capability match first",()=>{
  const caps=defaultCapabilities();caps.vo2max.level=5.8;
  const rows=rankWorkoutCandidates(CURATED_WORKOUTS,{system:"vo2max",durationMinutes:90,durationTolerance:15},{readiness:"green",hardBikeDaysRolling7d:0,phase:"build"},caps);
  assert.ok(rows.length>2);
  assert.equal(rows[0].primary_system,"vo2max");
  assert.ok(Math.abs(rows[0].duration_minutes-90)<=15);
  assert.ok(rows[0].suitability>=rows[1].suitability);
});

test("red readiness strongly penalizes hard sessions",()=>{
  const caps=defaultCapabilities();caps.vo2max.level=7;
  const green=rankWorkoutCandidates(CURATED_WORKOUTS,{system:"vo2max",durationMinutes:90},{readiness:"green",hardBikeDaysRolling7d:0},caps)[0];
  const red=rankWorkoutCandidates(CURATED_WORKOUTS,{system:"vo2max",durationMinutes:90},{readiness:"red",hardBikeDaysRolling7d:0},caps)[0];
  assert.ok(green.suitability>red.suitability);
});

test("duration tolerance and maximum difficulty are hard filters",()=>{
  const rows=rankWorkoutCandidates(CURATED_WORKOUTS,{system:"vo2max",durationMinutes:90,durationTolerance:5,maxDifficulty:6},{readiness:"green"});
  assert.ok(rows.length>0);
  assert.ok(rows.every(w=>Math.abs(w.duration_minutes-90)<=5&&w.difficulty<=6));
});

test("empty optional search fields do not become zero",()=>{
  const filters=parseWorkoutSearchFilters(new URLSearchParams("system=vo2max&load=&maxDifficulty=&duration="));
  assert.equal(filters.targetLoad,undefined);
  assert.equal(filters.maxDifficulty,undefined);
  assert.equal(filters.durationMinutes,undefined);
});

test("successful feedback progresses capability and failed execution reduces it",()=>{
  const w=CURATED_WORKOUTS.find(x=>x.primary_system==="threshold"&&x.difficulty>5);
  const current={level:5,confidence:.4,attempts:4,successes:3};
  const success=calculateCapabilityUpdate(current,w,{completedPercent:100,rpe:7.5,survey:"completed"});
  const failed=calculateCapabilityUpdate(current,w,{completedPercent:60,rpe:10,survey:"failed"});
  assert.ok(success.level>current.level);
  assert.ok(failed.level<current.level);
  assert.equal(success.attempts,5);
});

test("automatic activity matching does not claim interval completion",()=>{
  const current={level:5,confidence:.4,attempts:4,successes:3};
  const result=calculateCapabilityUpdate(current,{difficulty:6},{completedPercent:100,survey:"auto_completed"});
  assert.equal(result.level,5);
  assert.equal(result.attempts,4);
});

test("Intervals event is deterministic and carries structured workout",()=>{
  const w=CURATED_WORKOUTS.find(x=>x.id==="pfd-vo2-5x4-90");
  const event=buildIntervalsEvent(w,"2026-10-03");
  assert.equal(event.external_id,"pfd-library:pfd-vo2-5x4-90:2026-10-03");
  assert.equal(event.category,"WORKOUT");
  assert.equal(event.type,"Ride");
  assert.match(event.description,/Main Set/);
  assert.ok(event.load_target>0);
});

test("TrainerDay query uses official public workout filters",()=>{
  const url=new URL(buildTrainerDayQuery({system:"vo2max",durationMinutes:90,durationTolerance:10,pageIndex:2}));
  assert.equal(url.origin,"https://api.trainerday.com");
  assert.equal(url.pathname,"/api/v1/workouts/find");
  assert.equal(url.searchParams.get("dominantZone"),"vo2max");
  assert.equal(url.searchParams.get("fromMinutes"),"80");
  assert.equal(url.searchParams.get("toMinutes"),"100");
  assert.equal(url.searchParams.get("pageIndex"),"2");
});

test("TrainerDay segment arrays normalize into our common schema",()=>{
  const w=normalizeTrainerDayWorkout({id:123,title:"Public VO2",dominantZone:"vo2max",segments:[[10,55,55],[4,115,115],[4,50,50],[4,115,115],[10,50,50]],popularity:20});
  assert.ok(w);
  assert.equal(w.id,"trainerday-123");
  assert.equal(w.primary_system,"vo2max");
  assert.equal(w.source_kind,"trainerday_public_api");
  assert.match(w.intervals_description,/115%/);
});

test("repeated scheduling does not create a second Intervals event",async()=>{
  const workout=CURATED_WORKOUTS.find(w=>w.id==="pfd-vo2-5x4-90"),links=new Map();
  const db={prepare(sql){let args=[];return {
    bind(...values){args=values;return this},
    async first(){
      if(sql.includes("FROM workout_library_meta"))return {value:"2026-09-29-v1"};
      if(sql.includes("FROM workout_library WHERE id="))return args[0]===workout.id?workout:null;
      if(sql.includes("FROM workout_schedule_links WHERE intervals_external_id="))return links.get(args[0])||null;
      return null;
    },
    async run(){if(sql.includes("INSERT INTO workout_schedule_links"))links.set(args[2],{intervals_event_id:args[3],status:args[4]});return {success:true}}
  }}};
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify([{id:123,category:"WORKOUT",type:"Ride"}]),{status:200,headers:{"Content-Type":"application/json"}})};
  try{
    const env={INTERVALS_API_KEY:"test-key"},args={workoutId:workout.id,date:"2026-10-03",confirm:true};
    assert.equal((await scheduleWorkoutInIntervals(env,db,args)).status,"ok");
    assert.equal((await scheduleWorkoutInIntervals(env,db,args)).status,"already_scheduled");
    assert.equal(calls,1);
  }finally{globalThis.fetch=original}
});
