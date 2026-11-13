import {writerGraphFingerprint} from '../writer-release-contract.mjs';

const names=['Resolver identidad de solicitud','Protocolo MCP archivos','Gestionar intento Motor guard','Resultado intento Motor MCP'];
const tool='recuperar_intento_sin_decision_telegram_opmx';
const finalOwner='return [{json:{envelope,identity,noticeIdentity}}];';
const actionList='["start","block","complete","decision"]';
const once=(text,needle,replacement)=>{if(typeof text!=='string'||text.split(needle).length!==2)throw Error('RECOVERY_MCP_BASELINE_MISMATCH');return text.replace(needle,replacement)};

// Builds four parameter-only edits against the inspected ACTIVE graph. The
// older draft is preserved separately; these edits must never be applied to
// that draft without first staging the complete active graph unchanged.
export function buildUnacknowledgedRecoveryMcpOperations({workflow,expectedActiveVersion,expectedDraftVersion,expectedActiveGraphHash,protocolSource}){
 if(workflow?.id!=='bnzVMNkZuGO1GQCZ'||workflow.active!==true||workflow.activeVersionId!==expectedActiveVersion||workflow.versionId!==expectedDraftVersion||!Array.isArray(workflow.nodes)||!workflow.connections||!workflow.activeVersion||typeof protocolSource!=='string'||!protocolSource.includes('export function classifyUnacknowledgedRecovery'))throw Error('RECOVERY_MCP_VERSION_UNCONFIRMED');
 const active=workflow.activeVersion.sameAsDraft?workflow:workflow.activeVersion;
 if(active.nodes?.length!==155||writerGraphFingerprint(active)!==expectedActiveGraphHash)throw Error('RECOVERY_MCP_GRAPH_UNCONFIRMED');
 if(workflow.settings?.saveManualExecutions!==false||workflow.settings?.saveDataErrorExecution!=='none'||workflow.settings?.saveDataSuccessExecution!=='none')throw Error('RECOVERY_MCP_RETENTION_UNCONFIRMED');
 const byName=new Map(active.nodes.map(n=>[n.name,n]));
 const [owner,protocol,call,format]=names.map(name=>byName.get(name));
 if([owner,protocol,format].some(n=>n?.type!=='n8n-nodes-base.code')||call?.type!=='n8n-nodes-base.httpRequest'||call.retryOnFail!==false||call.onError!=='continueRegularOutput'||call.parameters?.method!=='POST'||call.parameters.authentication!=='genericCredentialType'||call.parameters.genericAuthType!=='httpHeaderAuth'||typeof call.credentials?.httpHeaderAuth?.id!=='string'||!call.parameters.url.includes('https://publisher.oxigenopuro.com.mx/v1/telegram/attempts/')||names.some(name=>byName.get(name)?.parameters?.jsCode?.includes(tool)))throw Error('RECOVERY_MCP_BASELINE_MISMATCH');
 const module=protocolSource.replaceAll('export function ','function ').replaceAll('export const ','const ');
 if(module.includes('export '))throw Error('RECOVERY_MCP_MODULE_INVALID');
 const common=`const unackRecovery=(()=>{\n${module}\nreturn {classifyUnacknowledgedRecovery,formatUnacknowledgedRecovery};\n})();\n`;
 // This is deliberately separate from original package-owner routing. The
 // service's existing subscriber is the authenticated administrative actor;
 // the Guard independently checks its configured administrator allow-list.
 const ownerCode=once(owner.parameters.jsCode,finalOwner,`if(message.method==='tools/call'&&message.params?.name==='${tool}'){identity=subscriber;noticeIdentity=null;}\n${finalOwner}`);
 const protocolCode=common+`const recoveryBase=(()=>{\n${protocol.parameters.jsCode}\n})();\nconst recoveryResolved=$input.first().json;let recoveryMessage=recoveryResolved.envelope?.body??recoveryResolved.envelope;if(typeof recoveryMessage==='string'){try{recoveryMessage=JSON.parse(recoveryMessage)}catch{recoveryMessage={}}}\nreturn [{json:unackRecovery.classifyUnacknowledgedRecovery(recoveryMessage,recoveryBase[0].json,recoveryResolved.identity)}];`;
 const callUrl=once(call.parameters.url,actionList,'["start","block","complete","decision","recover-unacknowledged"]');
 const formatCode=common+`const recoveryRequest=$('Protocolo MCP archivos').first(0,0).json.request;\nif(recoveryRequest?.action==='recover-unacknowledged')return [{json:unackRecovery.formatUnacknowledgedRecovery(recoveryRequest,$input.first().json)}];\nreturn (()=>{\n${format.parameters.jsCode}\n})();`;
 const parameters=[{...owner.parameters,jsCode:ownerCode},{...protocol.parameters,jsCode:protocolCode},{...call.parameters,url:callUrl},{...format.parameters,jsCode:formatCode}];
 const operations=names.map((nodeName,i)=>({type:'updateNodeParameters',nodeName,parameters:parameters[i]}));
 const candidate=structuredClone(active);
 for(const op of operations)candidate.nodes.find(n=>n.name===op.nodeName).parameters=structuredClone(op.parameters);
 return {baseActiveVersion:expectedActiveVersion,baseDraftVersion:expectedDraftVersion,baseGraphHash:expectedActiveGraphHash,candidateGraphHash:writerGraphFingerprint(candidate),nodeCount:155,operations,candidate,originalDraft:{nodes:structuredClone(workflow.nodes),connections:structuredClone(workflow.connections),nodeGroups:structuredClone(workflow.nodeGroups??[]),settings:structuredClone(workflow.settings)}};
}
