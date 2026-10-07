/**
 * A4-PR6 — the governance-warning lane barrel.
 *
 * Stage 6.0 freezes the vocabulary (types only). The durable service
 * (`service.ts`, stage 6.A) joins this barrel when it lands; the intervention
 * source adapter consumes warnings through the STRUCTURAL snapshot type, so
 * the intervention lane never imports this module (the intervention-lane
 * import law runs one way, `a4p3-intervention-lane-hygiene.test.ts`).
 *
 * @module @dsh-agent-team/runtime/governance-warning
 */
export { GOVERNANCE_WARNING_FACT_TYPES, GOVERNANCE_WARNING_FACT_TYPE_VALUES, GOVERNANCE_WARNING_VERDICTS, GOVERNANCE_WARNING_MINTING_VERDICTS, GOVERNANCE_WARNING_KINDS, GOVERNANCE_WARNING_ACTIONS, GOVERNANCE_WARNING_ACTION_VALUES, GOVERNANCE_START_STATUSES, GOVERNANCE_START_CORRUPT_REASONS, } from './types.js';
export { compareEnvelopes, createGovernanceWarningService, interventionIdForWarningId, warningIdForFingerprint } from './service.js';
//# sourceMappingURL=index.js.map