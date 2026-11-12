import {readFileSync} from 'node:fs';

export const literalWriterNames=Object.freeze({
 writer:{prepare:'Literal — Preparar control de escritura',branch:'Literal — ¿Comprobar alcance Telegram?',http:'Literal — Comprobar texto Guard',finish:'Literal — Conservar paquete verificado'},
 files:{prepare:'Literal archivos — Preparar control',branch:'Literal archivos — ¿Verificar texto?',http:'Literal archivos — Comprobar texto Guard',finish:'Literal archivos — Conservar validación'}
});
const endpoint='https://publisher.oxigenopuro.com.mx/v1/telegram/literal/validate';
const stripExports=s=>s.replace(/^export\s+/gm,'');
const stripImports=s=>s.replace(/^import[\s\S]*?;\s*/gm,'');
function sources(){
 const text=readFileSync(new URL('../../../editorial/literal-text.mjs',import.meta.url),'utf8');
 const delivery=readFileSync(new URL('../../../editorial/literal-delivery.mjs',import.meta.url),'utf8');
 if(/^import\s/m.test(text)||!text.includes('normalizeLiteralText')||!text.includes('extractLiteralVisibleText')||!text.includes('extractLiteralPlainText')||!delivery.includes('validateLiteralMaster'))throw Error('LITERAL_HELPER_SOURCE_CHANGED');
 const textCapsule=`const literalText=(()=>{\n${stripExports(text)}\nreturn {normalizeLiteralText,extractLiteralVisibleText,extractLiteralPlainText,assertLiteralCanonicalText};\n})();`;
 const profileCapsule=`${textCapsule}\nconst literalProfile=(()=>{const {normalizeLiteralText,extractLiteralVisibleText,extractLiteralPlainText,assertLiteralCanonicalText}=literalText;\n${stripExports(stripImports(delivery))}\nreturn {validateLiteralMaster};\n})();`;
 return {textCapsule,profileCapsule};
}
function one(graph,name){const ns=graph?.nodes?.filter(n=>n.name===name);if(ns?.length!==1)throw Error('LITERAL_WRITER_NODE_MISSING:'+name);return ns[0]}
function connection(source,target,sourceIndex=0,targetIndex=0,type='addConnection'){return {type,source,target,sourceIndex,targetIndex,connectionType:'main'}}
function anchored(code,from,to){if(typeof code!=='string'||code.split(from).length!==2)throw Error('LITERAL_WRITER_SOURCE_CHANGED:'+from.slice(0,45));return code.replace(from,to)}
function patchNormalizer(code,kind){
 const {profileCapsule}=sources();
 let patched=anchored(code,'const CONTROL = d.CONTROL_EDITORIAL ?? d.control_editorial ?? {};',`const CONTROL = d.CONTROL_EDITORIAL ?? d.control_editorial ?? {};\nconst literalProfileResult=literalProfile.validateLiteralMaster(d,{requestId:envelope.request_id});\nif(!literalProfileResult.ok)throw Error('MASTER_LITERAL_PROFILE_INVALID:'+JSON.stringify(literalProfileResult.errors));\nconst contentMode=literalProfileResult.mode;${kind==='form'?"\nif(contentMode==='LITERAL')throw Error('LITERAL_AUTHENTICATED_TELEGRAM_REQUIRED');":''}`);
 patched=anchored(patched,'const normalized={',`execution.request_id=${kind==='form'?"'opmx_community_execution_'+String($execution.id)":'envelope.request_id'};\nconst normalized={`);
 patched=anchored(patched,'canonical: {\n      title,','canonical: {\n      content_mode:contentMode,\n      title,');
 return profileCapsule+'\n'+patched;
}
function patchReadback(code,destination){
 const {textCapsule}=sources();let changed=code;
 if(destination==='OPOL'){
  changed=anchored(changed,"p.content?.raw!==c.gutenberg_final","!literalBodyMatches(p.content?.raw,c.gutenberg_final,c.content_mode)");
  changed=anchored(changed,"p.meta?.opmx_editorial?.subtitle!==c.subtitle","literalText.normalizeLiteralText(String(p.meta?.opmx_editorial?.subtitle??''))!==literalText.normalizeLiteralText(String(c.subtitle??''))");
 }else{
  const meta=destination==='OPURO'?'oxpuro_editorial':'liberalmx_editorial';
  changed=anchored(changed,`String(p?.meta?.${meta}?.subtitle??'')!==String(c.subtitle??'')`,`literalText.normalizeLiteralText(String(p?.meta?.${meta}?.subtitle??''))!==literalText.normalizeLiteralText(String(c.subtitle??''))`);
  changed=anchored(changed,"p.content.raw!==c.gutenberg_enriquecido_final","!literalBodyMatches(p.content.raw,c.gutenberg_enriquecido_final,c.content_mode)");
 }
 return `${textCapsule}\nfunction literalBodyMatches(actual,expected,mode){if(typeof actual!=='string'||typeof expected!=='string')return false;if(mode!=='LITERAL')return actual===expected;try{return literalText.normalizeLiteralText(literalText.extractLiteralPlainText(actual))===literalText.normalizeLiteralText(literalText.extractLiteralPlainText(expected))}catch{return false}}\n${changed}`;
}
function node(name,type,typeVersion,parameters,id,position,extra={}){return {id,name,type,typeVersion,position,parameters,...extra}}
function routeNodes(names,{credential,position=[448,0],prepare,finish,ids}){
 if(!credential||typeof credential.id!=='string'||!credential.id||typeof credential.name!=='string'||!credential.name)throw Error('LITERAL_WRITER_CREDENTIAL_REQUIRED');
 const [x,y]=position;
 return [
  node(names.prepare,'n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:prepare},ids[0],[x,y]),
  node(names.branch,'n8n-nodes-base.if',2.2,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:'={{ $json.preflightRequired }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},ids[1],[x+224,y]),
  node(names.http,'n8n-nodes-base.httpRequest',4.5,{method:'POST',url:endpoint,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify($json.literalBody) }}',options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,responseFormat:'json',neverError:true}}}},ids[2],[x+448,y],{credentials:{httpHeaderAuth:{id:credential.id,name:credential.name}}}),
  node(names.finish,'n8n-nodes-base.code',2,{mode:'runOnceForEachItem',jsCode:finish},ids[3],[x+672,y])
 ];
}
function routeOperations(graph,start,nodes,next,errorTarget=null){
 const ns=nodes.map(n=>n.name);if(graph.nodes.some(n=>ns.includes(n.name)))throw Error('LITERAL_WRITER_ALREADY_INSTALLED');
 const [prepare,branch,http,finish]=ns;
 const operations=[connection(start,next,0,0,'removeConnection'),...nodes.map(node=>({type:'addNode',node})),{type:'setNodeSettings',nodeName:http,settings:{retryOnFail:false,onError:'continueRegularOutput'}},connection(start,prepare),connection(prepare,branch),connection(branch,http,0),connection(branch,finish,1),connection(http,finish),connection(finish,next)];
 if(errorTarget){for(const n of [prepare,finish]){operations.push({type:'setNodeSettings',nodeName:n,settings:{onError:'continueErrorOutput',retryOnFail:false}});operations.push(connection(n,errorTarget,1));}}
 return operations;
}
const responseCheck=`const response=$json,proof=response?.body;\nif(response?.statusCode!==200||!proof||proof.requestId!==context.literalBody.requestId||proof.mode!==context.literalBody.declaredMode)throw Error('LITERAL_GUARD_RESULT_UNCONFIRMED');\nif(context.literalBody.declaredMode==='LITERAL'){const scope=context.literalScope;if(proof.status!=='LITERAL_TEXT_VERIFIED'||proof.packageId!==scope.PACKAGE_ID||proof.revision!==scope.REVISION||proof.destination!==context.destination||!/^tg_[a-f0-9]{40}$/.test(proof.packageId??'')||!Number.isSafeInteger(proof.revision)||proof.revision<1||!/^[a-f0-9]{64}$/.test(proof.payloadHash??'')||!/^[a-f0-9]{64}$/.test(proof.sourceHash??'')||(proof.previewHash!==null&&!/^[a-f0-9]{64}$/.test(proof.previewHash??''))||proof.retryPermitted!==false)throw Error('LITERAL_GUARD_RESULT_UNCONFIRMED');}\nelse if(proof.status!=='EDITORIAL_PROFILE_UNCHANGED'||proof.retryPermitted!==false)throw Error('LITERAL_GUARD_RESULT_UNCONFIRMED');`;

// The normalizer always preserves the selected request. Every Telegram write
// reaches Guard even if the MASTER omits/forges its declared content mode.
// A manual form cannot manufacture Telegram authority through MASTER fields.
export function buildLiteralWriterOperations(graph,{credential,kind='shared'}={}){
 if(!['shared','form'].includes(kind)||!Array.isArray(graph?.nodes)||!graph.connections)throw Error('LITERAL_WRITER_GRAPH_INVALID');
 const normalizer=one(graph,'Validar y normalizar OPMX MASTER');
 const operations=[{type:'updateNodeParameters',nodeName:normalizer.name,parameters:{...normalizer.parameters,jsCode:patchNormalizer(normalizer.parameters.jsCode,kind)},replace:true}];
 if(kind==='form')return operations;
 const outgoing=graph.connections[normalizer.name]?.main?.[0];if(outgoing?.length!==1||outgoing[0].index!==0)throw Error('LITERAL_WRITER_CONNECTION_CHANGED');
 const names=literalWriterNames.writer;
 const prepare=`const item=$input.first(),value=item.json,c=value?.canonical,e=value?.execution,mode=c?.content_mode;\nif(!c||!e||!['LITERAL','EDITORIAL'].includes(mode)||typeof e.request_id!=='string')throw Error('LITERAL_WRITER_SCOPE_INVALID');\nconst telegram=/^tg_[a-f0-9]{64}$/.test(e.request_id);if(mode==='LITERAL'&&!telegram)throw Error('LITERAL_AUTHENTICATED_TELEGRAM_REQUIRED');\nconst literalScope=value.original?.CONTROL_EDITORIAL?.LITERAL??null;\nreturn [{json:{preflightRequired:telegram,originalJson:value,destination:e.destination,literalScope,literalBody:{requestId:e.request_id,declaredMode:mode,title:c.title,subtitle:c.subtitle,html:c.html_final,gutenberg:c.gutenberg_final,enriched:c.gutenberg_enriquecido_final}},binary:item.binary}];`;
 const finish=`const original=$(${JSON.stringify(names.prepare)}).item,context=original.json;\nif(context.preflightRequired){${responseCheck}}else if(context.literalBody.declaredMode!=='EDITORIAL'||/^tg_/i.test(context.literalBody.requestId))throw Error('LITERAL_GUARD_RESULT_UNCONFIRMED');\nreturn {json:context.originalJson,...(original.binary?{binary:original.binary}:{})};`;
 const nodes=routeNodes(names,{credential,prepare,finish,position:normalizer.position,ids:['f217b31f-efad-4c86-b1ef-04d26d8c4734','a70d250c-bc6b-4fef-8806-30c3b8945919','9e76b025-bcb1-4d45-86e2-1942df3a78eb','58ea7041-8313-4c8a-bbf7-f5ed04843d82']});
 operations.push(...routeOperations(graph,normalizer.name,nodes,outgoing[0].node));
 for(const destination of ['OPURO','OPOL','LIBERAL']){const target=one(graph,destination+' — Validar antes de publicar');operations.push({type:'updateNodeParameters',nodeName:target.name,parameters:{...target.parameters,jsCode:patchReadback(target.parameters.jsCode,destination)},replace:true});}
 return operations;
}

// Files-only validation may register an exact literal proof before the Motor
// acknowledges a confirmed CREATE decision. It never writes to a CMS.
export function buildLiteralMcpPreflightOperations(graph,{credential}={}){
 const parser=one(graph,'Comprobar MASTER'),result=one(graph,'Resultado validación archivos'),error=one(graph,'Archivo rechazado');
 const {profileCapsule}=sources();
 const parserCode=profileCapsule+'\n'+anchored(parser.parameters.jsCode,'return {master,masterBytes:bytes.length};',`const profile=literalProfile.validateLiteralMaster(master,{requestId:request.request_id});\n if(!profile.ok)throw Error('MASTER_LITERAL_PROFILE_INVALID:'+JSON.stringify(profile.errors));\n return {master,masterBytes:bytes.length,...(profile.mode==='LITERAL'?{literalCandidate:profile.candidate}:{})};`);
 const names=literalWriterNames.files;
 const prepare=`const item=$input.first(),parsed=item.json,r=$('Protocolo MCP archivos').first().json.request;\nconst candidate=parsed.literalCandidate;return [{json:{preflightRequired:!!candidate,originalJson:parsed,destination:r.destino,literalScope:parsed.master?.CONTROL_EDITORIAL?.LITERAL??null,literalBody:candidate??null},binary:item.binary}];`;
 const finish=`const original=$(${JSON.stringify(names.prepare)}).item,context=original.json;let literal_profile;\nif(context.preflightRequired){${responseCheck}\nliteral_profile={status:proof.status,requestId:proof.requestId,packageId:proof.packageId,revision:proof.revision,destination:proof.destination,payloadHash:proof.payloadHash,sourceHash:proof.sourceHash,previewHash:proof.previewHash,mode:proof.mode,retryPermitted:false};}\nreturn {json:{...context.originalJson,...(literal_profile?{literal_profile}:{})},...(original.binary?{binary:original.binary}:{})};`;
 const outgoing=graph.connections[parser.name]?.main?.[0];if(outgoing?.length!==1||outgoing[0].index!==0)throw Error('LITERAL_MCP_CONNECTION_CHANGED');
 const nodes=routeNodes(names,{credential,prepare,finish,position:parser.position,ids:['dc17bdc7-d24f-41db-b7b1-f354c8c71357','b6533f34-5fe2-4aba-aa69-5b8e4d95f0e7','3087b5d5-5b10-468d-bddd-cab998d9edf7','9f7c0707-5bdc-4f55-8a10-05a1fcb8b8eb']});
 let resultCode=anchored(result.parameters.jsCode,"const r=$('Protocolo MCP archivos').first().json.request;const p=$input.first().json;",`const r=$('Protocolo MCP archivos').first().json.request;const p=$input.first().json;const literal_profile=$(${JSON.stringify(names.finish)}).first().json.literal_profile;`);
 resultCode=anchored(resultCode,'bytes:p.stats','bytes:p.stats,...(literal_profile?{literal_profile}:{})');
 const errorCode=anchored(error.parameters.jsCode,"if(raw.includes('MASTER_VALIDATION_FAILED:SEO.ETIQUETAS'))",`if(raw.includes('MASTER_LITERAL_PROFILE_INVALID')||raw.includes('LITERAL_GUARD_RESULT_UNCONFIRMED'))result={status:'VALIDATION_FAILED',field:'CONTROL_EDITORIAL.LITERAL',message:'No se pudo acreditar una entrega literal íntegra y autorizada.',writesStarted:false,retryPermitted:false};\nelse if(raw.includes('MASTER_VALIDATION_FAILED:SEO.ETIQUETAS'))`);
 return [{type:'updateNodeParameters',nodeName:parser.name,parameters:{...parser.parameters,jsCode:parserCode},replace:true},...routeOperations(graph,parser.name,nodes,outgoing[0].node,error.name),{type:'updateNodeParameters',nodeName:result.name,parameters:{...result.parameters,jsCode:resultCode},replace:true},{type:'updateNodeParameters',nodeName:error.name,parameters:{...error.parameters,jsCode:errorCode},replace:true}];
}
