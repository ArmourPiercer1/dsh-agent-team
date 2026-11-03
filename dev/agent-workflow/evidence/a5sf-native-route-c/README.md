# a5sf NATIVE ROUTE C — native tool confinement prover

**Task:** prove or refute route C for confining the NATIVE preset `read`/`write`/`edit`
rows. PR #555 recorded the native half as `CORE_SEAM_BLOCKER` (P3 native takeover,
BL-22) on the argument that the upstream preset registry mounts those rows under its
own generation scope, "structurally never below" the agent scope, so no Team-side
registration can shadow them. An external review pointed at an already-run PoC
(`dev/agent-workflow/evidence/a5x-envpoc-20261031T170133/A5-XENV-VERDICT.md`,
`tests/kits/a5x-envpoc/a5x-probe2.mjs`, commit `18e3823e3`) that re-mounts the native
tool module inside an isolated scope.

**Verdict: YES — route C works at this baseline, with no Core patch and no upstream
edit.** The `CORE_SEAM_BLOCKER` reading is **refuted**. It is *conditional on four
guards*, and this branch wires all four; the conditions are named in §5 and are
measured, not assumed.

- Worktree: `.worktrees/a5sf-native-route-c`, branch `task/a5sf-native-route-c-20261103`,
  from `origin/master` @ `31ba2015d` (PR #555).
- Host boots spent: **0 of the 1 allowed** (the question is decidable host-free; §7).
- Core patch budget: **0**. `packages/runtime/src/plugin/live/agent-bindings.mjs`
  (ARC-A protected) is **untouched**.
- Ports bound: **0**. `tests/homes/**`: **not used**. `tests/deepseek-harness-test-use`:
  **read-only** (porcelain stays empty).

---

## 1. Why PR #555's argument is wrong (the broken link)

The chain the ruling relied on:

> preset registry `activate()` creates `createScope(owner, generationKey)` and mounts the
> preset's plugins there ⇒ the preset's tools live in the preset scope ⇒ the agent
> scope is *below* the preset scope ⇒ nothing the agent/plugin does can shadow them.

The last step does not follow from the registry's own code. `join()`/`mount()` calls
`bindScopeParent(agentKey, generation.key)`: the preset standing scope is the agent
scope's **parent**, i.e. an *ancestor contribution* in `@deepseek-ai/dsh-scope`. And
`ToolRuntime.view(scope)` builds the visible map as

1. inherited layers (global + chain), each filtered by every layer's `restrict()`
   filters, then
2. the scope's **own** registrations, applied **last and outside the filters**.

So a registration made *from the agent's own scope layer* is not "below" the preset
row — it is **above** it in merge order (`ScopedLayers.merge`: global → farthest
ancestor → nearest, own last). `ctx.isolate(name, label)` is `this.extend({[symbols.isolate]:
shadow})`; it inherits `kScope` from the agent ctx, so `agentCtx.isolate('fs')` is the
**same DSH scope key** as the agent (measured: `scopeOf(iso) === agentKey`, leg B).
That is the whole trick: the isolate changes *service resolution* (`fs` → confined
provider) without changing *scope identity* (tool/prompt registration target).

The PoC's F8 note ("agent-scope re-mount rejected: `prompt section "tool:read" is
already registered in this scope`") looked like a structural wall but was
**self-inflicted**: the PoC had already re-mounted the module through the isolate in
the *same* layer, then re-mounted again directly on the agent ctx. Measured control
(leg C): with **no** earlier mount in that layer, a direct agent-scope re-mount raises
**nothing** and legally shadows the preset row.

## 2. What was measured (host-free, at the pinned baseline `639ed01539`)

`probe.log` is the raw output of `probe-route-c.mjs` (6 records). The probe imports the
**real** `@deepseek-ai/dsh-tool-fs` module from the pinned pristine tree, builds the
registry's own topology (`createScope` standing + `createScope` agent + `bindScopeParent`),
and dispatches through the **real** `ToolRuntime`.

| leg | question | measurement |
| --- | --- | --- |
| A | what is the native module, and can it be re-mounted? | `@deepseek-ai/dsh-tool-fs` → `file:///…/tests/deepseek-harness-test-use/packages/fs/tool-fs/lib/index.js`; `name:"tool-fs"`, `inject:["tools","fs","systemPrompt"]`, `apply` is a function, **no default export**, **no import side effect** (import with no Cordis root present). |
| B | does route C confine the real native rows? | `mountError: null`; `scopeOf(iso) === agentKey`; scope chain length 2. **Before:** visible `["read","write","edit"]`, `readCount 1`, prompt `["tool:read","tool:write","tool:edit"]` (1 each), `read` served by **BASE**. **After:** same 3 visible / same 1 `tool:read` / `readCount 1`, `read` served by **CONFINED**, `write` → `CONFINED:writeText`, `baseReadsDelta 0`, `confinedReadsDelta 1`. Preset plane (standing scope) still serves `read` via **BASE** — the shadow is per-agent, not global. |
| B2 | what if only the re-mounted fiber is disposed (agent alive)? | `read` falls back to **BASE**: confinement is the *shadow*, not a mutation of the preset definition. Teardown must be ordered (§5(b)). |
| C | does a bare agent-scope re-mount collide (PoC F8)? | **No** (`agentScopeRemountError: null`); it serves BASE because no confined `fs` is in that ctx. F8 was the earlier iso mount in the same layer. |
| D | does the shadow respect `tools.restrict({deny:["read"]})`? | **No.** Restricted view: `read` invisible (0) and dispatch answers `unknown tool "read"`. After route C: `read` **visible again (1)** and executes on **CONFINED**. A scope-own registration is outside the inherited filter — this is the governance hole the wiring must close (§5(a)). |
| E | two Member realms (two isolates) on one agent? | Same scope key for both; first mount OK, second → `prompt section "tool:read" is already registered in this scope`. One agent scope = one registrable native surface (§5(d)). |

One more measurement that shaped the wiring: `ctxBoundViewIsAgentScope` shows
`root.tools.schemas()` (a ctx-bound read on the *root* context) is `[]`, i.e. **not**
the agent's view. The wiring therefore asks `@deepseek-ai/dsh-scope` for `scopeOf(root)`
and calls `tools.schemas(scope)` explicitly (the live glue already imports `dsh-scope`
in `agent-bindings.mjs`, so this adds no new runtime dependency class).

## 3. The wiring (smallest honest version)

One mount path stays `mountA5sfRealm`; no second compiler; no Core patch.

| file | change |
| --- | --- |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` | `A5SF_NATIVE_TOOL_MODULES_KEY = 'a5sfNativeToolModules'`; `a5sfRealmConfigOf` validates/returns the list (**key omitted when absent** ⇒ old block byte-identical); `mountMemberA5sfRealm` imports the configured modules (row composition owns the specifier: `file:` URL / absolute path / bare specifier), passes them to the ONE mount entry point, and **refuses a surface-changing mount** (`a5sfAgentToolSurface(root)` before vs after; addition *or* removal disposes the realm and raises). New export `a5sfAgentToolSurface`. |
| `packages/runtime/team-services/src/mount.ts` | `MountA5sfRealmInput.nativeToolModules?: readonly NativeToolModuleMount[]`; refuses `members.length !== 1` with a non-empty list **before touching the Context**; mounts each module on the Member's isolated `ctx` (the same ctx the confined provider is installed on); disposes those fibers **before** the confined provider, and on rollback; wraps a mount failure in `TeamServiceInstallError('SERVICE_MOUNT_FAILED')`. |
| `packages/runtime/src/plugin/types.ts` | documents `a5sfNativeToolModules` (row-composition specifier, `{url, config?}` form for config parity, surface-neutral-or-refused law). |
| `tests/world-factory/a5sf-native-route-c.test.mjs` | the permanent 4-arm law (N1–N4, §4). |
| `.github/workflows/ci-integration.yml` + `dev/ci/eb3-ci-manifest.json` | the leg is listed **explicitly** in the layer and its file path is the manifest `check` token (`node scripts/eb3-ci-required.mjs` → `pass workflows=9 findings=0`). CI lists node:test files explicitly; without this the law would run in no layer. |
| `packages/runtime/dist/**` | rebuilt `tsc -p tsconfig.build.json` + `node scripts/place-dist-glue.mjs` (mount.js/.d.ts + maps, types.d.ts/maps, the row mirror). |

Enablement (row composition, exactly like the existing `a5sfEvidencePath` half):

```js
// the host names where ITS @deepseek-ai/dsh-tool-fs lives (the PoC's A5X_TOOLFS_URL shape)
a5sfNativeToolModules: [pathToFileURL(require.resolve('@deepseek-ai/dsh-tool-fs')).href]
```

Both existing enablement halves (`a5sfEvidencePath` **and** `deps.a5sfRealmProvider`)
are still required. Absent/empty list ⇒ the pre-route-C mount, byte-identical: no tools
lookup, no module import, no surface comparison.

## 4. The permanent law (RED → GREEN)

| arm | law | result |
| --- | --- | --- |
| N1 | config reader: absent ⇒ block unchanged (no key); valid ⇒ frozen list; malformed (non-array, `''`, `[null]`, `[{url:''}]`, `[{url,config:3}]`) ⇒ `TypeError` at assembly | green |
| N2 | **discriminating pair** — the identical fixture native `read` is served by **BASE** before the mount; after it, the same read outside the ceiling is **REFUSED** with exactly one `a5sf-guard-consult/1` fact (`decision:"deny"`, `decidedBy:"IO_READ_DENIED"`, `sequence:1`), the inside read still succeeds and consults (`allow`, `sequence:2`), the model-visible surface is **ONE** `read` and **ONE** `tool:read` section | green |
| N3 | a Member whose `builtinToolDeny` lane hides `read` (`applyBuiltInToolDeny`'s `tools.restrict({deny})`) is **not** re-enabled: the mount raises `… would CHANGE the Member's model-visible tool surface (added: ["read"] …)`, the realm is unmounted, the surface is unchanged, **no** fact is written | green |
| N4 | after `realm.dispose()` the shadow is gone and the preset definition is visible again on **BASE** (disclosed, not overclaimed) | green |

`red-test.log` = the same suite against the pre-wiring source (the three files stashed
to `31ba2015d`): **4/4 fail, exit 1**. `green-tests.log` = the new suite plus the three
sibling a5sf suites, **all green** (route C 4/4, F1 9/9, P2 wiring 9/9, P2 seam 14/14).

## 5. Conditions on the "yes" (each wired here, each disclosed)

**(a) Surface neutrality is mandatory (deny-lane bypass).** Measured leg D: an own
registration ignores the inherited `restrict` filter, so a bare re-mount silently
re-enables a native tool the Member's `builtinToolDeny` lane denied. The wiring
therefore compares the agent's model-visible set before/after and **refuses** any
addition *or* removal. Consequence to accept: a Member that denies `read`/`write`/`edit`
cannot use route C for that module (fail closed, loud) until upstream offers a
re-mount API that participates in the filter.

**(b) Teardown ordering / fail-open.** The shadow must be disposed **with** (and no
later than) the confined provider; the wiring disposes native fibers first. But
disposing the realm while the agent lives reverts the native row to the **preset**
definition on **BASE** (leg B2/N4). Router/row teardown must not leave an agent running
after its realm is gone — that is a lifecycle obligation, not a mechanism guarantee.

**(c) Config parity is the row composition's job.** A bare re-mount does not carry the
preset's plugin config (e.g. a `readLimit`-style option). `{url, config}` exists so the
caller can forward the *same* config the preset used; nothing in the mechanism can
recover it from the preset generation.

**(d) One Member ceiling per agent scope.** Every Member realm is an isolate on the same
root, hence the same scope key: a second re-mount of the same names collides on the
first prompt section (leg E). The mount refuses a non-empty list with `members.length
!== 1` before touching the Context.

**(e) Module acquisition is a host fact.** The Team package does not depend on
`@deepseek-ai/dsh-tool-fs`; the caller names the module (`file:` URL / absolute path /
bare specifier resolved from the host install), exactly as the PoC used `A5X_TOOLFS_URL`.
On a host upgrade the URL must be re-derived from that host's own resolution — a wrong
path fails closed at row assembly (import error), not silently.

**(f) What the permanent suite does NOT prove.** Its "native" module is a fixture with
the shipped packages' injection shape (`inject: ['tools','fs','systemPrompt']`, body
resolving `ctx.fs`, a `tool:read` section); the **real** `@deepseek-ai/dsh-tool-fs`
module is covered by `probe.log` (legs A–E) at the pinned baseline. No live Host boot
was performed (see §7), so the claim proven here is the **mechanism + wiring**, not a
model-visible turn inside a booted world.

## 6. Smallest public seam that would remove the remaining conditions

Not needed to make route C work — recorded so the upstream ask is precise if the
conditions above are judged too sharp:

1. A re-mount/override API on the tool registry that (i) registers into a given
   per-agent scope **through** the existing restriction filter and (ii) returns a
   disposer that restores the shadowed definition atomically
   (`tools.override(scope, definition, {config})`). This removes conditions (a) and (b).
2. An accessor on the preset registry that hands back the **mounted native tool
   modules + their config** for a generation (`preset.toolModules(generationKey)`).
   This removes conditions (c) and (e).

Either would be a plugin-side (public) API addition; neither requires patching an
upstream source file, and **neither is required for the mechanism proven here**.

## 7. Boot budget

The allocation allowed **1 boot** ("F1 effective-half verification", 3 boots, may spend
1). **0 were spent**: the deciding facts (re-mountability, scope identity, ONE visible
tool, ONE prompt section, provider attribution, deny interaction, multi-member
collision) are all decidable in-process against the real baseline modules, and the PoC
had already exercised the same mechanism in a real Host at the **same** SHA
(`0.2.0-rc.2 @ 639ed01539`). A boot would add "a model-visible turn in a booted world",
which this task did not need to answer the routing question; it is the natural next
verification step (§8), not a prerequisite.

## 8. Recommended next step

1. **Review + merge this wiring** as the native half of the a5sf lane, with the
   `a5sfNativeToolModules` row-config key supplied by the host composition (the same
   place that supplies the evidence path today).
2. Then spend **one** F1-effective-half boot with a real Member + mock model to convert
   "mechanism proven host-free" into "model-visible native `read` denied in a booted
   world", and to pin §5(b)'s lifecycle obligation in the booted path.
3. Keep the ordering constraint: a Member that denies a native tool must fail loud under
   route C until an upstream override API exists (§6.1) — do not relax the
   surface-neutral refusal to make such a Member "work".

## 9. Reproduction

```bash
# host-free mechanism measurement (reads the pinned pristine tree, writes nothing)
node dev/agent-workflow/evidence/a5sf-native-route-c/probe-route-c.mjs

# the permanent law
node --test tests/world-factory/a5sf-native-route-c.test.mjs

# the layer/manifest shape
node scripts/eb3-ci-required.mjs
```
