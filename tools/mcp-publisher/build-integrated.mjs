import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {destinationRuntimeSource} from './destinations.mjs';
import * as pub from './publication.mjs';
const helpers=destinationRuntimeSource()+'\n';
const fixtureRoot='workflows/publisher/integrated-v3/fixtures/';
const load=n=>JSON.parse(readFileSync(fixtureRoot+n+'-before.json','utf8'));
const node=(w,n)=>{const x=w.nodes.find(x=>x.name===n);if(!x)throw Error(n);return x;};
const code=(w,n,s)=>node(w,n).parameters.jsCode=s;
const edge=(w,a,b,index=0,targetIndex=0)=>{w.connections[a]??={main:[]};w.connections[a].main[index]??=[];w.connections[a].main[index].push({node:b,type:'main',index:targetIndex});};
const route=(w,a,b)=>{w.connections[a]={main:[[{node:b,type:'main',index:0}]]};};
const liberalCred={wordpressApi:{id:'UI3HOKE26hMVLvH0',name:'El Liberal producción — Publisher'}};
function nativeLiberal(n){
 if(n.type==='n8n-nodes-base.httpRequest' && JSON.stringify(n.parameters).includes('cms.elliberal.mx')){n.parameters.authentication='predefinedCredentialType';n.parameters.nodeCredentialType='wordpressApi';delete n.parameters.genericAuthType;n.credentials=liberalCred;}
 return n;
}
function cloneBranch(w,names,transform){
 const map=new Map(names.map(n=>[n,transform(n)]));
 const text=s=>{for(const [a,b] of [...map].sort((a,b)=>b[0].length-a[0].length))s=s.replaceAll(a,b);return s.replaceAll('cms.oxigenopuro.com.mx','cms.elliberal.mx').replaceAll('https://oxigenopuro.com.mx','https://elliberal.mx').replaceAll("'oxigenopuro'","'elliberal'").replaceAll('"oxigenopuro"','"elliberal"').replaceAll('oxpuro_','liberalmx_').replaceAll('hero_opuro','hero_liberal').replaceAll('featured_opuro','featured_liberal').replaceAll('categories.opuro','categories.liberal').replaceAll('categories?.opuro','categories?.liberal').replaceAll("'OPURO'","'LIBERAL'").replaceAll('create_opuro','create_liberal').replaceAll('c.author.id','c.author_liberal.id').replaceAll('canonical.author.id','canonical.author_liberal.id').replaceAll('Oxígeno Puro','El Liberal MX').replaceAll('OPURO','LIBERAL');};
 for(const name of names){const old=node(w,name);const n=JSON.parse(text(JSON.stringify(old)));n.id=randomUUID();n.name=map.get(name);n.position=[(old.position?.[0]??0)+240,(old.position?.[1]??0)+2600];w.nodes.push(nativeLiberal(n));}
 for(const name of names)if(w.connections[name])w.connections[map.get(name)]=JSON.parse(text(JSON.stringify(w.connections[name])));
 return {map,text};
}
function normalizer(original){
 let s=original;
 const start=s.indexOf('const destinoRaw ='),end=s.indexOf('// v1.1.7');
 s=s.slice(0,start)+`const destinations=resolveDestinations(envelope.CREAR_EN);\nconst destinoRaw=destinationLabel(destinations);\nconst publicarRaw=envelope.PUBLICAR;\nconst publish=Array.isArray(publicarRaw)?publicarRaw.length>0:(publicarRaw===true||['sí','si','true','1','on'].includes(String(publicarRaw??'').trim().toLowerCase()));\nconst execution={destination:destinoRaw,destinations,create_opuro:destinations.includes('OPURO'),create_opol:destinations.includes('OPOL'),create_liberal:destinations.includes('LIBERAL'),publish};\n\n`+s.slice(end);
 s=s.replace('if (!category) {','if (execution.create_opuro && !category) {').replace('if (!categoryOpol) {','if (execution.create_opol && !categoryOpol) {').replace('if (!CATEGORY_CATALOG.OPOL_ALLOWED.includes(categoryOpol)) {','if (execution.create_opol && !CATEGORY_CATALOG.OPOL_ALLOWED.includes(categoryOpol)) {').replace('if (categoryOpolSecondary !== null) {','if (execution.create_opol && categoryOpolSecondary !== null) {').replace('if (seoCategory !== category) {','if (execution.create_opuro && seoCategory !== category) {');
 s=s.replace("if (execution.create_opuro && ((heroOpuro.credit", "if ((execution.create_opuro || execution.create_liberal) && ((heroOpuro.credit");
 // Shared enriched artifact and original hero/featured bytes. Site IDs remain separate.
 s=s.replace("if (execution.create_opuro) {\n  const requiredOpuro", "if (execution.create_opuro || execution.create_liberal) {\n  const requiredOpuro");
 const endReturn=s.indexOf('\nreturn {\n  json:');
 const validation=`\nconst liberalCategory=str(CATS.LIBERAL?.PRINCIPAL??CATS.liberal?.principal??SEO.CATEGORIA??SEO.category);\nif(execution.create_liberal){\n if(!liberalCategory)throw Error('Falta CATEGORIAS.LIBERAL.PRINCIPAL');\n // Inline attachment IDs belong to one CMS. Never copy OPURO IDs into LIBERAL.\n if(/<!--\\s*wp:image\\b/i.test(gutenbergEnriquecidoFinal))throw Error('LIBERAL: los bloques core/image internos requieren adjuntos nativos propios; este transporte admite Hero y destacada. No se inició ninguna escritura.');\n}\n`;
 s=s.slice(0,endReturn)+validation+s.slice(endReturn);
 // Preserve canonical shape and fingerprint for legacy destinations; extend only when LIBERAL is selected.
 s=s.replace('      author: {',`      ...(execution.create_liberal?{author_liberal:{id:2,source:'PUBLISHER_LIBERAL'},gutenberg_liberal:gutenbergEnriquecidoFinal}:{}),\n      author: {`);
 s=s.replace('    original: d',`    original: d`);
 s=s.replace('  binary\n};',`  binary\n};`);
 s=s.replace('return {\n  json: {', 'const normalized={\n  json: {');
 s+=`\nif(execution.create_liberal){normalized.json.canonical.categories.liberal={principal:liberalCategory};normalized.json.canonical.images.hero_liberal={...heroOpuro};normalized.json.canonical.images.featured_liberal={...featuredOpuro};}\nreturn normalized;\n`;
 return helpers+s;
}
const automatic=load('automatic');
code(automatic,'Validar y normalizar OPMX MASTER',normalizer(node(automatic,'Validar y normalizar OPMX MASTER').parameters.jsCode));
let prep=node(automatic,'Preparar MASTER y binarios').parameters.jsCode;
prep=prep.replace("const destination = String(data.CREAR_EN ?? '').toUpperCase();\nif (!['OPURO','OPOL','AMBOS'].includes(destination)) throw new Error('CREAR_EN inválido');",'const destination=destinationLabel(resolveDestinations(data.CREAR_EN));');code(automatic,'Preparar MASTER y binarios',helpers+prep);
const branchNames=automatic.nodes.filter((n,i)=>(i>=8&&i<=46&&i!==47)||i===26).map(n=>n.name);
cloneBranch(automatic,branchNames,n=>n.startsWith('OPURO')?n.replace('OPURO','LIBERAL'):n.startsWith('Resultado OPURO')?n.replace('OPURO','LIBERAL'):n.startsWith('GUARD —')?n.replace('GUARD —','GUARD LIBERAL —'):n.replace('OPMX —','LIBERAL —'));
const last=node(automatic,'Resultado LIBERAL — BORRADOR');route(automatic,last.name,'Resultado consolidado OPMX');
// Failure paths retain target identity and never retry writes.
for(const n of automatic.nodes.filter(n=>branchNames.includes(n.name))){/* original branch unchanged */}
const cloneIf=(old,name,flag)=>{const n=structuredClone(node(automatic,old));n.id=randomUUID();n.name=name;n.parameters=JSON.parse(JSON.stringify(n.parameters).replaceAll('create_opuro',flag));n.position=[0,3500];automatic.nodes.push(n);};
cloneIf('¿Preflight OPURO?','¿Preflight LIBERAL?','create_liberal');
cloneIf('¿Procesar OPURO?','¿Procesar LIBERAL?','create_liberal');
function copyNode(old,name,text=x=>x){const n=JSON.parse(text(JSON.stringify(node(automatic,old))));n.name=name;n.id=randomUUID();automatic.nodes.push(nativeLiberal(n));return n;}
const libText=s=>s.replaceAll('cms.oxigenopuro.com.mx','cms.elliberal.mx').replaceAll('create_opuro','create_liberal').replaceAll('OPURO','LIBERAL');
for(const [a,b] of [['OPURO — Consultar slug existente','LIBERAL — Consultar slug existente'],['OPURO — Resultado consulta duplicados','LIBERAL — Resultado consulta duplicados'],['Preflight OPURO omitido','Preflight LIBERAL omitido'],['Resultado OPURO — SKIPPED','Resultado LIBERAL — SKIPPED']])copyNode(a,b,libText);
copyNode('OPMX — Conservar resultado OPURO','OPMX — Conservar resultado OPOL');
route(automatic,'OPOL — Resultado consulta duplicados','¿Preflight LIBERAL?');route(automatic,'Preflight OPOL omitido','¿Preflight LIBERAL?');
route(automatic,'¿Preflight LIBERAL?','LIBERAL — Consultar slug existente');edge(automatic,'¿Preflight LIBERAL?','Preflight LIBERAL omitido',1);
route(automatic,'LIBERAL — Consultar slug existente','LIBERAL — Resultado consulta duplicados');
// Resolve LIBERAL category before reserving or writing to any target.
const libCat=structuredClone(node(automatic,'LIBERAL — Buscar categoría'));libCat.id=randomUUID();libCat.name='LIBERAL — Preflight categoría';automatic.nodes.push(libCat);
const libResolve=structuredClone(node(automatic,'LIBERAL — Resolver categoría'));libResolve.id=randomUUID();libResolve.name='LIBERAL — Verificar categoría preflight';automatic.nodes.push(libResolve);
route(automatic,'LIBERAL — Resultado consulta duplicados',libCat.name);route(automatic,libCat.name,libResolve.name);route(automatic,libResolve.name,'OPMX — Generar huella de prueba');route(automatic,'Preflight LIBERAL omitido','OPMX — Generar huella de prueba');
node(automatic,'OPMX — Reservar preflight').parameters.jsonBody="={{ {requestId:$('Preparar MASTER y binarios').first().json.request_id, fingerprint:$json.fingerprint, slug:$('Validar y normalizar OPMX MASTER').first().json.canonical.slug, destinations:$('Validar y normalizar OPMX MASTER').first().json.execution.destinations} }}";
for(const name of ['Resultado OPOL — BORRADOR','Resultado OPOL — SKIPPED','OPOL — Requiere conciliación'])route(automatic,name,'OPMX — Conservar resultado OPOL');
route(automatic,'OPMX — Conservar resultado OPOL','¿Procesar LIBERAL?');route(automatic,'¿Procesar LIBERAL?','GUARD LIBERAL — Iniciar destino');edge(automatic,'¿Procesar LIBERAL?','Resultado LIBERAL — SKIPPED',1);route(automatic,'Resultado LIBERAL — SKIPPED','Resultado consolidado OPMX');
// Local failure receipt; native guard retains post/media identities for manual reconciliation.
code(automatic,'LIBERAL — Preparar conciliación',"let postId=null;try{postId=$('LIBERAL — Crear borrador Gutenberg enriquecido').first().json.id??null}catch{}return [{json:{status:'NEEDS_RECONCILIATION',target:'elliberal',post_id:postId,retryPermitted:false,warnings:['LIBERAL no confirmado; revisar guard y WordPress antes de reenviar.']}}];");route(automatic,'LIBERAL — Preparar conciliación','Resultado consolidado OPMX');
// The clone's body uses same enriched content but own CMS fields/author.
code(automatic,'Resultado consolidado OPMX',`const opuro=$('OPMX — Conservar resultado OPURO').first().json,opol=$('OPMX — Conservar resultado OPOL').first().json,liberal=$input.first().json;const execution=$('Validar y normalizar OPMX MASTER').first().json.execution;const values={OPURO:opuro,OPOL:opol,LIBERAL:liberal};const requested=execution.destinations.map(d=>values[d]);const good=requested.filter(x=>x.status==='DRAFT').length;return [{json:{status:good===requested.length&&good>0?'SUCCESS':good>0?'PARTIAL_SUCCESS':'FAILED',mode:'DRAFT',request_id:$('Preparar MASTER y binarios').first().json.request_id,destino:execution.destination,summary:{opuro:opuro.status,opol:opol.status,liberal:liberal.status},post_id_opuro:opuro.post_id??null,post_id_opol:opol.post_id??null,post_id_liberal:liberal.post_id??null,edit_url_opuro:opuro.edit_url??null,edit_url_opol:opol.edit_url??null,edit_url_liberal:liberal.edit_url??null,targets:{oxigenopuro:opuro,oxigenopolitico:opol,elliberal:liberal},retryPermitted:false}}];`);
const mcp=load('files-mcp');
let protocol=node(mcp,'Protocolo MCP archivos').parameters.jsCode;
protocol=protocol.replaceAll("{type:'string',enum:['OPURO','OPOL','AMBOS']}","{type:'string',minLength:1,maxLength:256,description:'OPURO, OPOL, LIBERAL, AMBOS (OPURO+OPOL), TODOS o lista por comas.'}")
 .replace("if(!a||!['OPURO','OPOL','AMBOS'].includes(a.destino))return fail(-32602,'Destino inválido');","let requested;try{requested=resolveDestinations(a?.destino);}catch{return fail(-32602,'Destino inválido');}")
 .replace("a.destino==='AMBOS'?['opuro','opol']:[a.destino.toLowerCase()]","requested.map(d=>d.toLowerCase())")
 .replace("post_id_opol:{type:'integer',minimum:1},","post_id_opol:{type:'integer',minimum:1},post_id_liberal:{type:'integer',minimum:1},")
 .replace('post_id_opol:a.post_id_opol??null,','post_id_opol:a.post_id_opol??null,post_id_liberal:a.post_id_liberal??null,')
 .replace("a.destino==='OPOL'?['master_file','destacada']:['master_file','hero','destacada']","requested.length===1&&requested[0]==='OPOL'?['master_file','destacada']:['master_file','hero','destacada']")
 .replaceAll('OPURO, OPOL o AMBOS','OPURO, OPOL, LIBERAL, AMBOS, TODOS o lista por comas');
code(mcp,'Protocolo MCP archivos',helpers+protocol);
for(const [name,fn] of [['Preparar publicación verificada',pub.preparePublication],['Preparar publicación existente',pub.prepareExistingPublication]]){const old=node(mcp,name).parameters.jsCode;code(mcp,name,helpers+fn.toString()+'\n'+old.slice(old.lastIndexOf('\nreturn ')+1));}
const pre=node(mcp,'Preflight conjunto publicación').parameters.jsCode;code(mcp,'Preflight conjunto publicación',helpers+pub.editorialSnapshot.toString()+'\n'+pub.checkPublicationPreflight.toString()+'\n'+pre.slice(pre.indexOf("const p=$('Conservar plan publicación')")));
const mcpNames=['¿Preflight publicación OPURO?','Publicación — Guard OPURO','Publicación — Preflight OPURO','¿Publicar OPURO?','Publicación — Publicar OPURO','Publicación — Confirmar OPURO','Publicación — Evaluar OPURO','Publicación — Omitir OPURO','Conservar publicación OPURO'];
cloneBranch(mcp,mcpNames,n=>n.replaceAll('OPURO','LIBERAL'));
// OPURO & OPOL remain sequential, then LIBERAL. Shared preflight reads all before any POST.
route(mcp,'Publicación — Categoría OPOL','¿Preflight publicación LIBERAL?');
const skipPre=node(mcp,'¿Preflight publicación OPOL?');mcp.connections[skipPre.name].main[1]=[{node:'¿Preflight publicación LIBERAL?',type:'main',index:0}];
route(mcp,'¿Preflight publicación LIBERAL?','Publicación — Guard LIBERAL');edge(mcp,'¿Preflight publicación LIBERAL?','Preflight conjunto publicación',1);route(mcp,'Publicación — Guard LIBERAL','Publicación — Preflight LIBERAL');route(mcp,'Publicación — Preflight LIBERAL','Preflight conjunto publicación');
route(mcp,'Conservar publicación OPOL','¿Publicar LIBERAL?');route(mcp,'Conservar publicación LIBERAL','¿Verificar web OPURO?');
// Code helpers in evaluation include Liberal metadata so readback detects any editorial mutation.
for(const d of ['OPURO','OPOL','LIBERAL']){const n=node(mcp,'Publicación — Evaluar '+d);const s=n.parameters.jsCode;const start=s.indexOf('function editorialSnapshot'),end=s.indexOf('function recordPublication');if(start>=0&&end>start)n.parameters.jsCode=s.slice(0,start)+pub.editorialSnapshot.toString()+'\n'+s.slice(end);}
// Preserve Telegram routines and current output/error contracts.
const recovery=load('recovery');
code(recovery,'Validar identidad',node(recovery,'Validar identidad').parameters.jsCode.replace("x.destination!=='OPURO'","!['OPURO','OPOL','LIBERAL'].includes(x.destination)"));
const recoveryNative=node(recovery,'Consultar WordPress sin escribir');
// Separate native credentials per CMS; never route an OPURO credential to LIBERAL.
const recNames=['Consultar WordPress sin escribir'];
cloneBranch(recovery,recNames,n=>'Consultar LIBERAL sin escribir');
const recOpol=structuredClone(recoveryNative);recOpol.name='Consultar OPOL sin escribir';recOpol.id=randomUUID();recOpol.parameters.url=recOpol.parameters.url.replaceAll('cms.oxigenopuro','cms.oxigenopolitico');recOpol.credentials={httpBasicAuth:{id:'9mL9HGLYoSVIGfQ1',name:'Oxigeno Politico'}};recovery.nodes.push(recOpol);
function addIf(w,name,expression){w.nodes.push({id:randomUUID(),name,type:'n8n-nodes-base.if',typeVersion:2.2,position:[0,0],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:randomUUID(),leftValue:expression,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}});}
addIf(recovery,'¿Recuperar LIBERAL?',"={{ $('Validar identidad').first().json.destination === 'LIBERAL' }}");addIf(recovery,'¿Recuperar OPOL?',"={{ $('Validar identidad').first().json.destination === 'OPOL' }}");route(recovery,'Comprobar identidad guard','¿Recuperar LIBERAL?');route(recovery,'¿Recuperar LIBERAL?','Consultar LIBERAL sin escribir');edge(recovery,'¿Recuperar LIBERAL?','¿Recuperar OPOL?',1);route(recovery,'¿Recuperar OPOL?','Consultar OPOL sin escribir');edge(recovery,'¿Recuperar OPOL?','Consultar WordPress sin escribir',1);route(recovery,'Consultar LIBERAL sin escribir','Informe de conciliación');route(recovery,'Consultar OPOL sin escribir','Informe de conciliación');
for(const [name,w] of [['automatic',automatic],['files-mcp',mcp],['recovery',recovery]]){
 const names=new Set(w.nodes.map(n=>n.name));if(names.size!==w.nodes.length)throw Error('Duplicate names '+name);
 for(const [a,c] of Object.entries(w.connections)){if(!names.has(a))throw Error('Unknown '+a);for(const outputs of Object.values(c))for(const edges of outputs)for(const e of edges)if(!names.has(e.node))throw Error('Unknown '+e.node);}
 writeFileSync(fixtureRoot+name+'-after.json',JSON.stringify(w,null,2)+'\n');
}
// Preserve publication state accumulated in earlier destinations.
code(mcp,'Publicación — Omitir LIBERAL',"return [{json:$('Conservar publicación OPOL').first().json}];");
code(mcp,'Publicación — Evaluar LIBERAL',node(mcp,'Publicación — Evaluar LIBERAL').parameters.jsCode.replace("recordPublication($('Preflight conjunto publicación').first().json", "recordPublication($('Conservar publicación OPOL').first().json"));
for(const n of mcp.nodes.filter(n=>['¿Verificar web OPURO?','Publicación — Revalidar OPURO','Publicación — Visibilidad OPURO','Publicación — Sin web OPURO'].includes(n.name)))n.parameters=JSON.parse(JSON.stringify(n.parameters).replaceAll('Conservar publicación OPOL','Conservar publicación LIBERAL'));
code(mcp,'Protocolo MCP archivos',node(mcp,'Protocolo MCP archivos').parameters.jsCode.replace('const a=message.params.arguments;', 'let a=message.params.arguments;').replace("if(message.params.name!==tool.name", "a={...a,destino:destinationLabel(requested)};\n if(message.params.name!==tool.name"));
// Community form uses the SAME guarded child, then the same verified publication implementation.
// Existing UI entry and legacy nodes are preserved for rollback; old branches are disconnected.
const community=load('community');
code(community,'Validar y normalizar OPMX MASTER',normalizer(node(community,'Validar y normalizar OPMX MASTER').parameters.jsCode));
const form=node(community,'On form submission');const field=form.parameters.formFields.values.find(x=>x.fieldLabel==='CREAR_EN');field.fieldType='text';delete field.fieldOptions;field.placeholder='OPURO, OPOL, LIBERAL, AMBOS, TODOS u OPURO,LIBERAL';
form.parameters.formFields.values.find(x=>x.fieldName==='PUBLICAR').defaultValue='Sí';
form.parameters.formTitle='OPMX Publisher — OPURO · OPOL · LIBERAL';form.parameters.formDescription='MASTER aprobado y archivos originales. AMBOS conserva OPURO + OPOL. TODOS incluye los tres. Admite listas separadas por comas.';
function addCode(w,name,jsCode){const n={id:randomUUID(),name,type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{mode:'runOnceForAllItems',jsCode},onError:'continueErrorOutput'};w.nodes.push(n);return n;}
addCode(community,'Preparar paquete compartido',`const item=$input.first(),v=item.json;const request_id='opmx_community_execution_'+String($execution.id);const payload={request_id,CREAR_EN:v.execution.destination,PUBLICAR:false,master:v.original};for(const key of ['featured_file',...(v.execution.create_opuro||v.execution.create_liberal?['hero_file']:[])]){const bytes=await this.helpers.getBinaryDataBuffer(0,key);payload[key]={base64:bytes.toString('base64')};}return [{json:payload}];`);
const child=structuredClone(node(mcp,'Publisher protegido existente'));child.name='Publisher compartido — borradores';child.id=randomUUID();community.nodes.push(child);
addCode(community,'Protocolo MCP archivos',`const receipt=$input.first().json,request_id=$('Preparar paquete compartido').first().json.request_id;const v=$('Validar y normalizar OPMX MASTER').first().json;if(receipt.status!=='SUCCESS'||receipt.mode!=='DRAFT')throw Error('Borradores no confirmados. Revisar IDs y ejecución; no reenviar automáticamente.');return [{json:{request:{id:request_id,request_id,operation:'publicar_borradores_opmx',slug:v.canonical.slug,destino:v.execution.destination,confirmar_publicacion:'PUBLICAR',post_id_opuro:receipt.post_id_opuro??null,post_id_opol:receipt.post_id_opol??null,post_id_liberal:receipt.post_id_liberal??null},receipt}}];`);
addIf(community,'¿Publicar selección?',"={{ $('Validar y normalizar OPMX MASTER').first().json.execution.publish }}");
const pubNames=mcp.nodes.filter(n=>/^(Preparar publicación existente|Conservar plan publicación|¿Preflight publicación|Publicación —|Preflight conjunto publicación|¿Publicar (OPURO|OPOL|LIBERAL)\?|Conservar publicación|¿Verificar web OPURO\?|Conservar visibilidad OPURO|Resultado publicación MCP|Publicación rechazada antes de publicar|Publicación resultado incierto)/.test(n.name)).map(n=>n.name);
for(const name of pubNames){const n=structuredClone(node(mcp,name));n.id=randomUUID();community.nodes.push(n);if(mcp.connections[name])community.connections[name]=structuredClone(mcp.connections[name]);}
// Terminal publication response becomes form data; no webhook or Telegram side effect.
addCode(community,'Resultado formulario compartido',`const x=$input.first().json;const r=x.response?.result?.structuredContent??x;const c=$('Validar y normalizar OPMX MASTER').first().json.canonical;const summary=r.summary??Object.fromEntries(['OPURO','OPOL','LIBERAL'].map(d=>[d.toLowerCase(),r.targets?.[d]?.status??'SKIPPED']));return [{json:{...r,summary,seo_title:c.title,seo_subtitle:c.subtitle,final_url_opuro:r.targets?.OPURO?.public_url??null,final_url_opol:r.targets?.OPOL?.public_url??null,final_url_liberal:r.targets?.LIBERAL?.public_url??null}}];`);
route(community,'Validar y normalizar OPMX MASTER','Preparar paquete compartido');route(community,'Preparar paquete compartido',child.name);route(community,child.name,'¿Publicar selección?');route(community,'¿Publicar selección?','Protocolo MCP archivos');edge(community,'¿Publicar selección?','Resultado formulario compartido',1);route(community,'Protocolo MCP archivos','Preparar publicación existente');
for(const name of ['Resultado publicación MCP','Publicación rechazada antes de publicar','Publicación resultado incierto'])route(community,name,'Resultado formulario compartido');route(community,'Resultado formulario compartido','Form');
for(const name of ['Preparar paquete compartido',child.name,'Protocolo MCP archivos','Resultado formulario compartido']){node(community,name).onError='continueErrorOutput';edge(community,name,'ERROR — Preparar respuesta visible',1);}
edge(community,'Validar y normalizar OPMX MASTER','ERROR — Preparar respuesta visible',1);
node(community,'Form').parameters.completionMessage="={{ 'Modo: '+$json.mode+'\\nEstado: '+$json.status+'\\n\\n'+['OPURO','OPOL','LIBERAL'].map(d=>d+': '+($json.summary?.[d.toLowerCase()]??'SKIPPED')+'\\n'+($json['edit_url_'+d.toLowerCase()]??$json['final_url_'+d.toLowerCase()]??'')).join('\\n\\n')+'\\n\\nSolicitud: '+($json.request_id??'')+'\\nTítulo: '+($json.seo_title??'') }}";
// Remove stale outgoing copies referencing Telegram or responder nodes outside this form.
const communityNames=new Set(community.nodes.map(n=>n.name));for(const [a,c] of Object.entries(community.connections))for(const [kind,outputs] of Object.entries(c))community.connections[a][kind]=outputs.map(es=>es.filter(e=>communityNames.has(e.node)));
for(const [name,w] of [['automatic',automatic],['files-mcp',mcp],['recovery',recovery],['community',community]])writeFileSync(fixtureRoot+name+'-after.json',JSON.stringify(w,null,2)+'\n');
// Remove an unused clone: Liberal failures already return a reconciliation receipt.
automatic.nodes=automatic.nodes.filter(n=>n.name!=='LIBERAL — Consultar conciliación');delete automatic.connections['LIBERAL — Consultar conciliación'];
route(automatic,'OPMX — Consultar conciliación','OPMX — Conservar resultado OPURO');
writeFileSync(fixtureRoot+'automatic-after.json',JSON.stringify(automatic,null,2)+'\n');
// The form now has one completion surface and no disconnected legacy write branches.
route(community,'ERROR — Preparar respuesta visible','Form');
node(community,'Form').parameters.completionTitle="={{ $json.error_message ? '✕ Publisher encontró un error' : ($json.mode === 'DRAFT' ? '✓ Borrador completado' : ($json.status === 'SUCCESS' ? '✓ Publicación completada' : 'Publicación procesada')) }}";
const completion=node(community,'Form').parameters.completionMessage;node(community,'Form').parameters.completionMessage="={{ $json.error_message ? ('ERROR\\n\\n'+$json.error_message+'\\n\\nRevisar ejecución y estados antes de reenviar.') : ("+completion.slice(4,-3)+") }}";
const keep=new Set(),queue=['On form submission'];while(queue.length){const n=queue.shift();if(keep.has(n))continue;keep.add(n);for(const ports of Object.values(community.connections[n]??{}))for(const es of ports)for(const e of es)queue.push(e.node);}
community.nodes=community.nodes.filter(n=>keep.has(n.name));for(const n of Object.keys(community.connections))if(!keep.has(n))delete community.connections[n];
automatic.settings.callerIds='bnzVMNkZuGO1GQCZ,Mt7ts2EGPbyaTC2o';
for(const [name,w]of [['automatic',automatic],['community',community]])writeFileSync(fixtureRoot+name+'-after.json',JSON.stringify(w,null,2)+'\n');
