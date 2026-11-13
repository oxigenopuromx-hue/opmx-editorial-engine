import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import shared from './fixtures/shared-category-home-baseline.mjs';
import form from './fixtures/form-category-home-baseline.mjs';
import mcp from './fixtures/mcp-category-home-baseline.mjs';
import {categoryHomeBase,buildCategoryHomeSharedOperations,buildCategoryHomePublicationOperations,buildCategoryHomeMcpStaticOperations} from './build-category-home-operations.mjs';
import {buildLiteralDelivery} from '../../../editorial/literal-delivery.mjs';
const plain=x=>JSON.parse(JSON.stringify(x)),one=(g,n)=>g.nodes.find(x=>x.name===n),ops=buildCategoryHomeSharedOperations(shared,categoryHomeBase(shared));
const changed=plain(shared);for(const op of ops)if(op.type==='updateNodeParameters')one(changed,op.nodeName).parameters=plain(op.parameters);changed.versionId='future-shared-version';
const staticOps=buildCategoryHomeMcpStaticOperations(mcp,shared,changed,categoryHomeBase(mcp));
const master=()=>({CONTROL_EDITORIAL:{ESTADO:'LISTO',MODO_CONTENIDO:'EDITORIAL'},SEO:{TITULO_SEO:'Nota',SLUG:'nota-fixture',SUBTITULO:'Dato',KEYWORD_PRINCIPAL:'prueba',ETIQUETAS:['prueba'],CATEGORIA:'Economía'},PUBLICACION:{EXTRACTO:'Dato'},CATEGORIAS:{OPURO:{PRINCIPAL:'Economía'},OPOL:{PRINCIPAL:'ECONOMÍA'},LIBERAL:{PRINCIPAL:'Economía'}},IMAGENES:{HERO_OPURO:{URL:'{{OPMX:HERO_OPURO}}',CREDITO:'Cortesía'},DESTACADA_OPURO:{URL:'{{OPMX:DESTACADA_OPURO}}',ALT:'Imagen'},DESTACADA_OPOL:{URL:'{{OPMX:DESTACADA_OPOL}}',ALT:'Imagen'}},HTML_FINAL:'<p>Texto.</p>',GUTENBERG_FINAL:'<!-- wp:paragraph --><p>Texto.</p><!-- /wp:paragraph -->',GUTENBERG_ENRIQUECIDO_FINAL:'<!-- wp:paragraph --><p>Texto.</p><!-- /wp:paragraph -->'});
async function run(source,json,lookups={},items){const context={Buffer,TextEncoder,$execution:{id:'qa13-offline'},$json:plain(json),$input:{item:{binary:{hero_file:{},featured_file:{}}},first:()=>({json:plain(json)}),all:()=>plain(items??[{json}])},$:name=>{if(!Object.hasOwn(lookups,name))throw Error('UNEXPECTED_LOOKUP:'+name);return {first:()=>({json:plain(lookups[name])})}}};return plain(await new vm.Script('(async()=>{\n'+source+'\n})()').runInNewContext(context));}
async function normalize(document,destination='TODOS',source=one(changed,'Validar y normalizar OPMX MASTER').parameters.jsCode){return run(source,{json:JSON.stringify(document),CREAR_EN:destination,PUBLICAR:false,request_id:'tg_'+'a'.repeat(64)})}

test('old MASTER yields byte-equivalent canonical values, including Liberal author3',async()=>{
 const value=master(),before=JSON.stringify(value),old=await normalize(value,'TODOS',one(shared,'Validar y normalizar OPMX MASTER').parameters.jsCode),next=await normalize(value);
 assert.deepEqual(next,old);assert.equal(next.json.canonical.author_liberal.id,3);assert.equal(JSON.stringify(value),before);
});
for(const destination of ['OPURO','OPOL','LIBERAL','AMBOS','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'])test('Shared and Form absent-policy compatibility for '+destination,async()=>{
 const value=master();
 for(const graph of [shared,form]){
  const before=one(graph,'Validar y normalizar OPMX MASTER').parameters.jsCode;
  const next=graph===shared?one(changed,'Validar y normalizar OPMX MASTER').parameters.jsCode:buildCategoryHomePublicationOperations(form,categoryHomeBase(form),{normalizerCopy:true}).find(o=>o.nodeName==='Validar y normalizar OPMX MASTER').parameters.jsCode;
  assert.deepEqual(await normalize(value,destination,next),await normalize(value,destination,before));
 }
});
test('LITERAL keeps its exact text/profile and can carry the independent optional OPURO presentation field',async()=>{
 const value=master();value.PUBLICACION.OPURO={EXCLUIR_PORTADA_CATEGORIAS_IDS:['61']};
 const literal=buildLiteralDelivery({baseMaster:value,policy:{authorized:true,mode:'DRAFT',destination:'TODOS',content_mode:'LITERAL'},packageId:'tg_'+'c'.repeat(40),revision:9,sourceText:'Título literal\n\nPárrafo literal.',title:'Título literal',subtitle:'',paragraphs:['Párrafo literal.']});
 const n=await run(one(changed,'Validar y normalizar OPMX MASTER').parameters.jsCode,{json:JSON.stringify(literal.master),CREAR_EN:'TODOS',PUBLICAR:false,request_id:literal.requestId});
 assert.equal(n.json.canonical.content_mode,'LITERAL');assert.equal(n.json.canonical.gutenberg_final,literal.master.GUTENBERG_FINAL);assert.deepEqual(n.json.canonical.opuro_category_home,{declared:true,ids:['61']});assert.equal(n.json.canonical.author_liberal.id,3);
});
test('declared policy is preserved in canonical fingerprint input while body and other destinations remain unchanged',async()=>{
 const value=master();value.PUBLICACION.OPURO={EXCLUIR_PORTADA_CATEGORIAS_IDS:['61']};const n=await normalize(value);assert.deepEqual(n.json.canonical.opuro_category_home,{declared:true,ids:['61']});assert.equal(n.json.canonical.gutenberg_enriquecido_final,value.GUTENBERG_ENRIQUECIDO_FINAL);assert.equal(n.json.canonical.author_liberal.id,3);
 const absent=await normalize(master());const hash=v=>createHash('sha256').update(JSON.stringify(v.json.canonical)).digest('hex');assert.notEqual(hash(absent),hash(n));
});
test('new static validator rejects malformed declaration before Shared/acceptance and returns bounded diagnostic',async()=>{
 const document=master();document.PUBLICACION.OPURO={EXCLUIR_PORTADA_CATEGORIAS_IDS:[61]};const value={payload:{request_id:null,master:document,CREAR_EN:'TODOS',PUBLICAR:false,hero_file:{base64:'/9j/2Q=='},featured_file:{base64:'/9j/2Q=='}},stats:{}};
 const request={id:1,operation:'validar_archivos_opmx',destino:'TODOS',request_id:null};const validated=(await run(staticOps[0].parameters.jsCode,value,{'Protocolo MCP archivos':{request}}))[0].json;
 assert.equal(validated.semantic_preflight.ok,false);assert.equal(validated.semantic_preflight.code,'OPURO_CATEGORY_HOME');assert.deepEqual(validated.semantic_preflight.fields,['PUBLICACION.OPURO.EXCLUIR_PORTADA_CATEGORIAS_IDS']);
 const result=(await run(staticOps[1].parameters.jsCode,validated,{'Protocolo MCP archivos':{request}}))[0].json.response.result.structuredContent;assert.equal(result.status,'VALIDATION_FAILED');assert.equal(result.writesStarted,false);
});
test('static validator embeds exact updated Shared source and immutable version/hash',async()=>{
 const document=master();document.PUBLICACION.OPURO={EXCLUIR_PORTADA_CATEGORIAS_IDS:[]};const value={payload:{request_id:null,master:document,CREAR_EN:'TODOS',PUBLICAR:false,hero_file:{base64:'/9j/2Q=='},featured_file:{base64:'/9j/2Q=='}},stats:{}};const request={id:1,operation:'validar_archivos_opmx',destino:'TODOS',request_id:null};
 const result=(await run(staticOps[0].parameters.jsCode,value,{'Protocolo MCP archivos':{request}}))[0].json;
 assert.equal(result.semantic_preflight.ok,true);assert.equal(result.semantic_preflight.shared_version_id,changed.versionId);assert.equal(result.semantic_preflight.normalizer_sha256,createHash('sha256').update(one(changed,'Validar y normalizar OPMX MASTER').parameters.jsCode).digest('hex'));assert.deepEqual(result.payload,value.payload);
});
test('membership preflight has zero mutations and refuses missing, ambiguous or unassigned IDs',async()=>{
 const source=ops.find(o=>o.type==='addNode'&&o.node.type==='n8n-nodes-base.code').node.parameters.jsCode;
 const canonical={categories:{opuro:{principal:'Economía'}},opuro_category_home:{declared:true,ids:['61']}};
 const lookup={'Validar y normalizar OPMX MASTER':{canonical}};
 const result=await run(source,{},lookup,[{json:[{id:61,name:'Economía'}]}]);assert.equal(result[0].json.status,'CATEGORY_HOME_MEMBERSHIP_VERIFIED');
 for(const rows of [[],[{id:2,name:'Economía'}],[{id:'61',name:'Economía'}],[{id:61,name:'Economía'},{id:2,name:'Economía'}]])await assert.rejects(()=>run(source,{},lookup,[{json:rows}]),/MEMBERSHIP/);
 assert.equal(/\b(?:fetch|require|eval)\s*\(/.test(source),false);
});
test('create REST body omits absent category exclusions and preserves existing metadata keys',async()=>{
 const body=one(changed,'OPURO — Crear borrador Gutenberg enriquecido').parameters.jsonBody;
 const base={title:'Nota',slug:'nota',excerpt:'Dato',subtitle:'Dato',gutenberg_enriquecido_final:'Texto',author:{id:3},images:{hero_opuro:{credit:'Cortesía'}}};
 function evaluate(policy){const canonical={...base,...(policy?{opuro_category_home:policy}:{})};return new vm.Script('('+body.slice(3,-2)+')').runInNewContext({$:name=>({first:()=>({json:name==='Validar y normalizar OPMX MASTER'?{canonical}:name==='OPURO — Resolver categoría'?{category_id:61}:name==='OPURO — Consolidar etiquetas v1.13'?{tag_ids:[1]}:{id:4}})})})}
 const absent=plain(evaluate());assert.equal(Object.hasOwn(absent.meta,'oxpuro_excluded_category_ids'),false);assert.equal(absent.meta.oxpuro_hero_media_id,4);assert.deepEqual(absent.meta.oxpuro_editorial,{subtitle:'Dato',photo_credit:'Cortesía'});
 assert.deepEqual(plain(evaluate({declared:true,ids:[]})).meta.oxpuro_excluded_category_ids,[]);assert.deepEqual(plain(evaluate({declared:true,ids:['61']})).meta.oxpuro_excluded_category_ids,['61']);assert.equal(Object.hasOwn(absent.meta,'oxpuro_exclude_home'),false);
});
test('only OPURO selected can declare the optional policy',async()=>{
 const value=master();value.PUBLICACION.OPURO={EXCLUIR_PORTADA_CATEGORIAS_IDS:[]};for(const d of ['OPOL','LIBERAL','OPOL,LIBERAL'])await assert.rejects(()=>normalize(value,d),/DESTINATION/);
});
test('new preflight is before all reservations/media and preserves existing branch order',()=>{
 assert.deepEqual(ops.filter(o=>o.type==='removeConnection').map(o=>[o.source,o.target]),[['OPURO — Resultado consulta duplicados','¿Preflight OPOL?']]);
 const writes=ops.filter(o=>o.type==='addNode').map(o=>o.node).filter(n=>n.type==='n8n-nodes-base.httpRequest');assert.equal(writes.length,1);assert.equal(writes[0].parameters.method??'GET','GET');assert.equal(ops.some(o=>/Reservar|Subir|Iniciar|Reclamo/.test(o.nodeName??'')),false);
 assert.equal(ops.filter(o=>o.type==='addNodeGroup').length,1);assert.deepEqual(ops.find(o=>o.type==='addNodeGroup').nodeNames,['OPURO — Preflight categoría de portada','OPURO — Validar pertenencia de exclusiones']);assert.equal(ops.some(o=>o.type==='setNodeCredential'),false);
});
test('all publishing paths preserve exclusion and general-home metadata across status changes',()=>{
 for(const g of [form,mcp]){const result=buildCategoryHomePublicationOperations(g,categoryHomeBase(g),{normalizerCopy:g===form});assert.equal(result.length,g===form?5:4);for(const op of result.filter(o=>o.nodeName!=='Validar y normalizar OPMX MASTER')){assert.match(op.parameters.jsCode,/'oxpuro_excluded_category_ids','oxpuro_exclude_home'/);assert.equal(op.parameters.mode,one(g,op.nodeName).parameters.mode)}}
});
test('builder refuses stale versions, changed source pins, edge drift, reinsertion or unpatched Shared copy',()=>{
 assert.throws(()=>buildCategoryHomeSharedOperations(shared,{versionId:'stale'}),/REBASE/);
 const drift=plain(shared);one(drift,'OPURO — Crear borrador Gutenberg enriquecido').parameters.jsonBody+=' ';assert.throws(()=>buildCategoryHomeSharedOperations(drift,categoryHomeBase(shared)),/REBASE/);
 const edge=plain(shared);edge.connections['OPURO — Resultado consulta duplicados'].main[0][0].node='Different';assert.throws(()=>buildCategoryHomeSharedOperations(edge,categoryHomeBase(edge)),/ORDER/);
 assert.throws(()=>buildCategoryHomeSharedOperations(changed,categoryHomeBase(changed)),/INSTALLED/);
 assert.throws(()=>buildCategoryHomeMcpStaticOperations(mcp,shared,shared,categoryHomeBase(mcp)),/COPY/);
});
test('incremental #21 refresh refuses another owner, nonlocal preparation, changed previous copy/pin or ordering',()=>{
 for(const mutate of [x=>x.id='other-workflow',x=>one(x,'Preparar MASTER y binarios').parameters.jsCode='await fetch("https://example.invalid");\n'+one(x,'Preparar MASTER y binarios').parameters.jsCode,x=>x.connections['Preparar MASTER y binarios'].main[0][0].node='Changed']){const g=plain(changed);mutate(g);assert.throws(()=>buildCategoryHomeMcpStaticOperations(mcp,shared,g,categoryHomeBase(mcp)))}
 for(const mutate of [s=>s.replace('async function sharedPrepare($json,$input){','async function sharedPrepare($json,$input){throw Error("drift");'),s=>s.replace('"workflowId":"4o7K5TmKc7joScqB"','"workflowId":"other"'),s=>s.replace('"versionId":"4263fea4-90a4-406d-a234-da7397d456bf"','"versionId":"different"')]){const g=plain(mcp),n=one(g,'MASTER — Validación estática Shared');n.parameters.jsCode=mutate(n.parameters.jsCode);assert.throws(()=>buildCategoryHomeMcpStaticOperations(g,shared,changed,categoryHomeBase(g)),/COPY/)}
});
