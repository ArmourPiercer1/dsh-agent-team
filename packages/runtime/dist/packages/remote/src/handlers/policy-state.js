/**
 * The `policyState` category handler (design note §3): the TeamSession
 * PolicyState (Architecture §20; invariant 40 — explicit switch only) over
 * the P7-T2 mutation store + MutationService.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/policy-state
 */
/**
 * The policyState category handler (`policyState.get`, `policyState.set`).
 */
export function createRemotePolicyStateHandler(deps) {
    return (method, params) => {
        switch (method) {
            case 'policyState.get': {
                const getParams = params;
                const state = deps.read(getParams.teamSessionId);
                return { data: { state } };
            }
            case 'policyState.set': {
                const setParams = params;
                const transition = deps.switchState({
                    teamSessionId: setParams.teamSessionId,
                    target: setParams.target,
                    actor: setParams.actor,
                });
                return { data: { transition } };
            }
            default:
                throw new Error(`policyState handler routed an unknown method: ${method}`);
        }
    };
}
//# sourceMappingURL=policy-state.js.map