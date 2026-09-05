/**
 * The `compatibility` category handler (design note §3): the durable
 * environment-compatibility state (Architecture §27/§28) over the P7-T1
 * CompatibilityProber. The ack is bound to the current mismatch +
 * fingerprint (FATAL never ack-able); reprobe runs one fresh probe under a
 * frozen trigger.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/compatibility
 */
import type { RemoteMethodParams } from '../contracts/params.js';
import type { RemoteCompatibilityPort } from './ports.js';
/**
 * The compatibility category handler (`compatibility.get`,
 * `compatibility.ack`, `compatibility.reprobe`).
 */
export declare function createRemoteCompatibilityHandler(deps: RemoteCompatibilityPort): (method: string, params: RemoteMethodParams) => {
    data: {
        verdict: import("../contracts/remote-safe.js").RemoteSafeRecord;
        probe?: undefined;
    };
} | {
    data: {
        probe: import("../contracts/remote-safe.js").RemoteSafeRecord;
        verdict?: undefined;
    };
};
//# sourceMappingURL=compatibility.d.ts.map