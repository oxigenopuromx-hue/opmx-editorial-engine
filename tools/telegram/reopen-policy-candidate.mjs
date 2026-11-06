// Pure decision logic for a future transactional guard. No I/O or authorization
// is performed here: the caller must supply trusted, freshly locked records.
const PACKAGE = /^tg_[a-f0-9]{40}$/;
const ID = /^[1-9][0-9]{0,15}$/;

export function parseOpenCommand(text) {
  if (typeof text !== 'string') return null;
  const m = /^\/abrir[ \t]+(tg_[a-f0-9]{40})$/.exec(text.trim());
  return m ? { packageId: m[1] } : null;
}

export function decideReopen({actor, pkg, session, processing, publication} = {}) {
  if (!actor || !ID.test(actor.userId ?? '') || actor.chatId !== actor.userId ||
      actor.authenticated !== true || typeof actor.isAdmin !== 'boolean') return {ok:false, reason:'UNAUTHORIZED'};
  if (!pkg || !PACKAGE.test(pkg.id ?? '') || !ID.test(pkg.ownerId ?? '') ||
      !Number.isSafeInteger(pkg.revision) || pkg.revision < 1) return {ok:false, reason:'NOT_FOUND'};
  if (actor.userId !== pkg.ownerId && !actor.isAdmin) return {ok:false, reason:'NOT_FOUND'};
  if (!session || !['NONE','THIS_PACKAGE','OTHER_PACKAGE'].includes(session.state)) return {ok:false, reason:'SESSION_UNKNOWN'};
  if (session.state === 'OTHER_PACKAGE') return {ok:false, reason:'SESSION_BUSY'};
  if (pkg.state === 'OPEN' && session.state === 'THIS_PACKAGE') return {ok:true, replay:true};
  if (pkg.state !== 'READY' || session.state !== 'NONE') return {ok:false, reason:'NOT_REOPENABLE'};
  if (!processing || processing.revision !== pkg.revision || processing.state !== 'TERMINAL_BLOCKED' ||
      processing.noActiveAttempts !== true) return {ok:false, reason:'PROCESSING_UNRESOLVED'};
  // A timeout, draft, partial result, or an unverified CMS lookup is not a
  // proof that retrying with a new revision is safe.
  if (!publication || publication.revision !== pkg.revision || publication.verdict !== 'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED')
    return {ok:false, reason:'PUBLICATION_RECONCILIATION_REQUIRED'};
  return {ok:true, replay:false, expectedRevision:pkg.revision, nextRevision:pkg.revision+1};
}

export function blockedNotice(packageId) {
  if (!PACKAGE.test(packageId ?? '')) throw Error('INVALID_PACKAGE');
  return `Para agregar información, usa /abrir ${packageId}. Después envía el material o las instrucciones y termina con /listo. Si el proceso requiere conciliación, te lo indicaremos antes de continuar.`;
}
