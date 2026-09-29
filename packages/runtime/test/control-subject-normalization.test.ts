/**
 * pre-alpha3 PR-D, D.2 — the canonical ControlSubject (closed
 * `instance | template | team`) and its normalization rules:
 *
 * - an EXPLICIT subject is the canonical identity; a present
 *   `targetInstanceId` must be ABSENT or agree with an explicit instance
 *   subject (the legacy projection of the subject);
 * - with NO explicit subject the `targetInstanceId` (required, non-empty)
 *   IS the legacy instance identity — the record carries the derived
 *   instance subject (byte-identical scope key and durable semantics);
 * - a template/team subject with a present `targetInstanceId` is
 *   malformed (ambiguous identity — fail closed);
 * - a malformed explicit subject (unknown kind / missing or second id
 *   field) is malformed input;
 * - distinct subjects are distinct logical requests (distinct scope keys
 *  / requestIds), and the same identity expressed as an explicit subject
 *   OR as the legacy targetInstanceId is the SAME logical request
 *   (idempotent over the subject-keyed scope key).
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
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  expectControlRejection,
  leaderCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

// --- scenario 1: explicit instance subject (no targetInstanceId) ----------------------
let s1: {
  readonly record: ControlRequestRecord
}
{
  const world = await createP6T4World('ctl-subj-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const record = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: { kind: 'instance', instanceId: WORKER_ID },
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-subj-1',
    })
    s1 = { record }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: legacy targetInstanceId-only request ----------------------------------
let s2: {
  readonly record: ControlRequestRecord
}
{
  const world = await createP6T4World('ctl-subj-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const record = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-subj-2',
    })
    s2 = { record }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: explicit instance subject + matching targetInstanceId -----------------
let s3: {
  readonly record: ControlRequestRecord
  readonly retryRequestId: string
}
{
  const world = await createP6T4World('ctl-subj-3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const record = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: { kind: 'instance', instanceId: WORKER_ID },
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-subj-3',
    })
    // The legacy spelling of the SAME logical request (targetInstanceId
    // only, same scope fields) is idempotent: the subject-keyed scope
    // key is byte-identical, so the EXISTING row is returned.
    const retry = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-subj-3',
    })
    s3 = { record, retryRequestId: retry.requestId }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 4: explicit instance subject + MISMATCHING targetInstanceId --------------
let s4: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly requestFacts: number
}
{
  const world = await createP6T4World('ctl-subj-4', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          subject: { kind: 'instance', instanceId: WORKER_ID },
          targetInstanceId: 'inst-p6t4seeds02',
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-subj-4',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    s4 = {
      rejected: { code: rejected.code, details: rejected.details },
      requestFacts: controlFacts(world, 'control-request-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 5: template subject + present targetInstanceId ---------------------------
let s5: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly requestFacts: number
}
{
  const world = await createP6T4World('ctl-subj-5', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          subject: { kind: 'template', templateId: 'worker' },
          targetInstanceId: WORKER_ID,
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-subj-5',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    s5 = {
      rejected: { code: rejected.code, details: rejected.details },
      requestFacts: controlFacts(world, 'control-request-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 6: team subject + present targetInstanceId --------------------------------
let s6: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly requestFacts: number
}
{
  const world = await createP6T4World('ctl-subj-6', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          subject: { kind: 'team', rootSessionId: P6T4_ROOT },
          targetInstanceId: WORKER_ID,
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-subj-6',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    s6 = {
      rejected: { code: rejected.code, details: rejected.details },
      requestFacts: controlFacts(world, 'control-request-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 7: malformed explicit subject (unknown kind) ------------------------------
let s7: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly requestFacts: number
}
{
  const world = await createP6T4World('ctl-subj-7', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          subject: { kind: 'instancee', instanceId: WORKER_ID } as unknown as never,
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-subj-7',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    s7 = {
      rejected: { code: rejected.code, details: rejected.details },
      requestFacts: controlFacts(world, 'control-request-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 8: no subject AND no targetInstanceId -------------------------------------
let s8: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly requestFacts: number
}
{
  const world = await createP6T4World('ctl-subj-8', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-subj-8',
        } as unknown as Parameters<typeof service.requestControl>[0]),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    s8 = {
      rejected: { code: rejected.code, details: rejected.details },
      requestFacts: controlFacts(world, 'control-request-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 9: distinct subjects are distinct logical requests ------------------------
let s9: {
  readonly instanceRequestId: string
  readonly templateRequestId: string
  readonly teamRequestId: string
}
{
  const world = await createP6T4World('ctl-subj-9', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const instance = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: { kind: 'instance', instanceId: WORKER_ID },
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-subj-9',
    })
    const template = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: { kind: 'template', templateId: 'worker' },
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-subj-9',
    })
    const team = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: { kind: 'team', rootSessionId: P6T4_ROOT },
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-subj-9',
    })
    s9 = {
      instanceRequestId: instance.requestId,
      templateRequestId: template.requestId,
      teamRequestId: team.requestId,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('pre-alpha3 PR-D D.2 — the canonical ControlSubject normalization', () => {
  it('S1: an explicit instance subject (no targetInstanceId) records the subject plus the legacy projection', () => {
    expect(s1.record.subject).toEqual({ kind: 'instance', instanceId: WORKER_ID })
    // The instance subject always carries the legacy projection on the
    // durable row (byte-identical read compatibility).
    expect(s1.record.targetInstanceId).toBe(WORKER_ID)
    expect(s1.record.status).toBe('pending')
  })

  it('S2: a legacy targetInstanceId-only request normalizes to the instance subject', () => {
    expect(s2.record.subject).toEqual({ kind: 'instance', instanceId: WORKER_ID })
    expect(s2.record.targetInstanceId).toBe(WORKER_ID)
  })

  it('S3: an explicit instance subject + matching targetInstanceId is accepted and is the SAME logical request as the legacy spelling', () => {
    expect(s3.record.subject).toEqual({ kind: 'instance', instanceId: WORKER_ID })
    expect(s3.record.targetInstanceId).toBe(WORKER_ID)
    expect(s3.retryRequestId).toBe(s3.record.requestId)
  })

  it('S4: an explicit instance subject + MISMATCHING targetInstanceId is malformed (zero rows)', () => {
    expect(s4.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(s4.rejected.details?.['stage']).toBe('request')
    expect(s4.rejected.details?.['field']).toBe('targetInstanceId')
    expect(s4.requestFacts).toBe(0)
  })

  it('S5: a template subject with a present targetInstanceId is malformed (zero rows)', () => {
    expect(s5.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(s5.rejected.details?.['field']).toBe('targetInstanceId')
    expect(s5.requestFacts).toBe(0)
  })

  it('S6: a team subject with a present targetInstanceId is malformed (zero rows)', () => {
    expect(s6.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(s6.rejected.details?.['field']).toBe('targetInstanceId')
    expect(s6.requestFacts).toBe(0)
  })

  it('S7: a malformed explicit subject (unknown kind) is rejected with the subject field (zero rows)', () => {
    expect(s7.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(s7.rejected.details?.['stage']).toBe('request')
    expect(s7.rejected.details?.['field']).toBe('subject')
    expect(s7.requestFacts).toBe(0)
  })

  it('S8: no subject AND no targetInstanceId is malformed (the identity element is required; zero rows)', () => {
    expect(s8.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(s8.rejected.details?.['field']).toBe('targetInstanceId')
    expect(s8.requestFacts).toBe(0)
  })

  it('S9: distinct subjects are distinct logical requests (distinct scope keys / requestIds)', () => {
    expect(new Set([s9.instanceRequestId, s9.templateRequestId, s9.teamRequestId])).toHaveLength(3)
  })
})
