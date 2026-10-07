/**
 * P8-S5A — the shipped production plugin entry (plan §19.2, S5-PRE).
 *
 * The harness MOUNTS this entry as a Cordis plugin row and consumes the
 * `teamRoot` service it provides — the harness never builds a parallel
 * backend graph (frozen invariant: production root = single assembly
 * point, harness = consumer).
 *
 * Load path (S5-PRE): `tsc -p packages/runtime/tsconfig.build.json` emits
 * the plain-JS artifact `dist/packages/runtime/src/plugin/host.js`; the
 * DSH plugin loader imports that file with plain Node (no TS loader, no
 * `node --import`, no package-exports change). This module therefore:
 *
 *   - registers the upstream resolution hook at load (the glue bundle and
 *     the storage seam live in the worktree, OUTSIDE the DSH checkout —
 *     their bare `@deepseek-ai/*` imports resolve through the checkout's
 *     apps/cli workspace links; see ./upstream-resolver.mjs);
 *   - declares `inject` for the hard host services (`agents`,
 *     `storageDomain`, `sessions`, and — M2, plan §15.5 —
 *     `workspaceRegistry`, the public workspace service the web profile
 *     provides through its workspace row) so the Loader defers this
 *     row's apply until the host provides them (the pre-S5A harness row
 *     injected the same set minus `sessionPersistence`, which it resolved
 *     lazily; R122 swapped the materialization seam — rc.1 removed
 *     `sessionPersistence.ensureMaterialized`, and the stock `sessions`
 *     service's `flush(session)` is the upstream ACP's own replacement,
 *     present in both eras); the entry still passes a lazy accessor under
 *     the frozen glue's `sessionPersistence` deps key so a pre-settle call
 *     fails with a stable code instead of a TypeError;
 *   - validates the row `config` LOUDLY (a composition mistake rejects the
 *     bootstrap — the driver sees the setup-failure evidence, never a
 *     half world);
 *   - loads the live-agent glue and the frozen legacy reader by URL
 *     (row-owned `config.glueUrl`; the legacy entry is compiled separately
 *     into the runtime dist mirror — see ./legacy-surface.js) and
 *     constructs the production root (./root.js) around the opened
 *     TeamDomain; the `import.meta.url`-derived URLs (the upstream
 *     resolver hook, the frozen legacy entry, and — when the row config
 *     carries no glueUrl/seamUrl — the location-derived glue/seam
 *     defaults) use a production-first layout-agnostic candidate search,
 *     so the SAME module also runs from TS source under the unit-test
 *     runner (fresh checkout, no dist) — the production world always hits
 *     the first (dist) candidate, which resolves to exactly the files the
 *     pre-candidate code computed;
 *   - provides `teamRoot` SYNCHRONOUSLY (before the first await) and arms
 *     one effect (the row-stop cleanup backstop) plus the remote-mount watcher when the mount waits for the connection service; a rejected apply fiber is absorbed into the Cordis
 *     logger, invisible to the harness, so EVERY setup failure (config,
 *     services, modules, domain, boot) rejects the facade's `ready`
 *     instead: the observability row awaits `ready` and maps the rejection
 *     to the setup-failure evidence, and the entry ALSO surfaces the rejection on the console — a swallowed bootstrap must never present as a silent half-world. On row stop the live bundle + domain
 *     are closed (close() is idempotent).
 * @module @dsh-agent-team/runtime/plugin/host
 */
import { existsSync } from 'fs'
import { register } from 'module'
import { fileURLToPath } from 'url'

import { REMOTE_RPC_CHANNEL } from '../../../remote/src/handlers/register.js'
import type {
  ConnectionLike,
  RemoteRegistration,
} from '../../../remote/src/handlers/register.js'
import {
  ARTIFACT_READ_GRANTED_FACT_TYPE,
  TeamArtifactAuthority,
} from '../../artifact-read/index.js'
import type {
  ArtifactFsInfo,
  ArtifactFsPort,
  ArtifactFsTarget,
  ArtifactIdentityPort,
  ArtifactLedgerPort,
} from '../../artifact-read/index.js'
import type { ControlService } from '../../control/index.js'
import {
  MCP_FACET_WILDCARD,
  resolveDurableMcpFacet,
} from '../../agent-setup/capability/index.js'
import { resolveDurableModelSelection } from '../../agent-setup/model/index.js'
import {
  createOrOpenTeamDomainDetailed,
  createTeamDomain,
  openTeamDomain,
} from '../../../storage/repositories/index.js'
import type { TeamDomain } from '../../../storage/repositories/index.js'
// pre-alpha3 PR4 (plan PR4 "production entry wiring"): the durable
// `permission_overlays` store (the TeamDomain's tenth store) is OPENED by the
// host entry — the entry owns the async boot and the teardown order — and
// handed to the production root as a port. The persistence-only face
// (`append`/`latest`/`history`) is what crosses; nothing else reaches the
// repository (PR1 ADR §1).
import { createPermissionOverlayRepositoryPort } from '../../permission-governance/index.js'
import type { PermissionOverlayRepositoryPort } from '../../permission-governance/port.js'
import { createAuthorityCeilingReader, createPermissionAuthorityFacts } from './permission-plane.js'
// A4-PR6 §6.A — the governance-warning lane: the ONE service instance the
// Team-start gate, the runtime boundary observation, and (6.B) the v8
// warning surface all read through. Assembled HERE because this is where
// the ONE bound-Blueprint reader and the ONE canonicalizer already live
// (ADR A5-12; Ruling PR6-H: zero new resolution or canonicalization call
// sites — the docs port rides `permissionFacts`, whose leader-position
// reads canonicalize at the ADDRESSED team's durable default workspace).
import { createGovernanceWarningService } from '../../governance-warning/index.js'
import type { GovernanceEnvelopeView } from '../../governance-warning/index.js'
import { commitDurableFact } from '../../action-router/index.js'
import type { CanonicalKeyContains, TeamPermissionPlane } from './permission-plane.js'
import { parseBlueprint } from '../../../domain/blueprint/src/index.js'
import type { TemplatePermissionPolicy } from '../../../domain/blueprint/src/index.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../../storage/schema/index.js'
import type { StorageDomainSeam } from '../../../storage/schema/index.js'
import { LEADER_INSTANCE_ID } from '../../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../../contracts/src/index.js'
import type { LegacyInspectFn } from './legacy-surface.js'
import { createBlueprintAuthority } from './blueprint-authority.js'
import { createBoundBlueprintResolver } from './bound-blueprint.js'
import { createLiveBlueprintCatalog } from './blueprint-live-catalog.js'
import { createBlueprintSourceIndex } from './blueprint-source-index.js'
import { registerTeamSkills } from './team-skills.js'
import { configuredMcpServers, mcpSupplyValidationIssue } from './mcp-supply.js'
// pre-alpha3 PR-C §C.7: the durable capability-runtime telemetry writer (the
// `capability-runtime-event` ledger fact — the compatibility category's
// first production writer); pre-alpha3 W2-A (review fix F1, guide §2.3):
// the 3-state readiness probe + the materialization vocabulary the
// production facts provider is built over.
import {
  MEMBER_LIVENESS,
  OBSERVATION_SOURCES,
  OBSERVATION_STATES,
  PROBE_VERDICTS,
  assertCapabilityRuntimeEventKind,
  createCapabilityReadinessProvider,
  createCapabilityRuntimeEvent,
  writeCapabilityRuntimeEvent,
} from '../../readiness/index.js'
import type {
  CapabilityReadinessProvider,
  MaterializationSlot,
  MemberLiveness,
} from '../../readiness/index.js'
// pre-alpha3 W2-A (review fixes F14 + F1, guide §5 B + §2.3): the
// production persona observer (the DSH public agentPresets seam — the
// effective-composition read, fail-closed typed `unresolved`, never a
// shipped-state guess) + the runtime substrate resolver (the row preset
// ids + the observer) + the runtime requirement-facts provider (the #40
// live environment source for the RequirementAuthority).
import {
  createProductionPersonaObserver,
  resolveRuntimeSubstrate,
} from '../../agent-setup/preset/index.js'
import type {
  AgentPresetPersonaSeam,
  PersonaKindObservation,
  PresetCompositionMirror,
  ProductionPersonaObserver,
  RuntimeSubstratePlan,
} from '../../agent-setup/preset/index.js'
import { createRuntimeRequirementFactsProvider } from '../../requirement-facts/index.js'
import type {
  MemberMaterializationView,
  RequirementFactScope,
} from '../../requirement-facts/index.js'
// pre-alpha3 W3-A (review fix F1) regression fix: the SHIPPED-STATE persona
// observation + the deployment-default preset id — the service-absent
// fallback for the live production substrate (see the `personaObserver`
// wrapper + `resolveSubstratePlan` below). A test-world host entry that
// does not provide the DSH `agentPresets` public service falls back to the
// base pre-W3-A shipped-state substrate; real production (service present)
// keeps the W2-A F14 live probe + its fail-closed typed `unresolved`
// contract.
import {
  SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID,
  shippedStatePersonaObserver,
} from '../../requirements/observed-persona.js'
import { TEAM_ARTIFACT_AUTHORITY_SERVICE } from './artifact-grant-bridge.js'
import type { TeamArtifactAuthorityBridge } from './artifact-grant-bridge.js'

import { createTeamProductionRoot } from './root.js'
import { createTeamSessionActivationFence } from './team-session-activation.js'
import type {
  TeamActivationAgent,
  TeamSessionActivationFence,
  TeamSessionStartSource,
} from './team-session-activation.js'
import { resolveOwningTeamRoot } from './team-session-ownership.js'
import {
  TEAM_PLUGIN_ERROR_CODES,
  TeamPluginError,
} from './types.js'
import type {
  TeamAgentBindings,
  TeamPluginConfig,
  TeamPluginSeedMember,
  TeamProductionRoot,
  TeamSkillDefinitionConfig,
} from './types.js'
import {
  assertWorkspaceRegistryLike,
  createWorkspaceAttach,
} from './workspace-attach.js'
import type { TeamToolSet } from '../../../tools/src/index.js'

/**
 * The structural projection of the Cordis plugin context this entry uses
 * (the concrete context is proxied by the loader; only these members are
 * consumed — plan §19.2 keeps the entry independent of the Cordis types).
 *
 * Exported under the stable name the P1-T4 baseline test pins; only the
 * member surface evolved (the production entry provides `teamRoot`
 * synchronously, arms the row-stop backstop effect plus the remote-mount
 * watcher when the mount waits for the connection service, and reports a
 * missing row config through the facade's `ready` rejection).
 */
export interface TeamPluginHostContext {
  get(name: string): unknown
  provide(name: string, value: unknown): void
  effect(factory: () => () => void, label?: string): void
  /**
   * Cordis event registration: the listener is owned by this row's fiber
   * and disposed with the row. Optional in this structural projection —
   * the entry keeps Cordis-type independence (plan §19.2) and minimal
   * structural doubles omit it; the consumers (the 0.1.5 `webServer`
   * property-read seam and the 0.1.7-rc.1 Team activation fence — the
   * AWAITED `agent/created` veto + the `agent/disposed` rollback barrier,
   * both registered in {@link apply} with `{ global: true }`) guard the
   * absence. On every real host the Cordis context proxy always provides
   * it.
   *
   * Structural overloads (NOT the upstream `Context` type — the entry
   * keeps its deliberate structural independence, guide §4.1):
   *
   * - `'internal/get'` — the property-read waterfall (the 0.1.5
   *   `webServer` compatibility seam);
   * - `'agent/created'` — the awaited serial activation announcement
   *   (the listener's rejection propagates into the create/resume and
   *   the upstream AgentLoop rolls the unpublished agent back — the
   *   fence's veto point, guide §8.1);
   * - `'agent/disposed'` — the fire-and-forget disposal announcement
   *   (the fence's exact-generation rollback barrier, guide §8.2).
   */
  on?(
    name: 'internal/get',
    listener: (
      readerCtx: TeamPluginHostContext,
      prop: string,
      error: Error,
      next: () => unknown,
    ) => unknown,
    options?: boolean | Record<string, unknown>,
  ): void
  on?(
    name: 'agent/created',
    listener: (payload: {
      readonly agent: unknown
      readonly source: string
      readonly signal?: AbortSignal
    }) => void | Promise<void>,
    options?: boolean | Record<string, unknown>,
  ): void
  on?(
    name: 'agent/disposed',
    listener: (payload: { readonly agent: unknown }) => void,
    options?: boolean | Record<string, unknown>,
  ): void
}

/** The durable-consumption surface the glue bundle reads off the domain. */
interface DomainConsumption {
  readonly model: {
    readonly resolveDurableModelSelection: typeof resolveDurableModelSelection
  }
  readonly capability: {
    readonly resolveDurableMcpFacet: typeof resolveDurableMcpFacet
  }
}

/** The frozen legacy reader entry as emitted into the runtime dist mirror. */
interface LegacyEntryModule {
  inspectLegacyTeam: LegacyInspectFn
}

/** The plain-JS glue module (config.glueUrl) export surface. */
interface GlueModule {
  createAgentBindings(deps: {
    readonly agents: unknown
    readonly sessionPersistence: unknown
    readonly domain: TeamDomain & { readonly consumption: DomainConsumption }
    readonly config: TeamPluginConfig
    readonly teamToolsRef: { current: unknown }
    readonly now: () => string
    /**
     * T12-M3 (optional additive): the DSH `subagents` public service,
     * structurally a superset of the glue's SubagentsDrainPort
     * (drainContinuableDescendants + listDescendants). Absent → the glue's
     * recursive drain fails closed with the typed
     * `recursive-drain-unavailable` (documented in the glue).
     */
    readonly subagents?: unknown
    /**
     * A6 (alpha.2 plan §11, optional additive): the shared control-service
     * reference (the teamToolsRef pattern — the entry creates the plain
     * `{ current: undefined }` object, passes it to BOTH the glue and the
     * root; the root fills `.current` during construction right after the
     * durable ControlService is built). The glue reads it LAZILY inside
     * agentSetup — and only for a bound template that declares
     * `capabilities.permissions` (absent policy = the ref is never read,
     * the alpha.1 / legacy path installs nothing; a present policy with an
     * unfilled ref fails closed with the typed
     * alpha2-permission-control-unavailable error).
     */
    readonly controlServiceRef?: { current: unknown }
    /**
     * D1 (v2 → v3, optional additive): the DSH `agentPresets` public service
     * surface — `mount(agentCtx, id?)` binds one agent scope to the ordinary
     * preset composition (the file/shell base-tool substrate) and
     * `composedPreset(agentCtx)` probes whether the agent already joined a
     * preset (the v3 already-joined guard for the production host-session
     * root, composed by the web setup — the roster's mount is the one bind
     * and refuses a second). The production host passes a LAZY accessor that
     * resolves the service per call (the sessionPersistence wrapper pattern
     * — immune to row apply-order); a composition without the service fails
     * closed with the typed TEAM_PLUGIN_SERVICE_MISSING at the first setup
     * mount, and a TEST world that passes no dep at all gets the glue's own
     * typed fail-closed (`member-base-tools-unavailable`). Members (v2) AND
     * root bind paths (v3: a plugin-created root otherwise has no base
     * tools and the leader file lanes are unreachable); an already-joined
     * agent keeps its existing composition (skip + observation).
     */
    readonly agentPresets?: {
      mount(agentCtx: unknown, presetId?: string): Promise<unknown>
      composedPreset?(agentCtx: unknown): string | undefined
    }
    /**
     * alpha.2 (A6 live fix V1-1, optional additive): the per-agent `fs` seam
     * accessor the permission adapter's `resolveTarget` closure resolves
     * file targets through (the public `fs.resolve(path, { cwd })` seam the
     * upstream file tools use — plan §7.2). The production host passes a
     * closure that resolves the DSH `fs` public service LAZILY per call via
     * the row's strict `ctx.get('fs')` (the global service store): the
     * property proxy `agentCtx.fs` is topology-sensitive (the Cordis
     * reflect walk) and the agent scope's fiber tree never passes through
     * this row's fiber — the `fs` service is host-plane — so it can never
     * resolve on the agent ctx (the V1 live matrix's
     * `cannot get property "fs" without inject`). Absent/unusable on a call
     * -> the typed TEAM_PLUGIN_SERVICE_MISSING, which the A2 adapter maps
     * to the fail-closed typed canonicalization denial (never a
     * pass-through). A template WITHOUT a permissions policy never calls
     * it (absent policy = nothing installed, alpha.1 / legacy behavior).
     */
    readonly fsBackend?: (agentCtx: unknown) => {
      resolve(path: string, options?: { cwd?: string }): Promise<unknown>
      /**
       * A2C-7 (alpha.2 plan §9) — the pinned upstream PUBLIC containment
       * seam (`FileSystem.contains(parent, child)`, synchronous on the
       * pinned `@deepseek-ai/dsh-fs` abstract; a thenable is tolerated
       * for a future async backend). The ONLY legal containment
       * authority for the `subtree` permission kind (plan §9.4: never
       * `startsWith`, never targetKey parsing). Optional: a provider
       * without a public `contains` keeps the pre-A2C-7 surface — the
       * adapter then treats subtree containment as undeterminable
       * (fail-closed semantics, never a minted grant).
       */
      contains?(parent: unknown, child: unknown): boolean | Promise<boolean>
    }
    /**
     * strict-read + core-spill (Phase D/E, implementation guide §13,
     * optional additive): the shared artifact-authority reference (the
     * controlServiceRef pattern — the entry creates the plain
     * `{ current: undefined }` object and passes it to the glue; the
     * BOOTSTRAP fills `.current` once the artifact-read authority of
     * the production root is constructed AND rebuilt from the durable
     * ledger — one authority per production root, implementation guide
     * §4). The glue reads it LAZILY inside agentSetup: for every
     * permissions-carrying template it installs the agent-scoped
     * `tools/result` observer (the Phase D shell-foreground grant
     * recording) and consults it in the Phase B read lane
     * (`authorizeArtifactRead`). Absent / unfilled at setup time → the
     * observer is not installed and the lane finds no grants (alpha.1
     * / factory-world behavior — byte-for-byte unchanged pipeline).
     */
    readonly artifactAuthorityRef?: { current: unknown }
    /**
     * pre-alpha3 PR4 (plan PR4 "production entry wiring", optional additive):
     * the shared permission-plane reference (the controlServiceRef pattern —
     * the entry creates the plain `{ current: undefined }` object and passes
     * it BOTH to the glue and to the production root; the ROOT fills
     * `.current` during its construction with the assembled lifecycle lanes).
     * The glue reads it LAZILY inside agentSetup: when present, the
     * pre-execute listener gains the dynamic decision layer (the ADR §8
     * lifecycle gate + the durable overlay authority over this decision's
     * canonical static lanes); when absent, the static pipeline is unchanged.
     */
    readonly permissionPlaneRef?: { current: unknown }
    /**
     * BP-F (issue #2 blueprint-loading, plan §11.1, optional additive):
     * the narrow per-Team bound-blueprint resolver —
     * (teamRootSid) => the parsed TeamBlueprint bound to that team root.
     * The production host builds it over the opened domain + the live
     * authority (the durable TeamSession row's bound snapshot ref ->
     * resolveSnapshot; the hash equality is verified; a frozen revision
     * replays the registry row's stored source text). The glue consumes it
     * as the DYNAMIC Team authority for persona / static capabilities /
     * permissions of every agent setup under that root — the row-global
     * `config.blueprintSource` is only the no-resolver fallback (factory
     * worlds). Absent → the glue's legacy row-global anchor resolution
     * (pre-repair behavior, byte-for-byte).
     */
    readonly resolveBoundBlueprint?: (teamRootSid: string) => unknown
    /**
     * C1 (restart-recovery, guide §4.3, optional additive): the Team
     * session-activation fence (guide §3) the production host registers
     * at the very top of `apply()` (the AWAITED `agent/created` veto +
     * the `agent/disposed` rollback barrier — guide §8). The glue wraps
     * EVERY Team create/resume in `runOwned` (the ownership guard —
     * guide §6.1), waits declared rollbacks in `ensureLiveAgent`
     * (`awaitRollback`), and performs its single bounded writer-conflict
     * recovery wait (`recoverWriterConflict` — guide §7.2). Optional: a
     * test/factory world may omit it — the glue then falls back to the
     * direct operations (guide §4.3 — no blanket break of the pre-C1
     * test doubles). The production host MUST pass it.
     */
    readonly activationFence?: TeamSessionActivationFence
    /**
     * C1 (restart-recovery, guide §7.2, optional): the bounded window of
     * the glue's single writer-conflict recovery wait, in ms. The
     * production host passes none (the glue default, 10 s — a safety
     * bound, not a sleep); a test world overrides it for determinism.
     */
    readonly writerHandoffTimeoutMs?: number
    /**
     * pre-alpha3 PR-B (plan §B.2, optional additive): the production
     * PolicyReader reference (the controlServiceRef pattern — the entry
     * creates the plain `{ current: null }` object, passes it to the
     * glue, and fills `.current` with `builtRoot.policyReader` right
     * after the root is constructed). The glue reads it LAZILY in
     * `resolveConsumptionViews`: present/filled = the canonical live
     * boundary read (the production PolicyReader + the durable
     * PolicyState transitions — the SAME read the activation step 8,
     * inspect-config, and the projection views run); absent/unfilled
     * (test worlds, and the boot window before the root fills it) = the
     * pre-PR-B legacy input (config external facts + template static
     * grants + the implicit `default` state — bit-for-bit unchanged).
     */
    readonly policyReaderRef?: { current: unknown }
    /**
     * pre-alpha3 PR-C §C.6/§C.7 (optional additive): the durable
     * capability-runtime telemetry hook. The glue emits one capability
     * readiness transition per MCP mount (mount-failed / mount-restored);
     * the production host records each as a `capability-runtime-event`
     * ledger fact (the compatibility category's first production writer).
     * Absent (test worlds without the durable telemetry) → the glue's emit
     * is a no-op. Best-effort on the glue side: the host's write failure
     * PROPAGATES to the glue's caller, which observes it (never fails the
     * member's MCP reconciliation).
     */
    readonly capabilityTelemetry?: (
      rootSessionId: string,
      event: {
        kind: string
        capabilityType: string
        capabilityName: string
        verdict: 'unknown' | 'reachable' | 'unreachable'
        source: string
        observedAt: string
        attempt?: number
        reason?: string
      },
    ) => Promise<void>
    /**
     * pre-alpha3 W2-A (review fix F4, guide §5 B, optional additive): the
     * PRODUCTION persona-substrate resolver — (rootSessionId) => the REAL
     * observed substrate fact of the owning root (the RuntimeSubstratePlan
     * root entry: the row's rootPresetId observed through the production
     * persona observer over the DSH public agentPresets seam). The glue
     * AWAITs it on the production path (the persona slot is built over the
     * observed substrate, cached per root only on success — an
     * `unresolved` substrate fails the bind closed, and a later bind re-
     * probes; NEVER the shipped-state 'standard' guess). Absent (factory /
     * test worlds) -> the glue's legacy seam (config.presetSubstrate ??
     * the S5A A11 standard default), byte-for-byte unchanged.
     */
    readonly resolvePersonaSubstrate?: (rootSessionId: string) => Promise<{
      readonly presetId: string
      readonly personaKind: 'standard' | 'complete' | 'absent' | 'unresolved'
      readonly source?: string
      readonly reason?: string
    }>
  }): TeamAgentBindings
}

/**
 * T12-M4 — the Remote mount outcome recorded on the facade.
 *
 * `mounted` when the production wiring owns the `/team-remote` channel on
 * the public connection seam — immediately at the mount step, or LATE
 * when the `connection` service appears inside the bounded wait window.
 * `pending` between the mount step and a terminal decision: the service
 * was absent at the mount step and the row waits up to `remoteMountWaitMs`
 * (the web profile's client-connection row provides the service on an
 * independent fiber — a slow boot can lose the one-shot read; the pre-fix
 * entry decided once and silently skipped forever: the user-world 405).
 * `skipped` when the wait window expires (headless host, or the web
 * connection service never appeared) — the remote surface stays unmounted
 * WITHOUT failing the boot. `failed` when the service appears MALFORMED,
 * or the late registration throws, inside the window. Every terminal
 * outcome is ALSO logged to the console (the observable channel the
 * Cordis logger is not). `undefined` means the bootstrap never reached
 * the mount step (an earlier failure).
 */
type RemoteMountState =
  | { readonly state: 'mounted'; readonly channel: string }
  | { readonly state: 'pending' }
  | { readonly state: 'skipped'; readonly reason: string }
  | { readonly state: 'failed'; readonly reason: string }

/**
 * Remote-mount-race fix (root cause A): the production default for
 * `remoteMountWaitMs` — the bounded window the entry waits for the web
 * profile's `connection` service to appear after the mount step before
 * explicitly skipping the remote mount. The window covers the measured
 * slow-boot delta (the service appeared ~0.6–0.7 s after the row's apply
 * in the user-world boot) with wide margin. A headless host pays the
 * window once per boot — the cost of a TERMINAL, LOGGED decision instead
 * of a permanent silent skip.
 */
const DEFAULT_REMOTE_MOUNT_WAIT_MS = 30_000

/** The connection-poll interval inside the bounded wait window. */
const REMOTE_MOUNT_POLL_MS = 100

/**
 * Register the upstream resolution hook exactly once per process (a second
 * `module.register` would stack a duplicate hook in the resolution chain).
 *
 * Layout-agnostic candidate search, production layout FIRST:
 *
 *   1. the DIST mirror depth (the production world) — five up from
 *      `dist/packages/runtime/src/plugin/host.js` is
 *      `<worktree>/packages/runtime`, so the hook resolves to the
 *      source-tree `<worktree>/packages/runtime/src/plugin/upstream-resolver.mjs`
 *      — the EXACT file the pre-candidate code computed (tsc never copies
 *      the .mjs into the mirror). Production behavior is bit-identical.
 *   2. the SOURCE depth (reachable only under the unit-test runner) —
 *      four up from `src/plugin/host.ts` is the worktree root, so the SAME
 *      file as `<worktree>/packages/runtime/src/plugin/upstream-resolver.mjs`.
 *
 * The hook file is itself world-agnostic: upstream-resolver.mjs derives its
 * checkout candidates from its OWN path, which is identical for both
 * candidates — registering it from either layout is the same registration.
 *
 * Fail closed: if NO candidate resolves, the SAME error surface as the
 * pre-candidate single `register()` call — Node's ERR_MODULE_NOT_FOUND for
 * the missing hook (the first candidate's error is rethrown). No new stable
 * code, no silent fallback to a wrong file. The once-per-process flag is set
 * only AFTER a successful registration, so a failed registration cannot
 * poison later apply attempts.
 */
function registerUpstreamResolverOnce(): void {
  const g = globalThis as typeof globalThis & {
    __dshAgentTeamUpstreamResolverRegistered?: boolean
  }
  if (g.__dshAgentTeamUpstreamResolverRegistered === true) return
  const hookCandidates: readonly string[] = [
    // dist/.../src/plugin/host.js → five up = <worktree>/packages/runtime.
    '../../../../../src/plugin/upstream-resolver.mjs',
    // src/plugin/host.ts → four up = the worktree root.
    '../../../../packages/runtime/src/plugin/upstream-resolver.mjs',
  ]
  const errors: Array<unknown> = []
  for (const candidate of hookCandidates) {
    try {
      register(new URL(candidate, import.meta.url).href)
      g.__dshAgentTeamUpstreamResolverRegistered = true
      return
    } catch (error) {
      errors.push(error)
    }
  }
  // Fall-through is only reachable when EVERY candidate threw, so `errors`
  // is non-empty; rethrow the FIRST candidate's error — the exact error
  // surface of the pre-candidate single register() call.
  throw errors[0]
}

/**
 * Validate the row `config` channel loudly (plan §19.2: the row config is
 * the entry's ONLY input channel — a malformed composition must reject
 * apply, not degrade).
 * @param raw - the unvalidated `config:` of the row.
 * @returns the validated config.
 * @throws {TeamPluginError} TEAM_PLUGIN_CONFIG_INVALID with the failing field.
 */
export function validateTeamPluginConfig(raw: unknown): TeamPluginConfig {
  // NB: function declaration, not a const arrow — TypeScript 6.0.3 control
  // flow only treats a never-returning call as an abrupt completion when the
  // callee is a function declaration (or ambient declaration); never-typed
  // arrow const expressions do not narrow the guard below it (probe-verified
  // against this repo's toolchain, see dev evidence P8-S build notes).
  function fail(detail: string): never {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID,
      `dsh-agent-team row config: ${detail}`,
    )
  }
  const c = raw as (Partial<TeamPluginConfig> & Record<string, unknown>) | null
  if (c === null || typeof c !== 'object' || Array.isArray(c)) fail('must be a plain object')
  if (c.bootPhase !== 'create' && c.bootPhase !== 'resume' && c.bootPhase !== 'create-or-open') fail('bootPhase must be "create", "resume" or "create-or-open"')
  if (typeof c.rootSessionId !== 'string' || c.rootSessionId.length === 0) fail('rootSessionId must be a non-empty string')
  if (typeof c.blueprintSource !== 'string' || c.blueprintSource.length === 0) fail('blueprintSource must be a non-empty string')
  // BP3 (issue #2 blueprint-loading, plan §7.1): the optional saved-source
  // directory. Absent = the filesystem catalog is disabled (the legacy
  // inline-bootstrap-only behavior); present = a non-empty path string
  // (absolute, or relative to the host process.cwd()).
  if (c.blueprintDir !== undefined && (typeof c.blueprintDir !== 'string' || c.blueprintDir.length === 0)) fail('blueprintDir must be a non-empty string when present')
  if (typeof c.generation !== 'number' || !Number.isInteger(c.generation) || c.generation < 1) fail('generation must be a positive integer')
  if (c.defaultWorkspace !== undefined && typeof c.defaultWorkspace !== 'string') fail('defaultWorkspace must be a string when present')
  if (!Array.isArray(c.seedMembers)) fail('seedMembers must be an array')
  for (const seed of c.seedMembers as readonly TeamPluginSeedMember[]) {
    if (
      seed === null ||
      typeof seed !== 'object' ||
      typeof seed.instanceId !== 'string' ||
      typeof seed.templateId !== 'string' ||
      typeof seed.label !== 'string' ||
      typeof seed.childSessionId !== 'string'
    ) {
      fail('every seedMember needs instanceId/templateId/label/childSessionId strings')
    }
  }
  if (
    c.staticModel === null ||
    typeof c.staticModel !== 'object' ||
    typeof c.staticModel.provider !== 'string' ||
    typeof c.staticModel.model !== 'string'
  ) {
    fail('staticModel must be { provider, model } strings')
  }
  if (
    c.deniedSelection !== null &&
    (c.deniedSelection === undefined ||
      typeof c.deniedSelection !== 'object' ||
      Array.isArray(c.deniedSelection))
  ) {
    fail('deniedSelection must be a plain object or null')
  }
  // multi-mcp (Task A, contract I3): the legacy single-value check is
  // replaced IN PLACE by the shared MCP-supply validator (I1): it
  // validates the new canonical `mcpServers` (0..N, unique names —
  // C1/C2) and, when `mcpServers` is absent, the legacy `mcpServer`
  // with the byte-identical detail (C7). The single fail() error
  // envelope below is unchanged; the surrounding validation order is.
  // The cast bridges the raw JSON row config (Partial + index signature)
  // to the validator's typed parameter — the check itself is total over
  // the JSON shape (fail-closed on every branch).
  const mcpIssue = mcpSupplyValidationIssue(
    c as unknown as Pick<TeamPluginConfig, 'mcpServer' | 'mcpServers'>,
  )
  if (mcpIssue !== null) fail(mcpIssue)
  if (!Array.isArray(c.environmentFacts)) fail('environmentFacts must be an array')
  if (
    c.externalPolicyFacts === null ||
    typeof c.externalPolicyFacts !== 'object' ||
    c.externalPolicyFacts.hard === undefined ||
    typeof c.externalPolicyFacts.hard !== 'object' ||
    c.externalPolicyFacts.capabilityExists === undefined ||
    typeof c.externalPolicyFacts.capabilityExists !== 'object'
  ) {
    fail('externalPolicyFacts must be { hard, capabilityExists } maps')
  }
  if (
    c.glueUrl !== undefined &&
    (typeof c.glueUrl !== 'string' || c.glueUrl.length === 0)
  ) {
    fail('glueUrl must be a non-empty file URL string when present')
  }
  if (c.seamUrl !== undefined && typeof c.seamUrl !== 'string') fail('seamUrl must be a file URL string when present')
  if (
    c.remoteMountWaitMs !== undefined &&
    (typeof c.remoteMountWaitMs !== 'number' ||
      !Number.isInteger(c.remoteMountWaitMs) ||
      c.remoteMountWaitMs < 0)
  ) {
    fail('remoteMountWaitMs must be a non-negative integer (milliseconds) when present')
  }
  // D1 (v2): the member preset id is an OPTIONAL additive field — absent
  // (undefined) selects the deployment default preset (the glue passes no
  // id to the service); when present it must be a non-empty string (an
  // empty id would fail closed at service resolution anyway — fail early
  // at the composition boundary, loudly).
  if (
    c.memberPresetId !== undefined &&
    (typeof c.memberPresetId !== 'string' || c.memberPresetId.length === 0)
  ) {
    fail('memberPresetId must be a non-empty string when present (absent = the deployment default preset)')
  }
  // D1 (v3): the ROOT (leader) preset id — the exact mirror of
  // memberPresetId for the root bind paths (the plugin-created leader
  // mounts its ordinary base tools the same way the members do; a
  // plugin-created root otherwise has no base tools and the leader file
  // lanes are unreachable — plan §13-L4 / §12.3). Absent = the deployment
  // default preset; present = a non-empty string.
  if (
    c.rootPresetId !== undefined &&
    (typeof c.rootPresetId !== 'string' || c.rootPresetId.length === 0)
  ) {
    fail('rootPresetId must be a non-empty string when present (absent = the deployment default preset)')
  }
  // alpha.1 (plan §8.2): the Team-managed skill definitions are an
  // OPTIONAL additive field — absent (undefined) = the empty catalog (no
  // Team-managed skills materialize); when present every entry must be a
  // plain { name, description, content, provider? } record (the catalog
  // deduplicates by name; an empty name would fail closed at the policy
  // item matching — fail early at the composition boundary, loudly).
  if (c.teamSkills !== undefined) {
    if (!Array.isArray(c.teamSkills)) fail('teamSkills must be an array when present')
    for (const skill of c.teamSkills as readonly TeamSkillDefinitionConfig[]) {
      if (
        skill === null ||
        typeof skill !== 'object' ||
        Array.isArray(skill) ||
        typeof skill.name !== 'string' ||
        skill.name.length === 0 ||
        typeof skill.description !== 'string' ||
        typeof skill.content !== 'string' ||
        (skill.provider !== undefined && typeof skill.provider !== 'string')
      ) {
        fail('every teamSkill needs name/content/description strings (name non-empty; provider an optional string)')
      }
    }
  }
  return c as unknown as TeamPluginConfig
}

/**
 * The default live-agent glue URL, derived from this host entry's own
 * module location: the dist layout carries the byte-copied mirror
 * (place-dist-glue.mjs) next to the emitted host.js, and the source layout
 * carries the original .mjs next to host.ts — one relative specifier, both
 * layouts. An explicit `config.glueUrl` always wins.
 * @param hostModuleUrl - this entry's `import.meta.url`.
 * @returns the derived glue file URL.
 */
export function defaultGlueUrl(hostModuleUrl: string): string {
  return new URL('./live/agent-bindings.mjs', hostModuleUrl).href
}

/**
 * The row config with the default-workspace derivation applied
 * (plugin-bundle-form D9): an explicit `config.defaultWorkspace` always
 * wins; when absent the team rows inherit the directory the operator
 * launched the host from. The machine-agnostic bundle row (root
 * `cordis.patch.yml`) can carry no absolute path, but the projection fold
 * REQUIRES a resolvable effective workspace on every team row (member row
 * workspace ?? team default ?? fail-closed ProjectionError — a created
 * team without one is unprojectable end-to-end), and the glue's own
 * `effectiveRootWorkspace` falls back to the same config value — so the
 * entry supplies the launch directory and both surfaces agree.
 * @param config - the validated row config.
 * @param launchCwd - the host process's working directory.
 * @returns the config with `defaultWorkspace` guaranteed present.
 */
export function withDefaultWorkspace(config: TeamPluginConfig, launchCwd: string): TeamPluginConfig {
  if (config.defaultWorkspace !== undefined) return config
  return { ...config, defaultWorkspace: launchCwd }
}

/**
 * The default storage-seam URL candidates, per module layout (the dist
 * entry sits five directory levels below the runtime package root —
 * `dist/packages/runtime/src/plugin` — the source entry two — the same
 * layout-agnostic candidate pattern as `loadLegacyInspect`). An explicit
 * `config.seamUrl` always wins.
 * @param hostModuleUrl - this entry's `import.meta.url`.
 * @returns the candidate file URLs, dist layout first.
 */
export function defaultSeamUrlCandidates(hostModuleUrl: string): readonly string[] {
  return [
    new URL('../../../../../root-binding/harness/seam.mjs', hostModuleUrl).href,
    new URL('../../root-binding/harness/seam.mjs', hostModuleUrl).href,
  ]
}

/**
 * Pick the effective default seam URL: the first candidate that exists on
 * disk, or a fail-closed error naming every tried path (a missing
 * co-located seam is a build/install failure, not a fallback case).
 * @param hostModuleUrl - this entry's `import.meta.url`.
 * @returns the file URL of the first existing candidate.
 * @throws {TeamPluginError} TEAM_PLUGIN_GLUE_UNAVAILABLE when no candidate exists.
 */
function resolveDefaultSeamUrl(hostModuleUrl: string): string {
  const candidates = defaultSeamUrlCandidates(hostModuleUrl)
  const found = candidates.find((candidate) => existsSync(fileURLToPath(candidate)))
  if (found === undefined) {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_GLUE_UNAVAILABLE,
      `no "teamStorageSeam" service is provided and no default seam module was found (tried: ${candidates.join(' | ')})`,
    )
  }
  return found
}

/**
 * Load the frozen legacy reader entry through the layout-agnostic
 * candidate search (the relative specifiers are resolved against THIS
 * module's URL, so each candidate hits a different absolute file per
 * layout — see the inline rationale at the call site for the full
 * production-first candidate contract).
 *
 * Fail closed: if NO candidate loads, the SAME stable code as the
 * pre-candidate single-URL import (TEAM_PLUGIN_GLUE_UNAVAILABLE) — no new
 * error surface, no silent fallback to a wrong file.
 */
async function loadLegacyInspect(): Promise<LegacyInspectFn> {
  const legacyEntryCandidates: readonly string[] = [
    // dist/.../src/plugin/host.js → five up = <worktree>/packages/runtime
    // → the BUILT mirror file (the legacy package is noCheck-built
    // separately into the runtime dist mirror).
    '../../../../../dist/packages/legacy/session-reader/index.js',
    // src/plugin/host.ts → three up = <worktree>/packages → the
    // session-reader TS source location (the unit-test runner's .js→.ts
    // sibling hook loads the source module; a fresh checkout has no dist
    // by definition — the layout this candidate exists for).
    '../../../legacy/session-reader/index.js',
  ]
  const failures: string[] = []
  for (const candidate of legacyEntryCandidates) {
    try {
      const legacyEntry = (await import(candidate)) as LegacyEntryModule
      if (typeof legacyEntry.inspectLegacyTeam !== 'function') {
        throw new Error('the legacy entry does not export inspectLegacyTeam')
      }
      return legacyEntry.inspectLegacyTeam
    } catch (error) {
      failures.push(`${candidate}: ${String(error)}`)
    }
  }
  throw new TeamPluginError(
    TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_GLUE_UNAVAILABLE,
    `the frozen legacy reader entry could not be loaded: ${failures.join(' | ')}`,
  )
}

/**
 * The plugin name (Cordis named-export protocol; the row id is
 * `dsh-agent-team`).
 */
export const name = 'dsh-agent-team'

/**
 * The hard host service dependencies (Cordis inject protocol): the Loader
 * keeps this row INACTIVE until all four exist and applies it once they
 * do (the pre-S5A harness row injected the same set minus
 * `sessionPersistence`, which it resolved lazily — R122 swapped that seam:
 * rc.1 removed `sessionPersistence.ensureMaterialized`, and the stock
 * `sessions` service's `flush(session)` is the upstream ACP's own
 * replacement, present in both eras, so waiting on it can only ever delay,
 * never deadlock, the bootstrap). M2 (plan §15.5): `workspaceRegistry`
 * joins the set as a HARD dependency — the web profile's workspace row
 * provides it, and a composition without that row parks this row forever
 * (the team surface is absent, never half-wired); the entry re-checks the
 * service in code (fail-closed, before any durable effect) so a
 * malformed provider can never reach the closure. The entry still passes
 * a LAZY accessor under the frozen glue's `sessionPersistence` deps key
 * so any call that races the provider fails with a stable code instead of
 * a TypeError.
 */
export const inject = ['agents', 'storageDomain', 'sessions', 'sessionPersistence', 'workspaceRegistry']

/**
 * The plugin entry (Cordis named-export protocol: the loader awaits the
 * apply fiber). The apply body itself never rejects: it provides the
 * `teamRoot` facade synchronously and tracks every setup failure through
 * the facade's `ready` promise (a rejected apply fiber is absorbed into
 * the Cordis logger, which the harness never observes — `ready` is the
 * single observable failure channel).
 * @param ctx - the plugin context (services via `ctx.get`; this entry
 *   provides `teamRoot`).
 * @param config - the row `config:` (validated loudly; see
 *   {@link validateTeamPluginConfig}).
 */
export async function apply(ctx: TeamPluginHostContext, config?: unknown): Promise<void> {
  // --- C1 (restart-recovery, guide §4.1): the Team activation fence ------
  // The fence must be established at the VERY FRONT of apply() — before
  // the bootstrap's first await — and its `agent/created` listener
  // registered IMMEDIATELY: after the browser connects, an ordinary
  // Session resume of a Team-owned session can fire while the Team
  // bootstrap is still running (guide §4.1: "activation listener 不能等
  // 到 bootstrap() 最后才注册"). Both listeners are registered with
  // `{ global: true }` (process-wide — the fence must see EVERY activation
  // of this process's Team-owned sessions, not only this row's fiber),
  // and they are structural no-ops when the host provides no `on` (the
  // same absence-guard as the internal/get seam below).
  //
  // `agent/created` is the AWAITED serial seam (0.1.7-rc.1): the listener
  // promise rejection propagates into the create/resume and the upstream
  // AgentLoop rolls the unpublished agent back into `agent/disposed` —
  // that veto → rollback → writer-released sequence is the fence's safety
  // boundary (guide §8). `agent/disposed` is fire-and-forget (listener
  // errors are only logged upstream): the onAgentDisposed barrier must
  // never throw (it cannot — a plain map read + resolve).
  const activationFence = createTeamSessionActivationFence()
  // Supplement round §2.3-C — PRODUCTION fence-surface completeness: the
  // production host passes THIS fence to the glue (runOwned / exact
  // generation claim / rollback epoch / recovery), so a factory that
  // drifts to an incomplete surface must fail LOUD here (before the
  // listeners register and before any boot / race), not surface as an
  // `undefined` at the race. The test/factory worlds may omit the fence
  // entirely (the glue's documented pre-C1 fallback) — this check is
  // production-only, and it checks the WHOLE surface the glue consumes:
  // the pre-round methods PLUS the supplement round's
  // claimOwnedGeneration / releaseOwnedGeneration / getRollbackEpoch and
  // the reworked recoverWriterConflict.
  const FENCE_SURFACE_METHODS: readonly (keyof TeamSessionActivationFence)[] = [
    'runOwned',
    'beforeAgentCreated',
    'claimOwnedGeneration',
    'releaseOwnedGeneration',
    'onAgentDisposed',
    'awaitRollback',
    'getRollbackEpoch',
    'recoverWriterConflict',
    'permitOrdinaryOnce',
    'bindOwnershipResolver',
    'close',
  ]
  for (const method of FENCE_SURFACE_METHODS) {
    if (typeof activationFence[method] !== 'function') {
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_GLUE_UNAVAILABLE,
        `the production activation fence is missing the required surface method \`${String(method)}\` (incomplete fence factory — the glue requires the full TeamSessionActivationFence surface before any activation)`,
      )
    }
  }
  if (typeof ctx.on === 'function') {
    ctx.on(
      'agent/created',
      (payload) => {
        return activationFence.beforeAgentCreated({
          agent: payload.agent as TeamActivationAgent,
          source: payload.source as TeamSessionStartSource,
          ...(payload.signal !== undefined ? { signal: payload.signal } : {}),
        })
      },
      { global: true },
    )
    ctx.on(
      'agent/disposed',
      (payload) => {
        activationFence.onAgentDisposed(payload.agent as TeamActivationAgent)
      },
      { global: true },
    )
  }

  // --- 0.1.5 remote-channel compatibility seam (`webServer` reads) -------
  // The host's dsh-client-connection service registers RPC channels —
  // `connection.rpc.handle(channel, mounted)`, the seam this row uses to
  // mount /team-remote — with `owner.webServer.register(route)`. Cordis
  // resolves that property read through the `internal/get` waterfall whose
  // fallback walks the ANCESTOR fibers of the connection row's own origin
  // context. On 0.1.2-era hosts the walk finds `webServer` because the
  // connection row injects it. Upstream commit 2ef85b1e17 — shipped in
  // every 0.1.5 build — removed `webServer` from the connection row's
  // inject, so the walk finds nothing and every external row's
  // `connection.rpc.handle(...)` fails on 0.1.5+ hosts with `cannot get
  // property "webServer" without inject`. This listener (an effect of this
  // row's fiber, disposed with the row) resolves the `webServer` property
  // read through the strict service read instead: the same service
  // instance the built-in walk returns on 0.1.2-era hosts, located
  // topology-independently.
  //
  // SCOPE (F1, PR #17 review + the real-host probe,
  // evidence/.../probe/runs/f1-shim-probe-*): the listener serves the
  // `webServer` read ONLY while THIS row's own registration call
  // (`mountRemoteNow` → `registerRemote(connection)` →
  // `connection.rpc.handle('/team-remote', ...)`) is in flight
  // (`teamRemoteMountInFlight`). The probe established the caller
  // topology: the waterfall receiver is a per-call traceable SHADOW of
  // the CALLING row's context (the read's reader fiber is the CALLER
  // row's own fiber; a fresh proxy per call — so `readerCtx === ctx`
  // never holds for the service-mediated read and no reader-proxy
  // caching is possible). Without the flag, the process-wide listener
  // served ANY row's `webServer` read while this plugin was loaded —
  // an unrelated row's broken dependency declaration was masked (and an
  // unrelated plugin could mount foreign RPC channels through the seam
  // — both demonstrated live in the pre-fix probe run). With the flag,
  // every `webServer` read outside the registration window falls
  // through to the built-in walk verbatim: native Cordis failure where
  // the inject is missing (the unrelated row keeps its exact prior
  // failure) and unchanged native success where the walk already
  // resolves it (0.1.2-era hosts, headless hosts, and every host row
  // that declares its own `webServer` inject). The read is synchronous
  // inside the call (the connection service's `owner.effect(...)` runs
  // its body in the same tick — verified in the 0.1.5 cordis source and
  // in the probe's single-event-per-mount trace), so the window covers
  // exactly the read(s) of the in-flight registration.
  let teamRemoteMountInFlight = false
  if (typeof ctx.on === 'function') {
    ctx.on('internal/get', (readerCtx, prop, _error, next) => {
      if (prop !== 'webServer') return next()
      if (!teamRemoteMountInFlight) return next()
      const value = readerCtx.get('webServer')
      return value !== undefined ? value : next()
    })
  }

  // --- the bundled team skills (plugin-attached skills) ------------------
  // Register the two team skills that ship inside the installed package on
  // the `skills` public service. This is a soft add-on: an absent/malformed
  // `skills` service or an unresolvable install-surface directory degrades
  // with a loud console.warn and NEVER blocks the team core (the base
  // bundle's skill row precedes this row on the host composition, so the
  // service is present on a real host; a skill-less test composition simply
  // gets no team skills). The registration is an effect of THIS row's fiber
  // (the row's apply context), so a row stop / plugin removal disposes it.
  // Fire-and-forget: `registerTeamSkills` is total (never rejects — every
  // failure path degrades to a console.warn) and its `registerProvider`
  // call runs synchronously before its only await, so the provider is live
  // on this fiber the moment the call is made.
  void registerTeamSkills(ctx, import.meta.url)

  // The lazy materialization accessor (served to the frozen glue under its
  // `sessionPersistence` deps key as `ensureMaterialized`): resolved per
  // call so the first materialization — long after the stock host is fully
  // up — observes a settled service, not a concurrent profile load. R122:
  // rc.1 removed `sessionPersistence.ensureMaterialized`; the stock
  // `sessions` service's `flush(session)` is the upstream ACP's own
  // replacement (the attached log writer's flush materializes an empty
  // session durably) and is present in both the alpha.1 and rc.1 hosts.
  //
  // C1 (restart-recovery, guide §5.1): the wrapper ALSO serves `exists`
  // — the DURABLE-EXISTENCE seam the glue's cold-resume eligibility reads
  // (replacing the pre-C1 physical `DSH_HOME` layout probe). Existence is
  // the upstream `SessionPersistence.stat(id) !== undefined` contract
  // (no ownership claim, no backend assumption — `undefined` =
  // nonexistent; the raw service has no `exists`, so the wrapper
  // synthesizes it). The service is read LAZILY per call (the
  // sessionPersistence wrapper pattern — immune to row apply-order); a
  // missing service / missing `stat` fails closed with the stable code
  // INSTEAD of letting the glue guess on disk (guide §5.1: a fault must
  // propagate, never be misread as "not durable"). Note: the upstream
  // `SessionId` branding is a runtime no-op (`brandString` identity), so
  // the structural seam accepts the raw id — this entry keeps its
  // deliberate structural independence from the upstream packages (plan
  // §19.2: zero `@deepseek-ai/*` imports in the host entry).
  const sessionPersistence = {
    ensureMaterialized(session: unknown): Promise<unknown> {
      const svc = ctx.get('sessions') as
        | { flush?: (session: unknown) => Promise<unknown> }
        | null
        | undefined
      if (svc === undefined || svc === null || typeof svc.flush !== 'function') {
        throw new TeamPluginError(
          TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
          'the "sessions" public service is absent (or lacks flush) — it is resolved lazily per call and must be up before agent materialization runs',
        )
      }
      return svc.flush(session)
    },
    async exists(sessionId: string): Promise<boolean> {
      const persistence = ctx.get('sessionPersistence') as
        | { stat?: (id: unknown) => Promise<unknown | undefined> }
        | null
        | undefined
      if (
        persistence === undefined ||
        persistence === null ||
        typeof persistence.stat !== 'function'
      ) {
        throw new TeamPluginError(
          TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
          'the "sessionPersistence" public service is absent (or lacks stat) — durable session existence is read through its public seam, never through a physical layout probe',
        )
      }
      return (await persistence.stat(sessionId)) !== undefined
    },
  }

  // D1 (v2 → v3): the lazy agentPresets accessor (served to the glue under
  // its `agentPresets` deps key as `mount` + `composedPreset`): resolved per
  // call so the first agent setup — long after the stock host is fully up —
  // observes a settled service, not a concurrent profile load (the web
  // profile's `agent-presets` row provides the service on its own fiber). A
  // composition WITHOUT the service fails closed with a stable code at the
  // FIRST setup mount instead of a TypeError — and, through the setup
  // rejection, the unpublished agent rolls back (the AgentSetup contract):
  // an agent must never silently run without its ordinary base tools (the
  // D1 defect, v2 members / v3 root). `composedPreset` is the v3
  // already-joined probe: NON-THROWING (absent service or absent method →
  // `undefined` = unjoined → the mount runs), so the glue's guard stays
  // inert on a service-less composition. Deliberately NOT in the hard
  // `inject` array: parking this row on an optional service would break
  // compositions that never create agents; the lazy read + setup-time
  // fail-closed is the additive pattern (cf. the pre-S5A sessionPersistence
  // row).
  const agentPresets = {
    mount(agentCtx: unknown, presetId?: string): Promise<unknown> {
      const svc = ctx.get('agentPresets') as
        | { mount?: (agentCtx: unknown, presetId?: string) => Promise<unknown> }
        | null
        | undefined
      if (svc === undefined || svc === null || typeof svc.mount !== 'function') {
        throw new TeamPluginError(
          TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
          'the "agentPresets" public service is absent (or lacks mount) — it is resolved lazily per call and must be up before an agent setup mounts its ordinary preset',
        )
      }
      return svc.mount(agentCtx, presetId)
    },
    composedPreset(agentCtx: unknown): string | undefined {
      const svc = ctx.get('agentPresets') as
        | { composedPreset?: (agentCtx: unknown) => string | undefined }
        | null
        | undefined
      if (svc === undefined || svc === null || typeof svc.composedPreset !== 'function') {
        return undefined
      }
      return svc.composedPreset(agentCtx)
    },
  }

  // pre-alpha3 W2-A (review fix F14, guide §5 B): the PRODUCTION persona
  // observer over the DSH public `agentPresets` seam — `compositionInventory`
  // (the live presence / enablement: a missing or disabled persona row is
  // `absent`, an `!!js` conditional row is unresolvable offline) +
  // `readDocument` (the declared composition — the `config.complete` fact
  // that decides standard vs complete). The seam mirror is LAZY (the
  // sessionPersistence wrapper pattern — resolved per call, immune to row
  // apply-order); a service-level failure (absent service, a rejecting
  // call, a malformed document) REJECTS and the observer maps it to a
  // typed `unresolved` observation — NEVER a shipped-state 'standard'
  // guess, and never a throw at assembly (the glue converts an unresolved
  // substrate into the typed bind failure at persona-slot construction).
  const personaSeamMirror: AgentPresetPersonaSeam = {
    async compositionInventory(): Promise<readonly PresetCompositionMirror[]> {
      const svc = ctx.get('agentPresets') as
        | { compositionInventory?: () => Promise<readonly PresetCompositionMirror[]> }
        | null
        | undefined
      if (svc === undefined || svc === null || typeof svc.compositionInventory !== 'function') {
        throw new TeamPluginError(
          TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
          'the "agentPresets" public service is absent (or lacks compositionInventory) — the production persona observer reads the live preset composition through its public seam (fail closed: a typed unresolved observation, never a shipped-state guess)',
        )
      }
      return svc.compositionInventory()
    },
    async readDocument(presetId: string): Promise<string> {
      const svc = ctx.get('agentPresets') as
        | {
            readDocument?: (
              presetId: string,
            ) => Promise<string | { readonly content?: string } | unknown>
          }
        | null
        | undefined
      if (svc === undefined || svc === null || typeof svc.readDocument !== 'function') {
        throw new TeamPluginError(
          TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
          'the "agentPresets" public service is absent (or lacks readDocument) — the production persona observer reads the declared preset composition through its public seam (fail closed: a typed unresolved observation, never a shipped-state guess)',
        )
      }
      const doc = await svc.readDocument(presetId)
      // The public service returns the document object (the `content` YAML
      // is the declared entry list); a bare string is tolerated for a
      // test-world double.
      if (typeof doc === 'string') return doc
      if (
        doc !== null &&
        typeof doc === 'object' &&
        typeof (doc as { readonly content?: unknown }).content === 'string'
      ) {
        return (doc as { readonly content: string }).content
      }
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
        `the "agentPresets" readDocument returned a malformed document for preset '${presetId}' — the declared composition cannot be read (fail closed: a typed unresolved observation, never a shipped-state guess)`,
      )
    },
  }
  const livePersonaObserver = createProductionPersonaObserver(personaSeamMirror)
  // pre-alpha3 W3-A (review fix F1) regression fix — the service-absent
  // fallback for the live production persona observer. The W2-A F14 live
  // probe is only meaningful when the DSH `agentPresets` public service is
  // present (real production); a test-world host entry that does not provide
  // the service (or a row without a root preset id) would otherwise observe
  // a typed `unresolved` and fail the bind closed. Such a service-absent
  // world falls back to the SHIPPED-STATE persona observation (the base
  // pre-W3-A substrate — the deployment default's composable `standard`
  // persona, a pure deployment-knowledge observation with no probe to
  // await). Real production (service present) keeps the live probe and its
  // fail-closed typed `unresolved` contract, byte-for-byte.
  const personaObserver: ProductionPersonaObserver = {
    observe: (presetId: string): Promise<PersonaKindObservation> => {
      const svc = ctx.get('agentPresets') as unknown
      if (svc === undefined || svc === null) {
        return Promise.resolve(shippedStatePersonaObserver(presetId))
      }
      return livePersonaObserver.observe(presetId)
    },
  }

  // alpha.2 (A6 live fix V1-1): the per-agent `fs` seam accessor (served to
  // the glue under its `fsBackend` deps key): resolved per call via the
  // row's STRICT `ctx.get('fs')` (the global service store — the host
  // profile's fs backend row provides the service on its own fiber). The
  // property proxy `agentCtx.fs` cannot serve the seam: the Cordis reflect
  // walk is topology-sensitive and the agent scope's fiber tree (agent
  // scope -> agent-loop factory runtime) never passes through THIS row's
  // fiber, so a declared-inject `fs` here would still be unreachable from
  // the agent ctx (the V1 live matrix's `cannot get property "fs" without
  // inject` — every file operation of a permissions-carrying agent died at
  // canonicalization, even the allow lane). A composition WITHOUT the
  // service fails closed with a stable code at the first resolve instead of
  // a TypeError — the A2 adapter maps the rejection to the typed
  // canonicalization denial (fail-closed, never a pass-through). A
  // permissions-free world never calls it (absent policy = nothing
  // installed). Deliberately NOT in the hard `inject` array: parking this
  // row on the fs backend would break compositions that host a team without
  // file tools (they would run the alpha.1 surface); the lazy read is the
  // additive pattern (cf. agentPresets above).
  const fsBackend = (): {
    resolve(path: string, options?: { cwd?: string }): Promise<unknown>
    contains?(parent: unknown, child: unknown): boolean | Promise<boolean>
  } => {
    const svc = ctx.get('fs') as
      | {
          resolve?: (path: string, options?: { cwd?: string }) => Promise<unknown>
          contains?: (parent: unknown, child: unknown) => boolean | Promise<boolean>
        }
      | null
      | undefined
    if (svc === undefined || svc === null || typeof svc.resolve !== 'function') {
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
        'the "fs" public service is absent (or lacks resolve) — it is resolved lazily per call and must be up before parameter-permission canonicalization resolves a file target (fail-closed: a typed canonicalization denial, never a pass-through)',
      )
    }
    // A2C-7: the containment seam rides the SAME lazy provider (only
    // exposed when the provider exposes it — an absent `contains` is
    // the pre-A2C-7 surface, not an error at install).
    //
    // RC2-A1 (live-verified 2026-09-17, smoke run 11-02-31, probe rows
    // `a1-fs-backend` / `a1-contains-fault`; plan §11 Branch B / B1):
    // `contains: svc.contains` copied the METHOD REFERENCE into the plain
    // backend object WITHOUT its receiver. The host fs service is a
    // `SandboxedFileSystem` instance whose `contains` calls
    // `this.processPath` (upstream fs-local), so every subtree rule
    // canonicalization threw `this.processPath is not a function` and
    // the A2 adapter reported `containment-undeterminable` — fail-closed
    // canonicalization denial of the deny lane, which (documented
    // adapter semantics: a deny rule that cannot be canonicalized cannot
    // be dropped) also blocked the allow lane.
    //
    // The plan-preferred form (§11 B1 "优先第一种"), applied to BOTH
    // seams (A1-T1: the production facade must preserve the receiver on
    // resolve AND contains): call `svc.X(...)` inside the closure — the
    // receiver stays with the provider on EVERY call and the service
    // proxy identity is not frozen at facade-construction time (no
    // `.bind`). The resolve-side form matters too, not just as a T1
    // mirror: the upstream `LocalFileSystem.resolve` reads
    // `this.config.cwd` whenever the caller omits `opts.cwd` — an unbound
    // method reference would throw the same receiver-loss class of
    // TypeError on that path (latent in production: the glue always
    // threads the session-header cwd, FACT 3b).
    // The `!` is a type-level artifact only: the guards above prove
    // presence, but property-access narrowing cannot cross the closure
    // boundary.
    return {
      resolve: (path, options) => svc.resolve!(path, options),
      ...(typeof svc.contains === 'function'
        ? { contains: (parent: unknown, child: unknown) => svc.contains!(parent, child) }
        : {}),
    }
  }

  // The bootstrap (config validation, resolver hook arming, services,
  // seam, domain, glue, legacy reader, root construction, boot) runs as
  // the tracked `ready` promise; its results are captured here so the
  // facade getters and the row-stop effect can close over them.
  let root: TeamProductionRoot | undefined
  let openDomain: TeamDomain | undefined
  // T12-M4: the remote registration set by the production mount inside
  // bootstrap (undefined until the mount step; disposed by the row-stop
  // backstop below).
  let remoteRegistration: RemoteRegistration | undefined
  let remoteMountState: RemoteMountState | undefined
  // strict-read + core-spill (Phase E, implementation guide §4): the
  // shared artifact-authority reference (the controlServiceRef pattern)
  // — created here in the ENTRY scope (unlike the controlServiceRef, it
  // must outlive the bootstrap function body: the row-scope bridge
  // provision below and the row-stop backstop both consume it OUTSIDE
  // bootstrap), passed to the glue (which reads it lazily in
  // agentSetup), and filled by the bootstrap ONCE the authority of this
  // production root is constructed and REBUILT from the durable ledger
  // (one authority per production root — it shares the open TeamDomain
  // with the other runtime services; the durable facts are the source
  // of truth, the runtime projection a rebuilt cache).
  const artifactAuthorityRef: { current: TeamArtifactAuthority | undefined } = { current: undefined }
  // pre-alpha3 PR4 — the overlay store handle of THIS row, declared in the
  // apply scope (like the artifact-authority reference above): `bootstrap()`
  // opens it, the row teardown closes it (the durable rows stay on the
  // medium; only this handle is released).
  // The row-scope BRIDGE the host provides under
  // TEAM_ARTIFACT_AUTHORITY_SERVICE (module docs for the visibility and
  // lifetime contract): the Team-aware spill provider row (the
  // `dsh-agent-team/spill-local` replacement in the bundle layer) reads
  // the authority lazily on every saveText. Provided SYNCHRONOUSLY (next
  // to the teamRoot facade, before the first await); the bootstrap fills
  // `.authority` once it has constructed + rebuilt it. A consumer that
  // observes a bridge WITHOUT an authority (bootstrap still running or
  // failed) treats every session as UNMANAGED — the upstream-equivalent
  // path, never a crash.
  const artifactAuthorityBridge: TeamArtifactAuthorityBridge = { authority: undefined }

  /**
   * Remote-mount-race observability (root cause C): every TERMINAL remote
   * mount outcome is logged to the host process's stderr. The Cordis
   * logger absorbs the row's apply fiber (the harness never sees a mount
   * outcome), and no production consumer reads the facade's `remote`
   * state — an outcome that is only recorded is invisible to the operator
   * (the user-world 405 was diagnosed from the ABSENCE of evidence).
   * `pending` is not terminal and is never logged on entry.
   */
  function logRemoteMountOutcome(state: RemoteMountState, waitedMs: number): void {
    switch (state.state) {
      case 'mounted':
        console.error(
          waitedMs > 0
            ? `[dsh-agent-team] remote mount: MOUNTED channel=${state.channel} (late, after ${waitedMs}ms — the connection service appeared after the mount step)`
            : `[dsh-agent-team] remote mount: MOUNTED channel=${state.channel}`,
        )
        break
      case 'skipped':
        console.error(`[dsh-agent-team] remote mount: SKIPPED — ${state.reason}`)
        break
      case 'failed':
        console.error(`[dsh-agent-team] remote mount: FAILED — ${state.reason}`)
        break
      case 'pending':
        break
    }
  }

  /**
   * Mount the remote surface NOW: register the Remote contract v1
   * dispatcher onto the EXACT connection service object (identity — the
   * same assertion the T12-M4 test makes) and record `mounted`. At the
   * mount step (allowFailure=false) a registration failure (the channel
   * is already owned) REJECTS the bootstrap — fail closed; inside the
   * wait window (allowFailure=true) it records a `failed` outcome — the
   * bootstrap has already settled, so the late failure is recorded and
   * logged, never thrown.
   * @param root - the built production root (owns the registration seam).
   * @param connection - the EXACT service object the seam registers onto.
   * @param allowFailure - record registration failures instead of throwing.
   * @returns the terminal outcome state recorded on the facade.
   */
  function mountRemoteNow(
    root: TeamProductionRoot,
    connection: ConnectionLike,
    allowFailure: boolean,
  ): RemoteMountState {
    // The production root installs the registration seam during its
    // construction (A31); current() throws the seam's stable
    // not-installed code if that ever regresses (propagated as-is).
    const registerRemote = root.seams.remoteHandlerRegistration.current()
    let registration: RemoteRegistration
    try {
      // F1 scope window: the `webServer` compatibility seam (the
      // `internal/get` listener above) serves ONLY the property read(s)
      // of this registration call — the `connection.rpc.handle` body
      // performs its `owner.webServer.register(route)` walk
      // synchronously inside (the 0.1.5 connection service runs its
      // `owner.effect(...)` body in the same tick). Any other row's
      // `webServer` read — before, after, or from another plugin's own
      // `rpc.handle` — falls through to the built-in walk verbatim.
      teamRemoteMountInFlight = true
      try {
        registration = registerRemote(connection)
      } finally {
        teamRemoteMountInFlight = false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const detail = `the remote handler registration onto channel ${REMOTE_RPC_CHANNEL} failed (one owner per channel): ${message}`
      if (!allowFailure) {
        throw new TeamPluginError(
          TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SEAM_ALREADY_INSTALLED,
          detail,
        )
      }
      const failed: RemoteMountState = { state: 'failed', reason: detail }
      remoteMountState = failed
      return failed
    }
    remoteRegistration = registration
    const mounted: RemoteMountState = { state: 'mounted', channel: registration.channel }
    remoteMountState = mounted
    return mounted
  }

  /**
   * The bounded wait for the connection service (remote-mount-race fix,
   * root cause A). Armed only when the service is ABSENT at the mount
   * step and `remoteMountWaitMs > 0` (0 = the legacy immediate decision,
   * no wait). Polls every REMOTE_MOUNT_POLL_MS: the service APPEARING
   * mounts late through the same registration path; a MALFORMED late
   * appearance records a logged `failed`; the window EXPIRING records a
   * logged terminal `skipped`. The watch runs as a second row effect:
   * row stop clears the timers and settles a terminal `skipped` if the
   * row stops while still pending (no dangling `pending` on the facade).
   * The registration's disposal stays with the row-stop backstop (single
   * disposer; `RemoteRegistration.dispose` is idempotent).
   */
  function armRemoteMountWatcher(root: TeamProductionRoot, waitMs: number): void {
    const startedAt = Date.now()
    let settled = false
    // Const holder: the timers are created AFTER `settle` is defined
    // (closure order) but each is written exactly once.
    const timers: {
      poll?: ReturnType<typeof setInterval>
      deadline?: ReturnType<typeof setTimeout>
    } = {}

    const settle = (outcome: RemoteMountState): void => {
      if (settled) return
      settled = true
      if (timers.poll !== undefined) clearInterval(timers.poll)
      if (timers.deadline !== undefined) clearTimeout(timers.deadline)
      remoteMountState = outcome
      logRemoteMountOutcome(outcome, Date.now() - startedAt)
    }

    timers.poll = setInterval(() => {
      if (settled) return
      const candidate = ctx.get('connection') as ConnectionLike | null | undefined
      if (candidate === undefined || candidate === null) return
      if (
        typeof candidate !== 'object' ||
        typeof candidate.rpc !== 'object' ||
        candidate.rpc === null ||
        typeof candidate.rpc.handle !== 'function'
      ) {
        settle({
          state: 'failed',
          reason: 'the "connection" public service appeared malformed: expected connection.rpc.handle to be a function',
        })
        return
      }
      // A late appearance mounts late (a registration failure records a
      // logged `failed` — recorded, not thrown: the bootstrap has settled).
      settle(mountRemoteNow(root, candidate, true))
    }, REMOTE_MOUNT_POLL_MS)

    timers.deadline = setTimeout(() => {
      settle({
        state: 'skipped',
        reason: `the "connection" public service was absent at the mount step and did not appear within ${waitMs}ms (headless host, or the web connection service was not provided in time)`,
      })
    }, waitMs)

    // Never keep the process alive on the watch timers (unit-test worlds
    // and short-lived hosts exit cleanly; the production host lives on
    // its own server handles).
    ;(timers.poll as unknown as { unref?: () => void }).unref?.()
    ;(timers.deadline as unknown as { unref?: () => void }).unref?.()

    ctx.effect(
      () => () => {
        if (timers.poll !== undefined) clearInterval(timers.poll)
        if (timers.deadline !== undefined) clearTimeout(timers.deadline)
        if (!settled) {
          settle({
            state: 'skipped',
            reason: 'the row stopped before the "connection" public service appeared',
          })
        }
      },
      'dsh-agent-team remote mount watcher',
    )
  }

  async function bootstrap(): Promise<TeamProductionRoot> {
    // A broken row must not arm the upstream resolution hook: validate the
    // row config first, then register the resolver exactly once per process.
    const validatedConfig = validateTeamPluginConfig(config)
    // D9: the launch-directory default workspace (explicit config wins).
    const rowConfig = withDefaultWorkspace(validatedConfig, process.cwd())
    registerUpstreamResolverOnce()

    const agents = ctx.get('agents')
    if (agents === undefined || agents === null) {
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
        'the "agents" public service is absent from the plugin context',
      )
    }

    // M2 (plan §15.5): the hard-injected public workspace service. The
    // hard `inject` declaration parks the row in a real composition until
    // the web profile's workspace row provides it; the code-level check
    // fails closed with the stable code for every non-Loader world (unit
    // test worlds, overlays) and for a MALFORMED provider — before any
    // durable effect (the domain has not been opened yet). The closure is
    // the narrow WorkspaceAttachPort the production root exposes (S6 v2
    // create: resolve the registered workspace by path; attach the
    // materialized root session — attach idempotency is delegated to the
    // upstream Workspace.attachSession contract, never re-implemented).
    const workspaceAttach = createWorkspaceAttach(
      assertWorkspaceRegistryLike(ctx.get('workspaceRegistry')),
    )

  // --- the storage seam: injected service, or the real seam over the --------
  // --- DSH public storageDomain (the row-owned seamUrl module, or its -------
  // --- location-derived default) ---------------------------------------------
  let seam: StorageDomainSeam | undefined = ctx.get('teamStorageSeam') as
    | StorageDomainSeam
    | undefined
  if (seam === undefined || seam === null) {
    // Explicit config wins; otherwise the default seam module is derived
    // from this entry's own location (fail-closed when unresolvable).
    const seamUrl = rowConfig.seamUrl ?? resolveDefaultSeamUrl(import.meta.url)
    const storageDomain = ctx.get('storageDomain')
    if (storageDomain === undefined || storageDomain === null) {
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
        'the "storageDomain" public service is absent (required to build the seam from seamUrl)',
      )
    }
    const seamModule = (await import(seamUrl)) as {
      createRealStorageDomainSeam?: (storageDomain: unknown) => StorageDomainSeam
    }
    if (typeof seamModule.createRealStorageDomainSeam !== 'function') {
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_GLUE_UNAVAILABLE,
        'the seamUrl module does not export createRealStorageDomainSeam',
      )
    }
    seam = seamModule.createRealStorageDomainSeam(storageDomain)
  }

  // --- the durable authority (A02): create stamps, open reopens ------------
  // `create` = the STRICT fresh-world entry (harness/boot-world semantics:
  // an already-stamped domain is a loud TEAM_DOMAIN_EXISTS failure — a
  // boot world must never silently adopt a pre-existing domain). `resume`
  // = the STRICT load-only entry (openTeamDomain: plan §7-B2 — a resume
  // loads the existing Team identity, it never mints one; a fresh medium
  // is a loud SCHEMA_STAMP_MISSING failure). `create-or-open` = the
  // RESTART-SAFE production entry (remote-mount-race fix, root cause B):
  // adopt a stamped domain, or initialize a fresh medium with the full
  // eight-store stamp; a partial create is diagnosed exactly as
  // openTeamDomain diagnoses it (never papered over). The pre-fix choices
  // covered neither production case: the bundle shipped `create`, whose
  // TEAM_DOMAIN_EXISTS on every returning home was swallowed by the
  // bootstrap (zero terminal signal: the user-world 405), and pre-fix
  // `resume` broke first-ever boots (SCHEMA_STAMP_MISSING on a fresh
  // medium) — hence the new phase for the bundle row.
  // The row-level `create-or-open` is RESOLVED here, after the domain
  // decision, to the exact two-value phase the durable world carries: a
  // fresh medium was just created → the root MINTS the Team identity
  // (`create`); a stamped medium WITH its durable Team identity was
  // adopted → the root LOADS it (`resume`); a stamped medium WITHOUT the
  // identity (crashed between the stamp and the mint, or a pre-fix first
  // boot that stamped and died) → the stamps are adopted and the missing
  // identity MINTED (D-1 self-heal, `create` — the root create is
  // idempotent, never re-mints). The root and the live glue keep their
  // strict two-value contract unchanged.
  let domain: TeamDomain
  let resolvedPhase: 'create' | 'resume'
  if (rowConfig.bootPhase === 'create') {
    domain = await createTeamDomain(seam)
    resolvedPhase = 'create'
  } else if (rowConfig.bootPhase === 'resume') {
    domain = await openTeamDomain(seam)
    resolvedPhase = 'resume'
  } else {
    const outcome = await createOrOpenTeamDomainDetailed(seam)
    domain = outcome.domain
    if (outcome.created) {
      resolvedPhase = 'create'
    } else if (domain.repositories.teamSessions.get(rowConfig.rootSessionId) !== undefined) {
      resolvedPhase = 'resume'
    } else {
      // D-1 (user real-machine state, R138): a STAMPED domain without the
      // Team identity — a crash between the stamp commit and the
      // identity-mint commit, or a pre-fix first boot that stamped and
      // died before minting. Adopt the stamps (never re-stamp) and MINT
      // the missing identity: the root's create phase is idempotent
      // (existing-record verification, never re-mints), so a stamped-empty
      // home converges to the canonical shape instead of failing closed
      // with TEAM_PLUGIN_RESUME_STATE_MISSING on every boot. The strict
      // `resume` entry stays load-only (T12-B2 W4) — only create-or-open
      // self-heals this state.
      resolvedPhase = 'create'
    }
  }
  const resolvedRowConfig: TeamPluginConfig =
    resolvedPhase === rowConfig.bootPhase ? rowConfig : { ...rowConfig, bootPhase: resolvedPhase }
  openDomain = domain

  // pre-alpha3 W2-A (review fix F1, guide §2.3): the live runtime substrate
  // plan thunk (the row preset ids + the production persona observer over
  // the DSH public agentPresets seam — the F14 closed seam, NO
  // CORE_SEAM_BLOCKER). The `deploymentDefaultPresetId` is read LAZILY per
  // call from the live service's `defaultId` getter (a service-absent
  // composition without an explicit row preset id then fails closed
  // through the resolver's typed MALFORMED_DTO — no silent default).
  // A SETTLED plan (root + member both observed) is memoized for the boot
  // (the preset composition is stable for the row's lifetime — the same
  // stability the glue's per-root persona-slot cache assumes); an
  // UNRESOLVED plan is NOT cached — a later call RE-PROBES (a transient
  // service failure must not permanently fail the persona bind within the
  // boot; the guide's fail-closed + re-probe contract).
  let settledSubstratePlan: Promise<RuntimeSubstratePlan> | undefined
  const resolveSubstratePlan = async (): Promise<RuntimeSubstratePlan> => {
    if (settledSubstratePlan !== undefined) return settledSubstratePlan
    const svc = ctx.get('agentPresets') as { readonly defaultId?: string } | null | undefined
    // pre-alpha3 W3-A (review fix F1) regression fix — the service-absent
    // fallback for the deployment default preset id. The W2-A F14 contract
    // is: read the default LAZILY from the live service's `defaultId` getter
    // (real production). A service-absent world (a test-world host entry that
    // does not provide the DSH `agentPresets` public service) falls back to
    // the SHIPPED-STATE deployment default (the base pre-W3-A substrate)
    // instead of failing closed with "no root preset authority" — the same
    // fallback the base `resolveRuntimeSubstrate` call used. Real production
    // (service present, a `defaultId`) keeps the live value, byte-for-byte.
    const deploymentDefaultPresetId =
      svc !== undefined && svc !== null && typeof svc.defaultId === 'string' && svc.defaultId !== ''
        ? svc.defaultId
        : SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: resolvedRowConfig.rootPresetId,
      memberPresetId: resolvedRowConfig.memberPresetId,
      deploymentDefaultPresetId,
      observePersonaKind: (presetId: string) => personaObserver.observe(presetId),
    })
    if (plan.root.persona.kind !== 'unresolved' && plan.member.persona.kind !== 'unresolved') {
      settledSubstratePlan = Promise.resolve(plan)
    }
    return plan
  }

  // C1 (restart-recovery, guide §4.2): bind the fence's durable-ownership
  // resolver EARLY — right after the domain open (before the live glue
  // boot, and before any normal Team activation): the classification is
  // the ONE ownership authority (guide §3.2 — `resolveOwningTeamRoot`,
  // the same algorithm the glue's `teamRootOfSession` thin wrapper
  // calls), keyed on the RESOLVED row config (a `create-or-open` row
  // resolves its boot root to the stamped domain's TeamSession row).
  activationFence.bindOwnershipResolver(
    (sessionId) =>
      resolveOwningTeamRoot(domain, resolvedRowConfig.rootSessionId, sessionId),
  )

  // The glue reads the durable consumption resolvers off the domain
  // (attached here — the production root's mutation node exposes the same
  // pair, keeping ONE pair of resolvers process-wide).
  const domainFacade: TeamDomain & { readonly consumption: DomainConsumption } = {
    ...domain,
    consumption: {
      model: { resolveDurableModelSelection },
      capability: { resolveDurableMcpFacet },
    },
  }

  // --- the live-agent glue (plain JS, row-owned URL or the location-derived -
  // --- default; construction is side-effect free — every boot effect runs ---
  // --- inside live.boot()) ---------------------------------------------------
  const glueUrl = rowConfig.glueUrl ?? defaultGlueUrl(import.meta.url)
  let glue: GlueModule
  try {
    glue = (await import(glueUrl)) as GlueModule
  } catch (error) {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_GLUE_UNAVAILABLE,
      `the glue module (${glueUrl}) could not be loaded: ${String(error)}`,
    )
  }
  if (typeof glue.createAgentBindings !== 'function') {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_GLUE_UNAVAILABLE,
      'the glue module does not export createAgentBindings',
    )
  }
  const teamToolsRef: { current: TeamToolSet | undefined } = { current: undefined }
  // A6 (alpha.2 plan §11): the shared control-service reference (the
  // teamToolsRef pattern) — created here, passed to BOTH the glue (which
  // reads it lazily in agentSetup) and the root (which fills it during
  // construction right after the control service is built). The entry
  // calls boot() only after the root construction, so every agentSetup
  // sees a constructed control service.
  const controlServiceRef: { current: ControlService | undefined } = { current: undefined }
  // --- BP3/BP4 (issue #2 blueprint-loading, plan §7/§8): the live blueprint
  // --- authority. The production host is the SOLE authority-builder: the
  // --- stateless saved-source index over `config.blueprintDir` (absent =
  // --- the filesystem catalog disabled — the legacy inline-bootstrap-only
  // --- behavior), the live authority over the FROZEN registry rows + the
  // --- saved sources + the row anchor (the one strong parse), and the
  // --- live catalog facade the root consumes. Factory worlds (no host
  // --- entry) pass neither and keep the legacy static single-blueprint
  // --- catalog + the no-freeze behavior (the root's optional params).
  const blueprintSourceIndex = createBlueprintSourceIndex({
    blueprintDir: resolvedRowConfig.blueprintDir,
  })
  const blueprintAuthority = createBlueprintAuthority({
    bootstrapSource: resolvedRowConfig.blueprintSource,
    sourceIndex: blueprintSourceIndex,
    registry: domain.repositories.blueprintRegistry,
  })
  const liveBlueprintCatalog = createLiveBlueprintCatalog(blueprintAuthority)
  // --- BP-F (issue #2 blueprint-loading, plan §11.1): the narrow per-Team
  // --- resolver the live glue consumes — the SAME three-case production
  // --- contract the Governance closed-set dep resolves against (see the
  // --- module contract in bound-blueprint.ts): missing row → throw (fail
  // --- closed, a programming error the glue must never reach — the setup
  // --- rejection rolls the unpublished agent back); a no-ref pre-repair
  // --- legacy row → the row anchor BY DEFINITION (the documented legacy
  // --- binding — legacy rows predate per-team binding, so the anchor IS
  // --- their bound blueprint, not a fallback); a bound ref → the live
  // --- authority's resolveSnapshot (the hash equality is verified; a
  // --- frozen revision replays the registry row's stored source text, a
  // --- mutable snapshot re-parses the current source) — and the anchor is
  // --- NEVER consulted for a bound ref (the B1 boot-fallback hole is
  // --- closed by this single production resolver).
  const resolveBoundBlueprint = createBoundBlueprintResolver({
    teamSessions: domain.repositories.teamSessions,
    resolveSnapshot: (ref) => blueprintAuthority.resolveSnapshot(ref),
    anchorBlueprintSource: resolvedRowConfig.blueprintSource,
  })

  // pre-alpha3 PR-B (plan §B.2): the production PolicyReader reference
  // (the controlServiceRef pattern). The GLUE is built BEFORE the
  // production root (the root's `live` surface is a glue dependency), so
  // the ref is created here and filled with `builtRoot.policyReader`
  // right after `createTeamProductionRoot` returns (BELOW). The glue
  // reads it lazily in `resolveConsumptionViews` — by the time any agent
  // boundary resolves, the ref is filled; a world without the ref (test
  // compositions) keeps the pre-PR-B legacy input.
  const policyReaderRef: { current: unknown } = { current: null }

  // pre-alpha3 PR4 — the shared permission-plane reference (the exact
  // `controlServiceRef` / `artifactAuthorityRef` precedent): a construction-
  // time object the ROOT fills during its construction; the live glue reads
  // `.current` at agent setup and wires the pre-execute decision seam.
  const permissionPlaneRef: { current: TeamPermissionPlane | undefined } = {
    current: undefined,
  }
  // pre-alpha3 PR4 — the containment predicate over two canonical keys of the
  // SAME provider: the pinned public `FileSystem.contains`, resolved per call
  // through the row's strict `ctx.get('fs')` accessor (the `fsBackend`
  // rationale above — never a captured service). The canonical keys ARE the
  // provider's own `FsTarget.targetKey` strings (the glue's `resolveTarget`
  // unbrands exactly that), so the predicate hands the SAME values the
  // handles carry to the ONE legal containment authority — no key parsing, no
  // `startsWith`, no consumer-side path arithmetic, no cache (plan §9.4 /
  // H4). A composition without the service, or a provider without the public
  // `contains`, THROWS: the plane maps that to the kernel's typed
  // `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` (unknown coverage is never a
  // verdict), never to a silent `false`.
  const fsContainsKeys: CanonicalKeyContains = (parentKey, childKey) => {
    const backend = fsBackend()
    if (typeof backend.contains !== 'function') {
      throw new Error(
        'the fs provider does not expose a public contains() seam (the subtree containment is undeterminable)',
      )
    }
    return backend.contains({ targetKey: parentKey }, { targetKey: childKey }) === true
  }
  // pre-alpha3 PR4 (round 3, BLOCK-0 + BLOCK-5) — the durable permission
  // authority is MANDATORY at the production entry. Its repository RIDES
  // the ONE legal handle of this row's TeamDomain (`domain.repositories.
  // permissionOverlays`): the upstream facility enforces
  // single-open-per-domain-name, so the pre-fix shape (a SECOND
  // `openPermissionOverlayStore(seam)` while the domain handle was live)
  // ALWAYS failed with `already-open`, the catch downgraded it to a warn,
  // and the row booted with no overlay port at all — mutations refusing
  // while execution ran on static rules alone: the fail-open this closes.
  // The boot now PROVES the authority answers: one read-only probe, and any
  // fault is a typed startup failure — never a warn-only half-state. The
  // handle's release stays the facade's single `close()` (no second close).
  const permissionOverlay: PermissionOverlayRepositoryPort = createPermissionOverlayRepositoryPort({
    repository: domain.repositories.permissionOverlays,
  })
  try {
    // The repository is LAZY (table access per call): without this eager
    // probe the first touch of a broken store would be a runtime decision
    // AFTER the world shipped. An absent snapshot is a fine answer; a
    // faulting store is not.
    await permissionOverlay.latest({
      teamSessionId: rowConfig.rootSessionId,
      memberInstanceId: LEADER_INSTANCE_ID,
    })
  } catch (error: unknown) {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_PERMISSION_AUTHORITY_UNAVAILABLE,
      `the durable permission authority of this row could not be read (${
        error instanceof Error ? error.message : String(error)
      }) — the production entry treats it as MANDATORY: booting past this would run every bound permission decision without the durable overlay while mutations refuse, which is exactly the fail-open this entry refuses to ship`,
    )
  }
  // pre-alpha3 PR4 (round 4) — the ADDRESSED-TEAM authority facts (the §6
  // expansion ceiling from the bound Blueprint's explicit
  // `permissionMutationEnvelope` carrier + the per-member static layers).
  // Round 3 built these ONCE from the ROW ANCHOR with a frozen identity and a
  // row-wide-constant envelope — external review showed (BLOCK-2) two teams
  // minted from the same blueprint/template made team B's member evaluated
  // under team A's authority, and (BLOCK-3) canonicalizing at the row's
  // defaultWorkspace while the member RUNS at its own effective workspace let
  // relative rules mis-resolve, laundering an expansion past the envelope.
  // Round 4 reads every document THROUGH `resolveBoundBlueprint(teamSessionId)`
  // — the SAME three-case bound-Blueprint authority the team-root/member
  // identity binds to — canonicalizes at the TARGET member's effective
  // workspace (durable `member.workspace ?? defaultWorkspace` — exactly the
  // glue's `memberCwd` doctrine, so facts, envelope, overlay and the decision
  // plane share ONE canonical key space per member), and re-validates the
  // binding tuple across each canonicalization await (drift → abstain). The
  // fs provider is consulted only for rules that actually exist (a world
  // without `capabilities.permissions` performs ZERO fs calls); failures are
  // never cached, so the next read retries (bounded recovery).
  // PR4 ROUND 5 (FIX-2a): the ONE server-side canonicalizer over the row's
  // fs provider — shared by the authority facts and the Leader permission
  // grant/revoke tool (client-supplied paths are NEVER authorization
  // input; every file matcher canonicalizes here, at the TARGET basis).
  const permissionCanonicalize = async (path: string, cwd: string): Promise<string> => {
    const resolved = (await fsBackend().resolve(path, { cwd })) as
      | { targetKey?: unknown }
      | null
      | undefined
    const key = resolved?.targetKey
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error(
        `permission authority facts: the fs provider returned no canonical key for ${JSON.stringify(path)}`,
      )
    }
    return key
  }

  const permissionFacts = createPermissionAuthorityFacts({
    resolveBlueprint: (teamSessionId) => {
      try {
        return resolveBoundBlueprint(teamSessionId)
      } catch {
        // No durable row / unresolvable bound ref: UNKNOWN facts (typed
        // refusal downstream), never a fall-back to the row anchor.
        return undefined
      }
    },
    memberTemplateId: (teamSessionId, memberInstanceId) =>
      domain.repositories.memberInstances
        .get(teamSessionId as never, memberInstanceId as never)
        ?.templateId as string | undefined,
    memberWorkspace: (teamSessionId, memberInstanceId) => {
      const workspace = domain.repositories.memberInstances.get(
        teamSessionId as never,
        memberInstanceId as never,
      )?.workspace as string | undefined
      // The member's EFFECTIVE workspace — the durable row's own
      // `workspace`, falling back to the ADDRESSED team's durable default
      // (the TeamSession row), exactly as the live glue computes
      // `effectiveRootWorkspace`/`memberCwd` (agent-bindings). ROUND 5
      // (FIX-3, parent ruling): the fallback is the DURABLE row of the
      // ADDRESSED teamSessionId — NEVER `resolvedRowConfig.defaultWorkspace`
      // (that is the ACTING boot row's tail; with two teams over one host
      // row a Team-B leader/member would canonicalize under Team A's
      // workspace). The leader position has no member row and takes the
      // same durable team default; NO durable row for the addressed team →
      // `undefined` = UNKNOWN (consistent with the bound-blueprint abstain).
      if (typeof workspace === 'string' && workspace !== '') return workspace
      const teamDefault = domain.repositories.teamSessions.get(
        teamSessionId as never,
      )?.defaultWorkspace as string | undefined
      return typeof teamDefault === 'string' && teamDefault !== '' ? teamDefault : undefined
    },
    canonicalize: permissionCanonicalize,
    bootWarmTargets: () => [
      // The boot team's leader position (member documents warm lazily on
      // their first addressed read — every build is a re-validated build).
      { teamSessionId: rowConfig.rootSessionId, memberInstanceId: LEADER_INSTANCE_ID },
    ],
  })
  // A4-PR6 §6.A — the governance-warning service (Ruling PR6-H: THIN —
  // no new bound-Blueprint resolution, no new canonicalizer, no member
  // addressing). The gate's question is TEAM-level: the Leader expansion
  // envelope vs the Human User hard envelope, both read through
  // `permissionFacts` at the LEADER position (whose canonicalization basis
  // is the ADDRESSED team's durable default workspace — the FIX-3 law),
  // which structurally excludes placeholder/actor identities from the gate.
  const governanceWarningEnvelopeView = (
    document: { readonly rules: readonly {
      readonly operationClass: string
      readonly matcher: { readonly kind: 'exact' | 'subtree' | 'fingerprint'; readonly resource: string }
      readonly maximumEffect: 'deny' | 'ask' | 'allow'
    }[] },
  ): GovernanceEnvelopeView => ({
    rules: document.rules.map((rule) => ({
      operationClass: rule.operationClass,
      effect: rule.maximumEffect,
      matcherKind: rule.matcher.kind,
      matcherKey: rule.matcher.resource,
    })),
  })
  // The funnel clock as a NAME: the durable funnel's call shape is
  // `(repositories, root, now, FACT-TYPE-LITERAL, payload)` — the fact-type
  // literal at position 4 is what `a4pr0a` derives statically, and the
  // clock slot stays a bare identifier exactly like every other funnel
  // call site in the repo (the guard's arg scanner reads that shape).
  const governanceWarningNow = () => new Date().toISOString()
  const governanceWarningService = createGovernanceWarningService({
    writer: {
      // The fact-type LITERALS ride the funnel call site ON PURPOSE (the
      // a4pr0a closed-set guard derives them statically — a variable-typed
      // `commitDurableFact` call would be an unresolved dynamic writer).
      // Both types join the fact-hygiene triad (host map + client map +
      // INTERNAL_FACT_TYPES) in the same commit.
      writeObserved: (rootSessionId, payload) =>
        commitDurableFact(
          domain.repositories,
          rootSessionId,
          governanceWarningNow,
          'governance-warning-observed',
          payload,
        ).then(() => undefined),
      writeAcknowledged: (rootSessionId, payload) =>
        commitDurableFact(
          domain.repositories,
          rootSessionId,
          governanceWarningNow,
          'governance-warning-acknowledged',
          payload,
        ).then(() => undefined),
    },
    reader: {
      // FILTER, never re-shape: `LedgerEntry` already carries the port's
      // fields structurally. A read lane must not mint write-vocabulary
      // label shapes — the a4pr0a static guard reads any such label in a
      // writer file as a durable write site (the scanner is on purpose
      // text-based, so even comments carrying the label token confuse it;
      // the discipline serves the guard, not the other way round).
      list: (rootSessionId, factTypes) =>
        Promise.resolve(
          domain.repositories.ledger
            .list()
            .filter(
              (row) =>
                row.rootSessionId === rootSessionId &&
                (factTypes as readonly string[]).includes(row.factType),
            ),
        ),
    },
    docs: {
      async read(teamSessionId) {
        const schemaVersion = permissionFacts.blueprintSchemaVersion(teamSessionId)
        if (schemaVersion === undefined) return { stage: 'unreadable' }
        if (schemaVersion !== 3) return { stage: 'pre-v3', schemaVersion }
        const hard = await permissionFacts.teamHardEnvelope(teamSessionId, LEADER_INSTANCE_ID)
        if (hard.status === 'unavailable') return { stage: 'unreadable' }
        const contentHash = permissionFacts.blueprintContentHash(teamSessionId)
        if (contentHash === undefined) return { stage: 'unreadable' }
        const leader = await permissionFacts.permissionEnvelope(teamSessionId, LEADER_INSTANCE_ID)
        return {
          stage: 'v3',
          hardStatus: hard.status === 'declared' ? 'declared' : 'absent',
          blueprintContentHash: contentHash,
          leader: governanceWarningEnvelopeView(leader),
          hard:
            hard.status === 'declared'
              ? governanceWarningEnvelopeView(hard.document)
              : { rules: [] },
        }
      },
    },
    contains: fsContainsKeys,
    now: governanceWarningNow,
  })

  // Loud-log only: the boot anchor's declared permissions-bearing templates.
  // (NOT an authority source — the round-4 readers resolve per addressed
  // team; this stays for the operator-facing startup line.)
  const factsAnchorBlueprint = parseBlueprint(resolvedRowConfig.blueprintSource)
  const permissionsBearingTemplates = [factsAnchorBlueprint.leader, ...factsAnchorBlueprint.members]
    .filter((template) => template.capabilities?.permissions !== undefined)
    .map((template) => template.templateId as string)

  const live: TeamAgentBindings = glue.createAgentBindings({
    agents,
    sessionPersistence,
    domain: domainFacade,
    config: resolvedRowConfig,
    teamToolsRef,
    controlServiceRef,
    now: () => new Date().toISOString(),
    // BP-F (issue #2 blueprint-loading, plan §11.1): the per-Team bound-
    // blueprint resolver (the glue's dynamic Team authority — the three-
    // case contract in bound-blueprint.ts: a bound ref resolves through
    // the live authority and NEVER the row anchor; a no-ref pre-repair
    // legacy row resolves to the row anchor BY DEFINITION — the documented
    // legacy binding, not a fallback).
    resolveBoundBlueprint,
    subagents: ctx.get('subagents'),
    // D1 (v2): the LAZY agentPresets accessor (the sessionPersistence
    // wrapper pattern — resolved per member mount, fail-closed when the
    // service is absent). Additive optional dep: never in the hard inject
    // array (see the accessor's rationale).
    agentPresets,
    // alpha.2 (A6 live fix V1-1): the LAZY per-agent fs seam accessor (the
    // strict ctx.get('fs') global-store read — see the accessor's
    // rationale). Additive optional dep: never in the hard inject array.
    fsBackend,
    // strict-read + core-spill (Phase D/E): the shared artifact-authority
    // reference (filled by the bootstrap after the authority is
    // constructed + rebuilt — see the ref's rationale). Additive optional
    // dep: never in the hard inject array.
    artifactAuthorityRef,
    // pre-alpha3 PR4: the shared permission-plane reference (the root fills
    // it during construction; the glue wires the pre-execute decision seam
    // from it per agent). Additive optional dep: never in the hard inject
    // array.
    permissionPlaneRef,
    // C1 (restart-recovery, guide §4.3): the Team session-activation fence
    // — the production host MUST pass it (the glue wraps every Team
    // create/resume in runOwned and performs the bounded writer-conflict
    // recovery in ensureLiveAgent). The fence instance is the SAME object
    // whose listeners were registered at the top of apply() (guide §4.1).
    activationFence,
    // pre-alpha3 PR-B (plan §B.2): the production PolicyReader reference
    // (filled with builtRoot.policyReader right after root construction
    // — the glue reads it lazily per boundary; see the ref's rationale).
    policyReaderRef,
    // pre-alpha3 PR-C §C.6/§C.7: the durable capability-runtime telemetry
    // hook — the glue emits the MCP mount transitions (mount-failed /
    // mount-restored) and the host durably records each as a
    // `capability-runtime-event` ledger fact (the compatibility category's
    // first production writer; the durableGeneration advances through
    // `ledger.put`). The kind is validated fail-closed (an unknown kind is a
    // glue bug); the write PROPAGATES a storage failure (the glue observes
    // it, never fails the member's MCP reconciliation).
    capabilityTelemetry: async (
      rootSessionId: string,
      event: {
        kind: string
        capabilityType: string
        capabilityName: string
        verdict: 'unknown' | 'reachable' | 'unreachable'
        source: string
        observedAt: string
        attempt?: number
        reason?: string
      },
    ): Promise<void> => {
      const capabilityEvent = createCapabilityRuntimeEvent({
        event: assertCapabilityRuntimeEventKind(event.kind, 'capabilityTelemetry.kind'),
        capabilityType: event.capabilityType,
        capabilityName: event.capabilityName,
        verdict: event.verdict,
        source: event.source,
        observedAt: event.observedAt,
        reason: event.reason,
        attempt: event.attempt,
      })
      await writeCapabilityRuntimeEvent(
        domain.repositories.ledger,
        rootSessionId,
        capabilityEvent,
        () => new Date().toISOString(),
      )
    },
    // pre-alpha3 W2-A (review fix F4, guide §5 B): the PRODUCTION persona-
    // substrate resolver — the REAL observed effective composition of the
    // owning root (the RuntimeSubstratePlan root entry, observed through
    // the production persona observer over the DSH public agentPresets
    // seam). The glue AWAITs it at persona-slot construction (cached per
    // root only on success; an `unresolved` substrate fails the bind
    // closed, and a later bind re-probes — NEVER the shipped-state
    // 'standard' guess, guide §5 B). The seam is keyed by the root session
    // id (Architecture §13.1 — members inherit the root substrate); the
    // row plan is row-global, so the id is provenance, not a plan axis.
    resolvePersonaSubstrate: async (_rootSessionId: string) => {
      const plan = await resolveSubstratePlan()
      const entry = plan.root
      return {
        presetId: entry.presetId,
        personaKind: entry.persona.kind,
        source: entry.persona.source,
        ...(entry.persona.reason !== undefined ? { reason: entry.persona.reason } : {}),
      }
    },
  })

  // --- pre-alpha3 W2-A (review fix F1, guide §2.3): the runtime --------------
  // --- requirement-facts authority — the production live-environment source --
  // --- for the RequirementAuthority (the #40 side; the #42 gate consumer     --
  // --- switching is W3-A and reads this surface off the root).               --
  //                                                                            --
  // The MCP readiness probe port reads the LIVE agent MCP state of the rows'  --
  // live sessions ONLY (guide §2.3: after a restart the readiness recovers to --
  // `unknown` and re-probes — the durable `capability-runtime-event` telemetry --
  // is NEVER read back as current readiness; the telemetry is the ledger,     --
  // the probe is the truth).                                                    --
  //                                                                            --
  // F15 (plan §5/§6/§7): fiber presence alone is NO LONGER `reachable` — the   --
  // upstream 0.1.7-rc.1 supervisor WITHDRAWS the server's tools when the       --
  // reconnect budget exhausts while the handle stays live ("disposal is the   --
  // only way back"). Each live session holding the fiber is therefore          --
  // classified by the glue's OPERATIONAL WITNESS — the boundary pull-probe     --
  // over the PUBLIC tool surface (`mcp__<serverName>__*`, plan §7 V1 authority; --
  // `tools/change` is never a classifier): a confirmed loss (fiber present +   --
  // previously tool-bearing + surface withdrawn + still policy-targeted)       --
  // retires the session's exhausted fiber (witness side effect, exactly once,  --
  // idempotent — the slot is stamped `failed`, so the NEXT probe reads the     --
  // mount failure) and reports `unreachable` + `confirmedLoss`. A witness      --
  // `unknown` (a zero-tool server — L3; an unreadable surface; a               --
  // plugin-initiated removal — an R4 policy deny) contributes NOTHING: a       --
  // fiber's mere presence never fabricates an `unreachable`, and an            --
  // unobservable capability is not a pending materialization (the settled      --
  // slot/view state is what decides in-flight; for a removal that is the      --
  // seed's truth — the observed F15 R4 shape). A pre-F15 glue without the      --
  // witness seam (the test worlds) keeps the legacy fiber-presence             --
  // classification.                                                            --
  //                                                                            --
  // PF-2 tri-state (2026-09-30, parent adjudication option A): the UNSETTLED  --
  // `unknown` carries its OBSERVATION STATE — the structural split of the     --
  // pre-observation world this probe reads:                                    --
  //   in-flight      a pending materialization state EXISTS on a live session  --
  //                  (a raw slot without a settled fiber whose view still      --
  //                  admits the server — settlement in progress, the B5        --
  //                  window; unapplied durable mcp records; or a template      --
  //                  grant that admits the server);                            --
  //   never-observed NO fiber / NO pending slot / NO failed slot on ANY live  --
  //                  session — the capability is STRUCTURALLY not-yet-        --
  //                  applicable (the canonical v1→v2 first-create shape: a    --
  //                  team-scope server materializes only at the leader        --
  //                  boundary of an EXISTING team — a zero-requirement v1     --
  //                  anchor mounts nothing) — OR the only materialization      --
  //                  state observed is a TERMINAL deny (a settled slot         --
  //                  without its fiber that the view no longer admits — an    --
  //                  intentional removal: a deny is not a failure, no remount  --
  //                  is pending — the seed's truth decides; F15 R4).          --
  // The state rides on the observation; the ONE shared classifier predicate   --
  // in the requirement-facts layer (pending.ts `isPendingWindow`) is the      --
  // single consumer — the probe, the creation preflight, the gate and the     --
  // activation step all inherit identical behavior: probe == gate (INV-9.4).  --
  // A session whose views cannot be resolved counts AS in-flight (fail-closed --
  // — the exemption is never inferred from doubt).                             --
  // Aggregation (both lines): a healthy live fiber on ANY session wins        --
  // (`reachable` — the server is up; a losing session's fiber is retired and  --
  // remounts after the 30 s cooldown); a confirmed loss on ALL live fibers is --
  // `unreachable` (the plugin-owned evidence code                            --
  // `MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN` as the observation provenance); an    --
  // observed mount failure (a `failed` materialization slot) stays            --
  // `unreachable`; nothing else settles — the unsettled verdict carries its   --
  // observation state above.                                                   --
  const capabilityReadiness: CapabilityReadinessProvider = createCapabilityReadinessProvider({
    probes: {
      mcpServer: {
        source: OBSERVATION_SOURCES.mcpFiber,
        probe: async (name: string) => {
          let mountFailed = false
          let anyReachable = false
          let confirmedLoss = false
          let inFlight = false
          for (const sessionId of live.listLiveSessions()) {
            const state = live.getConsumptionState(sessionId) as
              | {
                  readonly mcpFibers?: ReadonlyMap<string, unknown>
                  readonly mcpMaterialization?: ReadonlyMap<
                    string,
                    { readonly status: string }
                  >
                }
              | undefined
            if (state === undefined || state === null) continue
            if (state.mcpFibers !== undefined && state.mcpFibers.has(name)) {
              const witness =
                typeof live.observeMcpOperationalWitness === 'function'
                  ? await live.observeMcpOperationalWitness(sessionId, name)
                  : undefined
              if (witness === undefined) {
                // A pre-F15 glue (no witness seam — the test worlds): keep
                // the legacy fiber-presence classification (settled).
                return { verdict: PROBE_VERDICTS.reachable }
              }
              if (witness.verdict === 'reachable') {
                anyReachable = true
              } else if (witness.verdict === 'unreachable') {
                // A confirmed loss: the witness retires this session's
                // exhausted fiber as a side effect in the SAME owned step
                // (exactly once, idempotent — the slot is stamped `failed`,
                // so the next probe reads the mount failure).
                confirmedLoss = true
              }
              // `unknown`: the capability is UNOBSERVED on this session —
              // a zero-tool server (L3), an unreadable surface, or a
              // plugin-initiated removal (an R4 policy deny). A fiber's
              // mere presence never fabricates an `unreachable` (F15
              // §5.1-C rule 4), and an unobservable capability is not a
              // pending materialization — it contributes nothing (the
              // settled slot/view state is what decides in-flight; for a
              // removal that is the seed's truth).
              continue
            }
            const slot = state.mcpMaterialization?.get(name)
            if (slot !== undefined && slot.status === 'failed') {
              // An observed mount failure (a `failed` materialization slot)
              // settles `unreachable` — both lines agree.
              mountFailed = true
              continue
            }
            // No fiber, and no failed slot: the session's freshly re-resolved
            // consumption view decides the PENDING-MATERIALIZATION signal —
            // identically for (a) a raw slot without a settled fiber (a
            // settlement in progress — the B5 window) and (b) the no-slot
            // case (unapplied durable mcp records, or a template grant that
            // admits the server — the reconcile mounts it at the next
            // boundary; the SAME state the /__p6t6/state `pending`
            // projection shows): IN-FLIGHT.
            // A SETTLED slot without its fiber is in-flight ONLY while a
            // future materialization is actually pending (the view still
            // admits the server, or an ADMIT-kind record is queued for the
            // next boundary — an unapplied deny is a settled withdrawal,
            // see the pending-filter below). Once the view no longer admits the server
            // (allowed:false / the view absent — an INTENTIONAL REMOVAL,
            // F15 R4: the deny disposes the fiber, the slot stays `mounted`
            // — a deny is not a failure — and no remount is pending) there
            // is NO pending materialization state: the session contributes
            // nothing and the seed's truth decides (the observed F15 R4
            // shape: 'unknown probe → row-seed feeds available'). A session
            // whose view does NOT admit the server for any other reason also
            // contributes nothing (structurally not-applicable for it — the
            // cold-member / non-allowing-template guard, E.11 negative #1 /
            // guide §2.5.4).
            try {
              const views = live.resolveConsumptionViews(sessionId) as
                | {
                    readonly mcpViews?: Record<
                      string,
                      { readonly allowed?: boolean; readonly pendingNextBoundary?: unknown }
                    >
                  }
                | undefined
              const serverView =
                views !== undefined && views !== null ? views.mcpViews?.[name] : undefined
              const pendingRecords =
                serverView !== undefined && serverView !== null
                  ? serverView.pendingNextBoundary
                  : undefined
              // THE PENDING-MATERIALIZATION SIGNAL (Option A gate-fix,
              // parent adjudication 2026-09-30 — FOLDED-STOP R4): count
              // ADMIT-kind records ONLY. An unapplied durable ALLOW that
              // names this server (or the wildcard) is a materialization IN
              // PROGRESS — the E.12 B5 window (governance admitted the
              // mount; the reconcile runs at the next boundary): in-flight.
              // An unapplied DENY is NOT one: it is a removal already
              // durably applied at the boundary (a settled withdrawal —
              // F15 R4: "a deny is not a failure"; the seed's truth
              // decides, the observed F15 R4 shape 'unknown probe → row-
              // seed feeds available'). Liveness ((A)'s adjudication, cited
              // verbatim as the ruling's own consumer-audit clause):
              // "PENDING means IN-FLIGHT ONLY (… must never be a state
              // that only the blocked action itself can settle) … the seed
              // 2-state is the only liveness-correct behavior" — an
              // unapplied DENY in another cell of the same team settles
              // ONLY if the blocked action itself is admitted (that cell's
              // own request boundary runs), so it is precisely the excluded
              // shape. OBSERVED, never inferred: the live state of this
              // session (no fiber, no failed slot, view allowed:false)
              // contributes nothing; the durable deny is not a live
              // observation. SHARED CONTRACT (implemented in the PR-F F.4
               // A' follow-up): `recordAdmitsCapability`
               // (packages/runtime/mutation/cell-provenance.ts) is the
               // same ADMIT-kind reading — an ALLOW-kind entry naming at
               // least one value; a deny-kind entry is a settled
               // withdrawal, never a pending grant; key-presence alone
               // was never admission. This probe-side filter is the
               // PER-SERVER reading of that contract (it additionally
               // requires the admitted `items` to name THIS server or the
               // `'*'` wildcard); the read surface shares the KIND
               // reading.
              const pendingAdmits =
                Array.isArray(pendingRecords) &&
                pendingRecords.some((record) => {
                  const values =
                    record !== null && typeof record === 'object'
                      ? (record as { readonly values?: unknown }).values
                      : undefined
                  const mcp =
                    values !== null && typeof values === 'object'
                      ? (values as Record<string, unknown>)['mcp']
                      : undefined
                  if (
                    mcp === null ||
                    typeof mcp !== 'object' ||
                    (mcp as { readonly kind?: unknown }).kind !== 'allow'
                  ) {
                    return false
                  }
                  const items = (mcp as { readonly items?: unknown }).items
                  return (
                    Array.isArray(items) &&
                    (items.includes(name) || items.includes(MCP_FACET_WILDCARD))
                  )
                })
              if (
                (serverView !== undefined && serverView !== null && serverView.allowed === true) ||
                pendingAdmits
              ) {
                inFlight = true
              }
            } catch {
              // A view that cannot be resolved (a data fault, not a normal
              // state — the P1-B locate/bound-blueprint failure is loud):
              // the in-flight signal stands (fail-closed — the exemption is
              // never inferred from doubt).
              inFlight = true
            }
          }
          if (confirmedLoss && !anyReachable) {
            return {
              verdict: PROBE_VERDICTS.unreachable,
              reason: 'MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN',
            }
          }
          if (anyReachable) return { verdict: PROBE_VERDICTS.reachable }
          if (mountFailed) return { verdict: PROBE_VERDICTS.unreachable }
          // The unsettled verdict carries its observation state (the PF-2
          // tri-state — explicit for both states: the state is OBSERVED
          // here, the classifier predicate consumes it, never infers it).
          return inFlight
            ? { verdict: PROBE_VERDICTS.unknown, observationState: OBSERVATION_STATES.inFlight }
            : { verdict: PROBE_VERDICTS.unknown, observationState: OBSERVATION_STATES.neverObserved }
        },
      },
    },
    now: () => new Date().toISOString(),
  })
  // The member materialization view of one template/instance boundary (the
  // glue's EPHEMERAL live MCP state — the durable telemetry is never read
  // back). Finding F (scoped identity): the boundary names its OWNING team
  // root (`scope.rootSessionId` — the multi-root host shape: a production
  // host row hosts EVERY team root of the domain, the router resolves ANY
  // root in the domain; absent = the entry's boot root, the legacy
  // single-root contract, byte-identical) and, for the gate's target
  // read, its target INSTANCE (`scope.instanceId`).
  //
  // - TARGET read (instanceId present): the EXACT row's own view — a
  //   healthy sibling's slot must never stand in for the target's own
  //   mount state (the masking Finding F reports: the aggregate probe
  //   says `reachable` on a healthy fiber while the target's own mount
  //   is `failed`). No committed row → `undefined` (the cold /
  //   not-yet-created member: the axis derives `not-applicable`, which
  //   MUST NOT block, guide §2.3/§2.5.4).
  // - SCOPE read (instanceId absent): the CONSERVATIVE worst case over
  //   the owning root's committed rows of the template — any live
  //   instance's `failed` slot keeps the axis failed; only when EVERY
  //   live instance's slot is `mounted` does the axis read mounted; a
  //   mixed live set (an in-flight instance) OMITS the axis (the gate's
  //   scope exit treats the omission as unsatisfied — the scope has not
  //   converged). No committed rows → `undefined`; every committed row
  //   COLD → the cold view (`not-applicable` — the cold member MUST NOT
  //   block, guide §2.5.4).
  //
  // The session one row's fiber lives on: a v1 MEMBER row binds its
  // durable child Session; a v2 LEADER row (no childSessionId — the
  // Leader IS the Root Session itself, Architecture §9.2) lives on the
  // root session (the LEADER MOUNT AUTHORITY, Blocker-1 contract: the
  // root mounts config.rootPresetId — the leader's fiber is the root's
  // fiber).
  const memberMaterialization = (
    scope: RequirementFactScope,
  ): Promise<MemberMaterializationView | undefined> => {
    if (scope.kind !== 'template') return Promise.resolve(undefined)
    const owningRoot = scope.rootSessionId ?? resolvedRowConfig.rootSessionId
    const rows = domain.repositories.memberInstances
      .list(owningRoot)
      .filter((record) => record.templateId === scope.templateId)
    const sessionOf = (record: MemberInstanceRecordDto): string => {
      // A v2 LEADER row (the LeaderInstance record — no childSessionId;
      // the Leader IS the Root Session itself, Architecture §9.2) lives on
      // the root session (the LEADER MOUNT AUTHORITY, Blocker-1 contract:
      // the root mounts config.rootPresetId — the leader's fiber is the
      // root's fiber). The repository list's DECLARED v1 return carries
      // the unowned leader row (the documented type lie, contracts
      // member-instance-record), so the RUNTIME schemaVersion
      // discriminates; every v1 row (including a legacy harness-style
      // leader row that carries a childSessionId) keeps the child-session
      // resolution byte-identically.
      const raw = record as unknown as { readonly schemaVersion?: number }
      return raw.schemaVersion === 2
        ? String(record.rootSessionId)
        : String(record.childSessionId)
    }
    const livenessOf = (session: string): MemberLiveness =>
      live.hasLive(session)
        ? live.isResuming(session)
          ? MEMBER_LIVENESS.resuming
          : MEMBER_LIVENESS.resident
        : MEMBER_LIVENESS.cold
    const slotsOf = (session: string): Map<string, MaterializationSlot> => {
      const state = live.getConsumptionState(session) as
        | { readonly mcpMaterialization?: ReadonlyMap<string, MaterializationSlot> }
        | undefined
      const mcpSlots = new Map<string, MaterializationSlot>()
      if (state !== undefined && state !== null && state.mcpMaterialization !== undefined) {
        for (const [serverName, slot] of state.mcpMaterialization) {
          mcpSlots.set(serverName, slot)
        }
      }
      return mcpSlots
    }
    if (scope.instanceId !== undefined) {
      // THE TARGET's own boundary: the exact row (no first-match
      // conflation).
      const member = rows.find((record) => record.instanceId === scope.instanceId)
      if (member === undefined) return Promise.resolve(undefined)
      const session = sessionOf(member)
      return Promise.resolve({ liveness: livenessOf(session), mcpSlots: slotsOf(session) })
    }
    // THE CONSERVATIVE SCOPE VIEW (the template-only read).
    if (rows.length === 0) return Promise.resolve(undefined)
    const liveRows = rows.filter((record) => live.hasLive(sessionOf(record)))
    if (liveRows.length === 0) {
      return Promise.resolve({ liveness: MEMBER_LIVENESS.cold, mcpSlots: new Map() })
    }
    const liveLiveness: MemberLiveness = liveRows.some(
      (record) => !live.isResuming(sessionOf(record)),
    )
      ? MEMBER_LIVENESS.resident
      : MEMBER_LIVENESS.resuming
    // The per-row slot views (one consumption-state read per live row).
    // A RESUMING row's slot is the truth of a PREVIOUS attempt — its own
    // materialization derives `pending` (the resume re-runs the mount at
    // the next boundary), so only RESIDENT rows' slots are confirmed
    // boundary truth in the fold; a resuming row counts as in-flight.
    const residentRows = liveRows.filter((record) => !live.isResuming(sessionOf(record)))
    const residentSlots: ReadonlyMap<string, MaterializationSlot>[] = residentRows.map(
      (record) => slotsOf(sessionOf(record)),
    )
    // The servers any resident instance carries.
    const serverNames = new Set<string>()
    for (const rowSlots of residentSlots) {
      for (const serverName of rowSlots.keys()) serverNames.add(serverName)
    }
    // Per server: a RESIDENT row's `failed` slot wins (the failed slot of
    // the first failing live instance is retained — a confirmed boundary
    // failure the mask must not hide); `mounted` only when EVERY live
    // instance has converged (no resuming rows AND every resident row
    // carries a `mounted` slot for the server); a mixed set (an in-flight
    // instance — a resuming row or a resident row WITHOUT the slot) OMITS
    // the axis: the scope has not converged (the gate's scope exit
    // treats the omission as unsatisfied).
    const mcpSlots = new Map<string, MaterializationSlot>()
    for (const serverName of serverNames) {
      const rowSlots = residentSlots
        .map((row) => row.get(serverName))
        .filter((slot): slot is MaterializationSlot => slot !== undefined)
      const failedSlot = rowSlots.find((slot) => slot.status === 'failed')
      if (failedSlot !== undefined) {
        mcpSlots.set(serverName, failedSlot)
        continue
      }
      if (
        residentRows.length === liveRows.length &&
        rowSlots.length === residentRows.length &&
        rowSlots.every((slot) => slot.status === 'mounted')
      ) {
        const mountedSlot = rowSlots[0]
        if (mountedSlot !== undefined) mcpSlots.set(serverName, mountedSlot)
      }
      // else: an in-flight live instance — omit the axis.
    }
    return Promise.resolve({ liveness: liveLiveness, mcpSlots })
  }
  const requirementFactsAuthority = {
    provider: createRuntimeRequirementFactsProvider({
      // The MCP supply axis (guide §2.3): the row's configured MCP servers —
      // an UNCONFIGURED required MCP is `unreachable` by configuration
      // (a structural defect: recovery is reconfiguration, not a wait).
      configuredMcpServers: configuredMcpServers(resolvedRowConfig).map((server) => server.name),
      // The 3-state live readiness probe (fresh per resolution — the
      // restart `unknown` recovery is the port's contract, plan §C.10).
      readiness: capabilityReadiness,
      // The row `config.environmentFacts` — a BOOTSTRAP/STATIC SEED ONLY
      // (guide §2.3): it feeds the engine only for subjects whose live
      // verdict is `unknown` and never overrides a live verdict.
      seedFacts: resolvedRowConfig.environmentFacts,
      // The live runtime substrate plan (the persona domain — the
      // production observer, F14 closed seam).
      substratePlan: () => resolveSubstratePlan(),
      // The member materialization view (the template/instance boundary —
      // the glue's ephemeral live MCP state).
      memberMaterialization,
      now: () => new Date().toISOString(),
    }),
    readiness: capabilityReadiness,
    resolveSubstratePlan,
    observePersonaKind: (presetId: string) => personaObserver.observe(presetId),
  }

  // --- the frozen legacy reader (A29): layout-agnostic candidate search, --
  // --- production layout FIRST; the root never imports the legacy sources
  // --- in the production world. Candidate 1 (dist mirror depth) resolves
  // --- to the EXACT built mirror file the pre-candidate code computed
  // --- (five up from dist/.../src/plugin/host.js = <worktree>/
  // --- packages/runtime → dist/packages/legacy/session-reader/index.js);
  // --- candidate 2 (source depth) is reachable only under the unit-test
  // --- runner, where it resolves to the session-reader TS source location
  // --- (the runner's .js→.ts sibling hook loads the source module). The
  // --- specifiers are relative (not file URLs) so that hook rewrite
  // --- applies; resolved from the DIST depth, candidate 2 points at the
  // --- same built mirror file as candidate 1, so a corrupted-mirror
  // --- production run still fails closed on the same file.
  const legacyInspect = await loadLegacyInspect()

  // --- BP-G (issue #2 blueprint-loading, plan §12.2): the in-process
  // --- read-only boot readiness state — 'starting' from the mount step
  // --- (BELOW, before the awaited live boot) until the boot settles:
  // --- 'ready' on success, 'failed' on rejection (terminal: no automatic
  // --- retry, no re-boot — the plan's crash semantics: a failed boot is
  // --- a failed world; the route stays registered, the catalog reads
  // --- stay servable, every other remote method fails closed).
  let teamRuntimeReadiness: 'starting' | 'ready' | 'failed' = 'starting'

  // --- the production root (the SINGLE assembly point, A01–A29 + seams) -----
  const builtRoot: TeamProductionRoot = createTeamProductionRoot({
    config: resolvedRowConfig,
    domain: domainFacade,
    storageSeam: seam,
    live,
    now: () => new Date().toISOString(),
    teamToolsRef,
    // A6 (alpha.2 plan §11): the shared control-service reference — the
    // root fills `controlServiceRef.current` during construction (the same
    // object the glue reads lazily in agentSetup).
    controlServiceRef,
    // pre-alpha3 PR4 (plan PR4 "production entry wiring"): the durable
    // overlay port + the runtime containment predicate + the plane reference
    // the root fills.
    permissionOverlay,
    fsContainsKeys,
    permissionPlaneRef,
    // pre-alpha3 PR4 (round 3 BLOCK-1 + round 4 addressed-team binding,
    // round 5 ceiling REMOVAL): the authority fact readers (the root
    // forwards them VERBATIM into the pure governance lane). The envelope +
    // static facts resolve the ADDRESSED team's bound Blueprint and the
    // TARGET member's effective workspace. (Round 4's leader-ceiling reader
    // injection is REMOVED — ADR §6 carries no second policy gate.)
    permissionEnvelope: permissionFacts.permissionEnvelope,
    permissionStaticLayers: permissionFacts.staticLayers,
    // A4-PR2 lane C: the v3 authority-ceiling context reader (ADR A5-12). The v3 decision
    // itself is NOT made here — this line injects the reader that makes it, from the
    // SAME bound-Blueprint resolution every other permission fact is read through.
    permissionAuthorityCeiling: createAuthorityCeilingReader({ facts: permissionFacts }),
    // A4-PR6 §6.A — the ONE governance-warning port, forwarded verbatim to
    // the s6 start gate (root.ts adds zero logic; the service is assembled
    // above, next to the facts it reads through).
    governanceWarning: governanceWarningService,
    permissionCanonicalize,
    legacyInspect,
    // BP5 (issue #2 blueprint-loading, plan §9): the live catalog over the
    // saved sources + the frozen registry + this row's anchor (the legacy
    // static catalog is only the factory-world fallback in the root).
    blueprintCatalog: liveBlueprintCatalog,
    // BP6 (issue #2 blueprint-loading, plan §10): the freeze barrier —
    // every fresh TeamSession mint of this root freezes its snapshot first
    // (the real create boot + team.create v1/v2 through the bindFresh
    // wrapper, the handoff target pre-put, the fixture boot seed).
    // A2 (RC2 repair, plan §5.2): the SAME per-Team bound-blueprint
    // resolver the live glue consumes (constructed above) — the root's
    // binder persona source resolves through it, so the binder and the
    // agent setup share one snapshot authority (one resolver, no
    // duplicated resolution logic; the row anchor is no longer a bound
    // Team's runtime persona authority).
    resolveBoundBlueprint,
    blueprintAuthority,
    // P8-S7-R4 A28: the DSH public sessionQuery service, resolved lazily
    // at handoff use time (absent in this host entry → the handoff source
    // surface fails closed exactly as the S5A boot world does).
    getSessionQuery: () => ctx.get('sessionQuery'),
    // M2 (plan §15.5): the narrow workspace attach closure over the
    // hard-injected public workspaceRegistry (see the check above).
    workspaceAttach,
    // BP-G (issue #2 blueprint-loading, plan §12.2): the in-process boot
    // readiness — the mounted remote dispatcher gates the non-catalog
    // methods on it (the mount happens BEFORE the live boot is awaited).
    remoteReadiness: () => teamRuntimeReadiness,
    // pre-alpha3 W2-A (review fix F1, guide §2.3): the runtime
    // requirement-facts authority (the #40 live environment source for the
    // RequirementAuthority — the #42 consumer switching, W3-A, reads it off
    // the root surface: the gate's BLOCK/OPEN decision consumes the 3-state
    // `observations` of `resolveFacts`, the 2-state feed keeps the engine's
    // fingerprint/ack machinery).
    requirementFacts: requirementFactsAuthority,
  })
  root = builtRoot
  // pre-alpha3 PR-B (plan §B.2): the production PolicyReader reference is
  // filled NOW (the glue's lazy read sees it from the next boundary on —
  // the boot window before this line is unreachable for Team agent
  // boundaries: the remote surface is not servable until the boot is
  // armed, and the boot preload below runs after this point).
  policyReaderRef.current = builtRoot.policyReader

  // --- strict-read + core-spill (Phase E, implementation guide §4/§13)
  // --- one artifact-read authority per production root, built over the
  // --- OPEN domain's durable repositories (session identity + the
  // --- artifact-read-granted fact family) and the host's lazy `fs`
  // --- seam (resolve + stat — the ONLY path to fs identity, the
  // --- same strict ctx.get('fs') basis as fsBackend), then REBUILT
  // --- from the durable ledger BEFORE `ready` settles (cold-restart
  // --- recovery, implementation guide §3: the durable facts are the
  // --- source of truth; stale facts are installed inert — they fail
  // --- the fresh identity check at use). A construction or rebuild
  // --- failure FAILS the boot (a failed boot is a failed world — the
  // --- grant vertical never comes up half-built).
  const artifactFsService = (): {
    resolve(path: string, options?: { cwd?: string }): Promise<{ targetKey: unknown; displayPath: unknown }>
    stat(target: { targetKey: unknown; displayPath: string }): Promise<ArtifactFsInfo | undefined>
  } => {
    // RC2-A1 receiver convention (the fsBackend precedent): the service
    // proxy is read per call and the method is invoked INSIDE the
    // closure, so the provider's receiver is never lost and the proxy
    // identity is not frozen at construction time.
    const svc = ctx.get('fs') as {
      resolve?: (path: string, options?: { cwd?: string }) => Promise<{ targetKey: unknown; displayPath: unknown }>
      stat?: (target: { targetKey: unknown; displayPath: string }) => Promise<ArtifactFsInfo | undefined>
    } | null | undefined
    if (
      svc === undefined ||
      svc === null ||
      typeof svc.resolve !== 'function' ||
      typeof svc.stat !== 'function'
    ) {
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
        'the "fs" public service is absent (or lacks resolve/stat) — the artifact-read authority resolves fs identity through it (fail-closed: a typed record/authorize fault, never a pass-through)',
      )
    }
    return {
      resolve: (path, options) => svc.resolve!(path, options),
      stat: (target) => svc.stat!(target),
    }
  }
  const artifactFsPort: ArtifactFsPort = {
    async resolve(path: string): Promise<ArtifactFsTarget> {
      const target = await artifactFsService().resolve(path)
      return { targetKey: String(target.targetKey), displayPath: String(target.displayPath) }
    },
    async stat(target: ArtifactFsTarget): Promise<ArtifactFsInfo | undefined> {
      return artifactFsService().stat(target)
    },
  }
  const artifactIdentityPort: ArtifactIdentityPort = {
    instanceForSession(sessionId: string) {
      // The DURABLE session → instance binding (the session-bindings
      // repository — the same rows the team tools read; no live agents
      // consulted). Unbound / ordinary sessions are unmanaged (their
      // spill path stays upstream-equivalent — no grant, no record I/O).
      const binding = domain.repositories.sessionBindings.get(sessionId)
      if (binding === undefined) return undefined
      switch (binding.kind) {
        case 'ordinary':
          return undefined
        case 'team-root':
          // The root DSH session IS the TeamSession (invariant 9); its
          // identity is the leader instance (invariant 13 — no member
          // lifecycle).
          return { rootSessionId: binding.sessionId, instanceId: LEADER_INSTANCE_ID }
        case 'team-member':
          return { rootSessionId: binding.rootSessionId, instanceId: binding.instanceId }
      }
    },
    lifecycleOf(rootSessionId: string, instanceId: string) {
      // The leader (no lifecycle, invariant 13) is always eligible; a
      // member's eligibility is its DURABLE lifecycle state (D6).
      if (instanceId === LEADER_INSTANCE_ID) return 'leader'
      const record = domain.repositories.memberInstances.get(rootSessionId, instanceId)
      return record === undefined ? undefined : record.lifecycle
    },
  }
  const artifactLedgerPort: ArtifactLedgerPort = {
    async appendGranted(rootSessionId: string, payload: Record<string, unknown>): Promise<void> {
      // Allocate + put serialize on the domain's single write chain (the
      // repository's atomic seam update); the fact is durable before the
      // authority installs its runtime candidate.
      const sequence = await domain.repositories.ledger.allocateSequence()
      await domain.repositories.ledger.put({
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        sequence,
        rootSessionId,
        factType: ARTIFACT_READ_GRANTED_FACT_TYPE,
        payload,
        createdAt: new Date().toISOString(),
      })
    },
    async listGranted() {
      // Every fact in the domain, in sequence order (the reader filters
      // to the grant family and validates each row fail-safe).
      return domain.repositories.ledger.list()
    },
  }
  const artifactAuthority = new TeamArtifactAuthority({
    fs: artifactFsPort,
    identity: artifactIdentityPort,
    ledger: artifactLedgerPort,
  })
  await artifactAuthority.rebuildFromLedger()
  // Fill BOTH consumers' views only AFTER the rebuild: the bridge (the
  // spill provider row) and the glue reference (the observer + the read
  // lane) never see an authority whose runtime projection is not yet
  // the durable facts' cache.
  artifactAuthorityRef.current = artifactAuthority
  artifactAuthorityBridge.authority = artifactAuthority

  // --- T12-M4 + BP-G (issue #2 blueprint-loading, plan §12.1): the
  // production Remote mount — BEFORE the awaited live boot: the route
  // registration needs the CONSTRUCTED root only, never a successful
  // boot (a boot failure leaves the route registered — the 405 symptom
  // removed; the readiness state gates the non-catalog methods in the
  // meantime, plan §12.2/§12.3) ---------------------------------------
  //
  // The web profile provides the 'connection' public service (the client-connection row of the web-app bundle, on an independent fiber with no dependency edge to this row), so
  // the mount is the production default there. A headless host provides
  // no such service: the remote surface stays UNMOUNTED and the boot
  // keeps succeeding (the durable domain and the agent tools work
  // without a remote surface — the outcome is recorded on the facade AND logged to the console, never silent,
  // never a boot throw. A PRESENT-but-malformed service is a boot
  // failure (fail closed: a broken web profile must not silently lose
  // the remote surface), as is a channel-conflict rejection (one owner
  // per channel).
  //
  // Remote-mount-race fix (root cause A): the service can legitimately be
  // ABSENT at the mount step on a slow boot (its provider row is still
  // starting up). The pre-fix entry read `ctx.get('connection')` exactly
  // once and decided forever — a lost race meant a permanent SILENT skip
  // (the user-world 405: POST /team-remote/* hit the frontend static
  // fallback, no route, nothing logged). Now: absent at the mount step
  // means `pending` plus a bounded wait (`remoteMountWaitMs`, production
  // default 30000; 0 = the legacy immediate decision) — the service
  // APPEARING mounts late, the window EXPIRING skips with a logged
  // reason, a malformed late appearance records a logged `failed`.
  //
  // No adapter: the dispatcher answers with the frozen RemoteResponse
  // envelope — {ok:true, value:{data, provenance}} or {ok:false,
  // error:{code, message, details}} with `details` ALWAYS a present
  // object — which is structurally a ConnectionRpcResult<unknown>; the
  // DSH-shaped handler's extra `signal` argument is ignored by the
  // dispatcher (RemoteResponse ⊂ ConnectionRpcResult<unknown>).
  const connection = ctx.get('connection') as
    | ConnectionLike
    | null
    | undefined
  if (connection === undefined || connection === null) {
    const waitMs = rowConfig.remoteMountWaitMs ?? DEFAULT_REMOTE_MOUNT_WAIT_MS
    if (waitMs === 0) {
      remoteMountState = {
        state: 'skipped',
        reason: 'the "connection" public service is absent (headless host)',
      }
      logRemoteMountOutcome(remoteMountState, 0)
    } else {
      remoteMountState = { state: 'pending' }
      armRemoteMountWatcher(builtRoot, waitMs)
    }
  } else if (
    typeof connection !== 'object' ||
    typeof connection.rpc !== 'object' ||
    connection.rpc === null ||
    typeof connection.rpc.handle !== 'function'
  ) {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
      'the "connection" public service is malformed: expected connection.rpc.handle to be a function; a headless host should not provide a partial service',
    )
  } else {
    logRemoteMountOutcome(mountRemoteNow(builtRoot, connection, false), 0)
  }
  // BP-G (issue #2 blueprint-loading, plan §12.2): the awaited live boot
  // — the readiness state settles around it ('ready' on success,
  // 'failed' on rejection — terminal: no automatic retry, no re-boot);
  // the rejection propagates UNCHANGED to the ready promise (the boot
  // failure is still the world's failure — the repair isolates the
  // route from it, never the world from it).
  try {
    await builtRoot.boot()
    // pre-alpha3 PR4 (round 4): WARM the authority documents at this async
    // boundary — AFTER the boot effect (the durable TeamSession row exists
    // from here on; the only entry that could reach `mutatePermission`
    // remotely is gated on `teamRuntimeReadiness`, which flips below) and
    // BEFORE readiness. This is a WARMUP, not the authority's existence: the
    // round-4 readers resolve the ADDRESSED team's bound Blueprint and the
    // TARGET member's workspace at READ time, so a warmup failure (or a
    // member created after boot) self-heals — the next addressed read
    // rebuilds (bounded recovery, fail-closed preserved: until then Leader
    // EXPANSIONS refuse typed, zero envelope authority, while decisions,
    // execution, and every unaffected reader keep serving correct current
    // facts). The loud line below stays the operator signal; boot continues
    // (a transient fs fault at boot must not fail the world — the artifact-
    // authority rebuild precedent).
    try {
      await permissionFacts.refresh()
      // ROUND 5 (R-A minor): `refresh` resolves even when a warm READ
      // faulted; `healthy()` now aggregates READ RESULTS (not throw-only),
      // so a faulted warm prints LOUD here instead of the old silent
      // `facts healthy: true` line over a zero-rule envelope.
      if (!permissionFacts.healthy()) {
        console.error(
          '[dsh-agent-team] the permission authority facts warm-up FAULTED (a provider read abstained for at least one warm target) — Leader permission EXPANSIONS refuse typed (EFFECT_CONTEXT_UNAVAILABLE / zero envelope authority) until an addressed read rebuilds the facts (bounded recovery); decisions and execution are unaffected',
        )
      }
    } catch (error: unknown) {
      console.error(
        `[dsh-agent-team] the permission authority facts warm-up failed (${
          error instanceof Error ? error.message : String(error)
        }) — Leader permission EXPANSIONS refuse typed (EFFECT_CONTEXT_UNAVAILABLE / zero envelope authority) until an addressed read rebuilds the facts (bounded recovery); decisions and execution are unaffected`,
      )
    }
    if (permissionsBearingTemplates.length > 0) {
      console.info(
        `[dsh-agent-team] durable permission authority ACTIVE for row ${rowConfig.rootSessionId}: ` +
          `anchor templates declaring capabilities.permissions = ${JSON.stringify(permissionsBearingTemplates)}, ` +
          `facts resolve per ADDRESSED team through the bound-Blueprint resolver (anchor ${String(factsAnchorBlueprint.blueprintId)}@${String(factsAnchorBlueprint.revision)}), ` +
          `canonicalized at each target member's effective workspace; expansion ceiling = the bound ` +
          `Blueprint's explicit permissionMutationEnvelope carrier (facts healthy: ${String(permissionFacts.healthy())})`,
      )
    }
    teamRuntimeReadiness = 'ready'
  } catch (error) {
    teamRuntimeReadiness = 'failed'
    throw error
  }
  return builtRoot
  }

  const ready: Promise<TeamProductionRoot> = bootstrap()
  // Mark the rejection handled even when no consumer attaches (the
  // observability row awaits `ready` through its own handler). The
  // rejection is ALSO surfaced on the console (remote-mount-race fix,
  // root causes B/C): the pre-fix bootstrap swallowed every failure with
  // zero terminal signal — the row looked mounted, the /team-remote
  // channel was never registered, and the operator saw only the frontend
  // static handler's 405. A swallowed bootstrap must never present as a
  // silent half-world.
  void ready.catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
    console.error(`[dsh-agent-team] bootstrap FAILED: ${message}`)
    // Startup-failure isolation (PR #31 minimal supplement): a bootstrap
    // rejection may leave the ownership resolver UNBOUND (the domain open
    // is a bootstrap step — a failure at or before it never binds), while
    // the row KEEPS RUNNING (a failed boot is terminal — no automatic
    // retry, no re-boot — but the route stays registered, the catalog
    // reads stay servable, and the row stops only on its own teardown),
    // so the row-stop backstop's `close()` never runs. Left as-is, EVERY
    // later `agent/created` of this process — the fence listeners are
    // registered `{ global: true }` at the top of `apply()` — would await
    // the `ownershipReady` barrier forever (classification PENDING that
    // can never settle): ordinary non-Team sessions of an UNRELATED row
    // would hang on this DEAD Team row. Close the fence on the bootstrap
    // rejection instead: every pending ownership-ready / rollback /
    // writer-conflict waiter settles immediately, and every subsequent
    // activation passes through (the fence keeps no state past a failed
    // row — a late activation is the upstream's own concern). The `ready`
    // rejection, this console error, and the row-stop cleanup semantics
    // are all UNCHANGED; the row-stop backstop keeps its own `close()`
    // call as the teardown path — `close()` is idempotent, so the
    // bootstrap-failure close and the later row-stop close compose
    // (the second call is a no-op). The normal successful bootstrap path
    // never enters this handler (no rejection) — the fence stays armed
    // until the row stop, exactly as before.
    try {
      activationFence.close()
    } catch {
      // a throwing close is swallowed: the row teardown proceeds
    }
  })

  function requireRoot(): TeamProductionRoot {
    if (root === undefined) {
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_NOT_READY,
        'teamRoot was read before the bootstrap settled (await `ready` first)',
      )
    }
    return root
  }

  // The `teamRoot` service — provided SYNCHRONOUSLY (before the first
  // await) so the consumer can observe every setup failure through
  // `ready`. The harness reads the other fields after `ready` settles;
  // the getters keep the facade live if the row is ever restarted against
  // the same root.
  const facade = {
    ready,
    get domain(): TeamDomain {
      return requireRoot().domain
    },
    get live(): TeamAgentBindings {
      return requireRoot().live
    },
    get tools(): TeamProductionRoot['tools'] {
      return requireRoot().tools
    },
    get control(): TeamProductionRoot['control'] {
      return requireRoot().control
    },
    get activity(): TeamProductionRoot['activity'] {
      return requireRoot().activity
    },
    get messaging(): TeamProductionRoot['messaging'] {
      return requireRoot().messaging
    },
    // pre-alpha3 PR-A: the mutation surface (the durable transition read
    // cache + the SINGLE governance mutation authority) — the dev-harness
    // governance route reads the authority through this facade field.
    get mutation(): TeamProductionRoot['mutation'] {
      return requireRoot().mutation
    },
    get config(): TeamPluginConfig {
      return requireRoot().config
    },
    // pre-alpha3 W3-B (review fix F7, guide §6): the production
    // requirement-fact writers (the durable consent grant + the template
    // disable/enable) — the human resolution channel of the creation
    // preflight. The root is assigned BEFORE the boot, so the getter
    // stays live even when the boot create's preflight REFUSES the bind
    // (a boot failure is terminal — the human resolves through THIS
    // channel and re-drives the row's boot; the writer's facts are
    // durable + restart-proof).
    get requirementAuthority(): TeamProductionRoot['requirementAuthority'] {
      return requireRoot().requirementAuthority
    },
    get remote(): RemoteMountState | undefined {
      return remoteMountState
    },
  }
  ctx.provide('teamRoot', facade)
  // strict-read + core-spill (Phase C/E): the artifact-authority BRIDGE
  // under its row-scope service name — provided SYNCHRONOUSLY (next to
  // the teamRoot facade, before the first await) so the sibling
  // Team-aware spill provider row (the `dsh-agent-team/spill-local`
  // replacement) can observe every setup failure through `ready` exactly
  // like the teamRoot consumers; the bootstrap fills `.authority` once
  // it has constructed + rebuilt the authority of this root. (Module
  // docs in artifact-grant-bridge.ts for the cross-row visibility and
  // the unmanaged-session contract of a not-yet-filled bridge.)
  ctx.provide(TEAM_ARTIFACT_AUTHORITY_SERVICE, artifactAuthorityBridge)

  // Row-stop backstop: settle the bootstrap (if it is still running), then
  // close the live bundle + the durable domain (idempotent; the observability
  // row may also close live — the root's close() is idempotent). When the
  // bootstrap failed before the root was built, close the domain directly.
  ctx.effect(
    () => () => {
      void ready
        .catch(() => undefined)
        .then((settled) => {
          // T12-M4: release the /team-remote channel ownership first (the
          // disposer must never fail the row teardown — the underlying
          // DSH effect disposal runs in the connection fiber).
          try {
            remoteRegistration?.dispose()
          } catch {
            // a throwing disposer is swallowed: the row teardown proceeds
          }
          // C1 (restart-recovery, guide §3/A8): settle the activation
          // fence: a new runOwned REJECTS (no Team-owned activation is
          // accepted past the row stop), every in-flight waiter settles
          // (rollback barriers resolve, writer-conflict waits resolve
          // false, no dangling promise). Idempotent — the root's close
          // disposes the row's agents, and their agent/disposed events
          // arriving at the already-closed fence are no-ops.
          try {
            activationFence.close()
          } catch {
            // a throwing close is swallowed: the row teardown proceeds
          }
          // strict-read + core-spill (Phase E): drop the authority's
          // RUNTIME projection (the durable facts remain on the medium —
          // the next boot rebuilds from the ledger; dispose is idempotent
          // and a no-op when the bootstrap never filled the ref). Never
          // fails the row teardown.
          try {
            artifactAuthorityRef.current?.dispose()
          } catch {
            // a throwing disposer is swallowed: the row teardown proceeds
          }
          // pre-alpha3 PR4: release the overlay store's own domain handle
          // (the durable rows stay on the medium; the plane is stateless).
          // Never fails the row teardown.
          try {
          } catch {
            // a throwing close is swallowed: the row teardown proceeds
          }
          if (settled !== undefined) {
            void settled.close().catch(() => undefined)
          } else if (openDomain !== undefined) {
            void openDomain.close().catch(() => undefined)
          }
        })
    },
    'dsh-agent-team production cleanup',
  )
}
