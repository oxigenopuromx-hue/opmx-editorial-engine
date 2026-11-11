const sites=['OPURO','OPOL','LIBERAL'];
const resultKeys={OPURO:'oxigenopuro',OPOL:'oxigenopolitico',LIBERAL:'elliberal'};
const labels=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];

// Embed these pure functions in the existing n8n writer. Source text cannot
// choose a callback, destination credential, package, revision or result ID.
export function prepareWriterReceipt(result){
 const skip=()=>({receiptRequired:false,result});
 const r=result?.response?.result?.structuredContent??result;
 if(!r||r.status!=='SUCCESS'||!/^tg_[a-f0-9]{64}$/.test(r.request_id??'')||!['DRAFT','PUBLISH'].includes(r.mode)||!labels.includes(r.destino))return skip();
 const requested=r.destino==='TODOS'?sites:r.destino==='AMBOS'?['OPURO','OPOL']:r.destino.split(',');
 let slug=null;const targets=[];
 for(const destination of requested){
  const t=r.targets?.[r.mode==='DRAFT'?resultKeys[destination]:destination],postId=t?.post_id;
  const currentSlug=r.mode==='DRAFT'?t?.slug:r.slug;
  if(!t||!Number.isSafeInteger(postId)||postId<1||t.status!==(r.mode==='DRAFT'?'DRAFT':'PUBLISHED')||r.mode==='PUBLISH'&&t.cms_verified!==true||typeof currentSlug!=='string'||currentSlug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(currentSlug)||slug!==null&&slug!==currentSlug)return skip();
  slug=currentSlug;targets.push({destination,postId});
 }
 return {receiptRequired:true,body:{requestId:r.request_id,phase:r.mode,slug,targets},result};
}

export function finishWriterReceipt(prepared,response){
 if(prepared?.receiptRequired!==true)return prepared?.result;
 const ok=['WRITER_RECEIPT_RECORDED','WRITER_RECEIPT_REPLAY'].includes(response?.status)&&response.requestId===prepared.body.requestId&&response.phase===prepared.body.phase&&/^tg_[a-f0-9]{40}$/.test(response.packageId??'')&&Number.isSafeInteger(response.revision)&&response.revision>0&&/^[a-f0-9]{64}$/.test(response.receiptHash??'');
 const result=JSON.parse(JSON.stringify(prepared.result)),target=result?.response?.result;
 if(target?.structuredContent){target.structuredContent={...target.structuredContent,telegram_writer_receipt:ok?'RECORDED':'UNCERTAIN'};target.content=[{type:'text',text:JSON.stringify(target.structuredContent)}]}
 else if(result&&typeof result==='object')result.telegram_writer_receipt=ok?'RECORDED':'UNCERTAIN';
 return result;
}
