/**
 * a5m2-job-plane-mount.test.ts — B-JOB slice-2 mount controls: the REAL
 * createTeamToolPlaneAssembly carries the FC-JOB rows; the governed leg is the
 * injected wiring face over a recording bridge double. Zero-flip legs first
 * (absent gate / absent face = today's rows byte-for-byte), then the governed
 * dispatch (one walk, verified body, refusal envelope), the inject law
 * (closed keys, gate law, frozen family), and the PRODUCTION registry
 * round-trip on PLACEMENT identities with the 22:02 stale-rev refusal.
 */
import { describe, expect, it } from 'vitest'

const REALM = 'b-job-plane-realm'
const PROVIDER = 'a5p5-plane'
const ROWS = ['job_kill', 'job_list', 'job_output']

interface Definition {
  name: string
  execute: (args: Record<string, unknown>, exec?: unknown) => Promise<Record<string, unknown>>
}
interface Built { ok: boolean; code?: string; message?: string; value?: PlaneValue }
interface PlaneValue {
  definitions: Definition[]
  placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined
  jobControl?: { familyId: string, providerId: string, placementNames: string[], familyRegistrations: () => Array<{ name: string, recordIndex: number, definitionIdentity: string, entry: Record<string, unknown> }> }
}

const PLANE_ROW = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built
}
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  registerA5GovernedFamily: (key: string, entry: Record<string, unknown>) => void
  a5GovernedFamilyFor: (key: string) => Record<string, unknown> | undefined
}
const WIRING_ROW = (await import(new URL('../src/plugin/live/governed-families/job-wiring.mjs', import.meta.url).href)) as {
  createBJobControlWiring: (input: Record<string, unknown>) => Record<string, unknown> & { ok: boolean; code?: string }
  A5_B_JOB_WIRING_REVISION: number
}

const POLICY_ASK = Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] })

function buildPlane (extra: Record<string, unknown> = {}): Built {
  return PLANE_ROW.createTeamToolPlaneAssembly({
    teamSessionId: 'b-job-plane-team',
    permissionPolicy: POLICY_ASK,
    realmId: REALM,
    templateId: 'b-job-tpl',
    role: 'leader',
    instanceId: 'b-job-instance',
    onObserve: () => undefined,
    ...extra,
  })
}

function makeBridge () {
  const calls: Array<{ name: string, caller: string | undefined }> = []
  const bridge = {
    async jobOutput (args: unknown, callerId: string) { calls.push({ name: 'job_output', caller: callerId }); return { text: `out:${String((args as { job_id?: string }).job_id)}` } },
    async jobList (callerId: string) { calls.push({ name: 'job_list', caller: callerId }); return { text: 'list-bytes' } },
    async jobKill (args: unknown, callerId: string) { calls.push({ name: 'job_kill', caller: callerId }); return { text: `kill:${String((args as { job_id?: string }).job_id)}` } },
  }
  return { bridge, calls }
}

function makeHarness (opts: { paImpl?: (walk: Record<string, unknown>) => Promise<Record<string, unknown>> } = {}) {
  const walks: Array<Record<string, unknown>> = []
  const planeRef: { current: PlaneValue | null } = { current: null }
  const { bridge, calls } = makeBridge()
  const wiring = WIRING_ROW.createBJobControlWiring({
    providerId: PROVIDER,
    bridge,
    liveBridge: () => bridge,
    placementFeed: (name: string) => planeRef.current?.placementFeed(name),
    pa: Object.assign(
      async (walk: Record<string, unknown>) => {
        walks.push(walk)
        if (opts.paImpl !== undefined) return opts.paImpl(walk)
        return { kind: 'allow', consumedProof: { token: `spec-proof-${String(walk.callId)}` } }
      },
      { closePlan: (_callId: string) => undefined },
    ),
  }) as Record<string, unknown> & { ok: boolean }
  expect(wiring.ok, 'the wiring builds over the doubles').toBe(true)
  const inject = Object.freeze({
    dispatch: wiring.dispatch,
    familyId: wiring.familyId,
    providerId: wiring.providerId,
    placementNames: wiring.placementNames,
    familyRegistrations: wiring.familyRegistrations,
    dispose: wiring.dispose,
  })
  const built = buildPlane({ plane: { jobsEnabled: true }, backends: { jobs: bridge, jobControl: inject } })
  if (built.value !== undefined) planeRef.current = built.value
  return { built, walks, calls, planeRef, wiring }
}

const rowNamed = (value: PlaneValue | undefined, name: string): Definition | undefined =>
  value?.definitions.find((d) => d.name === name)

describe('a5m2-job-mount (a) zero-flip legs', () => {
  it('jobsEnabled ABSENT carries no job rows at all', () => {
    const built = buildPlane()
    expect(built.ok).toBe(true)
    for (const name of ROWS) expect(rowNamed(built.value, name), name).toBeUndefined()
    expect(built.value?.jobControl, 'no face without deployment').toBeUndefined()
  })
  it('jobsEnabled ON with no jobControl keeps the honest non-governed leg byte-for-byte (bridge body, zero walks)', async () => {
    const { bridge, calls } = makeBridge()
    const built = buildPlane({ plane: { jobsEnabled: true }, backends: { jobs: bridge } })
    expect(built.ok).toBe(true)
    expect(built.value?.jobControl, 'the claim face rides only with the family').toBeUndefined()
    const row = rowNamed(built.value, 'job_list')
    const r = await row!.execute({}, { agent: { id: 'agent-a' }, callId: 'c-1' })
    expect(r).toEqual({ text: 'list-bytes' })
    expect(calls).toEqual([{ name: 'job_list', caller: 'agent-a' }])
  })
  it('a non-boolean jobsEnabled stays the typed config refusal (unchanged gate law)', () => {
    const built = buildPlane({ plane: { jobsEnabled: 'yes' } })
    expect(built.ok, 'refused').toBe(false)
    expect(String(built.message)).toContain('jobsEnabled must be a boolean')
  })
})

describe('a5m2-job-mount (b) the inject law', () => {
  it('a jobControl inject while jobsEnabled is OFF is refused (the gate is config law)', () => {
    const h = makeHarness()
    void h
    const wiring = WIRING_ROW.createBJobControlWiring({
      providerId: PROVIDER,
      bridge: makeBridge().bridge,
      liveBridge: () => makeBridge().bridge,
      placementFeed: () => undefined,
      pa: Object.assign(async () => ({ kind: 'allow', consumedProof: { token: 'p' } }), { closePlan: () => undefined }),
    }) as Record<string, unknown>
    const inject = Object.freeze({ dispatch: wiring.dispatch, familyId: wiring.familyId, providerId: wiring.providerId, placementNames: wiring.placementNames, familyRegistrations: wiring.familyRegistrations, dispose: wiring.dispose })
    const built = buildPlane({ backends: { jobControl: inject } })
    expect(built.ok, 'refused — rows were never mounted').toBe(false)
    expect(String(built.code)).toContain('JOB_CONTROL_INJECT_INVALID')
  })
  it('foreign keys and a foreign familyId are refused (closed inject, frozen family)', () => {
    const h = makeHarness()
    const wiring = h.wiring
    const base = { dispatch: wiring.dispatch, familyId: wiring.familyId, providerId: wiring.providerId, placementNames: wiring.placementNames, familyRegistrations: wiring.familyRegistrations, dispose: wiring.dispose }
    const withExtra = buildPlane({ plane: { jobsEnabled: true }, backends: { jobControl: Object.freeze({ ...base, extra: 1 }) } })
    expect(withExtra.ok).toBe(false)
    expect(String(withExtra.message)).toContain('closed key set')
    const wrongFamily = buildPlane({ plane: { jobsEnabled: true }, backends: { jobControl: Object.freeze({ ...base, familyId: 'B-OTHER' }) } })
    expect(wrongFamily.ok).toBe(false)
    expect(String(wrongFamily.message)).toContain('B-JOB')
  })
})

describe('a5m2-job-mount (c) the governed dispatch', () => {
  it('a row call walks ONCE with the family block, then serves through the VERIFIED bridge handle', async () => {
    const h = makeHarness()
    expect(h.built.ok).toBe(true)
    expect(h.built.value?.jobControl?.familyId).toBe('B-JOB')
    const row = rowNamed(h.built.value, 'job_output')
    const r = await row!.execute({ job_id: 'j-7' }, { agent: { id: 'agent-a' }, callId: 'c-42' })
    expect(r, 'the body answer rides through untouched').toEqual({ text: 'out:j-7' })
    expect(h.walks.length, 'exactly one walk').toBe(1)
    const walk = h.walks[0]!
    const family = walk.family as Record<string, unknown>
    const manifest = family.targetManifest as Record<string, unknown>
    expect(walk.callId).toBe('c-42')
    expect(walk.realmId, 'the walk realm is the placement fact').toBe(REALM)
    expect(family.familyId).toBe('B-JOB')
    expect(family.adapterRevision, '22:02 consistency at the mount').toBe(WIRING_ROW.A5_B_JOB_WIRING_REVISION)
    expect(manifest.recordIndex).toBe(18)
    expect(manifest.jobIdClaim).toBe('j-7')
    expect(h.calls).toEqual([{ name: 'job_output', caller: 'agent-a' }])
  })
  it('a PA refusal answers the closed { text } envelope with ZERO bridge entry', async () => {
    const h = makeHarness({ paImpl: async () => ({ kind: 'refuse', code: 'policy-ask', detail: 'the funnel says no' }) })
    const row = rowNamed(h.built.value, 'job_kill')
    const r = await row!.execute({ job_id: 'j-1' }, { agent: { id: 'agent-a' }, callId: 'c-9' })
    expect(String(r.text)).toContain('refused: policy-ask — the funnel says no')
    expect(h.calls.length, 'the bridge never ran').toBe(0)
  })
  it('an unnamed dispatch is refused at the row (never un-fenced), zero walk, zero body', async () => {
    const h = makeHarness()
    const row = rowNamed(h.built.value, 'job_list')
    const r = await row!.execute({}, { callId: 'c-8' })
    expect(String(r.text)).toContain('P_JOB_WIRE_CALLER_ABSENT')
    expect(h.walks.length).toBe(0)
    expect(h.calls.length).toBe(0)
  })
})

describe('a5m2-job-mount (d) the registration round-trip (PRODUCTION registry, PLACEMENT keys)', () => {
  it('familyRegistrations key on the plane placement identities; the registry idempotently takes the live rev and REFUSES a stale one untranslated', () => {
    const h = makeHarness()
    const face = h.built.value?.jobControl
    if (face === undefined) throw new Error('no face')
    const regs = face.familyRegistrations()
    expect(regs.map((r) => r.recordIndex).sort()).toEqual([18, 19, 20])
    for (const reg of regs) {
      const fed = h.planeRef.current?.placementFeed(reg.name)
      expect(reg.definitionIdentity, `${reg.name} keys on the PLACEMENT identity`).toBe(fed?.definitionIdentity)
      expect(reg.entry).toEqual({ familyId: 'B-JOB', adapterRevision: WIRING_ROW.A5_B_JOB_WIRING_REVISION, providerIdentity: PROVIDER })
    }
    const first = regs[0]!
    REGISTRY.registerA5GovernedFamily(first.definitionIdentity, first.entry)
    expect(() => REGISTRY.registerA5GovernedFamily(first.definitionIdentity, first.entry)).not.toThrow()
    expect(() => REGISTRY.registerA5GovernedFamily(first.definitionIdentity, { familyId: 'B-JOB', adapterRevision: WIRING_ROW.A5_B_JOB_WIRING_REVISION - 1, providerIdentity: PROVIDER })).toThrow(/config defect/)
    expect(REGISTRY.a5GovernedFamilyFor(first.definitionIdentity)?.adapterRevision).toBe(WIRING_ROW.A5_B_JOB_WIRING_REVISION)
  })
})
