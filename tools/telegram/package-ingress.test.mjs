import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePackageIntent,resolvePackageSession,confirmPackageOperation,confirmStoredOriginal,packageIngressCode} from './package-ingress.mjs';
import {buildPackageIntakeOperations} from './build-package-intake.mjs';
const pkg='tg_'+'a'.repeat(40),item='ti_'+'b'.repeat(40);
const text=t=>({user_id:'1001',chat_id:'1001',kind:'TEXT',text:t,has_file:false,receipt_id:'telegram-1001-20-123'});
const file={...text('/nuevo'),kind:'FILE',has_file:true,attachment:{file_name:'<image>.jpg',mime_type:'image/jpeg',declared_bytes:100,file_id:'private-id'}};
test('only standalone commands control packages; captions and publish language remain source data',()=>{
 assert.equal(preparePackageIntent(text('/nuevo')).storage_action,'open');
 assert.equal(preparePackageIntent(file).storage_action,'current');assert.equal(preparePackageIntent(file).package_operation,'CONTENT');
 assert.equal(preparePackageIntent(text('Publica en ambos')).package_operation,'CONTENT');
 assert.equal(preparePackageIntent(text('/listo')).package_operation,'SEAL');
 assert.equal(preparePackageIntent(text('/start')).requires_storage,false);
});
test('missing/uncertain session prevents reservation and download',()=>{
 for(const r of [{status:'NO_OPEN_PACKAGE'},{error:'timeout'},{status:'OPEN',packageId:'../../x'}]) {
  const v=resolvePackageSession(preparePackageIntent(file),r);assert.equal(v.has_file,false);assert.equal(v.requires_operation,false);
 }
});
test('reserve uses captured package and excludes Telegram file IDs from persistent attachment',()=>{
 const v=resolvePackageSession(preparePackageIntent(file),{status:'OPEN',packageId:pkg});
 assert.equal(v.next_action,'reserve');assert.equal(v.next_body.packageId,pkg);assert.equal(v.next_body.attachment.file_id,undefined);
 const ready=confirmPackageOperation(v,{status:'RESERVED',packageId:pkg,itemId:item});assert.equal(ready.has_file,true);assert.equal(ready.itemId,item);
});
test('confirmed text and duplicate stored files need no download',()=>{
 const x=resolvePackageSession(preparePackageIntent(text('fuente')),{status:'OPEN',packageId:pkg});
 assert.equal(confirmPackageOperation(x,{status:'STORED',packageId:pkg,itemId:item}).source_stored,true);
 const y=resolvePackageSession(preparePackageIntent(file),{status:'OPEN',packageId:pkg});
 const replay=confirmPackageOperation(y,{status:'RESERVATION_REPLAY',state:'STORED',itemId:item});assert.equal(replay.has_file,false);assert.equal(replay.original_stored,true);
});
test('acknowledges the exact mode only after storing its command',()=>{
 for(const mode of ['/publicar ambos','/borrador opuro']){
  const v=resolvePackageSession(preparePackageIntent(text(mode)),{status:'OPEN',packageId:pkg});
  const r=confirmPackageOperation(v,{status:'STORED',packageId:pkg,itemId:item});
  assert.equal(r.source_stored,true);assert.match(r.reply_text,/Instrucción/);
  assert.doesNotMatch(confirmPackageOperation(v,{error:'timeout'}).reply_text,/registrada/);
 }
});
test('no storage success from timeout, wrong item or byte count; Base64 never reaches ack',()=>{
 const c={...file,packageId:pkg,itemId:item,bytes_received:100,contentBase64:'PRIVATE'};
 for(const r of [{error:'timeout'},{status:'STORED',packageId:pkg,itemId:item,bytes:99,sha256:'a'.repeat(64)},{status:'STORED_REPLAY',itemId:'ti_'+'c'.repeat(40)}]) {
  const out=confirmStoredOriginal(c,r);assert.equal(out.original_stored,false);assert.equal(out.contentBase64,undefined);
 }
 const ok=confirmStoredOriginal(c,{status:'STORED',packageId:pkg,itemId:item,bytes:100,sha256:'a'.repeat(64)});assert.equal(ok.original_stored,true);assert.match(ok.reply_text,/&lt;image&gt;/);assert.equal(ok.contentBase64,undefined);
});
test('pending or uncertain seal never claims delivery to Work',()=>{
 const c=resolvePackageSession(preparePackageIntent(text('/listo')),{status:'OPEN',packageId:pkg});
 for(const r of [{status:'NOT_READY',pending:1,stored:2},{error:'timeout'}])assert.equal(confirmPackageOperation(c,r).package_state,undefined);
 const uncertain=confirmPackageOperation(c,{error:'timeout'});assert.equal(uncertain.reply_text.includes('No se envió'),false);assert.ok(uncertain.reply_text.includes(pkg));
 const ready=confirmPackageOperation(c,{status:'READY',packageId:pkg,revision:4});assert.equal(ready.package_state,'READY');assert.match(ready.reply_text,/No se ha generado ni publicado/);
});
test('all embedded Code functions compile for n8n',()=>{
 for(const code of Object.values(packageIngressCode()))assert.doesNotThrow(()=>new Function('$input','$',code));
});
test('installed graph reserves a captured package before any download and saves before acknowledging',()=>{
 const ops=buildPackageIntakeOperations({guardCredential:{id:'observed-only',name:'Existing guard'}});
 const wire=(from,to)=>ops.some(x=>x.type==='addConnection'&&x.source===from&&x.target===to);
 assert.ok(wire('Operar paquete Telegram','Confirmar operación de paquete Telegram'));
 assert.ok(wire('Confirmar operación de paquete Telegram','¿Descargar archivo Telegram?'));
 assert.ok(wire('Comprobar bytes Telegram','¿Guardar bytes Telegram?'));
 assert.ok(wire('Guardar original Telegram','Confirmar original Telegram'));
 assert.ok(wire('Confirmar original Telegram','Confirmar recepción Telegram'));
 for(const op of ops.filter(x=>x.type==='addNode'&&x.node.type==='n8n-nodes-base.httpRequest'))assert.equal(op.node.credentials.httpHeaderAuth.id,'observed-only');
 assert.equal(ops.some(x=>x.type==='setWorkflowSettings'),false);
});

