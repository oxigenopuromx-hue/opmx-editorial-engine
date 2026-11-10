import {backfillHistoricalFences} from './fence-backfill.mjs';

// During cutover, an old process might seal after the initial migration but
// before it is stopped. Resolve a missing Telegram binding from the durable
// event log, under the same quota lock as sealing, then enter the normal fence.
// Unknown IDs still fail closed; no caller may supply package/revision proof.
export function withCutoverBackfill(route,{backfill=backfillHistoricalFences}={}){
 if(typeof route!=='function'||typeof backfill!=='function')throw Error('CUTOVER_ROUTER_INVALID');
 return async function cutoverRoute(pool,input){
  const id=input?.requestId;
  if(typeof id!=='string'||!/^tg_[a-f0-9]{64}$/.test(id))return route(pool,input);
  if(!pool?.getConnection)throw Error('CUTOVER_ROUTER_INVALID');
  const c=await pool.getConnection();let rows;
  try{[rows]=await c.execute('SELECT request_id FROM opmx_tg_request_binding_v1 WHERE request_id=?',[id])}finally{c.release()}
  if(!Array.isArray(rows)||rows.length>1)throw Error('CUTOVER_BINDING_UNCONFIRMED');
  if(rows.length===0)await backfill(pool);
  // The wrapped handler rechecks binding, package state/revision, fence and
  // target under its own transaction. A failed backfill cannot grant writes.
  return route(pool,input);
 };
}
