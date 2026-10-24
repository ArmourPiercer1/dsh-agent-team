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
 *      registration — the mount never masks an undeployed face);
 *  (h)/(i)/(j) the REAL facts supply, the placement callback law, and the
 *      LIVE control/query rows (see the legs);
 *  (k) JOBS real supply + the REAL mint/edge walk: the kernel mints, the
 *      registry MINTS the jobId, the branded-owner JobSpec rides, the row
 *      serves the HOST kind-tagged {kind:'background', jobId} word, and a
 *      POST-SERVE abort retracts nothing (the accepted job is job_kill's);
 *  (l) the REAL cancel supply: an abort landing MID-EXECUTION (while
 *      jobs.start runs, the job UNRECORDED) registers the intent with zero
 *      speculative kills, and the ANSWERED job is owner-checked killed — the
 *      success commit REFUSED with the cleanup truth (root 580f① law now
 *      production-reachable through the bridge's abort listener);
 *  (m) jobs supply ABSENT is the typed zero-effect refusal through the REAL
 *      walk (P_TERM_BG_PORT_UNWIRED, zero port entry); the foreground send
 *      on the SAME row still serves.
 *  DISCLOSED (added with (k)-(l)): the jobs registry is a RECORDING double
 *  with the pinned @639 signatures (lib/types/index.d.ts:71/:116); the
 *  mid-execution abort is STAGED inside that double's start (the same
 *  measured-window staging law leg (j) uses for the pid poison) — the real
 *  race it stands in for: an interrupt arriving while jobs.start runs, the
 *  job not yet recorded at the arm.
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
  // REAL-SHAPE fidelity (root 01:1x, @639 tool-terminal src/index.ts:199-208):
  // the registered terminal_send carries submit and — under the default
  // enableRunInBackground (:37 default true) — run_in_background as an
  // OPTIONAL boolean; the closed additionalProperties law stays. The bg lane
  // this spec now walks cannot even CLASSIFY without the real parameter.
  terminal_send: { type: 'object', properties: { sessionId: { type: 'string' }, text: { type: 'string' }, submit: { type: 'boolean' }, run_in_background: { type: 'boolean' } }, required: ['sessionId', 'text'], additionalProperties: false },
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

interface LegPlan { approvalCaseId: string, effectSetFingerprint: string, requiredAuthority?: string, deniedEffects?: unknown, perEffectRequired?: unknown }
interface LegAssembly { issueApprovedGrant: (request: unknown, approval: unknown) => Promise<{ ok: boolean, value?: unknown, error?: { message?: string } }> }
/** The control-leg SEAM double: the kernel's OWN landing (`assembly.
 *  issueApprovedGrant`, the edge the AUTH bridge at pa-control-bridge.ts:642
 *  uses) driven with an approval composed from the kernel's own plan facts —
 *  the durable Control ROW half stands in here (the house acceptance kit
 *  owns that half against a real Control service; this spec pins the
 *  PLANE+kernel half). The plane's Part A, the one-shot `consumeForExecution`
 *  edge, the grant identity and the plan-fact lifecycle are all REAL. */
function mintingControlLeg (seen: Array<{ family: Record<string, unknown> | undefined }>, planSink?: Array<Record<string, unknown>>) {
  return async (input: { request: unknown, family?: Record<string, unknown>, plan: LegPlan, assembly: LegAssembly }): Promise<Record<string, unknown>> => {
    seen.push({ family: input.family })
    if (planSink !== undefined) planSink.push({ approvalCaseId: input.plan.approvalCaseId, effectSetFingerprint: input.plan.effectSetFingerprint, ...(input.plan.perEffectRequired === undefined ? {} : { perEffectRequired: input.plan.perEffectRequired }) })
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

function makeInject (opts: { absent?: string[], portCalls?: string[]; live?: { reads: number, poisonFromRead: number }; jobs?: Record<string, unknown>; ownerSessionId?: (ownerAgentId: string) => string; sendOperation?: () => Record<string, unknown> } = {}) {
  const portCalls = opts.portCalls ?? []
  const absent = new Set(opts.absent ?? [])
  // THE LIVE SNAPSHOT SOURCE (root 21:36: the CONTROL/QUERY rows ride live
  // facts): one mutable snapshot list feeds BOTH the terminals face's list()
  // and the producer-shaped session() resolution (pid-derived incarnation,
  // status verbatim — the same derivation law the capture producer applies).
  const snapshots: Array<Record<string, unknown>> = [{ sessionId: 'pty-1', type: 'shell', status: { kind: 'running' }, pid: 4242 }]
  const live = opts.live ?? { reads: 0, poisonFromRead: Number.POSITIVE_INFINITY }
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
    startSend: () => { portCalls.push('startSend'); return opts.sendOperation !== undefined ? opts.sendOperation() : { done: Promise.resolve({ settled: true }) } },
    read: () => { portCalls.push('read'); return { viewport: 'pty-viewport', cursorOffset: 12 } },
    signal: async () => { portCalls.push('signal'); return { kind: 'sent' } },
    kill: async () => { portCalls.push('kill'); return true },
    list: () => { portCalls.push('list'); return Object.freeze(snapshots.map((entry) => Object.freeze({ ...entry }))) },
  }
  const inject = Object.freeze({
    providerId: PROVIDER,
    readNative,
    memberAgentId: MEMBER,
    sessionHeaderId: HEADER,
    declaredBackends: ['shell'],
    ptyService: {
      backend: (type: string) => (type === 'shell' ? { registrationId: 'reg-shell-1', incarnation: 'inc-1', processEnvelope: { sandbox: 'landlock' } } : null),
      session: (ownerAgentId: string, sessionId: string) => {
        if (ownerAgentId !== MEMBER || sessionId !== 'pty-1') return null
        // producer-shaped derivation from the LIVE snapshot (pid-derived
        // incarnation); `live.poisonFromRead` simulates the observable fact
        // of a session restart (pid moves) AFTER the Nth read — the exact
        // movement the adapter's execute-time recheck must refuse.
        live.reads += 1
        const snap = snapshots.find((entry) => entry.sessionId === sessionId)
        if (snap === undefined || typeof snap.pid !== 'number') return null
        const pid = live.reads > live.poisonFromRead ? 9999 : snap.pid
        return { incarnation: `pid:${String(pid)}`, status: snap.status }
      },
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
      // THE JOBS SUPPLY rides exactly as the production inject carries it
      // (agent-bindings' live forwarder + the branded owner reader): the
      // registry face travels WITH its owner reader or not at all (the
      // adapter's own law). The double below is a RECORDING registry — the
      // host JobRegistry's start/kill are the pinned @639 signatures
      // (lib/types/index.d.ts:71/:116: start(spec) → JobId synchronous;
      // kill(id, caller?, reason?) → 'requested' | 'already-finished').
      ...(opts.jobs !== undefined
        ? { jobs: opts.jobs, ...(opts.ownerSessionId === undefined ? {} : { ownerSessionId: opts.ownerSessionId }) }
        : {}),
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
    expect(served).toEqual([{ sessionId: 'pty-1', type: 'shell', status: { kind: 'running' }, pid: 4242 }])
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
    expect(second).toEqual([{ sessionId: 'pty-1', type: 'shell', status: { kind: 'running' }, pid: 4242 }])
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

  it('(h) placement CALLBACK law (INTEGRATOR SEAM DOUBLE — root 20:38 correction): the PLACEMENT LIST names the read for placed rows (positive), and an UNPLACED (census) name never reaches the read at all (negative)', async () => {
    // (root 20:14 card item 2 / root 20:38 EVIDENCE CORRECTION):
    // paPlacementNameOf must resolve the G3 fixed spellings from the
    // WIRING'S OWN placementNames, else the production call-facts read
    // arrives with NO placementName. HONESTY TIER (root 20:38): the reader
    // below is an INTEGRATOR SEAM DOUBLE and its facts object is HAND-BUILT
    // over the plane's own rev-0 row identity — what this leg proves is the
    // PLACEMENT CALLBACK through the production read slot (name pairing +
    // the measured construction+edge double-read law). It proves NOTHING
    // about the REAL facts supply: that is leg (i), over the shipped
    // readPaCallFactsForCall and a published mount.
    const reads: Array<Record<string, unknown>> = []
    const plans: Array<Record<string, unknown>> = []
    const readCallFacts = async (request: Record<string, unknown>) => {
      reads.push(request)
      const name = String(request.placementName ?? '')
      const walked = plans[plans.length - 1]
      return {
        kind: 'call-facts',
        facts: {
          realmId: String(request.realmId ?? REALM),
          member: { teamSessionId: 'g3-plane-team', instanceId: 'g3-instance' },
          effects: request.requestedEffects,
          authorityGeneration: 0,
          binding: {
            bindingId: `plane-row:${TEMPLATE}:${name}`,
            agentScopeKey: `plane:${TEMPLATE}`,
            toolName: name,
            definitionIdentity: `plane:${TEMPLATE}:${name}`,
            providerId: 'a5p5-plane',
            implementationOrigin: 'team-trusted-extension',
            executionBoundary: 'confined-subprocess',
            status: 'ACTIVE',
            policyGeneration: 0,
            authorityGeneration: 0,
            revision: 1,
            assurance: { class: 'UNTESTED', source: 'team-trusted-extension' },
          },
          ...(walked === undefined ? {} : { planSnapshot: walked }),
        },
      }
    }
    // POSITIVE: terminal_list IS placed → the read names its placement and
    // the call walks to the mint and serves.
    const w = makeInject()
    const seen: Array<{ family: Record<string, unknown> | undefined }> = []
    const built = buildPlane({ backends: { terminal: w.inject }, controlLeg: mintingControlLeg(seen, plans), readCallFacts })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const def = built.value.definitions.find((d) => d.name === 'terminal_list') as Definition
    const served = await def.execute({}, { token: { k: 'g3-callfacts' }, agent: AGENT })
    expect(served).toEqual([{ sessionId: 'pty-1', type: 'shell', status: { kind: 'running' }, pid: 4242 }])
    // the measured law: the SAME read is asked the SAME question twice —
    // once to BUILD the request's binding (admission), once at the execution
    // EDGE (drift check). Both asks must carry the G3 placement spelling.
    expect(reads.length, 'construction + edge reads both ran for the placed row').toBe(2)
    expect([...new Set(reads.map((r) => String(r.placementName)))], 'paPlacementNameOf named the G3 placement').toEqual(['terminal_list'])
    expect(String(reads[0]!.callId)).toMatch(/^team-g3-instance-g3-terminal_list:hexec:/)
    // NEGATIVE: a CENSUS name (never placed) has no row and NEVER produces
    // a call-facts read — the native behind it stays untouched and the
    // placement list refuses to name it (zero flip through the SAME line).
    const wc = makeInject({ absent: ['terminal_list'] })
    const readsC: Array<Record<string, unknown>> = []
    const plansC: Array<Record<string, unknown>> = []
    const builtC = buildPlane({ backends: { terminal: wc.inject }, controlLeg: mintingControlLeg([], plansC), readCallFacts: async (r: Record<string, unknown>) => { readsC.push(r); const nm = String(r.placementName ?? ''); const wk = plansC[plansC.length - 1]; return { kind: 'call-facts', facts: { realmId: String(r.realmId ?? REALM), member: { teamSessionId: 'g3-plane-team', instanceId: 'g3-instance' }, effects: r.requestedEffects, authorityGeneration: 0, binding: { bindingId: `plane-row:${TEMPLATE}:${nm}`, agentScopeKey: `plane:${TEMPLATE}`, toolName: nm, definitionIdentity: `plane:${TEMPLATE}:${nm}`, providerId: 'a5p5-plane', implementationOrigin: 'team-trusted-extension', executionBoundary: 'confined-subprocess', status: 'ACTIVE', policyGeneration: 0, authorityGeneration: 0, revision: 1, assurance: { class: 'UNTESTED', source: 'team-trusted-extension' } }, ...(wk === undefined ? {} : { planSnapshot: wk }) } } } })
    expect(builtC.ok).toBe(true)
    if (builtC.ok !== true) return
    expect(builtC.value.definitions.find((d) => d.name === 'terminal_list'), 'census row placed nothing').toBeUndefined()
    expect((builtC.value.terminal?.declared ?? []).map((d) => d.name)).toEqual(['terminal_list'])
    const placedRow = builtC.value.definitions.find((d) => d.name === 'terminal_read') as Definition
    await placedRow.execute({ sessionId: 'pty-1' }, { token: { k: 'g3-census-contrast' }, agent: AGENT })
    expect([...new Set(readsC.map((r) => String(r.placementName)))], 'only PLACED spellings reach the read').toEqual(['terminal_read'])
  })

  it('(i) REAL facts supply (root 20:38): the shipped readPaCallFactsForCall over a PUBLISHED mount answers the production read for the G3 placement', async () => {
    // Not a double of the reader itself: the REAL shipped entry
    // (pa-mount-registry readPaCallFactsForCall) resolves the call's facts
    // through a REAL published mount record (publishPaMount) whose `plane`
    // member IS the assembly's own face (live walk-plan map, realm,
    // assembly) and whose Guard dispatcher answers the SAME rev-0 row
    // tuples the wiring's bindingFacts read — one live source, read through
    // the registry's own code paths.
    const registry = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
      publishPaMount: (root: string, instance: string, entry: Record<string, unknown>) => Record<string, unknown>
      revokePaMount: (root: string, instance: string, identity: Record<string, unknown>) => void
      readPaCallFactsForCall: (input: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>
    }
    const tupleFor = (name: string) => Object.freeze({
      bindingId: `plane-row:${TEMPLATE}:${name}`,
      agentScopeKey: `plane:${TEMPLATE}`,
      toolName: name,
      definitionIdentity: `plane:${TEMPLATE}:${name}`,
      providerId: 'a5p5-plane',
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'confined-subprocess',
      assurance: Object.freeze({}),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    })
    const guard = { dispatcher: { surface: { names: () => [...TOOLS], entryOf: (name: string) => (TOOLS as readonly string[]).includes(name) ? { verified: true, revision: 1, binding: tupleFor(name) } : undefined } } }
    const answerCauses: string[][] = []
    const w = makeInject()
    const seen: Array<{ family: Record<string, unknown> | undefined }> = []
    const built = buildPlane({
      backends: { terminal: w.inject },
      controlLeg: mintingControlLeg(seen),
      // the rev-0 overlay lane: the durable generation source (0 = no
      // overlay rows; the SAME source the assembly is built with).
      authorityFacts: { overlayGeneration: () => 0 },
      readCallFacts: (input: Record<string, unknown>) => {
        const causes: string[] = []
        const inner = input.diagnose
        const answer = registry.readPaCallFactsForCall({ ...input, diagnose: (c: { code?: string }) => { causes.push(String(c?.code ?? '')); if (typeof inner === 'function') (inner as (x: unknown) => void)(c) } })
        answerCauses.push(causes)
        return answer
      },
    })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    built.value.mount(fakeAgentCtx([]))
    const identity = registry.publishPaMount('g3-plane-team', 'g3-instance', {
      instanceId: 'g3-instance',
      guard,
      plane: built.value,
      beneficiaryAuthority: 'member',
      readers: {
        // the permission lane's OWN published call-facts shape (the real
        // reader reads the blueprint tuple / providerVersion / healthy from
        // this lane; @639 the tuple's revision is a STRING — the A5-M1-D-fix
        // law pinned in pa-mount-registry.mjs:258-268).
        permissionPlane: () => ({
          currentCallFacts: () => ({
            healthy: true,
            tuple: { blueprintId: 'g3-bp', contentHash: 'sha256:bphash', revision: '3', templateId: TEMPLATE, cwd: '/tmp/g3-c1' },
            providerVersion: 'pv-1',
          }),
        }),
        overlaySnapshot: async () => ({ metadata: { generation: 0 } }),
        teamHardEnvelope: async () => ({ status: 'absent' }),
        permissionEnvelope: async () => ({ rules: [], scope: 'g3' }),
      },
    })
    try {
      const def = built.value.definitions.find((d) => d.name === 'terminal_list') as Definition
      const served = await def.execute({}, { token: { k: 'g3-real-facts' }, agent: AGENT })
      // SERVED through the real reader: the construction + edge reads both
      // resolved the live rev-0 tuple through the published mount (a missing
      // placementName, a mispaired tuple, or a planSnapshot drift would
      // stale the call before the seat — nothing here answers by hand).
      expect(served, `the real reader served the row (causes: ${JSON.stringify(answerCauses)})`).toEqual([{ sessionId: 'pty-1', type: 'shell', status: { kind: 'running' }, pid: 4242 }])
      // ZERO diagnose causes across BOTH production reads (construction +
      // edge): every arm of the shipped entry resolved through the
      // published mount — no refusal was ever on the path.
      // The reader answers the LIVE dispatcher tuple identity for a placed
      // name and NOTHING for a name the mount never placed:
      const answer = await registry.readPaCallFactsForCall({
        rootSessionId: 'g3-plane-team', instanceId: 'g3-instance', realmId: REALM,
        callId: 'direct-probe-1', placementName: 'terminal_list',
        requestedEffects: { effects: [{ kind: 'tool-invoke', toolName: 'terminal_list' }], fingerprint: 'sha256:probe' },
      })
      expect(answer, 'the real reader answers for the placed G3 name').toBeDefined()
      const facts = (answer as Record<string, unknown>)?.facts as Record<string, unknown> | undefined
      expect((facts?.binding as Record<string, unknown> | undefined)?.bindingId).toBe(`plane-row:${TEMPLATE}:terminal_list`)
      const miss = await registry.readPaCallFactsForCall({
        rootSessionId: 'g3-plane-team', instanceId: 'g3-instance', realmId: REALM,
        callId: 'direct-probe-2', placementName: 'terminal_never_mounted',
        requestedEffects: { effects: [{ kind: 'tool-invoke', toolName: 'terminal_list' }], fingerprint: 'sha256:probe' },
      })
      expect(miss, 'an unplaced placementName answers NOTHING (fail closed, never a name lookup)').toBeUndefined()
      // the MEASURED read law (root 21:07: 明确两次): the shipped entry is
      // asked the SAME question TWICE per served call — construction + edge.
      expect(answerCauses.length, `exactly the construction + edge production reads fired (${JSON.stringify(answerCauses)})`).toBe(2)
      expect(answerCauses.every((c) => c.length === 0), `no reader refusal crossed either read (${JSON.stringify(answerCauses)})`).toBe(true)
    } finally {
      // the REAL revoke law (root 21:07): by (teamRoot, instanceId,
      // identity) — the identity the publish returned for THIS pair; a stale
      // disposer clears nothing.
      registry.revokePaMount('g3-plane-team', 'g3-instance', identity)
    }
  })

  it('(j) real supply on the CONTROL/QUERY rows (root 21:36: open 保 gap, 这些行不待它): send/read/signal/close SERVE through the published mount on LIVE snapshot facts, and a pid movement IS the drift the execute-time recheck refuses', async () => {
    const registry = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
      publishPaMount: (root: string, instance: string, entry: Record<string, unknown>) => Record<string, unknown>
      revokePaMount: (root: string, instance: string, identity: Record<string, unknown>) => void
      readPaCallFactsForCall: (input: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>
    }
    const tupleFor = (name: string) => Object.freeze({
      bindingId: `plane-row:${TEMPLATE}:${name}`,
      agentScopeKey: `plane:${TEMPLATE}`,
      toolName: name,
      definitionIdentity: `plane:${TEMPLATE}:${name}`,
      providerId: 'a5p5-plane',
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'confined-subprocess',
      assurance: Object.freeze({}),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    })
    const guard = { dispatcher: { surface: { names: () => [...TOOLS], entryOf: (name: string) => (TOOLS as readonly string[]).includes(name) ? { verified: true, revision: 1, binding: tupleFor(name) } : undefined } } }
    const portCalls: string[] = []
    const live = { reads: 0, poisonFromRead: Number.POSITIVE_INFINITY }
    const w = makeInject({ portCalls, live })
    const seen: Array<{ family: Record<string, unknown> | undefined }> = []
    const built = buildPlane({
      backends: { terminal: w.inject },
      controlLeg: mintingControlLeg(seen),
      authorityFacts: { overlayGeneration: () => 0 },
      readCallFacts: (input: Record<string, unknown>) => registry.readPaCallFactsForCall(input),
    })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    built.value.mount(fakeAgentCtx([]))
    const identity = registry.publishPaMount('g3-plane-team', 'g3-instance', {
      instanceId: 'g3-instance',
      guard,
      plane: built.value,
      beneficiaryAuthority: 'member',
      readers: {
        permissionPlane: () => ({
          currentCallFacts: () => ({
            healthy: true,
            tuple: { blueprintId: 'g3-bp', contentHash: 'sha256:bphash', revision: '3', templateId: TEMPLATE, cwd: '/tmp/g3-c1' },
            providerVersion: 'pv-1',
          }),
        }),
        overlaySnapshot: async () => ({ metadata: { generation: 0 } }),
        teamHardEnvelope: async () => ({ status: 'absent' }),
        permissionEnvelope: async () => ({ rules: [], scope: 'g3' }),
      },
    })
    try {
      const def = (name: string) => built.value.definitions.find((d) => d.name === name) as Definition
      const exec = (k: string) => ({ token: { k }, agent: AGENT })
      // THE FOUR CONTROL/QUERY ROWS SERVE, each reaching the live terminals
      // face — every session fact resolved from the LIVE snapshot (pid-derived
      // incarnation), every effect through the recording service face:
      const sent = await def('terminal_send').execute({ sessionId: 'pty-1', text: 'echo hi\n' }, exec('g3-j-send'))
      expect(sent, 'the send row served').toBeDefined()
      const read = await def('terminal_read').execute({ sessionId: 'pty-1' }, exec('g3-j-read'))
      expect(read, 'the read row served').toBeDefined()
      const signaled = await def('terminal_signal').execute({ sessionId: 'pty-1', signal: 'SIGINT' }, exec('g3-j-signal'))
      expect(signaled, 'the signal row served').toBeDefined()
      const closed = await def('terminal_close').execute({ sessionId: 'pty-1' }, exec('g3-j-close'))
      expect(closed, 'the close row served').toBeDefined()
      expect(portCalls.filter((c) => ['startSend', 'read', 'signal', 'kill'].includes(c)), 'each row reached the REAL service face exactly once')
        .toEqual(['startSend', 'read', 'signal', 'kill'])
      // THE DRIFT IS REAL: the snapshot's pid moves BETWEEN the target read
      // at approval and the entry recheck (the observable fact of a
      // restarted session). The poison arms so the NEXT read (approval-time)
      // still sees 4242 and the read AFTER it (the entry recheck) sees 9999
      // — the recheck refuses with its OWN word naming both incarnations,
      // BEFORE the effect entry (zero effect; a post-start move would ride
      // the signed effectsStarted lane instead).
      const sendsBefore = portCalls.filter((c) => c === 'startSend').length
      live.poisonFromRead = live.reads + 1
      await expect(def('terminal_send').execute({ sessionId: 'pty-1', text: 'again\n' }, exec('g3-j-drift')))
        .rejects.toThrow(/P_TERM_TARGET_DRIFT[\s\S]*pid:4242 -> pid:9999/)
      expect(portCalls.filter((c) => c === 'startSend').length, 'the drift refused at the entry — ZERO further service effects').toBe(sendsBefore)
    } finally {
      registry.revokePaMount('g3-plane-team', 'g3-instance', identity)
    }
  })

  it('(k) JOBS real supply + REAL mint/edge (root 01:1x): the bg send mints through the kernel, the registry MINTS the jobId, the branded-owner JobSpec rides, and the row serves the HOST kind-tagged word', async () => {
    const registry = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
      publishPaMount: (root: string, instance: string, entry: Record<string, unknown>) => Record<string, unknown>
      revokePaMount: (root: string, instance: string, identity: Record<string, unknown>) => void
      readPaCallFactsForCall: (input: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>
    }
    const tupleFor = (name: string) => Object.freeze({
      bindingId: `plane-row:${TEMPLATE}:${name}`,
      agentScopeKey: `plane:${TEMPLATE}`,
      toolName: name,
      definitionIdentity: `plane:${TEMPLATE}:${name}`,
      providerId: 'a5p5-plane',
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'confined-subprocess',
      assurance: Object.freeze({}),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    })
    const guard = { dispatcher: { surface: { names: () => [...TOOLS], entryOf: (name: string) => (TOOLS as readonly string[]).includes(name) ? { verified: true, revision: 1, binding: tupleFor(name) } : undefined } } }
    const portCalls: string[] = []
    // THE recording registry — the pinned @639 face (lib/types/index.d.ts
    // :71/:116): start(spec) mints the JobId SYNCHRONOUSLY and runs the job
    // (hooks come from spec.run — the operation starts INSIDE run, the host
    // tool-terminal index.ts:262-276 law); kill(id, caller?, reason?) is the
    // owner-checked control answering requested | already-finished.
    const jobsLog: string[] = []
    const specs: Array<Record<string, unknown>> = []
    let hooks: { cancel: (reason?: string) => void, done: Promise<unknown> } | null = null
    let opCancelled = 0
    const sendOperation = () => ({
      done: new Promise<Record<string, unknown>>((resolve) => { setTimeout(() => resolve({ waitReason: 'inferred_idle', viewport: 'made', sessionStatus: { kind: 'running' }, truncated: false }), 0) }),
      cancel: () => { opCancelled += 1 },
      readOutput: () => ({ delta: 'made\n', truncated: false }),
    })
    const jobs = {
      start: (spec: { run: (job: Record<string, unknown>) => unknown, [k: string]: unknown }) => {
        jobsLog.push('start')
        specs.push(spec)
        hooks = spec.run({}) as { cancel: (reason?: string) => void, done: Promise<unknown> }
        return 'job-g3-bg-1' // THE registry mints the id — the row never fabricates one
      },
      kill: (id: string, caller?: string, reason?: string) => {
        jobsLog.push(`kill:${String(id)}:${String(caller)}:${String(reason ?? '')}`)
        hooks?.cancel(reason)
        return id === 'job-g3-bg-1' ? 'requested' : 'already-finished'
      },
    }
    const w = makeInject({ portCalls, jobs, ownerSessionId: (ownerAgentId: string) => `s-brand:${String(ownerAgentId)}`, sendOperation })
    const seen: Array<{ family: Record<string, unknown> | undefined }> = []
    const built = buildPlane({
      backends: { terminal: w.inject },
      controlLeg: mintingControlLeg(seen),
      authorityFacts: { overlayGeneration: () => 0 },
      readCallFacts: (input: Record<string, unknown>) => registry.readPaCallFactsForCall(input),
    })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    built.value.mount(fakeAgentCtx([]))
    const identity = registry.publishPaMount('g3-plane-team', 'g3-instance', {
      instanceId: 'g3-instance',
      guard,
      plane: built.value,
      beneficiaryAuthority: 'member',
      readers: {
        permissionPlane: () => ({
          currentCallFacts: () => ({
            healthy: true,
            tuple: { blueprintId: 'g3-bp', contentHash: 'sha256:bphash', revision: '3', templateId: TEMPLATE, cwd: '/tmp/g3-c1' },
            providerVersion: 'pv-1',
          }),
        }),
        overlaySnapshot: async () => ({ metadata: { generation: 0 } }),
        teamHardEnvelope: async () => ({ status: 'absent' }),
        permissionEnvelope: async () => ({ rules: [], scope: 'g3' }),
      },
    })
    try {
      const controller = new AbortController()
      const served = await (built.value.definitions.find((d) => d.name === 'terminal_send') as Definition)
        .execute({ sessionId: 'pty-1', text: 'make\n', run_in_background: true }, { token: { k: 'g3-k-bg' }, agent: AGENT, signal: controller.signal })
      // THE REAL MINT/EDGE WALK LANDED: one kernel mint, one real consume,
      // the trusted family block at FULL VALUE (载荷法).
      expect(seen.length, 'the bg send walked the REAL mint once').toBe(1)
      expect(seen[0]!.family).toMatchObject({ familyId: 'B-TERMINAL', adapterRevision: 3, providerIdentity: PROVIDER })
      // THE SERVED WORD IS THE HOST's: { kind:'background', jobId } with the
      // id the REGISTRY minted (tool-terminal index.ts:278 @639).
      expect(served).toEqual({ kind: 'background', jobId: 'job-g3-bg-1' })
      // THE JobSpec IS THE SIGNED SHAPE: kind, label, BRANDED owner (the
      // inject's owner reader resolved with the dispatching Agent's id —
      // never omitted, never unowned), the output source, the run hook.
      expect(specs.length, 'exactly one job registered').toBe(1)
      expect(specs[0]).toMatchObject({ kind: 'pty-send', label: 'g3 terminal_send pty-1', owner: `s-brand:${MEMBER}` })
      expect(typeof (specs[0]!.run as unknown as () => unknown)).toBe('function')
      expect(Array.isArray(specs[0]!.output)).toBe(true)
      expect(hooks, 'the registry ran the job: JobHooks {cancel, done} answered').not.toBeNull()
      expect(typeof hooks!.cancel).toBe('function')
      expect(hooks!.done).toBeInstanceOf(Promise)
      // the operation started INSIDE run (the registry owns the start), the
      // row itself entered the terminals face exactly once.
      expect(portCalls.filter((c) => c === 'startSend')).toEqual(['startSend'])
      // the host's own real AbortSignal rode the walk and committed served.
      controller.abort() // POST-SERVE abort: the committed row is never retracted
      expect(portCalls.filter((c) => c === 'kill'), 'cancel is not close — the PTY stayed untouched').toEqual([])
      expect(opCancelled, 'the post-commit abort did NOT retract the accepted job').toBe(0)
      await hooks!.done
    } finally {
      registry.revokePaMount('g3-plane-team', 'g3-instance', identity)
    }
  })

  it('(l) REAL abort MID-EXECUTION is HONOURED (root 01:1x cancel supply + 580f①): the interrupt landing while jobs.start runs registers the intent (zero speculative kill), and the ANSWERED job is owner-checked killed — the success commit REFUSED with the cleanup truth', async () => {
    const registry = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
      publishPaMount: (root: string, instance: string, entry: Record<string, unknown>) => Record<string, unknown>
      revokePaMount: (root: string, instance: string, identity: Record<string, unknown>) => void
      readPaCallFactsForCall: (input: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>
    }
    const tupleFor = (name: string) => Object.freeze({
      bindingId: `plane-row:${TEMPLATE}:${name}`,
      agentScopeKey: `plane:${TEMPLATE}`,
      toolName: name,
      definitionIdentity: `plane:${TEMPLATE}:${name}`,
      providerId: 'a5p5-plane',
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'confined-subprocess',
      assurance: Object.freeze({}),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    })
    const guard = { dispatcher: { surface: { names: () => [...TOOLS], entryOf: (name: string) => (TOOLS as readonly string[]).includes(name) ? { verified: true, revision: 1, binding: tupleFor(name) } : undefined } } }
    const portCalls: string[] = []
    const jobsLog: string[] = []
    const controller = new AbortController()
    let killCountAtAbort = -1
    let hooks: { cancel: (reason?: string) => void, done: Promise<unknown> } | null = null
    let opCancelled = 0
    let settleOp: (v: Record<string, unknown>) => void = () => {}
    const sendOperation = () => ({
      done: new Promise<Record<string, unknown>>((resolve) => { settleOp = resolve }),
      cancel: () => { opCancelled += 1; settleOp({ waitReason: 'session_exit', viewport: 'interrupted', sessionStatus: { kind: 'running' }, truncated: false }) },
      readOutput: () => ({ delta: '', truncated: false }),
    })
    const jobs = {
      start: (spec: { run: (job: Record<string, unknown>) => unknown, [k: string]: unknown }) => {
        jobsLog.push('start')
        // THE MEASURED WINDOW (the same staging law leg (j) uses for the pid
        // poison): the user interrupt lands WHILE jobs.start runs — the
        // operation has started inside run(), but the port has not yet
        // RECORDED the job (record runs after start returns). This is
        // exactly the race the bridge's abort listener now covers.
        hooks = spec.run({}) as { cancel: (reason?: string) => void, done: Promise<unknown> }
        controller.abort() // synchronous listener → arm.cancel EXECUTING, resource NOT yet recorded
        killCountAtAbort = jobsLog.filter((l) => l.startsWith('kill')).length
        return 'job-g3-bg-9'
      },
      kill: (id: string, caller?: string, reason?: string) => {
        jobsLog.push(`kill:${String(id)}:${String(caller)}:${String(reason ?? '')}`)
        hooks?.cancel(reason)
        return id === 'job-g3-bg-9' ? 'requested' : 'already-finished'
      },
    }
    const w = makeInject({ portCalls, jobs, ownerSessionId: (ownerAgentId: string) => `s-brand:${String(ownerAgentId)}`, sendOperation })
    const seen: Array<{ family: Record<string, unknown> | undefined }> = []
    const built = buildPlane({
      backends: { terminal: w.inject },
      controlLeg: mintingControlLeg(seen),
      authorityFacts: { overlayGeneration: () => 0 },
      readCallFacts: (input: Record<string, unknown>) => registry.readPaCallFactsForCall(input),
    })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    built.value.mount(fakeAgentCtx([]))
    const identity = registry.publishPaMount('g3-plane-team', 'g3-instance', {
      instanceId: 'g3-instance',
      guard,
      plane: built.value,
      beneficiaryAuthority: 'member',
      readers: {
        permissionPlane: () => ({
          currentCallFacts: () => ({
            healthy: true,
            tuple: { blueprintId: 'g3-bp', contentHash: 'sha256:bphash', revision: '3', templateId: TEMPLATE, cwd: '/tmp/g3-c1' },
            providerVersion: 'pv-1',
          }),
        }),
        overlaySnapshot: async () => ({ metadata: { generation: 0 } }),
        teamHardEnvelope: async () => ({ status: 'absent' }),
        permissionEnvelope: async () => ({ rules: [], scope: 'g3' }),
      },
    })
    try {
      const refusal = await refusalOf((built.value.definitions.find((d) => d.name === 'terminal_send') as Definition)
        .execute({ sessionId: 'pty-1', text: 'make\n', run_in_background: true }, { token: { k: 'g3-l-abort-mid' }, agent: AGENT, signal: controller.signal }))
      // 不猜尚无资源: AT the abort NOTHING was killed — the registration is
      // an INTENT, not a speculative kill (the resource had just started
      // inside run() but stood UNRECORDED at the arm).
      expect(killCountAtAbort, 'the abort moment itself killed nothing').toBe(0)
      // HONOURED after the answer: the port's post-effect recheck read the
      // intent, stopped the STARTED job through the owner-checked registry
      // control, and REFUSED the success commit (never a committed accept).
      expect(refusal.code).toBe('P_TERM_CANCELLED_AFTER_EFFECT')
      expect(refusal.message).toMatch(/cancel|cleanup/i)
      expect(jobsLog, 'start once, then exactly ONE owner-checked kill naming the branded owner')
        .toEqual(['start', 'kill:job-g3-bg-9:s-brand:agent-member-1:cancelled after the background send started'])
      expect(opCancelled, 'the cancel reached the OPERATION through hooks.cancel (cancel is not close)').toBe(1)
      expect(portCalls.filter((c) => c === 'startSend'), 'the operation started exactly once inside run').toEqual(['startSend'])
      expect(portCalls.filter((c) => c === 'kill'), 'the PTY/session survived the cancelled send — cancel is not close').toEqual([])
    } finally {
      registry.revokePaMount('g3-plane-team', 'g3-instance', identity)
    }
  })

  it('(m) jobs supply ABSENT is the TYPED zero-effect refusal through the REAL walk: the bg send reaches NOTHING, the foreground send on the SAME row still serves', async () => {
    const registry = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
      publishPaMount: (root: string, instance: string, entry: Record<string, unknown>) => Record<string, unknown>
      revokePaMount: (root: string, instance: string, identity: Record<string, unknown>) => void
      readPaCallFactsForCall: (input: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>
    }
    const tupleFor = (name: string) => Object.freeze({
      bindingId: `plane-row:${TEMPLATE}:${name}`,
      agentScopeKey: `plane:${TEMPLATE}`,
      toolName: name,
      definitionIdentity: `plane:${TEMPLATE}:${name}`,
      providerId: 'a5p5-plane',
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'confined-subprocess',
      assurance: Object.freeze({}),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    })
    const guard = { dispatcher: { surface: { names: () => [...TOOLS], entryOf: (name: string) => (TOOLS as readonly string[]).includes(name) ? { verified: true, revision: 1, binding: tupleFor(name) } : undefined } } }
    const portCalls: string[] = []
    // NO jobs key on the mount — the supply contract: the registry face
    // travels WITH its branded owner reader or the bg lane refuses typed.
    const w = makeInject({ portCalls })
    const seen: Array<{ family: Record<string, unknown> | undefined }> = []
    const built = buildPlane({
      backends: { terminal: w.inject },
      controlLeg: mintingControlLeg(seen),
      authorityFacts: { overlayGeneration: () => 0 },
      readCallFacts: (input: Record<string, unknown>) => registry.readPaCallFactsForCall(input),
    })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    built.value.mount(fakeAgentCtx([]))
    const identity = registry.publishPaMount('g3-plane-team', 'g3-instance', {
      instanceId: 'g3-instance',
      guard,
      plane: built.value,
      beneficiaryAuthority: 'member',
      readers: {
        permissionPlane: () => ({
          currentCallFacts: () => ({
            healthy: true,
            tuple: { blueprintId: 'g3-bp', contentHash: 'sha256:bphash', revision: '3', templateId: TEMPLATE, cwd: '/tmp/g3-c1' },
            providerVersion: 'pv-1',
          }),
        }),
        overlaySnapshot: async () => ({ metadata: { generation: 0 } }),
        teamHardEnvelope: async () => ({ status: 'absent' }),
        permissionEnvelope: async () => ({ rules: [], scope: 'g3' }),
      },
    })
    try {
      const def = built.value.definitions.find((d) => d.name === 'terminal_send') as Definition
      const refusal = await refusalOf(def.execute({ sessionId: 'pty-1', text: 'make\n', run_in_background: true }, { token: { k: 'g3-m-bg' }, agent: AGENT }))
      expect(refusal.code).toBe('P_TERM_BG_PORT_UNWIRED')
      expect(portCalls.length, 'the unwired bg send entered ZERO service faces').toBe(0)
      // the SAME row, foreground: the refusal was the JOBS lane, never the row.
      const served = await def.execute({ sessionId: 'pty-1', text: 'ls\n' }, { token: { k: 'g3-m-fg' }, agent: AGENT })
      expect(served, 'the foreground send still serves').toBeDefined()
      expect(portCalls).toEqual(['startSend'])
    } finally {
      registry.revokePaMount('g3-plane-team', 'g3-instance', identity)
    }
  })
})
