// The guard returns one claimed part at a time. Only these mapped fields may
// go to Telegram; the capability token remains inside the trusted workflow.
function preparePreviewSend(identity,claim){
 if(!identity||typeof identity.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.chat)||!/^tg_[a-f0-9]{40}$/.test(identity.packageId??'')||!Number.isSafeInteger(identity.revision)||identity.revision<1||!/^[a-f0-9]{64}$/.test(identity.previewHash??''))return {status:'DELIVERY_UNCERTAIN',retryPermitted:false};
 if(claim?.status==='DELIVERY_COMPLETE')return {status:'DELIVERY_COMPLETE'};
 if(claim?.status!=='PART_CLAIMED'||!Number.isSafeInteger(claim.part)||claim.part<1||!Number.isSafeInteger(claim.parts)||claim.part>claim.parts||!/^[a-f0-9]{64}$/.test(claim.token??'')||typeof claim.text!=='string'||!claim.text.length||claim.text.length>3000||claim.parseMode!=='HTML')return {status:'DELIVERY_UNCERTAIN',retryPermitted:false};
 return {status:'SEND_READY',identity,claim,telegram:{chatId:identity.chat,text:claim.text,parseMode:'HTML'}};
}
return [{json:preparePreviewSend($('Preparar identidad de vista').first(0,0).json,$input.first().json)}];
