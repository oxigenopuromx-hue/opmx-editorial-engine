// Optional candidate; never install until Guard confirms the exact review,
// post identities and all UPDATE writer/readback protections are ready.
export function patchMotorRecoveryUpdateV3(source){
 if(typeof source!=='string')throw Error('MOTOR_UPDATE_V3_INVALID');let s=source;const once=(a,b)=>{if(s.split(a).length!==2)throw Error('MOTOR_UPDATE_V3_CHANGED');s=s.replace(a,()=>b)};
 once("(c.action!=='CREATE'||c.policy!=='publish-todos-v3')","(!['CREATE','UPDATE'].includes(c.action)||c.policy!=='publish-todos-v3')");
 const anchor="if(versionedDestinationLabel(selected,c.policy)!==c.destination)fail()";
 once(anchor,anchor+";if(c.action==='UPDATE'&&selected.some(d=>!previous.includes(d)))fail()");return s;
}
