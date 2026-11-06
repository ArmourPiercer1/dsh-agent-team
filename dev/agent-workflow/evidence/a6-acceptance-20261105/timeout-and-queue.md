# Timeout, queue/claim/release and crash-window status (exact HEAD 8114db4b7)

This file records what is **not** reachable yet, so the acceptance matrix does not
silently promote a unit test or a synthetic timer to product evidence.

## Wait timeout is now reachable and proven

`PaControlBridgeDeps.waitTimeoutMs` already aborts the wait without deciding or
consuming (`pa-control-bridge.ts:539`). The production A6 wiring now supplies it
from `alpha6WaitTimeoutMs` (default 600000 ms when the opt-in is on) in
`agent-bindings.mjs`; the root refuses a non-positive/non-finite value. The
timer is local to the bridge, not a Timer Service.

Real-Host proof, run `a6-timeout-r4` (root
`session-c1-smoke-a6-2026-11-06T06-27-35`, `alpha6WaitTimeoutMs=5000`):

- The Officer mock intentionally never resolves the wake.
- After the bounded wait, `A6-19` PASS: PA `ctrl-0spa2y11wf5niq0dtyrzz1lv`
  is still **pending** (`decision=undefined`), no consumption, no execution.
- A late human `allow` is fail-closed: durable decision `deny`,
  `reason='authority-undetermined'`, no consumption, no execution (`A6-20`
  PASS). The dead Member invocation cannot be revived by the late decision.

This is the strictest form of non-revival: the timeout leaves the request
unsettled, and the later allow is not usable against it.

## Queue / claim / release

Positive real-Host evidence that exists today:

- `a6-handoff-only-r6`: the Officer's transfer event wakes exactly the successor;
  3 review wakes, 2 requests, 2 decisions, 2 consumptions, 0 pending.
- `a6-stop-r3`: cancel while the approved leg is not yet consumed; 0 undecided
  after cancel, no consumption, no execution.
- `a6-human-r9`: escalation → human leg → allow → one consumption → execution.

Open native-Inbox gap (unchanged, **not waived**):

- `a6-recipients-r22`: after a direct prompt to the same Officer child Session, the
  native handle reports `idle`; a `followup` changes it to `running`, yet no model
  turn is produced for the queued team wake (PA
  `ctrl-1gcrjbd0vlh1060aqietb1e8` stays pending). Clean handoff in a fresh lifetime
  is green, so this is a queued-wake/turn-start problem, not transfer routing.

No run yet covers: Sticky Stop, the four crash windows (before request write, after
request write before notify, after allow before consume, after consume before
result), or cold-start Inbox reconciliation. Those remain **BLOCKED / PARTIAL**.
