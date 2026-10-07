/**
 * The `override` category handler (design note §3 / D-7): autonomy overlays
 * and explicit human overrides over the P7-T2 MutationService + mutation
 * store. `override.get` is a read (no actor); `override.set` records a
 * durable value; `override.reset` revokes the addressed record
 * (audit-preserving).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/override
 */
import type { RemoteMethodParams } from '../contracts/params.js';
import type { RemoteInterventionPort, RemoteOverridePort } from './ports.js';
/**
 * The override category handler (`override.get`, `override.set`,
 * `override.reset`).
 */
export declare function createRemoteOverrideHandler(deps: RemoteOverridePort, 
/** A4-PR6 §6.B: the v8 governance read seam (the permission-
 *  administration read lives in THIS category — it reads the override
 *  plane's documents — while its port lives on the single v8 seam).
 *  Optional: pre-v8 callers and fakes compile and behave byte-for-byte;
 *  an unwired surface answers the v8 read with a typed refusal. */
governance?: RemoteInterventionPort): (method: string, params: RemoteMethodParams) => {
    readonly data: {
        administration: import("../contracts/remote-safe.js").RemoteSafeRecord;
    };
} | {
    data: {
        override: import("../contracts/remote-safe.js").RemoteSafeRecord | null;
        record?: undefined;
        removed?: undefined;
    };
} | {
    data: {
        record: import("../contracts/remote-safe.js").RemoteSafeRecord;
        override?: undefined;
        removed?: undefined;
    };
} | {
    data: {
        removed: boolean;
        override?: undefined;
        record?: undefined;
    };
};
//# sourceMappingURL=override.d.ts.map