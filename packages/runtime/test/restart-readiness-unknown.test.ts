/**
 * pre-alpha3 W3-A (review fix F1, guide §2.5/§16) — suite
 * `restart-readiness-unknown`: the fail-closed semantics of a RESTARTED team
 * whose current readiness is `unknown` (a fresh boot — the live probe has
 * not run yet, the durable telemetry is not a current verdict) on the LIVE
 * facts feed.
 *
 * The provider contract (guide §2.5 scenario 3, pinned provider-side by
 * `runtime-requirement-facts-provider.test.ts`): `unknown` + no seed → the
 * (domain, subject) pair is OMITTED from the 2-state feed (the engine treats
 * a missing fact as UNAVAILABLE — a complete requirement on an unavailable
 * subject is FATAL); `unknown` + a durable seed → the seed row feeds the
 * engine as a marked BOOTSTRAP (not runtime truth). This suite pins the
 * GATE side of that contract over a real durable world:
 *
 * 1. required + unknown + NO seed → the required scope is BLOCKED
 *    (fail-closed: a restarted team with no evidence for a required
 *    capability cannot admit new work — the block stands until the fresh
 *    probe recovers the verdict); the block is typed and offers the
 *    recovery dispatch (a required scope is down);
 * 2. required + unknown + a `available:true` seed → the bootstrap seed
 *    feeds the engine (the requirement PASSes) and normal work is admitted
 *    (the seed is the evidence of record while the live verdict is unknown);
 *    3. an OPTIONAL requirement with an `available:false` seed alongside →
 *    the scope DEGRADES (a WARNING) but is still admitted (an optional
 *    outage never blocks, §E.8) — the seed feeds BOTH requirements the
 *    same way.
 *
 * @module @dsh-agent-team/runtime/test/restart-readiness-unknown
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
import { PROBE_VERDICTS, type CapabilityReadinessProvider } from '../readiness/index.js'
import { normalWorkImpact, scopeRequirementInputsOf, teamScope } from '../requirements/index.js'

import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { createP6T2World, P6T2_NOW, P6T2_ROOT } from './p6t2-helpers.js'

const SKILL_BASE = 'skill\u0000base'
const TOOL_WEB = 'tool\u0000web'

/**
 * The restarted team's live provider: the readiness table answers `unknown`
 * for EVERY (type, subject) pair (a fresh boot — no probe has run), with
 * the optional durable seed rows.
 */
function restartedPorts(seed?: readonly SeedEnvironmentFact[]): RequirementFactsPorts {
  const readiness: CapabilityReadinessProvider = {
    probe: async (type, name) => ({
      capabilityType: type,
      capabilityName: name,
      verdict: PROBE_VERDICTS.unknown,
      source: 'test-fresh-boot',
      observedAt: P6T2_NOW,
    }),
  }
  return {
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
    ...(seed !== undefined ? { seedFacts: seed } : {}),
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
        scope: TEAM_SCOPE,
      })
    ).environmentFacts
}

/** The provider boundary scope (the `kind`-shaped RequirementFactScope). */
const TEAM_SCOPE = { kind: 'team' as const }

describe('W3-A restart-readiness-unknown: unknown readiness fails closed (no evidence, no admission)', () => {
  let world: P6T1World | undefined

  afterEach(() => {
    void destroyP6T1World(world!).catch(() => {})
    world = undefined
  })

  it('1. required + unknown + no seed → BLOCKED until the fresh probe (fail-closed, recovery offered)', async () => {
    world = await createP6T2World('w3a-restart-unknown-noseed', ['leader', 'worker'])
    const provider = createRuntimeRequirementFactsProvider(restartedPorts())
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
        throw new Error('expected a rejection, but the gate admitted on unknown readiness')
      },
      (error: unknown) => error,
    )
    const err = rejected as { code: string; details?: Record<string, unknown> }
    expect(err.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(err.details?.['status']).toBe('BLOCKED_FATAL')
    expect(err.details?.['gateReason']).toBe('requiredScopeDown')
    expect(err.details?.['blockedScopes']).toEqual(['team'])
    // The REQUIRED requirement is the blocker (the omitted fact folds to
    // unavailable → FATAL; the optional one folds to a WARNING and cannot
    // block).
    expect(err.details?.['blockingRequirementIds']).toEqual(['req-skill-base'])
    expect(err.details?.['recoveryDispatchAvailable']).toBe(true)
  })

  it('2. required + unknown + an available:true seed → the bootstrap seed feeds the engine → admitted', async () => {
    world = await createP6T2World('w3a-restart-unknown-seed', ['leader', 'worker'])
    // The durable capability-runtime telemetry last recorded the required
    // capability reachable (generation 9) — it enters as the bootstrap
    // seed (the provider carries no telemetry port; the seed is the only
    // evidence of record while the live verdict is unknown).
    const seed: readonly SeedEnvironmentFact[] = [
      { domain: 'skill', subject: 'base', available: true, generation: 9 },
      { domain: 'tool', subject: 'web', available: true, generation: 9 },
    ]
    const provider = createRuntimeRequirementFactsProvider(restartedPorts(seed))
    const environmentFacts = teamFeedOf(world, provider)

    const outcome = await enforceRequirementGate(
      {
        repositories: world.domain.repositories,
        blueprint: world.blueprint,
        rootSessionId: P6T2_ROOT,
        environmentFacts,
        now: () => P6T2_NOW,
      },
      normalWorkImpact([teamScope()]),
    )
    expect(outcome.reason).toBe('allowed')
    const teamVerdict = outcome.scopeVerdicts.find((v) => v.scope.level === 'team')
    expect(teamVerdict?.state).toBe('ready')
    expect(outcome.recovery.open).toBe(false)
  })

  it('3. an available:false optional seed → the scope DEGRADES but is still admitted (the seed feeds both requirements the same way)', async () => {
    world = await createP6T2World('w3a-restart-unknown-seed-optional', ['leader', 'worker'])
    const seed: readonly SeedEnvironmentFact[] = [
      { domain: 'skill', subject: 'base', available: true, generation: 9 },
      { domain: 'tool', subject: 'web', available: false, generation: 3 },
    ]
    const provider = createRuntimeRequirementFactsProvider(restartedPorts(seed))
    const environmentFacts = teamFeedOf(world, provider)

    const outcome = await enforceRequirementGate(
      {
        repositories: world.domain.repositories,
        blueprint: world.blueprint,
        rootSessionId: P6T2_ROOT,
        environmentFacts,
        now: () => P6T2_NOW,
      },
      normalWorkImpact([teamScope()]),
    )
    expect(outcome.reason).toBe('allowed')
    const teamVerdict = outcome.scopeVerdicts.find((v) => v.scope.level === 'team')
    expect(teamVerdict?.state).toBe('degraded')
    expect(teamVerdict?.warnings.map((v) => v.requirementId)).toEqual(['req-tool-web'])
    expect(teamVerdict?.fatal).toHaveLength(0)
    expect(outcome.recovery.open).toBe(false)
    expect(readRequirementFacts(world.domain.repositories, P6T2_ROOT).openIncidents).toHaveLength(0)
  })
})
