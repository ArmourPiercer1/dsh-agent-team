/**
 * C1 (leader-approval reachability) — the leader control notification:
 * a PURE, deterministic model-visible liveness text for a NEWLY-CREATED
 * durable `leader-approval` request, plus the tiny notifier factory that
 * binds it to a delivery seam.
 *
 * Authority boundary (plan §3):
 * - this module renders text only — it carries NO decision authority,
 *   writes NO TeamDomain state, and never calls the control service;
 * - the delivery seam is the live glue's `deliverRootControlNotification`
 *   (a REAL model-visible input turn on the Leader root through the
 *   shared root-input path — the same seam `team_delegate`'s work
 *   delivery uses); the control service invokes the notifier AFTER the
 *   per-team lock is released, and a delivery failure is a liveness
 *   failure only (the durable request + the pending-list tool + the GUI
 *   stay the authority and the recovery paths);
 * - the text is deterministic per request (the same request renders
 *   identical bytes) so an at-least-once redelivery is recognizable;
 * - display fields are bounded: `summary` (the durable bound is 512
 *   chars — the renderer truncates defensively at 256 with a marker),
 *   the `toolName` is echoed verbatim when present (the closed tool
 *   vocabulary), everything else is the closed record fields.
 */
/** Defensively truncate one display field (durable bound 512; the
 *  rendered text stays well below the model-input hygiene bound). */
const SUMMARY_DISPLAY_MAX = 256;
function bounded(value) {
    if (value === undefined)
        return undefined;
    const text = value.length > 0 ? value.replace(/\s+/g, ' ').trim() : '';
    if (text.length === 0)
        return undefined;
    return text.length > SUMMARY_DISPLAY_MAX
        ? `${text.slice(0, SUMMARY_DISPLAY_MAX - 1)}…`
        : text;
}
/**
 * Render the model-visible leader-approval notification for ONE durable
 * request (pure: no ports, no clock, deterministic per record).
 *
 * The text leads with the machine-dedup token
 * `[team-control requestId=<id>]` (the notification is at-least-once:
 * a redelivery must be recognizable by the Leader), names the exact
 * `requestId` twice (the `team_resolve_control` argument), and points at
 * both closed tools (`team_resolve_control` to decide,
 * `team_list_pending_control` to recover/inspect). It is a liveness HINT
 * — the pending ledger row is the authority, and the list tool's fresh
 * read is the recovery path when no notification arrives (delivery
 * failure) or arrives late (busy Leader).
 */
export function renderLeaderApprovalNotification(request) {
    const requester = request.requester.kind === 'instance'
        ? request.requester.instanceId
        : `human:${request.requester.humanId}`;
    const lines = [
        `[team-control requestId=${request.requestId}]`,
        'A Team member operation is waiting for Leader approval.',
        '',
        `requestId: ${request.requestId}`,
        `requester: ${requester}`,
        `target: ${request.targetInstanceId}`,
    ];
    const tool = bounded(request.toolName);
    if (tool !== undefined)
        lines.push(`tool: ${tool}`);
    const summary = bounded(request.summary);
    if (summary !== undefined)
        lines.push(`summary: ${summary}`);
    lines.push('', 'Decide with `team_resolve_control` using this EXACT requestId and a `decision` of `allow` or `deny`.', 'Recover or inspect pending requests with `team_list_pending_control`.');
    return lines.join('\n');
}
/**
 * The notifier factory (the control service's `requestNotification` port
 * implementation for the production wiring): binds the pure renderer to
 * one delivery seam. The factory itself holds no state and performs no
 * durable write — it renders, then delegates the model-visible delivery
 * to the seam (which owns at-least-once semantics).
 */
export function createLeaderControlNotifier(ports) {
    return {
        async notifyLeaderRequest(request) {
            await ports.deliver({
                rootSessionId: request.rootSessionId,
                requestId: request.requestId,
                text: renderLeaderApprovalNotification(request),
            });
        },
    };
}
//# sourceMappingURL=leader-notification.js.map