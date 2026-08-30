/**
 * P7-T1 S-ack-fingerprint — the warning ACK fingerprint contract
 * (Architecture §27.2 / §27.3, Development Plan §20.1).
 *
 * Scenarios:
 *
 * - S1: a WARNING blocks new work; acknowledging it binds an ack to the
 *   CURRENT mismatch + environment fingerprint pair (with provenance),
 *   re-derives DEGRADED_ACKNOWLEDGED durably, and reopens admission;
 * - S2: a later environment drift makes the ack STALE —the old ack does
 *   NOT cover the new mismatch (the warning blocks new work again);
 * - S3: FATAL is never ack-able (§27.2) —the state is unchanged;
 * - S4: acknowledging a PASS requirement (or an unknown one) is rejected
 *   (there is no mismatch to bind to, §27.3) —no durable change;
 * - S5: a malformed ack (blank `acknowledgedBy`) is rejected by the
 *   engine's ack DTO contract (TeamContractError / MALFORMED_DTO) during
 *   the ack-bound re-evaluation — never rewrapped, and the durable state
 *   is unchanged (the storage-level RECORD_INVALID remains the second
 *   line of defense for stored records).
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are synchronous):
 * every scenario runs at module top level, its observables are captured
 * into a plain snapshot, the world is destroyed in `finally`; the `it`
 * bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t1-ack-fingerprint
 */

import { describe, expect, it } from 'vitest'
import {
  COMPATIBILITY_ERROR_CODES,
  PROBE_TRIGGERS,
} from '../compatibility/index.js'
import type { CompatibilityStateRecord } from '../../storage/schema/index.js'
import { TeamContractError } from '../../contracts/src/index.js'
import {
  assertCompatibilityCode,
  createP7T1World,
  destroyP7T1World,
  factsSkillBaseDown,
  factsWebDown,
} from './p7t1-helpers.js'
import { captureError } from './p5t6-helpers.js'

function outcomeRows(record: CompatibilityStateRecord): readonly Record<string, unknown>[] {
  const raw = record.outcomes['requirements']
  if (!Array.isArray(raw)) throw new Error('ack-fingerprint: outcomes.requirements is not an array')
  return raw as readonly Record<string, unknown>[]
}

// ---------------------------------------------------------------------------
// S1 — WARNING → ack (bound to the current fingerprints) → DEGRADED → open
// ---------------------------------------------------------------------------
interface S1 {
  readonly blockedCode: string
  readonly blockedStatus: string | undefined
  readonly blockedRequirementIds: unknown
  readonly blockedFingerprint: string | undefined
  readonly fp1: string
  readonly verdictStatus: string
  readonly verdictGen: number
  readonly verdictUnacked: number
  readonly verdictFp: string
  readonly ackRequirementId: string | undefined
  readonly ackMismatchFp: string | undefined
  readonly ackEnvFp: string | undefined
  readonly ackBy: string | undefined
  readonly ackAt: string | undefined
  readonly ackNote: string | undefined
  readonly recordGen: number | undefined
  readonly recordStatus: string | undefined
  readonly recordAcks: number
  readonly admitAdmitted: boolean | undefined
  readonly admitWorkId: string | undefined
  readonly admitStatus: string | undefined
  readonly admitFp: string | undefined
  readonly admitGen: number | undefined
}
let s1: S1
{
  const handle = await createP7T1World('p7t1x-ack-s1')
  try {
    handle.facts.current = factsWebDown() // the `web` tool is unavailable
    const first = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const blockedError = await captureError(() => handle.prober.admitNewWork('w-blocked'))
    const blocked = assertCompatibilityCode(blockedError, COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED)
    handle.advance(2000)
    const verdict = await handle.prober.acknowledge({
      requirementId: 'req-tool-web',
      acknowledgedBy: 'alice',
      note: 'web is down, continue degraded',
    })
    const record = await handle.prober.current()
    if (record === undefined) throw new Error('S1: no durable state after ack')
    const ack = record.acknowledgements[0]
    if (ack === undefined) throw new Error('S1: no durable acknowledgement')
    const admit = await handle.prober.admitNewWork('w-degraded')
    s1 = {
      blockedCode: blocked.code,
      blockedStatus: blocked.details !== undefined ? (blocked.details['status'] as string | undefined) : undefined,
      blockedRequirementIds: blocked.details !== undefined ? blocked.details['blockingRequirementIds'] : undefined,
      blockedFingerprint: blocked.details !== undefined ? (blocked.details['fingerprint'] as string | undefined) : undefined,
      fp1: first.environmentFingerprint,
      verdictStatus: verdict.status,
      verdictGen: verdict.generation,
      verdictUnacked: verdict.unackedWarning,
      verdictFp: verdict.environmentFingerprint,
      ackRequirementId: ack.requirementId,
      ackMismatchFp: ack.mismatchFingerprint,
      ackEnvFp: ack.environmentFingerprint,
      ackBy: ack.acknowledgedBy,
      ackAt: ack.acknowledgedAt,
      ackNote: ack.note,
      recordGen: record.generation,
      recordStatus: record.status,
      recordAcks: record.acknowledgements.length,
      admitAdmitted: admit.admitted,
      admitWorkId: admit.workId,
      admitStatus: admit.status,
      admitFp: admit.fingerprint,
      admitGen: admit.generation,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S1: WARNING → ack → DEGRADED_ACKNOWLEDGED → admission reopens', () => {
  it('blocks NEW work while the warning is unacked (with the blocking facts)', () => {
    expect(s1.blockedCode).toBe('COMPATIBILITY_NEW_WORK_BLOCKED')
    expect(s1.blockedStatus).toBe('BLOCKED_WARNING')
    expect(s1.blockedRequirementIds).toEqual(['req-tool-web'])
    expect(s1.blockedFingerprint).toBe(s1.fp1)
  })
  it('re-derives DEGRADED_ACKNOWLEDGED at generation + 1 on the same fingerprint', () => {
    expect(s1.verdictStatus).toBe('DEGRADED_ACKNOWLEDGED')
    expect(s1.verdictGen).toBe(2)
    expect(s1.verdictUnacked).toBe(0)
    expect(s1.verdictFp).toBe(s1.fp1)
  })
  it('durably stores the ack bound to the CURRENT mismatch + environment pair', () => {
    expect(s1.ackRequirementId).toBe('req-tool-web')
    expect(typeof s1.ackMismatchFp).toBe('string')
    expect((s1.ackMismatchFp ?? '').startsWith('fp-v1:')).toBe(true)
    expect(s1.ackEnvFp).toBe(s1.fp1)
    expect(s1.recordStatus).toBe('DEGRADED_ACKNOWLEDGED')
    expect(s1.recordGen).toBe(2)
    expect(s1.recordAcks).toBe(1)
  })
  it('records the ack provenance (who / when / note, §14.3 E)', () => {
    expect(s1.ackBy).toBe('alice')
    expect(s1.ackAt).toBe('2026-08-30T09:00:02.000Z')
    expect(s1.ackNote).toBe('web is down, continue degraded')
  })
  it('reopens new work admission under DEGRADED_ACKNOWLEDGED', () => {
    expect(s1.admitAdmitted).toBe(true)
    expect(s1.admitWorkId).toBe('work-1')
    expect(s1.admitStatus).toBe('DEGRADED_ACKNOWLEDGED')
    expect(s1.admitFp).toBe(s1.fp1)
    expect(s1.admitGen).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// S2 — environment drift after the ack => STALE (old ack covers nothing)
// ---------------------------------------------------------------------------
interface S2 {
  readonly fpA: string
  readonly driftFp: string
  readonly driftStatus: string
  readonly driftGen: number
  readonly driftUnacked: number
  readonly outcomeAckStatus: string | undefined
  readonly outcomeAckEnvFp: string | undefined
  readonly durableAckEnvFp: string | undefined
  readonly durableAckCount: number
  readonly staleCount: number | undefined
  readonly blockedCode: string
  readonly blockedStatus: string | undefined
}
let s2: S2
{
  const handle = await createP7T1World('p7t1x-ack-s2')
  try {
    handle.facts.current = factsWebDown() // generation 2
    const first = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    await handle.prober.acknowledge({ requirementId: 'req-tool-web', acknowledgedBy: 'bob' })
    const underDegraded = await handle.prober.admitNewWork('w-under-degraded')
    if (underDegraded.admitted !== true) throw new Error('S2: admission under DEGRADED_ACKNOWLEDGED failed')
    // The environment drifts again: still down, but a NEW probe generation.
    handle.facts.current = factsWebDown(3)
    const drifted = await handle.prober.probe(PROBE_TRIGGERS.CAPABILITY_GENERATION_CHANGE)
    const record = await handle.prober.current()
    if (record === undefined) throw new Error('S2: no durable state after drift probe')
    const rows = outcomeRows(record)
    const webRow = rows[0]
    if (webRow === undefined) throw new Error('S2: no web requirement row')
    const refRaw = webRow['acknowledgement']
    const ref =
      typeof refRaw === 'object' && refRaw !== null ? (refRaw as Record<string, unknown>) : undefined
    const boundRaw =
      ref !== undefined && typeof ref['acknowledgement'] === 'object' && ref['acknowledgement'] !== null
        ? (ref['acknowledgement'] as Record<string, unknown>)
        : undefined
    const durableAck = record.acknowledgements[0]
    if (durableAck === undefined) throw new Error('S2: no durable ack after drift')
    const blockedError = await captureError(() => handle.prober.admitNewWork('w-after-drift'))
    const blocked = assertCompatibilityCode(blockedError, COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED)
    const countsRaw = record.outcomes['counts']
    const staleCount =
      typeof countsRaw === 'object' && countsRaw !== null
        ? ((countsRaw as Record<string, unknown>)['staleAcknowledgement'] as number | undefined)
        : undefined
    s2 = {
      fpA: first.environmentFingerprint,
      driftFp: drifted.environmentFingerprint,
      driftStatus: drifted.status,
      driftGen: drifted.generation,
      driftUnacked: drifted.unackedWarning,
      outcomeAckStatus: ref !== undefined ? (ref['status'] as string | undefined) : undefined,
      outcomeAckEnvFp: boundRaw !== undefined ? (boundRaw['environmentFingerprint'] as string | undefined) : undefined,
      durableAckEnvFp: durableAck.environmentFingerprint,
      durableAckCount: record.acknowledgements.length,
      staleCount,
      blockedCode: blocked.code,
      blockedStatus: blocked.details !== undefined ? (blocked.details['status'] as string | undefined) : undefined,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S2: drift after the ack (the old ack is STALE, covers nothing)', () => {
  it('re-derives BLOCKED_WARNING on the new fingerprint (the ack no longer satisfies)', () => {
    expect(s2.driftFp).not.toBe(s2.fpA)
    expect(s2.driftStatus).toBe('BLOCKED_WARNING')
    expect(s2.driftGen).toBe(3)
    expect(s2.driftUnacked).toBe(1)
  })
  it('classifies the old ack STALE against the NEW mismatch (still bound to the old environment)', () => {
    expect(s2.outcomeAckStatus).toBe('STALE')
    expect(s2.outcomeAckEnvFp).toBe(s2.fpA)
    expect(s2.durableAckEnvFp).toBe(s2.fpA)
    expect(s2.durableAckCount).toBe(1)
    expect(s2.staleCount).toBe(1)
  })
  it('blocks NEW work again (drift semantics, §20.1 / §41.7)', () => {
    expect(s2.blockedCode).toBe('COMPATIBILITY_NEW_WORK_BLOCKED')
    expect(s2.blockedStatus).toBe('BLOCKED_WARNING')
  })
})

// ---------------------------------------------------------------------------
// S3 — FATAL is never ack-able (§27.2)
// ---------------------------------------------------------------------------
interface S3 {
  readonly fatalStatus: string
  readonly fatalGen: number
  readonly ackCode: string
  readonly ackReasonCode: string | undefined
  readonly recordStatus: string | undefined
  readonly recordGen: number | undefined
  readonly recordAcks: number
}
let s3: S3
{
  const handle = await createP7T1World('p7t1x-ack-s3')
  try {
    handle.facts.current = factsSkillBaseDown() // the REQUIRED skill is gone
    const first = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const ackError = await captureError(() =>
      handle.prober.acknowledge({ requirementId: 'req-skill-base', acknowledgedBy: 'alice' }),
    )
    const { code, details } = assertCompatibilityCode(
      ackError,
      COMPATIBILITY_ERROR_CODES.FATAL_NOT_ACKNOWLEDGABLE,
    )
    const record = await handle.prober.current()
    if (record === undefined) throw new Error('S3: no durable state')
    s3 = {
      fatalStatus: first.status,
      fatalGen: first.generation,
      ackCode: code,
      ackReasonCode: details !== undefined ? (details['reasonCode'] as string | undefined) : undefined,
      recordStatus: record.status,
      recordGen: record.generation,
      recordAcks: record.acknowledgements.length,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S3: FATAL is never ack-able (§27.2)', () => {
  it('classifies the unmet REQUIRED requirement FATAL (BLOCKED_FATAL)', () => {
    expect(s3.fatalStatus).toBe('BLOCKED_FATAL')
    expect(s3.fatalGen).toBe(1)
  })
  it('rejects the acknowledgement (no Continue Anyway for structural failures)', () => {
    expect(s3.ackCode).toBe('COMPATIBILITY_FATAL_NOT_ACKNOWLEDGABLE')
    expect(s3.ackReasonCode).toBe('COMPLETE_REQUIREMENT_NOT_MET')
  })
  it('leaves the durable state untouched (no ack, no generation bump)', () => {
    expect(s3.recordStatus).toBe('BLOCKED_FATAL')
    expect(s3.recordGen).toBe(1)
    expect(s3.recordAcks).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// S4 — ack targets: PASS has nothing to bind to; unknown ids are rejected
// ---------------------------------------------------------------------------
interface S4 {
  readonly passCode: string
  readonly passOutcome: string | undefined
  readonly unknownCode: string
  readonly unknownOutcome: string | undefined
  readonly recordStatus: string | undefined
  readonly recordGen: number | undefined
  readonly recordAcks: number
}
let s4: S4
{
  const handle = await createP7T1World('p7t1x-ack-s4')
  try {
    const first = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    if (first.status !== 'OPEN') throw new Error('S4: first probe was not OPEN')
    const passError = await captureError(() =>
      handle.prober.acknowledge({ requirementId: 'req-tool-web', acknowledgedBy: 'alice' }),
    )
    const pass = assertCompatibilityCode(passError, COMPATIBILITY_ERROR_CODES.ACK_TARGET_NOT_WARNING)
    const unknownError = await captureError(() =>
      handle.prober.acknowledge({ requirementId: 'req-ghost-tool', acknowledgedBy: 'alice' }),
    )
    const unknown = assertCompatibilityCode(unknownError, COMPATIBILITY_ERROR_CODES.ACK_TARGET_NOT_WARNING)
    const record = await handle.prober.current()
    if (record === undefined) throw new Error('S4: no durable state')
    s4 = {
      passCode: pass.code,
      passOutcome: pass.details !== undefined ? (pass.details['outcome'] as string | undefined) : undefined,
      unknownCode: unknown.code,
      unknownOutcome: unknown.details !== undefined ? (unknown.details['outcome'] as string | undefined) : undefined,
      recordStatus: record.status,
      recordGen: record.generation,
      recordAcks: record.acknowledgements.length,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S4: ack targets that are not a WARNING (no mismatch to bind)', () => {
  it('rejects an ack of a PASS requirement (nothing to bind, §27.3)', () => {
    expect(s4.passCode).toBe('COMPATIBILITY_ACK_TARGET_NOT_WARNING')
    expect(s4.passOutcome).toBe('PASS')
  })
  it('rejects an ack of an unknown requirement id', () => {
    expect(s4.unknownCode).toBe('COMPATIBILITY_ACK_TARGET_NOT_WARNING')
    expect(s4.unknownOutcome).toBe('ABSENT')
  })
  it('leaves the durable state untouched (rejected acks are never stored)', () => {
    expect(s4.recordStatus).toBe('OPEN')
    expect(s4.recordGen).toBe(1)
    expect(s4.recordAcks).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// S5 — malformed ack (blank acknowledgedBy): the engine DTO contract
//      rejects it before the durable layer ever sees the record
// ---------------------------------------------------------------------------
interface S5 {
  readonly isContractError: boolean
  readonly errorName: string
  readonly errorCode: string | undefined
  readonly messageHasField: boolean
  readonly recordStatus: string | undefined
  readonly recordGen: number | undefined
  readonly recordAcks: number
}
let s5: S5
{
  const handle = await createP7T1World('p7t1x-ack-s5')
  try {
    handle.facts.current = factsWebDown()
    const first = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    if (first.status !== 'BLOCKED_WARNING') throw new Error('S5: first probe was not BLOCKED_WARNING')
    const error = await captureError(() =>
      handle.prober.acknowledge({ requirementId: 'req-tool-web', acknowledgedBy: '' }),
    )
    const record = await handle.prober.current()
    if (record === undefined) throw new Error('S5: no durable state')
    const asError = error as { name?: unknown; code?: unknown; message?: unknown }
    s5 = {
      isContractError: error instanceof TeamContractError,
      errorName: typeof asError.name === 'string' ? asError.name : String(asError.name),
      errorCode: typeof asError.code === 'string' ? asError.code : undefined,
      messageHasField: typeof asError.message === 'string' && asError.message.includes('acknowledgedBy'),
      recordStatus: record.status,
      recordGen: record.generation,
      recordAcks: record.acknowledgements.length,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S5: malformed ack rejected by the engine DTO contract', () => {
  it('surfaces the domain TeamContractError (MALFORMED_DTO), never a CompatibilityError', () => {
    expect(s5.isContractError).toBe(true)
    expect(s5.errorName).toBe('TeamContractError')
    expect(s5.errorCode).toBe('MALFORMED_DTO')
    expect(s5.messageHasField).toBe(true)
  })
  it('leaves the durable state untouched (the bad ack never lands)', () => {
    expect(s5.recordStatus).toBe('BLOCKED_WARNING')
    expect(s5.recordGen).toBe(1)
    expect(s5.recordAcks).toBe(0)
  })
})
