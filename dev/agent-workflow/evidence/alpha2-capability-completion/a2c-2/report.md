# A2C-2 — report (Permission Coverage Gate)

**Status: DONE** — all contract items implemented, all gates green, RED
evidence captured, no deviations that change the contract.

Task: dsh-agent-team alpha.2 capability-completion round, Wave 2.
Worktree `.worktrees/a2c-2`, branch `task/a2c-2-permission-coverage-gate`,
base `b96faf3`.

## Commit list

| SHA | Subject | Content |
| --- | --- | --- |
| `8bf703d` | A2C-2: the Permission Coverage Gate — six-class authority-owner classification + strict setup gate (plan §7) | src + tests (5 files, +1916/-3) |
| (this commit) | A2C-2: evidence — RED/GREEN logs, seam recon, SAFE_UNMANAGED registry, gates, report | the `dev/agent-workflow/evidence/alpha2-capability-completion/a2c-2/` directory |

NOT committed (per contract): dist (reverted after `pnpm build`), the
`.tmp-t12a-b2-home` test artifact (removed), `graph.yaml`,
`SESSION_ROUTER_LOG.md`, the p4t6 test (pin update belongs to the
integration tip — DEC-1 union), no package.json/pnpm-lock.yaml changes,
nothing pushed.

## New source/test files added = 2

1. `packages/runtime/operation-permission/permission-coverage.ts` (NEW
   source — the pure evaluator module: the closed six-class
   `PERMISSION_COVERAGE_CLASSIFICATIONS`, the closed
   `SAFE_UNMANAGED_TOOL_NAMES` = `['todo_write']` registry, the closed
   `KNOWN_SENSITIVE_TOOL_NAMES` (14 names) + `KNOWN_SENSITIVE_TOOL_PREFIXES`
   (`['job_']` family), `classifyPermissionCoverageTool` (the fixed
   precedence managed > team > mcp > safe > sensitive > unknown),
   `evaluatePermissionCoverage` (the deterministic sorted verdict),
   `mcpIntroducedToolNames` (the proven-mount delta),
   `permissionCoverageGateEnabled` (the strict-mode condition),
   `buildPermissionCoverageErrorDetail` (the deterministic plan §7.4
   detail), the stable reason/remediation strings).
2. `packages/runtime/test/a2c2-permission-coverage.test.ts` (NEW test —
   18 scenarios: the plan §7.6 RED probes P1-P3 + the G1-G9 six-class
   matrix + F1-F3 FATAL lanes/typed error + S1-S3 real-seam legs).

MODIFIED existing files (in commit `8bf703d`):
`operation-permission/errors.ts` (the closed
`PERMISSION_COVERAGE_ERROR_CODES.ALPHA2_PERMISSION_COVERAGE_UNMANAGED`
+ `PermissionCoverageUnmanagedError` + the detail types + the type
guard + the deterministic message), `operation-permission/index.ts`
(the re-exports + the doc surface), `src/plugin/live/agent-bindings.mjs`
(the gate install: the `scopeOf` public-seam import, the
`PERMISSION_TOOL_NAMES` domain import, the pre-MCP snapshot
L1274-L1277, the gate block L1282-L1318, the `selectedTeamToolNames`
capture L1226, the fail-closed helpers L2356-L2395, the state field
L1119).

## Expected scanner delta = 2 (p4t6 filesScanned 692 → 694)

Measured: **694** (the expected value — the new source file + the new
test file; both scanned, both ZERO denylist tokens: the
self-cleanness assertions "zero denylist violations / zero payload
symbols / zero merging patterns" pass over the whole tree including
the new files). The p4t6 test file was NOT modified; the pin update
belongs to the main agent at the integration tip (DEC-1 union).

## Gate table

See `gates.md` for the full table + the private-import audit detail.
Summary: focused vitest 18/18 PASS; `run-tests.mjs runtime`
base-identical (per-test failure diff EMPTY) + the new file PASS;
post-crash batch = strict subset of the base failures (the 2 base
`p6t1-parallel` failures are a confirmed flake — 3 branch re-runs
9/9, 8/9, 9/9); runtime typecheck clean; `pnpm build` exit 0 (dist
reverted); `verify-zero-core` 0 findings; private-import audit clean
(the only new upstream import is the established public root
`scopeOf` from `@deepseek-ai/dsh-scope`); hardening suites
(a2c1 28/28, a5a 50/50, a2c4 11/11, h1a 49/49, h4 10/10, h5 25/25)
all green.

## RED pointers

- `red-run.log` — the RED run on the pre-fix tree (tracked edits
  stashed, untracked test file stayed): the file LOADS, 3/3 probes
  fail, each at the first post-fix gate leg (`gatePresent: false`),
  with the stable pre-fix characterization legs PASSING (the unknown
  tool stays on the surface; the web_fetch body runs under the REAL
  default-deny listener; grep/subagent/web_fetch are all outside the
  7-name managed vocabulary).
- `red-green-comparison.md` — RED (3/3 failed) → GREEN (18/18 passed);
  the same file, the same probes, only the fix moves the outcome.
- `green-run.log` — the GREEN run (18/18, verbose).

## SAFE_UNMANAGED registry content + evidence

Registry = EXACTLY ONE entry: `todo_write`.

Evidence: `safe-unmanaged-registry.md` — the file:line source review at
the pinned upstream `a66e470204`
(`packages/todo/tool-todo/src/index.ts`): L8-L15 imports are
type-only cordis + schema vocabulary (schemastery/zod) + the
`defineTool` helper (NO node: builtins, no fs/net/process, no MCP, no
subagent, no job, no messaging modules); L22-L23 `name = 'tool-todo'`
+ `inject = ['tools', 'sessionProjections']` (only the tool registry +
the session UI-state projection); L147 `name: 'todo_write'` (the one
model-facing tool); L203-L219 the executor: validates the whole-list
replacement (L204), REJECTS a non-agent caller (L205-L209), appends
ONE `todo/write` event to the OWNING agent's own session
(`exec.agent.session.append`, L210), returns the counts (L211-L219).
No external side effects of any kind → SAFE_UNMANAGED per plan §7.3-D.

The KNOWN_SENSITIVE_UNMANAGED closed set (the FATAL class): grep, glob
(A2C-6 deferred, plan §11.3), subagent, subagent_fork, ralph, workflow
(orchestration), web_fetch, web_search (egress), job_list, job_output,
job_kill (+ the `job_` prefix family — process control), send_message,
interrupt_agent, list_agents (the ordinary DSH agent
messaging/control surface). Everything else is UNKNOWN_UNMANAGED →
FATAL (fail-closed, plan §7.8 — an unreviewed preset-update tool
blocks under strict mode until reviewed).

## Deviations

- NONE that change the contract. Process notes:
  - The plan's line references (L1242-L1245 insertion) were re-verified
    on the actual tree; the gate landed at the verified point (after
    `applyBoundaryRecords`, before the A5 listener install block —
    `seam-recon.md` §7 with the post-edit line numbers).
  - `pnpm build` (plain tsc) emitted the new TS to dist — reverted per
    contract (`git checkout -- packages/runtime/dist` + the 4 untracked
    emits removed) before committing.
  - The canonical `node scripts/run-tests.mjs runtime` chain CRASHES at
    `d5-instance-contract.test.ts:109` (a pre-existing shim matcher
    gap: `toHaveLength` / `async it`) at the IDENTICAL point on the
    base tree — so the post-crash files were additionally verified via
    vitest on BOTH trees (the comparison is exact: branch failures ⊆
    base failures).

## Open risks / notes for the integration tip

1. **p4t6 pin**: the `filesScanned` pin must move 692 → 694 at the
   integration tip (DEC-1 union) — this task reports the delta only.
2. **Record-driven MCP mounts after setup** (the consumption/boundary
   path, `applyBoundaryRecords` on an already-set-up agent) are NOT
   re-gated: the gate is a SETUP-time integrity check of the
   setup-time surface (plan §7.2). The durable mcp facet's allow
   decision remains the alpha.1 authority; a strict template that
   permits an MCP server whose tools are sensitive/unknown is
   classified at setup (the delta proves the mount) — the residual
   window is a record flip between setup and the late reconcile,
   which is the alpha.1 consumption behavior (unchanged by this task).
3. **presetId in the error detail** is read from the
   `agentPresets.composedPreset(agentCtx)` public seam (the host's
   lazy accessor); when the service is absent it is the EXPLICIT
   `null` (never omitted) — the detail shape stays deterministic.
4. The standard preset (Linux) final surface under strict mode will
   FATAL out of the box: grep, glob, subagent, subagent_fork, ralph,
   workflow, web_fetch, web_search, job_*, send_message,
   interrupt_agent, list_agents are KNOWN_SENSITIVE_UNMANAGED and
   skill, get_goal, create_goal, update_goal, exit_plan_mode,
   ask_user_question, list_subagent_models are UNKNOWN_UNMANAGED (no
   reviewed owner in alpha.2). This is the INTENDED fail-closed
   posture (plan §7.8 + §16.1 "其他由 Coverage audit 判定的
   sensitive-unmanaged"): the deterministic error tells the strict
   Blueprint author exactly what to deny via `builtinToolDeny` (or
   review into the registries). A strict Windows worker blueprint
   (plan §16.1) additionally denies grep/glob/subagent/subagent_fork/
   ralph/workflow/web_fetch/web_search at the capability layer —
   consistent with the same gate.
5. The `p6t1-parallel` flake (N=2 parallel activations, passes/fails
   intermittently on the SAME tree) is pre-existing (it failed on the
   base in the comparison run); flagged for the integration tip —
   not introduced, not fixed here.
