/**
 * P6-T5 — the activity ledger: durable per-member-instance TELEMETRY
 * (subject / status / summary / correlation / last action / RUNNING
 * intervals) for the UI timeline (UI Design §15) and the activity/progress
 * panel (UI Design §25) — DevPlan §19.5.
 *
 * Authority boundary (NO workflow authority — TaskDoc §11.7, DevPlan
 * §19.5, Architecture §1.4/§14):
 *
 * - The activity rows are facts in the TeamLedger (invariant 41: the
 *   TeamDomain is the durable authority; invariant 44: coordination order
 *   comes from the TeamLedger sequence, never from timestamps). Nothing in
 *   this module reads or writes lifecycle state, member records, DAG, or
 *   completion authority; `MemberInstanceRecordDto.activityVersion` is
 *   written exclusively by the surfaces that own member-record commits
 *   (P6-T1 creation, P7-T3 lifecycle) — P6-T5 never rewrites a member
 *   record.
 * - Every DURABLE WRITE flows through the P6-T2 TeamRuntime facade
 *   (`performAction` with the closed `report-progress` action) so that
 *   addressing, caller identity/role, envelope and live-target authority
 *   are enforced exactly once; the ledger's own job is the structured
 *   activity row + its total-order and interval guards.
 * - This module publishes PROJECTIONS (pure functions from durable rows to
 *   the UI Design field names). A projection is a derived view: mutating a
 *   projection mutates nothing durable.
 *
 * Module layout:
 *   - `types.ts`     — the closed vocabularies + input/row/projection types
 *   - `errors.ts`    — the closed ActivityError vocabulary
 *   - `facts.ts`     — op ↔ factType mapping + deterministic parse/build
 *   - `projection.ts`— the pure projection seeds (durable rows → UI shape)
 *   - `ledger.ts`    — `createActivityLedger` (the guarded write path)
 */
// --- closed vocabularies ------------------------------------------------------
/** The closed activity operations (one durable fact type each). */
export const ACTIVITY_OPS = ['progress', 'interval-open', 'interval-close'];
/** The closed activity fact types (TeamLedger `factType` values). */
export const ACTIVITY_FACT_TYPES = [
    'activity-progress-recorded',
    'activity-interval-opened',
    'activity-interval-closed',
];
// --- field bounds (shared by the writer and the deterministic parser) --------
/** Max length of a subject string (the telemetry lane label). */
export const ACTIVITY_SUBJECT_MAX_LENGTH = 256;
/** Max length of a progress summary. */
export const ACTIVITY_SUMMARY_MAX_LENGTH = 512;
/** Max length of a last-action label. */
export const ACTIVITY_LAST_ACTION_MAX_LENGTH = 256;
/** Max length of a correlation identifier (the work-unit tag). */
export const ACTIVITY_CORRELATION_MAX_LENGTH = 128;
/** Max length of an interval note / close note. */
export const ACTIVITY_NOTE_MAX_LENGTH = 256;
/** Max length of the request token (audit correlation, facade-required). */
export const ACTIVITY_REQUEST_TOKEN_MAX_LENGTH = 128;
//# sourceMappingURL=types.js.map