/**
 * pre-alpha3 W3-A (review fix F1, guide §2.5/§16) — suite
 * `required-mcp-live-outage-recovery`: the production requirement gate
 * consumes the LIVE facts feed (the `RuntimeRequirementFactsProvider`'s
 * team-scope feed — supply + fresh readiness + seeds) instead of the
 * static config array.
 *
 * The outage arc (a required requirement's capability goes down MID-SESSION
 * on an already-created team — the team-level arc; the template-boundary
 * arc is W3-C's Leader scope test):
 *
 * 1. the LIVE `unreachable` verdict OVERRIDES the static
 *    `available:true` seed row → the required scope is BLOCKED (the
 *    false-OPEN fix, guide §2.5 scenario 1): the typed
 *    `COMPATIBILITY_BLOCKED` block carries `recoveryDispatchAvailable`
 *    (a required scope is down) + the blocking requirement id;
 * 2. the HUMAN-REVIEWED recovery work is allowed on the REDUCED original
 *    authority (gate reason `recoveryAllowed`, the recovery scopes named)
 *    and the OPEN recovery incident is recorded durably (the `team` scope
 *    log, the requirement id carried — never a stored flag);
 * 3. the FRESH evaluation recovers (the capability is back) → normal work
 *    is admitted again (reason `allowed`, the scope `ready`) and the open
 *    incident is CLOSED durably (the plan §E.10 exit record — the derived
 *    state flipped, the durable history recorded).
 *
 * The gate is consulted DIRECTLY (`enforceRequirementGate` — the
 * consumer-side of the live feed) over a real durable world (P6-T2: the
 * required `skill/base` + the optional `tool/web` v1 requirements): the
 * production root's identical wiring (the root's `environmentFacts` thunk
 * + the gate options) is pinned by the W3-B startup-preflight suites over
 * the full host entry.
 *
 * @module @dsh-agent-team/runtime/test/required-mcp-live-outage-recovery
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  enforceRequirementGate,
  readRequirementFacts,
  TEAM_RUNTIME_ERROR_CODES,
} from '../admission/index.js'
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import {
  createRuntimeRequirementFactsProvider,
  type RequirementFactsPorts,
  type SeedEnvironmentFact,
} from '../requirement-facts/index.js'
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

/** The live provider over a (toggleable) readiness table (+ optional seeds). */
function livePorts(
  readiness: CapabilityReadinessProvider,
  seed?: readonly SeedEnvironmentFact[],
): RequirementFactsPorts {
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
    ...(seed !== undefined ? { seedFacts: seed } : {}),
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
        scope: TEAM_SCOPE,
      })
    ).environmentFacts
}

const SKILL_BASE = 'skill\u0000base'
const TOOL_WEB = 'tool\u0000web'

/** The provider boundary scope (the `kind`-shaped RequirementFactScope). */
const TEAM_SCOPE = { kind: 'team' as const }

describe('W3-A required-mcp-live-outage-recovery: the live outage arcs', () => {
  let world: P6T1World | undefined

  afterEach(() => {
    void destroyP6T1World(world!).catch(() => {})
    world = undefined
  })

  it('1. the live unreachable verdict overrides the static available:true seed → the required scope BLOCKs (typed, recovery offered)', async () => {
    world = await createP6T2World('w3a-req-outage-block', ['leader', 'worker'])
    const readiness = mutableReadiness({
      [SKILL_BASE]: PROBE_VERDICTS.unreachable,
      [TOOL_WEB]: PROBE_VERDICTS.reachable,
    })
    // The static rows said BOTH capabilities were available (a past probe,
    // generation 5) — the live verdict must override, not trust, them.
    const seed: readonly SeedEnvironmentFact[] = [
      { domain: 'skill', subject: 'base', available: true, generation: 5 },
      { domain: 'tool', subject: 'web', available: true, generation: 5 },
    ]
    const provider = createRuntimeRequirementFactsProvider(livePorts(readiness.provider, seed))
    const environmentFacts = teamFeedOf(world, provider)

    const rejected = await enforceRequirementGate(
      {
        repositories: world.domain.repositories,
        blueprint: world.blueprint,
        rootSessionId: P6T2_ROOT,
        environmentFacts,
        now: () => P6T2_NOW,
      },
      normalWorkImpact([teamScope()]),
    ).then(
      () => {
        throw new Error('expected a rejection, but the gate allowed the blocked scope')
      },
      (error: unknown) => error,
    )
    const err = rejected as { code: string; details?: Record<string, unknown> }
    expect(err.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(err.details?.['status']).toBe('BLOCKED_FATAL')
    expect(err.details?.['gateReason']).toBe('requiredScopeDown')
    expect(err.details?.['blockedScopes']).toEqual(['team'])
    expect(err.details?.['blockingRequirementIds']).toContain('req-skill-base')
    expect(Array.isArray(err.details?.['unavailableSubjects'])).toBe(true)
    expect(err.details?.['unavailableSubjects']).toContain('base')
    expect(err.details?.['source']).toBe('requirement-gate')
    // A REQUIRED scope is down → the router may offer the human-reviewed
    // recovery dispatch for the blocked scopes.
    expect(err.details?.['recoveryDispatchAvailable']).toBe(true)
  })

  it('2. the recovery work is allowed on the reduced authority + the incident opens durably', async () => {
    world = await createP6T2World('w3a-req-outage-recovery', ['leader', 'worker'])
    const readiness = mutableReadiness({
      [SKILL_BASE]: PROBE_VERDICTS.unreachable,
      [TOOL_WEB]: PROBE_VERDICTS.reachable,
    })
    const provider = createRuntimeRequirementFactsProvider(livePorts(readiness.provider))
    const environmentFacts = teamFeedOf(world, provider)
    const options = {
      repositories: world.domain.repositories,
      blueprint: world.blueprint,
      rootSessionId: P6T2_ROOT,
      environmentFacts,
      now: () => P6T2_NOW,
    }

    const outcome = await enforceRequirementGate(options, recoveryWorkImpact([teamScope()]))
    expect(outcome.reason).toBe('recoveryAllowed')
    expect(outcome.recoveryScopes?.map((s) => s.level)).toEqual(['team'])
    expect(outcome.recovery.open).toBe(true)

    // The OPEN incident is durable (the `team` scope log, the requirement
    // id carried; the state itself stays DERIVED on the next passage).
    const facts = readRequirementFacts(world.domain.repositories, P6T2_ROOT)
    expect(facts.openIncidents).toHaveLength(1)
    expect(facts.openIncidents[0]?.scopeKey).toBe('team')
    expect(facts.openIncidents[0]?.requirementIds).toContain('req-skill-base')
  })

  it('3. the fresh evaluation recovers → normal work is admitted + the incident closes (the §E.10 exit record)', async () => {
    world = await createP6T2World('w3a-req-outage-exit', ['leader', 'worker'])
    const readiness = mutableReadiness({
      [SKILL_BASE]: PROBE_VERDICTS.unreachable,
      [TOOL_WEB]: PROBE_VERDICTS.reachable,
    })
    const provider = createRuntimeRequirementFactsProvider(livePorts(readiness.provider))
    const environmentFacts = teamFeedOf(world, provider)
    const options = {
      repositories: world.domain.repositories,
      blueprint: world.blueprint,
      rootSessionId: P6T2_ROOT,
      environmentFacts,
      now: () => P6T2_NOW,
    }

    // Open the incident (the recovery passage over the outage).
    const recovered = await enforceRequirementGate(options, recoveryWorkImpact([teamScope()]))
    expect(recovered.reason).toBe('recoveryAllowed')
    expect(readRequirementFacts(world.domain.repositories, P6T2_ROOT).openIncidents).toHaveLength(1)

    // The capability recovers (the live probe now observes it reachable).
    readiness.set(SKILL_BASE, PROBE_VERDICTS.reachable)
    const normal = await enforceRequirementGate(options, normalWorkImpact([teamScope()]))
    expect(normal.reason).toBe('allowed')
    expect(normal.recovery.open).toBe(false)
    const teamVerdict = normal.scopeVerdicts.find((v) => v.scope.level === 'team')
    expect(teamVerdict?.state).toBe('ready')

    // The exit record: the incident is CLOSED durably (the derived state
    // flipped blocked→ready on the fresh evaluation).
    expect(readRequirementFacts(world.domain.repositories, P6T2_ROOT).openIncidents).toHaveLength(0)
  })
})
