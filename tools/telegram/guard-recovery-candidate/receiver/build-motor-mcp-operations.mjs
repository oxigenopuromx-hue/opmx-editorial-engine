// Prepare changes to the existing Publisher MCP workflow. No operation is
// executed here, and the underlying guard must be deployed and verified first.
const added={branch:'¿Gestionar intento Motor?',call:'Gestionar intento Motor guard',format:'Resultado intento Motor MCP'};
const code=(name,js,position)=>({type:'addNode',node:{name,type:'n8n-nodes-base.code',typeVersion:2,position,parameters:{jsCode:js}}});
const connect=(source,target,sourceIndex=0)=>({type:'addConnection',source,target,sourceIndex});
export function buildMotorMcpOperations({workflow,expectedActiveVersion,expectedDraftVersion,scripts,guardCredential}){
 if(!workflow||workflow.id!=='bnzVMNkZuGO1GQCZ'||workflow.active!==true||workflow.activeVersionId!==expectedActiveVersion||workflow.versionId!==expectedDraftVersion||!workflow.activeVersion||!Array.isArray(workflow.nodes)||!workflow.connections||!guardCredential?.id||!guardCredential?.name)throw Error('MCP_VERSION_UNCONFIRMED');
 const active=workflow.activeVersion.sameAsDraft?workflow:workflow.activeVersion;
 if(!Array.isArray(active.nodes)||!active.connections)throw Error('MCP_VERSION_UNCONFIRMED');
 const draft=new Map(workflow.nodes.map(x=>[x.name,x])),live=new Map(active.nodes.map(x=>[x.name,x]));
 if(draft.size!==workflow.nodes.length||live.size!==active.nodes.length||draft.size!==live.size||JSON.stringify(workflow.connections)!==JSON.stringify(active.connections))throw Error('MCP_GRAPH_CHANGED');
 for(const [name,n] of draft){const prior=live.get(name);if(!prior||n.type!==prior.type||JSON.stringify(n.parameters)!==JSON.stringify(prior.parameters)||JSON.stringify(n.credentials??null)!==JSON.stringify(prior.credentials??null))throw Error('MCP_GRAPH_CHANGED')}
 if(Object.values(added).some(n=>draft.has(n)))throw Error('MCP_GRAPH_CHANGED');
 for(const k of ['baseProtocol','ownerRouting','attemptProtocol'])if(typeof scripts?.[k]!=='string'||!scripts[k].trim())throw Error('MCP_SCRIPT_MISSING');
 const proto=draft.get('Protocolo MCP archivos'),owner=draft.get('Resolver identidad de solicitud'),existing=workflow.connections['¿Notificación MCP?']?.main;
 if(proto?.type!=='n8n-nodes-base.code'||owner?.type!=='n8n-nodes-base.code'||proto.parameters?.jsCode?.trim()!==scripts.baseProtocol.trim()||!owner.parameters?.jsCode?.includes("'informar_bloqueo_telegram_opmx'")||existing?.[0]?.length!==1||existing[0][0]?.node!=='Aceptar notificación'||existing?.[1]?.length!==1||existing[1][0]?.node!=='¿Informar bloqueo Telegram?'||!draft.has('Responder MCP'))throw Error('MCP_GRAPH_CHANGED');
 const guard=draft.get('Publicación — Guard OPURO');if(guard?.credentials?.httpHeaderAuth?.id!==guardCredential.id)throw Error('MCP_GRAPH_CHANGED');
 const module=scripts.attemptProtocol.replaceAll('export function ','function ');
 if(module.includes('export '))throw Error('MCP_SCRIPT_INVALID');
 const common=`const motorAttempt=(()=>{\n${module}\nreturn {classifyMotorAttempt,formatMotorAttempt};\n})();\n`;
 const wrapped=common+`const initial=(()=>{\n${scripts.baseProtocol}\n})();\nconst resolved=$input.first().json;let message=resolved.envelope?.body??resolved.envelope;if(typeof message==='string'){try{message=JSON.parse(message)}catch{message={}}}\nreturn [{json:motorAttempt.classifyMotorAttempt(message,initial[0].json,resolved.identity)}];`;
 const format=common+`const request=$('Protocolo MCP archivos').first(0,0).json.request;return [{json:motorAttempt.formatMotorAttempt(request,$input.first().json)}];`;
 const ops=[
  {type:'updateNodeParameters',nodeName:'Resolver identidad de solicitud',parameters:{jsCode:scripts.ownerRouting}},
  {type:'updateNodeParameters',nodeName:'Protocolo MCP archivos',parameters:{jsCode:wrapped}},
  {type:'addNode',node:{name:added.branch,type:'n8n-nodes-base.if',typeVersion:2.2,position:[1040,-600],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:'={{ $json.route === "telegram-attempt" }}',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}}},
  {type:'addNode',node:{name:added.call,type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[1260,-650],parameters:{method:'POST',url:'={{ $json.request.action === "execute-update" ? "https://publisher.oxigenopuro.com.mx/v1/telegram/updates/execute" : $json.request.action === "stage-preview" ? "https://publisher.oxigenopuro.com.mx/v1/telegram/previews/payload" : $json.request.action === "preview-context" ? "https://publisher.oxigenopuro.com.mx/v1/telegram/previews/context" : ["start","block","decision"].includes($json.request.action) ? "https://publisher.oxigenopuro.com.mx/v1/telegram/attempts/" + $json.request.action : "" }}',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify($json.request.body) }}',options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},credentials:{httpHeaderAuth:guardCredential}}},
  code(added.format,format,[1480,-650]),
  {type:'setNodeSettings',nodeName:added.call,settings:{retryOnFail:false,onError:'continueRegularOutput'}},
  {type:'removeConnection',source:'¿Notificación MCP?',sourceIndex:1,target:'¿Informar bloqueo Telegram?'},
  connect('¿Notificación MCP?',added.branch,1),connect(added.branch,added.call),connect(added.branch,'¿Informar bloqueo Telegram?',1),connect(added.call,added.format),connect(added.format,'Responder MCP'),
 ];
 return {baseActiveVersion:expectedActiveVersion,baseDraftVersion:expectedDraftVersion,operations:ops};
}
