import {buildPreviewOperations} from './build-preview-operations.mjs';

// Prepare operations for the one existing receiver; no operation is applied
// here. The version check is not an n8n compare-and-swap: re-read immediately
// before applying and do not apply if another edit may have intervened.
export function buildReceiverRelease({workflow,scripts,guardCredential,telegramCredential}){
 if(!workflow||workflow.id!=='OSi8AcnzLlI0csRu'||workflow.active!==true||workflow.versionId!=='45bebad0-f9e8-45e0-915e-afe5de7a1ea2'||workflow.activeVersionId!==workflow.versionId||!Array.isArray(workflow.nodes)||!workflow.connections)throw Error('RECEIVER_VERSION_CHANGED');
 const byName=new Map(workflow.nodes.map(x=>[x.name,x]));if(byName.size!==workflow.nodes.length)throw Error('RECEIVER_GRAPH_CHANGED');
 const codeNodes={normalize:'Normalizar entrada Telegram',prepare:'Preparar paquete Telegram',resolve:'Resolver paquete Telegram',seal:'Preparar sellado con cierre acreditado',confirm:'Confirmar operación de paquete Telegram'};
 for(const [key,name] of Object.entries(codeNodes))if(typeof scripts?.[key]!=='string'||!scripts[key].trim()||byName.get(name)?.type!=='n8n-nodes-base.code')throw Error('RECEIVER_GRAPH_CHANGED');
 const operation=byName.get('Operar paquete Telegram');
 if(operation?.type!=='n8n-nodes-base.httpRequest'||operation.parameters?.url!=="={{ 'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/' + $json.next_action }}"||operation.credentials?.httpHeaderAuth?.id!==guardCredential?.id||byName.get('Confirmar recepción Telegram')?.credentials?.telegramApi?.id!==telegramCredential?.id)throw Error('RECEIVER_GRAPH_CHANGED');
 const branches=workflow.connections['¿Cierre acreditado guardado?']?.main;
 if(branches?.[0]?.length!==1||branches[0][0]?.node!=='Sellar paquete con cierre acreditado'||branches?.[1]?.length!==1||branches[1][0]?.node!=='Conservar operación sin sellado')throw Error('RECEIVER_GRAPH_CHANGED');
 const preview=buildPreviewOperations({scripts,guardCredential,telegramCredential});
 if(preview.operations.some(x=>x.type==='addNode'&&byName.has(x.node.name)))throw Error('RECEIVER_GRAPH_CHANGED');
 return {baseVersion:workflow.versionId,operations:[...Object.entries(codeNodes).map(([key,nodeName])=>({type:'updateNodeParameters',nodeName,parameters:{jsCode:scripts[key]}})),{type:'updateNodeParameters',nodeName:'Operar paquete Telegram',parameters:{url:'={{ $json.next_url }}'}},...preview.operations]};
}
