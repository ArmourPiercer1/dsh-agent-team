/**
 * Alpha.6 PR1 — the dormant v5 reviewRouting grammar.
 *
 * The production entry deliberately stays at [3, 4]; these tests call the v5
 * pipeline directly. The one production-entry leg proves the dormancy is real
 * rather than a comment.
 */
import { describe, expect, it } from 'vitest'
import { isTeamContractError } from '../../contracts/src/index.js'
import {
  BLUEPRINT_V5_SCHEMA_VERSION,
  parseBlueprint,
  parseBlueprintV4,
  parseBlueprintV5,
  toHashableBlueprintV5,
  validateBlueprintV5Document,
} from '../blueprint/src/index.js'

const BASE = [
  'schemaVersion: VERSION',
  'blueprintId: team.alpha6',
  'revision: "1"',
  'leader: { templateId: leader, persona: Lead. }',
  'members:',
  '  - templateId: officer',
  '    persona: Review asks.',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'permissionMutationEnvelope: { rules: [] }',
  'teamHardEnvelope: { rules: [] }',
  'metadata: {}',
]

function source(version: number, routing: readonly string[] = []): string {
  return `---\n${BASE.map((line) => line.replace('VERSION', String(version))).concat(routing).join('\n')}\n---\n`
}

const ROUTING = [
  'reviewRouting:',
  '  enabled: true',
  '  officerTemplateId: officer',
  '  ordinaryToolApprovals:',
  '    default: officer',
  '    leaderExceptions:',
  '      - memberTemplateId: officer',
  '        tool: { owner: dsh.shell, name: bash }',
  '  whenOfficerUnavailable: hold',
]

function expectProblems(run: () => unknown, code: string, problemCode: string): void {
  try {
    run()
  } catch (error) {
    if (!isTeamContractError(error)) throw new Error(`expected TeamContractError, got ${String(error)}`)
    expect(error.code).toBe(code)
    const problems = (error.details as { problems?: { code?: string }[] } | undefined)?.problems ?? []
    expect(problems.map((problem) => problem.code)).toContain(problemCode)
    return
  }
  throw new Error('expected a refusal, got a document')
}

describe('v5 reviewRouting grammar', () => {
  it('parses a legal block and binds it into the content hash', () => {
    const parsed = parseBlueprintV5(source(BLUEPRINT_V5_SCHEMA_VERSION, ROUTING))
    expect(parsed.schemaVersion).toBe(5)
    expect(parsed.reviewRouting).toEqual({
      enabled: true,
      officerTemplateId: 'officer',
      ordinaryToolApprovals: {
        default: 'officer',
        leaderExceptions: [{ memberTemplateId: 'officer', tool: { owner: 'dsh.shell', name: 'bash' } }],
      },
      whenOfficerUnavailable: 'hold',
    })
    const withoutRouting = parseBlueprintV5(source(BLUEPRINT_V5_SCHEMA_VERSION))
    expect(parsed.contentHash).not.toBe(withoutRouting.contentHash)
    const hashable = toHashableBlueprintV5(parsed)
    expect(hashable).toHaveProperty('reviewRouting')
  })

  it('a v5 document with no reviewRouting keeps the field absent from the hashable projection', () => {
    const parsed = parseBlueprintV5(source(BLUEPRINT_V5_SCHEMA_VERSION))
    expect(parsed.reviewRouting).toBeUndefined()
    expect(toHashableBlueprintV5(parsed)).not.toHaveProperty('reviewRouting')
  })

  it('v3 and v4 canaries are untouched by the dormant v5 parser (zero movement)', () => {
    const v3 = parseBlueprint(source(3))
    const v4 = parseBlueprintV4(source(4))
    expect(v3.schemaVersion).toBe(3)
    expect(v4.schemaVersion).toBe(4)
    // Production still refuses v5: the dormant parser cannot widen the run set.
    expect(() => parseBlueprint(source(BLUEPRINT_V5_SCHEMA_VERSION, ROUTING))).toThrow()
  })

  it('refuses an Officer that names the LeaderTemplate', () => {
    const routing = ROUTING.map((line) => line.replace('officerTemplateId: officer', 'officerTemplateId: leader'))
    expectProblems(() => parseBlueprintV5(source(5, routing)), 'MALFORMED_DTO', 'officer-not-member')
  })

  it('refuses an Officer that names no MemberTemplate', () => {
    const routing = ROUTING.map((line) => line.replace('officerTemplateId: officer', 'officerTemplateId: ghost'))
    expectProblems(() => parseBlueprintV5(source(5, routing)), 'MALFORMED_DTO', 'member-template-not-found')
  })

  it('refuses an implicit/disabled block and a non-officer default', () => {
    expectProblems(
      () => parseBlueprintV5(source(5, ROUTING.map((line) => line.replace('enabled: true', 'enabled: false')))),
      'MALFORMED_DTO',
      'review-routing-disabled',
    )
    expectProblems(
      () => parseBlueprintV5(source(5, ROUTING.map((line) => line.replace('default: officer', 'default: leader')))),
      'MALFORMED_DTO',
      'invalid-ordinary-default',
    )
  })

  it('refuses duplicate Leader exceptions for the same template × tool', () => {
    const routing = [
      ...ROUTING.slice(0, -1),
      '      - memberTemplateId: officer',
      '        tool: { owner: dsh.shell, name: bash }',
      '  whenOfficerUnavailable: hold',
    ]
    expectProblems(() => parseBlueprintV5(source(5, routing)), 'MALFORMED_DTO', 'duplicate-leader-exception')
  })

  it('refuses unknown fields and an illegal unavailable policy', () => {
    expectProblems(
      () => parseBlueprintV5(source(5, [...ROUTING, '  surprise: true'])),
      'MALFORMED_DTO',
      'unknown-field',
    )
    expectProblems(
      () => parseBlueprintV5(source(5, ROUTING.map((line) => line.replace('whenOfficerUnavailable: hold', 'whenOfficerUnavailable: crash')))),
      'MALFORMED_DTO',
      'invalid-when-officer-unavailable',
    )
  })

  it('direct validation refuses a non-v5 stamp rather than silently restamping', () => {
    expect(() => validateBlueprintV5Document({ schemaVersion: 4 })).toThrow()
  })
})
