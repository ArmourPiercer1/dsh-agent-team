/**
 * A5M2-WIRE-G2 B-ORCHESTRATION closed-table PAIRING (the plane-side law
 * of the execution arm, root 637842 round 2): the REAL
 * createTeamToolPlaneAssembly over the REAL createBOrchestrationExecution
 * Wiring. Legs: (a) zero flip — absent = byte-identical, no face, no
 * names; (b) the config law — the gate is config law both directions,
 * the inject is a closed key set, workflow is the always record; (c) the
 * ONE placement — ownNames, the plane placementFeed identities as the
 * ONLY family keys (the ownership handover: keys are PLACEMENT
 * identities, so a name the plane did not place answers nothing), the
 * PRODUCTION registry round-trip and the one-identity revision law;
 * (d) teardown — the mount's dispose drives the wiring's drain: a
 * post-dispose call meets the new-call prohibition with ZERO body
 * entries. No boot, no Host, no engine.
 */
import { describe, expect, it } from 'vitest'

import { definitionIdentityOf } from '../tool-dispatch/index.js'

const REALM = 'b-orch-plane-realm'
const PROVIDER = 'a5p5-plane'

interface Definition {
  name: string
  description: string
  parameters: unknown
  output: unknown
  execute: (args: Record<string, unknown>, exec?: unknown) => Promise<unknown>
}
interface Built { ok: boolean; code?: string; message?: string; value?: PlaneValue }
interface PlaneValue {
  ownNames: string[]
  definitions: Definition[]
  placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined
  bOrchestration?: { familyId: string, providerId: string, placementNames: string[], familyRegistrations: () => Array<{ name: string, recordIndex: number, definitionIdentity: string, entry: Record<string, unknown> }> }
  mount: (agentCtx: unknown) => { ok: boolean; code?: string; dispose?: () => unknown }
}

const PLANE_ROW = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built
}
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  registerA5GovernedFamily: (key: string, entry: Record<string, unknown>) => void
  a5GovernedFamilyFor: (key: string) => Record<string, unknown> | undefined
}
const WIRING_ROW = (await import(new URL('../src/plugin/live/governed-families/workflow-wiring.mjs', import.meta.url).href)) as {
  createBOrchestrationExecutionWiring: (input: Record<string, unknown>) => Record<string, unknown> & { ok: boolean; code?: string; message?: string }
}
const { registerA5GovernedFamily, a5GovernedFamilyFor } = REGISTRY

const POLICY_ASK = Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] })

function buildPlane (extra: Record<string, unknown> = {}, sink: string[] = []): Built {
  return PLANE_ROW.createTeamToolPlaneAssembly({
    teamSessionId: 'b-orch-plane-team',
    permissionPolicy: POLICY_ASK,
    realmId: REALM,
    templateId: 'b-orch-tpl',
    role: 'leader',
    instanceId: 'b-orch-instance',
    onObserve: (row: unknown) => sink.push(String(row)),
    ...extra,
  })
}

const mkNative = (name: string, calls: string[]): Definition => Object.freeze({
  name,
  description: `the published ${name} tool body (registration-face capture)`,
  parameters: Object.freeze({ type: 'object', properties: Object.freeze({ script: { type: 'string' }, meta: { type: 'object' } }), required: Object.freeze(['script', 'meta']) }),
  output: Object.freeze({ schema: Object.freeze({ type: 'object' }), render: (value: unknown) => JSON.stringify(value) }),
  async execute (args: Record<string, unknown>): Promise<unknown> {
    calls.push(name)
    return Object.freeze({ runId: 'run-1', agentsStarted: 1, result: 'settled', args })
  },
}) as unknown as Definition

/** The REAL wiring over the doubles; its placement feed reads LAZILY
 *  through the live plane value exactly like the glue arm (family keys can
 *  only ever be the PLANE's placement identities). workflow-only: ralph
 *  absent = the host-preset-off world (adapter's honest DECLARED row). */
function makeWiring (planeRef: { current: PlaneValue | null }): { calls: string[], wiring: Record<string, unknown> & { ok: boolean } } {
  const calls: string[] = []
  const workflow = mkNative('workflow', calls)
  const delegates = Object.freeze({ workflow: workflow.execute })
  const wiring = WIRING_ROW.createBOrchestrationExecutionWiring({
    providerId: PROVIDER,
    captured: Object.freeze({ workflow: Object.freeze({ native: workflow, definitionIdentity: 'capture-side:workflow' }) }),
    liveNative: (name: string) => (name === 'workflow' ? workflow : undefined),
    workflowDelegates: delegates,
    liveWorkflowDelegates: () => delegates,
    placementFeed: (name: string) => planeRef.current?.placementFeed(name),
    pa: Object.freeze(Object.assign(
      async () => ({ kind: 'allow', consumedProof: { token: 'spec-proof' } }),
      { closePlan: (_callId: string) => { /* spec plane */ } },
    )),
  })
  return { calls, wiring }
}

const injectOf = (wiring: Record<string, unknown>): Record<string, unknown> => Object.freeze({
  definitions: wiring.definitions,
  familyId: wiring.familyId,
  providerId: wiring.providerId,
  placementNames: wiring.placementNames,
  familyRegistrations: wiring.familyRegistrations,
  dispose: wiring.dispose,
})

describe('a5m2-b-orch-plane-mount (a) zero flip', () => {
  it('no inject = the ordinary mount byte-for-byte: no face (omitted, not undefined), no workflow/ralph ownNames, no placement rows', () => {
    const built = buildPlane()
    expect(built.ok, built.message).toBe(true)
    const value = built.value
    if (value === undefined) throw new Error('no plane value')
    expect('bOrchestration' in value, 'presence law: OMITTED when not deployed').toBe(false)
    expect(value.ownNames.filter((n) => n === 'workflow' || n === 'ralph')).toEqual([])
    expect(value.placementFeed('workflow')).toBeUndefined()
  })
})

describe('a5m2-b-orch-plane-mount (b) the injection law', () => {
  it('the gate is config law BOTH directions; a non-boolean gate, a bad family claim, a missing always-record row, and extra keys all refuse the MOUNT typed', () => {
    const planeRef: { current: PlaneValue | null } = { current: null }
    const { wiring } = makeWiring(planeRef)
    expect(wiring.ok).toBe(true)
    const enabledNoInject = buildPlane({ plane: { bOrchestrationEnabled: true } })
    expect(enabledNoInject.ok).toBe(false)
    expect(enabledNoInject.code).toBe('B_ORCHESTRATION_INJECT_INVALID')
    const gateOffInject = buildPlane({ plane: {}, backends: { bOrchestration: injectOf(wiring) } })
    expect(gateOffInject.ok).toBe(false)
    expect(gateOffInject.code).toBe('B_ORCHESTRATION_INJECT_INVALID')
    const nonBoolean = buildPlane({ plane: { bOrchestrationEnabled: 'yes' }, backends: { bOrchestration: injectOf(wiring) } })
    expect(nonBoolean.ok).toBe(false)
    expect(nonBoolean.code).toBe('B_ORCHESTRATION_INJECT_INVALID')
    const badFamily = buildPlane({
      plane: { bOrchestrationEnabled: true },
      backends: { bOrchestration: Object.freeze({ ...injectOf(wiring), familyId: 'B-WRONG' }) },
    })
    expect(badFamily.ok).toBe(false)
    expect(badFamily.code).toBe('B_ORCHESTRATION_INJECT_INVALID')
    const extraKey = buildPlane({
      plane: { bOrchestrationEnabled: true },
      backends: { bOrchestration: Object.freeze({ ...injectOf(wiring), extra: 1 }) },
    })
    expect(extraKey.ok).toBe(false)
    expect(extraKey.message).toContain('NOTHING else')
    // the always record without its row: a ralph-only inject is a census
    // violation — record 47 must ride every armed mount.
    const calls: string[] = []
    const ralphOnly = mkNative('ralph', calls)
    const ralphInject = Object.freeze({
      definitions: Object.freeze([ralphOnly]),
      familyId: 'B-ORCHESTRATION',
      providerId: PROVIDER,
      placementNames: Object.freeze(['ralph']),
      familyRegistrations: () => [],
      dispose: () => ({}),
    })
    const missingAlways = buildPlane({ plane: { bOrchestrationEnabled: true }, backends: { bOrchestration: ralphInject } })
    expect(missingAlways.ok).toBe(false)
    expect(missingAlways.message).toContain('always record')
  })
})

describe('a5m2-b-orch-plane-mount (c/d) placement, registry round-trip, teardown', () => {
  it('workflow rides the ONE placement: ownNames + placementFeed identities + family keys are PLACEMENT identities round-tripping the production registry; the mount dispose drains the wiring with ZERO body entries', async () => {
    const planeRef: { current: PlaneValue | null } = { current: null }
    const { calls, wiring } = makeWiring(planeRef)
    expect(wiring.ok).toBe(true)
    const built = buildPlane({ plane: { bOrchestrationEnabled: true }, backends: { bOrchestration: injectOf(wiring) } })
    expect(built.ok, built.message).toBe(true)
    const value = built.value
    if (value === undefined) throw new Error('no plane value')
    planeRef.current = value
    // (c1) placement carries workflow (the always record) and ONLY workflow
    // (ralph absent = the DECLARED row — zero-flip, no name, no claim).
    expect(value.ownNames).toContain('workflow')
    expect(value.ownNames).not.toContain('ralph')
    const face = value.bOrchestration
    if (face === undefined) throw new Error('no bOrchestration face')
    expect(face.familyId).toBe('B-ORCHESTRATION')
    expect(face.providerId).toBe(PROVIDER)
    expect(face.placementNames).toEqual(['workflow'])
    const placedByName = new Map(value.definitions.map((d) => [d.name, d]))
    const fed = value.placementFeed('workflow')
    const placed = placedByName.get('workflow')
    if (placed === undefined) throw new Error('no placed workflow def')
    expect(fed?.definitionIdentity).toBe(definitionIdentityOf(placed))
    expect(fed?.realmId).toBe(REALM)
    // (c2) the family key IS the placement identity (the ownership
    // handover: never the capture side) and round-trips the registry.
    const registrations = face.familyRegistrations()
    expect(registrations.map((r) => r.recordIndex)).toEqual([47])
    for (const registration of registrations) {
      expect(registration.definitionIdentity.startsWith('capture-side:'), 'keys are placement, not capture-side').toBe(false)
      registerA5GovernedFamily(registration.definitionIdentity, registration.entry)
      expect(a5GovernedFamilyFor(registration.definitionIdentity)?.familyId).toBe('B-ORCHESTRATION')
    }
    // one-identity revision law (the registry's own): re-claim idempotent,
    // a stale rev REFUSES, nothing is silently translated.
    const liveRev = registrations[0]?.entry.adapterRevision
    const firstIdentity = registrations[0]?.definitionIdentity
    if (firstIdentity === undefined) throw new Error('no placement identity to re-claim')
    expect(() => registerA5GovernedFamily(firstIdentity, registrations[0]?.entry ?? {})).not.toThrow()
    expect(() => registerA5GovernedFamily(firstIdentity, { familyId: 'B-ORCHESTRATION', adapterRevision: Number(liveRev) - 1, providerIdentity: PROVIDER })).toThrow(/config defect/)
    expect(a5GovernedFamilyFor(firstIdentity)?.adapterRevision).toBe(liveRev)
    // (d) the mount's dispose drives the wiring's drain: afterwards the
    // placed row meets the NEW-CALL PROHIBITION with zero body entries.
    const disposers: Array<() => unknown> = []
    const mounted = value.mount({ tools: { register: (def: Definition) => { disposers.push(() => { void def; return undefined }) } } })
    expect(mounted.ok).toBe(true)
    if (placed === undefined) throw new Error('no workflow def')
    mounted.dispose?.()
    const error = await placed.execute(
      { script: 'return 1', meta: { name: 'wf', description: 'd' } },
      { agent: { id: 'agent-m' }, callId: 'c-post', signal: new AbortController().signal },
    ).then(() => null, (e: unknown) => e as Error)
    expect(error, 'post-dispose calls refuse').toBeInstanceOf(Error)
    expect(String(error?.message)).toMatch(/CHILD_GOVERNANCE_UNGOVERNED|DRAINING|DISPOSED/)
    expect(calls, 'the original body never ran').toEqual([])
  })
})
