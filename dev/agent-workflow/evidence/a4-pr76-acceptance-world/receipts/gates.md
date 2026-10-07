# Gate receipts (worktree .worktrees/a4-pr76, branch feat/a4-pr76-acceptance-world, base 991348e0)

## pnpm run check:artifacts

    $ node scripts/check-artifacts-committed.mjs
    [check-artifacts-committed] OK: 1508 files; committed install-surface artifacts
    match the fresh build (incl. 1 glue placement(s))

Identical to the recorded baseline (OK 1508). This branch adds evidence files
only — zero product/test files — so artifact drift is structurally zero.

## Whole-repo pnpm test (after rm -rf packages/testkit/test/.tmp-fault/)

Two full runs 2026-10-07 (17:19Z, 17:2xZ). Both: `Test Files 10 failed |
477 passed (487)`. Failing identities (run 2, complete):

| file | failures | baseline |
| --- | --- | --- |
| packages/domain/test/t1-capability-schema.test.ts | 9 (1,2,3,7,8,9,10,11,11b) | 9 ✓ |
| packages/domain/test/t2-blueprint-hash.test.ts | 1 (hashable projection) | 1 ✓ |
| packages/tools/test/p6t6-actions.test.ts | 1 (worker→leader direct) | 1 ✓ |
| packages/runtime/test/d3-member-identity-context.test.ts | 1 (D3-4) | 1 ✓ |
| packages/runtime/test/p6t3-mediation.test.ts | 5 (1,3,4,5,7) | 5 ✓ |
| packages/runtime/test/p6t3-restart.test.ts | 2 (2,5) | 2 ✓ |
| packages/runtime/test/p6t1-parallel.test.ts | 1 (run 2) / 3 (run 1) | documented flake ±1–3 ✓ |
| p8s3b-result-effects / t12a-b2-child-identity / t12a-glue-handoff-ports | 3 collection-level failures (0-test files) | 3 ✓ |

Failing-identity SET identical to the baseline; zero delta attributable to
this branch (no test files added, no product file touched).

## World red-lines during all runs

- `git -C tests/deepseek-harness-test-use status --porcelain` → empty; HEAD
  `639ed015397290b3745d163aafe02ffee4aa3f84` (pristine baseline).
- Main checkout `git status --porcelain` → empty.
- :3080 stable instance: GET 401 before-boot and after-shutdown
  (`accept-probe.log`, copied here) — observed only, never touched.
- Acceptance host (:3180) + mock model: **stopped** at the end of the run
  (`boot.mjs --stop`; port verified free). Never left running.
- Outside-DSH_HOME writes during the boot+driver window: **zero**
  (`find ~` marker-window empty) after boot.mjs env hygiene (DSH_* stripped;
  HOME/XDG_*/NPM_CONFIG_CACHE pinned inside the world).
