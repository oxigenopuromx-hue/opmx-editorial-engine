import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {validUpdatePayload,cmsMatches} from './update-executor.mjs';
import {verifyConfirmedUpdatePayload} from './confirmed-payload-verifier.mjs';
import {loadVerifiedUpdateTarget} from './verified-update-posts.mjs';
import {readVerifiedUpdateDecisionInTransaction} from './confirmed-correction-reader.mjs';

export const updateDeliverySchema=`CREATE TABLE IF NOT EXISTS opmx_tg_update_deliveries_v1 (
 operation_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 job_id VARCHAR(51) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL,destination VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 post_id BIGINT UNSIGNED NOT NULL,preview_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 slug VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,payload_json MEDIUMTEXT NOT NULL,
 state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(6) NOT NULL,updated_at DATETIME(6) NOT NULL,KEY(package_id,revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const hash=x=>createHash('sha256').update(x).digest('hex');
const endpoint='https://n8n.oxigenopuro.com.mx/webhook/opmx-confirmed-update-v1';
const no=()=>({status:'UPDATE_DELIVERY_UNCONFIRMED',retryPermitted:false});
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===64&&b.length===64&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const valid=x=>x&&Object.keys(x).sort().join(',')==='destination,operationId,packageId,payload,payloadHash,postId,previewHash,revision,slug'&&/^tg_[a-f0-9]{40}$/.test(x.packageId??'')&&Number.isSafeInteger(x.revision)&&x.revision>=2&&['OPURO','OPOL','LIBERAL'].includes(x.destination)&&Number.isSafeInteger(x.postId)&&x.postId>0&&/^[a-f0-9]{64}$/.test(x.previewHash??'')&&/^[a-f0-9]{64}$/.test(x.payloadHash??'')&&/^upd_[a-f0-9]{64}$/.test(x.operationId??'')&&typeof x.slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.slug)&&validUpdatePayload(x.payload)&&hash(canonicalUpdateValue(x.payload))===x.payloadHash;

// This is a transport for the one existing writer, not a public write API.
// Its private webhook receives only a one-use job capability. The target ID
// and exact payload come back from Guard after consuming the durable claim.
// Credentials remain in n8n. No caller can select a CMS URL or submit a body
// to consume(); a lost dispatch or readback never produces a retry permit.
export function createUpdateDeliveryStore({pool,secret,readWordPress,fetchImpl=fetch,random=()=>randomBytes(24).toString('hex'),verifyPayloadEvidence=null,loadTarget=loadVerifiedUpdateTarget}){
 if(!pool?.getConnection||typeof secret!=='string'||!/^[a-f0-9]{64,}$/.test(secret)||typeof readWordPress!=='function')throw Error('UPDATE_DELIVERY_CONFIGURATION_INVALID');
 async function tx(fn){const c=await pool.getConnection();let done=false;try{await c.beginTransaction();const r=await fn(c);await c.commit();done=true;return r}catch(e){if(!done)try{await c.rollback()}catch{}throw e}finally{c.release()}}
 async function verifyPayload(c,x){if(verifyPayloadEvidence)return verifyPayloadEvidence(c,x);const d=await readVerifiedUpdateDecisionInTransaction(c,{packageId:x.packageId,revision:x.revision});return d?verifyConfirmedUpdatePayload(c,{...x,contentMode:d.contentMode}):null}
 async function lockClaim(c,x){
  const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)return false;
  const [p]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[x.packageId]);
  const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[x.packageId,x.revision]);
  if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==x.revision||f.length!==1||f[0].state!=='WRITING')return false;
  const [claims]=await c.execute('SELECT state,operation_id,post_id,preview_hash,payload_hash FROM opmx_tg_update_claims_v1 WHERE package_id=? AND revision=? AND destination=? FOR UPDATE',[x.packageId,x.revision,x.destination]);
  return claims.length===1&&claims[0].state==='WRITING'&&claims[0].operation_id===x.operationId&&Number(claims[0].post_id)===x.postId&&claims[0].preview_hash===x.previewHash&&claims[0].payload_hash===x.payloadHash;
 }
 async function updateConfirmed(x){
  if(!valid(x))return no();
  const token=random()+random().slice(0,16),jobId='uj_'+random();
  if(!/^[a-f0-9]{64}$/.test(token)||!/^uj_[a-f0-9]{48}$/.test(jobId))return no();
  let created;try{created=await tx(async c=>{
   if(!await lockClaim(c,x))return false;
   const evidence=await verifyPayload(c,x),target=await loadTarget(c,x);
   if(!evidence||evidence.payloadHash!==x.payloadHash||target?.slug!==x.slug)return false;
   const [insert]=await c.execute("INSERT INTO opmx_tg_update_deliveries_v1 (operation_id,job_id,token_hash,package_id,revision,destination,post_id,preview_hash,payload_hash,slug,payload_json,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'QUEUED',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",[x.operationId,jobId,hash(token),x.packageId,x.revision,x.destination,x.postId,x.previewHash,x.payloadHash,x.slug,canonicalUpdateValue(x.payload)]);
   return insert.affectedRows===1;
  })}catch{return no()}
  if(!created)return no();
  try{
   const r=await fetchImpl(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({jobId,token})});
   if(r.status!==200)return no();const b=await r.json();
   if(b?.status!=='UPDATE_TRANSPORT_CONFIRMED'||b.jobId!==jobId||b.destination!==x.destination||b.postId!==x.postId||!Number.isInteger(b.statusCode)||b.statusCode<200||b.statusCode>=300)return no();
   return {statusCode:b.statusCode,post:{id:x.postId}};
  }catch{return no()}
 }
 async function consume(input){
  if(!input||Object.keys(input).sort().join(',')!=='jobId,token'||!/^uj_[a-f0-9]{48}$/.test(input.jobId??'')||!/^[a-f0-9]{64}$/.test(input.token??''))return no();
  try{return await tx(async c=>{
   // Immutable lookup first, then the shared quota/package/fence lock order.
   const [lookup]=await c.execute('SELECT package_id,revision,destination,post_id,preview_hash,payload_hash,operation_id FROM opmx_tg_update_deliveries_v1 WHERE job_id=?',[input.jobId]);if(lookup.length!==1)return no();
   const r=lookup[0],x={packageId:r.package_id,revision:Number(r.revision),destination:r.destination,postId:Number(r.post_id),previewHash:r.preview_hash,payloadHash:r.payload_hash,operationId:r.operation_id};
   if(!await lockClaim(c,x))return no();
   const [jobs]=await c.execute('SELECT state,token_hash,payload_json,slug FROM opmx_tg_update_deliveries_v1 WHERE job_id=? FOR UPDATE',[input.jobId]);
   if(jobs.length!==1||jobs[0].state!=='QUEUED'||!equal(jobs[0].token_hash,hash(input.token)))return no();
   const j=jobs[0];let payload;try{payload=JSON.parse(j.payload_json)}catch{return no()}
   if(!validUpdatePayload(payload)||canonicalUpdateValue(payload)!==j.payload_json||hash(j.payload_json)!==x.payloadHash)return no();
   const evidence=await verifyPayload(c,{...x,payload,slug:j.slug}),target=await loadTarget(c,x);
   if(!evidence||evidence.payloadHash!==x.payloadHash||target?.slug!==j.slug)return no();
   const [changed]=await c.execute("UPDATE opmx_tg_update_deliveries_v1 SET state='DISPATCHED',token_hash=?,updated_at=UTC_TIMESTAMP(6) WHERE job_id=? AND state='QUEUED'",['0'.repeat(64),input.jobId]);
   if(changed.affectedRows!==1)throw Error('UPDATE_DISPATCH_CONFLICT');
   return {status:'UPDATE_PAYLOAD_GRANTED',jobId:input.jobId,destination:x.destination,postId:x.postId,payload,retryPermitted:false};
  })}catch{return no()}
 }
 async function recordConfirmation(x){
  if(!valid(x))return no();
  let cms;try{cms=await readWordPress({destination:x.destination,postId:x.postId})}catch{return no()}
  if(cms?.statusCode!==200||!cmsMatches(cms.post,x.postId,x.slug,x.payload))return no();
  try{return await tx(async c=>{
   if(!await lockClaim(c,x))return no();
   const [jobs]=await c.execute('SELECT state,payload_hash FROM opmx_tg_update_deliveries_v1 WHERE operation_id=? FOR UPDATE',[x.operationId]);
   if(jobs.length!==1||jobs[0].state!=='DISPATCHED'||jobs[0].payload_hash!==x.payloadHash)return no();
   const [j]=await c.execute("UPDATE opmx_tg_update_deliveries_v1 SET state='CONFIRMED',updated_at=UTC_TIMESTAMP(6) WHERE operation_id=? AND state='DISPATCHED'",[x.operationId]);
   const [a]=await c.execute("UPDATE opmx_tg_update_claims_v1 SET state='CONFIRMED' WHERE operation_id=? AND state='WRITING'",[x.operationId]);
   if(j.affectedRows!==1||a.affectedRows!==1)throw Error('UPDATE_RECEIPT_CONFLICT');
   return {status:'UPDATE_RECEIPT_RECORDED',operationId:x.operationId};
  })}catch{return no()}
 }
 return Object.freeze({consume,wordpress:{read:readWordPress,update:async()=>{throw Error('SCOPED_UPDATE_REQUIRED')},updateConfirmed,recordConfirmation}});
}
