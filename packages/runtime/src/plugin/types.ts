/**
 * P8-S5A — production plugin composition types.
 *
 * This module defines:
 *
 * - {@link TeamPluginConfig} — the JSON-safe row `config:` of the shipped
 *   production plugin (the only input channel: the Cordis row carries plain
 *   JSON; the production root derives every factory from it — no service
 *   payload smuggling);
 * - the plugin-level stable error codes ({@link TEAM_PLUGIN_ERROR_CODES});
 * - the typed S6 installation seams (the A30–A34 slots: named, typed,
 *   fail-closed, install-once — plan §19.1 "如果 Projection/Remote 尚由
 *   S6 完成，则 production root 中提供明确 installation seam");
 * - {@link TeamProductionRoot} — the complete assembled surface of the
 *   production root (A01–A29, plan §19.1 assembly list).
 *
 * Pure module: types + constants only — no I/O, no `node:` builtins, no
 * live references.
 * @module @dsh-agent-team/runtime/plugin/types
 */

import type {
  ConnectionLike,
  RemoteRegistration,
} from '../../../remote/src/handlers/register.js'
import type { RemoteMethodSpec } from '../../../remote/src/contracts/catalog.js'
import type { RemoteRequest } from '../../../remote/src/contracts/request.js'
import type { MemberIdentity } from '../../../contracts/src/index.js'
import type { BlueprintCatalog, TeamBlueprint } from '../../../domain/blueprint/src/index.js'
import type { StorageDomainSeam } from '../../../storage/schema/index.js'
import type { TeamDomain } from '../../../storage/repositories/index.js'
import type {
  ActionCaller,
  LifecycleCommitPort,
  TeamRuntime,
} from '../../admission/index.js'
import type { ActivationProvider } from '../../activation/index.js'
import type { LifecycleService } from '../../lifecycle/index.js'
import type { OverlaySlot, TeamAgentBinder } from '../../agent-setup/binder/index.js'
import type {
  AdmittedGovernanceOverride,
  AdmitGovernanceOverrideArgs,
  MutationService,
  OverrideStorePort,
} from '../../mutation/index.js'
import type {
  DurableModelSelection,
  DurableModelSelectionArgs,
  resolveDurableModelSelection,
} from '../../agent-setup/model/index.js'
import type {
  DurableMcpFacet,
  DurableMcpFacetArgs,
  resolveDurableMcpFacet,
} from '../../agent-setup/capability/index.js'
import type { ActivityLedger } from '../../activity/index.js'
import type { ControlService } from '../../control/index.js'
import type { MessagingCoordinator } from '../../messaging/index.js'
import type {
  ForkReconciliationInput,
  ForkReconciliationResult,
} from '../../fork-reconciliation/index.js'
import type { HandoffService } from '../../handoff/index.js'
import type {
  LegacyHomePort,
  LegacyTeamInspection,
} from './legacy-surface.js'
import type {
  LiveResidencyOverlayPort,
  ProjectionService,
} from '../../projection/index.js'
import type {
  ColdRootBindingInput,
  FreshRootBindingInput,
  RootBindingResult,
} from '../../root-binding/index.js'
import type {
  ColdMemberResult,
  FreshMemberResult,
  MemberCreateSpec,
  MemberIdentityInput,
} from '../../member-residency/index.js'
import type { TeamToolSet } from '../../../tools/src/index.js'
// P8-S7-R4: the BQ-17 / BQ-18 read-surface types (type-only — root.ts
// imports the VALUE types from here; a value import back would cycle).
import type {
  ForkDescribeInput,
  ForkDescribeState,
  HandoffDescribeInput,
  HandoffDescribeState,
} from './root.js'

// --- JSON-safe row config ---------------------------------------------------------

/** The static model selection of the boot world (the injected static model). */
export interface TeamPluginStaticModel {
  /** Registered provider route. */
  readonly provider: string
  /** Provider-owned model id. */
  readonly model: string
}

/** One seeded member row of the boot world (the frozen scenario contract). */
export interface TeamPluginSeedMember {
  /** The member's stable instance id (unique within the TeamSession). */
  readonly instanceId: string
  /** The static template id. */
  readonly templateId: string
  /** The human-facing label. */
  readonly label: string
  /** The durable child DSH session id (the leader's IS the root session). */
  readonly childSessionId: string
}

/** One environment fact of the boot world (JSON-safe form of the domain fact). */
export interface TeamPluginEnvironmentFact {
  /** The requirement domain (e.g. `tool`, `skill`). */
  readonly domain: string
  /** The requirement subject. */
  readonly subject: string
  /** Whether the capability is available. */
  readonly available: boolean
  /** The probe generation. */
  readonly generation: number
}

/** The external hard policy facts of the boot world (JSON-safe). */
export interface TeamPluginExternalPolicyFacts {
  /** The external hard restriction map (capability -> restriction). */
  readonly hard: Record<string, unknown>
  /** The capability-existence facts (capability -> existence). */
  readonly capabilityExists: Record<string, unknown>
}

/** One facet source triple of the capability overlay (JSON-safe). */
export interface TeamPluginCapabilityFacetSources {
  /** The capability-existence probe items. */
  readonly available: readonly string[]
  /** The Team-domain policy resolution items. */
  readonly teamResolved: readonly string[]
  /** The external hard ceiling items. */
  readonly externalHard: readonly string[]
}

/**
 * The complete JSON-safe row `config:` of the production plugin.
 *
 * Every field is plain lossless JSON (the row `config` is the only input
 * channel — plan §19.2: the harness may "mount production plugin, inject
 * static model, expose test observability" and nothing else).
 */
export interface TeamPluginConfig {
  /** The boot phase: `create` seeds the durable world; `resume` reopens it. */
  readonly bootPhase: 'create' | 'resume'
  /** The root DSH session id of the Team (invariant 9). */
  readonly rootSessionId: string
  /** The Team Blueprint source (the YAML document, parsed by the domain). */
  readonly blueprintSource: string
  /** The durable TeamSession `generation` (positive integer). */
  readonly generation: number
  /** The effective default workspace (TeamSession record field). */
  readonly defaultWorkspace?: string
  /** The seeded member rows of the boot world (deterministic puts). */
  readonly seedMembers: readonly TeamPluginSeedMember[]
  /** The static model selection injected by the harness (row-level). */
  readonly staticModel: TeamPluginStaticModel
  /** The denied model selection of the world (null when none). */
  readonly deniedSelection: Record<string, unknown> | null
  /** The MCP server of the world (null port = not mounted). */
  readonly mcpServer: {
    readonly name: string
    readonly port: number | null
  } | null
  /** The boot-world environment facts (compatibility input). */
  readonly environmentFacts: readonly TeamPluginEnvironmentFact[]
  /** The boot-world external hard policy facts. */
  readonly externalPolicyFacts: TeamPluginExternalPolicyFacts
  /**
   * The capability facet source sets of the boot world (keyed by facet
   * name). Absent = every facet resolves from empty sets (the boot world
   * carries no G2-proven facet seams; honest empty, fail-closed).
   */
  readonly capabilityFacets?: Record<string, TeamPluginCapabilityFacetSources>
  /**
   * The file URL of the live-agent glue module (`agent-bindings.mjs`, plain
   * JavaScript — tsc does not emit .mjs; the built production entry loads
   * it by URL, keeping the dist tree pure TypeScript output).
   */
  readonly glueUrl: string
  /**
   * The file URL of the REAL storage-domain seam module (`seam.mjs` over
   * the DSH public `storageDomain` service). REQUIRED when the
   * `storageDomain` service is present (host mode); ignored when the
   * `teamStorageSeam` service is provided directly (test mode, the seam
   * object itself).
   */
  readonly seamUrl?: string
  /**
   * T12-M2 (optional additive): the AgentPreset substrate facts the persona
   * resolver evaluates — the effective-persona three-state of the preset
   * composing the team agents. Absent = the S5A A11 decision for the
   * dsh-agent-team preset ({ presetId: 'dsh-agent-team',
   * personaKind: 'standard' }); a `complete` substrate is a structural
   * FATAL inside the resolver (no downgrade, no Continue Anyway).
   */
  readonly presetSubstrate?: {
    readonly presetId: string
    readonly personaKind: 'absent' | 'standard' | 'complete'
  }
  /**
   * T12-B1 — explicit TEST FIXTURE mode (plan §7-B1 "test fixture mode"):
   * when `true`, the `create` boot phase seeds the frozen deterministic
   * scenario world (`seedBootWorld`: frozen TeamSession/root binding/leader/
   * seed member rows) instead of running the REAL production create
   * (the canonical fresh-root binding — durable TeamSession + root binding
   * + Leader mint, no fabricated members).
   *
   * The normal shipped create MUST NOT set this: it is unreachable from
   * the production path by construction. Additionally, a NON-EMPTY
   * `seedMembers` remains the documented legacy-compatibility trigger for
   * the old dev harness / legacy tests (plan §7-B1 "保留 helper 供旧
   * test/harness 使用"); the shipped row passes an empty `seedMembers`
   * and no fixture flag, so its create is the real one.
   */
  readonly fixtureWorld?: boolean(T12-B1: normal production create no longer runs seedBootWorld (plan 7-B1: real create = bindFreshTeamRoot durable TeamSession + team-root binding + honest-v2 Leader mint + live.boot real Root Agent, zero fabricated members; frozen seed world reachable ONLY via explicit fixtureWorld flag or the documented non-empty seedMembers legacy trigger) + t12b1-real-create test (W1 real create / W2 fixture flag / W3 legacy seed / W4 second create fails closed); types.ts additive (fixtureWorld config field, TEAM_PLUGIN_CREATE_FAILED); scan pin 543->544; runtime chain 1013/1013; tsc 0)
}

// --- plugin-level error codes ------------------------------------------------------

/**
 * The stable plugin-level error codes (the `code` property of the thrown
 * {@link TeamPluginError}). Every failure path of the production entry is
 * fail-closed with one of these (or a domain-module code propagating).
 */
export const TEAM_PLUGIN_ERROR_CODES = {
  /** The row config is missing a required field or has the wrong type. */
  TEAM_PLUGIN_CONFIG_INVALID: 'TEAM_PLUGIN_CONFIG_INVALID',
  /** A required public service is absent from the ctx (not injected). */
  TEAM_PLUGIN_SERVICE_MISSING: 'TEAM_PLUGIN_SERVICE_MISSING',
  /** The glue module URL is missing/unloadable or its export is malformed. */
  TEAM_PLUGIN_GLUE_UNAVAILABLE: 'TEAM_PLUGIN_GLUE_UNAVAILABLE',
  /** An S6 seam was installed twice (install-once violated). */
  TEAM_PLUGIN_SEAM_ALREADY_INSTALLED: 'TEAM_PLUGIN_SEAM_ALREADY_INSTALLED',
  /** An unknown seam name was requested. */
  TEAM_PLUGIN_SEAM_UNKNOWN: 'TEAM_PLUGIN_SEAM_UNKNOWN',
  /** A facade field was read before `ready` settled (await `ready` first). */
  TEAM_PLUGIN_NOT_READY: 'TEAM_PLUGIN_NOT_READY',
  /**
   * T12-B1 — the real production create (the canonical fresh-root binding
   * of the `create` boot phase) failed in a way that leaves the durable
   * Team identity unproven. Fail-closed: the boot rejects; nothing is
   * reported as created.
   */
  TEAM_PLUGIN_CREATE_FAILED: 'TEAM_PLUGIN_CREATE_FAILED',
  /**
   * T12-B2 — the production resume (`resume` boot phase) could not LOAD
   * the existing durable Team identity (the TeamSession record, the
   * team-root binding, or the Leader member row) for the configured
   * root. Fail-closed: a resume loads the existing Team identity — it
   * never re-mints one; the loud failure replaces the silent pass-through.
   */
  TEAM_PLUGIN_RESUME_STATE_MISSING: 'TEAM_PLUGIN_RESUME_STATE_MISSING',
  /**
   * T12-B6 — the handoff target team cannot be created-and-started
   * through the live glue: either a with-context handoff ran on a glue
   * that lacks the target-agent ports (`createRootAgent` /
   * `deliverRootContext`), or the deterministic target root already
   * carries an incompatible durable record (stable identity collision,
   * not a re-drive). Fail-closed: the preflight runs before any
   * durable mutation, so nothing is reported as created.
   */
  TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE: 'TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE',
} as const

export type TeamPluginErrorCode = (typeof TEAM_PLUGIN_ERROR_CODES)[keyof typeof TEAM_PLUGIN_ERROR_CODES]

/** The plugin-level error carrier (stable `code` + message + detail). */
export class TeamPluginError extends Error {
  readonly code: string
  readonly detail?: Readonly<Record<string, unknown>>

  constructor(code: string, message: string, detail?: Readonly<Record<string, unknown>>) {
    super(message)
    this.name = 'TeamPluginError'
    this.code = code
    if (detail !== undefined) this.detail = detail
  }
}

/** True when `value` is a {@link TeamPluginError} carrier. */
export function isTeamPluginError(value: unknown): value is TeamPluginError {
  return value instanceof TeamPluginError
}

// --- S6 installation seams ---------------------------------------------------------

/**
 * One named, typed, fail-closed, install-once S6 installation seam.
 *
 * Before `install(impl)` the seam is NOT installed: every use through
 * `current()` throws the seam's stable not-installed code (never a silent
 * no-op, never a partial activation). `install` accepts EXACTLY ONE
 * implementation (a second install throws
 * {@link TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SEAM_ALREADY_INSTALLED}).
 * S5 implements NONE of the S6 semantics behind these slots — the slots
 * only (plan §19.1).
 */
export interface InstallSeam<T> {
  /** The seam's stable name (diagnostics). */
  readonly name: string
  /** `true` after exactly one successful install. */
  readonly installed: boolean
  /**
   * Install the S6 implementation (ONCE).
   * @throws {TeamPluginError} TEAM_PLUGIN_SEAM_ALREADY_INSTALLED on the
   *   second install.
   */
  install(impl: T): void
  /**
   * The installed implementation.
   * @throws {TeamPluginError} the seam's stable not-installed code before
   *   install.
   */
  current(): T
}

/**
 * A31 — the S6 remote-handler registration seam. The installed
 * implementation is the registration function S6 wires onto the public
 * connection seam (the Remote contract v1 dispatcher, plan §20).
 */
export type RemoteHandlerRegistration = (
  connection: ConnectionLike,
) => RemoteRegistration

/**
 * A32 — the S6 server-side principal derivation seam. The installed
 * implementation derives the team calling authority from one parsed
 * remote request (the remote principal boundary, plan §20.3: the external
 * browser request cannot self-claim caller identity).
 */
export type ServerPrincipalDerivation = (input: {
  /** The remote method name (the dotted endpoint). */
  readonly method: string
  /** The parsed request envelope (version + closed params). */
  readonly request: RemoteRequest
}) => Promise<ActionCaller> | ActionCaller

/**
 * A34 — the S6 remote query/command completion seam. The installed
 * implementation completes the remote query/command methods (ledger
 * pagination and the query completions, plan §20) and returns the
 * lossless-JSON response value.
 */
export type RemoteQueryCommandCompletion = (input: {
  /** The remote method name (the dotted endpoint). */
  readonly method: string
  /** The parsed request envelope (version + closed params). */
  readonly request: RemoteRequest
}) => Promise<unknown>

// --- the production root surface ---------------------------------------------------

/**
 * The complete assembled production root (plan §19.1, A01–A29 + the four
 * S6 seams A30/A31/A32/A34 + the live-agent glue bundle + the tools).
 *
 * This is the SINGLE assembly point of the shipped production plugin:
 * every node is constructed here (or by its canonical factory with the
 * root-owned ports) and exposed for T1 reachability proofs, the harness
 * observability routes, and the S6 seam installs.
 */
export interface TeamProductionRoot {
  /** The validated row config (the root's input channel). */
  readonly config: TeamPluginConfig
  /** A02 — the open TeamDomain (durable authority, invariant 41). */
  readonly domain: TeamDomain
  /** The storage seam the domain was opened through (diagnostics). */
  readonly storageSeam: StorageDomainSeam
  /** A03 — the immutable blueprint catalog. */
  readonly catalog: BlueprintCatalog
  /** The bound Team Blueprint (parsed from `config.blueprintSource`). */
  readonly blueprint: TeamBlueprint
  /** A07 — the leader actor identity (contracts, invariant 14). */
  readonly leaderIdentity: MemberIdentity
  /** A04 — the TeamIntent/preflight catalog (the remote method catalog). */
  readonly intent: {
    readonly catalog: Readonly<Record<string, RemoteMethodSpec>>
  }
  /**
   * A14 + A15 — the compatibility prober/authority (the SINGLE
   * compatibility authority, P8-S4A) and the new-work admission gate.
   */
  readonly compatibility: {
    readonly prober: CompatibilityProberLike
    readonly authority: CompatibilityAuthorityLike
    readonly enforceGate: CompatibilityGateLike
  }
  /** A05 + A06 — the Team root binding (fresh + cold entry points). */
  readonly rootBinding: {
    readonly bindFresh: (input: FreshRootBindingInput) => Promise<RootBindingResult>
    readonly rehydrateCold: (input: ColdRootBindingInput) => Promise<RootBindingResult>
  }
  /** A08 + A09 — the member residency (fresh + cold entry points). */
  readonly memberResidency: {
    readonly createFresh: (spec: MemberCreateSpec) => Promise<FreshMemberResult>
    readonly rehydrateCold: (input: MemberIdentityInput) => Promise<ColdMemberResult>
  }
  /** A10 — the TeamAgentBinder (the three overlay slots installed; the
   *  default admitting guard — the compatibility authority is the work
   *  gate, P8-S4A single authority). */
  readonly binder: TeamAgentBinder
  /** A11 + A12 + A13 — the three overlay slots (persona/model/capability). */
  readonly slots: {
    readonly persona: OverlaySlot
    readonly model: OverlaySlot
    readonly capability: OverlaySlot
  }
  /** A16 — the ActivationProvider (the ONLY creation path, invariant 26). */
  readonly provider: ActivationProvider
  /** A17 + A18 + A19 — the TeamRuntime action facade (work
   *  delivery/settlement through the P8-S3 work chain). */
  readonly runtime: TeamRuntime
  /** A20 + A21 — the lifecycle service + the durable CAS commit port. */
  readonly lifecycle: {
    readonly service: LifecycleService
    readonly commit: LifecycleCommitPort
  }
  /** A22 + A23 — the mutation service + the governance override admission
   *  authority + the durable consumption resolvers (the live-Agent
   *  boundary bridge). */
  readonly mutation: {
    readonly service: MutationService
    readonly admitGovernanceOverride: (
      args: AdmitGovernanceOverrideArgs,
      store?: OverrideStorePort,
    ) => Promise<AdmittedGovernanceOverride>
    readonly resolveDurableModelSelection: typeof resolveDurableModelSelection
    readonly resolveDurableMcpFacet: typeof resolveDurableMcpFacet
  }
  /** A24 — the messaging coordinator. */
  readonly messaging: MessagingCoordinator
  /** A25 — the durable control-plane service. */
  readonly control: ControlService
  /** A26 — the activity ledger (guarded progress writes + durable reads). */
  readonly activity: ActivityLedger
  /** A27 — the fork reconciliation (sidecar recognition + child team). */
  readonly fork: {
    readonly reconcile: (input: ForkReconciliationInput) => Promise<ForkReconciliationResult>
    /** BQ-18 (P8-S7-R4 W3) — the read-only fork reconciliation state. */
    readonly describe: (input: ForkDescribeInput) => ForkDescribeState
  }
  /** A28 — the handoff service. */
  readonly handoff: HandoffService
  /** BQ-17 (P8-S7-R4 W2) — the handoff state/provenance read surface. */
  readonly handoffRead: {
    readonly describe: (input: HandoffDescribeInput) => HandoffDescribeState
  }
  /** A29 — the legacy read-only session reader. */
  readonly legacy: {
    readonly inspect: (port: LegacyHomePort, request: unknown) => LegacyTeamInspection
  }
  /** A30 — the projection service (durable source + the S6 live-residency
   *  overlay seam as the overlay port: fail-closed until S6 installs). */
  readonly projection: ProjectionService
  /** The four S6 installation seams (A30 overlay / A31 handlers /
   *  A32 principal / A34 completion). */
  readonly seams: {
    readonly projectionLiveOverlay: InstallSeam<LiveResidencyOverlayPort>
    readonly remoteHandlerRegistration: InstallSeam<RemoteHandlerRegistration>
    readonly serverPrincipalDerivation: InstallSeam<ServerPrincipalDerivation>
    readonly remoteQueryCommandCompletion: InstallSeam<RemoteQueryCommandCompletion>
  }
  /** The live-agent glue bundle (the DSH public agent-service binding —
   *  plain-JS module loaded by URL; the ONLY DSH-facing side of the root). */
  readonly live: TeamAgentBindings
  /** The ten Team tools (registered on the agent setup by the glue). */
  readonly tools: TeamToolSet
  /**
   * The boot sequence (idempotent; a second call is a no-op). Create
   * phase: the deterministic seed puts (the frozen scenario contract) +
   * the live-agent boot. Resume phase: the live-agent boot + the cold
   * rehydration of the root and every durable member (write-free).
   * Called by the production entry after the tool stack is filled into
   * the glue (the setup callback registers the tools inside
   * create/resume).
   */
  boot(): Promise<void>
  /** Close the root (the glue bundle + the TeamDomain). Idempotent. */
  close(): Promise<void>
}

// --- imported function-shape aliases (self-documenting surface) ---------------------

/** The compatibility prober instance (the P3-T5 engine driver, P8-S4A). */
export type CompatibilityProberLike = ReturnType<
  typeof import('../../compatibility/index.js').createCompatibilityProber
>
/** The compatibility authority instance (the SINGLE authority, P8-S4A). */
export type CompatibilityAuthorityLike = ReturnType<
  typeof import('../../compatibility/index.js').createCompatibilityAuthority
>
/** The new-work compatibility gate (invariant 50, A15). */
export type CompatibilityGateLike = typeof import('../../admission/index.js').enforceCompatibilityGate

/** The durable model-cell consumption result (A23, re-exported convenience). */
export type DurableModelSelectionLike = DurableModelSelection
/** The durable model-cell consumption args (A23, re-exported convenience). */
export type DurableModelSelectionArgsLike = DurableModelSelectionArgs
/** The durable MCP-facet consumption result (A23, re-exported convenience). */
export type DurableMcpFacetLike = DurableMcpFacet
/** The durable MCP-facet consumption args (A23, re-exported convenience). */
export type DurableMcpFacetArgsLike = DurableMcpFacetArgs

// --- the live-agent glue bundle ------------------------------------------------------

/**
 * The live-agent glue bundle (the plain-JS `agent-bindings.mjs` export).
 *
 * This is the ONLY side of the production root that touches the DSH agent
 * service (create/resume/followup/cancel/dispose + the durability barrier).
 * It is loaded by file URL (the tsc build cannot emit .mjs) and typed here
 * structurally so the TS side stays closed. The port members mirror the
 * runtime port interfaces exactly (the glue structurally satisfies them,
 * so the root passes them to the node factories without casts).
 */
export interface TeamAgentBindings {
  // --- the runtime ports (consumed by the root's node wiring) ---
  /** The child-session factory (A16 step 13, the one external effect). */
  readonly childFactory: import('../../activation/index.js').ChildSessionFactoryPort
  /** The child-Session durability barrier (invariant 46). */
  readonly sessionDurability: import('../../member-residency/index.js').SessionDurabilityPort
  /** The public Agent setup surface (the binder's only agent contact). */
  readonly surface: import('../../agent-setup/binder/index.js').TeamAgentSetupSurface
  /** The session input port (A24's ONLY channel to target sessions). */
  readonly sessionInput: import('../../messaging/index.js').SessionInputPort
  /** The work-delivery port (A18, the P8-S3 R1/R6 sole delivery path). */
  readonly workDelivery: import('../../admission/index.js').WorkDeliveryPort
  /** The lifecycle interrupt live effect (§20.3 step 2). */
  readonly interrupt: (
    target: import('../../lifecycle/index.js').LifecycleTarget,
  ) => Promise<void>
  /** The descendant drain live effect (§20.3 step 3). */
  readonly drainDescendants: (
    childSessionId: string,
  ) => Promise<import('../../lifecycle/index.js').DescendantDrainReport>
  /** The ephemeral residency surface (lifecycle release + evict). */
  readonly residency: import('../../member-residency/index.js').ResidencyPort
  /** Resolve the calling authority from the calling session id (tools). */
  readonly resolveCaller: (sessionId: string) => Promise<ActionCaller>
  /** T12-M2: the REAL scoped-prompt persona surface — the agent-scoped
   *  'deployment:persona' system-prompt section installs and restores. */
  readonly personaSurface: LivePersonaSurface

  // --- boot + observability (harness-facing) ---
  /** Create/resume the root agent (+ the seeded member agents) ONCE, after
   *  the tool stack exists (the setup callback registers the tools inside
   *  create/resume). A second call is a no-op. */
  boot(): Promise<void>
  /** The live session ids (health observability). */
  readonly listLiveSessions: () => readonly string[]
  /** Whether one session has a live residency (health/drop observability). */
  readonly hasLive: (sessionId: string) => boolean
  /** Whether one session has a resume in flight (the resuming marker,
   *  P8-S7 R2-5: written at the production resume points, cleared when
   *  the resume settles; ephemeral by design). */
  readonly isResuming: (sessionId: string) => boolean
  /** Create-or-resume the live agent of one session (the route helper). */
  readonly ensureLiveAgent: (sessionId: string) => Promise<unknown>
  /**
   * T12-B6 — create-or-ensure the live Root Agent of a team whose
   * durable identity already exists (the handoff target's create path;
   * the boot-time create/resume stays owned by `boot()`). The contract
   * is IDEMPOTENT per rootSessionId: the at-least-once re-drive must
   * not mint a second agent for the same root. OPTIONAL — a glue that
   * cannot start a target agent on demand leaves it undefined, and a
   * with-context handoff then fails closed (the root's preflight,
   * `TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE`).
   */
  readonly createRootAgent?: (rootSessionId: string) => Promise<void>
  /**
   * T12-B6 — accept the frozen handoff context into the target Root
   * Agent through the REAL Agent input/context seam. AT-LEAST-ONCE: a
   * re-drive may deliver again, and the implementation MUST dedupe by
   * `contextToken` (the explicit request identity carried in every
   * delivery) — a duplicate delivery of one contextToken must not leave
   * two context entries in the target. The `text` payload is
   * deterministic (the token leads, followed by the canonical
   * lossless-JSON context), so a re-drive delivers identical bytes.
   * OPTIONAL — same contract as `createRootAgent`.
   */
  readonly deliverRootContext?: (input: {
    readonly rootSessionId: string
    readonly contextToken: string
    readonly text: string
  }) => Promise<void>
  /** The P8-S4B request boundary (re-apply the durable truth). */
  readonly prepareAgentForRequest: (sessionId: string) => Promise<void>
  /** Execute one tool on the live agent's ctx (the /__p6t6/tool route). */
  readonly executeTool: (
    sessionId: string,
    args: {
      readonly name: string
      readonly args: Record<string, unknown>
      readonly callId?: string
    },
  ) => Promise<unknown>
  /** The consumption state of one session (the /__p6t6/state route; sync). */
  readonly getConsumptionState: (sessionId: string) => unknown
  /** One session's consumption view (the /__p6t6/state route; pure, sync). */
  readonly resolveConsumptionViews: (sessionId: string) => unknown
  /** The accumulated observation notes (diagnostics; route-visible). */
  readonly observations: readonly string[]
  /** Drop one live residency (the residency/drop route). */
  readonly dropResidency: (sessionId: string) => Promise<{
    readonly dropped: boolean
    readonly disposeError?: string
  }>
  /** The governance authority of the calling session (operator/member). */
  readonly governanceAuthority: (asSessionId: string) =>
    | { readonly kind: 'operator' }
    | { readonly kind: 'member'; readonly instanceId: string }
    | undefined
  /** Close the glue (dispose every live agent handle; idempotent). */
  close(): Promise<void>
}

/**
 * T12-M3: the structural seam for the DSH subagents service
 * (SubagentRuntime) that the live glue consumes as the OPTIONAL dep
 * `deps.subagents`. Only the two methods the recursive drain
 * (agent-bindings.mjs `drainDescendants`) invokes are required:
 *
 *   - `drainContinuableDescendants` — closes admission below the exact live
 *     parent agents, stops their visible descendant Activations, and awaits
 *     them; it REJECTS with an aggregate AFTER ALL BRANCHES SETTLE when any
 *     failed (a drain failure, reported as `quiescent: false`);
 *   - `listDescendants` — the complete descendant tree below one session id
 *     (the honest drained count).
 *
 * Absent or structurally unusable, the drain fails closed with the typed
 * `recursive-drain-unavailable` error (the archive/dispose procedure
 * refuses). The production host (host.ts) does not pass it yet: the
 * integrator must add `subagents: ctx.get('subagents')` to the glue deps
 * (additive; the glue reads `deps.subagents` defensively).
 */
export interface SubagentsDrainPort {
  /** Drain every continuable descendant below the exact live parent agents. */
  drainContinuableDescendants(parents: readonly unknown[]): Promise<void>
  /** Enumerate the complete descendant tree below one session id. */
  listDescendants(rootSessionId: string): Promise<readonly unknown[]>
}

/**
 * T12-M2: the REAL scoped-prompt persona surface the live glue exposes
 * (the last layer the reused persona resolver installs onto — the real DSH
 * Agent prompt surface):
 *
 *   - `installScopedPersona` — registers one composed identity (the
 *     resolver's ScopedPersonaIdentity: `personaText` + provenance) as an
 *     AGENT-SCOPED 'deployment:persona' system-prompt section on the
 *     session's live agent ctx; an install that runs before the session's
 *     agent setup captured its ctx is queued and flushed by the setup — the
 *     install still precedes any work on the session; repeated installs for
 *     the same session converge to exactly one scoped section (re-install
 *     disposes the previous scoped entry first);
 *   - `restoreScopedPersona` — disposes EXACTLY that agent-scoped entry for
 *     the session: the global prompt layer (the harness:identity + the
 *     global deployment:persona sections the DSH service registered) is
 *     never touched; idempotent (a second restore is a no-op).
 *
 * The resolver itself stays READ-ONLY (agent-setup/persona): it evaluates
 * the preset substrate (a complete preset is a structural FATAL
 * TeamPersonaOverlayError BEFORE any install) and composes the scoped
 * identity from the blueprint persona fields; this surface is where the
 * composed identity becomes a real DSH Agent prompt effect.
 */
export interface LivePersonaSurface {
  /** Register one composed identity as the agent-scoped persona section. */
  installScopedPersona(sessionId: string, identity: unknown): void
  /** Dispose exactly the agent-scoped persona section for the session. */
  restoreScopedPersona(sessionId: string): void
}
