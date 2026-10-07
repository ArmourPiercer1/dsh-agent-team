/**
 * pre-alpha3 W3-C (review fix F8, guide §7) — the Leader's REAL request
 * boundary is gated on the Leader template scope, not just the Team scope.
 *
 * WHAT THIS PROVES (guide §7.3, cases 1–5):
 *
 * The production root's Root initial-work closure binds the Leader's
 * normal model request to the Team scope + the Leader template scope
 * (when the leader template declares v2 requirements). The scope
 * evaluator already produces a `template:<leaderTemplateId>` scope for a
 * v2 leader with requirements (W3-A); what was missing was the BINDING —
 * the impact referenced only the Team scope, so a blocked leader template
 * scope did NOT gate the Leader's normal turn.
 *
 *   case 1 — a Leader REQUIRED requirement down (leader template scope
 *     BLOCKED) → the Leader's normal turn is BLOCKED (typed
 *     COMPATIBILITY_BLOCKED) and the block carries `recoveryDispatchAvailable`
 *     (the "Recovery turn available" — the server-derived recovery mode;
 *     NO wire change: the mode is never a client field).
 *   case 2 — a Leader OPTIONAL requirement down (scope DEGRADED) → the
 *     normal turn CONTINUES (auto-degraded — the old WARNING throw is gone).
 *   case 3 — recovery-mid-recovery: the current turn stays Recovery (the
 *     scope is still blocked) and the NEXT turn is Normal (the fresh
 *     evaluation recovers — the §E.10 exit record). See
 *     `leader-recovery-next-boundary-exit.test.ts` for the exit arc.
 *   case 4 — an UNRELATED member template requirement down (the worker
 *     scope BLOCKED) → does NOT block the Leader (the worker scope is not
 *     in the Leader boundary refs — it is never referenced).
 *   case 5 — a Team-level REQUIRED requirement down (team scope BLOCKED)
 *     → the Leader's normal turn is BLOCKED.
 *
 * The gate is consulted DIRECTLY (`enforceRequirementGate` — the
 * authoritative gate) with the closure's identical refs
 * (`leaderTemplateScopeRefs(world.blueprint)`), and the WIRING itself is
 * unit-pinned (`leaderTemplateScopeRefs` — the v2 leader-requirements
 * binding + the v1 / no-requirements fallback).
 *
 * @module test/leader-template-required-boundary
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  enforceRequirementGate,
  TEAM_RUNTIME_ERROR_CODES,
} from '../admission/index.js'
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import {
  createRuntimeRequirementFactsProvider,
  requirementFactScopeRoleOf,
  type RequirementFactsPorts,
} from '../requirement-facts/index.js'
import {
  normalWorkImpact,
  recoveryWorkImpact,
  REQUIREMENT_LEVELS,
  scopeRequirementInputsOf,
} from '../requirements/index.js'
import type { RequirementScope } from '../requirements/index.js'
import { scopeKey } from '../requirements/types.js'
import { PROBE_VERDICTS, type CapabilityReadinessProvider, type ProbeVerdict } from '../readiness/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { createP6T2World, P6T2_NOW, P6T2_ROOT } from './p6t2-helpers.js'
import { leaderTemplateScopeRefs } from '../action-router/root-initial-work.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'

/**
 * The version this fixture's document declares is the SUBJECT of the file, not
 * a formality, so §7.4 (lane B-runtime-semantics-A) leaves it at 2 and gives it
 * a home here instead of in the fence's sight: production compiles the
 * requirement scopes this document declares only when the document declares
 * version 2 — five sites compare the declared version against 2
 * (requirements/scope-requirements.ts:108, requirements/creation-preflight.ts:217,
 * admission/requirement-gate.ts:460, compatibility/blueprint.ts:81,
 * activation/provider.ts:821). Raising the digit therefore does not upgrade the
 * fixture, it deletes the surface the fixture observes: the trial promotion to the supported version reddened 3 of its 7 tests (all 7 green at base) — the ones that observe the leader template's requirement scope. 
 * dev/agent-workflow/evidence/a4-pr7/7-4-b2a/trial-v2/. The YAML bytes this file
 * emits are byte-for-byte what they were; only the carrier moved. And the
 * carrier is typed, so when §7.3 narrows TeamBlueprint['schemaVersion'] to the
 * surviving version this line stops compiling and names THIS FILE — which is the
 * loud failure §7.4 exists to arrange, in place of a document that would
 * otherwise become a silent parse refusal.
 */
const DECLARED_DOCUMENT_VERSION: TeamBlueprint['schemaVersion'] = 2
/**
 * The W3-C fixture blueprint (schema v2): a LEADER template with a REQUIRED
 * `tool/pdf` + an OPTIONAL `tool/web` requirement; a WORKER template with a
 * REQUIRED (unrelated) `mcpServer/unrelated` requirement; and a TEAM-level
 * REQUIRED `skill/base` requirement. The leader templateId is `leader`,
 * the worker's is `worker` (the P6-T2 seed ids — the seeded members resolve
 * against them).
 */
const W3C_BLUEPRINT_SOURCE = [
  '---',
  `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
  'blueprintId: W3C-LEADER-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the W3C team.',
  '  requirements:',
  '    - requirementId: req-leader-pdf',
  '      type: tool',
  '      subjects: [pdf]',
  '      complete: true',
  '    - requirementId: req-leader-web',
  '      type: tool',
  '      subjects: [web]',
  '      complete: false',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the W3C work.',
  '    requirements:',
  '      - requirementId: req-worker-mcp',
  '        type: mcpServer',
  '        subjects: [unrelated]',
  '        complete: true',
  'teamRequirements:',
  '  - requirementId: req-team-core',
  '    type: skill',
  '    subjects: [base]',
  '    complete: true',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The W3C default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
].join('\n')

/** A mutable (type, subject) → verdict readiness table (the live probe). */
function mutableReadiness(initial: Record<string, ProbeVerdict>): {
  readonly provider: CapabilityReadinessProvider
  readonly set: (key: string, verdict: ProbeVerdict) => void
} {
  const table = { ...initial }
  return {
    provider: {
      probe: async (type, name) => ({
        capabilityType: type,
        capabilityName: name,
        verdict: table[`${type}\u0000${name}`] ?? PROBE_VERDICTS.unknown,
        source: 'test-live-probe',
        observedAt: P6T2_NOW,
      }),
    },
    set: (key, verdict) => {
      table[key] = verdict
    },
  }
}

/** The live provider over a (toggleable) readiness table. */
function livePorts(readiness: CapabilityReadinessProvider): RequirementFactsPorts {
  const plan = {
    root: {
      presetId: 'standard',
      persona: { kind: 'standard' as const, source: 'effective-composition' as const },
    },
    member: {
      presetId: 'standard',
      persona: { kind: 'standard' as const, source: 'effective-composition' as const },
    },
  }
  return {
    configuredMcpServers: [],
    readiness,
    substratePlan: async () => plan,
    now: () => P6T2_NOW,
  }
}

/** The team-scope live feed (the production root's identical thunk shape). */
function teamFeedOf(
  world: P6T1World,
  provider: ReturnType<typeof createRuntimeRequirementFactsProvider>,
): () => Promise<readonly EnvironmentFact[]> {
  return async () =>
    (
      await provider.resolveFacts({
        requirements: scopeRequirementInputsOf(world.blueprint).team,
        scope: { kind: 'team' },
      })
    ).environmentFacts
}

/** The template-scope live feed (per-templateId — the leader boundary). */
function templateFeedOf(
  world: P6T1World,
  provider: ReturnType<typeof createRuntimeRequirementFactsProvider>,
): (templateId: string) => Promise<readonly EnvironmentFact[]> {
  const templates = scopeRequirementInputsOf(world.blueprint).templates
  return async (templateId: string) =>
    (
      await provider.resolveFacts({
        requirements: templates[templateId] ?? [],
        // Blocker-1: the template scope carries its role identity (the
        // bound blueprint knows its leader template id — the leader IS
        // the root: the root mounts config.rootPresetId; the member is the
        // MEMBER entry, plan §C.2 R8).
        scope: { kind: 'template', templateId, role: requirementFactScopeRoleOf(world.blueprint.leader.templateId, templateId) },
      })
    ).environmentFacts
}

/** The (type, subject) keys of the fixture blueprint's requirements. */
const LEADER_PDF = 'tool\u0000pdf'
const LEADER_WEB = 'tool\u0000web'
const WORKER_MCP = 'mcpServer\u0000unrelated'
const TEAM_BASE = 'skill\u0000base'

/** A v2 leader-boundary world (the W3-C fixture blueprint). */
async function createWorld(basename: string): Promise<P6T1World> {
  return createP6T2World(basename, ['leader', 'worker'], {
    blueprintSource: W3C_BLUEPRINT_SOURCE,
  })
}

describe('W3-C leader-template-required-boundary: the F8 leader boundary gate', () => {
  let world: P6T1World | undefined

  afterEach(() => {
    if (world !== undefined) {
      destroyP6T1World(world)
      world = undefined
    }
  })

  // --- the WIRING (the closure's refs) ------------------------------------

  it('W2: the wiring resolves [team, template:leader] for the fixture blueprint', async () => {
    world = await createWorld('w3c-wiring-fixture')
    const refs: readonly RequirementScope[] = leaderTemplateScopeRefs(world.blueprint)
    expect(refs.map((r) => scopeKey(r))).toEqual(['team', 'template:leader'])
  })

  it('W3: the refs exclude the (unrelated) worker template scope', async () => {
    world = await createWorld('w3c-wiring-exclude-worker')
    const refs: readonly RequirementScope[] = leaderTemplateScopeRefs(world.blueprint)
    expect(
      refs.some((r) => r.level === REQUIREMENT_LEVELS.template && r.templateId === 'worker'),
    ).toBe(false)
  })

  // --- case 1: Leader required down → normal BLOCKED, Recovery offered ---

  it('L1: a Leader REQUIRED requirement down blocks the normal turn and offers the recovery dispatch', async () => {
    world = await createWorld('w3c-l1-leader-required-down')
    const readiness = mutableReadiness({
      [LEADER_PDF]: PROBE_VERDICTS.unreachable,
      [LEADER_WEB]: PROBE_VERDICTS.reachable,
      [WORKER_MCP]: PROBE_VERDICTS.reachable,
      [TEAM_BASE]: PROBE_VERDICTS.reachable,
    })
    const provider = createRuntimeRequirementFactsProvider(livePorts(readiness.provider))
    const refs = leaderTemplateScopeRefs(world.blueprint)
    let blocked: { code?: string; details?: Record<string, unknown> } | undefined
    try {
      await enforceRequirementGate(
        {
          repositories: world.domain.repositories,
          blueprint: world.blueprint,
          rootSessionId: P6T2_ROOT,
          environmentFacts: teamFeedOf(world, provider),
          templateEnvironmentFacts: templateFeedOf(world, provider),
          now: () => P6T2_NOW,
        },
        normalWorkImpact(refs),
      )
      blocked = undefined
    } catch (error) {
      blocked = error as { code?: string; details?: Record<string, unknown> }
    }
    expect(blocked).toBeDefined()
    expect(blocked?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    // The block names the LEADER template scope (the required pdf down).
    expect(JSON.stringify(blocked?.details ?? {})).toContain('template:leader')
    // The "Recovery turn available" (the server-derived recovery mode).
    expect(blocked?.details?.['recoveryDispatchAvailable']).toBe(true)
  })

  // --- case 2: Leader optional down → normal CONTINUES (degraded) ---------

  it('L2: a Leader OPTIONAL requirement down does not block the normal turn (auto-degraded)', async () => {
    world = await createWorld('w3c-l2-leader-optional-down')
    const readiness = mutableReadiness({
      [LEADER_PDF]: PROBE_VERDICTS.reachable,
      [LEADER_WEB]: PROBE_VERDICTS.unreachable, // optional down → degraded
      [WORKER_MCP]: PROBE_VERDICTS.reachable,
      [TEAM_BASE]: PROBE_VERDICTS.reachable,
    })
    const provider = createRuntimeRequirementFactsProvider(livePorts(readiness.provider))
    const refs = leaderTemplateScopeRefs(world.blueprint)
    const outcome = await enforceRequirementGate(
      {
        repositories: world.domain.repositories,
        blueprint: world.blueprint,
        rootSessionId: P6T2_ROOT,
        environmentFacts: teamFeedOf(world, provider),
        templateEnvironmentFacts: templateFeedOf(world, provider),
        now: () => P6T2_NOW,
      },
      normalWorkImpact(refs),
    )
    // The optional-unmet (degraded) scope does NOT block normal work.
    expect(outcome.reason).toBe('allowed')
  })

  // --- case 4: unrelated Member requirement down → does not block Leader --

  it('L4: an unrelated Member (worker) required requirement down does not block the Leader', async () => {
    world = await createWorld('w3c-l4-unrelated-member-down')
    const readiness = mutableReadiness({
      [LEADER_PDF]: PROBE_VERDICTS.reachable,
      [LEADER_WEB]: PROBE_VERDICTS.reachable,
      [WORKER_MCP]: PROBE_VERDICTS.unreachable, // unrelated member down
      [TEAM_BASE]: PROBE_VERDICTS.reachable,
    })
    const provider = createRuntimeRequirementFactsProvider(livePorts(readiness.provider))
    const refs = leaderTemplateScopeRefs(world.blueprint)
    const outcome = await enforceRequirementGate(
      {
        repositories: world.domain.repositories,
        blueprint: world.blueprint,
        rootSessionId: P6T2_ROOT,
        environmentFacts: teamFeedOf(world, provider),
        templateEnvironmentFacts: templateFeedOf(world, provider),
        now: () => P6T2_NOW,
      },
      normalWorkImpact(refs),
    )
    // The worker scope is not in the refs → the Leader is not blocked.
    expect(outcome.reason).toBe('allowed')
  })

  // --- case 5: Team-level required down → block Leader normal turn --------

  it('L5: a Team-level REQUIRED requirement down blocks the Leader normal turn', async () => {
    world = await createWorld('w3c-l5-team-required-down')
    const readiness = mutableReadiness({
      [LEADER_PDF]: PROBE_VERDICTS.reachable,
      [LEADER_WEB]: PROBE_VERDICTS.reachable,
      [WORKER_MCP]: PROBE_VERDICTS.reachable,
      [TEAM_BASE]: PROBE_VERDICTS.unreachable, // team-level required down
    })
    const provider = createRuntimeRequirementFactsProvider(livePorts(readiness.provider))
    const refs = leaderTemplateScopeRefs(world.blueprint)
    let blocked: { code?: string; details?: Record<string, unknown> } | undefined
    try {
      await enforceRequirementGate(
        {
          repositories: world.domain.repositories,
          blueprint: world.blueprint,
          rootSessionId: P6T2_ROOT,
          environmentFacts: teamFeedOf(world, provider),
          templateEnvironmentFacts: templateFeedOf(world, provider),
          now: () => P6T2_NOW,
        },
        normalWorkImpact(refs),
      )
      blocked = undefined
    } catch (error) {
      blocked = error as { code?: string; details?: Record<string, unknown> }
    }
    expect(blocked).toBeDefined()
    expect(blocked?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(blocked?.details?.['recoveryDispatchAvailable']).toBe(true)
  })

  // --- case 1 (recovery arc): recovery work is ALLOWED on the blocked scope

  it('L1r: with the Leader required scope blocked, RECOVERY work is allowed (reduced authority)', async () => {
    world = await createWorld('w3c-l1r-recovery-allowed')
    const readiness = mutableReadiness({
      [LEADER_PDF]: PROBE_VERDICTS.unreachable,
      [LEADER_WEB]: PROBE_VERDICTS.reachable,
      [WORKER_MCP]: PROBE_VERDICTS.reachable,
      [TEAM_BASE]: PROBE_VERDICTS.reachable,
    })
    const provider = createRuntimeRequirementFactsProvider(livePorts(readiness.provider))
    const refs = leaderTemplateScopeRefs(world.blueprint)
    const outcome = await enforceRequirementGate(
      {
        repositories: world.domain.repositories,
        blueprint: world.blueprint,
        rootSessionId: P6T2_ROOT,
        environmentFacts: teamFeedOf(world, provider),
        templateEnvironmentFacts: templateFeedOf(world, provider),
        now: () => P6T2_NOW,
      },
      recoveryWorkImpact(refs),
    )
    expect(outcome.reason).toBe('recoveryAllowed')
  })
})
