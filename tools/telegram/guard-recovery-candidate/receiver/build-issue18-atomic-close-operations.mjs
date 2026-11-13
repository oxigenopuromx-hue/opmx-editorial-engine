import {buildIssue18QuotaReceiverOperations} from './build-issue18-quota-receiver-operations.mjs';

export function prepareAtomicPackageClose(context,response){
 const fail=()=>({seal_requested:false,passthrough:{status:'CLOSE_NOT_CONFIRMED'}});
 if(!context?.seal_after_close)return {seal_requested:false,passthrough:response};
 if(response?.status==='NOT_READY'||response?.status==='QUOTA_EXCEEDED')return {seal_requested:false,passthrough:response};
 const receipt=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/.exec(response?.receiptId??'');
 const current=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/.exec(context.receipt_id??'');
 if(response?.status!=='CLOSE_COMPLETED'||response.packageId!==context.packageId||!Number.isSafeInteger(response.revision)||response.revision<1||typeof response.replayed!=='boolean'||response.recovery!==(context.recovery_session===true)||!receipt||receipt[1]!==context.chat_id||!current||current[1]!==context.chat_id||!Number.isSafeInteger(context.message_id)||String(context.message_id)!==String(Number(current[2]))||context.user_id!==context.chat_id)return fail();
 if(response.replayed?(BigInt(receipt[2])>BigInt(current[2])):response.receiptId!==context.receipt_id)return fail();
 if(Number.isSafeInteger(context.package_revision)&&response.revision<context.package_revision)return fail();
 const r=response.result;
 if(!response.recovery){
  if(r?.status!=='READY'||r.packageId!==context.packageId||r.revision!==response.revision)return fail();
  return {seal_requested:false,passthrough:r};
 }
 if(r?.status==='PREVIEW_DELIVERY_UNCERTAIN'&&response.replayed===true&&r.retryPermitted===false)return {seal_requested:false,passthrough:{status:'PREVIEW_DELIVERY_UNCERTAIN'}};
 if(!['PREVIEW_READY','PREVIEW_EXISTS','PREVIEW_GENERATION_REQUESTED'].includes(r?.status))return fail();
 if(r.status!=='PREVIEW_GENERATION_REQUESTED'&&(r.preview?.packageId!==context.packageId||r.preview.revision!==response.revision||!/^[a-f0-9]{64}$/.test(r.preview.previewHash??'')))return fail();
 return {seal_requested:false,preview_requested:true,preview_body:{owner:context.user_id,chat:context.chat_id,packageId:context.packageId,revision:response.revision,receiptId:response.receiptId},preview_response:r};
}

const marker='ISSUE18_ATOMIC_CLOSE_V1';
const nodeNames={prepare:'Preparar sellado con cierre acreditado',preview:'Solicitar vista de recuperación',identity:'Preparar identidad de vista',branch:'¿Solicitar vista de recuperación?',confirm:'Confirmar operación de paquete Telegram'};
export function buildIssue18AtomicCloseReceiverOperations(graph){
 const quota=buildIssue18QuotaReceiverOperations(graph);
 const resolve=quota.find(o=>o.nodeName==='Resolver paquete Telegram');
 const replaceOnce=(source,before,after)=>{if(source.split(before).length!==2)throw Error('ATOMIC_CLOSE_RECEIVER_SOURCE_CHANGED');return source.replace(before,after)};
 resolve.parameters.jsCode=replaceOnce(resolve.parameters.jsCode,"else if(x.package_operation==='SEAL'){action='reserve';","else if(x.package_operation==='SEAL'){action='close';");
 resolve.parameters.jsCode=replaceOnce(resolve.parameters.jsCode,"const paths={reserve:'packages/reserve',","const paths={close:'packages/close',reserve:'packages/reserve',");
 const one=name=>{const ns=graph.nodes.filter(n=>n.name===name);if(ns.length!==1)throw Error('ATOMIC_CLOSE_RECEIVER_NODE_CHANGED');return ns[0]};
 const prepare=one(nodeNames.prepare),preview=one(nodeNames.preview),confirm=one(nodeNames.confirm);
 if(prepare.type!=='n8n-nodes-base.code'||preview.type!=='n8n-nodes-base.httpRequest'||preview.parameters?.url!=='https://publisher.oxigenopuro.com.mx/v1/telegram/corrections/preview'||preview.retryOnFail!==false)throw Error('ATOMIC_CLOSE_RECEIVER_GRAPH_CHANGED');
 const incoming=[];for(const [source,connections]of Object.entries(graph.connections))for(const [index,edges]of (connections.main??[]).entries())for(const edge of edges??[])if(edge.node===preview.name)incoming.push({source,index,edge});
 const outgoing=graph.connections[preview.name]?.main?.[0];
 if(incoming.length!==1||incoming[0].source!==nodeNames.branch||incoming[0].index!==0||outgoing?.length!==1||outgoing[0].node!==nodeNames.identity)throw Error('ATOMIC_CLOSE_RECEIVER_CONNECTION_CHANGED');
 const qConfirm=quota.find(o=>o.nodeName===confirm.name);
 const before=" if(context.package_operation==='SEAL') {";
 if(qConfirm.parameters.jsCode.split(before).length!==2)throw Error('ATOMIC_CLOSE_RECEIVER_FORMAT_CHANGED');
 qConfirm.parameters.jsCode=qConfirm.parameters.jsCode.replace(before,before+"\n  if(result?.status==='QUOTA_EXCEEDED')return response(context,formatQuotaDiagnosticText(result.quotaDiagnostic)??'El paquete o el almacenamiento piloto alcanzó su límite. No se guardó este mensaje.');\n  if(result?.status==='PREVIEW_DELIVERY_UNCERTAIN')return response(context,'La solicitud de vista ya está guardada, pero su entrega es incierta. No se repitió el envío. Consulta /estado antes de continuar.');");
 return [...quota,
  {type:'updateNodeParameters',nodeName:prepare.name,parameters:{...prepare.parameters,jsCode:'// '+marker+'\n'+prepareAtomicPackageClose.toString()+"\nreturn [{json:prepareAtomicPackageClose($('Resolver paquete Telegram').first(0,0).json,$input.first().json)}];"},replace:true},
  {type:'removeNode',nodeName:preview.name},
  {type:'addNode',node:{id:preview.id,name:preview.name,type:'n8n-nodes-base.code',typeVersion:2,position:preview.position,notes:'La vista ya quedó registrada con el control en la misma transacción Guard. Este paso sólo conserva esa respuesta.',parameters:{mode:'runOnceForAllItems',jsCode:'// '+marker+"\nconst p=$input.first().json;if(p.preview_requested!==true||!p.preview_response)throw Error('ATOMIC_PREVIEW_RESPONSE_UNCONFIRMED');return [{json:p.preview_response}];"}}},
  {type:'addConnection',source:nodeNames.branch,target:preview.name,sourceIndex:0,targetIndex:0,connectionType:'main'},
  {type:'addConnection',source:preview.name,target:nodeNames.identity,sourceIndex:0,targetIndex:0,connectionType:'main'},
  ...((graph.nodeGroups??[]).length?[{type:'setNodeGroups',nodeGroups:structuredClone(graph.nodeGroups)}]:[]),
 ];
}
