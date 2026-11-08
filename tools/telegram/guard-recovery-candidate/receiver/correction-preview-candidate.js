function renderCorrectionPreview(result){
 const p=result?.preview,valid=/^tg_[a-f0-9]{40}$/.test(p?.packageId??'')&&Number.isSafeInteger(p?.revision)&&p.revision>0&&/^[a-f0-9]{64}$/.test(p?.previewHash??'')&&p.action==='CREATE'&&['LITERAL','EDITORIAL'].includes(p.mode)&&['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'].includes(p.destination)&&Array.isArray(p.posts)&&Array.isArray(p.changes)&&Array.isArray(p.materials)&&Array.isArray(p.controlItemIds)&&new Set(p.controlItemIds).size===p.controlItemIds.length;
 if(!['PREVIEW_READY','PREVIEW_EXISTS'].includes(result?.status)||!valid)return {status:'PREVIEW_NOT_CONFIRMED',messages:['No pude preparar una vista previa verificable. El paquete sigue abierto y no se envió al Motor.']};
 const controls=new Set(p.controlItemIds);
 const lines=[`Paquete: ${p.packageId}`,`Revisión: ${p.revision}`,`Acción: crear una nota nueva`,`Destinos: ${p.destination}`,`Modo: ${p.mode}`,`Identificadores de nota: aún no existen`,`Cambios:`];
 let changes=0;
 for(const x of p.changes){
  if(!/^ti_[a-f0-9]{40}$/.test(x?.itemId??'')||!['TEXT','FILE'].includes(x.kind)||!['ADDED','REMOVED'].includes(x.change)||!/^[a-f0-9]{64}$/.test(x.sha256??'')||(x.kind==='FILE'&&(typeof x.fileName!=='string'||typeof x.caption!=='string')))return {status:'PREVIEW_NOT_CONFIRMED',messages:['No pude preparar una vista previa verificable. El paquete sigue abierto y no se envió al Motor.']};
  if(controls.has(x.itemId))continue;
  changes++;lines.push(`${x.change==='ADDED'?'Agregado':'Retirado'} ${x.kind==='TEXT'?'texto':'archivo'} ${x.itemId}`);
  if(x.kind==='TEXT'&&typeof x.text==='string')lines.push(x.text);
  if(x.kind==='FILE'&&typeof x.fileName==='string')lines.push(`Nombre: ${x.fileName}`);
  if(x.kind==='FILE'&&typeof x.caption==='string'&&x.caption)lines.push(`Texto adjunto: ${x.caption}`);
 }
 if(!changes)lines.push('Sin cambios de material.');
 lines.push('Materiales activos de esta revisión (la nota final todavía no está generada):');
 let materials=0;const seen=new Set();
 for(const x of p.materials){
  if(!/^ti_[a-f0-9]{40}$/.test(x?.itemId??'')||seen.has(x.itemId)||!['TEXT','FILE'].includes(x.kind)||x.state!=='STORED'||!/^[a-f0-9]{64}$/.test(x.sha256??'')||(x.kind==='TEXT'&&typeof x.text!=='string')||(x.kind==='FILE'&&(typeof x.fileName!=='string'||typeof x.caption!=='string')))return {status:'PREVIEW_NOT_CONFIRMED',messages:['No pude preparar una vista previa verificable. El paquete sigue abierto y no se envió al Motor.']};
  seen.add(x.itemId);if(controls.has(x.itemId))continue;
  materials++;lines.push(`${x.kind==='TEXT'?'Texto':'Archivo'} ${x.itemId}\nSHA-256: ${x.sha256}`);if(x.kind==='TEXT')lines.push(x.text);
  if(x.kind==='FILE'&&typeof x.fileName==='string')lines.push(`Nombre: ${x.fileName}`);
  if(x.kind==='FILE'&&typeof x.caption==='string'&&x.caption)lines.push(`Texto adjunto: ${x.caption}`);
 }
 if(!materials||[...controls].some(id=>!seen.has(id)))return {status:'PREVIEW_NOT_CONFIRMED',messages:['No pude preparar una vista previa verificable. El paquete sigue abierto y no se envió al Motor.']};
 lines.push(`Para confirmar esta revisión, escribe:\n/confirmar crear ${p.revision} ${p.previewHash}`);
 // Escape one code point at a time so no HTML entity or surrogate pair is
 // split across Telegram messages. The caller must deliver all parts in order.
 const escape=c=>c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c;
 const chunks=[];let chunk='';for(const char of lines.join('\n\n')){const part=escape(char);if(chunk.length+part.length>3000){chunks.push(chunk);chunk=''}chunk+=part}if(chunk)chunks.push(chunk);
 return {status:'PREVIEW_RENDERED',packageId:p.packageId,revision:p.revision,messages:chunks,parse_mode:'HTML'};
}
return [{json:renderCorrectionPreview($input.first().json)}];
