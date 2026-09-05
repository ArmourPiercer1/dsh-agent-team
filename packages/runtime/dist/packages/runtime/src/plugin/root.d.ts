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
 * | A22  | mutation service                        | `new MutationService`                         |
 * | A23  | governance override admission           | `admitGovernanceOverride` (+ durable resolvers) |
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
 * - **The A22 mutation service carries an ephemeral store**: the durable
 *   backend for mutation records is not part of the frozen S5A seam set;
 *   the frozen world's mutation consumption flows through
 *   `admitGovernanceOverride` (durable `overrides` repository) and the
 *   durable consumption resolvers.
 *
 * Pure assembly module: no `node:` builtins, no DSH imports (the DSH side
 * arrives exclusively through the injected live-agent glue bundle).
 * @module @dsh-agent-team/runtime/plugin/root
 */
import type { HandoffOperationState } from '../../handoff/index.js';
import type { LegacyHomePort, LegacyInspectFn } from './legacy-surface.js';
import type { TeamToolSet } from '../../../tools/src/index.js';
import type { TeamDomain } from '../../../storage/repositories/index.js';
import type { StorageDomainSeam } from '../../../storage/schema/index.js';
import type { RemoteSafeRecord } from '../../../remote/src/contracts/remote-safe.js';
import type { TeamAgentBindings, TeamPluginConfig, TeamProductionRoot } from './types.js';
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