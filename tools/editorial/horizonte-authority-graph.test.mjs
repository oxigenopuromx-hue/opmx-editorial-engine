import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {patchHorizonteAuthorityGraph as patch} from './horizonte-authority-graph.mjs';
const normalizerCode=fs.readFileSync(new URL('./horizonte-authoritative-catalog.mjs',import.meta.url),'utf8');
const credentials={id:'fixture',name:'fixture'};
for(const [kind,before,target,tail] of [['MCP','Consultar catálogo Horizonte','Validar clasificación Horizonte',"horizonteCatalog=normalizeHorizonteCatalog(await fetchHorizonteCatalog());fetchHorizonteCatalog:async()=>$input.first().json"],['WRITER','HORIZONTE — Consultar autores','HORIZONTE — Confirmar clasificación',"const catalog=normalizeHorizonteCatalog($('HORIZONTE — Consultar catálogo').first().json),r=$input.first().json;"]]){
 test(kind+' binds an independent fixed CMS contract before validation',()=>{
  const source="const errors=[],h=master?.CATEGORIAS?.HORIZONTE; !topics.includes(h.PRINCIPAL); !topics.includes(h.TEMA); "+tail;
  const old="!['politica','economia','sociedad-y-derechos','horizonte-verde','cultura-e-identidad'].includes(topic)";
  const input={nodes:[{name:before},{name:target,parameters:{jsCode:source}},...(kind==='WRITER'?['HORIZONTE — Preparar borrador','HORIZONTE — Verificar borrador'].map(name=>({name,parameters:{jsCode:old}})):[])],connections:{[before]:{main:[[{node:target,type:'main',index:0}]]}}};
  // Actual deployed code has a leading space before this declaration.
  input.nodes[1].parameters.jsCode=' '+source;
  const out=patch(input,{kind,normalizerCode,credentials});assert.equal(out.connections[before].main[0][0].node,'HORIZONTE — Consultar clasificación editorial');assert.match(out.nodes.find(n=>n.name===target).parameters.jsCode,/acceptedTopics/);assert.equal(input.nodes.length,kind==='WRITER'?4:2);
  assert.throws(()=>patch(out,{kind,normalizerCode,credentials}),/CHANGED/);
 });
}
