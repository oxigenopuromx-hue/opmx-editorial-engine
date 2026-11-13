import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAdministrativeRuntimeScope as validate,projectAdministrativeExecutionProof as project} from './runtime-administrative-execution-proof.mjs';

const scope={packageId:'tg_'+'a'.repeat(40),revision:12,eventId:'evt_'+'b'.repeat(48),nonce:'obs_'+'c'.repeat(48)};
const origin={workflowId:'bnzVMNkZuGO1GQCZ',executionId:'39732'},version='11111111-1111-4111-8111-111111111111',startedAt='2026-11-13T18:00:00.123Z';
function fixture(){
 const execution={id:origin.executionId,workflowId:origin.workflowId,workflowVersionId:version,mode:'webhook',status:'running',startedAt,stoppedAt:null,data:{secret:'SOURCE_BYTES'},workflowData:{nodes:[{parameters:{secret:'NOT_PROJECTED'}}]}};
 return {origin:structuredClone(origin),response:{statusCode:200,body:execution},workflows:[{id:origin.workflowId,activeVersionId:version}],executionPages:[{status:'running',complete:true,executions:[{id:origin.executionId,workflowId:origin.workflowId,status:'running',startedAt,stoppedAt:null}]},{status:'waiting',complete:true,executions:[]},{status:'new',complete:true,executions:[]}]};
}
test('ordinary authenticated scope remains unchanged and has no execution proof',()=>{
 assert.deepEqual(validate(scope,startedAt),{...scope,startedAt});
 assert.equal(project({origin:null,response:fixture().response}),null);
});
test('origin is optional, exact and restricted to the native MCP numeric execution',()=>{
 assert.deepEqual(validate({...scope,nonWritingRecoveryExecution:origin},startedAt),{...scope,nonWritingRecoveryExecution:origin,startedAt});
 for(const o of [null,undefined,[],{},'39732',{...origin,workflowId:'another'},{...origin,executionId:39732},{...origin,executionId:'39732?includeData=true'},{...origin,executionId:'0'},{...origin,executionId:'01'},{...origin,route:'recover-unacknowledged'}])assert.throws(()=>validate({...scope,nonWritingRecoveryExecution:o},startedAt),/INVALID_OBSERVATION_SCOPE/);
 for(const s of [{...scope,extra:true},{...scope,nonce:'wrong'},{...scope,revision:4294967296},{...scope,revision:0},{...scope,eventId:'evt_invalid'},[]])assert.throws(()=>validate(s,startedAt),/INVALID_OBSERVATION_SCOPE/);
});
test('projects only seven real API metadata fields and never runData, inputs or secrets',()=>{
 const result=project(fixture());
 assert.deepEqual(result,{id:origin.executionId,workflowId:origin.workflowId,workflowVersionId:version,mode:'webhook',status:'running',startedAt,stoppedAt:null});
 assert.equal(Object.keys(result).length,7);assert.doesNotMatch(JSON.stringify(result),/SOURCE_BYTES|NOT_PROJECTED|workflowData|data/);
});
test('refuses missing API data, HTTP failure, mismatched identity, version, mode or liveness',()=>{
 for(const change of [x=>x.response.statusCode=404,x=>x.response.body=null,x=>delete x.response.body.workflowVersionId,x=>x.response.body.workflowVersionId='other',x=>x.response.body.id='39733',x=>x.response.body.workflowId='another',x=>x.response.body.mode='manual',x=>x.response.body.status='success',x=>x.response.body.stoppedAt=startedAt,x=>delete x.response.body.stoppedAt,x=>x.response.body.startedAt='invalid',x=>x.workflows[0].activeVersionId='22222222-2222-4222-8222-222222222222',x=>x.workflows.push(structuredClone(x.workflows[0]))]){const x=fixture();change(x);assert.equal(project(x),null)}
 const x=fixture();delete x.response.body.workflowVersionId;x.response.body.workflowData.versionId=version;assert.equal(project(x),null,'workflowData does not replace current execution metadata');
});
test('requires one running-page identity with matching real start and complete pages',()=>{
 for(const change of [x=>x.executionPages[0].complete=false,x=>x.executionPages.pop(),x=>x.executionPages[0].executions=[],x=>x.executionPages[0].executions.push(structuredClone(x.executionPages[0].executions[0])),x=>x.executionPages[1].executions.push(structuredClone(x.executionPages[0].executions[0])),x=>x.executionPages[0].executions[0].startedAt='2026-11-13T18:00:00.124Z',x=>x.executionPages[0].executions[0].stoppedAt=startedAt,x=>x.executionPages[0].executions[0].status='waiting']){const x=fixture();change(x);assert.equal(project(x),null)}
});
test('preserves other jobs and pages; proof itself never declares the runtime idle',()=>{
 const x=fixture();x.executionPages[0].executions.push({id:'39733',workflowId:'4o7K5TmKc7joScqB',status:'running',startedAt,stoppedAt:null});const before=structuredClone(x);
 assert.ok(project(x));assert.deepEqual(x,before);assert.equal(x.executionPages[0].executions.length,2);assert.equal(Object.hasOwn(project(x),'noActiveN8nWriters'),false);
});
