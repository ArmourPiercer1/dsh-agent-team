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

import type { CapabilityName } from '../../domain/policy/src/index.js'
import type { ActionCaller } from '../admission/index.js'

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
} as const

/** One of the closed durable-decision reasons. */
export type ControlDecisionReason = (typeof CONTROL_DECISION_REASONS)[keyof typeof CONTROL_DECISION_REASONS]

/** Every durable-decision reason value, for membership checks. */
export const CONTROL_DECISION_REASON_VALUES: readonly string[] = Object.values(CONTROL_DECISION_REASONS)

// --- scope ----------------------------------------------------------------------------

/**
 * One control operation scope (the exact, lossless-JSON identity an allow
 * authorizes — see the module docs for the scope model).
 */
export interface ControlOperationScope {
  /** The TeamSession (root session id, invariant 9) the operation belongs to. */
  readonly rootSessionId: string
  /** The instance the operation is addressed to (invariant 18/19). */
  readonly targetInstanceId: string
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
  /** The instance the requested operation is addressed to. */
  readonly targetInstanceId: string
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
  /** The request's durable state, DERIVED at read time from the decision
   *  facts: `pending` while no decision fact exists for the requestId,
   *  `decided` once a decision fact does (the row itself is never
   *  rewritten — append-only ledger). */
  readonly status: 'pending' | 'decided'
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
  /** The live external hard policy recheck (A2C-4 last-mile, plan §6.3)
   *  refused the operation AFTER the durable allow was found: the host
   *  policy tightened between the decision and the final guard. The
   *  consumption fact is NOT written (the one-shot allow is not burned —
   *  "prefer zero allow consumption", invariant 34). */
  EXTERNAL_POLICY: 'external-policy',
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
}

/**
 * The durable control plane service (P6-T4 acceptance object):
 * requestControl / resolveControl / listControlState / guardOperation /
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
   * @param args - the requesting principal, the kind, and the operation scope.
   * @throws the facade's TeamRuntimeError codes (resolution phase, zero
   *   side effects) or CONTROL_REQUEST_MALFORMED / CONTROL_TARGET_STALE.
   */
  requestControl(args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly kind: ControlRequestKind
    readonly targetInstanceId: string
    readonly actionName: string
    readonly toolName?: string
    readonly capabilityDomain?: CapabilityName
    readonly correlation: string
    readonly operationFingerprint?: string
    readonly summary?: string
  }): Promise<ControlRequestRecord>
  /**
   * Durably record one control decision closing a pending request. The
   * decision is durable BEFORE any effect; effects (the authorization
   * itself) apply only via the last-mile guard after this returns.
   * @param args - the deciding principal, the requestId and the decision.
   * @throws the facade's TeamRuntimeError codes (resolution phase),
   *   CONTROL_REQUEST_NOT_FOUND / CONTROL_REQUEST_DECIDED /
   *   CONTROL_RESOLVER_NOT_AUTHORIZED / CONTROL_REQUEST_MALFORMED, or —
   *   after recording the durable decision row —
   *   CONTROL_REQUEST_STALE / CONTROL_EXTERNAL_POLICY_DENIED.
   */
  resolveControl(args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly requestId: string
    readonly decision: 'allow' | 'deny'
    readonly note?: string
  }): Promise<ControlDecisionRecord>
  /**
   * Read the team's durable control state (fresh ledger read; the
   * in-process holds NO cached authority — invariant 45).
   * @param rootSessionId - the team (root) session id.
   */
  listControlState(rootSessionId: string): Promise<{
    readonly requests: readonly ControlRequestRecord[]
    readonly decisions: readonly ControlDecisionRecord[]
    readonly consumptions: readonly ControlConsumptionRecord[]
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
}
