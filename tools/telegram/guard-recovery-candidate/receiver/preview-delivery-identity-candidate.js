// The identity comes from the existing authenticated Telegram receiver, not
// from the preview's source material. The guard recomputes the rendered text.
function preparePreviewIdentity(context,result){
 const p=result?.preview;
 if(!['PREVIEW_READY','PREVIEW_EXISTS'].includes(result?.status)||!context||typeof context.user_id!=='string'||context.user_id!==context.chat_id||!/^[1-9][0-9]{0,15}$/.test(context.user_id)||context.recovery_session!==true||
    !/^tg_[a-f0-9]{40}$/.test(context.packageId??'')||p?.packageId!==context.packageId||!Number.isSafeInteger(p.revision)||p.revision<1||!/^[a-f0-9]{64}$/.test(p.previewHash??''))
  return {status:'PREVIEW_NOT_CONFIRMED',reply_text:'No pude preparar una vista previa verificable. El paquete sigue abierto.'};
 return {status:'PREVIEW_IDENTITY_READY',owner:context.user_id,chat:context.chat_id,packageId:p.packageId,revision:p.revision,previewHash:p.previewHash};
}
return [{json:preparePreviewIdentity($('Resolver paquete Telegram').first(0,0).json,$input.first().json)}];
