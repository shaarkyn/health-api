import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recoveryModelBlock} from '../src/recovery-model-block.js';
import {personalBaseline,sleepNeedMinutes,sleepDebtMinutes,recoveryReadiness,heartRateLoad,strainScore,recoveryComponentScore} from '../src/recovery-model.js';

const day=i=>new Date(Date.UTC(2026,7,1)+i*86400000).toISOString().slice(0,10);
const history=(n,f)=>Array.from({length:n},(_,i)=>({id:day(i),...f(i)}));

test('the dashboard client carries the exact shared model (run scripts/sync-recovery-model.mjs)',()=>{
  const client=readFileSync(new URL('../src/dashboard-client.js',import.meta.url),'utf8');
  assert.ok(client.includes(recoveryModelBlock()));
});
test('baseline excludes today, uses 60 days and needs 14 values',()=>{
  const rows=history(80,i=>({hrv:i<10?20:50}));
  const b=personalBaseline(rows,day(79),'hrv');assert.equal(b.count,60);assert.equal(b.mean,50);
  assert.equal(personalBaseline(rows.slice(0,10),day(10),'hrv').mean,null);
  assert.ok(Math.abs(personalBaseline(rows,day(79),'hrv',{log:true}).mean-Math.log(50))<1e-9);
});
test('sleep need follows NSF ranges by age and rises after a hard day',()=>{
  assert.equal(sleepNeedMinutes({age:30}),480);assert.equal(sleepNeedMinutes({age:70}),450);
  assert.equal(sleepNeedMinutes({age:30,strain:15}),495);assert.equal(sleepNeedMinutes({age:30,strain:19}),510);
});
test('sleep debt accumulates, a long night repays at most an hour',()=>{
  const nights=[0,1,2,3,4,5,6].map(i=>({date:day(i),durationMin:i===6?600:420}));
  assert.deepEqual({...sleepDebtMinutes(nights,day(6),480),average:0},{minutes:300,nights:7,average:0,need:480});
  assert.equal(sleepDebtMinutes([],day(6)),null);
});
test('component score: personal mean 70, −1 SD 50, −2 SD 30',()=>{assert.equal(recoveryComponentScore(0),70);assert.equal(recoveryComponentScore(-1),50);assert.equal(recoveryComponentScore(-2),30);assert.equal(recoveryComponentScore(3),100);});
test('recovery: HRV trend below the smallest worthwhile change and raised breathing are flagged',()=>{
  const rows=history(40,i=>({hrv:60+(i%2?4:-4),restingHR:50+(i%2),respiration:14+(i%2)*0.2}));
  for(let i=34;i<40;i++)rows[i].hrv=50;
  const date=day(40),today={id:date,hrv:52,restingHR:50,respiration:16};
  const r=recoveryReadiness({rows:[...rows,today],date,night:{date,durationMin:480},sleepNeed:480});
  assert.equal(r.components.hrv.trend,'down');assert.ok(r.flags.includes('hrv_trend_down'));
  assert.ok(r.components.respiration.elevated);assert.ok(r.flags.includes('respiration_elevated'));
  const calm=recoveryReadiness({rows:[...rows,{...today,respiration:14.1}],date,night:{date,durationMin:480}});
  assert.equal(calm.score-r.score,10);
});
test('recovery works without sleep, but not on sleep alone',()=>{
  const rows=history(20,i=>({hrv:60+(i%3),restingHR:50}));
  const date=day(20);
  assert.ok(recoveryReadiness({rows:[...rows,{id:date,hrv:61}],date}).score>0);
  assert.equal(recoveryReadiness({rows:[...rows,{id:date}],date,night:{date,durationMin:480}}).score,null);
});
test('heart-rate load weights Google zones as Edwards zones 2–5 and saturates on 0–21',()=>{
  assert.equal(heartRateLoad({light:30,moderate:20,vigorous:10,peak:2}),30*2+20*3+10*4+2*5);
  assert.equal(heartRateLoad({}),null);assert.equal(heartRateLoad(null),null);
  assert.equal(strainScore(180),11.6);assert.ok(strainScore(600)>19&&strainScore(600)<21);assert.equal(strainScore(0),0);
});
