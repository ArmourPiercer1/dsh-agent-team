# eng-evidence-budget-20261113 — raw measurements

> Regenerate with §2. Nothing here is hand-edited.

## 1. Per-PR additions (last 30 first-parent commits on origin/master)

```
evidence-budget commits: n=30 total=385.2 KiB p50=7.4 KiB p90=38.3 KiB max=55.4 KiB cap=2.0 MiB over_cap=0
DSH-EVIDENCE-BUDGET mode=commits n=30 p50=7591 p90=39197 max=56747 cap=2097152 over_cap=0
```

Full per-commit list: `commits.txt`.

## 2. Accumulation (top-level evidence directories)

```
evidence-budget dirs: n=413 total=151.0 MiB p50=52.0 KiB p90=982.2 KiB max=6.5 MiB cap=2.0 MiB over_cap=26
DSH-EVIDENCE-BUDGET mode=dirs n=413 p50=53219 p90=1005739 max=6864647 cap=2097152 over_cap=26
```

`n=413` includes this evidence directory itself (created before the run). Full top-20 list: `dirs.txt`.

## 3. Reading

- The 2 MiB/PR cap in M5 **never binds**: the worst of the last 30 commits added 55.4 KiB.
  It is a guard against accidents, not a lever on PR cost.
- Accumulation is the real number: 151.0 MiB across ~10k files, largest directory 6.5 MiB.
  Under "1 task = 1 worktree" that weight is paid on every worktree creation.
- No evidence was deleted, moved or compressed. Archival is an owner decision (memo §2 E3).

## 4. Reproduce

```bash
node --test scripts/evidence-budget.test.mjs          # 8/8
node scripts/evidence-budget.mjs --self-test          # 5/5
node scripts/evidence-budget.mjs --commits 30         # per-PR distribution
node scripts/evidence-budget.mjs --dirs --top 20      # accumulation
```

## 5. Limitations

- `--commits` measures **added** bytes in the commit's diff (numstat), not the final on-disk size of the
  touched files; a commit that only deletes evidence measures 0.
- Squash merges are first-parent commits, so the unit is "what landed per PR", which is the intended unit.
- `--dirs` counts regular files only; symlinks and unreadable files are skipped rather than guessed.
- Sizes are bytes, not disk blocks; the filesystem view can differ by block rounding.
