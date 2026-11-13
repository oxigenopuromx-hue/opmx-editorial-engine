// Only fixed diagnostic codes and an HTTP number may leave this boundary.
// Error messages, response headers, URLs, sources and identities are never kept.
export function observePackageStorageResponse(raw) {
 const httpStatus=Number.isInteger(raw?.statusCode)&&raw.statusCode>=100&&raw.statusCode<=599?raw.statusCode:null;
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const body=httpStatus===200&&object(raw?.body)?raw.body:null;
 const errorCode=typeof raw?.error?.code==='string'?raw.error.code:typeof raw?.code==='string'?raw.code:null;
 const timeout=['ETIMEDOUT','ESOCKETTIMEDOUT','ECONNABORTED','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT'].includes(errorCode);
 return {httpStatus,body,transportCode:timeout?'TIMEOUT':'UNCONFIRMED'};
}

export function packageOpeningDiagnostic(observation) {
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

export function packageOpeningDiagnosticJson(value) {
 const codes=['OPEN_CONFIRMED','OPEN_ALREADY_EXISTS','OPEN_REPLAY_CONFIRMED','OPEN_CLOSED_REPLAY','OPEN_QUOTA_EXCEEDED','OPEN_AUTH_DENIED','OPEN_INVALID_REQUEST','OPEN_RATE_LIMITED','OPEN_HTTP_UNCONFIRMED','OPEN_TIMEOUT','OPEN_TRANSPORT_UNCONFIRMED','OPEN_RESPONSE_INVALID'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='code,httpStatus,operation'||value.operation!=='OPEN'||!codes.includes(value.code)||(value.httpStatus!==null&&(!Number.isInteger(value.httpStatus)||value.httpStatus<100||value.httpStatus>599)))return null;
 return JSON.stringify({operation:'OPEN',httpStatus:value.httpStatus,code:value.code});
}

export function resolveObservedPackageSession(intent,raw,resolveOriginal) {
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
 const reply=replies[diagnostic.code]??'La apertura está pendiente de confirmación. Conserva tus archivos; todavía no los envíes. Consulta /estado antes de repetir /nuevo.';
 return done({...intent,has_file:false,requires_storage:false,requires_operation:false,reply_text:reply,default_policy_candidate:false,routing_owner_confirmed:false,
  ...(closed?{packageId:observation.body.packageId,package_state:observation.body.state}:{})});
}

export function packageOpeningObservationSource() {
 return [observePackageStorageResponse,packageOpeningDiagnostic,packageOpeningDiagnosticJson,resolveObservedPackageSession].map(fn=>fn.toString()).join('\n');
}
