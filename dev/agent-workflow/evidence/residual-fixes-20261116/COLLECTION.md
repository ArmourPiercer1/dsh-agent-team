# Collection — the two repaired suites ride the existing `tinf-instruments` leg (`48 → 46`)

**Dated:** 2026-11-18 (real UTC, `date -u`). **Branch:** `task/residual-fixes-20261116`.

Both suites were held back by B2 for two *different* reasons, and both were repaired at their
root in this round (§F1, §F5 of `docs/plans/memo/residual-fixes-20261116/README.md`). They are
collected **on those repairs**, not by weakening an assertion.

| suite | host-free? | green? | leg |
| --- | --- | --- | --- |
| `tests/s2-authority/freeze-candidate.test.mjs` | yes — no boot, no port, no DSH_HOME, no pinned tree: `git` + the candidate manifest only (`readHostPin` reads the pin **out of git**, `git show <rev>:tests/paths.mjs`; `HOST_TREE_REL` is a literal string in the manifest, not a read) | 12/12 alone; 120/120 under a 20-way concurrent pool; green in the collected leg | `tinf-instruments` |
| `tests/s2-authority/consumer-candidate.test.mjs` | yes — pure `node` + `git show` of one pinned blob (`scripts/gen-current-state.mjs` at `5f0d0e58`) | 11/11 alone; 40/40 in leg-shaped concurrent runs; green in the collected leg | `tinf-instruments` |

**Why the existing leg and not a new one.** A brand-new dispatch step has no old-side
`node --test` argv at `e5bf05670`, so `--parity` would report it `UNCONVERTED` forever and
`problems` could not be 0 (the M7-A / B2 / B3 precedent, measured there: `problems=1`). The
`tinf-instruments` leg goes **48 → 50** suites.

## 1. The leg, measured

```
$ node --test <50 collected suites>            # host REACHABLE (worktree)
tests 783 · pass 777 · fail 0 · skipped 6      (3m48s)

# same argv, HOST TREE EMPTY (bubblewrap private mount)
tests 783 · pass 777 · fail 0 · skipped 6      (3m49s)
```

Before (the leg + the uncollected consumer suite, host reachable): `tests 782 · pass 775 ·
fail 1`, the failure being `FAIL C10 structure_same=false bytes_same=true`. The collected leg is
the same run with that arm repaired.

Both newly collected files appear green by name in the leg log:

```
✔ tests/s2-authority/consumer-candidate.test.mjs (1555.6ms)
✔ tests/s2-authority/freeze-candidate.test.mjs (4766.8ms)
```

## 2. The host-absent shape — what was and was not reproducible

`scripts/test-catalog` / `findTestRepoRoot()` decides "is the pinned host here?" with
`existsSync(<ancestor>/tests/deepseek-harness-test-use)`. In this session:

- `unshare -m` → `Operation not permitted`;
- `/tmp` is a **per-invocation** tmpfs (a clone written there is gone on the next command), and
  everything outside the workspace is read-only — so a clone cannot be parked where the walk-up
  finds no host tree;
- `bwrap` (bubblewrap) **is** available, so the pinned tree can be covered by an empty tmpfs.
  The **directory node still exists**, so `findTestRepoRoot()` returns the repo root rather than
  `null`; the shape is "host present but EMPTY — no `lib/`, no git" (`findTestRepoRoot => <worktree>`).

That is weaker than the hosted-runner shape (where the directory is absent and the walk-up
returns `null`), and it is stated as such rather than papered over. What it does prove: with no
host content reachable, both suites and all 50 collected suites are green
(`collection-host-absent.txt`), and neither suite names `paths.mjs` / `findTestRepoRoot()` /
`deepseek-harness-test-use` anywhere in its own source.

## 3. Pinned expectations that moved (deliberately, in the same change)

1. `dev/ci/eb3-ci-manifest.json` — `tinf-instruments.suites[]` 48 → 50.
2. `dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt` — regenerated
   **before** the test was touched: `DIFFERS steps=18 old_files=25 new_files=69 problems=0`,
   every row `missing=none`, `added=` names exactly 44 files, union
   `set=sha256:9d56a97244aa89274b578f91d3ed4e687cc7bf434b00e7e9fb5f16f43dbf0704`.
3. `scripts/test-catalog.test.mjs` — the pinned allowed-`added` set grows by exactly these two
   paths (sorted position), and the B2 comment now says they were repaired and collected.
   `node --test scripts/test-catalog.test.mjs` → **26 pass / 0 fail**.
4. `dev/ci/uncollected-baseline.json` — regenerated with
   `node scripts/test-catalog.mjs --write-uncollected-baseline`, **never hand-edited**:
   `uncollected=46`, both paths gone.

## 4. Ratchet

`node scripts/test-catalog.mjs --max-uncollected 46` → `refused=0 findings=0`,
`UNCOLLECTED 46`. `48 − 2 = 46`, and the two are exactly the two repaired suites.
