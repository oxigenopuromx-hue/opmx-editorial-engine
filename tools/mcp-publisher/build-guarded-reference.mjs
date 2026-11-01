// Build an INACTIVE OPURO-only reference; it contains write nodes and MUST NOT
// be imported/activated until reviewed and tested against isolated services.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='workflows/publisher/';
const pre=JSON.parse(readFileSync(root+'OPMX_PREFLIGHT_AISLADO_ID_ESTABLE_REFERENCIA_NO_ACTIVAR.json'));
const src=JSON.parse(readFileSync(root+'OPMX_PUBLISHER_MCP_REFERENCIA_SANITIZADA_NO_ACTIVAR.json'));
const preNames=['Entrada de prueba protegida','Preparar MASTER y binarios','Validar y normalizar OPMX MASTER','OPURO — Consultar slug existente','OPURO — Resultado consulta duplicados','OPMX — Generar huella de prueba','OPMX — Reservar preflight','OPMX — Verificar reserva'];
const wpNames=['OPURO — Subir HERO','OPURO — Metadata HERO','OPURO — Subir DESTACADA','OPURO — Metadata DESTACADA','OPURO — Buscar categoría','OPURO — Resolver categoría','OPURO — Preparar etiquetas v1.13','OPURO — Etiquetas secuenciales v1.2.4','OPURO — Asegurar etiqueta v1.13','OPURO — Resolver etiqueta v1.13','OPURO — ¿Retry 503 etiqueta? v1.2.4','OPURO — Esperar retry etiqueta v1.2.4','OPURO — Retry etiqueta v1.2.4','OPURO — Consolidar etiquetas v1.13','OPURO — Crear borrador Gutenberg enriquecido','OPURO — Escribir Rank Math','OPURO — Readback','OPURO — Validar antes de publicar','Resultado OPURO — BORRADOR'];
function pick(w,names) {return names.map(name=>{let n=w.nodes.find(x=>x.name===name);if(!n)throw Error('Falta '+name);return structuredClone(n);});}
const nodes=[...pick(pre,preNames),...pick(src,wpNames)];
// Keep the latest editorial validator from the Publisher reference, while
// retaining the request-id preflight and duplicate checks from preflight.
nodes[nodes.findIndex(n=>n.name==='Validar y normalizar OPMX MASTER')]=pick(src,['Validar y normalizar OPMX MASTER'])[0];
const tplHttp=pre.nodes.find(n=>n.name==='OPMX — Reservar preflight');
const tplCode=pre.nodes.find(n=>n.name==='OPMX — Verificar reserva');
const input="requestId:$('Preparar MASTER y binarios').first().json.request_id,slug:$('Validar y normalizar OPMX MASTER').first().json.canonical.slug,destination:'OPURO'";
function id(name){return createHash('sha256').update(name).digest('hex').slice(0,32).replace(/^(........)(....)(....)(....)/,'$1-$2-$3-$4-');}
function request(name,path,body) {let n=structuredClone(tplHttp);n.id=id(name);n.name=name;n.parameters.url='https://publisher.oxigenopuro.com.mx/v1/'+path;n.parameters.jsonBody='={{ {'+body+'} }}';delete n.credentials;return n;}
function verify(name,expected) {let n=structuredClone(tplCode);n.id=id(name);n.name=name;n.parameters.jsCode=`if ($json.status !== '${expected}') throw new Error('Guard no confirmó ${expected}; conciliación manual.'); return [{json:{status:'${expected}'}}];`;return n;}
function restore(name) {let n=structuredClone(tplCode);n.id=id(name);n.name=name;n.parameters.jsCode="return [{json:{},binary:$('Validar y normalizar OPMX MASTER').first().binary}];";return n;}
const added=[
 request('GUARD — Iniciar destino','targets/begin',input),verify('GUARD — Verificar destino','write_started'),
 request('GUARD — Iniciar Hero','media/begin',input+",role:'hero'"),verify('GUARD — Verificar inicio Hero','upload_started'),restore('OPMX — Recuperar binario Hero'),
 request('GUARD — Reportar Hero','media/report',input+",role:'hero',mediaId:Number($('OPURO — Subir HERO').first().json.id)"),verify('GUARD — Verificar reporte Hero','media_reported'),
 request('GUARD — Iniciar destacada','media/begin',input+",role:'featured'"),verify('GUARD — Verificar inicio destacada','upload_started'),restore('OPMX — Recuperar binario destacada'),
 request('GUARD — Reportar destacada','media/report',input+",role:'featured',mediaId:Number($('OPURO — Subir DESTACADA').first().json.id)"),verify('GUARD — Verificar reporte destacada','media_reported'),
 request('GUARD — Reportar post','targets/report',input+",postId:Number($('OPURO — Crear borrador Gutenberg enriquecido').first().json.id)"),verify('GUARD — Verificar reporte post','post_reported')
];
nodes.push(...added);
for(const n of nodes){delete n.credentials; delete n.webhookId;}
const output=nodes.find(n=>n.name==='Resultado OPURO — BORRADOR');
output.parameters.jsCode="const p=$('OPURO — Readback').first().json; return {json:{status:'DRAFT',target:'oxigenopuro',request_id:$('Preparar MASTER y binarios').first().json.request_id,post_id:p.id,slug:p.slug,edit_url:'https://cms.oxigenopuro.com.mx/wp-admin/post.php?post='+p.id+'&action=edit',warnings:['Los medios deben verificarse por separado.']}};";
const edges={};function link(a,b){edges[a]={main:[[{node:b,type:'main',index:0}]]};}
for(let i=0;i<preNames.length-1;i++)link(preNames[i],preNames[i+1]);
const chain=['OPMX — Verificar reserva','GUARD — Iniciar destino','GUARD — Verificar destino','GUARD — Iniciar Hero','GUARD — Verificar inicio Hero','OPMX — Recuperar binario Hero','OPURO — Subir HERO','GUARD — Reportar Hero','GUARD — Verificar reporte Hero','OPURO — Metadata HERO','GUARD — Iniciar destacada','GUARD — Verificar inicio destacada','OPMX — Recuperar binario destacada','OPURO — Subir DESTACADA','GUARD — Reportar destacada','GUARD — Verificar reporte destacada','OPURO — Metadata DESTACADA','OPURO — Buscar categoría','OPURO — Resolver categoría','OPURO — Preparar etiquetas v1.13','OPURO — Etiquetas secuenciales v1.2.4'];
for(let i=0;i<chain.length-1;i++)link(chain[i],chain[i+1]);
for(const name of ['OPURO — Etiquetas secuenciales v1.2.4','OPURO — Asegurar etiqueta v1.13','OPURO — Resolver etiqueta v1.13','OPURO — ¿Retry 503 etiqueta? v1.2.4','OPURO — Esperar retry etiqueta v1.2.4','OPURO — Retry etiqueta v1.2.4','OPURO — Consolidar etiquetas v1.13'])edges[name]=structuredClone(src.connections[name]);
const tail=['OPURO — Crear borrador Gutenberg enriquecido','GUARD — Reportar post','GUARD — Verificar reporte post','OPURO — Escribir Rank Math','OPURO — Readback','OPURO — Validar antes de publicar','Resultado OPURO — BORRADOR'];
for(let i=0;i<tail.length-1;i++)link(tail[i],tail[i+1]);
const result={name:'OPMX — REFERENCIA GUARDED OPURO — NO ACTIVAR',nodes,connections:edges,active:false,settings:{executionOrder:'v1'},tags:[]};
const outputPath=root+'OPMX_BORRADOR_GUARDADO_OPURO_REFERENCIA_NO_ACTIVAR.json';
const generated=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--check')) {
  if(readFileSync(outputPath,'utf8')!==generated) throw new Error('La referencia guardada no coincide con el generador');
} else writeFileSync(outputPath,generated);
