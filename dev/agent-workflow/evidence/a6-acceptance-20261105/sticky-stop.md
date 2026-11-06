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
  Ordinary tool Abort, timeout and internal cancel do **not** carry that cause:
  the team's own aborts/interrupts now request `{kind:'hook', reason:...}`, so
  they are ignored.
- `agent/inbox/claimed` with a message whose `source.kind==='user'` →
  `alpha6WakeUserResume`. This is an explicit new user interaction; WorkChanged
  never calls it. Team-internal deliveries (work, messaging relay, root input)
  now carry `plugin:dsh-agent-team`; only a human `member.send` (an attribution
  carrying `fromHumanId`) or a direct prompt carries `user`, so a Leader/model
  message cannot clear a human Stop.

The Stop is durable, not process memory: `alpha6WakeUserStop` writes
`<intentDir>/stopped-<latchHash>.json` BEFORE dispatching `stop`. A post-restart
dispatch or recovery reads that marker and adopts `stopped` into the
coordinator; an unclaimed queued wake is withdrawn and its intent row cleared.

## Real-Host evidence — `a6-sticky-stop-r13`

Root `session-c1-smoke-a6-2026-11-06T09-24-13`:

- member ask → Officer review wake delivered (1 wake).
- `session/cancel` on the **Officer child** accepted (`A6-22` PASS).
- Durable `stopped-6c784f00.json` present (both latch key and reviewer
  `targetSessionId`); the queued wake row is gone; no re-delivery (1 → 1 wakes).
- SIGKILL + real Host restart: the marker persists and the withdrawn wake is
  still not re-delivered (`A6-23` PASS).
- A human `member.send` on the stopped reviewer after restart clears the marker
  and re-plans the pending wake (1 → 4 wake attempts), while the historical call
  remains unexecuted (`A6-24` PASS, Scheme A: no replay/re-grant).

## Resume status

Production-wired and Host-proven within Scheme A. A fresh boot may have no
in-memory coordinator (Stop cleared the intent row), so resume first rebuilds
the latch from the durable marker (key + target Session), clears the marker,
dispatches `resume`, and — only when that transition actually applied — reads
the durable Control state and re-plans with the REAL delegable leg ids. It never
passes a synthetic empty scan, so an ordinary human chat on a live latch does
not fabricate a wake, and a resumed latch does not duplicate the real one.
The re-planned wake is delivered; the original approval call is NOT revived,
consumed or executed. The receiver must initiate a new call. `A6-24` asserts
marker cleared, wake re-delivered, no historical execution.

**Limit disclosed:** the probe proves delivery/re-plan and non-revival, not a
new call's allow→execute after resume (covered by the ordinary `a6-normal-r6`
path, not chained in one run). The kit's wake counter counts model requests, so
it cannot by itself prove "exactly one delivered wake"; the real-leg re-plan
and the coordinator fingerprint are what prevent the duplicate. Marker writes
are atomic and existence (not JSON parseability) is the Stop; unit tests pin
both.
