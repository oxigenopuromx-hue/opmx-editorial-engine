import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDraftNotification,finishDraftNotification} from './draft-notify.mjs';
const identity={owner:'12345',chat:'12345'};
function sample(){const request={operation:'preparar_borrador_opmx',destino:'AMBOS',request_id:'tg_'+'a'.repeat(64)};
 const structuredContent={status:'SUCCESS',mode:'DRAFT',request_id:request.request_id,summary:{opuro:'DRAFT',opol:'DRAFT'},post_id_opuro:12,post_id_opol:34,edit_url_opuro:'https://cms.oxigenopuro.com.mx/wp-admin/post.php?post=12&action=edit',edit_url_opol:'https://cms.oxigenopolitico.com.mx/wp-admin/post.php?post=34&action=edit'};
 return {request,response:{httpStatus:200,response:{jsonrpc:'2.0',id:1,result:{isError:false,structuredContent,content:[]}}}};}
test('informa sólo borradores confirmados en el chat fijo',()=>{const x=sample(),p=prepareDraftNotification(x.response,x.request,identity);assert.equal(p.notify,true);assert.equal(p.chatId,identity.chat);assert.match(p.text,/post=12/);assert.match(p.text,/post=34/);assert.equal(finishDraftNotification(p,{chat:{id:12345},message_id:99}).response.result.structuredContent.telegram_draft_notice,'SENT');});
test('falla cerrado si falta una confirmación o cambia el destino o URL',()=>{
 for(const change of [x=>x.response.response.result.structuredContent.summary.opol='FAILED',x=>x.response.response.result.structuredContent.edit_url_opol='https://example.org/',x=>x.request.operation='publicar_nota_opmx',x=>x.request.request_id='manual-request-123456',x=>x.response.response.result.structuredContent.request_id='tg_'+'b'.repeat(64)]){const x=sample();change(x);assert.equal(prepareDraftNotification(x.response,x.request,identity).notify,false);}
 const x=sample();assert.equal(prepareDraftNotification(x.response,x.request,{owner:'1',chat:'2'}).notify,false);
});
test('resultado incierto no autoriza reenvío ni pierde la respuesta del borrador',()=>{const x=sample(),p=prepareDraftNotification(x.response,x.request,identity);const out=finishDraftNotification(p,{error:'timeout'});assert.equal(out.response.result.structuredContent.telegram_draft_notice,'UNCERTAIN');assert.equal(out.response.result.structuredContent.telegram_notice_retry,false);assert.equal(out.response.result.structuredContent.status,'SUCCESS');});
