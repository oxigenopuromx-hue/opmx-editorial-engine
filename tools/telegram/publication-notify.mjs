// A verified Publisher result is the only source of publication status and URLs.
export function preparePublicationNotice(response,request,identity) {
 const no={notify:false,response};
 if(!identity||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.chat??''))return no;
 if(request?.operation!=='publicar_nota_opmx'||request.confirmar_publicacion!=='PUBLICAR'||!/^tg_[a-f0-9]{64}$/.test(request.request_id??'')||!['OPURO','OPOL','AMBOS'].includes(request.destino))return no;
 const r=response?.response?.result?.structuredContent;
 if(!r||r.mode!=='PUBLISH'||r.request_id!==request.request_id||r.destino!==request.destino||!['SUCCESS','PUBLISHED_VISIBILITY_PENDING','PARTIAL_SUCCESS','UNCERTAIN'].includes(r.status)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug??''))return no;
 const destinations=request.destino==='AMBOS'?['OPURO','OPOL']:[request.destino];const lines=[];
 for(const site of destinations){
  const t=r.targets?.[site],name=site==='OPURO'?'OXígeno Puro':'OXígeno Político';
  if(!t||!['PUBLISHED','UNCERTAIN','NOT_ATTEMPTED'].includes(t.status))return no;
  if(t.status==='PUBLISHED'){
   if(t.cms_verified!==true||!Number.isSafeInteger(t.post_id)||t.post_id<1)return no;
   {
    const origin=site==='OPURO'?'https://oxigenopuro.com.mx/':'https://oxigenopolitico.com.mx/';
    const path=typeof t.public_url==='string'&&t.public_url.startsWith(origin)?t.public_url.slice(origin.length):'';
    if(!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?$/.test(path)||path.replace(/\/$/,'').split('/').at(-1)!==r.slug)return no;
    lines.push(`${name}: publicado en WordPress\n${t.public_url}`);
   }
  } else lines.push(`${name}: ${t.status==='UNCERTAIN'?'resultado incierto; revisar antes de repetir':'publicación no iniciada'}.`);
 }
 const warning=destinations.some(d=>r.targets[d].status!=='PUBLISHED')?'\n\nNo vuelvas a enviarla si algún resultado está pendiente o incierto.':'';
 return {notify:true,chatId:identity.chat,text:`OPMX · Resultado de publicación\n\n${lines.join('\n\n')}${warning}`,response};
}
export function finishPublicationNotice(context,telegramResult){
 const m=telegramResult?.result??telegramResult,sent=String(m?.chat?.id)===context.chatId&&Number.isSafeInteger(m?.message_id)&&m.message_id>0;
 const response=context.response,result=response?.response?.result;
 if(!result?.structuredContent)return response;
 result.structuredContent={...result.structuredContent,telegram_publication_notice:sent?'SENT':'UNCERTAIN',telegram_notice_retry:false};
 result.content=[{type:'text',text:JSON.stringify(result.structuredContent)}];return response;
}
