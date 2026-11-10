import {createHash} from 'node:crypto';
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
 state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
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
 const [insert]=await c.execute("INSERT IGNORE INTO opmx_tg_preview_generation_v1 (job_id,package_id,revision,base_revision,owner_key,actor_key,destination,receipt_hash,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'PENDING',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",[jobId,packageId,revision,baseRevision,ownerKey,actorKey,destination,receiptHash]);
 const [rows]=await c.execute('SELECT job_id,package_id,revision,base_revision,owner_key,actor_key,destination,state FROM opmx_tg_preview_generation_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 const row=rows[0];
 if(rows.length!==1||row.job_id!==jobId||row.package_id!==packageId||Number(row.revision)!==revision||Number(row.base_revision)!==baseRevision||row.owner_key!==ownerKey||row.actor_key!==actorKey||row.destination!==destination||!['PENDING','DISPATCHING','DISPATCHED'].includes(row.state))throw Error('PREVIEW_GENERATION_CONFLICT');
 return {status:insert.affectedRows===1?'PREVIEW_QUEUED':'PREVIEW_ALREADY_QUEUED',jobId};
}
