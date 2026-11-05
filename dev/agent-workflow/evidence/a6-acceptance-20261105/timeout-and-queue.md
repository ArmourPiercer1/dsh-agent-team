# Timeout, queue/claim/release and crash-window status (exact HEAD 8114db4b7)

This file records what is **not** reachable yet, so the acceptance matrix does not
silently promote a unit test or a synthetic timer to product evidence.

## Wait timeout is not reachable in the production A6 path

`PaControlBridgeDeps.waitTimeoutMs` exists and, when supplied, aborts the wait
(`packages/runtime/operation-permission/pa-control-bridge.ts:539`). A repository-wide
search of non-test, non-dist sources finds **only** those three references: the field,
its validation, and the timer. No production caller (root/plugin/PA wiring) supplies
it. The A6 bridge therefore waits without a client timer, matching the design rule
"no timer"; there is no product timeout to inject and no E2E timer to misread.

Consequence: row 14 timeout non-revival is **NOT_REACHED**, not PASS. Making a
synthetic `waitTimeoutMs` visible in a unit test would not prove the product path.

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
