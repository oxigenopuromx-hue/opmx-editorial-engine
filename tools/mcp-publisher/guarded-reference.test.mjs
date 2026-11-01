import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['tools/mcp-publisher/build-guarded-reference.mjs','--check']);
const w=JSON.parse(readFileSync('workflows/publisher/OPMX_BORRADOR_GUARDADO_OPURO_REFERENCIA_NO_ACTIVAR.json'));
const byName=Object.fromEntries(w.nodes.map(n=>[n.name,n]));
function reachable(blocked=[]) {
 const seen=new Set(),queue=['Entrada de prueba protegida'];
 while(queue.length){const name=queue.shift();if(seen.has(name)||blocked.includes(name))continue;seen.add(name);for(const ports of Object.values(w.connections[name]??{}))for(const branch of ports??[])for(const edge of branch??[])queue.push(edge.node);}
 return seen;
}
test('referencia inactiva no contiene credenciales ni nodos de publicación',()=>{
 assert.equal(w.active,false);assert.ok(w.nodes.every(n=>!n.credentials&&!n.webhookId));
 assert.ok(w.nodes.every(n=>!/^OP(?:URO|OL) — Publicar$/.test(n.name)));
 assert.equal(new Set(w.nodes.map(n=>n.id)).size,w.nodes.length);
 for(const [source,con] of Object.entries(w.connections)){assert.ok(byName[source]);for(const ports of Object.values(con))for(const branch of ports??[])for(const edge of branch??[])assert.ok(byName[edge.node],edge.node);}
});
test('todas las escrituras requieren reserva e inicio de destino',()=>{
 const writes=w.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest'&&n.parameters.method==='POST'&&String(n.parameters.url).includes('/wp-json/')).map(n=>n.name);
 assert.ok(writes.length>=5);for(const blocker of ['OPMX — Verificar reserva','GUARD — Verificar destino']){const seen=reachable([blocker]);for(const name of writes)assert.equal(seen.has(name),false,name);}
});
test('las cargas y la nota quedan detrás de los hitos de guard',()=>{
 for(const [blocker,target] of [['GUARD — Verificar inicio Hero','OPURO — Subir HERO'],['GUARD — Verificar reporte Hero','OPURO — Subir DESTACADA'],['GUARD — Verificar inicio destacada','OPURO — Subir DESTACADA'],['GUARD — Verificar reporte destacada','OPURO — Crear borrador Gutenberg enriquecido'],['GUARD — Verificar reporte post','OPURO — Readback'],['OPURO — Validar antes de publicar','Resultado OPURO — BORRADOR']]) assert.equal(reachable([blocker]).has(target),false,target);
 assert.ok(reachable().has('Resultado OPURO — BORRADOR'));
 for(const blocker of ['OPURO — Verificar Hero','OPURO — Verificar destacada']) assert.equal(reachable([blocker]).has('OPURO — Crear borrador Gutenberg enriquecido'),false,blocker);
});
test('los nodos Code compilan y los reportes usan IDs por rol',()=>{
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 for(const n of w.nodes.filter(x=>x.type==='n8n-nodes-base.code')) assert.doesNotThrow(()=>new AsyncFunction(n.parameters.jsCode),n.name);
 assert.match(byName['GUARD — Reportar Hero'].parameters.jsonBody,/role:'hero'.*Subir HERO/);
 assert.match(byName['GUARD — Reportar destacada'].parameters.jsonBody,/role:'featured'.*Subir DESTACADA/);
 assert.match(byName['GUARD — Reportar post'].parameters.jsonBody,/postId:.*Crear borrador Gutenberg/);
});
test('readback de medios compara ID, tipo y metadata antes de crear el post',()=>{
 const canonical={images:{hero_opuro:{alt_text:'alt',title:'título',caption:'leyenda',description:'descripción'},featured_opuro:{alt_text:'miniatura'}}};
 const lookup=name=>({first:()=>({json:name==='Validar y normalizar OPMX MASTER'?{canonical}:name==='OPURO — Subir HERO'?{id:101}:{id:102}})});
 const hero={$json:{id:101,media_type:'image',source_url:'https://example.test/hero',alt_text:'alt',title:{raw:'título'},caption:{raw:'leyenda'},description:{raw:'descripción'}}};
 const featured={$json:{id:102,media_type:'image',source_url:'https://example.test/featured',alt_text:'miniatura'}};
 const checkHero=Function('$json','$',byName['OPURO — Verificar Hero'].parameters.jsCode);
 const checkFeatured=Function('$json','$',byName['OPURO — Verificar destacada'].parameters.jsCode);
 assert.equal(checkHero(hero.$json,lookup)[0].json.status,'HERO_VERIFICADO');
 assert.equal(checkFeatured(featured.$json,lookup)[0].json.status,'DESTACADA_VERIFICADA');
 assert.throws(()=>checkHero({...hero.$json,caption:{raw:''}},lookup),/conciliación/);
 assert.throws(()=>checkFeatured({...featured.$json,id:101},lookup),/conciliación/);
 assert.throws(()=>checkFeatured({...featured.$json,media_type:'file'},lookup),/conciliación/);
});
