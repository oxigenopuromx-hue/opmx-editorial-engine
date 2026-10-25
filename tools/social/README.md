# Social v1.0.1 — reproducible offline preflight

This is a **technical safety/validation milestone**, not a live publishing release.
Publisher exports and editorial masters are not modified.

## Reproduce

Node.js 22 or newer:

```sh
cd tools/social
npm ci --ignore-scripts
npm run check
npm test
```

After modifying source, `npm run build` mechanically regenerates complete JSON
exports and the technical revision of the Social schema. `--check` never writes.
The historical v1.0 exports/schema remain unchanged as evidence, not as a live
fallback. Do not activate the older v1.0 workflows.

## What was actually exercised

- 35 Node tests: schema validation, input envelopes, negative cases, nine terminal
  results, stable platform keys, output aggregation, binary signatures/hashes,
  Threads preview copy, and safety gates.
- The tests execute the **actual bundled Code node JavaScript from the generated
  JSON** in an isolated VM. They do not merely test source helpers.
- Static graph checks confirm nine independently connected result branches and
  nine distinct inputs to Merge, inactive exports and no network/write nodes.
- This is **not an n8n import or native n8n engine execution**. Merge scheduling,
  installed node versions, permissions, actual binary storage, and instance task
  runner configuration remain to be tested in the user's n8n instance.

## Import order and invocation

1. Import `OPMX_SOCIAL_DISTRIBUTION_ENGINE_v1.0.1.json` into a new test workflow.
2. It starts with **When Executed by Another Workflow**, not an unauthenticated
   public webhook. Save it and call it from a separate manual test workflow with
   an Execute Sub-workflow node. Keep Publisher disconnected.
3. Pass the canonical payload exemplified by `test/fixture.mjs` with
   `execution.dry_run=true`. A binary attachment is optional in this simulation.
4. Expect one item with exactly nine results: seven `SKIPPED/DRY_RUN` and YouTube /
   WhatsApp Channel `SKIPPED/MANUAL_REQUIRED` (if the fixture targets are unchanged).
5. Import the two auxiliary v1.0.1 workflows only if testing their preflight
   separately. They are deliberately **not called** by the coordinator yet, so
   no child workflow IDs or credentials are needed for the first dry run.

The generated nodes bundle Ajv and format validation; no external npm module is
required in n8n. They use the built-in `crypto` module for SHA-256. A self-hosted
runner must permit that built-in through its documented configuration. Do not
use `NODE_FUNCTION_ALLOW_EXTERNAL=*` or broad module permission workarounds.

## Meaning of results

`SUCCESS` at the consolidated envelope means **no platform failed**; it is not
proof of remote publication. An all-skipped dry run reports `summary.success=0`.
`PARTIAL_SUCCESS` means at least one success and at least one failure. `FAILED`
means failures without a success. Every result contains attempts and an explicit
reason. Preflight always makes zero publish attempts.

If `dry_run=false`, automatic enabled targets return `FAILED/LIVE_BLOCKED` with
`DURABLE_STORE_NOT_IMPLEMENTED`; disabled/manual targets still return `SKIPPED`.
There is no input/variable to override this hard gate. Implement the approved
durable store and real adapters in a subsequent version before enabling live.

## Media and copy boundaries

- Staging preflight optionally reads one supplied binary using the n8n binary
  helper, checks the file signature (not a full image decode), calculates SHA-256,
  verifies a supplied hash and produces safe metadata. It neither uploads nor
  deletes anything. The original buffer is unchanged.
- `cleanup_after` remains null until final distribution completion is known.
  Never calculate the seven-day deletion date at upload time.
- `threadsPreview()` uses `media.social.alt_text` and actual newline characters.
  It is an offline payload helper only; it does not approve new copy policy or
  call a provider API. The final Threads copy still requires the approval already
  pending in the master handoff.

Official implementation references consulted 2026-10-25:
- [Execute Sub-workflow Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflowtrigger/)
- [Merge append / multiple inputs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.merge/)
- [Binary buffer helper](https://docs.n8n.io/code/cookbook/code-node/get-binary-data-buffer/)
