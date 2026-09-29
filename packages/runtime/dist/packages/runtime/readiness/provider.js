/**
 * pre-alpha3 PR-C — the CapabilityReadinessProvider (plan §C.4): the SINGLE
 * live-readiness probe surface.
 *
 * The provider answers `probe(capabilityType, name)` with the 3-state
 * verdict (`unknown | reachable | unreachable`) plus the observation
 * provenance (`source`, `observedAt`, `reason`). It is the single place the
 * four historical fact sources (plan §C.1) get unified into one live
 * observation: instead of the UI-asserted preset id, the static row
 * `environmentFacts`, the actual-mount id, and the hardcoded persona
 * substrate each feeding a different consumer, every consumer (preflight,
 * the compatibility engine, the unified runtime status, the UI projection)
 * reads ONE probe result.
 *
 * **Fail-soft contract** (plan §C.10 gate 3): a probe that CANNOT run — no
 * port registered for the capability type, or the port rejects — resolves to
 * `unknown` (the capability has not been observed), never to `unreachable`
 * and never a throw. A fresh boot / restart therefore re-probes instead of
 * assuming the capability is down. A probe that RUNS and observes the
 * capability not-live resolves to `unreachable`.
 *
 * The provider is PURE over its injected ports: each capability type is
 * probed by a port the caller registers (the live MCP fiber state, the
 * model-state view, the runtime substrate resolver, ...). No I/O, no clock,
 * no `node:` builtins here — the ports are the I/O boundary.
 * @module @dsh-agent-team/runtime/readiness/provider
 */
import { createCapabilityObservation, PROBE_VERDICTS, } from './types.js';
import { READINESS_ERROR_CODES } from './errors.js';
/**
 * Create one capability readiness provider over the injected ports.
 * @param ports - the per-type probe ports + the clock.
 * @returns the provider surface.
 */
export function createCapabilityReadinessProvider(ports) {
    return {
        async probe(capabilityType, name) {
            const port = ports.probes[capabilityType];
            let verdict;
            let reason;
            if (port === undefined) {
                // No probe registered for this capability type: the capability has
                // NOT been observed → unknown (fail-soft, re-probable). Never
                // unreachable (that means "a probe observed it down").
                verdict = PROBE_VERDICTS.unknown;
                reason = `${READINESS_ERROR_CODES.NO_PROBE_PORT}: no probe port for capability type '${capabilityType}'`;
            }
            else {
                try {
                    const result = await port.probe(name);
                    if (typeof result === 'string') {
                        verdict = result;
                    }
                    else {
                        // F15 (plan §6): the port carried a plugin-owned reason
                        // (provenance — the observation's `reason` field, never a
                        // fingerprint input; the domain stays 3-state).
                        verdict = result.verdict;
                        if (result.reason !== undefined)
                            reason = result.reason;
                    }
                }
                catch (error) {
                    // The probe ran but rejected: a typed probe failure → unknown
                    // (fail-soft, re-probable) carrying the message as the reason.
                    verdict = PROBE_VERDICTS.unknown;
                    reason = `${READINESS_ERROR_CODES.PROBE_REJECTED}: ${error instanceof Error ? error.message : String(error)}`;
                }
            }
            return createCapabilityObservation({
                capabilityType,
                capabilityName: name,
                verdict,
                source: port?.source ?? 'readiness',
                observedAt: ports.now(),
                reason,
            });
        },
    };
}
//# sourceMappingURL=provider.js.map