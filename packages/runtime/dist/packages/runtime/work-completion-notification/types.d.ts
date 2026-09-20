/**
 * Async work completion (wake-up) — the notification types
 * (work-completion-wakeup plan §3; architecture plan §3.3).
 *
 * Authority boundary (frozen design):
 * - the completion identity is the WORK UNIT — `(rootSessionId,
 *   requestToken)` — never the Member lifecycle transition (one member
 *   may carry several overlapping work units; the durable settlement
 *   FACT of the requestToken is the completion source);
 * - the notification carries MINIMAL metadata only: it never carries
 *   the member result body, a transcript, or any unbounded text — the
 *   durable result stays the `team_collect` (work-status) read-back;
 * - the target set is a closed UNION even though only `leader` is
 *   supported this round: consumers take `targets[]` (never a
 *   Leader-only method) so future `caller` / `instance` kinds can be
 *   added without refactoring the completion-notification main chain
 *   (architecture plan §3.3).
 */
/**
 * One closed notification target. Current production: `leader` ONLY
 * (no Blueprint / plugin config, no model-specified recipient, no
 * caller / member recipient — architecture plan §3.3).
 */
export type WorkCompletionNotificationTarget = {
    /** The team's Leader root agent (the rootSessionId is the Leader). */
    readonly kind: 'leader';
};
/**
 * One completion notification (the runtime-facing DTO the action
 * router's completion observer constructs from the durable work-unit
 * facts once a terminal settlement fact exists).
 */
export interface WorkCompletionNotification {
    /** The team root the work unit belongs to (the Leader root today). */
    readonly rootSessionId: string;
    /** The work unit's stable logical-operation token (the identity). */
    readonly requestToken: string;
    /** The member instance the work unit ran on. */
    readonly instanceId: string;
    /** The durable (bounded, optional) task summary — minimal metadata. */
    readonly taskSummary?: string;
    /** The target set (currently always exactly `[{ kind: 'leader' }]`). */
    readonly targets: readonly WorkCompletionNotificationTarget[];
}
/**
 * The delivery port: put ONE model-visible input turn on ONE target's
 * session (the production implementation is the live glue's
 * `deliverRootWorkCompletionNotification` — idle → followup / running →
 * inject over the DSH Agent semantics; it performs ONE at-most-once
 * best-effort wake attempt — no redelivery, no acknowledgement; the
 * durable settlement fact + `team_collect` are the recovery authority).
 */
export interface WorkCompletionNotificationDeliveryPort {
    deliver(args: {
        readonly rootSessionId: string;
        readonly target: WorkCompletionNotificationTarget;
        readonly text: string;
    }): Promise<void>;
}
/**
 * The runtime-facing notification port (what the TeamRuntime's async
 * completion observer invokes after a detached work unit settles).
 */
export interface WorkCompletionNotificationPort {
    notifyWorkCompletion(notification: WorkCompletionNotification): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map