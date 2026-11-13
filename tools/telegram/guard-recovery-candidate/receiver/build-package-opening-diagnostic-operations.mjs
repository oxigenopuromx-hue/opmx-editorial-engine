import {packageOpeningObservationSource,packageOpeningDiagnosticJson} from './package-opening-observation.mjs';

export const packageOpeningNodes=Object.freeze({http:'Consultar sesión Telegram',resolve:'Resolver paquete Telegram',result:'Resultado piloto Telegram',record:'Registrar resultado recepción Telegram'});
const marker='PACKAGE_OPENING_DIAGNOSTIC_V1';
function once(source,before,after){if(typeof source!=='string'||source.includes(marker)||source.split(before).length!==2)throw Error('OPENING_DIAGNOSTIC_SOURCE_CHANGED');return source.replace(before,after)}
export function patchPackageOpeningResolver(source){
 const before="resolvePackageSession($('Preparar paquete Telegram').first(0,0).json,$input.first().json)";
 return '// '+marker+'\n'+packageOpeningObservationSource()+'\n'+once(source,before,"resolveObservedPackageSession($('Preparar paquete Telegram').first(0,0).json,$input.first().json,resolvePackageSession)");
}
export function patchPackageOpeningReceipt(source){
 const patched=once(source,'work_event_sent:null};return','work_event_sent:null,storage_diagnostic:input.package_operation===\'OPEN\'?packageOpeningReceiptDiagnostic(input.storage_diagnostic):null};return');
 return '// '+marker+'\n'+packageOpeningDiagnosticJson.toString()+`\nfunction packageOpeningReceiptDiagnostic(value){if(typeof value!=='string'||value.length>192)return null;let parsed;try{parsed=JSON.parse(value)}catch{return null}return packageOpeningDiagnosticJson(parsed)}\n`+patched;
}

// Always derive these four parameter edits from the freshly fetched active
// receiver, never from a historical export or an unrelated saved draft.
// The caller must add string column storage_diagnostic to the EXISTING receipt
// table before publishing. Graph, credentials, senders and permissions stay put.
export function buildPackageOpeningDiagnosticOperations(graph){
 if(!Array.isArray(graph?.nodes)||graph.nodes.length!==52||!graph.connections||typeof graph.connections!=='object')throw Error('OPENING_DIAGNOSTIC_GRAPH_CHANGED');
 const nodes=Object.fromEntries(Object.entries(packageOpeningNodes).map(([key,name])=>{
  const found=graph.nodes.filter(n=>n.name===name);if(found.length!==1)throw Error('OPENING_DIAGNOSTIC_NODE_CHANGED');return [key,found[0]];
 }));
 if(nodes.http.type!=='n8n-nodes-base.httpRequest'||nodes.http.parameters?.method!=='POST'||nodes.http.onError!=='continueRegularOutput'||nodes.http.retryOnFail!==false||nodes.http.parameters.options?.timeout!==30000||nodes.http.parameters.options?.redirect?.redirect?.followRedirects!==false)throw Error('OPENING_DIAGNOSTIC_HTTP_CHANGED');
 if(nodes.resolve.type!=='n8n-nodes-base.code'||nodes.result.type!=='n8n-nodes-base.code'||nodes.record.type!=='n8n-nodes-base.dataTable'||nodes.record.parameters.operation!=='upsert'||nodes.record.parameters.columns?.mappingMode!=='defineBelow'||!Array.isArray(nodes.record.parameters.columns.schema)||nodes.record.parameters.columns.schema.some(x=>x.id==='storage_diagnostic'))throw Error('OPENING_DIAGNOSTIC_NODE_CHANGED');
 const response=nodes.http.parameters.options.response?.response;
 if(response?.responseFormat!=='json'||response.fullResponse===true||response.neverError===true)throw Error('OPENING_DIAGNOSTIC_HTTP_CHANGED');
 const http=structuredClone(nodes.http.parameters);http.options.response.response={...response,fullResponse:true,neverError:true};
 const record=structuredClone(nodes.record.parameters);record.columns.value.storage_diagnostic='={{ $json.storage_diagnostic ?? null }}';record.columns.schema.push({id:'storage_diagnostic',displayName:'storage_diagnostic',type:'string'});
 return [
  {type:'updateNodeParameters',nodeName:packageOpeningNodes.http,parameters:http,replace:true},
  {type:'updateNodeParameters',nodeName:packageOpeningNodes.resolve,parameters:{...nodes.resolve.parameters,jsCode:patchPackageOpeningResolver(nodes.resolve.parameters.jsCode)},replace:true},
  {type:'updateNodeParameters',nodeName:packageOpeningNodes.result,parameters:{...nodes.result.parameters,jsCode:patchPackageOpeningReceipt(nodes.result.parameters.jsCode)},replace:true},
  {type:'updateNodeParameters',nodeName:packageOpeningNodes.record,parameters:record,replace:true},
 ];
}
