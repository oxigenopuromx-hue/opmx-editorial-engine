// Exact generic file-protocol functions captured from the active MCP Code.
// No workflow identifiers, credentials, operator data or execution payloads.
function destinationRegistry() {
 return {
  OPURO:{cms:'https://cms.oxigenopuro.com.mx',publicOrigin:'https://oxigenopuro.com.mx',resultKey:'oxigenopuro',postIdKey:'post_id_opuro',heroMeta:'oxpuro_hero_media_id',editorialMeta:'oxpuro_editorial',hero:true},
  OPOL:{cms:'https://cms.oxigenopolitico.com.mx',publicOrigin:'https://oxigenopolitico.com.mx',resultKey:'oxigenopolitico',postIdKey:'post_id_opol',hero:false},
  LIBERAL:{cms:'https://cms.elliberal.mx',publicOrigin:'https://elliberal.mx',resultKey:'elliberal',postIdKey:'post_id_liberal',heroMeta:'liberalmx_hero_media_id',editorialMeta:'liberalmx_editorial',hero:true},
 };
}
function resolveDestinations(value) {
 if(Array.isArray(value)){if(!value.every(v=>typeof v==='string'))throw Error('Destino inválido');value=value.join(',');}
 if(typeof value!=='string'||!value.trim()||value.length>256)throw Error('Destino inválido');
 const registry=destinationRegistry(),selected=new Set();
 for(const item of value.split(',')){
  const token=item.trim().toUpperCase();if(!token)throw Error('Destino vacío entre comas');
  const expanded=token==='AMBOS'?['OPURO','OPOL']:token==='TODOS'?Object.keys(registry):[token];
  for(const destination of expanded){if(!Object.hasOwn(registry,destination))throw Error('Destino desconocido: '+destination);selected.add(destination);}
 }
 return Object.keys(registry).filter(d=>selected.has(d));
}
function destinationLabel(destinations) {
 const all=Object.keys(destinationRegistry()),set=new Set(destinations),items=all.filter(d=>set.has(d));
 if(items.length!==set.size||!items.length)throw Error('Destino inválido');
 if(items.length===all.length)return 'TODOS';
 if(items.length===2&&items[0]==='OPURO'&&items[1]==='OPOL')return 'AMBOS';
 return items.join(',');
}
function classifyFileMcp(envelope,{publicationEnabled=true}={}) {
 let message=envelope.body??envelope;
 if(typeof message==='string'){try{message=JSON.parse(message);}catch{return {httpStatus:400,response:{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}}};}}
 const id=message?.id??null;
 const reply=result=>({httpStatus:200,response:{jsonrpc:'2.0',id,result}});
 const fail=(code,text)=>({httpStatus:200,response:{jsonrpc:'2.0',id,error:{code,message:text}}});
 if(!message||Array.isArray(message)||message.jsonrpc!=='2.0')return fail(-32600,'Invalid Request');
 if(typeof message.method!=='string')return fail(-32600,'Invalid method');
 if(message.method?.startsWith('notifications/'))return {httpStatus:202,notification:true};
 if(!Object.hasOwn(message,'id'))return fail(-32600,'Missing request id');
 if(message.method==='initialize')return reply({protocolVersion:['2025-03-26','2025-06-18','2025-11-25'].includes(message.params?.protocolVersion)?message.params.protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'opmx-publisher-files',version:'1.1.0'},instructions:'Recibe archivos originales mediante fileParams. preparar_borrador_opmx sólo crea borradores. publicar_nota_opmx crea y publica una nota NUEVA. Para borradores ya entregados usar publicar_borradores_opmx con request_id, slug e IDs originales. Publicar sólo ante orden explícita del usuario y confirmación PUBLICAR. Mantener request_id estable y no reenviar paquetes inciertos. Comprobar estado y enlaces. No inventar IDs, URLs ni Base64.'});
 if(message.method==='ping')return reply({});
 const file={type:'object',properties:{download_url:{type:'string'},file_id:{type:'string'},mime_type:{type:'string'},file_name:{type:'string'}},required:['download_url','file_id'],additionalProperties:false};
 const schema={type:'object',properties:{master_file:file,hero:file,destacada:file,destino:{type:'string',minLength:1,maxLength:256,description:'OPURO, OPOL, LIBERAL, AMBOS (OPURO+OPOL), TODOS o lista por comas.'}},required:['master_file','destacada','destino'],additionalProperties:false};
 const tool={name:'validar_archivos_opmx',title:'Validar archivos OPMX',description:'Descarga y comprueba MASTER y Hero/destacada de este chat mediante archivos nativos. No crea borradores ni reserva solicitudes.',inputSchema:schema,annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},_meta:{'openai/fileParams':['master_file','hero','destacada']}};
 const draft={name:'preparar_borrador_opmx',title:'Preparar borradores OPMX',description:'Envía el MASTER aprobado y sus archivos originales a OPURO, OPOL, LIBERAL, AMBOS, TODOS o lista por comas como borradores verificados. Usa esta herramienta desde el Motor. Mantén request_id estable. No publica notas.',inputSchema:{...schema,properties:{...schema.properties,request_id:{type:'string',minLength:16,maxLength:128,pattern:'^[A-Za-z0-9_-]+$'}},required:[...schema.required,'request_id']},annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},_meta:{'openai/fileParams':['master_file','hero','destacada']}};
 const publish={...draft,name:'publicar_nota_opmx',title:'Publicar nota OPMX',description:'Sólo ante orden explícita de PUBLICAR una nota NUEVA en los destinos indicados. Recibe MASTER LISTO y archivos originales, crea borradores con protección contra duplicados, comprueba ambos antes de publicar y devuelve estado y enlaces. No usar para pruebas reales, notas existentes ni para reenviar resultados inciertos. No publica en redes sociales.',inputSchema:{...draft.inputSchema,properties:{...draft.inputSchema.properties,confirmar_publicacion:{type:'string',enum:['PUBLICAR'],description:'Usar PUBLICAR sólo cuando el usuario ha ordenado publicar este paquete concreto en los destinos seleccionados.'}},required:[...draft.inputSchema.required,'confirmar_publicacion']},annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:true}};
 const existing={name:'publicar_borradores_opmx',title:'Publicar borradores OPMX existentes',description:'Sólo ante orden explícita del usuario de publicar los borradores ya entregados por Publisher. Usar request_id, slug e IDs originales verificados; el guard debe confirmar su vínculo. No crea notas ni medios. Lee ambos antes de cambiar estados y no vuelve a publicar destinos ya públicos. No inventar IDs ni usar automáticamente para reintentar resultados inciertos. No publica en redes.',inputSchema:{type:'object',properties:{request_id:{type:'string',minLength:16,maxLength:128,pattern:'^[A-Za-z0-9_-]+$'},slug:{type:'string',maxLength:200,pattern:'^[a-z0-9]+(?:-[a-z0-9]+)*$'},destino:{type:'string',minLength:1,maxLength:256,description:'OPURO, OPOL, LIBERAL, AMBOS (OPURO+OPOL), TODOS o lista por comas.'},post_id_opuro:{type:'integer',minimum:1},post_id_opol:{type:'integer',minimum:1},post_id_liberal:{type:'integer',minimum:1},confirmar_publicacion:{type:'string',enum:['PUBLICAR']}},required:['request_id','slug','destino','confirmar_publicacion'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:true}};
 const tools=publicationEnabled?[tool,draft,publish,existing]:[tool,draft];
 if(message.method==='tools/list')return reply({tools});
 if(message.method!=='tools/call'||!tools.some(t=>t.name===message.params?.name))return fail(-32601,'Method not found');
 let a=message.params.arguments;
 let requested;try{requested=resolveDestinations(a?.destino);}catch{return fail(-32602,'Destino inválido');}
 a={...a,destino:destinationLabel(requested)};
 if(message.params.name!==tool.name&&(typeof a.request_id!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(a.request_id)))return fail(-32602,'Falta request_id estable válido');
 if([publish.name,existing.name].includes(message.params.name)&&a.confirmar_publicacion!=='PUBLICAR')return fail(-32602,'Falta orden explícita PUBLICAR');
 if(message.params.name===existing.name){
  if(typeof a.slug!=='string'||a.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug))return fail(-32602,'Slug inválido');
  for(const d of requested.map(d=>d.toLowerCase()))if(!Number.isSafeInteger(a['post_id_'+d])||a['post_id_'+d]<1)return fail(-32602,'Falta ID original del borrador: '+d);
  return {httpStatus:200,route:'existing-publication',request:{id,operation:existing.name,request_id:a.request_id,slug:a.slug,destino:a.destino,post_id_opuro:a.post_id_opuro??null,post_id_opol:a.post_id_opol??null,post_id_liberal:a.post_id_liberal??null,confirmar_publicacion:a.confirmar_publicacion}};
 }
 const roles=requested.length===1&&requested[0]==='OPOL'?['master_file','destacada']:['master_file','hero','destacada'];
 const files={};
 for(const role of roles){const f=a[role];if(!f||typeof f!=='object'||typeof f.file_id!=='string'||!f.file_id.trim()||f.file_id.length>4096||typeof f.download_url!=='string'||f.download_url.length>16384){
  const diagnostic={status:'FILE_REFERENCE_REJECTED',role,kind:typeof f,keys:f&&typeof f==='object'?Object.keys(f).sort():[],file_id_type:typeof f?.file_id,file_id_length:typeof f?.file_id==='string'?f.file_id.length:null,file_id_length_valid:typeof f?.file_id==='string'&&Boolean(f.file_id.trim())&&f.file_id.length<=4096,download_url_type:typeof f?.download_url,download_url_length:typeof f?.download_url==='string'?f.download_url.length:null,writesStarted:false};
  return reply({content:[{type:'text',text:JSON.stringify(diagnostic)}],structuredContent:diagnostic,isError:true});
 }
  const match=/^https:\/\/([a-zA-Z0-9.-]+)(\/[^\s#]*)$/.exec(f.download_url);const host=match?.[1]?.toLowerCase();
  if(!host||!(host==='files.oaiusercontent.com'||/^oais(?:dmntpr|dsorpr)[a-z0-9-]*\.blob\.core\.windows\.net$/.test(host)||/^oaisdmntpr[a-z0-9-]*aws\.s3\.[a-z0-9-]+\.amazonaws\.com$/.test(host)||/^sdmntpr[a-z0-9-]*\.oaiusercontent\.com$/.test(host)))return fail(-32602,'Origen de archivo no autorizado');
  files[role]={download_url:f.download_url,file_id:f.file_id,mime_type:f.mime_type??null,file_name:f.file_name??null};
 }
 return {httpStatus:200,route:'files',request:{id,operation:message.params.name,destino:a.destino,request_id:a.request_id??null,confirmar_publicacion:a.confirmar_publicacion??null,files}};
}

function parseMcpMaster(bytes,request) {
 if(bytes.length>2*1024*1024)throw Error('MASTER demasiado grande');
 const master=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
 if(!master||typeof master!=='object'||Array.isArray(master)||typeof master.SEO?.SLUG!=='string')throw Error('MASTER inválido');
 if(request.operation!=='validar_archivos_opmx'&&master.CONTROL_EDITORIAL?.ESTADO!=='LISTO')throw Error('Paquete no aprobado');
 const seo=master.SEO??master.seo??{},pub=master.PUBLICACION??master.publication??{};
 const rawTags=seo.ETIQUETAS??seo.tags;
 const tags=Array.isArray(rawTags)?rawTags.filter(x=>typeof x==='string'&&x.trim()):typeof rawTags==='string'?rawTags.split(',').filter(x=>x.trim()):[];
 if(!tags.length)throw Error('MASTER_VALIDATION_FAILED:SEO.ETIQUETAS');
 const excerpt=pub.EXTRACTO??pub.excerpt??seo.EXTRACTO??seo.excerpt??master.TEXTO_EDITORIAL?.ENTRADILLA;
 if(typeof excerpt!=='string'||!excerpt.trim())throw Error('MASTER_VALIDATION_FAILED:PUBLICACION.EXTRACTO');
 return {master,masterBytes:bytes.length};
}

export {classifyFileMcp};
export const capturedMcpMasterParserCode=parseMcpMaster.toString()+"\nconst bytes=await this.helpers.getBinaryDataBuffer(0,'asset');return [{json:parseMcpMaster(bytes,$('Protocolo MCP archivos').first().json.request)}];";
export const capturedFileProtocolSourceSha256="ec2eecd937a6d62d66de815918e1b9c7024a50d08eb7e866c2ad5206bf4c8ec5";
