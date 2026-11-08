function destinationRegistry() {
 return {
  OPURO:{cms:'https://cms.oxigenopuro.com.mx',publicOrigin:'https://oxigenopuro.com.mx',resultKey:'oxigenopuro',postIdKey:'post_id_opuro',heroMeta:'oxpuro_hero_media_id',editorialMeta:'oxpuro_editorial',hero:true},
  OPOL:{cms:'https://cms.oxigenopolitico.com.mx',publicOrigin:'https://oxigenopolitico.com.mx',resultKey:'oxigenopolitico',postIdKey:'post_id_opol',hero:false},
  LIBERAL:{cms:'https://cms.elliberal.mx',publicOrigin:'https://elliberal.mx',resultKey:'elliberal',postIdKey:'post_id_liberal',heroMeta:'liberalmx_hero_media_id',editorialMeta:'liberalmx_editorial',hero:true},
 };
}
function resolveDestinations(value) {
 if(Array.isArray(value)){if(!value.every(v=>typeof v==='string'))throw Error('Destino inválido');value=value.join(',');}
 if(typeof value!=='string'||!value.trim()||value.length>256)throw Error('Destino inválido');
 const registry=destinationRegistry(),selected=new Set();
 for(const item of value.split(',')){
  const token=item.trim().toUpperCase();if(!token)throw Error('Destino vacío entre comas');
  const expanded=token==='AMBOS'?['OPURO','OPOL']:token==='TODOS'?Object.keys(registry):[token];
  for(const destination of expanded){if(!Object.hasOwn(registry,destination))throw Error('Destino desconocido: '+destination);selected.add(destination);}
 }
 return Object.keys(registry).filter(d=>selected.has(d));
}
function destinationLabel(destinations) {
 const all=Object.keys(destinationRegistry()),set=new Set(destinations),items=all.filter(d=>set.has(d));
 if(items.length!==set.size||!items.length)throw Error('Destino inválido');
 if(items.length===all.length)return 'TODOS';
 if(items.length===2&&items[0]==='OPURO'&&items[1]==='OPOL')return 'AMBOS';
 return items.join(',');
}
function parseDestinationCommand(text) {
  if (typeof text !== 'string') throw Error('INVALID_COMMAND');
  const match = /^\/(publicar|borrador)(?:[ \t]+([A-Za-z0-9_, ]+))?$/i.exec(text.trim());
  if (!match) throw Error('INVALID_COMMAND');
  const destinations = resolveDestinations(match[2] ?? 'TODOS');
  return { mode: match[1].toLowerCase() === 'publicar' ? 'PUBLISH' : 'DRAFT',
    destination: destinationLabel(destinations), destinations };
}
function isMode(s) { try { parseDestinationCommand(s); return true; } catch { return false; } }
function isCorrectionOptions(s) { const m=/^\/opciones[ \t]+(literal|editorial)[ \t]+([A-Za-z, ]+)$/i.exec(s);if(!m)return false;try{resolveDestinations(m[2]);return true}catch{return false} }
function isCorrectionConfirmation(s) { return /^\/confirmar[ \t]+crear[ \t]+[1-9][0-9]{0,9}[ \t]+[a-f0-9]{64}$/i.test(s); }
function validControl(s) { return s==='/nuevo'||s==='/listo'||isMode(s); }
function normalizeTelegramUpdate(update,config={}) {
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
  const valid=/^\/(?:id|start|ayuda|nuevo|listo|estado)$/.test(command)||/^\/descartar ti_[a-f0-9]{40}$/.test(command)||/^\/abrir[ \t]+tg_[a-f0-9]{40}$/.test(command)||isMode(command)||isCorrectionOptions(command)||isCorrectionConfirmation(command)||/^\/imagen\s+generar$/i.test(command);
  if(looksCommand&&!valid)return {...identity,kind:'REJECTED',has_file:false,reply_text:'Comando inválido. Usa /publicar o /borrador con opuro, opol, liberal, ambos, todos o una lista separada por comas. Escribe el comando correcto como mensaje aparte.'};
 }
 // Only commands typed directly by the authenticated operator select mode.
 if(typeof m.text==='string' && (isMode(m.text.trim()) || isCorrectionOptions(m.text.trim()) || isCorrectionConfirmation(m.text.trim()) || /^\/abrir[ \t]+tg_[a-f0-9]{40}$/.test(m.text.trim()) || /^\/(?:nuevo|listo)$/i.test(m.text.trim()) || /^(?:\/imagen\s+generar$|(?:genera|generar|crea|crear)\s+(?:una\s+)?(?:imagen|ilustraci[oó]n)[^\n]{0,180}(?:\n|$))/i.test(m.text.trim())) && (m.forward_origin||m.forward_date||m.forward_from||m.forward_from_chat||m.forward_sender_name))return {...identity,kind:'REJECTED',has_file:false,reply_text:'Escribe el comando directamente; no lo reenvíes.'};
 if(typeof m.text==='string' && m.text.includes('OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d'))return {...identity,kind:'REJECTED',has_file:false,reply_text:'Mensaje no admitido.'};
 const modeAttested=typeof m.text==='string'&&!m.document&&!m.photo&&(isMode(m.text.trim()) || isCorrectionOptions(m.text.trim()) || isCorrectionConfirmation(m.text.trim()) || /^\/abrir[ \t]+tg_[a-f0-9]{40}$/.test(m.text.trim()) || /^\/(?:nuevo|listo)$/i.test(m.text.trim()) || /^(?:\/imagen\s+generar$|(?:genera|generar|crea|crear)\s+(?:una\s+)?(?:imagen|ilustraci[oó]n)[^\n]{0,180}(?:\n|$))/i.test(m.text.trim()));
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
const x=$input.first().json;const r=normalizeTelegramUpdate(x.update,x.config);return r?[{json:r}]:[];
