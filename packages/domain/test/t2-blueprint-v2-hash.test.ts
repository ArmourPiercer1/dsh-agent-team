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

// ---------------------------------------------------------------------------
// a v2 document with structured requirements (deterministic content)
// ---------------------------------------------------------------------------

const V2_SOURCE: readonly string[] = [
  '---',
  'schemaVersion: 2',
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
  'teamRequirements:',
  '  - requirementId: team.mcp.repo',
  '    type: mcpServer',
  '    subjects: [repo]',
  '    complete: true',
  'revision: "1"',
  'blueprintId: team.v2.hash',
  'schemaVersion: 2',
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

describe('E.2 v2 hash: the v1 projection carries NO v2 keys (byte-stability)', () => {
  it('a v1 document has no `teamRequirements` and no template `requirements` in its projection', () => {
    const bp = parseBlueprint(
      [
        '---',
        'schemaVersion: 1',
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
        'metadata: {}',
        '---',
        '',
      ].join('\n'),
    )
    expect(bp.schemaVersion).toBe(1)
    const hashable = toHashableBlueprint(bp) as Record<string, unknown>
    expect(Object.hasOwn(hashable, 'teamRequirements')).toBe(false)
    const leader = hashable['leader'] as Record<string, unknown>
    expect(Object.hasOwn(leader, 'requirements')).toBe(false)
    // the projection binds to the hash (no hidden keys)
    expect(bp.contentHash).toBe(deriveContentHash(hashable))
  })

  it('a v2 document with NO v2 fields projects identically to its v1 twin except `schemaVersion`', () => {
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
        'metadata: {}',
        '---',
        '',
      ].join('\n')
    const v1 = parseBlueprint(lines(1))
    const v2 = parseBlueprint(lines(2))
    const h1 = toHashableBlueprint(v1) as Record<string, unknown>
    const h2 = toHashableBlueprint(v2) as Record<string, unknown>
    // neither projection has a v2 key
    expect(Object.hasOwn(h1, 'teamRequirements')).toBe(false)
    expect(Object.hasOwn(h2, 'teamRequirements')).toBe(false)
    // the ONLY difference is the stamped schemaVersion
    expect(h2['schemaVersion']).toBe(2)
    expect(h1['schemaVersion']).toBe(1)
    expect(h1).not.toEqual(h2)
    expect(v1.contentHash).not.toBe(v2.contentHash)
  })
})
