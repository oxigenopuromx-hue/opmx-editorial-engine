const PACKAGE=/^tg_[a-f0-9]{40}$/;
const REQUEST=/^tg_[a-f0-9]{64}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SITES=['OPURO','OPOL','LIBERAL'];
const DESTINATIONS={
 OPURO:['OPURO'],OPOL:['OPOL'],AMBOS:['OPURO','OPOL'],LIBERAL:['LIBERAL'],
 'OPURO,LIBERAL':['OPURO','LIBERAL'],'OPOL,LIBERAL':['OPOL','LIBERAL'],TODOS:SITES
};
const UNCERTAIN=new Set(['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN']);
const revision=x=>Number.isSafeInteger(x)&&x>0&&x<=4294967295;
const time=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x)?Date.parse(x):NaN;

// The observation must come exclusively from the authenticated Guard's fixed
// read-only final-publication endpoint. This validator does not authenticate a
// caller or turn user/source text, Telegram notices or HTTP200 into evidence.
// REQUEST rows are the receiver's existing immutable correlation records; the
// Guard independently checks the canonical binding, receipt and CMS identities.
// No URL, target, request ID or positive assertion is sent to the Guard by this
// resolver. It only decides whether an already selected uncertain alert is stale.
export function shouldSuppressUncertainPublicationAlert(row,observation,{requestRows=[],nowMs=Date.now(),maxObservationAgeMs=120000}={}){
 if(!row||!UNCERTAIN.has(row.stage)||!PACKAGE.test(row.package_id??'')||!revision(row.revision)||!Number.isFinite(nowMs)||!Number.isSafeInteger(maxObservationAgeMs)||maxObservationAgeMs<0)return false;
 const x=observation;
 if(!x||typeof x!=='object'||Array.isArray(x)||x.schema!=='opmx.telegram.final-publication-observation.v1'||x.status!=='FINAL_PUBLICATION_CONFIRMED'||x.phase!=='PUBLISH'||x.receiptState!=='RECORDED'||x.packageId!==row.package_id||x.revision!==row.revision||!REQUEST.test(x.requestId??'')||!DIGEST.test(x.receiptHash??'')||typeof x.slug!=='string'||x.slug.length>200||!SLUG.test(x.slug)||x.writeAuthorized!==false||x.retryPermitted!==false||x.writersIdleVerified!==true||x.consistentSnapshot!==true)return false;
 const observed=time(x.observedAt),source=time(row.occurred_at);
 // Freshness only rejects stale/cache/future input. It never proves that a
 // writer stopped; writersIdleVerified and the locked Guard snapshot do that.
 if(!Number.isFinite(observed)||!Number.isFinite(source)||observed<source||observed>nowMs+5000||nowMs-observed>maxObservationAgeMs)return false;
 const requested=Object.hasOwn(DESTINATIONS,x.destination??'')?DESTINATIONS[x.destination]:null;
 if(!requested||!Array.isArray(x.targets)||x.targets.length!==requested.length)return false;
 if(x.targets.some((t,i)=>!t||typeof t!=='object'||t.destination!==requested[i]||!Number.isSafeInteger(t.postId)||t.postId<1||t.slug!==x.slug||t.status!=='publish'||t.cmsVerified!==true||t.ledgerVerified!==true))return false;
 if(!Array.isArray(requestRows))return false;
 const bindings=requestRows.filter(r=>r?.package_id===row.package_id&&r.revision===row.revision&&r.stage==='REQUEST_'+x.destination);
 return bindings.length===1&&bindings[0].request_id===x.requestId;
}

// Candidates retain the original stage/time, even though their outgoing
// stage is ALERT_ADMIN_<row-id>. Never infer the reason from human text or
// suppress unrelated alerts. Duplicate/ambiguous Guard responses fail closed.
export function retainUnresolvedPublicationAlerts(candidates,observations,options={}){
 if(!Array.isArray(candidates))throw Error('ALERT_CANDIDATES_INVALID');
 const proofs=Array.isArray(observations)?observations:[];
 return candidates.filter(candidate=>{
  const matching=proofs.filter(x=>x?.packageId===candidate?.package_id&&x.revision===candidate?.revision);
  if(matching.length!==1)return true;
  const row={package_id:candidate.package_id,revision:candidate.revision,stage:candidate.sourceStage,occurred_at:candidate.sourceOccurredAt};
  return !shouldSuppressUncertainPublicationAlert(row,matching[0],options);
 });
}
