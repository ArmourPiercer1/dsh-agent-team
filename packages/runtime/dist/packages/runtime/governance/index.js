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
// Alpha.3 PR3 — the permission-mutation path of this SAME authority
// (coordinator D1: ONE class, additive surface; the kernel is pure and has
// ZERO production consumers until a later PR wires it — pinned by
// test/a3p3-governance-lane-hygiene.test.ts).
export { authorizeLeaderPermissionMutation, isPermissionMutationError, matcherCovers, parsePermissionMutation, parsePermissionMutationEnvelope, parsePermissionResourceText, parsePermissionStaticLayerFacts, permissionEffectiveAnswer, PERMISSION_EFFECT_PRECEDENCE, PERMISSION_MUTATION_ERROR_CODES, PERMISSION_MUTATION_ERROR_CODE_VALUES, PERMISSION_MUTATION_KINDS, PERMISSION_RESOURCE_MATCHER_KINDS, PermissionMutationError, permissionEffectDirection, planPermissionMutation, renderPermissionResourceText, } from './permission-mutation.js';
// Alpha.4 PR1 — the shared authority-ceiling adapter (ADR A3-9/A3-2, spec §7.4).
// This barrel is how the lane exposes its own algebra; the GRAMMAR it consumes
// is exported from `@dsh-agent-team/domain/authority-envelope` and is
// deliberately NOT re-exported from here: a barrel that re-exports the domain
// grammar would give every lane two names for one concept and a second import
// path for the shape that is bound into a content hash.
export { AUTHORITY_CEILING_ERROR_CODES, AuthorityBindingError, bindingDocs, grantCeiling, } from './authority-ceiling.js';
// Alpha.4 PR2 lane A — the RUNTIME AUTHORITY model: the ladder's two functions
// (X5-E1 moved `mayReview`/`authorityRank` into the adapter beside the ceiling
// they are paired with) and the minimum-authority evaluator. `boundDocumentNames`
// is deliberately NOT re-exported: it exists so the evaluator's EVIDENCE can name
// the binding row instead of reconstructing it, and a lane that treats it as
// policy would be reading a table instead of asking the ceiling.
export { AUTHORITY_RANK, authorityRank, expansionCeiling, isHigherAuthority, mayReview, } from './authority-ceiling.js';
export { evaluateAuthorityCeiling } from './runtime-authority.js';
// A4-PR5 — the durable permission-mutation PROPOSAL law. The governance
// service consumes it as a sibling module; the host wiring (root.ts) consumes
// the late-bound approval port and the terminal vocabulary THROUGH this
// barrel — the sanctioned single instantiation (X12: no import route around
// the barrel that the name walk cannot see).
// A4-PR5: the proposal store's ONE instantiation route. The ROOT builds
// the store over the durable ledger and injects it — the governance lane
// itself keeps ZERO storage imports (the store module owns the audited
// edge; the barrel only routes the factory, the same way it already
// routes the service factory over its own storage edges).
export { createGovernanceProposalStore } from './proposal-store.js';
export { PERMISSION_MUTATION_PENDING_REASON, PERMISSION_MUTATION_TERMINAL_OUTCOME_VALUES, PERMISSION_MUTATION_TERMINAL_OUTCOMES, RISE_SUMMARY_PREFIX, beneficiaryAuthorityForTarget, buildPermissionMutationApprovalIdentity, encodeRiseSummary, lateBoundPermissionMutationApprovalPort, parseRiseSummary, permissionMutationCorrelation, permissionMutationProposalFingerprint, planPermissionMutationApproval, proposalOperationId, riseDigestOf, } from './permission-approval.js';
//# sourceMappingURL=index.js.map