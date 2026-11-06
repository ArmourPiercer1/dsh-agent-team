# Sticky Stop — production wiring and real-Host evidence

## Semantics

The coordinator already implements the latch semantics
(`packages/runtime/review-wake/coordinator.ts:419-463`): `stop` suspends the
latch, withdraws an unclaimed queued wake, suppresses the automatic turn-end
rescan, and only `resume` clears `stopped`.

## Production producer (this round)

Two trusted Host observations now map onto the wake plane in
`packages/runtime/src/plugin/host.ts`:

- `session/event` → `turn/end` with
  `reason.kind==='aborted' && reason.reason.kind==='user'` → `alpha6WakeUserStop`.
  This is the user's own Stop (`session/cancel` calls `agent.cancel({kind:'user'})`).
  Ordinary tool Abort, timeout and internal cancel do **not** carry that cause
  and are ignored.
- `agent/inbox/claimed` with a message whose `source.kind==='user'` →
  `alpha6WakeUserResume`. This is an explicit new user interaction; WorkChanged
  never calls it.

The Stop is durable, not process memory: `alpha6WakeUserStop` writes
`<intentDir>/stopped-<latchHash>.json` BEFORE dispatching `stop`. A post-restart
dispatch or recovery reads that marker and adopts `stopped` into the
coordinator; an unclaimed queued wake is withdrawn and its intent row cleared.

## Real-Host evidence — `a6-sticky-stop-r3`

Root `session-c1-smoke-a6-2026-11-06T07-02-23`:

- member ask → Officer review wake delivered (1 wake).
- `session/cancel` on the **Officer child** accepted (`A6-22` PASS).
- Durable `stopped-3ec571e0.json` present; the queued `wake-*.json` row is gone;
  no re-delivery (1 → 1 wakes).
- SIGKILL + real Host restart: the marker is still present and the withdrawn
  wake is still not re-delivered (`A6-23` PASS).

## Resume status

The resume producer is wired to an explicit user message on the stopped
reviewer Session and it clears the durable marker before dispatching `resume`.
The only Host-proven half this round is Stop persistence; a resume that then
delivers a **new** review wake driven only by WorkChanged is not yet exercised
end to end. It is reported as PARTIAL, not claimed as PASS.
