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
    // A5M2 (root 01:01 card, G5 lane supply): the B-SESSION family carries TWO
    // minted claim shapes under ONE signed entry — the todo `replace-list` plan
    // (todo.mjs:234-246, unchanged field-for-field) and the G5 goal-service
    // face (g5-goal-wiring.mjs flat projection over g5-goal-service.mjs rev.1
    // plan facts, records 27/28/29). Discriminated through the ALREADY-SIGNED
    // variant grammar (root 17:40 mechanism, the B-SUBAGENT encoding precedent):
    // the shared required leaf is `operation` — both mints emit it as a literal
    // their LANE mints from census truth (todo.mjs:64 'replace-list'; the G5
    // census A5_G5_GOAL_RECORDS 'goal-read'/'goal-create'/'goal-action-
    // dispatch') — and each group closes over its own exact key set. ZERO new
    // kinds: the goal leaves ride the committed grammar (string, boolean,
    // nonNegativeInt, stringArray, nullableString — root 18:42: missing ≠ null
    // ≠ '' stay three outcomes; the authority pair is nullable on BOTH sides so
    // observed/UNOBSERVED stay distinguishable end-to-end, never a silent
    // pass). `namedGaps` carries the adapter's VERBATIM gap strings — the
    // disclosure contract stays mint-side like every family's. `binds` pins
    // each goal group's toolName to its ONE literal (full-value binding — a
    // goal variant can never ride another tool's leaf); the todo group binds
    // nothing (it has no constant leaf of its own; its field set was and stays
    // the signed six-over-the-leaf). TODO CLAIM VERDICTS ARE PRESERVED: every
    // denial the flat rule produced for a real todo claim (first-missing-
    // required in the same field order, foreign-key closed-set, wrong-type)
    // rides the SAME bytes through the group law; the only refusal that did not
    // exist before is for an operation literal NO mint can produce, which
    // selected nothing before only because nothing typed the leaf at all.
    // currentFields keeps the signed trio (current-facts law unmoved; the goal
    // groups add NOTHING to it).
    'B-SESSION': Object.freeze({
        required: Object.freeze({
            operation: 'string',
        }),
        variant: Object.freeze({
            leaf: 'operation',
            by: Object.freeze({
                'replace-list': Object.freeze({
                    adds: Object.freeze({
                        agentId: 'string',
                        sessionHeaderId: 'string',
                        todosDigest: 'string',
                        counts: 'countsTriple',
                        allowParallelPolicy: 'boolean',
                        paramFingerprint: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
                'goal-read': Object.freeze({
                    adds: Object.freeze({
                        toolName: 'string',
                        recordIndex: 'nonNegativeInt',
                        portMethods: 'stringArray',
                        authorityObserved: 'boolean',
                        authorityKind: 'nullableString',
                        authorityReason: 'nullableString',
                        namedGaps: 'stringArray',
                    }),
                    binds: Object.freeze({ toolName: 'get_goal' }),
                }),
                'goal-create': Object.freeze({
                    adds: Object.freeze({
                        toolName: 'string',
                        recordIndex: 'nonNegativeInt',
                        portMethods: 'stringArray',
                        authorityObserved: 'boolean',
                        authorityKind: 'nullableString',
                        authorityReason: 'nullableString',
                        namedGaps: 'stringArray',
                    }),
                    binds: Object.freeze({ toolName: 'create_goal' }),
                }),
                'goal-action-dispatch': Object.freeze({
                    adds: Object.freeze({
                        toolName: 'string',
                        recordIndex: 'nonNegativeInt',
                        portMethods: 'stringArray',
                        authorityObserved: 'boolean',
                        authorityKind: 'nullableString',
                        authorityReason: 'nullableString',
                        namedGaps: 'stringArray',
                    }),
                    binds: Object.freeze({ toolName: 'update_goal' }),
                }),
            }),
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
    'B-BROWSER': Object.freeze({
        required: Object.freeze({
            browserVariant: 'string',
            connectionIncarnation: 'string',
            providerReSelectionLaw: 'string',
            connectionIncarnationReason: 'nullableString',
            domainAuthorityId: 'nullableString',
            businessObligations: 'obligations',
        }),
        variant: Object.freeze({
            leaf: 'browserVariant',
            by: Object.freeze({
                'launch:navigate': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', url: 'string', destinationOrigin: 'string', pageId: 'nullableString' }),
                    binds: Object.freeze({ operation: 'browser-navigate', record: 'surface:browser_owned', mode: 'launch' }),
                }),
                'launch:act': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', modelDestinationOrigin: 'string', instructionDigest: 'string', pageId: 'nullableString' }),
                    binds: Object.freeze({ operation: 'browser-act', record: 'surface:browser_owned', mode: 'launch' }),
                }),
                'launch:observe': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', modelDestinationOrigin: 'string', instructionDigest: 'string', pageId: 'nullableString' }),
                    binds: Object.freeze({ operation: 'browser-observe', record: 'surface:browser_owned', mode: 'launch' }),
                }),
                'launch:extract': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', modelDestinationOrigin: 'string', instructionDigest: 'string', pageId: 'nullableString' }),
                    binds: Object.freeze({ operation: 'browser-extract', record: 'surface:browser_owned', mode: 'launch' }),
                }),
                'attach:navigate': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', url: 'string', destinationOrigin: 'string', pageId: 'nullableString', attachEndpointOrigin: 'string', attachNote: 'string' }),
                    binds: Object.freeze({ operation: 'browser-navigate', record: 'surface:browser_owned', mode: 'attach' }),
                }),
                'attach:act': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', modelDestinationOrigin: 'string', instructionDigest: 'string', pageId: 'nullableString', attachEndpointOrigin: 'string', attachNote: 'string' }),
                    binds: Object.freeze({ operation: 'browser-act', record: 'surface:browser_owned', mode: 'attach' }),
                }),
                'attach:observe': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', modelDestinationOrigin: 'string', instructionDigest: 'string', pageId: 'nullableString', attachEndpointOrigin: 'string', attachNote: 'string' }),
                    binds: Object.freeze({ operation: 'browser-observe', record: 'surface:browser_owned', mode: 'attach' }),
                }),
                'attach:extract': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', modelDestinationOrigin: 'string', instructionDigest: 'string', pageId: 'nullableString', attachEndpointOrigin: 'string', attachNote: 'string' }),
                    binds: Object.freeze({ operation: 'browser-extract', record: 'surface:browser_owned', mode: 'attach' }),
                }),
                'launch:screenshot': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', fullPage: 'boolean', pageId: 'nullableString' }),
                    binds: Object.freeze({ operation: 'browser-screenshot', record: 'surface:browser_owned', mode: 'launch' }),
                }),
                'attach:screenshot': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', fullPage: 'boolean', pageId: 'nullableString', attachEndpointOrigin: 'string', attachNote: 'string' }),
                    binds: Object.freeze({ operation: 'browser-screenshot', record: 'surface:browser_owned', mode: 'attach' }),
                }),
                'launch:tabs': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', branch: 'string', url: 'nullableString', destinationOrigin: 'nullableString', pageId: 'nullableString' }),
                    binds: Object.freeze({ operation: 'browser-tabs', record: 'surface:browser_owned', mode: 'launch' }),
                }),
                'attach:tabs': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', mode: 'string', branch: 'string', url: 'nullableString', destinationOrigin: 'nullableString', pageId: 'nullableString', attachEndpointOrigin: 'string', attachNote: 'string' }),
                    binds: Object.freeze({ operation: 'browser-tabs', record: 'surface:browser_owned', mode: 'attach' }),
                }),
            }),
        }),
        currentFields: Object.freeze(['browserVariant', 'operation', 'record', 'mode']),
    }),
    'B-WEB': Object.freeze({
        required: Object.freeze({
            operation: 'string',
            // ROOT 02:17: same-named required 'string' — the mint carries the
            // snapshot losslessly via the existing canonicalJsonStringify (observed
            // branches, every ID/null, searchOrigin key-absence all preserved byte-
            // exact). Not a new object kind; nothing moved out of the plan.
            providerIdentityAtClassify: 'string',
            businessObligations: 'obligations',
        }),
        variant: Object.freeze({
            leaf: 'operation',
            by: Object.freeze({
                'fetch-exact-url': Object.freeze({
                    adds: Object.freeze({ url: 'string', destinationOrigin: 'string' }),
                    binds: Object.freeze({}),
                }),
                'search-queries': Object.freeze({
                    adds: Object.freeze({ queriesSummary: 'stringArray', queryCount: 'nonNegativeInt', destinationOrigin: 'string', providerOriginSource: 'string' }),
                    binds: Object.freeze({}),
                }),
            }),
        }),
        currentFields: Object.freeze(['operation', 'providerIdentityAtClassify']),
    }),
    'B-WRITE': Object.freeze({
        // A5M2-G3 REAL-GAP card (2026-10-25): the write plan is EXISTENCE-
        // HONEST — existence is unknowable at pure classify, so the approved
        // target states the LAW both outcomes obey (the reviewed r16 existing-
        // file closure; the new FD-bound O_EXCL create closure) instead of the
        // old `existingFileOnly: true` promise, which was FALSE for any call
        // whose approval would create. `directoryCreation: false` is the
        // closed-effect-set fact (I:tool-invoke + F(write exact file) only —
        // mkdir lives outside the grant; disclosed deviation from the native
        // mkdir-recursive spelling).
        required: Object.freeze({
            familyId: 'string',
            adapterRevision: 'nonNegativeInt',
            operation: 'string',
            realmId: 'string',
            canonicalTarget: 'string',
            contentFingerprint: 'string',
            existingFileLaw: 'string',
            newFileLaw: 'string',
            directoryCreation: 'boolean',
        }),
        currentFields: Object.freeze(['operation', 'realmId', 'canonicalTarget']),
    }),
    // A5-M2 B-CONTROL (root ruling, pure-equivalence leaf flatten, then the
    // root LIMITED BUILD ORDER 2026-10-25: the four self-governance records
    // 83/84/87/88 (plus the 85 read row) proceed under the authorized Alpha5
    // tool scope - the strict variant 7529218e5 §5 named the closing change
    // explicitly ("request identity + action facts INTO the target"); this
    // entry IS that change, closed at the ORIGINAL REAL TARGET'S FULL VALUES
    // - no dropped values, no digest/summary work-around. The lane module that
    // produces this claim is
    // src/plugin/live/governed-families/g1-surface-adapters.mjs (records
    // 83/84/85/87/88; the B-CONTROL mint side). The five trusted TARGETS
    // config leaves ride FLAT one-for-one (the signed 7529218e5 floor -
    // CONFIG facts the mount provides and the model can never supply); the
    // request identity and action facts now ride the DISCRIMINATED variant
    // group, keyed by the minted own-key leaf `controlRecord` (the B-INSPECT
    // variant grammar, reused - no new table kind). Optional argument leaves
    // ride the sanctioned REVIEWED ENCODING: the full value's canonical JSON,
    // or the literal 'absent' when the caller omitted it - never a removed
    // key, never a hash. The mint side stamps the B-CONTROL family adapter
    // revision 8 (A5_G1_CONTROL_ADAPTER_REVISION): the encoding digest moved,
    // so any earlier B-CONTROL-era approval is EXPLICITLY stale - retired
    // encodings are never translated, and the other G1 families keep 7.
    // currentFields: what THIS call's binding/member/realm facts restate.
    // A5-M2 B-EDIT (root FS-EDIT card 2026-10-25, the write leaf's sibling):
    // the edit plan is the M-02 pre-booked shape — the approved target carries
    // the PAIRED read law ("edit/replace 另需 read effect；配对 read effect
    // 走同一受治理读臂, 不得另起弱读面", quoted verbatim into the arm's
    // readEffectLaw law-fact) plus the existence-honest `creationPossible:
    // false` (the edit NEVER creates; an absent target is a typed closure
    // refusal) and the echo law (before/after ride ONLY under the paired read
    // effect — M-02's condition on the before/after face). Producing module:
    // src/plugin/live/governed-families/edit.mjs. No new kinds, no new
    // ledger; currentFields is the write leaf's trusted trio, unmoved.
    'B-EDIT': Object.freeze({
        required: Object.freeze({
            familyId: 'string',
            adapterRevision: 'nonNegativeInt',
            operation: 'string',
            realmId: 'string',
            canonicalTarget: 'string',
            oldFingerprint: 'string',
            newFingerprint: 'string',
            replaceAll: 'boolean',
            creationPossible: 'boolean',
            editFileLaw: 'string',
            readEffectLaw: 'string',
            echoLaw: 'string',
        }),
        currentFields: Object.freeze(['operation', 'realmId', 'canonicalTarget']),
    }),
    // A5M2 FS-EDIT card 2026-10-25 PART D (root continuation card): the
    // str_replace_editor family rides the B-INSPECT variants/discriminant
    // template — ONE command-keyed closed map, four groups. The discriminant
    // `sreVariant` is a required 'string' leaf (the validator's own law);
    // each group adds ONLY the law-facts its shipped closure branch actually
    // carries (post-consume-sre.ts). creationPossible is the existence-honest
    // required leaf every branch states; the card law "creationPossible 仅
    // create 组 true" rides GRAMMAR-side as a BOUND law leaf per group (the
    // validator only lets adds leaves bind, so the literal is a string law:
    // exactly ONE group binds a creation law, the other three bind the
    // never-creates law — paired constants, not arbitrary strings). The
    // read-carrying groups (view/str_replace/insert) carry M-02's pre-booked
    // paired-read line and the echo law; the create group asks NO read and
    // echoes NOTHING.
    'B-SRE': Object.freeze({
        required: Object.freeze({
            familyId: 'string',
            adapterRevision: 'nonNegativeInt',
            operation: 'string',
            realmId: 'string',
            canonicalTarget: 'string',
            sreVariant: 'string',
            creationPossible: 'boolean',
        }),
        variant: Object.freeze({
            leaf: 'sreVariant',
            by: Object.freeze({
                view: Object.freeze({
                    adds: Object.freeze({ viewRange: 'string', maxOutputChars: 'nonNegativeInt', viewLaw: 'string', readEffectLaw: 'string', echoLaw: 'string', neverCreatesLaw: 'string' }),
                    binds: Object.freeze({ neverCreatesLaw: 'this B-SRE branch never creates: an absent target is a typed refusal inside the closure, zero creation (the write row existence-honest law); creationPossible false' }),
                }),
                create: Object.freeze({
                    adds: Object.freeze({ fileTextFingerprint: 'string', createFileLaw: 'string', creationLaw: 'string' }),
                    binds: Object.freeze({ creationLaw: 'create is the ONLY B-SRE branch whose reviewed law can bring a file into being (O_EXCL through the verified final-parent fd); a present target loses with zero bytes; creationPossible true' }),
                }),
                str_replace: Object.freeze({
                    adds: Object.freeze({ oldFingerprint: 'string', newFingerprint: 'string', strReplaceLaw: 'string', readEffectLaw: 'string', echoLaw: 'string', neverCreatesLaw: 'string' }),
                    binds: Object.freeze({ neverCreatesLaw: 'this B-SRE branch never creates: an absent target is a typed refusal inside the closure, zero creation (the write row existence-honest law); creationPossible false' }),
                }),
                insert: Object.freeze({
                    adds: Object.freeze({ newStrFingerprint: 'string', insertLine: 'nonNegativeInt', insertLaw: 'string', readEffectLaw: 'string', echoLaw: 'string', neverCreatesLaw: 'string' }),
                    binds: Object.freeze({ neverCreatesLaw: 'this B-SRE branch never creates: an absent target is a typed refusal inside the closure, zero creation (the write row existence-honest law); creationPossible false' }),
                }),
            }),
        }),
        currentFields: Object.freeze(['operation', 'realmId', 'canonicalTarget']),
    }),
    'B-CONTROL': Object.freeze({
        required: Object.freeze({
            controlRecord: 'string',
            trustedMemberAgentId: 'string',
            trustedSessionHeaderId: 'string',
            trustedRealmId: 'string',
            trustedOwner: 'string',
            trustedProfileId: 'string',
        }),
        variant: Object.freeze({
            leaf: 'controlRecord',
            by: Object.freeze({
                // 83 team_request_control - the request identity (requestToken) and
                // the action facts (kind/targetInstanceId/actionName) ride the
                // target at full value; toolName/summary are OPTIONAL on the lane
                // face (packages/tools requestControlSpec), so they ride as the
                // reviewed-encoding string ('absent' when omitted).
                'request-control': Object.freeze({
                    adds: Object.freeze({
                        requestRootSessionId: 'string',
                        requestToken: 'string',
                        requestKind: 'string',
                        requestTargetInstanceId: 'string',
                        requestActionName: 'string',
                        requestToolName: 'string',
                        requestSummary: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
                // 84 team_resolve_control - the case identity (requestId) and the
                // decision ride the target; note is OPTIONAL (reviewed encoding).
                'resolve-control': Object.freeze({
                    adds: Object.freeze({
                        requestRootSessionId: 'string',
                        requestToken: 'string',
                        requestCaseId: 'string',
                        requestDecision: 'string',
                        requestNote: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
                // 85 team_list_pending_control (the read row the 03:05 closed-key
                // hand-over arms): the requestToken identity rides the target;
                // limit is OPTIONAL (reviewed encoding).
                'list-pending': Object.freeze({
                    adds: Object.freeze({
                        requestRootSessionId: 'string',
                        requestToken: 'string',
                        requestLimit: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
                // 87 team_grant_permission / 88 team_revoke_permission - the
                // permission-subject instance and the rules structure ride the
                // target: rules is REQUIRED on the lane face and rides the full
                // value's canonical JSON under the reviewed encoding (no new table
                // kind, no digest).
                'grant-permission': Object.freeze({
                    adds: Object.freeze({
                        requestRootSessionId: 'string',
                        requestToken: 'string',
                        permissionTargetInstanceId: 'string',
                        permissionRules: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
                'revoke-permission': Object.freeze({
                    adds: Object.freeze({
                        requestRootSessionId: 'string',
                        requestToken: 'string',
                        permissionTargetInstanceId: 'string',
                        permissionRules: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
            }),
        }),
        currentFields: Object.freeze(['trustedMemberAgentId', 'trustedSessionHeaderId', 'trustedRealmId']),
    }),
    // A5M2 B-SEARCH (CENTER M0 无主行分配 card, 2026-10-25): the two team names
    // team_grep (M0-B record 7) and team_glob (record 8) - scope=alias, the
    // names EXIST nowhere on the pinned host face (measured read-only at
    // 639ed01539: the published tools are tool-fs-search grep.ts:285-340
    // {pattern required, path?, include?} and glob.ts:296-353 {pattern
    // required, path?}); they are the governed plane's OWN mount names
    // (team-tool-plane.mjs DEFAULT_PLANE_NAMES). This entry types the
    // DURABLE claim of the B-SEARCH arm
    // (src/plugin/live/governed-families/search.mjs, adapterRevision 1), which
    // mints these leaves one-for-one at classify - the REQUIRED new-mint to
    // same-validator pairing legs ride the arm's own author spec
    // (test/a5m2-bsearch-team-c1.test.ts). The face leaves are the measured
    // 639 parameter face transcribed with the signed three-state discipline
    // (a missing optional parameter is minted as null; '' and absent stay
    // distinct claims); canonicalTarget is the search root anchored by the
    // pure-lexical law imported from plane-effect-backends (lexicalAnchor -
    // zero disk at classify); the caller leaves are the team-family caller
    // law (exec.agent identity paired against the bind-time facts - the row
    // is mounted per governed Agent closure, the plane's per-scope
    // judgement); effectLaw states the M0 read-subtree delta CLOSED as
    // I:tool-invoke + F(read on the anchored search root). The ONLY shape
    // delta between the two published faces is grep's `include` filter, and
    // that is exactly the variant split: the glob claim carrying `include`
    // answers 'include: not part of the B-SEARCH typed plan'.
    'B-SEARCH': Object.freeze({
        required: Object.freeze({
            familyId: 'string',
            adapterRevision: 'nonNegativeInt',
            operation: 'string',
            realmId: 'string',
            pattern: 'string',
            path: 'nullableString',
            canonicalTarget: 'string',
            anchorLaw: 'string',
            effectLaw: 'string',
            callerMemberAgentId: 'string',
            callerSessionHeaderId: 'string',
        }),
        variant: Object.freeze({
            leaf: 'operation',
            by: Object.freeze({
                'team-grep-content-search': Object.freeze({
                    adds: Object.freeze({ include: 'nullableString' }),
                    binds: Object.freeze({}),
                }),
                'team-glob-path-match': Object.freeze({
                    adds: Object.freeze({}),
                    binds: Object.freeze({}),
                }),
            }),
        }),
        currentFields: Object.freeze(['operation', 'realmId', 'callerMemberAgentId', 'callerSessionHeaderId']),
    }),
    // A5M2-G1-WIRE B-PLUGIN (record 52 plugin_manager; CENTER whole-family
    // order 2026-10-25: the old "zero-code closed" reading of this row is
    // WITHDRAWN - the 639 face was re-read from source
    // (tests/deepseek-harness-test-use @ 639ed01539,
    // packages/boot/plugin-manager/src/tools.ts: the closed 8-action enum at
    // :41, the params at :42-50, the HOST gate chain at :38-44) and the family
    // takes its durable table NOW. The action leaf is the minted discriminant
    // (the native's own switch, tools.ts:47-92); every variant carries its
    // FULL-VALUE facts - the parsed install spec as its canonical JSON, the
    // registry plan as the REAL three-way arrays, the exact exemption pair as
    // its own leaves - the reviewed encoding law, never a dropped key or a
    // digest. install_bundle's TARGET pairing is complete here; its manager
    // ENTRY stays fail-closed until the deployer mounts the Host gate seams
    // (the adapter L5 edge refuses with zero manager entry - the closed table
    // is an approval floor, never an enablement). Revision 8 pairs with
    // A5_G1_PLUGIN_ADAPTER_REVISION (flat scalar leaves; the nested surface
    // this table replaces was never walkable). currentFields trio: the
    // current-facts law rides the trusted envelope as everywhere.
    'B-PLUGIN': Object.freeze({
        required: Object.freeze({
            action: 'string',
            trustedMemberAgentId: 'string',
            trustedSessionHeaderId: 'string',
            trustedRealmId: 'string',
            trustedOwner: 'string',
            trustedProfileId: 'string',
        }),
        variant: Object.freeze({
            leaf: 'action',
            by: Object.freeze({
                // the three READ enumerations: the native defaults them (tools.ts:64-65
                // offset 0 / limit 25) and validates them (tools.ts:66-69) - the mint
                // answers post-default integers, so the claim carries the REAL page.
                list_plugins: Object.freeze({
                    adds: Object.freeze({ offsetClaim: 'nonNegativeInt', limitClaim: 'nonNegativeInt' }),
                    binds: Object.freeze({}),
                }),
                list_bundles: Object.freeze({
                    adds: Object.freeze({ offsetClaim: 'nonNegativeInt', limitClaim: 'nonNegativeInt' }),
                    binds: Object.freeze({}),
                }),
                list_version_exemptions: Object.freeze({
                    adds: Object.freeze({ offsetClaim: 'nonNegativeInt', limitClaim: 'nonNegativeInt' }),
                    binds: Object.freeze({}),
                }),
                // the two enable lanes (tools.ts:76-81): entry NAME target (the
                // '@scope/pkg' shape legal, version-qualified refused by the mint) +
                // the enabled claim (reviewed encoding: the face allows an omitted
                // boolean; the native then refuses the call - the claim records it
                // honestly as 'absent') + the profile config write locator.
                set_plugin: Object.freeze({
                    adds: Object.freeze({ targetClaim: 'string', enabledClaim: 'string', profileConfigLocator: 'string' }),
                    binds: Object.freeze({}),
                }),
                set_bundle: Object.freeze({
                    adds: Object.freeze({ targetClaim: 'string', enabledClaim: 'string', profileConfigLocator: 'string' }),
                    binds: Object.freeze({}),
                }),
                // install (tools.ts:83-89 + index.ts installBundle contract): the
                // parsed spec canonical JSON AT FULL VALUE, the claimed registry
                // canonical href (null = none claimed), the REAL allowed/fallback
                // arrays from the trusted profile facts, the three write locators.
                install_bundle: Object.freeze({
                    adds: Object.freeze({
                        installSpecClaim: 'string',
                        claimedRegistryCanonical: 'nullableString',
                        allowedRegistries: 'stringArray',
                        fallbackRegistries: 'stringArray',
                        profileConfigLocator: 'string',
                        installRootLocator: 'string',
                        versionExemptionDerived: 'boolean',
                    }),
                    binds: Object.freeze({}),
                }),
                remove_bundle: Object.freeze({
                    adds: Object.freeze({
                        targetClaim: 'string',
                        profileConfigLocator: 'string',
                        installRootLocator: 'string',
                        versionExemptionDerived: 'boolean',
                    }),
                    binds: Object.freeze({}),
                }),
                // the SEPARATE risk lane (tools.ts:49-52,57-62): the exact manifest
                // package-name@version pair + the exact runtime version + the
                // informed acceptRisk claim - NEVER derivable from an install (the
                // mint stamps derivableFromInstall false and the table never lets an
                // install row borrow this variant).
                set_version_exemption: Object.freeze({
                    adds: Object.freeze({
                        exemptionLocator: 'string',
                        targetClaim: 'string',
                        exemptionTargetName: 'string',
                        exemptionTargetVersion: 'string',
                        runtimeVersionClaim: 'string',
                        acceptRiskClaim: 'boolean',
                        derivableFromInstall: 'boolean',
                    }),
                    binds: Object.freeze({}),
                }),
            }),
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
    // A5M2 G1-WIRE (center 14575 advance order, M0 1-record): the durable claim of
    // record 25 `load_workspace_dependencies` is the adapter CLASSIFY manifest read
    // as FLAT LEAVES (the B-CONTROL mint law). Target per
    // M0-B-FAMILY-TARGET-CONTRACTS.md §B-DEPENDENCY: I+S(workspace runtime install
    // namespace, install, write) + F(精确runtime cache/目的目录/临时路径). The three
    // locators ride at FULL VALUE - the F envelope: the payload source directory,
    // the fixed runtime root under the Harness home, and its parent (where the
    // controlled path's staging directory lives); the reused controlled path rides
    // as ONE reviewed-encoding 'string' leaf the adapter mints as a constant (the
    // B-TERMINAL precedent - no new kind; the delegate's bind-check refuses a moved
    // mount instead of re-running a stale plan). The trusted TARGETS envelope rides
    // as flat leaves like B-CONTROL/B-INSPECT (the pairing law's mint side).
    // Manifest versions, payload digests and the install RESULT are resource-derived
    // truth - NEVER current fields: the post-approval execution edge owns them, and
    // the reused installPrimaryRuntime gates and verifies them itself.
    'B-DEPENDENCY': Object.freeze({
        required: Object.freeze({
            sourceLocator: 'string',
            rootLocator: 'string',
            parentLocator: 'string',
            installPathRef: 'string',
            trustedMemberAgentId: 'string',
            trustedSessionHeaderId: 'string',
            trustedRealmId: 'string',
            trustedOwner: 'string',
            trustedProfileId: 'string',
        }),
        currentFields: Object.freeze(['trustedMemberAgentId', 'trustedSessionHeaderId', 'trustedRealmId']),
    }),
    // A5M2-G3-WIRE B-TERMINAL (root 20:38 闭表补齐; the lane module is
    // src/plugin/live/governed-families/g3-fsproc-adapters.mjs over the pinned
    // 639 terminal faces — six verbs, one per-open controlled plan). The
    // durable claim is the adapter CLASSIFY manifest read as FLAT LEAVES
    // (the B-CONTROL mint law): the wiring's a5G3PaTargetFlat maps every
    // admitted target leaf one-for-one at FULL VALUE — root 21:07 全值契约:
    // the approvedPlan members, the process envelope and the output window
    // ride the row under the sanctioned REVIEWED ENCODING (a string leaf
    // carrying the canonical JSON of the original value, 'absent' for a
    // null/missing one — see the wiring helper; no new table kind). The
    // digest-only re-verification law is UNCHANGED (the digest rides beside
    // the full values and the entry still re-verifies it against the actual
    // launch). Snapshot wobble stays out (service status detail, the static
    // backgroundJobTarget literal, optional caller cwd/name): the service
    // recheck owns those, the durable row never restates them.
    'B-TERMINAL': Object.freeze({
        required: Object.freeze({
            operation: 'string',
            toolName: 'string',
            realmId: 'string',
            agentId: 'string',
            sessionHeaderId: 'string',
            paramFingerprint: 'string',
        }),
        variant: Object.freeze({
            leaf: 'operation',
            by: Object.freeze({
                'pty-spawn': Object.freeze({
                    adds: Object.freeze({
                        backendPublicType: 'string',
                        backendRegistrationId: 'string',
                        backendIncarnation: 'string',
                        processEnvelopeJson: 'string',
                        perOpenCallId: 'string',
                        approvedEnvelopeDigest: 'string',
                        // 全值契约 (root 21:07): the approved controlled plan rides at
                        // full value beside its digest under the reviewed encoding.
                        planArgvJson: 'string',
                        planExecutableJson: 'string',
                        planArgv0Json: 'string',
                        planCwd: 'string',
                        planRows: 'nonNegativeInt',
                        planCols: 'nonNegativeInt',
                        planGraceMs: 'nonNegativeInt',
                        planTerminalType: 'string',
                        planEnvJson: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
                'stdin-write': Object.freeze({
                    adds: Object.freeze({
                        ptySessionId: 'string',
                        ptyIncarnation: 'string',
                        effectiveSubmit: 'boolean',
                        background: 'boolean',
                        inputDigest: 'string',
                        inputBytes: 'nonNegativeInt',
                    }),
                    binds: Object.freeze({}),
                }),
                'output-read': Object.freeze({
                    adds: Object.freeze({
                        ptySessionId: 'string',
                        ptyIncarnation: 'string',
                        // 全值契约 (root 21:07): the window travels at full value under
                        // the reviewed encoding ('absent' = the unconstrained read).
                        offsetJson: 'string',
                        countJson: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
                'signal': Object.freeze({
                    adds: Object.freeze({ ptySessionId: 'string', ptyIncarnation: 'string', signalName: 'string' }),
                    binds: Object.freeze({}),
                }),
                'close': Object.freeze({
                    adds: Object.freeze({ ptySessionId: 'string', ptyIncarnation: 'string', settlementEvidence: 'string' }),
                    binds: Object.freeze({}),
                }),
                'list': Object.freeze({
                    adds: Object.freeze({ ownerScoped: 'boolean' }),
                    binds: Object.freeze({ ownerScoped: true }),
                }),
            }),
        }),
        currentFields: Object.freeze(['operation', 'realmId', 'agentId', 'sessionHeaderId']),
    }),
    /* A5M2-G3-LSP-WIRE B-LSP (root 2026-10-24 LSP REAL-OWNER card via center;
     * the lane module is packages/runtime/src/plugin/live/governed-families/
     * g3-lsp-wiring.mjs — its a5LspPaTargetFlat is this entry's counterpart,
     * the delegate arm is the COMMITTED fsproc adapter createGovernedLspArm
     * (681568c84, imported as-is; the 8e62 untouchable law).
     * THE FIXED SCOPE (root ruling, zero-code refusal not accepted): EXACTLY
     * the four navigation operations at the tool-lsp pin (LSP_OPERATIONS) —
     * goToDefinition / findReferences / goToImplementation / hover — with the
     * model-facing ONE-BASED UTF-16 coordinates, the host workspace handling
     * and the capability ceilings PRESERVED (the captured native body owns
     * them; nothing here degrades them) and explicitly NO diagnostics /
     * executeCommand: the closed `by` set IS the refusal — a fifth spelling
     * selects no group and denies at the discriminant law.
     * The §5.2 target facts ride as reviewed-encoding leaves per the root
     * 21:07 全值契约: canonical-JSON string leaves ('absent' = null/missing)
     * at FULL VALUE — server binary identity + policy generation (a realm
     * disposes on policy change; the arm's recheck names the movement), the
     * document kind/canonical-locator/revision (the approval-window snapshot
     * law: a moved revision refuses at the entry), the bound workspace root,
     * and the coordinates at full value as nonNegativeInt (the arm's ONE-BASED
     * classify law keeps them >= 1 — 'absent'/zero never passes the arm).
     * All four groups carry the SAME shape and the empty binding: navigation
     * is READ-only (the effect grammar carries the one read leg; there is no
     * write, no launch, no diagnostics lane to bind). currentFields restates
     * exactly what THIS call's binding/member/realm facts can re-check. */
    'B-LSP': Object.freeze({
        required: Object.freeze({
            operation: 'string',
            toolName: 'string',
            realmId: 'string',
            agentId: 'string',
            sessionHeaderId: 'string',
            paramFingerprint: 'string',
        }),
        variant: Object.freeze({
            leaf: 'operation',
            by: Object.freeze({
                'goToDefinition': Object.freeze({
                    adds: Object.freeze({
                        docKind: 'string',
                        canonicalLocator: 'string',
                        documentRevisionJson: 'string',
                        serverBinaryIdentity: 'string',
                        serverGeneration: 'string',
                        workspaceCwd: 'string',
                        oneBasedLine: 'nonNegativeInt',
                        oneBasedCharacter: 'nonNegativeInt',
                        policyGenerationJson: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
                'findReferences': Object.freeze({
                    adds: Object.freeze({
                        docKind: 'string',
                        canonicalLocator: 'string',
                        documentRevisionJson: 'string',
                        serverBinaryIdentity: 'string',
                        serverGeneration: 'string',
                        workspaceCwd: 'string',
                        oneBasedLine: 'nonNegativeInt',
                        oneBasedCharacter: 'nonNegativeInt',
                        policyGenerationJson: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
                'goToImplementation': Object.freeze({
                    adds: Object.freeze({
                        docKind: 'string',
                        canonicalLocator: 'string',
                        documentRevisionJson: 'string',
                        serverBinaryIdentity: 'string',
                        serverGeneration: 'string',
                        workspaceCwd: 'string',
                        oneBasedLine: 'nonNegativeInt',
                        oneBasedCharacter: 'nonNegativeInt',
                        policyGenerationJson: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
                'hover': Object.freeze({
                    adds: Object.freeze({
                        docKind: 'string',
                        canonicalLocator: 'string',
                        documentRevisionJson: 'string',
                        serverBinaryIdentity: 'string',
                        serverGeneration: 'string',
                        workspaceCwd: 'string',
                        oneBasedLine: 'nonNegativeInt',
                        oneBasedCharacter: 'nonNegativeInt',
                        policyGenerationJson: 'string',
                    }),
                    binds: Object.freeze({}),
                }),
            }),
        }),
        currentFields: Object.freeze(['operation', 'realmId', 'agentId', 'sessionHeaderId']),
    }),
    /* A5M2-G3 B-PTC run_code (root 04:4x throughput card; 闭表补齐 for this
     * family — the counterpart of the wiring-side flat view
     * src/plugin/live/governed-families/g3-ptc-wiring.mjs a5G3PtcPaTargetFlat,
     * MINTED from the adapter's own CLASSIFY manifest bytes, g3-fsproc-
     * adapters.mjs validateRunCode). The single `program-run` variant carries
     * the measured target at FULL VALUE: the interpreter identity pair, the
     * EVIDENCED effective envelope pair (mode + the config-declared
     * enforcement census — the row states exactly what the supply face
     * answers, the arm refuses the run when a fact stops being evidenced),
     * the child-channel facts (capabilityList as a closed stringArray, its
     * digest, and the two budget leaves under the ACTUAL mapping — root
     * final limited ruling: canonical-JSON nullableString, a number ONLY
     * when a supplier really observes it, the total-count cap carrying the
     * honest NOT-IMPLEMENTED disclosure constant verbatim; the old
     * nonNegativeInt mandatory reading was adapter-side over-specification
     * and is WITHDRAWN), the code/
     * description digests, and the escalation request as MANIFEST DATA
     * (nullableString: null = no request; the ANSWER lives only on the
     * ptc-escalation-row bridge, never here). Object leaves (timeoutPolicy)
     * ride under the sanctioned 受审编码 canonical-JSON string ('absent' =
     * null), the B-TERMINAL reviewed-encoding precedent — no new kind. The
     * envelope/budget/channel DRIFT law stays the adapter's own recheckTarget
     * at the entry; currentFields names only the pure-data identity legs a
     * CURRENT call restates, mirroring B-TERMINAL. ENABLEMENT IS NOT THIS
     * TABLE: governance mounts on the PUBLIC tools/pre-execute seam
     * (the reserved native run_code is host-UNREGISTRABLE — index.ts:1080);
     * nothing here claims Host verification. */
    'B-PTC': Object.freeze({
        required: Object.freeze({
            operation: 'string',
            toolName: 'string',
            realmId: 'string',
            agentId: 'string',
            sessionHeaderId: 'string',
            paramFingerprint: 'string',
        }),
        variant: Object.freeze({
            leaf: 'operation',
            by: Object.freeze({
                'program-run': Object.freeze({
                    adds: Object.freeze({
                        interpreterRuntimeIdentity: 'string',
                        interpreterLanguage: 'string',
                        envelopeMode: 'string',
                        envelopeEnforcement: 'string',
                        timeoutPolicyJson: 'string',
                        capabilityList: 'stringArray',
                        capabilityCount: 'nonNegativeInt',
                        channelDigest: 'string',
                        maxParallelSubCalls: 'nullableString',
                        runDispatchBudget: 'nullableString',
                        lineageFacts: 'string',
                        codeDigest: 'string',
                        descriptionDigest: 'string',
                        timeoutMsJson: 'string',
                        requestedSandboxMode: 'nullableString',
                        justificationDigest: 'nullableString',
                        effectDelta: 'stringArray',
                    }),
                    binds: Object.freeze({}),
                }),
            }),
        }),
        currentFields: Object.freeze(['operation', 'realmId', 'agentId', 'sessionHeaderId']),
    }),
    /* A5-M2 B-SCHEDULE (root 19:06: rule mapping lands on the ALREADY-APPROVED
     * 18:42 structure; the two kinds are signed). The MINT this entry pairs
     * with (read-only fixed-commit measurement, never copied): the wire lane
     * feat/a5m2-wire-schedule @3e88b2822 — adapter
     * schedule-adapters.mjs A5_B_SCHEDULE_ADAPTER_REVISION = 2, and the claim
     * target is that lane's OWN lossless flat projection
     * (schedule-wiring.mjs mintTargetManifest, :150-203): the 11 measured
     * leaves below, every one a non-empty string EXCEPT taskId, which rides
     * exactly as measured - null (schedule_list; id-law-refused delete
     * answers) or the validated id string (admitted schedule_delete) -
     * 'nullableString' types precisely that union; the non-empty +
     * trim-stable id law stays that lane's BUSINESS edge (:511-517), never
     * encoded here (root 18:42 (2)). ONE shared closed key set for both
     * signable rows - no variant needed (measured). ENABLEMENT IS NOT THIS
     * TABLE: the ruled subset is schedule_delete(31)/schedule_list(32) only;
     * schedule_create(30)/schedule_update(33) stay disabled by that lane's
     * A5_B_SCHEDULE_WIRING_SUBSET + registration - a grammar entry is a type
     * gate, not a mount, and nothing here enables Host or claims C2. */
    'B-SCHEDULE': Object.freeze({
        required: Object.freeze({
            contract: 'string',
            ownerKind: 'string',
            ownerSessionId: 'string',
            action: 'string',
            taskId: 'nullableString',
            revision: 'string',
            timerNamespace: 'string',
            timerEffect: 'string',
            destinationSessionId: 'string',
            destinationPath: 'string',
            destinationWake: 'string',
        }),
        currentFields: Object.freeze(['ownerSessionId', 'destinationSessionId']),
    }),
    /* A5-M2 B-SESSION-QUERY (root 19:06: approved 18:42 structure, real
     * rev-4 mint measured read-only on the wire lane feat/a5m2-wire-g6
     * @fe63dec9e - A5_G6_ADAPTER_REVISION = 4, targetManifest :1346-1355).
     * Base leaves exactly as approved: toolName is the variant LEAF (a strict
     * 'string', minted from the row's own identity - never model text);
     * operation/portFamily/portMethod are 'string';
     * effectiveTargetSessionId is 'string' (measured: the mint ternary's
     * ': null' arm is UNREACHABLE - validateCapturedArgs enforces the
     * captured compiled schema's string type for session_id (:1312-1316,
     * "nothing is coerced") and requireCaller enforces a non-empty
     * caller.id string, so the fallback is always a string);
     * callerWorkspaceCwd is 'nullableString' (string INCLUDING '' or null -
     * the 18:42 (1) law, missing stays a distinct denial); disclosures is
     * 'stringArray'. PER-ROW-GROUP DIFFERENCE rides the already-signed
     * closed variants (root 18:42 (4)): BOTH search rows (session_search,
     * session_event_search) REQUIRE maxSearchResults (strict
     * nonNegativeInt - null never accepted); the three always-mount rows
     * (session_trace, session_event_trace, session_event_read) EXPLICITLY
     * FORBID the key through the own-key extra-key law (presence of ANY
     * value, null included, denies 'not part of the typed plan'). PAIRING
     * DISCLOSURE: that lane's :1353 still sets maxSearchResults: undefined
     * on non-search rows - a key-with-undefined fails closed here exactly
     * as at the lossless walk; the routed 1-line mint fix (key OMISSION)
     * belongs to that lane - this table never translates it. The disclosure
     * LAW (rev-4 mints disclosures === [SESSION_HISTORY_RESOURCE_KIND] on
     * every row, :1354, never droppable) is MINT-side; 'stringArray' types
     * it without weakening or enforcing it (18:42 (3)). currentFields is
     * the approved pure-data subset. No Host enablement, no C2 claim. */
    'B-SESSION-QUERY': Object.freeze({
        required: Object.freeze({
            toolName: 'string',
            operation: 'string',
            portFamily: 'string',
            portMethod: 'string',
            effectiveTargetSessionId: 'string',
            callerWorkspaceCwd: 'nullableString',
            disclosures: 'stringArray',
        }),
        variant: Object.freeze({
            leaf: 'toolName',
            by: Object.freeze({
                'session_search': Object.freeze({
                    adds: Object.freeze({ maxSearchResults: 'nonNegativeInt' }),
                    binds: Object.freeze({}),
                }),
                'session_event_search': Object.freeze({
                    adds: Object.freeze({ maxSearchResults: 'nonNegativeInt' }),
                    binds: Object.freeze({}),
                }),
                'session_trace': Object.freeze({
                    adds: Object.freeze({}),
                    binds: Object.freeze({}),
                }),
                'session_event_trace': Object.freeze({
                    adds: Object.freeze({}),
                    binds: Object.freeze({}),
                }),
                'session_event_read': Object.freeze({
                    adds: Object.freeze({}),
                    binds: Object.freeze({}),
                }),
            }),
        }),
        currentFields: Object.freeze(['toolName', 'operation', 'portFamily', 'portMethod']),
    }),
    /* A5-M2 B-MCP (root 19:28: express on the EXISTING signed grammar NOW -
     * variant + nullableString + stringArray; root 19:25: one REAL legal +
     * one REAL error native example, no hand-mirrored constraints). Measured
     * read-only against the LIVE mount, feat/a5m2-wire-g2
     * @5c597efea4d2f8e3ef0de5da96460c7ccf0e32c2 (A5_G2_ADAPTER_REVISION = 1,
     * round-16; targetManifest :730+; the lane's delivered field contract
     * dev/agent-workflow/evidence/a5m2-g2-wire/b-mcp-target-rule-field-
     * contract.md measured in full - its own fallback clause authorizes this
     * lane to substitute the optionality mechanism 1:1 while keeping the KEY
     * NAMES AND KINDS the row produces, measured). MECHANISM SUBSTITUTIONS
     * (each a named delta, same class as the signed G6 key-omission routing;
     * zero new kinds): (D1) the nested `surface` object flattens to its
     * measured inner key names at top level (record/transport/
     * connectionIncarnation/endpointOrigin + spawn -> spawnArgv0/
     * spawnArgCount/spawnCwd) - the signed closed law types exact key sets of
     * scalar/array leaves and NO signed kind types a nested object (the
     * round-6 Schedule lane's own lossless FLAT projection precedent,
     * root-signed 19:28 as the structure-mapping discipline); (D2)
     * applicability-conditional keys ride ALWAYS-EMITTED 'nullableString'
     * (cursor on list rows: null = no cursor passed - the signed taskId-null
     * precedent; connectionIncarnationReason: null once a REAL gen-N
     * incarnation is up; domainAuthorityId: null when none declared) - the
     * 18:07 key-omission law stays the G6 row's law; root 19:08/19:28's
     * nullable-leaf ruling types THIS family's closed law; (D3) the two-axis
     * structure (transport x method) selects SIX closed groups through ONE
     * mint-synthesized discriminant 'mcpVariant' = `stdio|http` + ':' +
     * `list|templates|read` - the SIGNED round-4 B-INSPECT inspectVariant
     * pattern (derivable from measured facts, no invented data); this is
     * what makes spawnArgCount a plain 'nonNegativeInt' (measured:
     * command.length-1 over a non-empty command, exists exactly on stdio
     * rows - no nullable-int anywhere) and FORBIDS cursor on the read groups
     * STRUCTURALLY - the mint's own published-face law 'read_mcp_resource
     * declares no cursor' (:746-748, real error example) now also holds at
     * the grammar edge. Key/pairing fidelity to the live row: every key NAME
     * above is the contract's measured name; the family-block twins
     * (familyId/adapterRevision/providerIdentity) ride the block ABOVE the
     * target (their mount legs prove it: legInput.family carries them, the
     * targetManifest does not) - never re-minted into the target; `server`
     * carries the IDENTITY LAW value (undeclared-server swaps refuse inside
     * the row BEFORE any walk - real error example, zero leg); bind
     * constants pin operation+record+transport per group (guard law: bound
     * leaves live in their group's adds, the signed queryPlatform pattern)
     * and uriOpacity binds its measured law literal verbatim (:754).
     * NOT LANDED BY DECISION, pinned: headerCount is not in the rev-1
     * manifest projection (:733) - a claim carrying it fails closed until a
     * fingerprint ruling adds it; realmId (speculative in the contract's
     * optional map) is NOT measured in the live target - this table invents
     * nothing. UNTIL D1-D3 LAND ON THE MINT (g2 lane's half, routed by this
     * entry + the pairing report) EVERY REAL B-MCP CLAIM FAILS CLOSED at the
     * required-leaf law (measured first violation on today's nested claim:
     * 'mcpVariant: required by the B-MCP typed plan, absent' - pinned); no
     * silent acceptance, no translation; digest bump + adapter revision
     * pairing at adoption. No Host enablement, no C2 claim. */
    'B-MCP': Object.freeze({
        required: Object.freeze({
            mcpVariant: 'string',
            server: 'string',
            connectionIncarnation: 'string',
            providerReSelectionLaw: 'string',
            connectionIncarnationReason: 'nullableString',
            domainAuthorityId: 'nullableString',
            businessObligations: 'obligations',
        }),
        variant: Object.freeze({
            leaf: 'mcpVariant',
            by: Object.freeze({
                'stdio:list': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', transport: 'string', spawnArgv0: 'string', spawnArgCount: 'nonNegativeInt', spawnCwd: 'nullableString', cursor: 'nullableString' }),
                    binds: Object.freeze({ operation: 'resources/list', record: 'surface:mcp_stdio', transport: 'stdio' }),
                }),
                'stdio:templates': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', transport: 'string', spawnArgv0: 'string', spawnArgCount: 'nonNegativeInt', spawnCwd: 'nullableString', cursor: 'nullableString' }),
                    binds: Object.freeze({ operation: 'resources/templates/list', record: 'surface:mcp_stdio', transport: 'stdio' }),
                }),
                'stdio:read': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', transport: 'string', spawnArgv0: 'string', spawnArgCount: 'nonNegativeInt', spawnCwd: 'nullableString', uriVerbatim: 'string', uriOpacity: 'string' }),
                    binds: Object.freeze({ operation: 'resources/read', record: 'surface:mcp_stdio', transport: 'stdio', uriOpacity: 'opaque MCP URI — carried verbatim (mcp-client connection.ts verbatim pass-through @639ed01539); no path/URL interpretation at this edge' }),
                }),
                'http:list': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', transport: 'string', endpointOrigin: 'string', cursor: 'nullableString' }),
                    binds: Object.freeze({ operation: 'resources/list', record: 'surface:mcp_http_dynamic', transport: 'streamable-http' }),
                }),
                'http:templates': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', transport: 'string', endpointOrigin: 'string', cursor: 'nullableString' }),
                    binds: Object.freeze({ operation: 'resources/templates/list', record: 'surface:mcp_http_dynamic', transport: 'streamable-http' }),
                }),
                'http:read': Object.freeze({
                    adds: Object.freeze({ operation: 'string', record: 'string', transport: 'string', endpointOrigin: 'string', uriVerbatim: 'string', uriOpacity: 'string' }),
                    binds: Object.freeze({ operation: 'resources/read', record: 'surface:mcp_http_dynamic', transport: 'streamable-http', uriOpacity: 'opaque MCP URI — carried verbatim (mcp-client connection.ts verbatim pass-through @639ed01539); no path/URL interpretation at this edge' }),
                }),
            }),
        }),
        currentFields: Object.freeze(['mcpVariant', 'operation', 'record', 'transport']),
    }),
    /* A5-M2 B-TEAM (root card 19:4x; the ONLY measured residual was THIS
     * entry - their seat already mints the exact shape). Measured read-only at
     * the Team wire lane feat/a5m2-wire-team
     * @fc072d5c248f008734bdc10b879d313c13625017 (team-wiring.mjs
     * mintTargetManifest :200-248: the lossless FLAT projection, leaf for
     * leaf, of the adapter's plan.target; adapter team-adapters.mjs @88ad3cf37
     * mintTarget :663-708, A5_B_TEAM_ADAPTER_REVISION = 1, records
     * 74-82+86) and their spec a5m2-team-wiring-c1.test.ts (g) - the 10-key
     * set their legs pin sorted. NO mint delta, NO synthetic discriminant:
     * 'operation' is a MINTED string leaf (the per-row operation constant), so
     * it discriminates TEN closed groups directly - the signed variant
     * pattern with zero new vocabulary (nullableString, signed since 5d83ed6f6,
     * types the two string-OR-null claims exactly: rootClaim and memberClaim
     * ride null AS MEASURED - an un-adjudicated claim is a measured null,
     * never a sentinel; their own grammar-honesty block predates nullableString
     * and is superseded BY THIS ENTRY, their fail-closed pin flips to
     * ACCEPTANCE at merge - expected, disclosed). Per-group adds+binds pin the
     * row↔object↔effect-label pairing at the grammar edge (guard law: bound
     * leaves live in adds): a team_collect claim CANNOT wear another row's
     * durable object or effect label; an unknown operation selects no group.
     * ASK-lane fidelity, NOT widened: the effect labels are the contract's
     * comment-side I+S annotations (the closed RESOURCE_KINDS carries NO
     * Team-object kind - the named residual their lane reports to CENTER);
     * the call still rides the ONE admitted tool-invoke effect and this table
     * invents no effect dimension. The two-branch delegate law, the
     * optionalStringField ''-normalizes-to-absent rule and the branch
     * correlations (memberClaim null ↔ which adjudication) are their
     * MINT-SIDE laws - typed here, never mirrored (root 19:25: no
     * hand-mirrored constraints). contract/rootAdjudication/revisionLaw are
     * the mint's constant law sentences: kind-typed here, their constancy and
     * their lane's exactly-one/identity refusals stay lane-side, cited not
     * encoded. currentFields = the mint-side pure-data constants the edge can
     * restate. No Host enablement; B-TEAM's four-tier row stays 未接线/接线未测
     * their own wording until a Host-accepted acceptance leg lands - no C2
     * claim from table passage. */
    'B-TEAM': Object.freeze({
        required: Object.freeze({
            operation: 'string',
            contract: 'string',
            rootClaim: 'nullableString',
            rootAdjudication: 'string',
            memberClaim: 'nullableString',
            memberAdjudication: 'string',
            revisionLaw: 'string',
            argumentLawFace: 'string',
        }),
        variant: Object.freeze({
            leaf: 'operation',
            by: Object.freeze({
                'team-list-members': Object.freeze({
                    adds: Object.freeze({ targetObject: 'string', effectLabel: 'string', rosterMemberIds: 'stringArray', rosterFingerprint: 'string' }),
                    // FACT SOURCES (documentation only — `binds` is a full-value
                    // binding and its literals are the adapter's own constants, byte-
                    // exact): rosterMemberIds = the memberInstances rows' OWN instanceIds
                    // for this Team root (deduped, sorted; the ids ARE the identity);
                    // rosterFingerprint = sha-256 over those ids joined — a digest OF
                    // that set, never a count and never a stand-in for it.
                    binds: Object.freeze({ targetObject: 'the durable Team roster (member instances + lifecycle + bound child session ids)', effectLabel: 'S(read) — the durable Team roster through the existing facade action' }),
                }),
                'team-list-templates': Object.freeze({
                    adds: Object.freeze({ targetObject: 'string', effectLabel: 'string', templateIds: 'stringArray' }),
                    // FACT SOURCE: templateIds = the member templateIds of THIS
                    // session's bound blueprint, read through the existing blueprint
                    // resolver (never a synthesized or catalog-wide set).
                    binds: Object.freeze({ targetObject: "the bound blueprint's member templates", effectLabel: "S(read) — the bound blueprint templates through the existing facade action" }),
                }),
                'team-inspect-config': Object.freeze({
                    adds: Object.freeze({ targetObject: 'string', effectLabel: 'string', memberInstanceId: 'string', memberTemplateId: 'nullableString', memberChildSessionId: 'nullableString' }),
                    // FACT SOURCES: memberInstanceId = the adapter's OWN addressed
                    // claim the resolution was attempted under; memberTemplateId /
                    // memberChildSessionId = that roster row's OWN fields, or null as
                    // the FACT OF ABSENCE when the roster carries no such instance
                    // (absence is recorded, never filled with invented row content).
                    binds: Object.freeze({ targetObject: "ONE member's durable effective-policy / requirement / recovery facts", effectLabel: "S(read) — ONE member's durable effective-policy view (config object)" }),
                }),
                'team-create-member': Object.freeze({
                    adds: Object.freeze({ targetObject: 'string', effectLabel: 'string' }),
                    binds: Object.freeze({ targetObject: 'a NEW member instance from a blueprint template (the member-lifecycle object)', effectLabel: 'I + S(durable member-lifecycle write: NEW instance; quota/envelope/gates adjudicated by the activation authority INSIDE the delegated chain)' }),
                }),
                'team-delegate': Object.freeze({
                    adds: Object.freeze({ targetObject: 'string', effectLabel: 'string' }),
                    binds: Object.freeze({ targetObject: 'a work unit with BOTH real branches (tools.ts:688-701): CONTINUE form = a NEW round on an EXISTING delegation instance (guarded on that target, SD-GUARD), CREATE form = a NEW delegation plus template-resolved member (SD-CREATE, activation authority is the gate)', effectLabel: 'I + S(durable work-unit admission; create-form additionally mints the member-lifecycle fact; child run + budget INSIDE the delegated chain; requestToken = the facade idempotency identity)' }),
                }),
                'team-follow-up': Object.freeze({
                    adds: Object.freeze({ targetObject: 'string', effectLabel: 'string' }),
                    binds: Object.freeze({ targetObject: 'a NEW work unit on an EXISTING member (same bound child session)', effectLabel: 'I + S(durable work-unit admission on an EXISTING instance (same bound child session); guard on the target INSIDE the delegated chain)' }),
                }),
                'team-collect': Object.freeze({
                    adds: Object.freeze({ targetObject: 'string', effectLabel: 'string' }),
                    binds: Object.freeze({ targetObject: 'the durable work-unit states behind the submitted request tokens', effectLabel: 'S(read) — durable work-status read-back by request tokens; writes nothing, delivers nothing' }),
                }),
                'team-send-message': Object.freeze({
                    adds: Object.freeze({ targetObject: 'string', effectLabel: 'string' }),
                    binds: Object.freeze({ targetObject: "one durable attributed message on the recipient's bound session", effectLabel: "I + S(durable message write to the member's bound session via the messaging coordinator; relay policy + guard INSIDE the delegated chain; message-commit uncertainty is NOT blindly retried — that law lives in the coordinator)" }),
                }),
                'team-report-progress': Object.freeze({
                    adds: Object.freeze({ targetObject: 'string', effectLabel: 'string' }),
                    binds: Object.freeze({ targetObject: 'one durable activity row on the per-subject lane', effectLabel: 'I + S(durable activity row on the per-subject lane; sequence + one bounded stale-retry INSIDE the delegated chain)' }),
                }),
                'team-archive-member': Object.freeze({
                    adds: Object.freeze({ targetObject: 'string', effectLabel: 'string' }),
                    binds: Object.freeze({ targetObject: "ONE member's lifecycle (quiesce-then-archive durable commits)", effectLabel: 'I + S(member-lifecycle commits: quiesce-then-archive, one or TWO durable commits per the frozen FSM; Leader-gate BEFORE any effect — all INSIDE the delegated chain)' }),
                }),
            }),
        }),
        currentFields: Object.freeze(['operation', 'targetObject', 'effectLabel']),
    }),
    /* A5-M2 B-SUBAGENT (root 21:20 JOINT limited-encoding approval; this lane
     * is the ONE table writer of this entry - root 21:20; the spawn lane's
     * earlier flat entry (feat/a5m2-new-family tree) is SUPERSEDED by this
     * joint entry at merge - a VISIBLE re-anchor of their key-set/currentFields
     * legs, never a silent translation). ONE operation-discriminated entry
     * over the EIGHT real operations of the two lanes - no new family, kind,
     * `any` or ledger. Measured read-only at the two pins: SPAWN lane
     * feat/a5m2-new-family @8c314fb94b3a694f0cc1acd14c9b9b73a36ff10b
     * (subagent-spawn-adapters.mjs mintTarget :347-366 + RECORD_SPECS
     * :111-116 records 39-43 + subagent-spawn-wiring.mjs targetManifest
     * :154-165; adapter rev 1, wiring rev 1) and CONTROLS lane
     * feat/a5m2-subagent-fix @6166344117088870799f6f64c915f872dd7e3b41
     * (subagent-adapters.mjs mintTarget :490-520, trio rows 44-46, adapter
     * rev 1, UNWIRED by their ruling - the card's field names map 1:1 onto
     * their minted caller/address{claim,relation,adjudication}/budget leaves).
     * argsCanonical/namedGapsCanonical are the joint MINT additions both
     * lanes carry per the coordination (neither projection emits them at the
     * measured pins - each lane changes ONLY its own mint, root 21:18): the
     * lane's OWN canonicalJson (sorted-key JSON.stringify, controls module
     * :234-238) - a COMPLETE reversible canonical JSON, explicitly not a
     * hash/digest: full message/prompt text, unknown legal args keys, null
     * and '' survive the round-trip (grammar-side this leaf is a plain
     * 'string'; completeness is the mint's law, not encoded here). KEY
     * ORDER is deterministically normalized by that measured helper - the
     * leaf carries content, not spelling. DELTA REPORTED (card vs measured,
     * nothing fabricated): the card lists `action` among the shared required
     * leaves, but the SIGNED guard law (module-load legality) permits binds
     * ONLY over a group's own adds - so `action` rides every group's
     * adds+binds, exactly the round-7 signed B-MCP pattern; presence is
     * still enforced for ALL eight rows (the adds loop) and the bind pins
     * action to the row's own operation at the edge (measured true: both
     * lanes mint target.action === plan.operation). effectDelta is REAL on
     * both lanes (row-level EFFECT_LABELS: controls :471, spawn :337) -
     * control-side per the card. recordIndex rides the EXISTING
     * nonNegativeInt kind, control-side per the card. currentFields
     * ['operation','action']: the mint-side row-identity constants the mount
     * edge can restate - no truth-claim widened. No Host, no registration,
     * no C2 claim from table passage. */
    'B-SUBAGENT': Object.freeze({
        required: Object.freeze({
            operation: 'string',
            contract: 'string',
            revision: 'string',
            effect: 'string',
            depth: 'string',
            argsCanonical: 'string',
            namedGapsCanonical: 'string',
        }),
        variant: Object.freeze({
            leaf: 'operation',
            by: Object.freeze({
                'subagent-spawn': Object.freeze({
                    adds: Object.freeze({ action: 'string', parent: 'string', childClaim: 'nullableString', childAdjudication: 'string', model: 'string' }),
                    binds: Object.freeze({ action: 'subagent-spawn' }),
                }),
                'subagent-fork-spawn': Object.freeze({
                    adds: Object.freeze({ action: 'string', parent: 'string', childClaim: 'nullableString', childAdjudication: 'string', model: 'string' }),
                    binds: Object.freeze({ action: 'subagent-fork-spawn' }),
                }),
                'subagent-spawn-external-codex': Object.freeze({
                    adds: Object.freeze({ action: 'string', parent: 'string', childClaim: 'nullableString', childAdjudication: 'string', model: 'string' }),
                    binds: Object.freeze({ action: 'subagent-spawn-external-codex' }),
                }),
                'subagent-spawn-external-claude-code': Object.freeze({
                    adds: Object.freeze({ action: 'string', parent: 'string', childClaim: 'nullableString', childAdjudication: 'string', model: 'string' }),
                    binds: Object.freeze({ action: 'subagent-spawn-external-claude-code' }),
                }),
                'subagent-model-routes-read': Object.freeze({
                    adds: Object.freeze({ action: 'string', parent: 'string', childClaim: 'nullableString', childAdjudication: 'string', model: 'string' }),
                    binds: Object.freeze({ action: 'subagent-model-routes-read' }),
                }),
                'subagent-interrupt': Object.freeze({
                    adds: Object.freeze({ action: 'string', caller: 'string', addressClaim: 'nullableString', addressRelation: 'string', addressAdjudication: 'string', budget: 'string', effectDelta: 'string', recordIndex: 'nonNegativeInt' }),
                    binds: Object.freeze({ action: 'subagent-interrupt' }),
                }),
                'subagent-list': Object.freeze({
                    adds: Object.freeze({ action: 'string', caller: 'string', addressClaim: 'nullableString', addressRelation: 'string', addressAdjudication: 'string', budget: 'string', effectDelta: 'string', recordIndex: 'nonNegativeInt' }),
                    binds: Object.freeze({ action: 'subagent-list' }),
                }),
                'subagent-send-message': Object.freeze({
                    adds: Object.freeze({ action: 'string', caller: 'string', addressClaim: 'nullableString', addressRelation: 'string', addressAdjudication: 'string', budget: 'string', effectDelta: 'string', recordIndex: 'nonNegativeInt' }),
                    binds: Object.freeze({ action: 'subagent-send-message' }),
                }),
            }),
        }),
        currentFields: Object.freeze(['operation', 'action']),
    }),
    /* A5-M2 B-JOB (root M0 unowned-row assignment, CENTER whole-family order;
     * whole-family continuous ownership per the root's five-point discipline —
     * this lane owns the FC-JOB mint AND this row). ONE operation-discriminated
     * entry over the THREE real operations of the FC-JOB census (frozen dispatch
     * index M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json: recordIndex 18 job_output /
     * 19 job_list / 20 job_kill; contract M0-B-FAMILY-TARGET-CONTRACTS.md#B-JOB:
     * "目标S(真实job owner+jobId+producer incarnation, read/list/cancel)，read
     * 位置/limit入manifest"; no new kind, no `any`, no ledger). Measured read-only
     * at the REAL faces: host tool surface packages/jobs/tool-jobs/src/index.ts
     * @639ed01539 (:311-414 — job_output{job_id! string, wait? boolean,
     * timeout_ms? number}, job_list{}, job_kill{job_id! string, reason? string};
     * validateJobId :170-175 refuses an empty id BEFORE any registry entry) and
     * the landed takeover row (plane-effect-backends.mjs createGovernedJobsBridge
     * — the two-fence order: gateway member-scope fence answers FIRST, an
     * un-attributed jobId passes corded:false with the host caller fence
     * authoritative, kill answers 'requested' | 'already-finished' — kill is a
     * REQUEST, settlement belongs to the producer (C3 restart-recovery-OPEN)).
     * The shared required spine mirrors the signed B-SUBAGENT face (the plane
     * mints one walk shape); argsCanonical/namedGapsCanonical are the mint's OWN
     * sorted-key canonicalJson (the :234-238 law carried from this lane) —
     * COMPLETE reversible JSON, never a digest. jobIdClaim is 'string' on the
     * two job-id rows (a missing/empty job_id is refused BEFORE the walk — a
     * minted walk always carries the claim) and 'nullableString' on job-list with
     * the mint value NULL: a list claims NO job address (the list_agents
     * never-claim law, root 21:37 family law). ownerRelation/ownerAdjudication
     * carry the TWO-FENCE answer of the pure gateway probe (each layer answers
     * only for itself — pc-CONTRACT two-fence law). producerIncarnation carries
     * the JobRegistry's own projection face (kind + startedAt from the pure
     * svc.get read — the honest incarnation seat; the contract names NO owner()/
     * done() method and none is claimed). budget carries the wait/timeout claim
     * and the registry-owned output-limit law (the contract's read 位置/limit:
     * position is the registry-owned since-last-read cursor — never
     * caller-declared; the limit is the producer-set outputLimitBytes ceiling —
     * both recorded as LAW, neither invented here). recordIndex rides the
     * existing nonNegativeInt kind. currentFields ['operation','action']: the
     * mint-side row-identity constants. No Host, no registration, no C2/C3 claim
     * from table passage. */
    'B-JOB': Object.freeze({
        required: Object.freeze({
            operation: 'string',
            contract: 'string',
            revision: 'string',
            effect: 'string',
            depth: 'string',
            argsCanonical: 'string',
            namedGapsCanonical: 'string',
        }),
        variant: Object.freeze({
            leaf: 'operation',
            by: Object.freeze({
                'job-output': Object.freeze({
                    adds: Object.freeze({ action: 'string', caller: 'string', jobIdClaim: 'string', ownerRelation: 'string', ownerAdjudication: 'string', producerIncarnation: 'string', budget: 'string', effectDelta: 'string', recordIndex: 'nonNegativeInt' }),
                    binds: Object.freeze({ action: 'job-output' }),
                }),
                'job-list': Object.freeze({
                    adds: Object.freeze({ action: 'string', caller: 'string', jobIdClaim: 'nullableString', ownerRelation: 'string', ownerAdjudication: 'string', producerIncarnation: 'string', budget: 'string', effectDelta: 'string', recordIndex: 'nonNegativeInt' }),
                    binds: Object.freeze({ action: 'job-list' }),
                }),
                'job-kill': Object.freeze({
                    adds: Object.freeze({ action: 'string', caller: 'string', jobIdClaim: 'string', ownerRelation: 'string', ownerAdjudication: 'string', producerIncarnation: 'string', budget: 'string', effectDelta: 'string', recordIndex: 'nonNegativeInt' }),
                    binds: Object.freeze({ action: 'job-kill' }),
                }),
            }),
        }),
        currentFields: Object.freeze(['operation', 'action']),
    }),
});
/* The SIGNED closed kind list - the single source the module-load legality
 * check reads (root 18:42: guard kind-table SYNCED with 'nullableString' +
 * 'stringArray'; a rule using any kind outside this closed list still THROWS
 * at import). */
export const PA_FAMILY_TARGET_FIELD_KINDS = Object.freeze([
    'string', 'boolean', 'nonNegativeInt', 'countsTriple', 'obligations', 'nullableString', 'stringArray',
]);
/** One table entry's legality, checked AT MODULE LOAD for every real entry —
 *  exported ONLY so the fixed-point contract spec can drive SYNTHETIC rules
 *  through this exact law (no synthetic family is ever added to the real
 *  table). Throws on: any required/adds leaf whose kind is outside the closed
 *  list (root 18:37: the two NEW kinds are legal ONLY inside the closed
 *  required/adds maps — own-key iteration (Object.entries) sees exactly the
 *  surface the validator reads, no widening); a variant whose discriminant is
 *  not a required 'string' leaf (a 'nullableString' can never be one); an
 *  empty group map; a group redeclaring a required leaf; a bound value
 *  violating its own kind. Same own-key law, zero cost for plain rules. */
export function assertPaFamilyTargetRuleLegality(familyId, rule) {
    const own = (record, key) => Object.prototype.hasOwnProperty.call(record, key);
    const fail = (why) => {
        throw new Error(`PA_FAMILY_TARGET_RULES['${familyId}']: malformed target grammar - ${why}`);
    };
    for (const [field, kind] of Object.entries(rule.required)) {
        if (!PA_FAMILY_TARGET_FIELD_KINDS.includes(kind))
            fail(`required leaf '${field}': unknown kind '${String(kind)}'`);
    }
    const variant = rule.variant;
    if (variant === undefined)
        return;
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
            if (!PA_FAMILY_TARGET_FIELD_KINDS.includes(kind))
                fail(`group '${name}' leaf '${field}': unknown kind '${String(kind)}'`);
        }
        for (const [field, bound] of Object.entries(group.binds)) {
            const kind = group.adds[field];
            if (kind === undefined || !isPaFamilyTargetField(kind, bound))
                fail(`group '${name}' bound value for '${field}' violates its own kind`);
        }
    }
}
/* Discriminated-target + closed-kind table legality, checked at module load
 * (root 17:40 "group结构合法"; root 18:42 kind sync). A miswritten table fails
 * loudly at import, never quietly at a claim. */
for (const [familyId, rule] of Object.entries(PA_FAMILY_TARGET_RULES))
    assertPaFamilyTargetRuleLegality(familyId, rule);
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
        /* Root 18:42 - the whole new admission surface, two cases, no more.
         * Root 5d83 residual closure: the stringArray walk runs the TRUSTED
         * intrinsic (Array.prototype.every.call over canonical indices) - a real
         * array's OWN or subclass `every` override ([1] + every:()=>true) can no
         * longer be dispatched through. Only Array.isArray + the intrinsic index
         * walk + element typeof; the lossless walk is untouched. */
        case 'nullableString': return value === null || typeof value === 'string';
        case 'stringArray': return Array.isArray(value) && Array.prototype.every.call(value, (item) => typeof item === 'string');
    }
}
/** The pure-data structure check the leg runs BEFORE the durable row: unknown family,
 *  missing field, wrong field type, extra key - each returns the offending field so the
 *  refusal names what the family's own typed plan asked for. Zero effect, zero I/O. */
export function validatePaFamilyTarget(familyId, target) {
    const rule = PA_FAMILY_TARGET_RULES[familyId];
    if (rule === undefined)
        return `familyId: no target structure is registered for '${familyId}'`;
    return validatePaFamilyTargetAgainstRule(familyId, rule, target);
}
/** The pure law of ONE table entry, split from the registry lookup only so the
 *  fixed-point contract spec can drive SYNTHETIC rules through this exact code
 *  (the real table stays closed: unknown families deny above). Production
 *  validation always enters through validatePaFamilyTarget. */
export function validatePaFamilyTargetAgainstRule(familyId, rule, target) {
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