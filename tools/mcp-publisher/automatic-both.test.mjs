import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['tools/mcp-publisher/build-automatic-both.mjs','--check']);
const w=JSON.parse(readFileSync('workflows/publisher/OPMX_ENTRADA_AUTOMATICA_DESTINOS_v2.json'));
const nodes=Object.fromEntries(w.nodes.map(n=>[n.name,n]));
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const validate=new AsyncFunction('$json','$input',nodes['Validar y normalizar OPMX MASTER'].parameters.jsCode);
const content='<!-- wp:paragraph --><p>Prueba sintética.</p><!-- /wp:paragraph -->';
test('webhook y llamada interna conservan la misma huella sin leer el trigger',async()=>{
 const prepare=new AsyncFunction('$json',nodes['Preparar MASTER y binarios'].parameters.jsCode);
 const image=Buffer.from([255,216,255,0]).toString('base64');
 const input={request_id:'qa_request_1234567',CREAR_EN:'AMBOS',PUBLICAR:false,master:{SEO:{SLUG:'fixture'}},hero_file:{base64:image},featured_file:{base64:image}};
 const helpers={prepareBinaryData:async()=>({})};
 const a=await prepare.call({helpers},input),b=await prepare.call({helpers},{body:input});assert.deepEqual(a,b);
 const canonical={slug:'fixture'};const hash=Function('$','return ('+nodes['OPMX — Generar huella de prueba'].parameters.value.slice(3,-2)+');');
 const actual=hash(n=>({first:()=>({json:n==='Preparar MASTER y binarios'?a.json:{canonical}})}));
 assert.equal(actual,JSON.stringify({canonical,hero_base64:image,featured_base64:image}));
 assert.equal(nodes['Entrada desde MCP archivos'].parameters.inputSource,'passthrough');
});
const master={CONTROL_EDITORIAL:{ESTADO:'LISTO'},SEO:{TITULO_SEO:'QA destinos',SLUG:'qa-destinos',CATEGORIA:'Uncategorized',EXTRACTO:'QA',METADESCRIPCION:'QA',KEYWORD_PRINCIPAL:'QA',ETIQUETAS:['QA']},CATEGORIAS:{OPURO:{PRINCIPAL:'Uncategorized'},OPOL:{PRINCIPAL:'TECNOLOGÍA'}},GUTENBERG_ENRIQUECIDO_FINAL:content,GUTENBERG_FINAL:content,IMAGENES:{HERO_OPURO:{URL:'{{OPMX:HERO_OPURO}}',ALT:'QA Hero'},DESTACADA_OPURO:{URL:'{{OPMX:DESTACADA_OPURO}}',ALT:'QA destacada'},DESTACADA_OPOL:{URL:'{{OPMX:DESTACADA_OPOL}}',ALT:'QA OPOL'}}};
function reachable(block=[]){const seen=new Set(),queue=['Entrada automática protegida'];while(queue.length){const name=queue.shift();if(seen.has(name)||block.includes(name))continue;seen.add(name);for(const outputs of Object.values(w.connections[name]??{}))for(const es of outputs??[])for(const e of es??[])queue.push(e.node);}return seen;}
test('valida cada destino y OPOL con una sola imagen sin confundirla con JSON',async()=>{
 for(const destino of ['OPURO','OPOL','AMBOS']){
  const binary=destino==='OPOL'?{featured_file:{mimeType:'image/png'}}:{hero_file:{mimeType:'image/png'},featured_file:{mimeType:'image/png'}};
  const r=await validate({json:JSON.stringify(master),CREAR_EN:destino,PUBLICAR:false},{item:{binary}});
  assert.equal(r.json.execution.destination,destino);assert.equal(r.json.execution.create_opuro,destino!=='OPOL');assert.equal(r.json.execution.create_opol,destino!=='OPURO');
 }
});
test('reserva exactamente los destinos seleccionados antes de cualquier carga o borrador',()=>{
 const body=nodes['OPMX — Reservar preflight'].parameters.jsonBody;
 const reserve=Function('$','$json','return ('+body.slice(3,-2)+');');
 for(const [opuro,opol,expected]of [[true,false,['OPURO']],[false,true,['OPOL']],[true,true,['OPURO','OPOL']]]){
  const data={'Preparar MASTER y binarios':{request_id:'qa_request_1234567'},'Validar y normalizar OPMX MASTER':{canonical:{slug:'qa-destinos'},execution:{create_opuro:opuro,create_opol:opol}}};
  assert.deepEqual(reserve(n=>({first:()=>({json:data[n]})}),{fingerprint:'a'.repeat(64)}).destinations,expected);
 }
 for(const name of ['OPURO — Subir HERO','OPURO — Crear borrador Gutenberg enriquecido','OPOL — Subir DESTACADA','OPOL — Crear borrador mínimo'])assert.equal(reachable(['OPMX — Verificar reserva']).has(name),false);
 for(const name of ['OPOL — Subir DESTACADA','OPOL — Crear borrador mínimo'])assert.equal(reachable(['GUARD OPOL — Verificar destino']).has(name),false);
 assert.equal(nodes['OPOL — Crear borrador mínimo'].retryOnFail,false);
});
test('consolidado distingue éxito dual de resultado parcial sin perder enlace OPURO',()=>{
 const run=Function('$','$input',nodes['Resultado consolidado OPMX'].parameters.jsCode);
 const opuro={status:'DRAFT',target:'oxigenopuro',post_id:10,edit_url:'https://example.test/10'};
 const values={'OPMX — Conservar resultado OPURO':opuro,'Validar y normalizar OPMX MASTER':{execution:{create_opuro:true,create_opol:true}},'Preparar MASTER y binarios':{request_id:'qa_request_1234567'}};
 const lookup=n=>({first:()=>({json:values[n]})});const input=json=>({first:()=>({json})});
 const good=run(lookup,input({status:'DRAFT',target:'oxigenopolitico',post_id:20}))[0].json;assert.equal(good.status,'SUCCESS');assert.equal(good.summary.opol,'DRAFT');
 const partial=run(lookup,input({status:'NEEDS_RECONCILIATION',target:'oxigenopolitico'}))[0].json;assert.equal(partial.status,'PARTIAL_SUCCESS');assert.equal(partial.edit_url_opuro,opuro.edit_url);assert.equal(partial.retryPermitted,false);
});
test('grafo de destinos conserva sólo borradores y compila sus nodos Code',()=>{
 assert.equal(w.active,false);assert.ok(w.nodes.every(n=>!n.credentials&&!n.webhookId));
 for(const [a,c]of Object.entries(w.connections)){assert.ok(nodes[a]);for(const os of Object.values(c))for(const es of os??[])for(const e of es??[])assert.ok(nodes[e.node],e.node);}
 for(const n of w.nodes.filter(n=>n.type==='n8n-nodes-base.code'))assert.doesNotThrow(()=>new AsyncFunction(n.parameters.jsCode));
 assert.ok(!w.nodes.some(n=>/^OP(?:URO|OL) — Publicar$/.test(n.name)));
 assert.doesNotMatch(nodes['OPOL — Crear borrador mínimo'].parameters.jsonBody,/status\s*:\s*['"]publish/);
});
