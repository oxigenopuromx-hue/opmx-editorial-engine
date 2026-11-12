import {parseContentModeCommand} from '../original-destination-command.mjs';

export const literalReceiverNames=Object.freeze({normalize:'Normalizar entrada Telegram',prepare:'Preparar paquete Telegram',resolve:'Resolver paquete Telegram'});
const marker='CONTENT_MODE_CONTROL_V1';
const helper=parseContentModeCommand.toString();
const parseSafe="function contentModeCommand(s){try{return parseContentModeCommand(s)}catch{return null}}";
function once(source,before,after){if(source.split(before).length!==2)throw Error('LITERAL_RECEIVER_SOURCE_CHANGED');return source.replace(before,after)}

// Transform only the three known code nodes. The caller supplies the current
// active graph; unrelated draft code, sender configuration and credentials are
// never copied from an export or replaced by repository fixtures.
export function patchLiteralReceiverCode(name,source){
 if(typeof source!=='string'||source.includes(marker))throw Error('LITERAL_RECEIVER_SOURCE_CHANGED');
 let out=source;
 if(name===literalReceiverNames.normalize||name===literalReceiverNames.resolve){
  out=once(out,"function isMode(s) {",`// ${marker}\n${helper}\n${parseSafe}\nfunction isMode(s) {`);
  out=once(out,"function validControl(s) { return s==='/nuevo'||s==='/listo'||isMode(s); }","function validControl(s) { return ['/nuevo','/listo','/literal','/editorial'].includes(s)||isMode(s); }");
 }
 if(name===literalReceiverNames.normalize){
  const anchor=" if(!users.includes(identity.user_id)||!chats.includes(identity.chat_id))return null;";
  const authenticate=`${anchor}\n const contentControl=typeof m.text==='string'&&!m.document&&!m.photo?contentModeCommand(m.text):null;\n if(contentControl&&(['forward_origin','forward_date','forward_from','forward_from_chat','forward_sender_name','reply_to_message','external_reply','quote','edit_date'].some(key=>Object.hasOwn(m,key))||Object.hasOwn(update,'edited_message')))return {...identity,kind:'REJECTED',has_file:false,reply_text:'Escribe /literal o /editorial directamente como mensaje nuevo, sin reenviar, responder ni editar una fuente.'};`;
  out=once(out,anchor,authenticate);
  out=once(out,'||isMode(command)||isCorrectionOptions(command)','||isMode(command)||contentModeCommand(command)!==null||isCorrectionOptions(command)');
  out=once(out,"return {...identity,kind:'TEXT',has_file:false,text,mode_attested:modeAttested,reply_text:","return {...identity,kind:'TEXT',has_file:false,text,mode_attested:modeAttested||contentControl!==null,content_mode_command:contentControl?.command??null,reply_text:");
 }else if(name===literalReceiverNames.resolve){
  const check=" const x={...intent,packageId:result.packageId,package_revision:result.revision,requires_operation:true,recovery_session:result.recovery===true};";
  const replacement=`${check}\n if(x.content_mode_command!==undefined&&x.content_mode_command!==null){const content=contentModeCommand(x.text);if(x.kind!=='TEXT'||x.mode_attested!==true||!content||content.command!==x.content_mode_command)return response(intent,'No pude confirmar la selección del modo de contenido.');if(x.recovery_session)return response(intent,'En un paquete reabierto usa /opciones crear literal DESTINO o /opciones actualizar literal DESTINO, según la acción y los destinos que deseas confirmar. Para redacción usa editorial en lugar de literal.');}`;
  out=once(out,check,replacement);
  out=once(out,"text:x.mode_attested===true?(isMode(x.text.trim())?attestedControl(x.text.trim(),x.packageId,x.message_id):ORDER_PREFIX+x.text.trim()):x.text??''","text:x.mode_attested===true?(x.content_mode_command?attestedControl(x.content_mode_command,x.packageId,x.message_id):isMode(x.text.trim())?attestedControl(x.text.trim(),x.packageId,x.message_id):ORDER_PREFIX+x.text.trim()):x.text??''");
 }else if(name!==literalReceiverNames.prepare)throw Error('LITERAL_RECEIVER_NODE_UNKNOWN');
 if(name===literalReceiverNames.prepare||name===literalReceiverNames.resolve){
  out=once(out,'/imagen generar solicita una ilustración y no autoriza publicar.','Antes de /listo, /literal conserva título, subtítulos y cuerpo sin añadir texto; /editorial solicita redacción editorial. También puedes escribir tal cual como mensaje nuevo y separado. /imagen generar solicita una ilustración y no autoriza publicar.');
  if(name===literalReceiverNames.prepare)out=`// ${marker}\n${out}`;
 }
 return out;
}

export function buildLiteralReceiverOperations(graph){
 if(!Array.isArray(graph?.nodes)||graph.nodes.length!==52||!graph.connections||typeof graph.connections!=='object')throw Error('LITERAL_RECEIVER_GRAPH_CHANGED');
 return Object.values(literalReceiverNames).map(name=>{
  const nodes=graph.nodes.filter(n=>n.name===name);
  if(nodes.length!==1||nodes[0].type!=='n8n-nodes-base.code'||nodes[0].typeVersion!==2||![undefined,'runOnceForAllItems'].includes(nodes[0].parameters?.mode))throw Error('LITERAL_RECEIVER_NODE_CHANGED');
  return {type:'updateNodeParameters',nodeName:name,parameters:{...nodes[0].parameters,jsCode:patchLiteralReceiverCode(name,nodes[0].parameters.jsCode)},replace:true};
 });
}
