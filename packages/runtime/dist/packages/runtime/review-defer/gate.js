/**
 * Alpha.6 PR4′ — the gate: the one place that decides whether a Leader notification is delivered.
 *
 * WHY THE GATE WRAPS THE PORT AND NOT THE DELIVERER. The deliverer handed to `createLeaderControlNotifier`
 * receives `{ rootSessionId, requestId, text }` — a rendered string. A defer is addressed to a case and a leg,
 * and the only place those two facts exist together is the `ControlRequestRecord` that reaches the
 * notification port (`control/service.ts:2535` passes the whole record). Deciding at the deliverer would mean
 * reading a case id back out of a rendered sentence, which is exactly the kind of inference a wake gate must
 * not make. So this gate implements the port and composes the real notifier underneath it, leaving the
 * protected notifier untouched and leaving the wire format somebody else owns.
 *
 * THE ONE CHOOSER. `root.ts` builds EITHER the plain notifier or this gate, from one plane flag, once, at the
 * port-presence arm that already exists. Nothing below reads a flag, and nothing below can turn itself on:
 * a second switch that also believed it owned "the same wake" is how two deliverers end up both delivering,
 * and `a6-pr4-mutex-negative.test.ts` exists to make that shape fail loudly rather than intermittently.
 *
 * FAIL OPEN, ALWAYS. Every way this gate can be confused — an unreadable clock, a record that is not a record,
 * a store that has been handed a garbage entry — answers "deliver". The asymmetry is the whole design: an
 * extra wake costs the Leader one look at a case that is genuinely still pending, while a suppressed wake costs
 * the case its reviewer. A defer is a courtesy to attention, never a control on authority.
 */
import { cancelReviewDefer, listReviewDefers, reviewDeferEntryId, reviewDeferKeyOf, setReviewDefer, } from './store.js';
import {} from './types.js';
function deliverNow(key, notBeforeIso, reason) {
    return Object.freeze({ decision: 'deliver', reason, notBeforeIso, key });
}
/**
 * The decision, as a pure function of (store contents, this record, this instant).
 *
 * Exposed separately from the gate so the laws can be pinned without a notifier, a promise, or a team world:
 * a decision that is only observable through a delivered message is a decision tested by fixture.
 */
export function decideReviewWake(store, rootSessionId, record, nowIso) {
    const identified = reviewDeferKeyOf(rootSessionId, record);
    if (!identified.ok) {
        // The only refusal that reaches a wake decision. A pre-Alpha.4 row cannot be attributed to a case, and a
        // malformed one cannot be attributed to a leg; neither may be muted on a guess.
        return deliverNow(null, null, 'WAKE_CASE_UNIDENTIFIED');
    }
    const key = identified.value;
    const id = reviewDeferEntryId(key);
    const standing = store.entries.get(id);
    if (standing === undefined) {
        return deliverNow(key, null, 'WAKE_NOT_DEFERRED');
    }
    // Sweep-on-every-touch, applied to the one entry this decision is about to answer for. An expired floor is
    // not a defer any more, and the wake that discovers that is the one that gets delivered.
    if (Date.parse(standing.notBeforeIso) - Date.parse(nowIso) <= 0) {
        store.entries.delete(id);
        return deliverNow(key, standing.notBeforeIso, 'WAKE_DEFER_FLOOR_PASSED');
    }
    return Object.freeze({
        decision: 'defer',
        reason: 'WAKE_DEFER_PENDING',
        notBeforeIso: standing.notBeforeIso,
        key,
    });
}
/**
 * Build the gate. `notify` is the real notifier (the protected `createLeaderControlNotifier` output, or a
 * double in a test); `nowIso` is the same injected clock the control service was given, because a wake gate
 * holding its own clock would disagree with the plane about when anything is due.
 */
export function createReviewDeferGate(deps) {
    const decide = (record) => {
        try {
            return decideReviewWake(deps.store, record.rootSessionId, record, deps.nowIso());
        }
        catch {
            // FAIL OPEN, and it is a law rather than a shortcut: the caller of this function is a notification
            // trigger whose own failure handling is liveness-only, so the two ways to be wrong here are "throw" and
            // "suppress". Both cost the Leader a look at a pending case. Delivering on a confused clock costs one
            // extra look, which is the cheaper error by every measure this phase has.
            return deliverNow(null, null, 'WAKE_NOT_DEFERRED');
        }
    };
    return {
        store: deps.store,
        notifyLeaderRequest: async (record) => {
            const decision = decide(record);
            deps.onDecision?.(decision);
            if (decision.decision === 'defer')
                return;
            // Propagated unchanged. The trigger reports a delivery failure as a liveness fault and the request stays
            // pending; a gate that swallowed the rejection would make a broken deliverer look like a deferred case.
            await deps.notify.notifyLeaderRequest(record);
        },
    };
}
export function createReviewDeferPort(deps) {
    return {
        set: (input) => setReviewDefer(deps.store, input, deps.nowIso()),
        cancel: (key) => cancelReviewDefer(deps.store, key, deps.nowIso()),
        list: () => listReviewDefers(deps.store, deps.nowIso()),
    };
}
//# sourceMappingURL=gate.js.map