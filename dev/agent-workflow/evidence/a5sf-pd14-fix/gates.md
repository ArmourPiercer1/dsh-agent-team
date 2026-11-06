# PD14-FIX — gate receipts

Every command below was run in `.worktrees/a5sf-pd14` on `task/a5sf-pd14-sandbox-root-20261111`
(base `origin/master` @ `c91c72bca`). No gate was skipped silently; where a gate could not be run as
written, the reason and the substitute are stated.

| # | gate | result | receipt |
| --- | --- | --- | --- |
| 1 | `node --test tests/world-factory/a5sf-*.test.mjs` | **pass** — 494 tests, 491 pass, **0 fail**, 3 skipped (the three env-gated defect pins: PD-12/PD-13/PD-14, each green only with its `A5SF_*_PIN=1` switch) | `gate-a5sf.log` |
| 2 | the `sandbox-policy` package tests | **not runnable as written, and not run** — this repo has no `packages/sandbox-policy`; the only such package is `tests/deepseek-harness-test-use/packages/sandbox/sandbox-policy`, i.e. the **pinned upstream tree**, whose `tests/{policy,invariant}.spec.ts` are vitest suites that would need a build writing into that tree (a red line). Substitute, and the stronger measurement anyway: the pinned `SandboxPolicyService` is **installed and asked** in this lane (`D1` reads its own `resolve()` answer; `C1` shows an explicitly configured `workspaceRoot` still winning), and the a5sf suite's policy-contract arms pass in gate 1 | `gate-a5sf.log` |
| 3 | `pnpm -r typecheck` | **pass** — exit 0, all nine packages `Done` | `gate-typecheck.log` |
| 4 | `npx eslint` on the new/changed files | **pass** — exit 0; all four files report "File ignored because of a matching ignore pattern" (`tests/**` is outside this repo's lint surface by design; no file was force-linted) | — |
| 5 | `node scripts/check-artifacts-committed.mjs` | **pass** — 1970 files, working tree equals the index on both install surfaces (incl. 103 glue placements). No source changed in this lane, so no rebuild was needed | `gate-artifacts.log` |
| 6 | `node scripts/doc-checks.mjs` | **pass** — exit 0 | — |
| 7 | `node --test tests/world-factory/a5sf-debt-register.test.mjs` | **pass** — 10/10, including every anchor resolving and the §6 declarations staying in lockstep | — |
| 8 | `node scripts/ci-pr-gate.mjs --only state-freshness` | **pass** — pointer agrees both ways, records contiguous, current contract ok | `gate-state-freshness.log` |
| 9 | the `p4t6` scannable-file ledger | **no booking needed — measured, not assumed.** The scanner's population is exactly `packages/<pkg>/**` (`packages/testkit/fault-injection/session-event-scan.mjs`: it walks `packages/` and nothing else). Measured on this tree: **1437 files, 15 quarantine hits (unchanged), 0 files outside `packages/`, 0 files matching this lane's paths**, and `PASS packages/testkit/test/p4t6-session-event-scan.test.ts (20 tests)`. All three files this lane adds/edits live under `tests/`, which the scanner never enters | `p4t6-measured.log` |

## Environment note (not part of the change)

The worktree had no `node_modules`, and `pnpm install --offline` cannot reach the shared pnpm store
from inside the file sandbox (`ERR_SQLITE_ERROR … unable to open database file` on
`~/.local/share/pnpm/store/v11/index.db`; the store is outside the writable workspace). The gates
therefore ran against a worktree-local copy hardlinked from the main checkout, with the relative
symlinks pnpm had written **for the main checkout's depth** rewritten for this worktree's one-extra
level (76 links, then 0 dangling). This is local install plumbing only: no tracked file, no lockfile
and no `packages/**` byte changed, and `check-artifacts-committed` (gate 5) confirms the tree still
equals the index.

`node scripts/run-tests.mjs testkit` (the whole testkit package) was also run as a wider control:
**319 passed / 120 failed**. Every failure is the plain-node vitest shim missing a matcher
(`toContain`, `toBeTruthy`, `toBeUndefined`, `toMatch`, `not.toBeNull`) or refusing `async it()` — in
suites this lane never touched. That log is **not committed** because it is 120 lines of unrelated
shim gaps and would invite exactly the wrong reading; what matters is quoted instead:
`PASS packages/testkit/test/p4t6-session-event-scan.test.ts (20 tests)`, and the scan population
contains no `tests/**` file at all (gate 9).
