import test from 'node:test';
import assert from 'node:assert/strict';
import {runOpuroCategoryHomeRestQa} from './opuro-category-home-rest-qa.mjs';
function adapter(){const state={post:null,calls:[]};return {state,async request(x){state.calls.push(structuredClone(x));assert.equal(x.retry,false);assert.match(x.path,/^\/wp-json\/wp\/v2\/(?:posts|categories)/);if(x.method==='OPTIONS')return {statusCode:200,body:{schema:{properties:{meta:{properties:{oxpuro_excluded_category_ids:{type:'array',items:{type:'string'}}}}}}}};if(x.path.endsWith('/categories/61'))return {statusCode:200,body:{id:61,slug:'hidalgo'}};if(x.method==='POST'&&x.path.endsWith('/posts')){assert.equal(x.body.status,'draft');state.post={...x.body,id:100,type:'post',title:{raw:x.body.title},meta:{oxpuro_excluded_category_ids:[],...x.body.meta}};return {statusCode:201,body:structuredClone(state.post)}}if(x.method==='POST'){assert.equal(x.body.status,undefined);state.post={...state.post,...x.body,meta:{...state.post.meta,...x.body.meta}};return {statusCode:200,body:structuredClone(state.post)}}if(x.method==='DELETE'){const previous=state.post;state.post=null;return {statusCode:200,body:{...previous,status:'trash'}}}return {statusCode:200,body:structuredClone(state.post)}}};}
test('REST plan checks schema, one draft, omitted/present/empty and cleans only that fixture',async()=>{
 const a=adapter(),r=await runOpuroCategoryHomeRestQa({request:a.request,categoryId:61,qaId:'qa13_aaaaaaaaaaaa'});assert.equal(r.status,'CATEGORY_HOME_REST_QA_PASSED');assert.equal(r.checks,7);assert.equal(r.cleanup,'TRASHED');assert.equal(r.cmsPublished,0);assert.equal(a.state.post,null);assert.equal(a.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/posts')).length,1);assert.equal(a.state.calls.some(c=>c.body?.status==='publish'),false);
});
test('unknown create response stops without creating another draft or guessing a target to delete',async()=>{
 const a=adapter();const request=async x=>x.method==='POST'&&x.path.endsWith('/posts')?{statusCode:504}:a.request(x);const r=await runOpuroCategoryHomeRestQa({request,categoryId:61,qaId:'qa13_aaaaaaaaaaaa'});assert.equal(r.status,'CATEGORY_HOME_REST_QA_UNCONFIRMED');assert.equal(r.postId,null);assert.equal(a.state.calls.some(c=>c.method==='DELETE'),false);
});
test('cleanup refuses a fixture that has become published or changed identity',async()=>{
 const a=adapter();let changed=false;const request=async x=>{const r=await a.request(x);if(x.method==='POST'&&x.path.endsWith('/posts')){a.state.post.status='publish';changed=true}return r};const r=await runOpuroCategoryHomeRestQa({request,categoryId:61,qaId:'qa13_aaaaaaaaaaaa'});assert.equal(changed,true);assert.equal(r.status,'CATEGORY_HOME_REST_QA_UNCONFIRMED');assert.equal(r.cleanup,'NOT_CONFIRMED');assert.equal(a.state.calls.some(c=>c.method==='DELETE'),false);
});
test('unsupported schema stops before creating any draft',async()=>{
 const a=adapter(),request=async x=>x.method==='OPTIONS'?{statusCode:200,body:{schema:{}}}:a.request(x);const r=await runOpuroCategoryHomeRestQa({request,categoryId:61,qaId:'qa13_aaaaaaaaaaaa'});assert.equal(r.postId,null);assert.equal(a.state.calls.length,0);
});
