import {buildLiteralDelivery} from '../../../editorial/literal-delivery.mjs';
import {masterSemanticNodes} from './build-master-semantic-preflight-operations.mjs';

// This produces one self-contained Code body for an inactive QA workflow.
// It executes only the installed Code bodies against synthetic in-memory data;
// no production tool, workflow, credential, binary storage or network is used.
export function buildMasterSemanticPreflightQaCode(operations) {
 const validator=operations.find(o=>o.type==='addNode'&&o.node.name===masterSemanticNodes.validate)?.node.parameters.jsCode;
 const formatter=operations.find(o=>o.type==='updateNodeParameters'&&o.nodeName==='Resultado validación archivos')?.parameters.jsCode;
 if(typeof validator!=='string'||typeof formatter!=='string')throw Error('SEMANTIC_QA_OPERATIONS_INVALID');
 const master={CONTROL_EDITORIAL:{ESTADO:'LISTO',MODO_CONTENIDO:'EDITORIAL'},SEO:{TITULO_SEO:'Prueba sintética',SLUG:'prueba-sintetica',SUBTITULO:'Subtítulo',METADESCRIPCION:'Descripción',KEYWORD_PRINCIPAL:'prueba',ETIQUETAS:['prueba'],CATEGORIA:'Economía'},PUBLICACION:{EXTRACTO:'Extracto sintético'},CATEGORIAS:{OPURO:{PRINCIPAL:'Economía'},OPOL:{PRINCIPAL:'ECONOMÍA'},LIBERAL:{PRINCIPAL:'Economía'}},IMAGENES:{HERO_OPURO:{URL:'{{OPMX:HERO_OPURO}}',ALT:'Imagen',CREDITO:'Cortesía'},DESTACADA_OPURO:{URL:'{{OPMX:DESTACADA_OPURO}}',ALT:'Imagen'},DESTACADA_OPOL:{URL:'{{OPMX:DESTACADA_OPOL}}',ALT:'Imagen'}},HTML_FINAL:'<p>Texto sintético.</p>',GUTENBERG_FINAL:'<!-- wp:paragraph --><p>Texto sintético.</p><!-- /wp:paragraph -->',GUTENBERG_ENRIQUECIDO_FINAL:'<!-- wp:paragraph --><p>Texto sintético.</p><!-- /wp:paragraph -->'};
 const literal=buildLiteralDelivery({baseMaster:master,policy:{authorized:true,mode:'PUBLISH',destination:'TODOS',content_mode:'LITERAL'},packageId:'tg_'+'c'.repeat(40),revision:9,sourceText:'Título literal\n\nPárrafo original.',title:'Título literal',subtitle:'',paragraphs:['Párrafo original.']}).master;
 return `// MASTER_SEMANTIC_PREFLIGHT_QA_V1 — synthetic data, zero external I/O
async function validateCode($input,$){\n${validator}\n}
async function formatCode($input,$){\n${formatter}\n}
const clone=x=>JSON.parse(JSON.stringify(x));
const base=${JSON.stringify(master)};
const literal=${JSON.stringify(literal)};
const requestId='tg_'+'a'.repeat(64);
const names=[];let assertions=0;
const check=(condition,name)=>{assertions++;if(!condition)throw Error('SEMANTIC_QA_ASSERTION_'+name)};
function value(destination='TODOS'){return {payload:{request_id:requestId,CREAR_EN:destination,PUBLICAR:false,master:clone(base),hero_file:{base64:'/9j/2Q=='},featured_file:{base64:'/9j/2Q=='}},stats:{master:100,hero:4,destacada:4}}}
function request(operation='validar_archivos_opmx',destination='TODOS'){return {id:1,operation,destino:destination,request_id:operation==='validar_archivos_opmx'?null:requestId}}
async function execute(code,p,r){return clone(await code({first:()=>({json:clone(p)})},name=>({first:()=>({json:name==='Protocolo MCP archivos'?{request:clone(r)}:name==='Literal archivos — Conservar validación'?{literal_profile:null}:(()=>{throw Error('UNEXPECTED_QA_LOOKUP')})()})})))}
async function run(p,r=request()){
 const before=JSON.stringify(p),checked=(await execute(validateCode,p,r))[0].json;
 check(before===JSON.stringify(p),'INPUT_IMMUTABLE');check(JSON.stringify(checked.payload)===JSON.stringify(p.payload),'PAYLOAD_IMMUTABLE');
 return {checked,final:(await execute(formatCode,checked,r))[0].json.response.result.structuredContent};
}
for(const destination of ['OPURO','OPOL','LIBERAL','AMBOS','OPURO,LIBERAL','OPOL,LIBERAL','TODOS']){
 const {checked,final}=await run(value(destination),request('validar_archivos_opmx',destination));
 check(checked.semantic_preflight.ok===true,'VALID_DESTINATION');check(final.status==='FILES_VALIDATED','FILES_VALIDATED');check(final.validation_scope.live_cms_checks==='NOT_CHECKED','STATIC_SCOPE');check(final.validation_scope.request_binding==='NOT_CHECKED','NO_BINDING_CLAIM');names.push('destination_'+destination);
}
const badCases=[
 ['TITLE',x=>delete x.payload.master.SEO.TITULO_SEO,'SEO.TITULO_SEO'],
 ['KEYWORD',x=>delete x.payload.master.SEO.KEYWORD_PRINCIPAL,'SEO.KEYWORD_PRINCIPAL'],
 ['TAGS',x=>x.payload.master.SEO.ETIQUETAS=[],'SEO.ETIQUETAS'],
 ['EXCERPT',x=>x.payload.master.PUBLICACION.EXTRACTO='','PUBLICACION.EXTRACTO'],
 ['STATE',x=>x.payload.master.CONTROL_EDITORIAL.ESTADO='BORRADOR','CONTROL_EDITORIAL.ESTADO'],
 ['CATEGORY',x=>x.payload.master.CATEGORIAS.OPOL.PRINCIPAL='SIN CATEGORIA','CATEGORIAS.OPOL.PRINCIPAL'],
 ['HIERARCHY',x=>x.payload.master.CATEGORIAS.OPOL.SECUNDARIA='SENADORES','CATEGORIAS.OPOL.SECUNDARIA'],
 ['LIBERAL_CATEGORY',x=>delete x.payload.master.CATEGORIAS.LIBERAL.PRINCIPAL,'CATEGORIAS.LIBERAL.PRINCIPAL'],
 ['AUTHOR',x=>x.payload.master.PUBLICACION.AUTOR_ID=2,'PUBLICACION.AUTOR_ID'],
 ['SLUG',x=>x.payload.master.SEO.SLUG='../invalid','SEO.SLUG'],
 ['HERO',x=>delete x.payload.hero_file,'hero_file'],
 ['FEATURED_FORMAT',x=>x.payload.featured_file.base64='YmFk','featured_file'],
 ['BLOCK',x=>x.payload.master.GUTENBERG_ENRIQUECIDO_FINAL='<p>sin bloque</p>','GUTENBERG_ENRIQUECIDO_FINAL'],
 ['PLACEHOLDER',x=>x.payload.master.IMAGENES.HERO_OPURO.URL='https://private.invalid/NEVER_ECHO','IMAGENES.HERO_OPURO.URL'],
];
for(const [name,mutate,field]of badCases){const p=value();mutate(p);const {checked,final}=await run(p,request('publicar_nota_opmx'));check(checked.semantic_preflight.ok===false,'REJECTED');check(final.status==='VALIDATION_FAILED','CLASSIFIED');check(final.field===field,'BOUNDED_FIELD');check(final.writesStarted===false&&final.retryPermitted===false,'NO_WRITE_OR_RETRY');check(!JSON.stringify(final).includes('NEVER_ECHO'),'NO_RAW_SOURCE');names.push(name)}
{
 const p=value();p.payload.request_id=null;const {checked}=await run(p);check(checked.semantic_preflight.ok===true&&checked.payload.request_id===null,'NULL_VALIDATION_ONLY');names.push('null_validation_scope');
 const r=request('publicar_nota_opmx'),rejected=await run(p,r);check(rejected.final.status==='VALIDATION_FAILED'&&rejected.final.field==='request_id','NULL_WRITE_REJECTED');names.push('null_write_rejected');
}
{
 const p=value('OPOL');delete p.payload.hero_file;const {checked}=await run(p,request('validar_archivos_opmx','OPOL'));check(checked.semantic_preflight.ok===true&&!Object.hasOwn(checked.payload,'hero_file'),'OPOL_NO_HERO');names.push('opol_no_hero');
}
{
 const p=value();p.payload.master=clone(literal);p.payload.request_id=null;const {checked}=await run(p);check(checked.semantic_preflight.ok===true,'LITERAL_ACCEPTED');names.push('literal_original');
 p.payload.master.GUTENBERG_FINAL='<!-- wp:paragraph --><p>Modificado.</p><!-- /wp:paragraph -->';const {final}=await run(p);check(final.status==='VALIDATION_FAILED'&&final.field==='CONTROL_EDITORIAL.LITERAL','LITERAL_MUTATION_REJECTED');names.push('literal_mutation');
}
{
 const p=value(),r=request('publicar_nota_opmx'),checked=(await execute(validateCode,p,r))[0].json;check(checked.semantic_preflight.ok===true,'CREATE_STATIC_VALID');check(r.operation!=='validar_archivos_opmx'&&checked.semantic_preflight.ok===true,'CREATE_BRANCH_UNCHANGED');names.push('create_continues_unchanged');
 const scope=checked.semantic_preflight;return [{json:{status:'SEMANTIC_PREFLIGHT_QA_PASSED',cases:names.length,assertions,casesPassed:names,externalIoCalls:0,cmsWrites:0,telegramMessages:0,guardMutations:0,sharedVersionId:scope.shared_version_id,prepareSha256:scope.prepare_sha256,normalizerSha256:scope.normalizer_sha256,scope:'STATIC_CODE_ONLY'}}];
}
`;
}
