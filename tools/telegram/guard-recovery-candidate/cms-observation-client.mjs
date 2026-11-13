import {randomBytes} from 'node:crypto';
import {destinationRegistry} from './original-destinations.mjs';
const endpoint='https://n8n.oxigenopuro.com.mx/webhook/opmx-cms-observation-v1';
const unavailable=()=>({statusCode:0,post:null,writeAuthorized:false});

// The caller derives the site and original ID from the locked publication
// ledger. A 404, deleted post or unavailable CMS is NEVER evidence of absence
// or permission to create a replacement. This transport performs only GETs.
export function createCmsObserver({secret,fetchImpl=fetch,now=Date.now,nonceFactory=()=>`cms_${randomBytes(24).toString('hex')}`,editorial=false,allowTrashedSlug=false}={}){
 if(typeof secret!=='string'||!/^[a-f0-9]{64,}$/.test(secret)||typeof fetchImpl!=='function'||typeof now!=='function'||typeof nonceFactory!=='function'||typeof allowTrashedSlug!=='boolean')throw Error('CMS_OBSERVER_CONFIGURATION_INVALID');
 return async function readWordPress(input){
  if(!input||Object.keys(input).sort().join(',')!=='postId,site'||!Number.isSafeInteger(input.postId)||input.postId<1)return unavailable();
  const entry=Object.entries(destinationRegistry()).find(([,v])=>v.cms===input.site);if(!entry)return unavailable();
  const destination=entry[0],nonce=nonceFactory();if(!/^cms_[a-f0-9]{48}$/.test(nonce))return unavailable();
  const started=now();
  try{
   const r=await fetchImpl(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({destination,postId:input.postId,nonce,...(editorial?{projection:'editorial'}:{})})});
   if(r.status!==200)return unavailable();
   const data=await r.json(),received=now(),begin=Date.parse(data?.startedAt),end=Date.parse(data?.observedAt);
   if(data?.schema!=='opmx.cms-observation.v1'||data.writeAuthorized!==false||data.destination!==destination||data.postId!==input.postId||data.nonce!==nonce||!Number.isFinite(begin)||!Number.isFinite(end)||begin>end||begin<started-5000||end>received+5000||received-started>15000||!Number.isSafeInteger(data.statusCode)||data.statusCode<100||data.statusCode>599)return unavailable();
   if(data.statusCode!==200)return {statusCode:data.statusCode,post:null,writeAuthorized:false};
   const p=data.post;
   const slugValid=typeof p?.slug==='string'&&(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)||allowTrashedSlug&&p.status==='trash'&&/^[a-z0-9]+(?:-[a-z0-9]+)*__trashed$/.test(p.slug));
   if(!p||p.id!==input.postId||p.type!=='post'||typeof p.slug!=='string'||p.slug.length>200||!slugValid||!['publish','draft','trash','private','pending','future'].includes(p.status))return unavailable();
   const post={id:p.id,type:p.type,slug:p.slug,status:p.status};
   if(editorial){
    if(data.projection!=='editorial'||JSON.stringify(p).length>4*1024*1024)return unavailable();
    for(const key of ['title','content','excerpt','featured_media','author','categories','tags','meta'])if(Object.hasOwn(p,key))post[key]=JSON.parse(JSON.stringify(p[key]));
   }
   return {statusCode:200,post,writeAuthorized:false};
  }catch{return unavailable()}
 };
}
