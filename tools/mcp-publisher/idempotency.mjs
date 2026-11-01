import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';

// SQLite is safe only where all server processes share the same durable file.
// Do not use per-instance or ephemeral serverless storage.
export function openRequestLedger(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS requests (
      request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL,
      status TEXT NOT NULL, result TEXT, updated_at TEXT NOT NULL
    )`);
  const get = db.prepare('SELECT fingerprint, status, result FROM requests WHERE request_id = ?');
  const insert = db.prepare("INSERT OR IGNORE INTO requests VALUES (?, ?, 'claimed', NULL, ?)");
  const finish = db.prepare('UPDATE requests SET status=?, result=?, updated_at=? WHERE request_id=? AND status=?');
  return {
    claim(id, fingerprint) {
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(id)) throw new Error('ID de solicitud inválido');
      const inserted = insert.run(id, fingerprint, new Date().toISOString()).changes === 1;
      const row = get.get(id);
      if (row.fingerprint !== fingerprint) throw new Error('ID de solicitud ya usado con otros datos');
      return inserted ? {status:'new'} : {status:row.status, result:row.result ? JSON.parse(row.result) : undefined};
    },
    markSent(id) {
      if (finish.run('sent', null, new Date().toISOString(), id, 'claimed').changes !== 1) throw new Error('Solicitud no disponible para envío');
    },
    complete(id, result) {
      if (finish.run('complete', JSON.stringify(result), new Date().toISOString(), id, 'sent').changes !== 1) throw new Error('Solicitud no disponible para completar');
    },
    failBeforeSend(id) {
      if (finish.run('failed_before_send', null, new Date().toISOString(), id, 'claimed').changes !== 1) throw new Error('Solicitud no disponible');
    },
    close() { db.close(); },
  };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function fingerprint(input) {
  // URLs are ephemeral and secret; file identities are stable across fresh URLs.
  const data = {master:input.master, destino:input.destino, hero:input.hero?.file_id ?? null, destacada:input.destacada?.file_id ?? null};
  return createHash('sha256').update(JSON.stringify(canonical(data))).digest('hex');
}

export async function runOnce({ledger, requestId, input, prepare, submit}) {
  const state = ledger.claim(requestId, fingerprint(input));
  if (state.status === 'complete') return {status:'complete', result:state.result, replay:true};
  if (state.status !== 'new') return {status:'needs_reconciliation', replay:true};
  let payload;
  try { payload = await prepare(input); }
  catch { ledger.failBeforeSend(requestId); return {status:'failed_before_send'}; }
  // Commit before dispatch: a crash/timeout thereafter has an unknown outcome.
  ledger.markSent(requestId);
  let result;
  try { result = await submit(payload); }
  catch { return {status:'needs_reconciliation'}; }
  if (!result || result.status !== 'SUCCESS' || result.mode !== 'DRAFT') return {status:'needs_reconciliation'};
  const safeResult = {status:result.status, mode:result.mode, summary:result.summary, edit_url_opuro:result.edit_url_opuro ?? null, edit_url_opol:result.edit_url_opol ?? null};
  ledger.complete(requestId, safeResult);
  return {status:'complete', result:safeResult, replay:false};
}
