// The responses must come from the two fixed authenticated CMS nodes.
export function formatHorizonteCategoryCatalog(request,terms,authority,normalizeTerms,normalizeAuthority) {
 const fail=()=>({httpStatus:200,response:{jsonrpc:'2.0',id:request?.id??null,result:{content:[{type:'text',text:'Catálogo no confirmado.'}],structuredContent:{status:'CATEGORY_CATALOG_UNCONFIRMED'},isError:true}}});
 try {
  if(request?.site!=='HORIZONTE'||request.page!==1)throw Error('INVALID_REQUEST');
  const catalog=normalizeTerms(terms),editorialSlugs=normalizeAuthority(authority,catalog);
  const data={status:200,site:'HORIZONTE',page:1,totalPages:1,catalog,editorialClassification:{schemaVersion:1,items:authority.body.items.map(({slug,name,categoryId,topicId})=>({slug,name,categoryId,topicId}))},editorialSlugs};
  return {httpStatus:200,response:{jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false}}};
 }catch{return fail()}
}
