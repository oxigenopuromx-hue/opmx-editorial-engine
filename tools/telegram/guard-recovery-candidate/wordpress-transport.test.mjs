import test from 'node:test';
import assert from 'node:assert/strict';
import {createWordPressTransport} from './wordpress-transport.mjs';
import {createUpdateExecutor} from './update-executor.mjs';

const credentials={OPURO:'Basic dXNlcjpwYXNz',OPOL:'Basic b3BvbDpwYXNz',LIBERAL:'Basic bGliZXJhbDpwYXNz'};
test('uses only the configured destination and preserves authenticated raw fields for the executor',async()=>{
 const calls=[];const transport=createWordPressTransport({credentials,fetchImpl:async(url,init)=>{calls.push({url,init});return Response.json({id:71,type:'post',title:{raw:'Corregido'}})}});
 const result=await transport.read({destination:'OPURO',postId:71});
 assert.equal(result.post.title.raw,'Corregido');assert.equal(calls[0].url,'https://cms.oxigenopuro.com.mx/wp-json/wp/v2/posts/71?context=edit');assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.headers.authorization,credentials.OPURO);
 await transport.update({destination:'LIBERAL',postId:71,payload:{title:'Corregido'}});
 assert.equal(calls[1].url,'https://cms.elliberal.mx/wp-json/wp/v2/posts/71?context=edit');assert.equal(calls[1].init.method,'POST');assert.equal(calls[1].init.headers.authorization,credentials.LIBERAL);assert.deepEqual(JSON.parse(calls[1].init.body),{title:'Corregido'});
});
test('rejects caller controlled hosts and unexpected write fields before contacting CMS',async()=>{
 let calls=0;const t=createWordPressTransport({credentials,fetchImpl:async()=>{calls++;throw Error('must not run')}});
 for(const request of [{destination:'OPURO',postId:1,url:'https://evil.example'}, {destination:'OTHER',postId:1},{destination:'OPOL',postId:0}])await assert.rejects(()=>t.read(request),/INVALID_CMS_REQUEST/);
 await assert.rejects(()=>t.update({destination:'OPOL',postId:1,payload:{slug:'replace'}}),/INVALID_CMS_REQUEST/);assert.equal(calls,0);
});
test('never follows redirects or turns malformed or oversized replies into confirmation',async()=>{
 for(const response of [new Response(null,{status:302,headers:{location:'https://evil.example'}}),new Response('{', {status:200}),new Response('{}',{status:200,headers:{'content-length':String(9*1024*1024)}})]){
  const t=createWordPressTransport({credentials,fetchImpl:async()=>response});await assert.rejects(()=>t.read({destination:'OPURO',postId:1}),/CMS_RESPONSE_INVALID/);
 }
 const t=createWordPressTransport({credentials,fetchImpl:async()=>new Response(null,{status:404})});assert.deepEqual(await t.read({destination:'OPURO',postId:1}),{statusCode:404});
});
test('requires separate credential configuration for all destinations',()=>{
 assert.throws(()=>createWordPressTransport({credentials:{OPURO:credentials.OPURO}}),/CMS_TRANSPORT_CONFIGURATION_INVALID/);
 assert.throws(()=>createWordPressTransport({credentials:{...credentials,OPOL:'Basic abc\r\nInjected: yes'}}),/CMS_TRANSPORT_CONFIGURATION_INVALID/);
});
test('executor claims the exact revision before its only HTTP write and verifies the returned content',async()=>{
 const packageId='tg_'+'a'.repeat(40),revision=12,previewHash='b'.repeat(64),destination='OPURO',postId=71;
 const calls=[],before={id:postId,type:'post',slug:'nota-existente',status:'draft'},after={...before,title:{raw:'Corregido'}};
 let claimed=false,reads=0;
 const wordpress=createWordPressTransport({credentials,fetchImpl:async(url,init)=>{calls.push(init.method);if(init.method==='POST'){assert.equal(claimed,true);return Response.json({id:postId})}return Response.json(++reads===1?before:after)}});
 const claimStore={begin:async input=>{claimed=true;return {...input,status:'UPDATE_STARTED'}}};
 const executor=createUpdateExecutor({wordpress,claimStore,loadDecision:async()=>({packageId,revision,previewHash,action:'UPDATE',posts:[{destination,postId}]}),loadPayload:async()=>({packageId,revision,destination,previewHash,postId,slug:before.slug,exactPayload:true,payload:{title:'Corregido'}})});
 const result=await executor.execute({packageId,revision,previewHash,destination});
 assert.equal(result.status,'CMS_UPDATE_CONFIRMED');assert.deepEqual(calls,['GET','POST','GET']);assert.equal(result.publicVisibility,'NOT_CHECKED');assert.equal(result.telegramAck,'NOT_CHECKED');
});
