import {createHash} from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const privateId=/^[1-9][0-9]{0,15}$/;
const packageId=/^tg_[a-f0-9]{40}$/;
const receipt=/^telegram-([1-9][0-9]{0,15})-([1-9][0-9]{0,15})-([0-9]{1,16})$/;
const hex=/^[a-f0-9]{64}$/;
const denied=status=>({status,writeAuthorized:false,retryPermitted:false});
export const cancellationSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_duplicate_cancellations_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 revision INT UNSIGNED NOT NULL, actor_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 owner_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 receipt_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 lease_opening_revision INT UNSIGNED NOT NULL, reason VARCHAR(16) CHARACTER SET ascii NOT NULL,
 created_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
// Telegram receiver authenticates sender and rejects forwarded, edited, quoted,
// replied, caption or attachment controls before calling this private service.
export function createDuplicateCancellation({pool}) {
 if(!pool?.getConnection)throw Error('CANCELLATION_CONFIGURATION_INVALID');
 return async input=>{
  if(!input||Object.keys(input).sort().join(',')!=='chat,owner,packageId,receiptId,revision'||input.owner!==input.chat||!privateId.test(input.owner??'')||!packageId.test(input.packageId??'')||!Number.isSafeInteger(input.revision)||input.revision<1||input.revision>=4294967295)return denied('INVALID_CANCELLATION');
  const r=receipt.exec(input.receiptId??'');if(!r||r[1]!==input.chat)return denied('INVALID_CANCELLATION');
  const actor=hash(`opmx:telegram:v1:${input.owner}:${input.chat}`),receiptKey=hash(input.receiptId),c=await pool.getConnection();let committed=false;
  try{
   await c.beginTransaction();
   const [quota]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(quota.length!==1)throw Error('QUOTA_UNAVAILABLE');
   const [packs]=await c.execute('SELECT package_id,owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);
   if(packs.length!==1||!hex.test(packs[0].owner_key??'')){await c.rollback();return denied('NOT_AVAILABLE')}
   const pack=packs[0],rev=Number(pack.revision);
   const [prior]=await c.execute('SELECT package_id,revision,actor_key,owner_key,receipt_key,reason FROM opmx_tg_duplicate_cancellations_v1 WHERE package_id=? OR receipt_key=? FOR UPDATE',[input.packageId,receiptKey]);
   if(prior.length){const p=prior[0],same=prior.length===1&&p.package_id===input.packageId&&Number(p.revision)===input.revision&&p.actor_key===actor&&p.owner_key===pack.owner_key&&p.receipt_key===receiptKey&&p.reason==='DUPLICATE'&&pack.state==='CANCELLED'&&rev===input.revision;await c.rollback();return same?{status:'CANCELLED_REPLAY',packageId:input.packageId,revision:rev,reason:'DUPLICATE',writeAuthorized:false,retryPermitted:false}:denied('CANCELLATION_CONFLICT')}
   if(pack.state!=='OPEN'||rev!==input.revision){await c.rollback();return denied('STALE_REVISION')}
   const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=? FOR UPDATE',[actor]);
   if(sessions.length!==1||sessions[0].package_id!==input.packageId){await c.rollback();return denied('NO_EDIT_SESSION')}
   const [leases]=await c.execute('SELECT actor_key,owner_key,receipt_id,opening_revision FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);
   if(leases.length>1){await c.rollback();return denied('NOT_AVAILABLE')}
   let opening=0;
   if(leases.length){const l=leases[0],o=receipt.exec(l.receipt_id??'');opening=Number(l.opening_revision);if(l.actor_key!==actor||l.owner_key!==pack.owner_key||!o||o[1]!==input.chat||BigInt(r[2])<=BigInt(o[2])||!Number.isSafeInteger(opening)||opening<2||opening>rev){await c.rollback();return denied('NOT_AVAILABLE')}
    const [base]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[input.packageId,opening-1]);
    const [attempt]=await c.execute('SELECT state FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[input.packageId,opening-1]);
    if(base.length!==1||base[0].state!=='RECOVERY_FENCED'||attempt.length>1||attempt.length===1&&attempt[0].state!=='REVOKED'){await c.rollback();return denied('RECONCILIATION_REQUIRED')}
   }else if(pack.owner_key!==actor){await c.rollback();return denied('NOT_AVAILABLE')}
   const [pending]=await c.execute("SELECT item_id FROM opmx_tg_items_v1 WHERE package_id=? AND state='PENDING' LIMIT 1 FOR UPDATE",[input.packageId]);
   if(pending.length){await c.rollback();return denied('PENDING_RESERVATION')}
   const [previewJobs]=await c.execute('SELECT revision FROM opmx_tg_preview_generation_v1 WHERE package_id=? AND revision>=? LIMIT 1 FOR UPDATE',[input.packageId,rev]);
   if(previewJobs.length){await c.rollback();return denied('RECONCILIATION_REQUIRED')}
   for(const table of ['opmx_tg_events_v1','opmx_tg_motor_attempts_v1','opmx_tg_publication_fence_v1']){const [rows]=await c.execute(`SELECT revision FROM ${table} WHERE package_id=? AND revision>=? LIMIT 1 FOR UPDATE`,[input.packageId,rev]);if(rows.length){await c.rollback();return denied('RECONCILIATION_REQUIRED')}}
   const [added]=await c.execute("INSERT INTO opmx_tg_duplicate_cancellations_v1 (package_id,revision,actor_key,owner_key,receipt_key,lease_opening_revision,reason,created_at) VALUES (?,?,?,?,?,?,'DUPLICATE',UTC_TIMESTAMP(6))",[input.packageId,rev,actor,pack.owner_key,receiptKey,opening]);if(added.affectedRows!==1)throw Error('CANCELLATION_AUDIT_FAILED');
   const [changed]=await c.execute("UPDATE opmx_tg_packages_v1 SET state='CANCELLED',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND state='OPEN' AND revision=?",[input.packageId,rev]);if(changed.affectedRows!==1)throw Error('CANCELLATION_STATE_CONFLICT');
   const [released]=await c.execute('DELETE FROM opmx_tg_sessions_v1 WHERE owner_key=? AND package_id=?',[actor,input.packageId]);if(released.affectedRows!==1)throw Error('CANCELLATION_SESSION_CONFLICT');
   if(leases.length){const [closed]=await c.execute('DELETE FROM opmx_tg_recovery_leases_v1 WHERE package_id=? AND actor_key=? AND owner_key=?',[input.packageId,actor,pack.owner_key]);if(closed.affectedRows!==1)throw Error('CANCELLATION_LEASE_CONFLICT')}
   await c.commit();committed=true;return {status:'CANCELLED',packageId:input.packageId,revision:rev,reason:'DUPLICATE',writeAuthorized:false,retryPermitted:false};
  }catch(error){if(!committed)try{await c.rollback()}catch{}throw Error('CANCELLATION_UNCONFIRMED',{cause:error})}finally{c.release()}
 };
}
