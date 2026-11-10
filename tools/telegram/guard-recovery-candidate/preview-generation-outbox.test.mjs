import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {enqueuePreviewGeneration} from './preview-generation-outbox.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const actorKey=hash('opmx:telegram:v1:123:123');
const x={packageId:'tg_'+'a'.repeat(40),revision:10,baseRevision:7,ownerKey:'b'.repeat(64),actorKey,destination:'AMBOS',receiptId:'telegram-123-12-12'};
function mock(){let saved;return {get saved(){return saved},async execute(sql,args){if(sql.startsWith('INSERT IGNORE')){if(saved)return [{affectedRows:0}];const [job_id,package_id,revision,base_revision,owner_key,actor_key,destination,receipt_hash,receipt_id]=args;saved={job_id,package_id,revision,base_revision,owner_key,actor_key,destination,receipt_hash,receipt_id,state:'PENDING'};return [{affectedRows:1}]}if(sql.startsWith('SELECT job_id'))return [[saved]];throw Error(sql)}}}
test('authenticated preview request queues once without content or publication authority',async()=>{
 const c=mock(),a=await enqueuePreviewGeneration(c,x),b=await enqueuePreviewGeneration(c,x);
 assert.equal(a.status,'PREVIEW_QUEUED');assert.equal(b.status,'PREVIEW_ALREADY_QUEUED');assert.equal(a.jobId,b.jobId);assert.equal(c.saved.state,'PENDING');
});
test('an identity mismatch, changed scope, or uncertain job never grants a replay',async()=>{
 for(const invalid of [{...x,actorKey:'f'.repeat(64)},{...x,destination:'OPOL,OPURO'},{...x,revision:7},{...x,extra:'bad'}])await assert.rejects(()=>enqueuePreviewGeneration(mock(),invalid),/INVALID_PREVIEW_GENERATION_REQUEST/);
 const c=mock();await enqueuePreviewGeneration(c,x);await assert.rejects(()=>enqueuePreviewGeneration(c,{...x,destination:'OPURO'}),/PREVIEW_GENERATION_CONFLICT/);
 c.saved.state='UNCERTAIN';await assert.rejects(()=>enqueuePreviewGeneration(c,x),/PREVIEW_GENERATION_CONFLICT/);
});

test('dispatcher binds the existing Motor event to the open revision and never retries uncertainty',async()=>{
 const {createPreviewGenerationDispatcher}=await import('./preview-generation-outbox.mjs');
 for(const ok of [true,false]){
  let state='PENDING',savedHash=null,events=[];
  const job={job_id:'d'.repeat(64),package_id:x.packageId,revision:x.revision,base_revision:x.baseRevision,owner_key:x.ownerKey,actor_key:x.actorKey,destination:x.destination};
  const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql,args){
   if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];
   if(sql.startsWith('SELECT job_id'))return [state==='PENDING'?[job]:[]];
   if(sql.startsWith('SELECT owner_key,state,revision'))return [[{owner_key:x.ownerKey,state:'OPEN',revision:x.revision}]];
   if(sql.startsWith('SELECT owner_key,actor_key'))return [[{owner_key:x.ownerKey,actor_key:x.actorKey,opening_revision:x.baseRevision+1}]];
   if(sql.startsWith('SELECT package_id FROM opmx_tg_sessions'))return [[{package_id:x.packageId}]];
   if(sql.includes("SET state='DISPATCHING'")){state='DISPATCHING';savedHash=args[0];return [{affectedRows:1}]}
   if(sql.includes('SET state=?')){assert.equal(args[2],savedHash);state=args[0];return [{affectedRows:1}]}
   throw Error(sql);
  }};
  const dispatcher=createPreviewGenerationDispatcher({pool:{async getConnection(){return c}},readSelection:async()=>({packageId:x.packageId,revision:x.revision,ownerKey:x.ownerKey,action:'UPDATE',destination:x.destination}),tokenFactory:()=> 'a'.repeat(64),deliver:async event=>{events.push(event);return {accepted:ok}}});
  const result=await dispatcher.dispatchNext();assert.equal(result.status,ok?'PREVIEW_EVENT_ACCEPTED':'PREVIEW_DELIVERY_UNCERTAIN');assert.equal(result.retryPermitted,false);assert.equal(events.length,1);assert.equal(events[0].data.state,'OPEN');assert.equal(events[0].data.package_id,x.packageId);assert.equal(state,ok?'DISPATCHED':'UNCERTAIN');assert.equal((await dispatcher.dispatchNext()).status,'NO_PREVIEW_REQUEST');
 }
});
