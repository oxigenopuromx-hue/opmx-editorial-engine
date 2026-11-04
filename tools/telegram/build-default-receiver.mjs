import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ORDER_PREFIX, POLICY, attestedControl } from './default-publication-policy.mjs';
import { DEFAULT_HELP, openingNotice, prepareOpeningRecord, prepareSeal } from './default-receiver.mjs';

const root = new URL('../../', import.meta.url);
const before = JSON.parse(fs.readFileSync(new URL('workflows/telegram/OPMX_TELEGRAM_BEFORE_DEFAULT_20261104_REFERENCE.json',root),'utf8'));
const after = structuredClone(before);
const prelude = `const ORDER_PREFIX=${JSON.stringify(ORDER_PREFIX)};\nconst POLICY=${JSON.stringify(POLICY)};\n${attestedControl.toString()}\n`;
function replaceOnce(code, from, to) {
  if (!code.includes(from) || code.indexOf(from)!==code.lastIndexOf(from)) throw Error('Baseline code changed: '+from.slice(0,70));
  return code.replace(from,to);
}
const updates = [];
function update(name, change) {
  const n=after.nodes.find(n=>n.name===name);
  n.parameters.jsCode=change(n.parameters.jsCode);
  updates.push({type:'updateNodeParameters',nodeName:name,parameters:{jsCode:n.parameters.jsCode}});
}
function help(code) { return code.replace(/^const help=.*;$/m, 'const help='+JSON.stringify(DEFAULT_HELP)+';'); }

update('Normalizar entrada Telegram', code => {
  const from='/^(?:\\/(?:publicar|borrador)';
  if(code.split(from).length!==3)throw Error('Unexpected normalizer command boundaries');
  return code.split(from).join('/^(?:\\/(?:publicar|borrador|nuevo|listo)');
});
update('Preparar paquete Telegram', help);
update('Resolver paquete Telegram', code => {
  code=help(code);
  code=replaceOnce(code,
    "return response(intent,closed?'Este comando ya corresponde a un paquete cerrado. Envía /nuevo para otra nota.':`Paquete ${result.status==='ALREADY_OPEN'?'ya abierto':'abierto'}: <code>${result.packageId}</code>. Envía texto, fotos y documentos; al terminar usa /listo.`,{packageId:result.packageId,package_state:closed?'READY':'OPEN'});",
    "const notice=openingNotice(result,intent.message_id);\n  return response(intent,notice.reply,{packageId:result.packageId,package_state:closed?'READY':'OPEN',default_policy_candidate:notice.newPolicy});");
  code=replaceOnce(code,"if(x.package_operation==='SEAL')action='seal';",
    "if(x.package_operation==='SEAL'){action='reserve';Object.assign(body,{receiptId:x.receipt_id,kind:'TEXT',text:attestedControl('/listo',x.packageId,x.message_id),attachment:null});}");
  code=replaceOnce(code,
    "text:x.mode_attested===true?'OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\\n'+x.text.trim():x.text??''",
    "text:x.mode_attested===true?(/^\\/(?:publicar|borrador)(?:\\s+(?:ambos|opuro|opol))?$/i.test(x.text.trim())?attestedControl(x.text.trim(),x.packageId,x.message_id):ORDER_PREFIX+x.text.trim()):x.text??''");
  code=replaceOnce(code,'return {...x,next_action:action,next_body:body};',"return {...x,next_action:action,next_body:body,seal_after_close:x.package_operation==='SEAL'};");
  return prelude+openingNotice.toString()+'\n'+code;
});
update('Confirmar operación de paquete Telegram', code => help(code));

const httpTemplate = after.nodes.find(n=>n.name==='Operar paquete Telegram');
const codeNode=(name,jsCode,position)=>({name,type:'n8n-nodes-base.code',typeVersion:2,position,parameters:{jsCode}});
const newNodes=[
  codeNode('Preparar sellado con cierre acreditado',prepareSeal.toString()+"\nreturn [{json:prepareSeal($('Resolver paquete Telegram').first(0,0).json,$input.first().json)}];",[360,800]),
  {name:'¿Cierre acreditado guardado?',type:'n8n-nodes-base.if',typeVersion:2.2,position:[580,800],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:'={{ $json.seal_requested }}',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}},
  {...structuredClone(httpTemplate),name:'Sellar paquete con cierre acreditado',position:[800,740],parameters:{...structuredClone(httpTemplate.parameters),url:'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/seal',jsonBody:'={{ JSON.stringify($json.seal_body) }}'},retryOnFail:false,onError:'continueRegularOutput'},
  codeNode('Conservar operación sin sellado',"return [{json:$input.first().json.passthrough}];",[800,920]),
  codeNode('Preparar política tras aviso confirmado',prelude+prepareOpeningRecord.toString()+"\nlet ctx;try{ctx=$('Resolver paquete Telegram').first(0,0).json;}catch{return [];}\nconst body=prepareOpeningRecord(ctx,$input.first().json,attestedControl);\nreturn body?[{json:{body}}]:[];",[600,1240]),
  {...structuredClone(httpTemplate),name:'Guardar apertura con política anunciada',position:[820,1240],parameters:{...structuredClone(httpTemplate.parameters),url:'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/reserve',jsonBody:'={{ JSON.stringify($json.body) }}'},retryOnFail:false,onError:'continueRegularOutput'},
  codeNode('Verificar política de apertura guardada',"const r=$input.first().json; const ctx=$('Resolver paquete Telegram').first(0,0).json;\nconst stored=r?.status==='STORED'&&r.packageId===ctx.packageId;\nconst replay=r?.status==='RESERVATION_REPLAY'&&r.state==='STORED';\nif((!stored&&!replay)||!/^ti_[a-f0-9]{40}$/.test(r?.itemId??''))throw Error('DEFAULT_PUBLICATION_POLICY_NOT_STORED');\nreturn [{json:{status:'DEFAULT_POLICY_RECORDED',policy:'publish-ambos-v1',package_id:ctx.packageId}}];",[1040,1240]),
];
// Deterministic IDs for exported references; live updates allocate these nodes.
newNodes.forEach((n,i)=>{n.id='default-policy-node-'+(i+1);delete n.webhookId;});
after.nodes.push(...newNodes);
const edge=(node,index=0)=>({node,type:'main',index});
const connections=[
  ['Operar paquete Telegram','Preparar sellado con cierre acreditado'],
  ['Preparar sellado con cierre acreditado','¿Cierre acreditado guardado?'],
  ['¿Cierre acreditado guardado?','Sellar paquete con cierre acreditado',0],
  ['¿Cierre acreditado guardado?','Conservar operación sin sellado',1],
  ['Sellar paquete con cierre acreditado','Confirmar operación de paquete Telegram'],
  ['Conservar operación sin sellado','Confirmar operación de paquete Telegram'],
  ['Confirmar recepción Telegram','Preparar política tras aviso confirmado'],
  ['Preparar política tras aviso confirmado','Guardar apertura con política anunciada'],
  ['Guardar apertura con política anunciada','Verificar política de apertura guardada'],
];
after.connections['Operar paquete Telegram']={main:[]};
for(const [source,target,sourceIndex=0] of connections){after.connections[source]??={main:[]};after.connections[source].main[sourceIndex]??=[];after.connections[source].main[sourceIndex].push(edge(target));}
after.name='OPMX — Telegram recepción · publicación predeterminada v1';
after.active=false;
const operations=[...updates,...newNodes.map(node=>({type:'addNode',node})),...newNodes.filter(n=>n.type==='n8n-nodes-base.httpRequest').map(n=>({type:'setNodeSettings',nodeName:n.name,settings:{retryOnFail:false,onError:'continueRegularOutput'}})),{type:'removeConnection',source:'Operar paquete Telegram',target:'Confirmar operación de paquete Telegram'},...connections.map(([source,target,sourceIndex=0])=>({type:'addConnection',source,target,sourceIndex})),{type:'setWorkflowMetadata',name:after.name,description:'Recepción privada y fuentes verificadas. Nuevos paquetes: publicar AMBOS tras aviso confirmado y cierre /listo acreditado; /borrador es excepción explícita. No cambia paquetes READY existentes.'}];
export {operations,after};
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  fs.writeFileSync(new URL('workflows/telegram/OPMX_TELEGRAM_DEFAULT_PUBLICATION_v1_REFERENCE.json',root),JSON.stringify(after,null,2)+'\n');
  console.log('Generated default-publication receiver reference; active=false; user IDs and credential IDs omitted.');
}
