/**
 * P3-T5 —environment facts: validation + environment fingerprint semantics.
 *
 * Authority: Architecture §14.3 E (facts/fingerprint, staleness/generation),
 * §27.3 (ack bound to capability/environment fingerprint); Development Plan
 * §20.1 (generation change is a re-probe trigger); T5 ruling (fingerprint =
 * hash of the relevant environment facts; drift invalidates).
 */

import { describe, expect, it } from 'vitest'

import { isTeamContractError } from '../../../contracts/src/index.js'
import type { TeamContractError } from '../../../contracts/src/index.js'
import {
  NO_PROBE_GENERATION,
  computeEnvironmentFingerprint,
  computeProbeRecords,
  parseEnvironmentFact,
  parseEnvironmentFacts,
  parseRequirements,
} from '../src/index.js'
import type { EnvironmentFact } from '../src/index.js'
import { BLUEPRINT_REQUIREMENTS, MULTI_SUBJECT_TOOL_REQUIREMENT } from '../fixtures/requirements.js'
import {
  FULLY_COMPATIBLE_FACTS,
  IRRELEVANT_DRIFT_FACTS,
  MCP_GENERATION_BUMP_FACTS,
  MCP_UNAVAILABLE_FACTS,
  SKILL_NO_PROBE_FACTS,
} from '../fixtures/environment-facts.js'

function capture(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  return undefined
}

function expectContractCode(fn: () => unknown, code: string): TeamContractError {
  const threw = capture(fn)
  if (threw === undefined) throw new Error(`expected contract error ${code} but nothing was thrown`)
  if (!isTeamContractError(threw)) {
    throw new Error(
      `expected contract error ${code} but got non-contract error: ${threw instanceof Error ? `${threw.name}: ${threw.message}` : String(threw)}`,
    )
  }
  if (threw.code !== code) throw new Error(`expected contract code ${code} but got ${threw.code}`)
  return threw
}

const REQUIREMENTS = parseRequirements(BLUEPRINT_REQUIREMENTS)

describe('P3-T5 environment fact validation', () => {
  it('parses a valid fact (with and without optional detail)', () => {
    const fact = parseEnvironmentFact({ domain: 'tool', subject: 'delegate', available: true, generation: 3 })
    expect(fact.domain).toBe('tool')
    expect(fact.available).toBe(true)
    expect(fact.generation).toBe(3)
    const withDetail = parseEnvironmentFact({
      domain: 'tool',
      subject: 'delegate',
      available: false,
      generation: 3,
      detail: 'probe timed out',
    })
    expect(withDetail.detail).toBe('probe timed out')
  })

  it('rejects an unknown fact domain with a typed MALFORMED_DTO', () => {
    const error = expectContractCode(
      () => parseEnvironmentFact({ domain: 'database', subject: 'pg', available: true, generation: 1 }),
      'MALFORMED_DTO',
    )
    expect(error.details?.['problem']).toBe('unknown requirement type')
  })

  it('rejects a fact with missing fields', () => {
    expectContractCode(
      () => parseEnvironmentFact({ domain: 'tool', subject: 'a', generation: 1 }),
      'MALFORMED_DTO',
    )
  })

  it('rejects a negative generation', () => {
    expectContractCode(
      () => parseEnvironmentFact({ domain: 'tool', subject: 'a', available: true, generation: -1 }),
      'MALFORMED_DTO',
    )
  })

  it('rejects a non-integer generation', () => {
    expectContractCode(
      () => parseEnvironmentFact({ domain: 'tool', subject: 'a', available: true, generation: 1.5 }),
      'MALFORMED_DTO',
    )
  })

  it('rejects a non-boolean available', () => {
    expectContractCode(
      () => parseEnvironmentFact({ domain: 'tool', subject: 'a', available: 'yes', generation: 1 }),
      'MALFORMED_DTO',
    )
  })

  it('rejects a duplicate (domain, subject) pair in a fact list', () => {
    expectContractCode(
      () =>
        parseEnvironmentFacts([
          { domain: 'tool', subject: 'a', available: true, generation: 1 },
          { domain: 'tool', subject: 'a', available: false, generation: 2 },
        ]),
      'MALFORMED_DTO',
    )
  })

  it('rejects unknown fields on a fact', () => {
    expectContractCode(
      () =>
        parseEnvironmentFact({
          domain: 'tool',
          subject: 'a',
          available: true,
          generation: 1,
          policy: 'allow',
        }),
      'MALFORMED_DTO',
    )
  })
})

describe('P3-T5 environment fingerprint (relevant facts only, generation-sensitive)', () => {
  it('is deterministic for the same input', () => {
    const a = computeEnvironmentFingerprint(REQUIREMENTS, FULLY_COMPATIBLE_FACTS)
    const b = computeEnvironmentFingerprint(REQUIREMENTS, FULLY_COMPATIBLE_FACTS)
    expect(a).toBe(b)
  })

  it('matches the stable fp-v1:<32 hex> shape', () => {
    const fp = computeEnvironmentFingerprint(REQUIREMENTS, FULLY_COMPATIBLE_FACTS)
    const matches = /^fp-v1:[0-9a-f]{16}$/.test(fp)
    expect(matches).toBe(true)
  })

  it('is independent of the fact-list order', () => {
    const reversed = [...FULLY_COMPATIBLE_FACTS].reverse()
    const a = computeEnvironmentFingerprint(REQUIREMENTS, FULLY_COMPATIBLE_FACTS)
    const b = computeEnvironmentFingerprint(REQUIREMENTS, reversed)
    expect(a).toBe(b)
  })

  it('changes when a relevant availability flips', () => {
    const a = computeEnvironmentFingerprint(REQUIREMENTS, FULLY_COMPATIBLE_FACTS)
    const b = computeEnvironmentFingerprint(REQUIREMENTS, MCP_UNAVAILABLE_FACTS)
    const different = a !== b
    expect(different).toBe(true)
  })

  it('changes on a pure generation bump (same availability) —staleness/generation', () => {
    const a = computeEnvironmentFingerprint(REQUIREMENTS, MCP_UNAVAILABLE_FACTS)
    const b = computeEnvironmentFingerprint(REQUIREMENTS, MCP_GENERATION_BUMP_FACTS)
    const different = a !== b
    expect(different).toBe(true)
  })

  it('changes when a relevant probe is removed entirely (absence is encoded)', () => {
    const a = computeEnvironmentFingerprint(REQUIREMENTS, FULLY_COMPATIBLE_FACTS)
    const b = computeEnvironmentFingerprint(REQUIREMENTS, SKILL_NO_PROBE_FACTS)
    const different = a !== b
    expect(different).toBe(true)
  })

  it('does NOT change for irrelevant environment drift (only relevant facts are bound)', () => {
    const a = computeEnvironmentFingerprint(REQUIREMENTS, FULLY_COMPATIBLE_FACTS)
    const b = computeEnvironmentFingerprint(REQUIREMENTS, IRRELEVANT_DRIFT_FACTS)
    expect(a).toBe(b)
  })

  it('encodes probe absence with the NO_PROBE_GENERATION sentinel', () => {
    const records = computeProbeRecords(parseRequirements([MULTI_SUBJECT_TOOL_REQUIREMENT]), [
      { domain: 'tool', subject: 'delegate', available: true, generation: 3 },
    ])
    expect(records.length).toBe(2)
    const absent = records.find((record) => record.subject === 'spawn-member')
    if (absent === undefined) throw new Error('expected the absent probe record')
    expect(absent.available).toBe(false)
    expect(absent.generation).toBe(NO_PROBE_GENERATION)
  })

  it('sorts probe records by (domain, subject) regardless of requirement order', () => {
    const facts: EnvironmentFact[] = [
      { domain: 'tool', subject: 'delegate', available: true, generation: 3 },
    ]
    const records = computeProbeRecords(
      parseRequirements([
        MULTI_SUBJECT_TOOL_REQUIREMENT,
        { requirementId: 'req-mcp', type: 'mcpServer', subjects: ['abtem'] },
      ]),
      facts,
    )
    const keys = records.map((record) => `${record.domain}:${record.subject}`)
    expect(keys).toEqual(['mcpServer:abtem', 'tool:delegate', 'tool:spawn-member'])
  })
})
