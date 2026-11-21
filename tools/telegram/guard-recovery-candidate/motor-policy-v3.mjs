import {chooseMotorPolicy as chooseLegacy} from './motor-policy.mjs';
import {chooseTelegramMode,decodeControl} from './versioned-telegram-policy.mjs';

// Candidate only. The existing manifest and control bytes are authenticated by
// the receiver; this selector never treats source text as an order. Recovery
// of v3 CREATE/UPDATE is intentionally fail-closed until its complete guard,
// decision and writer paths are integrated and verified.
export function chooseMotorPolicy(inventory,sources,{packageId,revision}={}){
 const fail=()=>{throw Error('MOTOR_POLICY_V3_UNCONFIRMED')};
 if(!inventory||inventory.status!=='PACKAGE_FOUND'||inventory.package_id!==packageId||inventory.revision!==revision||inventory.state!=='READY'||!Array.isArray(inventory.items)||!Array.isArray(sources))fail();
 if(Object.hasOwn(inventory,'recovered_policy')){
  if(inventory.recovered_policy?.policy==='publish-todos-v3'||inventory.confirmed_correction?.policy==='publish-todos-v3')fail();
  for(const source of sources){if(source?.stream!=='text'||!Buffer.isBuffer(source.bytes))continue;let control;try{control=decodeControl(new TextDecoder('utf-8',{fatal:true}).decode(source.bytes).trim(),packageId)}catch{fail()}if(control?.policy==='publish-todos-v3')fail()}
  return chooseLegacy(inventory,sources,{packageId,revision});
 }
 if(Object.hasOwn(inventory,'confirmed_correction'))fail();
 return chooseTelegramMode(inventory,sources);
}
