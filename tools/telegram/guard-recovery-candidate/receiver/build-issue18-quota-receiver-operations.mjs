import {formatQuotaDiagnosticText} from '../package-quota-diagnostic.mjs';

export const issue18QuotaReceiverNodes=Object.freeze({resolve:'Resolver paquete Telegram',confirm:'Confirmar operación de paquete Telegram'});
const marker='ISSUE18_CLOSE_QUOTA_V1';
const generic='El paquete o el almacenamiento piloto alcanzó su límite. No se guardó este mensaje.';
function once(source,before,after){if(typeof source!=='string'||source.includes(marker)||source.split(before).length!==2)throw Error('ISSUE18_QUOTA_RECEIVER_SOURCE_CHANGED');return source.replace(before,after)}

export function patchIssue18OpenQuotaResolver(source){
 const before="const reply=replies[diagnostic.code]??";
 const after="const quotaReply=diagnostic.code==='OPEN_QUOTA_EXCEEDED'&&observation.body?.quotaDiagnostic?.operation==='OPEN'?formatQuotaDiagnosticText(observation.body.quotaDiagnostic):null;\n const reply=quotaReply??replies[diagnostic.code]??";
 return '// '+marker+'\n'+formatQuotaDiagnosticText.toString()+'\n'+once(source,before,after);
}

export function patchIssue18QuotaConfirmation(source){
 const before="if(result?.status==='QUOTA_EXCEEDED')return response(context,'"+generic+"');";
 const after="if(result?.status==='QUOTA_EXCEEDED')return response(context,formatQuotaDiagnosticText(result.quotaDiagnostic)??'"+generic+"');";
 return '// '+marker+'\n'+formatQuotaDiagnosticText.toString()+'\n'+once(source,before,after);
}

// Parameter-only diagnostics built from the live 52-node Receiver. The parent
// atomic-close builder changes routing and prepareSeal separately. Apply these
// edits to an intermediate graph, then compose the atomic resolver patch.
export function buildIssue18QuotaReceiverOperations(graph){
 if(!Array.isArray(graph?.nodes)||graph.nodes.length!==52||!graph.connections||typeof graph.connections!=='object')throw Error('ISSUE18_QUOTA_RECEIVER_GRAPH_CHANGED');
 return [[issue18QuotaReceiverNodes.resolve,patchIssue18OpenQuotaResolver],[issue18QuotaReceiverNodes.confirm,patchIssue18QuotaConfirmation]].map(([name,patch])=>{
  const found=graph.nodes.filter(node=>node.name===name);
  if(found.length!==1||found[0].type!=='n8n-nodes-base.code'||typeof found[0].parameters?.jsCode!=='string')throw Error('ISSUE18_QUOTA_RECEIVER_NODE_CHANGED');
  return {type:'updateNodeParameters',nodeName:name,parameters:{...found[0].parameters,jsCode:patch(found[0].parameters.jsCode)},replace:true};
 });
}
