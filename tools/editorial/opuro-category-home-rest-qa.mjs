import {assertOpuroCategoryReadback,assertPreservedOpuroCategoryMeta} from './opuro-category-home.mjs';

// A trusted maintenance adapter supplies authenticated REST I/O to the fixed
// OPURO CMS. This QA creates exactly one disposable draft. It never publishes,
// attaches to a Telegram package, modifies existing editorial posts, or retries
// an uncertain write. Slug/id/title/draft are reread before every mutation.
export async function runOpuroCategoryHomeRestQa({request,categoryId,qaId}) {
 if(typeof request!=='function'||!Number.isSafeInteger(categoryId)||categoryId<1||!/^qa13_[a-f0-9]{12}$/.test(qaId??''))throw Error('CATEGORY_HOME_QA_CONFIGURATION');
 const slug=qaId.replace('_','-'),title='OPMX QA13 · fixture desechable',root='/wp-json/wp/v2';
 let postId=null,requests=0,checks=0,cleanup='NOT_CREATED',status='CATEGORY_HOME_REST_QA_UNCONFIRMED';
 const call=async(method,path,body)=>{requests++;return request({method,path,...(body?{body}:{}),retry:false})};
 const identity=p=>p?.id===postId&&p.type==='post'&&p.slug===slug&&p.status==='draft'&&p.title?.raw===title;
 const read=async()=>{const r=await call('GET',`${root}/posts/${postId}?context=edit`);if(r.statusCode!==200||!identity(r.body))throw Error('QA_FIXTURE_IDENTITY');return r.body};
 const update=async payload=>{const before=await read();const r=await call('POST',`${root}/posts/${postId}`,payload);if(!Number.isInteger(r.statusCode)||r.statusCode<200||r.statusCode>299||!identity(r.body))throw Error('QA_UPDATE_UNCONFIRMED');return {before,after:await read()}};
 try {
  const options=await call('OPTIONS',`${root}/posts`),field=options.body?.schema?.properties?.meta?.properties?.oxpuro_excluded_category_ids;
  if(options.statusCode!==200||field?.type!=='array'||field?.items?.type!=='string')throw Error('QA_REST_SCHEMA');checks++;
  const category=await call('GET',`${root}/categories/${categoryId}`);if(category.statusCode!==200||category.body?.id!==categoryId||typeof category.body.slug!=='string')throw Error('QA_CATEGORY_UNCONFIRMED');checks++;
  const created=await call('POST',`${root}/posts`,{title,slug,status:'draft',content:'<!-- wp:paragraph --><p>Fixture técnico desechable. No publicar.</p><!-- /wp:paragraph -->',excerpt:'Fixture QA13',categories:[categoryId],meta:{oxpuro_exclude_home:true}});
  if(created.statusCode!==201||!Number.isSafeInteger(created.body?.id)||created.body.id<1)throw Error('QA_CREATE_UNCONFIRMED');
  postId=created.body.id;cleanup='PENDING';if(!identity(created.body))throw Error('QA_FIXTURE_IDENTITY');checks++;
  const omitted=await read();assertOpuroCategoryReadback({declared:true,ids:[]},omitted);if(omitted.meta?.oxpuro_exclude_home!==true)throw Error('QA_GENERAL_HOME');checks++;
  const excluded=await update({meta:{oxpuro_excluded_category_ids:[String(categoryId)]}});assertOpuroCategoryReadback({declared:true,ids:[String(categoryId)]},excluded.after);if(excluded.after.meta?.oxpuro_exclude_home!==true)throw Error('QA_GENERAL_HOME');checks++;
  const unchanged=await update({excerpt:'Fixture QA13 · actualización sin exclusiones',meta:{oxpuro_editorial:{subtitle:'Fixture QA13'}}});assertPreservedOpuroCategoryMeta('OPURO',{meta:{oxpuro_editorial:{subtitle:'Fixture QA13'}}},unchanged.before,unchanged.after);assertOpuroCategoryReadback({declared:true,ids:[String(categoryId)]},unchanged.after);checks++;
  const emptied=await update({meta:{oxpuro_excluded_category_ids:[]}});assertOpuroCategoryReadback({declared:true,ids:[]},emptied.after);if(emptied.after.meta?.oxpuro_exclude_home!==true)throw Error('QA_GENERAL_HOME');checks++;
  status='CATEGORY_HOME_REST_QA_PASSED';
 } catch {
  // Raw REST errors can contain credentials/content and are never returned.
  status='CATEGORY_HOME_REST_QA_UNCONFIRMED';
 } finally {
  if(postId!==null){
   try{await read();const r=await call('DELETE',`${root}/posts/${postId}?force=false`);cleanup=r.statusCode===200&&r.body?.id===postId&&r.body.status==='trash'?'TRASHED':'DELETE_UNCONFIRMED'}catch{cleanup='NOT_CONFIRMED'}
  }
 }
 return {status,checks,requests,fixtureSlug:slug,postId,cleanup,cmsPublished:0,telegramMessages:0,realEditorialPostsModified:0,retryPermitted:false};
}
