import test from 'node:test';
import assert from 'node:assert/strict';
import {createMcpPreviewEventStore,previewEvent} from './preview-event-store.mjs';
import {createPreviewGenerationDispatcher} from './preview-generation-outbox.mjs';
const id='tg_'+'a'.repeat(40),owner='b'.repeat(64),job='c'.repeat(64),sub='sub_'+'d'.repeat(48);
const delivery={subscriptionCipher:()=>({}),validateCallbackUrl:x=>new URL(x),webhookSigningKey:()=>Buffer.alloc(32),verifyEventCallback:async()=>{},signedCallbackPost:async()=>({status:200}),safeCallbackPost:async()=>({status:200})};
function fixture({available=true,changed=false}={}){
 let commits=0,rollbacks=0,inserted=[];
 const c={async beginTransaction(){},async commit(){commits++},async rollback(){rollbacks++},release(){},async execute(sql,args=[]){
  if(sql.startsWith('CREATE TABLE'))return [{}];
  if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];
  if(sql.startsWith('SELECT package_id,revision,base_revision,owner_key'))return [[{package_id:id,revision:9,base_revision:7,owner_key:owner,actor_key:'e'.repeat(64),destination:'OPURO'}]];
  if(sql.startsWith('SELECT owner_key,state,revision'))return [[{owner_key:owner,state:changed?'READY':'OPEN',revision:9}]];
  if(sql.startsWith('SELECT owner_key,actor_key,opening_revision'))return [[{owner_key:owner,actor_key:'e'.repeat(64),opening_revision:8}]];
  if(sql.startsWith('SELECT package_id FROM opmx_tg_sessions'))return [[{package_id:id}]];
  if(sql.startsWith('SELECT COUNT(*) count FROM opmx_tg_items'))return [[{count:3}]];
  if(sql.startsWith('INSERT IGNORE INTO opmx_tg_preview_events')){inserted.push({sql,args});return [{affectedRows:1}]}
  if(sql.startsWith('INSERT IGNORE INTO opmx_tg_preview_deliveries')){inserted.push({sql,args});return [{affectedRows:available?1:0}]}
  throw Error(sql);
 }};
 const store=createMcpPreviewEventStore({pool:{async getConnection(){return c}},guardSecret:'f'.repeat(64),delivery,allowedSubscriptionId:sub,readSelection:async()=>({packageId:id,revision:9,ownerKey:owner,action:'UPDATE',destination:'OPURO'}),now:()=>0});
 return {store,get commits(){return commits},get rollbacks(){return rollbacks},inserted};
}
const event={name:'opmx.package.preview',data:{queue_id:'telegram-editorial',package_id:id,revision:9,state:'OPEN'}};
test('preview event has distinct OPEN semantics and stable identity',()=>{const e=previewEvent(owner,id,9,3,'2026-11-10T00:00:00Z');assert.equal(e.name,'opmx.package.preview');assert.equal(e.data.state,'OPEN');assert.equal(e.data.item_count,3);assert.match(e.eventId,/^evt_[a-f0-9]{48}$/)});
test('queues only for the configured authenticated subscription while the package remains open',async()=>{const f=fixture();assert.deepEqual(await f.store.acceptJob(event,{ownerKey:owner,jobId:job}),{accepted:true});assert.equal(f.commits,1);assert.equal(f.inserted.length,2);assert.equal(f.inserted[1].args.at(-1),sub)});
test('missing subscription or a changed revision rolls back without a callback',async()=>{for(const opt of [{available:false},{changed:true}]){const f=fixture(opt);await assert.rejects(()=>f.store.acceptJob(event,{ownerKey:owner,jobId:job}),/PREVIEW_SUBSCRIBER_UNAVAILABLE|STALE_PREVIEW_JOB/);assert.equal(f.rollbacks,1);assert.equal(f.commits,0)}});
test('a missing delivery implementation cannot be installed',()=>{assert.throws(()=>createMcpPreviewEventStore({pool:{},guardSecret:'x'}),/PREVIEW_EVENT_DELIVERY_INCOMPLETE/);assert.throws(()=>createPreviewGenerationDispatcher({pool:{getConnection(){}},deliver:null}),/PREVIEW_DISPATCH_CONFIGURATION_INCOMPLETE/)});
