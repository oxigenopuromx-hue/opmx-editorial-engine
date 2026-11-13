import {createHash} from 'node:crypto';
import {task29CancellationSource} from '../task29-delivery-cancellation-alert.mjs';

export const task29AdminNames=Object.freeze({prepare:'Preparar comprobación de alertas',select:'Seleccionar alertas de administrador',attachPublication:'Conservar comprobación de publicación',publicationObserver:'Comprobar publicación final Guard',prepareRecords:'Preparar conciliaciones confirmadas',expandRecords:'Expandir conciliaciones verificadas',verify:'Verificar conciliación registrada',observeCancellation:'Comprobar cancelación de entrega Guard',attachCancellation:'Conservar comprobación de cancelación'});
const marker='TASK29_MIXED_DELIVERY_CANCELLATION_V1';
const sha=value=>createHash('sha256').update(value).digest('hex');
const once=(source,from,to)=>{if(typeof source!=='string'||source.split(from).length!==2)throw Error('TASK29_ADMIN_SOURCE_CHANGED');return source.replace(from,to)};
const one=(graph,name,type)=>{const nodes=graph?.nodes?.filter(n=>n.name===name);if(nodes?.length!==1||nodes[0].type!==type)throw Error('TASK29_ADMIN_NODE_CHANGED');return nodes[0]};

export function task29CancellationAdminBase(graph){
 if(graph?.id!=='NFOBzPfHmvRjVFOA'||typeof graph.versionId!=='string'||graph.nodes?.length!==16||!graph.connections)throw Error('TASK29_ADMIN_GRAPH_INVALID');
 return {workflowId:graph.id,versionId:graph.versionId,graphHash:sha(JSON.stringify({nodes:graph.nodes,connections:graph.connections,nodeGroups:graph.nodeGroups??[]}))};
}

// The existing Guard publication observer remains unchanged. The new observer
// is a separate authenticated read endpoint on the SAME origin. It receives
// only package/revision; the server fixes owner/request/destination/post/op.
// Both outcomes use the existing five-column insert + strict returned-row ACK.
export function buildTask29CancellationAdminOperations(graph,expected,{observerPath='/v1/telegram/destination-cancellations/observe'}={}){
 const actual=task29CancellationAdminBase(graph),n=task29AdminNames;
 if(!expected||Object.keys(actual).some(k=>actual[k]!==expected[k]))throw Error('TASK29_ADMIN_REBASE_REQUIRED');
 const codeNames=[n.prepare,n.select,n.prepareRecords,n.verify],codes=Object.fromEntries(codeNames.map(name=>[name,one(graph,name,'n8n-nodes-base.code')]));
 if(codeNames.some(name=>codes[name].parameters?.jsCode?.includes(marker)))throw Error('TASK29_ADMIN_ALREADY_INSTALLED');
 if(!codes[n.prepare].parameters?.jsCode?.includes('BOUNDED_BLOCKER_ADMIN_DIAGNOSTICS_V2')||!codes[n.select].parameters?.jsCode?.includes('return renderBlockerAdminBatch(batch.chatId,retained);'))throw Error('TASK29_ADMIN_DIAGNOSTICS_REQUIRED');
 const observer=one(graph,n.publicationObserver,'n8n-nodes-base.httpRequest');one(graph,n.attachPublication,'n8n-nodes-base.code');
 const edge=graph.connections[n.attachPublication]?.main;
 if(edge?.length!==1||edge[0]?.length!==1||edge[0][0].node!==n.prepareRecords||edge[0][0].type!=='main'||edge[0][0].index!==0)throw Error('TASK29_ADMIN_CONNECTION_CHANGED');
 if(graph.nodes.some(node=>[n.observeCancellation,n.attachCancellation].includes(node.name)))throw Error('TASK29_ADMIN_ALREADY_INSTALLED');
 const oldUrl=new URL(observer.parameters.url);
 if(oldUrl.protocol!=='https:'||observerPath!=='/v1/telegram/destination-cancellations/observe'||oldUrl.username||oldUrl.password)throw Error('TASK29_ADMIN_OBSERVER_URL_INVALID');
 const url=new URL(observerPath,oldUrl.origin).toString();
 if(observer.parameters.authentication!=='genericCredentialType'||observer.parameters.genericAuthType!=='httpHeaderAuth'||!observer.credentials?.httpHeaderAuth)throw Error('TASK29_ADMIN_OBSERVER_AUTH_CHANGED');
 const prefix=task29CancellationSource()+'\n';
 let prepare=codes[n.prepare].parameters.jsCode;
 prepare=once(prepare,"reconciliationRows=requestRows.filter(x=>x.stage==='PUBLICATION_RECONCILED');","reconciliationRows=requestRows.filter(x=>x.stage==='PUBLICATION_RECONCILED'||task29CancellationStage(x.stage)!==null);");
 prepare=once(prepare,"const stages=entries.filter(x=>x.stage!=='PUBLICATION_RECONCILED'&&", "const stages=entries.filter(x=>!String(x.stage).startsWith('DELIVERY_CANCELLED_RECONCILED')&&x.stage!=='PUBLICATION_RECONCILED'&&");
 prepare=once(prepare,'if(!persistence.publicationAlertWasReconciled(publicationCandidate,reconciliationRows,{requestRows,nowMs:now}))notices.push(publicationCandidate);','if(!persistence.publicationAlertWasReconciled(publicationCandidate,reconciliationRows,{requestRows,nowMs:now})&&!task29CancellationWasReconciled(publicationCandidate,reconciliationRows,{requestRows,nowMs:now}))notices.push(publicationCandidate);');
 let records=codes[n.prepareRecords].parameters.jsCode;
 records=once(records,'const records=persistence.preparePublicationReconciliations(batch.candidates,observations,{requestRows:batch.requestRows,reconciliationRows:batch.reconciliationRows,nowMs:Date.now()});',`const options={requestRows:batch.requestRows,reconciliationRows:batch.reconciliationRows,nowMs:Date.now()};
const publicationRecords=persistence.preparePublicationReconciliations(batch.candidates,observations,options);
const cancellationObservations=contexts.map(x=>x.cancellationObservation).filter(x=>x&&typeof x==='object');
const cancellationRecords=prepareTask29CancellationReconciliations(batch.candidates,cancellationObservations,options);
const conflicts=new Set(publicationRecords.filter(p=>cancellationRecords.some(c=>c.package_id===p.package_id&&c.revision===p.revision)).map(x=>x.package_id+':'+x.revision));
const records=[...publicationRecords,...cancellationRecords].filter(x=>!conflicts.has(x.package_id+':'+x.revision));`);
 const verify=once(codes[n.verify].parameters.jsCode,'const confirmed=persistence.publicationReconciliationInsertConfirmed(context.reconciliation,row);','const confirmed=persistence.publicationReconciliationInsertConfirmed(context.reconciliation,row)||task29CancellationInsertConfirmed(context.reconciliation,row);');
 let select=codes[n.select].parameters.jsCode;
 select=once(select,'const retained=persistence.retainAlertsWithoutPublicationReconciliation(batch.candidates,[...(batch.reconciliationRows??[]),...persisted],{requestRows:batch.requestRows,nowMs:Date.now()}).filter(candidate=>candidate.alreadyAlerted!==true);','const reconciliationRows=[...(batch.reconciliationRows??[]),...persisted],options={requestRows:batch.requestRows,nowMs:Date.now()};\nconst retained=retainAlertsWithoutTask29Cancellation(persistence.retainAlertsWithoutPublicationReconciliation(batch.candidates,reconciliationRows,options),reconciliationRows,options).filter(candidate=>candidate.alreadyAlerted!==true);');
 const base=observer.position??[0,0];
 const newObserver={...structuredClone(observer),id:'2c902fa7-d4b3-4aef-8bd3-f46105ea4aa0',name:n.observeCancellation,position:[base[0]+224,base[1]+224],parameters:{...structuredClone(observer.parameters),url},retryOnFail:false,onError:'continueRegularOutput',alwaysOutputData:true};
 const attach={id:'3475e7cb-6043-43ce-98a2-691ba16f0794',name:n.attachCancellation,type:'n8n-nodes-base.code',typeVersion:2,position:[base[0]+448,base[1]+224],parameters:{mode:'runOnceForEachItem',jsCode:'const context=$("Conservar comprobación de publicación").item.json;const response=$json,body=response?.body;const matched=response?.statusCode===200&&body?.packageId===context.observe.packageId&&body?.revision===context.observe.revision;return {json:{...context,cancellationObservation:matched?body:null}};'}};
 const connection=(source,target)=>({type:'addConnection',source,target,sourceIndex:0,targetIndex:0,connectionType:'main'});
 return [
  ...[[n.prepare,prepare],[n.prepareRecords,records],[n.verify,verify],[n.select,select]].map(([name,source])=>({type:'updateNodeParameters',nodeName:name,parameters:{...codes[name].parameters,jsCode:prefix+source},replace:true})),
  {type:'addNode',node:newObserver},{type:'addNode',node:attach},
  {type:'removeConnection',source:n.attachPublication,target:n.prepareRecords,sourceIndex:0,targetIndex:0,connectionType:'main'},
  connection(n.attachPublication,n.observeCancellation),connection(n.observeCancellation,n.attachCancellation),connection(n.attachCancellation,n.prepareRecords)
 ];
}
