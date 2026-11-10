import {createHash,randomBytes} from 'node:crypto';
import {resolveDestinations,destinationLabel} from './original-destinations.mjs';

// Isolated migration; this queue requests a proposal, never a publication.
// A separate authenticated dispatcher must deliver it to the existing Motor.
export const previewGenerationSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_preview_generation_v1 (
 job_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, base_revision INT UNSIGNED NOT NULL,
 owner_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 destination VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 receipt_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 receipt_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 claim_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
 UNIQUE KEY preview_revision(package_id,revision)
) ENGINE=InnoDB`;
const hash=s=>createHash('sha256').update(s).digest('hex');
const hex=/^[a-f0-9]{64}$/;
const pkg=/^tg_[a-f0-9]{40}$/;
const receipt=/^telegram-([1-9][0-9]{0,15})-([1-9][0-9]{0,15})-([0-9]{1,16})$/;
const identity=id=>hash(`opmx:telegram:v1:${id}:${id}`);
function check(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join(',')!=='actorKey,baseRevision,destination,ownerKey,packageId,receiptId,revision'||!pkg.test(x.packageId??'')||!hex.test(x.ownerKey??'')||!hex.test(x.actorKey??'')||!Number.isSafeInteger(x.revision)||x.revision<2||x.revision>=4294967295||!Number.isSafeInteger(x.baseRevision)||x.baseRevision<1||x.baseRevision>=x.revision)return false;
 const r=receipt.exec(x.receiptId??'');if(!r||identity(r[1])!==x.actorKey)return false;
 try{return destinationLabel(resolveDestinations(x.destination))===x.destination}catch{return false}
}
// Invoked only by the correction transaction, after locking the package,
// checking the editor lease, selection, original post IDs and source inventory.
// Never send over the network or change package state within this transaction.
export async function enqueuePreviewGeneration(c,input){
 if(!c?.execute||!check(input))throw Error('INVALID_PREVIEW_GENERATION_REQUEST');
 const {packageId,revision,baseRevision,ownerKey,actorKey,destination,receiptId}=input;
 const jobId=hash(JSON.stringify(['opmx-preview-v1',packageId,revision,baseRevision,ownerKey,actorKey,destination]));
 const receiptHash=hash(receiptId);
 const [insert]=await c.execute("INSERT IGNORE INTO opmx_tg_preview_generation_v1 (job_id,package_id,revision,base_revision,owner_key,actor_key,destination,receipt_hash,receipt_id,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'PENDING',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",[jobId,packageId,revision,baseRevision,ownerKey,actorKey,destination,receiptHash,receiptId]);
 const [rows]=await c.execute('SELECT job_id,package_id,revision,base_revision,owner_key,actor_key,destination,receipt_hash,receipt_id,state FROM opmx_tg_preview_generation_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 const row=rows[0];
 if(rows.length!==1||row.job_id!==jobId||row.package_id!==packageId||Number(row.revision)!==revision||Number(row.base_revision)!==baseRevision||row.owner_key!==ownerKey||row.actor_key!==actorKey||row.destination!==destination||!hex.test(row.receipt_hash??'')||hash(row.receipt_id??'')!==row.receipt_hash||!['PENDING','DISPATCHING','DISPATCHED'].includes(row.state))throw Error('PREVIEW_GENERATION_CONFLICT');
 return {status:insert.affectedRows===1?'PREVIEW_QUEUED':'PREVIEW_ALREADY_QUEUED',jobId};
}

// The supplied delivery function must target the existing Motor's verified
// event subscription. Acceptance proves only that the dispatcher accepted
// the event, never that the Motor received it or completed the proposal.
// Unknown responses are retained as UNCERTAIN and are never retried here.
export function createPreviewGenerationDispatcher({pool,deliver,readSelection,tokenFactory=()=>randomBytes(32).toString('hex')}){
 if(!pool?.getConnection||typeof deliver!=='function'||typeof readSelection!=='function'||typeof tokenFactory!=='function')throw Error('PREVIEW_DISPATCH_CONFIGURATION_INCOMPLETE');
 async function tx(fn){const c=await pool.getConnection();let done=false;try{await c.beginTransaction();const result=await fn(c);await c.commit();done=true;return result}catch(e){if(!done)try{await c.rollback()}catch{}throw e}finally{c.release()}}
 return {async dispatchNext(){
  const claim=await tx(async c=>{
   const [quota]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(quota.length!==1)throw Error('QUOTA_MISSING');
   const [jobs]=await c.execute("SELECT job_id,package_id,revision,base_revision,owner_key,actor_key,destination FROM opmx_tg_preview_generation_v1 WHERE state='PENDING' ORDER BY created_at,job_id LIMIT 1 FOR UPDATE");
   if(!jobs.length)return null;if(jobs.length!==1||!hex.test(jobs[0].job_id??''))throw Error('PREVIEW_DISPATCH_UNCONFIRMED');
   const j=jobs[0],revision=Number(j.revision),baseRevision=Number(j.base_revision);
   const [packages]=await c.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[j.package_id]);
   const [leases]=await c.execute('SELECT owner_key,actor_key,opening_revision FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[j.package_id]);
   const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=? FOR UPDATE',[j.actor_key]);
   let selected=null;if(packages.length===1&&leases.length===1&&sessions.length===1)selected=await readSelection(c,{packageId:j.package_id,revision,ownerKey:j.owner_key,actorKey:j.actor_key});
   const valid=packages.length===1&&packages[0].state==='OPEN'&&Number(packages[0].revision)===revision&&packages[0].owner_key===j.owner_key&&leases.length===1&&leases[0].owner_key===j.owner_key&&leases[0].actor_key===j.actor_key&&Number(leases[0].opening_revision)-1===baseRevision&&sessions.length===1&&sessions[0].package_id===j.package_id&&selected?.packageId===j.package_id&&selected?.revision===revision&&selected?.ownerKey===j.owner_key&&selected?.action==='UPDATE'&&selected?.destination===j.destination;
   if(!valid){await c.execute("UPDATE opmx_tg_preview_generation_v1 SET state='CANCELLED',updated_at=UTC_TIMESTAMP(6) WHERE job_id=? AND state='PENDING'",[j.job_id]);return {status:'STALE_PREVIEW_REQUEST'}}
   const token=tokenFactory();if(!hex.test(token??''))throw Error('INVALID_PREVIEW_DISPATCH_TOKEN');const claimHash=hash(token);
   const [updated]=await c.execute("UPDATE opmx_tg_preview_generation_v1 SET state='DISPATCHING',claim_hash=?,updated_at=UTC_TIMESTAMP(6) WHERE job_id=? AND state='PENDING'",[claimHash,j.job_id]);
   if(updated.affectedRows!==1)throw Error('PREVIEW_DISPATCH_CONFLICT');
   return {jobId:j.job_id,ownerKey:j.owner_key,claimHash,event:{name:'opmx.package.preview',data:{queue_id:'telegram-editorial',package_id:j.package_id,revision,state:'OPEN'},eventId:'preview_'+j.job_id}};
  });
  if(!claim||claim.status)return claim??{status:'NO_PREVIEW_REQUEST'};
  let delivered=false;try{const result=await deliver(claim.event,{ownerKey:claim.ownerKey,jobId:claim.jobId});delivered=result?.accepted===true}catch{}
  return tx(async c=>{
   const state=delivered?'DISPATCHED':'UNCERTAIN';
   const [r]=await c.execute("UPDATE opmx_tg_preview_generation_v1 SET state=?,updated_at=UTC_TIMESTAMP(6) WHERE job_id=? AND state='DISPATCHING' AND claim_hash=?",[state,claim.jobId,claim.claimHash]);
   if(r.affectedRows!==1)throw Error('PREVIEW_DISPATCH_CONFLICT');
   return {status:delivered?'PREVIEW_EVENT_ACCEPTED':'PREVIEW_DELIVERY_UNCERTAIN',retryPermitted:false};
  });
 }};
}
