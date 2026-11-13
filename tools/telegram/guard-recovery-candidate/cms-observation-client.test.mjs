import test from 'node:test';import assert from 'node:assert/strict';
import {createCmsObserver} from './cms-observation-client.mjs';
const clock=1794357772000,nonce=`cms_${'a'.repeat(48)}`,secret='b'.repeat(64),input={site:'https://cms.oxigenopuro.com.mx',postId:10423};
const data=()=>({schema:'opmx.cms-observation.v1',destination:'OPURO',postId:10423,nonce,startedAt:new Date(clock).toISOString(),observedAt:new Date(clock).toISOString(),statusCode:200,post:{id:10423,type:'post',slug:'nota-verificada',status:'publish'},writeAuthorized:false});
const observer=(body,status=200)=>createCmsObserver({secret,now:()=>clock,nonceFactory:()=>nonce,fetchImpl:async()=>({status,json:async()=>body})});
test('CMS observation uses a fixed authenticated endpoint and returns only verified identity',async()=>{
 const read=createCmsObserver({secret,now:()=>clock,nonceFactory:()=>nonce,fetchImpl:async(url,options)=>{assert.equal(url,'https://n8n.oxigenopuro.com.mx/webhook/opmx-cms-observation-v1');assert.equal(options.redirect,'error');assert.deepEqual(JSON.parse(options.body),{destination:'OPURO',postId:10423,nonce});return {status:200,json:async()=>data()}}});assert.deepEqual(await read(input),{statusCode:200,post:data().post,writeAuthorized:false});
});
test('missing, deleted and unavailable records never authorize replacement',async()=>{
 for(const statusCode of [401,403,404,500]){const d=data();d.statusCode=statusCode;d.post=null;assert.deepEqual(await observer(d)(input),{statusCode,post:null,writeAuthorized:false})}
 const d=data();d.post.status='trash';assert.equal((await observer(d)(input)).post.status,'trash');
});
test('trash slug is accepted only by the explicit cancellation observer and only in trash',async()=>{
 const d=data();d.post.status='trash';d.post.slug='nota-verificada__trashed';
 assert.equal((await observer(d)(input)).statusCode,0);
 const read=createCmsObserver({secret,allowTrashedSlug:true,now:()=>clock,nonceFactory:()=>nonce,fetchImpl:async()=>({status:200,json:async()=>d})});
 assert.equal((await read(input)).post.status,'trash');assert.equal((await read(input)).writeAuthorized,false);
 for(const status of ['draft','publish']){d.post.status=status;assert.equal((await read(input)).statusCode,0)}
 d.post.status='trash';for(const slug of ['nota__trashed/evil','../nota__trashed','nota__trashed__trashed','nota__trashed-2']){d.post.slug=slug;assert.equal((await read(input)).statusCode,0)}
});
test('rejects cross-site, stale, replayed, forged and invalid identity observations',async t=>{
 const cases={site:d=>{d.destination='LIBERAL'},id:d=>{d.postId++},returnedId:d=>{d.post.id++},nonce:d=>{d.nonce='cms_'+'c'.repeat(48)},stale:d=>{d.startedAt=new Date(clock-60000).toISOString()},future:d=>{d.observedAt=new Date(clock+60000).toISOString()},slug:d=>{d.post.slug='../note'},type:d=>{d.post.type='page'},permission:d=>{d.writeAuthorized=true},status:d=>{d.post.status='unknown'}};
 for(const [name,mutate]of Object.entries(cases))await t.test(name,async()=>{const d=data();mutate(d);assert.equal((await observer(d)(input)).statusCode,0)});
});
test('arbitrary URLs and malformed IDs make no network request',async()=>{
 let calls=0;const read=createCmsObserver({secret,fetchImpl:async()=>{calls++;throw Error('must not call')}});
 for(const value of [{...input,site:'https://cms.oxigenopuro.com.mx.attacker.test'},{...input,postId:0},{...input,postId:'10423'},{...input,url:'https://example.test'}])assert.equal((await read(value)).statusCode,0);assert.equal(calls,0);
});
test('raw editorial fields require an explicitly requested, scope-bound projection',async()=>{
 const body={...data(),projection:'editorial'};body.post.title={raw:'Título exacto'};body.post.content={raw:'<!-- wp:paragraph --><p>Texto</p><!-- /wp:paragraph -->'};
 const read=createCmsObserver({secret,editorial:true,now:()=>clock,nonceFactory:()=>nonce,fetchImpl:async(url,options)=>{assert.equal(JSON.parse(options.body).projection,'editorial');return {status:200,json:async()=>body}}});
 assert.deepEqual((await read(input)).post.content,body.post.content);assert.equal(Object.hasOwn((await observer(body)(input)).post,'content'),false);
 delete body.projection;assert.equal((await read(input)).statusCode,0);
});
