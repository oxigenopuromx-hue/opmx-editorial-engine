import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createConfirmedRecoverySeal} from './confirmed-recovery-seal.mjs';
import {buildCorrectionPreview} from './correction-preview.mjs';
const packageId='tg_'+'a'.repeat(40),actorKey='b'.repeat(64),previewHash='c'.repeat(64),eventId='evt_'+'d'.repeat(48);
const preview={packageId,ownerKey:actorKey,actorKey,baseRevision:7,revision:10,action:'CREATE',mode:'LITERAL',destination:'OPURO',previewHash};
const prefix='OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n';
const args={preview,actorKey,previewReceipt:'telegram-123-10-100',confirmationReceipt:'telegram-123-11-101'};
function fixture({fence='RECOVERY_FENCED',consumer=true,closeStored=true,packageOwner=actorKey,updateReady=false}={}){
 const calls=[],connection={async execute(sql,values){calls.push({sql,values});
  if(sql.startsWith('SELECT package_id,owner_key,state'))return [[{package_id:packageId,owner_key:packageOwner,state:'OPEN',revision:10}]];
  if(sql.startsWith('SELECT actor_key,owner_key'))return [[{actor_key:actorKey,owner_key:packageOwner,receipt_id:'telegram-123-1-1',opening_revision:8}]];
  if(sql.startsWith('SELECT package_id FROM opmx_tg_sessions'))return [[{package_id:packageId}]];
  if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence'))return [[{state:fence}]];
  if(sql.startsWith('SELECT i.item_id'))return [closeStored?[{item_id:'ti_'+'e'.repeat(40),kind:'TEXT',text_content:prefix+'/listo\n'+JSON.stringify({policy:'publish-todos-v2',package_id:packageId,message_id:10}),state:'STORED',actor_key:actorKey}]:[]];
  if(sql.startsWith('SELECT item_id FROM opmx_tg_items'))return [[{item_id:'ti_'+'e'.repeat(40)}]];
  if(sql.startsWith('SELECT COUNT(*)'))return [[{pending:0,stored:2}]];
  if(sql.startsWith('INSERT')||sql.startsWith('UPDATE')||sql.startsWith('DELETE'))return [{affectedRows:1}];
  throw Error('unexpected SQL '+sql);
 }};
 const seal=createConfirmedRecoverySeal({events:{async enqueue(c,e){assert.equal(c,connection);calls.push({event:e});return eventId}},initializePublicationFence:async(c,x)=>calls.push({fence:x}),initializeMotorAttempt:async(c,x)=>calls.push({attempt:x}),verifyDecisionConsumer:async()=>consumer,verifyUpdateReadiness:async()=>updateReady});
 return {seal,connection,calls};
}
test('confirmed preview persists its decision and uses the existing transactional seal and event',async()=>{
 const f=fixture();assert.equal(await f.seal(f.connection,args),eventId);
 const decision=f.calls.findIndex(x=>x.sql?.startsWith('INSERT INTO opmx_tg_confirmed_decisions'));
 const closure=f.calls.findIndex(x=>x.sql?.startsWith('INSERT INTO opmx_tg_recovery_closures'));
 const event=f.calls.findIndex(x=>x.event);assert.ok(decision>=0&&closure>decision&&event>closure);assert.equal(f.calls[event].event.revision,11);
});
test('an administrator seals with the original package owner and its own verified lease',async()=>{
 const packageOwner='d'.repeat(64),f=fixture({packageOwner});
 assert.equal(await f.seal(f.connection,{...args,preview:{...preview,ownerKey:packageOwner}}),eventId);
 assert.equal(f.calls.find(x=>x.event).event.owner,packageOwner);
 const wrong=fixture({packageOwner});
 await assert.rejects(()=>wrong.seal(wrong.connection,{...args,preview:{...preview,ownerKey:'e'.repeat(64)}}),/CONFIRMED_SEAL_STALE/);
 assert.equal(wrong.calls.some(x=>x.event),false);
});
test('unverified fence or consumer never seals or enqueues',async()=>{
 for(const options of [{fence:'WRITING'},{consumer:false}]){const f=fixture(options);await assert.rejects(()=>f.seal(f.connection,args));assert.equal(f.calls.some(x=>x.event),false);assert.equal(f.calls.some(x=>x.sql?.startsWith('INSERT INTO opmx_tg_confirmed_decisions')),false)}
});
test('a missing close prevents the event, and published-post updates are not silently supported',async()=>{
 const f=fixture({closeStored:false});await assert.rejects(()=>f.seal(f.connection,args),/CONFIRMED_SEAL_UNCONFIRMED/);assert.equal(f.calls.some(x=>x.event),false);
 const g=fixture();await assert.rejects(()=>g.seal(g.connection,{...args,preview:{...preview,action:'UPDATE'}}),/CONFIRMED_SEAL_UNSUPPORTED/);assert.equal(g.calls.length,0);
});
test('a valid update decision cannot enqueue until the server verifies update readiness',async()=>{
 const text='Texto',item={itemId:'ti_'+'1'.repeat(40),kind:'TEXT',state:'STORED',text,sha256:createHash('sha256').update(text).digest('hex')};
 const update=buildCorrectionPreview({packageId,revision:10,baseRevision:7,ownerKey:actorKey,actorKey,before:[item],after:[item],action:'UPDATE',mode:'EDITORIAL',destination:'OPURO',verifiedPosts:{OPURO:123}});
 const f=fixture();await assert.rejects(()=>f.seal(f.connection,{...args,preview:update}),/CONFIRMED_SEAL_UPDATE_UNCONFIRMED/);assert.equal(f.calls.some(x=>x.event),false);
 const g=fixture({updateReady:true});assert.equal(await g.seal(g.connection,{...args,preview:update}),eventId);
});
