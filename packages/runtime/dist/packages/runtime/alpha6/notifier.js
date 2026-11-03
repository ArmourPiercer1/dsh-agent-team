function subjectText(subject) {
    switch (subject.kind) {
        case 'instance':
            return `instance ${subject.instanceId}`;
        case 'template':
            return `template ${subject.templateId}`;
        case 'team':
            return `team ${subject.rootSessionId}`;
    }
}
/**
 * Render the Officer-facing wake. Deterministic per request; leads with the
 * dedup token; carries no decision and no case payload.
 */
export function renderOfficerReviewWake(request) {
    const requester = request.requester.kind === 'instance'
        ? request.requester.instanceId
        : `human:${request.requester.humanId}`;
    return [
        `[team-review-wake requestId=${request.requestId}]`,
        'A Team member operation is waiting for review.',
        '',
        `requestId: ${request.requestId}`,
        `requester: ${requester}`,
        `subject: ${subjectText(request.subject)}`,
        ...(request.toolName !== undefined ? [`tool: ${request.toolName}`] : []),
        ...(request.summary !== undefined ? [`summary: ${request.summary}`] : []),
        '',
        'Decide with `team_resolve_control` using this EXACT requestId.',
        'Inspect your pending work with `team_list_pending_control`.',
    ].join('\n');
}
/**
 * Compose the legacy Leader notifier and the A6 Officer wake behind ONE port.
 *
 * - `legacy` decision → the legacy notifier is invoked unchanged.
 * - `alpha6` decision → exactly one wake to the resolved Officer session and
 *   NO Leader notification.
 * - Any other decision (a refusal) → legacy; the safe fallback.
 */
export function createComposedControlNotifier(ports) {
    return {
        async notifyLeaderRequest(request) {
            if (ports.decision.mode !== 'alpha6') {
                await ports.legacy.notifyLeaderRequest(request);
                return;
            }
            await ports.wake({
                targetSessionId: ports.recipientSessionId,
                wakeId: `review:${request.requestId}`,
                text: renderOfficerReviewWake(request),
            });
        },
    };
}
//# sourceMappingURL=notifier.js.map