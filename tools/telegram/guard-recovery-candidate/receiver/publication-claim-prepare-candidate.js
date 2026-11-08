// Insert immediately after the existing combined WordPress preflight and
// before every publication write. This is candidate n8n Code node source.
const p=$input.first().json;
if(!p||typeof p!=='object'||typeof p.request_id!=='string'||typeof p.slug!=='string'||!Array.isArray(p.requested)||!p.targets)throw Error('PUBLICATION_PREFLIGHT_UNCONFIRMED');
if(!/^tg_[a-f0-9]{64}$/.test(p.request_id))return [{json:{claim_required:false,plan:p}}];
const seen=new Set(),targets=[];let writeNeeded=false;
for(const d of p.requested){const t=p.targets[d];if(!['OPURO','OPOL','LIBERAL'].includes(d)||seen.has(d)||!t||t.guard_verified!==true||!Number.isSafeInteger(t.post_id)||t.post_id<1||!['PUBLISHED','NOT_ATTEMPTED'].includes(t.status))throw Error('PUBLICATION_PREFLIGHT_UNCONFIRMED');seen.add(d);targets.push({destination:d,postId:t.post_id});if(t.status==='NOT_ATTEMPTED')writeNeeded=true}
if(!targets.length)throw Error('PUBLICATION_PREFLIGHT_UNCONFIRMED');
return [{json:writeNeeded?{claim_required:true,claim_body:{requestId:p.request_id,slug:p.slug,targets},plan:p}:{claim_required:false,plan:p}}];
