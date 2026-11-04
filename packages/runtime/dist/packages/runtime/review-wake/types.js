/**
 * Alpha.6 PR3 — ReviewWakeCoordinator: the closed vocabulary.
 *
 * The coordinator is a PURE latch over one recipient identity
 * (`rootSessionId`, `reviewerInstanceId`, `sessionGeneration`). It owns
 * scheduling state only: whether one generic Review Wake is in flight and
 * whether newer `WorkChanged` hints arrived while it was in flight. It never
 * owns approval authority, a route decision, a case payload, a mandate, or a
 * timer (ADR-A6-1 / A6-INBOX; blueprint §3.4).
 *
 * Deliberate omissions (the frozen design rejects them):
 *   - no seven-phase WakeSlot (`idle/queued/running` + a dirty flag is the
 *     whole phase model);
 *   - no `writerToken` / `leaseEpoch` / per-wake lease fencing;
 *   - no independent timer service and no timed re-delivery;
 *   - no durable redelivery counters.
 *
 * Everything the coordinator needs from the outside world arrives as an
 * event or as a persisted fact; everything it wants done leaves as an effect
 * descriptor. There is no clock, no randomness and no I/O.
 *
 * @module @dsh-agent-team/runtime/review-wake/types
 */
/** The only three scheduling phases (the frozen compression). */
export const REVIEW_WAKE_STATUSES = ['idle', 'queued', 'running'];
/**
 * The closed set of authoritative `WorkChanged` causes. The cause is
 * propagation metadata for the emitted `rescan`; it is never stored in the
 * latch and never becomes a wake payload.
 */
export const REVIEW_WAKE_ACTIVATION_REASONS = [
    'work-changed',
    'handoff',
    'takeover',
];
/** The closed shape of one authoritative read of the recipient's ready work. */
export const REVIEW_WAKE_SCAN_KINDS = ['ready', 'no-ready-work'];
/** Why the coordinator asked for an authoritative re-read. */
export const REVIEW_WAKE_RESCAN_REASONS = [
    'activation',
    'poll',
    'turn-end',
    'resume',
];
/** Why an unclaimed queued wake is being withdrawn. */
export const REVIEW_WAKE_WITHDRAW_REASONS = [
    'no-ready-work',
    'stopped',
];
/** The closed event vocabulary accepted by the reducer. */
export const REVIEW_WAKE_EVENT_TYPES = [
    'activate',
    'poll',
    'scan-result',
    'turn-start',
    'turn-end',
    'delivery-failed',
    'stop',
    'resume',
    'recover',
];
/** The closed refusal vocabulary (malformed input and invalid transitions). */
export const REVIEW_WAKE_REFUSAL_CODES = [
    'invalid-key',
    'invalid-event',
    'invalid-scan',
    'invalid-persisted-wake',
    'key-mismatch',
    'wake-mismatch',
    'invalid-transition',
];
//# sourceMappingURL=types.js.map