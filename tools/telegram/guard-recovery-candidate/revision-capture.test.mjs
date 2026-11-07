import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevisionCapture} from './revision-capture.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
const id='tg_'+'a'.repeat(40),owner='b'.repeat(64),control='ti_'+'c'.repeat(40),revision=12;
const policy={mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND',destination:'OPOL,LIBERAL',control_item_ids:[control]};
function setup({closed=true,badPolicy=false,badResult=false}={}){
 const c={async execute(sql,args){assert.match(sql,/opmx_tg_recovery_closures_v1/);assert.deepEqual(args,[id,revision]);return [closed?[{package_id:id}]:[]]}};
 const capture=createRevisionCapture({readRecoveredPolicy:async(conn,p,r)=>{assert.equal(conn,c);assert.equal(p,id);assert.equal(r,revision);return badPolicy?null:policy},lockVerifiedBlockedOutcomes:async(conn,d)=>{assert.equal(conn,c);return badResult?[]:d.destinations.map(destination=>({destination,status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}))}});
 return {capture,c};
}
test('reopened revisions preserve prior destination and bind a new request ID',async()=>{
 const {capture,c}=setup();const value=await capture(c,id,revision,owner,[]);
 assert.deepEqual(value.destinations,['OPOL','LIBERAL']);assert.equal(value.requestId,expectedDraftRequestId({packageId:id,revision,destination:'OPOL,LIBERAL'}));assert.deepEqual(value.controls,[control]);assert.equal(value.results.length,2);
});
test('missing recovery policy or unverified outcomes prevents reopening again',async()=>{
 for(const opts of [{badPolicy:true},{badResult:true}]){const {capture,c}=setup(opts);assert.equal(await capture(c,id,revision,owner,[]),null);}
});
