const envelope=$('MCP Publisher POST').first().json;let message=envelope?.body??envelope;if(typeof message==='string'){try{message=JSON.parse(message)}catch{message={}}}
const args=message?.params?.arguments??{},rows=$input.all().map(x=>x.json);
const subscriber={owner:'255516723',chat:'255516723'},privateTools=new Set(['leer_paquete_telegram_opmx','leer_fuente_telegram_opmx','informar_revision_telegram_opmx','informar_bloqueo_telegram_opmx','iniciar_intento_telegram_opmx','bloquear_intento_telegram_opmx']);
const valid=s=>typeof s==='string'&&/^[1-9][0-9]{0,15}$/.test(s);
let identity=subscriber,noticeIdentity=null;
if(message.method==='tools/call'&&privateTools.has(message.params?.name)){
 const all=rows.filter(r=>r.package_id===args.package_id&&['QUEUED','ROUTING'].includes(r.stage));
 // ROUTING is recorded at the original /nuevo, before an administrator can reopen.
 // QUEUED may name the later editor, so use it only if no original route exists.
 const routing=all.filter(r=>r.stage==='ROUTING');
 const matches=routing.length?routing:all.filter(r=>r.stage==='QUEUED');
 const owners=new Set(matches.filter(r=>valid(r.chat_id)).map(r=>r.chat_id));
 identity=matches.some(r=>!valid(r.chat_id))||owners.size>1?null:owners.size===1?{owner:[...owners][0],chat:[...owners][0]}:subscriber;
}
if(message.method==='tools/call'&&/^(preparar_borrador_opmx|publicar_nota_opmx)$/.test(message.params?.name??'')&&typeof args.request_id==='string'){
 const matches=rows.filter(r=>r.request_id===args.request_id&&r.stage==='REQUEST_'+args.destino);
 const invalid=matches.some(r=>!valid(r.chat_id)||!/^tg_[a-f0-9]{40}$/.test(r.package_id??'')||!Number.isSafeInteger(r.revision));
 const keys=new Set(matches.map(r=>r.package_id+':'+r.revision+':'+r.chat_id));
 if(matches.length&&!invalid&&keys.size===1){noticeIdentity={owner:matches[0].chat_id,chat:matches[0].chat_id};}
}
return [{json:{envelope,identity,noticeIdentity}}];
