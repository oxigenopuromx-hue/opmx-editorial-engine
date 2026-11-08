function destinationRegistry() {
 return {
  OPURO:{cms:'https://cms.oxigenopuro.com.mx',publicOrigin:'https://oxigenopuro.com.mx',resultKey:'oxigenopuro',postIdKey:'post_id_opuro',heroMeta:'oxpuro_hero_media_id',editorialMeta:'oxpuro_editorial',hero:true},
  OPOL:{cms:'https://cms.oxigenopolitico.com.mx',publicOrigin:'https://oxigenopolitico.com.mx',resultKey:'oxigenopolitico',postIdKey:'post_id_opol',hero:false},
  LIBERAL:{cms:'https://cms.elliberal.mx',publicOrigin:'https://elliberal.mx',resultKey:'elliberal',postIdKey:'post_id_liberal',heroMeta:'liberalmx_hero_media_id',editorialMeta:'liberalmx_editorial',hero:true},
 };
}
function resolveDestinations(value) {
 if(Array.isArray(value)){if(!value.every(v=>typeof v==='string'))throw Error('Destino inválido');value=value.join(',');}
 if(typeof value!=='string'||!value.trim()||value.length>256)throw Error('Destino inválido');
 const registry=destinationRegistry(),selected=new Set();
 for(const item of value.split(',')){
  const token=item.trim().toUpperCase();if(!token)throw Error('Destino vacío entre comas');
  const expanded=token==='AMBOS'?['OPURO','OPOL']:token==='TODOS'?Object.keys(registry):[token];
  for(const destination of expanded){if(!Object.hasOwn(registry,destination))throw Error('Destino desconocido: '+destination);selected.add(destination);}
 }
 return Object.keys(registry).filter(d=>selected.has(d));
}
function destinationLabel(destinations) {
 const all=Object.keys(destinationRegistry()),set=new Set(destinations),items=all.filter(d=>set.has(d));
 if(items.length!==set.size||!items.length)throw Error('Destino inválido');
 if(items.length===all.length)return 'TODOS';
 if(items.length===2&&items[0]==='OPURO'&&items[1]==='OPOL')return 'AMBOS';
 return items.join(',');
}
function parseDestinationCommand(text) {
  if (typeof text !== 'string') throw Error('INVALID_COMMAND');
  const match = /^\/(publicar|borrador)(?:[ \t]+([A-Za-z0-9_, ]+))?$/i.exec(text.trim());
  if (!match) throw Error('INVALID_COMMAND');
  const destinations = resolveDestinations(match[2] ?? 'TODOS');
  return { mode: match[1].toLowerCase() === 'publicar' ? 'PUBLISH' : 'DRAFT',
    destination: destinationLabel(destinations), destinations };
}
function isMode(s) { try { parseDestinationCommand(s); return true; } catch { return false; } }
function validControl(s) { return s==='/nuevo'||s==='/listo'||isMode(s); }
const ORDER_PREFIX="OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n";
const POLICY="publish-todos-v2";
function attestedControl(command, packageId, messageId, noticeMessageId) {
  if (!/^tg_[a-f0-9]{40}$/.test(packageId) || !Number.isSafeInteger(messageId) || messageId < 1) throw Error('CONTROL_INVALID');
  if (!validControl(command)) throw Error('CONTROL_INVALID');
  const data = { policy: POLICY, package_id: packageId, message_id: messageId };
  if (command === '/nuevo') {
    if (!Number.isSafeInteger(noticeMessageId) || noticeMessageId <= messageId) throw Error('NOTICE_NOT_CONFIRMED');
    data.notice_message_id = noticeMessageId;
  }
  return ORDER_PREFIX + command + '\n' + JSON.stringify(data);
}
function openingNotice(result, messageId) {
  const newPolicy = ['OPEN','OPEN_REPLAY'].includes(result.status) && result.state !== 'READY';
  return {
    newPolicy,
    reply: result.state==='READY'
      ? 'Este comando corresponde a un paquete cerrado; no se ha cambiado su modo. Envía /nuevo para otra nota.'
      : newPolicy
        ? `Paquete abierto: <code>${result.packageId}</code>. Por defecto se PUBLICARÁ EN TODOS: OXígeno Puro, OXígeno Político y El Liberal, al enviar /listo, si supera las validaciones. Para dejar borradores escribe /borrador antes de /listo. Envía ahora texto, fotos y documentos.`
        : `Paquete ya abierto: <code>${result.packageId}</code>. Conserva su modo anterior. Para publicar usa /publicar ambos; para borradores /borrador. Termina con /listo.`,
  };
}
const validPackage=id=>typeof id==='string'&&/^tg_[a-f0-9]{40}$/.test(id);
const validItem=id=>typeof id==='string'&&/^ti_[a-f0-9]{40}$/.test(id);
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const who=x=>({owner:x.user_id,chat:x.chat_id});
const response=(x,reply,extra={})=>({...x,has_file:false,requires_storage:false,requires_operation:false,reply_text:reply,...extra});
const help="Para una nota: envía /nuevo, materiales y /listo. Por defecto se publica en TODOS: OXígeno Puro, OXígeno Político y El Liberal. AMBOS incluye OXígeno Puro y OXígeno Político. Para elegir destino usa /publicar o /borrador seguido de opuro, opol, liberal, ambos, todos o una lista separada por comas. TODOS incluye los tres medios. /imagen generar solicita una ilustración y no autoriza publicar.";
function resolvePackageSession(intent,result) {
 if(intent.package_operation==='REOPEN') {
  if(['OPEN','OPEN_REPLAY'].includes(result?.status)&&result.packageId===intent.storage_body.packageId&&Number.isSafeInteger(result.revision))return response(intent,`Paquete reabierto: <code>${result.packageId}</code>. Agrega información o instrucciones y envía /listo para solicitar otra revisión.`,{packageId:result.packageId,package_state:'OPEN',package_revision:result.revision});
  if(result?.status==='SESSION_BUSY')return response(intent,'Ya tienes otro paquete abierto. Termínalo antes de abrir este.');
  if(result?.status==='PENDING_RESERVATION')return response(intent,'El paquete tiene archivos pendientes y requiere revisión antes de reabrirse.');
  if(result?.status==='RECONCILIATION_REQUIRED')return response(intent,'Este paquete requiere conciliación antes de reabrirse. No se ha reintentado la publicación.');
  return response(intent,'No pude abrir ese paquete. Verifica el identificador y sus permisos; no se reintentó la publicación.');
 }
 if(intent.package_operation==='OPEN') {
  if(!['OPEN','ALREADY_OPEN','OPEN_REPLAY'].includes(result?.status)||!validPackage(result.packageId))return response(intent,'No pude confirmar la apertura del paquete. Conserva tus archivos; todavía no los envíes.');
  const closed=result.state==='READY';
  const notice=openingNotice(result,intent.message_id);
  return response(intent,notice.reply,{packageId:result.packageId,package_state:closed?'READY':'OPEN',default_policy_candidate:notice.newPolicy});
 }
 if(result?.status==='NO_OPEN_PACKAGE')return response(intent,'No hay una nota abierta. Envía /nuevo y después sus textos, fotos y documentos.');
 if(result?.status!=='OPEN'||!validPackage(result.packageId))return response(intent,'No pude consultar tu paquete. No confirmé almacenamiento de este mensaje.');
 const x={...intent,packageId:result.packageId,requires_operation:true,recovery_session:result.recovery===true};
 let action,body={...who(x),packageId:x.packageId};
 if(x.package_operation==='SELECT'){
  if(!x.recovery_session||!Number.isSafeInteger(result.revision)||x.mode_attested!==true)return response(intent,'Las opciones sólo pueden elegirse directamente en un paquete reabierto.');
  action='corrections/select';Object.assign(body,{revision:result.revision,receiptId:x.receipt_id,mode:x.selection_mode,destination:x.selection_destination});
 }
 else if(x.package_operation==='CONFIRM'){
  if(!x.recovery_session||x.mode_attested!==true||result.revision!==x.confirmation_revision)return response(intent,'La vista previa ya no corresponde a la revisión actual; vuelve a pedirla con /listo.');
  action='corrections/confirm';Object.assign(body,{revision:result.revision,receiptId:x.receipt_id,previewHash:x.confirmation_hash,action:'CREATE'});
 }
 else if(x.package_operation==='SEAL'){action='reserve';Object.assign(body,{receiptId:x.receipt_id,kind:'TEXT',text:attestedControl('/listo',x.packageId,x.message_id),attachment:null});}
 else if(x.package_operation==='STATUS')action='manifest';
 else if(x.package_operation==='DISCARD'){action='discard';body.itemId=x.discard_item_id;}
 else {action='reserve';Object.assign(body,{receiptId:x.receipt_id,kind:x.kind,text:x.mode_attested===true?(isMode(x.text.trim())?attestedControl(x.text.trim(),x.packageId,x.message_id):ORDER_PREFIX+x.text.trim()):x.text??'',attachment:x.kind==='FILE'?{file_name:x.attachment.file_name,mime_type:x.attachment.mime_type,declared_bytes:x.attachment.declared_bytes}:null});}
 return {...x,next_action:action,next_body:body,seal_after_close:x.package_operation==='SEAL'};
}
return [{json:resolvePackageSession($('Preparar paquete Telegram').first(0,0).json,$input.first().json)}];
