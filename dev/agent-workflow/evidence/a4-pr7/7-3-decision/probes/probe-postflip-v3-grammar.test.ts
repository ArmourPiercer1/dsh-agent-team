/**
 * POST-FLIP DISCRIMINATOR (throwaway). After §7.3 there is only v3, so the
 * v2/v3 comparison is dead. The live question is: does a v3 document that
 * DECLARES the §E.2 structured grammar get it ENFORCED?
 *
 * Two v3 documents, identical except for the structured declarations, fed to
 * the real production readers:
 *   WITH    -> teamRequirements + leader.requirements + member.requirements
 *   WITHOUT -> same document, structured declarations removed
 * Expected verdicts:
 *   A (relax)     : answers DIFFER   (grammar enforced at v3)   -> ENFORCED
 *   B (retire)    : answers MATCH    (grammar silently inert)   -> INERT
 *   C (forbid)    : WITH refused with BLUEPRINT_STRUCTURED_REQUIREMENTS_RETIRED_AT_V3
 *   D (un-nameable): WITH refused as an unknown field
 */
import { describe, expect, it } from 'vitest'

import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import { compatibilityRequirementsOf } from '../compatibility/blueprint.js'
import { scopeKeysOf, scopeRequirementInputsOf } from '../requirements/scope-requirements.js'

const HEAD = ['---', 'schemaVersion: 3', 'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []']
const STRUCTURED_TEAM = ['teamRequirements:', '  - requirementId: req-team-1', '    type: tool', '    subjects:', '      - web', '    complete: true']
const STRUCTURED_LEADER = ['  requirements:', '    - requirementId: req-lead-1', '      type: tool', '      subjects:', '        - web', '      complete: true']
const STRUCTURED_MEMBER = ['    requirements:', '      - requirementId: req-worker-1', '        type: skill', '        subjects:', '          - base', '        complete: true']

const body = (leaderExtra: string[], memberExtra: string[], team: string[]): string[] => [
  'blueprintId: POST-FLIP-PROBE',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: lead',
  ...leaderExtra,
  'members:',
  '  - templateId: worker',
  '    persona: work',
  ...memberExtra,
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: false',
  ...team,
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
]

const WITH = [...HEAD, ...body(STRUCTURED_LEADER, STRUCTURED_MEMBER, STRUCTURED_TEAM), '---'].join('\n')
const WITHOUT = [...HEAD, ...body([], [], []), '---'].join('\n')

const parse = (source: string) => {
  try {
    return { ok: true as const, bp: parseBlueprint(source) }
  } catch (error) {
    return { ok: false as const, message: String((error as Error).message ?? error) }
  }
}
const answers = (bp: ReturnType<typeof parse> extends { bp?: infer B } ? B : never) =>
  bp === undefined
    ? { bridge: [] as string[], scopes: [] as string[] }
    : {
        bridge: compatibilityRequirementsOf(bp).map((r) => r.requirementId),
        scopes: scopeKeysOf(scopeRequirementInputsOf(bp as never)),
      }

const w = parse(WITH)
const o = parse(WITHOUT)

describe('post-flip: is the structured grammar enforced at v3?', () => {
  it('report: parse outcome for a v3 document that declares the grammar', () => {
    process.stdout.write(`[[PROBE]] WITH parses=${w.ok}${w.ok ? '' : ` reason: ${w.message}`}\n`)
    process.stdout.write(`[[PROBE]] WITHOUT parses=${o.ok}${o.ok ? '' : ` reason: ${o.message}`}\n`)
    expect(true).toBe(true)
  })

  it('verdict: ENFORCED / INERT / REFUSED', () => {
    if (!w.ok) {
      process.stdout.write(`[[PROBE]] VERDICT=REFUSED (v3 + grammar is rejected)\n`)
      return
    }
    if (!o.ok) {
      process.stdout.write('[[PROBE]] VERDICT=BROKEN-INSTRUMENT (the control document itself refused)\n')
      return
    }
    const a = answers(w.bp)
    const b = answers(o.bp)
    process.stdout.write(`[[PROBE]] WITH bridge=${JSON.stringify(a.bridge)} scopes=${JSON.stringify(a.scopes)}\n`)
    process.stdout.write(`[[PROBE]] WITHOUT bridge=${JSON.stringify(b.bridge)} scopes=${JSON.stringify(b.scopes)}\n`)
    const differ = JSON.stringify(a) !== JSON.stringify(b)
    process.stdout.write(`[[PROBE]] VERDICT=${differ ? 'ENFORCED (option A behaviour)' : 'INERT (option B behaviour: declared, hashed, ignored)'}\n`)
    const hashDiff = w.bp.contentHash !== o.bp.contentHash
    process.stdout.write(`[[PROBE]] identity-commits-to-the-grammar=${hashDiff ? 'YES (hash differs)' : 'no'}\n`)
  })
})
