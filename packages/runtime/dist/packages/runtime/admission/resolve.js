/**
 * P6-T2 — steps 1-2 of the documented enforcement order: team + target
 * resolution (instanceId-first) and caller identity/role resolution.
 *
 * Both steps are PURE READS over the TeamDomain repositories (zero durable
 * side effects — a rejection here has, by construction, written nothing).
 *
 * Step 1 — team + target (instance-first, invariants 9/18/19):
 * - the root session must carry a TeamSession record (TEAM_SESSION_NOT_FOUND
 *   otherwise) AND a team-root session binding (TEAM_ROOT_BINDING_MISSING
 *   otherwise);
 * - the bound blueprint is resolved from the catalog with the P6-T1 seam
 *   (BLUEPRINT_UNRESOLVED / BLUEPRINT_HASH_MISMATCH mapped);
 * - instance-targeted actions: the target token must parse as an instance
 *   id. A token that does NOT parse but matches a bound blueprint template
 *   id or an existing member label is REJECTED as label/template addressing
 *   (ACTION_ADDRESSING_REJECTED, `details.kind` = `template-id` /
 *   `member-label` / `not-an-instance-id`) — it is never re-interpreted.
 *   A token that parses but resolves to no member record is INSTANCE_NOT_FOUND.
 *
 * Step 2 — caller (identity + role from the TeamDomain):
 * - `human` callers: role `human` (the team owner; never stale);
 * - the LeaderInstance caller (P8-S2, Architecture §9.2, invariants
 *   14/15): resolves from the durable Root/Team identity — the root must
 *   carry the TeamSession record AND the team-root binding (both
 *   CALLER_NOT_FOUND otherwise; the branch is self-contained because the
 *   control plane calls `resolveCaller` without step 1). The leader row
 *   is read best-effort for the envelope's templateId lookup: its
 *   absence is NOT a caller defect, and the row's lifecycle NEVER governs
 *   the Leader — the Leader's liveness follows the Root Session (it
 *   cannot be independently archived or disposed, invariant 15);
 * - other instance callers: the member record must exist (CALLER_NOT_FOUND)
 *   and be live (CALLER_ROLE_STALE when DISPOSED or ARCHIVED).
 *
 * Caller liveness is lifecycle ∈ {CREATED, RUNNING, SETTLED} — the work
 * ACCEPTING states. A SETTLED caller may still act (it is quiescent, not
 * gone); an ARCHIVED caller is suspended (needs an explicit restore first);
 * a DISPOSED caller is gone.
 */
import { LEADER_INSTANCE_ID, parseInstanceId, parseRootSessionId, } from '../../contracts/src/index.js';
import { ACTIVATION_ERROR_CODES, isActivationError, resolveBoundBlueprint, } from '../activation/index.js';
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from './errors.js';
/** The lifecycle states of a LIVE caller (work-accepting, see module docs). */
const LIVE_CALLER_LIFECYCLES = ['CREATED', 'RUNNING', 'SETTLED'];
/**
 * Step 1 — team + target resolution.
 *
 * @param repositories - the TeamDomain repositories.
 * @param blueprintCatalog - the immutable blueprint catalog.
 * @param request - the (validated) action request.
 * @param spec - the resolved action spec.
 * @throws {@link TeamRuntimeError} TEAM_SESSION_NOT_FOUND,
 *   TEAM_ROOT_BINDING_MISSING, BLUEPRINT_UNRESOLVED,
 *   BLUEPRINT_HASH_MISMATCH, ACTION_ADDRESSING_REJECTED or
 *   INSTANCE_NOT_FOUND.
 */
export function resolveTeamAndTarget(repositories, blueprintCatalog, request, spec) {
    const root = parseRootSessionId(request.rootSessionId);
    const teamSession = repositories.teamSessions.get(root);
    if (teamSession === undefined) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND, `TeamRuntime: no TeamSession record for root session '${root}'`, { rootSessionId: root });
    }
    const binding = repositories.sessionBindings.get(root);
    if (binding === undefined || binding.kind !== 'team-root') {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.TEAM_ROOT_BINDING_MISSING, `TeamRuntime: root session '${root}' has no team-root binding`, { rootSessionId: root });
    }
    let bound;
    try {
        bound = resolveBoundBlueprint(blueprintCatalog, teamSession);
    }
    catch (error) {
        if (isActivationError(error) && error.code === ACTIVATION_ERROR_CODES.BLUEPRINT_UNRESOLVED) {
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.BLUEPRINT_UNRESOLVED, `TeamRuntime: the bound blueprint cannot be resolved from the catalog: ${error.message}`, error.details);
        }
        if (isActivationError(error) && error.code === ACTIVATION_ERROR_CODES.BLUEPRINT_HASH_MISMATCH) {
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.BLUEPRINT_HASH_MISMATCH, `TeamRuntime: the bound blueprint content hash mismatches: ${error.message}`, error.details);
        }
        throw error;
    }
    if (!spec.instanceTargeted || request.targetInstanceId === undefined) {
        return {
            rootSessionId: root,
            teamSession,
            bound,
        };
    }
    const target = resolveInstanceToken(repositories, root, bound.blueprint, request.targetInstanceId, spec.name);
    return { rootSessionId: root, teamSession, bound, target };
}
/**
 * Resolve one instance-addressing token to a durable member record with
 * the instance-first semantics (invariant 19): a token that does not parse
 * as an instance id is REJECTED — classified as a template id or a member
 * label when it matches one (ACTION_ADDRESSING_REJECTED, `details.kind` =
 * `template-id` / `member-label` / `not-an-instance-id`); a token that
 * parses but resolves to no record is INSTANCE_NOT_FOUND.
 *
 * @param repositories - the TeamDomain repositories.
 * @param rootSessionId - the team (root) session id.
 * @param blueprint - the resolved bound blueprint (template vocabulary).
 * @param token - the raw addressing token.
 * @param actionName - the action name (for diagnostics).
 * @throws {@link TeamRuntimeError} ACTION_ADDRESSING_REJECTED or
 *   INSTANCE_NOT_FOUND.
 */
export function resolveInstanceToken(repositories, rootSessionId, blueprint, token, actionName) {
    const root = parseRootSessionId(rootSessionId);
    let instanceId;
    try {
        instanceId = parseInstanceId(token);
    }
    catch {
        // Not an instance id: is it a template id or a member label?
        const details = { action: actionName, targetToken: token };
        const templateIds = [String(blueprint.leader.templateId)];
        for (const member of blueprint.members) {
            templateIds.push(String(member.templateId));
        }
        if (templateIds.includes(token)) {
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED, `TeamRuntime: target '${token}' is a template id — actions are addressed by instanceId only (invariant 19)`, { ...details, kind: 'template-id', templateId: token });
        }
        const members = repositories.memberInstances.list(root);
        const labeled = members.find((member) => member.label === token);
        if (labeled !== undefined) {
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED, `TeamRuntime: target '${token}' is a member label — actions are addressed by instanceId only (invariant 19)`, { ...details, kind: 'member-label', instanceId: labeled.instanceId });
        }
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED, `TeamRuntime: target '${token}' is not an instance id — actions are addressed by instanceId only (invariant 19)`, { ...details, kind: 'not-an-instance-id' });
    }
    const target = repositories.memberInstances.get(root, instanceId);
    if (target === undefined) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND, `TeamRuntime: no member instance '${instanceId}' in team '${root}'`, { rootSessionId: root, instanceId });
    }
    return target;
}
/**
 * Step 2 — caller identity + role resolution.
 *
 * @param repositories - the TeamDomain repositories.
 * @param rootSessionId - the team (root) session id.
 * @param caller - the request caller (validated).
 * @throws {@link TeamRuntimeError} CALLER_NOT_FOUND or CALLER_ROLE_STALE.
 */
export function resolveCaller(repositories, rootSessionId, caller) {
    if (caller.kind === 'human') {
        return { role: 'human', humanId: caller.humanId };
    }
    const root = parseRootSessionId(rootSessionId);
    const instanceId = parseInstanceId(caller.instanceId);
    // The Leader caller resolves from the durable Root/Team identity (P8-S2,
    // Architecture §9.2, invariants 14/15): NOT from a member row. The row
    // is read best-effort for the envelope's templateId lookup; its absence
    // is not a caller defect, and its lifecycle never governs the Leader —
    // the Leader's liveness follows the Root Session (it cannot be
    // independently archived or disposed, invariant 15).
    if (instanceId === LEADER_INSTANCE_ID) {
        const teamSession = repositories.teamSessions.get(root);
        if (teamSession === undefined) {
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.CALLER_NOT_FOUND, `TeamRuntime: no TeamSession record for root session '${root}' — the LeaderInstance caller is unknown (it resolves from the Root Session, §9.2)`, { rootSessionId: root, instanceId });
        }
        const binding = repositories.sessionBindings.get(root);
        if (binding === undefined || binding.kind !== 'team-root') {
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.CALLER_NOT_FOUND, `TeamRuntime: root session '${root}' has no team-root binding — the LeaderInstance caller is unknown (it resolves from the Root Session, §9.2)`, { rootSessionId: root, instanceId });
        }
        const leaderRow = repositories.memberInstances.get(root, instanceId);
        if (leaderRow === undefined) {
            return { role: 'leader' };
        }
        return { role: 'leader', callerMember: leaderRow };
    }
    const callerMember = repositories.memberInstances.get(root, instanceId);
    if (callerMember === undefined) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.CALLER_NOT_FOUND, `TeamRuntime: no member instance '${instanceId}' in team '${root}' — the caller is unknown`, { rootSessionId: root, instanceId });
    }
    if (!LIVE_CALLER_LIFECYCLES.includes(callerMember.lifecycle)) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.CALLER_ROLE_STALE, `TeamRuntime: caller '${instanceId}' is ${callerMember.lifecycle} — a stale caller cannot act`, { rootSessionId: root, instanceId, lifecycle: callerMember.lifecycle });
    }
    return { role: 'member', callerMember };
}
/**
 * Step 2b — role-level authority restriction (beyond the envelope): the
 * action's closed role set rejects callers whose resolved role is not in
 * it (e.g. members cannot create or delegate — invariant 37).
 *
 * @param spec - the action spec.
 * @param resolved - the resolved caller.
 * @throws {@link TeamRuntimeError} CALLER_AUTHORITY_DENIED.
 */
export function checkCallerRoleAuthority(spec, resolved) {
    if (spec.roles === undefined)
        return;
    if (!spec.roles.includes(resolved.role)) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.CALLER_AUTHORITY_DENIED, `TeamRuntime: action '${spec.name}' is restricted to roles [${spec.roles.join(', ')}] (got role '${resolved.role}')`, { action: spec.name, role: resolved.role, allowed: [...spec.roles] });
    }
}
//# sourceMappingURL=resolve.js.map