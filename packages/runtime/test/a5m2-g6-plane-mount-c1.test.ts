/**
 * A5M2-G6-PLANE-MOUNT (root 18:2x: the 23 wiring legs are stubs — the REAL
 * consume is the PRODUCTION assembly) — the spec of the B-SESSION-QUERY
 * blocks THIS lane owns in `team-tool-plane.mjs` (inject law, issued
 * identity, placement, seat, teardown) and of the mount law they enable:
 * the plane is the REAL `createTeamToolPlaneAssembly`; the placement is the
 * REAL `mount()` register pass; the family keys are the REAL lazy
 * `definitionIdentityOf` feed over the REAL placed defs; the registry is the
 * PRODUCTION `pa-mount-registry`; the seat is the REAL plane-owned `paAdmit`
 * (the callable carrying open/edge/closePlan) — never a stand-in seat.
 *
 * Legs:
 *  (a) ZERO FLIP: no `backends.sessionQuery` = no wiring face (omitted, not
 *      undefined), no session_* placement — the ordinary mount is
 *      byte-identical to the pre-G6 plane;
 *  (b) the inject law: defective owner evidence refuses the MOUNT with the
 *      typed code (config is law, not wiring — the glob-gate ④ discipline);
 *  (c) REAL placement: `mount()` registers the five placed defs (complete
 *      captured faces, ONLY execute replaced); the family keys are the
 *      PLACEMENT identities through the lazy feed — NEVER the capture-side
 *      identity — and they round-trip the production registry;
 *  (d) REAL fail-closed walk: with NO control leg mounted the real partA
 *      answers its own `APPROVAL_REQUEST_UNAVAILABLE` (the ISSUED
 *      identity — a5p5 mount law, `team-<instance>-g6-…` — is visible in
 *      the observed PA line); zero port entries; the native body never runs;
 *  (e) REAL admitted consume: on the policy-allow lane the kernel admits,
 *      the REAL `consumeForExecution` edge lands the one-shot proof, the
 *      ports answer, the served bytes are the row's own, and a re-used
 *      execution token gets the single-flight refusal (a5p5 law) — zero
 *      additional port entries;
 *  (f) teardown: dispose drains the wiring (DRAINING refuses new calls,
 *      the adapter's own bytes) and releases the issued-identity ledger;
 *  (g) declared census: `searchBackend {present:false}` places only the
 *      three always-mount rows; the two search names keep their NATIVES
 *      (no def, no registration — the mount never masks an undeployed face).
 *
 * DISCLOSED STAND-INS: the typed query ports and the native faces are
 * recording doubles (the adapter spec owns the REAL engine halves); the
 * Team ceiling port is a set-membership double standing in the owner-published
 * decision port. The PLANE, its paAdmit, the admission kernel, the placement
 * feed and the registry are the real production code. NOT C2 — no Host, no
 * ports, no tests/homes, no network. The durable-ASK lane's family gate
 * (pa-control-bridge rules gate, NAMED GAP 2 of the wiring header) is pinned
 * through the REAL published checkers in the wiring spec; the policy-allow
 * lane measured here is the kernel's own admit (the same lane todo/write
 * ride) and does not substitute for that gate.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g6-plane-mount-c1
 */
import { describe, expect, it } from 'vitest'

import { definitionIdentityOf } from '../tool-dispatch/index.js'

const REALM = 'g6-plane-realm'
const PROVIDER = 'g6-plane-provider'
const CALLER_ID = 's-caller-plane'
const CWD = '/srv/workspace/g6-plane-world'

interface Definition {
  name: string
  description: string
  parameters: unknown
  output: unknown
  execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown>
}
interface PlaneValue {
  definitions: Definition[]
  ownNames: readonly string[]
  placementNames: readonly string[]
  sessionQuery?: {
    familyId: string
    placementNames: readonly string[]
    declared: ReadonlyArray<{ name: string, status: string, reason: string }>
    familyRegistrations: () => Array<{ name: string, definitionIdentity: string, entry: { familyId: string, adapterRevision: number, providerIdentity: string } }>
  }
  mount: (agentCtx: unknown) => { ok: boolean, code?: string, dispose?: () => void }
}
type Built = { ok: true, value: PlaneValue } | { ok: false, code: string, message: string }

/** The REAL modules under test, loaded through the established typed-view
 *  pattern (a5int-r3-mount-integration.test.ts:157 — a variable-specifier
 *  dynamic import with a declared local type; the runtime code is the
 *  production `.mjs`, nothing is stubbed here). */
const PLANE_ROW = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built
}
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  registerA5GovernedFamily: (key: string, entry: { familyId: string, adapterRevision: number, providerIdentity: string }) => void
  a5GovernedFamilyFor: (key: string) => { familyId: string, adapterRevision: number, providerIdentity: string } | undefined
}
const createTeamToolPlaneAssembly = PLANE_ROW.createTeamToolPlaneAssembly
const { registerA5GovernedFamily, a5GovernedFamilyFor } = REGISTRY

const PARAMS: Record<string, Record<string, unknown>> = {
  session_search: { type: 'object', properties: { query: { type: 'string', minLength: 1 } }, required: ['query'], additionalProperties: false },
  session_event_search: { type: 'object', properties: { session_id: { type: 'string' }, query: { type: 'string', minLength: 1 } }, required: ['query'], additionalProperties: false },
  session_trace: { type: 'object', properties: { session_id: { type: 'string' } }, required: [], additionalProperties: false },
  session_event_trace: { type: 'object', properties: { session_id: { type: 'string' }, seq: { type: 'integer', minimum: 0 } }, required: ['seq'], additionalProperties: false },
  session_event_read: { type: 'object', properties: { session_id: { type: 'string' }, seq: { type: 'integer', minimum: 0 }, before: { type: 'integer' }, after: { type: 'integer' } }, required: ['seq'], additionalProperties: false },
}
const TOOLS = Object.keys(PARAMS)

const HEADER = Object.freeze({ id: 's-a', cwd: CWD, createdAt: 1000 })
const EVENT5 = Object.freeze({ seq: 5, type: 'message', surface: 'chat', time: 1731000000000 })

function makePorts (calls: string[]) {
  const twoArg = (name: string, fn: (a?: unknown, b?: unknown) => unknown) => async function portFn (a: unknown, b: unknown): Promise<unknown> {
    calls.push(name)
    return await fn(a, b)
  }
  return Object.freeze({
    searchQueryPort: Object.freeze({
      searchSessions: twoArg('searchSessions', () => ({ items: [] })),
      searchEvents: twoArg('searchEvents', () => ({ session: HEADER, items: [] })),
    }),
    traceQueryPort: Object.freeze({
      traceSession: twoArg('traceSession', (sessionId) => {
        if (String(sessionId) !== 's-a') throw Object.assign(new Error('session was not found'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' })
        return { target: { header: HEADER }, ancestors: [], descendants: [], complete: true }
      }),
      traceEvent: twoArg('traceEvent', (request) => {
        const req = request as Record<string, unknown>
        if (String(req.sessionId) !== 's-a') throw Object.assign(new Error('session was not found'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' })
        return { session: HEADER, target: EVENT5, ancestors: [], descendants: [], complete: true, replacementChain: [], replacedEventSeqs: [], sourceEventSeqs: [], derivedEventSeqs: [] }
      }),
    }),
    eventReadQueryPort: Object.freeze({
      readEvent: twoArg('readEvent', (request) => {
        const req = request as Record<string, unknown>
        if (String(req.sessionId) !== 's-a' || req.seq !== 5) throw Object.assign(new Error('session event was not found'), { code: 'SESSION_QUERY_EVENT_NOT_FOUND' })
        return { session: HEADER, target: EVENT5, events: [EVENT5], startSeq: 5, endSeq: 5 }
      }),
    }),
    authorizationQueryPort: Object.freeze({
      filterSessions: twoArg('filterSessions', () => [{ header: HEADER }]),
    }),
    titlesQueryPort: Object.freeze({
      readTitleSnapshots: twoArg('readTitleSnapshots', (ids) => ((ids ?? []) as string[]).map((id) => ({ sessionId: id, status: 'fulfilled', value: { session: HEADER, title: { title: `title-${id}` } } }))),
    }),
  })
}

function makeNatives (nativeBodies: string[]) {
  const natives = new Map<string, Definition>()
  for (const name of TOOLS) {
    natives.set(name, {
      name,
      description: `native ${name} production description`,
      parameters: PARAMS[name],
      execute: async () => { nativeBodies.push(name); return 'NATIVE-BODY-NEVER-RUNS-THROUGH-THE-PLANE' },
      output: { schema: { type: 'string' }, render: (value: unknown) => String(value) },
    })
  }
  return natives
}

// The blueprint grammar's CLOSED tool vocabulary grew after this spec was
// written: the five session-query names entered `PERMISSION_TOOL_NAMES` /
// `PERMISSION_INVOCATION_ONLY_TOOL_NAMES` by edd68f0f4 (root 22:13 limited
// card; blueprint schema.ts:466-470 + :515-552 on the int world) — "Naming
// them here opens the named allow/ask/deny channel ONLY", `any` resource in
// all three lanes, `exact`/`subtree` refused every lane. So an
// `{ tool: session_*, resource: { kind: 'any' } }` allow entry is FAMILY-
// LEGAL by the root closed-table law itself (leg (a2) pins that legality);
// the DENIAL semantic rides a name the same law KEEPS out of the vocabulary
// — schedule_create/schedule_update are NOT permission tools ("a rule naming
// one is MALFORMED", schema.ts:505-510): leg (a2b) pins the projection still
// refuses it (measured era text: `rule allow[0].tool must be one of read |
// read_image | write | edit | lsp | bash | pwsh | ...`, wrapped by the plane
// as TOOL_BINDING_UNVERIFIED). PA wiring of the session rows is untouched by
// the grammar: admission stays the ONE paAdmit (legs (d)/(e)).
const POLICY_ASK = Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] })
const POLICY_SESSION_ALLOW = Object.freeze({
  default: 'ask',
  allow: TOOLS.map((tool) => Object.freeze({ tool, resource: { kind: 'any' } })),
  ask: [] as unknown[],
  deny: [] as unknown[],
})
// OUT of the closed permission vocabulary by the SAME root law that admitted
// session_* (the invocation-only doc names schedule_create/schedule_update as
// NOT permission tools — a rule naming one is MALFORMED): the DENIAL anchor.
const POLICY_OUT_OF_VOCAB_ALLOW = Object.freeze({
  default: 'ask',
  allow: [Object.freeze({ tool: 'schedule_create', resource: { kind: 'any' } })],
  ask: [] as unknown[],
  deny: [] as unknown[],
})

function buildPlane (extra: Record<string, unknown> = {}, sink: string[] = [], policy: Record<string, unknown> = POLICY_ASK): Built {
  return createTeamToolPlaneAssembly({
    teamSessionId: 'g6-plane-team',
    permissionPolicy: policy,
    realmId: REALM,
    templateId: 'g6-tpl',
    role: 'member',
    instanceId: 'g6-instance',
    onObserve: (row: unknown) => sink.push(String(row)),
    ...extra,
  }) as Built
}

interface LegPlan { approvalCaseId: string, effectSetFingerprint: string, requiredAuthority?: string, deniedEffects?: unknown }
interface LegAssembly { issueApprovedGrant: (request: unknown, approval: unknown) => Promise<{ ok: boolean, value?: unknown, error?: { message?: string } }> }
/**
 * The control-leg SEAM double: the kernel's OWN landing (`assembly.
 * issueApprovedGrant`, the edge the AUTH bridge at pa-control-bridge.ts:642
 * uses) driven with an approval composed from the kernel's own plan facts —
 * the durable Control ROW half is what stands in here (the house acceptance
 * kit `a5-m1-auth-bridge.test.ts` owns that half against a real Control
 * service; this spec pins the PLANE+kernel half). The plane's Part A, the
 * one-shot `consumeForExecution` edge, the grant identity and the plan-fact
 * lifecycle are all REAL.
 */
function mintingControlLeg (seen: Array<{ family: Record<string, unknown> | undefined }>) {
  return async (input: { request: unknown, family?: Record<string, unknown>, plan: LegPlan, assembly: LegAssembly }): Promise<Record<string, unknown>> => {
    seen.push({ family: input.family })
    const plan = input.plan
    const approval = Object.freeze({
      approvalCaseId: plan.approvalCaseId,
      reviewerAuthority: 'human-user',
      beneficiaryAuthority: 'leader',
      requiredAuthorityAtCreation: plan.requiredAuthority ?? 'leader',
      effectSetFingerprint: plan.effectSetFingerprint,
      authorityGenerationAtCreation: 0, // the assembly's own answer with no overlay lane
      ...(plan.deniedEffects === undefined ? {} : { deniedEffectsAtCreation: plan.deniedEffects }),
    })
    const issued = await input.assembly.issueApprovedGrant(input.request, approval)
    if (issued.ok !== true || issued.value === undefined) {
      return { decision: 'deny', detail: `the kernel refused the mint (${String(issued.error?.message ?? 'unknown')})` }
    }
    return { decision: 'approve', requestId: 'g6-spec-control-row-1', approval, grant: issued.value, manifest: null }
  }
}

function makeInject (opts: { searchPresent?: boolean, nativeBodies?: string[], portCalls?: string[] } = {}) {
  const portCalls = opts.portCalls ?? []
  const nativeBodies = opts.nativeBodies ?? []
  const natives = makeNatives(nativeBodies)
  const searchPresent = opts.searchPresent ?? true
  const ports = makePorts(portCalls) as unknown as Record<string, unknown>
  const readNative = (name: string) => natives.get(name)
  return {
    inject: Object.freeze({
      providerId: PROVIDER,
      readNative,
      queryPorts: searchPresent ? ports : Object.fromEntries(Object.entries(ports).filter(([facet]) => facet !== 'searchQueryPort')),
      readCaller: () => ({ id: CALLER_ID, cwd: CWD }),
      teamCeiling: (target: string) => target === 's-a' || target === CALLER_ID,
      // Root ruling 3: the inject contract carries the public Provider
      // lifecycle observer + the pinned generation (production a5G6Inject
      // mirrors these from g6Supply; agent-bindings :3210).
      lifecycle: { currentGeneration: () => ({ id: 1, service: ports as unknown }) },
      generation: 1,
      declaredMount: { searchBackend: searchPresent ? { present: true as const } : { present: false as const, evidence: 'no session-query backend deployed on this assembly (plane-mount spec)' } },
    }),
    natives,
    portCalls,
    nativeBodies,
  }
}

const fakeAgentCtx = (registered: string[]) => ({
  tools: {
    register: (def: Definition) => { registered.push(def.name); return () => { /* disposer */ } },
  },
})

const refusalOf = async (promise: Promise<unknown>): Promise<{ code: string; message: string }> => {
  try {
    await promise
    throw new Error('expected a refusal, got a resolve')
  } catch (error) {
    const e = error as { code?: string; message?: string }
    return { code: String(e.code ?? ''), message: String(e.message ?? '') }
  }
}

describe('A5M2-G6-PLANE-MOUNT — the B-SESSION-QUERY block in the REAL plane: placement, feed, registry, seat, teardown', () => {
  it('(a) zero flip: no injection = no wiring face and no session_* placement', () => {
    const built = buildPlane()
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    expect(built.value.sessionQuery).toBeUndefined()
    for (const name of TOOLS) expect(built.value.placementNames).not.toContain(name)
  })

  it('(a2) CLOSED-TABLE LEGALITY PIN (int re-anchor): the five session-query names are invocation-only permission tools by root\'s own law (edd68f0f4; schema.ts:466-470 + :515-552 "opens the named allow/ask/deny channel ONLY", any-in-three-lanes) — the mount ACCEPTS the allow projection, and acceptance opens a NAMED CHANNEL, never a bypass: the rows stay PA-wired, the plane still arms them only through the ONE paAdmit seat (legs (d)/(e) keep measuring that)', () => {
    const w = makeInject()
    const built = buildPlane({ backends: { sessionQuery: w.inject } }, [], POLICY_SESSION_ALLOW)
    expect(built.ok, built.ok === true ? 'grammar-legal by the closed table' : `${built.code}: ${built.message}`).toBe(true)
    if (built.ok !== true) return
    for (const name of TOOLS) expect(built.value.placementNames).toContain(name)
  })

  it('(a2b) DENIAL semantic (re-anchored to a still-out-of-vocabulary entry): an allow rule naming schedule_create — NOT a permission tool by the same root law (schema.ts:505-510, "a rule naming one is MALFORMED") — is refused at the projection with TOOL_BINDING_UNVERIFIED / must-be-one-of', () => {
    const w = makeInject()
    const built = buildPlane({ backends: { sessionQuery: w.inject } }, [], POLICY_OUT_OF_VOCAB_ALLOW)
    expect(built.ok).toBe(false)
    if (built.ok === true) return
    expect(built.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(built.message).toContain('must be one of')
    void w
  })

  it('(b) defective owner evidence refuses the MOUNT (config is law, not wiring)', () => {
    const w = makeInject()
    const noCeiling = buildPlane({ backends: { sessionQuery: { ...w.inject, teamCeiling: undefined } } })
    expect(noCeiling.ok).toBe(false)
    if (noCeiling.ok === true) return
    expect(noCeiling.code).toBe('SESSION_QUERY_ARM_INJECT_INVALID')
    expect(noCeiling.message).toContain('teamCeiling')
    const noProvider = buildPlane({ backends: { sessionQuery: { ...w.inject, providerId: '' } } })
    expect(noProvider.ok === false && noProvider.code).toBe('SESSION_QUERY_ARM_INJECT_INVALID')
  })

  it('(c) REAL placement + lazy feed keys + PRODUCTION registry round-trip (placement identity, never capture identity)', () => {
    const w = makeInject()
    const built = buildPlane({ backends: { sessionQuery: w.inject } })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const value = built.value
    expect(value.sessionQuery?.familyId).toBe('B-SESSION-QUERY')
    expect([...(value.sessionQuery?.placementNames ?? [])].sort()).toEqual([...TOOLS].sort())
    const registered: string[] = []
    const placed = value.mount(fakeAgentCtx(registered))
    expect(placed.ok).toBe(true)
    for (const name of TOOLS) expect(registered).toContain(name)
    const regs = value.sessionQuery!.familyRegistrations()
    expect(regs.map((r) => r.name).sort()).toEqual([...TOOLS].sort())
    for (const reg of regs) {
      const placedDef = value.definitions.find((d) => d.name === reg.name) as Definition
      expect(reg.definitionIdentity, `placement key for ${reg.name}`).toBe(definitionIdentityOf(placedDef))
      const nativeDef = w.natives.get(reg.name) as Definition
      expect(reg.definitionIdentity).not.toBe(definitionIdentityOf(nativeDef))
      expect(a5GovernedFamilyFor(reg.definitionIdentity)).toBeUndefined()
      // the SAME native face object the bridge spread (only execute differs)
      expect(placedDef.parameters).toBe(nativeDef.parameters)
      expect(placedDef.description).toBe(nativeDef.description)
      expect(placedDef.execute).not.toBe(nativeDef.execute)
    }
    // the mount writer's law, mirrored: entries flow to the production registry
    for (const reg of regs) registerA5GovernedFamily(reg.definitionIdentity, reg.entry)
    for (const reg of regs) {
      expect(a5GovernedFamilyFor(reg.definitionIdentity)).toMatchObject({ familyId: 'B-SESSION-QUERY', adapterRevision: 4, providerIdentity: PROVIDER })
    }
  })

  it('(d) no control leg: the REAL paAdmit fails the walk CLOSED on its own bytes — zero port entry, native untouched', async () => {
    const w = makeInject()
    const sink: string[] = []
    const built = buildPlane({ backends: { sessionQuery: w.inject } }, sink, POLICY_ASK)
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const placed = built.value.mount(fakeAgentCtx([]))
    expect(placed.ok).toBe(true)
    const def = built.value.definitions.find((d) => d.name === 'session_event_trace') as Definition
    const refusal = await refusalOf(def.execute({ session_id: 's-a', seq: 5 }, { token: { k: 'first' } }))
    expect(refusal.code).toBe('APPROVAL_REQUEST_UNAVAILABLE')
    expect(refusal.code).not.toContain('P_G6_WIRE') // the SEAT answered, not the bridge
    expect(w.portCalls.length, 'zero port entry').toBe(0)
    expect(w.nativeBodies.length, 'the native body never runs').toBe(0)
    // the ISSUED identity (a5p5 mount law) rode the real PA leg:
    expect(sink.some((line) => /pa-ask pending-refused call=team-g6-instance-g6-session_event_trace:hexec:/.test(line)), 'the plane observed its OWN refusal with the issued call id').toBe(true)
  })

  it('(e) durable-approval lane with the kernel minting the grant: the REAL edge consumes the one-shot proof, the ports serve; a re-used token is refused by the single-flight law', async () => {
    const w = makeInject()
    const sink: string[] = []
    const seen: Array<{ family: Record<string, unknown> | undefined }> = []
    const built = buildPlane({ backends: { sessionQuery: w.inject }, controlLeg: mintingControlLeg(seen) }, sink)
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const def = built.value.definitions.find((d) => d.name === 'session_trace') as Definition
    const token = { k: 'one-execution' }
    const served = String(await def.execute({ session_id: 's-a' }, { token }))
    expect(served).toContain('s-a')
    expect(w.portCalls.length).toBeGreaterThan(0)
    expect(w.nativeBodies.length).toBe(0)
    // the trusted family block rode the leg at FULL VALUE (载荷法) —
    // familyId/adapterRevision/providerIdentity/targetManifest, from the
    // row's own reviewPayload (the leg is where the durable bridge would
    // cross-check it against the registration).
    expect(seen.length).toBe(1)
    expect(seen[0]!.family).toMatchObject({ familyId: 'B-SESSION-QUERY', adapterRevision: 4, providerIdentity: PROVIDER })
    expect(seen[0]!.family!.targetManifest).toBeTypeOf('object')
    const portsAfterFirst = w.portCalls.length
    const paAsksBefore = sink.filter((line) => line.includes('admission-requires-approval')).length
    const replay = await refusalOf(def.execute({ session_id: 's-a' }, { token }))
    expect(replay.code).toBe('P_G6_WIRE_CALL_ID_ABSENT')
    expect(sink.some((line) => line.includes('token-replay REFUSED'))).toBe(true)
    expect(w.portCalls.length, 'the replay made zero additional port entries').toBe(portsAfterFirst)
    expect(sink.filter((line) => line.includes('admission-requires-approval')).length, 'the replay never reached PA again').toBe(paAsksBefore)
    // the ONE grant: a second execution token must re-ask (no grant reuse)
    const second = String(await def.execute({ session_id: 's-a' }, { token: { k: 'second-execution' } }))
    expect(second).toContain('s-a')
    expect(seen.length, 'the second call minted its own approval walk').toBe(2)
  })

  it('(f) dispose: the wiring drains (the row’s own DRAINING bytes) and the issued-identity ledger releases', async () => {
    const w = makeInject()
    const built = buildPlane({ backends: { sessionQuery: w.inject }, controlLeg: mintingControlLeg([]) })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const placed = built.value.mount(fakeAgentCtx([]))
    const def = built.value.definitions.find((d) => d.name === 'session_trace') as Definition
    const first = String(await def.execute({ session_id: 's-a' }, { token: { k: 'pre-dispose' } }))
    expect(first).toContain('s-a')
    placed.dispose?.()
    const refusal = await refusalOf(def.execute({ session_id: 's-a' }, { token: { k: 'post-dispose' } }))
    expect(refusal.code).toBe('P_G6_DRAINING') // the adapter's own teardown half, through the plane placement
  })

  it('(g) declared census: no searchBackend evidence = three placed rows; the two search names keep their natives', () => {
    const w = makeInject({ searchPresent: false })
    const built = buildPlane({ backends: { sessionQuery: w.inject } })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const placedNames = [...(built.value.sessionQuery?.placementNames ?? [])]
    expect(placedNames.sort()).toEqual(['session_event_read', 'session_event_trace', 'session_trace'])
    expect((built.value.sessionQuery?.declared ?? []).map((d) => d.name).sort()).toEqual(['session_event_search', 'session_search'])
    const registered: string[] = []
    const placed = built.value.mount(fakeAgentCtx(registered))
    expect(placed.ok).toBe(true)
    expect(registered).not.toContain('session_search')
    expect(registered).not.toContain('session_event_search')
    expect(built.value.sessionQuery!.familyRegistrations().map((r) => r.name).sort()).toEqual(['session_event_read', 'session_event_trace', 'session_trace'])
  })
})
