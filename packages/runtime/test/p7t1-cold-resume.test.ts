/**
 * P7-T1 S-cold-resume — the cold resume re-probe contract
 * (Development Plan §20.1 triggers 1-2, Architecture §36.3).
 *
 * Cold resume 不冻结 (Architecture §36.3): provider / model / tool / skill /
 * MCP availability and external hard policy are re-checked —resume 后必须
 * 重新评估 compatibility. The P6-T1 `restartP6T1World` primitive is the
 * process-restart model (a NEW seam over the SAME scratch dir: the durable
 * TeamDomain survives, the ephemeral process state is gone).
 *
 * Scenarios:
 *
 * - S1: root cold resume after the environment drifted during downtime
 *   (BLOCKED_WARNING on the new fingerprint; NEW work blocked until the
 *   user repairs the environment — admission reopens at a new generation);
 * - S2: root cold resume with an UNCHANGED environment (OPEN preserved,
 *   generation incremented, no drift; the pre-restart in-memory in-flight
 *   ledger is gone after the process restart — the documented boundary);
 * - S3: member cold resume (same re-probe semantics, the MEMBER trigger;
 *   the ack path reopens admission after the cold-resume re-probe);
 * - S4: a stale durable state before new work forces a
 *   STALE_GENERATION_BEFORE_NEW_WORK re-probe inside `admitNewWork`
 *   (never a stale-green admission); the first-ever work on a fresh
 *   generation line is admitted after an ESTABLISHED re-probe.
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are synchronous):
 * every scenario runs at module top level, its observables are captured
 * into a plain snapshot, the world is destroyed in `finally`; the `it`
 * bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t1-cold-resume
 */

import { describe, expect, it } from 'vitest'
import { COMPATIBILITY_ERROR_CODES, PROBE_TRIGGERS } from '../compatibility/index.js'
import type { CompatibilityStateRecord } from '../../storage/schema/index.js'
import { makeEnvironmentFacts } from './p6t1-helpers.js'
import {
  assertCompatibilityCode,
  createP7T1World,
  destroyP7T1World,
  factsWebDown,
  restartP7T1World,
} from './p7t1-helpers.js'
import { captureError } from './p5t6-helpers.js'

// ---------------------------------------------------------------------------
// S1 — root cold resume after environment change during downtime
// ---------------------------------------------------------------------------
interface S1 {
  readonly fpBefore: string
  readonly resumeTrigger: string
  readonly resumeStatus: string
  readonly resumeFp: string
  readonly resumeGen: number
  readonly driftKind: string
  readonly previousGeneration: number | undefined
  readonly blockedCode: string
  readonly blockedStatus: string | undefined
  readonly repairStatus: string
  readonly repairGen: number
  readonly admitAdmitted: boolean | undefined
  readonly admitGen: number | undefined
}
let s1: S1
{
  const handle = await createP7T1World('p7t1x-resume-s1')
  try {
    const before = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    // The environment drifts during downtime: the `web` tool disappears.
    handle.facts.current = factsWebDown()
    const resumed = await restartP7T1World(handle)
    const outcome = await resumed.prober.probe(PROBE_TRIGGERS.ROOT_COLD_RESUME)
    const obs = resumed.observations[resumed.observations.length - 1]
    if (obs === undefined) throw new Error('S1: no cold-resume observation captured')
    const blockedError = await captureError(() => resumed.prober.admitNewWork('w-after-resume'))
    const blocked = assertCompatibilityCode(blockedError, COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED)
    // The user repairs the config: the tool is back at a new probe generation.
    handle.facts.current = makeEnvironmentFacts([
      { domain: 'tool', subject: 'web', available: true, generation: 2 },
    ])
    const repair = await resumed.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const admit = await resumed.prober.admitNewWork('w-repaired')
    s1 = {
      fpBefore: before.environmentFingerprint,
      resumeTrigger: outcome.trigger,
      resumeStatus: outcome.status,
      resumeFp: outcome.environmentFingerprint,
      resumeGen: outcome.generation,
      driftKind: obs.drift.kind,
      previousGeneration: obs.drift.previousGeneration,
      blockedCode: blocked.code,
      blockedStatus: blocked.details !== undefined ? (blocked.details['status'] as string | undefined) : undefined,
      repairStatus: repair.status,
      repairGen: repair.generation,
      admitAdmitted: admit.admitted,
      admitGen: admit.generation,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S1: root cold resume after environment change during downtime', () => {
  it('re-probes on ROOT_COLD_RESUME and re-classifies BLOCKED_WARNING on the new fingerprint', () => {
    expect(s1.resumeTrigger).toBe('ROOT_COLD_RESUME')
    expect(s1.resumeStatus).toBe('BLOCKED_WARNING')
    expect(s1.resumeFp).not.toBe(s1.fpBefore)
    expect(s1.resumeGen).toBe(2)
  })
  it('classifies the downtime change as drift against the durable pre-restart state', () => {
    expect(s1.driftKind).toBe('ENVIRONMENT_DRIFT')
    expect(s1.previousGeneration).toBe(1)
  })
  it('blocks NEW work after the cold resume (§20.1: 新 warning block NEW work)', () => {
    expect(s1.blockedCode).toBe('COMPATIBILITY_NEW_WORK_BLOCKED')
    expect(s1.blockedStatus).toBe('BLOCKED_WARNING')
  })
  it('reopens admission after the environment is repaired (new generation)', () => {
    expect(s1.repairStatus).toBe('OPEN')
    expect(s1.repairGen).toBe(3)
    expect(s1.admitAdmitted).toBe(true)
    expect(s1.admitGen).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// S2 — root cold resume with an unchanged environment
// ---------------------------------------------------------------------------
interface S2 {
  readonly fpBefore: string
  readonly resumeStatus: string
  readonly resumeFp: string
  readonly resumeGen: number
  readonly driftKind: string
  readonly admitAdmitted: boolean | undefined
  readonly settleErrorName: string
  readonly settleCode: string | undefined
  readonly settleMessageHasWork: boolean
}
let s2: S2
{
  const handle = await createP7T1World('p7t1x-resume-s2')
  try {
    const before = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const admitted = await handle.prober.admitNewWork('w-before-restart')
    if (admitted.admitted !== true) throw new Error('S2: pre-restart admission failed')
    const resumed = await restartP7T1World(handle)
    const outcome = await resumed.prober.probe(PROBE_TRIGGERS.ROOT_COLD_RESUME)
    const obs = resumed.observations[resumed.observations.length - 1]
    if (obs === undefined) throw new Error('S2: no cold-resume observation captured')
    // Assert the restart boundary BEFORE the restarted prober issues its
    // own work-1: the in-memory ledger (and the work-id counter) is per
    // process, so the pre-restart work is UNKNOWN to the fresh prober.
    const settleError = await captureError(() => resumed.prober.settleWork(admitted.workId))
    const admit = await resumed.prober.admitNewWork('w-after-resume')
    const asError = settleError as { name?: unknown; code?: unknown; message?: unknown }
    s2 = {
      fpBefore: before.environmentFingerprint,
      resumeStatus: outcome.status,
      resumeFp: outcome.environmentFingerprint,
      resumeGen: outcome.generation,
      driftKind: obs.drift.kind,
      admitAdmitted: admit.admitted,
      settleErrorName: typeof asError.name === 'string' ? asError.name : String(asError.name),
      settleCode: typeof asError.code === 'string' ? asError.code : undefined,
      settleMessageHasWork: typeof asError.message === 'string' && asError.message.includes('work-1'),
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S2: root cold resume with an unchanged environment', () => {
  it('re-probes, preserves OPEN, and increments the generation (no drift)', () => {
    expect(s2.resumeStatus).toBe('OPEN')
    expect(s2.resumeFp).toBe(s2.fpBefore)
    expect(s2.resumeGen).toBe(2)
    expect(s2.driftKind).toBe('NONE')
  })
  it('admits new work after the cold resume', () => {
    expect(s2.admitAdmitted).toBe(true)
  })
  it('documents the boundary: the pre-restart in-flight ledger is gone (process restart)', () => {
    expect(s2.settleErrorName).toBe('CompatibilityError')
    expect(s2.settleCode).toBe('COMPATIBILITY_WORK_UNKNOWN')
    expect(s2.settleMessageHasWork).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// S3 — member cold resume (the MEMBER trigger; the ack path reopens)
// ---------------------------------------------------------------------------
interface S3 {
  readonly resumeTrigger: string
  readonly resumeStatus: string
  readonly resumeGen: number
  readonly ackStatus: string
  readonly ackGen: number
  readonly admitAdmitted: boolean | undefined
  readonly admitStatus: string | undefined
}
let s3: S3
{
  const handle = await createP7T1World('p7t1x-resume-s3')
  try {
    await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    handle.facts.current = factsWebDown() // drifts during downtime
    const resumed = await restartP7T1World(handle)
    const outcome = await resumed.prober.probe(PROBE_TRIGGERS.MEMBER_COLD_RESUME)
    const verdict = await resumed.prober.acknowledge({
      requirementId: 'req-tool-web',
      acknowledgedBy: 'carol',
    })
    const admit = await resumed.prober.admitNewWork('w-after-ack')
    s3 = {
      resumeTrigger: outcome.trigger,
      resumeStatus: outcome.status,
      resumeGen: outcome.generation,
      ackStatus: verdict.status,
      ackGen: verdict.generation,
      admitAdmitted: admit.admitted,
      admitStatus: admit.status,
    }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S3: member cold resume (MEMBER trigger, the ack path reopens)', () => {
  it('re-probes on MEMBER_COLD_RESUME and re-classifies BLOCKED_WARNING', () => {
    expect(s3.resumeTrigger).toBe('MEMBER_COLD_RESUME')
    expect(s3.resumeStatus).toBe('BLOCKED_WARNING')
    expect(s3.resumeGen).toBe(2)
  })
  it('reopens admission via the acknowledgement (DEGRADED_ACKNOWLEDGED)', () => {
    expect(s3.ackStatus).toBe('DEGRADED_ACKNOWLEDGED')
    expect(s3.ackGen).toBe(3)
    expect(s3.admitAdmitted).toBe(true)
    expect(s3.admitStatus).toBe('DEGRADED_ACKNOWLEDGED')
  })
})

// ---------------------------------------------------------------------------
// S4 — stale durable state before new work (the freshness gate)
// ---------------------------------------------------------------------------
interface S4 {
  readonly triggers: string[]
  readonly driftKinds: string[]
  readonly blockedCode: string
  readonly blockedStatus: string | undefined
  readonly recordGen: number | undefined
  readonly recordStatus: string | undefined
  readonly freshAdmitAdmitted: boolean | undefined
  readonly freshTrigger: string | undefined
  readonly freshDrift: string | undefined
  readonly freshRecord: CompatibilityStateRecord | undefined
}
let s4: S4
{
  const handle = await createP7T1World('p7t1x-resume-s4')
  try {
    await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION) // gen 1, OPEN
    handle.facts.current = factsWebDown() // drifts, no explicit re-probe
    const blockedError = await captureError(() => handle.prober.admitNewWork('w-stale'))
    const blocked = assertCompatibilityCode(blockedError, COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED)
    const staleRecord = await handle.prober.current()
    if (staleRecord === undefined) throw new Error('S4: no durable state after the auto re-probe')
    // A FRESH generation line: the first work triggers the ESTABLISHED
    // re-probe and is admitted (OPEN environment).
    const fresh = await createP7T1World('p7t1x-resume-s4b')
    const freshAdmit = await fresh.prober.admitNewWork('w-first-ever')
    const freshObs = fresh.observations[0]
    const freshRecord = await fresh.prober.current()
    s4 = {
      triggers: handle.observations.map((obs) => obs.outcome.trigger),
      driftKinds: handle.observations.map((obs) => obs.drift.kind),
      blockedCode: blocked.code,
      blockedStatus: blocked.details !== undefined ? (blocked.details['status'] as string | undefined) : undefined,
      recordGen: staleRecord.generation,
      recordStatus: staleRecord.status,
      freshAdmitAdmitted: freshAdmit.admitted,
      freshTrigger: freshObs !== undefined ? freshObs.outcome.trigger : undefined,
      freshDrift: freshObs !== undefined ? freshObs.drift.kind : undefined,
      freshRecord,
    }
    await destroyP7T1World(fresh)
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('P7-T1 S4: stale durable state before new work (the freshness gate)', () => {
  it('forces a STALE_GENERATION_BEFORE_NEW_WORK re-probe inside admitNewWork', () => {
    expect(s4.triggers).toEqual(['NEW_ACTIVATION', 'STALE_GENERATION_BEFORE_NEW_WORK'])
    expect(s4.driftKinds).toEqual(['ESTABLISHED', 'ENVIRONMENT_DRIFT'])
  })
  it('never admits on a stale generation (blocks after the re-probe)', () => {
    expect(s4.blockedCode).toBe('COMPATIBILITY_NEW_WORK_BLOCKED')
    expect(s4.blockedStatus).toBe('BLOCKED_WARNING')
    expect(s4.recordGen).toBe(2)
    expect(s4.recordStatus).toBe('BLOCKED_WARNING')
  })
  it('admits the first-ever work after an ESTABLISHED re-probe (absent state is not stale-green)', () => {
    expect(s4.freshAdmitAdmitted).toBe(true)
    expect(s4.freshTrigger).toBe('STALE_GENERATION_BEFORE_NEW_WORK')
    expect(s4.freshDrift).toBe('ESTABLISHED')
    expect(s4.freshRecord?.generation).toBe(1)
    expect(s4.freshRecord?.status).toBe('OPEN')
  })
})
