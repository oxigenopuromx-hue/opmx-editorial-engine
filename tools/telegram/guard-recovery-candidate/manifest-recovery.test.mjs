import test from 'node:test';
import assert from 'node:assert/strict';
import {createTelegramPackageStore} from './package-store.mjs';
const id='tg_'+'a'.repeat(40),request={owner:'123',chat:'123',packageId:id};
function fixture({hasClosure=true,provider}={}){
 let inTransaction=false;
 const c={async beginTransaction(){inTransaction=true},async commit(){inTransaction=false},async rollback(){inTransaction=false},release(){},async execute(sql,args=[]){
  if(sql.startsWith('CREATE TABLE')||sql.startsWith('INSERT IGNORE'))return [[]];
  if(sql.startsWith('SELECT used_bytes'))return [[{used_bytes:10,package_count:1}]];
  if(sql.startsWith('SELECT actor_key,owner_key,receipt_id,opening_revision'))return [[]];
  if(sql.startsWith('SELECT * FROM opmx_tg_packages'))return [[{package_id:id,state:'READY',revision:9}]];
  if(sql.startsWith('SELECT item_id,kind,state'))return [[{item_id:'ti_'+'b'.repeat(40),kind:'TEXT',state:'STORED',text_content:'fuente',attachment_json:null,content_bytes:6,sha256:'a'.repeat(64)}]];
  if(sql.startsWith('SELECT package_id FROM opmx_tg_recovery_closures'))return [hasClosure?[{package_id:id}]:[]];
  throw Error(sql);
 }};
 const store=createTelegramPackageStore({async getConnection(){return c}},{recoveryEnabled:true,readRecoveredPolicy:provider?async(...args)=>{assert.equal(inTransaction,true);return provider(...args)}:null});return {store,c};
}
test('manifest contains only server-resolved recovered policy for exact revision',async()=>{
 const policy={mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND',destination:'OPURO,LIBERAL',control_item_ids:['ti_'+'b'.repeat(40)]};
 const {store,c}=fixture({provider:(conn,pkg,rev)=>{assert.equal(conn,c);assert.equal(pkg,id);assert.equal(rev,9);return policy}});
 const result=await store.run('manifest',request);assert.equal(result.status,'FOUND');assert.deepEqual(result.recoveredPolicy,policy);
});
test('recovered manifests fail closed when the trusted policy provider is absent or incomplete',async()=>{
 for(const provider of [null,()=>null,()=>({authorized:false})]){const {store}=fixture({provider});assert.equal((await store.run('manifest',request)).status,'RECOVERY_POLICY_UNCONFIRMED');}
});
test('ordinary manifests remain readable without recovery metadata',async()=>{
 const {store}=fixture({hasClosure:false});const result=await store.run('manifest',request);assert.equal(result.status,'FOUND');assert.equal(result.recoveredPolicy,undefined);
});
