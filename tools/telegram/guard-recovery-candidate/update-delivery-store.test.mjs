import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createUpdateDeliveryStore} from './update-delivery-store.mjs';import {canonicalUpdateValue} from './canonical-json.mjs';
const payload={title:'Texto confirmado'},payloadHash=createHash('sha256').update(canonicalUpdateValue(payload)).digest('hex');
const x={packageId:'tg_'+'a'.repeat(40),revision:8,destination:'OPURO',postId:15,previewHash:'b'.repeat(64),payloadHash,operationId:'upd_'+'c'.repeat(64),slug:'nota-existente',payload};
function fixture(){
 const s={job:null,claimState:'WRITING',revision:8,requests:0,post:{id:15,type:'post',slug:x.slug,status:'publish',title:{raw:payload.title}},badProof:false,drop:false};
 const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql,a){
  if(sql.startsWith('SELECT id FROM'))return [[{id:1}]];
  if(sql.startsWith('SELECT state,revision'))return [[{state:'READY',revision:s.revision}]];
  if(sql.startsWith('SELECT state FROM opmx_tg_publication'))return [[{state:'WRITING'}]];
  if(sql.startsWith('SELECT state,operation_id'))return [[{state:s.claimState,operation_id:x.operationId,post_id:15,preview_hash:x.previewHash,payload_hash:payloadHash}]];
  if(sql.startsWith('INSERT INTO opmx_tg_update_deliveries')){
   if(s.job)throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});
   const [operation_id,job_id,token_hash,package_id,revision,destination,post_id,preview_hash,payload_hash,slug,payload_json]=a;s.job={operation_id,job_id,token_hash,package_id,revision,destination,post_id,preview_hash,payload_hash,slug,payload_json,state:'QUEUED'};return [{affectedRows:1}];
  }
  if(sql.startsWith('SELECT package_id,revision,destination'))return [s.job&&s.job.job_id===a[0]?[s.job]:[]];
  if(sql.startsWith('SELECT state,token_hash'))return [s.job?[s.job]:[]];
  if(sql.startsWith('SELECT state,payload_hash'))return [s.job?[s.job]:[]];
  if(sql.includes("SET state='DISPATCHED'")){s.job.state='DISPATCHED';s.job.token_hash=a[0];return [{affectedRows:1}]}
  if(sql.includes("opmx_tg_update_deliveries_v1 SET state='CONFIRMED'")){s.job.state='CONFIRMED';return [{affectedRows:1}]}
  if(sql.includes("opmx_tg_update_claims_v1 SET state='CONFIRMED'")){s.claimState='CONFIRMED';return [{affectedRows:1}]}
  throw Error(sql);
 }};
 let service;service=createUpdateDeliveryStore({pool:{getConnection:async()=>c},secret:'d'.repeat(64),random:()=> 'e'.repeat(48),readWordPress:async()=>({statusCode:200,post:s.post}),verifyPayloadEvidence:async()=>s.badProof?null:{payloadHash},loadTarget:async()=>({slug:x.slug}),fetchImpl:async(url,opts)=>{
  s.requests++;assert.equal(url,'https://n8n.oxigenopuro.com.mx/webhook/opmx-confirmed-update-v1');const input=JSON.parse(opts.body);assert.deepEqual(Object.keys(input).sort(),['jobId','token']);const grant=await service.consume(input);s.grant=grant;s.jobInput=input;
  if(s.drop)throw Error('lost response');return {status:200,json:async()=>({status:grant.status==='UPDATE_PAYLOAD_GRANTED'?'UPDATE_TRANSPORT_CONFIRMED':'UPDATE_TRANSPORT_UNCERTAIN',jobId:grant.jobId,destination:grant.destination,postId:grant.postId,statusCode:200})};
 }});return {s,service};
}
test('one scoped claim dispatches one immutable payload and records a fresh exact CMS readback',async()=>{
 const {s,service}=fixture();assert.equal((await service.wordpress.updateConfirmed(x)).statusCode,200);assert.equal(s.grant.postId,15);assert.deepEqual(s.grant.payload,payload);assert.equal(s.job.state,'DISPATCHED');
 assert.equal((await service.consume(s.jobInput)).status,'UPDATE_DELIVERY_UNCONFIRMED');
 assert.equal((await service.wordpress.recordConfirmation(x)).status,'UPDATE_RECEIPT_RECORDED');assert.equal(s.claimState,'CONFIRMED');assert.equal(s.job.state,'CONFIRMED');
 assert.equal((await service.wordpress.updateConfirmed(x)).status,'UPDATE_DELIVERY_UNCONFIRMED');assert.equal(s.requests,1);
});
test('missing confirmation evidence and stale revisions cannot dispatch a write',async()=>{
 for(const change of [s=>s.badProof=true,s=>s.revision=9,s=>s.claimState='CONFIRMED']){const {s,service}=fixture();change(s);assert.equal((await service.wordpress.updateConfirmed(x)).status,'UPDATE_DELIVERY_UNCONFIRMED');assert.equal(s.requests,0)}
});
test('a lost dispatch response keeps the unique claim and never retries CMS',async()=>{
 const {s,service}=fixture();s.drop=true;assert.equal((await service.wordpress.updateConfirmed(x)).status,'UPDATE_DELIVERY_UNCONFIRMED');assert.equal(s.job.state,'DISPATCHED');assert.equal((await service.wordpress.updateConfirmed(x)).status,'UPDATE_DELIVERY_UNCONFIRMED');assert.equal(s.requests,1);
});
test('a changed raw field or CMS identity cannot manufacture a durable update receipt',async()=>{
 for(const change of [p=>p.id=16,p=>p.slug='other',p=>p.title.raw='different']){const {s,service}=fixture();await service.wordpress.updateConfirmed(x);change(s.post);assert.equal((await service.wordpress.recordConfirmation(x)).status,'UPDATE_DELIVERY_UNCONFIRMED');assert.equal(s.claimState,'WRITING')}
});
test('public input cannot provide content or bypass the opaque job capability',async()=>{
 const {s,service}=fixture();for(const input of [{jobId:'uj_'+'e'.repeat(48),token:'e'.repeat(64),payload},{jobId:'uj_'+'e'.repeat(48),token:'invalid'}])assert.equal((await service.consume(input)).status,'UPDATE_DELIVERY_UNCONFIRMED');
 await assert.rejects(()=>service.wordpress.update({destination:'OPURO',postId:15,payload}),/SCOPED_UPDATE_REQUIRED/);assert.equal(s.requests,0);
});
