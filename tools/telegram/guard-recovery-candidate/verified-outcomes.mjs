// Validate and copy only server-reconciled outcomes. This function cannot
// establish authenticity or provide a fence: the calling guard provider must
// hold both. Unknown, missing and trashed posts are never treated as absent.
export function copyVerifiedOutcomes(destinations,outcomes){
 if(!Array.isArray(destinations)||!destinations.length||new Set(destinations).size!==destinations.length||!Array.isArray(outcomes)||outcomes.length!==destinations.length||new Set(outcomes.map(x=>x?.destination)).size!==destinations.length||outcomes.some(x=>!x||!destinations.includes(x.destination)))return null;
 const result=[];
 for(const destination of destinations){
  const x=outcomes.find(v=>v.destination===destination);
  if(x.status==='BLOCKED'&&x.publicationVerdict==='NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'){result.push({destination,status:x.status,publicationVerdict:x.publicationVerdict});continue}
  if(!['PUBLISHED','DRAFT'].includes(x.status)||x.publicationVerdict!=='CMS_RECORD_CONFIRMED'||x.cmsVerified!==true||(x.status==='PUBLISHED'?x.wordpressStatus!=='publish':x.wordpressStatus!=='draft')||!Number.isSafeInteger(x.postId)||x.postId<1||typeof x.slug!=='string'||x.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.slug))return null;
  if(x.ledgerRequestId!==undefined&&!/^tg_[a-f0-9]{64}$/.test(x.ledgerRequestId))return null;
  result.push({...(x.ledgerRequestId?{ledgerRequestId:x.ledgerRequestId}:{}),destination,status:x.status,publicationVerdict:x.publicationVerdict,cmsVerified:true,wordpressStatus:x.wordpressStatus,postId:x.postId,slug:x.slug});
 }
 return result;
}
