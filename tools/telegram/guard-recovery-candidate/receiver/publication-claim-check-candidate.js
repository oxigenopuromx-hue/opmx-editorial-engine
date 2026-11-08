// Continue towards WordPress only after the guard reports the atomic claim.
// Any timeout, conflict or malformed result is an uncertain result, not retry.
const prepared=$('Preparar barrera publicación').first(0,0).json,response=$input.first().json;
const targetSet=new Set((prepared?.claim_body?.targets??[]).map(x=>x.destination)),targetList=['OPURO','OPOL','LIBERAL'].filter(x=>targetSet.has(x));
const destination=targetList.length===3?'TODOS':targetList.join(',')==='OPURO,OPOL'?'AMBOS':targetList.join(',');
if(!prepared?.claim_required||!targetList.length||targetList.length!==targetSet.size||response?.status!=='PUBLICATION_STARTED'||response.requestId!==prepared.claim_body?.requestId||response.destination!==destination||!/^tg_[a-f0-9]{40}$/.test(response.packageId??'')||!Number.isSafeInteger(response.revision)||response.revision<1)throw Error('PUBLICATION_CLAIM_UNCONFIRMED');
return [{json:prepared.plan}];
