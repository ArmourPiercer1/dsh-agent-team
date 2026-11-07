/**
 * Alpha.6 PR1 — the ONE shared `BlueprintReviewPolicy`.
 *
 * Both the router (this PR) and the ReviewCapability evaluator (PR2a) read
 * the same `isDelegableOrdinaryToolAsk`. A second copy of this predicate is a
 * second answer to "may an Officer review this ask", which is exactly the
 * drift ADR-A6-1 forbids.
 *
 * The predicate is intentionally data-first: no ControlService, no PA, no
 * Blueprint parser. The caller supplies trusted, normalized facts. A missing
 * or malformed fact fails closed.
 *
 * @module @dsh-agent-team/runtime/review-router/policy
 */

import type { ReviewRouting } from '../../domain/blueprint/src/index.js'
import { PERMISSION_OVERLAY_EFFECT_VALUES } from '../../storage/schema/permission-overlay.js'
import type { ReviewLeaderException, ReviewToolCoordinate } from '../../domain/blueprint/src/index.js'
import type { OrdinaryToolAskFacts } from './types.js'

/** The immutable policy the router and capability evaluator share. */
export interface BlueprintReviewPolicy {
  readonly officerTemplateId: string
  readonly ordinaryDefault: 'officer'
  readonly leaderExceptions: readonly ReviewLeaderException[]
  readonly whenOfficerUnavailable: 'hold' | 'leader'
}

/** Build the shared policy from an authored v5 `reviewRouting` block. */
export function blueprintReviewPolicyFrom(routing: ReviewRouting | undefined): BlueprintReviewPolicy | null {
  if (routing === undefined) return null
  return Object.freeze({
    officerTemplateId: routing.officerTemplateId,
    ordinaryDefault: 'officer',
    leaderExceptions: Object.freeze(routing.ordinaryToolApprovals.leaderExceptions.map((entry) => Object.freeze({
      memberTemplateId: entry.memberTemplateId,
      tool: Object.freeze({ owner: entry.tool.owner, name: entry.tool.name }),
    }))),
    whenOfficerUnavailable: routing.whenOfficerUnavailable,
  })
}

/** Is this (actual OperationOwner template, trusted tool) a declared Leader exception? */
export function isLeaderException(
  policy: BlueprintReviewPolicy,
  operationOwnerTemplateId: string | null,
  tool: ReviewToolCoordinate | null,
): boolean {
  if (operationOwnerTemplateId === null || tool === null) return false
  return policy.leaderExceptions.some((entry) =>
    entry.memberTemplateId === operationOwnerTemplateId &&
    entry.tool.owner === tool.owner &&
    entry.tool.name === tool.name,
  )
}

/**
 * The frozen ordinary-ask closed set.
 *
 * This is an OPERATION CASE, not a mutation case. `requestedEffect` is
 * REQUIRED by Alpha.4's `ApprovalCaseIdentity`; the earlier "no
 * requestedEffect" formulation was a P0 because it excluded every legal
 * operation case. The distinguishing facts are `operationFingerprint`
 * present, `mutationProposalFingerprint` absent, and `authorityScope`
 * present.
 */
export function isDelegableOrdinaryToolAsk(facts: OrdinaryToolAskFacts): boolean {
  if (facts.kind !== 'leader-approval') return false
  if (facts.reviewAuthority !== 'leader') return false
  if (!PERMISSION_OVERLAY_EFFECT_VALUES.includes(facts.requestedEffect)) return false
  if (typeof facts.operationFingerprint !== 'string' || facts.operationFingerprint.trim().length === 0) return false
  if (facts.mutationProposalFingerprint !== null && facts.mutationProposalFingerprint !== undefined) return false
  if (facts.authorityScope === null || facts.authorityScope === undefined) return false
  if (facts.operationTool === null) return false
  if (typeof facts.operationTool.owner !== 'string' || facts.operationTool.owner.trim().length === 0) return false
  if (typeof facts.operationTool.name !== 'string' || facts.operationTool.name.trim().length === 0) return false
  if (facts.fixedLeaderOrHumanCategory) return false
  if (facts.perEffectRequiredAuthorities.length === 0) return false
  return facts.perEffectRequiredAuthorities.every((position) => position === 'member' || position === 'leader')
}
