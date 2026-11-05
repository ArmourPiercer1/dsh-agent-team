# Crash window and post-restart reconciliation

Run: `a6-crash-r4`, kit probe committed as `6cf0b4e8d`, gated with the product at `60b1dd700`, real
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
