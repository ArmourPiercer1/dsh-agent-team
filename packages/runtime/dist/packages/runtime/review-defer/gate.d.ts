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
import { type ReviewDeferStore } from './store.js';
import { type ReviewDeferEntry, type ReviewDeferKey, type ReviewDeferReasonCode, type ReviewDeferResult, type ReviewDeferWakeDecision, type ReviewWakeCandidate } from './types.js';
/** The seam the gate composes: the real notification port, however it was built. */
export interface WrappedLeaderNotifier {
    notifyLeaderRequest(record: ReviewWakeCandidate): Promise<void>;
}
/** A decision observer. Present so PR5′ can count suppressed wakes without this lane learning about metrics. */
export type ReviewDeferObserver = (decision: ReviewDeferWakeDecision) => void;
export interface ReviewDeferGate {
    /** Structurally the control notification port — what a wired `root.ts` would hand `createControlService`. */
    readonly notifyLeaderRequest: (record: ReviewWakeCandidate) => Promise<void>;
    /** The store the gate reads, shared by reference with whatever port files quiets. There is only ever one. */
    readonly store: ReviewDeferStore;
}
/**
 * The decision, as a pure function of (store contents, this record, this instant).
 *
 * Exposed separately from the gate so the laws can be pinned without a notifier, a promise, or a team world:
 * a decision that is only observable through a delivered message is a decision tested by fixture.
 */
export declare function decideReviewWake(store: ReviewDeferStore, rootSessionId: string, record: ReviewWakeCandidate, nowIso: string): ReviewDeferWakeDecision;
/**
 * Build the gate. `notify` is the real notifier (the protected `createLeaderControlNotifier` output, or a
 * double in a test); `nowIso` is the same injected clock the control service was given, because a wake gate
 * holding its own clock would disagree with the plane about when anything is due.
 */
export declare function createReviewDeferGate(deps: {
    readonly notify: WrappedLeaderNotifier;
    readonly store: ReviewDeferStore;
    readonly nowIso: () => string;
    readonly onDecision?: ReviewDeferObserver;
}): ReviewDeferGate;
/**
 * The seam a tool is INJECTED with, built from the same store the gate reads.
 *
 * Injected rather than imported by `packages/tools`, for two reasons that are both load-bearing: the dependency
 * direction (tools must not import a runtime lane), and the single-store law — a tool that constructed its own
 * store would happily record defers the gate never looks at, which is a switch that does nothing and a state
 * that lies. This PR ships no such tool (law 6 in `types.ts`); the seam is here so the wiring in PR-I2 has one
 * honest way to be done and no second store to invent.
 */
export interface ReviewDeferPort {
    set(input: {
        readonly rootSessionId: string;
        readonly approvalCaseId: string;
        readonly legOrdinal: number;
        readonly notBeforeIso: string;
        readonly reasonCode: ReviewDeferReasonCode;
    }): ReviewDeferResult<ReviewDeferEntry>;
    cancel(key: ReviewDeferKey): ReviewDeferResult<ReviewDeferEntry>;
    list(): readonly ReviewDeferEntry[];
}
export declare function createReviewDeferPort(deps: {
    readonly store: ReviewDeferStore;
    readonly nowIso: () => string;
}): ReviewDeferPort;
//# sourceMappingURL=gate.d.ts.map