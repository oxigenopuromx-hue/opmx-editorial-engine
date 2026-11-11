import test from 'node:test';import assert from 'node:assert/strict';
import {parseUpdateDeliveryJob,acceptUpdateDeliveryGrant,updateDeliveryResult} from './update-delivery-protocol.mjs';
const job={jobId:'uj_'+'1'.repeat(48),token:'2'.repeat(64)};
const response={statusCode:200,body:{status:'UPDATE_PAYLOAD_GRANTED',jobId:job.jobId,destination:'OPURO',postId:5,payload:{title:'Corregido'},retryPermitted:false}};
test('only an opaque job may enter the transport; source fields cannot select an ID, payload or URL',()=>{
 assert.deepEqual(parseUpdateDeliveryJob(job),job);
 for(const extra of [{postId:6},{payload:{}},{url:'https://example.org'},{destination:'OPOL'}])assert.throws(()=>parseUpdateDeliveryJob({...job,...extra}));
 for(const change of [{token:'x'},{jobId:'abc'}])assert.throws(()=>parseUpdateDeliveryJob({...job,...change}));
});
test('the writer accepts only the original one-use Guard grant',()=>{
 const grant=acceptUpdateDeliveryGrant(job,response);assert.equal(grant.postId,5);assert.notEqual(grant.payload,response.body.payload);
 for(const change of [{postId:0},{jobId:'uj_'+'3'.repeat(48)},{destination:'EVIL'},{payload:{slug:'new'}},{retryPermitted:true},{status:'ALREADY_STARTED'}])assert.throws(()=>acceptUpdateDeliveryGrant(job,{...response,body:{...response.body,...change}}));
 assert.throws(()=>acceptUpdateDeliveryGrant(job,{...response,statusCode:409}));
});
test('a wrong ID, lost response or non-2xx never becomes success or retry authority',()=>{
 const g=acceptUpdateDeliveryGrant(job,response);
 assert.equal(updateDeliveryResult(g,{statusCode:200,body:{id:5}}).status,'UPDATE_TRANSPORT_CONFIRMED');
 for(const r of [null,{statusCode:200,body:{id:6}},{statusCode:500,body:{id:5}}])assert.deepEqual(updateDeliveryResult(g,r),{status:'UPDATE_TRANSPORT_UNCERTAIN',retryPermitted:false});
});
