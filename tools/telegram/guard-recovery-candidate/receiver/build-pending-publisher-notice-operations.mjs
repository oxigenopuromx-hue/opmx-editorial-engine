import {pendingPublisherNoticeHeading} from '../pending-publisher-notice.mjs';

export const pendingPublisherNoticeNodes=Object.freeze(['Protocolo MCP archivos','Preparar aviso de bloqueo','Resultado de bloqueo Telegram','Bloqueo no confirmado']);
const dynamic="b.reason.startsWith('PROGRESS_')?'avance':b.reason==='PROCESS_COMPLETE'?'resultado':'proceso detenido'";
const fixed=String.raw`OPMX · proceso detenido\n\n${'${msg}'}`;
const declaration=pendingPublisherNoticeHeading.toString();

// Also usable against the repository's canonical protocol source. All generated
// live operations remain private: the caller supplies the fresh active graph.
// No message body, recipients, reason enum, receipts or permissions are changed.
export function patchPendingPublisherHeadingCode(code){
 if(typeof code!=='string'||code.includes('function pendingPublisherNoticeHeading('))throw Error('PENDING_PUBLISHER_NOTICE_ALREADY_CHANGED');
 const dynamicCount=code.split(dynamic).length-1,fixedCount=code.split(fixed).length-1;
 if(dynamicCount+fixedCount!==1)throw Error('PENDING_PUBLISHER_NOTICE_SOURCE_CHANGED');
 const patched=dynamicCount?code.replace(dynamic,`pendingPublisherNoticeHeading(b.reason,${dynamic})`):code.replace(fixed,String.raw`OPMX · ${'${pendingPublisherNoticeHeading(b.reason,\'proceso detenido\')}' }\n\n${'${msg}'}`);
 return declaration+'\n'+patched;
}

export function buildPendingPublisherNoticeOperations(graph){
 if(!Array.isArray(graph?.nodes))throw Error('PENDING_PUBLISHER_NOTICE_GRAPH_INVALID');
 return pendingPublisherNoticeNodes.map(name=>{
  const nodes=graph.nodes.filter(n=>n.name===name);
  if(nodes.length!==1||nodes[0].type!=='n8n-nodes-base.code'||typeof nodes[0].parameters?.jsCode!=='string')throw Error('PENDING_PUBLISHER_NOTICE_NODE_MISSING');
  return {type:'updateNodeParameters',nodeName:name,parameters:{jsCode:patchPendingPublisherHeadingCode(nodes[0].parameters.jsCode)},replace:false};
 });
}
