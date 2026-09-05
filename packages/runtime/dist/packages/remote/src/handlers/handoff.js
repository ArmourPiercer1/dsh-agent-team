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
/**
 * The handoff category handler (`handoff.prepare`, `handoff.create`).
 */
export function createRemoteHandoffHandler(deps) {
    return (method, params) => {
        switch (method) {
            case 'handoff.prepare': {
                const prepareParams = params;
                const summary = deps.prepareSource(prepareParams.sourceSessionId);
                return { data: { summary, sourceSessionId: prepareParams.sourceSessionId } };
            }
            case 'handoff.create': {
                const createParams = params;
                const state = deps.start(createParams.sourceSessionId, createParams.requestToken, createParams.staged);
                return { data: { state } };
            }
            default:
                throw new Error(`handoff handler routed an unknown method: ${method}`);
        }
    };
}
//# sourceMappingURL=handoff.js.map