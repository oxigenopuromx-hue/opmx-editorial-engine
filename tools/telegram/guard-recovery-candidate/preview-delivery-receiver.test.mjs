import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('./receiver/preview-delivery-ack-candidate.js',import.meta.url),'utf8');
const sendCode=await readFile(new URL('./receiver/preview-delivery-send-candidate.js',import.meta.url),'utf8');
const identityCode=await readFile(new URL('./receiver/preview-delivery-identity-candidate.js',import.meta.url),'utf8');
const nextCode=await readFile(new URL('./receiver/preview-delivery-next-candidate.js',import.meta.url),'utf8');
const run=(context,result)=>new Function('$input','$','$runIndex',code)({first:()=>({json:result})},()=>({first:()=>({json:context})}),0)[0].json;
const send=(identity,claim)=>new Function('$input','$',sendCode)({first:()=>({json:claim})},()=>({first:()=>({json:identity})}))[0].json;
const runNode=(code,prior,result)=>new Function('$input','$',code)({first:()=>({json:result})},()=>({first:()=>({json:prior})}))[0].json;
const context={identity:{owner:'123',chat:'123',packageId:'tg_'+'a'.repeat(40),revision:8,previewHash:'b'.repeat(64)},claim:{status:'PART_CLAIMED',part:1,parts:2,token:'c'.repeat(64)}};
test('only an acknowledged response for the same Telegram chat produces a receipt',()=>{
 const out=run(context,{message_id:999,chat:{id:123}});assert.equal(out.status,'RECEIPT_READY');assert.equal(out.body.telegramMessageId,999);assert.equal(out.body.token,context.claim.token);
 assert.deepEqual(Object.keys(run({...context,identity:{...context.identity,status:'PREVIEW_IDENTITY_READY'}},{message_id:999,chat:{id:123}}).body).sort(),['owner','chat','packageId','revision','previewHash','part','token','telegramChat','telegramMessageId'].sort());
});
test('send mapping excludes the guard capability from Telegram fields',()=>{
 const claim={...context.claim,text:'Vista privada',parseMode:'HTML'},out=send(context.identity,claim);
 assert.equal(out.status,'SEND_READY');assert.deepEqual(out.telegram,{chatId:'123',text:'Vista privada',parseMode:'HTML'});assert.ok(!JSON.stringify(out.telegram).includes(claim.token));
 assert.equal(send(context.identity,{...claim,status:'DELIVERY_UNCERTAIN'}).status,'DELIVERY_UNCERTAIN');
});
test('only a verified preview from the current recovery can initialize delivery',()=>{
 const c={user_id:'123',chat_id:'123',packageId:context.identity.packageId,recovery_session:true};
 const p={packageId:c.packageId,revision:8,previewHash:context.identity.previewHash};
 const request={preview_requested:true,preview_body:{owner:'123',chat:'123',packageId:c.packageId,revision:8}};
 const identityRun=(ctx,req,result)=>new Function('$input','$',identityCode)({first:()=>({json:result})},name=>({first:()=>({json:name==='Resolver paquete Telegram'?ctx:req})}))[0].json;
 const identity=identityRun(c,request,{status:'PREVIEW_READY',preview:p});assert.equal(identity.status,'PREVIEW_IDENTITY_READY');
 assert.equal(identityRun({...c,recovery_session:false},request,{status:'PREVIEW_READY',preview:p}).status,'PREVIEW_NOT_CONFIRMED');
 assert.equal(identityRun(c,request,{status:'PREVIEW_READY',preview:{...p,revision:7}}).status,'PREVIEW_NOT_CONFIRMED');
 assert.equal(identityRun(c,{...request,preview_body:{...request.preview_body,owner:'456'}},{status:'PREVIEW_READY',preview:p}).status,'PREVIEW_NOT_CONFIRMED');
 assert.equal(runNode(nextCode,identity,{status:'PART_REPORTED'}).status,'CLAIM_NEXT');
 assert.equal(runNode(nextCode,identity,{status:'DELIVERY_UNCERTAIN'}).status,'DELIVERY_UNCERTAIN');
});
test('missing response, wrong chat, missing message ID and unclaimed parts stay uncertain',()=>{
 for(const [c,r] of [[context,{}],[context,{message_id:1,chat:{id:456}}],[context,{chat:{id:123}}],[{...context,claim:{...context.claim,status:'DELIVERY_UNCERTAIN'}},{message_id:1,chat:{id:123}}]]){
  const out=run(c,r);assert.equal(out.status,'DELIVERY_UNCERTAIN');assert.equal(out.retryPermitted,false);assert.equal(out.body,undefined);
 }
});
test('the receipt uses the corresponding sender execution on subsequent parts',()=>{
 const contexts=[context,{...context,claim:{...context.claim,part:2,token:'d'.repeat(64)}}];
 const out=new Function('$input','$','$runIndex',code)({first:()=>({json:{message_id:1000,chat:{id:123}}})},()=>({first:(branch,run)=>({json:contexts[run]})}),1)[0].json;
 assert.equal(out.body.part,2);assert.equal(out.body.token,'d'.repeat(64));
});
