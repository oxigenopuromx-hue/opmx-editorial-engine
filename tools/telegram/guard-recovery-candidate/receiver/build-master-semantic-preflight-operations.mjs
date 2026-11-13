import {createHash} from 'node:crypto';
import {publisherMasterPreflightSource,semanticPreflightResponse} from '../publisher-master-preflight.mjs';

export const masterSemanticNodes=Object.freeze({validate:'MASTER — Validación estática Shared'});
export const masterSemanticGroup=Object.freeze({id:'00e1fe38-96aa-4a71-94c0-da882b61421d',name:'Validación MASTER antes de aceptar',description:'Valida el contrato estático del destino antes de aceptar Publisher; conserva el payload y los controles existentes.'});
const marker='MASTER_SEMANTIC_PREFLIGHT_V1';
const sha=x=>createHash('sha256').update(x).digest('hex');
const codeNode=(name,jsCode,id,position)=>({name,id,position,type:'n8n-nodes-base.code',typeVersion:2,parameters:{mode:'runOnceForAllItems',jsCode}});
const conn=(type,source,target,sourceIndex=0)=>({type,source,target,sourceIndex,targetIndex:0,connectionType:'main'});

export function buildMasterSemanticPreflightOperations(mcp,shared) {
 if(!Array.isArray(mcp?.nodes)||!mcp.connections||!Array.isArray(shared?.nodes)||!shared.connections||typeof shared.versionId!=='string')throw Error('SEMANTIC_PREFLIGHT_GRAPH_INVALID');
 const one=(g,name)=>{const found=g.nodes.filter(n=>n.name===name);if(found.length!==1)throw Error('SEMANTIC_PREFLIGHT_NODE_MISSING:'+name);return found[0]};
 const prepare=one(shared,'Preparar MASTER y binarios'),normalize=one(shared,'Validar y normalizar OPMX MASTER');
 if([prepare,normalize].some(n=>n.type!=='n8n-nodes-base.code'||typeof n.parameters?.jsCode!=='string'||!n.parameters.jsCode.trim()||n.parameters.jsCode.includes(marker)))throw Error('SEMANTIC_PREFLIGHT_SHARED_SOURCE_INVALID');
 const prepNext=shared.connections[prepare.name]?.main?.[0];if(prepNext?.length!==1||prepNext[0].node!==normalize.name||prepNext[0].index!==0)throw Error('SEMANTIC_PREFLIGHT_SHARED_ORDER_CHANGED');
 for(const source of [prepare.parameters.jsCode,normalize.parameters.jsCode]){
  if(/\b(?:fetch|require|process|globalThis|eval)\s*[.(]/.test(source)||/\$\s*\(/.test(source))throw Error('SEMANTIC_PREFLIGHT_NONLOCAL_SOURCE');
  const helpers=[...source.matchAll(/this\.helpers\.([A-Za-z]+)/g)].map(x=>x[1]);if(helpers.some(x=>!['prepareBinaryData','getBinaryDataBuffer'].includes(x)))throw Error('SEMANTIC_PREFLIGHT_NONLOCAL_HELPER');
 }
 const target=one(mcp,'¿Crear borradores?'),result=one(mcp,'Resultado validación archivos');
 if(Object.values(masterSemanticNodes).some(name=>mcp.nodes.some(n=>n.name===name))||result.parameters.jsCode.includes(marker))throw Error('SEMANTIC_PREFLIGHT_ALREADY_INSTALLED');
 if((mcp.nodeGroups??[]).some(g=>g.name===masterSemanticGroup.name||g.id===masterSemanticGroup.id))throw Error('SEMANTIC_PREFLIGHT_GROUP_ALREADY_EXISTS');
 const incoming=[];for(const [name,c]of Object.entries(mcp.connections))for(const [i,edges]of (c.main??[]).entries())for(const e of edges)if(e.node===target.name){if(e.type!=='main'||e.index!==0)throw Error('SEMANTIC_PREFLIGHT_CONNECTION_CHANGED');incoming.push([name,i])}
 if(incoming.length!==2||!incoming.some(([name,i])=>name==='¿Requiere Hero?'&&i===1)||!incoming.some(([name,i])=>name==='Comprobar Hero'&&i===0))throw Error('SEMANTIC_PREFLIGHT_INPUTS_CHANGED');
 const pin={workflowId:shared.id??'4o7K5TmKc7joScqB',versionId:shared.versionId,prepareSha256:sha(prepare.parameters.jsCode),normalizerSha256:sha(normalize.parameters.jsCode)};
 const validator='// '+marker+'\n'+publisherMasterPreflightSource()+`\nasync function sharedPrepare($json,$input){\n${prepare.parameters.jsCode}\n}\nasync function sharedNormalize($json,$input){\n${normalize.parameters.jsCode}\n}\nconst p=$input.first().json,r=$('Protocolo MCP archivos').first().json.request;const semantic_preflight=await validatePublisherMasterStatically(p,r,{prepare:sharedPrepare,normalize:sharedNormalize},${JSON.stringify(pin)});return [{json:{...p,semantic_preflight}}];`;
 const oldResult=result.parameters.jsCode,needle='bytes:p.stats,...(literal_profile?{literal_profile}:{})';
 if(oldResult.split(needle).length!==2)throw Error('SEMANTIC_PREFLIGHT_VALIDATION_RESULT_CHANGED');
 const resultCode='// '+marker+'\n'+semanticPreflightResponse.toString()+"\nif($input.first().json.semantic_preflight?.ok!==true)return [{json:semanticPreflightResponse($('Protocolo MCP archivos').first().json.request,$input.first().json)}];\n"+oldResult.replace(needle,'bytes:p.stats,validation_scope:p.semantic_preflight,...(literal_profile?{literal_profile}:{})');
 const conditions=structuredClone(target.parameters);
 if(conditions.conditions?.combinator!=='and'||conditions.conditions.conditions?.length!==1||conditions.conditions.conditions[0].leftValue!=="={{ $('Protocolo MCP archivos').first().json.request.operation !== 'validar_archivos_opmx' }}")throw Error('SEMANTIC_PREFLIGHT_BRANCH_CHANGED');
 conditions.conditions.conditions.push({leftValue:'={{ $json.semantic_preflight.ok }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}});
 const n=masterSemanticNodes,pos=target.position??[0,0];
 return [
  {type:'addNode',node:codeNode(n.validate,validator,'fc9bc5b3-ebd6-4d80-a0f8-8f8bfd7a4a91',[pos[0]-448,pos[1]])},
  {type:'setNodeSettings',nodeName:n.validate,settings:{onError:'continueErrorOutput',retryOnFail:false}},
  ...incoming.flatMap(([name,i])=>[conn('removeConnection',name,target.name,i),conn('addConnection',name,n.validate,i)]),
  conn('addConnection',n.validate,target.name),conn('addConnection',n.validate,'Archivo rechazado',1),
  {type:'updateNodeParameters',nodeName:target.name,parameters:conditions,replace:true},
  {type:'updateNodeParameters',nodeName:result.name,parameters:{...result.parameters,jsCode:resultCode},replace:true},
  {type:'addNodeGroup',...masterSemanticGroup,nodeNames:[n.validate]},
 ];
}
