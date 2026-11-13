import {createHash} from 'node:crypto';
import {blockerDiagnosticSource} from '../../blocker-diagnostic.mjs';
const marker='OPMX_BLOCKER_DIAGNOSTIC_V1';
const names=['Protocolo MCP archivos','Preparar aviso de bloqueo','Resultado de bloqueo Telegram','Bloqueo no confirmado'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const one=(graph,name)=>{const found=graph?.nodes?.filter(n=>n.name===name);if(found?.length!==1||found[0].type!=='n8n-nodes-base.code'||typeof found[0].parameters?.jsCode!=='string')throw Error('BLOCKER_GRAPH_NODE_CHANGED:'+name);return found[0]};
const replace=(s,from,to)=>{if(s.split(from).length!==2)throw Error('BLOCKER_SOURCE_ANCHOR_CHANGED');return s.replace(from,to)};
export function blockerDiagnosticBase(graph){
 if(graph?.id!=='bnzVMNkZuGO1GQCZ'||typeof graph.versionId!=='string'||!Array.isArray(graph.nodes)||graph.nodes.length!==155)throw Error('BLOCKER_MCP_BASE_INVALID');
 return {versionId:graph.versionId,nodeHashes:Object.fromEntries([...names,'Preparar registro de avance'].map(name=>[name,sha(JSON.stringify(one(graph,name).parameters))]))};
}

export function patchBlockerDiagnosticMcpCode(code){
 if(typeof code!=='string'||code.includes(marker))throw Error('BLOCKER_DIAGNOSTIC_ALREADY_INSTALLED');
 const classifier='function classifyTelegramFailure(envelope,identity,classifyBase) {';
 if(code.split(classifier).length!==2)throw Error('BLOCKER_CLASSIFIER_CHANGED');
 const start=code.indexOf(classifier),legacy=" if(m?.method==='tools/call'&&m.params?.name==='informar_revision_telegram_opmx'&&m.params?.arguments?.revision>=1000000){",direct=" const name='informar_bloqueo_telegram_opmx';";
 const insertion=code.indexOf(legacy,start)>=0?code.indexOf(legacy,start):code.indexOf(direct,start);
 if(insertion<0)throw Error('BLOCKER_CLASSIFIER_CHANGED');
 const branch=` if(m?.method==='tools/call'&&m.params?.name==='informar_revision_telegram_opmx'&&m.params?.arguments?.revision>=BLOCKER_DIAGNOSTIC_BASE){\n  const a=m.params.arguments,bad=()=>({httpStatus:200,response:{jsonrpc:'2.0',id:m.id??null,error:{code:-32602,message:'Invalid blocker diagnostic'}}});\n  if(m.jsonrpc!=='2.0'||!Object.hasOwn(m,'id')||typeof identity?.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner)||!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).sort().join(',')!=='outcome,package_id,revision'||a.outcome!=='SOURCES_VERIFIED'||!/^tg_[a-f0-9]{40}$/.test(a.package_id??''))return bad();\n  let decoded;try{decoded=decodeBlockerDiagnosticRevision(a.revision)}catch{return bad()}if(!decoded)return bad();\n  return {httpStatus:200,route:'telegram-failure',request:{id:m.id,body:{owner:identity.owner,chat:identity.chat,packageId:a.package_id,...decoded}}};\n }\n`;
 let out=code.slice(0,insertion)+branch+code.slice(insertion);
 const original=" const b=request.body,msg=MESSAGES[b.reason];if(!msg)return {send:false,request};";
 const rendered=` const b=request.body;let msg=MESSAGES[b.reason];\n if(b.blockerDiagnostic||!b.reason.startsWith('PROGRESS_')&&b.reason!=='PROCESS_COMPLETE'){\n  if(b.blockerDiagnostic?.itemOrdinal&&!Array.isArray(manifest.items))return {send:false,request};\n  let info;try{info=renderBlockerDiagnostic({reason:b.reason,diagnostic:b.blockerDiagnostic??null,packageId:b.packageId,revision:b.revision,items:manifest.items})}catch{return {send:false,request}}\n  const affected=info.field?'\\nDato afectado: '+info.field+(info.itemOrdinal?' · elemento '+info.itemOrdinal:'')+(info.itemId?' ('+info.itemId+')':''):'';\n  msg='Causa: '+info.cause+affected+'\\n\\nCómo continuar: '+info.action;\n }\n if(!msg)return {send:false,request};`;
 out=replace(out,original,rendered);
 out=replace(out,'return {send:true,chatId:b.chat,text:',"return {send:true,chatId:b.chat,...(b.blockerDiagnostic?{scopeConfirmed:{packageId:b.packageId,revision:b.revision,reason:b.reason,code:b.blockerDiagnostic.code,itemOrdinal:b.blockerDiagnostic.itemOrdinal,owner:b.owner,chat:b.chat}}:{}),text:");
 // Current report transport is READY only. Preview delivery keeps its own
 // existing route and permission checks; its diagnostics can be catalogued but
 // are not allowed to send an OPEN report through this route.
 const formatStart=out.indexOf('function formatTelegramFailure(request,result) {'),formatEnd=out.indexOf('\n}\n',formatStart)+3;
 if(formatStart<0||formatEnd<3)throw Error('BLOCKER_FORMATTER_CHANGED');
 let format=out.slice(formatStart,formatEnd).replace('function formatTelegramFailure(request,result) {','function formatTelegramFailure(request,result,prepared) {');
 const response=" return {httpStatus:200,response:{jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:!sent}}};";
 const attach=` if(request.body.blockerDiagnostic){const d=validateBlockerDiagnostic(request.body.reason,request.body.blockerDiagnostic),spec=blockerDiagnosticSpec(d.code),s=prepared?.scopeConfirmed;const scoped=prepared?.send===true&&s&&s.packageId===request.body.packageId&&s.revision===request.body.revision&&s.reason===request.body.reason&&s.code===d.code&&s.itemOrdinal===d.itemOrdinal&&s.owner===request.body.owner&&s.chat===request.body.chat;if(scoped)data.blocker_diagnostic={schema:'opmx.blocker-diagnostic.v1',code:d.code,field:spec.field,item_ordinal:d.itemOrdinal,scope_confirmed:true};else{data.status='FAILURE_NOT_SENT';data.diagnostic='BLOCKER_SCOPE_NOT_CONFIRMED';}}\n`;
 format=replace(format,response,attach+response.replace('isError:!sent','isError:!sent||data.status===\'FAILURE_NOT_SENT\''));out=out.slice(0,formatStart)+format+out.slice(formatEnd);
 const sentCall="formatTelegramFailure($('Protocolo MCP archivos').first().json.request,$input.first().json)";if(out.includes(sentCall))out=replace(out,sentCall,"formatTelegramFailure($('Protocolo MCP archivos').first().json.request,$input.first().json,$('Preparar aviso de bloqueo').first().json)");
 return '// '+marker+'\n'+blockerDiagnosticSource()+'\n'+out;
}

export function patchBlockerDiagnosticTrackingCode(code){
 if(typeof code!=='string'||code.includes(marker))throw Error('BLOCKER_TRACKING_ALREADY_INSTALLED');
 const stage="stage:d.reason";
 const value="stage:d.blocker_diagnostic?formatBlockerDiagnosticStage(d.reason,{version:1,code:d.blocker_diagnostic.code,itemOrdinal:d.blocker_diagnostic.item_ordinal}):d.reason";
 const statusCheck="d?.status!=='FAILURE_REPORTED'";
 const persistCause="(d?.status!=='FAILURE_REPORTED'&&!(d?.status==='FAILURE_UNCERTAIN'&&d.blocker_diagnostic?.scope_confirmed===true))";
 const patched=replace(replace(code,stage,value),statusCheck,persistCause);
 return '// '+marker+'\n'+blockerDiagnosticSource()+'\n'+patched;
}

export function buildBlockerDiagnosticMcpOperations(graph,expected){
 const base=blockerDiagnosticBase(graph);
 if(base.versionId!==expected?.versionId||Object.entries(base.nodeHashes).some(([name,h])=>h!==expected.nodeHashes?.[name]))throw Error('BLOCKER_MCP_REBASE_REQUIRED');
 return [...names.map(name=>({type:'updateNodeParameters',nodeName:name,parameters:{...one(graph,name).parameters,jsCode:patchBlockerDiagnosticMcpCode(one(graph,name).parameters.jsCode)},replace:true})),{type:'updateNodeParameters',nodeName:'Preparar registro de avance',parameters:{...one(graph,'Preparar registro de avance').parameters,jsCode:patchBlockerDiagnosticTrackingCode(one(graph,'Preparar registro de avance').parameters.jsCode)},replace:true}];
}
