/**
 * P6-T2 — step 4 of the documented enforcement order: the
 * compatibility/admission gate (invariant 50: the compatibility gate blocks
 * NEW WORK admission), plus the work-accepting state gate for work targets.
 *
 * Compatibility (P8-S4A: the SINGLE compatibility authority —
 * `compatibility/authority.ts` over the P7-T1 prober + P3 engine):
 * this gate consults the authority's exact chain — fresh environment-facts
 * read -> fingerprint -> freshness (a MISSING or STALE durable generation
 * is never trusted: it is re-probed inline under
 * `STALE_GENERATION_BEFORE_NEW_WORK`) -> durable state -> ACK validity ->
 * EXACTLY ONE admission result. On `admit` the gate returns; on `block`
 * (BLOCKED_FATAL / BLOCKED_WARNING) it throws COMPATIBILITY_BLOCKED with
 * `details.status` / `details.fingerprint` / `details.generation` /
 * `details.reprobed` / `details.blockingRequirementIds`; on `reprobe`
 * (the chain itself failed: facts-unavailable / reprobe-failed /
 * no-state-after-reprobe / state-mismatch) it fails CLOSED with
 * COMPATIBILITY_BLOCKED `details.reason`. The provider's step 6 consumes
 * the SAME authority — this gate runs no preflight of its own and never
 * reads the durable compatibility record directly.
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
} from '../activation/index.js'
import { createCompatibilityAuthority } from '../compatibility/index.js'
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from './errors.js'
import type { ActionSpec } from './actions.js'

/**
 * Step 4a — the compatibility gate for NEW WORK (invariant 50).
 *
 * Consumes the SINGLE compatibility authority (P8-S4A): `admit()` runs the
 * exact chain (fresh facts -> fingerprint -> freshness -> durable state ->
 * ACK validity -> one result) and this gate maps that ONE result. A stale
 * or missing durable generation is re-probed INLINE by the authority before
 * any admission decision (DevPlan §20.1 trigger 5), so this gate is async
 * and performs durable writes on that path.
 *
 * @param repositories - the TeamDomain repositories (durable compat state).
 * @param blueprint - the resolved bound blueprint.
 * @param rootSessionId - the team (root) session id.
 * @param environmentFacts - the current environment facts (read by the
 * router immediately before this call; the authority's re-probe re-reads
 * the same captured value, the same logical moment).
 * @param now - the deterministic clock, passed through to the authority's
 * prober (defaults to the prober clock when omitted).
 * @throws {@link TeamRuntimeError} COMPATIBILITY_BLOCKED.
 */
export async function enforceCompatibilityGate(
  repositories: TeamDomainRepositories,
  blueprint: TeamBlueprint,
  rootSessionId: string,
  environmentFacts: readonly EnvironmentFact[],
  now?: () => string,
): Promise<void> {
  const authority = createCompatibilityAuthority({
    repositories,
    rootSessionId,
    blueprint,
    environmentFacts: async () => environmentFacts,
    ...(now !== undefined ? { now } : {}),
  })
  const decision = await authority.admit()
  if (decision.decision === 'admit') return
  if (decision.decision === 'reprobe') {
    // The chain itself failed (facts-unavailable / reprobe-failed /
    // no-state-after-reprobe / state-mismatch): fail CLOSED (invariant 50
    // — a compatibility failure is never an admission).
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
      `TeamRuntime: compatibility could not be established (${decision.reprobeReason}) — new work admission fails closed (invariant 50)`,
      {
        rootSessionId,
        source: 'compatibility-authority',
        reason: decision.reprobeReason,
      },
    )
  }
  throw new TeamRuntimeError(
    TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
    `TeamRuntime: the team's compatibility is ${decision.status} — new work admission is blocked (invariant 50)`,
    {
      rootSessionId,
      status: decision.status,
      fingerprint: decision.fingerprint,
      generation: decision.generation,
      source: 'durable-state',
      reprobed: decision.reprobed,
      blockingRequirementIds: decision.blockingRequirements.map((requirement) => requirement.requirementId),
    },
  )
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
