import {readFileSync} from 'node:fs';

export const alertPersistenceNames=Object.freeze({
 read:'Leer seguimiento para administrador',select:'Seleccionar alertas de administrador',
 prepare:'Preparar comprobación de alertas',condition:'¿Conciliar alerta incierta?',attach:'Conservar comprobación de publicación',
 persistence:'Preparar conciliaciones confirmadas',persistCondition:'¿Guardar conciliación confirmada?',
 expand:'Expandir conciliaciones verificadas',insert:'Registrar publicación conciliada',verify:'Verificar conciliación registrada'
});
const resolution=readFileSync(new URL('../publication-alert-resolution.mjs',import.meta.url),'utf8');
const persistence=readFileSync(new URL('../publication-alert-persistence.mjs',import.meta.url),'utf8');
const embedded=`const persistence=(()=>{\n${resolution.replace(/^export /gm,'')}\n${persistence.replace(/^import .*;\n/gm,'').replace(/^export /gm,'')}\nreturn {publicationAlertRequestId,publicationAlertWasReconciled,preparePublicationReconciliations,publicationReconciliationInsertConfirmed,retainAlertsWithoutPublicationReconciliation};\n})();`;
const signature="JSON.stringify({chatId:batch.chatId,candidates:batch.candidates,requestRows:batch.requestRows,reconciliationRows:batch.reconciliationRows})";

// Upgrade the existing eleven-node monitor. The administrator, schedule,
// sender, Guard credentials and read table remain in the supplied private
// graph. Reconciliation uses five existing technical columns, never a new
// table/credential or a fabricated Motor completion. Generate only operations.
export function buildPublicationAlertPersistenceOperations(graph){
 const n=alertPersistenceNames;
 if(!Array.isArray(graph?.nodes)||!graph?.connections)throw Error('ALERT_PERSISTENCE_GRAPH_INVALID');
 const one=name=>{const found=graph.nodes.filter(x=>x.name===name);if(found.length!==1)throw Error('ALERT_PERSISTENCE_NODE_MISSING');return found[0]};
 const prepareNode=one(n.prepare),selectNode=one(n.select),reader=one(n.read);one(n.condition);one(n.attach);
 const insertTemplate=one('Registrar alertas confirmadas');
 if(prepareNode.type!=='n8n-nodes-base.code'||selectNode.type!=='n8n-nodes-base.code'||reader.type!=='n8n-nodes-base.dataTable'||insertTemplate.type!=='n8n-nodes-base.dataTable'||insertTemplate.parameters?.operation!=='insert'||typeof insertTemplate.parameters?.dataTableId?.value!=='string'||JSON.stringify(reader.parameters?.dataTableId)!==JSON.stringify(insertTemplate.parameters.dataTableId))throw Error('ALERT_PERSISTENCE_GRAPH_CHANGED');
 const direct=(source,target,index)=>{const outputs=graph.connections[source]?.main;if(!Array.isArray(outputs)||outputs[index]?.length!==1||outputs[index][0].node!==target||outputs[index][0].type!=='main'||outputs[index][0].index!==0)throw Error('ALERT_PERSISTENCE_CONNECTION_CHANGED');};
 direct(n.attach,n.select,0);direct(n.condition,n.select,1);
 for(const name of [n.persistence,n.persistCondition,n.expand,n.insert,n.verify])if(graph.nodes.some(x=>x.name===name))throw Error('ALERT_PERSISTENCE_ALREADY_INSTALLED');
 const old=prepareNode.parameters?.jsCode,startMarker='const selected=(()=>{\n',endMarker='\n})();\nif(!Array.isArray(selected)';
 if(typeof old!=='string'||old.split(startMarker).length!==2||old.split(endMarker).length!==2)throw Error('ALERT_PERSISTENCE_PREPARATION_CHANGED');
 let captured=old.slice(old.indexOf(startMarker)+startMarker.length,old.indexOf(endMarker));
 const stageMarker="filter(x=>x.stage!=='ROUTING'",sourceMarker='sourceOccurredAt:last.occurred_at,';
 const dedupMarker="if(!last||last.stage==='PROCESS_COMPLETE'||entries.some(x=>x.stage==='ALERT_ADMIN_'+last.id))continue;";
 const sortMarker='notices.sort((a,b)=>a.package_id.localeCompare(b.package_id)||a.revision-b.revision);';
 if(captured.split(stageMarker).length!==2||captured.split(sourceMarker).length!==2||captured.split(dedupMarker).length!==2||captured.split(sortMarker).length!==2)throw Error('ALERT_PERSISTENCE_SELECTOR_CHANGED');
 captured=captured.replace(stageMarker,"filter(x=>x.stage!=='PUBLICATION_RECONCILED'&&x.stage!=='ROUTING'").replace(sourceMarker,sourceMarker+"sourceRequestId:last.request_id??null,alreadyAlerted:publicationAlreadyAlerted,");
 // Already notified publication uncertainty still needs observation so a
 // later final receipt can be reconciled durably. Its notification remains
 // deduplicated even if the observation/INSERT is unavailable again.
 captured=captured.replace(dedupMarker,"if(!last||last.stage==='PROCESS_COMPLETE')continue;const publicationAlreadyAlerted=entries.some(x=>x.stage==='ALERT_ADMIN_'+last.id);if(publicationAlreadyAlerted&&!['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN'].includes(last.stage))continue;");
 captured=captured.replace('const failures={',"const failures={PUBLISH_UNCERTAIN:'Resultado de Publisher incierto',");
 captured=captured.replace(sortMarker,'notices.sort((a,b)=>Number(a.alreadyAlerted===true)-Number(b.alreadyAlerted===true)||a.package_id.localeCompare(b.package_id)||a.revision-b.revision);');
 const pushes=captured.split('\n').filter(line=>line.trim().startsWith('notices.push({'));
 if(pushes.length!==1||!pushes[0].trim().endsWith(');'))throw Error('ALERT_PERSISTENCE_SELECTOR_CHANGED');
 // Filter before the twenty-row cap, so already reconciled revisions cannot
 // indefinitely crowd real unresolved failures out of the same batch.
 const replacement=pushes[0].replace('notices.push(','const publicationCandidate=').replace(/\);$/,";if(!persistence.publicationAlertWasReconciled(publicationCandidate,reconciliationRows,{requestRows,nowMs:now}))notices.push(publicationCandidate);");
 captured=captured.replace(pushes[0],replacement);
 const prepare=`${embedded}\nconst requestRows=$input.all().map(x=>x.json),reconciliationRows=requestRows.filter(x=>x.stage==='PUBLICATION_RECONCILED');\nconst selected=(()=>{\n${captured}\n})();\nif(!Array.isArray(selected)||selected.length>1)throw Error('ALERT_BATCH_UNCONFIRMED');\nif(!selected.length)return [];\nconst batch=selected[0].json,candidates=batch?.alerts;if(typeof batch?.chat_id!=='string'||!Array.isArray(candidates)||!candidates.length||candidates.length>20)throw Error('ALERT_BATCH_UNCONFIRMED');\nconst identities=new Set(candidates.map(x=>x.package_id+':'+x.revision));\nconst correlations=requestRows.filter(x=>identities.has(x.package_id+':'+x.revision)&&String(x.stage).startsWith('REQUEST_')).map(x=>({package_id:x.package_id,revision:x.revision,stage:x.stage,request_id:x.request_id}));\nreturn [{json:{chatId:batch.chat_id,candidates,requestRows:correlations,reconciliationRows:reconciliationRows.filter(x=>identities.has(x.package_id+':'+x.revision)),needsObservation:candidates.some(x=>['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN'].includes(x.sourceStage))}}];`;
 const preparePersistence=`${embedded}\nconst contexts=$input.all().map(x=>x.json);if(!contexts.length)return [];const batch=contexts[0],signature=${signature};\nif(contexts.some(batch=>${signature}!==signature))throw Error('ALERT_BATCH_CONTEXT_MISMATCH');\nconst observations=contexts.map(x=>x.observation).filter(x=>x&&typeof x==='object');\nconst records=persistence.preparePublicationReconciliations(batch.candidates,observations,{requestRows:batch.requestRows,reconciliationRows:batch.reconciliationRows,nowMs:Date.now()});\nreturn [{json:{...batch,reconciliationRecords:records,needsPersistence:records.length>0}}];`;
 const expand='const batch=$input.first().json;return batch.reconciliationRecords.map(reconciliation=>({json:{...batch,reconciliation},pairedItem:{item:0}}));';
 const verify=`${embedded}\nconst context=$(${JSON.stringify(n.expand)}).item.json,row=$json;\nconst confirmed=persistence.publicationReconciliationInsertConfirmed(context.reconciliation,row);\nreturn {json:{...context,persistedReconciliations:confirmed?[row]:[],persistenceConfirmed:confirmed}};`;
 const render=`${embedded}\nconst contexts=$input.all().map(x=>x.json);if(!contexts.length)return [];const batch=contexts[0],signature=${signature};\nif(contexts.some(batch=>${signature}!==signature))throw Error('ALERT_BATCH_CONTEXT_MISMATCH');\nconst persisted=contexts.flatMap(x=>Array.isArray(x.persistedReconciliations)?x.persistedReconciliations:[]);\nconst retained=persistence.retainAlertsWithoutPublicationReconciliation(batch.candidates,[...(batch.reconciliationRows??[]),...persisted],{requestRows:batch.requestRows,nowMs:Date.now()}).filter(candidate=>candidate.alreadyAlerted!==true);\nif(!retained.length)return [];\nconst alerts=retained.map(({sourceStage,sourceOccurredAt,sourceRequestId,alreadyAlerted,...alert})=>alert);\nconst text='OPMX · alerta de administrador\\n\\n'+alerts.map((x,i)=>(i+1)+'. '+x.summary+'\\n'+x.origin+' · paquete '+x.package_id+' · versión '+x.revision).join('\\n\\n')+'\\n\\nRevisa el estado antes de reintentar; una demora o un resultado incierto no confirma que se haya publicado.';\nreturn [{json:{chat_id:batch.chatId,text,alerts}}];`;
 const base=Array.isArray(selectNode.position)?selectNode.position:[1568,0];
 const ids=['7ac67881-3a9a-494e-a397-b67c1755e6cc','d1c66df3-6888-40c2-8b0e-bd7bda27c14b','55f7fed4-cbd8-40d8-b3c0-6cf5016f867b','e6c6f5eb-fbfc-4ce7-83bf-f8c2257b3a89','4ed3bc47-2195-49fe-8c6e-79422b6e2152'];
 const node=(name,type,typeVersion,parameters,i)=>({id:ids[i],name,type,typeVersion,position:[base[0]+i*224,base[1]],parameters});
 const fields=['package_id','revision','stage','occurred_at','request_id'];
 const schema=fields.map(id=>({id,displayName:id,required:false,display:true,defaultMatch:false,type:id==='revision'?'number':id==='occurred_at'?'date':'string',canBeUsedToMatch:true}));
 const nodes=[
  node(n.persistence,'n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:preparePersistence},0),
  node(n.persistCondition,'n8n-nodes-base.if',2.2,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:'={{ $json.needsPersistence }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},1),
  node(n.expand,'n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:expand},2),
  node(n.insert,'n8n-nodes-base.dataTable',1.1,{resource:'row',operation:'insert',dataTableId:structuredClone(insertTemplate.parameters.dataTableId),columns:{mappingMode:'defineBelow',value:Object.fromEntries(fields.map(id=>[id,'={{ $json.reconciliation.'+id+' }}'])),schema},options:{optimizeBulk:false}},3),
  node(n.verify,'n8n-nodes-base.code',2,{mode:'runOnceForEachItem',jsCode:verify},4)
 ];
 const connect=(source,target,sourceIndex=0)=>({type:'addConnection',source,target,sourceIndex,targetIndex:0,connectionType:'main'});
 return [
  {type:'removeConnection',source:n.attach,target:n.select,sourceIndex:0,targetIndex:0,connectionType:'main'},
  {type:'removeConnection',source:n.condition,target:n.select,sourceIndex:1,targetIndex:0,connectionType:'main'},
  ...nodes.map(node=>({type:'addNode',node})),
  {type:'setNodeSettings',nodeName:n.insert,settings:{retryOnFail:false,onError:'continueRegularOutput',alwaysOutputData:true}},
  connect(n.attach,n.persistence),connect(n.condition,n.persistence,1),connect(n.persistence,n.persistCondition),connect(n.persistCondition,n.expand,0),connect(n.persistCondition,n.select,1),connect(n.expand,n.insert),connect(n.insert,n.verify),connect(n.verify,n.select),
  {type:'updateNodeParameters',nodeName:n.prepare,parameters:{mode:'runOnceForAllItems',jsCode:prepare},replace:true},
  {type:'updateNodeParameters',nodeName:n.select,parameters:{mode:'runOnceForAllItems',jsCode:render},replace:true},
  {type:'setNodePosition',nodeName:n.select,position:[base[0]+5*224,base[1]]}
 ];
}
