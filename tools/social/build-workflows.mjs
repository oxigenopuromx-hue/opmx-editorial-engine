// Generates complete, inactive n8n exports. Use --check in tests/CI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { buildSync } from 'esbuild';
import { PLATFORMS } from './runtime.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const schema = read('contracts/SOCIAL_DISTRIBUTION_CONTRACT_v1.0.json');
schema.$id = schema.$id.replace('v1.0.json', 'v1.0.1.json');
schema.title = 'OPMX Social Distribution Contract v1.0 — technical revision 1.0.1';
schema.version = '1.0.1';
schema['x-opmx-wire-version'] = '1.0';
schema.properties.event.required.push('source_site');
schema.properties.event.properties.source_post_id = {
  oneOf: [{ type: 'integer', minimum: 1 }, { type: 'string', pattern: '^[1-9][0-9]*$' }],
  description: 'ID positivo de WordPress; no es una URL ni un slug.',
};
schema.properties.execution.properties.idempotency_key.description = 'Clave estable del evento recibido. Cada plataforma deriva sha256(event_id:platform:social_contract_version). No es evidencia de deduplicación sin almacén durable.';
const output = schema['x-opmx-output'];
output.properties.social_engine_version.const = '1.0.1';
output.properties.results.maxItems = 9;
output.properties.results.allOf = PLATFORMS.map(platform => ({
  contains: { type: 'object', properties: { platform: { const: platform } }, required: ['platform'] },
  minContains: 1, maxContains: 1,
}));
output.properties.results.items.properties.reason_code.enum.push('DRY_RUN', 'LIVE_BLOCKED');
schema['x-opmx-runtime'].tiktok_blocker = 'Cambiar OPMX_OPURO_WP_BASE_URL al CMS definitivo y verificar cms.oxigenopuro.com.mx antes de habilitar PULL_FROM_URL.';

function bundle(contents, globalName) {
  return buildSync({
    stdin: { contents, resolveDir: directory, loader: 'js' },
    bundle: true, platform: 'neutral', format: 'iife', globalName,
    write: false, minify: true, target: 'es2022', legalComments: 'none',
  }).outputFiles[0].text;
}
const runtime = bundle('export * from "./runtime.mjs";', 'OPMXSocial');
const ajv = new Ajv({ strict: false, allErrors: true, code: { source: true } });
addFormats(ajv);
const compiledInput = bundle(standaloneCode(ajv, ajv.compile(schema)), 'ValidateSocialInput');
const compiledOutput = bundle(standaloneCode(ajv, ajv.compile(output)), 'ValidateSocialOutput');
const hashHelper = 'const sha256 = value => require("crypto").createHash("sha256").update(value).digest("hex");\n';
const code = (body, { input = false, output = false } = {}) =>
  runtime + (input ? compiledInput : '') + (output ? compiledOutput : '') + hashHelper + body;
function node(name, type, parameters, position, typeVersion = 2) {
  const hex = createHash('sha256').update(`social-v1.0.1:${name}`).digest('hex').slice(0, 32);
  const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  return { id, name, type: `n8n-nodes-base.${type}`, typeVersion, position, parameters };
}
const edge = (node, index = 0) => ({ node, type: 'main', index });
const trigger = () => node('When Executed by Another Workflow', 'executeWorkflowTrigger', { inputSource: 'passthrough' }, [-700, 0], 1.1);
const normalize = () => node('Validate Social Input', 'code', { jsCode: code(
  'const item = $input.first();\nconst event = OPMXSocial.normalizeInput(item, ValidateSocialInput);\nreturn [{json: event, ...(item.binary ? {binary: item.binary} : {})}];', { input: true }) }, [-440, 0]);
function workflow(name, nodes, connections) {
  return { name, nodes, connections, pinData: {}, active: false,
    settings: { executionOrder: 'v1', saveManualExecutions: true, callerPolicy: 'workflowsFromSameOwner' },
    meta: { templateCredsSetupCompleted: false }, tags: [] };
}

const branches = PLATFORMS.map((platform, index) => node(`${platform} — Preflight Result`, 'code', {
  jsCode: code(`const event = $input.first().json;\nreturn [{json: OPMXSocial.platformPreflight(event, ${JSON.stringify(platform)}, sha256, new Date().toISOString())}];`),
}, [-140, index * 160]));
const merge = node('Collect Nine Platform Results', 'merge', { mode: 'append', numberInputs: 9 }, [160, 500], 3.2);
const consolidate = node('Validate Consolidated Output', 'code', { jsCode: code(
  'const event = $("Validate Social Input").first().json;\nconst result = OPMXSocial.consolidate(event, $input.all().map(i => i.json), sha256, new Date().toISOString(), $execution.id, ValidateSocialOutput);\nreturn [{json: result}];', { output: true }) }, [420, 500]);
const coordinator = workflow('OPMX Social Distribution v1.0.1 — Offline Preflight',
  [trigger(), normalize(), ...branches, merge, consolidate], {
    'When Executed by Another Workflow': { main: [[edge('Validate Social Input')]] },
    'Validate Social Input': { main: [branches.map(n => edge(n.name))] },
    ...Object.fromEntries(branches.map((n, index) => [n.name, { main: [[edge(merge.name, index)]] }])),
    [merge.name]: { main: [[edge(consolidate.name)]] },
  });

const threadsNode = node('Threads — Safe Preflight', 'code', { jsCode: code(
  'const event = $input.first().json;\nreturn [{json: OPMXSocial.platformPreflight(event, "threads", sha256, new Date().toISOString())}];') }, [-120, 0]);
const threads = workflow('OPMX Social Threads v1.0.1 — Safe Preflight', [trigger(), normalize(), threadsNode], {
  'When Executed by Another Workflow': { main: [[edge('Validate Social Input')]] },
  'Validate Social Input': { main: [[edge(threadsNode.name)]] },
});

const stagingNode = node('SOCIAL — Inspect Binary Without Upload', 'code', { jsCode: code(`
const event = $input.first().json;
// This subworkflow is not connected to the coordinator until a durable store exists.
if (event.execution.dry_run !== true) return [{json: {status:'FAILED', reason_code:'LIVE_BLOCKED', error:{code:'DURABLE_STORE_NOT_IMPLEMENTED'}, asset:null}}];
const property = event.media.social.binary_property;
if (!$input.first().binary?.[property]) return [{json:{status:'SKIPPED',reason_code:'DRY_RUN',asset:null,plan:null}}];
const buffer = await this.helpers.getBinaryDataBuffer(0, property);
const plan = OPMXSocial.stagingPlan(event, buffer, sha256);
return [{json:{status:'SKIPPED',reason_code:'DRY_RUN',asset:null,plan}}];`) }, [-120, 0]);
const staging = workflow('OPMX Social Media Staging v1.0.1 — Offline Inspection', [trigger(), normalize(), stagingNode], {
  'When Executed by Another Workflow': { main: [[edge('Validate Social Input')]] },
  'Validate Social Input': { main: [[edge(stagingNode.name)]] },
});

const artifacts = new Map([
  ['contracts/SOCIAL_DISTRIBUTION_CONTRACT_v1.0.1.json', schema],
  ['workflows/social/OPMX_SOCIAL_DISTRIBUTION_ENGINE_v1.0.1.json', coordinator],
  ['workflows/social/OPMX_SOCIAL_THREADS_v1.0.1.json', threads],
  ['workflows/social/OPMX_SOCIAL_MEDIA_STAGING_v1.0.1.json', staging],
]);
for (const [relative, value] of artifacts) {
  const expected = JSON.stringify(value, null, 2) + '\n';
  const filename = path.join(root, relative);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8') !== expected) {
      throw new Error(`Generated artifact out of date: ${relative}`);
    }
  } else {
    fs.writeFileSync(filename, expected);
  }
  console.log(`OK ${relative}`);
}
