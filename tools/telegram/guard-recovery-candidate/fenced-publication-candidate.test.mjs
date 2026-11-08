import test from 'node:test';import assert from 'node:assert/strict';
import {beginFencedPublication} from './fenced-publication-candidate.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
const pkg='tg_'+'a'.repeat(40),revision=8;
const input={requestId:expectedDraftRequestId({packageId:pkg,revision,destination:'OPURO'}),slug:'nota-prueba',targets:[{destination:'OPURO',postId:123}]};
function fixture({state='READY_TO_WRITE',bound=true,postId=123,targetStatus='reported',duplicate=false,commitError=false}={}){
 let fence=state,prior=state,claimed=false;const statements=[];
 const c={async beginTransaction(){prior=fence},async commit(){if(commitError)throw Error('lost response')},async rollback(){fence=prior;claimed=false},release(){},async execute(sql){
  statements.push(sql);
  if(sql.startsWith('SELECT package_id,revision'))return [bound?[{package_id:pkg,revision}]:[]];
  if(sql.startsWith('SELECT state'))return [[{state:fence}]];
  if(sql.startsWith('SELECT status,post_id'))return [[{status:targetStatus,post_id:postId}]];
  if(sql.startsWith('INSERT INTO opmx_tg_publication_claims')){if(duplicate)throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});claimed=true;return [{affectedRows:1}]}
  if(sql.startsWith('UPDATE opmx_tg_publication_fence')){fence='WRITING';return [{affectedRows:1}]}
  throw Error(sql);
 }};return {pool:{async getConnection(){return c}},statements,get fence(){return fence},get claimed(){return claimed}};
}
test('publication claims the bound revision and exact post in one transaction',async()=>{
 const f=fixture();const result=await beginFencedPublication(f.pool,input);assert.equal(result.status,'PUBLICATION_STARTED');assert.equal(f.fence,'WRITING');assert.equal(f.claimed,true);assert.ok(f.statements.find(x=>x.includes('opmx_mcp_target_progress')&&x.includes('FOR UPDATE')));
});
test('missing binding, wrong post, fenced revision and duplicate never permit a write',async()=>{
 for(const opts of [{bound:false},{postId:124},{targetStatus:'writing'},{state:'RECOVERY_FENCED'},{state:'RECONCILING'},{duplicate:true}]){const f=fixture(opts);const result=await beginFencedPublication(f.pool,input);assert.notEqual(result.status,'PUBLICATION_STARTED');assert.equal(f.claimed,false);assert.equal(f.fence,opts.state??'READY_TO_WRITE')}
});
test('a destination change and uncertain commit fail closed',async()=>{
 const f=fixture();assert.equal((await beginFencedPublication(f.pool,{...input,targets:[{destination:'OPOL',postId:123}]})).status,'TARGETS_UNCONFIRMED');
 const uncertain=fixture({commitError:true});await assert.rejects(()=>beginFencedPublication(uncertain.pool,input),/PUBLICATION_CLAIM_UNCONFIRMED/);
});
