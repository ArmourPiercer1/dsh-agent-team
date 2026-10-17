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
import type { DispatchEvent, JobOutcome } from './types.js'

/**
 * Map one plane event onto the job outcome closed set. Returns `undefined`
 * for events that carry no outcome fact (the gateway ignores those, it does
 * not guess). Unknown event names are IGNORED-LOUDLY by the caller (the
 * gateway raises its own alarm); this table never stretches.
 */
export function classifyDispatchEvent(event: DispatchEvent): JobOutcome | undefined {
  switch (event.event) {
    case 'dispatcher-call-cancelled-before-body':
      // Abort-before-exec form, lane-issued: the Body was never resolved.
      return {
        kind: 'not-started',
        sideEffectPossible: false,
        evidenceEvent: event.event,
        abortIssuedBy: event.abortIssuedBy ?? 'lane-definition-move',
      }
    case 'dispatcher-call-cancelled-by-others':
      // Same HOST face, different issuer: still "not started", but the
      // gateway must not attribute the cancellation to itself.
      return {
        kind: 'not-started',
        sideEffectPossible: false,
        evidenceEvent: event.event,
        abortIssuedBy: event.abortIssuedBy ?? 'other',
      }
    case 'dispatcher-call-terminated-after-body-start':
      // Terminate form: started ⇒ side effects possible/real, value kept.
      // `sideEffectPossible: true` is the plane's own attachment; the
      // boundary hard-codes it because a started Body CANNOT be reported
      // with sideEffectPossible false even if the event lost the field.
      return {
        kind: 'terminated-after-start',
        sideEffectPossible: true,
        evidenceEvent: event.event,
        abortIssuedBy: event.abortIssuedBy ?? 'unknown',
      }
    case 'dispatcher-call-completed-after-abort':
      // The abort lost the race: EXECUTED, said out loud.
      return {
        kind: 'executed-despite-cancel',
        sideEffectPossible: true,
        evidenceEvent: event.event,
        abortIssuedBy: event.abortIssuedBy ?? 'lane-definition-move',
      }
    case 'dispatcher-call-outcome-unreadable':
    case 'dispatcher-call-executed-unvalidated':
      // Nothing is known (or the fact is an integrity alarm, not an outcome):
      // the job stays unresolved rather than picking a shape.
      return {
        kind: 'unresolved',
        sideEffectPossible: true, // an unvalidated execution may have done anything
        evidenceEvent: event.event,
        abortIssuedBy: event.abortIssuedBy ?? 'unknown',
      }
    default:
      return undefined
  }
}
