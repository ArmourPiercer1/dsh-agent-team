/**
 * pre-alpha3 PR-E / review fix F1 — the `RuntimeRequirementFactsProvider`
 * over its review scenarios (guide §2.5, "验收测试").
 *
 * The five scenarios (guide §2.5) assert the PROVIDER side of the BLOCK/OPEN
 * decision: the 3-state observations + the derived 2-state feed the #42
 * gate (W3-A) consumes. The gate's own mapping (required + unreachable →
 * BLOCK, optional + unreachable → DEGRADED, required + unknown → re-probe
 * (NOT BLOCK), cold materialization not-applicable → never blocks) is W3-A's
 * contract over this surface.
 *
 * 1. static `available:true` + live `unreachable` → required BLOCK /
 *    optional DEGRADED — the feed carries `available:false` (the live
 *    verdict OVERRIDES the static seed — the false-OPEN fix);
 * 2. static `available:false` + live recovery → the fresh evaluation
 *    recovers (`available:true`);
 * 3. restart: the durable telemetry last recorded `reachable` but the
 *    current readiness is `unknown` — the feed does NOT adopt the durable
 *    record; the fresh probe recovers it;
 * 4. a cold member's required MCP materialization is `not-applicable` — it
 *    MUST NOT block the Team;
 * 5. a resident member's mount failure → `failed` — it blocks that
 *    template's normal work.
 * @module @dsh-agent-team/runtime/test/runtime-requirement-facts-provider.test
 */

import { describe, expect, it } from 'vitest'
import {
  createRuntimeRequirementFactsProvider,
  assertRequirementFactScope,
  type RequirementFactsPorts,
  type SeedEnvironmentFact,
} from '../requirement-facts/index.js'
import {
  createCapabilityReadinessProvider,
  MEMBER_LIVENESS,
  PROBE_VERDICTS,
  SUPPLY_AXIS,
  type CapabilityReadinessProvider,
  type ProbeVerdict,
} from '../readiness/index.js'
import type { EnvironmentFact, RequirementInput } from '../../domain/compatibility/src/index.js'
import type { RuntimeSubstratePlan } from '../agent-setup/preset/index.js'

const NOW = '2026-10-01T00:00:00.000Z'

/** A readiness provider that answers from a (type, name) → verdict table. */
function tableReadiness(table: Record<string, ProbeVerdict>): CapabilityReadinessProvider {
  return {
    probe: async (type, name) => ({
      capabilityType: type,
      capabilityName: name,
      verdict: table[`${type}\u0000${name}`] ?? PROBE_VERDICTS.unknown,
      source: 'test-probe',
      observedAt: NOW,
    }),
  }
}

/** A substrate plan (root + member persona observations). */
function planOf(root: { presetId: string; kind: 'standard' | 'complete' | 'absent' | 'unresolved' }, member: { presetId: string; kind: 'standard' | 'complete' | 'absent' | 'unresolved' }): RuntimeSubstratePlan {
  const entry = (presetId: string, kind: 'standard' | 'complete' | 'absent' | 'unresolved') => ({
    presetId,
    persona:
      kind === 'unresolved'
        ? { kind: 'unresolved' as const, source: 'none' as const, reason: 'test unresolved' }
        : { kind, source: 'effective-composition' as const },
  })
  return { root: entry(root.presetId, root.kind), member: entry(member.presetId, member.kind) }
}

/** The provider ports with sensible test defaults (a standard root, the probe table). */
function ports(args: {
  configured?: readonly string[]
  readiness?: CapabilityReadinessProvider
  seed?: readonly SeedEnvironmentFact[]
  plan?: RuntimeSubstratePlan
  materialization?: RequirementFactsPorts['memberMaterialization']
  now?: () => string
}): RequirementFactsPorts {
  return {
    configuredMcpServers: args.configured ?? [],
    readiness: args.readiness ?? tableReadiness({}),
    ...(args.seed !== undefined ? { seedFacts: args.seed } : {}),
    substratePlan: async () => args.plan ?? planOf({ presetId: 'dsh-agent-team', kind: 'standard' }, { presetId: 'dsh-agent-team', kind: 'standard' }),
    ...(args.materialization !== undefined ? { memberMaterialization: args.materialization } : {}),
    now: args.now ?? (() => NOW),
  }
}

const TEAM = { kind: 'team' as const }
const TEMPLATE = { kind: 'template' as const, templateId: 'dev' }

describe('guide §2.5 — scenario 1: static available:true + live unreachable (the false-OPEN fix)', () => {
  it('required → the feed is available:false (the gate BLOCKs); optional → the gate DEGRADEs', async () => {
    // The static row said the server was available (generation 7 — a past
    // probe). The LIVE probe now observes it down.
    const provider = createRuntimeRequirementFactsProvider(
      ports({
        configured: ['github'],
        readiness: tableReadiness({ 'mcpServer\u0000github': PROBE_VERDICTS.unreachable }),
        seed: [{ domain: 'mcpServer', subject: 'github', available: true, generation: 7 }],
      }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [
        { requirementId: 'req-required', type: 'mcpServer', subjects: ['github'], complete: true },
        { requirementId: 'req-optional', type: 'mcpServer', subjects: ['github'], complete: false },
      ],
      scope: TEAM,
    })
    // BOTH requirements observe the same live unreachable verdict.
    for (const observation of resolution.observations) {
      expect(observation.readiness).toBe(PROBE_VERDICTS.unreachable)
      expect(observation.supply).toBe(SUPPLY_AXIS.configured)
    }
    // The feed carries the LIVE verdict (available:false), NOT the static
    // seed (available:true): a required subject folds to BLOCK, an optional
    // one to DEGRADED (the gate's W3-A mapping over this surface).
    expect(resolution.environmentFacts).toEqual([{ domain: 'mcpServer', subject: 'github', available: false, generation: 1 }])
  })
})

describe('guide §2.5 — scenario 2: static available:false + live recovery', () => {
  it('the fresh evaluation recovers (available:true)', async () => {
    const provider = createRuntimeRequirementFactsProvider(
      ports({
        configured: ['linear'],
        readiness: tableReadiness({ 'mcpServer\u0000linear': PROBE_VERDICTS.reachable }),
        seed: [{ domain: 'mcpServer', subject: 'linear', available: false, generation: 3 }],
      }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [{ requirementId: 'req', type: 'mcpServer', subjects: ['linear'], complete: true }],
      scope: TEAM,
    })
    expect(resolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.reachable)
    // The live verdict overrides the stale static false: recovered.
    expect(resolution.environmentFacts).toEqual([{ domain: 'mcpServer', subject: 'linear', available: true, generation: 1 }])
  })
})

describe('guide §2.5 — scenario 3: restart recovery (durable telemetry ≠ current readiness)', () => {
  it('unknown after restart → the durable record is NOT adopted; the fresh probe recovers', async () => {
    // The durable capability-runtime-event ledger last recorded 'reachable'
    // (here it enters only as the bootstrap seed — the provider itself has
    // NO telemetry port: it cannot read the ledger).
    const seed = [{ domain: 'mcpServer', subject: 'gitlab', available: true, generation: 9 }]

    // Fresh boot: the probe has not run yet → unknown.
    const before = createRuntimeRequirementFactsProvider(
      ports({ configured: ['gitlab'], readiness: tableReadiness({}), seed }),
    )
    const first = await before.resolveFacts({
      requirements: [{ requirementId: 'req', type: 'mcpServer', subjects: ['gitlab'], complete: true }],
      scope: TEAM,
    })
    expect(first.observations[0]!.readiness).toBe(PROBE_VERDICTS.unknown)
    // The seed is a BOOTSTRAP (marked), not runtime truth — the gate sees
    // the 3-state `unknown` observation and re-probes instead of assuming
    // either state.
    expect(first.environmentFacts).toEqual([
      { domain: 'mcpServer', subject: 'gitlab', available: true, generation: 9, detail: 'bootstrap seed (config.environmentFacts) — not runtime truth' },
    ])

    // The probe runs and recovers reachability.
    const after = createRuntimeRequirementFactsProvider(
      ports({
        configured: ['gitlab'],
        readiness: tableReadiness({ 'mcpServer\u0000gitlab': PROBE_VERDICTS.reachable }),
        seed,
      }),
    )
    const second = await after.resolveFacts({
      requirements: [{ requirementId: 'req', type: 'mcpServer', subjects: ['gitlab'], complete: true }],
      scope: TEAM,
    })
    expect(second.observations[0]!.readiness).toBe(PROBE_VERDICTS.reachable)
    // The live verdict replaces the seed: no seed detail, live generation.
    expect(second.environmentFacts).toEqual([{ domain: 'mcpServer', subject: 'gitlab', available: true, generation: 1 }])
  })
})

describe('guide §2.5 — scenario 4: a cold member required MCP is not-applicable (never blocks the Team)', () => {
  it('template boundary: materialization not-applicable (derived from liveness)', async () => {
    const provider = createRuntimeRequirementFactsProvider(
      ports({
        configured: ['github'],
        readiness: tableReadiness({ 'mcpServer\u0000github': PROBE_VERDICTS.reachable }),
        materialization: async () => ({ liveness: MEMBER_LIVENESS.cold, mcpSlots: new Map() }),
      }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [{ requirementId: 'req', type: 'mcpServer', subjects: ['github'], complete: true }],
      scope: TEMPLATE,
    })
    const observation = resolution.observations[0]!
    expect(observation.materialization).toBe('not-applicable')
    // The Team-level verdict stands on supply + fresh readiness (reachable)
    // — the cold member's not-applicable materialization blocks nothing.
    expect(observation.readiness).toBe(PROBE_VERDICTS.reachable)
    expect(resolution.environmentFacts).toEqual([{ domain: 'mcpServer', subject: 'github', available: true, generation: 1 }])
  })

  it('team boundary: no materialization axis at all (supply + fresh readiness only)', async () => {
    const provider = createRuntimeRequirementFactsProvider(
      ports({
        configured: ['github'],
        readiness: tableReadiness({ 'mcpServer\u0000github': PROBE_VERDICTS.reachable }),
        // Even if the view port exists, a team scope must not materialize.
        materialization: async () => ({ liveness: MEMBER_LIVENESS.resident, mcpSlots: new Map([['github', { status: 'failed' as const }]]) }),
      }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [{ requirementId: 'req', type: 'mcpServer', subjects: ['github'], complete: true }],
      scope: TEAM,
    })
    expect(resolution.observations[0]!.materialization).toBeUndefined()
  })

  it('an absent materialization view (no live member state) is a cold member: not-applicable', async () => {
    const provider = createRuntimeRequirementFactsProvider(
      ports({
        configured: ['github'],
        readiness: tableReadiness({ 'mcpServer\u0000github': PROBE_VERDICTS.unknown }),
        // No memberMaterialization port at all: the boundary has no live
        // member state → cold → not-applicable (never a fabricated failure).
      }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [{ requirementId: 'req', type: 'mcpServer', subjects: ['github'], complete: true }],
      scope: TEMPLATE,
    })
    expect(resolution.observations[0]!.materialization).toBe('not-applicable')
    // unknown live + no seed → the fact is omitted (the engine's unprobed
    // sentinel); the gate re-probes instead of blocking.
    expect(resolution.environmentFacts).toEqual([])
  })
})

describe('guide §2.5 — scenario 5: a resident member mount failure blocks that template', () => {
  it('resident + failed slot → materialization failed (the gate BLOCKs the template)', async () => {
    const provider = createRuntimeRequirementFactsProvider(
      ports({
        configured: ['github'],
        readiness: tableReadiness({ 'mcpServer\u0000github': PROBE_VERDICTS.unreachable }),
        materialization: async () => ({
          liveness: MEMBER_LIVENESS.resident,
          mcpSlots: new Map([['github', { status: 'failed', reason: 'connect ECONNREFUSED' }]]),
        }),
      }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [{ requirementId: 'req', type: 'mcpServer', subjects: ['github'], complete: true }],
      scope: TEMPLATE,
    })
    const observation = resolution.observations[0]!
    expect(observation.materialization).toBe('failed')
    expect(observation.readiness).toBe(PROBE_VERDICTS.unreachable)
    expect(resolution.environmentFacts).toEqual([{ domain: 'mcpServer', subject: 'github', available: false, generation: 1 }])
  })
})

describe('the supply axis (guide §2.3 — configuredMcpServers)', () => {
  it('an unconfigured required MCP is unreachable BY CONFIGURATION (no probe)', async () => {
    const readiness = createCapabilityReadinessProvider({
      probes: {
        mcpServer: { source: 'mcp-fiber', probe: () => { throw new Error('must not be called') } },
      },
      now: () => NOW,
    })
    const provider = createRuntimeRequirementFactsProvider(
      ports({ configured: [], readiness }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [{ requirementId: 'req', type: 'mcpServer', subjects: ['not-configured'], complete: true }],
      scope: TEAM,
    })
    const observation = resolution.observations[0]!
    expect(observation.supply).toBe(SUPPLY_AXIS.unconfigured)
    expect(observation.readiness).toBe(PROBE_VERDICTS.unreachable)
    expect(observation.readinessReason).toContain('not configured')
    expect(resolution.environmentFacts).toEqual([{ domain: 'mcpServer', subject: 'not-configured', available: false, generation: 1 }])
  })
})

describe('the persona domain (plan §C.2 — the production substrate plan)', () => {
  it('a standard root preset is reachable (composable); the feed says available:true', async () => {
    const provider = createRuntimeRequirementFactsProvider(
      ports({ plan: planOf({ presetId: 'ptc', kind: 'standard' }, { presetId: 'ptc', kind: 'standard' }) }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [{ requirementId: 'persona-req', type: 'persona', subjects: ['ptc'], complete: true }],
      scope: TEAM,
    })
    expect(resolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.reachable)
    expect(resolution.environmentFacts).toEqual([{ domain: 'persona', subject: 'ptc', available: true, generation: 1 }])
  })

  it('a complete preset is unreachable (the §13.5 conflict)', async () => {
    const provider = createRuntimeRequirementFactsProvider(
      ports({ plan: planOf({ presetId: 'minimal', kind: 'complete' }, { presetId: 'minimal', kind: 'complete' }) }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [{ requirementId: 'persona-req', type: 'persona', subjects: ['minimal'], complete: true }],
      scope: TEAM,
    })
    expect(resolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.unreachable)
    expect(resolution.observations[0]!.readinessReason).toContain('complete effective persona')
    expect(resolution.environmentFacts).toEqual([{ domain: 'persona', subject: 'minimal', available: false, generation: 1 }])
  })

  it('an unresolved persona is unknown (typed — re-probe, never a guess)', async () => {
    const provider = createRuntimeRequirementFactsProvider(
      ports({ plan: planOf({ presetId: 'mystery', kind: 'unresolved' }, { presetId: 'mystery', kind: 'unresolved' }) }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [{ requirementId: 'persona-req', type: 'persona', subjects: ['mystery'], complete: true }],
      scope: TEAM,
    })
    expect(resolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.unknown)
    expect(resolution.observations[0]!.readinessReason).toContain('test unresolved')
    // unknown + no seed → omitted (the engine's unprobed sentinel).
    expect(resolution.environmentFacts).toEqual([])
  })

  it('guide §17 R8: the member template persona uses the MEMBER plan entry', async () => {
    // root = standard (composable), member = minimal (complete → conflict).
    // The member template requirement must be checked against the MEMBER
    // observation, not the root's.
    const provider = createRuntimeRequirementFactsProvider(
      ports({
        plan: planOf({ presetId: 'ptc', kind: 'standard' }, { presetId: 'minimal', kind: 'complete' }),
      }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [{ requirementId: 'member-persona', type: 'persona', subjects: ['minimal'], complete: true }],
      scope: TEMPLATE,
    })
    expect(resolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.unreachable)
  })

  it('a subject that is neither the root nor the member preset is unknown (typed mismatch)', async () => {
    const provider = createRuntimeRequirementFactsProvider(
      ports({ plan: planOf({ presetId: 'ptc', kind: 'standard' }, { presetId: 'minimal', kind: 'complete' }) }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [{ requirementId: 'persona-req', type: 'persona', subjects: ['other-preset'], complete: true }],
      scope: TEAM,
    })
    expect(resolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.unknown)
    expect(resolution.observations[0]!.readinessReason).toContain('not the observed root/member preset')
  })
})

describe('other domains (the existing authoritative probe ports, fail-soft)', () => {
  it('a missing probe port is unknown (never unreachable) and feeds only the seed (or nothing)', async () => {
    const provider = createRuntimeRequirementFactsProvider(
      ports({
        readiness: createCapabilityReadinessProvider({ probes: {}, now: () => NOW }),
      }),
    )
    const resolution = await provider.resolveFacts({
      requirements: [
        { requirementId: 'model-req', type: 'modelRoute', subjects: ['claude-opus-4-6'], complete: true },
        { requirementId: 'tool-req', type: 'tool', subjects: ['team_delegate'], complete: false },
      ],
      scope: TEAM,
    })
    const bySubject = new Map(resolution.observations.map((o) => [o.subject, o]))
    expect(bySubject.get('claude-opus-4-6')!.readiness).toBe(PROBE_VERDICTS.unknown)
    expect(bySubject.get('claude-opus-4-6')!.readinessReason).toContain('NO_PROBE_PORT')
    expect(bySubject.get('team_delegate')!.readiness).toBe(PROBE_VERDICTS.unknown)
    // unknown + no seed → both omitted (the engine's unprobed sentinel).
    expect(resolution.environmentFacts).toEqual([])
  })
})

describe('the scope validation (fail loud, typed)', () => {
  it('assertRequirementFactScope rejects a malformed scope', () => {
    expect(() => assertRequirementFactScope({ kind: 'template' })).toThrowError(/templateId/)
    expect(() => assertRequirementFactScope({ kind: 'bogus' })).toThrowError(/unknown requirement-fact scope kind/)
  })
})
