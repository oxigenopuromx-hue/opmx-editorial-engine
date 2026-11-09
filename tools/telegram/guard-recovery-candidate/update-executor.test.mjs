import test from 'node:test';
import assert from 'node:assert/strict';
import {createUpdateExecutor} from './update-executor.mjs';
const packageId='tg_'+'a'.repeat(40),revision=12,previewHash='b'.repeat(64),destination='OPURO',postId=123,slug='nota-existente';
const input={packageId,revision,previewHash,destination};
function fixture(){
 const state={decision:{packageId,revision,previewHash,action:'UPDATE',posts:[{destination,postId}]},payload:{packageId,revision,destination,previewHash,postId,slug,exactPayload:true,payload:{title:'Título corregido',content:'<p>Texto aprobado</p>',meta:{subtitulo:'Dato'}}},before:{id:postId,type:'post',slug,status:'publish'},after:{id:postId,type:'post',slug,status:'publish',title:{raw:'Título corregido'},content:{raw:'<p>Texto aprobado</p>'},meta:{subtitulo:'Dato',otro:'conservado'}},claim:null,writes:0,reads:0,timeout:false};
 const claimStore={async begin(x){if(state.claim)return {status:'ALREADY_STARTED'};state.claim=x;return {status:'UPDATE_STARTED',packageId,revision,destination,postId,operationId:x.operationId}}};
 const wordpress={async read(){state.reads++;return {statusCode:200,post:state.reads===1?state.before:state.after}},async update(x){state.writes++;assert.equal(x.postId,postId);assert.equal(Object.isFrozen(x.payload),true);if(state.timeout)throw Error('network lost');return {statusCode:200,post:{id:postId}}}};
 const executor=createUpdateExecutor({loadDecision:async()=>state.decision,loadPayload:async()=>state.payload,claimStore,wordpress});return {state,executor,wordpress};
}
test('updates the confirmed ID once and separates CMS confirmation from visibility and Telegram',async()=>{
 const f=fixture(),result=await f.executor.execute(input);assert.equal(result.status,'CMS_UPDATE_CONFIRMED');assert.equal(result.postId,postId);assert.equal(result.wordpressConfirmation,'CONFIRMED');assert.equal(result.publicVisibility,'NOT_CHECKED');assert.equal(result.telegramAck,'NOT_CHECKED');assert.equal(f.state.writes,1);
 f.state.reads=0;assert.equal((await f.executor.execute(input)).status,'CLAIM_UNCONFIRMED');assert.equal(f.state.writes,1);
});
test('no update occurs without an exact decision and matching server-owned payload',async()=>{
 for(const change of [s=>s.decision.action='CREATE',s=>s.decision.previewHash='c'.repeat(64),s=>s.decision.posts[0].postId=999,s=>s.payload.exactPayload=false,s=>s.payload.slug='invalid slug',s=>s.payload.payload.slug='other',s=>s.payload.payload.status='draft']){
  const f=fixture();change(f.state);assert.notEqual((await f.executor.execute(input)).status,'CMS_UPDATE_CONFIRMED');assert.equal(f.state.writes,0);assert.equal(f.state.claim,null);
 }
});
test('404, trash or mismatched CMS identity cannot authorize an update',async()=>{
 for(const change of [s=>s.before.id=999,s=>s.before.slug='other',s=>s.before.status='trash',s=>s.before.type='page']){const f=fixture();change(f.state);assert.equal((await f.executor.execute(input)).status,'CMS_PREFLIGHT_UNCONFIRMED');assert.equal(f.state.writes,0)}
 const f=fixture();f.wordpress.read=async()=>({statusCode:404});assert.equal((await f.executor.execute(input)).status,'CMS_PREFLIGHT_UNCONFIRMED');assert.equal(f.state.writes,0);
});
test('a lost write or mismatched readback is uncertain and cannot be retried',async()=>{
 for(const change of [s=>s.timeout=true,s=>s.after.content.raw='different',s=>s.after.status='draft']){const f=fixture();change(f.state);const result=await f.executor.execute(input);assert.equal(result.status,'UPDATE_UNCERTAIN');assert.equal(result.retryPermitted,false);assert.equal(f.state.writes,1);f.state.reads=0;assert.equal((await f.executor.execute(input)).status,'CLAIM_UNCONFIRMED');assert.equal(f.state.writes,1)}
});
test('caller cannot supply a post ID, content, or alternate WordPress URL',async()=>{
 const f=fixture();for(const extra of [{postId:123},{payload:{}},{url:'https://example.org'}])await assert.rejects(()=>f.executor.execute({...input,...extra}),/INVALID_UPDATE_REQUEST/);assert.equal(f.state.writes,0);
});
