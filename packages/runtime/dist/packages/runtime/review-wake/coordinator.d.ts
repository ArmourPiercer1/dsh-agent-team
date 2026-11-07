/**
 * Alpha.6 PR3 — the pure Review Wake coordinator.
 *
 * ## Laws implemented here (blueprint §3.4; execution plan A6-PR3)
 *
 * 1. **Single flight.** One latch per `(rootSessionId, reviewerInstanceId,
 *    sessionGeneration)`. While `queued` or `running`, an activation only
 *    sets `dirty`; it never enqueues a second wake. Three activations still
 *    produce at most one `deliver-wake`.
 * 2. **One post-turn re-read.** `turn-end` emits exactly one `rescan`
 *    (unless Stop is active). The following `scan-result` decides: ready
 *    work whose fingerprint MOVED yields at most one fresh wake; the same
 *    fingerprint yields none.
 * 3. **Pending ≠ changed.** `{ kind: 'ready' }` with the observed
 *    fingerprint is pending-but-unchanged; it never withdraws the valid
 *    wake. Only `{ kind: 'no-ready-work' }` may release/withdraw it.
 * 4. **No-progress guard.** The observed fingerprint is the baseline: a
 *    repeated scan of the same ready work never re-wakes, so a poll loop
 *    cannot spin model turns. There is no counter and no timer.
 * 5. **Recovery.** A persisted wake fact is ADOPTED (`status`, `wakeId`,
 *    baseline); it is never re-delivered. No fact starts `idle`. A fact from
 *    another generation/key is refused.
 * 6. **Delivery failure.** A failed queued delivery releases `queued` to
 *    `idle` and resets the baseline, so a LATER activation may retry. The
 *    coordinator never retries by itself.
 * 7. **Sticky Stop.** `stop` suspends the latch (withdrawing an unclaimed
 *    queued wake); activations/polls/scans cannot revive it. Only an
 *    explicit `resume` does.
 *
 * The coordinator performs no I/O, imports no `node:*` module, reads no
 * clock and schedules no timer. Inputs are data/events; outputs are effect
 * descriptors (`rescan`, `deliver-wake`, `withdraw-wake`) for the caller.
 *
 * @module @dsh-agent-team/runtime/review-wake/coordinator
 */
import type { ReviewWakeCoordinator, ReviewWakeEvent, ReviewWakeKey, ReviewWakeState, ReviewWakeTransition } from './types.js';
/**
 * Build the initial idle latch for one single-flight identity.
 *
 * @throws ReviewWakeInputError when `key` is structurally invalid.
 */
export declare function createReviewWakeState(key: ReviewWakeKey): ReviewWakeState;
/**
 * Reduce one event over the latch. Deterministic and side-effect free: the
 * input state is never mutated, refusals return it byte-for-byte, and every
 * desired action is an effect descriptor.
 */
export declare function reduceReviewWake(state: ReviewWakeState, event: ReviewWakeEvent): ReviewWakeTransition;
/**
 * The thin stateful shell over the reducer. It stores only the pure latch;
 * callers still perform every effect. No I/O, no timers, no clock.
 */
export declare function createReviewWakeCoordinator(key: ReviewWakeKey): ReviewWakeCoordinator;
/** Guard for callers that need to assert a state is one we produced. */
export declare function isReviewWakeStatus(value: unknown): boolean;
//# sourceMappingURL=coordinator.d.ts.map