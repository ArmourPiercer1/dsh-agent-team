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
 *    toolName?, capabilityDomain?, correlation)
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
 *   the guarded tool call to ONE logical operation (Architecture 18.2).
 *
 * An allow decision is scoped to EXACTLY this tuple and is CONSUMED
 * EXACTLY ONCE by the last-mile guard (check-and-reserve under the
 * per-team lock): a second identical attempt — same tuple, same
 * correlation — finds the consumed decision and is BLOCKED; a new
 * attempt at the operation must create a NEW control request with a NEW
 * correlation (no reuse).
 *
 * @module @dsh-agent-team/runtime/control/types
 */
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
};
/** Every durable-decision reason value, for membership checks. */
export const CONTROL_DECISION_REASON_VALUES = Object.values(CONTROL_DECISION_REASONS);
// --- guard verdicts -------------------------------------------------------------------
/**
 * The closed guard block reasons (the last-mile guard NEVER throws for a
 * policy outcome — it returns a verdict; it throws only for malformed
 * input or an ambiguous durable state).
 */
export const CONTROL_GUARD_BLOCK_REASONS = {
    /** No durable control request exists for the scope (no-request). */
    NO_REQUEST: 'no-request',
    /** The request exists but carries no decision yet. */
    REQUEST_PENDING: 'request-pending',
    /** The durable decision is `deny`. */
    DECISION_DENY: 'decision-deny',
    /** The durable decision is `stale-denied` (the request is closed). */
    REQUEST_STALE: 'request-stale',
    /** The durable allow exists but was already consumed (exactly-once). */
    ALLOW_CONSUMED: 'allow-consumed',
    /** A durable decision exists for the correlation but a scope field
     *  (toolName / capabilityDomain) differs — fail closed, never guess. */
    SCOPE_MISMATCH: 'scope-mismatch',
    /** The target instance is missing, terminal (DISPOSED) or suspended
     *  (ARCHIVED — admission is closed, invariant 52), or the team session
     *  record is gone (the operation cannot execute on it). */
    TARGET_STALE: 'target-stale',
};
/** Every guard block reason value, for membership checks. */
export const CONTROL_GUARD_BLOCK_REASON_VALUES = Object.values(CONTROL_GUARD_BLOCK_REASONS);
//# sourceMappingURL=types.js.map