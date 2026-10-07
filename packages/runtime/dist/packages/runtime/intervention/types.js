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
/**
 * The projection kind (spec §14.1). `warning` and `error` are declared now
 * because the CLOSED set is part of the frozen contract PR6/PR7 build on;
 * A4-PR3 only ever produces `approval` items.
 */
export const INTERVENTION_KINDS = {
    APPROVAL: 'approval',
    WARNING: 'warning',
    ERROR: 'error',
};
/** Every closed intervention kind value. */
export const INTERVENTION_KIND_VALUES = Object.values(INTERVENTION_KINDS);
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
};
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
};
/** Every closed intervention status value. */
export const INTERVENTION_STATUS_VALUES = Object.values(INTERVENTION_STATUSES);
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
};
/** Every closed reviewer-action value. */
export const INTERVENTION_ACTION_VALUES = Object.values(INTERVENTION_ACTIONS);
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
};
/** The durable origin of an item (spec §14.1 `source`). */
export const INTERVENTION_SOURCE_KINDS = {
    CONTROL_CASE: 'control-case',
    /** PR6: envelope-consistency warnings (spec §15). */
    GOVERNANCE_WARNING: 'governance-warning',
    /** PR6: compatibility admission state (spec §16). */
    COMPATIBILITY: 'compatibility',
};
//# sourceMappingURL=types.js.map