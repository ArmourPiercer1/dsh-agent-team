# p4t6 coverage pin repair — F3/F11/F9/T1.4 repair (p4t6-pin)

**Task**: update the coverage pin and explanatory comment in
`packages/testkit/test/p4t6-session-event-scan.test.ts` to the exact current
scanner count, independently verified from a clean candidate tree.

**Base**: `int/repair-r1` @ `97d4729e3a4643130ebe4352280bbc4fcfbc4d0e`
**Branch / worktree**: `task/repair-r1-p4t6-pin` @ `.worktrees/repair-r1-p4t6-pin`
(one task = one branch = one worktree = one writer)

## Result

| item | value |
| --- | --- |
| old pin | **630** (last recorded at `1386a9b`, D3 v2 — the last commit touching the test file) |
| new pin | **642** |
| delta | **+12** (12 ADDED, 0 DELETED, 0 RENAMED scanner-scope files in `1386a9b..97d4729`) |
| quarantine hits | unchanged: 15 event-string occurrences in the frozen two-file quarantine set; 0 payload symbols; 0 declaration merges |

## Verification (clean candidate tree)

`git status --porcelain` empty before any change. Three independent methods
all yield the identical 642-entry ordinal-sorted file list (details in
`verification-summary.txt`):

1. **Committed scanner** (`session-event-scan.mjs` via `run-scanner.mjs`)
   → `filesScanned=642` (`scanner-run-summary.txt`, `scanner-file-list.txt`).
2. **Independent PowerShell filesystem walk** of `packages/**`
   (`.ts/.mts/.mjs`, skip `node_modules`/`dist`/`.tmp-fault` segments, the two
   self-referential exclusions) → `enum-a-filesystem.txt`, byte-identical.
3. **Independent `git ls-files packages/`** on the clean checkout
   → `enum-b-gitlsfiles.txt`, byte-identical.

History cross-check: `git diff --name-status -M 1386a9b..97d4729` in scanner
scope = exactly the 12 added files listed in `verification-summary.txt`
(F3 lock-scope specs ×3, F9 v4/control-surface specs + model ×6, T14-H
probe-merge spec ×1, Team D1-D6 v2 acceptance runners ×2) ⇒ 630 + 12 = 642.

## Change (only the pin and its explanatory comment)

- `expect(scanResult.filesScanned).toBe(630)` / `.files.length ...` → **642**
- one new explanatory comment paragraph in the derivation block ("repair-r1
  pin (630 + 12, …)" — same "record the missed pin" precedent as the
  P9-S8 / TCM-D4 stale-base entries).
- **Preserved untouched**: `QUARANTINE_FILES` (the frozen two-file set), the
  exact 15-hit quarantine pin, `REQUIRED_SUITES` (all eight P4 evidence
  suites), the exclusion contract, all positive/negative controls, the frozen
  scanner vocabulary (`.mjs` not modified).

## Test results (task worktree, node v24.20.0, pnpm 11.7.0)

- **Scanner test (targeted, real vitest 4.1.11)**:
  `packages/testkit/test/p4t6-session-event-scan.test.ts` — **10/10 passed**
  (`test-results-vitest-p4t6.txt`).
- **Relevant testkit checks (full testkit package, real vitest)**:
  15 files / **124/124 passed** (`test-results-vitest-testkit-full.txt`).
- **Canonical sandbox chain** (`node scripts/run-tests.mjs testkit`):
  **124 passed, 0 failed** — identical outcome
  (`test-results-plainnode-testkit.txt`).

## Boundary

- No upstream DSH source touched (CORE PATCH BUDGET = 0 honored); no product
  runtime change — the commit touches exactly one test file (pin + comment)
  plus this evidence directory. No push.
- Sandbox note: the stock `pnpm vitest run` crashes during vite config
  bundling (vite 8 `windowsSafeRealPathSync` → `exec("net use")` →
  piped-stdio EPERM — the same recorded boundary as
  `evidence/P1-T5/D-05-test-pnpm.log`). The runs above use a temporary
  import-free `vitest.config.mjs` (deleted after use) so the config-bundle
  step resolves nothing to realpath; the test sources run unchanged. The
  plain-node runner `scripts/run-tests.mjs` (the canonical chain named in the
  scanner header) passes identically and needs no workaround.
- Worktree hygiene: `pnpm install --ignore-scripts` created `node_modules/`
  (gitignored) against the in-workspace pnpm store
  (`D:\AgentDev\dsh-plugins\dsh-agent-team\.pnpm-store`); `pnpm-lock.yaml`
  unchanged.
