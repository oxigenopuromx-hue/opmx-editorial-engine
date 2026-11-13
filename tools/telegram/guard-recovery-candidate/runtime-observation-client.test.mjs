import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeObserver,expectedRuntimeVersions,runtimeObservationUrl} from './runtime-observation-client.mjs';
const scope={packageId:`tg_${'a'.repeat(40)}`,revision:2,eventId:`evt_${'b'.repeat(48)}`},nonce=`obs_${'c'.repeat(48)}`,secret='d'.repeat(64),clock=1794357772000;
const response=()=>({schema:'opmx.runtime-observation.v1',scope:{...scope,nonce},startedAt:new Date(clock).toISOString(),observedAt:new Date(clock).toISOString(),workflows:Object.entries(expectedRuntimeVersions).map(([id,activeVersionId])=>({id,activeVersionId,graph:{nodes:[{name:'observed'}],connections:{}}})),executionPages:['running','waiting','new'].map(status=>({status,complete:true,executions:[]})),authorizesRecovery:false,motorTerminationVerified:false});
const observeWith=(data,status=200)=>createRuntimeObserver({secret,now:()=>clock,nonceFactory:()=>nonce,fetchImpl:async()=>({status,json:async()=>data})});
test('fixed destination and credential; matching observation never permits recovery',async()=>{
 const observe=createRuntimeObserver({secret,now:()=>clock,nonceFactory:()=>nonce,fetchImpl:async(url,options)=>{
  assert.equal(url,runtimeObservationUrl);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,`Bearer ${secret}`);assert.deepEqual(JSON.parse(options.body),{...scope,nonce});return {status:200,json:async()=>response()};
 }});
 const result=await observe(scope);assert.equal(result.status,'RUNTIME_OBSERVED');assert.equal(result.noActiveN8nWriters,true);assert.equal(result.authorizesRecovery,false);assert.equal(result.motorTerminationVerified,false);assert.equal(result.terminated,undefined);
});
test('a live writer is reported instead of converted to absence',async()=>{const data=response();data.executionPages[0].executions.push({id:'42',workflowId:Object.keys(expectedRuntimeVersions)[0],status:'running',stoppedAt:null});assert.equal((await observeWith(data)(scope)).noActiveN8nWriters,false)});
test('reject stale, replayed, incomplete and mismatched observations',async t=>{
 const cases={nonce:d=>{d.scope.nonce=`obs_${'0'.repeat(48)}`},revision:d=>{d.scope.revision++},stale:d=>{d.startedAt=new Date(clock-60000).toISOString()},future:d=>{d.observedAt=new Date(clock+60000).toISOString()},pagination:d=>{d.executionPages[0].complete=false},missingStatus:d=>{d.executionPages.pop()},duplicateStatus:d=>{d.executionPages[1].status='running'},version:d=>{d.workflows[0].activeVersionId='draft-version'},missingGraph:d=>{d.workflows[0].graph=null},duplicateWorkflow:d=>{d.workflows[1]=d.workflows[0]},permission:d=>{d.authorizesRecovery=true},termination:d=>{d.motorTerminationVerified=true},wrongStatus:d=>{d.executionPages[0].executions.push({id:'42',workflowId:Object.keys(expectedRuntimeVersions)[0],status:'waiting',stoppedAt:null})}};
 for(const [name,mutate] of Object.entries(cases))await t.test(name,async()=>{const data=response();mutate(data);assert.equal((await observeWith(data)(scope)).status,'RUNTIME_OBSERVATION_UNAVAILABLE')});
});
test('authentication, network, format and arbitrary scope failures disclose no data',async()=>{
 for(const status of [401,403,500])assert.deepEqual(await observeWith(response(),status)(scope),{status:'RUNTIME_OBSERVATION_UNAVAILABLE',authorizesRecovery:false,motorTerminationVerified:false,diagnostic:{code:'HTTPSTATUS',httpStatus:status}});
 const observe=createRuntimeObserver({secret,fetchImpl:async()=>{throw Error('private upstream content')}});assert.equal((await observe(scope)).status,'RUNTIME_OBSERVATION_UNAVAILABLE');assert.equal((await observe({...scope,url:'https://example.test'})).status,'RUNTIME_OBSERVATION_UNAVAILABLE');
});

const origin={workflowId:'bnzVMNkZuGO1GQCZ',executionId:'42'};
function administrativeResponse(){
 const d=response(),startedAt=new Date(clock-1000).toISOString();
 d.executionPages[0].executions=[{id:origin.executionId,workflowId:origin.workflowId,status:'running',startedAt,stoppedAt:null}];
 d.administrativeExecutionProof={id:origin.executionId,workflowId:origin.workflowId,workflowVersionId:expectedRuntimeVersions[origin.workflowId],mode:'webhook',status:'running',startedAt,stoppedAt:null};
 return d;
}
test('private recovery origin observes the real active administrative call without hiding it or asserting global idleness',async()=>{
 const d=administrativeResponse(),observe=createRuntimeObserver({secret,now:()=>clock,nonceFactory:()=>nonce,fetchImpl:async(url,options)=>{
  assert.equal(url,runtimeObservationUrl);assert.deepEqual(JSON.parse(options.body),{...scope,nonce,nonWritingRecoveryExecution:origin});return {status:200,json:async()=>d};
 }});
 const r=await observe(scope,{nonWritingRecoveryExecution:origin});assert.equal(r.status,'RUNTIME_OBSERVED');assert.equal(r.noActiveN8nWriters,false);assert.equal(r.noActivePublicationWriters,true);assert.deepEqual(r.executionPages,d.executionPages);assert.deepEqual(r.administrativeExecutionProof,d.administrativeExecutionProof);assert.deepEqual(r.nonWritingAdministrativeExecution,{...origin,status:'running',provenance:'PINNED_INTERNAL_RECOVERY_ROUTE'});assert.equal(r.authorizesRecovery,false);assert.equal(r.motorTerminationVerified,false);
 const normal=await observeWith(d)(scope);assert.equal(normal.noActiveN8nWriters,false);assert.equal(normal.noActivePublicationWriters,undefined);assert.equal(normal.nonWritingAdministrativeExecution,undefined);
});
test('a recovery origin never exempts another call, an unproven execution, an old version or incomplete pages',async t=>{
 const cases={anotherId:d=>d.executionPages[0].executions[0].id='43',otherWorkflow:d=>d.executionPages[0].executions[0].workflowId=Object.keys(expectedRuntimeVersions)[1],extraRunning:d=>d.executionPages[0].executions.push({...d.executionPages[0].executions[0],id:'43'}),duplicate:d=>d.executionPages[0].executions.push({...d.executionPages[0].executions[0]}),extraWaiting:d=>d.executionPages[1].executions.push({...d.executionPages[0].executions[0],id:'43',status:'waiting'}),extraNew:d=>d.executionPages[2].executions.push({...d.executionPages[0].executions[0],id:'43',status:'new'}),missingProof:d=>delete d.administrativeExecutionProof,wrongProofId:d=>d.administrativeExecutionProof.id='43',wrongProofVersion:d=>d.administrativeExecutionProof.workflowVersionId='old-version',wrongMode:d=>d.administrativeExecutionProof.mode='manual',wrongStartedAt:d=>d.administrativeExecutionProof.startedAt=new Date(clock-2000).toISOString(),stopped:d=>d.administrativeExecutionProof.stoppedAt=new Date(clock).toISOString(),extraProof:d=>d.administrativeExecutionProof.trusted=true};
 for(const [name,mutate]of Object.entries(cases))await t.test(name,async()=>{const d=administrativeResponse();mutate(d);const r=await observeWith(d)(scope,{nonWritingRecoveryExecution:origin});assert.equal(r.noActivePublicationWriters,false);assert.deepEqual(r.executionPages,d.executionPages)});
 for(const [name,mutate]of Object.entries({oldActive:d=>d.workflows[0].activeVersionId='old',partial:d=>d.executionPages[0].complete=false,wrongPage:d=>{d.executionPages[0].executions[0].status='waiting'}}))await t.test(name,async()=>{const d=administrativeResponse();mutate(d);assert.equal((await observeWith(d)(scope,{nonWritingRecoveryExecution:origin})).status,'RUNTIME_OBSERVATION_UNAVAILABLE')});
 for(const bad of [{workflowId:'another',executionId:'42'},{...origin,executionId:'not-a-number'},{...origin,extra:true},null])assert.equal((await observeWith(administrativeResponse())(scope,{nonWritingRecoveryExecution:bad})).status,'RUNTIME_OBSERVATION_UNAVAILABLE');
 assert.equal((await observeWith(administrativeResponse())({...scope,origin})).status,'RUNTIME_OBSERVATION_UNAVAILABLE');
});
test('unavailable observations give a bounded fixed diagnostic without upstream body, exceptions or credentials',async t=>{
 const expected=(r,code)=>{assert.equal(r.status,'RUNTIME_OBSERVATION_UNAVAILABLE');assert.equal(r.diagnostic.code,code);assert.equal(r.authorizesRecovery,false);assert.equal(r.motorTerminationVerified,false);assert.equal(r.workflows,undefined);assert.equal(r.executionPages,undefined);assert.equal(r.token,undefined);assert.equal(JSON.stringify(r).includes(secret),false);assert.equal(JSON.stringify(r).includes('private-message'),false)};
 expected(await observeWith(response())({...scope,url:'private-message'}),'REQUEST');
 expected(await createRuntimeObserver({secret,now:()=>clock,nonceFactory:()=>{throw Error('private-message')},fetchImpl:async()=>{throw Error('must not fetch')}})(scope),'NONCE');
 expected(await createRuntimeObserver({secret,now:()=>NaN,nonceFactory:()=>nonce,fetchImpl:async()=>{throw Error('must not fetch')}})(scope),'TIME');
 for(const [name,mutate,code]of [['scope',d=>d.scope.revision++,'SCOPE'],['nonce',d=>d.scope.nonce='private-message','NONCE'],['time',d=>d.startedAt='private-message','TIME'],['executions',d=>d.executionPages[0].complete=false,'EXECUTIONS']])await t.test(name,async()=>{const d=response();mutate(d);expected(await observeWith(d)(scope),code)});
 const json=createRuntimeObserver({secret,now:()=>clock,nonceFactory:()=>nonce,fetchImpl:async()=>({status:200,json:async()=>{throw Error('private-message '+secret)}})});expected(await json(scope),'JSON');
 for(const name of ['Error','TimeoutError','AbortError']){const e=new Error('private-message '+secret);e.name=name;const observe=createRuntimeObserver({secret,now:()=>clock,nonceFactory:()=>nonce,fetchImpl:async()=>{throw e}});expected(await observe(scope),name==='Error'?'NETWORK':'TIMEOUT')}
 const bad=response();bad.workflows=[...bad.workflows,...bad.workflows];bad.workflows[0]={id:secret,activeVersionId:secret,graph:{private:secret}};bad.workflows[1].activeVersionId='00000000-0000-0000-0000-000000000001';
 const r=await observeWith(bad)(scope);expected(r,'WORKFLOWS');assert.equal(r.diagnostic.workflowCount,10);assert.equal(r.diagnostic.observedWorkflows.length,5);assert.deepEqual(r.diagnostic.observedWorkflows[0],{workflowId:'UNRECOGNIZED_WORKFLOW',versionId:'INVALID_VERSION'});assert.equal(r.diagnostic.observedWorkflows[1].versionId,'00000000-0000-0000-0000-000000000001');assert.ok(r.diagnostic.observedWorkflows.every(w=>Object.keys(w).sort().join(',')==='versionId,workflowId'));
});
