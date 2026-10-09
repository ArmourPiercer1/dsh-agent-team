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
import type { ControlService, ControlServiceOptions } from './types.js';
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
 * WHAT THE STRICT READER REQUIRES OF ONE MEMBER, answered by the reader itself.
 *
 * `corruptLegCouldGovern` may not flatten every absent member into one cell. An
 * OPTIONAL member the row leaves out states something (a legacy row carries no
 * `operationFingerprint`, its durable scope key carries an empty fingerprint
 * segment, and a call that carries a fingerprint is outside that key). A REQUIRED
 * member the row leaves out states nothing — `parseRequestPayload` refuses such a
 * row, which is exactly why the row is in `corruptLegs` — and absence is not
 * evidence that the leg governs a DIFFERENT call. Which of the two a member is is
 * a fact about the reader, not about this call, and a list of keys maintained
 * here would be one parser edit away from being wrong (that is the same
 * narrower-than-reality mistake this function exists to close, relocated into a
 * comment). So the requirement is PROBED from the only place that defines it: take
 * a row the reader ACCEPTS and ask what the reader does when one member is taken
 * away, and again when it is left empty.
 *
 *   - `required`     — the reader refuses the row once the member is absent;
 *   - `rejectsEmpty` — the reader refuses the row once the member is present but
 *     an empty string.
 *
 * The answers are a pure function of this file's parser, derived per key on first
 * use and cached; nothing here is written to a ledger or read from one. The
 * probe's canonical row is load-bearing: if it ever stops parsing, both answers
 * degrade to `false` for every key — i.e. precisely the pre-G1 semantics, the
 * looser rule — and that cannot pass silently, because `W13-premise` and the
 * refusals asserted by `W13-a`/`W13-b`/`W13-f` in
 * `packages/tools/test/a4-corrupt-leg-guard.test.ts` fail the moment the
 * requirement stops being derived.
 */
export type RequestMemberRequirement = {
    readonly required: boolean;
    readonly rejectsEmpty: boolean;
};
/**
 * THE PROBE'S ANSWERS, readable by the law that depends on them.
 * `corruptLegCouldGovern` never consults this snapshot — it asks
 * `requestMemberRequirement` per member — so it exists for exactly one purpose:
 * an instrument nobody can read is an instrument that can go quietly blind.
 * `W13-k` reads it and pins, key by key, which members the reader REQUIRES,
 * which it refuses EMPTY, which it tolerates absent, and (because a probe whose
 * canonical row no longer parses answers `required: true` for all of them) that
 * `probeRequestRow()` is still a row the reader accepts at all.
 */
export declare function requestMemberRequirements(keys: readonly string[]): Readonly<Record<string, RequestMemberRequirement>>;
/**
 * Create the durable control plane service over one open TeamDomain.
 *
 * @param options - the injected ports (see {@link ControlServiceOptions}).
 * @returns the ControlService (requestControl / resolveControl /
 *   listControlState / guardOperation / checkExternalOperation /
 *   awaitControlDecision).
 */
export declare function createControlService(options: ControlServiceOptions): ControlService;
//# sourceMappingURL=service.d.ts.map