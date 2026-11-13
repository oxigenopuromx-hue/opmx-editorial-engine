import {createHash} from 'node:crypto';
import {destinationRegistry,destinationLabel} from './original-destinations.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {readVerifiedUpdateDecisionInTransaction} from './confirmed-correction-reader.mjs';

export const writerReceiptSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_writer_receipts_v1 (
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 phase VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, receipt_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 receipt_json MEDIUMTEXT NOT NULL, created_at DATETIME(6) NOT NULL,
 PRIMARY KEY(request_id,phase), KEY(package_id,revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const digest=x=>createHash('sha256').update(x).digest('hex');
const unavailable=()=>({status:'WRITER_RECEIPT_UNCONFIRMED',retryPermitted:false});
const sites=['OPURO','OPOL','LIBERAL'];
function normalize(input){
 if(!input||Object.keys(input).sort().join(',')!=='phase,requestId,slug,targets'||!/^tg_[a-f0-9]{64}$/.test(input.requestId??'')||!['DRAFT','PUBLISH'].includes(input.phase)||typeof input.slug!=='string'||input.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)||!Array.isArray(input.targets)||!input.targets.length||input.targets.length>3)return null;
 if(input.targets.some(t=>!t||Object.keys(t).sort().join(',')!=='destination,postId'||!sites.includes(t.destination)||!Number.isSafeInteger(t.postId)||t.postId<1)||new Set(input.targets.map(t=>t.destination)).size!==input.targets.length)return null;
 return {...input,targets:sites.flatMap(d=>input.targets.filter(t=>t.destination===d))};
}

// Called by the deployed writer after all CMS mutations and readbacks, never
// by a source document or a Motor tool. A receipt records an acknowledged
// completed phase; absence of a receipt keeps an uncertain phase unresolved.
export function createWriterReceiptStore({pool,readWordPress}){
 if(!pool?.getConnection||typeof readWordPress!=='function')throw Error('WRITER_RECEIPT_CONFIGURATION_INVALID');
 return {async report(input){
  const x=normalize(input);if(!x)return unavailable();
  const c=await pool.getConnection();let committed=false;
  const finish=async result=>{await c.commit();committed=true;return result};
  try{await c.beginTransaction();
   const [quota]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(quota.length!==1)throw Error('QUOTA_MISSING');
   const [bindings]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=?',[x.requestId]);
   if(bindings.length!==1)return await finish(unavailable());const b=bindings[0],revision=Number(b.revision);
   if(expectedDraftRequestId({packageId:b.package_id,revision,destination:destinationLabel(x.targets.map(t=>t.destination))})!==x.requestId)return await finish(unavailable());
   const [packages]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[b.package_id]);
   const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[b.package_id,revision]);
   if(packages.length!==1||packages[0].state!=='READY'||Number(packages[0].revision)!==revision||fences.length!==1||!['WRITING','HISTORICAL_WRITING'].includes(fences[0].state))return await finish(unavailable());
   const receipt={...x,packageId:b.package_id,revision},encoded=canonicalUpdateValue(receipt),hash=digest(encoded);
   const [prior]=await c.execute('SELECT receipt_hash,receipt_json FROM opmx_tg_writer_receipts_v1 WHERE request_id=? AND phase=? FOR UPDATE',[x.requestId,x.phase]);
   const ack=status=>({status,packageId:b.package_id,revision,requestId:x.requestId,phase:x.phase,receiptHash:hash,retryPermitted:false});
   if(prior.length)return await finish(prior.length===1&&prior[0].receipt_hash===hash&&prior[0].receipt_json===encoded?ack('WRITER_RECEIPT_REPLAY'):unavailable());
   const [claims]=await c.execute('SELECT request_id,slug,destinations FROM opmx_tg_publication_claims_v1 WHERE package_id=? AND revision=? FOR UPDATE',[b.package_id,revision]);
   if(x.phase==='PUBLISH'&&(claims.length!==1||claims[0].request_id!==x.requestId||claims[0].slug!==x.slug||claims[0].destinations!==destinationLabel(x.targets.map(t=>t.destination))))return await finish(unavailable());
   if(x.phase==='DRAFT'&&claims.length)return await finish(unavailable());
   const [targets]=await c.execute('SELECT request_id,destination,target_key,status,post_id FROM opmx_mcp_target_progress WHERE request_id=? FOR UPDATE',[x.requestId]);
   if(targets.length!==x.targets.length||x.targets.some(t=>targets.filter(r=>r.destination===t.destination&&r.status==='reported'&&String(r.post_id)===String(t.postId)&&r.target_key===digest(`opmx:v1:${t.destination}:${x.slug}`)).length!==1))return await finish(unavailable());
   for(const t of x.targets){
    const r=await readWordPress({site:destinationRegistry()[t.destination].cms,postId:t.postId}),p=r?.post;
    if(r?.statusCode!==200||p?.id!==t.postId||p.type!=='post'||p.slug!==x.slug||p.status!==(x.phase==='PUBLISH'?'publish':'draft'))return await finish(unavailable());
   }
   await c.execute('INSERT INTO opmx_tg_writer_receipts_v1 (request_id,phase,package_id,revision,receipt_hash,receipt_json,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))',[x.requestId,x.phase,b.package_id,revision,hash,encoded]);
   return await finish(ack('WRITER_RECEIPT_RECORDED'));
  }catch{if(!committed)try{await c.rollback()}catch{}return unavailable()}finally{c.release()}
 }};
}

// Caller already owns the package, attempt and fence locks. This does not
// manufacture a receipt from a CMS read: it requires the writer's durable ack.
export async function readCompletedWriterReceipt(c,{packageId,revision,eventId,expectedPhase=null}){
 if(!c?.execute||!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||revision<1||!/^evt_[a-f0-9]{48}$/.test(eventId??''))return null;
 if(expectedPhase!==null&&!['DRAFT','PUBLISH'].includes(expectedPhase))return null;
 const [events]=await c.execute('SELECT event_id FROM opmx_tg_events_v1 WHERE package_id=? AND revision=? AND event_id=? FOR UPDATE',[packageId,revision,eventId]);if(events.length!==1)return null;
 const [decisions]=await c.execute('SELECT decision_json FROM opmx_tg_confirmed_decisions_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 if(decisions.length>1)return null;
 if(decisions.length){
  let saved;try{saved=JSON.parse(decisions[0].decision_json)}catch{return null}
  if(saved?.action==='UPDATE'){
   if(expectedPhase!==null)return null;
   let d;try{d=await readVerifiedUpdateDecisionInTransaction(c,{packageId,revision})}catch{return null}
   if(!d?.finalPayloads||!Array.isArray(d.posts)||!d.posts.length)return null;
   const [claims]=await c.execute('SELECT destination,post_id,preview_hash,payload_hash,operation_id,state FROM opmx_tg_update_claims_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const [jobs]=await c.execute('SELECT destination,post_id,preview_hash,payload_hash,operation_id,state FROM opmx_tg_update_deliveries_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if(claims.length!==d.posts.length||jobs.length!==d.posts.length||new Set(claims.map(r=>r.destination)).size!==d.posts.length||new Set(jobs.map(r=>r.destination)).size!==d.posts.length)return null;
   const targets=[];
   for(const p of d.posts){const h=digest(canonicalUpdateValue(d.finalPayloads[p.destination])),a=claims.find(r=>r.destination===p.destination),j=jobs.find(r=>r.destination===p.destination);if(!a||!j||a.state!=='CONFIRMED'||j.state!=='CONFIRMED'||Number(a.post_id)!==p.postId||Number(j.post_id)!==p.postId||a.preview_hash!==d.previewHash||j.preview_hash!==d.previewHash||a.payload_hash!==h||j.payload_hash!==h||a.operation_id!==j.operation_id)return null;targets.push({destination:p.destination,postId:p.postId,payloadHash:h,operationId:a.operation_id})}
   const proof={packageId,revision,eventId,phase:'UPDATE',previewHash:d.previewHash,targets};return {...proof,receiptHash:digest(canonicalUpdateValue(proof))};
  }
 }
 const [claims]=await c.execute('SELECT request_id FROM opmx_tg_publication_claims_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);if(claims.length>1)return null;
 const phase=expectedPhase??(claims.length?'PUBLISH':'DRAFT');
 if(phase==='PUBLISH'&&claims.length!==1)return null;
 const [rows]=await c.execute('SELECT request_id,phase,receipt_hash,receipt_json FROM opmx_tg_writer_receipts_v1 WHERE package_id=? AND revision=? AND phase=? FOR UPDATE',[packageId,revision,phase]);
 if(rows.length!==1||digest(rows[0].receipt_json)!==rows[0].receipt_hash)return null;
 let value;try{value=JSON.parse(rows[0].receipt_json)}catch{return null}
 const x=normalize({requestId:value.requestId,phase:value.phase,slug:value.slug,targets:value.targets});
 if(!x||value.packageId!==packageId||value.revision!==revision||x.phase!==phase||rows[0].request_id!==x.requestId||rows[0].phase!==phase||canonicalUpdateValue(value)!==rows[0].receipt_json||expectedDraftRequestId({packageId,revision,destination:destinationLabel(x.targets.map(t=>t.destination))})!==x.requestId||claims.length&&claims[0].request_id!==x.requestId)return null;
 return {...value,receiptHash:rows[0].receipt_hash};
}
