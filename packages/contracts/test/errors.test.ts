import { describe, expect, it } from 'vitest'

import {
  TeamContractError,
  TeamContractErrorCode,
  TEAM_CONTRACT_ERROR_CODE_VALUES,
  isTeamContractError,
  teamContractError,
} from '../src/index.js'

/**
 * The frozen v1 code spellings, hardcoded independently of the const object
 * so a silent rename in the vocabulary fails here.
 */
const EXPECTED_V1_CODES = [
  'DUPLICATE_INSTANCE_ID',
  'DUPLICATE_TEAM_SESSION',
  'IDENTITY_SCOPE_MISMATCH',
  'INVALID_BLUEPRINT_CONTENT_HASH',
  'INVALID_BLUEPRINT_ID',
  'INVALID_BLUEPRINT_REVISION',
  'INVALID_CHILD_SESSION_ID',
  'INVALID_INSTANCE_ID',
  'INVALID_ROOT_SESSION_ID',
  'INVALID_SESSION_ID',
  'INVALID_TEMPLATE_ID',
  'LEGACY_MEMBER_ID_REJECTED',
  'LEGACY_TEAM_SESSION_EVENT_REJECTED',
  'MALFORMED_DTO',
  'MEMBER_NOT_FOUND',
  'REMOTE_VALUE_NOT_JSON',
  'SCHEMA_VERSION_MISMATCH',
  'SCHEMA_VERSION_UNSUPPORTED',
  'SESSION_ALREADY_BOUND',
  'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT',
].sort()

describe('contracts v1 — closed error code vocabulary', () => {
  it('exposes exactly the 20 frozen v1 codes (no additions, no renames)', () => {
    expect(TEAM_CONTRACT_ERROR_CODE_VALUES.length).toBe(20)
    expect([...TEAM_CONTRACT_ERROR_CODE_VALUES].sort()).toEqual(EXPECTED_V1_CODES)
  })

  it('every const-object key maps to its own frozen spelling', () => {
    const entries = Object.entries(TeamContractErrorCode)
    expect(entries.length).toBe(20)
    for (const [key, value] of entries) {
      expect(value).toBe(key)
      expect(typeof value).toBe('string')
    }
  })

  it('every value is a distinct string (no aliasing between codes)', () => {
    const values = TEAM_CONTRACT_ERROR_CODE_VALUES
    const unique = new Set<string>(values as readonly string[])
    expect(unique.size).toBe(values.length)
  })
})

describe('contracts v1 — TeamContractError object shape', () => {
  it('the factory produces an Error with name, code, message, and details', () => {
    const err = teamContractError('MALFORMED_DTO', 'field x is broken', { field: 'x' })
    expect(err instanceof Error).toBe(true)
    expect(err instanceof TeamContractError).toBe(true)
    expect(err.name).toBe('TeamContractError')
    expect(err.code).toBe('MALFORMED_DTO')
    expect(err.message).toBe('field x is broken')
    expect(err.details).toEqual({ field: 'x' })
    expect(typeof err.stack).toBe('string')
  })

  it('details are optional', () => {
    const err = teamContractError('DUPLICATE_INSTANCE_ID', 'dup')
    expect(err.code).toBe('DUPLICATE_INSTANCE_ID')
    expect(err.details).toBe(undefined)
  })

  it('isTeamContractError accepts only errors carrying a frozen v1 code', () => {
    expect(isTeamContractError(teamContractError('MEMBER_NOT_FOUND', 'nope'))).toBe(true)
    expect(isTeamContractError(new Error('plain'))).toBe(false)
    // An error carrying a NON-v1 code is not a contract error.
    const foreign = new Error('x')
    foreign.name = 'ForeignError'
    Object.assign(foreign, { code: 'SOME_FOREIGN_CODE' })
    expect(isTeamContractError(foreign)).toBe(false)
    // A plain object with a code field is not an error at all.
    expect(isTeamContractError({ code: 'MALFORMED_DTO' })).toBe(false)
    expect(isTeamContractError(null)).toBe(false)
    expect(isTeamContractError(undefined)).toBe(false)
  })

  it('consumers can branch on code (never on message text)', () => {
    const err = teamContractError('SCHEMA_VERSION_MISMATCH', 'whatever', { expected: 1 })
    expect(err.code).toBe('SCHEMA_VERSION_MISMATCH')
    expect(err instanceof TeamContractError).toBe(true)
  })
})
