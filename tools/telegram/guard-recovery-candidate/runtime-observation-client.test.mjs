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
 for(const status of [401,403,500])assert.deepEqual(await observeWith(response(),status)(scope),{status:'RUNTIME_OBSERVATION_UNAVAILABLE',authorizesRecovery:false,motorTerminationVerified:false});
 const observe=createRuntimeObserver({secret,fetchImpl:async()=>{throw Error('private upstream content')}});assert.equal((await observe(scope)).status,'RUNTIME_OBSERVATION_UNAVAILABLE');assert.equal((await observe({...scope,url:'https://example.test'})).status,'RUNTIME_OBSERVATION_UNAVAILABLE');
});
