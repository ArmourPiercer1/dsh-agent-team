/**
 * pre-alpha3 PR-D, D.3 — the additive review payload fields
 * (`reviewPayload?` / `reviewPayloadDigest?` / `executionCoupling?`):
 * lossless-JSON values on the durable request row, round-tripped through
 * the ledger, with ABSENT = legacy semantics (the field stays OMITTED —
 * never present-but-undefined).
 *
 * Key semantics under test:
 * - a nested lossless-JSON review payload + digest + coupling round-trips
 *   through the durable row byte-identically (deep equal after the
 *   storage round trip, and after a RESTART — the durable row is the
 *   authority, invariant 45);
 * - a PRESENT reviewPayload must be lossless JSON (a `NaN` — a number
 *   with no exact JSON round trip — is rejected as malformed, fail
 *   closed, ZERO rows);
 * - a reviewPayloadDigest REQUIRES a present reviewPayload (a digest of
 *   a payload the request does not carry is ambiguous input — malformed,
 *   ZERO rows);
 * - ABSENT fields stay OMITTED on the record (legacy semantics: no
 *   reviewPayload / reviewPayloadDigest / executionCoupling keys);
 * - the closed coupling set is enforced at request time (guarded |
 *   inline; ABSENT = the legacy guarded flow).
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
} from '../control/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  expectControlRejection,
  leaderCaller,
  restartP6T1World,
} from './p6t4-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/** The nested lossless-JSON review payload under round-trip. */
const REVIEW_PAYLOAD = {
  title: 'review the write batch',
  metrics: { p95: 1.5, count: 3 },
  tags: ['a', 'b'],
  nested: { ok: true, zero: 0, none: null },
}

// --- scenario 1: nested payload + digest + coupling round-trip ---------------------------
let s1: {
  readonly roundTripped: {
    readonly reviewPayload: unknown
    readonly reviewPayloadDigest: string | undefined
    readonly executionCoupling: string | undefined
  }
  readonly rawPayload: {
    readonly reviewPayload: unknown
    readonly reviewPayloadDigest: unknown
  }
}
{
  const world = await createP6T4World('ctl-rp-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-rp-1',
      reviewPayload: REVIEW_PAYLOAD,
      reviewPayloadDigest: 'sha256:test-digest-1',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests[0]
    const raw = controlFacts(world, 'control-request-recorded')[0]
    s1 = {
      roundTripped: {
        reviewPayload: record?.reviewPayload,
        reviewPayloadDigest: record?.reviewPayloadDigest,
        executionCoupling: record?.executionCoupling,
      },
      rawPayload: {
        reviewPayload: raw?.payload['reviewPayload'],
        reviewPayloadDigest: raw?.payload['reviewPayloadDigest'],
      },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: digest WITHOUT a payload is malformed (zero rows) ------------------------
let s2: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly requestFacts: number
}
{
  const world = await createP6T4World('ctl-rp-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          targetInstanceId: WORKER_ID,
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-rp-2',
          reviewPayloadDigest: 'sha256:orphan-digest',
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

// --- scenario 3: payload WITHOUT a digest is accepted (the digest is optional) ------------
let s3: {
  readonly hasDigestKey: boolean
  readonly reviewPayload: unknown
}
{
  const world = await createP6T4World('ctl-rp-3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-rp-3',
      reviewPayload: { note: 'no digest' },
    })
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests[0]
    s3 = {
      hasDigestKey: record !== undefined && 'reviewPayloadDigest' in record,
      reviewPayload: record?.reviewPayload,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 4: a non-lossless payload (NaN) is malformed (fail closed, zero rows) -------
let s4: {
  readonly rejected: { readonly code: string; readonly details?: Record<string, unknown> }
  readonly requestFacts: number
}
{
  const world = await createP6T4World('ctl-rp-4', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          targetInstanceId: WORKER_ID,
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-rp-4',
          reviewPayload: { metric: Number.NaN },
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

// --- scenario 5: ABSENT review fields stay OMITTED (legacy semantics) ----------------------
let s5: {
  readonly hasPayloadKey: boolean
  readonly hasDigestKey: boolean
  readonly hasCouplingKey: boolean
  readonly guardedCoupling: string | undefined
}
{
  const world = await createP6T4World('ctl-rp-5', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    // Legacy request: NO review fields at all.
    await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-rp-5',
    })
    // Explicit guarded coupling (the closed value is persisted).
    await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-rp-5b',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
    })
    const state = await service.listControlState(P6T4_ROOT)
    const legacy = state.requests.find((r) => r.correlation === 'corr-rp-5')
    const guarded = state.requests.find((r) => r.correlation === 'corr-rp-5b')
    s5 = {
      hasPayloadKey: legacy !== undefined && 'reviewPayload' in legacy,
      hasDigestKey: legacy !== undefined && 'reviewPayloadDigest' in legacy,
      hasCouplingKey: legacy !== undefined && 'executionCoupling' in legacy,
      guardedCoupling: guarded?.executionCoupling,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 6: the review payload survives a restart (durable authority) -----------------
let s6: {
  readonly reviewPayload: unknown
  readonly reviewPayloadDigest: string | undefined
}
{
  let world: P6T1World = await createP6T4World('ctl-rp-6', ['leader', 'worker'])
  try {
    {
      const service = createP6T4Service(world)
      await service.requestControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
        targetInstanceId: WORKER_ID,
        actionName: 'write-file',
        toolName: 'fs.write',
        correlation: 'corr-rp-6',
        reviewPayload: REVIEW_PAYLOAD,
        reviewPayloadDigest: 'sha256:test-digest-6',
        executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
      })
    }
    world = await restartP6T1World(world)
    const service = createP6T4Service(world)
    const state = await service.listControlState(P6T4_ROOT)
    const record = state.requests[0]
    s6 = {
      reviewPayload: record?.reviewPayload,
      reviewPayloadDigest: record?.reviewPayloadDigest,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('pre-alpha3 PR-D D.3 — the review payload round-trip', () => {
  it('S1: the nested review payload + digest + coupling round-trip through the durable row', () => {
    expect(s1.roundTripped.reviewPayload).toEqual(REVIEW_PAYLOAD)
    expect(s1.roundTripped.reviewPayloadDigest).toBe('sha256:test-digest-1')
    expect(s1.roundTripped.executionCoupling).toBe(CONTROL_EXECUTION_COUPLINGS.INLINE)
    // The RAW durable row carries the identical values (the ledger, not
    // an in-process cache, is the authority).
    expect(s1.rawPayload.reviewPayload).toEqual(REVIEW_PAYLOAD)
    expect(s1.rawPayload.reviewPayloadDigest).toBe('sha256:test-digest-1')
  })

  it('S2: a digest without a payload is malformed (zero rows)', () => {
    expect(s2.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(s2.rejected.details?.['field']).toBe('reviewPayloadDigest')
    expect(s2.requestFacts).toBe(0)
  })

  it('S3: a payload without a digest is accepted and the digest key stays ABSENT', () => {
    expect(s3.reviewPayload).toEqual({ note: 'no digest' })
    expect(s3.hasDigestKey).toBe(false)
  })

  it('S4: a non-lossless payload (NaN) is malformed — fail closed (zero rows)', () => {
    expect(s4.rejected.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(s4.rejected.details?.['field']).toBe('reviewPayload')
    expect(s4.requestFacts).toBe(0)
  })

  it('S5: ABSENT review fields stay OMITTED on the record (legacy semantics); the closed coupling value is persisted', () => {
    expect(s5.hasPayloadKey).toBe(false)
    expect(s5.hasDigestKey).toBe(false)
    expect(s5.hasCouplingKey).toBe(false)
    expect(s5.guardedCoupling).toBe(CONTROL_EXECUTION_COUPLINGS.GUARDED)
  })

  it('S6: the review payload survives a restart (the durable row is the authority)', () => {
    expect(s6.reviewPayload).toEqual(REVIEW_PAYLOAD)
    expect(s6.reviewPayloadDigest).toBe('sha256:test-digest-6')
  })
})
