import {createHash} from 'node:crypto';
import {buildCorrectionPreview,validateCorrectionConfirmation} from './correction-preview.mjs';
import {resolveDestinations,destinationLabel} from './original-destinations.mjs';

// Explicit migration only; never create tables implicitly on a live request.
export const correctionConfirmationSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_correction_previews_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL,
 preview_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 owner_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 preview_receipt VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 confirmation_receipt VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 preview_json LONGTEXT NOT NULL, state VARCHAR(16) NOT NULL,
 event_id VARCHAR(52) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(6) NOT NULL,
 PRIMARY KEY(package_id,revision,preview_hash), UNIQUE KEY(confirmation_receipt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const digest=x=>createHash('sha256').update(x).digest('hex');
const idPattern=/^tg_[a-f0-9]{40}$/;
const receiptPattern=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/;
const validRevision=x=>Number.isSafeInteger(x)&&x>0&&x<=4294967295;
function identity(input){
 if(!input||typeof input.owner!=='string'||input.owner!==input.chat||!/^[1-9][0-9]{0,15}$/.test(input.owner)||!idPattern.test(input.packageId??'')||!validRevision(input.revision))throw Error('INVALID_CORRECTION_REQUEST');
 const match=receiptPattern.exec(input.receiptId??'');if(!match||match[1]!==input.chat||BigInt(match[2])<1n)throw Error('INVALID_CORRECTION_RECEIPT');
 return {actorKey:digest(`opmx:telegram:v1:${input.owner}:${input.chat}`),messageId:BigInt(match[2])};
}
function exact(x,keys){if(!x||Object.keys(x).sort().join(',')!==keys.sort().join(','))throw Error('INVALID_CORRECTION_REQUEST');}

// Candidate, not wired to HTTP or production. Both dependencies are server
// owned: loadLockedFacts must derive sources and post IDs from trusted records;
// commitConfirmed must validate the fence, seal and enqueue the *existing*
// event atomically on the supplied connection. No client can provide either.
export function createCorrectionConfirmationStore({pool,loadLockedFacts,commitConfirmed,verifyPreviewDelivery,enqueuePreviewGeneration=null}){
 if(!pool?.getConnection||typeof loadLockedFacts!=='function'||typeof commitConfirmed!=='function'||typeof verifyPreviewDelivery!=='function'||(enqueuePreviewGeneration!==null&&typeof enqueuePreviewGeneration!=='function'))throw Error('CORRECTION_CONFIGURATION_INCOMPLETE');
 async function tx(f){const c=await pool.getConnection();let committed=false;try{await c.beginTransaction();const result=await f(c);await c.commit();committed=true;return result}catch(e){if(!committed)try{await c.rollback()}catch{}throw e}finally{c.release()}}
 async function lockPackage(c,x,actor){
  // Same quota-first ordering as the package store and reopen operation.
  const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)throw Error('QUOTA_MISSING');
  const [rows]=await c.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[x.packageId]);
  if(rows.length!==1)return null;
  return rows[0];
 }
 // The package close operation can own the transaction and reserve its
 // authenticated /listo control together with this durable preview request.
 // This helper never commits, releases a connection or sends a message.
 async function previewInTransaction(c,x){
   if(!c||typeof c.execute!=='function')throw Error('INVALID_CORRECTION_TRANSACTION');
   exact(x,['owner','chat','packageId','revision','receiptId']);const {actorKey}=identity(x);
    const pack=await lockPackage(c,x,actorKey);
    if(!pack||pack.state!=='OPEN'||Number(pack.revision)!==x.revision)return {status:'NOT_AVAILABLE'};
    const facts=await loadLockedFacts(c,{packageId:x.packageId,revision:x.revision,ownerKey:pack.owner_key,actorKey});
    if(facts?.previewGenerationRequired===true){
     const scope=facts.previewScope;
     if(!enqueuePreviewGeneration||!scope||scope.packageId!==x.packageId||scope.revision!==x.revision||scope.ownerKey!==pack.owner_key||scope.actorKey!==actorKey)return {status:'PREVIEW_GENERATION_UNAVAILABLE'};
     const queued=await enqueuePreviewGeneration(c,{...scope,receiptId:x.receiptId});
     if(!queued||!['PREVIEW_QUEUED','PREVIEW_ALREADY_QUEUED'].includes(queued.status))throw Error('PREVIEW_GENERATION_UNCONFIRMED');
     return {status:'PREVIEW_GENERATION_REQUESTED'};
    }
    const preview=buildCorrectionPreview({...facts,packageId:x.packageId,revision:x.revision,ownerKey:pack.owner_key,actorKey});
    const [result]=await c.execute("INSERT IGNORE INTO opmx_tg_correction_previews_v1 (package_id,revision,preview_hash,owner_key,preview_receipt,preview_json,state,created_at) VALUES (?,?,?,?,?,?,'PREVIEWED',UTC_TIMESTAMP(6))",[x.packageId,x.revision,preview.previewHash,actorKey,x.receiptId,JSON.stringify(preview)]);
    if(result.affectedRows!==1)return {status:'PREVIEW_EXISTS',preview};
    return {status:'PREVIEW_READY',preview};
 }
 // Read only. The caller must additionally bind this original receipt to the
 // last stored control, current lease and contribution before reusing it.
 // A newer Telegram /listo may query the same result, but cannot replace the
 // original receipt, make another preview revision or restart an uncertain job.
 async function readClosePreviewInTransaction(c,x){
  if(!c||typeof c.execute!=='function')throw Error('INVALID_CORRECTION_TRANSACTION');
  exact(x,['owner','chat','packageId','revision','receiptId']);const {actorKey}=identity(x);
  const pack=await lockPackage(c,x,actorKey);
  if(!pack||pack.state!=='OPEN'||Number(pack.revision)!==x.revision)return null;
  const fail=()=>{throw Error('CLOSE_PREVIEW_CONFLICT')};
  const originalReceipt=value=>{
   try{if(identity({...x,receiptId:value}).actorKey!==actorKey)fail()}catch{fail()}
   return value;
  };
  const [previews]=await c.execute('SELECT preview_hash,owner_key,preview_receipt,preview_json,state FROM opmx_tg_correction_previews_v1 WHERE package_id=? AND revision=? FOR UPDATE',[x.packageId,x.revision]);
  const [jobs]=await c.execute('SELECT job_id,package_id,revision,base_revision,owner_key,actor_key,destination,receipt_hash,receipt_id,state FROM opmx_tg_preview_generation_v1 WHERE package_id=? AND revision=? FOR UPDATE',[x.packageId,x.revision]);
  if(previews.length>1||jobs.length>1)fail();
  if(!previews.length&&!jobs.length)return null;
  let preview=null,previewReceipt=null,job=null,jobReceipt=null;
  if(previews.length){
   const row=previews[0];
   if(row.owner_key!==actorKey||row.state!=='PREVIEWED')fail();
   previewReceipt=originalReceipt(row.preview_receipt);
   try{preview=JSON.parse(row.preview_json)}catch{fail()}
   if(!preview||preview.packageId!==x.packageId||!validRevision(preview.baseRevision)||preview.baseRevision>=x.revision||!validateCorrectionConfirmation({preview,previewHash:row.preview_hash,actorKey,ownerKey:pack.owner_key,currentRevision:x.revision,explicitAction:preview.action}))fail();
   try{if(destinationLabel(resolveDestinations(preview.destination))!==preview.destination)fail()}catch{fail()}
  }
  if(jobs.length){
   job=jobs[0];jobReceipt=originalReceipt(job.receipt_id);
   const baseRevision=Number(job.base_revision);
   if(job.package_id!==x.packageId||Number(job.revision)!==x.revision||job.owner_key!==pack.owner_key||job.actor_key!==actorKey||!validRevision(baseRevision)||baseRevision>=x.revision||digest(jobReceipt)!==job.receipt_hash||!['PENDING','DISPATCHING','DISPATCHED','UNCERTAIN'].includes(job.state))fail();
   try{if(destinationLabel(resolveDestinations(job.destination))!==job.destination)fail()}catch{fail()}
   if(job.job_id!==digest(JSON.stringify(['opmx-preview-v1',x.packageId,x.revision,baseRevision,pack.owner_key,actorKey,job.destination])))fail();
   if(preview&&(preview.action!=='UPDATE'||preview.baseRevision!==baseRevision||preview.destination!==job.destination||previewReceipt!==jobReceipt))fail();
  }
  // A materialized preview is stronger than the dispatch acknowledgement.
  // Its normal delivery ledger still decides whether a part may be sent.
  if(preview)return {receiptId:previewReceipt,result:{status:'PREVIEW_EXISTS',preview}};
  return {receiptId:jobReceipt,result:job.state==='UNCERTAIN'?{status:'PREVIEW_DELIVERY_UNCERTAIN',retryPermitted:false}:{status:'PREVIEW_GENERATION_REQUESTED'}};
 }
 return {
  previewInTransaction,readClosePreviewInTransaction,
  async preview(x){exact(x,['owner','chat','packageId','revision','receiptId']);identity(x);return tx(c=>previewInTransaction(c,x))},
  async confirm(x){
   exact(x,['owner','chat','packageId','revision','receiptId','previewHash','action']);const {actorKey,messageId}=identity(x);
   if(!/^[a-f0-9]{64}$/.test(x.previewHash??'')||!['CREATE','UPDATE'].includes(x.action))throw Error('INVALID_CORRECTION_REQUEST');
   return tx(async c=>{
    const pack=await lockPackage(c,x,actorKey);if(!pack)return {status:'NOT_AVAILABLE'};
    const [rows]=await c.execute('SELECT owner_key,preview_receipt,confirmation_receipt,preview_json,state,event_id FROM opmx_tg_correction_previews_v1 WHERE package_id=? AND revision=? AND preview_hash=? FOR UPDATE',[x.packageId,x.revision,x.previewHash]);
    if(rows.length!==1||rows[0].owner_key!==actorKey)return {status:'NOT_AVAILABLE'};
    const row=rows[0],opened=receiptPattern.exec(row.preview_receipt??'');
    if(!opened||opened[1]!==x.chat||messageId<=BigInt(opened[2]))return {status:'CONFIRMATION_NOT_AUTHENTICATED'};
    if(row.state==='CONFIRMED')return row.confirmation_receipt===x.receiptId?{status:'CONFIRMED_REPLAY',eventId:row.event_id}:{status:'ALREADY_CONFIRMED'};
    if(pack.state!=='OPEN'||Number(pack.revision)!==x.revision)return {status:'NOT_AVAILABLE'};
    if(row.state!=='PREVIEWED')return {status:'NOT_AVAILABLE'};
    let preview;try{preview=JSON.parse(row.preview_json)}catch{throw Error('CORRECTION_PREVIEW_UNCONFIRMED')}
    if(!validateCorrectionConfirmation({preview,previewHash:x.previewHash,actorKey,ownerKey:pack.owner_key,currentRevision:x.revision,explicitAction:x.action}))return {status:'PREVIEW_MISMATCH'};
    // The server-owned verifier must bind every preview part and successful
    // Telegram delivery to this exact preview and recipient. A typed hash by
    // itself does not prove that the complete preview reached the operator.
    if(await verifyPreviewDelivery(c,{packageId:x.packageId,revision:x.revision,previewHash:x.previewHash,actorKey,previewReceipt:row.preview_receipt,confirmationReceipt:x.receiptId})!==true)return {status:'PREVIEW_DELIVERY_UNCONFIRMED'};
    // No result is committed if the existing event and the preview consumption
    // do not both succeed; exceptions roll the entire transaction back.
    const eventId=await commitConfirmed(c,{preview,actorKey,previewReceipt:row.preview_receipt,confirmationReceipt:x.receiptId});
    if(!/^evt_[a-f0-9]{48}$/.test(eventId??''))throw Error('CONFIRMATION_EVENT_UNCONFIRMED');
    const [changed]=await c.execute("UPDATE opmx_tg_correction_previews_v1 SET state='CONFIRMED',confirmation_receipt=?,event_id=? WHERE package_id=? AND revision=? AND preview_hash=? AND state='PREVIEWED'",[x.receiptId,eventId,x.packageId,x.revision,x.previewHash]);
    if(changed.affectedRows!==1)throw Error('CONFIRMATION_CONFLICT');
    return {status:'CONFIRMED',eventId};
   });
  }
 };
}
