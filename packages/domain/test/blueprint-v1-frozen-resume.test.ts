/**
 * pre-alpha3 PR-E (plan §E.2) — E.11 suite `blueprint-v1-frozen-resume`:
 * the v1 Blueprint schema is FROZEN. PR-E is ADDITIVE: it adds the v2
 * structured-requirement rules (the persona KIND closed set, the
 * `teamRequirements` level) WITHOUT tightening or changing the v1
 * validator. A v1 document created before PR-E must RESUME after PR-E —
 * it parses byte-identically (the same content hash), the same frozen
 * bridge applies, and v2 fields remain unknown on v1 (the frozen closed
 * field sets). This suite pins that the v1 surface is untouched:
 *   - a v1 document (persona string + flat capability requirements) parses;
 *   - its content hash is stable across parses (frozen);
 *   - the v2-only persona-kind rule does NOT apply to v1 (the v1 persona is
 *     a free-form string, not a structured persona requirement);
 *   - a v2 field (`teamRequirements` / a template `requirements`) is still
 *     rejected on a v1 document (the frozen closed field sets).
 *
 * @module @dsh-agent-team/domain/test/blueprint-v1-frozen-resume
 */

import { describe, expect, it } from 'vitest'

import {
  deriveContentHash,
  parseBlueprint,
  toHashableBlueprint,
} from '../blueprint/src/index.js'
import { expectCode } from './t2-helpers.js'
import type { TeamBlueprint } from '../blueprint/src/index.js'

/**
 * §7.4 carrier migration (pre-flip half): the subject of THIS suite is the
 * v1 document contract — "a v1 document created before PR-E resumes
 * byte-identically" is only true of a document that IS v1. Promoting these
 * fixtures to v3 would delete the proof, and invert-to-refusal is a post-
 * flip move (v1 is still SUPPORTED today: the bridge is [1,2,3]). So the
 * DOCUMENT stays v1 and the CARRIER moves: the digit lives at a typed code
 * position, and the YAML line interpolates from it byte-identically.
 * `TeamBlueprint['schemaVersion']` is exactly the type §7.3's cutover
 * narrows to `3` — at the flip this line becomes a COMPILE ERROR pointing
 * at this file, where the companion move is this suite's planned
 * delete-or-invert (plan §7.3), decided by the flip PR, not silently here.
 */
const V1_DOCUMENT_VERSION: TeamBlueprint['schemaVersion'] = 1

/** A v1 document with a persona string + a flat capability requirement. */
const V1_SOURCE: readonly string[] = [
  '---',
  `schemaVersion: ${V1_DOCUMENT_VERSION}`,
  'blueprintId: team.v1.frozen',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "Lead."',
  'members:',
  '  - templateId: worker',
  '    persona: "Worker."',
  'requirements:',
  '  - domain: mcp',
  '    name: repo',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
]

describe('E.11 blueprint-v1-frozen-resume: the v1 schema is frozen', () => {
  it('a v1 document (persona string + flat requirements) parses', () => {
    const bp = parseBlueprint(V1_SOURCE.join('\n'))
    expect(bp.schemaVersion).toBe(1)
    expect(bp.leader.persona).toBe('Lead.')
    expect(bp.members).toHaveLength(1)
    expect(bp.members[0]?.persona).toBe('Worker.')
  })

  it('the v1 content hash is stable across parses (byte-identical resume)', () => {
    const a = parseBlueprint(V1_SOURCE.join('\n'))
    const b = parseBlueprint(V1_SOURCE.join('\n'))
    expect(a.contentHash).toBe(b.contentHash)
    expect(a.contentHash).toBe(deriveContentHash(toHashableBlueprint(a)))
  })

  it('the v1 projection carries no v2 key (the v2 structured-requirement surface is absent on v1)', () => {
    const bp = parseBlueprint(V1_SOURCE.join('\n'))
    const hashable = toHashableBlueprint(bp) as Record<string, unknown>
    expect(Object.hasOwn(hashable, 'teamRequirements')).toBe(false)
  })

  it('a v2 `teamRequirements` field is still rejected on a v1 document (frozen closed field sets)', () => {
    const src = [
      '---',
      `schemaVersion: ${V1_DOCUMENT_VERSION}`,
      'blueprintId: team.v1.v2-field',
      'revision: "1"',
      'teamRequirements:',
      '  - requirementId: x',
      '    type: persona',
      '    subjects: [standard]',
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
    expectCode(() => parseBlueprint(src), 'MALFORMED_DTO')
  })
})
