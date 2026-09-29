/**
 * pre-alpha3 PR-E (plan §E.2) — Blueprint schema v2: the structured
 * requirement levels (Team / Leader / MemberTemplate) in the compatibility
 * requirement vocabulary (the frozen §27.1 six-set).
 *
 * This suite pins the v2 parsing/normalization surface:
 *  - a `schemaVersion: 2` document MAY declare `teamRequirements` (top
 *    level) and per-template `requirements` (Leader and each MemberTemplate);
 *  - each requirement reuses the closed §27.1 `type`, a slug
 *    `requirementId`, non-empty unique `subjects`, and a structural
 *    `complete` (defaults to `false` when omitted);
 *  - the v1 validator is FROZEN: a v1 document that names a v2 field
 *    (`teamRequirements` at the top level, or `requirements` on a template)
 *    fails loudly as an unknown field — v1 is NOT tightened into v2.
 *
 * @module @dsh-agent-team/domain/test/t2-blueprint-v2-requirements
 */

import { describe, expect, it } from 'vitest'

import { parseBlueprint } from '../blueprint/src/index.js'
import type { TeamBlueprint } from '../blueprint/src/index.js'
import { expectCode, expectErrorDetails } from './t2-helpers.js'

// ---------------------------------------------------------------------------
// helpers: build v2 documents as raw YAML source
// ---------------------------------------------------------------------------

/** A minimal v2 document with an (empty) `teamRequirements` list. */
function v2Source(body: string): string {
  return [
    '---',
    'schemaVersion: 2',
    'blueprintId: team.v2',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members:',
    ...body.split('\n').map((line) => `  ${line}`),
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// positive: v2 requirement levels parse and normalize
// ---------------------------------------------------------------------------

describe('E.2 v2: requirement levels parse and normalize', () => {
  it('parses team + leader + member structured requirements', () => {
    const src = [
      '---',
      'schemaVersion: 2',
      'blueprintId: team.v2.full',
      'revision: "1"',
      'teamRequirements:',
      '  - requirementId: team.mcp.repo',
      '    type: mcpServer',
      '    subjects: [repo]',
      '    complete: true',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      '  requirements:',
      '    - requirementId: lead.model',
      '      type: modelRoute',
      '      subjects: [qwen3.8-27b]',
      'members:',
      '  - templateId: worker',
      '    persona: "Worker."',
      '    requirements:',
      '      - requirementId: worker.mcp.web',
      '        type: mcpServer',
      '        subjects: [web]',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    const bp = parseBlueprint(src)
    expect(bp.schemaVersion).toBe(2)
    expect(bp.teamRequirements).toEqual([
      { requirementId: 'team.mcp.repo', type: 'mcpServer', subjects: ['repo'], complete: true },
    ])
    expect(bp.leader.requirements).toEqual([
      { requirementId: 'lead.model', type: 'modelRoute', subjects: ['qwen3.8-27b'], complete: false },
    ])
    const member = bp.members[0]
    expect(member).toBeDefined()
    if (member === undefined) throw new Error('expected one member template')
    expect(member.requirements).toEqual([
      { requirementId: 'worker.mcp.web', type: 'mcpServer', subjects: ['web'], complete: false },
    ])
  })

  it('normalizes an omitted `complete` to `false` (the ordinary ack-able case)', () => {
    const src = [
      '---',
      'schemaVersion: 2',
      'blueprintId: team.v2.def',
      'revision: "1"',
      'teamRequirements:',
      '  - requirementId: t.skill.foo',
      '    type: skill',
      '    subjects: [foo]',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    const bp = parseBlueprint(src)
    expect(bp.teamRequirements).toEqual([
      { requirementId: 't.skill.foo', type: 'skill', subjects: ['foo'], complete: false },
    ])
  })

  it('accepts a persona requirement (the §E.3 required-persona carrier)', () => {
    const src = [
      '---',
      'schemaVersion: 2',
      'blueprintId: team.v2.persona',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: "lead.custom-preset"',
      '  requirements:',
      '    - requirementId: lead.persona',
      '      type: persona',
      '      subjects: [standard]',
      '      complete: true',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    const bp = parseBlueprint(src)
    expect(bp.leader.requirements).toEqual([
      {
        requirementId: 'lead.persona',
        type: 'persona',
        subjects: ['standard'],
        complete: true,
      },
    ])
  })

  it('rejects a persona requirement whose subject is outside the closed required-persona-kind set (additive v2 rule, §E.3)', () => {
    // pre-alpha3 PR-E (plan §E.3) — the persona KIND convention: a persona-
    // TYPE requirement's subjects name the REQUIRED kind(s). The closed
    // `RequiredPersonaKind` set (this increment: `standard`) is enforced on
    // v2 documents only (the frozen v1 validator is untouched). A subject
    // outside the set (here `complete` — a valid OBSERVED kind, not a
    // REQUIRED one) fails loud MALFORMED_DTO, never a silent false-OPEN.
    const src = [
      '---',
      'schemaVersion: 2',
      'blueprintId: team.v2.persona-bad',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      '  requirements:',
      '    - requirementId: lead.persona',
      '      type: persona',
      '      subjects: [complete]',
      '      complete: true',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    expectCode(() => parseBlueprint(src), 'MALFORMED_DTO')
  })

  it('rejects an unknown persona subject slug (additive v2 rule, §E.3)', () => {
    const src = [
      '---',
      'schemaVersion: 2',
      'blueprintId: team.v2.persona-unknown',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      '  requirements:',
      '    - requirementId: lead.persona',
      '      type: persona',
      '      subjects: [mystery-preset]',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    expectCode(() => parseBlueprint(src), 'MALFORMED_DTO')
  })

  it('accepts an explicitly empty teamRequirements list (declared, not omitted)', () => {
    const bp = parseBlueprint(
      [
        '---',
        'schemaVersion: 2',
        'blueprintId: team.v2.empty',
        'revision: "1"',
        'teamRequirements: []',
        'leader:',
        '  templateId: leader',
        '  persona: "Lead."',
        'members: []',
        'requirements: []',
        'memberEnvelopes: []',
        'policyStates: []',
        'metadata: {}',
        '---',
        '',
      ].join('\n'),
    )
    expect(bp.schemaVersion).toBe(2)
    // declared-but-empty is a concrete `[]`, distinct from an absent key
    expect(bp.teamRequirements).toEqual([])
  })

  it('leaves a v2 document WITHOUT v2 fields as `undefined` (omitted, not present-but-empty)', () => {
    const bp = parseBlueprint(
      [
        '---',
        'schemaVersion: 2',
        'blueprintId: team.v2.bare',
        'revision: "1"',
        'leader:',
        '  templateId: leader',
        '  persona: "Lead."',
        'members: []',
        'requirements: []',
        'memberEnvelopes: []',
        'policyStates: []',
        'metadata: {}',
        '---',
        '',
      ].join('\n'),
    )
    expect(bp.schemaVersion).toBe(2)
    expect(bp.teamRequirements).toBeUndefined()
    expect(bp.leader.requirements).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// the v1 validator is FROZEN: v2 fields are unknown on v1 documents
// ---------------------------------------------------------------------------

describe('E.2 v2: the v1 validator is frozen (v2 fields are unknown on v1)', () => {
  it('rejects `teamRequirements` on a v1 document (unknown top-level field)', () => {
    const src = [
      '---',
      'schemaVersion: 1',
      'blueprintId: team.v1.with-v2',
      'revision: "1"',
      'teamRequirements:',
      '  - requirementId: x',
      '    type: tool',
      '    subjects: [x]',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    expectErrorDetails(() => parseBlueprint(src), 'MALFORMED_DTO', {
      unknownFields: ['teamRequirements'],
    })
  })

  it('rejects `requirements` on a v1 template (unknown template field)', () => {
    const src = [
      '---',
      'schemaVersion: 1',
      'blueprintId: team.v1.tpl-v2',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      '  requirements:',
      '    - requirementId: x',
      '      type: tool',
      '      subjects: [x]',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    expectErrorDetails(() => parseBlueprint(src), 'MALFORMED_DTO', {
      unknownFields: ['requirements'],
    })
  })
})

// ---------------------------------------------------------------------------
// negative: malformed v2 requirements fail loud with the exact code
// ---------------------------------------------------------------------------

describe('E.2 v2: malformed requirements fail loud', () => {
  function v2ReqSource(requirementLines: string[]): string {
    return [
      '---',
      'schemaVersion: 2',
      'blueprintId: team.v2.neg',
      'revision: "1"',
      'teamRequirements:',
      ...requirementLines.map((line) => `  ${line}`),
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
  }

  it('rejects a type outside the closed §27.1 six-set', () => {
    expectErrorDetails(
      () =>
        parseBlueprint(
          v2ReqSource(['- requirementId: x', '  type: database', '  subjects: [x]']),
        ),
      'MALFORMED_DTO',
      { problem: 'unknown requirement type' },
    )
  })

  it('rejects a duplicate requirementId within the same level', () => {
    expectErrorDetails(
      () =>
        parseBlueprint(
          v2ReqSource([
            '- requirementId: dup',
            '  type: tool',
            '  subjects: [a]',
            '- requirementId: dup',
            '  type: tool',
            '  subjects: [b]',
          ]),
        ),
      'MALFORMED_DTO',
      { requirementId: 'dup' },
    )
  })

  it('rejects empty `subjects`', () => {
    expectErrorDetails(
      () =>
        parseBlueprint(v2ReqSource(['- requirementId: x', '  type: tool', '  subjects: []'])),
      'MALFORMED_DTO',
      { path: '$.teamRequirements[0].subjects' },
    )
  })

  it('rejects a non-boolean `complete`', () => {
    expectErrorDetails(
      () =>
        parseBlueprint(
          v2ReqSource(['- requirementId: x', '  type: tool', '  subjects: [x]', '  complete: yes']),
        ),
      'MALFORMED_DTO',
      { path: '$.teamRequirements[0].complete' },
    )
  })

  it('rejects a missing `requirementId`', () => {
    expectErrorDetails(
      () => parseBlueprint(v2ReqSource(['- type: tool', '  subjects: [x]'])),
      'MALFORMED_DTO',
      { path: '$.teamRequirements[0].requirementId' },
    )
  })

  it('rejects an unknown field on a v2 requirement', () => {
    expectErrorDetails(
      () =>
        parseBlueprint(
          v2ReqSource([
            '- requirementId: x',
            '  type: tool',
            '  subjects: [x]',
            '  optional: true',
          ]),
        ),
      'MALFORMED_DTO',
      { unknownFields: ['optional'] },
    )
  })
})

// the minimal v2 helper is exercised (keeps the `body` variant alive for
// future fixtures without an unused-local warning)
describe('E.2 v2: helper sanity', () => {
  it('the v2Source helper yields a parseable document', () => {
    const bp: TeamBlueprint = parseBlueprint(v2Source('[]'))
    expect(bp.schemaVersion).toBe(2)
    expect(bp.members).toEqual([])
  })
})
