/**
 * Finding A (P1, pre-alpha3 review) — the persona KIND subject vs presetId
 * mismatch in the production provider → preflight → gate chain.
 *
 * The v2 SUBJECT CONVENTION (restored spec — plan §E.3 / §C.2, ADR-24,
 * SKILL.md §4.1): a persona requirement's subjects name the REQUIRED persona
 * KIND (the closed `RequiredPersonaKind` set — this increment: `standard`),
 * NOT the mounted preset's id. The world facts report the OBSERVED kind of
 * the role the scope addresses (plan §C.2 R8: team scope ⇒ the ROOT entry,
 * template scope ⇒ the MEMBER entry). The PR #22 donor's core invariant
 * ("preset id ≠ persona kind") is the regression this suite pins over the
 * REAL production chain — no handcrafted facts for the persona lane:
 *
 * ```text
 * parseBlueprint (the real v2 source document)
 *   → resolveRuntimeSubstrate (the REAL RuntimeSubstrateResolver, plan §C.2,
 *     over the production observer seam double `observePersonaKind(presetId)`
 *     — the one injected port, exactly as the production host binds it)
 *   → createRuntimeRequirementFactsProvider (the REAL live-fact provider;
 *     the REAL createCapabilityReadinessProvider with the production
 *     structural fact — only an mcpServer probe port is registered, so the
 *     `persona` observation is `probeable:false` and keeps the legacy
 *     seed-satisfied 2-state)
 *   → runCreationPreflight / evaluateCreationScopes (the REAL creation
 *     preflight, driven with the SAME port shape root.ts's
 *     `enforceCreationPreflight` wires: the facts thunks + the
 *     full-resolution read ports, pre-bind default consents/availability)
 * ```
 *
 * Scenarios (RED confirmed pre-fix on this branch's base — the provider's
 * legacy preset-id matching makes a kind subject `unknown`, the seed-less
 * fact is omitted, and the engine FATALs the required `standard`):
 *
 * - T1: root preset `ptc/team-small-ctb` + a DIFFERENT member preset id,
 *   both OBSERVE `standard`, v2 teamRequirement subjects `['standard']`,
 *   NO bootstrap seed → the team-scope preflight PASSES (pre-fix: FATAL);
 * - T2: role-specific mix — root observes `standard`, member observes
 *   `complete` → the team-scope `standard` requirement PASSES (the ROOT
 *   observation) while the member-TEMPLATE-scope `standard` requirement is
 *   FATAL (the MEMBER observation — R8: the member requirement uses the
 *   member's actual observation, not the root's);
 * - T3: root observes `complete` → the team scope FATALs (the structural
 *   §13.5 conflict — NO downgrade through the kind path); the complete
 *   observation ALSO surfaces the OBSERVED kind as an alongside world fact
 *   (`(persona, 'complete')`, B3 typed-diagnostics fix — the engine's
 *   FROZEN typed lane keys on exactly that fact): the test asserts the
 *   explicit `reasonCode = TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` end-to-
 *   end over the real provider feed (T2's worker scope and T6's e2e
 *   world carry the same assertion);
 * - T4: the observer fails typed → `unresolved` → `unknown` → no seed ⇒
 *   FATAL (fail-closed, and NOT reclassified `pending`: persona is
 *   non-probeable — the legacy 2-state stands); WITH a bootstrap seed
 *   `available:true` the seed's truth decides ⇒ proceed (the documented
 *   2-state behavior — both legs asserted);
 * - T5: the FROZEN v1 preset-id semantics (the existing
 *   `runtime-requirement-facts-provider.test.ts` persona suite — subjects
 *   `'ptc'`/`'minimal'`/`'mystery'`/`'other-preset'` are not kinds and keep
 *   the legacy root/member preset-id matching) must keep passing UNCHANGED;
 *   it is run as part of this focused area and is NOT edited here;
 * - T6: end-to-end through the creation preflight root.ts drives —
 *   `substratePlan` = the real resolver over the observer double,
 *   `seedFacts` = the row `config.environmentFacts` (empty): a v2 blueprint
 *   with the persona teamRequirement `standard` and a mounted COMPOSABLE
 *   preset PASSES with no seed (the probe/create split the review flagged —
 *   the create path and the probe path now share the same provider verdict);
 * - Blocker-1 (external review, P1): the template scope carries its ROLE
 *   identity (`leader` | `member`) — the LEADER template IS the root
 *   session's template (the root mounts `config.rootPresetId`,
 *   agent-bindings v3; plan §C.2: the plan's ROOT entry is "the actual
 *   preset used by the Leader"; the bind-time persona slot reads the ROOT
 *   entry — root.ts presetSeam, Architecture §13.1: members inherit the
 *   root's bind substrate). The kind path addresses the LEADER's own
 *   (root) observation for the leader role and the MEMBER observation for
 *   the member role — a template-scope kind subject must NEVER be judged
 *   by the wrong role's entry (both directions pinned: the healthy leader
 *   PASSES; the complete-observing leader FATALs on its OWN observation).
 *
 * @module @dsh-agent-team/runtime/test/persona-kind-provider-preflight
 */

import { describe, expect, it } from 'vitest'

import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import {
  COMPATIBILITY_REASON_CODES,
  evaluateCompatibility,
} from '../../domain/compatibility/src/index.js'
import {
  createCapabilityReadinessProvider,
  PROBE_VERDICTS,
} from '../readiness/index.js'
import {
  createRuntimeRequirementFactsProvider,
  type RequirementFactsResolution,
} from '../requirement-facts/index.js'
import {
  blockedScopeKeysOf,
  evaluateCreationScopes,
  runCreationPreflight,
  scopeRequirementInputsOf,
} from '../requirements/index.js'
import {
  PREFLIGHT_OUTCOMES,
  REQUIREMENT_OUTCOMES,
  SCOPE_STATES,
  scopeKey,
} from '../requirements/index.js'
import {
  PERSONA_OBSERVATION_SOURCES,
  resolveRuntimeSubstrate,
} from '../agent-setup/preset/index.js'
import type { PersonaKindObservation } from '../agent-setup/preset/index.js'

const NOW = '2026-10-02T00:00:00.000Z'

// --- the v2 blueprint fixtures (the persona KIND convention subjects) ---------

const BOILERPLATE = [
  'leader:',
  '  templateId: leader',
  '  persona: You lead the persona-kind team.',
  'members:',
  '  - templateId: worker',
  '    displayName: PK Worker',
  '    persona: You do the PK work.',
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
  '    description: The PK default state.',
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
 * T1/T3/T4/T6 shape — the TEAM scope alone requires the `standard` kind
 * (the member template declares no structured requirement).
 */
const PK_TEAM_SOURCE = [
  '---',
  'schemaVersion: 2',
  'blueprintId: pk-team',
  'revision: "1"',
  ...BOILERPLATE,
  'requirements: []',
  'teamRequirements:',
  '  - requirementId: req-persona-standard-team',
  '    type: persona',
  '    subjects:',
  '      - standard',
  '    complete: true',
  '---',
  '',
].join('\n')

/**
 * T2 shape — the TEAM scope requires `standard` AND the `worker` MEMBER
 * TEMPLATE scope requires `standard` (the R8 split: the two scopes read the
 * ROOT and the MEMBER plan entries respectively).
 */
const PK_FULL_SOURCE = [
  '---',
  'schemaVersion: 2',
  'blueprintId: pk-full',
  'revision: "1"',
  ...BOILERPLATE,
  'requirements: []',
  'teamRequirements:',
  '  - requirementId: req-persona-standard-team',
  '    type: persona',
  '    subjects:',
  '      - standard',
  '    complete: true',
  '---',
  '',
].join('\n')

// The worker template's structured requirement (the member-template-scope
// carrier — appended in the document body, parsed by the real v2 validator
// whose persona-subject closed-set rule accepts exactly the kinds).
const PK_FULL_SOURCE_WITH_WORKER = PK_FULL_SOURCE.replace(
  '    persona: You do the PK work.',
  [
    '    persona: You do the PK work.',
    '    requirements:',
    '      - requirementId: req-persona-standard-worker',
    '        type: persona',
    '        subjects:',
    '          - standard',
    '        complete: true',
  ].join('\n'),
)

const PK_TEAM = parseBlueprint(PK_TEAM_SOURCE)
const PK_FULL = parseBlueprint(PK_FULL_SOURCE_WITH_WORKER)

const TEAM_REQ_ID = 'req-persona-standard-team'
const WORKER_REQ_ID = 'req-persona-standard-worker'

// --- the world factory (the REAL production chain) -----------------------------

type ObservedKind = 'standard' | 'complete' | 'absent'

/**
 * One production-observer-seam double: a preset-registry table
 * (`presetId` → observed kind) + the typed-failure lane (`unresolved` with
 * the production observer's `source: 'none'` + a typed reason — plan §C.3
 * fail-closed, never a kind guess).
 */
function observerFor(table: Record<string, ObservedKind | 'unresolved'>) {
  return (presetId: string): PersonaKindObservation => {
    const kind = table[presetId]
    if (kind === undefined || kind === 'unresolved') {
      return {
        kind: 'unresolved' as const,
        source: PERSONA_OBSERVATION_SOURCES.none,
        reason: `preset '${presetId}' persona unresolved: the agentPresets seam failed (typed probe failure)`,
      }
    }
    return { kind, source: PERSONA_OBSERVATION_SOURCES.effectiveComposition }
  }
}

interface WorldOptions {
  readonly rootPresetId: string
  readonly memberPresetId?: string
  readonly observer: (presetId: string) => PersonaKindObservation
  readonly seedFacts?: readonly {
    readonly domain: string
    readonly subject: string
    readonly available: boolean
    readonly generation: number
  }[]
}

/**
 * Build one world over the REAL production chain (the same seam set the
 * production host binds — host.ts: `resolveSubstratePlan` over
 * `observePersonaKind`, the provider's `substratePlan` port, the row
 * `config.environmentFacts` as the ONLY seed).
 */
function makeWorld(opts: WorldOptions) {
  // The REAL resolver (plan §C.2) over the observer-seam double. Resolved
  // FRESH per call — the provider port's contract ("Resolved fresh per
  // call"); the production host memoizes a SETTLED plan, and an unresolved
  // one re-probes — the double is deterministic, so a fresh resolve is the
  // byte-identical settled-plan semantics for this suite.
  const substratePlan = () =>
    resolveRuntimeSubstrate({
      rootPresetId: opts.rootPresetId,
      memberPresetId: opts.memberPresetId,
      deploymentDefaultPresetId: 'standard',
      observePersonaKind: opts.observer,
    })
  // The REAL readiness provider with the PRODUCTION structural fact: only an
  // mcpServer probe port is registered (no `persona` probe port — persona is
  // observed through the substrate plan, so the persona observation carries
  // `probeable:false` and keeps the legacy seed-satisfied 2-state, D-3).
  const readiness = createCapabilityReadinessProvider({
    probes: {
      mcpServer: { source: 'mcp-fiber', probe: () => PROBE_VERDICTS.reachable },
    },
    now: () => NOW,
  })
  const provider = createRuntimeRequirementFactsProvider({
    configuredMcpServers: [],
    readiness,
    ...(opts.seedFacts !== undefined ? { seedFacts: opts.seedFacts } : {}),
    substratePlan,
    now: () => NOW,
  })

  // The preflight wiring — the SAME port shape root.ts's
  // `enforceCreationPreflight` drives (root.ts L1319–1356): the per-scope
  // facts thunks + the full-resolution read ports over the SAME per-create
  // blueprint scoping, the pre-bind defaults (no consents, all available).
  const teamRead = (blueprint: TeamBlueprint): Promise<RequirementFactsResolution> =>
    provider.resolveFacts({
      requirements: scopeRequirementInputsOf(blueprint).team,
      scope: { kind: 'team' },
    })
  const templateRead = (blueprint: TeamBlueprint, templateId: string): Promise<RequirementFactsResolution> =>
    provider.resolveFacts({
      requirements: scopeRequirementInputsOf(blueprint).templates[templateId] ?? [],
      // The role identity of the template scope (Blocker-1 shared contract —
      // the bound blueprint knows its leader template id; the production
      // root.ts sites derive it the same way): the LEADER template is the
      // root session's template (the root mounts config.rootPresetId —
      // agent-bindings v3; plan §C.2: the ROOT entry is the actual preset
      // used by the Leader), every other template is a member boundary.
      scope: {
        kind: 'template',
        templateId,
        role: templateId === blueprint.leader.templateId ? 'leader' : 'member',
      },
    })
  const preflight = async (blueprint: TeamBlueprint) =>
    runCreationPreflight({
      blueprint,
      environmentFacts: () => teamRead(blueprint).then((resolution) => resolution.environmentFacts),
      templateEnvironmentFacts: (templateId) =>
        templateRead(blueprint, templateId).then((resolution) => resolution.environmentFacts),
      environmentFactsRead: () => teamRead(blueprint),
      templateEnvironmentFactsRead: (templateId) => templateRead(blueprint, templateId),
      consents: [],
      availability: [],
    })

  return { provider, substratePlan, teamRead, templateRead, preflight }
}

// --- T1 — composable presets under BESPOKE ids: the kind PASSES, no seed -------

describe('T1 — bespoke composable preset ids, v2 teamRequirement `standard`, no seed', () => {
  it('the team-scope preflight PASSES (pre-fix the kind subject was unknown ⇒ seed-less FATAL)', async () => {
    const world = makeWorld({
      rootPresetId: 'ptc/team-small-ctb',
      memberPresetId: 'ptc/member-custom',
      observer: observerFor({
        'ptc/team-small-ctb': 'standard',
        'ptc/member-custom': 'standard',
      }),
    })
    const resolution = await world.teamRead(PK_TEAM)
    // The provider reads the ROOT entry's OBSERVED kind for the team scope
    // (the subject is the required kind, not a preset id — neither mounted
    // id equals `standard`).
    expect(resolution.observations[0]).toMatchObject({
      type: 'persona',
      subject: 'standard',
      readiness: PROBE_VERDICTS.reachable,
      readinessSource: 'substrate-resolver',
    })
    expect(resolution.observations[0]!.readinessReason).toBeUndefined()
    // The engine feed keys the fact by the KIND subject (available:true).
    expect(resolution.environmentFacts).toEqual([
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ])
    // The real creation preflight (root.ts's port shape): PROCEED, no seed.
    const result = await world.preflight(PK_TEAM)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
    const teamScope = result.scopes.find((scope) => scope.scope.level === 'team')!
    expect(teamScope.state).toBe(SCOPE_STATES.ready)
  })

  it('evaluateCreationScopes agrees: the team verdict is PASS with the typed reason', async () => {
    const world = makeWorld({
      rootPresetId: 'ptc/team-small-ctb',
      memberPresetId: 'ptc/member-custom',
      observer: observerFor({
        'ptc/team-small-ctb': 'standard',
        'ptc/member-custom': 'standard',
      }),
    })
    const evaluation = await evaluateCreationScopes({
      blueprint: PK_TEAM,
      environmentFacts: () => world.teamRead(PK_TEAM).then((resolution) => resolution.environmentFacts),
      environmentFactsRead: () => world.teamRead(PK_TEAM),
    })
    expect(evaluation.scopeVerdicts['team']).toEqual([
      expect.objectContaining({ requirementId: TEAM_REQ_ID, outcome: REQUIREMENT_OUTCOMES.pass }),
    ])
  })
})

// --- T2 — R8 role split: root `standard` / member `complete` --------------------

describe('T2 — root observes `standard`, member observes `complete` (R8 split)', () => {
  it('the team scope PASSES on the ROOT observation; the member template scope FATALs on the MEMBER observation', async () => {
    const world = makeWorld({
      rootPresetId: 'ptc/team-small-ctb',
      memberPresetId: 'ptc/member-custom',
      observer: observerFor({
        'ptc/team-small-ctb': 'standard',
        'ptc/member-custom': 'complete',
      }),
    })
    // Team scope: the ROOT entry observes `standard` → reachable.
    const teamResolution = await world.teamRead(PK_FULL)
    expect(teamResolution.observations[0]).toMatchObject({
      subject: 'standard',
      readiness: PROBE_VERDICTS.reachable,
    })
    // Member template scope: the MEMBER entry observes `complete` → the
    // §13.5 conflict (unreachable, typed reason naming the MEMBER preset).
    const workerResolution = await world.templateRead(PK_FULL, 'worker')
    expect(workerResolution.observations[0]).toMatchObject({
      subject: 'standard',
      readiness: PROBE_VERDICTS.unreachable,
    })
    expect(workerResolution.observations[0]!.readinessReason).toContain('ptc/member-custom')
    expect(workerResolution.observations[0]!.readinessReason).toContain('complete effective persona')
    // B3: the complete observation surfaces the OBSERVED kind as an
    // alongside world fact (the engine's typed §13.5 lane keys on exactly
    // that fact — the kind-subject fact keying is preserved).
    expect(workerResolution.environmentFacts).toEqual([
      { domain: 'persona', subject: 'complete', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: false, generation: 1 },
    ])
    // The typed lane end-to-end over the REAL provider feed: the worker
    // requirement's engine verdict carries the FROZEN conflict code.
    const workerEngine = evaluateCompatibility({
      requirements: scopeRequirementInputsOf(PK_FULL).templates['worker'] ?? [],
      environmentFacts: workerResolution.environmentFacts,
    })
    expect(workerEngine.requirements[0]?.outcome).toBe('FATAL')
    expect(workerEngine.requirements[0]?.reasonCode).toBe(
      COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT,
    )

    const result = await world.preflight(PK_FULL)
    // The team scope is ready (root observation); the WORKER template scope
    // is blocked (member observation) → the fixOrDisable outcome (a
    // template-scope required down — repair + recheck, or disable).
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fixOrDisable)
    expect(result.fatalRequirementIds).toEqual([])
    expect(result.fixOrDisableRequirementIds).toEqual([WORKER_REQ_ID])
    expect(blockedScopeKeysOf(result)).toEqual([scopeKey({ level: 'template', templateId: 'worker' })])
    const teamScope = result.scopes.find((scope) => scope.scope.level === 'team')!
    const workerScope = result.scopes.find(
      (scope) => scope.scope.level === 'template' && scope.scope.templateId === 'worker',
    )!
    expect(teamScope.state).toBe(SCOPE_STATES.ready)
    expect(workerScope.state).toBe(SCOPE_STATES.blocked)
    // The engine verdicts (the per-scope truth): team PASS, worker FATAL.
    const evaluation = await evaluateCreationScopes({
      blueprint: PK_FULL,
      environmentFacts: () => world.teamRead(PK_FULL).then((resolution) => resolution.environmentFacts),
      templateEnvironmentFacts: (templateId) =>
        world.templateRead(PK_FULL, templateId).then((resolution) => resolution.environmentFacts),
      environmentFactsRead: () => world.teamRead(PK_FULL),
      templateEnvironmentFactsRead: (templateId) => world.templateRead(PK_FULL, templateId),
    })
    expect(evaluation.scopeVerdicts['team']).toEqual([
      expect.objectContaining({ requirementId: TEAM_REQ_ID, outcome: REQUIREMENT_OUTCOMES.pass }),
    ])
    expect(evaluation.scopeVerdicts[scopeKey({ level: 'template', templateId: 'worker' })]).toEqual([
      expect.objectContaining({ requirementId: WORKER_REQ_ID, outcome: REQUIREMENT_OUTCOMES.fatal }),
    ])
  })
})

// --- T3 — root observes `complete`: structural FATAL, no downgrade --------------

describe('T3 — root observes `complete` (the §13.5 conflict)', () => {
  it('the team scope FATALs with the typed conflict observation (no downgrade through the kind path)', async () => {
    const world = makeWorld({
      rootPresetId: 'minimal',
      memberPresetId: 'minimal',
      observer: observerFor({ minimal: 'complete' }),
    })
    const resolution = await world.teamRead(PK_TEAM)
    expect(resolution.observations[0]).toMatchObject({
      subject: 'standard',
      readiness: PROBE_VERDICTS.unreachable,
    })
    expect(resolution.observations[0]!.readinessReason).toContain('complete effective persona')
    // B3: the complete observation surfaces the OBSERVED kind as an
    // alongside world fact — the engine's typed §13.5 lane keys on exactly
    // that fact (without it the host lane degraded to the generic
    // PERSONA_INCOMPATIBLE).
    expect(resolution.environmentFacts).toEqual([
      { domain: 'persona', subject: 'complete', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: false, generation: 1 },
    ])
    // The typed lane end-to-end over the REAL provider feed: the explicit
    // FROZEN conflict reasonCode (not just prose/FATAL).
    const engineResult = evaluateCompatibility({
      requirements: scopeRequirementInputsOf(PK_TEAM).team,
      environmentFacts: resolution.environmentFacts,
    })
    expect(engineResult.requirements[0]?.outcome).toBe('FATAL')
    expect(engineResult.requirements[0]?.reasonCode).toBe(
      COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT,
    )
    const result = await world.preflight(PK_TEAM)
    // A confirmed team-level required down → the FATAL outcome (not
    // reclassified pending: a confirmed down stands — D-3 precedence).
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fatalRequirementIds).toEqual([TEAM_REQ_ID])
  })
})

// --- T4 — typed observer failure: `unresolved` ⇒ unknown ⇒ fail-closed ----------

describe('T4 — the observer fails typed (unresolved)', () => {
  it('no seed ⇒ unknown ⇒ the fact is omitted ⇒ the preflight FATALs (fail-closed, NOT pending)', async () => {
    const world = makeWorld({
      rootPresetId: 'ptc/team-small-ctb',
      memberPresetId: 'ptc/member-custom',
      observer: observerFor({
        'ptc/team-small-ctb': 'unresolved',
        'ptc/member-custom': 'unresolved',
      }),
    })
    const resolution = await world.teamRead(PK_TEAM)
    expect(resolution.observations[0]).toMatchObject({
      subject: 'standard',
      readiness: PROBE_VERDICTS.unknown,
    })
    expect(resolution.observations[0]!.readinessReason).toContain('unresolved')
    expect(resolution.observations[0]!.readinessReason).toContain('agentPresets seam failed')
    // The persona observation is NON-probeable (no `persona` probe port —
    // the production structural fact): the legacy 2-state stands, the
    // unknown is re-probable, never the transient PENDING window.
    expect(resolution.observations[0]!.probeable).toBe(false)
    // unknown + no seed → the fact is omitted (the engine's unprobed
    // sentinel) → the required subject is missing → FATAL.
    expect(resolution.environmentFacts).toEqual([])
    const result = await world.preflight(PK_TEAM)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.outcome).not.toBe(PREFLIGHT_OUTCOMES.pending)
    expect(result.fatalRequirementIds).toEqual([TEAM_REQ_ID])
  })

  it('WITH a bootstrap seed available:true the seed truth decides ⇒ proceed (the documented 2-state)', async () => {
    const world = makeWorld({
      rootPresetId: 'ptc/team-small-ctb',
      memberPresetId: 'ptc/member-custom',
      observer: observerFor({
        'ptc/team-small-ctb': 'unresolved',
        'ptc/member-custom': 'unresolved',
      }),
      seedFacts: [{ domain: 'persona', subject: 'standard', available: true, generation: 5 }],
    })
    const resolution = await world.teamRead(PK_TEAM)
    expect(resolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.unknown)
    // The seed feeds ONLY the unknown live verdict (the marked bootstrap
    // fact — never a live override).
    expect(resolution.environmentFacts).toEqual([
      {
        domain: 'persona',
        subject: 'standard',
        available: true,
        generation: 5,
        detail: 'bootstrap seed (config.environmentFacts) — not runtime truth',
      },
    ])
    const result = await world.preflight(PK_TEAM)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
  })

  it('WITH a bootstrap seed available:false the seed truth decides ⇒ FATAL (the 2-state is not a blanket OPEN)', async () => {
    const world = makeWorld({
      rootPresetId: 'ptc/team-small-ctb',
      memberPresetId: 'ptc/member-custom',
      observer: observerFor({
        'ptc/team-small-ctb': 'unresolved',
        'ptc/member-custom': 'unresolved',
      }),
      seedFacts: [{ domain: 'persona', subject: 'standard', available: false, generation: 5 }],
    })
    const resolution = await world.teamRead(PK_TEAM)
    expect(resolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.unknown)
    expect(resolution.environmentFacts).toEqual([
      {
        domain: 'persona',
        subject: 'standard',
        available: false,
        generation: 5,
        detail: 'bootstrap seed (config.environmentFacts) — not runtime truth',
      },
    ])
    const result = await world.preflight(PK_TEAM)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
  })
})

// --- T5 — frozen v1 preset-id semantics stay byte-identical ---------------------

describe('T5 — the frozen v1 preset-ID convention (unchanged legacy path)', () => {
  it('a NON-kind subject keeps the legacy root/member preset-id matching (v1 frozen Blueprint cold resume)', async () => {
    // Subjects that are NOT closed required persona kinds (`ptc` / `minimal`
    // / `mystery`) go through the LEGACY path byte-for-byte: subject ==
    // plan.root.presetId → the root entry; subject == plan.member.presetId
    // → the member entry; otherwise the typed unknown mismatch. (The full
    // v1 suite — runtime-requirement-facts-provider.test.ts L287–353 — runs
    // unchanged in the focused area; this is the same chain through the
    // REAL resolver for the mixed root/member world.)
    const world = makeWorld({
      rootPresetId: 'ptc',
      memberPresetId: 'minimal',
      observer: observerFor({ ptc: 'standard', minimal: 'complete' }),
    })
    // Legacy root match: subject 'ptc' → the root entry (standard).
    const rootResolution = await world.provider.resolveFacts({
      requirements: [{ requirementId: 'legacy-root', type: 'persona', subjects: ['ptc'], complete: true }],
      scope: { kind: 'team' },
    })
    expect(rootResolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.reachable)
    expect(rootResolution.environmentFacts).toEqual([
      { domain: 'persona', subject: 'ptc', available: true, generation: 1 },
    ])
    // Legacy member match (template scope): subject 'minimal' → the MEMBER
    // entry (complete → the §13.5 conflict).
    const memberResolution = await world.provider.resolveFacts({
      requirements: [{ requirementId: 'legacy-member', type: 'persona', subjects: ['minimal'], complete: true }],
      scope: { kind: 'template', templateId: 'worker', role: 'member' },
    })
    expect(memberResolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.unreachable)
    expect(memberResolution.observations[0]!.readinessReason).toContain('complete effective persona')
    // Legacy mismatch: a subject that is neither mounted preset id → the
    // typed unknown (the frozen wording).
    const mismatchResolution = await world.provider.resolveFacts({
      requirements: [{ requirementId: 'legacy-mismatch', type: 'persona', subjects: ['other-preset'], complete: true }],
      scope: { kind: 'team' },
    })
    expect(mismatchResolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.unknown)
    expect(mismatchResolution.observations[0]!.readinessReason).toContain('not the observed root/member preset')
    expect(mismatchResolution.environmentFacts).toEqual([])
  })

  it('a kind subject resolves through the KIND path even when the mounted id equals a preset (no legacy shadowing)', async () => {
    // `standard` IS a closed required kind: the kind path addresses the
    // scope's role (team ⇒ root) regardless of the mounted preset id — a
    // world where the root preset id is a bespoke one but the preset
    // OBSERVES `standard` satisfies the required kind (the PR #22 donor
    // invariant: preset id ≠ persona kind).
    const world = makeWorld({
      rootPresetId: 'team-small-ctx',
      memberPresetId: 'team-small-ctx',
      observer: observerFor({ 'team-small-ctx': 'standard' }),
    })
    const resolution = await world.teamRead(PK_TEAM)
    expect(resolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.reachable)
    expect(resolution.environmentFacts).toEqual([
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ])
    const result = await world.preflight(PK_TEAM)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
  })
})

// --- T6 — end-to-end: the creation preflight root.ts drives ---------------------

describe('T6 — end-to-end through the creation preflight (root.ts port shape)', () => {
  it('a v2 blueprint with the persona teamRequirement `standard` + a mounted composable preset PASSES with no seed', async () => {
    // The same seam set the production host binds: `substratePlan` = the
    // real resolver over the observer double (host.ts `resolveSubstratePlan`
    // — the row preset ids + the production persona observer), `seedFacts` =
    // the row `config.environmentFacts` (here: empty — a fresh create),
    // readiness = the real provider (the mcpServer-only probe registry).
    const world = makeWorld({
      rootPresetId: 'ptc/team-small-ctb',
      memberPresetId: 'ptc/team-small-ctb',
      observer: observerFor({ 'ptc/team-small-ctb': 'standard' }),
      // config.environmentFacts — the row bootstrap seed (absent here: the
      // pre-bind default is NO seed — the live observation is the truth).
      seedFacts: [],
    })
    // One shared id probes once (the resolver's memoization — the real
    // plan carries one observation for both roles).
    const plan = await world.substratePlan()
    expect(plan.root.presetId).toBe('ptc/team-small-ctb')
    expect(plan.member.presetId).toBe('ptc/team-small-ctb')
    expect(plan.root.persona.kind).toBe('standard')
    expect(plan.member.persona).toBe(plan.root.persona)

    // The creation preflight exactly as root.ts drives it (the full
    // per-create scoping, the full-resolution read ports, the pre-bind
    // durable defaults): PROCEED with NO seed — the create path and the
    // probe path share the same provider verdict (the probe/create split
    // the review flagged is closed by the shared kind semantics).
    const result = await world.preflight(PK_TEAM)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
    expect(blockedScopeKeysOf(result)).toEqual([])

    // The same world with a DIFFERENT mounted id for the member role still
    // passes on the team scope (the member observation feeds only the
    // template scopes) — the bespoke-id case end-to-end.
    const mixedWorld = makeWorld({
      rootPresetId: 'ptc/team-small-ctb',
      memberPresetId: 'ptc/member-custom',
      observer: observerFor({
        'ptc/team-small-ctb': 'standard',
        'ptc/member-custom': 'standard',
      }),
      seedFacts: [],
    })
    expect((await mixedWorld.preflight(PK_TEAM)).outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
  })

  it('the SAME chain with a complete mounted preset FATALs end-to-end (no false OPEN)', async () => {
    const world = makeWorld({
      rootPresetId: 'minimal',
      memberPresetId: 'minimal',
      observer: observerFor({ minimal: 'complete' }),
      seedFacts: [],
    })
    const result = await world.preflight(PK_TEAM)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fatalRequirementIds).toEqual([TEAM_REQ_ID])
    expect(blockedScopeKeysOf(result)).toEqual(['team'])
    // B3: the typed lane end-to-end — the SAME shipped-chain feed drives
    // the engine's FROZEN §13.5 conflict code.
    const engineResult = evaluateCompatibility({
      requirements: scopeRequirementInputsOf(PK_TEAM).team,
      environmentFacts: (await world.teamRead(PK_TEAM)).environmentFacts,
    })
    expect(engineResult.requirements[0]?.reasonCode).toBe(
      COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT,
    )
  })
})

// --- Blocker-1 — leader/member role identity (external review, P1) ----------------

// The LEADER template carries the persona requirement (the member template
// declares none — the "no member requirement" world the review's concrete
// regression pins): the leader block of the v2 document gets the SAME
// structured-requirements shape the worker block uses (the closed leader
// schema = the member schema; the v2 validator accepts it).
const LEADER_PERSONA_LINE = '  persona: You lead the persona-kind team.'
const LEADER_REQ_BLOCK = [
  '  requirements:',
  '    - requirementId: req-persona-standard-leader',
  '      type: persona',
  '      subjects:',
  '        - standard',
  '      complete: true',
].join('\n')

/**
 * Blocker-1 shape — ONLY the leader template requires `standard` (a pure
 * leader world: the v2 document carries NO team requirements — ABSENT =
 * omitted — and the member template declares none either; the exact
 * shape of the review's concrete regression).
 */
const PK_NO_TEAM_SOURCE = PK_TEAM_SOURCE.replace(
  [
    'requirements: []',
    'teamRequirements:',
    '  - requirementId: req-persona-standard-team',
    '    type: persona',
    '    subjects:',
    '      - standard',
    '    complete: true',
  ].join('\n'),
  'requirements: []',
)

/** Blocker-1 shape — ONLY the leader template requires `standard`. */
const PK_LEADER_SOURCE = PK_NO_TEAM_SOURCE.replace(
  LEADER_PERSONA_LINE,
  `${LEADER_PERSONA_LINE}\n${LEADER_REQ_BLOCK}`,
)

/**
 * Blocker-1 both-roles shape — the leader AND the worker require
 * `standard` (the v2 document ALSO carries the team requirement — in the
 * BL3 world the team scope passes on the ROOT observation, isolating the
 * per-template role dispatch).
 */
const PK_LEADER_AND_WORKER_SOURCE = PK_FULL_SOURCE_WITH_WORKER.replace(
  LEADER_PERSONA_LINE,
  `${LEADER_PERSONA_LINE}\n${LEADER_REQ_BLOCK}`,
)

const PK_LEADER = parseBlueprint(PK_LEADER_SOURCE)
const PK_LEADER_AND_WORKER = parseBlueprint(PK_LEADER_AND_WORKER_SOURCE)

const LEADER_REQ_ID = 'req-persona-standard-leader'

describe('Blocker-1 — the template scope carries its role (leader ≠ member observation)', () => {
  it('BL1: a HEALTHY leader template PASSES on the leader OWN (root) observation — the no-member-requirement world (pre-fix: judged by the MEMBER entry ⇒ spurious FATAL)', async () => {
    // The review's concrete regression, direction 1: root preset id
    // `standard` (observed standard), member preset id `minimal` (observed
    // complete), the LEADER requires `standard`, NO member requirement
    // (and no team requirement — the pure leader world).
    // The leader IS the root (the root mounts config.rootPresetId —
    // agent-bindings v3; plan §C.2: the ROOT plan entry is the actual preset
    // used by the Leader): the leader scope must read the ROOT observation
    // (`standard` → composable), not the member's (`complete`).
    const world = makeWorld({
      rootPresetId: 'standard',
      memberPresetId: 'minimal',
      observer: observerFor({ standard: 'standard', minimal: 'complete' }),
    })
    const resolution = await world.templateRead(PK_LEADER, 'leader')
    expect(resolution.observations[0]).toMatchObject({
      subject: 'standard',
      readiness: PROBE_VERDICTS.reachable,
    })
    expect(resolution.environmentFacts).toEqual([
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ])
    const result = await world.preflight(PK_LEADER)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
    expect(blockedScopeKeysOf(result)).toEqual([])
    const leaderScope = result.scopes.find(
      (scope) => scope.scope.level === 'template' && scope.scope.templateId === 'leader',
    )!
    expect(leaderScope.state).toBe(SCOPE_STATES.ready)
  })

  it('BL2: a leader whose OWN observation is `complete` FATALs with the leader observation (pre-fix: FALSE PASS — the leader was judged by the member entry)', async () => {
    // Direction 2 (the inverse): root preset id `minimal` (observed
    // complete), member preset id `standard` (observed standard), the
    // LEADER requires `standard`. The leader's own mounted preset is the
    // complete one — the structural §13.5 conflict belongs to the LEADER
    // scope (its verdict FATALs; the preflight classifies a blocked
    // template scope as fixOrDisable — the human may disable the leader
    // template or repair the preset). What is asserted is the preflight
    // verdict, not an execution claim: the bind-time persona slot (root.ts
    // presetSeam) reads the ROOT entry and has its own guard downstream.
    const world = makeWorld({
      rootPresetId: 'minimal',
      memberPresetId: 'standard',
      observer: observerFor({ minimal: 'complete', standard: 'standard' }),
    })
    const resolution = await world.templateRead(PK_LEADER, 'leader')
    expect(resolution.observations[0]).toMatchObject({
      subject: 'standard',
      readiness: PROBE_VERDICTS.unreachable,
    })
    // The typed reason names the LEADER's own (root) preset — not the
    // member's `standard` id (which would be the pre-fix misjudgment).
    expect(resolution.observations[0]!.readinessReason).toContain('minimal')
    expect(resolution.observations[0]!.readinessReason).toContain('complete effective persona')

    const result = await world.preflight(PK_LEADER)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fixOrDisable)
    expect(blockedScopeKeysOf(result)).toEqual([scopeKey({ level: 'template', templateId: 'leader' })])
    expect(result.fixOrDisableRequirementIds).toEqual([LEADER_REQ_ID])
    // The engine verdict of the leader scope: FATAL (the leader's own
    // complete observation — never the member's standard one).
    // The team ports are REQUIRED (the evaluator always reads the team
    // scope — here against the EMPTY team inputs, the pure leader world).
    const evaluation = await evaluateCreationScopes({
      blueprint: PK_LEADER,
      environmentFacts: () => world.teamRead(PK_LEADER).then((r) => r.environmentFacts),
      templateEnvironmentFacts: (templateId) =>
        world.templateRead(PK_LEADER, templateId).then((r) => r.environmentFacts),
      environmentFactsRead: () => world.teamRead(PK_LEADER),
      templateEnvironmentFactsRead: (templateId) => world.templateRead(PK_LEADER, templateId),
    })
    expect(evaluation.scopeVerdicts[scopeKey({ level: 'template', templateId: 'leader' })]).toEqual([
      expect.objectContaining({ requirementId: LEADER_REQ_ID, outcome: REQUIREMENT_OUTCOMES.fatal }),
    ])
  })

  it('BL3: in ONE world, the leader template is judged by the ROOT observation and the member template by the MEMBER observation (per-template role dispatch)', async () => {
    // Both-roles world: the leader AND the worker require `standard`; the
    // root observes `standard`, the member observes `complete`. The SAME
    // provider, SAME plan: the leader scope passes (root observation)
    // while the worker scope blocks (member observation) — the role is
    // carried PER TEMPLATE, not a single template-scope default.
    const world = makeWorld({
      rootPresetId: 'ptc/team-small-ctb',
      memberPresetId: 'ptc/member-custom',
      observer: observerFor({
        'ptc/team-small-ctb': 'standard',
        'ptc/member-custom': 'complete',
      }),
    })
    const result = await world.preflight(PK_LEADER_AND_WORKER)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fixOrDisable)
    expect(blockedScopeKeysOf(result)).toEqual([scopeKey({ level: 'template', templateId: 'worker' })])
    const leaderScope = result.scopes.find(
      (scope) => scope.scope.level === 'template' && scope.scope.templateId === 'leader',
    )!
    const workerScope = result.scopes.find(
      (scope) => scope.scope.level === 'template' && scope.scope.templateId === 'worker',
    )!
    expect(leaderScope.state).toBe(SCOPE_STATES.ready)
    expect(workerScope.state).toBe(SCOPE_STATES.blocked)
    // The two scopes read DIFFERENT plan entries for the SAME subject.
    const leaderResolution = await world.templateRead(PK_LEADER_AND_WORKER, 'leader')
    expect(leaderResolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.reachable)
    const workerResolution = await world.templateRead(PK_LEADER_AND_WORKER, 'worker')
    expect(workerResolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.unreachable)
  })
})
