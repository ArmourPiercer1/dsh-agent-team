/**
 * P3-T5 —environment-fingerprint drift invalidation (required test).
 *
 * Authority: Architecture §27.3 (an ack corresponds to a specific
 * mismatch/environment generation; a new mismatch is not covered by the old
 * ack), §14.3 E (staleness/generation), Development Plan §20.1 (re-probe on
 * relevant capability generation change; new warnings block NEW work);
 * T5 ruling ("any drift (different fingerprint) invalidates the previous
 * result").
 */

import { describe, expect, it } from 'vitest'

import {
  ACK_STATUSES,
  COMPATIBILITY_STATUS,
  computeEnvironmentFingerprint,
  evaluateCompatibility,
  isCompatibilityResultValidForEnvironment,
  parseEnvironmentFacts,
  parseRequirements,
  serializeCompatibilityResult,
} from '../src/index.js'
import type { WarningAcknowledgement } from '../src/index.js'
import { BLUEPRINT_REQUIREMENTS } from '../fixtures/requirements.js'
import {
  FULLY_COMPATIBLE_FACTS,
  IRRELEVANT_DRIFT_FACTS,
  MCP_GENERATION_BUMP_FACTS,
  MCP_UNAVAILABLE_FACTS,
} from '../fixtures/environment-facts.js'

const REQUIREMENTS = parseRequirements(BLUEPRINT_REQUIREMENTS)
const OPERATOR = 'test-operator'
const ACKED_AT = '2026-08-29T12:00:00.000Z'

describe('P3-T5 drift invalidation (fingerprint bound to the result)', () => {
  it('the result carries the fingerprint of the relevant environment facts', () => {
    const result = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    expect(result.environmentFingerprint).toBe(
      computeEnvironmentFingerprint(REQUIREMENTS, FULLY_COMPATIBLE_FACTS),
    )
  })

  it('same input => byte-identical canonical serialization (stable typed result)', () => {
    const a = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    const b = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    expect(serializeCompatibilityResult(a)).toBe(serializeCompatibilityResult(b))
  })

  it('the previous result stays valid while the environment is unchanged', () => {
    const result = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    const stillValid = isCompatibilityResultValidForEnvironment(
      result,
      REQUIREMENTS,
      parseEnvironmentFacts(FULLY_COMPATIBLE_FACTS),
    )
    expect(stillValid).toBe(true)
  })

  it('availability drift invalidates the previous result (fingerprint changed)', () => {
    const before = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    const drifted = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    const fingerprintChanged = before.environmentFingerprint !== drifted.environmentFingerprint
    expect(fingerprintChanged).toBe(true)
    const invalid = isCompatibilityResultValidForEnvironment(
      before,
      REQUIREMENTS,
      parseEnvironmentFacts(MCP_UNAVAILABLE_FACTS),
    )
    expect(invalid).toBe(false)
  })

  it('a pure generation bump (same availability) invalidates the previous result', () => {
    const before = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    const drifted = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_GENERATION_BUMP_FACTS,
    })
    const invalid = isCompatibilityResultValidForEnvironment(
      before,
      REQUIREMENTS,
      parseEnvironmentFacts(MCP_GENERATION_BUMP_FACTS),
    )
    expect(invalid).toBe(false)
    expect(before.environmentFingerprint).not.toBe(drifted.environmentFingerprint)
  })

  it('a changed requirement set invalidates the previous result', () => {
    const before = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    const extraRequirement = {
      requirementId: 'req-extra-tool',
      type: 'tool' as const,
      subjects: ['browser-use'],
    }
    const invalid = isCompatibilityResultValidForEnvironment(
      before,
      [...REQUIREMENTS, parseRequirements([extraRequirement])[0] as (typeof REQUIREMENTS)[number]],
      parseEnvironmentFacts(FULLY_COMPATIBLE_FACTS),
    )
    expect(invalid).toBe(false)
  })

  it('irrelevant environment drift does NOT invalidate the previous result', () => {
    const before = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    const stillValid = isCompatibilityResultValidForEnvironment(
      before,
      REQUIREMENTS,
      parseEnvironmentFacts(IRRELEVANT_DRIFT_FACTS),
    )
    expect(stillValid).toBe(true)
  })

  it('drift invalidates a previously VALID ack (stale ack re-blocks admission)', () => {
    // Step 1: MCP down at generation 3; operator acks the warning.
    const first = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    const mcp = first.requirements.find((entry) => entry.requirementId === 'req-mcp-abtem')
    if (mcp === undefined || mcp.mismatchFingerprint === null) throw new Error('expected MCP mismatch')
    const ack: WarningAcknowledgement = {
      requirementId: 'req-mcp-abtem',
      mismatchFingerprint: mcp.mismatchFingerprint,
      environmentFingerprint: first.environmentFingerprint,
      acknowledgedBy: OPERATOR,
      acknowledgedAt: ACKED_AT,
    }
    const acknowledged = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
      acknowledgements: [ack],
    })
    expect(acknowledged.status).toBe(COMPATIBILITY_STATUS.DEGRADED_ACKNOWLEDGED)

    // Step 2: the same capability re-probes at generation 4 (still down).
    // The old ack does not cover the new mismatch generation.
    const drifted = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_GENERATION_BUMP_FACTS,
      acknowledgements: [ack],
    })
    expect(drifted.environmentFingerprint).not.toBe(first.environmentFingerprint)
    const driftedMcp = drifted.requirements.find((entry) => entry.requirementId === 'req-mcp-abtem')
    if (driftedMcp === undefined || driftedMcp.acknowledgement === null) throw new Error('expected ack reference')
    expect(driftedMcp.acknowledgement.status).toBe(ACK_STATUSES.STALE)
    expect(drifted.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    expect(drifted.counts.staleAcknowledgement).toBe(1)

    // Step 3: a fresh ack bound to the drifted generation restores the
    // acknowledged-degraded state.
    const refreshedAck: WarningAcknowledgement = {
      ...ack,
      mismatchFingerprint: driftedMcp.mismatchFingerprint ?? '',
      environmentFingerprint: drifted.environmentFingerprint,
    }
    const reacknowledged = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_GENERATION_BUMP_FACTS,
      acknowledgements: [refreshedAck],
    })
    expect(reacknowledged.status).toBe(COMPATIBILITY_STATUS.DEGRADED_ACKNOWLEDGED)
  })

  it('fingerprint is independent of input array order (stable across shuffles)', () => {
    const base = computeEnvironmentFingerprint(REQUIREMENTS, FULLY_COMPATIBLE_FACTS)
    const rotated = [
      ...FULLY_COMPATIBLE_FACTS.slice(3),
      ...FULLY_COMPATIBLE_FACTS.slice(0, 3),
    ]
    const rotatedFp = computeEnvironmentFingerprint(REQUIREMENTS, rotated)
    expect(base).toBe(rotatedFp)
  })
})
