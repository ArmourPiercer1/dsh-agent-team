# PERF-DIAG 2026-11-15 — where the `ci-census` 20 minutes actually go

> Dated: 2026-11-15 · Status: **MEASUREMENT ONLY** · Branch `task/perf-diag-20261115` off `origin/master` @ `6aba7365f`
> This round changes **no** CI gate, workflow, Required context, or the census concurrency model. The only
> code added is two read-only profiling scripts (see §9). Every number below is either read from a real
> GitHub Actions run, measured on this host with the commands in §8, or explicitly marked **UNKNOWN**.

## 0. One paragraph

The census is not slow because of the host build, and it is not slow because 705 files are observed. It is
slow because **92 % of the per-file test work lives in 20 files**, and two of those files are 18 % each:
one re-runs the merge gate's own CI legs (lint / lint-visibility / typecheck / a scratch-worktree build /
client lane) *inside a single vitest test file*, and one spends 196 s spawning a real confined `python3`
**6 600 times**. The capture runs at most **three** test files concurrently (vitest derives `maxWorkers`
from `availableParallelism() - 1`, so a 4-vCPU runner gets 3), and it achieves 2.42–2.46 of that 3. Lifting
that ceiling to 4 workers is the single cheapest measured lever (−102 s per capture, −204 s per job, one
flag, zero change to what is verified); caching the pristine host build is the next (−176 s of a 216 s
step); the rest are verification-tradeoffs and are ranked in §7.

## 1. Provenance and method (what is hosted, what is local)

| Layer | Source | Value |
| --- | --- | --- |
| Job wall | Actions jobs API, `ci-required` run [`43709558626`](https://github.com/ArmourPiercer1/dsh-agent-team/actions/runs/43709558626) (run 1215, head `1f7725663`, **tree `8b10651a` = the base commit's tree**) | **1226 s = 20 m 26 s** |
| Step split | same, `/actions/jobs/132798177506` | see §2.1 |
| Census decomposition | `census-runtime-transcripts-1215` artifact: `census-transcripts/tinf-timing.tsv`, `census-capture-{1,2}.txt` | see §2.2 |
| Per-file profile (hosted) | the `default` reporter's own `✓ <file> (N tests) Xms` lines inside those capture transcripts | §3 |
| Per-file profile (local cross-check) | full local capture, vitest JSON report (`testResults[].startTime/endTime`) | §3 |
| What the per-file time *is* | `NODE_OPTIONS=--require` instrumentation in every vitest worker (`tools/perf-diag-capture-trace.cjs`) | §2.3, §4 |
| Concurrency / memory | `/usr/bin/time -v` over whole runs, `taskset -c 0-3` (4-CPU emulation of the runner) + `CI=true` | §5 |
| Build reuse | clean rebuild ×2 + digest, relocation, boot | §6 |

**The hosted run is the base tree, exactly.** Run 1215's head is `1f7725663c55` and
`git rev-parse 1f7725663^{tree}` = `git rev-parse 6aba7365f^{tree}` = `8b10651aaa94` — the census ran
byte-identical test sources to the local capture, and `git diff 1f7725663 HEAD` shows only this memo. There is
no separate run "at `6aba7365f`" because `6aba7365f` is the squash of the same PR whose branch tip was
`1f7725663`. The two captures therefore agree for a reason, not by luck (§3.3).

**One caveat about the 1226 s itself.** The M6 memo records five green `ci-census / census-runtime` jobs
between 1325 s and 1495 s (11-14 → 11-15 00:34); run 1215 (11-15 11:34) at **1226 s is faster than all of
them**. The decomposition below is per-step and does not depend on the total, but the *scale* of every wall
number in this memo is the fast end of the observed range: a slower run moves the host build and the captures
up together (+8…18 %) and leaves the shares and the ranking unchanged.

**Runner class.** `.github/workflows/census-runtime.yml` says `runs-on: ubuntu-latest` and does **not**
state a size. GitHub's standard `ubuntu-latest` is **4 vCPU / 16 GB**; that is an external fact, not a
claim made by this repository. Every local "4-vCPU" run was pinned with `taskset -c 0-3`.

## 2. Where the 1226 s goes

### 2.1 Job steps (run 1215, verbatim from the jobs API)

| step | s | share |
| --- | ---: | ---: |
| Checkout | 10 | 0.8 % |
| Bind to the synthetic merge tree | 2 | 0.2 % |
| Precheck (two git pins) | 0 | — |
| Setup Node / pnpm / resolve host pin | 2 | 0.2 % |
| Provision the pinned pristine test host | 3 | 0.2 % |
| **Build the pristine host (`TEST_METHODS` §2 chain)** | **216** | **17.6 %** |
| **Build this repo (packages + composition)** | **17** | **1.4 %** |
| Host-provisioned security suites | 2 | 0.2 % |
| **Census — nine roots, two captures** | **966** | **78.8 %** |
| Re-grade + upload + verdict + teardown | 2 | 0.2 % |
| **job wall** | **1226** | 100 % |

The census leg decomposes as `965.9 s = plan 0.614 + plan-verify 0.569 + capture-1 477.7 + capture-2 486.9`
(`DSH-CI-LEG leg=census seconds=965.9`). So **the whole job is two serial captures**; everything else is
rounding error except the host build.

### 2.2 What the capture's own clock says (local, base tree, 4 CPUs, 3 workers)

```
Duration  469.92s (transform 17.49s, setup 0ms, import 142.37s, tests 1167.80s, environment 43ms)
```

| component | s | note |
| --- | ---: | --- |
| test bodies | 1167.8 | Σ over 705 files; equals the JSON window sum (1158.6 s) to 0.8 % |
| module import / collect | 142.4 | 705 × ~200 ms — real worker time, **not** in the per-file window |
| transform | 17.5 | esbuild |
| **worker-time floor at 3 workers** | **442.6** | (1167.8+142.4+17.5)/3 |
| **measured wall** | **469.9** | ⇒ 94 % packing efficiency, 27 s of queue/tail |
| LPT check | 386.2 | optimal 3-worker makespan of the 705 measured test windows alone (Σ/3 = 386.2, i.e. the distribution packs perfectly) |

So **89 % of worker time is test bodies**, 11 % is collecting modules. Nothing else is big enough to matter.

### 2.3 Inside the test bodies: what the reporter does and does not emit

- The **JSON reporter carries per-file timing**, but not as a field: `testResults[]` has
  `assertionResults/startTime/endTime/status/message/name` — **no `duration` and no `perfTest`**. A file's
  duration is `endTime - startTime`, and that window equals **Σ `assertionResults[].duration`** (median
  difference 0.4 ms, p99 7.8 ms, worst 576 ms over 705 files). It therefore contains the test bodies and
  essentially **nothing else** — it cannot separate hooks/setup/spawn from assertion compute. That split had
  to be measured, not read (§2.4).
- The **`default` reporter** prints one line per file (`✓ <path> (N tests) Xms`) plus indented lines for
  tests slower than its threshold. The census uploads these transcripts, so **hosted per-file timing is
  available today with no new instrumentation** — that is what §3 uses.

### 2.4 Measured attribution (instrumentation, one full local capture)

`tools/perf-diag-capture-trace.cjs` is loaded into every vitest worker via `--require` and wraps the
three primitives that produce non-assertion time. One capture, 705 files, measured:

| signal | measured | meaning |
| --- | ---: | --- |
| child-process spawns | **5 827** | `spawn:python3` 4 016, `spawnSync:python3` 1 322, `execFileSync:git` 217, `spawnSync:node` 85, `spawnSync:git` 52, `spawn:node` 37, `spawnSync:rg` 35, `spawn:sh` 23, rest <15 |
| timers **fired** | 1 399 calls / **95 348 ms** | requested-but-cleared timers discarded (a `setTimeout(5000)` guard is not 5 s of waiting); 83 % of the ms is set from a non-test frame and is reported as such |
| `mkdir` under `tests/homes/` | 13 004 | nested dirs of the worlds below |
| distinct `DSH_HOME` worlds | **34** | named worlds, one dir each |
| `mkdtemp` fixture trees | **74** | |
| bare interpreter spawn | 8.5 ms wall / 6.7 ms CPU (`python3 -c pass` ×100) | lower bound on per-spawn cost when idle |

Per-file attribution is by call stack, so "which file spawned this" is measured, not inferred:
`alpha5-glob-backend-adversarial` 3 299 spawns, `alpha5-glob-backend` 718, `a5-cancel-glob` 274,
`a5-cancel-search` 226, `a4p7-merge-gate` 208 (plus its own nested `pnpm`/`eslint`/`tsc` children),
`alpha5-search-backend` 107.

**Two dominant shapes** (both measured, §3 table and §7):

1. **The glob/cancel family** spawns one real confined `python3` per walk. The adversarial file alone is
   3 299 spawns in 195 s. A/B with the file's own documented dials, alone on 4 CPUs:
   `A5GLB_RACE_PACE_MS=0` → **124.5 s** (CPU user 66.0 + sys 52.0 = 118.0 s, i.e. **95 % CPU-bound**);
   `A5GLB_RACE_PACE_MS=4` → **154.7 s** (the pace sleep is **30.2 s**, 19.5 % of the file);
   `A5GLB_RACE_WALKS=1200` → **41.8 s**. Marginal cost per walk ≈ **15.3 ms**, of which ~7.9 ms is system
   time (spawn + landlock + fs). This is genuine per-walk compute and syscalls, not polling.
2. **`a4p7-merge-gate.test.ts`** is not a unit test: it re-runs the merge gate's instruments inside the
   census. Hosted slow-subtest lines, verbatim (capture 1): lint identity diff **25.5 s**, lint-visibility
   **22.1 s**, `check-artifacts-at-head` **18.6 s**, "the scratch the commit-level instrument builds" **71.1 s**,
   `pnpm -r run typecheck` **23.5 s**, client lane **29.4 s** = **190.2 s of 197.9 s**. The rest of the file
   is ~8 s.

## 3. Per-file profile

### 3.1 Per-file profile: the 20 slowest files

Seconds are the mean of the two hosted captures. `% of a 477.7 s capture` is the literal question asked (the
file's own seconds over the capture wall — **not additive**, because three files overlap at a time); `% work`
is its share of the capture's 1157 s of file work, which is what the saving model in §7 uses.

| # | file | root | s (cap1 / cap2) | s (mean) | % of a 477.7 s capture | % work | tests |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `packages/testkit/test/a4p7-merge-gate.test.ts` | testkit | 197.9 / 222.3 | 210.1 | 44.0 | 17.9 | 35 |
| 2 | `packages/runtime/test/alpha5-glob-backend-adversarial.test.ts` | runtime | 204.9 / 220.9 | 212.9 | 44.6 | 18.1 | 8 |
| 3 | `packages/runtime/test/a5-cancel-glob.test.ts` | runtime | 120.8 / 120.3 | 120.5 | 25.2 | 10.3 | 26 |
| 4 | `packages/runtime/test/a5-cancel-search.test.ts` | runtime | 100.4 / 102.2 | 101.3 | 21.2 | 8.6 | 30 |
| 5 | `packages/runtime/test/alpha5-glob-backend.test.ts` | runtime | 89.5 / 83.6 | 86.5 | 18.1 | 7.4 | 53 |
| 6 | `packages/runtime/test/a5b2-exit-code-fidelity.test.ts` | runtime | 45.0 / 44.2 | 44.6 | 9.3 | 3.8 | 11 |
| 7 | `packages/runtime/test/a5sf-bl16-grep-realm.test.ts` | runtime | 43.1 / 42.7 | 42.9 | 9.0 | 3.7 | 10 |
| 8 | `packages/runtime/test/a5b3-cancel-leg.test.ts` | runtime | 32.5 / 36.6 | 34.5 | 7.2 | 2.9 | 12 |
| 9 | `packages/runtime/test/alpha5-search-backend.test.ts` | runtime | 34.7 / 31.2 | 33.0 | 6.9 | 2.8 | 42 |
| 10 | `packages/runtime/test/a5lsp2-assembly.test.ts` | runtime | 30.3 / 29.6 | 30.0 | 6.3 | 2.6 | 7 |
| 11 | `packages/runtime/test/a5sf-confined-subprocess.test.ts` | runtime | 29.7 / 29.4 | 29.5 | 6.2 | 2.5 | 38 |
| 12 | `packages/runtime/test/a5rbn-runtime-base-narrow.test.ts` | runtime | 27.1 / 26.1 | 26.6 | 5.6 | 2.3 | 8 |
| 13 | `packages/runtime/test/alpha5-glue7-plane-backends.test.ts` | runtime | 20.4 / 20.1 | 20.2 | 4.2 | 1.7 | 12 |
| 14 | `packages/runtime/test/a5-m1-bash-c1.test.ts` | runtime | 13.9 / 13.4 | 13.7 | 2.9 | 1.2 | 10 |
| 15 | `packages/runtime/test/u74a-jobs-producer.test.ts` | runtime | 13.8 / 13.5 | 13.7 | 2.9 | 1.2 | 28 |
| 16 | `packages/runtime/test/a5-globoff-key.test.ts` | runtime | 10.5 / 10.1 | 10.3 | 2.2 | 0.9 | 7 |
| 17 | `packages/runtime/test/a5intr3-kit-runner.test.ts` | runtime | 10.5 / 10.2 | 10.3 | 2.2 | 0.9 | 1 |
| 18 | `packages/runtime/test/a5-scratch-default.test.ts` | runtime | 10.3 / 10.1 | 10.2 | 2.1 | 0.9 | 5 |
| 19 | `packages/runtime/test/a5sf-subprocess-contract.test.ts` | runtime | 10.2 / 9.9 | 10.1 | 2.1 | 0.9 | 3 |
| 20 | `packages/runtime/test/a5lsp2-streaming.test.ts` | runtime | 9.5 / 9.5 | 9.5 | 2.0 | 0.8 | 15 |

Full 705-row tables: `per-file-hosted-capture-1.tsv`, `per-file-hosted-capture-2.tsv`, and the local
cross-check `per-file-local-capture-1.tsv` (with spawn / fired-sleep / world-mkdir columns).

### 3.2 Concentration and aggregation

`Σ file work = 1157.1 s` (cap 1) / `1190.4 s` (cap 2). Shares: **top 1 = 17.7 %**, top 5 = **62.6 %**,
top 10 = **78.6 %**, top 20 = **91.9 %**, top 50 = 98.0 %. **592 of 705 files are under 100 ms**; only 37
files exceed 1 s. The distribution's p50 is 0.0 s, p90 0.4 s, p99 34.7 s.

By root, as the mean of the two captures (**this is work, not the root window** published by `tinf-timing`, which is
`max(end)−min(start)` and therefore overlaps; the two must not be added):

| root | files | file-seconds | % work |
| --- | ---: | ---: | ---: |
| packages/runtime | 511 | 941.0 | 80.2 |
| packages/testkit | 34 | 227.4 | 19.4 |
| packages/tools/a5p5-tools | 10 | 2.0 | 0.2 |
| packages/domain | 43 | 1.8 | 0.2 |
| packages/tools | 15 | 0.5 | 0.0 |
| packages/client | 29 | 0.3 | 0.0 |
| packages/remote | 16 | 0.2 | 0.0 |
| packages/runtime/controlled-fs | 4 | 0.2 | 0.0 |
| packages/storage | 23 | 0.2 | 0.0 |
| packages/contracts | 13 | 0.1 | 0.0 |
| packages/legacy | 7 | 0.1 | 0.0 |

"runtime and testkit are the long tail" is true but coarse: **runtime alone is 80 % of the work, and 19 of
its 511 files (ranks 2–20 above) are 860.1 s of its 941.0 s — 91 % of the root's work, 73 % of the whole
census's work.** Any plan that balances roots is balancing the wrong unit.

By class, capture 1 (from each test file's own source: `WORLD` = creates a DSH world / starts a host, `SPAWN` = spawns a
child but no world, `PURE` = neither):

| class | files | file-seconds | % work | slowest file |
| --- | ---: | ---: | ---: | ---: |
| PURE | 633 | 521.8 | 45.1 % | 204.9 s |
| SPAWN | 35 | 350.8 | 30.3 % | 100.4 s |
| WORLD | 37 | 284.5 | 24.6 % | 197.9 s |

**The static class is a proxy, not a measurement** — the single slowest PURE file spawns 3 299 children
through a product provider that the test file never names. The measured spawn counts in
`trace-per-file.tsv` are the authoritative signal; the class column exists only to answer the question as
asked ("starts a host/world vs pure logic") and is labelled as such.

### 3.3 Hosted vs local fidelity

| | hosted cap 1 | hosted cap 2 | local cap 1 (3 workers, 4 CPUs) |
| --- | ---: | ---: | ---: |
| files | 705 | 705 | 705 |
| assertions | 9 213 | 9 213 | 9 213 (2 failed) |
| Σ file work | 1157.1 s | 1190.4 s | 1158.6 s |
| capture wall | 477.7 s | 486.9 s | 470.4 s |
| achieved parallelism | 2.42× | 2.44× | 2.46× |

Per-file agreement is within 0.1 % in total; the largest single-file delta is `alpha5-glob-backend`
+14.8 s (17 %) and the adversarial −9.8 s. Locally **2 tests fail** that pass on the runner (both
environment-shaped: `a4p7-merge-gate`'s lint identity diff sees this worktree's extra untracked files;
`a5sf-os-runner`'s network-deny leg sees a different local landlock ABI). The local capture is a
**measurement**, not a green census.

## 4. Duplicated initialization (per capture, measured)

| what | count per capture | evidence |
| --- | ---: | --- |
| DSH host **built/installed** by the tests | **0** | no test runs the host build; the job builds the host once for BOTH captures |
| DSH host built/installed by the job | **1** per job (216 s), shared by 2 captures | §2.1 |
| distinct `DSH_HOME` worlds created | **34** | trace, distinct `tests/homes/<name>` |
| `mkdir` calls under `tests/homes/` | 13 004 | trace |
| `mkdtemp` fixture trees copied | **74** | trace |
| child processes spawned | **5 827** | trace |
| *nested* full-product builds inside a test (`a4p7` `check-artifacts-at-head` + scratch instrument) | 2 | §2.4; 18.6 s + 71.1 s |
| nested `pnpm -r run typecheck` / `eslint` / client-lane runs | 1 / 2 / 1 | §2.4 |

Reading:

- **The host is not rebuilt per test.** The duplication is not "install the host 700 times" — it is
  **"spawn a real process 5 827 times"** and **"re-run two whole builds plus the typechecker inside one
  test file"**. Repeated *setup* in the classic sense (world creation, fixture copies) is 34 + 74 = small.
- The 34 worlds are not a lever: their whole footprint is 13 004 `mkdir` calls, which at even 0.1 ms each
  is ~1.3 s per capture (an upper bound, not a measurement — but nothing else in the trace is attributed to
  them, while 5 827 process spawns are).
- The repeated-setup cost that *is* large: `a4p7`'s nested legs are **190 s of each capture's 1157 s of test
  work (16 %)**, which at the capture's measured 2.46× packing is ≈77 s of wall *per capture* and ≈154 s of
  the job — i.e. **13 % of the 1226 s job is the merge gate being re-run inside the census**, on a tree the
  same job already ran those legs against in `pr-gate`.
- **Second-capture duplication:** the second capture repeats the entire 705-file population for a
  population-equality check. It is 477–487 s, 39 % of the job wall, and its incremental information is
  "the same population still passes an hour later". That is a policy question, not a perf bug — but it is
  the largest single cost in the job.

## 5. Concurrency: CPU-bound, memory-bound, or waiting?

All runs pinned to 4 CPUs, `CI=true`. Raw output: `concurrency-runs.txt`.

| run | wall | CPU (user+sys) | CPU/wall | maxRSS | Σ test bodies |
| --- | ---: | ---: | ---: | ---: | ---: |
| full capture, 3 workers (cold) | 470.4 s | 889.8 s | 1.89 cores (47 %) | 1.46 GB | 1167.8 s |
| full capture, 3 workers (warm) | 428.3 s | 774.3 s | 1.80 cores (45 %) | 2.19 GB | 1062.7 s |
| full capture, **4 workers** | 326.2 s | 749.6 s | 2.29 cores (57 %) | 2.16 GB | 1088.7 s |
| top-20 together, 3 workers | 329.2 s | 494.8 s | 1.50 cores (37 %) | 1.49 GB | 972.4 s |
| top-20 **serially**, 1 worker | 921.1 s | 458.7 s | 0.49 cores (12 %) | 1.55 GB | 917.5 s |

1. **The 20 slowest files are not CPU-bound as a set.** Serially they use **0.49 of a core**: more than half
   of their wall time is spent waiting (children, pipe I/O, sleeps, fs). Running them at 3 workers gives
   **2.80×** (921.1 → 329.2 s), i.e. 93 % of the ideal 3× — concurrency is nearly free because each file
   leaves cores idle. Memory is flat (1.49–1.55 GB), so they are **not memory-bound** either.
2. **Individually some are CPU-bound.** The adversarial walk loop alone is 95 % CPU (118 s CPU / 124.5 s
   wall after removing the pace sleep), mostly system time in spawn+landlock. So the correct statement is
   per-file, not per-set: the *spawn storms* are syscall-bound (CPU), the *merge-gate instrument* is
   subprocess-wait-bound, and the mass of small files is import-bound.
3. **Concurrency inflates each heavy file.** `a4p7` 140.8 s alone → 157.5 s at 3 workers → **204.9 s** in the
   full capture (+45 %); adversarial 154.7 → 184.8 → 195.1 s (+26 %). Total work inflates ~16 % under load
   (top-20 Σ 917.5 s alone vs 1065 s in the full capture). That is contention, not a leak.
4. **The worker ceiling is the binding constraint, and it is set one below the core count.**
   3 workers = 2.42–2.46× of a possible 3×; **4 workers on the same 4 CPUs = 3.34×** (1088.7/326.2) — the
   3-worker configuration leaves the fourth CPU for the orchestrator *while the workers are idle waiting*,
   which is exactly the wrong trade for a wait-heavy population. This is measured twice (cold 470.4 s,
   warm 428.3 s) against the same warm 4-worker run (326.2 s) and the 4-worker arm did **more** test work
   (1088.7 s vs 1062.7 s) while finishing **102 s sooner**.

## 6. Build reuse: verdict

Full detail in `build-reuse.txt`.

**Determinism: yes, byte-for-byte at a fixed path.** Two builds of the same pinned tree, the second after
deleting all 334 ignored build-output directories plus `.dsh-build/` and both `.tsbuildinfo` files, produce
the **same tree digest** `867f80307366b080b89206e97a3d3dc6a3cfa8453b023b46e73b7f0c1faf79a9` over 25 568
files (0 diff lines). Clean rebuild costs **161.5 s wall / 209.1 s user / 24.7 s sys, 4.06 GB peak RSS**;
the hosted step is **216 s** and also carries `pnpm install --ignore-scripts` (measured **6.85 s** against a
warm store in a fresh clone — the install is the small part).

**Path-independence: no.** 49 built files embed the build tree's **absolute** path (e.g.
`dsh-css:/home/…/tests/deepseek-harness-test-use/packages/client/locale/src/client/LanguageRow.module.css.mjs`).
A *copy* keeps the same digest and **runs from a new path** (`--version` → `0.2.0-rc.2`; a real `web` boot on
port 3198 printed `dsh web: http://127.0.0.1:3198/?token=…` and served HTTP 401 without a token, i.e. it
was up), but a **rebuild at a different path would produce different bytes** in those 49 files.

**Verdict: a trusted cache is safe if, and only if, it is keyed on host identity and restored to the same
absolute path.** `scripts/host-cache-key.mjs` already defines exactly the right identity
(`host_commit`, `host_lock_digest`, `toolchain_config_digest`, `platform`, `node_version`, `pnpm_version`,
`host_build_flags_digest`) plus a record/verify manifest, and is deliberately **not wired**. Restoring
2.3 GB took 21.3 s locally (`rsync -a`), which bounds the restore side of the 216 s.

What would make it **unsafe**: (a) restoring to a different absolute path and trusting a manifest recorded
at the old one; (b) omitting node/pnpm/flags/lock from the key (all change output bytes); (c) reading
"manifest verifies" as "the build ran from this commit" — it proves byte equality with a recorded
identity, not provenance; (d) caching the product build, which would delete the
`check-artifacts-committed.mjs` freshness check rather than the build. Every failure mode above is
**fail-closed** in the existing design (a mismatch is a named MISS/refusal, never a green).

## 7. Ranked candidate experiments

Saving model used for the projections: capture wall ≈ `max(longest file, worker-time / P)` with the
**measured** `P = 2.46` at 3 workers and `3.34` at 4 (both measured on the same tree, §5). Per-job savings
are ×2 because the job runs two captures serially. "Confidence" is stated as the range the two measured
captures/local runs bound, not a statistical interval — n is small and the memo says so.

| rank | experiment | what exactly changes | expected saving per job | confidence | what could silently weaken verification | how completeness is still proven |
| ---: | --- | --- | ---: | --- | --- | --- |
| 1 | **Lift the worker ceiling to 4** | add `--maxWorkers=4` to `censusVitestArgv` (one token in `scripts/census-invocation.mjs`); nothing else | **−204 s** (measured 428.3 → 326.2 s per capture, −24 % of the capture; −21 % of the 966 s census step) | ±10 % (two 3-worker arms vs one 4-worker arm, same tree, same 4 CPUs; the 4-worker arm did *more* test work) | none to *what* is asserted — same 705 files, same 22 tasks, same assertions; risk is timing-sensitive tests flaking under more contention (locally 2–3 failures in both arms, all environment-shaped) | plan/aggregator unchanged: 22 tasks, 705 files, 9 213 assertions per capture, `census-plan`/`census-aggregate` still refuse on any count mismatch |
| 2 | **Cache the pristine host build** | wire the existing `host-cache-key.mjs` record/verify around an `actions/cache` entry keyed on the host identity; restore to the same path; verify before trusting | **−176 s** (216 s step − ~40 s restore; restore measured 21.3 s locally for 2.3 GB, hosted download slower) | −150…−206 s | a stale/foreign artifact restored as the pinned host — closed by the existing `git rev-parse HEAD == pin` + `bin.js exists` + porcelain-empty assertions, plus the manifest verify; provenance is not proven by the manifest (stated) | untouched: the census still boots the same pinned host, and `host_sha`/`build_digest` in the plan identity would move if the host did |
| 3 | **Move `a4p7`'s nested CI legs out of the census** | stop re-running lint / lint-visibility / `check-artifacts-at-head` / `pnpm -r typecheck` / client lane *inside* `a4p7-merge-gate.test.ts`; they already run as `pr-gate` legs on the same tree | **−154 s** (190 s of nested legs per capture / 2.46) | −120…−160 s | **high**: those are the only end-to-end invocations of those instruments; removing them means a broken instrument is no longer caught by the census | the census still proves the *population*; the instrument-completeness proof would move entirely to `pr-gate`, so the census's own claim shrinks — must be disclosed as a scope change, not sold as perf |
| 4 | **Dial the race storm in the census only** | set `A5GLB_RACE_WALKS=1200` (and keep the 6 600-walk run as the lane's hard gate) on the census invocation | **−92 s** (154.7 → 41.8 s measured; /2.46 ×2) | −70…−95 s | the census would exercise the race at 1/5.5 scale; the test already appends the dial to its own name so a dialled run cannot be quoted as the hard gate — but if nothing else runs 6 600, the hard gate disappears | same files/assertions; only the negative-control *scale* drops, and the leg name records it |
| 5 | **File-level shard of the heavy glob family into a second job** | new job/matrix entry running the 5 heavy glob files; main census drops them | **−426 s** (model: main 637 s of work/2.46 = 259 s per capture → 518 s; shard 520/2.46 = 211 s → 422 s; the two jobs run in **parallel**, so the census wall becomes the slower one (518 s) + fixed cost, vs 966 s) | low (±30 %, **not measured**; needs the host cache to avoid paying 216 s twice) | weakening: sharded set must still union to the exact 22-task population; a mis-split silently drops files | `census-aggregate.mjs` already refuses unless `multiset_union(shards) == plan` with per-result identity — it was built for exactly this and is the reason this is even a candidate |
| 6 | **Run the two captures concurrently** | change the capture-pair group from 2 serial captures to 2 parallel | **≈−300 s** (model only) | **very low, not measured**; spec §1 forbids assuming losslessness | the *only* thing the second capture buys (same population, later in time) is destroyed; two captures × 3 workers contend for 4 CPUs and would each inflate like §5.3 | not provable by the current plan: the capture pair is one indivisible group precisely because this is unproven |

**Not on the list, deliberately.** Root-level sharding (already measured and rejected: +294 s at K=2, +882 s
at K=4); raising `testTimeout`; making the 592 sub-100 ms files faster (~0.2 % of the work per 100 such files);
trimming fixture copies / worlds (34 + 74, not a lever).

**The cheapest correct combination** is 1 + 2: **−380 s of 1226 s (31 %)**, taking the job to ~14 m, with
**no change to what the census verifies**. Add 3 and/or 4 only as explicitly disclosed scope decisions.

## 8. Reproduction

Run from `docs/plans/memo/perf-diag-20261115/` (every path below is relative to it), with the
worktree root as the checkout under test:

```bash
# hosted per-file profile (the census uploads the transcript that carries it)
gh run download <run-id> -D art -n census-runtime-transcripts-<run-number>
node tools/perf-diag-census-profile.mjs \
  --transcript art/census-transcripts/census-capture-1.txt \
  --capture-seconds 477.7 --checkout . --tsv capture1.tsv

# local capture with per-file timings from the JSON report (4-CPU emulation, as the census runs it)
CI=true taskset -c 0-3 /usr/bin/time -v ./node_modules/.bin/vitest run \
  --reporter=default --reporter=json --outputFile.json=.artifacts/tmp/cap.json \
  --testTimeout=90000 --maxWorkers=3
node tools/perf-diag-census-profile.mjs --vitest-json .artifacts/tmp/cap.json --capture-seconds 470.4

# attribution: spawns / fired timers / worlds, per test file (inert unless PERFDIAG_TRACE_OUT is set)
PERFDIAG_TRACE_OUT=$PWD/.artifacts/tmp/trace.ndjson \
NODE_OPTIONS="--require $PWD/tools/perf-diag-capture-trace.cjs" \
  CI=true taskset -c 0-3 pnpm exec vitest run --reporter=default --maxWorkers=3
PERFDIAG_TRACE_TSV=.artifacts/tmp/trace-per-file.tsv \
  node tools/perf-diag-capture-trace.cjs --summarize .artifacts/tmp/trace.ndjson
```

Both scripts have `--self-test` / a documented inert mode, write only the paths they are given, and neither
is imported by any product, gate or workflow file. They live under `docs/` on purpose: `eslint.config.mjs`
ignores `docs/**` (a named prefix), so the profiling tools cannot shift the lint-identity census or need a
new `scripts/eslint-node-globals/<NNN>-<family>.json` registration — which is the same reason the merge-gate
instrument's own scratch trees are invisible to lint.

## 9. What this round did NOT change

No workflow file, no Required context, no concurrency group, no gate, no `packages/**`, no
`docs/TEST_METHODS.md` / `docs/ROUTER_RULES.md`, no census plan/aggregator. The two scripts are new,
read-only, and unreferenced. The instrumentation is a `NODE_OPTIONS` preload used only for the local
measurement above; it is inert unless its env var is set, so it is kept rather than reverted.

The two tools were first written under `scripts/`, and that alone turned the census's own lint leg red
(`a4p7-merge-gate`'s "identity diff against the named baseline" subtest failed locally with them present).
Moving them under `docs/` fixes it, and that is verified, not assumed: with this commit applied,
`node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt`
prints `76 distinct; new 0, resolved 0` (exit 0). A measurement round must not move the census it measures.

## 10. UNKNOWN / not measurable on this host

| item | status | why / what bounds it |
| --- | --- | --- |
| A census run **at the base commit `6aba7365f`** | **measured, via an identical tree** | run 1215's head tree is `8b10651a` = the base tree; the local capture agrees to 0.1 % on Σ file work |
| **Per-file CPU time** (as opposed to wall) | **UNKNOWN** | `/usr/bin/time` gives whole-run user+sys only; per-file attribution would need `--cpu-prof` per worker, not attempted. Bounded by the whole-run ratios in §5 |
| **Per-spawn cost under load** | **partially** | measured 8.5 ms idle and ~15.3 ms marginal per walk (which includes the walk). Not decomposed into fork/exec vs landlock vs enumeration |
| **Timer attribution** | **partial** | 83 % of fired-timer ms is raised from a non-test frame (async continuation); attributed to that frame, not to a file. `timers/promises` sleeps are **not** counted at all (ESM binding cannot be replaced) — the 95.3 s is a **lower bound** |
| **Actual `ubuntu-latest` size** | external | the workflow does not state it; 4 vCPU / 16 GB is GitHub's standard size, not a repo claim. If the runner is larger, `maxWorkers` (and experiment 1's headroom) is larger too |
| **Hosted cache restore time for 2.3 GB** | **UNKNOWN** | locally `rsync -a` of the built tree = 21.3 s; a `actions/cache` download on the runner was not measurable here. Experiment 2's saving is bounded by that unknown |
| **Whether 4 workers transfer to the hosted runner** | **UNKNOWN (bounded)** | measured on 4 pinned logical CPUs of a 16-CPU host, which is *weaker* contention than 4 real vCPUs under a shared hypervisor; direction should transfer, magnitude may shrink |
| **6+ workers / higher `maxWorkers`** | **not measured** | CPU utilisation at 4 workers is only 2.29 of 4 cores, so more workers might help further, but the two ~200 s files put a hard floor near 210 s/capture; memory at 4 workers was 2.16 GB of 16 GB |
| **Per-run variance of the hosted job** | **not measured now** | the M6 memo's 5 green runs span 1325–1495 s for this job, and run 1215 is 1226 s (fast end); n = 1 for the per-file data here |
| **Whether the second capture is lossless to drop** | **UNKNOWN by design** | `census-plan`/spec §1 forbid assuming it; experiment 6 is listed precisely because it is unproven |
| **Flakiness under a 4-worker census** | **UNKNOWN** | local runs showed 2–3 environment-shaped failures in every arm; a hosted A/B would be needed before switching |
