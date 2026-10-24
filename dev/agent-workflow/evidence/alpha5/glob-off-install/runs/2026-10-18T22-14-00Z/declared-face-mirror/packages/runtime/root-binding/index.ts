/**
 * RootBinding public facade (P5-T5; TaskDoc §11.5 I-1 real binding,
 * ruling R32 owned surface `packages/runtime/root-binding/**`).
 *
 * Re-exports the complete productized root-binding module set:
 *
 * - the two entry points — {@link bindFreshTeamRoot} (fresh Team root:
 *   durable create + fresh install + admission) and
 *   {@link rehydrateColdTeamRoot} (process-restart rehydration: scope
 *   restore, zero fresh-time side effects, admission re-decided);
 * - the injected-handle contract — {@link RootBindingPorts},
 *   {@link TeamDomainWritePort} (fresh path's only writer, invariant 41),
 *   the input/result types;
 * - the closed error channel — {@link RootBindingError} + codes;
 * - the real write-port adapter over the P4 TeamDomain repositories —
 *   {@link createTeamDomainWritePort} (the mirror of the binder's
 *   `createTeamDomainReadHandle` projection, P5-T1).
 *
 * The real-instance harness (`./harness/run.mjs`) binds the DSH public
 * seams through exactly these interfaces; the unit layer
 * (`packages/runtime/test/p5t5-*.test.ts`) binds the P4 repositories
 * over the testkit `FileStorageSeam`. The binder (P5-T1) and the T2/T3/
 * T4 slot implementations stay injected — this module never reaches
 * into the agent runtime.
 *
 * @module @dsh-agent-team/runtime/root-binding
 */

export { bindFreshTeamRoot } from './fresh-root.js'
export { rehydrateColdTeamRoot } from './cold-root.js'
export { createTeamDomainWritePort } from './write-port.js'
export {
  ROOT_BINDING_ERROR_CODES,
  ROOT_BINDING_ERROR_CODE_VALUES,
  RootBindingError,
  isRootBindingError,
} from './errors.js'
export type { RootBindingErrorCode } from './errors.js'
export type {
  ColdRootBindingInput,
  FreshRootBindingInput,
  RootBindingDurableState,
  RootBindingPorts,
  RootBindingResult,
  TeamDomainWritePort,
} from './types.js'
