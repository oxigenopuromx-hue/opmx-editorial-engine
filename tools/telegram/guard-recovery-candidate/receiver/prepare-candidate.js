const validPackage=id=>typeof id==='string'&&/^tg_[a-f0-9]{40}$/.test(id);
const validItem=id=>typeof id==='string'&&/^ti_[a-f0-9]{40}$/.test(id);
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const who=x=>({owner:x.user_id,chat:x.chat_id});
const response=(x,reply,extra={})=>({...x,has_file:false,requires_storage:false,requires_operation:false,reply_text:reply,...extra});
const help="Para una nota: envía /nuevo, materiales y /listo. Por defecto se publica en TODOS: OXígeno Puro, OXígeno Político y El Liberal. AMBOS incluye OXígeno Puro y OXígeno Político. Para elegir destino usa /publicar o /borrador seguido de opuro, opol, liberal, ambos, todos o una lista separada por comas. TODOS incluye los tres medios. /imagen generar solicita una ilustración y no autoriza publicar.";
function preparePackageIntent(input) {
 const x={...input,mode:'PACKAGE_STORAGE',source_stored:false,original_stored:false,has_file:false};
 if(!['TEXT','FILE'].includes(x.kind))return response(x,x.reply_text??help);
 const cmd=x.kind==='TEXT'?x.text.trim():'';
 const reopen=/^\/abrir[ \t]+(tg_[a-f0-9]{40})$/.exec(cmd);
 if(reopen)return {...x,kind:'COMMAND',package_operation:'REOPEN',requires_storage:true,storage_action:'reopen',storage_body:{...who(x),packageId:reopen[1],receiptId:x.receipt_id}};
 if(cmd==='/start'||cmd==='/ayuda')return response({...x,kind:'COMMAND'},help);
 if(cmd==='/nuevo')return {...x,kind:'COMMAND',package_operation:'OPEN',requires_storage:true,storage_action:'open',storage_body:{...who(x),receiptId:x.receipt_id}};
 const discard=/^\/descartar (ti_[a-f0-9]{40})$/.exec(cmd);
 const op=cmd==='/listo'?'SEAL':cmd==='/estado'?'STATUS':discard?'DISCARD':'CONTENT';
 return {...x,kind:op==='CONTENT'?x.kind:'COMMAND',discard_item_id:discard?.[1]??null,package_operation:op,requires_storage:true,storage_action:'current',storage_body:who(x)};
}
return [{json:preparePackageIntent($input.first().json)}];