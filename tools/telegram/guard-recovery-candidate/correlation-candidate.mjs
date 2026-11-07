import {createHash} from 'node:crypto';

// Mirrors the active receiver's prospective identifiers. It does not establish
// that Publisher was invoked, or that a destination had no side effects.
const labels=new Set(['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS']);
export function expectedDraftRequestId({packageId,revision,destination}) {
  if(typeof packageId!=='string'||!/^tg_[a-f0-9]{40}$/.test(packageId)||
     !Number.isSafeInteger(revision)||revision<1||!labels.has(destination))throw Error('INVALID_CORRELATION');
  return 'tg_'+createHash('sha256').update(`${packageId}:${revision}:${destination}:draft-v1`).digest('hex');
}
export function matchCandidateCorrelation({packageId,revision,destination,requestId}) {
  return typeof requestId==='string'&&requestId===expectedDraftRequestId({packageId,revision,destination});
}
