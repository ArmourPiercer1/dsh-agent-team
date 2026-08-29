# P1-T2 — Downstream permission test suite (mandatory test)

Executed in the downstream fork worktree (owned by this task):

- **Worktree:** `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\P1-T2-permtests`
- **Branch / commit:** `work/permission-tests` @ `a3ab31992762c5d6560797eabc7e0885a9320ade` (object DB of the frozen legacy checkout; the checkout's main worktree stayed clean and untouched — this worktree is the task-owned surface)
- **Toolchain:** node v24.20.0 · pnpm 11.7.0 (matches the repo's `packageManager: pnpm@11.7.0`, no corepack intervention needed)

## 1. Install

| attempt | command (cwd = worktree root) | result |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | **failed** — pnpm ran the root `postinstall` (`node scripts/install-lefthook.mjs`) by spawning a child with piped stdio; the Windows sandbox denies piped-spawn (EPERM). Install aborted after the linking phase (log: `.scratch-p1t2/pnpm-install.log`, 18m+ into linking). |
| 2 | `pnpm install --frozen-lockfile --ignore-scripts` | **success** — `Done in 18m 43.6s using pnpm v11.7.0` (log: `.scratch-p1t2/pnpm-install-2.log`). Resolved 1035 packages: 1029 reused from store, 24 downloaded, 0 patched. One benign WARN: bin link for the unbuilt `apps/cli` `dsh` exe entry (`python/sdk-runtime`) — unrelated to tests. |

Justification for `--ignore-scripts` (retry budget ≤2, used 1): the only lifecycle scripts in this install are the root lefthook hook-install and the `allowBuilds`-listed `esbuild` / `lefthook` / `node-pty` build scripts. The permission test suites load compositions containing only `@deepseek-ai/cordis`, `cordis-plugin-loader`, `cordis-plugin-include`, `dsh-session`, `dsh-llm` (types only), `dsh-agent` (types only), `dsh-system-prompt`, `dsh-tools`, `dsh-user-approval`, `dsh-invariants`, the three permission packages, and vitest — none of the skipped scripts are exercised by this suite. No upstream code was modified, patched, or rewritten (no patch-package / pnpm patch / postinstall rewriting).

Post-install `git status --porcelain`: only `?? .scratch-p1t2/` (task scratch dir, untracked); `node_modules` is ignored by the repo `.gitignore`. The worktree was not committed to or modified by this task.

## 2. Test command

The three permission packages declare **no per-package `test` script** (`scripts: {}` in each `package.json`), so `pnpm --filter <pkg> test` has no target; the repo's unit-test entry point is the root `vitest run` (root `scripts.test`). The equivalent scoped command:

```
pnpm vitest run packages/permission
```

The sandbox blocks the repo's standard launch path in two places, both local to test infrastructure (no source changes, no node_modules changes, nothing committed):

1. **`net use` probe** — Vite 8's Windows realpath optimization (`chunks/node.js`, `optimizeSafeRealPathSync`) spawns `net use` once during config loading; the piped spawn EPERMs under the sandbox. Workaround: a `--require`'d CJS hook (`.scratch-p1t2/netuse-hook.cjs`, not committed) that answers that single probe in-process with `There are no entries in the list.` — byte-identical to a normal machine without mapped drives, after which Vite falls back to `fs.realpathSync.native` exactly as it would. All other spawns pass through untouched.
2. **Worker pool** — the repo config hard-codes `pool: 'forks'` (forked node workers communicate over piped IPC → EPERM under the sandbox). Workaround: CLI override `--pool threads` (worker_threads, no child processes). This is a test-runner scheduling choice only; it does not alter what the suites assert.

Full command actually executed (cwd = worktree root):

```
node --require .scratch-p1t2\netuse-hook.cjs node_modules\vitest\vitest.mjs run --pool threads packages/permission
```

(`node node_modules\vitest\vitest.mjs` ≡ `pnpm vitest`; the `pnpm` wrapper adds nothing for this invocation.)

## 3. Results — **PASS, 12/12 files, 132/132 tests, node exit code 0**

Run executed twice (both green; identical composition):

| file | tests | duration (run 2) |
|---|---:|---:|
| `packages/permission/permission-engine/tests/match-path.spec.ts` | 14 | 3ms |
| `packages/permission/permission-engine/tests/audit.spec.ts` | 6 | 4ms |
| `packages/permission/permission-engine/tests/match-mcp.spec.ts` | 7 | 3ms |
| `packages/permission/permission-engine/tests/match-param.spec.ts` | 9 | 4ms |
| `packages/permission/permission-engine/tests/match-command.spec.ts` | 13 | 6ms |
| `packages/permission/permission-engine/tests/parse.spec.ts` | 9 | 5ms |
| `packages/permission/permission-engine/tests/resolve.spec.ts` | 10 | 5ms |
| `packages/permission/permission-engine/tests/evaluate.spec.ts` | 11 | 3ms |
| `packages/permission/permission-engine/tests/load.spec.ts` | 28 | 28ms |
| `packages/permission/permission/tests/permission.loader-composition.spec.ts` | 9 | 74ms |
| `packages/permission/tool-permission-guard/tests/guard.unit.spec.ts` | 6 | 25ms |
| `packages/permission/tool-permission-guard/tests/guard.loader-composition.spec.ts` | 10 | 85ms |
| **Total** | **132** | |

Vitest summary (run 2): `Test Files  12 passed (12)` · `Tests  132 passed (132)` · `Duration  710ms (transform 2.53s, setup 2.06s, import 1.22s, tests 245ms)`. Raw logs: `.scratch-p1t2/vitest-permission-3.log`, `.scratch-p1t2/vitest-permission-4.log` (scratch worktree, not committed).

**Failed tests: none.**

Per-package breakdown: `@deepseek-ai/dsh-permission` 9/9 · `@deepseek-ai/dsh-permission-engine` 107/107 · `@deepseek-ai/dsh-tool-permission-guard` 16/16.

Coverage of the capability seam, per the repo's testing policy: unit suites plus **real-Loader composition** suites for both the engine provider (`permission.loader-composition.spec.ts`) and the guard Consumer (`guard.loader-composition.spec.ts`) — decisions asserted through the executor, audit events read back from the session log.

## 4. Notes

- PowerShell surfaced one wrapper-level `[exit code: 1]` on the first green run because Vite's deprecation warning on **stderr** is rendered as a `RemoteException` record by the pwsh pipeline; the node process exit code was captured explicitly and is **0** (`NODE_EXIT_CODE=0`).
- pnpm reports a pre-existing **dev-only** cyclic workspace dependency between `packages/permission/permission` and `packages/permission/permission-engine` (devDependencies only; no runtime cycle) — observed, not introduced.
- The `vite-tsconfig-paths` deprecation warning (Vite 8 now has native `resolve.tsconfigPaths`) is pre-existing repo state, unrelated to this task.
- The permission packages' green standalone run in the downstream fork is the "self-developable" half of the split: combined with the zero Team-repo references (`dependency-proof.json`), `packages/permission/**` stands as a downstream generic capability with no Team coupling.
