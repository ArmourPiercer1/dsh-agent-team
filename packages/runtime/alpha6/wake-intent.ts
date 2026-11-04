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

import type {
  PersistedReviewWakeFact,
  ReviewWakeCoordinator,
  ReviewWakeKey,
  ReviewWakeTransition,
} from '../review-wake/index.js'

/** What the reducer decided to deliver, before any Host call. */
export interface ReviewWakeQueuedIntent {
  readonly key: ReviewWakeKey
  readonly wakeId: string
  readonly workFingerprint: string
}

/**
 * `queued` = intent recorded, delivery not yet acknowledged by the Inbox.
 * `accepted` = the Inbox accepted the message (still not a claimed turn).
 */
export type ReviewWakeIntentStatus = 'queued' | 'accepted'

/** The persisted row. It is intent only; it carries no decision payload. */
export interface PersistedReviewWakeIntent extends ReviewWakeQueuedIntent {
  readonly status: ReviewWakeIntentStatus
}

/**
 * The durable port. One row per latch identity; `read` returns that row (or
 * `null`). Implementations may be synchronous (tests) or async (durable).
 */
export interface ReviewWakeIntentStore {
  persistQueued(intent: ReviewWakeQueuedIntent): void | Promise<void>
  markAccepted(wakeId: string): void | Promise<void>
  clear(wakeId?: string): void | Promise<void>
  read():
    | PersistedReviewWakeIntent
    | null
    | Promise<PersistedReviewWakeIntent | null>
}

/**
 * The native DSH Inbox truth. `has` answers "is the wake message still
 * pending in the Inbox?"; `remove` is the optional reconcile action used to
 * withdraw a stale queued wake. Neither call is authority: the message is the
 * delivery record, never an approval.
 */
export interface ReviewWakeInboxPort {
  has(wakeId: string): boolean | Promise<boolean>
  remove?(wakeId: string): void | boolean | Promise<void | boolean>
}

/** One recovery outcome. `transition` is the reducer's answer (never effects). */
export interface ReviewWakeRecoverResult {
  /** True only when the latch is now `queued` for an existing Inbox message. */
  readonly adopted: boolean
  readonly wakeId: string | null
  readonly transition: ReviewWakeTransition
}

function sameKey(a: ReviewWakeKey, b: ReviewWakeKey): boolean {
  return (
    a.rootSessionId === b.rootSessionId &&
    a.reviewerInstanceId === b.reviewerInstanceId &&
    a.sessionGeneration === b.sessionGeneration
  )
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
export async function recoverReviewWake(
  coordinator: ReviewWakeCoordinator,
  store: ReviewWakeIntentStore,
  inbox: ReviewWakeInboxPort,
): Promise<ReviewWakeRecoverResult> {
  const intent = await store.read()
  if (intent === null) {
    return {
      adopted: false,
      wakeId: null,
      transition: coordinator.dispatch({ type: 'recover', persistedWake: null }),
    }
  }

  if (!sameKey(intent.key, coordinator.state.key)) {
    // A row from another latch identity is never adopted by this one. It is
    // left for its own latch; the reducer refuses the mismatched fact.
    return {
      adopted: false,
      wakeId: null,
      transition: coordinator.dispatch({
        type: 'recover',
        persistedWake: persistedFact(intent),
      }),
    }
  }

  const exists = await inbox.has(intent.wakeId)
  if (!exists) {
    // Window (b): the intent is not a delivered wake. Discard it; only an
    // actual Inbox message may be adopted.
    await store.clear(intent.wakeId)
    return {
      adopted: false,
      wakeId: null,
      transition: coordinator.dispatch({ type: 'recover', persistedWake: null }),
    }
  }

  const transition = coordinator.dispatch({
    type: 'recover',
    persistedWake: persistedFact(intent),
  })

  if (coordinator.state.stopped) {
    // Sticky Stop outranks a persisted queued wake: withdraw it from the
    // native Inbox instead of adopting it.
    await inbox.remove?.(intent.wakeId)
    await store.clear(intent.wakeId)
    return { adopted: false, wakeId: null, transition }
  }

  if (transition.outcome === 'refused') {
    return { adopted: false, wakeId: null, transition }
  }

  if (intent.status !== 'accepted') {
    // Window (c): the Inbox accepted the message but the local mark was lost.
    // The Inbox truth is authoritative; record the acceptance now.
    await store.markAccepted(intent.wakeId)
  }

  return {
    adopted:
      coordinator.state.status === 'queued' &&
      coordinator.state.wakeId === intent.wakeId,
    wakeId: intent.wakeId,
    transition,
  }
}

function persistedFact(
  intent: PersistedReviewWakeIntent,
): PersistedReviewWakeFact {
  return {
    key: intent.key,
    // The recovery fact is always `queued`: a crash may have happened after
    // the Host claimed the turn, but no live turn owns that claim any more.
    // Keeping it queued lets a fresh plan coalesce, and the Inbox message
    // existence check above prevents a duplicate delivery.
    status: 'queued',
    wakeId: intent.wakeId,
    workFingerprint: intent.workFingerprint,
  }
}
