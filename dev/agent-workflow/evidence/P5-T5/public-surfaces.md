# P5-T5 public surfaces registry (I-1 real binding)

Every external surface the P5-T5 real-instance harness touches, with its
name and file:line origin. "Worktree" = `D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P5-T5`
(task branch `task/P5-T5-root-binding`). "Test-use" =
`D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use`
(pristine upstream, HEAD `cd5ef814`). All surfaces are public: no upstream
private API, no patch, no core modification (CORE PATCH BUDGET = 0).

## 1. Composition / instance plumbing (host-side, harness-owned)

| # | Surface | Origin |
| --- | --- | --- |
| 1.1 | Profile-patch row mount — `<DSH_HOME>/profiles/web/cordis.patch.yml`, the public composition seam the row uses and the ONLY way the plugin reaches the instance | `tests/characterization/lib/instance.mjs` L175-188 (`DshInstance.mountRows`, worktree); invoked from `packages/runtime/root-binding/harness/run.mjs` L422 |
| 1.2 | `dump-config` — host CLI composition dump proving the row mounted through 1.1 | `tests/characterization/lib/instance.mjs` L147-173 (`DshInstance.dumpConfig`) + L198-200 (`rowInDump`); run.mjs L430 |
| 1.3 | Instance boot — `node apps/cli/lib/bin.js web --port <N> --no-open` (public CLI entry; boot marker `dsh web: http://127.0.0.1:<N>/?token=…`) | `apps/cli/lib/bin.js` (test-use); `tests/characterization/lib/instance.mjs` L60-107 (`DshInstance.start`); run.mjs L424 |
| 1.4 | Profile self-initialization (throwaway boot when the DSH_HOME profile is absent) | `tests/characterization/lib/instance.mjs` L208-228 (`ensureProfile`); run.mjs L420 |
| 1.5 | Instance stop — `taskkill /F /T /PID` on win32, port-release verified | `tests/characterization/lib/instance.mjs` L109-145 (`DshInstance.stop`); run.mjs L467 |
| 1.6 | Pristine self-check — `git status --porcelain` / `git diff` / `git rev-parse HEAD` on the test-use tree (before, post-build, after) | `tests/characterization/lib/tree-clean.mjs` L23-70 (`captureGitState`); run.mjs L203/L269/L500 |
| 1.7 | Stable-instance probe — `GET http://127.0.0.1:3080/` (GET only, 3 s timeout; recorded before/after, never touched) | run.mjs L134-141 (`probeStableInstance`); L208/L501 |
| 1.8 | Junction farm for bare specifiers (harness-local `node_modules` links into the test-use tree; scanner-skipped) | `tests/characterization/lib/instance.mjs` L230-255 (`ensureProbeResolution`); run.mjs L285-291 |
| 1.9 | Build chain (only when a farm package `lib/` is missing) — `pnpm install --ignore-scripts` + `node scripts/build.ts` with `DSH_CLIENT_COMMIT_HASH=cd5ef814`, `ESBUILD_WORKER_THREADS=1`; `build:web` in-sandbox failure tolerated per TEST_METHODS §3 when `build:lib` artifacts complete | run.mjs L229-266; `scripts/build.ts` (test-use, public repo script) |

## 2. Cordis host services consumed by the row (all public)

| # | Service | Usage | Origin |
| --- | --- | --- | --- |
| 2.1 | `webServer` (inject) | row setup: `ctx.get('webServer')` | `packages/runtime/root-binding/harness/plugin.mjs` L113 (inject), L342 |
| 2.2 | `storageDomain` (inject) | real TeamDomain storage seam | plugin.mjs L113, L343; `packages/runtime/root-binding/harness/seam.mjs` L33 (import `defineDomain`/`domainTable` from `@deepseek-ai/dsh-storage-domain`), L46-72 (`storageDomain.open` L60-61, `closeAll` L71) |
| 2.3 | `agents` | `agents.create` (plain root), `agents.resume` (S2, setup = model selection first, preset mount second — app-faithful), `handle.dispose` | plugin.mjs L469 (lazy `ctx.get`), L972 (S4 create), L613 (S1/S3 create), L823-829 (S2 resume+setup); substrate probe `slots.mjs` L121-124 |
| 2.4 | `systemPrompt` | `systemPrompt.assemble({ scope })` — persona section read-back, model variables read-back | plugin.mjs L470; `slots.mjs` L126; `@deepseek-ai/dsh-system-prompt` `PERSONA_SECTION` (slots.mjs L43, L127; plugin.mjs L94) |
| 2.5 | `agentPresets` | `resolve` (S2 setup L827), `mount` (S2 setup L828; cold-residency restore plugin.mjs L517-518; persona install `slots.mjs` L201-210 → pendingEffects), `composedPreset` (S2 assertion plugin.mjs L924) | plugin.mjs L471 |
| 2.6 | `sessions` | live existence check `sessions.get(SessionId)` (guard facts) | plugin.mjs L472, L978 |
| 2.7 | `sessionProjections` | `stateOf(session, 'modelSelection')` — cold-residency model re-seed (app-faithful, resume.js probe pattern) | plugin.mjs L473, L839 |
| 2.8 | `scopeOf(agentCtx)` | agent-scope token for `assemble({ scope })` | `@deepseek-ai/dsh-scope`; plugin.mjs L93; slots.mjs L42, L126 |
| 2.9 | `installModelSelection(agentCtx, ref)` | real model-selection waterfall (scoped `system-prompt/assemble` + `agent/request` hooks; no durable auto-restore — the row re-seeds the ref at resume) | `@deepseek-ai/dsh-agent`; plugin.mjs L95, L826 (S2 setup); slots.mjs L40, L222 (S1/S3/S4) |

## 3. Agent-scope seams (per live agent context, all public)

| # | Seam | Usage | Origin |
| --- | --- | --- | --- |
| 3.1 | `agent.ctx.tools.register(toolDef)` / `.schemas(agent)` | capability facet: register `p5t5-tool-alpha/-beta`; read back visible tool names | slots.mjs L247; plugin.mjs L265 (`waitForSchemaTool` names check) |
| 3.2 | `agent.ctx.get('skills').register({…})` | capability facet: register `p5t5-skill-one` | slots.mjs L257-263 |
| 3.3 | `agent.ctx.plugin(mcpClient, cfg)` | capability facet: MCP fiber to the harness mini server (`mcp__p5t5mini__ping`) | slots.mjs L271; `@deepseek-ai/dsh-mcp-client` (slots.mjs L39) |
| 3.4 | `agent.ctx.on('tools/pre-execute', …)` / `agent.ctx.on('agent/pre-step', …)` | capability facet: pre-step/pre-execute listener observation | slots.mjs L286-298 |
| 3.5 | `agent.session.append('model/selection', …)` / `session.events` | durable model-selection record (S1 select) and event read-back | slots.mjs L234; plugin.mjs `eventsFor` L594 |

## 4. Durable artifacts (DSH_HOME = `references/.dsh-test-p5t5`, fresh per run)

| # | Artifact | Role | Origin |
| --- | --- | --- | --- |
| 4.1 | `<DSH_HOME>/storages/team_domain/` | TeamDomain json rows (TeamSession + sessionBinding) via the public `storageDomain` json backend — the durable control-plane authority; boot 1 creates, boot 2 reopens | backend config: test-use `packages/bundle/base/cordis.patch.yml` L145-156 (storageDomain, json backend, root `dshHomePath('storages')`); repositories: `packages/storage/repositories/team-domain.ts` L155 (`createTeamDomain`) / L191 (`openTeamDomain`, worktree) |
| 4.2 | `<DSH_HOME>/sessions/<project>/<sessionId>/session.jsonl.zstd` | durable session log (model/selection survival across the process restart; publish polling) | plugin.mjs L202-222 (`diskFilesFor`), L237-260 (`waitForDurable`); layout pinned by P2-T3 |
| 4.3 | `<DSH_HOME>/.agent-presets/p5t5-team-persona/agent.cordis.yml` | user persona preset (public user-preset mechanism; body `- id: persona / name: '@deepseek-ai/dsh-persona' / config.text`) | run.mjs L292-302 (write); consumed via `agentPresets` (2.5) |
| 4.4 | `<DSH_HOME>/p5t5-directive.json` | harness directive (blueprint payload + capability sets + admission policy + session ids + mcp port), re-read by the row on every boot — documented stand-in transport for the durable blueprint snapshot store | run.mjs L346 (`writeDirective`); plugin.mjs L122-145 (`readDirective`) |

## 5. Network surfaces (loopback only)

| # | Surface | Usage | Origin |
| --- | --- | --- | --- |
| 5.1 | `GET/POST http://127.0.0.1:<port>/__p5t5/health` | row readiness probe + health record (row-registered exact route) | plugin.mjs L394-405; run.mjs readiness loop L434-449 |
| 5.2 | `POST http://127.0.0.1:<port>/__p5t5/run {scenario}` | scenario dispatch (awaits the row ready-gate, then executes + reports) | plugin.mjs L407-457; run.mjs `driveScenario` L352-380 |
| 5.3 | Mini MCP server `http://127.0.0.1:3481-3485/mcp` (JSON-RPC: initialize / tools.list / tools.call `ping`→`pong:<msg>`) | capability-facet MCP target; harness-owned test server, closed in post-flight | `packages/runtime/root-binding/harness/mini-mcp.mjs` (`startMiniMcpServer`/`closeMiniServer`); run.mjs L307, L498 |
| 5.4 | Web-server dispatch semantics — exact routes → longest prefix → fallback seat; unauthenticated named routes (no token gate on API paths) | basis for 5.1/5.2 reachability | test-use `packages/host/webserver/src/index.ts` L221-236 (dispatch), L318-327 (`match`); fallback 405 for non-GET/HEAD: `packages/host/frontend-static/src/index.ts` L124-142 |

## 6. Not used (negative attestations)

- No real LLM/model provider calls: `defaultModel` is the static pair
  `p5t5-static / p5t5-model-v1`; `installModelSelection` only shapes the
  system-prompt waterfall, and no request is ever sent to a provider.
- No upstream private/internal imports anywhere in
  `packages/runtime/**` or `packages/storage/**` (bare imports only in the
  harness `.mjs` files, resolved by the junction farm to public package
  entries).
- No `patch-package` / postinstall / `git apply` against the test-use tree;
  pristine `git status` proven before/after (1.6).
- Legacy Team SessionEvent vocabulary: absent — p4t6 scanner green at the
  terminal count (see run-log).
