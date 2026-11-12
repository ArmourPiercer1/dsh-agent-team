# PD-39 Gap 2 — the Inbox `ACCEPTED`-but-not-`CLAIMED` crash window (re-measurement, 2026-11-12)

**Lane:** `task/pd39-inbox-window-20261112`, worktree `.worktrees/pd39-inbox-window`, base
`84baf304c4c7d721d41312a4d240092e033fbfd6` (`origin/master`, `A1-BASH-GOVERNANCE … (#739)`).
**Host:** pinned DSH `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`, pristine test-use clone,
separate `DSH_HOME` per run under `tests/homes/` (same home per run across its two boots).
**Owner ruling obeyed:** no automatic redelivery / replay. The typed fact is kept; the promise is
narrowed; an operator runbook is required. `CORE PATCH BUDGET = 0`.
**Evidence class:** **DEV-LIVE** — an engineering record, not an acceptance grade. **No `V@B`, never
`CANDIDATE-C2`.** `:3080` untouched; no push.

---

## 1. What was run

The kit's `C1_A6_INBOX_UNCLAIMED=1` arm (the native Inbox accepted a review wake, a busy Officer turn
was SIGKILLed before any claim, then the same `DSH_HOME` was restarted):

- **run-1** — 2026-11-12T15:27:14, host `3187`, mock `3492`, `C1_A6_BUSY_HOLD_MS=15000`;
- **run-2** — 2026-11-12T15:29:15, host `3188`, mock `3493`, same construction, fresh `DSH_HOME`;
- **run-3** (supporting, different trigger) — 2026-11-12T15:31:18, host `3189`, mock `3494`,
  `C1_A6_CRASH=allow`: allow recorded, crash before consumption, restart.

Each run boots the **real Host** (not a host-free replica) and reads the durable store directly
(`tests/homes/c1-smoke-<stamp>/storages/team_domain.json`, `alpha6-wake-intents/`), then compares the
observations field by field. Comparator: [`compare-two-runs.mjs`](./compare-two-runs.mjs); its output is
[`two-run-agreement.txt`](./two-run-agreement.txt).

The kit change that made this measurable (additive, default-off, in
`tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs`): `C1_A6_BUSY_HOLD_MS` holds the
mock's second call so the Officer's busy turn survives long enough to accept the wake; and the
"pending at restart" set is now captured **before** the operator recovery writes its allow (the old
code recomputed it after that decision, so a pending-and-resolvable request could never satisfy the
acceptable branch — that was an instrumentation bug, not a product result).

## 2. Two-run result — field-by-field AGREE

```
window                             "ACCEPTED-not-CLAIMED"   "ACCEPTED-not-CLAIMED"   AGREE
busySeen                           true                     true                     AGREE
wakeIntentRowsBefore               1                        1                        AGREE
wakeIntentRowsAfterRestart         0                        0                        AGREE
wakeIntentRowsAfterDrain           0                        0                        AGREE
wakeTurnsBeforeKill                0                        0                        AGREE
claimedWakeTurnsAfterRestart       0                        0                        AGREE
duplicateClaims                    0                        0                        AGREE
pendingBefore                      1                        1                        AGREE
pendingAtRestart                   1                        1                        AGREE
requestRecorded                    1                        1                        AGREE
decisions                          1                        1                        AGREE
abandonments                       0                        0                        AGREE
consumptions                       0                        0                        AGREE
executionResults                   0                        0                        AGREE
pendingControlCount                1                        1                        AGREE
requestFactVisible                 true                     true                     AGREE
requestIdOccurrences               1                        1                        AGREE
wakeIntentRowsAfterTeardown        0                        0                        AGREE
recoveryStatus                     200                      200                      AGREE
recoveryDecision                   "allow"                  "allow"                  AGREE
recoveryDeciderKind                "human"                  "human"                  AGREE
recoveryRequestIdMatches           true                     true                     AGREE
verdict                            "stranded-discoverable"  "stranded-discoverable"  AGREE
acceptable                         true                     true                     AGREE
```

`decisions: 1` and the `200/allow/human` recovery are **the operator recovery the run performs**, not
a pre-crash decision: both runs record zero decisions and zero abandonments at restart (see §3).

## 3. Exact durable rows

### run-1 — the window: pending, discoverable, decidable

`tests/homes/c1-smoke-2026-11-12T15-27-14/storages/team_domain.json`:

```text
seq 7   control-request-recorded   ctrl-154qf5f1dlcvt00vmsenl0bp
        kind=leader-approval  actionName=parameter-permission  toolName=bash
        requestedEffect=allow  correlation=call-c1-9lheq5ab
        approvalCaseId=case-07kwp0h0la6z220c1tiev046
seq 8   control-decision-recorded  ctrl-154qf5f1dlcvt00vmsenl0bp  decision=allow
        decider={kind:human, humanId:session-c1-smoke-a6-2026-11-12T15-27-14}
        (written by the operator `team.resolveControl` recovery — origin team-remote)
no      control-request-abandoned
no      control-allow-consumed
no      control-execution-result
```

Wake intent: `rows=1->0->0`, wake turns `0->0->0`, claimed after restart `0`, duplicates `0`.
At restart: `pendingControlCount: 1`, `requestFactVisible: true`, `requestIdOccurrences: 1`.

### run-2 — identical shape, different ids

`tests/homes/c1-smoke-2026-11-12T15-29-15/storages/team_domain.json`:

```text
seq 7   control-request-recorded   ctrl-0urz8vx138g6hy14jzkbf1er
        actionName=parameter-permission  toolName=bash  allow  correlation=call-c1-1fh6kiyh
seq 8   control-decision-recorded  ctrl-0urz8vx138g6hy14jzkbf1er  allow  decider=human
        (operator recovery)
no abandonment, no consumption, no execution result
```

### run-3 — the terminal abandonment trigger (not the accepted-not-claimed window)

`tests/homes/c1-smoke-2026-11-12T15-31-18/` via `a6-crash.json`:

```text
seq 10  control-request-recorded   ctrl-1yitkxs062hys305s2uga0a9  team-tool-execute  pa:<…>
seq 11  control-decision-recorded  ctrl-1yitkxs062hys305s2uga0a9  allow  decider=instance(member)
        (kill before consumption)
seq 14  control-request-abandoned  ctrl-1yitkxs062hys305s2uga0a9  reason=invocation-abandoned
        consumptions=0  executionResults=0  revived=false
```

`A6-15 PASS`: crash after the PA allow but before consumption leaves the allow intact, abandons the dead
invocation, executes nothing.

## 4. What this means (fixed vs disclosed)

- **Fixed / no longer reproduces:** the accepted-not-claimed window no longer ends in a terminal
  abandonment. On this tree the undecided request **survives the restart pending**, is listed/counted
  (`pendingControlCount: 1`), readable by id, and **decidable** by `team.resolveControl` (measured,
  twice). That is the audit's acceptable outcome (ii). The 0.1.6 abandonment came from the resolve-time
  `PA_MANIFEST_CORRUPT` classification on a row whose `reviewPayloadDigest === operationFingerprint`;
  current `parameter-permission` rows carry no `reviewPayloadDigest`, so the allow is recorded.
- **Still true, disclosed:** the wake is **not redelivered** (owner ruling). A *decided* invocation
  that died before consumption is **terminally abandoned** at boot settlement
  (`invocation-abandoned`), and an abandoned request stays terminal (`CONTROL_REQUEST_ABANDONED`).
  The operator path is re-issue, never re-resolve.
- **P2 resolved as naming, not a count bug:** `pendingControlCount` is live-undecided only; an
  abandoned request is excluded by design while remaining readable by id. The
  `team_list_pending_control` description now states this and names the ledger lookup + re-issue path.
- **Promise narrowed:** "every accepted review wake is delivered or decidable" is recorded as **false
  today**; the true statement is **delivered, decidable, or terminally abandoned with a typed fact and
  an operator-visible re-issue path**.

## 5. Gates / verification performed

- `npx tsc -p packages/tools/tsconfig.json` — exit 0;
- `npx tsc -p packages/tools/tsconfig.build.json` — exit 0 (no tracked `dist` in this package);
- `npx vitest run packages/tools/test/c1-list-pending-control.test.ts` — **16/16 passed** (case 11
  added: an abandoned request is not listed, the description names the terminal exclusion + ledger
  lookup + re-issue);
- two real-Host runs of the same scenario, fresh `DSH_HOME` each, compared field by field
  (`compare-two-runs.mjs`, exit 0); one supporting real-Host run of the terminal trigger;
- existing host-free pins cited: `packages/runtime/test/remote-control-abandoned-code.test.ts`
  (`CONTROL_REQUEST_ABANDONED` typed) and `packages/runtime/test/a4p3-intervention-projection.test.ts`
  (`pendingControlCount` excludes an abandoned request).

## 6. Deliberate omissions

- No automatic redelivery/replay (owner ruling); no product-code change to the abandonment path.
- No `V@B`, no matrix grade, no acceptance claim; this is DEV-LIVE engineering evidence.
- `run-0-racy-construction/` in this directory is a superseded first attempt (the busy turn ended
  before the ask because the Officer's `bash sleep` was denied); it is kept only to show why the
  deterministic construction was needed, and is **not** part of the two-run agreement.
- Ports `3491`/`3186` were avoided (a stale out-of-namespace listener held `3491`); the runs used
  `3187/3492`, `3188/3493`, `3189/3494`.
