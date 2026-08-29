# P2-T4 — Capability Seam Matrix (TaskDoc §11.3)

**Task card goal (verbatim):** 分别验证 pre-step、pre-execute、tool visibility、skills、MCP 的
Agent-scope 控制能力；skills/MCP 分开判定；不要由 tool seam 推断。
**Acceptance:** 每类 seam 有 PASS 或具体 blocker；禁止 private registry。
**Output:** 本矩阵（5 seams × 4 dimensions；每格：public mechanism → positive evidence →
negative control → verdict）。

- Host SHA (pinned test-use tree): `cd5ef8148158c3a752a658978873241fdf8e2bbc` (pristine at start, byte-clean after — harness-asserted both sides)
- Branch / worktree: `task/P2-T4-capabilities` @ `.worktrees/P2-T4`
- Probe group (owned): `tests/characterization/probes/capabilities/` (payload `plugins/capability-scenario.js` + orchestrator `index.mjs`)
- Canonical evidence: `dev/agent-workflow/evidence/P2-T4/run/` — `run-log.txt`, `summary.json`, `logs/p2t4-observations-boot1.json`, `logs/p2t4-observations-boot2.json`, `logs/p2t4-state.json`
- Canonical run: `node tests/characterization/run.mjs --port 3383 --backup-port 3393 --dsh-home references/.dsh-test-p2t4 --report-dir dev/agent-workflow/evidence/P2-T4/run` → **exit 0, all sections green** (attempt 2 of ≤3)

## Verdict summary

**20/20 cells PASS. No `CORE_SEAM_BLOCKER` raised.** All five seams exercise
Agent-scope control through public mechanisms only (cordis profile patch row +
upstream public exports); no private registry, no upstream patch.

| Seam | creation | cold resume | tighten | capability disappear |
| --- | --- | --- | --- | --- |
| pre-step | **PASS** | **PASS** | **PASS** | **PASS** |
| pre-execute | **PASS** | **PASS** | **PASS** | **PASS** |
| tool visibility | **PASS** | **PASS** | **PASS** | **PASS** |
| skills | **PASS** | **PASS** | **PASS** | **PASS** |
| MCP | **PASS** | **PASS** | **PASS** | **PASS** |

Evidence keys below cite the canonical observation JSONs (`boot1`/`boot2` =
`p2t4-observations-boot{1,2}.json` under `run/logs/`).

## Row 1 — pre-step (`agent/pre-step` waterfall, Agent-scope admission before a step)

**Public mechanism.** `agentCtx.on('agent/pre-step', (payload, next) => …)` registered in
`setup()` on the *unpublished* agent scope ctx. Returning without `next()` and with
`{kind:'reject'}` short-circuits: the turn ends `turn/end{reason: blocked}` and no
`step/start` is appended. Delegating via `next()` reaches the default **enter** decision.
The listener, policy state, and disposer all live on the agent scope (re-registered on
cold resume; unwound on dispose).

- **creation — PASS.** Positive: enter mode → durable log `4:turn/start → 6:step/start`
  (boot1 `results.creation.preStep.newEvents`, `stepStartCountAfter: 1`); scoped listener
  observed the pre-step payload (turn/step/messageCount) before the step. Negative
  control: the same turn vocabulary with no reject decision in force; the reject path is
  the differential tighten cell below.
- **cold resume — PASS.** Positive: boot2 followup after `agents.resume()` on the
  persisted session → **fresh** `step/start` appended to the *same durable log*
  (boot2 `resume.preStepAfterResume.newStepStart: true`, `firstStepStartSeq: 6 ===
  expectedFirstStepStartSeq: 6`, pre-restart `turn/start` + `step/start` retained),
  `statusAfter: idle`, `timedOut: false`. Negative control: the pre-restart step at seq 6
  is the *old* one — the new step proves the re-registered scoped gate is live after
  restart, not replayed history.
- **tighten — PASS.** Positive: policy flip to reject → `turn/start` followed directly by
  `turn/end{blocked}` with **no** `step/start` (boot1 `tighten.preStep.lastTurnEndReason:
  "blocked"`, `rejectCausedNoNewStepStart: true`, event tail
  `[… "turn/start", "agent/inbox/spliced", "turn/end"]`). Negative control: the identical
  agent + listener in enter mode (creation cell) produced a step — the mode flip is the
  only variable.
- **capability disappear — PASS.** Positive: after `handle.dispose()`, `agents.get(sessionId)`
  → `undefined` and a followup through the disposed context appends nothing new
  (boot1 `disappear.registryGetAfterDispose: "undefined"`, `eventCountBeforeDispose: 20`
  with the log frozen). Negative control: pre-dispose turns produced steps; the vanished
  control is the same session id that was live moments before.

## Row 2 — pre-execute (`tools/pre-execute` waterfall, Agent-scope admission before tool execution)

**Public mechanism.** `agentCtx.on('tools/pre-execute', (exec, next) => PreToolDecision)`
on the agent scope ctx: `next()` (allow) / `{kind:'deny', reason}` / `{kind:'ask'}`.
`ask` without an in-turn approval answerer **fails closed** (denied). A mutable policy
object (`world.policy.deny/ask` sets) flips admission post-publication without any new
registration — the same listener re-evaluates.

- **creation — PASS.** Positive: allow → direct execution through the scoped pipeline
  succeeds with the scoped origin (boot1 `creation.preExecute.allow`: `failed: false`,
  `detail: "scope-A: allow-probe"`). Negative control: ask path denied —
  `creation.preExecute.ask.failed: true`, verbatim `approval.request() outside an open
  turn: … Ask from inside the turn that needs the decision.` (fail-closed, no approval
  answerer in this session).
- **cold resume — PASS.** Positive: boot2 allow → `detail: "scope-R: allow-probe"`
  (resumed scoped world, listener re-registered under the resumed scope). Negative
  control: boot2 deny flip (tighten row, below) denies the *same* call post-resume —
  admission state, not tool presence, is what changed.
- **tighten — PASS.** Positive: adding `p2t4_echo` to the deny set after publication →
  the call that succeeded at creation is now denied, reason naming the scoped listener
  (boot1 `tighten.preExecute.denyAfterFlip`: `failed: true`, `detail:
  "p2t4-policy(A): p2t4_echo denied by the agent-scoped pre-execute listener"`). Negative
  control: the pre-flip allow (creation cell) and the post-resume flip (boot2
  `tightenAfterResume.denyAfterResumeFlip`, `p2t4-policy(R): …`) bracket the flip on both
  sides of the restart.
- **capability disappear — PASS.** Positive: post-dispose execution of the scoped tool
  through the disposed context is rejected (boot1 `disappear.staleExecute`: `failed: true`,
  `detail: "session \"p2t4-session-…\" is not live in this store"`). Negative control:
  the same call shape succeeded while the agent was live (creation allow).

## Row 3 — tool visibility (Agent-scope tool registry view)

**Public mechanism.** `agentCtx.tools.register(toolDef)` in `setup()` — property access
resolves from the agent scope ctx and the traceable service binding makes `register()`
land in the **caller's scope layer**. Read side: `agentCtx.tools.schemas(agent)` (agent
view) vs `tools.schemas()` (global view). Tighten: `agentCtx.tools.restrict({deny})` —
requires a scoped context, hides the denied tools from the agent view only.

- **creation — PASS.** Positive: agent view
  `["p2t4_global","p2t4_echo","p2t4_gate","mcp__p2t4mini__ping"]` — scoped tools plus the
  inherited global baseline (boot1 `creation.tool.agentView`, `scopedToolInAgentView:
  true`, `globalInheritedInAgentView: true`); the global view does **not** contain
  `p2t4_echo` (`scopedToolHiddenFromGlobal: true`). Negative control: cross-agent
  isolation — agent B's view `["p2t4_global","mcp__p2t4mini__ping"]` excludes A's scoped
  `p2t4_echo` (`isolation.bViewExcludesScopedToolOfA: true`) while still inheriting the
  global tool — scope isolation, not registration absence.
- **cold resume — PASS.** Positive: the resumed scope recomposes its world; the scoped
  tools are live after restart (boot2 `creation.tool` re-asserted green; boot2 allow
  execution returns the scoped origin `scope-R: allow-probe`). Negative control: the
  global view remains unaffected by the recomposition; the pre-restart scoped tool never
  leaked into it (boot1 `scopedToolHiddenFromGlobal`).
- **tighten — PASS.** Positive: `restrict({deny: p2t4_global})` on the agent scope → the
  *inherited* global tool disappears from the agent view while own-layer scoped tools
  remain (boot1 `tighten.tool`: `restrictHidesInherited: true`, `ownLayerExempt: true`,
  `agentViewAfter: ["p2t4_echo","p2t4_gate","mcp__p2t4mini__ping"]`), and executing the
  restricted tool now fails (`executeInheritedNowFails`: `ToolNotFoundError /
  UNKNOWN_TOOL`). Negative control: the restriction does **not** leak — the global view
  still lists `p2t4_global` (`globalViewUnaffected: true`).
- **capability disappear — PASS.** Positive: post-dispose the agent is gone from the
  registry and every scoped view with it (`registryGetAfterDispose: "undefined"`,
  `staleExecute` rejected — see row 2). Negative control: pre-dispose the agent view was
  complete (creation cell); only the dispose is the variable.

## Row 4 — skills (Agent-scope skill registration + scoped snapshots)

**Public mechanism (independently established, not inferred from the tool seam).**
Scoped write: **`agentCtx.get('skills').register(skillDef)`** — the strict global-store
read `ctx.get` returns the skill service *bound to the calling ctx*, and
`register()` resolves its target layer from the caller's scope, so the skill lands in
the agent scope's layer alone. Scoped read: `skills.snapshot({scope: agent})` (global
layer + scope chain; nearest layer wins). Disposal: the returned disposer removes the
skill from the scope; fiber dispose unwinds the whole scope layer.
**Documented negative control (topology-sensitive property access):** `agentCtx.skills`
(property form) **throws** from the agent scope ctx — `cannot get property "skills"
without inject` — because the skills implementation sits off the scope fiber's ancestor
chain in the web-profile topology (the property proxy is topology-sensitive; the
postmortem guidance "reserve `ctx.<name>` for declared injections; strict `ctx.get`
reads the global service store" applies). The capability is therefore exercised through
`ctx.get`, and the throw is recorded as evidence, not as a missing seam.

- **creation — PASS.** Positive: skill `p2t4-probe-skill` registered via
  `agentCtx.get('skills').register` in `setup()` is present in the agent-scoped snapshot
  and **absent from the global snapshot** (boot1 `creation.skills`:
  `agentGetAvailable: true`, `registeredVia: "agentGet"`, `scopedSkillInAgentScope:
  true`, `scopedSkillHiddenFromGlobal: true`, `globalSkillCount: 0`). Negative control:
  `creation.skills.propAccess: {threw: true, message: 'Error: cannot get property
  "skills" without inject'}` — the property path is unavailable from this ctx, so the
  scoped landing is attributed to the documented `ctx.get` mechanism, and the global
  snapshot proves no global leakage.
- **cold resume — PASS.** Positive: boot2 re-registers the scoped skill (label `R`)
  through the same `agentCtx.get('skills')` path on the resumed scope; the resumed
  scope's snapshot lists it and the global snapshot does not (boot2 `creation.skills`,
  all cells green in the canonical log). Negative control: boot2
  `creation.skills.propAccess.threw: true` — the property gap persists across restart
  (topology, not boot state).
- **tighten — PASS.** Positive: the registration disposer removes the scoped skill from
  the agent scope (boot1 `tighten.skills.disposerRemovesScoped: true`). Post-publication
  registration through the same scope binding works and is recorded verbatim
  (`tighten.postPubRegistration: {tool: {threw: false, visibleWhileAlive: true},
  skill: {threw: false}}`). Negative control: while alive, the scoped skill was present
  in the scope snapshot (creation cell) — the disposer, not a scope reset, removed it.
- **capability disappear — PASS.** Positive: after `handle.dispose()`, the scope layer is
  unwound — `skills.snapshot({scope: disposedAgent})` no longer resolves the scoped skill
  (boot1 `disappear.staleSkillScope: {threw: false, scopedSkillGone: true}`). Negative
  control: pre-dispose the same snapshot listed it (tighten cell).

## Row 5 — MCP (Agent-scope mcp-client instance, streamable-http)

**Public mechanism.** `agentCtx.plugin(mcpClient, {transport:'streamable-http',
serverName, url, failOnStartupError:true})` in `setup()` — the mcp-client plugin mounts
under the agent scope fiber; its namespace is reserved per `scopeOf(ctx) ?? ctx.root`,
and its tools register into the scope layer as `mcp__<serverName>__<tool>`. The
harness-owned mini server (JSON-RPC over streamable-http, aux port 3491, closed in
`finally`) provides a real endpoint; a dead endpoint (port 3999) exercises the
startup-failure rollback.

- **creation — PASS.** Positive: `mcp__p2t4mini__ping` is visible in the agent view and
  hidden from the global view; a real call round-trips (boot1 `creation.mcp`:
  `mcpToolInAgentView: true`, `mcpToolHiddenFromGlobal: true`, `call: {failed: false,
  detail: "pong:hello-mcp"}`). Negative controls: (a) same-scope duplicate rejected —
  `duplicateSameScope: {rejected: true, message: 'mcp-client: serverName "p2t4mini" is
  already in use by another mcp-client instance — pick a unique serverName in
  cordis.yml'}`; (b) cross-agent reuse *allowed* — agent B mounts the same `serverName`
  successfully in its own scope (`isolation.bMcpSameNameAllowed: true`) — proving the
  reservation is per-scope, not global; (c) `failOnStartupError` against a dead endpoint
  rejects creation with full rollback (`failOnStartupRollback: {rejected: true,
  agentPublished: false, sessionExists: false}`, `mcp-client(p2t4dead): initial
  connection or tool synchronization failed`).
- **cold resume — PASS.** Positive: boot2 re-mounts the same agent-scoped instance after
  the process restart and the tool round-trips again (boot2 `creation.mcp.call.detail:
  "pong:hello-mcp"`). Negative control: the namespace rules are unchanged post-resume —
  the remount succeeds only after the boot-1 fiber was disposed in the tighten cell, and
  the same-scope duplicate rejection (boot1) is the standing negative.
- **tighten — PASS.** Positive: `mcpFiber.dispose()` unregisters the MCP tools from the
  agent view (`tighten.mcp.disposeRemovesTool: true`), and remounting the **same
  serverName** restores the tool — the namespace was released with the fiber
  (`remountRestoresTool: true`). Negative control: while the original fiber was alive,
  the same serverName was rejected in-scope (creation cell) — the release is
  attributable to the dispose, not to time.
- **capability disappear — PASS.** Positive: post-dispose the agent (and its whole scope
  layer, MCP tools included) is gone: `registryGetAfterDispose: "undefined"` and stale
  executions through the disposed context are rejected (boot1 `disappear`, shared by
  rows 2–4). Negative control: pre-dispose the agent view included
  `mcp__p2t4mini__ping` (creation cell); the mini server itself stayed up (harness-owned)
  while the agent-scoped instance vanished — the disappearance is scope attribution, not
  endpoint state.

## Environment note (disclosed, non-blocking)

The launching environment has no `DEEPSEEK_API_KEY` (checked: not in the harness
process env, no root `.env` in the test-use tree), so the model *body* of each turn
fails fast with `LlmError … MISSING_CREDENTIAL` (boot1
`creation.preStep.agentErrors`, `turnEndReasons: ["error"]`). This does not affect any
cell: every seam gate is evaluated **before or around** the step/execution — pre-step
evidence is the durable `turn/start → step/start` / `turn/start → turn/end{blocked}`
vocabulary, pre-execute evidence is direct `tools.execute` through the scoped pipeline
(model-independent), and tool/skills/MCP cells are registry-level facts. A re-run with a
key exports to a normal turn completion without touching the probe (the harness label
already names this condition: "model call failed contained — no key in this DSH_HOME").

## Stdio transport note (disclosed, non-blocking)

The mcp-client stdio transport is structurally unusable inside this sandbox (Node-
originated piped stdio is denied: EPERM on named pipes under the confined sandbox), so
the MCP row is characterized over **streamable-http** only — the transport that is
available. The namespace/rollback/dispose behaviors under test are transport-
independent in mcp-client.
