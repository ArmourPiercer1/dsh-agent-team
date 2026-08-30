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
 * - the LeaderInstance caller: the leader member record must exist
 *   (CALLER_NOT_FOUND) and be live (CALLER_ROLE_STALE when DISPOSED or
 *   ARCHIVED — a stale caller cannot act);
 * - other instance callers: the member record must exist (CALLER_NOT_FOUND)
 *   and be live (CALLER_ROLE_STALE when DISPOSED or ARCHIVED).
 *
 * Caller liveness is lifecycle ∈ {CREATED, RUNNING, SETTLED} — the work
 * ACCEPTING states. A SETTLED caller may still act (it is quiescent, not
 * gone); an ARCHIVED caller is suspended (needs an explicit restore first);
 * a DISPOSED caller is gone.
 */

import {
  LEADER_INSTANCE_ID,
  parseInstanceId,
  parseRootSessionId,
} from '../../contracts/src/index.js'
import type {
  MemberInstanceRecordDto,
  TeamSessionRecordDto,
} from '../../contracts/src/index.js'
import type { BlueprintCatalog, TeamBlueprint } from '../../domain/blueprint/src/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import {
  ACTIVATION_ERROR_CODES,
  isActivationError,
  resolveBoundBlueprint,
} from '../activation/index.js'
import type { ResolvedBoundBlueprint } from '../activation/index.js'
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from './errors.js'
import type { ActionSpec } from './actions.js'
import type { ActionCaller, CallerRole, TeamRuntimeActionRequest } from './types.js'

/** The lifecycle states of a LIVE caller (work-accepting, see module docs). */
const LIVE_CALLER_LIFECYCLES: readonly string[] = ['CREATED', 'RUNNING', 'SETTLED']

/** The output of step 1 (team + target resolution). */
export interface ResolvedTeamTarget {
  /** The root session id (validated). */
  readonly rootSessionId: string
  /** The TeamSession record. */
  readonly teamSession: TeamSessionRecordDto
  /** The resolved bound blueprint (P6-T1 seam). */
  readonly bound: ResolvedBoundBlueprint
  /** The target member record (instance-targeted actions only). */
  readonly target?: MemberInstanceRecordDto
}

/** The output of step 2 (caller resolution). */
export interface ResolvedCaller {
  /** The resolved role. */
  readonly role: CallerRole
  /** The caller's member record (instance callers). */
  readonly callerMember?: MemberInstanceRecordDto
  /** The human principal id (human callers). */
  readonly humanId?: string
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
export function resolveTeamAndTarget(
  repositories: TeamDomainRepositories,
  blueprintCatalog: BlueprintCatalog,
  request: TeamRuntimeActionRequest,
  spec: ActionSpec,
): ResolvedTeamTarget {
  const root = parseRootSessionId(request.rootSessionId)
  const teamSession = repositories.teamSessions.get(root)
  if (teamSession === undefined) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
      `TeamRuntime: no TeamSession record for root session '${root}'`,
      { rootSessionId: root },
    )
  }
  const binding = repositories.sessionBindings.get(root)
  if (binding === undefined || binding.kind !== 'team-root') {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.TEAM_ROOT_BINDING_MISSING,
      `TeamRuntime: root session '${root}' has no team-root binding`,
      { rootSessionId: root },
    )
  }
  let bound: ResolvedBoundBlueprint
  try {
    bound = resolveBoundBlueprint(blueprintCatalog, teamSession)
  } catch (error) {
    if (isActivationError(error) && error.code === ACTIVATION_ERROR_CODES.BLUEPRINT_UNRESOLVED) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.BLUEPRINT_UNRESOLVED,
        `TeamRuntime: the bound blueprint cannot be resolved from the catalog: ${error.message}`,
        error.details,
      )
    }
    if (isActivationError(error) && error.code === ACTIVATION_ERROR_CODES.BLUEPRINT_HASH_MISMATCH) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.BLUEPRINT_HASH_MISMATCH,
        `TeamRuntime: the bound blueprint content hash mismatches: ${error.message}`,
        error.details,
      )
    }
    throw error
  }

  if (!spec.instanceTargeted || request.targetInstanceId === undefined) {
    return {
      rootSessionId: root,
      teamSession,
      bound,
    }
  }

  const target = resolveInstanceToken(repositories, root, bound.blueprint, request.targetInstanceId, spec.name)
  return { rootSessionId: root, teamSession, bound, target }
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
export function resolveInstanceToken(
  repositories: TeamDomainRepositories,
  rootSessionId: string,
  blueprint: TeamBlueprint,
  token: string,
  actionName: string,
): MemberInstanceRecordDto {
  const root = parseRootSessionId(rootSessionId)
  let instanceId: string
  try {
    instanceId = parseInstanceId(token)
  } catch {
    // Not an instance id: is it a template id or a member label?
    const details: Record<string, unknown> = { action: actionName, targetToken: token }
    const templateIds: string[] = [String(blueprint.leader.templateId)]
    for (const member of blueprint.members) {
      templateIds.push(String(member.templateId))
    }
    if (templateIds.includes(token)) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
        `TeamRuntime: target '${token}' is a template id — actions are addressed by instanceId only (invariant 19)`,
        { ...details, kind: 'template-id', templateId: token },
      )
    }
    const members = repositories.memberInstances.list(root)
    const labeled = members.find((member) => member.label === token)
    if (labeled !== undefined) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
        `TeamRuntime: target '${token}' is a member label — actions are addressed by instanceId only (invariant 19)`,
        { ...details, kind: 'member-label', instanceId: labeled.instanceId },
      )
    }
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
      `TeamRuntime: target '${token}' is not an instance id — actions are addressed by instanceId only (invariant 19)`,
      { ...details, kind: 'not-an-instance-id' },
    )
  }
  const target = repositories.memberInstances.get(root, instanceId)
  if (target === undefined) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND,
      `TeamRuntime: no member instance '${instanceId}' in team '${root}'`,
      { rootSessionId: root, instanceId },
    )
  }
  return target
}

/**
 * Step 2 — caller identity + role resolution.
 *
 * @param repositories - the TeamDomain repositories.
 * @param rootSessionId - the team (root) session id.
 * @param caller - the request caller (validated).
 * @throws {@link TeamRuntimeError} CALLER_NOT_FOUND or CALLER_ROLE_STALE.
 */
export function resolveCaller(
  repositories: TeamDomainRepositories,
  rootSessionId: string,
  caller: ActionCaller,
): ResolvedCaller {
  if (caller.kind === 'human') {
    return { role: 'human', humanId: caller.humanId }
  }
  const root = parseRootSessionId(rootSessionId)
  const instanceId = parseInstanceId(caller.instanceId)
  const callerMember = repositories.memberInstances.get(root, instanceId)
  if (callerMember === undefined) {
    const isLeaderCaller = instanceId === LEADER_INSTANCE_ID
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.CALLER_NOT_FOUND,
      `TeamRuntime: no member instance '${instanceId}' in team '${root}' — the caller is unknown${isLeaderCaller ? ' (the LeaderInstance record is missing)' : ''}`,
      { rootSessionId: root, instanceId },
    )
  }
  if (!LIVE_CALLER_LIFECYCLES.includes(callerMember.lifecycle)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.CALLER_ROLE_STALE,
      `TeamRuntime: caller '${instanceId}' is ${callerMember.lifecycle} — a stale caller cannot act`,
      { rootSessionId: root, instanceId, lifecycle: callerMember.lifecycle },
    )
  }
  const role: CallerRole = instanceId === LEADER_INSTANCE_ID ? 'leader' : 'member'
  return { role, callerMember }
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
export function checkCallerRoleAuthority(
  spec: ActionSpec,
  resolved: ResolvedCaller,
): void {
  if (spec.roles === undefined) return
  if (!spec.roles.includes(resolved.role)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.CALLER_AUTHORITY_DENIED,
      `TeamRuntime: action '${spec.name}' is restricted to roles [${spec.roles.join(', ')}] (got role '${resolved.role}')`,
      { action: spec.name, role: resolved.role, allowed: [...spec.roles] },
    )
  }
}
