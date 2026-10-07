/**
 * The `intervention` category handler (A4-PR6 §6.B, contract v8).
 *
 * The generic dispatcher's mirror of the runtime production lane: three
 * read/verb methods of the intervention plane plus the
 * `override.getPermissionAdministration` strip. The handler
 *
 * - validates every port value against the CLOSED wire shape (the same
 *   defense the v6 read-state lane runs: a projection regression must
 *   surface as a typed `internal-error` (`port-contract`), never as a
 *   malformed wire object the client half-renders);
 * - projects the administration read DOWN to the closed field set —
 *   the server-side STRIP is this handler's law, not the caller's
 *   politeness: whatever extra cells the backing record carries
 *   (grants, ceilings, ranks, reviewer identities, open request ids) are
 *   dropped HERE, so a round-trippable authority field cannot reach a
 *   client even if the port regresses;
 * - adds nothing: the act response is a closed receipt (the next list/get
 *   re-derives state), and legal actions exist only on items, computed
 *   server-side by the runtime lane (spec §17.3).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/intervention
 */
import type { RemoteSafeRecord } from '../contracts/remote-safe.js';
import type { RemoteMethodParams } from '../contracts/params.js';
import type { RemoteInterventionPort } from './ports.js';
/**
 * Validate one item against the closed wire shape; return it unchanged.
 *
 * A4-PR6 §6.B: EXPORTED so the production s6 dispatcher validates through
 * the SAME law the generic dispatcher runs — the closed-shape check must not
 * have two copies that can drift (the s6 lane imports this module by path).
 */
export declare function validateItem(raw: unknown, label: string): RemoteSafeRecord;
/**
 * THE STRIP + closed-cell validation for the administration read (see the
 * module header). Exported for the same single-law reason as
 * {@link validateItem}: the production lane strips through this function.
 */
export declare function validateAdministration(raw: unknown, label: string): RemoteSafeRecord;
/** The intervention category handler (v8: `intervention.list|get|act`). */
export declare function createRemoteInterventionHandler(deps: RemoteInterventionPort): (method: string, params: RemoteMethodParams) => {
    data: {
        items: RemoteSafeRecord[];
        item?: undefined;
        outcome?: undefined;
    };
} | {
    data: {
        item: RemoteSafeRecord;
        items?: undefined;
        outcome?: undefined;
    };
} | {
    data: {
        outcome: "acknowledged" | "decided" | "escalated" | "already-acknowledged";
        items?: undefined;
        item?: undefined;
    };
};
/**
 * The `override.getPermissionAdministration` lane: the read lives in the
 * OVERRIDE category (it reads the override plane's documents) but its
 * PORT lives on the intervention seam (one governance read/verb seam for
 * the whole v8 surface). The STRIP is enforced by the shared
 * `validateAdministration` below.
 */
export declare function permissionAdministrationVia(deps: RemoteInterventionPort | undefined, params: RemoteMethodParams): {
    readonly data: {
        administration: RemoteSafeRecord;
    };
};
//# sourceMappingURL=intervention.d.ts.map