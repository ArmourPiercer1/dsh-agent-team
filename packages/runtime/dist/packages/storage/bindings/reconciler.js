/**
 * TeamBindingReconciler — bidirectional SessionBinding integrity over the
 * durable TeamDomain stores (TaskDoc §11.5 P4-T3; Architecture §15.3).
 *
 * The check is the frozen bidirectional pair:
 *
 * ```text
 * MemberInstance.childSessionId
 *   <->
 * SessionBinding(childSessionId -> rootSessionId, instanceId)
 * ```
 *
 * plus the root pair (TeamSession record <-> `team-root` binding row) and
 * the child-session uniqueness claim (invariant 23: a child session is
 * never shared between members).
 *
 * Semantics, per the frozen docs:
 *
 * - **Read-only**: the reconciler only reads stored records and produces
 *   typed diagnostics; it never rewrites, deletes, or "fixes" anything.
 *   When TeamDomain is self-contradictory the correct behavior is to
 *   **fail closed for new Team work** and **not guess which side is more
 *   likely right** (Architecture §15.3). Convergence is driven by the
 *   diagnostics (Development Plan §17.3 "roll forward / reconcile",
 *   §17.4 "no committed MemberInstance + diagnosable orphan").
 * - **Per-team scope**: one report per team root session id — the unit a
 *   cold hydration (Architecture §36.1) or a fork reconciliation
 *   (Architecture §35.2/§35.3) reconciles. A scope root with no team
 *   artifacts at all yields a trivially consistent empty report (an
 *   ordinary fork simply has no team to reconcile).
 * - **Deterministic**: diagnostics are sorted by
 *   (code, sessionId, instanceId); identical stored state always yields
 *   an identical report (byte-stable for evidence comparison).
 *
 * Diagnostic direction naming (see `diagnostics.ts`):
 *
 * - backward direction broken (record without binding) →
 *   `missing-member-binding` (the "missing child" crash window);
 * - forward direction broken (binding without record) →
 *   `orphan-member-binding` (the "diagnosable orphan");
 * - both sides present but disagreeing on the child →
 *   `member-child-mismatch`;
 * - the child bound under the wrong root / instance / kind →
 *   `child-bound-to-other-root` / `child-bound-to-other-instance` /
 *   `binding-kind-conflict`;
 * - one child claimed by several records → `duplicate-child-claim`;
 * - root-level wrong root: artifacts under a root without a TeamSession →
 *   `team-session-missing`; TeamSession without its root binding →
 *   `missing-root-binding`; root bound with the wrong kind →
 *   `root-binding-kind-conflict`.
 *
 * Durable state only: no live Agent, no DSH runtime call, no side effect
 * outside the injected repositories.
 *
 * @module @dsh-agent-team/storage/bindings/reconciler
 */
import { parseRootSessionId, SESSION_BINDING_KINDS } from '../../contracts/src/index.js';
import { normalizeValidationError } from '../schema/index.js';
import { BINDING_DIAGNOSTIC_CODES, createBindingDiagnostic, } from './diagnostics.js';
/** The store whose key-space the reconciliation reads from. */
const BINDING_STORE = 'session_bindings';
/**
 * Compare two diagnostics in the canonical report order.
 */
function compareDiagnostics(a, b) {
    if (a.code !== b.code)
        return a.code < b.code ? -1 : 1;
    const aSession = a.sessionId ?? '';
    const bSession = b.sessionId ?? '';
    if (aSession !== bSession)
        return aSession < bSession ? -1 : 1;
    const aInstance = a.instanceId ?? '';
    const bInstance = b.instanceId ?? '';
    if (aInstance !== bInstance)
        return aInstance < bInstance ? -1 : 1;
    return 0;
}
/**
 * Reconcile the SessionBinding integrity of one team (one root session).
 *
 * Pure read: throws only for malformed input ids or malformed/non-
 * canonical stored rows (the repository-layer `RECORD_INVALID` /
 * `SEAM_FAILURE` classification passes through unchanged).
 *
 * @param repositories - the open TeamDomain repositories (injected).
 * @param rootSessionId - the team root session id to reconcile.
 * @returns the frozen, deterministic reconciliation report.
 * @throws `RECORD_INVALID` (contracts code preserved) for a malformed root
 *   session id; the repository errors for malformed stored rows.
 */
export function reconcileTeamBindings(repositories, rootSessionId) {
    let root;
    try {
        root = String(parseRootSessionId(rootSessionId));
    }
    catch (error) {
        throw normalizeValidationError(error, BINDING_STORE, rootSessionId);
    }
    const teamSession = repositories.teamSessions.get(root);
    const rootBinding = repositories.sessionBindings.get(root);
    const members = repositories.memberInstances.list(root);
    const memberBindings = repositories.sessionBindings
        .listByKind(SESSION_BINDING_KINDS.TEAM_MEMBER)
        .filter((binding) => binding.kind === 'team-member' && binding.rootSessionId === root);
    const diagnostics = [];
    // --- root pair: TeamSession record <-> team-root binding ---------------
    if (teamSession !== undefined) {
        if (rootBinding === undefined) {
            diagnostics.push(createBindingDiagnostic(BINDING_DIAGNOSTIC_CODES.MISSING_ROOT_BINDING, root, `TeamSession '${root}' exists but its root session has no team-root binding row`, { sessionId: root }));
        }
        else if (rootBinding.kind !== SESSION_BINDING_KINDS.TEAM_ROOT) {
            diagnostics.push(createBindingDiagnostic(BINDING_DIAGNOSTIC_CODES.ROOT_BINDING_KIND_CONFLICT, root, `team root session '${root}' is bound as kind '${rootBinding.kind}', not team-root`, { sessionId: root, context: { foundKind: rootBinding.kind } }));
        }
    }
    else if ((rootBinding !== undefined && rootBinding.kind === SESSION_BINDING_KINDS.TEAM_ROOT) ||
        members.length > 0 ||
        memberBindings.length > 0) {
        diagnostics.push(createBindingDiagnostic(BINDING_DIAGNOSTIC_CODES.TEAM_SESSION_MISSING, root, `root session '${root}' carries team artifacts but has no TeamSession record; bindings claiming this root reference a wrong root`, {
            sessionId: root,
            context: {
                rootBinding: rootBinding !== undefined && rootBinding.kind === SESSION_BINDING_KINDS.TEAM_ROOT,
                memberRecords: members.length,
                memberBindings: memberBindings.length,
            },
        }));
    }
    // --- backward direction: every member record -> its child binding ------
    for (const member of members) {
        const child = String(member.childSessionId);
        const binding = repositories.sessionBindings.get(child);
        if (binding === undefined) {
            diagnostics.push(createBindingDiagnostic(BINDING_DIAGNOSTIC_CODES.MISSING_MEMBER_BINDING, root, `MemberInstance ('${root}', '${String(member.instanceId)}') has child session '${child}' with no binding row`, { sessionId: child, instanceId: String(member.instanceId) }));
        }
        else if (binding.kind === SESSION_BINDING_KINDS.TEAM_MEMBER) {
            if (binding.rootSessionId !== root) {
                diagnostics.push(createBindingDiagnostic(BINDING_DIAGNOSTIC_CODES.CHILD_BOUND_TO_OTHER_ROOT, root, `child session '${child}' of member ('${root}', '${String(member.instanceId)}') is bound to team '${binding.rootSessionId}'`, {
                    sessionId: child,
                    instanceId: String(member.instanceId),
                    context: { boundRootSessionId: binding.rootSessionId, boundInstanceId: String(binding.instanceId) },
                }));
            }
            else if (binding.instanceId !== member.instanceId) {
                diagnostics.push(createBindingDiagnostic(BINDING_DIAGNOSTIC_CODES.CHILD_BOUND_TO_OTHER_INSTANCE, root, `child session '${child}' of member ('${root}', '${String(member.instanceId)}') is bound to instance '${String(binding.instanceId)}' of the same team`, {
                    sessionId: child,
                    instanceId: String(member.instanceId),
                    context: { boundInstanceId: String(binding.instanceId) },
                }));
            }
        }
        else {
            diagnostics.push(createBindingDiagnostic(BINDING_DIAGNOSTIC_CODES.BINDING_KIND_CONFLICT, root, `child session '${child}' of member ('${root}', '${String(member.instanceId)}') is bound as kind '${binding.kind}', not team-member`, { sessionId: child, instanceId: String(member.instanceId), context: { foundKind: binding.kind } }));
        }
    }
    // --- forward direction: every team-member binding -> its member record --
    for (const binding of memberBindings) {
        if (binding.kind !== 'team-member')
            continue;
        const child = String(binding.sessionId);
        const instance = String(binding.instanceId);
        const record = repositories.memberInstances.get(root, instance);
        if (record === undefined) {
            diagnostics.push(createBindingDiagnostic(BINDING_DIAGNOSTIC_CODES.ORPHAN_MEMBER_BINDING, root, `team-member binding child='${child}' -> ('${root}', '${instance}') has no MemberInstanceRecord`, { sessionId: child, instanceId: instance }));
        }
        else if (String(record.childSessionId) !== child) {
            diagnostics.push(createBindingDiagnostic(BINDING_DIAGNOSTIC_CODES.MEMBER_CHILD_MISMATCH, root, `team-member binding child='${child}' -> ('${root}', '${instance}') disagrees with the record's child session '${String(record.childSessionId)}'`, {
                sessionId: child,
                instanceId: instance,
                context: { bindingChildSessionId: child, recordChildSessionId: String(record.childSessionId) },
            }));
        }
    }
    // --- child uniqueness claim: one child, at most one member record -------
    const claimsByChild = new Map();
    for (const member of members) {
        const child = String(member.childSessionId);
        const claims = claimsByChild.get(child);
        if (claims === undefined)
            claimsByChild.set(child, [String(member.instanceId)]);
        else
            claims.push(String(member.instanceId));
    }
    for (const [child, claimants] of claimsByChild) {
        if (claimants.length < 2)
            continue;
        const sortedClaimants = [...claimants].sort();
        diagnostics.push(createBindingDiagnostic(BINDING_DIAGNOSTIC_CODES.DUPLICATE_CHILD_CLAIM, root, `child session '${child}' is claimed by ${claimants.length} member instances of team '${root}': ${sortedClaimants.join(', ')}`, { sessionId: child, context: { instanceIds: sortedClaimants } }));
    }
    diagnostics.sort(compareDiagnostics);
    const byCode = {};
    for (const diagnostic of diagnostics) {
        byCode[diagnostic.code] = (byCode[diagnostic.code] ?? 0) + 1;
    }
    return Object.freeze({
        rootSessionId: root,
        consistent: diagnostics.length === 0,
        teamSessionPresent: teamSession !== undefined,
        memberRecordsChecked: members.length,
        memberBindingsChecked: memberBindings.length,
        diagnostics: Object.freeze(diagnostics),
        byCode: Object.freeze(byCode),
    });
}
//# sourceMappingURL=reconciler.js.map