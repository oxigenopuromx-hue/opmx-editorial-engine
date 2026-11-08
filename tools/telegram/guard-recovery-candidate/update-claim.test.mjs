import test from 'node:test';import assert from 'node:assert/strict';import {createUpdateClaimStore} from './update-claim.mjs';
const input={packageId:'tg_'+'a'.repeat(40),revision:12,destination:'OPURO',postId:123,previewHash:'b'.repeat(64),payloadHash:'c'.repeat(64),operationId:'update_'+'d'.repeat(64)};
function setup({fence='READY_TO_WRITE',verified=true,validDecision=true,commitFails=false}={}){
 let state={fence,claim:null};let chain=Promise.resolve();
 const pool={async getConnection(){let release,snapshot;const prior=chain;chain=new Promise(r=>release=r);return {async beginTransaction(){await prior;snapshot=structuredClone(state)},async commit(){if(commitFails)throw Error('commit uncertain');release()},async rollback(){state=snapshot;release()},release(){},async execute(sql,args){
  if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];
  if(sql.startsWith('SELECT state,revision FROM opmx_tg_packages'))return [[{state:'READY',revision:12}]];
  if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence'))return [[{state:state.fence}]];
  if(sql.startsWith('SELECT state FROM opmx_tg_update_claims'))return [state.claim?[{state:'WRITING'}]:[]];
  if(sql.startsWith('INSERT INTO opmx_tg_update_claims')){state.claim=args;return [{affectedRows:1}]}
  if(sql.startsWith('UPDATE opmx_tg_publication_fence')){state.fence='WRITING';return [{affectedRows:1}]}
  throw Error('unexpected SQL');}}}};
 const decision=async()=>({...input,action:validDecision?'UPDATE':'CREATE',posts:[{destination:'OPURO',postId:123}]});
 const evidence=async()=>({...input,authenticatedCmsPreflight:verified,explicitUpdate:true,exactPayload:true});
 return {store:createUpdateClaimStore({pool,loadVerifiedDecision:decision,loadVerifiedPayloadEvidence:evidence}),get state(){return state}};
}
test('only one concurrent claim starts the exact existing-post update',async()=>{
 const f=setup(),out=await Promise.all([f.store.begin(input),f.store.begin(input)]);assert.deepEqual(out.map(x=>x.status).sort(),['ALREADY_STARTED','UPDATE_STARTED']);assert.equal(f.state.fence,'WRITING');assert.equal(out.find(x=>x.status==='UPDATE_STARTED').postId,123);assert.ok(out.every(x=>x.retryPermitted===false));
});
test('missing proof, non-update decision, or recovery fence prevent any claim',async()=>{
 for(const options of [{verified:false},{validDecision:false},{fence:'RECOVERY_FENCED'},{fence:'RECONCILING'}]){const f=setup(options),result=await f.store.begin(input);assert.notEqual(result.status,'UPDATE_STARTED');assert.equal(f.state.claim,null)}
});
test('a mismatched post or preview cannot be converted into an update',async()=>{
 for(const change of [{postId:124},{previewHash:'e'.repeat(64)},{destination:'OPOL'}]){const f=setup(),result=await f.store.begin({...input,...change});assert.equal(result.status,'DECISION_UNCONFIRMED');assert.equal(f.state.claim,null)}
});
test('commit uncertainty is surfaced and never treated as a safe retry',async()=>{
 const f=setup({commitFails:true});await assert.rejects(()=>f.store.begin(input),/UPDATE_CLAIM_UNCONFIRMED/);
});
test('caller cannot supply proof or configure the store without trusted providers',async()=>{
 assert.throws(()=>createUpdateClaimStore({pool:{getConnection(){}}}),/UPDATE_CLAIM_CONFIGURATION_INCOMPLETE/);
 const f=setup();await assert.rejects(()=>f.store.begin({...input,explicitUpdate:true}),/INVALID_UPDATE_CLAIM/);
});
