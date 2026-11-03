const rows=$input.all().map(x=>x.json);const groups=new Map();
for(const r of rows){if(!/^tg_[a-f0-9]{40}$/.test(r.package_id??'')||!Number.isSafeInteger(r.revision)||!Number.isSafeInteger(r.id))continue;const k=r.package_id+':'+r.revision;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
const terminal=new Set(['PROCESS_COMPLETE','SOURCE_UNAVAILABLE','CONTENT_INSUFFICIENT','MEDIA_FAILED','VALIDATION_FAILED','DRAFT_FAILED','DRAFT_UNCERTAIN','INTERNAL_ERROR']);
const labels={QUEUED:'paquete cerrado, pendiente de iniciar el Motor',PROGRESS_START:'revisión de fuentes',PROGRESS_WRITING:'redacción de la nota',PROGRESS_IMAGE:'preparación de imagen',PROGRESS_SUBMIT:'espera del resultado de Publisher'};
const out=[];for(const entries of groups.values()){
 const owners=new Set(entries.filter(x=>['QUEUED','ROUTING'].includes(x.stage)&&typeof x.chat_id==='string'&&/^[1-9][0-9]{0,15}$/.test(x.chat_id)).map(x=>x.chat_id));
 if(owners.size!==1)continue;
 let stages=entries.filter(x=>x.stage!=='ROUTING'&&!String(x.stage).startsWith('ALERT_')).sort((a,b)=>a.id-b.id);
 if(stages.some(x=>x.stage!=='QUEUED'))stages=stages.filter(x=>x.stage!=='QUEUED');const last=stages.at(-1);
 if(!last||terminal.has(last.stage)||!labels[last.stage]||Date.now()-Date.parse(last.occurred_at)<600000)continue;
 if(entries.some(x=>x.stage==='ALERT_'+last.id))continue;const chat=[...owners][0];
 out.push({json:{package_id:last.package_id,revision:last.revision,stage:'ALERT_'+last.id,occurred_at:new Date().toISOString(),chat_id:chat,text:'OPMX · resultado pendiente\n\nÚltima etapa: '+labels[last.stage]+'. Han pasado al menos 10 minutos sin una actualización confirmada. No puedo saber todavía si sigue trabajando o se detuvo, ni confirmar publicación; es necesario revisar el estado antes de volver a enviar.\n\nPaquete: '+last.package_id+', versión '+last.revision+'.'}});
}return out.slice(0,20);