# TEST_METHODS.md baseline update — DRAFT (R122, pending final evidence)

Status: DRAFT — apply to docs/TEST_METHODS.md only at R122 closure, with recorded
rationale (allowed: user-rulable execution-protocol doc; change must be recorded).

## Context

- Old baseline (P9 era): upstream `0.1.2-alpha.1` @ `cd5ef8148158c3a752a658978873241fdf8e2bbc`
  (12-char short `cd5ef814` used as `DSH_CLIENT_COMMIT_HASH` env pin).
- New baseline (R122): upstream `0.1.2-rc.1` @ `76fda729799fe9b3848dbe2c211d4b231032b81e`
  (10-char short `76fda72979`). User updated both reference trees in place on
  2026-09-04; `references/deepseek-harness` (frozen legacy fork) verified unchanged
  at HEAD lock `a3ab319927...` (the update was a no-op for that tree — separate fork).

## Proposed edits (exact)

1. Every occurrence of the upstream pin:
   - `cd5ef8148158c3a752a658978873241fdf8e2bbc` → `76fda729799fe9b3848dbe2c211d4b231032b81e`
   - `cd5ef814` (short form in `DSH_CLIENT_COMMIT_HASH` env examples) → `76fda72979`
2. Version label `0.1.2-alpha.1` → `0.1.2-rc.1` at the pin sites.
3. Add one recorded-change line (rationale + date + ledger ref):
   > 2026-09-04 (R122, SESSION_ROUTER_LOG): baseline moved to 0.1.2-rc.1 @
   > 76fda72979 after the user's in-place upstream update; full-repo compat
   > adaptation on task/upstream-rc1-compat (upstream zero-change; all
   > adaptation in-repo). Boot/gentry evidence: evidence/upstream-rc1-compat/.

## Verification before applying

- [ ] TU tree clean at 76fda72979 (porcelain 0) — re-check at closure.
- [ ] s8 vertical on 3180: boot marker, 401, dump-config rows, p6t6 health,
      serveCheck — all green under the new pin.
- [ ] Gentry failures [] under the new pin.
- [ ] Five-gate chain green in RC1 worktree (vitest/typecheck/build/lint per
      package; smoke covered by the 3180 vertical).

## Build-environment notes to record (new findings, R122)

- `DSH_CLIENT_COMMIT_HASH` semantics (rc.1 scripts/client-build-environment.ts):
  env value overrides the in-build git spawn and is truncated to 7 chars for the
  artifact binding; the `repositoryGitDirty` probe degrades to undefined under
  sandbox EPERM, so the build is safe with the env pin set.
- Upstream `pnpm run clean` cannot run under Node 24 strip-mode
  (scripts/ts-project.ts:94 uses a TS parameter property); a clean-equivalent
  sweep script is kept at evidence/upstream-rc1-compat/sweep-build-outputs.ps1.
- In-place-updated trees carry stale gitignored build outputs that shadow the
  new sources (first observed: packages/client/ui-deliverables/lib/types/index.js
  importing rc.1-removed FIRST_PARTY_SECTION_ORDER; tsdown entries consume the
  tsc-emitted lib/types, so stale emits break the bundle). Sweep before rebuild.
- The `[@deepseek-ai/dsh-root] Cannot find entry: ["lib/types/{index,invariant,
  startup}.js"]` tsdown failure is NOT a root-project entry problem: in tsdown
  0.22.2 workspace mode the repo-root config only drives member discovery
  (resolveConfig never builds the root project). The real cause is manifest-less
  ORPHAN package directories left by the in-place alpha.1→rc.1 update (git
  removed tracked files, pnpm-installed node_modules kept the dirs alive):
  packages/code-runtime/code-runtime-python, packages/examples/agent-spine-demo,
  packages/session/session-persistence-sqlite,
  packages/subagent/tool-subagent-report. Each matches the `packages/*/*`
  workspace glob, has no local package.json, so readPackageJson walks up to the
  repo root (name `@deepseek-ai/dsh-root`), inherits the host entry glob, and
  fails entry resolution. Clean-tree probe (detached worktree TU-CLEAN-PROBE at
  76fda72979, fresh frozen-lockfile install) builds the identical
  `pnpm run build:lib:host` sequence green — proof the orphan dirs were the
  blocker. Fix = delete the four dirs (contents = node_modules only, exactly
  the `pnpm run clean` known-safe residue set node_modules|lib|.typecheck|
  *.tsbuildinfo); tree stays porcelain-0.
