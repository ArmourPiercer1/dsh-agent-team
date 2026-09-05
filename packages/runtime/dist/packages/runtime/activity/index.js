/**
 * P6-T5 — the activity ledger package surface (the closed public API).
 *
 * The surface is deliberately CLOSED and telemetry-only (NO workflow
 * authority — TaskDoc §11.7, DevPlan §19.5): the `ActivityLedger` port
 * (guarded writes + durable reads), the pure projection seeds (durable
 * rows → the frozen UI Design field names), the closed fact vocabulary +
 * deterministic parse, the closed error vocabulary, and the re-exported
 * closed status vocabulary (`PROGRESS_VALUES` from P6-T2 admission).
 * Nothing lifecycle-mutating exists here — the dedicated P6-T5 negative
 * test asserts that.
 */
export { ACTIVITY_ERROR_CODES, ActivityError, isActivityError, } from './errors.js';
export { ACTIVITY_CORRELATION_MAX_LENGTH, ACTIVITY_FACT_TYPES, ACTIVITY_LAST_ACTION_MAX_LENGTH, ACTIVITY_NOTE_MAX_LENGTH, ACTIVITY_OPS, ACTIVITY_REQUEST_TOKEN_MAX_LENGTH, ACTIVITY_SUBJECT_MAX_LENGTH, ACTIVITY_SUMMARY_MAX_LENGTH, } from './types.js';
export { FACT_TYPE_TO_OP, OP_TO_FACT_TYPE, isActivityFactType, parseActivityFact, } from './facts.js';
export { projectSubjectFromRows, projectTeamFromRows, } from './projection.js';
export { createActivityLedger, createWorkActivityWriter } from './ledger.js';
// The closed status vocabulary (reused from P6-T2 admission — no new
// status words are invented here; telemetry is not authority).
export { PROGRESS_VALUES } from '../admission/index.js';
//# sourceMappingURL=index.js.map