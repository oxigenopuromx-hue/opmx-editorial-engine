// Experimental adapter for a dedicated MariaDB database. The pool must expose
// mysql2/promise-style execute(sql, params); it must NOT point to WordPress.
// No schema is created automatically. Backups and DB grants are operator tasks.
export const schemaSql = `CREATE TABLE opmx_mcp_requests (
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 result_json TEXT NULL,
 updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB`;
export const targetSchemaSql = `CREATE TABLE opmx_mcp_targets (
 target_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 INDEX request_target_owner (request_id)
) ENGINE=InnoDB`;

export function createMariaDbLedger(pool) {
  if (!pool || typeof pool.execute !== 'function') throw new Error('Pool MariaDB inválido');
  async function transition(id, from, to, result) {
    const [out] = await pool.execute('UPDATE opmx_mcp_requests SET status=?, result_json=?, updated_at=UTC_TIMESTAMP(6) WHERE request_id=? AND status=?', [to,result,id,from]);
    if (out.affectedRows !== 1) throw new Error('Solicitud no disponible');
  }
  return {
    async reserveTargets(id, keys) {
      if(typeof pool.getConnection!=='function') throw new Error('Transacciones MariaDB no disponibles');
      const connection=await pool.getConnection();
      try {
        await connection.beginTransaction();
        for(const key of keys) await connection.execute('INSERT INTO opmx_mcp_targets (target_key,request_id) VALUES (?,?)',[key,id]);
        await connection.commit();return true;
      } catch(error) {
        await connection.rollback();
        if(error?.code==='ER_DUP_ENTRY' || error?.errno===1062) return false;
        throw new Error('No se pudieron reservar los destinos');
      } finally {connection.release();}
    },
    async releaseTargets(id) { await pool.execute('DELETE FROM opmx_mcp_targets WHERE request_id=?',[id]); },
    async getStatus(id) {
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(id)) throw new Error('ID de solicitud inválido');
      const [rows] = await pool.execute('SELECT fingerprint,status,result_json FROM opmx_mcp_requests WHERE request_id=?',[id]);
      const row = rows[0];
      return row ? {status:row.status, result:row.result_json ? JSON.parse(row.result_json) : undefined} : null;
    },
    async claim(id, fingerprint) {
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(id) || !/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('ID o huella inválido');
      let inserted = true;
      try {
        await pool.execute("INSERT INTO opmx_mcp_requests (request_id,fingerprint,status,result_json,updated_at) VALUES (?,?,'claimed',NULL,UTC_TIMESTAMP(6))",[id,fingerprint]);
      } catch (error) {
        if (error?.code !== 'ER_DUP_ENTRY' && error?.errno !== 1062) throw new Error('No se pudo registrar la solicitud');
        inserted = false;
      }
      const [rows] = await pool.execute('SELECT fingerprint,status,result_json FROM opmx_mcp_requests WHERE request_id=?',[id]);
      const row=rows[0];
      if (!row || row.fingerprint !== fingerprint) throw new Error('ID de solicitud ya usado con otros datos');
      if (inserted) return {status:'new'};
      return {status:row.status,result:row.result_json ? JSON.parse(row.result_json) : undefined};
    },
    markSent(id) { return transition(id,'claimed','sent',null); },
    accept(id,job) { return transition(id,'sent','accepted',JSON.stringify(job)); },
    completeAccepted(id,result) { return transition(id,'accepted','complete',JSON.stringify(result)); },
    complete(id,result) { return transition(id,'sent','complete',JSON.stringify(result)); },
    failBeforeSend(id) { return transition(id,'claimed','failed_before_send',null); },
  };
}
