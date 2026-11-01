import {createHash} from 'node:crypto';

// Experimental, separate migration: install only in the dedicated ledger DB.
// Rows are never deleted automatically. A writing row is deliberately ambiguous
// until the operator reconciles it with the corresponding WordPress and worker.
export const progressSchemaSql = `CREATE TABLE opmx_mcp_target_progress (
 target_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 destination VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 post_id BIGINT UNSIGNED NULL,
 updated_at DATETIME(6) NOT NULL,
 INDEX request_progress (request_id)
) ENGINE=InnoDB`;

function identity({requestId, slug, destination}) {
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(requestId) ||
      typeof slug !== 'string' || slug.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      !['OPURO', 'OPOL'].includes(destination)) throw new Error('Solicitud inválida');
  return createHash('sha256').update(`opmx:v1:${destination}:${slug}`).digest('hex');
}

// A successful claim permits exactly one worker to start a remote write. A
// timeout or duplicate cannot be treated as permission to repeat the write.
export async function beginTargetWrite(pool, input) {
  const key = identity(input);
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      "INSERT INTO opmx_mcp_target_progress (target_key,request_id,destination,status,post_id,updated_at) SELECT target_key,request_id,?,'writing',NULL,UTC_TIMESTAMP(6) FROM opmx_mcp_targets WHERE target_key=? AND request_id=?",
      [input.destination,key,input.requestId]);
    return result.affectedRows === 1 ? {status:'write_started'} : {status:'not_reserved',action:'manual_reconciliation'};
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) return {status:'already_started',action:'manual_reconciliation'};
    throw new Error('Inicio de escritura no confirmado');
  } finally { conn.release(); }
}

// This only records what the worker reported; independent WP readback is
// required before presenting a draft as confirmed. A failed update is unknown.
export async function recordTargetPost(pool, input) {
  const key = identity(input);
  if (!Number.isSafeInteger(input.postId) || input.postId <= 0) throw new Error('Solicitud inválida');
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      "UPDATE opmx_mcp_target_progress SET status='reported',post_id=?,updated_at=UTC_TIMESTAMP(6) WHERE target_key=? AND request_id=? AND destination=? AND status='writing'",
      [input.postId,key,input.requestId,input.destination]);
    return result.affectedRows === 1 ? {status:'post_reported',action:'verify_wordpress'} : {status:'not_updated',action:'manual_reconciliation'};
  } catch { throw new Error('Registro de resultado no confirmado'); }
  finally { conn.release(); }
}

export async function inspectTargetProgress(pool, input) {
  const key = identity(input);
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT status,post_id FROM opmx_mcp_target_progress WHERE target_key=? AND request_id=? AND destination=?', [key,input.requestId,input.destination]);
    if (!rows.length) return {status:'not_found',action:'manual_reconciliation'};
    return {status:rows[0].status,postId:rows[0].post_id === null ? null : String(rows[0].post_id),action:'manual_reconciliation'};
  } catch { throw new Error('Consulta de avance no confirmada'); }
  finally { conn.release(); }
}
