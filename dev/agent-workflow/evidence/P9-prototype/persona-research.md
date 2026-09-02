# R5 Research Report — Blueprint Leader/Member Persona: Making It ACTUALLY MODEL-VISIBLE

- **Worker**: Y (read-only research worker, DSH Team vNext P9 UI real-backend prototype)
- **Question (user correction R5)**: How can the Team Blueprint's Leader/Member **persona be made actually visible to the model**, using only public DSH seams (zero upstream changes)?
- **Date**: 2026-09-02, +08:00
- **Timebox**: START 18:03:41 · RESEARCH CAP 45 min (hard stop 18:48:41) · report written 18:19:12 (~15.4 min elapsed) — **within cap, decisive result**
- **Method**: public upstream seam search in `references/deepseek-harness-test-use` (pristine upstream, read-only) → P9P wiring mapping in `.worktrees/P9P` (read-only) → line-level verification pass. No modifications anywhere except this file.

---

## 1. VERDICT

**SEAM_FOUND**

A public DSH seam exists that makes the Blueprint persona model-visible with **zero upstream changes**:

> Inside the Team's existing **`AgentSetup` callback** (the `setup` option of `agents.create` / `agents.resume`), call
> `agentCtx.systemPrompt.section({ name: 'deployment:persona', order: PERSONA_ORDER, text: <blueprint persona> })`.

- The `SystemPrompt` service's `section()` registers a prompt section **in the calling context's scope**; scoped entries shadow the deployment (global) persona of the same name via the "nearest scope wins" merge rule. The agent scope is the nearest scope for that agent ⇒ the Blueprint persona replaces the deployment persona **for that agent only, on every turn**, while all other sessions keep the deployment persona.
- This is **byte-identical to the pattern DSH itself uses in-tree** for per-child subagent personas: `packages/subagent/subagent/src/child-agent.ts` L208 (`childCtx.systemPrompt.section({ name: 'deployment:persona', order: PERSONA_ORDER, text: composition.persona })` inside the child's setup callback). A supported, non-internal pattern.
- Timing is guaranteed: everything registered through the setup `agentCtx` "exists before agent/created and the first prompt assembly" (`docs/subsystems/core.md` L49), so the persona reaches the **first** turn of every root and member agent.
- The frozen architecture explicitly blesses exactly this: Architecture doc §40.4 (L2646-2654): "公开 scoped prompt section 支持同名 scope shadow；`deployment:persona` 是公开 slot。普通 Team persona 可以 scoped 安装；`complete:true` 必须 FATAL". §13.4: a non-complete preset persona is composable by scoped shadow. The current `root.ts` gap comment (L603-605) says the record-only install surface is "the S5A boot world has no DSH public prompt binding (**the real one lands with the T5/T6 public seam**)" — this report identifies that real seam.
- `FALLBACK_REQUIRED` is **not** needed. The fallback design is documented in §7 as a contingency only (not used, not wired).

**Exact injection point**: `.worktrees/P9P/packages/runtime/src/plugin/live/agent-bindings.mjs`, inside the body of the `async (agentCtx) => { ... }` returned by `agentSetup(sessionId, instanceIdHint)` (L328-360) — one new call, plus a small persona-resolution helper and two call-site hint threads (details in §4).

---

## 2. RESEARCH LOG

Timestamps +08:00 on 2026-09-02. Entries marked ≈ are phase boundaries reconstructed from the search sequence; the START time, the 18:13:20 clock check, and the 18:19:12 report time are exact (clock reads).

| Time | Activity | Result |
| --- | --- | --- |
| 18:03:41 | Task start (brief: R5 persona model-visibility, 45-min cap) | — |
| ≈18:04-18:08 | Upstream public-seam search: `docs/subsystems/core.md` (AgentSetup timing guarantee L49); `packages/core/agent/src/index.ts` (AgentSetup type L46-61; `setup` JSDoc L106-109); `packages/core/system-prompt/src/index.ts` (`FIRST_PARTY_SECTION_ORDER` L130-161; **`PERSONA_SECTION` L169**; **`PERSONA_ORDER` L172**; `Config.persona` doc L237-253; `SystemPrompt` class L389-441, `section()` L432-441 via `this.layers.effect(this.ctx, ...)`); `packages/core/scope/src/store.ts` L208-266 (`ScopedLayers.merge` "nearest scope wins a name"; same-layer duplicate throws, cross-layer same-name = designed shadowing; `effect(ctx)` → `scopeOf(ctx)` L226-247) | Candidate seam identified: scoped `deployment:persona` section on the agent ctx |
| ≈18:08-18:12 | In-tree proof search: `packages/subagent/subagent/src/child-agent.ts` L15 (`import { PERSONA_ORDER } from '@deepseek-ai/dsh-system-prompt'`), L178-210 (`applyChildComposition`: L204 preset compose, **L208 the persona section call**), called from `continuation.ts` L1069-1078 setup closure; `subagent/src/types.ts` L150-156 (persona JSDoc: "SHADOWING the deployment's persona for this child alone"); `packages/preset/persona/src/index.ts` (`dsh-persona` row: `ctx.systemPrompt.section({name: PERSONA_SECTION, order: PERSONA_ORDER, text, complete?})`); preset survey `packages/preset/agent-presets/presets/`: standard/ptc/cordis persona rows **without** `complete` (composable); **`minimal/agent.cordis.yml` L9-14 `complete: true`** (the FATAL case); `packages/bundle/web-app/cordis.patch.yml` L16-19 (global deployment persona text) + L434-438 (`agent-presets` default `standard`) | Seam confirmed as the upstream's own pattern for per-agent persona; scoping semantics verified |
| ≈18:12-18:15 | P9P gap + timing mapping: `root.ts` L581-613 (record-only `promptInstallations` Map; comment L603-605 "the real one lands with the T5/T6 public seam"; `personaSource` L588-602 already resolves blueprint persona); `root-binding/fresh-root.ts` L265 (root bind runs BEFORE the root agent exists); `activation/provider.ts` L296-312 (member bind is post-commit, AFTER the setup callback ran); `activation/types.ts` L157-163 (`ChildSessionCreationRequest` **already carries `templateId`**); `activation/adapter.ts` L64-73 (passes it to `factory.createChildSession`) | ⇒ only the AgentSetup callback can install persona into the prompt scope; `templateId` data flow already exists end-to-end |
| 18:13:20 | Clock check (~9.6 min elapsed); seam already established — switched to wiring-level mapping | within cap |
| ≈18:15-18:19 | Line-level verification pass (this final phase): `run.mjs` L122 (`ROOT_SESSION_ID='session-p6t6root'`), L191-251 (fixture blueprint incl. exact persona strings), L254-255 (seed shapes carry `templateId`), L301 (`rootSessionId: ROOT_SESSION_ID` in row config), L1038-1082 (zstd log read-back helpers); `agent-bindings.mjs` L79/L80 (imports), L87 (`LEADER_INSTANCE_ID`), L97-104 (deps), L112 (`rootSid = config.rootSessionId`), L198-253 (`instanceIdForSession`, `resolveConsumptionViews`), L328-360 (`agentSetup` body), L416-443 (`createChildSession`), L472-534 (`boot`: root L483-491, seeds L498-509, resume-branch members L513-525), L556/L584 (`createUserMessage` — fallback boundary, unused); `host.ts` L102-111 (`GlueModule` type), L344 (`let root`), L428-435 (glue deps), L466-477 (`root = builtRoot`; `requireRoot()`); `root.ts` L543 (`parseBlueprint`), L570-613, L1458-1463 (root object **exposes `blueprint`**); `system-prompt` export confirmation (L169/L172 `export const`); domain `MemberInstance.templateId` (`lifecycle/src/transitions.ts` L13 record fields; `t3-member-lifecycle.test.ts` L119 `created.record.templateId`); logging channel `agent-loop/src/agent.ts` L237 (assemble per step), L344 (`renderPrompt`), L496-511 (canonical header incl. `system` L499; `request/header` event appended, reason 'initial'/'change'), `invariant.ts` L45 (`options.system === header.system`) | All patch-surface line numbers verified; report written 18:19:12 |

No dead ends worth flagging beyond standard tooling: long-file middle pruning → exact `Get-Content | Select-Object -Skip/-First` ranges; `references/.dsh-test` full-tree scan avoided (sessions tree), scoped to `profiles/`.

---

## 3. SEAM FINDINGS

### 3.1 THE seam (adopted)

**`AgentSetup` + scoped `SystemPrompt.section('deployment:persona')` on the agent ctx.**

Public API surface used (all upstream **public** exports — no internal/private APIs):

| API | Location (upstream, read-only) | What it gives |
| --- | --- | --- |
| `agents.create({..., setup})` / `agents.resume({..., setup})` | `packages/core/agent/src/index.ts` L46-61 (`AgentSetupCommit`, `AgentSetup = (agentCtx: Context) => AgentSetupCommit \| Promise<...> \| void`), L106-109 (JSDoc) | A callback receiving the unpublished `agentCtx`, running **before the first prompt assembly** (`docs/subsystems/core.md` L49) |
| `agentCtx.systemPrompt` (Service) | `packages/core/system-prompt/src/index.ts` L389 (`export class SystemPrompt extends Service`) | The prompt service bound to **this agent's scope** |
| `section({name, order, text, complete?})` | same file L432-441 (`this.layers.effect(this.ctx, ...)`) | Registers a section "in the calling context's scope" (L237-253 Config doc) |
| `PERSONA_SECTION = 'deployment:persona'` / `PERSONA_ORDER = 0` | same file **L169 / L172** (`export const`; order = `FIRST_PARTY_SECTION_ORDER.DEPLOYMENT_PERSONA` L130-161) | The public persona slot name + its canonical order |
| Scope merge rule | `packages/core/scope/src/store.ts` L208-266 | "Nearest scope wins a name": the agent-scope section **shadows** the global deployment persona; same-name in the SAME layer throws (ours is first-in-layer — see 3.4) |

**In-tree proof that this is DSH's own pattern** (not an exotic usage): `packages/subagent/subagent/src/child-agent.ts` —
- L15: `import { PERSONA_ORDER } from '@deepseek-ai/dsh-system-prompt'`
- L178-210 `applyChildComposition`: L204 `childCtx.get('agentPresets')?.composeFrom(childCtx, parent.ctx)` (preset persona, if any), then **L208** `childCtx.systemPrompt.section({ name: 'deployment:persona', order: PERSONA_ORDER, text: composition.persona })`
- called from the child's `setup` closure (`continuation.ts` L1069-1078); `types.ts` L150-156 documents the child persona as "**SHADOWING** the deployment's persona for this child alone".

Team agents are created the same way (`agents.create`/`agents.resume` with a `setup` closure — `agent-bindings.mjs` L431/L439/L486/L490/L505/L524), so the identical call applies, per agent.

### 3.2 Candidates ruled out

| Candidate | Why rejected |
| --- | --- |
| Subagent package's `SubagentStartRequest.persona` | That is the **delegation-tool** (subagent) path. Team members are not subagent-tool children; they are `agents.create` sessions owned by the Team glue. The subagent *code* is the proof of the pattern (§3.1), but its request type is not the Team's seam. |
| `agentPresets.mount(agent.ctx, presetId)` (P5-T5 harness precedent, `.worktrees/P9P/packages/runtime/root-binding/harness/slots.mjs` L180-216) | Works (mounts a preset whose persona row lands in scope), but requires a **preset row per persona** and is the heavier of the two designs. The scoped-section call is the direct, designated seam (root.ts L603-605 anticipates "the T5/T6 public seam") and matches upstream in-tree usage exactly. |
| Deployment-level persona config (`packages/bundle/web-app/cordis.patch.yml` L16-19) | Global to every session in that deployment; cannot express per-template (leader vs worker vs scout) personas; would clobber every other session's persona. Not a per-agent seam. |
| A `complete: true` persona preset | Not a seam — a failure mode. Architecture §13.5 freezes it as **FATAL** `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` (frozen error code, `.worktrees/P9P/packages/contracts/src/errors.ts` L59-65; already implemented in the P5-T2 persona engine). `minimal/agent.cordis.yml` L9-14 is the upstream example of such a preset. |
| Any upstream change / core patch | Redline: **CORE PATCH BUDGET = 0** (repo AGENTS.md). R5 explicitly requires public seams only. |

### 3.3 The current gap (why persona is NOT model-visible today)

`.worktrees/P9P/packages/runtime/src/plugin/root.ts` L581-613:
- L585-587 `presetSeam = { getSubstrate: () => ({ presetId: 'dsh-agent-team', personaKind: 'standard' }) }` — "the S5A boot world has **no standing DSH preset persona**".
- L588-602 `personaSource` already resolves the right texts (`getLeaderPersona: () => blueprint.leader.persona`; `getMemberPersona` finds `blueprint.members` by `templateId`) — the data is there.
- L603-612 the "installation surface" `promptSurface.installScopedPersona` **records into a `promptInstallations` Map only**: "installations are recorded (observable, write-free) — never silently dropped… **the S5A boot world has no DSH public prompt binding (the real one lands with the T5/T6 public seam)**".

⇒ Today the persona is **observable in Team state but never reaches the assembled system prompt**. Timing evidence forces the fix location to the setup callback:
- `.worktrees/P9P/packages/runtime/root-binding/fresh-root.ts` L265 — `binder.bindFreshRoot(sessionId)` runs during durable root binding, **BEFORE** `live.boot()` creates the root agent;
- `.worktrees/P9P/packages/runtime/activation/provider.ts` L296-312 — the member bind is "Post-commit binder install… **AFTER** the terminal commit", i.e. after `createChildSession` (and thus after the setup callback) already ran.
- ⇒ A bind-time "install" cannot touch the agent's prompt scope. Only code **inside** the `agentSetup` callback runs in the agent's ctx before the first prompt assembly.

### 3.4 Collision / shadowing analysis

- Team agents carry **no preset persona in their scope** (no `agent-presets` mount for them; root.ts L583 "no standing DSH preset persona"). Their agent-scope prompt layer is empty at setup time ⇒ our `section()` call is **first-in-layer** (no same-layer duplicate-name throw, scope store L208-266).
- The web-app deployment persona (`cordis.patch.yml` L16-19, `dsh-persona` row **without** `complete`) is a **global, non-complete** section ⇒ our agent-scope section **shadows it for team agents only**; operator/non-team sessions are untouched (nearest-scope-wins; global layer still serves them).
- `complete: true` case: if a deployment ever mounted a complete:true preset for these agents, Architecture §13.5 mandates FATAL — the designated detector is the Team's own P5-T2 persona engine (`.worktrees/P9P/packages/runtime/agent-setup/persona/adapter.ts` decision table L40-46: absent→proceed, `standard(false)`→PASS, `complete(true)`→FATAL `TeamPersonaOverlayError`; frozen code in `contracts/src/errors.ts` L59-65). In the P9P world the substrate is statically `'standard'` (root.ts L586) and no preset row is mounted at all, so PASS is guaranteed; the guard stays in the engine, not duplicated in the glue.
- Disposal: the section belongs to the agent scope (registered through the agent `ctx`), so the agent-scope unwind removes it — same lifetime semantics as the existing `agentCtx.tools.register` calls in the same callback (`agent-bindings.mjs` L347-350). No extra disposer is required (upstream L208 ignores the return value identically).

### 3.5 Data flow already available (no new backend semantics)

- **`templateId` is already at every call site**:
  - fresh member: `ChildSessionCreationRequest.templateId` (`.worktrees/P9P/packages/runtime/activation/types.ts` L157-163) → passed to `factory.createChildSession(request)` (`.worktrees/P9P/packages/runtime/activation/adapter.ts` L64-73) — currently **ignored** in `createChildSession` (`agent-bindings.mjs` L417-443 uses only `request.instanceId`);
  - seeded members: `seed.templateId` (run.mjs L254-255 `TEAM_SEED_WORKER`/`TEAM_SEED_SCOUT` both carry `templateId`);
  - resumed members: the committed `MemberInstance` row carries `templateId` (`domain/lifecycle/src/transitions.ts` L13 record fields; `t3-member-lifecycle.test.ts` L119 `created.record.templateId`), reachable via `domain.repositories.memberInstances.list(rootSid)`.
- **Persona text source**: `parseBlueprint(config.blueprintSource)` (root.ts L543) exposes `blueprint` on the returned root object (root.ts L1458-1463) — the glue needs one lazy accessor (§4, host.ts hunk).
- **Root vs member**: `rootSid = config.rootSessionId` (`agent-bindings.mjs` L112; `ROOT_SESSION_ID = 'session-p6t6root'`, run.mjs L122, wired at run.mjs L301). The root session embodies the leader instance (L204-205 `instanceIdForSession`; `LEADER_INSTANCE_ID = 'inst-leader'` L87).

---

## 4. WIRING SPEC (patch proposal — specify only, NOT applied)

Two files, both **Team-owned** inside `.worktrees/P9P` (no upstream file touched). The implementer (backend worker, P9P writer) applies; hunks below are ready-to-apply unified diffs against the verified line numbers.

### 4.1 `.worktrees/P9P/packages/runtime/src/plugin/live/agent-bindings.mjs`

**Hunk A — import the public order constant (anchor L80)** — consistent with the existing `@deepseek-ai/*` import at L79-80 and with upstream `child-agent.ts` L15:

```diff
 import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
 import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
+import { PERSONA_ORDER } from '@deepseek-ai/dsh-system-prompt'
```

**Hunk B — persona resolution helpers (insert after `instanceIdForSession`, i.e. after L211)**:

```diff
   function instanceIdForSession(sessionId) {
     if (sessionId === rootSid) return String(LEADER_INSTANCE_ID)
     const members = domain.repositories.memberInstances.list(rootSid)
     for (const member of members) {
       if (String(member.childSessionId) === sessionId) return String(member.instanceId)
     }
     throw new Error(`p6t6 consumption: no team instance for session '${sessionId}'`)
   }
 
+  /**
+   * R5: the template id for one bound instance from the committed member
+   * row (undefined in the fresh-child pre-commit window, where the row
+   * does not exist yet — the caller's hint covers that window).
+   * @param {string} instanceId
+   * @returns {string|undefined}
+   */
+  function templateIdForInstance(instanceId) {
+    const member = domain.repositories.memberInstances.list(rootSid).find(
+      (row) => String(row.instanceId) === String(instanceId),
+    )
+    return member === undefined ? undefined : String(member.templateId)
+  }
+
+  /**
+   * R5: the model-visible persona text for one session — the blueprint
+   * leader persona for the root, the blueprint member-template persona for
+   * every member. `templateIdHint` covers the fresh-child pre-commit
+   * window; the committed domain row is authoritative otherwise.
+   * @param {string} sessionId
+   * @param {string} instanceId
+   * @param {string} [templateIdHint]
+   * @returns {string} the persona text (required non-empty in the blueprint)
+   */
+  function resolvePersonaText(sessionId, instanceId, templateIdHint) {
+    const blueprint = getBlueprint()
+    if (sessionId === rootSid) return String(blueprint.leader.persona)
+    const templateId = templateIdHint !== undefined
+      ? String(templateIdHint)
+      : templateIdForInstance(instanceId)
+    const template = blueprint.members.find(
+      (member) => String(member.templateId) === String(templateId),
+    )
+    if (template === undefined || String(template.persona).length === 0) {
+      throw new Error(
+        `p6t6 persona: no blueprint persona for templateId '${String(templateId)}' (instance '${String(instanceId)}')`,
+      )
+    }
+    return String(template.persona)
+  }
```

**Hunk C — `agentSetup`: signature + the model-visible install (L322-330)**:

```diff
    * @param {string} sessionId - the session this agent embodies.
    * @param {string} [instanceIdHint] - the fresh-child instance id carried
    *   by the child factory (see resolveConsumptionViews); only that caller
    *   passes it.
+   * @param {string} [templateIdHint] - the fresh-child template id carried
+   *   by the child factory: persona resolution needs the template in the
+   *   pre-commit window where the domain row does not exist yet.
    * @returns {function(object): Promise<void>} the AgentSetup callback.
    */
-  function agentSetup(sessionId, instanceIdHint) {
+  function agentSetup(sessionId, instanceIdHint, templateIdHint) {
     return async (agentCtx) => {
       const { modelView, mcpView, instanceId } = resolveConsumptionViews(sessionId, instanceIdHint)
+      // R5: make the Blueprint persona MODEL-VISIBLE. A scoped
+      // 'deployment:persona' section shadows the deployment persona for
+      // THIS agent scope only (nearest-scope-wins) — byte-identical call to
+      // the upstream subagent child setup (child-agent.ts L208). Runs before
+      // the first prompt assembly (docs/subsystems/core.md L49), so every
+      // turn of this agent carries it. Belongs to the agent scope; the
+      // scope unwind disposes it (as with the team tools below).
+      agentCtx.systemPrompt.section({
+        name: 'deployment:persona',
+        order: PERSONA_ORDER,
+        text: resolvePersonaText(sessionId, instanceId, templateIdHint),
+      })
```

(The existing L331-359 body — model selection, team tools, MCP, boundary records — is unchanged.)

**Hunk D — child factory: thread `request.templateId` (L429-440)**:

```diff
       if (sessionIsDurable(childSid)) {
         const handle = await agents.resume({
           resumeSessionId: SessionId(childSid),
-          setup: agentSetup(childSid, instanceIdHint),
+          setup: agentSetup(childSid, instanceIdHint, request.templateId),
         })
         liveAgents.set(childSid, handle)
         return { childSessionId: childSid }
       }
       const handle = await agents.create({
         sessionId: SessionId(childSid),
         meta: { cwd: process.env.DSH_HOME },
-        setup: agentSetup(childSid, instanceIdHint),
+        setup: agentSetup(childSid, instanceIdHint, request.templateId),
       })
```

**Hunk E — seed loop (L502-506)** — seed rows are already committed before boot, so the domain fallback would resolve too; the hints make the seed path independent of domain availability and uniform with the fresh-child path (instance resolution is deliberately left to the domain, as today):

```diff
           const handle = await agents.create({
             sessionId: SessionId(child),
             meta: { cwd: process.env.DSH_HOME },
-            setup: agentSetup(child),
+            setup: agentSetup(child, undefined, seed.templateId),
           })
```

**No change needed** at L486/L490 (root: `agentSetup(rootSid)` — root ⇒ leader persona) and L524 (resume-branch members: `agentSetup(child)` — the committed row carries `templateId`, resolved by `templateIdForInstance`).

### 4.2 `.worktrees/P9P/packages/runtime/src/plugin/host.ts`

**Hunk A — `GlueModule` type (L102-111)** — structural return type so the plain-JS glue never imports TS packages (the plain-Node host row constraint; constants are mirrored today, e.g. `LEADER_INSTANCE_ID` in the glue):

```diff
 /** The plain-JS glue module (config.glueUrl) export surface. */
 interface GlueModule {
   createAgentBindings(deps: {
     readonly agents: unknown
     readonly sessionPersistence: unknown
     readonly domain: TeamDomain & { readonly consumption: DomainConsumption }
     readonly config: TeamPluginConfig
     readonly teamToolsRef: { current: unknown }
     readonly now: () => string
+    // R5: lazy access to the parsed TeamBlueprint (persona source).
+    // Structural: the glue is plain JS and must not import TS packages.
+    readonly getBlueprint: () => {
+      readonly leader: { readonly templateId: string; readonly persona: string }
+      readonly members: ReadonlyArray<{ readonly templateId: string; readonly persona: string }>
+    }
   }): TeamAgentBindings
 }
```

**Hunk B — glue deps (L428-435)** — `let root` is in scope (L344); the setup callbacks run during `builtRoot.boot()` (L467), i.e. **after** `root = builtRoot` (L466), so the lazy pointer is always set when read:

```diff
   const live: TeamAgentBindings = glue.createAgentBindings({
     agents,
     sessionPersistence,
     domain: domainFacade,
     config: rowConfig,
     teamToolsRef,
     now: () => new Date().toISOString(),
+    // R5: blueprint persona source for the glue's AgentSetup callbacks
+    // (root.ts L543 parses it; the root object exposes it, root.ts L1458-1463).
+    getBlueprint: () => {
+      const r = root
+      if (r === undefined) {
+        throw new Error('team host: getBlueprint before root assembly')
+      }
+      return r.blueprint
+    },
   })
```

### 4.3 `.worktrees/P9P/packages/runtime/src/plugin/root.ts` — **no code change**

The record-only `promptInstallations` Map (L603-612) **stays** as the Team-state audit record ("observable, never silently dropped"); only the model-visible install additionally happens in the glue's setup callback. Optional doc-only: update the L603-606 comment to point at the glue install (`agent-bindings.mjs` AgentSetup) as the realized "T5/T6 public seam".

### 4.4 Why this shape (design notes for the implementer)

1. **Injection must be in the setup callback** — bind-time install is impossible (root binds before its agent exists; member bind is post-setup; §3.3).
2. **One new upstream surface consumed**: `PERSONA_ORDER` import from `@deepseek-ai/dsh-system-prompt` (public export, L172) — the section name uses the literal `'deployment:persona'`, exactly as upstream `child-agent.ts` L208 does (name literal + imported order constant). If the implementer prefers, `import { PERSONA_SECTION, PERSONA_ORDER }` and use `PERSONA_SECTION` — both are public (L169/L172).
3. **Fail-closed**: a missing/empty persona for a resolved template throws inside setup ⇒ agent creation fails visibly (blueprint types make persona required non-empty — `domain/blueprint/src/types.ts` L33-41 — so this is defensive, not expected).
4. **complete:true guard stays in the P5-T2 engine** (`agent-setup/persona/adapter.ts` L40-46): FATAL `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` per §13.5. P9P substrate is statically `'standard'` (root.ts L586), so the glue's unconditional register is safe in this world; if a deployment later mounts a complete:true preset, the engine's FATAL is the designated gate (never silently override — UI frozen copy, UI Design doc §7.4 L468-487: "不偷偷忽略 Blueprint persona").
5. **Reversibility**: deleting hunks A-E (4.1) + A-B (4.2) restores today's behavior exactly (record-only persona). No durable state is touched; persona affects prompt assembly from the next turn of each agent.

---

## 5. PERSONA TEXT — what the Blueprint fields are TODAY (exact quotes)

Source: `.worktrees/P9P/packages/tools/harness/run.mjs` L191-251, `TEAM_BLUEPRINT_SOURCE` (fixture blueprint `blueprintId: P6T6-BP`, `revision: "1"`):

| Field (YAML line) | Exact text |
| --- | --- |
| `leader.persona` (L198, `templateId: leader`) | `You lead the P6T6 team.` |
| `members[worker].persona` (L202, `templateId: worker`) | `You do the P6T6 work.` |
| `members[scout].persona` (L205, `templateId: scout`) | `You scout for the P6T6 team.` |

Contract shape (frozen): `BlueprintTemplate.persona: string` — **required, non-empty** (`packages/domain/blueprint/src/types.ts` L33-41); `blueprint.leader.persona` and `blueprint.members[].persona` as resolved by `personaSource` (root.ts L588-602). The deployment-level (global) persona these must shadow is `packages/bundle/web-app/cordis.patch.yml` L16-19: `You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}.` — a non-complete global section (no `complete` in the `dsh-persona` row).

Today's state: these three strings are **parsed, stored, and exposed via `personaSource`, recorded in `promptInstallations`, and shown in Team state/UI — but they are never part of the system prompt sent to the model** (root.ts L603-612). That is the R5 gap this report closes.

---

## 6. E2E ASSERTION

**Channel**: the durable session log. DSH convention "model-visible ⟺ logged": the assembled system prompt is appended to the session log as the `request/header` event — `agent-loop/src/agent.ts` L237 (`assemble` per step) → L344 (`renderPrompt(assembly)`) → L496-501 (canonical header, `system` field at L499) → L505-511 (`session.append('request/header', { header, reason: 'initial' | 'change' })`); `invariant.ts` L45 pins `options.system === header.system` (what was sent is what is logged). The P9P harness already has the read-back machinery: `decompressZstdStream` (run.mjs L1038-1063) and `readChildSessionLog(sessionId)` (run.mjs L1066-1082, reading `<DSH_HOME>/sessions/<profileDir>/<sessionId>/session.jsonl.zstd` under the test DSH_HOME `references/.dsh-test`).

**Assertions** (harness additions for the P9P E2E run; all string-exact):

1. **Leader**: the root session log (`ROOT_SESSION_ID = 'session-p6t6root'`, run.mjs L122) contains a `request/header` event whose `header.system` contains exactly `You lead the P6T6 team.`
2. **Worker**: the seeded worker child log (`session-child-p6t6seedw1`, run.mjs L254) — and every worker created by the E2E scenarios — contains `You do the P6T6 work.` in `header.system`.
3. **Scout**: the seeded scout child log (`session-child-p6t6seeds1`, run.mjs L255) — and every created scout — contains `You scout for the P6T6 team.` in `header.system`.
4. **Shadowing (negative)**: none of the team-agent logs in (1)-(3) contain the stable prefix of the global deployment persona, `You are a coding agent powered by the` (cordis.patch.yml L16-19) — the agent-scope section replaced it for these agents only.
5. **Global untouched (optional positive)**: a non-team session in the same test instance still carries the global deployment persona (proof the shadow is per-scope, not a global rewrite).

**Implementation sketch** (harness side, plain JS): reuse `readChildSessionLog` (and a symmetric root-session variant — the helper is a plain `<sessionId>` read, so it works for the root too) → decompress → parse JSONL lines → select `type === 'request/header'` events → assert `event.header.system.includes(<exact persona>)` per the table above. Because persona registration happens in the setup callback **before the first prompt assembly**, the `reason: 'initial'` header already carries it — no later-'change' event is required (a later 'change' event is tolerated, e.g. model-selection re-assembly; assert on the latest header of the session).

---

## 7. SCOPE NOTE

- **Zero upstream change**: every file in §4 is Team-owned (`.worktrees/P9P/packages/runtime/...`). The seam APIs consumed are public package exports of upstream (`AgentSetup` via `agents.create/resume` `setup`; the `SystemPrompt` service on `agentCtx`; `PERSONA_ORDER`/`PERSONA_SECTION` constants, system-prompt index.ts L169/L172) — the identical surface DSH's own subagent package uses in-tree. CORE PATCH BUDGET = 0 holds; no private/internal APIs, no patch-package, no vendored upstream.
- **Prototype context**: this lands in the P9P E2E world (test DSH instance per `docs/TEST_METHODS.md` — source `references/deepseek-harness-test-use`, DSH_HOME `references/.dsh-test`, port 3180; static model `p6t6-static/p6t6-model-v1`, fixture blueprint P6T6-BP). The wiring is blueprint-generic (any parsed `TeamBlueprint`), not P6T6-specific.
- **No new backend/remote semantics**: the facade surface (`member.create` / `member.send` / `member.followup` — `dev/agent-workflow/evidence/P8-S/backend-contract-freeze.md` L85) is untouched; persona rides existing internal plumbing (`AgentSetup` already passed at every create/resume site; `request.templateId` already flowing). Contracts package unchanged.
- **Reversible**: §4.4(5). The `promptInstallations` audit record semantics are preserved (root.ts unchanged).
- **Fallback contingency (NOT used — verdict is SEAM_FOUND)**: had no public seam existed, the R5-mandated fallback would have been `PROTOTYPE_PERSONA_FALLBACK` — a preamble of the form `[PROTOTYPE_PERSONA_FALLBACK: <exact persona text>]` (explicitly marked prototype-only) injected at the Team-owned model-visible work-delivery boundary: the `createUserMessage` sites in `agent-bindings.mjs` L556 / L584 (imported from `@deepseek-ai/dsh-llm` at L79), i.e. prepended to the model-visible work prompt delivered to each member. Not needed; not wired.
- **Worker redlines honored**: read-only everywhere except this report file; no git state changes; no servers started; no network access; upstream `references/deepseek-harness-test-use` untouched.

---

*Report complete 18:19:12 +08:02 — 29 min before the hard stop. Verdict: SEAM_FOUND; injection point: `agent-bindings.mjs` `agentSetup` callback (L328-360) via `agentCtx.systemPrompt.section({ name: 'deployment:persona', order: PERSONA_ORDER, text: <blueprint persona> })`; wiring: 2 files (agent-bindings.mjs hunks A-E, host.ts hunks A-B); E2E: exact persona strings in `header.system` of the durable zstd session logs.*
