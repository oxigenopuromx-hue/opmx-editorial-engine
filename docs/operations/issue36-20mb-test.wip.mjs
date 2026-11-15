import assert from 'node:assert/strict';
import {normalizeTelegramUpdate,validateTelegramDownload} from './source/tools/telegram/guard-recovery-candidate/intake.mjs';
import {PACKAGE_LIMITS} from './source/tools/telegram/guard-recovery-candidate/package-store.mjs';
import {createGuard} from './source/tools/mcp-publisher/guard-server.mjs';
const max=20000000;
const update=n=>({update_id:1,message:{chat:{type:'private',id:123},from:{id:123},message_id:1,document:{file_id:'f',file_name:'x.pdf',mime_type:'application/pdf',file_size:n}}});
const cfg={allowedUserIds:['123'],allowedChatIds:['123'],maxBytes:max};
for(const n of [10485760,10485761,max-1,max])assert.equal(normalizeTelegramUpdate(update(n),cfg).kind,'FILE');
assert.equal(normalizeTelegramUpdate(update(max+1),cfg).kind,'REJECTED');
assert.equal(PACKAGE_LIMITS.fileBytes,max);assert.ok(PACKAGE_LIMITS.packageBytes>max+10485760);
const b=Buffer.alloc(max,0x20);b.write('%PDF-');const incoming=normalizeTelegramUpdate(update(max),cfg);assert.equal(validateTelegramDownload(incoming,b).bytes_received,max);
assert.throws(()=>validateTelegramDownload(incoming,Buffer.alloc(max+1)),/Tamaño/);
const secret='a'.repeat(64);let received=0;const server=createGuard({pool:{getConnection(){}},secret,telegramStore:{run:async(action,input)=>{received=Buffer.from(input.contentBase64,'base64').length;return {status:'TEST',action}}}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{const url=`http://127.0.0.1:${server.address().port}/v1/telegram/packages/complete`;let r=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify({contentBase64:b.toString('base64')})});assert.equal(r.status,200);assert.equal(received,max);r=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify({contentBase64:'x'.repeat(4*Math.ceil(max/3)+65536)})});assert.equal(r.status,413);console.log('Límites 10 MB y 20 MB, rechazo de exceso, PDF y transporte JSON probados');}finally{server.close();}
