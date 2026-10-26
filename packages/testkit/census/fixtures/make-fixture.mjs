/**
 * fixtures/make-fixture — SYNTHETIC ObservedRuntimeInventory fixture for C1.
 *
 * This is NOT a live observation: it is a hand-built fixture whose shape
 * mirrors the live non-Team snapshot (same schemas, same digest law), built
 * ONLY from tracked sources: the ExpectedToolObligations/Authoritative-
 * ToolSources artifacts. The C2 live snapshot is recorded SEPARATELY under
 * dev/engineering/tool-obligations/baselines/ and pinned by digest.
 *
 * Law: deterministic output (no clock, no randomness); the reconciler's
 * counts on this fixture are the CI baseline the negative controls move.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadExpectedPair } from '../expected-obligations.mjs'
import { definitionShapeDigest } from '../json-canonical.mjs'
import { withDigests } from '../inventory.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')

const { expected, sources } = loadExpectedPair(REPO_ROOT)
// Registration ROWS are not unique per name (one name registers from
// several sites); an OBSERVATION is per name, so the fixture dedups.
const hostNames = [...new Set(sources.static_sources.host.map((t) => t.name))].sort()
const testRows = new Set(['u7_census', 'u5_canary'])

// The non-Team World observation, derived from tracked facts: every
// host-static source tool is "observed" EXCEPT the ones the reviewed
// obligations mark as gated/off/opt-in — those do NOT mount on a plain
// profile (the reviewed scope rules of the generator are the authority for
// WHICH observed subset a non-Team World shows; here the fixture keeps the
// law simple and HONEST: it observes exactly the host-static set minus the
// obligations reviewed OUT_OF_SCOPE-with-no-registration, and the reconcile
// baseline counts on it are pinned below by the C1 test itself).
const byName = new Map(expected.obligations.filter((o) => o.kind === 'named').map((o) => [o.name, o]))
const observedNames = hostNames.filter((n) => {
  const o = byName.get(n)
  if (o === undefined) return true
  return !(o.obligation === 'OUT_OF_SCOPE' && o.source_registration === null)
})
const shape = (name, i) => definitionShapeDigest({
  name,
  description: `fixture description of ${name}`,
  parameters: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
  outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  timeoutMsPresent: i % 3 === 0,
})
let seq = 0
const mk = (name) => ({
  name,
  definition_identity: `def#${String((seq += 1))}`,
  schema_digest: shape(name, seq),
  identity_vs_global: 'same',
  change_seq: seq % 7 === 0 ? null : seq,
  source_class: testRows.has(name) ? 'test-row' : 'host-static',
  // EB2-A provider column: the public seam exposes no registrant at all;
  // the honest stamp is the constant NOT_OBSERVABLE (schema: seam evidence).
  provider_identity: 'NOT_OBSERVABLE',
})
const globalTools = [...observedNames, ...[...testRows]].sort().map(mk)
// one agent lane (a real session agent mirrors the global row set with the
// SAME placement identities — the non-Team case).
const agentTools = globalTools.map((t) => ({ ...t, identity_vs_global: 'same' }))

const inventory = withDigests({
  schema: 'u7-0/observed-runtime-inventory/v1',
  world: {
    kind: 'non-team',
    host_sha: '639ed015397290b3745d163aafe02ffee4aa3f84',
    boot_id: 'fixture-boot',
    world_id: 'u7c-fixture-synthetic',
    captured_utc: '2026-10-26T00:00:00.000Z',
    source_ledger: 'synthetic',
  },
  scopes: [
    { scope_id: 'global', kind: 'global', team_lane: false, team_lane_signal: 'none', agent_label: 'row/global', tools: globalTools },
    { scope_id: 'agent-1', kind: 'agent', team_lane: false, team_lane_signal: 'none', agent_label: 'fixture-agent', tools: agentTools },
  ],
})

writeFileSync(join(HERE, 'synthetic-non-team.inventory.json'), JSON.stringify(inventory, null, 2) + '\n')
process.stdout.write(JSON.stringify({ snapshot_digest: inventory.snapshot_digest, scopes: inventory.scopes.length, toolRows: globalTools.length + agentTools.length }, null, 2) + '\n')
