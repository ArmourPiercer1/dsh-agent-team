/**
 * THROWAWAY PROBE (lane docs/a4-73-decision-scoping).
 * Canonical copy lives in dev/agent-workflow/evidence/a4-pr7/7-3-decision/probes/.
 * Run by copying to packages/runtime/test/__probe-a473-gates.test.ts.
 *
 * P2: ONE document, TWO version labels, fed to the REAL production readers.
 * The content is identical apart from the version digit and the two authority
 * documents v3 REQUIRES; every §E.2 structured requirement is declared in both.
 * If the production readers answer differently, the structured grammar is
 * version-gated and the v3 answer is the silent one.
 *
 * Under option A (relax) the v2 and v3 answers MUST become equal; under B/B'
 * and C the v3 side changes but the v2 side is untouched (until v2 stops
 * parsing altogether).
 */
import { describe, expect, it } from 'vitest'

import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import { compatibilityRequirementsOf } from '../compatibility/blueprint.js'
import { scopeKeysOf, scopeRequirementInputsOf } from '../requirements/scope-requirements.js'

const COMMON = [
  'blueprintId: GATE-PROBE',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: lead',
  '  requirements:',
  '    - requirementId: req-lead-1',
  '      type: tool',
  '      subjects:',
  '        - web',
  '      complete: true',
  'members:',
  '  - templateId: worker',
  '    persona: work',
  '    requirements:',
  '      - requirementId: req-worker-1',
  '        type: skill',
  '        subjects:',
  '          - base',
  '        complete: true',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: false',
  'teamRequirements:',
  '  - requirementId: req-team-1',
  '    type: tool',
  '    subjects:',
  '      - web',
  '    complete: true',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
]

const V3_ONLY = ['permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []']

// Field ORDER is irrelevant to the canonical projection, so the two v3-only
// documents sit right after the version digit: no index arithmetic, no silent
// slice bug in the instrument itself.
const V2_DOC = ['---', 'schemaVersion: 2', ...COMMON, '---'].join('\n')
const V3_DOC = ['---', 'schemaVersion: 3', ...V3_ONLY, ...COMMON, '---'].join('\n')

const parse = (source: string) => {
  try {
    return { ok: true as const, bp: parseBlueprint(source) }
  } catch (error) {
    return { ok: false as const, message: String((error as Error).message ?? error) }
  }
}

const v2 = parse(V2_DOC)
const v3 = parse(V3_DOC)

const bridge = (bp: NonNullable<(typeof v2 extends { bp: infer B } ? B : never)> | undefined) =>
  bp === undefined ? [] : compatibilityRequirementsOf(bp).map((r) => r.requirementId)
const scopes = (bp: undefined | { readonly [k: string]: unknown }) =>
  bp === undefined ? [] : scopeKeysOf(scopeRequirementInputsOf(bp as never))

describe('P2 — the five production gates: v2 vs v3, same content', () => {
  it('P0a: BOTH documents parse and BOTH carry the structured grammar', () => {
    expect(v2.ok).toBe(true)
    expect(v3.ok).toBe(true)
    if (!v2.ok || !v3.ok) return
    for (const bp of [v2.bp, v3.bp]) {
      expect(bp.teamRequirements?.length).toBe(1)
      expect(bp.leader.requirements?.length).toBe(1)
      expect(bp.members[0]?.requirements?.length).toBe(1)
    }
  })

  it('P0b: parse failure text when a document is REFUSED (visible, never silent)', () => {
    if (v2.ok) expect(v2.message).toBeUndefined()
    else process.stdout.write(`[[PROBE]] v2 refused: ${v2.message}\n`)
    if (v3.ok) expect(v3.message).toBeUndefined()
    else process.stdout.write(`[[PROBE]] v3 refused: ${v3.message}\n`)
  })

  it('compatibility/blueprint.ts:81 — team bridge at v2 vs v3; the FLAT list ungated at both', () => {
    if (!v2.ok || !v3.ok) return
    process.stdout.write(`[[PROBE]] bridge v2=${JSON.stringify(bridge(v2.bp))} v3=${JSON.stringify(bridge(v3.bp))}\n`)
    expect(bridge(v2.bp)).toContain('req-tool-web')
    if (bridge(v3.bp).length > 0) expect(bridge(v3.bp)).toContain('req-tool-web')
  })

  it('requirements/scope-requirements.ts:108 — template scopes at v2 vs v3', () => {
    if (!v2.ok || !v3.ok) return
    process.stdout.write(`[[PROBE]] scopes v2=${JSON.stringify(scopes(v2.bp))} v3=${JSON.stringify(scopes(v3.bp))}\n`)
    expect(scopes(v2.bp)).toContain('team')
  })

  it('DECIDER (A): v2 and v3 production answers are IDENTICAL => the grammar is version-agnostic', () => {
    if (!v2.ok || !v3.ok) {
      process.stdout.write('[[PROBE]] DECIDER=A cannot-evaluate (a parse refusal)\n')
      return
    }
    const same =
      JSON.stringify(bridge(v2.bp)) === JSON.stringify(bridge(v3.bp)) &&
      JSON.stringify(scopes(v2.bp)) === JSON.stringify(scopes(v3.bp))
    process.stdout.write(`[[PROBE]] DECIDER=${same ? 'A-EQUAL (grammar live at v3)' : 'DIVERGENT (v3 ignores the grammar)'}\n`)
  })
})
