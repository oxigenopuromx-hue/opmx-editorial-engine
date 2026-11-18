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
// PACKAGE_OPENING_DIAGNOSTIC_V1
function observePackageStorageResponse(raw) {
 const httpStatus=Number.isInteger(raw?.statusCode)&&raw.statusCode>=100&&raw.statusCode<=599?raw.statusCode:null;
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const body=httpStatus===200&&object(raw?.body)?raw.body:null;
 const errorCode=typeof raw?.error?.code==='string'?raw.error.code:typeof raw?.code==='string'?raw.code:null;
 const timeout=['ETIMEDOUT','ESOCKETTIMEDOUT','ECONNABORTED','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT'].includes(errorCode);
 return {httpStatus,body,transportCode:timeout?'TIMEOUT':'UNCONFIRMED'};
}
function packageOpeningDiagnostic(observation) {
 const {httpStatus,body,transportCode}=observation;
 let code;
 if(httpStatus===null)code=transportCode==='TIMEOUT'?'OPEN_TIMEOUT':'OPEN_TRANSPORT_UNCONFIRMED';
 else if(httpStatus===401||httpStatus===403)code='OPEN_AUTH_DENIED';
 else if(httpStatus===400)code='OPEN_INVALID_REQUEST';
 else if(httpStatus===429)code='OPEN_RATE_LIMITED';
 else if(httpStatus!==200)code='OPEN_HTTP_UNCONFIRMED';
 else if(body?.status==='QUOTA_EXCEEDED')code='OPEN_QUOTA_EXCEEDED';
 else {
  const valid=typeof body?.packageId==='string'&&/^tg_[a-f0-9]{40}$/.test(body.packageId);
  if(valid&&body.status==='OPEN'&&Number.isSafeInteger(body.revision)&&body.revision>0&&(body.state===undefined||body.state==='OPEN'))code='OPEN_CONFIRMED';
  else if(valid&&body.status==='ALREADY_OPEN'&&(body.state===undefined||body.state==='OPEN'))code='OPEN_ALREADY_EXISTS';
  else if(valid&&body.status==='OPEN_REPLAY'&&body.state==='OPEN')code='OPEN_REPLAY_CONFIRMED';
  else if(valid&&body.status==='OPEN_REPLAY'&&['READY','CANCELLED'].includes(body.state))code='OPEN_CLOSED_REPLAY';
  else code='OPEN_RESPONSE_INVALID';
 }
 return {operation:'OPEN',httpStatus,code};
}
function packageOpeningDiagnosticJson(value) {
 const codes=['OPEN_CONFIRMED','OPEN_ALREADY_EXISTS','OPEN_REPLAY_CONFIRMED','OPEN_CLOSED_REPLAY','OPEN_QUOTA_EXCEEDED','OPEN_AUTH_DENIED','OPEN_INVALID_REQUEST','OPEN_RATE_LIMITED','OPEN_HTTP_UNCONFIRMED','OPEN_TIMEOUT','OPEN_TRANSPORT_UNCONFIRMED','OPEN_RESPONSE_INVALID'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='code,httpStatus,operation'||value.operation!=='OPEN'||!codes.includes(value.code)||(value.httpStatus!==null&&(!Number.isInteger(value.httpStatus)||value.httpStatus<100||value.httpStatus>599)))return null;
 return JSON.stringify({operation:'OPEN',httpStatus:value.httpStatus,code:value.code});
}
function resolveObservedPackageSession(intent,raw,resolveOriginal) {
 const observation=observePackageStorageResponse(raw);
 if(intent?.package_operation!=='OPEN')return resolveOriginal(intent,observation.body??{status:'STORAGE_RESPONSE_UNCONFIRMED'});
 const diagnostic=packageOpeningDiagnostic(observation);
 const done=result=>({...result,storage_diagnostic:packageOpeningDiagnosticJson(diagnostic)});
 if(['OPEN_CONFIRMED','OPEN_ALREADY_EXISTS','OPEN_REPLAY_CONFIRMED'].includes(diagnostic.code))return done(resolveOriginal(intent,observation.body));
 const closed=diagnostic.code==='OPEN_CLOSED_REPLAY';
 const replies={
  OPEN_CLOSED_REPLAY:'Este comando corresponde a un paquete cerrado. No se reabrió ni se cambió su modo. Envía /nuevo como un mensaje nuevo para otra nota.',
  OPEN_QUOTA_EXCEEDED:'El almacenamiento alcanzó el límite de paquetes y necesita revisión administrativa. No se abrió otro paquete. Conserva tus archivos; todavía no los envíes.',
  OPEN_AUTH_DENIED:'No pude confirmar la apertura por un problema de acceso al almacenamiento. Conserva tus archivos; todavía no los envíes.',
  OPEN_RATE_LIMITED:'El servicio de almacenamiento está ocupado; la apertura no quedó confirmada. Conserva tus archivos; todavía no los envíes.',
 };
 const quotaReply=diagnostic.code==='OPEN_QUOTA_EXCEEDED'&&observation.body?.quotaDiagnostic?.operation==='OPEN'?formatQuotaDiagnosticText(observation.body.quotaDiagnostic):null;
 const reply=quotaReply??replies[diagnostic.code]??'La apertura está pendiente de confirmación. Conserva tus archivos; todavía no los envíes. Consulta /estado antes de repetir /nuevo.';
 return done({...intent,has_file:false,requires_storage:false,requires_operation:false,reply_text:reply,default_policy_candidate:false,routing_owner_confirmed:false,
  ...(closed?{packageId:observation.body.packageId,package_state:observation.body.state}:{})});
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
// CONTENT_MODE_CONTROL_V1
function parseContentModeCommand(text) {
  if (typeof text !== 'string') throw Error('INVALID_CONTENT_MODE_COMMAND');
  const value=text.trim().replace(/[ \t]+/g,' ').toLowerCase();
  if (/[\r\n]/.test(value)) throw Error('INVALID_CONTENT_MODE_COMMAND');
  if (value==='/editorial') return {command:'/editorial',contentMode:'EDITORIAL'};
  if (['/literal','tal cual','publica tal cual','publicar tal cual','sin agregar nada','tal cual sin agregar nada','publica tal cual sin agregar nada','publicar tal cual sin agregar nada','la publicación va tal cual, sin agregarle nada.','la publicación va tal cual, sin agregarle nada','la publicacion va tal cual, sin agregarle nada.','la publicacion va tal cual, sin agregarle nada'].includes(value)) return {command:'/literal',contentMode:'LITERAL'};
  throw Error('INVALID_CONTENT_MODE_COMMAND');
}
function contentModeCommand(s){try{return parseContentModeCommand(s)}catch{return null}}
function isMode(s) { try { parseDestinationCommand(s); return true; } catch { return false; } }
function validControl(s) { return ['/nuevo','/listo','/literal','/editorial'].includes(s)||isMode(s); }
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
const help="Para una nota: envía /nuevo, materiales y /listo. Por defecto se publica en TODOS: OXígeno Puro, OXígeno Político y El Liberal. AMBOS incluye OXígeno Puro y OXígeno Político. Para elegir destino usa /publicar o /borrador seguido de opuro, opol, liberal, ambos, todos o una lista separada por comas. TODOS incluye los tres medios. Antes de /listo, /literal conserva título, subtítulos y cuerpo sin añadir texto; /editorial solicita redacción editorial. También puedes escribir tal cual como mensaje nuevo y separado. /imagen generar solicita una ilustración y no autoriza publicar.";
function resolvePackageSession(intent,result) {
 if(intent.package_operation==='BLOCKED_LIST'){
  if(result?.status!=='BLOCKED_LIST'||!Array.isArray(result.packages)||result.packages.length>20||typeof result.more!=='boolean'||result.packages.some(p=>!validPackage(p?.packageId)||!Number.isSafeInteger(p.revision)||p.revision<1)||new Set(result.packages.map(p=>p.packageId)).size!==result.packages.length)return response(intent,'No pude consultar los paquetes bloqueados.');
  if(!result.packages.length)return response(intent,'No hay bloqueos registrados en el seguimiento nuevo. Los paquetes anteriores pueden requerir conciliación.');
  const lines=result.packages.map(p=>`Revisión ${p.revision}: /abrir ${p.packageId}`);
  return response(intent,`Paquetes bloqueados registrados:\n${lines.join('\n')}\nLa reapertura requiere conciliación; esta lista no confirma que sea segura.${result.more?'\nHay más resultados.':''}`);
 }
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
  return response(intent,notice.reply,{packageId:result.packageId,package_state:closed?'READY':'OPEN',default_policy_candidate:notice.newPolicy,routing_owner_confirmed:['OPEN','OPEN_REPLAY'].includes(result.status)});
 }
 if(result?.status==='NO_OPEN_PACKAGE')return response(intent,'No hay una nota abierta. Envía /nuevo y después sus textos, fotos y documentos.');
 if(result?.status!=='OPEN'||!validPackage(result.packageId))return response(intent,'No pude consultar tu paquete. No confirmé almacenamiento de este mensaje.');
 const x={...intent,packageId:result.packageId,package_revision:result.revision,requires_operation:true,recovery_session:result.recovery===true};
 if(x.recovery_session&&x.kind==='TEXT'&&typeof x.text==='string'&&isMode(x.text.trim()))return response(intent,'En un paquete reabierto usa /opciones crear literal DESTINO o /opciones crear editorial DESTINO para elegir el destino y la modalidad. Para actualizar una nota existente usa /opciones actualizar. Este comando no cambió el paquete.');
 if(x.content_mode_command!==undefined&&x.content_mode_command!==null){const content=contentModeCommand(x.text);if(x.kind!=='TEXT'||x.mode_attested!==true||!content||content.command!==x.content_mode_command)return response(intent,'No pude confirmar la selección del modo de contenido.');if(x.recovery_session)return response(intent,'En un paquete reabierto usa /opciones crear literal DESTINO o /opciones actualizar literal DESTINO, según la acción y los destinos que deseas confirmar. Para redacción usa editorial en lugar de literal.');}
 let action,body={...who(x),packageId:x.packageId};
 if(x.package_operation==='CANCEL_DUPLICATE'){
  if(x.cancel_attested!==true||!Number.isSafeInteger(result.revision)||result.revision<1||x.cancel_package_id!==result.packageId||x.cancel_revision!==result.revision)return response(intent,'El paquete o la revisión cambió. Consulta /estado antes de cancelar.');
  action='cancel-duplicate';Object.assign(body,{revision:result.revision,receiptId:x.receipt_id});
 }
 else if(x.package_operation==='PLACEMENT'){
  let selected;try{selected=parsePlacementCommand(x.text)}catch{return response(intent,'No pude confirmar la orden de colocación.');}
  if(x.kind!=='COMMAND'||x.placement_attested!==true||x.mode_attested!==true||!Number.isSafeInteger(result.revision)||result.revision<1||JSON.stringify(x.placement_ids)!==JSON.stringify(selected.ids)||x.placement_target!=='OPURO')return response(intent,'No pude acreditar una orden directa de colocación.');
  action='placement/select';Object.assign(body,{revision:result.revision,receiptId:x.receipt_id,ids:selected.ids});
 }
 else if(x.package_operation==='SELECT'){
  if(!x.recovery_session||!Number.isSafeInteger(result.revision)||x.mode_attested!==true)return response(intent,'Las opciones sólo pueden elegirse directamente en un paquete reabierto.');
  action='corrections/select';Object.assign(body,{revision:result.revision,receiptId:x.receipt_id,action:x.selection_action,mode:x.selection_mode,destination:x.selection_destination});
 }
 else if(x.package_operation==='CONFIRM'){
  if(!x.recovery_session||x.mode_attested!==true||!['CREATE','UPDATE'].includes(x.confirmation_action)||result.revision!==x.confirmation_revision)return response(intent,'La vista previa ya no corresponde a la revisión actual; vuelve a pedirla con /listo.');
  action='corrections/confirm';Object.assign(body,{revision:result.revision,receiptId:x.receipt_id,previewHash:x.confirmation_hash,action:x.confirmation_action});
 }
 else if(x.package_operation==='SEAL'){action='close';Object.assign(body,{receiptId:x.receipt_id,kind:'TEXT',text:attestedControl('/listo',x.packageId,x.message_id),attachment:null});}
 else if(x.package_operation==='STATUS')action='manifest';
 else if(x.package_operation==='DISCARD'){
  if(x.mode_attested!==true)return response(intent,'Para descartar una reserva pendiente, escribe /descartar y su identificador directamente en este chat.');
  action='discard';body.itemId=x.discard_item_id;
 }
 else {action='reserve';Object.assign(body,{receiptId:x.receipt_id,kind:x.kind,text:x.mode_attested===true?(x.content_mode_command?attestedControl(x.content_mode_command,x.packageId,x.message_id):isMode(x.text.trim())?attestedControl(x.text.trim(),x.packageId,x.message_id):ORDER_PREFIX+x.text.trim()):x.text??'',attachment:x.kind==='FILE'?{file_name:x.attachment.file_name,mime_type:x.attachment.mime_type,declared_bytes:x.attachment.declared_bytes}:null});}
 const paths={'cancel-duplicate':'packages/cancel-duplicate','placement/select':'placement/select',close:'packages/close',reserve:'packages/reserve',manifest:'packages/manifest',discard:'packages/discard','corrections/select':'corrections/select','corrections/confirm':'corrections/confirm'};
 if(!Object.hasOwn(paths,action))return response(intent,'No pude confirmar la operación solicitada.');
 return {...x,next_action:action,next_url:'https://publisher.oxigenopuro.com.mx/v1/telegram/'+paths[action],next_body:body,seal_after_close:x.package_operation==='SEAL'};
}
return [{json:resolveObservedPackageSession($('Preparar paquete Telegram').first(0,0).json,$input.first().json,resolvePackageSession)}];
