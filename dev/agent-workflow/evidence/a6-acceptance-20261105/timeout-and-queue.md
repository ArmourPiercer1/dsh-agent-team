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

Queued wake after a transfer (the `a6-recipients-r22` gap) is **closed and
re-proven** on the current line:

- `a6-recipients-r22` was the pre-fix trace: the Officer handoff row existed but
  the successor was never woken, so PA `ctrl-1gcrjbd0vlh1060aqietb1e8` stayed
  pending and the mock saw no new model turn.
- The production fix is the transfer-event consumer (`fd7a5d6c1`): a durable
  `control-current-leg-transferred` re-reads control state and dispatches the
  successor wake through the same Router/Coordinator/Inbox path.
- `a6-handoff-r7` on this line: transfer `case-11ums140z0c3xf0fcpbwm0kj` →
  successor wake → Leader allow → exactly one consumption → execution
  (`A6-8` PASS). No duplicate message was injected; the Inbox message is the
  only delivery record.

Now covered: Sticky Stop (`a6-sticky-stop-r3`), bounded timeout
(`a6-timeout-r4`), all four crash windows (`crash-and-inbox.md`). Cold-start
native-Inbox replay is still not positively exercised.
