/**
 * P-BP — Blueprint Template × Tool routing feasibility probe (PR #536 §4).
 *
 * Proves, executably:
 *  A. the v3 and v4 canaries still parse and hash to their pinned constants;
 *  B. the CURRENT production grammar refuses a `reviewRouting` family
 *     (`unknown-field` at `$.reviewRouting`) — the additive schema decision is
 *     real, not hypothetical;
 *  C. a MINIMAL additive face, validated outside the frozen grammar, resolves
 *     a deterministic Template × Tool route over the SAME frozen blueprint:
 *     same-template instances agree, exceptions are per-template, the default
 *     is Officer, and instance selectors refuse;
 *  D. adding the family to the hashable projection moves the content hash —
 *     therefore old v3/v4 hashes stay stable only across a version boundary.
 */
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { isTeamContractError } from '../../../../../packages/contracts/src/index.js'
import {
  deriveContentHash,
  parseBlueprint,
  toHashableBlueprintV4,
} from '../../../../../packages/domain/blueprint/src/index.js'
import {
  RoutingRefusal,
  buildRouteTable,
  parseReviewRouting,
  routeFor,
} from './review-routing.mjs'

const V3_HASH = 'sha256:e71c46296ce5847042c74b6e3ba4e37f7393ab544491f340abbc3a6230eb0cdd'
const V4_HASH = 'sha256:0c6c1ceeee82ae61bff10980ba11c89eacf2787277537af1f1bb128537172a4b'

const V3_SOURCE = [
  '---',
  'schemaVersion: 3',
  'blueprintId: team.rebase-canary',
  'revision: "1"',
  'leader: { templateId: leader, persona: Lead. }',
  'members: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'permissionMutationEnvelope: { rules: [] }',
  'teamHardEnvelope: { rules: [] }',
  'metadata: {}',
  '---',
].join('\n')
const V4_SOURCE = V3_SOURCE.replace('schemaVersion: 3', 'schemaVersion: 4')

const CORE_LINES = [
  '---',
  'schemaVersion: 4',
  'blueprintId: team.rebase',
  'revision: "1"',
  'leader: { templateId: leader, persona: Lead. }',
  'members:',
  '  - templateId: approval-officer',
  '    displayName: Officer',
  '    persona: Officer.',
  '  - templateId: researcher',
  '    displayName: Researcher',
  '    persona: Researcher.',
  '  - templateId: analyst',
  '    displayName: Analyst',
  '    persona: Analyst.',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'permissionMutationEnvelope: { rules: [] }',
  'teamHardEnvelope: { rules: [] }',
  'metadata: {}',
]
const CORE_SOURCE = [...CORE_LINES, '---'].join('\n')

const ROUTING_SOURCE = [
  'reviewRouting:',
  '  enabled: true',
  '  officerTemplateId: approval-officer',
  '  ordinaryToolApprovals:',
  '    default: officer',
  '    leaderExceptions:',
  '      - memberTemplateId: researcher',
  '        tool: { owner: dsh.shell, name: bash }',
  '      - memberTemplateId: analyst',
  '        tool: { owner: dsh.fs, name: write }',
  '  whenOfficerUnavailable: hold',
].join('\n')

const CANDIDATE_SOURCE = [...CORE_LINES, ...ROUTING_SOURCE.split('\n'), '---'].join('\n')

function refusalOf(fn: () => unknown): RoutingRefusal {
  try {
    fn()
  } catch (err) {
    if (err instanceof RoutingRefusal) return err
    throw new Error(`expected a RoutingRefusal, got ${String(err)}`)
  }
  throw new Error('expected a refusal, but the call succeeded')
}

describe('P-BP/A — the frozen v3/v4 canaries do not move', () => {
  it('v3 hashes to the pinned constant', () => {
    expect((parseBlueprint(V3_SOURCE) as { contentHash: string }).contentHash).toBe(V3_HASH)
  })
  it('v4 hashes to the pinned constant', () => {
    expect((parseBlueprint(V4_SOURCE) as { contentHash: string }).contentHash).toBe(V4_HASH)
  })
  it('the core v4 document is accepted and frozen', () => {
    const core = parseBlueprint(CORE_SOURCE) as { members: Array<{ templateId: string }>; contentHash: string }
    expect(core.members.map((m) => m.templateId)).toEqual(['approval-officer', 'researcher', 'analyst'])
    expect(core.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
})

describe('P-BP/B — the current grammar refuses the family (the additive decision is real)', () => {
  it('v4 + reviewRouting -> unknown-field at $.reviewRouting', () => {
    let threw: unknown
    try {
      parseBlueprint(CANDIDATE_SOURCE)
    } catch (err) {
      threw = err
    }
    expect(isTeamContractError(threw)).toBe(true)
    // The refusal lands in the core document normalizer rather than the v4
    // grammar's own closed-key pass: `MALFORMED_DTO` + `unknownFields`. The
    // product fact is the same — the family is refused by the CURRENT entry.
    const error = threw as { code?: string; details?: { unknownFields?: string[] } }
    expect(error.code).toBe('MALFORMED_DTO')
    expect(error.details?.unknownFields).toContain('reviewRouting')
  })
})

describe('P-BP/C — an additive face over the same frozen blueprint resolves deterministically', () => {
  const core = parseBlueprint(CORE_SOURCE) as never
  const routingYaml = parseYaml(ROUTING_SOURCE) as { reviewRouting: unknown }
  const routing = parseReviewRouting(routingYaml.reviewRouting)
  const table = buildRouteTable(core, routing)
  const route = (templateId: string, owner: string, name: string) =>
    routeFor(core, routing, table, { templateId, tool: { owner, name } })

  it('same Template × Tool agrees for every instance of that template (no instance input exists)', () => {
    const instancesOfResearcher = ['inst-researcher-a', 'inst-researcher-b']
    const routes = instancesOfResearcher.map(() => route('researcher', 'dsh.shell', 'bash'))
    expect(routes[0]).toEqual(routes[1])
    expect(routes[0]).toMatchObject({ kind: 'recipient', target: 'leader', reason: 'blueprint-leader-exception' })
  })

  it('the exception is per-template: analyst × bash stays Officer, researcher × fs.write stays Officer', () => {
    expect(route('analyst', 'dsh.shell', 'bash').target).toBe('officer')
    expect(route('researcher', 'dsh.fs', 'write').target).toBe('officer')
  })

  it('an explicit exception is honored only at its exact owner/name coordinate', () => {
    expect(route('analyst', 'dsh.fs', 'write').target).toBe('leader')
    expect(route('analyst', 'dsh.fs', 'write-other').target).toBe('officer')
  })

  it('the unconfigured majority defaults to Officer', () => {
    expect(route('analyst', 'dsh.web', 'search')).toMatchObject({
      kind: 'recipient',
      target: 'officer',
      reason: 'blueprint-default-officer',
    })
  })

  it('P0: the Officer own ask routes to the Leader, never back to the Officer (no self-wait cycle)', () => {
    expect(route('approval-officer', 'dsh.web', 'search')).toMatchObject({
      kind: 'recipient',
      target: 'leader',
      reason: 'officer-self-ask',
    })
    // Even a tool that has no exception: the self-ask rule is independent of
    // the authoring table. Same-template instances are all the Officer.
    expect(route('approval-officer', 'dsh.shell', 'bash').reason).toBe('officer-self-ask')
  })

  it('instanceId / label selectors are refused (Template-only authoring face)', () => {
    const withInstance = parseYaml(
      [
        'reviewRouting:',
        '  enabled: true',
        '  officerTemplateId: approval-officer',
        '  ordinaryToolApprovals:',
        '    default: officer',
        '    leaderExceptions:',
        '      - memberTemplateId: researcher',
        '        instanceId: inst-researcher-a',
        '        tool: { owner: dsh.shell, name: bash }',
      ].join('\n'),
    ) as { reviewRouting: unknown }
    expect(refusalOf(() => parseReviewRouting(withInstance.reviewRouting)).code).toBe('reviewRouting/instance-selector')

    const withLabel = parseYaml(
      [
        'reviewRouting:',
        '  enabled: true',
        '  officerTemplateId: approval-officer',
        '  ordinaryToolApprovals:',
        '    default: officer',
        '    leaderExceptions:',
        '      - memberTemplateId: researcher',
        '        label: the-fast-one',
        '        tool: { owner: dsh.shell, name: bash }',
      ].join('\n'),
    ) as { reviewRouting: unknown }
    expect(refusalOf(() => parseReviewRouting(withLabel.reviewRouting)).code).toBe('reviewRouting/instance-selector')
  })

  it('closed-set refusals: bad default, bad unavailable policy, unknown template, missing tool coordinate', () => {
    const badDefault = parseYaml(
      'reviewRouting:\n  enabled: true\n  officerTemplateId: approval-officer\n  ordinaryToolApprovals:\n    default: leader\n',
    ) as { reviewRouting: unknown }
    expect(refusalOf(() => parseReviewRouting(badDefault.reviewRouting)).code).toBe('reviewRouting/default')

    const badUnavailable = parseYaml(
      'reviewRouting:\n  enabled: true\n  officerTemplateId: approval-officer\n  ordinaryToolApprovals:\n    default: officer\n  whenOfficerUnavailable: auto\n',
    ) as { reviewRouting: unknown }
    expect(refusalOf(() => parseReviewRouting(badUnavailable.reviewRouting)).code).toBe('reviewRouting/unavailable-policy')

    const unknownTemplate = parseYaml(
      'reviewRouting:\n  enabled: true\n  officerTemplateId: ghost\n  ordinaryToolApprovals:\n    default: officer\n',
    ) as { reviewRouting: unknown }
    const parsedUnknown = parseReviewRouting(unknownTemplate.reviewRouting)
    expect(refusalOf(() => buildRouteTable(core, parsedUnknown)).code).toBe('reviewRouting/unknown-officer-template')

    const leaderAsOfficer = parseYaml(
      'reviewRouting:\n  enabled: true\n  officerTemplateId: leader\n  ordinaryToolApprovals:\n    default: officer\n',
    ) as { reviewRouting: unknown }
    const parsedLeader = parseReviewRouting(leaderAsOfficer.reviewRouting)
    expect(refusalOf(() => buildRouteTable(core, parsedLeader)).code).toBe('reviewRouting/officer-not-member')

    const missingName = parseYaml(
      'reviewRouting:\n  enabled: true\n  officerTemplateId: approval-officer\n  ordinaryToolApprovals:\n    default: officer\n    leaderExceptions:\n      - memberTemplateId: researcher\n        tool: { owner: dsh.shell }\n',
    ) as { reviewRouting: unknown }
    expect(refusalOf(() => parseReviewRouting(missingName.reviewRouting)).code).toBe('reviewRouting/exception-tool')
  })
})

describe('P-BP/D — the family must move the hash, so the version boundary is load-bearing', () => {
  it('the candidate hash differs from the v4 core hash; the core hash itself is unchanged', () => {
    const core = parseBlueprint(CORE_SOURCE) as never
    const routingYaml = parseYaml(ROUTING_SOURCE) as { reviewRouting: unknown }
    const routing = parseReviewRouting(routingYaml.reviewRouting)
    const withFamily = deriveContentHash({
      ...(toHashableBlueprintV4(core) as Record<string, unknown>),
      reviewRouting: routing,
    })
    expect(withFamily).not.toBe((core as { contentHash: string }).contentHash)
    expect((parseBlueprint(CORE_SOURCE) as { contentHash: string }).contentHash).toBe(
      (core as { contentHash: string }).contentHash,
    )
  })
})
