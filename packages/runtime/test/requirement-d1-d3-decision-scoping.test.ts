/**
 * pre-alpha3 PR-E, D-1 + D-3 (2026-09-30, adjudicated product decisions) —
 * the DECISION-path scoping and the fail-closed PENDING semantics.
 *
 * D-1 (the PF-1 family extended to the activation provider): the W3-A
 * boot-scoped thunk resolved the live provider against the BOOT blueprint
 * and was shared with every consumer that evaluates an ARBITRARY
 * blueprint's requirements — the router / admit gates, the remote probe,
 * the per-root prober (all fixed in the pass-3a PF-1 commit) AND the
 * ACTIVATION PROVIDER's step 6 (this commit): a multi-blueprint host
 * evaluated the target root's requirements against the boot blueprint's
 * feed → spurious FATAL + corrupted durable aggregates.
 *
 * D-3 (product semantics adjudicated: FAIL CLOSED with a typed PENDING
 * block): a REQUIRED applicable requirement whose LIVE observation is
 * `unknown` (materialization slot pending / not yet probed) is a TYPED
 * BLOCK — the closed typed-code family of {@link PENDING_BLOCK} (wire code
 * stays `COMPATIBILITY_BLOCKED`; the category rides the typed details).
 * NEVER a seed-filled PASS (the static seed is bootstrap/display only,
 * guide §2.5; plan §C.3 禁止 false OPEN + E.3 "no false OPEN" + E.11
 * negative #10 "readiness 重置 unknown"). The block is RECHECKABLE by
 * construction (a verdict, not a write — it clears on the next boundary or
 * via the compatibility reprobe; a stuck slot is honest, not a deadlock).
 * The COLD-member `not-applicable` exemption (E.11 negative #1, guide
 * §2.5.4) lives in the shared classifier — applicability gates before
 * readiness; a cold member's first delegate is never PENDING-blocked.
 *
 * PROBEABLE SCOPING (D-3 narrowing, 2026-09-30 — parent adjudication
 * option 1): D-3 targets the TRANSIENT window only — a REQUIRED subject
 * whose capability type has a live probe port REGISTERED (the
 * deterministic STRUCTURAL fact on the observation, `probeable` — absent
 * = probeable) and whose live observation has not settled. A required
 * `unknown` of a NON-probeable type (no live probe port — structurally
 * unobservable live; the documented known gap, e.g. `skill`/`tool`/
 * `modelRoute`/`teamStructure` in the production host, which registers
 * only the `mcpServer` port) is NOT pending: it keeps the legacy
 * seed-satisfied 2-state (the pre-W2-A behavior preserved deliberately).
 * The classifier and the probe drop-filter consume the SAME structural
 * fact (one source of truth — the host's probe-port registry via the
 * readiness port's `hasProbe` query; no duplicated type list). This suite
 * exercises the mcpServer (probeable) and persona (frozen U5) domains, so
 * its assertions are UNAFFECTED by the narrowing — the readiness doubles
 * here predate the `hasProbe` query and are treated as fully probeable
 * (the documented conservative default).
 *
 * PF-2 TRI-STATE (2026-09-30 — parent adjudication option A, the first-
 * create bootstrap exemption at the shared feed/classifier level): an
 * unsettled REQUIRED observation carries an `observationState` —
 * `in-flight` (a pending materialization slot exists on a live session;
 * the PENDING window) or `never-observed` (no fiber / pending slot /
 * failed slot on ANY live session — the first-create bootstrap window).
 * Only `never-observed` exempts: the seed-satisfied 2-state stands there
 * and the seed's TRUTH decides (C.2/E.6 — available `true` → proceed,
 * `false`/absent → FATAL — NOT a blanket OPEN). ABSENT state = in-flight
 * (the conservative default — the pre-tri-state D-3 semantics stand
 * byte-identically on the legacy doubles and every existing test). The
 * ONE shared classifier predicate (`isPendingWindow`) is the single
 * decision: the gate, the preflight, the activation step and the probe
 * drop-filter all inherit it (probe == gate, INV-9.4 RESTORED AND
 * MAINTAINED — the pre-fix probe/gate divergence in the never-observed
 * world was the mcp-domain FATAL/OPEN split). Section G (X1–X5) pins the
 * tri-state at unit level; the host's discriminator (the per-live-session
 * fiber / slot / consumption-view scan that WRITES the state) is pinned by
 * the E.12 kit.
 *
 * Sections:
 *   A — the shared classifier (pure unit: pending / down / cold exemption).
 *   B — the probe's seed-filled-fact drop filter (pure unit; U5 frozen —
 *       the persona domain is never touched).
 *   C — the requirement GATE (real repositories + real engine): PENDING at
 *       the next boundary, the seeded false-OPEN witness, the recheck
 *       clearing it, the no-seed FATAL reclassification, the down
 *       precedence, and the cold / resuming / failed-slot template worlds
 *       (E.11 #1 + the kit B5 dual assertion, unit level).
 *   D — the activation PROVIDER step 6 (real durable world): the D-1
 *       per-blueprint discriminator (legacy boot-scoped wiring still
 *       FATALs; the per-blueprint seam passes), the inverted durable
 *       aggregate (all-up world + reprobe → the durable row stays /
 *       rewrites OPEN, never FATAL), and the D-3 PENDING at the provider
 *       (seeded / no-seed / v2-template / cold negative).
 *   E — the creation PREFLIGHT: the `pending` outcome, the down > pending
 *       > consentRequired precedence, the no-seed reclassifications, and
 *       the disabled-template exclusion.
 *   F — the s6 PROBE (the faithful, STRICTER predictor): a required
 *       live-unknown fact is dropped → the engine missing FATAL →
 *       BLOCKED_FATAL predicts the gate's PENDING block (INV-9.4: complete
 *       the observation, not weaken the verdict); the seeded false-OPEN
 *       witness on the legacy wiring; the persona domain untouched.
 *   G — the PF-2 tri-state (X1–X5): NEVER-OBSERVED is seed-satisfied (the
 *       seed truth decides — proceed / FATAL, never a blanket OPEN and
 *       never PENDING); IN-FLIGHT stays PENDING (B5 preserved); the
 *       settled pins are unchanged.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and captures
 * its results; the `it` bodies are pure synchronous assertions.
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/requirement-d1-d3-decision-scoping
 */

import { describe, expect, it } from 'vitest'

import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import {
  createBlueprintCatalog,
  parseBlueprint,
} from '../../domain/blueprint/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import {
  COMPATIBILITY_REASON_CODES,
  COMPATIBILITY_STATUS,
} from '../../domain/compatibility/src/index.js'
import type { CompatibilityResult, EnvironmentFact, RequirementInput } from '../../domain/compatibility/src/index.js'
import {
  createRuntimeRequirementFactsProvider,
  classifyScopeReadiness,
  dropSeedFilledPendingFacts,
  requirementFactScopeRoleOf,
} from '../requirement-facts/index.js'
import type {
  RequirementFactsResolution,
  RequirementObservation,
} from '../requirement-facts/index.js'
import {
  PENDING_BLOCK,
  PREFLIGHT_OUTCOMES,
  SCOPE_STATES,
  normalWorkImpact,
  runCreationPreflight,
  scopeRequirementInputsOf,
  scopeKey,
  teamScope,
  templateScope,
} from '../requirements/index.js'
import type { PreflightResult } from '../requirements/index.js'
import {
  TEAM_RUNTIME_ERROR_CODES,
  TeamRuntimeError,
  enforceRequirementGate,
} from '../admission/index.js'
import { ACTIVATION_ERROR_CODES, ACTIVATION_SOURCES, ActivationError, createActivationProvider } from '../activation/index.js'
import {
  PROBE_TRIGGERS,
  createCompatibilityProber,
} from '../compatibility/index.js'
import { MEMBER_LIVENESS, MATERIALIZATION_STATES } from '../readiness/index.js'
import { PERSONA_OBSERVATION_SOURCES } from '../agent-setup/preset/index.js'
import type { PersonaKindObservation } from '../agent-setup/preset/index.js'
import {
  FakeChildSessionFactory,
  P6T1_FIXTURE,
  P6T1_FIXTURE_STATIC_MODEL,
  createP6T1World,
  destroyP6T1World,
  makeExternalPolicyFacts,
} from './p6t1-helpers.js'
import { FakeAgentSetupSurface } from './p5t1-helpers.js'
import { FakeSessionDurability } from './p5t6-helpers.js'
import { createS6RemotePorts } from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions, S6RemotePorts } from '../src/plugin/s6-remote.js'

// --- the controlled clock + identities ----------------------------------------

const NOW = '2026-09-30T00:00:00.000Z'

/** The P6-T1 fixture root (the durable worlds' TeamSession id). */
const ROOT = String(P6T1_FIXTURE.rootSessionId)

// --- the blueprint fixtures (the E.12 kit + repro shapes) ----------------------

const BOILERPLATE = [
  'leader:',
  '  templateId: leader',
  '  persona: You lead the D suite team.',
  'members:',
  '  - templateId: worker',
  '    displayName: D Worker',
  '    persona: You do the D work.',
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
  '    description: The D default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
]

/** The BOOT anchor (zero requirements — the multi-blueprint host shape). */
const B0_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: d-b0',
  'revision: "1"',
  ...BOILERPLATE,
  'requirements: []',
  '---',
  '',
].join('\n')

/** The MAIN blueprint (v1 bridge): two REQUIRED mcp servers. */
const B1_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: d-b1',
  'revision: "1"',
  ...BOILERPLATE,
  'requirements:',
  '  - domain: mcp',
  '    name: mcp_repo',
  '  - domain: mcp',
  '    name: mcp_leaderreq',
  '---',
  '',
].join('\n')

/** MAIN + the OPTIONAL (unconsented-warning) `mcp_signal` (the E.4 shape). */
const B1C_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: d-b1c',
  'revision: "1"',
  ...BOILERPLATE,
  'requirements:',
  '  - domain: mcp',
  '    name: mcp_repo',
  '  - domain: mcp',
  '    name: mcp_leaderreq',
  '  - domain: mcp',
  '    name: mcp_signal',
  '    optional: true',
  '---',
  '',
].join('\n')

/** MAIN + the REQUIRED persona `d-other-preset` (the F.4 shape — U5 frozen). */
const B1P_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: d-b1p',
  'revision: "1"',
  ...BOILERPLATE,
  'requirements:',
  '  - domain: mcp',
  '    name: mcp_repo',
  '  - domain: mcp',
  '    name: mcp_leaderreq',
  '  - domain: persona',
  '    name: d-other-preset',
  '---',
  '',
].join('\n')

/**
 * The V2 blueprint (the closed §E.2 document): the team scope requires
 * `mcp_repo`; the `worker` TEMPLATE scope requires `mcp_web` (the cold /
 * resuming / failed-slot materialization-axis worlds).
 */
const V2_SOURCE = [
  '---',
  'schemaVersion: 2',
  'blueprintId: d-v2',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the D V2 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: D V2 Worker',
  '    persona: You do the D V2 work.',
  '    requirements:',
  '      - requirementId: req-mcp-mcp_web-worker',
  '        type: mcpServer',
  '        subjects:',
  '          - mcp_web',
  '        complete: true',
  'requirements: []',
  'teamRequirements:',
  '  - requirementId: req-mcp-mcp_repo',
  '    type: mcpServer',
  '    subjects:',
  '      - mcp_repo',
  '    complete: true',
  'teamEnvelope:',
  '  allow:',
  '    - send-message',
  '    - report-progress',
  '  deny: []',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The D V2 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
  '',
].join('\n')

const B0 = parseBlueprint(B0_SOURCE)
const B1 = parseBlueprint(B1_SOURCE)
const B1C = parseBlueprint(B1C_SOURCE)
const B1P = parseBlueprint(B1P_SOURCE)
const V2 = parseBlueprint(V2_SOURCE)

/** The S6 probe worlds' catalog (every probed blueprint resolvable). */
const PROBE_CATALOG = createBlueprintCatalog([B0, B1, B1C, B1P, V2])

// --- the engine requirement ids (the bridge derivation) ------------------------

const REPO_ID = 'req-mcp-mcp_repo'
const LEADERREQ_ID = 'req-mcp-mcp_leaderreq'
const SIGNAL_ID = 'req-mcp-mcp_signal'
const PERSONA_ID = 'req-persona-d-other-preset'
const WEB_ID = 'req-mcp-mcp_web-worker'

// --- the row world (supply + seed) ---------------------------------------------

/** The row's configured MCP servers (`mcp_signal` is NEVER configured). */
const CONFIGURED_MCP_SERVERS: readonly string[] = ['mcp_repo', 'mcp_leaderreq', 'mcp_web']

/** The row's static bootstrap SEED (the ONLY seed role — never a verdict). */
const SEED_ALL = [
  { domain: 'mcpServer', subject: 'mcp_repo', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'mcp_leaderreq', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'mcp_web', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'mcp_signal', available: true, generation: 1 },
  { domain: 'persona', subject: 'd-other-preset', available: true, generation: 1 },
]

/** The seed WITHOUT `mcp_repo` (the no-seed reclassification worlds). */
const SEED_NO_REPO = SEED_ALL.filter((fact) => fact.subject !== 'mcp_repo')

const PERSONA: PersonaKindObservation = {
  kind: 'standard',
  source: PERSONA_OBSERVATION_SOURCES.effectiveComposition,
}

// --- the world factory (real provider + scripted 3-state oracle) ---------------

type Verdict = 'reachable' | 'unreachable' | 'unknown'
type VerdictFor = (subject: string) => Verdict

interface WorkerView {
  readonly liveness: (typeof MEMBER_LIVENESS)[keyof typeof MEMBER_LIVENESS]
  readonly mcpSlots: ReadonlyMap<string, { readonly status: 'mounted' | 'failed' }>
}

/** The scripted live-substrate world (the real W2-A provider, no fakes at the seam). */
interface DWorld {
  readonly provider: ReturnType<typeof createRuntimeRequirementFactsProvider>
  /** The D-1 per-blueprint FEED seam (facts only). */
  readonly source: (bp: TeamBlueprint) => Promise<readonly EnvironmentFact[]>
  /** The D-3 per-blueprint FULL-RESOLUTION read seam (the atomic pair). */
  readonly readSource: (bp: TeamBlueprint) => Promise<RequirementFactsResolution>
  /** The template-scope FULL-RESOLUTION read seam (D-3). */
  readonly templateReadSource: (bp: TeamBlueprint, templateId: string) => Promise<RequirementFactsResolution>
  /** The legacy PRE-FIX feed: the boot anchor B0's team scope (empty feed). */
  readonly bootScopedFeed: () => Promise<readonly EnvironmentFact[]>
}

/**
 * Build one scripted world. The oracle is a MUTABLE holder (the `set` seam
 * models "seconds later the slot materializes / fails" — the recheck).
 */
function makeDWorld(opts: {
  readonly verdictFor: { current: VerdictFor; set: (next: VerdictFor) => void }
  readonly seed?: readonly { domain: string; subject: string; available: boolean; generation: number }[]
  readonly workerView?: () => WorkerView
  /** PF-2 tri-state (the X-worlds): the observation state of an UNSETTLED
   *  verdict ('never-observed' / 'in-flight'); undefined = the legacy bare
   *  verdict (the in-flight conservative default). */
  readonly observationStateFor?: (subject: string) => 'never-observed' | 'in-flight' | undefined
}): DWorld {
  const seed = opts.seed ?? SEED_ALL
  const workerView = opts.workerView
  const provider = createRuntimeRequirementFactsProvider({
    configuredMcpServers: CONFIGURED_MCP_SERVERS,
    readiness: {
      probe: (type, name) => {
        const verdict = opts.verdictFor.current(name)
        const observationState =
          verdict === 'unknown' && opts.observationStateFor !== undefined
            ? opts.observationStateFor(name)
            : undefined
        return Promise.resolve({
          capabilityType: type,
          capabilityName: name,
          verdict,
          source: 'mcpFiber',
          observedAt: NOW,
          ...(observationState !== undefined ? { observationState } : {}),
        })
      },
    },
    seedFacts: seed,
    ...(workerView !== undefined
      ? {
          memberMaterialization: (scope) =>
            scope.kind === 'template'
              ? Promise.resolve(workerView())
              : Promise.resolve(undefined),
        }
      : {}),
    substratePlan: () =>
      Promise.resolve({
        root: { presetId: 'd-preset', persona: PERSONA },
        member: { presetId: 'd-preset', persona: PERSONA },
      }),
    now: () => NOW,
  })

  const teamRead = (bp: TeamBlueprint): Promise<RequirementFactsResolution> =>
    provider.resolveFacts({
      requirements: scopeRequirementInputsOf(bp).team,
      scope: { kind: 'team' },
    })
  const source = (bp: TeamBlueprint): Promise<readonly EnvironmentFact[]> =>
    teamRead(bp).then((resolution) => resolution.environmentFacts)
  const templateReadSource = (bp: TeamBlueprint, templateId: string): Promise<RequirementFactsResolution> =>
    provider.resolveFacts({
      requirements: scopeRequirementInputsOf(bp).templates[templateId] ?? [],
      // Blocker-1: the template scope carries its role identity (the bound
      // blueprint knows its leader template id — the leader IS the root:
      // the root mounts config.rootPresetId; the member is the MEMBER entry,
      // plan §C.2 R8).
      scope: { kind: 'template', templateId, role: requirementFactScopeRoleOf(bp.leader.templateId, templateId) },
    })

  return {
    provider,
    source,
    readSource: teamRead,
    templateReadSource,
    bootScopedFeed: () => teamRead(B0).then((resolution) => resolution.environmentFacts),
  }
}

/** Capture a thrown error as {thrown:true, error} or {thrown:false, result}. */
async function capture<T>(fn: () => Promise<T>): Promise<{ thrown: true; error: unknown } | { thrown: false; result: T }> {
  try {
    return { thrown: false, result: await fn() }
  } catch (error) {
    return { thrown: true, error }
  }
}

// --- module-level scenario capture (top-level await) ---------------------------

const D = await (async () => {
  // ============================ C — the requirement GATE ======================

  // The gate worlds (the REAL P6-T1 durable repositories, the root bound to
  // the blueprint under test). One world per scenario shape.
  const c1World = await createP6T1World('d-c1-gate-pending', { blueprintSource: B1_SOURCE })
  const c1Oracle: VerdictFor = (subject) => (subject === 'mcp_repo' ? 'unknown' : 'reachable')
  const c1D = makeDWorld({ verdictFor: { current: c1Oracle, set: () => {} } })
  const c1Gate = {
    repositories: c1World.domain.repositories,
    blueprint: B1,
    rootSessionId: ROOT,
    now: () => NOW,
  }
  // C1: the D-3 wiring (the full-resolution read port) — the PENDING block.
  const c1 = await capture(() =>
    enforceRequirementGate(
      {
        ...c1Gate,
        environmentFacts: () => c1D.source(B1),
        environmentFactsRead: () => c1D.readSource(B1),
      },
      normalWorkImpact(),
    ),
  )
  // C2: the SAME world on the LEGACY wiring (facts only, no read port) — the
  // seeded false OPEN (the pre-D-3 signature the rule removes).
  const c2 = await capture(() =>
    enforceRequirementGate({ ...c1Gate, environmentFacts: () => c1D.source(B1) }, normalWorkImpact()),
  )
  // C3: the RECHECK — the same world, the slot observed seconds later
  // (the oracle flips to reachable; the next boundary re-evaluates fresh).
  // The single mutable holder both gate calls close over (the recheck).
  const c3Mutable: { current: VerdictFor } = { current: (s) => (s === 'mcp_repo' ? 'unknown' : 'reachable') }
  const c3D = makeDWorld({ verdictFor: { current: (s) => c3Mutable.current(s), set: (n) => (c3Mutable.current = n) } })
  const c3Gate = {
    repositories: c1World.domain.repositories,
    blueprint: B1,
    rootSessionId: ROOT,
    now: () => NOW,
  }
  const c3a = await capture(() =>
    enforceRequirementGate(
      {
        ...c3Gate,
        environmentFacts: () => c3D.source(B1),
        environmentFactsRead: () => c3D.readSource(B1),
      },
      normalWorkImpact(),
    ),
  )
  c3Mutable.current = () => 'reachable' // the slot is observed: the recheck
  const c3b = await capture(() =>
    enforceRequirementGate(
      {
        ...c3Gate,
        environmentFacts: () => c3D.source(B1),
        environmentFactsRead: () => c3D.readSource(B1),
      },
      normalWorkImpact(),
    ),
  )

  // C4: the NO-SEED reclassification (the engine missing FATAL is honest
  // PENDING on the D-3 wiring; the legacy wiring keeps the FATAL).
  const c4D = makeDWorld({
    seed: SEED_NO_REPO,
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'unknown' : 'reachable'), set: () => {} },
  })
  const c4Gate = {
    repositories: c1World.domain.repositories,
    blueprint: B1,
    rootSessionId: ROOT,
    now: () => NOW,
  }
  const c4Fixed = await capture(() =>
    enforceRequirementGate(
      {
        ...c4Gate,
        environmentFacts: () => c4D.source(B1),
        environmentFactsRead: () => c4D.readSource(B1),
      },
      normalWorkImpact(),
    ),
  )
  const c4Legacy = await capture(() =>
    enforceRequirementGate({ ...c4Gate, environmentFacts: () => c4D.source(B1) }, normalWorkImpact()),
  )

  // C5: the DOWN precedence (a confirmed down + a sibling still unknown:
  // the actionable FATAL-down block stands, the pending is subsumed).
  const c5D = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'unreachable' : s === 'mcp_leaderreq' ? 'unknown' : 'reachable'), set: () => {} },
  })
  const c5Gate = {
    repositories: c1World.domain.repositories,
    blueprint: B1,
    rootSessionId: ROOT,
    now: () => NOW,
  }
  const c5 = await capture(() =>
    enforceRequirementGate(
      {
        ...c5Gate,
        environmentFacts: () => c5D.source(B1),
        environmentFactsRead: () => c5D.readSource(B1),
      },
      normalWorkImpact(),
    ),
  )

  // C6/C7/C8: the V2 template-scope worlds (the materialization axis):
  // the cold worker (E.11 #1), the resuming worker (B5 first half), the
  // resident failed-slot worker (B5 second half).
  const v2World = await createP6T1World('d-c6-v2-template', { blueprintSource: V2_SOURCE })
  const v2Gate = {
    repositories: v2World.domain.repositories,
    blueprint: V2,
    rootSessionId: ROOT,
    now: () => NOW,
  }
  const delegateImpact = normalWorkImpact([teamScope(), templateScope('worker')])

  const c6D = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'reachable' : 'unknown'), set: () => {} },
    workerView: () => ({ liveness: MEMBER_LIVENESS.cold, mcpSlots: new Map() }),
  })
  const c6Fixed = await capture(() =>
    enforceRequirementGate(
      {
        ...v2Gate,
        environmentFacts: () => c6D.source(V2),
        environmentFactsRead: () => c6D.readSource(V2),
        templateEnvironmentFactsRead: (templateId) => c6D.templateReadSource(V2, templateId),
      },
      delegateImpact,
    ),
  )
  const c6Legacy = await capture(() =>
    enforceRequirementGate(
      {
        ...v2Gate,
        environmentFacts: () => c6D.source(V2),
        templateEnvironmentFacts: (templateId) => c6D.templateReadSource(V2, templateId).then((r) => r.environmentFacts),
      },
      delegateImpact,
    ),
  )

  const c7D = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'reachable' : 'unknown'), set: () => {} },
    workerView: () => ({ liveness: MEMBER_LIVENESS.resuming, mcpSlots: new Map() }),
  })
  const c7 = await capture(() =>
    enforceRequirementGate(
      {
        ...v2Gate,
        environmentFacts: () => c7D.source(V2),
        environmentFactsRead: () => c7D.readSource(V2),
        templateEnvironmentFactsRead: (templateId) => c7D.templateReadSource(V2, templateId),
      },
      delegateImpact,
    ),
  )

  const c8D = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'reachable' : 'unreachable'), set: () => {} },
    workerView: () => ({
      liveness: MEMBER_LIVENESS.resident,
      mcpSlots: new Map([['mcp_web', { status: 'failed' as const, attempts: 3 }]]),
    }),
  })
  const c8 = await capture(() =>
    enforceRequirementGate(
      {
        ...v2Gate,
        environmentFacts: () => c8D.source(V2),
        environmentFactsRead: () => c8D.readSource(V2),
        templateEnvironmentFactsRead: (templateId) => c8D.templateReadSource(V2, templateId),
      },
      delegateImpact,
    ),
  )
  await destroyP6T1World(c1World)
  await destroyP6T1World(v2World)

  // ============================ D — the activation PROVIDER ===================

  // D1: the D-1 discriminator (the same healthy world, the same target root
  // bound to B1): the LEGACY boot-scoped wiring FATALs step 6 (the pre-fix
  // signature); the PER-BLUEPRINT seam passes.
  const d1World = await createP6T1World('d-d1-provider', { blueprintSource: B1_SOURCE, catalogExtra: [B0] })
  const d1D = makeDWorld({ verdictFor: { current: () => 'reachable', set: () => {} } })
  const d1BasePorts = {
    teamDomain: d1World.domain,
    blueprintCatalog: d1World.catalog,
    externalPolicyFacts: () => Promise.resolve(makeExternalPolicyFacts()),
    staticModel: { ...P6T1_FIXTURE_STATIC_MODEL },
    childSessionFactory: new FakeChildSessionFactory(),
    sessionDurability: new FakeSessionDurability(),
    surface: new FakeAgentSetupSurface(),
    now: () => NOW,
  }
  const d1LegacyProvider = createActivationProvider({
    ...d1BasePorts,
    // THE PRE-FIX WIRING: only the boot-scoped thunk (the W3-A thunk
    // resolved against the boot anchor B0's team requirements = []).
    environmentFacts: () => d1D.bootScopedFeed(),
  })
  const d1FixedProvider = createActivationProvider({
    ...d1BasePorts,
    // The boot thunk stays (the factory-world fallback, byte-identical) —
    // the per-blueprint port takes precedence in step 6 (D-1).
    environmentFacts: () => d1D.bootScopedFeed(),
    environmentFactsForBlueprint: (bp) => d1D.source(bp),
    templateEnvironmentFactsForBlueprint: (bp, templateId) =>
      d1D.templateReadSource(bp, templateId).then((r) => r.environmentFacts),
  })
  const d1Request = (token: string) => ({
    rootSessionId: ROOT,
    source: ACTIVATION_SOURCES.LEADER_EXPLICIT,
    templateId: 'worker',
    label: 'd1-member',
    requestToken: token,
    callerId: String(LEADER_INSTANCE_ID),
  })
  const d1a = await capture(() => d1LegacyProvider.activate(d1Request('tok-d1a')))
  const d1b = await capture(() => d1FixedProvider.activate(d1Request('tok-d1b')))

  // D1c: the inverted durable aggregate — the per-root prober on the SAME
  // healthy world (all-up): probe → the durable row is OPEN; REPROBE → the
  // row rewrites OPEN (the generation advances, the status never inverts
  // to FATAL). The witness: the boot-scoped feed prober (pre-fix) inverts.
  const d1cProber = createCompatibilityProber({
    repositories: d1World.domain.repositories,
    rootSessionId: ROOT,
    blueprint: B1,
    environmentFacts: () => d1D.source(B1),
    now: () => NOW,
  })
  const d1cFirstProbe = await d1cProber.probe(PROBE_TRIGGERS.ROOT_COLD_RESUME)
  const d1cRecordFirst = await d1cProber.current()
  if (d1cRecordFirst === undefined) throw new Error('D guard: D1c the durable row is missing after probe 1')
  const d1cSecondProbe = await d1cProber.probe(PROBE_TRIGGERS.ROOT_COLD_RESUME)
  const d1cRecordSecond = await d1cProber.current()
  if (d1cRecordSecond === undefined) throw new Error('D guard: D1c the durable row is missing after the reprobe')
  const d1cWitnessProber = createCompatibilityProber({
    repositories: d1World.domain.repositories,
    rootSessionId: ROOT,
    blueprint: B1,
    // THE PRE-FIX WIRING: the boot-scoped feed (the zero-requirement B0).
    environmentFacts: () => d1D.bootScopedFeed(),
    now: () => NOW,
  })
  const d1cWitness = await d1cWitnessProber.probe(PROBE_TRIGGERS.ROOT_COLD_RESUME)

  // D3: the PENDING at the provider (step 6), on the per-blueprint seam.
  const d3World = await createP6T1World('d-d3-provider-pending', { blueprintSource: B1_SOURCE, catalogExtra: [B0] })
  const d3D = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'unknown' : 'reachable'), set: () => {} },
  })
  const d3Provider = createActivationProvider({
    teamDomain: d3World.domain,
    blueprintCatalog: d3World.catalog,
    environmentFacts: () => d3D.bootScopedFeed(),
    environmentFactsForBlueprint: (bp) => d3D.source(bp),
    templateEnvironmentFactsForBlueprint: (bp, templateId) =>
      d3D.templateReadSource(bp, templateId).then((r) => r.environmentFacts),
    environmentFactsReadForBlueprint: (bp) => d3D.readSource(bp),
    templateEnvironmentFactsReadForBlueprint: (bp, templateId) => d3D.templateReadSource(bp, templateId),
    externalPolicyFacts: () => Promise.resolve(makeExternalPolicyFacts()),
    staticModel: { ...P6T1_FIXTURE_STATIC_MODEL },
    childSessionFactory: new FakeChildSessionFactory(),
    sessionDurability: new FakeSessionDurability(),
    surface: new FakeAgentSetupSurface(),
    now: () => NOW,
  })
  const d3a = await capture(() => d3Provider.activate(d1Request('tok-d3a')))
  // D3b: the no-seed reclassification (the engine missing FATAL is honest
  // PENDING — the block stands, the category is honest).
  const d3bWorld = await createP6T1World('d-d3-provider-noseed', { blueprintSource: B1_SOURCE, catalogExtra: [B0] })
  const d3bD = makeDWorld({
    seed: SEED_NO_REPO,
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'unknown' : 'reachable'), set: () => {} },
  })
  const d3bProvider = createActivationProvider({
    teamDomain: d3bWorld.domain,
    blueprintCatalog: d3bWorld.catalog,
    environmentFacts: () => d3bD.bootScopedFeed(),
    environmentFactsForBlueprint: (bp) => d3bD.source(bp),
    environmentFactsReadForBlueprint: (bp) => d3bD.readSource(bp),
    externalPolicyFacts: () => Promise.resolve(makeExternalPolicyFacts()),
    staticModel: { ...P6T1_FIXTURE_STATIC_MODEL },
    childSessionFactory: new FakeChildSessionFactory(),
    sessionDurability: new FakeSessionDurability(),
    surface: new FakeAgentSetupSurface(),
    now: () => NOW,
  })
  const d3b = await capture(() => d3bProvider.activate(d1Request('tok-d3b')))

  // D3c/D3d: the V2 template scope (the worker materialization axis):
  // resuming → the trailing PENDING (the engine PASS is voided); cold →
  // the exemption (the first delegate is never PENDING-blocked, E.11 #1).
  const d3cWorld = await createP6T1World('d-d3c-v2-resuming', { blueprintSource: V2_SOURCE })
  const d3cD = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'reachable' : 'unknown'), set: () => {} },
    workerView: () => ({ liveness: MEMBER_LIVENESS.resuming, mcpSlots: new Map() }),
  })
  const d3cProvider = createActivationProvider({
    teamDomain: d3cWorld.domain,
    blueprintCatalog: d3cWorld.catalog,
    environmentFacts: () => d3cD.source(V2),
    environmentFactsForBlueprint: (bp) => d3cD.source(bp),
    templateEnvironmentFactsForBlueprint: (bp, templateId) =>
      d3cD.templateReadSource(bp, templateId).then((r) => r.environmentFacts),
    environmentFactsReadForBlueprint: (bp) => d3cD.readSource(bp),
    templateEnvironmentFactsReadForBlueprint: (bp, templateId) => d3cD.templateReadSource(bp, templateId),
    externalPolicyFacts: () => Promise.resolve(makeExternalPolicyFacts()),
    staticModel: { ...P6T1_FIXTURE_STATIC_MODEL },
    childSessionFactory: new FakeChildSessionFactory(),
    sessionDurability: new FakeSessionDurability(),
    surface: new FakeAgentSetupSurface(),
    now: () => NOW,
  })
  const d3c = await capture(() => d3cProvider.activate(d1Request('tok-d3c')))

  const d3dWorld = await createP6T1World('d-d3d-v2-cold', { blueprintSource: V2_SOURCE })
  const d3dD = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'reachable' : 'unknown'), set: () => {} },
    workerView: () => ({ liveness: MEMBER_LIVENESS.cold, mcpSlots: new Map() }),
  })
  const d3dProvider = createActivationProvider({
    teamDomain: d3dWorld.domain,
    blueprintCatalog: d3dWorld.catalog,
    environmentFacts: () => d3dD.source(V2),
    environmentFactsForBlueprint: (bp) => d3dD.source(bp),
    templateEnvironmentFactsForBlueprint: (bp, templateId) =>
      d3dD.templateReadSource(bp, templateId).then((r) => r.environmentFacts),
    environmentFactsReadForBlueprint: (bp) => d3dD.readSource(bp),
    templateEnvironmentFactsReadForBlueprint: (bp, templateId) => d3dD.templateReadSource(bp, templateId),
    externalPolicyFacts: () => Promise.resolve(makeExternalPolicyFacts()),
    staticModel: { ...P6T1_FIXTURE_STATIC_MODEL },
    childSessionFactory: new FakeChildSessionFactory(),
    sessionDurability: new FakeSessionDurability(),
    surface: new FakeAgentSetupSurface(),
    now: () => NOW,
  })
  const d3d = await capture(() => d3dProvider.activate(d1Request('tok-d3d')))

  await destroyP6T1World(d1World)
  await destroyP6T1World(d3World)
  await destroyP6T1World(d3bWorld)
  await destroyP6T1World(d3cWorld)
  await destroyP6T1World(d3dWorld)

  // ============================ E — the creation PREFLIGHT ====================

  /** Run the preflight WITH the D-3 read ports (the production wiring shape). */
  const preflight = async (
    world: DWorld,
    bp: TeamBlueprint,
    extra: {
      availability?: readonly { templateId: string; available: boolean }[]
    } = {},
  ): Promise<PreflightResult> =>
    runCreationPreflight({
      blueprint: bp,
      environmentFacts: () => world.source(bp),
      environmentFactsRead: () => world.readSource(bp),
      ...(world.templateReadSource !== undefined && bp.schemaVersion === 2
        ? { templateEnvironmentFactsRead: (templateId: string) => world.templateReadSource(bp, templateId) }
        : {}),
      ...(extra.availability !== undefined ? { availability: extra.availability } : {}),
    })

  // E1: the seeded false OPEN at creation (the exact D-3 defect): the
  // classifier alone says PROCEED (the seed fills the unknown) — the
  // overlay says PENDING.
  const e1D = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'unknown' : 'reachable'), set: () => {} },
  })
  const e1 = await preflight(e1D, B1)

  // E2: the no-seed reclassification (the classifier's FATAL is honest
  // PENDING — the blocked scope has no confirmed down).
  const e2D = makeDWorld({
    seed: SEED_NO_REPO,
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'unknown' : 'reachable'), set: () => {} },
  })
  const e2 = await preflight(e2D, B1)

  // E3: the DOWN precedence (a confirmed down + a sibling still unknown:
  // the actionable FATAL stands — the pending is subsumed).
  const e3D = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'unreachable' : s === 'mcp_leaderreq' ? 'unknown' : 'reachable'), set: () => {} },
  })
  const e3 = await preflight(e3D, B1)

  // E4: PENDING beats CONSENT-REQUIRED (the unconsented optional warning +
  // a required live-unknown: the required pending is the stronger block).
  const e4D = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'unknown' : 'reachable'), set: () => {} },
  })
  const e4 = await preflight(e4D, B1C)

  // E5: the DISABLED-template exclusion (the disabled template is RESOLVED
  // — its pending requirement never blocks the creation).
  const e5D = makeDWorld({
    seed: SEED_ALL.filter((fact) => fact.subject !== 'mcp_web'),
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'reachable' : 'unknown'), set: () => {} },
    // Resuming (slot pending): the pending finding EXISTS — the assertion is
    // that the DISABLED template's pending is excluded (resolved).
    workerView: () => ({ liveness: MEMBER_LIVENESS.resuming, mcpSlots: new Map() }),
  })
  const e5 = await preflight(e5D, V2, { availability: [{ templateId: 'worker', available: false }] })

  // E6: the v2 template no-seed RECLASSIFICATION (the blocked, NON-disabled
  // template has no confirmed down → its fixOrDisable is honest PENDING).
  const e6D = makeDWorld({
    seed: SEED_ALL.filter((fact) => fact.subject !== 'mcp_web'),
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'reachable' : 'unknown'), set: () => {} },
    workerView: () => ({ liveness: MEMBER_LIVENESS.resuming, mcpSlots: new Map() }),
  })
  const e6 = await preflight(e6D, V2)

  // ============================ F — the s6 PROBE ==============================

  /** One S6 probe surface world (the real surface, the scripted oracle). */
  const probePorts = (
    world: DWorld,
    withReadPort: boolean,
  ): S6RemotePorts =>
    createS6RemotePorts({
      rootSessionId: 'session-d-probe',
      catalog: PROBE_CATALOG,
      blueprint: B0,
      ...(withReadPort
        ? {
            environmentFacts: (bp: TeamBlueprint) => world.source(bp),
            environmentFactsRead: (bp: TeamBlueprint) => world.readSource(bp),
          }
        : {
            environmentFacts: (bp: TeamBlueprint) => world.source(bp),
          }),
    } as unknown as S6RemoteOptions)

  const probeOf = async (ports: S6RemotePorts, blueprintId: string): Promise<CompatibilityResult> =>
    (await ports.intent.probe(blueprintId, 1, [])) as unknown as CompatibilityResult

  // F1: the pending world + the read port → BLOCKED_FATAL (the strict
  // prediction of the gate's PENDING block — the required fact is dropped,
  // the engine reports the missing).
  const f1D = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'unknown' : 'reachable'), set: () => {} },
  })
  const f1 = await probeOf(probePorts(f1D, true), 'd-b1')

  // F2: the healthy world + the read port → OPEN (the drop is a no-op on
  // live-reachable facts).
  const f2D = makeDWorld({ verdictFor: { current: () => 'reachable', set: () => {} } })
  const f2 = await probeOf(probePorts(f2D, true), 'd-b1')

  // F3: the SAME pending world on the LEGACY wiring (no read port) → the
  // seeded false OPEN (the pre-D-3 signature the fix removes).
  const f3 = await probeOf(probePorts(f1D, false), 'd-b1')

  // F4: the PERSONA domain is untouched (U5 FROZEN): a required persona
  // with a live-unknown observation (the selected preset diverges from the
  // plan) + the seed persona fact: the drop filter is ACTIVE on the mcp
  // axis (the required live-unknown mcp_repo fact is dropped) but NEVER
  // touches the persona axis (the persona row is byte-identical in both
  // wirings — the U5 caller-only merge, frozen T1.4-B).
  const f4D = makeDWorld({
    verdictFor: { current: (s) => (s === 'mcp_repo' ? 'unknown' : 'reachable'), set: () => {} },
  })
  const f4Fixed = await probeOf(probePorts(f4D, true), 'd-b1p')
  const f4Legacy = await probeOf(probePorts(f4D, false), 'd-b1p')


  // ======================= G — the PF-2 tri-state (X1–X5) ====================

  // The X-worlds: a FRESH HOST — no live session for the subject, hence no
  // fiber / pending slot / failed slot anywhere (the host discriminator's
  // NEVER-OBSERVED verdict, encoded here on the oracle's unsettled verdicts)
  // — the first-create bootstrap window that deadlocked D-3 (PF-2).

  // X1: NEVER-OBSERVED + the seed available:true → the creation preflight
  // PROCEEDS (the seed-satisfied 2-state stands — NOT PENDING).
  const x1D = makeDWorld({
    verdictFor: { current: () => 'unknown', set: () => {} },
    observationStateFor: () => 'never-observed',
  })
  const x1 = await preflight(x1D, B1)

  // X2: the SAME world through the probe (INV-9.4: probe == gate — the
  // probe consumes the seed truth; the exemption is observed, never
  // inferred): OPEN.
  const x2 = await probeOf(probePorts(x1D, true), 'd-b1')

  // X3: the SAME never-observed world, the seed's TRUTH decides —
  // available:false → FATAL (the exemption is NOT a blanket OPEN); the
  // no-seed variant (the fact ABSENT) → FATAL as well (pre-(A) this world
  // was reclassified to PENDING — the tri-state removes the reclassification
  // in the never-observed window: the missing fact stands).
  const x3aSeed = SEED_ALL.map((fact) =>
    fact.subject === 'mcp_repo' ? { ...fact, available: false } : fact,
  )
  const x3aD = makeDWorld({
    verdictFor: { current: () => 'unknown', set: () => {} },
    seed: x3aSeed,
    observationStateFor: () => 'never-observed',
  })
  const x3aPreflight = await preflight(x3aD, B1)
  const x3aProbe = await probeOf(probePorts(x3aD, true), 'd-b1')
  const x3bD = makeDWorld({
    seed: SEED_NO_REPO,
    verdictFor: { current: () => 'unknown', set: () => {} },
    observationStateFor: () => 'never-observed',
  })
  const x3bPreflight = await preflight(x3bD, B1)
  const x3bProbe = await probeOf(probePorts(x3bD, true), 'd-b1')

  // X4: the IN-FLIGHT world (a pending materialization slot exists on a live
  // session — the explicit observationState) → PENDING at BOTH the preflight
  // and the gate (the classifier distinguishes in-flight from never-observed
  // — the B5 transient window is preserved).
  const x4D = makeDWorld({
    verdictFor: { current: () => 'unknown', set: () => {} },
    observationStateFor: () => 'in-flight',
  })
  const x4Preflight = await preflight(x4D, B1)
  const x4World = await createP6T1World('d-x4-gate-inflight', { blueprintSource: B1_SOURCE })
  const x4Gate = await capture(() =>
    enforceRequirementGate(
      {
        repositories: x4World.domain.repositories,
        blueprint: B1,
        rootSessionId: ROOT,
        now: () => NOW,
        environmentFacts: () => x4D.source(B1),
        environmentFactsRead: () => x4D.readSource(B1),
      },
      normalWorkImpact(),
    ),
  )
  await destroyP6T1World(x4World)

  // X5: the SETTLED pins (unchanged — the tri-state is silent on settled
  // verdicts): reachable → OPEN / proceed; unreachable → FATAL.
  const x5UpD = makeDWorld({ verdictFor: { current: () => 'reachable', set: () => {} } })
  const x5UpPreflight = await preflight(x5UpD, B1)
  const x5UpProbe = await probeOf(probePorts(x5UpD, true), 'd-b1')
  const x5DownD = makeDWorld({ verdictFor: { current: () => 'unreachable', set: () => {} } })
  const x5DownPreflight = await preflight(x5DownD, B1)
  const x5DownProbe = await probeOf(probePorts(x5DownD, true), 'd-b1')

  return {
    // C
    c1,
    c2,
    c3a,
    c3b,
    c4Fixed,
    c4Legacy,
    c5,
    c6Fixed,
    c6Legacy,
    c7,
    c8,
    // D
    d1a,
    d1b,
    d1cFirstProbe,
    d1cRecordFirst,
    d1cSecondProbe,
    d1cRecordSecond,
    d1cWitness,
    d3a,
    d3b,
    d3c,
    d3d,
    // E
    e1,
    e2,
    e3,
    e4,
    e5,
    e6,
    // F
    f1,
    f2,
    f3,
    f4Fixed,
    f4Legacy,
    // G
    x1,
    x2,
    x3aPreflight,
    x3aProbe,
    x3bPreflight,
    x3bProbe,
    x4Preflight,
    x4Gate,
    x5UpPreflight,
    x5UpProbe,
    x5DownPreflight,
    x5DownProbe,
  }
})()

// --- a small assertion helper (the typed error details) -----------------------

function detailsOf(error: unknown): Record<string, unknown> {
  if (!(error instanceof TeamRuntimeError) && !(error instanceof ActivationError)) {
    throw new Error(`D guard: not a runtime/activation error: ${String(error)}`)
  }
  return (error as { details?: Record<string, unknown> }).details ?? {}
}

function expectPendingDetails(details: Record<string, unknown>, scopeKeyExpected: string, requirementId: string, subject: string): void {
  expect(details['status']).toBe(PENDING_BLOCK.status)
  expect(details['gateReason']).toBe(PENDING_BLOCK.gateReason)
  expect(details['recheck']).toBe(PENDING_BLOCK.recheck)
  expect(details['blockedScopes']).toEqual([scopeKeyExpected])
  const pendingRequirements = details['pendingRequirements'] as readonly { requirementId: string; subject: string }[]
  expect(pendingRequirements.some((entry) => entry.requirementId === requirementId && entry.subject === subject)).toBe(true)
}

// --- A — the shared classifier (pure unit) ------------------------------------

describe('D-3 A — classifyScopeReadiness (the PENDING / DOWN partition)', () => {
  const inputs: readonly RequirementInput[] = [
    { requirementId: 'req-mcp-a', type: 'mcpServer', subjects: ['srv_a'], complete: true },
    { requirementId: 'req-mcp-b', type: 'mcpServer', subjects: ['srv_b'], complete: true },
    { requirementId: 'req-mcp-c', type: 'mcpServer', subjects: ['srv_c'], complete: false },
  ]
  const obs = (o: Partial<RequirementObservation> & { requirementId: string; subject: string }): RequirementObservation => ({
    type: 'mcpServer',
    readiness: 'unknown',
    readinessSource: 'test',
    readinessObservedAt: NOW,
    ...o,
  })

  it('A1 — a required live-unknown subject is PENDING (never a verdict)', () => {
    const result = classifyScopeReadiness({
      scopeKey: 'team',
      inputs,
      observations: [obs({ requirementId: 'req-mcp-a', subject: 'srv_a', readiness: 'unknown' })],
    })
    expect(result.pending).toEqual([{ scopeKey: 'team', requirementId: 'req-mcp-a', subject: 'srv_a' }])
    expect(result.down).toEqual([])
  })

  it('A2 — a confirmed DOWN takes precedence (a sibling unknown is subsumed)', () => {
    const result = classifyScopeReadiness({
      scopeKey: 'team',
      inputs,
      observations: [
        obs({ requirementId: 'req-mcp-a', subject: 'srv_a', readiness: 'unreachable' }),
        obs({ requirementId: 'req-mcp-b', subject: 'srv_b', readiness: 'unknown' }),
      ],
    })
    expect(result.down).toEqual([{ scopeKey: 'team', requirementId: 'req-mcp-a', subject: 'srv_a' }])
    expect(result.pending).toEqual([{ scopeKey: 'team', requirementId: 'req-mcp-b', subject: 'srv_b' }])
  })

  it('A3 — the COLD member exemption (materialization not-applicable is never blocked, E.11 #1)', () => {
    const result = classifyScopeReadiness({
      scopeKey: 'template:worker',
      inputs,
      observations: [
        obs({
          requirementId: 'req-mcp-a',
          subject: 'srv_a',
          readiness: 'unknown',
          materialization: MATERIALIZATION_STATES.notApplicable,
        }),
      ],
    })
    expect(result.pending).toEqual([])
    expect(result.down).toEqual([])
  })

  it('A4 — an OPTIONAL required=false requirement never blocks', () => {
    const result = classifyScopeReadiness({
      scopeKey: 'team',
      inputs,
      observations: [obs({ requirementId: 'req-mcp-c', subject: 'srv_c', readiness: 'unknown' })],
    })
    expect(result.pending).toEqual([])
    expect(result.down).toEqual([])
  })

  it('A5 — no observations (the legacy / factory world): the rule is off', () => {
    const result = classifyScopeReadiness({ scopeKey: 'team', inputs, observations: [] })
    expect(result.pending).toEqual([])
    expect(result.down).toEqual([])
  })
})

// --- B — the probe drop filter (pure unit; U5 frozen) --------------------------

describe('D-3 B — dropSeedFilledPendingFacts (the probe strict-prediction filter)', () => {
  const requirements: readonly RequirementInput[] = [
    { requirementId: 'req-mcp-a', type: 'mcpServer', subjects: ['srv_a'], complete: true },
    { requirementId: 'req-persona-p', type: 'persona', subjects: ['preset_p'], complete: true },
  ]
  const feed: readonly EnvironmentFact[] = [
    { domain: 'mcpServer', subject: 'srv_a', available: true, generation: 1 },
    { domain: 'mcpServer', subject: 'srv_b', available: true, generation: 1 },
    { domain: 'persona', subject: 'preset_p', available: true, generation: 1 },
  ]
  const obs = (o: Partial<RequirementObservation> & { requirementId: string; subject: string }): RequirementObservation => ({
    type: o.type ?? 'mcpServer',
    readiness: 'unknown',
    readinessSource: 'test',
    readinessObservedAt: NOW,
    ...o,
  })

  it('B1 — the required live-unknown fact is DROPPED; the live-observed facts are kept', () => {
    const result = dropSeedFilledPendingFacts({
      feed,
      observations: [
        obs({ requirementId: 'req-mcp-a', subject: 'srv_a', readiness: 'unknown' }),
      ],
      requirements,
    })
    expect(result).toEqual([
      { domain: 'mcpServer', subject: 'srv_b', available: true, generation: 1 },
      { domain: 'persona', subject: 'preset_p', available: true, generation: 1 },
    ])
  })

  it('B2 — a live-reachable or live-unreachable observation never drops (real verdicts stand)', () => {
    const keptReachable = dropSeedFilledPendingFacts({
      feed,
      observations: [obs({ requirementId: 'req-mcp-a', subject: 'srv_a', readiness: 'reachable' })],
      requirements,
    })
    const keptUnreachable = dropSeedFilledPendingFacts({
      feed,
      observations: [obs({ requirementId: 'req-mcp-a', subject: 'srv_a', readiness: 'unreachable' })],
      requirements,
    })
    expect(keptReachable).toEqual(feed)
    expect(keptUnreachable).toEqual(feed)
  })

  it('B3 — the PERSONA domain is NEVER touched (U5 FROZEN — the probe persona semantics stand)', () => {
    const result = dropSeedFilledPendingFacts({
      feed,
      observations: [obs({ requirementId: 'req-persona-p', subject: 'preset_p', type: 'persona', readiness: 'unknown' })],
      requirements,
    })
    expect(result).toEqual(feed)
  })

  it('B4 — no observations: nothing is dropped (the rule is off)', () => {
    expect(dropSeedFilledPendingFacts({ feed, observations: [], requirements })).toEqual(feed)
  })
})

// --- C — the requirement GATE --------------------------------------------------

describe('D-3 C — the requirement gate: the fail-closed PENDING at the next boundary', () => {
  it('C1 — a required live-unknown (slot pending) blocks with the TYPED PENDING outcome', () => {
    expect(D.c1.thrown).toBe(true)
    if (!D.c1.thrown) throw new Error('D guard: C1 expected to throw')
    const error = D.c1.error as TeamRuntimeError
    expect(error instanceof TeamRuntimeError).toBe(true)
    expect(error.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expectPendingDetails(detailsOf(error), 'team', REPO_ID, 'mcp_repo')
    expect(detailsOf(error)['source']).toBe('requirement-gate')
    expect(detailsOf(error)['recoveryDispatchAvailable']).toBe(false)
  })

  it('C2 — witness: the SAME world on the legacy wiring (no read port) is the seeded false OPEN', () => {
    expect(D.c2.thrown).toBe(false)
    if (D.c2.thrown) throw new Error(`D guard: C2 expected to allow, got ${String(D.c2.error)}`)
  })

  it('C3 — the block is RECHECKABLE: the slot observed at the next boundary clears it', () => {
    // The same world, the same wiring: first the PENDING block (the slot
    // not yet observed)...
    expect(D.c3a.thrown).toBe(true)
    if (!D.c3a.thrown) throw new Error('D guard: C3a expected to throw')
    expect(detailsOf(D.c3a.error)['status']).toBe(PENDING_BLOCK.status)
    // ...then the recheck (the observation completes) admits (fresh read).
    expect(D.c3b.thrown).toBe(false)
    if (D.c3b.thrown) throw new Error(`D guard: C3b expected to allow, got ${String(D.c3b.error)}`)
  })

  it('C4 — the no-seed unknown is RECLASSIFIED to PENDING (the legacy wiring keeps the FATAL)', () => {
    // The D-3 wiring: the engine missing FATAL is honest PENDING.
    expect(D.c4Fixed.thrown).toBe(true)
    if (!D.c4Fixed.thrown) throw new Error('D guard: C4 fixed expected to throw')
    expectPendingDetails(detailsOf(D.c4Fixed.error), 'team', REPO_ID, 'mcp_repo')
    // The legacy wiring: the same world is the confirmed-shape FATAL
    // (requiredScopeDown — the pre-D-3 category).
    expect(D.c4Legacy.thrown).toBe(true)
    if (!D.c4Legacy.thrown) throw new Error('D guard: C4 legacy expected to throw')
    const legacyDetails = detailsOf(D.c4Legacy.error)
    expect(legacyDetails['status']).toBe('BLOCKED_FATAL')
    expect(legacyDetails['gateReason']).toBe('requiredScopeDown')
  })

  it('C5 — the DOWN precedence: a confirmed down + a sibling unknown keeps the actionable FATAL', () => {
    expect(D.c5.thrown).toBe(true)
    if (!D.c5.thrown) throw new Error('D guard: C5 expected to throw')
    const details = detailsOf(D.c5.error)
    expect(details['status']).toBe('BLOCKED_FATAL')
    expect(details['gateReason']).toBe('requiredScopeDown')
  })

  it('C6 — the COLD member is never blocked (E.11 negative #1, unit level; the exemption is identical on both wirings)', () => {
    expect(D.c6Fixed.thrown).toBe(false)
    if (D.c6Fixed.thrown) throw new Error(`D guard: C6 fixed expected to allow, got ${String(D.c6Fixed.error)}`)
    expect(D.c6Legacy.thrown).toBe(false)
    if (D.c6Legacy.thrown) throw new Error(`D guard: C6 legacy expected to allow, got ${String(D.c6Legacy.error)}`)
  })

  it('C7 — the RESUMING worker (slot pending) PENDING-blocks the first delegate (the kit B5 first half, unit level)', () => {
    expect(D.c7.thrown).toBe(true)
    if (!D.c7.thrown) throw new Error('D guard: C7 expected to throw')
    expectPendingDetails(detailsOf(D.c7.error), 'template:worker', WEB_ID, 'mcp_web')
  })

  it('C8 — the slot FAILED seconds later: the same delegate is the typed down-category FATAL (the kit B5 second half, unit level)', () => {
    expect(D.c8.thrown).toBe(true)
    if (!D.c8.thrown) throw new Error('D guard: C8 expected to throw')
    const details = detailsOf(D.c8.error)
    expect(details['status']).toBe('BLOCKED_FATAL')
    expect(details['gateReason']).toBe('requiredScopeDown')
  })
})

// --- D — the activation PROVIDER step 6 ----------------------------------------

describe('D-1/D-3 D — the activation provider: the per-blueprint seam + the PENDING', () => {
  it('D1a — witness: the pre-fix boot-scoped wiring FATALs step 6 on a healthy world (the PF-1 signature at the provider)', () => {
    expect(D.d1a.thrown).toBe(true)
    if (!D.d1a.thrown) throw new Error('D guard: D1a expected to throw')
    const error = D.d1a.error as ActivationError
    expect(error instanceof ActivationError).toBe(true)
    expect(error.code).toBe(ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_FATAL)
    const details = detailsOf(error)
    expect(details['status']).toBe('BLOCKED_FATAL')
  })

  it('D1b — the per-blueprint seam passes step 6 on the SAME healthy world (the activation completes)', () => {
    expect(D.d1b.thrown).toBe(false)
    if (D.d1b.thrown) throw new Error(`D guard: D1b expected to activate, got ${String(D.d1b.error)}`)
    expect(D.d1b.result.kind).toBe('activated')
    expect(D.d1b.result.templateId).toBe('worker')
  })

  it('D1c — the inverted durable aggregate stops: the all-up world probes OPEN and the REPROBE rewrites OPEN (never FATAL)', () => {
    // The durable row after each probe: OPEN, and the reprobe advances the
    // generation while keeping OPEN (a rewrite, not an inversion).
    expect(D.d1cRecordFirst.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(D.d1cRecordSecond.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(D.d1cRecordSecond.generation).toBeGreaterThan(D.d1cRecordFirst.generation)
    // The verdicts: no FATAL on either probe.
    expect(D.d1cFirstProbe.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(D.d1cFirstProbe.fatal).toBe(0)
    expect(D.d1cSecondProbe.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(D.d1cSecondProbe.fatal).toBe(0)
  })

  it('D1c witness — the pre-fix boot-scoped feed inverts the durable aggregate (the corrupted FATAL row)', () => {
    expect(D.d1cWitness.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(D.d1cWitness.fatal).toBe(2)
  })

  it('D3a — the provider PENDING-blocks the seeded live-unknown (recovery dispatch unavailable)', () => {
    expect(D.d3a.thrown).toBe(true)
    if (!D.d3a.thrown) throw new Error('D guard: D3a expected to throw')
    const error = D.d3a.error as ActivationError
    expect(error instanceof ActivationError).toBe(true)
    expect(error.code).toBe(ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_FATAL)
    expectPendingDetails(detailsOf(error), 'team', REPO_ID, 'mcp_repo')
    expect(detailsOf(error)['source']).toBe('activation-provider')
    expect(detailsOf(error)['recoveryDispatchAvailable']).toBe(false)
  })

  it('D3b — the no-seed unknown is reclassified to PENDING at the provider (the FATAL category is not kept)', () => {
    expect(D.d3b.thrown).toBe(true)
    if (!D.d3b.thrown) throw new Error('D guard: D3b expected to throw')
    expectPendingDetails(detailsOf(D.d3b.error), 'team', REPO_ID, 'mcp_repo')
  })

  it('D3c — the v2 resuming worker (slot pending) PENDING-blocks the admission (the engine PASS is voided)', () => {
    expect(D.d3c.thrown).toBe(true)
    if (!D.d3c.thrown) throw new Error('D guard: D3c expected to throw')
    expectPendingDetails(detailsOf(D.d3c.error), 'template:worker', WEB_ID, 'mcp_web')
  })

  it('D3d — the COLD worker (E.11 #1) is never PENDING-blocked: the first delegate activates', () => {
    expect(D.d3d.thrown).toBe(false)
    if (D.d3d.thrown) throw new Error(`D guard: D3d expected to activate, got ${String(D.d3d.error)}`)
    expect(D.d3d.result.kind).toBe('activated')
  })
})

// --- E — the creation PREFLIGHT ------------------------------------------------

describe('D-3 E — the creation preflight: the typed `pending` outcome', () => {
  it('E1 — the seeded false OPEN at creation is the typed PENDING (never a proceed)', () => {
    expect(D.e1.outcome).toBe(PREFLIGHT_OUTCOMES.pending)
    expect([...D.e1.pendingRequirementIds ?? []]).toEqual([REPO_ID])
    expect(D.e1.fatalRequirementIds.length).toBe(0)
    expect(D.e1.consentRequiredRequirementIds.length).toBe(0)
    expect(D.e1.fixOrDisableRequirementIds.length).toBe(0)
  })

  it('E2 — the no-seed FATAL is reclassified to PENDING (the blocked scope has no confirmed down)', () => {
    expect(D.e2.outcome).toBe(PREFLIGHT_OUTCOMES.pending)
    expect([...D.e2.pendingRequirementIds ?? []]).toEqual([REPO_ID])
  })

  it('E3 — the DOWN precedence: the confirmed down keeps the actionable FATAL', () => {
    expect(D.e3.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect([...D.e3.fatalRequirementIds]).toEqual([REPO_ID])
    expect(D.e3.scopes.find((s) => scopeKey(s.scope) === 'team')?.state).toBe(SCOPE_STATES.blocked)
  })

  it('E4 — PENDING beats CONSENT-REQUIRED (the required pending is the stronger block)', () => {
    expect(D.e4.outcome).toBe(PREFLIGHT_OUTCOMES.pending)
    expect([...D.e4.pendingRequirementIds ?? []]).toEqual([REPO_ID])
  })

  it('E5 — the DISABLED template is resolved: its pending requirement never blocks', () => {
    expect(D.e5.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
    expect(D.e5.pendingRequirementIds ?? []).toEqual([])
  })

  it('E6 — the v2 template no-seed FATAL is reclassified to PENDING (the non-disabled blocked template)', () => {
    expect(D.e6.outcome).toBe(PREFLIGHT_OUTCOMES.pending)
    expect([...D.e6.pendingRequirementIds ?? []]).toEqual([WEB_ID])
  })
})

// --- F — the s6 PROBE (the faithful, STRICTER predictor) -----------------------

describe('D-3 F — the probe: the strict prediction of the gate PENDING block', () => {
  it('F1 — the required live-unknown fact is dropped: BLOCKED_FATAL names exactly that server (predicts the gate PENDING)', () => {
    expect(D.f1.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(D.f1.counts.fatal).toBe(1)
    expect(D.f1.counts.pass).toBe(1)
    const repo = D.f1.requirements.find((row) => row.requirementId === REPO_ID)
    if (repo === undefined) throw new Error('D guard: F1 the repo row is missing')
    expect(repo.outcome).toBe('FATAL')
    expect(repo.reasonCode).toBe(COMPATIBILITY_REASON_CODES.COMPLETE_REQUIREMENT_NOT_MET)
    expect([...repo.unavailableSubjects]).toEqual(['mcp_repo'])
    const leaderreq = D.f1.requirements.find((row) => row.requirementId === LEADERREQ_ID)
    if (leaderreq === undefined) throw new Error('D guard: F1 the leaderreq row is missing')
    expect(leaderreq.outcome).toBe('PASS')
  })

  it('F2 — the healthy world: the drop is a no-op (OPEN, two PASS)', () => {
    expect(D.f2.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(D.f2.counts.pass).toBe(2)
    expect(D.f2.counts.fatal).toBe(0)
  })

  it('F3 — witness: the SAME pending world on the legacy wiring is the seeded false OPEN (pre-D-3)', () => {
    expect(D.f3.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(D.f3.counts.pass).toBe(2)
    expect(D.f3.counts.fatal).toBe(0)
  })

  it('F4 — the PERSONA domain is untouched (U5 FROZEN): the drop filter is active on mcp, byte-identical on persona', () => {
    // Both wirings FATAL (the required diverging persona is absent — the
    // probe's U5 caller-only persona merge strips host persona facts and
    // the caller sends none). The DROP FILTER is active on the mcp axis:
    // the fixed wiring drops the required live-unknown mcp_repo fact
    // (FATAL, missing); the legacy wiring keeps the seed-filled PASS.
    expect(D.f4Fixed.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(D.f4Legacy.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const repoFixed = D.f4Fixed.requirements.find((row) => row.requirementId === REPO_ID)
    const repoLegacy = D.f4Legacy.requirements.find((row) => row.requirementId === REPO_ID)
    if (repoFixed === undefined || repoLegacy === undefined) throw new Error('D guard: F4 the repo row is missing')
    expect(repoFixed.outcome).toBe('FATAL')
    expect(repoLegacy.outcome).toBe('PASS')
    // The PERSONA row is byte-identical across the two wirings (the drop
    // filter never touches the persona domain; the U5 merge semantics stand):
    const personaFixed = D.f4Fixed.requirements.find((row) => row.requirementId === PERSONA_ID)
    const personaLegacy = D.f4Legacy.requirements.find((row) => row.requirementId === PERSONA_ID)
    if (personaFixed === undefined || personaLegacy === undefined) throw new Error('D guard: F4 the persona row is missing')
    expect(personaFixed).toEqual(personaLegacy)
    expect(personaFixed.outcome).toBe('FATAL')
    expect(personaFixed.reasonCode).toBe(COMPATIBILITY_REASON_CODES.PERSONA_INCOMPATIBLE)
    expect([...personaFixed.unavailableSubjects]).toEqual(['d-other-preset'])
  })
})

// --- G — the PF-2 tri-state (X1–X5): the first-create bootstrap exemption ----

describe('PF-2 G — the tri-state: NEVER-OBSERVED is seed-satisfied, IN-FLIGHT stays PENDING', () => {
  it('X1 — NEVER-OBSERVED + the seed available:true: the creation preflight PROCEEDS (not PENDING)', () => {
    expect(D.x1.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
    expect(D.x1.pendingRequirementIds ?? []).toEqual([])
    expect(D.x1.fatalRequirementIds.length).toBe(0)
    expect(D.x1.consentRequiredRequirementIds.length).toBe(0)
  })

  it('X2 — NEVER-OBSERVED + the seed available:true: the probe is OPEN (probe == gate, INV-9.4 explicit)', () => {
    expect(D.x2.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(D.x2.counts.pass).toBe(2)
    expect(D.x2.counts.fatal).toBe(0)
  })

  it('X3 — NEVER-OBSERVED + the seed available:false / ABSENT: FATAL (the seed truth decides; the exemption is not a blanket OPEN)', () => {
    // The seed says false: both the preflight and the probe FATAL (and the
    // preflight does NOT reclassify to PENDING — no confirmed down, no
    // in-flight window).
    expect(D.x3aPreflight.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect([...D.x3aPreflight.fatalRequirementIds]).toEqual([REPO_ID])
    expect(D.x3aPreflight.pendingRequirementIds ?? []).toEqual([])
    expect(D.x3aProbe.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    // The no-seed variant: the missing fact stands (pre-(A) this world was
    // the no-seed PENDING reclassification — it no longer is).
    expect(D.x3bPreflight.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect([...D.x3bPreflight.fatalRequirementIds]).toEqual([REPO_ID])
    expect(D.x3bPreflight.pendingRequirementIds ?? []).toEqual([])
    expect(D.x3bProbe.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(D.x3bProbe.counts.fatal).toBe(1)
    const repo = D.x3bProbe.requirements.find((row) => row.requirementId === REPO_ID)
    if (repo === undefined) throw new Error('X guard: X3b the repo row is missing')
    expect(repo.outcome).toBe('FATAL')
    expect(repo.reasonCode).toBe(COMPATIBILITY_REASON_CODES.COMPLETE_REQUIREMENT_NOT_MET)
  })

  it('X4 — IN-FLIGHT (a pending slot exists on a live session): PENDING at the preflight AND the gate (the B5 window is preserved)', () => {
    expect(D.x4Preflight.outcome).toBe(PREFLIGHT_OUTCOMES.pending)
    expect([...(D.x4Preflight.pendingRequirementIds ?? [])].sort()).toEqual(
      [LEADERREQ_ID, REPO_ID].sort(),
    )
    expect(D.x4Preflight.fatalRequirementIds.length).toBe(0)
    expect(D.x4Gate.thrown).toBe(true)
    if (!D.x4Gate.thrown) throw new Error('X guard: X4 the gate expected to throw')
    const details = detailsOf(D.x4Gate.error)
    expect(details['status']).toBe(PENDING_BLOCK.status)
    expect(details['gateReason']).toBe(PENDING_BLOCK.gateReason)
    const pendingRequirements = details['pendingRequirements'] as readonly { requirementId: string; subject: string }[]
    expect(pendingRequirements.some((entry) => entry.requirementId === REPO_ID && entry.subject === 'mcp_repo')).toBe(true)
    expect(pendingRequirements.some((entry) => entry.requirementId === LEADERREQ_ID && entry.subject === 'mcp_leaderreq')).toBe(true)
  })

  it('X5 — the settled pins are unchanged: reachable → OPEN / proceed; unreachable → FATAL (the tri-state is silent on settled verdicts)', () => {
    expect(D.x5UpPreflight.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
    expect(D.x5UpProbe.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(D.x5UpProbe.counts.pass).toBe(2)
    expect(D.x5DownPreflight.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect([...D.x5DownPreflight.fatalRequirementIds].sort()).toEqual(
      [LEADERREQ_ID, REPO_ID].sort(),
    )
    expect(D.x5DownProbe.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(D.x5DownProbe.counts.fatal).toBe(2)
  })
})

// --- type guards ----------------------------------------------------------------

describe('D guards — the captured shapes', () => {
  it('the C-section gate outcomes are typed (allowed outcome / typed error)', () => {
    for (const outcome of [D.c2, D.c3b, D.c6Fixed, D.c6Legacy, D.d1b, D.d3d]) {
      if (!outcome.thrown) {
        expect(outcome.result).toBeDefined()
      }
    }
  })

  it('the PENDING_BLOCK typed-code family is the closed const (the single source)', () => {
    expect(PENDING_BLOCK.status).toBe('BLOCKED_PENDING')
    expect(PENDING_BLOCK.gateReason).toBe('requiredScopePending')
    expect(PENDING_BLOCK.recheck).toBe('next-boundary-or-compatibility.reprobe')
  })
})
