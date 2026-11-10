import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {enqueuePreviewGeneration} from './preview-generation-outbox.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const actorKey=hash('opmx:telegram:v1:123:123');
const x={packageId:'tg_'+'a'.repeat(40),revision:10,baseRevision:7,ownerKey:'b'.repeat(64),actorKey,destination:'AMBOS',receiptId:'telegram-123-12-12'};
function mock(){let saved;return {get saved(){return saved},async execute(sql,args){if(sql.startsWith('INSERT IGNORE')){if(saved)return [{affectedRows:0}];const [job_id,package_id,revision,base_revision,owner_key,actor_key,destination]=args;saved={job_id,package_id,revision,base_revision,owner_key,actor_key,destination,state:'PENDING'};return [{affectedRows:1}]}if(sql.startsWith('SELECT job_id'))return [[saved]];throw Error(sql)}}}
test('authenticated preview request queues once without content or publication authority',async()=>{
 const c=mock(),a=await enqueuePreviewGeneration(c,x),b=await enqueuePreviewGeneration(c,x);
 assert.equal(a.status,'PREVIEW_QUEUED');assert.equal(b.status,'PREVIEW_ALREADY_QUEUED');assert.equal(a.jobId,b.jobId);assert.equal(c.saved.state,'PENDING');
});
test('an identity mismatch, changed scope, or uncertain job never grants a replay',async()=>{
 for(const invalid of [{...x,actorKey:'f'.repeat(64)},{...x,destination:'OPOL,OPURO'},{...x,revision:7},{...x,extra:'bad'}])await assert.rejects(()=>enqueuePreviewGeneration(mock(),invalid),/INVALID_PREVIEW_GENERATION_REQUEST/);
 const c=mock();await enqueuePreviewGeneration(c,x);await assert.rejects(()=>enqueuePreviewGeneration(c,{...x,destination:'OPURO'}),/PREVIEW_GENERATION_CONFLICT/);
 c.saved.state='UNCERTAIN';await assert.rejects(()=>enqueuePreviewGeneration(c,x),/PREVIEW_GENERATION_CONFLICT/);
});
