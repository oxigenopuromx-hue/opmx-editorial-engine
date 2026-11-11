import test from 'node:test';import assert from 'node:assert/strict';
import {prepareWriterReceipt,finishWriterReceipt} from './writer-receipt-protocol.mjs';
const request_id=`tg_${'a'.repeat(64)}`,slug='nota-verificada';
const draft={status:'SUCCESS',mode:'DRAFT',request_id,destino:'OPURO',targets:{oxigenopuro:{status:'DRAFT',post_id:123,slug}}};
const published={httpStatus:200,response:{result:{structuredContent:{status:'SUCCESS',mode:'PUBLISH',request_id,destino:'OPURO',slug,targets:{OPURO:{status:'PUBLISHED',post_id:123,cms_verified:true}}}}}};
test('prepares a receipt only after the writer returned verified complete targets',()=>{
 assert.deepEqual(prepareWriterReceipt(draft).body,{requestId:request_id,phase:'DRAFT',slug,targets:[{destination:'OPURO',postId:123}]});assert.equal(prepareWriterReceipt(published).body.phase,'PUBLISH');
 for(const bad of [{...draft,status:'PARTIAL_SUCCESS'},{...draft,request_id:'manual-request-123'},{...draft,destino:'AMBOS'},{...draft,targets:{oxigenopuro:{status:'DRAFT',post_id:null,slug}}}])assert.equal(prepareWriterReceipt(bad).receiptRequired,false);
 const uncertain=structuredClone(published);uncertain.response.result.structuredContent.targets.OPURO.cms_verified=false;assert.equal(prepareWriterReceipt(uncertain).receiptRequired,false);
});
test('a lost or mismatched receipt preserves the verified publication result but keeps closure uncertain',()=>{
 const prepared=prepareWriterReceipt(published);const result=finishWriterReceipt(prepared,{});assert.equal(result.response.result.structuredContent.status,'SUCCESS');assert.equal(result.response.result.structuredContent.telegram_writer_receipt,'UNCERTAIN');assert.equal(published.response.result.structuredContent.telegram_writer_receipt,undefined);
 const ack={status:'WRITER_RECEIPT_RECORDED',requestId:request_id,phase:'PUBLISH',packageId:`tg_${'b'.repeat(40)}`,revision:7,receiptHash:'c'.repeat(64)};
 assert.equal(finishWriterReceipt(prepared,ack).response.result.structuredContent.telegram_writer_receipt,'RECORDED');assert.equal(finishWriterReceipt(prepared,{...ack,requestId:`tg_${'d'.repeat(64)}`}).response.result.structuredContent.telegram_writer_receipt,'UNCERTAIN');
});
test('non-Telegram writers remain untouched and never call the receipt route',()=>{const value={...draft,request_id:'manual-request-123'},prepared=prepareWriterReceipt(value);assert.equal(finishWriterReceipt(prepared,{}),value)});
