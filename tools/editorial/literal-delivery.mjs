import {createHash} from 'node:crypto';
import {normalizeLiteralText,extractLiteralPlainText,assertLiteralCanonicalText} from './literal-text.mjs';

const literalDestinations=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
const nonemptyLiteralString=value=>typeof value==='string'&&value.trim().length>0;
const literalEscape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

// This renderer consumes the policy returned by chooseMotorPolicy and a corpus
// assembled from verified source buffers. It is not an authentication proof:
// Publisher must still validate the exact request and text against the Guard's
// stored records. No instruction inside sourceText changes policy or scope.
export function buildLiteralDelivery({baseMaster,policy,packageId,revision,sourceText,title,subtitle,subtitles,paragraphs,excerpt}={}){
 if(!baseMaster||typeof baseMaster!=='object'||Array.isArray(baseMaster)||!policy||policy.authorized!==true||policy.content_mode!=='LITERAL'||!['DRAFT','PUBLISH'].includes(policy.mode)||!literalDestinations.includes(policy.destination)||!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||revision<1||revision>4294967295)throw Error('LITERAL_DELIVERY_POLICY_INVALID');
 if(!nonemptyLiteralString(sourceText)||!nonemptyLiteralString(title)||!Array.isArray(paragraphs)||!paragraphs.length||paragraphs.some(x=>!nonemptyLiteralString(x)))throw Error('LITERAL_DELIVERY_TEXT_INVALID');
 if(subtitle!==undefined&&subtitles!==undefined)throw Error('LITERAL_DELIVERY_SUBTITLE_AMBIGUOUS');
 if(subtitles!==undefined&&(!Array.isArray(subtitles)||subtitles.some(x=>!nonemptyLiteralString(x))))throw Error('LITERAL_DELIVERY_SUBTITLE_INVALID');
 const finalSubtitle=subtitles!==undefined?subtitles.join('\n'):subtitle??'';
 if(typeof finalSubtitle!=='string')throw Error('LITERAL_DELIVERY_SUBTITLE_INVALID');
 const html=paragraphs.map(p=>`<p>${literalEscape(p)}</p>`).join('\n');
 const gutenberg=paragraphs.map(p=>`<!-- wp:paragraph -->\n<p>${literalEscape(p)}</p>\n<!-- /wp:paragraph -->`).join('\n\n');
 assertLiteralCanonicalText({sourceText,title,subtitle:finalSubtitle,html,gutenberg,enriched:gutenberg});
 const requestId='tg_'+createHash('sha256').update(`${packageId}:${revision}:${policy.destination}:draft-v1`,'utf8').digest('hex');
 const finalExcerpt=excerpt??paragraphs[0];
 if(!nonemptyLiteralString(finalExcerpt)||![...paragraphs,finalSubtitle].filter(nonemptyLiteralString).some(x=>normalizeLiteralText(x)===normalizeLiteralText(finalExcerpt)))throw Error('LITERAL_DELIVERY_EXCERPT_NOT_ORIGINAL');
 const master=JSON.parse(JSON.stringify(baseMaster));
 master.CONTROL_EDITORIAL={...(master.CONTROL_EDITORIAL??{}),MODO_CONTENIDO:'LITERAL',LITERAL:{PACKAGE_ID:packageId,REVISION:revision,REQUEST_ID:requestId}};
 master.SEO={...(master.SEO??{}),TITULO_SEO:title,SUBTITULO:finalSubtitle};
 if(!nonemptyLiteralString(master.SEO.METADESCRIPCION))master.SEO.METADESCRIPCION=finalExcerpt;
 master.PUBLICACION={...(master.PUBLICACION??{}),EXTRACTO:finalExcerpt};
 master.TEXTO_EDITORIAL={TITULO:title,SUBTITULO:finalSubtitle,...(subtitles!==undefined?{SUBTITULOS:[...subtitles]}:{}),PARRAFOS:[...paragraphs],ENTRADILLA:paragraphs[0],EN_BREVE:[],SECCIONES:[],CIERRE:null};
 master.FUENTES=[];
 master.HTML_FINAL=html;master.GUTENBERG_FINAL=gutenberg;master.GUTENBERG_ENRIQUECIDO_FINAL=gutenberg;
 const validation=validateLiteralMaster(master,{requestId});
 if(!validation.ok)throw Error('LITERAL_DELIVERY_MASTER_INVALID:'+validation.errors.join(','));
 return {master,requestId,mode:policy.mode,destination:policy.destination,content_mode:'LITERAL'};
}

// Pure profile validation, suitable for embedding into the existing n8n Code
// preflight. EDITORIAL is dispatched back to its existing validators unchanged.
// A successful local profile check does not authenticate LITERAL or grant a
// write permit; the Guard derives mode, scope and original text independently.
export function validateLiteralMaster(master,{requestId}={}){
 const errors=[];
 const fail=error=>{errors.push(error)};
 if(!master||typeof master!=='object'||Array.isArray(master))return {ok:false,mode:null,errors:['MASTER_INVALID']};
 const equivalent=(a,b)=>{try{return normalizeLiteralText(a)===normalizeLiteralText(b)}catch{return false}};
 const control=master?.CONTROL_EDITORIAL;
 const declared=control?.MODO_CONTENIDO;
 if(declared===undefined||declared==='EDITORIAL')return {ok:true,mode:'EDITORIAL',errors};
 if(declared!=='LITERAL')return {ok:false,mode:null,errors:['CONTROL_EDITORIAL.MODO_CONTENIDO_INVALID']};
 if(!master||typeof master!=='object'||Array.isArray(master)||control?.ESTADO!=='LISTO')fail('CONTROL_EDITORIAL.ESTADO');
 const scope=control?.LITERAL;
 if(!scope||typeof scope!=='object'||Array.isArray(scope)||Object.keys(scope).sort().join(',')!=='PACKAGE_ID,REQUEST_ID,REVISION')fail('CONTROL_EDITORIAL.LITERAL');
 if(!/^tg_[a-f0-9]{40}$/.test(scope?.PACKAGE_ID??''))fail('CONTROL_EDITORIAL.LITERAL.PACKAGE_ID');
 if(!Number.isSafeInteger(scope?.REVISION)||scope.REVISION<1||scope.REVISION>4294967295)fail('CONTROL_EDITORIAL.LITERAL.REVISION');
 if(!/^tg_[a-f0-9]{64}$/.test(scope?.REQUEST_ID??'')||requestId!==undefined&&requestId!==scope?.REQUEST_ID)fail('CONTROL_EDITORIAL.LITERAL.REQUEST_ID');
 const seo=master?.SEO??{},text=master?.TEXTO_EDITORIAL??{};
 if(typeof seo.TITULO_SEO!=='string'||!seo.TITULO_SEO.trim())fail('SEO.TITULO_SEO');
 else if(new TextEncoder().encode(seo.TITULO_SEO).length>2048)fail('SEO.TITULO_SEO_TECHNICAL_MAX_2048_BYTES');
 if(typeof seo.SUBTITULO!=='string')fail('SEO.SUBTITULO');
 else if(seo.SUBTITULO.length>500)fail('SEO.SUBTITULO_TECHNICAL_MAX_500');
 if(typeof text.TITULO!=='string'||typeof seo.TITULO_SEO!=='string'||!equivalent(text.TITULO,seo.TITULO_SEO))fail('TEXTO_EDITORIAL.TITULO');
 if(typeof text.SUBTITULO!=='string'||typeof seo.SUBTITULO!=='string'||!equivalent(text.SUBTITULO,seo.SUBTITULO))fail('TEXTO_EDITORIAL.SUBTITULO');
 if(text.SUBTITULOS!==undefined&&(!Array.isArray(text.SUBTITULOS)||text.SUBTITULOS.some(x=>typeof x!=='string'||!x.trim())||!equivalent(text.SUBTITULOS.join('\n'),seo.SUBTITULO??'')))fail('TEXTO_EDITORIAL.SUBTITULOS');
 const paragraphs=text.PARRAFOS;
 if(!Array.isArray(paragraphs)||!paragraphs.length||paragraphs.some(x=>typeof x!=='string'||!x.trim()))fail('TEXTO_EDITORIAL.PARRAFOS');
 for(const key of ['EN_BREVE','SECCIONES'])if(text[key]!==undefined&&(!Array.isArray(text[key])||text[key].length))fail('TEXTO_EDITORIAL.'+key);
 if(text.CIERRE!==undefined&&text.CIERRE!==null&&(typeof text.CIERRE!=='string'||text.CIERRE.trim()))fail('TEXTO_EDITORIAL.CIERRE');
 if(master?.FUENTES!==undefined&&(!Array.isArray(master.FUENTES)||master.FUENTES.length))fail('FUENTES');
 const excerpt=master?.PUBLICACION?.EXTRACTO;
 if(typeof excerpt!=='string'||!excerpt.trim())fail('PUBLICACION.EXTRACTO');
 else if(Array.isArray(paragraphs)&&!([...paragraphs,seo.SUBTITULO].filter(x=>typeof x==='string').some(x=>equivalent(x,excerpt))))fail('PUBLICACION.EXTRACTO_NOT_ORIGINAL');
 for(const key of ['HTML_FINAL','GUTENBERG_FINAL','GUTENBERG_ENRIQUECIDO_FINAL']){
  const markup=master?.[key];
  if(typeof markup!=='string'||!markup.trim()){fail(key);continue}
  if(key!=='HTML_FINAL'&&!/<!--\s*wp:paragraph(?:\s|-->)/.test(markup)){fail(key+'_GUTENBERG_REQUIRED');continue}
  try{if(Array.isArray(paragraphs)&&normalizeLiteralText(extractLiteralPlainText(markup))!==normalizeLiteralText(paragraphs.join('\n\n')))fail(key+'_TEXT_MISMATCH')}catch{fail(key+'_UNSAFE_OR_INVALID')}
 }
 if(errors.length)return {ok:false,mode:'LITERAL',errors};
 return {ok:true,mode:'LITERAL',errors,candidate:{requestId:scope.REQUEST_ID,declaredMode:'LITERAL',title:seo.TITULO_SEO.trim(),subtitle:seo.SUBTITULO.trim(),html:master.HTML_FINAL.trim(),gutenberg:master.GUTENBERG_FINAL.trim(),enriched:master.GUTENBERG_ENRIQUECIDO_FINAL.trim()}};
}
