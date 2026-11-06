# Crash window and post-restart reconciliation

Run: `a6-crash-r4`, kit probe committed as `6cf0b4e8d`, gated with the product at `a1868f878`, real
Host `:3698`, root `session-c1-smoke-a6-2026-11-05T20-30-08`.
Raw logs and durable extract: `dev/agent-workflow/evidence/a6-crash-r4/`.

## Window exercised

1. The Member bash ask produced the Guard leg, which was allowed; the Plane PA
   leg `ctrl-0gcoakn1epytgo0dujcf11sz` was recorded (`sequence 10`) and was
   still undecided.
2. The probe `SIGKILL`s the Host at that point: after the durable request write,
   before any PA decision / consumption / execution. `exited=true`.
3. The same `DSH_HOME` is restarted with `bootPhase: create-or-open`. The Host
   boots, the Team remote mounts, and the durable ledger still contains the
   PA request with no decision, no consumption, no workspace file.
4. A human `team.resolveControl` **allow** for that exact request is
   fail-closed: the durable decision is `deny`, `reason:
   'authority-undetermined'`, `decider.kind='human'`. The dead Member call is
   not executed and no `control-allow-consumed` fact is written.

`A6-13` (durable request recoverable, no execution across crash/restart) and
`A6-14` (post-restart allow fails closed, cannot execute) both PASS.

## Interpretation

The approval is **not lost silently**: the row survives, restart can read it,
and a decision is recorded. The recovery policy after cold restart is
fail-closed (`authority-undetermined`) rather than replaying the pre-crash
authority. That is safe for this window, but it is not a positive "approve
after crash and execute" path — the Member turn is gone, so there is nothing to
execute.

## Still not reached

- Sticky Stop.
- The three other crash windows (before request write; after allow before
  consumption; after consumption before result).
- Native Inbox/claim/release cold-start replay: the probe checks the durable
  Control ledger, not a native inbox claim record.

## After-allow, before-consumption window (run `a6-crash-allow-r1`)

Root `session-c1-smoke-a6-2026-11-05T20-48-55`, real Host `:3700`.

1. The Plane PA leg `ctrl-11r23rv0ixt0501omxgvp1k0` was recorded; the
   Officer's allow was recorded at decision sequence 11.
2. The probe killed the Host immediately when the allow appeared, before the
   PA wait consumed it: `consBefore=0`, no workspace file (`fileBefore=0`).
3. `create-or-open` restart succeeded; after restart `consAfter=0` and
   `fileAfter=0`. No second consumption and no execution was added.

`A6-15` PASS for the **no-duplicate** property. But this window is
**not recovered**: the durable allow has no corresponding
`control-allow-consumed`, and the dead Member call is never executed or
reconciled. The guard's consumption (the only one in the ledger) is unrelated.
So the crash is fail-safe against double execution but **loses an already
approved call**; there is no post-restart resume/replay path for it.

## After-consume, before-result window (run `a6-crash-consume-r2`)

Root `session-c1-smoke-a6-2026-11-05T21-10-25`, real Host `:3704`.

1. The Plane PA leg was allowed and its `control-allow-consumed` fact appeared:
   `consBefore=1`.
2. The probe killed the Host at that point, before the bash result/side effect
   was written: `fileBefore=0`.
3. `create-or-open` restart succeeded. After restart: `consAfter=1`, still no
   file. No second consumption and no execution was added.

`A6-16` PASS for the **no-duplicate** property. The complementary property is
**not** met: the allow was consumed but the command was never executed, and
nothing reconciles or replays it. The post-restart ledger therefore contains an
allow that has been spent without its tool result — an at-most-once, not
at-least-once, recovery.

## Before the PA request write (run `a6-crash-before-r1`)

Root `session-c1-smoke-a6-2026-11-05T21-21-30`, real Host `:3706`.

1. The probe watched for the first `admission-requires-approval` line (the
   Guard leg's admission) and killed the Host immediately, before the Plane PA
   leg was recorded: `exited=true`, no PA request existed yet.
2. `create-or-open` restart succeeded.
3. After restart the ledger had one request (the Guard leg), one decision and
   one consumption; **no PA request**, no workspace file, no execution.

`A6-17` PASS: the crash leaves no phantom PA request and no consumption without
a request. The Guard leg that was already written remains settled normally.
This is the "before write" window for the Plane PA leg, not a claim about a
crash before the Guard request.


## Native Inbox wake reconcile — `a6-inbox-r5` (A6-25)

Real Host, exact evidence head `fa87927fd`. The Officer wake turn was held open
(30 s mock think time) after the native Inbox had CLAIMED the wake; the Host was
SIGKILLed. On restart:

- the durable intent row was still `accepted`; the native message was gone
  (consumed by the crashed turn);
- boot recovery discarded the stale row (`wake-*.json` 1 -> 0) and did not
  duplicate the wake (1 -> 1 model wake request);
- the durable Control request remained pending (`pendingAfter=1`), so no work
  was lost even though the advisory wake was not re-issued;
- a boot-time replacement wake is allowed by the protocol but was not required
  by this assertion.

**Not covered:** a crash in the narrower window where the Inbox ACCEPTED but
never CLAIMED the message, and native cold-start replay of that message.
