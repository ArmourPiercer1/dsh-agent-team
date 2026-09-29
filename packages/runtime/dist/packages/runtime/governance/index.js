/**
 * pre-alpha3 PR-A — the production governance mutation authority
 * (ADR-03): the single production write path for the durable governance
 * `overrides` + the PolicyState transitions, serialized on the shared
 * per-team operation chain, committed durably BEFORE the ack.
 *
 * Public surface (the root.ts wiring + the remote ports + the dev
 * harness consume ONLY this module's exports — the demoted kernels stay
 * in their home modules):
 *
 * - {@link createGovernanceMutationService} + the closed type surface
 *   (deps / args / results) — the service;
 * - the PURE slot kernel (slot closure by authority, cell validation,
 *   the write-time envelope + external-hard checks, the no-op /
 *   re-issue / tombstone record builders) — exported for the tests and
 *   for the future effective-policy reader (PR-B) that reuses the same
 *   slot rules;
 * - `isMutationError` / {@link MutationError} / the closed code
 *   vocabulary re-exported from the mutation plane (ONE error surface —
 *   the callers branch on `code`, never on message text).
 *
 * @module @dsh-agent-team/runtime/governance
 */
export { createGovernanceMutationService } from './service.js';
export { assertCells, buildReissueRecord, buildTombstoneRecord, checkCellsAgainstEnvelope, checkCellsExternalHard, isNoChange, mergedSlotValues, mintRecordId, selectSlotWinner, slotIdentityOf, slotOf, } from './slot.js';
export { isMutationError, MUTATION_ERROR_CODES, MutationError, } from '../mutation/errors.js';
//# sourceMappingURL=index.js.map