/**
 * The `legacy` category handler (design note §3): read-only legacy Team
 * inspection (DevPlan §20.6 degradation) over the P7-T7
 * `inspectLegacyTeam`. Read-only by construction: the legacy reader never
 * writes.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/legacy
 */
import type { RemoteMethodParams } from '../contracts/params.js';
import type { RemoteLegacyPort } from './ports.js';
/** The legacy category handler (`legacy.inspect`). */
export declare function createRemoteLegacyHandler(deps: RemoteLegacyPort): (method: string, params: RemoteMethodParams) => {
    data: {
        inspection: import("../contracts/remote-safe.js").RemoteSafeRecord;
    };
};
//# sourceMappingURL=legacy.d.ts.map