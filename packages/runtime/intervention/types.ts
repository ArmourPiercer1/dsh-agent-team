/**
 * Alpha.4 A4-PR3 — the Intervention projection's TYPE layer (spec §14,
 * §11.5, §11.6; ADR A1-7, A1-12, A1-17, A2-1, A5-2, A5-16, X8).
 *
 * What this module is:
 *
 * - A NON-AUTHORITATIVE read model. An `InterventionItem` is a derived view
 *   over durable rows (the Control plane's leg rows and escalation facts in
 *   this PR); it is never a source of authority, and nothing in the write
 *   path consults it (spec §14.2 "Intervention is never an authority
 *   source"). ADR A1-17 makes that structural: the lane-hygiene guard
 *   `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts` forbids an
 *   import edge from the evaluator, the authority kernel, the Control
 *   service or the operation guard INTO `intervention/**`, so a projection
 *   field cannot be reached from a decision even by accident. The pin lives
 *   in `a4p3-intervention-projection.test.ts` alongside the behavioural half
 *   (mutating a projected item leaves the guard verdict unchanged).
 *
 * What this module is deliberately NOT:
 *
 * - It is not the ceiling algebra. Legality arrives through an INJECTED
 *   reader callback ({@link RequiredAuthorityReader}): PR3 produces the
 *   outcome vocabulary and the derivation law only, and the plan's binding
 *   lane-B ruling is that this module must not import `grantCeiling` or any
 *   other `CEILING_LANE`-only governance name. The facts therefore arrive
 *   as closed boolean/value fields computed by the caller — which also
 *   removes any temptation to re-spell the authority ladder or its ordering
 *   here (X7-R3: the ladder vocabulary stays
 *   {@link ProposalAuthorityPosition}'s, and `AUTHORITY_RANK` stays the one
 *   ordering in the repository).
 * - Not a writer: no function here returns a promise, touches a repository,
 *   or accepts a caller-chosen authority.
 * - Not the whole projection surface: the Compatibility and
 *   GovernanceWarning sources are PR6's (spec §16), and the client's
 *   `INTERNAL_FACT_TYPES` mapping — which decides whether the escalation and
 *   abandonment rows render as anything but generic Events — is PR6's too
 *   (ADR A5-7); PR3 discloses that interim state rather than fixing it here.
 *
 * @module @dsh-agent-team/runtime/intervention
 */

import type { ControlRequestKind, ControlSubject } from '../control/types.js'
import type { PermissionOverlayEffect } from '../../storage/schema/permission-overlay.js'
import type { ProposalAuthorityPosition } from '../governance/proposal-store.js'

/**
 * The projection kind (spec §14.1). `warning` and `error` are declared now
 * because the CLOSED set is part of the frozen contract PR6/PR7 build on;
 * A4-PR3 only ever produces `approval` items.
 */
export const INTERVENTION_KINDS = {
  APPROVAL: 'approval',
  WARNING: 'warning',
  ERROR: 'error',
} as const

/** One of the closed intervention kinds. */
export type InterventionKind = (typeof INTERVENTION_KINDS)[keyof typeof INTERVENTION_KINDS]

/** Every closed intervention kind value. */
export const INTERVENTION_KIND_VALUES: readonly InterventionKind[] = Object.values(INTERVENTION_KINDS)

/**
 * Whether the item expects an answer (spec §14.1). The distinction is
 * load-bearing, not cosmetic: `wait-for-response` is the state in which a
 * reviewer is expected to act, and ADR A1-12 / spec §11.6 forbid a case with
 * no possible reviewer from ever sitting in it — such a case terminates
 * synchronously and is surfaced `informational`.
 */
export const INTERVENTION_RESPONSE_BEHAVIORS = {
  INFORMATIONAL: 'informational',
  WAIT_FOR_RESPONSE: 'wait-for-response',
} as const

/** One of the closed response behaviours. */
export type InterventionResponseBehavior =
  (typeof INTERVENTION_RESPONSE_BEHAVIORS)[keyof typeof INTERVENTION_RESPONSE_BEHAVIORS]

/**
 * The actionability status (spec §14.1).
 *
 * `authority-unavailable` is the projection of spec §11.6's terminal case
 * ("do not create a pending Admin leg; terminate the case as
 * `authority-unavailable`; surface typed Admin-required result and
 * InterventionItem"). It is a TERMINAL status: an item that carries it is
 * `informational`, has no legal actions, and never counts as a pending
 * review — the value exists in the vocabulary because §14.1 freezes it, and
 * the law that matters is that it is never `wait-for-response`.
 *
 * There is no `abandoned` status: an abandoned leg means the invocation the
 * item existed for is gone, which is exactly what `stale` says here (the
 * mapping is recorded once, in `projection.ts`, and pinned by
 * `a4p3-intervention-projection.test.ts`).
 */
export const INTERVENTION_STATUSES = {
  OPEN: 'open',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  AUTHORITY_UNAVAILABLE: 'authority-unavailable',
  STALE: 'stale',
} as const

/** One of the closed actionability statuses. */
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[keyof typeof INTERVENTION_STATUSES]

/** Every closed intervention status value. */
export const INTERVENTION_STATUS_VALUES: readonly InterventionStatus[] = Object.values(
  INTERVENTION_STATUSES,
)

/**
 * What the item holds back (spec §14.1). `null` means it holds nothing back:
 * a terminal item and an A1-12 zero-leg item both carry `null`, because
 * there is no live hold to describe — the invocation is already terminated.
 */
export type InterventionBlockScope =
  | null
  | { readonly kind: 'configuration-operation'; readonly operationId: string }
  | { readonly kind: 'operation'; readonly operationFingerprint: string }
  | { readonly kind: 'subject-new-work'; readonly subject: ControlSubject }
  | { readonly kind: 'team-new-work'; readonly teamSessionId: string }

/**
 * The actions a reviewer may take (spec §11.5, §17.3). `escalate` is a
 * REVIEWER ACTION and never a durable decision value (ADR A2-1 / A3-3, spec
 * §25.1): the same word naming two different planes is exactly the confusion
 * that guard keeps out, which is why this set is spelled from the Control
 * plane's own reviewer-action vocabulary rather than the decision vocabulary.
 */
export const INTERVENTION_ACTIONS = {
  ALLOW: 'allow',
  DENY: 'deny',
  ESCALATE: 'escalate',
} as const

/** One of the closed reviewer actions. */
export type InterventionAction = (typeof INTERVENTION_ACTIONS)[keyof typeof INTERVENTION_ACTIONS]

/** Every closed reviewer-action value. */
export const INTERVENTION_ACTION_VALUES: readonly InterventionAction[] = Object.values(
  INTERVENTION_ACTIONS,
)

/**
 * The WARNING-plane action value as the projection renders it (A4-PR6,
 * spec §15). Declared as a LOCAL literal — this lane holds no import edge
 * into `governance-warning/**` (and that lane holds none here); the two
 * spellings are pinned MUTUALLY ASSIGNABLE by `a4p6-governance-warning.test.ts`.
 *
 * `acknowledge` is NOT a reviewer action and never enters
 * {@link INTERVENTION_ACTIONS}: a warning ack changes reminder state only
 * (spec §15.5), while `allow | deny | escalate` resolve approval legs.
 */
export type InterventionWarningActionValue = 'acknowledge'

/**
 * The element type of a projected item's `legalActions`: the UNION of the
 * plane-specific action vocabularies — reviewer actions on approval items,
 * the warning action on warning items — and NEVER a fourth, global action
 * vocabulary. Which plane an action belongs to is decided by the item's
 * SOURCE KIND, server-side (6.B routes `intervention.act` by it); the union
 * here exists because ONE rendering surface carries two planes (coordination
 * ruling on the vocabulary-drift class).
 */
export type InterventionItemAction = InterventionAction | InterventionWarningActionValue

/** Why a derivation produced what it produced (closed, for the UI and tests). */
export const INTERVENTION_DERIVATION_REASONS = {
  /** The current leg is pending and its reviewer may act. */
  LEG_OPEN: 'leg-open',
  /** The leg is closed by a durable decision. */
  LEG_DECIDED: 'leg-decided',
  /** The leg was durably abandoned by its caller. */
  LEG_ABANDONED: 'leg-abandoned',
  /** The acting principal already acted on an earlier leg of this case. */
  REVIEWER_ALREADY_ACTED: 'reviewer-already-acted',
  /** No resolver exists for the rung that would have to decide (A1-12). */
  NO_RESOLVER: 'no-resolver',
  /** A ceiling could not be computed for the scope (A1-7, A5-2). */
  CEILING_UNDETERMINED: 'ceiling-undetermined',
  /**
   * A4-PR6 (spec §15): a durable envelope-consistency warning is observed
   * and UNACKNOWLEDGED — the item exists because of the diagnostic, and the
   * only legal action is the warning-plane `acknowledge`.
   */
  WARNING_OBSERVED: 'warning-observed',
  /** A4-PR6 (spec §15.5): the warning's fingerprint is acknowledged —
   *  reminder state; the item stays visible, no action remains open. */
  WARNING_ACKNOWLEDGED: 'warning-acknowledged',
  /** The reviewer's reach does not cover the requested effect. */
  INSUFFICIENT_REACH: 'insufficient-reach',
  /** A top-of-ladder reviewer may decide but not rise. */
  TOP_OF_LADDER: 'top-of-ladder',
} as const

/** One closed derivation reason. */
export type InterventionDerivationReason =
  (typeof INTERVENTION_DERIVATION_REASONS)[keyof typeof INTERVENTION_DERIVATION_REASONS]

/** The durable origin of an item (spec §14.1 `source`). */
export const INTERVENTION_SOURCE_KINDS = {
  CONTROL_CASE: 'control-case',
  /** PR6: envelope-consistency warnings (spec §15). */
  GOVERNANCE_WARNING: 'governance-warning',
  /** PR6: compatibility admission state (spec §16). */
  COMPATIBILITY: 'compatibility',
} as const

/** One closed source kind. */
export type InterventionSourceKind =
  (typeof INTERVENTION_SOURCE_KINDS)[keyof typeof INTERVENTION_SOURCE_KINDS]

/** The durable row set an item was derived from, and its carrier identity. */
export interface InterventionSource {
  readonly kind: InterventionSourceKind
  /** The approval case (strict rows) or the carrier request (legacy rows). */
  readonly id: string
  /** The durable request row the CURRENT leg is carried by, when one exists. */
  readonly requestId?: string
  /** The leg ordinal this item was derived at. */
  readonly legOrdinal?: number
  /**
   * The carrier kind, disclosed as the compatibility carrier it is (spec 19).
   * Typed as the CLOSED `ControlRequestKind` (audit F15): a bare `string` would
   * let a projection publish a carrier the control plane never admits, and the
   * client could not switch on it without re-validating.
   */
  readonly carrierKind?: ControlRequestKind
}

/**
 * The projected item (spec §14.1). Every field is derived; none of them is
 * accepted as input by any write path (spec §17.3: the client must not
 * submit review authority, required authority, legal actions or a role).
 */
export interface InterventionItem {
  readonly interventionId: string
  readonly kind: InterventionKind
  readonly responseBehavior: InterventionResponseBehavior
  readonly blockScope: InterventionBlockScope
  readonly source: InterventionSource
  readonly status: InterventionStatus
  readonly requiredAuthority?: ProposalAuthorityPosition
  readonly currentReviewAuthority?: ProposalAuthorityPosition
  readonly legalActions: readonly InterventionItemAction[]
  readonly derivationReasons: readonly InterventionDerivationReason[]
  readonly fingerprint?: string
  readonly createdAt: string
  readonly updatedAt?: string
  readonly lastObservedAt?: string
  readonly observationCount?: number
}

/**
 * The facts the legality law needs, supplied by the caller's
 * governance-backed reader (the lane-B design ruling: a READER CALLBACK, so
 * this module never reaches into `CEILING_LANE`-only names).
 *
 * Deliberately ABSENT:
 * - `requiredAuthorityAtCreation` — the additive leg field is PROVENANCE
 *   ONLY (spec §11.2): legality is re-derived fresh from the current
 *   documents, so the creation-time value is not an input to the law at all
 *   (pinned by `a4p3-intervention-projection.test.ts`).
 * - any ladder rank or ordering: the comparison is the reader's job, and
 *   re-spelling it here would create the second ordering X7-R3 forbids.
 */
export interface RequiredAuthorityFacts {
  /** The FRESH required authority for this scope (ladder + ceiling reach). */
  readonly requiredAuthority: ProposalAuthorityPosition
  /** Is the leg's reviewer at or above that rung? */
  readonly reviewerAtOrAboveRequiredAuthority: boolean
  /** Does the reviewer's `grantCeiling` cover the requested effect? */
  readonly desiredEffectWithinGrantCeiling: boolean
  /** Was a ceiling undecidable for the scope? Absorbing: never `allow` (A5-2). */
  readonly ceilingUndetermined: boolean
  /*
   * DELIBERATELY ABSENT (audit F1): a `successorHasResolver` fact. Whether the
   * rung ABOVE EXISTS is a property of the frozen ladder and is read off
   * `requiredAuthority`; whether a rung has a RESOLVER is build availability.
   * The first decides escalate legality (spec 11.5: `reviewAuthority <
   * human-admin`), the second only what the act then DOES (ADR A1-12 / spec
   * 11.6: the rise closes the case `authority-unavailable` instead of minting a
   * leg). One key carrying both made every Human-User leg look top-of-ladder,
   * which is how spec 21.5's "sufficient non-admin: allow/escalate/deny" was
   * lost in the implementation. Pinned by `a4p3-intervention-projection.test.ts`.
   */
  /** Has the acting principal already decided or escalated an earlier leg? */
  readonly principalAlreadyActed: boolean
  /** Does THIS leg's review rung have a resolver at all (A1-12)? */
  readonly resolverExists: boolean
}

/** The scope a required-authority reader is asked about. */
export interface RequiredAuthorityReaderInput {
  readonly approvalCaseId: string
  readonly legOrdinal: number
  readonly reviewAuthority: ProposalAuthorityPosition
  readonly beneficiaryAuthority: ProposalAuthorityPosition
  readonly requestedEffect: PermissionOverlayEffect
  readonly subject: ControlSubject
  readonly actionName: string
  readonly operationFingerprint?: string
  readonly mutationProposalFingerprint?: string
}

/**
 * The injected reader (the ONLY governance-shaped knowledge lane B is
 * allowed to hold, and it holds it as a function pointer, not an import).
 *
 * TWO things the signature must admit, both because a reader that cannot
 * answer is a normal production state and must never be answered on its
 * behalf (audit F6):
 *
 * - `undefined` = "no facts". The projection then publishes NO
 *   `requiredAuthority` and offers NO legal action; it does not substitute the
 *   leg's own rung, which is what an authority-looking field built from a
 *   missing read amounts to (spec 18.3, A5-2);
 * - a `Promise` = the governance reads behind PR4's implementation are
 *   asynchronous (the ceiling documents are read, not held). The projection is
 *   already asynchronous, so admitting it costs nothing and removes a blocker
 *   from the lane that owns the implementation.
 *
 * @param input - the scope being reviewed.
 * @returns the closed facts the legality law consumes, or nothing.
 */
export type RequiredAuthorityReader = (
  input: RequiredAuthorityReaderInput,
) => RequiredAuthorityFacts | undefined | Promise<RequiredAuthorityFacts | undefined>
