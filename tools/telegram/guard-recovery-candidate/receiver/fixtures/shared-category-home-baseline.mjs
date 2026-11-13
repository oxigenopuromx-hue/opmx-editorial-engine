export default {
  "id": "4o7K5TmKc7joScqB",
  "versionId": "4263fea4-90a4-406d-a234-da7397d456bf",
  "nodes": [
    {
      "name": "Preparar MASTER y binarios",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForEachItem",
        "jsCode": "function destinationRegistry() {\n return {\n  OPURO:{cms:'https://cms.oxigenopuro.com.mx',publicOrigin:'https://oxigenopuro.com.mx',resultKey:'oxigenopuro',postIdKey:'post_id_opuro',heroMeta:'oxpuro_hero_media_id',editorialMeta:'oxpuro_editorial',hero:true},\n  OPOL:{cms:'https://cms.oxigenopolitico.com.mx',publicOrigin:'https://oxigenopolitico.com.mx',resultKey:'oxigenopolitico',postIdKey:'post_id_opol',hero:false},\n  LIBERAL:{cms:'https://cms.elliberal.mx',publicOrigin:'https://elliberal.mx',resultKey:'elliberal',postIdKey:'post_id_liberal',heroMeta:'liberalmx_hero_media_id',editorialMeta:'liberalmx_editorial',hero:true},\n };\n}\nfunction resolveDestinations(value) {\n if(Array.isArray(value)){if(!value.every(v=>typeof v==='string'))throw Error('Destino inválido');value=value.join(',');}\n if(typeof value!=='string'||!value.trim()||value.length>256)throw Error('Destino inválido');\n const registry=destinationRegistry(),selected=new Set();\n for(const item of value.split(',')){\n  const token=item.trim().toUpperCase();if(!token)throw Error('Destino vacío entre comas');\n  const expanded=token==='AMBOS'?['OPURO','OPOL']:token==='TODOS'?Object.keys(registry):[token];\n  for(const destination of expanded){if(!Object.hasOwn(registry,destination))throw Error('Destino desconocido: '+destination);selected.add(destination);}\n }\n return Object.keys(registry).filter(d=>selected.has(d));\n}\nfunction destinationLabel(destinations) {\n const all=Object.keys(destinationRegistry()),set=new Set(destinations),items=all.filter(d=>set.has(d));\n if(items.length!==set.size||!items.length)throw Error('Destino inválido');\n if(items.length===all.length)return 'TODOS';\n if(items.length===2&&items[0]==='OPURO'&&items[1]==='OPOL')return 'AMBOS';\n return items.join(',');\n}\nconst data = $json.body ?? $json;\nif (typeof data.request_id !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(data.request_id)) throw new Error('Falta request_id estable y válido');\nif (!data.master || typeof data.master !== 'object' || Array.isArray(data.master)) throw new Error('Falta MASTER como objeto JSON');\nconst destination=destinationLabel(resolveDestinations(data.CREAR_EN));\nif (data.PUBLICAR !== false) throw new Error('Esta prueba sólo admite PUBLICAR=false');\nconst binary = {};\nfor (const [key, required] of [['hero_file', destination !== 'OPOL'], ['featured_file', true]]) {\n  const file = data[key];\n  if (!file && !required) continue;\n  if (!file || typeof file.base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64) || !file.base64.length || file.base64.length > 14000000) throw new Error('Imagen inválida o ausente: '+key);\n  const buf = Buffer.from(file.base64, 'base64');\n  let mime, ext;\n  if (buf.length >= 8 && buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) { mime='image/png'; ext='png'; }\n  else if (buf.length >= 3 && buf[0]===255 && buf[1]===216 && buf[2]===255) { mime='image/jpeg'; ext='jpg'; }\n  else if (buf.length >= 12 && buf.subarray(0,4).toString()==='RIFF' && buf.subarray(8,12).toString()==='WEBP') { mime='image/webp'; ext='webp'; }\n  else throw new Error('Formato no admitido: '+key);\n  binary[key] = await this.helpers.prepareBinaryData(buf, key+'.'+ext, mime);\n}\nreturn {json:{json: JSON.stringify(data.master), CREAR_EN:destination, PUBLICAR:false, request_id:data.request_id,source_images:{hero_base64:data.hero_file?.base64??null,featured_base64:data.featured_file.base64}}, binary};"
      },
      "position": [
        224,
        1104
      ],
      "typeVersion": 2
    },
    {
      "name": "Validar y normalizar OPMX MASTER",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForEachItem",
        "jsCode": "const literalText=(()=>{\nconst MAX_BYTES=2*1024*1024;\nconst badControls=/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f]/u;\nconst htmlTags=new Set(['p','div','br','strong','b','em','i','u','s','a','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','span']);\nconst blockTags=new Set(['p','div','br','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote']);\nconst blocks=new Set(['paragraph','heading','list','list-item','quote']);\nconst entities={amp:'&',AMP:'&',lt:'<',LT:'<',gt:'>',GT:'>',quot:'\"',QUOT:'\"',apos:\"'\",nbsp:'\\u00a0'};\nconst safeClasses=new Set(['wp-block-paragraph','wp-block-heading','wp-block-list','wp-block-quote','has-text-align-left','has-text-align-center','has-text-align-right','has-text-align-justify']);\nconst fail=()=>{throw Error('LITERAL_TEXT_UNCONFIRMED')};\nfunction text(value,max=MAX_BYTES){\n if(typeof value!=='string'||badControls.test(value)||new TextEncoder().encode(value).length>max)fail();\n return value;\n}\nfunction normalizeLiteralText(value){return text(value).normalize('NFC').replace(/\\s+/gu,' ').trim();}\nfunction decode(value){\n let out='',offset=0;\n while(offset<value.length){\n  const index=value.indexOf('&',offset);\n  if(index<0){out+=value.slice(offset);break}\n  out+=value.slice(offset,index);const end=value.indexOf(';',index+1);\n  if(end<0||end-index>32)fail();const name=value.slice(index+1,end);\n  if(Object.hasOwn(entities,name))out+=entities[name];\n  else if(/^#(?:[0-9]+|x[a-f0-9]+)$/i.test(name)){\n   const cp=/^#x/i.test(name)?parseInt(name.slice(2),16):Number(name.slice(1));\n   if(!Number.isSafeInteger(cp)||cp<1||cp>0x10ffff||cp>=0xd800&&cp<=0xdfff||cp%0x10000>=0xfffe)fail();\n   const char=String.fromCodePoint(cp);if(badControls.test(char))fail();out+=char;\n  }else fail();\n  offset=end+1;\n }\n return text(out);\n}\nfunction classes(value){\n const tokens=value.trim().split(/\\s+/u);\n if(!tokens.length||tokens.some(x=>!safeClasses.has(x)))fail();\n}\nfunction safeHttpUrl(value){\n // The n8n Code sandbox does not expose URL. Validate only this conservative\n // HTTP(S) vocabulary locally; never resolve a hostname or fetch the link.\n if(/[\\\\\\u0000-\\u0020\\u007f]/u.test(value))return false;\n const match=/^https?:\\/\\/([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?(?:[/?#][\\s\\S]*)?$/i.exec(value);\n if(!match||match[2]&&(Number(match[2])<1||Number(match[2])>65535))return false;\n const host=match[1].endsWith('.')?match[1].slice(0,-1):match[1];\n if(!host||host.length>253)return false;\n if(/^[0-9.]+$/.test(host)){\n  const octets=host.split('.');\n  return octets.length===4&&octets.every(x=>/^(?:0|[1-9][0-9]{0,2})$/.test(x)&&Number(x)<=255);\n }\n if(/^(?:0x[a-f0-9]+|[0-9]+)(?:\\.(?:0x[a-f0-9]+|[0-9]+))*$/i.test(host)||/^[0-9]+$/.test(host.split('.').at(-1)))return false;\n return host.split('.').every(x=>x.length<=63&&/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(x));\n}\nfunction blockAttributes(name,value){\n if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)fail();\n const allowed={paragraph:['align','className','anchor','dropCap'],heading:['align','textAlign','className','anchor','level'],list:['ordered','start','reversed','className'], 'list-item':['className'],quote:['className']}[name];\n for(const [key,v] of Object.entries(value)){\n  if(!allowed.includes(key))fail();\n  if(key==='className'){if(typeof v!=='string')fail();classes(v)}\n  else if(key==='anchor'){if(typeof v!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(v))fail()}\n  else if(['align','textAlign'].includes(key)){if(!['left','center','right','justify'].includes(v))fail()}\n  else if(key==='level'){if(!Number.isSafeInteger(v)||v<1||v>6)fail()}\n  else if(key==='start'){if(!Number.isSafeInteger(v)||v<1||v>1000000)fail()}\n  else if(typeof v!=='boolean')fail();\n }\n}\nfunction attributes(raw,tag,{plain=false}={}){\n let remaining=raw;const seen=new Set();\n while(remaining.trim()){\n  const match=/^\\s+([A-Za-z][A-Za-z0-9-]*)\\s*=\\s*(?:\"([^\"<>]*)\"|'([^'<>]*)')/.exec(remaining);\n  if(!match)fail();const name=match[1].toLowerCase(),value=decode(match[2]??match[3]);remaining=remaining.slice(match[0].length);\n  if(seen.has(name)||!['class','id','title','lang','dir','href','rel','target'].includes(name)||plain&&name==='title')fail();seen.add(name);\n  if(name==='class')classes(value);\n  else if(name==='id'){if(!/^[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(value))fail()}\n  else if(name==='lang'){if(!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value))fail()}\n  else if(name==='dir'){if(!['ltr','rtl','auto'].includes(value))fail()}\n  else if(name==='title'){text(value,8192)}\n  else if(tag!=='a')fail();\n  else if(name==='href'){\n   if(value.startsWith('#')){if(!/^#[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(value))fail()}\n   else if(!safeHttpUrl(value))fail();\n  }else if(name==='target'){if(!['_blank','_self'].includes(value))fail()}\n  else if(name==='rel'){if(value.trim().split(/\\s+/u).some(x=>!['noopener','noreferrer','nofollow','sponsored','ugc'].includes(x)))fail()}\n }\n}\n\n// This intentionally handles only the small, deterministic markup vocabulary\n// used by the literal renderer. It does not run a browser, fetch a link, decode\n// an HTML entity into markup, execute a source instruction or discard unknown\n// HTML. Anything outside this vocabulary requires explicit reconciliation.\nfunction readLiteralMarkup(markup,{plain=false}={}){\n text(markup);const stack=[],blockStack=[];let offset=0,visible='',tokens=0;\n while(offset<markup.length){\n  if(++tokens>100000)fail();const index=markup.indexOf('<',offset);\n  if(index<0){visible+=decode(markup.slice(offset));offset=markup.length;break}\n  visible+=decode(markup.slice(offset,index));\n  if(markup.startsWith('<!--',index)){\n   const end=markup.indexOf('-->',index+4);if(end<0)fail();const body=markup.slice(index+4,end).trim();\n   const m=/^(\\/?)wp:(?:core\\/)?([a-z-]+)(?:\\s+(\\{[\\s\\S]*\\}))?(\\s*\\/)?$/.exec(body);\n   if(!m||!blocks.has(m[2])||body.includes('<!--')||body.includes('--'))fail();\n   const closing=m[1]==='/',selfClosing=!!m[4];\n   if(closing){if(m[3]||selfClosing)fail();const last=blockStack.pop();if(!last||last.name!==m[2]||last.depth!==stack.length)fail()}\n   else {if(m[3]){let parsed;try{parsed=JSON.parse(m[3])}catch{fail()}blockAttributes(m[2],parsed)}if(!selfClosing){blockStack.push({name:m[2],depth:stack.length});if(blockStack.length>64)fail()}}\n   offset=end+3;continue;\n  }\n  let end=index+1,quote=null;\n  for(;end<markup.length;end++){\n   const char=markup[end];\n   if(quote){if(char===quote)quote=null;else if(char==='<')fail()}\n   else if(char==='\"'||char===\"'\")quote=char;\n   else if(char==='>')break;\n   else if(char==='<')fail();\n  }\n  if(end>=markup.length||quote)fail();\n  const token=markup.slice(index,end+1),m=/^<(\\/?)([A-Za-z][A-Za-z0-9]*)([\\s\\S]*?)>$/.exec(token);\n  if(!m)fail();const closing=m[1]==='/',name=m[2].toLowerCase();if(!htmlTags.has(name)||plain&&name==='a')fail();\n  let rest=m[3],selfClosing=false;\n  if(/\\/\\s*$/.test(rest)){selfClosing=true;rest=rest.replace(/\\/\\s*$/,'')}\n  if(closing){if(rest.trim()||selfClosing||name==='br'||stack.pop()!==name)fail()}\n  else {\n   if(selfClosing&&name!=='br'||name==='a'&&stack.includes('a'))fail();\n   if(blockTags.has(name)&&name!=='br'&&stack.some(x=>['p','strong','b','em','i','u','s','a','span','h1','h2','h3','h4','h5','h6'].includes(x)))fail();\n   if(name==='li'&&!['ul','ol'].includes(stack.at(-1))||['ul','ol'].includes(stack.at(-1))&&name!=='li')fail();\n   attributes(rest,name,{plain});if(name!=='br'){stack.push(name);if(stack.length>128)fail()}\n  }\n  // A private separator retains rendered block boundaries without confusing\n  // source line wrapping with a new paragraph. Input NULs are rejected above.\n  if(blockTags.has(name))visible+='\\u0000';\n  offset=end+1;\n }\n if(stack.length||blockStack.length)fail();\n const segments=visible.split('\\u0000').map(normalizeLiteralText).filter(Boolean);\n return {visibleText:normalizeLiteralText(visible.replaceAll('\\u0000','\\n')),segments};\n}\n\nfunction extractLiteralVisibleText(markup){return readLiteralMarkup(markup).visibleText;}\n\n// Plain Telegram source has no authenticated rich-text link or tooltip data.\n// Reject those additions even when their visible words happen to be unchanged.\nfunction extractLiteralPlainText(markup){return readLiteralMarkup(markup,{plain:true}).visibleText;}\n\nfunction assertLiteralCanonicalText({sourceText,title,subtitle,html,gutenberg,enriched}={}){\n text(title,2048);text(subtitle,8192);\n if(!normalizeLiteralText(title)||/<\\/?[a-z!]/i.test(title)||/<\\/?[a-z!]/i.test(subtitle))fail();\n for(const value of [html,gutenberg,enriched])if(!text(value).trim())fail();\n const bodies=[html,gutenberg,enriched].map(value=>readLiteralMarkup(value,{plain:true}));\n const normalizedBody=bodies[1].visibleText;\n if(!normalizedBody||bodies.some(body=>body.visibleText!==normalizedBody))fail();\n const block=/<!--\\s*wp:(?:core\\/)?(?:paragraph|heading|list|quote)(?:\\s|--)/;\n if(!block.test(gutenberg)||!block.test(enriched))fail();\n const source=text(sourceText).normalize('NFC').replace(/\\r\\n?/g,'\\n');\n const lines=source.split('\\n'),first=lines.findIndex(line=>normalizeLiteralText(line));\n if(first<0||normalizeLiteralText(title)!==normalizeLiteralText(lines[first]))fail();\n const remainder=lines.slice(first+1).join('\\n').trim();\n // Blank lines delimit original paragraphs. Legacy plain messages without\n // blank lines use complete lines; a subtitle may consume whole leading units\n // only, never part of the title or part of an original body paragraph.\n const units=remainder.split(/\\n[^\\S\\n]*\\n/u.test(source)?/\\n[^\\S\\n]*\\n+/u:/\\n/u).map(normalizeLiteralText).filter(Boolean);\n const normalizedSubtitle=normalizeLiteralText(subtitle);\n let consumed=0;\n if(normalizedSubtitle){\n  let prefix='';\n  for(let index=0;index<units.length;index++){\n   prefix+=(index?' ':'')+units[index];\n   if(prefix===normalizedSubtitle){consumed=index+1;break}\n   if(prefix.length>=normalizedSubtitle.length)break;\n  }\n  if(!consumed)fail();\n }\n const originalBody=units.slice(consumed);\n if(!originalBody.length||bodies.some(body=>body.segments.length!==originalBody.length||body.segments.some((part,index)=>part!==originalBody[index])))fail();\n return {title,subtitle,html,gutenberg,enriched,normalizedBody};\n}\n\nreturn {normalizeLiteralText,extractLiteralVisibleText,extractLiteralPlainText,assertLiteralCanonicalText};\n})();\nconst literalProfile=(()=>{const {normalizeLiteralText,extractLiteralVisibleText,extractLiteralPlainText,assertLiteralCanonicalText}=literalText;\nconst literalDestinations=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];\nconst nonemptyLiteralString=value=>typeof value==='string'&&value.trim().length>0;\nconst literalEscape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;').replaceAll(\"'\",'&#39;');\n\n// This renderer consumes the policy returned by chooseMotorPolicy and a corpus\n// assembled from verified source buffers. It is not an authentication proof:\n// Publisher must still validate the exact request and text against the Guard's\n// stored records. No instruction inside sourceText changes policy or scope.\nfunction buildLiteralDelivery({baseMaster,policy,packageId,revision,sourceText,title,subtitle,subtitles,paragraphs,excerpt}={}){\n if(!baseMaster||typeof baseMaster!=='object'||Array.isArray(baseMaster)||!policy||policy.authorized!==true||policy.content_mode!=='LITERAL'||!['DRAFT','PUBLISH'].includes(policy.mode)||!literalDestinations.includes(policy.destination)||!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||revision<1||revision>4294967295)throw Error('LITERAL_DELIVERY_POLICY_INVALID');\n if(!nonemptyLiteralString(sourceText)||!nonemptyLiteralString(title)||!Array.isArray(paragraphs)||!paragraphs.length||paragraphs.some(x=>!nonemptyLiteralString(x)))throw Error('LITERAL_DELIVERY_TEXT_INVALID');\n if(subtitle!==undefined&&subtitles!==undefined)throw Error('LITERAL_DELIVERY_SUBTITLE_AMBIGUOUS');\n if(subtitles!==undefined&&(!Array.isArray(subtitles)||subtitles.some(x=>!nonemptyLiteralString(x))))throw Error('LITERAL_DELIVERY_SUBTITLE_INVALID');\n const finalSubtitle=subtitles!==undefined?subtitles.join('\\n'):subtitle??'';\n if(typeof finalSubtitle!=='string')throw Error('LITERAL_DELIVERY_SUBTITLE_INVALID');\n const html=paragraphs.map(p=>`<p>${literalEscape(p)}</p>`).join('\\n');\n const gutenberg=paragraphs.map(p=>`<!-- wp:paragraph -->\\n<p>${literalEscape(p)}</p>\\n<!-- /wp:paragraph -->`).join('\\n\\n');\n assertLiteralCanonicalText({sourceText,title,subtitle:finalSubtitle,html,gutenberg,enriched:gutenberg});\n const requestId='tg_'+createHash('sha256').update(`${packageId}:${revision}:${policy.destination}:draft-v1`,'utf8').digest('hex');\n const finalExcerpt=excerpt??paragraphs[0];\n if(!nonemptyLiteralString(finalExcerpt)||![...paragraphs,finalSubtitle].filter(nonemptyLiteralString).some(x=>normalizeLiteralText(x)===normalizeLiteralText(finalExcerpt)))throw Error('LITERAL_DELIVERY_EXCERPT_NOT_ORIGINAL');\n const master=JSON.parse(JSON.stringify(baseMaster));\n master.CONTROL_EDITORIAL={...(master.CONTROL_EDITORIAL??{}),MODO_CONTENIDO:'LITERAL',LITERAL:{PACKAGE_ID:packageId,REVISION:revision,REQUEST_ID:requestId}};\n master.SEO={...(master.SEO??{}),TITULO_SEO:title,SUBTITULO:finalSubtitle};\n if(!nonemptyLiteralString(master.SEO.METADESCRIPCION))master.SEO.METADESCRIPCION=finalExcerpt;\n master.PUBLICACION={...(master.PUBLICACION??{}),EXTRACTO:finalExcerpt};\n master.TEXTO_EDITORIAL={TITULO:title,SUBTITULO:finalSubtitle,...(subtitles!==undefined?{SUBTITULOS:[...subtitles]}:{}),PARRAFOS:[...paragraphs],ENTRADILLA:paragraphs[0],EN_BREVE:[],SECCIONES:[],CIERRE:null};\n master.FUENTES=[];\n master.HTML_FINAL=html;master.GUTENBERG_FINAL=gutenberg;master.GUTENBERG_ENRIQUECIDO_FINAL=gutenberg;\n const validation=validateLiteralMaster(master,{requestId});\n if(!validation.ok)throw Error('LITERAL_DELIVERY_MASTER_INVALID:'+validation.errors.join(','));\n return {master,requestId,mode:policy.mode,destination:policy.destination,content_mode:'LITERAL'};\n}\n\n// Pure profile validation, suitable for embedding into the existing n8n Code\n// preflight. EDITORIAL is dispatched back to its existing validators unchanged.\n// A successful local profile check does not authenticate LITERAL or grant a\n// write permit; the Guard derives mode, scope and original text independently.\nfunction validateLiteralMaster(master,{requestId}={}){\n const errors=[];\n const fail=error=>{errors.push(error)};\n if(!master||typeof master!=='object'||Array.isArray(master))return {ok:false,mode:null,errors:['MASTER_INVALID']};\n const equivalent=(a,b)=>{try{return normalizeLiteralText(a)===normalizeLiteralText(b)}catch{return false}};\n const control=master?.CONTROL_EDITORIAL;\n const declared=control?.MODO_CONTENIDO;\n if(declared===undefined||declared==='EDITORIAL')return {ok:true,mode:'EDITORIAL',errors};\n if(declared!=='LITERAL')return {ok:false,mode:null,errors:['CONTROL_EDITORIAL.MODO_CONTENIDO_INVALID']};\n if(!master||typeof master!=='object'||Array.isArray(master)||control?.ESTADO!=='LISTO')fail('CONTROL_EDITORIAL.ESTADO');\n const scope=control?.LITERAL;\n if(!scope||typeof scope!=='object'||Array.isArray(scope)||Object.keys(scope).sort().join(',')!=='PACKAGE_ID,REQUEST_ID,REVISION')fail('CONTROL_EDITORIAL.LITERAL');\n if(!/^tg_[a-f0-9]{40}$/.test(scope?.PACKAGE_ID??''))fail('CONTROL_EDITORIAL.LITERAL.PACKAGE_ID');\n if(!Number.isSafeInteger(scope?.REVISION)||scope.REVISION<1||scope.REVISION>4294967295)fail('CONTROL_EDITORIAL.LITERAL.REVISION');\n if(!/^tg_[a-f0-9]{64}$/.test(scope?.REQUEST_ID??'')||requestId!==undefined&&requestId!==scope?.REQUEST_ID)fail('CONTROL_EDITORIAL.LITERAL.REQUEST_ID');\n const seo=master?.SEO??{},text=master?.TEXTO_EDITORIAL??{};\n if(typeof seo.TITULO_SEO!=='string'||!seo.TITULO_SEO.trim())fail('SEO.TITULO_SEO');\n else if(new TextEncoder().encode(seo.TITULO_SEO).length>2048)fail('SEO.TITULO_SEO_TECHNICAL_MAX_2048_BYTES');\n if(typeof seo.SUBTITULO!=='string')fail('SEO.SUBTITULO');\n else if(seo.SUBTITULO.length>500)fail('SEO.SUBTITULO_TECHNICAL_MAX_500');\n if(typeof text.TITULO!=='string'||typeof seo.TITULO_SEO!=='string'||!equivalent(text.TITULO,seo.TITULO_SEO))fail('TEXTO_EDITORIAL.TITULO');\n if(typeof text.SUBTITULO!=='string'||typeof seo.SUBTITULO!=='string'||!equivalent(text.SUBTITULO,seo.SUBTITULO))fail('TEXTO_EDITORIAL.SUBTITULO');\n if(text.SUBTITULOS!==undefined&&(!Array.isArray(text.SUBTITULOS)||text.SUBTITULOS.some(x=>typeof x!=='string'||!x.trim())||!equivalent(text.SUBTITULOS.join('\\n'),seo.SUBTITULO??'')))fail('TEXTO_EDITORIAL.SUBTITULOS');\n const paragraphs=text.PARRAFOS;\n if(!Array.isArray(paragraphs)||!paragraphs.length||paragraphs.some(x=>typeof x!=='string'||!x.trim()))fail('TEXTO_EDITORIAL.PARRAFOS');\n for(const key of ['EN_BREVE','SECCIONES'])if(text[key]!==undefined&&(!Array.isArray(text[key])||text[key].length))fail('TEXTO_EDITORIAL.'+key);\n if(text.CIERRE!==undefined&&text.CIERRE!==null&&(typeof text.CIERRE!=='string'||text.CIERRE.trim()))fail('TEXTO_EDITORIAL.CIERRE');\n if(master?.FUENTES!==undefined&&(!Array.isArray(master.FUENTES)||master.FUENTES.length))fail('FUENTES');\n const excerpt=master?.PUBLICACION?.EXTRACTO;\n if(typeof excerpt!=='string'||!excerpt.trim())fail('PUBLICACION.EXTRACTO');\n else if(Array.isArray(paragraphs)&&!([...paragraphs,seo.SUBTITULO].filter(x=>typeof x==='string').some(x=>equivalent(x,excerpt))))fail('PUBLICACION.EXTRACTO_NOT_ORIGINAL');\n for(const key of ['HTML_FINAL','GUTENBERG_FINAL','GUTENBERG_ENRIQUECIDO_FINAL']){\n  const markup=master?.[key];\n  if(typeof markup!=='string'||!markup.trim()){fail(key);continue}\n  if(key!=='HTML_FINAL'&&!/<!--\\s*wp:paragraph(?:\\s|-->)/.test(markup)){fail(key+'_GUTENBERG_REQUIRED');continue}\n  try{if(Array.isArray(paragraphs)&&normalizeLiteralText(extractLiteralPlainText(markup))!==normalizeLiteralText(paragraphs.join('\\n\\n')))fail(key+'_TEXT_MISMATCH')}catch{fail(key+'_UNSAFE_OR_INVALID')}\n }\n if(errors.length)return {ok:false,mode:'LITERAL',errors};\n return {ok:true,mode:'LITERAL',errors,candidate:{requestId:scope.REQUEST_ID,declaredMode:'LITERAL',title:seo.TITULO_SEO.trim(),subtitle:seo.SUBTITULO.trim(),html:master.HTML_FINAL.trim(),gutenberg:master.GUTENBERG_FINAL.trim(),enriched:master.GUTENBERG_ENRIQUECIDO_FINAL.trim()}};\n}\n\nreturn {validateLiteralMaster};\n})();\nfunction destinationRegistry() {\n return {\n  OPURO:{cms:'https://cms.oxigenopuro.com.mx',publicOrigin:'https://oxigenopuro.com.mx',resultKey:'oxigenopuro',postIdKey:'post_id_opuro',heroMeta:'oxpuro_hero_media_id',editorialMeta:'oxpuro_editorial',hero:true},\n  OPOL:{cms:'https://cms.oxigenopolitico.com.mx',publicOrigin:'https://oxigenopolitico.com.mx',resultKey:'oxigenopolitico',postIdKey:'post_id_opol',hero:false},\n  LIBERAL:{cms:'https://cms.elliberal.mx',publicOrigin:'https://elliberal.mx',resultKey:'elliberal',postIdKey:'post_id_liberal',heroMeta:'liberalmx_hero_media_id',editorialMeta:'liberalmx_editorial',hero:true},\n };\n}\nfunction resolveDestinations(value) {\n if(Array.isArray(value)){if(!value.every(v=>typeof v==='string'))throw Error('Destino inválido');value=value.join(',');}\n if(typeof value!=='string'||!value.trim()||value.length>256)throw Error('Destino inválido');\n const registry=destinationRegistry(),selected=new Set();\n for(const item of value.split(',')){\n  const token=item.trim().toUpperCase();if(!token)throw Error('Destino vacío entre comas');\n  const expanded=token==='AMBOS'?['OPURO','OPOL']:token==='TODOS'?Object.keys(registry):[token];\n  for(const destination of expanded){if(!Object.hasOwn(registry,destination))throw Error('Destino desconocido: '+destination);selected.add(destination);}\n }\n return Object.keys(registry).filter(d=>selected.has(d));\n}\nfunction destinationLabel(destinations) {\n const all=Object.keys(destinationRegistry()),set=new Set(destinations),items=all.filter(d=>set.has(d));\n if(items.length!==set.size||!items.length)throw Error('Destino inválido');\n if(items.length===all.length)return 'TODOS';\n if(items.length===2&&items[0]==='OPURO'&&items[1]==='OPOL')return 'AMBOS';\n return items.join(',');\n}\nlet envelope = $json.body ?? $json;\n\nconst destinations=resolveDestinations(envelope.CREAR_EN);\nconst destinoRaw=destinationLabel(destinations);\nconst publicarRaw=envelope.PUBLICAR;\nconst publish=Array.isArray(publicarRaw)?publicarRaw.length>0:(publicarRaw===true||['sí','si','true','1','on'].includes(String(publicarRaw??'').trim().toLowerCase()));\nconst execution={destination:destinoRaw,destinations,create_opuro:destinations.includes('OPURO'),create_opol:destinations.includes('OPOL'),create_liberal:destinations.includes('LIBERAL'),publish};\n\n// v1.1.7: el MASTER llega pegado en \"json\" O como archivo \"json_file\".\nconst pastedJson = typeof envelope.json === 'string' ? envelope.json.trim() : '';\nconst binary = $input.item.binary ?? {};\nconst binaryKeys = Object.keys(binary);\nconst fileKey = binary.json_file ? 'json_file' : null;\nconst hasFile = Boolean(fileKey);\n\nif (pastedJson && hasFile) {\n  throw new Error('Entrega el OPMX MASTER de una sola forma: pega el JSON en el cuadro de texto O sube el archivo .json, no ambos.');\n}\nif (!pastedJson && !hasFile) {\n  throw new Error('Falta el OPMX MASTER. Pega el JSON completo en el cuadro de texto o sube un archivo .json.');\n}\n\nlet d;\nif (hasFile) {\n  const meta = binary[fileKey] ?? {};\n  const fileName = String(meta.fileName ?? '').trim();\n  const extension = String(meta.fileExtension ?? '').trim().toLowerCase();\n  if (fileName && !/\\.json$/i.test(fileName) && extension !== 'json') {\n    throw new Error(`El archivo subido debe ser .json. Archivo recibido: ${fileName || '(sin nombre)'}`);\n  }\n\n  let fileText;\n  try {\n    const buffer = await this.helpers.getBinaryDataBuffer(0, fileKey);\n    fileText = buffer.toString('utf8').replace(/^\\uFEFF/, '').trim();\n  } catch (error) {\n    throw new Error(`No fue posible leer el archivo JSON subido: ${error.message}`);\n  }\n  if (!fileText) throw new Error('El archivo JSON subido está vacío.');\n\n  try { d = JSON.parse(fileText); }\n  catch (error) { throw new Error(`El archivo subido no contiene JSON válido: ${error.message}`); }\n} else {\n  try { d = JSON.parse(pastedJson); }\n  catch (error) { throw new Error(`El campo \"json\" no contiene JSON válido: ${error.message}`); }\n}\n\nif (typeof d === 'string') {\n  try { d = JSON.parse(d.trim()); }\n  catch (error) { throw new Error(`El OPMX MASTER recibido no contiene JSON válido: ${error.message}`); }\n}\n\nfunction str(v) {\n  return v === null || v === undefined ? '' : String(v).trim();\n}\nfunction arr(v) {\n  if (Array.isArray(v)) return v.map(x => str(x)).filter(Boolean);\n  if (typeof v === 'string' && v.trim()) return v.split(',').map(x => x.trim()).filter(Boolean);\n  return [];\n}\nfunction imageSlugFromUrl(url, label) {\n  if (!url) return '';\n  try {\n    const cleanUrl = String(url).split('?')[0].split('#')[0];\n    const filename = decodeURIComponent(cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1));\n    return filename.replace(/\\.[a-zA-Z0-9]+$/, '').trim();\n  } catch (error) {\n    throw new Error(`No fue posible obtener el nombre de archivo desde ${label}: ${url}`);\n  }\n}\n\nconst SEO = d.SEO ?? d.seo ?? {};\nconst PUB = d.PUBLICACION ?? d.publication ?? {};\n// Contrato v1.2: AUTOR_ID está prohibido en el MASTER.\n// La identidad técnica del autor pertenece al Publisher.\nconst forbiddenAuthorFields = [\n  ['PUBLICACION.AUTOR_ID', PUB.AUTOR_ID],\n  ['PUBLICACION.author_id', PUB.author_id],\n  ['AUTOR_ID', d.AUTOR_ID],\n  ['author_id', d.author_id]\n].filter(([, value]) => value !== undefined && value !== null);\n\nif (forbiddenAuthorFields.length) {\n  throw new Error(\n    'CONTRATO_V1_2_AUTOR_ID_PROHIBIDO: el MASTER no debe contener AUTOR_ID. Campos detectados: ' +\n    forbiddenAuthorFields.map(([name]) => name).join(', ') + '.'\n  );\n}\n\nconst authorId = 3;\nconst authorSource = 'PUBLISHER_OPURO_REDACCION_OPMX';\n\nconst IMAGES = d.IMAGENES ?? d.images ?? {};\n\nconst HERO = IMAGES.HERO_OPURO ?? IMAGES.hero_opuro ?? {};\nconst FEATURED_OPURO = IMAGES.DESTACADA_OPURO ?? IMAGES.featured_opuro ?? {};\nconst FEATURED_OPOL = IMAGES.DESTACADA_OPOL ?? IMAGES.featured_opol ?? {};\n\nconst title = str(SEO.TITULO_SEO ?? d.TEXTO_EDITORIAL?.TITULO ?? d.article?.title);\nconst subtitle = str(SEO.SUBTITULO ?? d.TEXTO_EDITORIAL?.SUBTITULO ?? d.article?.subtitle);\nconst slug = str(SEO.SLUG ?? SEO.slug);\nconst excerpt = str(PUB.EXTRACTO ?? PUB.excerpt ?? SEO.EXTRACTO ?? SEO.excerpt ?? d.TEXTO_EDITORIAL?.ENTRADILLA);\nconst metaDescription = str(SEO.METADESCRIPCION ?? SEO.meta_description ?? excerpt);\nconst primaryKeyword = str(SEO.KEYWORD_PRINCIPAL ?? SEO.primary_keyword);\nconst secondaryKeywords = arr(SEO.KEYWORDS_SECUNDARIAS ?? SEO.secondary_keywords);\nconst keywordsAll = str(SEO.KEYWORDS_TODAS ?? SEO.keywords_todas ?? SEO.all_keywords_string);\nconst keywordsList = arr(SEO.KEYWORDS_TODAS_LISTA ?? SEO.keywords_todas_lista ?? SEO.KEYWORDS_TODAS ?? SEO.all_keywords);\nconst CATS=d.CATEGORIAS??d.categorias??{};\nconst OPUROCAT=CATS.OPURO??CATS.opuro??{};\nconst OPOLCAT=CATS.OPOL??CATS.opol??{};\nconst category=str(OPUROCAT.PRINCIPAL??OPUROCAT.principal??SEO.CATEGORIA??SEO.category);\nconst categoryOpol=str(OPOLCAT.PRINCIPAL??OPOLCAT.principal);\nconst categoryOpolSecondary=str(OPOLCAT.SECUNDARIA??OPOLCAT.secundaria)||null;\nconst tags = arr(SEO.ETIQUETAS ?? SEO.tags);\n\n// v1.2.12 — PREFLIGHT DE CONTRATO v1.2.\n// OPURO valida existencia después contra WordPress por coincidencia exacta de nombre.\n// OPOL conserva el snapshot v1.1 para catálogo y jerarquía padre-hija.\nconst CATEGORY_CATALOG = {\n  schema: \"OPMX_CATEGORY_CATALOG\",\n  schema_version: \"1.1\",\n  generated_at: \"2026-09-24T06:09:53.754Z\",\n  OPOL_ALLOWED: [\"CIENCIA\", \"CONGRESO\", \"DIPUTADOS\", \"SENADORES\", \"CULTURA\", \"DEPORTES\", \"ECONOMÍA\", \"EDUCACIÓN\", \"ESTADOS\", \"BAJA CALIFORNIA\", \"GOBIERNO\", \"INTERNACIONAL\", \"JUSTICIA\", \"MEDIO AMBIENTE\", \"MEGALÓPOLIS\", \"OPINIÓN\", \"POLÍTICA\", \"TECNOLOGÍA\", \"TURISMO\", \"Uncategorized\"],\n  OPOL_CATEGORIES: [{\"name\": \"CIENCIA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"CONGRESO\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"DIPUTADOS\", \"parent_name\": \"CONGRESO\", \"parent_id\": 4}, {\"name\": \"SENADORES\", \"parent_name\": \"CONGRESO\", \"parent_id\": 4}, {\"name\": \"CULTURA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"DEPORTES\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"ECONOMÍA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"EDUCACIÓN\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"ESTADOS\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"BAJA CALIFORNIA\", \"parent_name\": \"ESTADOS\", \"parent_id\": 10}, {\"name\": \"GOBIERNO\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"INTERNACIONAL\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"JUSTICIA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"MEDIO AMBIENTE\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"MEGALÓPOLIS\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"OPINIÓN\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"POLÍTICA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"TECNOLOGÍA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"TURISMO\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"Uncategorized\", \"parent_name\": null, \"parent_id\": 0}]\n};\n\nconst CONTROL = d.CONTROL_EDITORIAL ?? d.control_editorial ?? {};\nconst literalProfileResult=literalProfile.validateLiteralMaster(d,{requestId:envelope.request_id});\nif(!literalProfileResult.ok)throw Error('MASTER_LITERAL_PROFILE_INVALID:'+JSON.stringify(literalProfileResult.errors));\nconst contentMode=literalProfileResult.mode;\nconst controlEstado = str(CONTROL.ESTADO ?? CONTROL.estado).toUpperCase();\n\nif (controlEstado !== 'LISTO') {\n  throw new Error(\n    `CONTROL_EDITORIAL_NO_LISTO: el Publisher sólo admite paquetes con CONTROL_EDITORIAL.ESTADO = LISTO. Valor recibido: \"${controlEstado || '(vacío)'}\".`\n  );\n}\n\nif (execution.create_opuro && !category) {\n  throw new Error('CATEGORIA_OPURO_NO_AUTORIZADA: falta CATEGORIAS.OPURO.PRINCIPAL.');\n}\nif (execution.create_opol && !categoryOpol) {\n  throw new Error('CATEGORIA_OPOL_NO_AUTORIZADA: falta CATEGORIAS.OPOL.PRINCIPAL.');\n}\nif (execution.create_opol && !CATEGORY_CATALOG.OPOL_ALLOWED.includes(categoryOpol)) {\n  throw new Error(\n    `CATEGORIA_OPOL_NO_AUTORIZADA: \"${categoryOpol}\" no existe literalmente en sites.OPOL.allowed_names del catálogo OPMX v${CATEGORY_CATALOG.schema_version}. No se enviará nada a WordPress.`\n  );\n}\n\nif (execution.create_opol && categoryOpolSecondary !== null) {\n  const child = CATEGORY_CATALOG.OPOL_CATEGORIES.find(x => x.name === categoryOpolSecondary);\n  if (!child || Number(child.parent_id) === 0 || child.parent_name !== categoryOpol) {\n    throw new Error(\n      `CATEGORIA_OPOL_JERARQUIA_INVALIDA: \"${categoryOpolSecondary}\" no es hija literal de \"${categoryOpol}\" en el catálogo OPMX v${CATEGORY_CATALOG.schema_version}. No se enviará nada a WordPress.`\n    );\n  }\n}\n\nconst seoCategory = str(SEO.CATEGORIA ?? SEO.category);\nif (execution.create_opuro && seoCategory !== category) {\n  throw new Error(\n    `SEO_CATEGORIA_INCONSISTENTE: SEO.CATEGORIA debe ser idéntica a CATEGORIAS.OPURO.PRINCIPAL. Recibido SEO=\"${seoCategory}\" y OPURO=\"${category}\".`\n  );\n}\n\nconst htmlFinal = str(d.HTML_FINAL ?? d.html_final);\nconst gutenbergFinal = str(d.GUTENBERG_FINAL ?? d.GUTEMBERG_FINAL ?? d.gutenberg_final);\nconst gutenbergEnriquecidoFinal = str(d.GUTENBERG_ENRIQUECIDO_FINAL ?? d.gutenberg_enriquecido_final);\n\nconst heroOpuro = {\n  url: str(HERO.URL ?? HERO.url),\n  alt_text: str(HERO.ALT ?? HERO.alt_text),\n  title: str(HERO.TITULO_IMAGEN ?? HERO.title),\n  caption: str(HERO.LEYENDA ?? HERO.caption),\n  description: str(HERO.DESCRIPCION ?? HERO.description),\n  credit: HERO.CREDITO ?? HERO.credit ?? null,\n  class_name: str(HERO.CLASE_HERO ?? HERO.class_name)\n};\nheroOpuro.slug = '';\nif ((execution.create_opuro || execution.create_liberal) && ((heroOpuro.credit !== null && typeof heroOpuro.credit !== 'string') || subtitle.length > 500 || (typeof heroOpuro.credit === 'string' && heroOpuro.credit.length > 500))) throw new Error('Subtítulo o crédito Hero inválido para metadata editorial.');\n\nconst featuredOpuro = {\n  url: str(FEATURED_OPURO.URL ?? FEATURED_OPURO.url),\n  alt_text: str(FEATURED_OPURO.ALT ?? FEATURED_OPURO.alt_text)\n};\nfeaturedOpuro.slug = '';\n\nconst featuredOpol = {\n  url: str(FEATURED_OPOL.URL ?? FEATURED_OPOL.url),\n  alt_text: str(FEATURED_OPOL.ALT ?? FEATURED_OPOL.alt_text)\n};\nfeaturedOpol.slug = '';\n\n// v1.1.6 — validación condicionada por destino.\n// Los campos editoriales comunes siguen siendo obligatorios.\n// Los artefactos y medios específicos sólo se exigen si ese destino será creado.\n\nconst commonRequired = {\n  title,\n  slug,\n  excerpt,\n  primaryKeyword,\n  tags\n};\n\nif (execution.create_opuro) {\n  commonRequired.category = category;\n}\nif (execution.create_opol) {\n  commonRequired.categoryOpol = categoryOpol;\n}\n\nconst commonMissing = Object.entries(commonRequired)\n  .filter(([, v]) => Array.isArray(v) ? v.length === 0 : !v)\n  .map(([k]) => k);\n\nif (commonMissing.length) {\n  throw new Error(`OPMX MASTER incompleto para ${execution.destination}. Faltan campos comunes/seleccionados: ${commonMissing.join(', ')}`);\n}\n\nif (execution.create_opuro || execution.create_liberal) {\n  const requiredOpuro = {\n    gutenbergEnriquecidoFinal,\n    heroOpuroUrl: heroOpuro.url,\n    featuredOpuroUrl: featuredOpuro.url,\n    featuredOpuroAlt: featuredOpuro.alt_text\n  };\n\n  const missingOpuro = Object.entries(requiredOpuro)\n    .filter(([, v]) => !v)\n    .map(([k]) => k);\n\n  if (missingOpuro.length) {\n    throw new Error(`OPMX MASTER incompleto para Oxígeno Puro. Faltan: ${missingOpuro.join(', ')}`);\n  }\n\n  if (!/<!--\\s*wp:[a-z0-9/-]+/i.test(gutenbergEnriquecidoFinal)) {\n    throw new Error('GUTENBERG_ENRIQUECIDO_FINAL es obligatorio para OPURO y debe contener bloques Gutenberg serializados.');\n  }\n\n  const forbiddenEnriched = [\n    /opmx-editorial/i, /data-opmx/i, /<!--\\s*wp:html/i,\n    /<\\/?(?:article|header|footer)\\b/i, /<h1\\b/i, /\\{\\{[^}]+\\}\\}/\n  ];\n  if (forbiddenEnriched.some(rx => rx.test(gutenbergEnriquecidoFinal))) {\n    throw new Error('GUTENBERG_ENRIQUECIDO_FINAL contiene un marcador, wrapper o placeholder no permitido.');\n  }\n\n  const allowedBlocks = new Set(['paragraph', 'heading', 'list', 'list-item', 'quote', 'image']);\n  const blockNames = [...gutenbergEnriquecidoFinal.matchAll(/<!--\\s*\\/?wp:([a-z0-9/-]+)/gi)].map(match => match[1].replace(/^core\\//, ''));\n  if (!blockNames.length || blockNames.some(name => !allowedBlocks.has(name))) {\n    throw new Error(`GUTENBERG_ENRIQUECIDO_FINAL usa bloques no autorizados: ${[...new Set(blockNames.filter(name => !allowedBlocks.has(name)))].join(', ') || '(sin bloques)'}.`);\n  }\n  if (/<!--\\s*wp:image/i.test(gutenbergEnriquecidoFinal)) {\n    if (!/\\bwp-image-\\d+\\b/i.test(gutenbergEnriquecidoFinal) || !/\\balt=(['\"]).*?\\1/i.test(gutenbergEnriquecidoFinal)) {\n      throw new Error('Todo core/image enriquecido debe usar un adjunto nativo wp-image-{id} y conservar ALT literal.');\n    }\n  }\n\n  if (heroOpuro.url !== '{{OPMX:HERO_OPURO}}') {\n    throw new Error(`HERO_OPURO.URL debe ser exactamente {{OPMX:HERO_OPURO}}. Valor recibido: ${heroOpuro.url}`);\n  }\n  if (featuredOpuro.url !== '{{OPMX:DESTACADA_OPURO}}') {\n    throw new Error(`DESTACADA_OPURO.URL debe ser exactamente {{OPMX:DESTACADA_OPURO}}. Valor recibido: ${featuredOpuro.url}`);\n  }\n  if (!binary.hero_file) throw new Error('Falta el archivo HERO (hero_file) para OPURO.');\n  if (!binary.featured_file) throw new Error('Falta el archivo DESTACADA (featured_file) para OPURO.');\n}\n\nif (execution.create_opol) {\n  const requiredOpol = {\n    gutenbergFinal,\n    featuredOpolUrl: featuredOpol.url,\n    featuredOpolAlt: featuredOpol.alt_text\n  };\n\n  const missingOpol = Object.entries(requiredOpol)\n    .filter(([, v]) => !v)\n    .map(([k]) => k);\n\n  if (missingOpol.length) {\n    throw new Error(`OPMX MASTER incompleto para OXígeno Político. Faltan: ${missingOpol.join(', ')}`);\n  }\n\n  if (!/<!--\\s*wp:[a-z0-9/-]+/i.test(gutenbergFinal)) {\n    throw new Error('GUTENBERG_FINAL es obligatorio para OPOL y debe contener bloques Gutenberg reales.');\n  }\n\n  if (featuredOpol.url !== '{{OPMX:DESTACADA_OPOL}}') {\n    throw new Error(`DESTACADA_OPOL.URL debe ser exactamente {{OPMX:DESTACADA_OPOL}}. Valor recibido: ${featuredOpol.url}`);\n  }\n  if (!binary.featured_file) throw new Error('Falta el archivo DESTACADA (featured_file) para OPOL.');\n}\n\nconst liberalCategory=str(CATS.LIBERAL?.PRINCIPAL??CATS.LIBERAL?.principal??CATS.liberal?.PRINCIPAL??CATS.liberal?.principal);\nif(execution.create_liberal){\n if(!liberalCategory)throw Error('Falta CATEGORIAS.LIBERAL.PRINCIPAL');\n // Inline attachment IDs belong to one CMS. Never copy OPURO IDs into LIBERAL.\n if(/<!--\\s*wp:image\\b/i.test(gutenbergEnriquecidoFinal))throw Error('LIBERAL: los bloques core/image internos requieren adjuntos nativos propios; este transporte admite Hero y destacada. No se inició ninguna escritura.');\n}\n\nexecution.request_id=envelope.request_id;\nconst normalized={\n  json: {\n    execution,\n    canonical: {\n      content_mode:contentMode,\n      title,\n      subtitle,\n      slug,\n      excerpt,\n      meta_description: metaDescription,\n      primary_keyword: primaryKeyword,\n      secondary_keywords: secondaryKeywords,\n      keywords_all: keywordsAll || [primaryKeyword, ...secondaryKeywords].filter(Boolean).join(', '),\n      keywords_list: keywordsList.length ? keywordsList : [primaryKeyword, ...secondaryKeywords].filter(Boolean),\n      keywords: keywordsList.length ? keywordsList : [primaryKeyword, ...secondaryKeywords].filter(Boolean),\n      category,\n      categories:{opuro:{principal:category},opol:{principal:categoryOpol,secundaria:categoryOpolSecondary}},\n      tags,\n      html_final: htmlFinal,\n      gutenberg_final: gutenbergFinal,\n      gutenberg_enriquecido_final: gutenbergEnriquecidoFinal,\n      images: {\n        hero_opuro: heroOpuro,\n        featured_opuro: featuredOpuro,\n        featured_opol: featuredOpol\n      },\n      status: 'READY_FOR_SELECTED_DRAFTS',\n      ...(execution.create_liberal?{author_liberal:{id:3,source:'PUBLISHER_LIBERAL_REDACCION_ID_3'},gutenberg_liberal:gutenbergEnriquecidoFinal}:{}),\n      author: {\n        id: authorId,\n        source: authorSource\n      }\n    },\n    original: d\n  },\n  binary\n};\n\n\nif(execution.create_liberal){normalized.json.canonical.categories.liberal={principal:liberalCategory};normalized.json.canonical.images.hero_liberal={...heroOpuro};normalized.json.canonical.images.featured_liberal={...featuredOpuro};}\nreturn normalized;\n"
      },
      "position": [
        448,
        1104
      ],
      "typeVersion": 2
    },
    {
      "name": "OPURO — Resultado consulta duplicados",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "const v=$('Validar y normalizar OPMX MASTER').first().json; if(!v.execution?.create_opuro) throw new Error('Preflight temporal: sólo admite OPURO.'); const slug=v.canonical.slug; const rows=$input.all().map(x=>x.json).flatMap(x=>Array.isArray(x)?x:[x]); if(rows.some(x=>x?.slug===slug && Number(x.id)>0)) throw new Error('Posible duplicado OPURO: ya existe una nota con ese slug.'); return [{json:{status:'SIN_COINCIDENCIA_EXACTA',slug}}];"
      },
      "position": [
        896,
        1104
      ],
      "typeVersion": 2
    },
    {
      "name": "OPURO — Buscar categoría",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "={{ 'https://cms.oxigenopuro.com.mx' + '/wp-json/wp/v2/categories?search=' + encodeURIComponent($('Validar y normalizar OPMX MASTER').first().json.canonical.categories.opuro.principal) + '&per_page=100&orderby=id&order=asc' }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpBasicAuth",
        "options": {
          "redirect": {
            "redirect": {
              "followRedirects": false
            }
          }
        }
      },
      "position": [
        6272,
        560
      ],
      "typeVersion": 4.2
    },
    {
      "name": "OPURO — Resolver categoría",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "const c=$('Validar y normalizar OPMX MASTER').first().json.canonical;\nconst requested=String(c.categories?.opuro?.principal ?? c.category ?? '').trim();\nif(!requested) throw new Error('El JSON MASTER no entregó la categoría principal para OPURO.');\n\nconst norm=s=>String(s??'')\n  .normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')\n  .replace(/\\s+/g,' ')\n  .trim().toLocaleLowerCase('es-MX');\n\nconst rows=$input.all().map(i=>i.json).flatMap(x=>Array.isArray(x)?x:[x]);\nconst exact=rows.find(x=>norm(x.name)===norm(requested));\n\nif(!exact?.id){\n  const available=rows.map(x=>`${x.name??'(sin nombre)'} [slug ${x.slug??'?'} | ID ${x.id??'?'}]`).join(', ');\n  throw new Error(`La categoría \"${requested}\" no existe como coincidencia exacta por nombre en Oxígeno Puro. Categorías recibidas de WordPress: ${available||'ninguna'}.`);\n}\nreturn [{json:{\n  category_id:Number(exact.id),\n  category_name:exact.name,\n  category_slug:exact.slug??null,\n  requested_category:requested,\n  resolution:'EXACT_NORMALIZED_NAME_MATCH'\n}}];"
      },
      "position": [
        6496,
        560
      ],
      "typeVersion": 2
    },
    {
      "name": "OPURO — Crear borrador Gutenberg enriquecido",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "={{ 'https://cms.oxigenopuro.com.mx' + '/wp-json/wp/v2/posts' }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpBasicAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{\n{\n  title: $('Validar y normalizar OPMX MASTER').first().json.canonical.title,\n  slug: $('Validar y normalizar OPMX MASTER').first().json.canonical.slug,\n  excerpt: $('Validar y normalizar OPMX MASTER').first().json.canonical.excerpt,\n  status: 'draft',\n  content: $('Validar y normalizar OPMX MASTER').first().json.canonical.gutenberg_enriquecido_final,\n  featured_media: Number(\n    $('OPURO — Subir DESTACADA').first().json.id\n  ),\n  categories: [\n    Number(\n      $('OPURO — Resolver categoría').first().json.category_id\n    )\n  ],\n  tags: $('OPURO — Consolidar etiquetas v1.13').first().json.tag_ids,\n  author: Number(\n    $('Validar y normalizar OPMX MASTER').first().json.canonical.author.id\n  ),\n  meta: {\n    'site-post-title': 'disabled',\n    oxpuro_hero_media_id: Number($('OPURO — Subir HERO').first().json.id),\n    oxpuro_editorial: { subtitle: $('Validar y normalizar OPMX MASTER').first().json.canonical.subtitle, photo_credit: $('Validar y normalizar OPMX MASTER').first().json.canonical.images.hero_opuro.credit || '' }\n  }\n}\n}}",
        "options": {
          "redirect": {
            "redirect": {
              "followRedirects": false
            }
          }
        }
      },
      "position": [
        7392,
        192
      ],
      "typeVersion": 4.2
    },
    {
      "name": "OPURO — Readback",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "={{ 'https://cms.oxigenopuro.com.mx' + '/wp-json/wp/v2/posts/' + $('OPURO — Crear borrador Gutenberg enriquecido').first().json.id + '?context=edit' }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpBasicAuth",
        "options": {
          "redirect": {
            "redirect": {
              "followRedirects": false
            }
          }
        }
      },
      "position": [
        8288,
        0
      ],
      "typeVersion": 4.2
    },
    {
      "name": "OPURO — Validar antes de publicar",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForEachItem",
        "jsCode": "const literalText=(()=>{\nconst MAX_BYTES=2*1024*1024;\nconst badControls=/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f]/u;\nconst htmlTags=new Set(['p','div','br','strong','b','em','i','u','s','a','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','span']);\nconst blockTags=new Set(['p','div','br','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote']);\nconst blocks=new Set(['paragraph','heading','list','list-item','quote']);\nconst entities={amp:'&',AMP:'&',lt:'<',LT:'<',gt:'>',GT:'>',quot:'\"',QUOT:'\"',apos:\"'\",nbsp:'\\u00a0'};\nconst safeClasses=new Set(['wp-block-paragraph','wp-block-heading','wp-block-list','wp-block-quote','has-text-align-left','has-text-align-center','has-text-align-right','has-text-align-justify']);\nconst fail=()=>{throw Error('LITERAL_TEXT_UNCONFIRMED')};\nfunction text(value,max=MAX_BYTES){\n if(typeof value!=='string'||badControls.test(value)||new TextEncoder().encode(value).length>max)fail();\n return value;\n}\nfunction normalizeLiteralText(value){return text(value).normalize('NFC').replace(/\\s+/gu,' ').trim();}\nfunction decode(value){\n let out='',offset=0;\n while(offset<value.length){\n  const index=value.indexOf('&',offset);\n  if(index<0){out+=value.slice(offset);break}\n  out+=value.slice(offset,index);const end=value.indexOf(';',index+1);\n  if(end<0||end-index>32)fail();const name=value.slice(index+1,end);\n  if(Object.hasOwn(entities,name))out+=entities[name];\n  else if(/^#(?:[0-9]+|x[a-f0-9]+)$/i.test(name)){\n   const cp=/^#x/i.test(name)?parseInt(name.slice(2),16):Number(name.slice(1));\n   if(!Number.isSafeInteger(cp)||cp<1||cp>0x10ffff||cp>=0xd800&&cp<=0xdfff||cp%0x10000>=0xfffe)fail();\n   const char=String.fromCodePoint(cp);if(badControls.test(char))fail();out+=char;\n  }else fail();\n  offset=end+1;\n }\n return text(out);\n}\nfunction classes(value){\n const tokens=value.trim().split(/\\s+/u);\n if(!tokens.length||tokens.some(x=>!safeClasses.has(x)))fail();\n}\nfunction safeHttpUrl(value){\n // The n8n Code sandbox does not expose URL. Validate only this conservative\n // HTTP(S) vocabulary locally; never resolve a hostname or fetch the link.\n if(/[\\\\\\u0000-\\u0020\\u007f]/u.test(value))return false;\n const match=/^https?:\\/\\/([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?(?:[/?#][\\s\\S]*)?$/i.exec(value);\n if(!match||match[2]&&(Number(match[2])<1||Number(match[2])>65535))return false;\n const host=match[1].endsWith('.')?match[1].slice(0,-1):match[1];\n if(!host||host.length>253)return false;\n if(/^[0-9.]+$/.test(host)){\n  const octets=host.split('.');\n  return octets.length===4&&octets.every(x=>/^(?:0|[1-9][0-9]{0,2})$/.test(x)&&Number(x)<=255);\n }\n if(/^(?:0x[a-f0-9]+|[0-9]+)(?:\\.(?:0x[a-f0-9]+|[0-9]+))*$/i.test(host)||/^[0-9]+$/.test(host.split('.').at(-1)))return false;\n return host.split('.').every(x=>x.length<=63&&/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(x));\n}\nfunction blockAttributes(name,value){\n if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)fail();\n const allowed={paragraph:['align','className','anchor','dropCap'],heading:['align','textAlign','className','anchor','level'],list:['ordered','start','reversed','className'], 'list-item':['className'],quote:['className']}[name];\n for(const [key,v] of Object.entries(value)){\n  if(!allowed.includes(key))fail();\n  if(key==='className'){if(typeof v!=='string')fail();classes(v)}\n  else if(key==='anchor'){if(typeof v!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(v))fail()}\n  else if(['align','textAlign'].includes(key)){if(!['left','center','right','justify'].includes(v))fail()}\n  else if(key==='level'){if(!Number.isSafeInteger(v)||v<1||v>6)fail()}\n  else if(key==='start'){if(!Number.isSafeInteger(v)||v<1||v>1000000)fail()}\n  else if(typeof v!=='boolean')fail();\n }\n}\nfunction attributes(raw,tag,{plain=false}={}){\n let remaining=raw;const seen=new Set();\n while(remaining.trim()){\n  const match=/^\\s+([A-Za-z][A-Za-z0-9-]*)\\s*=\\s*(?:\"([^\"<>]*)\"|'([^'<>]*)')/.exec(remaining);\n  if(!match)fail();const name=match[1].toLowerCase(),value=decode(match[2]??match[3]);remaining=remaining.slice(match[0].length);\n  if(seen.has(name)||!['class','id','title','lang','dir','href','rel','target'].includes(name)||plain&&name==='title')fail();seen.add(name);\n  if(name==='class')classes(value);\n  else if(name==='id'){if(!/^[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(value))fail()}\n  else if(name==='lang'){if(!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value))fail()}\n  else if(name==='dir'){if(!['ltr','rtl','auto'].includes(value))fail()}\n  else if(name==='title'){text(value,8192)}\n  else if(tag!=='a')fail();\n  else if(name==='href'){\n   if(value.startsWith('#')){if(!/^#[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(value))fail()}\n   else if(!safeHttpUrl(value))fail();\n  }else if(name==='target'){if(!['_blank','_self'].includes(value))fail()}\n  else if(name==='rel'){if(value.trim().split(/\\s+/u).some(x=>!['noopener','noreferrer','nofollow','sponsored','ugc'].includes(x)))fail()}\n }\n}\n\n// This intentionally handles only the small, deterministic markup vocabulary\n// used by the literal renderer. It does not run a browser, fetch a link, decode\n// an HTML entity into markup, execute a source instruction or discard unknown\n// HTML. Anything outside this vocabulary requires explicit reconciliation.\nfunction readLiteralMarkup(markup,{plain=false}={}){\n text(markup);const stack=[],blockStack=[];let offset=0,visible='',tokens=0;\n while(offset<markup.length){\n  if(++tokens>100000)fail();const index=markup.indexOf('<',offset);\n  if(index<0){visible+=decode(markup.slice(offset));offset=markup.length;break}\n  visible+=decode(markup.slice(offset,index));\n  if(markup.startsWith('<!--',index)){\n   const end=markup.indexOf('-->',index+4);if(end<0)fail();const body=markup.slice(index+4,end).trim();\n   const m=/^(\\/?)wp:(?:core\\/)?([a-z-]+)(?:\\s+(\\{[\\s\\S]*\\}))?(\\s*\\/)?$/.exec(body);\n   if(!m||!blocks.has(m[2])||body.includes('<!--')||body.includes('--'))fail();\n   const closing=m[1]==='/',selfClosing=!!m[4];\n   if(closing){if(m[3]||selfClosing)fail();const last=blockStack.pop();if(!last||last.name!==m[2]||last.depth!==stack.length)fail()}\n   else {if(m[3]){let parsed;try{parsed=JSON.parse(m[3])}catch{fail()}blockAttributes(m[2],parsed)}if(!selfClosing){blockStack.push({name:m[2],depth:stack.length});if(blockStack.length>64)fail()}}\n   offset=end+3;continue;\n  }\n  let end=index+1,quote=null;\n  for(;end<markup.length;end++){\n   const char=markup[end];\n   if(quote){if(char===quote)quote=null;else if(char==='<')fail()}\n   else if(char==='\"'||char===\"'\")quote=char;\n   else if(char==='>')break;\n   else if(char==='<')fail();\n  }\n  if(end>=markup.length||quote)fail();\n  const token=markup.slice(index,end+1),m=/^<(\\/?)([A-Za-z][A-Za-z0-9]*)([\\s\\S]*?)>$/.exec(token);\n  if(!m)fail();const closing=m[1]==='/',name=m[2].toLowerCase();if(!htmlTags.has(name)||plain&&name==='a')fail();\n  let rest=m[3],selfClosing=false;\n  if(/\\/\\s*$/.test(rest)){selfClosing=true;rest=rest.replace(/\\/\\s*$/,'')}\n  if(closing){if(rest.trim()||selfClosing||name==='br'||stack.pop()!==name)fail()}\n  else {\n   if(selfClosing&&name!=='br'||name==='a'&&stack.includes('a'))fail();\n   if(blockTags.has(name)&&name!=='br'&&stack.some(x=>['p','strong','b','em','i','u','s','a','span','h1','h2','h3','h4','h5','h6'].includes(x)))fail();\n   if(name==='li'&&!['ul','ol'].includes(stack.at(-1))||['ul','ol'].includes(stack.at(-1))&&name!=='li')fail();\n   attributes(rest,name,{plain});if(name!=='br'){stack.push(name);if(stack.length>128)fail()}\n  }\n  // A private separator retains rendered block boundaries without confusing\n  // source line wrapping with a new paragraph. Input NULs are rejected above.\n  if(blockTags.has(name))visible+='\\u0000';\n  offset=end+1;\n }\n if(stack.length||blockStack.length)fail();\n const segments=visible.split('\\u0000').map(normalizeLiteralText).filter(Boolean);\n return {visibleText:normalizeLiteralText(visible.replaceAll('\\u0000','\\n')),segments};\n}\n\nfunction extractLiteralVisibleText(markup){return readLiteralMarkup(markup).visibleText;}\n\n// Plain Telegram source has no authenticated rich-text link or tooltip data.\n// Reject those additions even when their visible words happen to be unchanged.\nfunction extractLiteralPlainText(markup){return readLiteralMarkup(markup,{plain:true}).visibleText;}\n\nfunction assertLiteralCanonicalText({sourceText,title,subtitle,html,gutenberg,enriched}={}){\n text(title,2048);text(subtitle,8192);\n if(!normalizeLiteralText(title)||/<\\/?[a-z!]/i.test(title)||/<\\/?[a-z!]/i.test(subtitle))fail();\n for(const value of [html,gutenberg,enriched])if(!text(value).trim())fail();\n const bodies=[html,gutenberg,enriched].map(value=>readLiteralMarkup(value,{plain:true}));\n const normalizedBody=bodies[1].visibleText;\n if(!normalizedBody||bodies.some(body=>body.visibleText!==normalizedBody))fail();\n const block=/<!--\\s*wp:(?:core\\/)?(?:paragraph|heading|list|quote)(?:\\s|--)/;\n if(!block.test(gutenberg)||!block.test(enriched))fail();\n const source=text(sourceText).normalize('NFC').replace(/\\r\\n?/g,'\\n');\n const lines=source.split('\\n'),first=lines.findIndex(line=>normalizeLiteralText(line));\n if(first<0||normalizeLiteralText(title)!==normalizeLiteralText(lines[first]))fail();\n const remainder=lines.slice(first+1).join('\\n').trim();\n // Blank lines delimit original paragraphs. Legacy plain messages without\n // blank lines use complete lines; a subtitle may consume whole leading units\n // only, never part of the title or part of an original body paragraph.\n const units=remainder.split(/\\n[^\\S\\n]*\\n/u.test(source)?/\\n[^\\S\\n]*\\n+/u:/\\n/u).map(normalizeLiteralText).filter(Boolean);\n const normalizedSubtitle=normalizeLiteralText(subtitle);\n let consumed=0;\n if(normalizedSubtitle){\n  let prefix='';\n  for(let index=0;index<units.length;index++){\n   prefix+=(index?' ':'')+units[index];\n   if(prefix===normalizedSubtitle){consumed=index+1;break}\n   if(prefix.length>=normalizedSubtitle.length)break;\n  }\n  if(!consumed)fail();\n }\n const originalBody=units.slice(consumed);\n if(!originalBody.length||bodies.some(body=>body.segments.length!==originalBody.length||body.segments.some((part,index)=>part!==originalBody[index])))fail();\n return {title,subtitle,html,gutenberg,enriched,normalizedBody};\n}\n\nreturn {normalizeLiteralText,extractLiteralVisibleText,extractLiteralPlainText,assertLiteralCanonicalText};\n})();\nfunction literalBodyMatches(actual,expected,mode){if(typeof actual!=='string'||typeof expected!=='string')return false;if(mode!=='LITERAL')return actual===expected;try{return literalText.normalizeLiteralText(literalText.extractLiteralPlainText(actual))===literalText.normalizeLiteralText(literalText.extractLiteralPlainText(expected))}catch{return false}}\nconst p=$json;\nconst c=$('Validar y normalizar OPMX MASTER').first().json.canonical;\nconst expectedTags=$('OPURO — Consolidar etiquetas v1.13').first().json.tag_ids.map(Number).sort((a,b)=>a-b);\nconst actualTags=Array.isArray(p.tags)?p.tags.map(Number).sort((a,b)=>a-b):null;\nif(String(p.slug??'')!==c.slug) throw new Error('OPURO slug no coincide.');\nif(literalText.normalizeLiteralText(String(p?.meta?.oxpuro_editorial?.subtitle??''))!==literalText.normalizeLiteralText(String(c.subtitle??''))) throw new Error('OPURO subtítulo no coincide.');\nif(String(p?.meta?.oxpuro_editorial?.photo_credit??'')!==String(c.images.hero_opuro.credit??'')) throw new Error('OPURO crédito de Hero no coincide.');\nif(Number(p.author)!==Number(c.author.id)) throw new Error('OPURO autor no coincide.');\nif(String(p?.title?.raw??'')!==c.title) throw new Error('OPURO título no coincide.');\nif(!actualTags || JSON.stringify(actualTags)!==JSON.stringify(expectedTags)) throw new Error('OPURO etiquetas no coinciden.');\nfor(const [key,value] of [['rank_math_title',c.title],['rank_math_description',c.meta_description],['rank_math_focus_keyword',c.keywords_all]]) {\n  if(String(p?.meta?.[key]??'')!==String(value??'')) throw new Error('OPURO SEO no coincide: '+key);\n}\nif(typeof p?.content?.raw!=='string' || !literalBodyMatches(p.content.raw,c.gutenberg_enriquecido_final,c.content_mode)) throw new Error('OPURO Gutenberg no coincide en readback.');\nconst expectedFeatured=Number($('OPURO — Subir DESTACADA').first().json.id);\nconst expectedCat=Number($('OPURO — Resolver categoría').first().json.category_id);\nconst expectedHero=Number($('OPURO — Subir HERO').first().json.id);\nif(!p?.id) throw new Error('OPURO readback no devolvió ID.');\nif(String(p.status)!=='draft') throw new Error(`OPURO no está en draft antes de publicar. Estado: ${p.status}`);\nif(!Number.isSafeInteger(expectedHero) || expectedHero < 1 || Number(p?.meta?.oxpuro_hero_media_id)!==expectedHero) throw new Error('OPURO HERO no coincide con el adjunto cargado.');\nif(Number(p.featured_media)!==expectedFeatured) throw new Error(`OPURO featured_media no coincide. Esperado ${expectedFeatured}, recibido ${p.featured_media}.`);\nif(!Array.isArray(p.categories)||!p.categories.map(Number).includes(expectedCat)) throw new Error('OPURO no confirmó la categoría esperada.');\nconst content=String(p?.content?.raw ?? p?.content?.rendered ?? '');\nif(!content || content.includes('{{OPMX:HERO_OPURO}}')) throw new Error('OPURO conserva placeholder HERO o contenido vacío.');\nreturn {json:{validated:true,post_id:Number(p.id)}};"
      },
      "position": [
        8512,
        0
      ],
      "typeVersion": 2
    },
    {
      "name": "¿Preflight OPOL?",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "leftValue": "={{ $('Validar y normalizar OPMX MASTER').first().json.execution.create_opol }}",
              "rightValue": "",
              "operator": {
                "type": "boolean",
                "operation": "true",
                "singleValue": true
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "position": [
        0,
        0
      ],
      "typeVersion": 2.2
    }
  ],
  "connections": {
    "Entrada automática protegida": {
      "main": [
        [
          {
            "node": "Preparar MASTER y binarios",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar MASTER y binarios": {
      "main": [
        [
          {
            "node": "Validar y normalizar OPMX MASTER",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Consultar slug existente": {
      "main": [
        [
          {
            "node": "OPURO — Resultado consulta duplicados",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPMX — Generar huella de prueba": {
      "main": [
        [
          {
            "node": "OPMX — Reservar preflight",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPMX — Reservar preflight": {
      "main": [
        [
          {
            "node": "OPMX — Verificar reserva",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Subir HERO": {
      "main": [
        [
          {
            "node": "GUARD — Reportar Hero",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPMX — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Metadata HERO": {
      "main": [
        [
          {
            "node": "OPURO — Leer Hero",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPMX — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Subir DESTACADA": {
      "main": [
        [
          {
            "node": "GUARD — Reportar destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPMX — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Metadata DESTACADA": {
      "main": [
        [
          {
            "node": "OPURO — Leer destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPMX — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Buscar categoría": {
      "main": [
        [
          {
            "node": "OPURO — Resolver categoría",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Resolver categoría": {
      "main": [
        [
          {
            "node": "OPURO — Preparar etiquetas v1.13",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Preparar etiquetas v1.13": {
      "main": [
        [
          {
            "node": "OPURO — Etiquetas secuenciales v1.2.4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Etiquetas secuenciales v1.2.4": {
      "main": [
        [
          {
            "node": "OPURO — Consolidar etiquetas v1.13",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPURO — Asegurar etiqueta v1.13",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Asegurar etiqueta v1.13": {
      "main": [
        [
          {
            "node": "OPURO — Resolver etiqueta v1.13",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Resolver etiqueta v1.13": {
      "main": [
        [
          {
            "node": "OPURO — ¿Retry 503 etiqueta? v1.2.4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — ¿Retry 503 etiqueta? v1.2.4": {
      "main": [
        [
          {
            "node": "OPURO — Esperar retry etiqueta v1.2.4",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPURO — Etiquetas secuenciales v1.2.4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Esperar retry etiqueta v1.2.4": {
      "main": [
        [
          {
            "node": "OPURO — Retry etiqueta v1.2.4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Retry etiqueta v1.2.4": {
      "main": [
        [
          {
            "node": "OPURO — Asegurar etiqueta v1.13",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Consolidar etiquetas v1.13": {
      "main": [
        [
          {
            "node": "OPURO — Crear borrador Gutenberg enriquecido",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Crear borrador Gutenberg enriquecido": {
      "main": [
        [
          {
            "node": "GUARD — Reportar post",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPMX — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Escribir Rank Math": {
      "main": [
        [
          {
            "node": "OPURO — Readback",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPMX — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Readback": {
      "main": [
        [
          {
            "node": "OPURO — Validar antes de publicar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Validar antes de publicar": {
      "main": [
        [
          {
            "node": "Resultado OPURO — BORRADOR",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Iniciar destino": {
      "main": [
        [
          {
            "node": "GUARD — Verificar destino",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Verificar destino": {
      "main": [
        [
          {
            "node": "GUARD — Iniciar Hero",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Iniciar Hero": {
      "main": [
        [
          {
            "node": "GUARD — Verificar inicio Hero",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Verificar inicio Hero": {
      "main": [
        [
          {
            "node": "OPMX — Recuperar binario Hero",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPMX — Recuperar binario Hero": {
      "main": [
        [
          {
            "node": "OPURO — Subir HERO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Reportar Hero": {
      "main": [
        [
          {
            "node": "GUARD — Verificar reporte Hero",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPMX — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Verificar reporte Hero": {
      "main": [
        [
          {
            "node": "OPURO — Metadata HERO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Leer Hero": {
      "main": [
        [
          {
            "node": "OPURO — Verificar Hero",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Verificar Hero": {
      "main": [
        [
          {
            "node": "GUARD — Iniciar destacada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Iniciar destacada": {
      "main": [
        [
          {
            "node": "GUARD — Verificar inicio destacada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Verificar inicio destacada": {
      "main": [
        [
          {
            "node": "OPMX — Recuperar binario destacada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPMX — Recuperar binario destacada": {
      "main": [
        [
          {
            "node": "OPURO — Subir DESTACADA",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Reportar destacada": {
      "main": [
        [
          {
            "node": "GUARD — Verificar reporte destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPMX — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Verificar reporte destacada": {
      "main": [
        [
          {
            "node": "OPURO — Metadata DESTACADA",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Leer destacada": {
      "main": [
        [
          {
            "node": "OPURO — Verificar destacada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Verificar destacada": {
      "main": [
        [
          {
            "node": "OPURO — Buscar categoría",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Reportar post": {
      "main": [
        [
          {
            "node": "GUARD — Verificar reporte post",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPMX — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD — Verificar reporte post": {
      "main": [
        [
          {
            "node": "OPURO — Escribir Rank Math",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPMX — Preparar conciliación": {
      "main": [
        [
          {
            "node": "OPMX — Consultar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPURO — Resultado consulta duplicados": {
      "main": [
        [
          {
            "node": "¿Preflight OPOL?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPMX — Verificar reserva": {
      "main": [
        [
          {
            "node": "¿Procesar OPURO?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado OPURO — BORRADOR": {
      "main": [
        [
          {
            "node": "OPMX — Conservar resultado OPURO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Preflight OPURO?": {
      "main": [
        [
          {
            "node": "OPURO — Consultar slug existente",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Preflight OPURO omitido",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preflight OPURO omitido": {
      "main": [
        [
          {
            "node": "¿Preflight OPOL?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Preflight OPOL?": {
      "main": [
        [
          {
            "node": "OPOL — Consultar slug existente",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Preflight OPOL omitido",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Consultar slug existente": {
      "main": [
        [
          {
            "node": "OPOL — Resultado consulta duplicados",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Procesar OPURO?": {
      "main": [
        [
          {
            "node": "GUARD — Iniciar destino",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Resultado OPURO — SKIPPED",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado OPURO — SKIPPED": {
      "main": [
        [
          {
            "node": "OPMX — Conservar resultado OPURO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPMX — Conservar resultado OPURO": {
      "main": [
        [
          {
            "node": "¿Procesar OPOL?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Procesar OPOL?": {
      "main": [
        [
          {
            "node": "GUARD OPOL — Iniciar destino",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Resultado OPOL — SKIPPED",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD OPOL — Iniciar destino": {
      "main": [
        [
          {
            "node": "GUARD OPOL — Verificar destino",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD OPOL — Verificar destino": {
      "main": [
        [
          {
            "node": "GUARD OPOL — Iniciar destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD OPOL — Iniciar destacada": {
      "main": [
        [
          {
            "node": "GUARD OPOL — Verificar inicio destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD OPOL — Verificar inicio destacada": {
      "main": [
        [
          {
            "node": "OPOL — Recuperar binario destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Recuperar binario destacada": {
      "main": [
        [
          {
            "node": "OPOL — Subir DESTACADA",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Subir DESTACADA": {
      "main": [
        [
          {
            "node": "GUARD OPOL — Reportar destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD OPOL — Reportar destacada": {
      "main": [
        [
          {
            "node": "GUARD OPOL — Verificar reporte destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD OPOL — Verificar reporte destacada": {
      "main": [
        [
          {
            "node": "OPOL — Metadata DESTACADA",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Metadata DESTACADA": {
      "main": [
        [
          {
            "node": "OPOL — Leer destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Leer destacada": {
      "main": [
        [
          {
            "node": "OPOL — Verificar destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Verificar destacada": {
      "main": [
        [
          {
            "node": "OPOL — Buscar categoría",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Buscar categoría": {
      "main": [
        [
          {
            "node": "OPOL — Resolver categoría",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Resolver categoría": {
      "main": [
        [
          {
            "node": "OPOL — Preparar etiquetas v1.0",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Preparar etiquetas v1.0": {
      "main": [
        [
          {
            "node": "OPOL — Etiquetas secuenciales v1.2.4",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Etiquetas secuenciales v1.2.4": {
      "main": [
        [
          {
            "node": "OPOL — Consolidar etiquetas v1.0",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Asegurar etiqueta v1.0",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Asegurar etiqueta v1.0": {
      "main": [
        [
          {
            "node": "OPOL — Resolver etiqueta v1.0",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Resolver etiqueta v1.0": {
      "main": [
        [
          {
            "node": "OPOL — ¿Retry 503 etiqueta? v1.2.4",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — ¿Retry 503 etiqueta? v1.2.4": {
      "main": [
        [
          {
            "node": "OPOL — Esperar retry etiqueta v1.2.4",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Etiquetas secuenciales v1.2.4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Esperar retry etiqueta v1.2.4": {
      "main": [
        [
          {
            "node": "OPOL — Retry etiqueta v1.2.4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Retry etiqueta v1.2.4": {
      "main": [
        [
          {
            "node": "OPOL — Asegurar etiqueta v1.0",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Consolidar etiquetas v1.0": {
      "main": [
        [
          {
            "node": "OPOL — Crear borrador mínimo",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Crear borrador mínimo": {
      "main": [
        [
          {
            "node": "GUARD OPOL — Reportar post",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD OPOL — Reportar post": {
      "main": [
        [
          {
            "node": "GUARD OPOL — Verificar reporte post",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD OPOL — Verificar reporte post": {
      "main": [
        [
          {
            "node": "OPOL — Completar borrador Gutenberg",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Completar borrador Gutenberg": {
      "main": [
        [
          {
            "node": "OPOL — Escribir metadata editorial",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Escribir metadata editorial": {
      "main": [
        [
          {
            "node": "OPOL — Escribir Rank Math",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Escribir Rank Math": {
      "main": [
        [
          {
            "node": "OPOL — Readback",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Readback": {
      "main": [
        [
          {
            "node": "OPOL — Validar antes de publicar",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Validar antes de publicar": {
      "main": [
        [
          {
            "node": "Resultado OPOL — BORRADOR",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "OPOL — Requiere conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Entrada desde MCP archivos": {
      "main": [
        [
          {
            "node": "Preparar MASTER y binarios",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Iniciar Hero": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Verificar inicio Hero",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Iniciar destacada": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Verificar inicio destacada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Iniciar destino": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Verificar destino",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Reportar Hero": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Verificar reporte Hero",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "LIBERAL — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Reportar destacada": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Verificar reporte destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "LIBERAL — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Reportar post": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Verificar reporte post",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "LIBERAL — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Verificar destino": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Iniciar Hero",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Verificar inicio Hero": {
      "main": [
        [
          {
            "node": "LIBERAL — Recuperar binario Hero",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Verificar inicio destacada": {
      "main": [
        [
          {
            "node": "LIBERAL — Recuperar binario destacada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Verificar reporte Hero": {
      "main": [
        [
          {
            "node": "LIBERAL — Metadata HERO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Verificar reporte destacada": {
      "main": [
        [
          {
            "node": "LIBERAL — Metadata DESTACADA",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GUARD LIBERAL — Verificar reporte post": {
      "main": [
        [
          {
            "node": "LIBERAL — Escribir Rank Math",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Asegurar etiqueta v1.13": {
      "main": [
        [
          {
            "node": "LIBERAL — Resolver etiqueta v1.13",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Buscar categoría": {
      "main": [
        [
          {
            "node": "LIBERAL — Resolver categoría",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Consolidar etiquetas v1.13": {
      "main": [
        [
          {
            "node": "LIBERAL — Crear borrador Gutenberg enriquecido",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Consultar slug existente": {
      "main": [
        [
          {
            "node": "LIBERAL — Resultado consulta duplicados",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Crear borrador Gutenberg enriquecido": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Reportar post",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "LIBERAL — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Escribir Rank Math": {
      "main": [
        [
          {
            "node": "LIBERAL — Readback",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "LIBERAL — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Esperar retry etiqueta v1.2.4": {
      "main": [
        [
          {
            "node": "LIBERAL — Retry etiqueta v1.2.4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Etiquetas secuenciales v1.2.4": {
      "main": [
        [
          {
            "node": "LIBERAL — Consolidar etiquetas v1.13",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "LIBERAL — Asegurar etiqueta v1.13",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Leer Hero": {
      "main": [
        [
          {
            "node": "LIBERAL — Verificar Hero",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Leer destacada": {
      "main": [
        [
          {
            "node": "LIBERAL — Verificar destacada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Metadata DESTACADA": {
      "main": [
        [
          {
            "node": "LIBERAL — Leer destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "LIBERAL — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Metadata HERO": {
      "main": [
        [
          {
            "node": "LIBERAL — Leer Hero",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "LIBERAL — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Preflight categoría": {
      "main": [
        [
          {
            "node": "LIBERAL — Verificar categoría preflight",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Preparar conciliación": {
      "main": [
        [
          {
            "node": "Resultado consolidado OPMX",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Preparar etiquetas v1.13": {
      "main": [
        [
          {
            "node": "LIBERAL — Etiquetas secuenciales v1.2.4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Readback": {
      "main": [
        [
          {
            "node": "LIBERAL — Validar antes de publicar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Recuperar binario Hero": {
      "main": [
        [
          {
            "node": "LIBERAL — Subir HERO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Recuperar binario destacada": {
      "main": [
        [
          {
            "node": "LIBERAL — Subir DESTACADA",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Resolver categoría": {
      "main": [
        [
          {
            "node": "LIBERAL — Preparar etiquetas v1.13",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Resolver etiqueta v1.13": {
      "main": [
        [
          {
            "node": "LIBERAL — ¿Retry 503 etiqueta? v1.2.4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Resultado consulta duplicados": {
      "main": [
        [
          {
            "node": "LIBERAL — Preflight categoría",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Retry etiqueta v1.2.4": {
      "main": [
        [
          {
            "node": "LIBERAL — Asegurar etiqueta v1.13",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Subir DESTACADA": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Reportar destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "LIBERAL — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Subir HERO": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Reportar Hero",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "LIBERAL — Preparar conciliación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Validar antes de publicar": {
      "main": [
        [
          {
            "node": "Resultado LIBERAL — BORRADOR",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Verificar Hero": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Iniciar destacada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Verificar categoría preflight": {
      "main": [
        [
          {
            "node": "OPMX — Generar huella de prueba",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — Verificar destacada": {
      "main": [
        [
          {
            "node": "LIBERAL — Buscar categoría",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "LIBERAL — ¿Retry 503 etiqueta? v1.2.4": {
      "main": [
        [
          {
            "node": "LIBERAL — Esperar retry etiqueta v1.2.4",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "LIBERAL — Etiquetas secuenciales v1.2.4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPMX — Conservar resultado OPOL": {
      "main": [
        [
          {
            "node": "¿Procesar LIBERAL?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Requiere conciliación": {
      "main": [
        [
          {
            "node": "OPMX — Conservar resultado OPOL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPOL — Resultado consulta duplicados": {
      "main": [
        [
          {
            "node": "¿Preflight LIBERAL?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preflight LIBERAL omitido": {
      "main": [
        [
          {
            "node": "OPMX — Generar huella de prueba",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preflight OPOL omitido": {
      "main": [
        [
          {
            "node": "¿Preflight LIBERAL?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado LIBERAL — BORRADOR": {
      "main": [
        [
          {
            "node": "Resultado consolidado OPMX",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado LIBERAL — SKIPPED": {
      "main": [
        [
          {
            "node": "Resultado consolidado OPMX",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado OPOL — BORRADOR": {
      "main": [
        [
          {
            "node": "OPMX — Conservar resultado OPOL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado OPOL — SKIPPED": {
      "main": [
        [
          {
            "node": "OPMX — Conservar resultado OPOL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Preflight LIBERAL?": {
      "main": [
        [
          {
            "node": "LIBERAL — Consultar slug existente",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Preflight LIBERAL omitido",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Procesar LIBERAL?": {
      "main": [
        [
          {
            "node": "GUARD LIBERAL — Iniciar destino",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Resultado LIBERAL — SKIPPED",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OPMX — Consultar conciliación": {
      "main": [
        [
          {
            "node": "OPMX — Conservar resultado OPURO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado consolidado OPMX": {
      "main": [
        [
          {
            "node": "Acuse DRAFT — Preparar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Acuse DRAFT — Preparar": {
      "main": [
        [
          {
            "node": "Acuse DRAFT — ¿Registrar?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Acuse DRAFT — ¿Registrar?": {
      "main": [
        [
          {
            "node": "Acuse DRAFT — Guard",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Acuse DRAFT — Conservar resultado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Acuse DRAFT — Guard": {
      "main": [
        [
          {
            "node": "Acuse DRAFT — Conservar resultado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Validar y normalizar OPMX MASTER": {
      "main": [
        [
          {
            "node": "Literal — Preparar control de escritura",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Literal — Preparar control de escritura": {
      "main": [
        [
          {
            "node": "Literal — ¿Comprobar alcance Telegram?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Literal — ¿Comprobar alcance Telegram?": {
      "main": [
        [
          {
            "node": "Literal — Comprobar texto Guard",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Literal — Conservar paquete verificado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Literal — Comprobar texto Guard": {
      "main": [
        [
          {
            "node": "Literal — Conservar paquete verificado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Literal — Conservar paquete verificado": {
      "main": [
        [
          {
            "node": "¿Preflight OPURO?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
};
