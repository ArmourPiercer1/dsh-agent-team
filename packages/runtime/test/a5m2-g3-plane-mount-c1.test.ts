/**
 * A5M2-G3-PLANE-MOUNT-C1 (the G6 plane-mount discipline verbatim, root
 * 19:08 G3 wiring lane) — the spec of the B-TERMINAL blocks THIS lane owns
 * in `team-tool-plane.mjs` (inject law, issued identity, placement, seat,
 * teardown) and of the mount law they enable: the plane is the REAL
 * `createTeamToolPlaneAssembly`; the placement is the REAL `mount()`
 * register pass; the family keys are the REAL lazy `definitionIdentityOf`
 * feed over the REAL placed defs; the registry is the PRODUCTION
 * `pa-mount-registry`; the seat is the REAL plane-owned `paAdmit` (the
 * callable carrying open/edge/closePlan) — never a stand-in seat.
 *
 * Legs:
 *  (a) ZERO FLIP: no `backends.terminal` = no wiring face (omitted, not
 *      undefined), no terminal_* placement — the ordinary mount is
 *      byte-identical to the pre-G3 plane;
 * (a2) the policy grammar pins terminal_* to the durable-approval lane: an
 *      allow entry outside the fs/shell family refuses at the projection;
 *  (b) the inject law: defective owner evidence refuses the MOUNT with the
 *      typed code (config is law, not wiring);
 *  (c) REAL placement: `mount()` registers the placed defs (complete
 *      captured faces, ONLY execute replaced); the family keys are the
 *      PLACEMENT identities through the lazy feed — NEVER the capture-side
 *      identity — and they round-trip the production registry;
 *  (d) REAL fail-closed walk: with NO control leg mounted the real partA
 *      answers its own `APPROVAL_REQUEST_UNAVAILABLE` (the ISSUED identity
 *      `team-<instance>-g3-…` is visible in the observed PA line); zero
 *      port entries; the native body never runs;
 *  (e) REAL admitted consume: on the policy-allow lane the kernel admits,
 *      the REAL `consumeForExecution` edge lands the one-shot proof, the
 *      terminals face answers, the served value is the port's OWN, and a
 *      re-used execution token gets the single-flight refusal — zero
 *      additional port entries;
 *  (f) teardown: dispose drains the wiring (DRAINING refuses new calls, the
 *      adapter's own bytes);
 *  (g) declared census: an uncaptured native keeps its NATIVE (no def, no
 *      registration — the mount never masks an undeployed face).
 *
 * DISCLOSED STAND-INS (NOT C2 — no Host, no ports, no tests/homes, no
 * network): the six native faces, the terminals service, the subprocess
 * capability and the session factory are recording doubles (the G3 adapter
 * spec owns the faithful LocalPtySession halves; the wiring spec pins the
 * bridge's refusal law); the bindingFacts seam answers the PLANE'S OWN
 * rev-0 row tuple (`plane-row:<template>:<tool>` — the same tuple
 * paAdmitPartA admits this lane under, measured at team-tool-plane.mjs
 * :1443-1463: revision 1, generations 0 — a production dispatcher tuple
 * would MIS-PAIR the minted grant and the arm's liveVerdict correctly
 * refuses that, so pairing here is honest, not staged). The PLANE, its
 * paAdmit, the admission kernel, the placement feed and the registry are
 * the real production code. The durable-ASK lane's family gate is the NAMED
 * GAP the wiring spec pins through the REAL published checkers (B-TERMINAL
 * has no registered typed-plan structure — the measured fail-closed bytes);
 * the policy-allow lane measured here is the kernel's own admit (the same
 * lane todo/write/G6 ride) and does not substitute for that gate. The
 * positive leg rides the kernel's OWN mint edge (issueApprovedGrant — the
 * same disclosed seam as the G6 C1's leg (e)).
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g3-plane-mount-c1
 */
import { describe, expect, it } from 'vitest'

import { definitionIdentityOf } from '../tool-dispatch/index.js'

const REALM = 'g3-plane-realm'
const PROVIDER = 'g3-plane-provider'
const TEMPLATE = 'g3-tpl'
const MEMBER = 'agent-member-1'
const HEADER = 's-header-1'
const AGENT = Object.freeze({ id: MEMBER, session: Object.freeze({ header: Object.freeze({ id: HEADER }) }) })

interface Definition {
  name: string
  description: string
  parameters: unknown
  output: unknown
  execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown>
}
interface PlaneValue {
  definitions: Definition[]
  placementNames: readonly string[]
  terminal?: {
    familyId: string
    placementNames: readonly string[]
    declared: ReadonlyArray<{ name: string, status: string, reason: string }>
    familyRegistrations: () => Array<{ name: string, definitionIdentity: string, entry: { familyId: string, adapterRevision: number, providerIdentity: string } }>
  }
  mount: (agentCtx: unknown) => { ok: boolean, code?: string, dispose?: () => void }
}
type Built = { ok: true, value: PlaneValue } | { ok: false, code: string, message: string }

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
  terminal_open: { type: 'object', properties: { type: { type: 'string' }, name: { type: 'string' }, cwd: { type: 'string' } }, required: ['type'], additionalProperties: false },
  terminal_send: { type: 'object', properties: { sessionId: { type: 'string' }, text: { type: 'string' } }, required: ['sessionId', 'text'], additionalProperties: false },
  terminal_read: { type: 'object', properties: { sessionId: { type: 'string' }, offset: { type: 'number' } }, required: ['sessionId'], additionalProperties: false },
  terminal_signal: { type: 'object', properties: { sessionId: { type: 'string' }, signal: { type: 'string', enum: ['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGTSTP', 'SIGHUP'] } }, required: ['sessionId', 'signal'], additionalProperties: false },
  terminal_close: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'], additionalProperties: false },
  terminal_list: { type: 'object', properties: {}, required: [], additionalProperties: false },
}
const TOOLS = Object.keys(PARAMS)

const POLICY_ASK = Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] })
const POLICY_TERMINAL_ALLOW_ATTEMPT = Object.freeze({
  default: 'ask',
  allow: TOOLS.map((tool) => Object.freeze({ tool, resource: { kind: 'any' } })),
  ask: [] as unknown[],
  deny: [] as unknown[],
})

function buildPlane (extra: Record<string, unknown> = {}, sink: string[] = [], policy: Record<string, unknown> = POLICY_ASK): Built {
  return createTeamToolPlaneAssembly({
    teamSessionId: 'g3-plane-team',
    permissionPolicy: policy,
    realmId: REALM,
    templateId: TEMPLATE,
    role: 'member',
    instanceId: 'g3-instance',
    onObserve: (row: unknown) => sink.push(String(row)),
    ...extra,
  }) as Built
}

interface LegPlan { approvalCaseId: string, effectSetFingerprint: string, requiredAuthority?: string, deniedEffects?: unknown }
interface LegAssembly { issueApprovedGrant: (request: unknown, approval: unknown) => Promise<{ ok: boolean, value?: unknown, error?: { message?: string } }> }
/** The control-leg SEAM double: the kernel's OWN landing (`assembly.
 *  issueApprovedGrant`, the edge the AUTH bridge at pa-control-bridge.ts:642
 *  uses) driven with an approval composed from the kernel's own plan facts —
 *  the durable Control ROW half stands in here (the house acceptance kit
 *  owns that half against a real Control service; this spec pins the
 *  PLANE+kernel half). The plane's Part A, the one-shot `consumeForExecution`
 *  edge, the grant identity and the plan-fact lifecycle are all REAL. */
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
      authorityGenerationAtCreation: 0,
      ...(plan.deniedEffects === undefined ? {} : { deniedEffectsAtCreation: plan.deniedEffects }),
    })
    const issued = await input.assembly.issueApprovedGrant(input.request, approval)
    if (issued.ok !== true || issued.value === undefined) {
      return { decision: 'deny', detail: `the kernel refused the mint (${String(issued.error?.message ?? 'unknown')})` }
    }
    return { decision: 'approve', requestId: 'g3-spec-control-row-1', approval, grant: issued.value, manifest: null }
  }
}

function makeInject (opts: { absent?: string[], portCalls?: string[] } = {}) {
  const portCalls = opts.portCalls ?? []
  const absent = new Set(opts.absent ?? [])
  const natives = new Map<string, Definition>()
  for (const name of TOOLS) {
    if (absent.has(name)) continue
    natives.set(name, {
      name,
      description: `native ${name} production description`,
      parameters: PARAMS[name],
      execute: async () => { throw new Error('NATIVE BODY NEVER RUNS THROUGH THE PLANE') },
      output: { schema: { type: 'object' }, render: (value: unknown) => JSON.stringify(value) },
    })
  }
  const readNative = (name: string) => natives.get(name)
  // THE recording terminals double — the LIST answer is what the LIST row
  // must serve VERBATIM through the REAL seat.
  const terminals = {
    registerBackend: () => () => {},
    spawn: async () => { portCalls.push('spawn'); throw new Error('spec plane world: spawn not driven here') },
    startSend: () => { portCalls.push('startSend'); throw new Error('spec plane world: startSend not driven here') },
    read: () => { portCalls.push('read'); return { viewport: 'pty-viewport', cursorOffset: 12 } },
    signal: async () => { portCalls.push('signal'); return { kind: 'sent' } },
    kill: async () => { portCalls.push('kill'); return true },
    list: () => { portCalls.push('list'); return Object.freeze([{ sessionId: 'pty-1', type: 'shell', status: { kind: 'running' } }]) },
  }
  const inject = Object.freeze({
    providerId: PROVIDER,
    readNative,
    memberAgentId: MEMBER,
    sessionHeaderId: HEADER,
    declaredBackends: ['shell'],
    ptyService: {
      backend: (type: string) => (type === 'shell' ? { registrationId: 'reg-shell-1', incarnation: 'inc-1', processEnvelope: { sandbox: 'landlock' } } : null),
      session: (ownerAgentId: string, sessionId: string) => (ownerAgentId === MEMBER && sessionId === 'pty-1' ? { incarnation: 'pty-inc-1', status: { kind: 'running' } } : null),
      approvedOpenPlan: () => ({ plan: { argv: ['/bin/bash'], cwd: '/tmp/g3-plane', rows: 24, cols: 80, graceMs: 2000 } }),
    },
    controlPortDeps: Object.freeze({
      terminals,
      resolveOwner: (exec: Record<string, unknown>) => (exec?.agent ?? null) as unknown,
      subprocess: { spawnTerminal: async () => { throw new Error('spec plane world: no PTY spawn driven here') } },
      sessionFactory: async () => { throw new Error('spec plane world: no session constructed here') },
      TerminalBackendCleanupError: class TerminalBackendCleanupError extends AggregateError {
        constructor (spawnError: unknown, cleanupError: unknown) { super([spawnError, cleanupError], 'PTY backend startup and cleanup both failed'); this.name = 'TerminalBackendCleanupError' }
      },
    }),
    // THE PLANE'S OWN rev-0 row tuple (measured at :1443-1463): this is the
    // identity paAdmitPartA admits THIS lane under absent a mounted live
    // dispatcher seam, and the arm's liveVerdict pairs the minted grant
    // against exactly it — see the header's disclosure.
    bindingFacts: (toolName: string) => ({
      bindingId: `plane-row:${TEMPLATE}:${toolName}`,
      bindingRevision: 1,
      policyGeneration: 0,
      authorityGeneration: 0,
    }),
  })
  return { inject, natives, portCalls }
}

const fakeAgentCtx = (registered: string[]) => ({
  tools: {
    register: (def: Definition) => { registered.push(def.name); return () => { /* disposer */ } },
  },
})

const refusalOf = async (promise: Promise<unknown>): Promise<{ code: string, message: string }> => {
  try {
    await promise
    throw new Error('expected a refusal, got a resolve')
  } catch (error) {
    const e = error as { code?: string, message?: string }
    return { code: String(e.code ?? ''), message: String(e.message ?? '') }
  }
}

describe('A5M2-G3-PLANE-MOUNT-C1 — the B-TERMINAL block in the REAL plane: placement, feed, registry, seat, teardown', () => {
  it('(a) zero flip: no injection = no wiring face and no terminal_* placement', () => {
    const built = buildPlane()
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    expect(built.value.terminal).toBeUndefined()
    for (const name of TOOLS) expect(built.value.placementNames).not.toContain(name)
  })

  it('(a2) the policy grammar pins terminal_* to the durable-approval lane: an allow entry outside the fs/shell family is refused at the projection', () => {
    const w = makeInject()
    const built = buildPlane({ backends: { terminal: w.inject } }, [], POLICY_TERMINAL_ALLOW_ATTEMPT)
    expect(built.ok).toBe(false)
    if (built.ok === true) return
    expect(built.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(built.message).toContain('must be one of')
  })

  it('(b) defective owner evidence refuses the MOUNT (config is law, not wiring)', () => {
    const w = makeInject()
    const noService = buildPlane({ backends: { terminal: { ...(w.inject as Record<string, unknown>), ptyService: undefined } } })
    expect(noService.ok).toBe(false)
    if (noService.ok === true) return
    expect(noService.code).toBe('TERMINAL_ARM_INJECT_INVALID')
    expect(noService.message).toContain('ptyService')
    const noBinding = buildPlane({ backends: { terminal: { ...(w.inject as Record<string, unknown>), bindingFacts: undefined } } })
    expect(noBinding.ok === false && noBinding.code).toBe('TERMINAL_ARM_INJECT_INVALID')
    const duck = buildPlane({ backends: { terminal: { ...(w.inject as Record<string, unknown>), declaredBackends: [] } } })
    expect(duck.ok === false && duck.code).toBe('TERMINAL_ARM_INJECT_INVALID')
  })

  it('(c) REAL placement + lazy feed keys + PRODUCTION registry round-trip (placement identity, never capture identity)', () => {
    const w = makeInject()
    const built = buildPlane({ backends: { terminal: w.inject } })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const value = built.value
    expect(value.terminal?.familyId).toBe('B-TERMINAL')
    expect([...(value.terminal?.placementNames ?? [])].sort()).toEqual([...TOOLS].sort())
    const registered: string[] = []
    const placed = value.mount(fakeAgentCtx(registered))
    expect(placed.ok).toBe(true)
    for (const name of TOOLS) expect(registered).toContain(name)
    const regs = value.terminal!.familyRegistrations()
    expect(regs.map((r) => r.name).sort()).toEqual([...TOOLS].sort())
    for (const reg of regs) {
      const placedDef = value.definitions.find((d) => d.name === reg.name) as Definition
      expect(reg.definitionIdentity, `placement key for ${reg.name}`).toBe(definitionIdentityOf(placedDef))
      const nativeDef = w.natives.get(reg.name) as Definition
      expect(reg.definitionIdentity).not.toBe(definitionIdentityOf(nativeDef))
      expect(a5GovernedFamilyFor(reg.definitionIdentity)).toBeUndefined()
      // the SAME native face objects the bridge spread (only execute differs)
      expect(placedDef.parameters).toBe(nativeDef.parameters)
      expect(placedDef.description).toBe(nativeDef.description)
      expect(placedDef.execute).not.toBe(nativeDef.execute)
    }
    // the mount writer's law, mirrored: entries flow to the production registry
    for (const reg of regs) registerA5GovernedFamily(reg.definitionIdentity, reg.entry)
    for (const reg of regs) {
      expect(a5GovernedFamilyFor(reg.definitionIdentity)).toMatchObject({ familyId: 'B-TERMINAL', adapterRevision: 3, providerIdentity: PROVIDER })
    }
  })

  it('(d) no control leg: the REAL paAdmit fails the walk CLOSED on its own bytes — zero port entry, native untouched', async () => {
    const w = makeInject()
    const sink: string[] = []
    const built = buildPlane({ backends: { terminal: w.inject } }, sink, POLICY_ASK)
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const placed = built.value.mount(fakeAgentCtx([]))
    expect(placed.ok).toBe(true)
    const def = built.value.definitions.find((d) => d.name === 'terminal_list') as Definition
    const refusal = await refusalOf(def.execute({}, { token: { k: 'g3-first' }, agent: AGENT }))
    expect(refusal.code).toBe('APPROVAL_REQUEST_UNAVAILABLE')
    expect(refusal.code).not.toContain('P_TERM') // the SEAT answered, not the bridge
    expect(w.portCalls.length, 'zero port entry').toBe(0)
    // the ISSUED identity (a5p5 mount law) rode the real PA leg:
    expect(sink.some((line) => /call=team-g3-instance-g3-terminal_list:hexec:/.test(line)), 'the plane observed its OWN refusal with the issued call id').toBe(true)
  })

  it('(e) durable-approval lane with the kernel minting the grant: the REAL edge consumes the one-shot proof, the terminals face answers; a re-used token is refused by the single-flight law', async () => {
    const w = makeInject()
    const sink: string[] = []
    const seen: Array<{ family: Record<string, unknown> | undefined }> = []
    const built = buildPlane({ backends: { terminal: w.inject }, controlLeg: mintingControlLeg(seen) }, sink)
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const def = built.value.definitions.find((d) => d.name === 'terminal_list') as Definition
    const token = { k: 'g3-one-execution' }
    const served = await def.execute({}, { token, agent: AGENT })
    // VERBATIM: the port's answer is the service answer, un-wrapped.
    expect(served).toEqual([{ sessionId: 'pty-1', type: 'shell', status: { kind: 'running' } }])
    expect(w.portCalls).toContain('list')
    // the trusted family block rode the leg at FULL VALUE (载荷法) —
    // familyId/adapterRevision/providerIdentity/targetManifest from the
    // row's own reviewPayload (where the durable bridge cross-checks it
    // against the registration).
    expect(seen.length).toBe(1)
    expect(seen[0]!.family).toMatchObject({ familyId: 'B-TERMINAL', adapterRevision: 3, providerIdentity: PROVIDER })
    expect(seen[0]!.family!.targetManifest).toBeTypeOf('object')
    const portsAfterFirst = w.portCalls.length
    const paAsksBefore = sink.filter((line) => line.includes('admission-requires-approval')).length
    const replay = await refusalOf(def.execute({}, { token }))
    expect(replay.code).toBe('P_TERM_WIRE_CALL_ID_ABSENT')
    expect(sink.some((line) => line.includes('a5m2-g3: token-replay REFUSED'))).toBe(true)
    expect(w.portCalls.length, 'the replay made zero additional port entries').toBe(portsAfterFirst)
    expect(sink.filter((line) => line.includes('admission-requires-approval')).length, 'the replay never reached PA again').toBe(paAsksBefore)
    // the ONE grant: a second execution token must re-ask (no grant reuse)
    const second = await def.execute({}, { token: { k: 'g3-second-execution' }, agent: AGENT })
    expect(second).toEqual([{ sessionId: 'pty-1', type: 'shell', status: { kind: 'running' } }])
    expect(seen.length, 'the second call minted its own approval walk').toBe(2)
  })

  it('(f) dispose: the wiring drains (the row\'s own DRAINING bytes)', async () => {
    const w = makeInject()
    const built = buildPlane({ backends: { terminal: w.inject } })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const placed = built.value.mount(fakeAgentCtx([]))
    expect(placed.ok).toBe(true)
    const def = built.value.definitions.find((d) => d.name === 'terminal_read') as Definition
    const before = await def.execute({ sessionId: 'pty-1' }, { token: { k: 'g3-before-dispose' }, agent: AGENT }).catch((e: Error) => e)
    // pre-dispose the row reaches the seat (POLICY_ASK here: the refusal is
    // the SEAT's APPROVAL_REQUEST_UNAVAILABLE, proving the row was live).
    expect(String((before as Error).message)).toContain('APPROVAL_REQUEST_UNAVAILABLE')
    placed.dispose?.()
    const refusal = await refusalOf(def.execute({ sessionId: 'pty-1' }, { token: { k: 'g3-post-dispose' }, agent: AGENT }))
    expect(refusal.message).toContain('P_TERM_DRAINING')
    expect(w.portCalls.length, 'the drained row entered zero ports').toBe(0)
  })

  it('(g) declared census: an uncaptured native keeps its NATIVE (no def, no registration)', () => {
    const w = makeInject({ absent: ['terminal_open'] })
    const built = buildPlane({ backends: { terminal: w.inject } })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const placedNames = [...(built.value.terminal?.placementNames ?? [])]
    expect(placedNames.sort()).toEqual(['terminal_close', 'terminal_list', 'terminal_read', 'terminal_send', 'terminal_signal'])
    expect((built.value.terminal?.declared ?? []).map((d) => d.name)).toEqual(['terminal_open'])
    const registered: string[] = []
    const placed = built.value.mount(fakeAgentCtx(registered))
    expect(placed.ok).toBe(true)
    expect(registered).not.toContain('terminal_open')
    expect(built.value.terminal!.familyRegistrations().map((r) => r.name).sort()).toEqual(['terminal_close', 'terminal_list', 'terminal_read', 'terminal_send', 'terminal_signal'])
  })
})
