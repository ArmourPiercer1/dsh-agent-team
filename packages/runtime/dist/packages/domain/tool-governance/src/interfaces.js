/**
 * THE PR0 INTERFACE FREEZE POINTS — `OperationAdmission`, `ControlledFs`,
 * `ConfinedProcessProvider`, `ProviderGateway` (plan §3: "接口冻结点…PR3/PR4
 * 可据此并行"; design §4.3's pipeline, host-neutral).
 *
 * These are TYPES ONLY, frozen by this PR so PR3 (Trusted Controlled FS) and
 * PR4 (Confined Process) can build against them in parallel, and PR2 can wire
 * admission without waiting for either. What the pipeline guarantees, restated
 * as shape constraints:
 *
 *  - ADMISSION BEFORE BODY: `OperationAdmission.admit` is awaited before any
 *    effecting call; an `admitted` decision carries the single-use grant, a
 *    `requires-approval` decision carries the WHOLE immutable
 *    `RequestedEffectSet` (the approver legally covers all effects or none,
 *    design §4.2), a `denied` decision carries a typed §5 error. There is no
 *    arm meaning "run first, decide later".
 *  - GRANT-PER-CALL, NO SHARED MUTABLE STATE: every effecting method takes
 *    the grant it executes under as a parameter (design §3.1: 禁止 Agent 共享
 *    可变 `currentGrant`).
 *  - NO FALLBACK BY CONSTRUCTION: capability probing is a separate call
 *    returning the provider's honest per-dimension assurance; `spawn` refuses
 *    `SANDBOX_UNAVAILABLE` before any process exists — the interface cannot
 *    express "sandbox failed, run naked".
 *  - CANCELLATION IS NOT TERMINATION: provider cancels settle to a lease
 *    status, and `EXECUTION_TERMINATION_UNCONFIRMED` keeps its `sideEffectUnknown`
 *    honest.
 *  - DOMAIN VETO SURVIVES THE ROUND TRIP: a gateway receipt carries the
 *    Domain Authority's own answer; `TeamPermit ∧ DomainPermit` is evaluated
 *    where the effect commits, and Team approval can never overwrite it.
 *
 * Purity: no `node:*`, no I/O — implementations arrive in PR3/PR4/PR7.
 *
 * @module @dsh-agent-team/domain/tool-governance/interfaces
 */
export {};
//# sourceMappingURL=interfaces.js.map