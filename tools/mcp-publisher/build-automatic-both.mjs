// Extend the validated OPURO intake with sequential OPOL processing.
// Both selected destinations are reserved before the first remote write.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='workflows/publisher/';
const w=JSON.parse(readFileSync(root+'OPMX_ENTRADA_AUTOMATICA_OPURO_v1.json'));
const src=JSON.parse(readFileSync(root+'OPMX_PUBLISHER_MCP_REFERENCIA_SANITIZADA_NO_ACTIVAR.json'));
w.name='OPMX — Entrada automática OPURO + OPOL · borradores v2';
w.nodeGroups=[];
const byName=()=>Object.fromEntries(w.nodes.map(n=>[n.name,n]));
const get=name=>{const n=byName()[name];if(!n)throw Error('Falta '+name);return n;};
const uid=name=>createHash('sha256').update(name).digest('hex').slice(0,32);
function add(name,type,version,parameters,extra={}){const n={id:uid(name),name,type,typeVersion:version,position:[0,0],parameters,...extra};w.nodes.push(n);return n;}
const code=(name,jsCode)=>add(name,'n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode});
const http=(name,parameters)=>add(name,'n8n-nodes-base.httpRequest',4.2,{...parameters,authentication:'genericCredentialType',genericAuthType:'httpBasicAuth',options:{timeout:10000,redirect:{redirect:{followRedirects:false}}}});
const route=(name,flag)=>add(name,'n8n-nodes-base.if',2.2,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:"={{ $('Validar y normalizar OPMX MASTER').first().json.execution."+flag+" }}",rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}});
function link(a,b,index=0){w.connections[a]??={main:[]};w.connections[a].main[index]=[{node:b,type:'main',index:0}];}
function chain(names){for(let i=0;i<names.length-1;i++)link(names[i],names[i+1]);}
function skip(name,target){code(name,"return [{json:{status:'SKIPPED',target:'"+target+"'}}];");}
const validator=get('Validar y normalizar OPMX MASTER');
const old="const fileKey = binary.json_file ? 'json_file' : (binaryKeys.length === 1 ? binaryKeys[0] : null);";
const replacement="const jsonKeys=binaryKeys.filter(k=>/\\.json$/i.test(String(binary[k]?.fileName??'')) || binary[k]?.fileExtension==='json' || binary[k]?.mimeType==='application/json');\nconst fileKey = binary.json_file ? 'json_file' : (jsonKeys.length===1 ? jsonKeys[0] : null);";
if(validator.parameters.jsCode.includes(old))validator.parameters.jsCode=validator.parameters.jsCode.replace(old,replacement);
else if(!validator.parameters.jsCode.includes("const fileKey = binary.json_file ? 'json_file' : null;"))throw Error('Validator changed');
get('OPURO — Resultado consulta duplicados').parameters.jsCode=get('OPURO — Resultado consulta duplicados').parameters.jsCode.replace("!v.execution?.create_opuro || v.execution?.create_opol","!v.execution?.create_opuro");
route('¿Preflight OPURO?','create_opuro');route('¿Preflight OPOL?','create_opol');
skip('Preflight OPURO omitido','oxigenopuro');skip('Preflight OPOL omitido','oxigenopolitico');
http('OPOL — Consultar slug existente',{method:'GET',url:"={{ 'https://cms.oxigenopolitico.com.mx/wp-json/wp/v2/posts?context=edit&status=any&per_page=100&slug=' + encodeURIComponent($('Validar y normalizar OPMX MASTER').first().json.canonical.slug) }}"}).alwaysOutputData=true;
code('OPOL — Resultado consulta duplicados',"const slug=$('Validar y normalizar OPMX MASTER').first().json.canonical.slug;const rows=$input.all().flatMap(x=>Array.isArray(x.json)?x.json:[x.json]);if(rows.some(x=>x?.slug===slug&&Number(x.id)>0))throw new Error('Posible duplicado OPOL: ya existe una nota con ese slug.');return [{json:{status:'SIN_COINCIDENCIA_EXACTA',slug}}];");
link('Validar y normalizar OPMX MASTER','¿Preflight OPURO?');
link('¿Preflight OPURO?','OPURO — Consultar slug existente',0);link('¿Preflight OPURO?','Preflight OPURO omitido',1);
link('OPURO — Resultado consulta duplicados','¿Preflight OPOL?');link('Preflight OPURO omitido','¿Preflight OPOL?');
link('¿Preflight OPOL?','OPOL — Consultar slug existente',0);link('¿Preflight OPOL?','Preflight OPOL omitido',1);
link('OPOL — Consultar slug existente','OPOL — Resultado consulta duplicados');
link('OPOL — Resultado consulta duplicados','OPMX — Generar huella de prueba');link('Preflight OPOL omitido','OPMX — Generar huella de prueba');
get('OPMX — Generar huella de prueba').parameters.value=get('OPMX — Generar huella de prueba').parameters.value.replace('.hero_file.base64','.hero_file?.base64 ?? null');
get('OPMX — Reservar preflight').parameters.jsonBody="={{ {requestId:$('Preparar MASTER y binarios').first().json.request_id, fingerprint:$json.fingerprint, slug:$('Validar y normalizar OPMX MASTER').first().json.canonical.slug, destinations:[$('Validar y normalizar OPMX MASTER').first().json.execution.create_opuro?'OPURO':null,$('Validar y normalizar OPMX MASTER').first().json.execution.create_opol?'OPOL':null].filter(x=>x!==null)} }}";
route('¿Procesar OPURO?','create_opuro');route('¿Procesar OPOL?','create_opol');
skip('Resultado OPURO — SKIPPED','oxigenopuro');skip('Resultado OPOL — SKIPPED','oxigenopolitico');
code('OPMX — Conservar resultado OPURO','return $input.all();');
link('OPMX — Verificar reserva','¿Procesar OPURO?');link('¿Procesar OPURO?','GUARD — Iniciar destino',0);link('¿Procesar OPURO?','Resultado OPURO — SKIPPED',1);
link('Resultado OPURO — BORRADOR','OPMX — Conservar resultado OPURO');link('Resultado OPURO — SKIPPED','OPMX — Conservar resultado OPURO');link('OPMX — Conservar resultado OPURO','¿Procesar OPOL?');
link('¿Procesar OPOL?','Resultado OPOL — SKIPPED',1);
const opolNames=['OPOL — Subir DESTACADA','OPOL — Metadata DESTACADA','OPOL — Buscar categoría','OPOL — Resolver categoría','OPOL — Preparar etiquetas v1.0','OPOL — Etiquetas secuenciales v1.2.4','OPOL — Asegurar etiqueta v1.0','OPOL — Resolver etiqueta v1.0','OPOL — ¿Retry 503 etiqueta? v1.2.4','OPOL — Esperar retry etiqueta v1.2.4','OPOL — Retry etiqueta v1.2.4','OPOL — Consolidar etiquetas v1.0','OPOL — Crear borrador mínimo','OPOL — Completar borrador Gutenberg','OPOL — Escribir metadata editorial','OPOL — Escribir Rank Math','OPOL — Readback','OPOL — Validar antes de publicar','Resultado OPOL — BORRADOR'];
for(const name of opolNames){const n=structuredClone(src.nodes.find(n=>n.name===name));if(!n)throw Error('Falta fuente '+name);delete n.credentials;delete n.webhookId;w.nodes.push(n);}
for(const n of w.nodes.filter(n=>n.name.startsWith('OPOL — '))){
 if(n.type==='n8n-nodes-base.httpRequest'){
  n.parameters.options={...n.parameters.options,timeout:10000,redirect:{redirect:{followRedirects:false}}};
  for(const h of n.parameters.headerParameters?.parameters??[])if(h.name==='Content-Type'&&/^=\{\$binary\./.test(h.value))h.value='={{ '+h.value.slice(2,-1)+' }}';
  // Convert older URL interpolation to the same expression form used by OPURO.
  if(n.parameters.url?.startsWith('=https:')){const p=n.parameters.url.slice(1).split(/\{\{\s*|\s*\}\}/);n.parameters.url="={{ "+JSON.stringify(p[0])+" + ("+p[1]+") + "+JSON.stringify(p[2]??'')+" }}";}
 }
}
get('OPOL — Subir DESTACADA').retryOnFail=false;get('OPOL — Crear borrador mínimo').retryOnFail=false;
const identity="requestId:$('Preparar MASTER y binarios').first().json.request_id,slug:$('Validar y normalizar OPMX MASTER').first().json.canonical.slug,destination:'OPOL'";
function guard(name,path,fields){const n=http(name,{method:'POST',url:'https://publisher.oxigenopuro.com.mx/v1/'+path,sendBody:true,specifyBody:'json',jsonBody:'={{ {'+identity+(fields?','+fields:'')+'} }}'});n.parameters.genericAuthType='httpHeaderAuth';}
function confirm(name,status){code(name,"if($input.first().json.status!=="+JSON.stringify(status)+")throw new Error('Guard OPOL no confirmó avance; conciliación manual');return [{json:{status:"+JSON.stringify(status)+"}}];");}
guard('GUARD OPOL — Iniciar destino','targets/begin');confirm('GUARD OPOL — Verificar destino','write_started');
guard('GUARD OPOL — Iniciar destacada','media/begin',"role:'featured'");confirm('GUARD OPOL — Verificar inicio destacada','upload_started');
code('OPOL — Recuperar binario destacada',"return [{json:{},binary:$('Validar y normalizar OPMX MASTER').first().binary}];");
guard('GUARD OPOL — Reportar destacada','media/report',"role:'featured',mediaId:Number($('OPOL — Subir DESTACADA').first().json.id)");confirm('GUARD OPOL — Verificar reporte destacada','media_reported');
http('OPOL — Leer destacada',{method:'GET',url:"={{ 'https://cms.oxigenopolitico.com.mx/wp-json/wp/v2/media/' + $('OPOL — Subir DESTACADA').first().json.id + '?context=edit' }}"});
code('OPOL — Verificar destacada',"const m=$input.first().json,c=$('Validar y normalizar OPMX MASTER').first().json.canonical;if(m.id!==$('OPOL — Subir DESTACADA').first().json.id||m.media_type!=='image'||!m.source_url||String(m.alt_text??'')!==String(c.images.featured_opol.alt_text??''))throw new Error('Destacada OPOL no coincide');return [{json:{status:'DESTACADA_OPOL_VERIFICADA'}}];");
guard('GUARD OPOL — Reportar post','targets/report',"postId:Number($('OPOL — Crear borrador mínimo').first().json.id)");confirm('GUARD OPOL — Verificar reporte post','post_reported');
chain(['¿Procesar OPOL?','GUARD OPOL — Iniciar destino','GUARD OPOL — Verificar destino','GUARD OPOL — Iniciar destacada','GUARD OPOL — Verificar inicio destacada','OPOL — Recuperar binario destacada','OPOL — Subir DESTACADA','GUARD OPOL — Reportar destacada','GUARD OPOL — Verificar reporte destacada','OPOL — Metadata DESTACADA','OPOL — Leer destacada','OPOL — Verificar destacada','OPOL — Buscar categoría','OPOL — Resolver categoría','OPOL — Preparar etiquetas v1.0','OPOL — Etiquetas secuenciales v1.2.4']);
for(const name of ['OPOL — Etiquetas secuenciales v1.2.4','OPOL — Asegurar etiqueta v1.0','OPOL — Resolver etiqueta v1.0','OPOL — ¿Retry 503 etiqueta? v1.2.4','OPOL — Esperar retry etiqueta v1.2.4','OPOL — Retry etiqueta v1.2.4','OPOL — Consolidar etiquetas v1.0'])w.connections[name]=structuredClone(src.connections[name]);
chain(['OPOL — Crear borrador mínimo','GUARD OPOL — Reportar post','GUARD OPOL — Verificar reporte post','OPOL — Completar borrador Gutenberg','OPOL — Escribir metadata editorial','OPOL — Escribir Rank Math','OPOL — Readback','OPOL — Validar antes de publicar','Resultado OPOL — BORRADOR','Resultado consolidado OPMX']);
const validateOpol="const p=$json,c=$('Validar y normalizar OPMX MASTER').first().json.canonical;const tags=$('OPOL — Consolidar etiquetas v1.0').first().json.tag_ids.map(Number).sort((a,b)=>a-b);if(!Number.isSafeInteger(p.id)||p.status!=='draft'||p.slug!==c.slug||p.title?.raw!==c.title||p.author!==2||p.content?.raw!==c.gutenberg_final||p.featured_media!==$('OPOL — Subir DESTACADA').first().json.id||!p.categories?.includes($('OPOL — Resolver categoría').first().json.category_id)||JSON.stringify([...(p.tags??[])].sort((a,b)=>a-b))!==JSON.stringify(tags)||p.meta?.opmx_editorial?.subtitle!==c.subtitle)throw new Error('OPOL readback editorial no coincide');for(const [k,v]of [['rank_math_title',c.title],['rank_math_description',c.meta_description],['rank_math_focus_keyword',c.keywords_all]])if(String(p.meta?.[k]??'')!==String(v??''))throw new Error('OPOL SEO no coincide: '+k);return {json:{validated:true,post_id:p.id}};";
get('OPOL — Validar antes de publicar').parameters.jsCode=validateOpol;
code('OPOL — Requiere conciliación',"let postId=null;try{postId=$('OPOL — Crear borrador mínimo').first().json.id??null}catch{}return [{json:{status:'NEEDS_RECONCILIATION',target:'oxigenopolitico',post_id:postId,retryPermitted:false,warnings:['OPOL no confirmado; revisar guard y WordPress antes de reenviar.']}}];");
const runtimeOpol=w.nodes.filter(n=>(n.name.startsWith('OPOL — ')||n.name.startsWith('GUARD OPOL — '))&&!['OPOL — Consultar slug existente','OPOL — Resultado consulta duplicados','OPOL — Requiere conciliación'].includes(n.name));
for(const n of runtimeOpol)if(['n8n-nodes-base.httpRequest','n8n-nodes-base.code'].includes(n.type)){n.onError='continueErrorOutput';link(n.name,'OPOL — Requiere conciliación',1);}
link('OPOL — Requiere conciliación','Resultado consolidado OPMX');link('Resultado OPOL — SKIPPED','Resultado consolidado OPMX');
get('Resultado consolidado OPMX').parameters.jsCode="const opuro=$('OPMX — Conservar resultado OPURO').first().json,opol=$input.first().json;const execution=$('Validar y normalizar OPMX MASTER').first().json.execution;const requested=[execution.create_opuro?opuro:null,execution.create_opol?opol:null].filter(Boolean);const good=requested.filter(x=>x.status==='DRAFT').length;return [{json:{status:good===requested.length&&good>0?'SUCCESS':good>0?'PARTIAL_SUCCESS':'FAILED',mode:'DRAFT',request_id:$('Preparar MASTER y binarios').first().json.request_id,summary:{opuro:opuro.status,opol:opol.status},post_id_opuro:opuro.post_id??null,post_id_opol:opol.post_id??null,edit_url_opuro:opuro.edit_url??null,edit_url_opol:opol.edit_url??null,targets:{oxigenopuro:opuro,oxigenopolitico:opol},retryPermitted:false}}];";
const prepare=get('Preparar MASTER y binarios');
prepare.parameters.jsCode=prepare.parameters.jsCode.replace('request_id:data.request_id}, binary','request_id:data.request_id,source_images:{hero_base64:data.hero_file?.base64??null,featured_base64:data.featured_file.base64}}, binary');
get('OPMX — Generar huella de prueba').parameters.value="={{ JSON.stringify({canonical:$('Validar y normalizar OPMX MASTER').first().json.canonical,hero_base64:$('Preparar MASTER y binarios').first().json.source_images.hero_base64,featured_base64:$('Preparar MASTER y binarios').first().json.source_images.featured_base64}) }}";
w.nodes.push({name:'Entrada desde MCP archivos',type:'n8n-nodes-base.executeWorkflowTrigger',typeVersion:1.3,position:[0,1400],parameters:{inputSource:'passthrough'}});
link('Entrada desde MCP archivos','Preparar MASTER y binarios');
w.settings={...w.settings,callerPolicy:'workflowsFromAList',callerIds:'bnzVMNkZuGO1GQCZ'};
for(const n of w.nodes){delete n.credentials;delete n.webhookId;}
const output=root+'OPMX_ENTRADA_AUTOMATICA_DESTINOS_v2.json';const text=JSON.stringify(w,null,2)+'\n';
if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==text)throw Error('Referencia v2 no coincide con generador');}else writeFileSync(output,text);
