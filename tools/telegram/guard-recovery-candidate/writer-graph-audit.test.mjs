import test from 'node:test';import assert from 'node:assert/strict';import {auditWriterGraph} from './writer-graph-audit.mjs';
const edge=node=>({node,type:'main',index:0});
function fixture(){return {mode:'draft',nodes:[{name:'In',type:'n8n-nodes-base.webhook'},{name:'GUARD OPOL — Verificar destino',type:'n8n-nodes-base.code'},{name:'Write',type:'n8n-nodes-base.httpRequest',parameters:{method:'POST',url:'https://cms.oxigenopolitico.com.mx/wp-json/wp/v2/posts'}}],connections:{In:{main:[[edge('GUARD OPOL — Verificar destino')]]},'GUARD OPOL — Verificar destino':{main:[[edge('Write')]]}}};}
test('every route to a draft write must pass the destination guard',()=>{const x=fixture();assert.equal(auditWriterGraph(x)[0].guarded,true);x.connections.In.main[0].push(edge('Write'));assert.equal(auditWriterGraph(x)[0].guarded,false)});
test('structural guard checks are never presented as a verified recovery fence',()=>{
 const x=fixture();assert.equal(auditWriterGraph(x)[0].atomicFenceVerified,false);assert.equal(auditWriterGraph({...x,fenceEnabled:true})[0].atomicFenceVerified,false);
 x.mode='publication';x.nodes[1].name='Preflight conjunto publicación';x.connections.In.main[0][0].node=x.nodes[1].name;x.connections[x.nodes[1].name]=x.connections['GUARD OPOL — Verificar destino'];delete x.connections['GUARD OPOL — Verificar destino'];
 assert.equal(auditWriterGraph({...x,fenceEnabled:true})[0].atomicFenceVerified,false);assert.equal(auditWriterGraph(x)[0].claimGatePresent,false);
});
test('unknown hosts and missing triggers are not considered verified',()=>{const x=fixture();x.nodes[2].parameters.url='https://unknown.example/wp-json/wp/v2/posts';assert.equal(auditWriterGraph(x)[0].guarded,false);x.nodes.shift();assert.throws(()=>auditWriterGraph(x),/TRIGGER_MISSING/)});
