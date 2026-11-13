import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import fixture from './fixtures/frontend-category-home-bf94246.mjs';
const source=path=>fixture.files[path].content;
const take=(s,begin,end)=>{const a=s.indexOf(begin),b=end?s.indexOf(end,a+begin.length):s.length;if(a<0||b<=a)throw Error('FRONTEND_SOURCE_CHANGED');return s.slice(a,b)};
const strip=s=>stripTypeScriptTypes(s.replaceAll('export function ','function ').replaceAll('export async function ','async function '),{mode:'strip'});
const content=source('lib/content.ts'),mapper=strip(take(content,'export function fromWordPress(','\nasync function demos')),
 category=strip(take(content,'export async function getCategoryHome(')),storyUrl=strip(take(content,'export function storyUrl(','\nfunction categoryLabel')),
 archive=strip(take(content,'export function archivePage(','\n\n\nexport async function getCategoryHome'));
const article=id=>({id,slug:'nota-'+id,title:'Nota '+id,excerpt:'Dato',category:'economia',category_path:['economia'],category_labels:['Economía'],published:'2026-11-13T00:00:00Z',editorial:{subtitle:'Dato',demo:false,photo_credit:'Cortesía',focal_x:50,focal_y:50},author:{name:'Redacción'},image:null});
const plain=x=>JSON.parse(JSON.stringify(x));
test('all source fixtures equal the Git blobs of the actual production deployment',()=>{
 assert.equal(fixture.commit,'bf94246d2f823056c3644e4d951507ad06d45783');for(const f of Object.values(fixture.files)){const b=Buffer.from(f.content);assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),f.sha)}
});
test('actual getCategoryHome preserves seven CMS-selected positions and excluded story in lower archive',async()=>{
 const payload={hero:[1,2,3].map(article),featured:[4,5,6,7].map(article),items:[8,9].map(article),page:1,pages:2,total:22},calls=[];
 const ctx={process:{env:{WORDPRESS_API_URL:'https://cms.oxigenopuro.com.mx/wp-json/wp/v2'}},wordpressClient:()=>({categoryHome:async(slug,page)=>{calls.push({slug,page});return plain(payload)}})};
 const result=plain(await new vm.Script('(async()=>{'+mapper+'\n'+category+'\nreturn getCategoryHome("economia",1)})()').runInNewContext(ctx));
 assert.deepEqual(calls,[{slug:'economia',page:1}]);assert.deepEqual(result.hero.map(x=>x.id),[1,2,3]);assert.deepEqual(result.featured.map(x=>x.id),[4,5,6,7]);assert.deepEqual(result.items.map(x=>x.id),[8,9]);assert.equal(result.items[0].path,'/nota-8/');assert.equal(result.total,22);
});
test('actual frontend requests the requested archive page without merging upper positions into its lower listing',async()=>{
 const ctx={process:{env:{WORDPRESS_API_URL:'configured'}},wordpressClient:()=>({categoryHome:async(slug,page)=>({hero:[1,2,3].map(article),featured:[4,5,6,7].map(article),items:[28,29].map(article),page,pages:2,total:22})})};
 const result=plain(await new vm.Script('(async()=>{'+mapper+'\n'+category+'\nreturn getCategoryHome("economia",2)})()').runInNewContext(ctx));assert.equal(result.page,2);assert.deepEqual(result.items.map(x=>x.id),[28,29]);
 const component=source('components/category-landing.tsx');assert.match(component,/page === 1 && lead/);assert.match(component,/page > 1 && !data\.items\.length\) notFound\(\)/);assert.match(component,/data\.items\.map\(\(story\)/);
});
test('actual canonical story URL remains slug-only, independent of category exclusions',()=>{
 const url=new vm.Script(storyUrl+'\nstoryUrl({slug:"nota-8",category:"economia",id:8})').runInNewContext({});assert.equal(url,'/nota-8/');
});
test('actual pagination uses the query page parameter and preserves search query',()=>{
 const s=source('components/archive-pagination.tsx'),url=strip(take(s,'  const url =','  if (pages < 2)'));
 const result=new vm.Script(url+'\nurl(2)').runInNewContext({base:'/category/economia/',query:'prueba',URLSearchParams});assert.equal(result,'/category/economia/?page=2&q=prueba');
 const page=new vm.Script(archive+'\narchivePage("2")').runInNewContext({});assert.equal(page,2);
});
test('actual category-home client cache tag is isolated and retains 60-second fallback',()=>{
 const client=source('lib/wordpress/client.ts'),tags=strip(take(client,'  function cacheTags(','  async function read<'));
 const result=plain(new vm.Script(tags+'\ncacheTags("categories/economia/home",new URLSearchParams({page:"2"}))').runInNewContext({URLSearchParams}));assert.deepEqual(result,['oxpuro:category:economia']);assert.match(client,/CONTENT_REVALIDATE_SECONDS = 60/);assert.match(client,/categoryHome: \(slug: string, page: number\)/);assert.match(client,/categories\/\$\{valid\}\/home/);
});
test('CMS source applies exclusion to category positions, while archive query, individual routes and search remain independent',()=>{
 const api=source('wordpress/oxigeno-puro-core/includes/api.php');
 const home=take(api,'function category_home_response(','\nfunction update_category_home_api(');assert.match(home,/oxpuro_excluded_category_ids/);assert.match(home,/\$query = query_stories\(\['posts_per_page' => 20, 'paged' => \(int\) \$request\['page'\], 'tax_query' => \$tax, 'post__not_in' => array_keys\(\$used\)\]\)/);
 assert.match(home,/'items' => array_values/);assert.match(api,/\$args\['s'\] = \$request\['search'\]/);
 const editorial=source('wordpress/oxigeno-puro-core/includes/editorial.php');assert.match(editorial,/'oxpuro_excluded_category_ids'/);assert.match(editorial,/'type' => 'array'/);
});
test('installed-source revalidation observes the same exact metadata key and queues scoped notifications',()=>{
 const plugin=source('wordpress/opmx-editorial-revalidation/opmx-editorial-revalidation.php');assert.match(plugin,/array\('oxpuro_excluded_category_ids', 'oxpuro_exclude_home'\)/);for(const hook of ['added_post_meta','updated_post_meta','deleted_post_meta'])assert.match(plugin,new RegExp("add_action\\('"+hook+"'"));assert.match(plugin,/hash_hmac\('sha256'/);assert.match(plugin,/opmx_revalidation_queue/);
});
