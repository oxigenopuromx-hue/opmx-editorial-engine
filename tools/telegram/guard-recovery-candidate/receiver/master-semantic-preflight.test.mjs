import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import fixture from './fixtures/shared-master-static4263.mjs';
import {buildMasterSemanticPreflightOperations as build,masterSemanticNodes as names,masterSemanticGroup} from './build-master-semantic-preflight-operations.mjs';
import {buildMasterSemanticPreflightQaCode} from './build-master-semantic-preflight-qa.mjs';
import {classifyPublisherMasterError,semanticPreflightResponse} from '../publisher-master-preflight.mjs';
import {buildLiteralDelivery} from '../../../editorial/literal-delivery.mjs';

const operations=build(fixture.mcp,fixture.shared);
const validator=operations.find(x=>x.type==='addNode').node.parameters.jsCode;
const formatter=operations.find(x=>x.type==='updateNodeParameters'&&x.nodeName==='Resultado validación archivos').parameters.jsCode;
const plain=x=>JSON.parse(JSON.stringify(x));
const requestId='tg_'+'a'.repeat(64);
function document(){return {
 CONTROL_EDITORIAL:{ESTADO:'LISTO',MODO_CONTENIDO:'EDITORIAL'},
 SEO:{TITULO_SEO:'Título de prueba',SLUG:'nota-de-prueba',SUBTITULO:'Subtítulo',METADESCRIPCION:'Descripción',KEYWORD_PRINCIPAL:'prueba',ETIQUETAS:['prueba'],CATEGORIA:'Economía'},
 PUBLICACION:{EXTRACTO:'Extracto original'},CATEGORIAS:{OPURO:{PRINCIPAL:'Economía'},OPOL:{PRINCIPAL:'ECONOMÍA'},LIBERAL:{PRINCIPAL:'Economía'}},
 IMAGENES:{HERO_OPURO:{URL:'{{OPMX:HERO_OPURO}}',ALT:'Imagen',CREDITO:'Cortesía'},DESTACADA_OPURO:{URL:'{{OPMX:DESTACADA_OPURO}}',ALT:'Imagen'},DESTACADA_OPOL:{URL:'{{OPMX:DESTACADA_OPOL}}',ALT:'Imagen'}},
 HTML_FINAL:'<p>Texto original.</p>',GUTENBERG_FINAL:'<!-- wp:paragraph --><p>Texto original.</p><!-- /wp:paragraph -->',GUTENBERG_ENRIQUECIDO_FINAL:'<!-- wp:paragraph --><p>Texto original.</p><!-- /wp:paragraph -->'
};}
function input(destination='TODOS'){return {payload:{request_id:requestId,CREAR_EN:destination,PUBLICAR:false,master:document(),hero_file:{base64:'/9j/2Q=='},featured_file:{base64:'/9j/2Q=='}},stats:{master:100,hero:4,destacada:4}};}
const request=(operation='validar_archivos_opmx',destination='TODOS')=>({id:1,operation,destino:destination,request_id:operation==='validar_archivos_opmx'?null:requestId});
async function execute(source,value,r=request()){
 const context={Buffer,TextEncoder,$input:{first:()=>({json:plain(value)})},$:name=>({first:()=>({json:name==='Protocolo MCP archivos'?{request:plain(r)}:name==='Literal archivos — Conservar validación'?{literal_profile:null}:(()=>{throw Error('UNEXPECTED_LOOKUP')})()})})};
 return plain(await new vm.Script('(async()=>{\n'+source+'\n})()').runInNewContext(context));
}
const preflight=async(value=input(),r=request())=>(await execute(validator,value,r))[0].json;
const response=async(value,r=request())=>(await execute(formatter,value,r))[0].json.response.result.structuredContent;

for(const destination of ['OPURO','OPOL','LIBERAL','AMBOS','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'])test('real Shared validators accept complete static MASTER for '+destination,async()=>{
 const value=input(destination),before=JSON.stringify(value),result=await preflight(value,request('validar_archivos_opmx',destination));
 assert.equal(result.semantic_preflight.ok,true);assert.equal(result.semantic_preflight.live_cms_checks,'NOT_CHECKED');assert.equal(result.semantic_preflight.request_binding,'NOT_CHECKED');
 assert.equal(JSON.stringify(value),before);assert.deepEqual(result.payload,value.payload);assert.deepEqual(result.stats,value.stats);
 const final=await response(result,request('validar_archivos_opmx',destination));assert.equal(final.status,'FILES_VALIDATED');assert.equal(final.validation_scope.shared_version_id,fixture.shared.versionId);assert.equal(final.bytesVerified,true);
});
test('validation-only null request uses local syntax input without mutating transmitted payload or MASTER',async()=>{
 const value=input();value.payload.request_id=null;const result=await preflight(value);assert.equal(result.semantic_preflight.ok,true);assert.equal(result.payload.request_id,null);assert.deepEqual(result.payload.master,value.payload.master);
});
test('writes with absent or mismatched external request never receive the validation-only exception',async()=>{
 for(const id of [null,undefined,'tg_'+'b'.repeat(64)]){const value=input();value.payload.request_id=id;const r=request('publicar_nota_opmx');const result=await preflight(value,r);assert.equal(result.semantic_preflight.ok,false);assert.equal((await response(result,r)).field,'request_id')}
});
test('OPOL-only preparation does not require or synthesize Hero',async()=>{
 const value=input('OPOL');delete value.payload.hero_file;const result=await preflight(value,request('validar_archivos_opmx','OPOL'));assert.equal(result.semantic_preflight.ok,true);assert.equal(Object.hasOwn(result.payload,'hero_file'),false);
});
const mutations={
 title:[x=>delete x.payload.master.SEO.TITULO_SEO,'SEO.TITULO_SEO'],
 primaryKeyword:[x=>delete x.payload.master.SEO.KEYWORD_PRINCIPAL,'SEO.KEYWORD_PRINCIPAL'],
 tags:[x=>x.payload.master.SEO.ETIQUETAS=[],'SEO.ETIQUETAS'],
 excerpt:[x=>x.payload.master.PUBLICACION.EXTRACTO='','PUBLICACION.EXTRACTO'],
 slug:[x=>x.payload.master.SEO.SLUG='../bad','SEO.SLUG'],
 editorialState:[x=>x.payload.master.CONTROL_EDITORIAL.ESTADO='BORRADOR','CONTROL_EDITORIAL.ESTADO'],
 author:[x=>x.payload.master.PUBLICACION.AUTOR_ID=2,'PUBLICACION.AUTOR_ID'],
 opuroCategory:[x=>{delete x.payload.master.CATEGORIAS.OPURO.PRINCIPAL;delete x.payload.master.SEO.CATEGORIA},'CATEGORIAS.OPURO.PRINCIPAL'],
 opolCategory:[x=>delete x.payload.master.CATEGORIAS.OPOL.PRINCIPAL,'CATEGORIAS.OPOL.PRINCIPAL'],
 unknownOpolCategory:[x=>x.payload.master.CATEGORIAS.OPOL.PRINCIPAL='NO EXISTE','CATEGORIAS.OPOL.PRINCIPAL'],
 opolHierarchy:[x=>x.payload.master.CATEGORIAS.OPOL.SECUNDARIA='SENADORES','CATEGORIAS.OPOL.SECUNDARIA'],
 seoCategory:[x=>x.payload.master.SEO.CATEGORIA='Otra','SEO.CATEGORIA'],
 credit:[x=>x.payload.master.IMAGENES.HERO_OPURO.CREDITO=123,'SEO.SUBTITULO'],
 enriched:[x=>x.payload.master.GUTENBERG_ENRIQUECIDO_FINAL='','GUTENBERG_ENRIQUECIDO_FINAL'],
 enrichedBlocks:[x=>x.payload.master.GUTENBERG_ENRIQUECIDO_FINAL='<p>Sin bloques</p>','GUTENBERG_ENRIQUECIDO_FINAL'],
 unsafeWrapper:[x=>x.payload.master.GUTENBERG_ENRIQUECIDO_FINAL='<!-- wp:paragraph --><article>NO</article><!-- /wp:paragraph -->','GUTENBERG_ENRIQUECIDO_FINAL'],
 unapprovedBlock:[x=>x.payload.master.GUTENBERG_ENRIQUECIDO_FINAL='<!-- wp:group --><div>NO</div><!-- /wp:group -->','GUTENBERG_ENRIQUECIDO_FINAL'],
 heroPlaceholder:[x=>x.payload.master.IMAGENES.HERO_OPURO.URL='https://private.invalid/DO_NOT_ECHO','IMAGENES.HERO_OPURO.URL'],
 featuredPlaceholder:[x=>x.payload.master.IMAGENES.DESTACADA_OPURO.URL='wrong','IMAGENES.DESTACADA_OPURO.URL'],
 opuroAlt:[x=>delete x.payload.master.IMAGENES.DESTACADA_OPURO.ALT,'IMAGENES.DESTACADA_OPURO.ALT'],
 opolGutenberg:[x=>x.payload.master.GUTENBERG_FINAL='','GUTENBERG_FINAL'],
 opolPlaceholder:[x=>x.payload.master.IMAGENES.DESTACADA_OPOL.URL='wrong','IMAGENES.DESTACADA_OPOL.URL'],
 opolAlt:[x=>delete x.payload.master.IMAGENES.DESTACADA_OPOL.ALT,'IMAGENES.DESTACADA_OPOL.ALT'],
 liberalCategory:[x=>delete x.payload.master.CATEGORIAS.LIBERAL.PRINCIPAL,'CATEGORIAS.LIBERAL.PRINCIPAL'],
 heroFile:[x=>delete x.payload.hero_file,'hero_file'],
 featuredFile:[x=>delete x.payload.featured_file,'featured_file'],
 imageFormat:[x=>x.payload.featured_file.base64='YmFk','featured_file'],
 publishingTransport:[x=>x.payload.PUBLICAR=true,'PUBLICAR'],
};
for(const [name,[mutate,field]] of Object.entries(mutations))test('static '+name+' fails before acceptance with bounded field diagnostic',async()=>{
 const value=input(),r=request('publicar_nota_opmx');mutate(value);const before=JSON.stringify(value),result=await preflight(value,r);assert.equal(result.semantic_preflight.ok,false);const output=await response(result,r);
 assert.equal(output.status,'VALIDATION_FAILED');assert.equal(output.writesStarted,false);assert.equal(output.retryPermitted,false);assert.equal(output.field,field);assert.equal(output.request_id,requestId);assert.equal(JSON.stringify(value),before);assert.equal(JSON.stringify(output).includes('DO_NOT_ECHO'),false);
});
test('LITERAL validation keeps original request scope and exact original text',async()=>{
 const packageId='tg_'+'c'.repeat(40),revision=9,sourceText='Título literal\n\nPárrafo original.';
 const literal=buildLiteralDelivery({baseMaster:document(),policy:{authorized:true,mode:'PUBLISH',destination:'TODOS',content_mode:'LITERAL'},packageId,revision,sourceText,title:'Título literal',subtitle:'',paragraphs:['Párrafo original.']});
 const value=input();value.payload.master=literal.master;value.payload.request_id=null;const r=request();const result=await preflight(value,r);assert.equal(result.semantic_preflight.ok,true);assert.deepEqual(result.payload,value.payload);
 const altered=plain(value);altered.payload.master.GUTENBERG_FINAL='<!-- wp:paragraph --><p>Texto cambiado.</p><!-- /wp:paragraph -->';const rejected=await preflight(altered,r);assert.equal((await response(rejected,r)).field,'CONTROL_EDITORIAL.LITERAL');
});
test('existing OPURO SEO category fallback is preserved rather than made stricter',async()=>{
 const value=input();delete value.payload.master.CATEGORIAS.OPURO.PRINCIPAL;assert.equal((await preflight(value)).semantic_preflight.ok,true);
});
test('LIBERAL never accepts another CMS inline image ID in its enriched content',async()=>{
 const value=input('LIBERAL');value.payload.master.GUTENBERG_ENRIQUECIDO_FINAL='<!-- wp:image --><figure><img class="wp-image-100" src="https://example.invalid/image.jpg" alt="Imagen" /></figure><!-- /wp:image -->';const r=request('publicar_nota_opmx','LIBERAL');const result=await preflight(value,r);assert.equal((await response(result,r)).field,'GUTENBERG_ENRIQUECIDO_FINAL');
});
test('non-object MASTER yields a safe MASTER validation failure before syntax placeholders',async()=>{
 const value=input();value.payload.master=null;const result=await preflight(value);assert.equal((await response(result)).field,'MASTER');
});
test('unknown errors remain an unconfirmed preflight without raw exception text',()=>{
 const raw=Error('SECRET_SOURCE_URL https://private.invalid/?token=secret');const result=classifyPublisherMasterError(raw);assert.equal(result.status,'FILES_REJECTED');assert.deepEqual(result.fields,[]);assert.equal(JSON.stringify(result).includes('SECRET'),false);
 const reply=semanticPreflightResponse(request(),{semantic_preflight:{ok:false,...result}});assert.equal(reply.response.result.structuredContent.status,'FILES_REJECTED');assert.equal(JSON.stringify(reply).includes('SECRET'),false);
});
test('formatter cannot accept an injected code or raw field as a trusted validation diagnosis',()=>{
 for(const patch of [{code:'RAW_ERROR'},{fields:['https://private.invalid/secret']},{retryPermitted:true},{writesStarted:true}]){const s={ok:false,status:'VALIDATION_FAILED',code:'REQUIRED_FIELDS',fields:['SEO.TITULO_SEO'],writesStarted:false,retryPermitted:false,...patch};const r=semanticPreflightResponse(request(),{semantic_preflight:s});assert.equal(r.response.result.structuredContent.status,'FILES_REJECTED');assert.equal(JSON.stringify(r).includes('private.invalid'),false)}
});
test('builder inserts one static node before the unchanged writer/acceptance branch and never catches post-write errors',()=>{
 assert.equal(operations.filter(o=>o.type==='addNode').length,1);assert.equal(operations.filter(o=>o.type==='addNode')[0].node.name,names.validate);
 assert.equal(operations.some(o=>/Publisher resultado incierto|Envío Telegram|Resultado Publisher MCP/.test(o.nodeName??'')),false);
 const branch=operations.find(o=>o.nodeName==='¿Crear borradores?');assert.equal(branch.parameters.conditions.conditions.length,2);assert.equal(branch.parameters.conditions.conditions[1].leftValue,'={{ $json.semantic_preflight.ok }}');
 assert.deepEqual(operations.filter(o=>o.type==='removeConnection').map(o=>[o.source,o.sourceIndex]),[['¿Requiere Hero?',1],['Comprobar Hero',0]]);
 assert.equal(operations.some(o=>o.type==='setNodeCredential'),false);
 assert.deepEqual(operations.find(o=>o.type==='addNodeGroup'),{type:'addNodeGroup',...masterSemanticGroup,nodeNames:[names.validate]});
 assert.equal(operations.some(o=>o.type==='removeNodeGroup'||o.type==='setNodeGroups'||o.type==='updateNodeGroup'),false);
});
test('pins are exact hashes of the Shared source used by the embedded preflight',async()=>{
 const value=await preflight();const pin=value.semantic_preflight;assert.equal(pin.prepare_sha256,createHash('sha256').update(fixture.shared.nodes[0].parameters.jsCode).digest('hex'));assert.equal(pin.normalizer_sha256,createHash('sha256').update(fixture.shared.nodes[1].parameters.jsCode).digest('hex'));
});
test('builder refuses changed ordering, source with network helpers, invalid branch or an already installed node',()=>{
 for(const mutate of [x=>x.shared.connections['Preparar MASTER y binarios'].main[0][0].node='Changed',x=>x.shared.nodes[0].parameters.jsCode+='\nawait fetch("https://example.invalid");',x=>x.mcp.connections['Comprobar Hero'].main[0]=[],x=>x.mcp.nodes.push({name:names.validate}),x=>x.mcp.nodeGroups=[{id:masterSemanticGroup.id,name:'Other',nodeNames:[]}]]){const x=structuredClone(fixture);mutate(x);assert.throws(()=>build(x.mcp,x.shared));}
});
test('isolated n8n QA Code exercises the actual generated validator and formatter without external I/O',async()=>{
 const code=buildMasterSemanticPreflightQaCode(operations);
 const output=plain(await new vm.Script('(async()=>{\n'+code+'\n})()').runInNewContext({Buffer,TextEncoder}))[0].json;
 assert.equal(output.status,'SEMANTIC_PREFLIGHT_QA_PASSED');assert.equal(output.cases,27);assert.equal(output.assertions,157);assert.equal(output.externalIoCalls,0);assert.equal(output.cmsWrites,0);assert.equal(output.telegramMessages,0);assert.equal(output.guardMutations,0);assert.equal(output.sharedVersionId,fixture.shared.versionId);
 assert.equal(/\b(?:eval|require|fetch)\s*\(|new Function/.test(code),false);
});
