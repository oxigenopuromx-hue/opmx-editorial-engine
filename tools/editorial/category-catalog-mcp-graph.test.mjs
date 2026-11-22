import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {patchCategoryCatalogGraph as patch} from './category-catalog-mcp-graph.mjs';
const adapterCode=fs.readFileSync(new URL('./category-catalog-mcp.mjs',import.meta.url),'utf8');
const credentials=Object.fromEntries(['OPURO','OPOL','LIBERAL'].map((s,i)=>[s,{key:i===2?'wordpressApi':'httpBasicAuth',id:'id',name:'name'}]));
const fixture={nodes:[{name:'Protocolo MCP archivos',parameters:{jsCode:'return [{json:unackRecovery.classifyUnacknowledgedRecovery()}];'}},{name:'¿Notificación MCP?'},{name:'Responder MCP'}],connections:{'Protocolo MCP archivos':{main:[[{node:'¿Notificación MCP?',type:'main',index:0}]]}}};
test('preserves the existing route and adds fixed-host read-only branches',()=>{
 const g=patch(fixture,{adapterCode,credentials});assert.equal(g.connections['¿Ruta catálogo editorial?'].main[1][0].node,'¿Notificación MCP?');
 for(const s of ['OPURO','OPOL','LIBERAL']){const n=g.nodes.find(x=>x.name==='Catálogo '+s);assert.equal(n.parameters.method,'GET');assert.equal(n.parameters.options.redirect.redirect.followRedirects,false);assert.equal(n.parameters.url.includes('request.page'),true)}
 assert.equal(fixture.nodes.length,3);
});
test('fails closed for changed route, missing credentials, duplicate patch and missing adapter',()=>{
 assert.throws(()=>patch(fixture,{adapterCode,credentials:{}}),/CREDENTIAL/);
 assert.throws(()=>patch(fixture,{adapterCode:'',credentials}),/INVALID/);
 const changed=structuredClone(fixture);changed.connections['Protocolo MCP archivos'].main[0][0].node='OTHER';assert.throws(()=>patch(changed,{adapterCode,credentials}),/CHANGED/);
 assert.throws(()=>patch(patch(fixture,{adapterCode,credentials}),{adapterCode,credentials}),/CHANGED/);
});
