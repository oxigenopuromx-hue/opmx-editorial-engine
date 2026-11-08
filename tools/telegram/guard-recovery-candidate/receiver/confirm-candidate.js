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
function modeMatch(s){try{const x=parseDestinationCommand(s);return [null,x.mode==='PUBLISH'?'publicar':'borrador',x.destination];}catch{return null;}}
const validPackage=id=>typeof id==='string'&&/^tg_[a-f0-9]{40}$/.test(id);
const validItem=id=>typeof id==='string'&&/^ti_[a-f0-9]{40}$/.test(id);
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const who=x=>({owner:x.user_id,chat:x.chat_id});
const response=(x,reply,extra={})=>({...x,has_file:false,requires_storage:false,requires_operation:false,reply_text:reply,...extra});
const help="Para una nota: envía /nuevo, materiales y /listo. Por defecto se publica en TODOS: OXígeno Puro, OXígeno Político y El Liberal. AMBOS incluye OXígeno Puro y OXígeno Político. Para elegir destino usa /publicar o /borrador seguido de opuro, opol, liberal, ambos, todos o una lista separada por comas. TODOS incluye los tres medios. /imagen generar solicita una ilustración y no autoriza publicar.";
function confirmPackageOperation(context,result) {
 if(context.package_operation==='SELECT'){
  let label;try{label=destinationLabel(resolveDestinations(context.selection_destination))}catch{return response(context,'No pude confirmar las opciones.')}
  const validMode=['LITERAL','EDITORIAL'].includes(context.selection_mode);
  if(validMode&&['SELECTED','SELECTION_REPLAY'].includes(result?.status)&&Number.isSafeInteger(context.package_revision)&&result.revision===context.package_revision+1&&
     (result.status==='SELECTION_REPLAY'||(result.packageId===context.packageId&&result.action===(context.selection_action??'CREATE')&&result.mode===context.selection_mode&&result.destination===label)))
   return response(context,'Opciones registradas: '+((context.selection_action??'CREATE')==='UPDATE'?'actualizar notas existentes':'crear nota')+', '+context.selection_mode+' para '+label+'. Agrega material o solicita la vista con /listo.');
  return response(context,'No pude confirmar las opciones. Revisa /estado antes de volver a intentarlo.');
 }
 if(context.package_operation==='CONFIRM'){
  if(['CONFIRMED','CONFIRMED_REPLAY'].includes(result?.status)&&/^evt_[a-f0-9]{48}$/.test(result.eventId??''))
   return response(context,'Revisión confirmada y puesta en cola para procesamiento. Todavía no se ha confirmado ninguna publicación.');
  if(result?.status==='ALREADY_CONFIRMED')return response(context,'Esa revisión ya fue confirmada; consulta su estado antes de intentar nuevamente.');
  if(result?.status==='PREVIEW_DELIVERY_UNCONFIRMED')return response(context,'No está confirmada la entrega completa de la vista. No se envió la revisión al Motor.');
  return response(context,'No pude confirmar esa revisión. No se confirmó el envío al Motor; consulta el estado antes de reintentar.');
 }
 if(context.package_operation==='DISCARD'&&context.recovery_session){
  if(['DISCARDED','DISCARDED_REPLAY'].includes(result?.status)&&result.itemId===context.discard_item_id)
   return response(context,'Material retirado de esta revisión. El original y el historial se conservan. Solicita una nueva vista con /listo.');
  return response(context,'No pude confirmar el retiro del material. No se modificaron las opciones.');
 }

 if(context.package_operation==='SEAL') {
  if(result?.status==='READY'&&result.packageId===context.packageId&&Number.isSafeInteger(result.revision))return response(context,`Paquete cerrado: <code>${context.packageId}</code>, versión ${result.revision}. Material guardado y listo para validación automática en el Motor. Recibirás en este chat los avances y el resultado. No se ha generado ni publicado una nota.`,{package_state:'READY',package_revision:result.revision});
  if(result?.status==='NOT_READY')return response(context,`Aún no puedo cerrar: ${Number(result.pending)||0} archivo(s) pendiente(s), ${Number(result.stored)||0} elemento(s) guardado(s). Espera sus confirmaciones y vuelve a usar /listo.`);
  return response(context,`No pude confirmar el cierre. Conserva el identificador <code>${escape(context.packageId)}</code> para revisar el resultado antes de reenviar este material.`);
 }
 if(context.package_operation==='STATUS') {
  if(result?.status!=='FOUND'||result.packageId!==context.packageId||!Array.isArray(result.items))return response(context,'No pude confirmar el estado del paquete.');
  const stored=result.items.filter(i=>i.state==='STORED').length,pending=result.items.filter(i=>i.state==='PENDING').length;
  return response(context,`Paquete <code>${context.packageId}</code>: ${escape(result.state)}. ${stored} elemento(s) guardado(s), ${pending} pendiente(s). Para terminar: /listo.`);
 }
 if(context.package_operation==='DISCARD')return response(context,result?.status==='DISCARDED'?'Reserva pendiente descartada. No se borraron originales guardados.':'No se descartó la reserva: sólo pueden descartarse archivos pendientes, sin original guardado.');
 if(result?.status==='RESERVED'&&context.kind==='FILE'&&result.packageId===context.packageId&&validItem(result.itemId))return {...context,itemId:result.itemId,has_file:true};
 if(result?.status==='RESERVATION_REPLAY'&&validItem(result.itemId)) {
  if(result.state==='PENDING'&&context.kind==='FILE')return {...context,itemId:result.itemId,has_file:true};
  if(result.state==='STORED')return response(context,'Este mensaje ya estaba guardado en el paquete.',{itemId:result.itemId,source_stored:true,original_stored:context.kind==='FILE'});
 }
 if(result?.status==='STORED'&&context.kind==='TEXT'&&result.packageId===context.packageId&&validItem(result.itemId)) {const mode=context.mode_attested===true?modeMatch(context.text.trim()):null;const image=/^(?:\/imagen\s+generar$|(?:genera|generar|crea|crear)\s+(?:una\s+)?(?:imagen|ilustraci[oó]n)[^\n]{0,180}(?:\n|$))/i.test(context.text.trim());const reply=image?'Instrucción registrada: generar una ilustración para la nota. Sigue enviando material o termina con /listo.':mode?'Instrucción '+mode[1].toUpperCase()+' registrada para '+(mode[2]??'ambos').toUpperCase()+'. Sigue enviando material o termina con /listo.':'Texto guardado en tu paquete. Sigue enviando material; termina con /listo.';return response(context,reply,{itemId:result.itemId,source_stored:true});}
 if(result?.status==='QUOTA_EXCEEDED')return response(context,'El paquete o el almacenamiento piloto alcanzó su límite. No se guardó este mensaje.');
 if(result?.status==='PACKAGE_CLOSED')return response(context,'El paquete ya se cerró. No añadí este mensaje; envía /nuevo para otra nota.');
 return response(context,'No pude confirmar la reserva de este mensaje. No lo descargué ni lo envié al Motor.');
}
return [{json:confirmPackageOperation($('Resolver paquete Telegram').first(0,0).json,$input.first().json)}];
