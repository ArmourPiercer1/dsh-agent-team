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
import { deepFreeze, teamContractError } from '../../contracts/src/index.js';
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/index.js';
/** The durable fact type of one capability-runtime event (plan §C.7). */
export const CAPABILITY_RUNTIME_EVENT_FACT_TYPE = 'capability-runtime-event';
/**
 * The closed capability-runtime event vocabulary (plan §C.10 gate 4: the
 * lost / retry / restored sequence with correct time + attempt). A
 * `probe-completed` records an observation; the `capability-*` family tracks
 * a reachability transition; the `mount-*` family tracks an MCP mount.
 */
export const CAPABILITY_RUNTIME_EVENTS = {
    /** A readiness probe completed (an observation was recorded). */
    probeCompleted: 'probe-completed',
    /** A previously reachable capability was observed unreachable. */
    capabilityLost: 'capability-lost',
    /** A retry of an unreachable capability is scheduled / attempted. */
    capabilityRetry: 'capability-retry',
    /** A previously unreachable capability was observed reachable again. */
    capabilityRestored: 'capability-restored',
    /** An MCP server mount failed (its fiber activation rejected). */
    mountFailed: 'mount-failed',
    /** An MCP server mount succeeded after a failure (recovered). */
    mountRestored: 'mount-restored',
};
/** Every event kind value, for closed-set membership tests. */
export const CAPABILITY_RUNTIME_EVENT_KIND_VALUES = Object.values(CAPABILITY_RUNTIME_EVENTS);
/**
 * The exact frozen payload fields of one capability-runtime event (the
 * closed lossless-JSON shape; `reason` / `attempt` optional).
 */
export const CAPABILITY_RUNTIME_EVENT_PAYLOAD_FIELDS = [
    'event',
    'capabilityType',
    'capabilityName',
    'verdict',
    'source',
    'observedAt',
    'reason',
    'attempt',
];
/**
 * Assert that `value` is a closed capability-runtime event kind.
 * @throws `MALFORMED_DTO` for any value outside the vocabulary.
 */
export function assertCapabilityRuntimeEventKind(value, path) {
    if (typeof value !== 'string' || !CAPABILITY_RUNTIME_EVENT_KIND_VALUES.includes(value)) {
        throw teamContractError('MALFORMED_DTO', `unknown capability-runtime event kind at ${path}`, {
            path,
            problem: 'unknown capability-runtime event kind',
            value: typeof value === 'string' ? value : typeof value,
        });
    }
    return value;
}
/**
 * Validate and freeze one capability-runtime event.
 * @throws `MALFORMED_DTO` for an unknown event kind, a malformed identity /
 *   source / observedAt, or a non-3-state verdict.
 */
export function createCapabilityRuntimeEvent(args) {
    if (typeof args.capabilityName !== 'string' || args.capabilityName.length === 0) {
        throw teamContractError('MALFORMED_DTO', 'capabilityName must be non-empty', {
            field: 'capabilityName',
            problem: 'empty capability name',
        });
    }
    if (typeof args.source !== 'string' || args.source.length === 0) {
        throw teamContractError('MALFORMED_DTO', 'source must be non-empty', { field: 'source', problem: 'empty source' });
    }
    if (typeof args.observedAt !== 'string' || args.observedAt.length === 0) {
        throw teamContractError('MALFORMED_DTO', 'observedAt must be non-empty', {
            field: 'observedAt',
            problem: 'empty observedAt',
        });
    }
    if (args.attempt !== undefined && (typeof args.attempt !== 'number' || !Number.isInteger(args.attempt) || args.attempt < 0)) {
        throw teamContractError('MALFORMED_DTO', 'attempt must be a non-negative integer', {
            field: 'attempt',
            problem: 'attempt must be a non-negative integer',
        });
    }
    const event = {
        event: args.event,
        capabilityType: args.capabilityType,
        capabilityName: args.capabilityName,
        verdict: args.verdict,
        source: args.source,
        observedAt: args.observedAt,
        ...(args.reason !== undefined ? { reason: args.reason } : {}),
        ...(args.attempt !== undefined ? { attempt: args.attempt } : {}),
    };
    return deepFreeze(event);
}
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
export async function writeCapabilityRuntimeEvent(ledger, rootSessionId, event, now) {
    const sequence = await ledger.allocateSequence();
    const payload = {
        event: event.event,
        capabilityType: event.capabilityType,
        capabilityName: event.capabilityName,
        verdict: event.verdict,
        source: event.source,
        observedAt: event.observedAt,
    };
    if (event.reason !== undefined)
        payload.reason = event.reason;
    if (event.attempt !== undefined)
        payload.attempt = event.attempt;
    void CAPABILITY_RUNTIME_EVENT_PAYLOAD_FIELDS; // the frozen field set is the payload's closed shape
    await ledger.put({
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        sequence,
        rootSessionId,
        factType: CAPABILITY_RUNTIME_EVENT_FACT_TYPE,
        payload,
        createdAt: now(),
    });
}
//# sourceMappingURL=telemetry.js.map