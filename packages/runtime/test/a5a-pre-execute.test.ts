/**
 * a5a-pre-execute.test.ts — A5 (alpha.2, plan §10) MUST-TEST: the
 * agent-scoped `tools/pre-execute` enforcement adapter (plan §10.2
 * FROZEN pipeline, §10.3 zero-effect invariant, §10.4 cancellation) over
 * the REAL A4 control service (durable P6-T4 world — plan §13 L2
 * "Control Integration") with a FAKE agent ctx (a tiny double whose
 * `on` records the listener and returns a tracked disposer) and a
 * DETERMINISTIC FAKE resolver (stable `file:///` keys — no real fs).
 *
 * Scenario map (the 15 mandated scenarios):
 *  S1  allow executes (exact allow rule) — next once, ZERO control rows
 *  S2  static deny (exact deny rule) — deny, next never, no control rows
 *  S3  full ask→allow (member): durable leader-approval row, the
 *      listener PAUSES at awaitControlDecision, leader resolve → allow,
 *      next once, the consumption row exists (exactly-once)
 *  S4  ask→deny (member): leader resolves deny → deny, next never
 *  S5  exactly-once / allow-once: a second identical call (same
 *      file+content, NEW callId) → a NEW request (the old decision is
 *      consumed — pinned by a direct allow-consumed guard); resolve the
 *      new one with deny → zero second execution
 *  S6  fingerprint mismatch: approved write(fileC,'payload-1'); a new
 *      write(fileC,'payload-2') (new callId) → a NEW request with a
 *      DIFFERENT fingerprint; the old allow cannot authorize the new op
 *      (the guard under the new scope sees the new request pending);
 *      the new approval authorizes only the new op
 *  S7  routing: member ask → 'leader-approval' row; leader ask →
 *      'user-approval' row (the durable request kind)
 *  S8  member self-approval forbidden: a member resolving its own
 *      leader-approval request → CONTROL_RESOLVER_NOT_AUTHORIZED (the
 *      request stays pending; the waiting listener keeps waiting; a
 *      later leader allow unblocks it)
 *  S9  leader self-approval on user-approval forbidden: a leader
 *      resolving a user-approval request → CONTROL_RESOLVER_NOT_AUTHORIZED
 *      (human-only); the human then resolves allow
 *  S10 cancellation: abort the exec signal while the wait is pending →
 *      the listener settles DENY (abort), next never, NO unhandled
 *      rejection, the durable request STAYS pending (alpha.2)
 *  S11 unsupported tool pass-through: 'web_fetch' → next called, zero
 *      control rows, the fake resolver NOT called
 *  S12 bash tool-level: ask lane [bash any] → ask → allow → executes
 *      (the request carries the CONSTANT bash fingerprint — the same
 *      fingerprint for different command strings); bash with NO rule +
 *      default deny → static deny, zero execution, no request
 *  S13 canonicalization failure: the resolver throws for a path → deny
 *      (typed closed reason 'resolver-threw'), next never, no request;
 *      malformed arguments (write without file_path) → deny
 *      ('file-path-missing'), the resolver NOT called, no request
 *  S14 pre-aborted signal: signal already aborted + a policy that would
 *      ask → deny WITHOUT creating a request row (R3)
 *  S15 disposer: the install returns the ctx.on disposer; it removes
 *      the listener (trigger after dispose finds none); a second
 *      install on the same double works independently
 *
 * Design rulings under test (the adapter module doc R1–R5): R3 is
 * pinned by S14; R5's no-request consistency anomaly is pinned by the
 * adapter mapping (a direct guard consult in S6 shows the pending
 * verdict that the adapter would map to a deny — the adapter path
 * itself never reaches a no-request on a just-created request); R4 is
 * pinned by the service construction (waitPollIntervalMs: 10 injected
 * at the A4 seam — the adapter takes no hint).
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim — see
 * `a3-permission-resolver.test.ts` header): every async scenario runs
 * at MODULE level (top-level await) and captures its results; the `it`
 * bodies are pure synchronous assertions. Shim matchers used:
 * toBe / toEqual (+.not) only.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does.
 *
 * @module @dsh-agent-team/runtime/test/a5a-pre-execute
 */
import { describe, expect, it } from 'vitest'
import {
  CONTROL_ERROR_CODES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
  createControlService,
  isControlError,
} from '../control/index.js'
import type {
  ControlGuardVerdict,
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
import {
  canonicalizeOperation,
  installParameterPermissionListener,
} from '../operation-permission/index.js'
import type {
  PreExecuteExec,
  PreToolDecisionLike,
} from '../operation-permission/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_ROOT,
  P6T4_NOW,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)

/** The closed action name the adapter uses (mirrors the adapter module). */
const ACTION_NAME = 'parameter-permission'

/** A real-timer sleep (the wait-bridge scenarios poll at 10 ms). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// The fake agent ctx (a tiny double over the minimal structural surface).
// ---------------------------------------------------------------------------

type PreExecuteListener = (
  exec: PreExecuteExec,
  next: () => Promise<PreToolDecisionLike>,
) => Promise<PreToolDecisionLike>

/**
 * The minimal structural mirror of the guard the end-cap registers
 * (H1): only the exec field the adapter's guard reads.
 */
type GuardFn = (exec: { readonly name: string }) => string | undefined

interface FakeAgentCtx {
  readonly on: (event: string, listener: PreExecuteListener) => () => void
  /** The agent-scoped tool surface (H1): records the end-cap guard. */
  readonly tools: {
    guard(guard: GuardFn): () => void
  }
  trigger: (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ) => Promise<PreToolDecisionLike>
  listenerCount: () => number
  /** Every guard ever registered (including disposed ones). */
  guardCount: () => number
  /** Guards registered and NOT yet disposed. */
  activeGuardCount: () => number
  /** Disposal order of the composite disposer (`'listener'`/`'guard'`). */
  readonly disposeLog: string[]
  readonly events: string[]
  /** The disposer returned by the most recent `on` call (identity checks). */
  lastDisposer: (() => void) | undefined
}

/**
 * Build the fake agent ctx: `on` records the listener, `tools.guard`
 * records the end-cap guard (H1 — the install requires this seam),
 * and `trigger` drives the recorded listener with one exec + next.
 */
function makeFakeAgentCtx(): FakeAgentCtx {
  const listeners: PreExecuteListener[] = []
  const guards: Array<{ fn: GuardFn; disposed: boolean }> = []
  const events: string[] = []
  const disposeLog: string[] = []
  const state = { lastDisposer: undefined as (() => void) | undefined }
  const on = (event: string, listener: PreExecuteListener): (() => void) => {
    events.push(event)
    listeners.push(listener)
    const disposer = (): void => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
      disposeLog.push('listener')
    }
    state.lastDisposer = disposer
    return disposer
  }
  const guard = (fn: GuardFn): (() => void) => {
    const entry = { fn, disposed: false }
    guards.push(entry)
    return (): void => {
      entry.disposed = true
      disposeLog.push('guard')
    }
  }
  const trigger = async (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ): Promise<PreToolDecisionLike> => {
    const listener = listeners[0]
    if (listener === undefined) throw new Error('a5a fake ctx: no listener registered')
    return listener(exec, next)
  }
  return {
    on,
    tools: { guard },
    trigger,
    listenerCount: () => listeners.length,
    guardCount: () => guards.length,
    activeGuardCount: () => guards.filter((g) => !g.disposed).length,
    disposeLog,
    events,
    get lastDisposer(): (() => void) | undefined {
      return state.lastDisposer
    },
  }
}

// ---------------------------------------------------------------------------
// The deterministic fake resolver (stable keys, trivial normalization).
// ---------------------------------------------------------------------------

interface FakeResolver {
  readonly resolver: (path: string) => Promise<{ readonly key: string; readonly display: string }>
  /** Every path passed to the resolver, in order (the call-counter). */
  readonly calls: string[]
  /** The stable key of one path (the same normalization as the resolver). */
  keyOf: (path: string) => string
}

/**
 * Build the deterministic fake resolver: the SAME path spelling (and any
 * spelling this normalization equates: backslashes, doubled slashes, a
 * leading './') always yields the SAME key; the display is the raw path
 * (display changes never change authority). `failFor` injects a backend
 * resolution failure for the named paths (the S13 canonicalization
 * failure).
 */
function makeFakeResolver(options: { readonly failFor?: (path: string) => boolean } = {}): FakeResolver {
  const calls: string[] = []
  const normalize = (path: string): string =>
    path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/')
  const keyOf = (path: string): string => `file:///${normalize(path)}`
  const resolver = async (path: string): Promise<{ readonly key: string; readonly display: string }> => {
    calls.push(path)
    if (options.failFor !== undefined && options.failFor(path)) {
      throw new Error(`fake backend: cannot resolve '${path}'`)
    }
    return { key: keyOf(path), display: path }
  }
  return { resolver, calls, keyOf }
}

// ---------------------------------------------------------------------------
// The exec / next fixtures.
// ---------------------------------------------------------------------------

/** One synthetic pre-execute payload (a deep-frozen-argument mirror). */
function makeExec(args: {
  readonly name: string
  readonly arguments?: unknown
  readonly callId: string
  readonly signal?: AbortSignal
}): PreExecuteExec {
  return {
    callId: args.callId,
    name: args.name,
    arguments: args.arguments ?? {},
    signal: args.signal ?? new AbortController().signal,
  }
}

/** The spy next (records its call count; resolves the chain default allow). */
function makeNext(): { readonly fn: () => Promise<PreToolDecisionLike>; calls: () => number } {
  let count = 0
  return {
    fn: async (): Promise<PreToolDecisionLike> => {
      count += 1
      return { kind: 'allow' }
    },
    calls: () => count,
  }
}

// ---------------------------------------------------------------------------
// The install environment (one world + one REAL control service + one
// adapter install on a fake ctx).
// ---------------------------------------------------------------------------

interface EnvOptions {
  readonly policy: TemplatePermissionPolicy
  readonly isLeader: boolean
  readonly failFor?: (path: string) => boolean
}

interface Env {
  readonly world: P6T1World
  readonly service: ControlService
  readonly ctx: FakeAgentCtx
  readonly resolver: FakeResolver
  readonly observations: Record<string, unknown>[]
  /** The disposer the install returned (the ctx.on return). */
  readonly disposer: () => void
}

/**
 * Build one test environment: a fresh P6-T4 durable world, the REAL
 * control service over it (waitPollIntervalMs: 10 — the A4-injected fast
 * poll cadence; R4: the adapter takes no hint), and ONE adapter install
 * on a fresh fake ctx (member or leader, per options.isLeader).
 */
async function createEnv(basename: string, options: EnvOptions): Promise<Env> {
  const world = await createP6T4World(basename, ['leader', 'worker'])
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 10,
  })
  const ctx = makeFakeAgentCtx()
  const resolver = makeFakeResolver({ failFor: options.failFor })
  const observations: Record<string, unknown>[] = []
  const isLeader = options.isLeader
  const caller = isLeader ? leaderCaller() : memberCaller(WORKER_ID)
  const targetInstanceId = isLeader ? LEADER_ID : WORKER_ID
  const disposer = installParameterPermissionListener(ctx, {
    policy: options.policy,
    resolveTarget: resolver.resolver,
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller,
    targetInstanceId,
    isLeader,
    onObserve: (observation) => {
      observations.push(observation)
    },
  })
  return { world, service, ctx, resolver, observations, disposer }
}

/** Poll the durable control state until the request for a correlation
 * appears (or the timeout — a test failure with the captured state). */
async function waitForRequest(
  service: ControlService,
  correlation: string,
): Promise<ControlRequestRecord> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const state = await service.listControlState(P6T4_ROOT)
    const found = state.requests.find((r) => r.correlation === correlation)
    if (found !== undefined) return found
    await sleep(5)
  }
  throw new Error(`a5a: no durable control request for correlation '${correlation}' after 1 s`)
}

// ===========================================================================
// S1/S2/S11/S13/S15 — world W1: default deny + exact allow (read fileA)
// + exact deny (write denied.txt).
// ===========================================================================

const W1_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'exact', path: 'fileA.txt' } }],
  ask: [],
  deny: [{ tool: 'write', resource: { kind: 'exact', path: 'denied.txt' } }],
}

const S1R = await (async () => {
  const env = await createEnv('a5a-w1', { policy: W1_POLICY, isLeader: false })
  // The S13 sub-world (a second install with a failing resolver) is
  // created inside the try so the finally destroys it too.
  let envF: Env | undefined
  try {
    // S1 — allow executes: read fileA matches the exact allow rule (the
    // rule path 'fileA.txt' canonicalizes to the SAME key as the op
    // path './fileA.txt' — different spellings, one identity: the
    // rule-canonicalization cache (R2) is exercised here).
    const next1 = makeNext()
    const d1 = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: './fileA.txt' }, callId: 'a5a-s1-read' }),
      next1.fn,
    )

    // S2 — static deny: write denied.txt matches the exact deny rule.
    const next2 = makeNext()
    const d2 = await env.ctx.trigger(
      makeExec({ name: 'write', arguments: { file_path: 'denied.txt', content: 'x' }, callId: 'a5a-s2-write' }),
      next2.fn,
    )

    // S11 — unsupported pass-through: 'web_fetch' never enters the
    // resolver (call-count snapshot before/after).
    const callsBeforeS11 = env.resolver.calls.length
    const next3 = makeNext()
    const d3 = await env.ctx.trigger(
      makeExec({ name: 'web_fetch', arguments: { url: 'https://example.invalid' }, callId: 'a5a-s11-fetch' }),
      next3.fn,
    )
    const callsAfterS11 = env.resolver.calls.length

    // S13 — canonicalization failures (a second world with a failing
    // resolver — the failing path is only visible to that install).
    envF = await createEnv('a5a-w1-f', {
      policy: W1_POLICY,
      isLeader: false,
      failFor: (path) => path === 'missing.txt',
    })
    const next4 = makeNext()
    const d4 = await envF.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'missing.txt' }, callId: 'a5a-s13-resolver' }),
      next4.fn,
    )
    const callsBeforeS13b = envF.resolver.calls.length
    const next5 = makeNext()
    const d5 = await envF.ctx.trigger(
      makeExec({ name: 'write', arguments: { content: 'x' }, callId: 'a5a-s13-malformed' }),
      next5.fn,
    )
    const callsAfterS13b = envF.resolver.calls.length

    // S15 — the COMPOSITE disposer (a fresh fake ctx on the same world,
    // H1): install → registers the listener AND the end-cap guard (one
    // each) → trigger works → dispose → BOTH removed (listener FIRST,
    // guard LAST — the guard is the monotonic last line of defense) → a
    // second install on the SAME double works independently.
    const ctx2 = makeFakeAgentCtx()
    const firstDisposer = installParameterPermissionListener(ctx2, {
      policy: W1_POLICY,
      resolveTarget: env.resolver.resolver,
      controlService: env.service,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      targetInstanceId: WORKER_ID,
      isLeader: false,
    })
    const guardsAfterInstall = ctx2.guardCount()
    const nextFirst = makeNext()
    const firstDecision = await ctx2.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a5a-s15-first' }),
      nextFirst.fn,
    )
    const countBeforeDispose = ctx2.listenerCount()
    firstDisposer()
    const countAfterDispose = ctx2.listenerCount()
    const activeGuardsAfterDispose = ctx2.activeGuardCount()
    const disposeOrder = [...ctx2.disposeLog]
    let afterDisposeError: string | undefined
    try {
      const nextGone = makeNext()
      await ctx2.trigger(
        makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a5a-s15-gone' }),
        nextGone.fn,
      )
    } catch (error: unknown) {
      afterDisposeError = error instanceof Error ? error.message : String(error)
    }
    // The second install on the SAME double (independent of the first).
    installParameterPermissionListener(ctx2, {
      policy: W1_POLICY,
      resolveTarget: env.resolver.resolver,
      controlService: env.service,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      targetInstanceId: WORKER_ID,
      isLeader: false,
    })
    const countAfterSecondInstall = ctx2.listenerCount()
    const guardsAfterSecondInstall = ctx2.guardCount()
    const activeGuardsAfterSecondInstall = ctx2.activeGuardCount()
    const nextSecond = makeNext()
    const secondInstallDecision = await ctx2.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: 'a5a-s15-second' }),
      nextSecond.fn,
    )
    const secondInstallNextCalls = nextSecond.calls()

    const state = await env.service.listControlState(P6T4_ROOT)
    const stateF = envF !== undefined ? await envF.service.listControlState(P6T4_ROOT) : state

    return {
      d1,
      next1Calls: next1.calls(),
      d2,
      next2Calls: next2.calls(),
      d3,
      next3Calls: next3.calls(),
      resolverCallsDeltaS11: callsAfterS11 - callsBeforeS11,
      d4,
      next4Calls: next4.calls(),
      d5,
      next5Calls: next5.calls(),
      resolverCallsDeltaS13b: callsAfterS13b - callsBeforeS13b,
      stateW1: state,
      stateW1f: stateF,
      s15: {
        guardsAfterInstall,
        firstDecision,
        countBeforeDispose,
        countAfterDispose,
        activeGuardsAfterDispose,
        disposeOrder,
        afterDisposeError,
        countAfterSecondInstall,
        guardsAfterSecondInstall,
        activeGuardsAfterSecondInstall,
        secondInstallDecision,
        secondInstallNextCalls,
      },
    }
  } finally {
    if (envF !== undefined) await destroyP6T1World(envF.world)
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// S3/S4/S5/S6/S7(member)/S8/S14 — world W2: default ask, no rules.
// ===========================================================================

const W2_POLICY: TemplatePermissionPolicy = {
  default: 'ask',
  allow: [],
  ask: [],
  deny: [],
}

const S3 = await (async () => {
  const env = await createEnv('a5a-w2', { policy: W2_POLICY, isLeader: false })
  try {
    // S3 — full ask→allow (member): write fileC (no rule → default ask)
    // → durable leader-approval row → the listener PAUSES at
    // awaitControlDecision → leader resolves allow → the listener
    // returns allow → next once → the consumption row exists.
    const nextS3 = makeNext()
    let settled = false
    const s3Promise = env.ctx
      .trigger(
        makeExec({ name: 'write', arguments: { file_path: 'fileC.txt', content: 'payload-1' }, callId: 'a5a-s3-write' }),
        nextS3.fn,
      )
      .then((decision) => {
        settled = true
        return decision
      })
    const s3Request = await waitForRequest(env.service, 'a5a-s3-write')
    const s3PausedBeforeResolve = !settled
    const s3StateAtPause = await env.service.listControlState(P6T4_ROOT)
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: s3Request.requestId,
      decision: 'allow',
    })
    const s3Decision = await s3Promise
    const s3StateAfter = await env.service.listControlState(P6T4_ROOT)

    // S4 — ask→deny (member): write fileD (no rule → default ask) →
    // leader resolves deny → the listener returns deny, next never.
    const nextS4 = makeNext()
    const s4Promise = env.ctx.trigger(
      makeExec({ name: 'write', arguments: { file_path: 'fileD.txt', content: 'payload-d' }, callId: 'a5a-s4-write' }),
      nextS4.fn,
    )
    const s4Request = await waitForRequest(env.service, 'a5a-s4-write')
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: s4Request.requestId,
      decision: 'deny',
    })
    const s4Decision = await s4Promise

    // S5 — exactly-once / allow-once: write fileC payload-1 AGAIN with a
    // NEW callId (same file + content → same fingerprint, new
    // correlation) → a NEW request; the old decision is consumed (pinned
    // by a direct guard consult under the OLD scope → allow-consumed);
    // the new request resolved deny → zero second execution.
    const nextS5 = makeNext()
    const s5Promise = env.ctx.trigger(
      makeExec({ name: 'write', arguments: { file_path: 'fileC.txt', content: 'payload-1' }, callId: 'a5a-s5-write' }),
      nextS5.fn,
    )
    const s5Request = await waitForRequest(env.service, 'a5a-s5-write')
    const s5GuardOldScope = await env.service.guardOperation({
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: ACTION_NAME,
      toolName: 'write',
      correlation: 'a5a-s3-write',
      operationFingerprint: s3Request.operationFingerprint,
    })
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: s5Request.requestId,
      decision: 'deny',
    })
    const s5Decision = await s5Promise

    // S6 — fingerprint mismatch: write fileC payload-2 (NEW callId) → a
    // NEW request with a DIFFERENT fingerprint; the old allow cannot
    // authorize the new op (the guard under the new scope sees the NEW
    // request PENDING while it is unresolved); resolving the new request
    // allow → the new op executes (its own allow consumed).
    const nextS6 = makeNext()
    const s6Promise = env.ctx.trigger(
      makeExec({ name: 'write', arguments: { file_path: 'fileC.txt', content: 'payload-2' }, callId: 'a5a-s6-write' }),
      nextS6.fn,
    )
    const s6Request = await waitForRequest(env.service, 'a5a-s6-write')
    const s6GuardNewScope = await env.service.guardOperation({
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: ACTION_NAME,
      toolName: 'write',
      correlation: 'a5a-s6-write',
      operationFingerprint: s6Request.operationFingerprint,
    })
    const s6StateBeforeResolve = await env.service.listControlState(P6T4_ROOT)
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: s6Request.requestId,
      decision: 'allow',
    })
    const s6Decision = await s6Promise
    const s6StateAfter = await env.service.listControlState(P6T4_ROOT)

    // S8 — member self-approval forbidden: write fileE (default ask) →
    // the MEMBER (its own instance) tries to resolve its own
    // leader-approval request → CONTROL_RESOLVER_NOT_AUTHORIZED; the
    // request stays pending; the still-waiting listener keeps waiting;
    // the leader then resolves allow → the listener unblocks.
    const nextS8 = makeNext()
    let s8Settled = false
    const s8Promise = env.ctx
      .trigger(
        makeExec({ name: 'write', arguments: { file_path: 'fileE.txt', content: 'payload-e' }, callId: 'a5a-s8-write' }),
        nextS8.fn,
      )
      .then((decision) => {
        s8Settled = true
        return decision
      })
    const s8Request = await waitForRequest(env.service, 'a5a-s8-write')
    let s8SelfResolveError: unknown
    try {
      await env.service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER_ID),
        requestId: s8Request.requestId,
        decision: 'allow',
      })
    } catch (error: unknown) {
      s8SelfResolveError = error
    }
    const s8StateAfterSelf = await env.service.listControlState(P6T4_ROOT)
    const s8StillWaiting = !s8Settled
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: s8Request.requestId,
      decision: 'allow',
    })
    const s8Decision = await s8Promise

    // S14 — pre-aborted signal: the signal is ALREADY aborted before the
    // wait starts → deny WITHOUT creating a request row (R3).
    const preAborted = new AbortController()
    preAborted.abort()
    const nextS14 = makeNext()
    const s14Decision = await env.ctx.trigger(
      makeExec({
        name: 'read',
        arguments: { file_path: 'fileA.txt' },
        callId: 'a5a-s14-read',
        signal: preAborted.signal,
      }),
      nextS14.fn,
    )
    const s14State = await env.service.listControlState(P6T4_ROOT)

    // The S7-member half: the S3 durable row's kind (asserted below).

    return {
      s3: {
        request: s3Request,
        pausedBeforeResolve: s3PausedBeforeResolve,
        stateAtPause: s3StateAtPause,
        decision: s3Decision,
        nextCalls: nextS3.calls(),
        stateAfter: s3StateAfter,
      },
      s4: { request: s4Request, decision: s4Decision, nextCalls: nextS4.calls() },
      s5: {
        request: s5Request,
        guardOldScope: s5GuardOldScope,
        decision: s5Decision,
        nextCalls: nextS5.calls(),
      },
      s6: {
        request: s6Request,
        guardNewScope: s6GuardNewScope,
        stateBeforeResolve: s6StateBeforeResolve,
        decision: s6Decision,
        nextCalls: nextS6.calls(),
        stateAfter: s6StateAfter,
      },
      s8: {
        request: s8Request,
        selfResolveError: s8SelfResolveError,
        stateAfterSelf: s8StateAfterSelf,
        stillWaiting: s8StillWaiting,
        decision: s8Decision,
        nextCalls: nextS8.calls(),
      },
      s14: { decision: s14Decision, nextCalls: nextS14.calls(), state: s14State },
      observations: env.observations,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// S7(leader)/S9 — world W3: leader install, default ask.
// ===========================================================================

const S7L = await (async () => {
  const env = await createEnv('a5a-w3', { policy: W2_POLICY, isLeader: true })
  try {
    // S7(leader) — the leader's ask routes to 'user-approval' (the
    // durable request kind).
    const nextS7 = makeNext()
    const s7Promise = env.ctx.trigger(
      makeExec({ name: 'write', arguments: { file_path: 'fileL.txt', content: 'payload-l' }, callId: 'a5a-s7-write' }),
      nextS7.fn,
    )
    const s7Request = await waitForRequest(env.service, 'a5a-s7-write')

    // S9 — leader self-approval on user-approval forbidden: the LEADER
    // instance tries to resolve its own user-approval request →
    // CONTROL_RESOLVER_NOT_AUTHORIZED (human-only closure); the human
    // then resolves allow → the listener unblocks.
    let s9SelfResolveError: unknown
    try {
      await env.service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: s7Request.requestId,
        decision: 'allow',
      })
    } catch (error: unknown) {
      s9SelfResolveError = error
    }
    const s9StateAfterSelf = await env.service.listControlState(P6T4_ROOT)
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: s7Request.requestId,
      decision: 'allow',
    })
    const s7Decision = await s7Promise

    return {
      request: s7Request,
      selfResolveError: s9SelfResolveError,
      stateAfterSelf: s9StateAfterSelf,
      decision: s7Decision,
      nextCalls: nextS7.calls(),
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// S10 — world W4: cancellation (abort mid-wait).
// ===========================================================================

const S10 = await (async () => {
  const env = await createEnv('a5a-w4', { policy: W2_POLICY, isLeader: false })
  try {
    const controller = new AbortController()
    const nextS10 = makeNext()
    // The listener promise must settle (deny) on abort; an unhandled
    // rejection would surface at process exit (the test process must
    // complete cleanly — the runner would report it).
    const s10Promise = env.ctx.trigger(
      makeExec({
        name: 'write',
        arguments: { file_path: 'fileX.txt', content: 'payload-x' },
        callId: 'a5a-s10-write',
        signal: controller.signal,
      }),
      nextS10.fn,
    )
    const s10Request = await waitForRequest(env.service, 'a5a-s10-write')
    controller.abort()
    const s10Decision = await s10Promise
    const s10State = await env.service.listControlState(P6T4_ROOT)
    return {
      request: s10Request,
      decision: s10Decision,
      nextCalls: nextS10.calls(),
      state: s10State,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// S12 — world W5: bash tool-level (ask [bash any], default deny).
// ===========================================================================

const S12A = await (async () => {
  const policyAsk: TemplatePermissionPolicy = {
    default: 'deny',
    allow: [],
    ask: [{ tool: 'bash', resource: { kind: 'any' } }],
    deny: [],
  }
  const env = await createEnv('a5a-w5', { policy: policyAsk, isLeader: false })
  let envB: Env | undefined
  try {
    // bash with the any-ask rule → ask → leader allow → executes.
    const nextA = makeNext()
    const aPromise = env.ctx.trigger(
      makeExec({ name: 'bash', arguments: { command: 'echo hello' }, callId: 'a5a-s12-bash-a' }),
      nextA.fn,
    )
    const aRequest = await waitForRequest(env.service, 'a5a-s12-bash-a')
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: aRequest.requestId,
      decision: 'allow',
    })
    const aDecision = await aPromise

    // The bash fingerprint is CONSTANT: a different command string (new
    // callId) canonicalizes to the SAME fingerprint (pinned against A2
    // directly) and the new request carries it.
    const bashFingerprintA2 = (
      await canonicalizeOperation({
        name: 'bash',
        arguments: { command: 'ls -la' },
        resolveTarget: env.resolver.resolver,
      })
    ).fingerprint
    const nextB = makeNext()
    const bPromise = env.ctx.trigger(
      makeExec({ name: 'bash', arguments: { command: 'ls -la' }, callId: 'a5a-s12-bash-b' }),
      nextB.fn,
    )
    const bRequest = await waitForRequest(env.service, 'a5a-s12-bash-b')
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: bRequest.requestId,
      decision: 'deny',
    })
    const bDecision = await bPromise

    // bash with NO rule + default deny → static deny, zero execution,
    // no request (a second install on the same world).
    const policyNoRule: TemplatePermissionPolicy = {
      default: 'deny',
      allow: [],
      ask: [],
      deny: [],
    }
    envB = await createEnv('a5a-w5-b', { policy: policyNoRule, isLeader: false })
    const nextC = makeNext()
    const cDecision = await envB.ctx.trigger(
      makeExec({ name: 'bash', arguments: { command: 'echo x' }, callId: 'a5a-s12-bash-c' }),
      nextC.fn,
    )
    const cState = await envB.service.listControlState(P6T4_ROOT)

    return {
      requestA: aRequest,
      decisionA: aDecision,
      nextACalls: nextA.calls(),
      requestB: bRequest,
      decisionB: bDecision,
      nextBCalls: nextB.calls(),
      bashFingerprintA2,
      decisionC: cDecision,
      nextCCalls: nextC.calls(),
      stateC: cState,
    }
  } finally {
    if (envB !== undefined) await destroyP6T1World(envB.world)
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// Assertions (pure synchronous — the shim's `it` bodies).
// ===========================================================================

const reqCorrelation = (state: { readonly requests: readonly ControlRequestRecord[] }, correlation: string): boolean =>
  state.requests.some((r) => r.correlation === correlation)

const isControlCode = (error: unknown, code: string): boolean =>
  isControlError(error) && error.code === code

/** The block reason of a guarded verdict (present only when blocked). */
const blockReason = (verdict: ControlGuardVerdict): string | undefined =>
  verdict.allowed === false ? verdict.reason : undefined

describe('A5a S1: static allow executes (exact rule) — zero control rows', () => {
  it('the listener returns allow (delegating through next) and next is called exactly once', () => {
    expect(S1R.d1).toEqual({ kind: 'allow' })
    expect(S1R.next1Calls).toBe(1)
  })
  it('ZERO control rows exist (no request was ever created for a static allow)', () => {
    expect(S1R.stateW1.requests.length).toBe(0)
    expect(S1R.stateW1.decisions.length).toBe(0)
    expect(S1R.stateW1.consumptions.length).toBe(0)
  })
})

describe('A5a S2: static deny — zero execution, no control rows', () => {
  it('the listener returns deny with the provenance lane in the reason', () => {
    expect(S1R.d2['kind']).toBe('deny')
    const reason = (S1R.d2 as { kind: 'deny'; reason: string }).reason
    expect(reason.includes('deny rule 0')).toBe(true)
    expect(reason.includes('write')).toBe(true)
  })
  it('next is NEVER called (zero-effect invariant) and no control row exists', () => {
    expect(S1R.next2Calls).toBe(0)
    expect(reqCorrelation(S1R.stateW1, 'a5a-s2-write')).toBe(false)
  })
})

describe('A5a S11: unsupported tool pass-through — the resolver is never called', () => {
  it('the listener delegates through next (allow) and next is called exactly once', () => {
    expect(S1R.d3).toEqual({ kind: 'allow' })
    expect(S1R.next3Calls).toBe(1)
  })
  it('the fake resolver was NOT called for the pass-through and no control row exists', () => {
    expect(S1R.resolverCallsDeltaS11).toBe(0)
    expect(reqCorrelation(S1R.stateW1, 'a5a-s11-fetch')).toBe(false)
  })
})

describe('A5a S13: canonicalization failure — deny, next never, no request', () => {
  it('a resolver that throws for a path → deny with the closed reason "resolver-threw"', () => {
    expect(S1R.d4['kind']).toBe('deny')
    const reason = (S1R.d4 as { kind: 'deny'; reason: string }).reason
    expect(reason.includes('resolver-threw')).toBe(true)
    expect(S1R.next4Calls).toBe(0)
    expect(reqCorrelation(S1R.stateW1f, 'a5a-s13-resolver')).toBe(false)
  })
  it('malformed arguments (write without file_path) → deny with "file-path-missing"; the resolver is NOT called (validation precedes I/O)', () => {
    expect(S1R.d5['kind']).toBe('deny')
    const reason = (S1R.d5 as { kind: 'deny'; reason: string }).reason
    expect(reason.includes('file-path-missing')).toBe(true)
    expect(S1R.resolverCallsDeltaS13b).toBe(0)
    expect(S1R.next5Calls).toBe(0)
    expect(reqCorrelation(S1R.stateW1f, 'a5a-s13-malformed')).toBe(false)
  })
})

describe('A5a S15: the composite disposer removes listener AND end-cap guard; re-install works', () => {
  it('the install registers exactly one listener AND exactly one end-cap guard', () => {
    expect(S1R.s15.countBeforeDispose).toBe(1)
    expect(S1R.s15.guardsAfterInstall).toBe(1)
  })
  it('the first install serves a call (static allow → next once)', () => {
    expect(S1R.s15.firstDecision).toEqual({ kind: 'allow' })
  })
  it('disposing removes BOTH (listener 0, guard 0 active) — listener FIRST, guard LAST', () => {
    expect(S1R.s15.countAfterDispose).toBe(0)
    expect(S1R.s15.activeGuardsAfterDispose).toBe(0)
    expect(S1R.s15.disposeOrder).toEqual(['listener', 'guard'])
  })
  it('after dispose, a trigger finds no listener', () => {
    expect(S1R.s15.afterDisposeError !== undefined).toBe(true)
    expect((S1R.s15.afterDisposeError ?? '').includes('no listener registered')).toBe(true)
  })
  it('a second install on the SAME double works independently (one fresh listener + guard, next once)', () => {
    expect(S1R.s15.countAfterSecondInstall).toBe(1)
    expect(S1R.s15.guardsAfterSecondInstall).toBe(2)
    expect(S1R.s15.activeGuardsAfterSecondInstall).toBe(1)
    expect(S1R.s15.secondInstallDecision).toEqual({ kind: 'allow' })
    expect(S1R.s15.secondInstallNextCalls).toBe(1)
  })
})

describe('A5a S3: full ask→allow (member) — the listener pauses at the wait bridge', () => {
  it('a durable leader-approval request row was created (kind/toolName/correlation/fingerprint/summary)', () => {
    const r = S3.s3.request
    expect(r.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(r.toolName).toBe('write')
    expect(r.actionName).toBe(ACTION_NAME)
    expect(r.correlation).toBe('a5a-s3-write')
    expect(r.operationFingerprint !== undefined).toBe(true)
    expect(r.operationFingerprint?.startsWith('sha256:')).toBe(true)
    expect(r.summary).toBe('write fileC.txt')
    expect(r.targetInstanceId).toBe(WORKER_ID)
  })
  it('the listener was still PAUSED (unsettled) when the request row was visible and before the resolve', () => {
    expect(S3.s3.pausedBeforeResolve).toBe(true)
    const pending = S3.s3.stateAtPause.requests.filter((r) => r.correlation === 'a5a-s3-write')
    expect(pending.length).toBe(1)
    expect(pending[0]?.status).toBe('pending')
  })
  it('after the leader allow: the listener returns allow, next is called exactly once, and the consumption row exists (exactly-once)', () => {
    expect(S3.s3.decision).toEqual({ kind: 'allow' })
    expect(S3.s3.nextCalls).toBe(1)
    const consumptions = S3.s3.stateAfter.consumptions
    expect(consumptions.length).toBe(1)
    expect(consumptions[0]?.requestId).toBe(S3.s3.request.requestId)
    expect(S3.s3.stateAfter.decisions.filter((d) => d.requestId === S3.s3.request.requestId).length).toBe(1)
  })
  it('the diagnostics rows were emitted (canonicalized → decision → request-created → decision-arrived → guard-verdict)', () => {
    const rows = S3.observations.filter((o) => o['callId'] === 'a5a-s3-write')
    const stagesSeen = rows.map((o) => String(o['stage']))
    expect(stagesSeen.includes('canonicalized')).toBe(true)
    expect(stagesSeen.includes('decision')).toBe(true)
    expect(stagesSeen.includes('request-created')).toBe(true)
    expect(stagesSeen.includes('decision-arrived')).toBe(true)
    expect(stagesSeen.includes('guard-verdict')).toBe(true)
  })
})

describe('A5a S4: ask→deny (member) — the durable deny settles the wait', () => {
  it('the listener returns deny ("the approval was denied") and next is never called', () => {
    expect(S3.s4.decision['kind']).toBe('deny')
    const reason = (S3.s4.decision as { kind: 'deny'; reason: string }).reason
    expect(reason).toBe('the approval was denied')
    expect(S3.s4.nextCalls).toBe(0)
  })
  it('the request kind is leader-approval (member routing) and the durable decision is deny', () => {
    expect(S3.s4.request.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
  })
})

describe('A5a S5: exactly-once / allow-once — a new callId starts a new request', () => {
  it('the second identical call (same file+content, NEW callId) created a NEW request (distinct requestId)', () => {
    expect(S3.s5.request.requestId).not.toBe(S3.s3.request.requestId)
    expect(S3.s5.request.operationFingerprint).toBe(S3.s3.request.operationFingerprint)
    expect(S3.s5.request.status).toBe('pending')
  })
  it('the OLD allow is consumed: a direct guard under the old scope is blocked allow-consumed', () => {
    expect(S3.s5.guardOldScope.allowed).toBe(false)
    expect(blockReason(S3.s5.guardOldScope)).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
  })
  it('the new request resolved deny → zero second execution', () => {
    expect(S3.s5.decision['kind']).toBe('deny')
    expect(S3.s5.nextCalls).toBe(0)
  })
})

describe('A5a S6: fingerprint mismatch — the old approval cannot authorize the new op', () => {
  it('the new payload created a NEW request with a DIFFERENT fingerprint (the old decision is bound to the old fingerprint)', () => {
    expect(S3.s6.request.requestId).not.toBe(S3.s3.request.requestId)
    expect(S3.s6.request.operationFingerprint).not.toBe(S3.s3.request.operationFingerprint)
    const s6oldDecision = S3.s6.stateBeforeResolve.decisions.find((d) => d.requestId === S3.s3.request.requestId)
    expect(s6oldDecision?.scope.operationFingerprint).toBe(S3.s3.request.operationFingerprint)
  })
  it('the guard under the NEW scope (new correlation + new fingerprint) sees the NEW request pending — the old allow does not authorize it', () => {
    expect(S3.s6.guardNewScope.allowed).toBe(false)
    expect(blockReason(S3.s6.guardNewScope)).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING)
  })
  it('the new approval authorizes exactly the new op: allow → next once, a second consumption row exists', () => {
    expect(S3.s6.decision).toEqual({ kind: 'allow' })
    expect(S3.s6.nextCalls).toBe(1)
    expect(S3.s6.stateAfter.consumptions.length).toBe(2)
    expect(S3.s6.stateAfter.consumptions.some((c) => c.requestId === S3.s6.request.requestId)).toBe(true)
  })
})

describe('A5a S7: routing — member ask → leader-approval; leader ask → user-approval', () => {
  it('the MEMBER ask row is kind leader-approval (S3/S4 rows)', () => {
    expect(S3.s3.request.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(S3.s4.request.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
  })
  it('the LEADER ask row is kind user-approval', () => {
    expect(S7L.request.kind).toBe(CONTROL_REQUEST_KINDS.USER_APPROVAL)
    expect(S7L.request.targetInstanceId).toBe(LEADER_ID)
  })
})

describe('A5a S8: member self-approval forbidden (the role closure beats the envelope)', () => {
  it('the member resolving its own leader-approval request → CONTROL_RESOLVER_NOT_AUTHORIZED (role member; allowed leader+human)', () => {
    expect(isControlCode(S3.s8.selfResolveError, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)).toBe(true)
    const error = S3.s8.selfResolveError as { details?: Record<string, unknown> }
    expect(error.details?.['role']).toBe('member')
    expect(error.details?.['allowedRoles']).toEqual(['leader', 'human'])
  })
  it('the pending request STAYS pending (no decision row) and the still-waiting listener keeps waiting', () => {
    const row = S3.s8.stateAfterSelf.requests.find((r) => r.requestId === S3.s8.request.requestId)
    expect(row?.status).toBe('pending')
    expect(S3.s8.stateAfterSelf.decisions.some((d) => d.requestId === S3.s8.request.requestId)).toBe(false)
    expect(S3.s8.stillWaiting).toBe(true)
  })
  it('the leader allow then unblocks the listener (allow, next once)', () => {
    expect(S3.s8.decision).toEqual({ kind: 'allow' })
    expect(S3.s8.nextCalls).toBe(1)
  })
})

describe('A5a S9: leader self-approval on user-approval forbidden (human-only)', () => {
  it('the leader resolving its own user-approval request → CONTROL_RESOLVER_NOT_AUTHORIZED (role leader; allowed human only)', () => {
    expect(isControlCode(S7L.selfResolveError, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)).toBe(true)
    const error = S7L.selfResolveError as { details?: Record<string, unknown> }
    expect(error.details?.['role']).toBe('leader')
    expect(error.details?.['allowedRoles']).toEqual(['human'])
  })
  it('the request stays pending after the rejected self-resolve; the human allow then unblocks the listener', () => {
    const row = S7L.stateAfterSelf.requests.find((r) => r.requestId === S7L.request.requestId)
    expect(row?.status).toBe('pending')
    expect(S7L.decision).toEqual({ kind: 'allow' })
    expect(S7L.nextCalls).toBe(1)
  })
})

describe('A5a S10: cancellation — abort mid-wait settles deny, the request stays pending', () => {
  it('the listener settled DENY ("the approval wait was cancelled") and next was never called', () => {
    expect(S10.decision['kind']).toBe('deny')
    const reason = (S10.decision as { kind: 'deny'; reason: string }).reason
    expect(reason).toBe('the approval wait was cancelled')
    expect(S10.nextCalls).toBe(0)
  })
  it('the durable request STAYS pending (cancellation never decides — alpha.2) with no decision row', () => {
    const row = S10.state.requests.find((r) => r.requestId === S10.request.requestId)
    expect(row?.status).toBe('pending')
    expect(S10.state.decisions.some((d) => d.requestId === S10.request.requestId)).toBe(false)
  })
})

describe('A5a S12: bash tool-level — any-rule ask → allow executes; no rule + default deny → static deny', () => {
  it('bash with the any-ask rule creates a leader-approval request carrying the CONSTANT bash fingerprint', () => {
    expect(S12A.requestA.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(S12A.requestA.toolName).toBe('bash')
    expect(S12A.requestA.operationFingerprint).toBe(S12A.bashFingerprintA2)
  })
  it('bash allow → executes (next once); a different command string (new callId) carries the SAME constant fingerprint', () => {
    expect(S12A.decisionA).toEqual({ kind: 'allow' })
    expect(S12A.nextACalls).toBe(1)
    expect(S12A.requestB.requestId).not.toBe(S12A.requestA.requestId)
    expect(S12A.requestB.operationFingerprint).toBe(S12A.bashFingerprintA2)
  })
  it('the second bash request resolved deny → zero execution for it', () => {
    expect(S12A.decisionB['kind']).toBe('deny')
    expect(S12A.nextBCalls).toBe(0)
  })
  it('bash with NO rule + default deny → static deny, zero execution, no request row', () => {
    expect(S12A.decisionC['kind']).toBe('deny')
    const reason = (S12A.decisionC as { kind: 'deny'; reason: string }).reason
    expect(reason.includes('default')).toBe(true)
    expect(S12A.nextCCalls).toBe(0)
    expect(reqCorrelation(S12A.stateC, 'a5a-s12-bash-c')).toBe(false)
  })
})

describe('A5a S14: pre-aborted signal — deny WITHOUT creating a request row (R3)', () => {
  it('the already-aborted call is denied with the abort wording and next is never called', () => {
    expect(S3.s14.decision['kind']).toBe('deny')
    const reason = (S3.s14.decision as { kind: 'deny'; reason: string }).reason
    expect(reason).toBe('the approval wait was cancelled (the call was already aborted)')
    expect(S3.s14.nextCalls).toBe(0)
  })
  it('NO request row was created for the pre-aborted call (the no-row preference)', () => {
    expect(reqCorrelation(S3.s14.state, 'a5a-s14-read')).toBe(false)
  })
})
