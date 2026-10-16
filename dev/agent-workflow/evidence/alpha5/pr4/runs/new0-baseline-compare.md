# NEW=0 baseline compare — Alpha.5 PR4 (C Lane), base db5cb5f7

Method: full `node_modules/.bin/vitest run` at lane HEAD → `runs/root-vitest-full.log`
(`Test Files 8 failed | 522 passed (530)`, `Tests 22 failed | 6707 passed`);
then the per-file failing specs were re-run at BASE with the entire lane stashed
(`git stash push -u` — evidence dir + lane files removed; node_modules is gitignored
and stayed), one spec file per run, and the lane was restored (`git stash pop`).

| spec file | BASE (measured) | LANE (full run) | verdict |
| --- | --- | --- | --- |
| domain/test/t2-blueprint-hash | 1 | 1 | pre-existing (v3 drift red) |
| runtime/test/p6t3-mediation | 5 | 5 | pre-existing |
| runtime/test/p6t3-restart | 2 | 2 | pre-existing |
| runtime/test/rc2-persona-probe | 3 | 3 | pre-existing |
| testkit/plugin-dsh-compat | 6 | 6 | env: `tests/deepseek-harness-test-use` is gitignored — absent in this fresh worktree |
| testkit/rc2-kit-preset-seam | 2 | 2 | same env cause |
| testkit/a4p7-merge-gate | 1 (composition smoke) | 2 → **1 after fix** | see below |
| tools/p6t6-actions | 1 | 1 | pre-existing |

BASE total (sum of the files above) = 21. LANE before the fix = 22 → exactly ONE
lane-introduced red: a4p7 `every workspace package that declares a typecheck script
typechecks`. Cause: the shared `packages/runtime/tsconfig.json` includes `test/**`
(and my lane files via their imports), so `pnpm -r run typecheck` typechecks the
lane under the shared program — where the plugin `node-min.d.ts` ambient shim
structurally narrows `process`/`URL` (PR1 peers never use them). Lane-side fixes
only (zero shared-file edits): `globalThis` accessor casts for `process.env`,
`join(dirname(fileURLToPath(import.meta.url)), …)` instead of `new URL(...).pathname`,
plus three deliberate-negative/spec-only casts. Re-measured after the fix:
`tsc -p packages/runtime/tsconfig.json` = 0 errors; `pnpm -r run typecheck` = exit 0;
`a5p4` suite re-run 56/56 (`runs/a5p4-GREEN.log` recaptured).

**Conclusion: NEW = 0** against base db5cb5f7 on this host/environment (remaining
reds are environment-missing test-use runtime tree + recorded pre-existing reds,
each measured to move 1:1 with the lane stashed/present).

## Second pass (post typecheck fix): one LANE-OWNED flake found and fixed

`runs/root-vitest-full-POSTFIX.log`: 22 failed — the typecheck red was gone (a4p7
back to its single base red) but `a5p4-lane-hygiene` appeared with 1 failure: the
DORMANT walk raced a SIBLING suite's transient fault-injection dir
(`testkit/test/.tmp-fault/…`, created+deleted during the parallel full run). The
walk now skips `.tmp-*` and tolerates vanishing entries (a file that disappears
under a concurrent walk is not an offender).

## Final: `runs/root-vitest-full-POSTFIX2.log`

`Test Files 8 failed | 522 passed (530)`, `Tests 21 failed | 6708 passed` —
per-file FAIL counts EXACTLY equal the BASE column above (1+5+2+3+1+6+2+1 = 21),
zero failures in any a5p4 file. **NEW = 0.**
