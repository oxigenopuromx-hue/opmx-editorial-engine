import test from 'node:test';
import assert from 'node:assert/strict';
import {createTelegramPackageStore} from './package-store.mjs';
const id='tg_'+'a'.repeat(40),request={owner:'123',chat:'123',packageId:id};
function fixture({hasClosure=true,provider,decisionReader=async()=>null}={}){
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
 const store=createTelegramPackageStore({async getConnection(){return c}},{recoveryEnabled:true,readRecoveredPolicy:provider?async(...args)=>{assert.equal(inTransaction,true);return provider(...args)}:null,readConfirmedCorrection:provider&&decisionReader?async(...args)=>{assert.equal(inTransaction,true);return decisionReader(...args)}:null});return {store,c};
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
test('a recovered package cannot fall back to its old policy if the decision reader is missing',async()=>{
 const policy={mode:'PUBLISH',authorized:true,destination:'OPURO',control_item_ids:['ti_'+'b'.repeat(40)]};
 const {store}=fixture({provider:()=>policy,decisionReader:null});assert.equal((await store.run('manifest',request)).status,'RECOVERY_POLICY_UNCONFIRMED');
});
test('the confirmed decision is returned only from the server reader in the same transaction',async()=>{
 const policy={mode:'PUBLISH',authorized:true,destination:'OPURO',control_item_ids:['ti_'+'b'.repeat(40)]};
 const decision={package_id:id,revision:9,action:'CREATE',destination:'LIBERAL',content_mode:'LITERAL',preview_hash:'c'.repeat(64)};
 const {store,c}=fixture({provider:()=>policy,decisionReader:(conn,pkg,rev)=>{assert.equal(conn,c);assert.equal(pkg,id);assert.equal(rev,9);return decision}});
 assert.deepEqual((await store.run('manifest',request)).confirmedCorrection,decision);
});
