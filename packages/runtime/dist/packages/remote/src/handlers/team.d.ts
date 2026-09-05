/**
 * The `team` category handler (design note §3): TeamSession creation,
 * whole-projection observation, and ledger pages. Backed by five ports:
 * {@link RemoteTeamCreatePort} (root binding, P5-T5),
 * {@link RemoteTeamCreateV2Port} (the v2 workspace-aware creation
 * variant, TCM vNext §15.6), {@link RemoteTeamAdmitInitialWorkPort}
 * (the v2-only creation-time initial work command, TCM vNext §15.6),
 * {@link RemoteProjectionPort} (ProjectionService, P8-T2), and
 * {@link RemoteLedgerPort} (storage ledger behind a slicing adapter,
 * D-5).
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
import type { RemoteHandlerOutcome, RemoteLedgerPort, RemoteProjectionPort, RemoteTeamAdmitInitialWorkPort, RemoteTeamCreatePort, RemoteTeamCreateV2Port } from './ports.js';
/** The ports the team category needs (v1 trio + the two v2 ports). */
export interface RemoteTeamHandlerPorts {
    readonly teamCreate: RemoteTeamCreatePort;
    /** TCM vNext §15.6: the v2 workspace-aware creation variant. */
    readonly teamCreateV2: RemoteTeamCreateV2Port;
    /** TCM vNext §15.6: the v2-only creation-time initial work command. */
    readonly teamAdmitInitialWork: RemoteTeamAdmitInitialWorkPort;
    readonly projection: RemoteProjectionPort;
    readonly ledger: RemoteLedgerPort;
}
/**
 * The team category handler (`team.create` [v1 + v2],
 * `team.admitInitialWork` [v2-only], `team.getProjection`,
 * `team.getLedgerPage`).
 *
 * Version-aware (TCM vNext §15.3): the dispatcher passes the request's
 * contract version; `team.create` routes to the v1 port (closed v1 field
 * set, `initialWork` allowed) or the v2 port (closed v2 field set,
 * `workspace` allowed, CREATE-ONLY) — the version-specific parsed param
 * object is already the matching typed shape.
 */
export declare function createRemoteTeamHandler(ports: RemoteTeamHandlerPorts): (method: string, params: RemoteMethodParams, version: number) => RemoteHandlerOutcome;
//# sourceMappingURL=team.d.ts.map