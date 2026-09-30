/**
 * pre-alpha3 PR-D, D.2 — the TEAM subject (`{kind:'team',
 * rootSessionId}`): a control request addressed to the TEAM as a whole
 * (the root session), not to one instance or one template.
 *
 * Key semantics under test:
 * - a team subject must name THIS team (`subject.rootSessionId` === the
 *   request's `rootSessionId`): a different root is malformed with ZERO
 *   rows;
 * - a team subject carries NO legacy `targetInstanceId` projection;
 * - the team subject has no instance lifecycle: the guard's
 *   member-liveness check is skipped (KEY NEGATIVE: a team-subject allow
 *   is guardable even when every seeded member is DISPOSED — only the
 *   team-existence check (a) applies);
 * - the full resolver closure works for team subjects (user-approval by
 *   the human).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await, the
 * p6t1/p6t2 pattern) and captures its results; the `it` bodies are pure
 * synchronous assertions over the captured values.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_ERROR_CODES,
  CONTROL_REQUEST_KINDS,
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
  flipLifecycle,
  humanCaller,
  leaderCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

// --- scenario 1: team subject request + human resolution --------------------------------
let s1: {
  readonly request: ControlRequestRecord
  readonly decisionValue: string
  readonly requestStatus: string
}
{
  const world = await createP6T4World('ctl-team-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      subject: { kind: 'team', rootSessionId: P6T4_ROOT },
      actionName: 'team-policy-change',
      correlation: 'corr-team-1',
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
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: team subject naming a DIFFERENT root is malformed -----------------------
let s2: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly requestFacts: number
}
{
  const world = await createP6T4World('ctl-team-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
          subject: { kind: 'team', rootSessionId: 'session-other-team' },
          actionName: 'team-policy-change',
          correlation: 'corr-team-2',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    s2 = {
      rejected: { code: rejected.code, details: rejected.details },
      requestFacts: controlFacts(world, 'control-request-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3 (KEY NEGATIVE): every member DISPOSED — the team subject still guardable -
let s3: {
  readonly request: ControlRequestRecord
  readonly executed: number
}
{
  const world = await createP6T4World('ctl-team-3', ['leader', 'worker'])
  try {
    await flipLifecycle(world, WORKER_ID, 'DISPOSED')
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)

    // The (only) member is DISPOSED — irrelevant for a team subject: the
    // team still exists, so the request is recorded and the guard only
    // applies the team-existence check.
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      subject: { kind: 'team', rootSessionId: P6T4_ROOT },
      actionName: 'team-policy-change',
      correlation: 'corr-team-3',
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const scope = {
      rootSessionId: P6T4_ROOT,
      subject: { kind: 'team' as const, rootSessionId: P6T4_ROOT },
      actionName: 'team-policy-change',
      correlation: 'corr-team-3',
    }
    const attempt = await pipeline.execute(scope)
    s3 = {
      request,
      executed: attempt.allowed ? 1 : 0,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('pre-alpha3 PR-D D.2 — the team subject', () => {
  it('S1: a team subject request is resolved by the human and records NO targetInstanceId', () => {
    expect(s1.request.subject).toEqual({ kind: 'team', rootSessionId: P6T4_ROOT })
    expect('targetInstanceId' in s1.request).toBe(false)
    expect(s1.decisionValue).toBe('allow')
    expect(s1.requestStatus).toBe('decided')
  })

  it('S2: a team subject naming a different root is malformed (zero rows)', () => {
    expect(s2.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(s2.rejected.details?.['stage']).toBe('request')
    expect(s2.rejected.details?.['field']).toBe('subject')
    expect(s2.requestFacts).toBe(0)
  })

  it('S3 (KEY NEGATIVE): a team-subject allow is guardable even when every member is DISPOSED (no instance liveness check)', () => {
    expect(s3.request.subject).toEqual({ kind: 'team', rootSessionId: P6T4_ROOT })
    expect(s3.executed).toBe(1)
  })
})
