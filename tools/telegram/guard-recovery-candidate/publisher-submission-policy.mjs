import {createHash} from 'node:crypto';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {destinationLabel,resolveDestinations} from './original-destinations.mjs';
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const unavailable=()=>({status:'RESULT_UNCONFIRMED',completionPermitted:false,retryPermitted:false,writeAuthorized:false});
// A Motor must execute this check on the authenticated manifest, not on a
// source document or a model reconstruction. No result grants a new write.
export function validatePublisherSubmissionOutcome(inventory,expected){
 try{
  const {packageId,revision,requestId,phase,destination,slug,submissionHash=null}=expected??{};
  const sites=resolveDestinations(destination);
  if(!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||revision<1||revision>4294967295||!['PUBLISH','DRAFT'].includes(phase)||destinationLabel(sites)!==destination||expectedDraftRequestId({packageId,revision,destination})!==requestId||typeof slug!=='string'||slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||submissionHash!==null&&!hash(submissionHash)||inventory?.status!=='PACKAGE_FOUND'||inventory.package_id!==packageId||inventory.revision!==revision||inventory.state!=='READY')return unavailable();
  const r=inventory.publisher_result;
  if(!r||r.schema!=='opmx.publisher-submission-result.v1'||r.package_id!==packageId||r.revision!==revision||r.request_id!==requestId||r.phase!==phase||r.destino!==destination||r.slug!==slug||!hash(r.submission_hash)||submissionHash!==null&&r.submission_hash!==submissionHash||r.retryPermitted!==false||r.write_authorized!==false||r.current_cms_state!=='NOT_CHECKED'||r.public_visibility!=='NOT_CHECKED'||!['NOT_RECORDED','SENT','UNCERTAIN'].includes(r.telegram_notice))return unavailable();
  if(['SUBMISSION_PENDING','SUBMISSION_UNCERTAIN'].includes(r.status))return {status:r.status,completionPermitted:false,retryPermitted:false,writeAuthorized:false};
  if(r.status!=='WRITER_RESULT_CONFIRMED'||r.historical!==true||!hash(r.receipt_hash)||!Array.isArray(r.targets)||r.targets.length!==sites.length||r.targets.some((t,i)=>t?.destination!==sites[i]||!Number.isSafeInteger(t.post_id)||t.post_id<1||t.slug!==slug||t.status!==(phase==='PUBLISH'?'publish':'draft')))return unavailable();
  const receipt={requestId,phase,slug,targets:r.targets.map(t=>({destination:t.destination,postId:t.post_id})),packageId,revision};
  if(createHash('sha256').update(canonicalUpdateValue(receipt)).digest('hex')!==r.receipt_hash)return unavailable();
  return {status:'WRITER_RESULT_CONFIRMED',completionPermitted:true,historical:true,phase,requestId,receiptHash:r.receipt_hash,telegramNotice:r.telegram_notice,targets:r.targets.map(t=>({...t})),currentCmsState:'NOT_CHECKED',publicVisibility:'NOT_CHECKED',retryPermitted:false,writeAuthorized:false};
 }catch{return unavailable()}
}
