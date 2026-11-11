import {createHash} from 'node:crypto';
function canonicalGraphValue(value){
 if(value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalGraphValue).join(',')+']';
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error('WRITER_GRAPH_INVALID');
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalGraphValue(value[k])).join(',')+'}';
}

// Ignore canvas positions and UI labels, but bind every executable parameter,
// credential identity, error path and connection of the audited release.
export function writerGraphFingerprint(graph){
 if(!Array.isArray(graph?.nodes)||!graph.nodes.length||!graph.connections||typeof graph.connections!=='object'||Array.isArray(graph.connections)||new Set(graph.nodes.map(n=>n?.name)).size!==graph.nodes.length)throw Error('WRITER_GRAPH_INVALID');
 const nodes=graph.nodes.map(n=>{
  if(typeof n.name!=='string'||typeof n.type!=='string'||!Number.isFinite(n.typeVersion))throw Error('WRITER_NODE_INVALID');
  const credentials=Object.fromEntries(Object.entries(n.credentials??{}).map(([type,c])=>{if(typeof c?.id!=='string')throw Error('WRITER_CREDENTIAL_INVALID');return [type,c.id]}));
  return {name:n.name,type:n.type,typeVersion:n.typeVersion,disabled:n.disabled===true,parameters:n.parameters??{},credentials,onError:n.onError??'stopWorkflow',retryOnFail:n.retryOnFail===true,maxTries:n.maxTries??null,waitBetweenTries:n.waitBetweenTries??null,alwaysOutputData:n.alwaysOutputData===true,executeOnce:n.executeOnce===true};
 }).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
 return createHash('sha256').update(canonicalGraphValue({nodes,connections:graph.connections})).digest('hex');
}

// The manifest is built from inspected immutable n8n versions and the guarded
// writer path tests. A runtime read cannot add a version to this allow-list.
// This proves the deployed n8n release matches; the Guard still has to hold
// its own revision fence, validate every request binding, and reconcile CMS.
export function verifyWriterReleaseObservation(observation,manifest,{requireIdle=true}={}){
 if(!observation||observation.status!=='RUNTIME_OBSERVED'||observation.versionsMatch!==true||(requireIdle?observation.noActiveN8nWriters!==true:typeof observation.noActiveN8nWriters!=='boolean')||observation.authorizesRecovery!==false||observation.motorTerminationVerified!==false||manifest?.schema!=='opmx.fenced-writer-release.v1'||!manifest.workflows||!Array.isArray(observation.workflows))return false;
 const ids=Object.keys(manifest.workflows);
 if(![4,5].includes(ids.length)||observation.workflows.length!==ids.length||new Set(observation.workflows.map(w=>w?.id)).size!==ids.length)return false;
 try{return observation.workflows.every(w=>Object.hasOwn(manifest.workflows,w.id)&&w.activeVersionId===manifest.workflows[w.id].versionId&&/^[a-f0-9]{64}$/.test(manifest.workflows[w.id].graphHash)&&writerGraphFingerprint(w.graph)===manifest.workflows[w.id].graphHash)}catch{return false}
}
