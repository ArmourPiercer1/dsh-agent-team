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
import { LEADER_INSTANCE_ID, isRemoteSafeJsonValue, parseInstanceId, parseRootSessionId, parseTemplateId, } from '../../contracts/src/index.js';
import { CAPABILITY_NAME_VALUES, } from '../../domain/policy/src/index.js';
import { CALLER_ROLES, TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError, ACTION_NAMES, actionSpecOf, callerEnvelope, enforceEnvelope, resolveCaller, resolveTeamAndTarget, } from '../admission/index.js';
import { withTeamLock } from '../action-router/index.js';
import { TEAM_DOMAIN_ERROR_CODES, isTeamDomainError, } from '../../storage/schema/index.js';
import { deterministicToken } from '../../storage/provisioning/index.js';
import { CONTROL_ERROR_CODES, ControlError, } from './errors.js';
import { CONTROL_DECISION_REASON_VALUES, CONTROL_DECISION_VALUES, CONTROL_DECISION_VALUE_VALUES, CONTROL_EXECUTION_COUPLINGS, CONTROL_EXECUTION_COUPLING_VALUES, CONTROL_GUARD_BLOCK_REASONS, CONTROL_REQUEST_KINDS, CONTROL_REQUEST_KIND_VALUES, CONTROL_RESOLVER_ROLES, CONTROL_SUBJECT_KINDS, } from './types.js';
// --- closed fact vocabulary (kebab; p4t6-scanner safe by construction) -------------
/** The durable ControlRequest fact family. */
const FACT_REQUEST = 'control-request-recorded';
/** The durable ControlDecision fact family. */
const FACT_DECISION = 'control-decision-recorded';
/** The durable allow-consumption fact family (the exactly-once evidence). */
const FACT_CONSUMPTION = 'control-allow-consumed';
/** The durable abandon fact family (pre-alpha3 PR-D, D.4 — the additive
 *  close of an inline-coupling request on abort; the terminal mark). */
const FACT_ABANDONMENT = 'control-request-abandoned';
/** The reused closed specs of the facade action registry (module
 *  invariant: the closed registry always carries both). */
function closedActionSpecOf(name) {
    const spec = actionSpecOf(name);
    if (spec === undefined) {
        // A closed-registry regression (a programming error, never caller-reachable).
        throw new Error(`control: the closed action registry is missing ${name}`);
    }
    return spec;
}
const REQUEST_CONTROL_SPEC = closedActionSpecOf(ACTION_NAMES.REQUEST_CONTROL);
const RESOLVE_CONTROL_SPEC = closedActionSpecOf(ACTION_NAMES.RESOLVE_CONTROL);
/** The lifecycle states in which a target may EXECUTE a guarded operation
 *  (the work-accepting set; a SETTLED target is quiescent, not gone). */
const GUARD_LIVE_LIFECYCLES = ['CREATED', 'RUNNING', 'SETTLED'];
/** The terminal lifecycle (invariant 56: DISPOSED is terminal). */
const TERMINAL_LIFECYCLE = 'DISPOSED';
/** The wait-bridge default poll cadence (alpha.2 §9.4, documented choice:
 *  250 ms — the low end of the plan's 250–500 ms band; the waiter is
 *  liveness-only and the durable read is a cheap in-process ledger scan,
 *  so the low end minimizes decision latency at negligible cost). */
const DEFAULT_WAIT_POLL_INTERVAL_MS = 250;
/** The closed abandonment reason the wait-bridge's inline-abort cascade
 *  records when an INLINE-coupling request's frozen invocation aborts
 *  (pre-alpha3 PR-D, D.4 — the inline lifecycle's `abort` node:
 *  `abort → durable abandon/close → zero effect`). */
const WAIT_ABORT_ABANDON_REASON = 'wait-aborted';
/** The minimal platform-timer surface the wait bridge schedules on
 *  (alpha.2 §9.4). The codebase builds against `lib: ES2022` WITHOUT
 *  ambient DOM/Node globals (tsconfig.base.json), so the platform timer
 *  functions are reached through one narrow structural cast of
 *  `globalThis` — the module otherwise stays node-free. */
const platformTimers = globalThis;
// --- pure helpers ---------------------------------------------------------------------
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Parse a durable caller ref (malformed rows are treated as ABSENT —
 *  fail closed: a corrupted row can never grant an allow). */
function parseCallerRef(value) {
    if (!isPlainObject(value))
        return undefined;
    if (value['kind'] === 'human') {
        const humanId = value['humanId'];
        return typeof humanId === 'string' && humanId.length > 0
            ? { kind: 'human', humanId }
            : undefined;
    }
    if (value['kind'] === 'instance') {
        const instanceId = value['instanceId'];
        const role = value['role'];
        return (typeof instanceId === 'string' &&
            instanceId.length > 0 &&
            (role === 'leader' || role === 'member')
            ? { kind: 'instance', instanceId, role }
            : undefined);
    }
    return undefined;
}
/** Parse a durable canonical subject (pre-alpha3 PR-D, D.2; malformed
 *  rows are treated as ABSENT — fail closed). Exactly ONE id field is
 *  admitted, selected by the closed kind: a subject carrying a second
 *  id field is an AMBIGUOUS identity (malformed input, never a guess). */
function parseSubject(value) {
    if (!isPlainObject(value))
        return undefined;
    const instanceId = value['instanceId'];
    const templateId = value['templateId'];
    const rootSessionId = value['rootSessionId'];
    if (value['kind'] === CONTROL_SUBJECT_KINDS.INSTANCE) {
        return typeof instanceId === 'string' &&
            instanceId.length > 0 &&
            templateId === undefined &&
            rootSessionId === undefined
            ? { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId }
            : undefined;
    }
    if (value['kind'] === CONTROL_SUBJECT_KINDS.TEMPLATE) {
        return typeof templateId === 'string' &&
            templateId.length > 0 &&
            instanceId === undefined &&
            rootSessionId === undefined
            ? { kind: CONTROL_SUBJECT_KINDS.TEMPLATE, templateId }
            : undefined;
    }
    if (value['kind'] === CONTROL_SUBJECT_KINDS.TEAM) {
        return typeof rootSessionId === 'string' &&
            rootSessionId.length > 0 &&
            instanceId === undefined &&
            templateId === undefined
            ? { kind: CONTROL_SUBJECT_KINDS.TEAM, rootSessionId }
            : undefined;
    }
    return undefined;
}
/** The kind-selected subject id (pre-alpha3 PR-D, D.2): instance →
 *  instanceId, template → templateId, team → rootSessionId. */
function subjectIdOf(subject) {
    switch (subject.kind) {
        case CONTROL_SUBJECT_KINDS.INSTANCE:
            return subject.instanceId;
        case CONTROL_SUBJECT_KINDS.TEMPLATE:
            return subject.templateId;
        case CONTROL_SUBJECT_KINDS.TEAM:
            return subject.rootSessionId;
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
function subjectIdentityOf(subject) {
    return `${subject.kind}:${subjectIdOf(subject)}`;
}
/** Do two canonical subjects name the SAME identity (closed kind AND
 *  kind-selected id)? */
function subjectsMatch(a, b) {
    return a.kind === b.kind && subjectIdOf(a) === subjectIdOf(b);
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
function parseScope(value) {
    if (!isPlainObject(value))
        return undefined;
    const rootSessionId = value['rootSessionId'];
    const targetInstanceId = value['targetInstanceId'];
    const actionName = value['actionName'];
    const correlation = value['correlation'];
    if (typeof rootSessionId !== 'string' || rootSessionId.length === 0)
        return undefined;
    if (typeof actionName !== 'string' || actionName.length === 0)
        return undefined;
    if (typeof correlation !== 'string' || correlation.length === 0)
        return undefined;
    // The subject: explicit, or derived from targetInstanceId (legacy).
    let subject;
    if (value['subject'] !== undefined) {
        subject = parseSubject(value['subject']);
        if (subject === undefined)
            return undefined;
        if (targetInstanceId !== undefined &&
            (subject.kind !== CONTROL_SUBJECT_KINDS.INSTANCE || subject.instanceId !== targetInstanceId)) {
            // An explicit subject that disagrees with the legacy projection is
            // an ambiguous identity — fail closed (ABSENT), never a guess.
            return undefined;
        }
    }
    else {
        if (typeof targetInstanceId !== 'string' || targetInstanceId.length === 0) {
            // No subject AND no targetInstanceId: no identity element at all.
            return undefined;
        }
        subject = { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: targetInstanceId };
    }
    const toolName = value['toolName'];
    if (toolName !== undefined && typeof toolName !== 'string')
        return undefined;
    const capabilityDomain = value['capabilityDomain'];
    if (capabilityDomain !== undefined &&
        !CAPABILITY_NAME_VALUES.includes(capabilityDomain)) {
        return undefined;
    }
    const operationFingerprint = value['operationFingerprint'];
    if (operationFingerprint !== undefined &&
        (typeof operationFingerprint !== 'string' || operationFingerprint.length === 0)) {
        return undefined;
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
            ? { capabilityDomain: capabilityDomain }
            : {}),
        ...(operationFingerprint !== undefined ? { operationFingerprint } : {}),
    };
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
function parseRequestPayload(value) {
    if (!isPlainObject(value))
        return undefined;
    const requestId = value['requestId'];
    const kind = value['kind'];
    const targetInstanceId = value['targetInstanceId'];
    const actionName = value['actionName'];
    const correlation = value['correlation'];
    const requester = parseCallerRef(value['requester']);
    if (typeof requestId !== 'string' || requestId.length === 0)
        return undefined;
    if (typeof kind !== 'string' || !CONTROL_REQUEST_KIND_VALUES.includes(kind))
        return undefined;
    if (typeof actionName !== 'string' || actionName.length === 0)
        return undefined;
    if (typeof correlation !== 'string' || correlation.length === 0)
        return undefined;
    if (requester === undefined)
        return undefined;
    // The subject: explicit, or derived from targetInstanceId (legacy).
    let subject;
    if (value['subject'] !== undefined) {
        subject = parseSubject(value['subject']);
        if (subject === undefined)
            return undefined;
        if (targetInstanceId !== undefined &&
            (subject.kind !== CONTROL_SUBJECT_KINDS.INSTANCE || subject.instanceId !== targetInstanceId)) {
            // An explicit subject that disagrees with the legacy projection is
            // an ambiguous identity — fail closed (ABSENT), never a guess.
            return undefined;
        }
    }
    else {
        if (typeof targetInstanceId !== 'string' || targetInstanceId.length === 0) {
            // No subject AND no targetInstanceId: no identity element at all.
            return undefined;
        }
        subject = { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: targetInstanceId };
    }
    const toolName = value['toolName'];
    if (toolName !== undefined && typeof toolName !== 'string')
        return undefined;
    const capabilityDomain = value['capabilityDomain'];
    if (capabilityDomain !== undefined &&
        !CAPABILITY_NAME_VALUES.includes(capabilityDomain)) {
        return undefined;
    }
    const summary = value['summary'];
    if (summary !== undefined && typeof summary !== 'string')
        return undefined;
    const operationFingerprint = value['operationFingerprint'];
    if (operationFingerprint !== undefined &&
        (typeof operationFingerprint !== 'string' || operationFingerprint.length === 0)) {
        return undefined;
    }
    // The additive review-payload fields (pre-alpha3 PR-D, D.3): ABSENT =
    // legacy semantics; present-but-wrong-type = malformed (fail closed).
    const reviewPayload = value['reviewPayload'];
    if (reviewPayload !== undefined && !isRemoteSafeJsonValue(reviewPayload))
        return undefined;
    const reviewPayloadDigest = value['reviewPayloadDigest'];
    if (reviewPayloadDigest !== undefined &&
        (typeof reviewPayloadDigest !== 'string' || reviewPayloadDigest.length === 0)) {
        return undefined;
    }
    if (reviewPayloadDigest !== undefined && reviewPayload === undefined) {
        // A digest of a payload the row does not carry is ambiguous input.
        return undefined;
    }
    const executionCoupling = value['executionCoupling'];
    if (executionCoupling !== undefined &&
        !CONTROL_EXECUTION_COUPLING_VALUES.includes(executionCoupling)) {
        return undefined;
    }
    return {
        requestId,
        kind: kind,
        requester,
        subject,
        ...(typeof targetInstanceId === 'string' && targetInstanceId.length > 0
            ? { targetInstanceId }
            : {}),
        actionName,
        correlation,
        ...(toolName !== undefined ? { toolName } : {}),
        ...(capabilityDomain !== undefined
            ? { capabilityDomain: capabilityDomain }
            : {}),
        ...(operationFingerprint !== undefined ? { operationFingerprint } : {}),
        ...(summary !== undefined ? { summary } : {}),
        ...(reviewPayload !== undefined
            ? { reviewPayload: reviewPayload }
            : {}),
        ...(reviewPayloadDigest !== undefined ? { reviewPayloadDigest } : {}),
        ...(executionCoupling !== undefined
            ? { executionCoupling: executionCoupling }
            : {}),
    };
}
/** Parse an abandon payload (malformed rows are treated as ABSENT). */
function parseAbandonmentPayload(value) {
    if (!isPlainObject(value))
        return undefined;
    const requestId = value['requestId'];
    const rootSessionId = value['rootSessionId'];
    const abandonedAt = value['abandonedAt'];
    if (typeof requestId !== 'string' || requestId.length === 0)
        return undefined;
    if (typeof rootSessionId !== 'string' || rootSessionId.length === 0)
        return undefined;
    if (typeof abandonedAt !== 'string' || abandonedAt.length === 0)
        return undefined;
    const reason = value['reason'];
    if (reason !== undefined && typeof reason !== 'string')
        return undefined;
    return {
        requestId,
        rootSessionId,
        abandonedAt,
        ...(reason !== undefined ? { reason } : {}),
    };
}
/** Parse a decision payload (malformed rows are treated as ABSENT). */
function parseDecisionPayload(value) {
    if (!isPlainObject(value))
        return undefined;
    const requestId = value['requestId'];
    const decision = value['decision'];
    const decider = parseCallerRef(value['decider']);
    const scope = parseScope(value['scope']);
    const requestSequence = value['requestSequence'];
    if (typeof requestId !== 'string' || requestId.length === 0)
        return undefined;
    if (typeof decision !== 'string' || !CONTROL_DECISION_VALUE_VALUES.includes(decision)) {
        return undefined;
    }
    if (decider === undefined)
        return undefined;
    if (scope === undefined)
        return undefined;
    if (typeof requestSequence !== 'number' || !Number.isInteger(requestSequence) || requestSequence < 1) {
        return undefined;
    }
    const reason = value['reason'];
    if (reason !== undefined && !CONTROL_DECISION_REASON_VALUES.includes(reason)) {
        return undefined;
    }
    const note = value['note'];
    if (note !== undefined && typeof note !== 'string')
        return undefined;
    return {
        requestId,
        decision: decision,
        decider,
        scope,
        requestSequence,
        ...(reason !== undefined ? { reason: reason } : {}),
        ...(note !== undefined ? { note } : {}),
    };
}
/** Parse a consumption payload (malformed rows are treated as ABSENT). */
function parseConsumptionPayload(value) {
    if (!isPlainObject(value))
        return undefined;
    const requestId = value['requestId'];
    const decisionSequence = value['decisionSequence'];
    const scope = parseScope(value['scope']);
    const consumedAt = value['consumedAt'];
    if (typeof requestId !== 'string' || requestId.length === 0)
        return undefined;
    if (typeof decisionSequence !== 'number' ||
        !Number.isInteger(decisionSequence) ||
        decisionSequence < 1) {
        return undefined;
    }
    if (scope === undefined)
        return undefined;
    if (typeof consumedAt !== 'string' || consumedAt.length === 0)
        return undefined;
    return { requestId, decisionSequence, scope, consumedAt };
}
/** Is `caller` a well-formed facade ActionCaller? */
function isActionCaller(caller) {
    if (!isPlainObject(caller))
        return false;
    if (caller['kind'] === 'human') {
        return typeof caller['humanId'] === 'string' && caller['humanId'].length > 0;
    }
    if (caller['kind'] === 'instance') {
        return typeof caller['instanceId'] === 'string' && caller['instanceId'].length > 0;
    }
    return false;
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
function scopeKey(rootSessionId, subjectIdentity, actionName, toolName, correlation, operationFingerprint) {
    return [
        rootSessionId,
        subjectIdentity,
        actionName,
        toolName ?? '',
        correlation,
        operationFingerprint ?? '',
    ].join('\u0000');
}
/** The durable requestId derived from the scope key (stable across
 *  retries; distinct per logical request). */
function requestIdOf(key) {
    return `ctrl-${deterministicToken(key, 24)}`;
}
/** Does the durable scope snapshot match the guarded scope EXACTLY? */
/** Resolve the CANONICAL subject of a scope (pre-alpha3 PR-D, D.2): an
 *  explicit `subject` wins; ABSENT falls back to the legacy
 *  `targetInstanceId`-only path (the instance subject — byte-identical
 *  identity for legacy callers). Returns `undefined` when the scope
 *  carries neither a subject nor a usable targetInstanceId (the caller
 *  must fail closed). */
function resolveSubject(scope) {
    if (scope.subject !== undefined)
        return scope.subject;
    if (typeof scope.targetInstanceId === 'string' && scope.targetInstanceId.length > 0) {
        return { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: scope.targetInstanceId };
    }
    return undefined;
}
function scopeSnapshotMatches(recorded, guarded) {
    if (recorded.rootSessionId !== guarded.rootSessionId)
        return false;
    // The canonical SUBJECT identity (pre-alpha3 PR-D, D.2): closed kind
    // AND kind-selected id. A legacy instance row's subject is derived from
    // its targetInstanceId, so a legacy guarded scope resolves to the SAME
    // instance subject — byte-identical matching for old scopes.
    const recordedSubject = resolveSubject(recorded);
    const guardedSubject = resolveSubject(guarded);
    if (recordedSubject === undefined || guardedSubject === undefined)
        return false;
    if (!subjectsMatch(recordedSubject, guardedSubject))
        return false;
    if (recorded.actionName !== guarded.actionName)
        return false;
    if (recorded.correlation !== guarded.correlation)
        return false;
    if ((recorded.toolName ?? '') !== (guarded.toolName ?? ''))
        return false;
    if ((recorded.capabilityDomain ?? '') !== (guarded.capabilityDomain ?? ''))
        return false;
    // Fingerprint comparison (alpha.2): both absent = the old behavior
    // (equal, no check needed); present on exactly one side or different
    // values = MISMATCH (a fingerprint-bound approval never matches a
    // fingerprint-less or differently-fingerprinted attempt, and vice
    // versa — the undefined !== 'x' inequality covers the present/absent
    // case; both present and equal falls through).
    if (recorded.operationFingerprint !== guarded.operationFingerprint)
        return false;
    return true;
}
/**
 * Does the external hard cell allow the operation? Fail closed: an ABSENT
 * cell means "no host restriction"; a hard `deny` refuses; a hard
 * allow-list must NAME the operation's tool (an operation with no named
 * tool matches no item — refused).
 */
function hardCellAllows(entry, toolName) {
    if (entry === undefined)
        return true;
    if (entry.kind === 'deny')
        return false;
    if (toolName === undefined)
        return false;
    return entry.items.includes(toolName);
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
function mayAbandon(requester, caller) {
    if (caller.role === CALLER_ROLES.HUMAN)
        return true;
    if (caller.role === CALLER_ROLES.LEADER)
        return true;
    if (caller.role === CALLER_ROLES.MEMBER) {
        return (requester.kind === 'instance' &&
            requester.instanceId === String(caller.callerMember?.instanceId ?? ''));
    }
    return false;
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
export function createControlService(options) {
    const repositories = options.teamDomain.repositories;
    /** The per-team promise chain (a concurrency device, NOT authority —
     *  invariant 45). */
    const teamLocks = new Map();
    // --- small closed-code helpers -----------------------------------------------------
    function malformed(stage, field, message) {
        return new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, `ControlService: ${message} (field: '${field}')`, { stage, field });
    }
    function guardMalformed(field, message) {
        return new ControlError(CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED, `ControlService: ${message} (field: '${field}')`, { stage: 'guard', field });
    }
    function parseRoot(raw, code, stage) {
        try {
            return String(parseRootSessionId(raw));
        }
        catch {
            throw new ControlError(code, `ControlService: malformed rootSessionId in ${stage} input: ${JSON.stringify(raw)}`, { stage, field: 'rootSessionId' });
        }
    }
    /** Map a durable-store failure to the facade's closed effect-phase code
     *  (the bounded durable-write fault — the same vocabulary the P6-T2
     *  router uses; a store failure is infrastructure, not a control-plane
     *  rejection). */
    function durableFailure(stage, error) {
        return new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED, `ControlService: ${stage} failed: ${error instanceof Error ? error.message : String(error)}`, { stage });
    }
    /**
     * C1 (leader-approval reachability) — report ONE notification failure
     * to the optional diagnostic sink. The sink is DIAGNOSTIC ONLY: it
     * must never alter the request path, so a throwing sink is swallowed
     * (a fault in the observability wiring cannot fault the durable
     * control plane).
     */
    function reportNotificationFailure(record, error) {
        const sink = options.onNotificationFailure;
        if (sink === undefined)
            return;
        try {
            sink({
                requestId: record.requestId,
                kind: record.kind,
                error,
            });
        }
        catch {
            // the diagnostic sink must never alter the request path
        }
    }
    async function allocateSequence() {
        try {
            return await repositories.ledger.allocateSequence();
        }
        catch (error) {
            throw durableFailure('ledger sequence allocation', error);
        }
    }
    async function putEntry(entry) {
        try {
            await repositories.ledger.put(entry);
        }
        catch (error) {
            throw durableFailure(`ledger put (${entry.factType})`, error);
        }
        return entry.sequence;
    }
    // --- durable state reads (fresh every call — invariant 45) --------------------------
    function loadControlState(root) {
        const requests = [];
        const decisions = [];
        const consumptions = [];
        const abandonments = [];
        for (const entry of repositories.ledger.list()) {
            if (String(entry.rootSessionId) !== root)
                continue;
            if (entry.factType === FACT_REQUEST) {
                const payload = parseRequestPayload(entry.payload);
                if (payload !== undefined)
                    requests.push({ entry, payload });
            }
            else if (entry.factType === FACT_DECISION) {
                const payload = parseDecisionPayload(entry.payload);
                if (payload !== undefined)
                    decisions.push({ entry, payload });
            }
            else if (entry.factType === FACT_CONSUMPTION) {
                const payload = parseConsumptionPayload(entry.payload);
                if (payload !== undefined)
                    consumptions.push({ entry, payload });
            }
            else if (entry.factType === FACT_ABANDONMENT) {
                const payload = parseAbandonmentPayload(entry.payload);
                if (payload !== undefined)
                    abandonments.push({ entry, payload });
            }
        }
        const bySequence = (a, b) => a.entry.sequence - b.entry.sequence;
        requests.sort(bySequence);
        decisions.sort(bySequence);
        consumptions.sort(bySequence);
        abandonments.sort(bySequence);
        return { requests, decisions, consumptions, abandonments };
    }
    function scopeOf(entry, payload) {
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
        };
    }
    function toRequestRecord(entry, payload, state) {
        // The DERIVED request state (pre-alpha3 PR-D, D.4): the abandon fact
        // is the TERMINAL mark (like `stale-denied`) — it wins over a
        // concurrent decision, which in turn wins over pending.
        const abandoned = state.abandonments.some((a) => a.payload.requestId === payload.requestId);
        const decided = state.decisions.some((d) => d.payload.requestId === payload.requestId);
        const status = abandoned ? 'abandoned' : decided ? 'decided' : 'pending';
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
        };
    }
    function toAbandonmentRecord(entry, payload) {
        return {
            requestId: payload.requestId,
            rootSessionId: payload.rootSessionId,
            abandonedAt: payload.abandonedAt,
            abandonmentSequence: entry.sequence,
            ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
        };
    }
    function toDecisionRecord(entry, payload) {
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
        };
    }
    function toConsumptionRecord(entry, payload) {
        return {
            requestId: payload.requestId,
            decisionSequence: payload.decisionSequence,
            scope: payload.scope,
            consumedAt: payload.consumedAt,
        };
    }
    /** The durable ref of a resolved caller (lossless JSON). */
    function callerRefOf(caller) {
        if (caller.role === 'human') {
            return { kind: 'human', humanId: caller.humanId ?? '' };
        }
        const member = caller.callerMember;
        if (member === undefined) {
            // An internal invariant (a programming error, never caller-reachable):
            // an instance caller always resolves WITH its member record.
            throw new Error('control: an instance caller without a member record (internal invariant)');
        }
        return { kind: 'instance', instanceId: String(member.instanceId), role: caller.role };
    }
    /** Record one durable decision row (BEFORE any effect; the row IS the
     *  durable decision). */
    async function commitDecision(args) {
        const decisionScopeSubject = resolveSubject(args.scope);
        if (decisionScopeSubject === undefined) {
            // The decision scope snapshot must carry the canonical subject
            // (pre-alpha3 PR-D, D.2) — a scope with no identity element is
            // malformed input (fail closed; the commit never happens).
            throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'ControlService: the decision scope snapshot carries no subject (field: scope.subject)', { stage: 'decision', field: 'scope.subject' });
        }
        const payload = {
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
            },
            requestSequence: args.requestSequence,
            ...(args.reason !== undefined ? { reason: args.reason } : {}),
            ...(args.note !== undefined ? { note: args.note } : {}),
        };
        const sequence = await putEntry({
            schemaVersion: 2,
            sequence: await allocateSequence(),
            rootSessionId: args.scope.rootSessionId,
            factType: FACT_DECISION,
            payload,
            createdAt: options.now(),
        });
        const record = {
            requestId: args.requestId,
            decision: args.value,
            decider: args.decider,
            scope: args.scope,
            requestSequence: args.requestSequence,
            decisionSequence: sequence,
            createdAt: options.now(),
            ...(args.reason !== undefined ? { reason: args.reason } : {}),
            ...(args.note !== undefined ? { note: args.note } : {}),
        };
        return record;
    }
    // --- requestControl ------------------------------------------------------------------
    async function requestControl(args) {
        const root = parseRoot(args.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'request');
        if (!isActionCaller(args.caller)) {
            throw malformed('request', 'caller', 'caller must be {kind:human,humanId} or {kind:instance,instanceId}');
        }
        if (!CONTROL_REQUEST_KIND_VALUES.includes(args.kind)) {
            throw malformed('request', 'kind', `unknown control request kind ${JSON.stringify(args.kind)}`);
        }
        if (typeof args.actionName !== 'string' || args.actionName.length === 0) {
            throw malformed('request', 'actionName', 'actionName must be a non-empty string');
        }
        if (typeof args.correlation !== 'string' || args.correlation.length === 0) {
            throw malformed('request', 'correlation', 'correlation must be a non-empty string');
        }
        if (args.toolName !== undefined && (typeof args.toolName !== 'string' || args.toolName.length === 0)) {
            throw malformed('request', 'toolName', 'toolName must be a non-empty string when present');
        }
        if (args.operationFingerprint !== undefined &&
            (typeof args.operationFingerprint !== 'string' || args.operationFingerprint.length === 0)) {
            throw malformed('request', 'operationFingerprint', 'operationFingerprint must be a non-empty string when present');
        }
        if (args.capabilityDomain !== undefined &&
            !CAPABILITY_NAME_VALUES.includes(args.capabilityDomain)) {
            throw malformed('request', 'capabilityDomain', `capabilityDomain outside the closed set: ${JSON.stringify(args.capabilityDomain)}`);
        }
        if (args.summary !== undefined && typeof args.summary !== 'string') {
            throw malformed('request', 'summary', 'summary must be a string when present');
        }
        // Subject normalization (pre-alpha3 PR-D, D.2): the canonical identity
        // is the closed three-kind subject. An EXPLICIT subject must be well
        // formed; a present targetInstanceId must be ABSENT or agree with an
        // explicit instance subject; with NO explicit subject the
        // targetInstanceId (required, non-empty) IS the legacy instance
        // identity (byte-identical normalization for old callers).
        let subject;
        if (args.subject !== undefined) {
            const parsedSubject = parseSubject(args.subject);
            if (parsedSubject === undefined) {
                throw malformed('request', 'subject', `subject must be {kind:'instance',instanceId} | {kind:'template',templateId} | {kind:'team',rootSessionId} (got ${JSON.stringify(args.subject)})`);
            }
            subject = parsedSubject;
            if (args.targetInstanceId !== undefined &&
                (parsedSubject.kind !== CONTROL_SUBJECT_KINDS.INSTANCE ||
                    parsedSubject.instanceId !== args.targetInstanceId)) {
                throw malformed('request', 'targetInstanceId', 'a present targetInstanceId must agree with an explicit instance subject (the legacy projection of the subject)');
            }
        }
        else {
            if (typeof args.targetInstanceId !== 'string' || args.targetInstanceId.length === 0) {
                throw malformed('request', 'targetInstanceId', 'targetInstanceId (or an explicit subject) is required: the legacy instance addressing is mandatory when no subject is given');
            }
            subject = { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: args.targetInstanceId };
        }
        // Review-payload checks (pre-alpha3 PR-D, D.3): ABSENT = legacy
        // semantics; a present value must be valid lossless JSON; the digest
        // requires a present payload; the coupling is a closed set.
        if (args.reviewPayload !== undefined && !isRemoteSafeJsonValue(args.reviewPayload)) {
            throw malformed('request', 'reviewPayload', 'reviewPayload must be lossless JSON (a RemoteSafeJsonValue) when present');
        }
        if (args.reviewPayloadDigest !== undefined &&
            (typeof args.reviewPayloadDigest !== 'string' || args.reviewPayloadDigest.length === 0)) {
            throw malformed('request', 'reviewPayloadDigest', 'reviewPayloadDigest must be a non-empty string when present');
        }
        if (args.reviewPayloadDigest !== undefined && args.reviewPayload === undefined) {
            throw malformed('request', 'reviewPayloadDigest', 'reviewPayloadDigest requires a present reviewPayload (a digest of a payload the request does not carry is ambiguous input)');
        }
        if (args.executionCoupling !== undefined &&
            !CONTROL_EXECUTION_COUPLING_VALUES.includes(args.executionCoupling)) {
            throw malformed('request', 'executionCoupling', `executionCoupling outside the closed set (guarded|inline): ${JSON.stringify(args.executionCoupling)}`);
        }
        // Reused authority steps (the facade's typed codes surface as-is):
        // (1) caller identity/role; (2) team + target resolution (INSTANCE
        // subjects ONLY — a template/team subject resolves the team without a
        // target and is NEVER killed by the instance stale validator); (3)
        // request-time staleness (instance subjects only); (4) envelope.
        const caller = resolveCaller(repositories, root, args.caller);
        const resolved = resolveTeamAndTarget(repositories, options.blueprintCatalog, {
            rootSessionId: root,
            action: ACTION_NAMES.REQUEST_CONTROL,
            caller: args.caller,
            ...(subject.kind === CONTROL_SUBJECT_KINDS.INSTANCE
                ? { targetInstanceId: subject.instanceId }
                : {}),
            requestToken: args.correlation,
        }, REQUEST_CONTROL_SPEC);
        // Subject-specific existence validation (pre-alpha3 PR-D, D.2): the
        // instance staleness check below applies to instance subjects ONLY.
        if (subject.kind === CONTROL_SUBJECT_KINDS.TEAM) {
            if (subject.rootSessionId !== root) {
                throw malformed('request', 'subject', 'a team subject must name THIS team (subject.rootSessionId !== rootSessionId)');
            }
        }
        else if (subject.kind === CONTROL_SUBJECT_KINDS.TEMPLATE) {
            const blueprint = resolved.bound.blueprint;
            const knownTemplates = [
                blueprint.leader.templateId,
                ...blueprint.members.map((m) => m.templateId),
            ];
            if (!knownTemplates.some((t) => t === subject.templateId)) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, `ControlService: template subject not in the bound team blueprint (no row written)`, { stage: 'request', field: 'subject', templateId: subject.templateId });
            }
        }
        if (subject.kind === CONTROL_SUBJECT_KINDS.INSTANCE) {
            const target = resolved.target;
            const targetLifecycle = target !== undefined ? String(target.lifecycle) : undefined;
            if (targetLifecycle === TERMINAL_LIFECYCLE) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_TARGET_STALE, `ControlService: target instance is ${targetLifecycle} (terminal) — a control request can never become valid (no row written)`, {
                    rootSessionId: root,
                    targetInstanceId: subject.instanceId,
                    lifecycle: targetLifecycle,
                });
            }
        }
        enforceEnvelope(REQUEST_CONTROL_SPEC, callerEnvelope(resolved.bound.blueprint, caller, repositories.overrides.list(root)));
        const outcome = await withTeamLock(teamLocks, root, async () => {
            const state = loadControlState(root);
            const key = scopeKey(root, subjectIdentityOf(subject), args.actionName, args.toolName, args.correlation, args.operationFingerprint);
            const existing = state.requests.find((r) => scopeKey(String(r.entry.rootSessionId), subjectIdentityOf(r.payload.subject), r.payload.actionName, r.payload.toolName, r.payload.correlation, r.payload.operationFingerprint) === key);
            if (existing !== undefined) {
                // Idempotent: the same logical request returns its EXISTING row
                // (regardless of requester; a decided row says `decided` — a new
                // attempt needs a new correlation). An existing row NEVER
                // re-notifies (C1: the liveness hint is for newly-created rows
                // only — the pending-list tool is the recovery path).
                return { record: toRequestRecord(existing.entry, existing.payload, state), created: false };
            }
            const requestId = requestIdOf(key);
            const requester = callerRefOf(caller);
            const payload = {
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
            };
            const sequence = await putEntry({
                schemaVersion: 2,
                sequence: await allocateSequence(),
                rootSessionId: root,
                factType: FACT_REQUEST,
                payload,
                createdAt: options.now(),
            });
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
                },
                created: true,
            };
        });
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
            const port = options.requestNotification;
            if (port !== undefined) {
                try {
                    const pending = port.notifyLeaderRequest(outcome.record);
                    void Promise.resolve(pending).catch((error) => {
                        reportNotificationFailure(outcome.record, error);
                    });
                }
                catch (error) {
                    // the port threw synchronously (no promise was returned):
                    // same liveness-failure reporting, request path untouched
                    reportNotificationFailure(outcome.record, error);
                }
            }
        }
        return outcome.record;
    }
    // --- resolveControl ------------------------------------------------------------------
    async function resolveControl(args) {
        const root = parseRoot(args.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'resolve');
        if (!isActionCaller(args.caller)) {
            throw malformed('resolve', 'caller', 'caller must be {kind:human,humanId} or {kind:instance,instanceId}');
        }
        if (typeof args.requestId !== 'string' || args.requestId.length === 0) {
            throw malformed('resolve', 'requestId', 'requestId must be a non-empty string');
        }
        if (args.decision !== 'allow' && args.decision !== 'deny') {
            throw malformed('resolve', 'decision', `decision must be 'allow' or 'deny' (got ${JSON.stringify(args.decision)})`);
        }
        if (args.note !== undefined && typeof args.note !== 'string') {
            throw malformed('resolve', 'note', 'note must be a string when present');
        }
        // Reused authority steps: (1) caller; (2) team + blueprint resolution
        // (the decision is addressed to the REQUEST — no target token).
        const caller = resolveCaller(repositories, root, args.caller);
        const resolved = resolveTeamAndTarget(repositories, options.blueprintCatalog, {
            rootSessionId: root,
            action: ACTION_NAMES.RESOLVE_CONTROL,
            caller: args.caller,
            requestToken: args.requestId,
        }, RESOLVE_CONTROL_SPEC);
        return withTeamLock(teamLocks, root, async () => {
            const state = loadControlState(root);
            const request = state.requests.find((r) => r.payload.requestId === args.requestId);
            if (request === undefined) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND, `ControlService: no durable control request '${args.requestId}' in team '${root}' (a decision without a request)`, { rootSessionId: root, requestId: args.requestId });
            }
            // Abandonment (pre-alpha3 PR-D, D.4): the durable abandon fact is
            // the TERMINAL mark (like `stale-denied`) — checked BEFORE the
            // decided check, with ZERO durable side effects (no decision row
            // is written): an abandoned request can never become an allow.
            if (state.abandonments.some((a) => a.payload.requestId === args.requestId)) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED, `ControlService: request '${args.requestId}' is durably abandoned (the terminal mark — it can never become an allow; zero durable side effects)`, { rootSessionId: root, requestId: args.requestId });
            }
            if (state.decisions.some((d) => d.payload.requestId === args.requestId)) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED, `ControlService: request '${args.requestId}' already carries a durable decision (the first decision is authoritative)`, { rootSessionId: root, requestId: args.requestId });
            }
            // Role closure (BEFORE the envelope — invariant 37: a member is
            // never a resolver, even with the resolve-control op; the
            // user-approval kind admits only the human).
            const allowedRoles = CONTROL_RESOLVER_ROLES[request.payload.kind];
            if (!allowedRoles.includes(caller.role)) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED, `ControlService: role '${caller.role}' is not a resolver for kind '${request.payload.kind}' (allowed: [${allowedRoles.join(', ')}])`, {
                    rootSessionId: root,
                    requestId: args.requestId,
                    kind: request.payload.kind,
                    role: caller.role,
                    allowedRoles: [...allowedRoles],
                });
            }
            // Envelope (the resolve-control op; a human is not envelope-bound).
            enforceEnvelope(RESOLVE_CONTROL_SPEC, callerEnvelope(resolved.bound.blueprint, caller, repositories.overrides.list(root)));
            // Resolve-time staleness (durable stale-denied FIRST, then throw).
            // INSTANCE subjects ONLY (pre-alpha3 PR-D, D.2): the instance
            // stale validator branches on the subject kind — a template or
            // team subject has no instance lifecycle, so it is NEVER killed
            // by this check (the key negative of the generalization).
            const isInstanceSubject = request.payload.subject.kind === CONTROL_SUBJECT_KINDS.INSTANCE;
            let target;
            let targetLifecycle;
            if (isInstanceSubject) {
                target = repositories.memberInstances.get(root, request.payload.subject.instanceId);
                targetLifecycle = target !== undefined ? String(target.lifecycle) : undefined;
            }
            if (isInstanceSubject &&
                (target === undefined || targetLifecycle === TERMINAL_LIFECYCLE)) {
                const scope = scopeOf(request.entry, request.payload);
                await commitDecision({
                    requestId: request.payload.requestId,
                    value: CONTROL_DECISION_VALUES.STALE_DENIED,
                    decider: callerRefOf(caller),
                    scope,
                    requestSequence: request.entry.sequence,
                });
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_STALE, `ControlService: request '${request.payload.requestId}' is stale — the target instance is ${target === undefined ? 'missing' : targetLifecycle} (recorded as stale-denied; it can never become an allow)`, {
                    rootSessionId: root,
                    requestId: request.payload.requestId,
                    targetInstanceId: request.payload.subject.instanceId,
                    lifecycle: targetLifecycle ?? 'missing',
                });
            }
            // External hard policy (allow only — Architecture 25.4 / invariant
            // 34: no Team decision, human included, bypasses it).
            if (args.decision === 'allow') {
                const capabilityDomain = request.payload.capabilityDomain ??
                    (request.payload.toolName !== undefined ? 'tools' : undefined);
                if (capabilityDomain !== undefined) {
                    const facts = await options.externalPolicyFacts();
                    if (facts.capabilityExists[capabilityDomain] === false ||
                        !hardCellAllows(facts.hard[capabilityDomain], request.payload.toolName)) {
                        const scope = scopeOf(request.entry, request.payload);
                        await commitDecision({
                            requestId: request.payload.requestId,
                            value: CONTROL_DECISION_VALUES.DENY,
                            decider: callerRefOf(caller),
                            reason: 'external-policy',
                            scope,
                            requestSequence: request.entry.sequence,
                        });
                        throw new ControlError(CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED, `ControlService: allow impossible — the external hard policy denies capability '${capabilityDomain}' (recorded as deny with reason external-policy)`, {
                            rootSessionId: root,
                            requestId: request.payload.requestId,
                            capabilityDomain,
                            toolName: request.payload.toolName,
                        });
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
            });
        });
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
    async function commitAbandonmentFact(root, requestId, reason) {
        const state = loadControlState(root);
        const request = state.requests.find((r) => r.payload.requestId === requestId);
        if (request === undefined) {
            throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND, `ControlService: no durable control request '${requestId}' in team '${root}' (an abandon without a request)`, { rootSessionId: root, requestId });
        }
        // The terminal mark is written exactly once: an already-abandoned
        // request is rejected (zero durable side effects — no second fact).
        if (state.abandonments.some((a) => a.payload.requestId === requestId)) {
            throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED, `ControlService: request '${requestId}' is already durably abandoned (the terminal mark is written exactly once)`, { rootSessionId: root, requestId });
        }
        // The append-only ledger has no delete primitive — the row IS the
        // close (commit-before-ack).
        const payload = {
            requestId,
            rootSessionId: root,
            abandonedAt: options.now(),
            ...(reason !== undefined ? { reason } : {}),
        };
        const sequence = await putEntry({
            schemaVersion: 2,
            sequence: await allocateSequence(),
            rootSessionId: root,
            factType: FACT_ABANDONMENT,
            payload,
            createdAt: options.now(),
        });
        return { abandonmentSequence: sequence, abandonedAt: payload['abandonedAt'] };
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
    async function abandonControlRequest(args) {
        const root = parseRoot(args.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'abandon');
        if (!isActionCaller(args.caller)) {
            throw malformed('abandon', 'caller', 'caller must be {kind:human,humanId} or {kind:instance,instanceId}');
        }
        if (typeof args.requestId !== 'string' || args.requestId.length === 0) {
            throw malformed('abandon', 'requestId', 'requestId must be a non-empty string');
        }
        if (args.reason !== undefined && typeof args.reason !== 'string') {
            throw malformed('abandon', 'reason', 'reason must be a string when present');
        }
        // Authority steps: (1) caller identity/role (a stale caller can
        // never close); (2) team existence. The abandon is addressed to the
        // REQUEST (no target token) and needs NO bound blueprint and NO
        // mutation envelope — the close authority is the control-internal
        // mayAbandon rule (pre-alpha3 review F3).
        const caller = resolveCaller(repositories, root, args.caller);
        if (repositories.teamSessions.get(root) === undefined) {
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND, `ControlService: no TeamSession record for root session '${root}'`, { rootSessionId: root });
        }
        return withTeamLock(teamLocks, root, async () => {
            const state = loadControlState(root);
            const request = state.requests.find((r) => r.payload.requestId === args.requestId);
            if (request === undefined) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND, `ControlService: no durable control request '${args.requestId}' in team '${root}' (an abandon without a request)`, { rootSessionId: root, requestId: args.requestId });
            }
            // The terminal mark is written exactly once: an already-abandoned
            // request is rejected (zero durable side effects).
            if (state.abandonments.some((a) => a.payload.requestId === args.requestId)) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED, `ControlService: request '${args.requestId}' is already durably abandoned (the terminal mark is written exactly once)`, { rootSessionId: root, requestId: args.requestId });
            }
            // The CONTROL INTERNAL close authority (pre-alpha3 review F3 —
            // mayAbandon, independent of the resolve-control envelope):
            // human → any request; Leader → any of the current Team's
            // requests; member → its OWN request only. (A DECIDED request may
            // still be abandoned: that is the allow-invalidating path — the
            // abandon closes the durable allow.)
            const requester = request.payload.requester;
            if (!mayAbandon(requester, caller)) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED, `ControlService: the caller may not abandon request '${args.requestId}' (the control-internal close authority: human → any, leader → any of the current Team's, member → its own only)`, {
                    rootSessionId: root,
                    requestId: args.requestId,
                    role: caller.role,
                    requester,
                });
            }
            // The durable abandon fact FIRST (commit-before-ack; the append-
            // only ledger has no delete primitive — the row IS the close) —
            // through the SHARED terminal-mark write path: the wait-bridge
            // inline-abort cascade commits through the same routine, so the
            // exactly-once re-verification and the storage-fault contract are
            // inherited by code reuse (not re-implementation).
            const mark = await commitAbandonmentFact(root, args.requestId, args.reason);
            return {
                requestId: request.payload.requestId,
                rootSessionId: root,
                abandonedAt: mark.abandonedAt,
                abandonmentSequence: mark.abandonmentSequence,
                ...(args.reason !== undefined ? { reason: args.reason } : {}),
            };
        });
    }
    // --- listControlState ----------------------------------------------------------------
    async function listControlState(rootSessionId) {
        const root = parseRoot(rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'list');
        return withTeamLock(teamLocks, root, async () => {
            if (repositories.teamSessions.get(root) === undefined) {
                throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND, `ControlService: no TeamSession record for root session '${root}'`, { rootSessionId: root });
            }
            const state = loadControlState(root);
            return {
                requests: state.requests.map((r) => toRequestRecord(r.entry, r.payload, state)),
                decisions: state.decisions.map((d) => toDecisionRecord(d.entry, d.payload)),
                consumptions: state.consumptions.map((c) => toConsumptionRecord(c.entry, c.payload)),
                abandonments: state.abandonments.map((a) => toAbandonmentRecord(a.entry, a.payload)),
            };
        });
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
    async function checkExternalOperation(input) {
        // Fail closed on a malformed (non-closed-set) domain BEFORE any
        // derivation: a garbage domain must never read as "no cell".
        const explicitDomain = input.capabilityDomain;
        if (explicitDomain !== undefined &&
            !CAPABILITY_NAME_VALUES.includes(String(explicitDomain))) {
            return {
                allowed: false,
                reason: `the capability domain '${String(explicitDomain)}' is outside the closed set — fail closed`,
            };
        }
        const capabilityDomain = explicitDomain ?? (input.toolName !== undefined ? 'tools' : undefined);
        if (capabilityDomain === undefined) {
            // No external cell applies to this operation (mirrors the
            // resolve-time probe skip — the facts port is never consulted).
            return { allowed: true };
        }
        let facts;
        try {
            facts = await options.externalPolicyFacts();
        }
        catch (error) {
            // A throwing facts probe is a fail-closed deny, never an escape.
            return {
                allowed: false,
                reason: `the external policy facts probe failed (${error instanceof Error ? error.message : String(error)}) — fail closed`,
            };
        }
        try {
            if (facts.capabilityExists?.[capabilityDomain] === false) {
                return {
                    allowed: false,
                    reason: `capability '${capabilityDomain}' does not exist on the host (capabilityExists: false) — fail closed`,
                };
            }
            if (!hardCellAllows(facts.hard?.[capabilityDomain], input.toolName)) {
                return {
                    allowed: false,
                    reason: `the external hard policy denies capability '${capabilityDomain}' (the hard cell refuses the operation)`,
                };
            }
            return { allowed: true };
        }
        catch (error) {
            // A malformed facts shape is a fail-closed deny, never an escape.
            return {
                allowed: false,
                reason: `the external policy facts are malformed (${error instanceof Error ? error.message : String(error)}) — fail closed`,
            };
        }
    }
    // --- guardOperation (the tool-pipeline last-mile seam) -------------------------------
    async function guardOperation(scope) {
        const root = parseRoot(scope.rootSessionId, CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED, 'guard');
        // Subject normalization (pre-alpha3 PR-D, D.2): the canonical
        // identity is the closed three-kind subject. An EXPLICIT subject
        // must be well formed and must agree with a present targetInstanceId;
        // with NO explicit subject the targetInstanceId (required, non-empty)
        // IS the legacy instance identity (byte-identical guard semantics
        // for old callers). The instance stale validators (member liveness
        // + the parseInstanceId shape check) apply to instance subjects ONLY.
        const subjectWasExplicit = scope.subject !== undefined;
        let subject;
        if (scope.subject !== undefined) {
            const parsedSubject = parseSubject(scope.subject);
            if (parsedSubject === undefined) {
                throw guardMalformed('subject', `subject must be {kind:'instance',instanceId} | {kind:'template',templateId} | {kind:'team',rootSessionId} (got ${JSON.stringify(scope.subject)})`);
            }
            subject = parsedSubject;
            if (scope.targetInstanceId !== undefined &&
                (parsedSubject.kind !== CONTROL_SUBJECT_KINDS.INSTANCE ||
                    parsedSubject.instanceId !== scope.targetInstanceId)) {
                throw guardMalformed('targetInstanceId', 'a present targetInstanceId must agree with an explicit instance subject (the legacy projection of the subject)');
            }
        }
        else {
            if (typeof scope.targetInstanceId !== 'string' || scope.targetInstanceId.length === 0) {
                throw guardMalformed('targetInstanceId', 'targetInstanceId (or an explicit subject) is required: the legacy instance addressing is mandatory when no subject is given');
            }
            subject = { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: scope.targetInstanceId };
        }
        // The instance canonical target (the valid instance id); ABSENT for
        // template/team subjects (no instance lifecycle — the stale validator
        // is skipped for them).
        let instanceTarget;
        if (subject.kind === CONTROL_SUBJECT_KINDS.INSTANCE) {
            try {
                instanceTarget = String(parseInstanceId(subject.instanceId));
            }
            catch {
                // Point the error at the field the caller actually supplied: the
                // legacy targetInstanceId path (subject derived) or the explicit
                // subject.
                throw guardMalformed(subjectWasExplicit ? 'subject' : 'targetInstanceId', `${subjectWasExplicit ? 'subject.instanceId' : 'targetInstanceId'} is not a valid instance id: ${JSON.stringify(subject.instanceId)}`);
            }
        }
        if (typeof scope.actionName !== 'string' || scope.actionName.length === 0) {
            throw guardMalformed('actionName', 'actionName must be a non-empty string');
        }
        if (typeof scope.correlation !== 'string' || scope.correlation.length === 0) {
            throw guardMalformed('correlation', 'correlation must be a non-empty string');
        }
        if (scope.toolName !== undefined && (typeof scope.toolName !== 'string' || scope.toolName.length === 0)) {
            throw guardMalformed('toolName', 'toolName must be a non-empty string when present');
        }
        if (scope.capabilityDomain !== undefined && !CAPABILITY_NAME_VALUES.includes(scope.capabilityDomain)) {
            throw guardMalformed('capabilityDomain', `capabilityDomain outside the closed set: ${JSON.stringify(scope.capabilityDomain)}`);
        }
        if (scope.operationFingerprint !== undefined &&
            (typeof scope.operationFingerprint !== 'string' || scope.operationFingerprint.length === 0)) {
            throw guardMalformed('operationFingerprint', 'operationFingerprint must be a non-empty string when present');
        }
        return withTeamLock(teamLocks, root, async () => {
            // (a) the team must still exist — for the LEADER this check IS the
            // whole liveness predicate: the Leader is the Root Session itself
            // (invariant 15; the v2 LeaderInstance record carries NO lifecycle
            // and no childSessionId), so leader live <=> TeamSession(root)
            // exists, and no member-row lifecycle check ever applies to it.
            if (repositories.teamSessions.get(root) === undefined) {
                return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE };
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
                const member = repositories.memberInstances.get(root, instanceTarget);
                if (member === undefined ||
                    !GUARD_LIVE_LIFECYCLES.includes(String(member.lifecycle))) {
                    return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE };
                }
            }
            const state = loadControlState(root);
            const key = scopeKey(root, subjectIdentityOf(subject), scope.actionName, scope.toolName, scope.correlation, scope.operationFingerprint);
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
                const rowKey = scopeKey(String(r.entry.rootSessionId), subjectIdentityOf(r.payload.subject), r.payload.actionName, r.payload.toolName, r.payload.correlation, r.payload.operationFingerprint);
                return rowKey === key;
            });
            if (matching.length === 0) {
                return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST };
            }
            const unconsumedAllows = [];
            let fallback = {
                allowed: false,
                reason: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST,
            };
            for (const request of matching) {
                // Abandonment (pre-alpha3 PR-D, D.4): the durable abandon fact
                // is the TERMINAL mark (like `stale-denied`) — an immediate
                // block verdict even over a durable `allow` recorded BEFORE the
                // abandon (the old allow/decision cannot execute the operation
                // — zero effect; the inline allow was never consumed by a guard
                // and the abandon closes it).
                const abandon = state.abandonments.find((a) => a.payload.requestId === request.payload.requestId);
                if (abandon !== undefined) {
                    const decision = state.decisions.find((d) => d.payload.requestId === request.payload.requestId);
                    return {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_ABANDONED,
                        requestId: request.payload.requestId,
                        ...(decision !== undefined ? { decisionSequence: decision.entry.sequence } : {}),
                    };
                }
                const decision = state.decisions.find((d) => d.payload.requestId === request.payload.requestId);
                if (decision === undefined) {
                    fallback = {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING,
                        requestId: request.payload.requestId,
                    };
                    continue;
                }
                if (decision.payload.decision === CONTROL_DECISION_VALUES.STALE_DENIED) {
                    return {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_STALE,
                        requestId: request.payload.requestId,
                        decisionSequence: decision.entry.sequence,
                    };
                }
                if (decision.payload.decision === CONTROL_DECISION_VALUES.DENY) {
                    return {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY,
                        requestId: request.payload.requestId,
                        decisionSequence: decision.entry.sequence,
                    };
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
                    continue;
                }
                const consumed = state.consumptions.some((c) => c.payload.requestId === request.payload.requestId);
                if (consumed) {
                    fallback = {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED,
                        requestId: request.payload.requestId,
                        decisionSequence: decision.entry.sequence,
                    };
                    continue;
                }
                if (!scopeSnapshotMatches(decision.payload.scope, scope)) {
                    return {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH,
                        requestId: request.payload.requestId,
                        decisionSequence: decision.entry.sequence,
                    };
                }
                unconsumedAllows.push({ request, decision });
            }
            if (unconsumedAllows.length > 1) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_GUARD_AMBIGUOUS, `ControlService: ${unconsumedAllows.length} distinct unconsumed durable allows for one scope — refusing to guess which authorizes the operation`, {
                    rootSessionId: root,
                    requestIds: unconsumedAllows.map((a) => a.request.payload.requestId),
                });
            }
            if (unconsumedAllows.length === 1) {
                const winner = unconsumedAllows[0];
                if (winner === undefined) {
                    // Unreachable: the length check above guarantees the single element.
                    throw new Error('control: invariant violation — one unconsumed allow but no element');
                }
                const { request, decision } = winner;
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
                });
                if (external.allowed === false) {
                    return {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.EXTERNAL_POLICY,
                        requestId: request.payload.requestId,
                        decisionSequence: decision.entry.sequence,
                    };
                }
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
                });
                return {
                    allowed: true,
                    requestId: request.payload.requestId,
                    decisionSequence: decision.entry.sequence,
                };
            }
            return fallback;
        });
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
    async function inlineAbortCascade(root, requestId) {
        return withTeamLock(teamLocks, root, async () => {
            const state = loadControlState(root);
            const request = state.requests.find((r) => r.payload.requestId === requestId);
            // No durable request row, or a row whose STORED coupling is not
            // exactly `inline` (guarded / ABSENT legacy): nothing to close —
            // the caller settles exactly as today (zero side effects).
            if (request === undefined)
                return { kind: 'none' };
            if (request.payload.executionCoupling !== CONTROL_EXECUTION_COUPLINGS.INLINE) {
                return { kind: 'none' };
            }
            // fix-control-authz C: the durable ABANDON mark is TERMINAL — it
            // is consulted FIRST, before any decision (the pre-fix order let a
            // decision recorded BEFORE the abandon win: the wait resolved with
            // the stale allow — the key negative "abort 后旧 allow/decision
            // 不得执行 operation", refactor-plan D.4/D.5). The abandon closes
            // the allow: no terminal mark is written over it (exactly-once)
            // and the caller settles the waiter rejected typed.
            if (state.abandonments.some((a) => a.payload.requestId === requestId)) {
                return { kind: 'already-abandoned' };
            }
            // A durable decision WITHOUT an abandon mark is authoritative — no
            // second terminal mark over it; the wait RESOLVES with the
            // decision (today's poll fast path — the S6 pin is preserved: a
            // racing decision with NO abandon mark still settles the wait with
            // the decision and writes no abandon fact).
            const decision = state.decisions.find((d) => d.payload.requestId === requestId);
            if (decision !== undefined) {
                return { kind: 'decided', decision: toDecisionRecord(decision.entry, decision.payload) };
            }
            // PENDING inline: durably close it FIRST (the shared terminal-mark
            // write — exactly-once + storage-fault contract by code reuse),
            // then the caller settles the waiter rejected typed.
            const mark = await commitAbandonmentFact(root, requestId, WAIT_ABORT_ABANDON_REASON);
            return { kind: 'abandoned', abandonmentSequence: mark.abandonmentSequence };
        });
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
    async function awaitControlDecision(input) {
        const root = parseRoot(input.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'wait');
        const requestId = input.requestId;
        if (typeof requestId !== 'string' || requestId.length === 0) {
            throw malformed('wait', 'requestId', 'requestId must be a non-empty string');
        }
        const signal = input.signal;
        if (signal !== undefined && typeof signal.aborted !== 'boolean') {
            throw malformed('wait', 'signal', 'signal must be an AbortSignal when present');
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
            const cascade = await inlineAbortCascade(root, requestId);
            if (cascade.kind === 'abandoned' || cascade.kind === 'already-abandoned') {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED, `ControlService: awaitControlDecision for request '${requestId}' was aborted before the wait began (the INLINE request is durably ABANDONED — the additive close fact 'control-request-abandoned' is the terminal mark; the frozen invocation is dead and a retry is a NEW request)`, { rootSessionId: root, requestId });
            }
            throw new ControlError(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED, `ControlService: awaitControlDecision for request '${requestId}' was aborted before the wait began`, { rootSessionId: root, requestId });
        }
        const rawPoll = options.waitPollIntervalMs;
        const pollMs = typeof rawPoll === 'number' && Number.isFinite(rawPoll) && rawPoll > 0
            ? rawPoll
            : DEFAULT_WAIT_POLL_INTERVAL_MS;
        return new Promise((resolve, reject) => {
            let timer;
            let settled = false;
            const cleanup = () => {
                if (timer !== undefined)
                    platformTimers.clearTimeout(timer);
                if (signal !== undefined)
                    signal.removeEventListener('abort', onAbort);
            };
            const settle = (outcome) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                outcome();
            };
            const onAbort = () => {
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
                    let cascade;
                    try {
                        cascade = await inlineAbortCascade(root, requestId);
                    }
                    catch (error) {
                        reject(error);
                        return;
                    }
                    if (cascade.kind === 'decided') {
                        resolve(cascade.decision);
                        return;
                    }
                    if (cascade.kind === 'abandoned' || cascade.kind === 'already-abandoned') {
                        reject(new ControlError(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED, `ControlService: awaitControlDecision for request '${requestId}' was aborted before a durable decision appeared (the INLINE request is durably ABANDONED — the additive close fact 'control-request-abandoned' is the terminal mark; the frozen invocation is dead and a retry is a NEW request)`, { rootSessionId: root, requestId }));
                        return;
                    }
                    reject(new ControlError(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED, `ControlService: awaitControlDecision for request '${requestId}' was aborted before a durable decision appeared (zero side effects — the request stays durable and undecided)`, { rootSessionId: root, requestId }));
                });
            };
            if (signal !== undefined) {
                signal.addEventListener('abort', onAbort, { once: true });
            }
            const poll = () => {
                if (settled)
                    return;
                try {
                    const state = loadControlState(root);
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
                        settle(() => reject(new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED, `ControlService: the request '${requestId}' was abandoned before the wait could settle (the durable abandon mark is the terminal outcome — no decision can land on an abandoned request)`, { rootSessionId: root, requestId })));
                        return;
                    }
                    const decision = state.decisions.find((d) => d.payload.requestId === requestId);
                    if (decision !== undefined) {
                        settle(() => resolve(toDecisionRecord(decision.entry, decision.payload)));
                        return;
                    }
                }
                catch (error) {
                    // The durable control plane closed while waiting (the storage
                    // layer's typed closure signal): fail closed, typed.
                    if (isTeamDomainError(error) && error.code === TEAM_DOMAIN_ERROR_CODES.NOT_OPEN) {
                        settle(() => reject(new ControlError(CONTROL_ERROR_CODES.CONTROL_WAIT_CLOSED, `ControlService: the durable control plane closed while waiting for a decision on request '${requestId}'`, { rootSessionId: root, requestId })));
                        return;
                    }
                    // Any other typed failure (e.g. TEAM_SESSION_NOT_FOUND for a
                    // vanished team session) surfaces unchanged.
                    settle(() => reject(error));
                    return;
                }
                timer = platformTimers.setTimeout(() => {
                    timer = undefined;
                    poll();
                }, pollMs);
            };
            // The first poll runs synchronously: an already-durable decision
            // resolves without ever scheduling a timer (fast path).
            poll();
        });
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
     * CONTROL_REQUEST_ABANDONED without running the effect, (3) otherwise
     * the caller's effect commit (the router's `executeEffectLocked` —
     * the work admission fact / the effect commit) runs, still under the
     * lock. That is what linearizes (authorization + first effect)
     * against the durable abandon: a durable abandon is either committed
     * BEFORE the unit (→ the check sees the mark; the effect never
     * commits) or strictly AFTER the unit (→ the effect had already
     * durably committed before the terminal mark — the legitimate late
     * close, the CCR-4 semantics; the mark closes the request for the
     * future). No abandon can land BETWEEN the check and the effect
     * commit — both are inside the one hold.
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
     * This writes NO control facts (no synthetic "consumed" mark — the
     * linearization is the lock itself), changes NO request state, and is
     * transparent for a non-abandoned request (the unit runs the caller's
     * effect and returns its result unchanged).
     */
    async function commitEffectIfAuthorized(input) {
        const root = parseRoot(input.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'wait');
        if (typeof input.requestId !== 'string' || input.requestId.length === 0) {
            throw malformed('wait', 'requestId', 'requestId must be a non-empty string');
        }
        return withTeamLock(teamLocks, root, async () => {
            const state = loadControlState(root);
            if (state.abandonments.some((a) => a.payload.requestId === input.requestId)) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED, `ControlService: the request '${input.requestId}' is durably abandoned — the terminal mark closed the authorization; the effect admission is rejected (zero effect)`, { rootSessionId: root, requestId: input.requestId });
            }
            return input.commitEffect();
        });
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
    };
}
//# sourceMappingURL=service.js.map