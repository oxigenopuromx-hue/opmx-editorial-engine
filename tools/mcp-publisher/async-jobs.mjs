import {fingerprint} from './idempotency.mjs';

// Internal backend contract, not an implementation of the n8n MCP client:
// start(payload) => {executionId}; read(executionId) => {state, result?}.
// The actual backend must authenticate, start exactly one execution, and only
// return a verified ID that belongs to the designated draft workflow.
export async function startDraft({ledger, requestId, input, prepare, start}) {
  const previous=await ledger.claim(requestId,fingerprint(input));
  if(previous.status==='complete') return {status:'complete',result:previous.result,replay:true};
  if(previous.status==='accepted') return {status:'pending',replay:true};
  if(previous.status==='failed_before_send') return {status:'failed_before_send',replay:true};
  if(previous.status!=='new') return {status:'needs_reconciliation',replay:true};
  let payload;
  try {payload=await prepare(input);} catch {await ledger.failBeforeSend(requestId);return {status:'failed_before_send'};}
  if(payload?.PUBLICAR!==false || !['OPURO','OPOL','AMBOS'].includes(payload?.CREAR_EN)) {
    await ledger.failBeforeSend(requestId);return {status:'failed_before_send'};
  }
  await ledger.markSent(requestId);
  let job;
  try {job=await start(payload);} catch {return {status:'needs_reconciliation'};}
  if(typeof job?.executionId!=='string' || !/^[A-Za-z0-9_-]{1,100}$/.test(job.executionId)) return {status:'needs_reconciliation'};
  // If persistence fails after start, the sent state is retained. No replay.
  try {await ledger.accept(requestId,{executionId:job.executionId,destination:payload.CREAR_EN});}
  catch {return {status:'needs_reconciliation'};}
  return {status:'pending',replay:false};
}

export async function queryDraft({ledger, requestId, read}) {
  const row=await ledger.getStatus(requestId);
  if(!row) return {status:'not_found'};
  if(row.status==='complete') return {status:'complete',result:row.result};
  if(row.status==='failed_before_send') return {status:'failed_before_send'};
  if(row.status!=='accepted') return {status:'needs_reconciliation'};
  let execution;
  try {execution=await read(row.result.executionId);} catch {return {status:'pending',check:'unavailable'};}
  if(['new','running','waiting'].includes(execution?.state)) return {status:'pending'};
  if(execution?.state!=='success') return {status:'needs_reconciliation'};
  const post=execution.result;
  const sites=row.result.destination==='AMBOS'?['opuro','opol']:row.result.destination==='OPURO'?['opuro']:['opol'];
  if(post?.status!=='SUCCESS'||post?.mode!=='DRAFT'||sites.some(s=>post?.summary?.[s]!=='DRAFT')) return {status:'needs_reconciliation'};
  const safe={status:'SUCCESS',mode:'DRAFT',summary:post.summary,edit_url_opuro:post.edit_url_opuro??null,edit_url_opol:post.edit_url_opol??null};
  try {await ledger.completeAccepted(requestId,safe);}
  catch {
    const current=await ledger.getStatus(requestId);
    if(current?.status!=='complete') return {status:'needs_reconciliation'};
    return {status:'complete',result:current.result};
  }
  return {status:'complete',result:safe};
}
