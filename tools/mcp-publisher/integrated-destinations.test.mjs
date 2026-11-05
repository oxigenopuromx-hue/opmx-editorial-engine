import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveDestinations,destinationLabel,destinationRegistry} from './destinations.mjs';
import {createGuard} from './guard-server.mjs';
import {preparePublication,checkPublicationPreflight,recordPublication,summarizePublication} from './publication.mjs';
const workflows=Object.fromEntries(['automatic','files-mcp','community','recovery'].map(n=>[n,JSON.parse(readFileSync('workflows/publisher/integrated-v3/fixtures/'+n+'-after.json'))]));
const nodes=w=>Object.fromEntries(w.nodes.map(n=>[n.name,n]));
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const run=(w,name,json,by={},binary={})=>new AsyncFunction('$json','$input','$',nodes(w)[name].parameters.jsCode)(json,{first:()=>({json:name==='Protocolo MCP archivos'?{envelope:json,identity:{}}:json,binary}),all:()=>[{json,binary}],item:{binary}},n=>({first:()=>({json:by[n]})}));
const body='<!-- wp:paragraph --><p>Fixture sintético privado.</p><!-- /wp:paragraph -->';
const master={CONTROL_EDITORIAL:{ESTADO:'LISTO'},SEO:{TITULO_SEO:'QA destinos',SLUG:'qa-destinos',CATEGORIA:'POLÍTICA',EXTRACTO:'QA',METADESCRIPCION:'QA',KEYWORD_PRINCIPAL:'QA',ETIQUETAS:['QA']},CATEGORIAS:{OPURO:{PRINCIPAL:'POLÍTICA'},OPOL:{PRINCIPAL:'POLÍTICA'},LIBERAL:{PRINCIPAL:'Política'}},GUTENBERG_ENRIQUECIDO_FINAL:body,GUTENBERG_FINAL:body,IMAGENES:{HERO_OPURO:{URL:'{{OPMX:HERO_OPURO}}',ALT:'QA Hero'},DESTACADA_OPURO:{URL:'{{OPMX:DESTACADA_OPURO}}',ALT:'QA destacada'},DESTACADA_OPOL:{URL:'{{OPMX:DESTACADA_OPOL}}',ALT:'QA OPOL'}}};
const selections=['OPURO','OPOL','LIBERAL','AMBOS','TODOS','OPURO,LIBERAL','OPOL,LIBERAL'];
const binaries={hero_file:{mimeType:'image/png'},featured_file:{mimeType:'image/png'}};
test('aliases, every subset, commas, case, duplicates and invalid members',()=>{
 assert.deepEqual(resolveDestinations('AMBOS'),['OPURO','OPOL']);assert.deepEqual(resolveDestinations('TODOS'),Object.keys(destinationRegistry()));
 assert.deepEqual(resolveDestinations(' liberal, opuro, LIBERAL '),['OPURO','LIBERAL']);assert.equal(destinationLabel(resolveDestinations('opol,opuro')),'AMBOS');
 for(const input of ['',',','OPOL,','OPURO,TYPO','AMBOS LIBERAL',null,{},['OPOL',false]])assert.throws(()=>resolveDestinations(input));
 for(const input of selections)assert.deepEqual(resolveDestinations(destinationLabel(resolveDestinations(input))),resolveDestinations(input));
});
test('normalizer selects exactly requested sites and validates only selected categories',async()=>{
 for(const destino of selections){const r=await run(workflows.automatic,'Validar y normalizar OPMX MASTER',{json:JSON.stringify(master),CREAR_EN:destino,PUBLICAR:false},{},binaries);assert.deepEqual(r.json.execution.destinations,resolveDestinations(destino));assert.equal(r.json.execution.create_liberal,resolveDestinations(destino).includes('LIBERAL'));if(r.json.execution.create_liberal)assert.equal(r.json.canonical.author_liberal.id,2);}
 const liberal=structuredClone(master);delete liberal.CATEGORIAS.OPOL;delete liberal.CATEGORIAS.OPURO;liberal.SEO.CATEGORIA='Sociedad';
 const r=await run(workflows.automatic,'Validar y normalizar OPMX MASTER',{json:JSON.stringify(liberal),CREAR_EN:'LIBERAL',PUBLICAR:false},{},binaries);assert.equal(r.json.canonical.categories.liberal.principal,'Política');
 const bad=structuredClone(master);bad.GUTENBERG_ENRIQUECIDO_FINAL='<!-- wp:image {"id":123} --><figure><img class="wp-image-123" alt="QA" src="https://cms.oxigenopuro.com.mx/image.jpg"></figure><!-- /wp:image -->';
 await assert.rejects(run(workflows.automatic,'Validar y normalizar OPMX MASTER',{json:JSON.stringify(bad),CREAR_EN:'TODOS',PUBLICAR:false},{},binaries),/adjuntos nativos/);
});
test('legacy canonical shape remains byte-identical for OPURO OPOL and AMBOS',async()=>{
 const old=JSON.parse(readFileSync('workflows/publisher/integrated-v3/fixtures/automatic-before.json'));
 for(const destino of ['OPURO','OPOL','AMBOS']){const input={json:JSON.stringify(master),CREAR_EN:destino,PUBLICAR:false};const a=await run(old,'Validar y normalizar OPMX MASTER',input,{},binaries),b=await run(workflows.automatic,'Validar y normalizar OPMX MASTER',input,{},binaries);assert.equal(JSON.stringify(a.json.canonical),JSON.stringify(b.json.canonical));}
});
test('live MCP protocol accepts comma sets and original Liberal ID; preserves Telegram tools',async()=>{
 const w=workflows['files-mcp'];const list=await run(w,'Protocolo MCP archivos',{jsonrpc:'2.0',id:1,method:'tools/list'});const tools=list[0].json.response.result.tools;
 assert.ok(tools.some(t=>t.name==='publicar_borradores_opmx'));assert.ok(tools.some(t=>t.name.includes('telegram')));assert.equal(tools.find(t=>t.name==='preparar_borrador_opmx').inputSchema.properties.destino.enum,undefined);
 for(const destino of selections){const result=await run(w,'Protocolo MCP archivos',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'publicar_borradores_opmx',arguments:{request_id:'qa_integrated_20261105',destino,slug:'qa-destinos',post_id_opuro:1,post_id_opol:2,post_id_liberal:3,confirmar_publicacion:'PUBLICAR'}}});assert.equal(result[0].json.route,'existing-publication');assert.equal(result[0].json.request.post_id_liberal,3);}
});
function reachable(w,start,blocked=[]){const found=new Set(),q=[start];while(q.length){const x=q.shift();if(found.has(x)||blocked.includes(x))continue;found.add(x);for(const output of Object.values(w.connections[x]??{}))for(const es of output)for(const e of es)q.push(e.node);}return found;}
test('every write stays behind shared guard; native credentials stay in their own CMS',()=>{
 const a=workflows.automatic,m=workflows['files-mcp'];
 for(const n of a.nodes.filter(n=>n.parameters?.method==='POST'&&JSON.stringify(n.parameters).includes('cms.elliberal.mx')))assert.equal(reachable(a,'Entrada desde MCP archivos',['OPMX — Verificar reserva']).has(n.name),false);
 assert.equal(reachable(a,'Entrada desde MCP archivos',['LIBERAL — Verificar categoría preflight','Preflight LIBERAL omitido']).has('LIBERAL — Subir HERO'),false);
 for(const d of ['OPURO','OPOL','LIBERAL'])assert.equal(reachable(m,'Preparar publicación existente',['Preflight conjunto publicación']).has('Publicación — Publicar '+d),false);
 for(const w of Object.values(workflows))for(const n of w.nodes){const s=JSON.stringify(n.parameters);assert.ok(!s.includes('publisher.elliberal'));if(s.includes('cms.elliberal.mx')&&n.type==='n8n-nodes-base.httpRequest')assert.equal(n.parameters.nodeCredentialType,'wordpressApi');assert.ok(!s.includes('/el-liberal-publisher/'));}
 assert.ok(reachable(workflows.community,'On form submission').has('Publisher compartido — borradores'));assert.ok(!reachable(workflows.community,'On form submission').has('OPURO — Subir HERO'));
});
test('all selected readbacks required; Liberal publication retains earlier success states',async()=>{
 for(const destino of selections){const requested=resolveDestinations(destino),request={operation:'publicar_nota_opmx',confirmar_publicacion:'PUBLICAR',request_id:'qa_integrated_20261105',destino};const receipt={status:'SUCCESS',mode:'DRAFT',request_id:request.request_id,targets:{}},responses={},guards={};
 for(const [i,d]of requested.entries()){const cfg=destinationRegistry()[d],id=i+10;receipt[cfg.postIdKey]=id;receipt.targets[cfg.resultKey]={status:'DRAFT',post_id:id,slug:'qa-destinos'};responses[d]={statusCode:200,body:{id,slug:'qa-destinos',status:'draft',type:'post',title:{raw:'QA'},content:{raw:body},excerpt:{raw:'QA'},author:d==='LIBERAL'?2:3,featured_media:21,categories:[9],tags:[8],meta:{rank_math_title:'QA',rank_math_description:'QA',rank_math_focus_keyword:'QA',...(cfg.hero?{[cfg.heroMeta]:22,[cfg.editorialMeta]:{subtitle:'QA'}}:{opmx_editorial:{primary_category:9}})}}};guards[d]={statusCode:200,body:{status:'reported',postId:id}};}
 const initial=preparePublication(request,receipt),category={statusCode:200,body:{id:9,slug:'politica'}};for(const missing of requested){const bad={...responses};delete bad[missing];assert.throws(()=>checkPublicationPreflight(initial,bad,category,guards));}
 let plan=checkPublicationPreflight(initial,responses,category,guards);for(const d of requested)plan=recordPublication(plan,d,{...responses[d],body:{...responses[d].body,status:'publish'}});assert.equal(summarizePublication(plan).status,'SUCCESS');
 if(requested.includes('LIBERAL')){const by={'Conservar publicación OPOL':{...plan,targets:{...plan.targets,LIBERAL:initial.targets.LIBERAL}},'Preflight conjunto publicación':initial};by['Conservar publicación OPOL'].targets.LIBERAL={...plan.targets.LIBERAL,status:'NOT_ATTEMPTED'};const result=await run(workflows['files-mcp'],'Publicación — Evaluar LIBERAL',{statusCode:200,body:{...responses.LIBERAL.body,status:'publish'}},by);assert.equal(summarizePublication(result[0].json).status,'SUCCESS');}
 }
});
test('guard atomically reserves all three with unchanged legacy target hash and rejects unknowns',async()=>{
 const calls=[];let committed=0;const pool={async getConnection(){return{async beginTransaction(){calls.push('begin')},async execute(sql,values){calls.push({sql,values});return[[]]},async commit(){committed++},async rollback(){},release(){}}}};const secret='a'.repeat(64);const server=createGuard({pool,secret});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const call=destinations=>fetch('http://127.0.0.1:'+server.address().port+'/v1/reservations',{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body:JSON.stringify({requestId:'qa_integrated_20261105',slug:'qa-destinos',fingerprint:'b'.repeat(64),destinations})});assert.equal((await call(['OPURO','OPOL','LIBERAL'])).status,201);assert.equal(committed,1);assert.equal(calls.filter(x=>x.sql?.startsWith('INSERT INTO opmx_mcp_targets')).length,3);assert.equal((await call(['OPURO','OTHER'])).status,400);assert.equal(committed,1);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
