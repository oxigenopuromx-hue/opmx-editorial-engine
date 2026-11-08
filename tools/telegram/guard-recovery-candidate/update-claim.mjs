// Candidate migration; install only explicitly in an isolated database first.
export const updateClaimSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_update_claims_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, destination VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 post_id BIGINT UNSIGNED NOT NULL, preview_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 operation_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, created_at DATETIME(6) NOT NULL,
 PRIMARY KEY(package_id,revision,destination), UNIQUE KEY(operation_id)
) ENGINE=InnoDB`;
const pkg=/^tg_[a-f0-9]{40}$/,hash=/^[a-f0-9]{64}$/,op=/^[A-Za-z0-9_-]{16,128}$/;
const site=new Set(['OPURO','OPOL','LIBERAL']);

// A claim is NOT a WordPress update and a lost claim response never grants a
// retry. Both providers must read server-owned records under this transaction:
// decision links the explicit UPDATE confirmation, preview and event; evidence
// links the exact payload and existing WP post after authenticated preflight.
// The functions are deliberately not supplied by HTTP or source materials.
export function createUpdateClaimStore({pool,loadVerifiedDecision,loadVerifiedPayloadEvidence}){
 if(!pool?.getConnection||typeof loadVerifiedDecision!=='function'||typeof loadVerifiedPayloadEvidence!=='function')throw Error('UPDATE_CLAIM_CONFIGURATION_INCOMPLETE');
 return {async begin(x){
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join(',')!=='destination,operationId,packageId,payloadHash,postId,previewHash,revision'||!pkg.test(x.packageId??'')||!Number.isSafeInteger(x.revision)||x.revision<2||x.revision>4294967295||!site.has(x.destination)||!Number.isSafeInteger(x.postId)||x.postId<1||!hash.test(x.previewHash??'')||!hash.test(x.payloadHash??'')||!op.test(x.operationId??''))throw Error('INVALID_UPDATE_CLAIM');
  const c=await pool.getConnection();let committed=false;
  try{
   await c.beginTransaction();
   const [packages]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[x.packageId]);
   if(packages.length!==1||packages[0].state!=='READY'||Number(packages[0].revision)!==x.revision){await c.rollback();return {status:'STALE_REVISION',retryPermitted:false}}
   const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[x.packageId,x.revision]);
   if(fences.length!==1||!['READY_TO_WRITE','WRITING'].includes(fences[0].state)){await c.rollback();return {status:'WRITE_NOT_PERMITTED',retryPermitted:false}}
   const [prior]=await c.execute('SELECT state FROM opmx_tg_update_claims_v1 WHERE package_id=? AND revision=? AND destination=? FOR UPDATE',[x.packageId,x.revision,x.destination]);
   if(prior.length){await c.rollback();return {status:'ALREADY_STARTED',retryPermitted:false}}
   const d=await loadVerifiedDecision(c,{packageId:x.packageId,revision:x.revision});
   if(!d||d.packageId!==x.packageId||d.revision!==x.revision||d.action!=='UPDATE'||d.previewHash!==x.previewHash||!Array.isArray(d.posts)||d.posts.filter(p=>p?.destination===x.destination&&p.postId===x.postId).length!==1||new Set(d.posts.map(p=>p?.destination)).size!==d.posts.length){await c.rollback();return {status:'DECISION_UNCONFIRMED',retryPermitted:false}}
   const e=await loadVerifiedPayloadEvidence(c,{...x});
   if(!e||e.packageId!==x.packageId||e.revision!==x.revision||e.destination!==x.destination||e.postId!==x.postId||e.previewHash!==x.previewHash||e.payloadHash!==x.payloadHash||e.operationId!==x.operationId||e.authenticatedCmsPreflight!==true||e.explicitUpdate!==true||e.exactPayload!==true){await c.rollback();return {status:'PREFLIGHT_UNCONFIRMED',retryPermitted:false}}
   await c.execute("INSERT INTO opmx_tg_update_claims_v1 (package_id,revision,destination,post_id,preview_hash,payload_hash,operation_id,state,created_at) VALUES (?,?,?,?,?,?,?,'WRITING',UTC_TIMESTAMP(6))",[x.packageId,x.revision,x.destination,x.postId,x.previewHash,x.payloadHash,x.operationId]);
   if(fences[0].state==='READY_TO_WRITE'){const [changed]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='WRITING',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='READY_TO_WRITE'",[x.packageId,x.revision]);if(changed.affectedRows!==1)throw Error('UPDATE_FENCE_CONFLICT')}
   await c.commit();committed=true;return {status:'UPDATE_STARTED',packageId:x.packageId,revision:x.revision,destination:x.destination,postId:x.postId,operationId:x.operationId,retryPermitted:false};
  }catch(error){if(!committed)try{await c.rollback()}catch{}if(error?.code==='ER_DUP_ENTRY'||error?.errno===1062)return {status:'ALREADY_STARTED',retryPermitted:false};throw Error('UPDATE_CLAIM_UNCONFIRMED',{cause:error})}finally{c.release()}
 }};
}
