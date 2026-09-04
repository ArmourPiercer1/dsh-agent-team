/**
 * p7t7-integrated-drift-ack.test.ts — P7-T7 G7 criteria 1 + 2 (DevPlan
 * §20.7), integrated over the REAL P7-T1 compatibility prober (TaskDoc
 * §11.8 P7-T7: "ACK integrated suite"):
 *
 * - criterion 1 (warning/fatal admission semantics): an unmet OPTIONAL
 *   requirement is a WARNING that BLOCKS new work until acknowledged
 *   (DEGRADED_ACKNOWLEDGED reopens admission); an unmet REQUIRED
 *   requirement is FATAL — it blocks new work and is never ack-able;
 * - criterion 2 (ack fingerprint invalidation): an ack is bound to the
 *   CURRENT mismatch + environment fingerprint pair; a later environment
 *   drift changes the fingerprint, the old ack goes STALE, and admission
 *   blocks again;
 * - in BOTH scenarios the legacy home inspected by the P7-T7 reader is
 *   untouched (read-only isolation): the inspection view is identical
 *   before/after the runtime scenario and the port log carries only read
 *   ops (the runtime never reads or writes the legacy home through the
 *   reader).
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are synchronous):
 * each scenario runs at module top level, its observables are captured
 * into a plain snapshot; the `it` bodies assert only over the captured
 * data.
 *
 * @module @dsh-agent-team/legacy/test/p7t7-integrated-drift-ack
 */

import { describe, expect, it } from 'vitest'
import {
  COMPATIBILITY_ERROR_CODES,
  PROBE_TRIGGERS,
} from '../../runtime/compatibility/index.js'
import {
  assertCompatibilityCode,
  createP7T1World,
  destroyP7T1World,
  factsSkillBaseDown,
  factsWebDown,
} from '../../runtime/test/p7t1-helpers.js'
import { inspectLegacyTeam } from '../session-reader/index.js'
import {
  P7T7_REQUEST,
  buildP7T7LegacyHome,
  homeTreeSnapshot,
  RecordingLegacyHomePort,
  viewJson,
} from './p7t7-helpers.js'
import { captureError } from '../../runtime/test/p5t6-helpers.js'

/** One isolated legacy-home fixture (reader view + recording port). */
function makeLegacyHome() {
  const tree = buildP7T7LegacyHome()
  const port = new RecordingLegacyHomePort(tree)
  return {
    tree,
    port,
    request: P7T7_REQUEST,
    viewBefore: inspectLegacyTeam(port, P7T7_REQUEST),
    homeBefore: homeTreeSnapshot(tree),
  }
}

// ---------------------------------------------------------------------------
// S1 — criterion 1: warning/fatal admission semantics
// ---------------------------------------------------------------------------

const s1 = await (async () => {
  const home = makeLegacyHome()
  const handle = await createP7T1World('p7t7-ack-s1')
  try {
    // The warning phase: the optional `web` tool is down.
    handle.facts.current = factsWebDown()
    const probeWarning = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const blockedWarning = assertCompatibilityCode(
      await captureError(() => handle.prober.admitNewWork('w-blocked')),
      COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED,
    )
    const blockedWarningStatus =
      blockedWarning.details !== undefined
        ? (blockedWarning.details['status'] as string | undefined)
        : undefined
    // Acknowledge: bound to the current fingerprint pair.
    handle.advance(1000)
    const ack = await handle.prober.acknowledge({
      requirementId: 'req-tool-web',
      acknowledgedBy: 'p7t7-gate',
    })
    const recordAfterAck = await handle.prober.current()
    // Admission reopens under the acknowledged degradation.
    const admittedDecision = await handle.prober.admitNewWork('w-degraded')
    // The fatal phase: the REQUIRED `skill/base` is down.
    handle.facts.current = factsSkillBaseDown()
    const probeFatal = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const blockedFatal = assertCompatibilityCode(
      await captureError(() => handle.prober.admitNewWork('w-fatal')),
      COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED,
    )
    const blockedFatalStatus =
      blockedFatal.details !== undefined
        ? (blockedFatal.details['status'] as string | undefined)
        : undefined
    const viewAfter = inspectLegacyTeam(home.port, home.request)
    home.port.assertOnlyReadOps()
    return {
      fpWarning: probeWarning.environmentFingerprint,
      blockedWarningStatus,
      recordAfterAckStatus: recordAfterAck?.status,
      ackEnvFingerprint: ack.environmentFingerprint,
      admitted: admittedDecision.admitted,
      admittedStatus: admittedDecision.status,
      fpFatal: probeFatal.environmentFingerprint,
      blockedFatalStatus,
      viewIdentical: viewJson(viewAfter) === viewJson(home.viewBefore),
      homeIdentical: JSON.stringify(homeTreeSnapshot(home.tree)) === JSON.stringify(home.homeBefore),
      portReadsOnly: true,
    }
  } finally {
    await destroyP7T1World(handle)
  }
})()

// ---------------------------------------------------------------------------
// S2 — criterion 2: ack fingerprint invalidation (drift => STALE)
// ---------------------------------------------------------------------------

const s2 = await (async () => {
  const home = makeLegacyHome()
  const handle = await createP7T1World('p7t7-ack-s2')
  try {
    handle.facts.current = factsWebDown() // generation 2
    const probeA = await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    await handle.prober.acknowledge({ requirementId: 'req-tool-web', acknowledgedBy: 'p7t7-gate' })
    const underDegraded = await handle.prober.admitNewWork('w-under-degraded')
    // The environment drifts: still down, a NEW probe generation => a new
    // fingerprint the old ack does not cover.
    handle.facts.current = factsWebDown(3)
    const probeB = await handle.prober.probe(PROBE_TRIGGERS.CAPABILITY_GENERATION_CHANGE)
    const blockedAgain = assertCompatibilityCode(
      await captureError(() => handle.prober.admitNewWork('w-after-drift')),
      COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED,
    )
    const blockedAgainStatus =
      blockedAgain.details !== undefined
        ? (blockedAgain.details['status'] as string | undefined)
        : undefined
    const viewAfter = inspectLegacyTeam(home.port, home.request)
    home.port.assertOnlyReadOps()
    return {
      fpBeforeDrift: probeA.environmentFingerprint,
      admittedUnderAck: underDegraded.admitted,
      fpAfterDrift: probeB.environmentFingerprint,
      fingerprintsDiffer: probeA.environmentFingerprint !== probeB.environmentFingerprint,
      blockedAgainStatus,
      viewIdentical: viewJson(viewAfter) === viewJson(home.viewBefore),
      homeIdentical: JSON.stringify(homeTreeSnapshot(home.tree)) === JSON.stringify(home.homeBefore),
      portReadsOnly: true,
    }
  } finally {
    await destroyP7T1World(handle)
  }
})()

// ===========================================================================
// Assertions
// ===========================================================================

describe('P7-T7 G7 criterion 1: warning/fatal admission semantics (integrated, P7-T1 real prober)', () => {
  it('an unacked WARNING blocks new work (BLOCKED_WARNING)', () => {
    expect(s1.blockedWarningStatus).toBe('BLOCKED_WARNING')
  })
  it('acknowledging the warning reopens admission (DEGRADED_ACKNOWLEDGED)', () => {
    expect(s1.ackEnvFingerprint).toBe(s1.fpWarning)
    expect(s1.recordAfterAckStatus).toBe('DEGRADED_ACKNOWLEDGED')
    expect(s1.admitted).toBe(true)
    expect(s1.admittedStatus).toBe('DEGRADED_ACKNOWLEDGED')
  })
  it('a FATAL (required requirement down) blocks new work (BLOCKED_FATAL)', () => {
    expect(s1.blockedFatalStatus).toBe('BLOCKED_FATAL')
    expect(s1.fpFatal).not.toBe(s1.fpWarning)
  })
  it('read-only isolation: the legacy home and the reader view are untouched', () => {
    expect(s1.viewIdentical).toBe(true)
    expect(s1.homeIdentical).toBe(true)
    expect(s1.portReadsOnly).toBe(true)
  })
})

describe('P7-T7 G7 criterion 2: ack fingerprint invalidation (integrated, P7-T1 real prober)', () => {
  it('an ack under fingerprint A admits work (DEGRADED_ACKNOWLEDGED)', () => {
    expect(s2.admittedUnderAck).toBe(true)
  })
  it('drift changes the environment fingerprint', () => {
    expect(s2.fingerprintsDiffer).toBe(true)
  })
  it('the stale ack covers nothing: new work is blocked again (BLOCKED_WARNING)', () => {
    expect(s2.blockedAgainStatus).toBe('BLOCKED_WARNING')
  })
  it('read-only isolation: the legacy home and the reader view are untouched', () => {
    expect(s2.viewIdentical).toBe(true)
    expect(s2.homeIdentical).toBe(true)
    expect(s2.portReadsOnly).toBe(true)
  })
})
