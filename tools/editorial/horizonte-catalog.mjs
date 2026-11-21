// Call only with the direct response from the authenticated HTTPS CMS node.
// This function validates shape and completeness; it does not authenticate a
// caller, network transport, editorial decision or permission to publish.
export function normalizeHorizonteCatalog(response){
 const fail=()=>{throw Error('HORIZONTE_CATALOG_UNCONFIRMED')};
 if(!response||response.statusCode!==200||!response.body||typeof response.body!=='object'||Array.isArray(response.body))fail();
 const fields=['category','ehc_region','ehc_municipality','ehc_topic'],body=response.body;
 if(Object.keys(body).sort().join(',')!==[...fields].sort().join(','))fail();
 const catalog={};
 for(const field of fields){
  const rows=body[field];if(!Array.isArray(rows)||rows.length>=100||(field!=='ehc_municipality'&&!rows.length))fail();
  const ids=new Set(),slugs=new Set();catalog[field]=rows.map(row=>{
   if(!row||typeof row!=='object'||Array.isArray(row)||!Number.isSafeInteger(row.id)||row.id<1||typeof row.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)||typeof row.name!=='string'||!row.name.trim()||ids.has(row.id)||slugs.has(row.slug))fail();
   ids.add(row.id);slugs.add(row.slug);return {id:row.id,slug:row.slug,name:row.name};
  });
 }
 return catalog;
}
