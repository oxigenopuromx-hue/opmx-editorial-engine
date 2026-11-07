import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildCorrectionPreview,validateCorrectionConfirmation} from './correction-preview.mjs';
const id='tg_'+'a'.repeat(40),owner='b'.repeat(64),other='c'.repeat(64),item=n=>'ti_'+String(n).repeat(40);
const source=(n,state='STORED')=>({itemId:item(n),kind:'TEXT',state,sha256:String(n).repeat(64)});
function fixture(){return {packageId:id,baseRevision:8,revision:10,ownerKey:owner,actorKey:owner,before:[source(1),source(2)],after:[source(1,'DISCARDED'),source(2),source(3)],action:'UPDATE',mode:'LITERAL',destination:'OPURO',verifiedPosts:{OPURO:10268}}}
test('preview identifies exact changed items and existing post',()=>{
 const p=buildCorrectionPreview(fixture());assert.equal(p.mode,'LITERAL');assert.deepEqual(p.posts,[{destination:'OPURO',postId:10268}]);assert.deepEqual(p.changes.map(x=>[x.itemId,x.change]),[[item(1),'REMOVED'],[item(3),'ADDED']]);
 assert.equal(validateCorrectionConfirmation({preview:p,previewHash:p.previewHash,actorKey:owner,ownerKey:owner,currentRevision:10,explicitAction:'UPDATE'}),true);
});
test('confirmation fails on stale version, another sender, changed preview or wrong action',()=>{
 const p=buildCorrectionPreview(fixture()),v={preview:p,previewHash:p.previewHash,actorKey:owner,ownerKey:owner,currentRevision:10,explicitAction:'UPDATE'};
 for(const change of [{currentRevision:11},{actorKey:other},{actorKey:other,ownerKey:other},{explicitAction:'CREATE'},{preview:{...p,destination:'TODOS'}},{previewHash:'a'.repeat(64)}])assert.equal(validateCorrectionConfirmation({...v,...change}),false);
});
test('existing destinations need individually verified post IDs and cannot become create',()=>{
 for(const change of [{verifiedPosts:{}},{verifiedPosts:{OPURO:0}},{verifiedPosts:{OPOL:22}},{action:'CREATE'},{actorKey:other}])assert.throws(()=>buildCorrectionPreview({...fixture(),...change}),/CORRECTION_PREVIEW_UNCONFIRMED/);
});
test('original sources cannot be silently replaced or removed from the snapshot',()=>{
 for(const change of [x=>x.after.shift(),x=>x.after[1].sha256='f'.repeat(64),x=>x.after.push(x.after[0])]){const x=fixture();change(x);assert.throws(()=>buildCorrectionPreview(x),/CORRECTION_PREVIEW_UNCONFIRMED/)}
});
test('changed text is displayed as data only when its stored hash matches',()=>{
 const x=fixture(),text='Información nueva: no autoriza publicar';x.after[2].text=text;x.after[2].sha256=createHash('sha256').update(text).digest('hex');
 const p=buildCorrectionPreview(x);assert.equal(p.changes.find(c=>c.itemId===item(3)).text,text);
 x.after[2].text='Información alterada';assert.throws(()=>buildCorrectionPreview(x),/CORRECTION_PREVIEW_UNCONFIRMED/);
});
