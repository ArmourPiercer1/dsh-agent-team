/**
 * P3-T5 —typed requirement validation (closed §27.1 vocabulary, fail loud).
 *
 * Authority: Architecture §27.1 ("未知 requirement domain = Blueprint
 * validation error"), §19.1 (Requirement != Policy); TaskDoc §11.4 P3-T5
 * ("unknown requirement type validation error").
 */

import { describe, expect, it } from 'vitest'

import { isTeamContractError } from '../../../contracts/src/index.js'
import type { RemoteSafeRecord, TeamContractError } from '../../../contracts/src/index.js'
import {
  REQUIREMENT_TYPE_VALUES,
  parseRequirement,
  parseRequirements,
} from '../src/index.js'

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

describe('P3-T5 typed requirement validation', () => {
  it('parses a minimal valid requirement (complete defaults to false)', () => {
    const requirement = parseRequirement({ requirementId: 'req-a', type: 'tool', subjects: ['delegate'] })
    expect(requirement.requirementId).toBe('req-a')
    expect(requirement.type).toBe('tool')
    expect(requirement.complete).toBe(false)
    expect(requirement.subjects).toEqual(['delegate'])
  })

  it('preserves complete:true', () => {
    const requirement = parseRequirement({
      requirementId: 'req-p',
      type: 'persona',
      subjects: ['preset-x'],
      complete: true,
    })
    expect(requirement.complete).toBe(true)
  })

  it('rejects an unknown requirement type with a typed MALFORMED_DTO (fail loud)', () => {
    const error = expectContractCode(
      () => parseRequirement({ requirementId: 'req-x', type: 'database', subjects: ['pg'] }),
      'MALFORMED_DTO',
    )
    const details: RemoteSafeRecord = error.details ?? {}
    expect(details['problem']).toBe('unknown requirement type')
    expect(details['type']).toBe('database')
  })

  it('rejects a non-string type value', () => {
    const error = expectContractCode(
      () => parseRequirement({ requirementId: 'req-x', type: 42, subjects: ['a'] }),
      'MALFORMED_DTO',
    )
    const details: RemoteSafeRecord = error.details ?? {}
    expect(details['problem']).toBe('unknown requirement type')
    expect(details['type']).toBe('number')
  })

  it('rejects a missing requirementId', () => {
    expectContractCode(
      () => parseRequirement({ type: 'tool', subjects: ['a'] }),
      'MALFORMED_DTO',
    )
  })

  it('rejects missing subjects', () => {
    expectContractCode(
      () => parseRequirement({ requirementId: 'req-a', type: 'tool' }),
      'MALFORMED_DTO',
    )
  })

  it('rejects an empty subjects array', () => {
    expectContractCode(
      () => parseRequirement({ requirementId: 'req-a', type: 'tool', subjects: [] }),
      'MALFORMED_DTO',
    )
  })

  it('rejects a non-string subject', () => {
    expectContractCode(
      () => parseRequirement({ requirementId: 'req-a', type: 'tool', subjects: [1] }),
      'MALFORMED_DTO',
    )
  })

  it('rejects duplicate subjects', () => {
    expectContractCode(
      () => parseRequirement({ requirementId: 'req-a', type: 'tool', subjects: ['a', 'a'] }),
      'MALFORMED_DTO',
    )
  })

  it('rejects unknown fields', () => {
    expectContractCode(
      () =>
        parseRequirement({
          requirementId: 'req-a',
          type: 'tool',
          subjects: ['a'],
          allow: true,
        }),
      'MALFORMED_DTO',
    )
  })

  it('rejects a non-boolean complete', () => {
    expectContractCode(
      () =>
        parseRequirement({ requirementId: 'req-a', type: 'tool', subjects: ['a'], complete: 'yes' }),
      'MALFORMED_DTO',
    )
  })

  it('rejects a non-record requirement', () => {
    expectContractCode(() => parseRequirement('tool:delegate'), 'MALFORMED_DTO')
  })

  it('rejects a non-array requirement list', () => {
    expectContractCode(() => parseRequirements({}), 'MALFORMED_DTO')
  })

  it('rejects duplicate requirementIds in a list', () => {
    expectContractCode(
      () =>
        parseRequirements([
          { requirementId: 'req-a', type: 'tool', subjects: ['x'] },
          { requirementId: 'req-a', type: 'skill', subjects: ['y'] },
        ]),
      'MALFORMED_DTO',
    )
  })

  it('accepts an empty requirement list (trivially compatible blueprint)', () => {
    const list = parseRequirements([])
    expect(list.length).toBe(0)
  })

  it('exposes exactly the closed six-domain §27.1 vocabulary', () => {
    const sorted = [...REQUIREMENT_TYPE_VALUES].sort()
    expect(sorted).toEqual(['mcpServer', 'modelRoute', 'persona', 'skill', 'teamStructure', 'tool'])
  })

  it('returns deeply frozen parsed requirements', () => {
    const list = parseRequirements([
      { requirementId: 'req-a', type: 'tool', subjects: ['a'] },
    ])
    expect(Object.isFrozen(list)).toBe(true)
    const first = list[0]
    if (first === undefined) throw new Error('expected one parsed requirement')
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.subjects)).toBe(true)
  })
})
