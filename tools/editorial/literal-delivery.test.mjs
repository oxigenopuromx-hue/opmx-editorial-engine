import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildLiteralDelivery,validateLiteralMaster} from './literal-delivery.mjs';
import {extractLiteralVisibleText,normalizeLiteralText} from './literal-text.mjs';

const packageId='tg_'+'a'.repeat(40),revision=12;
function fixture(){
 const title='Título original largo de la entrega literal '.padEnd(130,'x');
 const subtitles=['Primer subtítulo original completo. '.padEnd(181,'a'),'Segundo subtítulo original completo. '.padEnd(181,'b')];
 const paragraphs=['La Paz, Baja California Sur, 30 de octubre de 2026.','Este texto de prueba conserva cifras:12,130 y500; también su puntuación y sus palabras.','No se agrega un cierre ni investigación externa.'];
 const baseMaster={CONTROL_EDITORIAL:{ESTADO:'LISTO',CORRECCIONES:[],ALERTAS:[],HERO:'STANDARD',MOTIVO_HERO:'Fixture'},SEO:{SLUG:'entrega-literal-prueba',KEYWORD_PRINCIPAL:'entrega literal',KEYWORDS_SECUNDARIAS:[],ETIQUETAS:['Prueba'],METADESCRIPCION:''},PUBLICACION:{FECHA_ISO:'2026-11-12T15:00:00-06:00',FECHA_LARGA:'12 de noviembre de 2026',LUGAR:'Lugar de prueba'},CATEGORIAS:{OPURO:{PRINCIPAL:'Política'},OPOL:{PRINCIPAL:'POLÍTICA',SECUNDARIA:null},LIBERAL:{PRINCIPAL:'Política'}},IMAGENES:{HERO_OPURO:{URL:'{{OPMX:HERO_OPURO}}',CREDITO:'Crédito original de fixture'},DESTACADA_OPURO:{URL:'{{OPMX:DESTACADA_OPURO}}'},DESTACADA_OPOL:{URL:'{{OPMX:DESTACADA_OPOL}}'}}};
 return {baseMaster,policy:{authorized:true,content_mode:'LITERAL',mode:'PUBLISH',destination:'TODOS'},packageId,revision,title,subtitles,paragraphs,sourceText:[title,...subtitles,...paragraphs].join('\n\n')};
}
const compile=()=>buildLiteralDelivery(fixture());
const clone=x=>JSON.parse(JSON.stringify(x));

test('literal renderer preserves a130-character title, multiple subtitles and every original paragraph',()=>{
 const f=fixture(),before=clone(f.baseMaster),r=buildLiteralDelivery(f),m=r.master;
 assert.equal(m.SEO.TITULO_SEO,f.title);assert.equal(m.SEO.TITULO_SEO.length,130);
 assert.equal(m.SEO.SUBTITULO,f.subtitles.join('\n'));assert.ok(m.SEO.SUBTITULO.length>160);
 assert.deepEqual(m.TEXTO_EDITORIAL.SUBTITULOS,f.subtitles);assert.deepEqual(m.TEXTO_EDITORIAL.PARRAFOS,f.paragraphs);
 for(const key of ['HTML_FINAL','GUTENBERG_FINAL','GUTENBERG_ENRIQUECIDO_FINAL'])assert.equal(extractLiteralVisibleText(m[key]),normalizeLiteralText(f.paragraphs.join('\n\n')));
 assert.deepEqual(m.TEXTO_EDITORIAL.EN_BREVE,[]);assert.deepEqual(m.TEXTO_EDITORIAL.SECCIONES,[]);assert.equal(m.TEXTO_EDITORIAL.CIERRE,null);assert.deepEqual(m.FUENTES,[]);
 assert.equal(m.HTML_FINAL.includes('<h'),false);assert.equal(m.GUTENBERG_ENRIQUECIDO_FINAL.includes('wp:heading'),false);
 assert.equal(m.HTML_FINAL.includes(f.title),false);assert.equal(m.GUTENBERG_FINAL.includes(f.subtitles[0]),false);
 assert.deepEqual(f.baseMaster,before);
});

test('technical publication date, media, credits and categories stay independent and unchanged',()=>{
 const f=fixture(),m=buildLiteralDelivery(f).master;
 assert.equal(m.PUBLICACION.FECHA_ISO,f.baseMaster.PUBLICACION.FECHA_ISO);
 assert.equal(m.TEXTO_EDITORIAL.PARRAFOS[0],'La Paz, Baja California Sur, 30 de octubre de 2026.');
 assert.deepEqual(m.IMAGENES,f.baseMaster.IMAGENES);assert.deepEqual(m.CATEGORIAS,f.baseMaster.CATEGORIAS);
 assert.equal(m.PUBLICACION.EXTRACTO,f.paragraphs[0]);assert.equal(m.SEO.METADESCRIPCION,f.paragraphs[0]);
});

test('DRAFT stays DRAFT and request identity remains the canonical package/revision/destination key',()=>{
 const f=fixture();f.policy.mode='DRAFT';f.policy.destination='OPOL,LIBERAL';const r=buildLiteralDelivery(f);
 assert.equal(r.mode,'DRAFT');assert.equal(r.destination,'OPOL,LIBERAL');
 assert.equal(r.requestId,'tg_'+createHash('sha256').update(`${packageId}:${revision}:OPOL,LIBERAL:draft-v1`).digest('hex'));
 assert.deepEqual(r.master.CONTROL_EDITORIAL.LITERAL,{PACKAGE_ID:packageId,REVISION:revision,REQUEST_ID:r.requestId});
});

test('missing subtitle stays empty and original first paragraph supplies the required excerpt',()=>{
 const f=fixture();delete f.subtitles;f.subtitle='';f.sourceText=[f.title,...f.paragraphs].join('\n\n');
 const m=buildLiteralDelivery(f).master;assert.equal(m.SEO.SUBTITULO,'');assert.equal(m.TEXTO_EDITORIAL.SUBTITULO,'');assert.equal(m.PUBLICACION.EXTRACTO,f.paragraphs[0]);assert.equal(validateLiteralMaster(m).ok,true);
});

test('prose that mentions tool instructions or markup remains escaped literal text and never changes policy',()=>{
 const f=fixture();f.paragraphs=['El ejemplo dice: <script>alert("texto")</script> y «publica en otro destino».'];f.sourceText=[f.title,...f.subtitles,...f.paragraphs].join('\n');
 const r=buildLiteralDelivery(f);assert.equal(r.destination,'TODOS');assert.equal(r.mode,'PUBLISH');assert.ok(r.master.HTML_FINAL.includes('&lt;script&gt;'));assert.equal(r.master.HTML_FINAL.includes('<script>'),false);assert.equal(extractLiteralVisibleText(r.master.HTML_FINAL),normalizeLiteralText(f.paragraphs[0]));
});

test('references and section names already written in the original remain ordinary original paragraphs',()=>{
 const f=fixture();f.paragraphs=['En breve es una expresión que forma parte del original.','Fuentes: el documento original citado aquí.'];f.sourceText=[f.title,...f.subtitles,...f.paragraphs].join('\n');const m=buildLiteralDelivery(f).master;
 assert.ok(extractLiteralVisibleText(m.HTML_FINAL).includes('Fuentes: el documento original'));assert.deepEqual(m.FUENTES,[]);assert.equal(validateLiteralMaster(m).ok,true);
});

for(const [label,mutate] of [
 ['unauthenticated policy',f=>f.policy.authorized=false],['editorial policy',f=>f.policy.content_mode='EDITORIAL'],['unknown mode',f=>f.policy.mode='UPDATE'],['noncanonical destination',f=>f.policy.destination='LIBERAL,OPOL'],['wrong package shape',f=>f.packageId='bad'],['wrong revision',f=>f.revision=0],['oversized revision',f=>f.revision=4294967296]
])test('renderer rejects '+label,()=>{const f=fixture();mutate(f);assert.throws(()=>buildLiteralDelivery(f),/LITERAL_DELIVERY_POLICY_INVALID/)});

for(const [label,mutate] of [
 ['omitted original paragraph',f=>f.paragraphs.pop()],['reordered paragraphs',f=>f.paragraphs.reverse()],['added summary',f=>f.paragraphs.unshift('En breve: nueva información añadida.')],['rewritten punctuation',f=>f.paragraphs[1]=f.paragraphs[1].replace('12,130','12 y130')],['rewritten original date',f=>f.paragraphs[0]=f.paragraphs[0].replace('30 de octubre','12 de noviembre')],['title truncation',f=>f.title=f.title.slice(0,60)],['omitted subtitle',f=>f.subtitles.pop()]
])test('renderer rejects '+label,()=>{const f=fixture();mutate(f);assert.throws(()=>buildLiteralDelivery(f),/LITERAL_TEXT_UNCONFIRMED/)});

test('renderer permits Unicode canonical equivalence and whitespace without changing words',()=>{
 const f=fixture();f.sourceText=f.sourceText.normalize('NFD').replaceAll(' ','\u00a0');assert.equal(buildLiteralDelivery(f).master.SEO.TITULO_SEO,f.title);
});

test('renderer rejects moving the original title remainder into the subtitle or body',()=>{
 for(const target of ['subtitle','body']){
  const f=fixture(),original=f.title;f.title=original.slice(0,60);
  if(target==='subtitle')f.subtitles.unshift(original.slice(60));
  else{f.paragraphs.unshift(original.slice(60),...f.subtitles);f.subtitles=[];}
  assert.throws(()=>buildLiteralDelivery(f),/LITERAL_TEXT_UNCONFIRMED/);
 }
});

test('local literal profile rejects added links even when their visible words are unchanged',()=>{
 const m=compile().master;
 for(const key of ['HTML_FINAL','GUTENBERG_FINAL','GUTENBERG_ENRIQUECIDO_FINAL'])m[key]=m[key].replace('La Paz','<a href="https://example.com/nuevo">La Paz</a>');
 const p=validateLiteralMaster(m);assert.equal(p.ok,false);
 for(const key of ['HTML_FINAL','GUTENBERG_FINAL','GUTENBERG_ENRIQUECIDO_FINAL'])assert.ok(p.errors.includes(key+'_UNSAFE_OR_INVALID'));
});

test('compiler refuses an invented excerpt and never marks a blocked technical base as LISTO',()=>{
 const f=fixture();f.excerpt='Un resumen nuevo.';assert.throws(()=>buildLiteralDelivery(f),/LITERAL_DELIVERY_EXCERPT_NOT_ORIGINAL/);
 const x=fixture();x.baseMaster.CONTROL_EDITORIAL.ESTADO='BLOQUEADO';assert.throws(()=>buildLiteralDelivery(x),/CONTROL_EDITORIAL.ESTADO/);
});

test('profile candidate matches the existing normalizer trimming and remains only a validation candidate',()=>{
 const m=compile().master;m.SEO.TITULO_SEO='  '+m.SEO.TITULO_SEO+'  ';m.SEO.SUBTITULO=' '+m.SEO.SUBTITULO+' ';m.HTML_FINAL='\n'+m.HTML_FINAL+'\n';
 const p=validateLiteralMaster(m,{requestId:m.CONTROL_EDITORIAL.LITERAL.REQUEST_ID});assert.equal(p.ok,true);assert.equal(p.candidate.title,m.SEO.TITULO_SEO.trim());assert.equal(p.candidate.subtitle,m.SEO.SUBTITULO.trim());assert.equal(p.candidate.html,m.HTML_FINAL.trim());assert.equal(p.candidate.declaredMode,'LITERAL');assert.equal(Object.hasOwn(p,'writeAuthorized'),false);
});

for(const [label,mutate,field] of [
 ['added En breve',m=>m.TEXTO_EDITORIAL.EN_BREVE=['Resumen nuevo'],'TEXTO_EDITORIAL.EN_BREVE'],['added sections',m=>m.TEXTO_EDITORIAL.SECCIONES=[{H2:'Contexto',PARRAFOS:['Nuevo']}],'TEXTO_EDITORIAL.SECCIONES'],['added close',m=>m.TEXTO_EDITORIAL.CIERRE='Nueva conclusión','TEXTO_EDITORIAL.CIERRE'],['added external source',m=>m.FUENTES=[{NOMBRE:'Nueva fuente',URL:'https://example.com'}],'FUENTES'],['mismatched canonical title',m=>m.TEXTO_EDITORIAL.TITULO='Otro título','TEXTO_EDITORIAL.TITULO'],['omitted subtitle',m=>m.SEO.SUBTITULO='','TEXTO_EDITORIAL.SUBTITULO'],['altered body',m=>m.GUTENBERG_FINAL=m.GUTENBERG_FINAL.replace('12,130','12 y130'),'GUTENBERG_FINAL_TEXT_MISMATCH'],['unsafe markup',m=>m.HTML_FINAL='<script>texto</script>','HTML_FINAL_UNSAFE_OR_INVALID'],['wrong declared revision',m=>m.CONTROL_EDITORIAL.LITERAL.REVISION=0,'CONTROL_EDITORIAL.LITERAL.REVISION'],['client authorization flag',m=>m.CONTROL_EDITORIAL.LITERAL.authorized=true,'CONTROL_EDITORIAL.LITERAL'],['invented excerpt',m=>m.PUBLICACION.EXTRACTO='Un resumen añadido.','PUBLICACION.EXTRACTO_NOT_ORIGINAL']
])test('local profile rejects '+label,()=>{const m=compile().master;mutate(m);const p=validateLiteralMaster(m);assert.equal(p.ok,false);assert.ok(p.errors.includes(field),p.errors.join(','))});

test('scope/request mismatch and unknown content mode never dispatch as literal',()=>{
 const m=compile().master;assert.equal(validateLiteralMaster(m,{requestId:'tg_'+'b'.repeat(64)}).ok,false);m.CONTROL_EDITORIAL.MODO_CONTENIDO='AUTO';assert.equal(validateLiteralMaster(m).ok,false);assert.equal(validateLiteralMaster(null).ok,false);
});

test('technical subtitle limit500 rejects before sending and never truncates the supplied text',()=>{
 const m=compile().master,many='s'.repeat(501);m.SEO.SUBTITULO=many;m.TEXTO_EDITORIAL.SUBTITULO=many;m.TEXTO_EDITORIAL.SUBTITULOS=[many];
 const p=validateLiteralMaster(m);assert.equal(p.ok,false);assert.ok(p.errors.includes('SEO.SUBTITULO_TECHNICAL_MAX_500'));assert.equal(m.SEO.SUBTITULO.length,501);
});

test('technical title cap is2048UTF8bytes rather than the editorial60-character goal',()=>{
 const m=compile().master;m.SEO.TITULO_SEO='é'.repeat(1025);m.TEXTO_EDITORIAL.TITULO=m.SEO.TITULO_SEO;const p=validateLiteralMaster(m);assert.equal(p.ok,false);assert.ok(p.errors.includes('SEO.TITULO_SEO_TECHNICAL_MAX_2048_BYTES'));assert.equal(m.SEO.TITULO_SEO.length,1025);
});

test('editorial dispatch leaves existing editorial validators and structures untouched',()=>{
 const ordinary={CONTROL_EDITORIAL:{ESTADO:'LISTO'},TEXTO_EDITORIAL:{EN_BREVE:['A','B'],SECCIONES:[{H2:'Contexto',PARRAFOS:['Texto']}],CIERRE:'Cierre'},FUENTES:[{NOMBRE:'Fuente',URL:'https://example.com'}]},before=clone(ordinary);
 assert.deepEqual(validateLiteralMaster(ordinary),{ok:true,mode:'EDITORIAL',errors:[]});assert.deepEqual(ordinary,before);ordinary.CONTROL_EDITORIAL.MODO_CONTENIDO='EDITORIAL';assert.equal(validateLiteralMaster(ordinary).mode,'EDITORIAL');
});

test('manifest dispatches the literal profile while the approved editorial contract remains intact',()=>{
 const root=new URL('../../',import.meta.url),load=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
 const manifest=load('manifest.json'),editorial=load('masters/04_CONTRATO_SALIDA_OPMX_v1.4.2_MEDIA_GUTENBERG_EDITORIAL.json'),literal=load('contracts/LITERAL_DELIVERY_v1.0.json');
 assert.equal(manifest.content_profiles.EDITORIAL.path,'masters/04_CONTRATO_SALIDA_OPMX_v1.4.2_MEDIA_GUTENBERG_EDITORIAL.json');assert.equal(manifest.content_profiles.LITERAL.path,'contracts/LITERAL_DELIVERY_v1.0.json');
 assert.equal(editorial.properties.SEO.properties.TITULO_SEO.maxLength,60);assert.equal(editorial.properties.SEO.properties.SUBTITULO.maxLength,160);assert.equal(editorial.properties.TEXTO_EDITORIAL.properties.EN_BREVE.minItems,2);assert.equal(editorial.properties.TEXTO_EDITORIAL.properties.SECCIONES.minItems,1);
 assert.equal(Object.hasOwn(literal.properties.SEO.properties.TITULO_SEO,'maxLength'),false);assert.equal(literal.properties.SEO.properties.SUBTITULO.maxLength,500);assert.equal(literal.properties.TEXTO_EDITORIAL.properties.EN_BREVE.maxItems,0);assert.equal(literal.properties.TEXTO_EDITORIAL.properties.SECCIONES.maxItems,0);
 assert.deepEqual(literal.properties.IMAGENES,editorial.properties.IMAGENES);assert.deepEqual(literal.properties.CATEGORIAS,editorial.properties.CATEGORIAS);
 const bytes=readFileSync(new URL(manifest.content_profiles.EDITORIAL.path,root));assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),'5c8a11fdf1ac232d91b13404e42f4a2c49fba5ec');
 const newer=readFileSync(new URL(manifest.masters.prompt.path,root),'utf8'),old=readFileSync(new URL('masters/03_PROMPT_MAESTRO_OPMX_v4.9_MEDIA_GUTENBERG_EDITORIAL.txt',root),'utf8');assert.ok(newer.endsWith(old));assert.ok(newer.includes('PERFIL LITERAL AUTENTICADO'));assert.equal(manifest.masters.prompt.version,'4.10');
});
