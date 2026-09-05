/**
 * The `policyState` category handler (design note §3): the TeamSession
 * PolicyState (Architecture §20; invariant 40 — explicit switch only) over
 * the P7-T2 mutation store + MutationService.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/policy-state
 */
import type { RemoteMethodParams } from '../contracts/params.js';
import type { RemotePolicyStatePort } from './ports.js';
/**
 * The policyState category handler (`policyState.get`, `policyState.set`).
 */
export declare function createRemotePolicyStateHandler(deps: RemotePolicyStatePort): (method: string, params: RemoteMethodParams) => {
    data: {
        state: import("../contracts/remote-safe.js").RemoteSafeRecord;
        transition?: undefined;
    };
} | {
    data: {
        transition: import("../contracts/remote-safe.js").RemoteSafeRecord;
        state?: undefined;
    };
};
//# sourceMappingURL=policy-state.d.ts.map