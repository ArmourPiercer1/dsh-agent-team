#!/usr/bin/env node
/**
 * build-expected-tool-obligations.mjs — deterministic generator for the
 * U7-0 tracked ExpectedToolObligations + AuthoritativeToolSources artifacts
 * (EB2-A; execution-plan U7: "来源新增自动 UNKNOWN 而非授权; 固定 snapshot
 * digest"; center-assembly-architecture §3 "AuthoritativeToolSources +
 * ExpectedToolObligations ← 控制/验证侧（只读）").
 *
 * WHAT IT DOES. It projects the G1-F-reviewed obligation decisions (seed:
 * byte-copy of the U4 evidence artifact, sha-pinned below) plus the U1-C
 * static source census (seed 2) onto a CLOSED machine schema, adds the
 * machine-readable scope classification (`expected_in`) with the reviewed
 * rules + overrides table below, cross-checks every REQUIRED named
 * obligation against the tracked matrix/backlog markdown, pins the Host
 * baseline from `tests/paths.mjs` (the declared single source — never a
 * copied SHA), and writes the artifacts plus a manifest of digests.
 *
 * WHAT IT DOES NOT DO. It does NOT re-derive the obligation verdicts: those
 * are reviewed G1-F/U4 inputs, and re-deriving them here would create a
 * second authority. It does NOT touch the runtime: this is the control/
 * verification side, read-only (architecture §3).
 *
 * DETERMINISM LAW: outputs carry NO timestamps and no environment-derived
 * values; inputs are read from fixed relative paths and hash-pinned in the
 * manifest; key order is canonicalized. Replaying the generator over the
 * same tree MUST produce byte-identical artifacts (a C1 test pins this).
 *
 * Usage:  node dev/engineering/tool-obligations/build-expected-tool-obligations.mjs [--check]
 *   (no flag)  write the artifacts + manifest
 *   --check    regenerate in memory and fail (exit 1, diff named) on any
 *              byte difference against what is on disk — the CI replay arm
 *
 * @module dev/engineering/tool-obligations/build
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')

const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const sha256File = (p) => sha256(readFileSync(p))
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

// ── inputs (tracked sources; paths fixed, digests recorded) ────────────────
const SEED_OBLIGATIONS = join(HERE, 'sources', 'u4-reviewed-obligations.seed.json')
const SEED_SOURCES = join(HERE, 'sources', 'u1c-static-source-census.seed.json')
const SEED_DISPOSITIONS = join(HERE, 'sources', 'u4-unknown-dispositions.seed.json')
const MATRIX = join(REPO, 'docs', 'plans', 'active', 'alpha5-tool-io-governance', 'TOOL-CAPABILITY-MATRIX-9b2.md')
const BACKLOG = join(REPO, 'docs', 'plans', 'active', 'alpha5-tool-io-governance', 'ALPHA5-EFFECTIVE-BACKLOG.md')
const PATHS_MJS = join(REPO, 'tests', 'paths.mjs')

// ── reviewed machine classification (the ONLY judgement this file owns) ────
// Rules are evaluated in order; first match wins; NO match is a fail-closed
// generator error (an unclassified obligation never silently disappears).
const SCOPE_RULES = [
  // [id, predicate, expected_in, team_lane_variant_expected]
  ['name-pattern', (o) => /[<(]/.test(o.name) || o.name.startsWith('surface:'), null, false], // kind split happens below; expected_in per kind
  ['team-plane-row', (o) => /^Team (plane|own-layer)/.test(o.scope_variant), 'team-lane', true],
  // review-R1 m6: 'Team native takeover' (bash) is the same reviewed takeover fact
  ['native-host-surface', (o) => o.scope_variant.startsWith('host ') || o.scope_variant.includes('host base bundle') || o.scope_variant.includes('host catalog name') || o.scope_variant.includes('host lazy') || o.scope_variant.includes('host package'), 'native-scope', (o) => /Team plane takeover row|Team native takeover|Team governed jobs rows|governed (read|shell|jobs)/.test(o.scope_variant)],
  // Opt-in / preset-disabled / gating-refused host names (U1-C "census
  // gating" family): presence attaches to the NATIVE surface; the census
  // reporting them MISSING today is the honest, reviewed state.
  ['unmounted-opt-in', (o) => /census gating|disabled:true|NOT mounted|no row in packages\/bundle|zero rows|registers only while|internal child-session tool|mounted but disabled/.test(o.scope_variant), 'native-scope', false],
]
// Reviewed overrides for entries whose prose matches no rule cleanly (each
// one is a U4-cited fact; adding/altering an override is a reviewed change).
const SCOPE_OVERRIDES = {
  lsp: { expected_in: 'native-scope', team_lane_variant_expected: false, why: 'opt-in host package (not in shipped bundle rows) + Team P-LSP assembly face; presence attaches to the native surface' },
  list_subagent_models: { expected_in: 'native-scope', team_lane_variant_expected: false, why: 'conditional registration; web-app mounts model-selection policy — presence attaches to the native surface' },
  present: { expected_in: 'native-scope', team_lane_variant_expected: false, why: 'mounted per web preset — absence in a preset-less World is a true MISSING signal' },
  ask_user_question: { expected_in: 'native-scope', team_lane_variant_expected: false, why: 'mounted per preset — same rule as present' },
  cordis_inspect_list: { expected_in: 'native-scope', team_lane_variant_expected: false, why: 'cordis preset only — absence in a preset-less World is a true MISSING signal' },
  cordis_inspect_query: { expected_in: 'native-scope', team_lane_variant_expected: false, why: 'cordis preset only — same rule as cordis_inspect_list' },
  run_code: { expected_in: 'native-scope', team_lane_variant_expected: false, why: 'lazy ToolRuntime registration in PTC mode — standard-mode absence is a recorded fact, not an error' },
}

/** @param {object} o one seed obligation */
function classify(o, seedByName = new Map(), depth = 0) {
  const kind = o.name.startsWith('surface:') ? 'surface' : /[<(]/.test(o.name) ? 'dynamic-class' : 'named'
  if (kind === 'surface') return { kind, expected_in: 'surface-obligation', team_lane_variant_expected: false }
  if (kind === 'dynamic-class') return { kind, expected_in: 'dynamic-class', team_lane_variant_expected: false }
  const ov = SCOPE_OVERRIDES[o.name]
  if (ov !== undefined) return { kind, expected_in: ov.expected_in, team_lane_variant_expected: ov.team_lane_variant_expected }
  // Reviewed inheritance (the U4 prose says "same trio as job_list",
  // "same as terminal_open", …): one reviewed SAME_AS map resolves each
  // prose inheritance to the referenced obligation's classification, so
  // every group has exactly ONE rule. Cycles trip the depth guard below.
  const sameAs = SCOPE_SAME_AS.get(o.name)
  if (sameAs !== undefined && depth < 4) {
    const target = seedByName.get(sameAs)
    if (target === undefined) throw new Error(`generator refused: SAME_AS target "${sameAs}" not in the seed`)
    const inner = classify(target, seedByName, depth + 1)
    return { kind, expected_in: inner.expected_in, team_lane_variant_expected: inner.team_lane_variant_expected }
  }
  for (const [id, pred, expectedIn, teamVar] of SCOPE_RULES) {
    if (id === 'name-pattern') continue
    if (pred(o)) return { kind, expected_in: expectedIn, team_lane_variant_expected: typeof teamVar === 'function' ? teamVar(o) === true : teamVar === true }
  }
  throw new Error(`generator refused: unclassified scope_variant for "${o.name}" (${JSON.stringify(o.scope_variant).slice(0, 120)}) — add a reviewed rule or override`)
}

// Reviewed prose-inheritance groups (each cites the U4 seed text it
// resolves; adding/altering an entry is a reviewed change).
const SCOPE_SAME_AS = new Map([
  ['job_output', 'job_list'],
  ['job_kill', 'job_list'],
  ['terminal_close', 'terminal_open'],
  ['terminal_list', 'terminal_open'],
  ['terminal_read', 'terminal_open'],
  ['terminal_send', 'terminal_open'],
  ['terminal_signal', 'terminal_open'],
  ['schedule_delete', 'schedule_create'],
  ['schedule_list', 'schedule_create'],
  ['schedule_update', 'schedule_create'],
  ['session_trace', 'session_search'],
  ['session_event_read', 'session_search'],
  ['session_event_search', 'session_search'],
  ['session_event_trace', 'session_search'],
  ['wait_agent', 'spawn_teammate'],
  ['team_task_create', 'spawn_teammate'],
  ['team_task_list', 'spawn_teammate'],
  ['team_task_get', 'spawn_teammate'],
  ['team_task_update', 'spawn_teammate'],
  ['cordis_inspect_query', 'cordis_inspect_list'],
])

function main() {
  const check = process.argv.includes('--check')
  // Host pin: READ from tests/paths.mjs (the declared single source).
  const pathsSrc = readFileSync(PATHS_MJS, 'utf8')
  const hostVersion = /export const DSH_BASELINE_VERSION = '([^']+)'/.exec(pathsSrc)?.[1]
  const hostSha = /export const TEST_USE_BASELINE_SHA = '([^']+)'/.exec(pathsSrc)?.[1]
  if (!hostVersion || !hostSha || !/^[0-9a-f]{40}$/.test(hostSha)) {
    throw new Error('generator refused: could not read DSH_BASELINE_VERSION / TEST_USE_BASELINE_SHA from tests/paths.mjs')
  }

  const seed = readJson(SEED_OBLIGATIONS)
  const srcSeeds = readJson(SEED_SOURCES)
  const dispositions = readJson(SEED_DISPOSITIONS)
  const matrixText = readFileSync(MATRIX, 'utf8')
  const backlogText = readFileSync(BACKLOG, 'utf8')

  // Authoritative source indexes (U1-C static census seeds, byte-pinned).
  const hostByName = new Map(srcSeeds.host.tools.map((t) => [t.name, t]))
  const teamByName = new Map(srcSeeds.team.tools.map((t) => [t.name, t]))

  /** @type {any[]} */
  const obligations = []
  const seen = new Set()
  const seedByName = new Map(seed.obligations.map((o) => [o.name, o]))
  for (const o of seed.obligations) {
    if (seen.has(o.name)) throw new Error(`generator refused: duplicate obligation name ${o.name}`)
    seen.add(o.name)
    const cls = classify(o, seedByName)
    if (o.obligation !== 'REQUIRED' && o.obligation !== 'OUT_OF_SCOPE') {
      throw new Error(`generator refused: obligation field must be REQUIRED|OUT_OF_SCOPE for ${o.name}`)
    }
    let crossCheck = cls.kind === 'surface' ? 'N/A-SURFACE' : 'N/A-DYNAMIC'
    if (cls.kind === 'named') {
      const inMatrix = new RegExp(`\\b${o.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(matrixText)
      const inBacklog = new RegExp(`\\b${o.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(backlogText)
      crossCheck = inMatrix || inBacklog ? 'NAME-PRESENT' : 'NAME-ABSENT'
      if (crossCheck === 'NAME-ABSENT' && o.obligation === 'REQUIRED') {
        throw new Error(`generator refused: REQUIRED obligation "${o.name}" names nothing in the tracked matrix/backlog`)
      }
    }
    const host = hostByName.get(o.name) ?? null
    const team = teamByName.get(o.name) ?? null
    obligations.push({
      candidate_route: o.candidate_route,
      effect_class: o.effect_class,
      expected_in: cls.expected_in,
      kind: cls.kind,
      matrix_cross_check: crossCheck,
      name: o.name,
      obligation: o.obligation,
      out_of_scope_reason: o.obligation === 'OUT_OF_SCOPE' ? String(o.scope_variant) : null,
      scope_variant: o.scope_variant,
      source_registration: host === null ? null : { package: host.package ?? null, file: host.file, line: host.line },
      supporting_evidence: o.supporting_evidence ?? [],
      team_lane_variant_expected: cls.team_lane_variant_expected,
      team_source_registration: team === null ? null : { file: team.file, line: team.line, kind: team.kind },
      unknowns: o.unknowns ?? [],
    })
  }
  obligations.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  // (review-R1 B3) REQUIRED means SOURCED: a REQUIRED named entry MUST
  // carry a registration on at least one side (host or team). Dropping a
  // registration from the u1c seed therefore REFUSES the replay (previously
  // it silently emitted REQUIRED with source_registration:null).
  const unsourced = obligations
    .filter((o) => o.kind === 'named' && o.obligation === 'REQUIRED' && o.source_registration === null && o.team_source_registration === null)
    .map((o) => o.name)
  if (unsourced.length > 0) {
    throw new Error(`generator refused: REQUIRED obligations with NO source registration on either side: ${unsourced.join(', ')}`)
  }
  // (review-R1 m3) the U4-G1F-SUP-C dispositions seed is a CONSUMED input:
  // every disposition row must map onto an artifact entry (named / dynamic
  // class / surface), and every row must carry its reviewed disposition +
  // a route or a precise missing item. No orphan dispositions, no silent
  // orphans in the other direction (the 22 rows are exactly the U4-UNKNOWN
  // set this generator projects).
  {
    const byName = new Map(obligations.map((o) => [o.name, o]))
    const orphans = []
    for (const d of dispositions.dispositions) {
      const direct = byName.get(d.name)
      const isSurface = typeof d.name === 'string' && d.name.startsWith('surface:')
      const isDynamic = typeof d.name === 'string' && d.name.includes('dynamic')
      const mapped = direct !== undefined
        || (isSurface && obligations.some((o) => o.kind === 'surface'))
        || (isDynamic && obligations.some((o) => o.kind === 'dynamic-class'))
      if (!mapped) orphans.push(d.name)
      if (typeof d.disposition !== 'string' || d.disposition === '') orphans.push(`${d.name} (no disposition)`)
      const routed = (d.route != null && String(JSON.stringify(d.route)).length > 2) || typeof d.precise_missing_item === 'string'
      if (!routed) orphans.push(`${d.name} (no route and no precise_missing_item)`)
    }
    if (orphans.length > 0) throw new Error(`generator refused: dispositions seed does not map onto the artifact: ${orphans.join('; ')}`)
    const dispositioned = new Set(dispositions.dispositions.map((d) => d.name))
    for (const o of obligations) {
      if (o.kind !== 'named' || o.obligation !== 'REQUIRED') continue
      const seedEntry = seedByName.get(o.name)
      if (seedEntry != null && seedEntry.u4_status === 'UNKNOWN' && !dispositioned.has(o.name)) {
        throw new Error(`generator refused: REQUIRED obligation ${o.name} carried U4 status UNKNOWN but has no disposition row`)
      }
    }
  }

  const counts = {
    entries: obligations.length,
    required: obligations.filter((o) => o.obligation === 'REQUIRED').length,
    out_of_scope: obligations.filter((o) => o.obligation === 'OUT_OF_SCOPE').length,
    named: obligations.filter((o) => o.kind === 'named').length,
    dynamic_classes: obligations.filter((o) => o.kind === 'dynamic-class').length,
    surfaces: obligations.filter((o) => o.kind === 'surface').length,
  }
  if (counts.entries !== 91 || counts.required !== 58 || counts.out_of_scope !== 33) {
    throw new Error(`generator refused: counts drifted (${JSON.stringify(counts)} vs reviewed 91/58/33)`)
  }

  const dynamicClasses = [
    ...(srcSeeds.host.dynamicSourceClasses ?? []),
    ...(srcSeeds.team.dynamicSourceClasses ?? []),
  ]

  const pins = { host_version: hostVersion, host_sha: hostSha, host_pin_source: 'tests/paths.mjs' }

  const expected = {
    schema: 'u7-0/expected-tool-obligations/v1',
    law: {
      unknown_never_authorized: 'A name observed at runtime without an entry here is UNKNOWN: it is REPORTED, never authorized (CI-11, §10.4; governance-center dynamic-source not_verified law).',
      dynamic_sources_are_classes: 'Dynamic sources are recorded as CLASSES, never enumerated; a discovered instance of a dynamic class remains UNKNOWN until an immutable DynamicSourceAdmissionRecord exists (§10.4). No such record exists in Alpha.5.',
      static_classification_not_live_pass: 'Obligation statuses are static reviewed classifications; nothing here is a real-Host PASS claim (execution-plan U4 law).',
      identity_is_per_process: 'Definition identity (the tool-dispatch def#N WeakMap algebra) is per-boot; cross-boot comparisons use the model-facing shape digest only.',
    },
    pins,
    inputs: {
      reviewed_seed: 'sources/u4-reviewed-obligations.seed.json',
      reviewed_seed_sha256: sha256File(SEED_OBLIGATIONS),
      matrix: 'docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md',
      matrix_sha256: sha256File(MATRIX),
      backlog: 'docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md',
      backlog_sha256: sha256File(BACKLOG),
      source_census_seed: 'sources/u1c-static-source-census.seed.json',
      source_census_seed_sha256: sha256File(SEED_SOURCES),
      unknown_dispositions_seed_sha256: sha256File(SEED_DISPOSITIONS),
    },
    counts,
    obligations,
    dynamic_source_classes: dynamicClasses,
  }

  const sourcesArtifact = {
    schema: 'u7-0/authoritative-tool-sources/v1',
    pins,
    inputs: {
      source_census_seed: 'sources/u1c-static-source-census.seed.json',
      source_census_seed_sha256: sha256File(SEED_SOURCES),
      unknown_dispositions_seed_sha256: sha256File(SEED_DISPOSITIONS),
    },
    note: 'Static source authority (U1-C): where each name is REGISTERED in the pinned Host / Team sources, per file:line. This is the third side of the EB2-A three-way diff; a runtime observation with no entry here (and no reviewed obligation) is UNKNOWN, never authorized.',
    static_sources: {
      host: srcSeeds.host.tools.map((t) => ({ authority: t.authority ?? null, file: t.file, gating: t.gating ?? null, line: t.line, name: t.name, package: t.package ?? null })).sort((a, b) => (a.name < b.name ? -1 : 1)),
      team: srcSeeds.team.tools.map((t) => ({ file: t.file, kind: t.kind, line: t.line, name: t.name })).sort((a, b) => (a.name < b.name ? -1 : 1)),
    },
    host_pin_provenance: srcSeeds.host.pin,
    team_pin_provenance: srcSeeds.team.pin,
    dynamic_source_classes: dynamicClasses,
  }

  const expectedPath = join(HERE, 'expected-tool-obligations.v1.json')
  const sourcesPath = join(HERE, 'authoritative-tool-sources.v1.json')
  const manifestPath = join(HERE, 'manifest.json')
  const expectedBytes = Buffer.from(`${JSON.stringify(expected, null, 1)}\n`, 'utf8')
  const sourcesBytes = Buffer.from(`${JSON.stringify(sourcesArtifact, null, 1)}\n`, 'utf8')

  const manifest = {
    schema: 'u7-0/tool-obligations-manifest/v1',
    artifacts: {
      'expected-tool-obligations.v1.json': sha256(expectedBytes),
      'authoritative-tool-sources.v1.json': sha256(sourcesBytes),
    },
    generator: 'build-expected-tool-obligations.mjs',
    generator_sha256: sha256File(join(HERE, 'build-expected-tool-obligations.mjs')),
    schemas: {
      'expected-tool-obligations.schema.json': sha256File(join(HERE, 'expected-tool-obligations.schema.json')),
      'authoritative-tool-sources.schema.json': sha256File(join(HERE, 'authoritative-tool-sources.schema.json')),
    },
    input_digests: expected.inputs,
    determinism: 'no timestamps, no environment values, canonical key order; replay over the same tree is byte-identical (--check enforces)',
  }
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`, 'utf8')

  if (check) {
    const mismatches = []
    const cmp = (p, bytes) => {
      if (!existsSync(p)) { mismatches.push(`${p}: MISSING on disk`); return }
      if (!readFileSync(p).equals(bytes)) mismatches.push(`${p}: byte-differs from the replayed generator output`)
    }
    cmp(expectedPath, expectedBytes)
    cmp(sourcesPath, sourcesBytes)
    // The manifest hashes its own inputs; compare artifact digests only.
    if (existsSync(manifestPath)) {
      const disk = readJson(manifestPath)
      if (disk.artifacts?.['expected-tool-obligations.v1.json'] !== manifest.artifacts['expected-tool-obligations.v1.json']) mismatches.push(`${manifestPath}: expected-digest differs`)
      if (disk.artifacts?.['authoritative-tool-sources.v1.json'] !== manifest.artifacts['authoritative-tool-sources.v1.json']) mismatches.push(`${manifestPath}: sources-digest differs`)
    } else mismatches.push(`${manifestPath}: MISSING on disk`)
    if (mismatches.length > 0) {
      process.stderr.write(`CHECK FAILED:\n${mismatches.join('\n')}\n`)
      process.exit(1)
    }
    process.stdout.write('CHECK OK — committed artifacts are the byte-exact replay of the generator\n')
    return
  }
  writeFileSync(expectedPath, expectedBytes)
  writeFileSync(sourcesPath, sourcesBytes)
  writeFileSync(manifestPath, manifestBytes)
  process.stdout.write(`wrote expected-tool-obligations.v1.json (${sha256(expectedBytes)})\nwrote authoritative-tool-sources.v1.json (${sha256(sourcesBytes)})\nmanifest.json digest-of-expected: ${manifest.artifacts['expected-tool-obligations.v1.json']}\n`)
}

main()
