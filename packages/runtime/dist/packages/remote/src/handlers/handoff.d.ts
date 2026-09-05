/**
 * The `handoff` category handler (design note §3 / D-6): start-a-team-from
 * here (Architecture §34). `handoff.prepare` is a read-only source-surface
 * summary (zero durable writes, no team creation); `handoff.create` is
 * `startTeamFromHere` (idempotent by `(sourceSessionId, requestToken)`).
 * The `querySourceHistoryFromTarget` capability is deliberately NOT
 * exposed: Architecture §34.3 forbids the new team from reading the
 * source's history.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/handoff
 */
import type { RemoteMethodParams } from '../contracts/params.js';
import type { RemoteHandoffPort } from './ports.js';
/**
 * The handoff category handler (`handoff.prepare`, `handoff.create`).
 */
export declare function createRemoteHandoffHandler(deps: RemoteHandoffPort): (method: string, params: RemoteMethodParams) => {
    data: {
        summary: import("../contracts/remote-safe.js").RemoteSafeRecord;
        sourceSessionId: string;
        state?: undefined;
    };
} | {
    data: {
        state: import("../contracts/remote-safe.js").RemoteSafeRecord;
        summary?: undefined;
        sourceSessionId?: undefined;
    };
};
//# sourceMappingURL=handoff.d.ts.map