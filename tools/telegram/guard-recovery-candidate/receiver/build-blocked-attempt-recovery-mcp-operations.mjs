import {writerGraphFingerprint} from '../writer-release-contract.mjs';

const names=['Protocolo MCP archivos','Resultado intento Motor MCP'];
const inline=source=>source.replaceAll('export function ','function ').replaceAll('export const ','const ');

// Replace only the already-installed administrative adapter. The writer,
// authentication routing, credentials, connections and older draft remain
// unchanged. Backend proof, not the caller or this formatter, permits recovery.
export function buildBlockedAttemptRecoveryMcpOperations({workflow,expectedActiveVersion,expectedDraftVersion,expectedGraphHash,previousProtocolSource,protocolSource}){
 if(workflow?.id!=='bnzVMNkZuGO1GQCZ'||workflow.active!==true||workflow.activeVersionId!==expectedActiveVersion||workflow.versionId!==expectedDraftVersion||!workflow.activeVersion||typeof previousProtocolSource!=='string'||typeof protocolSource!=='string')throw Error('BLOCKED_RECOVERY_BASELINE_UNCONFIRMED');
 const active=workflow.activeVersion.sameAsDraft?workflow:workflow.activeVersion;
 if(active.nodes?.length!==155||writerGraphFingerprint(active)!==expectedGraphHash||workflow.settings?.saveManualExecutions!==false||workflow.settings?.saveDataSuccessExecution!=='none'||workflow.settings?.saveDataErrorExecution!=='none')throw Error('BLOCKED_RECOVERY_GRAPH_UNCONFIRMED');
 const oldModule=inline(previousProtocolSource),newModule=inline(protocolSource);
 if(oldModule===newModule||!newModule.includes('BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED')||newModule.includes('export '))throw Error('BLOCKED_RECOVERY_MODULE_UNCONFIRMED');
 const candidate=structuredClone(active),operations=[];
 for(const name of names){
  const node=candidate.nodes.find(n=>n.name===name),code=node?.parameters?.jsCode;
  if(node?.type!=='n8n-nodes-base.code'||typeof code!=='string'||code.split(oldModule).length!==2)throw Error('BLOCKED_RECOVERY_ADAPTER_UNCONFIRMED');
  node.parameters={...node.parameters,jsCode:code.replace(oldModule,()=>newModule)};
  operations.push({type:'updateNodeParameters',nodeName:name,parameters:structuredClone(node.parameters)});
 }
 const call=candidate.nodes.find(n=>n.name==='Gestionar intento Motor guard');
 if(call?.type!=='n8n-nodes-base.httpRequest'||call.parameters?.jsonBody!=='={{ JSON.stringify($json.request.body) }}'||call.parameters.authentication!=='genericCredentialType'||call.parameters.genericAuthType!=='httpHeaderAuth'||!call.credentials?.httpHeaderAuth?.id||call.retryOnFail!==false)throw Error('BLOCKED_RECOVERY_ORIGIN_UNCONFIRMED');
 // Only this pinned internal branch creates origin. Public tool arguments
 // still reject it; the Guard cross-checks the actual execution/version.
 call.parameters={...call.parameters,jsonBody:'={{ JSON.stringify($json.request.action === "recover-unacknowledged" ? {...$json.request.body, origin: {workflowId: $workflow.id, executionId: String($execution.id)}} : $json.request.body) }}'};
 operations.push({type:'updateNodeParameters',nodeName:call.name,parameters:structuredClone(call.parameters)});
 return {operations,candidate,candidateGraphHash:writerGraphFingerprint(candidate),baseActiveVersion:expectedActiveVersion,baseDraftVersion:expectedDraftVersion,baseGraphHash:expectedGraphHash};
}
