/**
 * P7-T1 S-inflight-drift — the in-flight work contract under capability
 * drift (Development Plan §20.1 "already admitted work: may settle",
 * Architecture §28.2 / §41.7).
 *
 * Compatibility drift 不自动取消正在执行的 model/tool operation: work
 * admitted BEFORE the drift keeps its settlement right under ANY later
 * compatibility state; the settle path never consults the current
 * compatibility state. NEW work, in contrast, is gated at the current
 * state (blocked on BLOCKED_WARNING / BLOCKED_FATAL until repair or ack).
 *
 * Scenarios (the §41.7 drift scenario, end to end):
 *
 * - S1: admit at OPEN → the capability disappears → BLOCKED_WARNING →
 *   NEW work blocked (with the blocking facts) → the in-flight work
 *   SETTLES → the settle does NOT reopen admission → the environment is
 *   repaired → new admission reopens at a new generation;
 * - S2: the ack path instead of repair reopens admission
 *   (DEGRADED_ACKNOWLEDGED); the in-flight work still settles;
 * - S3: the in-flight work settles even under BLOCKED_FATAL (drift never
 *   cancels in-flight work);
 * - S4: settle guards (double settle → WORK_ALREADY_SETTLED; unknown work
 *   → WORK_UNKNOWN).
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are synchronous):
 * every scenario runs at module top level, its observables are captured
 * into a plain snapshot, the world is destroyed in `finally`; the `it`
 * bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t1-inflight-drift
 */

import { describe, expect, it } from 'vitest'
import { COMPATIBILITY_ERROR_CODES, PROBE_TRIGGERS } from '../compatibility/index.js'
import { makeEnvironmentFacts } from './p6t1-helpers.js'
import {
  assertCompatibilityCode,
  createP7T1World,
  destroyP7T1World,
  factsSkillBaseDown,
  factsWebDown,
} from './p7t1-helpers.js'
import { captureError } from './p5t6-helpers.js'

/** The repaired environment (the tool is back at a new probe generation). */
function repairedFacts(): ReturnType<typeof makeEnvironmentFacts> {
  return makeEnvironmentFacts([
    { domain: 'tool', subject: 'web', available: true, generation: 2 },
  ])
}

// ---------------------------------------------------------------------------
// S1 — the §41.7 scenario: admit → drift → block → settle → repair → open
// ---------------------------------------------------------------------------
interface S1 {
  readonly admit1WorkId: string | undefined
  readonly admit1Gen: number | undefined
  readonly admit1Status: string | undefined
  readonly driftStatus: string
  readonly driftGen: number
  readonly driftFp: string
  readonly driftKind: string
  readonly enforceBlockedCode: string
  readonly blockedCode: string
  readonly blockedStatus: string | undefined
  readonly blockedRequirementIds: unknown
  readonly blockedFingerprint: string | undefined
  readonly blockedGeneration: number | undefined
  readonly settledWorkId: string | undefined
  readonly settledAt: string | undefined
  readonly settledAdmittedGeneration: number | undefined
  readonly enforceAfterSettleCode: string
  readonly repairStatus: string
  readonly repairGen: number
  readonly enforceAfterRepairOk: boolean
  readonly admit3Admitted: boolean | undefined
  readonly admit3Gen: number | undefined
}
let s1: S1
{
  const handle = await createP7T1World('p7t1x-drift-s1')
  try {
    const before = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const admit1 = await handle.prober.admitNewWork('w1')
    // The capability disappears: the `web` tool goes away.
    handle.facts.current = factsWebDown()
    const drift = await handle.prober.probe(PROBE_TRIGGERS.CAPABILITY_GENERATION_CHANGE)
    const driftObs = handle.observations[handle.observations.length - 1]
    if (driftObs === undefined) throw new Error('S1: no drift observation captured')
    const enforceBlockedError = await captureError(() => handle.prober.enforceNewWorkAdmission())
    const enforceBlocked = assertCompatibilityCode(enforceBlockedError, COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED)
    const blockedError = await captureError(() => handle.prober.admitNewWork('w2'))
    const blocked = assertCompatibilityCode(blockedError, COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED)
    // Already admitted work may settle (§28.2) — even under the block.
    handle.advance(1000)
    const settled = await handle.prober.settleWork(admit1.workId)
    const enforceAfterSettleError = await captureError(() => handle.prober.enforceNewWorkAdmission())
    const enforceAfterSettle = assertCompatibilityCode(enforceAfterSettleError, COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED)
    // The user repairs the config; the probe re-derives OPEN.
    handle.facts.current = repairedFacts()
    const repair = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    let enforceAfterRepairOk = true
    try {
      await handle.prober.enforceNewWorkAdmission()
    } catch {
      enforceAfterRepairOk = false
    }
    const admit3 = await handle.prober.admitNewWork('w3')
    s1 = {
      admit1WorkId: admit1.workId,
      admit1Gen: admit1.generation,
      admit1Status: admit1.status,
      driftStatus: drift.status,
      driftGen: drift.generation,
      driftFp: drift.environmentFingerprint,
      driftKind: driftObs.drift.kind,
      enforceBlockedCode: enforceBlocked.code,
      blockedCode: blocked.code,
      blockedStatus: blocked.details !== undefined ? (blocked.details['status'] as string | undefined) : undefined,
      blockedRequirementIds: blocked.details !== undefined ? blocked.details['blockingRequirementIds'] : undefined,
      blockedFingerprint: blocked.details !== undefined ? (blocked.details['fingerprint'] as string | undefined) : undefined,
      blockedGeneration: blocked.details !== undefined ? (blocked.details['generation'] as number | undefined) : undefined,
      settledWorkId: settled.workId,
      settledAt: settled.settledAt,
      settledAdmittedGeneration: settled.admittedGeneration,
      enforceAfterSettleCode: enforceAfterSettle.code,
      repairStatus: repair.status,
      repairGen: repair.generation,
      enforceAfterRepairOk,
      admit3Admitted: admit3.admitted,
      admit3Gen: admit3.generation,
    }
    if (before.status !== 'OPEN') throw new Error('S1: first probe was not OPEN')
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S1: the §41.7 drift scenario (admit → drift → block → settle → repair)', () => {
  it('admits the first work at OPEN generation 1', () => {
    expect(s1.admit1WorkId).toBe('work-1')
    expect(s1.admit1Gen).toBe(1)
    expect(s1.admit1Status).toBe('OPEN')
  })
  it('classifies the drift (BLOCKED_WARNING on the new fingerprint, generation + 1)', () => {
    expect(s1.driftStatus).toBe('BLOCKED_WARNING')
    expect(s1.driftGen).toBe(2)
    expect(s1.driftFp.startsWith('fp-v1:')).toBe(true)
    expect(s1.driftKind).toBe('ENVIRONMENT_DRIFT')
  })
  it('blocks NEW work via both gate forms, with the blocking facts', () => {
    expect(s1.enforceBlockedCode).toBe('COMPATIBILITY_NEW_WORK_BLOCKED')
    expect(s1.blockedCode).toBe('COMPATIBILITY_NEW_WORK_BLOCKED')
    expect(s1.blockedStatus).toBe('BLOCKED_WARNING')
    expect(s1.blockedRequirementIds).toEqual(['req-tool-web'])
    expect(s1.blockedFingerprint).toBe(s1.driftFp)
    expect(s1.blockedGeneration).toBe(2)
  })
  it('lets the already admitted work settle (settledAt stamped, admission binding kept)', () => {
    expect(s1.settledWorkId).toBe('work-1')
    expect(s1.settledAt).toBe('2026-08-30T09:00:01.000Z')
    expect(s1.settledAdmittedGeneration).toBe(1)
  })
  it('does NOT reopen admission from the settle (the block is environmental, not per-work)', () => {
    expect(s1.enforceAfterSettleCode).toBe('COMPATIBILITY_NEW_WORK_BLOCKED')
  })
  it('reopens new admission after the environment is repaired (new generation)', () => {
    expect(s1.repairStatus).toBe('OPEN')
    expect(s1.repairGen).toBe(3)
    expect(s1.enforceAfterRepairOk).toBe(true)
    expect(s1.admit3Admitted).toBe(true)
    expect(s1.admit3Gen).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// S2 — the ack path reopens instead of repair
// ---------------------------------------------------------------------------
interface S2 {
  readonly driftStatus: string
  readonly blockedCode: string
  readonly ackStatus: string
  readonly ackGen: number
  readonly settledWorkId: string | undefined
  readonly settledAdmittedGeneration: number | undefined
  readonly admit2Admitted: boolean | undefined
  readonly admit2Status: string | undefined
  readonly admit2Gen: number | undefined
}
let s2: S2
{
  const handle = await createP7T1World('p7t1x-drift-s2')
  try {
    await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const admit1 = await handle.prober.admitNewWork('w1')
    handle.facts.current = factsWebDown()
    const drift = await handle.prober.probe(PROBE_TRIGGERS.CAPABILITY_GENERATION_CHANGE)
    const blockedError = await captureError(() => handle.prober.admitNewWork('w2'))
    const blocked = assertCompatibilityCode(blockedError, COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED)
    // Instead of repairing the environment, the user acknowledges.
    const verdict = await handle.prober.acknowledge({ requirementId: 'req-tool-web', acknowledgedBy: 'dave' })
    const settled = await handle.prober.settleWork(admit1.workId)
    const admit2 = await handle.prober.admitNewWork('w3')
    s2 = {
      driftStatus: drift.status,
      blockedCode: blocked.code,
      ackStatus: verdict.status,
      ackGen: verdict.generation,
      settledWorkId: settled.workId,
      settledAdmittedGeneration: settled.admittedGeneration,
      admit2Admitted: admit2.admitted,
      admit2Status: admit2.status,
      admit2Gen: admit2.generation,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S2: the ack path reopens (instead of repair)', () => {
  it('blocks new work on the drift, then the ack re-derives DEGRADED_ACKNOWLEDGED', () => {
    expect(s2.driftStatus).toBe('BLOCKED_WARNING')
    expect(s2.blockedCode).toBe('COMPATIBILITY_NEW_WORK_BLOCKED')
    expect(s2.ackStatus).toBe('DEGRADED_ACKNOWLEDGED')
    expect(s2.ackGen).toBe(3)
  })
  it('settles the in-flight work and admits new work under the degraded state', () => {
    expect(s2.settledWorkId).toBe('work-1')
    expect(s2.settledAdmittedGeneration).toBe(1)
    expect(s2.admit2Admitted).toBe(true)
    expect(s2.admit2Status).toBe('DEGRADED_ACKNOWLEDGED')
    expect(s2.admit2Gen).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// S3 — the in-flight work settles even under BLOCKED_FATAL
// ---------------------------------------------------------------------------
interface S3 {
  readonly driftStatus: string
  readonly driftGen: number
  readonly blockedCode: string
  readonly blockedStatus: string | undefined
  readonly settledWorkId: string | undefined
  readonly settledAdmittedGeneration: number | undefined
  readonly enforceCode: string
}
let s3: S3
{
  const handle = await createP7T1World('p7t1x-drift-s3')
  try {
    await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const admit1 = await handle.prober.admitNewWork('w1')
    handle.facts.current = factsSkillBaseDown() // the REQUIRED skill vanishes
    const drift = await handle.prober.probe(PROBE_TRIGGERS.CAPABILITY_GENERATION_CHANGE)
    const blockedError = await captureError(() => handle.prober.admitNewWork('w2'))
    const blocked = assertCompatibilityCode(blockedError, COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED)
    const settled = await handle.prober.settleWork(admit1.workId)
    const enforceError = await captureError(() => handle.prober.enforceNewWorkAdmission())
    const enforce = assertCompatibilityCode(enforceError, COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED)
    s3 = {
      driftStatus: drift.status,
      driftGen: drift.generation,
      blockedCode: blocked.code,
      blockedStatus: blocked.details !== undefined ? (blocked.details['status'] as string | undefined) : undefined,
      settledWorkId: settled.workId,
      settledAdmittedGeneration: settled.admittedGeneration,
      enforceCode: enforce.code,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S3: in-flight work settles even under BLOCKED_FATAL (§28.2)', () => {
  it('classifies the drift BLOCKED_FATAL (the required capability is gone)', () => {
    expect(s3.driftStatus).toBe('BLOCKED_FATAL')
    expect(s3.driftGen).toBe(2)
  })
  it('blocks NEW work under BLOCKED_FATAL', () => {
    expect(s3.blockedCode).toBe('COMPATIBILITY_NEW_WORK_BLOCKED')
    expect(s3.blockedStatus).toBe('BLOCKED_FATAL')
  })
  it('still settles the pre-drift work (drift never cancels in-flight work)', () => {
    expect(s3.settledWorkId).toBe('work-1')
    expect(s3.settledAdmittedGeneration).toBe(1)
    expect(s3.enforceCode).toBe('COMPATIBILITY_NEW_WORK_BLOCKED')
  })
})

// ---------------------------------------------------------------------------
// S4 — settle guards (double settle, unknown work)
// ---------------------------------------------------------------------------
interface S4 {
  readonly doubleCode: string
  readonly doubleAdmittedGeneration: number | undefined
  readonly unknownCode: string
  readonly unknownWorkIdInMessage: boolean
  readonly admitStillOpenAdmitted: boolean | undefined
}
let s4: S4
{
  const handle = await createP7T1World('p7t1x-drift-s4')
  try {
    await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const admit1 = await handle.prober.admitNewWork('w1')
    await handle.prober.settleWork(admit1.workId)
    const doubleError = await captureError(() => handle.prober.settleWork(admit1.workId))
    const double = assertCompatibilityCode(doubleError, COMPATIBILITY_ERROR_CODES.WORK_ALREADY_SETTLED)
    const unknownError = await captureError(() => handle.prober.settleWork('work-never-admitted'))
    const unknown = assertCompatibilityCode(unknownError, COMPATIBILITY_ERROR_CODES.WORK_UNKNOWN)
    const asUnknown = unknownError as { message?: unknown }
    const admit2 = await handle.prober.admitNewWork('w2')
    s4 = {
      doubleCode: double.code,
      doubleAdmittedGeneration: double.details !== undefined ? (double.details['admittedGeneration'] as number | undefined) : undefined,
      unknownCode: unknown.code,
      unknownWorkIdInMessage: typeof asUnknown.message === 'string' && asUnknown.message.includes('work-never-admitted'),
      admitStillOpenAdmitted: admit2.admitted,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S4: settle guards', () => {
  it('rejects a double settle (WORK_ALREADY_SETTLED, the admission binding is reported)', () => {
    expect(s4.doubleCode).toBe('COMPATIBILITY_WORK_ALREADY_SETTLED')
    expect(s4.doubleAdmittedGeneration).toBe(1)
  })
  it('rejects settling a work this prober never admitted (WORK_UNKNOWN)', () => {
    expect(s4.unknownCode).toBe('COMPATIBILITY_WORK_UNKNOWN')
    expect(s4.unknownWorkIdInMessage).toBe(true)
  })
  it('keeps admitting new work (settling one work is not a state change)', () => {
    expect(s4.admitStillOpenAdmitted).toBe(true)
  })
})
