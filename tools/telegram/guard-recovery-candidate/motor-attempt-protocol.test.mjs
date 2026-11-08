import test from 'node:test';import assert from 'node:assert/strict';
import {classifyMotorAttempt,formatMotorAttempt} from './motor-attempt-protocol.mjs';
const package_id='tg_'+'a'.repeat(40),event_id='evt_'+'b'.repeat(48),attempt_token='c'.repeat(64),revision=7,base={httpStatus:200,response:{jsonrpc:'2.0',id:1,result:{tools:[]}}};
const call=(name,args)=>({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});
const identity={owner:'123',chat:'123'};
test('catalog exposes narrowly scoped attempt operations without a consumer',()=>{
 const x=classifyMotorAttempt({method:'tools/list'},base);assert.deepEqual(x.response.result.tools.map(t=>t.name),['iniciar_intento_telegram_opmx','bloquear_intento_telegram_opmx','reconocer_decision_telegram_opmx']);assert.equal(base.response.result.tools.length,0);
});
test('webhook package and revision select the guard operation with no invented event ID',()=>{
 const x=classifyMotorAttempt(call('iniciar_intento_telegram_opmx',{package_id,revision}),base,identity);assert.equal(x.route,'telegram-attempt');assert.deepEqual(x.request.body,{packageId:package_id,revision,owner:'123',chat:'123'});assert.equal(x.request.action,'start');
 for(const args of [{package_id,revision,event_id},{package_id,revision:0},{package_id:'bad',revision}])assert.equal(classifyMotorAttempt(call('iniciar_intento_telegram_opmx',args),base,identity).response.error.code,-32602);
 assert.equal(classifyMotorAttempt(call('iniciar_intento_telegram_opmx',{package_id,revision}),base,{owner:'123',chat:'456'}).response.error.code,-32602);
});
test('blocking requires the capability and never reports that reopening is safe',()=>{
 const x=classifyMotorAttempt(call('bloquear_intento_telegram_opmx',{package_id,revision,event_id,attempt_token}),base,identity);assert.deepEqual(x.request.body,{packageId:package_id,revision,eventId:event_id,token:attempt_token});
 const out=formatMotorAttempt(x.request,{status:'ATTEMPT_BLOCKED'}).response.result.structuredContent;assert.deepEqual(out,{status:'ATTEMPT_BLOCKED',reopenPermitted:false,retryPermitted:false});
 assert.equal(classifyMotorAttempt(call('bloquear_intento_telegram_opmx',{package_id,revision,event_id,attempt_token:'bad'}),base,identity).response.error.code,-32602);
});
test('malformed or uncertain replies cannot provide a capability or permit retry',()=>{
 const request=classifyMotorAttempt(call('iniciar_intento_telegram_opmx',{package_id,revision}),base,identity).request;
 for(const result of [{status:'ATTEMPT_STARTED',eventId:event_id},{status:'ATTEMPT_STARTED',eventId:'bad',token:attempt_token},null,{status:'unknown'}])assert.deepEqual(formatMotorAttempt(request,result).response.result.structuredContent,{status:'ATTEMPT_UNCONFIRMED',retryPermitted:false});
 assert.deepEqual(formatMotorAttempt(request,{status:'ATTEMPT_STARTED',eventId:event_id,token:attempt_token}).response.result.structuredContent,{status:'ATTEMPT_STARTED',event_id,attempt_token,retryPermitted:false});
});
test('decision acknowledgement binds exact structured fields and accepts only its matching result',()=>{
 const args={package_id,revision,event_id,attempt_token,preview_hash:'d'.repeat(64),destination:'OPURO',content_mode:'LITERAL',action:'CREATE'};
 const request=classifyMotorAttempt(call('reconocer_decision_telegram_opmx',args),base,identity).request;assert.equal(request.action,'decision');assert.equal(request.body.previewHash,args.preview_hash);
 assert.equal(formatMotorAttempt(request,{status:'DECISION_ACKNOWLEDGED',packageId:package_id,revision}).response.result.structuredContent.status,'DECISION_ACKNOWLEDGED');
 assert.equal(formatMotorAttempt(request,{status:'DECISION_ACKNOWLEDGED',packageId:'tg_'+'d'.repeat(40),revision}).response.result.structuredContent.status,'ATTEMPT_UNCONFIRMED');
 const update=classifyMotorAttempt(call('reconocer_decision_telegram_opmx',{...args,action:'UPDATE'}),base,identity).request;
 assert.equal(update.body.action,'UPDATE');assert.equal(formatMotorAttempt(update,{status:'UPDATE_ENFORCEMENT_UNCONFIRMED'}).response.result.structuredContent.retryPermitted,false);
 assert.equal(classifyMotorAttempt(call('reconocer_decision_telegram_opmx',{...args,action:'OTHER'}),base,identity).response.error.code,-32602);
});
