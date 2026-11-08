// Continue towards WordPress only after the guard reports the atomic claim.
// Any timeout, conflict or malformed result is an uncertain result, not retry.
const prepared=$('Preparar barrera publicación').first(0,0).json,response=$input.first().json;
if(!prepared?.claim_required||response?.status!=='PUBLICATION_STARTED'||!/^tg_[a-f0-9]{40}$/.test(response.packageId??'')||!Number.isSafeInteger(response.revision)||response.revision<1)throw Error('PUBLICATION_CLAIM_UNCONFIRMED');
return [{json:prepared.plan}];
