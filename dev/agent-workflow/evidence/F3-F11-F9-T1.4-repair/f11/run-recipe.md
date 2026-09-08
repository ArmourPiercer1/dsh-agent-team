# F11-L — run recipe (sandbox note)

Date: 2026-09-07 (repair round r1). Worker: F11-L implementation worker.
Branch/worktree: `task/repair-r1-f11-ledger` @ `.worktrees/repair-r1-f11` (base `9b582a1`, one task = one branch = one worktree = one writer).

## Dependency setup (worktree)

- `pnpm install --ignore-scripts` in the worktree root — resolved 463 / reused 463 /
  downloaded 0 from the shared workspace store (`D:\AgentDev\dsh-plugins\dsh-agent-team\.pnpm-store\v11`);
  no network. Node v24.20.0, pnpm 11.7.0.

## Client vitest surface

The client suite is `packages/client` `vitest run` (41 files: `test/**/*.test.ts` +
`test/**/*.client.spec.ts` + `test/**/*.client.spec.tsx`).

**Sandbox workaround (recorded, reversible, no product/test change):** in this
workspace-write session, node-initiated piped-stdio child spawns are denied (EPERM;
TEST_METHODS.md §5). Vite 8.2.2's Windows safe-realpath probe
(`optimizeSafeRealPathSync`, `vite/dist/node/chunks/node.js` L2481–2507) execs
`net use` ONCE per process during config load, which throws `spawn EPERM` and kills
vitest at startup (baseline repro: `baseline-client-vitest-stubbed.txt` shows the
unstubbed failure class; prior evidence e.g. `team-d1-d6-repair-v2/G3/full-client.txt`
ran the same suite in a session where that spawn was permitted).

The workaround is an uncommitted scratch stub at the WORKTREE root
(`.f11-vitest-netuse-stub.mjs`, NOT part of the branch, NOT committed, NOT a
node_modules patch): it intercepts ONLY the exact `net use` probe (async exec /
execFile / spawn + sync variants) and fails its callback; every other spawn passes
through untouched. Vite's callback then keeps its default `fs.realpathSync` — no
behavioral change beyond skipping the (network-drive) enumeration; there are no
network drives in this world. No `node_modules` file was modified.

Run command (worktree root):

```powershell
node --import ./.f11-vitest-netuse-stub.mjs node_modules/vitest/vitest.mjs run --root packages/client
```

- full suite: `baseline-client-vitest-stubbed.txt` (pre-change) /
  `green-client-vitest-stubbed.txt` (post-change);
- focused F11 files: `red-f11-focused.txt` (RED phase) /
  `green-f11-focused.txt` (GREEN phase);
- the `vitest` bin path and the `references/deepseek-harness-test-use` source
  redirects in `packages/client/vitest.config.ts` resolve from the worktree
  (4 levels up from `packages/client/` = the repo root, where `references/` lives);
  `references/` was only READ (buildSrcMap readdir + alias targets), never written.

## Client typecheck

`cd packages/client; pnpm typecheck` → `tsc -p tsconfig.json` (noEmit, includes
`src` + `test` + `vitest.config.ts`): `typecheck-green.txt`.

## Plain-node shim surface (cross-check)

The `.test.ts` subset also runs under the repo's spawn-free shim runner
(`node scripts/run-tests.mjs client` from the worktree root — vitest shim:
`toBe` / `toEqual` / `toBeGreaterThan` / `toThrow`, sync `it` bodies).
Post-change result: `green-run-tests-client.txt`. This is the surface that
`team-ledger-store.test.ts` and `ledger-adapter.test.ts` must also pass under
(shim-constrained specs).

## Pre-existing baseline failure (NOT F11)

At base `9b582a1`, the client suite carries ONE pre-existing failure, unrelated
to the ledger: `test/team-creation-panel.client.spec.tsx > TeamCreationPanel >
create happy path (TCM M4 two-stage v2): ...` (AssertionError at L453,
`admitMock).toHaveBeenCalledTimes(0)` got 1) — byte-identical to the failure
already recorded in `dev/agent-workflow/evidence/team-d1-d6-repair-v2/G3/full-client.txt`
("the same pre-existing baseline failure D1 verified at a6d1778"). It is unchanged
by this task's diff (the failing spec is not touched by F11-L); baseline 577/578 →
post-change 590/591, all 13 new/updated F11 tests green.

## Forbidden-surface check

`git diff --stat 9b582a1` (worktree, pre-commit) is confined to
`packages/client` (see `diff-boundary.txt`); `packages/remote` (incl. the frozen
tracker `push/ledger-page.ts`), server, contracts, wire schema, upstream
(`references/`), `docs/plans/active/`, `dev/agent-workflow/graph.yaml`, and
`SESSION_ROUTER_LOG.md` are untouched. No push.
