import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const w=JSON.parse(readFileSync('workflows/publisher/OPMX_ENTRADA_AUTOMATICA_OPURO_v1.json'));
const byName=Object.fromEntries(w.nodes.map(n=>[n.name,n]));
function reachable(start,blocked=[]){const seen=new Set(),queue=[start];while(queue.length){const n=queue.shift();if(seen.has(n)||blocked.includes(n))continue;seen.add(n);for(const outputs of Object.values(w.connections[n]??{}))for(const edges of outputs??[])for(const e of edges??[])queue.push(e.node);}return seen;}
test('entrada automática usa autenticación y sólo contiene borradores protegidos por guard',()=>{
 execFileSync(process.execPath,['tools/mcp-publisher/build-automatic-draft.mjs','--check']);
 const t=byName['Entrada automática protegida'];assert.equal(t.parameters.authentication,'n8nOAuth2');assert.equal(t.parameters.requireExecuteAccess,true);
 assert.equal(w.active,false);assert.ok(w.nodes.every(n=>!n.credentials&&!n.webhookId));
 for(const n of w.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest'))assert.doesNotMatch(String(n.parameters.jsonBody??''),/status\s*:\s*['"]publish['"]/);
 const writes=['OPURO — Subir HERO','OPURO — Subir DESTACADA','OPURO — Crear borrador Gutenberg enriquecido'];
 for(const gate of ['OPMX — Verificar reserva','GUARD — Verificar destino'])for(const name of writes)assert.equal(reachable(t.name,[gate]).has(name),false);
 for(const name of writes)assert.notEqual(byName[name].retryOnFail,true);
 assert.equal(reachable('OPMX — Preparar conciliación').has('OPURO — Crear borrador Gutenberg enriquecido'),false);
 for(const name of ['OPURO — Subir HERO','OPURO — Subir DESTACADA'])assert.match(byName[name].parameters.headerParameters.parameters.find(h=>h.name==='Content-Type').value,/^=\{\{ /);
});
test('publicación o identidad inválida se rechazan antes de preparar archivos',async()=>{
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const run=new AsyncFunction('$json',byName['Preparar MASTER y binarios'].parameters.jsCode);
 let touched=0;const context={helpers:{prepareBinaryData:async()=>{touched++;return {};}}};
 for(const body of [{request_id:'opmx_qa_1234567890',master:{},CREAR_EN:'OPURO',PUBLICAR:true},{request_id:'short',master:{},CREAR_EN:'OPURO',PUBLICAR:false}])await assert.rejects(run.call(context,{body}));
 assert.equal(touched,0);
});
test('el consolidado confirma DRAFT y rechaza conciliaciones como éxito',()=>{
 const run=Function('$input',byName['Resultado consolidado OPMX'].parameters.jsCode);
 const input=json=>({first:()=>({json})});
 const out=run(input({status:'DRAFT',post_id:9681,request_id:'qa_request_1234567',slug:'qa',edit_url:'https://example.test/edit'}))[0].json;
 assert.equal(out.mode,'DRAFT');assert.equal(out.summary.opuro,'DRAFT');assert.equal(out.post_id_opuro,9681);
 assert.throws(()=>run(input({action:'manual_reconciliation',retryPermitted:false})),/no confirmado/);
});
