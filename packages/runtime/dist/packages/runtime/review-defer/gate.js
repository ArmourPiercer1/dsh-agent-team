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
 * WHO BUILDS IT. Nobody, in this PR: the lane ships dark, and a hygiene leg walks the tree on every run to
 * keep that true. The round-1 review on #509 established that no wake in this tree can arrive for a key that
 * already carries a quiet, so a flag that installed this gate would be a switch with nothing on the other end
 * (law 6 in `types.ts`). When PR-I2 supplies the re-firing wake source, the rule is this: ONE gate per team
 * root, chosen once from one flag, at the port-presence arm in `root.ts` that already exists, sharing its
 * store by reference with whatever files quiets. Nothing in this file reads a flag and nothing here can turn
 * itself on — a second switch that also believed it owned "the same wake" is how two deliverers end up both
 * delivering, and `a6-pr4-mutex-negative.test.ts` exists to make that shape fail loudly rather than
 * intermittently.
 *
 * FAIL OPEN, ALWAYS, AND MEASURED THAT WAY. Every way this gate can be confused — a clock that returns
 * something that is not a time, a record that is not a record, a store handed an entry whose floor cannot be
 * parsed — answers "deliver", and says which of those it met. The first version of this file only honoured the
 * law when the confusion THREW: a non-throwing NaN comparison answered "defer", which is the forbidden
 * direction (round-1 finding F-3 on #509, probe-confirmed against the shipped output). The asymmetry is the
 * whole design: an
 * extra wake costs the Leader one look at a case that is genuinely still pending, while a suppressed wake costs
 * the case its reviewer. A defer is a courtesy to attention, never a control on authority.
 */
import { cancelReviewDefer, floorStateOf, listReviewDefers, reviewDeferEntryId, reviewDeferKeyOf, setReviewDefer, } from './store.js';
import {} from './types.js';
/**
 * Which fact a failed attribution actually reported (round-2 finding R2-3 on #509).
 *
 * Three of the nine refusals can reach a wake decision — the six write-side ones cannot, because no wake calls
 * `setReviewDefer` — and reporting all three as "the record carries no readable case" is a lie
 * about two of them: an unmintable `requestId` or `rootSessionId` leaves the case perfectly legible and breaks only
 * the address, and a row that names a case and no leg is a third fact again. `REVIEW_DEFER_ID_MALFORMED` itself
 * covers four shapes (root, request, and a case id that is present but malformed — round-3 finding R3-6 on #509
 * caught the first version of this paragraph claiming the case was always readable), and this mapping does not
 * split them further: they share one consequence — nothing can be looked up — so they share
 * `WAKE_KEY_UNADDRESSABLE`, which says exactly that and nothing about which field failed. Each reason still means
 * one fact, and no reader can infer "pre-Alpha.4 row" from a hygiene failure.
 */
function wakeReasonOfRefusal(refusal) {
    if (refusal === 'REVIEW_DEFER_LEG_MALFORMED')
        return 'WAKE_LEG_UNIDENTIFIED';
    if (refusal === 'REVIEW_DEFER_ID_MALFORMED')
        return 'WAKE_KEY_UNADDRESSABLE';
    return 'WAKE_CASE_UNIDENTIFIED';
}
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
        // The only refusals that reach a wake decision, told apart because they are different facts: a pre-Alpha.4
        // row names no case at all, while a row that names a case and no leg is attributable enough to notice and
        // not attributable enough to mute. Neither may be muted on a guess.
        return deliverNow(null, null, wakeReasonOfRefusal(identified.refusal));
    }
    const key = identified.value;
    const id = reviewDeferEntryId(key);
    const standing = store.entries.get(id);
    if (standing === undefined) {
        return deliverNow(key, null, 'WAKE_NOT_DEFERRED');
    }
    // Sweep-on-every-touch, applied to the one entry this decision is about to answer for. An expired floor is
    // not a defer any more, and the wake that discovers that is the one that gets delivered.
    const floor = floorStateOf(nowIso, standing.notBeforeIso);
    if (floor !== 'pending') {
        // Both non-pending states retire the entry and deliver: an expired floor is not a defer any more, and an
        // illegible one was never a courtesy anybody could honour. They answer with different reasons so a metric
        // cannot read a broken write as an expiry.
        store.entries.delete(id);
        return deliverNow(key, standing.notBeforeIso, floor === 'passed' ? 'WAKE_DEFER_FLOOR_PASSED' : 'WAKE_DEFER_UNREADABLE');
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
            return deliverNow(null, null, 'WAKE_DECISION_FAILED');
        }
    };
    const observe = (decision) => {
        // An observer is a diagnostician, and a diagnostician that can throw must not be able to suppress a wake:
        // that would be a second switch, reachable from a metrics callback. The lane's own answer still reaches it.
        try {
            deps.onDecision?.(decision);
        }
        catch {
            // deliberately swallowed: nothing a diagnostic does may change what the Leader is told.
        }
    };
    return {
        store: deps.store,
        notifyLeaderRequest: async (record) => {
            const decision = decide(record);
            observe(decision);
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