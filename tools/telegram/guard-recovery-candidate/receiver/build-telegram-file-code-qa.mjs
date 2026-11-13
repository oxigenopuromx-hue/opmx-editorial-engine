import {buildTelegramFileDiagnosticOperations,telegramFileNodes} from './build-telegram-file-diagnostic-operations.mjs';

// Generate one isolated Code-node fixture. The node code is taken from the
// reviewed incremental operations; no credentials, routes or binary originals
// are copied from the receiver. No I/O nodes run in this fixture.
export function buildTelegramFileCodeQa(graph){
 const operations=buildTelegramFileDiagnosticOperations(graph);
 const code=name=>operations.find(o=>o.nodeName===name)?.parameters.jsCode;
 const operation=graph.nodes.find(n=>n.name==='Confirmar operación de paquete Telegram');
 if(operation?.type!=='n8n-nodes-base.code'||typeof operation.parameters?.jsCode!=='string'||!operation.parameters.jsCode.includes("result?.status==='RESERVATION_REPLAY'"))throw Error('FILE_QA_OPERATION_CHANGED');
 return `// ISSUE15_ISOLATED_CODE_QA_V1 — synthetic inputs only; zero external I/O.
async function checkBytes($input,$){${code(telegramFileNodes.bytes)}}
async function confirmStore($input,$){${code(telegramFileNodes.confirm)}}
async function makeReceipt($input,$){${code(telegramFileNodes.receipt)}}
async function confirmReservation($input,$){${operation.parameters.jsCode}}
const assertions=[];
function assert(value,label){if(!value)throw Error('ISSUE15_QA_FAILED: '+label);assertions.push(label)}
function input(json,binary){return {first:()=>({json,...(binary?{binary}:{})})}}
function lookup(records){return name=>{if(!Object.hasOwn(records,name))throw Error('NODE_NOT_EXECUTED');return {first:()=>({json:records[name]})}}}
const pdf=Buffer.from('%PDF-1.4\\n1 0 obj<</Type/Catalog>>endobj\\n%%EOF\\n');
const packageId='tg_'+'a'.repeat(40),itemId='ti_'+'b'.repeat(40);
const context={kind:'FILE',mode:'PACKAGE_STORAGE',user_id:'900000001',chat_id:'900000001',receipt_id:'synthetic-issue15',packageId,max_bytes:10485760,requires_storage:false,requires_operation:false,attachment:{file_name:'fixture.pdf',mime_type:'application/pdf',declared_bytes:pdf.length}};
async function reservation(result){return (await confirmReservation(input(result),lookup({'Resolver paquete Telegram':context})))[0].json}
const reserved=await reservation({status:'RESERVED',packageId,itemId});
const pendingReplay=await reservation({status:'RESERVATION_REPLAY',itemId,state:'PENDING'});
const storedReplay=await reservation({status:'RESERVATION_REPLAY',itemId,state:'STORED'});
assert(reserved.itemId===itemId&&reserved.has_file===true,'reserved item retained');
assert(pendingReplay.itemId===itemId&&pendingReplay.has_file===true,'pending replay uses same reservation');
assert(storedReplay.itemId===itemId&&storedReplay.has_file===false&&storedReplay.original_stored===true,'stored replay skips download');
async function bytes(incoming,raw,buffer=pdf,fail=false){return (await checkBytes.call({helpers:{getBinaryDataBuffer:async(index,key)=>{assert(index===0&&key==='data','binary helper receives exact item and key');if(fail)throw Error('synthetic-private-error');return buffer}}},raw,lookup({'Confirmar operación de paquete Telegram':incoming})))[0].json}
const verified=await bytes(reserved,input({}, {data:{}}));
assert(verified.itemId===itemId&&verified.packageId===packageId,'download preserves package and item');
assert(verified.contentBase64===pdf.toString('base64')&&verified.bytes_received===pdf.length,'original bytes preserved exactly');
assert(verified.source_stored===false&&verified.original_stored===false,'download alone is not storage');
assert(JSON.parse(verified.storage_diagnostic).code==='DOWNLOAD_VERIFIED','download diagnostic verified');
const replayVerified=await bytes(pendingReplay,input({}, {data:{}}));
assert(replayVerified.itemId===verified.itemId&&replayVerified.contentBase64===verified.contentBase64,'pending replay repeats same bytes without new item');
for(const [label,raw,buffer,fail,expected] of [
 ['missing',input({}),pdf,false,'DOWNLOAD_BINARY_MISSING'],
 ['ambiguous',input({}, {one:{},two:{}}),pdf,false,'DOWNLOAD_BINARY_AMBIGUOUS'],
 ['unreadable',input({}, {data:{}}),pdf,true,'DOWNLOAD_BINARY_UNREADABLE'],
 ['empty',input({}, {data:{}}),Buffer.alloc(0),false,'DOWNLOAD_EMPTY'],
 ['size',input({}, {data:{}}),Buffer.alloc(10485761),false,'DOWNLOAD_SIZE_LIMIT'],
 ['fetch',input({error:{statusCode:502,message:'synthetic-private-error'}},{data:{}}),pdf,false,'DOWNLOAD_FETCH_UNCONFIRMED'],
 ['timeout',input({error:{code:'ETIMEDOUT',message:'synthetic-private-error'}},{data:{}}),pdf,false,'DOWNLOAD_TIMEOUT']
]){
 const checked=await bytes(reserved,raw,buffer,fail);
 assert(checked.kind==='DOWNLOAD_NOT_CONFIRMED'&&checked.has_file===false&&JSON.parse(checked.storage_diagnostic).code===expected,'distinct '+label+' failure');
 assert(!checked.contentBase64&&!checked.reply_text.includes('synthetic-private-error')&&!checked.storage_diagnostic.includes('synthetic-private-error'),'safe '+label+' failure');
}
const mismatch=await bytes({...reserved,attachment:{...reserved.attachment,declared_bytes:pdf.length+1}},input({}, {data:{}}));
assert(JSON.parse(mismatch.storage_diagnostic).code==='DOWNLOAD_DECLARED_SIZE_MISMATCH'&&mismatch.bytes_received===pdf.length,'declared size mismatch bounded and stopped');
const badPdf=await bytes(reserved,input({}, {data:{}}),Buffer.alloc(pdf.length,65));
assert(JSON.parse(badPdf.storage_diagnostic).code==='DOWNLOAD_SIGNATURE_MISMATCH'&&!badPdf.contentBase64,'bad PDF signature stopped');
async function stored(raw){return (await confirmStore(input(raw),lookup({'Comprobar bytes Telegram':verified})))[0].json}
const goodBody={status:'STORED',packageId,itemId,bytes:pdf.length,sha256:'c'.repeat(64)};
const good=await stored({statusCode:200,body:goodBody});
assert(good.original_stored===true&&JSON.parse(good.storage_diagnostic).code==='STORE_CONFIRMED','store requires precise acknowledged item');
assert(!Object.hasOwn(good,'contentBase64'),'store output strips binary payload');
const replay=await stored({statusCode:200,body:{status:'STORED_REPLAY',itemId}});
assert(replay.original_stored===true&&JSON.parse(replay.storage_diagnostic).code==='STORE_REPLAY_CONFIRMED','idempotent store replay confirms same item');
const other=await stored({statusCode:200,body:{...goodBody,itemId:'ti_'+'d'.repeat(40)}});
assert(other.original_stored===false,'wrong item never confirms storage');
const uncertain=await stored({error:{code:'ETIMEDOUT',message:'synthetic-private-error'}});
assert(uncertain.original_stored===false&&JSON.parse(uncertain.storage_diagnostic).code==='STORE_TIMEOUT','lost store acknowledgement remains uncertain');
assert(!uncertain.reply_text.includes('no se guardó')&&!uncertain.storage_diagnostic.includes('synthetic-private-error'),'lost store acknowledgement never claims absent commit');
const denied=await stored({statusCode:403,body:goodBody});
assert(denied.original_stored===false&&JSON.parse(denied.storage_diagnostic).code==='STORE_AUTH_DENIED','HTTP failure cannot masquerade as stored');
async function receipt(context,ack){return (await makeReceipt(input(ack),lookup({'Confirmar original Telegram':context})))[0].json}
const ack={chat:{id:context.chat_id},message_id:91};
const acked=await receipt(good,ack),unacked=await receipt(good,{error:'synthetic-no-ack'}),failedAcked=await receipt(mismatch,ack);
assert(acked.status==='RECEIPT_CONFIRMED'&&acked.original_stored===true,'Telegram acknowledgement and stored bytes both explicit');
assert(unacked.status==='RECEIPT_NOT_CONFIRMED'&&unacked.original_stored===true,'Telegram lost acknowledgement does not erase confirmed storage');
assert(failedAcked.status==='RECEIPT_CONFIRMED'&&failedAcked.original_stored===false,'Telegram acknowledgement never implies successful download');
assert(JSON.parse(acked.storage_diagnostic).code==='STORE_CONFIRMED'&&JSON.parse(failedAcked.storage_diagnostic).code==='DOWNLOAD_DECLARED_SIZE_MISMATCH','bounded file diagnostics reach existing receipt field');
const open=await receipt({...context,kind:'COMMAND',package_operation:'OPEN',storage_diagnostic:JSON.stringify({operation:'OPEN',httpStatus:200,code:'OPEN_CONFIRMED'})},ack);
assert(JSON.parse(open.storage_diagnostic).code==='OPEN_CONFIRMED','issue22 opening diagnostic preserved');
const forged=await receipt({...good,storage_diagnostic:JSON.stringify({operation:'STORE',code:'STORE_CONFIRMED',secret:'synthetic-private-error'})},ack);
assert(forged.storage_diagnostic===null,'receipt rejects diagnostic field injection');
assert([acked,unacked,failedAcked,open,forged].every(row=>row.publisher_called===false&&row.work_event_sent===null),'fixture never invokes Publisher or Motor');
return [{json:{status:'PASS',fixture:'issue15-file-diagnostics',assertions:assertions.length,checks:assertions,external_io:false,package_modified:false,original_recovered:false}}];`;
}
