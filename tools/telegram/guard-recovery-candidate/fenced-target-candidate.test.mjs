import test from 'node:test';
import assert from 'node:assert/strict';
import {beginFencedTarget,initializeRevisionFence,bindTrustedRequestInTransaction,requestBindingSchema} from './fenced-target-candidate.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';

const input={requestId:'tg_'+'a'.repeat(64),slug:'nota-de-prueba',destination:'LIBERAL'};
function fixture({bound=true,state='READY_TO_WRITE',reserved=true,duplicate=false,commitError=false}={}){
  const calls=[];let current=state,initial=state;
  const c={async beginTransaction(){calls.push('begin');initial=current},async commit(){calls.push('commit');if(commitError)throw Error('lost commit response')},async rollback(){calls.push('rollback');current=initial},release(){calls.push('release')},async execute(sql,params){
    calls.push({sql,params});
    if(sql.startsWith('SELECT package_id'))return [bound?[{package_id:'tg_'+'b'.repeat(40),revision:7}]:[]];
    if(sql.startsWith('SELECT state'))return [current===null?[]:[{state:current}]];
    if(sql.startsWith('UPDATE')){current='WRITING';return [{affectedRows:1}];}
    if(sql.startsWith('INSERT')){if(duplicate)throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});return [{affectedRows:reserved?1:0}];}
    throw Error('unexpected SQL');
  }};
  return {pool:{async getConnection(){return c}},calls,get state(){return current}};
}
test('reserves the actual target inside the same transaction as the fence',async()=>{
  const f=fixture();assert.deepEqual(await beginFencedTarget(f.pool,input),{status:'write_started'});
  assert.equal(f.state,'WRITING');assert.deepEqual(f.calls.filter(x=>typeof x==='string'),['begin','commit','release']);
  const statements=f.calls.filter(x=>x.sql);assert.match(statements[1].sql,/FOR UPDATE/);assert.match(statements[3].sql,/INSERT INTO opmx_mcp_target_progress/);
});
test('a fenced or unknown revision and an unbound request never acquire a target',async()=>{
  for(const options of [{bound:false},{state:'RECOVERY_FENCED'},{state:'SAFE_TO_REOPEN'},{state:null}]){
    const f=fixture(options);assert.notEqual((await beginFencedTarget(f.pool,input)).status,'write_started');
    assert.equal(f.calls.some(x=>x.sql?.startsWith('INSERT')),false);assert.ok(f.calls.includes('rollback'));
  }
});
test('an already writing request may start another reserved destination',async()=>{
  const f=fixture({state:'WRITING'});assert.equal((await beginFencedTarget(f.pool,input)).status,'write_started');
  assert.equal(f.calls.some(x=>x.sql?.startsWith('UPDATE')),false);
});
test('unreserved and repeated targets roll back instead of granting a write',async()=>{
  for(const options of [{reserved:false},{duplicate:true}]){
    const f=fixture(options);assert.notEqual((await beginFencedTarget(f.pool,input)).status,'write_started');
    assert.equal(f.state,'READY_TO_WRITE');assert.ok(f.calls.includes('rollback'));
  }
});
test('lost commit response does not grant permission to call WordPress',async()=>{
  const f=fixture({commitError:true});await assert.rejects(()=>beginFencedTarget(f.pool,input),/WRITE_START_UNCONFIRMED/);
  assert.ok(f.calls.includes('rollback'));
});
test('reject invalid parameters before acquiring any connection',async()=>{
  const f=fixture();await assert.rejects(()=>beginFencedTarget(f.pool,{...input,destination:'UNKNOWN'}),/INVALID_TARGET_REQUEST/);
  assert.equal(f.calls.length,0);
});
test('each server-resolved destination can have a distinct immutable binding',async()=>{
  const id='tg_'+'b'.repeat(40),calls=[];const c={async execute(sql,args){calls.push({sql,args});return sql.startsWith('SELECT')?[[{state:'READY_TO_WRITE'}]]:[{affectedRows:1}];}};
  await initializeRevisionFence(c,{packageId:id,revision:7});
  for(const destination of ['OPURO','AMBOS','TODOS']){
    const requestId=expectedDraftRequestId({packageId:id,revision:7,destination});
    assert.equal(await bindTrustedRequestInTransaction(c,{packageId:id,revision:7,destination,requestId}),true);
  }
  assert.equal(calls.filter(x=>x.sql.startsWith('INSERT INTO opmx_tg_request_binding')).length,3);
  assert.doesNotMatch(requestBindingSchema,/UNIQUE KEY package_revision/);
});
test('binding rejects untrusted identity and refuses closed or missing fences',async()=>{
  const id='tg_'+'b'.repeat(40),requestId=expectedDraftRequestId({packageId:id,revision:7,destination:'TODOS'});
  for(const state of [null,'WRITING','SAFE_TO_REOPEN','RECOVERY_FENCED']){
    const calls=[];const c={async execute(sql){calls.push(sql);return [state===null?[]:[{state}]]}};
    assert.equal(await bindTrustedRequestInTransaction(c,{packageId:id,revision:7,destination:'TODOS',requestId}),false);
    assert.equal(calls.length,1);
  }
  const c={async execute(){throw Error('unexpected database access')}};
  await assert.rejects(()=>bindTrustedRequestInTransaction(c,{packageId:id,revision:7,destination:'OPURO',requestId}),/INVALID_BINDING/);
});
