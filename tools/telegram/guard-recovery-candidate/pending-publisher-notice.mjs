// An uncertain response is not evidence that Publisher stopped. Preserve the
// existing headings for progress, confirmed completion and deterministic errors.
// This changes text only; it cannot add an allowed reason, retry or write permit.
export function pendingPublisherNoticeHeading(reason,fallback='proceso detenido'){
 return reason==='DRAFT_UNCERTAIN'||reason==='PUBLISH_UNCERTAIN'?'resultado pendiente de confirmación':fallback;
}
