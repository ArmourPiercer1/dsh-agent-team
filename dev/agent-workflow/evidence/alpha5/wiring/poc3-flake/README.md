# poc3-flake — PoC3 leg E(fd) label drift: attribution **(a) test-side**, fixed by leg handle-lifecycle rules

Writer lane: POC3-FD (first liveness report on this surface; no prior session contact with PoC3).
Base `master@a53ca348` (`origin/master` after fetch), branch `alpha5-poc3-flake`, one worktree, one writer.
Pure node surface: no ports, no DSH world, `:3080` never touched. Tolerance list, baseline pin
(`tests/paths.mjs`), guard semantics and the **meaning of every assertion are untouched** — the diff is
confined to the two legs' own handle lifecycle in
`packages/runtime/controlled-fs/test/poc3-probes.test.ts` (lane `src/` untouched, `git diff --stat`: 1 file).

## The red being chased

```
FAIL packages/runtime/controlled-fs/test/poc3-probes.test.ts > PoC3-E fd continued-use after close
     > GUARDED: the lane holds no standing fd — a presented fd of a closed call is refused
AssertionError: expected 'fd-recycled' to be 'fd-closed' // Object.is equality
  ❯ test/poc3-probes.test.ts:261:45
```

Captured locally, byte-shape-identical to the CI report, on the **unmodified** baseline file:
`runs/RED-baseline-r28-shape2-poc3-probes-261.txt`, `runs/RED-baseline-r30-…`, `runs/RED-baseline-2nd-r9-…`.
Habitat: the lane suite run from the same root while a sibling file hammers `open()/close()` in the same
process (`rigs/a5p3f-hammer.rig-test.txt` + `rigs/a5p3f-loop.sh`) — **3 reds in 96 baseline rounds**.

## Mechanism (measured, not inferred)

`readDescriptor` decides the label from exactly one kernel read
(`src/controlled-fs.ts:501-524`): a miss in the lane's own fd registry, then
`readlinkSync('/proc/self/fd/<n>')` → `null` ⇒ `fd-closed`, anything else ⇒ `fd-recycled`. Both map to
`denied` / `TOOL_BINDING_UNVERIFIED`; the guard's decision never depends on it.

An **fd number is process-global state**. The runner keeps everything in-process (`pool: 'threads'`,
no child spawn — root `vitest.config.ts`), so sibling test FILES run in worker threads of ONE process
against ONE fd table, and the kernel answers every `open()` with the **lowest free number**. The lane
holds no standing fd across calls, so the number a leg captured is back in the allocator's hands while
the leg still carries the descriptor. `a5p3f-diag.mjs` replays that leg's shape and records both
observations of the same kernel object:

```
{"trials":400,"churn":true,"answeredFdClosed":389,"answeredFdRecycled":11,"driftWindows":21,
 "labelInconsistentWithOwnView":0,"worstWindowNs":59572,"capturedFdRange":[30,31]}      # runs/diag-sweep.txt
{"trial":11,"fd":31,"preOwner":null,
 "laneView":"…/tests/homes/a5p3-…/outside/churn-victim.txt","reason":"fd-recycled","windowNs":27155}
```

`preOwner: null` (the test thread sees the number free) → 27 µs later the lane sees it owned by another
thread's file. That is the whole race window: **~25-100 µs, 21/400 replays under same-process churn,
0/200 without it**.

`labelInconsistentWithOwnView: 0` in every recorded replay (2200 presentations across
`runs/diag-sweep.txt` + `runs/*.json`) — the lane
has never answered against the `/proc` view it published itself. So this is **not** a label-path defect:
for a presented fd of a closed call both labels are truthful snapshots, and which one is true is decided
by whoever else in the process is opening files at that instant.

## Attribution: **(a) test-side handle lifecycle**

The leg asserted a fact it did not own — "this number is still nobody's at check time" — while other legs
in the same process were free to take it. It is the same family the census already recorded for this file
(`evidence/a4-pr7/population-baseline/nine-root-319a60d7.md` § CENSUS-LOAD RACE FAMILY, repair `d1409059`):
*observe the precondition, never assume it*. Attribution (b) is excluded by the `labelInconsistentWithOwnView`
column above; the guard itself never served a byte in any trial (the rig aborts loudly if it ever does).

## The fix (3 rules, all inside the two legs)

1. **RESERVE, THEN RELEASE** (closed-fd leg): hold `FD_RESERVE_SLOTS = 64` decoy fds *while the lane
   opens*, so its number lands above them, then release. Lowest-free allocation now sends every later
   foreign opener into the freed band strictly below the leg's number. Band alone: 0/400 replays at
   W=16…256 (`runs/diag-sweep.txt`), but only **2/96** suite rounds saved under hammer load — a band is
   headroom, not a guarantee, so it does not stand on its own.
2. **OBSERVE, NEVER ASSUME** (closed-fd leg): re-present until the lane answers `fd-closed` for the number
   the leg just closed (≤ `FD_CLOSED_SIGHTINGS = 12`); if no presentation sees it, the leg goes RED and the
   message lists each drift window with the fd and who owned it afterwards. The `fd-closed` requirement is
   unchanged; nothing is tolerated, skipped, or widened.
3. **HOLD A MISS OPEN** (recycling leg): the sibling leg's probe used to close each miss, handing the same
   slot back every iteration, so a thread momentarily owning the number could starve it for all 500
   attempts (`runs/RED-baseline-2nd-r33-mirror-recycling-leg.txt`, `expect(recycled).toBe(captured)`).
   Holding each miss removes one free slot below the target, so the free set shrinks monotonically and an
   open *must* land on it (capped by `FD_HOLD_CAP = 128` for fd-limit politeness). This rule was required
   by rule 1: the released band otherwise starves this leg (measured 6/96 with reservation only,
   `runs/RED-band-only-r6-mirror-recycling-leg.txt`).

## Before / after (same rig, same host, 96 rounds × 4 concurrent each)

| variant | `fd-recycled ≠ fd-closed` (:300/:261) | recycling never observed (:334/:291) |
| --- | --- | --- |
| baseline (unmodified) | **3 / 96** | 2 / 96 |
| band only | 2 / 96 | 6 / 96 |
| band + observe + hold-miss-open (**this branch**) | **0 / 96** | **0 / 96** |
| this branch, no rig (plain lane suite) | 0 / 24 | 0 / 24 |

Lane gates on the final text: `vitest run` 42/42 (5 files with the rig deployed, 4 without),
`tsc -p packages/runtime/controlled-fs/tsconfig.lane.json` exit 0,
`eslint packages/runtime/controlled-fs/test/poc3-probes.test.ts` exit 0.

## Reproduce

```bash
# 1) mechanism, read-only toward the lane (no runner, no world, no child spawn)
cd dev/agent-workflow/evidence/alpha5/wiring/poc3-flake
A5P3F_REPO=<worktree-root> A5P3F_HEAD=$(git rev-parse --short HEAD) \
  node a5p3f-diag.mjs --trials 400 --churn 1 --json runs/diag-churn.json
A5P3F_REPO=<worktree-root> node a5p3f-diag.mjs --trials 400 --churn 1 --reserve 64

# 2) in-suite RED/GREEN: deploy the hammer sibling, loop, then DELETE the copy
cp rigs/a5p3f-hammer.rig-test.txt packages/runtime/controlled-fs/test/zz-rig-fdchurn.test.ts
OUT=/tmp/poc3-flake bash rigs/a5p3f-loop.sh 96 4 mine
rm packages/runtime/controlled-fs/test/zz-rig-fdchurn.test.ts
```

The root CI collection cannot be run in this worktree (it has no installed workspace `node_modules`;
`packages/domain/**` fails to resolve `yaml`), so in-suite measurement used the lane's own runner, which
is the same runner CI uses for this lane.

## Not changed here (recorded for the C-FS lane owner)

The label pair `fd-closed` / `fd-recycled` is a snapshot of a process-global kernel object, not of the
lane's history: any consumer that presents an fd it does not exclusively own can legally be answered
either way, and no leg-local code can pin it (the reservation only moves the odds). If the C-FS lane wants
the *label* to be a stable contract rather than an observation, that is an interface ruling for that lane —
this branch changes no `src/`, no tolerance list, no baseline, and no assertion meaning.
