/**
 * P6-T4 — the durable control plane service: ControlRequest /
 * ControlDecision in the TeamDomain + the tool-pipeline last-mile guard.
 *
 * ```
 * ControlRequest durable in TeamDomain
 * ControlDecision durable in TeamDomain
 * actual tool operation still goes through DSH tool pipeline
 * ```
 * (Development Plan 19.4 — the control module NEVER executes tool
 * operations; it only durably authorizes and refuses them.)
 *
 * Composition over the P6-T2 facade (integration, not a second authority
 * path):
 * - team + target resolution reuses `resolveTeamAndTarget` (instanceId-
 *   first, invariant 19; the facade's typed TeamRuntimeError codes);
 * - caller identity/role reuses `resolveCaller` (DISPOSED/ARCHIVED
 *   callers are stale — a stale caller cannot request or decide);
 * - envelope bounds reuse `callerEnvelope` + `enforceEnvelope` over the
 *   closed `request-control` / `resolve-control` mutation ops;
 * - per-team serialization reuses `withTeamLock` (the P6-T1/P6-T2 lock
 *   pattern);
 * - durable writes go ONLY through the injected TeamDomain repositories
 *   (invariant 41: TeamDomain is the Team control-plane durable authority).
 *
 * Durable fact rows (append-only ledger facts; kebab vocabulary — the
 * p4t6 scanner's legacy denylist is slash-prefixed Team SessionEvent
 * names, so these are structurally disjoint):
 * - `control-request-recorded`  — one ControlRequest row;
 * - `control-decision-recorded` — one ControlDecision row per request
 *   (at most one; the first decision is authoritative);
 * - `control-allow-consumed`    — the exactly-once consumption of an
 *   allow by the last-mile guard;
 * - `control-request-abandoned` — the ADDITIVE close fact of the inline
 *   coupling (pre-alpha3 PR-D, D.4): durably closes an inline request on
 *   abort (payload: requestId, rootSessionId, abandonedAt, reason?). The
 *   append-only ledger has no delete primitive — the request row is
 *   never physically removed; the abandon fact is the TERMINAL mark
 *   (like `stale-denied`): the request can never become an allow, and
 *   the last-mile guard blocks over it even with a durable allow
 *   recorded before the abandon.
 *
 * Scope model (types.ts): an allow authorizes EXACTLY
 * `(rootSessionId, subject, actionName, toolName?, capabilityDomain?,
 * correlation, operationFingerprint?)` and — in the GUARDED coupling —
 * is CONSUMED EXACTLY ONCE. The CANONICAL subject (pre-alpha3 PR-D,
 * D.2) is the closed three-kind `instance | template | team`: the scope
 * key's second element is the SUBJECT id (instance → instanceId,
 * template → templateId, team → rootSessionId). `targetInstanceId` is
 * KEPT (additive) as the legacy read-compatibility projection of an
 * INSTANCE subject: a durable row / scope carrying `targetInstanceId`
 * but NO explicit `subject` parses to
 * `{ kind: 'instance', instanceId: targetInstanceId }`, so a legacy
 * instance row recomputes the EXACT same scope key it always had
 * (byte-identical semantics, no migration). The operation fingerprint is
 * OPTIONAL (legacy rows never carry it); when present it binds the
 * approval to the exact resource + payload impact identity and
 * participates in the scope identity and the request idempotency key —
 * it is NOT a correlation substitute (a new correlation under the same
 * fingerprint is a new request; the same correlation under a different
 * fingerprint is a different request and must never reuse the other's
 * request/approval).
 *
 * Request idempotency: the scope key `(root, subjectId, actionName,
 * toolName|absent, correlation, operationFingerprint|absent)` identifies
 * the logical request; a retried request returns the EXISTING row
 * (regardless of requester); a NEW attempt after an allow was consumed
 * (or after a deny) must carry a NEW correlation and creates a NEW
 * request (no reuse).
 *
 * The two execution couplings (pre-alpha3 PR-D, D.3/D.4): `guarded`
 * (ABSENT on the row = legacy, the existing flow: request → wait →
 * decision → guard → consume → execute — UNCHANGED) and `inline`
 * (request → wait → decision; on `allow` the current frozen invocation
 * continues — NO `control-allow-consumed` fact is written, the allow is
 * not consumed by a guard; on `deny` zero effect; on `abort`
 * `abandonControlRequest` durably records the abandon fact — the
 * request state is DERIVED: `pending | decided | abandoned`, the
 * abandon fact wins as the terminal mark).
 *
 * Stale semantics (fail closed; the append-only ledger has no "mark"
 * primitive, so the decision row IS the mark). These apply to INSTANCE
 * subjects ONLY (pre-alpha3 PR-D, D.2: the instance stale validator
 * branches on the subject kind — a template or team subject has no
 * instance lifecycle, so it can NEVER be killed by the instance stale
 * check):
 * - request time: a DISPOSED target → CONTROL_TARGET_STALE (zero rows; a
 *   missing target is the facade's INSTANCE_NOT_FOUND); an ARCHIVED
 *   target is tolerated (it can be restored);
 * - resolve time: a target that is missing or DISPOSED when the decision
 *   is recorded → a durable `stale-denied` decision row FIRST, then
 *   CONTROL_REQUEST_STALE (the request is closed and can never become an
 *   allow);
 * - guard time: a target that is missing, ARCHIVED or DISPOSED → block
 *   verdict `target-stale` (an allow only authorizes execution on a
 *   live, work-accepting target).
 *
 * External hard policy (Architecture 25.4 / invariant 34): an `allow`
 * decision probes the LIVE external facts before the decision row is
 * written; a hard deny, an allow-list that excludes the named item, or an
 * explicit `capabilityExists:false` → a durable `deny` decision with
 * `reason: 'external-policy'` FIRST, then
 * CONTROL_EXTERNAL_POLICY_DENIED — even a human/leader allow fails
 * closed. A `deny` decision needs no probe (refusing is always
 * externally lawful). When BOTH a stale target and an external deny
 * apply, the stale check runs first (the request is closed as
 * stale-denied — the external probe is moot for an operation that can
 * never execute).
 *
 * A2C-4 last-mile recheck (alpha.2 plan §6.3): the SAME hard-cell
 * semantics are re-probed LIVE at the FINAL dispatch points, through one
 * SHARED READ-ONLY evaluator (`checkExternalOperation` — built over the
 * same `externalPolicyFacts` port and `hardCellAllows`; there is no
 * second hard-policy implementation): (a) the pre-execute adapter's
 * static-allow path consults it BEFORE marking the exec authorized (the
 * static path carries no control request — this is its only external
 * gate); (b) `guardOperation` consults it AFTER the exact-scope match and
 * BEFORE the consumption write — a cell that tightened after the decision
 * blocks with verdict reason `external-policy` and does NOT write the
 * consumption fact (the one-shot allow is not burned: "prefer zero allow
 * consumption"). Both probes fail closed (a thrown/malformed facts probe
 * is a deny) and are read-only (no durable row either way).
 *
 * Resolver authority (invariant 37 / Architecture 25.1): the closed
 * resolver role set per kind (CONTROL_RESOLVER_ROLES) is checked BEFORE
 * the envelope — a MEMBER is never a resolver for any kind, even when
 * its template envelope allows the `resolve-control` op (no
 * self-approval); `user-approval` may only be resolved by the human (the
 * leader cannot stand in for the user); a leader resolver still needs
 * the `resolve-control` op in its effective envelope.
 *
 * The last-mile guard (`guardOperation`): the exported public seam the
 * P6-T6 tool layer consults BEFORE the DSH tool pipeline executes the
 * operation (the characterized `pre-execute` / TOOL_GUARD seam,
 * Development Plan 15 — no upstream PRIVATE seam is required, so there
 * is no CORE_SEAM_BLOCKER). It verifies (a) the team still exists, (b)
 * the target is durably live (CREATED/RUNNING/SETTLED), (c) a durable
 * allow decision exists for the EXACT scope and is unconsumed — then
 * atomically (under the per-team lock) appends the consumption fact and
 * returns `allowed:true`. Policy outcomes are VERDICTS, never throws;
 * throws are reserved for malformed guard input (CONTROL_GUARD_MALFORMED)
 * and an ambiguous durable state (CONTROL_GUARD_AMBIGUOUS: two distinct
 * unconsumed allows for one scope — the guard refuses to guess).
 *
 * The synchronous wait bridge (`awaitControlDecision`, alpha.2 §9.4):
 * resolves when a durable ControlDecision for the requestId appears. The
 * authority is ALWAYS the durable control rows — the waiter only solves
 * LIVENESS: it adds no authority, writes no rows, and is never consulted
 * by the guard or the resolvers. Minimal alpha.2 implementation: poll the
 * durable control state at the injected `waitPollIntervalMs` cadence
 * (documented choice: DEFAULT 250 ms — the low end of the plan's
 * 250–500 ms band; the waiter is liveness-only and the durable read is a
 * cheap in-process ledger scan, so the low end minimizes decision
 * latency at negligible cost). Settles on: the decision appears
 * (resolve with the durable record), the caller's AbortSignal aborts
 * (typed CONTROL_WAIT_ABORTED), or the durable control plane closes —
 * the storage layer's typed `NOT_OPEN` rejection on the waiter's durable
 * read maps to typed CONTROL_WAIT_CLOSED. Timers and listeners are
 * cleared on settle (no leak after the promise settles). No durable
 * waiter scheduler, no cross-process continuation.
 *
 * Invariant 45: the in-process holds NO cached authority state — every
 * operation re-reads the durable repositories fresh (the service-owned
 * `teamLocks` map is a concurrency chain, not authority).
 *
 * @module @dsh-agent-team/runtime/control/service
 */

import {
  LEADER_INSTANCE_ID,
  isRemoteSafeJsonValue,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type {
  MemberInstanceRecordDto,
  RemoteSafeJsonValue,
} from '../../contracts/src/index.js'
import {
  CAPABILITY_NAME_VALUES,
} from '../../domain/policy/src/index.js'
import type {
  CapabilityName,
  ExternalPolicyFacts,
  PolicyEntry,
} from '../../domain/policy/src/index.js'
import {
  CALLER_ROLES,
  TEAM_RUNTIME_ERROR_CODES,
  TeamRuntimeError,
  ACTION_NAMES,
  actionSpecOf,
  callerEnvelope,
  enforceEnvelope,
  resolveCaller,
  resolveTeamAndTarget,
} from '../admission/index.js'
import type {
  ActionCaller,
  ActionSpec,
  ResolvedCaller,
} from '../admission/index.js'
import { withTeamLock } from '../action-router/index.js'
// The ladder vocabulary is the governance lane's (`RuntimeAuthority` is capped
// at four consumer files by `a3p3-governance-lane-hygiene.test.ts`, which leaves
// control and intervention no other legal home for a rung name), and the import
// is TYPE-ONLY: the Control plane consumes rung NAMES, never a ceiling value.
import type { ProposalAuthorityPosition } from '../governance/proposal-store.js'
import type { LedgerEntry } from '../../storage/schema/index.js'
import {
  TEAM_DOMAIN_ERROR_CODES,
  isTeamDomainError,
} from '../../storage/schema/index.js'
import { deterministicToken } from '../../storage/provisioning/index.js'
import {
  CONTROL_ERROR_CODES,
  ControlError,
} from './errors.js'
import type { ControlErrorCode } from './errors.js'
import {
  PERMISSION_OVERLAY_EFFECT_VALUES,
} from '../../storage/schema/permission-overlay.js'
import type { PermissionOverlayEffect } from '../../storage/schema/permission-overlay.js'
import {
  APPROVAL_CASE_IDENTITY_PROBLEMS,
  APPROVAL_CASE_READ_PROBLEMS,
  CONTROL_AUTHORITY_MATCHER_KINDS,
  CONTROL_AUTHORITY_RECHECK_KINDS,
  CONTROL_CASE_OUTCOMES,
  CONTROL_CASE_TERMINAL_OUTCOMES,
  CONTROL_DECISION_REASON_VALUES,
  CONTROL_DECISION_REASONS,
  CONTROL_DECISION_VALUES,
  CONTROL_DECISION_VALUE_VALUES,
  CONTROL_EXECUTION_COUPLINGS,
  CONTROL_EXECUTION_COUPLING_VALUES,
  CONTROL_LEG_TERMINAL_REASONS,
  CONTROL_LEG_TERMINAL_REASON_VALUES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
  CONTROL_REQUEST_KIND_VALUES,
  CONTROL_RESOLVER_ROLES,
  CONTROL_SUBJECT_KINDS,
  controlEscalationSuccessor,
  hasAuthorityResolver,
  isControlAuthorityScope,
  isProposalAuthorityPosition,
} from './types.js'
import type {
  ApprovalCaseIdentity,
  ApprovalCaseIdentityInput,
  ApprovalCaseIdentityLookup,
  ApprovalCaseIdentityProblem,
  ApprovalCaseReadOutcome,
  ApprovalCaseReadProblem,
  ApprovalCaseState,
  ApprovalCaseSummary,
  ControlAbandonmentRecord,
  ControlAuthorityRecheck,
  ControlAuthorityScope,
  ControlCaseClosure,
  ControlCallerRef,
  ControlConsumptionRecord,
  ControlDecisionRecord,
  ControlDecisionReason,
  ControlEscalationOutcome,
  ControlEscalationRecord,
  ControlLegTerminalReason,
  ControlDecisionValue,
  ControlExternalVerdict,
  ControlExecutionCoupling,
  ControlGuardBlockReason,
  ControlGuardVerdict,
  ControlOperationScope,
  ControlRequestKind,
  ControlRequestLegOutcome,
  ControlRequestRecord,
  ControlService,
  ControlServiceOptions,
  ControlSubject,
  ControlWaitSignal,
} from './types.js'

// --- closed fact vocabulary (kebab; p4t6-scanner safe by construction) -------------

/** The durable ControlRequest fact family. */
const FACT_REQUEST = 'control-request-recorded'
/** The durable ControlDecision fact family. */
const FACT_DECISION = 'control-decision-recorded'
/** The durable allow-consumption fact family (the exactly-once evidence). */
const FACT_CONSUMPTION = 'control-allow-consumed'
/** The durable abandon fact family (pre-alpha3 PR-D, D.4 — the additive
 *  close of an inline-coupling request on abort; the terminal mark). */
const FACT_ABANDONMENT = 'control-request-abandoned'
/** The Alpha.4 approval-case leg fact (ADR A3-12(ii): a LEG fact, not a
 *  decision — `escalate` never enters the decision vocabulary, and the row
 *  says who moved WHICH leg of WHICH case where). */
const FACT_ESCALATION = 'control-escalation-recorded'

/** The reused closed specs of the facade action registry (module
 *  invariant: the closed registry always carries both). */
function closedActionSpecOf(name: string): ActionSpec {
  const spec = actionSpecOf(name)
  if (spec === undefined) {
    // A closed-registry regression (a programming error, never caller-reachable).
    throw new Error(`control: the closed action registry is missing ${name}`)
  }
  return spec
}
const REQUEST_CONTROL_SPEC: ActionSpec = closedActionSpecOf(ACTION_NAMES.REQUEST_CONTROL)
const RESOLVE_CONTROL_SPEC: ActionSpec = closedActionSpecOf(ACTION_NAMES.RESOLVE_CONTROL)

/** The lifecycle states in which a target may EXECUTE a guarded operation
 *  (the work-accepting set; a SETTLED target is quiescent, not gone). */
const GUARD_LIVE_LIFECYCLES: readonly string[] = ['CREATED', 'RUNNING', 'SETTLED']

/** The terminal lifecycle (invariant 56: DISPOSED is terminal). */
const TERMINAL_LIFECYCLE = 'DISPOSED'

/** The wait-bridge default poll cadence (alpha.2 §9.4, documented choice:
 *  250 ms — the low end of the plan's 250–500 ms band; the waiter is
 *  liveness-only and the durable read is a cheap in-process ledger scan,
 *  so the low end minimizes decision latency at negligible cost). */
const DEFAULT_WAIT_POLL_INTERVAL_MS = 250

/** The closed abandonment reason the wait-bridge's inline-abort cascade
 *  records when an INLINE-coupling request's frozen invocation aborts
 *  (pre-alpha3 PR-D, D.4 — the inline lifecycle's `abort` node:
 *  `abort → durable abandon/close → zero effect`). */
const WAIT_ABORT_ABANDON_REASON = 'wait-aborted'

/** The minimal platform-timer surface the wait bridge schedules on
 *  (alpha.2 §9.4). The codebase builds against `lib: ES2022` WITHOUT
 *  ambient DOM/Node globals (tsconfig.base.json), so the platform timer
 *  functions are reached through one narrow structural cast of
 *  `globalThis` — the module otherwise stays node-free. */
const platformTimers = globalThis as unknown as {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

// --- durable payload shapes (lossless JSON) ------------------------------------------

/** The `control-request-recorded` payload. */
interface RequestPayload {
  readonly requestId: string
  readonly kind: ControlRequestKind
  readonly requester: ControlCallerRef
  /** The CANONICAL subject (pre-alpha3 PR-D, D.2): the parser ALWAYS
   *  produces one — an explicit durable `subject` is used as-is; a
   *  legacy row (targetInstanceId only, no explicit subject) parses to
   *  the instance subject (byte-identical semantics). */
  readonly subject: ControlSubject
  /** The legacy read-compatibility projection of an INSTANCE subject
   *  (present for instance rows — explicit or legacy; ABSENT for
   *  template/team subjects). */
  readonly targetInstanceId?: string
  readonly actionName: string
  readonly toolName?: string
  readonly capabilityDomain?: CapabilityName
  readonly correlation: string
  /** Present only when the request carried an operation fingerprint
   *  (alpha.2 exact-scope extension; legacy rows never carry it). */
  readonly operationFingerprint?: string
  readonly summary?: string
  /** The lossless-JSON review payload (pre-alpha3 PR-D, D.3; legacy
   *  rows never carry it — ABSENT = legacy semantics). */
  readonly reviewPayload?: RemoteSafeJsonValue
  /** The stable digest of the review payload (D.3; requires the
   *  payload to be present). */
  readonly reviewPayloadDigest?: string
  /** The execution coupling (D.3/D.4; legacy rows never carry it —
   *  ABSENT = the legacy guarded flow). */
  readonly executionCoupling?: ControlExecutionCoupling
  /** --- Alpha.4 approval-case leg fields (A4-PR3) -------------------------
   *  Every one is ABSENT on a pre-Alpha.4 row, which is what keeps the legacy
   *  path byte-identical. In a row that carries `approvalCaseId` the strict
   *  rule of ADR A2-9 applies: a missing `reviewAuthority` or `legOrdinal` is
   *  a CORRUPT leg (reported by the case read), never a default. */
  readonly approvalCaseId?: string
  readonly legOrdinal?: number
  readonly reviewAuthority?: ProposalAuthorityPosition
  readonly requiredAuthorityAtCreation?: ProposalAuthorityPosition
  readonly beneficiaryAuthority?: ProposalAuthorityPosition
  readonly requestedEffect?: PermissionOverlayEffect
  readonly previousRequestId?: string
  readonly mutationProposalFingerprint?: string
  /**
   * A4-PR7 Task 7.0 (ADR A1-14): the concrete AUTHORITY point of an operation
   * case — `{operationClass, matcher}`, the concrete point only (a
   * region-shaped matcher is not persistable here; see
   * {@link ControlAuthorityScope}). ABSENT on a pre-Alpha.4 row and on an
   * `envelope-mutation` row; required by the write path on an operation row,
   * which is what lets the consumption point re-run the ceiling for the point
   * the human actually approved.
   */
  readonly authorityScope?: ControlAuthorityScope
}

/** The `control-decision-recorded` payload. */
interface DecisionPayload {
  readonly requestId: string
  readonly decision: ControlDecisionValue
  readonly decider: ControlCallerRef
  readonly reason?: ControlDecisionReason
  readonly note?: string
  /** Alpha.4 A4-PR3 (ADR A2-8): present ONLY on a close the reviewer did not
   *  choose (a drift close, or a close because no resolver exists). It never
   *  changes the VALUE — a terminal close is a `deny` — it says why. */
  readonly terminalReason?: ControlLegTerminalReason
  readonly scope: ControlOperationScope
  readonly requestSequence: number
}

/** The `control-allow-consumed` payload. */
interface ConsumptionPayload {
  readonly requestId: string
  readonly decisionSequence: number
  readonly scope: ControlOperationScope
  readonly consumedAt: string
}

/** The `control-request-abandoned` payload (pre-alpha3 PR-D, D.4 — the
 *  additive close fact; the append-only ledger has no delete primitive). */
interface AbandonmentPayload {
  readonly requestId: string
  readonly rootSessionId: string
  readonly abandonedAt: string
  readonly reason?: string
}

/** One ledger entry plus its (validated) payload. */
/**
 * The `control-escalation-recorded` payload: the FROZEN five members of ADR
 * A3-12(ii) and nothing else. The reviewer's evidence text stays on the
 * terminal decision row, and the parent pointer is `previousRequestId`
 * (A3-12(iii)) — a leg never references a case by a caller-chosen id.
 */
interface EscalationPayload {
  readonly approvalCaseId: string
  readonly legOrdinal: number
  readonly previousRequestId: string
  readonly escalatedBy: ControlCallerRef
  readonly reason?: string
}

interface StoredFact<Payload> {
  readonly entry: LedgerEntry
  readonly payload: Payload
}

/** The settle outcome of the wait-bridge's coupling-aware inline-abort
 *  cascade (pre-alpha3 PR-D, D.4):
 *  - `none`               — the STORED coupling is not exactly `inline`
 *                            (guarded / ABSENT legacy, or no durable
 *                            request row): the caller settles EXACTLY as
 *                            today (zero side effects);
 *  - `decided`            — a durable decision won the race between the
 *                            last poll and the signal: resolve the wait
 *                            with it (the first decision is
 *                            authoritative; no second terminal mark);
 *  - `abandoned`          — this cascade durably wrote the terminal mark
 *                            (reason `wait-aborted`): reject typed;
 *  - `already-abandoned`  — a concurrent abandon landed first
 *                            (exactly-once — no second fact): reject
 *                            typed. */
type InlineAbortCascadeOutcome =
  | { readonly kind: 'none' }
  | { readonly kind: 'decided'; readonly decision: ControlDecisionRecord }
  | { readonly kind: 'abandoned'; readonly abandonmentSequence: number }
  | { readonly kind: 'already-abandoned' }

/**
 * The fresh durable state of one team's control plane (point-in-time
 * ledger read; the in-process caches nothing — invariant 45).
 */
interface ControlState {
  readonly requests: readonly StoredFact<RequestPayload>[]
  /** A leg row whose payload the strict parser refused (Alpha.4 A4-PR3).
   *  It is a row that BELONGS to a case — it carries an `approvalCaseId` —
   *  but is too damaged to reconstruct. Reported, NEVER defaulted (ADR A2-9):
   *  a corrupt leg turns the case read into a typed problem instead of a
   *  silently shorter `legs` list. */
  readonly corruptLegs: readonly StoredFact<Record<string, unknown>>[]
  readonly decisions: readonly StoredFact<DecisionPayload>[]
  readonly consumptions: readonly StoredFact<ConsumptionPayload>[]
  readonly abandonments: readonly StoredFact<AbandonmentPayload>[]
  readonly escalations: readonly StoredFact<EscalationPayload>[]
}

// --- pure helpers ---------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parse a durable caller ref (malformed rows are treated as ABSENT —
 *  fail closed: a corrupted row can never grant an allow). */
function parseCallerRef(value: unknown): ControlCallerRef | undefined {
  if (!isPlainObject(value)) return undefined
  if (value['kind'] === 'human') {
    const humanId = value['humanId']
    return typeof humanId === 'string' && humanId.length > 0
      ? { kind: 'human', humanId }
      : undefined
  }
  if (value['kind'] === 'instance') {
    const instanceId = value['instanceId']
    const role = value['role']
    return (
      typeof instanceId === 'string' &&
      instanceId.length > 0 &&
      (role === 'leader' || role === 'member')
        ? { kind: 'instance', instanceId, role }
        : undefined
    )
  }
  return undefined
}

/** Parse a durable canonical subject (pre-alpha3 PR-D, D.2; malformed
 *  rows are treated as ABSENT — fail closed). Exactly ONE id field is
 *  admitted, selected by the closed kind: a subject carrying a second
 *  id field is an AMBIGUOUS identity (malformed input, never a guess). */
function parseSubject(value: unknown): ControlSubject | undefined {
  if (!isPlainObject(value)) return undefined
  const instanceId = value['instanceId']
  const templateId = value['templateId']
  const rootSessionId = value['rootSessionId']
  if (value['kind'] === CONTROL_SUBJECT_KINDS.INSTANCE) {
    return typeof instanceId === 'string' &&
      instanceId.length > 0 &&
      templateId === undefined &&
      rootSessionId === undefined
      ? { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId }
      : undefined
  }
  if (value['kind'] === CONTROL_SUBJECT_KINDS.TEMPLATE) {
    return typeof templateId === 'string' &&
      templateId.length > 0 &&
      instanceId === undefined &&
      rootSessionId === undefined
      ? { kind: CONTROL_SUBJECT_KINDS.TEMPLATE, templateId }
      : undefined
  }
  if (value['kind'] === CONTROL_SUBJECT_KINDS.TEAM) {
    return typeof rootSessionId === 'string' &&
      rootSessionId.length > 0 &&
      instanceId === undefined &&
      templateId === undefined
      ? { kind: CONTROL_SUBJECT_KINDS.TEAM, rootSessionId }
      : undefined
  }
  return undefined
}

/** The kind-selected subject id (pre-alpha3 PR-D, D.2): instance →
 *  instanceId, template → templateId, team → rootSessionId. */
function subjectIdOf(subject: ControlSubject): string {
  switch (subject.kind) {
    case CONTROL_SUBJECT_KINDS.INSTANCE:
      return subject.instanceId
    case CONTROL_SUBJECT_KINDS.TEMPLATE:
      return subject.templateId
    case CONTROL_SUBJECT_KINDS.TEAM:
      return subject.rootSessionId
  }
}

/** The KIND-PREFIXED subject identity that participates in the scope key
 *  (pre-alpha3 PR-D review B1 / D.2): `${kind}:${subjectIdOf(subject)}`.
 *
 *  The prefix makes the three subject kinds DISJOINT in the key. Without
 *  it, a template id and an instance id that happen to be EQUAL STRINGS
 *  (both the `inst-abc` shape is a legal instance id AND a legal template
 *  slug) would alias: with otherwise identical scope fields, a template
 *  request would recompute the SAME key as an instance request and return
 *  the existing instance row instead of creating its own. Prefixing the
 *  kind means the second key element is `instance:<id>` vs
 *  `template:<id>` vs `team:<id>` — never equal across kinds.
 *
 *  Backward compatibility is preserved BEHAVIORALLY: BOTH the new-request
 *  key and the existing-row lookup recompute through this SAME function,
 *  so a legacy instance row (subject derived from `targetInstanceId`,
 *  kind `instance`) still matches an instance request — old durable rows
 *  stay idempotent. The literal key now carries the `instance:` prefix
 *  (it is no longer byte-identical to the pre-PR-D string), but no
 *  observable idempotency or guard-matching behavior changes. */
function subjectIdentityOf(subject: ControlSubject): string {
  return `${subject.kind}:${subjectIdOf(subject)}`
}

/** Do two canonical subjects name the SAME identity (closed kind AND
 *  kind-selected id)? */
function subjectsMatch(a: ControlSubject, b: ControlSubject): boolean {
  return a.kind === b.kind && subjectIdOf(a) === subjectIdOf(b)
}

/** Parse a durable operation scope. */
/** Parse a durable operation scope.
 *
 *  Subject rule (pre-alpha3 PR-D, D.2): an EXPLICIT durable `subject` is
 *  canonical (validated; when `targetInstanceId` is ALSO present the two
 *  must agree — instance kind + equal id); a scope carrying
 *  `targetInstanceId` but NO explicit `subject` parses to the instance
 *  subject `{ kind: 'instance', instanceId: targetInstanceId }` (the
 *  LEGACY identity — byte-identical semantics; the returned scope keeps
 *  `targetInstanceId` verbatim, so the durable projection is unchanged).
 */
function parseScope(value: unknown): ControlOperationScope | undefined {
  if (!isPlainObject(value)) return undefined
  const rootSessionId = value['rootSessionId']
  const targetInstanceId = value['targetInstanceId']
  const actionName = value['actionName']
  const correlation = value['correlation']
  if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) return undefined
  if (typeof actionName !== 'string' || actionName.length === 0) return undefined
  if (typeof correlation !== 'string' || correlation.length === 0) return undefined
  // The subject: explicit, or derived from targetInstanceId (legacy).
  let subject: ControlSubject | undefined
  if (value['subject'] !== undefined) {
    subject = parseSubject(value['subject'])
    if (subject === undefined) return undefined
    if (
      targetInstanceId !== undefined &&
      (subject.kind !== CONTROL_SUBJECT_KINDS.INSTANCE || subject.instanceId !== targetInstanceId)
    ) {
      // An explicit subject that disagrees with the legacy projection is
      // an ambiguous identity — fail closed (ABSENT), never a guess.
      return undefined
    }
  } else {
    if (typeof targetInstanceId !== 'string' || targetInstanceId.length === 0) {
      // No subject AND no targetInstanceId: no identity element at all.
      return undefined
    }
    subject = { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: targetInstanceId }
  }
  const toolName = value['toolName']
  if (toolName !== undefined && typeof toolName !== 'string') return undefined
  const capabilityDomain = value['capabilityDomain']
  if (
    capabilityDomain !== undefined &&
    !CAPABILITY_NAME_VALUES.includes(capabilityDomain as CapabilityName)
  ) {
    return undefined
  }
  const operationFingerprint = value['operationFingerprint']
  if (
    operationFingerprint !== undefined &&
    (typeof operationFingerprint !== 'string' || operationFingerprint.length === 0)
  ) {
    return undefined
  }
  // A4-PR7 Task 7.0 (ADR A1-14): the authority point is part of the recorded
  // scope, so the scope reader carries it. Without this line the DECISION
  // snapshot would silently drop the point the human approved, and every v3
  // consumption would then compare a point-bearing guarded scope against a
  // point-less snapshot — `scope-mismatch` for the correct operation, and a
  // lost authority fact for the incorrect one. A present-but-unreadable point
  // fails the row (fail closed), exactly like every other member.
  const authorityScope = parseAuthorityScopeField(value['authorityScope'])
  if (value['authorityScope'] !== undefined && authorityScope === undefined) {
    return undefined
  }
  return {
    rootSessionId,
    subject,
    ...(typeof targetInstanceId === 'string' && targetInstanceId.length > 0
      ? { targetInstanceId }
      : {}),
    actionName,
    correlation,
    ...(toolName !== undefined ? { toolName } : {}),
    ...(capabilityDomain !== undefined
      ? { capabilityDomain: capabilityDomain as CapabilityName }
      : {}),
    ...(operationFingerprint !== undefined ? { operationFingerprint } : {}),
    ...(authorityScope !== undefined ? { authorityScope } : {}),
  }
}

/** Parse a request payload (malformed rows are treated as ABSENT).
 *
 *  Subject rule (pre-alpha3 PR-D, D.2): an EXPLICIT durable `subject` is
 *  canonical; a LEGACY row (targetInstanceId only, no explicit subject)
 *  parses to the instance subject (byte-identical semantics — the old
 *  targetInstanceId-only identity is preserved). The review-payload
 *  fields (D.3) are ADDITIVE: ABSENT on legacy rows (legacy semantics),
 *  and a PRESENT-but-wrong-type value is malformed (ABSENT — fail
 *  closed).
 */
function parseRequestPayload(value: unknown): RequestPayload | undefined {
  if (!isPlainObject(value)) return undefined
  const requestId = value['requestId']
  const kind = value['kind']
  const targetInstanceId = value['targetInstanceId']
  const actionName = value['actionName']
  const correlation = value['correlation']
  const requester = parseCallerRef(value['requester'])
  if (typeof requestId !== 'string' || requestId.length === 0) return undefined
  if (typeof kind !== 'string' || !CONTROL_REQUEST_KIND_VALUES.includes(kind)) return undefined
  if (typeof actionName !== 'string' || actionName.length === 0) return undefined
  if (typeof correlation !== 'string' || correlation.length === 0) return undefined
  if (requester === undefined) return undefined
  // The subject: explicit, or derived from targetInstanceId (legacy).
  let subject: ControlSubject | undefined
  if (value['subject'] !== undefined) {
    subject = parseSubject(value['subject'])
    if (subject === undefined) return undefined
    if (
      targetInstanceId !== undefined &&
      (subject.kind !== CONTROL_SUBJECT_KINDS.INSTANCE || subject.instanceId !== targetInstanceId)
    ) {
      // An explicit subject that disagrees with the legacy projection is
      // an ambiguous identity — fail closed (ABSENT), never a guess.
      return undefined
    }
  } else {
    if (typeof targetInstanceId !== 'string' || targetInstanceId.length === 0) {
      // No subject AND no targetInstanceId: no identity element at all.
      return undefined
    }
    subject = { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: targetInstanceId }
  }
  const toolName = value['toolName']
  if (toolName !== undefined && typeof toolName !== 'string') return undefined
  const capabilityDomain = value['capabilityDomain']
  if (
    capabilityDomain !== undefined &&
    !CAPABILITY_NAME_VALUES.includes(capabilityDomain as CapabilityName)
  ) {
    return undefined
  }
  const summary = value['summary']
  if (summary !== undefined && typeof summary !== 'string') return undefined
  const operationFingerprint = value['operationFingerprint']
  if (
    operationFingerprint !== undefined &&
    (typeof operationFingerprint !== 'string' || operationFingerprint.length === 0)
  ) {
    return undefined
  }
  // The additive review-payload fields (pre-alpha3 PR-D, D.3): ABSENT =
  // legacy semantics; present-but-wrong-type = malformed (fail closed).
  const reviewPayload = value['reviewPayload']
  if (reviewPayload !== undefined && !isRemoteSafeJsonValue(reviewPayload)) return undefined
  const reviewPayloadDigest = value['reviewPayloadDigest']
  if (
    reviewPayloadDigest !== undefined &&
    (typeof reviewPayloadDigest !== 'string' || reviewPayloadDigest.length === 0)
  ) {
    return undefined
  }
  if (reviewPayloadDigest !== undefined && reviewPayload === undefined) {
    // A digest of a payload the row does not carry is ambiguous input.
    return undefined
  }
  const executionCoupling = value['executionCoupling']
  if (
    executionCoupling !== undefined &&
    !CONTROL_EXECUTION_COUPLING_VALUES.includes(executionCoupling as string)
  ) {
    return undefined
  }
  // The Alpha.4 leg fields. ABSENT on every pre-Alpha.4 row; a row that
  // carries a case id is held to the STRICT rule (ADR A2-9), and any
  // present-but-invalid value fails the row closed (ABSENT) — the caller
  // (`loadControlState`) then files it as a CORRUPT LEG rather than silently
  // dropping it, because a leg of an approval case is an authority-bearing
  // row and a half-read one must never look like a complete one.
  const approvalCaseId = value['approvalCaseId']
  if (approvalCaseId !== undefined && (typeof approvalCaseId !== 'string' || approvalCaseId.length === 0)) {
    return undefined
  }
  const legOrdinal = value['legOrdinal']
  if (legOrdinal !== undefined && (typeof legOrdinal !== 'number' || !Number.isInteger(legOrdinal) || legOrdinal < 1)) {
    return undefined
  }
  const reviewAuthority = value['reviewAuthority']
  if (reviewAuthority !== undefined && !isProposalAuthorityPosition(reviewAuthority)) {
    return undefined
  }
  const requiredAuthorityAtCreation = value['requiredAuthorityAtCreation']
  if (
    requiredAuthorityAtCreation !== undefined &&
    !isProposalAuthorityPosition(requiredAuthorityAtCreation)
  ) {
    return undefined
  }
  const beneficiaryAuthority = value['beneficiaryAuthority']
  if (beneficiaryAuthority !== undefined && !isProposalAuthorityPosition(beneficiaryAuthority)) {
    return undefined
  }
  const requestedEffect = value['requestedEffect']
  if (
    requestedEffect !== undefined &&
    !PERMISSION_OVERLAY_EFFECT_VALUES.includes(requestedEffect as PermissionOverlayEffect)
  ) {
    return undefined
  }
  const previousRequestId = value['previousRequestId']
  if (previousRequestId !== undefined && (typeof previousRequestId !== 'string' || previousRequestId.length === 0)) {
    return undefined
  }
  const mutationProposalFingerprint = value['mutationProposalFingerprint']
  if (
    mutationProposalFingerprint !== undefined &&
    (typeof mutationProposalFingerprint !== 'string' || mutationProposalFingerprint.length === 0)
  ) {
    return undefined
  }
  // A4-PR7 Task 7.0 (ADR A1-14): the persisted authority point. A
  // present-but-malformed one fails the row (it is an authority-bearing field;
  // half-reading it would let the ceiling be re-run over a point the row did
  // not name). ABSENT stays LEGAL here on purpose: the rule "an operation case
  // must carry it" is enforced at the WRITE (`caseIdentityProblemOf`) and at the
  // CONSUMPTION point (`guardOperation`, which refuses), NOT here — failing the
  // row would drop it out of `state.requests`, and the guard's answer to a
  // missing row is `no-request`, which `packages/tools/guard.ts` reads as
  // "proceed". A corruption must never be routed into the one verdict that
  // executes.
  const authorityScope = parseAuthorityScopeField(value['authorityScope'])
  if (value['authorityScope'] !== undefined && authorityScope === undefined) {
    return undefined
  }
  // The strict half of ADR A2-9: a row that NAMES a case is an
  // authority-bearing leg, and a leg without its ordinal or its reviewing
  // authority is not a leg with a missing detail — it is a leg that cannot be
  // ordered or decided. Such a row fails the parse (ABSENT) and is filed by
  // `loadControlState` as a corrupt leg, so neither the case read NOR the
  // guard and never a default can act on it.
  if (approvalCaseId !== undefined && (legOrdinal === undefined || reviewAuthority === undefined)) {
    return undefined
  }
  return {
    requestId,
    kind: kind as ControlRequestKind,
    requester,
    subject,
    ...(typeof targetInstanceId === 'string' && targetInstanceId.length > 0
      ? { targetInstanceId }
      : {}),
    actionName,
    correlation,
    ...(toolName !== undefined ? { toolName } : {}),
    ...(capabilityDomain !== undefined
      ? { capabilityDomain: capabilityDomain as CapabilityName }
      : {}),
    ...(operationFingerprint !== undefined ? { operationFingerprint } : {}),
    ...(summary !== undefined ? { summary } : {}),
    ...(reviewPayload !== undefined
      ? { reviewPayload: reviewPayload as RemoteSafeJsonValue }
      : {}),
    ...(reviewPayloadDigest !== undefined ? { reviewPayloadDigest } : {}),
    ...(executionCoupling !== undefined
      ? { executionCoupling: executionCoupling as ControlExecutionCoupling }
      : {}),
    ...(approvalCaseId !== undefined ? { approvalCaseId } : {}),
    ...(legOrdinal !== undefined ? { legOrdinal } : {}),
    ...(reviewAuthority !== undefined
      ? { reviewAuthority: reviewAuthority as ProposalAuthorityPosition }
      : {}),
    ...(requiredAuthorityAtCreation !== undefined
      ? { requiredAuthorityAtCreation: requiredAuthorityAtCreation as ProposalAuthorityPosition }
      : {}),
    ...(beneficiaryAuthority !== undefined
      ? { beneficiaryAuthority: beneficiaryAuthority as ProposalAuthorityPosition }
      : {}),
    ...(requestedEffect !== undefined
      ? { requestedEffect: requestedEffect as PermissionOverlayEffect }
      : {}),
    ...(previousRequestId !== undefined ? { previousRequestId } : {}),
    ...(mutationProposalFingerprint !== undefined ? { mutationProposalFingerprint } : {}),
    ...(authorityScope !== undefined ? { authorityScope } : {}),
  }
}

/**
 * Read the durable authority point (A4-PR7 Task 7.0, ADR A1-14) into its
 * CANONICAL shape. The rebuild is the point: an unknown third matcher field
 * (`{kind:'exact', resource, root: …}`) must not survive into the identity the
 * ceiling is re-run over, so the reader returns the two members the type has,
 * in the order the type has them — the same normalization the fingerprint and
 * subject fields get.
 *
 * ABSENT reads as `undefined`, which is legal here (a pre-Alpha.4 row and an
 * `envelope-mutation` row carry no point); the caller distinguishes "the key was
 * present and unreadable" from "the key was absent".
 */
function parseAuthorityScopeField(value: unknown): ControlAuthorityScope | undefined {
  if (!isControlAuthorityScope(value)) return undefined
  const matcher = value.matcher
  return matcher.kind === CONTROL_AUTHORITY_MATCHER_KINDS.EXACT
    ? { operationClass: value.operationClass, matcher: { kind: 'exact', resource: matcher.resource } }
    : {
        operationClass: value.operationClass,
        matcher: { kind: 'fingerprint', resource: matcher.resource },
      }
}

/** Parse an abandon payload (malformed rows are treated as ABSENT). */
function parseAbandonmentPayload(value: unknown): AbandonmentPayload | undefined {
  if (!isPlainObject(value)) return undefined
  const requestId = value['requestId']
  const rootSessionId = value['rootSessionId']
  const abandonedAt = value['abandonedAt']
  if (typeof requestId !== 'string' || requestId.length === 0) return undefined
  if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) return undefined
  if (typeof abandonedAt !== 'string' || abandonedAt.length === 0) return undefined
  const reason = value['reason']
  if (reason !== undefined && typeof reason !== 'string') return undefined
  return {
    requestId,
    rootSessionId,
    abandonedAt,
    ...(reason !== undefined ? { reason } : {}),
  }
}

/** Parse a decision payload (malformed rows are treated as ABSENT). */
function parseDecisionPayload(value: unknown): DecisionPayload | undefined {
  if (!isPlainObject(value)) return undefined
  const requestId = value['requestId']
  const decision = value['decision']
  const decider = parseCallerRef(value['decider'])
  const scope = parseScope(value['scope'])
  const requestSequence = value['requestSequence']
  if (typeof requestId !== 'string' || requestId.length === 0) return undefined
  if (typeof decision !== 'string' || !CONTROL_DECISION_VALUE_VALUES.includes(decision)) {
    return undefined
  }
  if (decider === undefined) return undefined
  if (scope === undefined) return undefined
  if (typeof requestSequence !== 'number' || !Number.isInteger(requestSequence) || requestSequence < 1) {
    return undefined
  }
  const reason = value['reason']
  if (reason !== undefined && !CONTROL_DECISION_REASON_VALUES.includes(reason as string)) {
    return undefined
  }
  const note = value['note']
  if (note !== undefined && typeof note !== 'string') return undefined
  // Alpha.4 A4-PR3 (ADR A2-8): the additive terminal reason. An
  // out-of-vocabulary value fails the row closed (ABSENT) exactly like every
  // other field of an authority-bearing row — a close whose WHY is not one of
  // the three closed reasons is not reportable.
  const terminalReason = value['terminalReason']
  if (
    terminalReason !== undefined &&
    !CONTROL_LEG_TERMINAL_REASON_VALUES.includes(terminalReason as string)
  ) {
    return undefined
  }
  return {
    requestId,
    decision: decision as ControlDecisionValue,
    decider,
    scope,
    requestSequence,
    ...(reason !== undefined ? { reason: reason as ControlDecisionReason } : {}),
    ...(note !== undefined ? { note } : {}),
    ...(terminalReason !== undefined
      ? { terminalReason: terminalReason as ControlLegTerminalReason }
      : {}),
  }
}

/** Parse a consumption payload (malformed rows are treated as ABSENT). */
function parseConsumptionPayload(value: unknown): ConsumptionPayload | undefined {
  if (!isPlainObject(value)) return undefined
  const requestId = value['requestId']
  const decisionSequence = value['decisionSequence']
  const scope = parseScope(value['scope'])
  const consumedAt = value['consumedAt']
  if (typeof requestId !== 'string' || requestId.length === 0) return undefined
  if (
    typeof decisionSequence !== 'number' ||
    !Number.isInteger(decisionSequence) ||
    decisionSequence < 1
  ) {
    return undefined
  }
  if (scope === undefined) return undefined
  if (typeof consumedAt !== 'string' || consumedAt.length === 0) return undefined
  return { requestId, decisionSequence, scope, consumedAt }
}

/** Is `caller` a well-formed facade ActionCaller? */
/** Parse an escalation leg payload (malformed rows are treated as ABSENT). */
function parseEscalationPayload(value: unknown): EscalationPayload | undefined {
  if (!isPlainObject(value)) return undefined
  const approvalCaseId = value['approvalCaseId']
  const legOrdinal = value['legOrdinal']
  const previousRequestId = value['previousRequestId']
  const escalatedBy = parseCallerRef(value['escalatedBy'])
  if (typeof approvalCaseId !== 'string' || approvalCaseId.length === 0) return undefined
  if (typeof legOrdinal !== 'number' || !Number.isInteger(legOrdinal) || legOrdinal < 1) {
    return undefined
  }
  if (typeof previousRequestId !== 'string' || previousRequestId.length === 0) return undefined
  if (escalatedBy === undefined) return undefined
  const reason = value['reason']
  if (reason !== undefined && typeof reason !== 'string') return undefined
  return {
    approvalCaseId,
    legOrdinal,
    previousRequestId,
    escalatedBy,
    ...(reason !== undefined ? { reason } : {}),
  }
}

function isActionCaller(caller: unknown): caller is ActionCaller {
  if (!isPlainObject(caller)) return false
  if (caller['kind'] === 'human') {
    return typeof caller['humanId'] === 'string' && (caller['humanId'] as string).length > 0
  }
  if (caller['kind'] === 'instance') {
    return typeof caller['instanceId'] === 'string' && (caller['instanceId'] as string).length > 0
  }
  return false
}

/** The stable logical-request key (the request idempotency identity AND
 *  the scope's durable identity; NUL-separated per the provisioning
 *  identity convention). The second element is the KIND-PREFIXED SUBJECT
 *  IDENTITY (pre-alpha3 PR-D, D.2 + review B1: `subjectIdentityOf` —
 *  `instance:<instanceId>` / `template:<templateId>` /
 *  `team:<rootSessionId>`). The kind prefix makes the three subject kinds
 *  DISJOINT in the key — an instance id, a template id and a root session
 *  id that happen to be equal strings can no longer alias across kinds
 *  (a valid template slug and a valid instance id can both be `inst-abc`).
 *  For a LEGACY instance row the subject is derived from `targetInstanceId`
 *  (kind `instance`), so the second element is `instance:<targetInstanceId>`;
 *  BOTH the new request and the existing-row lookup recompute through the
 *  SAME `subjectIdentityOf`, so old durable rows stay idempotent —
 *  behavioral backward compatibility is preserved even though the literal
 *  key now carries the kind prefix (no longer byte-identical to the
 *  pre-PR-D string). The optional
 *  operation fingerprint, WHEN PRESENT, participates in the key (alpha.2
 *  exact-scope extension): two requests identical except for the
 *  fingerprint are DIFFERENT logical requests (different keys, different
 *  requestIds, no idempotency collision — a payload/resource mismatch
 *  must never reuse another operation's request or approval). When
 *  ABSENT the key carries an empty fingerprint segment, which is
 *  distinct from any present fingerprint; legacy rows (fingerprint
 *  absent) recompute the SAME key they always had for their own
 *  retries, so old durable rows stay idempotent under the extended key. */
/**
 * A4 corrupt-leg guard (ADR A2-9 + A1-14): does a leg row the STRICT reader
 * refused still have a claim on THIS call?
 *
 * THE LAW. `parseRequestPayload` refusing a row is a statement about the ROW
 * ("this cannot be reconstructed"), never about the CALL ("nothing governs
 * it"). `loadControlState` files such a row that names a case into
 * `ControlState.corruptLegs`, and the read plane reports it
 * (`buildApprovalCaseState` names the typed problem,
 * `findApprovalCaseByIdentity` verifies against it). `guardOperation` was the
 * one consumer that treated the row's INVISIBILITY as an answer: an unreadable
 * row matched nothing, the verdict was `no-request`, and
 * `packages/tools/src/guard.ts` maps `no-request` to "proceed" — so a stored
 * constraint vanished from the enforcement plane at exactly the moment the
 * storage became least trustworthy. A control record that cannot be parsed must
 * never REDUCE what the guard can see.
 *
 * THE TEST, and why it is agreement-over-what-can-still-be-read rather than a
 * derived case id. The guard's own scope identity is `scopeKey`'s member set, so
 * a corrupt leg is indistinguishable from the request that would govern this
 * call when every member the row still discloses AGREES. A member the row
 * discloses that DISAGREES is positive evidence the leg governs some OTHER call,
 * and this one stays a legitimate `no-request` — that is the direction that
 * keeps one damaged row from freezing a whole Team. A member the row does NOT
 * disclose (absent where the shape allows absence, or present-but-unreadable
 * where it does not) is evidence about nothing, and the conservative reading of
 * evidence-about-nothing is that the leg may still govern. Nothing cheaper is
 * honest here: the case identity of a leg whose members are damaged is precisely
 * what cannot be recomputed, which is why this compares members instead of
 * hashing them.
 *
 * @param payload - the raw payload of one `corruptLegs` entry (never defaulted).
 * @param scope - the validated guard scope of the call.
 * @param subjectIdentity - the canonical subject identity the call resolved to.
 * @returns `true` when the leg cannot be ruled out as this call's governing row.
 */
function corruptLegCouldGovern(
  payload: Record<string, unknown>,
  scope: ControlOperationScope,
  subjectIdentity: string,
): boolean {
  // Every member answers AGREES / DISAGREES / NOTHING (`undefined`); the row
  // stays a candidate unless some member positively says "not this call".
  const memberAgrees = (key: string, expected: string): boolean | undefined => {
    const raw = payload[key]
    if (raw === undefined) return expected.length === 0
    if (typeof raw !== 'string') return undefined
    return raw === expected
  }
  const subjectAgrees = (): boolean | undefined => {
    if (payload['subject'] !== undefined) {
      const parsed = parseSubject(payload['subject'])
      return parsed === undefined ? undefined : subjectIdentityOf(parsed) === subjectIdentity
    }
    // The legacy projection `parseSubject`-derived rows carry: a present
    // `targetInstanceId` IS the instance subject, read the same way here.
    const legacyTarget = payload['targetInstanceId']
    if (typeof legacyTarget !== 'string') return undefined
    return (
      subjectIdentityOf({ kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: legacyTarget }) ===
      subjectIdentity
    )
  }
  const verdicts: readonly (boolean | undefined)[] = [
    subjectAgrees(),
    memberAgrees('actionName', scope.actionName),
    memberAgrees('toolName', scope.toolName ?? ''),
    memberAgrees('correlation', scope.correlation),
    memberAgrees('operationFingerprint', scope.operationFingerprint ?? ''),
  ]
  return !verdicts.some((agrees) => agrees === false)
}

/**
 * The typed refusal for ONE corrupt leg that could govern this call, plus the
 * requestId to point the operator at (echoed only when the row still discloses
 * one — a refusal must never invent an identity it did not read).
 *
 * THE TWO-MEMBER MAPPING, and why neither name is a stretch. This mints no new
 * reason code; the closed vocabulary already carries both laws, and the defect
 * was that the second never got applied on this route.
 *
 * - `authority-scope-unbound` — an OPERATION-CASE leg whose authority point
 *   cannot be read, whether the key is absent (the readable-row sibling is
 *   pinned by `a4p7-a1-14-consumption-revalidation.test.ts` leg A4) or PRESENT
 *   AND REFUSED by `parseAuthorityScopeField`. To the guard those are one fact:
 *   the row names no point that an allow over it could be re-run over. That
 *   member's own documentation says it exists because "naming this (rather than
 *   dropping the row to `no-request`) is what keeps a corrupt authority row from
 *   executing" — a corrupt leg is the case the rule was written for and never
 *   reached.
 * - `authority-undetermined` — every other corrupt leg: the refusal sits in some
 *   other member, the `kind` is unreadable, or the kind is `envelope-mutation`
 *   (whose ceiling question belongs to the proposal's own region, so "no
 *   authority point" would name the wrong thing). Its law is the one under
 *   attack here: "could not confirm is not confirmed — and an unreadable
 *   document is never an empty one".
 */
function corruptLegVerdictOf(payload: Record<string, unknown>): ControlGuardVerdict {
  const reasons = CONTROL_GUARD_BLOCK_REASONS
  const requestId = payload['requestId']
  const echo =
    typeof requestId === 'string' && requestId.length > 0 ? { requestId } : {}
  const kind = payload['kind']
  const fingerprint = payload['operationFingerprint']
  const isOperationCase =
    typeof kind === 'string' &&
    CONTROL_REQUEST_KIND_VALUES.includes(kind) &&
    kind !== CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION &&
    typeof fingerprint === 'string' &&
    fingerprint.length > 0
  if (!isOperationCase) return { allowed: false, reason: reasons.AUTHORITY_UNDETERMINED, ...echo }
  return parseAuthorityScopeField(payload['authorityScope']) === undefined
    ? { allowed: false, reason: reasons.AUTHORITY_SCOPE_UNBOUND, ...echo }
    : { allowed: false, reason: reasons.AUTHORITY_UNDETERMINED, ...echo }
}

function scopeKey(
  rootSessionId: string,
  subjectIdentity: string,
  actionName: string,
  toolName: string | undefined,
  correlation: string,
  operationFingerprint: string | undefined,
): string {
  return [
    rootSessionId,
    subjectIdentity,
    actionName,
    toolName ?? '',
    correlation,
    operationFingerprint ?? '',
  ].join('\u0000')
}

/** The durable requestId derived from the scope key (stable across
 *  retries; distinct per logical request). */
function requestIdOf(key: string): string {
  return `ctrl-${deterministicToken(key, 24)}`
}

/** Does the durable scope snapshot match the guarded scope EXACTLY? */
/** Resolve the CANONICAL subject of a scope (pre-alpha3 PR-D, D.2): an
 *  explicit `subject` wins; ABSENT falls back to the legacy
 *  `targetInstanceId`-only path (the instance subject — byte-identical
 *  identity for legacy callers). Returns `undefined` when the scope
 *  carries neither a subject nor a usable targetInstanceId (the caller
 *  must fail closed). */
function resolveSubject(scope: ControlOperationScope): ControlSubject | undefined {
  if (scope.subject !== undefined) return scope.subject
  if (typeof scope.targetInstanceId === 'string' && scope.targetInstanceId.length > 0) {
    return { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: scope.targetInstanceId }
  }
  return undefined
}

function scopeSnapshotMatches(
  recorded: ControlOperationScope,
  guarded: ControlOperationScope,
): boolean {
  if (recorded.rootSessionId !== guarded.rootSessionId) return false
  // The canonical SUBJECT identity (pre-alpha3 PR-D, D.2): closed kind
  // AND kind-selected id. A legacy instance row's subject is derived from
  // its targetInstanceId, so a legacy guarded scope resolves to the SAME
  // instance subject — byte-identical matching for old scopes.
  const recordedSubject = resolveSubject(recorded)
  const guardedSubject = resolveSubject(guarded)
  if (recordedSubject === undefined || guardedSubject === undefined) return false
  if (!subjectsMatch(recordedSubject, guardedSubject)) return false
  if (recorded.actionName !== guarded.actionName) return false
  if (recorded.correlation !== guarded.correlation) return false
  if ((recorded.toolName ?? '') !== (guarded.toolName ?? '')) return false
  if ((recorded.capabilityDomain ?? '') !== (guarded.capabilityDomain ?? '')) return false
  // Fingerprint comparison (alpha.2): both absent = the old behavior
  // (equal, no check needed); present on exactly one side or different
  // values = MISMATCH (a fingerprint-bound approval never matches a
  // fingerprint-less or differently-fingerprinted attempt, and vice
  // versa — the undefined !== 'x' inequality covers the present/absent
  // case; both present and equal falls through).
  if (recorded.operationFingerprint !== guarded.operationFingerprint) return false
  // The AUTHORITY point (A4-PR7 Task 7.0, ADR A1-14): an approval covers the
  // operation class + resource it was opened for. Present on one side only, or
  // a different class, a different matcher KIND, or a different resource =
  // MISMATCH. This is the check the scope key cannot do: `toolName` is the
  // pipeline's lane name, so a read of `/fileB.txt` under the same tool,
  // correlation and fingerprint as an approved `/fileA.txt` is a DIFFERENT
  // authority point with an identical legacy scope.
  if (!authorityScopesMatch(recorded.authorityScope, guarded.authorityScope)) return false
  return true
}

/** The authority-point comparison of {@link scopeSnapshotMatches}. */
function authorityScopesMatch(
  recorded: ControlOperationScope['authorityScope'],
  guarded: ControlOperationScope['authorityScope'],
): boolean {
  if (recorded === undefined || guarded === undefined) return recorded === guarded
  if (recorded.operationClass !== guarded.operationClass) return false
  if (recorded.matcher.kind !== guarded.matcher.kind) return false
  return recorded.matcher.resource === guarded.matcher.resource
}

/**
 * Does the external hard cell allow the operation? Fail closed: an ABSENT
 * cell means "no host restriction"; a hard `deny` refuses; a hard
 * allow-list must NAME the operation's tool (an operation with no named
 * tool matches no item — refused).
 */
function hardCellAllows(entry: PolicyEntry | undefined, toolName: string | undefined): boolean {
  if (entry === undefined) return true
  if (entry.kind === 'deny') return false
  if (toolName === undefined) return false
  return entry.items.includes(toolName)
}

/**
 * The CONTROL INTERNAL close authority (pre-alpha3 review F3): may
 * `caller` durably ABANDON (close) the request whose durable requester
 * is `requester`?
 *
 * Abandon is deliberately NOT bound to any mutation-envelope op. The
 * PR-D defect: it reused the `resolve-control` op spec + envelope check,
 * so a caller that may REQUEST a review (e.g. the Recovery Leader whose
 * reduced team envelope carries `request-control` but not
 * `resolve-control`) could never ABANDON its own waiting review — the
 * only exit was "wait for the human to close". Abandon is a narrow,
 * closed authority over the caller's RESOLVED role:
 *
 * - `human`  → yes (the team owner closes any of the team's requests —
 *   invariant 34: the human exceeds the team autonomy boundary);
 * - `leader` → yes (the Leader of the current Team closes any of the
 *   team's requests — including the review IT REQUESTED in the inline
 *   recovery-dispatch coupling, whose whole point is that the requester
 *   gets its own abort back);
 * - `member` → only the request it requested itself (the requester ref
 *   is its own instance id — a member may never close a sibling's
 *   request);
 * - a SYSTEM CONTINUATION caller (a future detached-continuation kind
 *   that resumes a request's own abort) would close ONLY the request it
 *   owns. The current closed `ActionCaller` union (`human | instance`)
 *   carries no system kind, so that branch is unreachable today; the
 *   rule is frozen here as the extension point — a new caller kind must
 *   be admitted by THIS predicate (requester === the continuation's own
 *   request) before any continuation may call `abandonControlRequest`.
 *
 * This authority exposes NO new Team tool permission and NO new
 * mutation op: it is enforced INSIDE the control service over the
 * already-resolved (live) caller. A stale caller is rejected earlier by
 * the reused `resolveCaller` step (a DISPOSED/ARCHIVED principal cannot
 * close anything).
 *
 * @param requester - the durable requester ref of the addressed request.
 * @param caller - the resolved (live) caller.
 * @returns whether the caller may durably abandon the request.
 */
function mayAbandon(requester: ControlCallerRef, caller: ResolvedCaller): boolean {
  if (caller.role === CALLER_ROLES.HUMAN) return true
  if (caller.role === CALLER_ROLES.LEADER) return true
  if (caller.role === CALLER_ROLES.MEMBER) {
    return (
      requester.kind === 'instance' &&
      requester.instanceId === String(caller.callerMember?.instanceId ?? '')
    )
  }
  return false
}

// --- the service ------------------------------------------------------------------------

/**
 * Create the durable control plane service over one open TeamDomain.
 *
 * @param options - the injected ports (see {@link ControlServiceOptions}).
 * @returns the ControlService (requestControl / resolveControl /
 *   listControlState / guardOperation / checkExternalOperation /
 *   awaitControlDecision).
 */
export function createControlService(options: ControlServiceOptions): ControlService {
  const repositories = options.teamDomain.repositories

  /** The per-team promise chain (a concurrency device, NOT authority —
   *  invariant 45). */
  const teamLocks = new Map<string, Promise<unknown>>()

  // --- small closed-code helpers -----------------------------------------------------

  function malformed(
    stage:
      | 'request'
      | 'resolve'
      | 'abandon'
      | 'list'
      | 'wait'
      | 'requestApprovalLeg'
      | 'escalateApprovalLeg'
      | 'readApprovalCaseState'
      | 'listOpenApprovalCases'
      | 'appendTerminalOutcome'
      | 'closeApprovalCaseWithoutLeg'
      | 'findApprovalCaseByIdentity',
    field: string,
    message: string,
  ): ControlError {
    return new ControlError(
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
      `ControlService: ${message} (field: '${field}')`,
      { stage, field },
    )
  }

  function guardMalformed(field: string, message: string): ControlError {
    return new ControlError(
      CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED,
      `ControlService: ${message} (field: '${field}')`,
      { stage: 'guard', field },
    )
  }

  function parseRoot(raw: unknown, code: ControlErrorCode, stage: string): string {
    try {
      return String(parseRootSessionId(raw))
    } catch {
      throw new ControlError(
        code,
        `ControlService: malformed rootSessionId in ${stage} input: ${JSON.stringify(raw)}`,
        { stage, field: 'rootSessionId' },
      )
    }
  }

  /** Map a durable-store failure to the facade's closed effect-phase code
   *  (the bounded durable-write fault — the same vocabulary the P6-T2
   *  router uses; a store failure is infrastructure, not a control-plane
   *  rejection). */
  function durableFailure(stage: string, error: unknown): TeamRuntimeError {
    return new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED,
      `ControlService: ${stage} failed: ${error instanceof Error ? error.message : String(error)}`,
      { stage },
    )
  }

  /**
   * C1 (leader-approval reachability) — report ONE notification failure
   * to the optional diagnostic sink. The sink is DIAGNOSTIC ONLY: it
   * must never alter the request path, so a throwing sink is swallowed
   * (a fault in the observability wiring cannot fault the durable
   * control plane).
   */
  function reportNotificationFailure(
    record: ControlRequestRecord,
    error: unknown,
  ): void {
    const sink = options.onNotificationFailure
    if (sink === undefined) return
    try {
      sink({
        requestId: record.requestId,
        kind: record.kind,
        error,
      })
    } catch {
      // the diagnostic sink must never alter the request path
    }
  }

  async function allocateSequence(): Promise<number> {
    try {
      return await repositories.ledger.allocateSequence()
    } catch (error) {
      throw durableFailure('ledger sequence allocation', error)
    }
  }

  async function putEntry(entry: {
    readonly schemaVersion: number
    readonly sequence: number
    readonly rootSessionId: string
    readonly factType: string
    readonly payload: Record<string, unknown>
    readonly createdAt: string
  }): Promise<number> {
    try {
      await repositories.ledger.put(entry)
    } catch (error) {
      throw durableFailure(`ledger put (${entry.factType})`, error)
    }
    return entry.sequence
  }

  // --- durable state reads (fresh every call — invariant 45) --------------------------

  function loadControlState(root: string): ControlState {
    const requests: StoredFact<RequestPayload>[] = []
    const decisions: StoredFact<DecisionPayload>[] = []
    const consumptions: StoredFact<ConsumptionPayload>[] = []
    const abandonments: StoredFact<AbandonmentPayload>[] = []
    const corruptLegs: StoredFact<Record<string, unknown>>[] = []
    const escalations: StoredFact<EscalationPayload>[] = []
    for (const entry of repositories.ledger.list()) {
      if (String(entry.rootSessionId) !== root) continue
      if (entry.factType === FACT_REQUEST) {
        const payload = parseRequestPayload(entry.payload)
        if (payload !== undefined) {
          requests.push({ entry, payload })
        } else if (
          isPlainObject(entry.payload) &&
          typeof entry.payload['approvalCaseId'] === 'string'
        ) {
          // A leg row the strict parse refused: reported, never defaulted (see
          // `ControlState.corruptLegs`).
          corruptLegs.push({ entry, payload: entry.payload })
        }
      } else if (entry.factType === FACT_DECISION) {
        const payload = parseDecisionPayload(entry.payload)
        if (payload !== undefined) decisions.push({ entry, payload })
      } else if (entry.factType === FACT_CONSUMPTION) {
        const payload = parseConsumptionPayload(entry.payload)
        if (payload !== undefined) consumptions.push({ entry, payload })
      } else if (entry.factType === FACT_ABANDONMENT) {
        const payload = parseAbandonmentPayload(entry.payload)
        if (payload !== undefined) abandonments.push({ entry, payload })
      } else if (entry.factType === FACT_ESCALATION) {
        const payload = parseEscalationPayload(entry.payload)
        if (payload !== undefined) escalations.push({ entry, payload })
      }
    }
    const bySequence = (a: { entry: LedgerEntry }, b: { entry: LedgerEntry }): number =>
      a.entry.sequence - b.entry.sequence
    requests.sort(bySequence)
    decisions.sort(bySequence)
    consumptions.sort(bySequence)
    abandonments.sort(bySequence)
    escalations.sort(bySequence)
    corruptLegs.sort(bySequence)
    return { requests, corruptLegs, decisions, consumptions, abandonments, escalations }
  }

  function scopeOf(entry: LedgerEntry, payload: RequestPayload): ControlOperationScope {
    return {
      rootSessionId: String(entry.rootSessionId),
      subject: payload.subject,
      ...(payload.targetInstanceId !== undefined
        ? { targetInstanceId: payload.targetInstanceId }
        : {}),
      actionName: payload.actionName,
      correlation: payload.correlation,
      ...(payload.toolName !== undefined ? { toolName: payload.toolName } : {}),
      ...(payload.capabilityDomain !== undefined
        ? { capabilityDomain: payload.capabilityDomain }
        : {}),
      ...(payload.operationFingerprint !== undefined
        ? { operationFingerprint: payload.operationFingerprint }
        : {}),
      // A4-PR7 Task 7.0: the authority point rides the row's OWN scope, so the
      // decision snapshot and the consumption record carry the point the human
      // approved (ADR A1-14's "fold it into the decision scope") without any
      // call site having to re-supply it.
      ...(payload.authorityScope !== undefined ? { authorityScope: payload.authorityScope } : {}),
    }
  }

  function toRequestRecord(
    entry: LedgerEntry,
    payload: RequestPayload,
    state: ControlState,
  ): ControlRequestRecord {
    // The DERIVED request state (pre-alpha3 PR-D, D.4): the abandon fact
    // is the TERMINAL mark (like `stale-denied`) — it wins over a
    // concurrent decision, which in turn wins over pending.
    const abandoned = state.abandonments.some(
      (a) => a.payload.requestId === payload.requestId,
    )
    const decided = state.decisions.some((d) => d.payload.requestId === payload.requestId)
    const status = abandoned ? 'abandoned' : decided ? 'decided' : 'pending'
    return {
      requestId: payload.requestId,
      rootSessionId: String(entry.rootSessionId),
      kind: payload.kind,
      requester: payload.requester,
      subject: payload.subject,
      ...(payload.targetInstanceId !== undefined
        ? { targetInstanceId: payload.targetInstanceId }
        : {}),
      actionName: payload.actionName,
      correlation: payload.correlation,
      status,
      createdAt: entry.createdAt,
      requestSequence: entry.sequence,
      ...(payload.toolName !== undefined ? { toolName: payload.toolName } : {}),
      ...(payload.capabilityDomain !== undefined
        ? { capabilityDomain: payload.capabilityDomain }
        : {}),
      ...(payload.operationFingerprint !== undefined
        ? { operationFingerprint: payload.operationFingerprint }
        : {}),
      ...(payload.summary !== undefined ? { summary: payload.summary } : {}),
      ...(payload.reviewPayload !== undefined
        ? { reviewPayload: payload.reviewPayload }
        : {}),
      ...(payload.reviewPayloadDigest !== undefined
        ? { reviewPayloadDigest: payload.reviewPayloadDigest }
        : {}),
      ...(payload.executionCoupling !== undefined
        ? { executionCoupling: payload.executionCoupling }
        : {}),
      ...(payload.approvalCaseId !== undefined ? { approvalCaseId: payload.approvalCaseId } : {}),
      ...(payload.legOrdinal !== undefined ? { legOrdinal: payload.legOrdinal } : {}),
      ...(payload.reviewAuthority !== undefined
        ? { reviewAuthority: payload.reviewAuthority }
        : {}),
      ...(payload.requiredAuthorityAtCreation !== undefined
        ? { requiredAuthorityAtCreation: payload.requiredAuthorityAtCreation }
        : {}),
      ...(payload.beneficiaryAuthority !== undefined
        ? { beneficiaryAuthority: payload.beneficiaryAuthority }
        : {}),
      ...(payload.requestedEffect !== undefined ? { requestedEffect: payload.requestedEffect } : {}),
      ...(payload.previousRequestId !== undefined
        ? { previousRequestId: payload.previousRequestId }
        : {}),
      ...(payload.mutationProposalFingerprint !== undefined
        ? { mutationProposalFingerprint: payload.mutationProposalFingerprint }
        : {}),
    }
  }

  function toAbandonmentRecord(
    entry: LedgerEntry,
    payload: AbandonmentPayload,
  ): ControlAbandonmentRecord {
    return {
      requestId: payload.requestId,
      rootSessionId: payload.rootSessionId,
      abandonedAt: payload.abandonedAt,
      abandonmentSequence: entry.sequence,
      ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
    }
  }

  function toDecisionRecord(entry: LedgerEntry, payload: DecisionPayload): ControlDecisionRecord {
    return {
      requestId: payload.requestId,
      decision: payload.decision,
      decider: payload.decider,
      scope: payload.scope,
      requestSequence: payload.requestSequence,
      decisionSequence: entry.sequence,
      createdAt: entry.createdAt,
      ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
      ...(payload.note !== undefined ? { note: payload.note } : {}),
      ...(payload.terminalReason !== undefined
        ? { terminalReason: payload.terminalReason }
        : {}),
    }
  }

  function toConsumptionRecord(
    entry: LedgerEntry,
    payload: ConsumptionPayload,
  ): ControlConsumptionRecord {
    return {
      requestId: payload.requestId,
      decisionSequence: payload.decisionSequence,
      scope: payload.scope,
      consumedAt: payload.consumedAt,
    }
  }

  /** The durable ref of a resolved caller (lossless JSON). */
  function callerRefOf(caller: ResolvedCaller): ControlCallerRef {
    if (caller.role === 'human') {
      return { kind: 'human', humanId: caller.humanId ?? '' }
    }
    const member = caller.callerMember
    if (member === undefined) {
      // An internal invariant (a programming error, never caller-reachable):
      // an instance caller always resolves WITH its member record.
      throw new Error('control: an instance caller without a member record (internal invariant)')
    }
    return { kind: 'instance', instanceId: String(member.instanceId), role: caller.role }
  }

  /** Record one durable decision row (BEFORE any effect; the row IS the
   *  durable decision). */
  async function commitDecision(args: {
    readonly requestId: string
    readonly value: ControlDecisionValue
    readonly decider: ControlCallerRef
    readonly scope: ControlOperationScope
    readonly requestSequence: number
    readonly reason?: ControlDecisionReason
    readonly note?: string
    /** Alpha.4 A4-PR3 (ADR A2-8): WHY a close the reviewer did not choose
     *  happened. Additive: the VALUE of a terminal close is a `deny` either
     *  way, so an absent field is a reviewer-chosen close. */
    readonly terminalReason?: ControlLegTerminalReason
  }): Promise<ControlDecisionRecord> {
    const decisionScopeSubject = resolveSubject(args.scope)
    if (decisionScopeSubject === undefined) {
      // The decision scope snapshot must carry the canonical subject
      // (pre-alpha3 PR-D, D.2) — a scope with no identity element is
      // malformed input (fail closed; the commit never happens).
      throw new ControlError(
        CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
        'ControlService: the decision scope snapshot carries no subject (field: scope.subject)',
        { stage: 'decision', field: 'scope.subject' },
      )
    }
    const payload: Record<string, unknown> = {
      requestId: args.requestId,
      decision: args.value,
      decider: args.decider,
      scope: {
        rootSessionId: args.scope.rootSessionId,
        subject: decisionScopeSubject,
        ...(args.scope.targetInstanceId !== undefined
          ? { targetInstanceId: args.scope.targetInstanceId }
          : {}),
        actionName: args.scope.actionName,
        correlation: args.scope.correlation,
        ...(args.scope.toolName !== undefined ? { toolName: args.scope.toolName } : {}),
        ...(args.scope.capabilityDomain !== undefined
          ? { capabilityDomain: args.scope.capabilityDomain }
          : {}),
        ...(args.scope.operationFingerprint !== undefined
          ? { operationFingerprint: args.scope.operationFingerprint }
          : {}),
        // A4-PR7 Task 7.0 (ADR A1-14): the decision snapshot carries the
        // AUTHORITY point of the row it decides. Projected field-by-field like
        // every other member (this writer never passes the object through), so
        // omitting it here would silently drop the fact the consumption-point
        // recheck reads — and would make every v3 guard refuse with
        // `scope-mismatch`, since the guarded scope names a point the snapshot
        // lost.
        ...(args.scope.authorityScope !== undefined
          ? { authorityScope: args.scope.authorityScope }
          : {}),
      },
      requestSequence: args.requestSequence,
      ...(args.reason !== undefined ? { reason: args.reason } : {}),
      ...(args.note !== undefined ? { note: args.note } : {}),
      ...(args.terminalReason !== undefined ? { terminalReason: args.terminalReason } : {}),
    }
    const sequence = await putEntry({
      schemaVersion: 2,
      sequence: await allocateSequence(),
      rootSessionId: args.scope.rootSessionId,
      factType: FACT_DECISION,
      payload,
      createdAt: options.now(),
    })
    const record: ControlDecisionRecord = {
      requestId: args.requestId,
      decision: args.value,
      decider: args.decider,
      scope: args.scope,
      requestSequence: args.requestSequence,
      decisionSequence: sequence,
      createdAt: options.now(),
      ...(args.reason !== undefined ? { reason: args.reason } : {}),
      ...(args.note !== undefined ? { note: args.note } : {}),
      ...(args.terminalReason !== undefined ? { terminalReason: args.terminalReason } : {}),
    }
    return record
  }

  /**
   * The leg dimension of a request row, as the writers see it (Alpha.4
   * A4-PR3). A row WITHOUT these fields is a pre-Alpha.4 request and stays
   * byte-identical; a row WITH them belongs to an approval case, and the
   * four required members are exactly the frozen identity a leg must carry
   * (case id, ordinal, current reviewer, the authority that was required when
   * the case opened, plus who it benefits and for what effect).
   */
  interface LegFields {
    readonly approvalCaseId: string
    readonly legOrdinal: number
    readonly reviewAuthority: ProposalAuthorityPosition
    readonly requiredAuthorityAtCreation: ProposalAuthorityPosition
    readonly previousRequestId?: string
    readonly beneficiaryAuthority: ProposalAuthorityPosition
    readonly requestedEffect: PermissionOverlayEffect
    readonly mutationProposalFingerprint?: string
    /**
     * A4-PR7 Task 7.0 (ADR A1-14): the concrete authority point of an
     * OPERATION case. Writer-side only — it rides the durable row but NOT the
     * projected `ControlRequestRecord`, because the remote v7 DTO is frozen and
     * an approval-case field must not leak into an older wire.
     */
    readonly authorityScope?: ControlAuthorityScope
  }

  /**
   * The leg KEY inside a scope key (spec 11.3). The legs of one case share a
   * scope — same subject, action, correlation and fingerprint — so the leg
   * ordinal must join the identity of the request row, or leg 2 would collide
   * with leg 1 and the retry would hand back the SUPERSEDED leg. A row with no
   * case has the empty key, which is what keeps every pre-Alpha.4 request id
   * byte-identical.
   */
  function legKeyOf(value: {
    readonly approvalCaseId?: string
    readonly legOrdinal?: number
  }): string {
    return value.approvalCaseId === undefined
      ? ''
      : `${value.approvalCaseId}\u0000${value.legOrdinal ?? 0}`
  }

  /**
   * The leg fields as a writer spreads them (into a durable payload or into
   * the record it returns). ABSENT stays ABSENT — a legless request writes
   * exactly the pre-Alpha.4 row, and the one writer is what keeps the payload
   * and the record from disagreeing about which fields exist.
   */
  function legFieldsOf(leg: LegFields | undefined): Partial<ControlRequestRecord> {
    if (leg === undefined) return {}
    return {
      approvalCaseId: leg.approvalCaseId,
      legOrdinal: leg.legOrdinal,
      reviewAuthority: leg.reviewAuthority,
      requiredAuthorityAtCreation: leg.requiredAuthorityAtCreation,
      ...(leg.previousRequestId !== undefined ? { previousRequestId: leg.previousRequestId } : {}),
      beneficiaryAuthority: leg.beneficiaryAuthority,
      requestedEffect: leg.requestedEffect,
      ...(leg.mutationProposalFingerprint !== undefined
        ? { mutationProposalFingerprint: leg.mutationProposalFingerprint }
        : {}),
    }
  }

  // --- requestControl ------------------------------------------------------------------

  async function requestControl(args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly kind: ControlRequestKind
    readonly subject?: ControlSubject
    readonly targetInstanceId?: string
    readonly actionName: string
    readonly toolName?: string
    readonly capabilityDomain?: CapabilityName
    readonly correlation: string
    readonly operationFingerprint?: string
    readonly summary?: string
    readonly reviewPayload?: RemoteSafeJsonValue
    readonly reviewPayloadDigest?: string
    readonly executionCoupling?: ControlExecutionCoupling
    /** Alpha.4 A4-PR3: the approval-case leg this row IS. ABSENT for every
     *  pre-Alpha.4 caller — the legacy path is untouched. */
    readonly leg?: LegFields
  }): Promise<ControlRequestRecord> {
    const root = parseRoot(args.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'request')
    if (!isActionCaller(args.caller)) {
      throw malformed('request', 'caller', 'caller must be {kind:human,humanId} or {kind:instance,instanceId}')
    }
    if (!CONTROL_REQUEST_KIND_VALUES.includes(args.kind)) {
      throw malformed('request', 'kind', `unknown control request kind ${JSON.stringify(args.kind)}`)
    }
    if (typeof args.actionName !== 'string' || args.actionName.length === 0) {
      throw malformed('request', 'actionName', 'actionName must be a non-empty string')
    }
    if (typeof args.correlation !== 'string' || args.correlation.length === 0) {
      throw malformed('request', 'correlation', 'correlation must be a non-empty string')
    }
    if (args.toolName !== undefined && (typeof args.toolName !== 'string' || args.toolName.length === 0)) {
      throw malformed('request', 'toolName', 'toolName must be a non-empty string when present')
    }
    if (
      args.operationFingerprint !== undefined &&
      (typeof args.operationFingerprint !== 'string' || args.operationFingerprint.length === 0)
    ) {
      throw malformed('request', 'operationFingerprint', 'operationFingerprint must be a non-empty string when present')
    }
    if (
      args.capabilityDomain !== undefined &&
      !CAPABILITY_NAME_VALUES.includes(args.capabilityDomain)
    ) {
      throw malformed('request', 'capabilityDomain', `capabilityDomain outside the closed set: ${JSON.stringify(args.capabilityDomain)}`)
    }
    if (args.summary !== undefined && typeof args.summary !== 'string') {
      throw malformed('request', 'summary', 'summary must be a string when present')
    }
    // Subject normalization (pre-alpha3 PR-D, D.2): the canonical identity
    // is the closed three-kind subject. An EXPLICIT subject must be well
    // formed; a present targetInstanceId must be ABSENT or agree with an
    // explicit instance subject; with NO explicit subject the
    // targetInstanceId (required, non-empty) IS the legacy instance
    // identity (byte-identical normalization for old callers).
    let subject: ControlSubject
    if (args.subject !== undefined) {
      const parsedSubject = parseSubject(args.subject)
      if (parsedSubject === undefined) {
        throw malformed(
          'request',
          'subject',
          `subject must be {kind:'instance',instanceId} | {kind:'template',templateId} | {kind:'team',rootSessionId} (got ${JSON.stringify(args.subject)})`,
        )
      }
      subject = parsedSubject
      if (
        args.targetInstanceId !== undefined &&
        (parsedSubject.kind !== CONTROL_SUBJECT_KINDS.INSTANCE ||
          parsedSubject.instanceId !== args.targetInstanceId)
      ) {
        throw malformed(
          'request',
          'targetInstanceId',
          'a present targetInstanceId must agree with an explicit instance subject (the legacy projection of the subject)',
        )
      }
    } else {
      if (typeof args.targetInstanceId !== 'string' || args.targetInstanceId.length === 0) {
        throw malformed(
          'request',
          'targetInstanceId',
          'targetInstanceId (or an explicit subject) is required: the legacy instance addressing is mandatory when no subject is given',
        )
      }
      subject = { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: args.targetInstanceId }
    }
    // Review-payload checks (pre-alpha3 PR-D, D.3): ABSENT = legacy
    // semantics; a present value must be valid lossless JSON; the digest
    // requires a present payload; the coupling is a closed set.
    if (args.reviewPayload !== undefined && !isRemoteSafeJsonValue(args.reviewPayload)) {
      throw malformed(
        'request',
        'reviewPayload',
        'reviewPayload must be lossless JSON (a RemoteSafeJsonValue) when present',
      )
    }
    if (
      args.reviewPayloadDigest !== undefined &&
      (typeof args.reviewPayloadDigest !== 'string' || args.reviewPayloadDigest.length === 0)
    ) {
      throw malformed(
        'request',
        'reviewPayloadDigest',
        'reviewPayloadDigest must be a non-empty string when present',
      )
    }
    if (args.reviewPayloadDigest !== undefined && args.reviewPayload === undefined) {
      throw malformed(
        'request',
        'reviewPayloadDigest',
        'reviewPayloadDigest requires a present reviewPayload (a digest of a payload the request does not carry is ambiguous input)',
      )
    }
    if (
      args.executionCoupling !== undefined &&
      !CONTROL_EXECUTION_COUPLING_VALUES.includes(args.executionCoupling)
    ) {
      throw malformed(
        'request',
        'executionCoupling',
        `executionCoupling outside the closed set (guarded|inline): ${JSON.stringify(args.executionCoupling)}`,
      )
    }
    // A4-PR7 Task 7.0: a leg that names an authority point must name a
    // CONCRETE one. Checked at the boundary rather than at the write because a
    // row the strict reader would later refuse is a row that must never reach
    // the ledger.
    if (
      args.leg?.authorityScope !== undefined &&
      !isControlAuthorityScope(args.leg.authorityScope)
    ) {
      throw malformed(
        'request',
        'authorityScope',
        'authorityScope must be {operationClass, matcher: {kind: exact|fingerprint, resource}} with every member a non-empty string (a region-shaped matcher is never persistable)',
      )
    }

    // Reused authority steps (the facade's typed codes surface as-is):
    // (1) caller identity/role; (2) team + target resolution (INSTANCE
    // subjects ONLY — a template/team subject resolves the team without a
    // target and is NEVER killed by the instance stale validator); (3)
    // request-time staleness (instance subjects only); (4) envelope.
    const caller = resolveCaller(repositories, root, args.caller)
    const resolved = resolveTeamAndTarget(
      repositories,
      options.blueprintCatalog,
      {
        rootSessionId: root,
        action: ACTION_NAMES.REQUEST_CONTROL,
        caller: args.caller,
        ...(subject.kind === CONTROL_SUBJECT_KINDS.INSTANCE
          ? { targetInstanceId: subject.instanceId }
          : {}),
        requestToken: args.correlation,
      },
      REQUEST_CONTROL_SPEC,
    )
    // Subject-specific existence validation (pre-alpha3 PR-D, D.2): the
    // instance staleness check below applies to instance subjects ONLY.
    if (subject.kind === CONTROL_SUBJECT_KINDS.TEAM) {
      if (subject.rootSessionId !== root) {
        throw malformed(
          'request',
          'subject',
          'a team subject must name THIS team (subject.rootSessionId !== rootSessionId)',
        )
      }
    } else if (subject.kind === CONTROL_SUBJECT_KINDS.TEMPLATE) {
      const blueprint = resolved.bound.blueprint
      const knownTemplates = [
        blueprint.leader.templateId,
        ...blueprint.members.map((m) => m.templateId),
      ]
      if (!knownTemplates.some((t) => t === subject.templateId)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
          `ControlService: template subject not in the bound team blueprint (no row written)`,
          { stage: 'request', field: 'subject', templateId: subject.templateId },
        )
      }
    }
    if (subject.kind === CONTROL_SUBJECT_KINDS.INSTANCE) {
      const target = resolved.target
      const targetLifecycle = target !== undefined ? String(target.lifecycle) : undefined
      if (targetLifecycle === TERMINAL_LIFECYCLE) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_TARGET_STALE,
          `ControlService: target instance is ${targetLifecycle} (terminal) — a control request can never become valid (no row written)`,
          {
            rootSessionId: root,
            targetInstanceId: subject.instanceId,
            lifecycle: targetLifecycle,
          },
        )
      }
    }
    enforceEnvelope(
      REQUEST_CONTROL_SPEC,
      callerEnvelope(resolved.bound.blueprint, caller, repositories.overrides.list(root)),
    )

    const outcome = await withTeamLock(teamLocks, root, async (): Promise<{
      readonly record: ControlRequestRecord
      readonly created: boolean
    }> => {
      const state = loadControlState(root)
      const key = scopeKey(
        root,
        subjectIdentityOf(subject),
        args.actionName,
        args.toolName,
        args.correlation,
        args.operationFingerprint,
      )
      // Alpha.4 A4-PR3 (spec 11.3): the leg joins the idempotency key, so a
      // retry of leg 1 returns leg 1 and leg 2 is a NEW row rather than a
      // collision on the case's first request id.
      const legKey = legKeyOf(args.leg ?? {})
      const existing = state.requests.find(
        (r) =>
          scopeKey(
            String(r.entry.rootSessionId),
            subjectIdentityOf(r.payload.subject),
            r.payload.actionName,
            r.payload.toolName,
            r.payload.correlation,
            r.payload.operationFingerprint,
          ) === key && legKeyOf(r.payload) === legKey,
      )
      if (existing !== undefined) {
        // Idempotent: the same logical request returns its EXISTING row
        // (regardless of requester; a decided row says `decided` — a new
        // attempt needs a new correlation). An existing row NEVER
        // re-notifies (C1: the liveness hint is for newly-created rows
        // only — the pending-list tool is the recovery path).
        return { record: toRequestRecord(existing.entry, existing.payload, state), created: false }
      }
      const requestId = requestIdOf(legKey === '' ? key : `${key}\u0000${legKey}`)
      const requester = callerRefOf(caller)
      const payload: Record<string, unknown> = {
        requestId,
        kind: args.kind,
        requester,
        subject,
        ...(subject.kind === CONTROL_SUBJECT_KINDS.INSTANCE
          ? { targetInstanceId: subject.instanceId }
          : {}),
        actionName: args.actionName,
        correlation: args.correlation,
        ...(args.toolName !== undefined ? { toolName: args.toolName } : {}),
        ...(args.capabilityDomain !== undefined
          ? { capabilityDomain: args.capabilityDomain }
          : {}),
        ...(args.operationFingerprint !== undefined
          ? { operationFingerprint: args.operationFingerprint }
          : {}),
        ...(args.summary !== undefined ? { summary: args.summary } : {}),
        ...(args.reviewPayload !== undefined ? { reviewPayload: args.reviewPayload } : {}),
        ...(args.reviewPayloadDigest !== undefined
          ? { reviewPayloadDigest: args.reviewPayloadDigest }
          : {}),
        ...(args.executionCoupling !== undefined
          ? { executionCoupling: args.executionCoupling }
          : {}),
        ...legFieldsOf(args.leg),
        // The authority point rides the DURABLE row only (see LegFields):
        // `legFieldsOf` is the shared payload/record spread, and the projected
        // record must not gain a field the frozen v7 DTO does not carry.
        ...(args.leg?.authorityScope !== undefined
          ? { authorityScope: args.leg.authorityScope }
          : {}),
      }
      const sequence = await putEntry({
        schemaVersion: 2,
        sequence: await allocateSequence(),
        rootSessionId: root,
        factType: FACT_REQUEST,
        payload,
        createdAt: options.now(),
      })
      return {
        record: {
          requestId,
          rootSessionId: root,
          kind: args.kind,
          requester,
          subject,
          ...(subject.kind === CONTROL_SUBJECT_KINDS.INSTANCE
            ? { targetInstanceId: subject.instanceId }
            : {}),
          actionName: args.actionName,
          correlation: args.correlation,
          status: 'pending',
          createdAt: options.now(),
          requestSequence: sequence,
          ...(args.toolName !== undefined ? { toolName: args.toolName } : {}),
          ...(args.capabilityDomain !== undefined
            ? { capabilityDomain: args.capabilityDomain }
            : {}),
          ...(args.operationFingerprint !== undefined
            ? { operationFingerprint: args.operationFingerprint }
            : {}),
          ...(args.summary !== undefined ? { summary: args.summary } : {}),
          ...(args.reviewPayload !== undefined ? { reviewPayload: args.reviewPayload } : {}),
          ...(args.reviewPayloadDigest !== undefined
            ? { reviewPayloadDigest: args.reviewPayloadDigest }
            : {}),
          ...(args.executionCoupling !== undefined
            ? { executionCoupling: args.executionCoupling }
            : {}),
          ...legFieldsOf(args.leg),
        },
        created: true,
      }
    })

    // C1 (leader-approval reachability) — the Leader LIVENESS
    // notification, after the per-team lock is released and ONLY for a
    // newly-created durable `leader-approval` request:
    // - AFTER the lock (withTeamLock has resolved — its chain entry has
    //   settled), so a reentrant `resolveControl` (e.g. the Leader
    //   deciding inside the notification turn) acquires the lock without
    //   waiting on the request path: the notification NEVER runs inside
    //   the critical section (no self-deadlock);
    // - fire-and-forget (NOT awaited here): `requestControl` returns as
    //   soon as the durable row is committed and returnable, so the
    //   member's `awaitControlDecision` polling starts without waiting
    //   for the notification's Leader model turn to drain. In the
    //   synchronous-delegation topology the Leader can be busy INSIDE the
    //   very work unit that produced this request — awaiting the
    //   delivery here would form a cross-session wait cycle (member →
    //   requestControl → Leader idle → Leader turn → the same work unit)
    //   that only the human resolver could break; the known scheduling
    //   limitation (queued delivery while the Leader is busy) is the
    //   plan §5 characterization, documented, not a deadlock of the
    //   request path itself;
    // - a delivery failure is a LIVENESS failure only: no rollback, no
    //   fake decision, no implicit allow — the durable row stands, and
    //   the pending-list tool + the GUI remain the recovery paths.
    //   A fault is reported to the optional diagnostic sink whether it
    //   arrives as a REJECTED promise (the async port) or SYNCHRONOUSLY
    //   (a port implementation that throws before returning a promise —
    //   `Promise.resolve(...)` normalizes a missing/undefined return
    //   too); the request path itself never sees the fault.
    if (outcome.created && outcome.record.kind === CONTROL_REQUEST_KINDS.LEADER_APPROVAL) {
      const port = options.requestNotification
      if (port !== undefined) {
        try {
          const pending = port.notifyLeaderRequest(outcome.record)
          void Promise.resolve(pending).catch((error: unknown) => {
            reportNotificationFailure(outcome.record, error)
          })
        } catch (error) {
          // the port threw synchronously (no promise was returned):
          // same liveness-failure reporting, request path untouched
          reportNotificationFailure(outcome.record, error)
        }
      }
    }
    return outcome.record
  }

  // --- resolveControl ------------------------------------------------------------------

  async function resolveControl(args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly requestId: string
    readonly decision: 'allow' | 'deny'
    readonly note?: string
  }): Promise<ControlDecisionRecord> {
    const root = parseRoot(args.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'resolve')
    if (!isActionCaller(args.caller)) {
      throw malformed('resolve', 'caller', 'caller must be {kind:human,humanId} or {kind:instance,instanceId}')
    }
    if (typeof args.requestId !== 'string' || args.requestId.length === 0) {
      throw malformed('resolve', 'requestId', 'requestId must be a non-empty string')
    }
    if (args.decision !== 'allow' && args.decision !== 'deny') {
      throw malformed('resolve', 'decision', `decision must be 'allow' or 'deny' (got ${JSON.stringify(args.decision)})`)
    }
    if (args.note !== undefined && typeof args.note !== 'string') {
      throw malformed('resolve', 'note', 'note must be a string when present')
    }

    // Reused authority steps: (1) caller; (2) team + blueprint resolution
    // (the decision is addressed to the REQUEST — no target token).
    const caller = resolveCaller(repositories, root, args.caller)
    const resolved = resolveTeamAndTarget(
      repositories,
      options.blueprintCatalog,
      {
        rootSessionId: root,
        action: ACTION_NAMES.RESOLVE_CONTROL,
        caller: args.caller,
        requestToken: args.requestId,
      },
      RESOLVE_CONTROL_SPEC,
    )

    return withTeamLock(teamLocks, root, async () => {
      const state = loadControlState(root)
      const request = state.requests.find((r) => r.payload.requestId === args.requestId)
      if (request === undefined) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND,
          `ControlService: no durable control request '${args.requestId}' in team '${root}' (a decision without a request)`,
          { rootSessionId: root, requestId: args.requestId },
        )
      }
      // Abandonment (pre-alpha3 PR-D, D.4): the durable abandon fact is
      // the TERMINAL mark (like `stale-denied`) — checked BEFORE the
      // decided check, with ZERO durable side effects (no decision row
      // is written): an abandoned request can never become an allow.
      if (state.abandonments.some((a) => a.payload.requestId === args.requestId)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
          `ControlService: request '${args.requestId}' is durably abandoned (the terminal mark — it can never become an allow; zero durable side effects)`,
          { rootSessionId: root, requestId: args.requestId },
        )
      }
      if (state.decisions.some((d) => d.payload.requestId === args.requestId)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED,
          `ControlService: request '${args.requestId}' already carries a durable decision (the first decision is authoritative)`,
          { rootSessionId: root, requestId: args.requestId },
        )
      }
      // Role closure (BEFORE the envelope — invariant 37: a member is
      // never a resolver, even with the resolve-control op; the
      // user-approval kind admits only the human).
      const allowedRoles = CONTROL_RESOLVER_ROLES[request.payload.kind]
      if (!allowedRoles.includes(caller.role)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
          `ControlService: role '${caller.role}' is not a resolver for kind '${request.payload.kind}' (allowed: [${allowedRoles.join(', ')}])`,
          {
            rootSessionId: root,
            requestId: args.requestId,
            kind: request.payload.kind,
            role: caller.role,
            allowedRoles: [...allowedRoles],
          },
        )
      }
      // Alpha.4 A4-PR3 (spec 21.5, 24.5; fidelity review #1) — the DECISION
      // entrance carries the case law the escalate entrance carries: a
      // principal who already acted on an earlier leg of this case may not
      // decide a later one. Checked BEFORE the envelope, so a refusal needs no
      // authority the caller already used to reach this point, and it writes
      // nothing. A pre-Alpha.4 row (no case id) is untouched by it.
      const caseIdOfLeg = request.payload.approvalCaseId
      if (caseIdOfLeg !== undefined) {
        assertNoActOnEarlierLeg(state, {
          root,
          stage: 'resolveControl',
          requestId: args.requestId,
          approvalCaseId: caseIdOfLeg,
          legOrdinal: request.payload.legOrdinal ?? 0,
          decider: callerRefOf(caller),
        })
      }
      // Envelope (the resolve-control op; a human is not envelope-bound).
      enforceEnvelope(
        RESOLVE_CONTROL_SPEC,
        callerEnvelope(resolved.bound.blueprint, caller, repositories.overrides.list(root)),
      )
      // Resolve-time staleness (durable stale-denied FIRST, then throw).
      // INSTANCE subjects ONLY (pre-alpha3 PR-D, D.2): the instance
      // stale validator branches on the subject kind — a template or
      // team subject has no instance lifecycle, so it is NEVER killed
      // by this check (the key negative of the generalization).
      const isInstanceSubject =
        request.payload.subject.kind === CONTROL_SUBJECT_KINDS.INSTANCE
      let target: MemberInstanceRecordDto | undefined
      let targetLifecycle: string | undefined
      if (isInstanceSubject) {
        target = repositories.memberInstances.get(root, request.payload.subject.instanceId)
        targetLifecycle = target !== undefined ? String(target.lifecycle) : undefined
      }
      if (
        isInstanceSubject &&
        (target === undefined || targetLifecycle === TERMINAL_LIFECYCLE)
      ) {
        const scope = scopeOf(request.entry, request.payload)
        await commitDecision({
          requestId: request.payload.requestId,
          value: CONTROL_DECISION_VALUES.STALE_DENIED,
          decider: callerRefOf(caller),
          scope,
          requestSequence: request.entry.sequence,
        })
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_STALE,
          `ControlService: request '${request.payload.requestId}' is stale — the target instance is ${target === undefined ? 'missing' : targetLifecycle} (recorded as stale-denied; it can never become an allow)`,
          {
            rootSessionId: root,
            requestId: request.payload.requestId,
            targetInstanceId: request.payload.subject.instanceId,
            lifecycle: targetLifecycle ?? 'missing',
          },
        )
      }
      // External hard policy (allow only — Architecture 25.4 / invariant
      // 34: no Team decision, human included, bypasses it).
      if (args.decision === 'allow') {
        const capabilityDomain =
          request.payload.capabilityDomain ??
          (request.payload.toolName !== undefined ? ('tools' as const) : undefined)
        if (capabilityDomain !== undefined) {
          const facts = await options.externalPolicyFacts()
          if (
            facts.capabilityExists[capabilityDomain] === false ||
            !hardCellAllows(facts.hard[capabilityDomain], request.payload.toolName)
          ) {
            const scope = scopeOf(request.entry, request.payload)
            await commitDecision({
              requestId: request.payload.requestId,
              value: CONTROL_DECISION_VALUES.DENY,
              decider: callerRefOf(caller),
              reason: 'external-policy',
              scope,
              requestSequence: request.entry.sequence,
            })
            throw new ControlError(
              CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED,
              `ControlService: allow impossible — the external hard policy denies capability '${capabilityDomain}' (recorded as deny with reason external-policy)`,
              {
                rootSessionId: root,
                requestId: request.payload.requestId,
                capabilityDomain,
                toolName: request.payload.toolName,
              },
            )
          }
        }
      }
      return await commitDecision({
        requestId: request.payload.requestId,
        value: args.decision === 'allow' ? CONTROL_DECISION_VALUES.ALLOW : CONTROL_DECISION_VALUES.DENY,
        decider: callerRefOf(caller),
        scope: scopeOf(request.entry, request.payload),
        requestSequence: request.entry.sequence,
        ...(args.note !== undefined ? { note: args.note } : {}),
      })
    })
  }

  /**
   * The SHARED durable terminal-mark write (pre-alpha3 PR-D, D.4): the
   * one routine that commits the `control-request-abandoned` fact.
   * `abandonControlRequest` (after its authority steps) and the
   * wait-bridge's inline-abort cascade (the inline lifecycle's
   * `abort → durable abandon/close → zero effect` node) both commit
   * through THIS routine — so exactly-once (an already-abandoned
   * request is rejected typed, zero durable side effects), the
   * terminal-mark payload shape ({requestId, rootSessionId, abandonedAt,
   * reason?}), and the storage-fault contract (a durable-store failure
   * surfaces as the facade's closed TEAM_RUNTIME_DURABLE_WRITE_FAILED —
   * the close is never claimed as abandoned unless the fact is durable)
   * are inherited by code reuse, not re-implementation.
   *
   * Precondition: the caller holds the per-team lock (withTeamLock);
   * the re-read below is the lock's fresh-state verification (invariant
   * 45: the durable rows are the authority).
   */
  async function commitAbandonmentFact(
    root: string,
    requestId: string,
    reason?: string,
  ): Promise<{ readonly abandonmentSequence: number; readonly abandonedAt: string }> {
    const state = loadControlState(root)
    const request = state.requests.find((r) => r.payload.requestId === requestId)
    if (request === undefined) {
      throw new ControlError(
        CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND,
        `ControlService: no durable control request '${requestId}' in team '${root}' (an abandon without a request)`,
        { rootSessionId: root, requestId },
      )
    }
    // The terminal mark is written exactly once: an already-abandoned
    // request is rejected (zero durable side effects — no second fact).
    if (state.abandonments.some((a) => a.payload.requestId === requestId)) {
      throw new ControlError(
        CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
        `ControlService: request '${requestId}' is already durably abandoned (the terminal mark is written exactly once)`,
        { rootSessionId: root, requestId },
      )
    }
    // The append-only ledger has no delete primitive — the row IS the
    // close (commit-before-ack).
    const payload: Record<string, unknown> = {
      requestId,
      rootSessionId: root,
      abandonedAt: options.now(),
      ...(reason !== undefined ? { reason } : {}),
    }
    const sequence = await putEntry({
      schemaVersion: 2,
      sequence: await allocateSequence(),
      rootSessionId: root,
      factType: FACT_ABANDONMENT,
      payload,
      createdAt: options.now(),
    })
    return { abandonmentSequence: sequence, abandonedAt: payload['abandonedAt'] as string }
  }

  // --- abandonControlRequest (pre-alpha3 PR-D, D.4 — the inline abort path) -------------

  /**
   * Durably ABANDON one control request (the additive close fact
   * `control-request-abandoned` — the terminal mark; the append-only
   * ledger has no delete primitive, so the request row is never
   * physically removed).
   *
   * Authority steps: (1) caller identity/role (the reused facade
   * `resolveCaller` — a stale caller can never close); (2) team
   * existence (typed TEAM_SESSION_NOT_FOUND — the close addresses the
   * team's durable request rows); (3) the CONTROL INTERNAL close
   * authority {@link mayAbandon} (pre-alpha3 review F3: human → any
   * request, Leader → any of the current Team's requests, member →
   * its OWN request only).
   *
   * The close authority is INDEPENDENT of the `resolve-control`
   * mutation envelope (review F3 — the PR-D defect): abandon no longer
   * reuses `RESOLVE_CONTROL_SPEC` or performs any envelope check, and
   * the bound blueprint is never consulted. A caller that may REQUEST
   * a review (e.g. the Recovery Leader of a reduced team envelope that
   * carries `request-control` but not `resolve-control`) can always
   * ABANDON its own waiting review; closing does not need the op the
   * decision needs. No new Team tool permission or mutation op is
   * exposed — the rule is enforced inside this service over the
   * already-resolved caller.
   *
   * The durable abandon fact is written BEFORE any return
   * (commit-before-ack); the request is NEVER physically removed. A
   * durable-store failure of that write surfaces as the facade's
   * closed effect-phase code TEAM_RUNTIME_DURABLE_WRITE_FAILED — the
   * close is NEVER claimed as abandoned unless the fact is durable
   * (the frozen contract the recovery dispatch consuming this call
   * relies on, review F2).
   */
  async function abandonControlRequest(args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly requestId: string
    readonly reason?: string
  }): Promise<ControlAbandonmentRecord> {
    const root = parseRoot(args.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'abandon')
    if (!isActionCaller(args.caller)) {
      throw malformed('abandon', 'caller', 'caller must be {kind:human,humanId} or {kind:instance,instanceId}')
    }
    if (typeof args.requestId !== 'string' || args.requestId.length === 0) {
      throw malformed('abandon', 'requestId', 'requestId must be a non-empty string')
    }
    if (args.reason !== undefined && typeof args.reason !== 'string') {
      throw malformed('abandon', 'reason', 'reason must be a string when present')
    }

    // Authority steps: (1) caller identity/role (a stale caller can
    // never close); (2) team existence. The abandon is addressed to the
    // REQUEST (no target token) and needs NO bound blueprint and NO
    // mutation envelope — the close authority is the control-internal
    // mayAbandon rule (pre-alpha3 review F3).
    const caller = resolveCaller(repositories, root, args.caller)
    if (repositories.teamSessions.get(root) === undefined) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
        `ControlService: no TeamSession record for root session '${root}'`,
        { rootSessionId: root },
      )
    }

    return withTeamLock(teamLocks, root, async () => {
      const state = loadControlState(root)
      const request = state.requests.find((r) => r.payload.requestId === args.requestId)
      if (request === undefined) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND,
          `ControlService: no durable control request '${args.requestId}' in team '${root}' (an abandon without a request)`,
          { rootSessionId: root, requestId: args.requestId },
        )
      }
      // The terminal mark is written exactly once: an already-abandoned
      // request is rejected (zero durable side effects).
      if (state.abandonments.some((a) => a.payload.requestId === args.requestId)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
          `ControlService: request '${args.requestId}' is already durably abandoned (the terminal mark is written exactly once)`,
          { rootSessionId: root, requestId: args.requestId },
        )
      }
      // The CONTROL INTERNAL close authority (pre-alpha3 review F3 —
      // mayAbandon, independent of the resolve-control envelope):
      // human → any request; Leader → any of the current Team's
      // requests; member → its OWN request only. (A DECIDED request may
      // still be abandoned: that is the allow-invalidating path — the
      // abandon closes the durable allow.)
      const requester = request.payload.requester
      if (!mayAbandon(requester, caller)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
          `ControlService: the caller may not abandon request '${args.requestId}' (the control-internal close authority: human → any, leader → any of the current Team's, member → its own only)`,
          {
            rootSessionId: root,
            requestId: args.requestId,
            role: caller.role,
            requester,
          },
        )
      }
      // The durable abandon fact FIRST (commit-before-ack; the append-
      // only ledger has no delete primitive — the row IS the close) —
      // through the SHARED terminal-mark write path: the wait-bridge
      // inline-abort cascade commits through the same routine, so the
      // exactly-once re-verification and the storage-fault contract are
      // inherited by code reuse (not re-implementation).
      const mark = await commitAbandonmentFact(root, args.requestId, args.reason)
      return {
        requestId: request.payload.requestId,
        rootSessionId: root,
        abandonedAt: mark.abandonedAt,
        abandonmentSequence: mark.abandonmentSequence,
        ...(args.reason !== undefined ? { reason: args.reason } : {}),
      }
    })
  }

  // --- listControlState ----------------------------------------------------------------

  async function listControlState(rootSessionId: string): Promise<{
    readonly requests: readonly ControlRequestRecord[]
    readonly decisions: readonly ControlDecisionRecord[]
    readonly consumptions: readonly ControlConsumptionRecord[]
    readonly abandonments: readonly ControlAbandonmentRecord[]
  }> {
    const root = parseRoot(rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'list')
    return withTeamLock(teamLocks, root, async () => {
      if (repositories.teamSessions.get(root) === undefined) {
        throw new TeamRuntimeError(
          TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
          `ControlService: no TeamSession record for root session '${root}'`,
          { rootSessionId: root },
        )
      }
      const state = loadControlState(root)
      return {
        requests: state.requests.map((r) => toRequestRecord(r.entry, r.payload, state)),
        decisions: state.decisions.map((d) => toDecisionRecord(d.entry, d.payload)),
        consumptions: state.consumptions.map((c) => toConsumptionRecord(c.entry, c.payload)),
        abandonments: state.abandonments.map((a) => toAbandonmentRecord(a.entry, a.payload)),
      }
    })
  }

  // --- checkExternalOperation (the A2C-4 shared read-only external check) --------------

  /**
   * A2C-4 (alpha.2 plan §6.3) — the SHARED READ-ONLY external hard check:
   * the last-mile recheck of the LIVE external hard policy, built over
   * the SAME `options.externalPolicyFacts()` port and the SAME
   * hard-cell semantics as the resolve-time probe (`hardCellAllows` —
   * one evaluator, never a second hard policy implementation):
   *
   * - domain derivation mirrors resolveControl: the explicit
   *   `capabilityDomain` when present, else `tools` when a `toolName` is
   *   named, else NO cell (an operation that names no capability domain
   *   is not probed — the Team-owned admission that gated it is the
   *   whole check; the facts port is never even consulted);
   * - an ABSENT cell = "no host restriction" (allowed);
   * - a hard `deny` refuses; a hard allow-list must NAME the operation's
   *   tool (an unnamed tool matches no item — refused);
   * - an explicit `capabilityExists: false` refuses;
   * - FAIL CLOSED and NEVER THROWS: a thrown facts probe or a malformed
   *   facts shape is a deny verdict (invariant 34: no Team decision,
   *   human included, bypasses the external hard policy);
   * - READ-ONLY: no durable row is written, regardless of the verdict.
   *
   * Callers: the pre-execute adapter's static-allow path (before the
   * authorized-execution mark) and `guardOperation` itself (before the
   * allow-consumption write — a tightened cell blocks WITHOUT consuming
   * the one-shot allow).
   */
  async function checkExternalOperation(input: {
    readonly capabilityDomain?: CapabilityName
    readonly toolName?: string
  }): Promise<ControlExternalVerdict> {
    // Fail closed on a malformed (non-closed-set) domain BEFORE any
    // derivation: a garbage domain must never read as "no cell".
    const explicitDomain = input.capabilityDomain
    if (
      explicitDomain !== undefined &&
      !(CAPABILITY_NAME_VALUES as readonly string[]).includes(String(explicitDomain))
    ) {
      return {
        allowed: false,
        reason: `the capability domain '${String(explicitDomain)}' is outside the closed set — fail closed`,
      }
    }
    const capabilityDomain =
      explicitDomain ?? (input.toolName !== undefined ? ('tools' as const) : undefined)
    if (capabilityDomain === undefined) {
      // No external cell applies to this operation (mirrors the
      // resolve-time probe skip — the facts port is never consulted).
      return { allowed: true }
    }
    let facts: ExternalPolicyFacts
    try {
      facts = await options.externalPolicyFacts()
    } catch (error: unknown) {
      // A throwing facts probe is a fail-closed deny, never an escape.
      return {
        allowed: false,
        reason: `the external policy facts probe failed (${
          error instanceof Error ? error.message : String(error)
        }) — fail closed`,
      }
    }
    try {
      if (facts.capabilityExists?.[capabilityDomain] === false) {
        return {
          allowed: false,
          reason: `capability '${capabilityDomain}' does not exist on the host (capabilityExists: false) — fail closed`,
        }
      }
      if (!hardCellAllows(facts.hard?.[capabilityDomain], input.toolName)) {
        return {
          allowed: false,
          reason: `the external hard policy denies capability '${capabilityDomain}' (the hard cell refuses the operation)`,
        }
      }
      return { allowed: true }
    } catch (error: unknown) {
      // A malformed facts shape is a fail-closed deny, never an escape.
      return {
        allowed: false,
        reason: `the external policy facts are malformed (${
          error instanceof Error ? error.message : String(error)
        }) — fail closed`,
      }
    }
  }

  // --- guardOperation (the tool-pipeline last-mile seam) -------------------------------

  /**
   * A1-14 (A4-PR7 Task 7.0): re-run the ceiling for the point the allow covers,
   * at the moment the allow would be spent.
   *
   * Called from `guardOperation` INSIDE the per-team lock, after the exact-scope
   * match and the live external recheck, and before the consumption fact. The
   * input is the DURABLE row and nothing else — the persisted authority point,
   * the rung that signed, the frozen beneficiary and the requested effect — so a
   * caller cannot present a friendlier scope to the recheck than it presented to
   * the match.
   *
   * WHO ANSWERS: the injected {@link ControlServiceOptions.authorityRevalidation}
   * port, implemented in the permission plane over the FRESHLY BOUND documents.
   * This service never reads a document and never walks a ladder (ADR A5-12: one
   * reader per answer; A3-2: who-may-review and what-the-ceiling-allows are
   * decided where the documents live). It consumes the closed verdict.
   *
   * EVERY fail-closed direction, each of which refuses with ZERO consumption:
   * no port at all, a port that throws, a verdict outside the closed vocabulary,
   * an operation case whose row carries no authority point (corrupt post-
   * cutover), and of course an `authority-risen` or `undetermined` answer.
   *
   * @param root - the team (root) session id.
   * @param row - the matched durable request row that would be consumed.
   * @returns the block reason, or `undefined` when the re-confirmation holds.
   */
  async function recheckConsumedAuthority(
    root: string,
    row: RequestPayload,
  ): Promise<ControlGuardBlockReason | undefined> {
    const reasons = CONTROL_GUARD_BLOCK_REASONS
    // A pre-Alpha.4 row (no case id) has no authority point by construction and
    // consumes exactly as it always did. So does an `envelope-mutation` case:
    // its ceiling question is the proposal's own region, which the mutation
    // lane revalidates inside its commit section — and an inline row never
    // reaches this function at all.
    if (row.approvalCaseId === undefined || row.operationFingerprint === undefined) {
      return undefined
    }
    if (row.authorityScope === undefined) return reasons.AUTHORITY_SCOPE_UNBOUND
    if (
      row.reviewAuthority === undefined ||
      row.beneficiaryAuthority === undefined ||
      row.requestedEffect === undefined
    ) {
      // Unreachable for a row the strict reader accepted (every one of these is
      // required on a leg); named rather than cast, because the alternative to
      // naming it is asserting an authority fact out of a missing field.
      return reasons.AUTHORITY_UNDETERMINED
    }
    if (row.subject.kind !== CONTROL_SUBJECT_KINDS.INSTANCE) {
      // The documents are read FOR a beneficiary instance; a template/team
      // subject has none, so the coverage question cannot be asked.
      return reasons.AUTHORITY_UNDETERMINED
    }
    const port = options.authorityRevalidation
    if (port === undefined) {
      // No port is not "no requirement": the guard would be spending an allow
      // it cannot confirm. A v3 operation approval is consumable only by a
      // composition that can answer for the authority behind it.
      return reasons.AUTHORITY_UNDETERMINED
    }
    let verdict: ControlAuthorityRecheck
    try {
      verdict = await port({
        rootSessionId: root,
        instanceId: row.subject.instanceId,
        beneficiaryAuthority: row.beneficiaryAuthority,
        reviewAuthority: row.reviewAuthority,
        requestedEffect: row.requestedEffect,
        authorityScope: row.authorityScope,
        // RULING 4: the row's command identity goes with the persisted point, so
        // the recheck derives the SAME candidate set the ask derived. Without it
        // a shell-class row arrives as the tool-level exact key ALONE — a shape
        // no shell rule can cover — and an authority rise on the command reads as
        // `still-sufficient`. The early return above guarantees a row reaching
        // here has one; it is passed verbatim rather than re-derived from the
        // invocation now arriving, which is the whole point of A1-14.
        commandFingerprint: row.operationFingerprint,
      })
    } catch {
      // A recheck that cannot run has not confirmed anything. The exception is
      // never re-thrown into the tool pipeline as if it were the operation's
      // own failure, and never read as a pass.
      return reasons.AUTHORITY_UNDETERMINED
    }
    switch (verdict.kind) {
      case CONTROL_AUTHORITY_RECHECK_KINDS.STILL_SUFFICIENT:
        return undefined
      case CONTROL_AUTHORITY_RECHECK_KINDS.AUTHORITY_RISEN:
        return reasons.AUTHORITY_RISEN
      case CONTROL_AUTHORITY_RECHECK_KINDS.UNDETERMINED:
        return reasons.AUTHORITY_UNDETERMINED
      default:
        return reasons.AUTHORITY_UNDETERMINED
    }
  }

  async function guardOperation(scope: ControlOperationScope): Promise<ControlGuardVerdict> {
    const root = parseRoot(scope.rootSessionId, CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED, 'guard')
    // Subject normalization (pre-alpha3 PR-D, D.2): the canonical
    // identity is the closed three-kind subject. An EXPLICIT subject
    // must be well formed and must agree with a present targetInstanceId;
    // with NO explicit subject the targetInstanceId (required, non-empty)
    // IS the legacy instance identity (byte-identical guard semantics
    // for old callers). The instance stale validators (member liveness
    // + the parseInstanceId shape check) apply to instance subjects ONLY.
    const subjectWasExplicit = scope.subject !== undefined
    let subject: ControlSubject
    if (scope.subject !== undefined) {
      const parsedSubject = parseSubject(scope.subject)
      if (parsedSubject === undefined) {
        throw guardMalformed(
          'subject',
          `subject must be {kind:'instance',instanceId} | {kind:'template',templateId} | {kind:'team',rootSessionId} (got ${JSON.stringify(scope.subject)})`,
        )
      }
      subject = parsedSubject
      if (
        scope.targetInstanceId !== undefined &&
        (parsedSubject.kind !== CONTROL_SUBJECT_KINDS.INSTANCE ||
          parsedSubject.instanceId !== scope.targetInstanceId)
      ) {
        throw guardMalformed(
          'targetInstanceId',
          'a present targetInstanceId must agree with an explicit instance subject (the legacy projection of the subject)',
        )
      }
    } else {
      if (typeof scope.targetInstanceId !== 'string' || scope.targetInstanceId.length === 0) {
        throw guardMalformed(
          'targetInstanceId',
          'targetInstanceId (or an explicit subject) is required: the legacy instance addressing is mandatory when no subject is given',
        )
      }
      subject = { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: scope.targetInstanceId }
    }
    // The instance canonical target (the valid instance id); ABSENT for
    // template/team subjects (no instance lifecycle — the stale validator
    // is skipped for them).
    let instanceTarget: string | undefined
    if (subject.kind === CONTROL_SUBJECT_KINDS.INSTANCE) {
      try {
        instanceTarget = String(parseInstanceId(subject.instanceId))
      } catch {
        // Point the error at the field the caller actually supplied: the
        // legacy targetInstanceId path (subject derived) or the explicit
        // subject.
        throw guardMalformed(
          subjectWasExplicit ? 'subject' : 'targetInstanceId',
          `${subjectWasExplicit ? 'subject.instanceId' : 'targetInstanceId'} is not a valid instance id: ${JSON.stringify(subject.instanceId)}`,
        )
      }
    }
    if (typeof scope.actionName !== 'string' || scope.actionName.length === 0) {
      throw guardMalformed('actionName', 'actionName must be a non-empty string')
    }
    if (typeof scope.correlation !== 'string' || scope.correlation.length === 0) {
      throw guardMalformed('correlation', 'correlation must be a non-empty string')
    }
    if (scope.toolName !== undefined && (typeof scope.toolName !== 'string' || scope.toolName.length === 0)) {
      throw guardMalformed('toolName', 'toolName must be a non-empty string when present')
    }
    if (scope.capabilityDomain !== undefined && !CAPABILITY_NAME_VALUES.includes(scope.capabilityDomain)) {
      throw guardMalformed('capabilityDomain', `capabilityDomain outside the closed set: ${JSON.stringify(scope.capabilityDomain)}`)
    }
    if (
      scope.operationFingerprint !== undefined &&
      (typeof scope.operationFingerprint !== 'string' || scope.operationFingerprint.length === 0)
    ) {
      throw guardMalformed('operationFingerprint', 'operationFingerprint must be a non-empty string when present')
    }
    if (scope.authorityScope !== undefined && !isControlAuthorityScope(scope.authorityScope)) {
      throw guardMalformed(
        'authorityScope',
        'authorityScope must be {operationClass, matcher: {kind: exact|fingerprint, resource}} with every member a non-empty string',
      )
    }

    return withTeamLock(teamLocks, root, async () => {
      // (a) the team must still exist — for the LEADER this check IS the
      // whole liveness predicate: the Leader is the Root Session itself
      // (invariant 15; the v2 LeaderInstance record carries NO lifecycle
      // and no childSessionId), so leader live <=> TeamSession(root)
      // exists, and no member-row lifecycle check ever applies to it.
      if (repositories.teamSessions.get(root) === undefined) {
        return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE }
      }
      // (b) an ORDINARY member must be durably live and work-accepting
      // (an allow only authorizes execution on a live target —
      // missing/ARCHIVED/DISPOSED all block). The member-row lifecycle
      // check applies to instance subjects ONLY (pre-alpha3 PR-D, D.2):
      // a template/team subject has no instance lifecycle, so this check
      // is skipped for them (templates are blueprint identity, not live
      // state). The member-row lifecycle check applies to members only
      // (A6: folding the Leader into the compound check made
      // `String(member.lifecycle)` read 'undefined' for the v2 leader
      // row — a permanent target-stale).
      if (instanceTarget !== undefined && instanceTarget !== LEADER_INSTANCE_ID) {
        const member = repositories.memberInstances.get(root, instanceTarget)
        if (
          member === undefined ||
          !GUARD_LIVE_LIFECYCLES.includes(String(member.lifecycle))
        ) {
          return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE }
        }
      }
      const state = loadControlState(root)
      const key = scopeKey(root, subjectIdentityOf(subject), scope.actionName, scope.toolName, scope.correlation, scope.operationFingerprint)
      // A4 (ADR A2-9): a leg the strict reader refused but that CANNOT be ruled
      // out as this call's governing row. `undefined` — the overwhelming common
      // case, and the whole point of the read — costs one pass over a list that
      // is empty on every healthy Team's ledger. See `corruptLegCouldGovern`.
      const corruptLeg = state.corruptLegs.find((row) =>
        corruptLegCouldGovern(row.payload, scope, subjectIdentityOf(subject)),
      )
      const matching = state.requests.filter((r) => {
        // NOTE (B2 lane disjointness): an INLINE request IS matched here so
        // its TERMINAL marks are reported correctly (abandon →
        // REQUEST_ABANDONED, stale → REQUEST_STALE, deny → DECISION_DENY,
        // pending → REQUEST_PENDING). But an inline ALLOW is NOT a one-shot
        // guard token — the CONSUMPTION/authorization path is skipped for it
        // below (see the `decision === 'allow'` branch): the inline allow
        // authorizes the frozen invocation's OWN continuation, which writes
        // NO `control-allow-consumed` fact. Excluding it here entirely would
        // wrongly turn an abandoned inline request into NO_REQUEST instead of
        // REQUEST_ABANDONED.
        const rowKey = scopeKey(
          String(r.entry.rootSessionId),
          subjectIdentityOf(r.payload.subject),
          r.payload.actionName,
          r.payload.toolName,
          r.payload.correlation,
          r.payload.operationFingerprint,
        )
        return rowKey === key
      })
      if (matching.length === 0) {
        // A4 (ADR A2-9): "no readable row matches" is NOT "nothing guards this
        // call" while a leg that could govern it sits unread in `corruptLegs`.
        // `no-request` is the ONE reason `packages/tools/src/guard.ts` proceeds
        // on, so emitting it here on a damaged ledger is the inversion this fix
        // exists to close — the runtime refused, and the tool plane read the
        // refusal as a green light.
        if (corruptLeg !== undefined) return corruptLegVerdictOf(corruptLeg.payload)
        return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST }
      }
      // Alpha.4 A4-PR3 (spec 11.3, ADR A1-10): the legs of one case share a
      // scope, so a scope match can name several of them. Only the CURRENT
      // (highest-ordinal) leg is eligible to authorize anything: a superseded
      // leg carries a durable terminal deny and must never come back as the
      // row that executes the operation. Rows with no case are unaffected —
      // for them this filter keeps everything.
      // "Only the CURRENT leg of a case can authorize" (acceptance 21.4), using
      // the one current-leg rule this file has (`currentLegOf`).
      const currentByCase = new Map<string, StoredFact<RequestPayload>>()
      for (const row of matching) {
        const caseId = row.payload.approvalCaseId
        if (caseId === undefined) continue
        const seen = currentByCase.get(caseId)
        if (seen === undefined || isLaterLegThan(row, seen)) currentByCase.set(caseId, row)
      }
      const candidates = matching.filter((row) => {
        const caseId = row.payload.approvalCaseId
        if (caseId === undefined) return true
        return currentByCase.get(caseId)?.payload.requestId === row.payload.requestId
      })
      const unconsumedAllows: {
        readonly request: StoredFact<RequestPayload>
        readonly decision: StoredFact<DecisionPayload>
      }[] = []
      let fallback: ControlGuardVerdict = {
        allowed: false,
        reason: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST,
      }
      for (const request of candidates) {
        // Abandonment (pre-alpha3 PR-D, D.4): the durable abandon fact
        // is the TERMINAL mark (like `stale-denied`) — an immediate
        // block verdict even over a durable `allow` recorded BEFORE the
        // abandon (the old allow/decision cannot execute the operation
        // — zero effect; the inline allow was never consumed by a guard
        // and the abandon closes it).
        const abandon = state.abandonments.find(
          (a) => a.payload.requestId === request.payload.requestId,
        )
        if (abandon !== undefined) {
          const decision = state.decisions.find(
            (d) => d.payload.requestId === request.payload.requestId,
          )
          return {
            allowed: false,
            reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_ABANDONED,
            requestId: request.payload.requestId,
            ...(decision !== undefined ? { decisionSequence: decision.entry.sequence } : {}),
          }
        }
        const decision = state.decisions.find(
          (d) => d.payload.requestId === request.payload.requestId,
        )
        if (decision === undefined) {
          fallback = {
            allowed: false,
            reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING,
            requestId: request.payload.requestId,
          }
          continue
        }
        // Alpha.4 A4-PR3: the decision value is switched EXHAUSTIVELY, with a
        // last-line-of-defence default. The reader already refuses a row whose
        // `decision` is outside the closed vocabulary, so reaching `default`
        // means the two readers disagreed — and a block verdict is the only
        // safe answer to that (`packages/tools/guard.ts` blocks on every
        // reason but `no-request`, so an unrecognized value cannot execute).
        switch (decision.payload.decision) {
          case CONTROL_DECISION_VALUES.STALE_DENIED: {
            return {
              allowed: false,
              reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_STALE,
              requestId: request.payload.requestId,
              decisionSequence: decision.entry.sequence,
            }
          }
          case CONTROL_DECISION_VALUES.DENY: {
            return {
              allowed: false,
              reason: CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY,
              requestId: request.payload.requestId,
              decisionSequence: decision.entry.sequence,
            }
          }
          case CONTROL_DECISION_VALUES.ALLOW: {
            break
          }
          default: {
            return {
              allowed: false,
              reason: CONTROL_GUARD_BLOCK_REASONS.DECISION_UNRECOGNIZED,
              requestId: request.payload.requestId,
              decisionSequence: decision.entry.sequence,
            }
          }
        }
        // decision === 'allow'
        // Lane disjointness (pre-alpha3 PR-D review B2 / D.4 coupling
        // boundary): an INLINE allow is NOT a one-shot guard token. It
        // authorizes the frozen invocation's OWN continuation, which
        // continues on the decision and writes NO `control-allow-consumed`
        // fact. The GUARDED execution path (this guard) must therefore NOT
        // consume or be authorized by it — otherwise a second, unrelated
        // guarded execution would be authorized after the inline invocation
        // already applied the decision. The request is still MATCHED (above)
        // so its terminal marks (abandon / stale / deny / pending) are
        // reported; but an inline ALLOW simply leaves the NO_REQUEST fallback
        // (zero authorization, zero consumption).
        if (request.payload.executionCoupling === CONTROL_EXECUTION_COUPLINGS.INLINE) {
          continue
        }
        const consumed = state.consumptions.some(
          (c) => c.payload.requestId === request.payload.requestId,
        )
        if (consumed) {
          fallback = {
            allowed: false,
            reason: CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED,
            requestId: request.payload.requestId,
            decisionSequence: decision.entry.sequence,
          }
          continue
        }
        if (!scopeSnapshotMatches(decision.payload.scope, scope)) {
          return {
            allowed: false,
            reason: CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH,
            requestId: request.payload.requestId,
            decisionSequence: decision.entry.sequence,
          }
        }
        unconsumedAllows.push({ request, decision })
      }
      if (unconsumedAllows.length > 1) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_GUARD_AMBIGUOUS,
          `ControlService: ${unconsumedAllows.length} distinct unconsumed durable allows for one scope — refusing to guess which authorizes the operation`,
          {
            rootSessionId: root,
            requestIds: unconsumedAllows.map((a) => a.request.payload.requestId),
          },
        )
      }
      if (unconsumedAllows.length === 1) {
        const winner = unconsumedAllows[0]
        if (winner === undefined) {
          // Unreachable: the length check above guarantees the single element.
          throw new Error('control: invariant violation — one unconsumed allow but no element')
        }
        const { request, decision } = winner
        // A2C-4 (alpha.2 plan §6.3) — the live external hard recheck,
        // AFTER the exact-scope match and BEFORE the consumption write:
        // if the host's external hard policy tightened between the
        // decision and this final guard, the block carries ZERO effect —
        // the consumption fact is NOT written (the one-shot allow is not
        // burned: a host policy that already prevents the execution must
        // not consume the approval; "prefer zero allow consumption";
        // invariant 34). The shared read-only check never throws and
        // writes nothing — a deny here is a plain block verdict.
        const external = await checkExternalOperation({
          capabilityDomain: scope.capabilityDomain,
          toolName: scope.toolName,
        })
        if (external.allowed === false) {
          return {
            allowed: false,
            reason: CONTROL_GUARD_BLOCK_REASONS.EXTERNAL_POLICY,
            requestId: request.payload.requestId,
            decisionSequence: decision.entry.sequence,
          }
        }
        // A4-PR7 Task 7.0 — ADR A1-14, THE consumption-point authority recheck.
        // Everything above this line answers "did a human allow THIS
        // invocation"; nothing before it asked whether the authority that
        // signed still covers it. PR4 shipped the pre-check half of that duty
        // in the pre-execute adapter and disclosed, in that file's own header,
        // that the half at the consumption write was unenforced because the
        // scope carried no operation class and no canonical resource. Both
        // halves exist now, and this one is the one that cannot be bypassed by
        // a caller that never went through the adapter: it runs inside the
        // per-team lock, on the DURABLE row, before the consumption fact.
        // Refusal here writes NOTHING — the allow stays unspent, the same
        // zero-effect discipline as the external recheck above.
        const authority = await recheckConsumedAuthority(root, request.payload)
        if (authority !== undefined) {
          return {
            allowed: false,
            reason: authority,
            requestId: request.payload.requestId,
            decisionSequence: decision.entry.sequence,
          }
        }
        // A4 (ADR A2-9): the LAST look before the durable write. An unreadable
        // sibling leg that could govern this call means the constraint set this
        // allow is being spent against is not fully known — so the allow is NOT
        // burned (zero effect, the same discipline as the two rechecks above),
        // and the operator gets a typed refusal naming the damaged ledger
        // instead of an execution whose approval nobody can re-verify.
        if (corruptLeg !== undefined) return corruptLegVerdictOf(corruptLeg.payload)
        await putEntry({
          schemaVersion: 2,
          sequence: await allocateSequence(),
          rootSessionId: root,
          factType: FACT_CONSUMPTION,
          payload: {
            requestId: request.payload.requestId,
            decisionSequence: decision.entry.sequence,
            scope: scopeOf(request.entry, request.payload),
            consumedAt: options.now(),
          },
          createdAt: options.now(),
        })
        return {
          allowed: true,
          requestId: request.payload.requestId,
          decisionSequence: decision.entry.sequence,
        }
      }
      // An inline allow authorizes its OWN frozen invocation and writes no
      // consumption, so a candidate list of nothing-but-inline-allows falls
      // through here as `no-request` — the same polarity trap as the branch
      // above if a leg that could govern this call is unread.
      if (fallback.reason === CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST && corruptLeg !== undefined) {
        return corruptLegVerdictOf(corruptLeg.payload)
      }
      return fallback
    })
  }

  // --- awaitControlDecision (the alpha.2 synchronous wait bridge) ----------------------

  /**
   * The COUPLING-AWARE inline-abort cascade (pre-alpha3 PR-D, D.4 — the
   * inline lifecycle's `abort` node: `abort → durable abandon/close →
   * zero effect`): when the wait bridge's signal aborts, an INLINE-
   * coupled request is tied to its frozen invocation — the invocation is
   * dead, and a PENDING row would be a zombie no resolver can ever
   * service (a retry is a NEW request), so the bridge durably closes the
   * request FIRST, before it settles the waiter.
   *
   * Coupling gating (plan §D.4): the cascade fires ONLY when the STORED
   * request row's executionCoupling is exactly `inline`. A `guarded`
   * request and an ABSENT (legacy) row keep today's zero-side-effect
   * abort EXACTLY (the request stays PENDING — the guarded lifecycle's
   * wait abort is a pure cancellation, pinned by a4a W2 / a5a
   * S10–S14; guarded keeps its `request → wait → decision → guard →
   * consume → execute` line, so its abort leaves the recovery paths in
   * place).
   *
   * Idempotency / race safety: the cascade re-reads the fresh durable
   * state under the per-team lock. If the request is ALREADY terminal —
   * a durable decision won the race between the last poll and the
   * signal, or a concurrent abandon landed first — the terminal mark is
   * NOT written a second time (exactly-once, inherited from the shared
   * {@link commitAbandonmentFact} routine): a durable decision RESOLVES
   * the wait with itself (the first decision is authoritative — today's
   * poll fast path); an already-abandoned request settles rejected typed
   * (it can never become a decision). Only a PENDING inline request
   * receives the additive close fact (reason `wait-aborted`).
   *
   * A durable-store failure of the close write PROPAGATES typed (the
   * facade's TEAM_RUNTIME_DURABLE_WRITE_FAILED through the shared write
   * path) — the bridge rejects with the storage fault and NEVER claims
   * a half-abandoned state (the review F2 contract the explicit abandon
   * API carries, mirrored through the same routine).
   */
  async function inlineAbortCascade(root: string, requestId: string): Promise<InlineAbortCascadeOutcome> {
    return withTeamLock(teamLocks, root, async () => {
      const state = loadControlState(root)
      const request = state.requests.find((r) => r.payload.requestId === requestId)
      // No durable request row, or a row whose STORED coupling is not
      // exactly `inline` (guarded / ABSENT legacy): nothing to close —
      // the caller settles exactly as today (zero side effects).
      if (request === undefined) return { kind: 'none' }
      if (request.payload.executionCoupling !== CONTROL_EXECUTION_COUPLINGS.INLINE) {
        return { kind: 'none' }
      }
      // fix-control-authz C: the durable ABANDON mark is TERMINAL — it
      // is consulted FIRST, before any decision (the pre-fix order let a
      // decision recorded BEFORE the abandon win: the wait resolved with
      // the stale allow — the key negative "abort 后旧 allow/decision
      // 不得执行 operation", refactor-plan D.4/D.5). The abandon closes
      // the allow: no terminal mark is written over it (exactly-once)
      // and the caller settles the waiter rejected typed.
      if (state.abandonments.some((a) => a.payload.requestId === requestId)) {
        return { kind: 'already-abandoned' }
      }
      // A durable decision WITHOUT an abandon mark is authoritative — no
      // second terminal mark over it; the wait RESOLVES with the
      // decision (today's poll fast path — the S6 pin is preserved: a
      // racing decision with NO abandon mark still settles the wait with
      // the decision and writes no abandon fact).
      const decision = state.decisions.find((d) => d.payload.requestId === requestId)
      if (decision !== undefined) {
        return { kind: 'decided', decision: toDecisionRecord(decision.entry, decision.payload) }
      }
      // PENDING inline: durably close it FIRST (the shared terminal-mark
      // write — exactly-once + storage-fault contract by code reuse),
      // then the caller settles the waiter rejected typed.
      const mark = await commitAbandonmentFact(root, requestId, WAIT_ABORT_ABANDON_REASON)
      return { kind: 'abandoned', abandonmentSequence: mark.abandonmentSequence }
    })
  }

  /**
   * The SYNCHRONOUS WAIT BRIDGE (alpha.2 §9.4): resolves when a durable
   * ControlDecision for the requestId appears. Authority is ALWAYS the
   * durable control rows — the waiter only solves liveness (it adds no
   * authority, writes no rows, and is never consulted by the guard or
   * the resolvers). Minimal alpha.2 implementation: poll the durable
   * control state at the injected `waitPollIntervalMs` cadence (default
   * 250 ms — see DEFAULT_WAIT_POLL_INTERVAL_MS) until the decision
   * appears (resolve), the caller's signal aborts (typed
   * CONTROL_WAIT_ABORTED) or the durable control plane closes (the
   * storage layer's typed `NOT_OPEN` rejection on the durable read maps
   * to typed CONTROL_WAIT_CLOSED). Timers and listeners are cleared on
   * settle (no leak after the promise settles). No durable waiter
   * scheduler, no cross-process continuation.
   *
   * The COUPLING-AWARE abort cascade (pre-alpha3 PR-D, D.4): on a
   * signal abort (pre-aborted or mid-wait), a request whose STORED
   * executionCoupling is exactly `inline` is durably ABANDONED FIRST
   * (the inline lifecycle: `abort → durable abandon/close → zero
   * effect` — the shared terminal-mark write with reason
   * `wait-aborted`) and the waiter is then rejected typed; a `guarded`
   * or ABSENT (legacy) request keeps today's zero-side-effect abort
   * exactly (the request stays PENDING — a4a W2 / a5a S10–S14).
   */
  async function awaitControlDecision(input: {
    readonly rootSessionId: string
    readonly requestId: string
    readonly signal?: ControlWaitSignal
  }): Promise<ControlDecisionRecord> {
    const root = parseRoot(input.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'wait')
    const requestId = input.requestId
    if (typeof requestId !== 'string' || requestId.length === 0) {
      throw malformed('wait', 'requestId', 'requestId must be a non-empty string')
    }
    const signal = input.signal
    if (signal !== undefined && typeof signal.aborted !== 'boolean') {
      throw malformed('wait', 'signal', 'signal must be an AbortSignal when present')
    }
    // Already aborted: settle immediately. The COUPLING-AWARE cascade
    // (pre-alpha3 PR-D, D.4): an INLINE request's frozen invocation is
    // dead the moment the signal is — the bridge durably abandons the
    // PENDING request FIRST (the shared terminal-mark write, reason
    // `wait-aborted`) and then rejects typed. A guarded / ABSENT
    // (legacy) request — and an inline request that is ALREADY terminal
    // (a racing durable decision, or a concurrent abandon) — keeps
    // today's zero-side-effect reject exactly (the durable rows are
    // untouched and a later resolve is unaffected).
    if (signal !== undefined && signal.aborted) {
      const cascade = await inlineAbortCascade(root, requestId)
      if (cascade.kind === 'abandoned' || cascade.kind === 'already-abandoned') {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED,
          `ControlService: awaitControlDecision for request '${requestId}' was aborted before the wait began (the INLINE request is durably ABANDONED — the additive close fact 'control-request-abandoned' is the terminal mark; the frozen invocation is dead and a retry is a NEW request)`,
          { rootSessionId: root, requestId },
        )
      }
      throw new ControlError(
        CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED,
        `ControlService: awaitControlDecision for request '${requestId}' was aborted before the wait began`,
        { rootSessionId: root, requestId },
      )
    }
    const rawPoll = options.waitPollIntervalMs
    const pollMs =
      typeof rawPoll === 'number' && Number.isFinite(rawPoll) && rawPoll > 0
        ? rawPoll
        : DEFAULT_WAIT_POLL_INTERVAL_MS

    return new Promise<ControlDecisionRecord>((resolve, reject) => {
      let timer: unknown
      let settled = false
      const cleanup = (): void => {
        if (timer !== undefined) platformTimers.clearTimeout(timer)
        if (signal !== undefined) signal.removeEventListener('abort', onAbort)
      }
      const settle = (outcome: () => void): void => {
        if (settled) return
        settled = true
        cleanup()
        outcome()
      }
      const onAbort = (): void => {
        settle(async () => {
          // The COUPLING-AWARE cascade (pre-alpha3 PR-D, D.4) — runs
          // inside the settle (the waiter is already committed to
          // settling; the cascade only chooses HOW): inline PENDING →
          // durably abandon first (reason `wait-aborted`), then reject
          // typed; a racing durable decision → resolve with it (the
          // first decision is authoritative); a concurrent abandon or a
          // guarded / ABSENT (legacy) request → today's exact settle.
          // A typed durable fault of the close write PROPAGATES as the
          // rejection (the review F2 storage-fault contract through the
          // shared write path — never a half-abandoned claim). The
          // async outcome must never reject the promise it was handed
          // (settle does not await it) — every path below settles.
          let cascade: InlineAbortCascadeOutcome
          try {
            cascade = await inlineAbortCascade(root, requestId)
          } catch (error) {
            reject(error)
            return
          }
          if (cascade.kind === 'decided') {
            resolve(cascade.decision)
            return
          }
          if (cascade.kind === 'abandoned' || cascade.kind === 'already-abandoned') {
            reject(
              new ControlError(
                CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED,
                `ControlService: awaitControlDecision for request '${requestId}' was aborted before a durable decision appeared (the INLINE request is durably ABANDONED — the additive close fact 'control-request-abandoned' is the terminal mark; the frozen invocation is dead and a retry is a NEW request)`,
                { rootSessionId: root, requestId },
              ),
            )
            return
          }
          reject(
            new ControlError(
              CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED,
              `ControlService: awaitControlDecision for request '${requestId}' was aborted before a durable decision appeared (zero side effects — the request stays durable and undecided)`,
              { rootSessionId: root, requestId },
            ),
          )
        })
      }
      if (signal !== undefined) {
        signal.addEventListener('abort', onAbort, { once: true })
      }
      const poll = (): void => {
        if (settled) return
        try {
          const state = loadControlState(root)
          // fix-control-authz C: the durable ABANDON mark is TERMINAL —
          // the waiter settles REJECTED now. The pre-fix poll consulted
          // decisions only: a parked waiter on an abandoned row with a
          // pre-abandon decision RESOLVED the stale allow, and a waiter
          // on an abandoned row without one (including the COLD waiter
          // of a restart retry hitting the abandoned row — the row's
          // scope key is reused) polled FOREVER for a decision that can
          // no longer land. The terminal mark beats any stale decision —
          // the same precedence the inline-abort cascade applies on the
          // signal path (refactor-plan D.4/D.5: abort 后旧 allow/
          // decision 不得执行 operation).
          if (state.abandonments.some((a) => a.payload.requestId === requestId)) {
            settle(() =>
              reject(
                new ControlError(
                  CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
                  `ControlService: the request '${requestId}' was abandoned before the wait could settle (the durable abandon mark is the terminal outcome — no decision can land on an abandoned request)`,
                  { rootSessionId: root, requestId },
                ),
              ),
            )
            return
          }
          const decision = state.decisions.find((d) => d.payload.requestId === requestId)
          if (decision !== undefined) {
            settle(() => resolve(toDecisionRecord(decision.entry, decision.payload)))
            return
          }
        } catch (error) {
          // The durable control plane closed while waiting (the storage
          // layer's typed closure signal): fail closed, typed.
          if (isTeamDomainError(error) && error.code === TEAM_DOMAIN_ERROR_CODES.NOT_OPEN) {
            settle(() =>
              reject(
                new ControlError(
                  CONTROL_ERROR_CODES.CONTROL_WAIT_CLOSED,
                  `ControlService: the durable control plane closed while waiting for a decision on request '${requestId}'`,
                  { rootSessionId: root, requestId },
                ),
              ),
            )
            return
          }
          // Any other typed failure (e.g. TEAM_SESSION_NOT_FOUND for a
          // vanished team session) surfaces unchanged.
          settle(() => reject(error))
          return
        }
        timer = platformTimers.setTimeout(() => {
          timer = undefined
          poll()
        }, pollMs)
      }
      // The first poll runs synchronously: an already-durable decision
      // resolves without ever scheduling a timer (fast path).
      poll()
    })
  }

  // --- commitEffectIfAuthorized (fix-control-authz C — the effect-admission boundary) ---

  /**
   * The EFFECT-ADMISSION BOUNDARY (the external-review TOCTOU fix): the
   * linearized authorization check for the inline recovery
   * re-execution's FIRST EFFECT.
   *
   * The serialization point (the lock ordering, documented): this unit
   * runs under THIS SERVICE'S per-team lock — the SAME promise chain
   * the durable abandon write goes through (`abandonControlRequest` and
   * the inline-abort cascade commit the terminal mark under it via
   * `withTeamLock(teamLocks, ...)`). Inside the one lock hold: (1) the
   * durable terminal state is read fresh from the ledger, (2) if the
   * request carries the terminal ABANDON mark the unit rejects typed
   * CONTROL_REQUEST_ABANDONED without running the effect, (3) if the
   * invocation's live signal (C-2 — `input.signal`) is ABORTED the unit
   * persists the abandon (the durable close — the same footprint as an
   * explicit abandon, exactly-once) and rejects typed
   * CONTROL_REQUEST_ADMISSION_ABORTED without running the effect,
   * (4) otherwise the caller's effect commit (the router's
   * `executeEffectLocked` — the work admission fact / the effect
   * commit) runs, still under the lock. That is what linearizes
   * (authorization + first effect) against the durable abandon AND the
   * live abort: a durable abandon or a signal abort is either committed
   * BEFORE the unit (→ the check sees it; the effect never commits) or
   * strictly AFTER the unit (→ the effect had already durably committed
   * before the terminal state — the legitimate late close, the CCR-4
   * semantics; for an abort that lands after the commit the committed
   * effect is NEVER retroactively undone or re-marked). Nothing can
   * land BETWEEN the checks and the effect commit — all are inside the
   * one hold.
   *
   * Deadlock argument: the ONLY new acquisition direction is the
   * router's team chain (a) → this lock (b) (the router's gated chain
   * work invokes this unit after the gate, while holding its chain).
   * Every (b) section (requestControl / resolveControl /
   * abandonControlRequest / the cascade / guardOperation / this unit)
   * acquires (a) NEVER — the control service never takes the router's
   * chain and never calls back into the router; and the unit's caller
   * work (the effect commit) performs only storage-seam writes + port
   * calls (no (b) re-entry — the inline effect path consults no other
   * control operation). Consistent global order (a) → (b) → storage
   * seam, no (b) → (a) anywhere → no new lock cycles.
   *
   * This writes NO control facts on the authorization path (no
   * synthetic "consumed" mark — the linearization is the lock
   * itself); the ONLY durable write this unit performs is the abandon
   * close on the abort path (the rejection's evidence — the documented
   * fail-closed exception, like CONTROL_REQUEST_STALE), changes NO
   * request state, and is transparent for a non-abandoned, non-aborted
   * request (the unit runs the caller's effect and returns its result
   * unchanged).
   */
  async function commitEffectIfAuthorized<T>(input: {
    readonly rootSessionId: string
    readonly requestId: string
    readonly commitEffect: () => Promise<T>
    readonly signal?: ControlWaitSignal
  }): Promise<T> {
    const root = parseRoot(input.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'wait')
    if (typeof input.requestId !== 'string' || input.requestId.length === 0) {
      throw malformed('wait', 'requestId', 'requestId must be a non-empty string')
    }
    return withTeamLock(teamLocks, root, async (): Promise<T> => {
      const state = loadControlState(root)
      if (state.abandonments.some((a) => a.payload.requestId === input.requestId)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
          `ControlService: the request '${input.requestId}' is durably abandoned — the terminal mark closed the authorization; the effect admission is rejected (zero effect)`,
          { rootSessionId: root, requestId: input.requestId },
        )
      }
      // C-2 (the external-review residual) — the LIVE signal check,
      // inside the SAME lock hold as the terminal-state read and
      // BEFORE the effect commit: an abort that landed at ANY wait
      // point of the admission (the gate re-probe await, this
      // unit's control-lock queue) lands here. The durable abandon is
      // PERSISTED first (exactly-once — a later late-abandon then
      // no-ops on the already-terminal state) so an
      // abort-during-wait leaves the SAME durable footprint as an
      // explicit abandon; then the typed reject. An abort that lands
      // AFTER the commit is the legitimate late close (CCR-4 — the
      // committed effect is never retroactively undone or re-marked).
      if (input.signal !== undefined && input.signal.aborted === true) {
        await commitAbandonmentFact(
          root,
          input.requestId,
          'the invocation aborted at the effect-admission boundary (the durable close)',
        )
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_ADMISSION_ABORTED,
          `ControlService: the invocation aborted before the effect commit — the durable abandon was persisted at the effect-admission boundary (the same footprint as an explicit abandon); the effect admission is rejected (zero effect)`,
          { rootSessionId: root, requestId: input.requestId },
        )
      }
      return input.commitEffect()
    })
  }

  /**
   * fix-control-authz C (the residual pre-reservation boundary) — the
   * LOCK-FREE durable close for the activation provider's
   * pre-reservation abort boundary (the provider preflight awaits —
   * the compatibility authority, the v2 template-scope feed, the
   * provider-lock queue, the step-8 external-facts read — which run
   * INSIDE `commitEffectIfAuthorized`'s commitEffect, i.e. under this
   * service's per-team lock hold).
   *
   * Precondition: the caller ALREADY holds this service's per-team
   * lock (the effect-admission unit's lock hold). This function
   * performs NO lock acquisition: re-acquiring would deadlock on the
   * caller's own hold. It is the same `commitAbandonmentFact`
   * primitive the explicit abandon and the unit's abort branch use —
   * the terminal mark is written exactly once; the re-read below is
   * the lock's fresh-state verification (invariant 45).
   *
   * Contract: resolves when the durable close is GUARANTEED — either
   * this call persisted the terminal mark, or the mark was ALREADY
   * durable (the idempotent no-op — the pre-dispatch best-effort
   * abandon, a concurrent explicit abandon, or a prior unit settle).
   * Rejects ONLY when the close persist itself faults (the typed
   * DURABLE_WRITE_FAILED via `putEntry`'s fault admission —
   * fail-closed) or the request id is unknown (typed
   * CONTROL_REQUEST_NOT_FOUND — loud). The caller (the provider
   * boundary) propagates the reject unchanged and rejects typed
   * ACTIVATION_REQUEST_ABORTED after the settle.
   */
  async function persistAbandonCloseLocked(input: {
    readonly rootSessionId: string
    readonly requestId: string
  }): Promise<void> {
    const root = parseRoot(input.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'wait')
    if (typeof input.requestId !== 'string' || input.requestId.length === 0) {
      throw malformed('wait', 'requestId', 'requestId must be a non-empty string')
    }
    try {
      await commitAbandonmentFact(
        root,
        input.requestId,
        'the invocation aborted in the pre-reservation preflight (the durable close)',
      )
    } catch (error) {
      if (
        error instanceof ControlError &&
        error.code === CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED
      ) {
        // The terminal mark is already durable — the close is
        // guaranteed; the idempotent no-op resolves.
        return
      }
      throw error
    }
  }

  // --- Alpha.4 approval cases (A4-PR3) ------------------------------------------------
  //
  // The operations below add the approval-CASE dimension to the existing
  // durable Control plane. Nothing here is a second authority path: every
  // write re-enters the SAME helpers the pre-Alpha.4 operations use
  // (`resolveCaller` / `resolveTeamAndTarget` / `enforceEnvelope` /
  // `commitDecision` / the one request-row writer), the legacy
  // `requestControl` / `resolveControl` / `guardOperation` flows stay
  // byte-identical for rows that carry no case, and the case itself remains
  // a DERIVED view over durable rows (ADR A1-17) — there is no case table.

  /** Are two durable caller refs the same principal? */
  function sameCallerRef(a: ControlCallerRef, b: ControlCallerRef): boolean {
    if (a.kind !== b.kind) return false
    if (a.kind === 'human' && b.kind === 'human') return a.humanId === b.humanId
    if (a.kind === 'instance' && b.kind === 'instance') return a.instanceId === b.instanceId
    return false
  }

  /**
   * THE one home of "which leg row of a case is current" — the fidelity review
   * counted two separate rules (the guard's candidate filter kept the FIRST row
   * of equal ordinal, the case read's sorted tail kept the LAST) and only the
   * duplicate-ordinal refusal masked the difference. One law, one home: the
   * highest leg ordinal wins, and equal ordinals break to the LATER durable row,
   * which is what the case read already did. Equal ordinals are themselves a
   * corrupt chain the case read refuses (ADR A2-9); this rule only decides what
   * the guard examines while that refusal stands.
   *
   * `rows` must be in durable (sequence) order, as `loadControlState` returns.
   */
  function isLaterLegThan(
    candidate: StoredFact<RequestPayload>,
    current: StoredFact<RequestPayload>,
  ): boolean {
    const ordinal = candidate.payload.legOrdinal ?? 0
    const bestOrdinal = current.payload.legOrdinal ?? 0
    return (
      ordinal > bestOrdinal ||
      (ordinal === bestOrdinal && candidate.entry.sequence > current.entry.sequence)
    )
  }

  /** The current leg of a set of same-case leg rows (see `isLaterLegThan`). */
  function currentLegOf(
    rows: readonly StoredFact<RequestPayload>[],
  ): StoredFact<RequestPayload> | undefined {
    let current: StoredFact<RequestPayload> | undefined
    for (const row of rows) {
      if (current === undefined || isLaterLegThan(row, current)) current = row
    }
    return current
  }

  /**
   * THE one home of the law "a principal who already acted on an approval case
   * may not act on it again" (spec 21.5 "no self/same-level allow", spec 24.5
   * (`reviewedBy` is its durable backing), ADR A1-10; fidelity review #1).
   *
   * The basis is the case's OWN durable rows: a decision on an earlier leg of
   * the case whose `decider` is this caller, or an escalation fact this caller
   * wrote on an earlier leg. It reads the durable rows rather than the derived
   * `reviewedBy` view on purpose — the derived field has no write-path
   * consumer, so a law built on it would be a law built on a display value.
   *
   * Every entrance that can decide or terminalise a leg calls this BEFORE it
   * writes: `escalateApprovalLeg`, `resolveControl` and
   * `appendTerminalOutcome`. A law enforced only in the advisory legal-action
   * list PR4 renders is not a law — a menu cannot refuse a write, and the
   * guard would then honour a decision the ladder forbade.
   *
   * Precondition: the caller holds the per-team lock.
   */
  function assertNoActOnEarlierLeg(
    state: ControlState,
    input: {
      readonly root: string
      readonly stage: string
      readonly requestId: string
      readonly approvalCaseId: string
      readonly legOrdinal: number
      readonly decider: ControlCallerRef
    },
  ): void {
    for (const earlier of state.requests) {
      if (earlier.payload.approvalCaseId !== input.approvalCaseId) continue
      if ((earlier.payload.legOrdinal ?? 0) >= input.legOrdinal) continue
      const decided = state.decisions.find(
        (row) => row.payload.requestId === earlier.payload.requestId,
      )
      if (decided !== undefined && sameCallerRef(decided.payload.decider, input.decider)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
          `ControlService: ${input.stage} refused — this principal already decided leg ${earlier.payload.legOrdinal} of case '${input.approvalCaseId}', and an escalated-away reviewer cannot act on the case again (zero durable side effects)`,
          {
            rootSessionId: input.root,
            requestId: input.requestId,
            approvalCaseId: input.approvalCaseId,
            alreadyActedOnLegOrdinal: earlier.payload.legOrdinal,
          },
        )
      }
      const escalated = state.escalations.find(
        (row) => row.payload.previousRequestId === earlier.payload.requestId,
      )
      if (escalated !== undefined && sameCallerRef(escalated.payload.escalatedBy, input.decider)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
          `ControlService: ${input.stage} refused — this principal already escalated leg ${earlier.payload.legOrdinal} of case '${input.approvalCaseId}', and an escalated-away reviewer cannot act on the case again (zero durable side effects)`,
          {
            rootSessionId: input.root,
            requestId: input.requestId,
            approvalCaseId: input.approvalCaseId,
            alreadyActedOnLegOrdinal: earlier.payload.legOrdinal,
          },
        )
      }
    }
  }

  /**
   * The canonical key of a frozen case identity (spec 11.1). The team and
   * the carrier kind participate, so two Teams never share a case id and a
   * case never changes carrier under a steady id (acceptance 21.11).
   */
  function caseIdentityKeyOf(input: {
    readonly root: string
    readonly kind: ControlRequestKind
    readonly identity: ApprovalCaseIdentityInput
  }): string {
    return [
      input.root,
      input.kind,
      subjectIdentityOf(input.identity.subject),
      input.identity.beneficiaryAuthority,
      input.identity.requestedEffect,
      input.identity.operationFingerprint ?? '',
      input.identity.mutationProposalFingerprint ?? '',
      authorityScopeKeyOf(input.identity.authorityScope),
      input.identity.correlation,
    ].join('\u0000')
  }

  /**
   * The derived case id (ADR A2-7: case identity is server-derived, never
   * caller-accepted). Hashing the frozen identity is what makes a retry of
   * the same logical flow land on the SAME case instead of minting a second
   * one, while a new invocation (a new correlation, per the single-shot
   * invariant 12.2) opens a new case.
   */
  function approvalCaseIdOf(
    root: string,
    kind: ControlRequestKind,
    identity: ApprovalCaseIdentityInput,
  ): string {
    return `case-${deterministicToken(caseIdentityKeyOf({ root, kind, identity }), 24)}`
  }

  /**
   * The strict identity check of spec 11.1, as a CLOSED problem list (A2-9:
   * an authority-bearing write is strict, and the refusal is typed rather
   * than a prose message).
   *
   * @param kind - the carrier kind (decides WHICH fingerprint is required).
   * @param identity - the caller-supplied frozen identity.
   * @returns the refusal reason, or undefined when the identity is well-formed.
   */
  function caseIdentityProblemOf(
    kind: ControlRequestKind,
    identity: ApprovalCaseIdentityInput,
  ): ApprovalCaseIdentityProblem | undefined {
    const problems = APPROVAL_CASE_IDENTITY_PROBLEMS
    if (parseSubject(identity.subject) === undefined) return problems.SUBJECT_MALFORMED
    if (!PERMISSION_OVERLAY_EFFECT_VALUES.includes(identity.requestedEffect)) {
      return problems.EFFECT_UNKNOWN
    }
    if (!isProposalAuthorityPosition(identity.beneficiaryAuthority)) {
      return problems.AUTHORITY_POSITION_UNKNOWN
    }
    const hasOperation =
      typeof identity.operationFingerprint === 'string' && identity.operationFingerprint.length > 0
    const hasMutation =
      typeof identity.mutationProposalFingerprint === 'string' &&
      identity.mutationProposalFingerprint.length > 0
    // "Exactly one of operation/mutation proposal fingerprints is present."
    if (hasOperation === hasMutation) return problems.FINGERPRINT_CARDINALITY
    if (kind === CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION && !hasMutation) {
      return problems.MUTATION_FINGERPRINT_REQUIRED
    }
    if (kind !== CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION && !hasOperation) {
      // A1-15: "an `allow` recorded without one may not be consumed" — the
      // cheapest place to honour that is to never write such a row.
      return problems.OPERATION_FINGERPRINT_REQUIRED
    }
    if (hasOperation && !isControlAuthorityScope(identity.authorityScope)) {
      // A1-14 (A4-PR7 Task 7.0), the sibling rule: an operation case must also
      // name the AUTHORITY point its allow covers, or the consumption point has
      // nothing to re-run the ceiling over. This is the last moment the shape
      // is cheap to fix, and the only moment a v3 row can be refused before it
      // becomes an authority-bearing durable fact.
      return problems.AUTHORITY_SCOPE_REQUIRED
    }
    return undefined
  }

  /** The durable escalation leg fact, from its stored row. */
  function toEscalationRecord(
    entry: LedgerEntry,
    payload: EscalationPayload,
  ): ControlEscalationRecord {
    return {
      approvalCaseId: payload.approvalCaseId,
      legOrdinal: payload.legOrdinal,
      previousRequestId: payload.previousRequestId,
      escalatedBy: payload.escalatedBy,
      ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
      escalationSequence: entry.sequence,
      createdAt: entry.createdAt,
    }
  }

  /** The identity fields a leg row carries (ABSENT parts read as ''). */
  function legIdentityKeyOf(payload: RequestPayload): string {
    return [
      subjectIdentityOf(payload.subject),
      payload.beneficiaryAuthority ?? '',
      payload.requestedEffect ?? '',
      payload.operationFingerprint ?? '',
      payload.mutationProposalFingerprint ?? '',
      authorityScopeKeyOf(payload.authorityScope),
      payload.correlation,
    ].join('\u0000')
  }

  /**
   * The canonical identity form of a persisted authority point (ADR A1-14).
   * ABSENT reads as `''`, exactly as the optional fingerprints do, so a
   * pre-Alpha.4 row computes the case identity it always computed and a v3 row
   * computes one that a DIFFERENT point cannot reproduce.
   */
  function authorityScopeKeyOf(scope: ControlAuthorityScope | undefined): string {
    if (scope === undefined) return ''
    return `${scope.operationClass}\u0000${scope.matcher.kind}\u0000${scope.matcher.resource}`
  }

  /**
   * WHICH closed read problem a corrupt leg row is (ADR A2-9): the most
   * specific reason the row cannot be reconstructed, named from the row itself
   * rather than reported as one undifferentiated corruption. The order is the
   * order of consequences — no ordinal means the chain cannot be ordered, no
   * review authority means nobody can be told who decides, and a row missing
   * its identity members cannot be compared to the frozen case identity.
   */
  function corruptLegProblemOf(payload: Record<string, unknown>): ApprovalCaseReadProblem {
    const problems = APPROVAL_CASE_READ_PROBLEMS
    const ordinal = payload['legOrdinal']
    if (typeof ordinal !== 'number' || !Number.isInteger(ordinal) || ordinal < 1) {
      return problems.LEG_ORDINAL
    }
    if (!isProposalAuthorityPosition(payload['reviewAuthority'])) {
      return problems.REVIEW_AUTHORITY
    }
    if (
      typeof payload['beneficiaryAuthority'] !== 'string' ||
      !isProposalAuthorityPosition(payload['beneficiaryAuthority']) ||
      typeof payload['requestedEffect'] !== 'string' ||
      !PERMISSION_OVERLAY_EFFECT_VALUES.includes(payload['requestedEffect'] as PermissionOverlayEffect)
    ) {
      return problems.IDENTITY_DISAGREEMENT
    }
    return problems.CHAIN_BROKEN
  }

  /**
   * The derived state of one approval case (ADR A1-17: derived, never
   * stored). Every corruption is a TYPED problem with the offending
   * sequence — a case whose chain cannot be trusted is reported, never
   * repaired by guessing (A2-9).
   *
   * @param state - the freshly loaded durable state.
   * @param approvalCaseId - the case to derive.
   * @returns the case, or the typed read problem.
   */
  function buildApprovalCaseState(
    state: ControlState,
    approvalCaseId: string,
  ): ApprovalCaseReadOutcome {
    const problems = APPROVAL_CASE_READ_PROBLEMS
    const legs = state.requests
      .filter((row) => row.payload.approvalCaseId === approvalCaseId)
      .sort((a, b) => (a.payload.legOrdinal ?? 0) - (b.payload.legOrdinal ?? 0))
    const problem = (
      kind: (typeof APPROVAL_CASE_READ_PROBLEMS)[keyof typeof APPROVAL_CASE_READ_PROBLEMS],
      detail: string,
      sequence?: number,
    ): ApprovalCaseReadOutcome => ({
      kind: 'problem',
      problem: kind,
      approvalCaseId,
      ...(sequence !== undefined ? { sequence } : {}),
      detail,
    })
    // A row that names this case but that the strict parser refused is a
    // CORRUPT leg, and it is reported FIRST: a case with one damaged leg and
    // two readable ones is not a healthy case, and a case whose only leg is
    // damaged is not a missing case (ADR A2-9 — reported, never defaulted).
    for (const row of state.corruptLegs) {
      if (row.payload['approvalCaseId'] !== approvalCaseId) continue
      return problem(
        corruptLegProblemOf(row.payload),
        `a leg row of case '${approvalCaseId}' is corrupt and cannot be reconstructed`,
        row.entry.sequence,
      )
    }
    if (legs.length === 0) {
      return problem(problems.NOT_FOUND, 'no durable leg row carries this approvalCaseId')
    }
    const first = legs[0]
    // The same current-leg rule the guard uses (one home: `currentLegOf`).
    const lastLeg = currentLegOf(legs)
    if (first === undefined || lastLeg === undefined) {
      // Unreachable — `legs.length === 0` returned above. `noUncheckedIndexedAccess`
      // cannot see that, and a guard is cheaper than a non-null assertion on an
      // authority-bearing read.
      return problem(problems.NOT_FOUND, 'no durable leg row carries this approvalCaseId')
    }
    const ordinals = new Set<number>()
    for (const leg of legs) {
      const ordinal = leg.payload.legOrdinal
      if (ordinal === undefined) {
        return problem(
          problems.LEG_ORDINAL,
          `leg row '${leg.payload.requestId}' carries an approvalCaseId without a legOrdinal`,
          leg.entry.sequence,
        )
      }
      if (ordinals.has(ordinal)) {
        return problem(
          problems.CHAIN_BROKEN,
          `leg ordinal ${ordinal} appears more than once in case '${approvalCaseId}'`,
          leg.entry.sequence,
        )
      }
      ordinals.add(ordinal)
      if (leg.payload.reviewAuthority === undefined) {
        return problem(
          problems.REVIEW_AUTHORITY,
          `leg row '${leg.payload.requestId}' carries no reviewAuthority — nobody may be told who decides it`,
          leg.entry.sequence,
        )
      }
    }
    for (let ordinal = 1; ordinal <= legs.length; ordinal += 1) {
      if (!ordinals.has(ordinal)) {
        return problem(
          problems.CHAIN_BROKEN,
          `case '${approvalCaseId}' is missing leg ${ordinal} (ordinals: [${[...ordinals].join(', ')}])`,
        )
      }
    }
    const firstKey = legIdentityKeyOf(first.payload)
    if (first.payload.beneficiaryAuthority === undefined || first.payload.requestedEffect === undefined) {
      return problem(
        problems.IDENTITY_DISAGREEMENT,
        `the first leg of case '${approvalCaseId}' carries no frozen identity`,
        first.entry.sequence,
      )
    }
    if (first.payload.operationFingerprint !== undefined && first.payload.authorityScope === undefined) {
      // A1-14 (A4-PR7 Task 7.0): an OPERATION case with no authority point is
      // CORRUPT, not merely unsampled. After the v3-only cutover there is no
      // transitional scope shape to fall back to, so the case has no point a
      // ceiling could be re-run over — and an approval whose ceiling cannot be
      // re-confirmed is a case that cannot be honoured. Reported here (the case
      // read) and refused at the one place being wrong would execute (the
      // guard); NOT folded into the strict row parse, because a parse failure
      // drops the row and the guard's answer to a missing row is `no-request`,
      // which the tool layer reads as "proceed".
      return problem(
        problems.IDENTITY_DISAGREEMENT,
        `the first leg of case '${approvalCaseId}' is an operation case with no authorityScope (A1-14: nothing to re-confirm the ceiling over)`,
        first.entry.sequence,
      )
    }
    for (const leg of legs) {
      if (legIdentityKeyOf(leg.payload) !== firstKey) {
        return problem(
          problems.IDENTITY_DISAGREEMENT,
          `leg row '${leg.payload.requestId}' disagrees with the frozen case identity (A1-10)`,
          leg.entry.sequence,
        )
      }
    }
    const escalations = state.escalations.filter((row) => row.payload.approvalCaseId === approvalCaseId)
    const current = lastLeg
    const records = legs.map((leg) => toRequestRecord(leg.entry, leg.payload, state))
    const currentRecord = records[records.length - 1]
    if (currentRecord === undefined) {
      // Unreachable: `records` is `legs.map`, and `legs` is non-empty.
      return problem(problems.NOT_FOUND, 'no durable leg row carries this approvalCaseId')
    }
    const terminalDecision = state.decisions.find((d) => d.payload.requestId === current.payload.requestId)
    const currentStatus = currentRecord.status
    const reviewedBy: ControlCallerRef[] = []
    for (const leg of legs) {
      // The CURRENT leg is not "already acted on": its reviewer still holds
      // it. Everything before it is (spec 11.4: "old reviewer can no longer
      // act on this case"; ADR 24.5: the set is of PRINCIPALS, not legs).
      if (leg === current) continue
      const decision = state.decisions.find((d) => d.payload.requestId === leg.payload.requestId)
      if (decision !== undefined && !reviewedBy.some((r) => sameCallerRef(r, decision.payload.decider))) {
        reviewedBy.push(decision.payload.decider)
      }
      const escalation = escalations.find((e) => e.payload.previousRequestId === leg.payload.requestId)
      if (escalation !== undefined && !reviewedBy.some((r) => sameCallerRef(r, escalation.payload.escalatedBy))) {
        reviewedBy.push(escalation.payload.escalatedBy)
      }
    }
    const identity: ApprovalCaseIdentity = {
      approvalCaseId,
      subject: first.payload.subject,
      beneficiaryAuthority: first.payload.beneficiaryAuthority,
      requestedEffect: first.payload.requestedEffect,
      ...(first.payload.operationFingerprint !== undefined
        ? { operationFingerprint: first.payload.operationFingerprint }
        : {}),
      ...(first.payload.mutationProposalFingerprint !== undefined
        ? { mutationProposalFingerprint: first.payload.mutationProposalFingerprint }
        : {}),
      ...(first.payload.authorityScope !== undefined
        ? { authorityScope: first.payload.authorityScope }
        : {}),
      correlation: first.payload.correlation,
    }
    const status: ApprovalCaseState['status'] =
      currentStatus === 'abandoned' ? 'abandoned' : currentStatus === 'decided' ? 'decided' : 'open'
    return {
      kind: 'case',
      state: {
        identity,
        legs: records,
        escalations: escalations.map((e) => toEscalationRecord(e.entry, e.payload)),
        currentLeg: currentRecord,
        status,
        ...(terminalDecision !== undefined
          ? { terminalDecision: toDecisionRecord(terminalDecision.entry, terminalDecision.payload) }
          : {}),
        reviewedBy,
      },
    }
  }

  /**
   * The lock-held leg-row writer (A4-PR3).
   *
   * PRECONDITION: the caller holds this team's per-team lock. `withTeamLock`
   * is a queue, not a reentrant lock, so the risen leg of an escalation
   * CANNOT go through the public `requestControl` from inside the
   * escalation's own lock hold — it would queue behind itself. This writer
   * produces a row byte-comparable to the public path's (the same scope key,
   * the same leg-key extension of the request id, the same `legFieldsOf`
   * projection) and performs NO authority step of its own: the risen leg is
   * created BY THE SERVICE as the consequence of an escalation whose caller
   * has already passed the resolve-control gate, and a PENDING leg
   * authorizes nothing (the guard's exhaustive switch is what decides).
   */
  async function writeLegRowLocked(input: {
    readonly root: string
    readonly kind: ControlRequestKind
    readonly requester: ControlCallerRef
    readonly subject: ControlSubject
    readonly actionName: string
    readonly toolName?: string
    readonly capabilityDomain?: CapabilityName
    readonly correlation: string
    readonly operationFingerprint?: string
    readonly summary?: string
    readonly executionCoupling?: ControlExecutionCoupling
    readonly leg: LegFields
  }): Promise<ControlRequestRecord> {
    const key = scopeKey(
      input.root,
      subjectIdentityOf(input.subject),
      input.actionName,
      input.toolName,
      input.correlation,
      input.operationFingerprint,
    )
    const legKey = legKeyOf(input.leg)
    const state = loadControlState(input.root)
    const existing = state.requests.find(
      (row) =>
        scopeKey(
          String(row.entry.rootSessionId),
          subjectIdentityOf(row.payload.subject),
          row.payload.actionName,
          row.payload.toolName,
          row.payload.correlation,
          row.payload.operationFingerprint,
        ) === key && legKeyOf(row.payload) === legKey,
    )
    if (existing !== undefined) {
      return toRequestRecord(existing.entry, existing.payload, state)
    }
    const requestId = requestIdOf(legKey === '' ? key : `${key}\u0000${legKey}`)
    const payload: Record<string, unknown> = {
      requestId,
      kind: input.kind,
      requester: input.requester,
      subject: input.subject,
      ...(input.subject.kind === CONTROL_SUBJECT_KINDS.INSTANCE
        ? { targetInstanceId: input.subject.instanceId }
        : {}),
      actionName: input.actionName,
      correlation: input.correlation,
      ...(input.toolName !== undefined ? { toolName: input.toolName } : {}),
      ...(input.capabilityDomain !== undefined ? { capabilityDomain: input.capabilityDomain } : {}),
      ...(input.operationFingerprint !== undefined
        ? { operationFingerprint: input.operationFingerprint }
        : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.executionCoupling !== undefined
        ? { executionCoupling: input.executionCoupling }
        : {}),
      ...legFieldsOf(input.leg),
      // A4-PR7 Task 7.0 (ADR A1-14): the authority point on the LEG-FACT route
      // too. `legFieldsOf` returns `Partial<ControlRequestRecord>` and the
      // READ-BACK record deliberately does not carry the point (the frozen v7
      // remote DTO is not widened by PR7), so the point rides here as its own
      // spread — exactly as `requestControl` writes it on the creation route.
      // Without this line the risen leg of an escalated case arrives at the
      // consumption point unbound: the original leg's approval, re-authorized at
      // a higher rung, would refuse its own operation with
      // `authority-scope-unbound`, and the exactly-once law of a case chain
      // would be pinned over a path that no longer runs.
      ...(input.leg.authorityScope !== undefined
        ? { authorityScope: input.leg.authorityScope }
        : {}),
    }
    const sequence = await putEntry({
      schemaVersion: 2,
      sequence: await allocateSequence(),
      rootSessionId: input.root,
      factType: FACT_REQUEST,
      payload,
      createdAt: options.now(),
    })
    // The return value is READ BACK from the durable row rather than
    // assembled here: a leg writer that reports a record the reader could not
    // produce is exactly the writer/reader disagreement A2-9 forbids.
    const after = loadControlState(input.root)
    const written = after.requests.find(
      (row) => row.payload.requestId === requestId && legKeyOf(row.payload) === legKey,
    )
    if (written === undefined) {
      throw new ControlError(
        CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
        'ControlService: the leg row just written does not parse back (writer/reader disagreement)',
        { stage: 'leg', requestId, sequence },
      )
    }
    return toRequestRecord(written.entry, written.payload, after)
  }

  // --- requestApprovalLeg --------------------------------------------------------------

  async function requestApprovalLeg(args: {
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
  }): Promise<ControlRequestLegOutcome> {
    const root = parseRoot(
      args.rootSessionId,
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
      'requestApprovalLeg',
    )
    if (!isActionCaller(args.caller)) {
      throw malformed(
        'requestApprovalLeg',
        'caller',
        'caller must be {kind:human,humanId} or {kind:instance,instanceId}',
      )
    }
    if (!CONTROL_REQUEST_KIND_VALUES.includes(args.kind)) {
      throw malformed('requestApprovalLeg', 'kind', `unknown control request kind ${JSON.stringify(args.kind)}`)
    }
    const identityProblem = caseIdentityProblemOf(args.kind, args.identity)
    if (identityProblem !== undefined) {
      throw malformed(
        'requestApprovalLeg',
        'identity',
        `the approval case identity is refused (${identityProblem}); exactly one fingerprint is required and every vocabulary value must be closed-set`,
      )
    }
    if (!isProposalAuthorityPosition(args.reviewAuthority)) {
      throw malformed('requestApprovalLeg', 'reviewAuthority', `reviewAuthority outside the closed ladder: ${JSON.stringify(args.reviewAuthority)}`)
    }
    if (!isProposalAuthorityPosition(args.requiredAuthorityAtCreation)) {
      throw malformed(
        'requestApprovalLeg',
        'requiredAuthorityAtCreation',
        `requiredAuthorityAtCreation outside the closed ladder: ${JSON.stringify(args.requiredAuthorityAtCreation)}`,
      )
    }
    const approvalCaseId = approvalCaseIdOf(root, args.kind, args.identity)
    // ADR A1-12 — a case whose reviewer cannot exist terminates HERE, before
    // any wait: in Alpha.4 the top of the ladder has no resolver, so an OPEN
    // leg would be exactly the fake pending Admin request acceptance 21.10
    // forbids. Amended by audit F2: the termination writes a leg row that is
    // BORN TERMINAL plus its deny, so it is durable and auditable and still
    // never pending (the open-case read and the fold both skip decided rows).
    if (!hasAuthorityResolver(args.reviewAuthority)) {
      // ADR A1-12 / audit F2: the termination is DURABLE. The leg row the close
      // writes is born terminal — decided in the same transaction — so the case
      // is observable and auditable while still never appearing pending (which
      // is what acceptance 21.10 forbids). Not a `return` without the write: an
      // unobservable termination cannot be reported, closed by a later lane, or
      // awaited by A5-5's inline waiter.
      await closeZeroReviewCaseTransactionally({
        root,
        approvalCaseId,
        decider: callerRefOf(resolveCaller(repositories, root, args.caller)),
        terminalReason: 'resolver-unavailable',
        note: `no resolver exists for reviewAuthority '${args.reviewAuthority}' in Alpha.4 (ADR A1-12, spec 11.6)`,
        newCase: {
          kind: args.kind,
          reviewAuthority: args.reviewAuthority,
          actionName: args.actionName,
          ...(args.toolName !== undefined ? { toolName: args.toolName } : {}),
          caller: args.caller,
          identity: args.identity,
        },
      })
      return {
        kind: CONTROL_CASE_TERMINAL_OUTCOMES.AUTHORITY_UNAVAILABLE,
        approvalCaseId,
        reviewAuthority: args.reviewAuthority,
        requiredAuthority: args.requiredAuthorityAtCreation,
        detail: `no resolver exists for reviewAuthority '${args.reviewAuthority}' in Alpha.4 — the case terminated synchronously with a durable terminal deny and was never open for review (ADR A1-12, spec 11.6)`,
      }
    }
    const leg = await requestControl({
      rootSessionId: root,
      caller: args.caller,
      kind: args.kind,
      subject: args.identity.subject,
      actionName: args.actionName,
      ...(args.toolName !== undefined ? { toolName: args.toolName } : {}),
      ...(args.capabilityDomain !== undefined ? { capabilityDomain: args.capabilityDomain } : {}),
      correlation: args.identity.correlation,
      ...(args.identity.operationFingerprint !== undefined
        ? { operationFingerprint: args.identity.operationFingerprint }
        : {}),
      ...(args.summary !== undefined ? { summary: args.summary } : {}),
      ...(args.executionCoupling !== undefined
        ? { executionCoupling: args.executionCoupling }
        : {}),
      leg: {
        approvalCaseId,
        legOrdinal: 1,
        reviewAuthority: args.reviewAuthority,
        requiredAuthorityAtCreation: args.requiredAuthorityAtCreation,
        beneficiaryAuthority: args.identity.beneficiaryAuthority,
        requestedEffect: args.identity.requestedEffect,
        ...(args.identity.mutationProposalFingerprint !== undefined
          ? { mutationProposalFingerprint: args.identity.mutationProposalFingerprint }
          : {}),
        ...(args.identity.authorityScope !== undefined
          ? { authorityScope: args.identity.authorityScope }
          : {}),
      },
    })
    // A retry of a flow whose case has already risen returns the case's
    // CURRENT leg, never the closed first leg: the caller must never be
    // handed a terminal row to wait on (the same reasoning as A5-5).
    const read = await readApprovalCaseState({ rootSessionId: root, approvalCaseId })
    if (read.kind === 'problem') {
      // A corrupt chain has NO current leg, and "therefore hand back the FIRST
      // one" is the wrong conclusion (fidelity review #2): the first leg of a
      // risen case is terminal, and an inline waiter told to wait on it waits
      // on a closed row while the case sits at another authority. The frozen
      // return type has no arm for a corrupt read, so the corruption surfaces
      // as a typed refusal naming the problem — the same shape as the
      // `writeLegRowLocked` read-back throw: refuse rather than guess.
      throw new ControlError(
        CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
        `ControlService: requestApprovalLeg refused — case '${approvalCaseId}' is corrupt (${read.problem}), so its current leg cannot be handed back; repair or terminate the case instead of retrying the identity`,
        { rootSessionId: root, approvalCaseId, problem: read.problem },
      )
    }
    if (read.state.currentLeg !== undefined) {
      return { kind: 'leg', leg: read.state.currentLeg }
    }
    return { kind: 'leg', leg }
  }

  // --- escalateApprovalLeg -------------------------------------------------------------

  async function escalateApprovalLeg(args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly requestId: string
    readonly reason?: string
  }): Promise<ControlEscalationOutcome> {
    const root = parseRoot(
      args.rootSessionId,
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
      'escalateApprovalLeg',
    )
    if (typeof args.requestId !== 'string' || args.requestId.length === 0) {
      throw malformed('escalateApprovalLeg', 'requestId', 'requestId must be a non-empty string')
    }
    if (args.reason !== undefined && typeof args.reason !== 'string') {
      throw malformed('escalateApprovalLeg', 'reason', 'reason must be a string when present')
    }
    // The SAME authority steps as a decision (spec 24.4: "two entrances, one
    // write path") — escalation is a reviewer act, so it is gated exactly
    // like `resolveControl`, and never through a second, softer gate.
    const caller = resolveCaller(repositories, root, args.caller)
    const resolved = resolveTeamAndTarget(
      repositories,
      options.blueprintCatalog,
      {
        rootSessionId: root,
        action: ACTION_NAMES.RESOLVE_CONTROL,
        caller: args.caller,
        requestToken: args.requestId,
      },
      RESOLVE_CONTROL_SPEC,
    )
    return withTeamLock(teamLocks, root, async () => {
      const state = loadControlState(root)
      const leg = state.requests.find((row) => row.payload.requestId === args.requestId)
      if (leg === undefined) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND,
          `ControlService: no durable control request '${args.requestId}' in team '${root}' (an escalation without a leg)`,
          { rootSessionId: root, requestId: args.requestId },
        )
      }
      if (state.abandonments.some((a) => a.payload.requestId === args.requestId)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
          `ControlService: request '${args.requestId}' is durably abandoned — an escalated-away leg cannot be re-opened and an abandoned leg cannot be escalated (zero durable side effects)`,
          { rootSessionId: root, requestId: args.requestId },
        )
      }
      if (state.decisions.some((d) => d.payload.requestId === args.requestId)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED,
          `ControlService: request '${args.requestId}' already carries a durable decision — a terminal leg is terminal (zero durable side effects)`,
          { rootSessionId: root, requestId: args.requestId },
        )
      }
      const approvalCaseId = leg.payload.approvalCaseId
      const legOrdinal = leg.payload.legOrdinal
      const reviewAuthority = leg.payload.reviewAuthority
      if (approvalCaseId === undefined || legOrdinal === undefined || reviewAuthority === undefined) {
        throw malformed(
          'escalateApprovalLeg',
          'approvalCaseId',
          `request '${args.requestId}' is a pre-Alpha.4 row with no approval-case identity — there is no case to rise (escalation requires a leg row)`,
        )
      }
      const allowedRoles = CONTROL_RESOLVER_ROLES[leg.payload.kind]
      if (!allowedRoles.includes(caller.role)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
          `ControlService: role '${caller.role}' is not a resolver for kind '${leg.payload.kind}' (allowed: [${allowedRoles.join(', ')}])`,
          {
            rootSessionId: root,
            requestId: args.requestId,
            kind: leg.payload.kind,
            role: caller.role,
            allowedRoles: [...allowedRoles],
          },
        )
      }
      enforceEnvelope(
        RESOLVE_CONTROL_SPEC,
        callerEnvelope(resolved.bound.blueprint, caller, repositories.overrides.list(root)),
      )
      const decider = callerRefOf(caller)
      // Spec 11.4 / ADR A1-10 + 24.5 — the shared case law (one home:
      // `assertNoActOnEarlierLeg`), applied at every decision entrance.
      assertNoActOnEarlierLeg(state, {
        root,
        stage: 'escalateApprovalLeg',
        requestId: args.requestId,
        approvalCaseId,
        legOrdinal,
        decider,
      })
      const scope = scopeOf(leg.entry, leg.payload)
      // A risen leg is a NEW durable, authority-bearing row, and it carries the
      // case's FROZEN identity (A2-7). The three identity fields are therefore
      // copied from the parent row and verified BEFORE anything is written
      // (fidelity review #4, A2-9): they were previously defaulted to the
      // successor and to `ask`. Invention is the worse failure here, not the
      // safer one — `beneficiaryAuthority` PARTICIPATES in the derived case id,
      // so an invented value makes the legs of one case disagree, and the case
      // read reports that as IDENTITY_DISAGREEMENT: the rise would have
      // destroyed the case it was advancing. A pre-Alpha.4-shaped row that
      // carries no identity is refused, naming the missing fields.
      // Only a rise that actually MINTS a leg needs one: at the top of the
      // ladder, or below a rung with no resolver, the case terminates instead
      // (spec 11.6, ADR A1-12) and writes no identity anywhere.
      const frozenIdentity =
        leg.payload.requiredAuthorityAtCreation !== undefined &&
        leg.payload.beneficiaryAuthority !== undefined &&
        leg.payload.requestedEffect !== undefined
          ? {
              requiredAuthorityAtCreation: leg.payload.requiredAuthorityAtCreation,
              beneficiaryAuthority: leg.payload.beneficiaryAuthority,
              requestedEffect: leg.payload.requestedEffect,
            }
          : undefined
      const successor = controlEscalationSuccessor(reviewAuthority)
      const mintsRisenLeg = successor !== null && hasAuthorityResolver(successor)
      if (mintsRisenLeg && frozenIdentity === undefined) {
        throw malformed(
          'escalateApprovalLeg',
          'requiredAuthorityAtCreation',
          `the leg row '${args.requestId}' carries no frozen case identity (requiredAuthorityAtCreation / beneficiaryAuthority / requestedEffect) — a risen leg is never written with an invented one, and an invented beneficiary would split case '${approvalCaseId}' (zero durable side effects)`,
        )
      }
      // WRITE 1 of 3 (ADR A5-5): the terminal deny carrying the additive
      // reason `escalated`. This is the row that makes the inline waiter
      // settle; if it were written with an out-of-vocabulary reason the read
      // gate would drop it and the waiter would hang.
      // When no leg rises, THIS row is the case's last durable word, and A2-8
      // has already named the field that says why: `terminalReason`
      // `resolver-unavailable` ("No resolver exists for the authority this
      // case needs", ADR A1-12 / spec 11.6). The born-terminal twin close in
      // `requestApprovalLeg` (`closeZeroReviewCaseTransactionally`) stamps it;
      // until the escalate-truth fix this branch did not, so the record read
      // bare `deny · escalated` — indistinguishable for every reader that does not also
      // fold the case, which is audit F2's mute-close defect re-armed on the
      // OTHER A1-12 entrance. An ABSENT terminalReason keeps its A2-8 meaning
      // (reviewer-chosen close / a rise: the case continues above).
      const terminalDecision = await commitDecision({
        requestId: args.requestId,
        value: CONTROL_DECISION_VALUES.DENY,
        decider,
        scope,
        requestSequence: leg.entry.sequence,
        reason: CONTROL_DECISION_REASONS.ESCALATED,
        ...(mintsRisenLeg ? {} : { terminalReason: CONTROL_LEG_TERMINAL_REASONS.RESOLVER_UNAVAILABLE }),
        ...(args.reason !== undefined ? { note: args.reason } : {}),
      })
      // WRITE 2 of 3: the additive leg fact, payload FROZEN at the A3-12(ii)
      // five fields (`note` deliberately does NOT join the payload — the
      // reviewer's evidence text lives on the terminal decision row).
      const escalationPayload: Record<string, unknown> = {
        approvalCaseId,
        legOrdinal,
        previousRequestId: args.requestId,
        escalatedBy: decider,
        ...(args.reason !== undefined ? { reason: args.reason } : {}),
      }
      const escalationSequence = await putEntry({
        schemaVersion: 2,
        sequence: await allocateSequence(),
        rootSessionId: root,
        factType: FACT_ESCALATION,
        payload: escalationPayload,
        createdAt: options.now(),
      })
      const escalation: ControlEscalationRecord = {
        approvalCaseId,
        legOrdinal,
        previousRequestId: args.requestId,
        escalatedBy: decider,
        ...(args.reason !== undefined ? { reason: args.reason } : {}),
        escalationSequence,
        createdAt: options.now(),
      }
      // WRITE 3 of 3 — the risen leg, SKIPPED at the top of the ladder
      // (spec 11.6): the case terminates instead of waiting for a reviewer
      // that cannot exist.
      // Legality of the rise comes from the FROZEN LADDER (spec 21.5), not
      // from a caller-supplied "someone can review this" flag: a successor
      // that exists on the ladder but has no resolver in Alpha.4 terminates
      // the case exactly like the top of the ladder does (ADR A1-12).
      // The `frozenIdentity === undefined` disjunct is unreachable — the
      // refusal above already threw for it; it stands here so the mint below is
      // typed off the verified values instead of off a default.
      if (!mintsRisenLeg || frozenIdentity === undefined) {
        return {
          escalation,
          terminalDecision,
          caseOutcome: CONTROL_CASE_OUTCOMES.AUTHORITY_UNAVAILABLE,
        }
      }
      const nextLeg = await writeLegRowLocked({
        root,
        kind: leg.payload.kind,
        requester: leg.payload.requester,
        subject: leg.payload.subject,
        actionName: leg.payload.actionName,
        ...(leg.payload.toolName !== undefined ? { toolName: leg.payload.toolName } : {}),
        ...(leg.payload.capabilityDomain !== undefined
          ? { capabilityDomain: leg.payload.capabilityDomain }
          : {}),
        correlation: leg.payload.correlation,
        ...(leg.payload.operationFingerprint !== undefined
          ? { operationFingerprint: leg.payload.operationFingerprint }
          : {}),
        ...(leg.payload.summary !== undefined ? { summary: leg.payload.summary } : {}),
        ...(leg.payload.executionCoupling !== undefined
          ? { executionCoupling: leg.payload.executionCoupling }
          : {}),
        leg: {
          approvalCaseId,
          legOrdinal: legOrdinal + 1,
          reviewAuthority: successor,
          requiredAuthorityAtCreation: frozenIdentity.requiredAuthorityAtCreation,
          previousRequestId: args.requestId,
          beneficiaryAuthority: frozenIdentity.beneficiaryAuthority,
          requestedEffect: frozenIdentity.requestedEffect,
          ...(leg.payload.mutationProposalFingerprint !== undefined
            ? { mutationProposalFingerprint: leg.payload.mutationProposalFingerprint }
            : {}),
          // A1-14: the risen leg is the SAME case, so it carries the SAME
          // frozen authority point — a leg that "forgot" it would arrive at the
          // consumption point un-reconfirmable (and A1-10's identity-frozen
          // escalation is exactly the rule this follows).
          ...(leg.payload.authorityScope !== undefined
            ? { authorityScope: leg.payload.authorityScope }
            : {}),
        },
      })
      return {
        escalation,
        terminalDecision,
        nextLeg,
        caseOutcome: CONTROL_CASE_OUTCOMES.ESCALATED,
      }
    })
  }

  // --- readApprovalCaseState / listOpenApprovalCases -----------------------------------

  async function readApprovalCaseState(args: {
    readonly rootSessionId: string
    readonly approvalCaseId: string
  }): Promise<ApprovalCaseReadOutcome> {
    const root = parseRoot(
      args.rootSessionId,
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
      'readApprovalCaseState',
    )
    if (typeof args.approvalCaseId !== 'string' || args.approvalCaseId.length === 0) {
      throw malformed('readApprovalCaseState', 'approvalCaseId', 'approvalCaseId must be a non-empty string')
    }
    return withTeamLock(teamLocks, root, async () => {
      if (repositories.teamSessions.get(root) === undefined) {
        throw new TeamRuntimeError(
          TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
          `ControlService: no TeamSession record for root session '${root}'`,
          { rootSessionId: root },
        )
      }
      return buildApprovalCaseState(loadControlState(root), args.approvalCaseId)
    })
  }

  async function listOpenApprovalCases(args: {
    readonly rootSessionId: string
    readonly subject?: ControlSubject
  }): Promise<readonly ApprovalCaseSummary[]> {
    const root = parseRoot(
      args.rootSessionId,
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
      'listOpenApprovalCases',
    )
    return withTeamLock(teamLocks, root, async () => {
      if (repositories.teamSessions.get(root) === undefined) {
        throw new TeamRuntimeError(
          TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
          `ControlService: no TeamSession record for root session '${root}'`,
          { rootSessionId: root },
        )
      }
      const state = loadControlState(root)
      const caseIds: string[] = []
      for (const row of state.requests) {
        const caseId = row.payload.approvalCaseId
        if (caseId === undefined || caseIds.includes(caseId)) continue
        caseIds.push(caseId)
      }
      const summaries: ApprovalCaseSummary[] = []
      for (const caseId of caseIds) {
        const read = buildApprovalCaseState(state, caseId)
        // A corrupt case is NOT listed as open (fail closed: an unreadable
        // chain is surfaced by `readApprovalCaseState`, never guessed here).
        if (read.kind !== 'case') continue
        if (read.state.status !== 'open') continue
        if (
          args.subject !== undefined &&
          subjectIdentityOf(read.state.identity.subject) !== subjectIdentityOf(args.subject)
        ) {
          continue
        }
        const currentLeg = read.state.currentLeg
        if (currentLeg === undefined) continue
        summaries.push({ state: read.state, carrierKind: currentLeg.kind })
      }
      return summaries
    })
  }

  async function listDecidedApprovalCases(args: {
    readonly rootSessionId: string
    readonly subject?: ControlSubject
  }): Promise<readonly ApprovalCaseSummary[]> {
    const root = parseRoot(
      args.rootSessionId,
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
      'listDecidedApprovalCases',
    )
    return withTeamLock(teamLocks, root, async () => {
      if (repositories.teamSessions.get(root) === undefined) {
        throw new TeamRuntimeError(
          TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
          `ControlService: no TeamSession record for root session '${root}'`,
          { rootSessionId: root },
        )
      }
      const state = loadControlState(root)
      const caseIds: string[] = []
      for (const row of state.requests) {
        const caseId = row.payload.approvalCaseId
        if (caseId === undefined || caseIds.includes(caseId)) continue
        caseIds.push(caseId)
      }
      const summaries: ApprovalCaseSummary[] = []
      for (const caseId of caseIds) {
        const read = buildApprovalCaseState(state, caseId)
        // The same fail-closed law as the open read (a corrupt case is not
        // reported here either — `readApprovalCaseState` owns that report).
        if (read.kind !== 'case') continue
        // A1-12 "the told half": the EXACT mirror of `listOpenApprovalCases`
        // with the DECIDED filter. This read states a fold fact ("the current
        // leg carries a decision"); it expresses NO surfacing opinion — which
        // decided closes an operator sees (the `resolver-unavailable` rule of
        // spec 11.6 / plan 6.D) is the intervention lane's law, applied in
        // `intervention/projection.ts` where the item-status vocabulary lives.
        if (read.state.status !== 'decided') continue
        if (
          args.subject !== undefined &&
          subjectIdentityOf(read.state.identity.subject) !== subjectIdentityOf(args.subject)
        ) {
          continue
        }
        const currentLeg = read.state.currentLeg
        if (currentLeg === undefined) continue
        summaries.push({ state: read.state, carrierKind: currentLeg.kind })
      }
      return summaries
    })
  }

  // --- appendTerminalOutcome -----------------------------------------------------------

  /**
   * The FROZEN mapping from a terminal reason to the durable decision value
   * it must be recorded with (ADR A2-8). Exported through the barrel so
   * PR4/PR5 never choose a decision value for a terminal close themselves:
   * every reason maps to `deny`, which is the structural statement that a
   * close the reviewer did not choose can never mint authority.
   *
   * @param _terminalReason - the closed terminal reason.
   * @returns the decision value the terminal row carries.
   */
  function terminalDecisionValueFor(_terminalReason: ControlLegTerminalReason): ControlDecisionValue {
    return CONTROL_DECISION_VALUES.DENY
  }

  async function appendTerminalOutcome(args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly requestId: string
    readonly terminalReason: ControlLegTerminalReason
    readonly note?: string
  }): Promise<ControlDecisionRecord> {
    const root = parseRoot(
      args.rootSessionId,
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
      'appendTerminalOutcome',
    )
    if (typeof args.requestId !== 'string' || args.requestId.length === 0) {
      throw malformed('appendTerminalOutcome', 'requestId', 'requestId must be a non-empty string')
    }
    if (!CONTROL_LEG_TERMINAL_REASON_VALUES.includes(args.terminalReason)) {
      throw malformed(
        'appendTerminalOutcome',
        'terminalReason',
        `terminalReason outside the closed set: ${JSON.stringify(args.terminalReason)}`,
      )
    }
    if (args.note !== undefined && typeof args.note !== 'string') {
      throw malformed('appendTerminalOutcome', 'note', 'note must be a string when present')
    }
    const caller = resolveCaller(repositories, root, args.caller)
    const resolved = resolveTeamAndTarget(
      repositories,
      options.blueprintCatalog,
      {
        rootSessionId: root,
        action: ACTION_NAMES.RESOLVE_CONTROL,
        caller: args.caller,
        requestToken: args.requestId,
      },
      RESOLVE_CONTROL_SPEC,
    )
    return withTeamLock(teamLocks, root, async () => {
      const state = loadControlState(root)
      const leg = state.requests.find((row) => row.payload.requestId === args.requestId)
      if (leg === undefined) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND,
          `ControlService: no durable control request '${args.requestId}' in team '${root}' (a terminal outcome without a leg)`,
          { rootSessionId: root, requestId: args.requestId },
        )
      }
      if (state.abandonments.some((a) => a.payload.requestId === args.requestId)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
          `ControlService: request '${args.requestId}' is durably abandoned — a terminal outcome is written at most once (zero durable side effects)`,
          { rootSessionId: root, requestId: args.requestId },
        )
      }
      if (state.decisions.some((d) => d.payload.requestId === args.requestId)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED,
          `ControlService: request '${args.requestId}' already carries a durable decision — a terminal outcome is written at most once (zero durable side effects)`,
          { rootSessionId: root, requestId: args.requestId },
        )
      }
      const allowedRoles = CONTROL_RESOLVER_ROLES[leg.payload.kind]
      if (!allowedRoles.includes(caller.role)) {
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
          `ControlService: role '${caller.role}' is not a resolver for kind '${leg.payload.kind}' (allowed: [${allowedRoles.join(', ')}])`,
          { rootSessionId: root, requestId: args.requestId, role: caller.role },
        )
      }
      // Alpha.4 A4-PR3 (fidelity review #1) — the OTHER decision entrance, the
      // SAME law from the SAME home. Two entrances that could diverge is how
      // finding #1 stayed invisible: the terminal-outcome path was as blind to
      // the case as `resolveControl` was.
      const caseIdOfTerminalLeg = leg.payload.approvalCaseId
      if (caseIdOfTerminalLeg !== undefined) {
        assertNoActOnEarlierLeg(state, {
          root,
          stage: 'appendTerminalOutcome',
          requestId: args.requestId,
          approvalCaseId: caseIdOfTerminalLeg,
          legOrdinal: leg.payload.legOrdinal ?? 0,
          decider: callerRefOf(caller),
        })
      }
      enforceEnvelope(
        RESOLVE_CONTROL_SPEC,
        callerEnvelope(resolved.bound.blueprint, caller, repositories.overrides.list(root)),
      )
      return await commitDecision({
        requestId: args.requestId,
        value: terminalDecisionValueFor(args.terminalReason),
        decider: callerRefOf(caller),
        scope: scopeOf(leg.entry, leg.payload),
        requestSequence: leg.entry.sequence,
        terminalReason: args.terminalReason,
        ...(args.note !== undefined ? { note: args.note } : {}),
      })
    })
  }

  /**
   * The ONE writer of a born-terminal close (audit F2). Both entry points route
   * through it, so a case that cannot be reviewed has exactly one durable shape
   * anywhere in the plane: a leg row at ordinal 1 carrying the frozen identity
   * and naming the rung that could not review it, plus its terminal `deny`.
   *
   * NAMING (fidelity review #3). Everywhere else in this file a `*Locked` suffix
   * means "the CALLER already holds the per-team lock". This function is the
   * transaction OWNER: it ACQUIRES the lock itself, so its callers must not hold
   * it (`withTeamLock` is not reentrant). It is therefore named
   * `Transactionally`, not `Locked`.
   *
   * "Transactionally" means SERIALIZED, not ATOMIC (fidelity review #3): the two
   * rows land through two `ledger.put` calls inside one lock acquisition, so a
   * fault between them can leave the leg row without its deny. What matters is
   * what the RETRY does with that half-state — see the open-leg branch below.
   *
   * Idempotency is the CASE, not the call: a second close returns the closure
   * the first one wrote, and the idempotent return is READ BACK from the durable
   * rows so a retry cannot report something the ledger does not hold.
   */
  async function closeZeroReviewCaseTransactionally(input: {
    readonly root: string
    readonly approvalCaseId: string
    readonly decider: ControlCallerRef
    readonly terminalReason: ControlLegTerminalReason
    readonly note?: string
    /** Present only when the case may still be unwritten (the identity form). */
    readonly newCase?: {
      readonly kind: ControlRequestKind
      readonly reviewAuthority: ProposalAuthorityPosition
      readonly actionName: string
      readonly toolName?: string
      readonly caller: ActionCaller
      readonly identity: ApprovalCaseIdentityInput
    }
  }): Promise<ControlCaseClosure> {
    return withTeamLock(teamLocks, input.root, async () => {
      const state = loadControlState(input.root)
      for (const leg of state.requests) {
        if (leg.payload.approvalCaseId !== input.approvalCaseId) continue
        const decision = state.decisions.find(
          (row) => row.payload.requestId === leg.payload.requestId,
        )
        if (decision === undefined) {
          // Two shapes share this branch (fidelity review #3).
          // (a) A leg on a rung that CAN review it: that leg belongs to
          //     `appendTerminalOutcome`, and closing it here would steal a
          //     review — refuse, zero writes.
          // (b) A leg on a rung with NO resolver: nobody can ever review it, so
          //     this is a close half-written by a `ledger.put` fault (the leg row
          //     landed, its deny did not). Refusing the retry would keep an open
          //     leg on an unreviewable rung forever — the fake-pending state
          //     ADR A1-12 and acceptance 21.10 forbid, unreachable by any
          //     entrance — so the retry COMPLETES the missing write and returns
          //     the closure the first attempt was trying to produce. The
          //     recorded `terminalReason` is the retry's, which is the only one
          //     the ledger was ever told about.
          const legAuthority = leg.payload.reviewAuthority
          if (legAuthority === undefined || hasAuthorityResolver(legAuthority)) {
            throw new ControlError(
              CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
              `ControlService: case '${input.approvalCaseId}' has an open leg '${leg.payload.requestId}' — close it with appendTerminalOutcome, not with a zero-review close (zero durable side effects)`,
              { rootSessionId: input.root, approvalCaseId: input.approvalCaseId },
            )
          }
          const completedDecision = await commitDecision({
            requestId: leg.payload.requestId,
            value: terminalDecisionValueFor(input.terminalReason),
            decider: input.decider,
            scope: scopeOf(leg.entry, leg.payload),
            requestSequence: leg.entry.sequence,
            terminalReason: input.terminalReason,
            ...(input.note !== undefined ? { note: input.note } : {}),
          })
          return {
            approvalCaseId: input.approvalCaseId,
            leg: toRequestRecord(leg.entry, leg.payload, state),
            terminalDecision: completedDecision,
          }
        }
        return {
          approvalCaseId: input.approvalCaseId,
          leg: toRequestRecord(leg.entry, leg.payload, state),
          terminalDecision: toDecisionRecord(decision.entry, decision.payload),
        }
      }
      const newCase = input.newCase
      if (newCase === undefined) {
        // Nothing to close and no identity to write from: the caller named a
        // case that does not exist.
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND,
          `ControlService: no durable leg row carries approvalCaseId '${input.approvalCaseId}' — closing a case that was never opened needs the identity form (zero durable side effects)`,
          { rootSessionId: input.root, approvalCaseId: input.approvalCaseId },
        )
      }
      const written = await writeLegRowLocked({
        root: input.root,
        kind: newCase.kind,
        requester: callerRefOf(resolveCaller(repositories, input.root, newCase.caller)),
        subject: newCase.identity.subject,
        actionName: newCase.actionName,
        ...(newCase.toolName !== undefined ? { toolName: newCase.toolName } : {}),
        correlation: newCase.identity.correlation,
        ...(newCase.identity.operationFingerprint !== undefined
          ? { operationFingerprint: newCase.identity.operationFingerprint }
          : {}),
        leg: {
          approvalCaseId: input.approvalCaseId,
          legOrdinal: 1,
          reviewAuthority: newCase.reviewAuthority,
          requiredAuthorityAtCreation: newCase.reviewAuthority,
          beneficiaryAuthority: newCase.identity.beneficiaryAuthority,
          requestedEffect: newCase.identity.requestedEffect,
          ...(newCase.identity.mutationProposalFingerprint !== undefined
            ? { mutationProposalFingerprint: newCase.identity.mutationProposalFingerprint }
            : {}),
          ...(newCase.identity.authorityScope !== undefined
            ? { authorityScope: newCase.identity.authorityScope }
            : {}),
        },
      })
      // Re-read inside the lock: the scope snapshot and both records come from
      // the row the ledger holds, never from a reconstruction.
      const after = loadControlState(input.root)
      const row = after.requests.find((r) => r.payload.requestId === written.requestId)
      if (row === undefined) {
        throw durableFailure(
          'zero-review leg row read-back',
          new Error(
            `requestId '${written.requestId}' written into case '${input.approvalCaseId}' is absent from the re-read state`,
          ),
        )
      }
      const terminalDecision = await commitDecision({
        requestId: row.payload.requestId,
        value: terminalDecisionValueFor(input.terminalReason),
        decider: input.decider,
        scope: scopeOf(row.entry, row.payload),
        requestSequence: row.entry.sequence,
        terminalReason: input.terminalReason,
        ...(input.note !== undefined ? { note: input.note } : {}),
      })
      return {
        approvalCaseId: input.approvalCaseId,
        leg: toRequestRecord(row.entry, row.payload, after),
        terminalDecision,
      }
    })
  }

  async function closeApprovalCaseWithoutLeg(args: {
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
  }): Promise<ControlCaseClosure> {
    const stage = 'closeApprovalCaseWithoutLeg'
    const root = parseRoot(args.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, stage)
    if (!isActionCaller(args.caller)) {
      throw malformed(stage, 'caller', 'caller must be {kind:human,humanId} or {kind:instance,instanceId}')
    }
    if (!CONTROL_LEG_TERMINAL_REASON_VALUES.includes(args.terminalReason)) {
      throw malformed(
        stage,
        'terminalReason',
        `terminalReason outside the closed set: ${JSON.stringify(args.terminalReason)}`,
      )
    }
    if (args.note !== undefined && typeof args.note !== 'string') {
      throw malformed(stage, 'note', 'note must be a string when present')
    }
    const hasIdentity = args.identity !== undefined
    const hasCaseId = typeof args.approvalCaseId === 'string' && args.approvalCaseId.length > 0
    if (hasIdentity === hasCaseId) {
      throw malformed(
        stage,
        'identity',
        'exactly one of `identity` (a case that may not exist yet) or `approvalCaseId` (an existing case) is required',
      )
    }
    const kind = args.carrier?.kind ?? CONTROL_REQUEST_KINDS.LEADER_APPROVAL
    if (hasIdentity) {
      if (args.carrier === undefined) {
        throw malformed(
          stage,
          'carrier',
          'closing by identity writes a leg row and therefore needs {kind, reviewAuthority, actionName}',
        )
      }
      const identityProblem = caseIdentityProblemOf(kind, args.identity as ApprovalCaseIdentityInput)
      if (identityProblem !== undefined) {
        throw malformed(
          stage,
          'identity',
          `the approval case identity is refused (${identityProblem}); exactly one fingerprint is required and every vocabulary value must be closed-set`,
        )
      }
      if (!isProposalAuthorityPosition(args.carrier.reviewAuthority)) {
        throw malformed(
          stage,
          'carrier.reviewAuthority',
          `reviewAuthority outside the closed ladder: ${JSON.stringify(args.carrier.reviewAuthority)}`,
        )
      }
    } else if (args.carrier !== undefined) {
      throw malformed(
        stage,
        'carrier',
        'closing an EXISTING case by id writes nothing, so `carrier` must be absent',
      )
    }
    const approvalCaseId = hasIdentity
      ? approvalCaseIdOf(root, kind, args.identity as ApprovalCaseIdentityInput)
      : (args.approvalCaseId as string)
    const caller = resolveCaller(repositories, root, args.caller)
    // The closed resolver-role table decides who may close, exactly as it decides
    // who may decide. The asymmetry that lets this be the ONLY gate is that a
    // close can never write anything but a `deny`.
    const allowedRoles = CONTROL_RESOLVER_ROLES[kind]
    if (!allowedRoles.includes(caller.role)) {
      throw new ControlError(
        CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
        `ControlService: role '${caller.role}' may not close an approval case of kind '${kind}' (allowed: [${allowedRoles.join(', ')}]) — a zero-review close only ever denies, and it is still the resolver's act to make`,
        { rootSessionId: root, approvalCaseId, role: caller.role },
      )
    }
    const resolved = resolveTeamAndTarget(
      repositories,
      options.blueprintCatalog,
      {
        rootSessionId: root,
        action: ACTION_NAMES.RESOLVE_CONTROL,
        caller: args.caller,
        requestToken: approvalCaseId,
      },
      RESOLVE_CONTROL_SPEC,
    )
    enforceEnvelope(
      RESOLVE_CONTROL_SPEC,
      callerEnvelope(resolved.bound.blueprint, caller, repositories.overrides.list(root)),
    )
    return await closeZeroReviewCaseTransactionally({
      root,
      approvalCaseId,
      decider: callerRefOf(caller),
      terminalReason: args.terminalReason,
      ...(args.note !== undefined ? { note: args.note } : {}),
      ...(hasIdentity
        ? {
            newCase: {
              kind,
              reviewAuthority: (args.carrier as {
                readonly reviewAuthority: ProposalAuthorityPosition
              }).reviewAuthority,
              actionName: (args.carrier as { readonly actionName: string }).actionName,
              ...(args.carrier?.toolName !== undefined ? { toolName: args.carrier.toolName } : {}),
              caller: args.caller,
              identity: args.identity as ApprovalCaseIdentityInput,
            },
          }
        : {}),
    })
  }

  async function findApprovalCaseByIdentity(args: {
    readonly rootSessionId: string
    readonly identity: ApprovalCaseIdentityInput
    readonly kind?: ControlRequestKind
  }): Promise<ApprovalCaseIdentityLookup> {
    const root = parseRoot(
      args.rootSessionId,
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
      'findApprovalCaseByIdentity',
    )
    const kind = args.kind ?? CONTROL_REQUEST_KINDS.LEADER_APPROVAL
    const identityProblem = caseIdentityProblemOf(kind, args.identity)
    if (identityProblem !== undefined) {
      throw malformed(
        'findApprovalCaseByIdentity',
        'identity',
        `the approval case identity is refused (${identityProblem}); exactly one fingerprint is required and every vocabulary value must be closed-set`,
      )
    }
    return withTeamLock(teamLocks, root, async () => {
      const state = loadControlState(root)
      const derived = approvalCaseIdOf(root, kind, args.identity)
      // DERIVED, then VERIFIED against the durable rows (A2-7): a lookup that
      // only derived would answer `found` for a case that was never opened.
      // DERIVED, then VERIFIED against the durable rows (A2-7): a lookup that
      // only derived would answer `found` for a case that was never opened.
      // The VERIFICATION scans the corrupt bucket too (fidelity review #2): a
      // case whose leg rows ALL failed the strict parser lives in
      // `state.corruptLegs`, and this is the only frozen route from a
      // fingerprint back to a case id. Answering `none` there tells the caller
      // to open a SECOND case for the same identity — the SF1/X7-R5 double-case
      // collapse relocated, since `listOpenApprovalCases` skips the corrupt
      // case and `readApprovalCaseState` needs the id it just denied having.
      // `found` here does NOT mean "usable": the read that follows names the
      // typed problem (ADR A2-9 — report the corruption, never hide it).
      const owned =
        state.requests.some((row) => row.payload.approvalCaseId === derived) ||
        state.corruptLegs.some((row) => row.payload['approvalCaseId'] === derived)
      return owned ? { kind: 'found', approvalCaseId: derived } : { kind: 'none' }
    })
  }
  return {
    requestControl,
    resolveControl,
    abandonControlRequest,
    listControlState,
    guardOperation,
    checkExternalOperation,
    awaitControlDecision,
    commitEffectIfAuthorized,
    persistAbandonCloseLocked,
    requestApprovalLeg,
    escalateApprovalLeg,
    readApprovalCaseState,
    listOpenApprovalCases,
    listDecidedApprovalCases,
    appendTerminalOutcome,
    terminalDecisionValueFor,
    closeApprovalCaseWithoutLeg,
    findApprovalCaseByIdentity,
  }
}
