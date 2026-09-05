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
import type { RemoteOverridePort } from './ports.js';
/**
 * The override category handler (`override.get`, `override.set`,
 * `override.reset`).
 */
export declare function createRemoteOverrideHandler(deps: RemoteOverridePort): (method: string, params: RemoteMethodParams) => {
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