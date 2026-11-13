import {writerGraphFingerprint} from '../writer-release-contract.mjs';
import {validateAdministrativeRuntimeScope,projectAdministrativeExecutionProof} from '../runtime-administrative-execution-proof.mjs';

export const runtimeAdministrativeObserverNodeNames=Object.freeze({condition:'¿Observar ejecución administrativa?',read:'Leer ejecución administrativa real'});
const scopeName='Validar alcance',resultName='Observación sin permiso de recuperación';
const ids={condition:'c49cbec4-ae76-4de4-ad81-c634621e1096',read:'b903c866-202c-49e8-8f59-4908fc91ca50'};

// Stage only against the inspected ACTIVE eleven-node graph. The nine-node
// draft is another saved artifact and must be restored after staging/publishing.
export function buildRuntimeAdministrativeObserverOperations({workflow,expectedActiveVersion,expectedDraftVersion,expectedActiveGraphHash}){
 if(workflow?.id!=='2HBn1RnSYgyxuHgE'||workflow.active!==true||workflow.activeVersionId!==expectedActiveVersion||workflow.versionId!==expectedDraftVersion||!workflow.activeVersion||!Array.isArray(workflow.nodes)||!workflow.connections)throw Error('RUNTIME_COLLECTOR_VERSION_UNCONFIRMED');
 const active=workflow.activeVersion.sameAsDraft?workflow:workflow.activeVersion;
 if(active.nodes?.length!==11||writerGraphFingerprint(active)!==expectedActiveGraphHash)throw Error('RUNTIME_COLLECTOR_GRAPH_UNCONFIRMED');
 if(workflow.settings?.saveManualExecutions!==false||workflow.settings?.saveDataErrorExecution!=='none'||workflow.settings?.saveDataSuccessExecution!=='none')throw Error('RUNTIME_COLLECTOR_RETENTION_UNCONFIRMED');
 const byName=new Map(active.nodes.map(n=>[n.name,n])),scope=byName.get(scopeName),result=byName.get(resultName),readReference=byName.get('Leer running');
 if(scope?.type!=='n8n-nodes-base.code'||result?.type!=='n8n-nodes-base.code'||readReference?.type!=='n8n-nodes-base.httpRequest'||readReference.parameters?.authentication!=='predefinedCredentialType'||readReference.parameters.nodeCredentialType!=='n8nApi'||typeof readReference.credentials?.n8nApi?.id!=='string'||scope.parameters.jsCode.includes('nonWritingRecoveryExecution')||result.parameters.jsCode.includes('administrativeExecutionProof')||active.nodes.some(n=>Object.values(runtimeAdministrativeObserverNodeNames).includes(n.name)||Object.values(ids).includes(n.id)))throw Error('RUNTIME_COLLECTOR_BASELINE_MISMATCH');
 const expectedConnection={main:[[{node:'Leer versión 0',type:'main',index:0}]]};
 if(JSON.stringify(active.connections[scopeName])!==JSON.stringify(expectedConnection))throw Error('RUNTIME_COLLECTOR_CONNECTION_UNCONFIRMED');
 const originalReturn="return [{json:{schema:'opmx.runtime-observation.v1'";
 const originalFlags='authorizesRecovery:false,motorTerminationVerified:false';
 if(result.parameters.jsCode.split(originalReturn).length!==2||result.parameters.jsCode.split(originalFlags).length!==2)throw Error('RUNTIME_COLLECTOR_BASELINE_MISMATCH');
 const scopeCode=validateAdministrativeRuntimeScope.toString()+"\nreturn [{json:validateAdministrativeRuntimeScope($input.first().json.body,new Date().toISOString())}];";
 const proofCode="const administrativeExecutionProof=projectAdministrativeExecutionProof({origin:scope.nonWritingRecoveryExecution??null,response:scope.nonWritingRecoveryExecution?$('"+runtimeAdministrativeObserverNodeNames.read+"').first().json:null,workflows,executionPages});\n";
 const resultCode=projectAdministrativeExecutionProof.toString()+'\n'+result.parameters.jsCode.replace(originalReturn,proofCode+originalReturn).replace(originalFlags,originalFlags+',administrativeExecutionProof');
 const condition={id:ids.condition,name:runtimeAdministrativeObserverNodeNames.condition,type:'n8n-nodes-base.if',typeVersion:2.2,position:[scope.position[0]+120,scope.position[1]-240],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict'},conditions:[{leftValue:'={{ $json.nonWritingRecoveryExecution !== undefined }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}};
 const read={id:ids.read,name:runtimeAdministrativeObserverNodeNames.read,type:readReference.type,typeVersion:readReference.typeVersion,position:[scope.position[0]+344,scope.position[1]-240],parameters:{method:'GET',url:'={{ "https://n8n.oxigenopuro.com.mx/api/v1/executions/" + $("Validar alcance").first().json.nonWritingRecoveryExecution.executionId + "?includeData=true" }}',authentication:'predefinedCredentialType',nodeCredentialType:'n8nApi',options:{timeout:10000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}}}},credentials:structuredClone(readReference.credentials),retryOnFail:false,onError:'stopWorkflow'};
 const operations=[{type:'updateNodeParameters',nodeName:scopeName,parameters:{...scope.parameters,jsCode:scopeCode}},{type:'updateNodeParameters',nodeName:resultName,parameters:{...result.parameters,jsCode:resultCode}},{type:'addNode',node:condition},{type:'addNode',node:read},{type:'removeConnection',source:scopeName,target:'Leer versión 0'},{type:'addConnection',source:scopeName,target:condition.name},{type:'addConnection',source:condition.name,target:read.name,sourceIndex:0},{type:'addConnection',source:condition.name,target:'Leer versión 0',sourceIndex:1},{type:'addConnection',source:read.name,target:'Leer versión 0'}];
 const candidate=structuredClone(active);
 for(const op of operations.filter(x=>x.type==='updateNodeParameters'))candidate.nodes.find(n=>n.name===op.nodeName).parameters=structuredClone(op.parameters);
 candidate.nodes.push(condition,read);
 candidate.connections[scopeName]={main:[[{node:condition.name,type:'main',index:0}]]};
 candidate.connections[condition.name]={main:[[{node:read.name,type:'main',index:0}],[{node:'Leer versión 0',type:'main',index:0}]]};
 candidate.connections[read.name]={main:[[{node:'Leer versión 0',type:'main',index:0}]]};
 return {baseActiveVersion:expectedActiveVersion,baseDraftVersion:expectedDraftVersion,baseGraphHash:expectedActiveGraphHash,candidateGraphHash:writerGraphFingerprint(candidate),operations,candidate,originalDraft:{nodes:structuredClone(workflow.nodes),connections:structuredClone(workflow.connections),nodeGroups:structuredClone(workflow.nodeGroups??[]),settings:structuredClone(workflow.settings)}};
}
