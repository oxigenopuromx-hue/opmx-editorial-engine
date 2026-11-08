import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildCorrectionPreview} from './correction-preview.mjs';
import {createPreviewDeliveryStore} from './preview-delivery-store.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),id='tg_'+'a'.repeat(40),actorKey=sha('opmx:telegram:v1:123:123');
function setup(){
 const item={itemId:'ti_'+'b'.repeat(40),kind:'TEXT',state:'STORED',text:'Contenido <verificado> '.repeat(300),sha256:sha('Contenido <verificado> '.repeat(300))};
 const preview=buildCorrectionPreview({packageId:id,revision:9,baseRevision:7,ownerKey:actorKey,actorKey,before:[item],after:[item],action:'CREATE',mode:'LITERAL',destination:'OPURO',verifiedPosts:{}});
 let data={pack:{owner_key:actorKey,state:'OPEN',revision:9},preview:{owner_key:actorKey,preview_receipt:'telegram-123-10-10',preview_json:JSON.stringify(preview),state:'PREVIEWED'},parts:[]},saved;
 const c={async beginTransaction(){saved=structuredClone(data)},async commit(){},async rollback(){data=saved},release(){},async execute(sql,args){
  if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];
  if(sql.startsWith('SELECT owner_key,state,revision FROM opmx_tg_packages'))return [[data.pack]];
  if(sql.startsWith('SELECT owner_key,preview_receipt'))return [[data.preview]];
  if(sql.startsWith('SELECT actor_key,part_number'))return [data.parts];
  if(sql.startsWith('INSERT INTO opmx_tg_preview_delivery')){data.parts.push({actor_key:args[3],part_number:args[4],part_count:args[5],payload_hash:args[6],state:'PENDING',token_hash:null,telegram_message_id:null});return [{affectedRows:1}]}
  if(sql.includes("SET state='SENDING'")){const p=data.parts[args[4]-1];if(p.state!=='PENDING')return [{affectedRows:0}];p.state='SENDING';p.token_hash=args[0];return [{affectedRows:1}]}
  if(sql.includes("SET state='SENT'")){const p=data.parts[args[4]-1];if(p.state!=='SENDING'||p.token_hash!==args[5])return [{affectedRows:0}];p.state='SENT';p.telegram_message_id=args[0];return [{affectedRows:1}]}
  throw Error('unexpected SQL '+sql);
 }};
 const store=createPreviewDeliveryStore({pool:{async getConnection(){return c}},tokenFactory:()=> 'c'.repeat(64)});
 const input={owner:'123',chat:'123',packageId:id,revision:9,previewHash:preview.previewHash};
 return {store,c,input,preview,get data(){return data}};
}
test('all preview parts must be acknowledged in order before confirmation',async()=>{
 const f=setup(),start=await f.store.initialize(f.input);assert.ok(start.parts>1);
 const proof={packageId:id,revision:9,previewHash:f.preview.previewHash,actorKey,previewReceipt:'telegram-123-10-10'};
 assert.equal(await f.store.verifyPreviewDelivery(f.c,proof),false);
 for(let i=1;i<=start.parts;i++){
  const part=await f.store.claim(f.input);assert.equal(part.status,'PART_CLAIMED');assert.equal(part.part,i);
  assert.equal((await f.store.report({...f.input,part:i,token:part.token,telegramChat:'123',telegramMessageId:100+i})).status,'PART_REPORTED');
 }
 assert.equal((await f.store.claim(f.input)).status,'DELIVERY_COMPLETE');assert.equal(await f.store.verifyPreviewDelivery(f.c,proof),true);
 assert.equal(await f.store.verifyPreviewDelivery(f.c,{...proof,previewReceipt:'telegram-123-1-1'}),false);
});
test('lost acknowledgement prevents repeat send and no forged acknowledgement succeeds',async()=>{
 const f=setup();await f.store.initialize(f.input);const p=await f.store.claim(f.input);
 assert.equal((await f.store.claim(f.input)).status,'DELIVERY_UNCERTAIN');
 assert.equal((await f.store.report({...f.input,part:p.part,token:'d'.repeat(64),telegramChat:'123',telegramMessageId:101})).status,'NOT_AUTHORIZED');
 await assert.rejects(()=>f.store.report({...f.input,part:p.part,token:p.token,telegramChat:'456',telegramMessageId:101}),/INVALID_PREVIEW_DELIVERY/);
 assert.equal(f.data.parts[0].state,'SENDING');
});
test('an earlier Telegram receipt cannot acknowledge a later part',async()=>{
 const f=setup();await f.store.initialize(f.input);let p=await f.store.claim(f.input);
 await f.store.report({...f.input,part:p.part,token:p.token,telegramChat:'123',telegramMessageId:101});p=await f.store.claim(f.input);
 assert.equal((await f.store.report({...f.input,part:p.part,token:p.token,telegramChat:'123',telegramMessageId:101})).status,'DELIVERY_UNCERTAIN');
 assert.equal(f.data.parts[1].state,'SENDING');
});
test('a stale revision or changed preview cannot claim a part',async()=>{
 const f=setup();await f.store.initialize(f.input);f.data.pack.revision=10;
 assert.equal((await f.store.claim(f.input)).status,'NOT_AVAILABLE');
 f.data.pack.revision=9;f.data.preview.preview_json=f.data.preview.preview_json.replace('Contenido','Alterado');
 await assert.rejects(()=>f.store.claim(f.input),/PREVIEW_DELIVERY_UNCONFIRMED/);
});
