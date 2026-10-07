/**
 * Alpha.4 A4-PR3 — the legality DERIVATION law and the frozen terminal
 * case-outcome vocabularies (spec §11.5, §11.6, §12, §24.2; ADR A1-7, A1-12,
 * A2-1, A2-8, A3-2, A5-1, A5-2, X8).
 *
 * Scope, stated once because the plan is explicit about it (ADR X8):
 * **A4-PR3 produces outcome VOCABULARY and DERIVATION only.** The durable
 * recording of a terminal outcome behind a real execution, and the
 * registration files that surface these outcomes in the remote/UI planes,
 * belong to PR4/PR5 and PR6. Nothing in this module executes anything, and
 * nothing that executes consults it (ADR A1-17, pinned by
 * `a4p3-intervention-projection.test.ts`).
 *
 * The law is a pure function over an injected {@link RequiredAuthorityFacts}
 * bag. That shape is a ruling, not a shortcut: the ceiling algebra is
 * `CEILING_LANE`-only, and `a3p3-governance-lane-hygiene.test.ts` bans the
 * names that would let this module compute the facts itself — so the facts
 * arrive as a callback's result and the LAW (which action is legal for which
 * combination) lives here where it can be pinned. The bag also carries no
 * ladder ordering: comparing rungs is the reader's job, and re-spelling the
 * ladder or its rank here would create the second ordering ADR X7-R3 forbids.
 *
 * @module @dsh-agent-team/runtime/intervention
 */

import { controlEscalationSuccessor } from '../control/types.js'
import type { ApprovalCaseState, ControlRequestRecord } from '../control/types.js'
import type {
  InterventionAction,
  InterventionBlockScope,
  InterventionDerivationReason,
  InterventionItem,
  InterventionResponseBehavior,
  InterventionStatus,
  RequiredAuthorityFacts,
  RequiredAuthorityReader,
  RequiredAuthorityReaderInput,
} from './types.js'
import {
  INTERVENTION_ACTIONS,
  INTERVENTION_DERIVATION_REASONS,
  INTERVENTION_KINDS,
  INTERVENTION_RESPONSE_BEHAVIORS,
  INTERVENTION_SOURCE_KINDS,
  INTERVENTION_STATUSES,
} from './types.js'

// --- frozen terminal outcome vocabularies ---------------------------------------------

/**
 * The closed terminal-outcome vocabulary of a single OPERATION (plan Task 3
 * lane B, frozen by ADR X8 after the task body had dropped `authority-un‐
 * determined` against A1-7 / spec §24.2).
 *
 * The two `authority-*` values name DIFFERENT failures and must never be
 * conflated: `authority-unavailable` means "no resolver/admission path
 * exists today" (a missing Human Admin), while `authority-undetermined` means
 * "the ceiling could not be computed for this scope" (A1-7). Collapsing them
 * would report a filesystem fault or an undecidable containment as an Admin
 * escalation, and A5-2 pins the consequence the other way: undetermined makes
 * `allow` never legal.
 */
export const TERMINAL_OPERATION_OUTCOMES = {
  EXECUTION_SUCCEEDED: 'execution-succeeded',
  EXECUTION_UNAVAILABLE: 'execution-unavailable',
  STALE: 'stale',
  DENIED: 'denied',
  AUTHORITY_UNAVAILABLE: 'authority-unavailable',
  AUTHORITY_UNDETERMINED: 'authority-undetermined',
} as const

/** One closed terminal operation outcome. */
export type TerminalOperationOutcome =
  (typeof TERMINAL_OPERATION_OUTCOMES)[keyof typeof TERMINAL_OPERATION_OUTCOMES]

/** Every closed terminal operation outcome, in declaration order. */
export const TERMINAL_OPERATION_OUTCOME_VALUES: readonly TerminalOperationOutcome[] = Object.values(
  TERMINAL_OPERATION_OUTCOMES,
)

/**
 * The closed terminal-outcome vocabulary of a durable MUTATION proposal
 * (spec §24.2, plan Task 3 lane B). `mutation-stale` is the drift outcome
 * (CAS / lifecycle / root-identity drift after approval, acceptance 21.6) and
 * `mutation-no-change` the "approved but nothing to write" outcome.
 */
export const TERMINAL_MUTATION_OUTCOMES = {
  MUTATION_COMMITTED: 'mutation-committed',
  MUTATION_NO_CHANGE: 'mutation-no-change',
  MUTATION_STALE: 'mutation-stale',
  DENIED: 'denied',
  AUTHORITY_UNAVAILABLE: 'authority-unavailable',
  AUTHORITY_UNDETERMINED: 'authority-undetermined',
} as const

/** One closed terminal mutation outcome. */
export type TerminalMutationOutcome =
  (typeof TERMINAL_MUTATION_OUTCOMES)[keyof typeof TERMINAL_MUTATION_OUTCOMES]

/** Every closed terminal mutation outcome, in declaration order. */
export const TERMINAL_MUTATION_OUTCOME_VALUES: readonly TerminalMutationOutcome[] = Object.values(
  TERMINAL_MUTATION_OUTCOMES,
)

/** The authorization side of a terminal outcome (who said what, last). */
export const TERMINAL_AUTHORIZATIONS = {
  ALLOWED: 'allowed',
  DENIED: 'denied',
  STALE: 'stale',
  NONE: 'none',
} as const

export type TerminalAuthorization = (typeof TERMINAL_AUTHORIZATIONS)[keyof typeof TERMINAL_AUTHORIZATIONS]

/** The authority side: availability of a resolver, and decidability (§24.2). */
export const TERMINAL_AUTHORITY_STATES = {
  RESOLVED: 'resolved',
  UNAVAILABLE: 'unavailable',
  UNDETERMINED: 'undetermined',
} as const

export type TerminalAuthorityState =
  (typeof TERMINAL_AUTHORITY_STATES)[keyof typeof TERMINAL_AUTHORITY_STATES]

/** The execution side of an operation that reached its last-mile check. */
export const TERMINAL_EXECUTIONS = {
  SUCCEEDED: 'succeeded',
  UNAVAILABLE: 'unavailable',
} as const

export type TerminalExecution = (typeof TERMINAL_EXECUTIONS)[keyof typeof TERMINAL_EXECUTIONS]

/** Whether an approved mutation actually changed the durable document. */
export const TERMINAL_MUTATION_EFFECTS = {
  CHANGED: 'changed',
  NO_CHANGE: 'no-change',
} as const

export type TerminalMutationEffect =
  (typeof TERMINAL_MUTATION_EFFECTS)[keyof typeof TERMINAL_MUTATION_EFFECTS]

/** The inputs of the operation terminal-outcome table (all three, always). */
export interface TerminalOperationInput {
  readonly authorization: TerminalAuthorization
  readonly authority: TerminalAuthorityState
  readonly execution: TerminalExecution
}

/** The inputs of the mutation terminal-outcome table. */
export interface TerminalMutationInput {
  readonly authorization: TerminalAuthorization
  readonly authority: TerminalAuthorityState
  readonly effect: TerminalMutationEffect
}

/**
 * The operation terminal outcome, as a TOTAL table with a fixed precedence
 * (spec §12, §24.2; ADR A1-7, A5-2).
 *
 * Precedence is the law, so it is stated: authority first (an undetermined
 * ceiling is absorbing and an unavailable resolver means no execution was
 * ever admissible), then the reviewer's decision, then execution. The
 * consequence that matters is that an `allow` NEVER outranks an authority
 * problem — an approval cannot execute itself into existence.
 *
 * @param input - the three axes of the terminated invocation.
 * @returns the closed terminal outcome.
 */
export function deriveTerminalOperationOutcome(input: TerminalOperationInput): TerminalOperationOutcome {
  if (input.authority === TERMINAL_AUTHORITY_STATES.UNDETERMINED) {
    return TERMINAL_OPERATION_OUTCOMES.AUTHORITY_UNDETERMINED
  }
  if (input.authority === TERMINAL_AUTHORITY_STATES.UNAVAILABLE) {
    return TERMINAL_OPERATION_OUTCOMES.AUTHORITY_UNAVAILABLE
  }
  if (input.authorization === TERMINAL_AUTHORIZATIONS.DENIED) {
    return TERMINAL_OPERATION_OUTCOMES.DENIED
  }
  if (input.authorization === TERMINAL_AUTHORIZATIONS.STALE) {
    return TERMINAL_OPERATION_OUTCOMES.STALE
  }
  return input.execution === TERMINAL_EXECUTIONS.SUCCEEDED
    ? TERMINAL_OPERATION_OUTCOMES.EXECUTION_SUCCEEDED
    : TERMINAL_OPERATION_OUTCOMES.EXECUTION_UNAVAILABLE
}

/**
 * The mutation terminal outcome, same precedence (spec §21.6, §24.2).
 *
 * @param input - the three axes of the terminated proposal.
 * @returns the closed terminal outcome.
 */
export function deriveTerminalMutationOutcome(input: TerminalMutationInput): TerminalMutationOutcome {
  if (input.authority === TERMINAL_AUTHORITY_STATES.UNDETERMINED) {
    return TERMINAL_MUTATION_OUTCOMES.AUTHORITY_UNDETERMINED
  }
  if (input.authority === TERMINAL_AUTHORITY_STATES.UNAVAILABLE) {
    return TERMINAL_MUTATION_OUTCOMES.AUTHORITY_UNAVAILABLE
  }
  if (input.authorization === TERMINAL_AUTHORIZATIONS.DENIED) {
    return TERMINAL_MUTATION_OUTCOMES.DENIED
  }
  if (input.authorization === TERMINAL_AUTHORIZATIONS.STALE) {
    return TERMINAL_MUTATION_OUTCOMES.MUTATION_STALE
  }
  return input.effect === TERMINAL_MUTATION_EFFECTS.CHANGED
    ? TERMINAL_MUTATION_OUTCOMES.MUTATION_COMMITTED
    : TERMINAL_MUTATION_OUTCOMES.MUTATION_NO_CHANGE
}

// --- the strict / legacy row discriminator --------------------------------------------

/**
 * The two row shapes the Control plane carries (ADR X8: the discriminator is
 * `approvalCaseId` PRESENCE, and it decides strictness).
 *
 * `present ⇒ strict` is what makes the additive fields safe: a row that
 * carries a case id but no `reviewAuthority` is CORRUPT and must be reported
 * as corrupt — defaulting it would silently invent a reviewer for an
 * authority-bearing row (A2-9). A row without a case id is a pre-Alpha.4 row
 * and keeps its pre-Alpha.4 semantics exactly.
 */
export const CONTROL_ROW_SHAPES = {
  STRICT: 'strict',
  LEGACY: 'legacy',
} as const

export type ControlRowShape = (typeof CONTROL_ROW_SHAPES)[keyof typeof CONTROL_ROW_SHAPES]

/** The minimal structural view the discriminator reads. */
export interface ControlRowDiscriminee {
  readonly approvalCaseId?: string
  readonly legOrdinal?: number
  readonly reviewAuthority?: string
}

/**
 * Which shape a durable request row has.
 *
 * @param row - the row's additive Alpha.4 fields.
 * @returns `strict` exactly when the row carries an `approvalCaseId`.
 */
export function controlRowShapeOf(row: ControlRowDiscriminee): ControlRowShape {
  return typeof row.approvalCaseId === 'string' && row.approvalCaseId.length > 0
    ? CONTROL_ROW_SHAPES.STRICT
    : CONTROL_ROW_SHAPES.LEGACY
}

/**
 * The typed corruption of a strict row, or undefined when it is well formed.
 * A strict row missing `reviewAuthority` or `legOrdinal` is NEVER defaulted.
 *
 * @param row - the row's additive Alpha.4 fields.
 * @returns the corruption reason, or undefined.
 */
export function strictRowProblem(
  row: ControlRowDiscriminee,
): 'missing-review-authority' | 'missing-leg-ordinal' | undefined {
  if (controlRowShapeOf(row) === CONTROL_ROW_SHAPES.LEGACY) return undefined
  if (typeof row.reviewAuthority !== 'string' || row.reviewAuthority.length === 0) {
    return 'missing-review-authority'
  }
  if (typeof row.legOrdinal !== 'number' || !Number.isInteger(row.legOrdinal) || row.legOrdinal < 1) {
    return 'missing-leg-ordinal'
  }
  return undefined
}

// --- the legality law (spec §11.5) ----------------------------------------------------

/** What the law derived, and why (never an empty explanation). */
export interface LegalActionDerivation {
  readonly actions: readonly InterventionAction[]
  readonly reasons: readonly InterventionDerivationReason[]
}

/**
 * The §11.5 legal-action law, derived fresh on the server.
 *
 * ```text
 * reviewAuthority < requiredAuthority  OR  desiredEffect > grantCeiling
 *   -> deny | escalate
 * reviewAuthority >= requiredAuthority AND reviewAuthority < human-admin
 *   -> allow | escalate | deny
 * reviewAuthority = human-admin
 *   -> allow | deny
 * ```
 *
 * Read as code below, with three closures the spec text leaves to the ADRs:
 *
 * - `escalate` is legal only when the rung above HAS a resolver (spec §11.6:
 *   a case whose next rung nobody can decide terminates instead of offering
 *   an escape hatch that leads nowhere);
 * - `allow` is never legal when a ceiling is undetermined (A5-2), which is
 *   why that check precedes the ladder branches — and the OUTCOME stays
 *   `authority-undetermined`, it is never coerced into `deny`;
 * - an empty set is the honest answer for a terminal leg and for a principal
 *   who already acted on an earlier leg of the same case (spec §11.4,
 *   acceptance 21.5: "escalated old leg cannot later allow" — the durable
 *   backing is the case's `reviewedBy` set of PRINCIPALS, ADR 24.5).
 *
 * `escalate` grants ZERO execution authority: it is a routing act, and the
 * action set itself is never consulted by a write path (spec §14.2).
 *
 * @param facts - the fresh facts from the injected reader.
 * @returns the legal actions and the closed reasons behind them.
 */
export function deriveLegalActions(facts: RequiredAuthorityFacts): LegalActionDerivation {
  const reasons: InterventionDerivationReason[] = []
  const actions: InterventionAction[] = []
  // Escalate legality is spec 11.5's `reviewAuthority < human-admin` clause,
  // read off the FROZEN successor table (audit F1) - never off resolver
  // availability. `human-admin` is the only rung with no successor, so it is
  // the only rung where `escalate` disappears; a Human-User leg keeps the act
  // even though Alpha.4 has no Admin resolver, because A1-12 decides what the
  // act DOES (a synchronous `authority-unavailable` close), not whether it is
  // offered. A reviewer who cannot escalate cannot recuse.
  const mayEscalate = controlEscalationSuccessor(facts.requiredAuthority) !== null
  if (!facts.resolverExists) {
    // A1-12: this leg's own rung has no resolver in this build. The case
    // terminates; there is nothing to offer anybody.
    return { actions: [], reasons: [INTERVENTION_DERIVATION_REASONS.NO_RESOLVER] }
  }
  if (facts.principalAlreadyActed) {
    return { actions: [], reasons: [INTERVENTION_DERIVATION_REASONS.REVIEWER_ALREADY_ACTED] }
  }
  if (facts.ceilingUndetermined) {
    reasons.push(INTERVENTION_DERIVATION_REASONS.CEILING_UNDETERMINED)
    if (mayEscalate) actions.push(INTERVENTION_ACTIONS.ESCALATE)
    actions.push(INTERVENTION_ACTIONS.DENY)
    return { actions, reasons }
  }
  const insufficient =
    !facts.reviewerAtOrAboveRequiredAuthority || !facts.desiredEffectWithinGrantCeiling
  if (insufficient) {
    reasons.push(INTERVENTION_DERIVATION_REASONS.INSUFFICIENT_REACH)
    if (mayEscalate) actions.push(INTERVENTION_ACTIONS.ESCALATE)
    actions.push(INTERVENTION_ACTIONS.DENY)
    return { actions, reasons }
  }
  reasons.push(INTERVENTION_DERIVATION_REASONS.LEG_OPEN)
  actions.push(INTERVENTION_ACTIONS.ALLOW)
  if (mayEscalate) {
    actions.push(INTERVENTION_ACTIONS.ESCALATE)
  } else {
    // Top of the ladder: the reviewer may decide, and there is nobody above.
    reasons.push(INTERVENTION_DERIVATION_REASONS.TOP_OF_LADDER)
  }
  actions.push(INTERVENTION_ACTIONS.DENY)
  return { actions, reasons }
}

// --- the item derivation ---------------------------------------------------------------

/**
 * The status/block-scope mapping, stated once because §14.1 has no row for
 * every durable close:
 *
 * | durable state                       | status                 | responseBehavior    | blockScope    |
 * |-------------------------------------|------------------------|---------------------|---------------|
 * | leg pending, resolver exists        | `open`                 | `wait-for-response` | the operation |
 * | leg pending, no resolver (A1-12)    | `authority-unavailable`| `informational`     | `null`        |
 * | leg decided (allow/deny/stale)      | `resolved`             | `informational`     | `null`        |
 * | leg abandoned                       | `stale`                | `informational`     | `null`        |
 *
 * An abandoned leg maps to `stale` because that is the assertion the durable
 * row makes: the invocation the item existed for is gone (§14.1 offers no
 * `abandoned`; inventing a sixth status would fork the vocabulary).
 */
function statusOf(
  caseState: ApprovalCaseState,
  facts: RequiredAuthorityFacts | undefined,
): {
  readonly status: InterventionStatus
  readonly responseBehavior: InterventionResponseBehavior
  readonly reason: InterventionDerivationReason | undefined
} {
  if (caseState.status === 'abandoned') {
    return {
      status: INTERVENTION_STATUSES.STALE,
      responseBehavior: INTERVENTION_RESPONSE_BEHAVIORS.INFORMATIONAL,
      reason: INTERVENTION_DERIVATION_REASONS.LEG_ABANDONED,
    }
  }
  if (caseState.status === 'decided') {
    return {
      status: INTERVENTION_STATUSES.RESOLVED,
      responseBehavior: INTERVENTION_RESPONSE_BEHAVIORS.INFORMATIONAL,
      reason: INTERVENTION_DERIVATION_REASONS.LEG_DECIDED,
    }
  }
  if (facts !== undefined && !facts.resolverExists) {
    return {
      status: INTERVENTION_STATUSES.AUTHORITY_UNAVAILABLE,
      responseBehavior: INTERVENTION_RESPONSE_BEHAVIORS.INFORMATIONAL,
      reason: INTERVENTION_DERIVATION_REASONS.NO_RESOLVER,
    }
  }
  return {
    status: INTERVENTION_STATUSES.OPEN,
    responseBehavior: INTERVENTION_RESPONSE_BEHAVIORS.WAIT_FOR_RESPONSE,
    reason: undefined,
  }
}

/** The operation fingerprint this item is bound to (key-omitted otherwise). */
function fingerprintOf(caseState: ApprovalCaseState): string | undefined {
  const identity = caseState.identity
  return identity.operationFingerprint ?? identity.mutationProposalFingerprint
}

function blockScopeOf(caseState: ApprovalCaseState): InterventionBlockScope {
  const fingerprint = fingerprintOf(caseState)
  return fingerprint === undefined ? null : { kind: 'operation', operationFingerprint: fingerprint }
}

/** The reader input a case's current leg produces. */
function readerInputOf(caseState: ApprovalCaseState): RequiredAuthorityReaderInput | undefined {
  const current = caseState.currentLeg
  const identity = caseState.identity
  const ordinal = current?.legOrdinal
  const reviewAuthority = current?.reviewAuthority
  if (current === undefined || ordinal === undefined || reviewAuthority === undefined) {
    return undefined
  }
  return {
    approvalCaseId: identity.approvalCaseId,
    legOrdinal: ordinal,
    reviewAuthority,
    beneficiaryAuthority: identity.beneficiaryAuthority,
    requestedEffect: identity.requestedEffect,
    subject: identity.subject,
    actionName: current.actionName,
    ...(identity.operationFingerprint !== undefined
      ? { operationFingerprint: identity.operationFingerprint }
      : {}),
    ...(identity.mutationProposalFingerprint !== undefined
      ? { mutationProposalFingerprint: identity.mutationProposalFingerprint }
      : {}),
  }
}

/**
 * Project one approval case to its InterventionItem.
 *
 * The item's identity is the CASE's, not the leg's: a risen leg updates the
 * same item (acceptance 21.9: "duplicate fingerprint updates count/time
 * rather than adding item"), which is what the §18.4 escalated-leg UX needs.
 *
 * @param caseState - the derived case state from the durable rows.
 * @param reader - the injected required-authority reader; ABSENT means this
 *   PR has no governance reader wired, and the honest projection is then "no
 *   legal actions" (spec §18.3: the client uses server-provided actions
 *   only — it is never allowed to guess them).
 * @returns the projected item.
 */
export async function deriveInterventionItem(
  caseState: ApprovalCaseState,
  reader?: RequiredAuthorityReader,
): Promise<InterventionItem | undefined> {
  const identity = caseState.identity
  const current = caseState.currentLeg
  const input = readerInputOf(caseState)
  // `undefined` is a RESULT, not a default (audit F6): a reader that is absent,
  // or one that threw, or one that answered `undefined`, means the lane holds
  // NO authority facts. The item then publishes no `requiredAuthority` and
  // offers no action - it does not borrow the leg's own rung and call it
  // required authority.
  const facts =
    reader !== undefined && input !== undefined ? await reader(input) : undefined
  const state = statusOf(caseState, facts)
  const open = state.status === INTERVENTION_STATUSES.OPEN
  const legal =
    facts === undefined || !open
      ? { actions: [] as readonly InterventionAction[], reasons: [] as readonly InterventionDerivationReason[] }
      : deriveLegalActions(facts)
  const reasons: InterventionDerivationReason[] = [...legal.reasons]
  if (open && facts === undefined) {
    // The honest reason an open case offers nothing: the authority could not be
    // determined. A5-2's absorbing vocabulary, not a silent empty list.
    reasons.push(INTERVENTION_DERIVATION_REASONS.CEILING_UNDETERMINED)
  }
  if (state.reason !== undefined) reasons.unshift(state.reason)
  const fingerprint = fingerprintOf(caseState)
  // 14.1's `createdAt` is a durable instant or the item does not exist: an open
  // case always has a current leg, and a zero-leg A1-12 case is projected by
  // `deriveZeroLegAuthorityUnavailableItem` with an explicit observation time.
  // The previous fallback put `identity.correlation` - a routing token - into
  // an ISO-8601 field, which is a fabricated timestamp (audit F16).
  const firstLeg = caseState.legs[0]
  const createdAt = current?.createdAt ?? firstLeg?.createdAt
  if (createdAt === undefined) return undefined
  return {
    interventionId: `int-${identity.approvalCaseId}`,
    kind: INTERVENTION_KINDS.APPROVAL,
    responseBehavior: state.responseBehavior,
    blockScope: state.responseBehavior === INTERVENTION_RESPONSE_BEHAVIORS.WAIT_FOR_RESPONSE
      ? blockScopeOf(caseState)
      : null,
    source: {
      kind: INTERVENTION_SOURCE_KINDS.CONTROL_CASE,
      id: identity.approvalCaseId,
      ...(current !== undefined ? { requestId: current.requestId, legOrdinal: current.legOrdinal } : {}),
      ...(current !== undefined ? { carrierKind: current.kind } : {}),
    },
    status: state.status,
    ...(facts !== undefined ? { requiredAuthority: facts.requiredAuthority } : {}),
    ...(current?.reviewAuthority !== undefined
      ? { currentReviewAuthority: current.reviewAuthority }
      : {}),
    legalActions: legal.actions,
    derivationReasons: reasons,
    ...(fingerprint !== undefined ? { fingerprint } : {}),
    createdAt,
  }
}

/** The projection over a set of derived cases, in stable (id) order. */
export async function deriveInterventionItems(
  caseStates: readonly ApprovalCaseState[],
  reader?: RequiredAuthorityReader,
): Promise<readonly InterventionItem[]> {
  const items: InterventionItem[] = []
  for (const caseState of [...caseStates].sort((a, b) =>
    a.identity.approvalCaseId < b.identity.approvalCaseId ? -1 : 1,
  )) {
    const item = await deriveInterventionItem(caseState, reader)
    // A case with no durable timestamp to carry is not projected (see
    // `deriveInterventionItem`); it is never given a synthetic one.
    if (item !== undefined) items.push(item)
  }
  return items
}

/**
 * The ADR A1-12 / spec §11.6 synchronous termination item: a case that can
 * produce NO review leg is surfaced once, informationally, with nothing to
 * act on and nothing held. What makes it safe is that the case never had an
 * OPEN leg — the durable close writes its leg row already DECIDED (audit F2),
 * so nothing can reconstruct as "a fake pending Admin request" (acceptance
 * 21.10).
 *
 * @param input - the frozen identity facts of the case that cannot be reviewed.
 * @returns the informational item.
 */
export function deriveZeroLegAuthorityUnavailableItem(input: {
  readonly approvalCaseId: string
  readonly requiredAuthority: RequiredAuthorityFacts['requiredAuthority']
  readonly fingerprint?: string
  readonly observedAt: string
}): InterventionItem {
  return {
    interventionId: `int-${input.approvalCaseId}`,
    kind: INTERVENTION_KINDS.APPROVAL,
    responseBehavior: INTERVENTION_RESPONSE_BEHAVIORS.INFORMATIONAL,
    blockScope: null,
    source: { kind: INTERVENTION_SOURCE_KINDS.CONTROL_CASE, id: input.approvalCaseId },
    status: INTERVENTION_STATUSES.AUTHORITY_UNAVAILABLE,
    requiredAuthority: input.requiredAuthority,
    legalActions: [],
    derivationReasons: [INTERVENTION_DERIVATION_REASONS.NO_RESOLVER],
    ...(input.fingerprint !== undefined ? { fingerprint: input.fingerprint } : {}),
    createdAt: input.observedAt,
  }
}

/**
 * The current leg of a case, exposed for the PR4/PR5 lanes that need the
 * carrier row without re-deriving the case (a convenience projection; it
 * grants nothing).
 *
 * @param caseState - the derived case state.
 * @returns the current leg row, when the case has one.
 */
export function currentLegOf(caseState: ApprovalCaseState): ControlRequestRecord | undefined {
  return caseState.currentLeg
}
