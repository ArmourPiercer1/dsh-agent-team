/**
 * u7-0-census-reconcile.test.ts — the EB2-A CI hook (offline, C1).
 *
 * WHAT IS PINNED HERE:
 *  1. the tracked ExpectedToolObligations pair loads schema-clean and its
 *     bytes digests match the tracked manifest (the recorded digest law);
 *  2. the generator REPLAYS byte-identically over the tracked tree
 *     (`--check` — a tracked artifact that no longer reproduces from its
 *     tracked sources is a HARD fail: the artifact is a PROJECTION, the
 *     reviewed seeds are the input);
 *  3. the synthetic ObservedRuntimeInventory fixture reconciles to the
 *     pinned counts + pinned verdict_digest (any silent drift in the
 *     reconciler's semantics moves the digest and dies here);
 *  4. the three PLANTED COUNTEREXAMPLES (architecture §10.5-6: a negative
 *     control is a planted counterexample, never an absent observation):
 *       - inject an unknown `mcp__…` tool        → UNKNOWN (authorized:false);
 *       - replace an execution Definition        → DRIFT (identity, same boot;
 *         and shape, cross-boot — both spellings planted);
 *       - drop a required tool from every scope  → MISSING;
 *     each asserts the EXACT count delta + the named row + a moved verdict
 *     digest — the verification target "introducing an unknown MCP tool or
 *     replacing an execution Definition must be detected";
 *  5. the authorization law: no reconciler output on ANY plant carries
 *     authorized:true — discovery reports, never authorizes (§10.4).
 *
 * @module test/u7-0-census-reconcile
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadExpectedPair } from '../census/expected-obligations.mjs'
import { reconcile } from '../census/reconcile.mjs'
import type { ReconcileOutcome, ReconcileResult } from '../census/reconcile.mjs'
import { canonicalDigest, definitionShapeDigest } from '../census/json-canonical.mjs'
import { digestEligibleView, inventoryViolations, withDigests, OBSERVED_SCHEMA } from '../census/inventory.mjs'
import type { InventoryToolRow, ObservedInventory } from '../census/inventory.mjs'
import { validateAgainstSchema } from '../census/schema-check.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..')
const FIXTURE = join(REPO_ROOT, 'packages', 'testkit', 'census', 'fixtures', 'synthetic-non-team.inventory.json')
const TEST_ROWS = ['u7_census', 'u5_canary']

const loadFixture = (): ObservedInventory => JSON.parse(readFileSync(FIXTURE, 'utf8')) as ObservedInventory
const readJson = (p: string): Record<string, unknown> => JSON.parse(readFileSync(join(REPO_ROOT, p), 'utf8')) as Record<string, unknown>

const PINNED = {
  expected_digest: 'sha256:ea6c95ed75a9aacb94a16617d10eae75f399130defaa4b1db24e4984b3bfbda8'',
  sources_digest: 'sha256:abc825d2a93773339eb3ca831f99d3f15bf7726c41ac59947b77724c166cb30c',
  fixture_snapshot_digest: 'sha256:66da85efcfce68ab26708f37c6c880d002c7743d9e1c06f12fda716d28249c32',
  clean_counts: { missing: 0, unknown: 2, out_of_scope_observed: 32, source_findings: 0, drift: 0, scope_gaps: 18 },
  clean_verdict_digest: 'sha256:a467ab380a6451ab47fa3bdbed6a38461f22e850a9bf746ef6e693f3178d7ca5'',
}

const pair = loadExpectedPair(REPO_ROOT)
const bytesDigest = (rel: string) => `sha256:${createHash('sha256').update(readFileSync(join(REPO_ROOT, rel))).digest('hex')}`
const globalScope = (inv: ObservedInventory) => {
  const s = inv.scopes.find((x) => x.scope_id === 'global')
  if (s === undefined) throw new Error('fixture has no global scope')
  return s
}
const mustOk = (out: ReconcileOutcome): ReconcileResult => {
  if (!out.ok) throw new Error(`reconcile refused: ${JSON.stringify(out.violations.slice(0, 6))}`)
  return out.result
}

describe('u7-0 expected-obligations artifacts (tracked, replayable)', () => {
  it('loads schema-clean through the fail-closed loader', () => {
    expect(pair.expected.schema).toBe('u7-0/expected-tool-obligations/v1')
    expect(pair.sources.schema).toBe('u7-0/authoritative-tool-sources/v1')
    expect(pair.expected.counts).toEqual({ entries: 91, required: 58, out_of_scope: 33, named: 87, dynamic_classes: 3, surfaces: 1 })
  })

  it('bytes match the tracked manifest digests', () => {
    const manifest = readJson('dev/engineering/tool-obligations/manifest.json')
    const artifacts = manifest.artifacts as Record<string, string>
    expect(artifacts['expected-tool-obligations.v1.json']).toBe(PINNED.expected_digest)
    expect(artifacts['authoritative-tool-sources.v1.json']).toBe(PINNED.sources_digest)
    expect(pair.expected.__digest).toBe(bytesDigest('dev/engineering/tool-obligations/expected-tool-obligations.v1.json'))
    expect(pair.sources.__digest).toBe(bytesDigest('dev/engineering/tool-obligations/authoritative-tool-sources.v1.json'))
  })

  it('generator replays byte-identically (--check)', () => {
    // Offline, deterministic, no network: the generator itself refuses to
    // rewrite and exits 1 on ANY byte-diff against the tracked artifact.
    const out = execFileSync(process.execPath, ['dev/engineering/tool-obligations/build-expected-tool-obligations.mjs', '--check'], {
      cwd: REPO_ROOT, encoding: 'utf8', timeout: 60_000,
    })
    expect(out).toContain('CHECK OK')
  })
})

describe('u7-0 observed inventory fixture (schema + digest law)', () => {
  it('validates against the tracked schema and the runtime guard', () => {
    const inv = loadFixture()
    expect(inv.schema).toBe(OBSERVED_SCHEMA)
    expect(inventoryViolations(inv)).toEqual([])
    const schema = readJson('packages/testkit/census/observed-runtime-inventory.schema.json')
    const v = validateAgainstSchema(inv, schema)
    expect(v.ok === true ? [] : v.errors).toEqual([])
  })

  it('snapshot_digest recomputes (digest law: per-boot fields excluded)', () => {
    const inv = loadFixture()
    expect(canonicalDigest(digestEligibleView(inv))).toBe(inv.snapshot_digest)
    expect(inv.snapshot_digest).toBe(PINNED.fixture_snapshot_digest)
    // full_digest covers the ASSEMBLED bytes — the recorded digests are the
    // envelope, so strip them before recomputing.
    const { snapshot_digest: _s, full_digest: _f, ...assembled } = inv
    expect(canonicalDigest(assembled)).toBe(inv.full_digest)
    // the per-boot fields MUST NOT move the snapshot digest: rewrite every
    // definition_identity/change_seq and a new boot_id — digest stands.
    const mutated = structuredClone(inv)
    mutated.world.boot_id = 'other-boot'
    for (const s of mutated.scopes) {
      s.tools.forEach((t, i) => {
        t.definition_identity = `def#${String(9000 + i)}`
        t.change_seq = i % 2 === 0 ? 1234 : null
      })
    }
    const re = withDigests(mutated)
    expect(re.snapshot_digest).toBe(PINNED.fixture_snapshot_digest)
    expect(re.full_digest).not.toBe(inv.full_digest)
  })
})

describe('u7-0 reconciler — clean baseline + planted counterexamples', () => {
  const clean = (): ReconcileResult => mustOk(reconcile({ ...pair, observed: loadFixture(), testRowNames: TEST_ROWS }))

  it('clean baseline reconciles to the pinned counts and digest', () => {
    const result = clean()
    expect(result.counts).toEqual(PINNED.clean_counts)
    expect(result.verdict_digest).toBe(PINNED.clean_verdict_digest)
    // the two UNKNOWNs are ONLY the test rows; both reported, neither authorized
    expect(result.unknown.map((u) => String(u.name)).sort()).toEqual([...TEST_ROWS].sort())
    for (const u of result.unknown) {
      expect(u.authorized).toBe(false)
      expect(u.classification).toBe('test-row')
    }
    // the 18 team-lane obligations against a non-team snapshot are a scope
    // COVERAGE GAP — never silently MISSING, never silently OK.
    expect(result.scope_gaps.every((g) => g.expected_in === 'team-lane')).toBe(true)
    // dynamic classes appear as notes, never as name-matched observations
    expect(result.notes.some((n) => n.kind === 'dynamic-class')).toBe(true)
  })

  it('PLANT 1 — unknown mcp__-shaped tool is detected as UNKNOWN, never authorized', () => {
    const inv = loadFixture()
    const evil: InventoryToolRow = {
      name: 'mcp__planted_server__planted_tool',
      definition_identity: 'def#424242',
      schema_digest: definitionShapeDigest({ name: 'mcp__planted_server__planted_tool', description: 'planted', parameters: { type: 'object' }, outputSchema: { type: 'object' }, timeoutMsPresent: false }),
      identity_vs_global: 'n/a',
      change_seq: null,
      source_class: 'dynamic-source',
    }
    globalScope(inv).tools.push(evil)
    const agentScope = inv.scopes.find((x) => x.scope_id === 'agent-1')
    if (agentScope === undefined) throw new Error('fixture has no agent-1 scope')
    agentScope.tools.push({ ...evil })
    const pinned = withDigests(inv)
    const result = mustOk(reconcile({ ...pair, observed: pinned, testRowNames: TEST_ROWS }))
    expect(result.counts.unknown).toBe(PINNED.clean_counts.unknown + 1)
    const row = result.unknown.find((u) => u.name === evil.name)
    expect(row).toBeTruthy()
    expect(row?.classification).toBe('dynamic-instance-unadmitted')
    expect(row?.dynamic_class).toBe('mcp__<server>__<tool>')
    expect(row?.authorized).toBe(false)
    expect(row?.in_authoritative_sources).toBe(false)
    expect(result.verdict_digest).not.toBe(PINNED.clean_verdict_digest)
    // …and a NON-prefixed brand-new name lands the same way (auto-UNKNOWN)
    const inv2 = loadFixture()
    globalScope(inv2).tools.push({ name: 'brand_new_tool', definition_identity: 'def#1', schema_digest: definitionShapeDigest({ name: 'brand_new_tool' }), identity_vs_global: 'same', change_seq: null, source_class: 'unattributed' })
    const result2 = mustOk(reconcile({ ...pair, observed: withDigests(inv2), testRowNames: TEST_ROWS }))
    const row2 = result2.unknown.find((u) => u.name === 'brand_new_tool')
    expect(row2?.classification).toBe('not-in-obligations')
    expect(row2?.authorized).toBe(false)
  })

  it('PLANT 2 — replacing an execution Definition is detected as DRIFT', () => {
    const baseline = loadFixture()
    const observed = loadFixture()
    // same boot, one tool: the placement identity moved (Definition Body
    // replaced) while the model-facing shape held — exactly the U6 ARC-D
    // swap leg observed from the census side.
    const target = observed.scopes.find((s) => s.scope_id === 'global')?.tools.find((t) => t.name === 'read')
    if (target === undefined) throw new Error('fixture lost read')
    target.definition_identity = 'def#777777'
    const result = mustOk(reconcile({ ...pair, observed: withDigests(observed), baseline, testRowNames: TEST_ROWS }))
    expect(result.counts.drift).toBe(1)
    expect(result.drift[0]?.name).toBe('read')
    expect(result.drift[0]?.kind).toBe('definition-identity')
    expect(result.verdict_digest).not.toBe(PINNED.clean_verdict_digest)
    // cross-boot spelling: the SHAPE moved (identity numbers never compare
    // across boots, so this is the only cross-boot drift column).
    const observed2 = loadFixture()
    observed2.world.boot_id = 'a-different-boot'
    const t2 = observed2.scopes.find((s) => s.scope_id === 'global')?.tools.find((t) => t.name === 'read')
    if (t2 === undefined) throw new Error('fixture lost read')
    t2.schema_digest = definitionShapeDigest({ name: 'read', description: 'REPLACED execution definition', parameters: { type: 'object' }, outputSchema: { type: 'object' }, timeoutMsPresent: false })
    const observed2Pinned = withDigests(observed2)
    const result2 = mustOk(reconcile({ ...pair, observed: observed2Pinned, baseline, testRowNames: TEST_ROWS }))
    const shapeRow = result2.drift.find((d) => d.name === 'read' && d.kind === 'definition-shape')
    expect(shapeRow).toBeTruthy()
    // …and the shape drift moves the SNAPSHOT digest by design (it is a
    // digest-eligible fact — the fixed digest pins the reviewed shape).
    expect(observed2Pinned.snapshot_digest).not.toBe(PINNED.fixture_snapshot_digest)
  })

  it('PLANT 3 — dropping a required tool is detected as MISSING', () => {
    const inv = loadFixture()
    for (const s of inv.scopes) s.tools = s.tools.filter((t) => t.name !== 'read')
    const result = mustOk(reconcile({ ...pair, observed: withDigests(inv), testRowNames: TEST_ROWS }))
    expect(result.counts.missing).toBe(1)
    expect(result.missing[0]?.name).toBe('read')
    expect(result.missing[0]?.in_authoritative_sources).toBe(true)
    expect(result.missing[0]?.expected_in).toBe('native-scope')
    expect(result.verdict_digest).not.toBe(PINNED.clean_verdict_digest)
  })

  it('THE AUTHORIZATION LAW: no output on any plant ever carries authorized:true', () => {
    const plants: ReconcileOutcome[] = []
    const a = loadFixture()
    globalScope(a).tools.push({ name: 'mcp__x__y', definition_identity: null, schema_digest: definitionShapeDigest({ name: 'mcp__x__y' }), identity_vs_global: 'n/a', change_seq: null })
    plants.push(reconcile({ ...pair, observed: withDigests(a), testRowNames: TEST_ROWS }))
    const b = loadFixture()
    for (const s of b.scopes) s.tools = s.tools.filter((t) => t.name !== 'read')
    plants.push(reconcile({ ...pair, observed: withDigests(b), testRowNames: TEST_ROWS }))
    const c = loadFixture()
    const cObs = loadFixture()
    const first = globalScope(cObs).tools[0]
    if (first === undefined) throw new Error('fixture empty')
    first.definition_identity = 'def#999'
    plants.push(reconcile({ ...pair, observed: withDigests(cObs), baseline: c, testRowNames: TEST_ROWS }))
    for (const p of plants) {
      expect(p.ok).toBe(true)
      if (p.ok) expect(JSON.stringify(p.result)).not.toContain('"authorized":true')
    }
  })

  it('fail-closed: malformed inputs are refused, never reconciled', () => {
    const bad = loadFixture()
    const first = globalScope(bad).tools[0]
    if (first === undefined) throw new Error('fixture empty')
    first.schema_digest = 'not-a-digest'
    const out = reconcile({ ...pair, observed: bad, testRowNames: TEST_ROWS })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.violations.length).toBeGreaterThan(0)
  })
})

// ---- Review-R1 (REVIEW.md, 2026-10-26): planted controls for B2/B3/M1/M3/m2/m5.
// Every block below was RED against the pre-fix reconciler first (the RED log is
// booked in dev/agent-workflow/evidence/u7-0-census-20261026/review-r1-red.log).
const LIVE_TEAM = join(REPO_ROOT, 'dev', 'engineering', 'tool-obligations', 'baselines', 'observed-governed-team.20261026.json')
const loadLiveTeam = (): ObservedInventory => JSON.parse(readFileSync(LIVE_TEAM, 'utf8')) as ObservedInventory
const scope = (inv: ObservedInventory, id: string) => {
  const s = inv.scopes.find((x) => x.scope_id === id)
  if (s === undefined) throw new Error(`inventory has no scope ${id}`)
  return s
}
const rowIn = (inv: ObservedInventory, scopeId: string, name: string): InventoryToolRow => {
  const t = scope(inv, scopeId).tools.find((x) => x.name === name)
  if (t === undefined) throw new Error(`no row ${name} in ${scopeId}`)
  return t
}

describe('u7-0 review-R1 — B2: identity comparison keys on (scope, name)', () => {
  it('B2a — same-boot swap in the NON-FIRST fixture holder fires exactly once, attributed to that scope', () => {
    const base = loadFixture()
    const obs = structuredClone(base)
    rowIn(obs, 'agent-1', 'read').definition_identity = 'def#777777'
    const result = mustOk(reconcile({ ...pair, observed: withDigests(obs), baseline: base, testRowNames: TEST_ROWS }))
    const rows = result.drift.filter((d) => d.kind === 'definition-identity')
    expect(rows.length).toBe(1)
    expect(rows[0]?.scope_id).toBe('agent-1')
    expect(rows[0]?.scope_class).toBe('native')
    expect(result.counts.drift).toBe(1)
  })

  it('B2b — swap in a SECOND lane of the same class on the pinned LIVE team baseline: exactly one row, own scope', () => {
    const base = loadLiveTeam()
    const obs = structuredClone(base)
    rowIn(obs, 'agent-2', 'read').definition_identity = 'def#777777'
    const result = mustOk(reconcile({ ...pair, observed: withDigests(obs), baseline: base, testRowNames: TEST_ROWS }))
    const rows = result.drift.filter((d) => d.kind === 'definition-identity')
    expect(rows.length).toBe(1)
    expect(rows[0]?.scope_id).toBe('agent-2')
    expect(rows[0]?.scope_class).toBe('native')
  })

  it('B2c — the pre-fix misattribution (one swap reported under BOTH classes) cannot recur', () => {
    const base = loadFixture()
    const obs = structuredClone(base)
    rowIn(obs, 'global', 'read').definition_identity = 'def#777777'
    const result = mustOk(reconcile({ ...pair, observed: withDigests(obs), baseline: base, testRowNames: TEST_ROWS }))
    const identities = result.drift.filter((d) => d.kind === 'definition-identity')
    expect(identities.length).toBe(1)
    expect(identities[0]?.scope_id).toBe('global')
  })
})

describe('u7-0 review-R1 — M1: every DRIFT kind is separately planted and asserted', () => {
  it('M1-placement — moving ONLY identity_vs_global reports placement-identity-signal, never definition-shape', () => {
    const base = loadFixture()
    const obs = structuredClone(base)
    rowIn(obs, 'agent-1', 'read').identity_vs_global = 'differs'
    const result = mustOk(reconcile({ ...pair, observed: withDigests(obs), baseline: base, testRowNames: TEST_ROWS }))
    expect(result.counts.drift).toBe(1)
    expect(result.drift[0]?.kind).toBe('placement-identity-signal')
    expect(result.drift.some((d) => d.kind === 'definition-shape')).toBe(false)
  })

  it('M6 — same-boot change_seq move with unchanged shape reports revision (kills the revision mutant)', () => {
    const base = loadFixture()
    const obs = structuredClone(base)
    const t = rowIn(obs, 'agent-1', 'read')
    if (t.change_seq === null) throw new Error('fixture row must carry a change_seq')
    t.change_seq = t.change_seq + 1
    const result = mustOk(reconcile({ ...pair, observed: withDigests(obs), baseline: base, testRowNames: TEST_ROWS }))
    expect(result.counts.drift).toBe(1)
    expect(result.drift[0]?.kind).toBe('revision')
  })

  it('M7 — a moved source attribution reports the source kind (kills the source mutant)', () => {
    const base = loadFixture()
    const obs = structuredClone(base)
    rowIn(obs, 'agent-1', 'read').source_class = 'dynamic-source'
    const result = mustOk(reconcile({ ...pair, observed: withDigests(obs), baseline: base, testRowNames: TEST_ROWS }))
    const rows = result.drift.filter((d) => d.kind === 'source')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]?.name).toBe('read')
    expect(rows[0]?.scope_id).toBe('agent-1')
  })
})

type SourcesView = { schema: string; static_sources: { host: Array<Record<string, unknown>>; team: Array<Record<string, unknown>> } }
const cloneSources = (): SourcesView => structuredClone(pair.sources) as unknown as SourcesView

describe('u7-0 review-R1 — B3: AuthoritativeToolSources is a real third side', () => {
  it('B3a — REQUIRED obligation without ANY source registration is a finding (digest moves)', () => {
    const sources = cloneSources()
    sources.static_sources.team = sources.static_sources.team.filter((r) => r.name !== 'team_delegate')
    const before = mustOk(reconcile({ ...pair, observed: loadFixture(), testRowNames: TEST_ROWS }))
    const out = reconcile({ expected: pair.expected, sources, observed: loadFixture(), testRowNames: TEST_ROWS })
    const result = mustOk(out)
    const row = result.source_findings.find((f) => f.kind === 'required-without-source-registration' && f.name === 'team_delegate')
    expect(row).toBeTruthy()
    expect(row?.authorized).toBe(false)
    expect(result.counts.source_findings).toBe(before.counts.source_findings + 1)
    expect(result.verdict_digest).not.toBe(before.verdict_digest)
  })

  it('B3b — a source row with no obligation is a finding naming it', () => {
    const sources = cloneSources()
    sources.static_sources.host.push({ name: 'planted_source_only_tool', package: '@planted/none', file: 'packages/planted/src/index.ts', line: 1 })
    const result = mustOk(reconcile({ ...pair, observed: loadFixture(), sources, testRowNames: TEST_ROWS }))
    const row = result.source_findings.find((f) => f.kind === 'source-row-without-obligation' && f.name === 'planted_source_only_tool')
    expect(row).toBeTruthy()
    expect(row?.authorized).toBe(false)
  })

  it('B3c — an observed name absent from the sources side is a finding (sources disagree)', () => {
    const sources = cloneSources()
    sources.static_sources.host = sources.static_sources.host.filter((r) => r.name !== 'read')
    const result = mustOk(reconcile({ ...pair, observed: loadFixture(), sources, testRowNames: TEST_ROWS }))
    expect(result.source_findings.some((f) => f.kind === 'observed-not-in-sources' && f.name === 'read')).toBe(true)
  })

  it('B3-gen — the generator REFUSES to emit REQUIRED without any source (scratch replay, seed tampered)', () => {
    // The scratch must sit INSIDE the repo tree at the SAME depth
    // (dev/engineering/tool-obligations) — the generator resolves the host
    // pin + matrix/backlog from the repo root relative to its own location.
    // .artifacts/ is gitignored — it does not exist in a fresh CI checkout,
    // so the mkdtemp parent must be created (recursive) first.
    mkdirSync(join(REPO_ROOT, '.artifacts', 'tmp'), { recursive: true })
    const dir = mkdtempSync(join(REPO_ROOT, '.artifacts', 'tmp', 'u70-gen-refuse-'))
    try {
      const scratch = join(dir, 'dev', 'engineering', 'tool-obligations')
      mkdirSync(scratch, { recursive: true })
      cpSync(join(REPO_ROOT, 'dev', 'engineering', 'tool-obligations'), scratch, { recursive: true })
      // The generator resolves the host pin + matrix/backlog from THREE
      // levels above its own location — give the scratch that same repo
      // context (files it READS; nothing writes back). Without this the
      // refusal could come from a missing-pin crash instead of the rule.
      mkdirSync(join(dir, 'tests'), { recursive: true })
      cpSync(join(REPO_ROOT, 'tests', 'paths.mjs'), join(dir, 'tests', 'paths.mjs'))
      const planDir = join('docs', 'plans', 'active', 'alpha5-tool-io-governance')
      mkdirSync(join(dir, planDir), { recursive: true })
      for (const f of ['TOOL-CAPABILITY-MATRIX-9b2.md', 'ALPHA5-EFFECTIVE-BACKLOG.md']) {
        cpSync(join(REPO_ROOT, planDir, f), join(dir, planDir, f))
      }
      const seedFile = join(scratch, 'sources', 'u1c-static-source-census.seed.json')
      const seed = JSON.parse(readFileSync(seedFile, 'utf8')) as { host: { tools: Array<{ name: string }> } }
      seed.host.tools = seed.host.tools.filter((r) => r.name !== 'read')
      writeFileSync(seedFile, JSON.stringify(seed, null, 2) + '\n')
      let refused = false
      let stderr = ''
      try {
        execFileSync(process.execPath, [join(scratch, 'build-expected-tool-obligations.mjs')], { cwd: scratch, encoding: 'utf8', stdio: 'pipe' })
      } catch (err) {
        refused = true
        stderr = String((err as { stderr?: string }).stderr ?? err)
      }
      expect(refused).toBe(true)
      expect(stderr).toContain('read')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('trusted-config difference set is an explicit verdict section (B1 可信配置差集)', () => {
    const result = mustOk(reconcile({ ...pair, observed: loadFixture(), testRowNames: TEST_ROWS }))
    const tc = result.trusted_config
    expect(tc).toBeTruthy()
    expect(tc?.provider.observed_identity).toBe('NOT_OBSERVABLE')
    expect(tc?.provider.trusted_side).toBe('authoritative-tool-sources')
    expect(tc?.binding_identity).toContain('definitionIdentityOf')
    expect((tc?.additions as unknown[]).length).toBe(result.counts.unknown)
    expect((tc?.removals as unknown[]).length).toBe(result.counts.missing)
  })
})

describe('u7-0 review-R1 — M3: a known name in the WRONG scope class is UNKNOWN', () => {
  it('web_fetch surfacing on a governed team lane reports scope-mismatch, authorized:false', () => {
    const inv = loadFixture()
    inv.scopes.push({
      scope_id: 'agent-team-1', kind: 'agent', team_lane: true, team_lane_signal: 'team-names',
      tools: [{ name: 'web_fetch', definition_identity: 'def#5', schema_digest: rowIn(inv, 'global', 'grep').schema_digest, identity_vs_global: 'n/a', change_seq: null }],
    })
    const result = mustOk(reconcile({ ...pair, observed: withDigests(inv), testRowNames: TEST_ROWS }))
    const row = result.unknown.find((u) => u.name === 'web_fetch')
    expect(row).toBeTruthy()
    expect(row?.classification).toBe('scope-mismatch')
    expect(row?.authorized).toBe(false)
  })

  it('the reviewed team_lane_variant_expected flag suppresses the EXPECTED takeover (m6 consumption)', () => {
    // bash is reviewed WITH a Team native takeover (flag true): its same-name
    // governed row on a team lane is EXPECTED, never a scope-mismatch.
    const inv = loadFixture()
    inv.scopes.push({
      scope_id: 'agent-team-1', kind: 'agent', team_lane: true, team_lane_signal: 'native-takeover-identity',
      tools: [{ name: 'bash', definition_identity: 'def#6', schema_digest: rowIn(inv, 'global', 'bash').schema_digest, identity_vs_global: 'differs', change_seq: null, provider_identity: 'NOT_OBSERVABLE' }],
    })
    const result = mustOk(reconcile({ ...pair, observed: withDigests(inv), testRowNames: TEST_ROWS }))
    expect(result.unknown.some((u) => u.name === 'bash')).toBe(false)
  })
})

describe('u7-0 review-R1 — m2/m5: digest coverage and canonical invariance', () => {
  it('m2 — source_class and scope_id are digest-eligible facts now', () => {
    const a = loadFixture()
    rowIn(a, 'agent-1', 'read').source_class = 'team-native'
    expect(withDigests(a).snapshot_digest).not.toBe(PINNED.fixture_snapshot_digest)
    const b = loadFixture()
    scope(b, 'agent-1').scope_id = 'agent-renamed'
    expect(withDigests(b).snapshot_digest).not.toBe(PINNED.fixture_snapshot_digest)
  })

  it('m5 — key order and formatting do not move the canonical digest', () => {
    const inv = loadFixture()
    const deepReorder = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(deepReorder)
      if (v !== null && typeof v === 'object') {
        const out: Record<string, unknown> = {}
        for (const k of Object.keys(v as object).sort().reverse()) out[k] = deepReorder((v as Record<string, unknown>)[k])
        return out
      }
      return v
    }
    const reordered = JSON.parse(JSON.stringify(deepReorder(withDigests(inv)))) as ObservedInventory
    const re = withDigests(reordered)
    expect(re.snapshot_digest).toBe(withDigests(structuredClone(inv)).snapshot_digest)
    // textual round-trip through ugly whitespace also stands
    const reparsed = JSON.parse(JSON.stringify(reordered, null, 11)) as ObservedInventory
    expect(withDigests(reparsed).snapshot_digest).toBe(re.snapshot_digest)
  })
})
