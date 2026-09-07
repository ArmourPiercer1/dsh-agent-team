# F9 run recipe (F3/F11/F9/T1.4 repair round r1)

Worktree: `.worktrees/repair-r1-f9` — branch `task/repair-r1-f9-human-control`
(from `int/repair-r1` @ `4f6e4f9`). Node 24.20.0, Windows, workspace-write
sandbox. `node_modules` installed once at worktree creation
(`pnpm install --ignore-scripts`).

## Sandbox constraints that shape the recipe

1. **`vitest` cannot start directly** in this sandbox (vite's
   `windowsSafeRealPathSync` execFile's a child during config load → EPERM,
   documented since P1-T5). The plain-node runner
   `scripts/run-tests.mjs` exists for the `.test.ts` files.
2. **`pnpm -r` / `pnpm build` fail with EPERM spawn** (pnpm spawns one
   process per package). Emulate with direct `npx tsc` per package.
3. **The client vitest DOES run in-sandbox** via the F11 netuse stub
   (precedent: the F11 round). Copy the stub from the F11 worktree:
   `Copy-Item .worktrees\repair-r1-f11\.f11-vitest-netuse-stub.mjs
   .worktrees\repair-r1-f9\.f9-vitest-netuse-stub.mjs` (uncommitted
   scratch; the stub intercepts the `net` import vitest's watch/pool layer
   touches).
4. **The audited shim matcher surface** (`scripts/test-vitest-shim.mjs`) is
   ONLY `toBe` / `toEqual` / `toBeGreaterThan` / `toThrow` (+ `.not`).
   No `toContain` / `toBeDefined` / `toBeTruthy` / `toHaveLength` /
   `toBeUndefined` / `toBeInstanceOf`. New/updated tests use
   `expect(String(x).includes(y)).toBe(true)` / concrete assertions.
5. **Async `it` bodies are unsupported by the shim**: async scenarios run at
   module top level (top-level await) and the `it` bodies assert
   synchronously over the captured state (the P7-T5 pattern).
6. **`d5-instance-contract.test.ts` crashes the plain-node runner** (a
   PRE-EXISTING baseline defect, verified with all F9 changes stashed):
   its async `it` bodies are rejected by the shim, and their detached
   microtask tails later throw `TypeError: expect(...).toHaveLength is not
   a function` as an UNHANDLED REJECTION, killing the runner process
   (Node ≥ 15 default) before the run-tests summary is printed. Any full
   `node scripts/run-tests.mjs runtime` therefore dies at d5 (alphabetical
   order) and never reaches the later files. The F9 sweep therefore uses
   the scratch targeted runner `scripts/f9-targeted-run.mjs`
   (UNCOMMITTED, same hooks + shim + per-file semantics as run-tests.mjs,
   explicit file list):
   - `--sweep-runtime` = every `packages/runtime/test/*.test.ts` EXCEPT
     `d5-instance-contract.test.ts`;
   - or explicit relative file paths as argv.
   d5 itself is runnable in its own process (its 2/9 shim-surface failures
   print before the crash) — baseline and F9 states are identical there.

## Commands (from the worktree root)

```powershell
# 1. remote package — plain-node shim (all remote .test.ts)
node scripts/run-tests.mjs remote
#    F9 result: 185 passed, 5 failed (the 5 = pre-existing d1-remote-v3
#    toBeDefined shim limitations; baseline 147/6 — see baseline-pre-f9.txt)

# 2. runtime package — targeted sweep (d5 excluded; see constraint 6)
node scripts/f9-targeted-run.mjs --sweep-runtime
#    F9 result: 1287 passed, 23 failed (the 23 = the six pre-existing
#    shim-surface files, identical to baseline 1265/23)
#    F9 files only:
node scripts/f9-targeted-run.mjs packages/runtime/test/f9-s6-resolve-control.test.ts packages/runtime/test/f9-control-exactly-once.test.ts
#    → 22 passed, 0 failed

# 3. client package — vitest via the in-sandbox stub
node --import ./.f9-vitest-netuse-stub.mjs node_modules/vitest/vitest.mjs run --root packages/client
#    F9 result: 607 passed, 1 failed (the 1 = pre-existing
#    team-creation-panel "create happy path", identical to baseline 593/1)
#    F9 files only:
node --import ./.f9-vitest-netuse-stub.mjs node_modules/vitest/vitest.mjs run --root packages/client test/f9-remote-client-v4.test.ts test/f9-resolve-control-ui.client.spec.tsx
#    → 14 passed (5 + 9)

# 4. typecheck (all three touched packages)
npx tsc -p packages/remote/tsconfig.json --noEmit
npx tsc -p packages/runtime/tsconfig.json --noEmit
npx tsc -p packages/client/tsconfig.json --noEmit
#    → exit 0 each

# 5. build (pnpm -r is spawn-denied → direct tsc per package, topo order)
npx tsc -p packages/contracts/tsconfig.build.json
npx tsc -p packages/domain/tsconfig.build.json
npx tsc -p packages/storage/tsconfig.build.json
npx tsc -p packages/remote/tsconfig.build.json
npx tsc -p packages/runtime/tsconfig.build.json
npx tsc -p packages/tools/tsconfig.build.json
npx tsc -p packages/client/tsconfig.build.json
npx tsc -p packages/legacy/tsconfig.build.json
npx tsc -p packages/testkit/tsconfig.build.json
#    → exit 0 each

# 6. composition artifacts (committed mirrors — check-artifacts-committed
#    enforces their committed state in a normal environment)
node scripts/place-dist-glue.mjs
node scripts/build-client-composition.mjs packages/client packages/client/composition-shim
#    → "86 modules, 11 css files"; client-bundle.js regenerated
#    (914,453 B → 937,014 B, carries team.resolveControl × 15)
#    check-artifacts-committed.mjs spawns git (EPERM here) → equivalent
#    hand-verified: git ls-files (tracked) + git check-ignore (exit 1) +
#    .gitattributes eol=lf pins for both artifact trees.
```

## Acceptance mapping

| acceptance | evidence |
|------------|----------|
| V4 (versioned Remote v4, catalog/version/params closed surface, v1–v3 rejection preserved) | `packages/remote/test/f9-remote-v4.test.ts` (36 tests) + updated pins (d1-remote-v3, p8t3-*, p8t4-*, tcm-m1-remote-v2, p8s7r4-bc23-24, t12m4-remote-mount) |
| F9H-T1 (durable exactly-once: host-stamped human allow, second resolve → CONTROL_REQUEST_DECIDED, guard consumes once, restart-proof) | `packages/runtime/test/f9-control-exactly-once.test.ts` |
| F9H-T2 (unauthorized agent: member + leader rejected by the FROZEN user-approval role closure, zero side effects) | `packages/runtime/test/f9-control-exactly-once.test.ts` + `packages/runtime/test/f9-s6-resolve-control.test.ts` (no wire identity channel: spoofed caller/role → malformed-params) |
| authority (host derives the human principal from the validated owned session; foreign team → TEAM_REMOTE_FOREIGN_TEAM; absent closure → typed unavailable) | `packages/runtime/test/f9-s6-resolve-control.test.ts` (14 tests) |
| F9U-T1 (Allow/Deny command surface on pending control-request rows only) | `packages/client/test/f9-resolve-control-ui.client.spec.tsx` (9 tests) |
| F9U-T2 (typed error rendering with code + transport-loss note) | same spec |
| client wrapper (version-4 stamping, endpoint, verbatim closed params, intact outcomes) | `packages/client/test/f9-remote-client-v4.test.ts` (5 tests) |

## In-sandbox notes (F3-C precedent)

- vitest client runs above are the IN-SANDBOX stub runs; on a
  non-sandboxed machine the identical suite runs with plain
  `pnpm --filter @dsh-agent-team/client test`.
- The targeted runner + stub + debug script are UNCOMMITTED scratch
  (documented here for reproducibility); they are not part of the F9
  diff.
