import { createHash } from 'node:crypto';

// Rows must come from a trusted intake registry after Telegram authentication.
// Never pass user-supplied text, captions or request payload as registry rows.
export function ownerForPackage(rows, packageId, revision) {
  if (!/^tg_[a-f0-9]{40}$/.test(packageId) || !Number.isSafeInteger(revision) || revision < 1 || !Array.isArray(rows)) throw Error('Invalid package');
  const matches = rows.filter(r => r && r.package_id === packageId && r.revision === revision && ['QUEUED','ROUTING'].includes(r.stage) && r.chat_id != null);
  if (!matches.length) throw Error('Operator not found');
  const ids = new Set(matches.map(r => {
    if (typeof r.chat_id !== 'string' || !/^[1-9][0-9]{0,15}$/.test(r.chat_id)) throw Error('Invalid operator');
    return r.chat_id;
  }));
  if (ids.size !== 1) throw Error('Conflicting operators');
  const owner = [...ids][0];
  return { owner, chat: owner };
}

export function ownerForRequest(rows, requestId) {
  if (!/^tg_[a-f0-9]{64}$/.test(requestId) || !Array.isArray(rows)) throw Error('Invalid request');
  const matches = rows.filter(r => r && ['QUEUED','ROUTING'].includes(r.stage) && r.chat_id != null && ['AMBOS', 'OPURO', 'OPOL'].some(destination => {
    if (!/^tg_[a-f0-9]{40}$/.test(r.package_id ?? '') || !Number.isSafeInteger(r.revision) || r.revision < 1) return false;
    return 'tg_' + createHash('sha256').update(`${r.package_id}:${r.revision}:${destination}:draft-v1`).digest('hex') === requestId;
  }));
  if (!matches.length) throw Error('Request not found');
  const keys = new Set(matches.map(r => `${r.package_id}:${r.revision}`));
  if (keys.size !== 1) throw Error('Ambiguous request');
  return ownerForPackage(matches, matches[0].package_id, matches[0].revision);
}
