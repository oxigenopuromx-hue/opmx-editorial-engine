import {createHmac,createCipheriv,createDecipheriv,hkdfSync,randomBytes,timingSafeEqual} from 'node:crypto';
import {BlockList,isIP} from 'node:net';
import {lookup as dnsLookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';

export class EventDeliveryError extends Error {constructor(reason){super(reason);this.reason=reason;}}
const fail=reason=>{throw new EventDeliveryError(reason);};
const denied4=new BlockList(),denied6=new BlockList(),global6=new BlockList();
for(const [address,prefix]of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])denied4.addSubnet(address,prefix,'ipv4');
global6.addSubnet('2000::',3,'ipv6');
for(const [address,prefix]of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])denied6.addSubnet(address,prefix,'ipv6');

export function publicCallbackAddress(address) {
 const family=isIP(address);
 return family===4?!denied4.check(address,'ipv4'):family===6&&global6.check(address,'ipv6')&&!denied6.check(address,'ipv6');
}
export function validateCallbackUrl(value) {
 if(typeof value!=='string'||value.length>4096||/[\x00-\x20]/.test(value))fail('callback_url');
 let u;try{u=new URL(value);}catch{fail('callback_url');}
 const h=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||u.hash||(u.port&&u.port!=='443')||isIP(h)||!(h==='openai.com'||h.endsWith('.openai.com')||h==='chatgpt.com'||h.endsWith('.chatgpt.com')))fail('callback_url');
 return u;
}
export function webhookSigningKey(secret) {
 if(typeof secret!=='string'||!secret.startsWith('whsec_')||secret.length>100)fail('signing_secret');
 const encoded=secret.slice(6);
 if(!encoded||/[^A-Za-z0-9+/=]/.test(encoded)||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))fail('signing_secret');
 const bytes=Buffer.from(encoded,'base64');
 if(bytes.length<24||bytes.length>64||bytes.toString('base64').replace(/=+$/,'')!==encoded.replace(/=+$/,''))fail('signing_secret');
 return bytes;
}
export function standardWebhookSignature(secret,id,unixSeconds,body) {
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id)||!Number.isSafeInteger(unixSeconds)||unixSeconds<0||typeof body!=='string')fail('signature_input');
 return 'v1,'+createHmac('sha256',webhookSigningKey(secret)).update(id+'.'+unixSeconds+'.','utf8').update(body,'utf8').digest('base64');
}
export function subscriptionCipher(guardSecret) {
 if(typeof guardSecret!=='string'||!/^[a-f0-9]{64,}$/.test(guardSecret))fail('storage_key');
 const key=Buffer.from(hkdfSync('sha256',Buffer.from(guardSecret,'hex'),Buffer.from('opmx-events-v1'),Buffer.from('subscription-encryption'),32));
 return {
  encrypt(value,aad){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(aad));const data=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return JSON.stringify({v:1,iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),data:data.toString('base64')});},
  decrypt(value,aad){try{const x=JSON.parse(value);if(x.v!==1)fail('storage');const c=createDecipheriv('aes-256-gcm',key,Buffer.from(x.iv,'base64'));c.setAAD(Buffer.from(aad));c.setAuthTag(Buffer.from(x.tag,'base64'));return JSON.parse(Buffer.concat([c.update(Buffer.from(x.data,'base64')),c.final()]).toString('utf8'));}catch{fail('storage');}}
 };
}

export async function safeCallbackPost(url,headers,body,{lookup=dnsLookup,request=httpsRequest,timeoutMs=10000}={}) {
 const u=validateCallbackUrl(url);
 let addresses,dnsTimer;try{addresses=await Promise.race([lookup(u.hostname,{all:true,verbatim:true}),new Promise((_,reject)=>{dnsTimer=setTimeout(()=>reject(new EventDeliveryError('timeout')),timeoutMs);dnsTimer.unref?.();})]);}catch(e){fail(e?.reason==='timeout'?'timeout':'dns');}finally{clearTimeout(dnsTimer);}
 if(!Array.isArray(addresses)||!addresses.length||addresses.some(x=>!publicCallbackAddress(x.address)||isIP(x.address)!==Number(x.family)))fail('private_address');
 const selected=addresses.find(x=>Number(x.family)===4)??addresses[0];
 return await new Promise((resolve,reject)=>{
  let done=false,req,timer;
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);if(error)reject(new EventDeliveryError(error));else resolve(value);};
  try{
   req=request({hostname:u.hostname,port:443,path:u.pathname+u.search,method:'POST',servername:u.hostname,rejectUnauthorized:true,agent:false,autoSelectFamily:false,family:Number(selected.family),lookup:(_host,_options,cb)=>cb(null,selected.address,Number(selected.family)),headers:{...headers,'Content-Length':String(Buffer.byteLength(body))}},res=>{
    const chunks=[];let size=0;
    res.on('data',chunk=>{size+=chunk.length;if(size>65536){res.destroy();req.destroy();finish('response_too_large');return;}chunks.push(chunk);});
    res.on('error',()=>finish('network'));
    res.on('end',()=>{let json=null;try{json=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{}finish(null,{status:Number(res.statusCode),json,retryAfter:typeof res.headers['retry-after']==='string'?res.headers['retry-after']:null});});
   });
   req.on('error',()=>finish('network'));
   timer=setTimeout(()=>{req.destroy();finish('timeout');},timeoutMs);timer.unref?.();req.end(body);
  }catch{finish('network');}
 });
}

export async function signedCallbackPost(subscription,event,{post=safeCallbackPost,now=Date.now}={}) {
 const body=JSON.stringify(event);if(Buffer.byteLength(body)>262144)fail('payload_too_large');
 const id=event.eventId??'verify_'+randomBytes(16).toString('hex'),time=Math.floor(now()/1000);
 const keys=[subscription.secret,...(subscription.oldSecret&&subscription.oldUntil>now()?[subscription.oldSecret]:[])];
 const headers={'Content-Type':'application/json','webhook-id':id,'webhook-timestamp':String(time),'webhook-signature':keys.map(key=>standardWebhookSignature(key,id,time,body)).join(' '),'X-MCP-Subscription-Id':subscription.id};
 return await post(subscription.url,headers,body);
}
export async function verifyEventCallback(subscription,{post=safeCallbackPost,now=Date.now}={}) {
 const challenge=randomBytes(32).toString('base64url'),started=now();
 let result;try{result=await signedCallbackPost(subscription,{type:'verification',challenge},{post,now});}catch(e){throw new EventDeliveryError(e?.reason??'network');}
 const actual=typeof result.json?.challenge==='string'?Buffer.from(result.json.challenge):Buffer.alloc(0),expected=Buffer.from(challenge);
 if(result.status<200||result.status>=300||now()-started>11000||actual.length!==expected.length||!timingSafeEqual(actual,expected))fail('challenge_failed');
}
