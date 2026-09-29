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
export { capabilityKey, createCapabilityObservation, OBSERVATION_SOURCES, parseCapabilityObservation, PROBE_VERDICTS, PROBE_VERDICT_VALUES, assertProbeVerdict, type CapabilityIdentity, type CapabilityObservation, type CapabilityType, type ObservationSource, type ProbeVerdict, } from './types.js';
export { READINESS_ERROR_CODES, READINESS_ERROR_CODE_VALUES, type ReadinessErrorCode, } from './errors.js';
export { createCapabilityReadinessProvider, type CapabilityProbePort, type CapabilityReadinessProvider, type ProbeVerdictDetail, type ReadinessProviderPorts, } from './provider.js';
export { createCapabilityObservationRegistry, type CapabilityObservationRegistry, } from './registry.js';
export { CAPABILITY_RUNTIME_EVENT_FACT_TYPE, CAPABILITY_RUNTIME_EVENT_KIND_VALUES, CAPABILITY_RUNTIME_EVENT_PAYLOAD_FIELDS, CAPABILITY_RUNTIME_EVENTS, assertCapabilityRuntimeEventKind, createCapabilityRuntimeEvent, writeCapabilityRuntimeEvent, type CapabilityRuntimeEvent, type CapabilityRuntimeEventKind, } from './telemetry.js';
export { MATERIALIZATION_STATES, MATERIALIZATION_STATE_VALUES, MEMBER_LIVENESS, POLICY_AXIS, SUPPLY_AXIS, deriveMaterializationStatus, type MaterializationSlot, type MaterializationStatus, type MemberLiveness, type PolicyAxis, type RuntimeCapabilityStatus, type SupplyAxis, } from './status.js';
//# sourceMappingURL=index.d.ts.map