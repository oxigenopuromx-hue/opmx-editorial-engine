import {createHash} from 'node:crypto';
import {expectedDraftRequestId} from './correlation-candidate.mjs';

// Candidate only: registration must come from the trusted receiver in the
// same transaction as its outbox event. This schema is not a deployment.
export const requestBindingSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_request_binding_v1 (
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL,
 KEY package_revision (package_id,revision)
) ENGINE=InnoDB`;
export const requestClassificationSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_request_class_v1 (
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 kind VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
) ENGINE=InnoDB`;

// The caller must use a server-resolved destination and the transaction that
// seals the package; caller-supplied claims alone are not authorization.
export async function initializeRevisionFence(connection,{packageId,revision}) {
  if(!connection?.execute || typeof packageId!=='string'||!/^tg_[a-f0-9]{40}$/.test(packageId)||
     !Number.isSafeInteger(revision)||revision<1||revision>4294967295)throw Error('INVALID_REVISION');
  await connection.execute("INSERT INTO opmx_tg_publication_fence_v1 (package_id,revision,state,updated_at) VALUES (?,?,'READY_TO_WRITE',UTC_TIMESTAMP(6))",[packageId,revision]);
}

// Recovered revisions cannot be written until the specific Motor attempt has
// acknowledged the server-owned decision. Ordinary revisions retain their
// existing initial state.
export async function initializeDecisionPendingFence(connection,{packageId,revision}) {
  if(!connection?.execute||typeof packageId!=='string'||!/^tg_[a-f0-9]{40}$/.test(packageId)||!Number.isSafeInteger(revision)||revision<1||revision>4294967295)throw Error('INVALID_REVISION');
  await connection.execute("INSERT INTO opmx_tg_publication_fence_v1 (package_id,revision,state,updated_at) VALUES (?,?,'AWAITING_DECISION',UTC_TIMESTAMP(6))",[packageId,revision]);
}

// Register every prospective canonical destination label before making the
// ready event visible. The bindings do not grant editorial authorization: they
// only make delayed requests for this revision subject to the same fence.
// This function is meant to run inside the package seal transaction.
async function initializeBindings(connection,{packageId,revision},initializeFence) {
  await initializeFence(connection,{packageId,revision});
  for(const destination of ['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS']) {
    const requestId=expectedDraftRequestId({packageId,revision,destination});
    // Classification and binding are inserted with the fence in the same
    // transaction. A previously classified legacy request causes rollback.
    await connection.execute("INSERT INTO opmx_tg_request_class_v1 (request_id,kind) VALUES (?,'TELEGRAM')",[requestId]);
    await connection.execute('INSERT INTO opmx_tg_request_binding_v1 (request_id,package_id,revision) VALUES (?,?,?)',[requestId,packageId,revision]);
  }
}
export async function initializeRevisionBindings(connection,identity){return initializeBindings(connection,identity,initializeRevisionFence)}
export async function initializeDecisionPendingBindings(connection,identity){return initializeBindings(connection,identity,initializeDecisionPendingFence)}

// Claim a stable class under a transactional unique key before choosing a
// writer. A legacy claim that wins before sealing prevents that seal from
// creating a recoverable binding; the reverse ordering routes to the fence.
// Production still needs a migration of in-flight requests, all writer paths,
// and an authoritative reconciliation provider before enabling this router.
export function createClassifiedTargetRouter(beginLegacyTarget) {
  if(typeof beginLegacyTarget!=='function')throw Error('INVALID_ROUTER_CONFIGURATION');
  return async function route(pool,input) {
    const requestId=input?.requestId;
    if(!pool?.getConnection||typeof requestId!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(requestId))throw Error('INVALID_TARGET_REQUEST');
    const c=await pool.getConnection();let committed=false,kind;
    try {
      await c.beginTransaction();
      // The Telegram namespace can only be registered by package sealing.
      // An unknown or pre-existing LEGACY entry must never fall through to
      // a writer that does not hold the revision fence.
      const telegramNamespace=/^tg_[a-f0-9]{64}$/.test(requestId);
      if(!telegramNamespace)await c.execute("INSERT IGNORE INTO opmx_tg_request_class_v1 (request_id,kind) VALUES (?,'LEGACY')",[requestId]);
      const [rows]=await c.execute('SELECT kind FROM opmx_tg_request_class_v1 WHERE request_id=? FOR UPDATE',[requestId]);
      if(telegramNamespace&&(rows.length!==1||rows[0].kind!=='TELEGRAM')){await c.rollback();return {status:'NOT_BOUND',action:'manual_reconciliation'};}
      if(rows.length!==1||!['LEGACY','TELEGRAM'].includes(rows[0].kind))throw Error('INVALID_REQUEST_CLASS');
      kind=rows[0].kind;await c.commit();committed=true;
    } catch(error){if(!committed)try{await c.rollback()}catch{}throw Error('REQUEST_CLASS_UNCONFIRMED',{cause:error});}
    finally {c.release();}
    return kind==='TELEGRAM'?beginFencedTarget(pool,input):beginLegacyTarget(pool,input);
  };
}

// The binding is immutable. Never recreate a missing fence or bind after a
// recovery fence: a delayed worker must not regain permission on an old revision.
export async function bindTrustedRequestInTransaction(connection,{packageId,revision,destination,requestId}) {
  if(!connection?.execute || !Number.isSafeInteger(revision)||revision>4294967295 ||
     requestId!==expectedDraftRequestId({packageId,revision,destination}))throw Error('INVALID_BINDING');
  const [rows]=await connection.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
  if(rows.length!==1 || rows[0].state!=='READY_TO_WRITE')return false;
  await connection.execute("INSERT INTO opmx_tg_request_class_v1 (request_id,kind) VALUES (?,'TELEGRAM')",[requestId]);
  await connection.execute('INSERT INTO opmx_tg_request_binding_v1 (request_id,package_id,revision) VALUES (?,?,?)',[requestId,packageId,revision]);
  return true;
}

// Same target identity and insertion as the verified deployed target-progress
// module, with fence check and claim sharing one transaction. All entry points
// that can write must still participate; this helper alone is not protection.
export async function beginFencedTarget(pool,input) {
  const {requestId,slug,destination}=input??{};
  if(!pool?.getConnection || typeof requestId!=='string' || !/^[A-Za-z0-9_-]{16,128}$/.test(requestId) ||
    typeof slug!=='string'||slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||
    !['OPURO','OPOL','LIBERAL'].includes(destination)) throw Error('INVALID_TARGET_REQUEST');
  const targetKey=createHash('sha256').update(`opmx:v1:${destination}:${slug}`).digest('hex');
  const c=await pool.getConnection();let committed=false;
  try {
    await c.beginTransaction();
    // Discover the fence without locking the binding: reconciliation locks
    // the fence before the binding set. Revalidate under a lock after taking
    // the fence so the two paths have the same lock order.
    const [bindings]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=?',[requestId]);
    if(bindings.length!==1){await c.rollback();return {status:'NOT_BOUND',action:'manual_reconciliation'};}
    const b=bindings[0];
    const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[b.package_id,b.revision]);
    if(fences.length!==1 || !['READY_TO_WRITE','WRITING'].includes(fences[0].state)){
      await c.rollback();return {status:'WRITE_NOT_PERMITTED',action:'manual_reconciliation'};
    }
    const [confirmed]=await c.execute('SELECT package_id,revision FROM opmx_tg_request_binding_v1 WHERE request_id=? FOR UPDATE',[requestId]);
    if(confirmed.length!==1||confirmed[0].package_id!==b.package_id||Number(confirmed[0].revision)!==Number(b.revision)){
      await c.rollback();return {status:'NOT_BOUND',action:'manual_reconciliation'};
    }
    if(fences[0].state==='READY_TO_WRITE') {
      const [change]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='WRITING',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='READY_TO_WRITE'",[b.package_id,b.revision]);
      if(change.affectedRows!==1)throw Error('FENCE_CONFLICT');
    }
    const [insert]=await c.execute("INSERT INTO opmx_mcp_target_progress (target_key,request_id,destination,status,post_id,updated_at) SELECT target_key,request_id,?,'writing',NULL,UTC_TIMESTAMP(6) FROM opmx_mcp_targets WHERE target_key=? AND request_id=?",[destination,targetKey,requestId]);
    if(insert.affectedRows!==1){await c.rollback();return {status:'NOT_RESERVED',action:'manual_reconciliation'};}
    await c.commit();committed=true;return {status:'write_started'};
  } catch(error) {
    if(!committed)try{await c.rollback();}catch{}
    if(error?.code==='ER_DUP_ENTRY'||error?.errno===1062)return {status:'already_started',action:'manual_reconciliation'};
    throw Error('WRITE_START_UNCONFIRMED',{cause:error});
  } finally {c.release();}
}

