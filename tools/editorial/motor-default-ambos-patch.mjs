// Correct the current default description without changing a package's
// authenticated, version-specific destination or publication permission.
export function patchMotorDefaultAmbos(prompt){
 if(typeof prompt!=='string')throw Error('MOTOR_DEFAULT_INVALID');
 const old='TODOS agrega HORIZONTE y es predeterminado.',next='TODOS agrega HORIZONTE; el predeterminado actual es AMBOS.';
 if(prompt.split(old).length!==2)throw Error('MOTOR_DEFAULT_PROMPT_CHANGED');
 const result=prompt.replace(old,next);if(result.length>65536)throw Error('MOTOR_DEFAULT_PROMPT_TOO_LONG');return result;
}
