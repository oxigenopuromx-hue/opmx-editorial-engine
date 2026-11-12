import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeControl,chooseTelegramMode,attestedControl} from '../original-destination-policy.mjs';
import {buildLiteralReceiverOperations,patchLiteralReceiverCode,literalReceiverNames} from './build-literal-receiver-operations.mjs';
const pkg='tg_'+'a'.repeat(40),digest=s=>createHash('sha256').update(s).digest('hex');
const source=name=>readFileSync(new URL(name,import.meta.url),'utf8');
function code(name,input,prepared){return new Function('$input','$',source(name))({first:()=>({json:input})},selector=>({first:()=>({json:prepared})}));}
function message(text,changes={}){return {update_id:50,message:{message_id:15,from:{id:101,is_bot:false},chat:{id:101,type:'private'},text,...changes}};}
function normalize(update,config={allowedUserIds:['101'],allowedChatIds:['101']}){return code('normalize-candidate.js',{update,config})[0]?.json??null;}
function prepare(input){return code('prepare-candidate.js',input)[0].json;}
function resolve(input,recovery=false){return code('resolve-candidate.js',{status:'OPEN',packageId:pkg,revision:4,recovery},prepare(input))[0].json;}
const aliases=['/literal','tal cual','publica tal cual','publicar tal cual','sin agregar nada','tal cual sin agregar nada','publica tal cual sin agregar nada','publicar tal cual sin agregar nada','La publicación va tal cual, sin agregarle nada.','La publicación va tal cual, sin agregarle nada','La publicacion va tal cual, sin agregarle nada.','La publicacion va tal cual, sin agregarle nada'];
for(const alias of aliases)test('receiver stores canonical direct authenticated control for '+alias,()=>{
 const n=normalize(message(alias));assert.equal(n.mode_attested,true);assert.equal(n.content_mode_command,'/literal');assert.equal(n.text,alias);
 const p=prepare(n);assert.equal(p.package_operation,'CONTENT');const r=resolve(n);assert.equal(r.next_action,'reserve');assert.equal(r.next_body.kind,'TEXT');
 const control=decodeControl(r.next_body.text,pkg);assert.equal(control.command,'/literal');assert.equal(control.message_id,15);assert.equal(control.package_id,pkg);
 // This is the actual canonical text passed to reserve, with its actual bytes.
 const texts=[attestedControl('/nuevo',pkg,10,11),'Título\n\nCuerpo',r.next_body.text,attestedControl('/listo',pkg,20)];const sources=[],items=texts.map((text,i)=>{const bytes=Buffer.from(text),item_id='ti_'+String(i+1).repeat(40);sources.push({item_id,stream:'text',bytes});return {item_id,kind:'TEXT',state:'STORED',text_bytes:bytes.length,sha256:digest(bytes)}});
 const decision=chooseTelegramMode({state:'READY',package_id:pkg,items},sources);assert.equal(decision.content_mode,'LITERAL');assert.equal(decision.mode,'PUBLISH');assert.equal(decision.destination,'TODOS');assert.equal(decision.content_control_item_ids.length,1);
});
test('editorial is a direct content choice without changing publishing/destinations',()=>{const n=normalize(message('/editorial'));assert.equal(decodeControl(resolve(n).next_body.text,pkg).command,'/editorial');});
for(const extra of [{forward_origin:{type:'user'}},{forward_date:10},{forward_from:{id:202}},{forward_from_chat:{id:202}},{forward_sender_name:'Source'},{reply_to_message:{message_id:10,text:'Source'}},{external_reply:{origin:{type:'user'}}},{quote:{text:'Source'}},{edit_date:10},{edit_date:0},{reply_to_message:null},{forward_sender_name:''}])test('direct literal selection rejects forwarded/replied/edited provenance '+Object.keys(extra)[0]+JSON.stringify(extra),()=>{
 for(const text of ['/literal','tal cual','publica tal cual sin agregar nada','La publicación va tal cual, sin agregarle nada.']){const n=normalize(message(text,extra));assert.equal(n.kind,'REJECTED');assert.equal(n.mode_attested,undefined);assert.equal(n.has_file,false)}
});
test('edited updates cannot introduce content controls',()=>{const u=message('/literal');u.edited_message=u.message;delete u.message;assert.equal(normalize(u),null);});
test('captions/files are preserved as sources and never select literal',()=>{
 for(const attachment of [{photo:[{file_id:'QA-file',width:1200,height:630,file_size:100}]},{document:{file_id:'QA-file',file_name:'qa.jpg',mime_type:'image/jpeg',file_size:100}}])for(const caption of ['/literal','La publicación va tal cual, sin agregarle nada.']){const u=message(undefined,{...attachment,caption});delete u.message.text;const n=normalize(u);assert.equal(n.kind,'FILE');assert.equal(n.content_mode_command,undefined);assert.equal(n.mode_attested,undefined);const r=resolve(n);assert.equal(r.next_body.kind,'FILE');assert.equal(r.next_body.text,caption);assert.equal(r.next_body.attachment.mime_type,'image/jpeg')}
});
test('a phrase inside article text cannot become a control',()=>{
 for(const text of ['Título\n\nPublica tal cual sin agregar nada es una cita de la fuente.','La expresión tal cual forma parte del artículo.','tal cual\nEsta segunda línea es contenido.','Título\n\nLa publicación va tal cual, sin agregarle nada.','El artículo cita: La publicación va tal cual, sin agregarle nada.']){const n=normalize(message(text));assert.equal(n.mode_attested,false);assert.equal(n.content_mode_command,null);assert.equal(resolve(n).next_body.text,text)}
});
test('untrusted callers and ambiguous slash commands are not stored as controls',()=>{
 assert.equal(normalize(message('/literal'),{allowedUserIds:['202'],allowedChatIds:['101']}),null);
 assert.equal(normalize(message('/literal',{chat:{id:101,type:'group'}})),null);
 assert.equal(normalize(message('/literal',{from:{id:101,is_bot:true}})),null);
 for(const text of ['/literal extra','/literal\n/publicar TODOS'])assert.equal(normalize(message(text)).kind,'REJECTED');
});
test('forged content metadata cannot make a source an attested control',()=>{
 const n=normalize(message('Texto editorial'));n.content_mode_command='/literal';n.mode_attested=true;const r=resolve(n);assert.equal(r.requires_operation,false);assert.equal(r.next_action,undefined);
});
test('recovery uses the existing explicit options path, never a fresh original-mode control',()=>{
 for(const text of ['/literal','tal cual','/editorial']){const r=resolve(normalize(message(text)),true);assert.equal(r.requires_operation,false);assert.equal(r.next_action,undefined);assert.match(r.reply_text,/\/opciones/)}
});
test('builder refuses altered or already-patched graphs without touching other nodes',()=>{
 const nodes=Array.from({length:52},(_,i)=>({name:'QA '+i,type:'n8n-nodes-base.noOp',typeVersion:1,parameters:{}})),graph={nodes,connections:{}};
 assert.throws(()=>buildLiteralReceiverOperations(graph),/LITERAL_RECEIVER_NODE_CHANGED/);
 assert.throws(()=>buildLiteralReceiverOperations({...graph,nodes:nodes.slice(1)}),/LITERAL_RECEIVER_GRAPH_CHANGED/);
 assert.throws(()=>patchLiteralReceiverCode(literalReceiverNames.normalize,source('normalize-candidate.js')),/LITERAL_RECEIVER_SOURCE_CHANGED/);
 assert.throws(()=>patchLiteralReceiverCode(literalReceiverNames.prepare,'return []'),/LITERAL_RECEIVER_SOURCE_CHANGED/);
 assert.throws(()=>patchLiteralReceiverCode('Unknown','return []'),/LITERAL_RECEIVER_NODE_UNKNOWN/);
});
