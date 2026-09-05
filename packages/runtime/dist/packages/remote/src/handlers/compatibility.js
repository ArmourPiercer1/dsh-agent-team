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
/**
 * The compatibility category handler (`compatibility.get`,
 * `compatibility.ack`, `compatibility.reprobe`).
 */
export function createRemoteCompatibilityHandler(deps) {
    return (method, params) => {
        switch (method) {
            case 'compatibility.get': {
                const getParams = params;
                const verdict = deps.current(getParams.teamSessionId);
                return { data: { verdict } };
            }
            case 'compatibility.ack': {
                const ackParams = params;
                const verdict = deps.acknowledge(ackParams.teamSessionId, ackParams.requirementId, ackParams.acknowledgedBy, ackParams.note);
                return { data: { verdict } };
            }
            case 'compatibility.reprobe': {
                const reprobeParams = params;
                const probe = deps.probe(reprobeParams.teamSessionId, reprobeParams.trigger);
                return { data: { probe } };
            }
            default:
                throw new Error(`compatibility handler routed an unknown method: ${method}`);
        }
    };
}
//# sourceMappingURL=compatibility.js.map