import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {validatePublisherSubmissionOutcome as validate} from './publisher-submission-policy.mjs';
const packageId='tg_'+'a'.repeat(40),revision=8,destination='TODOS',phase='PUBLISH',slug='qa-example',requestId=expectedDraftRequestId({packageId,revision,destination}),submissionHash='b'.repeat(64),targets=['OPURO','OPOL','LIBERAL'].map((destination,i)=>({destination,post_id:100+i,slug,status:'publish'}));
const receipt={requestId,phase,slug,targets:targets.map(t=>({destination:t.destination,postId:t.post_id})),packageId,revision};
const receiptHash=createHash('sha256').update(canonicalUpdateValue(receipt)).digest('hex');
const expected={packageId,revision,requestId,destination,phase,slug,submissionHash};
function inventory(){return {status:'PACKAGE_FOUND',package_id:packageId,revision,state:'READY',publisher_result:{schema:'opmx.publisher-submission-result.v1',status:'WRITER_RESULT_CONFIRMED',package_id:packageId,revision,request_id:requestId,phase,destino:destination,slug,submission_hash:submissionHash,receipt_hash:receiptHash,historical:true,telegram_notice:'SENT',current_cms_state:'NOT_CHECKED',public_visibility:'NOT_CHECKED',targets,retryPermitted:false,write_authorized:false}}}
test('Motor validates the exact canonical durable receipt hash before completion',()=>{const r=validate(inventory(),expected);assert.equal(r.completionPermitted,true);assert.equal(r.status,'WRITER_RESULT_CONFIRMED');assert.equal(r.historical,true);assert.equal(r.writeAuthorized,false);assert.equal(r.retryPermitted,false);assert.equal(r.telegramNotice,'SENT')});
for(const [name,patch] of Object.entries({hash:{receipt_hash:'c'.repeat(64)},phase:{phase:'DRAFT'},request:{request_id:'tg_'+'d'.repeat(64)},revision:{revision:9},destination:{destino:'OPOL'},submission:{submission_hash:'e'.repeat(64)},targets:{targets:targets.map((t,i)=>i?{...t}:{...t,post_id:999})},currentClaim:{current_cms_state:'publish'},authorization:{write_authorized:true}}))test('Motor rejects altered '+name,()=>{const x=inventory();Object.assign(x.publisher_result,patch);assert.equal(validate(x,expected).completionPermitted,false)});
test('pending, uncertain, foreign and stale manifests cannot complete',()=>{
 for(const status of ['SUBMISSION_PENDING','SUBMISSION_UNCERTAIN']){const x=inventory();x.publisher_result.status=status;assert.equal(validate(x,expected).status,status);assert.equal(validate(x,expected).completionPermitted,false)}
 for(const p of [{revision:9},{state:'OPEN'},{package_id:'tg_'+'f'.repeat(40)}])assert.equal(validate({...inventory(),...p},expected).completionPermitted,false);
});
test('lost acceptance response can reconcile exact original request without inventing a submission hash',()=>{assert.equal(validate(inventory(),{...expected,submissionHash:null}).completionPermitted,true)});
test('Telegram notice uncertainty remains separate from an authenticated completed writer',()=>{const x=inventory();x.publisher_result.telegram_notice='UNCERTAIN';const r=validate(x,expected);assert.equal(r.completionPermitted,true);assert.equal(r.telegramNotice,'UNCERTAIN')});
