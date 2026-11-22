// Converts a candidate clone into atomic n8n node/edge operations. The caller
// must separately verify the complete draft and active version before applying.
export function workflowPatchOperations(before,after){
 if(!Array.isArray(before?.nodes)||!Array.isArray(after?.nodes)||!before.connections||!after.connections)throw Error('WORKFLOW_PATCH_INVALID');
 const byName=nodes=>{const map=new Map();for(const n of nodes){if(!n?.name||map.has(n.name))throw Error('WORKFLOW_PATCH_INVALID');map.set(n.name,n)}return map};
 const a=byName(before.nodes),b=byName(after.nodes),ops=[];
 for(const name of a.keys())if(!b.has(name))throw Error('WORKFLOW_NODE_REMOVAL_NOT_SUPPORTED');
 for(const [name,n] of b){
  const old=a.get(name);
  if(!old){
   const allowed=['id','name','type','typeVersion','position','parameters','credentials','disabled','notes','onError','alwaysOutputData'];
   if(Object.keys(n).some(k=>!allowed.includes(k)))throw Error('WORKFLOW_NEW_NODE_FIELD_UNSUPPORTED');
   const {onError,alwaysOutputData,...node}=n;ops.push({type:'addNode',node});
   const settings={};if(onError!==undefined)settings.onError=onError;if(alwaysOutputData!==undefined)settings.alwaysOutputData=alwaysOutputData;
   if(Object.keys(settings).length)ops.push({type:'setNodeSettings',nodeName:name,settings});
  }else{
   const permitted=new Set(['parameters']);
   for(const key of new Set([...Object.keys(old),...Object.keys(n)]))if(!permitted.has(key)&&JSON.stringify(old[key])!==JSON.stringify(n[key]))throw Error('WORKFLOW_EXISTING_NODE_FIELD_CHANGED');
   if(JSON.stringify(old.parameters)!==JSON.stringify(n.parameters))ops.push({type:'updateNodeParameters',nodeName:name,parameters:n.parameters,replace:true});
  }
 }
 const edges=c=>{const map=new Map();for(const [source,types] of Object.entries(c))for(const [connectionType,lanes] of Object.entries(types)){if(!Array.isArray(lanes))throw Error('WORKFLOW_CONNECTION_INVALID');for(const [sourceIndex,lane] of lanes.entries())for(const e of lane??[]){if(typeof e?.node!=='string'||e.type!==connectionType||!Number.isSafeInteger(e.index))throw Error('WORKFLOW_CONNECTION_INVALID');const edge={source,target:e.node,connectionType,sourceIndex,targetIndex:e.index};const key=JSON.stringify(edge);if(map.has(key))throw Error('WORKFLOW_CONNECTION_DUPLICATE');map.set(key,edge)}}return map};
 const oldEdges=edges(before.connections),newEdges=edges(after.connections);
 for(const [key,edge] of oldEdges)if(!newEdges.has(key))ops.push({type:'removeConnection',...edge});
 for(const [key,edge] of newEdges)if(!oldEdges.has(key))ops.push({type:'addConnection',...edge});
 return ops;
}
