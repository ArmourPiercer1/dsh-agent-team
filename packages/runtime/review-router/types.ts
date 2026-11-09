/**
 * Alpha.6 PR1 — the pure review-routing vocabulary.
 *
 * This file holds decisions and facts only. It has no I/O, no clock, no
 * ControlService handle, no PA verifier and no `allow`. The router answers
 * "who should be asked to look at this current leg", never "may the operation
 * execute". Authorization remains ControlService + PA + Grant/Guard.
 *
 * @module @dsh-agent-team/runtime/review-router/types
 */

import type { ControlRequestKind } from '../control/types.js'
import type { ProposalAuthorityPosition } from '../governance/proposal-store.js'
import type { PermissionOverlayEffect } from '../../storage/schema/permission-overlay.js'

/** One trusted tool coordinate. `owner`/`name` come from the ToolBinding face. */
export interface ReviewToolCoordinate {
  readonly owner: string
  readonly name: string
}

/**
 * The normalized facts a caller (PR2a evaluator / PR2b precommit) must supply
 * for the shared ordinary-ask predicate. Nothing here is a model-supplied
 * claim: the adapter reads these from the frozen Control leg / PA manifest.
 */
export interface OrdinaryToolAskFacts {
  readonly kind: ControlRequestKind
  readonly reviewAuthority: ProposalAuthorityPosition
  readonly requestedEffect: PermissionOverlayEffect
  readonly operationFingerprint: string | null
  readonly mutationProposalFingerprint: string | null
  /** The operation case's authority point; present means non-null/non-undefined. */
  readonly authorityScope: unknown
  readonly operationTool: ReviewToolCoordinate | null
  readonly perEffectRequiredAuthorities: readonly ProposalAuthorityPosition[]
  /** A fixed Leader management/governance category or a Human-only category. */
  readonly fixedLeaderOrHumanCategory: boolean
}

/** The subset of current-leg facts the router consumes. */
export interface ReviewLegFacts {
  readonly requestId?: string
  readonly status: 'pending' | 'decided' | 'abandoned'
  readonly kind: ControlRequestKind
  readonly reviewAuthority: ProposalAuthorityPosition
  /** The operation's actual owner template, from trusted call identity. */
  readonly operationOwnerTemplateId: string | null
  /** Present iff this leg is a normal tool ask; null means "not an ordinary ask". */
  readonly ordinaryAsk: OrdinaryToolAskFacts | null
  /** This leg's legal authority path requires a Human (or has no legal resolver). */
  readonly requiresHuman: boolean
  readonly hasLegalResolver: boolean
  /** Team scheduling / governance / persistent permission mutation, etc. */
  readonly fixedLeaderCategory: boolean
}

/** One trusted Leader route target. */
export interface ReviewLeaderTarget {
  readonly instanceId: string
  readonly templateId: string
}

/** Current Officer resolution, with the three distinct non-active classes. */
export type CurrentOfficer =
  | { readonly status: 'active'; readonly instanceId: string; readonly templateId: string }
  | { readonly status: 'archived'; readonly instanceId?: string; readonly templateId?: string; readonly hasAdmissionHistory: boolean }
  | { readonly status: 'disposed'; readonly instanceId?: string; readonly templateId?: string; readonly hasAdmissionHistory: boolean }
  | { readonly status: 'missing'; readonly hasAdmissionHistory: boolean }
  | { readonly status: 'ambiguous'; readonly activeCount: number }
  | { readonly status: 'not-admitted' }
  | { readonly status: 'unconfirmed'; readonly reason: string }

/** A current-leg transfer fact (Handoff / trusted runtime takeover). */
export type CurrentLegTransfer =
  | { readonly target: 'leader'; readonly actor: 'officer' | 'trusted-team-runtime' }
  | { readonly target: 'native-human'; readonly actor: 'trusted-team-runtime' }

/** The immutable input of one routing decision. */
export interface ReviewRouteInput {
  /** Absent/disabled policy means Alpha.6 routing is off; the caller must not route. */
  readonly policy: import('./policy.js').BlueprintReviewPolicy | null
  readonly currentLeg: ReviewLegFacts | null
  readonly currentOfficer: CurrentOfficer
  readonly leader: ReviewLeaderTarget | null
  readonly transfer: CurrentLegTransfer | null
}

/** Why the router holds instead of guessing. */
export type ReviewHoldReason =
  | 'officer-not-admitted'
  | 'officer-ambiguous'
  | 'officer-availability-unconfirmed'
  | 'config-invalid'
  | 'leader-unavailable'

/** The recipient route. Human has no Agent session, so it is a distinct target. */
export type ReviewRouteTarget =
  | {
      readonly kind: 'instance'
      readonly instanceId: string
      readonly templateId: string
      readonly routeRole: 'officer' | 'leader'
    }
  | { readonly kind: 'native-human' }

/** The deterministic result of `routeReview`. */
export type ReviewRoute =
  | {
      readonly kind: 'recipient'
      readonly target: ReviewRouteTarget
      readonly reason: string
      readonly currentLegId?: string
    }
  | {
      readonly kind: 'hold'
      readonly holdReason: ReviewHoldReason
      readonly reason: string
      readonly currentLegId?: string
    }
  | { readonly kind: 'no-work' }
  | { readonly kind: 'unroutable'; readonly reason: string }
