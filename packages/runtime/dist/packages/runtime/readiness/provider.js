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
 * **The observation state of an unsettled verdict** (the PF-2 tri-state,
 * 2026-09-30 — parent adjudication option A): a port MAY return a structured
 * {@link CapabilityProbeOutcome} whose `unknown` carries the
 * `observationState` — `in-flight` (a pending materialization slot exists on
 * a live session — the B5 transient window; the typed PENDING stands) or
 * `never-observed` (no fiber / pending slot / failed slot on ANY live
 * session — the structurally not-yet-applicable first-create bootstrap
 * window where the bootstrap seed's truth decides — C.2/E.6; the exemption
 * is NOT a blanket OPEN). A bare verdict, or an `unknown` without the state,
 * defaults to `in-flight`: the exemption is OBSERVED, never inferred
 * (fail-closed — a malformed structured outcome degrades to the fail-soft
 * `unknown` and can never grant the exemption).
 *
 * The provider is PURE over its injected ports: each capability type is
 * probed by a port the caller registers (the live MCP fiber state, the
 * model-state view, the runtime substrate resolver, ...). No I/O, no clock,
 * no `node:` builtins here — the ports are the I/O boundary.
 * @module @dsh-agent-team/runtime/readiness/provider
 */
import { assertObservationState, assertProbeVerdict, createCapabilityObservation, PROBE_VERDICTS, } from './types.js';
import { READINESS_ERROR_CODES } from './errors.js';
import { teamContractError } from '../../contracts/src/index.js';
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
            // The observation state of an unsettled verdict (the PF-2 tri-state —
            // the port's structured outcome; a bare verdict leaves it absent =
            // in-flight, the conservative default).
            let observationState;
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
                        verdict = assertProbeVerdict(result, 'probe result');
                    }
                    else {
                        verdict = assertProbeVerdict(result.verdict, 'probe result.verdict');
                        if (result.observationState !== undefined) {
                            if (verdict !== PROBE_VERDICTS.unknown) {
                                throw teamContractError('MALFORMED_DTO', 'observationState is only defined for the unknown verdict at probe result.observationState', { path: 'probe result.observationState', problem: 'observationState with a settled verdict' });
                            }
                            observationState = assertObservationState(result.observationState, 'probe result.observationState');
                        }
                    }
                }
                catch (error) {
                    // The probe ran but rejected: a typed probe failure → unknown
                    // (fail-soft, re-probable) carrying the message as the reason.
                    verdict = PROBE_VERDICTS.unknown;
                    observationState = undefined;
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
                observationState,
            });
        },
        hasProbe(capabilityType) {
            // The single source of truth for probeability: the probe-port
            // registry itself (the D-3 narrowing, 2026-09-30 — parent
            // adjudication option 1). Consumers (the requirement-facts
            // classifier and the s6 probe drop-filter) both read this structural
            // fact through the observations the requirement-facts provider
            // produces — no duplicated type lists anywhere downstream.
            return ports.probes[capabilityType] !== undefined;
        },
    };
}
//# sourceMappingURL=provider.js.map