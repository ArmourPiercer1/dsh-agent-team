# Sticky Stop — production wiring audit

The latch coordinator implements the semantics correctly
(`packages/runtime/review-wake/coordinator.ts:419-463`): `stop` suspends the
latch, withdraws an unclaimed queued wake, suppresses the automatic turn-end
rescan, and only `resume` clears `stopped`. Unit coverage exists
(`a6-pr3-wake-coordinator.test.ts`, `a6-wake-persist.test.ts`).

What is missing is a **production producer** of those two events. A repository
search for a non-test `dispatch({ type: 'stop' | 'resume' })` finds none; the
only `stopped` readings are inside the wake-intent adoption path. The Host
`/api/session/cancel` path used by the Stop probe cancels the session turn, but
does not send `stop` to `alpha6WakeBySession`/`alpha6WakeCoordinators`.

Consequences:

- The real-Host Stop evidence in `stop.md` is Control-decision non-revival
  (allow recorded → cancel → no consumption/execution → second allow
  `CONTROL_REQUEST_DECIDED`). It does **not** exercise Sticky Stop.
- A future queued wake for that Officer session is not suppressed by an
  explicit user Stop at the wake-plane level, because no Stop event reaches the
  coordinator outside tests.
- This is **NOT_WIRED**, not merely "not reached by this run". It would need a
  minimal design ruling before any production wiring (who translates a Host
  cancel into a wake `stop`, and which explicit action is the `resume`).

Status: Sticky Stop row remains PARTIAL/blocked; no positive Host claim is made.
