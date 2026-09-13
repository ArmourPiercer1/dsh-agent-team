# A2C-7 — subtree Resource Matcher (alpha.2 capability completion, Wave 3)

**Status: GREEN — complete, all gates pass.** Branch `task/a2c-7-subtree-matcher`
(base `e95a57e` = INT_W2 @ 4c4273f, A2C-1/2/4/5 merged). Work confined to
`.worktrees/a2c-7`. No push performed. CORE PATCH BUDGET = 0 respected
(verify-zero-core: 0 findings; upstream `tests/deepseek-harness-test-use`
pristine @ a66e470204 untouched).

## What was built (end-to-end `subtree` PermissionResource)

1. **A1 schema (domain)**: `PermissionResource` union gains
   `{ kind: 'subtree'; path }`; `PERMISSION_RESOURCE_KINDS = ['exact',
   'subtree', 'any']`; subtree paths carry the SAME trim/non-empty/length
   (≤1024)/no-control-char constraints as exact (one normalization path);
   closed shape (extra field rejects); `read/read_image/write/edit/lsp`
   accept subtree in allow/ask/deny; **`bash`/`pwsh` subtree is schema
   REJECTED in every lane** (A2C-1 shell contract: shell keeps `any` in
   ask/deny only — message texts byte-identical); exact/any unchanged.
2. **A5 adapter (runtime/operation-permission)**: per-decision
   decision-LOCAL opaque-handle batch — `resolveTracked` wraps the injected
   resolver and registers `key → opaque FsTarget handle` in a Map created
   in `enforce` and dropped at decision end (NO cache, no install-lifetime
   state — H4). `canonicalLane` canonicalizes subtree rule roots FRESH per
   decision through the same live seam as the operation (a retargeted
   alias follows its new target on the next decision) and computes the
   match as `containsOperation = fs.contains(rootTarget, opTarget)` via the
   NEW optional `containsTargets` seam (the pinned upstream PUBLIC
   `FileSystem.contains` — the ONLY legal authority; `rootKey` is provenance
   only, never consulted by the matcher). Failure semantics (plan §9.8):
   deny subtree uncanonicalizable/undeterminable → **FAIL CLOSED → deny**
   (frozen P1-3 reason text + `deny-canonicalization-failure` stage
   preserved verbatim; additive `causes` provenance on the observe row);
   allow → non-match (no grant minted); ask → non-match, never reported
   (P1-3 lane asymmetry; documented residual: fall-through to a matching
   allow is the same frozen behavior as an exact ask-rule failure).
3. **A3 pure resolver (permission-resolver.ts)**: `CanonicalRule.resource`
   gains `{ kind: 'subtree'; rootKey; containsOperation }`; `ruleMatches`
   matches the subtree variant on the boolean ONLY. The module remains
   PURE: zero DSH/fs imports (SPECIAL gate: grep-verified — its only two
   imports are type-only, domain types + local types; every
   `FileSystem`/`startsWith` token in the file is a doc comment stating the
   prohibition).
4. **Glue (host.ts + agent-bindings.mjs)**: the deps `fsBackend` accessor
   gains an optional `contains?` passthrough (same lazy `ctx.get('fs')`
   basis, per call, only exposed when the provider exposes it); the
   `resolveTarget` closure returns the OPAQUE `FsTarget` as the additive
   `handle` field (A2 ignores it); a new `containsTargets` closure passes
   the seam to the adapter (a provider without `contains` → the adapter's
   undeterminable/fail-closed semantics, not an install error —
   pre-A2C-7 installers unaffected).

## Commits (this branch)

See `git log --oneline e95a57e..HEAD` after this report is committed:

1. `A2C-7: subtree permission resource kind end-to-end (schema, A5 decision-local containment seam, A3 pure matcher, glue)` — domain src (schema/types/validate/fixtures) + domain a1 test + runtime src (types/permission-resolver/pre-execute-adapter/host/agent-bindings) + the new test file.
2. `A2C-7: evidence (seam recon, RED log, evidence notes, report)` — `dev/agent-workflow/evidence/alpha2-capability-completion/a2c-7/`.

**new source/test files added = 1**
(`packages/runtime/test/a2c7-subtree-matcher.test.ts`, 1769 lines, 31
tests). All other files are edits to existing tracked sources/tests.

**expected scanner delta (p4t6 filesScanned pin) = 1** (695 → 696 — one new
`.test.ts` under `packages/`). Actual: **696** — matches exactly. The pin
file (`packages/testkit/test/p4t6-session-event-scan.test.ts`) was NOT
modified (contract); the 9 other p4t6 tests pass (my file carries none of
the denylist tokens). The pin bump is a main-agent action after the wave
merge.

## Gate table

| gate | result |
|---|---|
| focused vitest: a2c7 (new) + a2 + a2c1 + a2c2 + a2c4 + a2c5 + a3 + a5a + h4 + a1 (domain) | **10/10 files, 265/265 tests PASS** |
| new suite under plain-node shim (`node scripts/run-tests.mjs runtime`) | **31/31 PASS** (shim-safe: toBe/toEqual only) |
| `node scripts/run-tests.mjs domain runtime` vs pristine base (stash-verified @ e95a57e) | **zero new failures** — the per-file PASS/FAIL lines diff to exactly: a1 43→48 tests (my +5 subtree tests, PASS) and my new file PASS 31/31. The 12 pre-existing failing files (domain t1 10/17, t2 1/15; runtime a6a, bp1×3, d1×2, d1-s6 6/14, d2-s6 5/10, d3 import-error, d5 2/9+top-level crash truncating the loop) are IDENTICAL on base and current — pre-existing shim-surface/path-layout issues, out of scope. |
| typecheck domain | 0 errors |
| typecheck runtime | 0 errors |
| `pnpm build` | exit 0; `packages/runtime/dist` + `packages/client/composition-shim` reverted via `git checkout --` (no dist in any commit) |
| `verify-zero-core --host tests/deepseek-harness-test-use` | **0 findings** (upstream pristine) |
| private-import check (all 11 touched files) | only PUBLIC `@deepseek-ai/*` package roots, all pre-existing in agent-bindings.mjs (dsh-session/dsh-agent/dsh-llm/dsh-mcp-client/dsh-scope); A2C-7 adds no new deepseek-ai import |
| **SPECIAL — A3 purity** (permission-resolver.ts: zero DSH/fs imports) | **PASS** — exactly two imports, both `import type` (domain types + local types); all 11 `FileSystem`/`startsWith`/`deepseek-ai` token hits are doc comments stating the prohibition |
| `npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | 9/10 — the coverage pin fails `expected 696 to be 695` = the recorded expected delta (+1); pin file untouched |
| RED evidence (pre-fix) | `red-run.log`: authoritative recapture **16 failed | 15 passed** — all 16 failures are subtree-discriminator probes on pre-fix facts; the 15 passes are regression pins that must hold pre-fix too |
| §1.6 invariants / frozen texts | h4 + a5a reason-text pins pass unchanged; A2C-1 shell message texts byte-identical (G14); A2C-5 omitted-limit null identity untouched (a2c5 20/20); A2C-2 coverage gate untouched (a2c2 PASS) |

## RED pointers

- `dev/agent-workflow/evidence/alpha2-capability-completion/a2c-7/red-run.log`
  — two captures. First capture 17F/14P included ONE test-file fragment bug
  (mine — a wrong message fragment in the G14 A2C-1 byte-identity test);
  the log records the fix and the authoritative recapture: **16F/15P**.
- The stash step of the RED protocol was a documented no-op (no tracked
  edits existed pre-RED — the new test file was untracked and loads cleanly
  against pre-fix sources via namespace imports); pop verified (git status
  clean, no stash entries).

## Deviations (recorded)

1. **Worktree relocation**: the contract-path worktree was found NESTED at
   `.worktrees/a2c-int/.worktrees/a2c-7`; relocated to the contract path
   via `git worktree move` from the main repo (same branch/HEAD, no
   content change).
2. **Brief fact outdated**: "tests have NEVER used a real fs backend" —
   `packages/runtime/test/a2-canonical-operation-realfs.mjs` (A2C-1) DOES
   (real `LocalFileSystem` + real `resolve()`). A2C-7 extends the same
   recipe with the `contains()` seam instead of introducing a new pattern
   (seam-recon.md records both).
3. **Ask-lane failure = non-match** (P1-3 residual): a failed ask subtree
   rule is not reported and can fall through to a matching allow rule —
   the same frozen behavior as an exact ask-rule failure; documented in
   the adapter doc + evidence-notes.md §1.
4. **run-tests baseline**: the contract's "10-file/20-test" baseline is
   stale for this worktree; the true base (stash-verified) carries 12
   failing files (see gate table). Gate applied as "zero new failures vs
   base" — satisfied.
5. **Windows-casing group (G8)**: implemented as the backend-semantic
   equivalent on the Linux host (case-sensitive local backend → casing
   variant is a distinct identity → non-match); on NTFS the same spelling
   would match. Case semantics belong to the backend's `contains()`; the
   module never case-folds. Recorded in evidence-notes.md §5.

## Open risks / follow-ups (none blocking)

- **p4t6 pin bump** (695→696) is owed to the main agent after this wave's
  merge — the pin file is outside A2C-7's write scope.
- The 12 pre-existing shim-runner failures (a6a/bp1/d1/d2/d3/d5 + domain
  t1/t2) predate A2C-7 and are untouched by it (identical on base) — a
  separate repair task's scope.
- `containsTargets` tolerates a thenable for a future async backend; the
  pinned upstream `FileSystem.contains` is synchronous (verified at
  fs/src/index.ts L157) — no async path is exercised today.
- Real-backend retarget coverage is Linux-local (symlink); the Windows
  junction delta is recorded, not executable on this host.
