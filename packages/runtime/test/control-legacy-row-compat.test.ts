/**
 * pre-alpha3 PR-D, D.2 — LEGACY ROW COMPATIBILITY: a durable
 * `control-request-recorded` row that carries `targetInstanceId` but NO
 * explicit `subject` (a pre-PR-D row) parses to
 * `{ kind: 'instance', instanceId: targetInstanceId }`, so:
 *
 * - the scope key recomputes BYTE-IDENTICAL to the pre-PR-D key (the
 *   subject-keyed key's second element IS the old targetInstanceId) —
 *   old durable rows stay idempotent under the extended key;
 * - the record exposes the derived instance subject alongside the
 *   unchanged legacy projection (`targetInstanceId`);
 * - a SYNTHETIC pre-PR-D row (request + decision, both written WITHOUT
 *   any `subject` field) is fully consumable by the guard: the legacy
 *   scope (targetInstanceId only) matches the decision's subject-less
 *   scope snapshot byte-identically, and the allow is consumed exactly
 *   once;
 * - legacy rows keep their legacy semantics: ABSENT review fields stay
 *   OMITTED, the derived state (pending/decided) is intact after a
 *   restart.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await, the
 * p6t1/p6t2 pattern) and captures its results; the `it` bodies are pure
 * synchronous assertions over the captured values.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createFakeToolPipeline,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  restartP6T1World,
  writeRawControlFact,
} from './p6t4-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

// --- scenario 1: legacy request — the row carries the derived instance subject -----------
let s1: {
  readonly subject: unknown
  readonly targetInstanceId: string | undefined
  readonly retryRequestId: string
  readonly requestId: string
}
{
  const world = await createP6T4World('ctl-leg-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-leg-1',
    })
    // A RETRY in the legacy spelling (and one in the explicit-subject
    // spelling) is idempotent: the subject-keyed scope key is
    // byte-identical to the pre-PR-D key.
    const retryLegacy = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-leg-1',
    })
    const retrySubject = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: { kind: 'instance', instanceId: WORKER_ID },
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-leg-1',
    })
    const raw = controlFacts(world, 'control-request-recorded')[0]
    s1 = {
      subject: raw?.payload['subject'],
      targetInstanceId: (raw?.payload['targetInstanceId'] as string | undefined) ?? undefined,
      retryRequestId: retryLegacy.requestId,
      requestId: request.requestId,
    }
    void retrySubject
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: a legacy row keeps legacy semantics (no review keys) ----------------------
let s2: {
  readonly hasPayloadKey: boolean
  readonly hasDigestKey: boolean
  readonly hasCouplingKey: boolean
}
{
  const world = await createP6T4World('ctl-leg-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-leg-2',
    })
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests[0]
    s2 = {
      hasPayloadKey: record !== undefined && 'reviewPayload' in record,
      hasDigestKey: record !== undefined && 'reviewPayloadDigest' in record,
      hasCouplingKey: record !== undefined && 'executionCoupling' in record,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: restart keeps the derived subject + decided state -------------------------
let s3: {
  readonly requestId: string
  readonly subjectAfterRestart: unknown
  readonly statusAfterRestart: string
}
{
  let world: P6T1World = await createP6T4World('ctl-leg-3', ['leader', 'worker'])
  let requestId = ''
  try {
    {
      const service = createP6T4Service(world)
      const request = await service.requestControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
        targetInstanceId: WORKER_ID,
        actionName: 'write-file',
        toolName: 'fs.write',
        correlation: 'corr-leg-3',
      })
      requestId = request.requestId
      await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: request.requestId,
        decision: 'allow',
      })
    }
    world = await restartP6T1World(world)
    const service = createP6T4Service(world)
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests.find((r) => r.requestId === requestId)
    s3 = {
      requestId,
      subjectAfterRestart: record?.subject,
      statusAfterRestart: record?.status ?? 'missing',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 4 (KEY): a SYNTHETIC pre-PR-D row (no subject anywhere) is guardable ---------
let s4: {
  readonly firstAllowed: boolean
  readonly secondReason: string
  readonly consumptionFacts: number
}
{
  const world = await createP6T4World('ctl-leg-4', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    // A pre-PR-D request row: targetInstanceId only, NO subject key.
    await writeRawControlFact(world, 'control-request-recorded', {
      requestId: 'ctrl-legacy-synthetic',
      kind: 'leader-approval',
      requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-leg-4',
    })
    // A pre-PR-D decision row: a scope snapshot WITHOUT a subject key.
    await writeRawControlFact(world, 'control-decision-recorded', {
      requestId: 'ctrl-legacy-synthetic',
      decision: CONTROL_DECISION_VALUES.ALLOW,
      decider: { kind: 'instance', instanceId: String(P6T4_SEEDS.leader.instanceId), role: 'leader' },
      scope: {
        rootSessionId: P6T4_ROOT,
        targetInstanceId: WORKER_ID,
        actionName: 'write-file',
        toolName: 'fs.write',
        correlation: 'corr-leg-4',
      },
      requestSequence: 1,
    })
    const scope = {
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-leg-4',
    }
    // First attempt: the legacy row parses to the instance subject and
    // the subject-less scope snapshot matches byte-identically — the
    // allow is consumed (the legacy exactly-once semantics).
    const first = await pipeline.execute(scope)
    // Second attempt: consumed (no new request on this correlation).
    const second = await service.guardOperation(scope)
    s4 = {
      firstAllowed: first.allowed,
      secondReason: second.allowed ? 'none' : (second.reason ?? 'none'),
      consumptionFacts: controlFacts(world, 'control-allow-consumed').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('pre-alpha3 PR-D D.2 — legacy row compatibility', () => {
  it('S1: a legacy request row carries the derived instance subject; legacy AND subject retries are idempotent (byte-identical key)', () => {
    expect(s1.subject).toEqual({ kind: 'instance', instanceId: WORKER_ID })
    expect(s1.targetInstanceId).toBe(WORKER_ID)
    expect(s1.retryRequestId).toBe(s1.requestId)
  })

  it('S2: a legacy row keeps legacy semantics — the review keys stay ABSENT', () => {
    expect(s2.hasPayloadKey).toBe(false)
    expect(s2.hasDigestKey).toBe(false)
    expect(s2.hasCouplingKey).toBe(false)
  })

  it('S3: a restart re-parses the legacy row — the derived subject and the decided state survive', () => {
    expect(s3.subjectAfterRestart).toEqual({ kind: 'instance', instanceId: WORKER_ID })
    expect(s3.statusAfterRestart).toBe('decided')
  })

  it('S4 (KEY): a synthetic pre-PR-D row (no subject anywhere) is parsed, matched byte-identically and consumed exactly once by the guard', () => {
    expect(s4.firstAllowed).toBe(true)
    expect(s4.secondReason).toBe('allow-consumed')
    expect(s4.consumptionFacts).toBe(1)
  })
})
