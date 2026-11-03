const validPackage=id=>typeof id==='string'&&/^tg_[a-f0-9]{40}$/.test(id);
const validItem=id=>typeof id==='string'&&/^ti_[a-f0-9]{40}$/.test(id);
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const help='Para una nota: envía /nuevo, después texto, fotos y documentos. Escribe /publicar ambos para solicitar publicación o /borrador ambos para revisión; también puedes elegir opuro u opol. Termina con /listo. Sin elección, se preparan borradores. El resultado se enviará a este chat cuando esté confirmado.';
const who=x=>({owner:x.user_id,chat:x.chat_id});
const response=(x,reply,extra={})=>({...x,has_file:false,requires_storage:false,requires_operation:false,reply_text:reply,...extra});

export function preparePackageIntent(input) {
 const x={...input,mode:'PACKAGE_STORAGE',source_stored:false,original_stored:false,has_file:false};
 if(!['TEXT','FILE'].includes(x.kind))return response(x,x.reply_text??help);
 const cmd=x.kind==='TEXT'?x.text.trim():'';
 if(cmd==='/start'||cmd==='/ayuda')return response({...x,kind:'COMMAND'},help);
 if(cmd==='/nuevo')return {...x,kind:'COMMAND',package_operation:'OPEN',requires_storage:true,storage_action:'open',storage_body:{...who(x),receiptId:x.receipt_id}};
 const discard=/^\/descartar (ti_[a-f0-9]{40})$/.exec(cmd);
 const op=cmd==='/listo'?'SEAL':cmd==='/estado'?'STATUS':discard?'DISCARD':'CONTENT';
 return {...x,kind:op==='CONTENT'?x.kind:'COMMAND',discard_item_id:discard?.[1]??null,package_operation:op,requires_storage:true,storage_action:'current',storage_body:who(x)};
}

export function resolvePackageSession(intent,result) {
 if(intent.package_operation==='OPEN') {
  if(!['OPEN','ALREADY_OPEN','OPEN_REPLAY'].includes(result?.status)||!validPackage(result.packageId))return response(intent,'No pude confirmar la apertura del paquete. Conserva tus archivos; todavía no los envíes.');
  const closed=result.state==='READY';
  return response(intent,closed?'Este comando ya corresponde a un paquete cerrado. Envía /nuevo para otra nota.':`Paquete ${result.status==='ALREADY_OPEN'?'ya abierto':'abierto'}: <code>${result.packageId}</code>. Envía texto, fotos y documentos; al terminar usa /listo.`,{packageId:result.packageId,package_state:closed?'READY':'OPEN'});
 }
 if(result?.status==='NO_OPEN_PACKAGE')return response(intent,'No hay una nota abierta. Envía /nuevo y después sus textos, fotos y documentos.');
 if(result?.status!=='OPEN'||!validPackage(result.packageId))return response(intent,'No pude consultar tu paquete. No confirmé almacenamiento de este mensaje.');
 const x={...intent,packageId:result.packageId,requires_operation:true};
 let action,body={...who(x),packageId:x.packageId};
 if(x.package_operation==='SEAL')action='seal';
 else if(x.package_operation==='STATUS')action='manifest';
 else if(x.package_operation==='DISCARD'){action='discard';body.itemId=x.discard_item_id;}
 else {action='reserve';Object.assign(body,{receiptId:x.receipt_id,kind:x.kind,text:x.mode_attested===true?'OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n'+x.text.trim():x.text??'',attachment:x.kind==='FILE'?{file_name:x.attachment.file_name,mime_type:x.attachment.mime_type,declared_bytes:x.attachment.declared_bytes}:null});}
 return {...x,next_action:action,next_body:body};
}

export function confirmPackageOperation(context,result) {
 if(context.package_operation==='SEAL') {
  if(result?.status==='READY'&&result.packageId===context.packageId&&Number.isSafeInteger(result.revision))return response(context,`Paquete cerrado: <code>${context.packageId}</code>, versión ${result.revision}. Material guardado y listo para validación automática en el Motor. Consulta el resultado en su chat Work. No se ha generado ni publicado una nota.`,{package_state:'READY',package_revision:result.revision});
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
 if(result?.status==='STORED'&&context.kind==='TEXT'&&result.packageId===context.packageId&&validItem(result.itemId)) {const mode=/^\/(publicar|borrador)(?:\s+(ambos|opuro|opol))?$/i.exec(context.text.trim());const reply=mode?'Instrucción '+mode[1].toUpperCase()+' registrada para '+(mode[2]??'ambos').toUpperCase()+'. Sigue enviando material o termina con /listo.':'Texto guardado en tu paquete. Sigue enviando material; termina con /listo.';return response(context,reply,{itemId:result.itemId,source_stored:true});}
 if(result?.status==='QUOTA_EXCEEDED')return response(context,'El paquete o el almacenamiento piloto alcanzó su límite. No se guardó este mensaje.');
 if(result?.status==='PACKAGE_CLOSED')return response(context,'El paquete ya se cerró. No añadí este mensaje; envía /nuevo para otra nota.');
 return response(context,'No pude confirmar la reserva de este mensaje. No lo descargué ni lo envié al Motor.');
}

export function confirmStoredOriginal(context,result) {
 const {contentBase64,...clean}=context;
 const stored=result?.itemId===context.itemId&&(['STORED','STORED_REPLAY'].includes(result.status));
 const precise=result?.status==='STORED_REPLAY'||(result?.packageId===context.packageId&&result?.bytes===context.bytes_received&&/^[a-f0-9]{64}$/.test(result?.sha256??''));
 if(stored&&precise)return response(clean,`Archivo guardado: ${escape(context.attachment.file_name)}. ${context.bytes_received} bytes comprobados. Sigue enviando material; termina con /listo.`,{source_stored:true,original_stored:true,stored_sha256:result.sha256??null});
 return response(clean,`No pude confirmar el guardado del archivo. Reserva: <code>${escape(context.itemId)}</code>. No se envió al Motor; conserva el original para revisar el resultado.`,{source_stored:false,original_stored:false});
}

export function packageIngressCode() {
 const shared=[validPackage,validItem,escape,who,response].map(f=>`const ${f.name}=${f.toString()};`).join('\n')+`\nconst help=${JSON.stringify(help)};\n`;
 return {
  prepare:shared+preparePackageIntent.toString()+`\nreturn [{json:preparePackageIntent($input.first().json)}];`,
  session:shared+resolvePackageSession.toString()+`\nreturn [{json:resolvePackageSession($('Preparar paquete Telegram').first(0,0).json,$input.first().json)}];`,
  operation:shared+confirmPackageOperation.toString()+`\nreturn [{json:confirmPackageOperation($('Resolver paquete Telegram').first(0,0).json,$input.first().json)}];`,
  stored:shared+confirmStoredOriginal.toString()+`\nreturn [{json:confirmStoredOriginal($('Comprobar bytes Telegram').first(0,0).json,$input.first().json)}];`
 };
}
