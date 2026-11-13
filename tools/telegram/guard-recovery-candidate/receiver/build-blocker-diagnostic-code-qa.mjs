import {createHash}from'node:crypto';
import{buildBlockerDiagnosticMcpOperations}from'./build-blocker-diagnostic-operations.mjs';

// Real Code bodies embedded as ordinary function literals: no eval, require,
// prototype adaptation, HTTP, Telegram, database or credentials.
export function buildBlockerDiagnosticCodeQa(graph,expected){
 const ops=buildBlockerDiagnosticMcpOperations(graph,expected),names=ops.map(o=>o.nodeName),codes=Object.fromEntries(ops.map(o=>[o.nodeName,o.parameters.jsCode]));
 const hashes=Object.fromEntries(Object.entries(codes).map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]));
 const wrap=(name,label)=>`function ${label}(input,contexts={}){const $input={first:()=>({json:input})};const $=name=>({first:()=>({json:contexts[name]})});\n${codes[name]}\n}\n`;
 const old=graph.nodes.find(n=>n.name===names[0]).parameters.jsCode;
 return `// Synthetic, zero-I/O QA of the five real patched Code bodies.\n`+names.map((n,i)=>wrap(n,['protocol','prepare','report','notSent','track'][i])).join('\n')+`\nfunction legacyProtocol(input){const $input={first:()=>({json:input})};\n${old}\n}\n`+`
let checks=0;const check=(x,label)=>{checks++;if(!x)throw Error('BLOCKER_CODE_QA_FAILED:'+label)};const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);const packageId='tg_'+'a'.repeat(40),itemId='ti_'+'b'.repeat(40),identity={owner:'123',chat:'123'};
const message=(revision,outcome='SOURCES_VERIFIED')=>({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'informar_revision_telegram_opmx',arguments:{package_id:packageId,revision,outcome}}});
const input=m=>({envelope:{body:m},identity});const encoded=2**40+8*16384+256+2;
const scoped=protocol(input(message(encoded)))[0].json;check(scoped.route==='telegram-failure','route');check(scoped.request.body.revision===8&&scoped.request.body.blockerDiagnostic.code==='IMAGE_ORIGIN_UNCLEAR','decode');
const manifest={status:'FOUND',packageId,state:'READY',revision:8,items:[{itemId,state:'STORED',kind:'FILE'}]},contexts={'Protocolo MCP archivos':scoped};const prepared=prepare(manifest,contexts)[0].json;contexts['Preparar aviso de bloqueo']=prepared;contexts['Consultar paquete para bloqueo']=manifest;
check(prepared.send===true&&prepared.scopeConfirmed.revision===8,'scope');check(prepared.text.includes('Causa:')&&prepared.text.includes(itemId)&&prepared.text.includes('No la declares como IA si no lo es'),'text');
const sent=report({chat:{id:'123'},message_id:7},contexts)[0].json,sd=sent.response.result.structuredContent;check(sd.status==='FAILURE_REPORTED'&&sd.diagnostic==='ACK_CONFIRMED'&&sd.blocker_diagnostic.scope_confirmed===true,'ack');check(track(sent)[0].json.stage==='DIAG|MEDIA_FAILED|IMAGE_ORIGIN_UNCLEAR|1','ledger');
const uncertain=report({error:{message:'timeout'}},contexts)[0].json,ud=uncertain.response.result.structuredContent;check(ud.status==='FAILURE_UNCERTAIN'&&ud.retryPermitted===false&&ud.diagnostic==='TELEGRAM_ERROR','uncertain');check(track(uncertain).length===1,'persist scoped uncertain cause');
for(const malformed of [{...manifest,revision:9},{...manifest,state:'OPEN'},{...manifest,items:undefined},{...manifest,items:[]},{...manifest,items:[{itemId,state:'DISCARDED',kind:'FILE'}]}]){const p=prepare(malformed,{'Protocolo MCP archivos':scoped})[0].json;check(p.send===false&&!p.scopeConfirmed,'bad manifest');const ctx={...contexts,'Preparar aviso de bloqueo':p,'Consultar paquete para bloqueo':malformed};const r=notSent({},ctx)[0].json;check(r.response.result.structuredContent.status==='FAILURE_NOT_SENT'&&!r.response.result.structuredContent.blocker_diagnostic&&track(r).length===0,'no stale ledger');}
for(let slot=0;slot<32;slot++)for(const revision of[8,4294967295]){const m=message(1000000+revision*32+slot);check(equal(protocol(input(m)),legacyProtocol(input(m))),'legacy slot '+slot);}
for(const id of[14,16]){const r=protocol(input(message(2**40+8*16384+id)))[0].json;const p=prepare(manifest,{'Protocolo MCP archivos':r})[0].json;check(p.send===true&&p.text.includes('Causa:'),'new review family');}
for(const [id,site]of[[41,'OPURO'],[42,'OPOL'],[43,'LIBERAL'],[44,'OPURO'],[45,'OPOL'],[46,'LIBERAL']]){const r=protocol(input(message(2**40+8*16384+id)))[0].json;const p=prepare(manifest,{'Protocolo MCP archivos':r})[0].json;check(p.send===true&&p.text.includes(site),'observed destination '+site);}
const bad=message(encoded);bad.params.arguments.text='untrusted';check(!!protocol(input(bad))[0].json.response.error,'no arbitrary text');
return [{json:{status:'BLOCKER_REAL_CODE_QA_PASSED',checks,sourceSha256:${JSON.stringify(hashes)},legacySlotsChecked:32,scope:'READY_ONLY',syntheticFixturesOnly:true,networkCalls:0,guardMutations:0,cmsWrites:0,telegramMessages:0,prototypeAdaptations:0}}];`;
}
