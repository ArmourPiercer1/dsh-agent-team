# A2C-2 — SAFE_UNMANAGED registry (plan §7.3-D)

The `SAFE_UNMANAGED` class is a CLOSED exact-name registry. Membership
requires a source review of the pinned upstream tool source proving the
tool has NONE of: filesystem content read/write, process/shell/code
execution, network egress, arbitrary MCP/tool dispatch, generic
subagent orchestration, job process control, cross-team governance
messaging, or other material external side effect. A name that merely
"looks safe" is NOT evidence.

Pinned upstream: `tests/deepseek-harness-test-use` @
`a66e4702047846cdaa10c66c9d3df3951f5ea70d` (0.1.2-rc.1 official release
commit; pristine, read-only).

The registry in this task contains EXACTLY ONE entry:

## Entry 1 — `todo_write` (upstream `@deepseek-ai/dsh-tool-todo`)

**Verdict: SAFE_UNMANAGED — coverage passes with an optional diagnostic
only.**

### Source review (file:line, pinned upstream)

File: `packages/todo/tool-todo/src/index.ts`

| Lines | Evidence |
| --- | --- |
| L1-L6 | Module doc: "Model-facing whole-list replacement. Each call appends a `todo/write` snapshot to the calling agent's session; replay is last-write-wins, and UIs render from session events. A non-agent caller has no owning list and is rejected." |
| L8 | `import type { Context } from '@deepseek-ai/cordis'` — TYPE-ONLY. |
| L9 | `import z from '@deepseek-ai/schemastery'` — schema vocabulary (validation), no I/O. |
| L10-L11 | `import { z as zod } from 'zod'` / `import type { ZodType } from 'zod'` — schema validation only. |
| L12 | `import { defineTool } from '@deepseek-ai/dsh-tools'` — tool definition helper. |
| L13 | `import type { TodoItem } from './types.ts'` — TYPE-ONLY, local. |
| L15 | `import type {} from '@deepseek-ai/dsh-session-projection'` — TYPE-ONLY (resolves the required `ctx.sessionProjections` service declaration). |

**No `node:` builtins** (no `fs`, `net`, `http`, `child_process`,
`process`). **No network, no process/shell, no arbitrary tool/MCP
dispatch, no subagent orchestration, no job control, no cross-agent
messaging** — the only runtime imports are the schema vocabulary and
the tool-definition helper.

| Lines | Evidence |
| --- | --- |
| L22 | `export const name = 'tool-todo'` — the plugin row. |
| L23 | `export const inject = ['tools', 'sessionProjections']` — injects only the tool registry + the session projection (UI state), no filesystem/process/network services. |
| L147 | `name: 'todo_write'` — the one model-facing tool the plugin registers. |
| L130-L139 | The `todos` session projection: a standing-plan fold over the `todo/write` events of the CALLING agent's own session (`event.type === 'todo/write' → event.data.todos`) — per-agent UI state, last-write-wins on replay. |
| L203 | `execute(args, exec) {` — the executor. |
| L204 | `const todos = toTodoList(args.todos, allowParallel)` — validates the whole-list replacement (status narrowing against the closed `STATUSES` set, L24). |
| L205-L209 | `if (!exec.agent) { … throw new Error('todo_write requires an owning agent session') }` — a non-agent caller (no owning session) is REJECTED, not silently no-oped. |
| L210 | `exec.agent.session.append('todo/write', { todos })` — the SOLE effect: appends ONE `todo/write` event to the CALLING agent's OWN session journal (per-agent UI state; the session is the agent's own durable log, not a shared/team surface). |
| L211-L219 | Computes and returns the counts (`{ todos, counts: { pending, inProgress, completed } }`) — the model-visible projection is derived from the validated list. |

### Side-effect analysis

1. **Filesystem**: none (no fs import; the executor never touches disk).
2. **Process/shell/code execution**: none.
3. **Network egress**: none.
4. **Arbitrary tool/MCP dispatch**: none (no `ctx.tools.execute`, no
   plugin spawn, no MCP client).
5. **Subagent orchestration**: none.
6. **Job process control**: none.
7. **Cross-agent / cross-team messaging**: none — the append targets
   `exec.agent.session`, the OWNING agent's own session; a non-agent
   caller cannot reach the append at all (rejected).
8. **Governance**: the tool neither creates members, nor moves
   control requests, nor reads other agents' sessions.

### Why it is safe under a strict (capabilities.permissions) surface

`todo_write` is the standard preset's per-agent UI scratchpad. Its
worst-case effect under ANY policy is the agent rewriting its own todo
list — the information it can write is the information the model
already holds (the list content is model-authored). There is no new
capability it grants that `permissions.default` would need to police.

## Registry maintenance rule

A new entry requires: (a) a source review at the THEN-pinned upstream
commit (file:line table, as above), (b) the side-effect checklist with
a per-row verdict, (c) an evidence update in this file. The gate's
fail-closed posture (plan §7.8) means an unreviewed preset update
landing a new tool blocks under `capabilities.permissions` (the
`UNKNOWN_UNMANAGED` FATAL) until reviewed — the registry grows only by
this process.
