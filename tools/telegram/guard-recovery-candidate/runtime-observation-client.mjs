import {randomBytes} from 'node:crypto';

export const runtimeObservationUrl='https://n8n.oxigenopuro.com.mx/webhook/opmx-runtime-observation-v1';
export const expectedRuntimeVersions=Object.freeze({
 bnzVMNkZuGO1GQCZ:'3f0147c7-7ac0-449d-9342-f4737277562e',
 Mt7ts2EGPbyaTC2o:'0a0af4ac-fe0d-4aff-a662-7e45bf87a320',
 '4o7K5TmKc7joScqB':'cce524a4-660e-4d05-af66-39e003c6338b',
 C4hk6fQQomueYC8f:'1eca0334-b3af-45d9-ac80-341e99a09faa'
});
const states=['running','waiting','new'];
const scopeValid=s=>s&&Object.keys(s).sort().join(',')==='eventId,packageId,revision'&&/^tg_[a-f0-9]{40}$/.test(s.packageId)&&/^evt_[a-f0-9]{48}$/.test(s.eventId)&&Number.isSafeInteger(s.revision)&&s.revision>0&&s.revision<=4294967295;
const unavailable=()=>Object.freeze({status:'RUNTIME_OBSERVATION_UNAVAILABLE',authorizesRecovery:false,motorTerminationVerified:false});

// This observes n8n, not the ChatGPT worker. Even complete empty execution
// pages and matching versions DO NOT attest termination, writer enforcement,
// CMS reconciliation, or permission to reopen. No recovery callback is exposed.
export function createRuntimeObserver({secret,fetchImpl=fetch,now=Date.now,nonceFactory=()=>`obs_${randomBytes(24).toString('hex')}`}={}){
 if(typeof secret!=='string'||!/^[a-f0-9]{64,}$/.test(secret)||typeof fetchImpl!=='function'||typeof now!=='function'||typeof nonceFactory!=='function')throw Error('RUNTIME_OBSERVER_CONFIGURATION_INVALID');
 return async function observe(scope){
  if(!scopeValid(scope))return unavailable();
  const nonce=nonceFactory();if(!/^obs_[a-f0-9]{48}$/.test(nonce))return unavailable();
  const started=now();
  try{
   const r=await fetchImpl(runtimeObservationUrl,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({...scope,nonce})});
   if(r.status!==200)return unavailable();
   const data=await r.json(),received=now(),ids=Object.keys(expectedRuntimeVersions);
   if(data?.schema!=='opmx.runtime-observation.v1'||data.authorizesRecovery!==false||data.motorTerminationVerified!==false||Object.keys(data.scope??{}).sort().join(',')!=='eventId,nonce,packageId,revision'||data.scope.nonce!==nonce||Object.keys(scope).some(k=>data.scope[k]!==scope[k]))return unavailable();
   const begin=Date.parse(data.startedAt),end=Date.parse(data.observedAt);
   if(!Number.isFinite(begin)||!Number.isFinite(end)||begin> end||begin<started-5000||end>received+5000||received-started>30000)return unavailable();
   if(!Array.isArray(data.workflows)||data.workflows.length!==ids.length||new Set(data.workflows.map(w=>w?.id)).size!==ids.length||data.workflows.some(w=>!ids.includes(w?.id)||w.activeVersionId!==expectedRuntimeVersions[w.id]||!Array.isArray(w.graph?.nodes)||!w.graph.nodes.length||!w.graph.connections||typeof w.graph.connections!=='object'))return unavailable();
   if(!Array.isArray(data.executionPages)||data.executionPages.length!==states.length||new Set(data.executionPages.map(p=>p?.status)).size!==states.length||data.executionPages.some(p=>!states.includes(p?.status)||p.complete!==true||!Array.isArray(p.executions)||p.executions.some(x=>!ids.includes(x?.workflowId)||x.status!==p.status||typeof x.id!=='string'||!/^\d+$/.test(x.id)||x.stoppedAt!==null)))return unavailable();
   return Object.freeze({status:'RUNTIME_OBSERVED',scope:Object.freeze({...scope}),observedAt:data.observedAt,versionsMatch:true,noActiveN8nWriters:data.executionPages.every(p=>p.executions.length===0),workflows:data.workflows,executionPages:data.executionPages,authorizesRecovery:false,motorTerminationVerified:false});
  }catch{return unavailable()}
 };
}
