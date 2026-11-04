/**
 * Alpha.6 — the minimal persisted WAKE INTENT seam (crash recovery).
 *
 * The coordinator latch is the scheduling authority and the native DSH Inbox
 * is the delivery authority. This module adds neither a second ledger nor a
 * second approval authority: it persists ONE tiny intent row per latch key so
 * the window between "the reducer decided to deliver" and "the Host Inbox
 * shows the message" is recoverable:
 *
 *   persistQueued(intent)  BEFORE the delivery port is called
 *   markAccepted(wakeId)   AFTER the Inbox accepted the message
 *   recover()              adopts a queued wake ONLY when its Inbox message
 *                          still exists (window c: accepted but the local mark
 *                          was lost); a queued intent with no Inbox message
 *                          (window b: decided but never delivered, or the
 *                          message was consumed by the crashed turn) is
 *                          discarded so a later authoritative plan can
 *                          deliver again.
 *
 * Inbox acceptance is QUEUED, not claimed: the Host adapter still has to call
 * `claimReviewWake` when the recipient turn actually starts. A crash after
 * that claim leaves the same persisted row; recovery adopts it as `queued`
 * (the crashed turn owns no local state any more) and the native Inbox truth
 * prevents a duplicate delivery.
 *
 * The interfaces are deliberately narrow and port-shaped: production supplies
 * a durable row read/write and the Host Inbox existence probe; tests supply a
 * fake store and a fake Inbox. No clock, no timer, no counter, no retry loop.
 *
 * @module @dsh-agent-team/runtime/alpha6/wake-intent
 */
import type { ReviewWakeCoordinator, ReviewWakeKey, ReviewWakeTransition } from '../review-wake/index.js';
/**
 * Drop a stale row after a plan found no fresh work for it. The caller MUST
 * hold the same per-latch lock that serializes dispatch, and must already have
 * checked that no coordinator/session registration exists. The Inbox is the
 * authority: only a positive `false` clears; an unreadable probe or a live
 * message keeps the row. `store.clear(wakeId)` is itself row-conditional, so a
 * concurrent replacement with a different wakeId is never deleted.
 */
export declare function pruneAbsentReviewWakeRow(input: {
    readonly store: ReviewWakeIntentStore;
    readonly wakeId: string;
    readonly inbox: Pick<ReviewWakeInboxPort, 'has'>;
}): Promise<'cleared' | 'kept' | 'unreadable'>;
/** What the reducer decided to deliver, before any Host call. */
export interface ReviewWakeQueuedIntent {
    readonly key: ReviewWakeKey;
    readonly wakeId: string;
    readonly workFingerprint: string;
}
/**
 * `queued` = intent recorded, delivery not yet acknowledged by the Inbox.
 * `accepted` = the Inbox accepted the message (still not a claimed turn).
 */
export type ReviewWakeIntentStatus = 'queued' | 'accepted';
/** The persisted row. It is intent only; it carries no decision payload. */
export interface PersistedReviewWakeIntent extends ReviewWakeQueuedIntent {
    readonly status: ReviewWakeIntentStatus;
}
/**
 * The durable port. One row per latch identity; `read` returns that row (or
 * `null`). Implementations may be synchronous (tests) or async (durable).
 */
export interface ReviewWakeIntentStore {
    persistQueued(intent: ReviewWakeQueuedIntent): void | Promise<void>;
    markAccepted(wakeId: string): void | Promise<void>;
    clear(wakeId?: string): void | Promise<void>;
    read(): PersistedReviewWakeIntent | null | Promise<PersistedReviewWakeIntent | null>;
}
/**
 * The native DSH Inbox truth. `has` answers "is the wake message still
 * pending in the Inbox?"; `remove` is the optional reconcile action used to
 * withdraw a stale queued wake. Neither call is authority: the message is the
 * delivery record, never an approval.
 */
export interface ReviewWakeInboxPort {
    has(wakeId: string): boolean | Promise<boolean>;
    remove?(wakeId: string): void | boolean | Promise<void | boolean>;
}
/** One recovery outcome. `transition` is the reducer's answer (never effects). */
export interface ReviewWakeRecoverResult {
    /** True only when the latch is now `queued` for an existing Inbox message. */
    readonly adopted: boolean;
    readonly wakeId: string | null;
    /** Why recovery ended this way. The caller MUST NOT re-plan on `unreadable`,
     *  `busy`, `refused` or `stopped`: a live/concurrent latch or a durable row
     *  may still exist. Only `absent`/`mismatch` may be rebuilt at boot. */
    readonly reason: 'adopted' | 'absent' | 'mismatch' | 'unreadable' | 'stopped' | 'refused' | 'busy';
    readonly transition: ReviewWakeTransition;
}
/**
 * Recover ONE latch from the persisted intent and the native Inbox.
 *
 * Adoption law (the whole point of this seam):
 *   - no intent                 -> idle (window a: the case is committed, the
 *                                  wake was never decided; the next plan may
 *                                  deliver);
 *   - intent for another key    -> untouched, THIS latch becomes idle;
 *   - intent but no Inbox row   -> discard the intent (window b), idle;
 *   - intent + Inbox row exists -> ADOPT as `queued` (windows c and d), never
 *                                  emit a delivery effect, and record the
 *                                  acceptance if it was missing (window c).
 *
 * A sticky Stop outranks an unclaimed wake: the intent is cleared and the
 * Inbox row is withdrawn when the port offers `remove`.
 */
export declare function recoverReviewWake(coordinator: ReviewWakeCoordinator, store: ReviewWakeIntentStore, inbox: ReviewWakeInboxPort): Promise<ReviewWakeRecoverResult>;
//# sourceMappingURL=wake-intent.d.ts.map