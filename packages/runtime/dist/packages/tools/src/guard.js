/**
 * P6-T6 — the last-mile guard consult (the P6-T4 `TOOL_GUARD` seam wired by
 * the tool layer, Development Plan §15).
 *
 * SD-GUARD (recorded scoping decision): the team tool layer hosts BOTH
 * controlled and uncontrolled operations, so the guard is consulted —
 * immediately before execution, under the control service's per-team lock,
 * with NO tool-layer caching — for every guarded work operation:
 *
 * - `allowed: true` -> proceed. The guard CONSUMED the durable allow
 *   (check-and-reserve; exactly-once), so the operation runs exactly once.
 * - `no-request`    -> proceed. No durable control request exists for this
 *   exact scope, so the control plane has no pending gate for it: the
 *   operation falls through to the runtime facade, which still enforces
 *   caller identity, authority, envelope, and quota. This is a documented
 *   deviation from the P6-T4 fake pipeline's blanket block — that pipeline
 *   models a SINGLE guarded operation, while the tool layer hosts the whole
 *   team surface (the leader's ordinary autonomy path must stay open).
 * - every other reason (`request-pending` / `decision-deny` /
 *   `request-stale` / `allow-consumed` / `scope-mismatch` /
 *   `target-stale`) -> fail closed: the blocked result is returned, the
 *   runtime is NEVER called, and there are zero side effects.
 *
 * The control service remains the SOLE authority on approval state: the
 * tool layer adds no second check, no second cache, and no bypass.
 *
 * SD-GUARD-NS (recorded scoping decision): the guard scope key is the
 * instance-identity namespace — `guardOperation` parses targetInstanceId
 * with the contracts instance-id rule and throws CONTROL_GUARD_MALFORMED
 * for anything else. The caller (tools.ts) therefore consults ONLY for
 * well-formed instance ids; tokens outside the namespace (labels,
 * template ids) are the runtime's addressing domain and pass through to
 * the delegate, whose instance-addressed resolution live-rejects them
 * (ACTION_ADDRESSING_REJECTED, G6 E2) without executing.
 *
 * @module @dsh-agent-team/tools/guard
 */
import { CONTROL_GUARD_BLOCK_REASONS, } from '../../runtime/control/index.js';
/**
 * Consult the control service's last-mile guard for one operation scope
 * (SD-GUARD semantics, see the module docs).
 *
 * @param controlService - the durable control plane service.
 * @param scope - the EXACT operation scope (root, target instance, action,
 *   tool name, the caller's correlation token).
 * @returns proceed or the closed block verdict (never throws for a
 *   policy outcome — malformed scopes surface as the service's typed
 *   errors, which the tool layer maps to rejected results).
 */
export async function consultGuard(controlService, scope) {
    const verdict = await controlService.guardOperation(scope);
    if (verdict.allowed) {
        return { proceed: true };
    }
    if (verdict.reason === CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST) {
        return { proceed: true };
    }
    return {
        proceed: false,
        reason: verdict.reason,
        ...(verdict.requestId !== undefined ? { requestId: verdict.requestId } : {}),
        ...(verdict.decisionSequence !== undefined
            ? { decisionSequence: verdict.decisionSequence }
            : {}),
    };
}
//# sourceMappingURL=guard.js.map