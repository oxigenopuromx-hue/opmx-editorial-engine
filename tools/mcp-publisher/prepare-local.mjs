import {destinationRegistry,resolveDestinations,destinationLabel} from './destinations.mjs';
// Work-side bridge: use already authorized local Library files. This module
// prepares a transport body only; it never calls n8n or publishes anything.
import {readFile,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {imageType} from './prepare.mjs';

export async function prepareLocalPayload({masterPath,heroPath,featuredPath,destination,requestId,maxBytes=10*1024*1024}) {
 if(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(requestId))throw Error('request_id estable inválido');
 const requested=resolveDestinations(destination);
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('Límite inválido');
 if((await stat(masterPath)).size>2*1024*1024)throw Error('MASTER demasiado grande');
 const master=JSON.parse(await readFile(masterPath,'utf8'));
 if(!master||typeof master!=='object'||Array.isArray(master))throw Error('MASTER inválido');
 if(master.CONTROL_EDITORIAL?.ESTADO!=='LISTO')throw Error('Paquete no aprobado editorialmente');
 if(requested.some(d=>d!=='OPOL')&&typeof master.GUTENBERG_ENRIQUECIDO_FINAL!=='string')throw Error('Falta Gutenberg OPURO');
 if(requested.includes('OPOL')&&typeof master.GUTENBERG_FINAL!=='string')throw Error('Falta Gutenberg OPOL');
 const files=[];
 async function image(path,role) {
  if(!path)throw Error('Falta archivo '+role);
  if((await stat(path)).size>maxBytes)throw Error('Imagen demasiado grande');
  const bytes=await readFile(path);if(bytes.length>maxBytes)throw Error('Imagen demasiado grande');
  const mime=imageType(bytes);
  files.push({role,bytes:bytes.length,mime_type:mime,sha256:createHash('sha256').update(bytes).digest('hex')});
  return {base64:bytes.toString('base64')};
 }
 const featured_file=await image(featuredPath,'featured');
 const payload={request_id:requestId,CREAR_EN:destination,PUBLICAR:false,master,featured_file};
 if(requested.some(d=>d!=='OPOL'))payload.hero_file=await image(heroPath,'hero');
 return {payload,files};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const args=process.argv.slice(2),options={};
  const keys={'--master':'masterPath','--hero':'heroPath','--featured':'featuredPath','--destination':'destination','--request-id':'requestId','--out':'out'};
  for(let i=0;i<args.length;i+=2){if(!keys[args[i]]||!args[i+1]||options[keys[args[i]]])throw Error('Argumentos inválidos');options[keys[args[i]]]=args[i+1];}
  const {out,...input}=options;if(!out)throw Error('Falta --out');
  const {payload,files}=await prepareLocalPayload(input);
  await writeFile(out,JSON.stringify(payload),{encoding:'utf8',mode:0o600,flag:'wx'});
  process.stdout.write(JSON.stringify({request_id:payload.request_id,destination:payload.CREAR_EN,publicar:false,payload_path:out,files})+'\n');
 }catch(error){process.stderr.write(error.code==='EEXIST'?'El paquete ya existe; no sobrescribir ni reenviar automáticamente.\n':'No se preparó el paquete: '+error.message+'\n');process.exitCode=1;}
}

