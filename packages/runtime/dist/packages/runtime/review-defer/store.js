/**
 * Alpha.6 PR4′ — the defer store: the only mutable state in the lane, and the reason the lane can be
 * reasoned about at all.
 *
 * PROCESS-LOCAL ON PURPOSE. This is a `Map` in one Node process, built by whoever wires the plane — in the
 * intended wiring, one instance per team root in `root.ts`, handed to the gate and to the tool port by
 * reference. Nothing builds one today. It is not a ledger, not durable, and not replicated. The
 * consequence is stated rather than hidden: **a restart forgets every defer, and a forgotten defer produces an
 * early wake.** An early wake is a liveness event — the Leader looks at a case that is genuinely still pending
 * — while a lost wake is an authority event, because a case nobody is told about stops being reviewable. Every
 * possible failure of this store is therefore on the safe side of that line, and `a6-pr4-mutex-negative.test.ts`
 * asserts the ordering by emptying the store and requiring delivery.
 *
 * WHY THERE IS NO DURABLE VERSION YET. `review-assignment/index.ts` states the law for this phase's review
 * lanes: there is no sanctioned durable writer until PR-I1 supplies `allocateSequence()` + `put` behind the
 * team lock. Writing a defer row beside that seam would create the second ledger this phase forbids, and the
 * notification wrapper runs AFTER the control service released the team lock (`control/service.ts:2510-2513`),
 * so a defer committed there is an unlocked fresh read racing the very request that triggered it. A racing
 * defer loses, and loses safely: the notification goes out.
 *
 * SWEEP ON EVERY TOUCH. Expiry is evaluated against the caller's `nowIso` at every entry point — set, cancel,
 * decide, list — so an expired entry is indistinguishable from an absent one without anyone having to run a
 * reaper. There is no reaper, and there must not be one: a timer that wakes cases is the second scheduler this
 * phase already refused.
 *
 * NO CLOCK, NO I/O. Every function takes the instant it needs; the only time operation below is `Date.parse` on a
 * value the caller supplied, which is the same distinction `review-wake/slot.ts` draws when it floors a backoff
 * from `ctx.nowIso`. No `Date` is constructed here, so no read of the wall clock can enter through this file (a
 * hygiene leg greps for it).
 */
import { REVIEW_DEFER_DEFAULT_LIMITS, REVIEW_DEFER_REASON_CODES, } from './types.js';
/**
 * The platform's identifier shape, restated rather than imported. `review-assignment/types.ts` has the same
 * pattern, and importing it would put a dependency edge from PR4′ into PR2′'s lane — which is legal only if
 * PR2′'s dormancy ledger is amended to admit this consumer, and a wake gate that cannot be reviewed without
 * the assignment lane is a worse seam than one duplicated regular expression.
 */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function accept(value) {
    return { ok: true, value };
}
function refuse(refusal, detail) {
    return { ok: false, refusal, detail };
}
/**
 * The single derivation of a store slot from a key. Exported because the gate reads the same slots the writer
 * writes, and a second copy of this expression in the gate would be a bug waiting to diverge: a gate that
 * computes a different slot than the tool writes never sees the defer, which fails open and therefore fails
 * silently. `a6-pr4-review-defer.test.ts` pins that a set and a decide agree on one key without going through
 * either caller.
 *
 * The root session id is part of the slot even though production creates one store per team root. A slot that
 * named only `(case, leg)` would make that containment the whole isolation story, so a store ever shared or
 * reused between roots would let a defer filed for one team session mute another.
 *
 * The segments are LENGTH-PREFIXED, and that is a fix rather than a style choice (round-1 finding F-6 on
 * #509): the id alphabet this lane accepts permits `:`, so a plain join would NOT be injective — root `a::b`
 * with case `c` and root `a` with case `b::c` produce the same string, which is a cross-root mute built out of
 * two legitimate ids. Minted ids never contain `:`, so nothing in this tree reaches it, but a claim of
 * "unrepresentable" has to survive the alphabet it states, and a length prefix makes it true for every input
 * the pattern accepts. `a6-pr4-review-defer.test.ts` pins the reviewer's collision pair to two distinct slots.
 */
export function reviewDeferEntryId(key) {
    const segment = (value) => `${String(value.length)}:${value}`;
    return `${segment(key.rootSessionId)}|${segment(key.approvalCaseId)}#${String(key.legOrdinal)}`;
}
function keyOf(key) {
    return reviewDeferEntryId(key);
}
/** How many milliseconds an instant is from `nowIso`. Negative when it lies in the past, NaN when either side cannot be read. */
function deltaMs(nowIso, instantIso) {
    return Date.parse(instantIso) - Date.parse(nowIso);
}
/**
 * The ONE comparison this lane makes, in three states. `unreadable` means the floor, the caller's instant, or
 * both cannot be read as times; the answer it must produce is the fail-open one, and it is reported as itself
 * rather than folded into `passed`, because "the courtesy expired" and "the courtesy was illegible" are two
 * facts a reader of a log needs to tell apart.
 */
export function floorStateOf(nowIso, instantIso) {
    const remaining = deltaMs(nowIso, instantIso);
    if (!Number.isFinite(remaining))
        return 'unreadable';
    return remaining <= 0 ? 'passed' : 'pending';
}
function floorReached(nowIso, instantIso) {
    return floorStateOf(nowIso, instantIso) !== 'pending';
}
/**
 * Derive the deferrable identity of a wake, or refuse with the reason it is not deferrable.
 *
 * The asymmetry is the point: a record without `approvalCaseId` is a perfectly ordinary pre-Alpha.4 row and
 * the gate must deliver it, so this function's refusal is NOT an error signal for a caller that is deciding
 * whether to notify. `decideReviewWake` therefore handles the unidentified case itself and only calls this for
 * rows that name a case.
 */
export function reviewDeferKeyOf(rootSessionId, candidate) {
    if (!ID_PATTERN.test(rootSessionId) || !ID_PATTERN.test(candidate.requestId)) {
        return refuse('REVIEW_DEFER_ID_MALFORMED', 'rootSessionId / requestId failed hygiene');
    }
    const caseId = candidate.approvalCaseId;
    if (caseId === undefined || caseId === '') {
        return refuse('REVIEW_DEFER_CASE_UNIDENTIFIED', 'the record carries no approvalCaseId (pre-Alpha.4 row)');
    }
    if (!ID_PATTERN.test(caseId)) {
        return refuse('REVIEW_DEFER_ID_MALFORMED', 'approvalCaseId failed hygiene');
    }
    const leg = candidate.legOrdinal;
    if (typeof leg !== 'number' || !Number.isSafeInteger(leg) || leg < 1) {
        return refuse('REVIEW_DEFER_LEG_MALFORMED', `a case-scoped defer needs legOrdinal >= 1, got ${String(leg)}`);
    }
    return accept(Object.freeze({ rootSessionId, approvalCaseId: caseId, legOrdinal: leg }));
}
/**
 * Create the one store a team root shares between its wake gate and whatever files quiets.
 *
 * In this PR nothing calls it from production: the lane ships dark until a wake source can re-fire (see law 6
 * in `types.ts`). When PR-I2 wires it, the rule this signature encodes is the one that matters — ONE store per
 * team root, handed by reference to both the gate and the tool port.
 */
export function createReviewDeferStore(limits = REVIEW_DEFER_DEFAULT_LIMITS) {
    return { limits: usableLimits(limits), entries: new Map() };
}
/**
 * A limit that cannot bound anything is not a limit (round-2 finding R2-1 on #509).
 *
 * `NaN` and `Infinity` both disarm this lane's two stated bounds by arithmetic rather than by malice:
 * `remaining > NaN` is false, so every floor fits the horizon, and `size >= NaN` is false, so the capacity never
 * refuses — a probe against the shipped lane filed a ten-year floor and 300 entries into a store declared at one
 * hour and sixty-four. Nothing can reach that today, because nothing constructs a store; `createReviewDeferStore`
 * takes caller limits, and PR-I2 is exactly the change that will feed plane config into it. So the constructor
 * treats a non-finite, non-positive, or non-integer bound as "no usable limit supplied" and keeps the frozen
 * default, which is the bounded answer. It is a substitution rather than a throw on purpose: this lane's posture
 * is that confusion produces an EXTRA wake, and a store that refuses to exist is a store somebody will wrap in a
 * `try` and then build unbounded. A leg pins both halves.
 */
function usableLimits(limits) {
    const horizonUsable = Number.isFinite(limits.horizonMs) && limits.horizonMs > 0;
    const capUsable = Number.isInteger(limits.maxEntries) && limits.maxEntries >= 1;
    return horizonUsable && capUsable ? limits : REVIEW_DEFER_DEFAULT_LIMITS;
}
/**
 * Drop every entry whose floor has passed and report how many went. Called by every entry point, so the count
 * here is bookkeeping for the caller's telemetry rather than a housekeeping chore somebody must remember.
 */
export function sweepReviewDefers(store, nowIso) {
    // An unreadable CALLER clock retires nothing (round-2 finding R2-2 on #509). The law is about an entry whose
    // FLOOR cannot be read — that one is deleted, because it can never be honoured. A clock that cannot be read is
    // the opposite case: deleting on it throws away every standing quiet on the strength of a value nobody can
    // verify, which is a read that destroys state. The wake path does not need this sweep to fail open —
    // `decideReviewWake` retires an illegible floor itself — so returning 0 here costs nothing and keeps `list`
    // honest: it reports what the store holds instead of emptying it.
    if (!Number.isFinite(Date.parse(nowIso)))
        return 0;
    let swept = 0;
    for (const [id, entry] of store.entries) {
        // An entry whose floor cannot be read is swept, not kept: keeping it would defer a wake on a value that
        // no caller can verify, which is the one thing a sweep is for.
        if (floorReached(nowIso, entry.notBeforeIso)) {
            store.entries.delete(id);
            swept += 1;
        }
    }
    return swept;
}
/**
 * File a defer, or explain why there is not one.
 *
 * Re-filing a key that already stands REPLACES its floor: the newest instruction from the Leader is the one
 * that should hold, and a lane that refused the second instruction would leave the first one muting a case
 * nobody asked about. Saturation is the opposite case — a new key when the store is full is refused rather
 * than made room for, because evicting a standing defer un-mutes a case somebody asked to have left alone,
 * and a surprise wake for the wrong case is the failure this lane exists to prevent.
 */
export function setReviewDefer(store, input, nowIso) {
    const key = {
        rootSessionId: input.rootSessionId,
        approvalCaseId: input.approvalCaseId,
        legOrdinal: input.legOrdinal,
    };
    if (!ID_PATTERN.test(input.rootSessionId) || !ID_PATTERN.test(input.approvalCaseId)) {
        return refuse('REVIEW_DEFER_ID_MALFORMED', 'rootSessionId / approvalCaseId failed hygiene');
    }
    if (!Number.isSafeInteger(key.legOrdinal) || key.legOrdinal < 1) {
        return refuse('REVIEW_DEFER_LEG_MALFORMED', `legOrdinal must be a safe integer >= 1, got ${String(input.legOrdinal)}`);
    }
    if (typeof nowIso !== 'string' || Number.isNaN(Date.parse(nowIso))) {
        return refuse('REVIEW_DEFER_INSTANT_MALFORMED', `nowIso ${String(nowIso)} does not parse`);
    }
    if (typeof input.notBeforeIso !== 'string' || Number.isNaN(Date.parse(input.notBeforeIso))) {
        return refuse('REVIEW_DEFER_INSTANT_MALFORMED', `notBeforeIso ${String(input.notBeforeIso)} does not parse`);
    }
    if (!REVIEW_DEFER_REASON_CODES.includes(input.reasonCode)) {
        return refuse('REVIEW_DEFER_REASON_UNKNOWN', `unknown reason code ${String(input.reasonCode)}`);
    }
    const remaining = deltaMs(nowIso, input.notBeforeIso);
    if (remaining <= 0) {
        return refuse('REVIEW_DEFER_NOT_IN_FUTURE', 'a floor at or before now defers nothing; cancel instead');
    }
    if (remaining > store.limits.horizonMs) {
        return refuse('REVIEW_DEFER_HORIZON_EXCEEDED', `${String(remaining)}ms exceeds the ${String(store.limits.horizonMs)}ms horizon; the pending list is the path for a longer silence`);
    }
    sweepReviewDefers(store, nowIso);
    const id = keyOf(key);
    if (!store.entries.has(id) && store.entries.size >= store.limits.maxEntries) {
        return refuse('REVIEW_DEFER_STORE_SATURATED', `${String(store.entries.size)} defers standing at the cap; a standing defer is never evicted to admit another`);
    }
    const entry = Object.freeze({
        key,
        notBeforeIso: input.notBeforeIso,
        reasonCode: input.reasonCode,
        setAtIso: nowIso,
    });
    store.entries.set(id, entry);
    return accept(entry);
}
/**
 * Withdraw a defer. The answer is the entry that was standing, so a caller can report what it undid.
 *
 * A floor that has already passed is not a special case: the sweep runs first, so the honest answer is "there
 * is nothing standing", and the detail says which of the two the caller met. Conflating them would let a caller
 * report "your defer has been lifted" about a defer that had already lifted itself, which is the sort of
 * sentence that teaches an operator to trust a stale answer.
 */
export function cancelReviewDefer(store, key, nowIso) {
    if (!ID_PATTERN.test(key.rootSessionId) || !ID_PATTERN.test(key.approvalCaseId)) {
        return refuse('REVIEW_DEFER_ID_MALFORMED', 'rootSessionId / approvalCaseId failed hygiene');
    }
    if (!Number.isSafeInteger(key.legOrdinal) || key.legOrdinal < 1) {
        return refuse('REVIEW_DEFER_LEG_MALFORMED', `legOrdinal must be a safe integer >= 1, got ${String(key.legOrdinal)}`);
    }
    if (typeof nowIso !== 'string' || Number.isNaN(Date.parse(nowIso))) {
        return refuse('REVIEW_DEFER_INSTANT_MALFORMED', `nowIso ${String(nowIso)} does not parse`);
    }
    const had = store.entries.get(keyOf(key));
    sweepReviewDefers(store, nowIso);
    const id = keyOf(key);
    const standing = store.entries.has(id) ? store.entries.get(id) : undefined;
    if (standing === undefined) {
        return refuse('REVIEW_DEFER_NO_ACTIVE_DEFER', had === undefined ? 'no defer is standing on this key' : 'the floor had already passed; the defer lifted itself');
    }
    store.entries.delete(id);
    return accept(standing);
}
/** What is standing right now, in filing order. Read-only, and it sweeps on the way past. */
export function listReviewDefers(store, nowIso) {
    // With a readable clock this returns exactly the standing quiets, because the sweep has just retired the rest.
    // With an unreadable clock it returns what the store holds, expired-looking entries included, and retires
    // nothing: "I cannot tell you which of these have passed" is a different answer from "you have none", and a
    // caller that gets the second one from a broken clock will conclude nobody asked for a quiet.
    sweepReviewDefers(store, nowIso);
    return [...store.entries.values()];
}
//# sourceMappingURL=store.js.map