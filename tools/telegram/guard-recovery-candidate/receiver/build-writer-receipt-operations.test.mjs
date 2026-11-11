import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {buildWriterReceiptOperations} from './build-writer-receipt-operations.mjs';
const protocol=await readFile(new URL('../writer-receipt-protocol.mjs',import.meta.url),'utf8'),guardCredential={id:'existing-guard',name:'Existing Guard'};
const workflow={id:'bnzVMNkZuGO1GQCZ',nodes:[{name:'Resultado publicación MCP',type:'n8n-nodes-base.code',position:[100,200]}],connections:{'Resultado publicación MCP':{main:[[{node:'Avisar',index:0}],[{node:'Error previo',index:0}]]}}};
test('receipt insertion preserves existing result and error routing and never creates a trigger',()=>{
 const {operations,names}=buildWriterReceiptOperations({workflow,phase:'PUBLISH',protocol,guardCredential});
 assert.deepEqual(operations.filter(o=>o.type==='removeConnection').map(o=>[o.source,o.target,o.sourceIndex]),[['Resultado publicación MCP','Avisar',0]]);
 assert.ok(operations.some(o=>o.type==='addConnection'&&o.source===names.finish&&o.target==='Avisar'));
 assert.ok(operations.filter(o=>o.type==='addNode').every(o=>!o.node.type.toLowerCase().includes('trigger')));
 const http=operations.find(o=>o.node?.name===names.call).node;assert.equal(http.credentials.httpHeaderAuth.id,guardCredential.id);assert.equal(http.parameters.url,'https://publisher.oxigenopuro.com.mx/v1/telegram/writers/report');
 const codes=operations.filter(o=>o.node?.type==='n8n-nodes-base.code');for(const o of codes)assert.doesNotThrow(()=>new Function('$input','$',o.node.parameters.jsCode));
});
test('refuses the wrong writer phase or duplicate integration',()=>{
 assert.throws(()=>buildWriterReceiptOperations({workflow,phase:'DRAFT',protocol,guardCredential}),/WRITER_GRAPH_UNCONFIRMED/);
 const duplicate=structuredClone(workflow);duplicate.nodes.push({name:'Acuse PUBLISH — Guard'});assert.throws(()=>buildWriterReceiptOperations({workflow:duplicate,phase:'PUBLISH',protocol,guardCredential}),/ALREADY_INSTALLED/);
});
