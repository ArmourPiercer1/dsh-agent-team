/**
 * Alpha.6 PR2a — pure ReviewCapability facts and capability evidence.
 *
 * A capability says "this real principal may perform this entry action on this
 * current leg, under this Blueprint". It does NOT say the operation may
 * execute: PA/Grant/Guard remain the execution authority, and this module has
 * no I/O, no clock and no service handle.
 *
 * @module @dsh-agent-team/runtime/review-authority/types
 */

import type { ControlCallerRef, ControlOperationScope, ControlRequestKind } from '../control/types.js'
import type { ProposalAuthorityPosition } from '../governance/proposal-store.js'
import type { PermissionOverlayEffect } from '../../storage/schema/permission-overlay.js'
import type { ReviewRouting } from '../../domain/blueprint/src/index.js'

/** The only entry actions a capability candidate may be minted for. */
export const REVIEW_CAPABILITY_ENTRIES = ['allow', 'deny', 'escalate', 'terminal-close'] as const
export type ReviewCapabilityEntry = (typeof REVIEW_CAPABILITY_ENTRIES)[number]

/** The two sources of review authority. Handoff/takeover is NOT a source. */
export const REVIEW_CAPABILITY_SOURCES = ['native', 'blueprint-officer'] as const
export type ReviewCapabilitySource = (typeof REVIEW_CAPABILITY_SOURCES)[number]

/** A trusted reviewer Member identity (from the runtime binding, not the model). */
export interface ReviewerMember {
  readonly instanceId: string
  readonly templateId: string
  readonly rootSessionId: string
}

/** The trusted operation owner / tool identity. */
export interface OperationOwner {
  readonly rootSessionId: string
  readonly instanceId: string
  readonly templateId: string
}

export interface OperationTool {
  readonly definitionIdentity: string
  readonly owner: string
  readonly name: string
}

/** One current case/leg fact; `currentLegRequestId` is the leg being acted on. */
export interface CurrentReviewCase {
  readonly approvalCaseId: string
  readonly currentLegRequestId: string
  readonly legOrdinal: number
  readonly kind: ControlRequestKind
  readonly reviewAuthority: ProposalAuthorityPosition
  readonly status: 'pending' | 'decided' | 'abandoned'
  readonly requestedEffect: PermissionOverlayEffect
  readonly operationFingerprint: string | null
  readonly mutationProposalFingerprint: string | null
  readonly scopeFingerprint: string
  readonly authorityGeneration: number
}

/** A current-leg transfer fact; only its presence matters for delegation. */
export interface ReviewLegTransfer {
  readonly target: 'leader' | 'native-human'
  readonly actor: 'officer' | 'trusted-team-runtime'
}

/** Everything the evaluator may trust. */
export interface ReviewCallFacts {
  readonly reviewer: ControlCallerRef
  readonly reviewerMember?: ReviewerMember
  readonly requester?: ControlCallerRef
  readonly currentOfficer?: { readonly instanceId: string; readonly templateId: string; readonly rootSessionId: string }
  readonly operationOwner: OperationOwner | null
  readonly operationTool: OperationTool | null
  readonly currentCase: CurrentReviewCase
  readonly operationScope: ControlOperationScope | null
  readonly scopeFingerprint: string
  readonly effectSetFingerprint?: string
  readonly paManifestPresent: boolean
  readonly blueprint: {
    readonly revision: string
    readonly contentHash: string
    readonly reviewRouting?: ReviewRouting
  }
  readonly currentLegTransfer: ReviewLegTransfer | null
  readonly authorityGeneration: number
  /** The current leg is a fixed Leader/Human category, not an ordinary ask. */
  readonly fixedLeaderOrHumanCategory: boolean
  /** The leg's legal authority path requires Human. */
  readonly requiresHuman: boolean
  /** The proposed escalation successor, for entry='escalate'. */
  readonly escalationSuccessor?: ProposalAuthorityPosition | null
  /** True if this Officer already acted on an earlier leg of this case. */
  readonly officerActedOnEarlierLeg: boolean
  /** Trusted required-authority positions for each effect in the PA manifest. */
  readonly perEffectRequiredAuthorities: readonly ProposalAuthorityPosition[]
}

/** The capability the evaluator returns for an allowed entry. */
export interface ReviewCapability {
  readonly principal: ControlCallerRef
  readonly source: ReviewCapabilitySource
  readonly entry: ReviewCapabilityEntry
  readonly effectiveReviewAuthority: ProposalAuthorityPosition
  readonly approvalCaseId: string
  readonly currentLegRequestId: string
  readonly legOrdinal: number
  readonly scope: ControlOperationScope
  readonly scopeFingerprint: string
  readonly effectSetFingerprint?: string
  readonly blueprintContentHash: string
  readonly blueprintRevision: string
  readonly authorityGeneration: number
  readonly operationOwner: OperationOwner
  readonly operationTool: OperationTool
}

/**
 * Nominal capability candidate. The private constructor is the only path in
 * this module; a caller cannot mint one by shaping an object, and PA may
 * accept this type as its "trusted candidate" without re-validating raw
 * caller data.
 */
export class ReviewCapabilityCandidate {
  readonly capability: ReviewCapability

  // A parameter property (`private constructor(readonly capability: ...)`) is
  // TypeScript-only syntax that Node's strip-only type loader rejects, and the
  // World factory imports this module as source (not through dist). Writing the
  // field out keeps the same nominal guarantee — the constructor is still the
  // only way to build one — while staying runnable as plain ESM.
  private constructor(capability: ReviewCapability) {
    this.capability = capability
  }
  /** @internal — only `evaluateReviewCapability` calls this. */
  static of(capability: ReviewCapability): ReviewCapabilityCandidate {
    return new ReviewCapabilityCandidate(Object.freeze(capability))
  }
}

/** The closed refusal vocabulary. */
export const REVIEW_CAPABILITY_REFUSALS = [
  'reviewer-not-member',
  'officer-not-resolved',
  'reviewer-not-current-officer',
  'officer-template-mismatch',
  'operation-owner-unknown',
  'operation-tool-unknown',
  'operation-owner-is-officer',
  'leader-exception',
  'fixed-leader-or-human-category',
  'requires-human',
  'case-not-pending',
  'leg-not-leader-rung',
  'not-ordinary-ask',
  'transfer-overrides-delegation',
  'blueprint-routing-absent',
  'blueprint-mismatch',
  'authority-generation-mismatch',
  'scope-mismatch',
  'effect-set-mismatch',
  'escalation-successor-not-human',
  'officer-acted-on-earlier-leg',
  'terminal-close-not-delegable',
  'entry-not-allowed',
] as const
export type ReviewCapabilityRefusal = (typeof REVIEW_CAPABILITY_REFUSALS)[number]

/** The evaluation result: an opaque candidate or a typed refusal. */
export type ReviewCapabilityEvaluation =
  | { readonly ok: true; readonly candidate: ReviewCapabilityCandidate }
  | { readonly ok: false; readonly code: ReviewCapabilityRefusal; readonly reason: string }

/** The durable decision evidence; same decision row, not a second ledger. */
export interface DecisionCapabilityEvidence {
  readonly source: ReviewCapabilitySource
  readonly entry: ReviewCapabilityEntry
  readonly effectiveReviewAuthority: ProposalAuthorityPosition
  readonly approvalCaseId: string
  readonly currentLegRequestId: string
  readonly legOrdinal: number
  readonly scopeFingerprint: string
  readonly effectSetFingerprint?: string
  readonly blueprintContentHash: string
  readonly blueprintRevision: string
  readonly authorityGeneration: number
  readonly operationOwnerInstanceId: string
  readonly operationOwnerTemplateId: string
  readonly operationToolDefinitionIdentity: string
}
