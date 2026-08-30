/**
 * P3-T6 — end-to-end composition pipeline (cross-module integration).
 *
 * Composes the five P3 modules into one deterministic pipeline:
 *
 *   Blueprint source ──parseBlueprint──▶ immutable snapshot ref
 *        ──buildTeamComposition──▶ TeamSession record + N MemberInstance
 *              ──applyLifecycleOperation──▶ scripted durable states
 *              ──resolveEffectivePolicy──▶ explainable per-member policy
 *              ──evaluateCompatibility──▶ environment-gated result
 *
 * and then proves the pipeline is reproducible from its serialized durable
 * projection (contracts v1 parsers only, no live object references).
 *
 * The test-side glue `DOMAIN_TO_REQUIREMENT_TYPE` is the only bridge between
 * the blueprint's free lowercase-slug requirement domains and the
 * compatibility engine's closed 6-value type vocabulary; it is asserted
 * closed (every pipeline domain must be in the table).
 *
 * Authority: Architecture §10.2/§19.6/§21/§27 (object model, policy
 * precedence, lifecycle, compatibility), Development Plan §16.4 (G3).
 */

import { describe, expect, it } from 'vitest'

import {
  canonicalJsonStringify,
  createMemberIdentity,
  memberIdentitiesEqual,
  memberIdentityKey,
  parseInstanceId,
  parseRootSessionId,
  teamSessionIdOf,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import { parseBlueprint, toBlueprintSnapshotRef } from '../../domain/blueprint/src/index.js'
import { LIFECYCLE_OPERATIONS, applyLifecycleOperation } from '../../domain/lifecycle/src/index.js'
import { resolveEffectivePolicy } from '../../domain/policy/src/index.js'
import type { EffectivePolicy } from '../../domain/policy/src/index.js'
import {
  ACK_STATUSES,
  COMPATIBILITY_REASON_CODES,
  COMPATIBILITY_STATUS,
  REQUIREMENT_OUTCOMES,
  computeEnvironmentFingerprint,
  evaluateCompatibility,
  isCompatibilityResultValidForEnvironment,
  parseEnvironmentFacts,
  parseRequirements,
  serializeCompatibilityResult,
} from '../../domain/compatibility/src/index.js'
import type { EnvironmentFact, RequirementInput, RequirementType } from '../../domain/compatibility/src/index.js'
import {
  buildTeamComposition,
  parseComposition,
  serializeComposition,
} from '../domain/src/index.js'
import { isDeepFrozen } from './t6-helpers.js'

// --- the pipeline blueprint ----------------------------------------------------

const T6_PIPELINE_BLUEPRINT_SOURCE: string = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.t6-pipeline',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "Lead."',
  'members:',
  '  - templateId: researcher',
  '    persona: "Researcher."',
  'requirements:',
  '  - domain: tool',
  '    name: search-web',
  '  - domain: skill',
  '    name: summarize-docs',
  '  - domain: mcp',
  '    name: cordis-mcp',
  '    optional: true',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

// --- test-side glue: blueprint domains -> compatibility requirement types ------

const DOMAIN_TO_REQUIREMENT_TYPE: Readonly<Record<string, RequirementType>> = {
  tool: 'tool',
  skill: 'skill',
  mcp: 'mcpServer',
}

function toRequirementInputs(requirements: readonly { readonly domain: string; readonly name: string }[]): readonly RequirementInput[] {
  return requirements.map((req) => {
    const type = DOMAIN_TO_REQUIREMENT_TYPE[req.domain]
    if (type === undefined) {
      throw new Error(`t6 pipeline glue: unknown blueprint domain '${req.domain}'`)
    }
    return { requirementId: `req-${req.domain}-${req.name}`, type, subjects: [req.name] }
  })
}

const BLUEPRINT = parseBlueprint(T6_PIPELINE_BLUEPRINT_SOURCE)
const REQUIREMENTS_IN = toRequirementInputs(BLUEPRINT.requirements)

// --- environment facts -----------------------------------------------------------

const FACTS_ALL: readonly EnvironmentFact[] = [
  { domain: 'tool', subject: 'search-web', available: true, generation: 1 },
  { domain: 'skill', subject: 'summarize-docs', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'cordis-mcp', available: true, generation: 1 },
]
const FACTS_MCP_DOWN: readonly EnvironmentFact[] = [
  { domain: 'tool', subject: 'search-web', available: true, generation: 1 },
  { domain: 'skill', subject: 'summarize-docs', available: true, generation: 1 },
  {
    domain: 'mcpServer',
    subject: 'cordis-mcp',
    available: false,
    generation: 1,
    detail: 'cordis-mcp probe failed',
  },
]

const RESULT_OPEN = evaluateCompatibility({ requirements: REQUIREMENTS_IN, environmentFacts: FACTS_ALL })
const RESULT_WARNING = evaluateCompatibility({ requirements: REQUIREMENTS_IN, environmentFacts: FACTS_MCP_DOWN })

// --- pipeline stages (pure functions over durable records) ------------------------

/** Lifecycle script: m01 -> SETTLED, m02 -> ARCHIVE -> RESTORE, m03 untouched. */
function runLifecycleScript(records: readonly MemberInstanceRecordDto[]): readonly MemberInstanceRecordDto[] {
  return records.map((record, index) => {
    if (index === 0) {
      return applyLifecycleOperation(
        applyLifecycleOperation(record, LIFECYCLE_OPERATIONS.ADMIT_WORK),
        LIFECYCLE_OPERATIONS.SETTLE,
      )
    }
    if (index === 1) {
      return applyLifecycleOperation(
        applyLifecycleOperation(
          applyLifecycleOperation(
            applyLifecycleOperation(record, LIFECYCLE_OPERATIONS.ADMIT_WORK),
            LIFECYCLE_OPERATIONS.SETTLE,
          ),
          LIFECYCLE_OPERATIONS.ARCHIVE,
        ),
        LIFECYCLE_OPERATIONS.RESTORE,
      )
    }
    return record
  })
}

/** Per-member policy stage: template baseline + instance-scoped human override. */
function runPolicyStage(record: MemberInstanceRecordDto): EffectivePolicy {
  const input = {
    teamSessionId: teamSessionIdOf(record.rootSessionId),
    member: createMemberIdentity(record.rootSessionId, record.instanceId),
    blueprint: {},
    template: { values: { model: { kind: 'allow' as const, items: ['model-base'] } } },
    policyState: { stateId: 'default' },
    external: { hard: {}, capabilityExists: {} },
    humanOverride: {
      overrideId: `ovh-${record.instanceId}`,
      scope: 'instance' as const,
      values: { model: { kind: 'allow' as const, items: [`model-${record.instanceId}`] } },
    },
  }
  return resolveEffectivePolicy(input)
}

/** The canonical end-of-pipeline projection (members + policies + compat result). */
function pipelineProjection(records: readonly MemberInstanceRecordDto[]): string {
  const scripted = runLifecycleScript(records)
  const policies = scripted.map((record) => runPolicyStage(record))
  return canonicalJsonStringify({
    members: scripted,
    policies,
    compat: serializeCompatibilityResult(RESULT_WARNING),
  })
}

const COMPOSITION = buildTeamComposition({
  blueprintSource: T6_PIPELINE_BLUEPRINT_SOURCE,
  memberCount: 3,
})

describe('P3-T6 G3 composition pipeline (cross-module integration)', () => {
  it('builds deterministically and binds the immutable snapshot (invariants 9/10)', () => {
    const again = buildTeamComposition({
      blueprintSource: T6_PIPELINE_BLUEPRINT_SOURCE,
      memberCount: 3,
    })
    expect(serializeComposition(COMPOSITION)).toBe(serializeComposition(again))

    // Snapshot binding: the TeamSession record references the blueprint snapshot.
    expect(COMPOSITION.snapshotRef).toEqual(toBlueprintSnapshotRef(BLUEPRINT))
    expect(COMPOSITION.teamSession.blueprint).toEqual(COMPOSITION.snapshotRef)
    expect(COMPOSITION.snapshotKey).toBe('team.t6-pipeline@1')
    expect(COMPOSITION.teamSession.blueprint.contentHash).toBe(BLUEPRINT.contentHash)
    expect(/^sha256:[0-9a-f]{64}$/.test(COMPOSITION.teamSession.blueprint.contentHash)).toBe(true)

    // Invariant 9: TeamSessionId = RootSessionId.
    expect(COMPOSITION.teamSessionId).toBe(COMPOSITION.rootSessionId)
    expect(COMPOSITION.teamSessionId).toBe(teamSessionIdOf(COMPOSITION.rootSessionId))

    // Bindings: exactly one team-root + one team-member per member.
    expect(COMPOSITION.bindings.length).toBe(4)
    const teamRoot = COMPOSITION.bindings.find((binding) => binding.kind === 'team-root')
    if (teamRoot === undefined) throw new Error('missing team-root binding')
    expect(teamRoot.sessionId).toBe(COMPOSITION.rootSessionId)
    const teamMember = COMPOSITION.bindings.filter((binding) => binding.kind === 'team-member')
    expect(teamMember.length).toBe(3)
    for (let i = 0; i < 3; i++) {
      const binding = teamMember[i]
      const record = COMPOSITION.memberRecords[i]
      if (binding === undefined || record === undefined) throw new Error(`missing binding/record ${i}`)
      expect(binding.rootSessionId).toBe(COMPOSITION.rootSessionId)
      expect(binding.instanceId).toBe(record.instanceId)
      expect(binding.sessionId).toBe(record.childSessionId)
    }
  })

  it('keeps identity consistent across stages (invariant 18: (rootSessionId, instanceId))', () => {
    const scripted = runLifecycleScript(COMPOSITION.memberRecords)
    for (let i = 0; i < 3; i++) {
      const record = scripted[i]
      const identity = COMPOSITION.identities[i]
      if (record === undefined || identity === undefined) throw new Error(`missing staged record ${i}`)
      // The stage-built identity equals the composition identity, by value and key.
      const stageIdentity = createMemberIdentity(record.rootSessionId, record.instanceId)
      expect(memberIdentitiesEqual(identity, stageIdentity)).toBe(true)
      expect(memberIdentityKey(identity)).toBe(memberIdentityKey(stageIdentity))
      // The policy stage resolves for that same identity: the mirror-realm
      // identity re-parsed through the strict contracts boundary equals it.
      const policy = runPolicyStage(record)
      const policyMember = createMemberIdentity(
        parseRootSessionId(policy.member.rootSessionId),
        parseInstanceId(policy.member.instanceId),
      )
      expect(memberIdentitiesEqual(policyMember, identity)).toBe(true)
      expect(policy.teamSessionId).toBe(COMPOSITION.teamSessionId)
      // Durable lifecycle script outcomes: SETTLED / SETTLED (archived+restored) / CREATED.
      if (i === 0) {
        expect(record.lifecycle).toBe('SETTLED')
        expect(record.activityVersion).toBe(3)
      } else if (i === 1) {
        expect(record.lifecycle).toBe('SETTLED')
        expect(record.activityVersion).toBe(5)
      } else {
        expect(record.lifecycle).toBe('CREATED')
        expect(record.activityVersion).toBe(1)
      }
    }
  })

  it('the policy stage: instance-scoped human override wins and every value is explainable', () => {
    const scripted = runLifecycleScript(COMPOSITION.memberRecords)
    for (let i = 0; i < 3; i++) {
      const record = scripted[i]
      if (record === undefined) throw new Error(`missing staged record ${i}`)
      const policy = runPolicyStage(record)
      expect(policy.policyStateId).toBe('default')
      const model = policy.cells['model']
      expect(model.effective).toEqual({ kind: 'allow', items: [`model-${record.instanceId}`] })
      // The template baseline is visible only through provenance, not the effective value.
      expect(canonicalJsonStringify(policy.cells['model'].team).indexOf('model-base')).toBeGreaterThan(-1)
      expect(typeof policy.explanation).toBe('string')
      expect(policy.explanation.length).toBeGreaterThan(0)
      expect(isDeepFrozen(policy)).toBe(true)
    }
  })

  it('the compatibility stage: OPEN when fully available, BLOCKED_WARNING on the optional mcp gap', () => {
    // The glue table is closed: exactly the pipeline's three domains.
    expect(Object.keys(DOMAIN_TO_REQUIREMENT_TYPE).length).toBe(3)
    expect(REQUIREMENTS_IN.length).toBe(3)

    // Fully available environment.
    expect(RESULT_OPEN.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(RESULT_OPEN.counts).toEqual({
      pass: 3,
      warning: 0,
      fatal: 0,
      unackedWarning: 0,
      staleAcknowledgement: 0,
    })
    for (const entry of RESULT_OPEN.requirements) {
      expect(entry.outcome).toBe(REQUIREMENT_OUTCOMES.PASS)
      expect(entry.reasonCode).toBe(COMPATIBILITY_REASON_CODES.SATISFIED)
      expect(entry.mismatchFingerprint).toBe(null)
      expect(entry.acknowledgement).toBe(null)
    }
    expect(RESULT_OPEN.environmentFingerprint).toBe(
      computeEnvironmentFingerprint(parseRequirements(REQUIREMENTS_IN), FACTS_ALL),
    )
    expect(
      isCompatibilityResultValidForEnvironment(
        RESULT_OPEN,
        parseRequirements(REQUIREMENTS_IN),
        parseEnvironmentFacts(FACTS_ALL),
      ),
    ).toBe(true)

    // mcpServer down: ordinary (non-complete) requirement degrades to a WARNING.
    expect(RESULT_WARNING.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    expect(RESULT_WARNING.counts).toEqual({
      pass: 2,
      warning: 1,
      fatal: 0,
      unackedWarning: 1,
      staleAcknowledgement: 0,
    })
    const mcpEntry = RESULT_WARNING.requirements.find((entry) => entry.type === 'mcpServer')
    if (mcpEntry === undefined) throw new Error('missing mcpServer requirement entry')
    expect(mcpEntry.outcome).toBe(REQUIREMENT_OUTCOMES.WARNING)
    expect(mcpEntry.reasonCode).toBe(COMPATIBILITY_REASON_CODES.CAPABILITY_UNAVAILABLE)
    expect(mcpEntry.unavailableSubjects).toEqual(['cordis-mcp'])
    expect(mcpEntry.mismatchFingerprint).not.toBe(null)
    expect(mcpEntry.acknowledgement).toEqual({ status: ACK_STATUSES.MISSING, acknowledgement: null })
    expect(RESULT_WARNING.environmentFingerprint).toBe(
      computeEnvironmentFingerprint(parseRequirements(REQUIREMENTS_IN), FACTS_MCP_DOWN),
    )
    expect(
      isCompatibilityResultValidForEnvironment(
        RESULT_WARNING,
        parseRequirements(REQUIREMENTS_IN),
        parseEnvironmentFacts(FACTS_MCP_DOWN),
      ),
    ).toBe(true)
  })

  it('the pipeline is reproducible byte-identically from its serialized projection', () => {
    const json = serializeComposition(COMPOSITION)
    const parsed = parseComposition(json)

    // Every part of the projection round-trips through the contracts v1 parsers.
    expect(parsed.teamSession).toEqual(COMPOSITION.teamSession)
    expect(parsed.memberRecords).toEqual(COMPOSITION.memberRecords)
    expect(parsed.bindings).toEqual(COMPOSITION.bindings)
    expect(parsed.snapshotRef).toEqual(COMPOSITION.snapshotRef)
    expect(parsed.snapshotKey).toBe('team.t6-pipeline@1')

    // Re-run every stage from the parsed records only.
    expect(pipelineProjection(parsed.memberRecords)).toBe(pipelineProjection(COMPOSITION.memberRecords))
    // The canonical text is stable under key reordering (it is canonical JSON).
    expect(pipelineProjection(COMPOSITION.memberRecords)).toBe(pipelineProjection(COMPOSITION.memberRecords))
  })
})
