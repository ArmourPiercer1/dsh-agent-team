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
  type ControlService,
} from '../control/index.js'
import { TEAM_RUNTIME_ERROR_CODES, type WorkDeliveryPort } from '../admission/index.js'
import { createActivationProvider, type ActivationProvider } from '../activation/index.js'
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

// =====================================================================
// C9 — the bounded C matrix (external review completeness)
//
// Spec (bounded — the parent's six cells, no expansion): EVERY await
// point between the approval (allow) and the FIRST durable commit must
// settle an abort into exactly ONE durable close + a typed terminal
// outcome — and a commit that has already landed is never retroactively
// undone (post-commit settle stands; a late abort is a documented no-op).
//
// Rows = action {delegate, follow-up, send-message/coordination, fresh
// create-member (incl. delegate-create)} × abort point {decision-settle,
// terminal-snapshot, outer-runtime-queue, outer-gate (success-path live
// check + gate-REJECT-while-aborted), second-preflight (authority /
// provider-lock / external-facts — BEFORE the journal reservation),
// control-queue} × pre-state {no mark, already-abandoned}, plus the
// persist-fault legs and the post-commit settle rows.
//
// Structurally absent cells (documented N/A, not executed):
//  - second-preflight × follow-up / send-message: the follow-up's first
//    commit is the work CAS (the direct admission under the chain — no
//    activation preflight); the coordination effect has no activation.
//    (This absence is exactly why the pre-reservation window was never
//    covered by the old tests: existing-member delegates short-circuit
//    (L637-646) and follow-ups go direct CAS.)
//  - second-preflight `templateFacts` sub-point: v2-blueprint only
//    (`targetTemplateInputs` is present only for schemaVersion 2). The
//    P6-T2 fixture blueprint is schemaVersion 1 — the await is
//    structurally absent here (the boundary check is placed in code
//    after that await regardless).
//  - outer-gate × send-message: the recovery reentry takes the fallback
//    (no gate on the reentry — the original attempt's gate ran BEFORE
//    approval, outside the covered span).
//  - post-commit × already-abandoned: the unit rejects a pre-commit
//    mark before any commit can land — the combination is impossible.
//  - post-commit × create-member (plain): the effect completes INSIDE
//    the chain (the activation commit is the last write) — the
//    post-commit window is observationally empty there; the staged
//    work-chain rows (follow-up, delegate-create) pin the semantics.
//
// RED baseline (captured at a2b3df79 before the fix): cells 2
// (terminal-snapshot no-mark, outer-queue), 3 (gate-reject) and 5
// (second-preflight) are RED (the raw abort escapes — the request is
// left `decided`, no durable close); cells 1 (decision-settle), 4
// (control-queue), 6 (post-commit) and the already-abandoned
// terminal-snapshot rows are the GREEN baseline (the existing L595 /
// L632-650 / C-2 unit checks). The persist-fault legs: the admission
// close leg is GREEN at a2b3df79 (the unit's close persist already
// types through the service's durableFailure mapping →
// TEAM_RUNTIME_DURABLE_WRITE_FAILED, fail-closed, zero effects — the
// row pins the verified contract); the second-preflight close leg is
// RED at a2b3df79 (NO boundary exists — the reservation still runs).
// =====================================================================

type MatrixAction = 'follow-up' | 'delegate' | 'create-member' | 'send-message'
type MatrixPoint =
  | 'decision-settle'
  | 'terminal-snapshot'
  | 'outer-queue'
  | 'gate-success'
  | 'gate-reject'
  | 'control-queue'
  | 'pre-flight-authority'
  | 'pre-flight-provider-lock'
  | 'pre-flight-external-facts'
  // residual-3 — the pre-reservation REJECT-region points (the
  // dedicated rows below — NOT enumerated in MATRIX_POINTS, so the
  // 60-row matrix and its arithmetic are untouched):
  | 'pre-flight-external-facts-reject'
  | 'pre-flight-template-feed-reject'
  | 'fault-preflight-oneshot'
  | 'post-commit'
  | 'fault-admission'
  | 'fault-preflight'
type MatrixPreState = 'no-mark' | 'already-abandoned'

interface MatrixRow {
  readonly id: string
  readonly action: MatrixAction
  readonly point: MatrixPoint
  readonly preState: MatrixPreState
  /** The external-review named repro (follow-up × outer-runtime-queue ×
   *  no mark) — the C6-style shared hold + live AbortSignal. */
  readonly namedRepro?: boolean
}

function c9Applicable(action: MatrixAction, point: MatrixPoint, preState: MatrixPreState): boolean {
  switch (point) {
    case 'pre-flight-authority':
    case 'pre-flight-provider-lock':
    case 'pre-flight-external-facts':
      // The pre-reservation window exists ONLY for the fresh-activation
      // actions (delegate-create / fresh create-member).
      return action === 'delegate' || action === 'create-member'
    case 'gate-success':
    case 'gate-reject':
      // The reentry re-gates ONLY for the gated (new-work) actions.
      return action !== 'send-message'
    case 'post-commit':
      // The staged work-chain actions only (see the N/A notes above).
      return (action === 'follow-up' || action === 'delegate') && preState === 'no-mark'
    case 'fault-admission':
      return action === 'follow-up' && preState === 'no-mark'
    case 'fault-preflight':
      return action === 'create-member' && preState === 'no-mark'
    default:
      return true
  }
}

const MATRIX_ACTIONS: readonly MatrixAction[] = ['delegate', 'follow-up', 'send-message', 'create-member']
const MATRIX_POINTS: readonly MatrixPoint[] = [
  'decision-settle',
  'terminal-snapshot',
  'outer-queue',
  'gate-success',
  'gate-reject',
  'control-queue',
  'pre-flight-authority',
  'pre-flight-provider-lock',
  'pre-flight-external-facts',
  'post-commit',
  'fault-admission',
  'fault-preflight',
]
const MATRIX_PRE_STATES: readonly MatrixPreState[] = ['no-mark', 'already-abandoned']

const MATRIX_ROWS: readonly MatrixRow[] = (() => {
  const rows: MatrixRow[] = []
  let n = 0
  for (const action of MATRIX_ACTIONS) {
    for (const point of MATRIX_POINTS) {
      for (const preState of MATRIX_PRE_STATES) {
        if (!c9Applicable(action, point, preState)) continue
        n++
        rows.push({
          id: `c9-${n}`,
          action,
          point,
          preState,
          ...(action === 'follow-up' && point === 'outer-queue' && preState === 'no-mark'
            ? { namedRepro: true }
            : {}),
        })
      }
    }
  }
  return rows
})()

/** One deterministic barrier (the pause/release pair used by every
 *  pausable port, the holds and the proxy pin): the intercepted call
 *  signals `pauseArrive()` (the `paused` signal — the test knows the
 *  call is held), and the test later calls `release()` (the `held`
 *  promise resolves — the call proceeds). */
function c9Barrier(): {
  readonly held: Promise<void>
  readonly paused: Promise<void>
  pauseArrive: () => void
  release: () => void
} {
  let releaseBarrier: (() => void) | undefined
  const held = new Promise<void>((resolve) => {
    releaseBarrier = resolve
  })
  let pausedResolve: (() => void) | undefined
  const paused = new Promise<void>((resolve) => {
    pausedResolve = resolve
  })
  return {
    held,
    paused,
    pauseArrive: () => {
      pausedResolve?.()
    },
    release: () => {
      releaseBarrier?.()
    },
  }
}

/** Wait until the map entry for the root CHANGED relative to the
 *  occupation's entry — the C6 proof that the reentry queued on the
 *  shared runtime chain behind the hold. */
async function c9WaitQueued(chains: Map<string, Promise<unknown>>, occupationChain: Promise<unknown>): Promise<void> {
  for (let i = 0; i < 3000; i++) {
    const current = chains.get(AUTHZ_ROOT)
    if (current !== undefined && current !== occupationChain) return
    await sleep(1)
  }
  throw new Error('c9: the reentry never queued on the shared runtime lock')
}

/** The control-service proxy: delegates EVERY method to the real
 *  service except `listControlState`, which — once ARMED — holds its
 *  first call at the barrier. That call is the reentry's pre-dispatch
 *  terminal snapshot (the first listControlState on the ref after the
 *  wait settles) — the deterministic L631 pin. */
function c9ProxyControl(
  real: ControlService,
  pause: () => Promise<void>,
): ControlService & { arm: () => void } {
  let armed = false
  return {
    requestControl: (args) => real.requestControl(args),
    resolveControl: (args) => real.resolveControl(args),
    abandonControlRequest: (args) => real.abandonControlRequest(args),
    listControlState: async (rootSessionId: string) => {
      if (armed) {
        armed = false
        await pause()
        return real.listControlState(rootSessionId)
      }
      return real.listControlState(rootSessionId)
    },
    guardOperation: (scope) => real.guardOperation(scope),
    checkExternalOperation: (input) => real.checkExternalOperation(input),
    awaitControlDecision: (input) => real.awaitControlDecision(input),
    commitEffectIfAuthorized(input) {
      return real.commitEffectIfAuthorized(input)
    },
    persistAbandonCloseLocked(input) {
      return real.persistAbandonCloseLocked(input)
    },
    arm: () => {
      armed = true
    },
  } as ControlService & { arm: () => void }
}

/** The base runtime rebuild over a C9 world (the D/C5 rebuild pattern
 *  without a restart) with per-row overrides (the override field types
 *  are derived from the runtime options — no duplicated port typings). */
type C9RuntimeOptions = Parameters<typeof createTeamRuntime>[0]
function c9Runtime(
  w: AuthzWorld,
  overrides: {
    envFacts?: C9RuntimeOptions['environmentFacts']
    external?: C9RuntimeOptions['externalPolicyFacts']
    delivery?: WorkDeliveryPort
    provider?: ActivationProvider
    chains?: Map<string, Promise<unknown>>
    control?: ControlService
  } = {},
): ReturnType<typeof createTeamRuntime> {
  return createTeamRuntime({
    teamDomain: w.world.domain,
    activationProvider: overrides.provider ?? w.world.provider,
    blueprintCatalog: w.world.catalog,
    environmentFacts: overrides.envFacts ?? w.world.ports.environmentFacts,
    externalPolicyFacts: overrides.external ?? w.world.ports.externalPolicyFacts,
    staticModel: TEST_STATIC_MODEL,
    now: () => P6T2_NOW,
    lifecycleCommit: createFakeLifecycleCommitPort(w.world),
    workDelivery: overrides.delivery ?? w.deliveryPort,
    workActivity: createWorkActivityWriter({ teamDomain: w.world.domain, now: () => P6T2_NOW }),
    ...(overrides.chains !== undefined ? { teamLocks: overrides.chains } : {}),
    controlServiceRef: { current: overrides.control ?? w.control },
  })
}

/** The row's action request (the leader caller on every recovery-
 *  dispatch action of the fixture world). */
function c9ActionRequest(row: MatrixRow, token: string, signal: AbortSignal) {
  switch (row.action) {
    case 'follow-up':
      return authzFollowUp({
        requestToken: token,
        signal,
        payload: { prompt: `C9 ${row.id} follow-up prompt (abort point ${row.point})` },
      })
    case 'delegate':
      return makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'scout',
        requestToken: token,
        signal,
        payload: { label: `c9-${row.id}-scout`, prompt: `C9 ${row.id} delegate prompt` },
      })
    case 'create-member':
      return makeActionRequest({
        action: 'create-member',
        delegationTemplateId: 'worker',
        requestToken: token,
        signal,
        payload: { label: `c9-${row.id}-worker` },
      })
    case 'send-message':
      return makeActionRequest({
        action: 'send-message',
        targetInstanceId: AUTHZ_WORKER,
        requestToken: token,
        signal,
        payload: {
          recipientInstanceId: AUTHZ_WORKER,
          subject: `C9 ${row.id}`,
          body: `C9 ${row.id} message body (abort point ${row.point})`,
        },
      })
  }
}

/** Start the row's invocation over the given runtime. EVERY action —
 *  including send-message — goes through the direct `performAction`
 *  action request (the H-suite shape): the signal THREADS only through
 *  the action request — the MessagingCoordinator seam carries no signal
 *  channel, so a coordinator-built send-message would make the abort
 *  invisible to the runtime (the C6 coordinator row pins that lane
 *  separately, signal-free). */
function c9Start(
  runtime: ReturnType<typeof createTeamRuntime>,
  row: MatrixRow,
  token: string,
  signal: AbortSignal,
): { readonly promise: Promise<{ readonly ok: boolean; readonly error?: unknown }>; readonly sessionInputCalls: unknown[] } {
  const wrapped = (p: Promise<unknown>) =>
    withTimeout(p, 30_000, `the C9 ${row.action} (${row.point})`).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    )
  return { promise: wrapped(runtime.performAction(c9ActionRequest(row, token, signal))), sessionInputCalls: [] }
}

/** Find the row's durable control request (the recovery correlation). */
async function c9WaitRow(control: ControlService, token: string): Promise<string> {
  const { requests } = await withTimeout(waitForControlRequests(control, 1), 15_000, 'the durable request row')
  const row = requests.find((r) => String(r.correlation).startsWith(`recovery:${token}:`))
  expect(row).toBeDefined()
  return String(row?.requestId)
}

async function c9Allow(control: ControlService, requestId: string): Promise<void> {
  await control.resolveControl({
    rootSessionId: AUTHZ_ROOT,
    caller: authzHumanCaller(),
    requestId,
    decision: 'allow',
  })
}

/** The EXPLICIT abandon (the `already-abandoned` pre-state) — the
 *  legal human abandoner on every request. */
function c9Abandon(control: ControlService, requestId: string, reason: string) {
  return control.abandonControlRequest({
    rootSessionId: AUTHZ_ROOT,
    caller: authzHumanCaller(),
    requestId,
    reason,
  })
}

/** The shared close assertions (every close-typed row): the typed
 *  abandoned block, zero work / delivery / coordination / reservation,
 *  exactly ONE durable mark, the stale allow closed, status `abandoned`. */
async function c9AssertClose(
  outcome: { readonly ok: boolean; readonly error?: unknown },
  w: AuthzWorld,
  control: ControlService,
  requestId: string,
  memberBaseline: number,
  sessionInputCalls: readonly unknown[],
  allowCommitted: boolean,
): Promise<void> {
  expect(outcome.ok).toBe(false)
  const error = outcome.ok === false ? outcome.error : undefined
  expect((error as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
  expect(asDetails(error)?.['controlDecision']).toBe('abandoned')
  expect(asDetails(error)?.['controlRequestId']).toBe(requestId)
  // ZERO work / ZERO delivery / ZERO coordination.
  expect(authzFacts(w.world, 'team-work-admitted').length).toBe(0)
  expect(w.deliveryCalls.length).toBe(0)
  expect(authzFacts(w.world, 'team-coordination-recorded').length).toBe(0)
  expect(sessionInputCalls.length).toBe(0)
  // ZERO reservation / ZERO provisioning (cell 5): the member set is
  // unchanged (only the seed instances).
  expect(w.world.domain.repositories.memberInstances.list(AUTHZ_ROOT).length).toBe(memberBaseline)
  // Exactly ONE durable mark (or the documented idempotent no-op).
  const state = await control.listControlState(AUTHZ_ROOT)
  expect(state.abandonments.filter((a) => a.requestId === requestId).length).toBe(1)
  if (allowCommitted) {
    // The stale allow decision row is closed by the terminal mark.
    expect(state.decisions.some((d) => d.requestId === requestId && d.decision === 'allow')).toBe(true)
  }
  expect(state.requests.find((r) => r.requestId === requestId)?.status).toBe('abandoned')
}

/** The persist-fault leg assertions: the TYPED fail-closed fault code,
 *  zero effects, NO half-abandoned mark (the state could not be made
 *  terminal — the effect must NEVER commit). */
async function c9AssertFault(
  outcome: { readonly ok: boolean; readonly error?: unknown },
  w: AuthzWorld,
  control: ControlService,
  requestId: string,
  memberBaseline: number,
): Promise<void> {
  expect(outcome.ok).toBe(false)
  const error = outcome.ok === false ? outcome.error : undefined
  expect((error as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED)
  expect(authzFacts(w.world, 'team-work-admitted').length).toBe(0)
  expect(w.deliveryCalls.length).toBe(0)
  expect(authzFacts(w.world, 'team-coordination-recorded').length).toBe(0)
  expect(w.world.domain.repositories.memberInstances.list(AUTHZ_ROOT).length).toBe(memberBaseline)
  const state = await control.listControlState(AUTHZ_ROOT)
  expect(state.abandonments.filter((a) => a.requestId === requestId).length).toBe(0)
}

/** Patch the control ledger so that ONLY the abandon-mark persist
 *  faults (the `control-request-abandoned` fact write — the service's
 *  close write goes through `ledger.put(entry)`) — every other control
 *  write (decision rows, etc.) stays healthy. Restores the real write
 *  in `finally` (the S-suite storage-fault pattern, narrowed to the
 *  close write). The service's own `durableFailure` mapping types the
 *  faulted close as TEAM_RUNTIME_DURABLE_WRITE_FAILED (the
 *  fail-closed contract these legs pin). */
function c9PatchAbandonPersistFault(w: AuthzWorld): () => void {
  const ledger = w.world.domain.repositories.ledger
  const realPut = ledger.put.bind(ledger)
  ledger.put = (entry: unknown) => {
    if (
      entry !== null &&
      typeof entry === 'object' &&
      'factType' in entry &&
      (entry as { readonly factType?: unknown }).factType === 'control-request-abandoned'
    ) {
      throw new Error('c9: the durable close write faulted (injected)')
    }
    return realPut(entry)
  }
  return () => {
    ledger.put = realPut
  }
}

/** The C8 occupancy: a toolName-bearing request whose allow resolution
 *  parks at the external probe — holding the CONTROL lock (b). */
function c9Occupancy(
  w: AuthzWorld,
  rowId: string,
): {
  readonly control: ControlService
  /** Creates the toolName-bearing occupancy request (its allow parks at
   *  the external probe — holding the control lock (b)). */
  create: () => Promise<string>
  /** Starts the occupancy's allow resolution (un-awaited — parks at the
   *  probe, holding the lock). Returns the resolution promise. */
  startAllow: () => Promise<unknown>
  releaseProbe: () => void
  readonly probePaused: Promise<void>
} {
  const barrier = c9Barrier()
  let nextProbePause = false
  const pausableExternal: C9RuntimeOptions['externalPolicyFacts'] = () => {
    if (nextProbePause) {
      nextProbePause = false
      barrier.pauseArrive()
      return barrier.held.then(() => w.world.ports.externalPolicyFacts())
    }
    return w.world.ports.externalPolicyFacts()
  }
  const control = createControlService({
    teamDomain: w.world.domain,
    blueprintCatalog: w.world.catalog,
    externalPolicyFacts: pausableExternal,
    now: () => P6T2_NOW,
    waitPollIntervalMs: 5,
  })
  let occupancyRequestId = ''
  return {
    control,
    create: async () => {
      const occupancy = await control.requestControl({
        rootSessionId: AUTHZ_ROOT,
        caller: makeActionRequest({}).caller,
        kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
        subject: { kind: 'instance', instanceId: AUTHZ_WORKER },
        actionName: 'follow-up',
        toolName: 'follow-up',
        correlation: `c9-${rowId}-occupancy:1`,
        summary: `C9 ${rowId} occupancy (holds the control lock across the external probe)`,
      })
      occupancyRequestId = occupancy.requestId
      return occupancyRequestId
    },
    startAllow: () => {
      nextProbePause = true
      // Un-awaited: parks at the external probe, HOLDING THE CONTROL LOCK.
      return control.resolveControl({
        rootSessionId: AUTHZ_ROOT,
        caller: authzHumanCaller(),
        requestId: occupancyRequestId,
        decision: 'allow',
      })
    },
    releaseProbe: () => barrier.release(),
    probePaused: barrier.paused,
  }
}

describe('fix-control-authz C9: the bounded C matrix (every pre-commit await settles to the durable close)', () => {
  // (The module-level `world` + the file's top-level afterEach handle
  //  the world teardown — c9RunRow assigns `world` per row.)
  for (const row of MATRIX_ROWS) {
    it(
      `${row.id}: ${row.action} × ${row.point} × ${row.preState}${row.namedRepro ? ' (the external named repro)' : ''}`,
      async () => {
        await c9RunRow(row)
      },
    )
  }

  it('c9-serial: a cancelled waiter KEEPS its queue slot — a later writer never overtakes the still-running holder (the reviewer sequence: holder start → cancel waiter → later writer → holder end)', async () => {
    const chains = new Map<string, Promise<unknown>>()
    const events: string[] = []
    const hold = c9Barrier()
    // The explicit LATER-WRITER-ENTERED barrier event (the user ruling
    // on the F1 closure — no real-time gap, no microtask-count luck):
    // the later writer's work resolves this promise the moment it
    // ENTERS (its queue slot is granted and the work has begun). The
    // overtake proof rests on THIS event: on the BROKEN base the entry
    // is a pending microtask (the old tail chains the later writer onto
    // the already-resolved cancelled-waiter entry — it drains before
    // any timer fires, the spec's event-loop ordering) while the holder
    // is still parked; on the FIXED base the entry is structurally
    // IMPOSSIBLE before the holder settles (the cancelled waiter's tail
    // keeps its slot until the holder's settlement) — so no observation
    // window length can change either outcome.
    let laterEnteredResolve: (() => void) | undefined
    const laterEntered = new Promise<void>((resolve) => {
      laterEnteredResolve = resolve
    })
    const holder = withTeamLock(chains, 'root-serial', async () => {
      events.push('holder-start')
      await hold.held
      events.push('holder-end')
      return undefined
    })
    // The holder's map entry (the occupation chain the waiter must queue
    // BEHIND). withTeamLock sets the map entry synchronously on the call,
    // so the holder's entry is captured BETWEEN the two calls — after
    // the waiter's call the entry is already the waiter's (replaced).
    const occupationChain = chains.get('root-serial')
    if (occupationChain === undefined) throw new Error('c9-serial: the holder chain entry is missing')
    const waiterSignal = new AbortController()
    const waiter = withTeamLock(chains, 'root-serial', async () => {
      events.push('waiter-ran')
      return undefined
    }, waiterSignal.signal).catch((error: unknown) => {
      events.push('waiter-rejected')
      return error
    })
    // The waiter is queued behind the holder (the map entry changed).
    expect(chains.get('root-serial')).not.toBe(occupationChain)
    // Cancel the WAITER (it never acquired the lock).
    waiterSignal.abort('c9-serial: the waiter cancelled')
    await withTimeout(waiter, 5_000, 'the waiter rejection')
    // The LATER writer (enqueued after the cancelled waiter) must NOT
    // overtake the still-running holder: its slot sits behind the
    // holder's settlement.
    const later = withTeamLock(chains, 'root-serial', async () => {
      // The explicit ENTERED event: the later writer's queue slot was
      // granted — the work has begun (the overtake observation point).
      laterEnteredResolve?.()
      events.push('later-writer')
      return undefined
    })
    // The observation window on the entered event (the user ruling's
    // explicit-barrier choreography — the literal "wait on entered,
    // THEN release" would deadlock on the FIXED base, where entry is
    // structurally impossible before the release; the bounded window is
    // the same observation made non-deadlocking, with the outcome
    // structurally determined — see the barrier declaration above):
    // on the BROKEN base the entered event fires inside the window
    // (the overtake is directly observable while the holder is still
    // parked); on the FIXED base the window expires deterministically.
    const enteredBeforeRelease = await withTimeout(
      laterEntered,
      2_000,
      'the later-writer entered event (the overtake observation window)',
    )
      .then(() => true)
      .catch(() => false)
    if (enteredBeforeRelease) {
      // The overtake is DIRECTLY OBSERVED: the later writer entered
      // while the holder is still running (the hold is not released —
      // the holder is provably parked). The correct-ordering assertion
      // below then FAILS — the genuine deterministic RED pin for the
      // unfixed tail (committed-bytes RED: c9-red-baseline-v2.log).
      expect(events).not.toContain('holder-end')
    }
    hold.release()
    await withTimeout(holder, 15_000, 'the holder settlement')
    await withTimeout(later, 15_000, 'the later writer')
    // The waiter rejected (the raw cancellation is visible to the
    // caller) — and the later writer ran AFTER the holder ended.
    expect(events).toContain('waiter-rejected')
    expect(events).not.toContain('waiter-ran')
    expect(events.indexOf('later-writer')).toBeGreaterThan(events.indexOf('holder-end'))
    // The full order: holder-start → waiter-rejected → holder-end →
    // later-writer (the cancelled waiter's tail kept the serial chain
    // intact — the close is a side effect, never a chain detach).
    // BROKEN base: 'later-writer' was observed BEFORE the release
    // (above) → this FAILS (the RED pin). FIXED base: the entered event
    // can only fire after the holder settlement → this PASSES (the
    // GREEN pin).
    expect(events).toEqual(['holder-start', 'waiter-rejected', 'holder-end', 'later-writer'])
  })
})

async function c9RunRow(row: MatrixRow): Promise<void> {
  const w = await createAuthzWorld(`authz-${row.id}`)
  world = w
  const ac = new AbortController()
  const token = `tok-${row.id}`
  const memberBaseline = w.world.domain.repositories.memberInstances.list(AUTHZ_ROOT).length
  switch (row.point) {
    case 'decision-settle':
      return await c9DecisionSettle(row, w, ac, token, memberBaseline)
    case 'terminal-snapshot':
      return await c9TerminalSnapshot(row, w, ac, token, memberBaseline)
    case 'outer-queue':
      return await c9OuterQueue(row, w, ac, token, memberBaseline)
    case 'gate-success':
      return await c9GateSuccess(row, w, ac, token, memberBaseline)
    case 'gate-reject':
      return await c9GateReject(row, w, ac, token, memberBaseline)
    case 'control-queue':
      return await c9ControlQueue(row, w, ac, token, memberBaseline)
    case 'pre-flight-authority':
    case 'pre-flight-provider-lock':
    case 'pre-flight-external-facts':
      return await c9PreFlight(row, w, ac, token, memberBaseline)
    case 'post-commit':
      return await c9PostCommit(row, w, ac, token, memberBaseline)
    case 'fault-admission':
      return await c9FaultAdmission(row, w, ac, token, memberBaseline)
    case 'fault-preflight':
      return await c9FaultPreflight(row, w, ac, token, memberBaseline)
  }
}

/** Cell 1 (GREEN baseline): the abort is visible at the decision-settle
 *  boundary — the post-settle signal check (L594-630). no-mark: the S6
 *  race (the durable allow wins the poll; the cascade resolves it; the
 *  post-settle check closes durably + typed). already-abandoned: the
 *  explicit mark lands while the router waits — the terminal-mark
 *  poll settles rejected; the signal abort is a no-op. */
async function c9DecisionSettle(
  row: MatrixRow,
  w: AuthzWorld,
  ac: AbortController,
  token: string,
  memberBaseline: number,
): Promise<void> {
  const runtime = c9Runtime(w)
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(w.control, token)
  if (row.preState === 'no-mark') {
    await c9Allow(w.control, requestId)
    // ABORT immediately (same tick, before the bridge's next 5 ms
    // poll): the cascade reads the already-durable allow → resolves it
    // (the first decision is authoritative — S6); the router's
    // post-settle signal check then closes durably + typed.
    ac.abort()
    const outcome = await started.promise
    await c9AssertClose(outcome, w, w.control, requestId, memberBaseline, started.sessionInputCalls, true)
    return
  }
  // already-abandoned: the explicit close lands while the router waits
  // (the terminal mark); the signal abort fires at the settle point —
  // a documented no-op (the invocation is already dead).
  await c9Abandon(w.control, requestId, `c9 ${row.id}: pre-settle abandon`)
  ac.abort()
  const outcome = await started.promise
  await c9AssertClose(outcome, w, w.control, requestId, memberBaseline, started.sessionInputCalls, false)
}

/** Cell 2 (RED no-mark / GREEN already-abandoned): the abort lands AT
 *  the terminal-snapshot await (L631) — the reentry is pinned there by
 *  the proxy. no-mark: the snapshot completes with no mark; the reentry
 *  then dies at the chain post-wait check (the RAW abort — the unit is
 *  never consulted — the residual P2 gap). already-abandoned: the mark
 *  lands while the snapshot is held — the post-snapshot mark check
 *  (L632-650) catches it (GREEN baseline). */
async function c9TerminalSnapshot(
  row: MatrixRow,
  w: AuthzWorld,
  ac: AbortController,
  token: string,
  memberBaseline: number,
): Promise<void> {
  // The proxy's pause barrier: the reentry's first listControlState on
  // the ref (its pre-dispatch terminal snapshot) holds here.
  const barrier = c9Barrier()
  const proxy = c9ProxyControl(w.control, () => {
    barrier.pauseArrive()
    return barrier.held
  })
  const runtime = c9Runtime(w, { control: proxy })
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(w.control, token)
  await c9Allow(w.control, requestId)
  proxy.arm()
  await withTimeout(barrier.paused, 15_000, 'the terminal-snapshot barrier hold (the reentry is pinned at L631)')
  if (row.preState === 'already-abandoned') {
    // The mark lands while the snapshot is held — the fresh snapshot
    // read (post-release) sees it; the post-snapshot mark check
    // (L632-650) stops the reentry (the GREEN baseline path).
    await c9Abandon(w.control, requestId, `c9 ${row.id}: abandon during the snapshot hold`)
  }
  ac.abort()
  barrier.release()
  const outcome = await started.promise
  await c9AssertClose(outcome, w, w.control, requestId, memberBaseline, started.sessionInputCalls, true)
}

/** Cell 2 (RED both pre-states): the abort lands at the OUTER RUNTIME
 *  QUEUE — the C6-style shared-chain hold (the external named repro for
 *  follow-up × no mark). The reentry is proven QUEUED behind the hold
 *  (the map entry changed) before the abort; the release lets the chain
 *  post-wait check reject with the RAW abort (no close, the unit never
 *  runs). */
async function c9OuterQueue(
  row: MatrixRow,
  w: AuthzWorld,
  ac: AbortController,
  token: string,
  memberBaseline: number,
): Promise<void> {
  const chains = new Map<string, Promise<unknown>>()
  const runtime = c9Runtime(w, { chains })
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(w.control, token)
  // The test HOLDS the shared runtime chain BEFORE the allow.
  const hold = c9Barrier()
  let holdAcquiredResolve: (() => void) | undefined
  const holdAcquired = new Promise<void>((resolve) => {
    holdAcquiredResolve = resolve
  })
  const occupation = withTeamLock(chains, AUTHZ_ROOT, () => {
    holdAcquiredResolve?.()
    return hold.held
  })
  await withTimeout(holdAcquired, 15_000, 'the runtime-chain hold')
  const occupationChain = chains.get(AUTHZ_ROOT)
  if (occupationChain === undefined) throw new Error('c9: the occupation chain entry is missing')
  await c9Allow(w.control, requestId)
  await c9WaitQueued(chains, occupationChain)
  if (row.preState === 'already-abandoned') {
    // The mark is durable while the reentry is queued on the runtime
    // chain (the control lock is free — it persists now).
    await c9Abandon(w.control, requestId, `c9 ${row.id}: abandon while queued on the runtime lock`)
  }
  ac.abort()
  hold.release()
  await withTimeout(occupation, 15_000, 'the occupation settlement')
  const outcome = await started.promise
  await c9AssertClose(outcome, w, w.control, requestId, memberBaseline, started.sessionInputCalls, true)
}

/** Cell 3 (GREEN): the abort lands during the OUTER GATE re-probe
 *  (success path) — the C7 live check: the gate resolves; the unit's
 *  in-hold check settles the close (no-mark: persist + typed;
 *  already-abandoned: the mark check — the idempotent no-op). */
async function c9GateSuccess(
  row: MatrixRow,
  w: AuthzWorld,
  ac: AbortController,
  token: string,
  memberBaseline: number,
): Promise<void> {
  const realEnvFacts = w.world.ports.environmentFacts
  const barrier = c9Barrier()
  let pauseNext = false
  const pausableEnvFacts: typeof realEnvFacts = () => {
    if (pauseNext) {
      pauseNext = false
      barrier.pauseArrive()
      return barrier.held.then(() => realEnvFacts())
    }
    return realEnvFacts()
  }
  const runtime = c9Runtime(w, { envFacts: pausableEnvFacts })
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(w.control, token)
  await c9Allow(w.control, requestId)
  pauseNext = true
  await withTimeout(barrier.paused, 15_000, 'the gate re-probe barrier hold')
  if (row.preState === 'already-abandoned') {
    await c9Abandon(w.control, requestId, `c9 ${row.id}: abandon during the re-probe`)
  }
  ac.abort()
  barrier.release()
  const outcome = await started.promise
  await c9AssertClose(outcome, w, w.control, requestId, memberBaseline, started.sessionInputCalls, true)
}

/** Cell 3 (RED both pre-states): the gate REJECTS (the re-probe faults
 *  — the fail-closed reject) while the signal is ALREADY aborted. At
 *  a2b3df79 the fault propagates raw through the gated-branch catch
 *  (no offer → rethrow) — no close. Expected: the pre-commit settlement
 *  catches the aborted pre-commit reject → the durable close + typed. */
async function c9GateReject(
  row: MatrixRow,
  w: AuthzWorld,
  ac: AbortController,
  token: string,
  memberBaseline: number,
): Promise<void> {
  const realEnvFacts = w.world.ports.environmentFacts
  const barrier = c9Barrier()
  let pauseNext = false
  const pausableFaultyEnvFacts: typeof realEnvFacts = () => {
    if (pauseNext) {
      pauseNext = false
      barrier.pauseArrive()
      return barrier.held.then(() => {
        throw new Error(`c9 ${row.id}: the gate re-probe faulted (injected)`)
      })
    }
    return realEnvFacts()
  }
  const runtime = c9Runtime(w, { envFacts: pausableFaultyEnvFacts })
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(w.control, token)
  await c9Allow(w.control, requestId)
  pauseNext = true
  await withTimeout(barrier.paused, 15_000, 'the gate re-probe barrier hold (the reject window)')
  if (row.preState === 'already-abandoned') {
    await c9Abandon(w.control, requestId, `c9 ${row.id}: abandon during the re-probe`)
  }
  ac.abort()
  barrier.release()
  const outcome = await started.promise
  await c9AssertClose(outcome, w, w.control, requestId, memberBaseline, started.sessionInputCalls, true)
}

/** Cell 4 (GREEN both pre-states): the abort lands while the unit is
 *  queued on the CONTROL lock (the C8 repro — the occupancy holds (b)
 *  at its external probe). The reentry is pinned on the shared RUNTIME
 *  chain (the hold), so the (b) occupancy is established BEFORE the
 *  reentry can reach the unit; the hold release lets the reentry pass
 *  its chain post-wait check (the signal is not aborted yet) and queue
 *  on (b) behind the occupancy. The unit's in-hold check settles the
 *  close after the occupancy releases (no-mark: persist + typed;
 *  already-abandoned: the concurrent explicit abandon — queued on (b)
 *  BEHIND the unit (it was fired later) — rejects exactly-once after
 *  the unit's close persist; exactly ONE mark either way). */
async function c9ControlQueue(
  row: MatrixRow,
  w: AuthzWorld,
  ac: AbortController,
  token: string,
  memberBaseline: number,
): Promise<void> {
  const chains = new Map<string, Promise<unknown>>()
  const occ = c9Occupancy(w, row.id)
  const runtime = c9Runtime(w, { chains, control: occ.control })
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(occ.control, token)
  // The test HOLDS the shared runtime chain BEFORE the allow (the
  // reentry can only queue behind it).
  const hold = c9Barrier()
  let holdAcquiredResolve: (() => void) | undefined
  const holdAcquired = new Promise<void>((resolve) => {
    holdAcquiredResolve = resolve
  })
  const occupation = withTeamLock(chains, AUTHZ_ROOT, () => {
    holdAcquiredResolve?.()
    return hold.held
  })
  await withTimeout(holdAcquired, 15_000, 'the runtime-chain hold')
  const occupationChain = chains.get(AUTHZ_ROOT)
  if (occupationChain === undefined) throw new Error('c9: the occupation chain entry is missing')
  await c9Allow(occ.control, requestId)
  // The reentry is in flight: pin it on the runtime chain (proven by
  // the changed map entry — it passed the pre-dispatch checks with no
  // abort yet).
  await c9WaitQueued(chains, occupationChain)
  // The occupancy's allow parks at the external probe — holding (b)
  // NOW (before the hold release, so the reentry CANNOT reach the unit
  // before the (b) hold is established).
  await occ.create()
  const occupancyResolve = occ.startAllow()
  await withTimeout(occ.probePaused, 15_000, 'the control-lock hold (the occupancy probe)')
  // Release the hold: the reentry passes its chain post-wait check
  // (the signal is not aborted yet) and queues on (b) behind the
  // occupancy.
  hold.release()
  await sleep(60)
  if (row.preState === 'already-abandoned') {
    // The explicit abandon is FIRED (not awaited — (b) is held by the
    // occupancy; the abandon queues on (b) behind the unit, which
    // queued earlier). After the release the unit's check runs first
    // and persists the close; the abandon then rejects exactly-once
    // (tolerated — the mark is already durable).
    void occ.control
      .abandonControlRequest({
        rootSessionId: AUTHZ_ROOT,
        caller: authzHumanCaller(),
        requestId,
        reason: `c9 ${row.id}: abandon queued behind the occupancy`,
      })
      .catch((error: unknown) => {
        expect(isControlError(error) && error.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
      })
  }
  ac.abort()
  occ.releaseProbe()
  await withTimeout(occupancyResolve, 15_000, 'the occupancy resolution')
  await withTimeout(occupation, 15_000, 'the occupation settlement')
  const outcome = await started.promise
  await c9AssertClose(outcome, w, occ.control, requestId, memberBaseline, started.sessionInputCalls, true)
}

/** Cell 5 (RED both pre-states): the SECOND PREFLIGHT on the fresh
 *  activation — the abort lands in the pre-reservation window (the
 *  provider preflight awaits: authority.evaluate / the provider lock
 *  acquisition / the legacy external-facts probe — the P6-T2 v1 world
 *  exercises these three; the templateFacts await is v2-only). At
 *  a2b3df79 the reservation STILL RUNS (the member is created — the
 *  `MemberActivationRequest` carries no signal). Expected: the
 *  pre-reservation boundary persists the lock-free close (the unit
 *  holds (b) — no re-acquisition) and rejects with zero reservation /
 *  zero provisioning. */
async function c9PreFlight(
  row: MatrixRow,
  w: AuthzWorld,
  ac: AbortController,
  token: string,
  memberBaseline: number,
): Promise<void> {
  // The provider's pausable ports (indexed by call: the holder
  // activation A takes call #1 on each port, the row activation B
  // takes call #2 — the authority row has no holder, so B is call #1).
  const realEnv = w.world.ports.environmentFacts
  const realExt = w.world.ports.externalPolicyFacts
  const authorityBarrier = c9Barrier()
  const holderExtBarrier = c9Barrier()
  const bExtBarrier = c9Barrier()
  const providerEnvFacts = async () => {
    if (row.point === 'pre-flight-authority') {
      // B's authority probe (the only envFacts call on this row — no
      // holder) holds.
      authorityBarrier.pauseArrive()
      await authorityBarrier.held
    }
    return realEnv()
  }
  let extCall = 0
  const providerExternal = async () => {
    extCall++
    const isHolder = extCall === 1
    if (row.point === 'pre-flight-provider-lock') {
      if (isHolder) {
        // A holds the provider lock at its step-8 probe.
        holderExtBarrier.pauseArrive()
        await holderExtBarrier.held
      }
      return realExt()
    }
    if (row.point === 'pre-flight-external-facts') {
      if (isHolder) {
        // The holder A holds the provider lock at ITS OWN step-8 probe —
        // and RETURNS immediately after passing its own barrier (the
        // false-coverage correction: the old body fell through PAST its
        // own barrier into bExtBarrier — the holder (which should be
        // gone) occupied B's slot, and B was caught at checkpoint 3
        // instead of its externalFacts site — the row passed for the
        // wrong reason).
        holderExtBarrier.pauseArrive()
        await holderExtBarrier.held
        return realExt()
      }
      // B's OWN step-8 probe (call #2 — the holder took call #1 and
      // returned) holds: `bExtBarrier.paused` resolving is the
      // per-row SITE PROOF that B is actually parked at the intended
      // externalFacts site (a row that cannot prove it reached its
      // site is not green).
      bExtBarrier.pauseArrive()
      await bExtBarrier.held
    }
    return realExt()
  }
  const provider = createActivationProvider({
    teamDomain: w.world.domain,
    blueprintCatalog: w.world.catalog,
    environmentFacts: providerEnvFacts,
    externalPolicyFacts: providerExternal,
    staticModel: TEST_STATIC_MODEL,
    childSessionFactory: w.world.childFactory,
    sessionDurability: w.world.durability,
    surface: w.world.surface,
  })
  const runtime = c9Runtime(w, { provider })
  // The holder activation A (provider-lock / external-facts only): a
  // direct provider call with a synthetic recovery marker (the provider
  // admits the blocked team scope when the marker covers it — the
  // router's control-service verification is not the provider's). A is
  // a SCOUT (the authz world seeds no scout — template count 0, full
  // headroom to the per-template cap of 2): A must NOT exhaust the
  // worker template quota, or the row's activation B (a worker on the
  // create-member rows) would fail the quota check BEFORE the
  // pre-reservation window. A parks at its step-8 external probe —
  // holding the PROVIDER lock. A's own member (created on completion)
  // is part of the expected final member count for these rows.
  const hasHolder =
    row.point === 'pre-flight-provider-lock' || row.point === 'pre-flight-external-facts'
  if (hasHolder) {
    const holder = provider
      .activate({
        rootSessionId: AUTHZ_ROOT,
        source: 'leader-explicit',
        templateId: 'scout',
        label: `c9-${row.id}-holder`,
        requestToken: `tok-${row.id}-holder`,
        callerId: 'inst-leader',
        recovery: { scopeKeys: ['team'], unavailableSubjects: [] },
      })
      .catch(() => undefined) // A's outcome is irrelevant (it completes after the release)
    await withTimeout(holderExtBarrier.paused, 15_000, 'the holder activation holds the provider lock')
    void holder
  }
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(w.control, token)
  await c9Allow(w.control, requestId)
  // Pin B at the sub-point:
  if (row.point === 'pre-flight-authority') {
    await withTimeout(authorityBarrier.paused, 15_000, 'B is pinned at its authority probe')
  } else if (row.point === 'pre-flight-external-facts') {
    // The false-coverage-corrected choreography: the holder A is
    // released FIRST (it returns from its own barrier and completes its
    // activation — releasing the provider lock), and the abort is
    // gated on B's EXPLICIT "externalFacts ENTERED" event: bExtBarrier
    // is B's OWN step-8 probe (call #2 — the holder took call #1 and
    // returned), so `paused` resolving proves B is parked at the
    // intended site BEFORE `ac.abort` fires (an abort that fired first
    // — with B still in the provider queue — would catch B at
    // checkpoint 3, not its externalFacts site).
    holderExtBarrier.release()
    await withTimeout(bExtBarrier.paused, 15_000, 'B is ENTERED at its own step-8 external probe (site proof)')
  } else {
    // pre-flight-provider-lock: B progresses past its authority (real)
    // and QUEUES on the provider lock behind A (the hold is still
    // parked). A short settle lets B reach the lock queue
    // deterministically (every remaining step is a fast in-memory call;
    // B cannot pass the held lock before the release, which happens
    // AFTER the abort).
    await sleep(20)
  }
  if (row.preState === 'already-abandoned') {
    // The mark must land AFTER the unit's check (the unit passed — no
    // mark then) and before the reservation. The abandon is FIRED, not
    // awaited: the unit holds the control lock (b) while B is inside
    // the preflight, so an awaited abandon would deadlock on (b) until
    // the pin releases. After the release the boundary (the fixed
    // behavior) persists the close and rejects; the abandon then runs
    // and rejects exactly-once (tolerated — the mark is already
    // durable). At a2b3df79 (no boundary) the abandon simply lands
    // after the (unfixed) commit — the row's close assertions carry
    // the RED.
    void w.control
      .abandonControlRequest({
        rootSessionId: AUTHZ_ROOT,
        caller: authzHumanCaller(),
        requestId,
        reason: `c9 ${row.id}: abandon in the pre-reservation window`,
      })
      .catch((error: unknown) => {
        expect(isControlError(error) && error.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
      })
  }
  ac.abort()
  // Release the pins (B proceeds to the pre-reservation boundary).
  if (row.point === 'pre-flight-authority') {
    authorityBarrier.release()
  } else if (row.point === 'pre-flight-external-facts') {
    // B (parked at its own probe — the site proven above) proceeds to
    // checkpoint 4 (the pre-reservation boundary at the externalFacts
    // site) on the release.
    bExtBarrier.release()
  } else {
    holderExtBarrier.release()
  }
  const outcome = await started.promise
  // The expected member count includes the holder A's member (it
  // completes on the release — a choreography side effect, not the
  // row's effect); B's member is the violation the fixed boundary
  // prevents.
  await c9AssertClose(
    outcome,
    w,
    w.control,
    requestId,
    memberBaseline + (hasHolder ? 1 : 0),
    started.sessionInputCalls,
    true,
  )
}

/** Cell 6 (GREEN): the commit has ALREADY LANDED (the Phase A work
 *  admission / the staged activation) when the abort fires (during the
 *  live delivery). The committed effect STANDS (no retroactive undo),
 *  the fail-closed settle runs WITHOUT the signal (N6/H4), the typed
 *  WORK_DELIVERY_FAILED surfaces, and NO abandon mark is written (the
 *  committed effect is never re-marked). */
async function c9PostCommit(
  row: MatrixRow,
  w: AuthzWorld,
  ac: AbortController,
  token: string,
  memberBaseline: number,
): Promise<void> {
  const realDelivery = w.deliveryPort
  const barrier = c9Barrier()
  let pauseNext = false
  const deliveryCalls: unknown[] = []
  const pausableDelivery: WorkDeliveryPort = {
    async deliver(args) {
      deliveryCalls.push(args)
      if (pauseNext) {
        pauseNext = false
        barrier.pauseArrive()
        await barrier.held
        if (args.signal !== undefined && (args.signal as { aborted: boolean }).aborted) {
          // The live delivery honors the cancellation.
          const reason =
            args.signal !== undefined
              ? (args.signal as { reason?: unknown }).reason
              : undefined
          throw new Error(`c9 ${row.id}: the live delivery aborted (reason: ${String(reason ?? 'aborted')})`)
        }
      }
      return realDelivery.deliver(args)
    },
  }
  const runtime = c9Runtime(w, { delivery: pausableDelivery })
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(w.control, token)
  await c9Allow(w.control, requestId)
  pauseNext = true
  await withTimeout(barrier.paused, 15_000, 'the live-delivery barrier hold (the Phase A commit has landed)')
  // The commit evidence (BEFORE the abort): the Phase A admission fact.
  expect(authzFacts(w.world, 'team-work-admitted').length).toBe(1)
  ac.abort()
  barrier.release()
  const outcome = await started.promise
  expect(outcome.ok).toBe(false)
  const error = outcome.ok === false ? outcome.error : undefined
  expect((error as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED)
  // The committed effect STANDS — no retroactive undo.
  expect(authzFacts(w.world, 'team-work-admitted').length).toBe(1)
  // No re-mark: the committed effect is never abandoned retroactively.
  const state = await w.control.listControlState(AUTHZ_ROOT)
  expect(state.abandonments.filter((a) => a.requestId === requestId).length).toBe(0)
  expect(state.requests.find((r) => r.requestId === requestId)?.status).toBe('decided')
  if (row.action === 'delegate') {
    // The staged activation (the scout member) is a committed write too.
    expect(w.world.domain.repositories.memberInstances.list(AUTHZ_ROOT).length).toBe(memberBaseline + 1)
  }
  void deliveryCalls
}

/** Persist-fault leg 1 (GREEN baseline — the verified contract): the
 *  admission close itself faults (the C8 control-queue shape + the
 *  abandon-only persist fault). The unit's close persist fault types
 *  through the service's durableFailure mapping →
 *  TEAM_RUNTIME_DURABLE_WRITE_FAILED (fail-closed — the effect NEVER
 *  commits, no half-abandoned mark). Must STAY green after the fix
 *  (the settlement's persist retry takes the same typed path). */
async function c9FaultAdmission(
  row: MatrixRow,
  w: AuthzWorld,
  ac: AbortController,
  token: string,
  memberBaseline: number,
): Promise<void> {
  const realEnvFacts = w.world.ports.environmentFacts
  const reprobeBarrier = c9Barrier()
  let pauseNextReprobe = false
  const pausableEnvFacts: typeof realEnvFacts = () => {
    if (pauseNextReprobe) {
      pauseNextReprobe = false
      reprobeBarrier.pauseArrive()
      return reprobeBarrier.held.then(() => realEnvFacts())
    }
    return realEnvFacts()
  }
  const occ = c9Occupancy(w, row.id)
  const runtime = c9Runtime(w, { envFacts: pausableEnvFacts, control: occ.control })
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(occ.control, token)
  await occ.create()
  const restoreFault = c9PatchAbandonPersistFault(w)
  try {
    await c9Allow(occ.control, requestId)
    pauseNextReprobe = true
    await withTimeout(reprobeBarrier.paused, 15_000, 'the re-probe barrier hold')
    const occupancyResolve = occ.startAllow()
    await withTimeout(occ.probePaused, 15_000, 'the control-lock hold')
    reprobeBarrier.release()
    await sleep(60)
    ac.abort()
    occ.releaseProbe()
    await withTimeout(occupancyResolve, 15_000, 'the occupancy resolution')
    const outcome = await started.promise
    await c9AssertFault(outcome, w, occ.control, requestId, memberBaseline)
  } finally {
    restoreFault()
  }
}

/** Persist-fault leg 2 (RED at a2b3df79): the SECOND-PREFLIGHT close
 *  faults (the authority pin + the abandon-only persist fault). At
 *  a2b3df79 there is no boundary — the reservation runs (the member is
 *  created). Expected: the boundary's lock-free close persist faults →
 *  the settlement maps it to TEAM_RUNTIME_DURABLE_WRITE_FAILED with
 *  ZERO reservation. */
async function c9FaultPreflight(
  row: MatrixRow,
  w: AuthzWorld,
  ac: AbortController,
  token: string,
  memberBaseline: number,
): Promise<void> {
  const realEnv = w.world.ports.environmentFacts
  const authorityBarrier = c9Barrier()
  const providerEnvFacts = async () => {
    authorityBarrier.pauseArrive()
    await authorityBarrier.held
    return realEnv()
  }
  const provider = createActivationProvider({
    teamDomain: w.world.domain,
    blueprintCatalog: w.world.catalog,
    environmentFacts: providerEnvFacts,
    externalPolicyFacts: w.world.ports.externalPolicyFacts,
    staticModel: TEST_STATIC_MODEL,
    childSessionFactory: w.world.childFactory,
    sessionDurability: w.world.durability,
    surface: w.world.surface,
  })
  const runtime = c9Runtime(w, { provider })
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(w.control, token)
  const restoreFault = c9PatchAbandonPersistFault(w)
  try {
    await c9Allow(w.control, requestId)
    await withTimeout(authorityBarrier.paused, 15_000, 'B is pinned at its authority probe')
    ac.abort()
    authorityBarrier.release()
    const outcome = await started.promise
    await c9AssertFault(outcome, w, w.control, requestId, memberBaseline)
  } finally {
    restoreFault()
  }
}

// =====================================================================
// C9 residual-3 — the pre-reservation REJECT region (RED-first, frozen
// scope): the provider's pre-reservation awaits REJECT while the
// invocation's signal is ALREADY ABORTED. At bae0a7ae the raw rejection
// escapes BEFORE any boundary settle (the check points cover only the
// FULFILLMENT case; the router's `effectCommitStarted` flips at
// PROVIDER ENTRY — router.ts L817 — disabling the outer pre-commit
// settle) → ZERO durable close, the request left `decided` on the raw
// probe error. The fix converges the WHOLE pre-reservation region (any
// reject / validation throw — strictly before journal.allocate) onto
// the same settle when the signal is aborted (the durable close + the
// typed zero-provisioning abort); a close persist fault escapes AS-IS —
// the first close failure is the terminal outcome, NEVER re-attempted.
//
// Rows (pure additions — the 60-row matrix, c9-serial and C1–C8 are
// untouched): c9-r3-1 (v2 templateFeed REJECT — its intended
// templateFacts site), c9-r3-2 (legacy externalFacts REJECT — the
// step-8 externalFacts site), c9-r3-3 (the one-shot close-failure on
// the reject path — the FIRST fault propagates unchanged, exactly one
// close attempt). Site proof on every row: the target B's ENTERED
// event at the intended port BEFORE the abort fires (a row that cannot
// prove it reached its site is not green, however the counters read).
// =====================================================================

/** The v2 variant of the P6-T2 fixture blueprint (residual-3 row
 *  c9-r3-1): the SAME world at schemaVersion 2 with the worker
 *  template's structured requirement (`complete: true` — structurally
 *  satisfied, NEVER fatal — the v2 closed requirement fields carry no
 *  `optional`). The worker requirement makes the v2 target-template
 *  scope feed live (`scopeRequirementInputsOf` populates
 *  `templates['worker']` → `targetTemplateInputs` present → the
 *  `templateEnvironmentFactsForBlueprint` await exists in the
 *  provider's preflight); the team scope stays compat-blocked
 *  (skill/base down — the v1 flat `requirements` list, legal in v2
 *  documents). */
const P6T2_V2_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 2',
  'blueprintId: P6T2-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P6T2 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P6T2 work.',
  '    requirements:',
  '      - requirementId: worker-mcp-base',
  '        type: mcpServer',
  '        subjects:',
  '          - test-mcp-worker',
  '        complete: true',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P6T2 team.',
  '    contextPolicy: fresh_per_delegation',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  '  - templateId: scout',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P6T2 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
].join('\n')

/** The ONE-SHOT abandon-persist fault (residual-3 defect c): the
 *  `control-request-abandoned` put FAILS EXACTLY ONCE (the first close
 *  attempt). A SECOND attempt (the retry the fix must never make — the
 *  D2 router catch re-entering the unit's close) would SUCCEED and MASK
 *  the first fault as a settled close. The attempt counter pins "the
 *  first failed write is not represented as success": attempts > 1 = a
 *  retry happened. */
function c9PatchAbandonPersistOneShotFault(
  w: AuthzWorld,
): { restore: () => void; attempts: () => number } {
  const ledger = w.world.domain.repositories.ledger
  const realPut = ledger.put.bind(ledger)
  let first = true
  let attemptCount = 0
  ledger.put = (entry: unknown) => {
    if (
      entry !== null &&
      typeof entry === 'object' &&
      'factType' in entry &&
      (entry as { readonly factType?: unknown }).factType === 'control-request-abandoned'
    ) {
      attemptCount++
      if (first) {
        first = false
        throw new Error('c9 residual-3: the durable close write faulted (one-shot injected)')
      }
    }
    return realPut(entry)
  }
  return {
    restore: (): void => {
      ledger.put = realPut
    },
    attempts: () => attemptCount,
  }
}

/** The provider-ports type (the C9RuntimeOptions pattern — no
 *  duplicated port typings). */
type C9ProviderPorts = Parameters<typeof createActivationProvider>[0]

/** The shared residual-3 reject-row runner: fresh create-member (B)
 *  over a provider whose step-8 external-policy-facts probe parks at
 *  the barrier (the ENTERED site proof) and REJECTS on the release —
 *  while the signal is ALREADY aborted. `oneShot` swaps in the
 *  one-shot abandon-persist fault (c9-r3-3) with its dedicated
 *  first-fault-propagates-unchanged assertions. */
async function c9R3ExternalFactsReject(rowId: string, oneShot: boolean): Promise<void> {
  const w = await createAuthzWorld(`authz-${rowId}`)
  world = w
  const memberBaseline = w.world.domain.repositories.memberInstances.list(AUTHZ_ROOT).length
  const realExt = w.world.ports.externalPolicyFacts
  const probeBarrier = c9Barrier()
  let extCall = 0
  const providerExternal = async () => {
    extCall++
    // B's OWN step-8 probe (call #1 — no holder on the reject rows):
    // park at the site, then REJECT on the release (the await rejects
    // while the signal is ALREADY aborted — the pre-reservation reject
    // path the success-path check points never cover).
    if (extCall === 1) {
      probeBarrier.pauseArrive()
      await probeBarrier.held
      throw new Error(`c9 ${rowId}: the external-policy-facts port rejected (residual-3 reject variant)`)
    }
    return realExt()
  }
  const provider = createActivationProvider({
    teamDomain: w.world.domain,
    blueprintCatalog: w.world.catalog,
    environmentFacts: w.world.ports.environmentFacts,
    externalPolicyFacts: providerExternal,
    staticModel: TEST_STATIC_MODEL,
    childSessionFactory: w.world.childFactory,
    sessionDurability: w.world.durability,
    surface: w.world.surface,
  })
  const runtime = c9Runtime(w, { provider })
  const ac = new AbortController()
  const token = `tok-${rowId}`
  const row: MatrixRow = {
    id: rowId,
    action: 'create-member',
    point: 'pre-flight-external-facts-reject',
    preState: 'no-mark',
  }
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(w.control, token)
  await c9Allow(w.control, requestId)
  // SITE PROOF: B is ENTERED at its own step-8 external probe BEFORE
  // the abort fires (the reject row's site — the await that rejects).
  await withTimeout(probeBarrier.paused, 15_000, 'B is ENTERED at its own step-8 external probe (site proof)')
  ac.abort()
  const oneShotFault = oneShot ? c9PatchAbandonPersistOneShotFault(w) : undefined
  try {
    // Release → the probe REJECTS while the signal is already aborted.
    probeBarrier.release()
    const outcome = await started.promise
    if (oneShotFault === undefined) {
      await c9AssertClose(outcome, w, w.control, requestId, memberBaseline, started.sessionInputCalls, true)
    } else {
      // The ONE-SHOT CLOSE-FAILURE assertions (residual-3 defect c):
      // the FIRST close fault propagates UNCHANGED (the typed
      // DURABLE_WRITE_FAILED carrying the injected error text — not a
      // second-attempt success, not a reclassified code), ZERO
      // effects, ZERO marks (the put failed — the state could not be
      // made terminal), and EXACTLY ONE abandon put attempt (a second
      // attempt = the retry that would mask the first fault).
      expect(outcome.ok).toBe(false)
      const error = outcome.ok === false ? outcome.error : undefined
      expect((error as { code?: string } | undefined)?.code).toBe(
        TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED,
      )
      expect(String((error as { message?: unknown } | undefined)?.message ?? '')).toContain(
        'c9 residual-3: the durable close write faulted (one-shot injected)',
      )
      expect(authzFacts(w.world, 'team-work-admitted').length).toBe(0)
      expect(w.deliveryCalls.length).toBe(0)
      expect(authzFacts(w.world, 'team-coordination-recorded').length).toBe(0)
      expect(w.world.domain.repositories.memberInstances.list(AUTHZ_ROOT).length).toBe(memberBaseline)
      const state = await w.control.listControlState(AUTHZ_ROOT)
      expect(state.abandonments.filter((a) => a.requestId === requestId).length).toBe(0)
      expect(oneShotFault.attempts()).toBe(1)
    }
  } finally {
    oneShotFault?.restore()
  }
}

/** The residual-3 v2 row: fresh create-member (B) over the v2
 *  compat-blocked world, with the provider's `templateEnvironmentFactsForBlueprint`
 *  feed port parked at the barrier (the ENTERED site proof) and
 *  REJECTING on the release — while the signal is ALREADY aborted (the
 *  v2 templateFacts await rejects; check point 2 — placed for the
 *  FULFILLMENT case — is jumped over on the reject path). */
async function c9R3TemplateFeedReject(rowId: string): Promise<void> {
  const w = await createAuthzWorld(`authz-${rowId}`, ['leader', 'worker'], {
    blueprintSource: P6T2_V2_BLUEPRINT_SOURCE,
  })
  world = w
  const memberBaseline = w.world.domain.repositories.memberInstances.list(AUTHZ_ROOT).length
  const feedBarrier = c9Barrier()
  let feedCall = 0
  const providerFeed: C9ProviderPorts['templateEnvironmentFactsForBlueprint'] = async (
    blueprint,
    templateId,
  ) => {
    feedCall++
    // B's template-scope feed (call #1 — no holder): park at the site,
    // then REJECT on the release.
    if (feedCall === 1) {
      feedBarrier.pauseArrive()
      await feedBarrier.held
      throw new Error(
        `c9 ${rowId}: the template-facts port (blueprint '${blueprint.blueprintId}', template '${templateId}') rejected (residual-3 v2 reject variant)`,
      )
    }
    return w.world.ports.environmentFacts()
  }
  const provider = createActivationProvider({
    teamDomain: w.world.domain,
    blueprintCatalog: w.world.catalog,
    environmentFacts: w.world.ports.environmentFacts,
    externalPolicyFacts: w.world.ports.externalPolicyFacts,
    staticModel: TEST_STATIC_MODEL,
    childSessionFactory: w.world.childFactory,
    sessionDurability: w.world.durability,
    surface: w.world.surface,
    templateEnvironmentFactsForBlueprint: providerFeed,
  })
  const runtime = c9Runtime(w, { provider })
  const ac = new AbortController()
  const token = `tok-${rowId}`
  const row: MatrixRow = {
    id: rowId,
    action: 'create-member',
    point: 'pre-flight-template-feed-reject',
    preState: 'no-mark',
  }
  const started = c9Start(runtime, row, token, ac.signal)
  const requestId = await c9WaitRow(w.control, token)
  await c9Allow(w.control, requestId)
  // SITE PROOF: B is ENTERED at the v2 templateFacts feed await BEFORE
  // the abort fires (the intended templateFacts site).
  await withTimeout(feedBarrier.paused, 15_000, 'B is ENTERED at the v2 templateFacts feed await (site proof)')
  ac.abort()
  // Release → the feed REJECTS while the signal is already aborted.
  feedBarrier.release()
  const outcome = await started.promise
  await c9AssertClose(outcome, w, w.control, requestId, memberBaseline, started.sessionInputCalls, true)
}

describe('fix-control-authz C9 residual-3: the pre-reservation REJECT region', () => {
  it('c9-r3-1: v2 templateFeed — park at B\'s templateFacts feed await (ENTERED proven), abort, the feed REJECTS: the pre-reservation reject converges to the durable close (zero provisioning, exactly one mark, the typed abandon terminal)', async () => {
    await c9R3TemplateFeedReject('c9-r3-1')
  })
  it('c9-r3-2: legacy externalFacts — park at B\'s step-8 probe (ENTERED proven), abort, the probe REJECTS: the pre-reservation reject converges to the durable close (zero provisioning, exactly one mark, the typed abandon terminal)', async () => {
    await c9R3ExternalFactsReject('c9-r3-2', false)
  })
  it('c9-r3-3: one-shot close-failure on the reject path — the FIRST close fault propagates UNCHANGED (typed DURABLE_WRITE_FAILED carrying the injected error), zero effects, zero marks, EXACTLY ONE abandon put attempt (never re-attempted — a second attempt would succeed and mask the fault)', async () => {
    await c9R3ExternalFactsReject('c9-r3-3', true)
  })
})
