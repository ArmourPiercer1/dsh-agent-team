/**
 * P6-T2 — step 4 of the documented enforcement order: the
 * compatibility/admission gate (invariant 50: the compatibility gate blocks
 * NEW WORK admission), plus the work-accepting state gate for work targets.
 *
 * Compatibility (reuse, don't fork — domain/compatibility engine through
 * the P6-T1 bridge `evaluateActivationCompatibility`):
 * - a DURABLE team compatibility state exists -> its status is authoritative:
 *   BLOCKED_FATAL and BLOCKED_WARNING reject NEW WORK (COMPATIBILITY_BLOCKED,
 *   `details.status` carried); OPEN and DEGRADED_ACKNOWLEDGED admit;
 * - no durable state -> a live evaluation of the bound blueprint's
 *   requirements against the injected environment facts (the exact P6-T1
 *   step-6 bridge) — the same fail-closed semantics as the provider.
 *
 * Only the WORK and CREATION categories are gated (invariant 50 is about
 * NEW WORK admission): reads, coordination facts, and lifecycle operations
 * are not new-work admissions (documented ruling: archiving/disposing a
 * member while compat is blocked is an admission-closing action, and
 * coordination records are evidence, not work).
 *
 * Work-accepting state (domain/member `WORK_ACCEPTING_STATES`):
 * a work target (follow-up / delegate-continue resolution) must be in
 * CREATED/RUNNING/SETTLED; ARCHIVED needs an explicit restore first
 * (invariant 53); DISPOSED is gone (WORK_STATE_REJECTED).
 *
 * Quota (step 5) — documented boundary semantics:
 * - creation actions (delegate / create-member) enforce quota INSIDE the
 *   ActivationProvider's step 7, under the provider's per-team lock, on a
 *   FRESH durable view that counts committed members PLUS in-flight
 *   PREPARED provision operations (the P6-T1 `countTeamQuota`);
 * - the boundary is deterministic: an attempt is admitted iff
 *   `count + 1 <= limit` for every applicable dimension — i.e. AT the
 *   exact limit the next attempt is DENIED (`count + 1 > limit`, the
 *   reused P6-T1 `checkQuota` arithmetic);
 * - non-creation actions consume NO creation budget (follow-up keeps the
 *   SAME child session, invariant 24; coordination/lifecycle actions do
 *   not create);
 * - racing attempts cannot over-consume: the provider serializes per-team
 *   durable writes behind its promise-chain lock and counts in-flight
 *   reservations, so N parallel delegates yield exactly `limit` creations
 *   and `N - limit` deterministic QUOTA_EXCEEDED_* rejections;
 * - the provider's ACTIVATION_QUOTA_* codes are mapped onto the router's
 *   closed QUOTA_EXCEEDED_* codes (see `mapActivationError`).
 */

import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import { WORK_ACCEPTING_STATES } from '../../domain/member/src/index.js'
import type { MemberLifecycleState } from '../../contracts/src/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import {
  ACTIVATION_ERROR_CODES,
  ActivationError,
  evaluateActivationCompatibility,
  isActivationError,
} from '../activation/index.js'
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from './errors.js'
import type { ActionSpec } from './actions.js'

/**
 * Step 4a — the compatibility gate for NEW WORK (invariant 50).
 *
 * @param repositories - the TeamDomain repositories (durable compat state).
 * @param blueprint - the resolved bound blueprint.
 * @param rootSessionId - the team (root) session id.
 * @param environmentFacts - the current environment probe facts.
 * @throws {@link TeamRuntimeError} COMPATIBILITY_BLOCKED.
 */
export function enforceCompatibilityGate(
  repositories: TeamDomainRepositories,
  blueprint: TeamBlueprint,
  rootSessionId: string,
  environmentFacts: readonly EnvironmentFact[],
): void {
  const state = repositories.compatibility.get(rootSessionId)
  if (state !== undefined) {
    if (state.status === 'BLOCKED_FATAL' || state.status === 'BLOCKED_WARNING') {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
        `TeamRuntime: the team's durable compatibility state is ${state.status} — new work admission is blocked (invariant 50)`,
        {
          rootSessionId,
          status: state.status,
          fingerprint: state.fingerprint,
          source: 'durable-state',
        },
      )
    }
    return
  }
  // No durable state: live evaluation (the P6-T1 step-6 bridge, reused).
  try {
    evaluateActivationCompatibility(blueprint, environmentFacts, undefined)
  } catch (error) {
    if (isActivationError(error) && error.code === ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_FATAL) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
        `TeamRuntime: compatibility is BLOCKED_FATAL — new work admission is blocked (invariant 50): ${error.message}`,
        { rootSessionId, status: 'BLOCKED_FATAL', source: 'live-evaluation' },
      )
    }
    if (isActivationError(error) && error.code === ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_WARNING) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
        `TeamRuntime: compatibility is BLOCKED_WARNING (unacknowledged) — new work admission is blocked (invariant 50): ${error.message}`,
        { rootSessionId, status: 'BLOCKED_WARNING', source: 'live-evaluation' },
      )
    }
    throw error
  }
}

/**
 * Step 4b — the work-accepting state gate for work targets.
 *
 * @param lifecycle - the target member's CURRENT lifecycle (fresh view).
 * @throws {@link TeamRuntimeError} WORK_STATE_REJECTED.
 */
export function enforceWorkAcceptingState(lifecycle: MemberLifecycleState): void {
  if (!(WORK_ACCEPTING_STATES as readonly string[]).includes(lifecycle)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.WORK_STATE_REJECTED,
      `TeamRuntime: the work target is ${lifecycle} — work is accepted only in CREATED/RUNNING/SETTLED (an ARCHIVED target needs an explicit restore first, invariant 53)`,
      { lifecycle, accepting: [...WORK_ACCEPTING_STATES] },
    )
  }
}

/** Whether the action category is a NEW WORK admission (gated by compat). */
export function isNewWorkAdmission(spec: ActionSpec): boolean {
  return spec.category === 'work' || spec.category === 'creation'
}

/**
 * Map a P6-T1 ActivationError onto the router's closed vocabulary
 * (provider-routed creation actions surface the provider's admission
 * decisions through the facade contract). The closed mapping:
 * QUOTA_* -> QUOTA_EXCEEDED_*; DELEGATION_TARGET_UNRESOLVED (1:1);
 * CALLER_AUTHORITY_DENIED (1:1); POLICY_RESOLUTION_FAILED (1:1);
 * TEMPLATE_NOT_FOUND / INVALID_LABEL_FIELD / INVALID_GROUP_ID_FIELD /
 * INVALID_WORKSPACE_FIELD -> REQUEST_MALFORMED (request-shape faults of
 * the provider protocol); COMPATIBILITY_BLOCKED_* -> COMPATIBILITY_BLOCKED;
 * everything else (durable/protocol faults) -> DURABLE_WRITE_FAILED.
 */
export function mapActivationError(error: ActivationError): TeamRuntimeError {
  const base = { source: 'activation-provider', providerCode: error.code }
  switch (error.code) {
    case ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_INSTANCES:
      return new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEAM_INSTANCES,
        error.message,
        { ...base, ...error.details },
      )
    case ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_CONCURRENT:
      return new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEAM_CONCURRENT,
        error.message,
        { ...base, ...error.details },
      )
    case ACTIVATION_ERROR_CODES.QUOTA_MEMBER_MAX_INSTANCES:
      return new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEMPLATE_INSTANCES,
        error.message,
        { ...base, ...error.details },
      )
    case ACTIVATION_ERROR_CODES.QUOTA_MEMBER_MAX_CONCURRENT:
      return new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEMPLATE_CONCURRENT,
        error.message,
        { ...base, ...error.details },
      )
    case ACTIVATION_ERROR_CODES.DELEGATION_TARGET_UNRESOLVED:
      return new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.DELEGATION_TARGET_UNRESOLVED,
        error.message,
        { ...base, ...error.details },
      )
    case ACTIVATION_ERROR_CODES.CALLER_AUTHORITY_DENIED:
      return new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.CALLER_AUTHORITY_DENIED,
        error.message,
        { ...base, ...error.details },
      )
    case ACTIVATION_ERROR_CODES.POLICY_RESOLUTION_FAILED:
      return new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.POLICY_RESOLUTION_FAILED,
        error.message,
        { ...base, ...error.details },
      )
    case ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_FATAL:
      return new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
        error.message,
        { ...base, ...error.details, status: 'BLOCKED_FATAL' },
      )
    case ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_WARNING:
      return new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
        error.message,
        { ...base, ...error.details, status: 'BLOCKED_WARNING' },
      )
    case ACTIVATION_ERROR_CODES.TEMPLATE_NOT_FOUND:
    case ACTIVATION_ERROR_CODES.INVALID_LABEL_FIELD:
    case ACTIVATION_ERROR_CODES.INVALID_GROUP_ID_FIELD:
    case ACTIVATION_ERROR_CODES.INVALID_WORKSPACE_FIELD:
      return new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED,
        error.message,
        { ...base, ...error.details },
      )
    default:
      return new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED,
        error.message,
        { ...base, ...error.details },
      )
  }
}
