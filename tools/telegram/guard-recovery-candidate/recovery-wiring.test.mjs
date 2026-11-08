import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createRecoveryWiring,createRecoveryGuard} from './recovery-wiring.mjs';
const pool={async getConnection(){throw Error('unexpected DB')}},events={async initialize(){},async enqueue(){},async run(){}},reviews={async run(){}};
const options={pool,secret:'a'.repeat(64),events,reviews,adminUserIds:[],verifyTerminalRun:async()=>null,verifyWriterCoverage:async()=>null,verifyDecisionConsumer:async()=>false,legacyTargetBegin:async()=>({status:'not_reserved'})};
test('requires all three server-owned verifier interfaces and the existing stores',()=>{
 for(const missing of ['verifyTerminalRun','verifyWriterCoverage','verifyDecisionConsumer','events','reviews','secret'])assert.throws(()=>createRecoveryWiring({...options,[missing]:null}),/RECOVERY_WIRING_INCOMPLETE/);
});
test('wires the existing guard, event store and recovery paths without starting a consumer',()=>{
 const w=createRecoveryWiring(options);assert.equal(w.telegramEvents,events);assert.equal(w.telegramReviews,reviews);assert.equal(typeof w.telegramStore.run,'function');
 for(const key of ['telegramRecovery','telegramBlockedList','telegramPublicationBegin','targetBegin'])assert.equal(typeof w[key],'function');
 for(const [key,methods] of [['telegramAttempts',['begin','block','start']],['telegramCorrections',['preview','confirm']],['telegramSelections',['select']],['telegramPreviewDelivery',['initialize','claim','report']]])for(const method of methods)assert.equal(typeof w[key][method],'function');
 assert.ok(Object.isFrozen(w));
 assert.equal(w.telegramUpdateClaims,null);
});
test('update claims remain absent unless all server-owned providers exist',()=>{
 assert.throws(()=>createRecoveryWiring({...options,updateProviders:{}}),/UPDATE_CLAIM_CONFIGURATION_INCOMPLETE/);
 assert.throws(()=>createRecoveryWiring({...options,updateProviders:{pool,loadVerifiedDecision:async()=>null,loadVerifiedPayloadEvidence:async()=>null}}),/UPDATE_CLAIM_CONFIGURATION_INCOMPLETE/);
 assert.throws(()=>createRecoveryWiring({...options,updateProviders:{loadVerifiedPayloadEvidence:async()=>null,verifyUpdateReadiness:async()=>false}}),/UPDATE_CLAIM_CONFIGURATION_INCOMPLETE/);
 const w=createRecoveryWiring({...options,updateProviders:{loadVerifiedPayloadEvidence:async()=>null,readVerifiedUpdatePosts:async()=>null,verifyUpdateReadiness:async()=>false,verifyUpdateEnforcement:async()=>false}});assert.equal(typeof w.telegramUpdateClaims.begin,'function');
});
test('wired guard requires the existing bearer before recovery access',async()=>{
 const server=createRecoveryGuard(options);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const status=await new Promise((resolve,reject)=>{const q=request({hostname:'127.0.0.1',port:server.address().port,path:'/v1/telegram/packages/reopen',method:'POST',headers:{authorization:'Bearer '+'b'.repeat(64),'content-type':'application/json'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode))});q.on('error',reject);q.end('{}')});assert.equal(status,401)}finally{await new Promise(r=>server.close(r))}
});
test('an unavailable outbox stops recovery confirmation before any DB transaction',async()=>{
 let dbCalls=0,initCalls=0;
 const w=createRecoveryWiring({...options,pool:{async getConnection(){dbCalls++;throw Error('unexpected DB')}},events:{...events,async initialize(){initCalls++;throw Error('OUTBOX_UNAVAILABLE')}}});
 await assert.rejects(()=>w.telegramCorrections.confirm({}),/OUTBOX_UNAVAILABLE/);assert.equal(initCalls,1);assert.equal(dbCalls,0);
});
