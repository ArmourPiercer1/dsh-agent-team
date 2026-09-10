/**
 * P6-T4 — the durable control/approval plane of the Team runtime
 * (TaskDoc §11.7 P6-T4; Development Plan §19; Architecture §25).
 *
 * The public surface of the module:
 * - `createControlService` — the durable control plane service over an
 *   open TeamDomain (requestControl / resolveControl / listControlState /
 *   guardOperation / awaitControlDecision — the alpha.2 synchronous wait
 *   bridge);
 * - the closed vocabulary (request kinds, decision values/reasons, guard
 *   block reasons, the control-service error codes) and the record types
 *   (ControlRequestRecord / ControlDecisionRecord / ControlConsumption-
 *   Record / ControlGuardVerdict / ControlOperationScope).
 *
 * What this module IS (and deliberately is NOT):
 *
 * - It IS the durable authority for control requests/decisions: every
 *   request, decision and allow-consumption is an append-only TeamDomain
 *   ledger fact (`control-request-recorded` / `control-decision-recorded`
 *   / `control-allow-consumed`) — recoverable after a restart by
 *   re-opening the repositories (no in-memory state is authority,
 *   invariant 45), and the last-mile guard is a plain exported function
 *   the P6-T6 tool layer consults BEFORE executing;
 * - it is NOT a tool executor: the decision only AUTHORIZES the exact
 *   operation scope; the operation itself still runs through the DSH
 *   tool pipeline (Development Plan 19.4);
 * - it is NOT a second authority path: team/target resolution, caller
 *   identity/role and envelope bounds are REUSED from the P6-T2 facade
 *   (`resolveTeamAndTarget` / `resolveCaller` / `callerEnvelope` +
 *   `enforceEnvelope` over the closed `request-control` /
 *   `resolve-control` ops) — the facade's typed TeamRuntimeError codes
 *   surface unchanged;
 * - it is NOT bound to the P6-T2 facade's generic coordination payload
 *   vocabulary (`CONTROL_DECISION_VALUES` = approved/denied there is an
 *   evidence-payload discriminator of the facade's
 *   `team-coordination-recorded` facts; THIS module's `allow` / `deny` /
 *   `stale-denied` are the durable ControlDecision values of the
 *   `control-decision-recorded` rows — two different layers, two
 *   different vocabs).
 *
 * P6-T6 wiring (the last-mile seam — no CORE_SEAM_BLOCKER): the tool
 * layer registers the guarded tool so that, BEFORE the DSH tool pipeline
 * executes the operation, it calls
 *
 * ```
 * const verdict = await controlService.guardOperation({
 *   rootSessionId, targetInstanceId, actionName,
 *   toolName, capabilityDomain?, correlation,
 *   operationFingerprint?,
 * })
 * if (!verdict.allowed) { /* refuse, citing verdict.reason *\/ }
 * // else execute through the tool pipeline — exactly once
 * ```
 *
 * (the characterized `pre-execute` / TOOL_GUARD seam of the Development
 * Plan 15 seam table — a public composition point the tool layer owns;
 * no upstream PRIVATE seam is required). `correlation` is the caller's
 * stable logical-operation token — the same token the requestControl
 * call carried — which is what ties the request, the decision and the
 * guarded execution to ONE logical operation (Architecture 18.2).
 * `operationFingerprint` (alpha.2 exact-scope extension, OPTIONAL) is
 * the resource + payload impact identity of the operation: ABSENT = the
 * legacy scope identity (existing durable Control rows keep working
 * unchanged); PRESENT = the approval is bound to the exact fingerprint
 * (it participates in the scope's identity and in the request
 * idempotency key, and it is strictly SEPARATE from `correlation` — the
 * fingerprint is NOT a correlation substitute: the same write content
 * under a NEW correlation starts a NEW independent approval, and the
 * same correlation under a DIFFERENT fingerprint is a different
 * request that must never reuse the other's approval).
 *
 * Exactly-once: an allow decision is CONSUMED by the guard's
 * check-and-reserve (durable `control-allow-consumed` fact, under the
 * per-team lock). A second attempt with the same scope (same
 * correlation, same fingerprint — including both absent) finds the
 * consumed decision and is blocked (`allow-consumed`); a new attempt
 * must carry a NEW correlation and a NEW control request.
 *
 * Synchronous wait bridge (alpha.2 §9.4): `controlService.
 * awaitControlDecision({ rootSessionId, requestId, signal? })` resolves
 * when a durable ControlDecision for the requestId appears — the
 * authority is ALWAYS the durable control rows (the waiter only solves
 * liveness; it writes nothing and is never consulted by the guard or
 * the resolvers). The alpha.2 implementation polls the durable state at
 * an injectable cadence (default 250 ms — `ControlServiceOptions.
 * waitPollIntervalMs`), rejects with typed CONTROL_WAIT_ABORTED on
 * signal abort and typed CONTROL_WAIT_CLOSED when the durable control
 * plane closes while waiting. Cancellation never decides: the request
 * stays durable and a later resolve is unaffected.
 *
 * @module @dsh-agent-team/runtime/control
 */
export { CONTROL_ERROR_CODES, CONTROL_ERROR_CODE_VALUES, ControlError, isControlError, } from './errors.js';
export { CONTROL_DECISION_REASON_VALUES, CONTROL_DECISION_REASONS, CONTROL_DECISION_VALUES, CONTROL_DECISION_VALUE_VALUES, CONTROL_GUARD_BLOCK_REASON_VALUES, CONTROL_GUARD_BLOCK_REASONS, CONTROL_REQUEST_KIND_VALUES, CONTROL_REQUEST_KINDS, CONTROL_RESOLVER_ROLES, } from './types.js';
export { createControlService } from './service.js';
//# sourceMappingURL=index.js.map