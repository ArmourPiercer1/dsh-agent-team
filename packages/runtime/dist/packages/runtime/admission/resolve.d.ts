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
import type { MemberInstanceRecordDto, TeamSessionRecordDto } from '../../contracts/src/index.js';
import type { BlueprintCatalog, TeamBlueprint } from '../../domain/blueprint/src/index.js';
import type { TeamDomainRepositories } from '../../storage/repositories/index.js';
import type { ResolvedBoundBlueprint } from '../activation/index.js';
import type { ActionSpec } from './actions.js';
import type { ActionCaller, CallerRole, TeamRuntimeActionRequest } from './types.js';
/** The output of step 1 (team + target resolution). */
export interface ResolvedTeamTarget {
    /** The root session id (validated). */
    readonly rootSessionId: string;
    /** The TeamSession record. */
    readonly teamSession: TeamSessionRecordDto;
    /** The resolved bound blueprint (P6-T1 seam). */
    readonly bound: ResolvedBoundBlueprint;
    /** The target member record (instance-targeted actions only). */
    readonly target?: MemberInstanceRecordDto;
}
/** The output of step 2 (caller resolution). */
export interface ResolvedCaller {
    /** The resolved role. */
    readonly role: CallerRole;
    /** The caller's member record (instance callers). */
    readonly callerMember?: MemberInstanceRecordDto;
    /** The human principal id (human callers). */
    readonly humanId?: string;
}
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
export declare function resolveTeamAndTarget(repositories: TeamDomainRepositories, blueprintCatalog: BlueprintCatalog, request: TeamRuntimeActionRequest, spec: ActionSpec): ResolvedTeamTarget;
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
export declare function resolveInstanceToken(repositories: TeamDomainRepositories, rootSessionId: string, blueprint: TeamBlueprint, token: string, actionName: string): MemberInstanceRecordDto;
/**
 * Step 2 — caller identity + role resolution.
 *
 * @param repositories - the TeamDomain repositories.
 * @param rootSessionId - the team (root) session id.
 * @param caller - the request caller (validated).
 * @throws {@link TeamRuntimeError} CALLER_NOT_FOUND or CALLER_ROLE_STALE.
 */
export declare function resolveCaller(repositories: TeamDomainRepositories, rootSessionId: string, caller: ActionCaller): ResolvedCaller;
/**
 * Step 2b — role-level authority restriction (beyond the envelope): the
 * action's closed role set rejects callers whose resolved role is not in
 * it (e.g. members cannot create or delegate — invariant 37).
 *
 * @param spec - the action spec.
 * @param resolved - the resolved caller.
 * @throws {@link TeamRuntimeError} CALLER_AUTHORITY_DENIED.
 */
export declare function checkCallerRoleAuthority(spec: ActionSpec, resolved: ResolvedCaller): void;
//# sourceMappingURL=resolve.d.ts.map