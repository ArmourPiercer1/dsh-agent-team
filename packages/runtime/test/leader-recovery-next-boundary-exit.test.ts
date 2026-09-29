/**
 * pre-alpha3 W3-C (review fix F8, guide §7.3 case 3) — the Leader's
 * recovery-mode EXIT arc on the Leader template boundary:
 *
 *   recovery 中恢复 → the CURRENT turn is still Recovery (the leader
 *   required scope is still blocked — the normal turn stays blocked and
 *   the recovery turn is allowed) and the NEXT turn is Normal (the fresh
 *   evaluation recovers when the requirement becomes reachable — the
 *   §E.10 exit record closes the recovery incident and the normal turn is
 *   admitted).
 *
 * The mode switch is SERVER-DERIVED (the gate re-evaluates fresh facts per
 * boundary) — there is NO wire field for the mode (the "Normal"/"Recovery"
 * mode is never a client input; the recovery dispatch availability is the
 * gate's `recoveryDispatchAvailable` signal).
 *
 * This is the leader-boundary twin of the team-scope exit arc pinned by
 * `required-mcp-live-outage-recovery.test.ts` (test 3), bound to the Leader
 * template scope by the F8 wiring (see `leader-template-required-boundary.test.ts`).
 *
 * @module test/leader-recovery-next-boundary-exit
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  enforceRequirementGate,
  TEAM_RUNTIME_ERROR_CODES,
} from '../admission/index.js'
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import {
  createRuntimeRequirementFactsProvider,
  type RequirementFactsPorts,
} from '../requirement-facts/index.js'
import {
  normalWorkImpact,
  recoveryWorkImpact,
  scopeRequirementInputsOf,
} from '../requirements/index.js'
import type { RequirementScope } from '../requirements/index.js'
import { PROBE_VERDICTS, type CapabilityReadinessProvider, type ProbeVerdict } from '../readiness/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { createP6T2World, P6T2_NOW, P6T2_ROOT } from './p6t2-helpers.js'
import { leaderTemplateScopeRefs } from '../action-router/root-initial-work.js'

/** The W3-C fixture blueprint (identical to the boundary test — v2 leader). */
const W3C_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 2',
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

function templateFeedOf(
  world: P6T1World,
  provider: ReturnType<typeof createRuntimeRequirementFactsProvider>,
): (templateId: string) => Promise<readonly EnvironmentFact[]> {
  const templates = scopeRequirementInputsOf(world.blueprint).templates
  return async (templateId: string) =>
    (
      await provider.resolveFacts({
        requirements: templates[templateId] ?? [],
        scope: { kind: 'template', templateId },
      })
    ).environmentFacts
}

const LEADER_PDF = 'tool\u0000pdf'

describe('W3-C leader-recovery-next-boundary-exit: the F8 leader recovery exit', () => {
  let world: P6T1World | undefined

  afterEach(() => {
    if (world !== undefined) {
      destroyP6T1World(world)
      world = undefined
    }
  })

  it('L3: recovery-mid-recovery keeps the current turn Recovery; the next boundary (fresh probe recovered) exits to Normal', async () => {
    world = await createP6T2World('w3c-l3-exit', ['leader', 'worker'], {
      blueprintSource: W3C_BLUEPRINT_SOURCE,
    })
    const readiness = mutableReadiness({
      [LEADER_PDF]: PROBE_VERDICTS.unreachable, // leader required down
      'tool\u0000web': PROBE_VERDICTS.reachable,
      'mcpServer\u0000unrelated': PROBE_VERDICTS.reachable,
      'skill\u0000base': PROBE_VERDICTS.reachable,
    })
    const provider = createRuntimeRequirementFactsProvider(livePorts(readiness.provider))
    const refs: readonly RequirementScope[] = leaderTemplateScopeRefs(world.blueprint)
    const gateOptions = {
      repositories: world.domain.repositories,
      blueprint: world.blueprint,
      rootSessionId: P6T2_ROOT,
      environmentFacts: teamFeedOf(world, provider),
      templateEnvironmentFacts: templateFeedOf(world, provider),
      now: () => P6T2_NOW,
    }

    // Current turn: the leader required scope is BLOCKED → the NORMAL turn
    // is blocked (typed) and the RECOVERY turn is allowed (reduced
    // authority). The turn is in Recovery mode.
    const blockedNormal = await enforceRequirementGate(gateOptions, normalWorkImpact(refs)).then(
      () => {
        throw new Error('expected the blocked normal turn to reject')
      },
      (error: unknown) => error,
    )
    expect((blockedNormal as { code?: string }).code).toBe(
      TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
    )
    const recoveryAllowed = await enforceRequirementGate(gateOptions, recoveryWorkImpact(refs))
    expect(recoveryAllowed.reason).toBe('recoveryAllowed')

    // The requirement RECOVERS (the live probe now reports reachable) → the
    // NEXT boundary's fresh evaluation passes → the normal turn is admitted
    // (the §E.10 exit record closes the recovery incident; the mode returns
    // to Normal — server-derived, no wire field).
    readiness.set(LEADER_PDF, PROBE_VERDICTS.reachable)
    const nextNormal = await enforceRequirementGate(gateOptions, normalWorkImpact(refs))
    expect(nextNormal.reason).toBe('allowed')
  })
})
