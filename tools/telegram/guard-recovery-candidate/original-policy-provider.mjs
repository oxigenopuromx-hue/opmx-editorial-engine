import {chooseTelegramMode} from './original-destination-policy.mjs';
import {resolveDestinations} from './original-destinations.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';

// Candidate only. Input is read and locked by the guard, not sent by the bot.
// This derives an editorial decision, never evidence that processing stopped.
export function deriveOriginalDecision({packageId,revision,ownerKey,items}) {
 if(!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||revision<1||!/^[a-f0-9]{64}$/.test(ownerKey??'')||!Array.isArray(items))throw Error('ORIGINAL_POLICY_UNCONFIRMED');
 const inventory={package_id:packageId,state:'READY',items:[]},sources=[];
 for(const item of items){
  // Actor provenance must come from a left join on contributions. Recovered
  // revisions use the recovery policy reader instead, even when message IDs
  // happen to look ordered across chats.
  if(!Object.hasOwn(item,'actorKey')||item.actorKey!==null||item.ownerKey!==ownerKey||typeof item.itemId!=='string'||!/^ti_[a-f0-9]{40}$/.test(item.itemId)||!['TEXT','FILE'].includes(item.kind))throw Error('ORIGINAL_POLICY_UNCONFIRMED');
  const mapped={item_id:item.itemId,kind:item.kind,state:item.state,sha256:item.sha256,text_bytes:item.contentBytes};
  if(item.kind==='TEXT'&&item.state==='STORED'){
   if(typeof item.text!=='string'||!Number.isSafeInteger(item.contentBytes)||item.contentBytes<0)throw Error('ORIGINAL_POLICY_UNCONFIRMED');
   sources.push({item_id:item.itemId,stream:'text',bytes:Buffer.from(item.text,'utf8')});
  }
  inventory.items.push(mapped);
 }
 let decision;try{decision=chooseTelegramMode(inventory,sources)}catch{throw Error('ORIGINAL_POLICY_UNCONFIRMED')}
 if(!decision.authorized||!['PUBLISH','DRAFT'].includes(decision.mode)||!Array.isArray(decision.control_item_ids)||!decision.control_item_ids.length)throw Error('ORIGINAL_POLICY_UNCONFIRMED');
 const destinations=resolveDestinations(decision.destination);
 return {packageId,revision,ownerKey,requestId:expectedDraftRequestId({packageId,revision,destination:decision.destination}),destinations,
  authorization:{mode:decision.mode,authorized:decision.authorized,explicit:decision.explicit,authorization:decision.authorization},controls:decision.control_item_ids};
}

// The result provider is server-owned and must obtain its answer under the
// same transaction and an effective all-writers fence. No implementation of
// that evidence source is currently installed in production.
export function createOriginalRevisionCapture({lockVerifiedBlockedOutcomes}) {
 if(typeof lockVerifiedBlockedOutcomes!=='function')throw Error('MISSING_BLOCKED_OUTCOME_PROVIDER');
 return async function capture(connection,packageId,revision,ownerKey,items){
  let decision;try{decision=deriveOriginalDecision({packageId,revision,ownerKey,items})}catch{return null;}
  const outcome=await lockVerifiedBlockedOutcomes(connection,decision);
  if(!Array.isArray(outcome)||outcome.length!==decision.destinations.length||new Set(outcome.map(x=>x?.destination)).size!==decision.destinations.length||outcome.some(x=>!decision.destinations.includes(x?.destination)||x.status!=='BLOCKED'||x.publicationVerdict!=='NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'))return null;
  return {...decision,results:outcome.map(({destination,status,publicationVerdict})=>({destination,status,publicationVerdict}))};
 };
}
