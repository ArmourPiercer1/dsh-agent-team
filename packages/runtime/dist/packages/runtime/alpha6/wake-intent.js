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
/**
 * Drop a stale row after a plan found no fresh work for it. The caller MUST
 * hold the same per-latch lock that serializes dispatch, and must already have
 * checked that no coordinator/session registration exists. The Inbox is the
 * authority: only a positive `false` clears; an unreadable probe or a live
 * message keeps the row. `store.clear(wakeId)` is itself row-conditional, so a
 * concurrent replacement with a different wakeId is never deleted.
 */
export async function pruneAbsentReviewWakeRow(input) {
    try {
        if ((await input.inbox.has(input.wakeId)) !== false)
            return 'kept';
    }
    catch {
        return 'unreadable';
    }
    try {
        await input.store.clear(input.wakeId);
    }
    catch {
        return 'clear-failed';
    }
    return 'cleared';
}
function sameKey(a, b) {
    return (a.rootSessionId === b.rootSessionId &&
        a.reviewerInstanceId === b.reviewerInstanceId &&
        a.sessionGeneration === b.sessionGeneration);
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
export async function recoverReviewWake(coordinator, store, inbox, stopped) {
    const initialStatus = coordinator.state.status;
    const initialWakeId = coordinator.state.wakeId;
    const initialFingerprint = coordinator.state.observedWorkFingerprint;
    const changed = () => coordinator.state.status !== initialStatus ||
        coordinator.state.wakeId !== initialWakeId ||
        // turn-end preserves the baseline while clearing status/wakeId: a full
        // dispatch→claim→turn-end→release cycle can land back on idle/null, and
        // recovery must not wipe the progress that cycle recorded.
        coordinator.state.observedWorkFingerprint !== initialFingerprint;
    const busy = () => ({
        adopted: false,
        wakeId: null,
        reason: 'busy',
        transition: { outcome: 'refused', code: 'invalid-transition', state: coordinator.state },
    });
    const intent = await store.read();
    if (intent === null) {
        if (changed())
            return busy();
        return {
            adopted: false,
            wakeId: null,
            reason: 'absent',
            transition: coordinator.dispatch({ type: 'recover', persistedWake: null, stopped }),
        };
    }
    if (!sameKey(intent.key, coordinator.state.key)) {
        // A row from another latch identity is never adopted by this one. It is
        // left for its own latch; the reducer refuses the mismatched fact.
        if (changed())
            return busy();
        return {
            adopted: false,
            wakeId: null,
            reason: 'mismatch',
            transition: coordinator.dispatch({
                type: 'recover',
                persistedWake: persistedFact(intent),
                stopped,
            }),
        };
    }
    let exists;
    try {
        exists = await inbox.has(intent.wakeId);
    }
    catch {
        // Unreadable is not absent. Leave the row for a later boot; do not adopt a
        // message we could not confirm, and do not clear durable evidence.
        return {
            adopted: false,
            wakeId: null,
            reason: 'unreadable',
            transition: { outcome: 'refused', code: 'invalid-transition', state: coordinator.state },
        };
    }
    if (!exists) {
        if (changed())
            return busy();
        // Do NOT clear here: `store.clear` is an await, and a dispatch that moves
        // the latch during it could otherwise have its freshly persisted row (same
        // deterministic wakeId) deleted. Recovery only reports `absent`; the next
        // plan overwrites the stale row, and a boot with no work leaves it for the
        // next boot rather than risking a live row.
        return {
            adopted: false,
            wakeId: null,
            reason: 'absent',
            transition: coordinator.dispatch({ type: 'recover', persistedWake: null, stopped }),
        };
    }
    if (changed())
        return busy();
    const transition = coordinator.dispatch({
        type: 'recover',
        persistedWake: persistedFact(intent),
        stopped,
    });
    if (coordinator.state.stopped) {
        // Sticky Stop outranks a persisted queued wake: withdraw it from the
        // native Inbox instead of adopting it. An unreadable/refused remove keeps
        // the row; the throw must not abort the whole boot recovery loop.
        try {
            const removed = await inbox.remove?.(intent.wakeId);
            if (removed === false && (await inbox.has(intent.wakeId)) !== false) {
                return { adopted: false, wakeId: null, reason: 'stopped', transition };
            }
        }
        catch {
            return { adopted: false, wakeId: null, reason: 'stopped', transition };
        }
        await store.clear(intent.wakeId);
        return { adopted: false, wakeId: null, reason: 'stopped', transition };
    }
    if (transition.outcome === 'refused') {
        return { adopted: false, wakeId: null, reason: 'refused', transition };
    }
    if (intent.status !== 'accepted') {
        // Window (c): the Inbox accepted the message but the local mark was lost.
        // The Inbox truth is authoritative; record the acceptance now.
        await store.markAccepted(intent.wakeId);
    }
    return {
        adopted: coordinator.state.status === 'queued' &&
            coordinator.state.wakeId === intent.wakeId,
        wakeId: intent.wakeId,
        reason: 'adopted',
        transition,
    };
}
function persistedFact(intent) {
    return {
        key: intent.key,
        // The recovery fact is always `queued`: a crash may have happened after
        // the Host claimed the turn, but no live turn owns that claim any more.
        // Keeping it queued lets a fresh plan coalesce, and the Inbox message
        // existence check above prevents a duplicate delivery.
        status: 'queued',
        wakeId: intent.wakeId,
        workFingerprint: intent.workFingerprint,
    };
}
//# sourceMappingURL=wake-intent.js.map