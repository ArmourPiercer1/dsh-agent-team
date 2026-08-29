# P2-T3 Seam Report — Preset / Persona / Model Seams

Task: **P2-T3 — Preset/persona/model seams** (TaskDoc §11.3), dsh-agent-team vNext unattended program, CORE PATCH BUDGET = 0.
Canonical evidence: `run/` (Run B, attempt 2/3, `RESULT: PASS`, `summary.json` → `ok: true, failures: []`).
Attempt-1 artifacts preserved under `run-a-attempt1/` (see `compliance-report.md`).

All probes ran **against the public surface only** (whitelisted upstream packages via farm links; static gate in the P2-T1 harness verified every probe import against the live public surface). No upstream code was modified, no private/internal API was called, no patch was applied to the pinned tree (byte-clean section: `git status --porcelain` empty, `git diff` empty, HEAD unchanged `cd5ef8148158c3a752a658978873241fdf8e2bbc`).

## Frozen-Architecture authority (verbatim quotes)

Source: `references/.scratch-freedocs/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md` (mirror of the frozen `docs/plans/active/` Architecture doc). Line numbers refer to that file.

**§13.5 — the 1A decision (L986-1002):**

> DSH 的 `PromptSection.complete=true` 表示该 section 是唯一 system prompt；其完整 section 在 assemble waterfall 后仍被恢复，因此外部 middleware 不能可靠地只替换 text 而保留完整语义。

> 在 0-core 条件下，Team 不实现通用 persona-text override core seam。

> 因此最终规则：
>
> ```
> AgentPreset effective persona complete=true
> → TEAM_PERSONA_COMPLETE_PRESET_CONFLICT
> → Structural FATAL
> ```
>
> 用户不能 Continue Anyway。

> 普通非 Team Session 继续可以正常使用该 AgentPreset。

**Decision #48 (L2901):**

> 48. **AgentPreset effective persona `complete:true` 对 Team 为 structural FATAL。**

**§13.6 — prohibitions (L1004-1012):**

> 禁止：- Team 强制把 `complete:true` 改成 false；- Team 忽略 Blueprint persona；- Team 解析并复制 `dsh-persona` 私有语义；- patch upstream persona package；- post-first-prompt 再补 Team identity。

**§13.2 (L944-954):**

> provider/model/reasoning effort 属于 per-Agent ModelSelection route，而不是 AgentPreset identity。

> ```
> Agent substrate = AgentPreset composition
> Model route     = ModelSelection
> Team semantics  = TeamSession/Member overlay
> ```

> 三者是不同维度。

**§13.1 (L938-940):**

> MemberInstance 默认继承 Root AgentPreset 的 composition substrate。
> vNext 不支持 per-member AgentPreset selector。

**§13.4 (L974-984):**

> 对于可被 scoped persona shadow/Team identity 正常组合的 AgentPreset：
> “Blueprint persona text + AgentPreset assembly semantics” 形成最终 Team identity。

**§40.3 (L2638-2644):**

> 公开 model-selection mechanism 在 prompt assembly 时捕获 selection，并将 provider/model/effort 应用于对应 request；并发切换影响后续 step。
> vNext 的 model turn/step-boundary mutation 与 upstream 正式语义一致。

**§40.4 (L2646-2654):**

> 公开 scoped prompt section 支持同名 scope shadow；`deployment:persona` 是公开 slot。
> 但 `complete=true` section 在 assemble waterfall 后仍被恢复为唯一 prompt。
> 普通 Team persona 可以 scoped 安装；`complete:true` 必须 FATAL，除非未来 upstream 自己提供通用 persona-text override seam。

**Appendix A.2 (L2973-2983, audit `packages/core/agent/src/model-selection.ts`):**

> 事实：selection 在 assembly 捕获并应用于相应 request，并发切换作用于后续 step。
> 结论：Member model turn/step mutation 与 upstream 正式语义一致。

**Appendix A.3 (L2985-2995, audit `packages/core/system-prompt/src/index.ts`):**

> 事实：`deployment:persona` 是 scoped section；`complete` section 在 waterfall 后恢复为唯一 system prompt。
> 结论：普通 scoped Team persona 可行；`complete:true` 必须按 1A 判 FATAL。

**Appendix A.4 (L2997-3007, audit `packages/preset/agent-presets/src/index.ts`):**

> 事实：AgentPreset 是 standing composition，Agent 通过 scope parent join；setup 是支持的 pre-publication join point。旧 roster drift 的问题来自 Team 自己的 mutable shared registry/cwd reload，而不是“AgentPreset 天生等于一个共享 Team”。
> 结论：AgentPreset 可以继续作为 substrate，但 Team durable state 不能放进其 mutable shared realm。

---

## Seam 1 — AgentPreset composition (standing substrate)

**Criterion (Appendix A.4; §13.1).** AgentPreset is a *standing composition*: a roster of preset ids resolves against Host-owned roots (system trust) plus `<dshHome>/.agent-presets` (user trust); an Agent joins it through its scope parent; `setup` is the supported pre-publication join point. A Team must be able to use it as substrate **without** placing Team durable state in the preset realm.

**Public mechanism.** `agentPresets.list()`, `agentPresets.resolve(id?)` (default `'standard'`), `agentPresets.mount(agentCtx, id?)`, `agentPresets.standingKeyFor(id?)`, `agentPresets.composedPreset(agentCtx)`; `agents.create({ meta: { cwd, agentPreset }, setup })` from `@deepseek-ai/dsh-agent`.

**Positive evidence (Run B).**
- `observations/roster.json`: roster = `standard, ptc, minimal, cordis` (trust `system`) + `p2t3-scope` (trust `user`, the probe's own authored preset); `defaultId: "standard"`.
- `observations/scope.json`: standard agent's `deployment:persona` = `You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}.` (standard preset text); user-preset agent's persona = `P2T3-SCOPE-PROBE persona from user preset p2t3-scope.` (unique text, proving per-preset composition is live, not a single shared prompt).
- run-log L84-85: `PASS standard standing scope: preset persona registered at the preset standing key` / `PASS user standing scope: ...` — the persona section is registered at the preset's **standing key** (`standingKeyFor`), i.e. the preset is a standing composition independent of any agent.
- run-log L88: `PASS scopeOf(agent.ctx) is the Agent object itself (agent IS its scope key)` — the Agent joins the preset scope chain as parent (Appendix A.4 “Agent 通过 scope parent join” confirmed empirically).
- `observations/switch.json` `stateAfterFirst`: after `select(agent, 'minimal')`, `composedPreset: "minimal"` reflects live on the same agent.

**Negative control.**
- `observations/roster.json` `unknown`: `resolve('p2t3-nope')` → `UnknownPresetError`, message `agent-presets: preset "p2t3-nope" not found (available: standard, ptc, minimal, cordis, p2t3-scope)`, `.available` list machine-readable.

**Verdict: PASS.** The preset subsystem provides a public, enumerable, per-agent standing-composition substrate; the seam a Team needs (resolve → mount in `setup` → live `composedPreset`) exists with zero core patches.

---

## Seam 2 — Persona scope (preset standing scope; no cross-scope leak)

**Criterion (§40.4; Appendix A.3).** `deployment:persona` is a **public scoped slot**; the AgentPreset registers its persona in the preset's standing scope; agents inherit it via the scope chain (scoped-over-global merge in `assemble`); a preset's persona must not leak into scopes that do not join that preset.

**Public mechanism.** `systemPrompt.section({ name: 'deployment:persona', order, text, complete? })` registered at the preset standing key (upstream `agent-presets` row); `scopeOf(agent.ctx)` from `@deepseek-ai/dsh-scope`; `systemPrompt.assemble({ scope })`.

**Positive evidence (Run B).**
- `observations/scope.json`: root scope persona = standard text (deployment default); minimal agent sees **exactly one section** (`deployment:persona`, minimal text — `complete: true` + `includeRuntimeContext: false` suppresses everything else); user agent sees the user text with standard non-persona sections (persona shadowed, context sections retained).
- run-log L84-85: standing-scope assemblies (no agent involved) return the correct preset persona for standard and user presets — the persona lives at the preset standing key, joinable by any scope that parents it.
- run-log L88: `scopeOf(agent.ctx)` identity holds for agents a (standard) and c (user preset).

**Negative control (leakage).**
- run-log L86: `PASS minimal persona text does not leak into root/user scopes`.
- run-log L87: `PASS user persona text does not leak into root/standard/minimal scopes`.
- (Leakage check uses the probe's unique `P2T3-SCOPE-PROBE` text, so a false-positive match is impossible — the deployment/standard persona texts are identical and could not be distinguished otherwise.)

**Verdict: PASS.** Persona assembly is correctly scoped: one shared `SystemPrompt` instance, sections registered at preset standing keys, per-agent effective persona by scope join, zero leakage. This is exactly the “普通 Team persona 可以 scoped 安装” path of §40.4.

---

## Seam 3 — `complete:true` detection / blocking (the 1A decision)

**Criterion (§13.5 / Decision #48 / §13.6, quoted above).** An AgentPreset whose **effective persona** is `complete:true` must be **structurally FATAL for a Team** (`TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`, no Continue Anyway), because under 0-core there is no generic persona-text override seam. Per task instruction, this probe verifies only that the condition is **detectable** and **blockable** — **no override is attempted as a capability**; the middleware below only demonstrates the block mechanism.

**Public mechanism.** `systemPrompt.section({ ..., complete: true })`; `systemPrompt.assemble({ scope, signal })`: (1) if **more than one** effective complete section is in scope it **throws before the waterfall** — `multiple complete prompt sections are active: "<a>", "<b>"`; (2) the single complete section is snapshotted **pre-waterfall** and restored **byte-exact post-waterfall**, so any in-waterfall text mutation of it is discarded.

**Positive evidence — detectable (Run B).**
- `observations/negative-complete.json`: with the minimal preset mounted (its persona is `complete: true`), registering a second complete section `p2t3:probe-complete` in agent scope and assembling throws:
  `multiple complete prompt sections are active: "deployment:persona", "p2t3:probe-complete"`.
- A Team can therefore **pre-flight detect** an effective complete persona through the public surface: read the preset's section definitions (roster/resolve/mount) or attempt a scoped assembly and catch the deterministic error that **names both sections**. The detection is machine-readable (both names in one string), which is what a structural-FATAL gate needs.

**Negative control — blockable (Run B).**
- `observations/negative-override.json`: a waterfall middleware on `system-prompt/assemble` appends the marker ` [P2T3-OVERRIDE-ATTEMPT]` to every section text; the resulting assembly is **exactly** `You are a helpful software engineer assistant.` — `PASS NEGATIVE: override marker absent from every assembled section` (run-log L78).
- This is the upstream enforcement the 1A decision relies on: even a full in-waterfall text replacement cannot survive — the complete section is restored verbatim. Combined with the multiple-complete throw, a Team **cannot** (a) shadow the complete persona, (b) rewrite its text, or (c) force `complete` to false, all without an upstream change — i.e. the FATAL is structural, not a Team-side convention. §13.6 prohibitions (force complete→false, ignore Blueprint persona, parse/copy private semantics, patch the persona package, post-first-prompt identity patching) are each impossible on this surface.

**Verdict: PASS (detectable + blockable; 1A enforceable under 0-core).** The `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT → Structural FATAL` rule can be implemented entirely by reading preset metadata + the public assembly error; non-Team sessions keep using complete presets normally (the minimal preset ran fine for a plain session in boot 2, Seam 6).

---

## Seam 4 — ModelSelection future boundary (per-Agent model route)

**Criterion (§40.3 / Appendix A.2, quoted above).** The public model-selection mechanism captures `selection.current` **at prompt assembly**, applies provider/model/(effort) to the **corresponding request**; a **concurrent switch affects subsequent steps only**. “vNext 的 model turn/step-boundary mutation 与 upstream 正式语义一致” — the probe pins that exact boundary.

**Public mechanism.** `installModelSelection(agentCtx, ref)` from `@deepseek-ai/dsh-agent` (ref = `{ current, assembled }`); `agentEvents(ctx, agent)` dispatch for manual `agent/request` + `system-prompt/assemble` waterfalls.

**Positive evidence (Run B, `observations/model.json`).**
- step1 (selection A active): assembly captured A → `ref.assembled = A`, assembly variables patched `{provider: p2t3-provider-a, model: p2t3-model-a}`; request resolved with A, **seed `maxTokens: 1234` preserved**, seed `reasoningEffort: "medium"` **cleared** (no effort in selection → `reasoningEffort: null`).
- step2: after `ref.current = B`, the next assembly captured B and the next request applied B — switch takes effect at the step boundary.
- step3 (selection C_EFFORT with `reasoningEffort: "high"`): request carries `reasoningEffort: "high"` — a *selected* effort is applied.
- step4 (selection C_PLAIN, same provider, no effort): request `reasoningEffort` cleared again — absence of selected effort clears inherited effort.
- Disposer: `afterDispose` — assembly variables `{provider: null, model: null}` (patch step removed) and request reverted to the **bare seed** `{p2t3-seed-provider, p2t3-seed-model, maxTokens: 1234, reasoningEffort: "medium"}` — both assembly and request steps are removed by the disposer.

**Negative control — the future boundary itself.**
- `concurrentSwitchSameStep` (`observations/model.json` L49-56; run-log L93): `ref.current` was switched to B **mid-step**, after the assembly captured A but before the in-flight request resolved. The in-flight request still applied **A**. Only the following step applied B.
- This is the exact §40.3 sentence pinned empirically: “并发切换影响后续 step” — a Team Member model-route mutation mid-turn cannot retro-change the in-flight request; it binds the next step.

**Verdict: PASS.** provider/model/effort ride the per-Agent ModelSelection route, captured at assembly and applied per-request, with the concurrent-switch boundary exactly at the step edge — consistent with upstream formal semantics (Appendix A.2), zero core patches.

---

## Seam 5 — Preset switch lock (post-`turn/start` fixity)

**Criterion.** A session's agent preset may change **only while the session is blank** (no `turn/start` event yet). Once started, the preset is fixed: further selects are rejected with a machine-readable lock error, and the lock takes precedence over other errors. (Supports the vNext model where Team membership/composition is set pre-publication — §13.1, and the `agent-preset/selected` durable log record in `packages/preset/agent-presets/src/session.ts`.)

**Public mechanism.** `agentPresets.select(agent, id)`; lock guard = presence of a `turn/start` event in `session.events`; failures surface as wrapped remote failures with `.failure: { code, message, details }`; success appends an `agent-preset/selected` event that advances the `agentPreset` session projection.

**Positive evidence (Run B, `observations/switch.json`).**
- `first`: `select(agent, 'minimal')` on a fresh (blank) session succeeds; `stateAfterFirst`: `composedPreset: "minimal"`, `agentPreset` projection = `"minimal"`, `agent-preset/selected` event appended at seq 3 with `data.agentPreset: "minimal"` — the change is durable-log-backed (model-visible ⟺ logged).

**Negative controls (all four in `observations/switch.json`).**
- `unknownOnUnlocked`: `select(agent, 'p2t3-nope')` on a blank session → `code: "agent-preset-not-found"`, details carry `available: [standard, ptc, minimal, cordis, p2t3-scope]`.
- `locked`: after appending `turn/start`, `select(agent, 'standard')` → `code: "agent-preset-locked"`, message `session "p2t3-standard-mtepvqpv-cyy636" has already started; its agent preset is fixed`, details `{sessionId, agentPreset: "standard"}`.
- `unknownOnLocked` (**precedence**): unknown id on a locked session → still `agent-preset-locked` (lock checked **before** resolution), details `{sessionId, agentPreset: "p2t3-nope"}`.
- run-log L100-109: all six switch checks PASS, including `isPresetLockedError: false` — the runtime rejection is a wrapped remote failure, **not** `instanceof PresetLockedError`; the reliable machine-readable assertion is `.failure.code` (a Team gate must key on the code, not the class).

**Verdict: PASS.** Blank-window switching is a public, log-backed operation; post-start fixity is enforced by the preset service itself with deterministic, code-tagged errors and documented precedence — a Team can rely on preset fixity without any Team-side lock.

---

## Seam 6 — Cold resume (durable preset + model selection across process restart)

**Criterion.** A session's preset identity and model selection must survive **process death** and be reconstituted by the same public path the application uses (`sessionQuery.observeSession` → projections; `agents.resume` with the app-faithful `setup` = model-selection install + preset mount), so a Team session's members can be re-attached after a host restart with identical composition.

**Public mechanism.** Durable creation header field `SessionHeader.agentPreset` (`core/session/src/index.ts:884`); `agentPreset` session projection — `init: header => header.agentPreset ?? null`, advanced by `agent-preset/selected` (`packages/preset/agent-presets/src/session.ts:35-43`); `modelSelection` projection `{ lastUsed, pending }` (plain record); `sessionQuery.observeSession(sessionId)` → disposable observation with `projections.values`; `agents.resume({ resumeSessionId, setup })`.

**Test shape.** Boot 1 (main payload): agent B created on the `minimal` preset (`meta.agentPreset: 'minimal'`), a `model/selection` event `{provider: p2t3-provider-b, model: p2t3-model-b}` appended to its session, handle disposed (detaches live registries only); DSH process **stopped** (boot 1 = full process teardown, port freed — run-log L50). Boot 2 (resume payload, **fresh process**): read `coord.json` → `sessionQuery.observeSession(resumeSessionId)` → recover preset id → `agents.resume` with `setup` = `installModelSelection` then `agentPresets.mount` (app-faithful order, `packages/api/session-controller/src/agent.ts` compose path) → first post-resume assembly → dispose.

**Positive evidence (Run B, `observations/resume-verify.json`).**
- `composePath: "sessionQuery.observeSession"` — the preset id was recovered **from the durable `agentPreset` projection** (the app's own path), not from any in-memory state: `presetIdUsed: "minimal"`, `resolvedId: "minimal"`, `composedPreset: "minimal"` on the resumed agent, `projectionAgentPreset: "minimal"`.
- run-log L117-118: `PASS resume: the persisted model/selection event survived the process restart` / `PASS resume: modelSelection projection carries the persisted selection as pending (lastUsed null)` — `projectionModelSelection: { lastUsed: null, pending: { provider: "p2t3-provider-b", model: "p2t3-model-b" } }`, and the event is present in the durable log at seq 3.
- run-log L119: first post-resume assembly **captured the pending selection at the assembly boundary** — `refAssembledAfterFirstAssembly: { p2t3-provider-b, p2t3-model-b }` (§40.3 boundary holds across the restart).
- run-log L120: composition rebuilt **identically** — assembly = exactly `[{ name: "deployment:persona", text: "You are a helpful software engineer assistant." }]`, `contexts: 0` (the minimal preset's `complete: true` + `includeRuntimeContext: false` semantics reproduced byte-for-byte in a new process).
- `done-main.json` / `done-resume.json` both `{completed: true}`; boot 2 marker at run-log L51; port free after stop (L53).

**Negative control / boundary note.**
- `resume-verify.json` `header.agentPreset: null` is **not** an upstream anomaly: `Session.requestHeader()` returns the **request-epoch fold** (`EpochHeader` = call config / system prompt / tools — `core/session/src/index.ts:668`, `types.ts:184`), which structurally does not carry preset identity. The observation field is labeled `header` but holds that fold; the **authoritative** resume read is the `agentPreset` projection (which the probe used and which carried `minimal`). A Team resume path must read the projection (exactly what the app does), never a request-epoch header.
- `header` (creation header) vs projection: for this session both agree on `minimal` (header written at creation via `meta.agentPreset`; projection initialized from it, no later `agent-preset/selected` on this session — the switch in Seam 5 happened on a *different* session, agent F).

**Verdict: PASS.** Preset identity and model selection are durable across a full process restart and reconstitute through the same public path the application uses, with identical composition — a Team can cold-resume members with zero core patches.

---

## Cross-seam mechanics discovered (documented for later tasks)

1. **Loader apply-order race.** Cordis applies composition rows in async interleaved order (dynamic module imports), **not** strict composition order: a row's `apply` can run before other rows' services exist in the global store (boot 1 found all services my payload needed; boot 2, same composition position, missed `agentPresets` + `sessionQuery` under synchronous `ctx.get`). The robust documented pattern is named-export `inject: [...]` on function plugins (upstream `vendor/cordis/src/registry.ts:330` resolves `plugin.inject`; the fiber defers `apply` until all injected services exist). Both probe payloads now use it. (Upstream `packages/AGENTS.md` “Plugin exports” + postmortem 0001 document the same family of hazard.)
2. **`resetPatchLayer` latent defect in the P2-T1 harness** (`tests/characterization/lib/instance.mjs:193` passes an array to `writeFileSync`) — caused the entire Run A failure at my call site. Worked around inside my group (direct `writeFileSync` of the reset comment); no P2-T1-owned file was modified. Flagged in `compliance-report.md` for the P2-T1 owner.
3. **Runtime preset errors are wrapped**: assert on `e.failure.code` (`agent-preset-locked` / `agent-preset-not-found`), not `instanceof` (see Seam 5).

## Verdict table

| # | Seam | Verdict | Blocker |
|---|------|---------|---------|
| 1 | AgentPreset composition (standing substrate) | PASS | — |
| 2 | Persona scope (preset standing scope; no leak) | PASS | — |
| 3 | `complete:true` detection / blocking (1A) | PASS | — |
| 4 | ModelSelection future boundary | PASS | — |
| 5 | Preset switch lock | PASS | — |
| 6 | Cold resume (durable preset + selection) | PASS | — |

No `CORE_SEAM_BLOCKER` was emitted: every seam in TaskDoc §11.3 was characterized through the public surface only.
