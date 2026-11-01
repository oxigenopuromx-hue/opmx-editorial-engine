import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openRequestLedger} from './idempotency.mjs';
import {createMcpServer} from './server.mjs';

test('MCP local: exige autorización, recibe archivos y evita duplicados',async t=>{
 const ledger=openRequestLedger(':memory:');let submitted=0;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aN0AAAAASUVORK5CYII=','base64');
 const server=createMcpServer({ledger,authenticate:async token=>token==='ok'?'user-1':null,
   prepareOptions:{allowHosts:['files.example'],fetchImpl:async()=>new Response(png)},
   start:async data=>{submitted++;assert.equal(data.PUBLICAR,false);return {executionId:'42'}},
   read:async()=>({state:'success',result:{status:'SUCCESS',mode:'DRAFT',summary:{opuro:'DRAFT',opol:'DRAFT'}}})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.close();ledger.close()});
 const url=`http://127.0.0.1:${server.address().port}/mcp`;
 const call=(data,authorization='Bearer ok')=>fetch(url,{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify(data)});
 const request=(method,params)=>({jsonrpc:'2.0',id:1,method,params});
 assert.equal((await call(request('tools/list'),'Bearer wrong')).status,401);
 let result=await (await call(request('tools/list'))).json();
 assert.deepEqual(result.result.tools[0]._meta['openai/fileParams'],['hero','destacada']);
 const file={file_id:'file-test',download_url:'https://files.example/x',mime_type:'image/png'};
 const args={request_id:'request_1234567890',master:{titulo:'Prueba ñ',SEO:{SLUG:'nota-de-prueba'}},destino:'AMBOS',hero:file,destacada:file};
 const invoke=request('tools/call',{name:'preparar_borrador_opmx',arguments:args});
 result=await (await call(invoke)).json();assert.equal(result.result.structuredContent.status,'pending');
 result=await (await call(invoke)).json();assert.equal(result.result.structuredContent.replay,true);assert.equal(submitted,1);
 const check=request('tools/call',{name:'consultar_borrador_opmx',arguments:{request_id:args.request_id}});
 result=await (await call(check)).json();assert.equal(result.result.structuredContent.status,'complete');assert.equal(submitted,1);
 const missing=request('tools/call',{name:'consultar_borrador_opmx',arguments:{request_id:'not_found_request_01'}});
 result=await (await call(missing)).json();assert.equal(result.result.structuredContent.status,'not_found');
});
test('el servidor no admite configuración sin autenticación',()=>assert.throws(()=>createMcpServer({ledger:{},submit:()=>{}}),/autenticación/));
