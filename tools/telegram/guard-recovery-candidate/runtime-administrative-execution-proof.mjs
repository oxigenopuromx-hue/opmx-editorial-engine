// Read-only collector helpers. This is an assertion of current n8n execution
// metadata, not a claim that its upstream runData or route was observed.
// The origin arrives only through the existing authenticated Guard collector.
export function validateAdministrativeRuntimeScope(body,startedAt){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('INVALID_OBSERVATION_SCOPE');
 const hasOrigin=Object.hasOwn(body,'nonWritingRecoveryExecution');
 const keys=hasOrigin?'eventId,nonWritingRecoveryExecution,nonce,packageId,revision':'eventId,nonce,packageId,revision';
 if(Object.keys(body).sort().join(',')!==keys||!/^tg_[a-f0-9]{40}$/.test(body.packageId??'')||!Number.isSafeInteger(body.revision)||body.revision<1||body.revision>4294967295||!/^evt_[a-f0-9]{48}$/.test(body.eventId??'')||!/^obs_[a-f0-9]{48}$/.test(body.nonce??''))throw Error('INVALID_OBSERVATION_SCOPE');
 if(hasOrigin){
  const origin=body.nonWritingRecoveryExecution;
  if(!origin||typeof origin!=='object'||Array.isArray(origin)||Object.keys(origin).sort().join(',')!=='executionId,workflowId'||origin.workflowId!=='bnzVMNkZuGO1GQCZ'||typeof origin.executionId!=='string'||!/^[1-9][0-9]{0,31}$/.test(origin.executionId))throw Error('INVALID_OBSERVATION_SCOPE');
 }
 return {...body,startedAt};
}

export function projectAdministrativeExecutionProof({origin,response,workflows,executionPages}={}){
 if(!origin)return null;
 if(typeof origin!=='object'||Array.isArray(origin)||Object.keys(origin).sort().join(',')!=='executionId,workflowId'||origin.workflowId!=='bnzVMNkZuGO1GQCZ'||typeof origin.executionId!=='string'||!/^[1-9][0-9]{0,31}$/.test(origin.executionId)||response?.statusCode!==200)return null;
 const execution=response.body;
 if(!execution||typeof execution!=='object'||Array.isArray(execution)||execution.id!==origin.executionId||execution.workflowId!==origin.workflowId||typeof execution.workflowVersionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(execution.workflowVersionId)||execution.mode!=='webhook'||execution.status!=='running'||typeof execution.startedAt!=='string'||!Number.isFinite(Date.parse(execution.startedAt))||execution.stoppedAt!==null)return null;
 const matchingWorkflows=Array.isArray(workflows)?workflows.filter(w=>w?.id===origin.workflowId):[];
 if(matchingWorkflows.length!==1||matchingWorkflows[0].activeVersionId!==execution.workflowVersionId)return null;
 if(!Array.isArray(executionPages)||executionPages.length!==3||new Set(executionPages.map(p=>p?.status)).size!==3||executionPages.some(p=>!['running','waiting','new'].includes(p?.status)||p.complete!==true||!Array.isArray(p.executions)))return null;
 const matches=executionPages.flatMap(p=>p.executions.filter(x=>x?.id===origin.executionId&&x?.workflowId===origin.workflowId).map(x=>({page:p.status,execution:x})));
 if(matches.length!==1||matches[0].page!=='running'||matches[0].execution.status!=='running'||matches[0].execution.startedAt!==execution.startedAt||matches[0].execution.stoppedAt!==null)return null;
 return {id:execution.id,workflowId:execution.workflowId,workflowVersionId:execution.workflowVersionId,mode:execution.mode,status:execution.status,startedAt:execution.startedAt,stoppedAt:null};
}
