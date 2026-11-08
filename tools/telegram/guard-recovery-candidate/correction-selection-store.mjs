import {createHash} from 'node:crypto';
import {resolveDestinations,destinationLabel} from './original-destinations.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const packagePattern=/^tg_[a-f0-9]{40}$/;
const receiptPattern=/^telegram-([1-9][0-9]{0,15})-([1-9][0-9]{0,15})-([0-9]{1,16})$/;
export const correctionSelectionSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_correction_selections_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, owner_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 receipt_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, message_id BIGINT UNSIGNED NOT NULL,
 mode VARCHAR(16) NOT NULL, destination VARCHAR(32) NOT NULL,
 created_at DATETIME(6) NOT NULL, PRIMARY KEY(package_id,revision), UNIQUE KEY(receipt_key)
) ENGINE=InnoDB`;
// Only the server's authenticated Telegram receiver may call select. The
// receipt is not itself proof of origin: the guard's transport authenticates
// the receiver. Data from documents or forwarded messages must never call it.
export function createCorrectionSelectionStore({pool}){
 if(!pool?.getConnection)throw Error('INVALID_SELECTION_CONFIGURATION');
 return {async select(input){
  const keys=['owner','chat','packageId','revision','receiptId','mode','destination'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!==keys.sort().join(',')||typeof input.owner!=='string'||input.owner!==input.chat||!/^[1-9][0-9]{0,15}$/.test(input.owner)||!packagePattern.test(input.packageId??'')||!Number.isSafeInteger(input.revision)||input.revision<1||input.revision>=4294967295||!['LITERAL','EDITORIAL'].includes(input.mode))throw Error('INVALID_SELECTION');
  const receipt=receiptPattern.exec(input.receiptId??'');if(!receipt||receipt[1]!==input.chat)throw Error('INVALID_SELECTION');
  let destination;try{destination=destinationLabel(resolveDestinations(input.destination))}catch{throw Error('INVALID_SELECTION')}
  const ownerKey=digest(`opmx:telegram:v1:${input.owner}:${input.chat}`),receiptKey=digest(input.receiptId),c=await pool.getConnection();let committed=false;
  try{
   await c.beginTransaction();
   const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)throw Error('QUOTA_MISSING');
   const [packages]=await c.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);
   if(packages.length!==1||packages[0].owner_key!==ownerKey){await c.commit();committed=true;return {status:'NOT_AVAILABLE'}}
   const [prior]=await c.execute('SELECT package_id,revision,owner_key,mode,destination FROM opmx_tg_correction_selections_v1 WHERE receipt_key=? FOR UPDATE',[receiptKey]);
   if(prior.length){const p=prior[0],same=p.package_id===input.packageId&&p.owner_key===ownerKey&&Number(p.revision)===input.revision+1&&p.mode===input.mode&&p.destination===destination;await c.commit();committed=true;return same?{status:'SELECTION_REPLAY',revision:Number(p.revision)}:{status:'RECEIPT_CONFLICT'}}
   if(packages[0].state!=='OPEN'||Number(packages[0].revision)!==input.revision){await c.commit();committed=true;return {status:'STALE_REVISION'}}
   const [leases]=await c.execute('SELECT actor_key,owner_key,receipt_id FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);
   const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=? FOR UPDATE',[ownerKey]);
   const opened=leases.length===1?receiptPattern.exec(leases[0].receipt_id??''):null;
   if(!opened||leases[0].actor_key!==ownerKey||leases[0].owner_key!==ownerKey||opened[1]!==input.chat||BigInt(receipt[2])<=BigInt(opened[2])||sessions.length!==1||sessions[0].package_id!==input.packageId){await c.commit();committed=true;return {status:'NOT_AVAILABLE'}}
   const [last]=await c.execute('SELECT message_id FROM opmx_tg_correction_selections_v1 WHERE package_id=? ORDER BY revision DESC LIMIT 1 FOR UPDATE',[input.packageId]);
   if(last.length&&BigInt(receipt[2])<=BigInt(last[0].message_id)){await c.commit();committed=true;return {status:'STALE_SELECTION'}}
   const revision=input.revision+1;
   await c.execute('INSERT INTO opmx_tg_correction_selections_v1 (package_id,revision,owner_key,receipt_key,message_id,mode,destination,created_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',[input.packageId,revision,ownerKey,receiptKey,receipt[2],input.mode,destination]);
   const [changed]=await c.execute("UPDATE opmx_tg_packages_v1 SET revision=?,updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND state='OPEN' AND revision=?",[revision,input.packageId,input.revision]);
   if(changed.affectedRows!==1)throw Error('SELECTION_CONFLICT');
   await c.commit();committed=true;return {status:'SELECTED',packageId:input.packageId,revision,mode:input.mode,destination};
  }catch(e){if(!committed)try{await c.rollback()}catch{}throw e}finally{c.release()}
 }};
}
// Must be called by the guard on the same transaction that locks the package.
export async function readCorrectionSelectionInTransaction(c,{packageId,revision,ownerKey}){
 if(!c?.execute||!packagePattern.test(packageId??'')||!Number.isSafeInteger(revision)||revision<1||!/^[a-f0-9]{64}$/.test(ownerKey??''))throw Error('INVALID_SELECTION');
 const [rows]=await c.execute('SELECT owner_key,mode,destination FROM opmx_tg_correction_selections_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 if(rows.length!==1||rows[0].owner_key!==ownerKey)return null;
 return {packageId,revision,ownerKey,action:'CREATE',mode:rows[0].mode,destination:rows[0].destination};
}
