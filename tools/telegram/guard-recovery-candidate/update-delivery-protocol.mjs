// Pure helpers embedded into the technical n8n transport. The webhook accepts
// only an opaque one-use job; content and target IDs must be returned by Guard.
export function parseUpdateDeliveryJob(body){
 if(!body||Object.keys(body).sort().join(',')!=='jobId,token'||!/^uj_[a-f0-9]{48}$/.test(body.jobId??'')||!/^[a-f0-9]{64}$/.test(body.token??''))throw Error('INVALID_UPDATE_DELIVERY_JOB');
 return {jobId:body.jobId,token:body.token};
}
export function acceptUpdateDeliveryGrant(job,response){
 const b=response?.body;
 if(response?.statusCode!==200||b?.status!=='UPDATE_PAYLOAD_GRANTED'||b.jobId!==job?.jobId||!['OPURO','OPOL','LIBERAL'].includes(b.destination)||!Number.isSafeInteger(b.postId)||b.postId<1||b.retryPermitted!==false||!b.payload||typeof b.payload!=='object'||Array.isArray(b.payload)||!Object.keys(b.payload).length||Object.keys(b.payload).some(k=>!['title','content','excerpt','featured_media','author','categories','tags','meta','status'].includes(k))||JSON.stringify(b.payload).length>4*1024*1024)throw Error('UPDATE_DELIVERY_NOT_GRANTED');
 return {jobId:b.jobId,destination:b.destination,postId:b.postId,payload:JSON.parse(JSON.stringify(b.payload))};
}
export function updateDeliveryResult(grant,response){
 const code=response?.statusCode;
 if(!Number.isInteger(code)||code<200||code>=300||response?.body?.id!==grant?.postId)return {status:'UPDATE_TRANSPORT_UNCERTAIN',retryPermitted:false};
 return {status:'UPDATE_TRANSPORT_CONFIRMED',jobId:grant.jobId,destination:grant.destination,postId:grant.postId,statusCode:code,retryPermitted:false};
}
