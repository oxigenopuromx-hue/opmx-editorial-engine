import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildLiteralDelivery} from '../../../editorial/literal-delivery.mjs';
import {buildLiteralWriterOperations,buildLiteralMcpPreflightOperations,literalWriterNames} from './build-literal-writer-operations.mjs';
import {classifyFileMcp,capturedMcpMasterParserCode} from './fixtures/mcp-files-active-protocol.mjs';

const credential={id:'qa-credential',name:'QA existing header'},id='tg_'+'a'.repeat(40),revision=8;
const policy={authorized:true,content_mode:'LITERAL',mode:'DRAFT',destination:'TODOS'};
const title='Título de prueba íntegro '.repeat(6).trim(),subtitles=['Primer subtítulo original íntegro','Segundo subtítulo original íntegro'];
const paragraphs=['La Paz, Baja California Sur, 30 de octubre de 2026. Este párrafo es original.','El texto conserva comas, cifras 130 y crédito «Cortesía».'];
const sourceText=[title,...subtitles,...paragraphs].join('\n');
function literal(){return buildLiteralDelivery({baseMaster:{CONTROL_EDITORIAL:{ESTADO:'LISTO'},SEO:{SLUG:'qa-literal',ETIQUETAS:['Prueba']},PUBLICACION:{}},policy,packageId:id,revision,sourceText,title,subtitles,paragraphs}).master}
function run(code,{json={},items,lookup={},binary,globals={},helpers={}}={}){
 items??=[{json,...(binary?{binary}:{})}];
 const calls=[];
 const input={first:()=>items[0],all:()=>items,item:{json,binary}};
 const $=name=>{calls.push(name);const x=lookup[name];if(!x)throw Error('missing lookup '+name);return {first:()=>x,item:x}};
 const fn=vm.runInNewContext('(async function(){'+code+'})',{Buffer,TextEncoder,TextDecoder,URL,console,$,$json:json,$input:input,$execution:{id:'999'},...globals});
 return fn.call({helpers});
}
function codeNode(name,jsCode,extra={}){return {name,type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{mode:'runOnceForAllItems',jsCode},...extra}}
const normalizer=`let envelope=$json;const d=envelope.master,binary=$input.item.binary;const str=x=>String(x??'').trim();const CONTROL = d.CONTROL_EDITORIAL ?? d.control_editorial ?? {};
const title=str(d.SEO.TITULO_SEO),subtitle=str(d.SEO.SUBTITULO),execution={destination:'TODOS',create_liberal:true};const normalized={json:{execution,canonical: {
      title,subtitle,gutenberg_final:str(d.GUTENBERG_FINAL),gutenberg_enriquecido_final:str(d.GUTENBERG_ENRIQUECIDO_FINAL),html_final:str(d.HTML_FINAL),author_liberal:{id:3},categories:{liberal:{principal:'Política'}}},original:d},binary};return normalized;`;
function sharedGraph(){return {nodes:[codeNode('Validar y normalizar OPMX MASTER',normalizer),codeNode('¿Preflight OPURO?','return []'),codeNode('OPURO — Validar antes de publicar',"const p=$json,c=$('Validar y normalizar OPMX MASTER').first().json.canonical;if(String(p?.meta?.oxpuro_editorial?.subtitle??'')!==String(c.subtitle??''))throw Error('subtitle');if(typeof p?.content?.raw!=='string' || p.content.raw!==c.gutenberg_enriquecido_final)throw Error('body');if(p.title.raw!==c.title)throw Error('title');if(p.meta.oxpuro_editorial.photo_credit!==c.credit)throw Error('credit');return {json:{validated:true}};"),codeNode('OPOL — Validar antes de publicar',"const p=$json,c=$('Validar y normalizar OPMX MASTER').first().json.canonical;if(p.content?.raw!==c.gutenberg_final||p.meta?.opmx_editorial?.subtitle!==c.subtitle)throw Error('readback');if(p.title.raw!==c.title)throw Error('title');return {json:{validated:true}};"),codeNode('LIBERAL — Validar antes de publicar',"const p=$json,c=$('Validar y normalizar OPMX MASTER').first().json.canonical;if(String(p?.meta?.liberalmx_editorial?.subtitle??'')!==String(c.subtitle??''))throw Error('subtitle');if(typeof p?.content?.raw!=='string' || p.content.raw!==c.gutenberg_enriquecido_final)throw Error('body');if(p.author!==c.author_liberal.id)throw Error('author');if(p.title.raw!==c.title)throw Error('title');return {json:{validated:true}};"),codeNode('Unrelated','return [{json:$json}]')],connections:{'Validar y normalizar OPMX MASTER':{main:[[{node:'¿Preflight OPURO?',type:'main',index:0}]]}}}}
function mcpGraph(){return {nodes:[codeNode('Comprobar MASTER',`function parseMcpMaster(bytes,request){const master=JSON.parse(bytes.toString());return {master,masterBytes:bytes.length};}return [{json:parseMcpMaster(Buffer.from(JSON.stringify($json.master)),$json.request??{})}];`),codeNode('Descargar destacada','return []'),codeNode('Resultado validación archivos',"const r=$('Protocolo MCP archivos').first().json.request;const p=$input.first().json;return [{json:{status:'FILES_VALIDATED',bytes:p.stats}}];"),codeNode('Archivo rechazado',"const raw=$json.raw;let result;if(raw.includes('MASTER_VALIDATION_FAILED:SEO.ETIQUETAS'))result={status:'VALIDATION_FAILED'};else result={status:'FILES_REJECTED'};return [{json:result}];")],connections:{'Comprobar MASTER':{main:[[{node:'Descargar destacada',type:'main',index:0}],[{node:'Archivo rechazado',type:'main',index:0}]]}}}}
const opCode=(ops,name)=>ops.find(o=>o.type==='updateNodeParameters'&&o.nodeName===name)?.parameters.jsCode??ops.find(o=>o.type==='addNode'&&o.node.name===name)?.node.parameters.jsCode;
function proof(master,overrides={}){return {status:'LITERAL_TEXT_VERIFIED',requestId:master.CONTROL_EDITORIAL.LITERAL.REQUEST_ID,packageId:id,revision,destination:'TODOS',mode:'LITERAL',payloadHash:'b'.repeat(64),sourceHash:'c'.repeat(64),previewHash:null,retryPermitted:false,...overrides};}

// Fixtures model only the existing markers, while runtime assembly checks use
// the exact current private graphs. No private graph or administrator ID is
// needed to run these tests from a clean checkout.
test('shared graph adds a bounded preflight before the original first side-effect and changes no unrelated node',()=>{
 const g=sharedGraph(),before=structuredClone(g),ops=buildLiteralWriterOperations(g,{credential});assert.deepEqual(g,before);
 assert.equal(ops.filter(o=>o.type==='addNode').length,4);assert.equal(ops.filter(o=>o.type==='updateNodeParameters').length,4);
 const h=ops.find(o=>o.type==='addNode'&&o.node.type.endsWith('httpRequest')).node;
 assert.equal(h.parameters.url,'https://publisher.oxigenopuro.com.mx/v1/telegram/literal/validate');assert.equal(h.parameters.method,'POST');assert.deepEqual(h.credentials,{httpHeaderAuth:credential});assert.equal(h.parameters.options.redirect.redirect.followRedirects,false);assert.equal(h.parameters.options.response.response.fullResponse,true);
 assert.ok(ops.some(o=>o.type==='removeConnection'&&o.source==='Validar y normalizar OPMX MASTER'&&o.target==='¿Preflight OPURO?'));
 assert.ok(ops.some(o=>o.type==='addConnection'&&o.source===literalWriterNames.writer.finish&&o.target==='¿Preflight OPURO?'));
 assert.ok(!ops.some(o=>o.nodeName==='Unrelated'));
});
test('literal normalizer preserves full long title, both subtitles, images context and author3',async()=>{
 const master=literal(),binary={hero:{data:'same'},featured:{data:'same'}};
 const r=await run(opCode(buildLiteralWriterOperations(sharedGraph(),{credential}),'Validar y normalizar OPMX MASTER'),{json:{master,request_id:master.CONTROL_EDITORIAL.LITERAL.REQUEST_ID},binary});
 assert.equal(r.json.canonical.title,title);assert.ok(r.json.canonical.title.length>130);assert.equal(r.json.canonical.subtitle,subtitles.join('\n'));assert.equal(r.json.canonical.content_mode,'LITERAL');assert.equal(r.json.execution.request_id,master.CONTROL_EDITORIAL.LITERAL.REQUEST_ID);assert.equal(r.json.canonical.author_liberal.id,3);assert.deepEqual(r.binary,binary);
});
test('editorial normalizer retains all original fields except declared profile/request additions',async()=>{
 const master=literal();delete master.CONTROL_EDITORIAL.MODO_CONTENIDO;delete master.CONTROL_EDITORIAL.LITERAL;const json={master,request_id:'opmx_manual_123456789'};
 const old=await run(normalizer,{json}),next=await run(opCode(buildLiteralWriterOperations(sharedGraph(),{credential}),'Validar y normalizar OPMX MASTER'),{json});delete next.json.canonical.content_mode;delete next.json.execution.request_id;assert.deepEqual(JSON.parse(JSON.stringify(next)),JSON.parse(JSON.stringify(old)));
});
test('manual form keeps editorial behavior and refuses a forged literal MASTER',async()=>{
 const ops=buildLiteralWriterOperations(sharedGraph(),{credential,kind:'form'});assert.equal(ops.length,1);const code=opCode(ops,'Validar y normalizar OPMX MASTER');const m=literal();await assert.rejects(()=>run(code,{json:{master:m,request_id:m.CONTROL_EDITORIAL.LITERAL.REQUEST_ID}}),/LITERAL_AUTHENTICATED_TELEGRAM_REQUIRED/);
 const master=literal();delete master.CONTROL_EDITORIAL.MODO_CONTENIDO;const r=await run(code,{json:{master}});assert.equal(r.json.canonical.content_mode,'EDITORIAL');assert.equal(r.json.execution.request_id,'opmx_community_execution_999');
});
test('all Telegram requests invoke Guard even when MASTER claims editorial',async()=>{
 const ops=buildLiteralWriterOperations(sharedGraph(),{credential}),value={execution:{request_id:'tg_'+'a'.repeat(64),destination:'TODOS'},canonical:{content_mode:'EDITORIAL',title:'x',subtitle:'',html_final:'<p>x</p>',gutenberg_final:'x',gutenberg_enriquecido_final:'x'},original:{}};
 const r=await run(opCode(ops,literalWriterNames.writer.prepare),{json:value});assert.equal(r[0].json.preflightRequired,true);assert.equal(r[0].json.literalBody.declaredMode,'EDITORIAL');assert.deepEqual(Object.keys(r[0].json.literalBody).sort(),['declaredMode','enriched','gutenberg','html','requestId','subtitle','title']);
});
test('literal writer preflight preserves the exact original item and binary only after a scoped Guard proof',async()=>{
 const ops=buildLiteralWriterOperations(sharedGraph(),{credential}),master=literal(),value={execution:{request_id:master.CONTROL_EDITORIAL.LITERAL.REQUEST_ID,destination:'TODOS'},canonical:{content_mode:'LITERAL',title,subtitle:subtitles.join('\n'),html_final:master.HTML_FINAL,gutenberg_final:master.GUTENBERG_FINAL,gutenberg_enriquecido_final:master.GUTENBERG_ENRIQUECIDO_FINAL},original:master};
 const prepared=(await run(opCode(ops,literalWriterNames.writer.prepare),{json:value,binary:{image:'same'}}))[0];
 const r=await run(opCode(ops,literalWriterNames.writer.finish),{json:{statusCode:200,body:proof(master)},lookup:{[literalWriterNames.writer.prepare]:prepared}});assert.equal(r.json,value);assert.deepEqual(r.binary,{image:'same'});
});
for(const [name,response] of Object.entries({timeout:{error:'timeout'},http503:{statusCode:503,body:{}},noProof:{statusCode:200,body:{}},partial:{statusCode:200,body:{status:'PARTIAL'}},wrongPackage:{statusCode:200,body:{packageId:'tg_'+'d'.repeat(40)}},wrongPhase:{statusCode:200,body:{mode:'EDITORIAL'}}}))test('writer rejects '+name+' before its continuation',async()=>{
 const ops=buildLiteralWriterOperations(sharedGraph(),{credential}),master=literal();const context={preflightRequired:true,originalJson:{untouched:true},literalBody:{requestId:master.CONTROL_EDITORIAL.LITERAL.REQUEST_ID,declaredMode:'LITERAL'},literalScope:master.CONTROL_EDITORIAL.LITERAL,destination:'TODOS'};
 const body=name==='noProof'?{}:response.body?{...proof(master),...response.body}:undefined;
 await assert.rejects(()=>run(opCode(ops,literalWriterNames.writer.finish),{json:{...response,...(body?{body}:{})},lookup:{[literalWriterNames.writer.prepare]:{json:context}}}),/LITERAL_GUARD_RESULT_UNCONFIRMED/);
});
test('normal editorial manual bypass does not perform or accept a forged Telegram bypass',async()=>{
 const ops=buildLiteralWriterOperations(sharedGraph(),{credential}),code=opCode(ops,literalWriterNames.writer.finish),base={preflightRequired:false,originalJson:{x:1},literalBody:{requestId:'opmx_manual_123456789',declaredMode:'EDITORIAL'}};
 assert.deepEqual((await run(code,{lookup:{[literalWriterNames.writer.prepare]:{json:base}}})).json,base.originalJson);
 await assert.rejects(()=>run(code,{lookup:{[literalWriterNames.writer.prepare]:{json:{...base,literalBody:{...base.literalBody,requestId:'tg_'+'a'.repeat(64)}}}}}),/UNCONFIRMED/);
});
test('MCP preflight returns its exact literal candidate and records only through Guard',async()=>{
 const ops=buildLiteralMcpPreflightOperations(mcpGraph(),{credential}),master=literal();const r=await run(opCode(ops,'Comprobar MASTER'),{json:{master,request:{operation:'validar_archivos_opmx',request_id:null}}});assert.equal(r[0].json.literalCandidate.requestId,master.CONTROL_EDITORIAL.LITERAL.REQUEST_ID);assert.equal(Object.keys(r[0].json.literalCandidate).length,7);
 const prepared=(await run(opCode(ops,literalWriterNames.files.prepare),{json:r[0].json,lookup:{'Protocolo MCP archivos':{json:{request:{destino:'TODOS'}}}}}))[0];
 const finished=await run(opCode(ops,literalWriterNames.files.finish),{json:{statusCode:200,body:proof(master)},lookup:{[literalWriterNames.files.prepare]:prepared}});assert.equal(finished.json.literal_profile.status,'LITERAL_TEXT_VERIFIED');assert.deepEqual(JSON.parse(JSON.stringify(finished.json.master)),master);
 const validated=await run(opCode(ops,'Resultado validación archivos'),{json:{stats:{master:10}},lookup:{'Protocolo MCP archivos':{json:{request:{}}},[literalWriterNames.files.finish]:finished}});assert.equal(validated[0].json.literal_profile.status,'LITERAL_TEXT_VERIFIED');
});
const nativeFile={file_id:'synthetic-native-file',download_url:'https://files.oaiusercontent.com/synthetic-native-file'};
function routedFileRequest(name,extra={}){return classifyFileMcp({jsonrpc:'2.0',id:19,method:'tools/call',params:{name,arguments:{master_file:nativeFile,hero:nativeFile,destacada:nativeFile,destino:'TODOS',...extra}}});}
function capturedMcpGraph(){const graph=mcpGraph();graph.nodes.find(n=>n.name==='Comprobar MASTER').parameters.jsCode=capturedMcpMasterParserCode;return graph;}
function runCapturedParser(ops,master,routed){return run(opCode(ops,'Comprobar MASTER'),{lookup:{'Protocolo MCP archivos':{json:routed}},helpers:{getBinaryDataBuffer:async(index,key)=>{assert.equal(index,0);assert.equal(key,'asset');return Buffer.from(JSON.stringify(master));}},globals:{URL:undefined}});}
test('captured active MCP protocol passes its null validation ID through the real parser to the exact Guard body',async()=>{
 const listed=classifyFileMcp({jsonrpc:'2.0',id:1,method:'tools/list'}),schema=listed.response.result.tools.find(t=>t.name==='validar_archivos_opmx').inputSchema;
 assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.request_id,undefined);assert.ok(!schema.required.includes('request_id'));
 const routed=routedFileRequest('validar_archivos_opmx');assert.equal(routed.route,'files');assert.equal(routed.request.request_id,null);
 const ops=buildLiteralMcpPreflightOperations(capturedMcpGraph(),{credential}),master=literal(),binary={asset:{id:'same-native-binary'}};
 const parsed=(await runCapturedParser(ops,master,routed))[0];assert.equal(parsed.json.literalCandidate.requestId,master.CONTROL_EDITORIAL.LITERAL.REQUEST_ID);
 const prepared=(await run(opCode(ops,literalWriterNames.files.prepare),{json:parsed.json,binary,lookup:{'Protocolo MCP archivos':{json:routed}}}))[0];
 assert.equal(prepared.json.preflightRequired,true);assert.equal(prepared.json.destination,'TODOS');
 assert.deepEqual(JSON.parse(JSON.stringify(prepared.json.literalBody)),{requestId:master.CONTROL_EDITORIAL.LITERAL.REQUEST_ID,declaredMode:'LITERAL',title:master.SEO.TITULO_SEO.trim(),subtitle:master.SEO.SUBTITULO.trim(),html:master.HTML_FINAL.trim(),gutenberg:master.GUTENBERG_FINAL.trim(),enriched:master.GUTENBERG_ENRIQUECIDO_FINAL.trim()});
 assert.deepEqual(Object.keys(prepared.json.literalBody).sort(),['declaredMode','enriched','gutenberg','html','requestId','subtitle','title']);
 const finished=await run(opCode(ops,literalWriterNames.files.finish),{json:{statusCode:200,body:proof(master)},lookup:{[literalWriterNames.files.prepare]:prepared}});assert.equal(finished.json.literal_profile.status,'LITERAL_TEXT_VERIFIED');assert.deepEqual(finished.binary,binary);
 await assert.rejects(()=>run(opCode(ops,literalWriterNames.files.finish),{json:{statusCode:200,body:{status:'LITERAL_TEXT_UNCONFIRMED',writesStarted:false,retryPermitted:false}},lookup:{[literalWriterNames.files.prepare]:prepared}}),/LITERAL_GUARD_RESULT_UNCONFIRMED/);
});
for(const operation of ['preparar_borrador_opmx','publicar_nota_opmx'])test('captured active '+operation+' still requires its exact external request ID',async()=>{
 const master=literal(),ops=buildLiteralMcpPreflightOperations(capturedMcpGraph(),{credential}),publication=operation==='publicar_nota_opmx'?{confirmar_publicacion:'PUBLICAR'}:{};
 for(const extra of [{},{request_id:null}]){const rejected=routedFileRequest(operation,{...publication,...extra});assert.equal(rejected.response.error.code,-32602);}
 const changed=routedFileRequest(operation,{...publication,request_id:'tg_'+'d'.repeat(64)});assert.equal(changed.route,'files');await assert.rejects(()=>runCapturedParser(ops,master,changed),/CONTROL_EDITORIAL.LITERAL.REQUEST_ID/);
 const matched=routedFileRequest(operation,{...publication,request_id:master.CONTROL_EDITORIAL.LITERAL.REQUEST_ID});assert.equal((await runCapturedParser(ops,master,matched))[0].json.literalCandidate.requestId,matched.request.request_id);
 for(const request_id of [null,undefined])await assert.rejects(()=>runCapturedParser(ops,master,{request:{operation,request_id}}),/CONTROL_EDITORIAL.LITERAL.REQUEST_ID/);
});
test('MCP rejects changed binding and added En breve, without relaxing editorial profile',async()=>{
 const code=opCode(buildLiteralMcpPreflightOperations(mcpGraph(),{credential}),'Comprobar MASTER');const master=literal();await assert.rejects(()=>run(code,{json:{master,request:{request_id:'tg_'+'d'.repeat(64)}}}),/MASTER_LITERAL_PROFILE_INVALID/);master.TEXTO_EDITORIAL.EN_BREVE=['Added'];await assert.rejects(()=>run(code,{json:{master}}),/MASTER_LITERAL_PROFILE_INVALID/);
 delete master.CONTROL_EDITORIAL.MODO_CONTENIDO;const r=await run(code,{json:{master}});assert.equal(r[0].json.literalCandidate,undefined);
});
test('MCP deterministic literal preflight failures are classified before CMS writes',async()=>{
 const ops=buildLiteralMcpPreflightOperations(mcpGraph(),{credential}),r=await run(opCode(ops,'Archivo rechazado'),{json:{raw:'LITERAL_GUARD_RESULT_UNCONFIRMED'}});assert.equal(r[0].json.status,'VALIDATION_FAILED');assert.equal(r[0].json.writesStarted,false);
});
for(const destination of ['OPURO','OPOL','LIBERAL'])test(destination+' literal readback accepts only blank normalization and preserves existing other checks',async()=>{
 const ops=buildLiteralWriterOperations(sharedGraph(),{credential}),code=opCode(ops,destination+' — Validar antes de publicar'),master=literal();
 const c={title,subtitle:subtitles.join('\n'),content_mode:'LITERAL',gutenberg_final:master.GUTENBERG_FINAL,gutenberg_enriquecido_final:master.GUTENBERG_ENRIQUECIDO_FINAL,credit:'Cortesía',author_liberal:{id:3}};
 const p={title:{raw:title},author:3,meta:{oxpuro_editorial:{subtitle:subtitles.join(' '),photo_credit:'Cortesía'},opmx_editorial:{subtitle:subtitles.join(' ')},liberalmx_editorial:{subtitle:subtitles.join(' ')}},content:{raw:master.GUTENBERG_FINAL.replaceAll('\n','  ')}};
 const lookup={'Validar y normalizar OPMX MASTER':{json:{canonical:c}}};assert.equal((await run(code,{json:p,lookup})).json.validated,true);
 for(const alter of [p=>p.content.raw=p.content.raw.replace('conserva','reescribe'),p=>p.content.raw=p.content.raw.replace('conserva','<a href="https://example.org/added">conserva</a>'),p=>p.content.raw=p.content.raw.replace('conserva','<A HREF="https://example.org/added">conserva</A>'),p=>p.content.raw=p.content.raw.replace('<p>','<p title="Added content">'),p=>p.title.raw=p.title.raw.slice(0,60),p=>p.meta[destination==='OPURO'?'oxpuro_editorial':destination==='OPOL'?'opmx_editorial':'liberalmx_editorial'].subtitle='different']){const bad=structuredClone(p);alter(bad);await assert.rejects(()=>run(code,{json:bad,lookup}));}
 const editorial={...c,content_mode:'EDITORIAL'};await assert.rejects(()=>run(code,{json:p,lookup:{'Validar y normalizar OPMX MASTER':{json:{canonical:editorial}}}}));
});
test('changed markers and graph shape are rejected instead of silently patching another writer',()=>{
 assert.throws(()=>buildLiteralWriterOperations({nodes:[],connections:{}},{credential}));assert.throws(()=>buildLiteralWriterOperations(sharedGraph(),{credential,kind:'unknown'}));const g=sharedGraph();g.nodes[0].parameters.jsCode='return []';assert.throws(()=>buildLiteralWriterOperations(g,{credential}));assert.throws(()=>buildLiteralMcpPreflightOperations(mcpGraph(),{credential:{}}));
});
