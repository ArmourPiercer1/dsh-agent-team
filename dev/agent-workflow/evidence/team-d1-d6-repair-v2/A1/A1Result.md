# A1 — D1 ordinary-tool composition seam for Team member agents (v2)

**Task**: A1 (Wave A characterization, read-only)
**Branch/worktree**: `task/team-d1-d6-v2-A1` / `.worktrees/team-d1-d6-v2-A1` (base `2baad2f`)
**Model route verification**: runtime declaration states model `qwen3.8-27b`; in the host config
(`C:\Users\user\.dsh\settings.yaml:3-5`, `:86-95`) the model id `qwen3.8-27b` is offered exclusively by
provider `qiyuan-self` (and `agent-default-model` is `qiyuan-self`/`qwen3.8-27b`). Full route
`qiyuan-self/qwen3.8-27b` — **verified OK**.
**Upstream baseline**: `references/deepseek-harness-test-use` @ `76fda729799fe9b3848dbe2c211d4b231032b81e`
(0.1.2-rc.1), `git status --porcelain` empty (pristine). No product code, no upstream file was modified.

## Seam verdict

**`public_composition_seam = yes`** — a COMPLETE public composition path exists. No upstream patch, no
non-exported symbol, no new upstream service is required. All missing work is Team-owned glue/wiring.

## Q1 — Exact public upstream call inside the member setup closure

The Team live glue must, inside its existing `AgentSetup` callback (which already receives the
unpublished scoped `agentCtx`), call the public `AgentPresets.mount` service method:

```js
// inside agentSetup(sessionId, instanceIdHint, templateIdHint, bindPath, teamRootSid)
// -> async (agentCtx) => { ... }  (packages/runtime/src/plugin/live/agent-bindings.mjs:543-591)
const agentPresets = deps.agentPresets // public AgentPresets service, injected by host.ts (see Q2)
if (agentPresets) {
  // presetId may be undefined -> resolves to the deployment default ('standard' in the web bundle)
  await agentPresets.mount(agentCtx, config.memberPresetId)
}
```

Citations (all in `references/deepseek-harness-test-use` @ 76fda72979):

- **Symbol**: `AgentPresets.prototype.mount(agentCtx: Context, id?: string): Promise<AgentPreset>` —
  public method of the public `AgentPresets` service class, **default export** of
  `@deepseek-ai/dsh-agent-presets`.
  Module: `packages/preset/agent-presets/src/index.ts:414-427`. The JSDoc names the exact supported
  call site: "Call from the agent factory's `setup(agentCtx)`" (`index.ts:406-408`).
- **Service name**: `agentPresets` — registered via `super(ctx, 'agentPresets')`
  (`index.ts:164`); Context merge `agentPresets: AgentPresets` (`index.ts:87-91`).
- **Upstream consumer precedent** (this is exactly how ordinary web sessions get their preset tools):
  `ApiSessionAgentController.composeAgent` — `packages/api/session-controller/src/agent.ts:374-388`:
  reads the service with `this.ctx.get('agentPresets')` (`:378`), resolves the id
  (`presets.resolve(presetId)` → `defaultId` when omitted, `:380`), and the returned setup runs
  `installSelection(agentCtx)` then `await presets.mount(agentCtx, resolvedId)` (`:383-386`). The same
  composed setup is passed to both create (`:476-484`, with `meta.agentPreset` recorded at `:482`) and
  resume (`:428-432`, `:459-464`).
- **AgentSetup contract**: `AgentSetup = (agentCtx: Context) => ...` —
  `packages/core/agent/src/index.ts:60-62`; `CreateAgentOptions.setup` (`:107-125`, a setup
  throw/rejection rolls the unpublished agent back without publishing either id, `:116-119`) and
  `ResumeAgentOptions.setup` (`:139-148`, a fresh scoped world is minted on resume).
  `CreateAgentOptions.meta.agentPreset` is a public durable-session metadata field (`:91`).
- **Is it a public export the glue can import/call?** YES. The glue needs no import at all: it calls
  the method on the **service instance** obtained from the Cordis context store (`ctx.get('agentPresets')`),
  the same mechanism the upstream session-controller uses. The class itself is the default export
  (`index.ts:833`) were type-level imports ever needed (the glue is plain JS and uses none).

Equivalent public API: `AgentPresets.composeFrom(agentCtx, parentCtx): string | undefined`
(`index.ts:455-464`) — synchronous join of the SAME standing composition a parent agent already runs
on. It is viable in the Team child path (the glue already captures per-session live agent contexts in
its own `liveAgentCtxs` closure state — `agent-bindings.mjs:244,547` — so a parent `Context` object is
in hand without any private API), but it is a no-join (returns `undefined`) when the parent joined no
preset, and it throws when the child has already joined one. **Mount-by-id is the robust primary
path**; `composeFrom` is a fallback/optimization, not a requirement.

What the ordinary preset supplies (so "file/shell" is real): the shipped `standard` preset registers
`tool-fs` + `tool-fs-search` (filesystem read/search), `tool-bash` (non-win32) / `tool-pwsh` (win32)
(shell), plus `tool-jobs`, skills, goals, plan mode, compaction, subagent delegation, `tool-todo`,
`tool-web`, `tool-ask-user`
(`packages/preset/agent-presets/presets/standard/agent.cordis.yml:44-63,73-87,94-98,104-124,137-151,168-234,237-248`).
Note: `standard` is the FULL ordinary toolset — a superset of "file/shell". Whether members should get
the whole ordinary surface or a minimal file/shell subset is a B1 product decision (a Team-authored
lighter preset is possible through the public authoring surface, not a seam gap).

## Q2 — Dependency to inject into `createAgentBindings`

- **Exact service**: `agentPresets` (the public `AgentPresets` service).
- **Is it available to host.ts through its public ctx?** YES — the mechanism already exists.
  `packages/runtime/src/plugin/host.ts` consumes services through the strict global-store read
  `ctx.get(name)` (the `TeamPluginHostContext` interface, `host.ts:101-105`): already used for
  `agents` (`:678`), `teamStorageSeam` (`:703`), `subagents` (`:826`), `sessionQuery` (`:856`),
  `connection` (`:914`). `ctx.get('agentPresets')` needs no upstream change.
- **The service is present in the production composition**: the web-app bundle inserts the
  `agent-presets` row (`name: '@deepseek-ai/dsh-agent-presets'`, `config: { default: standard }`) into
  the web profile — `packages/bundle/web-app/cordis.patch.yml:440-444` (test-use checkout). The Team
  row is inserted into the same web-profile composition by this repo's bundle layer
  (`cordis.patch.yml:38-41`) and, in the 3180 test world, by
  `references/.dsh-test/profiles/web/cordis.patch.yml:6-63` (real prebuilt `host.js`, `glueUrl` pointing
  at the live glue module). So the roster service exists in every world where the Team row runs.
- **Exact injection point** (Team-owned, both files are in B1's owned zone):
  1. `packages/runtime/src/plugin/host.ts` — the `glue.createAgentBindings({ ... })` call at
     **`host.ts:819-827`**: add one additive deps field, e.g.
     `agentPresets: ctx.get('agentPresets')` (eager — identical pattern to `subagents`, `:826`) or a
     lazy accessor `agentPresets: () => ctx.get('agentPresets')` (identical pattern to the
     `sessionPersistence` wrapper `:487-501` and `getSessionQuery` `:856`; immune to row apply-order).
     Also extend the structural `GlueModule` interface (`host.ts:123-140`) with the optional field.
  2. `packages/runtime/src/plugin/live/agent-bindings.mjs` — accept the new OPTIONAL deps key
     (destructure at `:183`, read defensively, the documented `deps.subagents` convention,
     header `:62-71` + docs block for the new key).
- **Do NOT add it to the hard `inject` array (`host.ts:464`) unless B1 wants row-apply gating**:
  adding `'agentPresets'` there would park the Team row forever in a composition without the roster
  row. The production web world always has it, but the entry's existing style is lazy/defensive reads;
  recommended: lazy accessor + fail-closed in setup (a setup rejection rolls back the unpublished
  agent per the AgentSetup contract, `core/agent/src/index.ts:116-119`), or at minimum a typed
  observation — B1 decides the exact fail-closed semantics.
- **Preset id selection stays Team-owned**: add an optional row-config field (e.g.
  `memberPresetId`, default `undefined` → `resolve(undefined)` → `defaultId` → `standard` per the web
  bundle) on `TeamPluginConfig` (`host.ts:244-328` validation, `types.ts`), carried through the
  existing `config` deps field. On create, B1 may additionally record
  `meta: { cwd, agentPreset: resolvedId }` (public field, `core/agent/src/index.ts:91`;
  `agents.resume` takes no meta — the durable header is loaded from persistence).

## Q3 — One setup closure for fresh create AND cold resume, without double registration

**YES — the existing shared closure already serves both paths, and the preset join is inherently
idempotent per agent.**

All nine create/resume call-sites already funnel through the single shared
`agentSetup(sessionId, instanceIdHint, templateIdHint, bindPath, teamRootSid)` closure
(`agent-bindings.mjs:543-591`):

| call-site | path | lines |
|---|---|---|
| `ensureLiveAgent` re-attach | cold-root / cold-member | `:834-843` |
| `childFactory.createChildSession` (durable child) | cold-member | `:909-915` |
| `childFactory.createChildSession` (fresh child) | fresh-member | `:927-934` |
| `boot()` create phase: root | fresh-root | `:977-984` |
| `boot()` resume phase: root | cold-root | `:985-988` |
| `boot()` create phase: seeded members | fresh-member | `:999-1007` |
| `boot()` resume phase: bound members | cold-member | `:1037-1040` |
| `createRootAgent` resume | cold-root | `:1213-1216` |
| `createRootAgent` create | fresh-root | `:1221-1224` |

Adding the `agentPresets.mount(agentCtx, presetId)` call once inside this closure (before the
team-tools loop, mirroring the session-controller ordering selection-then-mount,
`agent.ts:383-386`) composes fresh create and cold resume identically. If B1 wants members-only
scope, the closure already receives `bindPath` — branch on
`bindPath === 'fresh-member' || bindPath === 'cold-member'` with no signature change. (Composing the
root too is the zero-branching option and gives the leader the ordinary substrate as well — B1
decision; the plan's B1 goal names members, but the leader currently lacks the ordinary tools on the
glue path as well, same root cause.)

**No double registration is possible:**

- Per-agent join is a single scope-parent bind: `mount` does
  `this.bindings.set(agentKey, bindScopeParent(agentKey, standing.key))`
  (`agent-presets/src/index.ts:425`) into a `WeakMap` (`:399`) that dies with the agent's scope key.
  Each `agents.create`/`agents.resume` mints exactly one unpublished `agentCtx`
  (`core/agent/src/index.ts:108-125,139-148`), so a join happens exactly once per agent lifetime;
  the glue's `liveAgents` map + `ensureLiveAgent`/`childFactory` guards (`:820-822,906-907`) never
  set up a second agent for a live session.
- The standing composition itself is mounted ONCE per preset per file generation: single-flight
  `ensureStanding` (`index.ts:746-795`) with file-stamp comparison (`:756-767`); it lives under the
  service's own scope until whole-tree teardown (`StandingMount.scope`, `index.ts:824-831`). A cold
  resume's mount call therefore only re-binds the fresh scope key to the existing standing generation
  — no re-read of the roster file's composition, no second plugin subtree, no second tool
  registration.
- **Disposer accounting — the existing `toolDisposers` pattern is unchanged**: `mount()` returns
  `Promise<AgentPreset>`, NOT a disposer. The preset subtree is owned either by the standing scope
  (service-owned, standing flow) or by the agent's own fiber in the direct `mountPreset` flow, where
  "the subtree is owned by `agentCtx`'s fiber, so it unwinds with the agent and the caller receives
  no disposer" (`agent-presets/src/mount.ts:371-372`). Hence nothing is pushed to
  `toolDisposers`; the array keeps its current contents (model-selection disposer `:560`, team-tool
  registration disposers `:567`) and is still spliced + run at row stop in `close()`
  (`:1596-1598`), while `close()`'s per-agent `handle.dispose()` (`:1588-1594`) unwinds each agent's
  scope (and with it its join). Repeated setup/dispose cycles (restart → cold resume → row stop)
  therefore cannot accumulate preset registrations.
- Side signal: the roster's advisory `agent/created` listener warns "published without joining an
  agent preset" (`index.ts:215-223`). Today EVERY team-row agent (root + members) triggers that
  warning — B1 tests can assert the warning disappears and the tool table gains the preset tools in
  one shot.

## Q4 — Verdict and what (if anything) is missing

**Verdict: `yes` — a complete public composition path exists.**

| link | public? | where |
|---|---|---|
| `agents.create({setup})` / `agents.resume({setup})` | yes (already used by the glue) | `core/agent/src/index.ts:71-149`; glue `agent-bindings.mjs:909-934` |
| `AgentSetup` receives the unpublished scoped `agentCtx` | yes | `core/agent/src/index.ts:60-62,108-125,139-148` |
| `agentPresets` service reachable from the Team host ctx | yes — `ctx.get('agentPresets')`, same mechanism host.ts already uses | service name `agent-presets/src/index.ts:164`; row `bundle/web-app/cordis.patch.yml:440-444`; host.ts `:678` precedent |
| `AgentPresets.mount(agentCtx, id?)` | yes — default-exported public service class, public method | `agent-presets/src/index.ts:414-427,833` |
| preset id resolution incl. deployment default | yes — `resolve(undefined)` → `defaultId` | `agent-presets/src/index.ts:343-356,240-242` |
| ordinary preset with file/shell tools | yes — shipped `standard` preset | `presets/standard/agent.cordis.yml:44-63` |
| per-agent disposal without glue-side disposer | yes — fiber-owned unwind / WeakMap binding | `mount.ts:371-372`; `index.ts:399,425` |

**Missing (all Team-owned, B1 scope):**
1. `host.ts`: read `agentPresets` from ctx + pass it into `createAgentBindings` (+ `GlueModule` type).
2. `agent-bindings.mjs`: call `agentPresets.mount(agentCtx, presetId)` inside the shared setup;
   defensive deps read; fail-closed semantics when the service is absent; optional member-only
   `bindPath` branch; optional `meta.agentPreset` on create.
3. Optional `memberPresetId` row-config field (+ validation in `validateTeamPluginConfig`, `types.ts`).
4. Focused tests (see recipe) incl. a normal-session no-regression check.

No upstream patch, no private API, no new upstream service, no second state source. CORE PATCH
BUDGET stays 0.

## Owned files for the future B1 task

1. `packages/runtime/src/plugin/live/agent-bindings.mjs` — setup closure mount call, deps doc header, defensive read.
2. `packages/runtime/src/plugin/host.ts` — `ctx.get('agentPresets')` wiring into the glue deps (`:819-827`), `GlueModule` interface (`:123-140`), optional `inject` decision (`:464`), optional config validation (`:244-328`).
3. `packages/runtime/src/plugin/types.ts` — only if a `memberPresetId` config field is added.
4. `cordis.patch.yml` (repo root, shipped default) and/or `references/.dsh-test/profiles/web/cordis.patch.yml` (test world) — only if the shipped default must set the new field.
5. Focused tests — `packages/runtime` test tree (exact file chosen by B1), plus the 3180 host-level regression below.

## Minimal reproduction recipe for B1 tests

**Unit level (no live host, no upstream import):**
1. Build bindings via `createAgentBindings` with a stub `agents` service whose `create`/`resume`
   capture the `setup` callback; invoke the captured setup with a fake scoped `agentCtx` whose
   `tools.register` records tool defs; stub `agentPresets` as `{ mount: (ctx, id) => record and
   resolve }`.
2. Assert: `mount` called exactly ONCE per setup invocation, with the resolved preset id; called on
   BOTH `fresh-member` and `cold-member` bindPaths (and on root paths only if B1 chose all-row
   composition); the ten `team_*` registrations still occur AFTER the mount; no disposer is pushed
   for the join (`toolDisposers` length unchanged by the mount step); a `mount` rejection rejects the
   setup (agent creation rolls back per the AgentSetup contract).

**Host level (test instance only — source `references/deepseek-harness-test-use`, DSH_HOME
`references/.dsh-test`, port `3180`, per TEST_METHODS.md; `:3080` and `D:\deepseek-harness` never
touched; test-use tree must be byte-clean afterwards):**
1. Boot the 3180 web host (TEST_METHODS.md §2 chain); create a team and a member through the Team
   surface (childFactory path).
2. Read the member's scoped tool table: assert presence of the preset's file read (`read`/fs tools),
   shell exec (`pwsh` on win32), AND the ten `team_*` tools.
3. Run a REAL member turn that reads a known file and executes `pwd`; assert successful tool-call
   traces in the session log (a model-generated answer without tool-call traces is not evidence —
   per `docs/local-issues/team-member-missing-base-tools.md`).
4. Cold resume: stop the host, restart with the same DSH_HOME, resume the member (boot resume phase /
   `ensureLiveAgent`); re-assert the full tool table and that the standing preset mount was NOT
   remounted (one standing mount per preset — `livePresetMounts`/mount count, or log evidence).
5. No-regression: a normal (non-team) web session's tool table is byte-identical to the pre-change
   baseline.
6. Negative: a composition world without the `agent-presets` row (or a test harness that deletes the
   service) → member setup fails closed with the stable B1-chosen signal and the agent is NOT
   published (no half-composed session).

## Blocker section

**None.** `seam_verdict = yes`, `blocker_type = none`. The fixed CORE_SEAM_BLOCKER format does not
apply: no upstream symbol is non-exported, no upstream patch is needed, and no new upstream service
is required — the roster service is already provided by the web profile composition and is reachable
through the public `ctx.get` mechanism the Team host entry already uses.

Remaining risks (non-blocking, for G1/B1):
- Preset-scope decision (members-only vs all-row including the leader) and preset choice
  (`standard` = full ordinary surface vs a Team-authored minimal file/shell preset) are B1 product
  decisions; the seam supports both without further upstream surface.
- Fail-closed semantics when the `agentPresets` service is absent at setup time must be fixed by B1
  (recommend: reject setup → unpublished agent rolls back; never silently skip, which would
  reproduce D1).
- The 3180 test-world profile currently pins the prebuilt `host.js`/glue by absolute file URL
  (`references/.dsh-test/profiles/web/cordis.patch.yml:8,62-63` pointing at the MAIN checkout): after
  B1's changes the test world must be pointed at B1's built artifacts (mechanical, recorded in B1).

**Evidence-only statement**: no product code or upstream source was modified by A1; no runtime test
was run (task is evidence-only; B1 owns the real setup/tool regression).
