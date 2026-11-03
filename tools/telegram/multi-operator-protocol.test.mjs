import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {identityForPrivateCall,identityForPublisherNotice} from './multi-operator-protocol.mjs';
import {classifyTelegramReader} from './mcp-reader.mjs';
import {prepareDraftNotification} from './draft-notify.mjs';
import {preparePublicationNotice} from './publication-notify.mjs';
const p='tg_'+'a'.repeat(40),q='tg_'+'b'.repeat(40),subscriber={owner:'11',chat:'11'};
const rows=[{package_id:p,revision:2,stage:'QUEUED',chat_id:'11'},{package_id:q,revision:2,stage:'QUEUED',chat_id:'22'}];
const call=package_id=>({body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'leer_paquete_telegram_opmx',arguments:{package_id}}}});
test('private source requests route to the actual owner and missing package is rejected',()=>{
 const identity=identityForPrivateCall(call(q),rows,subscriber);
 const result=classifyTelegramReader(call(q),identity,()=>({}));
 assert.equal(result.route,'telegram-read');assert.equal(result.request.body.owner,'22');
 assert.throws(()=>identityForPrivateCall(call('tg_'+'c'.repeat(40)),rows,subscriber));
 assert.deepEqual(identityForPrivateCall({method:'events/list'},rows,subscriber),subscriber);
});
test('draft delivery uses request owner, and absent association sends no notice',()=>{
 const request_id='tg_'+createHash('sha256').update(`${q}:2:OPURO:draft-v1`).digest('hex');
 const identity=identityForPublisherNotice(rows,{request_id});assert.deepEqual(identity,{owner:'22',chat:'22'});
 const response={response:{result:{isError:false,structuredContent:{status:'SUCCESS',mode:'DRAFT',request_id,summary:{opuro:'DRAFT'},post_id_opuro:1,edit_url_opuro:'https://cms.oxigenopuro.com.mx/wp-admin/post.php?post=1&action=edit'}}}};
 assert.equal(prepareDraftNotification(response,{operation:'preparar_borrador_opmx',request_id,destino:'OPURO'},identity).chatId,'22');
 assert.equal(identityForPublisherNotice(rows,{request_id:'tg_'+'0'.repeat(64)}),null);
});
test('publication result is addressed to the original operator',()=>{
 const request_id='tg_'+createHash('sha256').update(`${q}:2:AMBOS:draft-v1`).digest('hex');
 const request={operation:'publicar_nota_opmx',confirmar_publicacion:'PUBLICAR',destino:'AMBOS',request_id};
 const response={response:{result:{structuredContent:{status:'SUCCESS',mode:'PUBLISH',request_id,destino:'AMBOS',slug:'nota-ejemplo',targets:{OPURO:{status:'PUBLISHED',cms_verified:true,post_id:1,public_url:'https://oxigenopuro.com.mx/nota-ejemplo/'},OPOL:{status:'PUBLISHED',cms_verified:true,post_id:2,public_url:'https://oxigenopolitico.com.mx/estados/nota-ejemplo/'}}}}}};
 const identity=identityForPublisherNotice(rows,request);
 assert.equal(preparePublicationNotice(response,request,identity).chatId,'22');
 assert.equal(preparePublicationNotice(response,request,null).notify,false);
});
