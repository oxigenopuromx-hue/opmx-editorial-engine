import test from 'node:test';
import assert from 'node:assert/strict';
import {createUpdateExecutor} from './update-executor.mjs';
const packageId='tg_'+'a'.repeat(40),revision=12,previewHash='b'.repeat(64),destination='OPURO',postId=123,slug='nota-existente';
const input={packageId,revision,previewHash,destination};
function fixture(){
 const state={decision:{packageId,revision,previewHash,action:'UPDATE',posts:[{destination,postId}]},payload:{packageId,revision,destination,previewHash,postId,slug,exactPayload:true,payload:{title:'Título corregido',content:'<p>Texto aprobado</p>',meta:{subtitulo:'Dato'}}},before:{id:postId,type:'post',slug,status:'publish'},after:{id:postId,type:'post',slug,status:'publish',title:{raw:'Título corregido'},content:{raw:'<p>Texto aprobado</p>'},meta:{subtitulo:'Dato',otro:'conservado'}},claim:null,writes:0,reads:0,timeout:false,placementVerified:false,placementChecks:0};
 const claimStore={async begin(x){if(state.claim)return {status:'ALREADY_STARTED'};state.claim=x;return {status:'UPDATE_STARTED',packageId,revision,destination,postId,operationId:x.operationId}}};
 const wordpress={async read(){state.reads++;return {statusCode:200,post:state.reads===1?state.before:state.after}},async update(x){state.writes++;assert.equal(x.postId,postId);assert.equal(Object.isFrozen(x.payload),true);if(state.timeout)throw Error('network lost');return {statusCode:200,post:{id:postId}}}};
 const executor=createUpdateExecutor({loadDecision:async()=>state.decision,loadPayload:async()=>state.payload,claimStore,wordpress,verifyEditorialPlacement:async x=>{state.placementChecks++;return !Object.hasOwn(x.payload.meta??{},'oxpuro_excluded_category_ids')||state.placementVerified===true}});return {state,executor,wordpress};
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
test('scoped bridge and durable acknowledgement are required when that transport is installed',async()=>{
 const f=fixture();let scoped,receipt;
 f.wordpress.update=async()=>{throw Error('unscoped transport must not run')};
 f.wordpress.updateConfirmed=async x=>{scoped=x;return {statusCode:200,post:{id:postId}}};
 f.wordpress.recordConfirmation=async x=>{receipt=x;return {status:'UPDATE_RECEIPT_RECORDED',operationId:x.operationId}};
 assert.equal((await f.executor.execute(input)).status,'CMS_UPDATE_CONFIRMED');assert.equal(scoped.packageId,packageId);assert.equal(scoped.previewHash,previewHash);assert.equal(scoped.operationId,receipt.operationId);
 const g=fixture();g.wordpress.recordConfirmation=async()=>({status:'UPDATE_DELIVERY_UNCONFIRMED'});
 assert.equal((await g.executor.execute(input)).status,'UPDATE_UNCERTAIN');assert.equal(g.state.writes,1);
});
test('category exclusion UPDATE is checked against authenticated categories before consuming its claim',async()=>{
 for(const ids of [[61],['2'],['61','61']]){const f=fixture();f.state.before.categories=[61];f.state.payload.payload.meta.oxpuro_excluded_category_ids=ids;const result=await f.executor.execute(input);assert.equal(result.status,'PAYLOAD_UNCONFIRMED');assert.equal(f.state.writes,0);assert.equal(f.state.claim,null)}
 const f=fixture();f.state.placementVerified=true;f.state.before.categories=[61];f.state.after.categories=[61];f.state.payload.payload.meta.oxpuro_excluded_category_ids=['61'];f.state.after.meta.oxpuro_excluded_category_ids=['61'];assert.equal((await f.executor.execute(input)).status,'CMS_UPDATE_CONFIRMED');assert.equal(f.state.writes,1);
});
test('unmentioned category exclusions and independent homepage flag must survive UPDATE readback',async()=>{
 for(const key of ['oxpuro_excluded_category_ids','oxpuro_exclude_home']){const f=fixture();f.state.before.meta={oxpuro_excluded_category_ids:['61'],oxpuro_exclude_home:true};f.state.after.meta={...f.state.after.meta,...f.state.before.meta};delete f.state.after.meta[key];const result=await f.executor.execute(input);assert.equal(result.status,'UPDATE_UNCERTAIN');assert.equal(result.retryPermitted,false);assert.equal(f.state.writes,1)}
 const f=fixture();f.state.before.meta={oxpuro_excluded_category_ids:['61'],oxpuro_exclude_home:true};f.state.after.meta={...f.state.after.meta,...f.state.before.meta};assert.equal((await f.executor.execute(input)).status,'CMS_UPDATE_CONFIRMED');
});
test('explicit empty category replacement preserves independent general homepage exclusion',async()=>{
 const f=fixture();f.state.placementVerified=true;f.state.before.categories=[61];f.state.before.meta={oxpuro_excluded_category_ids:['61'],oxpuro_exclude_home:true};f.state.after.categories=[61];f.state.payload.payload.meta.oxpuro_excluded_category_ids=[];f.state.after.meta={...f.state.after.meta,oxpuro_excluded_category_ids:[],oxpuro_exclude_home:true};assert.equal((await f.executor.execute(input)).status,'CMS_UPDATE_CONFIRMED');assert.equal(f.state.writes,1);
});
test('an UPDATE cannot orphan preserved category exclusions by removing the assigned category',async()=>{
 const f=fixture();f.state.before.categories=[61];f.state.before.meta={oxpuro_excluded_category_ids:['61']};f.state.payload.payload.categories=[2];const result=await f.executor.execute(input);assert.equal(result.status,'PAYLOAD_UNCONFIRMED');assert.equal(f.state.writes,0);assert.equal(f.state.claim,null);
});
test('absence of the Guard provider never grants another subtarget of a placement-changing TODOS update',async()=>{
 const f=fixture();const decision={...f.state.decision,destination:'TODOS',posts:[{destination:'OPOL',postId}],finalPayloads:{OPURO:{meta:{oxpuro_excluded_category_ids:['61']}},OPOL:f.state.payload.payload}};
 let claims=0;const executor=createUpdateExecutor({loadDecision:async()=>decision,loadPayload:async()=>({...f.state.payload,destination:'OPOL'}),claimStore:{async begin(){claims++;throw Error('must not claim')}},wordpress:f.wordpress});
 const r=await executor.execute({...input,destination:'OPOL'});assert.equal(r.status,'EDITORIAL_PLACEMENT_UNCONFIRMED');assert.equal(claims,0);assert.equal(f.state.writes,0);
});
