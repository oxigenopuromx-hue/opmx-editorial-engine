import {createHash} from 'node:crypto';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {validUpdatePayload} from './update-executor.mjs';
import {resolveDestinations} from './original-destinations.mjs';
import {readCorrectionSelectionInTransaction} from './correction-selection-store.mjs';
import {readVerifiedUpdatePosts} from './verified-update-posts.mjs';

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
export function createPreviewPayloadStore({pool,readSelection=readCorrectionSelectionInTransaction,readPosts=readVerifiedUpdatePosts,adminUserIds=[]}){
 if(!pool?.getConnection||typeof readSelection!=='function'||typeof readPosts!=='function'||!Array.isArray(adminUserIds)||adminUserIds.some(x=>!identity(x)))throw Error('PREVIEW_PAYLOAD_CONFIGURATION_INCOMPLETE');
 const admins=new Set(adminUserIds);
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
 // The existing Motor resolves the original owner's identity from routing.
 // A reopened package can instead be edited by an administrator. Resolve the
 // actual editor only from the guard's persisted lease, then stage() re-locks
 // and checks that same lease/session/revision before writing the proposal.
 async function stageFromMotor(input){
  if(!input||Object.keys(input).sort().join(',')!=='chat,destination,owner,packageId,payload,revision'||!identity(input.owner)||input.owner!==input.chat||!validId(input.packageId)||!Number.isSafeInteger(input.revision)||input.revision<2||input.revision>=4294967295)return {status:'NOT_AVAILABLE'};
  const ownerKey=digest(`opmx:telegram:v1:${input.owner}:${input.chat}`),c=await pool.getConnection();let rows;
  try{[rows]=await c.execute("SELECT p.owner_key,p.state,p.revision,l.actor_key,l.owner_key AS lease_owner,l.receipt_id FROM opmx_tg_packages_v1 p JOIN opmx_tg_recovery_leases_v1 l ON l.package_id=p.package_id WHERE p.package_id=?",[input.packageId])}finally{c.release()}
  if(rows.length!==1||rows[0].state!=='OPEN'||Number(rows[0].revision)!==input.revision||rows[0].owner_key!==ownerKey||rows[0].lease_owner!==ownerKey)return {status:'NOT_AVAILABLE'};
  const receipt=/^telegram-([1-9][0-9]{0,15})-[0-9]{1,16}-[0-9]{1,16}$/.exec(rows[0].receipt_id??'');
  if(!receipt)return {status:'NOT_AVAILABLE'};
  const editor=receipt[1],actor=digest(`opmx:telegram:v1:${editor}:${editor}`);
  if(rows[0].actor_key!==actor||(editor!==input.owner&&!admins.has(editor)))return {status:'NOT_AVAILABLE'};
  return stage({...input,owner:editor,chat:editor});
 }
 // Resolve the OPEN event only against server-owned job, lease, selection and
 // verified existing IDs. The Motor cannot provide an editor or target ID.
 async function contextFromMotor(input){
  if(!input||Object.keys(input).sort().join(',')!=='chat,owner,packageId,revision'||!identity(input.owner)||input.owner!==input.chat||!validId(input.packageId)||!Number.isSafeInteger(input.revision)||input.revision<2||input.revision>=4294967295)return {status:'NOT_AVAILABLE'};
  const ownerKey=digest(`opmx:telegram:v1:${input.owner}:${input.chat}`),c=await pool.getConnection();let done=false;
  try{await c.beginTransaction();
   const [quota]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(quota.length!==1)throw Error('QUOTA_MISSING');
   const [packs]=await c.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);
   const [leases]=await c.execute('SELECT owner_key,actor_key,opening_revision,receipt_id FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);
   const [jobs]=await c.execute('SELECT owner_key,actor_key,base_revision,destination,state FROM opmx_tg_preview_generation_v1 WHERE package_id=? AND revision=? FOR UPDATE',[input.packageId,input.revision]);
   const l=leases[0],j=jobs[0],receipt=/^telegram-([1-9][0-9]{0,15})-[0-9]{1,16}-[0-9]{1,16}$/.exec(l?.receipt_id??''),editor=receipt?.[1],actorKey=editor?digest(`opmx:telegram:v1:${editor}:${editor}`):null;
   if(packs.length!==1||packs[0].owner_key!==ownerKey||packs[0].state!=='OPEN'||Number(packs[0].revision)!==input.revision||leases.length!==1||l.owner_key!==ownerKey||l.actor_key!==actorKey||(editor!==input.owner&&!admins.has(editor))||jobs.length!==1||j.owner_key!==ownerKey||j.actor_key!==actorKey||!['DISPATCHING','DISPATCHED'].includes(j.state)||Number(l.opening_revision)-1!==Number(j.base_revision)){await c.commit();done=true;return {status:'NOT_AVAILABLE'}}
   const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=? FOR UPDATE',[actorKey]);
   const scope={packageId:input.packageId,revision:input.revision,ownerKey,actorKey},selection=await readSelection(c,scope);
   if(sessions.length!==1||sessions[0].package_id!==input.packageId||!selection||selection.packageId!==input.packageId||selection.revision!==input.revision||selection.ownerKey!==ownerKey||selection.action!=='UPDATE'||!['LITERAL','EDITORIAL'].includes(selection.mode)||selection.destination!==j.destination){await c.commit();done=true;return {status:'NOT_AVAILABLE'}}
   const baseRevision=Number(j.base_revision),evidence=await readPosts(c,{...scope,baseRevision,destination:j.destination});
   let destinations;try{destinations=resolveDestinations(j.destination)}catch{destinations=[]}
   if(!evidence||evidence.packageId!==scope.packageId||evidence.revision!==scope.revision||evidence.baseRevision!==baseRevision||evidence.ownerKey!==ownerKey||evidence.actorKey!==actorKey||evidence.destination!==j.destination||evidence.verified!==true||!evidence.posts||Object.keys(evidence.posts).length!==destinations.length||!destinations.length||destinations.some(d=>!Object.hasOwn(evidence.posts,d)||!Number.isSafeInteger(evidence.posts[d])||evidence.posts[d]<1)){await c.commit();done=true;return {status:'NOT_AVAILABLE'}}
   await c.commit();done=true;return {status:'PREVIEW_CONTEXT',packageId:input.packageId,revision:input.revision,mode:selection.mode,destination:j.destination,posts:destinations.map(destination=>({destination,postId:evidence.posts[destination]})),publicationAuthorized:false};
  }catch(error){if(!done)try{await c.rollback()}catch{}throw error}finally{c.release()}
 }
 return {stage,stageFromMotor,contextFromMotor,read};
}
