// Pure technical logic, bundled into the Code nodes by build-workflows.mjs.
// No network, filesystem, workflow static data, or provider credentials.
export const PLATFORMS = Object.freeze([
  'x', 'linkedin', 'google_business', 'facebook', 'instagram',
  'threads', 'tiktok', 'youtube', 'whatsapp_channel',
]);
export const ENGINE_VERSION = '1.0.1';

export function normalizeInput(item, validate) {
  let payload = item.json;
  // Future authenticated webhook/form adapter can pass an envelope.
  // Only the canonical payload is validated; transport headers aren't copied.
  if (payload && Object.hasOwn(payload, 'body')) payload = payload.body;
  if (payload && Object.hasOwn(payload, 'payload')) payload = payload.payload;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); }
    catch { throw new Error('SOCIAL_INPUT_JSON_INVALID'); }
  }
  if (!validate(payload)) {
    // Never echo input values or validator messages containing payload values.
    const paths = (validate.errors || []).map(e => e.instancePath || '/');
    throw new Error(`SOCIAL_CONTRACT_INVALID:${[...new Set(paths)].join(',')}`);
  }
  const url = new URL(payload.content.url_opuro);
  if (url.protocol !== 'https:' || url.hostname !== 'oxigenopuro.com.mx'
      || url.username || url.password || url.port) {
    throw new Error('SOCIAL_PHASE1_OPURO_URL_INVALID');
  }
  if (payload.content.url_opol != null) throw new Error('SOCIAL_PHASE1_OPOL_NOT_SUPPORTED');
  if (/^[\s]*$/.test(payload.content.titulo_seo) || /^[\s]*$/.test(payload.content.subtitulo)) {
    throw new Error('SOCIAL_COPY_EMPTY');
  }
  if (/[\r\n\x00]/.test(payload.media.social.filename)) throw new Error('SOCIAL_FILENAME_INVALID');
  return {
    ...payload,
    social_engine_version: ENGINE_VERSION,
    correlation_id: payload.execution.correlation_id || payload.event.event_id,
  };
}

export function platformKey(event, platform, sha256) {
  if (!PLATFORMS.includes(platform)) throw new Error('SOCIAL_UNKNOWN_PLATFORM');
  return sha256(`${event.event.event_id}:${platform}:${event.social_contract_version}`);
}

export function terminal(event, platform, sha256, now, options = {}) {
  return {
    platform,
    status: options.status || 'SKIPPED',
    idempotency_key: platformKey(event, platform, sha256),
    attempts: options.attempts ?? 0,
    started_at: now,
    completed_at: now,
    post_id: options.post_id ?? null,
    post_url: options.post_url ?? null,
    provider_request_id: null,
    asset_url: null,
    reason_code: options.reason_code ?? null,
    error: options.error_code ? { code: options.error_code } : null,
  };
}

export function platformPreflight(event, platform, sha256, now) {
  const target = event.targets[platform];
  if (['youtube', 'whatsapp_channel'].includes(platform)) {
    return terminal(event, platform, sha256, now, { reason_code: 'MANUAL_REQUIRED' });
  }
  if (!target.enabled) return terminal(event, platform, sha256, now, { reason_code: 'DISABLED' });
  if (target.manual_required) {
    return terminal(event, platform, sha256, now, { reason_code: 'MANUAL_REQUIRED' });
  }
  if (event.execution.dry_run === true) {
    return terminal(event, platform, sha256, now, { reason_code: 'DRY_RUN' });
  }
  // Compile-time safety gate, NOT an input/variable that a caller may enable.
  // Replace only after implementing/proving a durable store's atomic claim.
  return terminal(event, platform, sha256, now, {
    status: 'FAILED', reason_code: 'LIVE_BLOCKED',
    error_code: 'DURABLE_STORE_NOT_IMPLEMENTED',
  });
}

export function threadsPreview(event, assetUrl) {
  const url = new URL(assetUrl);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('THREADS_ASSET_URL_INVALID');
  return {
    media_type: 'IMAGE',
    image_url: assetUrl,
    text: `${event.content.subtitulo}\n\n${event.content.url_opuro}`,
    alt_text: event.media.social.alt_text,
  };
}

export function stagingPlan(event, buffer, sha256) {
  const social = event.media.social;
  const digest = sha256(buffer);
  if (social.sha256 && digest !== social.sha256.toLowerCase()) throw new Error('SOCIAL_SHA256_MISMATCH');
  const looksLike = {
    'image/jpeg': buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    'image/png': buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a',
    'image/webp': buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  };
  if (!buffer.length || !looksLike[social.mime_type]) throw new Error('SOCIAL_MEDIA_SIGNATURE_MISMATCH');
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[social.mime_type];
  // Never concatenate untrusted event IDs into an HTTP header or upload path.
  const filename = `social-${event.event.source_post_id}-${digest}.${extension}`;
  return {
    filename, mime_type: social.mime_type, sha256: digest,
    bytes: buffer.length, alt_text: social.alt_text,
    wordpress_media_id: null, public_url: null, uploaded_at: null,
    cleanup_after: null, cleanup_after_days: event.execution.cleanup_after_days ?? 7,
  };
}

export function consolidate(event, results, sha256, now, runId, validateOutput) {
  if (results.length !== PLATFORMS.length) throw new Error('SOCIAL_RESULT_COUNT_INVALID');
  const ordered = PLATFORMS.map(platform => {
    const matches = results.filter(r => r.platform === platform);
    if (matches.length !== 1) throw new Error('SOCIAL_RESULT_PLATFORM_SET_INVALID');
    const result = matches[0];
    if (result.idempotency_key !== platformKey(event, platform, sha256)) throw new Error('SOCIAL_RESULT_IDENTITY_MISMATCH');
    return result;
  });
  const summary = {
    success: ordered.filter(r => r.status === 'SUCCESS').length,
    failed: ordered.filter(r => r.status === 'FAILED').length,
    skipped: ordered.filter(r => r.status === 'SKIPPED').length,
  };
  const result = {
    social_engine_version: ENGINE_VERSION,
    run_id: String(runId),
    correlation_id: event.correlation_id || event.execution.correlation_id || event.event.event_id,
    status: summary.failed ? (summary.success ? 'PARTIAL_SUCCESS' : 'FAILED') : 'SUCCESS',
    results: ordered,
    summary,
  };
  if (!validateOutput(result)) throw new Error('SOCIAL_OUTPUT_CONTRACT_INVALID');
  return result;
}
