import {validUpdatePayload} from './update-executor.mjs';

// Candidate transport for the existing server-side executor. The calling
// server supplies credentials privately; neither callers nor article sources
// can choose hosts, headers, paths, or credentials. No automatic retries.
const hosts=Object.freeze({OPURO:'cms.oxigenopuro.com.mx',OPOL:'cms.oxigenopolitico.com.mx',LIBERAL:'cms.elliberal.mx'});
const maxBytes=8*1024*1024;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const idOk=x=>Number.isSafeInteger(x)&&x>0;
async function bodyJson(response){
 const advertised=response.headers.get('content-length');
 if(advertised!==null&&(!/^[0-9]+$/.test(advertised)||Number(advertised)>maxBytes))throw Error('CMS_RESPONSE_INVALID');
 if(!response.body)throw Error('CMS_RESPONSE_INVALID');
 const reader=response.body.getReader();let chunks=[],size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw Error('CMS_RESPONSE_INVALID');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
 let data;try{data=JSON.parse(Buffer.concat(chunks.map(x=>Buffer.from(x))).toString('utf8'))}catch{throw Error('CMS_RESPONSE_INVALID')}
 if(!plain(data))throw Error('CMS_RESPONSE_INVALID');return data;
}
export function createWordPressTransport({credentials,fetchImpl=globalThis.fetch,timeoutMs=15000}){
 if(!plain(credentials)||Object.keys(credentials).sort().join(',')!=='LIBERAL,OPOL,OPURO'||typeof fetchImpl!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>60000)throw Error('CMS_TRANSPORT_CONFIGURATION_INVALID');
 for(const destination of Object.keys(hosts))if(typeof credentials[destination]!=='string'||!/^Basic [A-Za-z0-9+/]+={0,2}$/.test(credentials[destination]))throw Error('CMS_TRANSPORT_CONFIGURATION_INVALID');
 const secrets={...credentials};
 async function request(input,write){
  const keys=write?'destination,payload,postId':'destination,postId';
  if(!plain(input)||Object.keys(input).sort().join(',')!==keys||!Object.hasOwn(hosts,input.destination)||!idOk(input.postId)||write&&!validUpdatePayload(input.payload))throw Error('INVALID_CMS_REQUEST');
  const url=`https://${hosts[input.destination]}/wp-json/wp/v2/posts/${input.postId}?context=edit`;
  const headers={authorization:secrets[input.destination],accept:'application/json'};
  const init={method:write?'POST':'GET',headers,redirect:'error',signal:AbortSignal.timeout(timeoutMs)};
  if(write){headers['content-type']='application/json';init.body=JSON.stringify(input.payload)}
  const response=await fetchImpl(url,init);
  if(!response||!Number.isInteger(response.status)||response.status<100||response.status>599||response.redirected===true||response.status>=300&&response.status<400)throw Error('CMS_RESPONSE_INVALID');
  if(response.status<200||response.status>=300)return {statusCode:response.status};
  const post=await bodyJson(response);
  return {statusCode:response.status,post};
 }
 return Object.freeze({read:input=>request(input,false),update:input=>request(input,true)});
}
