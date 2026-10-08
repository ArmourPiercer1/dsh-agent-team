/**
 * a4p7-v3-identity-binds-grammar.test.ts — A4-PR7 §7.3, the IDENTITY twin.
 *
 * WHY THIS FILE EXISTS. The §7.3 decision (decision record
 * `dev/agent-workflow/evidence/a4-pr7/7-3-decision/Dossier.md`) landed Option A: the §E.2
 * structured grammar is enforced at EVERY document version, because the grammar is a
 * property of the blueprint SHAPE, not of its version digit. Option A's own residual,
 * stated in that record: at base **0 of 562** tests in the affected universe noticed a
 * silent v3 identity drop of the grammar, and **0 of 2276** census parses carried it at
 * v3. This file is one of the two instruments that closes that hole; it is the v3 twin of
 * `t2-blueprint-v2-hash.test.ts`'s "the structured requirements participate" block.
 *
 * WHAT IT OWES. If `toHashableBlueprint` ever omits the structured declarations at v3 —
 * one silent line — these titles go red. That is the whole point: the oracle is the
 * parser's OWN (`deriveContentHash(toHashableBlueprint(x)) === parseBlueprint(x).contentHash`
 * is asserted below), so this is not a reimplementation of the hash.
 *
 * THE FIXTURES ARE v3, not v2: they carry the two documents v3 requires
 * (`permissionMutationEnvelope`, `teamHardEnvelope`, validate.ts:1334) so the digit is
 * never the reason a leg fails. Both envelope documents are empty on purpose — this file
 * is about the REQUIREMENT GRAMMAR's identity, not about authority width.
 *
 * @module @dsh-agent-team/domain/test/a4p7-v3-identity-binds-grammar
 */

import { describe, expect, it } from 'vitest'

import {
  deriveContentHash,
  parseBlueprint,
  toHashableBlueprint,
} from '../blueprint/src/index.js'

// ---------------------------------------------------------------------------
// v3 fixture: hand-written YAML line arrays (no emitter, no index arithmetic —
// both were measured to fabricate failures for EMITTER reasons, Dossier §6.8).
// ---------------------------------------------------------------------------

/** The two authority documents a v3 document must state (no defaults). */
const V3_REQUIRED_ENVELOPES: readonly string[] = [
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
]

/** One §E.2 TEAM-level structured requirement. */
const TEAM_REQUIREMENT: readonly string[] = [
  'teamRequirements:',
  '  - requirementId: team.mcp.repo',
  '    type: mcpServer',
  '    subjects: [repo]',
  '    complete: true',
]

/** The same requirement with `complete` flipped — a semantic change, not a reformat. */
const TEAM_REQUIREMENT_COMPLETE_FALSE: readonly string[] =
  TEAM_REQUIREMENT.map((line) => (line === '    complete: true' ? '    complete: false' : line))

/** The same requirement with a different subject — a semantic change, not a reformat. */
const TEAM_REQUIREMENT_OTHER_SUBJECT: readonly string[] =
  TEAM_REQUIREMENT.map((line) => (line === '    subjects: [repo]' ? '    subjects: [search]' : line))

/** The same requirement under a different id — the identity axis the bridge keys on. */
const TEAM_REQUIREMENT_OTHER_ID: readonly string[] =
  TEAM_REQUIREMENT.map((line) =>
    line === '  - requirementId: team.mcp.repo' ? '  - requirementId: team.mcp.other' : line,
  )

/** One §E.2 LEADER-template structured requirement (indented under `leader:`). */
const LEADER_REQUIREMENT: readonly string[] = [
  '  requirements:',
  '    - requirementId: lead.model',
  '      type: modelRoute',
  '      subjects: [qwen3.8-27b]',
  '      complete: true',
]

/** One §E.2 MEMBER-template structured requirement (indented under the member row). */
const MEMBER_REQUIREMENT: readonly string[] = [
  '    requirements:',
  '      - requirementId: worker.mcp.web',
  '        type: mcpServer',
  '        subjects: [web]',
  '        complete: true',
]

/**
 * Build a legal v3 document. `leaderExtra` / `memberExtra` are inserted INSIDE their
 * template rows, `teamExtra` at top level, so the WITH/WITHOUT pair differs only in the
 * §E.2 declarations and in nothing else.
 */
const v3Source = (
  teamExtra: readonly string[],
  leaderExtra: readonly string[] = [],
  memberExtra: readonly string[] = [],
): string =>
  [
    '---',
    'schemaVersion: 3',
    'blueprintId: team.v3.grammar.identity',
    'revision: "1"',
    ...V3_REQUIRED_ENVELOPES,
    ...teamExtra,
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    ...leaderExtra,
    'members:',
    '  - templateId: worker',
    '    persona: "Worker."',
    ...memberExtra,
    'requirements: []',
    'teamEnvelope:',
    '  allow: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')

/** The document that DECLARES the whole §E.2 grammar at v3. */
const WITH = v3Source(TEAM_REQUIREMENT, LEADER_REQUIREMENT, MEMBER_REQUIREMENT)
/** The same document with NO structured declarations (the control). */
const WITHOUT = v3Source([])

const hashOf = (source: string): string => parseBlueprint(source).contentHash
const hashableOf = (source: string): Record<string, unknown> =>
  toHashableBlueprint(parseBlueprint(source)) as unknown as Record<string, unknown>

describe('§7.3 v3 identity: the parser is its own oracle', () => {
  it('a v3 document that declares the grammar parses (the digit is never the reason)', () => {
    expect(() => parseBlueprint(WITH)).not.toThrow()
    expect(() => parseBlueprint(WITHOUT)).not.toThrow()
    expect(parseBlueprint(WITH).schemaVersion).toBe(3)
  })

  it('contentHash equals deriveContentHash(toHashableBlueprint(...)) for both legs', () => {
    for (const source of [WITH, WITHOUT]) {
      const bp = parseBlueprint(source)
      expect(bp.contentHash).toBe(deriveContentHash(toHashableBlueprint(bp)))
    }
  })

  it('is deterministic across parses', () => {
    expect(hashOf(WITH)).toBe(hashOf(WITH))
  })
})

describe('§7.3 v3 identity: the §E.2 grammar is IN the hashable projection', () => {
  it('a declared teamRequirements puts the key into the v3 projection', () => {
    expect(Object.hasOwn(hashableOf(WITH), 'teamRequirements')).toBe(true)
  })

  it('an undeclared document carries NO teamRequirements key in the v3 projection', () => {
    // The "absent => key omitted" discipline the v2 twin pins for v1 must survive at v3:
    // an OMITTED key and a null one are different content identities.
    expect(Object.hasOwn(hashableOf(WITHOUT), 'teamRequirements')).toBe(false)
  })

  it('the template-level declarations are in the v3 projection too', () => {
    const hashable = hashableOf(WITH)
    const leader = hashable['leader'] as Record<string, unknown>
    const members = hashable['members'] as Record<string, unknown>[]
    expect(Object.hasOwn(leader, 'requirements')).toBe(true)
    expect(members).toHaveLength(1)
    expect(Object.hasOwn(members[0] as Record<string, unknown>, 'requirements')).toBe(true)
  })
})

describe('§7.3 v3 identity: the §E.2 grammar BINDS the content hash', () => {
  it('the hash changes when the grammar is removed entirely', () => {
    // THE decisive leg: this is the exact silent-drop mutation the decision record
    // measured as invisible to 0 of 562 tests. Declaring a requirement must never be
    // identity-free — the document would then "believe" it requires something its own
    // identity does not commit to.
    expect(hashOf(WITH)).not.toBe(hashOf(WITHOUT))
  })

  it('the hash changes when a requirement flips complete true -> false', () => {
    expect(hashOf(v3Source(TEAM_REQUIREMENT))).not.toBe(hashOf(v3Source(TEAM_REQUIREMENT_COMPLETE_FALSE)))
  })

  it('the hash changes when a requirement subject changes', () => {
    expect(hashOf(v3Source(TEAM_REQUIREMENT))).not.toBe(hashOf(v3Source(TEAM_REQUIREMENT_OTHER_SUBJECT)))
  })

  it('the hash changes when a requirement id changes', () => {
    expect(hashOf(v3Source(TEAM_REQUIREMENT))).not.toBe(hashOf(v3Source(TEAM_REQUIREMENT_OTHER_ID)))
  })

  it('the hash changes when a LEADER template requirement is removed', () => {
    expect(hashOf(v3Source([], LEADER_REQUIREMENT))).not.toBe(hashOf(v3Source([])))
  })

  it('the hash changes when a MEMBER template requirement is removed', () => {
    expect(hashOf(v3Source([], [], MEMBER_REQUIREMENT))).not.toBe(hashOf(v3Source([])))
  })

  it('blueprintId is NOT the discriminator (same id, different content identity)', () => {
    const a = parseBlueprint(WITH)
    const b = parseBlueprint(WITHOUT)
    expect(a.blueprintId).toBe(b.blueprintId)
    expect(a.contentHash).not.toBe(b.contentHash)
  })
})
