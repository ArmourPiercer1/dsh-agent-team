/**
 * P8-S5A — the production root assembly (plan §19.1, A01–A29 + the four
 * S6 installation seams A30–A34; plan §19.2: the harness MOUNTS the
 * production plugin and consumes `teamRoot` — it never builds a parallel
 * backend graph).
 *
 * This is the SINGLE assembly point of the shipped production plugin
 * (frozen invariant: "production root = single assembly point, harness =
 * consumer"). Every node of the §19.1 list is constructed here through
 * its canonical factory with the root-owned ports:
 *
 * | plan | node                                    | factory / source                              |
 * | ---- | --------------------------------------- | --------------------------------------------- |
 * | A02  | TeamDomain (open)                       | `createTeamDomain` / `openTeamDomain` (host)  |
 * | A03  | blueprint catalog                       | `createBlueprintCatalog([parseBlueprint(...)])` |
 * | A04  | intent surface                          | `REMOTE_METHOD_CATALOG` (remote contracts)    |
 * | A05  | root binding (fresh)                    | `bindFreshTeamRoot`                           |
 * | A06  | root binding (cold)                     | `rehydrateColdTeamRoot`                       |
 * | A07  | leader identity                         | `leaderMemberIdentityOf` (contracts)          |
 * | A08  | member residency (fresh)                | `createFreshMember`                           |
 * | A09  | member residency (cold)                 | `rehydrateColdMember`                         |
 * | A10  | TeamAgentBinder (3 slots, default guard)| `new TeamAgentBinder`                         |
 * | A11  | persona slot                            | `createPersonaOverlaySlot`                    |
 * | A12  | model slot                              | `TeamModelOverlaySlot` + ratchet source       |
 * | A13  | capability slot                         | `createCapabilityOverlaySlot`                 |
 * | A14  | compatibility prober                    | `createCompatibilityProber`                   |
 * | A15  | compatibility authority + work gate     | `createCompatibilityAuthority` + `enforceCompatibilityGate` |
 * | A16  | activation provider (sole creation)     | `createActivationProvider`                    |
 * | A17  | TeamRuntime facade                      | `createTeamRuntime`                           |
 * | A18  | work delivery                           | `live.workDelivery` (the P8-S3 chain)         |
 * | A19  | work settlement                         | `live.workDelivery` (settleAdmittedWork owner)|
 * | A20  | lifecycle service                       | `createLifecycleService`                      |
 * | A21  | lifecycle commit port                   | `memberInstances.commitTransition`            |
 * | A22  | mutation plane (read cache)               | durable-backed transition store               |
 * | A23  | governance mutation authority (PR-A)      | `createGovernanceMutationService`             |
 * | A24  | messaging coordinator                   | `createMessagingCoordinator`                  |
 * | A25  | control service                         | `createControlService`                        |
 * | A26  | activity ledger                         | `createActivityLedger` (+ work-activity writer) |
 * | A27  | fork reconciliation                     | `reconcileForkSidecar` + `createTeamDomainForkPort` |
 * | A28  | handoff service                         | `createHandoffService` (production wiring, P8-S7-R4) |
 * | A29  | legacy reader                           | `legacyInspect` (frozen reader, entry-loaded) |
 * | A30  | projection + S6 overlay seam            | `createProjectionService` + fail-closed proxy |
 * | A31  | remote handler registration seam        | install seam (S6)                             |
 * | A32  | server principal derivation seam        | install seam (S6)                             |
 * | A34  | remote query/command completion seam    | install seam (S6)                             |
 *
 * Boot-world decisions (documented in the S5A result):
 *
 * - **Boot seeds are deterministic puts performed by the production root**
 *   (create phase), replicating the exact seed rows of the frozen scenario
 *   contract (worker/scout `RUNNING` activityVersion 1; the leader as a
 *   plain v1 member row with childSessionId = the root session). The
 *   production fresh paths (`bindFreshTeamRoot` mints a v2 LeaderInstance;
 *   `createFreshMember` writes `CREATED` activityVersion 1) cannot
 *   reproduce that frozen state — the fresh/cold paths remain fully
 *   assembled and reachable (T1-proven) but are dormant in the boot flow.
 * - **Capability facet seams are honestly empty** in the boot world
 *   (every facet `available: false`; the slot resolves fail-closed and
 *   records the reason — there are no G2-proven facet seams in the static
 *   test world).
 * - **The handoff service ports are production-wired** (P8-S7-R4):
 *   `sourceSurface` reads the source through the DSH public
 *   `sessionQuery` service (lazy resolution at use time — ABSENT there
 *   still fails closed with `TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE`,
 *   which is the S5A boot world and every test world without the
 *   service), `summarizer` is the deterministic NON-MODEL digest of
 *   ./handoff-surface.js, and `teamCreation` reuses the existing
 *   fresh-root binding path (the same binding the `team.create` entry
 *   uses) with the handoff attached as the new team's source provenance
 *   (the `handoffSourceSessionId` TeamSession record field, BQ-16).
 * - **The A22/A23 mutation plane (pre-alpha3 PR-A, ADR-03)**: the
 *   SINGLE production write authority is the governance mutation
 *   service (`createGovernanceMutationService`) — the durable
 *   `overrides` repository + the PolicyState transition ledger rows,
 *   serialized on the shared per-team chain, committed BEFORE the ack.
 *   The transition read cache is durable-backed (boot preload); the
 *   old production `MutationService` instance + the remote-side
 *   `admitGovernanceOverride` glue are demoted (the persistence
 *   primitive + the pure P7-T2 kernel — neither is a production
 *   authority).
 *
 * Pure assembly module: no `node:` builtins, no DSH imports (the DSH side
 * arrives exclusively through the injected live-agent glue bundle).
 * @module @dsh-agent-team/runtime/plugin/root
 */
import type { BlueprintCatalog, TeamBlueprint } from '../../../domain/blueprint/src/index.js';
import type { BlueprintAuthority } from './blueprint-authority.js';
import type { ControlService } from '../../control/index.js';
import type { HandoffOperationState } from '../../handoff/index.js';
import type { LegacyHomePort, LegacyInspectFn } from './legacy-surface.js';
import type { TeamToolSet } from '../../../tools/src/index.js';
import type { GovernancePermissionLaneDeps } from '../../governance/index.js';
import type { CanonicalKeyContains, TeamPermissionPlane } from './permission-plane.js';
import type { PermissionOverlayRepositoryPort } from '../../permission-governance/port.js';
import type { TeamDomain } from '../../../storage/repositories/index.js';
import type { StorageDomainSeam } from '../../../storage/schema/index.js';
import type { GovernanceWarningService } from '../../governance-warning/index.js';
import type { RemoteSafeRecord } from '../../../remote/src/contracts/remote-safe.js';
import type { RequirementFactsAuthority, TeamAgentBindings, TeamPluginConfig, TeamProductionRoot, WorkspaceAttachPort } from './types.js';
/** BQ-18 (W3): the read-only fork reconciliation state query input. */
export interface ForkDescribeInput {
    readonly parentSessionId: string;
    readonly childSessionId: string;
}
/**
 * BQ-18 (W3): the EXACT fork reconciliation state vocabulary (plan
 * BQ-18, frozen). `root-fork-recovering` covers BOTH crash windows: the
 * reconciler's record-only durable phase AND a not-yet-reconciled fork
 * sidecar (`details.phase` disambiguates).
 */
export type ForkDescribeStateName = 'ordinary' | 'root-fork-reconciled' | 'root-fork-recovering' | 'member-fork-ordinary' | 'integrity-conflict';
/**
 * BQ-18 (W3): the read-only fork reconciliation state (a pure read over
 * the TeamDomain SYNC repositories — zero writes; the write path stays
 * the unchanged `fork.reconcile`).
 */
export interface ForkDescribeState {
    readonly parentSessionId: string;
    readonly childSessionId: string;
    readonly state: ForkDescribeStateName;
    /**
     * JSON-safe state details (no Host references). For
     * `integrity-conflict`, `details.conflict` names the conflict kind
     * (`binding-without-record` / `parent-binding-without-record` /
     * `blueprint-mismatch` / `reconciled-child-carries-members`).
     */
    readonly details: RemoteSafeRecord;
}
/** BQ-17 (W2): the handoff operation state/provenance query input. */
export interface HandoffDescribeInput {
    readonly sourceSessionId: string;
    readonly requestToken: string;
}
/**
 * BQ-17 (W2): the handoff state/provenance view — the source Session
 * provenance, the snapshot/summary status, the failure choices/state,
 * and the created Team's provenance (joined with the durable
 * `handoffSourceSessionId` record field — TeamDomain is the sole durable
 * authority, invariant 41; the handoff module itself owns no durable
 * state).
 */
export interface HandoffDescribeState {
    readonly sourceSessionId: string;
    readonly requestToken: string;
    /** `false` for an unknown (sourceSessionId, requestToken) pair. */
    readonly known: boolean;
    /** The operation's snapshot/summary freeze status. */
    readonly snapshotStatus: 'absent' | 'surface-frozen' | 'context-frozen';
    /** The operation's current state (`null` for an unknown operation). */
    readonly state: HandoffOperationState | null;
    /**
     * The created team's identity + durable provenance (`undefined` when
     * the operation created no team yet).
     */
    readonly createdTeam?: {
        readonly teamSessionId: string;
        readonly rootSessionId: string;
        readonly handoffSourceSessionId?: string;
    };
}
/** The construction inputs of the production root (all injected). */
export interface TeamProductionRootParams {
    /** The validated row config (the root's input channel). */
    readonly config: TeamPluginConfig;
    /** The open TeamDomain (A02; the host entry created it). */
    readonly domain: TeamDomain;
    /** The storage seam the domain was opened through (diagnostics). */
    readonly storageSeam: StorageDomainSeam;
    /** The live-agent glue bundle (the DSH-facing side of the root). */
    readonly live: TeamAgentBindings;
    /** The deterministic clock (ISO-8601). */
    readonly now: () => string;
    /**
     * The shared tool-stack reference (the glue's setup callback reads
     * `teamToolsRef.current` at agent create/resume time; the root fills it
     * during construction, the entry calls `boot()` only after).
     */
    readonly teamToolsRef: {
        current: TeamToolSet | undefined;
    };
    /**
     * The shared control-service reference (A6, alpha.2 plan §11): the glue's
     * setup callback reads `controlServiceRef.current` at agent create/resume
     * time — and ONLY for a bound template that declares
     * `capabilities.permissions` (absent policy = the ref is never read, the
     * alpha.1 / legacy path installs nothing). The root fills it during
     * construction (immediately after the control service is built); the
     * entry calls `boot()` only after. Mirrors the `teamToolsRef` precedent
     * exactly (construction-time object, filled during root construction,
     * read lazily when the setup runs).
     */
    readonly controlServiceRef: {
        current: ControlService | undefined;
    };
    /**
     * The frozen legacy reader's operational entry (A29) — the production
     * entry loads `inspectLegacyTeam` from the separately compiled legacy
     * dist and passes it here (the root never imports the legacy sources;
     * see ./legacy-surface.js for the type contract).
     */
    readonly legacyInspect: LegacyInspectFn;
    /**
     * The read-only legacy-home port for the A31 `legacy.inspect` remote
     * method — ABSENT in the S5A boot world (the method then fails closed
     * with `TEAM_REMOTE_LEGACY_HOME_UNAVAILABLE`); the host entry injects it
     * when a legacy DSH home is bound (see ./legacy-surface.js).
     */
    readonly legacyHome?: LegacyHomePort;
    /**
     * The DSH public `sessionQuery` service accessor (P8-S7-R4 A28):
     * resolved LAZILY at handoff use time (the service is registered by
     * the host before any handoff is started; the root never assumes a
     * registration order at construction time). ABSENT at use time → the
     * handoff source surface fails closed with
     * `TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE` (the S5A boot world and
     * every test world without the service keep the old behavior).
     */
    readonly getSessionQuery?: () => unknown;
    /**
     * M2 (plan §15.5) — the narrow workspace attach port: the host entry's
     * closure over the hard-injected public `workspaceRegistry` service
     * (resolve a registered workspace by path; attach the materialized
     * root session). OPTIONAL at the factory level: a root assembled
     * directly (factory worlds, no host entry) carries none, and the S6 v2
     * create path that consumes it fails closed on its absence. The host
     * entry ALWAYS passes one (its bootstrap fails closed when the
     * service is absent or malformed).
     */
    readonly workspaceAttach?: WorkspaceAttachPort;
    /**
     * BP5 (issue #2 blueprint-loading, plan §9) — the LIVE BlueprintCatalog
     * over the row's saved sources + the frozen registry + this row's anchor.
     * OPTIONAL at the factory level: absent → the legacy STATIC single-
     * blueprint catalog (`createBlueprintCatalog([blueprint])`), so the
     * factory-world tests and the pre-repair kits keep their behavior. The
     * production host entry ALWAYS passes one (it builds the live catalog
     * over the `config.blueprintDir` index + the domain registry); when
     * present, every catalog consumer of this root (the root/member
     * binding ports, the cold resolve, the S6 remote surfaces, the exposed
     * `root.catalog`) sees the live state.
     */
    readonly blueprintCatalog?: BlueprintCatalog;
    /**
     * BP6 (issue #2 blueprint-loading, plan §10) — the live
     * BlueprintAuthority (the freeze port). OPTIONAL at the factory level:
     * absent → the fresh-root paths keep the legacy no-freeze behavior
     * (factory worlds, pre-repair kits). The production host entry ALWAYS
     * passes one; when present, every fresh TeamSession mint of this root
     * goes through the freeze barrier (the plan's write order — all pure
     * preflights, then the registry freeze, then the durable put):
     *
     *   - the real create boot + `team.create` v1/v2 — the shared
     *     `rootBinding.bindFresh` wrapper (the single choke point);
     *   - the handoff target — the pre-put freeze in `createHandoffTeam`
     *     (the handoff mints its TeamSession record directly, then reuses
     *     the same bindFresh wrapper, which re-runs the freeze idempotently);
     *   - the fixture boot seed — the explicit registry seeding of the row
     *     anchor before its durable put (the writer-audit category 3: a
     *     fixture world with an injected authority keeps the invariant).
     *
     * The fork-reconciliation child (category 2) inherits the PARENT's exact
     * snapshot ref (invariant 10), so its registry row already exists
     * through the parent's freeze (or the boot seeding for a boot-world
     * parent) — no mint of its own.
     */
    readonly blueprintAuthority?: BlueprintAuthority;
    /**
     * BP-G (issue #2 blueprint-loading, plan §12.2, optional additive) —
     * the in-process read-only boot readiness getter the mounted remote
     * dispatcher gates on. ABSENT (factory worlds, every pre-BP-G test
     * world): the dispatcher runs unguarded (the legacy behavior,
     * byte-for-byte). The production host entry ALWAYS passes one: its
     * closure over the host's own `starting` / `ready` / `failed` state —
     * the route mounts BEFORE the live boot is awaited (plan §12.1), so a
     * failed boot leaves the route registered; the gate then refuses every
     * closed method except the readiness-independent catalog reads with
     * the frozen `internal-error` envelope (no new wire code, no protocol
     * bump — plan §12.3).
     */
    readonly remoteReadiness?: () => import('./s6-remote.js').RemoteReadiness;
    /**
     * A2 (RC2 repair, plan §5.2, optional additive) — the narrow per-Team
     * bound-blueprint resolver the persona source resolves through:
     * `(teamRootSid) => TeamBlueprint` — the durable TeamSession row's bound
     * snapshot ref through the live authority. The production host entry
     * ALWAYS passes one — its EXISTING glue resolver closure (host.ts), a
     * single source of truth; the root never builds a second resolution
     * path.
     *
     * ABSENT (factory worlds, pre-repair kits): the persona source keeps the
     * LEGACY row-anchor closure — the row's `blueprintSource` is the
     * factory's explicit fixture authority (the pre-repair behavior,
     * unchanged).
     *
     * PRESENT: the persona source resolves the OWNING team root's bound
     * snapshot PER TARGET ROOT (cached per root: the bound snapshot is
     * immutable for the root's lifetime, invariant 10, and parsing is pure).
     * A resolver failure PROPAGATES out of the slot's apply (the binder
     * wraps it as `BINDER_OVERLAY_FAILED`) — fail closed. There is NEVER a
     * silent row-anchor fallback on the production path (plan §5.3: the
     * bound snapshot is the authority; "unavailable / inconsistent" is not
     * "templateId missing").
     */
    readonly resolveBoundBlueprint?: (teamRootSid: string) => TeamBlueprint;
    /**
     * pre-alpha3 W2-A (review fix F1, guide §2.3) — the runtime
     * requirement-facts authority (the #40 live environment source for the
     * RequirementAuthority: the live provider + the 3-state readiness probe
     * + the production substrate plan + the persona observer). OPTIONAL at
     * the factory level: absent → the root surface carries no
     * `requirementFacts` (factory worlds). The production host entry ALWAYS
     * passes one (it assembles the authority over the live glue + the DSH
     * public `agentPresets` seam).
     */
    readonly requirementFacts?: RequirementFactsAuthority;
    /**
     * pre-alpha3 PR4 (plan PR4 "production entry wiring") — the open PR1
     * permission-overlay port (the persistence-only `append`/`latest`/`history`
     * face of the durable `permission_overlays` store). OPTIONAL at the factory
     * level, like `workspaceAttach` / `blueprintCatalog`: ABSENT (a factory or
     * test root, or a host whose overlay store failed to open) → the
     * governance service gets NO permission lane and `mutatePermission` refuses
     * `PERMISSION_MUTATION_NOT_CONFIGURED` (fail closed, zero write), and no
     * lifecycle lane is exposed. PRESENT → the canonical path is live: the
     * durable overlay is the ONE permission authority and the lifecycle gate
     * (ADR §8) guards execution.
     */
    readonly permissionOverlay?: PermissionOverlayRepositoryPort;
    /**
     * pre-alpha3 PR4 — the runtime CONTAINMENT predicate over two canonical
     * keys of the SAME provider (the host entry's closure over the pinned
     * public `FileSystem.contains`, resolved lazily per call). A `subtree`
     * matcher is judged ONLY by it (plan §9.4); ABSENT → the merged PR3 gate
     * refuses a subtree mutation typed instead of guessing (the predicate is
     * never synthesized from key text here).
     */
    readonly fsContainsKeys?: CanonicalKeyContains;
    /**
     * pre-alpha3 PR4 — the shared reference the root FILLS during construction
     * with the assembled permission plane (the exact `controlServiceRef` /
     * `teamToolsRef` precedent: a construction-time object, filled during
     * construction, read lazily by the live glue at agent setup). The live glue
     * consults `permissionPlaneRef.current.decisions` at the pre-execute
     * decision point; the root fills it, the entry calls `boot()` only after.
     */
    readonly permissionPlaneRef?: {
        current: TeamPermissionPlane | undefined;
    };
    /**
     * pre-alpha3 PR4 (round 4, addressed-team binding) — the bound §6
     * expansion-ceiling reader for one ADDRESSED (team, target member),
     * forwarded VERBATIM into the governance permission lane. This factory
     * grants NOTHING of its own: absent → the service's zero-envelope default
     * (no Leader expansion authority). The host entry injects the plane's
     * authority-facts reader, which resolves the ADDRESSED team's own bound
     * Blueprint (never the row anchor) and canonicalizes the carrier's file
     * matchers at the TARGET member's documented envelope path basis through
     * the real fs provider — hence async-capable (the service awaits; a
     * fixed-document sync reader stays valid). Test/legacy assemblers
     * hand-author fixed documents (sync readers).
     */
    readonly permissionEnvelope?: GovernancePermissionLaneDeps['permissionEnvelope'];
    /**
     * pre-alpha3 PR4 (round 4) — the lower-layer static-facts reader for the
     * Leader's expansion comparisons, forwarded VERBATIM. The three states
     * stay DISTINCT (governance/types.ts): absent / `undefined` → UNKNOWN
     * (typed `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE`), `{layers: []}` →
     * DECLARED-NONE. The host entry injects the plane's addressed-team,
     * target-member-anchored reader (async-capable, same contract as
     * {@link permissionEnvelope}).
     */
    readonly permissionStaticLayers?: GovernancePermissionLaneDeps['staticLayers'];
    /**
     * A4-PR2 lane C (plan:260) — the v3 AUTHORITY-CEILING context reader, forwarded
     * VERBATIM like the other two fact readers. The production host entry injects
     * `createAuthorityCeilingReader` from `permission-plane.ts` (the v3 switch lives
     * THERE, ADR A5-12); test/legacy assemblers may omit it, which keeps the lane at
     * its Alpha.3 behaviour. Omission is a WIRING fact, never the v3 signal.
     */
    readonly permissionAuthorityCeiling?: GovernancePermissionLaneDeps['authorityCeiling'];
    /**
     * A4-PR6 §6.A — the ONE governance-warning service (assembled by host.ts
     * where the bound-Blueprint reader + canonicalizer live, Ruling PR6-H).
     * Forwarded VERBATIM to the s6 surface: the Team-start gate at the two
     * `team.create` sites + `team.ensureRootLive`, the runtime boundary
     * observation, and (6.B) the v8 warning surface. root.ts adds ZERO
     * governance logic; omission (test/legacy assemblers) leaves the gate in
     * its disclosed ungated state.
     */
    readonly governanceWarning?: GovernanceWarningService;
    /**
     * pre-alpha3 PR4 ROUND 5 (FIX-2a) — the server-side canonicalizer for the
     * Leader's permission grant/revoke TOOL (the SAME fs-provider seam the
     * authority facts use). The tool NEVER trusts a client-supplied canonical
     * key: file rule PATHS arrive and are canonicalized HERE, at the TARGET
     * member's effective workspace (the durable member row's workspace, else
     * the durable TeamSession default — the FIX-3 durable fallback). Absent =
     * the grant tool refuses file rules typed (zero write); fingerprint rules
     * are identities and pass through regardless. (Round 5 also REMOVED the
     * round-4 permissionLeaderAuthorityFacts ceiling reader — ADR §6 carries
     * no second policy gate.)
     */
    readonly permissionCanonicalize?: (path: string, cwd: string) => Promise<string>;
}
/**
 * Assemble the complete production root (A01–A29 + the four S6 seams).
 *
 * Construction is side-effect free beyond the factory wiring (no agents,
 * no durable writes): the boot phase effects run in {@link
 * TeamProductionRoot.boot} and the close in {@link
 * TeamProductionRoot.close}.
 *
 * @param params - the injected root inputs.
 * @returns the complete {@link TeamProductionRoot} surface.
 */
export declare function createTeamProductionRoot(params: TeamProductionRootParams): TeamProductionRoot;
//# sourceMappingURL=root.d.ts.map