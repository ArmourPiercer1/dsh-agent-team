/**
 * P8-S4A — the SINGLE compatibility admission authority: the exact chain
 * (closure plan §17.1; DevPlan §20.1 trigger 5; Architecture §27/§28).
 *
 * Authority-level acceptance for the C-items that are defined by the chain
 * itself (the entry-point half — C3/C4/C5 — lives in
 * `p8s4a-entrypoints.test.ts`):
 *
 * - C1: a STALE durable OPEN verdict (fingerprint unrelated to the live
 *   environment) is NEVER trusted — the next work re-probes inline under
 *   `STALE_GENERATION_BEFORE_NEW_WORK` and the fresh re-derivation (the
 *   environment has since degraded to FATAL) blocks; the stale row is
 *   REPLACED (new generation, new fingerprint);
 * - C2: a WARNING acknowledgement that was VALID becomes STALE after an
 *   environment drift — the authority's next admission re-probes, the
 *   durable ack is re-classified STALE against the new fingerprint, and
 *   the (previously DEGRADED) state blocks NEW work again;
 * - C6: FATAL is never ack-able (Architecture §27.2) — `acknowledge`
 *   rejects the FATAL requirement (FATAL_NOT_ACKNOWLEDGABLE), the durable
 *   state is unchanged, and the authority's admission blocks (FATAL is
 *   never an admission).
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are synchronous):
 * every scenario runs at module top level, its observables are captured
 * into a plain snapshot, the world is destroyed in `finally`; the `it`
 * bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p8s4a-chain
 */

import { describe, expect, it } from 'vitest'
import {
  COMPATIBILITY_ERROR_CODES,
  PROBE_TRIGGERS,
} from '../compatibility/index.js'
import type { CompatibilityAdmissionDecision } from '../compatibility/index.js'
import {
  assertCompatibilityCode,
  factsSkillBaseDown,
  factsWebDown,
} from './p7t1-helpers.js'
import { captureError } from './p5t6-helpers.js'
import {
  createP8S4AAuthorityWorld,
  destroyP8S4AAuthorityWorld,
  outcomeAck,
  outcomeRows,
  plantStaleRow,
} from './p8s4a-helpers.js'

/** Safe projection of one admission decision (test failure on bad shape). */
function decisionFields(decision: CompatibilityAdmissionDecision): {
  readonly decision: string
  readonly status: string | undefined
  readonly fingerprint: string | undefined
  readonly generation: number | undefined
  readonly reprobed: boolean | undefined
  readonly blockingRequirementIds: string[]
  readonly blockingFatal: boolean
} {
  if (decision.decision === 'reprobe') {
    return {
      decision: 'reprobe',
      status: undefined,
      fingerprint: decision.fingerprint,
      generation: undefined,
      reprobed: undefined,
      blockingRequirementIds: [],
      blockingFatal: false,
    }
  }
  const blocking =
    decision.decision === 'block'
      ? decision.blockingRequirements.map((requirement) => requirement.requirementId)
      : []
  return {
    decision: decision.decision,
    status: decision.status,
    fingerprint: decision.fingerprint,
    generation: decision.generation,
    reprobed: decision.reprobed,
    blockingRequirementIds: blocking,
    blockingFatal:
      decision.decision === 'block' &&
      decision.blockingRequirements.some((requirement) => requirement.outcome === 'FATAL'),
  }
}

// ---------------------------------------------------------------------------
// C1 — a STALE durable OPEN verdict is never trusted (reprobe -> block)
// ---------------------------------------------------------------------------
interface C1 {
  readonly plantedFingerprint: string
  readonly decision: string
  readonly status: string | undefined
  readonly reprobed: boolean | undefined
  readonly blockingRequirementIds: string[]
  readonly blockingFatal: boolean
  readonly rowStatus: string | undefined
  readonly rowGeneration: number | undefined
  readonly rowFingerprint: string | undefined
  readonly rowReplaced: boolean
}
let c1: C1
{
  const handle = await createP8S4AAuthorityWorld('p8s4a-c1')
  try {
    // Plant a STALE durable OPEN verdict: its fingerprint is unrelated to
    // the live environment (the authority must re-probe, never trust).
    await plantStaleRow(handle.world, {
      status: 'OPEN',
      fingerprint: 'fp-p8s4a-stale-open',
      generation: 1,
    })
    // The environment has since degraded (the required skill is gone).
    handle.facts.current = factsSkillBaseDown()
    const decision = decisionFields(await handle.authority.admit())
    const row = await handle.authority.current()
    c1 = {
      plantedFingerprint: 'fp-p8s4a-stale-open',
      decision: decision.decision,
      status: decision.status,
      reprobed: decision.reprobed,
      blockingRequirementIds: decision.blockingRequirementIds,
      blockingFatal: decision.blockingFatal,
      rowStatus: row !== undefined ? row.status : undefined,
      rowGeneration: row !== undefined ? row.generation : undefined,
      rowFingerprint: row !== undefined ? row.fingerprint : undefined,
      rowReplaced:
        row !== undefined && row.fingerprint !== 'fp-p8s4a-stale-open',
    }
  } finally {
    await destroyP8S4AAuthorityWorld(handle)
  }
}

describe('P8-S4A C1: a stale durable OPEN verdict is never trusted', () => {
  it('re-probes inline (reprobed: true) rather than admitting on the stale row', () => {
    expect(c1.reprobed).toBe(true)
  })
  it('fails closed: the fresh re-derivation blocks (the env is now FATAL)', () => {
    expect(c1.decision).toBe('block')
    expect(c1.status).toBe('BLOCKED_FATAL')
    expect(c1.blockingFatal).toBe(true)
    expect(c1.blockingRequirementIds.includes('req-skill-base')).toBe(true)
  })
  it('replaces the stale row (new generation, new fingerprint)', () => {
    expect(c1.rowStatus).toBe('BLOCKED_FATAL')
    expect(c1.rowGeneration).toBe(2)
    expect(c1.rowReplaced).toBe(true)
    expect(c1.rowFingerprint === c1.plantedFingerprint).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// C2 — a stale ACK after environment drift is INVALID (re-classified)
// ---------------------------------------------------------------------------
interface C2 {
  readonly fpAfterAck: string
  readonly fpAfterDrift: string
  readonly fpMoved: boolean
  readonly decision: string
  readonly status: string | undefined
  readonly reprobed: boolean | undefined
  readonly rowStatus: string | undefined
  readonly ackStatus: string | undefined
  readonly staleCount: number | undefined
}
let c2: C2
{
  const handle = await createP8S4AAuthorityWorld('p8s4a-c2')
  try {
    // The `web` tool is unavailable (the ack-able WARNING).
    handle.facts.current = factsWebDown()
    const first = await handle.authority.reprobe(PROBE_TRIGGERS.NEW_ACTIVATION)
    // Acknowledge the warning (binds the ack to the current fingerprints).
    await handle.authority.acknowledge({
      requirementId: 'req-tool-web',
      acknowledgedBy: 'alice',
      note: 'web down, continue degraded',
    })
    const afterAck = await handle.authority.current()
    if (afterAck === undefined) throw new Error('C2: no durable state after ack')
    // The environment drifts: still down, but a NEW probe generation (the
    // relevant fact's generation moves the environment fingerprint).
    handle.facts.current = factsWebDown(3)
    const decision = decisionFields(await handle.authority.admit())
    const row = await handle.authority.current()
    if (row === undefined) throw new Error('C2: no durable state after admit')
    const rows = outcomeRows(row)
    const webRow = rows[0]
    if (webRow === undefined) throw new Error('C2: no web requirement row')
    const ack = outcomeAck(webRow)
    const countsRaw = row.outcomes['counts']
    const staleCount =
      typeof countsRaw === 'object' && countsRaw !== null
        ? ((countsRaw as Record<string, unknown>)['staleAcknowledgement'] as number | undefined)
        : undefined
    c2 = {
      fpAfterAck: afterAck.fingerprint,
      fpAfterDrift: row.fingerprint,
      fpMoved: row.fingerprint !== afterAck.fingerprint,
      decision: decision.decision,
      status: decision.status,
      reprobed: decision.reprobed,
      rowStatus: row.status,
      ackStatus: ack.status,
      staleCount,
    }
    void first
  } finally {
    await destroyP8S4AAuthorityWorld(handle)
  }
}

describe('P8-S4A C2: a stale ACK after drift is invalid', () => {
  it('the environment fingerprint moved with the drift', () => {
    expect(c2.fpMoved).toBe(true)
  })
  it('the authority re-probes (freshness) and does NOT admit on the stale ack', () => {
    expect(c2.reprobed).toBe(true)
    expect(c2.decision).toBe('block')
  })
  it('the durable ack is re-classified STALE (it no longer covers the mismatch)', () => {
    expect(c2.ackStatus).toBe('STALE')
    expect(c2.staleCount).toBe(1)
  })
  it('the (previously DEGRADED) state blocks NEW work again', () => {
    expect(c2.rowStatus).toBe('BLOCKED_WARNING')
    expect(c2.status).toBe('BLOCKED_WARNING')
  })
})

// ---------------------------------------------------------------------------
// C6 — FATAL is never ack-able (and never an admission)
// ---------------------------------------------------------------------------
interface C6 {
  readonly fatalStatus: string
  readonly ackCode: string
  readonly ackReasonCode: string | undefined
  readonly rowStatus: string | undefined
  readonly rowGeneration: number | undefined
  readonly rowAcks: number
  readonly decision: string
  readonly decisionStatus: string | undefined
  readonly decisionFatal: boolean
}
let c6: C6
{
  const handle = await createP8S4AAuthorityWorld('p8s4a-c6')
  try {
    // The REQUIRED skill is gone (FATAL — no ack path).
    handle.facts.current = factsSkillBaseDown()
    const first = await handle.authority.reprobe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const ackError = await captureError(() =>
      handle.authority.acknowledge({
        requirementId: 'req-skill-base',
        acknowledgedBy: 'alice',
      }),
    )
    const { code, details } = assertCompatibilityCode(
      ackError,
      COMPATIBILITY_ERROR_CODES.FATAL_NOT_ACKNOWLEDGABLE,
    )
    const row = await handle.authority.current()
    if (row === undefined) throw new Error('C6: no durable state')
    const decision = decisionFields(await handle.authority.admit())
    c6 = {
      fatalStatus: first.status,
      ackCode: code,
      ackReasonCode:
        details !== undefined ? (details['reasonCode'] as string | undefined) : undefined,
      rowStatus: row.status,
      rowGeneration: row.generation,
      rowAcks: row.acknowledgements.length,
      decision: decision.decision,
      decisionStatus: decision.status,
      decisionFatal: decision.blockingFatal,
    }
  } finally {
    await destroyP8S4AAuthorityWorld(handle)
  }
}

describe('P8-S4A C6: FATAL is never ack-able', () => {
  it('the environment is BLOCKED_FATAL', () => {
    expect(c6.fatalStatus).toBe('BLOCKED_FATAL')
  })
  it('acknowledge rejects the FATAL requirement (FATAL_NOT_ACKNOWLEDGABLE)', () => {
    expect(c6.ackCode).toBe('COMPATIBILITY_FATAL_NOT_ACKNOWLEDGABLE')
  })
  it('leaves the durable state untouched (no ack ever lands)', () => {
    expect(c6.rowStatus).toBe('BLOCKED_FATAL')
    expect(c6.rowGeneration).toBe(1)
    expect(c6.rowAcks).toBe(0)
  })
  it('the admission blocks (FATAL is never an admission)', () => {
    expect(c6.decision).toBe('block')
    expect(c6.decisionStatus).toBe('BLOCKED_FATAL')
    expect(c6.decisionFatal).toBe(true)
  })
})
