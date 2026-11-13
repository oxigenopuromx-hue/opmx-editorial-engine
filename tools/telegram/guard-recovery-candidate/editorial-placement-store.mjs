import {createHash} from 'node:crypto';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {resolveDestinations,destinationLabel} from './original-destinations.mjs';
import {decodeControl} from './original-destination-policy.mjs';
import {readLiteralScopeInTransaction} from './literal-payload-store.mjs';
import {readVerifiedUpdateDecisionInTransaction} from './confirmed-correction-reader.mjs';
import {categoryExclusionIds} from '../../editorial/opuro-category-home.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const pkg=/^tg_[a-f0-9]{40}$/,digest=/^[a-f0-9]{64}$/,tgRequest=/^tg_[a-f0-9]{64}$/;
const receipt=/^telegram-([1-9][0-9]{0,15})-([1-9][0-9]{0,15})-([0-9]{1,16})$/;
const validRevision=x=>Number.isSafeInteger(x)&&x>0&&x<4294967295;
const unavailable=()=>({status:'PLACEMENT_UNCONFIRMED',writesStarted:false,writeAuthorized:false,retryPermitted:false});
const unchanged=requestId=>({status:'PLACEMENT_UNCHANGED',requestId,writesStarted:false,writeAuthorized:false,retryPermitted:false});

export const editorialPlacementSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_editorial_placements_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, actor_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 owner_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 lease_opening_revision INT UNSIGNED NOT NULL, lease_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 receipt_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, message_id BIGINT UNSIGNED NOT NULL,
 ids_json TEXT NOT NULL, created_at DATETIME(6) NOT NULL,
 PRIMARY KEY(package_id,revision), UNIQUE KEY(receipt_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

function leaseIdentity(rows,packageId,ownerKey,revision) {
 if(rows.length===0)return {actorKey:ownerKey,openingRevision:0,leaseKey:hash('opmx:placement:normal:'+packageId)};
 if(rows.length!==1)return null;
 const l=rows[0],r=receipt.exec(l.receipt_id??''),opening=Number(l.opening_revision);
 if(!r||l.owner_key!==ownerKey||!digest.test(l.actor_key??'')||!Number.isSafeInteger(opening)||opening<1||opening>revision||hash(`opmx:telegram:v1:${r[1]}:${r[1]}`)!==l.actor_key)return null;
 return {actorKey:l.actor_key,openingRevision:opening,leaseKey:hash(l.receipt_id),openingMessageId:r[2]};
}

async function sealedPlacementIdentity(c,{packageId,revision,ownerKey,scope}) {
 const [closures]=await c.execute('SELECT snapshot_revision,actor_key,close_receipt_key FROM opmx_tg_recovery_closures_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 if(!closures.length)return scope.action==='UPDATE'?null:{actorKey:ownerKey,openingRevision:0,leaseKey:hash('opmx:placement:normal:'+packageId)};
 if(closures.length!==1)return null;
 const row=closures[0],base=Number(row.snapshot_revision);
 if(!Number.isSafeInteger(base)||base<1||base+1>=revision||!digest.test(row.actor_key??'')||!digest.test(row.close_receipt_key??''))return null;
 if(scope.action==='UPDATE'&&(scope.baseRevision!==base||scope.actorKey!==row.actor_key))return null;
 // Confirmation atomically removes the live lease. Its durable closure and
 // verified decision retain the cycle/actor; the opening revision is unique
 // for a monotonically versioned package and cannot be inherited on reopen.
 return {actorKey:row.actor_key,openingRevision:base+1,leaseKey:null};
}

// CREATE reuses the same authoritative original/recovered policy reader as
// LITERAL; it validates EDITORIAL too. UPDATE resolves only a real persisted
// confirmation and its exact final payload, never a caller-supplied envelope.
export async function readEditorialPlacementScopeInTransaction(c,scope) {
 try{return {...await readLiteralScopeInTransaction(c,scope),action:'CREATE'}}catch{}
 const d=await readVerifiedUpdateDecisionInTransaction(c,scope);
 if(!d||d.action!=='UPDATE'||!d.finalPayloads)return null;
 return {...d,action:'UPDATE'};
}

// Trusted inventory projection for the existing Motor. Caller derives owner
// identity from the package/context, never from source content. OPEN has no
// future request ID yet; READY derives the exact canonical bound request.
// The projection is selection data, not the fresh prove() response or a grant.
export async function readPlacementForManifest(c,{packageId,revision,ownerKey,actorKey}={},{readScope=readEditorialPlacementScopeInTransaction}={}) {
 const fail=()=>{throw Error('PLACEMENT_MANIFEST_UNCONFIRMED')};
 if(!c?.execute||!pkg.test(packageId??'')||!validRevision(revision)||!digest.test(ownerKey??'')||actorKey!==undefined&&!digest.test(actorKey))fail();
 const [packs]=await c.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
 if(packs.length!==1||packs[0].owner_key!==ownerKey||Number(packs[0].revision)!==revision||!['OPEN','READY'].includes(packs[0].state))fail();
 const [history]=await c.execute('SELECT revision FROM opmx_tg_editorial_placements_v1 WHERE package_id=? AND revision<=? LIMIT 1 FOR UPDATE',[packageId,revision]);
 // No new option must not introduce new source/policy requirements for an
 // otherwise readable historical package. This is absence, never authority.
 if(!history.length)return null;
 let lease,scope=null;
 if(packs[0].state==='OPEN'){
  const [leases]=await c.execute('SELECT actor_key,owner_key,receipt_id,opening_revision FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[packageId]);
  lease=leaseIdentity(leases,packageId,ownerKey,revision);
  if(lease){const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=? FOR UPDATE',[lease.actorKey]);if(sessions.length!==1||sessions[0].package_id!==packageId)fail()}
 }else{
  scope=await readScope(c,{packageId,revision});if(!scope||scope.ownerKey!==ownerKey)fail();
  lease=await sealedPlacementIdentity(c,{packageId,revision,ownerKey,scope});
 }
 // An authorised inventory reader may differ from the order's operator. The
 // live lease/session (OPEN) or durable closure (READY) checks that operator;
 // the outer package reader already authenticates/authorises the reader.
 if(!lease)fail();
 const [rows]=await c.execute('SELECT revision,actor_key,owner_key,lease_opening_revision,lease_key,receipt_key,message_id,ids_json FROM opmx_tg_editorial_placements_v1 WHERE package_id=? AND revision<=? AND lease_opening_revision=? ORDER BY revision DESC LIMIT 1 FOR UPDATE',[packageId,revision,lease.openingRevision]);
 if(!rows.length)return null;if(rows.length!==1)fail();const row=rows[0];let ids;
 try{ids=row.ids_json==='null'?null:categoryExclusionIds(JSON.parse(row.ids_json));if(canonicalUpdateValue(ids)!==row.ids_json)fail()}catch{fail()}
 if(row.owner_key!==ownerKey||row.actor_key!==lease.actorKey||Number(row.lease_opening_revision)!==lease.openingRevision||!digest.test(row.lease_key??'')||lease.leaseKey!==null&&row.lease_key!==lease.leaseKey||!digest.test(row.receipt_key??'')||!validRevision(Number(row.revision))||Number(row.revision)>revision||Number(row.revision)<lease.openingRevision)fail();
 let requestId;
 if(scope){try{requestId=expectedDraftRequestId({packageId,revision,destination:scope.destination});const [binding]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=? FOR UPDATE',[requestId]);if(binding.length!==1||binding[0].package_id!==packageId||Number(binding[0].revision)!==revision)fail()}catch{fail()}}
 return {status:ids===null?'PLACEMENT_PRESERVE':'PLACEMENT_SELECTION',mode:'DIRECT_OPERATOR',target:'OPURO',confirmed:true,...(ids===null?{}:{excluded_category_ids:ids}),control_revision:Number(row.revision),current_revision:revision,source:'GUARD_TELEGRAM_CONTROL',...(requestId?{request_id:requestId}:{}),writesStarted:false,writeAuthorized:false,retryPermitted:false};
}

// Caller holds a transaction with quota lock. This read grants no capability,
// opens no fence and mutates no state. A later reopen is still blocked by the
// ordinary writer fence; the exact binding and current READY revision matter.
export async function readEditorialPlacementForRequestInTransaction(c,input,{readScope=readEditorialPlacementScopeInTransaction}={}) {
 if(!c?.execute||!input||Object.keys(input).sort().join(',')!=='ids,requestId'||typeof input.requestId!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(input.requestId))return unavailable();
 let ids=null;try{if(input.ids!==null)ids=categoryExclusionIds(input.ids)}catch{return unavailable()}
 const requestId=input.requestId;
 if(!tgRequest.test(requestId))return !/^tg_/i.test(requestId)&&ids===null?unchanged(requestId):unavailable();
 const [bindings]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=?',[requestId]);
 if(bindings.length!==1||!pkg.test(bindings[0].package_id??'')||!validRevision(Number(bindings[0].revision)))return unavailable();
 const packageId=bindings[0].package_id,revision=Number(bindings[0].revision);
 const [packages]=await c.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
 if(packages.length!==1||packages[0].state!=='READY'||Number(packages[0].revision)!==revision||!digest.test(packages[0].owner_key??''))return unavailable();
 const ownerKey=packages[0].owner_key;
 const [history]=await c.execute('SELECT revision FROM opmx_tg_editorial_placements_v1 WHERE package_id=? AND revision<=? LIMIT 1 FOR UPDATE',[packageId,revision]);
 if(!history.length)return ids===null?unchanged(requestId):unavailable();
 const earlyLease=await sealedPlacementIdentity(c,{packageId,revision,ownerKey,scope:{action:'CREATE'}});if(!earlyLease)return unavailable();
 const [rows]=await c.execute('SELECT revision,actor_key,owner_key,lease_opening_revision,lease_key,receipt_key,message_id,ids_json FROM opmx_tg_editorial_placements_v1 WHERE package_id=? AND revision<=? AND lease_opening_revision=? ORDER BY revision DESC LIMIT 1 FOR UPDATE',[packageId,revision,earlyLease.openingRevision]);
 if(rows.length>1)return unavailable();
 if(!rows.length)return ids===null?unchanged(requestId):unavailable();
 const row=rows[0];let saved;
 try{saved=row.ids_json==='null'?null:categoryExclusionIds(JSON.parse(row.ids_json));if(canonicalUpdateValue(saved)!==row.ids_json)return unavailable()}catch{return unavailable()}
 if(row.actor_key!==earlyLease.actorKey||row.owner_key!==ownerKey||Number(row.lease_opening_revision)!==earlyLease.openingRevision||!digest.test(row.lease_key??'')||earlyLease.leaseKey!==null&&row.lease_key!==earlyLease.leaseKey||!digest.test(row.receipt_key??'')||!validRevision(Number(row.revision))||Number(row.revision)>revision||Number(row.revision)<earlyLease.openingRevision)return unavailable();
 // Retiring a preference or omitting an option does not open a fence. The
 // ordinary writer still performs its original checks, including historical
 // fenced paths. Positive metadata changes always take the full path below.
 if(saved===null)return ids===null?unchanged(requestId):unavailable();
 if(ids===null||canonicalUpdateValue(saved)!==canonicalUpdateValue(ids))return unavailable();
 let scope;try{scope=await readScope(c,{packageId,revision})}catch{return unavailable()}
 if(scope?.packageId!==packageId||scope.revision!==revision||!digest.test(scope.ownerKey??''))return unavailable();
 let destinations;try{destinations=resolveDestinations(scope.destination);if(destinationLabel(destinations)!==scope.destination||expectedDraftRequestId({packageId,revision,destination:scope.destination})!==requestId)return unavailable()}catch{return unavailable()}
 if(scope.action==='UPDATE'){
  const p=scope.finalPayloads?.OPURO,declared=Object.hasOwn(p?.meta??{},'oxpuro_excluded_category_ids');
  try{if(declared?(ids===null||canonicalUpdateValue(categoryExclusionIds(p.meta.oxpuro_excluded_category_ids))!==canonicalUpdateValue(ids)):ids!==null)return unavailable()}catch{return unavailable()}
 }
 const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 if(fences.length!==1||!['AWAITING_DECISION','READY_TO_WRITE','WRITING'].includes(fences[0].state))return unavailable();
 const [confirmed]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=? FOR UPDATE',[requestId]);
 if(confirmed.length!==1||confirmed[0].package_id!==packageId||Number(confirmed[0].revision)!==revision)return unavailable();
 const lease=await sealedPlacementIdentity(c,{packageId,revision,ownerKey:scope.ownerKey,scope});if(!lease)return unavailable();
 if(scope.action==='UPDATE'&&scope.actorKey!==lease.actorKey)return unavailable();
 if(row.actor_key!==lease.actorKey||row.owner_key!==scope.ownerKey||Number(row.lease_opening_revision)!==lease.openingRevision||!digest.test(row.lease_key??'')||lease.leaseKey!==null&&row.lease_key!==lease.leaseKey||!digest.test(row.receipt_key??'')||!validRevision(Number(row.revision))||Number(row.revision)>revision||Number(row.revision)<lease.openingRevision)return unavailable();
 if(!destinations.includes('OPURO'))return unavailable();
 if(scope.action==='UPDATE'){
  const payload=scope.finalPayloads?.OPURO;
  try{if(!payload||!Object.hasOwn(payload.meta??{},'oxpuro_excluded_category_ids')||canonicalUpdateValue(categoryExclusionIds(payload.meta.oxpuro_excluded_category_ids))!==canonicalUpdateValue(ids))return unavailable()}catch{return unavailable()}
 }
 return {status:'PLACEMENT_VERIFIED',requestId,packageId,revision,controlHash:hash(canonicalUpdateValue({requestId,packageId,revision,receiptKey:row.receipt_key,ids})),EDITORIAL_PLACEMENT:{mode:'DIRECT_OPERATOR',target:'OPURO',confirmed:true,request_id:requestId,excluded_category_ids:ids},writesStarted:false,writeAuthorized:false,retryPermitted:false};
}

// UPDATE's full confirmed destination set is authoritative. An OPOL write in
// TODOS must inspect the confirmed OPURO payload as well, rather than inventing
// ids:null and treating the same approved control as orphaned.
export async function verifyUpdateEditorialPlacementInTransaction(c,input,{readDecision=readVerifiedUpdateDecisionInTransaction}={}) {
 if(!c?.execute||!input||Object.keys(input).sort().join(',')!=='destination,packageId,payload,previewHash,revision'||!pkg.test(input.packageId??'')||!validRevision(input.revision)||!digest.test(input.previewHash??'')||!['OPURO','OPOL','LIBERAL'].includes(input.destination))return false;
 let d;try{d=await readDecision(c,{packageId:input.packageId,revision:input.revision})}catch{return false}
 if(!d||d.action!=='UPDATE'||d.packageId!==input.packageId||d.revision!==input.revision||d.previewHash!==input.previewHash||!d.finalPayloads||!Object.hasOwn(d.finalPayloads,input.destination))return false;
 try{if(canonicalUpdateValue(d.finalPayloads[input.destination])!==canonicalUpdateValue(input.payload))return false}catch{return false}
 const opuro=d.finalPayloads.OPURO,declared=Object.hasOwn(opuro?.meta??{},'oxpuro_excluded_category_ids');
 let ids=null;try{if(declared)ids=categoryExclusionIds(opuro.meta.oxpuro_excluded_category_ids)}catch{return false}
 let requestId;try{requestId=expectedDraftRequestId({packageId:d.packageId,revision:d.revision,destination:d.destination})}catch{return false}
 const result=await readEditorialPlacementForRequestInTransaction(c,{requestId,ids},{readScope:async()=>d});
 return result.status==='PLACEMENT_VERIFIED'||result.status==='PLACEMENT_UNCHANGED';
}

// Only the authenticated receiver calls select. It supplies an actual direct
// Telegram receipt; MASTER, forwarded messages and Motor tools cannot call it.
// Store initialization/DDL is performed by composition before any transaction.
export function createEditorialPlacementStore({pool,readScope=readEditorialPlacementScopeInTransaction}) {
 if(!pool?.getConnection||typeof readScope!=='function')throw Error('PLACEMENT_CONFIGURATION_INVALID');
 return {
  async select(input){
   if(!input||Object.keys(input).sort().join(',')!=='chat,ids,owner,packageId,receiptId,revision'||typeof input.owner!=='string'||input.owner!==input.chat||!/^[1-9][0-9]{0,15}$/.test(input.owner)||!pkg.test(input.packageId??'')||!validRevision(input.revision))throw Error('PLACEMENT_SELECTION_INVALID');
   const r=receipt.exec(input.receiptId??'');if(!r||r[1]!==input.chat)throw Error('PLACEMENT_SELECTION_INVALID');
   const ids=input.ids===null?null:categoryExclusionIds(input.ids),idsJson=canonicalUpdateValue(ids),actorKey=hash(`opmx:telegram:v1:${input.owner}:${input.chat}`),receiptKey=hash(input.receiptId),c=await pool.getConnection();let committed=false;
   try{
    await c.beginTransaction();const [quota]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(quota.length!==1)throw Error('QUOTA_MISSING');
    const [packages]=await c.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);if(packages.length!==1||!digest.test(packages[0].owner_key??'')){await c.rollback();return {status:'NOT_AVAILABLE'}}
    const ownerKey=packages[0].owner_key;
    const [leases]=await c.execute('SELECT actor_key,owner_key,receipt_id,opening_revision FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);
    const lease=leaseIdentity(leases,input.packageId,ownerKey,Number(packages[0].revision));
    const [prior]=await c.execute('SELECT package_id,revision,actor_key,owner_key,lease_opening_revision,lease_key,receipt_key,ids_json FROM opmx_tg_editorial_placements_v1 WHERE receipt_key=? FOR UPDATE',[receiptKey]);
    if(prior.length){
     const p=prior[0],same=prior.length===1&&lease&&p.package_id===input.packageId&&Number(p.revision)<=Number(packages[0].revision)&&input.revision<=Number(packages[0].revision)&&(Number(p.revision)===input.revision+1||input.revision>=Number(p.revision))&&p.actor_key===actorKey&&lease.actorKey===actorKey&&p.owner_key===ownerKey&&Number(p.lease_opening_revision)===lease.openingRevision&&p.lease_key===lease.leaseKey&&p.ids_json===idsJson;
     if(!same){await c.rollback();return {status:'RECEIPT_CONFLICT'}}
     const [latest]=await c.execute('SELECT receipt_key FROM opmx_tg_editorial_placements_v1 WHERE package_id=? AND actor_key=? AND lease_opening_revision=? AND lease_key=? ORDER BY revision DESC LIMIT 1 FOR UPDATE',[input.packageId,actorKey,lease.openingRevision,lease.leaseKey]);
     await c.rollback();return latest.length===1&&latest[0].receipt_key===receiptKey?{status:'PLACEMENT_REPLAY',packageId:input.packageId,revision:Number(p.revision),target:'OPURO',ids}:{status:'STALE_PLACEMENT'};
    }
    if(packages[0].state!=='OPEN'||Number(packages[0].revision)!==input.revision){await c.rollback();return {status:'STALE_REVISION'}}
    const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=? FOR UPDATE',[actorKey]);
    if(!lease||lease.actorKey!==actorKey||sessions.length!==1||sessions[0].package_id!==input.packageId){await c.rollback();return {status:'NOT_AVAILABLE'}}
    let boundary=lease.openingMessageId??null;
    if(lease.openingRevision===0){
     const [items]=await c.execute("SELECT owner_key,text_content,content_bytes,sha256 FROM opmx_tg_items_v1 WHERE package_id=? AND kind='TEXT' AND state='STORED' ORDER BY created_at,item_id FOR UPDATE",[input.packageId]);
     const controls=[];for(const item of items){if(item.owner_key!==ownerKey||typeof item.text_content!=='string'||Buffer.byteLength(item.text_content)!==Number(item.content_bytes)||hash(item.text_content)!==item.sha256)throw Error('PLACEMENT_BOUNDARY_UNCONFIRMED');let control;try{control=decodeControl(item.text_content.trim(),input.packageId)}catch{throw Error('PLACEMENT_BOUNDARY_UNCONFIRMED')}if(control&&!control.legacy)controls.push(control)}
     const opens=controls.filter(x=>x.command==='/nuevo');if(opens.length!==1){await c.rollback();return {status:'NOT_AVAILABLE'}}
     boundary=String(Math.max(...controls.map(x=>x.message_id),opens[0].notice_message_id));
    }
    if(boundary===null||BigInt(r[2])<=BigInt(boundary)){await c.rollback();return {status:'STALE_PLACEMENT'}}
    const [last]=await c.execute('SELECT message_id FROM opmx_tg_editorial_placements_v1 WHERE package_id=? AND actor_key=? AND lease_opening_revision=? AND lease_key=? ORDER BY revision DESC LIMIT 1 FOR UPDATE',[input.packageId,actorKey,lease.openingRevision,lease.leaseKey]);
    const [choices]=await c.execute('SELECT message_id FROM opmx_tg_correction_selections_v2 WHERE package_id=? AND owner_key=? AND revision>=? ORDER BY revision DESC LIMIT 1 FOR UPDATE',[input.packageId,actorKey,lease.openingRevision]);
    if([...last,...choices].some(x=>BigInt(r[2])<=BigInt(x.message_id))){await c.rollback();return {status:'STALE_PLACEMENT'}}
    const revision=input.revision+1;
    await c.execute('INSERT INTO opmx_tg_editorial_placements_v1 (package_id,revision,actor_key,owner_key,lease_opening_revision,lease_key,receipt_key,message_id,ids_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',[input.packageId,revision,actorKey,ownerKey,lease.openingRevision,lease.leaseKey,receiptKey,r[2],idsJson]);
    const [changed]=await c.execute("UPDATE opmx_tg_packages_v1 SET revision=?,updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND state='OPEN' AND revision=?",[revision,input.packageId,input.revision]);if(changed.affectedRows!==1)throw Error('PLACEMENT_SELECTION_CONFLICT');
    await c.commit();committed=true;return {status:'PLACEMENT_SELECTED',packageId:input.packageId,revision,target:'OPURO',ids};
   }catch(error){if(!committed)try{await c.rollback()}catch{}throw Error('PLACEMENT_SELECTION_UNCONFIRMED',{cause:error})}finally{c.release()}
  },
  async prove(input){const c=await pool.getConnection();try{await c.beginTransaction();const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)return unavailable();return await readEditorialPlacementForRequestInTransaction(c,input,{readScope})}catch{return unavailable()}finally{try{await c.rollback()}catch{}c.release()}},
  async verifyUpdate(input){const c=await pool.getConnection();try{await c.beginTransaction();const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)return false;return await verifyUpdateEditorialPlacementInTransaction(c,input)}catch{return false}finally{try{await c.rollback()}catch{}c.release()}},
 };
}
