/**
 * cancellation-boundary.ts — job-level reading of the dispatch plane's TWO
 * cancellation shapes (INTERFACES-v1 C-GW; authority = the PR1r B3(ii)
 * implementation, `origin/alpha5-pr1r-residual-boundaries` @ **bd6310ca**,
 * `tool-dispatch/install.ts` `classifyOutcome`).
 *
 * THE LAW THIS MODULE EXISTS TO ENFORCE: **an already-started side effect is
 * never re-labelled as un-executed.** The pinned Host decides what happened
 * and reports it through its OWN two shapes; this boundary reads them and
 * nothing else:
 *
 *  - `ABORTED_BEFORE_DISPATCH` (`bodyInvoked` false) is the ONLY evidence
 *    that may say "not started" — the abort-before-exec form.
 *  - `ABORTED` (body invoked, result superseded) is the terminate form:
 *    reported TERMINATED, `sideEffectPossible` true, the Body's own value
 *    preserved; NEVER cancelled, NEVER un-executed.
 *  - A lane abort that lost the race is EXECUTED and said out loud
 *    (`dispatcher-call-completed-after-abort`).
 *  - An unreadable outcome after a cancel stays UNRESOLVED: neither "it ran"
 *    nor "it did not run" may be invented.
 *
 * The event-plane face is kept DISTINGUISHABLE end to end: the gateway's
 * per-job record carries the exact `evidenceEvent` name, so a consumer can
 * always tell which of the two forms settled the job. Collapsing the two is
 * the false-negative this whole mechanism exists to prevent.
 *
 * @module runtime/jobs-gateway/cancellation-boundary
 */
import type { DispatchEvent, JobOutcome } from './types.js';
/**
 * Map one plane event onto the job outcome closed set. Returns `undefined`
 * for events that carry no outcome fact (the gateway ignores those, it does
 * not guess). Unknown event names are IGNORED-LOUDLY by the caller (the
 * gateway raises its own alarm); this table never stretches.
 */
export declare function classifyDispatchEvent(event: DispatchEvent): JobOutcome | undefined;
//# sourceMappingURL=cancellation-boundary.d.ts.map