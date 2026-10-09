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
import type { RemoteSafeRecord } from '../contracts/remote-safe.js';
import type { RemoteHandlerOutcome, RemoteLedgerPort, RemoteLiveTokenPort, RemoteProjectionPort, RemoteTeamAdmitInitialWorkPort, RemoteTeamCorruptControlLegsPort, RemoteTeamCreateEmbeddedWorkPort, RemoteTeamCreateWorkspacePort, RemoteTeamEnsureRootLivePort, RemoteTeamPrepareOrdinaryOpenPort, RemoteTeamReadStatePort, RemoteTeamResolveControlPort, RemoteTeamRootsPort } from './ports.js';
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
    /**
     * A4-PR7 W1 (contract v9): the corrupt-leg visibility read over the
     * control service's `listControlState().corruptLegs` (the ONE strict
     * reader — this lane re-reads and re-judges nothing). OPTIONAL on
     * purpose (the v8 `intervention` precedent): pre-v9 fakes and surfaces
     * keep compiling unchanged; an UNWIRED v9 surface answers
     * `team.listCorruptControlLegs` with the typed refusal (`internal-error`,
     * reason `port-unwired`) and every v1–v8 method byte-for-byte.
     */
    readonly teamControlCorruption?: RemoteTeamCorruptControlLegsPort;
}
/**
 * THE ONE corrupt-legs wire law (A4-PR7 W1, contract v9): project the
 * port's full corrupt-leg list to the closed `corruption` response —
 * `corruptCount` stays EXACT (the fault size is never capped), the listed
 * `legs` are capped to {@link REMOTE_CORRUPT_CONTROL_LEGS_CAP} in the
 * SERVICE's own order (ascending ledger sequence; the report preserves
 * the authoritative order, it never re-sorts or re-derives), and
 * `truncated` is disclosed when fewer rows ride than exist.
 *
 * EXPORTED so the production s6 dispatcher serves through the SAME law
 * the generic dispatcher runs (the `validateItem` precedent) — the cap,
 * the count, and the closed leg shape must never have two copies.
 */
export declare function corruptControlLegsValue(teamSessionId: string, rawLegs: readonly unknown[]): {
    readonly data: {
        readonly corruption: RemoteSafeRecord;
    };
};
export declare function createRemoteTeamHandler(ports: RemoteTeamHandlerPorts): (method: string, params: RemoteMethodParams, version: number) => RemoteHandlerOutcome | {
    readonly data: {
        readonly corruption: RemoteSafeRecord;
    };
};
//# sourceMappingURL=team.d.ts.map