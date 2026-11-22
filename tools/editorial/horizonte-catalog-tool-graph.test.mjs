import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {patchCategoryCatalogGraph} from './category-catalog-mcp-graph.mjs';
import {patchHorizonteCatalogToolGraph as patch} from './horizonte-catalog-tool-graph.mjs';
const read=n=>fs.readFileSync(new URL('./'+n+'.mjs',import.meta.url),'utf8');
const c={id:'id',name:'name',key:'httpBasicAuth'},credentials={OPURO:c,OPOL:c,LIBERAL:c};
const base={nodes:[{name:'Protocolo MCP archivos',parameters:{jsCode:'return [{json:unackRecovery.classifyUnacknowledgedRecovery()}];'}},{name:'¿Notificación MCP?'},{name:'Responder MCP'}],connections:{'Protocolo MCP archivos':{main:[[{node:'¿Notificación MCP?',type:'main',index:0}]]}}};
const args={termsCode:read('horizonte-catalog'),authorityCode:read('horizonte-authoritative-catalog'),formatterCode:read('horizonte-catalog-tool'),credentials:c};
test('adds authenticated terms and editorial classification before returning a scoped catalog',()=>{
 const old=patchCategoryCatalogGraph(base,{adapterCode:read('category-catalog-mcp'),credentials}),g=patch(old,args);
 assert.equal(g.connections['¿Catálogo LIBERAL?'].main[1][0].node,'¿Catálogo HORIZONTE?');
 assert.equal(g.connections['Catálogo HORIZONTE términos'].main[0][0].node,'Catálogo HORIZONTE autorizadas');
 for(const name of ['Catálogo HORIZONTE términos','Catálogo HORIZONTE autorizadas']){const n=g.nodes.find(x=>x.name===name);assert.match(n.parameters.url,/^https:\/\/cms\.horizontedecalifornia\.mx\//);assert.equal(n.parameters.options.redirect.redirect.followRedirects,false)}
 assert.throws(()=>patch(g,args),/CHANGED/);
});
