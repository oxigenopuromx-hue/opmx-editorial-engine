// Candidate graph operations for either existing publication workflow. No
// trigger is added and this module does not contact n8n or publish anything.
// Install only after the guard endpoint and writer coverage are verified.
const names={prepare:'Preparar barrera publicación',needs:'¿Reclamar publicación Telegram?',claim:'Reclamar publicación Telegram',check:'Publicación — Reclamo confirmado',pass:'Conservar publicación sin reclamo',failure:'Publicación — Reclamo no confirmado'};
export function buildPublicationOperations({workflow,scripts,guardCredential}){
 if(!workflow||!Array.isArray(workflow.nodes)||!workflow.connections||typeof scripts?.prepare!=='string'||!scripts.prepare||typeof scripts?.check!=='string'||!scripts.check||!guardCredential?.id||!guardCredential?.name)throw Error('PUBLICATION_GRAPH_CONFIGURATION_INCOMPLETE');
 const nodes=new Map(workflow.nodes.map(n=>[n.name,n]));if(nodes.size!==workflow.nodes.length||Object.values(names).some(n=>nodes.has(n)))throw Error('PUBLICATION_GRAPH_CONFLICT');
 for(const n of ['Preflight conjunto publicación','¿Publicar OPURO?','Publicación rechazada antes de publicar'])if(!nodes.has(n))throw Error('PUBLICATION_GRAPH_CHANGED');
 const outs=workflow.connections['Preflight conjunto publicación']?.main;
 if(!Array.isArray(outs)||outs[0]?.length!==1||outs[0][0]?.node!=='¿Publicar OPURO?'||outs[1]?.length!==1||outs[1][0]?.node!=='Publicación rechazada antes de publicar')throw Error('PUBLICATION_GRAPH_CHANGED');
 const rejection=workflow.connections['Publicación rechazada antes de publicar']?.main?.[0];
 if(rejection?.length!==1||!nodes.has(rejection[0].node)||!nodes.has('Protocolo MCP archivos'))throw Error('PUBLICATION_GRAPH_CHANGED');
 const code=(name,js,position)=>({type:'addNode',node:{name,type:'n8n-nodes-base.code',typeVersion:2,position,parameters:{jsCode:js}}});
 const connect=(source,target,sourceIndex=0)=>({type:'addConnection',source,target,sourceIndex});
 const operations=[
  code(names.prepare,scripts.prepare,[3100,-700]),
  {type:'addNode',node:{name:names.needs,type:'n8n-nodes-base.if',typeVersion:2.2,position:[3320,-700],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:'={{ $json.claim_required }}',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}}},
  {type:'addNode',node:{name:names.claim,type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[3540,-760],parameters:{method:'POST',url:'https://publisher.oxigenopuro.com.mx/v1/telegram/publications/begin',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify($json.claim_body) }}',options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},credentials:{httpHeaderAuth:guardCredential}}},
  code(names.check,scripts.check,[3760,-760]),
  code(names.pass,"const p=$input.first().json;if(p?.claim_required!==false||!p.plan)throw Error('PUBLICATION_CLAIM_UNCONFIRMED');return [{json:p.plan}];",[3540,-620]),
  code(names.failure,"const p=$('Preflight conjunto publicación').first(0,0).json,q=$('Protocolo MCP archivos').first().json.request;const r={status:'PUBLICATION_CLAIM_UNCONFIRMED',mode:'PUBLISH',request_id:p.request_id,slug:p.slug,post_ids:Object.fromEntries(Object.entries(p.targets??{}).map(([d,t])=>[d,t.post_id])),publicationWritesStarted:false,draftsMayExist:true,retryPermitted:false,message:'No se confirmó el reclamo de publicación. No se inició la publicación desde este flujo; consulta el guard antes de reintentar.'};return [{json:{httpStatus:200,response:{jsonrpc:'2.0',id:q.id,result:{content:[{type:'text',text:JSON.stringify(r)}],structuredContent:r,isError:true}}}}];",[3760,-500]),
  ...[names.prepare,names.claim,names.check,names.pass].map(nodeName=>({type:'setNodeSettings',nodeName,settings:{retryOnFail:false,onError:'continueErrorOutput'}})),
  {type:'removeConnection',source:'Preflight conjunto publicación',target:'¿Publicar OPURO?',sourceIndex:0},
  connect('Preflight conjunto publicación',names.prepare),connect(names.prepare,names.needs),connect(names.prepare,names.failure,1),
  connect(names.needs,names.claim),connect(names.needs,names.pass,1),connect(names.claim,names.check),connect(names.claim,names.failure,1),
  connect(names.check,'¿Publicar OPURO?'),connect(names.check,names.failure,1),connect(names.pass,'¿Publicar OPURO?'),connect(names.pass,names.failure,1),connect(names.failure,rejection[0].node),
 ];
 return {names,operations};
}
