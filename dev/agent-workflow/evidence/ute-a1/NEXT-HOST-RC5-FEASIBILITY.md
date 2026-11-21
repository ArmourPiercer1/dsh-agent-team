# The vNext slice on the NEXT host (DSH 0.2.2-rc.5 @ `9c2670d3`) — feasibility, measured

Read-only investigation, 2026-11-22. Verdict: **RUNNABLE WITH HARNESS WORK** (~4–6 h), no missing core
seam. Nothing here was built or started.

## State of the rc.5 tree

- Present at the pin: HEAD `9c2670d3bce5275e0d1610272958121af87787bb`, tag `dsh-v0.2.2-rc.5`, version
  `0.2.2-rc.5`.
- **NOT installed and NOT built**: no `node_modules`, no `packages/fs/tool-fs/lib/index.js`, no
  `apps/cli/lib/bin.js`. The lane's verifier would throw `NOT_BUILT`
  (`tests/next-host/host-next-lib.mjs:150-152`).
- Worktree host trees are **symlinks to the main checkout**, so provisioning writes a tree shared by
  every worktree: schedule it, do not do it ad hoc.
- Commands (documented, not run): `node scripts/provision-next-host.mjs --materialize`, then
  `--assets` (needed for SLICE-33: rc.5 `sandbox-local` imports
  `@deepseek-ai/node-addon-system/landlock-run`). Measured cold cost 4 m 49 s
  (`docs/TEST_METHODS.md:264-266,281-282,366`).

## What would have to change (harness, not product)

1. **Host-anchored module resolution.** Repo `node_modules/@deepseek-ai/*` are published **0.2.0-rc.2**
   symlinks, and the world factory hard-codes `testUseTree(...)`
   (`tests/world-factory/lib/a5sf-fs-contract-world.mjs:145-156`). Without host-anchored resolution
   through `createRequire(<host tree>/<anchor>))` the slice would keep testing rc.2 modules while
   claiming rc.5 — a false green, the worst possible outcome. Precedent:
   `tests/next-host/host-next-lib.mjs:238-252`.
2. **`workingDirectory` (rc.5).** `dsh-tool-fs` now statically injects
   `['tools','fs','systemPrompt','workingDirectory']` (`.../fs/tool-fs/src/index.ts:24`), and Cordis
   SILENTLY DEFERS a plugin with unmet static inject — the world would register no preset
   `read/write/edit` and the realm mount would answer `DEFINITION_MISSING`. At call time
   `sessionResolveOptions` is async and calls `ctx.workingDirectory.ensure(...)`
   (`.../tool-fs/src/session-cwd.ts:15-24`).
3. **Batch dispatch (rc.5).** `tools.execute(input: ToolBatchInput)` behind an executor
   (`packages/core/tools/src/index.ts:375-377`, `executor.ts:19-57`); `selectExecutor` throws
   `TOOL_EXECUTOR_UNAVAILABLE` until `@deepseek-ai/dsh-tool-executor-native` is mounted. The slice's
   `dispatch()` must build `{calls:[{type:'tool-call', id, name, arguments: JSON.stringify(args)}],
   signal, agent}` and read `batch.results[0].result`. `ToolCallBlock.arguments` is a raw JSON string.
4. Unchanged and compatible (measured, not assumed): `tools/pre-execute` waterfall `(exec,next)`,
   `tools/result` `(exec,result)`, `tools.guard` returning a disposer, the `PreToolDecision` union
   (incl. `ask`), `createScope`/`bindScopeParent`/`scopeTarget` (byte-identical), and the FS provider's
   `readText/streamText/writeText/editText` surface.

## Confinement gap this investigation found (report, do not fix in a harness task)

rc.5's `FileSystem` adds **`patchText`, `deleteFile`, `moveFile`**
(`.../fs/fs/src/index.ts:325,345,368`). The Team confined provider overrides ten methods ending at
`editText` (`packages/runtime/team-services/src/fs.ts:208-269`) — **none of the three new ones**. On
rc.5, `apply_patch`, delete and move would therefore reach the underlying provider WITHOUT the
Member's lane. The current slice never exercises them (`apply_patch` defaults false), which is exactly
why it would stay invisible.

Status: **not fixed, and NOT claimed as confined.** It requires three overrides in the Team provider
plus arms; it belongs with the host-upgrade work, and D's host list must not say "FS confinement holds
on rc.5" until it is done.

## Blockers, in order

| # | kind | what | resolution |
| --- | --- | --- | --- |
| B1 | environment | rc.5 tree not installed/built | `provision-next-host --materialize` (+`--assets`), ~5 min, shared tree |
| B2 | harness | no host-anchored resolution for factory or TEAM bare imports | add a host selector (`TEAM_TEST_HOST=next\|legacy`) and resolve from the selected tree |
| B3 | harness | rc.5 `tool-fs` needs `workingDirectory` | mount the real service, or a LABELED double (the slice already doubles `approval`) |
| B4 | harness | batch + executor dispatch | mount `dsh-tool-executor-native`, rewrite `dispatch()` |
| B5 | product | three unconfined FS methods | three overrides in `team-services/src/fs.ts` + arms (not this task) |
| B6 | risk | rc.5 behavioural drift may legitimately red some arms | only a first green run can tell drift from a porting bug |

No `CORE_SEAM_BLOCKER`: every API the slice needs exists on rc.5 with a compatible shape.
