# 07 — A1 seam decision: how the centre gets a per-agent provider without owning dispatch

> **Status:** decided from measured host source (rc.5, `9c2670d3b`), not from design preference.
> Two mechanisms were in question. One is available through public seams; one is not, and the
> difference decides the whole A1 shape.

## The measurement

**A native tool body resolves its provider from the `ctx` captured at plugin `apply()` time**,
not from the calling agent:

- `ToolDefinition.execute(args, exec)` takes exactly two arguments; `exec` is a `ToolRunContext`
  carrying `agent?`, `callId`, `token`, `signal` — **no context/service object**
  (`packages/core/tools/src/contracts.ts:27,40,175-262`).
- The body runs at `packages/core/tools/src/pipeline.ts:280` — `tool.execute(exec.arguments, exec)`,
  which passes no ctx. Inside `read.ts`, `ctx` is the `applyReadTool(ctx, …)` parameter, documented
  "the plugin context; … execution uses its `fs` service"
  (`packages/fs/tool-fs/src/read.ts:65,146`). Same for `write.ts:118`, `tool-bash:223`, `tool-web:503`.
- Therefore: **re-pointing `ctx.fs` for a body is impossible after mount.** The only lever is
  *where the module is mounted*.

**Provider substitution is available, and it is scope-based:

- Every agent owns a scope: `this.scope = createScope(loopCtx, this); this.ctx = this.scope.ctx`
  (`packages/core/agent-loop/src/agent.ts:148-149`); `Agent.ctx` is documented agent-local
  (`packages/core/agent/src/runtime-types.ts:203`), and `docs/architecture.md:169` states the rule:
  *"Scope a registration to one agent | use that agent's `ctx`"*.
- The tool registry is scope-layered, and its duplicate-name error advertises the seam:
  *"for a per-agent variant, register through that agent's `agent.ctx` instead"*
  (`packages/core/tools/src/index.ts:68-70`, layering `:128,219-226`).
- Cordis service lookup is per-fiber with an isolate label (`vendor/cordis/src/reflect.ts:247-250`),
  so `agent.ctx.provide('fs', …)` **throws** (`reflect.ts:308-310`). A different provider requires
  `ctx.isolate('fs')` first (`vendor/cordis/src/context.ts:121-125`) and mounting the provider **and**
  its consumers under that isolated context.
- The host's own per-agent story is therefore two-part: per-agent *registration* via `agent.ctx`,
  and per-agent *state inside a shared service* keyed by agent/session (terminal `spawn(owner: Agent)`
  `terminal/src/index.ts:130`; jobs `list(exec.agent?.id)`; fs-sandbox `resolve({session})`
  `sandbox-policy/src/index.ts:208-218`).
- No seam makes a native body consult `exec.agent` for `fs`. Searched `withAgent|runInAgent|agentScope(`
  and every `AsyncLocalStorage` use under `packages/**`: nothing.

## Decision

**The centre mounts the host's own native tool modules inside a per-agent isolated provider realm.
It does not author tool bodies, and it does not take over dispatch.**

```
agent.ctx  (= per-agent scope)
└── isolate('fs')  → provider realm: `fs` = this agent's confined provider
    └── ctx.plugin(@deepseek-ai/dsh-tool-fs)     ← the HOST module, unmodified
```

The registered `read`/`write`/`edit`/`read_image` are the host's definitions, executed by the host's
dispatcher, resolving `ctx.fs` to the realm's provider because that is where they were mounted. This
is the only arrangement that satisfies both UTE-01/02 (one declarant, no forked body) and the
provider requirement, and it uses public APIs only (`ctx.isolate`, `agent.ctx.plugin`, tool registry
scope layering).

**Rejected alternatives, with the reason:**

| alternative | why not |
| --- | --- |
| patch the host so bodies read `exec.agent` | forbidden (`CORE PATCH BUDGET = 0`); and it is the change the host has not made in three releases |
| install a per-agent `ToolExecutor` (`setExecutor`, new in rc.5) that substitutes providers | it is a legal seam, but it takes over **all** dispatch for that scope, so the centre would own execution — the exact inversion of Native-First |
| author team tool bodies that wrap the provider (`confined-*.mjs`) | the mirror-native-tool route the owner retired; a second declarant of a model-visible name |
| rely on `fs-sandbox` | it fences **mutations only** (`fs-sandbox/src/index.ts:7,80-141`); native `read` is unconfined in every mode |

## Admission and facts: public, ordered, out of body

| need | seam | evidence |
| --- | --- | --- |
| deny before the body | `tools/pre-execute` waterfall → `{allow,deny,cancel,ask}` | `pipeline.ts:199-226` |
| per-agent deny | `agent.ctx.tools.guard(ToolGuard)` (monotonic; runs after pre-execute) | `index.ts:384,393-399`, `pipeline.ts:214` |
| per-agent visibility | `agent.ctx.tools.restrict({allow,deny})` → `UNKNOWN_TOOL` | `index.ts:162-190` |
| what the model sees on denial | `{content:[{type:'text',text:'Error: <reason>'}], isError:true}` | `pipeline.ts:220-224` |
| durable per-call facts | `tool/call` + `tool/result` in the agent's Session (`turn/step/callId`) | `batch.ts:247-260` |
| in-process facts | `tools/result`, `fs/observed`, `fs/write-intent` | `events.ts:49`, `fs/src/index.ts:67,93` |

The execution `token` is a per-execution `symbol` (`pipeline.ts:119,715`) — **not durable**. Durable
identity is `turn/step/callId` only (`docs/subsystems/tools.md:535`). `ExecutionFact` must therefore
be keyed by `callId` + agent, never by token.

## What this obliges in A1

1. The realm lane mounts **host modules from the composition**, never a team-authored body. The
   realm row already supports a host-package spec and deliberately skips the shadow when one is
   present (`a5sf-realm-row.mjs:1280-1289`, `A5SF_HOST_FS_PACKAGE` `:1219`); A1 turns that from a
   possibility into the only configuration and deletes the five `confined-*` modules.
2. **A1's own proof** (owner risk #1): with the realm mounted and no shadow definition, a real
   `read` executed for member A resolves A's provider — asserted by *definition identity* against
   the host package, not by name — and a path outside A's ceiling is refused. A name-only check is
   the defect that the old `uncoveredShadowedTools` had to add identity diffing to catch
   (`a5sf-realm-row.mjs:1880-1898`).
3. `smoke` caveat: `ctx.isolate` has no in-tree TypeScript precedent; the shipped mechanism is the
   Loader `isolate:` row option (`vendor/loader/src/config/isolate.ts:88-105`). The realm lane proves
   the programmatic form on a real host before B starts; if it fails there, this is a
   `CORE_SEAM_BLOCKER` escalation, not a reason to re-author tool bodies.

## Version note

Measured against **rc.5 (0.2.2-rc.5)**. The provider-substitution answer is unchanged from
0.2.0-rc.2: `agent?` in the execution input and every seam above already existed there
(`R2/packages/core/tools/src/index.ts:338-339,731`). rc.5 adds scope-selectable `ToolExecutor`s
(`packages/core/tool-executor-native`, `setExecutor` `index.ts:325`) — a seam we deliberately do not
use for providers, and may use only if the centre ever needs to own dispatch, which it does not.
