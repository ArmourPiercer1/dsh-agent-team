const WAKE_ID_MAX = 1024;
const ROOT_ID_MAX = 256;
const INSTANCE_ID_MAX = 256;
function boundedId(value, field, max) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new TypeError(`review-wake: ${field} must be a non-empty string`);
    }
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
/**
 * The token is the ONLY Inbox identity: `has()` matches this exact string.
 * Truncating it would make every probe answer false and re-deliver forever, so
 * an over-long id is a typed refusal, never a shortened token.
 */
function exactId(value, field, max) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new TypeError(`review-wake: ${field} must be a non-empty string`);
    }
    if (value.length > max) {
        throw new TypeError(`review-wake: ${field} exceeds ${String(max)} characters`);
    }
    return value;
}
/**
 * Render ONE wake hint. The token-leading line is stable for the same
 * `wakeId`, so a redelivery is recognizable; the text never contains a
 * decision, case payload, or tool authority.
 */
export function renderReviewWake(effect) {
    const wakeId = exactId(effect.wakeId, 'wakeId', WAKE_ID_MAX);
    const rootSessionId = boundedId(effect.key.rootSessionId, 'rootSessionId', ROOT_ID_MAX);
    const reviewerInstanceId = boundedId(effect.key.reviewerInstanceId, 'reviewerInstanceId', INSTANCE_ID_MAX);
    return [
        `[team-review-wake wakeId=${wakeId}]`,
        'New review work is ready.',
        '',
        `reviewer: ${reviewerInstanceId}`,
        `rootSession: ${rootSessionId}`,
        ...(effect.requestIds === undefined || effect.requestIds.length === 0
            ? ['Read your current review tasks with `team_list_pending_control`, then decide or escalate with `team_resolve_control`.']
            : [
                'requestId:',
                ...effect.requestIds.slice(0, 32).map((requestId) => `- ${boundedId(requestId, 'requestId', WAKE_ID_MAX)}`),
                'Decide or escalate with `team_resolve_control` using the EXACT requestId above; `team_list_pending_control` may be Leader-only for a delegated reviewer.',
            ]),
    ].join('\n');
}
/**
 * Bind the coordinator's delivery effect to one port. A port rejection
 * PROPAGATES: the coordinator's `delivery-failed` transition is what releases
 * `queued`, and this seam must not swallow that signal.
 */
export function createReviewWakeDelivery(port) {
    if (typeof port !== 'function') {
        throw new TypeError('review-wake: a delivery port function is required');
    }
    return async (effect) => {
        await port({
            key: effect.key,
            wakeId: effect.wakeId,
            text: renderReviewWake(effect),
        });
    };
}
//# sourceMappingURL=delivery.js.map