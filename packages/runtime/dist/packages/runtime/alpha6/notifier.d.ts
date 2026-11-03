/**
 * Alpha.6 PR6 — the notifier replacement seam (pure composition).
 *
 * The legacy `ControlRequestNotificationPort` always wakes the LEADER. A6
 * routes an ordinary tool ask to the assigned Officer through the review-wake
 * delivery seam instead. This module composes the two WITHOUT changing the
 * durable ledger: it renders one model-visible hint and hands it to the wake
 * port; the pending list still reads durable state.
 *
 * @module @dsh-agent-team/runtime/alpha6/notifier
 */
import type { ControlRequestNotificationPort, ControlRequestRecord } from '../control/types.js';
import type { Alpha6CompositionDecision } from './composition.js';
export interface WakeDeliveryPort {
    (input: {
        readonly targetSessionId: string;
        readonly wakeId: string;
        readonly text: string;
    }): Promise<void>;
}
/**
 * Render the Officer-facing wake. Deterministic per request; leads with the
 * dedup token; carries no decision and no case payload.
 */
export declare function renderOfficerReviewWake(request: ControlRequestRecord): string;
/**
 * Compose the legacy Leader notifier and the A6 Officer wake behind ONE port.
 *
 * - `legacy` decision → the legacy notifier is invoked unchanged.
 * - `alpha6` decision → exactly one wake to the resolved Officer session and
 *   NO Leader notification.
 * - Any other decision (a refusal) → legacy; the safe fallback.
 */
export declare function createComposedControlNotifier(ports: {
    readonly decision: Alpha6CompositionDecision;
    readonly legacy: ControlRequestNotificationPort;
    readonly wake: WakeDeliveryPort;
    readonly recipientSessionId: string;
}): ControlRequestNotificationPort;
//# sourceMappingURL=notifier.d.ts.map