import {createHash} from 'node:crypto';

// Read-only reconciliation: an absent record is never permission to retry a
// WordPress write. The original worker might still be running or have timed out.
export async function inspectDirectReservation(pool, {requestId, fingerprint}) {
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(requestId) || (fingerprint !== undefined && (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)))) throw new Error('Solicitud inválida');
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT fingerprint,status,updated_at FROM opmx_mcp_requests WHERE request_id=?', [requestId]);
    if (!rows.length) return {status:'not_found',action:'manual_reconciliation'};
    if (fingerprint !== undefined && rows[0].fingerprint !== fingerprint) return {status:'identity_mismatch',action:'manual_reconciliation'};
    return {status:rows[0].status,identity:fingerprint === undefined ? 'unverified' : 'matched',action:'manual_reconciliation'};
  } catch { throw new Error('Resultado de consulta desconocido'); }
  finally { conn.release(); }
}

// Experimental: reserve an entire request and every destination in one InnoDB
// transaction. Failure after commit must never cause automatic resubmission.
export async function reserveDirectPublication(pool, {requestId, fingerprint, slug, destinations}) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(requestId) || !/^[a-f0-9]{64}$/.test(fingerprint) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 200 ||
      !Array.isArray(destinations) || !destinations.length || destinations.length > 2 ||
      new Set(destinations).size !== destinations.length || destinations.some(d => !['OPURO','OPOL'].includes(d))) throw new Error('Solicitud inválida');
  const keys = [...destinations].sort().map(d => createHash('sha256').update(`opmx:v1:${d}:${slug}`).digest('hex'));
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("INSERT INTO opmx_mcp_requests (request_id,fingerprint,status,result_json,updated_at) VALUES (?,?,'claimed',NULL,UTC_TIMESTAMP(6))",[requestId,fingerprint]);
    for (const key of keys) await conn.execute('INSERT INTO opmx_mcp_targets (target_key,request_id) VALUES (?,?)',[key,requestId]);
    await conn.commit();
    return {status:'claimed'};
  } catch (error) {
    try { await conn.rollback(); } catch { throw new Error('Resultado de reserva desconocido'); }
    if (error?.code==='ER_DUP_ENTRY' || error?.errno===1062) return {status:'conflict_or_replay', action:'reconcile'};
    throw new Error('Resultado de reserva desconocido');
  } finally { conn.release(); }
}
