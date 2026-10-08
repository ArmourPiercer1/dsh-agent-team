/**
 * THE INSTRUMENT THAT DOES NOT EXIST IN THE REPO (throwaway).
 * A v3 twin of t2-blueprint-v2-hash: does v3 IDENTITY commit to the §E.2
 * grammar? Run this against a build where the projection silently omits it at
 * v3 and these titles go red. No repository test does this today — the census
 * over 174 blueprint-bearing test files recorded ZERO v3 parses carrying the
 * grammar (T4-census-tally.txt), so nothing in the suite can notice.
 */
import { describe, expect, it } from 'vitest'

import { parseBlueprint, toHashableBlueprint, deriveContentHash } from '../../domain/blueprint/src/index.js'

const doc = (reqBlock: readonly string[]): string =>
  [
    '---',
    'schemaVersion: 3',
    'blueprintId: V3-IDENTITY-PROBE',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: lead',
    'members: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    ...reqBlock,
    '---',
  ].join('\n')

const ABSENT: readonly string[] = []
const DECLARED: readonly string[] = [
  'teamRequirements:',
  '  - requirementId: req-team-1',
  '    type: tool',
  '    subjects:',
  '      - web',
  '    complete: true',
]
const FLIPPED: readonly string[] = DECLARED.map((l) => (l === '    complete: true' ? '    complete: false' : l))
const MUTATED: readonly string[] = DECLARED.map((l) => (l === '      - web' ? '      - shell' : l))

const hash = (lines: readonly string[]): string => deriveContentHash(toHashableBlueprint(parseBlueprint(doc(lines))))
const hasKey = (lines: readonly string[]): boolean => 'teamRequirements' in (toHashableBlueprint(parseBlueprint(doc(lines))) as Record<string, unknown>)

describe('v3 identity binds the §E.2 grammar (the missing instrument)', () => {
  it('a declared teamRequirements puts the key into the hashable projection', () => {
    expect(hasKey(DECLARED)).toBe(true)
    expect(hasKey(ABSENT)).toBe(false)
  })

  it('the hash changes when a requirement flips complete true -> false', () => {
    expect(hash(DECLARED)).not.toBe(hash(FLIPPED))
  })

  it('the hash changes when a requirement subject changes', () => {
    expect(hash(DECLARED)).not.toBe(hash(MUTATED))
  })

  it('the hash changes when the grammar is removed entirely', () => {
    expect(hash(DECLARED)).not.toBe(hash(ABSENT))
  })
})
