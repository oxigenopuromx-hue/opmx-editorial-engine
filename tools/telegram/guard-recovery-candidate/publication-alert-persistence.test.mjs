import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationAlertRequestId,publicationAlertWasReconciled,preparePublicationReconciliations,publicationReconciliationInsertConfirmed,retainAlertsWithoutPublicationReconciliation} from './publication-alert-persistence.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';

const now=Date.parse('2026-11-12T23:06:59.000Z'),packageId='tg_'+'a'.repeat(40),other='tg_'+'b'.repeat(40),requestId='tg_'+'c'.repeat(64),otherRequest='tg_'+'e'.repeat(64),revision=23,slug='qa-published-note';
const candidate={package_id:packageId,revision,sourceStage:'DRAFT_UNCERTAIN',sourceOccurredAt:'2026-11-12T23:05:50.784Z',sourceRequestId:null};
const binding={package_id:packageId,revision,stage:'REQUEST_TODOS',request_id:requestId};
const record={package_id:packageId,revision,stage:'PUBLICATION_RECONCILED',occurred_at:new Date(now).toISOString(),request_id:requestId};
const ack={...record,id:1752,chat_id:null,createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};
const proof={schema:'opmx.telegram.final-publication-observation.v1',status:'FINAL_PUBLICATION_CONFIRMED',packageId,revision,requestId,phase:'PUBLISH',destination:'TODOS',slug,receiptHash:'d'.repeat(64),receiptState:'RECORDED',writeAuthorized:false,retryPermitted:false,writersIdleVerified:true,consistentSnapshot:true,observedAt:'2026-11-12T23:06:55.860Z',targets:['OPURO','OPOL','LIBERAL'].map((destination,i)=>({destination,postId:100+i,slug,status:'publish',cmsVerified:true,ledgerVerified:true}))};
const options={requestRows:[binding],nowMs:now};

test('fresh Guard final publication creates only technical reconciliation, without false Motor completion',()=>{
 const records=preparePublicationReconciliations([candidate],[proof],options);assert.deepEqual(records,[record]);assert.equal(Object.hasOwn(records[0],'chat_id'),false);assert.equal(JSON.stringify(records).includes('PROCESS_COMPLETE'),false);assert.equal(JSON.stringify(records).includes('ATTEMPT_COMPLETED'),false);
});
test('confirmed first cycle followed by unavailable Guard does not revive historical uncertainty',()=>{
 const [row]=preparePublicationReconciliations([candidate],[proof],options);assert.equal(publicationReconciliationInsertConfirmed(row,ack),true);
 const future={...options,nowMs:now+5*60000};
 assert.equal(publicationAlertWasReconciled(candidate,[ack],future),true);
 assert.deepEqual(retainAlertsWithoutPublicationReconciliation([candidate],[ack],future),[]);
 assert.deepEqual(preparePublicationReconciliations([candidate],[{status:'FINAL_PUBLICATION_UNCONFIRMED'}],{...future,reconciliationRows:[ack]}),[]);
});
test('a raw positive observation does not supersede uncertainty until its row is durably inserted',()=>{assert.deepEqual(retainAlertsWithoutPublicationReconciliation([candidate],[],options),[candidate]);assert.equal(publicationAlertWasReconciled(candidate,[record],options),false);});
test('duplicate identical durable reconciliations remain idempotent after a lost ACK',()=>{assert.equal(publicationAlertWasReconciled(candidate,[ack,{...ack,id:1753}],options),true);assert.deepEqual(preparePublicationReconciliations([candidate],[proof],{...options,reconciliationRows:[ack,ack]}),[]);});
test('duplicate candidates generate one INSERT for the same scope/request',()=>{assert.equal(preparePublicationReconciliations([candidate,candidate],[proof],options).length,1);});
test('late progress is superseded only for the reconciled request',()=>{const late={...candidate,sourceStage:'PROGRESS_SUBMIT',sourceOccurredAt:'2026-11-12T23:20:00.000Z'};assert.equal(publicationAlertWasReconciled(late,[ack],{...options,nowMs:now+3600000}),true);assert.equal(publicationAlertWasReconciled({...late,sourceRequestId:otherRequest},[ack],{...options,requestRows:[binding,{...binding,stage:'REQUEST_OPURO',request_id:otherRequest}]}),false);});
test('late uncertainty does not require the durable publication timestamp to follow the late report',()=>{const late={...candidate,sourceOccurredAt:'2026-11-12T23:20:00.000Z'};assert.equal(publicationAlertWasReconciled(late,[ack],{...options,nowMs:now+3600000}),true);});
for(const sourceStage of ['SOURCE_UNAVAILABLE','CONTENT_INSUFFICIENT','MEDIA_FAILED','VALIDATION_FAILED','DRAFT_FAILED','INTERNAL_ERROR','COHERENCE_REQUIRED','INTEGRITY_FAILED','REVIEW_NOT_CONFIRMED'])test('does not silence unrelated blocker '+sourceStage,()=>{assert.equal(publicationAlertWasReconciled({...candidate,sourceStage},[ack],options),false);});
for(const [name,changed] of [['another package',{...ack,package_id:other}],['another revision',{...ack,revision:24}],['another request',{...ack,request_id:otherRequest}],['no ID',{...ack,id:undefined}],['invalid timestamp',{...ack,occurred_at:'bad'}],['future record',{...ack,occurred_at:new Date(now+60000).toISOString()}]])test('does not reuse terminal from '+name,()=>{assert.equal(publicationAlertWasReconciled(candidate,[changed],options),false);});
test('explicit source request is preserved; ambiguous legacy stages stay unresolved',()=>{
 const many=[binding,{...binding,stage:'REQUEST_OPURO',request_id:otherRequest}];
 assert.equal(publicationAlertRequestId(candidate,many),null);
 assert.equal(publicationAlertRequestId({...candidate,sourceRequestId:otherRequest},many),otherRequest);
 assert.equal(publicationAlertWasReconciled({...candidate,sourceRequestId:otherRequest},[ack],{...options,requestRows:many}),false);
 assert.deepEqual(preparePublicationReconciliations([{...candidate,sourceRequestId:otherRequest}],[proof],{...options,requestRows:many}),[]);
 assert.equal(publicationAlertRequestId({...candidate,sourceRequestId:'invalid'},[binding]),null);
});
test('all seven canonical bindings do not prevent the verified final Guard request from resolving a legacy null stage',()=>{
 const p='tg_dd8ff15fbc93b83b3e579c4266d5aea4bcf2be7b',rev=23,labels=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
 const requestRows=labels.map(destination=>({package_id:p,revision:rev,stage:'REQUEST_'+destination,request_id:expectedDraftRequestId({packageId:p,revision:rev,destination})}));
 const selected=expectedDraftRequestId({packageId:p,revision:rev,destination:'TODOS'});assert.equal(selected,'tg_ada79f9b78fbf8ad073b6ced861a2d8c0dbdca7cd517b7185b99cd7eb9de3917');
 const legacy={...candidate,package_id:p,revision:rev,sourceRequestId:null};
 const final={...proof,packageId:p,revision:rev,requestId:selected,slug:'samuel-hernandez-observaciones-asf-tecamac',targets:['OPURO','OPOL','LIBERAL'].map((destination,i)=>({destination,postId:[10528,3537,408][i],slug:'samuel-hernandez-observaciones-asf-tecamac',status:'publish',cmsVerified:true,ledgerVerified:true}))};
 const o={requestRows,nowMs:now},records=preparePublicationReconciliations([legacy],[final],o);assert.equal(records.length,1);assert.equal(records[0].request_id,selected);
 const terminal={...records[0],id:1752,occurred_at:'2026-11-12T23:06:55.860Z'};assert.equal(publicationAlertWasReconciled(legacy,[terminal],o),true);
 assert.equal(publicationAlertWasReconciled({...legacy,sourceStage:'PROGRESS_SUBMIT',sourceOccurredAt:'2026-11-12T23:20:00.000Z'},[terminal],{...o,nowMs:now+3600000}),true);
 assert.equal(publicationAlertWasReconciled({...legacy,sourceRequestId:requestRows[0].request_id},[terminal],o),false);
 assert.equal(publicationAlertWasReconciled(legacy,[terminal,{...terminal,id:1753,request_id:requestRows[0].request_id}],o),false);
 assert.deepEqual(preparePublicationReconciliations([legacy],[final],{...o,reconciliationRows:[terminal,{...terminal,id:1753,request_id:requestRows[0].request_id}]}),[]);
 assert.deepEqual(preparePublicationReconciliations([{...legacy,sourceRequestId:requestRows[0].request_id}],[final],o),[]);
});
for(const [name,changed] of [['missing ID',{...ack,id:undefined}],['wrong package',{...ack,package_id:other}],['wrong revision',{...ack,revision:24}],['wrong request',{...ack,request_id:otherRequest}],['wrong stage',{...ack,stage:'PROCESS_COMPLETE'}],['wrong time',{...ack,occurred_at:new Date(now+1).toISOString()}],['error response',{...ack,error:'INSERT acknowledgement lost'}]])test('rejects INSERT acknowledgement: '+name,()=>{assert.equal(publicationReconciliationInsertConfirmed(record,changed),false);});
test('normalised timestamp offset is accepted for the same stored instant',()=>{assert.equal(publicationReconciliationInsertConfirmed(record,{...ack,occurred_at:'2026-11-12T17:06:59-06:00'}),true);});
for(const [name,changed] of [['DRAFT',{...proof,phase:'DRAFT'}],['no receipt',{...proof,receiptHash:null}],['old proof',{...proof,observedAt:'2026-11-12T23:00:00.000Z'}],['other request',{...proof,requestId:otherRequest}],['partial',{...proof,targets:proof.targets.slice(0,2)}],['Guard unavailable',{status:'FINAL_PUBLICATION_UNCONFIRMED'}]])test('does not persist '+name,()=>{assert.deepEqual(preparePublicationReconciliations([candidate],[changed],options),[]);});
test('multiple disagreeing observations stay unresolved',()=>{assert.deepEqual(preparePublicationReconciliations([candidate],[proof,{...proof,requestId:otherRequest}],options),[]);});
