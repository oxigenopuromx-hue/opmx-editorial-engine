import {createHash} from 'node:crypto';
import {blockerDiagnosticSource,parseBlockerDiagnosticStage,renderBlockerDiagnostic} from '../../blocker-diagnostic.mjs';

export const blockerAdminNames=Object.freeze({prepare:'Preparar comprobación de alertas',select:'Seleccionar alertas de administrador'});
const marker='BOUNDED_BLOCKER_ADMIN_DIAGNOSTICS_V2';
const sha=value=>createHash('sha256').update(value).digest('hex');
const once=(source,from,to)=>{if(typeof source!=='string'||source.split(from).length!==2)throw Error('BLOCKER_ADMIN_SOURCE_CHANGED');return source.replace(from,to)};

// Only the structured carrier can supply a detail. Unsolicited object fields,
// malformed carriers and arbitrary exception text never become an explanation.
export function normalizeBlockerAdminTrackingRows(rows){
 if(!Array.isArray(rows))throw Error('BLOCKER_ADMIN_ROWS_INVALID');
 return rows.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return raw;
  const row={...raw};delete row.blockerDiagnostic;delete row.blockerDiagnosticInvalid;
  try{const parsed=parseBlockerDiagnosticStage(row.stage);if(parsed){row.stage=parsed.reason;row.blockerDiagnostic=parsed.blockerDiagnostic}else if(row.stage==='DIAG')throw Error('TRUNCATED_DIAGNOSTIC')}
  catch{row.stage='INTERNAL_ERROR';row.blockerDiagnosticInvalid=true}
  return row;
 });
}

export function blockerAdminCandidateFields(row){
 return {...(row?.blockerDiagnostic?{blockerDiagnostic:{version:row.blockerDiagnostic.version,code:row.blockerDiagnostic.code,itemOrdinal:row.blockerDiagnostic.itemOrdinal}}:{}),...(row?.blockerDiagnosticInvalid===true?{blockerDiagnosticInvalid:true}:{})};
}

export function renderBlockerAdminAlert(candidate,index){
 const c=candidate;
 if(!c||!/^tg_[a-f0-9]{40}$/.test(c.package_id??'')||!Number.isSafeInteger(c.revision)||c.revision<1||c.revision>4294967295||!/^ALERT_ADMIN_[1-9][0-9]{0,15}$/.test(c.stage??'')||typeof c.occurred_at!=='string'||c.occurred_at.length>40||!Number.isFinite(Date.parse(c.occurred_at))||!Number.isSafeInteger(index)||index<1||index>20||!['Tu cuenta','Otra cuenta','Cuenta no identificada'].includes(c.origin))throw Error('BLOCKER_ADMIN_CANDIDATE_INVALID');
 const delays={QUEUED:'Inicio del Motor',PROGRESS_START:'Revisión de fuentes',PROGRESS_WRITING:'Redacción',PROGRESS_IMAGE:'Preparación de imagen',PROGRESS_SUBMIT:'Espera del resultado de Publisher'};
 const delay=Object.hasOwn(delays,c.sourceStage),uncertain=['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN'].includes(c.sourceStage);
 let detail;
 if(c.blockerDiagnosticInvalid===true)detail={code:'DIAGNOSTIC_INVALID',field:'Diagnóstico de esta revisión',itemOrdinal:0,cause:'El registro del bloqueo no contiene un diagnóstico específico válido.',action:'Consulta /estado y conserva el paquete. Se debe revisar este diagnóstico antes de cambiar materiales o repetir un envío.'};
 else if(delay){if(c.blockerDiagnostic!==undefined)throw Error('BLOCKER_ADMIN_DELAY_DIAGNOSTIC');detail={code:c.sourceStage,field:delays[c.sourceStage],itemOrdinal:0,cause:'La etapa '+delays[c.sourceStage].toLowerCase()+' aún no tiene un resultado confirmado.',action:'Consulta /estado y conserva este intento. Una demora por sí sola no confirma que haya fallado ni que la nota se haya publicado.'};}
 else detail=renderBlockerDiagnostic({reason:c.sourceStage,diagnostic:c.blockerDiagnostic??null,packageId:c.package_id,revision:c.revision});
 if(!detail||typeof detail.cause!=='string'||!detail.cause||detail.cause.length>900||typeof detail.action!=='string'||!detail.action||detail.action.length>1500||detail.field!==null&&typeof detail.field!=='string'||typeof detail.field==='string'&&detail.field.length>300||detail.code!==null&&typeof detail.code!=='string'||typeof detail.code==='string'&&(!/^[A-Z][A-Z0-9_]{0,79}$/.test(detail.code))||!Number.isSafeInteger(detail.itemOrdinal)||detail.itemOrdinal<0||detail.itemOrdinal>40)throw Error('BLOCKER_ADMIN_DETAIL_INVALID');
 const html=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const field=(detail.itemOrdinal?'Elemento '+detail.itemOrdinal+' · ':'')+(detail.field??'Campo concreto no registrado');
 const text=index+'. '+(delay?'DEMORA':'BLOQUEO')+': '+html(detail.cause)+'\n'+html(c.origin)+' · paquete '+c.package_id+' · versión '+c.revision+'\nDato afectado: '+html(field)+'\nQué hacer: '+html(detail.action)+'\nCódigo: '+(detail.code??c.sourceStage);
 return {text,uncertain};
}

// Pure message-budget operation. Its inputs are rendered by the fixed catalog
// boundary above; it is not a second source of diagnostic text or authority.
export function boundedBlockerAdminPrefix(rendered,{limit=3800}={}){
 if(!Array.isArray(rendered)||rendered.length>20||!Number.isSafeInteger(limit)||limit<600||limit>3800)throw Error('BLOCKER_ADMIN_BATCH_INVALID');
 const header='OPMX · alerta de administrador\n\n',footer='\n\nHay resultados de Publisher sin confirmar. No repitas esos envíos hasta conciliarlos.';
 const chosen=[],blocks=[];let includesUncertainty=false,text='';
 for(const entry of rendered){
  if(!entry||typeof entry.text!=='string'||!entry.text||entry.text.length>3200||typeof entry.uncertain!=='boolean')throw Error('BLOCKER_ADMIN_RENDER_INVALID');
  const nextUncertainty=includesUncertainty||entry.uncertain;
  const next=header+[...blocks,entry.text].join('\n\n')+(nextUncertainty?footer:'');
  if(next.length>limit){if(!chosen.length)throw Error('BLOCKER_ADMIN_MESSAGE_TOO_LARGE');break}
  chosen.push(entry);blocks.push(entry.text);includesUncertainty=nextUncertainty;text=next;
 }
 return {chosen,text};
}

// Budget AFTER HTML escaping, measured in JavaScript UTF-16 units. Pick a
// complete prefix; only that prefix is returned to the existing ACK recorder.
export function renderBlockerAdminBatch(chatId,candidates,{limit=3800}={}){
 if(typeof chatId!=='string'||!/^[1-9][0-9]{0,15}$/.test(chatId)||!Array.isArray(candidates)||candidates.length>20)throw Error('BLOCKER_ADMIN_BATCH_INVALID');
 if(!candidates.length)return [];
 const rendered=candidates.map((candidate,i)=>({...renderBlockerAdminAlert(candidate,i+1),candidate}));
 const {chosen,text}=boundedBlockerAdminPrefix(rendered,{limit});
 const alerts=chosen.map(({candidate:c})=>({package_id:c.package_id,revision:c.revision,stage:c.stage,occurred_at:c.occurred_at}));
 return [{json:{chat_id:chatId,text,alerts}}];
}

export function blockerAdminDiagnosticSource(){
 return '// '+marker+'\n'+blockerDiagnosticSource()+'\n'+[normalizeBlockerAdminTrackingRows,blockerAdminCandidateFields,renderBlockerAdminAlert,boundedBlockerAdminPrefix,renderBlockerAdminBatch].map(fn=>fn.toString()).join('\n');
}

const one=(graph,name)=>{const nodes=graph?.nodes?.filter(n=>n.name===name);if(nodes?.length!==1||nodes[0].type!=='n8n-nodes-base.code'||typeof nodes[0].parameters?.jsCode!=='string')throw Error('BLOCKER_ADMIN_NODE_CHANGED');return nodes[0]};
export function blockerAdminBase(graph){
 if(graph?.id!=='NFOBzPfHmvRjVFOA'||typeof graph.versionId!=='string'||graph.nodes?.length!==16||!graph.connections)throw Error('BLOCKER_ADMIN_GRAPH_INVALID');
 return {versionId:graph.versionId,nodeHashes:Object.fromEntries(Object.values(blockerAdminNames).map(name=>[name,sha(JSON.stringify(one(graph,name).parameters))]))};
}

export function buildBlockerAdminOperations(graph,expected){
 const actual=blockerAdminBase(graph);
 if(!expected||actual.versionId!==expected.versionId||Object.values(blockerAdminNames).some(name=>actual.nodeHashes[name]!==expected.nodeHashes?.[name]))throw Error('BLOCKER_ADMIN_REBASE_REQUIRED');
 const prepare=one(graph,blockerAdminNames.prepare),select=one(graph,blockerAdminNames.select);
 if([prepare,select].some(n=>n.parameters.jsCode.includes(marker)))throw Error('BLOCKER_ADMIN_ALREADY_INSTALLED');
 const prefix=blockerAdminDiagnosticSource()+'\n';
 let p=once(prepare.parameters.jsCode,'const requestRows=$input.all().map(x=>x.json),reconciliationRows=requestRows.filter(x=>x.stage===\'PUBLICATION_RECONCILED\');',"const blockerTrackingRows=normalizeBlockerAdminTrackingRows($input.all().map(x=>x.json));\nconst requestRows=blockerTrackingRows,reconciliationRows=requestRows.filter(x=>x.stage==='PUBLICATION_RECONCILED');");
 p=once(p,'const rows=$input.all().map(x=>x.json), groups=new Map();','const rows=blockerTrackingRows, groups=new Map();');
 p=once(p,'origin};if(!persistence.publicationAlertWasReconciled','origin,...blockerAdminCandidateFields(last)};if(!persistence.publicationAlertWasReconciled');
 const old=select.parameters.jsCode,start='const alerts=retained.map(',end='return [{json:{chat_id:batch.chatId,text,alerts}}];';
 if(old.split(start).length!==2||old.split(end).length!==2||old.indexOf(start)>old.indexOf(end))throw Error('BLOCKER_ADMIN_RENDER_CHANGED');
 const rendered=old.slice(0,old.indexOf(start))+'return renderBlockerAdminBatch(batch.chatId,retained);'+old.slice(old.indexOf(end)+end.length);
 return [{type:'updateNodeParameters',nodeName:prepare.name,parameters:{...prepare.parameters,jsCode:prefix+p},replace:true},{type:'updateNodeParameters',nodeName:select.name,parameters:{...select.parameters,jsCode:prefix+rendered},replace:true}];
}
