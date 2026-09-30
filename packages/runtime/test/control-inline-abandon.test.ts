/**
 * pre-alpha3 PR-D, D.4 — the inline ABORT path: `abandonControlRequest`
 * durably records the ADDITIVE close fact
 * `control-request-abandoned` (payload: requestId, rootSessionId,
 * abandonedAt, reason?). The append-only ledger has no delete primitive
 * — the request row is never physically removed; the abandon fact is the
 * TERMINAL mark (like `stale-denied`):
 *
 * - the DERIVED request state is `pending | decided | abandoned` — the
 *   abandon wins as the terminal mark (even over a durable allow
 *   recorded BEFORE the abandon — the allow-invalidating path);
 * - a later decision attempt is rejected with CONTROL_REQUEST_ABANDONED
 *   (zero durable side effects — no decision row is written);
 * - the last-mile guard blocks with the `request-abandoned` verdict even
 *   over the durable pre-abandon allow (KEY NEGATIVE: the old
 *   allow/decision cannot execute the operation — zero effect, and no
 *   `control-allow-consumed` fact is ever written for it);
 * - closed close-authority: the requesting principal (its own request),
 *   the Leader, or the human may abandon — a member may abandon only ITS
 *   OWN request;
 * - the terminal mark is written exactly once (a second abandon is
 *   rejected);
 * - the abandon row survives a restart (durable authority, invariant 45).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await, the
 * p6t1/p6t2 pattern) and captures its results; the `it` bodies are pure
 * synchronous assertions over the captured values.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_ERROR_CODES,
  CONTROL_EXECUTION_COUPLINGS,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type { ControlAbandonmentRecord } from '../control/index.js'

/** The structural shape of the guard verdict the assertions need (the
 *  service type is a discriminated union; the captured value is plain). */
type CapturedVerdict = {
  readonly allowed: boolean
  readonly requestId?: string
  readonly reason?: string
  readonly decisionSequence?: number
}
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createFakeToolPipeline,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  expectControlRejection,
  leaderCaller,
  memberCaller,
  restartP6T1World,
} from './p6t4-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const WORKER2_ID = String(P6T4_SEEDS.worker2.instanceId)

// --- scenario 1: the allow-invalidating path (durable allow, then abandon) --------------
let s1: {
  readonly abandonment: ControlAbandonmentRecord
  readonly abandonFacts: number
  readonly requestFacts: number
  readonly requestStatus: string
  readonly decisionFacts: number
}
{
  const world = await createP6T4World('ctl-abd-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-abd-1',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    // The human durably allows (the inline frozen invocation would have
    // continued from this point).
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: { kind: 'human', humanId: 'human-p6t4-owner' },
      requestId: request.requestId,
      decision: 'allow',
    })
    // The invocation is aborted: the REQUESTING member abandons its own
    // request (the close-authority allows the requester).
    const abandonment = await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      requestId: request.requestId,
      reason: 'user aborted the invocation',
    })
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests.find((r) => r.requestId === request.requestId)
    s1 = {
      abandonment,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
      requestFacts: controlFacts(world, 'control-request-recorded').length,
      requestStatus: record?.status ?? 'missing',
      decisionFacts: controlFacts(world, 'control-decision-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: a decision after the abandon is rejected (zero durable side effects) ----
let s2: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly decisionFacts: number
}
{
  const world = await createP6T4World('ctl-abd-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-abd-2',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      requestId: request.requestId,
    })
    // The human still tries to decide — the terminal mark wins.
    const rejected = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: { kind: 'human', humanId: 'human-p6t4-owner' },
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
    )
    s2 = {
      rejected: { code: rejected.code, details: rejected.details },
      decisionFacts: controlFacts(world, 'control-decision-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3 (KEY NEGATIVE): the old allow cannot execute after the abandon -----------
let s3: {
  readonly verdict: CapturedVerdict
  readonly executed: number
  readonly consumedFacts: number
}
{
  const world = await createP6T4World('ctl-abd-3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-abd-3',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    // A durable allow recorded BEFORE the abandon (the allow-voiding
    // path).
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: { kind: 'human', humanId: 'human-p6t4-owner' },
      requestId: request.requestId,
      decision: 'allow',
    })
    await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      requestId: request.requestId,
      reason: 'aborted after allow',
    })
    // The frozen invocation (or any retry on the same scope) hits the
    // guard — the abandon is the terminal mark.
    const scope = {
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-abd-3',
    }
    const verdict = await service.guardOperation(scope)
    const attempt = await pipeline.execute(scope)
    s3 = {
      verdict,
      executed: attempt.allowed ? 1 : 0,
      consumedFacts: controlFacts(world, 'control-allow-consumed').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 4: closed close-authority (own request only; leader always; once) ----------
let s4: {
  readonly crossRejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly leaderAbandonment: ControlAbandonmentRecord
  readonly doubleRejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly abandonFacts: number
}
{
  const world = await createP6T4World('ctl-abd-4', ['leader', 'worker', 'worker2'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER2_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER2_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-abd-4',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    // A DIFFERENT member may not abandon worker2's request.
    const crossRejected = await expectControlRejection(
      () =>
        service.abandonControlRequest({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(WORKER_ID),
          requestId: request.requestId,
        }),
      CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
    )
    // The Leader may abandon any request (close-authority).
    const leaderAbandonment = await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      reason: 'leader closed the aborted request',
    })
    // The terminal mark is written exactly once.
    const doubleRejected = await expectControlRejection(
      () =>
        service.abandonControlRequest({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
    )
    s4 = {
      crossRejected: { code: crossRejected.code, details: crossRejected.details },
      leaderAbandonment,
      doubleRejected: { code: doubleRejected.code, details: doubleRejected.details },
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 5: abandoning a PENDING request (no decision yet) --------------------------
let s5: {
  readonly abandonment: ControlAbandonmentRecord
  readonly requestStatus: string
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
}
{
  const world = await createP6T4World('ctl-abd-5', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-abd-5',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    // No decision yet (the request is still pending) — the requester
    // abandons; no reason is carried (the field stays ABSENT).
    const abandonment = await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      requestId: request.requestId,
    })
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests.find((r) => r.requestId === request.requestId)
    // A late decision attempt is rejected by the terminal mark.
    const rejected = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
    )
    s5 = {
      abandonment,
      requestStatus: record?.status ?? 'missing',
      rejected: { code: rejected.code, details: rejected.details },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 6: the abandon fact survives a restart --------------------------------------
let s6: {
  readonly requestStatus: string
  readonly abandonment: ControlAbandonmentRecord | undefined
  readonly verdict: CapturedVerdict
}
{
  let world: P6T1World = await createP6T4World('ctl-abd-6', ['leader', 'worker'])
  let requestId = ''
  try {
    {
      const service = createP6T4Service(world)
      const request = await service.requestControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER_ID),
        kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
        targetInstanceId: WORKER_ID,
        actionName: 'write-file',
        toolName: 'fs.write',
        correlation: 'corr-abd-6',
        executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
      })
      requestId = request.requestId
      await service.abandonControlRequest({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER_ID),
        requestId: request.requestId,
        reason: 'survives the restart',
      })
    }
    world = await restartP6T1World(world)
    const service = createP6T4Service(world)
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests.find((r) => r.requestId === requestId)
    const abandonment = state.abandonments.find((a) => a.requestId === requestId)
    const scope = {
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-abd-6',
    }
    const verdict = await service.guardOperation(scope)
    s6 = {
      requestStatus: record?.status ?? 'missing',
      abandonment: abandonment === undefined ? undefined : { ...abandonment },
      verdict,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('pre-alpha3 PR-D D.4 — the inline abandon (the terminal mark)', () => {
  it('S1: the allow-invalidating path — the abandon fact is durable, the request row is NOT removed, the status is derived abandoned', () => {
    expect(s1.abandonFacts).toBe(1)
    // The request row is never physically removed (append-only ledger).
    expect(s1.requestFacts).toBe(1)
    // The pre-abandon durable allow remains (the ledger has no delete
    // primitive) — the abandon fact is what closes it.
    expect(s1.decisionFacts).toBe(1)
    expect(s1.requestStatus).toBe('abandoned')
    expect(s1.abandonment.rootSessionId).toBe(P6T4_ROOT)
    expect(s1.abandonment.abandonedAt).toBe(P6T4_NOW)
    expect(s1.abandonment.reason).toBe('user aborted the invocation')
    expect(s1.abandonment.abandonmentSequence).toBeGreaterThan(0)
  })

  it('S2: a decision after the abandon is rejected with CONTROL_REQUEST_ABANDONED (zero durable side effects)', () => {
    expect(s2.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
    expect(s2.decisionFacts).toBe(0)
  })

  it('S3 (KEY NEGATIVE): the old allow cannot execute after the abandon — the guard blocks with request-abandoned, zero execution, zero consumption', () => {
    expect(s3.verdict.allowed).toBe(false)
    expect(s3.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_ABANDONED)
    expect(s3.executed).toBe(0)
    expect(s3.consumedFacts).toBe(0)
  })

  it('S4: closed close-authority — a member cannot abandon another member\'s request; the Leader can; the mark is written exactly once', () => {
    expect(s4.crossRejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
    expect(s4.leaderAbandonment.abandonmentSequence).toBeGreaterThan(0)
    expect(s4.leaderAbandonment.reason).toBe('leader closed the aborted request')
    expect(s4.doubleRejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
    expect(s4.abandonFacts).toBe(1)
  })

  it('S5: a PENDING request can be abandoned (the reason stays ABSENT when not given) and the late decision is rejected', () => {
    expect(s5.abandonment.reason).toBeUndefined()
    expect(s5.requestStatus).toBe('abandoned')
    expect(s5.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
  })

  it('S6: the abandon fact survives a restart (durable authority — the guard still blocks)', () => {
    expect(s6.requestStatus).toBe('abandoned')
    expect(s6.abandonment).not.toBeUndefined()
    expect(s6.abandonment?.reason).toBe('survives the restart')
    expect(s6.verdict.allowed).toBe(false)
    expect(s6.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_ABANDONED)
  })
})
