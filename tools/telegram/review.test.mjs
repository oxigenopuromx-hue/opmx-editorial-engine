import test from 'node:test';import assert from 'node:assert/strict';
import {validateReviewRequest,createTelegramReviewStore} from './review-store.mjs';
import {classifyTelegramReview,telegramReviewAck,formatTelegramReviewResult} from './review-protocol.mjs';
import {classifyFileMcp} from '../mcp-publisher/files-mcp-protocol.mjs';import {classifyTelegramReader} from './mcp-reader.mjs';import {classifyTelegramEvents} from './event-protocol.mjs';
import {buildTelegramReviewOperations} from './build-mcp-review.mjs';
const who={owner:'1001',chat:'1001'},pkg='tg_'+'a'.repeat(40),input={...who,packageId:pkg,revision:7,outcome:'COHERENCE_REQUIRED'};
function fixture({lostCommit=false,wrongVersion=false}={}){let row=null,claim=false;const queries=[],c={release(){},async beginTransaction(){},async rollback(){},async commit(){if(lostCommit&&claim)throw Error('lost ack');},async execute(sql,args=[]){queries.push([sql,args]);if(sql.startsWith('CREATE'))return [{}];if(sql.startsWith('SELECT id'))return [[{id:1}]];if(sql.startsWith('SELECT revision'))return [[{revision:wrongVersion?8:7}]];if(sql.startsWith('SELECT state'))return [row?[row]:[]];if(sql.startsWith('SELECT COUNT'))return [[{count:3}]];if(sql.startsWith('INSERT')){claim=true;row={state:'CLAIMED',message_id:null};return [{affectedRows:1}];}if(sql.startsWith('UPDATE')){row={state:'SENT',message_id:args[0]};return [{affectedRows:1}];}throw Error('Unexpected SQL');}};return {pool:{async getConnection(){return c;}},queries};}
test('private review forbids arbitrary recipients, text, links, outcomes and malformed acknowledgements',()=>{
 assert.ok(validateReviewRequest('begin',input).key);
 for(const x of [{...input,owner:'2002'},{...input,text:'send this'},{...input,url:'https://example.com'},{...input,revision:1.5},{...input,outcome:'PUBLISHED'},{...input,packageId:'../path'}])assert.throws(()=>validateReviewRequest('begin',x));
 for(const id of [0,-1,'12',1.5])assert.throws(()=>validateReviewRequest('report',{...input,messageId:id}));
});
test('claim commits before Telegram, replay cannot send twice, and confirmed report is idempotent',async()=>{
 const f=fixture(),s=createTelegramReviewStore(f.pool),a=await s.run('begin',input);assert.equal(a.status,'SEND_REVIEW');assert.equal(a.chatId,who.chat);assert.ok(a.text.includes('temas distintos'));assert.ok(a.text.includes('No se ha generado ni publicado'));
 assert.equal((await s.run('begin',input)).status,'REVIEW_UNCERTAIN');assert.equal((await s.run('report',{...input,messageId:123})).status,'REVIEW_REPORTED');assert.equal((await s.run('begin',input)).status,'REVIEW_REPORTED');assert.equal((await s.run('report',{...input,messageId:123})).status,'REVIEW_REPORTED');assert.equal((await s.run('report',{...input,messageId:124})).status,'REVIEW_CONFLICT');
 assert.equal(f.queries.filter(([q])=>q.startsWith('INSERT')).length,1);assert.ok(f.queries.some(([q])=>q.includes('FOR UPDATE')));
});
test('lost claim commit acknowledgement never grants a send; wrong package version cannot claim',async()=>{
 await assert.rejects(createTelegramReviewStore(fixture({lostCommit:true}).pool).run('begin',input),/no confirmada/);
 const f=fixture({wrongVersion:true});assert.equal((await createTelegramReviewStore(f.pool).run('begin',input)).status,'REVIEW_NOT_READY');assert.equal(f.queries.some(([q])=>q.startsWith('INSERT')),false);
});
test('seven tool catalog retains events and source readers; target is server-bound',()=>{
 const route=m=>classifyTelegramReview({body:m},who,x=>classifyTelegramEvents(x,who,y=>classifyTelegramReader(y,who,classifyFileMcp)));
 assert.equal(route({jsonrpc:'2.0',id:1,method:'tools/list'}).response.result.tools.length,7);assert.equal(route({jsonrpc:'2.0',id:2,method:'events/list'}).response.result.events.length,1);
 const m={jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'informar_revision_telegram_opmx',arguments:{package_id:pkg,revision:7,outcome:input.outcome}}};const r=route(m);assert.equal(r.route,'telegram-review');assert.equal(r.request.body.chat,who.chat);m.params.arguments.chat_id='2002';assert.equal(route(m).response.error.code,-32602);
});
test('only positive message id in the expected chat can confirm delivery; formatter omits Telegram body and recipient',()=>{
 const req={id:1,body:input};assert.equal(telegramReviewAck(req,{result:{chat:{id:1001},message_id:42}}).messageId,42);
 for(const response of [{},{error:'timeout'},{result:{chat:{id:2002},message_id:42}},{result:{chat:{id:1001},message_id:0}}])assert.equal(telegramReviewAck(req,response).messageId,0);
 const result=formatTelegramReviewResult(req,{status:'REVIEW_REPORTED',packageId:pkg,revision:7,outcome:input.outcome,messageId:42,text:'private text',chatId:1001});assert.equal(result.response.result.isError,false);assert.equal(JSON.stringify(result).includes('private text'),false);assert.equal(result.response.result.structuredContent.chatId,undefined);
 assert.equal(formatTelegramReviewResult(req,{status:'REVIEW_UNCERTAIN'}).response.result.structuredContent.retryPermitted,false);
});
test('embedded n8n router executes; send is conditional on durable claim and has no automatic retry',()=>{
 const ops=buildTelegramReviewOperations({identity:who,guardCredential:{id:'existing',name:'Guard'},telegramCredential:{id:'existing-bot',name:'Bot'}}),code=ops[0].parameters.jsCode;
 const out=new Function('$input',code)({first:()=>({json:{body:{jsonrpc:'2.0',id:1,method:'tools/list'}}})});assert.equal(out[0].json.response.result.tools.length,7);
 const send=ops.find(x=>x.node?.name==='Enviar revisión privada Telegram').node;assert.equal(send.parameters.chatId,'={{ $json.chatId }}');assert.equal(send.credentials.telegramApi.id,'existing-bot');assert.ok(ops.some(x=>x.nodeName===send.name&&x.settings?.retryOnFail===false));
 assert.ok(ops.some(x=>x.type==='addConnection'&&x.source==='¿Enviar informe Telegram?'&&x.target==='Resultado revisión privada MCP'&&x.sourceIndex===1));
});

