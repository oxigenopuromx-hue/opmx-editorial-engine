import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPreviewOperations} from './receiver/build-preview-operations.mjs';
const scripts=Object.fromEntries(await Promise.all(['identity','next','send','ack'].map(async name=>[name,await readFile(new URL('./receiver/preview-delivery-'+name+'-candidate.js',import.meta.url),'utf8')])));
const credentials={guardCredential:{id:'guard',name:'guard'},telegramCredential:{id:'bot',name:'bot'}};
test('preview graph reuses the existing receiver and does not add triggers or consumers',()=>{
 const {names,operations}=buildPreviewOperations({...credentials,scripts});
 const nodes=operations.filter(x=>x.type==='addNode').map(x=>x.node);
 assert.ok(nodes.every(n=>!n.type.includes('Trigger')));
 const telegram=nodes.find(n=>n.name===names.telegram);assert.equal(telegram.parameters.chatId,'={{ $json.telegram.chatId }}');assert.equal(telegram.parameters.text,'={{ $json.telegram.text }}');
 assert.equal(operations.filter(x=>x.type==='removeConnection').length,1);
 assert.ok(operations.some(x=>x.type==='addConnection'&&x.source===names.report&&x.target===names.next));
 assert.ok(operations.some(x=>x.type==='addConnection'&&x.source===names.branch&&x.sourceIndex===1&&x.target==='Conservar operación sin sellado'));
 for(const name of [names.preview,names.init,names.claim,names.telegram,names.report])assert.ok(operations.some(x=>x.type==='setNodeSettings'&&x.nodeName===name&&x.settings.retryOnFail===false&&x.settings.onError==='continueRegularOutput'));
 for(const operation of operations.filter(x=>x.type==='setNodeSettings'))assert.ok(operations.findIndex(x=>x.type==='addNode'&&x.node.name===operation.nodeName)<operations.indexOf(operation));
 assert.ok(!JSON.stringify(telegram.parameters).includes('token'));
});
test('cannot build a graph with missing scripts or credential references',()=>{
 assert.throws(()=>buildPreviewOperations({...credentials,scripts:{...scripts,ack:''}}),/PREVIEW_SCRIPT_MISSING/);
 assert.throws(()=>buildPreviewOperations({scripts,...credentials,guardCredential:{}}),/PREVIEW_CREDENTIAL_MISSING/);
});
