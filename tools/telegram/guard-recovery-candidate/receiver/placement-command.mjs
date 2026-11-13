export function parsePlacementCommand(text) {
 if(typeof text!=='string'||/[\r\n]/.test(text))throw Error('INVALID_PLACEMENT_COMMAND');
 const match=/^\/opciones[ \t]+portada[ \t]+OPURO[ \t]+(ninguna|conservar|[1-9][0-9]*(?:,[1-9][0-9]*)*)$/i.exec(text.trim());
 if(!match)throw Error('INVALID_PLACEMENT_COMMAND');
 const value=match[1].toLowerCase(),ids=value==='conservar'?null:value==='ninguna'?[]:match[1].split(',');
 if(ids!==null&&(ids.length>100||ids.some(id=>id.length>16||!Number.isSafeInteger(Number(id)))||new Set(ids).size!==ids.length))throw Error('INVALID_PLACEMENT_COMMAND');
 return {target:'OPURO',ids};
}
export function placementCommandText(text) {
 return typeof text==='string'&&/^\s*\/opciones[ \t]+portada(?:\s|$)/i.test(text);
}

// Called only inside the existing normalizer AFTER identity/allowlist checks.
// This is receiver provenance, never content supplied by a MASTER or file.
export function normalizePlacementControl(update) {
 const message=update?.message;
 const text=typeof message?.text==='string'?message.text:typeof message?.caption==='string'?message.caption:'';
 if(!placementCommandText(text))return null;
 const reject=reply_text=>({kind:'REJECTED',has_file:false,placement_attested:false,reply_text});
 if(typeof message?.text!=='string'||message.document||message.photo||['forward_origin','forward_date','forward_from','forward_from_chat','forward_sender_name','reply_to_message','external_reply','quote','edit_date'].some(key=>Object.hasOwn(message,key))||Object.hasOwn(update,'edited_message'))return reject('Escribe /opciones portada OPURO seguido de IDs separados por coma, ninguna o conservar como mensaje nuevo y directo, sin responder, reenviar ni adjuntar archivos.');
 let selected;try{selected=parsePlacementCommand(text)}catch{return reject('Colocación inválida. Usa /opciones portada OPURO seguido de IDs positivos sin repetir, ninguna para vaciar o conservar para mantener la colocación actual.');}
 return {kind:'TEXT',has_file:false,text,mode_attested:true,placement_attested:true,placement_target:selected.target,placement_ids:selected.ids};
}

export function preparePlacementControl(input) {
 if(!placementCommandText(input?.text))return null;
 let selected;try{selected=parsePlacementCommand(input.text)}catch{return null;}
 if(input.kind!=='TEXT'||input.has_file===true||input.placement_attested!==true||input.mode_attested!==true||input.placement_target!=='OPURO'||input.placement_ids!==null&&!Array.isArray(input.placement_ids)||JSON.stringify(input.placement_ids)!==JSON.stringify(selected.ids))return null;
 return {...input,kind:'COMMAND',has_file:false,package_operation:'PLACEMENT',requires_storage:true,storage_action:'current',storage_body:{owner:input.user_id,chat:input.chat_id},placement_target:'OPURO',placement_ids:selected.ids};
}

export function placementCommandSource() {
 return [parsePlacementCommand,placementCommandText,normalizePlacementControl,preparePlacementControl].map(fn=>fn.toString()).join('\n');
}
