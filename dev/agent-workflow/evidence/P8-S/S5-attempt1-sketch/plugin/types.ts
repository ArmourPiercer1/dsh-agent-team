/**
 * P8-S5 — the production plugin type surface (plan §19.1 Goal 1).
 *
 * This module is the type-only contract of the shipped production Team
 * plugin row (`./host.ts`). It declares:
 *
 * - {@link TeamPluginConfig} — the JSON-safe composition core (team
 *   identity, blueprint source, boot phase, static model baseline, MCP
 *   server identity, the test-fixture seed materialization, the child
 *   session id derivation, the overlay installation switch);
 * - {@link TeamPluginSubstrate} — the in-process dependency bag (function
 *   ports, the optional live-world injection, the optional durable
 *   mutation store);
 * - {@link TeamLivePorts} — the live-world port bundle (the DSH
 *   residency/agent layer + the node:fs legacy home + the handoff source
 *   surface and team creation); in the sanctioned test chain these ports
 *   are injected fakes, and the `./live/*.mjs` modules that implement them
 *   for a real DSH world are loaded ONLY through dynamic `import()` in
 *   `host.ts` (they carry the bare `@deepseek-ai/*` + `node:` imports that
 *   the sanctioned chain must never resolve);
 * - {@link TeamProductionRoot} — the single assembly point of the plan
 *   §19.1 subsystem list (the twenty items, one named property each),
 *   plus the explicit S6 installation seams ({@link TeamSeamRegistry})
 *   sanctioned by the §19.1 caveat ("如果 Projection/Remote 尚由 S6 完成，
 *   则 production root 中提供明确 installation seam，S6 接入").
 *
 * Pure module: no I/O, no `node:` builtins, no DSH imports — the live
 * world is reachable only through the structural ports declared here.
 *
 * @module @dsh-agent-team/runtime/plugin/types
 */

import type {
  TeamDomain,
  TeamDomainRepositories,
} from '../../../storage/repositories/team-domain.js'
import type { StorageDomainSeam } from '../../../storage/schema/seam.js'
import type {
  BlueprintCatalog,
  TeamBlueprint,
} from '../../../domain/blueprint/src/index.js'
import type {
  CompatibilityResult,
  EnvironmentFact,
  RequirementInput,
} from '../../../domain/compatibility/src/index.js'
import type { ExternalPolicyFacts } from '../../../domain/policy/src/index.js'
import type {
  ColdRootBindingInput,
  FreshRootBindingInput,
  RootBindingResult,
} from '../../root-binding/index.js'
import type {
  ColdMemberResult,
  DerivedMemberIdentity,
  EvictSettledMemberResult,
  FreshMemberResult,
  MemberCreateSpec,
  ResidencyPort,
  SessionDurabilityPort,
} from '../../member-residency/index.js'
import type {
  OverlaySlot,
  TeamAgentBinder,
  TeamAgentSetupSurface,
  TeamDomainReadHandle,
} from '../../agent-setup/binder/index.js'
import type {
  ActivationProvider,
  ChildSessionFactoryPort,
} from '../../activation/types.js'
import type {
  ActionCaller,
  TeamRuntime,
  WorkActivityPort,
  WorkDeliveryPort,
} from '../../admission/types.js'
import type {
  LifecyclePorts,
  LifecycleService,
} from '../../lifecycle/index.js'
import type { ControlService } from '../../control/index.js'
import type {
  MessagingCoordinator,
  SessionInputPort,
} from '../../messaging/index.js'
import type { ActivityLedger } from '../../activity/index.js'
import type {
  CompatibilityAuthority,
  CompatibilityProber,
} from '../../compatibility/index.js'
import type {
  ForkReconciliationInput,
  ForkReconciliationResult,
} from '../../fork-reconciliation/index.js'
import type {
  HandoffService,
  HandoffSourceSurfacePort,
  HandoffSummarizerPort,
  HandoffTeamCreationPort,
  HandoffTeamIntent,
} from '../../handoff/index.js'
import type {
  LiveResidencyOverlayPort,
  ProjectionService,
  TeamDomainReadPort,
} from '../../projection/index.js'
import type {
  AdmittedGovernanceOverride,
  AdmitGovernanceOverrideArgs,
  MutationAuthority,
} from '../../mutation/index.js'
import type { MutationService, MutationServiceDeps } from '../../mutation/service.js'
import type {
  HandoffSummary,
  SourceCanonicalSurface,
} from '../../handoff/index.js'
// ---------------------------------------------------------------------------
// Structural mirror of the frozen legacy session-reader surface
// ---------------------------------------------------------------------------
//
// The frozen packages/legacy package carries NO tsconfig and its sources
// contain type-level defects (readonly-property assignments in
// ormat.ts) that are invisible to the sanctioned chain (plain node +
// native type stripping never type-checks) but fail as soon as the sources
// enter this package's tsc program. The production plugin therefore never
// imports the legacy sources directly: the two runtime entry points
// (inspectLegacyTeam, dispatchReaderAction) arrive through the live
// ./live/legacy-reader.mjs re-export adapter (a .mjs file is outside the
// tsc program — llowJs is off — and its inner legacy import is resolved
// by the chain/live loader hooks in both worlds), and the type surface
// below MIRRORS the frozen reader's closed types structurally. Field-for-
// field equivalence with @dsh-agent-team/legacy session-reader/types
// is pinned by the legacy package's own test suite (frozen, untouched).

/** The roster discovery sources, in legacy precedence order. */
export type LegacyRosterSource = 'home' | 'workspace'

/** One directory entry as reported by the read-only home port. */
export interface LegacyHomeEntry {
  readonly name: string
  readonly kind: 'file' | 'dir'
}

/**
 * The read-only legacy-home filesystem port (mirror): best-effort by
 * contract — a missing path returns undefined, never throws.
 */
export interface LegacyHomePort {
  listDir(path: string): readonly LegacyHomeEntry[] | undefined
  readFile(path: string): string | undefined
}

/** The inspect request (the only input the reader accepts). */
export interface LegacyTeamInspectRequest {
  /** The DSH home root of the inspected (legacy) instance. */
  readonly dshHome: string
  /** The legacy workspace cwd (scans the workspace roster too). */
  readonly workspaceCwd?: string
  /** Optional scope narrowing to one project directory. */
  readonly projectDir?: string
}

/** One best-effort legacy roster member line. */
export interface LegacyRosterMember {
  readonly source: LegacyRosterSource
  readonly fileName: string
  readonly id?: string
  readonly role?: 'leader' | 'teammate'
  readonly name?: string
  readonly description?: string
}

/** One best-effort roster warning (a line that could not be read). */
export interface LegacyRosterWarning {
  readonly source: LegacyRosterSource
  readonly fileName: string
  readonly reason: string
  readonly message: string
}

/** One scanned native session log summary (legacy + native alike). */
export interface LegacySessionEvidence {
  readonly sessionId: string | undefined
  readonly directoryId: string
  readonly projectDir: string
  readonly headerPresent: boolean
  readonly createdAt?: number
  readonly cwd?: string
  readonly origin?: 'subagent'
  readonly delegationDepth?: number
  readonly parentSession?: string
  readonly seedLength?: number
  readonly eventCount: number
  readonly unreadableLineCount: number
  readonly teamEventCounts: Readonly<Record<string, number>>
  readonly teamEventTotal: number
  readonly logDecodable: boolean
  readonly logArtifact: 'session.jsonl' | 'session.jsonl.zstd' | undefined
}

/** The best-effort legacy Team metadata (every field best-effort). */
export interface LegacyTeamMetadata {
  readonly teamId: string | undefined
  readonly leaderSessionId: string | undefined
  readonly leaderSelection: 'team-events' | 'roster-only'
  readonly roster: readonly LegacyRosterMember[]
  readonly rosterWarnings: readonly LegacyRosterWarning[]
  readonly sessions: readonly LegacySessionEvidence[]
  readonly memberChildSessionIds: readonly string[]
}

/** The successful legacy inspection result. */
export interface LegacyTeamView {
  readonly status: 'legacy-team'
  readonly team: LegacyTeamMetadata
}

/** The required degradation result (no legacy metadata found). */
export interface LegacyFallbackView {
  readonly status: 'native-fallback'
  readonly reason: 'no-legacy-metadata'
  readonly native: readonly LegacySessionEvidence[]
  readonly degradedTo: 'native-chat-trajectory'
}

/** The closed inspect result vocabulary. */
export type LegacyTeamInspection = LegacyTeamView | LegacyFallbackView
import type { SettleOutcome, WorkChainDeps } from '../../action-router/index.js'
import type {
  RemoteDispatcher,
  RemoteHandlerDeps,
  RemoteResponse,
} from '../../../remote/src/index.js'
import type { TeamToolSet } from '../../../tools/src/index.js'
import type { TeamSeamRegistry } from './seams.js'

// ---------------------------------------------------------------------------
// The JSON-safe composition core
// ---------------------------------------------------------------------------

/** One seeded member row of the test-fixture materialization (see
 *  {@link TeamPluginConfig.seedMembers}). */
export interface TeamSeedMemberSpec {
  /** The durable member instance id (fixture identity; the scenario
   *  expectations reference these exact ids). */
  readonly instanceId: string
  /** The blueprint template id (`worker` / `scout` in the p6t6 fixture). */
  readonly templateId: string
  /** The human-facing label. */
  readonly label: string
  /** The durable child session id of the member. */
  readonly childSessionId: string
}

/**
 * The JSON-safe composition core of one production Team plugin instance.
 *
 * Every field is lossless-JSON: a composition row (or a harness row that
 * forwards its boot directive) can carry the whole config as data. The
 * in-process-only dependencies (function ports, live services) live in
 * {@link TeamPluginSubstrate}, never here.
 */
export interface TeamPluginConfig {
  /** The root DSH session id of this team (= the TeamSession id,
   *  invariant 9). */
  readonly rootSessionId: string
  /** The blueprint YAML source (the canonical document the catalog is
   *  built from; the bound snapshot ref is derived from it). */
  readonly blueprintSource: string
  /** `create` seeds the durable TeamSession + root binding + the fixture
   *  member rows; `resume` opens the existing durable state (no seed). */
  readonly bootPhase: 'create' | 'resume'
  /** The static model baseline (the injected static model of the
   *  harness-world composition; the production default selection). */
  readonly staticModel: { readonly provider: string; readonly model: string }
  /** The denied selection marker (the fail-closed baseline when a
   *  consumption view has no durable selection). */
  readonly deniedSelection: { readonly provider: string; readonly model: string }
  /** The MCP server identity + the (nullable) live mini-MCP port of the
   *  test-world composition (`null` = no live MCP port available). */
  readonly mcpServer: { readonly name: string; readonly port: number | null }
  /** The test-fixture seed materialization (empty in a real deployment).
   *  Applied on the `create` boot phase only: durable member rows for the
   *  LEADER (bound to the root session itself) plus these members. */
  readonly seedMembers: readonly TeamSeedMemberSpec[]
  /** The team default workspace (inherited by members, §21.2). */
  readonly defaultWorkspace: string
  /** The initial TeamDomain generation stamp (1 on a fresh create). */
  readonly generation: number
  /** The child session id derivation prefix: the member child session of
   *  instance id `inst-XXXXX` is `${prefix}XXXXX` (the p6t6 composition
   *  uses `session-child-p6t6-`). */
  readonly childSessionIdPrefix: string
  /** Whether the overlay slots (persona/model/capability) are installed
   *  on the live Agent setup surface. `false` keeps the documented
   *  SD-SURFACE contract (the no-op surface; the post-commit binder
   *  resolves the durable member record through the real read handle).
   *  A real deployment composition sets this to `true`. */
  readonly overlayInstallationEnabled: boolean
}

// ---------------------------------------------------------------------------
// The in-process substrate
// ---------------------------------------------------------------------------

/**
 * The in-process dependency bag of one production Team plugin instance.
 *
 * Not JSON-safe: it carries function ports. `environmentFacts` is the
 * REQUIRED live-environment read (the compatibility plane's input);
 * everything else is optional with documented defaults.
 */
export interface TeamPluginSubstrate {
  /** The live environment facts read (pure read; the compatibility
   *  engine's input). */
  readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>
  /** The external policy facts (default: `{ hard: {}, capabilityExists: {} }`). */
  readonly externalPolicyFacts?: () => Promise<ExternalPolicyFacts>
  /** The wall clock (ISO-8601; default: `new Date().toISOString()`). */
  readonly now?: () => string
  /** The live-world port bundle. When absent, `host.ts` builds it from
   *  the DSH services through the dynamic `./live/*.mjs` imports (the
   *  real deployment path); the sanctioned test chain always injects it. */
  readonly live?: TeamLivePorts
  /** The optional durable store of the P7-T2 mutation service plane.
   *  When absent, `root.mutation.service` is the fail-closed installation
   *  seam (the P7-T2 record family has no home in the frozen TeamDomain
   *  schema v1 — see S5-result.md). */
  readonly mutationServiceDeps?: MutationServiceDeps
  /** The observation sink (test-world diagnostics; the harness row routes
   *  its notes through it). */
  readonly observationSink?: (note: string) => void
}

// ---------------------------------------------------------------------------
// The live-world ports
// ---------------------------------------------------------------------------

/**
 * One live Agent session handle (opaque to the production .ts layer: the
 * live module owns the DSH Agent surface; the row's observability routes
 * read the same handle through the row-side handle).
 */
export interface TeamLiveSessionHandle {
  /** Opaque DSH Agent handle (the live module's `handle.agent`). */
  readonly agent: unknown
}

/**
 * The live-world port bundle of one production Team plugin instance.
 *
 * The sanctioned test chain injects fakes for every member; a real DSH
 * world builds the bundle from the DSH services through the dynamic
 * `./live/*.mjs` imports (see `host.ts`). The live module is constructed
 * BEFORE the subsystem assembly and receives the opened TeamDomain at
 * construction time; `bindRoot` closes the one late-binding loop (the
 * agent setup's tool registration reads the assembled tool set at setup
 * execution time, which always postdates the full assembly).
 */
export interface TeamLivePorts {
  /** The storage seam the TeamDomain was opened on (the DSH
   *  `storageDomain` service adapter, or the test seam). */
  readonly storageSeam: StorageDomainSeam
  /** The live session registry (sessionId -> handle); the row's
   *  observability routes read the keys. */
  readonly liveSessions: Map<string, TeamLiveSessionHandle>
  /** The per-session consumption state snapshot for the row's state route
   *  (undefined when the session has no consumption state). */
  readonly consumptionSnapshot: (
    sessionId: string,
  ) => Record<string, unknown> | undefined
  /** The live observation notes, in order. */
  readonly liveObservations: () => readonly string[]
  /** The agent setup factory: one setup closure per session id (the
   *  DSH `agents` create/resume `setup` callback). */
  readonly agentSetup: (sessionId: string) => (agentCtx: unknown) => Promise<void>
  /** The child-session factory (the ONE external effect of the
   *  provisioning protocol; the activation provider's creation path —
   *  idempotent on `(rootSessionId, instanceId)` per the R20 contract). */
  readonly childFactory: ChildSessionFactoryPort
  /** The live-agent-or-resume resolver (the SD-CALLER execution binding). */
  readonly ensureLiveAgent: (sessionId: string) => Promise<TeamLiveSessionHandle>
  /** The instance id bound to one session (root -> leader instance;
   *  member child -> its instance; throws otherwise). */
  readonly instanceIdForSession: (sessionId: string) => string
  /** The messaging coordinator's session input port (the real
   *  `submitAttributedInput` over the public Session input API). */
  readonly sessionInput: SessionInputPort
  /** The P8-S3 work delivery port (model-visible delivery + the turn
   *  quiescence wait + the durable materialization). */
  readonly workDelivery: WorkDeliveryPort
  /** The P7-T3 lifecycle ports over the real production surfaces (commit
   *  = the P8-S3 CAS repository surface; activity.interrupt = the public
   *  Agent cancel; descendants = the public whenIdle quiescence;
   *  residency = the live handle map). */
  readonly lifecyclePorts: LifecyclePorts
  /** The session durability port (the `sessionPersistence` seam: a live
   *  handle must exist before materialization). */
  readonly sessionDurability: SessionDurabilityPort
  /** The overlay slots the live world constructs over the DSH prompt-
   *  assembly seam (the S6 installation surface). The p6t6 test-world
   *  bundle returns `[]` (the SD-SURFACE no-op contract is unchanged);
   *  the production root exposes them verbatim so the binder wiring is
   *  reachable, and a real deployment composition installs the persona /
   *  model / capability slots here (plan §19.1 caveat: S6 接入). */
  readonly overlaySlots: readonly {
    readonly name: string
    readonly slot: OverlaySlot
  }[]
  /** The residency port (the live handle map view). */
  readonly residency: ResidencyPort
  /** The action caller resolution (the SD-CALLER map: root session ->
   *  leader instance caller; member child -> its instance caller). */
  readonly resolveCaller: (sessionId: string) => Promise<ActionCaller>
  /** The legacy home read port (node:fs over the DSH_HOME sessions dir). */
  readonly legacyHome: LegacyHomePort
  /** The handoff source canonical surface read (the public Session query
   *  surface: read-only, snapshot-once semantics owned by the handoff
   *  service). */
  readonly sourceSurface: HandoffSourceSurfacePort
  /** The one-shot handoff summarizer. Absent in the p6t6 test-world
   *  composition -> the root installs the fail-closed seam
   *  (`HANDOFF_SUMMARIZER_NOT_INSTALLED`); a real deployment composition
   *  supplies the auxiliary summarization capability. */
  readonly summarizer?: HandoffSummarizerPort
  /** The handoff team creation port (the public Team creation entry:
   *  mint a fresh DSH root session + bind the fresh Team root from the
   *  staged intent's blueprint selection). */
  readonly teamCreation: HandoffTeamCreationPort
  /** Drop one live residency (row-stop / dispose backstop): forgets the
   *  resident handle and disposes the Agent; resolves `true` when a
   *  handle was dropped. */
  readonly dropResidency: (sessionId: string) => Promise<boolean>
  /** The boot agent materialization (create phase: root + the seeded
   *  member children; resume phase: root + every bound member child).
   *  The row awaits this after the full assembly (the tool stack must
   *  exist before the first agent is created). */
  readonly bootAgents: () => Promise<void>
  /** Close the live world (dispose every mounted mini-MCP fiber, release
   *  the tool disposers, clear the consumption state). */
  readonly close: () => Promise<void>
  /** The late-binding hook: `host.ts` calls it with the assembled root
   *  after `composeProductionRoot` returns. */
  readonly bindRoot: (root: TeamProductionRoot) => void
}

// ---------------------------------------------------------------------------
// The production root (the §19.1 assembly)
// ---------------------------------------------------------------------------

/** The TeamIntent / intent preflight service (plan §19.1 item 3; S1A A04):
 *  the pre-creation compatibility probe over the bound blueprint catalog —
 *  the production surface the remote `intent.probe` contract (A31) and the
 *  handoff team creation (A28) consume. The probing logic is the P7-T1
 *  compatibility plane (A14); the intent types are the frozen contract
 *  surface (`HandoffTeamIntent` + the remote catalog). */
export interface TeamIntentPreflightInput {
  /** The blueprint id to probe (resolved through the bound catalog). */
  readonly blueprintId: string
  /** The blueprint revision (the latest when absent). */
  readonly blueprintRevision?: string
}

/** The preflight outcome of one TeamIntent (the pure domain evaluation:
 *  no durable write, no live Agent effect). */
export interface TeamIntentPreflightResult {
  /** The resolved bound blueprint document. */
  readonly blueprint: TeamBlueprint
  /** The blueprint's compatibility requirements (the engine input). */
  readonly requirements: readonly RequirementInput[]
  /** The pure compatibility evaluation against the live environment
   *  facts (the `intent.probe` payload). */
  readonly compatibility: CompatibilityResult
}

export interface TeamIntentService {
  /** Evaluate the pre-creation compatibility of one team intent (pure
   *  domain read; the remote `intent.probe` handler's production backing). */
  readonly preflight: (
    input: TeamIntentPreflightInput,
  ) => Promise<TeamIntentPreflightResult>
  /** Build one staged handoff TeamIntent record (the frozen A04 contract
   *  surface; the handoff service's `startTeamFromHere` consumes it). */
  readonly stageHandoffIntent: (input: {
    readonly intentToken: string
    readonly staged: Record<string, unknown>
    readonly handoff?: {
      readonly sourceSessionId: string
      readonly contextToken: string
      readonly capturedAt: string
    }
  }) => HandoffTeamIntent
}

/** The root binding service surface (plan §19.1 item 4; S1A A05/A06):
 *  the fresh root bind + the cold root rehydration over the durable
 *  TeamDomain write port + the binder. */
export interface TeamRootBindingService {
  readonly bindFresh: (
    input: FreshRootBindingInput,
  ) => Promise<RootBindingResult>
  readonly rehydrateCold: (
    input: ColdRootBindingInput,
  ) => Promise<RootBindingResult>
}

/** The member residency service surface (plan §19.1 item 5; S1A A07/A08/
 *  A09): the fresh member + the cold member rehydration + the settled
 *  eviction, over the durable member write port + the live residency
 *  ports. */
export interface TeamMemberResidencyService {
  readonly createFresh: (
    spec: MemberCreateSpec,
  ) => Promise<FreshMemberResult>
  readonly rehydrateCold: (input: {
    readonly rootSessionId: string
    readonly instanceId: string
  }) => Promise<ColdMemberResult>
  readonly evictSettled: (input: {
    readonly rootSessionId: string
    readonly instanceId: string
  }) => Promise<EvictSettledMemberResult>
  readonly deriveIdentity: (spec: MemberCreateSpec) => DerivedMemberIdentity
}

/** The mutation surface (plan §19.1 item 12; S1A A22/A23).
 *
 * The PRODUCTION mutation -> live-Agent chain of the P8-S4B closure: the
 * durable governance override writer (`admitOverride` over the TeamDomain
 * overrides store, the backend writer the frozen policy layer re-reads at
 * every future Agent request boundary) plus the per-request durable
 * consumption derivation (the model selection + the mcp facet views the
 * live agent-setup layer applies at each request boundary).
 *
 * The P7-T2 `MutationService` class (the broader mutation plane:
 * PolicyState transitions, creation fields, the provenance ledger) is the
 * explicit installation seam `service`: its durable record family has no
 * home in the frozen TeamDomain schema v1, so it is constructed only when
 * the substrate supplies a durable {@link MutationServiceDeps} store. */
export interface TeamMutationSurface {
  /** The P8-S4B governance override admission (the durable writer; the
   *  authority is the server-side derived {@link MutationAuthority} —
   *  never a client-declared caller). */
  readonly admitOverride: (
    args: AdmitGovernanceOverrideArgs,
  ) => Promise<AdmittedGovernanceOverride>
  /** The P7-T2 mutation service plane: the constructed service when the
   *  substrate supplied a durable store, else the fail-closed seam
   *  (every method throws `MUTATION_POLICY_SERVICE_NOT_INSTALLED`). */
  readonly service: MutationService
  /** The P7-T2 policy adapter selection of the active PolicyState as of
   *  one step (the pure `activePolicyState` over the durable transitions
   *  of the installed store; `{ stateId: 'default' }` when no service is
   *  installed). */
  readonly activePolicyState: (atStep: number) => { readonly stateId: string }
}

/** The remote service surface (plan §19.1 item 20; S1A A31/A32/A33).
 *
 * The explicit S6 installation seam sanctioned by the §19.1 caveat: the
 * remote handler registration (the 12 structural ports of the frozen
 * `@dsh-agent-team/remote` package) is NOT activated in S5 because the
 * plan §20.3 principal boundary is its precondition — an external request
 * must never be trusted with a client-declared caller, and the server-side
 * principal derivation is the S6 scope. Until S6 installs the handler
 * deps through {@link TeamSeamRegistry}, every remote call fail-closes
 * with `REMOTE_HANDLERS_NOT_INSTALLED`. */
export interface TeamRemoteSurface {
  /** Route one parsed remote request through the installed dispatcher.
   *  Fail-closed with `REMOTE_HANDLERS_NOT_INSTALLED` before S6 install. */
  readonly call: (
    method: string,
    params: Record<string, unknown>,
  ) => Promise<RemoteResponse>
  /** Register the installed dispatcher on one live connection (the DSH
   *  seam transport; the S6 wiring). Fail-closed before S6 install. */
  readonly register: (connection: unknown) => unknown
  /** Whether the S6 handler deps are installed. */
  readonly isInstalled: boolean
}

/** The principal boundary surface (plan §20.3; S1A A34): the server-side
 *  derivation of one external caller's authority. The production root
 *  NEVER accepts a client-declared caller as authority: until S6 installs
 *  the derivation through {@link TeamSeamRegistry}, every call fail-closes
 *  with `PRINCIPAL_DERIVATION_NOT_INSTALLED`. */
export interface TeamPrincipalSurface {
  /** Derive the principal-bound authority for one external request
   *  context (the S6 derivation; the input shape is the S6 contract). */
  readonly derive: (input: Record<string, unknown>) => MutationAuthority
}

/**
 * The single production assembly point (plan §19.1): the shipped plugin
 * row exposes exactly this object as the `teamRoot` service. Every §19.1
 * subsystem is a named property (the twenty items, in plan order); the
 * S6 installation seams are explicit and fail-closed until installed.
 */
export interface TeamProductionRoot {
  /** The team identity of this root instance. */
  readonly identity: {
    readonly rootSessionId: string
    readonly bootPhase: 'create' | 'resume'
    readonly blueprint: TeamBlueprint
  }
  /** 1. TeamDomain (S1A A02): the durable authority, opened over the
   *  injected storage seam. */
  readonly teamDomain: TeamDomain
  /** 2. Blueprint catalog (S1A A03). */
  readonly blueprintCatalog: BlueprintCatalog
  /** 3. TeamIntent / intent preflight (S1A A04). */
  readonly teamIntent: TeamIntentService
  /** 4. Root binding (S1A A05/A06): fresh bind + cold rehydration. */
  readonly rootBinding: TeamRootBindingService
  /** 5. Member residency (S1A A07/A08/A09): fresh + cold + eviction. */
  readonly memberResidency: TeamMemberResidencyService
  /** 6. TeamAgentBinder (S1A A10) + the assembled overlay slots
   *  (S1A A11/A12/A13) — reachable even when the overlay installation is
   *  disabled (the p6t6 SD-SURFACE contract). */
  readonly teamAgentBinder: TeamAgentBinder
  readonly overlaySlots: readonly {
    readonly name: string
    readonly slot: OverlaySlot
  }[]
  /** 7. Compatibility authority (S1A A14/A15): the consultation/re-probe
   *  surface (the enforcement points inside the admission gate + the
   *  activation provider remain the P8-S4A authorities). */
  readonly compatibility: {
    readonly prober: CompatibilityProber
    readonly authority: CompatibilityAuthority
  }
  /** 8. ActivationProvider (S1A A16): the sole member creation path
   *  (invariant 26). */
  readonly activationProvider: ActivationProvider
  /** 9. TeamRuntime (S1A A17): the unified action facade. */
  readonly teamRuntime: TeamRuntime
  /** 10. Work delivery / settlement (S1A A18/A19): the model-visible
   *  delivery port + the work activity writer + the single settlement
   *  owner (`settleAdmittedWork`, P8-S3 R5). */
  readonly work: {
    readonly delivery: WorkDeliveryPort
    readonly activity: WorkActivityPort
    readonly settle: (deps: WorkChainDeps) => Promise<SettleOutcome>
  }
  /** 11. Lifecycle (S1A A20/A21): archive / restore / dispose over the
   *  real lifecycle ports. */
  readonly lifecycle: LifecycleService
  /** 12. Mutation (S1A A22/A23): the P8-S4B production chain + the P7-T2
   *  service seam. */
  readonly mutation: TeamMutationSurface
  /** 13. Messaging (S1A A24). */
  readonly messaging: MessagingCoordinator
  /** 14. Control (S1A A25). */
  readonly control: ControlService
  /** 15. Activity (S1A A26). */
  readonly activity: ActivityLedger
  /** 16. Fork reconciliation (S1A A27). */
  readonly fork: {
    readonly reconcile: (
      input: ForkReconciliationInput,
    ) => Promise<ForkReconciliationResult>
  }
  /** 17. Handoff (S1A A28): the one-shot Start-Team-from-Here facade
   *  (the source surface is the public Session query read; the team
   *  creation is the public Team creation entry; the summarizer is the
   *  fail-closed seam when the composition does not supply it). */
  readonly handoff: HandoffService
  /** 18. Legacy (S1A A29): the read-only legacy Team Session reader over
   *  the node:fs home port. */
  readonly legacy: {
    readonly inspect: (
      request: LegacyTeamInspectRequest,
    ) => LegacyTeamInspection
    readonly dispatch: (
      action: string,
      request: unknown,
    ) => LegacyTeamInspection
  }
  /** 19. Projection service (S1A A30): the whole-projection read service
   *  over the bounded durable TeamDomain read port (the live overlay is
   *  the S6 seam `projectionOverlay` — `null` until installed). */
  readonly projection: ProjectionService
  /** The projection source read port (the bounded TeamDomain view; the
   *  S6 authority completion replaces this adapter). */
  readonly projectionSource: TeamDomainReadPort
  /** 20. Remote service (S1A A31/A32/A33): the explicit S6 installation
   *  seam (fail-closed until installed). */
  readonly remote: TeamRemoteSurface
  /** The S6 installation seam registry (plan §19.1 caveat): projection
   *  live overlay, remote handler deps, the principal derivation. */
  readonly seams: TeamSeamRegistry
  /** The principal boundary (plan §20.3; S1A A34): fail-closed until S6
   *  installs the server-side derivation. */
  readonly principal: TeamPrincipalSurface
  /** The model-facing team tool set (the P6-T6 satellite of the runtime
   *  + satellites; registered on every team Agent by the live setup). */
  readonly tools: TeamToolSet
  /** The durable repositories (the invariant-41 authority view; the row's
   *  observability routes read through it). */
  readonly repositories: TeamDomainRepositories
  /** The read handle projection (the binder's durable member/session
   *  reads). */
  readonly readHandle: TeamDomainReadHandle
  /** Close the root (the TeamDomain close + the live world close). */
  readonly close: () => Promise<void>
}
