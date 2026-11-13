# eng-b-proposals-20261113 — raw CI timing data for the B-bucket memo

> Captured 2026-11-13 16:55–17:00 UTC from `origin/master` @ `6361185d8` via the GitHub
> Actions API. Regenerate with §3. Nothing is hand-edited.

## 1. Per-run wall time (ci-required, this window)

| run shape | n | median wall | max |
|---|---|---|---|
| ready (census ran) | 7 | **1435s (23m55s)** | 1493s (24m53s) |
| draft (census skipped) | 7 | **138s (2m18s)** | 184s (3m04s) |

`run-walls.tsv` has one row per run.

## 2. Job durations and queue (median / max, seconds)

| job | n | dur p50 | dur max |
|---|---|---|---|
| `ci-census / census-runtime` | 7 | 1391 | 1453 |
| `ci-product` | 13 | 111 | 142 |
| `pr-gate` | 14 | 110 | 141 |
| `ci-integration` | 14 | 78 | 95 |
| `ci-security` | 14 | 58 | 68 |
| `ci-fast` | 14 | 27 | 44 |

Queue = `started_at - created_at`:

| workflow | jobs | q p50 | q p90 | q max |
|---|---|---|---|---|
| `ci-required` | 109 | 2.0s | 3.0s | 34s |
| `pr-gate` | 29 | 3.0s | 3.0s | 3s |

**The 8h31m `pr-gate` queue recorded for #747 is not reproducible in this window** (max 3s).
It is disclosed in the memo as a historical outlier, not used as evidence for dedupe.

## 3. Reproduce

```bash
raw=dev/agent-workflow/evidence/eng-b-proposals-20261113/raw
gh api "repos/ArmourPiercer1/dsh-agent-team/actions/runs?per_page=40&event=pull_request" \
  --jq '.workflow_runs[] | select(.name=="ci-required") | [.id,.created_at,.head_branch] | @tsv'
# then, per run:
gh api "repos/ArmourPiercer1/dsh-agent-team/actions/runs/<id>/jobs?per_page=50" \
  --jq '.jobs[] | [.name,.created_at,.started_at,.completed_at,.conclusion] | @tsv'
```

## 4. Files

- `raw/runs-pr-gate.tsv`, `raw/runs-ci-required.tsv` — run ids + head branches.
- `raw/jobs.tsv` — every job of those runs (workflow, run id, job, created/started/completed, conclusion).
- `raw/run-walls.tsv` — per-run wall seconds and whether census ran.

## 5. Limitations

- One 5-minute window; runner fleet and queue conditions vary hour to hour. The 23–24 minute census
  figure agrees with the independent L2 measurement in `eng-baseline-20261113`, which is why the memo
  relies on it.
- Job durations include runner startup; step-level breakdown is not exposed by this API, which is
  exactly why B1 (profiling) is proposed before any cache/shard decision.
- Only `pull_request` runs were sampled; `push` runs (master) are not in this window — the repo has no
  L3 census on master, which is one of the facts B5 addresses.
