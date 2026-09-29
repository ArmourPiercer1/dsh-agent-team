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
import type { RemoteSafeJsonValue } from '../../contracts/src/index.js';
import type { CapabilityName } from '../../domain/policy/src/index.js';
import type { ActionCaller } from '../admission/index.js';
/**
 * The closed control request kinds (Architecture 25.1: a member may meet
 * an operation beyond its autonomy boundary that a higher authority may
 * decide).
 */
export declare const CONTROL_REQUEST_KINDS: {
    /** Request the LEADER's approval of the operation. */
    readonly LEADER_APPROVAL: "leader-approval";
    /** Request EXPLICIT USER (human) approval of the operation. */
    readonly USER_APPROVAL: "user-approval";
    /** Request a mutation inside the leader-authorized envelope. */
    readonly ENVELOPE_MUTATION: "envelope-mutation";
};
/** One of the closed control request kinds. */
export type ControlRequestKind = (typeof CONTROL_REQUEST_KINDS)[keyof typeof CONTROL_REQUEST_KINDS];
/** Every control request kind value, for membership checks. */
export declare const CONTROL_REQUEST_KIND_VALUES: readonly string[];
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
export declare const CONTROL_RESOLVER_ROLES: Record<ControlRequestKind, readonly string[]>;
/**
 * The closed durable decision values of the control plane.
 *
 * Distinct from the P6-T2 facade's generic coordination payload
 * vocabulary (`CONTROL_DECISION_VALUES` = approved/denied, an evidence
 * payload of the facade's request-control/resolve-control facts): this is
 * the decision value of the DURABLE ControlDecision row.
 */
export declare const CONTROL_DECISION_VALUES: {
    /** The operation's exact scope is authorized — exactly once (consumed
     *  by the last-mile guard). */
    readonly ALLOW: "allow";
    /** The operation's exact scope is refused (no consumption state: a
     *  denied scope can never execute through the guard). */
    readonly DENY: "deny";
    /** Stale-denied: the decision was recorded for a request whose target
     *  had become terminal (or whose team session had vanished) at
     *  decision time. The request is CLOSED and can never become an allow
     *  (fail closed; the append-only ledger has no "mark" primitive, so
     *  this decision row IS the stale mark). */
    readonly STALE_DENIED: "stale-denied";
};
/** One of the closed durable decision values. */
export type ControlDecisionValue = (typeof CONTROL_DECISION_VALUES)[keyof typeof CONTROL_DECISION_VALUES];
/** Every durable decision value, for membership checks. */
export declare const CONTROL_DECISION_VALUE_VALUES: readonly string[];
/**
 * The closed durable-decision reason vocabulary (ABSENT = an ordinary
 * allow/deny; a reason is present only for the documented special
 * outcomes).
 */
export declare const CONTROL_DECISION_REASONS: {
    /** The allow was impossible: the external hard policy denies the
     *  operation's capability cell (recorded as a `deny` decision —
     *  Architecture 25.4 / invariant 34). */
    readonly EXTERNAL_POLICY: "external-policy";
};
/** One of the closed durable-decision reasons. */
export type ControlDecisionReason = (typeof CONTROL_DECISION_REASONS)[keyof typeof CONTROL_DECISION_REASONS];
/** Every durable-decision reason value, for membership checks. */
export declare const CONTROL_DECISION_REASON_VALUES: readonly string[];
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
export declare const CONTROL_SUBJECT_KINDS: {
    /** The operation is addressed to one member instance. */
    readonly INSTANCE: "instance";
    /** The operation is about one blueprint template. */
    readonly TEMPLATE: "template";
    /** The operation is about the team as a whole (the root session). */
    readonly TEAM: "team";
};
/** One of the closed canonical subject kinds. */
export type ControlSubjectKind = (typeof CONTROL_SUBJECT_KINDS)[keyof typeof CONTROL_SUBJECT_KINDS];
/** Every canonical subject kind value, for membership checks. */
export declare const CONTROL_SUBJECT_KIND_VALUES: readonly string[];
/** Type guard: is `value` a {@link ControlSubjectKind}? */
export declare function isControlSubjectKind(value: unknown): value is ControlSubjectKind;
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
export type ControlSubject = {
    readonly kind: 'instance';
    readonly instanceId: string;
} | {
    readonly kind: 'template';
    readonly templateId: string;
} | {
    readonly kind: 'team';
    readonly rootSessionId: string;
};
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
export declare const CONTROL_EXECUTION_COUPLINGS: {
    /** The existing guarded flow (guard consumes the allow exactly once). */
    readonly GUARDED: "guarded";
    /** The inline flow (the frozen invocation continues on allow; abort
     *  durably abandons the request — no consumption fact is ever written). */
    readonly INLINE: "inline";
};
/** One of the closed execution couplings. */
export type ControlExecutionCoupling = (typeof CONTROL_EXECUTION_COUPLINGS)[keyof typeof CONTROL_EXECUTION_COUPLINGS];
/** Every execution coupling value, for membership checks. */
export declare const CONTROL_EXECUTION_COUPLING_VALUES: readonly string[];
/** Type guard: is `value` a {@link ControlExecutionCoupling}? */
export declare function isControlExecutionCoupling(value: unknown): value is ControlExecutionCoupling;
/**
 * One control operation scope (the exact, lossless-JSON identity an allow
 * authorizes — see the module docs for the scope model).
 */
export interface ControlOperationScope {
    /** The TeamSession (root session id, invariant 9) the operation belongs to. */
    readonly rootSessionId: string;
    /**
     * The CANONICAL subject of the scope (pre-alpha3 PR-D, D.2). OPTIONAL
     * in the input surface for legacy compatibility: ABSENT = the legacy
     * `targetInstanceId`-only path (the scope normalizes to the instance
     * subject `subject.instanceId === targetInstanceId` — byte-identical
     * scope key); PRESENT = the canonical identity (the service validates
     * the closed kind + the non-empty kind-selected id).
     */
    readonly subject?: ControlSubject;
    /**
     * The instance the operation is addressed to (invariant 18/19) — the
     * LEGACY read-compatibility projection of an INSTANCE subject (kept
     * additive, not removed, pre-alpha3 PR-D D.2). PRESENT for instance
     * subjects (equal to `subject.instanceId` when a subject is given);
     * ABSENT for template/team subjects (they have no target instance).
     */
    readonly targetInstanceId?: string;
    /** The logical operation name being requested. */
    readonly actionName: string;
    /** Present when the operation is a DSH tool-pipeline operation. */
    readonly toolName?: string;
    /** The explicit capability domain (closed set); see the module docs. */
    readonly capabilityDomain?: CapabilityName;
    /** The stable logical-operation token (request correlation). */
    readonly correlation: string;
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
    readonly operationFingerprint?: string;
}
/**
 * The durable request reference of one caller (lossless JSON; mirrors the
 * facade's `callerRef` fact shape).
 */
export type ControlCallerRef = {
    readonly kind: 'human';
    readonly humanId: string;
} | {
    readonly kind: 'instance';
    readonly instanceId: string;
    readonly role: 'leader' | 'member';
};
/**
 * The durable ControlRequest row (Architecture 25.2 minimum: requestId,
 * rootSessionId, requesterInstanceId, kind, target authority, requested
 * operation summary/payload reference, createdAt, status, correlation —
 * realized here as the ledger fact `control-request-recorded` payload).
 */
export interface ControlRequestRecord {
    /** The durable request id (derived deterministically from the scope
     *  identity; stable across retries of the same logical request). */
    readonly requestId: string;
    /** The TeamSession (root session id) the request belongs to. */
    readonly rootSessionId: string;
    /** The closed request kind. */
    readonly kind: ControlRequestKind;
    /** The requesting principal (the member, or the leader where the
     *  leader requests on its own/another instance's behalf). */
    readonly requester: ControlCallerRef;
    /** The CANONICAL subject of the request (pre-alpha3 PR-D, D.2). ALWAYS
     *  present on records produced by the service: a durable row carrying
     *  an explicit `subject` uses it; a LEGACY row (targetInstanceId only,
     *  no explicit subject) parses to the instance subject
     *  `{ kind: 'instance', instanceId: targetInstanceId }` (byte-identical
     *  semantics — old durable rows keep working unchanged, no migration). */
    readonly subject: ControlSubject;
    /** The instance the requested operation is addressed to — the LEGACY
     *  read-compatibility projection of an INSTANCE subject (pre-alpha3
     *  PR-D D.2; kept additive, not removed). PRESENT for instance
     *  subjects (equal to `subject.instanceId`); ABSENT for template/team
     *  subjects (they have no target instance). */
    readonly targetInstanceId?: string;
    /** The logical operation name. */
    readonly actionName: string;
    /** Present when the operation is a tool-pipeline operation. */
    readonly toolName?: string;
    /** The explicit capability domain (closed set). */
    readonly capabilityDomain?: CapabilityName;
    /** The stable logical-operation token (the request correlation). */
    readonly correlation: string;
    /** Present only when the request carried an operation fingerprint
     *  (alpha.2 exact-scope extension; mirrors the durable payload field —
     *  legacy rows never carry it, so it stays ABSENT, never an empty
     *  string). */
    readonly operationFingerprint?: string;
    /** The requested operation summary (free text; NOT authority data). */
    readonly summary?: string;
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
    readonly reviewPayload?: RemoteSafeJsonValue;
    /**
     * The STABLE DIGEST string of the review payload (pre-alpha3 PR-D,
     * D.3): a present digest REQUIRES a present `reviewPayload` (a digest
     * of a value the row does not carry is malformed input — fail closed);
     * a present payload without a digest is fine (the digest is optional
     * metadata of the payload). ABSENT = legacy semantics.
     */
    readonly reviewPayloadDigest?: string;
    /**
     * The execution coupling (pre-alpha3 PR-D, D.3/D.4): closed
     * `guarded | inline` (see {@link CONTROL_EXECUTION_COUPLINGS}).
     * ABSENT = legacy semantics — the legacy instance-only flow is the
     * GUARDED flow (byte-identical for old rows).
     */
    readonly executionCoupling?: ControlExecutionCoupling;
    /** The request's durable state, DERIVED at read time from the durable
     *  facts: `pending` while no decision fact and no abandon fact exists
     *  for the requestId, `decided` once a decision fact does (and no
     *  abandon fact), `abandoned` once the additive close fact
     *  `control-request-abandoned` does (the abandon fact is the TERMINAL
     *  mark — it wins over a concurrent decision; the row itself is never
     *  rewritten — append-only ledger). */
    readonly status: 'pending' | 'decided' | 'abandoned';
    /** Fact creation time, ISO-8601 (the deterministic clock). */
    readonly createdAt: string;
    /** The ledger sequence of the request row (durable identity). */
    readonly requestSequence: number;
}
/**
 * The durable ControlDecision row (Architecture 25.3: durable,
 * instance-addressed, recoverable after reconnect/cold projection; the
 * decision itself is NOT tool execution). Realized as the ledger fact
 * `control-decision-recorded` payload.
 */
export interface ControlDecisionRecord {
    /** The request this decision closes. */
    readonly requestId: string;
    /** The closed decision value (allow / deny / stale-denied). */
    readonly decision: ControlDecisionValue;
    /** The deciding principal. */
    readonly decider: ControlCallerRef;
    /** Present only for the documented special outcomes (external-policy). */
    readonly reason?: ControlDecisionReason;
    /** The decider's free-form note (evidence text; NOT authority data;
     *  distinct from the closed `reason` vocabulary). */
    readonly note?: string;
    /** The exact scope snapshot the decision authorizes (allow) or refuses
     *  (deny/stale-denied) — frozen at decision time. */
    readonly scope: ControlOperationScope;
    /** The ledger sequence of the request row this decision closes. */
    readonly requestSequence: number;
    /** The ledger sequence of this decision row (durable identity). */
    readonly decisionSequence: number;
    /** Fact creation time, ISO-8601 (the deterministic clock). */
    readonly createdAt: string;
}
/**
 * The durable consumption record of an allow (realized as the ledger fact
 * `control-allow-consumed` payload): an allow authorizes its exact scope
 * EXACTLY ONCE.
 */
export interface ControlConsumptionRecord {
    /** The request whose allow was consumed. */
    readonly requestId: string;
    /** The decision sequence that authorized the operation. */
    readonly decisionSequence: number;
    /** The exact scope that was consumed. */
    readonly scope: ControlOperationScope;
    /** Consumption time, ISO-8601 (the deterministic clock). */
    readonly consumedAt: string;
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
    readonly requestId: string;
    /** The TeamSession (root session id) the request belongs to. */
    readonly rootSessionId: string;
    /** Abandonment time, ISO-8601 (the deterministic clock). */
    readonly abandonedAt: string;
    /** The optional free-form abandon reason (evidence text; NOT authority
     *  data). ABSENT = no reason carried. */
    readonly reason?: string;
    /** The ledger sequence of this abandon row (durable identity). */
    readonly abandonmentSequence: number;
}
/**
 * The closed guard block reasons (the last-mile guard NEVER throws for a
 * policy outcome — it returns a verdict; it throws only for malformed
 * input or an ambiguous durable state).
 */
export declare const CONTROL_GUARD_BLOCK_REASONS: {
    /** No durable control request exists for the scope (no-request). */
    readonly NO_REQUEST: "no-request";
    /** The request exists but carries no decision yet. */
    readonly REQUEST_PENDING: "request-pending";
    /** The durable decision is `deny`. */
    readonly DECISION_DENY: "decision-deny";
    /** The durable decision is `stale-denied` (the request is closed). */
    readonly REQUEST_STALE: "request-stale";
    /** The request is durably ABANDONED (the additive close fact
     *  `control-request-abandoned` exists — pre-alpha3 PR-D, D.4). The
     *  abandon fact is the TERMINAL mark (like `stale-denied`): even a
     *  durable `allow` recorded BEFORE the abandon cannot execute — the
     *  guard sees the abandon and blocks (zero effect; the inline allow
     *  was never consumed by a guard, so there is no consumption to
     *  honor). */
    readonly REQUEST_ABANDONED: "request-abandoned";
    /** The durable allow exists but was already consumed (exactly-once). */
    readonly ALLOW_CONSUMED: "allow-consumed";
    /** A durable decision exists for the correlation but a scope field
     *  (toolName / capabilityDomain) differs — fail closed, never guess. */
    readonly SCOPE_MISMATCH: "scope-mismatch";
    /** The target instance is missing, terminal (DISPOSED) or suspended
     *  (ARCHIVED — admission is closed, invariant 52), or the team session
     *  record is gone (the operation cannot execute on it). */
    readonly TARGET_STALE: "target-stale";
    /** The live external hard policy recheck (A2C-4 last-mile, plan §6.3)
     *  refused the operation AFTER the durable allow was found: the host
     *  policy tightened between the decision and the final guard. The
     *  consumption fact is NOT written (the one-shot allow is not burned —
     *  "prefer zero allow consumption", invariant 34). */
    readonly EXTERNAL_POLICY: "external-policy";
};
/** One of the closed guard block reasons. */
export type ControlGuardBlockReason = (typeof CONTROL_GUARD_BLOCK_REASONS)[keyof typeof CONTROL_GUARD_BLOCK_REASONS];
/** Every guard block reason value, for membership checks. */
export declare const CONTROL_GUARD_BLOCK_REASON_VALUES: readonly string[];
/**
 * The verdict of the last-mile tool guard (lossless JSON; the P6-T6 tool
 * layer consults it BEFORE executing the operation through the DSH tool
 * pipeline and executes ONLY on `allowed: true`).
 */
export type ControlGuardVerdict = {
    readonly allowed: true;
    readonly requestId: string;
    readonly decisionSequence: number;
} | {
    readonly allowed: false;
    readonly reason: ControlGuardBlockReason;
    readonly requestId?: string;
    readonly decisionSequence?: number;
};
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
export type ControlExternalVerdict = {
    readonly allowed: true;
} | {
    readonly allowed: false;
    /** The fail-closed diagnostic (free text; NOT authority data). */
    readonly reason: string;
};
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
    readonly aborted: boolean;
    /** Register the waiter's one-shot abort listener. */
    addEventListener(type: 'abort', listener: () => void, options?: {
        readonly once?: boolean;
    }): void;
    /** Remove the waiter's abort listener (the settle cleanup). */
    removeEventListener(type: 'abort', listener: () => void): void;
}
/**
 * The control service ports (injected, mock-first — the same port family
 * as the P6-T2 facade's `TeamRuntimeOptions`, minus the creation/lifecycle
 * ports the control plane never touches: the service admits no new work
 * and creates no members, so no ActivationProvider is in scope).
 */
export interface ControlServiceOptions {
    /** The open TeamDomain (the durable control-plane authority, inv 41). */
    readonly teamDomain: import('../../storage/repositories/index.js').TeamDomain;
    /** The immutable blueprint catalog (resolves the bound snapshot —
     *  needed by the facade's reused resolution steps). */
    readonly blueprintCatalog: import('../../domain/blueprint/src/index.js').BlueprintCatalog;
    /** The external hard facts port (live probe at decision time —
     *  invariant 34 / Architecture 25.4). */
    readonly externalPolicyFacts: () => Promise<import('../../domain/policy/src/index.js').ExternalPolicyFacts>;
    /** The deterministic clock (ISO-8601) for durable row timestamps. */
    readonly now: () => string;
    /**
     * The wait-bridge poll interval in milliseconds (alpha.2 §9.4,
     * `awaitControlDecision`). The alpha.2 implementation polls the durable
     * control state at this cadence (documented choice: DEFAULT = 250 ms —
     * the low end of the plan's 250–500 ms band; liveness only, no
     * authority). Injectable in tests (e.g. 5 ms); a non-finite or
     * non-positive value falls back to the default. ABSENT = the default.
     */
    readonly waitPollIntervalMs?: number;
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
    readonly requestNotification?: ControlRequestNotificationPort;
    /**
     * C1 — the OPTIONAL diagnostic sink for a FAILED liveness notification
     * (observability only — the sink must not alter the durable outcome).
     * ABSENT = the failure is dropped silently (still non-fatal).
     */
    readonly onNotificationFailure?: (args: {
        readonly requestId: string;
        readonly kind: ControlRequestKind;
        readonly error: unknown;
    }) => void;
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
    notifyLeaderRequest(request: ControlRequestRecord): Promise<void>;
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
        readonly rootSessionId: string;
        readonly caller: ActionCaller;
        readonly kind: ControlRequestKind;
        /** The CANONICAL subject (pre-alpha3 PR-D, D.2). ABSENT = the legacy
         *  `targetInstanceId`-only instance path (required in that case). */
        readonly subject?: ControlSubject;
        /** The legacy instance addressing (kept additive). REQUIRED when no
         *  `subject` is given; for an explicit instance subject it must be
         *  ABSENT or agree with `subject.instanceId`; ABSENT (not merely
         *  empty) for template/team subjects. */
        readonly targetInstanceId?: string;
        readonly actionName: string;
        readonly toolName?: string;
        readonly capabilityDomain?: CapabilityName;
        readonly correlation: string;
        readonly operationFingerprint?: string;
        readonly summary?: string;
        /** The lossless-JSON review payload (pre-alpha3 PR-D, D.3). ABSENT =
         *  legacy semantics (the field stays OMITTED on the durable row). */
        readonly reviewPayload?: RemoteSafeJsonValue;
        /** The stable digest string of the review payload (requires a
         *  present `reviewPayload`). ABSENT = legacy semantics. */
        readonly reviewPayloadDigest?: string;
        /** The execution coupling (closed `guarded | inline`; ABSENT = the
         *  legacy guarded flow). */
        readonly executionCoupling?: ControlExecutionCoupling;
    }): Promise<ControlRequestRecord>;
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
        readonly rootSessionId: string;
        readonly caller: ActionCaller;
        readonly requestId: string;
        readonly decision: 'allow' | 'deny';
        readonly note?: string;
    }): Promise<ControlDecisionRecord>;
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
        readonly rootSessionId: string;
        readonly caller: ActionCaller;
        readonly requestId: string;
        readonly reason?: string;
    }): Promise<ControlAbandonmentRecord>;
    /**
     * Read the team's durable control state (fresh ledger read; the
     * in-process holds NO cached authority — invariant 45).
     * @param rootSessionId - the team (root) session id.
     */
    listControlState(rootSessionId: string): Promise<{
        readonly requests: readonly ControlRequestRecord[];
        readonly decisions: readonly ControlDecisionRecord[];
        readonly consumptions: readonly ControlConsumptionRecord[];
        /** The durable abandonments (pre-alpha3 PR-D, D.4; the additive
         *  `control-request-abandoned` facts). */
        readonly abandonments: readonly ControlAbandonmentRecord[];
    }>;
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
    guardOperation(scope: ControlOperationScope): Promise<ControlGuardVerdict>;
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
        readonly capabilityDomain?: CapabilityName;
        readonly toolName?: string;
    }): Promise<ControlExternalVerdict>;
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
        readonly rootSessionId: string;
        readonly requestId: string;
        readonly signal?: ControlWaitSignal;
    }): Promise<ControlDecisionRecord>;
}
//# sourceMappingURL=types.d.ts.map