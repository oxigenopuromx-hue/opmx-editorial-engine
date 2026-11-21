// Candidate only; never update the live automation until the complete release
// is verified. Pin to a commit that actually contains the optional selector.
export function patchMotorReadyUpdateV3(prompt,{releasePin}={}){
 if(typeof prompt!=='string'||prompt.length>65536||!/[a-f0-9]{40}/.test(releasePin??'')||releasePin.length!==40)throw Error('MOTOR_READY_V3_INVALID');
 const oldPin='2285262cb131cc90e528099f8f230dd978d77256',oldModule='motor-policy-v3.mjs';
 if(prompt.split(oldPin).length!==6||prompt.split(oldModule).length!==3||prompt.includes('motor-policy-v3-update.mjs'))throw Error('MOTOR_READY_V3_CHANGED');
 const result=prompt.replaceAll(oldPin,releasePin).replaceAll(oldModule,'motor-policy-v3-update.mjs');if(result.length>65536)throw Error('MOTOR_READY_V3_TOO_LONG');return result;
}
