import {createHash} from 'node:crypto';
import {readVerifiedUpdateDecisionInTransaction} from './confirmed-correction-reader.mjs';
import {canonicalUpdateValue,validUpdatePayload} from './update-executor.mjs';

// Candidate migration. Do not install automatically in production.
export const updatePayloadSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_update_payloads_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, destination VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 post_id BIGINT UNSIGNED NOT NULL, preview_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, slug VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_json MEDIUMTEXT NOT NULL, created_at DATETIME(6) NOT NULL,
 PRIMARY KEY(package_id,revision,destination)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const sha=x=>createHash('sha256').update(x).digest('hex');
const valid=x=>x&&typeof x==='object'&&!Array.isArray(x)&&/^tg_[a-f0-9]{40}$/.test(x.packageId??'')&&Number.isSafeInteger(x.revision)&&x.revision>=2&&x.revision<=4294967295&&['OPURO','OPOL','LIBERAL'].includes(x.destination)&&/^[a-f0-9]{64}$/.test(x.previewHash??'');

// Only server-owned providers may resolve the historic slug, validate the
// literal/editorial content, and independently verify the authenticated CMS
// preflight. This module never infers authorization from source content.
export function createUpdatePayloadStore({pool,loadVerifiedTarget,verifyPayload,verifyCmsPreflight,loadDecision=readVerifiedUpdateDecisionInTransaction}){
 if(!pool?.getConnection||typeof loadVerifiedTarget!=='function'||typeof verifyPayload!=='function'||typeof verifyCmsPreflight!=='function'||typeof loadDecision!=='function')throw Error('UPDATE_PAYLOAD_CONFIGURATION_INCOMPLETE');
 async function transact(fn){const c=await pool.getConnection();let committed=false;try{await c.beginTransaction();const value=await fn(c);await c.commit();committed=true;return value}catch(e){if(!committed)try{await c.rollback()}catch{}throw e}finally{c.release()}}
 return {
  async stage(input){
   if(!valid(input)||Object.keys(input).sort().join(',')!=='destination,packageId,payload,previewHash,revision'||!validUpdatePayload(input.payload))throw Error('INVALID_UPDATE_PAYLOAD');
   // Snapshot bytes before awaiting any provider so input cannot change while
   // it is checked or written.
   const encoded=canonicalUpdateValue(input.payload),payload=JSON.parse(encoded),payloadHash=sha(encoded);
   return transact(async c=>{
    const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)throw Error('QUOTA_MISSING');
    const [p]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);
    if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==input.revision)return {status:'STALE_REVISION'};
    const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[input.packageId,input.revision]);
    if(f.length!==1||!['AWAITING_DECISION','READY_TO_WRITE'].includes(f[0].state))return {status:'PAYLOAD_NOT_PERMITTED'};
    const d=await loadDecision(c,{packageId:input.packageId,revision:input.revision});
    if(!d||d.packageId!==input.packageId||d.revision!==input.revision||d.action!=='UPDATE'||d.previewHash!==input.previewHash||!Array.isArray(d.posts)||new Set(d.posts.map(x=>x?.destination)).size!==d.posts.length)return {status:'DECISION_UNCONFIRMED'};
    const targets=d.posts.filter(x=>x?.destination===input.destination);if(targets.length!==1||!Number.isSafeInteger(targets[0].postId)||targets[0].postId<1)return {status:'DECISION_UNCONFIRMED'};
    const postId=targets[0].postId,scope={packageId:input.packageId,revision:input.revision,destination:input.destination,previewHash:input.previewHash,postId,payloadHash};
    const target=await loadVerifiedTarget(c,scope);
    if(!target||Object.keys(scope).some(k=>target[k]!==scope[k])||typeof target.slug!=='string'||target.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.slug))return {status:'TARGET_UNCONFIRMED'};
    const [prior]=await c.execute('SELECT post_id,preview_hash,payload_hash,slug,payload_json FROM opmx_tg_update_payloads_v1 WHERE package_id=? AND revision=? AND destination=? FOR UPDATE',[input.packageId,input.revision,input.destination]);
    if(prior.length){const x=prior[0];return prior.length===1&&Number(x.post_id)===postId&&x.preview_hash===input.previewHash&&x.payload_hash===payloadHash&&x.slug===target.slug&&x.payload_json===encoded?{status:'PAYLOAD_REPLAY',...scope}:{status:'PAYLOAD_CONFLICT'}}
    const proof=await verifyPayload(c,{...scope,contentMode:d.contentMode,payload});
    if(!proof||Object.keys(scope).some(k=>proof[k]!==scope[k])||proof.contentMode!==d.contentMode||proof.exactPayload!==true)return {status:'PAYLOAD_UNCONFIRMED'};
    await c.execute('INSERT INTO opmx_tg_update_payloads_v1 (package_id,revision,destination,post_id,preview_hash,payload_hash,slug,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',[input.packageId,input.revision,input.destination,postId,input.previewHash,payloadHash,target.slug,encoded]);
    return {status:'PAYLOAD_STAGED',...scope};
   });
  },
  async load(input){
   if(!valid(input)||Object.keys(input).sort().join(',')!=='destination,packageId,previewHash,revision')throw Error('INVALID_UPDATE_PAYLOAD');
   return transact(async c=>{
    const [rows]=await c.execute('SELECT post_id,preview_hash,payload_hash,slug,payload_json FROM opmx_tg_update_payloads_v1 WHERE package_id=? AND revision=? AND destination=? FOR UPDATE',[input.packageId,input.revision,input.destination]);
    if(rows.length!==1)return null;const x=rows[0];let payload;try{payload=JSON.parse(x.payload_json)}catch{return null}
    if(x.preview_hash!==input.previewHash||!Number.isSafeInteger(Number(x.post_id))||Number(x.post_id)<1||!validUpdatePayload(payload)||canonicalUpdateValue(payload)!==x.payload_json||sha(x.payload_json)!==x.payload_hash)return null;
    return {...input,postId:Number(x.post_id),slug:x.slug,payload,exactPayload:true};
   });
  },
  // Called only from update-claim, while quota, package and fence are locked.
  async verifyClaim(c,input){
   if(!c?.execute||!valid(input)||!Number.isSafeInteger(input.postId)||input.postId<1||!/^[a-f0-9]{64}$/.test(input.payloadHash??''))return null;
   const [rows]=await c.execute('SELECT post_id,preview_hash,payload_hash,payload_json FROM opmx_tg_update_payloads_v1 WHERE package_id=? AND revision=? AND destination=? FOR UPDATE',[input.packageId,input.revision,input.destination]);
   if(rows.length!==1||Number(rows[0].post_id)!==input.postId||rows[0].preview_hash!==input.previewHash||rows[0].payload_hash!==input.payloadHash||sha(rows[0].payload_json)!==input.payloadHash)return null;
   const proof=await verifyCmsPreflight(c,input);
   if(!proof||Object.keys(input).some(k=>proof[k]!==input[k])||proof.authenticatedCmsPreflight!==true)return null;
   return {...input,authenticatedCmsPreflight:true,explicitUpdate:true,exactPayload:true};
  }
 };
}
