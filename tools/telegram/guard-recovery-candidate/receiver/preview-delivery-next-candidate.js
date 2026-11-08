// Claim the next part only after the prior Telegram response was durably
// recorded. An absent or ambiguous response never causes an automatic resend.
function nextPreviewDelivery(identity,result){
 if(!identity||identity.status!=='PREVIEW_IDENTITY_READY'||typeof identity.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner)||!/^tg_[a-f0-9]{40}$/.test(identity.packageId??'')||!Number.isSafeInteger(identity.revision)||identity.revision<1||!/^[a-f0-9]{64}$/.test(identity.previewHash??''))return {status:'DELIVERY_UNCERTAIN',retryPermitted:false};
 if(!['DELIVERY_READY','DELIVERY_EXISTS','PART_REPORTED','PART_REPORTED_REPLAY'].includes(result?.status))return {status:'DELIVERY_UNCERTAIN',retryPermitted:false};
 return {status:'CLAIM_NEXT',body:{owner:identity.owner,chat:identity.chat,packageId:identity.packageId,revision:identity.revision,previewHash:identity.previewHash}};
}
return [{json:nextPreviewDelivery($('Preparar identidad de vista').first(0,0).json,$input.first().json)}];
