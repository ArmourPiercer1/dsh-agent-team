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
import type { ControlRequestNotificationPort, ControlRequestRecord } from './types.js';
/** The delivery seam shape (the glue's `deliverRootControlNotification`). */
export interface LeaderControlNotifierDeliver {
    (input: {
        readonly rootSessionId: string;
        readonly requestId: string;
        readonly text: string;
    }): Promise<void>;
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
export declare function renderLeaderApprovalNotification(request: ControlRequestRecord): string;
/**
 * The notifier factory (the control service's `requestNotification` port
 * implementation for the production wiring): binds the pure renderer to
 * one delivery seam. The factory itself holds no state and performs no
 * durable write — it renders, then delegates the model-visible delivery
 * to the seam (which owns at-least-once semantics).
 */
export declare function createLeaderControlNotifier(ports: {
    readonly deliver: LeaderControlNotifierDeliver;
}): ControlRequestNotificationPort;
//# sourceMappingURL=leader-notification.d.ts.map