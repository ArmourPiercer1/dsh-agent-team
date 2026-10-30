/**
 * Alpha.6 PR3′ (Lane 2) — the wake slot's transition function.
 *
 * One pure function, `reduceWakeSlot(previous, event, context)`, plus the only two things allowed to put a
 * slot into existence: `createWakeSlot` and `hydrateWakeSlot`. Everything the outside world may say comes
 * in as a `WakeEvent`; everything the kernel may ask for goes out as an effect descriptor. No clock, no
 * I/O, no host, no promise, no random value (L-6).
 *
 * ## The slot brand, which this lane already knows it needs
 *
 * PR0's first review found that a hand-built `ReviewPlan` walked straight past its parser's law. The same
 * attack is worse here: a `withdraw-wake` effect carries an exact `messageId` that an adapter will DELETE,
 * and it is built from fields of the slot. A fabricated slot carrying a fabricated `messageId` would be a
 * plugin deleting a message it never authored. So a slot is trustworthy only if this module made it —
 * `BRANDED_SLOTS`, a `WeakSet` keyed on object identity, handed out only by `createWakeSlot` and
 * `hydrateWakeSlot` (which validates every field and mints a frozen copy rather than trusting the caller's
 * object). `reduceWakeSlot` refuses an unbranded `previous`. The store adapter's entire job is
 * `hydrateWakeSlot(row)` in and `compareAndSwap(next)` out; there is no way around validation, exactly as
 * PR-I1 has no way around `parseReviewPlan`.
 *
 * ## Refusal, never exception
 *
 * Every rejected transition answers with a code from the closed `WakeRefusalCode` list and returns the
 * incoming slot **by reference**, unchanged. Container presence is checked before any read that could
 * throw, including the destructures that would themselves throw — the precise lesson PR0's round-2 review
 * recorded, applied here on day one rather than relearned. What that does NOT promise, at the precision
 * the code holds: any event whose containers exist and whose fields are plain values always gets a code. A
 * getter that throws on a field this module must read cannot be defended against by any code anywhere, so
 * hostile containers are a caller obligation — and the caller is `hydrateWakeSlot`, which reads fields one
 * at a time off a storage row, or a host fact read inside the team lock.
 */
import { type WakeContext, type WakeEvent, type WakeReduceResult, type WakeRefusalCode, type WakeSlot, type WakeSlotKey } from './types.js';
/** True only for a slot this module produced. Exported for tests and for an adapter's own paranoia. */
export declare function isBrandedWakeSlot(slot: WakeSlot): boolean;
/**
 * A brand-new slot, `idle`, having never asked for anything.
 *
 * Note what this does NOT do: it does not reserve a wake. Reservation is a transition like any other and
 * goes through the reducer, so "at most one outstanding wake per triple" has exactly one place it could be
 * broken and exactly one place a test has to aim.
 */
export declare function createWakeSlot(key: WakeSlotKey, ctx: WakeContext, fence: {
    readonly leaseEpoch: number;
    readonly writerToken: string;
}): WakeSlot;
/**
 * Rebuild a slot from a storage row, or refuse it. The adapter's only entry point, and deliberately not
 * permissive: an unknown phase, a non-integer revision, an empty `wakeId`, a `claimedTurn` that arrived as
 * a string — all refused, none of them producing a branded object. A corrupt row must not become a slot,
 * because a slot is what a deletion is authorised against. The result is never the caller's object but a
 * frozen copy, so a row the caller can still mutate cannot later change what the kernel believes.
 */
export declare function hydrateWakeSlot(raw: unknown): {
    readonly ok: true;
    readonly slot: WakeSlot;
} | {
    readonly ok: false;
    readonly refusal: WakeRefusalCode;
};
/**
 * The transition function. `previous` is the slot as the store last knew it, or `null` for a triple never
 * seen. The slot that comes back is what the adapter must CAS in at `expectedRevision`; if that CAS loses,
 * this entire result is thrown away and the event is re-run against the winning state — which is why the
 * reducer keeps no state of its own to get out of step.
 */
export declare function reduceWakeSlot(previous: WakeSlot | null, event: WakeEvent, ctx: WakeContext): WakeReduceResult;
//# sourceMappingURL=slot.d.ts.map