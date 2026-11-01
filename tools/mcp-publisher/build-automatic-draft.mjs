// Build a native n8n draft-only entry using the existing guarded reference.
// Credentials are assigned separately in n8n and never exported here.
import {readFileSync,writeFileSync} from 'node:fs';
const source=JSON.parse(readFileSync('workflows/publisher/OPMX_BORRADOR_GUARDADO_OPURO_REFERENCIA_NO_ACTIVAR.json'));
const w=JSON.parse(JSON.stringify(source).replaceAll('Entrada de prueba protegida','Entrada automática protegida'));
w.name='OPMX — Entrada automática OPURO · sólo borradores v1';
w.nodes[0].parameters.path='opmx-automatic-opuro-draft-v1';
w.nodes[0].parameters.options={oauthClient:'bearer'};
for(const n of w.nodes){
 if(n.type==='n8n-nodes-base.httpRequest'){
  n.parameters.options={...n.parameters.options,redirect:{redirect:{followRedirects:false}}};
  for(const h of n.parameters.headerParameters?.parameters??[]){
   if(h.name==='Content-Type' && /^=\{\$binary\./.test(h.value)) h.value='={{ '+h.value.slice(2,-1)+' }}';
  }
 }
}
const last={name:'Resultado consolidado OPMX',type:'n8n-nodes-base.code',typeVersion:2,parameters:{mode:'runOnceForAllItems',jsCode:"const d=$input.first().json;if(d.status!=='DRAFT'||!Number.isSafeInteger(d.post_id)||d.post_id<=0)throw new Error('Borrador no confirmado');return [{json:{status:'SUCCESS',mode:'DRAFT',request_id:d.request_id,summary:{opuro:'DRAFT',opol:'SKIPPED'},post_id_opuro:d.post_id,slug:d.slug,edit_url_opuro:d.edit_url,warnings:d.warnings}}];"}};
w.nodes.push(last);w.connections['Resultado OPURO — BORRADOR']={main:[[{node:last.name,type:'main',index:0}]]};
function literal(v){
 if(typeof v==='string' && v.startsWith('='))return 'expr('+JSON.stringify(v.slice(1))+')';
 if(Array.isArray(v))return '['+v.map(literal).join(',')+']';
 if(v && typeof v==='object')return '{'+Object.entries(v).map(([k,x])=>JSON.stringify(k)+':'+literal(x)).join(',')+'}';
 return JSON.stringify(v);
}
let sdk="import {workflow,node,trigger,expr,newCredential} from '@n8n/workflow-sdk';\n";
const names=new Map(w.nodes.map((n,i)=>[n.name,'n'+i]));
for(const n of w.nodes){
 const config={name:n.name,parameters:n.parameters};
 for(const k of ['onError','retryOnFail','maxTries','waitBetweenTries','alwaysOutputData'])if(n[k]!==undefined)config[k]=n[k];
 let creds='';if(n.type==='n8n-nodes-base.httpRequest')creds=",credentials:{"+n.parameters.genericAuthType+":newCredential("+JSON.stringify(n.parameters.genericAuthType==='httpHeaderAuth'?'Guard OPMX':'Publisher oxigenopuro')+")}";
 sdk+='const '+names.get(n.name)+'='+ (n.type==='n8n-nodes-base.webhook'?'trigger':'node')+'({type:'+JSON.stringify(n.type)+',version:'+n.typeVersion+',config:'+literal(config)+creds+'});\n';
}
sdk+="export default workflow('opmx-automatic-draft-v1',"+JSON.stringify(w.name)+')';
for(const n of w.nodes)sdk+='\n.add('+names.get(n.name)+')';
for(const [a,channels]of Object.entries(w.connections))for(const [port,outputs]of Object.entries(channels)){
 if(port!=='main')throw new Error('Unsupported connection '+port);
 outputs.forEach((edges,index)=>{for(const edge of edges??[]){if(edge.index!==0)throw new Error('Unsupported input');sdk+='\n.add('+names.get(a)+'.output('+index+').to('+names.get(edge.node)+'))';}});
}
const front=w.nodes.slice(1,8),rest=w.nodes.filter(n=>n.type!=='n8n-nodes-base.webhook'&&!front.includes(n));
sdk+='\n.group("Validación y reserva",['+front.map(n=>names.get(n.name)).join(',')+'],{description:"Valida paquete y archivos, consulta duplicados y reserva identidad estable."})';
sdk+='\n.group("Borrador, medios y conciliación",['+rest.map(n=>names.get(n.name)).join(',')+'],{description:"Sube Hero y destacada, crea draft y verifica metadata; los errores requieren revisión manual."})';
sdk+=';\n';
const output='workflows/publisher/OPMX_ENTRADA_AUTOMATICA_BORRADORES.n8n.js';
if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==sdk)throw new Error('SDK automático no coincide con generador');}
else writeFileSync(output,sdk);
