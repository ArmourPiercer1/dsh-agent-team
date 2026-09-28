/**
 * pre-alpha3 PR-D, D.2 — the TEMPLATE subject (`{kind:'template',
 * templateId}`): a control request addressed to a member TEMPLATE (the
 * blueprint identity of a class of members), not to one live instance.
 *
 * Key semantics under test:
 * - the INSTANCE STALE VALIDATOR is branched on the subject kind: a
 *   template subject has no instance lifecycle, so it is NEVER killed by
 *   the instance stale check (KEY NEGATIVE: a DISPOSED worker instance
 *   does not make the 'worker' template subject stale — the request is
 *   recorded, resolvable and guardable);
 * - the template must be in the bound team blueprint (leader + member
 *   templates): an unknown templateId is CONTROL_REQUEST_MALFORMED with
 *   ZERO rows;
 * - the full kind matrix works for template subjects (leader-approval by
 *   the leader, user-approval by the human, envelope-mutation by the
 *   leader);
 * - the requester-envelope closure is unchanged (a member template
 *   without the `request-control` op cannot request at all).
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
  expectRuntimeRejection,
  flipLifecycle,
  humanCaller,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'
import type { FakeToolExecution } from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const SCRIBE_ID = String(P6T4_SEEDS.scribe.instanceId)

// --- scenario 1 (KEY NEGATIVE): DISPOSED worker instance, template subject alive --------
let s1: {
  readonly request: ControlRequestRecord
  readonly decisionValue: string
  readonly verdict: {
    readonly allowed: boolean
    readonly requestId?: string
    readonly reason?: string
  }
  readonly executed: FakeToolExecution[]
}
{
  const world = await createP6T4World('ctl-tpl-1', ['leader', 'worker'])
  try {
    await flipLifecycle(world, WORKER_ID, 'DISPOSED')
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)

    // The instance is DISPOSED, but the TEMPLATE subject has no instance
    // lifecycle — the request is recorded (no CONTROL_TARGET_STALE).
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: { kind: 'template', templateId: 'worker' },
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-tpl-1',
    })

    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })

    // The guard (consulted by the pipeline) skips the member-liveness
    // check for a template subject: the durable allow authorizes the
    // operation. ONE guarded attempt (an allow is consumed exactly once).
    const scope = {
      rootSessionId: P6T4_ROOT,
      subject: { kind: 'template' as const, templateId: 'worker' },
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-tpl-1',
    }
    const attempt = await pipeline.execute(scope)
    s1 = {
      request,
      decisionValue: decision.decision,
      verdict: attempt,
      executed: pipeline.executed().filter((e) => e.correlation === 'corr-tpl-1'),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: user-approval template request resolved by the human -------------------
let s2: {
  readonly request: ControlRequestRecord
  readonly decisionValue: string
  readonly requestStatus: string
}
{
  const world = await createP6T4World('ctl-tpl-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      subject: { kind: 'template', templateId: 'worker' },
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-tpl-2',
    })
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests.find((r) => r.requestId === request.requestId)
    s2 = {
      request,
      decisionValue: decision.decision,
      requestStatus: record?.status ?? 'missing',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: unknown templateId is malformed (zero rows) ----------------------------
let s3: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly requestFacts: number
}
{
  const world = await createP6T4World('ctl-tpl-3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          subject: { kind: 'template', templateId: 'ghost-template' },
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-tpl-3',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    s3 = {
      rejected: { code: rejected.code, details: rejected.details },
      requestFacts: controlFacts(world, 'control-request-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 4: envelope-mutation template request resolved (deny) by the leader -------
let s4: {
  readonly request: ControlRequestRecord
  readonly decisionValue: string
}
{
  const world = await createP6T4World('ctl-tpl-4', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION,
      subject: { kind: 'template', templateId: 'scout' },
      actionName: 'update-envelope',
      correlation: 'corr-tpl-4',
    })
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'deny',
    })
    s4 = { request, decisionValue: decision.decision }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 5 (negative): a member without the request-control op cannot request ------
let s5: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly requestFacts: number
}
{
  const world = await createP6T4World('ctl-tpl-5', ['leader', 'worker', 'scribe'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectRuntimeRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(SCRIBE_ID),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          subject: { kind: 'template', templateId: 'worker' },
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-tpl-5',
        }),
      'TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS',
    )
    s5 = {
      rejected: { code: rejected.code, details: rejected.details },
      requestFacts: controlFacts(world, 'control-request-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('pre-alpha3 PR-D D.2 — the template subject', () => {
  it('S1 (KEY NEGATIVE): a template subject is NEVER killed by the instance stale validator (DISPOSED worker, full request → allow → guard path)', () => {
    expect(s1.request.subject).toEqual({ kind: 'template', templateId: 'worker' })
    // A template subject has no legacy projection: the record carries NO
    // targetInstanceId.
    expect('targetInstanceId' in s1.request).toBe(false)
    expect(s1.decisionValue).toBe('allow')
    expect(s1.verdict.allowed).toBe(true)
    expect(s1.verdict.requestId).toBe(s1.request.requestId)
    expect(s1.executed).toHaveLength(1)
  })

  it('S2: a user-approval template request is resolved by the human (kind matrix intact)', () => {
    expect(s2.request.subject).toEqual({ kind: 'template', templateId: 'worker' })
    expect(s2.decisionValue).toBe('allow')
    expect(s2.requestStatus).toBe('decided')
    // The user-approval resolver closure is human-only (asserted on the
    // closed constant — the service enforces it, see control-inline-review).
    expect(CONTROL_RESOLVER_ROLES['user-approval']).toEqual(['human'])
  })

  it('S3: an unknown templateId is malformed with the templateId detail (zero rows)', () => {
    expect(s3.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(s3.rejected.details?.['stage']).toBe('request')
    expect(s3.rejected.details?.['field']).toBe('subject')
    expect(s3.rejected.details?.['templateId']).toBe('ghost-template')
    expect(s3.requestFacts).toBe(0)
  })

  it('S4: an envelope-mutation template request is resolved by the leader (deny)', () => {
    expect(s4.request.subject).toEqual({ kind: 'template', templateId: 'scout' })
    expect(s4.decisionValue).toBe('deny')
  })

  it('S5 (negative): a member template without the request-control op is envelope-blocked (zero rows)', () => {
    expect(s5.rejected.code).toBe('TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS')
    expect(s5.requestFacts).toBe(0)
  })
})
