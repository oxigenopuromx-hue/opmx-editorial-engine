import test from 'node:test';
import assert from 'node:assert/strict';
import {withCutoverBackfill} from './fence-cutover-routing.mjs';
const requestId='tg_'+'a'.repeat(64);
function fixture({binding=false,backfillFails=false}={}){
 const calls=[];const pool={async getConnection(){return {async execute(){calls.push('lookup');return [binding?[{request_id:requestId}]:[]]},release(){calls.push('release')}}}};
 const route=withCutoverBackfill(async(_pool,input)=>{calls.push('fenced-route');return {status:'NOT_BOUND',requestId:input.requestId}},{backfill:async()=>{calls.push('backfill');if(backfillFails)throw Error('BACKFILL_FAILED')}});
 return {pool,route,calls};
}
test('an existing binding goes directly through the guarded writer',async()=>{const f=fixture({binding:true});await f.route(f.pool,{requestId});assert.deepEqual(f.calls,['lookup','release','fenced-route'])});
test('an event sealed during cutover is backfilled before the guarded writer',async()=>{const f=fixture();const r=await f.route(f.pool,{requestId});assert.equal(r.status,'NOT_BOUND');assert.deepEqual(f.calls,['lookup','release','backfill','fenced-route'])});
test('uncertain migration cannot reach a writer',async()=>{const f=fixture({backfillFails:true});await assert.rejects(()=>f.route(f.pool,{requestId}),/BACKFILL_FAILED/);assert.equal(f.calls.includes('fenced-route'),false)});
