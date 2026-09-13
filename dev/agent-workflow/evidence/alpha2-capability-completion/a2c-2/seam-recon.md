# A2C-2 — seam recon record

The Permission Coverage Gate enumerates the FINAL model-facing tool
surface through PUBLIC upstream seams only (CORE PATCH BUDGET = 0).
Every seam below is verified at the pinned upstream
`tests/deepseek-harness-test-use` @ `a66e4702047846cdaa10c66c9d3df3951f5ea70d`
(pristine, read-only).

## 1. The model-facing surface enumeration — `tools.schemas(scope)`

`packages/core/tools/src/index.ts:1225`:

```ts
schemas(scope?: ScopeKey): ToolSchema[] {
```

The agent-scoped view = the INHERITED surface (the preset-mounted tools
AFTER every `restrict()` mask) + the scope's OWN registrations (the Team
tools the setup registered, the MCP tools the reconcile mounted) + the
`run_code` transport entry (when non-native mode). This is EXACTLY the
model-facing surface — the same projection the model sees — so the gate
"sees the actual surface about to be handed to the model" (plan §7.2).

`ToolSchema` carries `name: string` (the gate's projection),
`description`, `parameters` — the gate reads `name` only.

## 2. The scope key at setup time — `scopeOf(agentCtx)` = the Agent

- `packages/core/scope/src/index.ts:15`: `ScopeKey = object` (opaque
  identity used for listener routing).
- `packages/core/scope/src/index.ts:137`:
  `createScope(ctx, key, options?)` mints the scope; the scope tag is
  stored as a ctx-local: `fiber.ctx.extend({ [kScope]: key })`.
- `packages/core/scope/src/index.ts:154`:
  `scopeOf(ctx): ScopeKey | undefined` reads the NEAREST inherited scope
  tag (`ctx[kScope]` — ctx-locals inherit through the cordis
  `extend()` prototype chain, `vendor/cordis/src/context.ts:99-110`).
- `packages/core/agent-loop/src/agent.ts:103-104`:
  ```ts
  this.scope = createScope(loopCtx, this)
  this.ctx = this.scope.ctx.extend({ agent: this })
  ```
  **The Agent object IS the scope key**, and `agent.ctx` (the context
  the setup callback receives) inherits the tag.
- `packages/core/agent-loop/src/index.ts:702`:
  `await raceAbort(setup?.(prepared.agent.ctx), ...)` — the setup
  callback receives `prepared.agent.ctx`, so
  `scopeOf(agentCtx)` returns the Agent = the correct scope key at
  setup time.
- Setup failure contract (`index.ts:704-706`): a setup rejection runs
  `prepared.dispose()` and rethrows — the unpublished agent rolls back.
  This is the lane the gate's throw uses.

⇒ In the glue: `const scope = scopeOf(agentCtx);
agentCtx.tools.schemas(scope)` = the final surface of THIS agent.
Fail-closed (`alpha2-permission-coverage-surface-unavailable`) when the
ctx exposes no `tools.schemas` or carries no scope tag — a strict agent
never runs on a surface the gate could not verify.

## 3. The restriction seam (why builtinToolDeny hides preset tools)

`packages/core/tools/src/index.ts:1062`:
`restrict(filter: ToolRestriction): () => void` — requires a SCOPED
context (agent ctx; a context-global restriction would mask every agent
and throws, L1065) and masks INHERITED tool names only; the scope's own
registrations are exempt. The T2 adapter
(`packages/tools/src/builtin-deny.ts:31-60`, `applyBuiltInToolDeny`)
wraps exactly this seam. Consequence (tested, F3): a preset tool like
`grep` removed via `builtinToolDeny` is absent from `schemas(scope)`
BEFORE the gate runs — the hidden-sensitive lane passes; a scope-own
registration (Team tool) is governed by the `teamTools` capability
selector instead, never by `restrict`.

## 4. The MCP ownership delta (plan §7.3-C)

`packages/runtime/src/plugin/live/agent-bindings.mjs` (this task,
post-edit line numbers):

- L825 `reconcileMcp(agentCtx, state, allowed)` — the fiber is mounted
  via `agentCtx.plugin(mcpClient, { transport: 'streamable-http', … })`,
  which registers the MCP server's tools INTO THE AGENT SCOPE (scope-own
  registrations in §1's view).
- L1119 `state.a2c2PreMcpSurface` — the snapshot field.
- L1274-L1277 — the pre-MCP snapshot (strict mode only), taken AFTER
  preset mount + `builtinToolDeny` + Team tool/skill registration and
  BEFORE the reconcile (L1279).
- L1296-L1300 — the delta:
  `mcpIntroducedToolNames(state.a2c2PreMcpSurface ?? finalSurfaceNames,
  finalSurfaceNames)` = set-difference over the ACTUAL `schemas()`
  projections (never a name-prefix guess).
- The late record-driven reconcile (L1759 area, the consumption/boundary
  path on an already-set-up agent) is OUTSIDE the gate: the gate is a
  SETUP-time integrity check of the setup-time surface (plan §7.2); the
  durable mcp facet's allow decision remains the alpha.1 authority.

## 5. The team-tool ownership fact

`packages/runtime/src/plugin/live/agent-bindings.mjs:1220-1226`: the
setup's team-tools block (the alpha.1 selector
`selectTeamTools(catalog, capabilities.teamTools)` in selective mode,
the full catalog in legacy) now captures
`selectedTeamToolNames = selected.map(def => def.name)` — the EXACTLY
selected+registered names, the `OTHER_MANAGED_TEAM_TOOL` fact. Team
SKILLS (`registerTeamSkills`, L1236-L1244) register into the SKILL
registry (`agentCtx.get('skills')`), NOT the tool surface — verified in
`packages/runtime/agent-setup/capability/skill-adapter.ts`; they
contribute nothing to `schemas()` and need no ownership class.

## 6. The preset identity for the error detail

`packages/preset/agent-presets/src/index.ts:475`:
`composedPreset(agentCtx): string | undefined` reads the standing mount
from the live scope chain (the already-joined guard at L217 uses the
same seam). The glue (post-edit L1307-L1311) guards
`typeof presets?.composedPreset === 'function'` (the host serves the
lazy accessor; `packages/runtime/src/plugin/host.ts` L633-671) and
passes `string | undefined` — the detail normalizes to `string | null`
(never omitted).

## 7. The gate insertion point (plan §7.2 verified)

`packages/runtime/src/plugin/live/agent-bindings.mjs` (post-edit):

- L1268 `mcpMountAllowed` computation; L1274-L1277 pre-MCP snapshot;
  L1278-L1280 the reconcile; L1281 `applyBoundaryRecords`.
- L1282-L1318 — THE GATE: strictly inside
  `if (permissionPolicy !== undefined)` (L1295), AFTER
  `applyBoundaryRecords` (the final surface is settled) and BEFORE the
  alpha.2 parameter-permission install block (L1341
  `if (permissionPolicy !== undefined) {` — the A5 listener). A gate
  throw here happens before ANY listener registration (zero partial
  state) and rolls the unpublished agent back via the setup contract
  (§2).
- All bind paths share this ONE setup callback — the `setup:
  agentSetup(...)` call sites at L1713 (s6 root) / L1799 (cold-member) /
  L1818 (fresh-member) / L1868 (fresh-root) / L1872 (cold-root) / L1891
  (seeded fresh-member) / L1924 (cold-member) / L2112 (cold-root) /
  L2121 (fresh-root) — so the gate runs identically per bind path (the
  lifecycle property — tested S3).
- The glue-local fail-closed helpers:
  `permissionCoverageSurfaceUnavailable` L2356-L2362,
  `coverageSurfaceNames` L2372-L2395 (the typed error
  `alpha2-permission-coverage-surface-unavailable`, sibling of
  `alpha2-permission-fs-unavailable` /
  `alpha2-permission-control-unavailable`).

## 8. The managed vocabulary (public import, never copied literals)

`packages/domain/blueprint/src/schema.ts:149-157`:
`PERMISSION_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp',
'bash', 'pwsh']` (exported via `packages/domain/blueprint/src/index.ts:40`)
— the glue imports it (post-edit L284) and injects it as the
`managedToolNames` fact. The evaluator itself stays vocabulary-agnostic
(pure; facts injected).
