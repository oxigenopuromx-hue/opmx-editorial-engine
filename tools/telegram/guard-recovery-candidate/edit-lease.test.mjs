import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createTelegramPackageStore,PACKAGE_LIMITS} from './package-store.mjs';
const k=id=>createHash('sha256').update(`opmx:telegram:v1:${id}:${id}`).digest('hex');
const packageId='tg_'+'a'.repeat(40);
function fixture({actor='456',session=true,itemCount=2,usedBytes=0,totalBytes=0}={}){
  const calls=[];
  const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql,args=[]){
    calls.push({sql,args});
    if(sql.startsWith('CREATE TABLE')||sql.startsWith('INSERT IGNORE'))return [[]];
    if(sql.includes('SELECT used_bytes,package_count'))return [[{used_bytes:totalBytes,package_count:1}]];
    if(sql.includes('SELECT actor_key,owner_key FROM opmx_tg_recovery_leases'))return [[{actor_key:k('456'),owner_key:k('123')}]];
    if(sql.startsWith('SELECT * FROM opmx_tg_packages'))return [args[1]===k('123')?[{package_id:packageId,owner_key:k('123'),state:'OPEN',revision:8,item_count:itemCount,used_bytes:usedBytes}]:[]];
    if(sql.startsWith('SELECT package_id FROM opmx_tg_sessions'))return [session?[{package_id:packageId}]:[]];
    if(sql.startsWith('SELECT item_id,package_id,fingerprint'))return [[]];
    if(sql.startsWith('SELECT COUNT(*) AS total'))return [[{total:1,pending:0,stored:1}]];
    if(sql.startsWith('INSERT')||sql.startsWith('UPDATE')||sql.startsWith('DELETE'))return [{affectedRows:1}];
    throw Error('unexpected query '+sql);
  }};
  const events=[];const store=createTelegramPackageStore({async getConnection(){return c}},{recoveryEnabled:true,adminUserIds:['456'],events:{async initialize(){},async enqueue(_c,e){events.push(e)}}});
  const base={owner:actor,chat:actor,packageId};return {calls,events,store,base};
}
test('admin content retains package owner and records contribution',async()=>{const {calls,store,base}=fixture();const r=await store.run('reserve',{...base,receiptId:'telegram-456-1-2',kind:'TEXT',text:'material',attachment:null});assert.equal(r.status,'STORED');const item=calls.find(c=>c.sql.startsWith('INSERT INTO opmx_tg_items'));assert.equal(item.args[2],k('123'));const contribution=calls.find(c=>c.sql.startsWith('INSERT INTO opmx_tg_recovery_contributions'));assert.equal(contribution.args[2],k('456'));});
test('owner cannot edit while administrator holds the lease',async()=>{const {store,base}=fixture({actor:'123'});const r=await store.run('reserve',{...base,receiptId:'telegram-123-1-2',kind:'TEXT',text:'material',attachment:null});assert.equal(r.status,'PACKAGE_IN_USE');});
test('administrator must still have the linked session',async()=>{const {store,base}=fixture({session:false});const r=await store.run('seal',base);assert.equal(r.status,'NO_EDIT_SESSION');});
test('admin seal frees only its session and preserves original event owner',async()=>{const {calls,store,base,events}=fixture();const r=await store.run('seal',base);assert.equal(r.status,'READY');assert.equal(events[0].owner,k('123'));const del=calls.find(c=>c.sql.startsWith('DELETE FROM opmx_tg_sessions'));assert.equal(del.args[0],k('456'));assert.ok(calls.some(c=>c.sql.startsWith('DELETE FROM opmx_tg_recovery_leases')));});
test('reopened full package accepts new material without deleting originals',async()=>{const {store,base}=fixture({itemCount:20});const r=await store.run('reserve',{...base,receiptId:'telegram-456-1-2',kind:'TEXT',text:'aclaración nueva',attachment:null});assert.equal(r.status,'STORED');});
test('the last recovery slot is reserved for the attested closing message',async()=>{
  const {store,base}=fixture({itemCount:39});const text='OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n/listo\n'+JSON.stringify({policy:'publish-todos-v2',package_id:packageId,message_id:1});
  const make=t=>({...base,receiptId:'telegram-456-1-2',kind:'TEXT',text:t,attachment:null});
  assert.equal((await store.run('reserve',make('otro elemento'))).status,'QUOTA_EXCEEDED');
  assert.equal((await store.run('reserve',make(text))).status,'STORED');
  assert.equal((await store.run('reserve',make(text.replace('"message_id":1','"message_id":2')))).status,'QUOTA_EXCEEDED');
});
test('a verified close can use its bounded reserve when byte quotas are full',async()=>{
  const {store,base,calls}=fixture({itemCount:39,usedBytes:PACKAGE_LIMITS.packageBytes,totalBytes:PACKAGE_LIMITS.totalBytes});
  const text='OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n/listo\n'+JSON.stringify({policy:'publish-todos-v2',package_id:packageId,message_id:1});
  const make=t=>({...base,receiptId:'telegram-456-1-2',kind:'TEXT',text:t,attachment:null});
  assert.equal((await store.run('reserve',make('texto normal'))).status,'QUOTA_EXCEEDED');
  assert.equal((await store.run('reserve',make(text))).status,'STORED');
  const accounted=calls.find(c=>c.sql.startsWith('UPDATE opmx_tg_quota_v1 SET used_bytes=used_bytes+'));
  assert.equal(accounted.args[0],Buffer.byteLength(text));
});
