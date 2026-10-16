/**
 * Alpha.5 PR2 (plan §5, hard clause H1 @ user 05:4x/07:0xZ) — THE FINITE-CLOCK
 * GATE OF THE ADMISSION LAYER.
 *
 * THE DEFECT THIS CLOSES. PR0's grant validation owns no clock (`now` is
 * injected per call, `grant.ts`) and its expiry law is the STRICT `now >
 * expiresAt` (PR0-pinned, unchanged — the a5p0-grant-replay tests record the
 * operator semantics of non-finite inputs as a FACT OF THE `>` OPERATOR, not as
 * a recommended contract). A `NaN` clock can never satisfy `>`, so an expired
 * grant validated with `now = NaN` passes the expiry leg; `−Infinity` passes
 * everything. "An expiry check that could not be evaluated" is not "an expiry
 * check that passed".
 *
 * THE LAW (user verbatim, 05:4x/07:0xZ): ANY clock input entering an
 * authorization/expiry decision must be VERIFIED FINITE by the Admission layer
 * BEFORE it is consulted; `NaN` / `±Infinity` (and any non-number) is a typed
 * fail-closed denial with **body = 0** — no mint, no consume, no probe, no
 * port call, no side effect of any kind. The responsible layer is PR2
 * Admission, and `a5p2-admission-clock` pins it. PR0's non-finite tests remain
 * what they are: a recorded operator fact and the precondition for this law,
 * never a contract recommendation.
 *
 * The §5 code is `APPROVAL_STALE`, not a new member (the PR0 error set is
 * frozen): the clock feeds exactly the freshness legs (grant expiry,
 * generation freshness), and a freshness question whose clock is not a real
 * number has no proven answer — the operation is refused exactly as a stale
 * one is. The refusal is total and first: {@link requireFiniteClock} runs
 * before anything time-dependent, so `sideEffectUnknown` is never needed and
 * the denial carries `details.refusal = 'clock-not-finite'`.
 *
 * Purity: no `node:*`, no I/O, no timers — the caller owns the wall clock.
 *
 * @module @dsh-agent-team/runtime/tool-admission/clock
 */
/** Classify one clock candidate without trusting its type. */
export function classifyClock(now) {
    if (typeof now !== 'number')
        return 'not-a-number';
    if (Number.isNaN(now))
        return 'nan';
    if (now === Number.POSITIVE_INFINITY)
        return 'positive-infinity';
    if (now === Number.NEGATIVE_INFINITY)
        return 'negative-infinity';
    return null;
}
/**
 * Validate one injected clock reading for use in an authorization/expiry
 * decision. `ok` carries the SAME number back (a gate, not a converter);
 * anything non-finite is a typed denial carrying which leg failed.
 * @param now - the injected clock value, untrusted until proven finite.
 * @param usage - what the clock is about to decide (message context only).
 */
export function requireFiniteClock(now, usage) {
    const kind = classifyClock(now);
    if (kind !== null) {
        return {
            ok: false,
            error: {
                code: 'APPROVAL_STALE',
                message: `admission refused: the injected clock is not a finite number (${kind}) while deciding ${usage}; an expiry or freshness leg that cannot be evaluated has not passed — fail-closed, zero side effects (H1: the Admission layer verifies every clock before any authorization/expiry use)`,
                details: { refusal: 'clock-not-finite', clockKind: kind, usage },
            },
        };
    }
    return { ok: true, value: now };
}
//# sourceMappingURL=clock.js.map