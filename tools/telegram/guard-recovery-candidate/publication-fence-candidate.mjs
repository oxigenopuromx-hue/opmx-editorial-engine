// Candidate protocol only. This table is not installed and existing Publisher
// writers do not yet participate. Never activate recovery until they all do.
export const publicationFenceSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_publication_fence_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL,
 state VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 updated_at DATETIME(6) NOT NULL,
 PRIMARY KEY(package_id,revision)
) ENGINE=InnoDB`;

function valid(id,revision) {
  return typeof id==='string'&&/^tg_[a-f0-9]{40}$/.test(id)&&Number.isSafeInteger(revision)&&revision>0&&revision<=4294967295;
}

// Candidate only. Freeze a never-started revision before asking independent
// systems for evidence. Recovery must leave this row frozen on uncertainty;
// automatically expiring it would permit a delayed worker to race recovery.
export async function freezeForReview(pool,id,revision) {
  if(!pool?.getConnection||!valid(id,revision))throw Error('INVALID_FENCE_REQUEST');
  const c=await pool.getConnection();let committed=false;
  try {
    await c.beginTransaction();
    const [r]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='RECONCILING',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='READY_TO_WRITE'",[id,revision]);
    await c.commit();committed=true;
    return r.affectedRows===1?{status:'FROZEN_FOR_REVIEW'}:{status:'RECONCILIATION_REQUIRED'};
  } catch(error){if(!committed)try{await c.rollback()}catch{}throw error;}
  finally{c.release();}
}

// Evidence must be gathered by a trusted server provider; this primitive is not
// exposed to the caller or a proof that evidence is complete. The fence and
// evidence transition must be part of one server-owned transaction.
export async function confirmReconciledInTransaction(connection,id,revision,evidence) {
  if(!connection?.execute||!valid(id,revision))throw Error('INVALID_FENCE_REQUEST');
  if(!evidence || evidence.packageId!==id || evidence.revision!==revision ||
     evidence.terminalBlocked!==true || evidence.noActiveAttempts!==true ||
     evidence.noPublicationSideEffects!==true || evidence.allWritersParticipate!==true)return false;
  const [r]=await connection.execute("UPDATE opmx_tg_publication_fence_v1 SET state='SAFE_TO_REOPEN',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='RECONCILING'",[id,revision]);
  return r.affectedRows===1;
}

// Called on the very same connection and transaction used to reopen. A row
// may be marked SAFE_TO_REOPEN only by trusted reconciliation after all previous
// workers are quiescent and all side effects have been ruled out.
export async function claimFenceInTransaction(connection,id,revision) {
  if(!connection?.execute||!valid(id,revision))throw Error('INVALID_FENCE_REQUEST');
  const [result]=await connection.execute("UPDATE opmx_tg_publication_fence_v1 SET state='RECOVERY_FENCED',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='SAFE_TO_REOPEN'",[id,revision]);
  return result.affectedRows===1;
}

// A participating writer claims BEFORE any WordPress or media write, retains
// WRITING across network calls, and never silently clears it on timeout/crash.
// Every production writer and the recovery transaction must use this protocol.
export async function beginPublicationAttempt(pool,id,revision) {
  if(!pool?.getConnection||!valid(id,revision))throw Error('INVALID_FENCE_REQUEST');
  const c=await pool.getConnection();let committed=false;
  try {
    await c.beginTransaction();
    const [result]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='WRITING',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='READY_TO_WRITE'",[id,revision]);
    await c.commit();committed=true;
    return result.affectedRows===1?{status:'WRITE_STARTED'}:{status:'WRITE_NOT_PERMITTED'};
  } catch(error) {if(!committed)try{await c.rollback();}catch{}throw error;}
  finally{c.release();}
}
