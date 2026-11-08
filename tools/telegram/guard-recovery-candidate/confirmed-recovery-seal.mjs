import {sealOpenPackageInTransaction} from './package-store.mjs';
import {validateCorrectionConfirmation} from './correction-preview.mjs';

export const confirmedDecisionSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_confirmed_decisions_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, preview_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 decision_json LONGTEXT NOT NULL, created_at DATETIME(6) NOT NULL,
 PRIMARY KEY(package_id,revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const receipt=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/;

// Candidate only. The caller has locked the quota, package and confirmation
// rows and owns the transaction. Never call WordPress or commit here. The
// configured verifier must establish that the existing Motor consumes this
// exact decision format before any event is enqueued. UPDATE also requires an
// independent, server-owned readiness provider; absent that it remains refused.
export function createConfirmedRecoverySeal({events,initializePublicationFence,initializeMotorAttempt,verifyDecisionConsumer,verifyUpdateReadiness=async()=>false}){
 if(typeof events?.enqueue!=='function'||typeof initializePublicationFence!=='function'||typeof initializeMotorAttempt!=='function'||typeof verifyDecisionConsumer!=='function'||typeof verifyUpdateReadiness!=='function')throw Error('CONFIRMED_SEAL_CONFIGURATION_INCOMPLETE');
 return async function commitConfirmed(c,{preview,actorKey,previewReceipt,confirmationReceipt}){
  if(!c?.execute||!preview||!['CREATE','UPDATE'].includes(preview.action)||preview.actorKey!==actorKey||!/^([a-f0-9]{64})$/.test(preview.ownerKey??'')||!/^tg_[a-f0-9]{40}$/.test(preview.packageId??'')||!Number.isSafeInteger(preview.revision)||preview.revision<1||!/^([a-f0-9]{64})$/.test(preview.previewHash??''))throw Error('CONFIRMED_SEAL_UNSUPPORTED');
  if(preview.action==='UPDATE'&&!validateCorrectionConfirmation({preview,previewHash:preview.previewHash,actorKey,ownerKey:preview.ownerKey,currentRevision:preview.revision,explicitAction:'UPDATE'}))throw Error('CONFIRMED_SEAL_UNSUPPORTED');
  const close=receipt.exec(previewReceipt??''),confirm=receipt.exec(confirmationReceipt??'');
  if(!close||!confirm||close[1]!==confirm[1]||BigInt(confirm[2])<=BigInt(close[2]))throw Error('CONFIRMED_SEAL_RECEIPT_INVALID');
  const [p]=await c.execute('SELECT package_id,owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[preview.packageId]);
  if(p.length!==1||p[0].owner_key!==preview.ownerKey||p[0].state!=='OPEN'||Number(p[0].revision)!==preview.revision)throw Error('CONFIRMED_SEAL_STALE');
  const [leases]=await c.execute('SELECT actor_key,owner_key,receipt_id,opening_revision FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[preview.packageId]);
  const lease=leases[0];if(leases.length!==1||lease.actor_key!==actorKey||lease.owner_key!==preview.ownerKey||Number(lease.opening_revision)-1!==preview.baseRevision)throw Error('CONFIRMED_SEAL_LEASE_INVALID');
  const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=? FOR UPDATE',[actorKey]);
  if(sessions.length!==1||sessions[0].package_id!==preview.packageId)throw Error('CONFIRMED_SEAL_SESSION_INVALID');
  const [fence]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[preview.packageId,preview.baseRevision]);
  if(fence.length!==1||fence[0].state!=='RECOVERY_FENCED')throw Error('CONFIRMED_SEAL_FENCE_UNCONFIRMED');
  if(preview.action==='UPDATE'&&await verifyUpdateReadiness(c,{packageId:preview.packageId,revision:preview.revision,preview})!==true)throw Error('CONFIRMED_SEAL_UPDATE_UNCONFIRMED');
  if(await verifyDecisionConsumer(c,{packageId:preview.packageId,revision:preview.revision+1,preview})!==true)throw Error('CONFIRMED_SEAL_CONSUMER_UNCONFIRMED');
  await c.execute('INSERT INTO opmx_tg_confirmed_decisions_v1 (package_id,revision,preview_hash,decision_json,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP(6))',[preview.packageId,preview.revision+1,preview.previewHash,JSON.stringify(preview)]);
  const result=await sealOpenPackageInTransaction(c,{input:{packageId:preview.packageId,chat:close[1],receiptId:previewReceipt},pack:p[0],lease,actorKey,ownerKey:preview.ownerKey,events,initializePublicationFence,initializeMotorAttempt});
  if(result.status!=='READY'||!/^evt_[a-f0-9]{48}$/.test(result.eventId??''))throw Error('CONFIRMED_SEAL_UNCONFIRMED');
  return result.eventId;
 };
}
