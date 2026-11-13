// Static validation runs before acceptance, reservations, media or CMS calls.
// The two implementations are snapshots of the actual pinned Shared Code
// nodes, invoked with metadata-only binary helpers. No n8n storage is used.
export function classifyPublisherMasterError(error) {
 const message=typeof error?.message==='string'?error.message:typeof error==='string'?error:'';
 const exact={
  'Falta request_id estable y válido':['REQUEST_ID',['request_id']],
  'Falta MASTER como objeto JSON':['MASTER_OBJECT',['MASTER']],
  'Esta prueba sólo admite PUBLICAR=false':['DRAFT_TRANSPORT',['PUBLICAR']],
  'Destino inválido':['DESTINATION',['destino']],
  'Destino vacío entre comas':['DESTINATION',['destino']],
  'Subtítulo o crédito Hero inválido para metadata editorial.':['HERO_METADATA',['SEO.SUBTITULO','IMAGENES.HERO_OPURO.CREDITO']],
  'Falta CATEGORIAS.LIBERAL.PRINCIPAL':['LIBERAL_CATEGORY',['CATEGORIAS.LIBERAL.PRINCIPAL']],
  'Falta el archivo HERO (hero_file) para OPURO.':['HERO_FILE',['hero_file']],
  'Falta el archivo DESTACADA (featured_file) para OPURO.':['FEATURED_FILE',['featured_file']],
  'Falta el archivo DESTACADA (featured_file) para OPOL.':['FEATURED_FILE',['featured_file']],
 };
 const prefixes=[
  ['OPURO_CATEGORY_HOME_','OPURO_CATEGORY_HOME',['PUBLICACION.OPURO.EXCLUIR_PORTADA_CATEGORIAS_IDS']],
  ['CONTRATO_V1_2_AUTOR_ID_PROHIBIDO:','AUTHOR_ID',['PUBLICACION.AUTOR_ID']],
  ['MASTER_LITERAL_PROFILE_INVALID:','LITERAL_PROFILE',['CONTROL_EDITORIAL.LITERAL']],
  ['CONTROL_EDITORIAL_NO_LISTO:','EDITORIAL_STATE',['CONTROL_EDITORIAL.ESTADO']],
  ['CATEGORIA_OPURO_NO_AUTORIZADA:','OPURO_CATEGORY',['CATEGORIAS.OPURO.PRINCIPAL']],
  ['CATEGORIA_OPOL_NO_AUTORIZADA:','OPOL_CATEGORY',['CATEGORIAS.OPOL.PRINCIPAL']],
  ['CATEGORIA_OPOL_JERARQUIA_INVALIDA:','OPOL_HIERARCHY',['CATEGORIAS.OPOL.SECUNDARIA']],
  ['SEO_CATEGORIA_INCONSISTENTE:','SEO_CATEGORY',['SEO.CATEGORIA']],
  ['GUTENBERG_ENRIQUECIDO_FINAL es obligatorio','ENRICHED_BLOCKS',['GUTENBERG_ENRIQUECIDO_FINAL']],
  ['GUTENBERG_ENRIQUECIDO_FINAL contiene','ENRICHED_CONTENT',['GUTENBERG_ENRIQUECIDO_FINAL']],
  ['GUTENBERG_ENRIQUECIDO_FINAL usa bloques','ENRICHED_BLOCKS',['GUTENBERG_ENRIQUECIDO_FINAL']],
  ['Todo core/image enriquecido debe','ENRICHED_IMAGE',['GUTENBERG_ENRIQUECIDO_FINAL']],
  ['HERO_OPURO.URL debe ser exactamente','HERO_PLACEHOLDER',['IMAGENES.HERO_OPURO.URL']],
  ['DESTACADA_OPURO.URL debe ser exactamente','FEATURED_PLACEHOLDER',['IMAGENES.DESTACADA_OPURO.URL']],
  ['GUTENBERG_FINAL es obligatorio','OPOL_BLOCKS',['GUTENBERG_FINAL']],
  ['DESTACADA_OPOL.URL debe ser exactamente','OPOL_PLACEHOLDER',['IMAGENES.DESTACADA_OPOL.URL']],
  ['LIBERAL: los bloques core/image internos','LIBERAL_INLINE_IMAGE',['GUTENBERG_ENRIQUECIDO_FINAL']],
  ['Destino desconocido:','DESTINATION',['destino']],
 ];
 let found=exact[message]??prefixes.find(([prefix])=>message.startsWith(prefix))?.slice(1);
 const image=/^(?:Imagen inválida o ausente|Formato no admitido): (hero_file|featured_file)$/.exec(message);
 if(image)found=['IMAGE_FILE',[image[1]]];
 const missing=/^OPMX MASTER incompleto para (?:OPURO|OPOL|LIBERAL|AMBOS|TODOS|OPURO,LIBERAL|OPOL,LIBERAL)\. Faltan campos comunes\/seleccionados: ([A-Za-z, ]+)$/.exec(message);
 const selected=/^OPMX MASTER incompleto para (?:Oxígeno Puro|OXígeno Político)\. Faltan: ([A-Za-z, ]+)$/.exec(message);
 if(missing||selected){
  const fields={title:'SEO.TITULO_SEO',slug:'SEO.SLUG',excerpt:'PUBLICACION.EXTRACTO',primaryKeyword:'SEO.KEYWORD_PRINCIPAL',tags:'SEO.ETIQUETAS',category:'CATEGORIAS.OPURO.PRINCIPAL',categoryOpol:'CATEGORIAS.OPOL.PRINCIPAL',gutenbergEnriquecidoFinal:'GUTENBERG_ENRIQUECIDO_FINAL',heroOpuroUrl:'IMAGENES.HERO_OPURO.URL',featuredOpuroUrl:'IMAGENES.DESTACADA_OPURO.URL',featuredOpuroAlt:'IMAGENES.DESTACADA_OPURO.ALT',gutenbergFinal:'GUTENBERG_FINAL',featuredOpolUrl:'IMAGENES.DESTACADA_OPOL.URL',featuredOpolAlt:'IMAGENES.DESTACADA_OPOL.ALT'};
  const keys=(missing??selected)[1].split(',').map(x=>x.trim());
  if(keys.length&&keys.every(k=>Object.hasOwn(fields,k)))found=['REQUIRED_FIELDS',keys.map(k=>fields[k])];
 }
 return found?{status:'VALIDATION_FAILED',code:found[0],fields:found[1],writesStarted:false,retryPermitted:false}:{status:'FILES_REJECTED',code:'STATIC_PREFLIGHT_UNCONFIRMED',fields:[],writesStarted:false,retryPermitted:false};
}

export async function validatePublisherMasterStatically(input,request,implementations,pin) {
 const failed=error=>({ok:false,...classifyPublisherMasterError(error)});
 if(!input||!input.payload||typeof request?.operation!=='string'||!['validar_archivos_opmx','preparar_borrador_opmx','publicar_nota_opmx'].includes(request.operation)||typeof implementations?.prepare!=='function'||typeof implementations?.normalize!=='function')return failed('PREFLIGHT_CONTEXT_UNCONFIRMED');
 const payload=input.payload;
 let local;
 try{local=JSON.parse(JSON.stringify(payload))}catch{return failed('PREFLIGHT_CONTEXT_UNCONFIRMED')}
 if(!local.master||typeof local.master!=='object'||Array.isArray(local.master))return failed('Falta MASTER como objeto JSON');
 // validar_archivos has no external request_id parameter. This sentinel is
 // local syntax input only; it never changes the MASTER or transmitted payload
 // and is not a binding, acceptance, hash or permission. LITERAL instead uses
 // the exact original scope already authenticated by its Guard preflight.
 if(request.operation==='validar_archivos_opmx'&&(request.request_id===null||request.request_id===undefined)){
  const declared=local.master?.CONTROL_EDITORIAL?.MODO_CONTENIDO;
  const original=declared==='LITERAL'?local.master?.CONTROL_EDITORIAL?.LITERAL?.REQUEST_ID:null;
  if(declared==='LITERAL'&&!/^tg_[a-f0-9]{64}$/.test(original??''))return failed('MASTER_LITERAL_PROFILE_INVALID:SCOPE');
  local.request_id=original??'opmx_static_preflight_no_write';
 }else if(typeof request.request_id!=='string'||payload.request_id!==request.request_id)return failed('Falta request_id estable y válido');
 if(typeof local.master?.SEO?.SLUG!=='string'||local.master.SEO.SLUG.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(local.master.SEO.SLUG))return {ok:false,status:'VALIDATION_FAILED',code:'SLUG_FORMAT',fields:['SEO.SLUG'],writesStarted:false,retryPermitted:false};
 const io={helpers:{
  async prepareBinaryData(buffer,fileName,mimeType){return {fileName,mimeType,data:'STATIC_PREFLIGHT_METADATA_ONLY',fileSize:buffer.length}},
  async getBinaryDataBuffer(){throw Error('PREFLIGHT_BINARY_READ_NOT_PERMITTED')},
 }};
 try{
  const prepared=await implementations.prepare.call(io,local,{item:{binary:{}}});
  if(!prepared?.json||!prepared.binary)throw Error('PREFLIGHT_PREPARATION_UNCONFIRMED');
  const normalized=await implementations.normalize.call(io,prepared.json,{item:prepared});
  if(!normalized?.json?.canonical||!normalized.json.execution||normalized.json.canonical.status!=='READY_FOR_SELECTED_DRAFTS')throw Error('PREFLIGHT_NORMALIZATION_UNCONFIRMED');
  return {ok:true,status:'MASTER_SEMANTICS_VALIDATED',scope:'STATIC_MASTER_AND_VERIFIED_IMAGE_BYTES',shared_workflow_id:pin.workflowId,shared_version_id:pin.versionId,prepare_sha256:pin.prepareSha256,normalizer_sha256:pin.normalizerSha256,live_cms_checks:'NOT_CHECKED',placement_authority:'NOT_CHECKED',request_binding:'NOT_CHECKED',writesStarted:false,retryPermitted:false};
 }catch(error){return failed(error)}
}

export function semanticPreflightResponse(request,result) {
 const semantic=result?.semantic_preflight;
 const allowedFields=['PUBLICACION.OPURO.EXCLUIR_PORTADA_CATEGORIAS_IDS','request_id','MASTER','PUBLICAR','destino','SEO.SUBTITULO','IMAGENES.HERO_OPURO.CREDITO','CATEGORIAS.LIBERAL.PRINCIPAL','hero_file','featured_file','PUBLICACION.AUTOR_ID','CONTROL_EDITORIAL.LITERAL','CONTROL_EDITORIAL.ESTADO','CATEGORIAS.OPURO.PRINCIPAL','CATEGORIAS.OPOL.PRINCIPAL','CATEGORIAS.OPOL.SECUNDARIA','SEO.CATEGORIA','GUTENBERG_ENRIQUECIDO_FINAL','IMAGENES.HERO_OPURO.URL','IMAGENES.DESTACADA_OPURO.URL','GUTENBERG_FINAL','IMAGENES.DESTACADA_OPOL.URL','SEO.TITULO_SEO','SEO.SLUG','PUBLICACION.EXTRACTO','SEO.KEYWORD_PRINCIPAL','SEO.ETIQUETAS','IMAGENES.DESTACADA_OPURO.ALT','IMAGENES.DESTACADA_OPOL.ALT'];
 const allowedCodes=['OPURO_CATEGORY_HOME','REQUEST_ID','MASTER_OBJECT','DRAFT_TRANSPORT','DESTINATION','HERO_METADATA','LIBERAL_CATEGORY','HERO_FILE','FEATURED_FILE','AUTHOR_ID','LITERAL_PROFILE','EDITORIAL_STATE','OPURO_CATEGORY','OPOL_CATEGORY','OPOL_HIERARCHY','SEO_CATEGORY','ENRICHED_BLOCKS','ENRICHED_CONTENT','ENRICHED_IMAGE','HERO_PLACEHOLDER','FEATURED_PLACEHOLDER','OPOL_BLOCKS','OPOL_PLACEHOLDER','LIBERAL_INLINE_IMAGE','IMAGE_FILE','REQUIRED_FIELDS','SLUG_FORMAT'];
 const valid=semantic?.ok===false&&semantic.status==='VALIDATION_FAILED'&&semantic.writesStarted===false&&semantic.retryPermitted===false&&allowedCodes.includes(semantic.code)&&Array.isArray(semantic.fields)&&semantic.fields.length>0&&semantic.fields.every(x=>allowedFields.includes(x));
 const response=valid?{status:'VALIDATION_FAILED',code:semantic.code,field:semantic.fields[0],fields:semantic.fields,message:'El MASTER no cumple las validaciones estáticas del destino. Corrige los campos indicados.',writesStarted:false,retryPermitted:false}:{status:'FILES_REJECTED',code:'STATIC_PREFLIGHT_UNCONFIRMED',message:'La validación previa no pudo confirmarse; no se inició el envío a Publisher.',writesStarted:false,retryPermitted:false};
 if(typeof request?.request_id==='string')response.request_id=request.request_id;
 return {httpStatus:200,response:{jsonrpc:'2.0',id:request?.id??null,result:{content:[{type:'text',text:JSON.stringify(response)}],structuredContent:response,isError:true}}};
}

export function publisherMasterPreflightSource() {
 return [classifyPublisherMasterError,validatePublisherMasterStatically,semanticPreflightResponse].map(fn=>fn.toString()).join('\n');
}
