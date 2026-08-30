/**
 * P6-T4 MUST-TEST — "stale request": a request whose target can never
 * act again is closed fail-closed.
 *
 * Documented stale semantics (the three phases differ on purpose):
 * - REQUEST time: a DISPOSED target is rejected with
 *   CONTROL_TARGET_STALE and ZERO rows (a request that can never become
 *   valid never exists); a MISSING target is the facade's
 *   INSTANCE_NOT_FOUND (resolution phase); an ARCHIVED target is
 *   TOLERATED (suspended, not gone — invariant 52 admits no NEW work but
 *   a control request about a suspended member is still meaningful);
 * - RESOLVE time: a target that became missing or DISPOSED after the
 *   request is recorded as a durable `stale-denied` decision FIRST (the
 *   append-only ledger has no "mark" primitive — the row IS the stale
 *   mark) and THEN throws CONTROL_REQUEST_STALE. The request is CLOSED:
 *   it can never become an allow, even if the lifecycle is flipped back;
 * - GUARD time: a missing / ARCHIVED / DISPOSED target (or a vanished
 *   team session) blocks with the `target-stale` verdict before any
 *   request state is consulted.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await, the
 * p6t1/p6t2 pattern) and captures its results; the `it` bodies are pure
 * synchronous assertions over the captured values.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_ERROR_CODES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type { ControlDecisionRecord, ControlGuardVerdict } from '../control/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createFakeToolPipeline,
  createP6T4Service,
  createP6T4World,
  deleteMember,
  destroyP6T1World,
  expectControlRejection,
  expectFirst,
  flipLifecycle,
  leaderCaller,
  makeScope,
  memberCaller,
} from './p6t4-helpers.js'
import type { FakeToolExecution } from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)

// --- scenario 1: request time — DISPOSED target -----------------------------------
let s1: {
  readonly rejected: {
    readonly code: string
    readonly details?: Record<string, unknown>
  }
  readonly requestFacts: number
  readonly decisionFacts: number
  readonly verdict: ControlGuardVerdict
}
{
  const world = await createP6T4World('p6t4-st-1', ['leader', 'worker'])
  try {
    await flipLifecycle(world, WORKER_ID, 'DISPOSED')
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-p6t4-stale-req' })

    // The worker itself can no longer act (a DISPOSED caller is stale);
    // the leader requesting on its behalf hits the request-time target
    // staleness.
    const rejected = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          targetInstanceId: WORKER_ID,
          actionName: scope.actionName,
          toolName: scope.toolName,
          correlation: scope.correlation,
        }),
      CONTROL_ERROR_CODES.CONTROL_TARGET_STALE,
    )
    const verdict = await service.guardOperation(scope)
    s1 = {
      rejected: { code: rejected.code, details: rejected.details },
      requestFacts: controlFacts(world, 'control-request-recorded').length,
      decisionFacts: controlFacts(world, 'control-decision-recorded').length,
      verdict,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: resolve time — DISPOSED after the request -------------------------
let s2: {
  readonly requestSequence: number
  readonly requestId: string
  readonly rejected: {
    readonly code: string
    readonly details?: Record<string, unknown>
  }
  readonly requestStatus: string
  readonly decision: ControlDecisionRecord
  readonly executed: number
  readonly verdict: ControlGuardVerdict
}
{
  const world = await createP6T4World('p6t4-st-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    const scope = makeScope({ correlation: 'corr-p6t4-stale-resolve' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })

    await flipLifecycle(world, WORKER_ID, 'DISPOSED')

    const rejected = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_STALE,
    )

    // The durable stale-denied row IS the mark: it exists even though
    // the call threw.
    const state = await service.listControlState(P6T4_ROOT)
    const verdict = await service.guardOperation(scope)
    s2 = {
      requestSequence: request.requestSequence,
      requestId: request.requestId,
      rejected: { code: rejected.code, details: rejected.details },
      requestStatus: expectFirst(state.requests, 'request').status,
      decision: expectFirst(state.decisions, 'decision'),
      executed: pipeline.executed().length,
      verdict,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: a stale-denied request can never become an allow ------------------
let s3: {
  readonly rejectedAfterFlip: {
    readonly code: string
    readonly details?: Record<string, unknown>
  }
  readonly decisions: readonly ControlDecisionRecord[]
  readonly verdict: ControlGuardVerdict
}
{
  const world = await createP6T4World('p6t4-st-3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-p6t4-stale-forever' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    await flipLifecycle(world, WORKER_ID, 'DISPOSED')
    await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_STALE,
    )

    // The target comes back to life — the request is still closed.
    await flipLifecycle(world, WORKER_ID, 'RUNNING')
    const rejectedAfterFlip = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED,
    )
    const state = await service.listControlState(P6T4_ROOT)
    const verdict = await service.guardOperation(scope)
    s3 = {
      rejectedAfterFlip: {
        code: rejectedAfterFlip.code,
        details: rejectedAfterFlip.details,
      },
      decisions: state.decisions,
      verdict,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 4: ARCHIVED is tolerated at request/resolve, blocked at guard --------
let s4: {
  readonly requestStatus: string
  readonly suspended: FakeToolExecution
  readonly resumed: FakeToolExecution
  readonly requestId: string
  readonly executed: number
  readonly consumptions: number
}
{
  const world = await createP6T4World('p6t4-st-4', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    const scope = makeScope({ correlation: 'corr-p6t4-archived' })

    await flipLifecycle(world, WORKER_ID, 'ARCHIVED')
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })

    // ARCHIVED is not terminal: the decision may be recorded.
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })

    // ...but the operation cannot execute on a suspended target.
    const suspended = await pipeline.execute(scope)

    // The target comes back: the SAME pending allow now executes.
    await flipLifecycle(world, WORKER_ID, 'RUNNING')
    const resumed = await pipeline.execute(scope)
    const state = await service.listControlState(P6T4_ROOT)
    s4 = {
      requestStatus: request.status,
      suspended,
      resumed,
      requestId: request.requestId,
      executed: pipeline.executed().length,
      consumptions: state.consumptions.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 5: resolve time — MISSING target (record deleted) ---------------------
let s5: {
  readonly rejected: {
    readonly code: string
    readonly details?: Record<string, unknown>
  }
  readonly decision: ControlDecisionRecord
  readonly verdict: ControlGuardVerdict
}
{
  const world = await createP6T4World('p6t4-st-5', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-p6t4-missing' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })

    await deleteMember(world, WORKER_ID)

    const rejected = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_STALE,
    )
    const state = await service.listControlState(P6T4_ROOT)
    // Guard phase: the missing target blocks before any request state
    // (target-stale — the operation cannot execute on a gone target).
    const verdict = await service.guardOperation(scope)
    s5 = {
      rejected: { code: rejected.code, details: rejected.details },
      decision: expectFirst(state.decisions, 'decision'),
      verdict,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('p6t4 stale requests (MUST-TEST: stale is fail-closed at every phase)', () => {
  it('request time: a DISPOSED target is rejected (CONTROL_TARGET_STALE) with zero rows', () => {
    expect(s1.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_TARGET_STALE)
    expect(s1.requestFacts).toBe(0)
    expect(s1.decisionFacts).toBe(0)
    expect(s1.verdict.allowed).toBe(false)
    if (s1.verdict.allowed === false) {
      expect(s1.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE)
    }
  })

  it('resolve time: a DISPOSED target after the request -> a durable stale-denied row FIRST, then CONTROL_REQUEST_STALE; the guard reports target-stale (liveness precedes request state)', () => {
    expect(s2.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_STALE)
    // The request is closed, and the decision row references it exactly.
    expect(s2.requestStatus).toBe('decided')
    expect(s2.decision.decision).toBe(CONTROL_DECISION_VALUES.STALE_DENIED)
    expect(s2.decision.requestId).toBe(s2.requestId)
    expect(s2.decision.requestSequence).toBe(s2.requestSequence)
    expect(s2.decision.decider).toEqual({
      kind: 'instance',
      instanceId: LEADER_ID,
      role: 'leader',
    })
    // Nothing executed, ever.
    expect(s2.executed).toBe(0)
    // The guard checks target liveness BEFORE request state, so the
    // still-DISPOSED target yields target-stale even though a stale-denied
    // row exists; request-stale surfaces once the target is live again
    // (scenario 3).
    expect(s2.verdict.allowed).toBe(false)
    if (s2.verdict.allowed === false) {
      expect(s2.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE)
    }
  })

  it('a stale-denied request can NEVER become an allow, even after the lifecycle is flipped back (re-resolution is CONTROL_REQUEST_DECIDED)', () => {
    expect(s3.rejectedAfterFlip.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED,
    )
    // The original stale-denied mark is the only decision, forever.
    expect(s3.decisions.length).toBe(1)
    expect(s3.decisions[0]?.decision).toBe(CONTROL_DECISION_VALUES.STALE_DENIED)
    expect(s3.verdict.allowed).toBe(false)
    if (s3.verdict.allowed === false) {
      expect(s3.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_STALE)
      expect(s3.verdict.requestId).toBe(s3.decisions[0]?.requestId)
      expect(s3.verdict.decisionSequence).toBe(
        s3.decisions[0]?.decisionSequence,
      )
    }
  })

  it('ARCHIVED is tolerated at request and resolve time, blocked at guard time until the target runs again', () => {
    expect(s4.requestStatus).toBe('pending')
    // The suspended target cannot execute the allowed operation.
    expect(s4.suspended.allowed).toBe(false)
    expect(s4.suspended.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE)
    // The SAME pending allow executes once the target is live again.
    expect(s4.resumed.allowed).toBe(true)
    expect(s4.resumed.requestId).toBe(s4.requestId)
    expect(s4.executed).toBe(1)
    expect(s4.consumptions).toBe(1)
  })

  it('resolve time: a MISSING target (record deleted) -> a durable stale-denied row FIRST + CONTROL_REQUEST_STALE; the guard blocks target-stale', () => {
    expect(s5.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_STALE)
    expect(s5.decision.decision).toBe(CONTROL_DECISION_VALUES.STALE_DENIED)
    // Guard phase: the missing target blocks before any request state.
    expect(s5.verdict.allowed).toBe(false)
    if (s5.verdict.allowed === false) {
      expect(s5.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE)
    }
  })
})
