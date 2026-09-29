import test from 'node:test';
import assert from 'node:assert/strict';
import {updateFoodEntry,copyFoodEntry,deleteFoodEntry} from '../src/food-entry-management.js';

function memoryDb(){
  const rows=new Map([[7,{id:7,consumed_date:'2026-09-28',consumed_at:'2026-09-28T12:30:00.000Z',cookbook_page:70,recipe_title:'Oběd',servings:1,kcal:550,protein_g:35,carbs_g:60,fat_g:18,fiber_g:5,source:'cookbook',note:JSON.stringify({mealType:'lunch',ingredients:[{name:'Rýže',amount:100,unit:'g'}]})}]]);
  let nextId=8;
  return {rows,prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return rows.get(args[0])||null},async run(){
    if(sql.startsWith('UPDATE')){const [date,consumed_at,name,kcal,protein_g,carbs_g,fat_g,note,id]=args;rows.set(id,{...rows.get(id),consumed_date:date,consumed_at,recipe_title:name,kcal,protein_g,carbs_g,fat_g,note});return {meta:{changes:1}}}
    if(sql.startsWith('INSERT')){const id=nextId++;const [consumed_date,consumed_at,cookbook_page,recipe_title,servings,kcal,protein_g,carbs_g,fat_g,fiber_g,source,note]=args;rows.set(id,{id,consumed_date,consumed_at,cookbook_page,recipe_title,servings,kcal,protein_g,carbs_g,fat_g,fiber_g,source,note});return {meta:{last_row_id:id,changes:1}}}
    if(sql.startsWith('DELETE')){rows.delete(args[0]);return {meta:{changes:1}}}
    throw new Error('Unexpected SQL');
  }}}};
}

test('editing food preserves recipe and ingredient provenance while moving its date and meal',async()=>{
  const db=memoryDb();
  await updateFoodEntry(db,7,{date:'2026-09-29',mealType:'dinner',name:'Večeře',kcal:575,protein_g:37,carbs_g:62,fat_g:18});
  const row=db.rows.get(7);
  assert.equal(row.consumed_date,'2026-09-29');
  assert.equal(row.consumed_at,'2026-09-29T12:30:00.000Z');
  assert.equal(row.recipe_title,'Večeře');
  assert.equal(row.kcal,575);
  assert.equal(row.cookbook_page,70);
  assert.equal(JSON.parse(row.note).mealType,'dinner');
  assert.equal(JSON.parse(row.note).ingredients[0].name,'Rýže');
});

test('copy creates a separate dated meal and delete removes only the selected entry',async()=>{
  const db=memoryDb();
  const copy=await copyFoodEntry(db,7,'2026-09-30');
  assert.equal(copy.id,8);
  assert.equal(db.rows.get(8).consumed_date,'2026-09-30');
  assert.equal(db.rows.get(8).kcal,550);
  await deleteFoodEntry(db,7);
  assert.equal(db.rows.has(7),false);
  assert.equal(db.rows.has(8),true);
});

test('food changes reject invalid identifiers, dates, meals and nutrition',async()=>{
  const db=memoryDb();
  await assert.rejects(updateFoodEntry(db,7,{mealType:'night'}),/Neplatný typ/);
  await assert.rejects(updateFoodEntry(db,7,{kcal:-1}),/Zkontroluj energii/);
  await assert.rejects(copyFoodEntry(db,7,'2026-02-30'),/platné datum/);
  await assert.rejects(deleteFoodEntry(db,'7 OR 1=1'),/Neplatné jídlo/);
  assert.equal(db.rows.size,1);
});
