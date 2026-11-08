// Input is exclusively the Telegram node's response to the claimed message;
// never construct this from a user message or source material. A missing or
// mismatched response remains uncertain and must not be resent automatically.
function preparePreviewReceipt(context,result){
 const c=context?.claim,x=context?.identity,m=result?.result??result;
 if(c?.status!=='PART_CLAIMED'||!Number.isSafeInteger(c.part)||c.part<1||!Number.isSafeInteger(c.parts)||c.part>c.parts||!/^[a-f0-9]{64}$/.test(c.token??'')||
    typeof x?.owner!=='string'||x.owner!==x.chat||!/^[1-9][0-9]{0,15}$/.test(x.owner)||!/^tg_[a-f0-9]{40}$/.test(x.packageId??'')||!Number.isSafeInteger(x.revision)||x.revision<1||!/^[a-f0-9]{64}$/.test(x.previewHash??'')||
    !m||String(m.chat?.id)!==x.chat||!Number.isSafeInteger(m.message_id)||m.message_id<1)
  return {status:'DELIVERY_UNCERTAIN',retryPermitted:false};
 return {status:'RECEIPT_READY',body:{...x,part:c.part,token:c.token,telegramChat:x.chat,telegramMessageId:m.message_id}};
}
return [{json:preparePreviewReceipt($('Preparar envío de vista').first(0,0).json,$input.first().json)}];
