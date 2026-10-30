/**
 * Alpha.6 PR3′ (Lane 2) — the restart fold.
 *
 * After a plugin restart the kernel knows two things and believes neither: the slot rows it persisted
 * (which say what it last *asked* for) and the host's inbox facts (which say what is *actually sitting in
 * the reviewer's inbox*). The fold's job is to line those two up and say what should be told to the
 * reducer — and nothing more.
 *
 * The deliberate split, and the reason it is a split: `reconcileWakeSlots` produces **events**, never
 * effects, and it never touches slot state. The reducer is the only thing in this package that decides
 * what a state transition is, and the store's CAS is the only thing that commits one. A fold that computed
 * its own next state would be a second copy of the transition law — the second-ledger mistake in miniature,
 * one review away from the two schedulers disagreeing about what is outstanding. So: the fold decides what
 * to ask, the reducer decides what it means, and one of them can be deleted without hiding the other.
 *
 * What the fold will NOT do, each for a named reason:
 *  - revive a `suspended` slot (invariant 8: Stop is sticky across a restart, not just across a session);
 *  - invent facts for a slot it has no observation for (an unobserved slot is reported, not guessed at —
 *    "we could not tell" must stay visible in the report instead of becoming a quiet transition);
 *  - delete an orphan message it finds in the facts but cannot match to a slot. That is a deletion with a
 *    human's message as the possible other outcome, so it is reported for the adapter to surface and a
 *    human to resolve. PR-I2 owns that path; this fold's silence is the safety property, not a gap;
 *  - act on an unbranded slot (the same brand the reducer demands; hydration is the only front door).
 */
import type { WakeContext, WakeEvent, WakeInboxObservation, WakeRefusalCode, WakeSlot, WakeSlotKey } from './types.js';
/** One reviewer-visible wake message as the host reports it, tied to the triple that authored it. */
export interface WakeInboxFact {
    readonly key: WakeSlotKey;
    readonly inbox: WakeInboxObservation;
    readonly messageId: string | null;
    readonly turn: number | null;
}
export interface WakeReconcileInput {
    readonly slots: readonly WakeSlot[];
    readonly facts: readonly WakeInboxFact[];
    readonly ctx: WakeContext;
    readonly fence: {
        readonly leaseEpoch: number;
        readonly writerToken: string;
    };
}
/** What the adapter must do for one slot: feed these events, in order, CAS-ing at `expectedRevision`. */
export interface WakeReconcilePlan {
    readonly key: WakeSlotKey;
    readonly expectedRevision: number;
    readonly events: readonly WakeEvent[];
}
/**
 * Everything the fold declined to act on, named rather than dropped. This report is the reason the fold is
 * auditable: "we restarted and did nothing about four slots" has to be answerable with which four and why.
 */
export interface WakeReconcileReport {
    readonly plans: readonly WakeReconcilePlan[];
    readonly unobserved: readonly WakeSlotKey[];
    readonly suspended: readonly WakeSlotKey[];
    readonly released: readonly WakeSlotKey[];
    readonly orphanFacts: readonly WakeInboxFact[];
    readonly rejected: readonly {
        readonly key: unknown;
        readonly refusal: WakeRefusalCode;
    }[];
}
/**
 * Line the persisted slots up with the observed inbox facts and produce per-slot event plans.
 *
 * Deterministic by construction: slots are ordered by their canonical key text, each contributes at most
 * one `recovery-observed` event, and nothing here reads a clock or a counter. Two restarts over the same
 * rows and the same facts produce byte-identical plans, which is what makes the crash-window table in the
 * design testable instead of merely plausible.
 */
export declare function reconcileWakeSlots(input: WakeReconcileInput): WakeReconcileReport;
//# sourceMappingURL=recovery.d.ts.map