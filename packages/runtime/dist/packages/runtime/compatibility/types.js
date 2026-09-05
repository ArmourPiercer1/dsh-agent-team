/**
 * P7-T1 — types and closed vocabularies of the runtime compatibility
 * module (probe generation, warning ACK fingerprint, capability drift →
 * new work admission).
 *
 * Frozen semantics (verbatim authorities):
 *
 * - Development Plan §20.1 — the five re-probe triggers
 *   (Root cold resume / Member cold resume / new activation / relevant
 *   capability generation change / stale compatibility generation before
 *   new work); a new warning **blocks NEW work**; already admitted work
 *   **may settle**.
 * - Architecture §27.2/§27.3 — PASS/WARNING/FATAL; acknowledgement bound
 *   to the specific mismatch + environment generation (never a permanent
 *   "ignore all warnings" flag); FATAL is never ack-able.
 * - Architecture §28 — the logical Admission State
 *   (OPEN / BLOCKED_WARNING / BLOCKED_FATAL / DEGRADED_ACKNOWLEDGED;
 *   semantics fixed, enum names implementation-adjustable); §28.1 the
 *   gate scope; §28.2 drift does NOT roll back in-flight work.
 * - Architecture §36.3 — cold resume re-probes; resume 后必须重新评估
 *   compatibility/effective policy.
 * - Architecture §41.7 — the drift scenario: capability disappears →
 *   generation changes → new admission BLOCKED → already admitted work
 *   may settle → repair or ack → new admission reopens.
 * - Architecture §14.3 E — the compatibility record carries the
 *   current facts/fingerprint, the warning acknowledgement, its
 *   provenance, and the staleness/generation.
 *
 * This module classifies and gates: it never starts, admits, or cancels
 * any model/tool operation by itself (the gate is the §28.1/§28.3
 * check-point the admission pipeline consumes).
 *
 * Pure-ish runtime module: no node: builtins, no upstream imports;
 * I/O only through the injected TeamDomain repositories + fact port.
 * @module @dsh-agent-team/runtime/compatibility/types
 */
// --- the five re-probe triggers (DevPlan §20.1, closed) ----------------------
/** The five re-probe triggers of Development Plan §20.1 (closed vocabulary). */
export const PROBE_TRIGGERS = {
    /** The team root session cold-resumed after a process restart (§36.3). */
    ROOT_COLD_RESUME: 'ROOT_COLD_RESUME',
    /** A member cold-resumed (durable availability restored) after restart. */
    MEMBER_COLD_RESUME: 'MEMBER_COLD_RESUME',
    /** A new member activation is about to proceed. */
    NEW_ACTIVATION: 'NEW_ACTIVATION',
    /** A relevant capability's probe generation changed (even with unchanged
     *  availability — the generation is part of the probe record). */
    CAPABILITY_GENERATION_CHANGE: 'CAPABILITY_GENERATION_CHANGE',
    /** The durable compatibility generation is stale before new work is
     *  admitted (also covers the first-ever evaluation, where no
     *  generation exists yet). */
    STALE_GENERATION_BEFORE_NEW_WORK: 'STALE_GENERATION_BEFORE_NEW_WORK',
};
/** Every trigger value, for closed-set membership tests. */
export const PROBE_TRIGGER_VALUES = Object.values(PROBE_TRIGGERS);
// --- drift classification ------------------------------------------------------
/** The drift kinds of one probe relative to the previous durable state. */
export const DRIFT_KINDS = {
    /** The environment fingerprint is unchanged (no capability drift). */
    NONE: 'NONE',
    /** The environment fingerprint changed —a capability drifted
     *  (availability or relevant probe generation, §20.1). */
    ENVIRONMENT_DRIFT: 'ENVIRONMENT_DRIFT',
    /** The fingerprint is unchanged but the previous state was missing
     *  (first probe / state removed): no drift to classify, recorded as
     *  the establishment of the generation line. */
    ESTABLISHED: 'ESTABLISHED',
};
//# sourceMappingURL=types.js.map