import test from 'node:test';
import assert from 'node:assert/strict';
import {createUpdatePayloadStore} from './update-payload-store.mjs';
import {createUpdateClaimStore} from './update-claim.mjs';
import {createUpdateExecutor} from './update-executor.mjs';
const packageId='tg_'+'a'.repeat(40),revision=11,previewHash='b'.repeat(64),destination='OPURO',postId=123,slug='nota-real';
const request={packageId,revision,previewHash,destination},payload={title:'Título aprobado',content:'<p>Texto aprobado</p>'};
function fixture(){
 const state={payload:null,claim:null,fence:'AWAITING_DECISION',writes:0,failWrite:false,post:{id:postId,type:'post',slug,status:'draft',title:{raw:'Antes'},content:{raw:'<p>Antes</p>'}}};let queue=Promise.resolve();
 const decision={...request,action:'UPDATE',contentMode:'LITERAL',posts:[{destination,postId}]};
 const pool={async getConnection(){let release,before;const prior=queue;queue=new Promise(r=>release=r);let ended=false;
  return {async beginTransaction(){await prior;before=structuredClone({payload:state.payload,claim:state.claim,fence:state.fence})},async commit(){ended=true;release()},async rollback(){if(!ended){Object.assign(state,before);ended=true;release()}},release(){},async execute(sql,args){
   if(sql.includes('FROM opmx_tg_quota'))return [[{id:1}]];
   if(sql.includes('FROM opmx_tg_packages'))return [[{state:'READY',revision}]];
   if(sql.includes('FROM opmx_tg_publication_fence'))return [[{state:state.fence}]];
   if(sql.startsWith('SELECT')&&sql.includes('FROM opmx_tg_update_payloads'))return [state.payload?[state.payload]:[]];
   if(sql.startsWith('INSERT INTO opmx_tg_update_payloads')){state.payload={post_id:args[3],preview_hash:args[4],payload_hash:args[5],slug:args[6],payload_json:args[7]};return [{affectedRows:1}]}
   if(sql.startsWith('SELECT')&&sql.includes('FROM opmx_tg_update_claims'))return [state.claim?[{state:'WRITING'}]:[]];
   if(sql.startsWith('INSERT INTO opmx_tg_update_claims')){state.claim=args;return [{affectedRows:1}]}
   if(sql.startsWith('UPDATE opmx_tg_publication_fence')){state.fence='WRITING';return [{affectedRows:1}]}
   throw Error(sql);
  }};
 }};
 const store=createUpdatePayloadStore({pool,loadDecision:async()=>decision,loadVerifiedTarget:async(_c,x)=>({...x,slug}),verifyPayload:async(_c,x)=>({...x,exactPayload:true}),verifyCmsPreflight:async(_c,x)=>({...x,authenticatedCmsPreflight:true})});
 const claims=createUpdateClaimStore({pool,loadVerifiedDecision:async()=>decision,loadVerifiedPayloadEvidence:store.verifyClaim});
 const wordpress={async read(){return {statusCode:200,post:structuredClone(state.post)}},async update({postId:id,payload:p}){assert.equal(id,postId);state.writes++;if(state.failWrite)throw Error('lost connection');state.post.title={raw:p.title};state.post.content={raw:p.content};return {statusCode:200,post:{id}}}};
 const executor=createUpdateExecutor({loadDecision:async()=>decision,loadPayload:store.load,claimStore:claims,wordpress});
 return {state,store,executor};
}
test('staging, claim and readback compose, and two concurrent requests update once',async()=>{
 const f=fixture();assert.equal((await f.store.stage({...request,payload})).status,'PAYLOAD_STAGED');f.state.fence='READY_TO_WRITE';
 const results=await Promise.all([f.executor.execute(request),f.executor.execute(request)]);
 assert.deepEqual(results.map(x=>x.status).sort(),['CLAIM_UNCONFIRMED','CMS_UPDATE_CONFIRMED']);assert.equal(f.state.writes,1);assert.equal(f.state.fence,'WRITING');
});
test('an uncertain write retains its claim and cannot be retried',async()=>{
 const f=fixture();await f.store.stage({...request,payload});f.state.fence='READY_TO_WRITE';f.state.failWrite=true;
 const first=await f.executor.execute(request);assert.equal(first.status,'UPDATE_UNCERTAIN');assert.equal(first.retryPermitted,false);
 assert.equal((await f.executor.execute(request)).status,'CLAIM_UNCONFIRMED');assert.equal(f.state.writes,1);
});
