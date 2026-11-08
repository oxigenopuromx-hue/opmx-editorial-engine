import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createTargetReconciler,createTargetLedgerReader,createRequestTargetReconciler} from './target-reconciliation.mjs';import {expectedDraftRequestId} from './correlation-candidate.mjs';
const input={requestId:'tg_'+'a'.repeat(64),slug:'nota-prueba',destination:'OPURO'},ledger={...input,status:'reported',postId:123};
function fixture({record=ledger,response={statusCode:200,post:{id:123,type:'post',slug:input.slug,status:'publish'}},failLedger=false,failCms=false}={}){let reads=0;return {read:createTargetReconciler({loadLedger:async()=>{if(failLedger)throw Error('offline');return record},readWordPress:async x=>{reads++;assert.deepEqual(x,{site:'https://cms.oxigenopuro.com.mx',postId:123});if(failCms)throw Error('offline');return response}}),get reads(){return reads}}}
test('verified WordPress status is separate from visibility, notification and write authorization',async()=>{
 for(const status of ['publish','draft','trash']){const f=fixture({response:{statusCode:200,post:{id:123,type:'post',slug:input.slug,status}}});const x=await f.read(input);assert.deepEqual(x,{status:'CMS_RECORD_CONFIRMED',destination:'OPURO',postId:123,wordpressStatus:status,cmsVerified:true,publicVisibility:'NOT_CHECKED',telegramAck:'NOT_CHECKED',retryPermitted:false,writeAuthorized:false});}
});
test('missing or uncertain ledger entries never trigger a WordPress write or infer absence',async()=>{
 for(const record of [null,{...ledger,status:'writing'},{...ledger,postId:null},{...ledger,requestId:'other'}]){const f=fixture({record});const x=await f.read(input);assert.equal(x.status,'RECONCILIATION_REQUIRED');assert.equal(x.retryPermitted,false);assert.equal(f.reads,0)}
});
test('a missing post, invalid identity or unavailable CMS is uncertain, not authorization to recreate',async()=>{
 for(const options of [{response:{statusCode:404}},{response:{statusCode:200,post:{id:999,type:'post',slug:input.slug,status:'publish'}}},{response:{statusCode:200,post:{id:123,type:'post',slug:'other',status:'publish'}}},{failCms:true}]){const f=fixture(options),x=await f.read(input);assert.equal(x.status,'RECONCILIATION_REQUIRED');assert.equal(x.writeAuthorized,false);assert.equal(x.cmsVerified,false);assert.equal(x.postId,123)}
});
test('providers and destination are fixed by the server, not arbitrary URLs',async()=>{
 assert.throws(()=>createTargetReconciler({loadLedger:async()=>{}}),/RECONCILIATION_CONFIGURATION_INCOMPLETE/);
 const f=fixture();await assert.rejects(()=>f.read({...input,site:'https://other.invalid'}),/INVALID_RECONCILIATION_REQUEST/);await assert.rejects(()=>f.read({...input,destination:'OTHER'}),/INVALID_RECONCILIATION_REQUEST/);assert.equal(f.reads,0);
});
test('existing guard ledger is read-only and unsafe or absent post IDs remain unknown',async()=>{
 for(const [rows,expected] of [[[ {status:'reported',post_id:'123'} ],123],[[{status:'reported',post_id:'9007199254740992'}],null],[[],null]]){
  let released=false,queries=0;const pool={async getConnection(){return {async execute(sql){queries++;assert.match(sql,/^SELECT status,post_id FROM opmx_mcp_target_progress/);return [rows]},release(){released=true}}}};
  const value=await createTargetLedgerReader(pool)(input);assert.equal(value.postId,expected);assert.equal(queries,1);assert.equal(released,true);
 }
});
test('reconciles by package revision and recorded post ID without trusting a supplied slug',async()=>{
 const request={packageId:'tg_'+'b'.repeat(40),revision:4,destinationChoice:'AMBOS',destination:'OPURO'},requestId=expectedDraftRequestId({...request,destination:'AMBOS'}),target_key=createHash('sha256').update('opmx:v1:OPURO:nota-prueba').digest('hex');
 let reads=0;const pool={async getConnection(){return {release(){},async execute(sql,args){assert.match(sql,/^SELECT target_key,status,post_id/);assert.deepEqual(args,[requestId,'OPURO']);return [[{target_key,status:'reported',post_id:'123'}]]}}}};
 const read=async({site,postId})=>{reads++;assert.equal(site,'https://cms.oxigenopuro.com.mx');assert.equal(postId,123);return {statusCode:200,post:{id:123,type:'post',slug:'nota-prueba',status:'publish'}}};
 const result=await createRequestTargetReconciler({pool,readWordPress:read})(request);assert.equal(result.status,'CMS_RECORD_CONFIRMED');assert.equal(result.requestId,requestId);assert.equal(result.consistentSnapshot,false);assert.equal(result.writeAuthorized,false);assert.equal(reads,1);
 await assert.rejects(()=>createRequestTargetReconciler({pool,readWordPress:read})({...request,slug:'evil'}),/INVALID_RECONCILIATION_REQUEST/);
});
test('trash with a changed slug and a missing post remain explicitly uncertain',async()=>{
 const request={packageId:'tg_'+'b'.repeat(40),revision:4,destinationChoice:'OPURO',destination:'OPURO'},target_key=createHash('sha256').update('opmx:v1:OPURO:nota-prueba').digest('hex');
 const pool={async getConnection(){return {release(){},async execute(){return [[{target_key,status:'reported',post_id:'123'}]]}}}};
 for(const response of [{statusCode:404},{statusCode:200,post:{id:123,type:'post',slug:'nota-prueba__trashed',status:'trash'}}]){const result=await createRequestTargetReconciler({pool,readWordPress:async()=>response})(request);assert.equal(result.status,'RECONCILIATION_REQUIRED');assert.equal(result.writeAuthorized,false);assert.equal(result.postId,123);}
});
