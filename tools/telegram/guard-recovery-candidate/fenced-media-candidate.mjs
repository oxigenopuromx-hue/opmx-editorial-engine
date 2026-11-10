import {createHash} from 'node:crypto';

// Only server-registered Telegram requests may use this route. Legacy requests
// continue through their existing media guard, but an unknown tg_ request never
// falls back to it. Classification is stable because a request class is unique.
export function createClassifiedMediaRouter(beginLegacyMedia){
 if(typeof beginLegacyMedia!=='function')throw Error('INVALID_ROUTER_CONFIGURATION');
 return async function route(pool,input){
  const id=input?.requestId;
  if(!pool?.getConnection||typeof id!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(id))throw Error('INVALID_MEDIA_REQUEST');
  const c=await pool.getConnection();let committed=false,kind;
  try{
   await c.beginTransaction();
   const telegram=/^tg_/i.test(id);
   if(!telegram)await c.execute("INSERT IGNORE INTO opmx_tg_request_class_v1 (request_id,kind) VALUES (?,'LEGACY')",[id]);
   const [rows]=await c.execute('SELECT kind FROM opmx_tg_request_class_v1 WHERE request_id=? FOR UPDATE',[id]);
   if(telegram&&(rows.length!==1||rows[0].kind!=='TELEGRAM')){await c.rollback();return {status:'NOT_BOUND',action:'manual_reconciliation'}}
   if(rows.length!==1||!['LEGACY','TELEGRAM'].includes(rows[0].kind))throw Error('INVALID_REQUEST_CLASS');
   kind=rows[0].kind;await c.commit();committed=true;
  }catch(error){if(!committed)try{await c.rollback()}catch{}throw Error('REQUEST_CLASS_UNCONFIRMED',{cause:error})}finally{c.release()}
  return kind==='TELEGRAM'?beginFencedMedia(pool,input):beginLegacyMedia(pool,input);
 };
}

// A successful target claim sets WRITING. Lock that fence before the binding,
// target and media rows, so recovery cannot cross an in-flight upload. A lost
// response is uncertain and never authorizes another upload.
export async function beginFencedMedia(pool,input){
 const {requestId,slug,destination,role}=input??{};
 if(!pool?.getConnection||typeof requestId!=='string'||!/^tg_[a-f0-9]{64}$/.test(requestId)||typeof slug!=='string'||slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!(['OPURO','LIBERAL'].includes(destination)&&['hero','featured'].includes(role)||destination==='OPOL'&&role==='featured'))throw Error('INVALID_MEDIA_REQUEST');
 const key=createHash('sha256').update(`opmx:v1:${destination}:${slug}`).digest('hex'),c=await pool.getConnection();let committed=false,phase='begin';
 try{
  await c.beginTransaction();
  const [binding]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=?',[requestId]);
  if(binding.length!==1){await c.rollback();return {status:'NOT_BOUND',action:'manual_reconciliation'}}
  const b=binding[0];
  const [packages]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[b.package_id]);
  if(packages.length!==1||packages[0].state!=='READY'||Number(packages[0].revision)!==Number(b.revision)){await c.rollback();return {status:'WRITE_NOT_PERMITTED',action:'manual_reconciliation'}}
  const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[b.package_id,b.revision]);
  if(fences.length!==1||fences[0].state!=='WRITING'){await c.rollback();return {status:'WRITE_NOT_PERMITTED',action:'manual_reconciliation'}}
  const [again]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=? FOR UPDATE',[requestId]);
  if(again.length!==1||again[0].package_id!==b.package_id||Number(again[0].revision)!==Number(b.revision)){await c.rollback();return {status:'NOT_BOUND',action:'manual_reconciliation'}}
  const [target]=await c.execute("SELECT target_key FROM opmx_mcp_target_progress WHERE target_key=? AND request_id=? AND destination=? AND status='writing' FOR UPDATE",[key,requestId,destination]);
  if(target.length!==1){await c.rollback();return {status:'not_started',action:'manual_reconciliation'}}
  phase='insert';const [insert]=await c.execute("INSERT INTO opmx_mcp_media_progress (target_key,request_id,role,status,media_id,updated_at) VALUES (?,?,?,'uploading',NULL,UTC_TIMESTAMP(6))",[key,requestId,role]);
  if(insert.affectedRows!==1)throw Error('MEDIA_INSERT_UNCONFIRMED');
  phase='commit';await c.commit();committed=true;return {status:'upload_started'};
 }catch(error){if(!committed)try{await c.rollback()}catch{}if(phase==='insert'&&(error?.code==='ER_DUP_ENTRY'||error?.errno===1062))return {status:'already_started',action:'manual_reconciliation'};throw Error('MEDIA_START_UNCONFIRMED',{cause:error})}finally{c.release()}
}
