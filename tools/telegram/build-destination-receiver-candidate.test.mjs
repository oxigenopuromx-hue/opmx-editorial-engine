import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {candidateNodes,correlationLabels} from './build-destination-receiver-candidate.mjs';
import {chooseTelegramMode} from './destination-policy-candidate.mjs';
import {createHash} from 'node:crypto';
const pkg='tg_'+'a'.repeat(40), cfg={allowedUserIds:['123'],allowedChatIds:['123']};
function execute(name,input,upstream={}){let src=candidateNodes.find(n=>n.name===name).parameters.jsCode;return vm.runInNewContext('(function(){'+src+'})()',{$input:{first:()=>({json:input})},$:name=>({first:()=>({json:upstream[name]})})});}
function update(text,extra={}){return {update_id:100,message:{message_id:20,chat:{id:123,type:'private'},from:{id:123},text,...extra}}}
function received(text,extra={}){return execute('Normalizar entrada Telegram',{update:update(text,extra),config:cfg})[0]?.json;}
function resolve(intent){return execute('Resolver paquete Telegram',{status:'OPEN',packageId:pkg},{'Preparar paquete Telegram':{...intent,package_operation:'CONTENT'}})[0].json.next_body.text;}
function choose(texts){const sources=texts.map((s,i)=>({item_id:'ti_'+i.toString(16).padStart(40,'0'),stream:'text',bytes:Buffer.from(s)}));const inventory={package_id:pkg,state:'READY',items:sources.map(s=>({item_id:s.item_id,kind:'TEXT',state:'STORED',text_bytes:s.bytes.length,sha256:createHash('sha256').update(s.bytes).digest('hex')}))};return chooseTelegramMode(inventory,sources)}
test('normalizer accepts only known standalone destination commands',()=>{
 for(const c of ['/publicar liberal','/publicar todos','/borrador opol,liberal','/publicar ambos','/listo'])assert.equal(received(c).mode_attested,true,c);
 for(const c of ['/publicar desconocido','/publicar opuro,,liberal','/publicar liberal\ntexto','/nuevo liberal'])assert.equal(received(c).kind,'REJECTED',c);
 assert.equal(received('/publicar todos',{forward_origin:{type:'user'}}).kind,'REJECTED');
 assert.equal(received('/publicar todos',{photo:[{file_id:'p',width:10,height:10}]}).kind,'FILE');
 assert.equal(received('/publicar todos',{from:{id:456}}),undefined);
});
test('real normalized controls are bound and interpreted by candidate policy',()=>{
 for(const [cmd,expected] of [['/publicar liberal','LIBERAL'],['/publicar todos','TODOS'],['/borrador liberal,opuro','OPURO,LIBERAL']]){
  const bound=resolve(received(cmd));assert.match(bound,/^OPMX-TELEGRAM-ORDER-/);
  const r=choose(['Fuente',bound]);assert.equal(r.destination,expected);assert.equal(r.authorized,true);
 }
});
test('every nonempty combination has one unambiguous canonical correlation',()=>{
 assert.deepEqual(correlationLabels(),['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS']);
});
