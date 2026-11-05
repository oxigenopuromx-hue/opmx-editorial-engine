import {destinationRuntimeSource} from './destinations.mjs';
import {classifyFileMcp,parseMcpMaster,validateMcpImage,fileMcpResult} from './files-mcp-protocol.mjs';
import {imageType} from './prepare.mjs';
import {writeFileSync} from 'node:fs';
const operations=[];
const add=(name,type,version,parameters)=>operations.push({type:'addNode',node:{name,type:'n8n-nodes-base.'+type,typeVersion:version,parameters,position:[600+operations.length*30,400]}});
const code=(name,jsCode)=>add(name,'code',2,{mode:'runOnceForAllItems',jsCode});
const link=(source,target,sourceIndex=0)=>operations.push({type:'addConnection',source,target,sourceIndex,targetIndex:0});
const branch=(name,condition)=>add(name,'if',2.2,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict'},conditions:[{leftValue:'={{ '+condition+' }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}});
const req="$('Protocolo MCP archivos').first().json.request";
const download=(name,role)=>add(name,'httpRequest',4.2,{method:'GET',url:'={{ '+req+'.files.'+role+'.download_url }}',authentication:'none',options:{timeout:10000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'file',outputPropertyName:'asset'}}}});
// H104 base remains draft-only. Apply build-publication-mcp AFTER this base to
// install the publication graph and expose its tools together (H108).
operations.push({type:'updateNodeParameters',nodeName:'Protocolo MCP archivos',parameters:{mode:'runOnceForAllItems',jsCode:(destinationRuntimeSource()+'\n'+classifyFileMcp.toString())+'\nreturn [{json:classifyFileMcp($input.first().json,{publicationEnabled:false})}];'}});
operations.push({type:'updateNodeParameters',nodeName:'MCP Publisher GET',replace:true,parameters:{httpMethod:'GET',path:'opmx-publisher-files-mcp',authentication:'none',responseMode:'responseNode',options:{}}});
operations.push({type:'removeConnection',source:'¿Notificación MCP?',target:'Responder MCP',sourceIndex:1,targetIndex:0});
branch('¿Solicitud con archivos?',"$json.route === 'files'");
download('Descargar MASTER','master_file');
code('Comprobar MASTER',parseMcpMaster.toString()+`\nconst bytes=await this.helpers.getBinaryDataBuffer(0,'asset');return [{json:parseMcpMaster(bytes,${req})}];`);
download('Descargar destacada','destacada');
code('Comprobar destacada',imageType.toString()+'\n'+validateMcpImage.toString()+`\nconst r=${req};const b=await this.helpers.getBinaryDataBuffer(0,'asset');const m=$('Comprobar MASTER').first().json;return [{json:{payload:{request_id:r.request_id,CREAR_EN:r.destino,PUBLICAR:false,master:m.master,featured_file:validateMcpImage(b,r.files.destacada,imageType(b))},stats:{master:m.masterBytes,destacada:b.length}}}];`);
branch('¿Requiere Hero?',req+".destino !== 'OPOL'");
download('Descargar Hero','hero');
code('Comprobar Hero',imageType.toString()+'\n'+validateMcpImage.toString()+`\nconst r=${req};const b=await this.helpers.getBinaryDataBuffer(0,'asset');const p=$('Comprobar destacada').first().json;return [{json:{payload:{...p.payload,hero_file:validateMcpImage(b,r.files.hero,imageType(b))},stats:{...p.stats,hero:b.length}}}];`);
branch('¿Crear borradores?',req+".operation === 'preparar_borrador_opmx'");
code('Resultado validación archivos',fileMcpResult.toString()+`\nconst r=${req};const p=$input.first().json;return [{json:fileMcpResult(r,{status:'FILES_VALIDATED',bytesVerified:true,destino:r.destino,slug:p.payload.master.SEO.SLUG,estado:p.payload.master.CONTROL_EDITORIAL?.ESTADO,bytes:p.stats})}];`);
code('Entregar paquete sin enlaces','return [{json:$input.first().json.payload}];');
add('Publisher protegido existente','executeWorkflow',1.4,{source:'database',workflowId:{__rl:true,mode:'id',value:'4o7K5TmKc7joScqB'},mode:'once',options:{waitForSubWorkflow:true}});
code('Resultado Publisher MCP',fileMcpResult.toString()+`\nconst r=${req};const result=$input.first().json;return [{json:fileMcpResult(r,result,result.status!=='SUCCESS')}];`);
code('Archivo rechazado',fileMcpResult.toString()+`\nreturn [{json:fileMcpResult(${req},{status:'FILES_REJECTED',writesStarted:false,message:'No fue posible validar los archivos. Revisa adjuntos, vigencia y formato.'},true)}];`);
code('Publisher resultado incierto',fileMcpResult.toString()+`\nreturn [{json:fileMcpResult(${req},{status:'UNCERTAIN',request_id:${req}.request_id,execution_id:$execution.id,retryPermitted:false},true)}];`);
link('¿Notificación MCP?','¿Solicitud con archivos?',1);link('¿Solicitud con archivos?','Descargar MASTER');link('¿Solicitud con archivos?','Responder MCP',1);
link('Descargar MASTER','Comprobar MASTER');link('Comprobar MASTER','Descargar destacada');link('Descargar destacada','Comprobar destacada');link('Comprobar destacada','¿Requiere Hero?');link('¿Requiere Hero?','Descargar Hero');link('Descargar Hero','Comprobar Hero');link('Comprobar Hero','¿Crear borradores?');link('¿Requiere Hero?','¿Crear borradores?',1);
link('¿Crear borradores?','Entregar paquete sin enlaces');link('¿Crear borradores?','Resultado validación archivos',1);link('Entregar paquete sin enlaces','Publisher protegido existente');link('Publisher protegido existente','Resultado Publisher MCP');
for(const name of ['Resultado Publisher MCP','Resultado validación archivos','Archivo rechazado','Publisher resultado incierto'])link(name,'Responder MCP');
for(const name of ['Descargar MASTER','Comprobar MASTER','Descargar destacada','Comprobar destacada','Descargar Hero','Comprobar Hero']){operations.push({type:'setNodeSettings',nodeName:name,settings:{onError:'continueErrorOutput',retryOnFail:false}});link(name,'Archivo rechazado',1);}
operations.push({type:'setNodeSettings',nodeName:'Publisher protegido existente',settings:{onError:'continueErrorOutput',retryOnFail:false}});link('Publisher protegido existente','Publisher resultado incierto',1);
operations.push({type:'setWorkflowMetadata',description:'MCP OAuth para archivos nativos del Motor: valida MASTER e imágenes y llama al Publisher protegido existente. Sólo borradores; no requiere copiar Base64 ni otra conversación.'});
operations.push({type:'setWorkflowSettings',settings:{saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false,executionTimeout:300}});
operations.push({type:'setNodeGroups',nodeGroups:[{name:'Archivos y borradores',description:'Valida archivos nativos y llama al Publisher protegido existente.',nodeNames:['Responder MCP',...operations.filter(x=>x.type==='addNode').map(x=>x.node.name)]}]});
writeFileSync('/tmp/opmx-files-mcp-operations.json',JSON.stringify(operations,null,2));
console.log(JSON.stringify({operations:operations.length,nodes:operations.filter(x=>x.type==='addNode').length}));

