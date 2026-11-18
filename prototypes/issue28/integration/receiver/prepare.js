// TELEGRAM_PLACEMENT_CONTROL_V1
function parsePlacementCommand(text) {
 if(typeof text!=='string'||/[\r\n]/.test(text))throw Error('INVALID_PLACEMENT_COMMAND');
 const match=/^\/opciones[ \t]+portada[ \t]+OPURO[ \t]+(ninguna|conservar|[1-9][0-9]*(?:,[1-9][0-9]*)*)$/i.exec(text.trim());
 if(!match)throw Error('INVALID_PLACEMENT_COMMAND');
 const value=match[1].toLowerCase(),ids=value==='conservar'?null:value==='ninguna'?[]:match[1].split(',');
 if(ids!==null&&(ids.length>100||ids.some(id=>id.length>16||!Number.isSafeInteger(Number(id)))||new Set(ids).size!==ids.length))throw Error('INVALID_PLACEMENT_COMMAND');
 return {target:'OPURO',ids};
}
function placementCommandText(text) {
 return typeof text==='string'&&/^\s*\/opciones[ \t]+portada(?:\s|$)/i.test(text);
}
function normalizePlacementControl(update) {
 const message=update?.message;
 const text=typeof message?.text==='string'?message.text:typeof message?.caption==='string'?message.caption:'';
 if(!placementCommandText(text))return null;
 const reject=reply_text=>({kind:'REJECTED',has_file:false,placement_attested:false,reply_text});
 if(typeof message?.text!=='string'||message.document||message.photo||['forward_origin','forward_date','forward_from','forward_from_chat','forward_sender_name','reply_to_message','external_reply','quote','edit_date'].some(key=>Object.hasOwn(message,key))||Object.hasOwn(update,'edited_message'))return reject('Escribe /opciones portada OPURO seguido de IDs separados por coma, ninguna o conservar como mensaje nuevo y directo, sin responder, reenviar ni adjuntar archivos.');
 let selected;try{selected=parsePlacementCommand(text)}catch{return reject('Colocación inválida. Usa /opciones portada OPURO seguido de IDs positivos sin repetir, ninguna para vaciar o conservar para mantener la colocación actual.');}
 return {kind:'TEXT',has_file:false,text,mode_attested:true,placement_attested:true,placement_target:selected.target,placement_ids:selected.ids};
}
function preparePlacementControl(input) {
 if(!placementCommandText(input?.text))return null;
 let selected;try{selected=parsePlacementCommand(input.text)}catch{return null;}
 if(input.kind!=='TEXT'||input.has_file===true||input.placement_attested!==true||input.mode_attested!==true||input.placement_target!=='OPURO'||input.placement_ids!==null&&!Array.isArray(input.placement_ids)||JSON.stringify(input.placement_ids)!==JSON.stringify(selected.ids))return null;
 return {...input,kind:'COMMAND',has_file:false,package_operation:'PLACEMENT',requires_storage:true,storage_action:'current',storage_body:{owner:input.user_id,chat:input.chat_id},placement_target:'OPURO',placement_ids:selected.ids};
}
// CONTENT_MODE_CONTROL_V1
const validPackage=id=>typeof id==='string'&&/^tg_[a-f0-9]{40}$/.test(id);
const validItem=id=>typeof id==='string'&&/^ti_[a-f0-9]{40}$/.test(id);
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const who=x=>({owner:x.user_id,chat:x.chat_id});
const response=(x,reply,extra={})=>({...x,has_file:false,requires_storage:false,requires_operation:false,reply_text:reply,...extra});
const help="Para una nota: envía /nuevo, materiales y /listo. Por defecto se publica en TODOS: OXígeno Puro, OXígeno Político y El Liberal. AMBOS incluye OXígeno Puro y OXígeno Político. Para elegir destino usa /publicar o /borrador seguido de opuro, opol, liberal, ambos, todos o una lista separada por comas. TODOS incluye los tres medios. Antes de /listo, /literal conserva título, subtítulos y cuerpo sin añadir texto; /editorial solicita redacción editorial. También puedes escribir tal cual como mensaje nuevo y separado. /imagen generar solicita una ilustración y no autoriza publicar.";
function preparePackageIntent(input) {
 const x={...input,mode:'PACKAGE_STORAGE',source_stored:false,original_stored:false,has_file:false};
 if(!['TEXT','FILE'].includes(x.kind))return response(x,x.reply_text??help);
 const cmd=x.kind==='TEXT'?x.text.trim():'';
 if(placementCommandText(x.text)){const placement=preparePlacementControl(x);return placement??response(x,'No pude acreditar una orden directa de colocación. Escríbela como mensaje nuevo y separado.');}
 const reopen=/^\/abrir[ \t]+(tg_[a-f0-9]{40})$/.exec(cmd);
 if(reopen)return {...x,kind:'COMMAND',package_operation:'REOPEN',requires_storage:true,storage_action:'reopen',storage_body:{...who(x),packageId:reopen[1],receiptId:x.receipt_id}};
 if(cmd==='/cancelar duplicado'){
  if(x.cancel_attested!==true)return response(x,'No pude acreditar la orden directa de cancelación.');
  return {...x,kind:'COMMAND',package_operation:'CANCEL_DUPLICATE',requires_storage:true,storage_action:'current',storage_body:who(x)};
 }
 if(cmd==='/bloqueados')return {...x,kind:'COMMAND',package_operation:'BLOCKED_LIST',requires_storage:true,storage_action:'blocked',storage_body:who(x)};
 if(cmd==='/start'||cmd==='/ayuda')return response({...x,kind:'COMMAND'},help);
 if(cmd==='/nuevo')return {...x,kind:'COMMAND',package_operation:'OPEN',requires_storage:true,storage_action:'open',storage_body:{...who(x),receiptId:x.receipt_id}};
 const discard=/^\/descartar (ti_[a-f0-9]{40})$/.exec(cmd);
 const options=/^\/opciones[ \t]+(?:(crear|actualizar)[ \t]+)?(literal|editorial)[ \t]+([A-Za-z, ]+)$/i.exec(cmd);
 const confirmation=/^\/confirmar[ \t]+(crear|actualizar)[ \t]+([1-9][0-9]{0,9})[ \t]+([a-f0-9]{64})$/i.exec(cmd);
 const op=cmd==='/listo'?'SEAL':cmd==='/estado'?'STATUS':discard?'DISCARD':options?'SELECT':confirmation?'CONFIRM':'CONTENT';
 return {...x,kind:op==='CONTENT'?x.kind:'COMMAND',discard_item_id:discard?.[1]??null,selection_action:options?(options[1]?.toLowerCase()==='actualizar'?'UPDATE':'CREATE'):null,selection_mode:options?.[2]?.toUpperCase()??null,selection_destination:options?.[3]??null,confirmation_action:confirmation?(confirmation[1].toLowerCase()==='actualizar'?'UPDATE':'CREATE'):null,confirmation_revision:confirmation?Number(confirmation[2]):null,confirmation_hash:confirmation?.[3]?.toLowerCase()??null,package_operation:op,requires_storage:true,storage_action:'current',storage_body:who(x)};
}
return [{json:preparePackageIntent($input.first().json)}];
