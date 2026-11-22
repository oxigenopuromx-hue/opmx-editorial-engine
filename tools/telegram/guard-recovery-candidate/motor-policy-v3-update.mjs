import {chooseMotorPolicy as chooseLegacy} from './motor-policy.mjs';
import {chooseTelegramMode,decodeControl} from './versioned-telegram-policy.mjs';
import {chooseMotorPolicy as chooseRecoveredV3} from './motor-policy-recovered-v3-update.mjs';

// Candidate only. The existing manifest and control bytes are authenticated by
// the receiver; this selector never treats source text as an order. Recovery
// of v3 UPDATE requires the complete guard, decision and writer paths.
// This candidate must not be activated on its own. Historic decisions retain the pinned selector.
export function chooseMotorPolicy(inventory,sources,{packageId,revision}={}){
 const fail=()=>{throw Error('RECOVERED_POLICY_UNCONFIRMED')};
 if(!inventory||inventory.status!=='PACKAGE_FOUND'||inventory.package_id!==packageId||inventory.revision!==revision||inventory.state!=='READY'||!Array.isArray(inventory.items)||!Array.isArray(sources))fail();
 const modernPolicies=['publish-todos-v3','publish-ambos-v4'];let observedPolicy=null;
 for(const source of sources){if(source?.stream!=='text'||!Buffer.isBuffer(source.bytes))continue;try{const control=decodeControl(new TextDecoder('utf-8',{fatal:true}).decode(source.bytes).trim(),packageId);if(modernPolicies.includes(control?.policy)){if(observedPolicy&&observedPolicy!==control.policy)fail();observedPolicy=control.policy}}catch{/* The selected implementation rejects malformed controls. */}}
 if(Object.hasOwn(inventory,'recovered_policy')){
  if(observedPolicy||modernPolicies.includes(inventory.recovered_policy?.policy)||modernPolicies.includes(inventory.confirmed_correction?.policy)){if(!observedPolicy||inventory.recovered_policy?.policy!==observedPolicy||inventory.confirmed_correction?.policy!==observedPolicy)fail();return chooseRecoveredV3(inventory,sources,{packageId,revision});}
  return chooseLegacy(inventory,sources,{packageId,revision});
 }
 if(Object.hasOwn(inventory,'confirmed_correction'))fail();
 return observedPolicy?chooseTelegramMode(inventory,sources):chooseLegacy(inventory,sources,{packageId,revision});
}
