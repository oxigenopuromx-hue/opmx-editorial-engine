import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMotorAttemptStore} from './motor-attempt-store.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const scope={owner:'222',chat:'222',packageId:'tg_'+'a'.repeat(40),revision:19,eventId:'evt_'+'b'.repeat(48),previewHash:'d'.repeat(64)};
function fixture({fence='AWAITING_DECISION',state='RUNNING',previewHash=scope.previewHash}={}){
 let tokenHash=hash('c'.repeat(64)),writes=0;
 const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql,args){
  if(sql.startsWith('SELECT state,revision'))return [[{state:'READY',revision:19}]];
  if(sql.startsWith('SELECT state,event_id'))return [[{state,event_id:scope.eventId,token_hash:tokenHash}]];
  if(sql.startsWith('SELECT state FROM'))return [[{state:fence}]];
  if(sql.startsWith('UPDATE opmx_tg_motor')){assert.equal(args[3],tokenHash);tokenHash=args[0];writes++;return [{affectedRows:1}]}
  throw Error(sql);
 }};
 const store=createMotorAttemptStore({pool:{getConnection:async()=>c},adminUserIds:['222'],tokenFactory:()=> 'e'.repeat(64),readDecision:async()=>({package_id:scope.packageId,revision:19,preview_hash:previewHash})});
 return {store,get tokenHash(){return tokenHash},get writes(){return writes}};
}
test('recovers the same unacknowledged attempt and atomically invalidates its prior capability',async()=>{
 const f=fixture(),r=await f.store.recoverUnacknowledged(scope);assert.equal(r.status,'UNACKNOWLEDGED_ATTEMPT_RECOVERED');assert.equal(r.eventId,scope.eventId);assert.equal(f.tokenHash,hash(r.token));assert.notEqual(f.tokenHash,hash('c'.repeat(64)));assert.equal(f.writes,1);assert.equal(r.retryPermitted,false);
});
for(const fence of ['READY_TO_WRITE','WRITING','HISTORICAL_WRITING','RECONCILING'])test(`never recovers after permission could have opened: ${fence}`,async()=>{const f=fixture({fence});assert.equal((await f.store.recoverUnacknowledged(scope)).status,'RECONCILIATION_REQUIRED');assert.equal(f.writes,0)});
test('requires the configured administrator and exact confirmed decision',async()=>{
 for(const override of [{owner:'333',chat:'333'},{chat:'333'},{eventId:'evt_'+'f'.repeat(48)},{previewHash:'f'.repeat(64)},{revision:20}]){const f=fixture();await f.store.recoverUnacknowledged({...scope,...override});assert.equal(f.writes,0)}
});
for(const state of ['QUEUED','BLOCKED','COMPLETED'])test(`does not start or revive a ${state} attempt`,async()=>{const f=fixture({state});assert.equal((await f.store.recoverUnacknowledged(scope)).status,'RECOVERY_NOT_PERMITTED');assert.equal(f.writes,0)});
