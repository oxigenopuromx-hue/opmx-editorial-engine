import writerReleaseManifest from './writer-release-manifest.mjs';
import {randomBytes} from 'node:crypto';

export const runtimeObservationUrl='https://n8n.oxigenopuro.com.mx/webhook/opmx-runtime-observation-v1';
export const expectedRuntimeVersions=Object.freeze(Object.fromEntries(Object.entries(writerReleaseManifest.workflows).map(([id,w])=>[id,w.versionId])));
const states=['running','waiting','new'];
const scopeValid=s=>s&&Object.keys(s).sort().join(',')==='eventId,packageId,revision'&&/^tg_[a-f0-9]{40}$/.test(s.packageId)&&/^evt_[a-f0-9]{48}$/.test(s.eventId)&&Number.isSafeInteger(s.revision)&&s.revision>0&&s.revision<=4294967295;
const diagnosticCodes=new Set(['REQUEST','NONCE','HTTPSTATUS','SCOPE','TIME','WORKFLOWS','EXECUTIONS','JSON','NETWORK','TIMEOUT']);
const unavailable=(code='NETWORK',{httpStatus,workflows}={})=>{
 const diagnostic={code:diagnosticCodes.has(code)?code:'NETWORK'};
 if(Number.isSafeInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599)diagnostic.httpStatus=httpStatus;
 if(code==='WORKFLOWS'){
  diagnostic.workflowCount=Array.isArray(workflows)?workflows.length:null;
  diagnostic.observedWorkflows=Array.isArray(workflows)?workflows.slice(0,5).map(w=>({workflowId:Object.hasOwn(expectedRuntimeVersions,w?.id??'')?w.id:'UNRECOGNIZED_WORKFLOW',versionId:typeof w?.activeVersionId==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(w.activeVersionId)?w.activeVersionId:'INVALID_VERSION'})):[];
 }
 return Object.freeze({status:'RUNTIME_OBSERVATION_UNAVAILABLE',authorizesRecovery:false,motorTerminationVerified:false,diagnostic:Object.freeze(diagnostic)});
};
const internalRecoveryOrigin=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')==='executionId,workflowId'&&x.workflowId==='bnzVMNkZuGO1GQCZ'&&typeof x.executionId==='string'&&/^[1-9][0-9]{0,31}$/.test(x.executionId);

// This observes n8n, not the ChatGPT worker. Even complete empty execution
// pages and matching versions DO NOT attest termination, writer enforcement,
// CMS reconciliation, or permission to reopen. No recovery callback is exposed.
export function createRuntimeObserver({secret,fetchImpl=fetch,now=Date.now,nonceFactory=()=>`obs_${randomBytes(24).toString('hex')}`}={}){
 if(typeof secret!=='string'||!/^[a-f0-9]{64,}$/.test(secret)||typeof fetchImpl!=='function'||typeof now!=='function'||typeof nonceFactory!=='function')throw Error('RUNTIME_OBSERVER_CONFIGURATION_INVALID');
 return async function observe(scope,options={}){
  if(!scopeValid(scope)||!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>k!=='nonWritingRecoveryExecution')||Object.hasOwn(options,'nonWritingRecoveryExecution')&&!internalRecoveryOrigin(options.nonWritingRecoveryExecution))return unavailable('REQUEST');
  const origin=options.nonWritingRecoveryExecution;
  let nonce;try{nonce=nonceFactory()}catch{return unavailable('NONCE')}if(!/^obs_[a-f0-9]{48}$/.test(nonce))return unavailable('NONCE');
  let started;try{started=now()}catch{return unavailable('TIME')}if(!Number.isFinite(started))return unavailable('TIME');
  try{
   const r=await fetchImpl(runtimeObservationUrl,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({...scope,nonce,...(origin?{nonWritingRecoveryExecution:origin}:{})})});
   if(r.status!==200)return unavailable('HTTPSTATUS',{httpStatus:r.status});
   let data;try{data=await r.json()}catch{return unavailable('JSON')}
   let received;try{received=now()}catch{return unavailable('TIME')}if(!Number.isFinite(received))return unavailable('TIME');const ids=Object.keys(expectedRuntimeVersions);
   if(data?.schema!=='opmx.runtime-observation.v1'||data.authorizesRecovery!==false||data.motorTerminationVerified!==false||Object.keys(data.scope??{}).sort().join(',')!=='eventId,nonce,packageId,revision'||Object.keys(scope).some(k=>data.scope[k]!==scope[k]))return unavailable('SCOPE');
   if(data.scope.nonce!==nonce)return unavailable('NONCE');
   const begin=Date.parse(data.startedAt),end=Date.parse(data.observedAt);
   if(!Number.isFinite(begin)||!Number.isFinite(end)||begin> end||begin<started-5000||end>received+5000||received-started>30000)return unavailable('TIME');
   if(!Array.isArray(data.workflows)||data.workflows.length!==ids.length||new Set(data.workflows.map(w=>w?.id)).size!==ids.length||data.workflows.some(w=>!ids.includes(w?.id)||w.activeVersionId!==expectedRuntimeVersions[w.id]||!Array.isArray(w.graph?.nodes)||!w.graph.nodes.length||!w.graph.connections||typeof w.graph.connections!=='object'))return unavailable('WORKFLOWS',{workflows:data.workflows});
   if(!Array.isArray(data.executionPages)||data.executionPages.length!==states.length||new Set(data.executionPages.map(p=>p?.status)).size!==states.length||data.executionPages.some(p=>!states.includes(p?.status)||p.complete!==true||!Array.isArray(p.executions)||p.executions.some(x=>!ids.includes(x?.workflowId)||x.status!==p.status||typeof x.id!=='string'||!/^\d+$/.test(x.id)||x.stoppedAt!==null)))return unavailable('EXECUTIONS');
   const executions=data.executionPages.flatMap(p=>p.executions),idle=executions.length===0;
   // The HTTP adapter derives this context from n8n's own workflow/execution
   // variables only for the pinned administrative recovery route. It is not
   // part of the public tool arguments or of /runtime/observe's request body.
   // Keep the real active execution visible; the ordinary global idle flag
   // remains false. Only the blocked recovery gate may opt into this proof.
   const matching=origin?executions.filter(x=>x.workflowId===origin.workflowId&&x.id===origin.executionId&&x.status==='running'):[];
   const proof=data.administrativeExecutionProof;
   const administrative=origin&&matching.length===1&&proof&&typeof proof==='object'&&!Array.isArray(proof)&&Object.keys(proof).sort().join(',')==='id,mode,startedAt,status,stoppedAt,workflowId,workflowVersionId'&&proof.id===origin.executionId&&proof.workflowId===origin.workflowId&&proof.workflowVersionId===expectedRuntimeVersions[origin.workflowId]&&proof.mode==='webhook'&&proof.status==='running'&&proof.stoppedAt===null&&Number.isFinite(Date.parse(proof.startedAt))&&Date.parse(proof.startedAt)===Date.parse(matching[0].startedAt)&&Date.parse(proof.startedAt)<=end+5000;
   return Object.freeze({status:'RUNTIME_OBSERVED',scope:Object.freeze({...scope}),observedAt:data.observedAt,versionsMatch:true,noActiveN8nWriters:idle,workflows:data.workflows,executionPages:data.executionPages,authorizesRecovery:false,motorTerminationVerified:false,...(origin?{noActivePublicationWriters:idle||administrative===true&&executions.length===1,...(administrative?{nonWritingAdministrativeExecution:Object.freeze({...origin,status:'running',provenance:'PINNED_INTERNAL_RECOVERY_ROUTE'}),administrativeExecutionProof:Object.freeze({...proof})}:{})}:{})});
  }catch(error){return unavailable(['TimeoutError','AbortError'].includes(error?.name)||error?.code==='ETIMEDOUT'?'TIMEOUT':'NETWORK')}
 };
}
