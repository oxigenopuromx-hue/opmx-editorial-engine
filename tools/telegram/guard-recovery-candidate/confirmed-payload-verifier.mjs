import {createHash} from 'node:crypto';
import {readVerifiedUpdateDecisionInTransaction} from './confirmed-correction-reader.mjs';
import {canonicalUpdateValue} from './canonical-json.mjs';

// Staging is allowed only for bytes shown in the confirmed preview. A legacy
// material-only preview is deliberately insufficient. Literal preservation,
// CMS preflight and writer fencing are separate, mandatory checks.
export async function verifyConfirmedUpdatePayload(c,input){
 if(!c?.execute||!input||typeof input!=='object')return null;
 let decision;try{decision=await readVerifiedUpdateDecisionInTransaction(c,{packageId:input.packageId,revision:input.revision})}catch{return null}
 if(!decision||decision.action!=='UPDATE'||decision.previewHash!==input.previewHash||decision.contentMode!==input.contentMode||!Array.isArray(decision.posts)||decision.posts.filter(p=>p.destination===input.destination&&p.postId===input.postId).length!==1||!decision.finalPayloads||!Object.hasOwn(decision.finalPayloads,input.destination))return null;
 let expected,actual;try{expected=canonicalUpdateValue(decision.finalPayloads[input.destination]);actual=canonicalUpdateValue(input.payload)}catch{return null}
 if(expected!==actual||createHash('sha256').update(actual).digest('hex')!==input.payloadHash)return null;
 const {packageId,revision,destination,previewHash,postId,payloadHash,contentMode}=input;
 return {packageId,revision,destination,previewHash,postId,payloadHash,contentMode,exactPayload:true};
}
