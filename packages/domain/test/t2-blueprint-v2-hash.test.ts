/**
 * pre-alpha3 PR-E (plan §E.2) — Blueprint schema v2 content hashing: the
 * v2 structured-requirement fields participate in the content hash
 * deterministically, and — critically for the §E.2 v1-frozen guarantee — a
 * v1 document's hashable projection carries NO v2 keys, so a v1 blueprint
 * hashes byte-identically to before §E.2 (the same "absent => key omitted"
 * discipline as the A1 `permissions` key).
 *
 * @module @dsh-agent-team/domain/test/t2-blueprint-v2-hash
 */

import { describe, expect, it } from 'vitest'

import {
  deriveContentHash,
  parseBlueprint,
  toHashableBlueprint,
} from '../blueprint/src/index.js'
import type { TeamBlueprint } from '../blueprint/src/index.js'

/**
 * §7.4 carrier migration (pre-flip half): both suites here prove VERSION
 * behaviour — v2 structured requirements participate in the content hash,
 * and the v1 projection carries NO v2 keys (the §E.2 byte-stability
 * guarantee). The digits are the SUBJECT: promoting to v3 would delete
 * both proofs; invert-to-refusal is a post-flip move. The carriers move to
 * typed code positions and the YAML lines interpolate from them
 * byte-identically. `TeamBlueprint['schemaVersion']` is the type §7.3's
 * cutover narrows to `3` — at the flip these two constants become COMPILE
 * ERRORS pointing at this proof file, where the planned delete-or-invert
 * (plan §7.3) happens loudly in review, not as a silent clean.
 */
const DECLARED_DOCUMENT_VERSION: TeamBlueprint['schemaVersion'] = 3

// ---------------------------------------------------------------------------
// a v2 document with structured requirements (deterministic content)
// ---------------------------------------------------------------------------

const V2_SOURCE: readonly string[] = [
  '---',
  `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
  'blueprintId: team.v2.hash',
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
  // §7.3 v3-only: both authority documents version 3 REQUIRES, at the honest
  // zero `rules: []`. Nothing here is an expansion fixture — this suite hashes
  // documents and never grants — so the zero is exactly what these documents mean.
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'metadata: {}',
  '---',
  '',
]

// The same logical document with the YAML top-level key order shuffled —
// the canonical-JSON projection sorts keys, so the hash must be identical.
const V2_SOURCE_SHUFFLED: readonly string[] = [
  '---',
  'metadata: {}',
  'policyStates: []',
  'memberEnvelopes: []',
  'requirements: []',
  'members:',
  '  - templateId: worker',
  '    persona: "Worker."',
  '    requirements:',
  '      - requirementId: worker.mcp.web',
  '        type: mcpServer',
  '        subjects: [web]',
  'leader:',
  '  templateId: leader',
  '  persona: "Lead."',
  '  requirements:',
  '    - requirementId: lead.model',
  '      type: modelRoute',
  '      subjects: [qwen3.8-27b]',
  // §7.3 v3-only: the same two REQUIRED documents as V2_SOURCE, placed at a
  // DIFFERENT position on purpose — this block exists to prove the hash ignores
  // YAML key order, so re-adding them in source order would test less than the
  // original did.
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'teamRequirements:',
  '  - requirementId: team.mcp.repo',
  '    type: mcpServer',
  '    subjects: [repo]',
  '    complete: true',
  'revision: "1"',
  'blueprintId: team.v2.hash',
  `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
  '---',
  '',
]

describe('E.2 v2 hash: determinism and canonical binding', () => {
  it('is deterministic across parses', () => {
    expect(parseBlueprint(V2_SOURCE.join('\n')).contentHash).toBe(
      parseBlueprint(V2_SOURCE.join('\n')).contentHash,
    )
  })

  it('is independent of YAML key order (canonical JSON sorts keys)', () => {
    expect(parseBlueprint(V2_SOURCE.join('\n')).contentHash).toBe(
      parseBlueprint(V2_SOURCE_SHUFFLED.join('\n')).contentHash,
    )
  })

  it('binds exactly to the canonical hashable projection', () => {
    const bp = parseBlueprint(V2_SOURCE.join('\n'))
    expect(bp.contentHash).toBe(deriveContentHash(toHashableBlueprint(bp)))
  })
})

describe('E.2 v2 hash: the structured requirements participate', () => {
  it('changes when a requirement subject changes', () => {
    const a = parseBlueprint(V2_SOURCE.join('\n'))
    const b = parseBlueprint(
      V2_SOURCE.join('\n').replace('subjects: [web]', 'subjects: [search]'),
    )
    expect(a.blueprintId).toBe(b.blueprintId)
    expect(a.contentHash).not.toBe(b.contentHash)
  })

  it('changes when a requirement flips complete false -> true', () => {
    const a = parseBlueprint(V2_SOURCE.join('\n'))
    const b = parseBlueprint(
      V2_SOURCE.join('\n').replace('complete: true', 'complete: false'),
    )
    expect(a.blueprintId).toBe(b.blueprintId)
    expect(a.contentHash).not.toBe(b.contentHash)
  })

  it('changes when a requirement is removed entirely', () => {
    const a = parseBlueprint(V2_SOURCE.join('\n'))
    // Drop the team-level requirement block (teamRequirements -> []).
    const b = parseBlueprint(
      V2_SOURCE.join('\n')
        .replace(
          [
            'teamRequirements:',
            '  - requirementId: team.mcp.repo',
            '    type: mcpServer',
            '    subjects: [repo]',
            '    complete: true',
          ].join('\n'),
          'teamRequirements: []',
        ),
    )
    expect(a.blueprintId).toBe(b.blueprintId)
    expect(a.contentHash).not.toBe(b.contentHash)
  })
})

describe('E.2 hash (§7.3): a document that omits the v2 fields projects none of them; the retired stamps are refused', () => {
  // §7.3 v3-only INVERSION. This leg fed the parser a v1 document and read its
  // hashable projection. At v3-only those bytes never reach a projection: the
  // version gate fires first. The projection claim survives intact at v3 (a
  // document that omits the §E.2 fields projects no such key), so the leg keeps
  // it and ADDS the gate that retired the v1 route to it — strictly more is
  // asserted than before, and nothing is asserted less.
  it('a document that omits the §E.2 fields projects none of them, and the same bytes stamped v1 are refused before any projection exists', () => {
    const withoutV2Fields = (version: number): string =>
      [
        '---',
        `schemaVersion: ${version}`,
        'blueprintId: team.v1.frozen',
        'revision: "1"',
        'leader:',
        '  templateId: leader',
        '  persona: "Lead."',
        'members: []',
        'requirements:',
        '  - domain: mcp',
        '    name: repo',
        '    optional: false',
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
    const bp = parseBlueprint(withoutV2Fields(3))
    expect(bp.schemaVersion).toBe(3)
    const hashable = toHashableBlueprint(bp) as Record<string, unknown>
    expect(Object.hasOwn(hashable, 'teamRequirements')).toBe(false)
    const leader = hashable['leader'] as Record<string, unknown>
    expect(Object.hasOwn(leader, 'requirements')).toBe(false)
    // the projection binds to the hash (no hidden keys)
    expect(bp.contentHash).toBe(deriveContentHash(hashable))
    // …and the retired stamp this leg used to carry is refused, not normalized.
    expect(() => parseBlueprint(withoutV2Fields(1))).toThrowError(
      expect.objectContaining({ code: 'SCHEMA_VERSION_MISMATCH' }),
    )
  })

  // §7.3 v3-only INVERSION of the twin leg. It compared a v1 twin against a v2
  // twin to prove the ONLY projection difference was the stamped version. With
  // one accepted version there are no twins any more, so the leg asserts the two
  // halves that were actually load-bearing: a v3 document with no §E.2 fields
  // projects none of them, and both retired stamps are refused rather than
  // silently accepted-and-normalized.
  it('a v3 document with NO v2 fields projects none of them, and the retired v1 and v2 stamps are both refused', () => {
    const lines = (version: number): string =>
      [
        '---',
        `schemaVersion: ${version}`,
        'blueprintId: team.twins',
        'revision: "1"',
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
        'metadata: {}',
        '---',
        '',
      ].join('\n')
    const v3 = parseBlueprint(lines(3))
    const h3 = toHashableBlueprint(v3) as Record<string, unknown>
    expect(Object.hasOwn(h3, 'teamRequirements')).toBe(false)
    expect(h3['schemaVersion']).toBe(3)
    // The two stamps that used to be the twins are now refused outright. This is
    // the cutover's whole contract, stated at the hashing surface.
    for (const retired of [1, 2]) {
      expect(() => parseBlueprint(lines(retired)), `schemaVersion ${retired} must not parse`).toThrowError(
        expect.objectContaining({ code: 'SCHEMA_VERSION_MISMATCH' }),
      )
    }
  })
})
