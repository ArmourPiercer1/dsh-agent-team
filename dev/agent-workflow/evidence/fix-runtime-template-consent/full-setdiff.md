# Full-suite setdiff — recorded pristine-base debt set vs new head (2026-10-01)

Method: `pnpm vitest run` at both points, exit-code discipline (`EXIT=` in each
log); failed-file extraction with the strict pattern
`grep -E "^ ❯ packages/.*\.test\.ts \(" LOG | sed 's/^ ❯ //; s/ (.*//' | sort -u`
(no stack-line over-match).

- Pristine base (re-verified THIS round, worktree detached @ `31ad828d`
  reusing the fix worktree's node_modules — provenance header in
  `baseline-full.log`): **10 failed files / 21 failed tests | 397 passed (407)
  files, 4698 passed (4719) tests, EXIT=1** (`baseline-full.log`,
  `baseline-failed-files.txt`).
- New head (this round, post-fix + addenda): **9 failed files / 19 failed tests
  | 401 passed (410) files, 4730 passed (4749) tests, EXIT=1**
  (`full-newhead.log`, `full-newhead-failed-files.txt`).
- Total test count: 4719 → 4749 = +30 tests (prior round: I suite 4 + J suite
  10 + requirement-facts keyed round-trip 1 = 15; this round: leader suite 5 +
  S3 1 + S2 1 + J3 arc 6 + S1 unit face 2 = 15).

## Per-file table

| file | base (this round) | new head | classification |
|---|---|---|---|
| domain/t1-capability-schema | 9F | 9F | recorded historical debt (identical) |
| domain/t2-blueprint-hash | 1F | 1F | recorded historical debt (identical) |
| runtime/d3-member-identity-context | 1F | 1F | recorded historical debt (identical) |
| runtime/p6t3-mediation | 5F | 5F | recorded historical debt (identical) |
| runtime/p6t3-restart | 2F | 2F | recorded historical debt (identical) |
| tools/p6t6-actions | 1F | 1F | recorded historical debt (identical) |
| runtime/p8s3b-result-effects | collection | collection | recorded historical debt (collection failure, NOT touched per protocol) |
| runtime/t12a-b2-child-identity | collection | collection | recorded historical debt (collection failure, NOT touched per protocol) |
| runtime/t12a-glue-handoff-ports | collection | collection | recorded historical debt (collection failure, NOT touched per protocol) |
| runtime/p6t1-parallel | 2F | 0F | **recorded known flake family (0–2 tests)**: fired at the base run, not at the new-head run — within the recorded envelope; no new signature (prior-round isolated re-runs ×3: 9/9 GREEN all 3) |

## Result

- New-head failed-file set ⊆ recorded debt set (the only delta is
  `p6t1-parallel`, the recorded flake family, which did NOT fire at the new
  head — 0, inside the recorded 0–2 envelope).
- **New failures beyond the recorded debt set: NONE.**
