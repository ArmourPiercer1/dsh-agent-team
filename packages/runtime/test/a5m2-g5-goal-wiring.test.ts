/**
 * a5m2-g5-goal-wiring.test.ts — the ASSEMBLY FACTS of the G5 goal wiring
 * bridge (`src/plugin/live/governed-families/g5-goal-wiring.mjs`) over the
 * committed G5 adapter (rev.1, imported VERBATIM). The adapter spec
 * (a5m2-g5-goal-service-c1.test.ts) owns the ROW laws; this spec owns the
 * bridge: closed input surface, one capture per name, ACTIVE definitions
 * carrying the CAPTURED bytes with ONLY `execute` replaced, the honest
 * DECLARED-INACTIVE census (no def, no registration), THE FULL WALK through
 * the published open/edge/closePlan split-path seat (approve → grant →
 * consumedProof → row.runPlan on the APPROVED plan → verbatim serve →
 * closePlan exactly once), zero-port-entry on every refusal leg, the root-⑤
 * registration pairing at BOTH points, feed-keyed registration minted
 * through the REAL pb §6 seam and round-tripped through the PRODUCTION
 * family registry, drain as new-call prohibition, and the named gaps pinned
 * at their MEASURED bytes through the REAL published checkers.
 *
 * REAL pieces used here: the adapter factory and rows; the REAL pinned host
 * `defineTool` product as the capture (the exact compiled-JSON-Schema shape
 * `ctx.tools.get` answers at the 639 pin — the native `execute` is a
 * never-entered tripwire); `definitionIdentityOf` (tool-dispatch, pb §6);
 * the production `pa-mount-registry`; the published rules-gate checkers
 * (control/types.ts). DISCLOSED STAND-INS (not C2 — no Host, no
 * tests/homes, no network): the goal-service port is a RECORDING double in
 * the pinned seven-method synchronous shape (the adapter spec owns the REAL
 * service half); the `pa` seat is a recording double that OBEYS the real
 * paAdmit open/edge/closePlan contract shape — the way the G6 wiring spec
 * stands in its seat.
 *
 * STATUS tier: wiring-bridge in-process proof (接线未测 boundary — no Host
 * acceptance). Named gaps carried, measured, never worded closed: AUTHORITY
 * UNOBSERVED rides the durable target projection unless readExecutionFacts
 * is injected. The SIGNED B-SESSION rules table now CARRIES the goal leaves
 * (root 01:01 card: one signed entry, discriminated by the lane-minted
 * `operation` leaf, already-approved kinds only) — the spec pins the
 * REAL published validator ACCEPTING every minted projection, mint
 * reproduction, and that a missing leaf STILL denies; the todo variant's
 * claim verdicts are pinned preserved byte-for-byte.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g5-goal-wiring
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot, testUsePath } from '../../../tests/paths.mjs'
import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { isLosslessJsonValue, validatePaFamilyTarget } from '../control/types.js'

const repoRoot = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (repoRoot === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
// the pinned checkout resolves through tests/paths.mjs (the unique path
// source): the canonical repo-relative location, or the read-only 639 base
// when the run supplies DSH_TEST_USE_ROOT (root 02:04 handling).
const HOST_LIB = testUsePath(dirname(fileURLToPath(import.meta.url)), 'packages', 'core', 'tools', 'lib', 'index.js')
if (!existsSync(HOST_LIB)) throw new Error(`pristine host lib absent; failing closed (${HOST_LIB})`)
const hostTools = () => import(pathToFileURL(HOST_LIB).href) as Promise<{
  defineTool: (options: Record<string, unknown>) => Record<string, unknown>
}>

/* ── modules under test (dynamic, runtime .mjs) ──────────────────────── */
interface Row {
  active: boolean
  captured(): boolean
  familyId: string
  adapterRevision: number
  mountState: string
  drainSemantics: string
  captureIdentity?: string
  blocker?: string
  drain(): void
  draining(): boolean
}
interface WireRowEntry { status: string, reason?: string, row: Row, definition?: Record<string, unknown>, captureIdentity?: string }
interface Registration { name: string, definitionIdentity: string, entry: { familyId: string, adapterRevision: number, providerIdentity: string } }
interface Assembly {
  ok: boolean
  code?: string
  detail?: string
  familyId?: string
  adapterRevision?: number
  placementNames?: string[]
  definitions?: Array<Record<string, unknown>>
  rows?: Record<string, WireRowEntry>
  declared?: Array<{ name: string, status: string, reason: string }>
  stats?(): { dispatches: number, refuses: number, driftRejects: number }
  drain?(): { event: string, semantics: string }
  familyRegistrations?(): Registration[]
}
interface PaCall { leg: string, input: Record<string, unknown> | undefined, callId?: string }

const WIRE = (await import(new URL('../src/plugin/live/governed-families/g5-goal-wiring.mjs', import.meta.url).href)) as {
  A5_G5_GOAL_WIRING_REVISION: number
  A5_G5_GOAL_WIRING_CODES: {
    INPUT_INVALID: string
    CALL_ID_ABSENT: string
    EFFECTS_UNPARSABLE: string
    ADMISSION_CANCELLED: string
    APPROVAL_NOT_LANDED: string
    EDGE_CANCELLED: string
    CONSUME_PROOF_MISSING: string
    PLAN_INTEGRITY: string
    PLACEMENT_KEY_ABSENT: string
    PLACEMENT_KEY_MOVED: string
  }
  buildG5GoalWiring: (input?: Record<string, unknown>) => Assembly
}
const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/g5-goal-service.mjs', import.meta.url).href)) as {
  A5_G5_FAMILY_ID: string
  A5_G5_ADAPTER_REVISION: number
  A5_G5_GOAL_CODES: {
    DECLARED_MOUNT_ABSENT: string
    DRAINING: string
    AGENT_REQUIRED: string
    UNKNOWN_ACTION: string
    UNKNOWN_PARAMETER: string
    MISSING_PARAMETER: string
  }
  A5_G5_GOAL_NAMED_GAPS: Record<string, string>
  A5_G5_GOAL_TOOL_NAMES: readonly string[]
}
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  registerA5GovernedFamily: (key: string, entry: { familyId: string, adapterRevision: number, providerIdentity: string }) => void
  a5GovernedFamilyFor: (key: string) => { familyId: string, adapterRevision: number, providerIdentity: string } | undefined
}
const CODES = WIRE.A5_G5_GOAL_WIRING_CODES
const AC = ADAPTER.A5_G5_GOAL_CODES
const REALM = 'realm-g5-wire'
const PROVIDER = 'goal-provider-g5-wire'

/* ── the CAPTURED native faces: the REAL pinned defineTool product ───── */
const UPDATE_ACTIONS = ['edit', 'pause', 'resume', 'complete', 'blocked']
const AUTHORED_PARAMS: Record<string, Record<string, unknown>> = {
  get_goal: {},
  create_goal: {
    objective: { type: 'string', required: true, description: 'The concrete completion objective.' },
    max_goal_rounds: { type: 'number', description: 'Optional cap.' },
  },
  update_goal: {
    goal_id: { type: 'string', required: true, description: 'Exact id returned by get_goal.' },
    revision: { type: 'number', required: true, description: 'Exact positive revision.' },
    action: { type: 'string', required: true, enum: UPDATE_ACTIONS, description: 'The goal action.' },
    objective: { type: 'string', description: 'Replacement objective; edit only.' },
    max_goal_rounds: { type: 'number', description: 'Replacement cap; edit only.' },
    blocked_reason: { type: 'string', description: 'Required only with action blocked.' },
  },
}
const OUTPUT_SCHEMA = { oneOf: [
  { type: 'object', additionalProperties: false, properties: { goal: { type: 'null', required: true } } },
  {
    type: 'object',
    additionalProperties: false,
    properties: {
      goal: {
        type: 'object',
        additionalProperties: false,
        required: true,
        properties: {
          id: { type: 'string', required: true },
          revision: { type: 'integer', required: true },
          objective: { type: 'string', required: true },
          phase: { type: 'string', required: true, enum: ['active', 'paused', 'blocked', 'complete'] },
          roundsStarted: { type: 'integer', required: true },
          maxGoalRounds: { type: 'integer', required: true },
        },
      },
      activation: { type: 'string', required: true, enum: ['armed', 'disarmed'] },
    },
  },
] }

interface CapturedNative { def: Record<string, unknown>; entered: () => number }
async function captureNative(name: string, executeOverride?: (args: Record<string, unknown>, exec: Record<string, unknown>) => unknown): Promise<CapturedNative> {
  const host = await hostTools()
  let entered = 0
  const def = host.defineTool({
    name,
    description: `wiring-lane fixture face for ${name} (capture identity is what matters, not this text)`,
    parameters: JSON.parse(JSON.stringify(AUTHORED_PARAMS[name] ?? {})) as Record<string, unknown>,
    output: {
      schema: JSON.parse(JSON.stringify(OUTPUT_SCHEMA)) as Record<string, unknown>,
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value ?? null) }],
    },
    execute: executeOverride === undefined
      ? async () => {
        entered += 1
        throw new Error('NATIVE BODY MUST NOT BE ENTERED by a governed G5 row')
      }
      // THE BRIDGE-LEVEL DELEGATE DOUBLE (root 06:5x): entered ONLY by the
      // goal-round-blocked-under-untrusted-threshold arm; records the args
      // and the exec identity the walk handed through.
      : async (args: Record<string, unknown>, exec: Record<string, unknown>) => {
        entered += 1
        return executeOverride(args, exec)
      },
  })
  return { def: def as Record<string, unknown>, entered: () => entered }
}

/* ── recording goal-service port (synchronous, pinned seven-method shape) ── */
interface PortCall { method: string, args: unknown[] }
const callAt = (calls: PortCall[], i: number): PortCall => calls[i] as unknown as PortCall
interface FakePort { port: Record<string, unknown>, calls: PortCall[] }
function fakeGoals(current: Record<string, unknown> | undefined, nextViews: Record<string, Record<string, unknown>> = {}, omit: readonly string[] = []): FakePort {
  const calls: PortCall[] = []
  const port: Record<string, unknown> = {}
  const methods = ['get', 'create', 'edit', 'pause', 'resume', 'complete', 'block']
  for (const method of methods) {
    if (omit.includes(method)) continue
    port[method] = (...args: unknown[]): Record<string, unknown> | undefined => {
      calls.push({ method, args })
      if (method === 'get') return current
      const view = nextViews[method]
      if (view === undefined) throw new Error(`fake port: no seeded ${method} view`)
      current = view
      return view
    }
  }
  return { port, calls }
}

const VIEW = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'goal-w1', revision: 1, objective: 'govern the goal tools', phase: 'active',
  roundsStarted: 0, maxGoalRounds: 8, activation: 'armed', ...over,
})
const EXEC = Object.freeze({ agent: Object.freeze({ id: 'agent-g5-wire' }) })

/* ── the PA seat: a recording double OBEYING the published split-path ── */
interface SeatOpts {
  openAnswer?: 'approved' | 'cancelled' | 'deny' | 'unsettled'
  edgeAnswer?: 'allow' | 'cancelled' | 'deny' | 'no-proof'
  grantId?: string
}
function makeSeat(opts: SeatOpts = {}): {
  pa: Record<string, unknown>
  calls: PaCall[]
  closePlanCalls: () => number
  openWalks: () => Array<Record<string, unknown>>
} {
  const calls: PaCall[] = []
  const grantId = opts.grantId ?? 'grant-g5-1'
  const pa: Record<string, unknown> = {
    async open (walk: Record<string, unknown>) {
      calls.push({ leg: 'open', input: walk })
      const answer = opts.openAnswer ?? 'approved'
      if (answer === 'cancelled') return { cancelled: true }
      if (answer === 'deny') return { kind: 'deny', code: 'ADMISSION_DENIED', detail: 'seat denied this walk' }
      if (answer === 'unsettled') return { kind: 'pending' }
      return { kind: 'approved', grant: { grantId }, paDurableMint: { durableId: 'mint-g5-1' } }
    },
    async edge (state: Record<string, unknown>) {
      calls.push({ leg: 'edge', input: state })
      const answer = opts.edgeAnswer ?? 'allow'
      if (answer === 'cancelled') return { cancelled: true }
      if (answer === 'deny') return { kind: 'deny', code: 'EDGE_DENIED', detail: 'edge refused' }
      if (answer === 'no-proof') return { kind: 'allow' }
      const passedGrant = ((state?.grant ?? {}) as { grantId?: string }).grantId
      return { kind: 'allow', consumedProof: { grant: { grantId: String(passedGrant ?? grantId) } } }
    },
    closePlan (callId: string) {
      calls.push({ leg: 'closePlan', input: undefined, callId })
    },
  }
  return {
    pa,
    calls,
    closePlanCalls: () => calls.filter((c) => c.leg === 'closePlan').length,
    openWalks: () => calls.filter((c) => c.leg === 'open').map((c) => c.input as Record<string, unknown>),
  }
}

interface WorldOpts {
  missingNative?: readonly string[]
  portOmit?: readonly string[]
  registrationOf?: () => { adapterRevision: number, providerIdentity: string }
  readExecutionFacts?: () => unknown
  seat?: SeatOpts
  correlationOf?: (exec: unknown, toolName: string) => string | null
  current?: Record<string, unknown> | undefined
  nextViews?: Record<string, Record<string, unknown>>
  placementFeedAbsent?: boolean
  nativeExecute?: Partial<Record<string, (args: Record<string, unknown>, exec: Record<string, unknown>) => unknown>>
}
async function world(opts: WorldOpts = {}): Promise<{
  asm: Assembly
  seat: ReturnType<typeof makeSeat>
  port: FakePort
  natives: Record<string, CapturedNative>
  seamReads: Record<string, number>
  nativeEntered: () => number
  placementDrift: (on: boolean) => void
}> {
  const natives = {} as Record<string, CapturedNative>
  const seamReads: Record<string, number> = { get_goal: 0, create_goal: 0, update_goal: 0 }
  for (const name of ADAPTER.A5_G5_GOAL_TOOL_NAMES) natives[name] = await captureNative(name, opts.nativeExecute?.[name])
  const port = fakeGoals(opts.current ?? VIEW(), opts.nextViews ?? {}, opts.portOmit ?? [])
  const seat = opts.seat === undefined ? makeSeat() : makeSeat(opts.seat)
  let drifted = false
  const asm = WIRE.buildG5GoalWiring({
    realmId: REALM,
    providerId: PROVIDER,
    readNative: (name: string) => {
      seamReads[name] = (seamReads[name] ?? 0) + 1
      if (opts.missingNative?.includes(name)) return undefined
      return natives[name]?.def
    },
    goals: port.port,
    ...(opts.registrationOf === undefined ? {} : { registrationOf: opts.registrationOf }),
    ...(opts.readExecutionFacts === undefined ? {} : { readExecutionFacts: opts.readExecutionFacts }),
    ...(opts.correlationOf === undefined ? {} : { correlationOf: opts.correlationOf }),
    placementFeed: (name: string) => {
      if (opts.placementFeedAbsent === true) return undefined
      const def = (asm.definitions ?? []).find((d) => d.name === name)
      const identity = definitionIdentityOf(def)
      if (identity === null) return undefined
      // Flip it with `placementDrift(true)` and the NEXT mount read answers
      // a different identity for the same placed def — exactly the moved-feed
      // drift the registration law must refuse.
      return Object.freeze({
        definitionIdentity: drifted ? `${String(identity)}-moved` : String(identity),
        realmId: REALM,
      })
    },
    pa: seat.pa,
  })
  return {
    asm,
    seat,
    port,
    natives,
    seamReads,
    nativeEntered: () => ADAPTER.A5_G5_GOAL_TOOL_NAMES.reduce((n, name) => n + (natives[name]?.entered() ?? 0), 0),
    placementDrift: (on: boolean) => { drifted = on },
  }
}

const execWithCall = (callId: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ ...EXEC, callId, ...extra })

describe('a5m2-g5 wiring — closed input surface', () => {
  it('unknown keys, missing seats and malformed supplies refuse the MOUNT typed — never a partial assembly', async () => {
    const unknown = WIRE.buildG5GoalWiring({ realmId: REALM, providerId: PROVIDER, bogus: 1 })
    expect(unknown.ok).toBe(false)
    expect(unknown.code).toBe(CODES.INPUT_INVALID)
    expect(String(unknown.detail)).toContain('unknown wiring input')
    const noGoals = WIRE.buildG5GoalWiring({ realmId: REALM, providerId: PROVIDER, readNative: () => undefined, placementFeed: () => undefined, pa: makeSeat().pa })
    expect(noGoals.code).toBe(CODES.INPUT_INVALID)
    expect(String(noGoals.detail)).toContain('ctx.goals')
    const duckSeat = WIRE.buildG5GoalWiring({ realmId: REALM, providerId: PROVIDER, readNative: () => undefined, goals: {}, placementFeed: () => undefined, pa: { ok: true } })
    expect(duckSeat.code).toBe(CODES.INPUT_INVALID)
    expect(String(duckSeat.detail)).toContain('open / edge / closePlan')
  })

  it('ONE CAPTURE per name: the seam is read AT MOST once per tool name for the whole mount', async () => {
    const w = await world()
    expect(w.asm.ok).toBe(true)
    for (const name of ADAPTER.A5_G5_GOAL_TOOL_NAMES) expect(w.seamReads[name]).toBe(1)
  })
})

describe('a5m2-g5 wiring — placement and census', () => {
  it('ACTIVE defs carry the CAPTURED bytes by identity with ONLY execute replaced; the native body is never entered', async () => {
    const w = await world()
    expect(w.asm.familyId).toBe(ADAPTER.A5_G5_FAMILY_ID)
    expect(w.asm.adapterRevision).toBe(ADAPTER.A5_G5_ADAPTER_REVISION)
    expect((w.asm.placementNames ?? []).slice().sort()).toEqual(['create_goal', 'get_goal', 'update_goal'])
    for (const def of w.asm.definitions ?? []) {
      const native = w.natives[String(def.name)]?.def
      expect(def.description).toBe(native?.description)
      expect(def.parameters).toBe(native?.parameters) // compiled canonical schema — SAME object, never re-lifted
      expect(def.output).toBe(native?.output)
      expect(def.execute).not.toBe(native?.execute)
      expect(typeof def.execute).toBe('function')
    }
    expect(w.nativeEntered()).toBe(0)
    expect(w.port.calls.length).toBe(0)
  })

  it('a missing capture answers DECLARED-INACTIVE (no def, no registration); the served names keep their census entry', async () => {
    const w = await world({ missingNative: ['create_goal'] })
    expect(w.asm.rows?.create_goal?.status).toBe('DECLARED-INACTIVE')
    expect(w.asm.rows?.create_goal?.reason).toBe('declared-mount-absent')
    expect((w.asm.definitions ?? []).map((d) => d.name).sort()).toEqual(['get_goal', 'update_goal'])
    expect((w.asm.declared ?? []).map((d) => d.name)).toEqual(['create_goal'])
    const registrations = (w.asm.familyRegistrations ?? (() => []))()
    expect(registrations.map((r) => r.name).sort()).toEqual(['get_goal', 'update_goal'])
  })

  it('a port missing ONE method lands the adapter per-record census (goals-port-incomplete), the other rows still mount', async () => {
    const w = await world({ portOmit: ['block'] })
    expect(w.asm.rows?.update_goal?.status).toBe('DECLARED-INACTIVE')
    expect(w.asm.rows?.update_goal?.reason).toBe('goals-port-incomplete')
    expect(w.asm.rows?.get_goal?.status).toBe('ACTIVE')
    expect(w.asm.rows?.create_goal?.status).toBe('ACTIVE')
  })

  it('familyRegistrations mint through the REAL pb §6 seam, round-trip the PRODUCTION registry, and carry the ROW bytes', async () => {
    const w = await world()
    const registrations = (w.asm.familyRegistrations ?? (() => []))()
    expect(registrations.length).toBe(3)
    for (const registration of registrations) {
      const def = (w.asm.definitions ?? []).find((d) => d.name === registration.name)
      expect(registration.definitionIdentity).toBe(String(definitionIdentityOf(def)))
      expect(registration.entry).toEqual({
        familyId: ADAPTER.A5_G5_FAMILY_ID,
        adapterRevision: ADAPTER.A5_G5_ADAPTER_REVISION,
        providerIdentity: PROVIDER,
      })
      REGISTRY.registerA5GovernedFamily(registration.definitionIdentity, registration.entry)
      expect(REGISTRY.a5GovernedFamilyFor(registration.definitionIdentity)).toEqual(registration.entry)
    }
  })

  it('a silent placement feed THROWS (no guessed key); a MOVED feed THROWS (identity does not float)', async () => {
    const absent = await world({ placementFeedAbsent: true })
    expect(() => (absent.asm.familyRegistrations ?? (() => []))()).toThrow(new RegExp(CODES.PLACEMENT_KEY_ABSENT))
    const moved = await world()
    const registrations = (moved.asm.familyRegistrations ?? (() => []))()
    expect(registrations.map((r) => r.name).sort()).toEqual(['create_goal', 'get_goal', 'update_goal'])
    moved.placementDrift(true)
    expect(() => (moved.asm.familyRegistrations ?? (() => []))()).toThrow(new RegExp(CODES.PLACEMENT_KEY_MOVED))
  })
})

describe('a5m2-g5 wiring — the full walk through the published split-path seat (real mint/edge legs)', () => {
  it('success: classify -> open(approved+grant) -> edge(consumedProof) -> row.runPlan -> the canonical goalValue served VERBATIM -> closePlan exactly once', async () => {
    const CREATED = VIEW({ id: 'goal-new', objective: 'wire the goal service', revision: 1 })
    const w = await world({ current: VIEW(), nextViews: { create: CREATED }, readExecutionFacts: () => ({ kind: 'direct-human' }) }) // P1 2026-10-24: a trusted per-call reader is now REQUIRED for a write arm to run
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'create_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<Record<string, unknown>> }
    const served = await def.execute({ objective: 'wire the goal service' }, execWithCall('call-g5-create'))
    // goalValue's projection (timestamps dropped), asserted against the
    // PORT's own seeded view — not against an echo of the request.
    expect(served).toEqual({
      goal: {
        id: CREATED.id, revision: CREATED.revision, objective: CREATED.objective,
        phase: CREATED.phase, roundsStarted: CREATED.roundsStarted, maxGoalRounds: CREATED.maxGoalRounds,
      },
      activation: CREATED.activation,
    })
    expect(w.port.calls.length).toBe(1)
    expect(callAt(w.port.calls, 0).method).toBe('create')
    expect(callAt(w.port.calls, 0).args[0]).toBe(EXEC.agent) // Agent BY REFERENCE through the bridge
    expect(w.seat.calls.map((c) => c.leg)).toEqual(['open', 'edge', 'closePlan'])
    expect(w.seat.closePlanCalls()).toBe(1)
    expect(w.nativeEntered()).toBe(0)
  })

  it('the walk carries the four P-adds at FULL VALUE and the census effect; the edge sees grant + paDurableMint passed through', async () => {
    const w = await world({ current: VIEW() })
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'get_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<unknown> }
    await def.execute({}, execWithCall('call-g5-get'))
    const walk = w.seat.openWalks()[0] as Record<string, unknown>
    expect(walk.realmId).toBe(REALM)
    expect(walk.callId).toBe('call-g5-get')
    expect(walk.toolName).toBe('get_goal')
    expect(walk.requestedEffects).toMatchObject({ effects: [{ kind: 'tool-invoke', toolName: 'get_goal', resource: null }] })
    expect(typeof (walk.requestedEffects as Record<string, unknown>).fingerprint).toBe('string')
    expect(typeof walk.parametersFingerprint).toBe('string')
    const family = walk.family as Record<string, unknown>
    expect(family.familyId).toBe(ADAPTER.A5_G5_FAMILY_ID)
    expect(family.adapterRevision).toBe(ADAPTER.A5_G5_ADAPTER_REVISION)
    expect(family.providerIdentity).toBe(PROVIDER)
    expect((family.targetManifest as Record<string, unknown>).toolName).toBe('get_goal')
    const edgeInput = (w.seat.calls[1] as unknown as { input: Record<string, unknown> }).input
    expect(edgeInput.grant).toEqual({ grantId: 'grant-g5-1' })
    expect(edgeInput.paDurableMint).toEqual({ durableId: 'mint-g5-1' })
  })

  it('classify refusal runs BEFORE any PA question: zero seat legs, zero closePlan, zero port entry', async () => {
    const w = await world()
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'update_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(def.execute({ goal_id: 'g', revision: 1, action: 'explode' }, execWithCall('call-bad'))).rejects.toThrow(new RegExp(AC.UNKNOWN_ACTION))
    expect(w.seat.calls.length).toBe(0)
    expect(w.port.calls.length).toBe(0)
  })

  it('no ISSUED call identity refuses (P_G5_WIRE_CALL_ID_ABSENT): zero port entry, closed nothing (no plan fact opened)', async () => {
    const w = await world({ correlationOf: () => null })
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'get_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(def.execute({}, { ...EXEC })).rejects.toThrow(new RegExp(CODES.CALL_ID_ABSENT))
    expect(w.port.calls.length).toBe(0)
    expect(w.seat.closePlanCalls()).toBe(0)
  })

  it('cancelled at open: ADMISSION_CANCELLED, zero port entry, plan fact closed', async () => {
    const w = await world({ seat: { openAnswer: 'cancelled' } })
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'get_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(def.execute({}, execWithCall('call-canc'))).rejects.toThrow(new RegExp(CODES.ADMISSION_CANCELLED))
    expect(w.port.calls.length).toBe(0)
    expect(w.seat.closePlanCalls()).toBe(1)
  })

  it('deny at open carries the kernel bytes verbatim; unsettled-without-grant answers APPROVAL_NOT_LANDED — the seat state never substitutes', async () => {
    const denied = await world({ seat: { openAnswer: 'deny' } })
    const d1 = (denied.asm.definitions ?? [])[0] as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(d1.execute({}, execWithCall('call-deny'))).rejects.toThrow(new RegExp('ADMISSION_DENIED'))
    const unsettled = await world({ seat: { openAnswer: 'unsettled' } })
    const d2 = (unsettled.asm.definitions ?? [])[0] as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(d2.execute({}, execWithCall('call-unsettled'))).rejects.toThrow(new RegExp(CODES.APPROVAL_NOT_LANDED))
    expect(denied.port.calls.length + unsettled.port.calls.length).toBe(0)
  })

  it('cancelled/denied at the edge: the approval is never replayed, zero port entry, closed once', async () => {
    const cancelled = await world({ seat: { edgeAnswer: 'cancelled' } })
    const c1 = (cancelled.asm.definitions ?? [])[0] as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(c1.execute({}, execWithCall('call-edgecanc'))).rejects.toThrow(new RegExp(CODES.EDGE_CANCELLED))
    const denied = await world({ seat: { edgeAnswer: 'deny' } })
    const d = (denied.asm.definitions ?? [])[0] as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(d.execute({}, execWithCall('call-edgedeny'))).rejects.toThrow(new RegExp('EDGE_DENIED'))
    expect(cancelled.port.calls.length + denied.port.calls.length).toBe(0)
    expect(cancelled.seat.closePlanCalls()).toBe(1)
  })

  it('allow WITHOUT the one-shot consume witness refuses CONSUME_PROOF_MISSING — no self-attested consumption, the row never runs, zero port entry', async () => {
    const w = await world({ seat: { edgeAnswer: 'no-proof' } })
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'get_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(def.execute({}, execWithCall('call-noproof'))).rejects.toThrow(new RegExp(CODES.CONSUME_PROOF_MISSING))
    expect(w.port.calls.length).toBe(0)
    expect(w.seat.closePlanCalls()).toBe(1)
  })
})

describe('a5m2-g5 wiring — the root-⑤ registration pairing at both points', () => {
  it('a registration carrying a foreign version refuses BEFORE the PA question opens (existing code, no new vocabulary)', async () => {
    const w = await world({ registrationOf: () => ({ adapterRevision: 999, providerIdentity: PROVIDER }) })
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'get_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(def.execute({}, execWithCall('call-pair1'))).rejects.toThrow(new RegExp(CODES.ADMISSION_CANCELLED))
    expect(w.seat.calls.length).toBe(0) // not even open ran
    expect(w.port.calls.length).toBe(0)
  })

  it('a registration that MOVES between open and the body stops after the grant, before port entry (EDGE_CANCELLED bytes)', async () => {
    let flip = false
    const w = await world({ registrationOf: () => (flip
      ? { adapterRevision: 7, providerIdentity: PROVIDER }
      : { adapterRevision: ADAPTER.A5_G5_ADAPTER_REVISION, providerIdentity: PROVIDER }) })
    // flip fires once the edge leg has run: wrap the seat edge to set the flag
    const edgeFn = w.seat.pa.edge as (s: Record<string, unknown>) => Promise<unknown>
    w.seat.pa.edge = async (s: Record<string, unknown>) => { flip = true; return await edgeFn(s) }
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'get_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(def.execute({}, execWithCall('call-pair2'))).rejects.toThrow(new RegExp(CODES.EDGE_CANCELLED))
    expect(w.port.calls.length).toBe(0)
    expect(w.seat.closePlanCalls()).toBe(1)
  })
})

describe('a5m2-g5 wiring — row law survives the bridge (agent law, authority UNOBSERVED, drain)', () => {
  it('no calling agent: the ROW owns the refusal (P_G5_AGENT_REQUIRED) after the witness — zero port entry', async () => {
    const w = await world()
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'get_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(def.execute({}, { callId: 'call-noagent' })).rejects.toThrow(new RegExp(AC.AGENT_REQUIRED))
    expect(w.port.calls.length).toBe(0)
    expect(w.seat.closePlanCalls()).toBe(1)
  })

  it('AUTHORITY named gap: without readExecutionFacts the durable targetManifest carries the UNOBSERVED fact verbatim — never a pass', async () => {
    const w = await world({ nextViews: { create: VIEW({ id: 'goal-auth' }) } })
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'create_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<unknown> }
    // CENTER P1 SAFE BLOCK 2026-10-24 (root-confirmed): the durable row STILL
    // says UNOBSERVED verbatim AND the mutation now REFUSES before the port -
    // the old pass-through was the authority bypass (host would refuse @224).
    await expect(def.execute({ objective: 'o' }, execWithCall('call-auth'))).rejects.toThrow('P_G5_GOAL_DIRECT_HUMAN_REQUIRED')
    const target = (w.seat.openWalks()[0] as { family: { targetManifest: Record<string, unknown> } }).family.targetManifest
    expect(target.authorityObserved).toBe(false)
    expect(String(target.authorityReason)).toContain('AUTHORITY UNOBSERVED')
    expect(target.authorityKind).toBeNull() // missing ≠ null ≠ '': UNOBSERVED is SAYABLE, never a silent pass
  })

  it('CENTER P1 2026-10-24 safe block: UNOBSERVED authority refuses every gated write before the port; the get_goal READ arm stays open', async () => {
    const w = await world({ current: VIEW(), nextViews: { create: VIEW({ id: 'goal-x' }), pause: VIEW({ phase: 'paused', revision: 2 }) } })
    const defs = Object.fromEntries((w.asm.definitions ?? []).map((d) => [d.name, d as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<unknown> }]))
    await expect(defs.create_goal!.execute({ objective: 'o' }, execWithCall('c1'))).rejects.toThrow('P_G5_GOAL_DIRECT_HUMAN_REQUIRED')
    await expect(defs.update_goal!.execute({ goal_id: 'goal-w1', revision: 1, action: 'edit' }, execWithCall('c2'))).rejects.toThrow('P_G5_GOAL_DIRECT_HUMAN_REQUIRED')
    await expect(defs.update_goal!.execute({ goal_id: 'goal-w1', revision: 1, action: 'complete' }, execWithCall('c3'))).rejects.toThrow('P_G5_GOAL_COMPLETION_AUTHORITY_REQUIRED')
    expect(w.nativeEntered()).toBe(0) // every refusal settles BEFORE the native/port
    // P2 companion (root 05:5x): the goal-round blocked leg (THRESHOLD TRUST,
    // no trusted config supply closes that arm alone) is pinned VERBATIM in
    // the service spec — it needs the port's goal facts; this bridge layer
    // pins the authority-gated refusals, which sit BEFORE the threshold leg.
    const served = await defs.get_goal!.execute({}, execWithCall('c4')) // the READ arm is unchanged
    expect((served as { goal?: { id?: string } }).goal?.id).toBeDefined()
  })

  it('with the authority seam injected the row ENFORCES its own laws through the bridge (goal-round completion needs the round fact)', async () => {
    const w = await world({
      readExecutionFacts: () => ({ kind: 'direct-human' }),
      current: VIEW({ phase: 'active' }),
      nextViews: { complete: VIEW({ phase: 'complete' }) },
    })
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'update_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<unknown> }
    await def.execute({ goal_id: 'goal-w1', revision: 1, action: 'complete' }, execWithCall('call-complete'))
    expect(callAt(w.port.calls, 0).method).toBe('complete')
  })

  it('THE DELEGATE THROUGH THE BRIDGE (root 06:5x): goal-round blocked under NO trusted threshold — one PA admission, the walk executes the captured native body ONCE with the exec verbatim, zero port, serves the native value; the walk still closes exactly once', async () => {
    const seen: Array<{ args: Record<string, unknown>, exec: Record<string, unknown> }> = []
    const nativeView = { goal: { id: 'goal-w1', revision: 2, objective: 'govern the goal tools', phase: 'blocked', roundsStarted: 3, maxGoalRounds: 4, blockedReason: { code: 'model-reported', message: 'x' } }, activation: 'disarmed' }
    const w = await world({
      readExecutionFacts: () => ({ kind: 'goal-round' }),
      current: VIEW({ roundsStarted: 3 }),
      nativeExecute: {
        update_goal: (args, exec) => {
          seen.push({ args, exec })
          return nativeView
        },
      },
    })
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'update_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<unknown> }
    const exec = execWithCall('call-delegate')
    const served = await def.execute({ goal_id: 'goal-w1', revision: 1, action: 'blocked', blocked_reason: 'x' }, exec)
    expect(served).toEqual(nativeView) // the native body's projection rides the walk verbatim
    expect(seen.length).toBe(1) // ONE body, entered exactly once per ONE admission
    expect(seen[0].exec).toBe(exec) // the dispatch exec VERBATIM through the bridge
    expect(w.port.calls.length).toBe(0) // zero port entry for the delegate arm
    expect(w.nativeEntered()).toBe(1)
    const walks = w.seat.openWalks()
    expect(walks.length).toBe(1) // one PA admission serves the delegated call (no second walk, no second consume)
  })

  it('drain is the row law verbatim: new calls refuse P_G5_DRAINING, committed state untouched', async () => {
    const w = await world()
    const drained = (w.asm.drain ?? (() => ({ event: '', semantics: '' })))()
    expect(drained.semantics).toContain('NEW-CALL PROHIBITION')
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'get_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<never> }
    await expect(def.execute({}, execWithCall('call-after-drain'))).rejects.toThrow(new RegExp(AC.DRAINING))
    expect(w.port.calls.length).toBe(0)
    for (const name of ADAPTER.A5_G5_GOAL_TOOL_NAMES) expect(w.asm.rows?.[name]?.row.draining()).toBe(true)
  })
})

describe('a5m2-g5 wiring — the NAMED GAP at its measured bytes: the signed B-SESSION table carries only the todo variant', () => {
  it('the goal targetManifest is LOSSLESS JSON (passes the real published losslessness checker)', async () => {
    const w = await world({ nextViews: { pause: VIEW({ phase: 'paused', revision: 2 }) }, readExecutionFacts: () => ({ kind: 'direct-human' }) }) // P1 2026-10-24
    const def = (w.asm.definitions ?? []).find((d) => d.name === 'update_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<unknown> }
    await def.execute({ goal_id: 'goal-w1', revision: 1, action: 'pause' }, execWithCall('call-lossless'))
    const walk = w.seat.openWalks()[0] as { family: { targetManifest: unknown } }
    expect(isLosslessJsonValue(walk.family.targetManifest)).toBe(true)
  })

  it('the REAL signed table ACCEPTS every minted goal projection (all three census variants, binds honored)', async () => {
    const w = await world({ nextViews: { create: VIEW({ id: 'goal-a' }), pause: VIEW({ phase: 'paused' }) }, readExecutionFacts: () => ({ kind: 'direct-human' }) }) // P1 2026-10-24
    const targets: Record<string, unknown> = {}
    const get = (w.asm.definitions ?? []).find((d) => d.name === 'get_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<unknown> }
    await get.execute({}, execWithCall('call-tbl-get'))
    const create = (w.asm.definitions ?? []).find((d) => d.name === 'create_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<unknown> }
    await create.execute({ objective: 'o' }, execWithCall('call-tbl-create'))
    const upd = (w.asm.definitions ?? []).find((d) => d.name === 'update_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<unknown> }
    await upd.execute({ goal_id: 'goal-w1', revision: 1, action: 'pause' }, execWithCall('call-tbl-pause'))
    for (const call of w.seat.openWalks()) {
      const family = call.family as { targetManifest: Record<string, unknown> }
      targets[String(family.targetManifest.operation)] = family.targetManifest
    }
    expect(Object.keys(targets).sort()).toEqual(['goal-action-dispatch', 'goal-create', 'goal-read'])
    for (const target of Object.values(targets)) {
      expect(validatePaFamilyTarget(ADAPTER.A5_G5_FAMILY_ID, target), JSON.stringify(target)).toBeUndefined()
    }
    expect(targets['goal-read']).toMatchObject({ toolName: 'get_goal', recordIndex: 28 })
    expect(targets['goal-create']).toMatchObject({ toolName: 'create_goal', recordIndex: 27 })
    expect(targets['goal-action-dispatch']).toMatchObject({ toolName: 'update_goal', recordIndex: 29 })
  })

  it('the mint REPRODUCES: the same measured facts project deep-equal leaves (a stable grammar face, not a per-call sketch)', async () => {
    const w = await world()
    const get = (w.asm.definitions ?? []).find((d) => d.name === 'get_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<unknown> }
    await get.execute({}, execWithCall('call-repro-1'))
    await get.execute({}, execWithCall('call-repro-2'))
    const walks = w.seat.openWalks()
    const first = (walks[0] as { family: { targetManifest: unknown } }).family.targetManifest
    const second = (walks[1] as { family: { targetManifest: unknown } }).family.targetManifest
    expect(second).toEqual(first)
  })

  it('ABSENCE still denies through the REAL validator: stripped leaf, moved bind, foreign key, unknown operation — and the todo claim verdicts ride the SAME bytes', async () => {
    const w = await world()
    const get = (w.asm.definitions ?? []).find((d) => d.name === 'get_goal') as { execute: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<unknown> }
    await get.execute({}, execWithCall('call-neg'))
    const minted = (w.seat.openWalks()[0] as { family: { targetManifest: Record<string, unknown> } }).family.targetManifest
    expect(minted).toBeDefined()
    const { authorityReason: _gone, ...stripped } = minted
    expect(validatePaFamilyTarget(ADAPTER.A5_G5_FAMILY_ID, stripped))
      .toBe('authorityReason: required by the B-SESSION typed plan, absent')
    expect(validatePaFamilyTarget(ADAPTER.A5_G5_FAMILY_ID, { ...minted, toolName: 'create_goal' }))
      .toBe("toolName: not the 'goal-read' variant constant of the B-SESSION typed plan")
    expect(validatePaFamilyTarget(ADAPTER.A5_G5_FAMILY_ID, { ...minted, extra: 1 }))
      .toBe('extra: not part of the B-SESSION typed plan')
    expect(validatePaFamilyTarget(ADAPTER.A5_G5_FAMILY_ID, { ...minted, operation: 'goal-bogus' }))
      .toBe("operation: 'goal-bogus' selects no B-SESSION variant group")
    // The todo `replace-list` claim verdicts are PRESERVED through the group
    // law (the real todo.mjs:234-246 shape; same bytes, pinned here for the
    // G5-side supply — the rules lane's own spec owns the full regression).
    const todoClaim = { operation: 'replace-list', agentId: 'a1', sessionHeaderId: 'h1', todosDigest: 'd', counts: { pending: 1, inProgress: 0, completed: 0 }, allowParallelPolicy: false, paramFingerprint: 'd' }
    expect(validatePaFamilyTarget('B-SESSION', todoClaim)).toBeUndefined()
    const { paramFingerprint: _fp, ...todoStripped } = todoClaim
    expect(validatePaFamilyTarget('B-SESSION', todoStripped))
      .toBe('paramFingerprint: required by the B-SESSION typed plan, absent')
    expect(validatePaFamilyTarget('B-SESSION', { ...todoClaim, lane: 'extra' }))
      .toBe('lane: not part of the B-SESSION typed plan')
    expect(ADAPTER.A5_G5_GOAL_NAMED_GAPS.AUTHORITY).toContain('authority.ts:80-118')
  })
})
