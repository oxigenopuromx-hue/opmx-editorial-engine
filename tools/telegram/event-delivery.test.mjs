import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createHmac} from 'node:crypto';
import {publicCallbackAddress,validateCallbackUrl,webhookSigningKey,standardWebhookSignature,subscriptionCipher,safeCallbackPost,signedCallbackPost,verifyEventCallback} from './event-delivery.mjs';
const secret='whsec_'+Buffer.alloc(32,77).toString('base64'),url='https://callbacks.chatgpt.com/mcp/events/test';
test('only public IPs and exact allowed HTTPS host families',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','192.0.2.1','224.1.1.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','64:ff9b::1','2002::1','3fff::1'])assert.equal(publicCallbackAddress(ip),false,ip);
 for(const ip of ['1.1.1.1','8.8.8.8','2606:4700::1111'])assert.equal(publicCallbackAddress(ip),true,ip);
 for(const bad of ['http://chatgpt.com/x','https://chatgpt.com.evil.test/x','https://evilchatgpt.com/x','https://u:p@chatgpt.com/x','https://chatgpt.com:444/x','https://chatgpt.com/x#secret','https://127.0.0.1/x','https://chatgpt.com/\nx'])assert.throws(()=>validateCallbackUrl(bad));
 assert.equal(validateCallbackUrl(url).hostname,'callbacks.chatgpt.com');
});
test('Standard Webhooks signs exact bytes and validates canonical 24–64 byte keys',()=>{
 const body='{"text":"Oxígeno"}',id='evt_fixture',time=1700000000;
 const expected='v1,'+createHmac('sha256',Buffer.alloc(32,77)).update(`${id}.${time}.${body}`).digest('base64');
 assert.equal(standardWebhookSignature(secret,id,time,body),expected);
 assert.notEqual(standardWebhookSignature(secret,id,time,body+' '),expected);
 for(const s of ['bad', 'whsec_AA==','whsec_'+Buffer.alloc(65).toString('base64'),secret+'%'])assert.throws(()=>webhookSigningKey(s));
});
test('subscription ciphertext is randomized, authenticated and bound to owner/id',()=>{
 const c=subscriptionCipher('f'.repeat(64)),value={url,secret},a=c.encrypt(value,'owner:sub'),b=c.encrypt(value,'owner:sub');
 assert.notEqual(a,b);assert.equal(a.includes(secret),false);assert.equal(a.includes(url),false);assert.deepEqual(c.decrypt(a,'owner:sub'),value);
 assert.throws(()=>c.decrypt(a,'another:sub'));assert.throws(()=>subscriptionCipher('e'.repeat(64)).decrypt(a,'owner:sub'));
 const x=JSON.parse(a);x.data='A'+x.data.slice(1);assert.throws(()=>c.decrypt(JSON.stringify(x),'owner:sub'));
});
test('DNS checked every send; validated address pinned while TLS verifies original host; no redirects',async()=>{
 let calls=0,pinned,options;
 const request=(o,cb)=>{options=o;o.lookup(o.hostname,{},(e,address)=>{pinned=address;});const req=new EventEmitter();req.destroy=()=>{};req.end=()=>{queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=302;res.headers={location:'http://127.0.0.1/'};res.destroy=()=>{};cb(res);res.emit('data',Buffer.from('{}'));res.emit('end');});};return req;};
 const lookup=async()=>{calls++;return [{address:'1.1.1.1',family:4}];};
 const r=await safeCallbackPost(url,{},'{}',{lookup,request});assert.equal(r.status,302);assert.equal(calls,1);assert.equal(pinned,'1.1.1.1');assert.equal(options.hostname,'callbacks.chatgpt.com');assert.equal(options.servername,options.hostname);assert.equal(options.rejectUnauthorized,true);assert.equal(options.agent,false);
 await assert.rejects(safeCallbackPost(url,{},'{}',{lookup:async()=>[{address:'127.0.0.1',family:4}],request}),e=>e.reason==='private_address');
 await assert.rejects(safeCallbackPost(url,{},'{}',{lookup:async()=>[{address:'1.1.1.1',family:4},{address:'::1',family:6}],request}),e=>e.reason==='private_address');
});
test('challenge exact echo required; unique signed verification, same event id/new timestamp on retry and dual rotation',async()=>{
 const captured=[],post=async(u,h,b)=>{captured.push({u,h,b});return {status:200,json:{challenge:JSON.parse(b).challenge}};};
 const sub={id:'sub_fixture',url,secret};await verifyEventCallback(sub,{post});await verifyEventCallback(sub,{post});assert.notEqual(captured[0].h['webhook-id'],captured[1].h['webhook-id']);
 await assert.rejects(verifyEventCallback(sub,{post:async()=>({status:200,json:{challenge:'wrong'}})}),e=>e.reason==='challenge_failed');
 const event={eventId:'evt_fixture',data:{package_id:'opaque'}},oldSecret='whsec_'+Buffer.alloc(32,31).toString('base64');
 await signedCallbackPost({...sub,oldSecret,oldUntil:3000},event,{post,now:()=>1000});await signedCallbackPost(sub,event,{post,now:()=>2000});
 assert.equal(captured[2].h['webhook-id'],captured[3].h['webhook-id']);assert.notEqual(captured[2].h['webhook-timestamp'],captured[3].h['webhook-timestamp']);assert.equal(captured[2].h['webhook-signature'].split(' ').length,2);
});
