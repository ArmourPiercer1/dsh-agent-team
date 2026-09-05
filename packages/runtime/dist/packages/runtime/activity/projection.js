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
/**
 * Fold the rows of ONE subject (sequence order) into its deterministic
 * state: the durable head, the latest progress fact, the open intervals
 * (per correlation) and the closed pairs.
 */
function foldSubject(orderedRows) {
    let head = 0;
    let latestProgress;
    let lastFactAt;
    const openByCorrelation = new Map();
    const closedIntervals = [];
    for (const row of orderedRows) {
        // rows arrive in globalSequence order (invariant 44), so the last
        // row's display label is the subject's newest
        if (row.sequence > head)
            head = row.sequence;
        lastFactAt = row.createdAt;
        if (row.op === 'progress') {
            latestProgress = row;
        }
        else if (row.op === 'interval-open') {
            const correlation = row.correlation;
            if (!openByCorrelation.has(correlation))
                openByCorrelation.set(correlation, row);
        }
        else if (row.op === 'interval-close') {
            const correlation = row.correlation;
            const opened = openByCorrelation.get(correlation);
            if (opened !== undefined) {
                openByCorrelation.delete(correlation);
                const closed = {
                    correlation,
                    startedAt: opened.createdAt,
                    startedSequence: opened.sequence,
                    open: false,
                    closedAt: row.createdAt,
                    closedSequence: row.sequence,
                    ...(opened.note !== undefined ? { note: opened.note } : {}),
                    ...(row.closeNote !== undefined ? { closeNote: row.closeNote } : {}),
                };
                closedIntervals.push(closed);
            }
            // an orphan close (no preceding open) is ignored — see the module
            // docs (unreachable through the guarded write path).
        }
    }
    const openIntervals = [];
    for (const [correlation, opened] of openByCorrelation) {
        const open = {
            correlation,
            startedAt: opened.createdAt,
            startedSequence: opened.sequence,
            open: true,
            ...(opened.note !== undefined ? { note: opened.note } : {}),
        };
        openIntervals.push(open);
    }
    openIntervals.sort((a, b) => (a.correlation < b.correlation ? -1 : a.correlation > b.correlation ? 1 : 0));
    closedIntervals.sort((a, b) => (a.closedSequence ?? 0) - (b.closedSequence ?? 0) ||
        (a.correlation < b.correlation ? -1 : a.correlation > b.correlation ? 1 : 0));
    return { head, latestProgress, openIntervals, closedIntervals, lastFactAt };
}
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
export function projectSubjectFromRows(rows, instanceId, subject) {
    const subjectRows = rows
        .filter((row) => row.instanceId === instanceId && row.subject === subject)
        .sort((a, b) => a.globalSequence - b.globalSequence);
    if (subjectRows.length === 0)
        return undefined;
    const fold = foldSubject(subjectRows);
    const progress = fold.latestProgress;
    const projection = {
        instanceId,
        subject,
        sequence: fold.head,
        openIntervals: fold.openIntervals,
        closedIntervals: fold.closedIntervals,
        ...(progress !== undefined
            ? {
                status: progress.progress,
                ...(progress.summary !== undefined ? { summary: progress.summary } : {}),
                ...(progress.lastAction !== undefined ? { lastAction: progress.lastAction } : {}),
                ...(progress.correlation !== undefined ? { correlation: progress.correlation } : {}),
                lastProgressAt: progress.createdAt,
            }
            : {}),
        ...(fold.lastFactAt !== undefined ? { lastFactAt: fold.lastFactAt } : {}),
    };
    return projection;
}
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
export function projectTeamFromRows(rows, instances, rootSessionId) {
    const byInstance = new Map();
    for (const row of rows) {
        const bucket = byInstance.get(row.instanceId);
        if (bucket === undefined)
            byInstance.set(row.instanceId, [row]);
        else
            bucket.push(row);
    }
    const instanceIds = new Set();
    for (const ref of instances)
        instanceIds.add(ref.instanceId);
    for (const instanceId of byInstance.keys())
        instanceIds.add(instanceId);
    const metadata = new Map();
    for (const ref of instances) {
        if (!metadata.has(ref.instanceId))
            metadata.set(ref.instanceId, ref);
    }
    const instanceProjections = [];
    for (const instanceId of [...instanceIds].sort()) {
        const instanceRows = byInstance.get(instanceId) ?? [];
        const subjects = new Set();
        for (const row of instanceRows)
            subjects.add(row.subject);
        const subjectProjections = [];
        for (const subject of [...subjects].sort()) {
            const subjectProjection = projectSubjectFromRows(instanceRows, instanceId, subject);
            if (subjectProjection !== undefined)
                subjectProjections.push(subjectProjection);
        }
        const ref = metadata.get(instanceId);
        const projection = {
            instanceId,
            subjects: subjectProjections,
            ...(ref?.label !== undefined ? { label: ref.label } : {}),
            ...(ref?.templateId !== undefined ? { templateId: ref.templateId } : {}),
        };
        instanceProjections.push(projection);
    }
    return { rootSessionId, instances: instanceProjections };
}
//# sourceMappingURL=projection.js.map