/**
 * pre-alpha3 W3-A / PF-1 fix (2026-09-30, adjudicated product defect) —
 * the PER-BLUEPRINT scoping of the live requirement-facts feed.
 *
 * The defect (PF-1, red-line STOP in the pass-2 E.12 re-run): the W3-A boot
 * thunk resolved the W2-A live provider against the BOOT blueprint's team
 * requirements and that boot-scoped feed was shared with every consumer
 * that evaluates an ARBITRARY blueprint's requirements — the remote
 * surface's `intent.probe` (the requested blueprint), the per-root
 * compatibility prober (each created root's bound blueprint), and the
 * admission gates (each request's bound blueprint). On a multi-blueprint
 * host (a zero-requirement boot anchor) the feed was empty for the probed
 * blueprint → the engine's "missing = unprobed" fail-closed turned a
 * CONFIGURED + HEALTHY live server into a spurious FATAL, breaking the
 * frozen INV-9.4 two-worlds identity (s6-remote.ts: the probe is a
 * FAITHFUL PREDICTOR of the post-creation admission gate — the SAME world).
 *
 * The fix (one seam, no per-consumer patches): ONE dynamic per-blueprint
 * facts source in the production root (`environmentFactsForBlueprint` —
 * the live provider resolved against the passed blueprint's own team
 * scope; factory worlds keep the static row feed, the legacy template
 * feed is absent) wired into the remote surface (`options.environmentFacts`
 * is now called with the RESOLVED requested blueprint), the per-root
 * prober factory (each created root's thunk is scoped to THAT root's
 * bound blueprint), and the new-work / initial-work admission gates
 * (each request's bound blueprint).
 *
 * This suite exercises the REAL W2-A provider + the REAL engine + the REAL
 * remote surface / prober / creation preflight (no fakes at the seam —
 * only the readiness probe port is a scripted 3-state oracle, exactly as
 * the production CapabilityReadinessProvider observes the live substrate),
 * mirroring the inputs of the committed reproduction
 * (`dev/agent-workflow/evidence/pre-alpha3-refactor/pr-e/
 * pf1-intent-probe-feed-scoping/repro.mjs`): the row's three configured
 * MCP servers, the row's static seed facts, the boot anchor B0 (zero
 * requirements) and the main blueprint B1 (two REQUIRED mcp servers).
 *
 * P1 — multi-blueprint host, all-ready world: `intent.probe(B1)` is OPEN
 *      with both required MCPs PASS (NOT the pre-fix spurious FATAL);
 *      `intent.probe(B0)` is unchanged.
 * P2 — two-worlds identity (INV-9.4): one required server DOWN → the probe
 *      verdict and the creation-preflight verdict of B1 are EQUAL as typed
 *      outcomes (requirement-for-requirement, not just "both fatal").
 * P3 — the per-root prober factory scopes a created root bound to B1 to
 *      B1's own feed (healthy → NOT BLOCKED_FATAL; down → matches its own
 *      gate).
 * P4 — single-blueprint host regression pin (boot == probed): the verdicts
 *      are deep-equal between the per-blueprint seam and the legacy
 *      boot-scoped thunk (BYTE-IDENTICAL to the pre-fix verdicts).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and captures
 * its results; the `it` bodies are pure synchronous assertions.
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/requirement-probe-blueprint-scoping
 */

import { describe, expect, it } from 'vitest'

import { createS6RemotePorts } from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions, S6RemotePorts } from '../src/plugin/s6-remote.js'
import {
  createBlueprintCatalog,
  parseBlueprint,
} from '../../domain/blueprint/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import {
  COMPATIBILITY_REASON_CODES,
  COMPATIBILITY_STATUS,
} from '../../domain/compatibility/src/index.js'
import type {
  CompatibilityResult,
  EnvironmentFact,
} from '../../domain/compatibility/src/index.js'
import {
  createRuntimeRequirementFactsProvider,
} from '../requirement-facts/index.js'
import type { RuntimeRequirementFactsProvider } from '../requirement-facts/index.js'
import {
  PREFLIGHT_OUTCOMES,
  SCOPE_STATES,
  projectVerdicts,
  runCreationPreflight,
  scopeRequirementInputsOf,
  teamScope,
  scopeKey,
} from '../requirements/index.js'
import type { PreflightResult, RequirementVerdict } from '../requirements/index.js'
import {
  PROBE_TRIGGERS,
  createCompatibilityProber,
} from '../compatibility/index.js'
import type { ProbeOutcome } from '../compatibility/index.js'
import {
  PERSONA_OBSERVATION_SOURCES,
} from '../agent-setup/preset/index.js'
import type { PersonaKindObservation } from '../agent-setup/preset/index.js'
import {
  P6T1_FIXTURE,
  createP6T1World,
  destroyP6T1World,
} from './p6t1-helpers.js'

// --- the fixture world (the E.12 kit + repro.mjs shapes) ---------------------

/** The controlled clock (ISO-8601 UTC; provenance only). */
const PF1_NOW = '2026-09-30T00:00:00.000Z'

/** The remote surface root of the probe worlds (never bound in these tests). */
const PF1_ROOT = 'session-pf1-scoping'

/**
 * The row's configured MCP servers (the kit's `ROW_MCP_SERVERS`): the two
 * REQUIRED servers of B1 + the optional `mcp_web`. `mcp_signal` is
 * deliberately NEVER configured (the S2 supply-axis shape) — it appears in
 * the seed facts only (a seed fact without supply membership is inert for
 * a required requirement, as in the kit).
 */
const PF1_CONFIGURED_MCP_SERVERS: readonly string[] = ['mcp_repo', 'mcp_leaderreq', 'mcp_web']

/**
 * The row's static bootstrap seed (the kit's `factsAll` — the row
 * `config.environmentFacts`, generation 1): the ONLY seed role (it feeds
 * the engine for subjects whose live verdict is `unknown` and never
 * overrides a live verdict — the W2-A feed contract).
 */
const PF1_SEED_FACTS = [
  { domain: 'mcpServer', subject: 'mcp_repo', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'mcp_leaderreq', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'mcp_web', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'mcp_signal', available: true, generation: 1 },
]

/** The substrate plan persona observation (irrelevant to the verdicts — B0/B1 carry no persona requirement). */
const PF1_PERSONA: PersonaKindObservation = {
  kind: 'standard',
  source: PERSONA_OBSERVATION_SOURCES.effectiveComposition,
}

const PF1_BOILERPLATE = [
  'leader:',
  '  templateId: leader',
  '  persona: You lead the PF1 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: PF1 Worker',
  '    persona: You do the PF1 work.',
  'teamEnvelope:',
  '  allow:',
  '    - send-message',
  '    - report-progress',
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
  '    description: The PF1 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
]

/**
 * The BOOT anchor blueprint (the kit's `anchor` v1 boot): ZERO requirements
 * (`requirements: []`) — the multi-blueprint host shape that exposed PF-1
 * (the boot-scoped feed of a zero-requirement boot anchor is empty).
 */
const PF1_B0_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: pf1-b0',
  'revision: "1"',
  ...PF1_BOILERPLATE,
  'requirements: []',
  '---',
  '',
].join('\n')

/**
 * The MAIN blueprint (the kit's `prereq-main` shape, v1 bridge): two
 * REQUIRED mcpServer requirements (`mcp_repo` + `mcp_leaderreq`) — the
 * engine requirement ids bridge to `req-mcp-mcp_repo` /
 * `req-mcp-mcp_leaderreq` (the `req-<domain>-<name>` derivation).
 */
const PF1_B1_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: pf1-b1',
  'revision: "1"',
  ...PF1_BOILERPLATE,
  'requirements:',
  '  - domain: mcp',
  '    name: mcp_repo',
  '  - domain: mcp',
  '    name: mcp_leaderreq',
  '---',
  '',
].join('\n')

/** The parsed boot anchor (requirements: []). */
const PF1_B0: TeamBlueprint = parseBlueprint(PF1_B0_SOURCE)
/** The parsed main blueprint (two required mcp servers). */
const PF1_B1: TeamBlueprint = parseBlueprint(PF1_B1_SOURCE)

/** A REAL blueprint catalog holding BOTH blueprints (the multi-blueprint host). */
const PF1_CATALOG = createBlueprintCatalog([PF1_B0, PF1_B1])

/** The engine requirement id of one B1 requirement (the bridge derivation). */
const REPO_ID = 'req-mcp-mcp_repo'
const LEADERREQ_ID = 'req-mcp-mcp_leaderreq'

// --- the world factory (real provider + real seam wiring) --------------------

/** The 3-state readiness oracle (the scripted live-substrate observation). */
type VerdictFor = (subject: string) => 'reachable' | 'unreachable' | 'unknown'

/** One PF-1 test world (the real W2-A provider + the seam wirings under test). */
interface PF1World {
  /** The real live requirement-facts provider (the W2-A #40 source). */
  readonly provider: RuntimeRequirementFactsProvider
  /**
   * THE PF-1 FIX SEAM: the single dynamic per-blueprint live facts source
   * (the exact shape of the production root's `environmentFactsForBlueprint`
   * — the live provider resolved against the passed blueprint's OWN team
   * scope, fresh per call).
   */
  readonly source: (bp: TeamBlueprint) => Promise<readonly EnvironmentFact[]>
  /**
   * THE PRE-FIX FEED: the boot-blueprint-scoped thunk (the W3-A boot thunk
   * resolved against the BOOT anchor B0's team requirements = [] — the
   * mis-scoped feed that produced the spurious FATAL).
   */
  readonly bootScopedFeed: () => Promise<readonly EnvironmentFact[]>
  /** The fixed remote surface (item 1: `environmentFacts: source`). */
  readonly ports: S6RemotePorts
  /** The pre-fix-shaped remote surface (item 1 witness: `environmentFacts: bootScopedFeed`). */
  readonly legacyPorts: S6RemotePorts
  /** Every readiness probe call, in order (the liveness evidence). */
  readonly probeCalls: Array<{ readonly type: string; readonly subject: string }>
}

/** Build one world over the real provider with the scripted readiness oracle. */
function makePF1World(verdictFor: VerdictFor): PF1World {
  const probeCalls: Array<{ type: string; subject: string }> = []
  const provider = createRuntimeRequirementFactsProvider({
    configuredMcpServers: PF1_CONFIGURED_MCP_SERVERS,
    readiness: {
      probe: (type, name) => {
        probeCalls.push({ type, subject: name })
        return Promise.resolve({
          capabilityType: type,
          capabilityName: name,
          verdict: verdictFor(name),
          source: 'mcpFiber',
          observedAt: PF1_NOW,
        })
      },
    },
    seedFacts: PF1_SEED_FACTS,
    substratePlan: () =>
      Promise.resolve({
        root: { presetId: 'pf1-preset', persona: PF1_PERSONA },
        member: { presetId: 'pf1-preset', persona: PF1_PERSONA },
      }),
    now: () => PF1_NOW,
  })

  // THE SEAM (the production root's `environmentFactsForBlueprint`, verbatim
  // shape): the live provider resolved against the passed blueprint's OWN
  // team scope — fresh per call (never cached across calls).
  const source = (bp: TeamBlueprint): Promise<readonly EnvironmentFact[]> =>
    provider
      .resolveFacts({
        requirements: scopeRequirementInputsOf(bp).team,
        scope: { kind: 'team' },
      })
      .then((resolution) => resolution.environmentFacts)

  // THE PRE-FIX FEED: the same provider resolved against the BOOT anchor's
  // team requirements (zero on this host) — the W3-A boot-scoped thunk.
  const bootScopedFeed = (): Promise<readonly EnvironmentFact[]> => source(PF1_B0)

  const ports = createS6RemotePorts({
    rootSessionId: PF1_ROOT,
    catalog: PF1_CATALOG,
    blueprint: PF1_B0,
    environmentFacts: source,
  } as unknown as S6RemoteOptions)
  const legacyPorts = createS6RemotePorts({
    rootSessionId: PF1_ROOT,
    catalog: PF1_CATALOG,
    blueprint: PF1_B0,
    environmentFacts: bootScopedFeed,
  } as unknown as S6RemoteOptions)

  return { provider, source, bootScopedFeed, ports, legacyPorts, probeCalls }
}

/** Run one wire-level probe (the panel's call; the caller sends no facts). */
async function probeOf(ports: S6RemotePorts, blueprintId: string): Promise<CompatibilityResult> {
  return (await ports.intent.probe(blueprintId, 1, [])) as unknown as CompatibilityResult
}

/**
 * The production root's creation preflight feed wiring (root.ts: the fresh
 * per-scope feeds for THIS blueprint — the exact shape of the bound
 * blueprint's team feed + the pre-bind durable defaults: no consents, all
 * templates available).
 */
async function creationPreflightOf(
  world: PF1World,
  bp: TeamBlueprint,
): Promise<PreflightResult> {
  return runCreationPreflight({
    blueprint: bp,
    environmentFacts: () => world.source(bp),
    consents: [],
    availability: [],
  })
}

/** The team-scope verdict of one preflight result (the guard: exactly one). */
function teamVerdictOf(result: PreflightResult): PreflightResult['scopes'][number] {
  const scope = result.scopes.find((candidate) => scopeKey(candidate.scope) === scopeKey(teamScope()))
  if (scope === undefined) throw new Error('PF1 guard: the team scope verdict is missing')
  return scope
}

/** The engine requirement rows of a probe result, projected to the verdict shape. */
function verdictRowsOf(result: CompatibilityResult): readonly RequirementVerdict[] {
  return projectVerdicts(result)
}

// --- module-level scenario capture (top-level await) -------------------------

const PF1 = await (async () => {
  // --- World A: the all-ready world (configured + live-reachable) ---------
  const healthy = makePF1World(() => 'reachable')
  const a1 = await probeOf(healthy.ports, 'pf1-b1') // P1: the fixed probe of B1
  const a2 = await probeOf(healthy.ports, 'pf1-b0') // P1: the probe of B0 (unchanged)
  const a3 = await creationPreflightOf(healthy, PF1_B1) // P1: the same world's gate
  const a4 = await probeOf(healthy.legacyPorts, 'pf1-b1') // P1: the pre-fix wiring witness

  // --- World B: the down world (the required `mcp_repo` is unreachable) ---
  const down = makePF1World((subject) => (subject === 'mcp_repo' ? 'unreachable' : 'reachable'))
  const b1 = await probeOf(down.ports, 'pf1-b1') // P2: the probe verdict
  const b2 = await creationPreflightOf(down, PF1_B1) // P2: the creation-preflight verdict

  // --- P3: the per-root prober factory (the root.ts `compatibilityFor` ---
  // mirror: each created root's prober is scoped to THAT root's bound
  // blueprint B1 over the real durable P6-T1 world's repositories).
  const p3HealthyWorld = await createP6T1World('pf1-p3-healthy')
  const p3Healthy = makePF1World(() => 'reachable')
  const p3HealthyProber = createCompatibilityProber({
    repositories: p3HealthyWorld.domain.repositories,
    rootSessionId: String(P6T1_FIXTURE.rootSessionId),
    blueprint: PF1_B1,
    environmentFacts: () => p3Healthy.source(PF1_B1),
    now: () => PF1_NOW,
  })
  const p3HealthyOutcome = await p3HealthyProber.probe(PROBE_TRIGGERS.ROOT_COLD_RESUME)
  await destroyP6T1World(p3HealthyWorld)

  const p3LegacyWorld = await createP6T1World('pf1-p3-legacy')
  const p3Legacy = makePF1World(() => 'reachable')
  const p3LegacyProber = createCompatibilityProber({
    repositories: p3LegacyWorld.domain.repositories,
    rootSessionId: String(P6T1_FIXTURE.rootSessionId),
    blueprint: PF1_B1,
    // THE PRE-FIX FACTORY WIRING: the boot-scoped feed (the W3-A thunk
    // shared with every prober, regardless of the root's bound blueprint).
    environmentFacts: p3Legacy.bootScopedFeed,
    now: () => PF1_NOW,
  })
  const p3LegacyOutcome = await p3LegacyProber.probe(PROBE_TRIGGERS.ROOT_COLD_RESUME)
  await destroyP6T1World(p3LegacyWorld)

  const p3DownWorld = await createP6T1World('pf1-p3-down')
  const p3Down = makePF1World((subject) => (subject === 'mcp_repo' ? 'unreachable' : 'reachable'))
  const p3DownProber = createCompatibilityProber({
    repositories: p3DownWorld.domain.repositories,
    rootSessionId: String(P6T1_FIXTURE.rootSessionId),
    blueprint: PF1_B1,
    environmentFacts: () => p3Down.source(PF1_B1),
    now: () => PF1_NOW,
  })
  const p3DownOutcome = await p3DownProber.probe(PROBE_TRIGGERS.ROOT_COLD_RESUME)
  await destroyP6T1World(p3DownWorld)

  // --- World C: the single-blueprint host (boot == probed == B1) ----------
  // Pre-fix wiring: the boot thunk resolved against the BOOT blueprint (= B1
  // on this host) — the legacy no-argument thunk shape (t14h-compatible).
  // Post-fix wiring: the per-blueprint seam (called with the resolved B1).
  const singleHealthy = makePF1World(() => 'reachable')
  const c1Fixed = createS6RemotePorts({
    rootSessionId: PF1_ROOT,
    catalog: PF1_CATALOG,
    blueprint: PF1_B1,
    environmentFacts: singleHealthy.source,
  } as unknown as S6RemoteOptions)
  const c1Legacy = createS6RemotePorts({
    rootSessionId: PF1_ROOT,
    catalog: PF1_CATALOG,
    blueprint: PF1_B1,
    environmentFacts: (): Promise<readonly EnvironmentFact[]> => singleHealthy.source(PF1_B1),
  } as unknown as S6RemoteOptions)
  const c1a = await probeOf(c1Fixed, 'pf1-b1')
  const c1b = await probeOf(c1Legacy, 'pf1-b1')

  const singleDown = makePF1World((subject) => (subject === 'mcp_repo' ? 'unreachable' : 'reachable'))
  const c2Fixed = createS6RemotePorts({
    rootSessionId: PF1_ROOT,
    catalog: PF1_CATALOG,
    blueprint: PF1_B1,
    environmentFacts: singleDown.source,
  } as unknown as S6RemoteOptions)
  const c2Legacy = createS6RemotePorts({
    rootSessionId: PF1_ROOT,
    catalog: PF1_CATALOG,
    blueprint: PF1_B1,
    environmentFacts: (): Promise<readonly EnvironmentFact[]> => singleDown.source(PF1_B1),
  } as unknown as S6RemoteOptions)
  const c2a = await probeOf(c2Fixed, 'pf1-b1')
  const c2b = await probeOf(c2Legacy, 'pf1-b1')

  return { a1, a2, a3, a4, b1, b2, p3HealthyOutcome, p3LegacyOutcome, p3DownOutcome, c1a, c1b, c2a, c2b }
})()

// --- P1 — multi-blueprint host, all-ready world ------------------------------

describe('PF-1 P1 — the requested blueprint probes against its OWN feed (all-ready world)', () => {
  it('intent.probe(B1) is OPEN with both required MCPs PASS (NOT the pre-fix spurious FATAL)', () => {
    const probe = PF1.a1
    expect(probe.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(probe.counts.pass).toBe(2)
    expect(probe.counts.warning).toBe(0)
    expect(probe.counts.fatal).toBe(0)
    const repo = probe.requirements.find((row) => row.requirementId === REPO_ID)
    const leaderreq = probe.requirements.find((row) => row.requirementId === LEADERREQ_ID)
    if (repo === undefined || leaderreq === undefined) {
      throw new Error('PF1 guard: the B1 requirement rows are missing')
    }
    expect(repo.outcome).toBe('PASS')
    expect(repo.reasonCode).toBe(COMPATIBILITY_REASON_CODES.SATISFIED)
    expect(leaderreq.outcome).toBe('PASS')
    expect(leaderreq.reasonCode).toBe(COMPATIBILITY_REASON_CODES.SATISFIED)
  })

  it('intent.probe(B0) is UNCHANGED (zero requirements — OPEN, empty counts)', () => {
    const probe = PF1.a2
    expect(probe.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(probe.requirements.length).toBe(0)
    expect(probe.counts.pass).toBe(0)
    expect(probe.counts.warning).toBe(0)
    expect(probe.counts.fatal).toBe(0)
  })

  it('the creation preflight of B1 in the SAME world is PROCEED (two-worlds identity, green lane)', () => {
    const preflight = PF1.a3
    expect(preflight.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
    expect(preflight.fatalRequirementIds.length).toBe(0)
    expect(preflight.consentRequiredRequirementIds.length).toBe(0)
    expect(preflight.fixOrDisableRequirementIds.length).toBe(0)
    // the identity: the probe OPEN ⇔ the gate proceed (the same world).
    expect(PF1.a1.status).toBe(COMPATIBILITY_STATUS.OPEN)
  })

  it('witness: the pre-fix boot-scoped wiring still mis-probes B1 as FATAL in the same world (the world discriminates)', () => {
    // The exact pre-fix surface wiring (the boot-scoped feed, the zero-
    // requirement boot anchor) evaluates B1 against an EMPTY feed → the
    // engine "missing = unprobed" fail-closed → both required servers FATAL.
    // This is the PF-1 signature the fix removes from the production seam.
    const probe = PF1.a4
    expect(probe.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(probe.counts.fatal).toBe(2)
    for (const row of probe.requirements) {
      expect(row.outcome).toBe('FATAL')
      expect(row.reasonCode).toBe(COMPATIBILITY_REASON_CODES.COMPLETE_REQUIREMENT_NOT_MET)
    }
  })
})

// --- P2 — the frozen two-worlds identity (INV-9.4) ----------------------------

describe('PF-1 P2 — probe verdict == creation-preflight verdict (the down world)', () => {
  it('one required server down: the probe is BLOCKED_FATAL naming exactly that server', () => {
    const probe = PF1.b1
    expect(probe.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(probe.counts.fatal).toBe(1)
    expect(probe.counts.pass).toBe(1)
    const repo = probe.requirements.find((row) => row.requirementId === REPO_ID)
    const leaderreq = probe.requirements.find((row) => row.requirementId === LEADERREQ_ID)
    if (repo === undefined || leaderreq === undefined) {
      throw new Error('PF1 guard: the B1 requirement rows are missing')
    }
    expect(repo.outcome).toBe('FATAL')
    expect(repo.reasonCode).toBe(COMPATIBILITY_REASON_CODES.COMPLETE_REQUIREMENT_NOT_MET)
    expect([...repo.unavailableSubjects].sort()).toEqual(['mcp_repo'])
    expect(leaderreq.outcome).toBe('PASS')
  })

  it('the creation preflight of B1 in the SAME world is FATAL with the same requirement', () => {
    const preflight = PF1.b2
    expect(preflight.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect([...preflight.fatalRequirementIds].sort()).toEqual([REPO_ID])
    expect(teamVerdictOf(preflight).state).toBe(SCOPE_STATES.blocked)
  })

  it('the TYPED outcomes are equal requirement-for-requirement (not just "both fatal")', () => {
    const probe = PF1.b1
    const preflight = PF1.b2
    // The closed status ⇔ outcome correspondence (the two-worlds identity).
    expect(probe.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(preflight.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    // Requirement-for-requirement: the probe's engine rows (projected to
    // the verdict shape) equal the preflight team-scope verdicts — the
    // FATAL set, the WARNING set, and the PASS count.
    const team = teamVerdictOf(preflight)
    const rows = verdictRowsOf(probe)
    const fatalRows = rows.filter((row) => row.outcome === 'fatal')
    const warningRows = rows.filter((row) => row.outcome === 'warning')
    expect([...team.fatal].map((verdict) => ({ ...verdict, unavailableSubjects: [...verdict.unavailableSubjects] }))).toEqual(
      fatalRows.map((row) => ({ ...row, unavailableSubjects: [...row.unavailableSubjects] })),
    )
    expect([...team.warnings]).toEqual(warningRows)
    expect(team.passCount).toBe(rows.filter((row) => row.outcome === 'pass').length)
  })
})

// --- P3 — the per-root prober factory (the created root's own blueprint) -----

describe('PF-1 P3 — the per-root prober is scoped to the created root\'s bound blueprint', () => {
  it('healthy world: the B1-bound root probes OPEN (NOT BLOCKED_FATAL)', () => {
    const outcome = PF1.p3HealthyOutcome
    expect(outcome.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(outcome.fatal).toBe(0)
    expect(outcome.pass).toBe(2)
  })

  it('down world: the B1-bound root matches its OWN gate (BLOCKED_FATAL, one fatal)', () => {
    const outcome = PF1.p3DownOutcome
    const preflight = PF1.b2
    expect(outcome.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(outcome.fatal).toBe(1)
    expect(outcome.pass).toBe(1)
    // Matches its own gate: the same typed verdict as the creation
    // preflight of its blueprint in the same world.
    expect(preflight.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(outcome.fatal).toBe(preflight.fatalRequirementIds.length)
  })

  it('witness: the pre-fix factory wiring (boot-scoped feed) mis-probes the healthy B1-bound root as FATAL', () => {
    const outcome = PF1.p3LegacyOutcome
    expect(outcome.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(outcome.fatal).toBe(2)
  })
})

// --- P4 — the single-blueprint regression pin ---------------------------------

describe('PF-1 P4 — single-blueprint host (boot == probed): BYTE-IDENTICAL verdicts', () => {
  it('all-ready world: the per-blueprint seam verdict deep-equals the legacy boot-thunk verdict', () => {
    // On a single-blueprint host the pre-fix boot thunk resolved the
    // provider against the boot blueprint (= the probed B1) — the per-
    // blueprint seam called with B1 is the SAME feed. The FULL typed
    // result (status, counts, fingerprint, per-requirement rows) is
    // deep-equal: the fix changes nothing here (invariant a).
    expect(PF1.c1a).toEqual(PF1.c1b)
  })

  it('down world: the same identity holds on the drifted environment', () => {
    expect(PF1.c2a).toEqual(PF1.c2b)
  })
})

// --- type guard (the ProbeOutcome is consumed, not a lint hole) ---------------

describe('PF-1 guards — the captured shapes are the typed surfaces', () => {
  it('the per-root probe outcomes are typed ProbeOutcomes over the closed trigger set', () => {
    const outcomes: readonly ProbeOutcome[] = [
      PF1.p3HealthyOutcome,
      PF1.p3LegacyOutcome,
      PF1.p3DownOutcome,
    ]
    for (const outcome of outcomes) {
      expect(outcome.trigger).toBe(PROBE_TRIGGERS.ROOT_COLD_RESUME)
      expect(outcome.generation).toBeGreaterThan(0)
    }
  })
})
