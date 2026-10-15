/**
 * P3-T2 — strong validation: every negative fixture fails loud with the
 * exact frozen contract error code, and the whole-document validator
 * (all-or-nothing) behaves on decoded values.
 *
 * @module @dsh-agent-team/domain/test/t2-blueprint-validation
 */

import { describe, expect, it } from 'vitest'

import {
  parseBlueprint,
  parseModelPreferenceToken,
  validateBlueprintDocument,
} from '../blueprint/src/index.js'
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
      'schemaVersion: 3',
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
      'permissionMutationEnvelope:',
      '  rules: []',
      'teamHardEnvelope:',
      '  rules: []',
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

  it('accepts a YAML block-scalar persona — how a real blueprint is authored', () => {
    // The authored form, not a hand-decoded object: `persona: |` is the
    // normal way to write a long role brief, and it decodes to a string
    // containing newlines. Before the split scanner this threw
    // `MALFORMED_DTO: field $.leader.persona contains control characters`.
    const src = [
      '---',
      'schemaVersion: 3',
      'blueprintId: team.min',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: |',
      '    你是本团队的 Leader。',
      '',
      '    严格按 TEAM_DESIGN.md 的分层执行。',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'permissionMutationEnvelope:',
      '  rules: []',
      'teamHardEnvelope:',
      '  rules: []',
      'quotas:',
      '  team:',
      '    maxInstances: 1',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    const core = parseBlueprint(src)
    expect(core.leader.persona).toContain('\n')
    expect(core.leader.persona).toBe('你是本团队的 Leader。\n\n严格按 TEAM_DESIGN.md 的分层执行。')
  })
})

/** A valid minimal document as a plain JS object (no YAML involved). */
function jsDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 3,
    blueprintId: 'team.min',
    revision: '1',
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
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

  // Prose fields are prose. `persona` is a long role brief and `description`
  // is free text; a YAML block scalar (`persona: |`) decodes to a string
  // whose newlines ARE the text, so the scanner that bans every C0 character
  // rejected every multi-line persona a blueprint could be authored with.
  // These pin the split: the three document whitespaces (tab, newline,
  // carriage return) pass in prose, every other C0 control and DEL still
  // fails, and identifier-shaped fields keep the strict ban.
  it('accepts a multi-line persona and keeps its inner newlines', () => {
    const core = validateBlueprintDocument(
      jsDoc({ leader: { templateId: 'leader', persona: '你是 Leader。\n\n严格按设计执行。\n' } }),
    )
    expect(core.leader.persona).toContain('\n')
    // takeString trims the value, so a block scalar's trailing newline is
    // dropped — the inner blank line is what has to survive.
    expect(core.leader.persona).toBe('你是 Leader。\n\n严格按设计执行。')
  })

  it('accepts tab and carriage return in prose fields', () => {
    const core = validateBlueprintDocument(
      jsDoc({
        description: '第一行\r\n\t缩进的续行',
        leader: { templateId: 'leader', persona: '角色:\ta\r\nb' },
      }),
    )
    expect(core.leader.persona).toBe('角色:\ta\r\nb')
    expect(core.description).toBe('第一行\r\n\t缩进的续行')
  })

  it('still rejects the other C0 controls and DEL in prose', () => {
    for (const control of ['\u0000', '\u001f', '\u007f']) {
      expectCode(
        () =>
          validateBlueprintDocument(
            jsDoc({ leader: { templateId: 'leader', persona: `好${control}的 persona` } }),
          ),
        'MALFORMED_DTO',
      )
    }
  })

  it('keeps the strict control-character ban on identifier-shaped fields', () => {
    // A newline in a display name would break every list that renders it;
    // the prose fix must not reach these.
    expectCode(() => validateBlueprintDocument(jsDoc({ displayName: '一行\n二行' })), 'MALFORMED_DTO')
    expectCode(
      () =>
        validateBlueprintDocument(
          jsDoc({ leader: { templateId: 'leader', persona: 'Lead.', displayName: 'a\nb' } }),
        ),
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

/** A minimal valid document whose leader carries `modelPreference`. */
function modelPreferenceDoc(token: string): Record<string, unknown> {
  return jsDoc({ leader: { templateId: 'leader', persona: 'Lead.', modelPreference: token } })
}

/** A minimal valid document whose MEMBER carries `modelPreference`. */
function modelPreferenceMemberDoc(token: string): Record<string, unknown> {
  return jsDoc({ members: [{ templateId: 'm', persona: 'p', modelPreference: token }] })
}

// ---------------------------------------------------------------------------
// Gate A — the `modelPreference` token grammar (the model-preference
// routing fix): the field was always schema/hash/remote legal, but had no
// SEMANTIC strong validation — a garbage token sailed through to the
// runtime and was silently ignored. It now parses as either a qualified
// `provider/model` route or a bare model-only shorthand, and rejects
// everything that cannot be parsed as one.
// ---------------------------------------------------------------------------

describe('Gate A: modelPreference token grammar (strong validation)', () => {
  it('A1 qualified route: parses and the value is unchanged', () => {
    const core = validateBlueprintDocument(modelPreferenceDoc('qiyuan-self/qwen3.8-27b'))
    expect(core.leader.modelPreference).toBe('qiyuan-self/qwen3.8-27b')
  })

  it('A1 qualified route on a MEMBER template: parses and unchanged', () => {
    const core = validateBlueprintDocument(modelPreferenceMemberDoc('openai/gpt-6-astra'))
    expect(core.members[0]?.modelPreference).toBe('openai/gpt-6-astra')
  })

  it('A2 model-only shorthand: parses and the value is unchanged', () => {
    const core = validateBlueprintDocument(modelPreferenceDoc('qwen3.8-27b'))
    expect(core.leader.modelPreference).toBe('qwen3.8-27b')
  })

  it('A3 malformed tokens fail loud with MALFORMED_DTO + reason', () => {
    for (const bad of ['/model', 'provider/', 'provider /model', 'provider/ model']) {
      expectErrorDetails(
        () => validateBlueprintDocument(modelPreferenceDoc(bad)),
        'MALFORMED_DTO',
        { reason: 'invalid-model-preference' },
      )
      // …and the same rule applies to member templates.
      expectErrorDetails(
        () => validateBlueprintDocument(modelPreferenceMemberDoc(bad)),
        'MALFORMED_DTO',
        { reason: 'invalid-model-preference' },
      )
    }
  })

  it('A3 control characters are rejected by the field reader (MALFORMED_DTO)', () => {
    // takeString's generic control-char check fires before the token check:
    // the token is malformed, the code is the same, the reason detail is
    // the field-level one (still MALFORMED_DTO, never a silent accept).
    expectCode(
      () => validateBlueprintDocument(modelPreferenceDoc('prov\u0001der/model')),
      'MALFORMED_DTO',
    )
  })

  it('A3 a further slash belongs to the model (openrouter-style ids)', () => {
    const core = validateBlueprintDocument(modelPreferenceDoc('openrouter/meta/llama-x'))
    expect(core.leader.modelPreference).toBe('openrouter/meta/llama-x')
  })

  it('absent modelPreference stays absent (no default is invented)', () => {
    const core = validateBlueprintDocument(jsDoc())
    expect(core.leader.modelPreference).toBe(undefined)
  })
})

describe('Gate A: parseModelPreferenceToken (the pure parser)', () => {
  it('qualified route splits at the FIRST slash', () => {
    expect(parseModelPreferenceToken('qiyuan-self/qwen3.8-27b')).toEqual({
      provider: 'qiyuan-self',
      model: 'qwen3.8-27b',
    })
  })

  it('a further slash stays in the model string', () => {
    expect(parseModelPreferenceToken('openrouter/meta/llama-x')).toEqual({
      provider: 'openrouter',
      model: 'meta/llama-x',
    })
  })

  it('model-only yields a token with NO provider field', () => {
    expect(parseModelPreferenceToken('qwen3.8-27b')).toEqual({ model: 'qwen3.8-27b' })
    const parsed = parseModelPreferenceToken('qwen3.8-27b')!
    expect(Object.hasOwn(parsed, 'provider')).toBe(false)
  })

  it('malformed tokens yield undefined', () => {
    for (const bad of ['', ' ', '/model', 'provider/', 'provider /model', 'provider/ model']) {
      expect(parseModelPreferenceToken(bad)).toBe(undefined)
    }
  })

  it('Unicode whitespace (U+1680 OGHAM SPACE MARK) + C0 control chars are rejected — the SINGLE parser locks the grammar (S1/P2-2)', () => {
    const ogham = '\u1680'
    // U+1680 is matched by ECMAScript `\s` (a Unicode space separator) but was
    // NOT in the old runtime hand-table — this case locks "only ONE parser".
    expect(parseModelPreferenceToken(`provider${ogham}/model`)).toBe(undefined)
    expect(parseModelPreferenceToken(`provider${ogham}model`)).toBe(undefined)
    // a C0 control character (non-whitespace) is also rejected
    expect(parseModelPreferenceToken('prov\x01der/model')).toBe(undefined)
    // ...but a clean qualified route still parses (no over-rejection)
    expect(parseModelPreferenceToken('qiyuan-self/qwen3.8-27b')).toEqual({
      provider: 'qiyuan-self',
      model: 'qwen3.8-27b',
    })
  })
})

// ---------------------------------------------------------------------------
// NRM-2 (2026-10-16 authorized round): quota integers must be SAFE integers,
// aligning the acceptance set with the same-worded gate in the frozen
// contracts package (`assertPositiveInteger`, contracts/src/ids/common.ts) —
// one message, one set. 2^53 itself (9007199254740992) is NOT a safe integer
// and rejects; 2^53+1 arrives at the validator already normalized by the
// YAML layer to 2^53 (float) and rejects through that same gate; the
// MAX_SAFE boundary (9007199254740991) stays legal.
// ---------------------------------------------------------------------------

const quotaSource = (maxInstances: string): string =>
  [
    '---',
    'schemaVersion: 3',
    'blueprintId: nrm2-quotas',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'quotas:',
    '  team:',
    `    maxInstances: ${maxInstances}`,
    'metadata: {}',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    '---',
    '',
  ].join('\n')

describe('NRM-2: quota integers are safe integers (contracts-sibling alignment)', () => {
  it('Q1: MAX_SAFE_INTEGER boundary value stays legal', () => {
    const doc = parseBlueprint(quotaSource('9007199254740991'))
    expect(doc.quotas?.team?.maxInstances).toBe(9007199254740991)
  })

  it('Q2: 2^53 (unsafe, exactly representable) rejects', () => {
    expectErrorDetails(() => parseBlueprint(quotaSource('9007199254740992')), 'MALFORMED_DTO', {
      path: '$.quotas.team.maxInstances',
    })
  })

  it('Q3: 2^53+1 rejects (YAML float-normalizes to 2^53, the safe-int gate catches it)', () => {
    expectErrorDetails(() => parseBlueprint(quotaSource('9007199254740993')), 'MALFORMED_DTO', {
      path: '$.quotas.team.maxInstances',
    })
  })

  it('Q4: 2^53+2 rejects (unsafe even though exactly representable)', () => {
    expectErrorDetails(() => parseBlueprint(quotaSource('9007199254740994')), 'MALFORMED_DTO', {
      path: '$.quotas.team.maxInstances',
    })
  })
})
