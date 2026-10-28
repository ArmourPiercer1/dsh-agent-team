# Main-agent ruling B-G4R-6 — G4-R phase 3: crash-survivor retry with the `--kill-after` knob (+2 starts, disclosed over-budget) — 2026-10-28

**What this rules.** Phase-3 leg 5 (crash survivor) consumed its authorized 2 starts and recorded an
honest supervisor `overall: FAIL` whose ONLY failing edge is a **harness orchestration race** (not the
product). This ruling authorizes **one crash-reclaim retry (+2 starts, a fresh pair) with
`--kill-after 6000`** on a **fresh budget ledger**, taking the G4-R chronological total from 10 to **12**
— over R1's envelope (6) by **6, disclosed** under B-G4R-5 §3. No other start is authorized; a second
crash FAIL of the same class STOPs the lane (B-G4R-5 §2).

**Issued by.** The main agent (takeover session 2), 2026-10-28, before the retry spawn, under the user
pre-authorization B-G4R-5 (ceiling 25, ENV/harness retry allowed, per-cell named ruling + independent
re-review + disclosure). **Authorization + disclosure, not a gate verdict; G4 remains
`G4-CORE-PASS / BRIDGE-BLOCKED`.**

## The defect this authorizes a retry for (harness class — grounded, not guessed)

- Attempt record: `.worktrees/u7-g4r3/dev/agent-workflow/evidence/u7-g4r3-20261028/crash/run-u5-crash-2026-10-28T19-09-04-633Z.json`,
  run `u5-crash-2026-10-28T19-09-04-633Z`, supervisor `overall: FAIL` (4 product cases PASS; only
  `other-world-unaffected` FAIL). Survivor suite `run-…-A.json` `overall: PASS` (7/7 case verdicts; note the cell mix includes designed negative controls — e.g. the :3080 401 guard — PASS here means correct behavior, not product action). Both bind
  `teamSha=5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3`. The failed records stand, unedited.
- RCA (`.artifacts/findings/crash-sequencing-rca-20261028.md`, read-only): the single failing edge is
  `u5-parallel-supervisor.mjs:92` `survivorHealthyAt < killAt`, violated by 1174 ms
  (`19:12:31.820` > `19:12:30.646`). The three red sequencing cells alias that one boolean (lines 103,
  104 identical; 86/106 share the cause); `:908` makes `sequencing.pass` a hard conjunct, so the case
  FAILs while its other three conjuncts are true.
- Why HARNESS not product: the survivor proved everything about the product green — `aOverall:PASS` 7/7,
  `survivorHostIdentityContinuous:true` (pid 225 + worldId unchanged), `reclaimVictimOnly:true`,
  `failedProbeInWindow:false`, `postReclaimProbeSucceeded:true`. Filing it as a product defect would be
  a false positive. Mechanism is structural: the kill fires on a fixed `sleep(killAfterMs=1500)` after
  `U5-IN-RUN` (printed at `u5-canary-runner.mjs:377` BEFORE the suite), but the probe loop producing
  `healthyAt` only starts at `:516` AFTER the suite — the assertion holds only if suite-to-hold < 1500 ms;
  this leg's core suite took ~2.7 s under boot contention.
- Deterministic knob, not fishing: `--kill-after` is a first-class supervisor flag (`:182`, default 1500
  at `:176`, consumed by the crash-reclaim path at `:710`). Setting 6000 puts `killAt` = IN-RUN+6000 ms,
  while `healthyAt` = IN-RUN+~2.7 s (suite duration), so a pre-kill probe provably exists with ~3.3 s
  margin instead of the coin-flip 1500 ms. This does not recolor any verdict or touch the product; it
  moves the kill deeper inside the victim's held window (`capMs 300000`, runner:853) so line 92 holds
  deterministically. RCA's recommended band is 4000–8000 (6000 chosen: above suite duration, deep inside
  the hold, far below the cap). `--kill-after` has NO parser-enforced upper bound (validation at
  :190-192 only checks mode/suite); 6000 is within the RCA band by argument, not by a range gate.
- Why NOT `--survivor-suite core-restart`: accepted by the parser (:192) but it inserts a stop/boot cycle
  (`u5-canary-runner.mjs:467-470`) that changes the survivor host pid, which would manufacture a
  DIFFERENT false red on `survivorHostIdentityContinuous` (supervisor:97-100). Keep `--survivor-suite core`.

## Preconditions for the retry (re-checked immediately before the spawn)

- `git rev-parse HEAD` == `5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3` in the booting worktree; runtime
  clone porcelain empty; sandbox pre-flight `partial`/`full`; `:3080` probed read-only before and after.
- **Fresh budget ledger** (the attempt-1 ledger `crash/host-starts.jsonl` is spent 2/2): the retry writes
  a NEW `crash/retry-host-starts.jsonl` with `--max-host-starts 2`; both starts declared before spawn.
- Attempt-1 records, logs, and the `.victimKilledAndReclaimed` marker are preserved (fresh run-id, so no
  overwrite); the failed record is never rewritten.

## Honestly disclosed residual (this retry does NOT fix the law)

The supervisor's `survivorHealthyAt < killAt` assertion is **structurally non-deterministic** (no
survivor hold/probe handshake gates `killAt`); phase-2 passed it by only 401 ms. The `--kill-after 6000`
retry yields a clean candidate-bound PASS for G4 completeness, but the harness assertion is still flaky.
The durable fix (hold-loop handshake + splitting the aliased sequencing cells) is a **`tests/world-factory/**`
harness-code remediation item**, filed as **R-CRASH-1** and scheduled **post-freeze** (test-code near the
judgement path must not change mid-lane), exactly like R-G4R-3. A PASS-by-knob is disclosed as
PASS-by-knob; it is not laundered into "the assertion is sound".

## Explicitly not ruled here

- Any product change; any change to the reclaim/lease/home-ownership/host-isolation code; any change to
  the supervisor/canary source (the knob is a runtime argument, zero source bytes changed).
- Any second retry: a same-class (harness-sequencing) FAIL on the retry is the SECOND consecutive
  same-class FAIL and STOPs the lane per B-G4R-5 §2 — report, do not re-spend.
- Any gate verdict: G4 promotion remains the R2 reviewers' call.
