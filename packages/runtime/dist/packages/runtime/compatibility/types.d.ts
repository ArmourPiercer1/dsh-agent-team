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
import type { CompatibilityStatus } from '../../domain/compatibility/src/index.js';
import type { CompatibilityStateRecord } from '../../storage/schema/index.js';
/** The five re-probe triggers of Development Plan §20.1 (closed vocabulary). */
export declare const PROBE_TRIGGERS: {
    /** The team root session cold-resumed after a process restart (§36.3). */
    readonly ROOT_COLD_RESUME: "ROOT_COLD_RESUME";
    /** A member cold-resumed (durable availability restored) after restart. */
    readonly MEMBER_COLD_RESUME: "MEMBER_COLD_RESUME";
    /** A new member activation is about to proceed. */
    readonly NEW_ACTIVATION: "NEW_ACTIVATION";
    /** A relevant capability's probe generation changed (even with unchanged
     *  availability — the generation is part of the probe record). */
    readonly CAPABILITY_GENERATION_CHANGE: "CAPABILITY_GENERATION_CHANGE";
    /** The durable compatibility generation is stale before new work is
     *  admitted (also covers the first-ever evaluation, where no
     *  generation exists yet). */
    readonly STALE_GENERATION_BEFORE_NEW_WORK: "STALE_GENERATION_BEFORE_NEW_WORK";
};
/** One of the five frozen re-probe triggers. */
export type ProbeTrigger = (typeof PROBE_TRIGGERS)[keyof typeof PROBE_TRIGGERS];
/** Every trigger value, for closed-set membership tests. */
export declare const PROBE_TRIGGER_VALUES: readonly ProbeTrigger[];
/**
 * The re-derived compatibility verdict of one durable-state replace
 * (frozen, plain lossless-JSON data): the provenance of the update plus
 * the re-derived compatibility verdict.
 */
export interface CompatibilityVerdict {
    /** The update time, ISO-8601 (from the injected clock). */
    readonly recordedAt: string;
    /** The compatibility generation the state replace established (starts at 1). */
    readonly generation: number;
    /** The environment fingerprint the verdict is bound to (§27.3). */
    readonly environmentFingerprint: string;
    /** The re-derived logical admission state (§28). */
    readonly status: CompatibilityStatus;
    /** Per-outcome counters of the re-derived verdict. */
    readonly pass: number;
    readonly warning: number;
    readonly fatal: number;
    /** WARNINGs without a VALID ack (MISSING or STALE) —these block admission. */
    readonly unackedWarning: number;
}
/**
 * The outcome of one probe generation: a verdict plus the trigger that
 * produced it (the five DevPlan §20.1 re-probe triggers).
 */
export interface ProbeOutcome extends CompatibilityVerdict {
    /** The trigger that produced this probe. */
    readonly trigger: ProbeTrigger;
}
/** One admitted (in-flight) work identity, tracked by the prober. */
export interface AdmittedWork {
    /** The prober-issued work identity (unique within the prober instance). */
    readonly workId: string;
    /** The caller's stable work key (idempotent admission identity). */
    readonly workKey: string;
    /** The admission time, ISO-8601 (from the injected clock). */
    readonly admittedAt: string;
    /** The compatibility generation the work was admitted under. */
    readonly admittedGeneration: number;
    /** The logical admission state at admission time (always non-blocking). */
    readonly admittedStatus: CompatibilityStatus;
}
/** The decision of one new-work admission attempt. */
export interface NewWorkDecision {
    /** Always `true` when this value is returned (blocking attempts throw). */
    readonly admitted: true;
    /** The work identity of the admitted in-flight work. */
    readonly workId: string;
    /** The logical admission state that admitted the work. */
    readonly status: CompatibilityStatus;
    /** The environment fingerprint the admission was made under. */
    readonly fingerprint: string;
    /** The compatibility generation the admission was made under. */
    readonly generation: number;
}
/** The record of an in-flight work settling (§28.2: always allowed). */
export interface SettleRecord {
    /** The work identity that settled. */
    readonly workId: string;
    /** The settle time, ISO-8601 (from the injected clock). */
    readonly settledAt: string;
    /** The generation the work was admitted under (its admission binding). */
    readonly admittedGeneration: number;
}
/** The drift kinds of one probe relative to the previous durable state. */
export declare const DRIFT_KINDS: {
    /** The environment fingerprint is unchanged (no capability drift). */
    readonly NONE: "NONE";
    /** The environment fingerprint changed —a capability drifted
     *  (availability or relevant probe generation, §20.1). */
    readonly ENVIRONMENT_DRIFT: "ENVIRONMENT_DRIFT";
    /** The fingerprint is unchanged but the previous state was missing
     *  (first probe / state removed): no drift to classify, recorded as
     *  the establishment of the generation line. */
    readonly ESTABLISHED: "ESTABLISHED";
};
/** One drift kind. */
export type DriftKind = (typeof DRIFT_KINDS)[keyof typeof DRIFT_KINDS];
/** One classified drift observation (frozen, plain JSON). */
export interface DriftObservation {
    readonly kind: DriftKind;
    /** The previous durable generation (`undefined` when the state was absent). */
    readonly previousGeneration?: number;
    /** The previous durable fingerprint (`undefined` when the state was absent). */
    readonly previousFingerprint?: string;
    /** The previous durable status (`undefined` when the state was absent). */
    readonly previousStatus?: CompatibilityStatus;
    readonly currentGeneration: number;
    readonly currentFingerprint: string;
    readonly currentStatus: CompatibilityStatus;
}
/** The acknowledgement input (bound to the CURRENT generation, §27.3). */
export interface AcknowledgeInput {
    /** The requirementId of the WARNING being acknowledged. */
    readonly requirementId: string;
    /** The human identity acknowledging (provenance, §14.3 E). */
    readonly acknowledgedBy: string;
    /** Optional free-text note. */
    readonly note?: string;
}
/**
 * The per-TeamSession compatibility prober (the P7-T1 public port).
 *
 * One prober owns one root session's compatibility generation line: it
 * probes (trigger-driven re-probes), records fingerprint-bound
 * acknowledgements, and enforces the §28 new-work gate. In-flight work is
 * tracked per prober instance (process lifetime — the documented boundary
 * of this module; durable crash-window reconciliation of in-flight work
 * belongs to the P4 operation journal).
 */
export interface CompatibilityProber {
    /** The root session id this prober owns. */
    readonly rootSessionId: string;
    /**
     * Run one probe under `trigger`: fresh environment facts → engine
     * evaluation (carrying the durable acks) → durable state replace
     * (generation + 1) → the classified {@link ProbeOutcome}.
     */
    probe(trigger: ProbeTrigger): Promise<ProbeOutcome>;
    /** The current durable compatibility state (or `undefined`). */
    current(): Promise<CompatibilityStateRecord | undefined>;
    /**
     * Acknowledge one WARNING of the CURRENT evaluation: the ack is bound
     * to the current mismatch + environment fingerprint (§27.3) and the
     * state is durably replaced with the ack appended (new generation).
     * FATAL is never ack-able (§27.2). Returns the re-derived verdict
     * (no trigger: an acknowledgement is a state update, not a probe).
     */
    acknowledge(input: AcknowledgeInput): Promise<CompatibilityVerdict>;
    /**
     * Admit one new work: freshness gate first (a stale/absent generation
     * forces a `STALE_GENERATION_BEFORE_NEW_WORK` re-probe), then the §28
     * gate — BLOCKED_WARNING / BLOCKED_FATAL throw `NEW_WORK_BLOCKED`;
     * OPEN / DEGRADED_ACKNOWLEDGED register the in-flight work and return
     * the decision.
     */
    admitNewWork(workKey: string): Promise<NewWorkDecision>;
    /**
     * Settle one admitted in-flight work. This path NEVER consults the
     * current compatibility state (§28.2: compatibility drift does not
     * cancel in-flight work) —it succeeds under any drift state.
     */
    settleWork(workId: string): Promise<SettleRecord>;
    /**
     * The throwing check-point form of the new-work gate (the
     * admission/compatibility gate slot the P6 admission pipeline
     * consumes). Throws `NEW_WORK_BLOCKED` when new work must not be
     * admitted; returns silently when admission is open.
     */
    enforceNewWorkAdmission(): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map