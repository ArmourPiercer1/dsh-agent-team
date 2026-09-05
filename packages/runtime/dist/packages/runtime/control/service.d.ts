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
 *   allow by the last-mile guard.
 *
 * Scope model (types.ts): an allow authorizes EXACTLY
 * `(rootSessionId, targetInstanceId, actionName, toolName?,
 * capabilityDomain?, correlation)` and is CONSUMED EXACTLY ONCE.
 *
 * Request idempotency: the scope key `(root, targetInstanceId, actionName,
 * toolName|absent, correlation)` identifies the logical request; a retried
 * request returns the EXISTING row (regardless of requester); a NEW
 * attempt after an allow was consumed (or after a deny) must carry a NEW
 * correlation and creates a NEW request (no reuse).
 *
 * Stale semantics (fail closed; the append-only ledger has no "mark"
 * primitive, so the decision row IS the mark):
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
 * Invariant 45: the in-process holds NO cached authority state — every
 * operation re-reads the durable repositories fresh (the service-owned
 * `teamLocks` map is a concurrency chain, not authority).
 *
 * @module @dsh-agent-team/runtime/control/service
 */
import type { ControlService, ControlServiceOptions } from './types.js';
/**
 * Create the durable control plane service over one open TeamDomain.
 *
 * @param options - the injected ports (see {@link ControlServiceOptions}).
 * @returns the ControlService (requestControl / resolveControl /
 *   listControlState / guardOperation).
 */
export declare function createControlService(options: ControlServiceOptions): ControlService;
//# sourceMappingURL=service.d.ts.map