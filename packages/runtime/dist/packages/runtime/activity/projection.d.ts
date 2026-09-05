/**
 * P6-T5 — the projection seeds: PURE deterministic functions from durable
 * activity rows to the UI-facing projection shape (the frozen UI Design
 * field names — §15 timeline bars = RUNNING intervals, §25 status /
 * summary / correlation / lastAction).
 *
 * Presentation reference only (documented boundary — TaskDoc §11.7 item 4):
 * the old legacy task rows (the legacy inventory under `docs/migration/`)
 * are a PRESENTATION reference for what a "task" looked like on screen;
 * they are NOT vNext vocabulary. This module imports and emits NOTHING
 * from that legacy surface — the projection shapes above are the complete
 * UI contract for P6-T5, and the legacy rows must not be re-imported as
 * vNext types (Architecture §42: vNext has no legacy team-event
 * vocabulary).
 *
 * Determinism contract:
 * - ordering is ALWAYS by the durable TeamLedger sequence
 *   (`globalSequence` — invariant 44); the input row order is ignored
 *   (rows are re-sorted); `createdAt` timestamps are display labels only;
 * - `status`/`summary`/`lastAction`/`correlation` derive from the LATEST
 *   PROGRESS fact only — interval facts never change the status
 *   (telemetry is not workflow authority: a subject's `completed` status
 *   is a reported label, no lifecycle/DAG/completion decision reads it);
 * - interval state is the per-correlation fold in sequence order: an open
 *   fact with no later close for the same correlation is OPEN; a close
 *   fact paired with its latest preceding open is a CLOSED pair; a close
 *   with no preceding open (an "orphan close") is IGNORED in the
 *   projection — unreachable through the guarded write path
 *   (`ACTIVITY_INTERVAL_NOT_OPEN` fails closed), the raw row remains in
 *   the TeamLedger audit trail;
 * - a duplicate open for an already-open correlation (also unreachable
 *   through the guarded write path) keeps the FIRST open — the later
 *   duplicate is ignored deterministically;
 * - the team projection renders one lane per member (the `instances`
 *   metadata supplies labels; rows for an instance absent from
 *   `instances` still render, unlabeled — the rows are authoritative for
 *   what happened).
 */
import type { ActivityFactRow, ActivityInstanceRef, ActivitySubjectProjection, ActivityTeamProjection } from './types.js';
/**
 * Project ONE subject from its durable rows (pure; input order is
 * ignored).
 *
 * @param rows - ALL durable activity rows (any team/instance/subject —
 *        they are filtered here).
 * @param instanceId - the subject's member instance.
 * @param subject - the subject string.
 * @returns the subject projection, or `undefined` when the subject has
 *          NO durable rows (an unknown subject is not projected).
 */
export declare function projectSubjectFromRows(rows: readonly ActivityFactRow[], instanceId: string, subject: string): ActivitySubjectProjection | undefined;
/**
 * Project the WHOLE team from its durable rows (pure; input order is
 * ignored). One lane per instance: every instance in `instances` renders
 * (with `subjects: []` when it has no activity yet — the timeline keeps a
 * lane per member, UI Design §15), plus any instance that appears ONLY in
 * the rows (unlabeled — the rows are authoritative).
 *
 * @param rows - ALL durable activity rows of the team.
 * @param instances - the member metadata (lane labels; read from the
 *        durable member records by the caller).
 * @param rootSessionId - the team (root) session id (the projection key).
 * @returns the deterministic team projection.
 */
export declare function projectTeamFromRows(rows: readonly ActivityFactRow[], instances: readonly ActivityInstanceRef[], rootSessionId: string): ActivityTeamProjection;
//# sourceMappingURL=projection.d.ts.map