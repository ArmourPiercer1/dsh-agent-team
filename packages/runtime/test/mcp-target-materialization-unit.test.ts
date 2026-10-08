/**
 * mcp-target-materialization-unit.test.ts — Finding F (P1), T6: the
 * scoped-identity plumbing + the materialization-axis decisions at PURE
 * UNIT level (no host entry, no glue): the REAL W2-A provider + the
 * REAL D-3/PF-2 classifier + the REAL requirement gate over the REAL
 * durable repositories (the p6t1 world), with scripted readiness and a
 * scripted `memberMaterialization` port that RECORDS every scope it
 * receives (the plumbing witness: `scope.rootSessionId` +
 * `scope.instanceId` must reach the port verbatim — the host port is
 * the consumer the real-chain suite (mcp-target-materialization.test.ts)
 * drives end to end).
 *
 *  U1 — the scoped plumbing: the target template's feed read carries the
 *       action's target instance + the target root on the boundary scope
 *       (`{kind:'template', templateId, instanceId, rootSessionId}`), and
 *       the template-only (no-instance) read carries the target root
 *       without an instance (the conservative scope view).
 *  U2 — the failed target (the masked window): the target's materialization
 *       is `failed` while the aggregate readiness is `reachable` (the
 *       healthy sibling's fiber masks it) → the 2-state feed fact is
 *       `available:false` (the seed's truth must NOT open the target) and
 *       the gate BLOCKS the action's impact with the typed FATAL-down
 *       (`requiredScopeDown`, the recovery dispatch available).
 *  U3 — the healthy target while the scope's worst case is failed: the
 *       action's DECISION reads the target instance's own boundary
 *       (mounted → PASS — allowed) while the SCOPE-level verdict keeps the
 *       conservative worst case (blocked — the incident bookkeeping truth
 *       that T2 closes only on the scope's own convergence).
 *  U4 — the masked in-flight target: the target's materialization is
 *       `pending` (resident, the slot not yet settled) while the aggregate
 *       readiness is `reachable` → the TYPED PENDING block
 *       (`requiredScopePending`, the recheck is the next boundary) — the
 *       seed-filled PASS is voided.
 *  U5 — the guards (pre-existing semantics, preserved): a required
 *       capability observed `unreachable` with a HEALTHY (mounted)
 *       materialization still blocks (the server truth is not masked by
 *       the mount truth); the COLD member (`not-applicable`) never blocks
 *       (the never-observed unknown is seed-satisfied — E.11 negative #1).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and captures
 * its results; the `it` bodies are pure synchronous assertions.
 *
 * @module @dsh-agent-team/runtime/test/mcp-target-materialization-unit
 */

import { describe, expect, it } from 'vitest'
import { type TeamBlueprint, parseBlueprint } from '../../domain/blueprint/src/index.js'
import {
  createRuntimeRequirementFactsProvider,
  requirementFactScopeRoleOf,
} from '../requirement-facts/index.js'
import type {
  RequirementFactsResolution,
} from '../requirement-facts/index.js'
import {
  SCOPE_STATES,
  normalWorkImpact,
  scopeRequirementInputsOf,
  teamScope,
  templateScope,
} from '../requirements/index.js'
import {
  TEAM_RUNTIME_ERROR_CODES,
  TeamRuntimeError,
  enforceRequirementGate,
} from '../admission/index.js'
import type { RequirementGateOptions } from '../admission/index.js'
import { MEMBER_LIVENESS } from '../readiness/index.js'
import { PERSONA_OBSERVATION_SOURCES } from '../agent-setup/preset/index.js'
import type { PersonaKindObservation } from '../agent-setup/preset/index.js'
import {
  P6T1_FIXTURE,
  createP6T1World,
  destroyP6T1World,
} from './p6t1-helpers.js'

const NOW = '2026-09-30T00:00:00.000Z'
const ROOT = String(P6T1_FIXTURE.rootSessionId)
const SERVER = 'mcp_web'
const INST_A = 'inst-mtm-u6-a'
const INST_B = 'inst-mtm-u6-b'

// --- the v2 blueprint (the `worker` template scope requires the server) --------

/**
 * The document version this fixture declares, and why it is 3 now.
 *
 * §7.4 (lane B-runtime-semantics-A) deliberately LEFT this digit at 2 and put
 * it on a typed code position, because at that SHA the §E.2 structured-
 * requirement grammar was read by production only behind
 * `blueprint.schemaVersion === 2` (requirements/scope-requirements.ts,
 * requirements/creation-preflight.ts, admission/requirement-gate.ts,
 * compatibility/blueprint.ts, activation/provider.ts). Their recorded trial —
 * "promoting the digit reddens N of this file's tests" — was a true measurement
 * of that tree, and §7.3 option A (3b253775, PR #161) consumed it: the five
 * comparisons are gone and the grammar is now a property of the blueprint SHAPE,
 * not of its version digit.
 *
 * So the flip is a no-op for this file's CLAIM, and that was re-measured here
 * rather than assumed: at schemaVersion 3 plus the two authority documents v3
 * requires (below), this file is fully green — the same legs, asserting the same
 * facts. §7.3's narrowing of `TeamBlueprint['schemaVersion']` is what forces the
 * digit to move in the same commit as the cutover instead of drifting.
 */
const DECLARED_DOCUMENT_VERSION: TeamBlueprint['schemaVersion'] = 3
const V2_SOURCE = [
  '---',
  `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
  'blueprintId: mtm.u6',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the MTM U6 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: MTM U6 Worker',
  '    persona: You do the MTM U6 work.',
  '    requirements:',
  '      - requirementId: req-mcp-mcp_web-worker',
  '        type: mcpServer',
  '        subjects:',
  '          - mcp_web',
  '        complete: true',
  'requirements: []',
  'teamRequirements: []',
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
  '    description: The MTM U6 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
    // §7.3 v3-only: the two authority documents version 3 REQUIRES, at the honest
    // zero `rules: []`. No test in this file mutates permissions, so nothing here
    // asks to expand; a filler rule would write a wide grant into a fixture that no
    // test would notice (ADR §5.1 forbids the implicit ceiling just as much).
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

const V2 = parseBlueprint(V2_SOURCE)

// --- the scripted world (real provider + recorded memberMaterialization) --------

interface WorkerView {
  readonly liveness: (typeof MEMBER_LIVENESS)[keyof typeof MEMBER_LIVENESS]
  readonly mcpSlots: ReadonlyMap<string, { readonly status: 'mounted' | 'failed' }>
}

type Verdict = 'reachable' | 'unreachable' | 'unknown'

interface SeenScope {
  readonly kind: string
  readonly templateId?: string
  readonly instanceId?: string
  readonly rootSessionId?: string
}

interface U6World {
  readonly provider: ReturnType<typeof createRuntimeRequirementFactsProvider>
  /** Every scope the scripted memberMaterialization port received. */
  readonly scopesSeen: SeenScope[]
  /** The template-scope full-resolution read (the gate's read seam). */
  readonly templateRead: (context?: { readonly instanceId?: string; readonly rootSessionId?: string }) => Promise<RequirementFactsResolution>
  /** The team-scope full-resolution read (the gate's team seam). */
  readonly teamRead: () => Promise<RequirementFactsResolution>
}

function makeU6World(opts: {
  readonly verdict: Verdict
  /** The PF-2 observation state of an unsettled verdict (absent = in-flight default). */
  readonly observationState?: 'never-observed' | 'in-flight'
  /** The scripted member view keyed by the scope's instanceId (absent = the template-only view). */
  readonly viewFor: (instanceId: string | undefined) => WorkerView | undefined
}): U6World {
  const scopesSeen: SeenScope[] = []
  const provider = createRuntimeRequirementFactsProvider({
    configuredMcpServers: [SERVER],
    readiness: {
      probe: (type, name) => {
        const verdict = opts.verdict
        const observationState =
          verdict === 'unknown' && opts.observationState !== undefined ? opts.observationState : undefined
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
    seedFacts: [
      { domain: 'mcpServer', subject: SERVER, available: true, generation: 1 },
      { domain: 'persona', subject: 'u6-preset', available: true, generation: 1 },
    ],
    memberMaterialization: (scope) => {
      if (scope.kind !== 'template') return Promise.resolve(undefined)
      scopesSeen.push({
        kind: scope.kind,
        ...(scope.templateId !== undefined ? { templateId: scope.templateId } : {}),
        ...(scope.instanceId !== undefined ? { instanceId: scope.instanceId } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the scope under test (the field lands with the fix)
        ...(({ rootSessionId: (scope as any).rootSessionId } as object)),
      })
      const view = opts.viewFor(scope.instanceId)
      return Promise.resolve(
        view === undefined ? undefined : { liveness: view.liveness, mcpSlots: view.mcpSlots },
      )
    },
    substratePlan: () =>
      Promise.resolve({
        root: { presetId: 'u6-preset', persona: { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition } as PersonaKindObservation },
        member: { presetId: 'u6-preset', persona: { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition } as PersonaKindObservation },
      }),
    now: () => NOW,
  })

  const teamRead = (): Promise<RequirementFactsResolution> =>
    provider.resolveFacts({
      requirements: scopeRequirementInputsOf(V2).team,
      scope: { kind: 'team' },
    })
  const templateRead = (
    context?: { readonly instanceId?: string; readonly rootSessionId?: string },
  ): Promise<RequirementFactsResolution> =>
    provider.resolveFacts({
      requirements: scopeRequirementInputsOf(V2).templates['worker'] ?? [],
      scope: {
        kind: 'template',
        templateId: 'worker',
        // Blocker-1 shared contract: the template scope carries its role
        // identity (worker ≠ the leader template ⇒ member).
        role: requirementFactScopeRoleOf(V2.leader.templateId, 'worker'),
        ...(context?.instanceId !== undefined ? { instanceId: context.instanceId } : {}),
        ...(context?.rootSessionId !== undefined ? { rootSessionId: context.rootSessionId } : {}),
      },
    })

  return { provider, scopesSeen, templateRead, teamRead }
}

/** One captured template-scope read (the atomic pair the verdict reads). */
interface ReadCapture {
  readonly facts: readonly { domain: string; subject: string; available: boolean }[]
  /** The live 3-state observations (the materialization axis is carried here). */
  readonly observations: Array<{ subject: string; readiness: string; materialization?: string }>
}

// --- the gate consultation (real repositories, real engine) ----------------------

/**
 * The captured outcome of one gate consultation. The two variants carry
 * each captured template-scope read (the atomic facts + observations
 * pair) in `templateReads`, keyed by the read's instance context
 * (`__template__` = the no-instance (template-only) read) — the target
 * template is read ONCE per instance context (the decision read) and ONCE
 * template-only (the conservative scope read for the bookkeeping).
 */
type GateCapture =
  | {
      readonly kind: 'allowed'
      readonly reason: string
      readonly scopeVerdicts: Array<{ key: string; state: string }>
      readonly templateReads: Map<string, () => Promise<ReadCapture>>
    }
  | {
      readonly kind: 'blocked'
      readonly status: string
      readonly gateReason: string
      readonly blockedScopes: readonly string[]
      readonly unavailableSubjects: readonly string[]
      readonly recoveryDispatchAvailable: boolean
      readonly templateReads: Map<string, () => Promise<ReadCapture>>
    }

async function consultGate(
  u6: U6World,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the p6t1 durable world
  world: any,
  targetInstanceId: string | undefined,
): Promise<GateCapture> {
  const templateReads = new Map<string, () => Promise<ReadCapture>>()
  const gateOptions: Record<string, unknown> = {
    repositories: world.domain.repositories,
    blueprint: V2,
    rootSessionId: ROOT,
    now: () => NOW,
    environmentFacts: () => u6.teamRead().then((r) => r.environmentFacts),
    environmentFactsRead: () => u6.teamRead(),
    // The D-3 full-resolution template read seam — the capturing wrapper
    // records the atomic read (facts + observations) of EVERY call, keyed
    // by the read's instance context (one capture per read).
    templateEnvironmentFactsRead: (templateId: string, context?: { readonly instanceId?: string; readonly rootSessionId?: string }) => {
      if (templateId !== 'worker') return Promise.resolve({ observations: [], environmentFacts: [], resolvedAt: NOW })
      const resolution = u6.templateRead(context)
      const key = context?.instanceId ?? '__template__'
      templateReads.set(key, () =>
        resolution.then((r) => ({
          facts: r.environmentFacts.map((f) => ({
            domain: f.domain,
            subject: f.subject,
            available: f.available,
          })),
          observations: r.observations.map((o) => ({
            subject: o.subject,
            readiness: o.readiness,
            ...(o.materialization !== undefined ? { materialization: o.materialization } : {}),
          })),
        })),
      )
      return resolution
    },
  }
  // The scoped-identity plumbing under test (the option lands with the fix
  // — the cast keeps the pre-fix RED run compiling: an unknown option is
  // simply ignored by the pre-fix gate).
  if (targetInstanceId !== undefined) {
    gateOptions['targetInstanceId'] = targetInstanceId
  }
  const impact = normalWorkImpact([teamScope(), templateScope('worker')])
  try {
    const outcome = await enforceRequirementGate(
      gateOptions as unknown as RequirementGateOptions,
      impact,
    )
    return {
      kind: 'allowed' as const,
      reason: outcome.reason,
      scopeVerdicts: outcome.scopeVerdicts.map((v) => ({
        key: `${v.scope.level}${v.scope.templateId !== undefined ? `:${v.scope.templateId}` : ''}`,
        state: v.state,
      })),
      templateReads,
    }
  } catch (error) {
    if (error instanceof TeamRuntimeError && error.code === TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED) {
      const details = (error.details ?? {}) as Record<string, unknown>
      return {
        kind: 'blocked' as const,
        status: String(details['status'] ?? ''),
        gateReason: String(details['gateReason'] ?? ''),
        blockedScopes: Array.isArray(details['blockedScopes']) ? details['blockedScopes'].map(String) : [],
        unavailableSubjects: Array.isArray(details['unavailableSubjects']) ? details['unavailableSubjects'].map(String) : [],
        recoveryDispatchAvailable: details['recoveryDispatchAvailable'] === true,
        templateReads,
      }
    }
    throw error
  }
}

// --- the scenarios (module level; synchronous `it` bodies) -----------------------

const U6 = await (async () => {
  const world = await createP6T1World('mtm-u6-world', { blueprintSource: V2_SOURCE })

  // The shared scripted views: B failed (the target loss), A mounted (the
  // healthy sibling), the template-only view (absent instanceId) = the
  // conservative WORST CASE over the live instances (B failed — the
  // scope's own truth for the bookkeeping: any failed live instance keeps
  // the scope down).
  const failedView = (): WorkerView => ({
    liveness: MEMBER_LIVENESS.resident,
    mcpSlots: new Map([[SERVER, { status: 'failed', attempts: 1, lastAttemptAt: Date.now() }]]),
  })
  const mountedView = (): WorkerView => ({
    liveness: MEMBER_LIVENESS.resident,
    mcpSlots: new Map([[SERVER, { status: 'mounted', attempts: 1, lastAttemptAt: Date.now() }]]),
  })
  const viewByKey = (instanceId: string | undefined): WorkerView =>
    instanceId === INST_A ? mountedView() : failedView()

  // U2 — the failed target, masked reachable (the aggregate says up — the
  // healthy sibling's fiber — while the target's own mount is failed).
  const u2 = makeU6World({ verdict: 'reachable', viewFor: viewByKey })
  const u2Gate = await consultGate(u2, world, INST_B)
  const u2TargetReadCapture = u2Gate.templateReads.get(INST_B)
  const u2Read = u2TargetReadCapture !== undefined ? await u2TargetReadCapture() : { facts: [], observations: [] }

  // U3 — the healthy target while the scope's worst case is failed (the
  // decision reads the target boundary; the scope verdict keeps the
  // conservative worst case).
  const u3 = makeU6World({ verdict: 'reachable', viewFor: viewByKey })
  const u3Gate = await consultGate(u3, world, INST_A)

  // U4 — the masked in-flight target (resident, slot not yet settled —
  // materialization `pending`; the aggregate `reachable` masks the B5
  // window). THE LIVENESS GUARD: this is NOT a spurious PENDING block —
  // the target settles at its OWN boundary (the delivery runs the
  // reconcile), so a PENDING here would be a state only the blocked action
  // itself can settle (the parent's liveness adjudication: excluded). The
  // unmasked in-flight window (readiness `unknown` + in-flight) is the
  // typed PENDING (the readiness axis, pre-existing); the masked in-flight
  // (readiness settled `reachable`) is ALLOWED — the allow admits the MOUNT
  // ATTEMPT (the bootstrap path, never a blanket pending block). Corrected
  // contract (external residual-F ruling on e45d22fe): a FAILED first
  // mount is gated at the SAME passage's delivery gate (no real work
  // before the applicable materialization succeeds — T7, the real-chain
  // leg) AND gated as `failed` (U2) at the NEXT passage's admission.
  const u4 = makeU6World({
    verdict: 'reachable',
    viewFor: (instanceId) =>
      instanceId === INST_A
        ? mountedView()
        : { liveness: MEMBER_LIVENESS.resident, mcpSlots: new Map() },
  })
  const u4Gate = await consultGate(u4, world, INST_B)
  const u4TargetReadCapture = u4Gate.templateReads.get(INST_B)
  const u4Read = u4TargetReadCapture !== undefined ? await u4TargetReadCapture() : undefined

  // U5a — the guard: unreachable readiness + healthy (mounted) materialization
  // STILL blocks (the server truth is not masked by the mount truth).
  const u5a = makeU6World({ verdict: 'unreachable', viewFor: mountedView })
  const u5aGate = await consultGate(u5a, world, INST_B)

  // U5b — the guard: the COLD member (not-applicable) never blocks (the
  // never-observed unknown is seed-satisfied — E.11 negative #1).
  const u5b = makeU6World({
    verdict: 'unknown',
    observationState: 'never-observed',
    viewFor: () => ({ liveness: MEMBER_LIVENESS.cold, mcpSlots: new Map() }),
  })
  const u5bGate = await consultGate(u5b, world, INST_A)

  await destroyP6T1World(world)

  return { u2, u2Gate, u2Read, u3, u3Gate, u4, u4Gate, u4Read, u5a, u5aGate, u5b, u5bGate }
})()

describe('Finding F T6 — the scoped-identity plumbing + materialization axis (unit: provider + classifier + gate)', () => {
  it('U1 — the boundary scope reaches the memberMaterialization port verbatim (instance + root on the target read; root only on the template read)', () => {
    // The target (U2) and healthy-target (U3) consultations each performed
    // the template-scope read with the action's target instance context.
    const targetScopes = U6.u2.scopesSeen.filter((s) => s.templateId === 'worker' && s.instanceId === INST_B)
    expect(targetScopes.length).toBeGreaterThanOrEqual(1)
    const firstTargetScope = targetScopes[0]
    expect(firstTargetScope).toBeDefined()
    expect(firstTargetScope?.rootSessionId).toBe(ROOT)
    const aScopes = U6.u3.scopesSeen.filter((s) => s.templateId === 'worker' && s.instanceId === INST_A)
    expect(aScopes.length).toBeGreaterThanOrEqual(1)
    const firstAScope = aScopes[0]
    expect(firstAScope).toBeDefined()
    expect(firstAScope?.rootSessionId).toBe(ROOT)
    // The template-only (no-instance) read of the same consultations
    // carries the target root WITHOUT an instance (the conservative
    // scope view — the incident bookkeeping's own truth).
    const templateOnlyRootScopes = [
      ...U6.u2.scopesSeen,
      ...U6.u3.scopesSeen,
    ].filter((s) => s.templateId === 'worker' && s.instanceId === undefined && s.rootSessionId === ROOT)
    expect(templateOnlyRootScopes.length).toBeGreaterThanOrEqual(1)
  })

  it('U2 — the failed target in the masked window: the feed fact is available:false and the gate BLOCKS the impact (typed FATAL-down)', () => {
    expect(U6.u2Gate.kind).toBe('blocked')
    if (U6.u2Gate.kind !== 'blocked') return
    expect(U6.u2Gate.status).toBe('BLOCKED_FATAL')
    expect(U6.u2Gate.gateReason).toBe('requiredScopeDown')
    expect(U6.u2Gate.blockedScopes).toEqual(['template:worker'])
    expect(U6.u2Gate.unavailableSubjects).toEqual([SERVER])
    expect(U6.u2Gate.recoveryDispatchAvailable).toBe(true)
    // The 2-state feed of the target read: the seed's available:true must
    // NOT open the target (the live materialization failure wins).
    const serverFact = U6.u2Read.facts.find((f) => f.domain === 'mcpServer' && f.subject === SERVER)
    expect(serverFact).toBeDefined()
    expect(serverFact?.available).toBe(false)
    // The 3-state observation of the target read: the materialization axis
    // carries the instance's own `failed` state (the target boundary).
    const serverObs = U6.u2Read.observations.find((o) => o.subject === SERVER)
    expect(serverObs).toBeDefined()
    expect(serverObs?.materialization).toBe('failed')
  })

  it('U3 — the healthy target passes while the scope verdict keeps the conservative worst case (dual evaluation: decision on the target boundary, bookkeeping on the scope)', () => {
    expect(U6.u3Gate.kind).toBe('allowed')
    if (U6.u3Gate.kind !== 'allowed') return
    expect(U6.u3Gate.reason).toBe('allowed')
    // The SCOPE-level verdict of `worker` keeps the conservative worst
    // case (B failed → blocked) — the incident/recovery bookkeeping truth
    // (T2: the scope's incident closes only on the scope's own
    // convergence, never on a healthy sibling's fresh verdict).
    const workerVerdict = U6.u3Gate.scopeVerdicts.find((v) => v.key === 'template:worker')
    expect(workerVerdict).toBeDefined()
    expect(workerVerdict?.state).toBe(SCOPE_STATES.blocked)
    // The decision itself used the target boundary (A mounted → the
    // team+worker impact was admitted).
    const teamVerdict = U6.u3Gate.scopeVerdicts.find((v) => v.key === 'team')
    expect(teamVerdict?.state).not.toBe(SCOPE_STATES.blocked)
  })

  it('U4 — the masked in-flight target is NOT spurious-PENDING-blocked (liveness: the mount attempt is admissible — bootstrap; a same-passage failed mount is gated at the delivery gate, the next admission as failed)', () => {
    // THE LIVENESS GUARD: the target's materialization is `pending`
    // (not yet attempted) while the aggregate readiness is `reachable`
    // (masked by the healthy sibling). PENDING here would be a state only
    // the blocked action itself can settle (the delivery runs the
    // target's boundary) — the parent's liveness adjudication excludes
    // it. The action is ALLOWED: the allow admits the MOUNT ATTEMPT
    // (the bootstrap path — never a blanket pending block). Corrected
    // contract (external residual-F ruling on e45d22fe): the SAME-passage
    // handling of a failed first mount is the delivery gate — no real
    // work before the applicable materialization succeeds (T7, the
    // real-chain leg) — and the NEXT admission gates the failed mount
    // as `failed` (U2). The fix must NOT turn this shape into a PENDING
    // block.
    expect(U6.u4Gate.kind).toBe('allowed')
    // The instance-scoped read of the target carried its `pending`
    // materialization (the plumbing reached the port; the axis was read
    // and preserved — not flipped to a block). (Post-fix this read exists;
    // pre-fix the target read is absent and the guard's outcome assertion
    // above is the pin.)
    expect(U6.u4Read).toBeDefined()
    const obs = U6.u4Read?.observations.find((o) => o.subject === SERVER)
    expect(obs).toBeDefined()
    expect(obs?.materialization).toBe('pending')
  })

  it('U5 — the guards: unreachable + healthy materialization still blocks; the cold member never blocks', () => {
    // U5a — the server truth wins: a required capability observed DOWN
    // blocks even when the (other instance's) mount is healthy.
    expect(U6.u5aGate.kind).toBe('blocked')
    if (U6.u5aGate.kind === 'blocked') {
      expect(U6.u5aGate.status).toBe('BLOCKED_FATAL')
      expect(U6.u5aGate.gateReason).toBe('requiredScopeDown')
    }
    // U5b — the cold member: the not-applicable materialization is
    // exempt (applicability gates before readiness); the never-observed
    // unknown is seed-satisfied (the seed's truth decides — PASS).
    expect(U6.u5bGate.kind).toBe('allowed')
  })
})
