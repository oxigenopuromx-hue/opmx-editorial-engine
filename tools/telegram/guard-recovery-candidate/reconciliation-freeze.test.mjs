import test from 'node:test';
import assert from 'node:assert/strict';
import {freezeForReview,confirmReconciledInTransaction,beginPublicationAttempt,claimFenceInTransaction} from './publication-fence-candidate.mjs';
const id='tg_'+'a'.repeat(40),revision=7;
const evidence={packageId:id,revision,terminalBlocked:true,noActiveAttempts:true,noPublicationSideEffects:true,allWritersParticipate:true};
function db(initial){
 let state=initial;
 const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql){
   const from=sql.match(/AND state='([A-Z_]+)'/)?.[1],to=sql.match(/SET state='([A-Z_]+)'/)?.[1];
   if(from!==state)return [{affectedRows:0}];state=to;return [{affectedRows:1}];
 }};
 return {pool:{async getConnection(){return c}},c,get state(){return state}};
}
test('freezing wins before an attempt and keeps delayed writers out',async()=>{
 const d=db('READY_TO_WRITE');assert.equal((await freezeForReview(d.pool,id,revision)).status,'FROZEN_FOR_REVIEW');
 assert.equal((await beginPublicationAttempt(d.pool,id,revision)).status,'WRITE_NOT_PERMITTED');
 assert.equal(await confirmReconciledInTransaction(d.c,id,revision,evidence),true);
 assert.equal(await claimFenceInTransaction(d.c,id,revision),true);assert.equal(d.state,'RECOVERY_FENCED');
 assert.equal((await beginPublicationAttempt(d.pool,id,revision)).status,'WRITE_NOT_PERMITTED');
});
test('a writer that started first can never be declared safe by this path',async()=>{
 const d=db('READY_TO_WRITE');assert.equal((await beginPublicationAttempt(d.pool,id,revision)).status,'WRITE_STARTED');
 assert.equal((await freezeForReview(d.pool,id,revision)).status,'RECONCILIATION_REQUIRED');
 assert.equal(await confirmReconciledInTransaction(d.c,id,revision,evidence),false);
 assert.equal(await claimFenceInTransaction(d.c,id,revision),false);assert.equal(d.state,'WRITING');
});
test('missing or mismatched evidence cannot convert a frozen revision into safe',async()=>{
 for(const bad of [null,{...evidence,allWritersParticipate:false},{...evidence,noActiveAttempts:false},{...evidence,noPublicationSideEffects:false},{...evidence,terminalBlocked:false},{...evidence,revision:8}]){
  const d=db('RECONCILING');assert.equal(await confirmReconciledInTransaction(d.c,id,revision,bad),false);assert.equal(d.state,'RECONCILING');
 }
});
