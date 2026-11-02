import {classifyFileMcp} from '../mcp-publisher/files-mcp-protocol.mjs';
import {classifyTelegramReader} from './mcp-reader.mjs';
import {classifyTelegramEvents} from './event-protocol.mjs';
import {classifyTelegramReview,telegramReviewAck,formatTelegramReviewResult} from './review-protocol.mjs';
export function buildTelegramReviewOperations({identity,guardCredential,telegramCredential}) {
 if(typeof identity?.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner)||!guardCredential?.id||!telegramCredential?.id)throw Error('Observar identidad y credenciales existentes');
 const ops=[],add=node=>ops.push({type:'addNode',node}),conn=(source,target,sourceIndex=0)=>ops.push({type:'addConnection',source,target,sourceIndex,targetIndex:0});
 const source=[classifyFileMcp,classifyTelegramReader,classifyTelegramEvents,classifyTelegramReview].map(f=>f.toString()).join('\n')+`\nconst identity=${JSON.stringify(identity)};return [{json:classifyTelegramReview($input.first().json,identity,x=>classifyTelegramEvents(x,identity,y=>classifyTelegramReader(y,identity,classifyFileMcp)))}];`;
 ops.push({type:'updateNodeParameters',nodeName:'Protocolo MCP archivos',parameters:{mode:'runOnceForAllItems',jsCode:source}});
 const conditional=(name,value,expected,x)=>add({name,type:'n8n-nodes-base.if',typeVersion:2.2,position:[x,-960],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:value,rightValue:expected,operator:{type:'string',operation:'equals'}}],combinator:'and'},options:{}}});
 const http=(name,action,body,x)=>{add({name,type:'n8n-nodes-base.httpRequest',typeVersion:4.3,position:[x,-960],parameters:{method:'POST',url:'https://publisher.oxigenopuro.com.mx/v1/telegram/reviews/'+action,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:body,options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},credentials:{httpHeaderAuth:guardCredential}});ops.push({type:'setNodeSettings',nodeName:name,settings:{onError:'continueRegularOutput',retryOnFail:false}});};
 conditional('¿Informar revisión Telegram?','={{ $json.route }}','telegram-review',448);
 http('Reservar informe Telegram guard','begin','={{ JSON.stringify($json.request.body) }}',672);
 conditional('¿Enviar informe Telegram?','={{ $json.status }}','SEND_REVIEW',896);
 add({name:'Enviar revisión privada Telegram',type:'n8n-nodes-base.telegram',typeVersion:1.2,position:[1120,-960],parameters:{resource:'message',operation:'sendMessage',chatId:'={{ $json.chatId }}',text:'={{ $json.text }}',additionalFields:{appendAttribution:false,disable_web_page_preview:true,parse_mode:'HTML'}},credentials:{telegramApi:telegramCredential}});
 ops.push({type:'setNodeSettings',nodeName:'Enviar revisión privada Telegram',settings:{onError:'continueRegularOutput',retryOnFail:false}});
 add({name:'Verificar acuse revisión Telegram',type:'n8n-nodes-base.code',typeVersion:2,position:[1344,-960],parameters:{mode:'runOnceForAllItems',jsCode:telegramReviewAck.toString()+`\nreturn [{json:telegramReviewAck($('Protocolo MCP archivos').first(0,0).json.request,$input.first().json)}];`}});
 http('Confirmar informe Telegram guard','report','={{ JSON.stringify($json) }}',1568);
 add({name:'Resultado revisión privada MCP',type:'n8n-nodes-base.code',typeVersion:2,position:[1792,-960],parameters:{mode:'runOnceForAllItems',jsCode:formatTelegramReviewResult.toString()+`\nreturn [{json:formatTelegramReviewResult($('Protocolo MCP archivos').first(0,0).json.request,$input.first().json)}];`}});
 ops.push({type:'removeConnection',source:'¿Notificación MCP?',target:'¿Suscripción evento Telegram?',sourceIndex:1,targetIndex:0});
 conn('¿Notificación MCP?','¿Informar revisión Telegram?',1);conn('¿Informar revisión Telegram?','Reservar informe Telegram guard');conn('¿Informar revisión Telegram?','¿Suscripción evento Telegram?',1);conn('Reservar informe Telegram guard','¿Enviar informe Telegram?');conn('¿Enviar informe Telegram?','Enviar revisión privada Telegram');conn('¿Enviar informe Telegram?','Resultado revisión privada MCP',1);conn('Enviar revisión privada Telegram','Verificar acuse revisión Telegram');conn('Verificar acuse revisión Telegram','Confirmar informe Telegram guard');conn('Confirmar informe Telegram guard','Resultado revisión privada MCP');conn('Resultado revisión privada MCP','Responder MCP');
 return ops;
}
