/**
 * Alpha.6 PR4 (delivery slice) — the generic Review Wake delivery seam.
 *
 * The coordinator emits a `deliver-wake` EFFECT; this module turns that
 * effect into one deterministic, non-authority model-visible hint and hands
 * it to a caller-supplied delivery port. It performs no I/O itself, writes no
 * TeamDomain state, and never names an approval decision. The durable case
 * ledger and the restricted review list remain the authority.
 *
 * The real Host adapter (DSH Inbox / followup-steer) is wired in PR6; this
 * seam is deliberately small so the adapter can be swapped without changing
 * the coordinator or the text.
 *
 * @module @dsh-agent-team/runtime/review-wake/delivery
 */
import type { ReviewWakeEffect, ReviewWakeKey } from './types.js';
export interface ReviewWakeDeliveryInput {
    readonly key: ReviewWakeKey;
    readonly wakeId: string;
    readonly text: string;
}
export interface ReviewWakeDeliveryPort {
    (input: ReviewWakeDeliveryInput): Promise<void>;
}
export type ReviewWakeDeliverEffect = Extract<ReviewWakeEffect, {
    kind: 'deliver-wake';
}>;
/**
 * Render ONE wake hint. The token-leading line is stable for the same
 * `wakeId`, so a redelivery is recognizable; the text never contains a
 * decision, case payload, or tool authority.
 */
export declare function renderReviewWake(effect: ReviewWakeDeliverEffect): string;
/**
 * Bind the coordinator's delivery effect to one port. A port rejection
 * PROPAGATES: the coordinator's `delivery-failed` transition is what releases
 * `queued`, and this seam must not swallow that signal.
 */
export declare function createReviewWakeDelivery(port: ReviewWakeDeliveryPort): (effect: ReviewWakeDeliverEffect) => Promise<void>;
//# sourceMappingURL=delivery.d.ts.map