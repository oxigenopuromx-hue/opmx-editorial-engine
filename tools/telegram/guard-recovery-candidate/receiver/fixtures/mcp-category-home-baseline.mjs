export default {
  "id": "bnzVMNkZuGO1GQCZ",
  "versionId": "1b78dc88-cb9b-456f-b711-c3328031e61d",
  "nodes": [
    {
      "name": "Resultado validación archivos",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "// MASTER_SEMANTIC_PREFLIGHT_V1\nfunction semanticPreflightResponse(request,result) {\n const semantic=result?.semantic_preflight;\n const allowedFields=['request_id','MASTER','PUBLICAR','destino','SEO.SUBTITULO','IMAGENES.HERO_OPURO.CREDITO','CATEGORIAS.LIBERAL.PRINCIPAL','hero_file','featured_file','PUBLICACION.AUTOR_ID','CONTROL_EDITORIAL.LITERAL','CONTROL_EDITORIAL.ESTADO','CATEGORIAS.OPURO.PRINCIPAL','CATEGORIAS.OPOL.PRINCIPAL','CATEGORIAS.OPOL.SECUNDARIA','SEO.CATEGORIA','GUTENBERG_ENRIQUECIDO_FINAL','IMAGENES.HERO_OPURO.URL','IMAGENES.DESTACADA_OPURO.URL','GUTENBERG_FINAL','IMAGENES.DESTACADA_OPOL.URL','SEO.TITULO_SEO','SEO.SLUG','PUBLICACION.EXTRACTO','SEO.KEYWORD_PRINCIPAL','SEO.ETIQUETAS','IMAGENES.DESTACADA_OPURO.ALT','IMAGENES.DESTACADA_OPOL.ALT'];\n const allowedCodes=['REQUEST_ID','MASTER_OBJECT','DRAFT_TRANSPORT','DESTINATION','HERO_METADATA','LIBERAL_CATEGORY','HERO_FILE','FEATURED_FILE','AUTHOR_ID','LITERAL_PROFILE','EDITORIAL_STATE','OPURO_CATEGORY','OPOL_CATEGORY','OPOL_HIERARCHY','SEO_CATEGORY','ENRICHED_BLOCKS','ENRICHED_CONTENT','ENRICHED_IMAGE','HERO_PLACEHOLDER','FEATURED_PLACEHOLDER','OPOL_BLOCKS','OPOL_PLACEHOLDER','LIBERAL_INLINE_IMAGE','IMAGE_FILE','REQUIRED_FIELDS','SLUG_FORMAT'];\n const valid=semantic?.ok===false&&semantic.status==='VALIDATION_FAILED'&&semantic.writesStarted===false&&semantic.retryPermitted===false&&allowedCodes.includes(semantic.code)&&Array.isArray(semantic.fields)&&semantic.fields.length>0&&semantic.fields.every(x=>allowedFields.includes(x));\n const response=valid?{status:'VALIDATION_FAILED',code:semantic.code,field:semantic.fields[0],fields:semantic.fields,message:'El MASTER no cumple las validaciones estáticas del destino. Corrige los campos indicados.',writesStarted:false,retryPermitted:false}:{status:'FILES_REJECTED',code:'STATIC_PREFLIGHT_UNCONFIRMED',message:'La validación previa no pudo confirmarse; no se inició el envío a Publisher.',writesStarted:false,retryPermitted:false};\n if(typeof request?.request_id==='string')response.request_id=request.request_id;\n return {httpStatus:200,response:{jsonrpc:'2.0',id:request?.id??null,result:{content:[{type:'text',text:JSON.stringify(response)}],structuredContent:response,isError:true}}};\n}\nif($input.first().json.semantic_preflight?.ok!==true)return [{json:semanticPreflightResponse($('Protocolo MCP archivos').first().json.request,$input.first().json)}];\nfunction fileMcpResult(request,result,isError=false) {\n return {httpStatus:200,response:{jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:isError?(result.writesStarted===false?'Archivos rechazados antes de enviar al Publisher. Revisa adjuntos, vigencia y formato.':'Solicitud no confirmada. No reenviar automáticamente; revisar la ejecución y los borradores.'):JSON.stringify(result)}],structuredContent:result,isError}}};\n}\nconst r=$('Protocolo MCP archivos').first().json.request;const p=$input.first().json;const literal_profile=$(\"Literal archivos — Conservar validación\").first().json.literal_profile;return [{json:fileMcpResult(r,{status:'FILES_VALIDATED',bytesVerified:true,destino:r.destino,slug:p.payload.master.SEO.SLUG,estado:p.payload.master.CONTROL_EDITORIAL?.ESTADO,bytes:p.stats,validation_scope:p.semantic_preflight,...(literal_profile?{literal_profile}:{})})}];"
      },
      "position": [
        960,
        400
      ],
      "typeVersion": 2
    },
    {
      "name": "Preflight conjunto publicación",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "function destinationRegistry() {\n return {\n  OPURO:{cms:'https://cms.oxigenopuro.com.mx',publicOrigin:'https://oxigenopuro.com.mx',resultKey:'oxigenopuro',postIdKey:'post_id_opuro',heroMeta:'oxpuro_hero_media_id',editorialMeta:'oxpuro_editorial',hero:true},\n  OPOL:{cms:'https://cms.oxigenopolitico.com.mx',publicOrigin:'https://oxigenopolitico.com.mx',resultKey:'oxigenopolitico',postIdKey:'post_id_opol',hero:false},\n  LIBERAL:{cms:'https://cms.elliberal.mx',publicOrigin:'https://elliberal.mx',resultKey:'elliberal',postIdKey:'post_id_liberal',heroMeta:'liberalmx_hero_media_id',editorialMeta:'liberalmx_editorial',hero:true},\n };\n}\nfunction resolveDestinations(value) {\n if(Array.isArray(value)){if(!value.every(v=>typeof v==='string'))throw Error('Destino inválido');value=value.join(',');}\n if(typeof value!=='string'||!value.trim()||value.length>256)throw Error('Destino inválido');\n const registry=destinationRegistry(),selected=new Set();\n for(const item of value.split(',')){\n  const token=item.trim().toUpperCase();if(!token)throw Error('Destino vacío entre comas');\n  const expanded=token==='AMBOS'?['OPURO','OPOL']:token==='TODOS'?Object.keys(registry):[token];\n  for(const destination of expanded){if(!Object.hasOwn(registry,destination))throw Error('Destino desconocido: '+destination);selected.add(destination);}\n }\n return Object.keys(registry).filter(d=>selected.has(d));\n}\nfunction destinationLabel(destinations) {\n const all=Object.keys(destinationRegistry()),set=new Set(destinations),items=all.filter(d=>set.has(d));\n if(items.length!==set.size||!items.length)throw Error('Destino inválido');\n if(items.length===all.length)return 'TODOS';\n if(items.length===2&&items[0]==='OPURO'&&items[1]==='OPOL')return 'AMBOS';\n return items.join(',');\n}\nfunction editorialSnapshot(post) {\n // Dates, permalinks, generated SEO head and capabilities legitimately change\n // on publication. Editorial data must remain exactly as read before publishing.\n const meta={};for(const key of ['rank_math_title','rank_math_description','rank_math_focus_keyword','opmx_editorial','oxpuro_hero_media_id','oxpuro_editorial','liberalmx_hero_media_id','liberalmx_editorial','site-post-title'])if(Object.hasOwn(post.meta??{},key))meta[key]=post.meta[key];\n return {id:post.id,slug:post.slug,type:post.type,title:post.title?.raw,content:post.content?.raw,excerpt:post.excerpt?.raw,author:post.author,featured_media:post.featured_media,categories:[...(post.categories??[])].sort((a,b)=>a-b),tags:[...(post.tags??[])].sort((a,b)=>a-b),meta};\n}\nfunction checkPublicationPreflight(plan,responses,opolCategory,guards) {\n const next=JSON.parse(JSON.stringify(plan));\n for(const destination of plan.requested){const r=responses[destination],p=r?.body,g=guards?.[destination];\n  if(g?.statusCode!==200||g.body?.status!=='reported'||String(g.body?.postId)!==String(plan.targets[destination].post_id))throw Error('Guard no confirma identidad del post: '+destination);\n  const existingPublic=plan.operation==='publicar_borradores_opmx'&&p?.status==='publish';\n  if(r?.statusCode!==200||!p||p.id!==plan.targets[destination].post_id||p.slug!==plan.slug||!(p.status==='draft'||existingPublic)||p.type!=='post'||typeof p.title?.raw!=='string'||!p.title.raw.trim()||typeof p.content?.raw!=='string'||!p.content.raw.includes('<!-- wp:')||p.content.raw.includes('{{OPMX:')||!Number.isSafeInteger(p.featured_media)||p.featured_media<1||!Number.isSafeInteger(p.author)||p.author<1||!Array.isArray(p.categories)||!p.categories.length||!Array.isArray(p.tags))throw Error('Preflight de borradores no coincide: '+destination);\n  for(const key of ['rank_math_title','rank_math_description','rank_math_focus_keyword'])if(typeof p.meta?.[key]!=='string'||!p.meta[key].trim())throw Error('SEO no confirmado: '+destination);\n  const config=destinationRegistry()[destination];\n  if(config.hero&&(!Number.isSafeInteger(p.meta?.[config.heroMeta])||p.meta[config.heroMeta]<1||!p.meta[config.editorialMeta]))throw Error('Hero no confirmado: '+destination);\n  let path='/'+plan.slug+'/';\n  if(destination==='OPOL'){const c=opolCategory?.body;const primary=p.meta?.opmx_editorial?.primary_category;\n   if(opolCategory?.statusCode!==200||!c||!p.categories.includes(c.id)||Number(primary)!==c.id||typeof c.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.slug))throw Error('Ruta de categoría OPOL no confirmada');\n   path='/'+c.slug+path;\n  }\n  next.targets[destination]={...next.targets[destination],guard_verified:true,before:editorialSnapshot(p),status:existingPublic?'PUBLISHED':'NOT_ATTEMPTED',cms_verified:existingPublic,public_url:destinationRegistry()[destination].publicOrigin+path};\n }\n return next;\n}\nconst p=$('Conservar plan publicación').first().json;const responses={},guards={};for(const d of p.requested){responses[d]=$('Publicación — Preflight '+d).first().json;guards[d]=$('Publicación — Guard '+d).first().json;}return [{json:checkPublicationPreflight(p,responses,p.requested.includes('OPOL')?$('Publicación — Categoría OPOL').first().json:undefined,guards)}];"
      },
      "position": [
        2900,
        -300
      ],
      "typeVersion": 2
    },
    {
      "name": "Publicación — Evaluar OPURO",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "function editorialSnapshot(post) {\n // Dates, permalinks, generated SEO head and capabilities legitimately change\n // on publication. Editorial data must remain exactly as read before publishing.\n const meta={};for(const key of ['rank_math_title','rank_math_description','rank_math_focus_keyword','opmx_editorial','oxpuro_hero_media_id','oxpuro_editorial','liberalmx_hero_media_id','liberalmx_editorial','site-post-title'])if(Object.hasOwn(post.meta??{},key))meta[key]=post.meta[key];\n return {id:post.id,slug:post.slug,type:post.type,title:post.title?.raw,content:post.content?.raw,excerpt:post.excerpt?.raw,author:post.author,featured_media:post.featured_media,categories:[...(post.categories??[])].sort((a,b)=>a-b),tags:[...(post.tags??[])].sort((a,b)=>a-b),meta};\n}\nfunction recordPublication(plan,destination,response) {\n const next=JSON.parse(JSON.stringify(plan)),t=next.targets[destination],p=response?.body;\n if(!t?.before)throw Error('Falta preflight');\n // Even a lost POST response is reconciled by a separate authenticated GET.\n // Never resend the POST automatically.\n const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);\n const ok=response?.statusCode===200&&p?.status==='publish'&&stable(editorialSnapshot(p))===stable(t.before);\n t.status=ok?'PUBLISHED':'UNCERTAIN';t.cms_verified=ok;\n return next;\n}\nreturn [{json:recordPublication($('Preflight conjunto publicación').first().json,'OPURO',$input.first().json)}];"
      },
      "position": [
        2000,
        0
      ],
      "typeVersion": 2
    },
    {
      "name": "Publicación — Evaluar OPOL",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "function editorialSnapshot(post) {\n // Dates, permalinks, generated SEO head and capabilities legitimately change\n // on publication. Editorial data must remain exactly as read before publishing.\n const meta={};for(const key of ['rank_math_title','rank_math_description','rank_math_focus_keyword','opmx_editorial','oxpuro_hero_media_id','oxpuro_editorial','liberalmx_hero_media_id','liberalmx_editorial','site-post-title'])if(Object.hasOwn(post.meta??{},key))meta[key]=post.meta[key];\n return {id:post.id,slug:post.slug,type:post.type,title:post.title?.raw,content:post.content?.raw,excerpt:post.excerpt?.raw,author:post.author,featured_media:post.featured_media,categories:[...(post.categories??[])].sort((a,b)=>a-b),tags:[...(post.tags??[])].sort((a,b)=>a-b),meta};\n}\nfunction recordPublication(plan,destination,response) {\n const next=JSON.parse(JSON.stringify(plan)),t=next.targets[destination],p=response?.body;\n if(!t?.before)throw Error('Falta preflight');\n // Even a lost POST response is reconciled by a separate authenticated GET.\n // Never resend the POST automatically.\n const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);\n const ok=response?.statusCode===200&&p?.status==='publish'&&stable(editorialSnapshot(p))===stable(t.before);\n t.status=ok?'PUBLISHED':'UNCERTAIN';t.cms_verified=ok;\n return next;\n}\nreturn [{json:recordPublication($('Conservar publicación OPURO').first().json,'OPOL',$input.first().json)}];"
      },
      "position": [
        1700,
        300
      ],
      "typeVersion": 2
    },
    {
      "name": "Publicación — Evaluar LIBERAL",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "function editorialSnapshot(post) {\n // Dates, permalinks, generated SEO head and capabilities legitimately change\n // on publication. Editorial data must remain exactly as read before publishing.\n const meta={};for(const key of ['rank_math_title','rank_math_description','rank_math_focus_keyword','opmx_editorial','oxpuro_hero_media_id','oxpuro_editorial','liberalmx_hero_media_id','liberalmx_editorial','site-post-title'])if(Object.hasOwn(post.meta??{},key))meta[key]=post.meta[key];\n return {id:post.id,slug:post.slug,type:post.type,title:post.title?.raw,content:post.content?.raw,excerpt:post.excerpt?.raw,author:post.author,featured_media:post.featured_media,categories:[...(post.categories??[])].sort((a,b)=>a-b),tags:[...(post.tags??[])].sort((a,b)=>a-b),meta};\n}\nfunction recordPublication(plan,destination,response) {\n const next=JSON.parse(JSON.stringify(plan)),t=next.targets[destination],p=response?.body;\n if(!t?.before)throw Error('Falta preflight');\n // Even a lost POST response is reconciled by a separate authenticated GET.\n // Never resend the POST automatically.\n const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);\n const ok=response?.statusCode===200&&p?.status==='publish'&&stable(editorialSnapshot(p))===stable(t.before);\n t.status=ok?'PUBLISHED':'UNCERTAIN';t.cms_verified=ok;\n return next;\n}\nreturn [{json:recordPublication($('Conservar publicación OPOL').first().json,'LIBERAL',$input.first().json)}];"
      },
      "position": [
        2240,
        2600
      ],
      "typeVersion": 2
    },
    {
      "name": "MASTER — Validación estática Shared",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "// MASTER_SEMANTIC_PREFLIGHT_V1\nfunction classifyPublisherMasterError(error) {\n const message=typeof error?.message==='string'?error.message:typeof error==='string'?error:'';\n const exact={\n  'Falta request_id estable y válido':['REQUEST_ID',['request_id']],\n  'Falta MASTER como objeto JSON':['MASTER_OBJECT',['MASTER']],\n  'Esta prueba sólo admite PUBLICAR=false':['DRAFT_TRANSPORT',['PUBLICAR']],\n  'Destino inválido':['DESTINATION',['destino']],\n  'Destino vacío entre comas':['DESTINATION',['destino']],\n  'Subtítulo o crédito Hero inválido para metadata editorial.':['HERO_METADATA',['SEO.SUBTITULO','IMAGENES.HERO_OPURO.CREDITO']],\n  'Falta CATEGORIAS.LIBERAL.PRINCIPAL':['LIBERAL_CATEGORY',['CATEGORIAS.LIBERAL.PRINCIPAL']],\n  'Falta el archivo HERO (hero_file) para OPURO.':['HERO_FILE',['hero_file']],\n  'Falta el archivo DESTACADA (featured_file) para OPURO.':['FEATURED_FILE',['featured_file']],\n  'Falta el archivo DESTACADA (featured_file) para OPOL.':['FEATURED_FILE',['featured_file']],\n };\n const prefixes=[\n  ['CONTRATO_V1_2_AUTOR_ID_PROHIBIDO:','AUTHOR_ID',['PUBLICACION.AUTOR_ID']],\n  ['MASTER_LITERAL_PROFILE_INVALID:','LITERAL_PROFILE',['CONTROL_EDITORIAL.LITERAL']],\n  ['CONTROL_EDITORIAL_NO_LISTO:','EDITORIAL_STATE',['CONTROL_EDITORIAL.ESTADO']],\n  ['CATEGORIA_OPURO_NO_AUTORIZADA:','OPURO_CATEGORY',['CATEGORIAS.OPURO.PRINCIPAL']],\n  ['CATEGORIA_OPOL_NO_AUTORIZADA:','OPOL_CATEGORY',['CATEGORIAS.OPOL.PRINCIPAL']],\n  ['CATEGORIA_OPOL_JERARQUIA_INVALIDA:','OPOL_HIERARCHY',['CATEGORIAS.OPOL.SECUNDARIA']],\n  ['SEO_CATEGORIA_INCONSISTENTE:','SEO_CATEGORY',['SEO.CATEGORIA']],\n  ['GUTENBERG_ENRIQUECIDO_FINAL es obligatorio','ENRICHED_BLOCKS',['GUTENBERG_ENRIQUECIDO_FINAL']],\n  ['GUTENBERG_ENRIQUECIDO_FINAL contiene','ENRICHED_CONTENT',['GUTENBERG_ENRIQUECIDO_FINAL']],\n  ['GUTENBERG_ENRIQUECIDO_FINAL usa bloques','ENRICHED_BLOCKS',['GUTENBERG_ENRIQUECIDO_FINAL']],\n  ['Todo core/image enriquecido debe','ENRICHED_IMAGE',['GUTENBERG_ENRIQUECIDO_FINAL']],\n  ['HERO_OPURO.URL debe ser exactamente','HERO_PLACEHOLDER',['IMAGENES.HERO_OPURO.URL']],\n  ['DESTACADA_OPURO.URL debe ser exactamente','FEATURED_PLACEHOLDER',['IMAGENES.DESTACADA_OPURO.URL']],\n  ['GUTENBERG_FINAL es obligatorio','OPOL_BLOCKS',['GUTENBERG_FINAL']],\n  ['DESTACADA_OPOL.URL debe ser exactamente','OPOL_PLACEHOLDER',['IMAGENES.DESTACADA_OPOL.URL']],\n  ['LIBERAL: los bloques core/image internos','LIBERAL_INLINE_IMAGE',['GUTENBERG_ENRIQUECIDO_FINAL']],\n  ['Destino desconocido:','DESTINATION',['destino']],\n ];\n let found=exact[message]??prefixes.find(([prefix])=>message.startsWith(prefix))?.slice(1);\n const image=/^(?:Imagen inválida o ausente|Formato no admitido): (hero_file|featured_file)$/.exec(message);\n if(image)found=['IMAGE_FILE',[image[1]]];\n const missing=/^OPMX MASTER incompleto para (?:OPURO|OPOL|LIBERAL|AMBOS|TODOS|OPURO,LIBERAL|OPOL,LIBERAL)\\. Faltan campos comunes\\/seleccionados: ([A-Za-z, ]+)$/.exec(message);\n const selected=/^OPMX MASTER incompleto para (?:Oxígeno Puro|OXígeno Político)\\. Faltan: ([A-Za-z, ]+)$/.exec(message);\n if(missing||selected){\n  const fields={title:'SEO.TITULO_SEO',slug:'SEO.SLUG',excerpt:'PUBLICACION.EXTRACTO',primaryKeyword:'SEO.KEYWORD_PRINCIPAL',tags:'SEO.ETIQUETAS',category:'CATEGORIAS.OPURO.PRINCIPAL',categoryOpol:'CATEGORIAS.OPOL.PRINCIPAL',gutenbergEnriquecidoFinal:'GUTENBERG_ENRIQUECIDO_FINAL',heroOpuroUrl:'IMAGENES.HERO_OPURO.URL',featuredOpuroUrl:'IMAGENES.DESTACADA_OPURO.URL',featuredOpuroAlt:'IMAGENES.DESTACADA_OPURO.ALT',gutenbergFinal:'GUTENBERG_FINAL',featuredOpolUrl:'IMAGENES.DESTACADA_OPOL.URL',featuredOpolAlt:'IMAGENES.DESTACADA_OPOL.ALT'};\n  const keys=(missing??selected)[1].split(',').map(x=>x.trim());\n  if(keys.length&&keys.every(k=>Object.hasOwn(fields,k)))found=['REQUIRED_FIELDS',keys.map(k=>fields[k])];\n }\n return found?{status:'VALIDATION_FAILED',code:found[0],fields:found[1],writesStarted:false,retryPermitted:false}:{status:'FILES_REJECTED',code:'STATIC_PREFLIGHT_UNCONFIRMED',fields:[],writesStarted:false,retryPermitted:false};\n}\nasync function validatePublisherMasterStatically(input,request,implementations,pin) {\n const failed=error=>({ok:false,...classifyPublisherMasterError(error)});\n if(!input||!input.payload||typeof request?.operation!=='string'||!['validar_archivos_opmx','preparar_borrador_opmx','publicar_nota_opmx'].includes(request.operation)||typeof implementations?.prepare!=='function'||typeof implementations?.normalize!=='function')return failed('PREFLIGHT_CONTEXT_UNCONFIRMED');\n const payload=input.payload;\n let local;\n try{local=JSON.parse(JSON.stringify(payload))}catch{return failed('PREFLIGHT_CONTEXT_UNCONFIRMED')}\n if(!local.master||typeof local.master!=='object'||Array.isArray(local.master))return failed('Falta MASTER como objeto JSON');\n // validar_archivos has no external request_id parameter. This sentinel is\n // local syntax input only; it never changes the MASTER or transmitted payload\n // and is not a binding, acceptance, hash or permission. LITERAL instead uses\n // the exact original scope already authenticated by its Guard preflight.\n if(request.operation==='validar_archivos_opmx'&&(request.request_id===null||request.request_id===undefined)){\n  const declared=local.master?.CONTROL_EDITORIAL?.MODO_CONTENIDO;\n  const original=declared==='LITERAL'?local.master?.CONTROL_EDITORIAL?.LITERAL?.REQUEST_ID:null;\n  if(declared==='LITERAL'&&!/^tg_[a-f0-9]{64}$/.test(original??''))return failed('MASTER_LITERAL_PROFILE_INVALID:SCOPE');\n  local.request_id=original??'opmx_static_preflight_no_write';\n }else if(typeof request.request_id!=='string'||payload.request_id!==request.request_id)return failed('Falta request_id estable y válido');\n if(typeof local.master?.SEO?.SLUG!=='string'||local.master.SEO.SLUG.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(local.master.SEO.SLUG))return {ok:false,status:'VALIDATION_FAILED',code:'SLUG_FORMAT',fields:['SEO.SLUG'],writesStarted:false,retryPermitted:false};\n const io={helpers:{\n  async prepareBinaryData(buffer,fileName,mimeType){return {fileName,mimeType,data:'STATIC_PREFLIGHT_METADATA_ONLY',fileSize:buffer.length}},\n  async getBinaryDataBuffer(){throw Error('PREFLIGHT_BINARY_READ_NOT_PERMITTED')},\n }};\n try{\n  const prepared=await implementations.prepare.call(io,local,{item:{binary:{}}});\n  if(!prepared?.json||!prepared.binary)throw Error('PREFLIGHT_PREPARATION_UNCONFIRMED');\n  const normalized=await implementations.normalize.call(io,prepared.json,{item:prepared});\n  if(!normalized?.json?.canonical||!normalized.json.execution||normalized.json.canonical.status!=='READY_FOR_SELECTED_DRAFTS')throw Error('PREFLIGHT_NORMALIZATION_UNCONFIRMED');\n  return {ok:true,status:'MASTER_SEMANTICS_VALIDATED',scope:'STATIC_MASTER_AND_VERIFIED_IMAGE_BYTES',shared_workflow_id:pin.workflowId,shared_version_id:pin.versionId,prepare_sha256:pin.prepareSha256,normalizer_sha256:pin.normalizerSha256,live_cms_checks:'NOT_CHECKED',request_binding:'NOT_CHECKED',writesStarted:false,retryPermitted:false};\n }catch(error){return failed(error)}\n}\nfunction semanticPreflightResponse(request,result) {\n const semantic=result?.semantic_preflight;\n const allowedFields=['request_id','MASTER','PUBLICAR','destino','SEO.SUBTITULO','IMAGENES.HERO_OPURO.CREDITO','CATEGORIAS.LIBERAL.PRINCIPAL','hero_file','featured_file','PUBLICACION.AUTOR_ID','CONTROL_EDITORIAL.LITERAL','CONTROL_EDITORIAL.ESTADO','CATEGORIAS.OPURO.PRINCIPAL','CATEGORIAS.OPOL.PRINCIPAL','CATEGORIAS.OPOL.SECUNDARIA','SEO.CATEGORIA','GUTENBERG_ENRIQUECIDO_FINAL','IMAGENES.HERO_OPURO.URL','IMAGENES.DESTACADA_OPURO.URL','GUTENBERG_FINAL','IMAGENES.DESTACADA_OPOL.URL','SEO.TITULO_SEO','SEO.SLUG','PUBLICACION.EXTRACTO','SEO.KEYWORD_PRINCIPAL','SEO.ETIQUETAS','IMAGENES.DESTACADA_OPURO.ALT','IMAGENES.DESTACADA_OPOL.ALT'];\n const allowedCodes=['REQUEST_ID','MASTER_OBJECT','DRAFT_TRANSPORT','DESTINATION','HERO_METADATA','LIBERAL_CATEGORY','HERO_FILE','FEATURED_FILE','AUTHOR_ID','LITERAL_PROFILE','EDITORIAL_STATE','OPURO_CATEGORY','OPOL_CATEGORY','OPOL_HIERARCHY','SEO_CATEGORY','ENRICHED_BLOCKS','ENRICHED_CONTENT','ENRICHED_IMAGE','HERO_PLACEHOLDER','FEATURED_PLACEHOLDER','OPOL_BLOCKS','OPOL_PLACEHOLDER','LIBERAL_INLINE_IMAGE','IMAGE_FILE','REQUIRED_FIELDS','SLUG_FORMAT'];\n const valid=semantic?.ok===false&&semantic.status==='VALIDATION_FAILED'&&semantic.writesStarted===false&&semantic.retryPermitted===false&&allowedCodes.includes(semantic.code)&&Array.isArray(semantic.fields)&&semantic.fields.length>0&&semantic.fields.every(x=>allowedFields.includes(x));\n const response=valid?{status:'VALIDATION_FAILED',code:semantic.code,field:semantic.fields[0],fields:semantic.fields,message:'El MASTER no cumple las validaciones estáticas del destino. Corrige los campos indicados.',writesStarted:false,retryPermitted:false}:{status:'FILES_REJECTED',code:'STATIC_PREFLIGHT_UNCONFIRMED',message:'La validación previa no pudo confirmarse; no se inició el envío a Publisher.',writesStarted:false,retryPermitted:false};\n if(typeof request?.request_id==='string')response.request_id=request.request_id;\n return {httpStatus:200,response:{jsonrpc:'2.0',id:request?.id??null,result:{content:[{type:'text',text:JSON.stringify(response)}],structuredContent:response,isError:true}}};\n}\nasync function sharedPrepare($json,$input){\nfunction destinationRegistry() {\n return {\n  OPURO:{cms:'https://cms.oxigenopuro.com.mx',publicOrigin:'https://oxigenopuro.com.mx',resultKey:'oxigenopuro',postIdKey:'post_id_opuro',heroMeta:'oxpuro_hero_media_id',editorialMeta:'oxpuro_editorial',hero:true},\n  OPOL:{cms:'https://cms.oxigenopolitico.com.mx',publicOrigin:'https://oxigenopolitico.com.mx',resultKey:'oxigenopolitico',postIdKey:'post_id_opol',hero:false},\n  LIBERAL:{cms:'https://cms.elliberal.mx',publicOrigin:'https://elliberal.mx',resultKey:'elliberal',postIdKey:'post_id_liberal',heroMeta:'liberalmx_hero_media_id',editorialMeta:'liberalmx_editorial',hero:true},\n };\n}\nfunction resolveDestinations(value) {\n if(Array.isArray(value)){if(!value.every(v=>typeof v==='string'))throw Error('Destino inválido');value=value.join(',');}\n if(typeof value!=='string'||!value.trim()||value.length>256)throw Error('Destino inválido');\n const registry=destinationRegistry(),selected=new Set();\n for(const item of value.split(',')){\n  const token=item.trim().toUpperCase();if(!token)throw Error('Destino vacío entre comas');\n  const expanded=token==='AMBOS'?['OPURO','OPOL']:token==='TODOS'?Object.keys(registry):[token];\n  for(const destination of expanded){if(!Object.hasOwn(registry,destination))throw Error('Destino desconocido: '+destination);selected.add(destination);}\n }\n return Object.keys(registry).filter(d=>selected.has(d));\n}\nfunction destinationLabel(destinations) {\n const all=Object.keys(destinationRegistry()),set=new Set(destinations),items=all.filter(d=>set.has(d));\n if(items.length!==set.size||!items.length)throw Error('Destino inválido');\n if(items.length===all.length)return 'TODOS';\n if(items.length===2&&items[0]==='OPURO'&&items[1]==='OPOL')return 'AMBOS';\n return items.join(',');\n}\nconst data = $json.body ?? $json;\nif (typeof data.request_id !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(data.request_id)) throw new Error('Falta request_id estable y válido');\nif (!data.master || typeof data.master !== 'object' || Array.isArray(data.master)) throw new Error('Falta MASTER como objeto JSON');\nconst destination=destinationLabel(resolveDestinations(data.CREAR_EN));\nif (data.PUBLICAR !== false) throw new Error('Esta prueba sólo admite PUBLICAR=false');\nconst binary = {};\nfor (const [key, required] of [['hero_file', destination !== 'OPOL'], ['featured_file', true]]) {\n  const file = data[key];\n  if (!file && !required) continue;\n  if (!file || typeof file.base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64) || !file.base64.length || file.base64.length > 14000000) throw new Error('Imagen inválida o ausente: '+key);\n  const buf = Buffer.from(file.base64, 'base64');\n  let mime, ext;\n  if (buf.length >= 8 && buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) { mime='image/png'; ext='png'; }\n  else if (buf.length >= 3 && buf[0]===255 && buf[1]===216 && buf[2]===255) { mime='image/jpeg'; ext='jpg'; }\n  else if (buf.length >= 12 && buf.subarray(0,4).toString()==='RIFF' && buf.subarray(8,12).toString()==='WEBP') { mime='image/webp'; ext='webp'; }\n  else throw new Error('Formato no admitido: '+key);\n  binary[key] = await this.helpers.prepareBinaryData(buf, key+'.'+ext, mime);\n}\nreturn {json:{json: JSON.stringify(data.master), CREAR_EN:destination, PUBLICAR:false, request_id:data.request_id,source_images:{hero_base64:data.hero_file?.base64??null,featured_base64:data.featured_file.base64}}, binary};\n}\nasync function sharedNormalize($json,$input){\nconst literalText=(()=>{\nconst MAX_BYTES=2*1024*1024;\nconst badControls=/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f]/u;\nconst htmlTags=new Set(['p','div','br','strong','b','em','i','u','s','a','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','span']);\nconst blockTags=new Set(['p','div','br','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote']);\nconst blocks=new Set(['paragraph','heading','list','list-item','quote']);\nconst entities={amp:'&',AMP:'&',lt:'<',LT:'<',gt:'>',GT:'>',quot:'\"',QUOT:'\"',apos:\"'\",nbsp:'\\u00a0'};\nconst safeClasses=new Set(['wp-block-paragraph','wp-block-heading','wp-block-list','wp-block-quote','has-text-align-left','has-text-align-center','has-text-align-right','has-text-align-justify']);\nconst fail=()=>{throw Error('LITERAL_TEXT_UNCONFIRMED')};\nfunction text(value,max=MAX_BYTES){\n if(typeof value!=='string'||badControls.test(value)||new TextEncoder().encode(value).length>max)fail();\n return value;\n}\nfunction normalizeLiteralText(value){return text(value).normalize('NFC').replace(/\\s+/gu,' ').trim();}\nfunction decode(value){\n let out='',offset=0;\n while(offset<value.length){\n  const index=value.indexOf('&',offset);\n  if(index<0){out+=value.slice(offset);break}\n  out+=value.slice(offset,index);const end=value.indexOf(';',index+1);\n  if(end<0||end-index>32)fail();const name=value.slice(index+1,end);\n  if(Object.hasOwn(entities,name))out+=entities[name];\n  else if(/^#(?:[0-9]+|x[a-f0-9]+)$/i.test(name)){\n   const cp=/^#x/i.test(name)?parseInt(name.slice(2),16):Number(name.slice(1));\n   if(!Number.isSafeInteger(cp)||cp<1||cp>0x10ffff||cp>=0xd800&&cp<=0xdfff||cp%0x10000>=0xfffe)fail();\n   const char=String.fromCodePoint(cp);if(badControls.test(char))fail();out+=char;\n  }else fail();\n  offset=end+1;\n }\n return text(out);\n}\nfunction classes(value){\n const tokens=value.trim().split(/\\s+/u);\n if(!tokens.length||tokens.some(x=>!safeClasses.has(x)))fail();\n}\nfunction safeHttpUrl(value){\n // The n8n Code sandbox does not expose URL. Validate only this conservative\n // HTTP(S) vocabulary locally; never resolve a hostname or fetch the link.\n if(/[\\\\\\u0000-\\u0020\\u007f]/u.test(value))return false;\n const match=/^https?:\\/\\/([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?(?:[/?#][\\s\\S]*)?$/i.exec(value);\n if(!match||match[2]&&(Number(match[2])<1||Number(match[2])>65535))return false;\n const host=match[1].endsWith('.')?match[1].slice(0,-1):match[1];\n if(!host||host.length>253)return false;\n if(/^[0-9.]+$/.test(host)){\n  const octets=host.split('.');\n  return octets.length===4&&octets.every(x=>/^(?:0|[1-9][0-9]{0,2})$/.test(x)&&Number(x)<=255);\n }\n if(/^(?:0x[a-f0-9]+|[0-9]+)(?:\\.(?:0x[a-f0-9]+|[0-9]+))*$/i.test(host)||/^[0-9]+$/.test(host.split('.').at(-1)))return false;\n return host.split('.').every(x=>x.length<=63&&/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(x));\n}\nfunction blockAttributes(name,value){\n if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)fail();\n const allowed={paragraph:['align','className','anchor','dropCap'],heading:['align','textAlign','className','anchor','level'],list:['ordered','start','reversed','className'], 'list-item':['className'],quote:['className']}[name];\n for(const [key,v] of Object.entries(value)){\n  if(!allowed.includes(key))fail();\n  if(key==='className'){if(typeof v!=='string')fail();classes(v)}\n  else if(key==='anchor'){if(typeof v!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(v))fail()}\n  else if(['align','textAlign'].includes(key)){if(!['left','center','right','justify'].includes(v))fail()}\n  else if(key==='level'){if(!Number.isSafeInteger(v)||v<1||v>6)fail()}\n  else if(key==='start'){if(!Number.isSafeInteger(v)||v<1||v>1000000)fail()}\n  else if(typeof v!=='boolean')fail();\n }\n}\nfunction attributes(raw,tag,{plain=false}={}){\n let remaining=raw;const seen=new Set();\n while(remaining.trim()){\n  const match=/^\\s+([A-Za-z][A-Za-z0-9-]*)\\s*=\\s*(?:\"([^\"<>]*)\"|'([^'<>]*)')/.exec(remaining);\n  if(!match)fail();const name=match[1].toLowerCase(),value=decode(match[2]??match[3]);remaining=remaining.slice(match[0].length);\n  if(seen.has(name)||!['class','id','title','lang','dir','href','rel','target'].includes(name)||plain&&name==='title')fail();seen.add(name);\n  if(name==='class')classes(value);\n  else if(name==='id'){if(!/^[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(value))fail()}\n  else if(name==='lang'){if(!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value))fail()}\n  else if(name==='dir'){if(!['ltr','rtl','auto'].includes(value))fail()}\n  else if(name==='title'){text(value,8192)}\n  else if(tag!=='a')fail();\n  else if(name==='href'){\n   if(value.startsWith('#')){if(!/^#[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(value))fail()}\n   else if(!safeHttpUrl(value))fail();\n  }else if(name==='target'){if(!['_blank','_self'].includes(value))fail()}\n  else if(name==='rel'){if(value.trim().split(/\\s+/u).some(x=>!['noopener','noreferrer','nofollow','sponsored','ugc'].includes(x)))fail()}\n }\n}\n\n// This intentionally handles only the small, deterministic markup vocabulary\n// used by the literal renderer. It does not run a browser, fetch a link, decode\n// an HTML entity into markup, execute a source instruction or discard unknown\n// HTML. Anything outside this vocabulary requires explicit reconciliation.\nfunction readLiteralMarkup(markup,{plain=false}={}){\n text(markup);const stack=[],blockStack=[];let offset=0,visible='',tokens=0;\n while(offset<markup.length){\n  if(++tokens>100000)fail();const index=markup.indexOf('<',offset);\n  if(index<0){visible+=decode(markup.slice(offset));offset=markup.length;break}\n  visible+=decode(markup.slice(offset,index));\n  if(markup.startsWith('<!--',index)){\n   const end=markup.indexOf('-->',index+4);if(end<0)fail();const body=markup.slice(index+4,end).trim();\n   const m=/^(\\/?)wp:(?:core\\/)?([a-z-]+)(?:\\s+(\\{[\\s\\S]*\\}))?(\\s*\\/)?$/.exec(body);\n   if(!m||!blocks.has(m[2])||body.includes('<!--')||body.includes('--'))fail();\n   const closing=m[1]==='/',selfClosing=!!m[4];\n   if(closing){if(m[3]||selfClosing)fail();const last=blockStack.pop();if(!last||last.name!==m[2]||last.depth!==stack.length)fail()}\n   else {if(m[3]){let parsed;try{parsed=JSON.parse(m[3])}catch{fail()}blockAttributes(m[2],parsed)}if(!selfClosing){blockStack.push({name:m[2],depth:stack.length});if(blockStack.length>64)fail()}}\n   offset=end+3;continue;\n  }\n  let end=index+1,quote=null;\n  for(;end<markup.length;end++){\n   const char=markup[end];\n   if(quote){if(char===quote)quote=null;else if(char==='<')fail()}\n   else if(char==='\"'||char===\"'\")quote=char;\n   else if(char==='>')break;\n   else if(char==='<')fail();\n  }\n  if(end>=markup.length||quote)fail();\n  const token=markup.slice(index,end+1),m=/^<(\\/?)([A-Za-z][A-Za-z0-9]*)([\\s\\S]*?)>$/.exec(token);\n  if(!m)fail();const closing=m[1]==='/',name=m[2].toLowerCase();if(!htmlTags.has(name)||plain&&name==='a')fail();\n  let rest=m[3],selfClosing=false;\n  if(/\\/\\s*$/.test(rest)){selfClosing=true;rest=rest.replace(/\\/\\s*$/,'')}\n  if(closing){if(rest.trim()||selfClosing||name==='br'||stack.pop()!==name)fail()}\n  else {\n   if(selfClosing&&name!=='br'||name==='a'&&stack.includes('a'))fail();\n   if(blockTags.has(name)&&name!=='br'&&stack.some(x=>['p','strong','b','em','i','u','s','a','span','h1','h2','h3','h4','h5','h6'].includes(x)))fail();\n   if(name==='li'&&!['ul','ol'].includes(stack.at(-1))||['ul','ol'].includes(stack.at(-1))&&name!=='li')fail();\n   attributes(rest,name,{plain});if(name!=='br'){stack.push(name);if(stack.length>128)fail()}\n  }\n  // A private separator retains rendered block boundaries without confusing\n  // source line wrapping with a new paragraph. Input NULs are rejected above.\n  if(blockTags.has(name))visible+='\\u0000';\n  offset=end+1;\n }\n if(stack.length||blockStack.length)fail();\n const segments=visible.split('\\u0000').map(normalizeLiteralText).filter(Boolean);\n return {visibleText:normalizeLiteralText(visible.replaceAll('\\u0000','\\n')),segments};\n}\n\nfunction extractLiteralVisibleText(markup){return readLiteralMarkup(markup).visibleText;}\n\n// Plain Telegram source has no authenticated rich-text link or tooltip data.\n// Reject those additions even when their visible words happen to be unchanged.\nfunction extractLiteralPlainText(markup){return readLiteralMarkup(markup,{plain:true}).visibleText;}\n\nfunction assertLiteralCanonicalText({sourceText,title,subtitle,html,gutenberg,enriched}={}){\n text(title,2048);text(subtitle,8192);\n if(!normalizeLiteralText(title)||/<\\/?[a-z!]/i.test(title)||/<\\/?[a-z!]/i.test(subtitle))fail();\n for(const value of [html,gutenberg,enriched])if(!text(value).trim())fail();\n const bodies=[html,gutenberg,enriched].map(value=>readLiteralMarkup(value,{plain:true}));\n const normalizedBody=bodies[1].visibleText;\n if(!normalizedBody||bodies.some(body=>body.visibleText!==normalizedBody))fail();\n const block=/<!--\\s*wp:(?:core\\/)?(?:paragraph|heading|list|quote)(?:\\s|--)/;\n if(!block.test(gutenberg)||!block.test(enriched))fail();\n const source=text(sourceText).normalize('NFC').replace(/\\r\\n?/g,'\\n');\n const lines=source.split('\\n'),first=lines.findIndex(line=>normalizeLiteralText(line));\n if(first<0||normalizeLiteralText(title)!==normalizeLiteralText(lines[first]))fail();\n const remainder=lines.slice(first+1).join('\\n').trim();\n // Blank lines delimit original paragraphs. Legacy plain messages without\n // blank lines use complete lines; a subtitle may consume whole leading units\n // only, never part of the title or part of an original body paragraph.\n const units=remainder.split(/\\n[^\\S\\n]*\\n/u.test(source)?/\\n[^\\S\\n]*\\n+/u:/\\n/u).map(normalizeLiteralText).filter(Boolean);\n const normalizedSubtitle=normalizeLiteralText(subtitle);\n let consumed=0;\n if(normalizedSubtitle){\n  let prefix='';\n  for(let index=0;index<units.length;index++){\n   prefix+=(index?' ':'')+units[index];\n   if(prefix===normalizedSubtitle){consumed=index+1;break}\n   if(prefix.length>=normalizedSubtitle.length)break;\n  }\n  if(!consumed)fail();\n }\n const originalBody=units.slice(consumed);\n if(!originalBody.length||bodies.some(body=>body.segments.length!==originalBody.length||body.segments.some((part,index)=>part!==originalBody[index])))fail();\n return {title,subtitle,html,gutenberg,enriched,normalizedBody};\n}\n\nreturn {normalizeLiteralText,extractLiteralVisibleText,extractLiteralPlainText,assertLiteralCanonicalText};\n})();\nconst literalProfile=(()=>{const {normalizeLiteralText,extractLiteralVisibleText,extractLiteralPlainText,assertLiteralCanonicalText}=literalText;\nconst literalDestinations=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];\nconst nonemptyLiteralString=value=>typeof value==='string'&&value.trim().length>0;\nconst literalEscape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;').replaceAll(\"'\",'&#39;');\n\n// This renderer consumes the policy returned by chooseMotorPolicy and a corpus\n// assembled from verified source buffers. It is not an authentication proof:\n// Publisher must still validate the exact request and text against the Guard's\n// stored records. No instruction inside sourceText changes policy or scope.\nfunction buildLiteralDelivery({baseMaster,policy,packageId,revision,sourceText,title,subtitle,subtitles,paragraphs,excerpt}={}){\n if(!baseMaster||typeof baseMaster!=='object'||Array.isArray(baseMaster)||!policy||policy.authorized!==true||policy.content_mode!=='LITERAL'||!['DRAFT','PUBLISH'].includes(policy.mode)||!literalDestinations.includes(policy.destination)||!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||revision<1||revision>4294967295)throw Error('LITERAL_DELIVERY_POLICY_INVALID');\n if(!nonemptyLiteralString(sourceText)||!nonemptyLiteralString(title)||!Array.isArray(paragraphs)||!paragraphs.length||paragraphs.some(x=>!nonemptyLiteralString(x)))throw Error('LITERAL_DELIVERY_TEXT_INVALID');\n if(subtitle!==undefined&&subtitles!==undefined)throw Error('LITERAL_DELIVERY_SUBTITLE_AMBIGUOUS');\n if(subtitles!==undefined&&(!Array.isArray(subtitles)||subtitles.some(x=>!nonemptyLiteralString(x))))throw Error('LITERAL_DELIVERY_SUBTITLE_INVALID');\n const finalSubtitle=subtitles!==undefined?subtitles.join('\\n'):subtitle??'';\n if(typeof finalSubtitle!=='string')throw Error('LITERAL_DELIVERY_SUBTITLE_INVALID');\n const html=paragraphs.map(p=>`<p>${literalEscape(p)}</p>`).join('\\n');\n const gutenberg=paragraphs.map(p=>`<!-- wp:paragraph -->\\n<p>${literalEscape(p)}</p>\\n<!-- /wp:paragraph -->`).join('\\n\\n');\n assertLiteralCanonicalText({sourceText,title,subtitle:finalSubtitle,html,gutenberg,enriched:gutenberg});\n const requestId='tg_'+createHash('sha256').update(`${packageId}:${revision}:${policy.destination}:draft-v1`,'utf8').digest('hex');\n const finalExcerpt=excerpt??paragraphs[0];\n if(!nonemptyLiteralString(finalExcerpt)||![...paragraphs,finalSubtitle].filter(nonemptyLiteralString).some(x=>normalizeLiteralText(x)===normalizeLiteralText(finalExcerpt)))throw Error('LITERAL_DELIVERY_EXCERPT_NOT_ORIGINAL');\n const master=JSON.parse(JSON.stringify(baseMaster));\n master.CONTROL_EDITORIAL={...(master.CONTROL_EDITORIAL??{}),MODO_CONTENIDO:'LITERAL',LITERAL:{PACKAGE_ID:packageId,REVISION:revision,REQUEST_ID:requestId}};\n master.SEO={...(master.SEO??{}),TITULO_SEO:title,SUBTITULO:finalSubtitle};\n if(!nonemptyLiteralString(master.SEO.METADESCRIPCION))master.SEO.METADESCRIPCION=finalExcerpt;\n master.PUBLICACION={...(master.PUBLICACION??{}),EXTRACTO:finalExcerpt};\n master.TEXTO_EDITORIAL={TITULO:title,SUBTITULO:finalSubtitle,...(subtitles!==undefined?{SUBTITULOS:[...subtitles]}:{}),PARRAFOS:[...paragraphs],ENTRADILLA:paragraphs[0],EN_BREVE:[],SECCIONES:[],CIERRE:null};\n master.FUENTES=[];\n master.HTML_FINAL=html;master.GUTENBERG_FINAL=gutenberg;master.GUTENBERG_ENRIQUECIDO_FINAL=gutenberg;\n const validation=validateLiteralMaster(master,{requestId});\n if(!validation.ok)throw Error('LITERAL_DELIVERY_MASTER_INVALID:'+validation.errors.join(','));\n return {master,requestId,mode:policy.mode,destination:policy.destination,content_mode:'LITERAL'};\n}\n\n// Pure profile validation, suitable for embedding into the existing n8n Code\n// preflight. EDITORIAL is dispatched back to its existing validators unchanged.\n// A successful local profile check does not authenticate LITERAL or grant a\n// write permit; the Guard derives mode, scope and original text independently.\nfunction validateLiteralMaster(master,{requestId}={}){\n const errors=[];\n const fail=error=>{errors.push(error)};\n if(!master||typeof master!=='object'||Array.isArray(master))return {ok:false,mode:null,errors:['MASTER_INVALID']};\n const equivalent=(a,b)=>{try{return normalizeLiteralText(a)===normalizeLiteralText(b)}catch{return false}};\n const control=master?.CONTROL_EDITORIAL;\n const declared=control?.MODO_CONTENIDO;\n if(declared===undefined||declared==='EDITORIAL')return {ok:true,mode:'EDITORIAL',errors};\n if(declared!=='LITERAL')return {ok:false,mode:null,errors:['CONTROL_EDITORIAL.MODO_CONTENIDO_INVALID']};\n if(!master||typeof master!=='object'||Array.isArray(master)||control?.ESTADO!=='LISTO')fail('CONTROL_EDITORIAL.ESTADO');\n const scope=control?.LITERAL;\n if(!scope||typeof scope!=='object'||Array.isArray(scope)||Object.keys(scope).sort().join(',')!=='PACKAGE_ID,REQUEST_ID,REVISION')fail('CONTROL_EDITORIAL.LITERAL');\n if(!/^tg_[a-f0-9]{40}$/.test(scope?.PACKAGE_ID??''))fail('CONTROL_EDITORIAL.LITERAL.PACKAGE_ID');\n if(!Number.isSafeInteger(scope?.REVISION)||scope.REVISION<1||scope.REVISION>4294967295)fail('CONTROL_EDITORIAL.LITERAL.REVISION');\n if(!/^tg_[a-f0-9]{64}$/.test(scope?.REQUEST_ID??'')||requestId!==undefined&&requestId!==scope?.REQUEST_ID)fail('CONTROL_EDITORIAL.LITERAL.REQUEST_ID');\n const seo=master?.SEO??{},text=master?.TEXTO_EDITORIAL??{};\n if(typeof seo.TITULO_SEO!=='string'||!seo.TITULO_SEO.trim())fail('SEO.TITULO_SEO');\n else if(new TextEncoder().encode(seo.TITULO_SEO).length>2048)fail('SEO.TITULO_SEO_TECHNICAL_MAX_2048_BYTES');\n if(typeof seo.SUBTITULO!=='string')fail('SEO.SUBTITULO');\n else if(seo.SUBTITULO.length>500)fail('SEO.SUBTITULO_TECHNICAL_MAX_500');\n if(typeof text.TITULO!=='string'||typeof seo.TITULO_SEO!=='string'||!equivalent(text.TITULO,seo.TITULO_SEO))fail('TEXTO_EDITORIAL.TITULO');\n if(typeof text.SUBTITULO!=='string'||typeof seo.SUBTITULO!=='string'||!equivalent(text.SUBTITULO,seo.SUBTITULO))fail('TEXTO_EDITORIAL.SUBTITULO');\n if(text.SUBTITULOS!==undefined&&(!Array.isArray(text.SUBTITULOS)||text.SUBTITULOS.some(x=>typeof x!=='string'||!x.trim())||!equivalent(text.SUBTITULOS.join('\\n'),seo.SUBTITULO??'')))fail('TEXTO_EDITORIAL.SUBTITULOS');\n const paragraphs=text.PARRAFOS;\n if(!Array.isArray(paragraphs)||!paragraphs.length||paragraphs.some(x=>typeof x!=='string'||!x.trim()))fail('TEXTO_EDITORIAL.PARRAFOS');\n for(const key of ['EN_BREVE','SECCIONES'])if(text[key]!==undefined&&(!Array.isArray(text[key])||text[key].length))fail('TEXTO_EDITORIAL.'+key);\n if(text.CIERRE!==undefined&&text.CIERRE!==null&&(typeof text.CIERRE!=='string'||text.CIERRE.trim()))fail('TEXTO_EDITORIAL.CIERRE');\n if(master?.FUENTES!==undefined&&(!Array.isArray(master.FUENTES)||master.FUENTES.length))fail('FUENTES');\n const excerpt=master?.PUBLICACION?.EXTRACTO;\n if(typeof excerpt!=='string'||!excerpt.trim())fail('PUBLICACION.EXTRACTO');\n else if(Array.isArray(paragraphs)&&!([...paragraphs,seo.SUBTITULO].filter(x=>typeof x==='string').some(x=>equivalent(x,excerpt))))fail('PUBLICACION.EXTRACTO_NOT_ORIGINAL');\n for(const key of ['HTML_FINAL','GUTENBERG_FINAL','GUTENBERG_ENRIQUECIDO_FINAL']){\n  const markup=master?.[key];\n  if(typeof markup!=='string'||!markup.trim()){fail(key);continue}\n  if(key!=='HTML_FINAL'&&!/<!--\\s*wp:paragraph(?:\\s|-->)/.test(markup)){fail(key+'_GUTENBERG_REQUIRED');continue}\n  try{if(Array.isArray(paragraphs)&&normalizeLiteralText(extractLiteralPlainText(markup))!==normalizeLiteralText(paragraphs.join('\\n\\n')))fail(key+'_TEXT_MISMATCH')}catch{fail(key+'_UNSAFE_OR_INVALID')}\n }\n if(errors.length)return {ok:false,mode:'LITERAL',errors};\n return {ok:true,mode:'LITERAL',errors,candidate:{requestId:scope.REQUEST_ID,declaredMode:'LITERAL',title:seo.TITULO_SEO.trim(),subtitle:seo.SUBTITULO.trim(),html:master.HTML_FINAL.trim(),gutenberg:master.GUTENBERG_FINAL.trim(),enriched:master.GUTENBERG_ENRIQUECIDO_FINAL.trim()}};\n}\n\nreturn {validateLiteralMaster};\n})();\nfunction destinationRegistry() {\n return {\n  OPURO:{cms:'https://cms.oxigenopuro.com.mx',publicOrigin:'https://oxigenopuro.com.mx',resultKey:'oxigenopuro',postIdKey:'post_id_opuro',heroMeta:'oxpuro_hero_media_id',editorialMeta:'oxpuro_editorial',hero:true},\n  OPOL:{cms:'https://cms.oxigenopolitico.com.mx',publicOrigin:'https://oxigenopolitico.com.mx',resultKey:'oxigenopolitico',postIdKey:'post_id_opol',hero:false},\n  LIBERAL:{cms:'https://cms.elliberal.mx',publicOrigin:'https://elliberal.mx',resultKey:'elliberal',postIdKey:'post_id_liberal',heroMeta:'liberalmx_hero_media_id',editorialMeta:'liberalmx_editorial',hero:true},\n };\n}\nfunction resolveDestinations(value) {\n if(Array.isArray(value)){if(!value.every(v=>typeof v==='string'))throw Error('Destino inválido');value=value.join(',');}\n if(typeof value!=='string'||!value.trim()||value.length>256)throw Error('Destino inválido');\n const registry=destinationRegistry(),selected=new Set();\n for(const item of value.split(',')){\n  const token=item.trim().toUpperCase();if(!token)throw Error('Destino vacío entre comas');\n  const expanded=token==='AMBOS'?['OPURO','OPOL']:token==='TODOS'?Object.keys(registry):[token];\n  for(const destination of expanded){if(!Object.hasOwn(registry,destination))throw Error('Destino desconocido: '+destination);selected.add(destination);}\n }\n return Object.keys(registry).filter(d=>selected.has(d));\n}\nfunction destinationLabel(destinations) {\n const all=Object.keys(destinationRegistry()),set=new Set(destinations),items=all.filter(d=>set.has(d));\n if(items.length!==set.size||!items.length)throw Error('Destino inválido');\n if(items.length===all.length)return 'TODOS';\n if(items.length===2&&items[0]==='OPURO'&&items[1]==='OPOL')return 'AMBOS';\n return items.join(',');\n}\nlet envelope = $json.body ?? $json;\n\nconst destinations=resolveDestinations(envelope.CREAR_EN);\nconst destinoRaw=destinationLabel(destinations);\nconst publicarRaw=envelope.PUBLICAR;\nconst publish=Array.isArray(publicarRaw)?publicarRaw.length>0:(publicarRaw===true||['sí','si','true','1','on'].includes(String(publicarRaw??'').trim().toLowerCase()));\nconst execution={destination:destinoRaw,destinations,create_opuro:destinations.includes('OPURO'),create_opol:destinations.includes('OPOL'),create_liberal:destinations.includes('LIBERAL'),publish};\n\n// v1.1.7: el MASTER llega pegado en \"json\" O como archivo \"json_file\".\nconst pastedJson = typeof envelope.json === 'string' ? envelope.json.trim() : '';\nconst binary = $input.item.binary ?? {};\nconst binaryKeys = Object.keys(binary);\nconst fileKey = binary.json_file ? 'json_file' : null;\nconst hasFile = Boolean(fileKey);\n\nif (pastedJson && hasFile) {\n  throw new Error('Entrega el OPMX MASTER de una sola forma: pega el JSON en el cuadro de texto O sube el archivo .json, no ambos.');\n}\nif (!pastedJson && !hasFile) {\n  throw new Error('Falta el OPMX MASTER. Pega el JSON completo en el cuadro de texto o sube un archivo .json.');\n}\n\nlet d;\nif (hasFile) {\n  const meta = binary[fileKey] ?? {};\n  const fileName = String(meta.fileName ?? '').trim();\n  const extension = String(meta.fileExtension ?? '').trim().toLowerCase();\n  if (fileName && !/\\.json$/i.test(fileName) && extension !== 'json') {\n    throw new Error(`El archivo subido debe ser .json. Archivo recibido: ${fileName || '(sin nombre)'}`);\n  }\n\n  let fileText;\n  try {\n    const buffer = await this.helpers.getBinaryDataBuffer(0, fileKey);\n    fileText = buffer.toString('utf8').replace(/^\\uFEFF/, '').trim();\n  } catch (error) {\n    throw new Error(`No fue posible leer el archivo JSON subido: ${error.message}`);\n  }\n  if (!fileText) throw new Error('El archivo JSON subido está vacío.');\n\n  try { d = JSON.parse(fileText); }\n  catch (error) { throw new Error(`El archivo subido no contiene JSON válido: ${error.message}`); }\n} else {\n  try { d = JSON.parse(pastedJson); }\n  catch (error) { throw new Error(`El campo \"json\" no contiene JSON válido: ${error.message}`); }\n}\n\nif (typeof d === 'string') {\n  try { d = JSON.parse(d.trim()); }\n  catch (error) { throw new Error(`El OPMX MASTER recibido no contiene JSON válido: ${error.message}`); }\n}\n\nfunction str(v) {\n  return v === null || v === undefined ? '' : String(v).trim();\n}\nfunction arr(v) {\n  if (Array.isArray(v)) return v.map(x => str(x)).filter(Boolean);\n  if (typeof v === 'string' && v.trim()) return v.split(',').map(x => x.trim()).filter(Boolean);\n  return [];\n}\nfunction imageSlugFromUrl(url, label) {\n  if (!url) return '';\n  try {\n    const cleanUrl = String(url).split('?')[0].split('#')[0];\n    const filename = decodeURIComponent(cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1));\n    return filename.replace(/\\.[a-zA-Z0-9]+$/, '').trim();\n  } catch (error) {\n    throw new Error(`No fue posible obtener el nombre de archivo desde ${label}: ${url}`);\n  }\n}\n\nconst SEO = d.SEO ?? d.seo ?? {};\nconst PUB = d.PUBLICACION ?? d.publication ?? {};\n// Contrato v1.2: AUTOR_ID está prohibido en el MASTER.\n// La identidad técnica del autor pertenece al Publisher.\nconst forbiddenAuthorFields = [\n  ['PUBLICACION.AUTOR_ID', PUB.AUTOR_ID],\n  ['PUBLICACION.author_id', PUB.author_id],\n  ['AUTOR_ID', d.AUTOR_ID],\n  ['author_id', d.author_id]\n].filter(([, value]) => value !== undefined && value !== null);\n\nif (forbiddenAuthorFields.length) {\n  throw new Error(\n    'CONTRATO_V1_2_AUTOR_ID_PROHIBIDO: el MASTER no debe contener AUTOR_ID. Campos detectados: ' +\n    forbiddenAuthorFields.map(([name]) => name).join(', ') + '.'\n  );\n}\n\nconst authorId = 3;\nconst authorSource = 'PUBLISHER_OPURO_REDACCION_OPMX';\n\nconst IMAGES = d.IMAGENES ?? d.images ?? {};\n\nconst HERO = IMAGES.HERO_OPURO ?? IMAGES.hero_opuro ?? {};\nconst FEATURED_OPURO = IMAGES.DESTACADA_OPURO ?? IMAGES.featured_opuro ?? {};\nconst FEATURED_OPOL = IMAGES.DESTACADA_OPOL ?? IMAGES.featured_opol ?? {};\n\nconst title = str(SEO.TITULO_SEO ?? d.TEXTO_EDITORIAL?.TITULO ?? d.article?.title);\nconst subtitle = str(SEO.SUBTITULO ?? d.TEXTO_EDITORIAL?.SUBTITULO ?? d.article?.subtitle);\nconst slug = str(SEO.SLUG ?? SEO.slug);\nconst excerpt = str(PUB.EXTRACTO ?? PUB.excerpt ?? SEO.EXTRACTO ?? SEO.excerpt ?? d.TEXTO_EDITORIAL?.ENTRADILLA);\nconst metaDescription = str(SEO.METADESCRIPCION ?? SEO.meta_description ?? excerpt);\nconst primaryKeyword = str(SEO.KEYWORD_PRINCIPAL ?? SEO.primary_keyword);\nconst secondaryKeywords = arr(SEO.KEYWORDS_SECUNDARIAS ?? SEO.secondary_keywords);\nconst keywordsAll = str(SEO.KEYWORDS_TODAS ?? SEO.keywords_todas ?? SEO.all_keywords_string);\nconst keywordsList = arr(SEO.KEYWORDS_TODAS_LISTA ?? SEO.keywords_todas_lista ?? SEO.KEYWORDS_TODAS ?? SEO.all_keywords);\nconst CATS=d.CATEGORIAS??d.categorias??{};\nconst OPUROCAT=CATS.OPURO??CATS.opuro??{};\nconst OPOLCAT=CATS.OPOL??CATS.opol??{};\nconst category=str(OPUROCAT.PRINCIPAL??OPUROCAT.principal??SEO.CATEGORIA??SEO.category);\nconst categoryOpol=str(OPOLCAT.PRINCIPAL??OPOLCAT.principal);\nconst categoryOpolSecondary=str(OPOLCAT.SECUNDARIA??OPOLCAT.secundaria)||null;\nconst tags = arr(SEO.ETIQUETAS ?? SEO.tags);\n\n// v1.2.12 — PREFLIGHT DE CONTRATO v1.2.\n// OPURO valida existencia después contra WordPress por coincidencia exacta de nombre.\n// OPOL conserva el snapshot v1.1 para catálogo y jerarquía padre-hija.\nconst CATEGORY_CATALOG = {\n  schema: \"OPMX_CATEGORY_CATALOG\",\n  schema_version: \"1.1\",\n  generated_at: \"2026-09-24T06:09:53.754Z\",\n  OPOL_ALLOWED: [\"CIENCIA\", \"CONGRESO\", \"DIPUTADOS\", \"SENADORES\", \"CULTURA\", \"DEPORTES\", \"ECONOMÍA\", \"EDUCACIÓN\", \"ESTADOS\", \"BAJA CALIFORNIA\", \"GOBIERNO\", \"INTERNACIONAL\", \"JUSTICIA\", \"MEDIO AMBIENTE\", \"MEGALÓPOLIS\", \"OPINIÓN\", \"POLÍTICA\", \"TECNOLOGÍA\", \"TURISMO\", \"Uncategorized\"],\n  OPOL_CATEGORIES: [{\"name\": \"CIENCIA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"CONGRESO\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"DIPUTADOS\", \"parent_name\": \"CONGRESO\", \"parent_id\": 4}, {\"name\": \"SENADORES\", \"parent_name\": \"CONGRESO\", \"parent_id\": 4}, {\"name\": \"CULTURA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"DEPORTES\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"ECONOMÍA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"EDUCACIÓN\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"ESTADOS\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"BAJA CALIFORNIA\", \"parent_name\": \"ESTADOS\", \"parent_id\": 10}, {\"name\": \"GOBIERNO\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"INTERNACIONAL\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"JUSTICIA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"MEDIO AMBIENTE\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"MEGALÓPOLIS\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"OPINIÓN\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"POLÍTICA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"TECNOLOGÍA\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"TURISMO\", \"parent_name\": null, \"parent_id\": 0}, {\"name\": \"Uncategorized\", \"parent_name\": null, \"parent_id\": 0}]\n};\n\nconst CONTROL = d.CONTROL_EDITORIAL ?? d.control_editorial ?? {};\nconst literalProfileResult=literalProfile.validateLiteralMaster(d,{requestId:envelope.request_id});\nif(!literalProfileResult.ok)throw Error('MASTER_LITERAL_PROFILE_INVALID:'+JSON.stringify(literalProfileResult.errors));\nconst contentMode=literalProfileResult.mode;\nconst controlEstado = str(CONTROL.ESTADO ?? CONTROL.estado).toUpperCase();\n\nif (controlEstado !== 'LISTO') {\n  throw new Error(\n    `CONTROL_EDITORIAL_NO_LISTO: el Publisher sólo admite paquetes con CONTROL_EDITORIAL.ESTADO = LISTO. Valor recibido: \"${controlEstado || '(vacío)'}\".`\n  );\n}\n\nif (execution.create_opuro && !category) {\n  throw new Error('CATEGORIA_OPURO_NO_AUTORIZADA: falta CATEGORIAS.OPURO.PRINCIPAL.');\n}\nif (execution.create_opol && !categoryOpol) {\n  throw new Error('CATEGORIA_OPOL_NO_AUTORIZADA: falta CATEGORIAS.OPOL.PRINCIPAL.');\n}\nif (execution.create_opol && !CATEGORY_CATALOG.OPOL_ALLOWED.includes(categoryOpol)) {\n  throw new Error(\n    `CATEGORIA_OPOL_NO_AUTORIZADA: \"${categoryOpol}\" no existe literalmente en sites.OPOL.allowed_names del catálogo OPMX v${CATEGORY_CATALOG.schema_version}. No se enviará nada a WordPress.`\n  );\n}\n\nif (execution.create_opol && categoryOpolSecondary !== null) {\n  const child = CATEGORY_CATALOG.OPOL_CATEGORIES.find(x => x.name === categoryOpolSecondary);\n  if (!child || Number(child.parent_id) === 0 || child.parent_name !== categoryOpol) {\n    throw new Error(\n      `CATEGORIA_OPOL_JERARQUIA_INVALIDA: \"${categoryOpolSecondary}\" no es hija literal de \"${categoryOpol}\" en el catálogo OPMX v${CATEGORY_CATALOG.schema_version}. No se enviará nada a WordPress.`\n    );\n  }\n}\n\nconst seoCategory = str(SEO.CATEGORIA ?? SEO.category);\nif (execution.create_opuro && seoCategory !== category) {\n  throw new Error(\n    `SEO_CATEGORIA_INCONSISTENTE: SEO.CATEGORIA debe ser idéntica a CATEGORIAS.OPURO.PRINCIPAL. Recibido SEO=\"${seoCategory}\" y OPURO=\"${category}\".`\n  );\n}\n\nconst htmlFinal = str(d.HTML_FINAL ?? d.html_final);\nconst gutenbergFinal = str(d.GUTENBERG_FINAL ?? d.GUTEMBERG_FINAL ?? d.gutenberg_final);\nconst gutenbergEnriquecidoFinal = str(d.GUTENBERG_ENRIQUECIDO_FINAL ?? d.gutenberg_enriquecido_final);\n\nconst heroOpuro = {\n  url: str(HERO.URL ?? HERO.url),\n  alt_text: str(HERO.ALT ?? HERO.alt_text),\n  title: str(HERO.TITULO_IMAGEN ?? HERO.title),\n  caption: str(HERO.LEYENDA ?? HERO.caption),\n  description: str(HERO.DESCRIPCION ?? HERO.description),\n  credit: HERO.CREDITO ?? HERO.credit ?? null,\n  class_name: str(HERO.CLASE_HERO ?? HERO.class_name)\n};\nheroOpuro.slug = '';\nif ((execution.create_opuro || execution.create_liberal) && ((heroOpuro.credit !== null && typeof heroOpuro.credit !== 'string') || subtitle.length > 500 || (typeof heroOpuro.credit === 'string' && heroOpuro.credit.length > 500))) throw new Error('Subtítulo o crédito Hero inválido para metadata editorial.');\n\nconst featuredOpuro = {\n  url: str(FEATURED_OPURO.URL ?? FEATURED_OPURO.url),\n  alt_text: str(FEATURED_OPURO.ALT ?? FEATURED_OPURO.alt_text)\n};\nfeaturedOpuro.slug = '';\n\nconst featuredOpol = {\n  url: str(FEATURED_OPOL.URL ?? FEATURED_OPOL.url),\n  alt_text: str(FEATURED_OPOL.ALT ?? FEATURED_OPOL.alt_text)\n};\nfeaturedOpol.slug = '';\n\n// v1.1.6 — validación condicionada por destino.\n// Los campos editoriales comunes siguen siendo obligatorios.\n// Los artefactos y medios específicos sólo se exigen si ese destino será creado.\n\nconst commonRequired = {\n  title,\n  slug,\n  excerpt,\n  primaryKeyword,\n  tags\n};\n\nif (execution.create_opuro) {\n  commonRequired.category = category;\n}\nif (execution.create_opol) {\n  commonRequired.categoryOpol = categoryOpol;\n}\n\nconst commonMissing = Object.entries(commonRequired)\n  .filter(([, v]) => Array.isArray(v) ? v.length === 0 : !v)\n  .map(([k]) => k);\n\nif (commonMissing.length) {\n  throw new Error(`OPMX MASTER incompleto para ${execution.destination}. Faltan campos comunes/seleccionados: ${commonMissing.join(', ')}`);\n}\n\nif (execution.create_opuro || execution.create_liberal) {\n  const requiredOpuro = {\n    gutenbergEnriquecidoFinal,\n    heroOpuroUrl: heroOpuro.url,\n    featuredOpuroUrl: featuredOpuro.url,\n    featuredOpuroAlt: featuredOpuro.alt_text\n  };\n\n  const missingOpuro = Object.entries(requiredOpuro)\n    .filter(([, v]) => !v)\n    .map(([k]) => k);\n\n  if (missingOpuro.length) {\n    throw new Error(`OPMX MASTER incompleto para Oxígeno Puro. Faltan: ${missingOpuro.join(', ')}`);\n  }\n\n  if (!/<!--\\s*wp:[a-z0-9/-]+/i.test(gutenbergEnriquecidoFinal)) {\n    throw new Error('GUTENBERG_ENRIQUECIDO_FINAL es obligatorio para OPURO y debe contener bloques Gutenberg serializados.');\n  }\n\n  const forbiddenEnriched = [\n    /opmx-editorial/i, /data-opmx/i, /<!--\\s*wp:html/i,\n    /<\\/?(?:article|header|footer)\\b/i, /<h1\\b/i, /\\{\\{[^}]+\\}\\}/\n  ];\n  if (forbiddenEnriched.some(rx => rx.test(gutenbergEnriquecidoFinal))) {\n    throw new Error('GUTENBERG_ENRIQUECIDO_FINAL contiene un marcador, wrapper o placeholder no permitido.');\n  }\n\n  const allowedBlocks = new Set(['paragraph', 'heading', 'list', 'list-item', 'quote', 'image']);\n  const blockNames = [...gutenbergEnriquecidoFinal.matchAll(/<!--\\s*\\/?wp:([a-z0-9/-]+)/gi)].map(match => match[1].replace(/^core\\//, ''));\n  if (!blockNames.length || blockNames.some(name => !allowedBlocks.has(name))) {\n    throw new Error(`GUTENBERG_ENRIQUECIDO_FINAL usa bloques no autorizados: ${[...new Set(blockNames.filter(name => !allowedBlocks.has(name)))].join(', ') || '(sin bloques)'}.`);\n  }\n  if (/<!--\\s*wp:image/i.test(gutenbergEnriquecidoFinal)) {\n    if (!/\\bwp-image-\\d+\\b/i.test(gutenbergEnriquecidoFinal) || !/\\balt=(['\"]).*?\\1/i.test(gutenbergEnriquecidoFinal)) {\n      throw new Error('Todo core/image enriquecido debe usar un adjunto nativo wp-image-{id} y conservar ALT literal.');\n    }\n  }\n\n  if (heroOpuro.url !== '{{OPMX:HERO_OPURO}}') {\n    throw new Error(`HERO_OPURO.URL debe ser exactamente {{OPMX:HERO_OPURO}}. Valor recibido: ${heroOpuro.url}`);\n  }\n  if (featuredOpuro.url !== '{{OPMX:DESTACADA_OPURO}}') {\n    throw new Error(`DESTACADA_OPURO.URL debe ser exactamente {{OPMX:DESTACADA_OPURO}}. Valor recibido: ${featuredOpuro.url}`);\n  }\n  if (!binary.hero_file) throw new Error('Falta el archivo HERO (hero_file) para OPURO.');\n  if (!binary.featured_file) throw new Error('Falta el archivo DESTACADA (featured_file) para OPURO.');\n}\n\nif (execution.create_opol) {\n  const requiredOpol = {\n    gutenbergFinal,\n    featuredOpolUrl: featuredOpol.url,\n    featuredOpolAlt: featuredOpol.alt_text\n  };\n\n  const missingOpol = Object.entries(requiredOpol)\n    .filter(([, v]) => !v)\n    .map(([k]) => k);\n\n  if (missingOpol.length) {\n    throw new Error(`OPMX MASTER incompleto para OXígeno Político. Faltan: ${missingOpol.join(', ')}`);\n  }\n\n  if (!/<!--\\s*wp:[a-z0-9/-]+/i.test(gutenbergFinal)) {\n    throw new Error('GUTENBERG_FINAL es obligatorio para OPOL y debe contener bloques Gutenberg reales.');\n  }\n\n  if (featuredOpol.url !== '{{OPMX:DESTACADA_OPOL}}') {\n    throw new Error(`DESTACADA_OPOL.URL debe ser exactamente {{OPMX:DESTACADA_OPOL}}. Valor recibido: ${featuredOpol.url}`);\n  }\n  if (!binary.featured_file) throw new Error('Falta el archivo DESTACADA (featured_file) para OPOL.');\n}\n\nconst liberalCategory=str(CATS.LIBERAL?.PRINCIPAL??CATS.LIBERAL?.principal??CATS.liberal?.PRINCIPAL??CATS.liberal?.principal);\nif(execution.create_liberal){\n if(!liberalCategory)throw Error('Falta CATEGORIAS.LIBERAL.PRINCIPAL');\n // Inline attachment IDs belong to one CMS. Never copy OPURO IDs into LIBERAL.\n if(/<!--\\s*wp:image\\b/i.test(gutenbergEnriquecidoFinal))throw Error('LIBERAL: los bloques core/image internos requieren adjuntos nativos propios; este transporte admite Hero y destacada. No se inició ninguna escritura.');\n}\n\nexecution.request_id=envelope.request_id;\nconst normalized={\n  json: {\n    execution,\n    canonical: {\n      content_mode:contentMode,\n      title,\n      subtitle,\n      slug,\n      excerpt,\n      meta_description: metaDescription,\n      primary_keyword: primaryKeyword,\n      secondary_keywords: secondaryKeywords,\n      keywords_all: keywordsAll || [primaryKeyword, ...secondaryKeywords].filter(Boolean).join(', '),\n      keywords_list: keywordsList.length ? keywordsList : [primaryKeyword, ...secondaryKeywords].filter(Boolean),\n      keywords: keywordsList.length ? keywordsList : [primaryKeyword, ...secondaryKeywords].filter(Boolean),\n      category,\n      categories:{opuro:{principal:category},opol:{principal:categoryOpol,secundaria:categoryOpolSecondary}},\n      tags,\n      html_final: htmlFinal,\n      gutenberg_final: gutenbergFinal,\n      gutenberg_enriquecido_final: gutenbergEnriquecidoFinal,\n      images: {\n        hero_opuro: heroOpuro,\n        featured_opuro: featuredOpuro,\n        featured_opol: featuredOpol\n      },\n      status: 'READY_FOR_SELECTED_DRAFTS',\n      ...(execution.create_liberal?{author_liberal:{id:3,source:'PUBLISHER_LIBERAL_REDACCION_ID_3'},gutenberg_liberal:gutenbergEnriquecidoFinal}:{}),\n      author: {\n        id: authorId,\n        source: authorSource\n      }\n    },\n    original: d\n  },\n  binary\n};\n\n\nif(execution.create_liberal){normalized.json.canonical.categories.liberal={principal:liberalCategory};normalized.json.canonical.images.hero_liberal={...heroOpuro};normalized.json.canonical.images.featured_liberal={...featuredOpuro};}\nreturn normalized;\n\n}\nconst p=$input.first().json,r=$('Protocolo MCP archivos').first().json.request;const semantic_preflight=await validatePublisherMasterStatically(p,r,{prepare:sharedPrepare,normalize:sharedNormalize},{\"workflowId\":\"4o7K5TmKc7joScqB\",\"versionId\":\"4263fea4-90a4-406d-a234-da7397d456bf\",\"prepareSha256\":\"8db8e0c0aaafd824450551a91b174c073a02d2da4c7c8c5c4069a22766add645\",\"normalizerSha256\":\"710a625882e6ffcdf05a4ff694d1475b07b60a068006702a76ff7ace84bb6b5c\"});return [{json:{...p,semantic_preflight}}];"
      },
      "position": [
        482,
        400
      ],
      "typeVersion": 2
    }
  ],
  "connections": {
    "Protocolo MCP archivos": {
      "main": [
        [
          {
            "node": "¿Notificación MCP?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Notificación MCP?": {
      "main": [
        [
          {
            "node": "Aceptar notificación",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "¿Gestionar intento Motor?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "MCP Publisher GET": {
      "main": [
        [
          {
            "node": "Sin stream GET",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Solicitud con archivos?": {
      "main": [
        [
          {
            "node": "Descargar MASTER",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Descargar MASTER": {
      "main": [
        [
          {
            "node": "Comprobar MASTER",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Archivo rechazado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Comprobar MASTER": {
      "main": [
        [
          {
            "node": "Literal archivos — Preparar control",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Archivo rechazado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Descargar destacada": {
      "main": [
        [
          {
            "node": "Comprobar destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Archivo rechazado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Comprobar destacada": {
      "main": [
        [
          {
            "node": "¿Requiere Hero?",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Archivo rechazado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Requiere Hero?": {
      "main": [
        [
          {
            "node": "Descargar Hero",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "MASTER — Validación estática Shared",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Descargar Hero": {
      "main": [
        [
          {
            "node": "Comprobar Hero",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Archivo rechazado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Comprobar Hero": {
      "main": [
        [
          {
            "node": "MASTER — Validación estática Shared",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Archivo rechazado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Crear borradores?": {
      "main": [
        [
          {
            "node": "Entregar paquete sin enlaces",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Resultado validación archivos",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publisher protegido existente": {
      "main": [
        [
          {
            "node": "¿Publicar nota nueva?",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publisher resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar publicación verificada": {
      "main": [
        [
          {
            "node": "Conservar plan publicación",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación rechazada antes de publicar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar publicación existente": {
      "main": [
        [
          {
            "node": "Conservar plan publicación",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación rechazada antes de publicar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Conservar plan publicación": {
      "main": [
        [
          {
            "node": "¿Preflight publicación OPURO?",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación rechazada antes de publicar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preflight conjunto publicación": {
      "main": [
        [
          {
            "node": "Preparar barrera publicación",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación rechazada antes de publicar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Evaluar OPURO": {
      "main": [
        [
          {
            "node": "Conservar publicación OPURO",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Omitir OPURO": {
      "main": [
        [
          {
            "node": "Conservar publicación OPURO",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Conservar publicación OPURO": {
      "main": [
        [
          {
            "node": "¿Publicar OPOL?",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Evaluar OPOL": {
      "main": [
        [
          {
            "node": "Conservar publicación OPOL",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Omitir OPOL": {
      "main": [
        [
          {
            "node": "Conservar publicación OPOL",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Visibilidad OPURO": {
      "main": [
        [
          {
            "node": "Conservar visibilidad OPURO",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Sin web OPURO": {
      "main": [
        [
          {
            "node": "Conservar visibilidad OPURO",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Conservar visibilidad OPURO": {
      "main": [
        [
          {
            "node": "Resultado publicación MCP",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado publicación MCP": {
      "main": [
        [
          {
            "node": "Acuse PUBLISH — Preparar",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Publicar nota nueva?": {
      "main": [
        [
          {
            "node": "Preparar publicación verificada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Resultado Publisher MCP",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Publicar borradores existentes?": {
      "main": [
        [
          {
            "node": "Preparar publicación existente",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "¿Solicitud con archivos?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Preflight publicación OPURO?": {
      "main": [
        [
          {
            "node": "Publicación — Guard OPURO",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "¿Preflight publicación OPOL?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Guard OPURO": {
      "main": [
        [
          {
            "node": "Publicación — Preflight OPURO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Preflight OPURO": {
      "main": [
        [
          {
            "node": "¿Preflight publicación OPOL?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Preflight publicación OPOL?": {
      "main": [
        [
          {
            "node": "Publicación — Guard OPOL",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "¿Preflight publicación LIBERAL?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Guard OPOL": {
      "main": [
        [
          {
            "node": "Publicación — Preflight OPOL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Preflight OPOL": {
      "main": [
        [
          {
            "node": "Publicación — Categoría OPOL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Publicar OPURO?": {
      "main": [
        [
          {
            "node": "Publicación — Publicar OPURO",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación — Omitir OPURO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Publicar OPURO": {
      "main": [
        [
          {
            "node": "Publicación — Confirmar OPURO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Confirmar OPURO": {
      "main": [
        [
          {
            "node": "Publicación — Evaluar OPURO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Publicar OPOL?": {
      "main": [
        [
          {
            "node": "Publicación — Publicar OPOL",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación — Omitir OPOL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Publicar OPOL": {
      "main": [
        [
          {
            "node": "Publicación — Confirmar OPOL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Confirmar OPOL": {
      "main": [
        [
          {
            "node": "Publicación — Evaluar OPOL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Verificar web OPURO?": {
      "main": [
        [
          {
            "node": "Publicación — Revalidar OPURO",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación — Sin web OPURO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Leer fuente Telegram?": {
      "main": [
        [
          {
            "node": "Leer fuente privada desde guard",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "¿Publicar borradores existentes?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Leer fuente privada desde guard": {
      "main": [
        [
          {
            "node": "Formatear fuente privada MCP",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Suscripción evento Telegram?": {
      "main": [
        [
          {
            "node": "Gestionar evento privado guard",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "¿Leer fuente Telegram?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gestionar evento privado guard": {
      "main": [
        [
          {
            "node": "Formatear suscripción evento MCP",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Informar revisión Telegram?": {
      "main": [
        [
          {
            "node": "Reservar informe Telegram guard",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "¿Suscripción evento Telegram?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Reservar informe Telegram guard": {
      "main": [
        [
          {
            "node": "¿Enviar informe Telegram?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Enviar informe Telegram?": {
      "main": [
        [
          {
            "node": "Enviar revisión privada Telegram",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Resultado revisión privada MCP",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Enviar revisión privada Telegram": {
      "main": [
        [
          {
            "node": "Verificar acuse revisión Telegram",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Verificar acuse revisión Telegram": {
      "main": [
        [
          {
            "node": "Confirmar informe Telegram guard",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Confirmar informe Telegram guard": {
      "main": [
        [
          {
            "node": "Resultado revisión privada MCP",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado Publisher MCP": {
      "main": [
        [
          {
            "node": "Preparar aviso de borrador Telegram",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar aviso de borrador Telegram": {
      "main": [
        [
          {
            "node": "¿Avisar borrador por Telegram?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Avisar borrador por Telegram?": {
      "main": [
        [
          {
            "node": "Enviar enlaces de borrador Telegram",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Pasar respuesta Publisher sin aviso",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Enviar enlaces de borrador Telegram": {
      "main": [
        [
          {
            "node": "Confirmar aviso borrador Telegram",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Informar bloqueo Telegram?": {
      "main": [
        [
          {
            "node": "Consultar paquete para bloqueo",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "¿Informar revisión Telegram?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Consultar paquete para bloqueo": {
      "main": [
        [
          {
            "node": "Preparar aviso de bloqueo",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar aviso de bloqueo": {
      "main": [
        [
          {
            "node": "¿Enviar aviso de bloqueo?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Enviar aviso de bloqueo?": {
      "main": [
        [
          {
            "node": "Enviar bloqueo privado Telegram",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Bloqueo no confirmado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Enviar bloqueo privado Telegram": {
      "main": [
        [
          {
            "node": "Resultado de bloqueo Telegram",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado de bloqueo Telegram": {
      "main": [
        [
          {
            "node": "Preparar registro de avance",
            "type": "main",
            "index": 0
          },
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar aviso de publicación Telegram": {
      "main": [
        [
          {
            "node": "¿Avisar publicación por Telegram?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Avisar publicación por Telegram?": {
      "main": [
        [
          {
            "node": "Enviar resultado publicación Telegram",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Pasar resultado publicación sin aviso",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Enviar resultado publicación Telegram": {
      "main": [
        [
          {
            "node": "Confirmar aviso publicación Telegram",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Confirmar aviso publicación Telegram": {
      "main": [
        [
          {
            "node": "Preparar copia administrativa de publicación",
            "type": "main",
            "index": 0
          },
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar registro de avance": {
      "main": [
        [
          {
            "node": "Registrar avance editorial",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Revalidar OPURO": {
      "main": [
        [
          {
            "node": "Publicación — Visibilidad OPURO",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "MCP Publisher POST": {
      "main": [
        [
          {
            "node": "Preparar búsqueda de remitente",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar búsqueda de remitente": {
      "main": [
        [
          {
            "node": "Consultar registro de remitente",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Consultar registro de remitente": {
      "main": [
        [
          {
            "node": "Resolver identidad de solicitud",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resolver identidad de solicitud": {
      "main": [
        [
          {
            "node": "Protocolo MCP archivos",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Conservar publicación LIBERAL": {
      "main": [
        [
          {
            "node": "¿Verificar web OPURO?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Conservar publicación OPOL": {
      "main": [
        [
          {
            "node": "¿Publicar LIBERAL?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Categoría OPOL": {
      "main": [
        [
          {
            "node": "¿Preflight publicación LIBERAL?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Confirmar LIBERAL": {
      "main": [
        [
          {
            "node": "Publicación — Evaluar LIBERAL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Evaluar LIBERAL": {
      "main": [
        [
          {
            "node": "Conservar publicación LIBERAL",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Guard LIBERAL": {
      "main": [
        [
          {
            "node": "Publicación — Preflight LIBERAL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Omitir LIBERAL": {
      "main": [
        [
          {
            "node": "Conservar publicación LIBERAL",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación resultado incierto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Preflight LIBERAL": {
      "main": [
        [
          {
            "node": "Preflight conjunto publicación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Publicar LIBERAL": {
      "main": [
        [
          {
            "node": "Publicación — Confirmar LIBERAL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Preflight publicación LIBERAL?": {
      "main": [
        [
          {
            "node": "Publicación — Guard LIBERAL",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Preflight conjunto publicación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Publicar LIBERAL?": {
      "main": [
        [
          {
            "node": "Publicación — Publicar LIBERAL",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación — Omitir LIBERAL",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar copia administrativa de publicación": {
      "main": [
        [
          {
            "node": "Enviar publicación al administrador",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Enviar publicación al administrador": {
      "main": [
        [
          {
            "node": "Registrar acuse administrativo",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Gestionar intento Motor?": {
      "main": [
        [
          {
            "node": "Gestionar intento Motor guard",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "¿Entregar vista Motor?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gestionar intento Motor guard": {
      "main": [
        [
          {
            "node": "Resultado intento Motor MCP",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Entregar vista Motor?": {
      "main": [
        [
          {
            "node": "Materializar vista Motor",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "¿Informar bloqueo Telegram?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Materializar vista Motor": {
      "main": [
        [
          {
            "node": "Identidad vista Motor",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Identidad vista Motor": {
      "main": [
        [
          {
            "node": "¿Vista Motor lista?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Vista Motor lista?": {
      "main": [
        [
          {
            "node": "Inicializar entrega Motor",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Vista Motor no confirmada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Inicializar entrega Motor": {
      "main": [
        [
          {
            "node": "Siguiente parte Motor",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Siguiente parte Motor": {
      "main": [
        [
          {
            "node": "¿Reclamar parte Motor?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Reclamar parte Motor?": {
      "main": [
        [
          {
            "node": "Reclamar parte Motor",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Vista Motor no confirmada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Reclamar parte Motor": {
      "main": [
        [
          {
            "node": "Preparar parte Motor",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar parte Motor": {
      "main": [
        [
          {
            "node": "¿Enviar parte Motor?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Enviar parte Motor?": {
      "main": [
        [
          {
            "node": "Enviar vista Motor Telegram",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "¿Vista Motor completa?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Vista Motor completa?": {
      "main": [
        [
          {
            "node": "Resultado vista Motor",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Vista Motor no confirmada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Enviar vista Motor Telegram": {
      "main": [
        [
          {
            "node": "Acusar parte Motor",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Acusar parte Motor": {
      "main": [
        [
          {
            "node": "¿Acuse Motor válido?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Acuse Motor válido?": {
      "main": [
        [
          {
            "node": "Registrar parte Motor",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Vista Motor no confirmada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Registrar parte Motor": {
      "main": [
        [
          {
            "node": "Siguiente parte Motor",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar barrera publicación": {
      "main": [
        [
          {
            "node": "¿Reclamar publicación Telegram?",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación — Reclamo no confirmado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Reclamar publicación Telegram?": {
      "main": [
        [
          {
            "node": "Reclamar publicación Telegram",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Conservar publicación sin reclamo",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Reclamar publicación Telegram": {
      "main": [
        [
          {
            "node": "Publicación — Reclamo confirmado",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación — Reclamo no confirmado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Reclamo confirmado": {
      "main": [
        [
          {
            "node": "¿Publicar OPURO?",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación — Reclamo no confirmado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Conservar publicación sin reclamo": {
      "main": [
        [
          {
            "node": "¿Publicar OPURO?",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Publicación — Reclamo no confirmado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Acuse PUBLISH — Preparar": {
      "main": [
        [
          {
            "node": "Acuse PUBLISH — ¿Registrar?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Acuse PUBLISH — ¿Registrar?": {
      "main": [
        [
          {
            "node": "Acuse PUBLISH — Guard",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Acuse PUBLISH — Conservar resultado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Acuse PUBLISH — Guard": {
      "main": [
        [
          {
            "node": "Acuse PUBLISH — Conservar resultado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Acuse PUBLISH — Conservar resultado": {
      "main": [
        [
          {
            "node": "Preparar aviso de publicación Telegram",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Literal archivos — Preparar control": {
      "main": [
        [
          {
            "node": "Literal archivos — ¿Verificar texto?",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Archivo rechazado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Literal archivos — ¿Verificar texto?": {
      "main": [
        [
          {
            "node": "Literal archivos — Comprobar texto Guard",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Literal archivos — Conservar validación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Literal archivos — Comprobar texto Guard": {
      "main": [
        [
          {
            "node": "Literal archivos — Conservar validación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Literal archivos — Conservar validación": {
      "main": [
        [
          {
            "node": "Descargar destacada",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Archivo rechazado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Entregar paquete sin enlaces": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar aceptación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — Preparar aceptación": {
      "main": [
        [
          {
            "node": "Envío Telegram — ¿Aceptar en segundo plano?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — ¿Aceptar en segundo plano?": {
      "main": [
        [
          {
            "node": "Envío Telegram — Huella del contenido",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Envío Telegram — Recuperar paquete",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — Huella del contenido": {
      "main": [
        [
          {
            "node": "Envío Telegram — Conservar huella",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — Conservar huella": {
      "main": [
        [
          {
            "node": "Envío Telegram — Registrar aceptación Guard",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — Registrar aceptación Guard": {
      "main": [
        [
          {
            "node": "Envío Telegram — Verificar aceptación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — Verificar aceptación": {
      "main": [
        [
          {
            "node": "Envío Telegram — ¿Responder aceptación registrada?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — ¿Responder aceptación registrada?": {
      "main": [
        [
          {
            "node": "Envío Telegram — Responder aceptación",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Envío Telegram — Recuperar paquete",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — Responder aceptación": {
      "main": [
        [
          {
            "node": "Envío Telegram — ¿Continuar escritor?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — ¿Continuar escritor?": {
      "main": [
        [
          {
            "node": "Envío Telegram — Recuperar paquete",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — Recuperar paquete": {
      "main": [
        [
          {
            "node": "Publisher protegido existente",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado validación archivos": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Archivo rechazado": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publisher resultado incierto": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación rechazada antes de publicar": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación resultado incierto": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Formatear fuente privada MCP": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Formatear suscripción evento MCP": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado revisión privada MCP": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Confirmar aviso borrador Telegram": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Pasar respuesta Publisher sin aviso": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Bloqueo no confirmado": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Pasar resultado publicación sin aviso": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado intento Motor MCP": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resultado vista Motor": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Vista Motor no confirmada": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Publicación — Reclamo no confirmado": {
      "main": [
        [
          {
            "node": "Envío Telegram — Preparar resultado durable",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — Preparar resultado durable": {
      "main": [
        [
          {
            "node": "Envío Telegram — ¿Registrar resultado?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — ¿Registrar resultado?": {
      "main": [
        [
          {
            "node": "Envío Telegram — Registrar resultado Guard",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Responder MCP",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Envío Telegram — Registrar resultado Guard": {
      "main": [
        [
          {
            "node": "Envío Telegram — Terminar respuesta aceptada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "MASTER — Validación estática Shared": {
      "main": [
        [
          {
            "node": "¿Crear borradores?",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Archivo rechazado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
};
