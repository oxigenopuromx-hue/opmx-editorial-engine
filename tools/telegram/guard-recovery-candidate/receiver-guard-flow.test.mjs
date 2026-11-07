import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {request} from 'node:http';import {createHash} from 'node:crypto';import {createGuard} from './deployed-guard/guard-server.mjs';import {createReopenService} from './reopen-service.mjs';
const path=name=>new URL('./receiver/'+name,import.meta.url),[normal,prepare,resolve,seal]=await Promise.all(['normalize-candidate.js','prepare-candidate.js','resolve-candidate.js','seal-candidate.js'].map(x=>readFile(path(x),'utf8')));
const pkg='tg_'+'a'.repeat(40),item='ti_'+'1'.repeat(40),owner=createHash('sha256').update('opmx:telegram:v1:123:123').digest('hex'),secret='a'.repeat(64);
const run=(code,input,prior)=>new Function('$input','$',code)({first:()=>({json:input})},()=>({first:()=>({json:prior})}));
const message=(text,n)=>({update:{update_id:n+100,message:{message_id:n,chat:{id:456,type:'private'},from:{id:456,is_bot:false},text}},config:{allowedUserIds:['456'],allowedChatIds:['456']}});
function post(port,url,body){return new Promise((ok,fail)=>{const r=request({hostname:'127.0.0.1',port,path:url,method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'}},res=>{let b='';res.on('data',x=>b+=x);res.on('end',()=>ok(JSON.parse(b)))});r.on('error',fail);r.end(JSON.stringify(body))})}

test('candidate receiver, authenticated guard, administrator and close cooperate without a real publication',async()=>{
 const state={pkg:{ownerKey:owner,state:'READY',revision:7},session:null,lease:null,items:[{itemId:item,ownerKey:owner,state:'STORED'}],events:0};
 const db={async transaction(fn){return fn({async lockQuota(){},async lockPackage(){return state.pkg},async lockSession(){return state.session},async lockLease(){return state.lease},async lockInventory(){return state.items},async lockSafetyBarrier(){return {packageId:pkg,revision:7,terminalBlocked:true,noActiveAttempts:true,noPublicationSideEffects:true,writesFenced:true}},async captureTrustedRevision(){return {packageId:pkg,revision:7,ownerKey:owner,requestId:'old-request',destinations:['OPURO'],authorization:{mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND'},controls:[item],results:[{destination:'OPURO',status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}]}},async claimRecoveryFence(){return true},async saveSnapshot(){},async markOpen(x){state.pkg.state='OPEN';state.pkg.revision=x.revision},async createLease(x){state.lease={actorKey:x.actorKey}},async createSession(x){state.session={packageId:x.packageId}},async audit(){}})}};
 const store={async run(action,x){if(action==='current')return state.session?{status:'OPEN',packageId:pkg}:{status:'NO_OPEN_PACKAGE'};if(action==='reserve'){state.items.push({text:x.text});return {status:'STORED',packageId:pkg,itemId:'ti_'+'b'.repeat(40)}}if(action==='seal'){assert.equal(x.receiptId,'telegram-456-12-112');state.pkg.state='READY';state.pkg.revision++;state.session=null;state.events++;return {status:'READY',packageId:pkg,revision:state.pkg.revision}}throw Error(action)}};
 const server=createGuard({pool:{async getConnection(){throw Error('unused')}},secret,telegramRecovery:createReopenService({db,adminUserIds:['456']}),telegramStore:store});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const port=server.address().port;
 try{
  const openIntent=run(prepare,run(normal,message('/abrir '+pkg,10))[0].json)[0].json;assert.equal(openIntent.storage_action,'reopen');
  const opened=await post(port,'/v1/telegram/packages/reopen',openIntent.storage_body);const openReply=run(resolve,opened,openIntent)[0].json;assert.equal(openReply.package_state,'OPEN');assert.match(openReply.reply_text,/reabierto/);assert.equal(state.pkg.ownerKey,owner);
  for(const [text,n] of [['Información adicional',11],['/listo',12]]){
   const intent=run(prepare,run(normal,message(text,n))[0].json)[0].json;const current=await post(port,'/v1/telegram/packages/current',intent.storage_body);const next=run(resolve,current,intent)[0].json;
   const reserved=await post(port,'/v1/telegram/packages/'+next.next_action,next.next_body);assert.equal(reserved.status,'STORED');
   if(n===12){const ready=run(seal,reserved,next)[0].json;assert.equal(ready.seal_requested,true);const result=await post(port,'/v1/telegram/packages/seal',ready.seal_body);assert.equal(result.status,'READY');}
  }
  assert.equal(state.events,1);assert.equal(state.session,null);assert.equal(state.items.length,3);
 }finally{await new Promise(ok=>server.close(ok))}
});
