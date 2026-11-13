import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyUnacknowledgedRecovery as classify,formatUnacknowledgedRecovery as format,unacknowledgedRecoveryTool as name} from './motor-unacknowledged-recovery-protocol.mjs';

const args={package_id:'tg_'+'a'.repeat(40),revision:12,event_id:'evt_'+'b'.repeat(48),preview_hash:'c'.repeat(64)},identity={owner:'123',chat:'123'};
const base={httpStatus:200,response:{jsonrpc:'2.0',id:1,result:{tools:[{name:'existing_tool'}]}}};
const call=a=>({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:a}});
test('catalog adds a non-idempotent administrative tool and preserves existing tools',()=>{
 const out=classify({method:'tools/list'},base);assert.deepEqual(out.response.result.tools.map(t=>t.name),['existing_tool',name]);assert.equal(base.response.result.tools.length,1);
 const tool=out.response.result.tools[1];assert.equal(tool.annotations.idempotentHint,false);assert.deepEqual(tool.inputSchema.required,['package_id','revision','event_id','preview_hash']);assert.equal(tool.inputSchema.additionalProperties,false);
 assert.equal(classify({method:'tools/list'},out),out);
});
test('recovery uses the resolved service actor and exact existing event/preview without a caller capability',()=>{
 const out=classify(call(args),base,identity);assert.equal(out.route,'telegram-attempt');assert.equal(out.request.action,'recover-unacknowledged');assert.deepEqual(out.request.body,{owner:'123',chat:'123',packageId:args.package_id,revision:12,eventId:args.event_id,previewHash:args.preview_hash});
});
test('rejects forged actor, capability, destination, malformed revision and scope fields',()=>{
 for(const patch of [{owner:'999'},{chat:'999'},{origin:{workflowId:'bnzVMNkZuGO1GQCZ',executionId:'123'}},{execution_id:'123'},{attempt_token:'d'.repeat(64)},{destination:'OPURO'},{revision:0},{revision:1.5},{revision:4294967296},{package_id:'bad'},{event_id:'evt_bad'},{preview_hash:'bad'}])assert.equal(classify(call({...args,...patch}),base,identity).response.error.code,-32602);
 for(const who of [null,{owner:'123',chat:'456'},{owner:'0',chat:'0'}])assert.equal(classify(call(args),base,who).response.error.code,-32602);
 for(const key of Object.keys(args)){const missing={...args};delete missing[key];assert.equal(classify(call(missing),base,identity).response.error.code,-32602)}
});
test('unrelated protocol calls pass through unchanged',()=>{
 for(const message of [{method:'events/list'},{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'iniciar_intento_telegram_opmx',arguments:{package_id:args.package_id,revision:12}}}])assert.equal(classify(message,base,identity),base);
 assert.equal(classify({...call(args),jsonrpc:'1.0'},base,identity).response.error.code,-32602);
 const notification=call(args);delete notification.id;assert.equal(classify(notification,base,identity).response.error.code,-32602);
});
test('only an exact successful guard recovery exposes its private capability',()=>{
 const request=classify(call(args),base,identity).request,token='d'.repeat(64);
 for(const status of ['UNACKNOWLEDGED_ATTEMPT_RECOVERED','BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED']){
 const result={status,eventId:args.event_id,token,retryPermitted:false,...(status==='BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED'?{packageId:args.package_id,revision:args.revision,decisionAcknowledgementRequired:true,writeAuthorized:false}:{})};
 const out=format(request,result).response.result;assert.deepEqual(out.structuredContent,{status:result.status,event_id:args.event_id,attempt_token:token,retryPermitted:false});assert.equal(out.isError,false);
 for(const patch of [{eventId:'evt_'+'f'.repeat(48)},{token:'bad'},{retryPermitted:true},{status:'ATTEMPT_STARTED'}]){
  const failed=format(request,{...result,...patch}).response.result;assert.deepEqual(failed.structuredContent,{status:'ATTEMPT_UNCONFIRMED',retryPermitted:false});assert.equal(failed.isError,true);assert.equal(JSON.stringify(failed).includes(token),false);
 }
 if(status==='BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED')for(const patch of [{packageId:'tg_'+'f'.repeat(40)},{revision:13},{decisionAcknowledgementRequired:false},{writeAuthorized:true}]){
  const failed=format(request,{...result,...patch}).response.result;assert.equal(failed.isError,true);assert.equal(JSON.stringify(failed).includes(token),false);
 }
 }
});
test('refusals and uncertain responses disclose no token and never permit retry',()=>{
 const request=classify(call(args),base,identity).request;
 assert.deepEqual(format(request,{status:'BLOCKED_RECOVERY_UNCONFIRMED',nextAction:'OBSERVE_ONLY',token:'d'.repeat(64),retryPermitted:false}).response.result.structuredContent,{status:'BLOCKED_RECOVERY_UNCONFIRMED',nextAction:'OBSERVE_ONLY',retryPermitted:false});
 for(const status of ['RECOVERY_NOT_AUTHORIZED','STALE_REVISION','RECOVERY_NOT_PERMITTED','RECONCILIATION_REQUIRED','DECISION_UNCONFIRMED','DECISION_MISMATCH'])assert.deepEqual(format(request,{status,token:'d'.repeat(64),retryPermitted:false}).response.result.structuredContent,{status,retryPermitted:false});
 for(const result of [null,{}, {status:'UNACKNOWLEDGED_ATTEMPT_RECOVERED',eventId:args.event_id}, {status:'UNKNOWN',token:'d'.repeat(64),retryPermitted:false}])assert.deepEqual(format(request,result).response.result.structuredContent,{status:'ATTEMPT_UNCONFIRMED',retryPermitted:false});
});
