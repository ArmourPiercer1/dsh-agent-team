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




## Accepted reconcile — `a6-inbox-r9` (A6-25, code HEAD `fb6ccb4f4`)

The wake turn was held open after the native Inbox CLAIMED the wake; the Host
was SIGKILLed. On restart the row was `accepted` and the native message was
gone. Owner-scoped recovery (the intent row carries its mount root) cleared the stale row
inside the latch lock and did **not** rebuild it: `wake-*.json` 1 -> 0, wake
model requests 1 -> 1 (no duplicate), and the durable pending Control request
that existed before the crash was still pending after (`pendingBefore=1`,
same requestId). A `queued` row (never accepted) is still rebuilt.

**Preconditions disclosed:** marker recovery is still strict own-root (the
marker reader drops the owner field); owner identity across restart relies on
the boot reusing the same root session (`create-or-open` in the kit), and the
Host run logs do not embed a product SHA — the A6-25 rows 1→0 outcome is what
pins the accepted branch.

---

# 2026-11-06 closing round — non-authorizing settlement (code `28b61d4b2`)

The earlier fail-closed/deny rewrite is superseded. A persisted approval decision
is now **immutable**: a dead invocation is closed by an additive
`control-request-abandoned` fact with a lifecycle reason, never by rewriting an
Allow to a Deny. `execution-outcome-unknown` and `invocation-abandoned` are
execution-lifecycle results, not approval decisions. Abandoned requests remain
in the durable audit ledger and are excluded from actionable pending.

Every run below has `run-manifest.json` binding the exact product commit, Host
version (`0.2.0-rc.2` @ `639ed01539`), blueprint content hash, opt-in state and
runId.

## Bounded A6 wait — `a6-timeout-r9`

Root `session-c1-smoke-a6-2026-11-07T10-15-29`, blueprint
`sha256:e9fe250a…`, `alpha6WaitTimeoutMs=8000`.

- `A6-19` PASS: the wait expired with no decision, no consumption, no execution.
  The durable request remains; its derived state is `abandoned`.
- `A6-20` PASS: the late human allow is refused (decision `undefined`,
  abandonment reason `invocation-abandoned`, zero consumption, zero execution).
  The human's approval is not turned into a Deny.

## Crash after allow, before consumption — `a6-crash-allow-r4`

Root `session-c1-smoke-a6-2026-11-07T10-20-53`, blueprint `sha256:3306f85b…`.

- `A6-15` PASS: after restart the durable decision is still `allow`,
  `consBefore=consAfter=0`, no workspace file, and boot settlement adds
  `control-request-abandoned reason=invocation-abandoned`. The dead call is not
  replayed; the approved invocation is closed, not silently left actionable.

## Crash after consumption, body not started — `a6-crash-consume-r8`

Root `session-c1-smoke-a6-2026-11-07T10-24-59`, blueprint `sha256:5c3b52cc…`.

- `A6-16` PASS: `consBefore=consAfter=1`, no body-start marker, no workspace
  file (zero execution), and boot settlement records
  `control-request-abandoned reason=execution-outcome-unknown`. The spent allow
  is NOT replayed and the decision remains `allow`.

## Request written, no decision — `a6-crash-request-r6` (A6-13/A6-14 PASS)

Root `session-c1-smoke-a6-2026-11-07T11-34-22`, blueprint
`sha256:837cc967…`.

The Host is killed after the PA request fact is durable but before any
decision. After restart the row is still pending (audit), no execution occurs,
and a late human ALLOW cannot revive the dead call.

Closing-round fix (constraint 1): in the A6 composition an ALLOW whose PA
authority is `undetermined` / corrupt is a **lifecycle** failure. The service
writes `control-request-abandoned reason=invocation-abandoned` and refuses,
instead of persisting `deny reason=authority-undetermined`. The run records
`decision=null`, `abandon=invocation-abandoned`, consumption 0, workspace output
absent. Non-A6 compositions keep the historical durable-DENY path
(`a6AbandonUndeterminedAllow` defaults to false).

## Body started, result not durable — `a6-crash-body-r5` (PASS)

Root `session-c1-smoke-a6-2026-11-07T11-03-42`, blueprint `sha256:bc17d71a…`.

The delaying command is classified into the A5 `parameter-permission` lane in
this fixture, so `C1_A6_CRASH=body` approves that lane through the same remote
human entry (a crash-window probe, not an approval-path claim). That allows the
Plane PA `team-tool-execute` leg to exist. The probe kills the Host only after
(a) the PA allow is consumed and (b) the durable body-start marker exists:

- `bodyStart=true`, `consBefore=consAfter=1`, final workspace output absent;
- after restart the decision is still `allow` and settlement adds
  `control-request-abandoned reason=execution-outcome-unknown`;
- the body is not replayed and no second consumption appears.

`A6-16b` PASS. Together with `a6-crash-consume-r8` (body not started, zero
execution) this closes the after-consume split.

## Claimed Inbox wake crash## Claimed Inbox wake crash — `a6-inbox-r17` (A6-25) — PASS

Root `session-c1-smoke-a6-2026-11-07T11-14-15`, blueprint `sha256:5f5f073e…`,
`C1_A6_INBOX=1`.

The wake turn was held open after the native Inbox CLAIMED the wake, then the
Host was SIGKILLed. The trace distinguishes a fresh delivery from a resumed
turn by the request's message count:

- before crash: one wake turn start at request index 11, `messageCount=1`
  (the wake text is the only message);
- after restart: a SECOND fresh start at index 12, `messageCount=1`, followed
  by continuations at index 13 (`messageCount=3`) and index 14
  (`messageCount=5`) — i.e. exactly one NEW wake turn, not a native resume of
  the crashed turn (a resume would have appeared as `messageCount > 1` at its
  first post-restart request);
- the old request is not redelivered; stale intent rows go `1 -> 1 -> 0`;
- the replacement wake decides the durable pending request (`pendingBefore=1`,
  `pending=0` at drain).

`A6-25` PASS, with `wakes=1 -> 2 -> 2` counting wake TURN STARTS (wake text +
`messageCount === 1`), not raw requests or distinct wakeIds.

## Sticky Stop marker owner readback## Sticky Stop marker owner readback## Sticky Stop marker owner readback — unit proof

`readStopped` / `listStopped` now surface `ownerRootSessionId`, and
`a6-wake-intent-store.test.ts` adds a cross-root isolation test: a marker owned
by root A reads back with owner A, is not selectable by owner B, and clearing it
reopens only that key. Sticky Stop behavior itself is unchanged (P2 fix only).
