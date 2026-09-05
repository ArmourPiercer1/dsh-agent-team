/**
 * Seam registration of the Remote contract v1 (design note §6, P2-T6
 * reference).
 *
 * `registerRemoteHandlers` is PURE w.r.t. the seam: it only calls the
 * injected `connection.rpc.handle(channel, dispatcher)` — the public seam
 * characterized in P2-T6 — and wraps the returned disposer (if any) in a
 * `dispose()`. It performs no I/O of its own and keeps no global state;
 * the host wiring (a later P8 harness task) installs it as a
 * caller-fiber effect:
 *
 * ```ts
 * ctx.effect(
 *   () => {
 *     const reg = registerRemoteHandlers(connection, deps)
 *     return () => reg.dispose()
 *   },
 *   'p8-remote: rpc channel',
 * )
 * ```
 *
 * so stop / update / undefine removes the registration (reversible).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/register
 */
import { createRemoteDispatcher } from './dispatch.js';
/**
 * The single RPC channel the Remote contract v1 owns (one
 * `rpc.handle` owner; dotted method names as endpoints).
 */
export const REMOTE_RPC_CHANNEL = '/team-remote';
/**
 * Register the Remote contract v1 handlers on the public seam.
 * @param connection - the seam connection (only `rpc.handle` is used).
 * @param deps - the twelve backing ports (injected; no global state).
 * @param options - optional channel override.
 * @returns the registration (channel + dispose).
 */
export function registerRemoteHandlers(connection, deps, options) {
    const channel = options?.channel === undefined ? REMOTE_RPC_CHANNEL : options.channel;
    const dispatcher = createRemoteDispatcher(deps);
    const handleResult = connection.rpc.handle(channel, dispatcher);
    if (typeof handleResult === 'function') {
        const disposeRegistration = handleResult;
        let disposed = false;
        return {
            channel,
            dispose: () => {
                if (disposed)
                    return;
                disposed = true;
                disposeRegistration();
            },
        };
    }
    return { channel, dispose: () => { } };
}
//# sourceMappingURL=register.js.map