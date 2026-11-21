import {chooseMotorPolicy as chooseLegacy} from './motor-policy.mjs';
import {chooseTelegramMode,decodeControl} from './versioned-telegram-policy.mjs';

// Candidate only. The existing manifest and control bytes are authenticated by
// the receiver; this selector never treats source text as an order. Recovery
// of v3 CREATE/UPDATE remains blocked until the complete guard, decision and
// writer paths are integrated. Historic decisions retain the pinned selector.
export function chooseMotorPolicy(inventory,sources,{packageId,revision}={}){
 const fail=()=>{throw Error('RECOVERED_POLICY_UNCONFIRMED')};
 if(!inventory||inventory.status!=='PACKAGE_FOUND'||inventory.package_id!==packageId||inventory.revision!==revision||inventory.state!=='READY'||!Array.isArray(inventory.items)||!Array.isArray(sources))fail();
 let hasV3=false;
 for(const source of sources){if(source?.stream!=='text'||!Buffer.isBuffer(source.bytes))continue;try{const control=decodeControl(new TextDecoder('utf-8',{fatal:true}).decode(source.bytes).trim(),packageId);if(control?.policy==='publish-todos-v3')hasV3=true}catch{/* The selected implementation rejects malformed controls. */}}
 if(Object.hasOwn(inventory,'recovered_policy')){
  if(hasV3||inventory.recovered_policy?.policy==='publish-todos-v3'||inventory.confirmed_correction?.policy==='publish-todos-v3')fail();
  return chooseLegacy(inventory,sources,{packageId,revision});
 }
 if(Object.hasOwn(inventory,'confirmed_correction'))fail();
 return hasV3?chooseTelegramMode(inventory,sources):chooseLegacy(inventory,sources,{packageId,revision});
}
