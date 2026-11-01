import {createHash} from 'node:crypto';

// Experimental migration for the dedicated guard database only. Never delete
// ambiguous rows automatically: an upload may have succeeded after a timeout.
export const mediaSchemaSql = `CREATE TABLE opmx_mcp_media_progress (
 target_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 role VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 media_id BIGINT UNSIGNED NULL,
 updated_at DATETIME(6) NOT NULL,
 PRIMARY KEY (target_key, role), INDEX media_request (request_id)
) ENGINE=InnoDB`;

function targetKey({requestId,slug,destination,role}) {
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(requestId) ||
      typeof slug !== 'string' || slug.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      !['OPURO','OPOL'].includes(destination) ||
      !((destination === 'OPURO' && ['hero','featured'].includes(role)) || (destination === 'OPOL' && role === 'featured'))) throw new Error('Solicitud inválida');
  return createHash('sha256').update(`opmx:v1:${destination}:${slug}`).digest('hex');
}

// Only a target whose durable write has started can claim a media role. A
// duplicate or uncertain response never grants permission to upload again.
export async function beginMediaUpload(pool,input) {
  const key=targetKey(input),conn=await pool.getConnection();
  try {
    const [result]=await conn.execute(
      "INSERT INTO opmx_mcp_media_progress (target_key,request_id,role,status,media_id,updated_at) SELECT target_key,request_id,?,'uploading',NULL,UTC_TIMESTAMP(6) FROM opmx_mcp_target_progress WHERE target_key=? AND request_id=? AND destination=? AND status='writing'",
      [input.role,key,input.requestId,input.destination]);
    return result.affectedRows===1 ? {status:'upload_started'} : {status:'not_started',action:'manual_reconciliation'};
  } catch(error) {
    if(error?.code==='ER_DUP_ENTRY'||error?.errno===1062) return {status:'already_started',action:'manual_reconciliation'};
    // Preserve only a recognized database error class for server diagnostics;
    // never expose the driver's message, SQL, credentials, or request data.
    const diagnostic = ['ER_LOCK_WAIT_TIMEOUT', 'ER_LOCK_DEADLOCK', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ECONNREFUSED'].includes(error?.code) ? error.code : 'OTHER';
    const failure = new Error('Inicio de medio no confirmado');
    failure.diagnostic = diagnostic;
    throw failure;
  } finally {conn.release();}
}

// Reported IDs are claims by the worker, not proof of a WordPress attachment.
export async function recordMediaUpload(pool,input) {
  const key=targetKey(input);
  if(!Number.isSafeInteger(input.mediaId)||input.mediaId<1) throw new Error('Solicitud inválida');
  const conn=await pool.getConnection();
  try {
    const [result]=await conn.execute("UPDATE opmx_mcp_media_progress SET status='reported',media_id=?,updated_at=UTC_TIMESTAMP(6) WHERE target_key=? AND request_id=? AND role=? AND status='uploading'",[input.mediaId,key,input.requestId,input.role]);
    return result.affectedRows===1 ? {status:'media_reported',action:'verify_wordpress'} : {status:'not_updated',action:'manual_reconciliation'};
  } catch {throw new Error('Registro de medio no confirmado');}
  finally {conn.release();}
}

export async function inspectMediaUpload(pool,input) {
  const key=targetKey(input),conn=await pool.getConnection();
  try {
    const [rows]=await conn.execute('SELECT status,media_id FROM opmx_mcp_media_progress WHERE target_key=? AND request_id=? AND role=?',[key,input.requestId,input.role]);
    if(!rows.length) return {status:'not_found',action:'manual_reconciliation'};
    return {status:rows[0].status,mediaId:rows[0].media_id===null?null:String(rows[0].media_id),action:'manual_reconciliation'};
  } catch {throw new Error('Consulta de medio no confirmada');}
  finally {conn.release();}
}
