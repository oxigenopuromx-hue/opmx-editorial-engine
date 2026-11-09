import {createHash} from 'node:crypto';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {validUpdatePayload} from './update-executor.mjs';
import {resolveDestinations} from './original-destinations.mjs';
import {readCorrectionSelectionInTransaction} from './correction-selection-store.mjs';

// Explicit migration only. This is a proposal for a preview, never authority
// to update WordPress. Contents are immutable for the current revision.
export const previewPayloadSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_preview_payloads_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, destination VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_json MEDIUMTEXT NOT NULL, created_at DATETIME(6) NOT NULL,
 PRIMARY KEY(package_id,revision,destination)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const digest=x=>createHash('sha256').update(x).digest('hex');
const validId=x=>/^tg_[a-f0-9]{40}$/.test(x??'');
const identity=x=>typeof x==='string'&&/^[1-9][0-9]{0,15}$/.test(x);

// Caller must be the existing authenticated receiver or Motor. The request
// proposes bytes only; selection, ownership, lease and revision are loaded
// under lock. The later confirmation authorizes exactly the delivered preview.
export function createPreviewPayloadStore({pool,readSelection=readCorrectionSelectionInTransaction}){
 if(!pool?.getConnection||typeof readSelection!=='function')throw Error('PREVIEW_PAYLOAD_CONFIGURATION_INCOMPLETE');
 async function stage(input){
  if(!input||Object.keys(input).sort().join(',')!=='chat,destination,owner,packageId,payload,revision'||!identity(input.owner)||input.owner!==input.chat||!validId(input.packageId)||!Number.isSafeInteger(input.revision)||input.revision<2||input.revision>=4294967295||!['OPURO','OPOL','LIBERAL'].includes(input.destination)||!validUpdatePayload(input.payload))throw Error('INVALID_PREVIEW_PAYLOAD');
  const encoded=canonicalUpdateValue(input.payload);if(encoded.length>12000)throw Error('PREVIEW_PAYLOAD_TOO_LARGE');
  const payloadHash=digest(encoded),actorKey=digest(`opmx:telegram:v1:${input.owner}:${input.chat}`),c=await pool.getConnection();let done=false;
  try{await c.beginTransaction();
   const [quota]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(quota.length!==1)throw Error('QUOTA_MISSING');
   const [pkgs]=await c.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);
   if(pkgs.length!==1||pkgs[0].state!=='OPEN'||Number(pkgs[0].revision)!==input.revision){await c.commit();done=true;return {status:'STALE_REVISION'}}
   const [leases]=await c.execute('SELECT actor_key,owner_key,opening_revision FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);
   const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=? FOR UPDATE',[actorKey]);
   if(leases.length!==1||leases[0].actor_key!==actorKey||leases[0].owner_key!==pkgs[0].owner_key||sessions.length!==1||sessions[0].package_id!==input.packageId){await c.commit();done=true;return {status:'NOT_AVAILABLE'}}
   const scope={packageId:input.packageId,revision:input.revision,ownerKey:pkgs[0].owner_key,actorKey};
   const selection=await readSelection(c,scope);
   if(!selection||selection.packageId!==input.packageId||selection.revision!==input.revision||selection.ownerKey!==scope.ownerKey||selection.action!=='UPDATE'||!resolveDestinations(selection.destination).includes(input.destination)){await c.commit();done=true;return {status:'SELECTION_UNCONFIRMED'}}
   const [rows]=await c.execute('SELECT actor_key,payload_hash,payload_json FROM opmx_tg_preview_payloads_v1 WHERE package_id=? AND revision=? AND destination=? FOR UPDATE',[input.packageId,input.revision,input.destination]);
   if(rows.length){await c.commit();done=true;return rows.length===1&&rows[0].actor_key===actorKey&&rows[0].payload_hash===payloadHash&&rows[0].payload_json===encoded?{status:'PREVIEW_PAYLOAD_REPLAY',payloadHash}:{status:'PREVIEW_PAYLOAD_CONFLICT'}}
   await c.execute('INSERT INTO opmx_tg_preview_payloads_v1 (package_id,revision,destination,actor_key,payload_hash,payload_json,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))',[input.packageId,input.revision,input.destination,actorKey,payloadHash,encoded]);
   await c.commit();done=true;return {status:'PREVIEW_PAYLOAD_STAGED',payloadHash};
  }catch(error){if(!done)try{await c.rollback()}catch{}throw error}finally{c.release()}
 }
 // Called only inside the preview transaction after it has locked and
 // authenticated the package, lease and selection. Recompute all hashes.
 async function read(c,scope){
  if(!c?.execute||!validId(scope?.packageId)||!Number.isSafeInteger(scope.revision)||!Number.isSafeInteger(scope.baseRevision)||!/^[a-f0-9]{64}$/.test(scope.ownerKey??'')||!/^[a-f0-9]{64}$/.test(scope.actorKey??''))return null;
  let destinations;try{destinations=resolveDestinations(scope.destination)}catch{return null}
  const [rows]=await c.execute('SELECT destination,actor_key,payload_hash,payload_json FROM opmx_tg_preview_payloads_v1 WHERE package_id=? AND revision=? FOR UPDATE',[scope.packageId,scope.revision]);
  if(rows.length!==destinations.length||new Set(rows.map(r=>r.destination)).size!==destinations.length)return null;
  const finalPayloads={};for(const d of destinations){const row=rows.find(x=>x.destination===d);if(!row||row.actor_key!==scope.actorKey||digest(row.payload_json)!==row.payload_hash)return null;let payload;try{payload=JSON.parse(row.payload_json);if(!validUpdatePayload(payload)||canonicalUpdateValue(payload)!==row.payload_json)return null}catch{return null}finalPayloads[d]=payload}
  if(canonicalUpdateValue(finalPayloads).length>16384)return null;
  return {...scope,finalPayloads};
 }
 return {stage,read};
}
