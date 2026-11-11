import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevisionCapture} from './revision-capture.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
const id='tg_'+'a'.repeat(40),owner='b'.repeat(64),control='ti_'+'c'.repeat(40),revision=12;
const policy={mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND',destination:'OPOL,LIBERAL',control_item_ids:[control]};
function setup({closed=true,badPolicy=false,badResult=false,correction=null}={}){
 const c={async execute(sql,args){assert.match(sql,/opmx_tg_recovery_closures_v1/);assert.deepEqual(args,[id,revision]);return [closed?[{package_id:id}]:[]]}};
 const capture=createRevisionCapture({readRecoveredPolicy:async(conn,p,r)=>{assert.equal(conn,c);assert.equal(p,id);assert.equal(r,revision);return badPolicy?null:policy},readConfirmedCorrection:async()=>correction,lockVerifiedBlockedOutcomes:async(conn,d)=>{assert.equal(conn,c);return badResult?[]:d.destinations.map(destination=>({destination,status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}))}});
 return {capture,c};
}
test('reopened revisions preserve prior destination and bind a new request ID',async()=>{
 const {capture,c}=setup();const value=await capture(c,id,revision,owner,[]);
 assert.deepEqual(value.destinations,['OPOL','LIBERAL']);assert.equal(value.requestId,expectedDraftRequestId({packageId:id,revision,destination:'OPOL,LIBERAL'}));assert.deepEqual(value.controls,[control]);assert.equal(value.results.length,2);
});
test('subsequent recovery checks the confirmed destination rather than the obsolete original destination',async()=>{
 const correction={package_id:id,revision,action:'CREATE',destination:'OPURO',content_mode:'LITERAL',preview_hash:'d'.repeat(64)};
 const {capture,c}=setup({correction});const value=await capture(c,id,revision,owner,[]);
 assert.deepEqual(value.destinations,['OPURO']);assert.equal(value.contentMode,'LITERAL');assert.equal(value.requestId,expectedDraftRequestId({packageId:id,revision,destination:'OPURO'}));
});
test('stale confirmed correction cannot authorize later recovery',async()=>{
 const {capture,c}=setup({correction:{package_id:id,revision:revision-1,action:'CREATE',destination:'OPURO',content_mode:'LITERAL'}});assert.equal(await capture(c,id,revision,owner,[]),null);
});
test('unavailable decision evidence never falls back to the original destination',async()=>{
 const c={async execute(){return [[{package_id:id}]]}};
 const capture=createRevisionCapture({readRecoveredPolicy:async()=>policy,readConfirmedCorrection:async()=>{throw Error('DB unavailable')},lockVerifiedBlockedOutcomes:async()=>{throw Error('must not run')}});
 assert.equal(await capture(c,id,revision,owner,[]),null);
});
test('missing recovery policy or unverified outcomes prevents reopening again',async()=>{
 for(const opts of [{badPolicy:true},{badResult:true}]){const {capture,c}=setup(opts);assert.equal(await capture(c,id,revision,owner,[]),null);}
});
test('confirmed UPDATE capture preserves exactly the reconciled original IDs',async()=>{
 const correction={package_id:id,revision,action:'UPDATE',destination:'OPURO',content_mode:'LITERAL',preview_hash:'d'.repeat(64),posts:[{destination:'OPURO',post_id:123}]},c={async execute(){return [[{package_id:id}]]}};
 for(const postId of [123,999]){const capture=createRevisionCapture({readRecoveredPolicy:async()=>policy,readConfirmedCorrection:async()=>correction,lockVerifiedBlockedOutcomes:async()=>[{destination:'OPURO',status:'DRAFT',publicationVerdict:'CMS_RECORD_CONFIRMED',cmsVerified:true,wordpressStatus:'draft',postId,slug:'qa18',ledgerRequestId:'tg_'+'e'.repeat(64)}]});const r=await capture(c,id,revision,owner,[]);if(postId===123)assert.equal(r.results[0].postId,123);else assert.equal(r,null)}
});
