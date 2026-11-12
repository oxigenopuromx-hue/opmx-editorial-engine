import {createHash} from 'node:crypto';
import {readCompletedWriterReceipt} from './writer-receipt-store.mjs';
import {destinationRegistry,destinationLabel,resolveDestinations} from './original-destinations.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {verifyWriterReleaseObservation} from './writer-release-contract.mjs';
import writerReleaseManifest from './writer-release-manifest.mjs';

const schema='opmx.telegram.final-publication-observation.v1';
const digest=value=>createHash('sha256').update(value).digest('hex');
const hash=/^[a-f0-9]{64}$/;
const unavailable=()=>({schema,status:'FINAL_PUBLICATION_UNCONFIRMED',writeAuthorized:false,retryPermitted:false});

// Observe an already acknowledged final publication, never create a receipt
// from a CMS read. All scope/IDs originate in locked Guard records. The same
// quota/package/attempt/fence lock order and the pinned idle-writer observation
// prevent a current writer from being confused with a completed publication.
// No SQL mutation, session, event, write capability or COMMIT is performed.
export function createFinalPublicationObserver({pool,observeRuntime,readWordPress,manifest=writerReleaseManifest}){
 if(typeof pool?.getConnection!=='function'||typeof observeRuntime!=='function'||typeof readWordPress!=='function')throw Error('FINAL_PUBLICATION_OBSERVER_CONFIGURATION_INVALID');
 return async input=>{
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='packageId,revision'||!/^tg_[a-f0-9]{40}$/.test(input.packageId??'')||!Number.isSafeInteger(input.revision)||input.revision<1||input.revision>4294967295)return unavailable();
  const {packageId,revision}=input;
  let c,started=false,result=unavailable();
  try{
   c=await pool.getConnection();await c.beginTransaction();started=true;
   result=await (async()=>{
    const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)return unavailable();
    const [packages]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    if(packages.length!==1||packages[0].state!=='READY'||Number(packages[0].revision)!==revision)return unavailable();
    const [attempts]=await c.execute('SELECT state,event_id FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(attempts.length!==1||!['RUNNING','COMPLETED','BLOCKED','REVOKED'].includes(attempts[0].state)||!/^evt_[a-f0-9]{48}$/.test(attempts[0].event_id??''))return unavailable();
    const eventId=attempts[0].event_id;
    const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(fences.length!==1||!['WRITING','HISTORICAL_WRITING','RECONCILING','SETTLED'].includes(fences[0].state))return unavailable();
    const runtime=await observeRuntime({packageId,revision,eventId});
    if(!verifyWriterReleaseObservation(runtime,manifest)||typeof runtime.observedAt!=='string'||!Number.isFinite(Date.parse(runtime.observedAt)))return unavailable();
    // The production runtime adapter verifies scope, nonce, freshness and
    // complete execution pagination. Verify those page facts here as well;
    // the release fingerprint alone must not substitute for an idle scan.
    const states=['running','waiting','new'];
    if(!Array.isArray(runtime.executionPages)||runtime.executionPages.length!==states.length||new Set(runtime.executionPages.map(p=>p?.status)).size!==states.length||runtime.executionPages.some(p=>!states.includes(p?.status)||p.complete!==true||!Array.isArray(p.executions)||p.executions.length!==0))return unavailable();
    const proof=await readCompletedWriterReceipt(c,{packageId,revision,eventId});
    if(!proof||proof.packageId!==packageId||proof.revision!==revision||proof.phase!=='PUBLISH'||!hash.test(proof.receiptHash??'')||!Array.isArray(proof.targets)||!proof.targets.length||proof.targets.length>3)return unavailable();
    const destination=destinationLabel(proof.targets.map(t=>t.destination)),destinations=resolveDestinations(destination);
    if(proof.targets.length!==destinations.length||proof.targets.some((t,i)=>t.destination!==destinations[i]||!Number.isSafeInteger(t.postId)||t.postId<1)||expectedDraftRequestId({packageId,revision,destination})!==proof.requestId)return unavailable();
    const [bindings]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=? FOR UPDATE',[proof.requestId]);
    if(bindings.length!==1||bindings[0].package_id!==packageId||Number(bindings[0].revision)!==revision)return unavailable();
    const [classes]=await c.execute('SELECT kind FROM opmx_tg_request_class_v1 WHERE request_id=? FOR UPDATE',[proof.requestId]);
    if(classes.length!==1||classes[0].kind!=='TELEGRAM')return unavailable();
    const [claims]=await c.execute('SELECT request_id,slug,destinations FROM opmx_tg_publication_claims_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(claims.length!==1||claims[0].request_id!==proof.requestId||claims[0].slug!==proof.slug||claims[0].destinations!==destination)return unavailable();
    const [ledger]=await c.execute('SELECT request_id,destination,target_key,status,post_id FROM opmx_mcp_target_progress WHERE request_id=? FOR UPDATE',[proof.requestId]);
    if(ledger.length!==destinations.length||new Set(ledger.map(r=>r.destination)).size!==destinations.length)return unavailable();
    const targets=[];
    for(const t of proof.targets){
     const matches=ledger.filter(r=>r.request_id===proof.requestId&&r.destination===t.destination&&r.status==='reported'&&String(r.post_id)===String(t.postId)&&r.target_key===digest(`opmx:v1:${t.destination}:${proof.slug}`));
     if(matches.length!==1)return unavailable();
     const response=await readWordPress({site:destinationRegistry()[t.destination].cms,postId:t.postId}),post=response?.post;
     if(response?.statusCode!==200||post?.id!==t.postId||post.type!=='post'||post.slug!==proof.slug||post.status!=='publish')return unavailable();
     targets.push({destination:t.destination,postId:t.postId,slug:proof.slug,status:'publish',cmsVerified:true,ledgerVerified:true});
    }
    return {schema,status:'FINAL_PUBLICATION_CONFIRMED',packageId,revision,requestId:proof.requestId,phase:'PUBLISH',destination,slug:proof.slug,receiptHash:proof.receiptHash,receiptState:'RECORDED',targets,writeAuthorized:false,retryPermitted:false,consistentSnapshot:true,writersIdleVerified:true,observedAt:runtime.observedAt};
   })();
  }catch{result=unavailable()}
  finally{
   if(c){
    if(started)try{await c.rollback()}catch{result=unavailable();try{c.destroy?.()}catch{}}
    try{c.release()}catch{result=unavailable()}
   }
  }
  return result;
 };
}
