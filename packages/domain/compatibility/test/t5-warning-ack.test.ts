/**
 * P3-T5 —warning acknowledgement lifecycle (the required "warning ack" test).
 *
 * Authority: Architecture §27.2 (Continue Anyway => acknowledged degraded;
 * FATAL 不允许Continue Anyway), §27.3 (ack binds to a specific mismatch /
 * environment generation, not a permanent flag), §28 (BLOCKED_WARNING vs
 * DEGRADED_ACKNOWLEDGED); T5 ruling (unacked WARNING stays blocking;
 * acked passes).
 */

import { describe, expect, it } from 'vitest'

import {
  ACK_STATUSES,
  COMPATIBILITY_STATUS,
  evaluateCompatibility,
} from '../src/index.js'
import type {
  CompatibilityResult,
  WarningAcknowledgement,
} from '../src/index.js'
import { BLUEPRINT_REQUIREMENTS, COMPLETE_PERSONA_REQUIREMENT } from '../fixtures/requirements.js'
import {
  COMPLETE_PERSONA_CONFLICT_FACTS,
  FULLY_COMPATIBLE_FACTS,
  MCP_UNAVAILABLE_FACTS,
  STRUCTURE_MISSING_FACTS,
} from '../fixtures/environment-facts.js'

const OPERATOR = 'test-operator'
const ACKED_AT = '2026-08-29T12:00:00.000Z'

/** Build an ack bound to the exact mismatch/environment generation of `result`. */
function ackFor(result: CompatibilityResult, requirementId: string): WarningAcknowledgement {
  const entry = result.requirements.find((item) => item.requirementId === requirementId)
  if (entry === undefined) throw new Error(`requirement '${requirementId}' missing from result`)
  if (entry.mismatchFingerprint === null) throw new Error('no mismatch fingerprint to bind an ack to')
  return {
    requirementId,
    mismatchFingerprint: entry.mismatchFingerprint,
    environmentFingerprint: result.environmentFingerprint,
    acknowledgedBy: OPERATOR,
    acknowledgedAt: ACKED_AT,
  }
}

describe('P3-T5 warning ack (unacked blocks; acked passes)', () => {
  it('an unacked WARNING stays blocking (BLOCKED_WARNING, ack MISSING)', () => {
    const result = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    const mcp = result.requirements.find((entry) => entry.requirementId === 'req-mcp-abtem')
    if (mcp === undefined) throw new Error('mcp requirement missing from result')
    expect(mcp.outcome).toBe('WARNING')
    if (mcp.acknowledgement === null) throw new Error('expected an ack reference on the WARNING')
    expect(mcp.acknowledgement.status).toBe(ACK_STATUSES.MISSING)
    expect(mcp.acknowledgement.acknowledgement).toBe(null)
    expect(result.counts.unackedWarning).toBe(1)
  })

  it('a matching ack (requirement + mismatch + environment fingerprints) passes: DEGRADED_ACKNOWLEDGED', () => {
    const first = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    const ack = ackFor(first, 'req-mcp-abtem')
    const second = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
      acknowledgements: [ack],
    })
    expect(second.status).toBe(COMPATIBILITY_STATUS.DEGRADED_ACKNOWLEDGED)
    const mcp = second.requirements.find((entry) => entry.requirementId === 'req-mcp-abtem')
    if (mcp === undefined || mcp.acknowledgement === null) throw new Error('expected acked WARNING')
    expect(mcp.outcome).toBe('WARNING') // ack never changes the outcome itself
    expect(mcp.acknowledgement.status).toBe(ACK_STATUSES.VALID)
    expect(mcp.acknowledgement.acknowledgement?.requirementId).toBe('req-mcp-abtem')
    expect(second.counts.unackedWarning).toBe(0)
    expect(second.unappliedAcknowledgements.length).toBe(0)
  })

  it('an ack bound to the wrong mismatch fingerprint is STALE and does not pass', () => {
    const first = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    // An ack from a different mismatch (the structure FATAL's fingerprint)
    // must not satisfy the MCP warning.
    const foreign = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: STRUCTURE_MISSING_FACTS,
    })
    const structureEntry = foreign.requirements.find((entry) => entry.requirementId === 'req-team-structure')
    if (structureEntry === undefined || structureEntry.mismatchFingerprint === null) {
      throw new Error('expected a structure mismatch fingerprint')
    }
    const foreignAck = ackFor(first, 'req-mcp-abtem')
    const wrongAck: WarningAcknowledgement = {
      ...foreignAck,
      mismatchFingerprint: structureEntry.mismatchFingerprint,
    }
    const second = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
      acknowledgements: [wrongAck],
    })
    expect(second.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    const mcp = second.requirements.find((entry) => entry.requirementId === 'req-mcp-abtem')
    if (mcp === undefined || mcp.acknowledgement === null) throw new Error('expected ack reference')
    expect(mcp.acknowledgement.status).toBe(ACK_STATUSES.MISSING) // fingerprint mismatch -> not even bound
    expect(second.unappliedAcknowledgements.length).toBe(1)
  })

  it('an ack bound to a different environment fingerprint is STALE (counts, and blocks)', () => {
    const baseline = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    // Force a STALE classification: an ack whose environmentFingerprint does
    // not match the current evaluation's fingerprint.
    const first = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    const ack = ackFor(first, 'req-mcp-abtem')
    const staleAck: WarningAcknowledgement = {
      ...ack,
      environmentFingerprint: baseline.environmentFingerprint,
    }
    const second = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
      acknowledgements: [staleAck],
    })
    expect(second.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    const mcp = second.requirements.find((entry) => entry.requirementId === 'req-mcp-abtem')
    if (mcp === undefined || mcp.acknowledgement === null) throw new Error('expected ack reference')
    expect(mcp.acknowledgement.status).toBe(ACK_STATUSES.STALE)
    expect(mcp.acknowledgement.acknowledgement?.requirementId).toBe('req-mcp-abtem')
    expect(second.counts.staleAcknowledgement).toBe(1)
    expect(second.counts.unackedWarning).toBe(1)
  })

  it('an ack targeting another requirementId is unapplied', () => {
    const first = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    const ack = ackFor(first, 'req-mcp-abtem')
    const otherAck: WarningAcknowledgement = { ...ack, requirementId: 'req-skill-review' }
    const second = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
      acknowledgements: [otherAck],
    })
    expect(second.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    expect(second.unappliedAcknowledgements.length).toBe(1)
    const mcp = second.requirements.find((entry) => entry.requirementId === 'req-mcp-abtem')
    if (mcp === undefined || mcp.acknowledgement === null) throw new Error('expected ack reference')
    expect(mcp.acknowledgement.status).toBe(ACK_STATUSES.MISSING)
  })

  it('an ack targeting a FATAL requirement is ignored (FATAL is never Continue-Anyway)', () => {
    const first = evaluateCompatibility({
      requirements: [COMPLETE_PERSONA_REQUIREMENT],
      environmentFacts: COMPLETE_PERSONA_CONFLICT_FACTS,
    })
    const ack = ackFor(first, 'req-persona-complete')
    const second = evaluateCompatibility({
      requirements: [COMPLETE_PERSONA_REQUIREMENT],
      environmentFacts: COMPLETE_PERSONA_CONFLICT_FACTS,
      acknowledgements: [ack],
    })
    expect(second.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const persona = second.requirements.find((entry) => entry.requirementId === 'req-persona-complete')
    if (persona === undefined) throw new Error('persona requirement missing from result')
    expect(persona.outcome).toBe('FATAL')
    expect(persona.acknowledgement).toBe(null)
    expect(second.unappliedAcknowledgements.length).toBe(1)
  })

  it('an ack targeting a PASS requirement is unapplied', () => {
    const first = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    // Manufacture an ack that names a PASSing requirement.
    const ack: WarningAcknowledgement = {
      requirementId: 'req-tool-delegate',
      mismatchFingerprint: 'fp-v1:0000000000000000',
      environmentFingerprint: first.environmentFingerprint,
      acknowledgedBy: OPERATOR,
      acknowledgedAt: ACKED_AT,
    }
    const second = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
      acknowledgements: [ack],
    })
    expect(second.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(second.unappliedAcknowledgements.length).toBe(1)
  })

  it('duplicate matching acks: first is VALID, the rest are unapplied', () => {
    const first = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    const ack = ackFor(first, 'req-mcp-abtem')
    const second = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
      acknowledgements: [ack, { ...ack, note: 'duplicate' }],
    })
    expect(second.status).toBe(COMPATIBILITY_STATUS.DEGRADED_ACKNOWLEDGED)
    expect(second.unappliedAcknowledgements.length).toBe(1)
  })

  it('one acked + one unacked warning: still BLOCKED_WARNING', () => {
    const facts = MCP_UNAVAILABLE_FACTS.map((fact) =>
      fact.domain === 'skill' && fact.subject === 'code-review' ? { ...fact, available: false } : fact,
    )
    const first = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: facts,
    })
    const ack = ackFor(first, 'req-mcp-abtem')
    const second = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: facts,
      acknowledgements: [ack],
    })
    expect(second.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    expect(second.counts.warning).toBe(2)
    expect(second.counts.unackedWarning).toBe(1)
    expect(second.counts.staleAcknowledgement).toBe(0)
  })
})
