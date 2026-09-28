/**
 * pre-alpha3 PR-D, D.3/D.4 — the INLINE execution coupling
 * (`executionCoupling: 'inline'`): request → wait → decision; on `allow`
 * the current frozen invocation CONTINUES (the allow is NOT consumed by
 * the last-mile guard — NO `control-allow-consumed` fact is written); on
 * `deny` zero effect. The ABSENT coupling is the legacy guarded flow
 * (request → wait → decision → guard → consume → execute), UNCHANGED.
 *
 * Key semantics under test:
 * - the KEY NEGATIVE: an inline allow produces NO
 *   `control-allow-consumed` durable fact (the allow is not a
 *   one-shot guard token);
 * - the resolver ROLE CLOSURE is unchanged for inline requests
 *   (user-approval is human-only — a member with the `resolve-control`
 *   op is still not a resolver);
 * - the record carries the closed coupling value; the DERIVED request
 *   state is `decided` after the durable decision;
 * - contrast: the same flow with the guarded coupling DOES produce the
 *   exactly-once `control-allow-consumed` fact (legacy semantics intact).
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
  CONTROL_REQUEST_KINDS,
  CONTROL_RESOLVER_ROLES,
} from '../control/index.js'
import type { ControlRequestRecord } from '../control/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createFakeToolPipeline,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  expectControlRejection,
  humanCaller,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

// --- scenario 1 (KEY NEGATIVE): inline allow — NO allow-consumed fact --------------------
let s1: {
  readonly request: ControlRequestRecord
  readonly decisionValue: string
  readonly requestStatus: string
  readonly consumedFacts: number
}
{
  const world = await createP6T4World('ctl-inline-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-inline-1',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests.find((r) => r.requestId === request.requestId)
    s1 = {
      request,
      decisionValue: decision.decision,
      requestStatus: record?.status ?? 'missing',
      consumedFacts: controlFacts(world, 'control-allow-consumed').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: the human-only resolver closure is unchanged for inline ------------------
let s2: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly decisionFacts: number
}
{
  const world = await createP6T4World('ctl-inline-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-inline-2',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    // The worker's template envelope carries resolve-control — the ROLE
    // CLOSURE (user-approval is human-only) must still beat the envelope.
    const rejected = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(WORKER_ID),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
    )
    s2 = {
      rejected: { code: rejected.code, details: rejected.details },
      decisionFacts: controlFacts(world, 'control-decision-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: inline deny — zero effect -------------------------------------------------
let s3: {
  readonly requestStatus: string
  readonly decisionValue: string
  readonly consumedFacts: number
}
{
  const world = await createP6T4World('ctl-inline-3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-inline-3',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: request.requestId,
      decision: 'deny',
    })
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests.find((r) => r.requestId === request.requestId)
    s3 = {
      requestStatus: record?.status ?? 'missing',
      decisionValue: decision.decision,
      consumedFacts: controlFacts(world, 'control-allow-consumed').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 4 (contrast): the guarded coupling still consumes exactly once --------------
let s4: {
  readonly executed: number
  readonly consumedFacts: number
}
{
  const world = await createP6T4World('ctl-inline-4', ['leader', 'worker'])
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
      correlation: 'corr-inline-4',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const scope = {
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-inline-4',
    }
    const attempt = await pipeline.execute(scope)
    s4 = {
      executed: attempt.allowed ? 1 : 0,
      consumedFacts: controlFacts(world, 'control-allow-consumed').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('pre-alpha3 PR-D D.3/D.4 — the inline execution coupling', () => {
  it('S1 (KEY NEGATIVE): an inline allow is durable and decided but writes NO control-allow-consumed fact', () => {
    expect(s1.request.executionCoupling).toBe(CONTROL_EXECUTION_COUPLINGS.INLINE)
    expect(s1.decisionValue).toBe('allow')
    expect(s1.requestStatus).toBe('decided')
    expect(s1.consumedFacts).toBe(0)
  })

  it('S2: the human-only resolver closure is unchanged for inline (a member with the op is still not a resolver; zero decision rows)', () => {
    expect(s2.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
    expect(s2.rejected.details?.['allowedRoles']).toEqual(CONTROL_RESOLVER_ROLES['user-approval'])
    expect(s2.decisionFacts).toBe(0)
  })

  it('S3: an inline deny decides the request with zero effect (no consumption)', () => {
    expect(s3.decisionValue).toBe('deny')
    expect(s3.requestStatus).toBe('decided')
    expect(s3.consumedFacts).toBe(0)
  })

  it('S4 (contrast): the guarded coupling still consumes the allow exactly once through the guard', () => {
    expect(s4.executed).toBe(1)
    expect(s4.consumedFacts).toBe(1)
  })

  it('the closed coupling vocabulary is exported (guarded | inline)', () => {
    expect([CONTROL_EXECUTION_COUPLINGS.GUARDED, CONTROL_EXECUTION_COUPLINGS.INLINE]).toEqual([
      'guarded',
      'inline',
    ])
    // Leader-approval also admits the leader (the closure is kind-based,
    // coupling-independent).
    expect(CONTROL_RESOLVER_ROLES['leader-approval']).toEqual(['leader', 'human'])
  })
})
