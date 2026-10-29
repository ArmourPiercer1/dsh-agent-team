# crash-sequencing RCA — `other-world-unaffected` / `sequencing.pass=false`

Date: 2026-10-28 · Analyst: read-only RCA subagent · READ-ONLY (no file under `.worktrees/u7-g4r3` modified)
Subject run: `.worktrees/u7-g4r3/dev/agent-workflow/evidence/u7-g4r3-20261028/crash/run-u5-crash-2026-10-28T19-09-04-633Z.json`
Flags: `--mode crash-reclaim --survivor-suite core --max-host-starts 2 --budget-ledger …/crash/host-starts.jsonl`

## VERDICT: (a) HARNESS TIMING/SEQUENCING DEFECT — orchestration race, not a product defect

The single failing edge is `survivorHealthyAt (19:12:31.820) < killAt (19:12:30.646)` — violated by **1174 ms**.
`killInsideSurvivorWindow`, `survivorHeldUntilReclaim` and `preKillProbeSucceeded` are all downstream of that one
edge (the first two are literally the same boolean). The cause is structural: the supervisor fires the kill on a
**fixed 1500 ms sleep after the survivor's `U5-IN-RUN`**, but `U5-IN-RUN` is printed at the **start** of the
survivor's suite while the probe loop that produces `healthyAt` only starts at the **end** of that suite. Whether a
pre-kill probe exists is therefore a race against suite duration. Everything the survivor could prove about the
PRODUCT is green (7/7 suite PASS, host pid 225 continuous, world id continuous, reclaim victim-only, zero failed
probes, after-reclaim probe 200/contentMatch).

Not (b): reclaim touched nothing outside the victim (`reclaimVictimOnly:true`, `survivorHostIdentityContinuous:true`).
Partial (c) sub-finding: two of the three red cells alias one predicate, so the law over-declares independence — see
§Fix class. Phase-2 ran the **same flags** and got the opposite edge → the assertion is non-deterministic, which is
the signature of orchestration luck, not of a product regression.

## Failing code (quoted, `tests/world-factory/u5-parallel-supervisor.mjs`)

`evaluateSurvivorSequencing`, the only edge that can fail here:

```js
86:  const preKillSuccess = successful.some((probe) => Number(probe.at) < killAt)      // → false
91:  const ordered = timestamps.every(Number.isFinite)
92:    && survivorHealthyAt < killAt            // ← THE FAILING LINE (751820 > 750646)
93:    && killAt < survivorLastProbeAt          // 750646 < 752457  OK
94:    && survivorLastProbeAt <= survivorTornDownAt  // 752457 <= 753391 OK
...
103:    killInsideSurvivorWindow: ordered,      // ← same boolean as line 104
104:    survivorHeldUntilReclaim: ordered,      // ← same boolean as line 103
106:    preKillProbeSucceeded: preKillSuccess,  // ← same root cause as line 92
112:    pass: ordered && preKillSuccess && postReclaimSuccess && failedInWindow.length === 0
         && reclaimTouchedOnlyVictim && identityContinuous,   // → false
```

Gate that colours the case (line 908) — `sequencing.pass` is a hard conjunct, so the whole case FAILs although the
other three conjuncts are true:

```js
908:  record.addCase('other-world-unaffected', aExit.timeout !== true && aAliveAtReclaim === true
       && aRecord?.overall === 'PASS' && sequencing.pass ? 'PASS' : 'FAIL', {
```

The race, at the two producer sites:

```js
// u5-parallel-supervisor.mjs (crash-reclaim path)
694:  const aInRun = await waitForLine(A.buffer, /^U5-IN-RUN (\S+) (\S+) (\d+)$/m, 300_000)
710:  await sleep(killAfterMs) // "a beat inside the held window, not at its boundary"   ← fixed 1500 ms
714:  const groupKill = { at: new Date().toISOString(), ... }                            // killAt

// u5-canary-runner.mjs — healthyAt is produced at the END of the suite, not at IN-RUN
377:  console.log(`U5-IN-RUN ${world.id} ${world.home} ${...pid}`)   // printed BEFORE the suite cases
516:  if (holdUntil !== null) {
517:    const hold = await holdSurvivor({ world, origin, holdUntil, probeLog, oracle })  // probe loop starts HERE
325:    if (row.ok && healthy.at === null) healthy.at = row.at        // healthyAt = first ok probe
853:    queue.push({ mode: 'gate', tag, gateFile: ..., capMs: 300_000 })  // victim held ~5 min
```

So `killAt = U5-IN-RUN + 1500 ms`, while `healthyAt = U5-IN-RUN + (duration of token-gate … oracle-blinding-divergence)`.
The assertion holds only when the suite-to-hold-loop leg is **shorter** than `killAfterMs`. Here that leg took ~2.7 s
(boot/IO contention) → 1174 ms overshoot. Probe-count is the smoking gun: **3 probe rows here vs 9–10 in the phase-2
PASS** — the hold loop got almost no runway because the kill preceded its start.

## Timeline (UTC; record + `.survivor-probes.jsonl` + `.victimKilledAndReclaimed` + `host-starts.jsonl`)

| t | source | event |
| --- | --- | --- |
| 19:09:04.792 | record `startedAt` | supervisor starts |
| 19:09:58.382 | `host-starts.jsonl` | victim `u5cbv-…19-09-05Z` boot1 (start #1) |
| ~19:10:4x | — | victim prints `U5-IN-FLIGHT crashfly-xyu47h`, gate holds (capMs 300 s) |
| 19:10:46.170 / .322 | A oracle / A record | survivor `u5ca-…19-10-46Z` spawned (start #2) |
| 19:11:36.081 | `host-starts.jsonl` | survivor host boot1 |
| **~19:12:29.1** | inferred = killAt − 1500 ms | survivor prints `U5-IN-RUN` (hostPid 225) |
| **19:12:30.646** | `killAt` | SIGKILL to victim's OWN process group |
| **19:12:31.820** | probe #1 `health-effect` ok | `survivorHealthyAt` — **1174 ms AFTER the kill** ← failing edge |
| 19:12:32.141 | probe #2 ok | still healthy (250 ms loop) |
| 19:12:32.374 | `victimKilledAndReclaimed` | reclaim complete, marker written (`victimWorld=u5cbv-…`) |
| 19:12:32.457 | probe #3 `after-reclaim` ok 200 | `contentMatch:true` → survivor live across reclaim |
| 19:12:32.458 | A `survivorHold.releasedAt` | hold released |
| 19:12:33.391 | A `finishedAt` = `survivorTornDownAt` | survivor torn down normally |
| 19:12:35.628 | record `finishedAt` | supervisor finalizes, overall FAIL |

Product-side cells all TRUE: `aAliveWhileBCrashedAndReclaimed:true`, `aOverall:PASS` (token-gate, positive-control,
error-return-with-effect, planted-defect-detected, oracle-blinding-divergence, leak-check,
stable-instance-unchanged = 7/7), `survivorHostIdentityContinuous:true` (pid 225 + worldId unchanged),
`reclaimVictimOnly:true`, `failedProbeInWindow:false`, `postReclaimProbeSucceeded:true`.
Budget respected: exactly 2 host starts = `--max-host-starts 2`.

## What phase-2 evidence shows (`dev/agent-workflow/evidence/u7-g4t-20261027/`)

`live/crash-reclaim-1/run-u5-crash-2026-10-28T05-53-32-928Z.json` — `overall=PASS`, `other-world-unaffected=PASS`,
**same flags**: its README (line 27) records "exactly two Host starts (victim + survivor), with
`--mode crash-reclaim --survivor-suite core --max-host-starts 2`" — no different survivor-suite, no timing flag.

| cell | phase-2 PASS (05-53-32) | phase-2 (04-32-11) | this FAIL |
| --- | --- | --- | --- |
| healthy vs kill | **−401 ms (before)** | −371 ms (before) | **+1174 ms (after)** |
| probes recorded | 9 | 10 | **3** |
| kill → reclaim | +1569 ms | +1579 ms | +1728 ms |
| kill → lastProbe | +1723 ms | +1723 ms | +1811 ms |
| `killInsideSurvivorWindow` | true | true | **false** |
| `preKillProbeSucceeded` | true | (cell absent) | **false** |

Identical flags, opposite edge on line 92 → **the assertion is timing-luck-dependent**. Its margin in phase-2 was only
401 ms; this run overshot by 1174 ms. The phase-2 README already disclosed the mechanism in prose (line 7): the
forward fix "guarantees only that the survivor started and signaled mid-run before the kill wait. It does **NOT** hold
the survivor alive across `killAfterMs` plus reclaim delay … the core suite is too fast to guarantee overlap without an
explicit survivor hold/probe handshake." (An older FAIL exists too: `live-retry/run-u5-crash-…03-47-06-664Z.json`,
0 probes, all cells null — fail-closed before survivor proof.)

## Legit no-code knobs (parser quoted, `u5-parallel-supervisor.mjs:176-192`)

```js
176:  const out = { …, maxHostStarts: 15, killAfterMs: 1_500, reconstruct: null, mode: 'parallel',
                   survivorSuite: null, inflightTimeoutMs: 300_000, dryRun: false }
182:    else if (a === '--kill-after') out.killAfterMs = Number(argv[++i])
183:    else if (a === '--inflight-timeout') out.inflightTimeoutMs = Number(argv[++i])
185:    else if (a === '--survivor-suite') out.survivorSuite = String(argv[++i])
192:  if (out.survivorSuite !== null && !['core', 'core-restart'].includes(out.survivorSuite))
       throw new Error(`unknown --survivor-suite ${out.survivorSuite}`)
```

- **`--kill-after` is the honest knob: YES, retry with `--kill-after 4000`–`8000`.** It moves the beat deeper into the
  held window (victim gate `capMs = 300_000`, runner:853) so a pre-kill probe provably exists before the kill. This
  does not weaken the claim: the assertion is "kill strictly inside the survivor's healthy→last-probe window", and it
  still kills the same owned process group mid-tool with the in-flight trio intact. It is a **retry with more
  orchestration margin**, not a recolouring — record the flag and the resulting margin.
- **`--survivor-suite core-restart`: NO — wrong knob.** It inserts a stop/boot cycle on the same World
  (runner:467-470 `await rc.stopChild()`), which changes the survivor host pid and would break
  `survivorHostIdentityContinuous` (supervisor:97-100) — it manufactures a *different* false red. Keep `core`.
- `--inflight-timeout` / `--max-host-starts` are irrelevant to line 92. A retry costs **2 more host starts**, so it
  needs a fresh ledger path (or a raised cap) rather than reusing this one.
- `--dry-run` only exercises the injected-stub dry path (`runSurvivorDryRun`, supervisor:120-170) — simulated rows are
  explicitly rejected as live evidence (`assertLiveDigest`, supervisor:211-214); it cannot settle this.

## Honest fix class: HARNESS-TIMING (orchestration), with a declaration-hygiene sub-item. NOT product, NOT env.

1. **Primary (harness-timing, durable fix):** replace the fixed `sleep(killAfterMs)` gate with a **handshake on the
   survivor's hold-loop entry** — the survivor should emit e.g. `U5-HELD <worldId> <home> <pid> <healthyAt>` (or the
   supervisor should wait until `probeLog` contains its first `ok:true` row for `aWorld`) *before* computing
   `killAt`; demote `killAfterMs` to a floor/beat rather than the sole trigger. Then line 92 holds by construction
   instead of by luck. This is exactly the "explicit survivor hold/probe handshake" the phase-2 README:7 already
   named as the remaining gap.
2. **Declaration hygiene (same file, harness):** `killInsideSurvivorWindow` and `survivorHeldUntilReclaim` are the
   identical boolean `ordered` (lines 103-104), and `preKillProbeSucceeded` shares its root cause. Three red cells out
   of one edge overstate the evidence; split them (e.g. `survivorHeldUntilReclaim` should test
   `killAt < victimKilledAndReclaimedAt < survivorTornDownAt` + a probe at/after the reclaim marker, which the data
   already supports: 19:12:30.646 < 19:12:32.374 < 19:12:33.391 with probe #3 at 19:12:32.457).
3. **Not a product fix:** no reclaim, lease, home-ownership or host-isolation change is warranted — the product cells
   are all green with real-IO digests. Filing this as a product defect would be a false positive.
4. **Not env:** host boot latency only *shifted the race*; it did not create a new failure mode. Same flags, different
   host speed → different verdict is itself the defect.

**Bottom line:** honest retry path = same command **plus** `--kill-after 6000` on a fresh budget ledger (2 host starts),
expected to satisfy line 92 with a multi-second margin; the durable fix is a hold-loop handshake in the supervisor
(harness test code), not a product change.
