// Only a completed Telegram-origin draft request can produce a notification.
// Destination and text are fixed by the service, never supplied by a source.
export function prepareDraftNotification(response, request, identity) {
 const no = {notify:false, response};
 if (!identity || typeof identity.chat !== 'string' || identity.chat !== identity.owner || !/^[1-9][0-9]{0,15}$/.test(identity.chat)) return no;
 if (request?.operation !== 'preparar_borrador_opmx' || !/^tg_[a-f0-9]{64}$/.test(request.request_id ?? '') || !['OPURO','OPOL','AMBOS'].includes(request.destino)) return no;
 const result=response?.response?.result;
 const v=result?.structuredContent;
 if (result?.isError !== false || v?.status !== 'SUCCESS' || v.mode !== 'DRAFT' || v.request_id !== request.request_id) return no;
 const required=request.destino==='AMBOS'?['opuro','opol']:[request.destino.toLowerCase()];
 const urls=[];
 for(const site of required) {
  const id=v[`post_id_${site}`], given=v[`edit_url_${site}`];
  if(v.summary?.[site]!=='DRAFT' || !Number.isSafeInteger(id) || id<1) return no;
  const base=site==='opuro'?'https://cms.oxigenopuro.com.mx':'https://cms.oxigenopolitico.com.mx';
  const canonical=`${base}/wp-admin/post.php?post=${id}&action=edit`;
  if(given!==canonical) return no;
  urls.push(`${site==='opuro'?'OXígeno Puro':'OXígeno Político'}: ${canonical}`);
 }
 return {notify:true,chatId:identity.chat,text:`OPMX · Borrador listo\n\n${urls.join('\n')}\n\nLas notas están en borrador y no se han publicado.`,response};
}

export function finishDraftNotification(context, telegramResult) {
 const m=telegramResult?.result??telegramResult;
 const sent=String(m?.chat?.id)===context.chatId && Number.isSafeInteger(m?.message_id) && m.message_id>0;
 const response=context.response;
 if(!response?.response?.result?.structuredContent) return response;
 const result=response.response.result;
 result.structuredContent={...result.structuredContent,telegram_draft_notice:sent?'SENT':'UNCERTAIN',telegram_notice_retry:false};
 result.content=[{type:'text',text:JSON.stringify(result.structuredContent)}];
 return response;
}

