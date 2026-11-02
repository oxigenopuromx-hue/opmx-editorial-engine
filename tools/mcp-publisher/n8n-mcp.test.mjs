import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createN8nMcpBackend} from './n8n-mcp.mjs';
import {openRequestLedger} from './idempotency.mjs';
import {startDraft,queryDraft} from './async-jobs.mjs';

test('inicia una vez y recupera el resultado del workflow especificado',async()=>{
 let calls=[];const workflowId='workflow-test';const result={status:'SUCCESS',mode:'DRAFT',summary:{opuro:'DRAFT',opol:'DRAFT'}};
 const client={callTool:async x=>{calls.push(x);return x.name==='start'?{structuredContent:{status:'started',executionId:'123'}}:{structuredContent:{execution:{id:'123',workflowId,status:'success'},data:{resultData:{runData:{'Resultado consolidado OPMX':[{data:{main:[[{json:result}]]}}]}}}}}}};
 const backend=createN8nMcpBackend({client,workflowId,startTool:'start',executionTool:'read'});const ledger=openRequestLedger(':memory:');
 const input={master:{SEO:{SLUG:'nota-de-prueba'}},destino:'AMBOS',hero:{file_id:'h'},destacada:{file_id:'d'}};
 const opts={ledger,requestId:'1234567890123456',input,prepare:async()=>({PUBLICAR:false,CREAR_EN:'AMBOS'}),start:backend.start};
 assert.equal((await startDraft(opts)).status,'pending');
 assert.equal((await queryDraft({ledger,requestId:opts.requestId,read:backend.read})).status,'complete');
 assert.equal((await startDraft(opts)).replay,true);assert.equal(calls.filter(x=>x.name==='start').length,1);
 assert.equal(calls[0].arguments.inputs.webhookData.body.PUBLICAR,false);ledger.close();
});
test('no acepta ejecución de otro workflow ni publicación',async()=>{
 const client={callTool:async()=>({structuredContent:{execution:{id:'1',workflowId:'otro',status:'success'}}})};
 const backend=createN8nMcpBackend({client,workflowId:'correcto',startTool:'start',executionTool:'read'});
 await assert.rejects(backend.start({PUBLICAR:true,CREAR_EN:'OPURO'}),/borradores/);
 await assert.rejects(backend.read('1'),/no coincide/);
});
