/**
 * a4p7-v3-grammar-enforced.test.ts — A4-PR7 §7.3, the ENFORCEMENT twin.
 *
 * WHY THIS FILE EXISTS. The §7.3 decision (decision record
 * `dev/agent-workflow/evidence/a4-pr7/7-3-decision/Dossier.md`) chose Option A: a document
 * that DECLARES the §E.2 structured grammar gets it ENFORCED, at every version. The
 * option it rejected most sharply was B — keep the field legal and hashed but stop
 * enforcing it — which the record describes as "the only option that manufactures its own
 * undetectability": the corpus under B is full of v3 documents that believe they require
 * things, and nothing says so.
 *
 * Option A's residual, in the record's own numbers: **0 of 562** repo tests noticed a
 * silent v3 drop of the grammar. This file and its identity twin
 * (`packages/domain/test/a4p7-v3-identity-binds-grammar.test.ts`) are the two witnesses.
 * Together they pin the pair the phase actually depends on:
 *
 *     a v3 document's contentHash commits to the grammar  AND  the runtime answers differ.
 *
 * Only the first half would let a document pay identity for an authority it never gets
 * ("declared, hashed, ignored"); only the second half would let enforcement drift without
 * identity noticing. This file is the second half, through the REAL production readers —
 * `compatibilityRequirementsOf` (the Team-scope bridge) and `scopeRequirementInputsOf` +
 * `scopeKeysOf` (the per-scope extraction the gates evaluate) — not a reimplementation.
 *
 * The two fixtures are the SAME v3 document except for the structured declarations, and
 * both state the two authority documents v3 requires (`permissionMutationEnvelope`,
 * `teamHardEnvelope`) so the digit is never the reason a leg fails.
 *
 * @module @dsh-agent-team/runtime/test/a4p7-v3-grammar-enforced
 */

import { describe, expect, it } from 'vitest'

import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import { compatibilityRequirementsOf } from '../compatibility/blueprint.js'
import { scopeKeysOf, scopeRequirementInputsOf } from '../requirements/scope-requirements.js'

// ---------------------------------------------------------------------------
// The v3 WITH/WITHOUT pair (hand-written YAML line arrays: no emitter, no index
// arithmetic — both were measured to fail for EMITTER reasons, Dossier §6.8).
// ---------------------------------------------------------------------------

/** The two authority documents a v3 document must state (no defaults, validate.ts:1334). */
const V3_REQUIRED_ENVELOPES: readonly string[] = [
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
]

/** The flat v1-list requirement BOTH legs declare — the version-agnostic control leg. */
const FLAT_REQUIREMENT: readonly string[] = [
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: false',
]

/** §E.2 TEAM-level structured requirement (the WITH leg only). */
const STRUCTURED_TEAM: readonly string[] = [
  'teamRequirements:',
  '  - requirementId: req-team-1',
  '    type: tool',
  '    subjects: [web]',
  '    complete: true',
]

/** §E.2 LEADER-template structured requirement (the WITH leg only). */
const STRUCTURED_LEADER: readonly string[] = [
  '  requirements:',
  '    - requirementId: req-lead-1',
  '      type: tool',
  '      subjects: [web]',
  '      complete: true',
]

/** §E.2 MEMBER-template structured requirement (the WITH leg only). */
const STRUCTURED_MEMBER: readonly string[] = [
  '    requirements:',
  '      - requirementId: req-worker-1',
  '        type: skill',
  '        subjects: [base]',
  '        complete: true',
]

const v3Source = (structured: boolean): string =>
  [
    '---',
    'schemaVersion: 3',
    'blueprintId: team.v3.grammar.enforcement',
    'revision: "1"',
    ...V3_REQUIRED_ENVELOPES,
    ...(structured ? STRUCTURED_TEAM : []),
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    ...(structured ? STRUCTURED_LEADER : []),
    'members:',
    '  - templateId: worker',
    '    persona: "Worker."',
    ...(structured ? STRUCTURED_MEMBER : []),
    ...FLAT_REQUIREMENT,
    'teamEnvelope:',
    '  allow: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')

const WITH = v3Source(true)
const WITHOUT = v3Source(false)

const withBp = parseBlueprint(WITH) as TeamBlueprint
const withoutBp = parseBlueprint(WITHOUT) as TeamBlueprint

const bridgeOf = (bp: TeamBlueprint): string[] =>
  compatibilityRequirementsOf(bp).map((input) => input.requirementId)
const scopesOf = (bp: TeamBlueprint): string[] => [...scopeKeysOf(scopeRequirementInputsOf(bp))]

describe('§7.3 v3 enforcement: both fixtures are the same document but for the grammar', () => {
  it('both legs are v3 documents that parse', () => {
    expect(withBp.schemaVersion).toBe(3)
    expect(withoutBp.schemaVersion).toBe(3)
  })

  it('both legs share the flat v1-list requirement (the control is present in both)', () => {
    expect(bridgeOf(withoutBp)).toContain('req-tool-web')
    expect(bridgeOf(withBp)).toContain('req-tool-web')
  })

  it('the two legs differ ONLY in identity, which is the grammar (the hash commits)', () => {
    expect(withBp.blueprintId).toBe(withoutBp.blueprintId)
    expect(withBp.contentHash).not.toBe(withoutBp.contentHash)
  })
})

describe('§7.3 v3 enforcement: declaring the grammar CHANGES the runtime answer', () => {
  it('the Team-scope bridge carries the structured team requirement at v3', () => {
    // The exact Option-B signature is a bridge that is IDENTICAL with and without the
    // declaration. Under A the declared requirement is in the bridge, so B's signature
    // cannot recur silently.
    expect(bridgeOf(withBp)).toContain('req-team-1')
    expect(bridgeOf(withoutBp)).not.toContain('req-team-1')
    expect(bridgeOf(withBp)).not.toEqual(bridgeOf(withoutBp))
  })

  it('the structured team requirement is a passthrough, not a re-mapped copy', () => {
    const declared = compatibilityRequirementsOf(withBp).find((i) => i.requirementId === 'req-team-1')
    expect(declared).toBeDefined()
    expect(declared?.type).toBe('tool')
    expect(declared?.subjects).toEqual(['web'])
    expect(declared?.complete).toBe(true)
  })

  it('the template scopes EXIST at v3 only for templates that declare requirements', () => {
    expect(scopesOf(withBp)).toEqual(expect.arrayContaining(['team', 'template:leader', 'template:worker']))
    // The WITHOUT leg has the SAME templates and the SAME flat list, and gets NO
    // template scope: the scope set is driven by the SHAPE (a declaration exists), which
    // is precisely the invariant Option A installed in place of the version digit.
    expect(scopesOf(withoutBp)).toEqual(['team'])
    expect(scopesOf(withBp)).not.toEqual(scopesOf(withoutBp))
  })

  it('the template-scope inputs carry the declared requirement ids', () => {
    const inputs = scopeRequirementInputsOf(withBp)
    expect(inputs.templates['leader']?.map((i) => i.requirementId)).toEqual(['req-lead-1'])
    expect(inputs.templates['worker']?.map((i) => i.requirementId)).toEqual(['req-worker-1'])
    expect(Object.keys(scopeRequirementInputsOf(withoutBp).templates)).toEqual([])
  })

  it('the team scope is the flat list PLUS the structured declarations (no fork, no drop)', () => {
    const inputs = scopeRequirementInputsOf(withBp)
    expect(inputs.team.map((i) => i.requirementId)).toEqual(['req-tool-web', 'req-team-1'])
  })
})

// NOT ASSERTED HERE, ON PURPOSE: the v1 half of the same invariant (a v1 document gets the
// flat bridge and no template scope). Proving it in this file means AUTHORING a new
// pre-v3 Blueprint document literal under `packages/**/test/`, which
// `scripts/verify-blueprint-version-clean.mjs` counts as a `dirty` site and reports as
// `dirty(7 files, 51 sites) -> dirty(8 files, 52 sites)` — a §7.4-tracked number that this
// lane does not own (measured: `git add`ing the draft moved it; evidence
// `dev/agent-workflow/evidence/a4-pr7/7-3-relax/`). The v1 half is owned by
// `blueprint-v1-frozen-resume.test.ts` + `t2-blueprint-v2-hash.test.ts`, and this lane's
// "the relaxation changed nothing for v1" claim is carried by the 52-file pre-flip universe
// run instead. Laundering the literal past the scan (a concatenated `'schemaVersion' + ': 1'`)
// is exactly the mechanism the scan's own `advisory` caveat names, so it is not done here.
