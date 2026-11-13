import {createHash} from 'node:crypto';
import {placementProvenanceSource} from '../../../editorial/placement-provenance.mjs';
const marker='EDITORIAL_PLACEMENT_GUARD_GATE_V1';
const sha=x=>createHash('sha256').update(x).digest('hex');
const edge=(type,source,target,sourceIndex=0)=>({type,source,target,sourceIndex,targetIndex:0,connectionType:'main'});
const one=(g,name)=>{const matches=g.nodes.filter(n=>n.name===name);if(matches.length!==1)throw Error('PLACEMENT_GATE_NODE_CHANGED');return matches[0]};

export function buildPlacementWriterGateOperations(graph,expected,{kind}) {
 if(!['shared','mcp'].includes(kind)||graph?.id!==(kind==='shared'?'4o7K5TmKc7joScqB':'bnzVMNkZuGO1GQCZ')||!graph?.nodes||!graph.connections||graph.versionId!==expected?.versionId)throw Error('PLACEMENT_GATE_REBASE_REQUIRED');
 for(const [name,hash]of Object.entries(expected.nodeHashes??{}))if(sha(JSON.stringify(one(graph,name).parameters))!==hash)throw Error('PLACEMENT_GATE_REBASE_REQUIRED');
 const shared=kind==='shared',prefix=shared?'Colocación Shared':'Colocación MCP',names={prepare:prefix+' — Preparar prueba',http:prefix+' — Consultar Guard',verify:prefix+' — Verificar procedencia'};
 if(Object.values(names).some(name=>graph.nodes.some(n=>n.name===name)))throw Error('PLACEMENT_GATE_ALREADY_INSTALLED');
 const source=one(graph,shared?'Validar y normalizar OPMX MASTER':'Entregar paquete sin enlaces'),next=graph.connections[source.name]?.main?.[0];
 if(next?.length!==1||next[0].index!==0||next[0].type!=='main'||next[0].node!==(shared?'Literal — Preparar control de escritura':'Envío Telegram — Preparar aceptación'))throw Error('PLACEMENT_GATE_ORDER_CHANGED');
 const credentialNode=one(graph,shared?'OPMX — Reservar preflight':'Envío Telegram — Registrar aceptación Guard');
 if(credentialNode.type!=='n8n-nodes-base.httpRequest'||credentialNode.parameters?.genericAuthType!=='httpHeaderAuth'||!String(credentialNode.parameters.url).startsWith('https://publisher.oxigenopuro.com.mx/')||!credentialNode.credentials?.httpHeaderAuth?.id)throw Error('PLACEMENT_GATE_GUARD_CREDENTIAL_UNCONFIRMED');
 const prepare='// '+marker+'\n'+placementProvenanceSource()+`\nconst item=$input.first(),original=item.json;\n`+(shared?`const input=prepareEditorialPlacementCheck(original.execution?.request_id,original.original,original.execution?.create_opuro===true);`:`const request=$('Protocolo MCP archivos').first().json.request;if(original.request_id!==request.request_id)throw Error('EDITORIAL_PLACEMENT_SCOPE_INVALID');const selected=String(original.CREAR_EN??'').split(',').some(x=>['OPURO','AMBOS','TODOS'].includes(x.trim().toUpperCase()));const input=prepareEditorialPlacementCheck(original.request_id,original.master,selected);`)+`\nreturn [{json:{original,placementInput:input,...(item.binary?{savedBinary:item.binary}:{})}}];`;
 const verify='// '+marker+'\n'+placementProvenanceSource()+`\nconst p=$(${JSON.stringify(names.prepare)}).first().json;const envelope=acceptEditorialPlacementProof(p.placementInput,$input.first().json);const clean={...p.original};delete clean.EDITORIAL_PLACEMENT;return [{json:{...clean,...(envelope?{EDITORIAL_PLACEMENT:envelope}:{})},...(p.savedBinary?{binary:p.savedBinary}:{})}];`;
 const pos=source.position??[0,0],id=shared?'632d3751':'5790e013';
 const nodes=[
  {name:names.prepare,id:id+'-0d67-4f14-a40e-349e6e686a45',type:'n8n-nodes-base.code',typeVersion:2,position:[pos[0]+200,pos[1]],parameters:{mode:'runOnceForAllItems',jsCode:prepare}},
  {name:names.http,id:id+'-d6c4-45e8-aebc-1342d021339f',type:'n8n-nodes-base.httpRequest',typeVersion:4.5,position:[pos[0]+420,pos[1]],credentials:{httpHeaderAuth:structuredClone(credentialNode.credentials.httpHeaderAuth)},parameters:{method:'POST',url:'https://publisher.oxigenopuro.com.mx/v1/telegram/placement/prove',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify($json.placementInput) }}',options:{timeout:15000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}}}}},
  {name:names.verify,id:id+'-d921-453e-803a-2a7dd1be32e9',type:'n8n-nodes-base.code',typeVersion:2,position:[pos[0]+640,pos[1]],parameters:{mode:'runOnceForAllItems',jsCode:verify}},
 ];
 const operations=[...nodes.map(node=>({type:'addNode',node})),...nodes.map(n=>({type:'setNodeSettings',nodeName:n.name,settings:{retryOnFail:false,onError:shared?'stopWorkflow':'continueErrorOutput'}})),edge('removeConnection',source.name,next[0].node),edge('addConnection',source.name,names.prepare),edge('addConnection',names.prepare,names.http),edge('addConnection',names.http,names.verify),edge('addConnection',names.verify,next[0].node)];
 if(!shared)for(const n of nodes)operations.push(edge('addConnection',n.name,'Archivo rechazado',1));
 operations.push({type:'addNodeGroup',id:shared?'17413e12-c310-438a-ac6e-9c267ead74a6':'49e6dd47-02bd-4846-93a6-dc777b162109',name:shared?'Procedencia editorial Shared':'Procedencia editorial MCP',description:'Comprueba la orden directa persistida por Guard antes de aceptar o iniciar escrituras. MASTER y fuentes no autentican la colocación.',nodeNames:shared?nodes.map(n=>n.name):[names.verify]});
 return operations;
}
