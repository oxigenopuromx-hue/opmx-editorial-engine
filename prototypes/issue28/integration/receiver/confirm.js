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
// ISSUE18_CLOSE_QUOTA_V1
function formatQuotaDiagnosticText(diagnostic){
 const codes={GLOBAL_PACKAGES_LIMIT:'GLOBAL_PACKAGES',PACKAGE_ITEMS_LIMIT:'PACKAGE_ITEMS',RECOVERY_ITEMS_LIMIT:'PACKAGE_ITEMS',PACKAGE_BYTES_LIMIT:'PACKAGE_BYTES',GLOBAL_BYTES_LIMIT:'GLOBAL_BYTES'};
 if(!diagnostic||typeof diagnostic!=='object'||Array.isArray(diagnostic)||Object.keys(diagnostic).sort().join(',')!=='code,limitsExceeded,operation,schema'||diagnostic.schema!=='opmx.package-quota-diagnostic.v1'||!['OPEN','RESERVE'].includes(diagnostic.operation)||!Object.hasOwn(codes,diagnostic.code)||!Array.isArray(diagnostic.limitsExceeded)||diagnostic.limitsExceeded.length<1||diagnostic.limitsExceeded.length>3||diagnostic.limitsExceeded[0]?.code!==diagnostic.code)return null;
 const seen=new Set(),lines=[];
 for(const entry of diagnostic.limitsExceeded){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).sort().join(',')!=='code,limit,requested,scope,used'||!Object.hasOwn(codes,entry.code)||seen.has(entry.scope)||entry.scope!==codes[entry.code]||![entry.used,entry.limit,entry.requested].every(n=>Number.isSafeInteger(n)&&n>=0)||entry.limit===0||!Number.isSafeInteger(entry.used+entry.requested))return null;
  seen.add(entry.scope);
  if(diagnostic.operation==='OPEN'?(entry.code!=='GLOBAL_PACKAGES_LIMIT'||entry.requested!==1):(entry.code==='GLOBAL_PACKAGES_LIMIT'))return null;
  if(entry.scope==='PACKAGE_ITEMS'||entry.scope==='GLOBAL_PACKAGES'){
   if(entry.used<entry.limit||entry.requested!==1)return null;
  }else if(entry.used+entry.requested<=entry.limit)return null;
  if(entry.code==='GLOBAL_PACKAGES_LIMIT')lines.push(`Se alcanzó el límite global de paquetes guardados (${entry.used}/${entry.limit}). Consulta al administrador.`);
  else if(entry.code==='PACKAGE_ITEMS_LIMIT')lines.push(`Este paquete alcanzó el límite de elementos (${entry.used}/${entry.limit}). Revisa /estado.`);
  else if(entry.code==='RECOVERY_ITEMS_LIMIT')lines.push(`El paquete reabierto alcanzó el límite de elementos (${entry.used}/${entry.limit}). Revisa /estado.`);
  else if(entry.code==='PACKAGE_BYTES_LIMIT')lines.push(`El mensaje supera el cupo de este paquete: ${entry.used} de ${entry.limit} bytes usados; necesita ${entry.requested} bytes.`);
  else if(entry.code==='GLOBAL_BYTES_LIMIT')lines.push(`El mensaje supera el almacenamiento global: ${entry.used} de ${entry.limit} bytes usados; necesita ${entry.requested} bytes. Consulta al administrador.`);
 }
 return (diagnostic.operation==='OPEN'?'No se abrió otro paquete.\n':'No se guardó este mensaje.\n')+lines.join('\n');
}
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
 if(context.package_operation==='CANCEL_DUPLICATE'){
  if(context.cancel_attested===true&&['CANCELLED','CANCELLED_REPLAY'].includes(result?.status)&&result.packageId===context.packageId&&result.revision===context.package_revision&&result.reason==='DUPLICATE'&&result.writeAuthorized===false&&result.retryPermitted===false)
   return response(context,'Paquete cerrado por duplicidad editorial, sin enviarlo a publicar. El material y el historial se conservan. Puedes iniciar otra nota con /nuevo.',{package_state:'CANCELLED'});
  return response(context,'No pude confirmar el cierre por duplicidad. Conserva el paquete y consulta /estado antes de intentar de nuevo.');
 }
 if(context.package_operation==='PLACEMENT'){
  let selected;try{selected=parsePlacementCommand(context.text)}catch{return response(context,'No pude confirmar la colocación.');}
  const replay=result?.status==='PLACEMENT_REPLAY',revisionOk=Number.isSafeInteger(result?.revision)&&result.revision>=1&&(replay?result.revision<=context.package_revision:result.revision===context.package_revision+1);
  const valid=context.placement_attested===true&&context.placement_target==='OPURO'&&Number.isSafeInteger(context.package_revision)&&context.package_revision>=1&&JSON.stringify(context.placement_ids)===JSON.stringify(selected.ids)&&['PLACEMENT_SELECTED','PLACEMENT_REPLAY'].includes(result?.status)&&result.packageId===context.packageId&&revisionOk&&result.target==='OPURO'&&JSON.stringify(result.ids)===JSON.stringify(selected.ids);
  if(!valid)return response(context,'No pude confirmar la colocación. Consulta /estado antes de volver a intentarlo.');
  const detail=selected.ids===null?'conservar la colocación actual, sin modificar sus exclusiones':selected.ids.length?'excluir de las posiciones principales de las categorías '+selected.ids.join(', '):'ninguna categoría excluida';
  return response(context,(replay?'Esta colocación ya estaba registrada para OPURO: ':'Colocación registrada para OPURO: ')+detail+'. La nota conserva su listado y URL; esta orden no publica. Continúa con tus materiales o /listo.',{package_revision:replay?context.package_revision:result.revision});
 }
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
   return response(context,'Revisión confirmada y puesta en cola para procesamiento. Todavía no se ha confirmado ninguna publicación.',{package_state:'READY',package_revision:context.package_revision+1});
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
  if(result?.status==='QUOTA_EXCEEDED')return response(context,formatQuotaDiagnosticText(result.quotaDiagnostic)??'El paquete o el almacenamiento piloto alcanzó su límite. No se guardó este mensaje.');
  if(result?.status==='PREVIEW_DELIVERY_UNCERTAIN')return response(context,'La solicitud de vista ya está guardada, pero su entrega es incierta. No se repitió el envío. Consulta /estado antes de continuar.');
  if(result?.status==='READY'&&result.packageId===context.packageId&&Number.isSafeInteger(result.revision))return response(context,`Paquete cerrado: <code>${context.packageId}</code>, versión ${result.revision}. Material guardado y listo para validación automática en el Motor. Recibirás en este chat los avances y el resultado. No se ha generado ni publicado una nota.`,{package_state:'READY',package_revision:result.revision});
  if(result?.status==='NOT_READY')return response(context,`Aún no puedo cerrar: ${Number(result.pending)||0} archivo(s) pendiente(s). Usa /estado para identificarlos y vuelve a enviar /listo cuando estén resueltos.`);
  return response(context,`No pude confirmar el cierre. Conserva el identificador <code>${escape(context.packageId)}</code> para revisar el resultado antes de reenviar este material.`);
 }
 if(context.package_operation==='STATUS') {
  if(result?.status!=='FOUND'||result.packageId!==context.packageId||!Array.isArray(result.items))return response(context,'No pude confirmar el estado del paquete.');
  const stored=result.items.filter(i=>i.state==='STORED').length,pending=result.items.filter(i=>i.state==='PENDING');
  if(pending.some(i=>!validItem(i.item_id)))return response(context,'No pude confirmar el inventario pendiente del paquete.');
  const pendingHelp=pending.length?'\nReservas pendientes:\n'+pending.slice(0,5).map(i=>`<code>/descartar ${i.item_id}</code>`).join('\n')+'\nDescarta sólo el archivo que no se guardó.':'';
  const d=result.diagnostic;
  if(d?.schema==='opmx.package-diagnostic.v1'){
   const lines=[`Paquete <code>${context.packageId}</code> · revisión ${Number(result.revision)} · ${escape(result.state)}`];
   lines.push(d.origin==='OTHER_ACCOUNT'?'Origen: otra cuenta. Estás gestionándolo desde la sesión administrativa.':'Origen: tu cuenta.');
   if(d.topic)lines.push('Tema del material: '+escape(d.topic));
   lines.push(`Material disponible: ${Number(d.substantiveTexts)||0} texto(s) de contenido, ${Number(d.files)||0} archivo(s); ${pending.length} pendiente(s).`);
   if(d.urls?.length)lines.push('Enlaces guardados:\n'+d.urls.slice(0,3).map(x=>escape(String(x).slice(0,300))).join('\n'));
   if(!d.substantiveTexts&&d.urls?.length)lines.push('Falta texto de respaldo: sólo hay enlaces como fuente textual. Si la página no puede leerse, pega su contenido aquí; conserva la atribución.');
   if(d.previousResults?.length)lines.push('Resultado anterior conciliado:\n'+d.previousResults.map(x=>escape(x.destination)+': '+(x.status==='BLOCKED'?'sin nota creada':escape(x.status)+(x.postId?' · ID '+Number(x.postId):''))).join('\n'));
   if(d.action)lines.push('Acción prevista: '+(d.action==='CREATE'?'crear nota nueva':'actualizar notas existentes')+' · '+escape(d.contentMode)+' · '+escape(d.destination)+(d.originalMode?' · '+(d.originalMode==='DRAFT'?'borrador':'publicación')+' conservada':''));
   if(pending.length)lines.push(pendingHelp);
   else if(d.confirmationCommand)lines.push('Vista completamente entregada. Para autorizar esta revisión:\n<code>'+escape(d.confirmationCommand)+'</code>');
   else if(d.next==='CHECK_UNCERTAIN_DELIVERY')lines.push('La entrega de la vista está incierta. No repitas /listo ni confirmes otra revisión hasta conciliar el envío.');
   else if(d.next==='RECONCILE_OPTIONS')lines.push('Las opciones requieren conciliación. No se enviará a publicar ni se inferirá una acción.');
   else if(d.recovery)lines.push('Puedes agregar aquí texto, fotos o instrucciones. Después envía /listo para recibir la revisión y su comando de confirmación. /listo no publica por sí solo este paquete reabierto.');
   else lines.push('Para cerrar y procesar según la orden registrada: /listo.');
   return response(context,lines.join('\n\n'));
  }
  return response(context,`Paquete <code>${context.packageId}</code>: ${escape(result.state)}. ${stored} elemento(s) guardado(s), ${pending.length} pendiente(s).${pendingHelp}\n${context.recovery_session?'Agrega material y envía /listo para solicitar una vista; después debes confirmarla.':'Para terminar: /listo.'}`);
 }
 if(context.package_operation==='DISCARD')return response(context,['DISCARDED','DISCARDED_REPLAY'].includes(result?.status)&&result.itemId===context.discard_item_id?'Reserva pendiente descartada. No se borraron originales guardados.':'No se descartó la reserva: sólo pueden descartarse archivos pendientes, sin original guardado.');
 if(result?.status==='RESERVED'&&context.kind==='FILE'&&result.packageId===context.packageId&&validItem(result.itemId))return {...context,itemId:result.itemId,has_file:true};
 if(result?.status==='RESERVATION_REPLAY'&&validItem(result.itemId)) {
  if(result.state==='PENDING'&&context.kind==='FILE')return {...context,itemId:result.itemId,has_file:true};
  if(result.state==='STORED')return response(context,'Este mensaje ya estaba guardado en el paquete.',{itemId:result.itemId,source_stored:true,original_stored:context.kind==='FILE'});
 }
 if(result?.status==='STORED'&&context.kind==='TEXT'&&result.packageId===context.packageId&&validItem(result.itemId)) {const mode=context.mode_attested===true?modeMatch(context.text.trim()):null;const image=/^(?:\/imagen\s+generar$|(?:genera|generar|crea|crear)\s+(?:una\s+)?(?:imagen|ilustraci[oó]n)[^\n]{0,180}(?:\n|$))/i.test(context.text.trim());const reply=image?'Instrucción registrada: generar una ilustración para la nota. Sigue enviando material o termina con /listo.':mode?'Instrucción '+mode[1].toUpperCase()+' registrada para '+(mode[2]??'ambos').toUpperCase()+'. Sigue enviando material o termina con /listo.':'Texto guardado en tu paquete. Sigue enviando material; termina con /listo.';return response(context,reply,{itemId:result.itemId,source_stored:true});}
 if(result?.status==='QUOTA_EXCEEDED')return response(context,formatQuotaDiagnosticText(result.quotaDiagnostic)??'El paquete o el almacenamiento piloto alcanzó su límite. No se guardó este mensaje.');
 if(result?.status==='PACKAGE_CLOSED')return response(context,'El paquete ya se cerró. No añadí este mensaje; envía /nuevo para otra nota.');
 return response(context,'No pude confirmar la reserva de este mensaje. No lo descargué ni lo envié al Motor.');
}
return [{json:confirmPackageOperation($('Resolver paquete Telegram').first(0,0).json,$input.first().json)}];
