import {shouldSuppressUncertainPublicationAlert} from './publication-alert-resolution.mjs';

const packagePattern=/^tg_[a-f0-9]{40}$/;
const requestPattern=/^tg_[a-f0-9]{64}$/;
const requestStages=new Set(['REQUEST_OPURO','REQUEST_OPOL','REQUEST_AMBOS','REQUEST_LIBERAL','REQUEST_OPURO,LIBERAL','REQUEST_OPOL,LIBERAL','REQUEST_TODOS']);
const uncertainStages=new Set(['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN']);
const publicationProgressStages=new Set(['QUEUED','PROGRESS_START','PROGRESS_WRITING','PROGRESS_IMAGE','PROGRESS_SUBMIT']);
const validRevision=n=>Number.isSafeInteger(n)&&n>0&&n<=4294967295;
const timestamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(s)?Date.parse(s):NaN;
const scopeValid=x=>x&&packagePattern.test(x.package_id??'')&&validRevision(x.revision);

// The Guard's verified final phase selects one of the revision's seven
// pre-registered destination bindings. A source stage's explicit request must
// still match. A legacy stage without one may use that verified selection;
// seven available bindings alone do not identify what was actually published.
export function publicationAlertRequestId(candidate,requestRows=[],{selectedRequestId=null}={}){
 if(!scopeValid(candidate)||!Array.isArray(requestRows))return null;
 const rows=requestRows.filter(r=>r?.package_id===candidate.package_id&&r.revision===candidate.revision&&requestStages.has(r.stage));
 if(!rows.length||rows.some(r=>!requestPattern.test(r.request_id??'')))return null;
 const explicit=candidate.sourceRequestId??candidate.request_id;
 if(explicit!==null&&explicit!==undefined)return requestPattern.test(explicit)&&rows.some(r=>r.request_id===explicit)&&(selectedRequestId===null||selectedRequestId===explicit)?explicit:null;
 if(selectedRequestId!==null)return requestPattern.test(selectedRequestId)&&rows.some(r=>r.request_id===selectedRequestId)?selectedRequestId:null;
 const ids=[...new Set(rows.map(r=>r.request_id))];return ids.length===1?ids[0]:null;
}

// These are durable historical delivery records, not a cached claim that all
// CMS remain published forever. Only the same publication uncertainty/progress
// is superseded. Editorial/source failures and other requests remain visible.
export function publicationAlertWasReconciled(candidate,reconciliationRows=[],{requestRows=[],nowMs=Date.now()}={}){
 if(!scopeValid(candidate)||!Number.isFinite(timestamp(candidate.sourceOccurredAt))||!Array.isArray(reconciliationRows)||!Number.isFinite(nowMs)||!uncertainStages.has(candidate.sourceStage)&&!publicationProgressStages.has(candidate.sourceStage))return false;
 const terminals=reconciliationRows.filter(r=>r?.stage==='PUBLICATION_RECONCILED'&&Number.isSafeInteger(r.id)&&r.id>0&&r.package_id===candidate.package_id&&r.revision===candidate.revision&&requestPattern.test(r.request_id??'')&&Number.isFinite(timestamp(r.occurred_at))&&timestamp(r.occurred_at)<=nowMs+5000&&publicationAlertRequestId({...candidate,sourceRequestId:null,request_id:null},requestRows,{selectedRequestId:r.request_id})===r.request_id);
 const requests=[...new Set(terminals.map(r=>r.request_id))];if(requests.length!==1)return false;
 return publicationAlertRequestId(candidate,requestRows,{selectedRequestId:requests[0]})===requests[0];
}

export function preparePublicationReconciliations(candidates,observations,{requestRows=[],reconciliationRows=[],nowMs=Date.now()}={}){
 if(!Array.isArray(candidates)||!Array.isArray(observations)||!Array.isArray(requestRows)||!Array.isArray(reconciliationRows)||!Number.isFinite(nowMs))throw Error('PUBLICATION_RECONCILIATION_INPUT_INVALID');
 const records=[],seen=new Set();
 for(const candidate of candidates){
  if(!scopeValid(candidate)||!uncertainStages.has(candidate.sourceStage)||publicationAlertWasReconciled(candidate,reconciliationRows,{requestRows,nowMs}))continue;
  const matches=observations.filter(p=>p?.packageId===candidate.package_id&&p.revision===candidate.revision);if(matches.length!==1)continue;
  const proof=matches[0],requestId=publicationAlertRequestId(candidate,requestRows,{selectedRequestId:proof.requestId});
  if(!requestId||proof.requestId!==requestId||!shouldSuppressUncertainPublicationAlert({package_id:candidate.package_id,revision:candidate.revision,stage:candidate.sourceStage,occurred_at:candidate.sourceOccurredAt},proof,{requestRows,nowMs}))continue;
  // Conflicting durable terminal identities need explicit reconciliation;
  // never append the same preferred identity on every poll to outvote them.
  const conflicting=reconciliationRows.some(r=>r?.stage==='PUBLICATION_RECONCILED'&&Number.isSafeInteger(r.id)&&r.id>0&&r.package_id===candidate.package_id&&r.revision===candidate.revision&&r.request_id!==requestId&&Number.isFinite(timestamp(r.occurred_at))&&timestamp(r.occurred_at)<=nowMs+5000&&publicationAlertRequestId({...candidate,sourceRequestId:null,request_id:null},requestRows,{selectedRequestId:r.request_id})===r.request_id);
  if(conflicting)continue;
  const key=candidate.package_id+':'+candidate.revision+':'+requestId;if(seen.has(key))continue;seen.add(key);
  records.push({package_id:candidate.package_id,revision:candidate.revision,stage:'PUBLICATION_RECONCILED',occurred_at:new Date(nowMs).toISOString(),request_id:requestId});
 }
 return records;
}

// The DataTable node returns the inserted row. A positive ID alone is not an
// acknowledgement of this scope; verify every technical column and timestamp.
export function publicationReconciliationInsertConfirmed(expected,row){
 if(!scopeValid(expected)||expected.stage!=='PUBLICATION_RECONCILED'||!requestPattern.test(expected.request_id??'')||!Number.isFinite(timestamp(expected.occurred_at))||!row||Object.hasOwn(row,'error')||!Number.isSafeInteger(row.id)||row.id<1)return false;
 return row.package_id===expected.package_id&&row.revision===expected.revision&&row.stage===expected.stage&&row.request_id===expected.request_id&&Number.isFinite(timestamp(row.occurred_at))&&timestamp(row.occurred_at)===timestamp(expected.occurred_at);
}

export function retainAlertsWithoutPublicationReconciliation(candidates,reconciliationRows,options={}){
 if(!Array.isArray(candidates))throw Error('ALERT_CANDIDATES_INVALID');
 return candidates.filter(candidate=>!publicationAlertWasReconciled(candidate,reconciliationRows,options));
}
