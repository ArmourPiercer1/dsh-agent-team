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
/** Render one canonical subject (pre-alpha3 PR-D, D.2) as a display
 *  segment: the closed kind plus the kind-selected id. */
function subjectOfDisplay(subject) {
    switch (subject.kind) {
        case 'instance':
            return `instance ${subject.instanceId}`;
        case 'template':
            return `template ${subject.templateId}`;
        case 'team':
            return `team ${subject.rootSessionId}`;
    }
}
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
        // The canonical subject (pre-alpha3 PR-D, D.2) plus the legacy
        // instance projection when present (byte-identical for instance
        // records; template/team subjects have no targetInstanceId).
        `subject: ${subjectOfDisplay(request.subject)}`,
        ...(request.targetInstanceId !== undefined
            ? [`target: ${request.targetInstanceId}`]
            : []),
    ];
    const tool = bounded(request.toolName);
    if (tool !== undefined)
        lines.push(`tool: ${tool}`);
    const summary = bounded(request.summary);
    if (summary !== undefined)
        lines.push(`summary: ${summary}`);
    // A4-PR3 — the leg lines, present ONLY for an Alpha.4 leg row. A pre-Alpha.4
    // request renders byte-identically to before (the C1 goldens in
    // `c1-leader-notification-glue.test.ts` / `c1-production-wiring.test.ts`
    // stay exact, which is the point: the additive fields must not rewrite the
    // text of a row that has no case).
    const leg = legLinesOf(request);
    lines.push(...leg);
    lines.push('', 'Decide with `team_resolve_control` using this EXACT requestId and a `decision` of `allow` or `deny`.', 'Recover or inspect pending requests with `team_list_pending_control`.');
    if (request.approvalCaseId !== undefined) {
        // Escalation is ROUTING, never authority (ADR A1-10): the reviewer that
        // raised the case has no act left on it. The text says so because the
        // alternative is a Leader that re-discovers the rule by being refused.
        lines.push(`If you already decided or escalated an earlier leg of approvalCase ${request.approvalCaseId}, you cannot act on this case again.`);
    }
    return lines.join('\n');
}
/**
 * The leg-aware display lines of one request (A4-PR3).
 *
 * EMPTY for a pre-Alpha.4 row — that is the compatibility contract, not an
 * accident: the notification is the Leader's model-visible input, and a text
 * change for rows that gained no fields would be a behaviour change smuggled
 * in with an additive schema.
 *
 * WHY NO NOTIFICATION EXISTS FOR A RISEN LEG: the delivery seam is
 * "notify the LEADER", and a risen leg belongs to the rung above (Human User /
 * Human Admin), so the leader-facing text would be a lie. An escalated case is
 * therefore recovered through `team_list_pending_control` (and, from A4-PR6,
 * the InterventionItem surface) — a disclosed interim limitation, not an
 * oversight.
 *
 * @param request - the durable request record.
 * @returns the additional display lines, in order.
 */
function legLinesOf(request) {
    if (request.approvalCaseId === undefined)
        return [];
    return [
        `approvalCase: ${request.approvalCaseId}`,
        ...(request.legOrdinal !== undefined ? [`leg: ${String(request.legOrdinal)}`] : []),
        ...(request.reviewAuthority !== undefined ? [`reviewAuthority: ${request.reviewAuthority}`] : []),
        ...(request.previousRequestId !== undefined
            ? [`escalatedFrom: ${request.previousRequestId}`]
            : []),
    ];
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