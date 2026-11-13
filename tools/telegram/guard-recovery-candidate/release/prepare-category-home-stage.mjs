import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {categoryHomeBase,buildCategoryHomeSharedOperations,buildCategoryHomePublicationOperations,buildCategoryHomeMcpStaticOperations} from '../receiver/build-category-home-operations.mjs';
import {buildPlacementWriterGateOperations} from '../receiver/build-placement-writer-gate-operations.mjs';
import {buildPlacementInventoryOperations} from '../receiver/build-placement-inventory-operations.mjs';
import {writerGraphFingerprint} from '../writer-release-contract.mjs';
import {canonicalUpdateValue} from '../canonical-json.mjs';

export const stage13Ids=Object.freeze({shared:'4o7K5TmKc7joScqB',form:'Mt7ts2EGPbyaTC2o',mcp:'bnzVMNkZuGO1GQCZ',update:'qBmLf0DmcMSfuWvm',reader:'C4hk6fQQomueYC8f'});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const clone=x=>JSON.parse(JSON.stringify(x));
const sha=x=>createHash('sha256').update(x).digest('hex');
function unwrap(value) {
 if(value?.structuredContent)return unwrap(value.structuredContent);
 if(Array.isArray(value?.content)){for(const item of value.content)if(item.type==='text'){try{return unwrap(JSON.parse(item.text))}catch{}}}
 return value;
}
export function stage13ActiveSnapshot(value,id) {
 const data=unwrap(value),w=data?.workflow??data;
 if(w?.id!==id||w.active!==true||!uuid.test(w.activeVersionId??'')||!uuid.test(w.versionId??'')||!Array.isArray(w.nodes)||!w.connections)throw Error('CATEGORY_HOME_ACTIVE_SNAPSHOT_INVALID:'+id);
 const active=w.activeVersion?.sameAsDraft===true?w:w.activeVersion;
 if(!active||!Array.isArray(active.nodes)||!active.connections)throw Error('CATEGORY_HOME_ACTIVE_GRAPH_MISSING:'+id);
 return {graph:{id,versionId:w.activeVersionId,nodes:clone(active.nodes),connections:clone(active.connections),nodeGroups:clone(active.nodeGroups??[])},draft:{workflowId:id,versionId:w.versionId,nodes:clone(w.nodes),connections:clone(w.connections),nodeGroups:clone(w.nodeGroups??[]),settings:clone(w.settings??{})}};
}
export function stage13SavedSnapshot(value,id) {
 const data=unwrap(value);
 if(data?.workflowId!==id||data.success!==true||!uuid.test(data.versionId??'')||!Array.isArray(data.nodes)||!data.connections)throw Error('CATEGORY_HOME_SAVED_VERSION_INVALID:'+id);
 return {id,versionId:data.versionId,nodes:clone(data.nodes),connections:clone(data.connections),nodeGroups:clone(data.nodeGroups??[])};
}
export function applyStage13Operations(graph,operations) {
 const next=clone(graph);
 const node=name=>{const matches=next.nodes.filter(n=>n.name===name);if(matches.length!==1)throw Error('CATEGORY_HOME_APPLY_NODE_INVALID:'+name);return matches[0]};
 for(const op of operations){
  if(op.type==='updateNodeParameters')node(op.nodeName).parameters=clone(op.parameters);
  else if(op.type==='addNode'){if(next.nodes.some(n=>n.name===op.node.name))throw Error('CATEGORY_HOME_APPLY_DUPLICATE');next.nodes.push(clone(op.node))}
  else if(op.type==='setNodeSettings')Object.assign(node(op.nodeName),clone(op.settings));
  else if(op.type==='addNodeGroup'){next.nodeGroups??=[];const {type,...group}=op;if(next.nodeGroups.some(g=>g.id===group.id||g.name===group.name))throw Error('CATEGORY_HOME_GROUP_DUPLICATE');next.nodeGroups.push(clone(group))}
  else if(op.type==='addConnection'||op.type==='removeConnection'){
   const kind=op.connectionType??'main',sourceIndex=op.sourceIndex??0,targetIndex=op.targetIndex??0;next.connections[op.source]??={};next.connections[op.source][kind]??=[];const lanes=next.connections[op.source][kind];while(lanes.length<=sourceIndex)lanes.push([]);lanes[sourceIndex]??=[];
   const edges=lanes[sourceIndex],match=e=>e.node===op.target&&e.type===kind&&e.index===targetIndex,found=edges.filter(match);
   if(op.type==='removeConnection'){if(found.length!==1)throw Error('CATEGORY_HOME_APPLY_EDGE_CHANGED');lanes[sourceIndex]=edges.filter(e=>!match(e))}
   else {if(found.length)throw Error('CATEGORY_HOME_APPLY_DUPLICATE_EDGE');edges.push({node:op.target,type:kind,index:targetIndex})}
  }else throw Error('CATEGORY_HOME_APPLY_OPERATION_INVALID:'+op.type);
 }
 return next;
}
const jsonFile=async path=>JSON.parse(await readFile(path,'utf8'));
const save=async(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});
const saveText=async(path,value)=>writeFile(path,value,{mode:0o600});
const samePrepared=(saved,expected,label)=>{
 if(saved.id!==expected.id||saved.versionId===expected.versionId||writerGraphFingerprint(saved)!==writerGraphFingerprint(expected)||canonicalUpdateValue(saved.nodeGroups)!==canonicalUpdateValue(expected.nodeGroups))throw Error('CATEGORY_HOME_SAVED_GRAPH_DIFFERS:'+label);
};

export async function prepareStage13({snapshotDir,outputDir,baselineManifest}) {
 if(baselineManifest?.schema!=='opmx.fenced-writer-release.v1'||Object.keys(baselineManifest.workflows??{}).sort().join(',')!==Object.values(stage13Ids).sort().join(','))throw Error('CATEGORY_HOME_BASE_MANIFEST_INVALID');
 const snapshots={};
 for(const [label,id]of Object.entries(stage13Ids)){
  const raw=await jsonFile(join(snapshotDir,id+'.json')),snapshot=stage13ActiveSnapshot(raw,id),pin=baselineManifest.workflows[id];
  if(snapshot.graph.versionId!==pin.versionId||writerGraphFingerprint(snapshot.graph)!==pin.graphHash)throw Error('CATEGORY_HOME_BASELINE_REBASE_REQUIRED:'+label);
  snapshots[label]=snapshot;
 }
 const sharedMetaOps=buildCategoryHomeSharedOperations(snapshots.shared.graph,categoryHomeBase(snapshots.shared.graph));
 const sharedMeta=applyStage13Operations(snapshots.shared.graph,sharedMetaOps);
 const sharedOps=[...sharedMetaOps,...buildPlacementWriterGateOperations(sharedMeta,categoryHomeBase(sharedMeta),{kind:'shared'})];
 const formOps=buildCategoryHomePublicationOperations(snapshots.form.graph,categoryHomeBase(snapshots.form.graph),{normalizerCopy:true});
 const sharedPrepared=applyStage13Operations(snapshots.shared.graph,sharedOps),formPrepared=applyStage13Operations(snapshots.form.graph,formOps);
 await mkdir(outputDir,{mode:0o700});
 await save(join(outputDir,'baseline-private.json'),snapshots);await save(join(outputDir,'baseline-manifest.json'),baselineManifest);
 await save(join(outputDir,'shared-operations-private.json'),sharedOps);await save(join(outputDir,'form-operations-private.json'),formOps);
 await save(join(outputDir,'shared-prepared-private.json'),sharedPrepared);await save(join(outputDir,'form-prepared-private.json'),formPrepared);
 const plan={status:'CATEGORY_HOME_STAGE13_PREPARED_NOT_PUBLISHED',baselines:Object.fromEntries(Object.entries(snapshots).map(([label,s])=>[label,{workflowId:s.graph.id,activeVersionId:s.graph.versionId,activeNodes:s.graph.nodes.length,draftVersionId:s.draft.versionId,draftNodes:s.draft.nodes.length,preserveDraft:s.graph.versionId!==s.draft.versionId}])),sharedOps:sharedOps.length,formOps:formOps.length,sharedExpectedHash:writerGraphFingerprint(sharedPrepared),formExpectedHash:writerGraphFingerprint(formPrepared),cmsWrites:0,n8nMutations:0};
 await save(join(outputDir,'plan.json'),plan);return plan;
}

export async function refreshStage13Mcp({outputDir,savedSharedFile}) {
 const baseline=await jsonFile(join(outputDir,'baseline-private.json')),prepared=await jsonFile(join(outputDir,'shared-prepared-private.json'));
 const shared=stage13SavedSnapshot(await jsonFile(savedSharedFile),stage13Ids.shared);samePrepared(shared,prepared,'shared');
 const mcpMetaOps=[...buildCategoryHomePublicationOperations(baseline.mcp.graph,categoryHomeBase(baseline.mcp.graph)),...buildCategoryHomeMcpStaticOperations(baseline.mcp.graph,baseline.shared.graph,shared,categoryHomeBase(baseline.mcp.graph))];
 const mcpMeta=applyStage13Operations(baseline.mcp.graph,mcpMetaOps);
 const mcpGateOps=buildPlacementWriterGateOperations(mcpMeta,categoryHomeBase(mcpMeta),{kind:'mcp'});
 const mcpGate=applyStage13Operations(mcpMeta,mcpGateOps);
 const mcpOps=[...mcpMetaOps,...mcpGateOps,...buildPlacementInventoryOperations(mcpGate,categoryHomeBase(mcpGate))];
 const mcpPrepared=applyStage13Operations(baseline.mcp.graph,mcpOps);
 await save(join(outputDir,'shared-saved-private.json'),shared);await save(join(outputDir,'mcp-operations-private.json'),mcpOps);await save(join(outputDir,'mcp-prepared-private.json'),mcpPrepared);
 const result={status:'CATEGORY_HOME_MCP13_PREPARED_NOT_PUBLISHED',sharedVersionId:shared.versionId,sharedHash:writerGraphFingerprint(shared),mcpOps:mcpOps.length,mcpExpectedHash:writerGraphFingerprint(mcpPrepared),cmsWrites:0,n8nMutations:0};await save(join(outputDir,'mcp-plan.json'),result);return result;
}

export async function finalizeStage13({outputDir,savedFormFile,savedMcpFile}) {
 const baseline=await jsonFile(join(outputDir,'baseline-private.json')),manifest=await jsonFile(join(outputDir,'baseline-manifest.json'));
 const shared=await jsonFile(join(outputDir,'shared-saved-private.json')),form=stage13SavedSnapshot(await jsonFile(savedFormFile),stage13Ids.form),mcp=stage13SavedSnapshot(await jsonFile(savedMcpFile),stage13Ids.mcp);
 samePrepared(form,await jsonFile(join(outputDir,'form-prepared-private.json')),'form');samePrepared(mcp,await jsonFile(join(outputDir,'mcp-prepared-private.json')),'mcp');
 for(const graph of [shared,form,mcp])manifest.workflows[graph.id]={versionId:graph.versionId,graphHash:writerGraphFingerprint(graph)};
 for(const label of ['update','reader']){const g=baseline[label].graph,pin=manifest.workflows[g.id];if(pin.versionId!==g.versionId||pin.graphHash!==writerGraphFingerprint(g))throw Error('CATEGORY_HOME_UNCHANGED_WRITER_DRIFT')}
 await save(join(outputDir,'form-saved-private.json'),form);await save(join(outputDir,'mcp-saved-private.json'),mcp);
 await saveText(join(outputDir,'writer-release-manifest.mjs'),'// Issue13: optional OPURO category-home policy; exact saved writer versions.\nexport default '+JSON.stringify(manifest,null,2)+';\n');
 const result={status:'CATEGORY_HOME_MANIFEST13_PREPARED_NOT_DEPLOYED',workflows:manifest.workflows,manifestSha256:sha(await readFile(join(outputDir,'writer-release-manifest.mjs'))),preservedDrafts:Object.fromEntries(Object.entries(baseline).filter(([,s])=>s.draft.versionId!==s.graph.versionId).map(([label,s])=>[label,{workflowId:s.graph.id,versionId:s.draft.versionId,nodes:s.draft.nodes.length}])),cmsWrites:0,n8nMutations:0};await save(join(outputDir,'final-plan.json'),result);return result;
}

async function main(argv){
 const [command,a,b,c]=argv;
 if(command==='prepare'&&a&&b&&c){const manifest=(await import(pathToFileURL(resolve(c)).href)).default;return prepareStage13({snapshotDir:resolve(a),outputDir:resolve(b),baselineManifest:manifest})}
 if(command==='refresh-mcp'&&a&&b)return refreshStage13Mcp({outputDir:resolve(a),savedSharedFile:resolve(b)});
 if(command==='finalize'&&a&&b&&c)return finalizeStage13({outputDir:resolve(a),savedFormFile:resolve(b),savedMcpFile:resolve(c)});
 throw Error('Usage: prepare SNAPSHOT_DIR OUTPUT_DIR BASELINE_MANIFEST_MJS | refresh-mcp OUTPUT_DIR SAVED_SHARED_JSON | finalize OUTPUT_DIR SAVED_FORM_JSON SAVED_MCP_JSON');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.message);process.exitCode=1});
