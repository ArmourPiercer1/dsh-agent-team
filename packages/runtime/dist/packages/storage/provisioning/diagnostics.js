/**
 * Provisioning diagnostics — the closed v1 diagnostic vocabulary of the
 * durable provisioning state machine (TaskDoc §11.5 P4-T4).
 *
 * Diagnostics are RESULTS, not errors: the coordinator reads durable
 * TeamDomain state and reports what it finds, with a STABLE CODE consumers
 * branch on (never on message text — the same discipline as
 * `TeamDomainError`, `TeamContractError`, and the P4-T3 binding
 * diagnostics). Every field is remote-safe (lossless JSON), asserted at
 * construction.
 *
 * The vocabulary is minimal and closed (v1):
 *
 * - `ORPHANED_CHILD_SESSION` — a child session was durably created/recorded
 *   for a member whose provisioning did NOT reach `INSTANCE_COMMITTED`
 *   (Development Plan §17.4 "no committed MemberInstance + diagnosable
 *   orphan"; Architecture §18.3). The `context` names the exact missing
 *   piece (`record` / `binding` / `commit`) and the `stage` where the
 *   provisioning stalled, so the orphan is diagnosable — never a silent
 *   loss.
 * - `MEMBER_NOT_PROVISIONED` — a lookup for a member identity found no
 *   durable provisioning state at all (no operation row): NOT an orphan
 *   (nothing was created), just absent. Kept as a distinct code so callers
 *   never confuse "nothing happened" with "something is stuck".
 *
 * Pure module: no I/O, no repository access.
 * @module @dsh-agent-team/storage/provisioning/diagnostics
 */
import { assertRemoteSafeJsonValue, deepFreeze } from '../../contracts/src/index.js';
/**
 * The closed set of v1 provisioning diagnostic codes.
 */
export const PROVISIONING_DIAGNOSTIC_CODES = {
    /**
     * A child session is durably recorded for a member whose provisioning did
     * not reach `INSTANCE_COMMITTED`: the Diagnosable Orphan of Development
     * Plan §17.4.
     */
    ORPHANED_CHILD_SESSION: 'orphaned-child-session',
    /** No durable provisioning state exists for the member (nothing created). */
    MEMBER_NOT_PROVISIONED: 'member-not-provisioned',
};
/** Every v1 diagnostic-code value, for membership checks and closed-set tests. */
export const PROVISIONING_DIAGNOSTIC_CODE_VALUES = Object.values(PROVISIONING_DIAGNOSTIC_CODES);
/** Is `value` one of the closed v1 diagnostic codes? */
export function isProvisioningDiagnosticCode(value) {
    return typeof value === 'string' && PROVISIONING_DIAGNOSTIC_CODE_VALUES.includes(value);
}
/**
 * Build one frozen provisioning diagnostic. `message` is REQUIRED and
 * `context` (when present) is asserted remote-safe; the result is
 * deep-frozen.
 */
export function createProvisioningDiagnostic(code, rootSessionId, instanceId, stage, message, extra = {}) {
    if (extra.context !== undefined) {
        assertRemoteSafeJsonValue(extra.context);
    }
    const diagnostic = {
        code,
        rootSessionId,
        instanceId,
        stage,
        message,
        ...(extra.operationId !== undefined ? { operationId: extra.operationId } : {}),
        ...(extra.childSessionId !== undefined ? { childSessionId: extra.childSessionId } : {}),
        ...(extra.context !== undefined ? { context: extra.context } : {}),
    };
    return deepFreeze(diagnostic);
}
//# sourceMappingURL=diagnostics.js.map