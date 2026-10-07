import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdaptiveDecision } from '../src/adaptive-engine.js';
import { generateStrengthPlan } from '../src/strength-generator.js';
import { recoveryReadiness, mergeWellnessRows } from '../src/recovery-model.js';

const date='2026-10-08';
const day=o=>new Date(Date.parse(date+'T12:00:00Z')+o*86400000).toISOString().slice(0,10);
const series=today=>[...Array.from({length:30},(_,i)=>({id:day(-30+i),hrv:70+(i%4)*2,restingHR:50+(i%2)})),{id:date,...today}];
const context=today=>({date,wellnessSeries:series(today),recovery:{sleep_duration_minutes:[{sampleTime:date+'T06:30:00',value:470}]},cycling:{recentRideTss:300,recentRideHours:5,recentActivities:[],plannedWorkouts:[]}});

test('the coach uses the same recovery score as the dashboard',()=>{
  const ctx=context({hrv:73,restingHR:50});
  const d=buildAdaptiveDecision(ctx);
  const same=recoveryReadiness({rows:ctx.wellnessSeries,date,night:{date,durationMin:470}});
  assert.equal(d.recovery.model,'shared');assert.equal(d.recovery.score,same.score);
  assert.ok(buildAdaptiveDecision(context({hrv:45,restingHR:60})).recovery.score<same.score);
});
test('without a personal baseline the coach falls back to the older rules',()=>{
  assert.equal(buildAdaptiveDecision({date,wellnessSeries:[],recovery:{},cycling:{}}).recovery.model,'legacy');
});
test('Intervals.icu fills only what Google Health lacks',()=>{
  const rows=mergeWellnessRows([{id:day(0),hrv:60}],[{id:day(0),hrv:90,restingHR:48},{id:day(-1),respiration:14}]);
  assert.deepEqual(rows,[{id:day(-1),respiration:14},{id:day(0),hrv:60,restingHR:48}]);
});
test('deep endurance fatigue (TSB) protects the legs instead of a load ratio',()=>{
  const base={date,cycling:{recentRideTss:200,recentRideHours:4,plannedWorkouts:[],recentActivities:[{date:day(-3),type:'Ride',name:'Endurance',tss:60,durationHours:1.5,ctl:60,atl:90}]},recovery:{},strength:{recentCompletedSets:[]}};
  const tired=generateStrengthPlan(base,{maxExercises:8});
  base.cycling.recentActivities[0].atl=62;
  const fresh=generateStrengthPlan(base,{maxExercises:8});
  assert.match(JSON.stringify(tired),/forma TSB -30/);
  assert.doesNotMatch(JSON.stringify(fresh),/forma TSB/);
});

test('a falling 7-day HRV before the week makes it a recovery week for everything',async()=>{
  const { hrvWeekTrendDown, recoveryWeek } = await import('../src/week-planner.js');
  const monday='2026-10-05',d=o=>new Date(Date.parse(monday+'T12:00:00Z')+o*86400000).toISOString().slice(0,10);
  const rows=Array.from({length:60},(_,i)=>({id:d(-67+i),hrv:70+(i%5)}));
  assert.equal(hrvWeekTrendDown([...rows,...Array.from({length:7},(_,i)=>({id:d(-7+i),hrv:72}))],monday),false);
  assert.equal(hrvWeekTrendDown([...rows,...Array.from({length:7},(_,i)=>({id:d(-7+i),hrv:60}))],monday),true);
  assert.equal(hrvWeekTrendDown([...rows,...Array.from({length:3},(_,i)=>({id:d(-3+i),hrv:50}))],monday),false);
  assert.deepEqual(recoveryWeek({base:500,weekLoads:[400],hrvDown:true}),{recovery:true,reason:'hrv_trend'});
  assert.deepEqual(recoveryWeek({base:500,weekLoads:[400]}),{recovery:false,reason:null});
});
