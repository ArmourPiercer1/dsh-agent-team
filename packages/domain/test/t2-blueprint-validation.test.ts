/**
 * P3-T2 — strong validation: every negative fixture fails loud with the
 * exact frozen contract error code, and the whole-document validator
 * (all-or-nothing) behaves on decoded values.
 *
 * @module @dsh-agent-team/domain/test/t2-blueprint-validation
 */

import { describe, expect, it } from 'vitest'

import { parseBlueprint, validateBlueprintDocument } from '../blueprint/src/index.js'
import { NEGATIVE_FIXTURES } from '../blueprint/testdata/fixtures.js'
import type { NegativeFixture } from '../blueprint/testdata/fixtures.js'
import { expectCode, expectErrorDetails } from './t2-helpers.js'

function checkNegative(fixture: NegativeFixture): void {
  const details: Record<string, unknown> = {}
  if (fixture.reason !== undefined) details['reason'] = fixture.reason
  if (fixture.unknownFields !== undefined) details['unknownFields'] = fixture.unknownFields
  expectErrorDetails(() => parseBlueprint(fixture.source), fixture.code, details)
}

describe('t2 validation: negative fixtures (each violates exactly one rule)', () => {
  for (const fixture of NEGATIVE_FIXTURES) {
    it(`fails loud: ${fixture.name}`, () => {
      checkNegative(fixture)
    })
  }
})

describe('t2 validation: whole-document, all-or-nothing', () => {
  it('rejects a document with two independent violations in one pass', () => {
    const src = [
      '---',
      'schemaVersion: 1',
      'blueprintId: team.min',
      'revision: "1"',
      'extraField: 1',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'quotas:',
      '  team:',
      '    maxInstances: 0',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    // The top-level unknown-field check fires first; the invalid quota is
    // never reached — the document is rejected as a whole, not partially.
    expectErrorDetails(() => parseBlueprint(src), 'MALFORMED_DTO', {
      unknownFields: ['extraField'],
    })
  })
})

/** A valid minimal document as a plain JS object (no YAML involved). */
function jsDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    blueprintId: 'team.min',
    revision: '1',
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    metadata: {},
    ...overrides,
  }
}

describe('t2 validation: validateBlueprintDocument on decoded values', () => {
  it('accepts a plain JS object directly', () => {
    const core = validateBlueprintDocument(jsDoc())
    expect(core.blueprintId).toBe('team.min')
    expect(core.revision).toBe('1')
    expect(core.members).toEqual([])
    expect(core.metadata).toEqual({})
  })

  it('rejects a non-record root value', () => {
    expectCode(() => validateBlueprintDocument(['not', 'a', 'record']), 'MALFORMED_DTO')
    expectCode(() => validateBlueprintDocument(null), 'MALFORMED_DTO')
  })

  it('rejects a value that is not lossless JSON (Date)', () => {
    expectCode(
      () =>
        validateBlueprintDocument(
          jsDoc({ metadata: { when: new Date(0) } }),
        ),
      'REMOTE_VALUE_NOT_JSON',
    )
  })

  it('rejects an explicit null on an optional string field', () => {
    expectCode(() => validateBlueprintDocument(jsDoc({ displayName: null })), 'MALFORMED_DTO')
  })

  it('rejects control characters in string fields', () => {
    expectCode(
      () => validateBlueprintDocument(jsDoc({ leader: { templateId: 'leader', persona: 'Bad\u0001persona' } })),
      'MALFORMED_DTO',
    )
  })

  it('rejects unknown fields at nested levels with the exact field name', () => {
    expectErrorDetails(
      () =>
        validateBlueprintDocument(
          jsDoc({ leader: { templateId: 'leader', persona: 'Lead.', model: 'x' } }),
        ),
      'MALFORMED_DTO',
      { unknownFields: ['model'] },
    )
  })

  it('rejects the legacy memberId at any depth (recursive quarantine)', () => {
    expectErrorDetails(
      () =>
        validateBlueprintDocument(
          jsDoc({
            members: [{ templateId: 'm', persona: 'p', memberId: 'legacy' }],
          }),
        ),
      'LEGACY_MEMBER_ID_REJECTED',
      { path: '$.members[0].memberId' },
    )
  })

  it('rejects a member envelope that duplicates an entry', () => {
    expectCode(
      () =>
        validateBlueprintDocument(
          jsDoc({
            members: [{ templateId: 'm', persona: 'p' }],
            memberEnvelopes: [
              { templateId: 'm', envelope: { allow: [], deny: [] } },
              { templateId: 'm', envelope: { allow: [], deny: [] } },
            ],
          }),
        ),
      'MALFORMED_DTO',
    )
  })

  it('rejects a non-boolean requirement optional flag', () => {
    expectCode(
      () =>
        validateBlueprintDocument(
          jsDoc({
            requirements: [{ domain: 'web', name: 'search', optional: 'yes' }],
          }),
        ),
      'MALFORMED_DTO',
    )
  })
})
