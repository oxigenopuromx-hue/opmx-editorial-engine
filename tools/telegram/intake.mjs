// H110 transport pilot. This receives one update; it is NOT a durable package
// store, MCP Events bridge, editorial generator or publication authorization.
export function normalizeTelegramUpdate(update,config={}) {
 const m=update?.message;
 if(!Number.isSafeInteger(update?.update_id)||!m||m.chat?.type!=='private'||m.from?.is_bot||!Number.isSafeInteger(m.from?.id)||!Number.isSafeInteger(m.chat?.id)||!Number.isSafeInteger(m.message_id))return null;
 const text=typeof m.text==='string'?m.text:typeof m.caption==='string'?m.caption:'';
 const identity={update_id:update.update_id,chat_id:String(m.chat.id),user_id:String(m.from.id),message_id:m.message_id,receipt_id:`telegram-${m.chat.id}-${m.message_id}-${update.update_id}`,media_group_id:typeof m.media_group_id==='string'?m.media_group_id:null};
 // Bootstrap command only echoes the sender's own IDs; never downloads content.
 if(text.trim()==='/id'&&!m.document&&!m.photo)return {...identity,kind:'IDENTITY',has_file:false,reply_text:`Tu ID de usuario: <code>${identity.user_id}</code>\nID de este chat: <code>${identity.chat_id}</code>\nEste piloto sólo confirma recepción; no genera ni publica notas.`};
 const users=(config.allowedUserIds??[]).map(String),chats=(config.allowedChatIds??[]).map(String);
 if(!users.includes(identity.user_id)||!chats.includes(identity.chat_id))return null;
 // Slash commands must be exact and independent messages; never save an invalid command as article text.
 if(typeof m.text==='string'&&!m.document&&!m.photo){
  const command=m.text.trim();
  const looksCommand=/^\/[a-z][a-z0-9_]*(?:@[a-z0-9_]+)?(?=\s|$)/i.test(command);
  const valid=/^(?:\/(?:id|start|ayuda|nuevo|listo|estado)|\/descartar ti_[a-f0-9]{40}|\/(?:publicar|borrador)(?:\s+(?:ambos|opuro|opol))?|\/imagen\s+generar)$/i.test(command);
  if(looksCommand&&!valid)return {...identity,kind:'REJECTED',has_file:false,reply_text:'Comando inválido. Usa /publicar ambos, /publicar opuro, /publicar opol o /borrador ambos. Escribe el comando correcto como mensaje aparte.'};
 }
 // Only commands typed directly by the authenticated operator select mode.
 if(typeof m.text==='string' && /^(?:\/(?:publicar|borrador)(?:\s+(?:ambos|opuro|opol))?$|\/imagen\s+generar$|(?:genera|generar|crea|crear)\s+(?:una\s+)?(?:imagen|ilustraci[oó]n)[^\n]{0,180}(?:\n|$))/i.test(m.text.trim()) && (m.forward_origin||m.forward_date||m.forward_from||m.forward_from_chat||m.forward_sender_name))return {...identity,kind:'REJECTED',has_file:false,reply_text:'Escribe el comando directamente; no lo reenvíes.'};
 if(typeof m.text==='string' && m.text.includes('OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d'))return {...identity,kind:'REJECTED',has_file:false,reply_text:'Mensaje no admitido.'};
 const modeAttested=typeof m.text==='string'&&!m.document&&!m.photo&&/^(?:\/(?:publicar|borrador)(?:\s+(?:ambos|opuro|opol))?$|\/imagen\s+generar$|(?:genera|generar|crea|crear)\s+(?:una\s+)?(?:imagen|ilustraci[oó]n)[^\n]{0,180}(?:\n|$))/i.test(m.text.trim());
 const maxBytes=config.maxBytes??10*1024*1024;
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>10*1024*1024)throw Error('Límite piloto inválido');
 let attachment=null;
 if(m.document){const d=m.document;const name=String(d.file_name??'').slice(0,240),mime=String(d.mime_type??'');
  const extensions={'application/pdf':['pdf'],'application/msword':['doc'],'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['docx'],'text/plain':['txt'],'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp']};
  const ext=name.split('.').at(-1).toLowerCase();
  if(!extensions[mime]?.includes(ext))return {...identity,kind:'REJECTED',has_file:false,reply_text:'Formato no admitido en este piloto. Envía PDF, DOC, DOCX, TXT, JPG, PNG o WEBP.'};
  attachment={file_id:d.file_id,file_unique_id:d.file_unique_id??null,file_name:name,mime_type:mime,declared_bytes:d.file_size??null};
 }else if(Array.isArray(m.photo)&&m.photo.length){
  const photos=m.photo.filter(p=>typeof p.file_id==='string'&&Number.isSafeInteger(p.width)&&Number.isSafeInteger(p.height));
  const p=photos.sort((a,b)=>b.width*b.height-a.width*a.height)[0];if(!p)return null;
  attachment={file_id:p.file_id,file_unique_id:p.file_unique_id??null,file_name:'telegram-photo.jpg',mime_type:'image/jpeg',declared_bytes:p.file_size??null};
 }
 if(attachment){if(typeof attachment.file_id!=='string'||!attachment.file_id||attachment.file_id.length>4096)return null;
  if(attachment.declared_bytes!==null&&(!Number.isSafeInteger(attachment.declared_bytes)||attachment.declared_bytes<1||attachment.declared_bytes>maxBytes))return {...identity,kind:'REJECTED',has_file:false,reply_text:'El archivo supera el límite piloto de 10 MiB o informa un tamaño inválido.'};
  return {...identity,kind:'FILE',has_file:true,text,attachment,max_bytes:maxBytes};
 }
 if(!text.trim())return {...identity,kind:'REJECTED',has_file:false,reply_text:'No pude procesar este tipo de mensaje. Si enviaste una imagen, mándala como archivo JPG, PNG o WEBP de hasta 10 MiB; espera la confirmación de guardado.'};
 return {...identity,kind:'TEXT',has_file:false,text,mode_attested:modeAttested,reply_text:'Texto recibido. Este piloto aún no agrupa paquetes, genera notas ni publica contenido.'};
}

export function validateTelegramDownload(input,bytes) {
 if(input?.kind!=='FILE'||!input.attachment||!bytes?.length||bytes.length>input.max_bytes)throw Error('Tamaño descargado inválido');
 const mime=input.attachment.mime_type;
 const starts=signature=>bytes.length>=signature.length&&signature.every((v,i)=>bytes[i]===v);
 const valid=mime==='application/pdf'?bytes.subarray(0,5).toString('ascii')==='%PDF-':mime==='application/msword'?starts([208,207,17,224,161,177,26,225]):mime==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'?starts([80,75,3,4]):mime==='image/jpeg'?starts([255,216,255]):mime==='image/png'?starts([137,80,78,71,13,10,26,10]):mime==='image/webp'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP':mime==='text/plain'?!bytes.includes(0):false;
 if(!valid)throw Error('La firma no corresponde al tipo declarado');
 // Signature recognition is not a full document parse or editorial validation.
 const safeName=input.attachment.file_name.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 return {...input,bytes_received:bytes.length,reply_text:`Archivo recibido: ${safeName}\nBytes comprobados: ${bytes.length}.\nPiloto de recepción: aún no se conserva el original, genera una nota ni envía al Motor.`};
}
