/**
 * Alpha.6 PR3 — ReviewWakeCoordinator: the closed vocabulary.
 *
 * The coordinator is a PURE latch over one recipient identity
 * (`rootSessionId`, `reviewerInstanceId`, `sessionGeneration`). It owns
 * scheduling state only: whether one generic Review Wake is in flight and
 * whether newer `WorkChanged` hints arrived while it was in flight. It never
 * owns approval authority, a route decision, a case payload, a mandate, or a
 * timer (ADR-A6-1 / A6-INBOX; blueprint §3.4).
 *
 * Deliberate omissions (the frozen design rejects them):
 *   - no seven-phase WakeSlot (`idle/queued/running` + a dirty flag is the
 *     whole phase model);
 *   - no `writerToken` / `leaseEpoch` / per-wake lease fencing;
 *   - no independent timer service and no timed re-delivery;
 *   - no durable redelivery counters.
 *
 * Everything the coordinator needs from the outside world arrives as an
 * event or as a persisted fact; everything it wants done leaves as an effect
 * descriptor. There is no clock, no randomness and no I/O.
 *
 * @module @dsh-agent-team/runtime/review-wake/types
 */
/** The only three scheduling phases (the frozen compression). */
export declare const REVIEW_WAKE_STATUSES: readonly ["idle", "queued", "running"];
export type ReviewWakeStatus = (typeof REVIEW_WAKE_STATUSES)[number];
/**
 * The closed set of authoritative `WorkChanged` causes. The cause is
 * propagation metadata for the emitted `rescan`; it is never stored in the
 * latch and never becomes a wake payload.
 */
export declare const REVIEW_WAKE_ACTIVATION_REASONS: readonly ["work-changed", "handoff", "takeover"];
export type ReviewWakeActivationReason = (typeof REVIEW_WAKE_ACTIVATION_REASONS)[number];
/** The closed shape of one authoritative read of the recipient's ready work. */
export declare const REVIEW_WAKE_SCAN_KINDS: readonly ["ready", "no-ready-work"];
export type ReviewWakeScanKind = (typeof REVIEW_WAKE_SCAN_KINDS)[number];
/** Why the coordinator asked for an authoritative re-read. */
export declare const REVIEW_WAKE_RESCAN_REASONS: readonly ["activation", "poll", "turn-end", "resume"];
export type ReviewWakeRescanReason = (typeof REVIEW_WAKE_RESCAN_REASONS)[number];
/** Why an unclaimed queued wake is being withdrawn. */
export declare const REVIEW_WAKE_WITHDRAW_REASONS: readonly ["no-ready-work", "stopped"];
export type ReviewWakeWithdrawReason = (typeof REVIEW_WAKE_WITHDRAW_REASONS)[number];
/** The closed event vocabulary accepted by the reducer. */
export declare const REVIEW_WAKE_EVENT_TYPES: readonly ["activate", "poll", "scan-result", "turn-start", "turn-end", "delivery-failed", "stop", "resume", "recover"];
export type ReviewWakeEventType = (typeof REVIEW_WAKE_EVENT_TYPES)[number];
/** The closed refusal vocabulary (malformed input and invalid transitions). */
export declare const REVIEW_WAKE_REFUSAL_CODES: readonly ["invalid-key", "invalid-event", "invalid-scan", "invalid-persisted-wake", "key-mismatch", "wake-mismatch", "invalid-transition"];
export type ReviewWakeRefusalCode = (typeof REVIEW_WAKE_REFUSAL_CODES)[number];
/**
 * The single-flight identity. A new `sessionGeneration` is a DIFFERENT latch:
 * a persisted wake from an older generation is never adopted by a newer one.
 */
export interface ReviewWakeKey {
    readonly rootSessionId: string;
    readonly reviewerInstanceId: string;
    readonly sessionGeneration: number;
}
/**
 * An authoritative answer to a `rescan` effect.
 *
 * `pending` and `changed` are intentionally two independent facts:
 * `{ kind: 'ready', fingerprint }` means work is still pending and the
 * fingerprint says whether it moved; `{ kind: 'no-ready-work' }` is the ONLY
 * fact that may release/withdraw an existing wake. A repeated `ready` with
 * the same fingerprint is "pending but unchanged" — not stale, not resolved.
 */
export type ReviewWorkScan = {
    readonly kind: 'ready';
    readonly fingerprint: string;
} | {
    readonly kind: 'no-ready-work';
};
/**
 * The persisted wake row/fact the caller may hand back on recovery. The
 * coordinator never reads it itself; it adopts it when supplied and mints no
 * duplicate delivery.
 */
export interface PersistedReviewWakeFact {
    readonly key: ReviewWakeKey;
    readonly status: Extract<ReviewWakeStatus, 'queued' | 'running'>;
    readonly wakeId: string;
    readonly workFingerprint: string;
}
/** The scheduling state. No allow/decision/case/mandate payload lives here. */
export interface ReviewWakeState {
    readonly key: ReviewWakeKey;
    readonly status: ReviewWakeStatus;
    /** A `WorkChanged` arrived while queued/running and was not yet coalesced. */
    readonly dirty: boolean;
    /** Sticky user Stop; only an explicit `resume` may clear it. */
    readonly stopped: boolean;
    /**
     * The last authoritative ready-work fingerprint the coordinator accounted
     * for OUTSIDE a running turn. Used only as the no-progress baseline.
     */
    readonly observedWorkFingerprint: string | null;
    /** The one outstanding generic wake, if any. */
    readonly wakeId: string | null;
}
/** Effect descriptors; the caller performs them. None of them is I/O here. */
export type ReviewWakeEffect = {
    readonly kind: 'rescan';
    readonly key: ReviewWakeKey;
    readonly reason: ReviewWakeRescanReason;
} | {
    readonly kind: 'deliver-wake';
    readonly key: ReviewWakeKey;
    readonly wakeId: string;
    readonly workFingerprint: string;
    /**
     * The exact durable leg ids this wake covers, when the dispatcher has
     * them. They are addressed REVIEW TARGETS (not authority): the Officer
     * cannot enumerate the Leader-only pending list, so the wake itself
     * must carry the ids it is allowed to decide.
     */
    readonly requestIds?: readonly string[];
} | {
    readonly kind: 'withdraw-wake';
    readonly key: ReviewWakeKey;
    readonly wakeId: string;
    readonly reason: ReviewWakeWithdrawReason;
};
/** A `WorkChanged` hint. It is a re-read request, never a wake payload. */
export interface ReviewWakeActivateEvent {
    readonly type: 'activate';
    readonly reason: ReviewWakeActivationReason;
}
/** An automatic (non-timer) poll request. Stop suppresses it. */
export interface ReviewWakePollEvent {
    readonly type: 'poll';
}
/** The authoritative answer to a re-read request. */
export interface ReviewWakeScanResultEvent {
    readonly type: 'scan-result';
    readonly work: ReviewWorkScan;
}
/** The queued wake was claimed and its turn actually started. */
export interface ReviewWakeTurnStartEvent {
    readonly type: 'turn-start';
}
/** The claimed turn actually ended; this is the one post-turn re-read. */
export interface ReviewWakeTurnEndEvent {
    readonly type: 'turn-end';
}
/**
 * The delivery path failed. Releases `queued`; never retries by itself.
 * `wakeId` optionally identifies the attempt so a stale failure cannot
 * release a newer wake.
 */
export interface ReviewWakeDeliveryFailedEvent {
    readonly type: 'delivery-failed';
    readonly wakeId?: string;
}
/** Sticky user Stop. It suspends automatic activation/poll/rescan. */
export interface ReviewWakeStopEvent {
    readonly type: 'stop';
}
/** The ONLY event that may clear a Stop. */
export interface ReviewWakeResumeEvent {
    readonly type: 'resume';
}
/**
 * Restart/recovery input. Persisted facts arrive as data; the coordinator
 * performs no lookup. A supplied wake is adopted (never re-delivered).
 */
export interface ReviewWakeRecoverEvent {
    readonly type: 'recover';
    readonly persistedWake?: PersistedReviewWakeFact | null;
    readonly stopped?: boolean;
}
export type ReviewWakeEvent = ReviewWakeActivateEvent | ReviewWakePollEvent | ReviewWakeScanResultEvent | ReviewWakeTurnStartEvent | ReviewWakeTurnEndEvent | ReviewWakeDeliveryFailedEvent | ReviewWakeStopEvent | ReviewWakeResumeEvent | ReviewWakeRecoverEvent;
/** The pure result of one reduction. Refusals never mutate the state. */
export type ReviewWakeTransition = {
    readonly outcome: 'applied';
    readonly state: ReviewWakeState;
    readonly effects: readonly ReviewWakeEffect[];
} | {
    readonly outcome: 'refused';
    readonly code: ReviewWakeRefusalCode;
    readonly state: ReviewWakeState;
};
/** The thin stateful shell around the pure reducer (still no I/O). */
export interface ReviewWakeCoordinator {
    readonly state: ReviewWakeState;
    dispatch(event: ReviewWakeEvent): ReviewWakeTransition;
}
//# sourceMappingURL=types.d.ts.map