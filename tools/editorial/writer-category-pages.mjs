// Only use HTTP responses returned by the writer's authenticated, fixed CMS
// nodes. Pagination emits one full-response item per page, in request order.
export function normalizeWriterCategoryPages(responses,perPage=100) {
 const fail=()=>{throw Error('CATEGORY_CATALOG_UNCONFIRMED')};
 if(!Array.isArray(responses)||!responses.length||!Number.isSafeInteger(perPage)||perPage<1||perPage>100)fail();
 let totalPages=null,totalItems=null,lastId=0;const rows=[],ids=new Set(),slugs=new Set();
 for(const [index,response] of responses.entries()){
  if(response?.statusCode!==200||!Array.isArray(response.body)||!response.headers||typeof response.headers!=='object')fail();
  const headers=Object.entries(response.headers),get=name=>{const x=headers.filter(([k])=>k.toLowerCase()===name);return x.length===1?String(x[0][1]):''};
  const p=get('x-wp-totalpages'),t=get('x-wp-total');
  if(!/^[1-9][0-9]{0,2}$/.test(p)||!/^[1-9][0-9]{0,6}$/.test(t))fail();
  const pages=Number(p),total=Number(t);
  if(pages>100||pages!==Math.ceil(total/perPage)||totalPages!==null&&totalPages!==pages||totalItems!==null&&totalItems!==total||responses.length!==pages)fail();
  totalPages=pages;totalItems=total;
  if(response.body.length!==(index<pages-1?perPage:total-perPage*(pages-1)))fail();
  for(const row of response.body){
   if(!Number.isSafeInteger(row?.id)||row.id<=lastId||!Number.isSafeInteger(row.parent)||row.parent<0||typeof row.name!=='string'||!row.name.trim()||typeof row.slug!=='string'||!row.slug||ids.has(row.id)||slugs.has(row.slug))fail();
   lastId=row.id;ids.add(row.id);slugs.add(row.slug);rows.push({id:row.id,name:row.name,slug:row.slug,parent:row.parent});
  }
 }
 if(rows.length!==totalItems||rows.some(row=>row.parent!==0&&!ids.has(row.parent)))fail();
 return rows;
}
