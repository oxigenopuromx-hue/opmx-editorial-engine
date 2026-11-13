import {createHash} from 'node:crypto';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {destinationLabel,resolveDestinations} from './original-destinations.mjs';
import {readCompletedWriterReceipt} from './writer-receipt-store.mjs';
import {readLiteralScopeInTransaction} from './literal-payload-store.mjs';

// Acceptance is durable bookkeeping, never a second writer or a write permit.
// Only the first accepted execution may continue the existing writer graph.
export const publisherSubmissionSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_publisher_submissions_v1 (
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, event_id VARCHAR(52) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 phase VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 destination VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 slug VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 execution_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 submission_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 telegram_notice VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 receipt_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
 PRIMARY KEY(request_id), UNIQUE KEY(package_id,revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const sha=x=>createHash('sha256').update(x).digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const phase=x=>['DRAFT','PUBLISH'].includes(x);
const failed=()=>({status:'SUBMISSION_UNCONFIRMED',retryPermitted:false,writeAuthorized:false});
const fields=['requestId','packageId','revision','eventId','phase','destination','slug','fingerprint','executionId','actorKey'];
function normalizedRow(row){
 if(!row)return null;
 const r={requestId:row.request_id,packageId:row.package_id,revision:Number(row.revision),eventId:row.event_id,phase:row.phase,destination:row.destination,slug:row.slug,fingerprint:row.fingerprint,executionId:row.execution_id,actorKey:row.actor_key};
 let destinations;try{destinations=resolveDestinations(r.destination)}catch{return null}
 if(!/^tg_[a-f0-9]{40}$/.test(r.packageId??'')||!Number.isSafeInteger(r.revision)||r.revision<1||r.revision>4294967295||!/^evt_[a-f0-9]{48}$/.test(r.eventId??'')||!phase(r.phase)||destinationLabel(destinations)!==r.destination||expectedDraftRequestId(r)!==r.requestId||typeof r.slug!=='string'||r.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)||!hex(r.fingerprint)||!hex(r.actorKey)||!/^\d{1,32}$/.test(r.executionId??'')||sha(canonicalUpdateValue(r))!==row.submission_hash||!['SUBMITTED','COMPLETE','UNCERTAIN'].includes(row.state)||!['NOT_RECORDED','SENT','UNCERTAIN'].includes(row.telegram_notice)||row.receipt_hash!==null&&!hex(row.receipt_hash))return null;
 return r;
}
function receiptMatchesSubmission(proof,row){
 try{const r=normalizedRow(row);return !!r&&proof?.packageId===r.packageId&&proof.revision===r.revision&&proof.requestId===r.requestId&&proof.phase===r.phase&&proof.slug===r.slug&&hex(proof.receiptHash)&&Array.isArray(proof.targets)&&destinationLabel(proof.targets.map(x=>x.destination))===r.destination&&(row.state!=='COMPLETE'||row.receipt_hash===proof.receiptHash)}catch{return false}
}
async function lockRows(c,packageId,revision){
 const [attempts]=await c.execute('SELECT state,event_id FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 return {attempts,fences};
}

// The caller already authenticated and locked this exact package (manifest).
// This is a historical writer receipt: no runtime scan or current CMS claim.
export async function readPublisherSubmissionResultInTransaction(c,{pack}){
 const packageId=pack?.package_id,revision=Number(pack?.revision);
 if(!c?.execute||!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||revision<1)return undefined;
 const [rows]=await c.execute('SELECT * FROM opmx_tg_publisher_submissions_v1 WHERE package_id=? AND revision=?',[packageId,revision]);
 if(!rows.length)return undefined;
 const unavailable={schema:'opmx.publisher-submission-result.v1',status:'SUBMISSION_UNCONFIRMED',packageId,revision,retryPermitted:false,writeAuthorized:false,currentCmsState:'NOT_CHECKED',publicVisibility:'NOT_CHECKED'};
 if(rows.length!==1||!normalizedRow(rows[0]))return unavailable;
 const row=rows[0],r=normalizedRow(row),{attempts,fences}=await lockRows(c,packageId,revision);
 if(attempts.length!==1||attempts[0].event_id!==r.eventId||!['RUNNING','COMPLETED','BLOCKED','REVOKED'].includes(attempts[0].state)||fences.length!==1)return unavailable;
 const proof=await readCompletedWriterReceipt(c,{packageId,revision,eventId:r.eventId,expectedPhase:r.phase});
 const base={...unavailable,requestId:r.requestId,phase:r.phase,destination:r.destination,slug:r.slug,submissionHash:row.submission_hash,telegramNotice:row.telegram_notice};
 if(!receiptMatchesSubmission(proof,row))return {...base,status:row.state==='UNCERTAIN'?'SUBMISSION_UNCERTAIN':'SUBMISSION_PENDING'};
 return {...base,status:'WRITER_RESULT_CONFIRMED',historical:true,receiptHash:proof.receiptHash,targets:proof.targets.map(x=>({destination:x.destination,postId:x.postId,slug:proof.slug,status:r.phase==='PUBLISH'?'publish':'draft'}))};
}

// Used by BOTH Motor-completion providers. A PUBLISH submission cannot be
// completed with the authentic but intermediate DRAFT receipt.
export async function readSubmissionCompletedWriterReceipt(c,scope){
 const [rows]=await c.execute('SELECT * FROM opmx_tg_publisher_submissions_v1 WHERE package_id=? AND revision=?',[scope.packageId,scope.revision]);
 // Completion follows the active claim, unlike historical display. If an
 // explicit publication began after a DRAFT delivery, do not freeze that
 // in-flight publication on the strength of the older DRAFT receipt.
 const proof=await readCompletedWriterReceipt(c,scope);
 if(!rows.length)return proof;
 return rows.length===1&&rows[0].event_id===scope.eventId&&receiptMatchesSubmission(proof,rows[0])?proof:null;
}

export function createPublisherSubmissionStore({pool,adminUserIds=[],readOriginalScope=readLiteralScopeInTransaction}){
 if(!pool?.getConnection||typeof readOriginalScope!=='function'||!Array.isArray(adminUserIds)||adminUserIds.some(x=>typeof x!=='string'||!/^[1-9][0-9]{0,15}$/.test(x)))throw Error('SUBMISSION_CONFIGURATION_INVALID');
 const admins=new Set(adminUserIds);
 const transaction=async fn=>{const c=await pool.getConnection();let committed=false;try{await c.beginTransaction();const result=await fn(c);await c.commit();committed=true;return result}catch{if(!committed)try{await c.rollback()}catch{}return failed()}finally{c.release()}};
 return {
  async begin(input){
   if(!input||Object.keys(input).sort().join(',')!=='chat,destination,executionId,fingerprint,owner,phase,requestId,slug'||typeof input.owner!=='string'||input.owner!==input.chat||!/^[1-9][0-9]{0,15}$/.test(input.owner)||!/^tg_[a-f0-9]{64}$/.test(input.requestId??'')||!phase(input.phase)||!hex(input.fingerprint)||!/^\d{1,32}$/.test(input.executionId??'')||typeof input.slug!=='string'||input.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))return failed();
   let selected;try{selected=resolveDestinations(input.destination);if(destinationLabel(selected)!==input.destination)return failed()}catch{return failed()}
   return transaction(async c=>{
    const [quota]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(quota.length!==1)return failed();
    const [bindings]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=?',[input.requestId]);if(bindings.length!==1)return failed();
    const b=bindings[0],packageId=b.package_id,revision=Number(b.revision),actorKey=sha(`opmx:telegram:v1:${input.owner}:${input.chat}`);
    if(expectedDraftRequestId({packageId,revision,destination:input.destination})!==input.requestId)return failed();
    const [packs]=await c.execute('SELECT state,revision,owner_key FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    if(packs.length!==1||packs[0].state!=='READY'||Number(packs[0].revision)!==revision||packs[0].owner_key!==actorKey&&!admins.has(input.owner))return failed();
    const {attempts,fences}=await lockRows(c,packageId,revision);
    if(fences.length!==1)return failed();
    if(!attempts.length){
     const [submissions]=await c.execute('SELECT * FROM opmx_tg_publisher_submissions_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
     const [decisions]=await c.execute('SELECT decision_json FROM opmx_tg_confirmed_decisions_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
     const [closures]=await c.execute('SELECT package_id FROM opmx_tg_recovery_closures_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
     if(submissions.length||decisions.length||closures.length||fences[0].state!=='READY_TO_WRITE')return failed();
     let scope;try{scope=await readOriginalScope(c,{packageId,revision})}catch{return failed()}
     if(scope?.packageId!==packageId||scope.revision!==revision||scope.ownerKey!==packs[0].owner_key||scope.contentMode!=='EDITORIAL'||scope.destination!==input.destination||scope.previewHash!==null)return failed();
     // Preserve only the already-existing historical synchronous writer path.
     // No acceptance row, phase completion, permission or async ACK is issued.
     return {status:'SUBMISSION_SYNC_REQUIRED',legacyHistorical:true,packageId,revision,requestId:input.requestId,phase:input.phase,destination:input.destination,slug:input.slug,fingerprint:input.fingerprint,retryPermitted:false,writeAuthorized:false};
    }
    if(attempts.length!==1||!/^evt_[a-f0-9]{48}$/.test(attempts[0].event_id??''))return failed();
    const r={requestId:input.requestId,packageId,revision,eventId:attempts[0].event_id,phase:input.phase,destination:input.destination,slug:input.slug,fingerprint:input.fingerprint,executionId:input.executionId,actorKey};
    const [prior]=await c.execute('SELECT * FROM opmx_tg_publisher_submissions_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    const ack=(row,status)=>({status,packageId,revision,requestId:r.requestId,phase:r.phase,destination:r.destination,slug:r.slug,fingerprint:r.fingerprint,submissionHash:row.submission_hash,retryPermitted:false,writeAuthorized:false});
    if(prior.length){const old=prior.length===1&&normalizedRow(prior[0]);return old&&fields.filter(x=>x!=='executionId').every(x=>old[x]===r[x])?ack(prior[0],'SUBMISSION_REPLAY'):failed()}
    if(attempts[0].state!=='RUNNING'||fences[0].state!=='READY_TO_WRITE')return failed();
    const [classes]=await c.execute('SELECT kind FROM opmx_tg_request_class_v1 WHERE request_id=?',[r.requestId]);if(classes.length!==1||classes[0].kind!=='TELEGRAM')return failed();
    const hash=sha(canonicalUpdateValue(r));
    const [inserted]=await c.execute("INSERT INTO opmx_tg_publisher_submissions_v1 (request_id,package_id,revision,event_id,phase,destination,slug,fingerprint,execution_id,actor_key,submission_hash,state,telegram_notice,receipt_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'SUBMITTED','NOT_RECORDED',NULL,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",fields.map(k=>r[k]).concat(hash));
    if(inserted.affectedRows!==1)throw Error('SUBMISSION_INSERT_UNCONFIRMED');
    return ack({submission_hash:hash},'SUBMISSION_RECORDED');
   });
  },
  async report(input){
   if(!input||Object.keys(input).sort().join(',')!=='executionId,fingerprint,outcome,requestId,telegramNotice'||!/^tg_[a-f0-9]{64}$/.test(input.requestId??'')||!/^\d{1,32}$/.test(input.executionId??'')||!hex(input.fingerprint)||!['SUCCESS','UNCERTAIN','REJECTED'].includes(input.outcome)||!['NOT_RECORDED','SENT','UNCERTAIN'].includes(input.telegramNotice))return failed();
   return transaction(async c=>{
    const [quota]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(quota.length!==1)return failed();
    const [binding]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=?',[input.requestId]);if(binding.length!==1)return failed();
    const {package_id:packageId,revision}=binding[0];
    const [packs]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);if(packs.length!==1||Number(packs[0].revision)!==Number(revision)||packs[0].state!=='READY')return failed();
    const {attempts,fences}=await lockRows(c,packageId,Number(revision));if(attempts.length!==1||fences.length!==1)return failed();
    const [rows]=await c.execute('SELECT * FROM opmx_tg_publisher_submissions_v1 WHERE request_id=? FOR UPDATE',[input.requestId]);
    const row=rows.length===1&&rows[0],r=normalizedRow(row);if(!r||r.fingerprint!==input.fingerprint||r.executionId!==input.executionId||r.eventId!==attempts[0].event_id)return failed();
    const proof=await readCompletedWriterReceipt(c,{packageId,revision:Number(revision),eventId:r.eventId,expectedPhase:r.phase}),confirmed=receiptMatchesSubmission(proof,row);
    const state=confirmed?'COMPLETE':'UNCERTAIN',notice=row.telegram_notice==='SENT'?'SENT':input.telegramNotice;
    const [changed]=await c.execute('UPDATE opmx_tg_publisher_submissions_v1 SET state=?,telegram_notice=?,receipt_hash=?,updated_at=UTC_TIMESTAMP(6) WHERE request_id=? AND submission_hash=?',[state,notice,confirmed?proof.receiptHash:null,r.requestId,row.submission_hash]);
    if(changed.affectedRows!==1)throw Error('SUBMISSION_RESULT_UNCONFIRMED');
    return {status:'SUBMISSION_RESULT_RECORDED',requestId:r.requestId,phase:r.phase,result:confirmed?'WRITER_RESULT_CONFIRMED':'SUBMISSION_UNCERTAIN',retryPermitted:false,writeAuthorized:false};
   });
  }
 };
}
