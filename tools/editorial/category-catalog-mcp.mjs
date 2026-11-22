// Read-only MCP adapter. The surrounding workflow owns the allowed CMS URLs,
// credentials and authentication; neither argument may be supplied by callers.
const NAME='consultar_categorias_editoriales_opmx';
const sites=['OPURO','OPOL','LIBERAL','HORIZONTE'];
export function classifyCategoryCatalog(message,base,identity) {
  if (message?.method==='tools/list' && Array.isArray(base?.response?.result?.tools)) {
    if (base.response.result.tools.some(t=>t.name===NAME)) throw Error('CATEGORY_TOOL_DUPLICATE');
    base.response.result.tools.push({name:NAME,description:'Consulta una página del catálogo actual del CMS indicado; no modifica contenido.',inputSchema:{type:'object',properties:{site:{type:'string',enum:sites},page:{type:'integer',minimum:1,maximum:100}},required:['site','page'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false,idempotentHint:true}});
    return base;
  }
  if (message?.method!=='tools/call' || message?.params?.name!==NAME) return base;
  const fail=()=>({httpStatus:200,response:{jsonrpc:'2.0',id:message?.id??null,error:{code:-32602,message:'Invalid category catalog request'}}});
  const a=message?.params?.arguments;
  if (typeof identity?.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner)||message.jsonrpc!=='2.0'||!Object.hasOwn(message,'id')||!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).sort().join(',')!=='page,site'||!sites.includes(a.site)||!Number.isSafeInteger(a.page)||a.page<1||a.page>100||(a.site==='HORIZONTE'&&a.page!==1))return fail();
  return {httpStatus:200,route:'editorial-category-catalog',request:{id:message.id,site:a.site,page:a.page}};
}

// HTTP full response must be produced by the selected fixed CMS node. Discard
// headers and errors; never reveal credentials, URLs, HTML or transport logs.
export function formatCategoryCatalog(request,response) {
  const fail=()=>({httpStatus:200,response:{jsonrpc:'2.0',id:request?.id??null,result:{content:[{type:'text',text:'Catálogo no confirmado.'}],structuredContent:{status:'CATEGORY_CATALOG_UNCONFIRMED'},isError:true}}});
  if(!sites.includes(request?.site)||request.site==='HORIZONTE'||!Number.isSafeInteger(request?.page)||request.page<1||request.page>100||response?.statusCode!==200||!Array.isArray(response.body)||response.body.length>100||!response.headers||typeof response.headers!=='object')return fail();
  const entries=Object.entries(response.headers).filter(([k])=>k.toLowerCase()==='x-wp-totalpages');
  if(entries.length!==1||!/^[1-9][0-9]{0,2}$/.test(String(entries[0][1])))return fail();
  const totalPages=Number(entries[0][1]);
  if(totalPages>100||request.page>totalPages||(request.page<totalPages&&response.body.length!==100))return fail();
  const ids=new Set(),slugs=new Set(),body=[];
  for(const row of response.body){
    if(!Number.isSafeInteger(row?.id)||row.id<1||!Number.isSafeInteger(row.parent)||row.parent<0||typeof row.name!=='string'||!row.name.trim()||typeof row.slug!=='string'||!row.slug||ids.has(row.id)||slugs.has(row.slug))return fail();
    ids.add(row.id);slugs.add(row.slug);body.push({id:row.id,name:row.name,slug:row.slug,parent:row.parent});
  }
  const data={status:200,site:request.site,page:request.page,totalPages,body};
  return {httpStatus:200,response:{jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false}}};
}
