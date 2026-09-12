# A2C-2 — gate table

Base: `b96faf3` (task/a2c-2-permission-coverage-gate).
Worktree: `.worktrees/a2c-2`. All gates run in the worktree on the
branch tree unless noted.

| # | Gate | Command | Result |
| --- | --- | --- | --- |
| 1 | Focused vitest (this task's file) | `npx vitest run packages/runtime/test/a2c2-permission-coverage.test.ts --reporter=verbose` | **PASS** — 18/18 tests (`green-run.log`) |
| 2 | Runtime package suite (plain-node shim, canonical chain) | `node scripts/run-tests.mjs runtime` | **PASS (no new failures)** — file-level results IDENTICAL to the base-tree run except the new file `a2c2-permission-coverage.test.ts` PASS (18 tests); per-test failure diff base↔branch = EMPTY (18 ✗ lines each, byte-identical); the pre-existing runner crash at `d5-instance-contract.test.ts:109` (shim matcher gap: `toHaveLength` / `async it`) occurs at the IDENTICAL point on the base tree (pre-existing, not introduced) |
| 3 | Post-crash runtime files (vitest — the files the shim run never reaches) | `npx vitest run <143 files from d5-instance-contract onward>` (+ this task's file) | **PASS (strict subset)** — base: 6 files / 9 tests failed; branch: 5 files / 7 tests failed. The 2 base failures (`p6t1-parallel`, "N=2 same-template parallel activations") are a FLAKY test — 3 branch re-runs: 9/9, 8/9, 9/9 (passes on the branch in the comparison run). Remaining branch failures = the documented baseline set: `p6t3-mediation` ×5, `p6t3-restart` ×2, `p8s3b-result-effects` (file-level), `t12a-b2-child-identity` (file-level), `t12a-glue-handoff-ports` (file-level) |
| 4 | typecheck (touched packages) | `npx tsc -p packages/runtime/tsconfig.json --noEmit` | **PASS** — clean. Touched packages = runtime only (domain/blueprint + tools are imported read-only, unmodified) |
| 5 | Full build | `pnpm build` | **PASS** — exit 0 (tsc per package). Tracked dist emissions REVERTED afterwards: `git checkout -- packages/runtime/dist` + removed the 4 untracked `permission-coverage.{js,d.ts,map}` emits (dist belongs to the integration/release flow, not this commit) |
| 6 | Zero core patch | `node scripts/verify-zero-core.mjs --host tests/deepseek-harness-test-use` | **PASS** — 0 findings (upstream tree pristine @ `a66e470204`; the two `node-pty` INFO lines are upstream's own dependency patching) |
| 7 | Private-import audit | grep over the 5 new/modified files (below) | **PASS** — see detail |
| 8 | P4-T6 self-cleanness | `npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | **PASS (expected delta)** — zero denylist violations outside the quarantine set, zero legacy payload symbols, zero merging patterns (the 3 self-cleanness assertions + controls all green over the tree INCLUDING the 2 new files); the ONLY failure is the `filesScanned` pin: expected 692, received **694** = the expected +2 (the new `permission-coverage.ts` source + the new `a2c2-permission-coverage.test.ts`). The pin update belongs to the main agent at the integration tip (DEC-1 union) — reported, not applied (the p4t6 test file is NOT modified) |
| 9 | Hardening suites (H1/H4/H5 no-regression) | via gates 1-3 | **PASS** — `a2c1-pwsh-permission` 28/28 (shim), `a5a-pre-execute` 50/50 (shim), `a2c4-external-lastmile` 11/11 (shim), `h1a-pre-execute-endcap` 49/49 (vitest), `h4-rule-identity` 10/10 (vitest), `h5-bash-effects` 25/25 (vitest) |
| 10 | Legacy zero-change (invariant §1.2) | structural + suite parity | **PASS** — every new glue statement is inside `if (permissionPolicy !== undefined)` (pre-MCP snapshot L1274-L1277 + gate L1282-L1318); an absent policy executes zero gate code (the pure condition is `permissionCoverageGateEnabled(permissions) === (permissions !== undefined)` — tested S2). The alpha.1/legacy suites (d1/d2/d5 families, p5t*, the issue2 suites) show base-identical results (gates 2-3) |

## Gate 7 detail — the private-import audit

- `packages/runtime/operation-permission/permission-coverage.ts`:
  ZERO `@deepseek-ai/*` imports, ZERO `node:` imports (pure; the
  domain type import is `import type { TemplatePermissionPolicy }`
  from the in-repo `domain/blueprint` facade — a relative in-repo
  import, no upstream).
- `packages/runtime/operation-permission/errors.ts` / `index.ts`:
  no new imports (re-exports only).
- `packages/runtime/src/plugin/live/agent-bindings.mjs`: the upstream
  imports are `@deepseek-ai/dsh-session` (L277), `dsh-agent` (L278),
  `dsh-llm` (L279), `dsh-mcp-client` (L280) — ALL pre-existing public
  root imports; the ONLY new upstream import is
  `import { scopeOf } from '@deepseek-ai/dsh-scope'` (L319) — a
  PUBLIC ROOT export of the scope package, an established seam in this
  repo (already imported by `h1a-pre-execute-endcap.test.ts`,
  `issue2-capability-permission-precedence.test.ts`,
  `a2c1-pwsh-permission.test.ts`; `scopeOf` already used in
  production sources: `root-binding/harness/slots.mjs`,
  `root-binding/harness/plugin.mjs`, `control/service.ts`,
  `member-residency/harness/{plugin,slots-t6}.mjs`).
- DEEP subpath imports (`@deepseek-ai/*/src/...`, `lib/...`,
  `internal/...`, `dist/...`) in any of the 5 files: NONE.
- Test file imports: the same public root packages a2c1 uses
  (cordis, dsh-scope, dsh-system-prompt, dsh-tools, dsh-llm,
  dsh-session type-only, dsh-agent type-only) + in-repo relative
  imports.

---

# Re-gate (main-agent merge-block repair — the t12a-live-bridge double gains
# the `tools.schemas` seam + the agent scope tag)

Context: the main agent's re-gate found the A2C-2 gate FATAL-ing
`a6a-production-wiring.test.ts` (file-level "no tests") in vitest — the
t12a bridge's recording double carried neither the `tools.schemas` seam
nor a scope tag on the setup ctx, so the gate's fail-closed surface read
(alpha2-permission-coverage-surface-unavailable) rejected the a6a world
(the A6 blueprint declares capabilities.permissions on leader + tpl-a).
A second affected file with the same root cause (found while fixing:
`bp1-dual-team-gate.test.ts` — also a permissions world) — both are
repaired by the double fix, commit 3.

Fix (the established double-extension pattern — alpha.1 added
tools.restrict, H1 added tools.guard; the product grew a public seam,
the double records it):
1. `tools.schemas(scope?)` on the double: one entry per tool registered
   through the double's own `tools.register` (the current set — the
   register disposer's unwind removes it) minus the accumulated
   `tools.restrict({ deny })` union; deterministic `{ name, description }`
   sorted by name. Flat-layer semantics documented in the seam's inline
   comment (the flat approximation of the real inherited-layer mask —
   no repo world observes the divergence: the preset double mount
   registers no base tools, and no repo deny list names a team tool).
2. The double's `plugin()` now returns fibers carrying a `.ctx`
   (minimal Context-like with a symbol-preserving `extend` — the dsh-
   scope tag is a symbol; `Object.entries` would drop it) and
   `makeHandle` mints each agent's scope through the PUBLIC
   `createScope(ctx, agent)` (@deepseek-ai/dsh-scope) BEFORE the setup
   callback runs — exactly the real Agent's constructor
   (`this.scope = createScope(loopCtx, this); this.ctx =
   this.scope.ctx.extend({ agent: this })`). RULING: the scope's
   backing plugin (dsh-scope's private no-op function) is NOT recorded
   in the double's `plugins` array (function spec = scope plumbing, not
   a world mount) — this keeps H1-3's `plugins.length === 0` zero-mount
   pin and t4a's mcpMounts/mcpAllDisposed semantics intact; the world's
   own plugin calls (non-function spec: the MCP client with its
   options) record exactly as before.

| # | Gate (re-run) | Command | Result |
| --- | --- | --- | --- |
| R1 | a6a SOLO (the merge-block file) | `npx vitest run packages/runtime/test/a6a-production-wiring.test.ts` | **PASS** — 52/52 (was file-level FATAL: surface-unavailable) |
| R2 | a2c2 + a6a pair | `npx vitest run .../a2c2-permission-coverage.test.ts .../a6a-production-wiring.test.ts` | **PASS** — 70/70 |
| R3 | bp1-dual-team-gate (the second affected file) | `npx vitest run .../bp1-dual-team-gate.test.ts` | **PASS** — 8/8 (was file-level FATAL: no scope tag) |
| R4 | the main agent's R1 focused set (a2c2+a2+a3+a4a+a5a+a2c1+a2c4+a6a) | `npx vitest run <8 files>` | **PASS** — 8/8 files, **246/246 tests** (194 pre-fix + a6a's 52 — the recomputation of the "194 or recomputed count") |
| R5 | extended focused set (R4 + bp1 + h1a + h4 + h5) | `npx vitest run <9 files>` | **PASS** — 9/9 files, 251/251 tests |
| R6 | FULL ROOT vitest (the definitive per-file check) | `pnpm test` | **PASS (expected set)** — `Test Files 11 failed \| 272 passed (283)`, `Tests 21 failed \| 3366 passed (3387)`. The 11 failed files = the 10 baseline files + p4t6 (the filesScanned pin 692 vs 694 — DEC-1 union at the integration tip) and NOTHING else: `domain/t1-capability-schema` (9/17), `domain/t2-blueprint-hash` (1/15), `legacy/p7t6-teammates-adapter` (1/20), `runtime/p6t3-mediation` (5/7), `runtime/p6t3-restart` (2/5), `runtime/d3-member-identity-context` (1/5), `tools/p6t6-actions` (1/14) — test-level baseline; `runtime/p8s3b-result-effects`, `runtime/t12a-b2-child-identity`, `runtime/t12a-glue-handoff-ports` — file-level baseline (errors verified to be the documented baseline ones: the frontmatter TeamContractError / capability-template-unresolved — NOT coverage-gate errors); `testkit/p4t6-session-event-scan` (1/10 — the pin). a6a and bp1-dual-team-gate now PASS; p6t1-parallel passed in this run (the documented pre-existing flake) |
| R7 | node chain (plain-node shim, canonical) | `node scripts/run-tests.mjs runtime` | **PASS (unchanged)** — per-file PASS/FAIL lines AND per-test ✗ lines byte-IDENTICAL to the pre-fix branch run (the 18 baseline ✗ + the pre-existing d5 shim crash at the same point). NOTE: a6a + bp1-dual-team-gate are node-chain baseline-FAIL files (shim-runner gaps) — that is exactly why the node chain masked the vitest regression (the main agent's merge-block note) |
| R8 | runtime typecheck | `npx tsc -p packages/runtime/tsconfig.json --noEmit` | **PASS** — clean (covers the .d.mts type additions) |
| R9 | full build | `pnpm build` | **PASS** — exit 0; dist reverted afterwards (`git checkout -- packages/runtime/dist` + the 4 untracked permission-coverage emits removed) |
| R10 | zero core patch | `node scripts/verify-zero-core.mjs --host tests/deepseek-harness-test-use` | **PASS** — 0 findings |

Evidence logs: `fullroot-regate.log` (this run's exact failed-file
list + summary), `regate-main-agent.log` + `diag-fullrun.log` (the main
agent's merge-block re-gate logs, kept as the primary evidence).
