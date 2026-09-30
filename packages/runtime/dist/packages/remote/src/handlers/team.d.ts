/**
 * The `team` category handler (design note §3): TeamSession creation,
 * whole-projection observation, ledger pages, the v4-only human control
 * resolution (`team.resolveControl`, F3/F11/F9/T1.4 repair round r1 F9),
 * and the v5-only one-shot ordinary-activation permit
 * (`team.prepareOrdinaryOpen`, C1 restart-0.1.7-rc.1 recovery — guide
 * §10.2). Backed by nine ports:
 * {@link RemoteTeamCreateEmbeddedWorkPort} (root binding, P5-T5),
 * {@link RemoteTeamCreateWorkspacePort} (the workspace-aware creation
 * variant, TCM vNext §15.6), {@link RemoteTeamAdmitInitialWorkPort}
 * (the creation-time initial work command, TCM vNext §15.6),
 * {@link RemoteTeamRootsPort} (the durable root ownership list, D1),
 * {@link RemoteTeamEnsureRootLivePort} (the Team-mode ensure, D2-wired),
 * {@link RemoteTeamResolveControlPort} (the human control resolution
 * command, F9),
 * {@link RemoteTeamPrepareOrdinaryOpenPort} (the one-shot
 * ordinary-activation permit, C1), {@link RemoteProjectionPort}
 * (ProjectionService, P8-T2), and {@link RemoteLedgerPort} (storage
 * ledger behind a slicing adapter, D-5).
 *
 * Semantic routing (pre-alpha3 PR-F, plan §F.3): the dispatcher passes
 * the request's contract version through (the transport adapter's
 * concern), but this handler routes on the SEMANTIC decisions from the
 * contracts semantic adapter — the `team.create` flavor
 * ({@link teamCreateFlavorOf}) and the `team.getProjection` shape
 * ({@link projectionShapeOf}) — and never on a literal version number.
 *
 * The projection is validated at the TOP LEVEL only (D-4): the nine frozen
 * `TeamProjectionDto` fields must be present with the right structural
 * kinds; the nested values pass through. The whole-projection `generation`
 * rides in the reply's provenance (G8 staleness detection).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/team
 */
import type { RemoteMethodParams } from '../contracts/params.js';
import type { RemoteHandlerOutcome, RemoteLedgerPort, RemoteLiveTokenPort, RemoteProjectionPort, RemoteTeamAdmitInitialWorkPort, RemoteTeamCreateEmbeddedWorkPort, RemoteTeamCreateWorkspacePort, RemoteTeamEnsureRootLivePort, RemoteTeamPrepareOrdinaryOpenPort, RemoteTeamReadStatePort, RemoteTeamResolveControlPort, RemoteTeamRootsPort } from './ports.js';
/** The ports the team category needs (the create-flavor ports + the
 *  initial-work admission + the root list / ensure ports + the control
 *  resolution port + the ordinary-activation permit port + the
 *  team-view-sync-complete read-state + live-token ports). */
export interface RemoteTeamHandlerPorts {
    readonly teamCreateEmbeddedWork: RemoteTeamCreateEmbeddedWorkPort;
    /** TCM vNext §15.6: the workspace-aware creation variant (the current
     *  product create). */
    readonly teamCreateWorkspace: RemoteTeamCreateWorkspacePort;
    /** TCM vNext §15.6: the v2-only creation-time initial work command. */
    readonly teamAdmitInitialWork: RemoteTeamAdmitInitialWorkPort;
    /** Team D1-D6 repair v2 D1: the v3-only durable root ownership list. */
    readonly teamRoots: RemoteTeamRootsPort;
    /** Team D1-D6 repair v2 D1 (D2-wired): the v3-only Team-mode ensure. */
    readonly teamEnsureRootLive: RemoteTeamEnsureRootLivePort;
    /** F3/F11/F9/T1.4 repair round r1 F9: the v4-only human control
     *  resolution command. */
    readonly teamResolveControl: RemoteTeamResolveControlPort;
    /** C1 restart-0.1.7-rc.1 recovery (guide §10.2): the v5-only one-shot
     *  ordinary-activation permit (the Team fence's per-root permit arm;
     *  a control-plane RPC — no Team ensure, no Team Agent side effect). */
    readonly teamPrepareOrdinaryOpen: RemoteTeamPrepareOrdinaryOpenPort;
    /** team-view-sync-complete Phase 2: the v6-only authoritative
     *  per-session read-state (durable TeamDomain rows are the sole
     *  authority; fail-closed on every storage/integrity failure). */
    readonly teamReadState: RemoteTeamReadStatePort;
    /** team-view-sync-complete Phase 2: the v6 deterministic opaque
     *  semantic-live-state token (sorted per-member
     *  `{ instanceId, residency }`; no clock stamps, no process
     *  counters). */
    readonly liveToken: RemoteLiveTokenPort;
    readonly projection: RemoteProjectionPort;
    readonly ledger: RemoteLedgerPort;
}
/**
 * The team category handler (`team.create` [the two create flavors],
 * `team.admitInitialWork` [v2-only], `team.listRoots` [v3-only],
 * `team.ensureRootLive` [v3-only], `team.resolveControl` [v4-only],
 * `team.prepareOrdinaryOpen` [v5-only], `team.getReadState` [v6-only],
 * `team.getProjection` [the `base` shape for v1-v5; the `live` shape for
 * v6 adds `durableGeneration` + `liveToken`], `team.getLedgerPage`).
 *
 * Semantic routing (pre-alpha3 PR-F, plan §F.3): the dispatcher passes
 * the request's contract version (the transport adapter's concern); this
 * handler translates it to the SEMANTIC create flavor / projection shape
 * through the contracts semantic adapter and branches on those — no
 * literal version comparison in the handler body. The version-specific
 * parsed param object is already the matching typed shape (the shared
 * version-aware param parser validated the closed field set per wire
 * version before dispatch).
 */
export declare function createRemoteTeamHandler(ports: RemoteTeamHandlerPorts): (method: string, params: RemoteMethodParams, version: number) => RemoteHandlerOutcome;
//# sourceMappingURL=team.d.ts.map