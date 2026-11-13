import {createHash} from 'node:crypto';
import {deriveOriginalDecision} from './original-policy-provider.mjs';
import {verifyWriterReleaseObservation} from './writer-release-contract.mjs';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {resolveDestinations,destinationLabel,destinationRegistry} from './original-destinations.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import writerReleaseManifest from './writer-release-manifest.mjs';

// Incident29 only. This is cancellation of one pending delivery, not package
// cancellation, deletion of a CMS post, or a new authorisation to publish.
export const incident29CancellationScope=Object.freeze({packageId:'tg_00991fbbd87a751fb8513f4d4f6fcebca8469bee',revision:10,destination:'LIBERAL',postId:393,slug:'simey-olvera-innovacion-tecnologica-reducir-desigualdades',posts:Object.freeze({OPURO:10493,OPOL:3515,LIBERAL:393})});
export const destinationCancellationSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_destination_cancellations_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 destination VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, post_id BIGINT UNSIGNED NOT NULL,
 operation_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_id VARCHAR(52) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 owner_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 evidence_json LONGTEXT NOT NULL, evidence_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(6) NOT NULL,
 PRIMARY KEY(package_id,destination), UNIQUE KEY(operation_id), UNIQUE KEY(request_id,destination)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const fields='package_id,revision,request_id,destination,post_id,operation_id,event_id,actor_key,owner_key,evidence_json,evidence_hash';
const action='CANCEL_PENDING_DESTINATION',schema='opmx.destination-cancellation.v1';
const sha=s=>createHash('sha256').update(s).digest('hex');
const actorKey=id=>sha(`opmx:telegram:v1:${id}:${id}`);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const noAuthority={writeAuthorized:false,reopenAuthorized:false,resumeAuthorized:false,retryPermitted:false,processTerminationClaimed:false};
const unknown=()=>({schema,status:'DELIVERY_CANCELLATION_UNCONFIRMED',nextAction:'OBSERVE_ONLY',...noAuthority});
const sameScope=x=>x?.packageId===incident29CancellationScope.packageId&&x.revision===10&&x.destination==='LIBERAL'&&x.postId===393&&x.requestId===expectedDraftRequestId({packageId:x.packageId,revision:x.revision,destination:'TODOS'});
const validOperationId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:/#-]{15,127}$/.test(x);
const freshRuntime=x=>Number.isFinite(Date.parse(x?.observedAt))&&Date.now()-Date.parse(x.observedAt)>=0&&Date.now()-Date.parse(x.observedAt)<=120000;
function validResults(results){
 const scope=incident29CancellationScope,names=['OPURO','OPOL','LIBERAL'];
 return Array.isArray(results)&&results.length===3&&results.every((x,i)=>object(x)&&x.destination===names[i]&&x.postId===scope.posts[names[i]]&&x.originalSlug===scope.slug&&x.cmsVerified===true&&x.publicationVerdict==='CMS_RECORD_CONFIRMED'&&(i<2?x.status==='PUBLISHED'&&x.wordpressStatus==='publish'&&x.slug===scope.slug:x.status==='DRAFT'&&x.wordpressStatus==='draft'&&x.slug===scope.slug||x.status==='TRASH'&&x.wordpressStatus==='trash'&&x.slug===scope.slug+'__trashed'));
}
function stored(row){
 if(!object(row))return null;
 let e;try{e=JSON.parse(row.evidence_json)}catch{return null}
 if(!object(e)||e.schema!==schema||!sameScope(e)||!validOperationId(e.operationId)||!/^evt_[a-f0-9]{48}$/.test(e.eventId??'')||!hex(e.actorKey)||!hex(e.ownerKey)||!validResults(e.results)||typeof e.observedAt!=='string'||!Number.isFinite(Date.parse(e.observedAt))||e.writerRelease!=='opmx.fenced-writer-release.v1'||e.processTerminationClaimed!==false)return null;
 if(row.package_id!==e.packageId||Number(row.revision)!==e.revision||row.request_id!==e.requestId||row.destination!==e.destination||Number(row.post_id)!==e.postId||row.operation_id!==e.operationId||row.event_id!==e.eventId||row.actor_key!==e.actorKey||row.owner_key!==e.ownerKey||!hex(row.evidence_hash))return null;
 let encoded;try{encoded=canonicalUpdateValue(e)}catch{return null}
 return encoded===row.evidence_json&&sha(encoded)===row.evidence_hash?{...e,tombstoneHash:row.evidence_hash}:null;
}
function confirmed(e){
 return {schema,status:'DELIVERY_CANCELLATION_CONFIRMED',packageId:e.packageId,revision:e.revision,requestId:e.requestId,operationId:e.operationId,destination:e.destination,postId:e.postId,tombstoneHash:e.tombstoneHash,
  results:e.results.map(x=>({destination:x.destination,status:x.destination===e.destination?'CANCELLED':'PUBLISHED',postId:x.postId,wordpressStatus:x.wordpressStatus,slug:x.slug,originalSlug:x.originalSlug})),
  currentCmsVerified:true,mixedOutcome:true,publicationComplete:false,telegramAck:'NOT_CHECKED',publicVisibility:'NOT_CHECKED',consistentSnapshot:false,...noAuthority};
}

// Call under the same package lock used by the caller's writer/preview/decision
// transaction. A cancellation applies to every future revision of the package.
// Malformed persisted evidence, invalid destination labels and DB errors deny.
export async function destinationSelectionAllowedInTransaction(c,input){
 if(!c?.execute||!object(input)||Object.keys(input).sort().join(',')!=='destination,packageId'||!/^tg_[a-f0-9]{40}$/.test(input.packageId??''))return false;
 let selected;try{selected=resolveDestinations(input.destination);if(destinationLabel(selected)!==input.destination)return false}catch{return false}
 try{
  const [rows]=await c.execute(`SELECT ${fields} FROM opmx_tg_destination_cancellations_v1 WHERE package_id=? FOR UPDATE`,[input.packageId]);
  if(!Array.isArray(rows))return false;
  const entries=rows.map(stored);
  if(entries.some(x=>!x||x.packageId!==input.packageId)||new Set(entries.map(x=>x.destination)).size!==entries.length)return false;
  return !entries.some(x=>selected.includes(x.destination));
 }catch{return false}
}

// The server supplies both observers and the pinned release manifest. No caller
// can submit a CMS assertion, a Telegram receipt, permission, token or outcome.
// DDL is explicit at startup; neither operation creates/migrates tables.
export function createPendingDestinationCancellation({pool,adminUserIds=[],observeRuntime,readWordPress,manifest=writerReleaseManifest}){
 if(!pool?.getConnection||!Array.isArray(adminUserIds)||adminUserIds.some(x=>typeof x!=='string'||!/^[1-9][0-9]{0,15}$/.test(x))||typeof observeRuntime!=='function'||typeof readWordPress!=='function')throw Error('DESTINATION_CANCELLATION_CONFIGURATION_INVALID');
 const admins=new Set(adminUserIds);
 const valid=input=>object(input)&&Object.keys(input).sort().join(',')==='chat,destination,operationId,owner,packageId,postId,requestId,revision'&&typeof input.owner==='string'&&input.owner===input.chat&&admins.has(input.owner)&&sameScope(input)&&validOperationId(input.operationId);
 async function readAudit(c,input,lock=''){
  const [rows]=await c.execute(`SELECT actor_key,owner_key FROM opmx_tg_recovery_audit_v1 WHERE package_id=? AND action='${action}' AND previous_revision=? AND revision=?${lock}`,[input.packageId,input.revision,input.revision]);return rows;
 }
 function matches(e,input,owner){return !!e&&e.operationId===input.operationId&&e.actorKey===actorKey(input.owner)&&e.ownerKey===owner&&sameScope(e)}
 async function cancel(input){
  if(!valid(input))return {schema,status:'DELIVERY_CANCELLATION_NOT_AUTHORIZED',...noAuthority};
  const {packageId,revision}=input;let c,started=false,committed=false,commitAttempted=false;
  try{
   c=await pool.getConnection();await c.beginTransaction();started=true;
   const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)return unknown();
   const [p]=await c.execute('SELECT state,revision,owner_key FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
   if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==revision||!hex(p[0].owner_key))return unknown();
   const [a]=await c.execute('SELECT state,event_id FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if(a.length>1||a.some(x=>!['QUEUED','RUNNING','BLOCKED','COMPLETED','REVOKED'].includes(x.state)||!/^evt_[a-f0-9]{48}$/.test(x.event_id??'')))return unknown();
   const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if(f.length!==1||!['READY_TO_WRITE','WRITING','HISTORICAL_UNRECONCILED','HISTORICAL_WRITING','RECONCILING'].includes(f[0].state))return unknown();
   const [saved]=await c.execute(`SELECT ${fields} FROM opmx_tg_destination_cancellations_v1 WHERE package_id=? OR operation_id=? FOR UPDATE`,[packageId,input.operationId]);
   const previous=saved.length===1?stored(saved[0]):null,audits=await readAudit(c,input,' FOR UPDATE');
   if(saved.length>1||saved.length===1&&(!matches(previous,input,p[0].owner_key)||audits.length!==1||audits[0].actor_key!==previous.actorKey||audits[0].owner_key!==previous.ownerKey||f[0].state!=='RECONCILING'||a.some(x=>x.state!=='REVOKED'))||saved.length===0&&audits.length!==0)return unknown();
   const [updates]=await c.execute('SELECT destination FROM opmx_tg_update_claims_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const [jobs]=await c.execute('SELECT operation_id FROM opmx_tg_update_deliveries_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const [receipts]=await c.execute('SELECT request_id,phase FROM opmx_tg_writer_receipts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if(updates.length||jobs.length||receipts.some(x=>x.request_id!==input.requestId||x.phase!=='DRAFT'))return unknown();
   const [rows]=await c.execute('SELECT i.item_id,i.owner_key,i.kind,i.state,i.text_content,i.content_bytes,i.sha256,c.actor_key FROM opmx_tg_items_v1 i LEFT JOIN opmx_tg_recovery_contributions_v1 c ON c.item_id=i.item_id AND c.package_id=i.package_id WHERE i.package_id=? ORDER BY i.created_at,i.item_id FOR UPDATE',[packageId]);
   if(rows.some(x=>x.state==='PENDING'))return unknown();
   const items=rows.map(x=>({itemId:x.item_id,ownerKey:x.owner_key,kind:x.kind,state:x.state,text:x.text_content,contentBytes:Number(x.content_bytes),sha256:x.sha256,actorKey:x.actor_key??null}));
   const [events]=await c.execute('SELECT event_id FROM opmx_tg_events_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if(events.length!==1||!/^evt_[a-f0-9]{48}$/.test(events[0].event_id??'')||a.length&&a[0].event_id!==events[0].event_id||previous&&previous.eventId!==events[0].event_id)return unknown();
   // The ordinary reconciliation deliberately rejects trash. This narrower
   // incident-only gate validates that outcome as TRASH, never as a draft or
   // as absence, while retaining the same package lock and pinned idle graph.
   if(f[0].state!=='RECONCILING'){
    const [frozen]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='RECONCILING',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state=?",[packageId,revision,f[0].state]);
    if(frozen.affectedRows!==1)throw Error('CANCELLATION_FENCE_CONFLICT');
   }
   const runtime=await observeRuntime({packageId,revision,eventId:events[0].event_id});
   if(!verifyWriterReleaseObservation(runtime,manifest)||!freshRuntime(runtime))return unknown();
   const choices=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
   const expected=choices.map(destination=>expectedDraftRequestId({packageId,revision,destination})),marks=expected.map(()=>'?').join(',');
   const [bindings]=await c.execute('SELECT request_id FROM opmx_tg_request_binding_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const [classes]=await c.execute(`SELECT request_id,kind FROM opmx_tg_request_class_v1 WHERE request_id IN (${marks}) FOR UPDATE`,expected);
   if(bindings.length!==7||new Set(bindings.map(x=>x.request_id)).size!==7||expected.some(id=>!bindings.some(x=>x.request_id===id))||classes.length!==7||new Set(classes.map(x=>x.request_id)).size!==7||classes.some(x=>x.kind!=='TELEGRAM')||expected.some(id=>!classes.some(x=>x.request_id===id)))return unknown();
   const [targets]=await c.execute(`SELECT request_id,destination,target_key,status,post_id FROM opmx_mcp_target_progress WHERE request_id IN (${marks}) FOR UPDATE`,expected);
   const [media]=await c.execute(`SELECT request_id,target_key,role,status,media_id FROM opmx_mcp_media_progress WHERE request_id IN (${marks}) FOR UPDATE`,expected);
   const [claims]=await c.execute('SELECT request_id,slug,destinations FROM opmx_tg_publication_claims_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const [decisions]=await c.execute('SELECT decision_json FROM opmx_tg_confirmed_decisions_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const [closures]=await c.execute('SELECT package_id FROM opmx_tg_recovery_closures_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const scope=incident29CancellationScope;
   if(decisions.length||closures.length||targets.length!==3||new Set(targets.map(x=>x.destination)).size!==3||targets.some(x=>x.request_id!==input.requestId||!Object.hasOwn(scope.posts,x.destination)||Number(x.post_id)!==scope.posts[x.destination]||x.status!=='reported'||x.target_key!==sha(`opmx:v1:${x.destination}:${scope.slug}`))||media.some(x=>x.request_id!==input.requestId||x.status!=='reported'||!Number.isSafeInteger(Number(x.media_id))||Number(x.media_id)<1||!targets.some(t=>t.target_key===x.target_key))||claims.length>1||claims.some(x=>x.request_id!==input.requestId||x.slug!==scope.slug||x.destinations!=='TODOS'))return unknown();
   let prior;try{prior=deriveOriginalDecision({packageId,revision,ownerKey:p[0].owner_key,items})}catch{return unknown()}
   if(prior.requestId!==input.requestId||prior.destinations?.join(',')!=='OPURO,OPOL,LIBERAL')return unknown();
   const results=[];
   for(const destination of ['OPURO','OPOL','LIBERAL']){
    const postId=scope.posts[destination],r=await readWordPress({site:destinationRegistry()[destination].cms,postId}),post=r?.post;
    if(r?.statusCode!==200||post?.id!==postId||post.type!=='post')return unknown();
    results.push({destination,postId,slug:post.slug,originalSlug:scope.slug,status:post.status==='publish'?'PUBLISHED':post.status==='draft'?'DRAFT':post.status==='trash'?'TRASH':'UNKNOWN',wordpressStatus:post.status,cmsVerified:true,publicationVerdict:'CMS_RECORD_CONFIRMED'});
   }
   if(!validResults(results))return unknown();
   if(previous&&canonicalUpdateValue(previous.results)!==canonicalUpdateValue(results))return unknown();
   if(a.length){const [retired]=await c.execute("UPDATE opmx_tg_motor_attempts_v1 SET state='REVOKED',token_hash=NULL,updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND event_id=?",[packageId,revision,events[0].event_id]);if(retired.affectedRows!==1)throw Error('CANCELLATION_ATTEMPT_CONFLICT')}
   let entry=previous;
   if(!entry){
    const e={schema,packageId,revision,requestId:input.requestId,destination:input.destination,postId:input.postId,operationId:input.operationId,eventId:events[0].event_id,actorKey:actorKey(input.owner),ownerKey:p[0].owner_key,results,observedAt:runtime.observedAt,writerRelease:'opmx.fenced-writer-release.v1',processTerminationClaimed:false};
    const encoded=canonicalUpdateValue(e),hash=sha(encoded);
    const [inserted]=await c.execute('INSERT INTO opmx_tg_destination_cancellations_v1 (package_id,revision,request_id,destination,post_id,operation_id,event_id,actor_key,owner_key,evidence_json,evidence_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',[packageId,revision,input.requestId,input.destination,input.postId,input.operationId,e.eventId,e.actorKey,e.ownerKey,encoded,hash]);
    if(inserted.affectedRows!==1)throw Error('CANCELLATION_INSERT_UNCONFIRMED');
    const [recorded]=await c.execute('INSERT INTO opmx_tg_recovery_audit_v1 (package_id,action,previous_revision,revision,actor_key,owner_key,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))',[packageId,action,revision,revision,e.actorKey,e.ownerKey]);
    if(recorded.affectedRows!==1)throw Error('CANCELLATION_AUDIT_UNCONFIRMED');
    entry={...e,tombstoneHash:hash};
   }
   commitAttempted=true;await c.commit();committed=true;
   return {...confirmed(entry),replay:!!previous,observedAt:new Date().toISOString(),cancellationObservedAt:entry.observedAt,writesFenced:true,noActiveN8nWriters:true,attemptState:a.length?'REVOKED':'NOT_REGISTERED',fenceState:'RECONCILING'};
  }catch{return {...unknown(),...(commitAttempted?{commitUncertain:true}:{})}}
  finally{if(c){if(started&&!committed)try{await c.rollback()}catch{try{c.destroy?.()}catch{}}try{c.release()}catch{}}}
 }
 // Observe after an uncertain COMMIT; never call cancel again just to find out.
 // This operation performs SELECTs and authenticated exact-ID CMS reads only.
 async function observe(input){
  if(!valid(input))return {schema,status:'DELIVERY_CANCELLATION_NOT_AUTHORIZED',...noAuthority};
  let c,started=false,result=unknown(),cleaned=true;
  try{
   c=await pool.getConnection();await c.beginTransaction();started=true;
   result=await (async()=>{
    const [rows]=await c.execute(`SELECT ${fields} FROM opmx_tg_destination_cancellations_v1 WHERE package_id=? OR operation_id=?`,[input.packageId,input.operationId]);
    const e=rows.length===1?stored(rows[0]):null;if(!matches(e,input,e?.ownerKey))return unknown();
    const [p]=await c.execute('SELECT state,revision,owner_key FROM opmx_tg_packages_v1 WHERE package_id=?',[input.packageId]);
    const [a]=await c.execute('SELECT state,event_id FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=?',[input.packageId,input.revision]);
    const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=?',[input.packageId,input.revision]);
    const audits=await readAudit(c,input);
    if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==input.revision||p[0].owner_key!==e.ownerKey||a.length>1||a.some(x=>x.state!=='REVOKED'||x.event_id!==e.eventId)||f.length!==1||f[0].state!=='RECONCILING'||audits.length!==1||audits[0].actor_key!==e.actorKey||audits[0].owner_key!==e.ownerKey)return unknown();
    const runtime=await observeRuntime({packageId:e.packageId,revision:e.revision,eventId:e.eventId});
    if(!verifyWriterReleaseObservation(runtime,manifest)||!freshRuntime(runtime))return unknown();
    for(const x of e.results){
     const r=await readWordPress({site:destinationRegistry()[x.destination].cms,postId:x.postId}),post=r?.post;
     if(r?.statusCode!==200||post?.id!==x.postId||post.type!=='post'||post.slug!==x.slug||post.status!==x.wordpressStatus)return unknown();
    }
    return {...confirmed(e),observedAt:new Date().toISOString(),cancellationObservedAt:e.observedAt,writesFenced:true,noActiveN8nWriters:true,attemptState:a.length?'REVOKED':'NOT_REGISTERED',fenceState:'RECONCILING'};
   })();
  }catch{result=unknown()}
  finally{if(c){if(started)try{await c.rollback()}catch{cleaned=false;try{c.destroy?.()}catch{}}try{c.release()}catch{cleaned=false;try{c.destroy?.()}catch{}}}}
  return cleaned?result:unknown();
 }
 return Object.freeze({cancel,observe});
}
