/**
 * pre-alpha3 PR-C — the durable capability-runtime telemetry (plan §C.7):
 * the `capability-runtime-event` ledger fact type + its writer.
 *
 * The `capability-runtime-event` fact is the DURABLE record of a capability
 * readiness transition (a probe completed, a capability was lost / retried /
 * restored, an MCP mount failed / restored). It lands in the TeamLedger under
 * the FROZEN `compatibility` category (the category already exists — PR-C is
 * its first production writer; the closed 8-shape is unchanged). Writing
 * through `ledger.put` advances `durableGeneration` automatically (the
 * storage S1-A hook), so plan §C.10 gate 5 ("durableGeneration advances per
 * fact") is structurally satisfied.
 *
 * The event vocabulary is runtime-owned (mirrored on the client, the same
 * pattern as every other fact type) — contracts deliberately carries no
 * fact-type vocabulary. The closed payload is lossless JSON; the `reason` /
 * `observedAt` / `source` are provenance (never a fingerprint input).
 *
 * Pure module: no I/O beyond the injected `ledger` port (allocateSequence +
 * put) and the injected clock; no `node:` builtins.
 * @module @dsh-agent-team/runtime/readiness/telemetry
 */
import type { ProbeVerdict } from './types.js';
/** The durable fact type of one capability-runtime event (plan §C.7). */
export declare const CAPABILITY_RUNTIME_EVENT_FACT_TYPE = "capability-runtime-event";
/**
 * The closed capability-runtime event vocabulary (plan §C.10 gate 4: the
 * lost / retry / restored sequence with correct time + attempt). A
 * `probe-completed` records an observation; the `capability-*` family tracks
 * a reachability transition; the `mount-*` family tracks an MCP mount.
 */
export declare const CAPABILITY_RUNTIME_EVENTS: {
    /** A readiness probe completed (an observation was recorded). */
    readonly probeCompleted: "probe-completed";
    /** A previously reachable capability was observed unreachable. */
    readonly capabilityLost: "capability-lost";
    /** A retry of an unreachable capability is scheduled / attempted. */
    readonly capabilityRetry: "capability-retry";
    /** A previously unreachable capability was observed reachable again. */
    readonly capabilityRestored: "capability-restored";
    /** An MCP server mount failed (its fiber activation rejected). */
    readonly mountFailed: "mount-failed";
    /** An MCP server mount succeeded after a failure (recovered). */
    readonly mountRestored: "mount-restored";
};
/** One of the closed capability-runtime event kinds. */
export type CapabilityRuntimeEventKind = (typeof CAPABILITY_RUNTIME_EVENTS)[keyof typeof CAPABILITY_RUNTIME_EVENTS];
/** Every event kind value, for closed-set membership tests. */
export declare const CAPABILITY_RUNTIME_EVENT_KIND_VALUES: readonly string[];
/**
 * The exact frozen payload fields of one capability-runtime event (the
 * closed lossless-JSON shape; `reason` / `attempt` optional).
 */
export declare const CAPABILITY_RUNTIME_EVENT_PAYLOAD_FIELDS: readonly string[];
/** One durable capability-runtime event (the closed ledger payload). */
export interface CapabilityRuntimeEvent {
    /** The closed event kind. */
    readonly event: CapabilityRuntimeEventKind;
    /** The capability kind (the closed §27.1 vocabulary). */
    readonly capabilityType: string;
    /** The named capability. */
    readonly capabilityName: string;
    /** The 3-state verdict at the time of the event. */
    readonly verdict: ProbeVerdict;
    /** The seam that produced the observation. */
    readonly source: string;
    /** The event time, ISO-8601 (provenance; never a token input). */
    readonly observedAt: string;
    /** Optional structured diagnostic. */
    readonly reason?: string;
    /** Optional attempt count (the retry family carries the attempt). */
    readonly attempt?: number;
}
/**
 * Assert that `value` is a closed capability-runtime event kind.
 * @throws `MALFORMED_DTO` for any value outside the vocabulary.
 */
export declare function assertCapabilityRuntimeEventKind(value: unknown, path: string): CapabilityRuntimeEventKind;
/**
 * Validate and freeze one capability-runtime event.
 * @throws `MALFORMED_DTO` for an unknown event kind, a malformed identity /
 *   source / observedAt, or a non-3-state verdict.
 */
export declare function createCapabilityRuntimeEvent(args: {
    readonly event: CapabilityRuntimeEventKind;
    readonly capabilityType: string;
    readonly capabilityName: string;
    readonly verdict: ProbeVerdict;
    readonly source: string;
    readonly observedAt: string;
    readonly reason?: string;
    readonly attempt?: number;
}): CapabilityRuntimeEvent;
/**
 * Durably write ONE capability-runtime event (one `ledger` fact row) — the
 * plan §C.7 writer. Mirrors the `writePolicyStateTransitionRow` shape:
 * `allocateSequence` (atomic on the domain write chain — the allocation
 * order is the event order) then `put` (idempotent on identical bytes; a
 * replayed write never appends twice). Writing through `put` advances
 * `durableGeneration` (the storage S1-A hook). A failure PROPAGATES to the
 * caller (no silent drop).
 * @param ledger - the OPENED TeamDomain `ledger` repository (allocate + put).
 * @param rootSessionId - the root the row is stamped with.
 * @param event - the closed event payload.
 * @param now - the production ISO-8601 clock (`createdAt` stamp).
 */
export declare function writeCapabilityRuntimeEvent(ledger: {
    allocateSequence(): Promise<number>;
    put(entry: Record<string, unknown>): Promise<unknown>;
}, rootSessionId: string, event: CapabilityRuntimeEvent, now: () => string): Promise<void>;
//# sourceMappingURL=telemetry.d.ts.map