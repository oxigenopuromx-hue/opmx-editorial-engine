import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildCategoryHomeRestQaOperations} from './build-category-home-rest-qa-operations.mjs';
const probe={id:'7IDUF9PeHQ5v331Z',versionId:'qa-base',active:false,nodes:[{name:'Manual',type:'n8n-nodes-base.manualTrigger'},{name:'Old read',type:'n8n-nodes-base.httpRequest'},{name:'Old result',type:'n8n-nodes-base.code'}],connections:{Manual:{main:[[{node:'Old read',index:0,type:'main'}]]}}};
const template={type:'n8n-nodes-base.httpRequest',typeVersion:4.2,parameters:{genericAuthType:'httpBasicAuth'},credentials:{httpBasicAuth:{id:'existing-credential-id',name:'Existing WordPress'}}};
const config={expectedVersionId:'qa-base',categoryId:61,qaId:'qa13_aaaaaaaaaaaa'};
const ops=buildCategoryHomeRestQaOperations(probe,template,config),nodes=ops.filter(o=>o.type==='addNode').map(o=>o.node);
const plain=x=>JSON.parse(JSON.stringify(x));
const run=(source,json,results)=>plain(new vm.Script('(()=>{\n'+source+'\n})()').runInNewContext({$input:{first:()=>({json:plain(json)})},$:name=>({first:()=>({json:plain(results[name])})})}));
test('temporary QA uses existing credential IDs, draft-only mutations and reversible cleanup',()=>{
 assert.equal(nodes.length,19);assert.equal(ops.some(o=>o.type==='setNodeCredential'),false);
 const http=nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest');for(const n of http){assert.deepEqual(n.credentials,template.credentials);assert.equal(n.retryOnFail,false);assert.equal(n.parameters.options.redirect.redirect.followRedirects,false);assert.equal(n.parameters.url.includes('cms.oxigenopuro.com.mx'),true)}
 const create=http.find(n=>n.name==='QA13 — Crear fixture');assert.equal(JSON.parse(create.parameters.jsonBody).status,'draft');assert.equal(http.some(n=>n.parameters.jsonBody?.includes('"publish"')),false);
 assert.match(http.find(n=>n.parameters.method==='DELETE').parameters.url,/force=false/);assert.equal(ops.filter(o=>o.type==='addNodeGroup').length,1);
});
test('all generated guards run against their preceding response without network or Code helpers',()=>{
 let post=null;const results={};
 for(const n of nodes){
  let result;
  if(n.type==='n8n-nodes-base.httpRequest'){
   const method=n.parameters.method;
   if(method==='OPTIONS')result={statusCode:200,body:{schema:{properties:{meta:{properties:{oxpuro_excluded_category_ids:{type:'array',items:{type:'string'}}}}}}}};
   else if(n.name==='QA13 — Leer categoría')result={statusCode:200,body:{id:61,slug:'hidalgo'}};
   else if(n.name==='QA13 — Crear fixture'){const b=JSON.parse(n.parameters.jsonBody);post={...b,id:500,type:'post',title:{raw:b.title},excerpt:{raw:b.excerpt},meta:{oxpuro_excluded_category_ids:[],...b.meta}};result={statusCode:201,body:plain(post)}}
   else if(method==='POST'){const b=JSON.parse(n.parameters.jsonBody);post={...post,...b,excerpt:b.excerpt?{raw:b.excerpt}:post.excerpt,meta:{...post.meta,...b.meta}};result={statusCode:200,body:plain(post)}}
   else if(method==='DELETE'){post.status='trash';result={statusCode:200,body:plain(post)}}
   else result={statusCode:200,body:plain(post)};
  }else result=run(n.parameters.jsCode,results[nodes[nodes.indexOf(n)-1].name],results)[0].json;
  results[n.name]=plain(result);
 }
 assert.equal(results['QA13 — Resultado'].status,'CATEGORY_HOME_REST_QA_PASSED');assert.equal(results['QA13 — Resultado'].cleanup,'TRASHED');assert.equal(results['QA13 — Resultado'].postId,500);
});
test('guards reject changed fixture identity and never infer a target from untrusted caller data',()=>{
 const source=nodes.find(n=>n.name==='QA13 — Verificar exclusión').parameters.jsCode,base={statusCode:200,body:{id:500,type:'post',slug:'qa13-aaaaaaaaaaaa',status:'draft',title:{raw:'OPMX QA13 · fixture desechable'},categories:[61],meta:{oxpuro_excluded_category_ids:['61'],oxpuro_exclude_home:true}}},results={'QA13 — Crear fixture':{body:{id:500}}};
 for(const patch of [{id:501},{slug:'real-article'},{status:'publish'},{type:'page'},{title:{raw:'Changed'}}])assert.throws(()=>run(source,{...base,body:{...base.body,...patch}},results),/IDENTITY/);
});
test('builder refuses active, changed or non-manual probes and missing credential bindings',()=>{
 for(const change of [p=>p.active=true,p=>p.versionId='different',p=>p.nodes.push({}),p=>p.nodes[0].type='webhook']){const p=structuredClone(probe);change(p);assert.throws(()=>buildCategoryHomeRestQaOperations(p,template,config))}
 assert.throws(()=>buildCategoryHomeRestQaOperations(probe,{...template,credentials:{}},config),/CREDENTIAL/);
});
