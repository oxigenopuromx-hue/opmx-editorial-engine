import test from 'node:test';
import assert from 'node:assert/strict';
import {createUpdatePayloadStore} from './update-payload-store.mjs';
const packageId='tg_'+'a'.repeat(40),revision=11,destination='OPURO',previewHash='b'.repeat(64),postId=123;
const request={packageId,revision,destination,previewHash,payload:{title:'Título',content:'<p>Contenido</p>'}};
function fixture(){
 const s={row:null,verified:true,preflight:true,target:true,decision:{packageId,revision,action:'UPDATE',previewHash,contentMode:'LITERAL',posts:[{destination,postId}]},fence:'AWAITING_DECISION'},calls=[];let backup;
 const c={async beginTransaction(){backup=structuredClone(s.row)},async commit(){},async rollback(){s.row=backup},release(){},async execute(sql,args){calls.push(sql);
  if(sql.includes('FROM opmx_tg_quota'))return [[{id:1}]];
  if(sql.includes('FROM opmx_tg_packages'))return [[{state:'READY',revision}]];
  if(sql.includes('FROM opmx_tg_publication_fence'))return [[{state:s.fence}]];
  if(sql.startsWith('SELECT')&&sql.includes('FROM opmx_tg_update_payloads'))return [s.row?[s.row]:[]];
  if(sql.startsWith('INSERT INTO opmx_tg_update_payloads')){s.row={post_id:args[3],preview_hash:args[4],payload_hash:args[5],slug:args[6],payload_json:args[7]};return [{affectedRows:1}]}
  throw Error(sql);
 }};
 const store=createUpdatePayloadStore({pool:{async getConnection(){return c}},loadDecision:async()=>s.decision,loadVerifiedTarget:async(_c,x)=>s.target?{...x,slug:'nota-real'}:null,verifyPayload:async(_c,x)=>s.verified?{...x,exactPayload:true}:null,verifyCmsPreflight:async(_c,x)=>s.preflight?{...x,authenticatedCmsPreflight:true}:null});
 return {s,c,store,calls};
}
test('stages exactly one verified payload and reloads canonical bytes',async()=>{
 const f=fixture(),result=await f.store.stage(request);assert.equal(result.status,'PAYLOAD_STAGED');assert.equal(result.postId,postId);
 assert.equal((await f.store.stage(request)).status,'PAYLOAD_REPLAY');assert.equal((await f.store.stage({...request,payload:{title:'Otro'}})).status,'PAYLOAD_CONFLICT');
 const loaded=await f.store.load({packageId,revision,destination,previewHash});assert.deepEqual(loaded.payload,request.payload);assert.equal(loaded.slug,'nota-real');assert.equal(loaded.exactPayload,true);
 const claim={packageId,revision,destination,previewHash,postId,payloadHash:result.payloadHash,operationId:'operation_1234567890'};
 assert.equal((await f.store.verifyClaim(f.c,claim)).authenticatedCmsPreflight,true);f.s.preflight=false;assert.equal(await f.store.verifyClaim(f.c,claim),null);
});
test('no payload is staged for uncertain decision, target, proof or fence',async()=>{
 for(const change of [s=>s.decision.action='CREATE',s=>s.decision.previewHash='c'.repeat(64),s=>s.target=false,s=>s.verified=false,s=>s.fence='RECOVERY_FENCED']){const f=fixture();change(f.s);assert.notEqual((await f.store.stage(request)).status,'PAYLOAD_STAGED');assert.equal(f.s.row,null)}
});
test('tampering with saved bytes or claim identity never grants write evidence',async()=>{
 const f=fixture(),result=await f.store.stage(request),claim={packageId,revision,destination,previewHash,postId,payloadHash:result.payloadHash,operationId:'operation_1234567890'};
 assert.equal(await f.store.verifyClaim(f.c,{...claim,postId:999}),null);f.s.row.payload_json='{"title":"alterado"}';
 assert.equal(await f.store.load({packageId,revision,destination,previewHash}),null);assert.equal(await f.store.verifyClaim(f.c,claim),null);
});
test('source cannot supply post ID, URL, slug or a provider proof in the staging request',async()=>{
 const f=fixture();for(const extra of [{postId:9},{slug:'nota'},{url:'https://example.org'},{exactPayload:true}])await assert.rejects(()=>f.store.stage({...request,...extra}),/INVALID_UPDATE_PAYLOAD/);assert.equal(f.s.row,null);
});
