# evidence u7r3-shomeimpl-20261031 — notes

## 2026-10-30T10:38:30Z — R483-fl: fail-closed test-use provisioning probe in plugin-dsh-compat (tests-only)

Finding (R483 review, reproduced pre-fix in this worktree — `red-pre-fix-silent-grading.txt`):
`plugin-dsh-compat.test.ts` resolved `repoRoot` via `findTestRepoRoot()` WALKING UP from the
test location; in a git worktree without the gitignored `tests/deepseek-harness-test-use` the
walk lands on the MAIN checkout and the suite silently grades THAT tree's root
`package.json` — measured independently here: HEAD's guard-free suite in an unprovisioned
worktree ran and reported 4 failed | 3 passed against the foreign 9-peer master manifest,
indistinguishable from real branch reds.

Fix: the suite now calls `assertTestUseProvisioned` (same file, module load) which fails closed
with named error `DSH_TEST_USE_NOT_PROVISIONED` — path found / expected root / TEST_METHODS §1
provisioning triple — unless (a) the resolved test-use root realpath-matches the worktree top
(`git rev-parse --show-toplevel` from the test file, the WORKSPACE_ROOT discipline already used
by `rc2-kit-pin-hygiene.test.ts`) and (b) `tests/deepseek-harness-test-use` is its own git repo
with `rev-parse HEAD` == `TEST_USE_BASELINE_SHA`. Guard self-tested from fixture trees under
`tests/homes/` (6 cases, scratch removed at teardown): green own-tree@pin, green via symlink
alias, RED foreign root, RED null, RED marker-not-a-repo, RED wrong commit.

Three-state proof (this worktree, branch task/u7r3-shomeimpl-20261031 @ a982a8e4d + this fix):
- (a) provisioned worktree green: 13/13 incl. the TEN-name re-audit assertion against the pinned
  tree declaring `@deepseek-ai/dsh-home-paths` in `packages/boot/app-boot/package.json` — this is
  the same shape the main checkout presents (main checkout itself was NOT touched; the probe is
  shape-based: own-tree pinned test-use, which (c)'s fresh copy re-creates independently);
- (b) unprovisioned worktree: RED LOUD at module load, exit 1, zero tests collected —
  `red-without-testuse.txt`;
- (c) green-after-provision: `rsync -a` pristine copy per convention -> 13/13 green again —
  `green-with.txt`, guard block in `guard-selftests.txt`; §1 clone triple (clone --local
  --no-hardlinks from the main checkout's git repo — the shared baseline
  `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` exists here WITHOUT its .git, an
  environment migration gap noted honestly in the transcript — checkout --detach 639ed01539…,
  rev-parse == pin, porcelain 0, detached confirmed) in `provisioning-triple.txt`.

Hosted-CI answer (no workflow was changed; no provisioning was invented): the legs that RUN this
suite provision test-use at the checkout root and assert the pin before vitest
(`census-runtime.yml`, `ci-full.yml` via `ci-pr-gate.mjs` census leg) → the guard is a no-op
there; `pr-gate.yml`'s census REFUSES before spawning vitest on runners without test-use
(`ci-pr-gate.mjs` preflight, `--allow-refused census`), so the suite does not run there at all
today. A future leg that ran the suite without provisioning would now hit the named error instead
of silently grading a foreign tree — which is the point.

Gates on this commit set: compat suite 13/13; testkit 31 files / 455 tests; root `vitest run`
649 files / 8543 tests 0 fail (`root-vitest-postguard.log`); `pnpm -r run typecheck` 0;
eslint LINT-OK on the changed file; `eb3-family-boundaries` findings=0; `docs:probe
--worktree-only` blocking=0; `check:artifacts` verdict=ok (no mirrored file touched — the change
is tests-only). Sibling audit for the identical silent-resolution path (scope stayed: the compat
suite only):
- IDENTICAL path found, NOT fixed here (flagged for the coordinator):
  `packages/runtime/test/rc2-persona-probe.test.ts` reads the tracked subject sources via
  `pluginFile()` from `findTestRepoRoot(process.cwd())` — an unprovisioned worktree silently
  probes the MAIN checkout's plugin sources; the same probe pattern applies.
- Related, different mechanism: `packages/runtime/test/a5p4-harness.ts` / `a5lsp2-harness.ts`
  put DSH_HOME worlds under `homeRoot(walk-up root)` — cross-tree WORLD PLACEMENT, not subject
  grading; `packages/tools/a5p5-tools/test/a5p5-barrel-emit.test.ts` borrows
  `node_modules/typescript` + cwd from the walk-up root but emits/audits lane-local sources
  (compiler borrowed, subject local).
- Already separated subject from host (previous ~954-offender round): `rc2-kit-pin-hygiene.test.ts`,
  `rc2-kit-preset-seam.test.ts` — WORKSPACE_ROOT (git toplevel) for sources, walk-up ONLY for the
  intentional pinned HOST runtime.
- Intentional host location (walk-up is the documented way to find the pristine runtime, and the
  host is the same pinned tree by convention): `a5b3-cancel-leg.test.ts` (reads the pinned host
  anchor, pre-existing fail-closed text), `a5-pindir-reserved-native` / `a5-pindir-subagent-flip`,
  the `packages/*/harness/run.mjs` live runners, `tests/kits/**`, `tests/world-factory/**`,
  `scripts/eb3-ci-required.mjs` / `eb3-ci-negative-controls.mjs` (behind the census preflight
  that refuses without a checkout).
