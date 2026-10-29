# U2 switchover verification — full battery (2026-10-25, commits 56b62dfbe / f44ca07dd / 8552597c3 / bd30dfd07)

## Gate results (live switched tree, pointer mode)

| Gate | Verdict |
| --- | --- |
| tests/s2-authority (7 suites) | ALL GREEN — dual-read 9, snapshot-isolated 30, ci-snapshot-reader 13, consumer-candidate 11, current-authority-pointer 25 (U2 controls), probe-candidate 7, sync-candidate-resolver 8 |
| packages/testkit a5-current-contract | 35/35 (incl. the 4 new pointer-mode production-entry controls) |
| docs-sync --check | blocking=0 (view regenerated against full tree) |
| docs-probe --base origin/master | blocking=0, advisories=3 |
| doc-consistency-controls | controls=94 failed=8 — EXACT pre-existing baseline, count unchanged |
| ci-pr-gate graph-parse + state-freshness | pass pass=2 refused=0 — state-freshness served by `checkPointerCurrentContract` (with the graph block gone the legacy entry would grade Q8 RED, so PASS proves the pointer source) |
| pnpm -r typecheck | exit 0 |
| lint-identities | 161 lines / 76 distinct vs accepted baseline lint-identities-0237d487.txt (76): new 0, resolved 0; the accepted baseline was NOT reissued — the six offending scripts were brought to it (commit D) |
| pre-commit fence (real index) | positive pass / tampered digest REFUSED / restored pass |
| rollback drill | see ROLLBACK-DRILL.md — `git revert` of the switch set restores the graph authority GREEN with the pointer absent |

## Root `pnpm exec vitest run` (604 files) — every red proven pre-existing

Full run on the branch: `Test Files 10 failed | 594 passed`. Attribution method: a
detached origin/master (95fbe95cf) worktree sharing node_modules was run (a) the same
9-file isolated set and (b) the full suite; plus isolated re-runs on the branch.

1. **Isolated same-scope comparison (9 files, both trees, same day):** baseline 18 red
   names; branch differs by exactly ONE name — `a4p7 lint closes as an identity diff`.
   That one WAS caused by this branch (8 new lint identities: 5 no-unused-vars in the
   S2/U2 authority scripts, 1 pre-existing sparse-array comma in doc-checks, 2 local
   scratch files ESLint sees only in the working tree). Fixed in commit D
   (`bd30dfd07`); leg now PASS isolated; the other 6 scratch/new identities removed
   (scratch moved out of the lint universe; code brought to the accepted baseline).
2. **Files red in the branch FULL run but not in those 9:** `p4t6-session-event-scan`
   and the S13 case of `rc2-sanitize-evidence`. Both PASS isolated on the branch
   (p4t6: 10/10). p4t6's ledger counts every `.ts/.mjs/.mts` under `packages/**`
   (gitignore-blind); during the full suite, concurrent tests' scratch residue transiently
   adds files (+2: measured 1230 vs pinned 1228) — the documented `.tmp-fault` flake
   class (.gitignore:57-62 "residue remedy … flake class"). The branch adds ZERO files
   under `packages/**` (diff vs origin/master: 2 packages files, both edits), so the
   ledger delta cannot come from this PR.
3. **Flakiness control:** the same-tree repeated full runs on the branch moved the red
   set between runs (first: 9 files / 21 tests; final: 10 files; mediation reds 7→5
   across isolated reruns), matching the census/residue classes noted in the suite's
   own comments. Baseline full and branch full share the same red universe modulo
   residue timing.

Conclusion: zero root-suite reds attributable to U2 once commit D closed the lint leg.

## Working notes
- The earlier sparse-checkout (missing `.agents/`) produced 4 spurious docs-sync findings;
  worktree widened to full `/*` — all subsequent captures are full-tree and CI-comparable.
- `.artifacts/u2-draft` scratch moved outside the worktree (lint universe hygiene).
- Store mirror `.artifacts/tmp/u2-store-mirror` deleted after install completion.
