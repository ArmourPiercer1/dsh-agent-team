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
// §7.3: the `TeamBlueprint` type import this file used is gone with the
// migrated legs — an unused import is a NEW lint identity, and the identity
// lint gates on new identities, so it goes rather than being baselined.

/**
 * §7.3 v3-only: what "frozen" means now.
 *
 * This suite's subject has always been the v1 DOCUMENT contract, and the flip
 * did not soften it — it moved the refusal earlier. §7.4 deliberately left the
 * digit at 1 on a typed code position so the cutover would arrive here as a
 * compile error naming this file rather than as a silent parse refusal; that
 * compile error is this commit, and the companion move is the invert-to-refusal
 * plan §7.3 called for.
 *
 * So `V1_SOURCE` below is no longer a fixture the product runs. It is FROZEN
 * INPUT BYTES — a document some world still holds — and every leg is stated
 * about those bytes: refused, refused deterministically, refused for the
 * VERSION rather than for a field, and migratable. No leg asserts less than it
 * did; the legs that asserted a v1 document PARSES described a claim that is
 * simply no longer true of any document.
 */

/** The retired stamp, as a plain number. It can no longer be typed as
 *  `TeamBlueprint['schemaVersion']`: that type IS the accepted set, and a stamp
 *  that cannot be typed is exactly what a retired version now is. */
const RETIRED_V1_DOCUMENT_VERSION = 1

/** A v1 document with a persona string + a flat capability requirement. */
const V1_SOURCE: readonly string[] = [
  '---',
  `schemaVersion: ${RETIRED_V1_DOCUMENT_VERSION}`,
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

describe('E.11 blueprint-v1-frozen-resume (§7.3): the v1 document is refused, deterministically, for its version — and it is migratable', () => {
  it('a v1 document (persona string + flat requirements) is refused at the version gate', () => {
    expect(() => parseBlueprint(V1_SOURCE.join('\n'))).toThrowError(
      expect.objectContaining({ code: 'SCHEMA_VERSION_MISMATCH' }),
    )
  })

  // The old leg here asserted the v1 content hash is stable across parses, i.e.
  // "a v1 document resumes byte-identically". Nothing resumes any more, so the
  // leg states the property that replaced it: the REFUSAL is the stable,
  // identity-preserving answer, and no half-built blueprint escapes to be
  // hashed. A refusal that varied between parses would be the resume bug wearing
  // a different coat.
  it('the refusal is deterministic across parses and yields no partial blueprint to hash', () => {
    // One explicit return type: the two branches otherwise union to a shape
    // whose `err` is `{}`, and `err?.code` does not typecheck (tsc: TS2339).
    const attempts = [0, 1].map(
      (): { bp: unknown; err: { code?: string; message?: string } | undefined } => {
      try {
        return { bp: parseBlueprint(V1_SOURCE.join('\n')) as unknown, err: undefined }
      } catch (error) {
        return { bp: undefined, err: error as { code?: string; message?: string } }
      }
      },
    )
    for (const a of attempts) {
      expect(a.bp, 'a refused v1 document must not produce a blueprint').toBeUndefined()
      expect(a.err?.code).toBe('SCHEMA_VERSION_MISMATCH')
    }
    expect(attempts[0]?.err?.message).toBe(attempts[1]?.err?.message)
    expect(String(attempts[0]?.err?.message)).toContain('[3]')
  })

  // The old leg read the v1 projection to show it carried no `teamRequirements`
  // key. There is no v1 projection to read; the surface that survives is the
  // closed field set, and it is now unreachable through a document at all —
  // recorded here rather than left as a silent dead branch.
  it('the frozen v1 field set is no longer REACHED: the same bytes carrying a v2 field refuse for the version, not the field', () => {
    const src = [
      '---',
      `schemaVersion: ${RETIRED_V1_DOCUMENT_VERSION}`,
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
    let code: string | undefined
    let details: unknown
    try {
      parseBlueprint(src)
    } catch (error) {
      const e = error as { code?: string; details?: unknown }
      code = e.code
      details = e.details
    }
    // Was `MALFORMED_DTO` naming the unknown field; now the version gate fires
    // first, so the field set is never consulted. Stronger, and different.
    expect(code).toBe('SCHEMA_VERSION_MISMATCH')
    expect(JSON.stringify(details ?? {})).not.toContain('teamRequirements')
  })

  // The counter-control that keeps the three legs above honest: the bytes are
  // refused for the STAMP, not for their content. Promote the same document to
  // the one accepted version, add the two authority documents v3 requires, and
  // it parses and hashes normally. Without this leg the suite would pass even if
  // the cutover had broken v1 CONTENT, which is not what it did.
  it('the same content stamped v3 with the required authority documents parses, hashes, and binds to its projection', () => {
    const promoted = V1_SOURCE.join('\n')
      .replace('schemaVersion: 1', 'schemaVersion: 3')
      .replace('metadata: {}', ['permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []', 'metadata: {}'].join('\n'))
    expect(promoted, 'the promotion must actually have applied').toContain('schemaVersion: 3')
    expect(promoted).toContain('permissionMutationEnvelope:')
    const bp = parseBlueprint(promoted)
    expect(bp.schemaVersion).toBe(3)
    expect(bp.leader.persona).toBe('Lead.')
    expect(bp.members).toHaveLength(1)
    expect(bp.members[0]?.persona).toBe('Worker.')
    expect(bp.teamRequirements).toBeUndefined()
    const hashable = toHashableBlueprint(bp) as Record<string, unknown>
    expect(Object.hasOwn(hashable, 'teamRequirements')).toBe(false)
    expect(bp.contentHash).toBe(deriveContentHash(hashable))
    expect(bp.contentHash).toBe(parseBlueprint(promoted).contentHash)
  })
})
