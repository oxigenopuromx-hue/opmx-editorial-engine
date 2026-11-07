import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReopenService} from './reopen-service.mjs';
import {createTelegramPackageStore} from './package-store.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const ownerKey=id=>hash(`opmx:telegram:v1:${id}:${id}`),id='tg_'+'a'.repeat(40);

// In-memory integration fixture: verifies wiring between the recovery service
// and package store, not SQL isolation, production credentials, or Publisher.
test('admin reopens, contributes, and seals once while preserving the owner',async()=>{
 const owner=ownerKey('123'),admin=ownerKey('456'),events=[],contributions=[];
 const state={pkg:{id,ownerKey:owner,state:'READY',revision:7,item_count:1,used_bytes:5},session:null,lease:null,items:[{itemId:'ti_'+'1'.repeat(40),ownerKey:owner,state:'STORED'}],snapshot:null};
 const db={async transaction(fn){return fn({
  async lockQuota(){},async lockPackage(){return state.pkg},async lockSession(){return state.session},async lockLease(){return state.lease},
  async lockSafetyBarrier(){return {packageId:id,revision:7,terminalBlocked:true,noActiveAttempts:true,noPublicationSideEffects:true,writesFenced:true}},
  async lockInventory(){return state.items},async captureTrustedRevision(){return {packageId:id,revision:7,ownerKey:owner,requestId:'original-request',destinations:['OPURO'],authorization:{mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND'},controls:['ti_'+'1'.repeat(40)],results:[{destination:'OPURO',status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}]}},
  async claimRecoveryFence(){return true},async saveSnapshot(x){state.snapshot=structuredClone(x)},
  async markOpen(x){state.pkg.state='OPEN';state.pkg.revision=x.revision},async createLease(x){state.lease={actorKey:x.actorKey,ownerKey:x.ownerKey,receiptId:x.receiptId}},
  async createSession(x){state.session={packageId:x.packageId,actorKey:x.actorKey}},async audit(){}
 });}};
 const open=createReopenService({db,adminUserIds:['456']});
 assert.equal((await open({owner:'456',chat:'456',packageId:id,receiptId:'telegram-456-1-2'})).status,'OPEN');
 assert.equal(state.pkg.ownerKey,owner);assert.equal(state.snapshot.prior.requestId,'original-request');
 const conn={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql,args=[]){
  if(sql.startsWith('CREATE TABLE')||sql.startsWith('INSERT IGNORE'))return [[]];
  if(sql.startsWith('SELECT used_bytes,package_count'))return [[{used_bytes:state.pkg.used_bytes,package_count:1}]];
  if(sql.startsWith('SELECT actor_key,owner_key,receipt_id,opening_revision FROM opmx_tg_recovery_leases'))return [state.lease?[{actor_key:state.lease.actorKey,owner_key:state.lease.ownerKey,receipt_id:state.lease.receiptId,opening_revision:8}]:[]];
  if(sql.startsWith('SELECT * FROM opmx_tg_packages'))return [[{package_id:id,owner_key:owner,state:state.pkg.state,revision:state.pkg.revision,item_count:state.pkg.item_count,used_bytes:state.pkg.used_bytes}]];
  if(sql.startsWith('SELECT package_id FROM opmx_tg_sessions'))return [state.session?[{package_id:state.session.packageId}]:[]];
  if(sql.startsWith('SELECT item_id,package_id,fingerprint'))return [[]];
  if(sql.startsWith('INSERT INTO opmx_tg_items')){state.items.push({itemId:args[0],state:args[6],receiptKey:args[3],kind:args[5],text:args[7]});return [{affectedRows:1}];}
  if(sql.startsWith('INSERT INTO opmx_tg_recovery_closures'))return [{affectedRows:1}];
  if(sql.startsWith('INSERT INTO opmx_tg_recovery_contributions')){contributions.push(args);return [{affectedRows:1}];}
  if(sql.startsWith('UPDATE opmx_tg_packages_v1 SET item_count')){state.pkg.item_count++;state.pkg.used_bytes+=args[0];state.pkg.revision++;return [{affectedRows:1}];}
  if(sql.startsWith('UPDATE opmx_tg_quota_v1'))return [{affectedRows:1}];
  if(sql.startsWith('SELECT i.item_id,i.kind')){const item=state.items.find(i=>i.receiptKey===args[1]);return [item?[{item_id:item.itemId,kind:item.kind,text_content:item.text,state:item.state,actor_key:admin}]:[]];}
  if(sql.startsWith('SELECT item_id FROM opmx_tg_items'))return [[{item_id:state.items.at(-1).itemId}]];
  if(sql.startsWith('SELECT COUNT(*) AS total'))return [[{total:state.items.length,pending:0,stored:state.items.length}]];
  if(sql.startsWith("UPDATE opmx_tg_packages_v1 SET state='READY'")){state.pkg.state='READY';state.pkg.revision++;return [{affectedRows:1}];}
  if(sql.startsWith('DELETE FROM opmx_tg_sessions')){assert.equal(args[0],admin);state.session=null;return [{affectedRows:1}];}
  if(sql.startsWith('DELETE FROM opmx_tg_recovery_leases')){state.lease=null;return [{affectedRows:1}];}
  throw Error('Unexpected query '+sql);
 }};
 const store=createTelegramPackageStore({async getConnection(){return conn}},{recoveryEnabled:true,adminUserIds:['456'],events:{async initialize(){},async enqueue(_c,x){events.push(x)}}});
 let r=await store.run('reserve',{owner:'456',chat:'456',packageId:id,receiptId:'telegram-456-3-4',kind:'TEXT',text:'Nueva aclaración',attachment:null});assert.equal(r.status,'STORED');
 const text='OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n/listo\n'+JSON.stringify({policy:'publish-todos-v2',package_id:id,message_id:4});
 r=await store.run('reserve',{owner:'456',chat:'456',packageId:id,receiptId:'telegram-456-4-5',kind:'TEXT',text,attachment:null});assert.equal(r.status,'STORED');
 r=await store.run('seal',{owner:'456',chat:'456',packageId:id,receiptId:'telegram-456-4-5'});assert.equal(r.status,'READY');assert.equal(events.length,1);assert.equal(events[0].owner,owner);
 assert.equal(state.items.length,3);assert.equal(contributions[0][2],admin);assert.equal(state.session,null);assert.equal(state.lease,null);
 r=await store.run('seal',{owner:'123',chat:'123',packageId:id});assert.equal(r.status,'READY');assert.equal(events.length,1);
});
