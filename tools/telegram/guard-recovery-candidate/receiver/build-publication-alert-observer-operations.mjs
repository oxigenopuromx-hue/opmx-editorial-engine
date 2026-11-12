import {readFileSync} from 'node:fs';
import {shouldSuppressUncertainPublicationAlert} from '../publication-alert-resolution.mjs';

export const alertObserverNames=Object.freeze({
 read:'Leer seguimiento para administrador',select:'Seleccionar alertas de administrador',
 prepare:'Preparar comprobación de alertas',condition:'¿Conciliar alerta incierta?',
 expand:'Expandir comprobaciones inciertas',http:'Comprobar publicación final Guard',
 attach:'Conservar comprobación de publicación'
});
const endpoint='https://publisher.oxigenopuro.com.mx/v1/telegram/publications/observe-final';
const ids=['ec64d47b-58ad-4a22-8d97-4937234937a1','2d5f738e-fdf6-49e1-9ac9-b1b5bc5e8466','744d8286-3976-4f87-ac5c-3ec5b89a8aad','84208121-ff0b-4183-8e0e-30704e0fdc28','e86a03c8-6d99-44a7-a6a3-85e78d4e1d5a'];
const resolverSource=readFileSync(new URL('../publication-alert-resolution.mjs',import.meta.url),'utf8');
if(!resolverSource.includes('export function '+shouldSuppressUncertainPublicationAlert.name+'(')||/^import /m.test(resolverSource))throw Error('ALERT_RESOLVER_SOURCE_CHANGED');
const embeddedResolver=`const resolution=(()=>{\n${resolverSource.replace(/^export /gm,'')}\nreturn {shouldSuppressUncertainPublicationAlert,retainUnresolvedPublicationAlerts};\n})();`;

// Produces operations only. The supplied original graph remains private and
// unchanged. In particular its configured administrator stays in the generated
// draft, not in this builder or repository fixtures. No credentials are created.
export function buildPublicationAlertObserverOperations(graph,{credential}={}){
 const n=alertObserverNames;
 if(!Array.isArray(graph?.nodes)||!graph?.connections||!credential||typeof credential.id!=='string'||!credential.id||typeof credential.name!=='string'||!credential.name)throw Error('ALERT_OBSERVER_CONFIGURATION_INVALID');
 const one=name=>{const nodes=graph.nodes.filter(x=>x.name===name);if(nodes.length!==1)throw Error('ALERT_OBSERVER_NODE_MISSING');return nodes[0]};
 const reader=one(n.read),selector=one(n.select);
 if(reader.type!=='n8n-nodes-base.dataTable'||selector.type!=='n8n-nodes-base.code'||typeof selector.parameters?.jsCode!=='string')throw Error('ALERT_OBSERVER_GRAPH_CHANGED');
 const outgoing=graph.connections[n.read]?.main;
 if(outgoing?.length!==1||outgoing[0]?.length!==1||outgoing[0][0].node!==n.select||outgoing[0][0].index!==0||outgoing[0][0].type!=='main')throw Error('ALERT_OBSERVER_CONNECTION_CHANGED');
 for(const name of [n.prepare,n.condition,n.expand,n.http,n.attach])if(graph.nodes.some(x=>x.name===name))throw Error('ALERT_OBSERVER_ALREADY_INSTALLED');
 const marker="stage:'ALERT_ADMIN_'+last.id,";
 const old=selector.parameters.jsCode;
 if(old.split(marker).length!==2||!old.includes('notices.slice(0,20)')||!old.includes('return [{json:'))throw Error('ALERT_OBSERVER_SELECTOR_CHANGED');
 const captured=old.replace(marker,marker+'sourceStage:last.stage,sourceOccurredAt:last.occurred_at,');
 const prepare=`const requestRows=$input.all().map(x=>x.json);\nconst selected=(()=>{\n${captured}\n})();\nif(!Array.isArray(selected)||selected.length>1)throw Error('ALERT_BATCH_UNCONFIRMED');\nif(!selected.length)return [];\nconst selectedBatch=selected[0].json,candidates=selectedBatch?.alerts;\nif(typeof selectedBatch?.chat_id!=='string'||!Array.isArray(candidates)||!candidates.length||candidates.length>20)throw Error('ALERT_BATCH_UNCONFIRMED');\nconst identities=new Set(candidates.map(x=>x.package_id+':'+x.revision));\nconst correlations=requestRows.filter(x=>identities.has(x.package_id+':'+x.revision)&&String(x.stage).startsWith('REQUEST_')).map(x=>({package_id:x.package_id,revision:x.revision,stage:x.stage,request_id:x.request_id}));\nreturn [{json:{chatId:selectedBatch.chat_id,candidates,requestRows:correlations,needsObservation:candidates.some(x=>['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN'].includes(x.sourceStage))}}];`;
 const expand="const batch=$input.first().json;return batch.candidates.filter(x=>['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN'].includes(x.sourceStage)).map(x=>({json:{...batch,observe:{packageId:x.package_id,revision:x.revision}},pairedItem:{item:0}}));";
 const attach=`const context=$(${JSON.stringify(n.expand)}).item.json;const response=$json,body=response?.body;const matched=response?.statusCode===200&&body?.packageId===context.observe.packageId&&body?.revision===context.observe.revision;return {json:{...context,observation:matched?body:null}};`;
 const render=`${embeddedResolver}\nconst contexts=$input.all().map(x=>x.json);if(!contexts.length)return [];\nconst batch=contexts[0],signature=JSON.stringify({chatId:batch.chatId,candidates:batch.candidates,requestRows:batch.requestRows});\nif(contexts.some(x=>JSON.stringify({chatId:x.chatId,candidates:x.candidates,requestRows:x.requestRows})!==signature))throw Error('ALERT_BATCH_CONTEXT_MISMATCH');\nconst observations=contexts.map(x=>x.observation).filter(x=>x&&typeof x==='object');\nconst retained=resolution.retainUnresolvedPublicationAlerts(batch.candidates,observations,{requestRows:batch.requestRows,nowMs:Date.now()});\nif(!retained.length)return [];\nconst alerts=retained.map(({sourceStage,sourceOccurredAt,...alert})=>alert);\nconst text='OPMX · alerta de administrador\\n\\n'+alerts.map((x,i)=>(i+1)+'. '+x.summary+'\\n'+x.origin+' · paquete '+x.package_id+' · versión '+x.revision).join('\\n\\n')+'\\n\\nRevisa el estado antes de reintentar; una demora o un resultado incierto no confirma que se haya publicado.';\nreturn [{json:{chat_id:batch.chatId,text,alerts}}];`;
 const base=Array.isArray(selector.position)?selector.position:[448,0];
 const node=(name,type,typeVersion,parameters,index)=>({id:ids[index],name,type,typeVersion,position:[base[0]+index*224,base[1]],parameters});
 const nodes=[
  node(n.prepare,'n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:prepare},0),
  node(n.condition,'n8n-nodes-base.if',2.2,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:'={{ $json.needsObservation }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},1),
  node(n.expand,'n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:expand},2),
  {...node(n.http,'n8n-nodes-base.httpRequest',4.5,{method:'POST',url:endpoint,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify({packageId:$json.observe.packageId,revision:$json.observe.revision}) }}',options:{timeout:30000,batching:{batch:{batchSize:1,batchInterval:0}},redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,responseFormat:'json',neverError:true}}}},3),credentials:{httpHeaderAuth:{id:credential.id,name:credential.name}}},
  node(n.attach,'n8n-nodes-base.code',2,{mode:'runOnceForEachItem',jsCode:attach},4)
 ];
 const connect=(source,target,sourceIndex=0)=>({type:'addConnection',source,target,sourceIndex,targetIndex:0,connectionType:'main'});
 return [
  {type:'removeConnection',source:n.read,target:n.select,sourceIndex:0,targetIndex:0,connectionType:'main'},
  ...nodes.map(node=>({type:'addNode',node})),
  {type:'setNodeSettings',nodeName:n.http,settings:{retryOnFail:false,onError:'continueRegularOutput'}},
  connect(n.read,n.prepare),connect(n.prepare,n.condition),connect(n.condition,n.expand,0),connect(n.condition,n.select,1),connect(n.expand,n.http),connect(n.http,n.attach),connect(n.attach,n.select),
  {type:'updateNodeParameters',nodeName:n.select,parameters:{mode:'runOnceForAllItems',jsCode:render},replace:true},
  {type:'setNodePosition',nodeName:n.select,position:[base[0]+5*224,base[1]]}
 ];
}
