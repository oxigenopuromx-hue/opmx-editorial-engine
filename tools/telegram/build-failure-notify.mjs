import {readFileSync} from 'node:fs';

// Build only after reading the exact active H122 graph, identity and credentials.
// A failed or uncertain Telegram send is never retried automatically.
export function buildFailureOperations({baseProtocolCode,identity,guardCredential,telegramCredential}) {
 if(typeof baseProtocolCode!=='string'||!identity||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner??'')||!guardCredential?.id||!telegramCredential?.id)throw Error('Configuración inválida');
 const idx=baseProtocolCode.lastIndexOf('const identity=');
 if(idx<0||!baseProtocolCode.slice(idx).includes('classifyTelegramReview')||baseProtocolCode.includes('classifyTelegramFailure'))throw Error('Protocolo inesperado');
 const f=readFileSync(new URL('./failure-protocol.mjs',import.meta.url),'utf8').replaceAll('export function ','function ');
 const main=baseProtocolCode.slice(0,idx)+f+'\nconst identity='+JSON.stringify(identity)+';return [{json:classifyTelegramFailure($input.first().json,identity,x=>classifyTelegramReview(x,identity,y=>classifyTelegramEvents(y,identity,z=>classifyTelegramReader(z,identity,classifyFileMcp))))}];';
 const req="$('Protocolo MCP archivos').first().json.request";
 const add=(name,type,typeVersion,parameters,position,credentials)=>({type:'addNode',node:{name,type,typeVersion,parameters,position,...(credentials?{credentials}: {})}});
 const cond=(leftValue,rightValue)=>({conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue,rightValue,operator:typeof rightValue==='boolean'?{type:'boolean',operation:'true',singleValue:true}:{type:'string',operation:'equals'}}],combinator:'and'},options:{}});
 const link=(source,target,sourceIndex=0)=>({type:'addConnection',source,target,sourceIndex,targetIndex:0});
 return [
  {type:'updateNodeParameters',nodeName:'Protocolo MCP archivos',parameters:{mode:'runOnceForAllItems',jsCode:main}},
  add('¿Informar bloqueo Telegram?','n8n-nodes-base.if',2.2,cond('={{ $json.route }}','telegram-failure'),[300,-1250]),
  add('Consultar paquete para bloqueo','n8n-nodes-base.httpRequest',4.3,{method:'POST',url:'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/manifest',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:`={{ JSON.stringify({owner:${req}.body.owner,chat:${req}.body.chat,packageId:${req}.body.packageId}) }}`,options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},[520,-1250],{httpHeaderAuth:guardCredential}),
  add('Preparar aviso de bloqueo','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:f+`\nreturn [{json:prepareTelegramFailure(${req},$input.first().json)}];`},[740,-1250]),
  add('¿Enviar aviso de bloqueo?','n8n-nodes-base.if',2.2,cond('={{ $json.send }}',true),[960,-1250]),
  add('Enviar bloqueo privado Telegram','n8n-nodes-base.telegram',1.2,{resource:'message',operation:'sendMessage',chatId:'={{ $json.chatId }}',text:'={{ $json.text }}',additionalFields:{appendAttribution:false,disable_web_page_preview:true,parse_mode:'HTML'}},[1180,-1250],{telegramApi:telegramCredential}),
  add('Resultado de bloqueo Telegram','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:f+`\nreturn [{json:formatTelegramFailure(${req},$input.first().json)}];`},[1400,-1250]),
  add('Bloqueo no confirmado','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:f+`\nreturn [{json:formatTelegramFailure(${req},{})}];`},[1620,-1250]),
  ...['Consultar paquete para bloqueo','Enviar bloqueo privado Telegram'].map(nodeName=>({type:'setNodeSettings',nodeName,settings:{onError:'continueRegularOutput',retryOnFail:false}})),
  {type:'removeConnection',source:'¿Notificación MCP?',target:'¿Informar revisión Telegram?',sourceIndex:1,targetIndex:0},
  link('¿Notificación MCP?','¿Informar bloqueo Telegram?',1),link('¿Informar bloqueo Telegram?','Consultar paquete para bloqueo'),link('¿Informar bloqueo Telegram?','¿Informar revisión Telegram?',1),
  link('Consultar paquete para bloqueo','Preparar aviso de bloqueo'),link('Preparar aviso de bloqueo','¿Enviar aviso de bloqueo?'),link('¿Enviar aviso de bloqueo?','Enviar bloqueo privado Telegram'),link('¿Enviar aviso de bloqueo?','Bloqueo no confirmado',1),link('Enviar bloqueo privado Telegram','Resultado de bloqueo Telegram'),link('Resultado de bloqueo Telegram','Responder MCP'),link('Bloqueo no confirmado','Responder MCP')
 ];
}
