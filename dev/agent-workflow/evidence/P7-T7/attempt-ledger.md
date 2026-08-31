# P7-T7 attempt ledger

P7-T7: attempt 1/3 — PASS (in-process 1588/1588, real-instance e2e L1/L2/L3 PASS)

## Attempt 1 (2026-08-31, current)

Worktree/branch: `.worktrees/P7-T7` @ `task/P7-T7-legacy-session-reader`,
HEAD at attempt start `c53f1b008d59b803f51d2c107ffffb7846a8bb9c`.

### In-process (attempt 1)

- Baseline full suite: 1510/1510 (`attempt1-baseline.log`).
- Post full suite: 1588/1588, failures 0 (+78 new p7t7 tests: 8+15+9+7+28+11)
  (`attempt1-post.log`).
- tsc: contracts=0 domain=0 storage=0 runtime=0 testkit=0 (5× EXIT 0).
- testkit focus: 124/124 incl. p4t6 10 tests (394→411 countable files,
  legacy 4→21); re-verified on the FINAL tree after all e2e fixes:
  124/124 (`final-testkit-rerun.log`).
- Zero-core: PASS (grep `node:|require\(` over `packages/legacy/**/*.ts` →
  exactly 4 hits, all in comments; no `.ts` import). Re-verified on the
  final tree.

### Real-instance e2e (test-use pin cd5ef814, port 3180, DSH_HOME `references/.dsh-test-p7t7`)

- **Run #1** (evidence `harness-output-run1/`): boot OK; L2 11/11 + L3 7/7
  PASS, L1 6/17 FAIL. Root cause = harness bug A (this task's own driver
  code, not environmental): `plantLegacyFixtures` mis-destructured the
  5-element fixture tuples, planting a flat FILE named
  `--C-p7t7-legacy-team--` under `sessions/` instead of the
  `sess-leader`/`sess-alpha` session tree, and a flat `ws/.dsh` file
  instead of the workspace overlay tree. Reproduced without any booted
  instance via a real-FS port probe (reader dropped the project because
  the port reported `kind:"file"`).
- **Run #2** (evidence `e2e-run2.log`, `harness-output/logs/boot/` from that
  run overwritten by run #3's boot log): harness bug A fixed → boot itself
  crashed — harness bug B: the test-use host's session-persistence-jsonl
  backend is configured for compression "zstd" and its cordis-init
  root-encoding check rejects a plain `.jsonl` artifact already present
  under `DSH_HOME/sessions`
  (`session artifact "…sess-alpha\session.jsonl" uses .jsonl, but this
  backend is configured for compression "zstd"`). Fix: plant the legacy
  fixtures AFTER boot (the mounted row reads the home from the live FS on
  every tool call; runtime coexistence with post-boot plain `.jsonl`
  artifacts was already proven by run #1's L3 reset phase).
- **Run #3** (evidence `harness-output/`): **PASS** — L1 17/17 (41 ms),
  L2 11/11 (137 ms), L3 7/7 (59 ms); `rowMounted=true`; ports boot 3180 +
  mini-MCP 3491 both released after stop; stable `:3080` reachable 200
  before AND after; test-use tree pristine before AND after (head
  `cd5ef8148158c3a752a658978873241fdf8e2bbc`, `git status` and `git diff`
  empty); `build.required=false`.

### Attempt accounting

Both run #1 and run #2 failures were defects in THIS task's own e2e
harness code (a fixture-planting destructuring bug and a boot-ordering
assumption), diagnosed and fixed within the attempt. Per the task rules,
harness/test-code bugfixes within an attempt do not consume the attempt
budget. Attempt 1 concluded with a fully green in-process chain AND a
fully green real-instance e2e → **PASS on attempt 1 of 3**.
