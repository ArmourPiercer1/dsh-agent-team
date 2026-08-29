import { describe, expect, it } from 'vitest'

import {
  SESSION_ID_MAX_LENGTH,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseSessionId,
  parseTeamSessionId,
  parseTemplateId,
  isBlueprintId,
  isChildSessionId,
  isInstanceId,
  isRootSessionId,
  isSessionId,
  isTemplateId,
  teamSessionIdOf,
  TeamContractError,
} from '../src/index.js'
import { capture, expectCode } from './helpers.js'

describe('contracts v1 — session ids (root / team / child)', () => {
  it('accepts the upstream-minted session-<n> form and opaque ids', () => {
    expect(parseRootSessionId('session-1')).toBe('session-1')
    expect(parseRootSessionId('session-123456')).toBe('session-123456')
    expect(parseRootSessionId('a')).toBe('a')
    expect(parseRootSessionId('Sess-2.x')).toBe('Sess-2.x')
    expect(parseRootSessionId('ws:session/5')).toBe('ws:session/5')
    expect(parseChildSessionId('child-session-7')).toBe('child-session-7')
    expect(parseSessionId('plain-session')).toBe('plain-session')
    expect(parseTeamSessionId('session-9')).toBe('session-9')
  })

  it('max-length boundary: 255 ok, 256 rejected', () => {
    const atMax = 'a'.repeat(SESSION_ID_MAX_LENGTH)
    const overMax = 'a'.repeat(SESSION_ID_MAX_LENGTH + 1)
    expect(parseRootSessionId(atMax)).toBe(atMax)
    expectCode(() => parseRootSessionId(overMax), 'INVALID_ROOT_SESSION_ID')
  })

  it('rejects empty, whitespace, and control-character ids', () => {
    for (const bad of ['', ' ', 'a b', 'a\tb', 'a\nb', 'a\u0000b', 'a\u007fb']) {
      expectCode(() => parseRootSessionId(bad), 'INVALID_ROOT_SESSION_ID')
      expectCode(() => parseChildSessionId(bad), 'INVALID_CHILD_SESSION_ID')
      expectCode(() => parseSessionId(bad), 'INVALID_SESSION_ID')
    }
  })

  it('rejects non-string inputs with the flavor-specific code', () => {
    for (const bad of [42, null, undefined, {}, []]) {
      expectCode(() => parseRootSessionId(bad), 'INVALID_ROOT_SESSION_ID')
      expectCode(() => parseChildSessionId(bad), 'INVALID_CHILD_SESSION_ID')
      expectCode(() => parseSessionId(bad), 'INVALID_SESSION_ID')
    }
  })

  it('exposes matching type guards', () => {
    expect(isRootSessionId('session-1')).toBe(true)
    expect(isRootSessionId('')).toBe(false)
    expect(isRootSessionId(7)).toBe(false)
    expect(isChildSessionId('child-1')).toBe(true)
    expect(isSessionId('x')).toBe(true)
    expect(isSessionId('a b')).toBe(false)
  })
})

describe('contracts v1 — TeamSessionId = RootSessionId (invariant 9)', () => {
  it('parseTeamSessionId is the identity parse of parseRootSessionId', () => {
    const root = parseRootSessionId('session-42')
    const team = parseTeamSessionId('session-42')
    expect(team).toBe(root)
  })

  it('teamSessionIdOf returns the same value (no second TeamSession id exists)', () => {
    const root = parseRootSessionId('session-7')
    expect(teamSessionIdOf(root)).toBe(root)
  })

  it('a malformed team session id fails with the root-session code', () => {
    expectCode(() => parseTeamSessionId(''), 'INVALID_ROOT_SESSION_ID')
  })
})

describe('contracts v1 — instance ids', () => {
  it('accepts the inst-<lowercase alphanumerics> form', () => {
    expect(parseInstanceId('inst-A'.toLowerCase())).toBe('inst-a')
    expect(parseInstanceId('inst-a1b2')).toBe('inst-a1b2')
    expect(parseInstanceId('inst-0')).toBe('inst-0')
    // 1..32 after the prefix: 32 is the boundary.
    const atMax = `inst-${'a'.repeat(32)}`
    expect(parseInstanceId(atMax)).toBe(atMax)
  })

  it('rejects 33 trailing chars (over the 37-char structural max)', () => {
    const overMax = `inst-${'a'.repeat(33)}`
    expectCode(() => parseInstanceId(overMax), 'INVALID_INSTANCE_ID')
  })

  it('rejects legacy-style and malformed ids', () => {
    for (const bad of [
      'member-1', // legacy memberId-style shape
      'B1', // legacy TeamMemberId('B1') value
      'inst-',
      'INST-A',
      'inst-aB',
      'inst-a_b',
      'inst-a-b',
      ' inst-a',
      'inst-a ',
      'inst a',
      '',
    ]) {
      expectCode(() => parseInstanceId(bad), 'INVALID_INSTANCE_ID')
      expect(isInstanceId(bad)).toBe(false)
    }
  })

  it('rejects non-string inputs', () => {
    for (const bad of [1, null, undefined, {}, []]) {
      expectCode(() => parseInstanceId(bad), 'INVALID_INSTANCE_ID')
    }
  })
})

describe('contracts v1 — template ids (static identity, not runtime identity)', () => {
  it('accepts lowercase slugs (architecture examples)', () => {
    expect(parseTemplateId('researcher')).toBe('researcher')
    expect(parseTemplateId('developer')).toBe('developer')
    expect(parseTemplateId('reviewer')).toBe('reviewer')
    expect(parseTemplateId('a')).toBe('a')
    expect(parseTemplateId('a1-b2')).toBe('a1-b2')
  })

  it('rejects non-slug values', () => {
    for (const bad of [
      'Researcher',
      '1abc',
      '-abc',
      'a_b',
      'a b',
      'a'.repeat(65),
      '',
      'teammate#A',
    ]) {
      expectCode(() => parseTemplateId(bad), 'INVALID_TEMPLATE_ID')
      expect(isTemplateId(bad)).toBe(false)
    }
  })
})

describe('contracts v1 — blueprint identity fields', () => {
  it('accepts the architecture example blueprint id', () => {
    expect(parseBlueprintId('AIUED-ALGO')).toBe('AIUED-ALGO')
    expect(parseBlueprintId('bp-1')).toBe('bp-1')
    expect(parseBlueprintId('a'.repeat(128))).toBe('a'.repeat(128))
    expect(isBlueprintId('AIUED-ALGO')).toBe(true)
  })

  it('rejects @ (reserved for the blueprintId@revision form), whitespace, and over-length', () => {
    for (const bad of ['AIUED@ALGO', 'a b', '', 'x'.repeat(129), 'p\tr']) {
      expectCode(() => parseBlueprintId(bad), 'INVALID_BLUEPRINT_ID')
    }
  })

  it('validates revision (human-readable) and contentHash (machine identity)', () => {
    expect(parseBlueprintRevision('17')).toBe('17')
    expect(parseBlueprintRevision('v1.2')).toBe('v1.2')
    expectCode(() => parseBlueprintRevision('@17'), 'INVALID_BLUEPRINT_REVISION')
    expectCode(() => parseBlueprintRevision(''), 'INVALID_BLUEPRINT_REVISION')
    expect(parseBlueprintContentHash('sha256:abc123')).toBe('sha256:abc123')
    expectCode(() => parseBlueprintContentHash(''), 'INVALID_BLUEPRINT_CONTENT_HASH')
    expectCode(
      () => parseBlueprintContentHash('h'.repeat(257)),
      'INVALID_BLUEPRINT_CONTENT_HASH',
    )
  })
})

describe('contracts v1 — error object plumbing', () => {
  it('thrown id errors are TeamContractError instances with the exact code', () => {
    const threw = capture(() => parseInstanceId('bad'))
    if (!(threw instanceof TeamContractError)) {
      throw new Error('expected a TeamContractError instance')
    }
    expect(threw.code).toBe('INVALID_INSTANCE_ID')
    expect(typeof threw.message).toBe('string')
    expect(threw.message.length).toBeGreaterThan(0)
  })
})
