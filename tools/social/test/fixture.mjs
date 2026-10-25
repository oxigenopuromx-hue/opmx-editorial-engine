import { PLATFORMS } from '../runtime.mjs';

export function fixture(overrides = {}) {
  return {
    social_contract_version: '1.0',
    event: {
      event_id: 'social-test-opuro-20261025-1',
      publisher_run_id: 'publisher-test-1',
      source_post_id: 123,
      published_at: '2026-10-25T15:00:00Z',
      source_site: 'OPURO',
    },
    content: {
      titulo_seo: 'Prueba técnica OPMX',
      subtitulo: 'Sólo simulación: no publicar.',
      url_opuro: 'https://oxigenopuro.com.mx/prueba-tecnica/',
      url_opol: null,
    },
    media: {
      social: {
        source_type: 'UPLOAD', binary_property: 'imagen_social',
        mime_type: 'image/png', filename: 'social-prueba.png',
        alt_text: 'Ilustración de prueba', origin: 'CANVA_MANUAL',
      },
    },
    targets: Object.fromEntries(PLATFORMS.map(platform => [platform, { enabled: true }])),
    execution: {
      idempotency_key: 'social-test-opuro-stable-event',
      requested_at: '2026-10-25T15:00:01Z', dry_run: true,
      correlation_id: 'test-correlation', cleanup_after_days: 7,
    },
    ...overrides,
  };
}
