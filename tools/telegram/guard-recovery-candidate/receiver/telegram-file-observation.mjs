// Fixed transport/storage diagnostics only. Never serialize source text,
// file IDs, URLs, headers, identities, binary bytes or exception messages.
const fileMimes=['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/jpeg','image/png','image/webp'];
const downloadCodes=['DOWNLOAD_VERIFIED','DOWNLOAD_FETCH_UNCONFIRMED','DOWNLOAD_TIMEOUT','DOWNLOAD_CONTEXT_INVALID','DOWNLOAD_BINARY_MISSING','DOWNLOAD_BINARY_AMBIGUOUS','DOWNLOAD_BINARY_UNREADABLE','DOWNLOAD_EMPTY','DOWNLOAD_SIZE_LIMIT','DOWNLOAD_DECLARED_SIZE_MISMATCH','DOWNLOAD_SIGNATURE_MISMATCH'];
const storeCodes=['STORE_CONFIRMED','STORE_REPLAY_CONFIRMED','STORE_TIMEOUT','STORE_AUTH_DENIED','STORE_INVALID_REQUEST','STORE_HTTP_UNCONFIRMED','STORE_CONFLICT','STORE_RESERVATION_NOT_FOUND','STORE_RESPONSE_UNCONFIRMED'];
const timeoutCodes=['ETIMEDOUT','ESOCKETTIMEDOUT','ECONNABORTED','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT'];

function fileByteCount(value,{zero=false,max=4294967295}={}){return Number.isSafeInteger(value)&&value>=(zero?0:1)&&value<=max?value:null}
function safeFileMime(value){return fileMimes.includes(value)?value:null}
function fileTransportObservation(raw){
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const error=object(raw?.error)?raw.error:null;
 const candidates=[raw?.statusCode,error?.statusCode,error?.httpCode,error?.response?.statusCode,error?.response?.status];
 let httpStatus=null;
 for(const value of candidates){const n=typeof value==='string'&&/^[1-5][0-9]{2}$/.test(value)?Number(value):value;if(Number.isInteger(n)&&n>=100&&n<=599){httpStatus=n;break}}
 const code=typeof error?.code==='string'?error.code:typeof raw?.code==='string'?raw.code:null;
 const timeout=timeoutCodes.includes(code);
 return {httpStatus,timeout,failed:timeout||!!raw&&Object.hasOwn(raw,'error')&&raw.error!==null&&raw.error!==undefined||raw?.ok===false||httpStatus!==null&&httpStatus>=400};
}
export function telegramFileDiagnosticJson(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='code,declaredBytes,httpStatus,mimeType,operation,receivedBytes'||!['DOWNLOAD','STORE'].includes(value.operation))return null;
 if(!(value.operation==='DOWNLOAD'?downloadCodes:storeCodes).includes(value.code)||value.httpStatus!==null&&(!Number.isInteger(value.httpStatus)||value.httpStatus<100||value.httpStatus>599)||value.mimeType!==null&&!fileMimes.includes(value.mimeType)||value.declaredBytes!==null&&fileByteCount(value.declaredBytes,{max:10485760})===null||value.receivedBytes!==null&&fileByteCount(value.receivedBytes,{zero:true})===null)return null;
 return JSON.stringify({operation:value.operation,httpStatus:value.httpStatus,code:value.code,mimeType:value.mimeType,declaredBytes:value.declaredBytes,receivedBytes:value.receivedBytes});
}
function fileDiagnostic(context,operation,code,httpStatus=null,receivedBytes=null){
 return {operation,httpStatus,code,mimeType:safeFileMime(context?.attachment?.mime_type),declaredBytes:fileByteCount(context?.attachment?.declared_bytes,{max:10485760}),receivedBytes:fileByteCount(receivedBytes,{zero:true})};
}
export function telegramFileReceiptDiagnostic(value){
 if(typeof value!=='string'||value.length>384)return null;
 let parsed;try{parsed=JSON.parse(value)}catch{return null}
 return telegramFileDiagnosticJson(parsed);
}
function fileDownloadFailure(context,code,httpStatus=null,receivedBytes=null){
 const {contentBase64,...clean}=context??{};
 const messages={DOWNLOAD_FETCH_UNCONFIRMED:'Telegram no confirmó la descarga del archivo.',DOWNLOAD_TIMEOUT:'La descarga no terminó dentro del tiempo confirmado.',DOWNLOAD_CONTEXT_INVALID:'No pude verificar los datos de la descarga.',DOWNLOAD_BINARY_MISSING:'La descarga no incluyó los bytes del archivo.',DOWNLOAD_BINARY_AMBIGUOUS:'La descarga incluyó varios archivos y no pude identificar el original.',DOWNLOAD_BINARY_UNREADABLE:'No pude leer los bytes descargados.',DOWNLOAD_EMPTY:'La descarga llegó vacía.',DOWNLOAD_SIZE_LIMIT:'El archivo descargado supera el límite de 10 MiB.',DOWNLOAD_DECLARED_SIZE_MISMATCH:'El tamaño descargado no coincide con el informado por Telegram.',DOWNLOAD_SIGNATURE_MISMATCH:'El archivo descargado no corresponde al formato declarado.'};
 const reservation=/^ti_[a-f0-9]{40}$/.test(context?.itemId??'')?' Reserva pendiente: <code>'+context.itemId+'</code>.':'';
 return {...clean,kind:'DOWNLOAD_NOT_CONFIRMED',has_file:false,requires_storage:false,requires_operation:false,bytes_received:fileByteCount(receivedBytes,{zero:true}),source_stored:false,original_stored:false,storage_diagnostic:telegramFileDiagnosticJson(fileDiagnostic(context,'DOWNLOAD',code,httpStatus,receivedBytes)),reply_text:(messages[code]??messages.DOWNLOAD_CONTEXT_INVALID)+reservation+' No se envió material al Motor. Revisa /estado antes de reenviar.'};
}
export async function checkTelegramDownloadedFile(context,item,readBinary){
 const validContext=context?.kind==='FILE'&&safeFileMime(context?.attachment?.mime_type)!==null&&typeof context.attachment.file_name==='string'&&context.attachment.file_name.length>0&&context.attachment.file_name.length<=240&&Number.isSafeInteger(context.max_bytes)&&context.max_bytes>=1&&context.max_bytes<=10485760&&(context.attachment.declared_bytes===null||fileByteCount(context.attachment.declared_bytes,{max:context.max_bytes})!==null)&&typeof readBinary==='function';
 if(!validContext)return fileDownloadFailure(context,'DOWNLOAD_CONTEXT_INVALID');
 const observation=fileTransportObservation(item?.json??{});
 if(observation.failed)return fileDownloadFailure(context,observation.timeout?'DOWNLOAD_TIMEOUT':'DOWNLOAD_FETCH_UNCONFIRMED',observation.httpStatus);
 const keys=Object.keys(item?.binary??{});
 if(keys.length!==1)return fileDownloadFailure(context,keys.length?'DOWNLOAD_BINARY_AMBIGUOUS':'DOWNLOAD_BINARY_MISSING',observation.httpStatus);
 let bytes;try{bytes=await readBinary(keys[0])}catch{return fileDownloadFailure(context,'DOWNLOAD_BINARY_UNREADABLE',observation.httpStatus)}
 if(!Buffer.isBuffer(bytes))return fileDownloadFailure(context,'DOWNLOAD_BINARY_UNREADABLE',observation.httpStatus);
 if(!bytes.length)return fileDownloadFailure(context,'DOWNLOAD_EMPTY',observation.httpStatus,0);
 if(bytes.length>context.max_bytes)return fileDownloadFailure(context,'DOWNLOAD_SIZE_LIMIT',observation.httpStatus,bytes.length);
 if(context.attachment.declared_bytes!==null&&bytes.length!==context.attachment.declared_bytes)return fileDownloadFailure(context,'DOWNLOAD_DECLARED_SIZE_MISMATCH',observation.httpStatus,bytes.length);
 const mime=context.attachment.mime_type,starts=signature=>bytes.length>=signature.length&&signature.every((v,i)=>bytes[i]===v);
 const signature=mime==='application/pdf'?bytes.subarray(0,5).toString('ascii')==='%PDF-':mime==='application/msword'?starts([208,207,17,224,161,177,26,225]):mime==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'?starts([80,75,3,4]):mime==='image/jpeg'?starts([255,216,255]):mime==='image/png'?starts([137,80,78,71,13,10,26,10]):mime==='image/webp'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP':mime==='text/plain'?!bytes.includes(0):false;
 if(!signature)return fileDownloadFailure(context,'DOWNLOAD_SIGNATURE_MISMATCH',observation.httpStatus,bytes.length);
 // Signature is a transport check, not a full PDF parse or editorial review.
 const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 return {...context,has_file:true,bytes_received:bytes.length,source_stored:false,original_stored:false,storage_diagnostic:telegramFileDiagnosticJson(fileDiagnostic(context,'DOWNLOAD','DOWNLOAD_VERIFIED',observation.httpStatus,bytes.length)),contentBase64:bytes.toString('base64'),reply_text:'Archivo recibido: '+escape(context.attachment.file_name)+'\nBytes comprobados: '+bytes.length+'.\nPendiente de confirmación de guardado.'};
}
export function confirmObservedStoredOriginal(context,raw,confirmOriginal){
 const observation=fileTransportObservation(raw),body=!observation.failed&&raw?.statusCode===200&&raw.body&&typeof raw.body==='object'&&!Array.isArray(raw.body)?raw.body:null;
 const result=confirmOriginal(context,body??{});
 let code;
 if(observation.timeout)code='STORE_TIMEOUT';
 else if(observation.httpStatus===401||observation.httpStatus===403)code='STORE_AUTH_DENIED';
 else if(observation.httpStatus===400)code='STORE_INVALID_REQUEST';
 else if(observation.httpStatus!==200)code='STORE_HTTP_UNCONFIRMED';
 else if(result.original_stored===true&&!observation.failed)code=body?.status==='STORED_REPLAY'?'STORE_REPLAY_CONFIRMED':'STORE_CONFIRMED';
 else if(body?.status==='CONFLICT')code='STORE_CONFLICT';
 else if(body?.status==='NOT_FOUND')code='STORE_RESERVATION_NOT_FOUND';
 else code='STORE_RESPONSE_UNCONFIRMED';
 const confirmed=['STORE_CONFIRMED','STORE_REPLAY_CONFIRMED'].includes(code);
 return {...result,...(!confirmed?{source_stored:false,original_stored:false,reply_text:result.reply_text+' Revisa /estado antes de reenviar; una respuesta incierta no confirma si el original quedó guardado.'}:{}),storage_diagnostic:telegramFileDiagnosticJson(fileDiagnostic(context,'STORE',code,observation.httpStatus,context.bytes_received))};
}
export function telegramFileDiagnosticSource(){return 'const fileMimes='+JSON.stringify(fileMimes)+';\nconst downloadCodes='+JSON.stringify(downloadCodes)+';\nconst storeCodes='+JSON.stringify(storeCodes)+';\n'+[fileByteCount,safeFileMime,telegramFileDiagnosticJson,telegramFileReceiptDiagnostic].map(fn=>fn.toString()).join('\n')}
export function telegramFileObservationSource(){return telegramFileDiagnosticSource()+'\nconst timeoutCodes='+JSON.stringify(timeoutCodes)+';\n'+[fileTransportObservation,fileDiagnostic,fileDownloadFailure,checkTelegramDownloadedFile,confirmObservedStoredOriginal].map(fn=>fn.toString()).join('\n')}
