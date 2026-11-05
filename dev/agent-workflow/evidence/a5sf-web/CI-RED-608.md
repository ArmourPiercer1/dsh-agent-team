# PR #608 red: diagnosis (2026-11-05)

Six required checks failed fast (13–43 s) on head `93b9916c3`. **One root cause, two
symptoms, neither in this branch's product delta.** Every number below is from the job
logs (`gh api repos/…/actions/jobs/<id>/logs`), not from a re-reading of the scripts.

| Check | Job | Failing line |
| --- | --- | --- |
| `pr-gate` | 127301937991 | `FAIL STALE_GENERATED_VIEW: out of date; run --write` |
| `ci-fast` | 127303509411 | `FAIL STALE_GENERATED_VIEW: dev/engineering/current-state.json does not match registry+git; run pnpm docs:sync --write` |
| `ci-integration` | 127303509445 | `FAIL STALE_GENERATED_VIEW: out of date; run --write` |
| `ci-product` | 127303509521 | `DSH-CI-LEG leg=state-freshness verdict=fail … Q4: baseline 1484fa4ee… is neither HEAD nor an ancestor of HEAD` |
| `census-runtime` | 127303509934 | `PIN PRECHECK FAIL: authority.baseline=1484fa4ee… exists but is NOT an ancestor of HEAD=f8062d837…` |
| `ci-required` | 127304613788 | red because the five layers above are red (no independent finding) |

`PR_BASE_SHA` was **not** empty — the line quoted in the hand-off is the script body;
the step's own env shows `PR_BASE_SHA: e78bfd8aff83fe2f6fa34c1452ad5c4e8eae218c`.
`docs:sync --check` failed **before** `docs:probe` ran (`set -euo pipefail`).

## Root cause

`#607` (`e78bfd8af`, the new base) landed authority snapshot `as20261105r2`, whose
`baseline` is `1484fa4ee0ff9326a3dafcac060bf63f8d334a1f` — a commit on
`task/a5sf-candidate1-20261106`. `#607` did **not** merge that branch, so the pinned
baseline is not an ancestor of master or of any PR that merges master.

Two independent gates grade that ancestry:

1. `state-freshness` Q4 and the census `PIN PRECHECK` refuse a HEAD whose pinned baseline
   is unreachable.
2. `docs:sync --check` regenerates `dev/engineering/current-state.json`, whose
   `baseline_is_ancestor_of_head` is computed from the checkout. `#607` committed the view
   as `true` (it was generated on the candidate branch); on master the same generator
   computes `false`, so the committed view is "stale" against its own source.

`#607` is therefore red on master itself: `node scripts/docs-sync.mjs --check` at
`e78bfd8af` in a clean detached worktree reports the same `FAIL STALE_GENERATED_VIEW`
(verified 2026-11-05 in `.worktrees/tmp-master-check`, removed afterwards).

## Fix

A content-free merge of the baseline branch into this branch:

```
ab88018f7 Merge the CANDIDATE-1 baseline branch (content-free) to satisfy the authority pin
```

`origin/task/a5sf-candidate1-20261106` has a **byte-identical tree** to master `e78bfd8af`
(both `84ea9d8a`), so the merge changed no file:

```
tree before merge: 3d51cd0b959ccef6de3a6770efd30804e2448d73
tree after  merge: 3d51cd0b959ccef6de3a6770efd30804e2448d73
```

It only makes `1484fa4ee` an ancestor of HEAD, which is exactly what the pin demands. No
preset, no `product-assembly.ts`, no workflow, no upstream file is touched. The product
delta of the PR is unchanged: the row forwarding (`compiled.web` + `a5sfWebFace`) and its
arms/evidence only.

The branch was also **behind** `origin/master`: its local `origin/master` ref still pointed
at `a5bd88b85` when the worktree was cut, while the remote had moved to `e78bfd8af`
(`#607`). The branch now contains both `e78bfd8af` and the candidate baseline.

## Local re-grade at `ab88018f7`

| Leg | Verdict |
| --- | --- |
| `graph-parse` | pass |
| `kit-home-guard` | pass |
| `state-freshness` | pass — "a23e5c8f reachable … baseline 1484fa4ee0ff…" |
| `install` | CI pass at `93b9916c3`; local re-run blocked by the sandboxed pnpm store (`[ERR_SQLITE_ERROR] unable to open database file`, then the no-TTY purge guard). No lockfile/manifest file changed on this branch. |
| `blueprint-fence` | pass |
| `typecheck` | pass |
| `lint-identities` | pass — new 0, resolved 0 |
| `artifacts-at-head` | pass — `rev=HEAD verdict=ok compared=1964 drift=0` |
| `docs:sync --check` | pass — findings=0 blocking=0 |
| `docs:probe --base e78bfd8af` | pass — blocking=0 |
| census pin precheck (both pins) | pass — `state_pointers.master_sha=a23e5c8f`, `authority.baseline=1484fa4ee` both ancestors |
| `node --test tests/world-factory/a5sf-*.test.mjs` | pass 323/323 |
| runtime vitest `a5sf-*` + `a5p4-lane-hygiene` | pass 204/204 (14 files) |

Nothing was pushed from this worktree (repo red line); the fast-forward from `93b9916c3`
to `ab88018f7` is the update the PR needs.
