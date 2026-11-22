// Only use the authenticated response from the fixed Horizonte endpoint.
export function normalizeHorizonteEditorialClassification(response, catalog) {
 const fail=()=>{throw Error('HORIZONTE_EDITORIAL_CATALOG_UNCONFIRMED')};
 const body=response?.body;
 if(response?.statusCode!==200||!body||body.schemaVersion!==1||!Array.isArray(body.items)||!body.items.length||body.items.length>100)fail();
 const slugs=new Set(),categoryIds=new Set(),topicIds=new Set();
 for(const row of body.items){
  if(!row||typeof row.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)||typeof row.name!=='string'||!row.name.trim()||!Number.isSafeInteger(row.categoryId)||row.categoryId<1||!Number.isSafeInteger(row.topicId)||row.topicId<1||slugs.has(row.slug)||categoryIds.has(row.categoryId)||topicIds.has(row.topicId))fail();
  if(catalog?.category?.filter(x=>x.slug===row.slug&&x.id===row.categoryId).length!==1||catalog?.ehc_topic?.filter(x=>x.slug===row.slug&&x.id===row.topicId).length!==1)fail();
  slugs.add(row.slug);categoryIds.add(row.categoryId);topicIds.add(row.topicId);
 }
 return [...slugs];
}
