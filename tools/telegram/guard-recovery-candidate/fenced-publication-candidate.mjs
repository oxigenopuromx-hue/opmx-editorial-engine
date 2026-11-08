import {createHash} from 'node:crypto';
import {destinationLabel,resolveDestinations} from './original-destinations.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
export const publicationClaimSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_publication_claims_v1 (
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, slug VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 destinations VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(6) NOT NULL, KEY package_revision(package_id,revision)
) ENGINE=InnoDB`;
const hash=x=>createHash('sha256').update(x).digest('hex');
// Candidate only: claim immediately before any WordPress publication write.
// No timeout or replay grants another attempt. The caller must still perform
// authenticated preflight/readback and reconcile all uncertain outcomes.
export async function beginFencedPublication(pool,input){
 if(!pool?.getConnection||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='requestId,slug,targets'||!/^tg_[a-f0-9]{64}$/.test(input.requestId??'')||typeof input.slug!=='string'||input.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)||!Array.isArray(input.targets)||!input.targets.length||input.targets.length>3)throw Error('INVALID_PUBLICATION_CLAIM');
 const seen=new Set();for(const t of input.targets){if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).sort().join(',')!=='destination,postId'||!['OPURO','OPOL','LIBERAL'].includes(t.destination)||seen.has(t.destination)||!Number.isSafeInteger(t.postId)||t.postId<1)throw Error('INVALID_PUBLICATION_CLAIM');seen.add(t.destination)}
 const destinations=destinationLabel(resolveDestinations([...seen]));const c=await pool.getConnection();let committed=false;
 try{
  await c.beginTransaction();
  const [bindings]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=?',[input.requestId]);
  if(bindings.length!==1){await c.rollback();return {status:'NOT_BOUND',action:'manual_reconciliation'}}
  const b=bindings[0];if(expectedDraftRequestId({packageId:b.package_id,revision:Number(b.revision),destination:destinations})!==input.requestId){await c.rollback();return {status:'TARGETS_UNCONFIRMED',action:'manual_reconciliation'}}
  const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[b.package_id,b.revision]);
  if(fences.length!==1||!['READY_TO_WRITE','WRITING'].includes(fences[0].state)){await c.rollback();return {status:'WRITE_NOT_PERMITTED',action:'manual_reconciliation'}}
  const [check]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=? FOR UPDATE',[input.requestId]);
  if(check.length!==1||check[0].package_id!==b.package_id||Number(check[0].revision)!==Number(b.revision)){await c.rollback();return {status:'NOT_BOUND',action:'manual_reconciliation'}}
  for(const t of [...input.targets].sort((a,b)=>a.destination.localeCompare(b.destination))){
   const key=hash(`opmx:v1:${t.destination}:${input.slug}`);
   const [rows]=await c.execute('SELECT status,post_id FROM opmx_mcp_target_progress WHERE target_key=? AND request_id=? AND destination=? FOR UPDATE',[key,input.requestId,t.destination]);
   if(rows.length!==1||rows[0].status!=='reported'||String(rows[0].post_id)!==String(t.postId)){await c.rollback();return {status:'TARGETS_UNCONFIRMED',action:'manual_reconciliation'}}
  }
  await c.execute('INSERT INTO opmx_tg_publication_claims_v1 (request_id,package_id,revision,slug,destinations,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(6))',[input.requestId,b.package_id,b.revision,input.slug,destinations]);
  if(fences[0].state==='READY_TO_WRITE'){const [updated]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='WRITING',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='READY_TO_WRITE'",[b.package_id,b.revision]);if(updated.affectedRows!==1)throw Error('FENCE_CONFLICT')}
  await c.commit();committed=true;return {status:'PUBLICATION_STARTED',requestId:input.requestId,packageId:b.package_id,revision:Number(b.revision),destination:destinations};
 }catch(e){if(!committed)try{await c.rollback()}catch{}if(e?.code==='ER_DUP_ENTRY'||e?.errno===1062)return {status:'ALREADY_STARTED',action:'manual_reconciliation'};throw Error('PUBLICATION_CLAIM_UNCONFIRMED',{cause:e})}finally{c.release()}
}
