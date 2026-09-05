/**
 * P6-T2 — the TeamRuntime action-router module: the unified authority
 * facade for runtime/control actions against EXISTING team members.
 *
 * - `router.ts`  — `createTeamRuntime(options)`: the documented
 *                  enforcement-order pipeline (validate -> resolve target
 *                  -> resolve caller -> authority+envelope -> compat gate
 *                  -> effects under the per-team lock);
 * - `effects.ts` — the durable effect execution (TeamDomain repositories
 *                  only, invariant 41; per-team serialization; the
 *                  ActivationProvider as the sole creation path,
 *                  invariant 26).
 *
 * The admission vocabulary (errors, types, action registry, resolution,
 * envelope, gates) lives in `packages/runtime/admission/` and is re-exported
 * by its own index — this module builds the facade on top of it.
 *
 * @module action-router (P6-T2)
 */
export { createTeamRuntime } from './router.js';
export { executeEffect, withTeamLock, commitDurableFact } from './effects.js';
export type { EffectContext } from './effects.js';
export { executeWorkChain, scanWorkUnitFacts, settleAdmittedWork, WORK_ACTIVITY_SUBJECT, } from './work-execution.js';
export type { WorkChainDeps, WorkChainResult, WorkUnitFacts, SettleOutcome } from './work-execution.js';
//# sourceMappingURL=index.d.ts.map