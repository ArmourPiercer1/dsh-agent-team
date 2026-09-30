/**
 * pre-alpha3 PR-C — the capability readiness package (plan §C.4/§C.7).
 *
 * The public surface of the readiness module: the 3-state capability probe
 * (provider + observation types), the ephemeral observation registry (the
 * live, non-persisted per-team cache), and the durable capability-runtime
 * telemetry writer (the `capability-runtime-event` ledger fact, plan §C.7).
 *
 * This is the package index — the only place a consumer imports the readiness
 * surface from (`@dsh-agent-team/runtime/readiness`), the same single-barrel
 * convention the sibling runtime modules (effective-policy, compatibility)
 * follow.
 * @module @dsh-agent-team/runtime/readiness
 */
export { capabilityKey, createCapabilityObservation, OBSERVATION_SOURCES, OBSERVATION_STATES, OBSERVATION_STATE_VALUES, parseCapabilityObservation, PROBE_VERDICTS, PROBE_VERDICT_VALUES, assertObservationState, assertProbeVerdict, } from './types.js';
export { READINESS_ERROR_CODES, READINESS_ERROR_CODE_VALUES, } from './errors.js';
export { createCapabilityReadinessProvider, } from './provider.js';
export { createCapabilityObservationRegistry, } from './registry.js';
export { CAPABILITY_RUNTIME_EVENT_FACT_TYPE, CAPABILITY_RUNTIME_EVENT_KIND_VALUES, CAPABILITY_RUNTIME_EVENT_PAYLOAD_FIELDS, CAPABILITY_RUNTIME_EVENTS, assertCapabilityRuntimeEventKind, createCapabilityRuntimeEvent, writeCapabilityRuntimeEvent, } from './telemetry.js';
export { MATERIALIZATION_STATES, MATERIALIZATION_STATE_VALUES, MEMBER_LIVENESS, POLICY_AXIS, SUPPLY_AXIS, deriveMaterializationStatus, } from './status.js';
//# sourceMappingURL=index.js.map