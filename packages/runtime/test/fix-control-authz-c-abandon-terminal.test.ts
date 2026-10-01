/**
 * fix-control-authz C (P2) — the REAL-chain regression for the durable
 * abandonment terminal precedence + the waiter / cold-retry liveness.
 *
 * The defect: the wait bridge (`awaitControlDecision`) consulted ONLY the
 * decision rows — a request that was DURABLY ABANDONED while a waiter was
 * parked (or before a cold waiter attached to the abandoned row) never
 * settled (a parked waiter polls forever for a decision that can never
 * land); and the inline-abort cascade consulted the decision BEFORE the
 * abandon mark, so an allow recorded before the abandon could still
 * settle the waiter (the terminal mark losing to a stale decision). The
 * guarded lane's final guard respects abandonment — the INLINE lane had
 * NO equivalent final terminal check before its side effects.
 *
 * What this proves (over the REAL ControlService + REAL router where
 * marked; the confirmed scope — no arbitrary-UI unauthorized-execution
 * claim):
 *   C1: pending → (parked waiter) → explicit abandon: the waiter SETTLES
 *       with the terminal outcome; the router throws the typed zero-effect
 *       block (`controlDecision: 'abandoned'`); ZERO work; one durable
 *       abandon mark;
 *   C2: allow → abandon → a FRESH await (the cold waiter on the
 *       abandoned row): settles rejected terminal (NOT the stale allow) —
 *       bounded, no hang;
 *   C3: allow → abandon → mid-wait ABORT (the abort race over the stale
 *       decision — a slow-poll waiter whose only settle path after the
 *       marks land is the cascade): the abandon mark WINS the cascade —
 *       the wait rejects terminal, never resolves with the stale allow;
 *   C4: the wait→admission race (an allow and an abandon BOTH land while
 *       the router waits — every interleaving): the router settles with
 *       the typed zero-effect block; ZERO work — the abandoned allow
 *       never executes;
 *   C5 (the external-review TOCTOU): a durable abandon landing DURING
 *       the recursive admission's gate re-probe (AFTER the dispatch's
 *       pre-dispatch terminal snapshot — the window an earlier snapshot
 *       cannot close): the terminal mark is re-validated AT THE EFFECT-
 *       ADMISSION BOUNDARY (the authorization check + the first effect
 *       commit linearized against the durable abandon — the same lock
 *       the abandon write goes through): ZERO work admission, ZERO
 *       delivery, the typed zero-effect block, the durable close stands;
 *   C6 (the external-review residual C-1): the COORDINATION reentry
 *       (send-message — the recoveryWork impact bypasses the gated
 *       branch) hits the SAME boundary: the reentry queued behind the
 *       shared runtime lock, a real abandon persisting on the control
 *       lock, release → the coordination fact is NEVER committed
 *       unchecked: zero `team-coordination-recorded`, zero delivery,
 *       the typed block, the durable close stands (over the REAL
 *       MessagingCoordinator);
 *   C7 (the external-review residual C-2, leg a): an AbortSignal
 *       aborting DURING the gate re-probe await (no explicit abandon):
 *       the serialized boundary sees the live signal, PERSISTS the
 *       abandon (the durable close — the same footprint as an explicit
 *       abandon) and rejects typed; ZERO work;
 *   C8 (the external-review residual C-2, leg b): the signal aborting
 *       while the unit is BLOCKED WAITING for the control lock (between
 *       queue and acquisition): the commit is STILL rejected with a
 *       durable close; ZERO work.
 *
 * @module @dsh-agent-team/runtime/test/fix-control-authz-c-abandon-terminal
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  CONTROL_ERROR_CODES,
  CONTROL_EXECUTION_COUPLINGS,
  CONTROL_REQUEST_KINDS,
  createControlService,
  isControlError,
} from '../control/index.js'
import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import {
  P6T2_NOW,
  TEST_STATIC_MODEL,
  createFakeLifecycleCommitPort,
} from './p6t2-helpers.js'
import { createTeamRuntime, withTeamLock } from '../action-router/index.js'
import { createWorkActivityWriter } from '../activity/index.js'
import { createMessagingCoordinator } from '../messaging/index.js'
import type { SessionInputPort } from '../messaging/index.js'
import {
  AUTHZ_ROOT,
  AUTHZ_WORKER,
  authzFacts,
  authzFollowUp,
  authzHumanCaller,
  createAuthzWorld,
  destroyAuthzWorld,
  makeActionRequest,
  sleep,
  waitForControlRequests,
  withTimeout,
  type AuthzWorld,
} from './fix-control-authz-helpers.js'

let world: AuthzWorld | undefined

afterEach(async () => {
  if (world !== undefined) {
    await destroyAuthzWorld(world)
  }
  world = undefined
})

function asDetails(error: unknown): Record<string, unknown> | undefined {
  const err = error as { details?: Record<string, unknown> }
  return err?.details
}

/** One durable inline request over the REAL control service (the service-
 *  level C2/C3 scenarios do not need the router). */
async function createInlineRequest(correlation: string): Promise<{ readonly requestId: string }> {
  if (world === undefined) throw new Error('createInlineRequest: no world')
  const request = await world.control.requestControl({
    rootSessionId: AUTHZ_ROOT,
    caller: makeActionRequest({}).caller,
    kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
    subject: { kind: 'instance', instanceId: AUTHZ_WORKER },
    actionName: 'follow-up',
    correlation,
    executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
  })
  return { requestId: request.requestId }
}

describe('fix-control-authz C — the durable abandonment is the TERMINAL mark', () => {
  it('C1: pending → parked waiter → explicit abandon: the waiter settles terminal, the router keeps the typed block, ZERO work', async () => {
    world = await createAuthzWorld('authz-c-1')
    const promise = withTimeout(
      world.runtime.performAction(
        authzFollowUp({
          requestToken: 'tok-c-1',
          payload: { prompt: 'C-repro prompt (parked-waiter scenario)' },
        }),
      ),
      30_000,
      'the recovery follow-up wait (must settle on the abandon — no hang)',
    ).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    const { requests } = await withTimeout(waitForControlRequests(world.control, 1), 15_000, 'the durable request row')
    const row = requests.find((r) => String(r.correlation).startsWith('recovery:tok-c-1:'))
    expect(row).toBeDefined()
    // The waiter PARKS (several poll cycles — the parked-poll scenario).
    await sleep(50)
    // The HUMAN abandons the review (the legal close — human → any).
    await world.control.abandonControlRequest({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row?.requestId),
      reason: 'reviewer withdrew the offer',
    })
    // The waiter SETTLES with the terminal outcome (the old code polled
    // forever — the bounded timeout is the RED guard).
    const outcome = await promise
    expect(outcome.ok).toBe(false)
    const error = outcome.ok === false ? outcome.error : undefined
    // The router's typed zero-effect block (the operation stays blocked).
    expect((error as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(asDetails(error)?.['controlDecision']).toBe('abandoned')
    expect(asDetails(error)?.['controlRequestId']).toBe(row?.requestId)
    // ZERO side effects: no work admission, no delivery, one abandon mark.
    expect(authzFacts(world.world, 'team-work-admitted').length).toBe(0)
    expect(world.deliveryCalls.length).toBe(0)
    const state = await world.control.listControlState(AUTHZ_ROOT)
    expect(state.abandonments.filter((a) => a.requestId === row?.requestId).length).toBe(1)
    // The derived request state is the terminal `abandoned`.
    const record = state.requests.find((r) => r.requestId === row?.requestId)
    expect(record?.status).toBe('abandoned')
  })

  it('C2: allow → abandon → a fresh await on the abandoned row settles REJECTED terminal (bounded — the cold-retry liveness)', async () => {
    world = await createAuthzWorld('authz-c-2')
    const { requestId } = await createInlineRequest('corr-c2-allow-abandon')
    // The human approves (a durable allow), then the SAME human abandons
    // (the legal allow-invalidation path — the abandon closes the allow).
    await world.control.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId,
      decision: 'allow',
    })
    await world.control.abandonControlRequest({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId,
      reason: 'allow invalidated',
    })
    // A FRESH waiter (no signal — the cold retry hitting the abandoned
    // row): the old code polled forever (no decision can ever land); the
    // terminal mark must settle the wait NOW.
    const rejected = await withTimeout(
      world.control.awaitControlDecision({ rootSessionId: AUTHZ_ROOT, requestId }).then(
        (decision) => ({ resolved: true as const, decision }),
        (error: unknown) => ({ resolved: false as const, error }),
      ),
      10_000,
      'the fresh await on the abandoned row (must settle, not hang)',
    )
    expect(rejected.resolved).toBe(false)
    const error = rejected.resolved === false ? rejected.error : undefined
    expect(isControlError(error)).toBe(true)
    expect((error as { code: string }).code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
  })

  it('C3: the abort race over the stale decision (mid-wait abort with BOTH marks durable): the abandon mark wins the cascade (the stale allow never settles the waiter)', async () => {
    world = await createAuthzWorld('authz-c-3')
    const { requestId } = await createInlineRequest('corr-c3-abort-race')
    // A SECOND real control service over the SAME durable store with a
    // SLOW poll (the first poll is synchronous — before any mark is
    // durable — and the next is effectively never): the wait's only
    // settle path after the marks land is the abort cascade. This makes
    // the decision-vs-abandon ordering inside the cascade deterministic.
    const slowControl = createControlService({
      teamDomain: world.world.domain,
      blueprintCatalog: world.world.catalog,
      externalPolicyFacts: world.world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
      waitPollIntervalMs: 60_000,
    })
    // The wait begins (synchronous first poll: no marks yet — it parks).
    const ac = new AbortController()
    const waitP = slowControl.awaitControlDecision({ rootSessionId: AUTHZ_ROOT, requestId, signal: ac.signal })
    await sleep(15)
    // The allow and the abandon BOTH land (the per-team lock serializes
    // them: the decision row, then the abandon mark).
    await world.control.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId,
      decision: 'allow',
    })
    await world.control.abandonControlRequest({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId,
      reason: 'allow invalidated',
    })
    // The ABORT races the stale decision: the cascade re-reads the fresh
    // durable state (both marks). The terminal abandon mark must win
    // (the old cascade consulted the decision first and RESOLVED with
    // the stale allow).
    ac.abort()
    const settled = await withTimeout(
      waitP.then(
        (decision) => ({ resolved: true as const, decision }),
        (error: unknown) => ({ resolved: false as const, error }),
      ),
      10_000,
      'the aborted-signal await (the cascade must settle terminal)',
    )
    expect(settled.resolved).toBe(false)
    const error = settled.resolved === false ? settled.error : undefined
    expect(isControlError(error)).toBe(true)
    expect((error as { code: string }).code).toBe(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED)
  })

  it('C4: the wait→admission race (allow + abandon both land while the router waits): the typed zero-effect block holds for EVERY interleaving; the abandoned allow never executes', async () => {
    world = await createAuthzWorld('authz-c-4')
    const promise = withTimeout(
      world.runtime.performAction(
        authzFollowUp({
          requestToken: 'tok-c-4',
          payload: { prompt: 'C-repro prompt (wait-admission race)' },
        }),
      ),
      30_000,
      'the recovery follow-up wait (the allow+abandon race)',
    ).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    const { requests } = await withTimeout(waitForControlRequests(world.control, 1), 15_000, 'the durable request row')
    const row = requests.find((r) => String(r.correlation).startsWith('recovery:tok-c-4:'))
    expect(row).toBeDefined()
    await sleep(20) // let the waiter park
    // The allow and the abandon BOTH land (the control's per-team lock
    // serializes them: the decision row, then the abandon mark — both
    // durable before the router's next poll/final check).
    await Promise.all([
      world.control.resolveControl({
        rootSessionId: AUTHZ_ROOT,
        caller: authzHumanCaller(),
        requestId: String(row?.requestId),
        decision: 'allow',
      }),
      world.control.abandonControlRequest({
        rootSessionId: AUTHZ_ROOT,
        caller: authzHumanCaller(),
        requestId: String(row?.requestId),
        reason: 'abandoned in the race window',
      }),
    ])
    const outcome = await promise
    // EVERY interleaving settles on the typed zero-effect block (a
    // decision-first poll is stopped by the final terminal check; an
    // abandon-first poll settles rejected terminal — both paths must
    // yield the SAME typed block, never a raw ControlError and never an
    // execution).
    expect(outcome.ok).toBe(false)
    const error = outcome.ok === false ? outcome.error : undefined
    expect((error as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(asDetails(error)?.['controlDecision']).toBe('abandoned')
    expect(asDetails(error)?.['controlRequestId']).toBe(row?.requestId)
    // ZERO side effects: the abandoned allow never executed.
    expect(authzFacts(world.world, 'team-work-admitted').length).toBe(0)
    expect(world.deliveryCalls.length).toBe(0)
  })

  it('C5: the effect-admission boundary (the external-review TOCTOU) — a durable abandon landing DURING the gate re-probe (AFTER the pre-dispatch snapshot) NEVER admits the reviewed work: zero admitted / zero effect, the typed abandoned block, the durable close stands', async () => {
    world = await createAuthzWorld('authz-c-5')
    // The pausable environmentFacts port: wraps the REAL port; the NEXT
    // call (the recursive admission's gate re-probe — the fresh facts
    // read inside the gate, LATER than the dispatch's pre-dispatch
    // terminal snapshot) holds at the barrier.
    const realEnvFacts = world.world.ports.environmentFacts
    let pauseNextProbe = false
    let probePausedResolve: (() => void) | undefined
    const probePaused = new Promise<void>((resolve) => {
      probePausedResolve = resolve
    })
    let releaseBarrier: (() => void) | undefined
    const barrierHeld = new Promise<void>((resolve) => {
      releaseBarrier = resolve
    })
    const pausableEnvFacts: typeof realEnvFacts = () => {
      if (pauseNextProbe) {
        pauseNextProbe = false
        probePausedResolve?.()
        return barrierHeld.then(() => realEnvFacts())
      }
      return realEnvFacts()
    }
    // The REAL chain rebuilt over the SAME world with the pausable port
    // (the D suite's rebuild pattern without a restart: same real
    // control service, same recording delivery port).
    const runtime5 = createTeamRuntime({
      teamDomain: world.world.domain,
      activationProvider: world.world.provider,
      blueprintCatalog: world.world.catalog,
      environmentFacts: pausableEnvFacts,
      externalPolicyFacts: world.world.ports.externalPolicyFacts,
      staticModel: TEST_STATIC_MODEL,
      now: () => P6T2_NOW,
      lifecycleCommit: createFakeLifecycleCommitPort(world.world),
      workDelivery: world.deliveryPort,
      workActivity: createWorkActivityWriter({ teamDomain: world.world.domain, now: () => P6T2_NOW }),
      controlServiceRef: { current: world.control },
    })
    // (1) A real control recovery follow-up, approved through the real
    //     chain.
    const promise = withTimeout(
      runtime5.performAction(
        authzFollowUp({
          requestToken: 'tok-c-5',
          payload: { prompt: 'C-repro prompt (the TOCTOU abandon-during-admission window)' },
        }),
      ),
      30_000,
      'the recovery follow-up (the TOCTOU repro)',
    ).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    const { requests } = await withTimeout(waitForControlRequests(world.control, 1), 15_000, 'the durable request row')
    const row = requests.find((r) => String(r.correlation).startsWith('recovery:tok-c-5:'))
    expect(row).toBeDefined()
    await world.control.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row?.requestId),
      decision: 'allow',
    })
    // (2) Arm the barrier for the NEXT environmentFacts call — the
    //     recursive admission's gate re-probe (LATER than the dispatch's
    //     pre-dispatch terminal snapshot, which already passed with no
    //     mark durable).
    pauseNextProbe = true
    await withTimeout(probePaused, 15_000, 'the re-probe barrier hold (the recursive admission is inside the gate)')
    // (3) While the barrier holds: the REAL abandon lands (its own
    //     control lock — the in-flight admission holds the team chain,
    //     not the control lock — the durable abandon commits NOW).
    await world.control.abandonControlRequest({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row?.requestId),
      reason: 'reviewer withdrew mid-admission (the TOCTOU window)',
    })
    const stateAbandoned = await world.control.listControlState(AUTHZ_ROOT)
    expect(stateAbandoned.abandonments.some((a) => a.requestId === row?.requestId)).toBe(true)
    // (4) Release the provider (the gate resolves with its facts).
    releaseBarrier?.()
    // (5) The outcome: the terminal mark must be re-validated AT THE
    //     EFFECT-ADMISSION BOUNDARY — the pre-dispatch snapshot is stale
    //     here (the abandon landed after it). RED (unfixed): the effect
    //     STILL commits (work admitted + delivered). Expected (fixed):
    //     NO team-work-admitted, NO delivery — zero admitted/effect, the
    //     typed abandoned zero-effect block, the durable close stands.
    const outcome = await promise
    expect(outcome.ok).toBe(false)
    const error = outcome.ok === false ? outcome.error : undefined
    expect((error as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(asDetails(error)?.['controlDecision']).toBe('abandoned')
    expect(asDetails(error)?.['controlRequestId']).toBe(row?.requestId)
    // ZERO admitted / ZERO effect.
    expect(authzFacts(world.world, 'team-work-admitted').length).toBe(0)
    expect(world.deliveryCalls.length).toBe(0)
    // The durable close stands: exactly one abandon mark; the stale
    // allow decision row is closed by the terminal mark (derived state
    // `abandoned`).
    const stateFinal = await world.control.listControlState(AUTHZ_ROOT)
    expect(stateFinal.abandonments.filter((a) => a.requestId === row?.requestId).length).toBe(1)
    expect(stateFinal.decisions.some((d) => d.requestId === row?.requestId && d.decision === 'allow')).toBe(true)
    expect(stateFinal.requests.find((r) => r.requestId === row?.requestId)?.status).toBe('abandoned')
  })

  it('C6: the COORDINATION reentry (send-message — the recoveryWork impact that bypasses the gated branch) hits the SAME effect-admission boundary — the reentry queued behind the shared runtime lock, a real abandon on the control lock, release ⇒ the coordination fact is NEVER committed unchecked (zero fact / zero delivery, the typed block, the durable close stands) over the REAL MessagingCoordinator', async () => {
    world = await createAuthzWorld('authz-c-6')
    // A TEST-OWNED shared runtime lock map (the production root wiring
    // precedent — the router's `teamLocks` option): the test holds the
    // runtime chain and QUEUES the reviewed reentry behind it.
    const sharedChains = new Map<string, Promise<unknown>>()
    const runtime6 = createTeamRuntime({
      teamDomain: world.world.domain,
      activationProvider: world.world.provider,
      blueprintCatalog: world.world.catalog,
      environmentFacts: world.world.ports.environmentFacts,
      externalPolicyFacts: world.world.ports.externalPolicyFacts,
      staticModel: TEST_STATIC_MODEL,
      now: () => P6T2_NOW,
      lifecycleCommit: createFakeLifecycleCommitPort(world.world),
      workDelivery: world.deliveryPort,
      workActivity: createWorkActivityWriter({ teamDomain: world.world.domain, now: () => P6T2_NOW }),
      teamLocks: sharedChains,
      controlServiceRef: { current: world.control },
    })
    const sessionInputCalls: unknown[] = []
    const sessionInput: SessionInputPort = {
      async submitAttributedInput(input: unknown): Promise<void> {
        sessionInputCalls.push(input)
      },
    }
    const coordinator = createMessagingCoordinator({
      teamRuntime: runtime6,
      teamDomain: world.world.domain,
      sessionInput,
      now: () => P6T2_NOW,
    })
    // (1) the real blocked Leader send-message (the recovery offer over
    //     the real chain).
    const promise = withTimeout(
      coordinator.sendTeamMessage({
        rootSessionId: AUTHZ_ROOT,
        caller: makeActionRequest({}).caller,
        recipientInstanceId: AUTHZ_WORKER,
        body: 'C6-repro message (the TOCTOU coordination lane)',
        subject: 'C6-repro',
        requestToken: 'tok-c-6',
      }),
      30_000,
      'the recovery send-message (the coordination TOCTOU repro)',
    ).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    const { requests } = await withTimeout(waitForControlRequests(world.control, 1), 15_000, 'the durable request row')
    const row = requests.find((r) => String(r.correlation).startsWith('recovery:tok-c-6:'))
    expect(row).toBeDefined()
    // (2) the test HOLDS the shared runtime lock BEFORE the allow —
    //     the reviewed reentry (initiated after the settle) can only
    //     QUEUE behind the hold (deterministic placement).
    let releaseBarrier: (() => void) | undefined
    const barrierHeld = new Promise<void>((resolve) => {
      releaseBarrier = resolve
    })
    let holdAcquiredResolve: (() => void) | undefined
    const holdAcquired = new Promise<void>((resolve) => {
      holdAcquiredResolve = resolve
    })
    const occupation = withTeamLock(sharedChains, AUTHZ_ROOT, () => {
      holdAcquiredResolve?.()
      return barrierHeld
    })
    await withTimeout(holdAcquired, 15_000, 'the runtime-chain hold (the reentry queues behind it)')
    // The occupation's chain entry (the map stores a fresh chained
    // promise per acquisition — a CHANGED entry proves the reentry has
    // queued on the runtime lock behind the hold).
    const occupationChain = sharedChains.get(AUTHZ_ROOT)
    // (3) approve — the reentry is in flight behind the hold: its
    //     pre-dispatch terminal snapshot runs (no mark yet) and it
    //     QUEUES on the runtime lock.
    await world.control.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row?.requestId),
      decision: 'allow',
    })
    // Wait for the reentry's runtime-lock queue (its `executeEffect`
    // acquisition replaces the map entry) — deterministic proof that
    // the snapshot ran with NO mark before the queue.
    const queued = new Promise<void>((resolve, reject) => {
      const poll = setInterval(() => {
        if (sharedChains.get(AUTHZ_ROOT) !== undefined && sharedChains.get(AUTHZ_ROOT) !== occupationChain) {
          clearInterval(poll)
          clearTimeout(fail)
          resolve()
        }
      }, 1)
      const fail = setTimeout(() => {
        clearInterval(poll)
        reject(new Error('timeout: the reentry never queued on the runtime lock (behind the hold)'))
      }, 15_000)
    })
    await queued
    // (4) while the hold is up (the reentry queued), the REAL abandon
    //     persists on its own control lock (the in-flight reentry holds
    //     no control lock).
    await world.control.abandonControlRequest({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row?.requestId),
      reason: 'reviewer withdrew mid-admission (the coordination lane)',
    })
    // (4) release the runtime lock — the reentry proceeds.
    releaseBarrier?.()
    await withTimeout(occupation, 15_000, 'the runtime-chain hold release')
    // (5) the outcome: the terminal mark must be re-validated AT THE
    //     EFFECT-ADMISSION BOUNDARY for the coordination effect too.
    //     RED (unfixed): the fallback path commits the coordination
    //     fact UNCHECKED (outcome ok, one fact, one delivery). Expected
    //     (fixed): zero coordination fact, zero delivery, the typed
    //     abandoned block, the durable close stands.
    const outcome = await promise
    expect(outcome.ok).toBe(false)
    const error = outcome.ok === false ? outcome.error : undefined
    expect((error as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(asDetails(error)?.['controlDecision']).toBe('abandoned')
    expect(asDetails(error)?.['controlRequestId']).toBe(row?.requestId)
    expect(authzFacts(world.world, 'team-coordination-recorded').length).toBe(0)
    expect(sessionInputCalls.length).toBe(0)
    const stateFinal = await world.control.listControlState(AUTHZ_ROOT)
    expect(stateFinal.abandonments.filter((a) => a.requestId === row?.requestId).length).toBe(1)
    expect(stateFinal.requests.find((r) => r.requestId === row?.requestId)?.status).toBe('abandoned')
  })

  it('C7 (residual C-2 leg a): an AbortSignal aborting DURING the gate re-probe await (no explicit abandon) — the serialized boundary sees the live signal, PERSISTS the abandon (the durable close, the same footprint as an explicit abandon) and rejects typed; ZERO work', async () => {
    world = await createAuthzWorld('authz-c-7')
    // The pausable environmentFacts port (the C5 barrier shape).
    const realEnvFacts = world.world.ports.environmentFacts
    let pauseNextProbe = false
    let probePausedResolve: (() => void) | undefined
    const probePaused = new Promise<void>((resolve) => {
      probePausedResolve = resolve
    })
    let releaseBarrier: (() => void) | undefined
    const barrierHeld = new Promise<void>((resolve) => {
      releaseBarrier = resolve
    })
    const pausableEnvFacts: typeof realEnvFacts = () => {
      if (pauseNextProbe) {
        pauseNextProbe = false
        probePausedResolve?.()
        return barrierHeld.then(() => realEnvFacts())
      }
      return realEnvFacts()
    }
    const runtime7 = createTeamRuntime({
      teamDomain: world.world.domain,
      activationProvider: world.world.provider,
      blueprintCatalog: world.world.catalog,
      environmentFacts: pausableEnvFacts,
      externalPolicyFacts: world.world.ports.externalPolicyFacts,
      staticModel: TEST_STATIC_MODEL,
      now: () => P6T2_NOW,
      lifecycleCommit: createFakeLifecycleCommitPort(world.world),
      workDelivery: world.deliveryPort,
      workActivity: createWorkActivityWriter({ teamDomain: world.world.domain, now: () => P6T2_NOW }),
      controlServiceRef: { current: world.control },
    })
    const ac = new AbortController()
    const promise = withTimeout(
      runtime7.performAction(
        authzFollowUp({
          requestToken: 'tok-c-7',
          signal: ac.signal,
          payload: { prompt: 'C7-repro prompt (abort during the gate await — no explicit abandon)' },
        }),
      ),
      30_000,
      'the recovery follow-up (the signal-abort repro)',
    ).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    const { requests } = await withTimeout(waitForControlRequests(world.control, 1), 15_000, 'the durable request row')
    const row = requests.find((r) => String(r.correlation).startsWith('recovery:tok-c-7:'))
    expect(row).toBeDefined()
    await world.control.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row?.requestId),
      decision: 'allow',
    })
    // Arm the barrier for the recursive admission's gate re-probe (AFTER
    // the router's pre-dispatch signal check — the exact repro window).
    pauseNextProbe = true
    await withTimeout(probePaused, 15_000, 'the re-probe barrier hold')
    // ABORT the signal ONLY (no explicit abandon).
    ac.abort()
    releaseBarrier?.()
    const outcome = await promise
    // RED (unfixed): the work is STILL admitted (outcome ok) and there is
    // NO durable close (no abandon mark). Expected (fixed): the typed
    // abandoned block; the durable close is PERSISTED (one abandon mark
    // — the same footprint as an explicit abandon); zero work.
    expect(outcome.ok).toBe(false)
    const error = outcome.ok === false ? outcome.error : undefined
    expect((error as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(asDetails(error)?.['controlDecision']).toBe('abandoned')
    expect(asDetails(error)?.['controlRequestId']).toBe(row?.requestId)
    expect(authzFacts(world.world, 'team-work-admitted').length).toBe(0)
    expect(world.deliveryCalls.length).toBe(0)
    const stateFinal = await world.control.listControlState(AUTHZ_ROOT)
    expect(stateFinal.abandonments.filter((a) => a.requestId === row?.requestId).length).toBe(1)
    expect(stateFinal.decisions.some((d) => d.requestId === row?.requestId && d.decision === 'allow')).toBe(true)
    expect(stateFinal.requests.find((r) => r.requestId === row?.requestId)?.status).toBe('abandoned')
  })

  it('C8 (residual C-2 leg b): the signal aborting while the unit is BLOCKED WAITING for the control lock (between queue and acquisition) — the commit is STILL rejected with a durable close; ZERO work', async () => {
    world = await createAuthzWorld('authz-c-8')
    // TWO pausable ports: the environmentFacts (pins the reentry in its
    // gate re-probe) and the EXTERNAL policy (a separate
    // toolName-bearing request's `resolveControl(allow)` holds the
    // control lock ACROSS its probe await — the occupancy the unit
    // queues behind).
    const realEnvFacts = world.world.ports.environmentFacts
    let pauseNextReprobe = false
    let reprobePausedResolve: (() => void) | undefined
    const reprobePaused = new Promise<void>((resolve) => {
      reprobePausedResolve = resolve
    })
    let releaseReprobe: (() => void) | undefined
    const reprobeHeld = new Promise<void>((resolve) => {
      releaseReprobe = resolve
    })
    const pausableEnvFacts: typeof realEnvFacts = () => {
      if (pauseNextReprobe) {
        pauseNextReprobe = false
        reprobePausedResolve?.()
        return reprobeHeld.then(() => realEnvFacts())
      }
      return realEnvFacts()
    }
    const realExternal = world.world.ports.externalPolicyFacts
    let pauseNextProbe = false
    let probePausedResolve: (() => void) | undefined
    const probePaused = new Promise<void>((resolve) => {
      probePausedResolve = resolve
    })
    let releaseBarrier: (() => void) | undefined
    const barrierHeld = new Promise<void>((resolve) => {
      releaseBarrier = resolve
    })
    const pausableExternal: typeof realExternal = () => {
      if (pauseNextProbe) {
        pauseNextProbe = false
        probePausedResolve?.()
        return barrierHeld.then(() => realExternal())
      }
      return realExternal()
    }
    const control8 = createControlService({
      teamDomain: world.world.domain,
      blueprintCatalog: world.world.catalog,
      externalPolicyFacts: pausableExternal,
      now: () => P6T2_NOW,
      waitPollIntervalMs: 5,
    })
    const runtime8 = createTeamRuntime({
      teamDomain: world.world.domain,
      activationProvider: world.world.provider,
      blueprintCatalog: world.world.catalog,
      environmentFacts: pausableEnvFacts,
      externalPolicyFacts: world.world.ports.externalPolicyFacts,
      staticModel: TEST_STATIC_MODEL,
      now: () => P6T2_NOW,
      lifecycleCommit: createFakeLifecycleCommitPort(world.world),
      workDelivery: world.deliveryPort,
      workActivity: createWorkActivityWriter({ teamDomain: world.world.domain, now: () => P6T2_NOW }),
      controlServiceRef: { current: control8 },
    })
    const ac = new AbortController()
    const promise = withTimeout(
      runtime8.performAction(
        authzFollowUp({
          requestToken: 'tok-c-8',
          signal: ac.signal,
          payload: { prompt: 'C8-repro prompt (abort while queued on the control lock)' },
        }),
      ),
      30_000,
      'the recovery follow-up (the queued-signal-abort repro)',
    ).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    const { requests: rows1 } = await withTimeout(waitForControlRequests(control8, 1), 15_000, 'the durable request row')
    const row = rows1.find((r) => String(r.correlation).startsWith('recovery:tok-c-8:'))
    expect(row).toBeDefined()
    // The OCCUPANCY row: a separate toolName-bearing request (its allow
    // resolution probes the external policy — holding the control lock
    // across the probe await).
    const occupancy = await control8.requestControl({
      rootSessionId: AUTHZ_ROOT,
      caller: makeActionRequest({}).caller,
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      subject: { kind: 'instance', instanceId: AUTHZ_WORKER },
      actionName: 'follow-up',
      toolName: 'follow-up',
      correlation: 'c8-occupancy:1',
      summary: 'C8 occupancy (holds the control lock across the external probe)',
    })
    // Approve the reviewed request (the control lock is free — the
    // decision lands; the reentry is in flight).
    await control8.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row?.requestId),
      decision: 'allow',
    })
    // PIN the reentry in its gate re-probe (deterministic placement:
    // the unit cannot reach the control lock yet).
    pauseNextReprobe = true
    await withTimeout(reprobePaused, 15_000, 'the re-probe barrier hold')
    // Start the occupancy's allow resolution (un-awaited — it parks at
    // the external probe, HOLDING THE CONTROL LOCK).
    pauseNextProbe = true
    const occupancyResolve = control8.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: occupancy.requestId,
      decision: 'allow',
    })
    await withTimeout(probePaused, 15_000, 'the control-lock hold (the occupancy probe)')
    // Release the re-probe: the gate completes and the unit's
    // control-lock acquisition QUEUES behind the occupancy (which still
    // holds the lock). Give the queue a moment, then ABORT the signal —
    // between the unit's queue and its acquisition. (The outcome is
    // identical for any abort before the unit's check: the check runs
    // only after the occupancy releases, which the test controls.)
    releaseReprobe?.()
    await sleep(60)
    ac.abort()
    // Release the occupancy (the unit acquires the lock next).
    releaseBarrier?.()
    await withTimeout(occupancyResolve, 15_000, 'the occupancy resolution')
    const outcome = await promise
    // RED (unfixed): the unit has no signal check — the work is still
    // admitted (outcome ok), no durable close. Expected (fixed): the
    // typed abandoned block + the PERSISTED durable close (one abandon
    // mark) + zero work.
    expect(outcome.ok).toBe(false)
    const error = outcome.ok === false ? outcome.error : undefined
    expect((error as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(asDetails(error)?.['controlDecision']).toBe('abandoned')
    expect(asDetails(error)?.['controlRequestId']).toBe(row?.requestId)
    expect(authzFacts(world.world, 'team-work-admitted').length).toBe(0)
    expect(world.deliveryCalls.length).toBe(0)
    const stateFinal = await control8.listControlState(AUTHZ_ROOT)
    expect(stateFinal.abandonments.filter((a) => a.requestId === row?.requestId).length).toBe(1)
    expect(stateFinal.requests.find((r) => r.requestId === row?.requestId)?.status).toBe('abandoned')
    // The occupancy evidence: the hold really ran under the control lock
    // (the occupancy's allow decision is durable).
    expect(stateFinal.decisions.some((d) => d.requestId === occupancy.requestId && d.decision === 'allow')).toBe(true)
  })
})
