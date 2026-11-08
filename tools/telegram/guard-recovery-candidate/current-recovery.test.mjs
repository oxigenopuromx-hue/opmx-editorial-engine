import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createTelegramPackageStore} from './package-store.mjs';
const ownerKey=createHash('sha256').update('opmx:telegram:v1:123:123').digest('hex'),pkg='tg_'+'a'.repeat(40);
function storeWith(actor=ownerKey,state='OPEN'){
 const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql){
  if(sql.startsWith('CREATE TABLE')||sql.startsWith('INSERT IGNORE'))return [[]];
  if(sql.startsWith('SELECT used_bytes'))return [[{used_bytes:0,package_count:0}]];
  if(sql.startsWith('SELECT package_id FROM opmx_tg_sessions'))return [[{package_id:pkg}]];
  if(sql.startsWith('SELECT p.state,p.revision'))return [[{state,revision:12,actor_key:actor}]];
  throw Error('unexpected '+sql);
 }};return createTelegramPackageStore({async getConnection(){return c}},{recoveryEnabled:true});
}
test('current reports an exact recovery session revision to its editor',async()=>{
 const r=await storeWith().run('current',{owner:'123',chat:'123'});assert.deepEqual(r,{status:'OPEN',packageId:pkg,revision:12,recovery:true});
});
test('a foreign lease or closed package is never exposed as the current session',async()=>{
 for(const s of [storeWith('c'.repeat(64)),storeWith(ownerKey,'READY')])assert.equal((await s.run('current',{owner:'123',chat:'123'})).status,'NO_OPEN_PACKAGE');
});
