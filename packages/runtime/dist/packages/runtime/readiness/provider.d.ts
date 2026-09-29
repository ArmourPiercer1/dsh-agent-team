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
import { type CapabilityObservation, type CapabilityType, type ProbeVerdict } from './types.js';
/**
 * One per-capability-type probe port. The port observes the live substrate
 * for one named capability and returns the 3-state verdict (synchronously or
 * asynchronously). A port that CANNOT observe (service absent, preset
 * unreadable, conditional disable not evaluatable) SHOULD reject — the
 * provider maps the rejection to `unknown` (fail-soft, re-probable).
 */
/**
 * A probe verdict carrying an optional plugin-owned diagnostic reason
 * (F15, plan §6: the MCP production probe port carries its plugin-owned
 * evidence codes — e.g. `MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN` — into the
 * observation provenance). The domain stays 3-state: only `verdict`
 * participates in the vocabulary; `reason` is provenance (never a
 * fingerprint input), exactly like the rejection-derived reason.
 */
export interface ProbeVerdictDetail {
    readonly verdict: ProbeVerdict;
    readonly reason?: string;
}
export interface CapabilityProbePort {
    /** The observation source this port produces (provenance). */
    readonly source: string;
    /**
     * Observe one named capability. Resolves to `reachable` (live) or
     * `unreachable` (observed down) — either as a bare verdict or as a
     * {@link ProbeVerdictDetail} carrying the plugin-owned reason. MAY
     * reject (a typed probe failure — the provider resolves the rejection
     * to `unknown` with the message as reason).
     */
    probe(name: string): ProbeVerdict | ProbeVerdictDetail | Promise<ProbeVerdict | ProbeVerdictDetail>;
}
/** The injected ports of the readiness provider. */
export interface ReadinessProviderPorts {
    /** The per-capability-type probe ports (a type with no port → `unknown`). */
    readonly probes: Partial<Record<CapabilityType, CapabilityProbePort>>;
    /** The ISO-8601 clock for the observation `observedAt` (never a token input). */
    readonly now: () => string;
}
/** The public capability readiness probe surface (plan §C.4). */
export interface CapabilityReadinessProvider {
    /**
     * Observe one named capability. Fail-soft: a missing port or a port
     * rejection resolves to `unknown` (with the reason), never a throw.
     */
    probe(capabilityType: CapabilityType, name: string): Promise<CapabilityObservation>;
}
/**
 * Create one capability readiness provider over the injected ports.
 * @param ports - the per-type probe ports + the clock.
 * @returns the provider surface.
 */
export declare function createCapabilityReadinessProvider(ports: ReadinessProviderPorts): CapabilityReadinessProvider;
//# sourceMappingURL=provider.d.ts.map