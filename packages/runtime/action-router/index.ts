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

export { createTeamRuntime } from './router.js'
export { executeEffect, isWorkChainStage, withTeamLock, commitDurableFact } from './effects.js'
export type { EffectContext, WorkChainStage } from './effects.js'
export {
  admitWorkLocked,
  completeWorkChainAfterAdmission,
  deliverWork,
  executeWorkChain,
  scanWorkUnitFacts,
  settleAdmittedWork,
  settleWorkLocked,
  WORK_ACTIVITY_SUBJECT,
} from './work-execution.js'
export type {
  WorkChainDeps,
  WorkChainPhaseA,
  WorkChainResult,
  WorkUnitFacts,
  SettleOutcome,
} from './work-execution.js'
export {
  createAdmitRootInitialWork,
  computeRootWorkPayloadFingerprint,
  executeRootInitialWorkLocked,
  scanRootInitialWorkFacts,
  FACT_ROOT_WORK_DELIVERED,
  FACT_WORK_ADMITTED as FACT_ROOT_WORK_ADMITTED,
  ROOT_TARGET_KIND,
} from './root-initial-work.js'
export type {
  AdmitRootInitialWork,
  RootInitialWorkArgs,
  RootInitialWorkClosureInput,
  RootInitialWorkDeps,
  RootInitialWorkResult,
  RootInitialWorkScan,
  RootWorkDeliveryPort,
  RootWorkFactRef,
} from './root-initial-work.js'
