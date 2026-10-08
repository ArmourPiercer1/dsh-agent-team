/**
 * P6-T4 — the durable control/approval vocabulary.
 *
 * Target state (Development Plan 19.4, Architecture 25):
 *
 * ```
 * ControlRequest durable in TeamDomain
 * ControlDecision durable in TeamDomain
 * actual tool operation still goes through DSH tool pipeline
 * ```
 *
 * This module defines the closed vocabulary of the control plane;
 * `service.ts` implements it over the injected TeamDomain repositories
 * (invariant 41: TeamDomain is the Team control-plane durable authority)
 * and the REUSED P6-T2 facade authority steps (`resolveTeamAndTarget` /
 * `resolveCaller` / `callerEnvelope` + `enforceEnvelope` — integration,
 * not a second authority path).
 *
 * Scope model (documented ruling; requirement: "an allow decision
 * authorizes exactly the requested operation scope"):
 *
 * ```
 * ControlOperationScope =
 *   (rootSessionId, targetInstanceId, actionName,
 *    toolName?, capabilityDomain?, correlation,
 *    operationFingerprint?)
 * ```
 *
 * - `targetInstanceId` — the instance the operation is addressed to
 *   (instanceId-first, invariant 18/19);
 * - `actionName` — the logical operation being requested (opaque,
 *   non-empty; e.g. a TeamRuntime action name or a tool-pipeline
 *   operation name);
 * - `toolName` — present when the operation is a DSH tool-pipeline
 *   operation (the last-mile guard's subject);
 * - `capabilityDomain` — optional explicit capability domain the operation
 *   exercises (closed `CapabilityName` set); ABSENT + `toolName` present
 *   means `tools`; ABSENT + no `toolName` means the external hard policy
 *   expresses no cell for the operation (the Team-owned admission that
 *   gated the request is the whole check);
 * - `correlation` — the caller's STABLE LOGICAL-OPERATION token (the
 *   requestToken): the identity that ties the request, the decision and
 *   the guarded tool call to ONE logical operation (Architecture 18.2);
 * - `operationFingerprint` — OPTIONAL (alpha.2 exact-scope extension):
 *   the resource + payload IMPACT identity of the operation (e.g. the
 *   canonical target resource + content impact of a write). ABSENT = the
 *   legacy scope identity (existing durable Control rows keep working
 *   unchanged); PRESENT = the approval is bound to the exact fingerprint.
 *   When present it participates in the scope's IDENTITY (the scope key
 *   and the decision-scope snapshot) and in the REQUEST IDEMPOTENCY key:
 *   two scopes identical except for the fingerprint are different scopes
 *   and never share a request, a decision or an allow. It is strictly
 *   SEPARATE from `correlation` (the logical invocation id, e.g. the tool
 *   callId): the fingerprint is NOT a correlation substitute — the same
 *   write content under a NEW correlation starts a NEW independent
 *   approval, and the same correlation under a DIFFERENT fingerprint is
 *   a different request (payload/resource mismatch is never reused).
 *
 * An allow decision is scoped to EXACTLY this tuple and is CONSUMED
 * EXACTLY ONCE by the last-mile guard (check-and-reserve under the
 * per-team lock): a second identical attempt — same tuple, same
 * correlation, same fingerprint — finds the consumed decision and is
 * BLOCKED; a new attempt at the operation must create a NEW control
 * request with a NEW correlation (no reuse).
 *
 * Pre-Alpha.3 PR-D (plan §D — Control Plane Generalization): the
 * instance-only approval service generalizes to the unified durable
 * decision plane (the Recovery inline Human Review substrate):
 *
 * - the CANONICAL subject (`ControlSubject` — D.2): the scope's second
 *   identity element is the SUBJECT, closed three-kind
 *   `instance | template | team`. `targetInstanceId` is KEPT (additive,
 *   not removed) as the legacy read-compatibility projection of an
 *   INSTANCE subject; a durable row / scope carrying `targetInstanceId`
 *   but NO explicit `subject` parses to
 *   `subject = { kind: 'instance', instanceId: targetInstanceId }`
 *   (byte-identical semantics — old durable rows keep working
 *   unchanged, no migration). The scope key derives from the SUBJECT id
 *   (instance → instanceId, template → templateId, team → rootSessionId);
 *   for a legacy instance row the subject id IS `targetInstanceId`, so
 *   the key is byte-identical to the pre-PR-D key;
 * - the REVIEW PAYLOAD (D.3): the additive optional request fields
 *   `reviewPayload?` (the lossless-JSON value the Remote/UI must display
 *   losslessly — the Recovery reviewed invocation), `reviewPayload-
 *   Digest?` (its stable digest string) and `executionCoupling?` (closed
 *   `guarded | inline`). ABSENT = legacy semantics (byte-identical for
 *   old rows);
 * - the TWO COUPLINGS (D.4): `guarded` (the existing flow: request →
 *   wait → decision → guard → consume → execute — unchanged) and the NEW
 *   `inline` (request → wait → decision; on `allow` the current frozen
 *   invocation continues — NO `control-allow-consumed` fact is written,
 *   the allow is not consumed by a guard; on `deny` zero effect; on
 *   `abort` the NEW additive close fact `control-request-abandoned` is
 *   durably recorded — the append-only ledger has no delete primitive —
 *   and the request state becomes DERIVED: `pending | decided |
 *   abandoned`, with the abandon fact the TERMINAL mark (like
 *   `stale-denied`): an abandoned request can never become an allow, and
 *   the last-mile guard sees the abandon and blocks.
 *
 * Synchronous wait bridge (alpha.2 §9.4): `ControlService.
 * awaitControlDecision` is the minimal liveness bridge over the SAME
 * durable rows — it polls the durable control state (the authority is
 * ALWAYS the durable rows; the waiter adds no authority) until a
 * decision for the requestId appears (resolve), the caller's signal
 * aborts (typed CONTROL_WAIT_ABORTED) or the durable control plane is
 * closed (typed CONTROL_WAIT_CLOSED). No durable waiter scheduler, no
 * cross-process continuation.
 *
 * @module @dsh-agent-team/runtime/control/types
 */

import type { RemoteSafeJsonValue } from '../../contracts/src/index.js'
import type { CapabilityName } from '../../domain/policy/src/index.js'
import type { ActionCaller } from '../admission/index.js'
// Alpha.4 (A4-PR3) — the approval-case ladder and the requested effect are
// DERIVED THROUGH THE MODULES THAT OWN THEIR VOCABULARY (ADR X7-R3: a
// re-spelled ladder union passes every structural test, so the only legal
// spelling is the owner's alias). Both edges are `import type`: they are
// erased at emit, so the Control plane gains no runtime edge to the
// governance lane and `dist/packages/runtime/control/**` stays the only
// emitted control surface.
// `ProposalAuthorityPosition` IS the runtime ladder: ADR X7-R3 makes
// `RuntimeAuthority` a type alias of it, and the a3p3 governance-lane
// hygiene pin allows the NAME `RuntimeAuthority` in exactly four files,
// with "sanctioned route: none" for widening that set — so the Control lane
// names the durable owner, never the alias.
import type { ProposalAuthorityPosition } from '../governance/proposal-store.js'
import type { PermissionOverlayEffect } from '../../storage/schema/permission-overlay.js'

// --- request kinds ------------------------------------------------------------------

/**
 * The closed control request kinds (Architecture 25.1: a member may meet
 * an operation beyond its autonomy boundary that a higher authority may
 * decide).
 */
export const CONTROL_REQUEST_KINDS = {
  /** Request the LEADER's approval of the operation. */
  LEADER_APPROVAL: 'leader-approval',
  /** Request EXPLICIT USER (human) approval of the operation. */
  USER_APPROVAL: 'user-approval',
  /** Request a mutation inside the leader-authorized envelope. */
  ENVELOPE_MUTATION: 'envelope-mutation',
} as const

/** One of the closed control request kinds. */
export type ControlRequestKind = (typeof CONTROL_REQUEST_KINDS)[keyof typeof CONTROL_REQUEST_KINDS]

/** Every control request kind value, for membership checks. */
export const CONTROL_REQUEST_KIND_VALUES: readonly string[] = Object.values(CONTROL_REQUEST_KINDS)

/**
 * The closed resolver ROLE SET per request kind (who may resolve):
 *
 * - `leader-approval` -> { leader, human }: the leader decides; the human
 *   may always stand in (invariant 34: the human exceeds the team
 *   autonomy boundary, never the external hard policy);
 * - `user-approval`   -> { human }: EXPLICIT user approval — the leader
 *   cannot stand in for the user (that would defeat the kind);
 * - `envelope-mutation` -> { leader, human }: the leader's envelope is
 *   the subject; the human may stand in.
 *
 * A MEMBER is never a resolver for any kind (invariant 37: no
 * self-escalation) — even when the member's template envelope allows the
 * `resolve-control` op: the role closure is checked before the envelope.
 */
export const CONTROL_RESOLVER_ROLES: Record<ControlRequestKind, readonly string[]> = {
  'leader-approval': ['leader', 'human'],
  'user-approval': ['human'],
  'envelope-mutation': ['leader', 'human'],
}

// --- decisions ------------------------------------------------------------------------

/**
 * The closed durable decision values of the control plane.
 *
 * Distinct from the P6-T2 facade's generic coordination payload
 * vocabulary (`CONTROL_DECISION_VALUES` = approved/denied, an evidence
 * payload of the facade's request-control/resolve-control facts): this is
 * the decision value of the DURABLE ControlDecision row.
 */
export const CONTROL_DECISION_VALUES = {
  /** The operation's exact scope is authorized — exactly once (consumed
   *  by the last-mile guard). */
  ALLOW: 'allow',
  /** The operation's exact scope is refused (no consumption state: a
   *  denied scope can never execute through the guard). */
  DENY: 'deny',
  /** Stale-denied: the decision was recorded for a request whose target
   *  had become terminal (or whose team session had vanished) at
   *  decision time. The request is CLOSED and can never become an allow
   *  (fail closed; the append-only ledger has no "mark" primitive, so
   *  this decision row IS the stale mark). */
  STALE_DENIED: 'stale-denied',
} as const

/** One of the closed durable decision values. */
export type ControlDecisionValue = (typeof CONTROL_DECISION_VALUES)[keyof typeof CONTROL_DECISION_VALUES]

/** Every durable decision value, for membership checks. */
export const CONTROL_DECISION_VALUE_VALUES: readonly string[] = Object.values(CONTROL_DECISION_VALUES)

/**
 * The closed durable-decision reason vocabulary (ABSENT = an ordinary
 * allow/deny; a reason is present only for the documented special
 * outcomes).
 */
export const CONTROL_DECISION_REASONS = {
  /** The allow was impossible: the external hard policy denies the
   *  operation's capability cell (recorded as a `deny` decision —
   *  Architecture 25.4 / invariant 34). */
  EXTERNAL_POLICY: 'external-policy',
  /**
   * The reviewer ESCALATED the case: this row is the terminal decision of
   * the closing leg (Alpha.4 A4-PR3, ADR A5-5, spec 11.3). It is a `deny`
   * — never a fourth decision value (A2-1 / A3-3) — written in the SAME
   * durable transaction as the `control-escalation-recorded` leg fact and
   * the risen leg, so a closing leg is never left pending.
   *
   * WHY THIS VALUE IS LOAD-BEARING: `parseDecisionPayload` fails closed by
   * DROPPING the whole row when `reason` is outside this closed set
   * (service.ts:727-730). An `escalated` deny written while this vocabulary
   * lacked the value would be invisible at read time: the leg would look
   * PENDING forever, `awaitControlDecision` would never settle, and the
   * escalation would hang with nothing red. Pinned by
   * `a4p3-approval-escalation.test.ts` (preflight no-red finding 2).
   */
  ESCALATED: 'escalated',
} as const

/** One of the closed durable-decision reasons. */
export type ControlDecisionReason = (typeof CONTROL_DECISION_REASONS)[keyof typeof CONTROL_DECISION_REASONS]

/** Every durable-decision reason value, for membership checks. */
export const CONTROL_DECISION_REASON_VALUES: readonly string[] = Object.values(CONTROL_DECISION_REASONS)

/**
 * The closed reviewer-ACTION vocabulary (Alpha.4 A4-PR3, spec 11.5, ADR
 * A2-1 / A3-3).
 *
 * This is a DIFFERENT axis from {@link CONTROL_DECISION_VALUES}: `escalate`
 * is an action a reviewer may take, whose durable consequence is the
 * additive leg fact plus a terminal `deny`/`escalated` decision row on the
 * closing leg. `escalate` MUST NOT enter `CONTROL_DECISION_VALUES` (A2-1):
 * a fourth decision value would make the first `escalate` row an implicit
 * approval at any consumer that branches "if deny … else allow".
 */
export const CONTROL_REVIEW_ACTIONS = {
  ALLOW: 'allow',
  DENY: 'deny',
  ESCALATE: 'escalate',
} as const

/** One of the closed reviewer actions. */
export type ControlReviewAction = (typeof CONTROL_REVIEW_ACTIONS)[keyof typeof CONTROL_REVIEW_ACTIONS]

/** Every reviewer action, for membership checks. */
export const CONTROL_REVIEW_ACTION_VALUES: readonly string[] = Object.values(CONTROL_REVIEW_ACTIONS)

// --- Alpha.4 approval cases and review legs (A4-PR3) -----------------------------------

/**
 * The authority ladder a review leg is bound to, expressed as the
 * escalation ROUTING table of spec 11.4 ("new request leg is created for
 * the next RuntimeAuthority").
 *
 * The type is the exhaustive `Record`, so the table's KEY SET is the ladder
 * vocabulary the compiler can see: a rung added to
 * {@link ProposalAuthorityPosition} without a successor here is a compile
 * error, and nothing here re-spells the ladder union (ADR X7-R3). It is
 * deliberately NOT a ranking: `AUTHORITY_RANK` in
 * `governance/authority-ceiling.ts` stays the one ordering in the
 * repository (ADR X2), and this module never compares two rungs — it only
 * answers "who does this case rise to next", which is a routing fact of the
 * approval plane, not a ceiling fact.
 *
 * `null` is the top of the ladder: a leg raised from it has no reviewer to
 * rise to, which is exactly the `authority-unavailable` case of spec 11.6 /
 * ADR A1-12 (Human Admin has no production constructor in Alpha.4).
 */
export const CONTROL_ESCALATION_SUCCESSOR: Record<
  ProposalAuthorityPosition,
  ProposalAuthorityPosition | null
> = {
  member: 'leader',
  leader: 'human-user',
  'human-user': 'human-admin',
  'human-admin': null,
}

/**
 * Fail-closed membership test for a durable ladder value.
 *
 * A durable row naming anything else is CORRUPT, never defaulted: an
 * unknown review authority on a leg would otherwise read back as a leg
 * nobody can decide (A2-9 strictness at the Control boundary). Implemented
 * against {@link CONTROL_ESCALATION_SUCCESSOR}'s own key set, so the test
 * cannot drift from the ladder.
 *
 * @param value - the candidate value.
 * @returns whether `value` is one of the ladder positions.
 */
export function isProposalAuthorityPosition(value: unknown): value is ProposalAuthorityPosition {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(CONTROL_ESCALATION_SUCCESSOR, value)
  )
}

/**
 * The rung a case rises to from `position` (spec 11.4), or `null` at the
 * top of the ladder (spec 11.6).
 *
 * @param position - the closing leg's review authority.
 * @returns the successor position, or null when there is none.
 */
export function controlEscalationSuccessor(
  position: ProposalAuthorityPosition,
): ProposalAuthorityPosition | null {
  return CONTROL_ESCALATION_SUCCESSOR[position]
}

/**
 * The ladder rungs this build has NO resolver for (Alpha.4).
 *
 * ADR A1-12 names the fact literally: "cases whose required authority is
 * `human-admin` (unimplementable in Alpha.4)" must terminate synchronously
 * rather than wait for a reviewer who cannot exist — and acceptance 21.10
 * forbids an Admin case from reconstructing "as a fake pending Admin
 * request". This is an AVAILABILITY disclosure, not a ranking and not a
 * subset of the ladder vocabulary: the rungs stay
 * {@link ProposalAuthorityPosition}'s, and the table is the single place
 * that says which of them nobody can be. It only ever REMOVES a leg
 * (never authorizes one), so it cannot relax a ceiling.
 *
 * Human Admin authentication is an explicit Alpha.4 non-goal (spec 23); a
 * later PR that ships an Admin resolver removes the entry here and the two
 * synchronous-close gates in `service.ts` start admitting the rung.
 */
export const CONTROL_UNRESOLVABLE_AUTHORITIES: readonly ProposalAuthorityPosition[] = [
  'human-admin',
]

/**
 * Does this rung have a resolver in the current build?
 *
 * @param position - the ladder position to ask about.
 * @returns false exactly for {@link CONTROL_UNRESOLVABLE_AUTHORITIES}.
 */
export function hasAuthorityResolver(position: ProposalAuthorityPosition): boolean {
  return !CONTROL_UNRESOLVABLE_AUTHORITIES.includes(position)
}

/**
 * The closed `terminalReason` vocabulary (Alpha.4 A4-PR3, ADR A2-8,
 * spec 25.5): the reasons a leg terminates for, carried ADDITIVELY on the
 * terminal decision row instead of becoming a new decision value or a new
 * request status.
 *
 * `stale-denied` keeps its exact present meaning (the TARGET was terminal),
 * and `escalated` is a decision REASON (CONTROL_DECISION_REASONS), not a
 * terminal reason — so no value here duplicates either. Drift reasons were
 * otherwise homeless: A2-8 forbids inventing a fourth decision value for
 * them, and a fourth `ControlRequestStatus` would break every consumer that
 * switches on the three-value status.
 */
export const CONTROL_LEG_TERMINAL_REASONS = {
  /** The authority the case needs is no longer the authority the leg was
   *  written against (A2-8: the DRIFT, not the target, terminated the
   *  leg). */
  AUTHORITY_DRIFT: 'authority-drift',
  /** The resource identity behind the frozen fingerprint moved
   *  (A2-13 / 25.6: key inequality after resolve, same-path recreate
   *  included). */
  RESOURCE_IDENTITY_DRIFT: 'resource-identity-drift',
  /** No resolver exists for the authority this case needs (ADR A1-12,
   *  spec 11.6) — the case terminates instead of waiting. */
  RESOLVER_UNAVAILABLE: 'resolver-unavailable',
} as const

/** One of the closed leg terminal reasons. */
export type ControlLegTerminalReason =
  (typeof CONTROL_LEG_TERMINAL_REASONS)[keyof typeof CONTROL_LEG_TERMINAL_REASONS]

/** Every leg terminal reason, for membership checks. */
export const CONTROL_LEG_TERMINAL_REASON_VALUES: readonly string[] = Object.values(
  CONTROL_LEG_TERMINAL_REASONS,
)

/**
 * The FROZEN identity of one approval case (spec 11.1), read back from the
 * durable leg rows that carry it.
 *
 * A2-7: every field is DERIVED SERVER-SIDE from the leg rows — no caller
 * ever supplies an `ApprovalCaseIdentity` to a write path. `approvalCaseId`
 * is the deterministic identity hash of the frozen fields (see
 * `service.ts`), which is what makes a retry of the same logical flow land
 * on the same case instead of minting a second one.
 *
 * Exactly one of the two fingerprints is present:
 * `operationFingerprint` iff the case is an operation case, and
 * `mutationProposalFingerprint` iff it is an `envelope-mutation` case
 * (spec 11.1 — "exactly one of operation/mutation proposal fingerprints is
 * present").
 */
export interface ApprovalCaseIdentity {
  /** The stable case id (derived; see above). */
  readonly approvalCaseId: string
  /** The canonical subject the case is about. */
  readonly subject: ControlSubject
  /** Whose authority the case would raise (beneficiary, not reviewer). */
  readonly beneficiaryAuthority: ProposalAuthorityPosition
  /** The overlay effect the case asks for. */
  readonly requestedEffect: PermissionOverlayEffect
  /** Present iff this is an operation case. */
  readonly operationFingerprint?: string
  /** Present iff this is an `envelope-mutation` case. */
  readonly mutationProposalFingerprint?: string
  /**
   * The concrete AUTHORITY point the case was opened for (ADR A1-14,
   * A4-PR7 Task 7.0). Present on an OPERATION case — required there, exactly
   * like `operationFingerprint`: an operation approval whose ceiling point is
   * unknown cannot be re-confirmed at consumption, and "cannot be re-confirmed"
   * is a refusal, not a licence. Absent on an `envelope-mutation` case, whose
   * ceiling question is the proposal's own region and is re-checked by the
   * mutation lane's in-section revalidation instead.
   */
  readonly authorityScope?: ControlAuthorityScope
  /** The caller's correlation token (per-invocation identity). */
  readonly correlation: string
}

/**
 * The caller-visible shape of {@link ApprovalCaseIdentity} at creation:
 * every field except the derived `approvalCaseId` (A2-7 — the id is never
 * caller-chosen).
 */
export type ApprovalCaseIdentityInput = Omit<ApprovalCaseIdentity, 'approvalCaseId'>

/** The closed reasons an identity input can be refused for. */
export const APPROVAL_CASE_IDENTITY_PROBLEMS = {
  /** Neither or both fingerprints present (spec 11.1). */
  FINGERPRINT_CARDINALITY: 'fingerprint-cardinality',
  /** An operation case without an operationFingerprint (ADR A1-15). */
  OPERATION_FINGERPRINT_REQUIRED: 'operation-fingerprint-required',
  /** A mutation case naming no proposal fingerprint. */
  MUTATION_FINGERPRINT_REQUIRED: 'mutation-proposal-fingerprint-required',
  /** A ladder value outside the closed vocabulary (A2-9). */
  AUTHORITY_POSITION_UNKNOWN: 'authority-position-unknown',
  /** An effect outside the closed overlay effect vocabulary (A2-9). */
  EFFECT_UNKNOWN: 'effect-unknown',
  /** A subject that is not one of the closed canonical subjects. */
  SUBJECT_MALFORMED: 'subject-malformed',
  /**
   * An operation case that names no authority point (ADR A1-14, A4-PR7 Task
   * 7.0). The sibling of `OPERATION_FINGERPRINT_REQUIRED`: the fingerprint says
   * *which invocation*, the authority scope says *over what*, and the
   * consumption-point re-check needs the second one. Post-cutover there is no
   * transitional shape to fall back to, so the write is refused rather than
   * defaulted.
   */
  AUTHORITY_SCOPE_REQUIRED: 'authority-scope-required',
} as const

/** One closed identity-refusal reason. */
export type ApprovalCaseIdentityProblem =
  (typeof APPROVAL_CASE_IDENTITY_PROBLEMS)[keyof typeof APPROVAL_CASE_IDENTITY_PROBLEMS]

/**
 * The additive `control-escalation-recorded` leg fact (ADR A3-12(ii),
 * spec 11.3/11.4): the durable record that a reviewer raised the case.
 *
 * The payload field set is FROZEN at exactly
 * `{ approvalCaseId, legOrdinal, previousRequestId, escalatedBy, reason }`
 * (A3-12(ii)); `previousRequestId` is the ONLY parent pointer (A3-12(iii)
 * — no `parentCaseId`, no copied identity blob: the chain is reconstructed
 * from the leg rows, each of which carries the frozen identity).
 */
export interface ControlEscalationRecord {
  /** The case that rose. */
  readonly approvalCaseId: string
  /** The ordinal of the leg this escalation CLOSED. */
  readonly legOrdinal: number
  /** The requestId of the closed leg (A1-10: escalation never reuses it). */
  readonly previousRequestId: string
  /** Who escalated (a principal, not a leg — ADR A1-10 / 24.5). */
  readonly escalatedBy: ControlCallerRef
  /** Evidence text (never authority). */
  readonly reason?: string
  /** The ledger sequence of this leg fact. */
  readonly escalationSequence: number
  /** Fact creation time, ISO-8601. */
  readonly createdAt: string
}

/**
 * The derived state of one approval case, reconstructed from durable rows
 * only (ADR A1-17: the case is a DERIVED view; nothing here is a second
 * durable authority).
 */
export interface ApprovalCaseState {
  /** The frozen identity, read off the first leg. */
  readonly identity: ApprovalCaseIdentity
  /** Every leg of the case in ascending `legOrdinal` order. */
  readonly legs: readonly ControlRequestRecord[]
  /** Every escalation leg fact in ascending ordinal order. */
  readonly escalations: readonly ControlEscalationRecord[]
  /** The highest-ordinal leg — the one a reviewer may still act on. */
  readonly currentLeg?: ControlRequestRecord
  /** The case outcome: `open` while the current leg is pending, `decided`
   *  when it carries a decision, `abandoned` when it carries the abandon
   *  mark (the abandon fact stays the terminal mark of ITS LEG only —
   *  A1-10: an abandon never closes a case). */
  readonly status: 'open' | 'decided' | 'abandoned'
  /** The terminal decision of the current leg, when it has one. */
  readonly terminalDecision?: ControlDecisionRecord
  /**
   * The principals that have ALREADY acted on an earlier leg of this case
   * (ADR A1-10 / 24.5: a set of principals, not of legs). A principal in
   * this set may not act on a later leg — that is the durable backing for
   * "an escalated-away reviewer cannot come back and allow" (spec 11.4).
   */
  readonly reviewedBy: readonly ControlCallerRef[]
}

/** The closed reasons `readApprovalCaseState` can refuse to build a case. */
export const APPROVAL_CASE_READ_PROBLEMS = {
  /** No durable row carries the requested case id. */
  NOT_FOUND: 'not-found',
  /** A leg row carries a case id but no / a corrupt leg ordinal. */
  LEG_ORDINAL: 'leg-ordinal',
  /** A leg row's review authority is outside the closed ladder. */
  REVIEW_AUTHORITY: 'review-authority',
  /** Two legs of one case disagree about the frozen identity (A1-10). */
  IDENTITY_DISAGREEMENT: 'identity-disagreement',
  /** A leg ordinal appears twice, or the chain is not a 1-based sequence. */
  CHAIN_BROKEN: 'chain-broken',
} as const

/** One closed case-read problem. */
export type ApprovalCaseReadProblem =
  (typeof APPROVAL_CASE_READ_PROBLEMS)[keyof typeof APPROVAL_CASE_READ_PROBLEMS]

/** The typed read outcome for one approval case (A2-9: corrupt, never guess). */
export type ApprovalCaseReadOutcome =
  | { readonly kind: 'case'; readonly state: ApprovalCaseState }
  | {
      readonly kind: 'problem'
      readonly problem: ApprovalCaseReadProblem
      readonly approvalCaseId: string
      readonly sequence?: number
      readonly detail: string
    }

/**
 * The terminal outcome of a case that can produce no reviewable leg, or of
 * an escalation that has no rung left to rise to (ADR A1-12, spec 11.6).
 *
 * It is a RESULT, not a status: `authority-unavailable` is never an
 * InterventionItem status (ADR X8-R2) and never a request status
 * (`ControlRequestStatus` stays the three-value vocabulary).
 */
export const CONTROL_CASE_TERMINAL_OUTCOMES = {
  /** No resolver exists / no rung left (spec 11.6). */
  AUTHORITY_UNAVAILABLE: 'authority-unavailable',
} as const

/** One closed case terminal outcome. */
export type ControlCaseTerminalOutcome =
  (typeof CONTROL_CASE_TERMINAL_OUTCOMES)[keyof typeof CONTROL_CASE_TERMINAL_OUTCOMES]

/**
 * The CALLER-VISIBLE outcome of raising a leg (ADR A3-12(i); audit F7).
 *
 * `escalated` appears HERE and nowhere else in the vocabularies: it is not a
 * decision value (ADR A2-1 keeps `allow | deny | stale-denied` closed), not a
 * request status, and not a terminal outcome — the case CONTINUED, at the rung
 * above. Before this table existed the cell was a bare string literal in
 * `ControlEscalationOutcome`, so a caller had no frozen vocabulary to switch on
 * and `terminalDecisionValueFor` could not name it (it takes a terminal reason,
 * and an escalation is not one).
 *
 * Every terminal outcome is also a case outcome (`authority-unavailable` is the
 * one Alpha.4 has), and the containment is pinned by
 * `a4p3-approval-escalation.test.ts` so the two tables cannot drift apart.
 */
export const CONTROL_CASE_OUTCOMES = {
  /** A leg closed and the case ROSE: a new leg exists at the next rung. */
  ESCALATED: 'escalated',
  /** The case closed because no rung (or no resolver) is left (spec 11.6). */
  AUTHORITY_UNAVAILABLE: CONTROL_CASE_TERMINAL_OUTCOMES.AUTHORITY_UNAVAILABLE,
} as const

/** One closed caller-visible case outcome of a leg raise. */
export type ControlCaseOutcome = (typeof CONTROL_CASE_OUTCOMES)[keyof typeof CONTROL_CASE_OUTCOMES]

/** The closed case-outcome vocabulary, for membership tests and pins. */
export const CONTROL_CASE_OUTCOME_VALUES: readonly string[] = Object.values(CONTROL_CASE_OUTCOMES)

/** The result of raising a leg: a leg row, or a synchronous terminal close. */
export type ControlRequestLegOutcome =
  | { readonly kind: 'leg'; readonly leg: ControlRequestRecord }
  | {
      readonly kind: ControlCaseTerminalOutcome
      readonly approvalCaseId: string
      readonly reviewAuthority: ProposalAuthorityPosition
      readonly requiredAuthority: ProposalAuthorityPosition
      readonly detail: string
    }

/** The result of one escalation of one leg. */
export interface ControlEscalationOutcome {
  /** The additive leg fact (A3-12(ii) payload). */
  readonly escalation: ControlEscalationRecord
  /** The terminal `deny` + reason `escalated` on the closing leg (A5-5). */
  readonly terminalDecision: ControlDecisionRecord
  /** The risen leg, or ABSENT when the case terminated instead (spec 11.6). */
  readonly nextLeg?: ControlRequestRecord
  /** `escalated` when a leg rose; `authority-unavailable` when the case
   *  closed because no rung is left (spec 11.6, ADR A1-12). A member of the
   *  frozen {@link CONTROL_CASE_OUTCOMES} table (audit F7). */
  readonly caseOutcome: ControlCaseOutcome
}

/**
 * The result of closing a case that never had a REVIEWABLE leg (A4-PR3,
 * audit F2).
 *
 * WHY a leg row is written at all. The earlier design wrote nothing, which made
 * an ADR A1-12 termination unobservable: `appendTerminalOutcome` needs a
 * requestId, the open-case list skips rows without a case identity, and a
 * terminated case that leaves no row cannot be reported, audited or closed by
 * a later lane. The close therefore writes the leg row AND its terminal deny in
 * one transaction, so every durable field is TRUE (the case did arrive, at this
 * rung, and did close) and nothing is invented. Acceptance 21.10 is untouched:
 * the leg is BORN terminal, so the case never appears pending anywhere — not in
 * `listOpenApprovalCases`, not in the host fold's `pendingControlCount`, not to
 * the guard (which reports the durable deny).
 */
export interface ControlCaseClosure {
  /** The case this close terminates (derived from the identity, A2-7). */
  readonly approvalCaseId: string
  /** The leg row the close wrote: born terminal, never open for review. */
  readonly leg: ControlRequestRecord
  /** The terminal `deny` the close wrote (never any other value). */
  readonly terminalDecision: ControlDecisionRecord
}

/**
 * The outcome of resolving a frozen approval-case IDENTITY to the case that
 * owns it (ADR A2-7: derived, never caller-chosen; audit F3).
 *
 * A DECIDED case is excluded from `listOpenApprovalCases`, so without this
 * lookup a second implementer holding an operation fingerprint has no frozen
 * path back to its case.
 */
export type ApprovalCaseIdentityLookup =
  | { readonly kind: 'found'; readonly approvalCaseId: string }
  | { readonly kind: 'none' }

/** One entry of the open-case list (ADR A1-11: the pending list spans
 *  cases, not one carrier kind). */
export interface ApprovalCaseSummary {
  /** The derived case state (same shape as a single-case read). */
  readonly state: ApprovalCaseState
  /** The carrier kind of the current leg (compatibility carrier only —
   *  ADR A2-17 / spec 19: it is NOT the reviewer semantics). */
  readonly carrierKind: ControlRequestKind
}

// --- canonical subject (pre-alpha3 PR-D, D.2) --------------------------------------------

/**
 * The closed CANONICAL subject kinds of a control operation scope
 * (pre-alpha3 PR-D, D.2): the scope's second identity element generalizes
 * from "the target instance" to a subject the operation is about:
 *
 * - `instance` — the operation is addressed to one member instance
 *   (the pre-PR-D identity; a legacy row's `targetInstanceId` IS this
 *   subject id — byte-identical semantics);
 * - `template` — the operation is about one blueprint TEMPLATE (e.g. a
 *   Recovery reviewed invocation of a template's work): templates carry
 *   no lifecycle, so the instance stale validators NEVER apply to a
 *   template subject (the stale check branches on the subject kind);
 * - `team` — the operation is about the TEAM as a whole (the subject id
 *   is the team's own root session id).
 */
export const CONTROL_SUBJECT_KINDS = {
  /** The operation is addressed to one member instance. */
  INSTANCE: 'instance',
  /** The operation is about one blueprint template. */
  TEMPLATE: 'template',
  /** The operation is about the team as a whole (the root session). */
  TEAM: 'team',
} as const

/** One of the closed canonical subject kinds. */
export type ControlSubjectKind = (typeof CONTROL_SUBJECT_KINDS)[keyof typeof CONTROL_SUBJECT_KINDS]

/** Every canonical subject kind value, for membership checks. */
export const CONTROL_SUBJECT_KIND_VALUES: readonly string[] = Object.values(CONTROL_SUBJECT_KINDS)

/** Type guard: is `value` a {@link ControlSubjectKind}? */
export function isControlSubjectKind(value: unknown): value is ControlSubjectKind {
  return typeof value === 'string' && (CONTROL_SUBJECT_KIND_VALUES as readonly string[]).includes(value)
}

/**
 * The CANONICAL subject of a control operation scope (pre-alpha3 PR-D,
 * D.2): the frozen identity the scope — and therefore the request, the
 * decision snapshot and the scope key — is keyed on. Exactly ONE id field
 * is present, selected by the kind:
 *
 * - `instance` → `instanceId` (the member instance, invariant 18/19);
 * - `template` → `templateId` (the bound blueprint's static template
 *   identity, invariant 19);
 * - `team`     → `rootSessionId` (the team's own root session id).
 */
export type ControlSubject =
  | { readonly kind: 'instance'; readonly instanceId: string }
  | { readonly kind: 'template'; readonly templateId: string }
  | { readonly kind: 'team'; readonly rootSessionId: string }

// --- execution coupling (pre-alpha3 PR-D, D.3/D.4) -----------------------------------------

/**
 * The closed EXECUTION COUPLINGS of a control request (pre-alpha3 PR-D,
 * D.3/D.4): how the requested decision is coupled to the operation's
 * execution.
 *
 * - `guarded` — the EXISTING flow (request → wait → decision → guard →
 *   consume → execute): the allow is consumed EXACTLY ONCE by the
 *   last-mile guard's check-and-reserve (`control-allow-consumed`);
 * - `inline` — the NEW flow (request → wait → decision; on `allow` the
 *   current frozen invocation CONTINUES — no consumption fact is written,
 *   the allow is not consumed by a guard; on `deny` zero effect; on
 *   `abort` the additive close fact `control-request-abandoned` durably
 *   closes the request with zero effect — the abandon fact is the
 *   terminal mark, like `stale-denied`).
 *
 * ABSENT on the request = LEGACY semantics (byte-identical for old rows):
 * the legacy instance-only flow is the guarded flow.
 */
export const CONTROL_EXECUTION_COUPLINGS = {
  /** The existing guarded flow (guard consumes the allow exactly once). */
  GUARDED: 'guarded',
  /** The inline flow (the frozen invocation continues on allow; abort
   *  durably abandons the request — no consumption fact is ever written). */
  INLINE: 'inline',
} as const

/** One of the closed execution couplings. */
export type ControlExecutionCoupling = (typeof CONTROL_EXECUTION_COUPLINGS)[keyof typeof CONTROL_EXECUTION_COUPLINGS]

/** Every execution coupling value, for membership checks. */
export const CONTROL_EXECUTION_COUPLING_VALUES: readonly string[] = Object.values(CONTROL_EXECUTION_COUPLINGS)

/** Type guard: is `value` a {@link ControlExecutionCoupling}? */
export function isControlExecutionCoupling(value: unknown): value is ControlExecutionCoupling {
  return (
    typeof value === 'string' && (CONTROL_EXECUTION_COUPLING_VALUES as readonly string[]).includes(value)
  )
}

// --- the persisted authority scope (A4-PR7 Task 7.0, ADR A1-14) ---------------------

/**
 * The two matcher kinds a Control row may persist (ADR A1-14).
 *
 * `subtree` and `any` are DELIBERATELY ABSENT. A Control row authorizes ONE
 * invocation; persisting a region-shaped matcher would silently widen the
 * single-shot capability grant into a standing ceiling — the next operation
 * inside the subtree would find a durable scope that "matches" it. The concrete
 * operation point is the only thing an allow ever covered, so it is the only
 * thing an allow may carry.
 */
export const CONTROL_AUTHORITY_MATCHER_KINDS = {
  /** A file-plane operation: the canonical resource key of this invocation. */
  EXACT: 'exact',
  /** An exec-plane operation: the canonical fingerprint of this command. */
  FINGERPRINT: 'fingerprint',
} as const

/** One persisted matcher kind. */
export type ControlAuthorityMatcherKind =
  (typeof CONTROL_AUTHORITY_MATCHER_KINDS)[keyof typeof CONTROL_AUTHORITY_MATCHER_KINDS]

/** Every persisted matcher kind, for membership pins. */
export const CONTROL_AUTHORITY_MATCHER_KIND_VALUES: readonly string[] = Object.values(
  CONTROL_AUTHORITY_MATCHER_KINDS,
)

/**
 * The AUTHORITY point of one concrete operation — what the ceiling is a ceiling
 * OVER (ADR A1-14).
 *
 * `ControlOperationScope` answers "which invocation is this" (tool, action,
 * correlation, fingerprint). This answers the DIFFERENT question the ceiling
 * evaluator asks: "which operation class, over which resource". The two are not
 * interchangeable fields — a `toolName` is the lane name the pipeline routes on,
 * a `resource` is the canonical authority key the documents match on — and
 * before this type existed the second question could not be asked at the
 * consumption point at all, which is why A1-14's re-check was unenforceable
 * rather than merely unwritten (PR4's own scope disclosure).
 */
export interface ControlAuthorityScope {
  /** The operation class as the authority documents name it (the tool). */
  readonly operationClass: string
  /** The concrete resource point: an exact canonical key, or the canonical
   *  command fingerprint. Never a region (see the matcher-kind note above). */
  readonly matcher:
    | { readonly kind: typeof CONTROL_AUTHORITY_MATCHER_KINDS.EXACT; readonly resource: string }
    | {
        readonly kind: typeof CONTROL_AUTHORITY_MATCHER_KINDS.FINGERPRINT
        readonly resource: string
      }
}

/** Type guard: is `value` a well-formed {@link ControlAuthorityScope}? */
export function isControlAuthorityScope(value: unknown): value is ControlAuthorityScope {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { operationClass?: unknown; matcher?: unknown }
  if (typeof candidate.operationClass !== 'string' || candidate.operationClass.length === 0) {
    return false
  }
  const matcher = candidate.matcher
  if (typeof matcher !== 'object' || matcher === null) return false
  const shaped = matcher as { kind?: unknown; resource?: unknown }
  if (
    typeof shaped.kind !== 'string' ||
    !(CONTROL_AUTHORITY_MATCHER_KIND_VALUES as readonly string[]).includes(shaped.kind)
  ) {
    return false
  }
  return typeof shaped.resource === 'string' && shaped.resource.length > 0
}

/**
 * The verdict of the A1-14 fresh-authority recheck at the consumption point.
 *
 * THE SHAPE IS THE POINT: the control lane consumes a CLOSED VERDICT, never
 * documents and never a ceiling value. Reading the bound authority documents and
 * walking the ladder is the permission plane's one answer (ADR A5-12: a reader
 * in every judge is a second answer). The control plane must not re-decide
 * authority, so this vocabulary names only what the guard may DO with the
 * answer.
 */
export const CONTROL_AUTHORITY_RECHECK_KINDS = {
  /** The rung that signed still covers the persisted point. */
  STILL_SUFFICIENT: 'still-sufficient',
  /** The documents now require a HIGHER rung than the one that signed. */
  AUTHORITY_RISEN: 'authority-risen',
  /** The fresh documents could not answer, so coverage is NOT confirmed. */
  UNDETERMINED: 'undetermined',
} as const

/** Every recheck kind, for membership pins. */
export const CONTROL_AUTHORITY_RECHECK_KIND_VALUES: readonly string[] = Object.values(
  CONTROL_AUTHORITY_RECHECK_KINDS,
)

/** The input of one consumption-point recheck. Every field is DURABLE. */
export interface ControlAuthorityRecheckInput {
  /** The TeamSession the operation belongs to. */
  readonly rootSessionId: string
  /** The instance the persisted operation runs ON (the case's instance
   *  subject) — the beneficiary the fresh documents are read for. */
  readonly instanceId: string
  /** Whose authority the case raises, as FROZEN on the leg (never re-read). */
  readonly beneficiaryAuthority: ProposalAuthorityPosition
  /** The rung that actually signed the leg (never the caller's claim). */
  readonly reviewAuthority: ProposalAuthorityPosition
  /** The effect the case asked for, as frozen on the leg. */
  readonly requestedEffect: PermissionOverlayEffect
  /** The persisted concrete authority point (ADR A1-14). */
  readonly authorityScope: ControlAuthorityScope
  /**
   * The row's canonical command identity (`operationFingerprint`), so the
   * recheck derives the SAME candidate set the ASK derived (RULING 4).
   *
   * It is DURABLE in the same sense as every field above: read off the matched
   * request row, never re-derived from the invocation now arriving — that
   * re-derivation is the thing ADR A1-14 forbids.
   *
   * REQUIRED, and here is why the shape is `string | undefined` rather than
   * optional. Without it the shell-class candidate set is the persisted
   * tool-level point alone, and no shell rule can cover an exact target
   * (`authority-envelope.ts:218-222` answers a decisive `{covers:false}` across
   * shapes), so the meet collapses to the ladder default and an authority RISE
   * on a shell command is read as coverage — the false pass this field exists to
   * prevent. There is exactly one production caller (`control/service.ts`, the
   * recheck inside the per-team lock) and it can ALWAYS supply it: a row with no
   * `operationFingerprint` returns before the port is reached. So a caller may
   * not omit the field — omitting it is a compile error, which is the law the
   * compiler is asked to hold.
   *
   * `undefined` stays NAMEABLE because the runtime guard must stay a live path
   * rather than code only reachable by casting: a caller that states the absence
   * gets `undetermined` with `shell-point-missing` in its reason — a refusal
   * that consumes nothing — never a narrower question and never a pass. That is
   * the arm `test/a4p7-a1-14-consumption-revalidation.test.ts` S3 pins.
   */
  readonly commandFingerprint: string | undefined
}

/** One recheck verdict; see {@link CONTROL_AUTHORITY_RECHECK_KINDS}. */
export type ControlAuthorityRecheck =
  | { readonly kind: typeof CONTROL_AUTHORITY_RECHECK_KINDS.STILL_SUFFICIENT }
  | {
      readonly kind: typeof CONTROL_AUTHORITY_RECHECK_KINDS.AUTHORITY_RISEN
      /** The rung the fresh documents now require (diagnostic, never a
       *  re-routing instruction: the guard refuses, it never re-asks). */
      readonly requiredNow: ProposalAuthorityPosition
      readonly detail: string
    }
  | {
      readonly kind: typeof CONTROL_AUTHORITY_RECHECK_KINDS.UNDETERMINED
      /** Why the fresh answer could not be given (the plane's closed
       *  diagnosis, passed through). */
      readonly reason: string
      readonly detail: string
    }

/**
 * The injected fresh-authority recheck (ADR A1-14, spec §12.1's execution
 * order). Production implements it in the permission plane over the FRESHLY
 * BOUND documents (the same authority-ceiling reader the mutation lane reads);
 * the control service calls it INSIDE the per-team lock and nowhere else.
 *
 * ABSENT IS NOT "COVERED". With no port the consumption point cannot confirm
 * the authority it is about to spend, so a v3 operation case refuses: a
 * permission-unaware composition cannot consume a v3 operation approval at all.
 * That is the fail-closed direction, and it is why the port is wired in the
 * production root rather than defaulted to "yes".
 */
export type ControlAuthorityRecheckPort = (
  input: ControlAuthorityRecheckInput,
) => Promise<ControlAuthorityRecheck>

// --- scope ----------------------------------------------------------------------------

/**
 * One control operation scope (the exact, lossless-JSON identity an allow
 * authorizes — see the module docs for the scope model).
 */
export interface ControlOperationScope {
  /** The TeamSession (root session id, invariant 9) the operation belongs to. */
  readonly rootSessionId: string
  /**
   * The CANONICAL subject of the scope (pre-alpha3 PR-D, D.2). OPTIONAL
   * in the input surface for legacy compatibility: ABSENT = the legacy
   * `targetInstanceId`-only path (the scope normalizes to the instance
   * subject `subject.instanceId === targetInstanceId` — byte-identical
   * scope key); PRESENT = the canonical identity (the service validates
   * the closed kind + the non-empty kind-selected id).
   */
  readonly subject?: ControlSubject
  /**
   * The instance the operation is addressed to (invariant 18/19) — the
   * LEGACY read-compatibility projection of an INSTANCE subject (kept
   * additive, not removed, pre-alpha3 PR-D D.2). PRESENT for instance
   * subjects (equal to `subject.instanceId` when a subject is given);
   * ABSENT for template/team subjects (they have no target instance).
   */
  readonly targetInstanceId?: string
  /** The logical operation name being requested. */
  readonly actionName: string
  /** Present when the operation is a DSH tool-pipeline operation. */
  readonly toolName?: string
  /** The explicit capability domain (closed set); see the module docs. */
  readonly capabilityDomain?: CapabilityName
  /** The stable logical-operation token (request correlation). */
  readonly correlation: string
  /**
   * The resource + payload impact identity of the operation (alpha.2
   * exact-scope extension). OPTIONAL for legacy compatibility: ABSENT =
   * the old scope identity (existing durable Control rows keep working);
   * PRESENT = the approval is bound to the exact fingerprint. When
   * present it MUST be a non-empty string (a present-but-empty or
   * non-string fingerprint is malformed input at the service boundary and
   * a corrupted durable line is fail-closed ABSENT). When present it
   * participates in the scope's identity (the scope key, the decision
   * snapshot) and in the request idempotency key — see the module docs
   * for the correlation-vs-fingerprint separation.
   */
  readonly operationFingerprint?: string
  /**
   * The AUTHORITY point of the operation (ADR A1-14, A4-PR7 Task 7.0).
   *
   * PRESENT on a v3 operation case, ABSENT on a legacy row. It is the field
   * that makes the consumption-point re-check possible at all: the ceiling is a
   * ceiling over an operation class and a resource, and until this existed the
   * guard had `toolName` + `operationFingerprint` and could ask neither
   * question. It is PERSISTED (request leg, decision scope, case identity)
   * rather than passed at consumption time — an authorization is re-confirmed
   * against what it covered, never against whatever the caller now claims.
   *
   * A scope that carries it must satisfy it: a persisted `exact` point is not
   * satisfied by a different resource under the same `toolName`, and a
   * `fingerprint` point is not satisfied by a drifted fingerprint.
   */
  readonly authorityScope?: ControlAuthorityScope
}

/**
 * The durable request reference of one caller (lossless JSON; mirrors the
 * facade's `callerRef` fact shape).
 */
export type ControlCallerRef =
  | { readonly kind: 'human'; readonly humanId: string }
  | { readonly kind: 'instance'; readonly instanceId: string; readonly role: 'leader' | 'member' }

// --- durable rows ---------------------------------------------------------------------

/**
 * The durable ControlRequest row (Architecture 25.2 minimum: requestId,
 * rootSessionId, requesterInstanceId, kind, target authority, requested
 * operation summary/payload reference, createdAt, status, correlation —
 * realized here as the ledger fact `control-request-recorded` payload).
 */
export interface ControlRequestRecord {
  /** The durable request id (derived deterministically from the scope
   *  identity; stable across retries of the same logical request). */
  readonly requestId: string
  /** The TeamSession (root session id) the request belongs to. */
  readonly rootSessionId: string
  /** The closed request kind. */
  readonly kind: ControlRequestKind
  /** The requesting principal (the member, or the leader where the
   *  leader requests on its own/another instance's behalf). */
  readonly requester: ControlCallerRef
  /** The CANONICAL subject of the request (pre-alpha3 PR-D, D.2). ALWAYS
   *  present on records produced by the service: a durable row carrying
   *  an explicit `subject` uses it; a LEGACY row (targetInstanceId only,
   *  no explicit subject) parses to the instance subject
   *  `{ kind: 'instance', instanceId: targetInstanceId }` (byte-identical
   *  semantics — old durable rows keep working unchanged, no migration). */
  readonly subject: ControlSubject
  /** The instance the requested operation is addressed to — the LEGACY
   *  read-compatibility projection of an INSTANCE subject (pre-alpha3
   *  PR-D D.2; kept additive, not removed). PRESENT for instance
   *  subjects (equal to `subject.instanceId`); ABSENT for template/team
   *  subjects (they have no target instance). */
  readonly targetInstanceId?: string
  /** The logical operation name. */
  readonly actionName: string
  /** Present when the operation is a tool-pipeline operation. */
  readonly toolName?: string
  /** The explicit capability domain (closed set). */
  readonly capabilityDomain?: CapabilityName
  /** The stable logical-operation token (the request correlation). */
  readonly correlation: string
  /** Present only when the request carried an operation fingerprint
   *  (alpha.2 exact-scope extension; mirrors the durable payload field —
   *  legacy rows never carry it, so it stays ABSENT, never an empty
   *  string). */
  readonly operationFingerprint?: string
  /** The requested operation summary (free text; NOT authority data). */
  readonly summary?: string
  /**
   * The lossless-JSON review payload (pre-alpha3 PR-D, D.3): the value
   * the Remote/UI must be able to display LOSSLESSLY (the Recovery
   * reviewed invocation). ABSENT = legacy semantics (the field is
   * OMITTED, never present-but-undefined — the row is byte-identical to
   * the legacy shape). A present value must survive the
   * `JSON.stringify`/`JSON.parse` round trip (the contracts
   * `RemoteSafeJsonValue`); a present-but-non-lossless value is
   * malformed input at the service boundary (fail closed) and a corrupted
   * durable line is ABSENT (never a guess).
   */
  readonly reviewPayload?: RemoteSafeJsonValue
  /**
   * The STABLE DIGEST string of the review payload (pre-alpha3 PR-D,
   * D.3): a present digest REQUIRES a present `reviewPayload` (a digest
   * of a value the row does not carry is malformed input — fail closed);
   * a present payload without a digest is fine (the digest is optional
   * metadata of the payload). ABSENT = legacy semantics.
   */
  readonly reviewPayloadDigest?: string
  /**
   * The execution coupling (pre-alpha3 PR-D, D.3/D.4): closed
   * `guarded | inline` (see {@link CONTROL_EXECUTION_COUPLINGS}).
   * ABSENT = legacy semantics — the legacy instance-only flow is the
   * GUARDED flow (byte-identical for old rows).
   */
  readonly executionCoupling?: ControlExecutionCoupling
  // --- Alpha.4 review-leg fields (A4-PR3; spec 11.2, ADR A2-7 / A2-8) -----------------
  //
  // EVERY field below is ADDITIVE: absent = a pre-Alpha.4 row, which must
  // reconstruct byte-identically into today's behaviour (pinned by
  // `control-legacy-row-compat.test.ts`). None of them is caller-authoritative
  // for a decision: `reviewAuthority` says who may decide the leg, and
  // `requiredAuthorityAtCreation` is PROVENANCE ONLY — the fresh required
  // authority is always re-derived (spec 11.2, and PR4's consumption-point
  // recheck at A1-14 is what actually gates execution).
  /** The approval case this leg belongs to (spec 11.1). Present ⇒ the row
   *  is an Alpha.4 LEG row, which is also the strict/legacy row
   *  discriminator (ADR X8-R2). */
  readonly approvalCaseId?: string
  /** The 1-based ordinal of this leg inside its case (A1-10: leg identity =
   *  `f(approvalCaseId, legOrdinal, previousRequestId)`). */
  readonly legOrdinal?: number
  /** The ladder position this leg was written for — who may decide it. */
  readonly reviewAuthority?: ProposalAuthorityPosition
  /** The ladder position the case needed when this leg was created
   *  (provenance only; never re-read as authority). */
  readonly requiredAuthorityAtCreation?: ProposalAuthorityPosition
  /** The leg this one rose from (spec 11.2, A3-12(iii): the ONLY parent
   *  pointer). Absent on the first leg. */
  readonly previousRequestId?: string
  /** Whose authority the case raises (spec 11.1, frozen for the case). */
  readonly beneficiaryAuthority?: ProposalAuthorityPosition
  /** The overlay effect the case asks for (spec 11.1, frozen). */
  readonly requestedEffect?: PermissionOverlayEffect
  /** The mutation proposal fingerprint, for `envelope-mutation` cases only
   *  (exactly-one-fingerprint rule, spec 11.1). */
  readonly mutationProposalFingerprint?: string
  /** The request's durable state, DERIVED at read time from the durable
   *  facts: `pending` while no decision fact and no abandon fact exists
   *  for the requestId, `decided` once a decision fact does (and no
   *  abandon fact), `abandoned` once the additive close fact
   *  `control-request-abandoned` does (the abandon fact is the TERMINAL
   *  mark — it wins over a concurrent decision; the row itself is never
   *  rewritten — append-only ledger). */
  readonly status: 'pending' | 'decided' | 'abandoned'
  /** Fact creation time, ISO-8601 (the deterministic clock). */
  readonly createdAt: string
  /** The ledger sequence of the request row (durable identity). */
  readonly requestSequence: number
}

/**
 * The durable ControlDecision row (Architecture 25.3: durable,
 * instance-addressed, recoverable after reconnect/cold projection; the
 * decision itself is NOT tool execution). Realized as the ledger fact
 * `control-decision-recorded` payload.
 */
export interface ControlDecisionRecord {
  /** The request this decision closes. */
  readonly requestId: string
  /** The closed decision value (allow / deny / stale-denied). */
  readonly decision: ControlDecisionValue
  /** The deciding principal. */
  readonly decider: ControlCallerRef
  /** Present only for the documented special outcomes (external-policy). */
  readonly reason?: ControlDecisionReason
  /** The decider's free-form note (evidence text; NOT authority data;
   *  distinct from the closed `reason` vocabulary). */
  readonly note?: string
  /**
   * Why this TERMINAL row closed the leg, when the close was a drift or an
   * unavailable-resolver close rather than a reviewer's refusal (Alpha.4
   * A4-PR3, ADR A2-8, spec 25.5). ABSENT = an ordinary allow/deny and every
   * pre-Alpha.4 row.
   *
   * This is the destination A2-8 names for authority/identity drift: those
   * reasons were otherwise forced into a new decision value or a new
   * request status, both of which A2-8 forbids. Like `reason` it is on the
   * DECISION row — the leg row is immutable (append-only ledger), so the
   * terminal mark lives on the row that terminates it.
   */
  readonly terminalReason?: ControlLegTerminalReason
  /** The exact scope snapshot the decision authorizes (allow) or refuses
   *  (deny/stale-denied) — frozen at decision time. */
  readonly scope: ControlOperationScope
  /** The ledger sequence of the request row this decision closes. */
  readonly requestSequence: number
  /** The ledger sequence of this decision row (durable identity). */
  readonly decisionSequence: number
  /** Fact creation time, ISO-8601 (the deterministic clock). */
  readonly createdAt: string
}

/**
 * The durable consumption record of an allow (realized as the ledger fact
 * `control-allow-consumed` payload): an allow authorizes its exact scope
 * EXACTLY ONCE.
 */
export interface ControlConsumptionRecord {
  /** The request whose allow was consumed. */
  readonly requestId: string
  /** The decision sequence that authorized the operation. */
  readonly decisionSequence: number
  /** The exact scope that was consumed. */
  readonly scope: ControlOperationScope
  /** Consumption time, ISO-8601 (the deterministic clock). */
  readonly consumedAt: string
}

/**
 * The durable abandonment record of an inline-coupling control request
 * (pre-alpha3 PR-D, D.4): realized as the ADDITIVE ledger fact
 * `control-request-abandoned` payload. The append-only ledger has no
 * delete primitive — the abandon fact CLOSES the request without
 * physically deleting it, and it is the TERMINAL mark (like the
 * `stale-denied` decision): once recorded, the request can never become
 * an allow (a later decision is rejected with
 * CONTROL_REQUEST_ABANDONED; the last-mile guard blocks with the
 * `request-abandoned` verdict even over a durable allow recorded
 * BEFORE the abandon).
 */
export interface ControlAbandonmentRecord {
  /** The request this abandon closes. */
  readonly requestId: string
  /** The TeamSession (root session id) the request belongs to. */
  readonly rootSessionId: string
  /** Abandonment time, ISO-8601 (the deterministic clock). */
  readonly abandonedAt: string
  /** The optional free-form abandon reason (evidence text; NOT authority
   *  data). ABSENT = no reason carried. */
  readonly reason?: string
  /** The ledger sequence of this abandon row (durable identity). */
  readonly abandonmentSequence: number
}

/**
 * One `control-request-recorded` row the STRICT request reader refused, as the
 * read plane reports it (RULING 5-A, external review W8).
 *
 * A refused row is a GOVERNANCE FAULT, not an absence: the ledger holds a
 * control leg and this service cannot reconstruct it. Every one of them is
 * counted here — whether or not it still names an approval case, which is the
 * filing rule this ruling replaced. Filing used to require a readable
 * `approvalCaseId`: a field the guard's own candidacy test refuses to trust, so
 * a refused row that named its scope but not its case was invisible to the read
 * plane AND to the guard, and the guard answered `no-request` — the one verdict
 * that means "proceed" — for the very call its own row governs.
 *
 * WHAT THIS IS NOT: a gate. Like the two case-keyed corrupt-leg routes
 * (`readApprovalCaseState`, `findApprovalCaseByIdentity`), this list reports and
 * executes nothing (`a4-corrupt-leg-guard.test.ts` W9 / W12-d). The guard's
 * candidacy decision is a separate question, decided member by member.
 */
export interface ControlCorruptLegRecord {
  /** The ledger sequence of the refused row (durable identity; the list is
   *  ordered by it). */
  readonly sequence: number
  /** Echoed ONLY when the damaged row still discloses one — a report never
   *  invents an identity it did not read. */
  readonly requestId?: string
  /** Echoed under the same law; its ABSENCE is itself the finding for the rows
   *  this ruling newly files. */
  readonly approvalCaseId?: string
  /**
   * `false` = the row discloses NONE of the five members the guard's candidacy
   * test compares (every one of them absent-or-unreadable), so no reading can
   * attribute it to any call. Such a row is COUNTED HERE AND DOES NOT BLOCK:
   * blocking on it is RULING 5-B, a human safety-vs-availability decision this
   * lane does not own. `a4-corrupt-leg-guard.test.ts` W8-b / W12-c pin that
   * execution effect and name it as the disclosed boundary it is.
   */
  readonly disclosesMember: boolean
}

// --- guard verdicts -------------------------------------------------------------------

/**
 * The closed guard block reasons (the last-mile guard NEVER throws for a
 * policy outcome — it returns a verdict; it throws only for malformed
 * input or an ambiguous durable state).
 */
export const CONTROL_GUARD_BLOCK_REASONS = {
  /** No durable control request exists for the scope (no-request).
   *
   *  WHO OWNS THE POLARITY (A4 corrupt-leg guard). This is the ONE reason
   *  `packages/tools/src/guard.ts` maps to "proceed", because the absence of a
   *  gate is the leader-autonomy path (SD-GUARD's documented deviation) — so
   *  this member means "THERE IS NOTHING TO GUARD", and never "I could not read
   *  what guards this call". A control leg that exists but cannot be parsed is
   *  NOT this verdict: `guardOperation` refuses it (`authority-scope-unbound` /
   *  `authority-undetermined`), because on a damaged ledger the two readings are
   *  indistinguishable and only one of them is safe. A producer that cannot tell
   *  them apart must not emit this code. */
  NO_REQUEST: 'no-request',
  /** The request exists but carries no decision yet. */
  REQUEST_PENDING: 'request-pending',
  /** The durable decision is `deny`. */
  DECISION_DENY: 'decision-deny',
  /** The durable decision is `stale-denied` (the request is closed). */
  REQUEST_STALE: 'request-stale',
  /** The request is durably ABANDONED (the additive close fact
   *  `control-request-abandoned` exists — pre-alpha3 PR-D, D.4). The
   *  abandon fact is the TERMINAL mark (like `stale-denied`): even a
   *  durable `allow` recorded BEFORE the abandon cannot execute — the
   *  guard sees the abandon and blocks (zero effect; the inline allow
   *  was never consumed by a guard, so there is no consumption to
   *  honor). */
  REQUEST_ABANDONED: 'request-abandoned',
  /** The durable allow exists but was already consumed (exactly-once). */
  ALLOW_CONSUMED: 'allow-consumed',
  /** A durable decision exists for the correlation but a scope field
   *  (toolName / capabilityDomain) differs — fail closed, never guess. */
  SCOPE_MISMATCH: 'scope-mismatch',
  /** The target instance is missing, terminal (DISPOSED) or suspended
   *  (ARCHIVED — admission is closed, invariant 52), or the team session
   *  record is gone (the operation cannot execute on it). */
  TARGET_STALE: 'target-stale',
  /** The live external hard policy recheck (A2C-4 last-mile, plan §6.3)
   *  refused the operation AFTER the durable allow was found: the host
   *  policy tightened between the decision and the final guard. The
   *  consumption fact is NOT written (the one-shot allow is not burned —
   *  "prefer zero allow consumption", invariant 34). */
  EXTERNAL_POLICY: 'external-policy',
  /**
   * The durable decision row for this scope carries a decision value
   * OUTSIDE the closed `CONTROL_DECISION_VALUES` vocabulary — the typed
   * refusal of the guard's exhaustive decision switch (Alpha.4 A4-PR3,
   * ADR A2-1 / spec 25.1).
   *
   * Before this value existed the switch was `if stale-denied / if deny`,
   * then a comment and a FALL THROUGH to authorization: any fourth value
   * (the `escalate` row A2-1 forbids is the named example) would have been
   * an IMPLICIT approval. Reaching this reason requires a row the read gate
   * did not already drop — it is the guard's own last line of defence, and
   * `packages/tools/guard.ts` fails closed for every reason but
   * `no-request`, so an unrecognized value can never execute.
   */
  DECISION_UNRECOGNIZED: 'decision-unrecognized',
  /**
   * A1-14 (A4-PR7 Task 7.0): at the consumption point the FRESHLY BOUND
   * authority documents require a HIGHER rung than the one that signed. The
   * allow is not wrong — it was true when written — it is about an invocation
   * that no longer exists to be authorized. ZERO consumption: burning the
   * one-shot on a drift would turn the drift into a second denial nobody voted
   * on (the same reasoning as `EXTERNAL_POLICY` above).
   */
  AUTHORITY_RISEN: 'authority-risen',
  /**
   * A1-14: the fresh authority answer could not be obtained (an unavailable
   * document, an unanswerable containment question, or no recheck port at all).
   * "Could not confirm" is not "confirmed" — and an unreadable document is
   * never an empty one (ADR A5-16). ZERO consumption, as above.
   */
  AUTHORITY_UNDETERMINED: 'authority-undetermined',
  /**
   * A1-14: the durable row is an operation case that carries NO authority point.
   * After the v3-only cutover there is no transitional scope shape to evaluate
   * against, so the row cannot be re-confirmed and cannot consume. This is the
   * CORRUPT row of A2-9's rule, caught at the one place where being wrong means
   * executing: `packages/tools/guard.ts` blocks on every reason but
   * `no-request`, so naming this (rather than dropping the row to `no-request`)
   * is what keeps a corrupt authority row from executing.
   */
  AUTHORITY_SCOPE_UNBOUND: 'authority-scope-unbound',
} as const

/** One of the closed guard block reasons. */
export type ControlGuardBlockReason = (typeof CONTROL_GUARD_BLOCK_REASONS)[keyof typeof CONTROL_GUARD_BLOCK_REASONS]

/** Every guard block reason value, for membership checks. */
export const CONTROL_GUARD_BLOCK_REASON_VALUES: readonly string[] = Object.values(CONTROL_GUARD_BLOCK_REASONS)

/**
 * The verdict of the last-mile tool guard (lossless JSON; the P6-T6 tool
 * layer consults it BEFORE executing the operation through the DSH tool
 * pipeline and executes ONLY on `allowed: true`).
 */
export type ControlGuardVerdict =
  | {
      readonly allowed: true
      readonly requestId: string
      readonly decisionSequence: number
    }
  | {
      readonly allowed: false
      readonly reason: ControlGuardBlockReason
      readonly requestId?: string
      readonly decisionSequence?: number
    }

/**
 * The verdict of the SHARED READ-ONLY external hard check (A2C-4, alpha.2
 * plan §6.3 — the external last-mile recheck seam).
 *
 * This is the control plane's single external-ceiling evaluator surface:
 * the resolve-time probe, this method, and the guard's internal recheck
 * all share the SAME hard-cell semantics over the LIVE
 * `externalPolicyFacts` port (an ABSENT cell = no host restriction; a
 * hard `deny` refuses; a hard allow-list must NAME the operation's tool;
 * an explicit `capabilityExists: false` refuses). It is READ-ONLY — it
 * writes no durable row — and FAILS CLOSED: any failure reading or
 * interpreting the facts is a deny verdict, never a throw and never an
 * allow (invariant 34: no Team decision, human included, bypasses the
 * external hard policy).
 */
export type ControlExternalVerdict =
  | {
      readonly allowed: true
    }
  | {
      readonly allowed: false
      /** The fail-closed diagnostic (free text; NOT authority data). */
      readonly reason: string
    }

// --- service options ------------------------------------------------------------------

// --- synchronous wait bridge (alpha.2 §9.4) ----------------------------------------------

/**
 * The minimal caller-cancellation surface the wait bridge consumes
 * (alpha.2 §9.4, `awaitControlDecision`). Structurally satisfied by the
 * platform's `AbortSignal` (Node/DOM): a real `AbortController`'s signal
 * passes through unchanged. The module builds against `lib: ES2022`
 * (the codebase carries no ambient DOM/Node globals in its build
 * config — tsconfig.base.json), so the public signature names this
 * minimal interface instead of the platform global.
 */
export interface ControlWaitSignal {
  /** True once the caller has cancelled the wait. */
  readonly aborted: boolean
  /** Register the waiter's one-shot abort listener. */
  addEventListener(type: 'abort', listener: () => void, options?: { readonly once?: boolean }): void
  /** Remove the waiter's abort listener (the settle cleanup). */
  removeEventListener(type: 'abort', listener: () => void): void
}

/**
 * The control service ports (injected, mock-first — the same port family
 * as the P6-T2 facade's `TeamRuntimeOptions`, minus the creation/lifecycle
 * ports the control plane never touches: the service admits no new work
 * and creates no members, so no ActivationProvider is in scope).
 */
export interface ControlServiceOptions {
  /** The open TeamDomain (the durable control-plane authority, inv 41). */
  readonly teamDomain: import('../../storage/repositories/index.js').TeamDomain
  /** The immutable blueprint catalog (resolves the bound snapshot —
   *  needed by the facade's reused resolution steps). */
  readonly blueprintCatalog: import('../../domain/blueprint/src/index.js').BlueprintCatalog
  /** The external hard facts port (live probe at decision time —
   *  invariant 34 / Architecture 25.4). */
  readonly externalPolicyFacts: () => Promise<import('../../domain/policy/src/index.js').ExternalPolicyFacts>
  /** The deterministic clock (ISO-8601) for durable row timestamps. */
  readonly now: () => string
  /**
   * The wait-bridge poll interval in milliseconds (alpha.2 §9.4,
   * `awaitControlDecision`). The alpha.2 implementation polls the durable
   * control state at this cadence (documented choice: DEFAULT = 250 ms —
   * the low end of the plan's 250–500 ms band; liveness only, no
   * authority). Injectable in tests (e.g. 5 ms); a non-finite or
   * non-positive value falls back to the default. ABSENT = the default.
   */
  readonly waitPollIntervalMs?: number
  /**
   * C1 (leader-approval reachability) — the OPTIONAL Leader liveness
   * notification port. INVOKED ONLY after the per-team lock is released,
   * ONLY for a NEWLY-CREATED durable `leader-approval` request (an
   * idempotent retry of an existing scope never notifies). The durable
   * request is the SOLE authority: a notification cannot approve, deny,
   * or alter it, and a delivery failure NEVER changes the request's
   * outcome (no rollback, no fake decision, no implicit allow — the
   * pending-list tool + the GUI remain the recovery paths). ABSENT =
   * factory/unit worlds without a live Leader Agent; discovery stays
   * functional through `listControlState`.
   */
  readonly requestNotification?: ControlRequestNotificationPort
  /**
   * C1 — the OPTIONAL diagnostic sink for a FAILED liveness notification
   * (observability only — the sink must not alter the durable outcome).
   * ABSENT = the failure is dropped silently (still non-fatal).
   */
  readonly onNotificationFailure?: (args: {
    readonly requestId: string
    readonly kind: ControlRequestKind
    readonly error: unknown
  }) => void
  /**
   * A4-PR7 Task 7.0 — the OPTIONAL fresh-authority recheck port of ADR A1-14.
   *
   * Called INSIDE the per-team lock, AFTER the exact-scope match and the live
   * external recheck, and BEFORE the `control-allow-consumed` write, for every
   * GUARDED allow whose row carries an `authorityScope`. Refusing costs zero
   * consumption (the allow stays unspent, exactly as for `external-policy`).
   *
   * ABSENT is a refusal for a v3 operation case, never a pass — see
   * {@link ControlAuthorityRecheckPort}. Pre-Alpha.4 rows (no authority point)
   * are unaffected: they have nothing to re-confirm against and consume as
   * they always did.
   */
  readonly authorityRevalidation?: ControlAuthorityRecheckPort
}

/**
 * C1 (leader-approval reachability) — the non-authority notification port
 * the control service invokes for a newly-created durable `leader-approval`
 * request (AFTER the per-team lock is released). The implementation is
 * expected to deliver a model-visible LIVENESS hint to the Leader (the
 * live glue's `deliverRootControlNotification` over the shared root-input
 * seam); it carries no decision authority and writes no TeamDomain state.
 * A rejecting implementation is a liveness failure only (see
 * `ControlServiceOptions.requestNotification`).
 */
export interface ControlRequestNotificationPort {
  notifyLeaderRequest(request: ControlRequestRecord): Promise<void>
}

/**
 * The durable control plane service (P6-T4 acceptance object):
 * requestControl / resolveControl / abandonControlRequest (the pre-alpha3
 * PR-D inline abort path) / listControlState / guardOperation /
 * checkExternalOperation (the A2C-4 shared read-only external recheck) /
 * awaitControlDecision.
 *
 * Invariant: the service NEVER executes tool operations — the decision
 * only authorizes; execution stays in the DSH tool pipeline (the guard is
 * the last-mile check the pipeline consults, DevPlan 19.4 / seam
 * table `pre-execute`).
 */
export interface ControlService {
  /**
   * Durably record one control request (BEFORE any effect — the request
   * row is the only effect). Idempotent over the scope identity: a
   * retried/duplicate request (same scope key) returns the existing row.
   *
   * Subject addressing (pre-alpha3 PR-D, D.2): the CANONICAL identity is
   * the `subject` (closed `instance | template | team`). ABSENT subject
   * = the LEGACY `targetInstanceId`-only path (the request normalizes to
   * the instance subject — byte-identical scope key and durable row
   * semantics for old callers). A PRESENT instance subject must agree
   * with a present `targetInstanceId`; a present `targetInstanceId` for
   * a template/team subject is malformed input (fail closed). The
   * instance stale validators apply ONLY to instance subjects (a
   * template subject is never "stale" in the instance-lifecycle sense).
   *
   * Review payload (pre-alpha3 PR-D, D.3): the additive optional
   * `reviewPayload?` (lossless JSON — ABSENT = legacy semantics),
   * `reviewPayloadDigest?` (requires a present payload) and
   * `executionCoupling?` (closed `guarded | inline`; ABSENT = the
   * legacy guarded flow).
   *
   * @param args - the requesting principal, the kind, and the operation scope.
   * @throws the facade's TeamRuntimeError codes (resolution phase, zero
   *   side effects) or CONTROL_REQUEST_MALFORMED / CONTROL_TARGET_STALE.
   */
  requestControl(args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly kind: ControlRequestKind
    /** The CANONICAL subject (pre-alpha3 PR-D, D.2). ABSENT = the legacy
     *  `targetInstanceId`-only instance path (required in that case). */
    readonly subject?: ControlSubject
    /** The legacy instance addressing (kept additive). REQUIRED when no
     *  `subject` is given; for an explicit instance subject it must be
     *  ABSENT or agree with `subject.instanceId`; ABSENT (not merely
     *  empty) for template/team subjects. */
    readonly targetInstanceId?: string
    readonly actionName: string
    readonly toolName?: string
    readonly capabilityDomain?: CapabilityName
    readonly correlation: string
    readonly operationFingerprint?: string
    readonly summary?: string
    /** The lossless-JSON review payload (pre-alpha3 PR-D, D.3). ABSENT =
     *  legacy semantics (the field stays OMITTED on the durable row). */
    readonly reviewPayload?: RemoteSafeJsonValue
    /** The stable digest string of the review payload (requires a
     *  present `reviewPayload`). ABSENT = legacy semantics. */
    readonly reviewPayloadDigest?: string
    /** The execution coupling (closed `guarded | inline`; ABSENT = the
     *  legacy guarded flow). */
    readonly executionCoupling?: ControlExecutionCoupling
  }): Promise<ControlRequestRecord>
  /**
   * Durably record one control decision closing a pending request. The
   * decision is durable BEFORE any effect; effects (the authorization
   * itself) apply only via the last-mile guard after this returns.
   * @param args - the deciding principal, the requestId and the decision.
   * @throws the facade's TeamRuntimeError codes (resolution phase),
   *   CONTROL_REQUEST_NOT_FOUND / CONTROL_REQUEST_DECIDED /
   *   CONTROL_REQUEST_ABANDONED / CONTROL_RESOLVER_NOT_AUTHORIZED /
   *   CONTROL_REQUEST_MALFORMED, or — after recording the durable
   *   decision row — CONTROL_REQUEST_STALE /
   *   CONTROL_EXTERNAL_POLICY_DENIED.
   */
  resolveControl(args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly requestId: string
    readonly decision: 'allow' | 'deny'
    readonly note?: string
  }): Promise<ControlDecisionRecord>
  /**
   * Durably ABANDON one control request (pre-alpha3 PR-D, D.4 — the
   * inline abort path): records the ADDITIVE close fact
   * `control-request-abandoned` (payload: requestId, rootSessionId,
   * abandonedAt, reason?) BEFORE any effect — the row IS the durable
   * close; the append-only ledger has no delete primitive, so the
   * request row is never physically removed. The abandon fact is the
   * TERMINAL mark (like `stale-denied`): once recorded, the request can
   * never become an allow (a later decision is rejected with
   * CONTROL_REQUEST_ABANDONED) and the last-mile guard blocks with the
   * `request-abandoned` verdict even over a durable `allow` recorded
   * BEFORE the abandon (the old allow/decision cannot execute the
   * operation — zero effect).
   *
   * Close authority (closed rule — the CONTROL INTERNAL close authority,
   * pre-alpha3 review F3): the human may abandon any request, the
   * Leader any of the current Team's requests, and a member ONLY ITS
   * OWN request (the requester ref's instanceId). The caller must be
   * live (the facade's `resolveCaller`) and the team must exist. The
   * close authority is INDEPENDENT of the `resolve-control` mutation
   * envelope (abandon does NOT reuse the resolve-control op spec or
   * perform any envelope check — a caller that may request a review
   * can always abandon its own waiting review; no new Team tool
   * permission or mutation op is exposed). Abandoning an
   * already-abandoned request is rejected with
   * CONTROL_REQUEST_ABANDONED (the terminal mark is written exactly
   * once). Abandoning a DECIDED request is allowed: that is the
   * allow-invalidating path (the abandon closes the durable allow).
   * @param args - the closing principal, the requestId and the optional
   *   reason.
   * @throws the facade's TeamRuntimeError codes (resolution phase),
   *   CONTROL_REQUEST_NOT_FOUND / CONTROL_REQUEST_ABANDONED /
   *   CONTROL_RESOLVER_NOT_AUTHORIZED / CONTROL_REQUEST_MALFORMED.
   */
  abandonControlRequest(args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly requestId: string
    readonly reason?: string
  }): Promise<ControlAbandonmentRecord>
  /**
   * Read the team's durable control state (fresh ledger read; the
   * in-process holds NO cached authority — invariant 45).
   *
   * The result is what the ledger HOLDS, not what it permits: alongside the
   * readable rows it reports every control leg row the strict reader refused
   * (`corruptLegs`, RULING 5-A). That list is a governance fault count, and it
   * gates nothing — the route exists so a refused row is never indistinguishable
   * from an absent one.
   * @param rootSessionId - the team (root) session id.
   */
  listControlState(rootSessionId: string): Promise<{
    readonly requests: readonly ControlRequestRecord[]
    readonly decisions: readonly ControlDecisionRecord[]
    readonly consumptions: readonly ControlConsumptionRecord[]
    /** The durable abandonments (pre-alpha3 PR-D, D.4; the additive
     *  `control-request-abandoned` facts). */
    readonly abandonments: readonly ControlAbandonmentRecord[]
    /** The rows the strict request reader refused, in durable sequence order
     *  (RULING 5-A; see {@link ControlCorruptLegRecord}). Reported, never
     *  defaulted (ADR A2-9), and never a gate. */
    readonly corruptLegs: readonly ControlCorruptLegRecord[]
  }>
  /**
   * The TOOL PIPELINE LAST-MILE GUARD (the public seam P6-T6 wires into
   * the tool registration BEFORE the DSH tool pipeline executes the
   * operation — the characterized `pre-execute` / TOOL_GUARD seam,
   * DevPlan 15). Verifies a durable allow decision exists for the EXACT
   * scope and is unconsumed, then re-probes the LIVE external hard
   * policy (A2C-4 last-mile, plan §6.3 — `checkExternalOperation`, the
   * shared read-only check); on success it durably CONSUMES the allow
   * (check-and-reserve under the per-team lock) and returns allowed:true.
   * A tightened external cell blocks with `external-policy` BEFORE the
   * consumption write — the one-shot allow is NOT consumed (zero effect,
   * "prefer zero allow consumption"; invariant 34). The guard never
   * executes the operation itself and never throws for a policy outcome
   * (it returns a block verdict).
   * @param scope - the exact operation scope (see the module docs).
   */
  guardOperation(scope: ControlOperationScope): Promise<ControlGuardVerdict>
  /**
   * The SHARED READ-ONLY external hard check (A2C-4 last-mile recheck,
   * alpha.2 plan §6.3). Probes the LIVE `externalPolicyFacts` port and
   * applies the SAME hard-cell semantics the resolve-time probe uses
   * (this is the control plane's single external-ceiling evaluator —
   * the adapter's static-allow recheck and the guard's internal
   * recheck both call THIS method; there is no second hard-policy
   * evaluator).
   *
   * Domain derivation (identical to the resolve-time probe): the
   * explicit `capabilityDomain` when present, else `tools` when a
   * `toolName` is named, else NO cell — an operation that names no
   * capability domain is not probed (the Team-owned admission that
   * gated it is the whole check).
   *
   * READ-ONLY: no durable row is written, regardless of the verdict.
   * FAILS CLOSED and NEVER throws: a thrown or malformed facts probe is
   * a deny verdict (invariant 34).
   * @param input.capabilityDomain - the explicit capability domain
   *   (closed set) when the operation carries one.
   * @param input.toolName - the operation's tool name when it is a
   *   tool-pipeline operation (the allow-list cell must NAME it).
   */
  checkExternalOperation(input: {
    readonly capabilityDomain?: CapabilityName
    readonly toolName?: string
  }): Promise<ControlExternalVerdict>
  /**
   * The SYNCHRONOUS WAIT BRIDGE (alpha.2 §9.4): resolves when a durable
   * ControlDecision for the requestId appears. The authority is ALWAYS
   * the durable control rows — the waiter only solves LIVENESS (it adds
   * no authority, writes no rows, and is never consulted by the guard or
   * the resolvers). Minimal alpha.2 implementation: polling the durable
   * control state at the injected `waitPollIntervalMs` cadence (default
   * 250 ms).
   * @param input.rootSessionId - the team (root) session id.
   * @param input.requestId - the durable control request id to wait for.
   * @param input.signal - optional caller cancellation: an already-aborted
   *   signal rejects immediately; a later abort rejects with
   *   CONTROL_WAIT_ABORTED (typed; the durable rows are untouched either
   *   way — cancellation never decides).
   * @resolves the durable {@link ControlDecisionRecord} (fresh read).
   * @throws CONTROL_REQUEST_MALFORMED for malformed ids (typed, zero
   *   side effects); CONTROL_WAIT_ABORTED when the signal aborts;
   *   CONTROL_WAIT_CLOSED when the durable control plane (the injected
   *   TeamDomain) is closed while waiting (the storage layer's typed
   *   `NOT_OPEN` closure signal, detected on the durable read); any other
   *   typed storage failure (e.g. TEAM_SESSION_NOT_FOUND for a vanished
   *   team session) surfaces unchanged.
   */
  awaitControlDecision(input: {
    readonly rootSessionId: string
    readonly requestId: string
    readonly signal?: ControlWaitSignal
  }): Promise<ControlDecisionRecord>
  /**
   * fix-control-authz C (the external-review TOCTOU) — the EFFECT-
   * ADMISSION BOUNDARY: the linearized authorization check for the
   * inline recovery re-execution's FIRST EFFECT. Runs the caller's
   * effect commit (the router's `executeEffectLocked` — the work
   * admission fact / the effect commit) as ONE unit under the SAME
   * per-team lock the durable abandon write goes through (this
   * service's team chain — `abandonControlRequest` / the inline-abort
   * cascade write the terminal mark under it): inside the lock the
   * durable terminal state is read and, if the request is durably
   * ABANDONED (the terminal mark), the unit rejects typed
   * CONTROL_REQUEST_ABANDONED WITHOUT running the effect. This is what
   * closes the TOCTOU window the pre-dispatch snapshot could not: a
   * durable abandon landing AFTER the pre-dispatch read (e.g. during
   * the gate re-probe await) and BEFORE the effect commit is either
   * (i) committed before this unit → the unit sees the mark and the
   * effect NEVER commits, or (ii) queued/committed after the unit →
   * the effect had already durably committed before the terminal mark
   * (the legitimate late close — the CCR-4 semantics; the mark closes
   * the request for the future). No abandon can land between the check
   * and the effect commit (both inside the one lock hold).
   *
   * C-2 (the live signal): when `input.signal` is present, the SAME
   * lock hold also checks the invocation's abort state AFTER the
   * terminal-state read and BEFORE the effect commit — an abort that
   * landed at ANY wait point of the admission (the gate re-probe
   * await, this unit's control-lock queue) is honored HERE: the
   * durable abandon is PERSISTED first (the additive close fact —
   * exactly-once, the same durable footprint as an explicit abandon;
   * a later late-abandon then no-ops on the already-terminal state)
   * and the unit rejects typed
   * CONTROL_REQUEST_ADMISSION_ABORTED (the effect never runs). The
   * settle semantics for an ALREADY-COMMITTED effect are preserved:
   * the signal is checked only up to the commit — an abort that
   * lands after the unit returns is the legitimate late close (the
   * committed effect is never retroactively undone or re-marked).
   *
   * This writes NO control facts on the authorization path (no
   * synthetic "consumed" mark — the linearization is the lock
   * itself); the ONLY durable write this unit performs is the
   * abandon close on the abort path (the rejection's evidence),
   * changes NO request state, and never alters the outcome of a
   * non-abandoned, non-aborted request (the unit is transparent: it
   * runs the caller's effect and returns its result).
   * The caller (the router) translates the typed rejection into the
   * recovery dispatch's typed zero-effect block.
   * @param input.rootSessionId - the team (root) session id.
   * @param input.requestId - the recovery Control request id (the
   *   reviewed inline request whose terminal state authorizes this
   *   effect).
   * @param input.commitEffect - the caller's first-effect commit (runs
   *   under the lock, ONLY when no abandon mark is durable and the
   *   signal is not aborted).
   * @param input.signal - the invocation's live abort signal (the
   *   caller-cancellation — the platform `AbortSignal` shape;
   *   transient, never serialized). Absent → the signal check is
   *   skipped (byte-identical authorization path).
   */
  commitEffectIfAuthorized<T>(input: {
    readonly rootSessionId: string
    readonly requestId: string
    readonly commitEffect: () => Promise<T>
    readonly signal?: ControlWaitSignal
  }): Promise<T>
  /**
   * fix-control-authz C (the residual pre-reservation boundary) — the
   * LOCK-FREE durable close for the activation provider's
   * pre-reservation abort boundary.
   *
   * Precondition: the caller ALREADY holds this service's per-team
   * lock (the effect-admission unit `commitEffectIfAuthorized` runs
   * its commitEffect — where the provider preflight lives — under the
   * SAME lock hold). This method performs NO lock acquisition
   * (re-acquiring would deadlock on the caller's own hold).
   *
   * Contract: resolves when the durable close is GUARANTEED — either
   * this call persisted the terminal mark (the additive close fact,
   * exactly-once, the same `commitAbandonmentFact` primitive the
   * explicit abandon and the unit's abort branch use) or the mark was
   * ALREADY durable (the idempotent no-op). Rejects ONLY when the
   * close persist itself faults (the typed DURABLE_WRITE_FAILED —
   * fail-closed) or the request id is unknown (typed
   * CONTROL_REQUEST_NOT_FOUND — loud).
   * @param input.rootSessionId - the team (root) session id.
   * @param input.requestId - the recovery Control request id whose
   *   durable close this settles.
   */
  persistAbandonCloseLocked(input: {
    readonly rootSessionId: string
    readonly requestId: string
  }): Promise<void>
  /**
   * Alpha.4 A4-PR3 — create (or IDEMPOTENTLY RECOVER) the first review leg
   * of one approval case (spec 11.1/11.2, ADR A1-10, A2-7).
   *
   * Every case/leg field is derived server-side (A2-7): the
   * `approvalCaseId` is the deterministic identity hash of the frozen
   * identity, and the leg's `requestId` extends the existing scope-key
   * derivation with the case id and the ordinal, so a retry of the same
   * invocation returns the SAME leg instead of minting a second one
   * (A1-10: "idempotency of `requestControl` is preserved by the leg
   * ordinal"). Only the FIRST leg is created here — a risen leg is created
   * exclusively by {@link escalateApprovalLeg}, which owns the
   * `previousRequestId` link.
   *
   * `reviewAuthority` must be a rung this build can actually reach. Human
   * Admin has no resolver in Alpha.4, so a leg written for it is REFUSED
   * with the synchronous `authority-unavailable` outcome and ZERO durable
   * side effects (ADR A1-12: termination happens before any leg row is
   * written; such a case must never enter `wait-for-response`).
   *
   * The caller's role and envelope are checked exactly as
   * {@link requestControl} checks them (no second authority path), and the
   * request row keeps its existing meaning for every pre-Alpha.4 consumer.
   * @param input.rootSessionId - the team (root) session id.
   * @param input.caller - the requesting principal (host-authenticated).
   * @param input.kind - the CARRIER kind (compatibility carrier only; not
   *   the reviewer semantics — ADR A2-17, spec 19).
   * @param input.reviewAuthority - the rung this leg is written for.
   * @param input.requiredAuthorityAtCreation - provenance only.
   * @param input.identity - the frozen case identity WITHOUT the derived
   *   `approvalCaseId` (spec 11.1; exactly one fingerprint).
   * @param input.actionName - the operation action name (scope identity).
   * @param input.toolName - the tool name when the scope names one.
   * @param input.capabilityDomain - the capability cell when known.
   * @param input.summary - human-readable review summary.
   * @param input.executionCoupling - `guarded | inline` (same semantics as
   *   {@link requestControl}).
   * @resolves the leg, or the synchronous terminal outcome (A1-12).
   */
  requestApprovalLeg(input: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly kind: ControlRequestKind
    readonly reviewAuthority: ProposalAuthorityPosition
    readonly requiredAuthorityAtCreation: ProposalAuthorityPosition
    readonly identity: ApprovalCaseIdentityInput
    readonly actionName: string
    readonly toolName?: string
    readonly capabilityDomain?: CapabilityName
    readonly summary?: string
    readonly executionCoupling?: ControlExecutionCoupling
  }): Promise<ControlRequestLegOutcome>
  /**
   * Alpha.4 A4-PR3 — escalate one leg (spec 11.4, ADR A1-10, A3-3, A3-12,
   * A5-5). THREE durable writes in ONE team-chain transaction:
   *
   * 1. the terminal `deny` decision on the closing leg with the additive
   *    reason `escalated` (A5-5 — the reason that makes
   *    `awaitControlDecision` settle instead of hanging);
   * 2. the additive `control-escalation-recorded` leg fact with the frozen
   *    A3-12(ii) payload `{ approvalCaseId, legOrdinal, previousRequestId,
   *    escalatedBy, reason }`;
   * 3. the risen leg at the next rung of
   *    {@link CONTROL_ESCALATION_SUCCESSOR} — same case id, same frozen
   *    identity, NEW requestId, `previousRequestId` = the closed leg
   *    (A1-10: escalation never reuses the parent request id).
   *
   * When the next rung does not exist (the top of the ladder: Human Admin,
   * which has no resolver in Alpha.4) write 3 is SKIPPED and the outcome is
   * `authority-unavailable` (spec 11.6) — the case terminates rather than
   * leaving a pending leg nobody can decide.
   *
   * Refusals, each with ZERO durable side effects: the leg is unknown,
   * already terminal (decided, abandoned or escalated), a pre-Alpha.4 row
   * with no case identity, or the caller is outside the kind's closed
   * resolver roles or already in the case's `reviewedBy` set (spec 11.4:
   * "old reviewer can no longer act on this case").
   * @param input.rootSessionId - the team (root) session id.
   * @param input.caller - the escalating reviewer.
   * @param input.requestId - the leg to close.
   * @param input.reason - evidence text (never authority).
   * @resolves the leg fact, the terminal decision and the risen leg.
   */
  escalateApprovalLeg(input: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly requestId: string
    readonly reason?: string
  }): Promise<ControlEscalationOutcome>
  /**
   * Alpha.4 A4-PR3 — read one approval case, derived from durable rows
   * only, with a TYPED problem outcome (A2-9: an authority-bearing read is
   * strict — a leg row that carries a case id without a leg ordinal, an
   * off-ladder review authority, two legs that disagree about the frozen
   * identity, or a broken ordinal chain is CORRUPT, never defaulted).
   * @param input.rootSessionId - the team (root) session id.
   * @param input.approvalCaseId - the case to read.
   * @resolves `kind: 'case'` with the derived state, or `kind: 'problem'`.
   */
  readApprovalCaseState(input: {
    readonly rootSessionId: string
    readonly approvalCaseId: string
  }): Promise<ApprovalCaseReadOutcome>
  /**
   * Alpha.4 A4-PR3 — list the cases with a PENDING current leg (ADR
   * A1-11: the pending list spans approval CASES, not the single
   * `leader-approval` carrier kind). A case whose current leg is decided,
   * abandoned or escalated away is not open; a case that terminated with
   * `authority-unavailable` never appears as a fake pending Admin item
   * (acceptance 21.10).
   * @param input.rootSessionId - the team (root) session id.
   * @param input.subject - optional subject filter (same canonical subject
   *   identity as the operation scope).
   * @resolves one summary per open case, in first-leg sequence order.
   */
  listOpenApprovalCases(input: {
    readonly rootSessionId: string
    readonly subject?: ControlSubject
  }): Promise<readonly ApprovalCaseSummary[]>
  /**
   * A1-12 "the told half" (`feat/a4-surface-authority-unavailable`) — list
   * the cases whose CURRENT leg is DECIDED (the exact mirror of
   * {@link listOpenApprovalCases}: the same fold, the same fail-closed skip
   * of corrupt cases, the same subject law; only the status filter differs).
   *
   * This is a READ of the fold, not an opinion about surfacing: it carries
   * EVERY decided case — an ordinary allow/deny included — because WHICH
   * decided closes an operator must see is the intervention lane's law (the
   * `resolver-unavailable` filter lives in `intervention/projection.ts`,
   * where the item-status vocabulary lives), not a control-lane default.
   * Nothing is written here; nothing pending changes meaning.
   * @param input.rootSessionId - the team (root) session id.
   * @param input.subject - optional subject filter (same canonical subject
   *   identity as the operation scope).
   * @resolves one summary per decided case, in first-leg sequence order.
   */
  listDecidedApprovalCases(input: {
    readonly rootSessionId: string
    readonly subject?: ControlSubject
  }): Promise<readonly ApprovalCaseSummary[]>
  /**
   * Alpha.4 A4-PR3 — close one leg with a TERMINAL outcome that the
   * reviewer did not choose (ADR A2-8: authority/identity drift and the
   * unavailable-resolver close live in `terminalReason`, they do NOT
   * become a fourth decision value or a fourth request status).
   *
   * The written decision value is never caller-chosen: a terminal close is
   * structurally a `deny` (the frozen mapping
   * `terminalDecisionValueFor` in `service.ts`), because a terminal outcome
   * is the one place an `allow` must be impossible (spec 11.3: "escalate
   * grants zero authority" generalizes to every non-reviewer close).
   * Refusals with zero side effects mirror {@link resolveControl}: unknown
   * request, already terminal, caller outside the resolver roles.
   * @param input.rootSessionId - the team (root) session id.
   * @param input.caller - the principal recording the close.
   * @param input.requestId - the leg to close.
   * @param input.terminalReason - a closed {@link ControlLegTerminalReason}.
   * @param input.note - evidence text (never authority).
   * @resolves the terminal decision row.
   */
  appendTerminalOutcome(input: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly requestId: string
    readonly terminalReason: ControlLegTerminalReason
    readonly note?: string
  }): Promise<ControlDecisionRecord>
  /**
   * Alpha.4 A4-PR3 — the FROZEN mapping from a terminal reason to the
   * durable decision value it must be recorded with (ADR A2-8). Every
   * terminal reason maps to `deny`: exposing the mapping (rather than
   * letting a caller pick a value) is what makes "a close the reviewer did
   * not choose mints authority" impossible to express. Exposed for the
   * PR4/PR5 lanes and pinned by `a4p3-approval-escalation.test.ts`.
   * @param terminalReason - a closed {@link ControlLegTerminalReason}.
   * @returns the decision value the terminal row carries.
   */
  terminalDecisionValueFor(terminalReason: ControlLegTerminalReason): ControlDecisionValue
  /**
   * Alpha.4 A4-PR3 — terminate a case that can produce NO reviewable leg, and
   * make the termination DURABLE (ADR A1-12, A2-8, spec 11.6; audit F2).
   *
   * TWO input forms, exactly one of which is accepted:
   * - `identity` + `carrier`: the case may not exist yet (the A1-12 case). The
   *   case id is DERIVED from the identity (A2-7), the born-terminal leg row and
   *   its terminal deny are written, and the closure is returned. A retry of the
   *   same call is idempotent: it returns the same closure and writes nothing.
   * - `approvalCaseId`: the case must already exist. A terminal case returns its
   *   existing closure (idempotent); a case with an OPEN leg is REFUSED, because
   *   that leg is reviewable and `appendTerminalOutcome` owns it.
   *
   * `carrier` names what the leg row must say (carrier kind, the rung that
   * could not review, the operation). It is required with `identity` and
   * forbidden with `approvalCaseId` — a leg row cannot be written from a
   * fingerprint alone, and inventing those fields would be the fabrication this
   * lane exists to avoid.
   *
   * Authority: the caller must be a resolver of `carrier.kind` (the same closed
   * `CONTROL_RESOLVER_ROLES` table the resolve path uses), so a member cannot
   * close somebody else's case. The asymmetry is deliberate and is why the check
   * is the only authority gate: a close can ONLY ever write a `deny` (see
   * {@link terminalDecisionValueFor}), so a mistaken caller costs a refusal,
   * never a grant.
   * @param input - the case (by identity or id) and the closed terminal reason.
   * @returns the closure: the derived case id, the leg row and the deny.
   */
  closeApprovalCaseWithoutLeg(input: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly approvalCaseId?: string
    readonly identity?: ApprovalCaseIdentityInput
    readonly carrier?: {
      readonly kind: ControlRequestKind
      readonly reviewAuthority: ProposalAuthorityPosition
      readonly actionName: string
      readonly toolName?: string
    }
    readonly terminalReason: ControlLegTerminalReason
    readonly note?: string
  }): Promise<ControlCaseClosure>
  /**
   * Alpha.4 A4-PR3 — resolve a frozen approval-case identity to its case
   * (ADR A2-7, spec 11.1; audit F3). Derived, never caller-chosen: the id is
   * recomputed from the identity and then VERIFIED against the durable rows, so
   * a caller cannot assert a case id it does not own, and a decided case (which
   * the open-case list cannot show) is still reachable.
   * @param input.rootSessionId - the team (root) session id.
   * @param input.identity - the frozen identity (exactly one fingerprint).
   * @returns `found` with the case id, or `none`.
   */
  findApprovalCaseByIdentity(input: {
    readonly rootSessionId: string
    readonly identity: ApprovalCaseIdentityInput
    readonly kind?: ControlRequestKind
  }): Promise<ApprovalCaseIdentityLookup>
}
