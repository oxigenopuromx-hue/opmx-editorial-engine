import {createHash} from 'node:crypto';
import {opuroCategoryHomeSource} from '../../../editorial/opuro-category-home.mjs';
import {publisherMasterPreflightSource,semanticPreflightResponse} from '../publisher-master-preflight.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const marker='OPURO_CATEGORY_HOME_V1';
const normalizer='Validar y normalizar OPMX MASTER';
const one=(g,name)=>{const nodes=g?.nodes?.filter(n=>n.name===name);if(nodes?.length!==1)throw Error('CATEGORY_HOME_NODE_CHANGED:'+name);return nodes[0]};
const replace=(text,from,to)=>{if(typeof text!=='string'||text.split(from).length!==2)throw Error('CATEGORY_HOME_SOURCE_CHANGED');return text.replace(from,to)};
const param=(node,parameters)=>({type:'updateNodeParameters',nodeName:node.name,parameters,replace:true});
const code=(node,jsCode)=>param(node,{...node.parameters,jsCode});
const edge=(type,source,target,sourceIndex=0)=>({type,source,target,sourceIndex,targetIndex:0,connectionType:'main'});
function localSharedSource(graph) {
 if(graph?.id!=='4o7K5TmKc7joScqB'||typeof graph.versionId!=='string'||!graph.versionId)throw Error('CATEGORY_HOME_SHARED_OWNER_CHANGED');
 const prepare=one(graph,'Preparar MASTER y binarios'),normalize=one(graph,normalizer);
 const next=graph.connections?.[prepare.name]?.main?.[0];
 if(next?.length!==1||next[0].node!==normalize.name||next[0].index!==0)throw Error('CATEGORY_HOME_SHARED_ORDER_CHANGED');
 for(const node of [prepare,normalize]){
  const source=node.parameters?.jsCode;
  if(node.type!=='n8n-nodes-base.code'||typeof source!=='string'||!source.trim()||/\b(?:fetch|require|process|globalThis|eval)\s*[.(]/.test(source)||/\$\s*\(/.test(source))throw Error('CATEGORY_HOME_SHARED_SOURCE_NONLOCAL');
  const helpers=[...source.matchAll(/this\.helpers\.([A-Za-z]+)/g)].map(x=>x[1]);if(helpers.some(x=>!['prepareBinaryData','getBinaryDataBuffer'].includes(x)))throw Error('CATEGORY_HOME_SHARED_HELPER_NONLOCAL');
 }
 return {prepare:prepare.parameters.jsCode,normalize:normalize.parameters.jsCode};
}

function verifyBase(g,expected) {
 if(!g||typeof g.versionId!=='string'||!expected||g.versionId!==expected.versionId||!Array.isArray(g.nodes)||!g.connections)throw Error('CATEGORY_HOME_REBASE_REQUIRED');
 for(const [name,hash] of Object.entries(expected.nodeHashes??{}))if(sha(JSON.stringify(one(g,name).parameters))!==hash)throw Error('CATEGORY_HOME_REBASE_REQUIRED:'+name);
}
export function categoryHomeBase(g) {
 return {versionId:g.versionId,nodeHashes:Object.fromEntries(g.nodes.map(n=>[n.name,sha(JSON.stringify(n.parameters))]))};
}
export function patchCategoryHomeNormalizer(source) {
 if(source.includes(marker))throw Error('CATEGORY_HOME_ALREADY_INSTALLED');
 let out=replace(source,'const PUB = d.PUBLICACION ?? d.publication ?? {};','const PUB = d.PUBLICACION ?? d.publication ?? {};\nconst opuroCategoryHome=readOpuroCategoryHome(d,execution.create_opuro);');
 out=replace(out,'      content_mode:contentMode,','      content_mode:contentMode,\n      ...(opuroCategoryHome.declared?{opuro_category_home:opuroCategoryHome}:{}),');
 return '// '+marker+'\n'+opuroCategoryHomeSource()+'\n'+out;
}
function snapshotCode(source) {
 if(source.includes(marker))throw Error('CATEGORY_HOME_ALREADY_INSTALLED');
 return '// '+marker+'\n'+replace(source,"'oxpuro_editorial','liberalmx_hero_media_id'","'oxpuro_editorial','oxpuro_excluded_category_ids','oxpuro_exclude_home','liberalmx_hero_media_id'");
}

export function buildCategoryHomeSharedOperations(shared,expected) {
 verifyBase(shared,expected);
 const norm=one(shared,normalizer),resolver=one(shared,'OPURO — Resolver categoría'),create=one(shared,'OPURO — Crear borrador Gutenberg enriquecido'),readback=one(shared,'OPURO — Validar antes de publicar'),duplicate=one(shared,'OPURO — Resultado consulta duplicados'),search=one(shared,'OPURO — Buscar categoría');
 const condition='OPURO — ¿Exclusiones declaradas?',lookup='OPURO — Preflight categoría de portada',check='OPURO — Validar pertenencia de exclusiones';
 if([condition,lookup,check].some(name=>shared.nodes.some(n=>n.name===name)))throw Error('CATEGORY_HOME_ALREADY_INSTALLED');
 const current=shared.connections[duplicate.name]?.main?.[0];if(current?.length!==1||current[0].node!=='¿Preflight OPOL?'||current[0].index!==0)throw Error('CATEGORY_HOME_PREFLIGHT_ORDER_CHANGED');
 let creator=replace(create.parameters.jsonBody,"    'site-post-title': 'disabled',","    'site-post-title': 'disabled',\n    ...($('Validar y normalizar OPMX MASTER').first().json.canonical.opuro_category_home?.declared===true?{oxpuro_excluded_category_ids:[...$('Validar y normalizar OPMX MASTER').first().json.canonical.opuro_category_home.ids]}:{}),");
 const member=opuroCategoryHomeSource()+"\nconst c=$('Validar y normalizar OPMX MASTER').first().json.canonical;const p=c.opuro_category_home;\nif(p?.declared!==true)throw Error('OPURO_CATEGORY_HOME_PREFLIGHT');\nconst requested=String(c.categories?.opuro?.principal??'');const norm=x=>String(x??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim().toLocaleLowerCase('es-MX');\nconst rows=$input.all().flatMap(i=>Array.isArray(i.json)?i.json:[i.json]);const exact=rows.filter(x=>norm(x?.name)===norm(requested));\nif(!requested||exact.length!==1||!Number.isSafeInteger(exact[0]?.id)||exact[0].id<1)throw Error('OPURO_CATEGORY_HOME_MEMBERSHIP');\nassertOpuroCategoryMembership(p,[exact[0].id]);return [{json:{status:'CATEGORY_HOME_MEMBERSHIP_VERIFIED',categoryId:exact[0].id}}];";
 const position=duplicate.position??[0,0];
 const lookupTemplate=structuredClone(search);for(const key of ['retryOnFail','onError','maxTries','waitBetweenTries'])delete lookupTemplate[key];
 const nodes=[
  {name:condition,id:'d94ac004-ea13-4e2e-a257-c4d595b50d21',type:'n8n-nodes-base.if',typeVersion:2.2,position:[position[0]+200,position[1]],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'7e25b6b2-0886-47aa-beba-9f4ac45424e0',leftValue:"={{ $('Validar y normalizar OPMX MASTER').first().json.canonical.opuro_category_home?.declared === true }}",rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}},
  {...lookupTemplate,name:lookup,id:'adba08cb-f37c-49c2-95a4-b363f934538e',position:[position[0]+420,position[1]-200]},
  {name:check,id:'548052e3-372f-41c4-bfd9-8bc524432ffe',type:'n8n-nodes-base.code',typeVersion:2,position:[position[0]+640,position[1]-200],parameters:{mode:'runOnceForAllItems',jsCode:'// '+marker+'\n'+member}},
 ];
 return [
  code(norm,patchCategoryHomeNormalizer(norm.parameters.jsCode)),
  code(resolver,'// '+marker+'\n'+opuroCategoryHomeSource()+'\n'+replace(resolver.parameters.jsCode,'return [{json:{','assertOpuroCategoryMembership(c.opuro_category_home,[Number(exact.id)]);\nreturn [{json:{')),
  param(create,{...create.parameters,jsonBody:creator}),
  code(readback,'// '+marker+'\n'+opuroCategoryHomeSource()+'\n'+replace(readback.parameters.jsCode,'return {json:{validated:true,post_id:Number(p.id)}};','assertOpuroCategoryReadback(c.opuro_category_home,p);\nreturn {json:{validated:true,post_id:Number(p.id)}};')),
  ...nodes.map(node=>({type:'addNode',node})),
  ...[lookup,check].map(nodeName=>({type:'setNodeSettings',nodeName,settings:{retryOnFail:false,onError:'stopWorkflow'}})),
  edge('removeConnection',duplicate.name,'¿Preflight OPOL?'),edge('addConnection',duplicate.name,condition),edge('addConnection',condition,lookup),edge('addConnection',condition,'¿Preflight OPOL?',1),edge('addConnection',lookup,check),edge('addConnection',check,'¿Preflight OPOL?'),
  {type:'addNodeGroup',id:'0a70bd83-f20c-427b-9570-8e75f97eced3',name:'Portada por categoría OPURO',description:'Preflight opcional de pertenencia antes de reservar o subir medios; no publica ni modifica otras portadas.',nodeNames:[lookup,check]},
 ];
}

export function buildCategoryHomePublicationOperations(graph,expected,{normalizerCopy=false}={}) {
 verifyBase(graph,expected);
 const operations=[];
 if(normalizerCopy){const norm=one(graph,normalizer);operations.push(code(norm,patchCategoryHomeNormalizer(norm.parameters.jsCode)))}
 for(const name of ['Preflight conjunto publicación','Publicación — Evaluar OPURO','Publicación — Evaluar OPOL','Publicación — Evaluar LIBERAL']){const node=one(graph,name);operations.push(code(node,snapshotCode(node.parameters.jsCode)))}
 return operations;
}

// Run only after saving Shared and obtaining its real immutable version.
// Publication is coordinated later with Form/MCP and the Guard manifest.
// This refreshes the existing #21 Code copy and hashes; it adds no validator,
// no branch and no sender. The previous embedded copy must match the snapshot.
export function buildCategoryHomeMcpStaticOperations(mcp,oldShared,newShared,expected) {
 verifyBase(mcp,expected);
 const n=one(mcp,'MASTER — Validación estática Shared'),result=one(mcp,'Resultado validación archivos');
 const old=localSharedSource(oldShared),next=localSharedSource(newShared),oldNormalize=old.normalize,newNormalize=next.normalize,prepare=next.prepare;
 const oldPin={workflowId:oldShared.id,versionId:oldShared.versionId,prepareSha256:sha(old.prepare),normalizerSha256:sha(oldNormalize)};
 if(!n.parameters.jsCode.includes('MASTER_SEMANTIC_PREFLIGHT_V1')||!n.parameters.jsCode.includes('async function sharedPrepare($json,$input){\n'+old.prepare+'\n}')||!n.parameters.jsCode.includes('async function sharedNormalize($json,$input){\n'+oldNormalize+'\n}')||!n.parameters.jsCode.includes(','+JSON.stringify(oldPin)+');return [{json:{...p,semantic_preflight}}];')||prepare!==old.prepare||newNormalize!==patchCategoryHomeNormalizer(oldNormalize)||newShared.versionId===oldShared.versionId)throw Error('CATEGORY_HOME_SHARED_COPY_CHANGED');
 const pin={workflowId:newShared.id,versionId:newShared.versionId,prepareSha256:sha(prepare),normalizerSha256:sha(newNormalize)};
 const jsCode='// MASTER_SEMANTIC_PREFLIGHT_V1\n// '+marker+'\n'+publisherMasterPreflightSource()+`\nasync function sharedPrepare($json,$input){\n${prepare}\n}\nasync function sharedNormalize($json,$input){\n${newNormalize}\n}\nconst p=$input.first().json,r=$('Protocolo MCP archivos').first().json.request;const semantic_preflight=await validatePublisherMasterStatically(p,r,{prepare:sharedPrepare,normalize:sharedNormalize},${JSON.stringify(pin)});return [{json:{...p,semantic_preflight}}];`;
 const start=result.parameters.jsCode.indexOf('function semanticPreflightResponse('),end=result.parameters.jsCode.indexOf('\nif($input.first().json.semantic_preflight?.ok!==true)');
 if(start<0||end<=start)throw Error('CATEGORY_HOME_STATIC_FORMATTER_CHANGED');
 const formatter=result.parameters.jsCode.slice(0,start)+semanticPreflightResponse.toString()+result.parameters.jsCode.slice(end);
 return [code(n,jsCode),code(result,formatter)];
}
