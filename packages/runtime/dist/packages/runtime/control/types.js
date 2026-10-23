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
// PR358 f5 item-4 (read-back VALUE check): the classifier recomputes the
// payload digest EXACTLY as `requestControl` did at write (the same
// canonicalizer over the RAW read-back payload — the PA row identity is
// `operationFingerprint === reviewPayloadDigest === canonicalDigest(payload)`
// there), so a payload that stayed schema-valid but no longer hashes to the
// row's pairing re-reads as the damage it is. Runtime value import — the
// control lane already rides this exact domain edge in `service.ts`.
import { canonicalJsonFingerprint } from '../../domain/tool-governance/src/index.js';
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
};
/** Every control request kind value, for membership checks. */
export const CONTROL_REQUEST_KIND_VALUES = Object.values(CONTROL_REQUEST_KINDS);
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
export const CONTROL_RESOLVER_ROLES = {
    'leader-approval': ['leader', 'human'],
    'user-approval': ['human'],
    'envelope-mutation': ['leader', 'human'],
};
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
};
/** Every durable decision value, for membership checks. */
export const CONTROL_DECISION_VALUE_VALUES = Object.values(CONTROL_DECISION_VALUES);
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
    /**
     * A5-M1 (PR358 review fix): the allow was impossible at the DECISION gate —
     * the row is a PA operation manifest (`reviewPayload.schema ===
     * PA_CONTROL_MANIFEST_SCHEMA`) and the injected all-Effects verifier
     * ({@link ControlServiceOptions.paEffectsVerifier}) answered that the REAL
     * decider's fresh authority no longer covers EVERY effect of the covered
     * set. Recorded as a `deny` (never a fourth value — A2-1); the drift is a
     * fact about the moment of decision, and a re-ask re-presents the fresh
     * plan. Nothing was consumed.
     */
    PA_AUTHORITY_DRIFT: 'pa-authority-drift',
    /**
     * A5-M1: an allow was attempted on a PA operation-manifest row but the
     * all-Effects verification could not be answered at all — no verifier port
     * is wired, the port threw, or its verdict left the closed vocabulary.
     * "Could not confirm" is not "confirmed" (the ADR A5-16 polarity the
     * guard's A1-14 recheck already carries): recorded as a `deny`, zero
     * consumption; the reviewer may re-ask once the plane can answer.
     */
    AUTHORITY_UNDETERMINED: 'authority-undetermined',
};
/** Every durable-decision reason value, for membership checks. */
export const CONTROL_DECISION_REASON_VALUES = Object.values(CONTROL_DECISION_REASONS);
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
};
/** Every reviewer action, for membership checks. */
export const CONTROL_REVIEW_ACTION_VALUES = Object.values(CONTROL_REVIEW_ACTIONS);
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
export const CONTROL_ESCALATION_SUCCESSOR = {
    member: 'leader',
    leader: 'human-user',
    'human-user': 'human-admin',
    'human-admin': null,
};
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
export function isProposalAuthorityPosition(value) {
    return (typeof value === 'string' &&
        Object.prototype.hasOwnProperty.call(CONTROL_ESCALATION_SUCCESSOR, value));
}
/**
 * The rung a case rises to from `position` (spec 11.4), or `null` at the
 * top of the ladder (spec 11.6).
 *
 * @param position - the closing leg's review authority.
 * @returns the successor position, or null when there is none.
 */
export function controlEscalationSuccessor(position) {
    return CONTROL_ESCALATION_SUCCESSOR[position];
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
export const CONTROL_UNRESOLVABLE_AUTHORITIES = [
    'human-admin',
];
/**
 * Does this rung have a resolver in the current build?
 *
 * @param position - the ladder position to ask about.
 * @returns false exactly for {@link CONTROL_UNRESOLVABLE_AUTHORITIES}.
 */
export function hasAuthorityResolver(position) {
    return !CONTROL_UNRESOLVABLE_AUTHORITIES.includes(position);
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
};
/** Every leg terminal reason, for membership checks. */
export const CONTROL_LEG_TERMINAL_REASON_VALUES = Object.values(CONTROL_LEG_TERMINAL_REASONS);
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
};
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
};
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
};
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
};
/** The closed case-outcome vocabulary, for membership tests and pins. */
export const CONTROL_CASE_OUTCOME_VALUES = Object.values(CONTROL_CASE_OUTCOMES);
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
};
/** Every canonical subject kind value, for membership checks. */
export const CONTROL_SUBJECT_KIND_VALUES = Object.values(CONTROL_SUBJECT_KINDS);
/** Type guard: is `value` a {@link ControlSubjectKind}? */
export function isControlSubjectKind(value) {
    return typeof value === 'string' && CONTROL_SUBJECT_KIND_VALUES.includes(value);
}
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
};
/** Every execution coupling value, for membership checks. */
export const CONTROL_EXECUTION_COUPLING_VALUES = Object.values(CONTROL_EXECUTION_COUPLINGS);
/** Type guard: is `value` a {@link ControlExecutionCoupling}? */
export function isControlExecutionCoupling(value) {
    return (typeof value === 'string' && CONTROL_EXECUTION_COUPLING_VALUES.includes(value));
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
};
/** Every persisted matcher kind, for membership pins. */
export const CONTROL_AUTHORITY_MATCHER_KIND_VALUES = Object.values(CONTROL_AUTHORITY_MATCHER_KINDS);
/** Type guard: is `value` a well-formed {@link ControlAuthorityScope}? */
export function isControlAuthorityScope(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    if (typeof candidate.operationClass !== 'string' || candidate.operationClass.length === 0) {
        return false;
    }
    const matcher = candidate.matcher;
    if (typeof matcher !== 'object' || matcher === null)
        return false;
    const shaped = matcher;
    if (typeof shaped.kind !== 'string' ||
        !CONTROL_AUTHORITY_MATCHER_KIND_VALUES.includes(shaped.kind)) {
        return false;
    }
    return typeof shaped.resource === 'string' && shaped.resource.length > 0;
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
};
/** Every recheck kind, for membership pins. */
export const CONTROL_AUTHORITY_RECHECK_KIND_VALUES = Object.values(CONTROL_AUTHORITY_RECHECK_KINDS);
// --- A5-M1 (PR358 review fix): the PA operation manifest + the all-Effects verifier ----
// The M1 AUTH bridge (packages/runtime/operation-permission/pa-control-bridge.ts)
// rides a PLAIN requestControl row (no A4 case leg) whose `reviewPayload` is
// this closed PA operation manifest. The marker is the schema id; the moment
// a row carries it, THREE durable laws bind it:
//  1. requestControl RECOMPUTES the canonical digest of the payload and
//     requires BOTH `reviewPayloadDigest` and `operationFingerprint` to
//     equal it — the parameter fingerprint is a MANIFEST FIELD (execution
//     scope), the row identity is the PAYLOAD-INTEGRITY digest; a manifest
//     missing any required member is malformed (no row written);
//  2. resolveControl, before committing an ALLOW, calls the injected
//     {@link PaEffectsVerifier} inside the per-team lock with the real
//     decider; a refused or unanswered verification is committed as a
//     durable `deny` (reason `pa-authority-drift` / `authority-undetermined`,
//     the external-policy pattern) — never an allow, never a silent skip;
//  3. guardOperation, inside the SAME lock hold and before the consumption
//     fact, calls the SAME verifier with the durable allow's decider; a
//     refusal blocks with ZERO consumption (`pa-authority-drift`; an
//     unanswerable verification reuses `authority-undetermined`).
// A row WITHOUT the marker is byte-identical legacy (every pre-M1 path is
// untouched, including its `reviewPayload` as an opaque review aid).
/** The closed marker of a PA operation manifest payload (v2: the PR358 fix
 *  added the authority point and the binding/member snapshots). */
export const PA_CONTROL_MANIFEST_SCHEMA = 'a5m1.pa-control-manifest.v2';
/** The authority-rung vocabulary a manifest may name (the A4 ladder, closed;
 *  typed loosely on purpose — membership is validated, the ladder type
 *  itself lives in the governance layer the control plane must not import). */
export const PA_CONTROL_MANIFEST_RUNGS = ['member', 'leader', 'human-user', 'human-admin'];
/** Strict field-by-field parse of a manifest candidate (the marker is the
 *  entry; a present marker that fails the shape is NOT a manifest — the
 *  request is malformed, no row). Returns undefined on ANY defect. */
/** Losslessness of a value destined for the durable manifest: JSON-representable
 *  all the way down. undefined-valued keys, NaN and Infinity are refused HERE rather
 *  than being dropped or nullified by a later stringify - a hash computed over bytes
 *  that silently lost a field would approve a question nobody asked. */
/** Losslessness of a value destined for the durable manifest: JSON-representable at
 *  EVERY level - objects, arrays, and objects nested inside arrays. The point of the
 *  walk is that it runs on the RAW value, before any stringify or lossless-rewrite step
 *  could drop a member: a digest computed over bytes that silently lost a field would
 *  approve a question nobody asked. Mirrors the shape the contracts boundary
 *  (`isRemoteSafeJsonValue`) accepts, so the two ends cannot drift apart. */
export function isLosslessJsonValue(value) {
    if (value === null)
        return true;
    switch (typeof value) {
        case 'boolean':
        case 'string':
            return true;
        case 'number':
            return Number.isFinite(value);
        case 'object': {
            if (Array.isArray(value)) {
                // By INDEX, not Array.every: every skips holes, and JSON.stringify renders a
                // hole as null - the exact silent rewrite this walk exists to refuse.
                for (let index = 0; index < value.length; index += 1) {
                    if (!(index in value))
                        return false;
                    if (!isLosslessJsonValue(value[index]))
                        return false;
                }
                return true;
            }
            if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
                return false;
            return Object.entries(value).every(([key, item]) => key.length > 0
                && key !== '__proto__' && key !== 'prototype' && key !== 'constructor'
                && isLosslessJsonValue(item));
        }
        default:
            // undefined, function, symbol, bigint: all of them are things JSON would drop,
            // throw on, or quietly rewrite - never a member of an approved question.
            return false;
    }
}
/** The family block's strict parse. Returns `undefined` when the row bears NO family
 *  field at all (a legacy row - original bytes, original meaning), the parsed block
 *  when all four parse, and `'invalid'` when the block is partially present or a
 *  member is malformed: the caller fails the whole manifest in that case. */
export function parsePaManifestFamilyBlock(v) {
    const present = v.familyId !== undefined || v.adapterRevision !== undefined
        || v.providerIdentity !== undefined || v.targetManifest !== undefined;
    if (!present)
        return undefined;
    if (typeof v.familyId !== 'string' || v.familyId.length === 0 || v.familyId.length > 128)
        return 'invalid';
    if (typeof v.adapterRevision !== 'number' || !Number.isInteger(v.adapterRevision) || v.adapterRevision < 0)
        return 'invalid';
    if (typeof v.providerIdentity !== 'string' || v.providerIdentity.length === 0 || v.providerIdentity.length > 512)
        return 'invalid';
    // A target manifest is an OBJECT of facts; and it must be lossless at every level.
    // No stringify comparison here on purpose: comparing two lossy renderings of the same
    // input proves nothing - the walk above is what decides.
    if (typeof v.targetManifest !== 'object' || v.targetManifest === null || Array.isArray(v.targetManifest))
        return 'invalid';
    if (!isLosslessJsonValue(v.targetManifest))
        return 'invalid';
    return {
        familyId: v.familyId,
        adapterRevision: v.adapterRevision,
        providerIdentity: v.providerIdentity,
        targetManifest: v.targetManifest,
    };
}
export const PA_FAMILY_TARGET_RULES = Object.freeze({
    'B-SESSION': Object.freeze({
        required: Object.freeze({
            operation: 'string',
            agentId: 'string',
            sessionHeaderId: 'string',
            todosDigest: 'string',
            counts: 'countsTriple',
            allowParallelPolicy: 'boolean',
            paramFingerprint: 'string',
        }),
        currentFields: Object.freeze(['operation', 'agentId', 'sessionHeaderId']),
    }),
    'B-IMAGE': Object.freeze({
        required: Object.freeze({
            familyId: 'string',
            adapterRevision: 'nonNegativeInt',
            operation: 'string',
            realmId: 'string',
            canonicalTarget: 'string',
            declaredMediaType: 'string',
            byteCap: 'nonNegativeInt',
            byteCapSource: 'string',
            businessObligations: 'obligations',
        }),
        currentFields: Object.freeze(['operation', 'realmId', 'canonicalTarget', 'declaredMediaType']),
    }),
    // A5-M2 B-WRITE (existing-file write over the post-consume closure). The
    // approved question names ONE target file and the exact bytes' fingerprint;
    // `existingFileOnly: true` is HELD-PATH honesty IN the approved fact: this
    // family never creates (the closure carries no O_CREAT), a new-file target
    // stays HELD pending the root ruling. Resource-derived truth (the file's
    // bytes, the target's real identity) belongs to the post-approval closure
    // edge, never to this table (rule doc above).
    'B-WRITE': Object.freeze({
        required: Object.freeze({
            familyId: 'string',
            adapterRevision: 'nonNegativeInt',
            operation: 'string',
            realmId: 'string',
            canonicalTarget: 'string',
            contentFingerprint: 'string',
            existingFileOnly: 'boolean',
        }),
        currentFields: Object.freeze(['operation', 'realmId', 'canonicalTarget']),
    }),
    // A5-M2 B-CONTROL (root ruling, pure-equivalence leaf flatten; the lane
    // module that produces this claim is
    // src/plugin/live/governed-families/g1-surface-adapters.mjs, records
    // 83/84/85/87/88 - every B-CONTROL target is the trusted TARGETS config
    // envelope, minted as FLAT LEAVES one-for-one at classify). These fields are
    // CONFIG facts the mount provides and the model can never supply
    // (closedRootCheck law); no resource-derived truth rides here, so
    // currentFields is what THIS call's binding/member/realm facts can restate.
    'B-CONTROL': Object.freeze({
        required: Object.freeze({
            trustedMemberAgentId: 'string',
            trustedSessionHeaderId: 'string',
            trustedRealmId: 'string',
            trustedOwner: 'string',
            trustedProfileId: 'string',
        }),
        currentFields: Object.freeze(['trustedMemberAgentId', 'trustedSessionHeaderId', 'trustedRealmId']),
    }),
    // A5-M2 B-INSPECT (root 957 SIGNED the trusted/topology scalar flatten; root
    // 17:40 SIGNED the minimal strict DISCRIMINATED TARGET for THIS family only
    // - a technical encoding ruling, not a security-semantics change). The
    // claim shape is minted by src/plugin/live/governed-families/
    // g1-surface-adapters.mjs records 53 cordis_inspect_list and 54
    // cordis_inspect_query at revision 7 (the encoding digest moved - revision-6
    // approvals are EXPLICITLY stale; retired encodings are never translated).
    // required ∪ the selected variant group is the EXACT closed key set:
    //   'list' (rec 53): listLaw - BOUND to the list-law literal (never an
    //     arbitrary string);
    //   'query-host' (rec 54): the triple queryPlatform/queryProvider/queryMethod,
    //     queryPlatform BOUND 'host' - the exact variant↔platform pairing;
    //   'query-client' (rec 54): the triple, queryPlatform BOUND 'client', plus
    //     clientRoundtrip BOUND to the roundtrip-law literal - the law is
    //     required iff client (the closed set excludes it from every other
    //     variant) and can never be an arbitrary string.
    // The discriminant inspectVariant is minted from spec.recordIndex + the
    // authorized triple's platform (trusted record/tool truth - the closed
    // parameter grammar keeps model text out of the target), and the
    // variant↔platform pairing is grammar-bound via `binds` (module-load guard
    // below keeps every group's structure legal). All facts stay at FULL VALUE
    // inside the target - the approved question and its fingerprint keep every
    // one (nothing moved out, no effects/provider-scope extension, no new
    // ledger, no schema generalization: existing kinds + closed sets only).
    // currentFields stays the signed trusted trio (current-facts law unmoved);
    // the topology facts stay the edge re-verify's own (unchanged source,
    // verdicts, words) - now over THIS same flat encoding (rule/mint/edge one
    // encoding). The variant-value lookup is OWN-KEY only: 'toString',
    // 'constructor', '__proto__' and any unknown select nothing and deny.
    'B-INSPECT': Object.freeze({
        required: Object.freeze({
            topologyRevision: 'nonNegativeInt',
            topologyDigest: 'string',
            inspectVariant: 'string',
            trustedMemberAgentId: 'string',
            trustedSessionHeaderId: 'string',
            trustedRealmId: 'string',
            trustedOwner: 'string',
            trustedProfileId: 'string',
        }),
        variant: Object.freeze({
            leaf: 'inspectVariant',
            by: Object.freeze({
                'list': Object.freeze({
                    adds: Object.freeze({ listLaw: 'string' }),
                    binds: Object.freeze({ listLaw: 'the real list enumerates ALL providers; the row constrains that answer to the CURRENT authorized topology — unauthorized providers never appear' }),
                }),
                'query-host': Object.freeze({
                    adds: Object.freeze({ queryPlatform: 'string', queryProvider: 'string', queryMethod: 'string' }),
                    binds: Object.freeze({ queryPlatform: 'host' }),
                }),
                'query-client': Object.freeze({
                    adds: Object.freeze({ queryPlatform: 'string', queryProvider: 'string', queryMethod: 'string', clientRoundtrip: 'string' }),
                    binds: Object.freeze({
                        queryPlatform: 'client',
                        clientRoundtrip: 'the query rides the Client page response (pending-until-response); host-side cancellation of the tool call is NOT a transport cancel',
                    }),
                }),
            }),
        }),
        currentFields: Object.freeze(['trustedMemberAgentId', 'trustedSessionHeaderId', 'trustedRealmId']),
    }),
});
/* Discriminated-target table legality, checked at module load (root 17:40:
 * "group结构合法"). A miswritten variant table must fail loudly at import,
 * never quietly at a claim: the discriminant must be a required 'string'
 * leaf; every group is a plain leaf map over the EXISTING kinds; every bound
 * leaf satisfies its own kind; group leaves never redeclare a required leaf
 * (one leaf, one law). Zero cost for families without `variant` (all but
 * B-INSPECT). */
for (const [familyId, rule] of Object.entries(PA_FAMILY_TARGET_RULES)) {
    const variant = rule.variant;
    if (variant === undefined)
        continue;
    const own = (record, key) => Object.prototype.hasOwnProperty.call(record, key);
    const fail = (why) => {
        throw new Error(`PA_FAMILY_TARGET_RULES['${familyId}']: malformed variant grammar - ${why}`);
    };
    if (!own(rule.required, variant.leaf) || rule.required[variant.leaf] !== 'string')
        fail(`'${variant.leaf}' must be a required 'string' leaf`);
    const names = Object.keys(variant.by);
    if (names.length === 0)
        fail('no variant groups');
    for (const name of names) {
        const group = variant.by[name];
        if (group === null || typeof group !== 'object' || Array.isArray(group))
            fail(`group '${name}': not a leaf map`);
        for (const [field, kind] of Object.entries(group.adds)) {
            if (own(rule.required, field))
                fail(`group '${name}' redeclares required leaf '${field}'`);
            const kinds = ['string', 'boolean', 'nonNegativeInt', 'countsTriple', 'obligations'];
            if (!kinds.includes(kind))
                fail(`group '${name}' leaf '${field}': unknown kind '${String(kind)}'`);
        }
        for (const [field, bound] of Object.entries(group.binds)) {
            const kind = group.adds[field];
            if (kind === undefined || !isPaFamilyTargetField(kind, bound))
                fail(`group '${name}' bound value for '${field}' violates its own kind`);
        }
    }
}
function isPaFamilyTargetField(kind, value) {
    switch (kind) {
        case 'string': return typeof value === 'string' && value.length > 0;
        case 'boolean': return typeof value === 'boolean';
        case 'nonNegativeInt': return typeof value === 'number' && Number.isInteger(value) && value >= 0;
        case 'countsTriple': {
            if (typeof value !== 'object' || value === null || Array.isArray(value))
                return false;
            const keys = Object.keys(value);
            if (keys.length !== 3)
                return false;
            return ['pending', 'inProgress', 'completed'].every((k) => isPaFamilyTargetField('nonNegativeInt', value[k]));
        }
        case 'obligations': {
            if (!Array.isArray(value) || value.length === 0)
                return false;
            return value.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item));
        }
    }
}
/** The pure-data structure check the leg runs BEFORE the durable row: unknown family,
 *  missing field, wrong field type, extra key - each returns the offending field so the
 *  refusal names what the family's own typed plan asked for. Zero effect, zero I/O. */
export function validatePaFamilyTarget(familyId, target) {
    const rule = PA_FAMILY_TARGET_RULES[familyId];
    if (rule === undefined)
        return `familyId: no target structure is registered for '${familyId}'`;
    if (typeof target !== 'object' || target === null || Array.isArray(target))
        return 'target: not an object';
    const record = target;
    for (const [field, kind] of Object.entries(rule.required)) {
        if (!(field in record))
            return `${field}: required by the ${familyId} typed plan, absent`;
        if (!isPaFamilyTargetField(kind, record[field]))
            return `${field}: not a ${kind}`;
    }
    /* Discriminated target (root 17:40): the discriminant leaf (a required
     * 'string' the loop above just checked) selects its group by OWN-KEY exact
     * lookup - 'toString'/'constructor'/'__proto__'/unknown select nothing and
     * deny, no fallback, no coercion. The group's leaves run through the SAME
     * required check, and every `binds` entry pins its leaf to ONE exact
     * literal (full-value binding - a paired leaf is never an arbitrary
     * string). */
    let group;
    if (rule.variant !== undefined) {
        const by = rule.variant.by;
        const value = record[rule.variant.leaf];
        const selected = typeof value === 'string' && Object.prototype.hasOwnProperty.call(by, value) ? by[value] : undefined;
        if (selected === undefined)
            return `${rule.variant.leaf}: '${String(value)}' selects no ${familyId} variant group`;
        group = selected.adds;
        for (const [field, kind] of Object.entries(selected.adds)) {
            if (!(field in record))
                return `${field}: required by the ${familyId} typed plan, absent`;
            if (!isPaFamilyTargetField(kind, record[field]))
                return `${field}: not a ${kind}`;
        }
        for (const [field, bound] of Object.entries(selected.binds)) {
            if (record[field] !== bound)
                return `${field}: not the '${String(value)}' variant constant of the ${familyId} typed plan`;
        }
    }
    /* The closed-key law stays EXACT: required ∪ the selected group and nothing
     * else. For variant families the membership test is OWN-KEY on both maps, so
     * a prototype-named claim key ('toString', 'constructor', …) denies like any
     * other extra key; the original law of the other families is byte-identical,
     * untouched. */
    for (const field of Object.keys(record)) {
        const allowed = rule.variant !== undefined
            ? (Object.prototype.hasOwnProperty.call(rule.required, field)
                || (group !== undefined && Object.prototype.hasOwnProperty.call(group, field)))
            : (field in rule.required);
        if (!allowed)
            return `${field}: not part of the ${familyId} typed plan`;
    }
    return undefined;
}
/** The guard's current-target comparison: the approved target's pure-data fields
 *  restated by THIS call's trusted facts must still hold. Facts never come from the
 *  approved manifest (that would be the row quoting itself); fields outside the
 *  family's currentFields are not compared here by design - they are the execution
 *  edge's business, after approval. */
export function parsePaControlManifest(value) {
    if (typeof value !== 'object' || value === null)
        return undefined;
    const v = value;
    if (v.schema !== PA_CONTROL_MANIFEST_SCHEMA)
        return undefined;
    // A5-M2: the family block is parsed up front so a partially-present block fails the
    // whole manifest BEFORE any other field is trusted (never a silently smaller row).
    const familyBlock = parsePaManifestFamilyBlock(v);
    if (familyBlock === 'invalid')
        return undefined;
    const str = (x, max) => typeof x === 'string' && x.length > 0 && x.length <= max ? x : undefined;
    const rung = (x) => typeof x === 'string' && PA_CONTROL_MANIFEST_RUNGS.includes(x) ? x : undefined;
    const nonNegInt = (x) => typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : undefined;
    const approvalCaseId = str(v.approvalCaseId, 1024);
    if (approvalCaseId === undefined)
        return undefined;
    if (!isControlAuthorityScope(v.authorityScope))
        return undefined;
    const requiredAuthority = rung(v.requiredAuthority);
    if (requiredAuthority === undefined)
        return undefined;
    const realmId = str(v.realmId, 512);
    if (realmId === undefined)
        return undefined;
    const callId = str(v.callId, 512);
    if (callId === undefined)
        return undefined;
    const parametersFingerprint = str(v.parametersFingerprint, 512);
    if (parametersFingerprint === undefined)
        return undefined;
    const effectSetFingerprint = str(v.effectSetFingerprint, 512);
    if (effectSetFingerprint === undefined)
        return undefined;
    const authorityGeneration = nonNegInt(v.authorityGeneration);
    if (authorityGeneration === undefined)
        return undefined;
    if (!Array.isArray(v.effects))
        return undefined;
    const effectItems = v.effects;
    if (effectItems.length === 0 || effectItems.length > 64)
        return undefined;
    const effects = [];
    for (const item of effectItems) {
        if (typeof item !== 'object' || item === null)
            return undefined;
        const e = item;
        if (typeof e.kind !== 'string' || e.kind.length === 0)
            return undefined;
        if (e.kind === 'tool-invoke' && (typeof e.toolName !== 'string' || e.toolName.length === 0))
            return undefined;
        effects.push(item);
    }
    if (!Array.isArray(v.perEffectRequired))
        return undefined;
    const perEffect = [];
    for (const item of v.perEffectRequired) {
        const r = rung(item);
        if (r === undefined)
            return undefined;
        perEffect.push(r);
    }
    if (perEffect.length !== effects.length)
        return undefined;
    if (!Array.isArray(v.deniedEffects))
        return undefined;
    const deniedEffects = [];
    for (const item of v.deniedEffects) {
        if (typeof item !== 'object' || item === null)
            return undefined;
        const d = item;
        const effectIndex = nonNegInt(d.effectIndex);
        const req = rung(d.requiredAuthority);
        if (effectIndex === undefined || req === undefined)
            return undefined;
        deniedEffects.push({ effectIndex, requiredAuthority: req });
    }
    if (typeof v.binding !== 'object' || v.binding === null)
        return undefined;
    const b = v.binding;
    const bindingId = str(b.bindingId, 1024);
    const agentScopeKey = str(b.agentScopeKey, 1024);
    const bindingToolName = str(b.toolName, 512);
    const definitionIdentity = str(b.definitionIdentity, 1024);
    const providerId = str(b.providerId, 512);
    const implementationOrigin = str(b.implementationOrigin, 512);
    const executionBoundary = str(b.executionBoundary, 512);
    const status = str(b.status, 64);
    const policyGeneration = nonNegInt(b.policyGeneration);
    const bindingAuthorityGeneration = nonNegInt(b.authorityGeneration);
    const revision = nonNegInt(b.revision);
    if (bindingId === undefined || agentScopeKey === undefined || bindingToolName === undefined
        || definitionIdentity === undefined || providerId === undefined || implementationOrigin === undefined
        || executionBoundary === undefined || status === undefined
        || policyGeneration === undefined || bindingAuthorityGeneration === undefined || revision === undefined
        || typeof b.assurance !== 'object' || b.assurance === null)
        return undefined;
    if (typeof v.member !== 'object' || v.member === null)
        return undefined;
    const m = v.member;
    const teamSessionId = str(m.teamSessionId, 512);
    const instanceId = str(m.instanceId, 512);
    if (teamSessionId === undefined || instanceId === undefined)
        return undefined;
    return {
        schema: PA_CONTROL_MANIFEST_SCHEMA,
        approvalCaseId,
        authorityScope: v.authorityScope,
        requiredAuthority,
        perEffectRequired: perEffect,
        deniedEffects,
        authorityGeneration,
        realmId,
        callId,
        parametersFingerprint,
        effects: { fingerprint: effectSetFingerprint, effects },
        binding: {
            bindingId,
            agentScopeKey,
            toolName: bindingToolName,
            definitionIdentity,
            providerId,
            implementationOrigin,
            executionBoundary,
            status,
            policyGeneration,
            authorityGeneration: bindingAuthorityGeneration,
            revision,
            assurance: b.assurance,
        },
        member: { teamSessionId, instanceId },
        ...(familyBlock === undefined ? {} : familyBlock),
    };
}
const PA_MANIFEST_NOT_EFFECT_SET = Object.freeze({ state: 'not-effect-set' });
const PA_MANIFEST_CORRUPT = Object.freeze({ state: 'corrupt' });
/** Classify one durably read-back row against the PA effect-set class (see
 *  the criterion block above). PURE and total: every row lands in exactly
 *  one state; nothing is defaulted, nothing is guessed. */
export function paManifestClassOf(row) {
    const raw = row.reviewPayload;
    const markerPresent = typeof raw === 'object' && raw !== null
        && raw['schema'] === PA_CONTROL_MANIFEST_SCHEMA;
    if (markerPresent) {
        const manifest = parsePaControlManifest(raw);
        if (manifest === undefined)
            return PA_MANIFEST_CORRUPT;
        // PR358 f5 item-4 (the VALUE check, symmetric with the commit law): a
        // schema-valid payload is `valid` ONLY when the row's own PA pairing
        // re-computes: `operationFingerprint === reviewPayloadDigest ===
        // canonicalJsonFingerprint(reviewPayload)` — the exact identity
        // `requestControl` enforces at write (service.ts, same canonicalizer).
        // A payload damaged while STAYING schema-valid (or a marker-bearing row
        // that never went through that law) re-reads damaged: corrupt. No extra
        // digest argument: both gates already pass the FULL row (`RequestPayload`
        // / `ControlRequestRecord` satisfy {@link PaManifestRowShape}), so the
        // pairing fields ride the very read the classifier already performs.
        const digest = row.reviewPayloadDigest;
        const fingerprint = row.operationFingerprint;
        if (typeof digest === 'string' && digest.length > 0
            && typeof fingerprint === 'string' && fingerprint === digest
            && canonicalJsonFingerprint(raw) === digest) {
            return { state: 'valid', manifest };
        }
        return PA_MANIFEST_CORRUPT;
    }
    const digest = row.reviewPayloadDigest;
    const fingerprint = row.operationFingerprint;
    if (typeof digest === 'string' && digest.length > 0
        && typeof fingerprint === 'string' && fingerprint === digest) {
        // The PA row-identity pairing survives while the reviewPayload is not
        // a valid v2 manifest: a stripped/moved marker on a row that was
        // strict at commit. This class — damaged. Never "an ordinary old row".
        return PA_MANIFEST_CORRUPT;
    }
    return PA_MANIFEST_NOT_EFFECT_SET;
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
    /**
     * A5-M1 (PR358 review fix): the row is a PA operation manifest and the
     * injected all-Effects verifier re-derived — from the durable decider and
     * the CURRENT authority/policy facts — that at least one effect of the
     * covered set is no longer inside that decider's reach. The allow was
     * true when it was written; it is about an authority that no longer
     * exists. ZERO consumption, the same discipline as `authority-risen`.
     */
    PA_AUTHORITY_DRIFT: 'pa-authority-drift',
};
/** Every guard block reason value, for membership checks. */
export const CONTROL_GUARD_BLOCK_REASON_VALUES = Object.values(CONTROL_GUARD_BLOCK_REASONS);
//# sourceMappingURL=types.js.map