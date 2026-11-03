import {prepareDraftNotification,finishDraftNotification} from './draft-notify.mjs';

// Apply only to the H122 files-MCP graph after confirming active version and credentials.
export function buildDraftNotifyOperations({identity,telegramCredential}) {
 if (!identity || identity.owner !== identity.chat || !/^[1-9][0-9]{0,15}$/.test(identity.owner ?? '') || !telegramCredential?.id) throw Error('Identidad o credencial inválida');
 const functions=[prepareDraftNotification,finishDraftNotification].map(f=>f.toString()).join('\n');
 const prep=functions+`\nconst request=$('Protocolo MCP archivos').first().json.request;const identity=${JSON.stringify(identity)};return [{json:prepareDraftNotification($input.first().json,request,identity)}];`;
 const done=functions+`\nreturn [{json:finishDraftNotification($('Preparar aviso de borrador Telegram').first().json,$input.first().json)}];`;
 const add=(name,type,typeVersion,parameters,position,credentials)=>({type:'addNode',node:{name,type,typeVersion,parameters,position,...(credentials?{credentials}: {})}});
 const connect=(source,target,sourceIndex=0)=>({type:'addConnection',source,target,sourceIndex,targetIndex:0});
 return [
  add('Preparar aviso de borrador Telegram','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:prep},[2100,400]),
  add('¿Avisar borrador por Telegram?','n8n-nodes-base.if',2.2,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:'={{ $json.notify }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},[2320,400]),
  add('Enviar enlaces de borrador Telegram','n8n-nodes-base.telegram',1.2,{resource:'message',operation:'sendMessage',chatId:'={{ $json.chatId }}',text:'={{ $json.text }}',additionalFields:{appendAttribution:false,disable_web_page_preview:true}},[2540,300],{telegramApi:telegramCredential}),
  add('Confirmar aviso borrador Telegram','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:done},[2770,300]),
  add('Pasar respuesta Publisher sin aviso','n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode:'return [{json:$input.first().json.response}];'},[2540,500]),
  {type:'setNodeSettings',nodeName:'Enviar enlaces de borrador Telegram',settings:{onError:'continueRegularOutput',retryOnFail:false}},
  {type:'removeConnection',source:'Resultado Publisher MCP',target:'Responder MCP',sourceIndex:0,targetIndex:0},
  connect('Resultado Publisher MCP','Preparar aviso de borrador Telegram'),
  connect('Preparar aviso de borrador Telegram','¿Avisar borrador por Telegram?'),
  connect('¿Avisar borrador por Telegram?','Enviar enlaces de borrador Telegram'),
  connect('¿Avisar borrador por Telegram?','Pasar respuesta Publisher sin aviso',1),
  connect('Enviar enlaces de borrador Telegram','Confirmar aviso borrador Telegram'),
  connect('Confirmar aviso borrador Telegram','Responder MCP'),
  connect('Pasar respuesta Publisher sin aviso','Responder MCP')
 ];
}
