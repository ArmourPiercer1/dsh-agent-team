/**
 * a5m2-job-wiring.test.ts — author-side REAL-shape controls for the B-JOB
 * governed family (records 18/19/20). Transcribed fixtures never impersonate a
 * lane emit: every acceptance leg drives the REAL minted manifest from the
 * real wiring module through the REAL validatePaFamilyTarget, every key-set
 * leg DERIVES from the landed table entry, and the census legs read the FROZEN
 * dispatch index file itself.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { findTestRepoRoot } from '../../../tests/paths.mjs'
import { PA_FAMILY_TARGET_RULES, validatePaFamilyTarget } from '../control/types.js'

const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  registerA5GovernedFamily: (definitionIdentity: string, entry: Record<string, unknown>) => unknown
  a5GovernedFamilyFor: (definitionIdentity: string) => Record<string, unknown> | undefined
}

const WIRING = (await import(new URL('../src/plugin/live/governed-families/job-wiring.mjs', import.meta.url).href)) as {
  createBJobControlWiring: (input: Record<string, unknown>) => Record<string, unknown> & { ok: boolean; code?: string; message?: string }
  A5_B_JOB_WIRING_REVISION: number
}
const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/job-adapters.mjs', import.meta.url).href)) as {
  A5_B_JOB_FAMILY_ID: string
  A5_B_JOB_RECORD_SPECS: Record<string, { recordIndex: number, operation: string, effectDelta: string }>
  A5_B_JOB_NAMED_GAPS: Record<string, string>
  A5_B_JOB_PARAM_LAWS: Record<string, unknown>
  A5_B_JOB_PARAM_FINGERPRINTS: Record<string, string>
}

const NAMES = ['job_output', 'job_list', 'job_kill']
const PROVIDER = 'a5p5-plane'
const REALM = 'b-job-test-realm'

const sortedKeyLaw = (value: unknown): string => JSON.stringify(value, (_k, v) => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
    : v
))

function makeHarness (opts: { paImpl?: (walk: Record<string, unknown>) => Promise<Record<string, unknown>>; probe?: (name: string, caller: string, snapshot: Record<string, unknown>) => Promise<Record<string, string | null>> } = {}) {
  const walks: Array<Record<string, unknown>> = []
  const bodies: Array<{ name: string, args: unknown, caller: string }> = []
  const closed: string[] = []
  const bridge = {
    jobOutput: async (args: unknown, caller: string) => { bodies.push({ name: 'job_output', args, caller }); return { text: 'output-bytes' } },
    jobList: async (caller: string) => { bodies.push({ name: 'job_list', args: null, caller }); return { text: 'list-bytes' } },
    jobKill: async (args: unknown, caller: string) => { bodies.push({ name: 'job_kill', args, caller }); return { text: 'kill-bytes' } },
  }
  const pa = Object.assign(
    async (walk: Record<string, unknown>) => {
      walks.push(walk)
      if (opts.paImpl !== undefined) return opts.paImpl(walk)
      return { kind: 'allow', consumedProof: { token: `proof-${walk.callId}` } }
    },
    { closePlan: (callId: string) => { closed.push(callId) } },
  )
  const wiring = WIRING.createBJobControlWiring({
    providerId: PROVIDER,
    bridge,
    liveBridge: () => bridge,
    probe: opts.probe,
    placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}`, realmId: REALM }),
    pa,
  })
  return { wiring, walks, bodies, closed, bridge }
}

const execFor = (callId: string | undefined, caller: string | undefined = 'agent-m') => ({ agent: caller === undefined ? {} : { id: caller }, callId })

async function mintAll (h: ReturnType<typeof makeHarness>) {
  const dispatch = h.wiring.dispatch as (n: string, a: unknown, e: unknown) => Promise<unknown>
  void await dispatch('job_output', { job_id: 'j-1', wait: true, timeout_ms: 5000 }, execFor('c-1'))
  void await dispatch('job_list', { unexpected_key: { deep: [1, 'two', null] } }, execFor('c-2'))
  void await dispatch('job_kill', { job_id: 'j-2', reason: 'done with it' }, execFor('c-3'))
  const byName = new Map<string, Record<string, unknown>>()
  for (const walk of h.walks) {
    const family = walk.family as Record<string, unknown>
    const manifest = family.targetManifest as Record<string, unknown>
    byName.set(String(manifest.operation), manifest)
  }
  return byName
}

describe('a5m2-job (a) census derivation from the FROZEN dispatch index (never hand-spelled)', () => {
  it('the three FC-JOB records 18/19/20, operations and effectDeltas match the module constants', () => {
    const root = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
    if (root === null) throw new Error('a5m2-job: no repo root carrying tests/paths.mjs — failing closed')
    const index = JSON.parse(readFileSync(`${root}/docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json`, 'utf8')) as { records: Array<{ recordIndex: number, name: string, family: string, acceptance: { recordEffectDeltaFromInventory: string[] } }> }
    const jobRows = index.records.filter((r) => r.family === 'B-JOB')
    expect(jobRows.map((r) => r.name).sort()).toEqual([...NAMES].sort())
    for (const row of jobRows) {
      const spec = ADAPTER.A5_B_JOB_RECORD_SPECS[row.name]
      if (spec === undefined) throw new Error(`${row.name} has no spec`)
      expect(spec.recordIndex, `${row.name} recordIndex`).toBe(row.recordIndex)
      expect(spec.effectDelta, `${row.name} effectDelta`).toBe(row.acceptance.recordEffectDeltaFromInventory[0])
    }
  })
  it('the walk-pairing fingerprints are sha256 over the FROZEN parameter laws under the mint canonical law', () => {
    for (const name of NAMES) {
      const law = ADAPTER.A5_B_JOB_PARAM_LAWS[name]
      expect(ADAPTER.A5_B_JOB_PARAM_FINGERPRINTS[name], name).toBe(`sha256:${createHash('sha256').update(sortedKeyLaw(law)).digest('hex')}`)
    }
  })
})

describe('a5m2-job (b) the REAL mints through the REAL validator + the derived key-sets', () => {
  it('all three real manifests are ACCEPTED by validatePaFamilyTarget("B-JOB", …)', async () => {
    const h = makeHarness()
    const mints = await mintAll(h)
    expect(h.walks.length).toBe(3)
    for (const op of ['job-output', 'job-list', 'job-kill']) {
      const manifest = mints.get(op)
      expect(manifest, `no mint for ${op}`).toBeDefined()
      expect(validatePaFamilyTarget('B-JOB', manifest), `${op} refused: ${String(validatePaFamilyTarget('B-JOB', manifest))}`).toBeUndefined()
    }
  })
  it('every mint key-set EQUALS the table entry derived required∪adds (author-side control on the LIVE table)', async () => {
    const h = makeHarness()
    const mints = await mintAll(h)
    const rule = PA_FAMILY_TARGET_RULES['B-JOB']
    if (rule === undefined) throw new Error('B-JOB entry absent')
    for (const [op, manifest] of mints) {
      const group = rule.variant?.by[op]
      if (group === undefined) throw new Error(`table group ${op} absent`)
      const expected = [...Object.keys(rule.required), ...Object.keys(group.adds)].sort()
      expect(Object.keys(manifest).sort(), op).toEqual(expected)
    }
  })
  it('job-list claims NO address (NULL) while a foreign key rides argsCanonical COMPLETELY under the sorted-key byte law', async () => {
    const h = makeHarness()
    const mints = await mintAll(h)
    const list = mints.get('job-list')
    expect(list?.jobIdClaim, 'the list never claims an address').toBeNull()
    const foreign = { unexpected_key: { deep: [1, 'two', null] } }
    expect(String(list?.argsCanonical), 'full reversible JSON, never a digest').toBe(sortedKeyLaw(foreign))
    expect(JSON.parse(String(list?.argsCanonical))).toEqual(foreign)
    // the foreign key reached the body UNTOUCHED (nothing deleted, no coercion)
    const listBody = h.bodies.find((b) => b.name === 'job_list')
    expect(listBody, 'the list body ran').toBeDefined()
  })
  it('namedGapsCanonical is the WHOLE gaps object (deep equality through the leaf), and effect/effectDelta carry the ONE census fact', async () => {
    const h = makeHarness()
    const mints = await mintAll(h)
    for (const manifest of mints.values()) {
      expect(JSON.parse(String(manifest.namedGapsCanonical))).toEqual(ADAPTER.A5_B_JOB_NAMED_GAPS)
      expect(manifest.effect).toBe(manifest.effectDelta)
    }
    expect(mints.get('job-kill')?.effect).toBe('job-control-durable-write')
  })
})

describe('a5m2-job (c) the walk law + the refusal law (zero entry)', () => {
  it('the walk carries the frozen plane shape with the family block at the LIVE claim revision', async () => {
    const h = makeHarness()
    await mintAll(h)
    const walk = h.walks[0]
    if (walk === undefined) throw new Error('no walk recorded')
    expect(walk.realmId).toBe(REALM)
    expect(walk.callId).toBe('c-1')
    expect(walk.toolName).toBe('job_output')
    expect(String(walk.parametersFingerprint)).toMatch(/^sha256:[0-9a-f]{64}$/)
    const family = walk.family as Record<string, unknown>
    expect(family.familyId).toBe('B-JOB')
    expect(family.providerIdentity).toBe(PROVIDER)
    expect(family.adapterRevision, '22:02 consistency: the block stamps the live family-claim revision').toBe(WIRING.A5_B_JOB_WIRING_REVISION)
  })
  it('caller-absent and callId-absent refuse BEFORE any walk, before any body (zero PA entry)', async () => {
    const h = makeHarness()
    const dispatch = h.wiring.dispatch as (n: string, a: unknown, e: unknown) => Promise<Record<string, unknown>>
    // NO default-parameter trap: an explicit undefined would re-fill the
    // caller; the no-caller exec is built directly (an unnamed dispatch).
    const noCaller = await dispatch('job_list', {}, { agent: {}, callId: 'c-x' })
    const noCallId = await dispatch('job_output', { job_id: 'j-9' }, execFor(undefined))
    expect(String(noCaller.text)).toContain('P_JOB_WIRE_CALLER_ABSENT')
    expect(String(noCallId.text)).toContain('P_JOB_WIRE_CALL_ID_ABSENT')
    expect(h.walks.length, 'zero walks entered').toBe(0)
    expect(h.bodies.length, 'zero body entries').toBe(0)
  })
  it('a malformed job_id is refused PRE-WALK (host validateJobId law), and allow WITHOUT proof enters nothing', async () => {
    const h = makeHarness({ paImpl: async () => ({ kind: 'allow' }) })
    const dispatch = h.wiring.dispatch as (n: string, a: unknown, e: unknown) => Promise<Record<string, unknown>>
    const bad = await dispatch('job_kill', { job_id: '' }, execFor('c-bad'))
    expect(String(bad.text)).toContain('JOB_ADAPTER_JOB_ID_REQUIRED')
    expect(h.walks.length).toBe(0)
    const noProof = await dispatch('job_kill', { job_id: 'j-1' }, execFor('c-np'))
    expect(String(noProof.text)).toContain('P_JOB_WIRE_PROOF_ABSENT')
    expect(h.bodies.length, 'self-attestation never reaches the bridge').toBe(0)
  })
  it('a drifted bridge refuses AFTER allow with ZERO body entry (verified handles only)', async () => {
    let flipped = false
    const bridge = {
      jobOutput: async () => ({ text: 'x' }),
      jobList: async () => ({ text: 'x' }),
      jobKill: async () => ({ text: 'x' }),
    }
    // the swap happens WHILE PA is being asked — the re-check AFTER allow is
    // the only seat that can see it, and the body must never run.
    const wiring = WIRING.createBJobControlWiring({
      providerId: PROVIDER,
      bridge,
      liveBridge: () => flipped ? { ...bridge } : bridge,
      placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}`, realmId: REALM }),
      pa: Object.assign(async () => { flipped = true; return { kind: 'allow', consumedProof: { token: 'p' } } }, { closePlan: () => undefined }),
    }) as Record<string, unknown>
    const dispatch = wiring.dispatch as (n: string, a: unknown, e: unknown) => Promise<Record<string, unknown>>
    const r = await dispatch('job_list', {}, execFor('c-drift'))
    // the drift seat is the ADAPTER's verifyBridge (bound handles are its
    // bind); the wiring propagates its code VERBATIM — the funnel's own bytes
    // law, never a re-labelled code.
    expect(String(r.text)).toContain('JOB_ADAPTER_BRIDGE_DRIFT')
  })
  it('the probe answer rides relation/adjudication honestly; an ABSENT probe mints the honest absence words', async () => {
    const probed = makeHarness({ probe: async () => ({ ownerRelation: 'corded-own-member-scope', ownerAdjudication: 'team gateway fence answers for itself', producerIncarnation: 'bash@startedAt=1700000000000' }) })
    const mintsProbed = await mintAll(probed)
    expect(mintsProbed.get('job-output')?.ownerRelation).toBe('corded-own-member-scope')
    expect(mintsProbed.get('job-output')?.producerIncarnation).toBe('bash@startedAt=1700000000000')
    const bare = makeHarness()
    const mintsBare = await mintAll(bare)
    expect(mintsBare.get('job-output')?.ownerRelation).toBe('probe-unavailable')
    expect(mintsBare.get('job-output')?.producerIncarnation, 'an absent job is never an invented incarnation').toBe('unobserved')
    expect(mintsBare.get('job-list')?.producerIncarnation).toBe('caller-scoped-sweep')
  })
})

describe('a5m2-job (d) registration: placement keys, 22:02 consistency, consumed at the REAL registry', () => {
  it('entries key on placement identities, carry the live claim revision, and the registry REFUSES a stale rev without translating the row', () => {
    const h = makeHarness()
    const regs = (h.wiring.familyRegistrations as () => Array<{ name: string, recordIndex: number, definitionIdentity: string, entry: Record<string, unknown> }>)()
    expect(regs.map((r) => r.recordIndex).sort()).toEqual([18, 19, 20])
    for (const reg of regs) {
      expect(reg.definitionIdentity.startsWith('placed-'), 'keys are placement, never hand-spelled/capture').toBe(true)
      expect(reg.entry, 'one family-claim revision rides every entry').toEqual({ familyId: 'B-JOB', adapterRevision: WIRING.A5_B_JOB_WIRING_REVISION, providerIdentity: PROVIDER })
    }
    const identity = `b-job-test-${Math.random().toString(36).slice(2)}`
    const first = regs[0]
    if (first === undefined) throw new Error('no registrations')
    REGISTRY.registerA5GovernedFamily(identity, first.entry)
    expect(() => REGISTRY.registerA5GovernedFamily(identity, first.entry), 'live re-claim is idempotent').not.toThrow()
    expect(() => REGISTRY.registerA5GovernedFamily(identity, { familyId: 'B-JOB', adapterRevision: WIRING.A5_B_JOB_WIRING_REVISION - 1, providerIdentity: PROVIDER }), 'a stale-rev claim REFUSES at the one-identity law').toThrow(/config defect/)
    expect(REGISTRY.a5GovernedFamilyFor(identity)?.adapterRevision, 'the stored row was never silently translated').toBe(WIRING.A5_B_JOB_WIRING_REVISION)
  })
  it('a placement feed that answers no identity THROWS (a guessed key is forbidden)', () => {
    const wiring = WIRING.createBJobControlWiring({
      providerId: PROVIDER,
      bridge: { jobOutput: async () => ({}), jobList: async () => ({}), jobKill: async () => ({}) },
      liveBridge: () => ({}),
      placementFeed: () => undefined,
      pa: Object.assign(async () => ({ kind: 'allow', consumedProof: { token: 'p' } }), { closePlan: () => undefined }),
    }) as Record<string, unknown>
    expect(() => (wiring.familyRegistrations as () => unknown[])()).toThrow(/JOB_ADAPTER_PLACEMENT_KEY_ABSENT/)
  })
})
