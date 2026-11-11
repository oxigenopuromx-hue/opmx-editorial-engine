import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createWriterReceiptStore,readCompletedWriterReceipt} from './writer-receipt-store.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
const packageId=`tg_${'a'.repeat(40)}`,revision=4,eventId=`evt_${'b'.repeat(48)}`,requestId=expectedDraftRequestId({packageId,revision,destination:'OPURO'}),slug='nota-verificada',targetKey=createHash('sha256').update(`opmx:v1:OPURO:${slug}`).digest('hex');
function fixture({phase='DRAFT',post={id:10423,type:'post',slug,status:phase==='PUBLISH'?'publish':'draft'},target=null,claims=null,failInsert=false}={}){
 let rows=[],snapshot=[],cmsReads=0;const c={async beginTransaction(){snapshot=structuredClone(rows)},async commit(){},async rollback(){rows=snapshot},release(){},async execute(sql,args){
  if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];
  if(sql.startsWith('SELECT package_id,revision FROM opmx_tg_request_binding'))return [[{package_id:packageId,revision}]];
  if(sql.startsWith('SELECT state,revision FROM opmx_tg_packages'))return [[{state:'READY',revision}]];
  if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence'))return [[{state:'WRITING'}]];
  if(sql.startsWith('SELECT receipt_hash,receipt_json FROM'))return [rows.filter(r=>r.request_id===args[0]&&r.phase===args[1])];
  if(sql.startsWith('SELECT request_id,slug,destinations FROM opmx_tg_publication_claims')||sql.startsWith('SELECT request_id FROM opmx_tg_publication_claims'))return [claims??(phase==='PUBLISH'?[{request_id:requestId,slug,destinations:'OPURO'}]:[])];
  if(sql.startsWith('SELECT request_id,destination,target_key,status,post_id FROM'))return [target??[{request_id:requestId,destination:'OPURO',target_key:targetKey,status:'reported',post_id:'10423'}]];
  if(sql.startsWith('INSERT INTO opmx_tg_writer_receipts')){if(failInsert)throw Error('FAULT');rows.push({request_id:args[0],phase:args[1],package_id:args[2],revision:args[3],receipt_hash:args[4],receipt_json:args[5]});return [{affectedRows:1}]}
  if(sql.startsWith('SELECT event_id FROM opmx_tg_events'))return [[{event_id:eventId}]];
  if(sql.startsWith('SELECT request_id,phase,receipt_hash,receipt_json FROM'))return [rows.filter(r=>r.phase===args[2])];
  throw Error('Unexpected SQL '+sql);
 }};
 const readWordPress=async x=>{cmsReads++;assert.deepEqual(x,{site:'https://cms.oxigenopuro.com.mx',postId:10423});return {statusCode:post?200:404,post}};
 return {store:createWriterReceiptStore({pool:{getConnection:async()=>c},readWordPress}),c,get rows(){return rows},get cmsReads(){return cmsReads},input:{requestId,phase,slug,targets:[{destination:'OPURO',postId:10423}]}};
}
test('completed draft and publication phases bind the acknowledged original IDs',async()=>{
 for(const phase of ['DRAFT','PUBLISH']){const f=fixture({phase});const r=await f.store.report(f.input);assert.equal(r.status,'WRITER_RECEIPT_RECORDED');assert.equal(r.packageId,packageId);assert.equal(f.rows.length,1);assert.equal(f.cmsReads,1);const proof=await readCompletedWriterReceipt(f.c,{packageId,revision,eventId});assert.equal(proof.phase,phase);assert.equal(proof.receiptHash,r.receiptHash);assert.deepEqual(proof.targets,f.input.targets)}
});
test('acknowledgement is idempotent, immutable and never supplies a new write permission',async()=>{
 const f=fixture();await f.store.report(f.input);const replay=await f.store.report(f.input);assert.equal(replay.status,'WRITER_RECEIPT_REPLAY');assert.equal(replay.writeAuthorized,undefined);assert.equal(f.cmsReads,1);assert.equal((await f.store.report({...f.input,slug:'another-note'})).status,'WRITER_RECEIPT_UNCONFIRMED');assert.equal(f.rows.length,1);
});
test('missing, changed and uncertain CMS identities cannot create a completion receipt',async()=>{
 for(const post of [null,{id:10424,type:'post',slug,status:'draft'},{id:10423,type:'post',slug:'changed',status:'draft'},{id:10423,type:'post',slug,status:'trash'}]){const f=fixture({post});assert.equal((await f.store.report(f.input)).status,'WRITER_RECEIPT_UNCONFIRMED');assert.equal(f.rows.length,0)}
});
test('unreported or ambiguous ledger IDs and absent publication claims remain unresolved',async()=>{
 for(const opts of [{target:[]},{target:[{destination:'OPURO',target_key:targetKey,status:'writing',post_id:null}]},{phase:'PUBLISH',claims:[]}]){const f=fixture(opts);assert.equal((await f.store.report(f.input)).status,'WRITER_RECEIPT_UNCONFIRMED');assert.equal(f.cmsReads,0);assert.equal(f.rows.length,0)}
});
test('invalid caller fields and a failed insert never fabricate completion',async()=>{
 const f=fixture();assert.equal((await f.store.report({...f.input,packageId})).status,'WRITER_RECEIPT_UNCONFIRMED');assert.equal(f.cmsReads,0);
 const fault=fixture({failInsert:true});assert.equal((await fault.store.report(fault.input)).status,'WRITER_RECEIPT_UNCONFIRMED');assert.equal(fault.rows.length,0);
 assert.equal(await readCompletedWriterReceipt(f.c,{packageId,revision,eventId}),null);
});
