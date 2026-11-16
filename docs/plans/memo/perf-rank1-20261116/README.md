# PERF-RANK1 2026-11-16 — census `maxWorkers` 3 → 4, as its own revertible PR

> Dated: 2026-11-16 · Status: **one-line performance change; LOCAL MEASUREMENT ONLY** ·
> Branch `task/perf-rank1-20261116` off `origin/master` @ `b0f5eb4e3` (tree `b1d934c2f`)
> Parent: `docs/plans/memo/perf-diag-20261115/README.md` (merged as #778) — rank 1, and **only**
> rank 1. Ranks 2–6 (host build cache, dropping checks, shrinking the walk race, sharding,
> concurrent captures) are explicitly out of scope and untouched.

## 0. The change

The census `vitest` invocation now names its worker ceiling: **`--maxWorkers=4`**.

- **Where**: `scripts/census-invocation.mjs`, the one module that builds the census argv for all
  three callers: the full capture in `scripts/ci-pr-gate.mjs`, that leg's **single-file load-family
  re-sample** (previously an inline argv at `ci-pr-gate.mjs:2174` with no `--maxWorkers`), and every
  task of the census plan (`scripts/census-plan.mjs`). The workflow and the manifest carry no second
  copy of the number, so `dispatch-tests --check`, `eb3-ci-required`, the plan's `runner.argv` and
  both gate invocations cannot drift apart.
- **What it replaces**: there was no literal `3` to edit. Before this PR the invocation carried no
  `--maxWorkers` at all, and vitest's default (`max(availableParallelism() - 1, 1)`) was **3** on
  the measured 4-CPU shape — the ceiling the perf-diag memo measured and recommended lifting. This
  PR makes that effective value explicit at 4 in the same single source of truth.
- **Not derived from a core count**: the hosted runner's shape is an external assumption, not a fact
  this repo owns (`pr-gate.yml` also describes a 2-core hosted runner). The invocation therefore
  does not compute 4 from `availableParallelism()`; instead every gate run logs
  `available_parallelism=<n> workers=4` on its `DSH-CI-RUN` line, so each L2 states the machine's own
  number and the ceiling can be judged against it.
- **What does not change**: one `vitest run` over the whole 705-file population; 11 roots; two
  serial captures in capture-major order; the capture's reporters and JSON report path; the optional
  `--testTimeout`; the timeouts, retries, assertions, the 6600-walk race test and the flock test;
  the Required contexts; the workflow argv (`--census-execution plan --census-captures 2
  --census-test-timeout 90000`); the census population baseline. `--maxWorkers=4` is appended to
  the argv, so no existing flag changes position. The **re-sample's** reporter set did widen — it
  gained `--reporter=default` — while its graded source (the JSON report) did not, so it cannot move
  an assertion or a verdict.

## 1. What was measured, and how

Full two-capture census, **both arms on the same tree**, using the exact CI invocation from
`.github/workflows/census-runtime.yml`:

```bash
taskset -c 0-3 env CI=true node scripts/ci-pr-gate.mjs --full \
  --only census \
  --census-execution plan \
  --census-captures 2 \
  --census-test-timeout 90000 \
  --store-dir .artifacts/pnpm-store \
  --transcript-dir .artifacts/perf-rank1/transcripts-<arm>
```

`taskset -c 0-3` emulates a 4-CPU runner: `availableParallelism()` on that affinity is 4, so the
**before** arm's implicit vitest ceiling is 3. The arm headers below say "3 workers"/"4 workers",
which is the effective test-file concurrency, not a claim about the hosted runner's real core count.
The **before** arm stashed only
`scripts/census-invocation.mjs`; the **after** arm is the PR's tree. The pristine host
(`tests/deepseek-harness-test-use`) was a local copy of a built, porcelain-clean checkout at
`639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2); the repo was built with
`pnpm install --frozen-lockfile` + `pnpm run build` + `pnpm build:composition`.

**Machine shape**: Linux 6.18.33.2-microsoft-standard-WSL2 x86_64; AMD Ryzen 7 9700X (8 cores /
16 threads, 16 logical CPUs visible); 30 GiB RAM; Node v24.21.0; pnpm 11.7.0. The census process
tree was restricted to CPUs 0–3 for both arms.

### Before — implicit 3 workers (baseline tree, change stashed)

| | capture 1 | capture 2 | census leg |
| --- | ---: | ---: | ---: |
| wall (vitest `Duration`) | 473.95 s | 481.50 s | **958.3 s** |
| test bodies | 1180.55 s | 1138.40 s | 2318.95 s |
| import | 144.61 s | 196.16 s | 340.77 s |
| transform | 18.18 s | 20.14 s | 38.32 s |
| assertions (executed / total) | 9233 / 9233 | 9233 / 9233 | 18466 / 18466 |
| files / roots | 705 / 11 | 705 / 11 | — |
| test-body parallelism | 2.49× | 2.36× | — |
| peak RSS (whole process tree) | — | — | **1,853,672 KiB ≈ 1.77 GiB** |

### After — explicit 4 workers (this PR)

| | capture 1 | capture 2 | census leg |
| --- | ---: | ---: | ---: |
| wall (vitest `Duration`) | 336.83 s | 340.64 s | **681.4 s** |
| test bodies | 1114.57 s | 1158.40 s | 2272.97 s |
| import | 148.02 s | 131.86 s | 279.88 s |
| transform | 18.92 s | 14.86 s | 33.78 s |
| assertions (executed / total) | 9233 / 9233 | 9233 / 9233 | 18466 / 18466 |
| files / roots | 705 / 11 | 705 / 11 | — |
| test-body parallelism | 3.31× | 3.40× | — |
| peak RSS (whole process tree) | — | — | **2,234,468 KiB ≈ 2.13 GiB** |

- **Measured delta: 958.3 s → 681.4 s = −276.9 s (−4 m 37 s) on the census leg**, about
  −138.45 s per capture (276.9 / 2). Both captures ran, both arms; this is not a one-capture
  extrapolation.
- Peak RSS rose by **380,796 KiB = 372 MiB ≈ 390 MB** (1.77 → 2.13 GiB). The local machine has
  30 GiB; the hosted runner's limit and its peak are **unmeasured**, so no hosted memory conclusion
  is drawn.
- **Why the before arm is 473.95 s, not the perf memo's 428.3 s**: that memo number is a *warm*
  full capture from an earlier tree (its base predates #779) on its own machine. This is a fresh
  before/after pair on the same `origin/master` tree, same machine, same caches order; comparing
  the two is the A/B, not reproducing the memo's absolute table.
- Assertion parity: 9233 per capture in both arms. The task brief's 9213 is the perf-diag base
  tree; current `origin/master` carries #779 (M7-A testkit tests), which is +20 assertions on the
  same 705 files / 11 roots. This PR changes neither the population nor the assertion set.
- CPU time: 190% of a core (before) vs 231% (after); the extra worker keeps more of the 4 CPUs
  busy while files wait on children / pipe I/O. This is the mechanism the memo predicted.

### One failure, identical in both arms (environment, not this change)

The plan-mode aggregate returned `verdict=FAIL` in **both** arms, with the same single failed test:
`packages/runtime/test/a5sf-os-runner.test.ts > refuses a network-deny policy when the backend
cannot enforce it (no bare process)` — it expects `ENFORCEMENT_UNAVAILABLE`, but this local host's
netns leg returns **`NET-DENY-CONFIRMED`** (`packages/runtime/sandbox-provider/probe-abi.ts:441-491`,
`network.ts:60/229`): the confined child can create its own `CLONE_NEWUSER|CLONE_NEWNET` pair, so
the provider reports an enforceable network-deny and the negative control observes `ok: true`. This
is not "the Landlock launcher enforces a network policy"; it is the netns mechanism being available
in this sandbox. A fresh CI checkout without the provisioned launcher is expected to take the
refusal arm. The plan aggregate then reports
`SHARD_EXIT_NONZERO,TASK_STATE_INCOMPLETE,TASK_STATE_FAIL` because one root failed. The condition is
present before and after, so it does not affect the timing comparison, and this PR does not claim a
green local census. The three pre-PR hosted L2 runs cited in §3 already ran this plan-mode census
(22 tasks / 11 roots / 705 files, `aggregate=PASS`) with the runner's own environment; this PR's L2
adds the 4-worker arm.

## 2. What remains unmeasured

- **Hosted stability at 4 workers.** Every number above is local, on one machine, under a CPU
  affinity mask pretending to be the runner. Whether the 4th worker adds flakiness, changes the
  disclosed-red identity set, or behaves differently on a cold hosted checkout is **UNKNOWN**.
  This PR's own L2 (`census-runtime` on a ready PR) is the measurement.
- **Hosted peak memory.** The local tree peaked at 2.13 GiB; the runner limit and the hosted peak
  are not measured.
- **Hosted wall-time improvement.** The −276.9 s local figure is a model, not an achieved hosted
  number. The hosted job may improve less (or more); no extrapolation is claimed.

## 3. Rollback criterion (and the exact revert command)

**Hosted peak memory is unmeasured.** `census-runtime.yml` has no RSS / `free` / `/usr/bin/time`
hook, so there is no L2 memory number to decide on; the local 2.13 GiB is context, not a criterion.
If memory needs to become one, the workflow must first grow a real measurement step.

**The baseline is the current-config pre-PR plan-mode census.** Three hosted `ci-census` /
`census-runtime` legs on `master` before this PR, each 22 tasks / 11 roots / 705 files / 9233
assertions per capture, `aggregate=PASS`:

| run | `DSH-CI-LEG leg=census` | captures |
| --- | --- | --- |
| 43764507382 (#1231) | `verdict=pass seconds=1096.7` | 554.53 + 538.01 s |
| 43767865055 (#1232) | `verdict=pass seconds=1107.5` | 561.09 + 542.29 s |
| 43804251634 (#1238) | `verdict=pass seconds=1107.4` | 560.67 + 542.68 s |

Fetch path: `gh run download <id> -n census-runtime-transcripts-<run>`, then read
`_temp/census-run.txt` (`DSH-CI-VERDICT … seconds=`, `DSH-CI-LEG leg=census`) and
`_temp/census-transcripts/census-capture-{1,2}.txt` (the `Duration` lines). The same-config spread
is **10.8 s** (1096.7–1107.5 s, about 1 %), so a ~60 s threshold is roughly 5.5× the spread and is
a meaningful bar, not an inconclusive one.

**Do not use the perf memo's 966 s as this baseline.** That is run 1215's census-leg token on the
memo's pre-#779 base tree (head `1f7725663`, tree `8b10651a`) — a different tree and run. The
current config's hosted band is 1096.7–1107.5 s. Both are the same token (`DSH-CI-LEG
leg=census seconds=`); the difference is the measurement occasion, not a different definition, and
the local A/B in §1 is not this baseline either.

Revert this PR if the hosted L2 shows **any** of:

1. **any added flakiness or failure** — a new red identity, a failed capture, a refused leg, or a
   retry that did not exist at 3 workers. The first two files to inspect are
   `packages/runtime/test/alpha5-glob-backend-adversarial.test.ts` (the 6600-walk storm; it
   describes itself as a "good neighbour in a shared pool" and is paced because it tips another
   lane's BOUNDED polls) and `packages/runtime/test/a5lsp2-assembly.test.ts` (records those legs
   going red on a CI runner twice, which is why it carries a 30 s ceiling and forensics). Both are
   in the population and are the most likely neighbours to feel a fourth worker.
2. the PR's census leg is **not at least ~60 s faster than the 1096.7–1107.5 s band** (i.e. it
   should be at most ~1036.7 s to count as an improvement). Report the PR's leg against all three
   baselines. A result inside ±11 s of the band is run-to-run noise, not an improvement.

Exact revert. `master` squash-merges, so the branch commit is not on `master`; revert the squash
commit:

```bash
git revert --no-edit "$(gh pr view 782 --json mergeCommit --jq .mergeCommit.oid)"
```

If `gh` is unavailable, the same commit is the one whose subject carries this PR number:

```bash
git revert --no-edit "$(git log origin/master -1 --format=%H --grep='#782')"
```

The revert restores the invocation with no `--maxWorkers` and therefore the previous effective
ceiling; no other file is touched, so it cannot collide with a later change except on the argv
line itself.

## 4. Gates run locally on this branch

`dispatch-tests --check` PASS (18 legs), `eb3-ci-required` PASS (10 workflows, 0 findings),
`test-catalog --max-uncollected 91` exit 0 (91 uncollected, digest
`sha256:5f71c543…`), `census-plan.test.mjs` 50/50 pass, `docs-sync --check` 0 findings,
`lint-identities --diff …/lint-identities-0237d487.txt` → `new 0, resolved 0`.
