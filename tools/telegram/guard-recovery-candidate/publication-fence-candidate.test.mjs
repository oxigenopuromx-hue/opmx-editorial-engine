import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationFenceSchema,claimFenceInTransaction,beginPublicationAttempt} from './publication-fence-candidate.mjs';
const id='tg_'+'a'.repeat(40);
function mock(state){
  const calls=[];
  const conn={async beginTransaction(){calls.push('BEGIN')},async commit(){calls.push('COMMIT')},async rollback(){calls.push('ROLLBACK')},release(){calls.push('RELEASE')},async execute(sql,args){
    calls.push({sql,args});const from=sql.includes("state='SAFE_TO_REOPEN'")?'SAFE_TO_REOPEN':'READY_TO_WRITE';
    if(state.value!==from)return [{affectedRows:0}];
    state.value=from==='SAFE_TO_REOPEN'?'RECOVERY_FENCED':'WRITING';return [{affectedRows:1}];
  }};
  return {conn,calls,pool:{async getConnection(){return conn;}}};
}
test('writer starts once and later attempts cannot reuse the claim',async()=>{
  const state={value:'READY_TO_WRITE'},x=mock(state);
  assert.equal((await beginPublicationAttempt(x.pool,id,7)).status,'WRITE_STARTED');
  assert.equal(state.value,'WRITING');
  assert.equal((await beginPublicationAttempt(x.pool,id,7)).status,'WRITE_NOT_PERMITTED');
  assert.equal(await claimFenceInTransaction(x.conn,id,7),false);
});
test('a verified safe fence excludes later attempts for the old revision',async()=>{
  const state={value:'SAFE_TO_REOPEN'},x=mock(state);
  assert.equal(await claimFenceInTransaction(x.conn,id,7),true);
  assert.equal(state.value,'RECOVERY_FENCED');
  assert.equal((await beginPublicationAttempt(x.pool,id,7)).status,'WRITE_NOT_PERMITTED');
  assert.equal(await claimFenceInTransaction(x.conn,id,7),false);
  assert.deepEqual(x.calls.find(y=>y?.args)?.args,[id,7]);
});
test('unknown and absent rows never grant write or recovery permission',async()=>{
  for(const value of [null,'WRITING','UNCERTAIN','DONE','RECOVERY_FENCED']){
    const state={value},x=mock(state);
    assert.equal(await claimFenceInTransaction(x.conn,id,7),false);
    assert.equal((await beginPublicationAttempt(x.pool,id,7)).status,'WRITE_NOT_PERMITTED');
  }
});
test('invalid identifiers are rejected without touching the database',async()=>{
  const x=mock({value:'READY_TO_WRITE'});
  await assert.rejects(()=>beginPublicationAttempt(x.pool,'bad',7),/INVALID_FENCE_REQUEST/);
  await assert.rejects(()=>claimFenceInTransaction(x.conn,id,0),/INVALID_FENCE_REQUEST/);
  assert.equal(x.calls.length,0);assert.match(publicationFenceSchema,/PRIMARY KEY\(package_id,revision\)/);
});
