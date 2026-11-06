import test from 'node:test';
import assert from 'node:assert/strict';
import {createTelegramPackageStore} from './package-store.mjs';

async function exercise(state) {
  const changes=[];
  const connection={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql,args=[]){
    if(sql.startsWith('CREATE TABLE')||sql.startsWith('INSERT IGNORE'))return [[]];
    if(sql.includes('SELECT used_bytes,package_count'))return [[{used_bytes:1,package_count:1}]];
    if(sql.startsWith('SELECT * FROM opmx_tg_packages'))return [[{package_id:args[0],state,revision:25,item_count:1}]];
    if(sql.startsWith('SELECT COUNT(*) AS total'))return [[{total:1,pending:0,stored:1}]];
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
