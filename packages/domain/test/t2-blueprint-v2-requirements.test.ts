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

/**
 * §7.4 carrier migration (pre-flip half): this suite pins the v2
 * structured-requirement surface AND the frozen-v1 leg (a v1 document that
 * names a v2 field must fail loud — v1 is NOT tightened into v2). Both
 * digits are the SUBJECT: promoting to v3 deletes the v2 proof and the
 * v1-freeze negative; invert-to-refusal is a post-flip move. The carriers
 * move to typed code positions and every YAML line interpolates from them
 * byte-identically. `TeamBlueprint['schemaVersion']` is the type §7.3's
 * cutover narrows to `3` — at the flip these constants become COMPILE
 * ERRORS naming this proof file, where delete-or-invert (plan §7.3) is
 * decided in review, not silently here.
 */
const DECLARED_DOCUMENT_VERSION: TeamBlueprint['schemaVersion'] = 3

// ---------------------------------------------------------------------------
// helpers: build v2 documents as raw YAML source
// ---------------------------------------------------------------------------

/** A minimal v2 document with an (empty) `teamRequirements` list. */
function v2Source(body: string): string {
  return [
    '---',
    `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
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
    // §7.3 v3-only: both authority documents version 3 REQUIRES, at the honest zero
    // `rules: []`. This suite parses and validates requirement grammars; it never
    // grants, so an empty authority document is exactly what these fixtures mean.
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
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
      `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
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
      // §7.3 v3-only: the two authority documents version 3 REQUIRES, at the
      // honest zero `rules: []` — this fixture parses or hashes a document, it
      // never grants, so an empty authority document is exactly what it means.
      'permissionMutationEnvelope:',
      '  rules: []',
      'teamHardEnvelope:',
      '  rules: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    const bp = parseBlueprint(src)
    expect(bp.schemaVersion).toBe(3)
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
      `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
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
      // §7.3 v3-only: the two authority documents version 3 REQUIRES, at the
      // honest zero `rules: []` — this fixture parses or hashes a document, it
      // never grants, so an empty authority document is exactly what it means.
      'permissionMutationEnvelope:',
      '  rules: []',
      'teamHardEnvelope:',
      '  rules: []',
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
      `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
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
      // §7.3 v3-only: the two authority documents version 3 REQUIRES, at the
      // honest zero `rules: []` — this fixture parses or hashes a document, it
      // never grants, so an empty authority document is exactly what it means.
      'permissionMutationEnvelope:',
      '  rules: []',
      'teamHardEnvelope:',
      '  rules: []',
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
      `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
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
      // §7.3 v3-only: the two authority documents version 3 REQUIRES, at the
      // honest zero `rules: []` — this fixture parses or hashes a document, it
      // never grants, so an empty authority document is exactly what it means.
      'permissionMutationEnvelope:',
      '  rules: []',
      'teamHardEnvelope:',
      '  rules: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    expectCode(() => parseBlueprint(src), 'MALFORMED_DTO')
  })

  it('rejects an unknown persona subject slug (additive v2 rule, §E.3)', () => {
    const src = [
      '---',
      `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
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
      // §7.3 v3-only: the two authority documents version 3 REQUIRES, at the
      // honest zero `rules: []` — this fixture parses or hashes a document, it
      // never grants, so an empty authority document is exactly what it means.
      'permissionMutationEnvelope:',
      '  rules: []',
      'teamHardEnvelope:',
      '  rules: []',
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
        `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
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
        // §7.3 v3-only: the two authority documents version 3 REQUIRES, at the
        // honest zero `rules: []` — this fixture parses or hashes a document, it
        // never grants, so an empty authority document is exactly what it means.
        'permissionMutationEnvelope:',
        '  rules: []',
        'teamHardEnvelope:',
        '  rules: []',
        'metadata: {}',
        '---',
        '',
      ].join('\n'),
    )
    expect(bp.schemaVersion).toBe(3)
    // declared-but-empty is a concrete `[]`, distinct from an absent key
    expect(bp.teamRequirements).toEqual([])
  })

  it('leaves a v2 document WITHOUT v2 fields as `undefined` (omitted, not present-but-empty)', () => {
    const bp = parseBlueprint(
      [
        '---',
        `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
        'blueprintId: team.v2.bare',
        'revision: "1"',
        'leader:',
        '  templateId: leader',
        '  persona: "Lead."',
        'members: []',
        'requirements: []',
        'memberEnvelopes: []',
        'policyStates: []',
        // §7.3 v3-only: the two authority documents version 3 REQUIRES, at the
        // honest zero `rules: []` — this fixture parses or hashes a document, it
        // never grants, so an empty authority document is exactly what it means.
        'permissionMutationEnvelope:',
        '  rules: []',
        'teamHardEnvelope:',
        '  rules: []',
        'metadata: {}',
        '---',
        '',
      ].join('\n'),
    )
    expect(bp.schemaVersion).toBe(3)
    expect(bp.teamRequirements).toBeUndefined()
    expect(bp.leader.requirements).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// the v1 validator is FROZEN: v2 fields are unknown on v1 documents
// ---------------------------------------------------------------------------

// §7.3 v3-only INVERSION of the frozen-v1 group. Both legs fed the parser a v1
// document carrying a §E.2 field and asserted the refusal named THAT FIELD as
// unknown (`unknownFields: ['teamRequirements']` / `['requirements']`) — the
// frozen closed v1 field set. Post-cutover the version gate fires first, so the
// field set is never consulted: the refusal the legs can still observe is the
// version one, and it is the STRONGER fact (no v1 document parses at all, with
// or without a v2 field). The two assertions below say exactly that, and each
// still distinguishes its own bytes: the refusal is checked to be the version
// refusal and NOT an unknown-field refusal, which is what would silently "pass"
// if the field set were consulted first and the cutover later regressed.
describe('E.2 (§7.3): the v1 route is closed at the version gate before the frozen v1 field set is reached', () => {
  it('a v1 document naming `teamRequirements` is refused for its VERSION, not for the unknown field', () => {
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
    const thrown = (() => {
      try {
        parseBlueprint(src)
        return undefined
      } catch (error) {
        return error as { code?: string; details?: Record<string, unknown> }
      }
    })()
    expect(thrown?.code).toBe('SCHEMA_VERSION_MISMATCH')
    // Not an unknown-field refusal: the v1 closed set is no longer reached.
    expect(JSON.stringify(thrown?.details ?? {})).not.toContain('teamRequirements')
  })

  it('a v1 template naming `requirements` is refused for its VERSION, and the SAME bytes stamped v3 parse the field', () => {
    const body = (version: string): string =>
      [
        '---',
        `schemaVersion: ${version}`,
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
        'permissionMutationEnvelope:',
        '  rules: []',
        'teamHardEnvelope:',
        '  rules: []',
        'metadata: {}',
        '---',
        '',
      ].join('\n')
    expect(() => parseBlueprint(body('1'))).toThrowError(
      expect.objectContaining({ code: 'SCHEMA_VERSION_MISMATCH' }),
    )
    // …and the field itself is not what the product rejects any more: on the one
    // accepted version the per-template `requirements` field parses. This is the
    // half that keeps the group honest — it proves the refusal above is about
    // the version, not about the field being disallowed.
    const at3 = parseBlueprint(body('3'))
    expect(at3.leader.requirements?.map((r) => r.requirementId)).toEqual(['x'])
  })
})

// ---------------------------------------------------------------------------
// negative: malformed v2 requirements fail loud with the exact code
// ---------------------------------------------------------------------------

describe('E.2 v2: malformed requirements fail loud', () => {
  function v2ReqSource(requirementLines: string[]): string {
    return [
      '---',
      `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
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
      // §7.3 v3-only: the two authority documents version 3 REQUIRES, at the
      // honest zero `rules: []` — this fixture parses or hashes a document, it
      // never grants, so an empty authority document is exactly what it means.
      'permissionMutationEnvelope:',
      '  rules: []',
      'teamHardEnvelope:',
      '  rules: []',
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
    expect(bp.schemaVersion).toBe(3)
    expect(bp.members).toEqual([])
  })
})
