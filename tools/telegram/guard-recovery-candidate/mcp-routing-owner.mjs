// Rows come from the private reception ledger. The original opening is
// immutable ownership evidence; later administrator ALREADY_OPEN records are
// not ownership transfers. Any non-admin conflict remains a hard failure.
export function originalRoutingIdentity(rows,packageId,subscriber){
 const valid=s=>typeof s==='string'&&/^[1-9][0-9]{0,15}$/.test(s);
 const relevant=rows.filter(r=>r.package_id===packageId&&['QUEUED','ROUTING'].includes(r.stage)),routing=relevant.filter(r=>r.stage==='ROUTING'),matches=routing.length?routing:relevant.filter(r=>r.stage==='QUEUED');
 if(!matches.length)return subscriber;
 if(matches.some(r=>!valid(r.chat_id)))return null;
 const owners=new Set(matches.map(r=>r.chat_id));if(owners.size===1)return {owner:matches[0].chat_id,chat:matches[0].chat_id};
 if(matches.some(r=>!Number.isSafeInteger(Number(r.id))||Number(r.id)<1)||new Set(matches.map(r=>Number(r.id))).size!==matches.length)return null;
 const first=matches.slice().sort((a,b)=>Number(a.id)-Number(b.id))[0];
 if(matches.some(r=>r.chat_id!==first.chat_id&&r.chat_id!==subscriber.owner))return null;
 return {owner:first.chat_id,chat:first.chat_id};
}
