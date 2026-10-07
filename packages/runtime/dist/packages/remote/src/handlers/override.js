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
import { permissionAdministrationVia } from './intervention.js';
/**
 * The override category handler (`override.get`, `override.set`,
 * `override.reset`).
 */
export function createRemoteOverrideHandler(deps, 
/** A4-PR6 §6.B: the v8 governance read seam (the permission-
 *  administration read lives in THIS category — it reads the override
 *  plane's documents — while its port lives on the single v8 seam).
 *  Optional: pre-v8 callers and fakes compile and behave byte-for-byte;
 *  an unwired surface answers the v8 read with a typed refusal. */
governance) {
    return (method, params) => {
        switch (method) {
            case 'override.get': {
                const getParams = params;
                const override = deps.get(getParams.teamSessionId, getParams.capability, getParams.scope, getParams.targetInstanceId);
                return { data: { override } };
            }
            case 'override.set': {
                const setParams = params;
                const request = {
                    teamSessionId: setParams.teamSessionId,
                    capability: setParams.capability,
                    value: setParams.value,
                    actor: setParams.actor,
                    ...(setParams.scope !== undefined ? { scope: setParams.scope } : {}),
                    ...(setParams.targetInstanceId !== undefined
                        ? { targetInstanceId: setParams.targetInstanceId }
                        : {}),
                };
                const record = deps.set(request);
                return { data: { record } };
            }
            case 'override.reset': {
                const resetParams = params;
                const request = {
                    teamSessionId: resetParams.teamSessionId,
                    capability: resetParams.capability,
                    actor: resetParams.actor,
                    ...(resetParams.scope !== undefined ? { scope: resetParams.scope } : {}),
                    ...(resetParams.targetInstanceId !== undefined
                        ? { targetInstanceId: resetParams.targetInstanceId }
                        : {}),
                };
                const { removed } = deps.reset(request);
                return { data: { removed } };
            }
            case 'override.getPermissionAdministration': {
                // v8-only (A4-PR6 §6.B): the STRIP-projection lives with the
                // intervention handler (shared closed-shape law).
                return permissionAdministrationVia(governance, params);
            }
            default:
                throw new Error(`override handler routed an unknown method: ${method}`);
        }
    };
}
//# sourceMappingURL=override.js.map