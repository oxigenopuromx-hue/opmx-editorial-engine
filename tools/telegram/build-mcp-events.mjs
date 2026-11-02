import {classifyFileMcp} from '../mcp-publisher/files-mcp-protocol.mjs';
import {classifyTelegramReader} from './mcp-reader.mjs';
import {classifyTelegramEvents,formatTelegramEventResult} from './event-protocol.mjs';

export function buildTelegramEventOperations({identity,guardCredential}) {
 if(typeof identity?.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner)||!guardCredential?.id||!guardCredential?.name)throw Error('Observar identidad y credencial existentes');
 const classifier=[classifyFileMcp,classifyTelegramReader,classifyTelegramEvents].map(x=>x.toString()).join('\n')+`\nconst identity=${JSON.stringify(identity)}; return [{json:classifyTelegramEvents($input.first().json,identity,x=>classifyTelegramReader(x,identity,classifyFileMcp))}];`;
 const format=formatTelegramEventResult.toString()+`\nreturn [{json:formatTelegramEventResult($('Protocolo MCP archivos').first(0,0).json.request,$input.first().json)}];`;
 return [
  {type:'updateNodeParameters',nodeName:'Protocolo MCP archivos',parameters:{mode:'runOnceForAllItems',jsCode:classifier}},
  {type:'addNode',node:{name:'¿Suscripción evento Telegram?',type:'n8n-nodes-base.if',typeVersion:2.2,position:[448,-640],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:'={{ $json.route }}',rightValue:'telegram-events',operator:{type:'string',operation:'equals'}}],combinator:'and'},options:{}}}},
  {type:'addNode',node:{name:'Gestionar evento privado guard',type:'n8n-nodes-base.httpRequest',typeVersion:4.3,position:[672,-640],parameters:{method:'POST',url:"={{ 'https://publisher.oxigenopuro.com.mx/v1/telegram/events/' + $json.request.action }}",authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify($json.request.body) }}',options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},credentials:{httpHeaderAuth:guardCredential}}},
  {type:'setNodeSettings',nodeName:'Gestionar evento privado guard',settings:{onError:'continueRegularOutput',retryOnFail:false}},
  {type:'addNode',node:{name:'Formatear suscripción evento MCP',type:'n8n-nodes-base.code',typeVersion:2,position:[896,-640],parameters:{mode:'runOnceForAllItems',jsCode:format}}},
  {type:'removeConnection',source:'¿Notificación MCP?',target:'¿Leer fuente Telegram?',sourceIndex:1,targetIndex:0},
  {type:'addConnection',source:'¿Notificación MCP?',target:'¿Suscripción evento Telegram?',sourceIndex:1,targetIndex:0},
  {type:'addConnection',source:'¿Suscripción evento Telegram?',target:'Gestionar evento privado guard',sourceIndex:0,targetIndex:0},
  {type:'addConnection',source:'¿Suscripción evento Telegram?',target:'¿Leer fuente Telegram?',sourceIndex:1,targetIndex:0},
  {type:'addConnection',source:'Gestionar evento privado guard',target:'Formatear suscripción evento MCP',sourceIndex:0,targetIndex:0},
  {type:'addConnection',source:'Formatear suscripción evento MCP',target:'Responder MCP',sourceIndex:0,targetIndex:0}
 ];
}
