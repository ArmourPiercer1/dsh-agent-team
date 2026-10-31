/**
 * Alpha.6 PR-I2 (Lane 2) — `timed-wake`: the consumer-side decision for a **floor-delayed** wake.
 *
 * NOT the same module as `../review-wake`, and the difference is the whole point of keeping them apart:
 *  - `review-wake` is the single-flight kernel — "a hundred requests, at most one go-look". It owns a
 *    *coalescing* decision, is allowed to be lost, and promises no future instant.
 *  - `timed-wake` is the carrier-facing half: "promise me a wake not before instant T". That promise needs a time
 *    source the plugin does not have, so what ships here is the decision and the refusal surface, not a scheduler.
 *
 * Nothing in this directory schedules. Nothing imports it yet: `src/plugin/host.ts` is untouched, because the
 * wiring precondition in the contract memo §10 (legs L-1a/L-1b measured against a real host) has not been met —
 * those legs are ENV-REFUSED on this machine, and ENV-REFUSED is not a pass.
 *
 * @module packages/runtime/timed-wake
 */
export { decideTimedWake, observeTimedWake } from './decision.js';
//# sourceMappingURL=index.js.map