WP3-FENCE-TIMING

# WP3 (P1) — making the Stop/consumption race reach the cancellation fence, and what happens there

**Record class: `CANDIDATE-C2`.** Every run below was booted from
`candidate/v0.1.6-2` @ **`bb3c158eb1f76f8db429da01e9a4c5a0e118ca90`** and every
`run-manifest.json` in this tree names that SHA (`productSha`) and the
worktree path (`productTree`, `.worktrees/wp3-fence`). Host pin
`tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`
(DSH 0.2.0-rc.2), **CORE PATCH BUDGET = 0**: no product file, no upstream file
and no `dist` artifact was changed by this lane. The only product-adjacent tree
touched is `tests/**`; see §9.

| field | value |
| --- | --- |
| candidate | `cand-v0.1.6-2` / `bb3c158eb1f76f8db429da01e9a4c5a0e118ca90` |
| branch / worktree | `task/wp3-fence-20261111` / `.worktrees/wp3-fence` |
| instrument | `tests/kits/wp3-fence-timing/wp3-fence-timing.mjs` (driver) + `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs` (env-gated timing control) |
| boots in this note | **29** independent boots (fresh `DSH_HOME` each, separate kit process, ports `1700x`/`1705x`), of which **11 reached the fence** |
| host artifacts | tracked `packages/runtime/dist` at the candidate; no rebuild; no product edit |

## 0. Lead result

1. **The fence is now a controlled event, not luck.** By anchoring the Stop to
   a durable fact the *service* wrote (the human-leg request row) and steering
   on the product's own documented wait-poll cadence, the A6-12 arm reached the
   cancellation fence **11 times in 29 boots** (the other 18 split: **3
   pre-fence**, **15 consumption written** — both controls present, so the 11
   trips are not a uniform "the Stop always wins"), including **3/3 at one
   chosen offset** (`stop = request-row + 345 ms`): allow seq 14, no consumption,
   exactly one `control-request-abandoned` at seq 16 with reason
   `invocation-cancelled-before-consumption`, seq 15 burned, late re-allow
   refused `CONTROL_REQUEST_ABANDONED`, zero effect file, zero execution fact.
2. **The residual window was NOT hit.** No run produced a Stop that was issued
   *strictly before* the durable consumption write and still let the write
   commit. The instrument's resolution at the boundary is **≈±25–30 ms**
   (boundary jitter, not the fence), which is ~50–100× the disclosed
   **≈0.3–0.6 ms** write window. An unhit window is a disclosure here, not a
   failure — and it is *not* evidence that the window is unreachable.
3. **The instrument's limit is the finding.** The fence-reached band is wide
   (≥50 ms of usable stop offsets) but the *boundary* between "fence" and
   "consumption" moves by tens of milliseconds between boots because two
   uncontrolled latencies (the waiter's poll phase relative to the request row,
   and the `session/cancel` propagation) dominate the write window by two
   orders of magnitude. No product change was needed — and none was made.

## 1. Why the old arm could not demonstrate the fence

`c2-adjudication-2` §4 ran the A6-12 Stop arm 11 times on this candidate:
0 consumptions, 0 side effects, but **1/11** reached the new fence. The other
ten cancelled the invocation **before the guard reached the consumption
boundary**, so they passed through the older pre-fence path
(`awaitControlDecision` rejects; the durable `allow` stays unspent and
re-resolving it is refused `CONTROL_REQUEST_DECIDED`, no terminal mark).

The old arm did what it was written to do: resolve the human `allow` and then
send `session/cancel` as fast as it could (`apiCancel` immediately after
`team.resolveControl` returns). Whether that Stop landed before the waiter had
observed the decision — or after the guard had already consumed the allow — was
a race between two independent latencies. The 0/11 therefore said almost
nothing about the fence.

## 2. How the timing is controlled (and why it is legitimate)

### 2.1 The seam that already exists on a real Host

The guarded invocation parks in `ControlService.awaitControlDecision`
(`packages/runtime/control/service.ts`), which polls the **durable** control
state at `DEFAULT_WAIT_POLL_INTERVAL_MS = 250` ms, with the **first poll
synchronous at wait start**, and the wait starts immediately after the request
row is durably written. So on a real Host the guard's post-decision run begins
on a **250 ms grid anchored at the durable request row's `createdAt`** — an
await point *after* the allow decision and *before* the consumption write, with
a documented period.

That is the production-equivalent seam: the poll timer is a real await point in
the guard's path, its cadence is a documented product constant, and the anchor
is a durable fact the service wrote. Nothing had to be added to product code.

### 2.2 What the instrument does

`C1_A6_STOP_TIMING_MS='{"resolve":R,"stop":S}'` (new, env-gated, default
behaviour byte-identical) makes the A6-12 arm:

* poll the durable ledger every **2 ms** to discover the human leg (discovery
  latency can therefore never shift the schedule — the schedule is computed
  from the row's own `createdAt`);
* issue the human `allow` at `createdAt + R` ms;
* send `session/cancel` at `createdAt + S` ms;
* record both send times, the resolve return, the decision row's own timestamp,
  and `a6-stop.json#ledger` / `#ledgerCounter` so the driver can classify from
  durable facts alone.

Both clocks are one clock: the service's `now()` and the kit's `Date.now()` run
on the same machine. Every offset in this note is therefore an *absolute
position on the boot's own timeline*, not a claim about production latency.

One run's timeline (`run-fence-1`, all ms from `anchor` = the request row's
`createdAt`):

| t (ms) | event | source |
| --- | --- | --- |
| 0 | `control-request-recorded` seq 13 (human leg) | durable row `createdAt` |
| 120 | kit sends `team.resolveControl(allow)` | kit clock |
| 168 | durable `control-decision-recorded` seq 14 (`allow`, `decider.kind=human`) | durable row |
| 182 | resolve response returns | kit clock |
| 345 | kit sends `session/cancel` | kit clock |
| 386 | cancel response returns | kit clock |
| 397 | durable `control-request-abandoned` seq 16, `invocation-cancelled-before-consumption` | durable row |

So in that boot the Stop was issued **177 ms after** the durable allow and
**50 ms before** the fence's terminal write; seq 15 (the prepared consumption
sequence) has no row.

### 2.3 Is this legitimate, and what is it not?

* **Legitimate**: no production sleep, no test hook, no patch, no
  `patch-package`, no vendored copy, no `--keep` state. The instrument only
  chooses *when the harness sends its two existing driver events* and reads
  durable facts. The fence itself is never touched, and every classification
  comes from ledger rows the service wrote.
* **Not a barrier inside the guard.** The guard has no test seam to hold open
  on a Host; the unit suite's S7 holds `ledger.put` open in-process, and there
  is no production equivalent (the store is the upstream host's JSON seam).
  What this instrument steers is the *input timing*, not the guard's internals.
* **Not a product change.** The only edits are `tests/**` (§9). If the fence
  could only be reached by patching product code, this lane would have stopped
  and reported a `CORE_SEAM_BLOCKER` instead.

## 3. The fence-reached arm — 3 boots at one chosen offset

Command (one shard, three fresh Worlds; `run-fence-1…3`):

```
node tests/kits/wp3-fence-timing/wp3-fence-timing.mjs \
  --worktree <this worktree> --testuse <repo>/tests/deepseek-harness-test-use \
  --evidence-dir <this dir> --host-port 17001 --mock-port 17051 \
  --resolve-ms 120 --stop-ms 345 --trials 3 --label run-fence
```

`C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_STOP=1` are set by the driver for
every trial (the officer path needs `C1_PLANE_TAKEOVER=1`, as the fence boot
note records).

### 3.1 The four required assertions — field → run1 → run2 → run3 → agree?

| required fact | `run-fence-1` | `run-fence-2` | `run-fence-3` | agree? |
| --- | --- | --- | --- | --- |
| 1. durable `allow` decision row exists | seq 14 `allow`, `decider.kind=human` | seq 14 `allow`, human | seq 14 `allow`, human | **yes** |
| 1. Stop issued **after** that decision (durable fact) | stop sent +345 = decision +177 ms | +345 = decision +178 ms | +345 = decision +179 ms | **yes** |
| 1. Stop issued **before** the consumption write | no consumption row exists (proves it) | same | same | **yes** |
| 2. zero consumption | no `control-allow-consumed` for the request | none | none | **yes** |
| 2. `allow` row still `allow` (not rewritten to deny) | seq 14 still `allow`, same seq | same | same | **yes** |
| 3. exactly one abandonment | seq 16, reason `invocation-cancelled-before-consumption` | seq 16, same reason | seq 16, same reason | **yes** |
| 3. one sequence deliberately burned (the gap) | 14 → **15 absent** → 16 | 14 → 15 absent → 16 | 14 → 15 absent → 16 | **yes** |
| 3. admission work? | no `control-allow-consumed` row at 15; counter at final read 18 | 18 | 18 | **yes** |
| 4. zero side effect — no effect file | `fileAfter = ""` | `""` | `""` | **yes** |
| 4. zero execution fact | 0 `control-execution-result` rows | 0 | 0 | **yes** |
| 4. late re-allow refused | `CONTROL_REQUEST_ABANDONED` (terminal mark, not `DECIDED`) | same | same | **yes** |
| ordering on the wire (monotone) | request 13 → decision 14 → abandon 16 | same | same | **yes** |
| `productSha` in that run's manifest | `bb3c158eb1f7…` | `bb3c158eb…` | `bb3c158eb…` | **yes** |

"Agreement" here means the three independent boots produced the **same durable
shape**, not that the arm is stable — see §7.

### 3.2 Sequence tables

**`run-fence-1`** (anchor `14:33:24.900Z`)

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 13 | `control-request-recorded` (human leg, `legOrdinal 2`) | 14:33:24.900Z | the anchor row |
| 14 | `control-decision-recorded` (`allow`, `decider.kind=human`) | 14:33:25.068Z | decidcer = human, never rewritten |
| 15 | *(no row)* | — | **burned** by the fence |
| 16 | `control-request-abandoned` (`invocation-cancelled-before-consumption`) | 14:33:25.297Z | terminal mark |

**`run-fence-2`** (anchor `14:33:41.718Z`): 13 @ `.718`, 14 `allow` @ `.885`, **15 absent**,
16 `invocation-cancelled-before-consumption` @ `42.101`; Stop sent @ `42.063`
(decision +178 ms, abandonment 38 ms later).

**`run-fence-3`** (anchor `14:33:58.505Z`): 13 @ `.505`, 14 `allow` @ `.671`, **15 absent**,
16 `invocation-cancelled-before-consumption` @ `58.895`; Stop sent @ `58.850`
(decision +179 ms, abandonment 45 ms later).

Per-run machine-readable artifacts: `run-fence-*/wp3-classification.json`,
`run-fence-*/wp3-seq-table.md`, `run-fence-*/a6-stop.json` (kit artifact, now
carrying `timing`, `ledger`, `ledgerCounter`, `abandonments`), plus the kit's
`run.log`, `instance.log`, `mock.log`, `a6-human-discovery.json`,
`a6-stop-cancel.json`, `a6-stop-late-allow.json`.

## 4. Steering map — where the fence sits, and how wide the instrument's aim is

All entries are one independent boot, `--resolve-ms 120`; the column is the
Stop send time in ms after the anchor (the durable request row). `probe/write`
is the guard's own durable boundary (the consumption write when it committed,
the terminal abandonment when it tripped).

| stop send (ms) | runs | outcome | seq | probe/write (ms) | note |
| --- | --- | --- | --- | --- | --- |
| +260 | 1 | pre-fence | 14 only | — | Stop lost the race before the waiter observed the decision |
| +300 | 2 | pre-fence | 14 only | — | same (two independent boots, `run-edge-s300`, `calib2/s2-s300`) |
| +320 | 1 | **fence-reached** | 14 → 16 | 388 | |
| +330 | 1 | **fence-reached** | 14 → 16 | — | `calib3/s3-s330` |
| +345 | **4** | **fence-reached 4/4** | 14 → 16 | 383–397 | `run-fence-1…3` + `calib3/s3-s345` |
| +360 | 1 | **fence-reached** | 14 → 16 | 373 | `calib3/s3-s360` |
| +362 | 1 | **fence-reached** | 14 → 16 | 373 | |
| +368 | 1 | **fence-reached** | 14 → 16 | 387 | |
| +369 | 4 | fence 1 / consumed 3 | 14→16 or 14→15 | 341–380 | boundary |
| +370 | 4 | fence 1 / consumed 3 | 14→16 or 14→15 | 345–382 | boundary |
| +371 … +375 | 6 | consumed | 14 → 15 | 363–373 | Stop sent at/after the write |
| +400 / +520 / +700 | 3 | consumed | 14 → 15 | — | clearly late Stops (`calib2/`) |

Read the boundary honestly: **the same offset does not give the same outcome**
(+369: one trip, three consumptions; +370: one trip, three consumptions). The
reason is that three latencies stack up and none is under the instrument's
control:

1. **the waiter's poll phase** — the anchor is the request row, but the wait
   begins some tens of ms later; measured probe/write times across boots span
   **+341 … +397 ms** (≈56 ms), i.e. ±28 ms around the middle;
2. **the `session/cancel` propagation** — measured indirectly as the gap
   between our send and the terminal write in a trip: **11, 19, 38, 45, 52, 68
   ms**; and the cancel POST's own response time ranged **4 ms … 3.6 s** in
   these runs (it can queue behind the session it is cancelling);
3. the sub-millisecond **write window** itself (§5), which is 2–3 orders of
   magnitude smaller than either of the above.

So the *fence-reached band* is wide (every offset in +320 … +368 tripped at
least once, ≥50 ms of usable aim) but its **upper edge is fuzzy by ±28 ms**.
That fuzziness — not the fence — is the instrument's resolution.

## 5. The residual-window probe — **NOT HIT**, and the measured steering width

The disclosed residual window is the single await between the fence's
synchronous probe and the durable `control-allow-consumed` write (author:
≈0.23–0.43 ms in-process; independent reviewer 0.348–0.585 ms). To land a Stop
inside it, the abort must become visible *after* the probe and *before* the
write commits.

**Result: no run landed it.** The closest attempts, with the Stop issued as late
as the instrument can place it and still let the consumption commit:

| run | stop send | consumption write | stop − write | outcome | effect file | execution fact |
| --- | --- | --- | --- | --- | --- | --- |
| `run-residual-s369` | +369 ms | +369 ms | **0 ms (same millisecond)** | consumed, seq 14→15 | none | none |
| `run-residual-s371` | +371 ms | +370 ms | +1 ms (after) | consumed | none | none |
| `run-residual-s372` | +372 ms | +369 ms | +3 ms (after) | consumed | none | none |
| `run-residual-s370-3` | +370 ms | +364 ms | +6 ms (after) | consumed | none | none |
| `run-residual-s373` | +373 ms | +363 ms | +10 ms (after) | consumed | none | **1 (`succeeded`)** |
| `calib2/s2-s400` | +400 ms | +388 ms | +12 ms (after) | consumed | none | **1 (`succeeded`)** |

Every one of these is a *late* Stop: the durable write already existed when the
cancel request left the kit (lead ≥ 0 ms at millisecond resolution, with the
ordering inside the same millisecond unresolved). The honest statement:

* The smallest gap achieved between the Stop send and the durable consumption
  write is **0 ms (same millisecond), and the sequence in that same
  millisecond is NOT observable** from durable facts — both timestamps come
  from millisecond-resolution ISO stamps.
* For the Stop to be *provably* inside the window, the instrument would have to
  place the abort inside a **0.3–0.6 ms** interval while the boundary itself
  moves ±28 ms between boots and the cancel's propagation alone varies by tens
  of milliseconds. That is **~50–100× outside this instrument's resolution**.
* Therefore: **not hit, not disproven.** The fence's residual window was not
  reached on a Host in these 29 boots; nothing here shows it is unreachable,
  and nothing here bounds it.

One deliberately-late observation worth recording because it is *not* the
window but it is the same disclosure seen from the other side: in the
consumption runs where an execution fact exists, the fact's outcome is
`succeeded` even though the confined shell reported `cancelled=true`
(`exit=not-observed`) — the effect file never landed in **29/29 runs**
(`fileAfter = ""` in every run). That is the pre-existing execution-result
path, outside this lane's claim; it is recorded so a reader does not mistake
"no file" for "no body was ever admitted to the runner".

## 6. What a reader must NOT conclude

1. **Not** "the fence is now atomic". The disclosed window is unchanged and was
   not measured here; a Stop that arrives after the probe can still commit a
   consumption (`run-residual-*`, `calib2/*`).
2. **Not** "0 consumption in 3 boots proves the Stop guarantee". 3 runs at one
   offset are an *agreement*; 10/11 pre-fence passes in `c2-adjudication-2`
   should already have taught that a clean Stop arm can be entirely pre-fence.
   The discriminating fact is the terminal `control-request-abandoned` at seq
   16 with the burned seq 15 — not the absence of a file.
3. **Not** "the fence trips because a Stop happened". The trip is only what the
   **final consumption probe** observed. A Stop before the pre-guard
   checkpoints produces the pre-fence shape (no terminal mark, late allow
   refused `DECIDED`); a Stop after the probe produces a consumption. Both are
   in this evidence set (`run-edge-s300` vs `run-residual-s371`).
4. **Not** "the poll grid is a product hook". The 250 ms cadence is the
   documented default of `awaitControlDecision`; the instrument reads a durable
   row and sends its two existing events at chosen offsets. Nothing in
   `packages/**` changed.
5. **Not** "the yield is a rate". +345 gave 4/4, but +369 and +370 each gave 1/4
   in the same session. The offset is a *position*, not a probability model;
   the boundary moves between boots.
6. **Not** "the residual window is closed/unreachable". It is *unmeasured* by
   this instrument (§5). The author's ≈0.3–0.6 ms is an in-process figure and
   this lane neither confirms nor refutes it.
7. **Not** "the arm's kit verdict is the evidence". The kit's own `A6-12` line
   passed in the pre-fence runs too; every verdict here is re-derived from
   `storages/team_domain.json` rows and the sequence counter by the driver
   (`wp3-classification.json`), never from the tool return value.

## 7. Reproduce

```bash
# fence-reached arm: 3 independent boots, fresh World each
node tests/kits/wp3-fence-timing/wp3-fence-timing.mjs \
  --worktree "$PWD" --testuse /path/to/tests/deepseek-harness-test-use \
  --evidence-dir dev/agent-workflow/evidence/wp3-fence-timing \
  --host-port 17001 --mock-port 17051 \
  --resolve-ms 120 --stop-ms 345 --trials 3 --label run-fence

# steering map / residual probe (one boot per offset)
node tests/kits/wp3-fence-timing/wp3-fence-timing.mjs ... \
  --resolve-ms 120 --sweep-stops 300,320,345,362,368,369,374 --label-prefix run-edge
```

* Ports: host `1700x`, mock `1705x` (this lane's reservation; other lanes hold
  `1400x`/`1500x`/`1600x`). Loopback only. `:3080` is only read-probed by the
  kit and was never written; the probe result is kept in each run's
  `pre-stable-probe.json`.
* `DSH_HOME`: the kit derives `tests/homes/c1-smoke-<stamp>` **inside the
  worktree**, one per run, and deletes it at teardown. After 29 boots
  `tests/homes/` is empty in this worktree (verified); nothing is left running.
  Blueprint scratch dirs (`.c1-smoke-blueprints-*`) are also removed.
* Every run's `run-manifest.json` carries `productSha`/`productTree`,
  `hostVersion`, `hostBaselineSha`, `rootSessionId` and the opt-in flags.
* Driver exit codes: `0` all trials `fence-reached`, `3` at least one trial not
  fence-reached (a consumed trial is a finding, not a crash), `2` the kit
  itself failed, `1` instrument misuse (bad args / missing worktree / busy
  port).

## 8. Files in this directory

| path | what it is |
| --- | --- |
| `run-fence-1…3/` | **the fence-reached arm** (3 independent boots at stop=+345 ms) |
| `run-edge-s300…s374/`, `run-residual-s369…s375/`, `run-probe-369-*`, `run-probe-370-*` | the steering sweep and the residual probe |
| `calib/`, `calib2/`, `calib3/` | the earlier calibration boots that located the guard's post-decision boundary (`t-260`, `s2-s*`, `s3-s*`); kept because they are the evidence for §4's map, not discarded as scratch |
| `SUMMARY-*.json` | the driver's per-invocation aggregate |
| `<run>/wp3-classification.json` | the durable-fact classification + the four assertions + offsets |
| `<run>/wp3-seq-table.md` | the per-run seq table rendered from durable rows |

## 9. Gates and tree hygiene

| gate | verdict |
| --- | --- |
| `node scripts/doc-checks.mjs` | **PASS** (exit 0) |
| `node scripts/verify-blueprint-version-clean.mjs` | **RED at base** `dirty(10 files, 26 sites)`, `unknown(0)`, `adjudicated(16)`, `refused(56)`, `prose(7)` — unchanged set; the kit's four `=v5` fixture lines moved with this lane's edits, so the **baseline was re-recorded in the open** with a dated note in `dev/agent-workflow/evidence/a4-pr7/ci-gate/blueprint-fence-baseline-606a0be7.txt` (`L639/828/2279/3015` → `L680/869/2361/3124`, same four statements, `=v5` unchanged, nothing resolved) |
| `node scripts/ci-pr-gate.mjs --only blueprint-fence` | **PASS** — `no new offending path (dirty 10 files/26 sites, unknown 0 files, universe 1196 tracked files, baseline 10 identities)` |
| p4t6 census booking | **not required**: no file was added or changed under `packages/**` |
| product files | **none touched** (`git status` is `tests/**` + `dev/agent-workflow/evidence/**` only) |

Known pre-existing reds not re-litigated: `eslint .`, `check:install-manifest`,
`u7-f`, `a5sf-os-runner` P1-07.

## 10. Signature

Instrument-only lane on `task/wp3-fence-20261111`. No product behaviour was
changed, no product or upstream file edited, no candidate ref or Authority
pointer moved, nothing pushed or merged. The 29 Worlds were created and torn
down by the instrument itself.
