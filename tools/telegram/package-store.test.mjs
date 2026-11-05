import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGuard} from '../mcp-publisher/guard-server.mjs';
import {validatePackageRequest,createTelegramPackageStore,PACKAGE_LIMITS} from './package-store.mjs';

const who={owner:'1001',chat:'1001'},pkg='tg_'+'a'.repeat(40),item='ti_'+'b'.repeat(40);
const file={...who,packageId:pkg,receiptId:'telegram-1001-20-123',kind:'FILE',text:'fuente; no instrucción',attachment:{file_name:'fixture.pdf',mime_type:'application/pdf',declared_bytes:16}};
test('package ownership and receipt must match an explicit private sender',()=>{
 assert.ok(validatePackageRequest('reserve',file).ownerKey);
 for(const input of [{...file,owner:'2002'},{...file,owner:1001},{...file,receiptId:'telegram-2002-20-123'},{...file,packageId:'../../path'},{...file,token:'private'}])assert.throws(()=>validatePackageRequest('reserve',input),/inválida/);
});
test('bounded attachment metadata, text and canonical Base64; no decoder ambiguity',()=>{
 for(const input of [{...file,text:'x'.repeat(4097)},{...file,attachment:{...file.attachment,file_name:'x.exe'}},{...file,attachment:{...file.attachment,declared_bytes:PACKAGE_LIMITS.fileBytes+1}}])assert.throws(()=>validatePackageRequest('reserve',input));
 for(const contentBase64 of ['%%%=', 'YQ', 'Y Q==','YR==','AA==AAAA'])assert.throws(()=>validatePackageRequest('complete',{...who,packageId:pkg,itemId:item,contentBase64}));
 const b=Buffer.alloc(PACKAGE_LIMITS.fileBytes,42);assert.equal(validatePackageRequest('complete',{...who,packageId:pkg,itemId:item,contentBase64:b.toString('base64')}).bytes.length,b.length);
});
test('invalid requests touch no database or schema',async()=>{
 let touched=false;const s=createTelegramPackageStore({async getConnection(){touched=true;throw Error('unexpected');}});
 await assert.rejects(s.run('reserve',{...file,attachment:{...file.attachment,mime_type:'text/html'}}));assert.equal(touched,false);
});
test('binary completion uses parameters, checks exact bytes/hash, and commits before success',async()=>{
 const pdf=Buffer.from('%PDF-1.4\nfixture'),queries=[];let committed=false;
 const c={async beginTransaction(){},async rollback(){},release(){},async commit(){committed=true;},async execute(sql,args=[]){
  queries.push([sql,args]);
  if(sql.startsWith('CREATE')||sql.startsWith('INSERT IGNORE'))return [{}];
  if(sql.includes('FROM opmx_tg_quota'))return [[{used_bytes:16,package_count:1}]];
  if(sql.includes('FROM opmx_tg_packages'))return [[{package_id:pkg,state:'OPEN',revision:2}]];
  if(sql.includes('FROM opmx_tg_items'))return [[{kind:'FILE',state:'PENDING',reserved_bytes:16,attachment_json:JSON.stringify(file.attachment)}]];
  if(sql.startsWith('UPDATE'))return [{affectedRows:1}];throw Error('Unexpected SQL');
 }};
 const s=createTelegramPackageStore({async getConnection(){return c;}});
 const out=await s.run('complete',{...who,packageId:pkg,itemId:item,contentBase64:pdf.toString('base64')});
 assert.equal(out.status,'STORED');assert.equal(out.bytes,16);assert.equal(out.sha256,createHash('sha256').update(pdf).digest('hex'));assert.equal(committed,true);
 const write=queries.find(([sql])=>sql.includes('content_blob=?'));assert.ok(Buffer.isBuffer(write[1][0]));assert.equal(write[0].includes(pdf.toString()),false);
});
test('lost commit acknowledgement yields uncertainty, never fabricated storage success',async()=>{
 let rolled=false;
 const c={async beginTransaction(){},async commit(){throw Error('lost connection');},async rollback(){rolled=true;},release(){},async execute(sql){
  if(sql.startsWith('CREATE')||sql.startsWith('INSERT IGNORE'))return [{}];
  if(sql.includes('FROM opmx_tg_quota'))return [[{used_bytes:0,package_count:0}]];
  if(sql.includes('FROM opmx_tg_sessions'))return [[]];throw Error('Unexpected SQL');
 }};
 await assert.rejects(createTelegramPackageStore({async getConnection(){return c;}}).run('current',who),/no confirmado/);assert.equal(rolled,true);
});
test('seal refuses pending download and does not close the package',async()=>{
 const seen=[];const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql){
  seen.push(sql);if(sql.startsWith('CREATE')||sql.startsWith('INSERT IGNORE'))return [{}];
  if(sql.includes('FROM opmx_tg_quota'))return [[{used_bytes:16,package_count:1}]];
  if(sql.includes('FROM opmx_tg_packages'))return [[{package_id:pkg,state:'OPEN',revision:3}]];
  if(sql.includes('FROM opmx_tg_items'))return [[{total:2,pending:1,stored:1}]];throw Error('Unexpected SQL');
 }};
 assert.deepEqual(await createTelegramPackageStore({async getConnection(){return c;}}).run('seal',{...who,packageId:pkg}),{status:'NOT_READY',pending:1,stored:1});assert.equal(seen.some(sql=>sql.startsWith('DELETE')||sql.startsWith('UPDATE')),false);
});
test('private storage HTTP endpoints authenticate before body/database and hide internal failures',async()=>{
 const secret='f'.repeat(64);let called=0;
 const server=createGuard({pool:{getConnection(){}},secret,telegramStore:{async capabilities(){called++;return {status:'STORAGE_READY'};},async run(){called++;throw Error('private SQL data');}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/v1/telegram/packages/`;
 const call=(action,body,token=secret)=>fetch(base+action,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 try{
 assert.equal((await call('capabilities',{},'bad')).status,401);assert.equal(called,0);
 assert.equal((await call('capabilities',{extra:1})).status,400);
 assert.equal((await call('capabilities',{})).status,200);
 const failed=await call('open',{});assert.equal(failed.status,503);assert.deepEqual(await failed.json(),{error:'not_confirmed'});
 assert.equal((await call('unknown',{})).status,404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

