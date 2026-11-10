import {expectedDraftRequestId} from './correlation-candidate.mjs';

const labels=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
const valid=(id,revision)=>/^tg_[a-f0-9]{40}$/.test(id??'')&&Number.isSafeInteger(revision)&&revision>0&&revision<=4294967295;

// Populate historical event bindings while the caller holds the same quota
// lock used by the package store. This records identities, not a proof of
// safety or termination. Existing fences and claims are never reset.
// All schema DDL must be installed separately before this transaction.
export async function backfillHistoricalFences(pool){
 if(!pool?.getConnection)throw Error('FENCE_BACKFILL_CONFIGURATION_INVALID');
 const c=await pool.getConnection();let done=false;
 try{
  await c.beginTransaction();
  const [quota]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');
  if(quota.length!==1)throw Error('QUOTA_MISSING');
  const [events]=await c.execute('SELECT event_id,package_id,revision FROM opmx_tg_events_v1 ORDER BY package_id,revision,event_id FOR UPDATE');
  const revisions=new Map();
  for(const row of events){
   const revision=Number(row.revision),id=row.package_id;
   if(!valid(id,revision)||!/^evt_[a-f0-9]{48}$/.test(row.event_id??''))throw Error('HISTORICAL_EVENT_INVALID');
   const key=`${id}:${revision}`,prior=revisions.get(key);
   if(prior&&prior!==row.event_id)throw Error('HISTORICAL_EVENT_CONFLICT');
   revisions.set(key,row.event_id);
  }
  for(const [key] of revisions){
   const sep=key.lastIndexOf(':'),id=key.slice(0,sep),revision=Number(key.slice(sep+1));
   // Historical state is UNKNOWN, not READY_TO_WRITE or SAFE_TO_REOPEN.
   // A separate, authoritative reconciliation must classify each revision.
   await c.execute("INSERT IGNORE INTO opmx_tg_publication_fence_v1 (package_id,revision,state,updated_at) VALUES (?,?,'HISTORICAL_UNRECONCILED',UTC_TIMESTAMP(6))",[id,revision]);
   for(const destination of labels){
    const requestId=expectedDraftRequestId({packageId:id,revision,destination});
    await c.execute("INSERT IGNORE INTO opmx_tg_request_class_v1 (request_id,kind) VALUES (?,'TELEGRAM')",[requestId]);
    const [classes]=await c.execute('SELECT kind FROM opmx_tg_request_class_v1 WHERE request_id=? FOR UPDATE',[requestId]);
    if(classes.length!==1||classes[0].kind!=='TELEGRAM')throw Error('HISTORICAL_CLASS_CONFLICT');
    await c.execute('INSERT IGNORE INTO opmx_tg_request_binding_v1 (request_id,package_id,revision) VALUES (?,?,?)',[requestId,id,revision]);
    const [bindings]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=? FOR UPDATE',[requestId]);
    if(bindings.length!==1||bindings[0].package_id!==id||Number(bindings[0].revision)!==revision)throw Error('HISTORICAL_BINDING_CONFLICT');
   }
  }
  await c.commit();done=true;return {status:'HISTORICAL_BINDINGS_RECORDED',revisions:revisions.size,recoveryEnabled:false};
 }catch(error){if(!done)try{await c.rollback()}catch{}throw error}finally{c.release()}
}
