import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {checkTelegramDownloadedFile,confirmObservedStoredOriginal,telegramFileDiagnosticJson,telegramFileReceiptDiagnostic} from './telegram-file-observation.mjs';
import {buildTelegramFileDiagnosticOperations,telegramFileNodes} from './build-telegram-file-diagnostic-operations.mjs';
import {patchPackageOpeningReceipt} from './build-package-opening-diagnostic-operations.mjs';

const itemId='ti_'+'a'.repeat(40),packageId='tg_'+'b'.repeat(40),pdf=Buffer.from('%PDF-1.7\nsynthetic\n%%EOF\n');
const context=(patch={})=>({kind:'FILE',package_operation:'CONTENT',packageId,itemId,user_id:'12345',chat_id:'12345',receipt_id:'telegram-12345-1-2',max_bytes:10485760,has_file:true,requires_operation:true,attachment:{mime_type:'application/pdf',file_name:'synthetic.pdf',declared_bytes:pdf.length},...patch});
const input=(patch={})=>({json:{},binary:{data:{}},...patch});
const diagnosis=x=>JSON.parse(x.storage_diagnostic);
const checked=(ctx=context(),raw=input(),bytes=pdf)=>checkTelegramDownloadedFile(ctx,raw,async()=>bytes);
const ensureFailure=(x,code)=>{assert.equal(diagnosis(x).code,code);assert.equal(x.has_file,false);assert.equal(x.original_stored,false);assert.equal(x.source_stored,false);assert.equal(x.itemId,itemId);assert.equal(x.packageId,packageId);assert.equal('contentBase64' in x,false);assert.match(x.reply_text,/\/estado/);assert.equal(x.reply_text.includes('synthetic.pdf'),false)};

test('valid PDF preserves exact bytes and same reservation until storage acknowledgement',async()=>{
 const r=await checked();assert.equal(r.kind,'FILE');assert.equal(r.has_file,true);assert.equal(r.original_stored,false);assert.equal(r.source_stored,false);assert.equal(r.itemId,itemId);assert.equal(r.packageId,packageId);assert.equal(r.contentBase64,pdf.toString('base64'));assert.equal(r.bytes_received,pdf.length);assert.deepEqual(diagnosis(r),{operation:'DOWNLOAD',httpStatus:null,code:'DOWNLOAD_VERIFIED',mimeType:'application/pdf',declaredBytes:pdf.length,receivedBytes:pdf.length});
});
test('all previously accepted MIME signatures and unknown size remain supported',async()=>{
 const specimens=[['application/msword',[208,207,17,224,161,177,26,225]],['application/vnd.openxmlformats-officedocument.wordprocessingml.document',[80,75,3,4]],['image/jpeg',[255,216,255,0]],['image/png',[137,80,78,71,13,10,26,10]],['image/webp',Buffer.from('RIFF0000WEBP')],['text/plain',Buffer.from('á texto')]];
 for(const [mime,value]of specimens){const bytes=Buffer.from(value),r=await checked(context({attachment:{mime_type:mime,file_name:'synthetic',declared_bytes:null}}),input(),bytes);assert.equal(r.has_file,true,mime);assert.equal(r.contentBase64,bytes.toString('base64'));assert.equal(diagnosis(r).declaredBytes,null)}
});
test('Telegram transport failure wins over any stale input binary and reveals no raw exception',async()=>{
 let reads=0;const r=await checkTelegramDownloadedFile(context(),input({json:{error:{message:'https://api.telegram.org/botSECRET/private.pdf',httpCode:'403'}}}),async()=>{reads++;return pdf});ensureFailure(r,'DOWNLOAD_FETCH_UNCONFIRMED');assert.equal(reads,0);assert.equal(diagnosis(r).httpStatus,403);assert.equal(JSON.stringify(r).includes('SECRET'),false);
});
test('structured timeout is distinct; message text alone is never parsed as timeout',async()=>{
 ensureFailure(await checked(context(),input({json:{error:{code:'ETIMEDOUT',message:'private'}}})),'DOWNLOAD_TIMEOUT');
 ensureFailure(await checked(context(),input({json:{error:'ETIMEDOUT private URL'}})),'DOWNLOAD_FETCH_UNCONFIRMED');
});
test('missing, ambiguous, unreadable and non-buffer binary outputs are distinct',async()=>{
 ensureFailure(await checked(context(),input({binary:undefined})),'DOWNLOAD_BINARY_MISSING');
 ensureFailure(await checked(context(),input({binary:{a:{},b:{}}})),'DOWNLOAD_BINARY_AMBIGUOUS');
 ensureFailure(await checkTelegramDownloadedFile(context(),input(),async()=>{throw Error('PRIVATE SOURCE') }),'DOWNLOAD_BINARY_UNREADABLE');
 ensureFailure(await checked(context(),input(),new Uint8Array([37,80,68,70])),'DOWNLOAD_BINARY_UNREADABLE');
});
test('empty and oversized files preserve only bounded byte counts in diagnostics',async()=>{
 const empty=await checked(context({attachment:{mime_type:'application/pdf',file_name:'synthetic.pdf',declared_bytes:null}}),input(),Buffer.alloc(0));ensureFailure(empty,'DOWNLOAD_EMPTY');assert.equal(empty.bytes_received,0);
 const big=await checked(context({max_bytes:10,attachment:{mime_type:'application/pdf',file_name:'synthetic.pdf',declared_bytes:null}}),input(),pdf);ensureFailure(big,'DOWNLOAD_SIZE_LIMIT');assert.equal(big.bytes_received,pdf.length);
});
test('declared-size mismatch stops before complete instead of becoming a storage uncertainty',async()=>{
 const r=await checked(context({attachment:{mime_type:'application/pdf',file_name:'synthetic.pdf',declared_bytes:pdf.length+1}}));ensureFailure(r,'DOWNLOAD_DECLARED_SIZE_MISMATCH');assert.equal(r.bytes_received,pdf.length);
});
test('PDF magic mismatch is distinct and does not rewrite or re-encode the original',async()=>{
 const bytes=Buffer.from('<html>not a PDF</html>'),r=await checked(context({attachment:{mime_type:'application/pdf',file_name:'synthetic.pdf',declared_bytes:bytes.length}}),input(),bytes);ensureFailure(r,'DOWNLOAD_SIGNATURE_MISMATCH');
});
test('invalid contexts fail closed without broadening MIME or size limits',async()=>{
 for(const patch of [{kind:'TEXT'},{max_bytes:0},{max_bytes:10485761},{attachment:{mime_type:'text/html',file_name:'source.html',declared_bytes:10}},{attachment:{mime_type:'application/pdf',file_name:'source.pdf',declared_bytes:-1}}])ensureFailure(await checked(context(patch)),'DOWNLOAD_CONTEXT_INVALID');
});

function confirmOriginal(ctx,result){
 const {contentBase64,...clean}=ctx;
 const stored=result?.itemId===ctx.itemId&&['STORED','STORED_REPLAY'].includes(result.status);
 const precise=result?.status==='STORED_REPLAY'||result?.packageId===ctx.packageId&&result.bytes===ctx.bytes_received&&/^[a-f0-9]{64}$/.test(result.sha256??'');
 return {...clean,has_file:false,source_stored:stored&&precise,original_stored:stored&&precise,reply_text:stored&&precise?'Archivo guardado':'No pude confirmar el guardado'};
}
const verified=()=>({...context(),bytes_received:pdf.length,contentBase64:pdf.toString('base64')});
const stored=(patch={})=>({statusCode:200,body:{status:'STORED',packageId,itemId,bytes:pdf.length,sha256:'c'.repeat(64),...patch}});
test('only authenticated precise store success or exact replay confirms original storage',()=>{
 const first=confirmObservedStoredOriginal(verified(),stored(),confirmOriginal);assert.equal(first.original_stored,true);assert.equal(diagnosis(first).code,'STORE_CONFIRMED');assert.equal('contentBase64'in first,false);
 const replay=confirmObservedStoredOriginal(verified(),stored({status:'STORED_REPLAY',packageId:undefined,bytes:undefined,sha256:undefined}),confirmOriginal);assert.equal(replay.original_stored,true);assert.equal(diagnosis(replay).code,'STORE_REPLAY_CONFIRMED');
 const other=confirmObservedStoredOriginal(verified(),stored({itemId:'ti_'+'d'.repeat(40)}),confirmOriginal);assert.equal(other.original_stored,false);assert.equal(diagnosis(other).code,'STORE_RESPONSE_UNCONFIRMED');
});
test('HTTP failure cannot smuggle a success-looking store body or success reply',()=>{
 for(const status of [400,401,403,429,500,503]){const r=confirmObservedStoredOriginal(verified(),{...stored(),statusCode:status},confirmOriginal);assert.equal(r.original_stored,false);assert.match(r.reply_text,/^No pude confirmar el guardado/);assert.match(r.reply_text,/\/estado/);assert.equal(diagnosis(r).httpStatus,status)}
 const r=confirmObservedStoredOriginal(verified(),{...stored(),error:'transport failed'},confirmOriginal);assert.equal(r.original_stored,false);assert.match(r.reply_text,/^No pude confirmar el guardado/);
});
test('lost store response stays uncertain and does not claim absence of a committed original',()=>{
 const r=confirmObservedStoredOriginal(verified(),{error:{code:'ETIMEDOUT',message:'private'}},confirmOriginal);assert.equal(r.original_stored,false);assert.equal(diagnosis(r).code,'STORE_TIMEOUT');assert.equal(r.reply_text.includes('No pude confirmar'),true);assert.equal(JSON.stringify(r).includes('private'),false);
});
test('conflict and reservation-not-found retain their distinct bounded result',()=>{
 assert.equal(diagnosis(confirmObservedStoredOriginal(verified(),stored({status:'CONFLICT'}),confirmOriginal)).code,'STORE_CONFLICT');
 assert.equal(diagnosis(confirmObservedStoredOriginal(verified(),stored({status:'NOT_FOUND'}),confirmOriginal)).code,'STORE_RESERVATION_NOT_FOUND');
});
test('diagnostic serializer rejects extra fields, secrets, unknown codes and arbitrary MIME',()=>{
 const d=diagnosis(confirmObservedStoredOriginal(verified(),stored(),confirmOriginal));assert.ok(telegramFileDiagnosticJson(d));
 for(const patch of [{url:'private'},{code:'STORE_PRIVATE_EXCEPTION'},{mimeType:'application/private'},{declaredBytes:10485761},{receivedBytes:-1},{httpStatus:99},{operation:'OPEN'}])assert.equal(telegramFileDiagnosticJson({...d,...patch}),null);
 assert.equal(telegramFileReceiptDiagnostic('x'.repeat(385)),null);assert.equal(telegramFileReceiptDiagnostic('{'),null);
});

const originalBytesCode="function validateTelegramDownload(){}\nconst original=$('Confirmar operación de paquete Telegram').first(0,0).json;try{const keys=Object.keys($input.first().binary??{});const bytes=await this.helpers.getBinaryDataBuffer(0,keys[0]);return [{json:original}]}catch{return []}";
const originalConfirmCode=confirmOriginal.toString().replace('function confirmOriginal','function confirmStoredOriginal')+"\nreturn [{json:confirmStoredOriginal($('Comprobar bytes Telegram').first(0,0).json,$input.first().json)}];";
const originalReceiptCode="const sent=$input.first().json;const m=sent.result??sent;let input;for(const name of ['Confirmar original Telegram','Comprobar bytes Telegram','Confirmar operación de paquete Telegram','Resolver paquete Telegram','Preparar paquete Telegram','Normalizar entrada Telegram']){try{input=$(name).first(0,0).json;break}catch{}}if(!input)throw Error('Contexto de recepción ausente');const ack=String(m.chat?.id)===input.chat_id&&Number.isSafeInteger(m.message_id)&&m.message_id>0;const out={status:ack?'RECEIPT_CONFIRMED':'RECEIPT_NOT_CONFIRMED',mode:input.mode??'RECEIPT_ONLY',kind:input.kind,receipt_id:input.receipt_id,bytes_received:input.bytes_received??null,mime_type:input.attachment?.mime_type??null,package_id:input.packageId??null,item_id:input.itemId??null,package_state:input.package_state??null,source_stored:input.source_stored===true,original_stored:input.original_stored===true,publisher_called:false,work_event_sent:null};return [{json:out}];";
function graph(){return {nodes:[{name:telegramFileNodes.download,type:'n8n-nodes-base.telegram',typeVersion:1.2,parameters:{resource:'file',fileId:'={{ $json.attachment.file_id }}',additionalFields:{}},onError:'continueRegularOutput',retryOnFail:false,credentials:{telegramApi:{id:'qa',name:'QA'}}},{name:telegramFileNodes.bytes,type:'n8n-nodes-base.code',typeVersion:2,parameters:{mode:'runOnceForAllItems',jsCode:originalBytesCode}},{name:telegramFileNodes.store,type:'n8n-nodes-base.httpRequest',typeVersion:4.5,parameters:{method:'POST',url:'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/complete',options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},onError:'continueRegularOutput',retryOnFail:false,credentials:{httpHeaderAuth:{id:'qa',name:'QA'}}},{name:telegramFileNodes.confirm,type:'n8n-nodes-base.code',typeVersion:2,parameters:{mode:'runOnceForAllItems',jsCode:originalConfirmCode}},{name:telegramFileNodes.receipt,type:'n8n-nodes-base.code',typeVersion:2,parameters:{mode:'runOnceForAllItems',jsCode:patchPackageOpeningReceipt(originalReceiptCode)}},...Array.from({length:47},(_,i)=>({name:'unchanged'+i,type:'n8n-nodes-base.noOp',typeVersion:1,parameters:{}}))],connections:{}}}
const run=async(source,data,lookups={},helpers={})=>vm.runInNewContext('(async function(){'+source+'}).call({helpers})',{Buffer,helpers,$input:{first:()=>data},$:(name)=>{if(!Object.hasOwn(lookups,name))throw Error('missing node');return {first:()=>({json:lookups[name]})}}});
test('builder changes five existing parameter sets and keeps graph, credentials and policies intact',()=>{
 const g=graph(),before=structuredClone(g),ops=buildTelegramFileDiagnosticOperations(g);assert.deepEqual(g,before);assert.equal(ops.length,5);assert.deepEqual(ops.map(x=>x.nodeName),Object.values(telegramFileNodes));assert.ok(ops.every(x=>x.type==='updateNodeParameters'&&x.replace));assert.equal(ops[0].parameters.download,true);assert.equal(ops[2].parameters.options.response.response.fullResponse,true);assert.equal(ops[2].parameters.options.response.response.neverError,true);assert.equal(ops[2].parameters.options.timeout,30000);
});
test('builder rejects changed shape or repeated application before producing mutations',()=>{
 for(const change of [g=>g.nodes.pop(),g=>g.nodes[0].parameters.download=false,g=>g.nodes[0].retryOnFail=true,g=>g.nodes[2].parameters.options.timeout=500,g=>g.nodes[3].parameters.jsCode='changed']){const g=graph();change(g);assert.throws(()=>buildTelegramFileDiagnosticOperations(g),/CHANGED/)}
});
test('prepared n8n byte checker and store confirmer execute the actual same-reservation flow',async()=>{
 const ops=buildTelegramFileDiagnosticOperations(graph()),checker=ops.find(x=>x.nodeName===telegramFileNodes.bytes).parameters.jsCode,confirmer=ops.find(x=>x.nodeName===telegramFileNodes.confirm).parameters.jsCode;
 const outputs=await run(checker,input(),{'Confirmar operación de paquete Telegram':context()},{getBinaryDataBuffer:async()=>pdf});const verified=outputs[0].json;assert.equal(verified.itemId,itemId);assert.equal(verified.has_file,true);
 const result=(await run(confirmer,{json:stored()},{'Comprobar bytes Telegram':verified}))[0].json;assert.equal(result.itemId,itemId);assert.equal(result.original_stored,true);assert.equal(diagnosis(result).code,'STORE_CONFIRMED');
});
test('receipt preserves opening diagnostics and keeps Telegram acknowledgement separate from file storage',async()=>{
 const code=buildTelegramFileDiagnosticOperations(graph()).find(x=>x.nodeName===telegramFileNodes.receipt).parameters.jsCode;
 const file=confirmObservedStoredOriginal(verified(),stored(),confirmOriginal);
 const receipt=(await run(code,{json:{message_id:10,chat:{id:12345}}},{'Confirmar original Telegram':file}))[0].json;assert.equal(receipt.status,'RECEIPT_CONFIRMED');assert.equal(receipt.original_stored,true);assert.equal(JSON.parse(receipt.storage_diagnostic).code,'STORE_CONFIRMED');assert.equal(receipt.publisher_called,false);
 const failedAck=(await run(code,{json:{error:'private'}},{'Confirmar original Telegram':file}))[0].json;assert.equal(failedAck.status,'RECEIPT_NOT_CONFIRMED');assert.equal(failedAck.original_stored,true);assert.equal(JSON.parse(failedAck.storage_diagnostic).code,'STORE_CONFIRMED');
 const open={kind:'COMMAND',package_operation:'OPEN',chat_id:'12345',storage_diagnostic:JSON.stringify({operation:'OPEN',httpStatus:200,code:'OPEN_CONFIRMED'})};const opening=(await run(code,{json:{message_id:10,chat:{id:12345}}},{'Resolver paquete Telegram':open}))[0].json;assert.equal(opening.storage_diagnostic,open.storage_diagnostic);
 const forged=(await run(code,{json:{message_id:10,chat:{id:12345}}},{'Preparar paquete Telegram':{...open,kind:'TEXT',package_operation:'CONTENT'}}))[0].json;assert.equal(forged.storage_diagnostic,null);
});
