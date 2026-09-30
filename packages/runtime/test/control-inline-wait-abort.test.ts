/**
 * pre-alpha3 PR-D, D.4 — the COUPLING-AWARE wait-abort cascade in
 * `awaitControlDecision` (the round-2 review major: "C4 does not verify
 * disconnect causes durable abandonment" — the round-2 kit asserted a
 * disconnected request stays PENDING and abandoned a SEPARATE request;
 * the adjudicated fix verifies the SAME request is durably abandoned by
 * the disconnect itself).
 *
 * The inline lifecycle (plan §D.4):
 * `request → wait → decision; allow → frozen invocation continue;
 * deny → zero effect; abort → durable abandon/close → zero effect`.
 * An INLINE request's frozen invocation IS the waiter — when the
 * caller's signal aborts (the client disconnected, the invocation died),
 * a PENDING row would be a zombie no resolver can ever service (a retry
 * is a NEW request), so the bridge durably records the additive close
 * fact `control-request-abandoned` (reason `wait-aborted`) FIRST —
 * through the SAME terminal-mark write path `abandonControlRequest`
 * uses (exactly-once, the terminal-mark shape, and the storage-fault
 * contract are inherited by code reuse) — and only then settles the
 * waiter with the typed CONTROL_WAIT_ABORTED (the message adjusted: the
 * request is now durably ABANDONED, not "still durable and undecided").
 *
 * Coupling gating: the cascade fires ONLY for a STORED executionCoupling
 * of exactly `inline`. A `guarded` request and an ABSENT (legacy) row
 * keep TODAY's zero-side-effect abort byte-for-byte (the request stays
 * PENDING — the guarded lifecycle keeps its
 * `request → wait → decision → guard → consume → execute` line; pinned
 * here in S4/S5 and by a4a W2 / a5a S10–S14).
 *
 * Cascade idempotency: an already-terminal request (a durable decision
 * won the race between the last poll and the signal, or a concurrent
 * abandon landed first) gets NO second terminal mark — a durable
 * decision RESOLVES the wait with itself (the first decision is
 * authoritative); the already-abandoned request settles rejected typed.
 *
 * Scenarios:
 * S1: INLINE + mid-wait abort → the SAME request is durably ABANDONED
 *     (one `control-request-abandoned` fact, reason `wait-aborted`),
 *     the waiter is rejected CONTROL_WAIT_ABORTED with the adjusted
 *     ABANDONED message, and the derived status is `abandoned`.
 * S2: INLINE + PRE-aborted signal (the wait begins already aborted) →
 *     the same cascade (the pre-abort branch, not just the timer path).
 * S3: exactly-once + zero effect AFTER the cascade: the explicit
 *     `abandonControlRequest` is rejected CONTROL_REQUEST_ABANDONED
 *     (the terminal mark is already durable — no second fact), the late
 *     human allow is rejected with zero durable effect (no decision
 *     fact), and the last-mile guard blocks with `request-abandoned`
 *     (zero execution, zero consumption).
 * S4: GUARDED + mid-wait abort → TODAY's behavior EXACTLY: the request
 *     stays PENDING (zero abandon facts), the waiter is rejected with
 *     the legacy message, and a later resolve allow still works.
 * S5: LEGACY (coupling ABSENT) + mid-wait abort → TODAY's behavior
 *     EXACTLY (the production ask lane is legacy-shaped until the
 *     inline generalization lands; a4a W2's contract).
 * S6: the race — a durable decision wins between the last poll and the
 *     signal → the wait RESOLVES with the decision (the first decision
 *     is authoritative), NO abandon fact is written, the status is
 *     `decided`.
 * S7: the storage-fault contract through the SAME write path — the
 *     cascade's durable write fails → the wait is rejected with the
 *     facade's typed TEAM_RUNTIME_DURABLE_WRITE_FAILED (never a
 *     half-abandoned claim), ZERO abandon facts are written, the
 *     request is still PENDING, and a later resolve allow still works.
 *
 * Test pattern of this repo (the plain-node shim's `it` is
 * synchronous): every async scenario runs at MODULE level (top-level
 * await, the p6t1/p6t2 pattern) and captures its results; the `it`
 * bodies are pure synchronous assertions over the captured values.
 *
 * Matchers: toBe/toEqual (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/control-inline-wait-abort
 */

import { describe, expect, it } from 'vitest'

import {
  CONTROL_ERROR_CODES,
  CONTROL_EXECUTION_COUPLINGS,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../control/index.js'
import type { ControlDecisionRecord, ControlService } from '../control/index.js'
import {
  TEAM_RUNTIME_ERROR_CODES,
  isTeamRuntimeError,
} from '../admission/index.js'
import type { TeamRuntimeError } from '../admission/index.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createFakeToolPipeline,
  createP6T4World,
  destroyP6T1World,
  expectControlRejection,
  humanCaller,
  memberCaller,
} from './p6t4-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/** The structural shape of the guard verdict the assertions need (the
 *  service type is a discriminated union; the captured value is plain). */
type CapturedVerdict = {
  readonly allowed: boolean
  readonly requestId?: string
  readonly reason?: string
  readonly decisionSequence?: number
}

/** The sleep used to let the wait bridge observe the abort / the
 *  decision (the module pattern of the wait-bridge suites). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * The wait-bridge service with the fast test poll cadence (5 ms — the
 * a4a wait-bridge pattern; the waiter is liveness-only, the durable
 * read is a cheap in-process ledger scan).
 */
function createWaitService(world: P6T1World): ControlService {
  return createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 5,
  })
}

/** Create one PENDING request (the inline user-approval shape of the
 *  companion control-inline-abandon suite). `coupling` is the STORED
 *  executionCoupling — pass `undefined` for the LEGACY shape (the field
 *  stays absent from the durable payload). */
async function createRequest(
  service: ControlService,
  correlation: string,
  coupling: typeof CONTROL_EXECUTION_COUPLINGS.INLINE | typeof CONTROL_EXECUTION_COUPLINGS.GUARDED | undefined,
) {
  return service.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
    targetInstanceId: WORKER_ID,
    actionName: 'write-file',
    toolName: 'fs.write',
    correlation,
    ...(coupling !== undefined
      ? { executionCoupling: coupling }
      : {}),
  })
}

/** Capture one outcome of an async call (never rejects the module). */
async function capture(fn: () => Promise<unknown>): Promise<
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown }
> {
  try {
    return { ok: true, value: await fn() }
  } catch (error) {
    return { ok: false, error }
  }
}

// --- scenario 1: INLINE + mid-wait abort → the SAME request is durably abandoned --------
let s1: {
  readonly requestId: string
  readonly waitCode: string
  readonly waitMessage: string
  readonly abandonFacts: number
  readonly abandonReason: string | undefined
  readonly requestFacts: number
  readonly decisionFacts: number
  readonly requestStatus: string
}
{
  const world = await createP6T4World('ctl-iwa-1', ['leader', 'worker'])
  try {
    const service = createWaitService(world)
    const request = await createRequest(service, 'corr-iwa-1', CONTROL_EXECUTION_COUPLINGS.INLINE)
    const ac = new AbortController()
    const waitP = service.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: request.requestId,
      signal: ac.signal,
    })
    await sleep(12)
    ac.abort()
    const rejected = await expectControlRejection(
      () => waitP,
      CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED,
    )
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests.find((r) => r.requestId === request.requestId)
    const abandonment = state.abandonments.find((a) => a.requestId === request.requestId)
    s1 = {
      requestId: request.requestId,
      waitCode: rejected.code,
      waitMessage: rejected.error.message,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
      abandonReason: abandonment?.reason,
      requestFacts: controlFacts(world, 'control-request-recorded').length,
      decisionFacts: controlFacts(world, 'control-decision-recorded').length,
      requestStatus: record?.status ?? 'missing',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: INLINE + pre-aborted signal (the pre-abort branch) ----------------------
let s2: {
  readonly requestId: string
  readonly waitCode: string
  readonly waitMessage: string
  readonly abandonFacts: number
  readonly abandonReason: string | undefined
  readonly requestStatus: string
}
{
  const world = await createP6T4World('ctl-iwa-2', ['leader', 'worker'])
  try {
    const service = createWaitService(world)
    const request = await createRequest(service, 'corr-iwa-2', CONTROL_EXECUTION_COUPLINGS.INLINE)
    const preAborted = new AbortController()
    preAborted.abort()
    const rejected = await expectControlRejection(
      () =>
        service.awaitControlDecision({
          rootSessionId: P6T4_ROOT,
          requestId: request.requestId,
          signal: preAborted.signal,
        }),
      CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED,
    )
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests.find((r) => r.requestId === request.requestId)
    const abandonment = state.abandonments.find((a) => a.requestId === request.requestId)
    s2 = {
      requestId: request.requestId,
      waitCode: rejected.code,
      waitMessage: rejected.error.message,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
      abandonReason: abandonment?.reason,
      requestStatus: record?.status ?? 'missing',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: exactly-once + zero effect after the cascade ----------------------------
let s3: {
  readonly explicitAbandonCode: string
  readonly lateAllowCode: string
  readonly verdict: CapturedVerdict
  readonly executed: number
  readonly abandonFacts: number
  readonly decisionFacts: number
  readonly consumptionFacts: number
  readonly requestStatus: string
}
{
  const world = await createP6T4World('ctl-iwa-3', ['leader', 'worker'])
  try {
    const service = createWaitService(world)
    const pipeline = createFakeToolPipeline(service)
    const request = await createRequest(service, 'corr-iwa-3', CONTROL_EXECUTION_COUPLINGS.INLINE)
    const ac = new AbortController()
    const waitP = service.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: request.requestId,
      signal: ac.signal,
    })
    await sleep(12)
    ac.abort()
    await expectControlRejection(
      () => waitP,
      CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED,
    )
    // The explicit follow-up abandon: the terminal mark is ALREADY
    // durable (the cascade wrote it) — exactly-once rejects it.
    const explicitAbandon = await expectControlRejection(
      () =>
        service.abandonControlRequest({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(WORKER_ID),
          requestId: request.requestId,
          reason: 'explicit follow-up after the cascade',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
    )
    // The late human allow: the terminal mark wins (zero durable side
    // effects — no decision row is written).
    const lateAllow = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: humanCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
    )
    // The last-mile guard: the abandoned request cannot execute the
    // operation (zero effect, nothing consumed).
    const scope = {
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-iwa-3',
    }
    const verdict = await service.guardOperation(scope)
    const attempt = await pipeline.execute(scope)
    const state = await service.listControlState(P6T4_ROOT)
    s3 = {
      explicitAbandonCode: explicitAbandon.code,
      lateAllowCode: lateAllow.code,
      verdict,
      executed: attempt.allowed ? 1 : 0,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
      decisionFacts: controlFacts(world, 'control-decision-recorded').length,
      consumptionFacts: controlFacts(world, 'control-allow-consumed').length,
      requestStatus:
        state.requests.find((r) => r.requestId === request.requestId)?.status ?? 'missing',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 4: GUARDED + mid-wait abort → TODAY's zero-side-effect behavior EXACTLY ----
let s4: {
  readonly requestId: string
  readonly waitCode: string
  readonly waitMessage: string
  readonly abandonFacts: number
  readonly statusAfterAbort: string
  readonly laterResolveOk: boolean
  readonly statusAfterResolve: string
  readonly decisionFacts: number
}
{
  const world = await createP6T4World('ctl-iwa-4', ['leader', 'worker'])
  try {
    const service = createWaitService(world)
    const request = await createRequest(service, 'corr-iwa-4', CONTROL_EXECUTION_COUPLINGS.GUARDED)
    const ac = new AbortController()
    const waitP = service.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: request.requestId,
      signal: ac.signal,
    })
    await sleep(12)
    ac.abort()
    const rejected = await expectControlRejection(
      () => waitP,
      CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED,
    )
    const stateAfterAbort = await service.listControlState(P6T4_ROOT)
    // The guarded request stays PENDING — a later resolve still works
    // (the abort was a pure cancellation, the recovery paths intact).
    const laterResolve = await capture(() =>
      service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller(),
        requestId: request.requestId,
        decision: 'allow',
      }),
    )
    const state = await service.listControlState(P6T4_ROOT)
    s4 = {
      requestId: request.requestId,
      waitCode: rejected.code,
      waitMessage: rejected.error.message,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
      statusAfterAbort:
        stateAfterAbort.requests.find((r) => r.requestId === request.requestId)?.status ?? 'missing',
      laterResolveOk: laterResolve.ok,
      statusAfterResolve:
        state.requests.find((r) => r.requestId === request.requestId)?.status ?? 'missing',
      decisionFacts: controlFacts(world, 'control-decision-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 5: LEGACY (coupling ABSENT) + mid-wait abort → TODAY's behavior EXACTLY ----
let s5: {
  readonly requestId: string
  readonly waitCode: string
  readonly waitMessage: string
  readonly abandonFacts: number
  readonly statusAfterAbort: string
  readonly laterResolveOk: boolean
  readonly statusAfterResolve: string
}
{
  const world = await createP6T4World('ctl-iwa-5', ['leader', 'worker'])
  try {
    const service = createWaitService(world)
    const request = await createRequest(service, 'corr-iwa-5', undefined)
    const ac = new AbortController()
    const waitP = service.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: request.requestId,
      signal: ac.signal,
    })
    await sleep(12)
    ac.abort()
    const rejected = await expectControlRejection(
      () => waitP,
      CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED,
    )
    const stateAfterAbort = await service.listControlState(P6T4_ROOT)
    const laterResolve = await capture(() =>
      service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller(),
        requestId: request.requestId,
        decision: 'allow',
      }),
    )
    const state = await service.listControlState(P6T4_ROOT)
    s5 = {
      requestId: request.requestId,
      waitCode: rejected.code,
      waitMessage: rejected.error.message,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
      statusAfterAbort:
        stateAfterAbort.requests.find((r) => r.requestId === request.requestId)?.status ?? 'missing',
      laterResolveOk: laterResolve.ok,
      statusAfterResolve:
        state.requests.find((r) => r.requestId === request.requestId)?.status ?? 'missing',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 6: the race — a durable decision wins before the signal --------------------
let s6: {
  readonly resolved: boolean
  readonly decision: ControlDecisionRecord | undefined
  readonly abandonFacts: number
  readonly requestStatus: string
}
{
  const world = await createP6T4World('ctl-iwa-6', ['leader', 'worker'])
  try {
    const service = createWaitService(world)
    const request = await createRequest(service, 'corr-iwa-6', CONTROL_EXECUTION_COUPLINGS.INLINE)
    const ac = new AbortController()
    const waitP = service.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: request.requestId,
      signal: ac.signal,
    })
    // The human durably allows (the decision is durable well before the
    // abort fires — the race the cascade must not clobber).
    await sleep(12)
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    // Give the poll one full cadence to observe the decision, THEN
    // abort — whatever settle won, the abort must not write a second
    // terminal mark over the durable decision.
    await sleep(20)
    ac.abort()
    const result = await capture(() => waitP)
    const value = result.ok === true ? result.value : undefined
    const isDecisionRecord =
      value !== undefined &&
      typeof value === 'object' &&
      value !== null &&
      typeof (value as Record<string, unknown>)['decision'] === 'string'
    const decision = isDecisionRecord ? { ...(value as ControlDecisionRecord) } : undefined
    const state = await service.listControlState(P6T4_ROOT)
    s6 = {
      resolved: result.ok === true,
      decision,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
      requestStatus:
        state.requests.find((r) => r.requestId === request.requestId)?.status ?? 'missing',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 7: the storage-fault contract through the SAME write path ------------------
let s7: {
  readonly rejected: boolean
  readonly isDurableWriteFailed: boolean
  readonly abandonFacts: number
  readonly statusAfterFault: string
  readonly laterResolveOk: boolean
  readonly statusAfterResolve: string
}
{
  const world = await createP6T4World('ctl-iwa-7', ['leader', 'worker'])
  try {
    const service = createWaitService(world)
    const request = await createRequest(service, 'corr-iwa-7', CONTROL_EXECUTION_COUPLINGS.INLINE)
    // Fault injection: the sequence allocation step of the cascade's
    // durable write fails (the service holds the same repositories
    // object — the patched method is what the shared terminal-mark
    // write path calls).
    const ledger = world.domain.repositories.ledger
    const originalAllocate = ledger.allocateSequence.bind(ledger)
    ledger.allocateSequence = async () => {
      throw new Error('injected: the ledger sequence allocation failed')
    }
    const ac = new AbortController()
    const waitP = service.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: request.requestId,
      signal: ac.signal,
    })
    await sleep(12)
    let faultResult:
      | { readonly ok: true; readonly value: unknown }
      | { readonly ok: false; readonly error: unknown }
    try {
      ac.abort()
      faultResult = await capture(() => waitP)
    } finally {
      ledger.allocateSequence = originalAllocate
    }
    // The failed cascade must not claim the terminal mark: the request
    // is STILL PENDING after the faulted abort ...
    const stateAfterFault = await service.listControlState(P6T4_ROOT)
    // ... and is still resolvable later (the failed cascade neither
    // consumed nor closed it).
    const laterResolve = await capture(() =>
      service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller(),
        requestId: request.requestId,
        decision: 'allow',
      }),
    )
    const state = await service.listControlState(P6T4_ROOT)
    const error = faultResult.ok === false ? faultResult.error : undefined
    s7 = {
      rejected: faultResult.ok === false,
      isDurableWriteFailed:
        error !== undefined &&
        isTeamRuntimeError(error) &&
        (error as TeamRuntimeError).code === TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
      statusAfterFault:
        stateAfterFault.requests.find((r) => r.requestId === request.requestId)?.status ?? 'missing',
      laterResolveOk: laterResolve.ok,
      statusAfterResolve:
        state.requests.find((r) => r.requestId === request.requestId)?.status ?? 'missing',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('pre-alpha3 PR-D D.4 — the coupling-aware wait-abort cascade (the inline lifecycle abort node)', () => {
  it('S1: INLINE + mid-wait abort → the SAME request is durably ABANDONED — typed wait-abort with the adjusted ABANDONED message', () => {
    expect(s1.waitCode).toBe(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED)
    // The message is the ADJUSTED one (the request is now durably
    // abandoned, not "still durable and undecided").
    expect(s1.waitMessage).toBe(
      `ControlService: awaitControlDecision for request '${s1.requestId}' was aborted before a durable decision appeared (the INLINE request is durably ABANDONED — the additive close fact 'control-request-abandoned' is the terminal mark; the frozen invocation is dead and a retry is a NEW request)`,
    )
  })

  it('S1: the durable close — one abandon fact (reason wait-aborted), the request row NOT removed, zero decision facts, status derived abandoned', () => {
    expect(s1.abandonFacts).toBe(1)
    expect(s1.abandonReason).toBe('wait-aborted')
    // The request row is never physically removed (append-only ledger).
    expect(s1.requestFacts).toBe(1)
    expect(s1.decisionFacts).toBe(0)
    expect(s1.requestStatus).toBe('abandoned')
  })

  it('S2: INLINE + pre-aborted signal → the same cascade (the pre-abort branch) — typed wait-abort with the adjusted ABANDONED message', () => {
    expect(s2.waitCode).toBe(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED)
    expect(s2.waitMessage).toBe(
      `ControlService: awaitControlDecision for request '${s2.requestId}' was aborted before the wait began (the INLINE request is durably ABANDONED — the additive close fact 'control-request-abandoned' is the terminal mark; the frozen invocation is dead and a retry is a NEW request)`,
    )
    expect(s2.abandonFacts).toBe(1)
    expect(s2.abandonReason).toBe('wait-aborted')
    expect(s2.requestStatus).toBe('abandoned')
  })

  it('S3: exactly-once after the cascade — the explicit abandon and the late allow are both rejected (the mark is already durable)', () => {
    expect(s3.explicitAbandonCode).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
    expect(s3.lateAllowCode).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
  })

  it('S3: zero effect — the guard blocks with request-abandoned (zero execution, zero consumption); one abandon fact, zero decision facts', () => {
    expect(s3.verdict.allowed).toBe(false)
    expect(s3.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_ABANDONED)
    expect(s3.executed).toBe(0)
    expect(s3.abandonFacts).toBe(1)
    expect(s3.decisionFacts).toBe(0)
    expect(s3.consumptionFacts).toBe(0)
    expect(s3.requestStatus).toBe('abandoned')
  })

  it('S4: GUARDED + mid-wait abort → TODAY exactly — PENDING, zero abandon facts, the LEGACY message, a later resolve still works', () => {
    expect(s4.waitCode).toBe(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED)
    // The guarded request keeps the legacy zero-side-effect message
    // EXACTLY (byte-for-byte — the pinned contract).
    expect(s4.waitMessage).toBe(
      `ControlService: awaitControlDecision for request '${s4.requestId}' was aborted before a durable decision appeared (zero side effects — the request stays durable and undecided)`,
    )
    expect(s4.abandonFacts).toBe(0)
    expect(s4.statusAfterAbort).toBe('pending')
    expect(s4.laterResolveOk).toBe(true)
    expect(s4.statusAfterResolve).toBe('decided')
    expect(s4.decisionFacts).toBe(1)
  })

  it('S5: LEGACY (coupling ABSENT) + mid-wait abort → TODAY exactly — PENDING, zero abandon facts, the LEGACY message, a later resolve still works', () => {
    expect(s5.waitCode).toBe(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED)
    // The legacy (ABSENT-coupling) request keeps the legacy
    // zero-side-effect message EXACTLY (byte-for-byte — a4a W2's
    // contract).
    expect(s5.waitMessage).toBe(
      `ControlService: awaitControlDecision for request '${s5.requestId}' was aborted before a durable decision appeared (zero side effects — the request stays durable and undecided)`,
    )
    expect(s5.abandonFacts).toBe(0)
    expect(s5.statusAfterAbort).toBe('pending')
    expect(s5.laterResolveOk).toBe(true)
    expect(s5.statusAfterResolve).toBe('decided')
  })

  it('S6: the race — a durable decision wins before the signal → the wait RESOLVES with it (the first decision is authoritative), NO abandon fact', () => {
    expect(s6.resolved).toBe(true)
    expect(s6.decision?.decision).toBe('allow')
    expect(s6.abandonFacts).toBe(0)
    expect(s6.requestStatus).toBe('decided')
  })

  it('S7: the storage-fault contract through the SAME write path — the faulted cascade rejects typed DURABLE_WRITE_FAILED (never a half-abandoned claim)', () => {
    expect(s7.rejected).toBe(true)
    expect(s7.isDurableWriteFailed).toBe(true)
  })

  it('S7: zero side effects of the faulted cascade — no abandon fact, the request is still PENDING, a later resolve still works', () => {
    expect(s7.abandonFacts).toBe(0)
    expect(s7.statusAfterFault).toBe('pending')
    expect(s7.laterResolveOk).toBe(true)
    expect(s7.statusAfterResolve).toBe('decided')
  })
})
