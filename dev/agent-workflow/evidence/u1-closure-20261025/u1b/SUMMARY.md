# U1-B SUMMARY — EB0-2: nine-package tests, CI DAG, historical red attribution

Tree: `.worktrees/u1-audit-master` @ `4aaaa7b2af87f80a0fae62d9c8d9cf03d5a6fd84` (origin/master,
detached; porcelain = 0 tracked modifications at end — never committed, nothing pushed, :3080/~/.dsh
untouched, no DSH host started, no git fetch).

## 1. Install (exact commands, exits, durations)
1. `pnpm install --frozen-lockfile --offline` → **exit 1** (0s): `ERR_SQLITE_ERROR unable to open
   database file` — default store `/home/user/.local/share/pnpm/store/v11` sits on a read-only
   filesystem in this sandbox; pnpm cannot open its SQLite index RW.
2. `pnpm install --frozen-lockfile --prefer-offline` → **exit 1** (0s): same sqlite error.
3. `pnpm install --frozen-lockfile --offline --store-dir <OUT>/scratch/store` → **exit 1** (6s):
   `ERR_PNPM_NO_OFFLINE_TARBALL` — that (different) store lacks `@deepseek-ai/dsh@0.2.0-rc.2`.
4. `pnpm install --frozen-lockfile --offline --store-dir <OUT>/scratch/store2` → **exit 0** (6s,
   reused 815, downloaded 0): store2 = zero-extra-disk hardlink mirror of the repo-local
   `.pnpm-store/v11` (the store every sibling install used, per its `.modules.yaml`) with a private
   copy of `index.db`. `--ignore-scripts` NOT used (not needed). Mirrors deleted afterwards; main
   store verified intact. `analyze-reds.mjs`, logs, ids under this dir; `scratch/` logs retained.

## 2. Suites
- `pnpm -r run typecheck` → **exit 0**, 17s, 9/10 projects Done (legacy declares no typecheck).
- `pnpm exec vitest run --reporter=default --reporter=json --outputFile.json=…` ×2 (root config,
  suite-default 5000 ms clock):
  | run | exit | wall | files | legs | pass | fail | skip/todo |
  |---|---|---|---|---|---|---|---|
  | 1 | 1 | 345s | 604 (9 failed) | 7753 | 7733 | 20 | 0 |
  | 2 | 1 | 310s | 604 (9 failed) | 7753 | 7733 | 20 | 0 |
- Red identity sets of run1 and run2 are **byte-identical** (`scripts/fail-set.mjs` capture;
  `scratch/run{1,2}.ids.txt`) → zero flakes observed.
- `docs:probe --help` → exit 2 (`REFUSED BASE_REQUIRED` — the CLI has no --help by design).
  `docs:probe --worktree-only` → **exit 0**, blocking=0, contracts=20 pairs compared.
  `docs:controls` → **exit 1**: controls=94, failed=8 — the failed set is **identical** to the
  recorded historical set (`s2-pr364-u0u1-20261025/u1c-controls.log`: same 8 names) → pre-existing.

## 3. Reds (`reds.json`)
Union 20 identities: **DETERMINISTIC 9 · FLAKY 0 · ENV-NOT_RUN 11**. Per package (D/F/ENV):
runtime 7/0/4, domain 1/0/0, tools 1/0/0, testkit 0/0/7, others 0. The 9 deterministic reds are
**exactly** the nine tolerated census reds. The 11 ENV reds are environment preconditions of this
run, not product logic, each with measured reason text: ENV-CLOCK-DEFAULT 2 (a3p3:767 and S13 —
both timed out at the default 5000 ms clock; pr-gate/census-runtime raise the clock to 20000/90000
for exactly these legs), ENV-CHECKOUT-RESOLUTION 8 (`findTestRepoRoot` walks UP for the
`tests/deepseek-harness-test-use` marker, absent in this worktree but present in the MAIN checkout
@ `6259cf4b` → plugin-dsh-compat ×5 and rc2-persona-probe ×3 graded the MAIN tree),
ENV-BUILD-NOT-RUN 1 (a4p7-merge-gate composition arm answered `refused`: no composition build in
this checkout; build was out of package scope).

## 4. Historical reds — sources located and mapped
- **"9 nine-package census reds"** = `dev/agent-workflow/evidence/a4-pr7/population-baseline/
  nine-root-2b1099d7.md` + `.ids.txt` (machine tolerance; `ci-pr-gate.mjs BASELINES.census`;
  lineage 2162f6a7 → 067225df → 319a60d7 → 94da4a69(10, incl. D3-4) → post-d3-4-split → 2b1099d7).
  **Now: 9/9 still failing** (all DETERMINISTIC, both runs).
- **"22 Root Suite reds"** (Alpha.4 root-suite collection) = `dev/agent-workflow/evidence/a4-pr0/
  baseline-closure/failing-identities-pr0-run2.txt` (22 = 19 tests + 3 collection files; cited by
  docs/STATUS.md, alpha4-implementation-plan rule-8, graph.yaml `citable_baseline`,
  EB-E0-E1/baseline-inventory.md:80). **Now: 9/22 still failing** (the 9 = the census-tolerated set);
  13 no longer fail: t1-capability-schema ×9, d3-member-identity-context D3-4 ×1 (the documented
  D3-4 repair), collection-errors ×3 (p8s3b-result-effects, t12a-b2-child-identity,
  t12a-glue-handoff-ports — all now pass).
- **NEW reds vs every historical list: 11 identities, of which 0 graded product reds** (all 11 are
  the ENV classes above). p6t1-parallel load-family: absent both runs.
- s2-pr364-u0u1-20261025 logs contain no red lists (controls/probe transcripts); their
  `*-controls.log` supply the historical docs-controls failure set used above.

## 5. CI DAG
`ci-dag.md`: 4 workflows (pr-gate = merge gate shell for ci-pr-gate.mjs 8 legs; census-runtime =
census with provisioned pinned host, informational; candidate-protection = external pinned spec;
characterization = manual/archival). Required-check enablement on GitHub is NOT_VERIFIABLE from
the tree; each file states its own intent.

## NOT_RUN (with reason)
All host-booting kits under `tests/kits/` (T2/T3 class: rc2-real-host-smoke, pr-a…pr-f,
pr-d-control-real-host, f15-mcp-live-loss-smoke, exec-contract-live-smoke, alpha5-pr8-e2e, …) and
`tests/characterization/run.mjs` — package forbids starting any DSH host; neither is collected by
the root run. Client lane (`packages/client/*.client.spec.ts(x)`, own config, own disclosed
baseline) — outside root include, not run. Census legs requiring `tests/deepseek-harness-test-use`
recorded ENV-NOT_RUN per identity in `reds.json`. `ci-pr-gate --full` itself NOT_RUN (its census
leg would refuse identically and its artifacts leg builds HEAD in a linked worktree — outside the
write policy of this package).
