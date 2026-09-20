/**
 * Async work completion (wake-up) — the pure renderer + the notifier
 * factory (work-completion-wakeup plan §4; architecture plan §3.4/§5).
 *
 * Authority boundary (frozen design):
 * - this module renders text only — it carries NO decision authority,
 *   writes NO TeamDomain state, scans NO durable facts, performs NO
 *   retry, keeps NO ledger, and makes NO terminal judgment (the
 *   terminal scan is the router observer's job; plan §8–§10);
 * - the text is DETERMINISTIC per notification (the same input renders
 *   byte-identical bytes) — machine-readable and future-dedup friendly —
 *   and it leads with the machine-dedup token
 *   `[team-work-settled requestToken=<token>]`;
 * - the text is MINIMAL metadata (plan §3.4 / architecture §4): it
 *   NEVER carries the member result body, a transcript, or any
 *   unbounded text — the `taskSummary` field is already bound at the
 *   tools layer (512 chars) and the renderer applies no further
 *   complex truncation (plan §4.1);
 * - the durable result stays the `team_collect` (work-status)
 *   read-back — the text points the Leader there.
 */
/** The durable taskSummary bound (the tools layer validates it; the
 *  renderer truncates defensively at the SAME bound — no marker, no
 *  second scheme: plan §4.1 "使用现有 512 字符 bound"). */
const TASK_SUMMARY_BOUND = 512;
/** Normalize the optional taskSummary (whitespace-collapsed, trimmed,
 *  bound-defended): absent or blank → `undefined` (the line is
 *  omitted from the rendered text). */
function boundedSummary(value) {
    if (value === undefined)
        return undefined;
    const text = value.length > 0 ? value.replace(/\s+/g, ' ').trim() : '';
    if (text.length === 0)
        return undefined;
    return text.length > TASK_SUMMARY_BOUND ? text.slice(0, TASK_SUMMARY_BOUND) : text;
}
/**
 * Render the model-visible completion notification for ONE settled work
 * unit (pure: no ports, no clock, deterministic per input).
 *
 * The text leads with the machine-dedup token
 * `[team-work-settled requestToken=<token>]`, names the exact
 * `requestToken` twice (the `team_collect` argument), and points at the
 * `team_collect` read-back for the full durable result. It is a
 * liveness HINT — the durable settlement fact is the authority, and the
 * read-back is the recovery path when no notification arrives (delivery
 * failure) or arrives late (busy Leader).
 */
export function renderWorkCompletionNotification(notification) {
    const lines = [
        `[team-work-settled requestToken=${notification.requestToken}]`,
        '',
        'An asynchronous Team work unit has settled.',
        `instanceId: ${notification.instanceId}`,
    ];
    const summary = boundedSummary(notification.taskSummary);
    if (summary !== undefined)
        lines.push(`taskSummary: ${summary}`);
    lines.push(`requestToken: ${notification.requestToken}`, '', 'Use team_collect with this requestToken to read the durable result.');
    return lines.join('\n');
}
/**
 * The notifier factory (the TeamRuntime's `workCompletionNotification`
 * port implementation for the production wiring): binds the pure
 * renderer to one delivery seam, iterating the target set.
 *
 * The factory holds no state and performs no durable write — it renders
 * once, then delegates every target's model-visible delivery to the
 * seam (which owns the at-MOST-once best-effort wake-ATTEMPT semantics —
 * there is no redelivery, no ledger, and no acknowledgement; the
 * durable settlement fact + `team_collect` are the recovery authority).
 * Delivery faults PROPAGATE to the caller (the router observer swallows
 * them — plan §13); this module never retries and never swallows.
 */
export function createWorkCompletionNotifier(options) {
    return {
        async notifyWorkCompletion(notification) {
            const text = renderWorkCompletionNotification(notification);
            for (const target of notification.targets) {
                await options.deliver.deliver({
                    rootSessionId: notification.rootSessionId,
                    target,
                    text,
                });
            }
        },
    };
}
//# sourceMappingURL=notification.js.map