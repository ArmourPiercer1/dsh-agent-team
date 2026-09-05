/**
 * The `team` category handler (design note §3): TeamSession creation,
 * whole-projection observation, and ledger pages. Backed by three ports:
 * {@link RemoteTeamCreatePort} (root binding, P5-T5),
 * {@link RemoteProjectionPort} (ProjectionService, P8-T2), and
 * {@link RemoteLedgerPort} (storage ledger behind a slicing adapter, D-5).
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
import { type RemoteLedgerEntryValue } from '../contracts/types.js';
import type { RemoteLedgerPort, RemoteProjectionPort, RemoteTeamCreatePort } from './ports.js';
/** The port trio the team category needs. */
export interface RemoteTeamHandlerPorts {
    readonly teamCreate: RemoteTeamCreatePort;
    readonly projection: RemoteProjectionPort;
    readonly ledger: RemoteLedgerPort;
}
/** The team.getProjection port value (nine top-level fields, D-4). */
interface RemoteMethodProjection {
    readonly schemaVersion: number;
    readonly generation: number;
    readonly [field: string]: unknown;
}
/**
 * The team category handler (`team.create`, `team.getProjection`,
 * `team.getLedgerPage`).
 */
export declare function createRemoteTeamHandler(ports: RemoteTeamHandlerPorts): (method: string, params: RemoteMethodParams) => {
    data: {
        path: string;
        durable: {
            readonly [key: string]: import("../contracts/remote-safe.js").RemoteSafeJsonValue;
        } | null;
        bind: {
            readonly [key: string]: import("../contracts/remote-safe.js").RemoteSafeJsonValue;
        };
        projection?: undefined;
        entries?: undefined;
        nextAfterSequence?: undefined;
        total?: undefined;
    };
    projectionGeneration?: undefined;
} | {
    data: {
        projection: RemoteMethodProjection;
        path?: undefined;
        durable?: undefined;
        bind?: undefined;
        entries?: undefined;
        nextAfterSequence?: undefined;
        total?: undefined;
    };
    projectionGeneration: number;
} | {
    data: {
        entries: RemoteLedgerEntryValue[];
        nextAfterSequence: number | null;
        total: number;
        path?: undefined;
        durable?: undefined;
        bind?: undefined;
        projection?: undefined;
    };
    projectionGeneration?: undefined;
};
export {};
//# sourceMappingURL=team.d.ts.map