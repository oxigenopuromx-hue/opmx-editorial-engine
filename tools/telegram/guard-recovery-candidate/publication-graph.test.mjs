import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicationOperations} from './receiver/build-publication-operations.mjs';
const scripts={prepare:await readFile(new URL('./receiver/publication-claim-prepare-candidate.js',import.meta.url),'utf8'),check:await readFile(new URL('./receiver/publication-claim-check-candidate.js',import.meta.url),'utf8')};
const guardCredential={id:'guard',name:'guard'};
const workflow={nodes:['Preflight conjunto publicación','¿Publicar OPURO?','Publicación rechazada antes de publicar','Protocolo MCP archivos','Responder MCP'].map(name=>({name})),connections:{'Preflight conjunto publicación':{main:[[{node:'¿Publicar OPURO?'}],[{node:'Publicación rechazada antes de publicar'}]]},'Publicación rechazada antes de publicar':{main:[[{node:'Responder MCP'}]]}}};
test('inserts the claim without changing the preflight error edge or adding consumers',()=>{
 const {names,operations}=buildPublicationOperations({workflow,scripts,guardCredential});
 assert.ok(operations.filter(x=>x.type==='addNode').every(x=>!x.node.type.includes('Trigger')));
 assert.deepEqual(operations.filter(x=>x.type==='removeConnection').map(x=>[x.source,x.target,x.sourceIndex]),[['Preflight conjunto publicación','¿Publicar OPURO?',0]]);
 for(const name of [names.prepare,names.claim,names.check,names.pass]){
  assert.ok(operations.some(x=>x.type==='setNodeSettings'&&x.nodeName===name&&x.settings.retryOnFail===false&&x.settings.onError==='continueErrorOutput'));
  assert.ok(operations.some(x=>x.type==='addConnection'&&x.source===name&&x.sourceIndex===1&&x.target===names.failure));
 }
 assert.ok(operations.some(x=>x.type==='addConnection'&&x.source===names.check&&x.target==='¿Publicar OPURO?'));
 assert.ok(operations.some(x=>x.type==='addConnection'&&x.source===names.failure&&x.target==='Responder MCP'));
});
test('fails if the live graph has drifted or already contains a claim gate',()=>{
 const bad=structuredClone(workflow);bad.connections['Preflight conjunto publicación'].main[0].push({node:'other'});
 assert.throws(()=>buildPublicationOperations({workflow:bad,scripts,guardCredential}),/PUBLICATION_GRAPH_CHANGED/);
 const duplicate=structuredClone(workflow);duplicate.nodes.push({name:'Publicación — Reclamo confirmado'});
 assert.throws(()=>buildPublicationOperations({workflow:duplicate,scripts,guardCredential}),/PUBLICATION_GRAPH_CONFLICT/);
});
