import test from 'node:test';
import assert from 'node:assert/strict';
import {createTelegramPackageStore, PACKAGE_LIMITS} from './package-store.mjs';

async function exercise(state, {quota={used_bytes:1,package_count:1}, counts={total:1,pending:0,stored:1}}={}) {
  const changes=[];
  const connection={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql,args=[]){
    if(sql.startsWith('CREATE TABLE')||sql.startsWith('INSERT IGNORE'))return [[]];
    if(sql.includes('SELECT used_bytes,package_count'))return [[quota]];
    if(sql.startsWith('SELECT * FROM opmx_tg_packages'))return [[{package_id:args[0],state,revision:25,item_count:1}]];
    if(sql.startsWith('SELECT COUNT(*) AS total'))return [[counts]];
    if(sql.startsWith('UPDATE opmx_tg_packages')||sql.startsWith('DELETE FROM opmx_tg_sessions')){changes.push(sql);return [{affectedRows:1}];}
    throw Error('Unexpected query: '+sql);
  }};
  const events={async initialize(){},async enqueue(_c,event){changes.push(event);}};
  const store=createTelegramPackageStore({async getConnection(){return connection;}},{events});
  const result=await store.run('seal',{owner:'123',chat:'123',packageId:'tg_'+'a'.repeat(40)});
  return {result,changes};
}
test('cancelled package cannot be sealed or enqueue an event',async()=>{
  const {result,changes}=await exercise('CANCELLED');assert.equal(result.status,'PACKAGE_CLOSED');assert.deepEqual(changes,[]);
});
test('open package can still be sealed once',async()=>{
  const {result,changes}=await exercise('OPEN');assert.equal(result.status,'READY');assert.equal(result.revision,26);assert.equal(changes.filter(x=>typeof x==='object').length,1);
});
test('READY replay produces no new event',async()=>{
  const {result,changes}=await exercise('READY');assert.equal(result.revision,25);assert.deepEqual(changes,[]);
});
test('a full storage quota does not prevent closing a complete package',async()=>{
  const {result,changes}=await exercise('OPEN',{quota:{used_bytes:PACKAGE_LIMITS.totalBytes,package_count:PACKAGE_LIMITS.packages},counts:{total:PACKAGE_LIMITS.items,pending:0,stored:PACKAGE_LIMITS.items}});
  assert.equal(result.status,'READY');assert.equal(changes.filter(x=>typeof x==='object').length,1);
});
test('a pending attachment prevents closing and does not enqueue an event',async()=>{
  const {result,changes}=await exercise('OPEN',{counts:{total:2,pending:1,stored:1}});
  assert.equal(result.status,'NOT_READY');assert.equal(result.pending,1);assert.deepEqual(changes,[]);
});
