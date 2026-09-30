/**
 * pre-alpha3 W3-A (review fix F1, guide §2.5/§16) — suite
 * `optional-mcp-live-outage-degraded`: an OPTIONAL requirement's capability
 * going down (live `unreachable`) on the LIVE facts feed DEGRADES the scope
 * (a WARNING verdict) — it does NOT block normal work (plan §E.8
 * auto-degraded) and does NOT open recovery (recovery is DERIVED from
 * blocked scopes only — an optional outage is a degraded-service condition
 * the Team runs through, not a required-capability outage).
 *
 * Pins (over the live provider's team-scope feed, real durable world):
 *
 * 1. normal work is ADMITTED on the degraded scope (gate reason `allowed` —
 *    never `requiredScopeDown`): the scope verdict is `degraded`, the
 *    optional requirement id carries the warning, the required requirement
 *    still PASSes, and the derived recovery state is CLOSED;
 * 2. the passage is STABLE on the fresh re-evaluation (a second normal
 *    passage over the same live feed re-classifies identically — degraded
 *    is a live verdict, not a one-shot latch) and the open-incident ledger
 *    stays EMPTY (an optional outage must never record a recovery incident
 *    — there is no required scope down for one to repair);
 * 3. the recovery passage over the degraded scope is the NO-OP allow (gate
 *    reason `allowed`, NO `recoveryScopes` — recovery work only reduces
 *    authority when a required scope is down).
 *
 * @module @dsh-agent-team/runtime/test/optional-mcp-live-outage-degraded
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  enforceRequirementGate,
  readRequirementFacts,
} from '../admission/index.js'
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import { createRuntimeRequirementFactsProvider, type RequirementFactsPorts } from '../requirement-facts/index.js'
import { PROBE_VERDICTS, type CapabilityReadinessProvider, type ProbeVerdict } from '../readiness/index.js'
import {
  normalWorkImpact,
  recoveryWorkImpact,
  scopeRequirementInputsOf,
  teamScope,
} from '../requirements/index.js'

import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { createP6T2World, P6T2_NOW, P6T2_ROOT } from './p6t2-helpers.js'

const SKILL_BASE = 'skill\u0000base'
const TOOL_WEB = 'tool\u0000web'

/** The provider boundary scope (the `kind`-shaped RequirementFactScope). */
const TEAM_SCOPE = { kind: 'team' as const }

describe('W3-A optional-mcp-live-outage-degraded: an optional outage degrades, never blocks', () => {
  let world: P6T1World | undefined

  afterEach(() => {
    void destroyP6T1World(world!).catch(() => {})
    world = undefined
  })

  function setupWorld(): {
    provider: ReturnType<typeof createRuntimeRequirementFactsProvider>
    environmentFacts: () => Promise<readonly EnvironmentFact[]>
  } {
    const table: Record<string, ProbeVerdict> = {
      [SKILL_BASE]: PROBE_VERDICTS.reachable,
      [TOOL_WEB]: PROBE_VERDICTS.unreachable,
    }
    const readiness: CapabilityReadinessProvider = {
      probe: async (type, name) => ({
        capabilityType: type,
        capabilityName: name,
        verdict: table[`${type}\u0000${name}`] ?? PROBE_VERDICTS.unknown,
        source: 'test-live-probe',
        observedAt: P6T2_NOW,
      }),
    }
    const ports: RequirementFactsPorts = {
      configuredMcpServers: [],
      readiness,
      substratePlan: async () => ({
        root: {
          presetId: 'standard',
          persona: { kind: 'standard' as const, source: 'effective-composition' as const },
        },
        member: {
          presetId: 'standard',
          persona: { kind: 'standard' as const, source: 'effective-composition' as const },
        },
      }),
      now: () => P6T2_NOW,
    }
    const provider = createRuntimeRequirementFactsProvider(ports)
    const environmentFacts = async (): Promise<readonly EnvironmentFact[]> =>
      (
        await provider.resolveFacts({
          requirements: scopeRequirementInputsOf(world!.blueprint).team,
          scope: TEAM_SCOPE,
        })
      ).environmentFacts
    return { provider, environmentFacts }
  }

  it('1. the optional outage DEGRADES the scope; normal work is admitted; recovery stays closed', async () => {
    world = await createP6T2World('w3a-optional-degraded', ['leader', 'worker'])
    const { environmentFacts } = setupWorld()
    const options = {
      repositories: world.domain.repositories,
      blueprint: world.blueprint,
      rootSessionId: P6T2_ROOT,
      environmentFacts,
      now: () => P6T2_NOW,
    }

    const outcome = await enforceRequirementGate(options, normalWorkImpact([teamScope()]))
    // Admitted — a degraded scope never blocks normal work (§E.8).
    expect(outcome.reason).toBe('allowed')
    // The scope is DEGRADED (a WARNING verdict, not a FATAL one).
    const teamVerdict = outcome.scopeVerdicts.find((v) => v.scope.level === 'team')
    expect(teamVerdict?.state).toBe('degraded')
    expect(teamVerdict?.warnings.map((v) => v.requirementId)).toEqual(['req-tool-web'])
    expect(teamVerdict?.fatal).toHaveLength(0)
    // The required requirement still PASSes on its live reachable verdict.
    expect(teamVerdict?.passCount).toBe(1)
    // Recovery is DERIVED from blocked scopes: an optional outage opens none.
    expect(outcome.recovery.open).toBe(false)
  })

  it('2. the degraded classification is stable on the fresh re-evaluation; no incident is ever recorded', async () => {
    world = await createP6T2World('w3a-optional-degraded-stable', ['leader', 'worker'])
    const { environmentFacts } = setupWorld()
    const options = {
      repositories: world.domain.repositories,
      blueprint: world.blueprint,
      rootSessionId: P6T2_ROOT,
      environmentFacts,
      now: () => P6T2_NOW,
    }

    const first = await enforceRequirementGate(options, normalWorkImpact([teamScope()]))
    expect(first.scopeVerdicts.find((v) => v.scope.level === 'team')?.state).toBe('degraded')
    const second = await enforceRequirementGate(options, normalWorkImpact([teamScope()]))
    expect(second.scopeVerdicts.find((v) => v.scope.level === 'team')?.state).toBe('degraded')

    // The open-incident ledger stays EMPTY (an optional outage must never
    // record a recovery incident — the exit-record bookkeeping is for
    // blocked scopes only).
    expect(readRequirementFacts(world.domain.repositories, P6T2_ROOT).openIncidents).toHaveLength(0)
  })

  it('3. the recovery passage over the degraded scope is the no-op allow (no reduced authority)', async () => {
    world = await createP6T2World('w3a-optional-degraded-recovery', ['leader', 'worker'])
    const { environmentFacts } = setupWorld()
    const options = {
      repositories: world.domain.repositories,
      blueprint: world.blueprint,
      rootSessionId: P6T2_ROOT,
      environmentFacts,
      now: () => P6T2_NOW,
    }

    const outcome = await enforceRequirementGate(options, recoveryWorkImpact([teamScope()]))
    // Allowed — but as plain work: NO required scope is down, so there is
    // no reduced authority to run on (no recoveryScopes on the outcome).
    expect(outcome.reason).toBe('allowed')
    expect(outcome.recoveryScopes).toBeUndefined()
    expect(outcome.recovery.open).toBe(false)
  })
})
