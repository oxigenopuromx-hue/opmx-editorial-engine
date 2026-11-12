import {createHash} from 'node:crypto';
import {deriveOriginalDecision} from './original-policy-provider.mjs';
import {readRecoveredPolicyInTransaction} from './recovered-policy-mysql.mjs';
import {readConfirmedCorrectionInTransaction} from './confirmed-correction-reader.mjs';
import {ORDER_PREFIX,decodeControl} from './original-destination-policy.mjs';
import {destinationLabel,resolveDestinations} from './original-destinations.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {assertLiteralCanonicalText} from '../../editorial/literal-text.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const digest=/^[a-f0-9]{64}$/;
const packagePattern=/^tg_[a-f0-9]{40}$/;
const itemPattern=/^ti_[a-f0-9]{40}$/;
const requestPattern=/^tg_[a-f0-9]{64}$/;
const revisionValid=x=>Number.isSafeInteger(x)&&x>0&&x<=4294967295;
const fail=()=>{throw Error('LITERAL_SCOPE_UNCONFIRMED')};
const unavailable=()=>({status:'LITERAL_TEXT_UNCONFIRMED',writesStarted:false,retryPermitted:false});
const fields=['title','subtitle','html','gutenberg','enriched'];

export const literalPayloadSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_literal_payloads_v1 (
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL,
 destination VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 content_mode VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 preview_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 source_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_json MEDIUMTEXT NOT NULL, source_json MEDIUMTEXT NOT NULL,
 created_at DATETIME(6) NOT NULL,
 KEY(package_id,revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

// Caller owns the package lock. Only persisted receiver controls, recovery
// closures and confirmed decisions choose the profile; MASTER is not authority.
// This reader never accepts content IDs, source text or positive assertions from
// the HTTP caller. Original text bytes/hashes and provenance are checked again.
export async function readLiteralScopeInTransaction(c,{packageId,revision}){
 if(!c?.execute||!packagePattern.test(packageId??'')||!revisionValid(revision))fail();
 const [packages]=await c.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
 if(packages.length!==1||packages[0].state!=='READY'||Number(packages[0].revision)!==revision||!digest.test(packages[0].owner_key??''))fail();
 const ownerKey=packages[0].owner_key;
 const [rows]=await c.execute('SELECT i.item_id,i.owner_key,i.kind,i.state,i.text_content,i.content_bytes,i.sha256,c.actor_key FROM opmx_tg_items_v1 i LEFT JOIN opmx_tg_recovery_contributions_v1 c ON c.item_id=i.item_id AND c.package_id=i.package_id WHERE i.package_id=? ORDER BY i.created_at,i.item_id FOR UPDATE',[packageId]);
 if(!rows.length||rows.length>1000)fail();
 const items=rows.map(r=>({itemId:r.item_id,ownerKey:r.owner_key,kind:r.kind,state:r.state,text:r.text_content,contentBytes:Number(r.content_bytes),sha256:r.sha256,actorKey:r.actor_key??null}));
 const [closures]=await c.execute('SELECT package_id FROM opmx_tg_recovery_closures_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 if(closures.length>1)fail();
 let mode,destination,controls;
 if(closures.length){
  const p=await readRecoveredPolicyInTransaction(c,packageId,revision);
  if(!p?.authorized||!['PUBLISH','DRAFT'].includes(p.mode)||!Array.isArray(p.control_item_ids))fail();
  mode=p.content_mode??'EDITORIAL';destination=p.destination;controls=p.control_item_ids;
 }else{
  const p=deriveOriginalDecision({packageId,revision,ownerKey,items});
  mode=p.contentMode??'EDITORIAL';destination=destinationLabel(p.destinations);controls=p.controls;
 }
 let previewHash=null;
 const [saved]=await c.execute('SELECT decision_json FROM opmx_tg_confirmed_decisions_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 if(saved.length>1)fail();
 if(saved.length){
  let decision;try{decision=JSON.parse(saved[0].decision_json)}catch{fail()}
  // An UPDATE can never acquire an ordinary CREATE/media permit.
  if(!closures.length||decision?.action!=='CREATE')fail();
  const d=await readConfirmedCorrectionInTransaction(c,packageId,revision);
  if(!d||d.action!=='CREATE'||!digest.test(d.preview_hash??''))fail();
  mode=d.content_mode;destination=d.destination;previewHash=d.preview_hash;
 }
 if(!['EDITORIAL','LITERAL'].includes(mode)||!Array.isArray(controls)||new Set(controls).size!==controls.length||!controls.length||destinationLabel(resolveDestinations(destination))!==destination)fail();
 const ids=new Set(),sourceItems=[],texts=[];
 const controlIds=new Set(controls);
 for(const item of items){
  if(!itemPattern.test(item.itemId??'')||ids.has(item.itemId)||!['TEXT','FILE'].includes(item.kind)||!['STORED','DISCARDED'].includes(item.state))fail();
  ids.add(item.itemId);if(item.state==='DISCARDED')continue;
  if(item.ownerKey!==ownerKey||!digest.test(item.sha256??'')||!Number.isSafeInteger(item.contentBytes)||item.contentBytes<1)fail();
  sourceItems.push({itemId:item.itemId,kind:item.kind,sha256:item.sha256,bytes:item.contentBytes});
  if(item.kind!=='TEXT')continue;
  if(typeof item.text!=='string'||Buffer.byteLength(item.text)!==item.contentBytes||hash(item.text)!==item.sha256)fail();
  if(controlIds.has(item.itemId)){
   if(!decodeControl(item.text.trim(),packageId))fail();
   continue;
  }
  if(item.text.startsWith(ORDER_PREFIX)){
   // The receiver's direct-image control is not article prose. A natural image
   // instruction may have a remaining editorial text, which must not disappear.
   const marked=item.text.slice(ORDER_PREFIX.length),lines=marked.split(/\r?\n/),first=lines.shift();
   const image=/^(?:\/imagen[ \t]+generar|(?:genera|generar|crea|crear)[ \t]+(?:una[ \t]+)?(?:imagen|ilustraci[oó]n)[^\r\n]{0,180})$/i.test(first??'');
   if(!image)fail();
   if(lines.join('\n').trim())texts.push(lines.join('\n'));
  }else if(item.text.trim())texts.push(item.text);
 }
 if([...controlIds].some(id=>!ids.has(id)))fail();
 if(mode==='LITERAL'&&!texts.length)fail();
 const sourceJson=canonicalUpdateValue(sourceItems);
 return {packageId,revision,ownerKey,contentMode:mode,destination,controlItemIds:[...controls],previewHash,sourceText:texts.join('\n\n'),sourceItems,sourceJson,sourceHash:hash(sourceJson)};
}

function normalizedPayload(input){
 if(fields.some(k=>typeof input?.[k]!=='string'))return null;
 const payload=Object.fromEntries(fields.map(k=>[k,input[k]]));
 if(Buffer.byteLength(canonicalUpdateValue(payload))>6*1024*1024)return null;
 return payload;
}
const proofAck=(scope,requestId,payloadHash)=>({status:'LITERAL_TEXT_VERIFIED',requestId,packageId:scope.packageId,revision:scope.revision,destination:scope.destination,mode:'LITERAL',payloadHash,sourceHash:scope.sourceHash,previewHash:scope.previewHash,retryPermitted:false});

// This route records enforcement evidence before any media or CMS claim. It
// does not open a fence or confer a write capability. A replay can only attest
// the exact same immutable payload; a changed payload requires a new revision.
export function createLiteralPayloadStore({pool,verifyRelease=async()=>false,readScope=readLiteralScopeInTransaction}){
 if(typeof pool?.getConnection!=='function'||typeof verifyRelease!=='function'||typeof readScope!=='function')throw Error('LITERAL_PAYLOAD_CONFIGURATION_INVALID');
 return {async validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='declaredMode,enriched,gutenberg,html,requestId,subtitle,title'||!requestPattern.test(input.requestId??'')||!['EDITORIAL','LITERAL'].includes(input.declaredMode))return unavailable();
  const payload=normalizedPayload(input);if(!payload)return unavailable();
  let c,started=false,committed=false,commitAttempted=false,result=unavailable();
  try{
   c=await pool.getConnection();await c.beginTransaction();started=true;
   const outcome=await (async()=>{
    const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)return null;
    const [bindings]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=?',[input.requestId]);
    if(bindings.length!==1||!packagePattern.test(bindings[0].package_id??''))return null;
    const packageId=bindings[0].package_id,revision=Number(bindings[0].revision);if(!revisionValid(revision))return null;
    const [p]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==revision)return null;
    const [attempts]=await c.execute('SELECT state,event_id FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    const scope=await readScope(c,{packageId,revision});
    if(!scope||scope.packageId!==packageId||scope.revision!==revision||expectedDraftRequestId({packageId,revision,destination:scope.destination})!==input.requestId||scope.contentMode!==input.declaredMode)return null;
    const [classes]=await c.execute('SELECT kind FROM opmx_tg_request_class_v1 WHERE request_id=? FOR UPDATE',[input.requestId]);if(classes.length!==1||classes[0].kind!=='TELEGRAM')return null;
    if(scope.contentMode==='EDITORIAL')return {result:{status:'EDITORIAL_PROFILE_UNCHANGED',requestId:input.requestId,mode:'EDITORIAL',retryPermitted:false},commit:false};
    if(attempts.length!==1||attempts[0].state!=='RUNNING'||!/^evt_[a-f0-9]{48}$/.test(attempts[0].event_id??'')||fences.length!==1||!['AWAITING_DECISION','READY_TO_WRITE','WRITING','HISTORICAL_WRITING'].includes(fences[0].state)||typeof scope.sourceText!=='string'||!digest.test(scope.sourceHash??'')||!Array.isArray(scope.sourceItems)||scope.sourceJson!==canonicalUpdateValue(scope.sourceItems)||hash(scope.sourceJson)!==scope.sourceHash)return null;
    assertLiteralCanonicalText({sourceText:scope.sourceText,...payload});
    if(await verifyRelease(c,{packageId,revision,eventId:attempts[0].event_id})!==true)return null;
    const encoded=canonicalUpdateValue(payload),payloadHash=hash(encoded);
    const [prior]=await c.execute('SELECT package_id,revision,destination,content_mode,preview_hash,payload_hash,source_hash,payload_json,source_json FROM opmx_tg_literal_payloads_v1 WHERE request_id=? FOR UPDATE',[input.requestId]);
    const exact=r=>r.package_id===packageId&&Number(r.revision)===revision&&r.destination===scope.destination&&r.content_mode==='LITERAL'&&(r.preview_hash??null)===scope.previewHash&&r.payload_hash===payloadHash&&r.source_hash===scope.sourceHash&&r.payload_json===encoded&&r.source_json===scope.sourceJson;
    if(prior.length)return prior.length===1&&exact(prior[0])?{result:proofAck(scope,input.requestId,payloadHash),commit:false}:null;
    // Evidence cannot be invented after a writer has already started.
    if(!['AWAITING_DECISION','READY_TO_WRITE'].includes(fences[0].state))return null;
    const [inserted]=await c.execute('INSERT INTO opmx_tg_literal_payloads_v1 (request_id,package_id,revision,destination,content_mode,preview_hash,payload_hash,source_hash,payload_json,source_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',[input.requestId,packageId,revision,scope.destination,'LITERAL',scope.previewHash,payloadHash,scope.sourceHash,encoded,scope.sourceJson]);
    if(inserted.affectedRows!==1)throw Error('LITERAL_PROOF_INSERT_UNCONFIRMED');
    return {result:proofAck(scope,input.requestId,payloadHash),commit:true};
   })();
   if(outcome){
    if(outcome.commit){commitAttempted=true;await c.commit();committed=true}
    result=outcome.result;
   }
  }catch{result=commitAttempted?{status:'LITERAL_PROOF_COMMIT_UNCONFIRMED',writesStarted:false,retryPermitted:false}:unavailable()}
  finally{
   if(c){if(started&&!committed)try{await c.rollback()}catch{result=unavailable();try{c.destroy?.()}catch{}}try{c.release()}catch{result=unavailable()}}
  }
  return result;
 }};
}

// Called only while the package/fence locks are held. A stored hash alone is
// insufficient: recheck its canonical payload, current immutable source corpus,
// mode, destination and confirmed preview binding before acknowledging a write.
export async function readLiteralProofInTransaction(c,{packageId,revision,destination,previewHash}, {readScope=readLiteralScopeInTransaction}={}){
 try{
  if(!c?.execute||!packagePattern.test(packageId??'')||!revisionValid(revision)||typeof readScope!=='function'||destinationLabel(resolveDestinations(destination))!==destination)return null;
  const requestId=expectedDraftRequestId({packageId,revision,destination});
  const [rows]=await c.execute('SELECT package_id,revision,destination,content_mode,preview_hash,payload_hash,source_hash,payload_json,source_json FROM opmx_tg_literal_payloads_v1 WHERE request_id=? FOR UPDATE',[requestId]);
  if(rows.length!==1)return null;const row=rows[0];
  const scope=await readScope(c,{packageId,revision});
  if(!scope||scope.contentMode!=='LITERAL'||scope.destination!==destination||row.package_id!==packageId||Number(row.revision)!==revision||row.destination!==destination||row.content_mode!=='LITERAL'||(row.preview_hash??null)!==scope.previewHash||previewHash!==undefined&&previewHash!==scope.previewHash||!digest.test(row.payload_hash??'')||!digest.test(row.source_hash??'')||row.source_hash!==scope.sourceHash||row.source_json!==scope.sourceJson||hash(row.source_json)!==row.source_hash)return null;
  const payload=JSON.parse(row.payload_json);if(!payload||Object.keys(payload).sort().join(',')!=='enriched,gutenberg,html,subtitle,title'||!normalizedPayload(payload)||canonicalUpdateValue(payload)!==row.payload_json||hash(row.payload_json)!==row.payload_hash)return null;
  assertLiteralCanonicalText({sourceText:scope.sourceText,...payload});
  return {packageId,revision,destination,requestId,previewHash:scope.previewHash,payloadHash:row.payload_hash,sourceHash:row.source_hash,mode:'LITERAL',payload};
 }catch{return null}
}
