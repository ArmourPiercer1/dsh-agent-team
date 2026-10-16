# Review-REBASE — Alpha.5 PR2 rebase tail delta (`2501308d` chain → `452a04c0..8471ecac`)

- **Reviewer**: independent (≠ writer; rounds 1–6 + this rebase round). Model column: `qwen3.8-flash-next`. Harness (separate): `DeepSeek Harness`.
- **Object**: `8471ecac` = `alpha5-pr2-admission-grant` rebased onto master `452a04c0` (PR1 residual-boundaries, #257). Old chain preserved at `origin/archive/alpha5-pr2-pre-rebase-2501308d` = `c07dea1e`. CI: pr-gate + census = success (cited, not re-run here).
- **Scope**: ONLY the differences the rebase introduced. Everything outside the tail delta was adjudicated in the archived chain (`4f334d43..2501308d` PASS).

## 0. Verdict

**通过 (PASS). 可合并 `8471ecac`.** The rebase touched the lane exactly where it had to: three files, each an adaptation to master-side truth, each independently re-run green. History is marker-clean, the archive chain is intact and byte-faithful, and the scanner tie union is arithmetically and measurably correct (1092).

## ① Conflict-marker audit — 0, independently re-run

Per-commit grep over **all 24 commits** in `452a04c0..8471ecac` (the writer's note says "all 22 commits"; the range holds 24 — my audit covered every one, the discrepancy is under-counting in prose, not a missed commit): **0 commits** add a line matching `<<<<<<<` or `>>>>>>>`. Tree-level scan at `8471ecac` over `packages/**` and the lane evidence dir: **0** line-start markers. The filter-branch claim holds.

## ② Lane content change = exactly 3 files — no boundary crossing

The raw `git diff 2501308d 8471ecac -- packages/` shows 35 files, which must NOT be read naively (master moved). The correct test is **lane-delta equality** across the two bases — old lane `45425a30..2501308d` vs new lane `452a04c0..8471ecac`:

- file sets: **49 = 49, symmetric difference empty**;
- per-file delta patches: exactly **3 differ** — `packages/runtime/test/a5p2-composition.test.ts`, `packages/runtime/tool-admission/README.md`, `packages/testkit/test/p4t6-session-event-scan.test.ts` — precisely the declared three;
- attribution of the other 32 files in the raw diff: for each, `blob(8471ecac,f) == blob(452a04c0,f)` (new head carries pure master content) AND `blob(2501308d,f) == blob(45425a30,f)` (the old lane never touched them). **Zero anomalies** — no lane edit hides in the master noise, no master file was silently held back.

Content check of the three: (1) composition — one call site, two-arg → three-arg `bindInheritedSurface`; (2) README — new C-ADM section (one-sentence deny-admission law) + 三码一表 pointer to `r1a-source-contrast.md` (docs-only, closes exactly my round-5 NIT); (3) p4t6 — adds `SCANNED_PATHS_A5PR1R` (5 named paths) and its term to the two derived sums (docs/test-pin only). Nothing else.

## ③ Composition adaptation is behavior-neutral — 133/133 re-run

`bindInheritedSurface` at master (PR1r R-a) is `(names, resolved, trusted)`; verified-native standing is earned by `trustedIdentity === pinned` (`closed-world-guard.ts:446`). The old signature had no separate trusted side — the passed identities WERE the resolved read — so passing `trusted === resolved` (the honest-native case the comment names) is the semantically identical binding. Measured in a one-shot worktree at `8471ecac`, `--maxWorkers=1`: the 9 targeted suites (same command line as `runs/green-f1f2-full.log`) → **9 files / 133 passed, exit 0**; composition alone **4/4**. Lane stays DORMANT (adaptation touches no production source).

## ④ p4t6 tie union — chain correct, 1092 measured

Independent array counts at the new head: A5PR0 = 18, A5PR1 = 7, **A5PR1R = 5**, A5PR2 = 14 — matching the tie ladder's endpoints (1048→1066→1073, then +5, +14). Derived sums are list-driven (no hand-written total); the post-rebase chain is **1073 + 5 + 14 = 1092**, and the scanner run directly measures **filesScanned = files.length = 1092**. Suite: **10 passed / 10, exit 0**. The PR2 tie comment keeps its historically-measured pair (1087–1073) without renumbering, per this file's own law ("each tie asserts the pair the lane actually moved"); the PR1R block adds its own named list rather than editing anyone's endpoint — the ladder discipline held through the rebase.

## ⑤ Old-chain integrity — provable

`git rev-parse origin/archive/alpha5-pr2-pre-rebase-2501308d` = `c07dea1e…` (tip); `2501308d` **is an ancestor** of it; the archive carries my `review-PR2-f1f2.md` (`git show` verified); and the review-doc commit replayed onto the new chain (`8471ecac`) is **byte-identical in content** to the archived `c07dea1e` (`git diff c07dea1e 8471ecac -- <doc>` = 0 lines). Nothing in the pre-rebase review record was rewritten or dropped.

## Reproduction

```
git worktree add --detach .worktrees/a5-pr2-review-rebase 8471ecac
pnpm install --frozen-lockfile --prefer-offline
pnpm exec vitest run <the 9 suite paths from runs/green-f1f2-full.log> --reporter=verbose --maxWorkers=1   # 133/133
pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts --reporter=verbose --maxWorkers=1 # 10/10
# marker audit: git rev-list 452a04c0..8471ecac | while read c; do git show $c | grep -cE '^\+.*(<<<<<<<|>>>>>>>)'; done  → all 0
# lane delta equality: per-file sha of `git diff 45425a30 2501308d -- f` vs `git diff 452a04c0 8471ecac -- f` → 3 differ
```

One-shot worktree deleted after the runs; `df` line recorded in the review report to the coordinator.
