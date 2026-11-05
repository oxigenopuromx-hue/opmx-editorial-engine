import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyFileMcp,parseMcpMaster,validateMcpImage,fileMcpResult} from './files-mcp-protocol.mjs';
import {imageType} from './prepare.mjs';
const call=(method,params)=>classifyFileMcp({body:{jsonrpc:'2.0',id:1,method,params}});
const file={download_url:'https://files.oaiusercontent.com/test.jpg?sig=test',file_id:'file_test',mime_type:'image/jpeg'};
const args={master_file:file,hero:file,destacada:file,destino:'AMBOS',request_id:'opmx-fixture-123456'};
test('base draft builder cannot expose publication tools before their graph is installed',()=>{
 const r=classifyFileMcp({jsonrpc:'2.0',id:1,method:'tools/list'},{publicationEnabled:false});assert.deepEqual(r.response.result.tools.map(t=>t.name),['validar_archivos_opmx','preparar_borrador_opmx']);
 assert.equal(classifyFileMcp({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'publicar_nota_opmx',arguments:args}},{publicationEnabled:false}).response.error.code,-32601);
});
test('native file IDs are opaque strings, never filesystem paths or authorization',()=>{
 const native={...file,file_id:'native:opaque/reference?revision=1'};
 const r=call('tools/call',{name:'validar_archivos_opmx',arguments:{...args,master_file:native}});
 assert.equal(r.route,'files');
 const bad=call('tools/call',{name:'validar_archivos_opmx',arguments:{...args,master_file:{...native,file_id:''}}});
 assert.equal(bad.response.result.isError,true);
 assert.doesNotMatch(JSON.stringify(bad),/sig=test|native:opaque/);
});
test('native file binding declares every file property and only transport fields required',()=>{
 const tools=call('tools/list').response.result.tools;assert.equal(tools.length,4);
 for(const t of tools){for(const key of t._meta?.['openai/fileParams']??[]){const s=t.inputSchema.properties[key];assert.deepEqual(Object.keys(s.properties),['download_url','file_id','mime_type','file_name']);assert.deepEqual(s.required,['download_url','file_id']);}}
});
test('both destinations need all three file refs; OPOL needs only MASTER and featured',()=>{
 assert.equal(call('tools/call',{name:'preparar_borrador_opmx',arguments:args}).route,'files');
 assert.equal(call('tools/call',{name:'preparar_borrador_opmx',arguments:{...args,hero:undefined}}).response.result.isError,true);
 assert.equal(call('tools/call',{name:'preparar_borrador_opmx',arguments:{...args,destino:'OPOL',hero:undefined}}).route,'files');
});
test('reject untrusted origins and URL credential tricks before any download dispatch',()=>{
 for(const url of ['http://files.oaiusercontent.com/a','https://127.0.0.1/a','https://files.oaiusercontent.com.evil.test/a','https://files.oaiusercontent.com@evil.test/a','https://files.oaiusercontent.com:443/a','https://files.oaiusercontent.com/a#x','https://files.oaiusercontent.com/a\nX']){
  const r=call('tools/call',{name:'validar_archivos_opmx',arguments:{...args,master_file:{...file,download_url:url}}});assert.equal(r.route,undefined,url);assert.equal(r.response.error.code,-32602);
 }
});
test('write needs stable identity and approved MASTER',()=>{
 assert.equal(call('tools/call',{name:'preparar_borrador_opmx',arguments:{...args,request_id:undefined}}).response.error.code,-32602);
 const req={operation:'preparar_borrador_opmx'};
 assert.throws(()=>parseMcpMaster(Buffer.from(JSON.stringify({SEO:{SLUG:'example'}})),req),/aprobado/);
 assert.equal(parseMcpMaster(Buffer.from('\uFEFF'+JSON.stringify({SEO:{SLUG:'example'},CONTROL_EDITORIAL:{ESTADO:'LISTO'}})),req).master.SEO.SLUG,'example');
});
test('image signature and limits reject masquerading files',()=>{
 const jpg=Buffer.from([255,216,255,0]);assert.equal(imageType(jpg),'image/jpeg');
 assert.throws(()=>imageType(Buffer.from('<html>error</html>')),/Formato/);
 assert.throws(()=>validateMcpImage(jpg,{mime_type:'image/png'},imageType(jpg)),/inconsistente/);
 assert.throws(()=>validateMcpImage(Buffer.alloc(10*1024*1024+1),{},'image/jpeg'),/grande/);
 assert.equal(validateMcpImage(jpg,file,imageType(jpg)).base64,jpg.toString('base64'));
});
test('partial result preserves verified links and prevents a false successful tool result',()=>{
 const partial={status:'PARTIAL_SUCCESS',edit_url_opuro:'https://cms.oxigenopuro.com.mx/wp-admin/post.php?post=1&action=edit',retryPermitted:false};
 const r=fileMcpResult({id:'abc'},partial,true).response;assert.equal(r.id,'abc');assert.equal(r.result.isError,true);assert.deepEqual(r.result.structuredContent,partial);
});

