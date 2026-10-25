import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  PLATFORMS, normalizeInput, platformPreflight, platformKey,
  threadsPreview, stagingPlan, consolidate,
} from '../runtime.mjs';
import { fixture } from './fixture.mjs';

const root = new URL('../../../', import.meta.url);
const read = relative => JSON.parse(fs.readFileSync(new URL(relative, root), 'utf8'));
const schema = read('contracts/SOCIAL_DISTRIBUTION_CONTRACT_v1.0.1.json');
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const validateOutput = ajv.compile(schema['x-opmx-output']);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const now = '2026-10-25T15:01:00Z';
const coordinator = read('workflows/social/OPMX_SOCIAL_DISTRIBUTION_ENGINE_v1.0.1.json');

async function runCode(workflow, name, items, context = {}) {
  const node = workflow.nodes.find(n => n.name === name);
  assert.ok(node, `Node ${name} must exist`);
  const sandbox = {
    $input: { first: () => items[0], all: () => items },
    $execution: { id: 'offline-test-execution' },
    $: name => ({ first: () => context[name] }),
    URL, Buffer,
    require: module => {
      assert.equal(module, 'crypto', 'No runtime imports except crypto are allowed');
      return { createHash };
    },
  };
  // No fetch, HTTP client, filesystem, provider credentials or process in VM.
  const fn = vm.runInNewContext(`(async function(){${node.parameters.jsCode}\n})`, sandbox);
  return JSON.parse(JSON.stringify(await fn.call({ helpers: context.helpers || {} })));
}

test('canonical input and output compile as JSON Schema 2020-12', () => {
  assert.equal(validate(fixture()), true, JSON.stringify(validate.errors));
});

test('root / webhook body / multipart JSON envelope preserve approved input', () => {
  const event = fixture();
  for (const json of [event, { body: event }, { body: { payload: JSON.stringify(event) } }]) {
    assert.equal(normalizeInput({ json }, validate).content.subtitulo, event.content.subtitulo);
  }
});

for (const [name, mutate] of [
  ['missing source site', p => { delete p.event.source_site; }],
  ['OPOL site', p => { p.event.source_site = 'OPOL'; }],
  ['zero post id', p => { p.event.source_post_id = 0; }],
  ['missing execution', p => { delete p.execution; }],
  ['string dry_run', p => { p.execution.dry_run = 'false'; }],
  ['null dry_run', p => { p.execution.dry_run = null; }],
  ['string enabled', p => { p.targets.facebook.enabled = 'true'; }],
  ['missing platform', p => { delete p.targets.threads; }],
  ['unknown target', p => { p.targets.telegram = { enabled: true }; }],
  ['invalid timestamp', p => { p.event.published_at = 'yesterday'; }],
  ['legacy HERO payload', p => { p.media = { original: { public_url: 'https://example.com/hero.jpg' } }; }],
  ['injected readiness', p => { p.live_ready = true; }],
]) {
  test(`rejects ${name} before execution`, async () => {
    const p = fixture(); mutate(p);
    assert.equal(validate(p), false);
    await assert.rejects(runCode(coordinator, 'Validate Social Input', [{ json: p }]), /SOCIAL_CONTRACT_INVALID/);
  });
}

for (const url of [
  'http://oxigenopuro.com.mx/prueba/', 'https://oxigenopuro.mx/prueba/',
  'https://oxigenopuro.com.mx.evil.example/prueba/',
  'https://secret@oxigenopuro.com.mx/prueba/', 'https://127.0.0.1/prueba/',
]) {
  test(`rejects out-of-scope publication URL ${url}`, () => {
    const p = fixture(); p.content.url_opuro = url;
    assert.throws(() => normalizeInput({ json: p }, validate), /SOCIAL_PHASE1_OPURO_URL_INVALID/);
  });
}

test('rejects an OPOL URL, blank copy and header-injection filename', () => {
  const p = fixture(); p.content.url_opol = 'https://oxigenopolitico.com.mx/prueba/';
  assert.throws(() => normalizeInput({ json: p }, validate), /OPOL_NOT_SUPPORTED/);
  p.content.url_opol = null; p.content.subtitulo = ' ';
  assert.throws(() => normalizeInput({ json: p }, validate), /COPY_EMPTY/);
  p.content.subtitulo = 'Texto'; p.media.social.filename = 'foto.png\r\nAuthorization: no';
  assert.throws(() => normalizeInput({ json: p }, validate), /FILENAME_INVALID/);
});

test('all platforms emit one SKIPPED result in dry_run; manual destinations stay manual', () => {
  const p = fixture();
  for (const platform of PLATFORMS) {
    const result = platformPreflight(p, platform, sha256, now);
    assert.equal(result.status, 'SKIPPED');
    assert.equal(result.reason_code, ['youtube','whatsapp_channel'].includes(platform) ? 'MANUAL_REQUIRED' : 'DRY_RUN');
    assert.equal(result.attempts, 0);
    assert.equal(result.post_id, null);
  }
});

test('missing durable store fails enabled live branches without blocking manual/disabled ones', () => {
  const p = fixture(); p.execution.dry_run = false;
  p.targets.linkedin.enabled = false;
  for (const platform of PLATFORMS) {
    const result = platformPreflight(p, platform, sha256, now);
    assert.equal(result.status, ['linkedin','youtube','whatsapp_channel'].includes(platform) ? 'SKIPPED' : 'FAILED');
    if (result.status === 'FAILED') assert.equal(result.error.code, 'DURABLE_STORE_NOT_IMPLEMENTED');
  }
});

test('YouTube and WhatsApp remain MANUAL_REQUIRED even if disabled or explicitly set to automatic', () => {
  const p = fixture(); p.execution.dry_run = false;
  for (const platform of ['youtube', 'whatsapp_channel']) {
    for (const enabled of [true, false]) {
      p.targets[platform] = { enabled, manual_required: false };
      const result = platformPreflight(p, platform, sha256, now);
      assert.equal(result.status, 'SKIPPED');
      assert.equal(result.reason_code, 'MANUAL_REQUIRED');
    }
  }
});

test('platform keys are stable across retries/correlation IDs and distinct by platform/event', () => {
  const p = fixture();
  const keys = PLATFORMS.map(platform => platformKey(p, platform, sha256));
  assert.equal(new Set(keys).size, 9);
  p.execution.correlation_id = 'another-retry';
  assert.equal(platformKey(p, 'threads', sha256), keys[5]);
  p.event.event_id += '-new-event';
  assert.notEqual(platformKey(p, 'threads', sha256), keys[5]);
});

test('Threads preview uses media.social.alt_text and real line breaks without rewriting copy', () => {
  const p = fixture();
  const preview = threadsPreview(p, 'https://cms.example.com/wp-content/uploads/test.png');
  assert.equal(preview.alt_text, p.media.social.alt_text);
  assert.equal(preview.text, `${p.content.subtitulo}\n\n${p.content.url_opuro}`);
  assert.equal(preview.text.includes('\\n'), false);
  assert.equal(preview.media_type, 'IMAGE');
});

test('binary plan computes hash, checks signature and preserves original buffer', () => {
  const p = fixture();
  const buffer = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const original = Buffer.from(buffer);
  const plan = stagingPlan(p, buffer, sha256);
  assert.equal(plan.sha256, sha256(buffer));
  assert.deepEqual(buffer, original);
  assert.equal(plan.cleanup_after_days, 7);
  assert.equal(plan.cleanup_after, null, 'Retention begins only after completed distribution');
  assert.equal(plan.wordpress_media_id, null);
  p.media.social.sha256 = 'a'.repeat(64);
  assert.throws(() => stagingPlan(p, buffer, sha256), /SHA256_MISMATCH/);
  delete p.media.social.sha256;
  assert.throws(() => stagingPlan(p, Buffer.from('<html>'), sha256), /SIGNATURE_MISMATCH/);
});

for (const [name, success, failed, expected] of [
  ['all skipped', 0, 0, 'SUCCESS'], ['success plus skipped', 2, 0, 'SUCCESS'],
  ['mixed outcomes', 1, 1, 'PARTIAL_SUCCESS'], ['only failures and skips', 0, 3, 'FAILED'],
]) {
  test(`consolidation ${name}`, () => {
    const p = fixture();
    const results = PLATFORMS.map((platform, i) => ({
      ...platformPreflight(p, platform, sha256, now),
      status: i < success ? 'SUCCESS' : i < success + failed ? 'FAILED' : 'SKIPPED',
    }));
    const result = consolidate(p, results.reverse(), sha256, now, 'run-1', validateOutput);
    assert.equal(result.status, expected);
    assert.equal(result.results.length, 9);
    assert.deepEqual(result.results.map(r => r.platform), PLATFORMS);
    assert.deepEqual(result.summary, {success, failed, skipped: 9-success-failed});
  });
}

test('consolidation rejects missing, duplicate, malformed and misidentified platform results', () => {
  const p = fixture();
  const results = PLATFORMS.map(platform => platformPreflight(p, platform, sha256, now));
  assert.throws(() => consolidate(p, results.slice(1), sha256, now, 'run', validateOutput), /COUNT_INVALID/);
  assert.throws(() => consolidate(p, [...results.slice(1), results[1]], sha256, now, 'run', validateOutput), /PLATFORM_SET_INVALID/);
  const badIdentity = structuredClone(results); badIdentity[0].idempotency_key = 'wrong';
  assert.throws(() => consolidate(p, badIdentity, sha256, now, 'run', validateOutput), /IDENTITY_MISMATCH/);
  const badStatus = structuredClone(results); badStatus[0].status = 'UNKNOWN';
  assert.throws(() => consolidate(p, badStatus, sha256, now, 'run', validateOutput), /OUTPUT_CONTRACT_INVALID/);
});

test('actual bundled n8n Code nodes execute a complete offline nine-branch dry_run', async () => {
  const input = {json: fixture(), binary: { imagen_social: { data: 'reference-only' } }};
  const normalized = await runCode(coordinator, 'Validate Social Input', [input]);
  assert.deepEqual(normalized[0].binary, input.binary);
  const outcomes = [];
  for (const platform of PLATFORMS) {
    const response = await runCode(coordinator, `${platform} — Preflight Result`, normalized);
    outcomes.push(...response);
  }
  const final = await runCode(coordinator, 'Validate Consolidated Output', outcomes, { 'Validate Social Input': normalized[0] });
  assert.equal(validateOutput(final[0].json), true, JSON.stringify(validateOutput.errors));
  assert.equal(final[0].json.run_id, 'offline-test-execution');
  assert.equal(final[0].json.summary.skipped, 9);
  assert.equal(final[0].json.summary.success, 0);
});

test('actual Threads and staging exports fail closed for live input, without helpers or HTTP', async () => {
  for (const [file, nodeName] of [
    ['OPMX_SOCIAL_THREADS_v1.0.1.json', 'Threads — Safe Preflight'],
    ['OPMX_SOCIAL_MEDIA_STAGING_v1.0.1.json', 'SOCIAL — Inspect Binary Without Upload'],
  ]) {
    const w = read(`workflows/social/${file}`);
    const p = fixture(); p.execution.dry_run = false;
    const result = await runCode(w, nodeName, [{json:p}]);
    assert.equal(result[0].json.status, 'FAILED');
    assert.equal(result[0].json.reason_code, 'LIVE_BLOCKED');
  }
});

test('staging dry_run permits descriptor-only and inspects provided binary with official helper', async () => {
  const w = read('workflows/social/OPMX_SOCIAL_MEDIA_STAGING_v1.0.1.json');
  const p = fixture();
  const empty = await runCode(w, 'SOCIAL — Inspect Binary Without Upload', [{json:p}]);
  assert.equal(empty[0].json.asset, null);
  let reads = 0;
  const result = await runCode(w, 'SOCIAL — Inspect Binary Without Upload', [{json:p,binary:{imagen_social:{data:'mock-reference'}}}], {
    helpers: { getBinaryDataBuffer: async (index, property) => {
      assert.equal(index, 0); assert.equal(property, 'imagen_social'); reads++;
      return Buffer.from('89504e470d0a1a0a0000000d49484452','hex');
    } },
  });
  assert.equal(reads, 1);
  assert.equal(result[0].json.plan.sha256.length, 64);
  assert.equal(result[0].json.plan.public_url, null);
});

test('new exports are inactive, use subworkflow triggers and have complete deterministic fan-in', () => {
  for (const file of [
    'OPMX_SOCIAL_DISTRIBUTION_ENGINE_v1.0.1.json',
    'OPMX_SOCIAL_THREADS_v1.0.1.json', 'OPMX_SOCIAL_MEDIA_STAGING_v1.0.1.json',
  ]) {
    const w = read(`workflows/social/${file}`);
    assert.equal(w.active, false);
    assert.equal(w.nodes[0].type, 'n8n-nodes-base.executeWorkflowTrigger');
    const names = new Set(w.nodes.map(n=>n.name));
    assert.equal(names.size, w.nodes.length);
    for (const [name, channels] of Object.entries(w.connections)) {
      assert.ok(names.has(name));
      for (const outputs of Object.values(channels)) for (const edges of outputs) for (const edge of edges) assert.ok(names.has(edge.node));
    }
    for (const node of w.nodes) {
      assert.ok(['executeWorkflowTrigger','code','merge'].some(type=>node.type === `n8n-nodes-base.${type}`));
      assert.equal(node.retryOnFail, undefined);
      assert.equal(node.credentials, undefined);
    }
  }
  const fanout = coordinator.connections['Validate Social Input'].main[0];
  assert.equal(fanout.length, 9);
  const merge = coordinator.nodes.find(n=>n.name==='Collect Nine Platform Results');
  assert.equal(merge.parameters.numberInputs, 9);
  for (const [i, platform] of PLATFORMS.entries()) {
    assert.equal(coordinator.connections[`${platform} — Preflight Result`].main[0][0].index, i);
  }
});
