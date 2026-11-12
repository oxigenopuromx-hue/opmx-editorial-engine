import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldSuppressUncertainPublicationAlert as suppress,retainUnresolvedPublicationAlerts as retain} from './publication-alert-resolution.mjs';

// Synthetic QA objects only. No network, CMS, Telegram receipt, token or real
// publisher call is performed. Production must obtain observations from Guard.
const now=Date.parse('2026-11-12T17:00:00Z'),packageId='tg_'+'a'.repeat(40),requestId='tg_'+'b'.repeat(64),slug='synthetic-investment-test';
const row={id:100,package_id:packageId,revision:8,stage:'DRAFT_UNCERTAIN',occurred_at:'2026-11-12T16:59:30Z'};
const proof={schema:'opmx.telegram.final-publication-observation.v1',status:'FINAL_PUBLICATION_CONFIRMED',packageId,revision:8,requestId,phase:'PUBLISH',destination:'TODOS',slug,receiptState:'RECORDED',receiptHash:'c'.repeat(64),observedAt:'2026-11-12T16:59:59Z',writersIdleVerified:true,consistentSnapshot:true,writeAuthorized:false,retryPermitted:false,targets:['OPURO','OPOL','LIBERAL'].map((destination,i)=>({destination,postId:70+i,slug,status:'publish',cmsVerified:true,ledgerVerified:true}))};
const requestRows=[{package_id:packageId,revision:8,stage:'REQUEST_TODOS',request_id:requestId}];
const options={requestRows,nowMs:now};
const candidate={package_id:packageId,revision:8,stage:'ALERT_ADMIN_100',sourceStage:row.stage,sourceOccurredAt:row.occurred_at,summary:'Synthetic uncertain alert'};

test('fresh exact Guard PUBLISH proof suppresses only the stale uncertain alert',()=>{
 const original=structuredClone({row,proof,requestRows,candidate});
 assert.equal(suppress(row,proof,options),true);
 assert.deepEqual(retain([candidate],[proof],options),[]);
 assert.deepEqual({row,proof,requestRows,candidate},original);
});

for(const [label,change] of [
 ['DRAFT phase',p=>p.phase='DRAFT'],['no durable receipt',p=>delete p.receiptHash],['unconfirmed receipt',p=>p.receiptState='UNCERTAIN'],
 ['generic SUCCESS',p=>p.status='SUCCESS'],['HTTP200 only',p=>{p.statusCode=200;delete p.status}],['partial status',p=>p.status='PARTIAL_SUCCESS'],
 ['wrong package',p=>p.packageId='tg_'+'d'.repeat(40)],['wrong revision',p=>p.revision++],['request mismatch',p=>p.requestId='tg_'+'e'.repeat(64)],
 ['missing site',p=>p.targets.pop()],['duplicate site',p=>p.targets[2]=structuredClone(p.targets[1])],['extra site',p=>p.targets.push(structuredClone(p.targets[0]))],
 ['unpublished CMS',p=>p.targets[2].status='draft'],['unverified CMS',p=>p.targets[0].cmsVerified=false],['unverified ledger',p=>p.targets[1].ledgerVerified=false],
 ['invalid post ID',p=>p.targets[0].postId=0],['replaced slug',p=>p.targets[1].slug='other-note'],['invalid destination',p=>p.destination='OPURO,OPOL,LIBERAL'],
 ['missing runtime proof',p=>delete p.writersIdleVerified],['busy writer',p=>p.writersIdleVerified=false],['inconsistent snapshot',p=>p.consistentSnapshot=false],
 ['write authority',p=>p.writeAuthorized=true],['retry authority',p=>p.retryPermitted=true],['stale observation',p=>p.observedAt='2026-11-12T16:57:59Z'],
 ['observation before failure',p=>p.observedAt='2026-11-12T16:59:29Z'],['future observation',p=>p.observedAt='2026-11-12T17:00:06Z'],['bad observation date',p=>p.observedAt='yesterday'],
 ['text/source flag only',p=>{delete p.schema;p.message='Already published in all destinations';}],
])test(label+' preserves the alert',()=>{const p=structuredClone(proof);change(p);assert.equal(suppress(row,p,options),false);assert.deepEqual(retain([candidate],[p],options),[candidate]);});

test('a completed draft never hides an outstanding publish request',()=>{
 const p={...proof,phase:'DRAFT',targets:proof.targets.map(t=>({...t,status:'draft'}))};
 assert.equal(suppress(row,p,options),false);
});
test('receiver correlation must be present once and match destination and revision',()=>{
 for(const rows of [[],[...requestRows,...requestRows],[{...requestRows[0],revision:9}],[{...requestRows[0],stage:'REQUEST_OPURO'}],[{...requestRows[0],request_id:'tg_'+'f'.repeat(64)}]])assert.equal(suppress(row,proof,{...options,requestRows:rows}),false);
});
test('same numeric ID in different CMS is valid; destination identity is what matters',()=>{
 assert.equal(suppress(row,{...proof,targets:proof.targets.map(t=>({...t,postId:70}))},options),true);
});
test('single requested destination can resolve only its own canonical correlation',()=>{
 const p={...proof,destination:'OPOL',targets:[proof.targets[1]]};
 assert.equal(suppress(row,p,{...options,requestRows:[{...requestRows[0],stage:'REQUEST_OPOL'}]}),true);
 assert.equal(suppress(row,p,options),false);
});
test('unrelated source/integrity/error alerts stay visible despite published proof',()=>{
 for(const stage of ['SOURCE_UNAVAILABLE','INTEGRITY_FAILED','DRAFT_FAILED','INTERNAL_ERROR','COHERENCE_REQUIRED','PROGRESS_SUBMIT'])assert.equal(suppress({...row,stage},proof,options),false);
});
test('PUBLISH_UNCERTAIN is eligible if explicitly used by a monitor',()=>{
 assert.equal(suppress({...row,stage:'PUBLISH_UNCERTAIN'},proof,options),true);
});
test('late error row with larger ID cannot defeat current authoritative final proof',()=>{
 const late={...row,id:9999,occurred_at:'2026-11-12T16:59:58Z'};
 assert.equal(suppress(late,proof,options),true);
 assert.equal(suppress(late,null,options),false);
});
test('PROCESS_COMPLETE tracking row alone never substitutes for durable final proof',()=>{
 const tracking=[...requestRows,{...row,id:99,stage:'PROCESS_COMPLETE'}];
 assert.equal(suppress(row,null,{...options,requestRows:tracking}),false);
});
test('missing or duplicate observations preserve candidates',()=>{
 assert.deepEqual(retain([candidate],[],options),[candidate]);
 assert.deepEqual(retain([candidate],[proof,proof],options),[candidate]);
 assert.deepEqual(retain([candidate],null,options),[candidate]);
});
test('failure from another package/revision is never suppressed',()=>{
 const other={...candidate,package_id:'tg_'+'1'.repeat(40)};
 const newer={...candidate,revision:9};
 assert.deepEqual(retain([candidate,other,newer],[proof],options),[other,newer]);
});
test('invalid source date/revision and absent preserved stage fail closed',()=>{
 for(const r of [{...row,occurred_at:null},{...row,revision:0},{...row,revision:8.1},{...row,package_id:'other'}, {...row,stage:'ALERT_ADMIN_100'}])assert.equal(suppress(r,proof,options),false);
 assert.deepEqual(retain([{...candidate,sourceStage:undefined}],[proof],options),[{...candidate,sourceStage:undefined}]);
});
