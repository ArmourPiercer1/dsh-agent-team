# PERF-RANK1 2026-11-16 — census `maxWorkers` 3 → 4, as its own revertible PR

> Dated: 2026-11-16 · Status: **one-line performance change; LOCAL MEASUREMENT ONLY** ·
> Branch `task/perf-rank1-20261116` off `origin/master` @ `b0f5eb4e3` (tree `b1d934c2f`)
> Parent: `docs/plans/memo/perf-diag-20261115/README.md` (merged as #778) — rank 1, and **only**
> rank 1. Ranks 2–6 (host build cache, dropping checks, shrinking the walk race, sharding,
> concurrent captures) are explicitly out of scope and untouched.

## 0. The change

The census `vitest` invocation now names its worker ceiling: **`--maxWorkers=4`**.

- **Where**: `scripts/census-invocation.mjs`, the one module that builds the census argv for both
  the census leg of `scripts/ci-pr-gate.mjs` and every task of the census plan
  (`scripts/census-plan.mjs`). The workflow and the manifest do not carry a second copy of the
  number, so `dispatch-tests --check`, `eb3-ci-required`, the plan's `runner.argv` and the census
  invocation cannot drift apart.
- **What it replaces**: there was no literal `3` to edit. Before this PR the invocation carried no
  `--maxWorkers` at all, and vitest's default (`availableParallelism() - 1`) is **3** on the
  4-vCPU hosted runner — the ceiling the perf-diag memo measured and recommended lifting. This PR
  makes that effective value explicit at 4 in the same single source of truth.
- **What does not change**: one `vitest run` over the whole 705-file population; 11 roots; two
  serial captures in capture-major order; the reporters and JSON report path; the optional
  `--testTimeout`; the timeouts, retries, assertions, the 6600-walk race test and the flock test;
  the Required contexts; the workflow argv (`--census-execution plan --census-captures 2
  --census-test-timeout 90000`); the census population baseline. `--maxWorkers=4` is appended to
  the argv, so no existing flag changes position.

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

`taskset -c 0-3` emulates the 4-vCPU hosted runner: `availableParallelism()` on that affinity is 4,
so the **before** arm's implicit vitest ceiling is 3. The **before** arm stashed only
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
  −138.6 s per capture. Both captures ran, both arms; this is not a one-capture extrapolation.
- Peak RSS rose by ≈ 381 MB (1.77 → 2.13 GiB), well under a 16 GiB hosted runner, but that limit
  is **not** measured here.
- Assertion parity: 9233 per capture in both arms. The task brief's 9213 is the perf-diag base
  tree; current `origin/master` carries #779 (M7-A testkit tests), which is +20 assertions on the
  same 705 files / 11 roots. This PR changes neither the population nor the assertion set.
- CPU time: 190% of a core (before) vs 231% (after); the extra worker keeps more of the 4 CPUs
  busy while files wait on children / pipe I/O. This is the mechanism the memo predicted.

### One failure, identical in both arms (environment, not this change)

The plan-mode aggregate returned `verdict=FAIL` in **both** arms, with the same single failed test:
`packages/runtime/test/a5sf-os-runner.test.ts > refuses a network-deny policy when the backend
cannot enforce it (no bare process)` — it expects `ENFORCEMENT_UNAVAILABLE`, but this local host's
provisioned Landlock launcher *does* enforce the policy, so the negative control observes
`ok: true`. The plan aggregate then reports `SHARD_EXIT_NONZERO,TASK_STATE_INCOMPLETE,TASK_STATE_FAIL`
because one root failed. This is a difference between this sandbox (native sandbox assets
provisioned) and a fresh CI checkout (assets absent, backend unusable); it is present before and
after, so it does not affect the timing comparison, and this PR does not claim a green local census.
The hosted L2 is the first place the census will run with the runner's own environment.

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

Revert this PR if the hosted L2 shows **any** of:

1. any added flakiness or failure — a new red identity, a failed capture, a refused leg, or a
   retry that did not exist at 3 workers;
2. peak memory approaching the runner limit (the job's own measurement; local peak was 2.13 GiB);
3. less than a **~60 s** improvement across the census job (the job-level delta, not one capture).

Exact revert, after the merge commit exists:

```bash
git revert --no-edit <this PR's merge/squash commit>
```

If the PR is merged as the single commit on this branch, `<this PR's merge/squash commit>` is that
commit; the revert restores the invocation with no `--maxWorkers` and therefore the previous
effective ceiling of 3. No other file is touched, so the revert cannot collide with a later
change except on the argv line itself.

## 4. Gates run locally on this branch

`dispatch-tests --check` PASS (18 legs), `eb3-ci-required` PASS (10 workflows, 0 findings),
`test-catalog --max-uncollected 91` exit 0 (91 uncollected, digest
`sha256:5f71c543…`), `census-plan.test.mjs` 50/50 pass, `docs-sync --check` 0 findings,
`lint-identities --diff …/lint-identities-0237d487.txt` → `new 0, resolved 0`.
