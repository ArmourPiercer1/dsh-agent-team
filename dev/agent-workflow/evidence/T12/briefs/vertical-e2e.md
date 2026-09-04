# T12 Vertical E2E brief — canonical shipped-plugin vertical slice (PREP, dispatched after integration)

Status: PREP (post-integration checkpoint; base = T12 integration tip, TBD)
Runner location (repo convention): packages/tools/harness/ — extend the run.mjs pattern (DshInstance, profile patch rows, per-boot directives, HTTP driver, summary.json). NEW file recommended: packages/tools/harness/t12-vertical.mjs (or scenario group) so the legacy 17-scenario runner stays reproducible for regression.

## Hard anti-cheat (plan §10.1)
- Mount shipped host/plugin entrypoint (production dist host row via profile patch, as run.mjs does).
- Use production glueUrl; live agent-bindings.mjs is the final agent implementation (NO TestAgentBindings as final impl).
- Reach REAL DSH Agent/Session runtime (real agents.create/resume; real session logs under DSH_HOME).
- May use deterministic/local test model/provider — but ONLY through the real DSH Agent lifecycle (real dsh-llm adapter + SSE + agent loop + session log).
- Forbidden: TeamDomain direct-fabrication, root internals bypass, seeded frozen worker/scout world, PROTOTYPE code (P9P/P9P-UI).

## Model endpoint design (deterministic, local)
- DSH llm-deepseek resolves base URL via $DEEPSEEK_BASE_URL (default https://api.deepseek.com) and key via $DEEPSEEK_API_KEY (packages/llm/llm-deepseek/src/index.ts L87,L198-199,L376-379, in the PINNED test-use checkout).
- Runner starts a local mock DeepSeek-compatible HTTP server (plain node http) on a free port in the 3496-3500 band (mini-MCP band is 3492-3495; boots 3181-3186): implements POST /chat/completions (stream: true) returning deterministic SSE: a short reasoning/content event stream ending with [DONE]; content = a fixed deterministic completion (e.g. echo of a marker + "T12_MOCK_DONE"). Non-stream fallback: JSON completion.
- Boot the DSH instance with env DEEPSEEK_BASE_URL=http://127.0.0.1:<mockport> DEEPSEEK_API_KEY=t12-mock-key (env goes to the spawned DSH host process).
- The team glue config's staticModel/model reference must resolve to the deepseek provider + a model name the mock accepts (any string; mock ignores model field). VERIFY how the fresh test DSH_HOME configures LLM providers (cordis rows / env) during build; if a provider row must be added to the test home, do it via the home's cordis config (environment-level, NOT a code patch).
- Fallback if env override proves unresolvable: use the qiyuan-self/qwen3.8-27b model reference (observed live 200+PONG in this environment) — real model, still through the real DSH lifecycle. Record which path was used.

## Slices (plan §10-12) — each with pass/fail + assertions recorded in summary
- V1 fresh Root: minimal legal Team create (RootSessionId, Blueprint, workspace W_root, runtime preset/model) → TeamSession durable; fresh RootBinding durable; Leader identity valid; REAL Root Agent created (observable: DSH session for root exists under DSH_HOME + live binding state); Root Agent cwd == W_root (observed at agents.create boundary or session meta — NOT via projection); no synthetic worker/scout rows.
- V2 real Member: create member (instanceId worker-..., workspace W_child, persona P_child) → child SessionId root-scoped semantically; real DSH child Session exists; cwd == W_child; persona installed (agent-scoped section visible in the real prompt assembly / session evidence); effective model/policy installed; config variant with mcpServer:null does not crash.
- V3 real policy: external hard DENY capability/tool X + Team/member override ALLOW X → at the ACTUAL consumption boundary X remains denied (not just projection shows DENY).
- V4 delegate real work: Leader/Team delegates exact task "T12_VERTICAL_TASK_<nonce>" → exact input reaches real child Agent/session (session log contains the exact task text); Agent accepts/executes through normal DSH path (real turn against mock model, completion observed); Team work/lifecycle/activity durable truth settles.
- V5 Projection/Remote: read TeamProjection through the BROWSER-FACING public Remote (the mounted endpoint, plan §10.6; after Lane C M4 mount): root/member/childSessionId/lifecycle/activity/effective config+provenance consistent with durable truth. Test-side may NOT use TeamDomain direct reads as the assertion source (server-side instrumentation OK for diagnostics only). If M4 ended CORE_SEAM_BLOCKER: V5 must be marked accordingly and the verdict impact recorded (plan B4/M4 clauses).
- Handoff (plan §11.1): source Team A + requestToken X + context C → target Team B identity distinct; target Root Agent exists; C reaches real target Agent (session evidence); handoff completed. Then source Team C + SAME requestToken X → different target identity (B5 composite).
- Lifecycle (plan §11.2): at least one real archive -> restore -> follow-up OR dispose; descendant drain truly recursive OR typed fail-closed; NO fake quiescent=true.
- Restart/repeat (plan §12): fresh run #1, fresh run #2 (different RootSessionId, SAME member instanceId → child SessionId no collision); restart/resume run #1 (same Team root, same MemberInstance, same child Session, no duplicate Agent/Team/member, projection resumes correctly).

## Execution order
1. Build production runtime (sanctioned dist recipe) in the integration worktree.
2. Run: fresh#1 (V1-V5 + delegate + policy) → fresh#2 (V1-V2 identity-collision focus) → restart#1 (resume + V5 + follow-up).
3. Then handoff pair + lifecycle (can share fresh#1 home or a 3rd home; keep homes fresh per world, fail-closed non-empty).
4. summary.json: scenarios V1..V5, HANDOFF, LIFECYCLE, RESTART, each {criterion, pass, durationMs, assertions, evidence}; plus model-endpoint log capture; test-use pristine pre/post; :3080 pre/post.

## Environment rules
- Ports: boots 3181-3186 band (base port arg); mock model 3496-3500; mini-MCP 3492-3495 only if mcp scenario used.
- Fresh DSH_HOME per world under references/.dsh-test-t12* (gitignored), fail-closed if non-empty.
- Never redirect harness stdout to run.log inside --report-dir (EBUSY precedent) — console capture to separate filename.
- p6t1-parallel flake irrelevant here (no package chain inside harness run).
- Evidence logs UTF-8 (Out-File -Encoding utf8); Get-Content -Encoding UTF8 for Chinese logs.
- Stable instance :3080 + D:\deepseek-harness\ sacrosanct (probe pre/post only).

## Legacy runner adaptation notes (read before writing t12-vertical.mjs)
The existing run.mjs (P8-S3, 17 scenarios) encodes the PRE-T12 seeded world. Do NOT reuse its constants for the vertical slice:
- `ROOT_SESSION_ID = 'session-p6t6root'` (run.mjs:122) — after B1 the root team is created through the SHIPPED `create` tool in the production path; take the root session id from the create response / `/__p6t6/state` (or the directive you wrote), never hardcode a legacy id.
- `SEED_WORKER_ID`/`SEED_SCOUT_ID`/`SEED_WORKER_CHILD` (run.mjs:126-129) — the seeded resident worker/scout world is forbidden for the slice; members are created by real delegate calls.
- `SEED_WORKER_CHILD` mirrors the OLD child derivation `'session-child-p6t6-' + instanceId.slice(5)` (run.mjs:128 comment) — Lane A rewrites `childSessionIdFor` (B2, root-aware). Assert child session ids against what the durable session log actually contains (discover via DSH_HOME session dirs + `listDescendants`), never against the old formula.
- `M_MODEL_A/M_MODEL_B` = `p6t6-static` (run.mjs:173-175) — the static no-provider model reference is the legacy "no real LLM" device; the slice uses the REAL `llm-deepseek` provider row with `DEEPSEEK_BASE_URL` pointed at the local mock server (3496-3500 band) and a dummy `DEEPSEEK_API_KEY`, so the full real adapter + SSE + agent loop runs.
- The profile-patch mounting mechanism (production dist host row + observability row + per-boot directive + HTTP driver + summary.json) is REUSED as the pattern; only the world it drives changes (fresh create, real model, real persona).
- If a P8-S3 scenario needs its world semantics changed for B1/B2, that is OUT OF SCOPE here — the legacy runner stays byte-identical (regression reproducible); the vertical slice lives in the new file.

## Verified mock-DeepSeek wire contract (from pinned test-use source @ cd5ef814, read 2026-09-02)
- Endpoint: `POST {baseURL}/chat/completions` where baseURL = `$DEEPSEEK_BASE_URL` (packages/llm/llm-deepseek/src/index.ts:198-201); request sent with `authorization: Bearer $DEEPSEEK_API_KEY`, `content-type: application/json`, `accept: text/event-stream` (adapter.ts:634-645).
- Request body fields the mock will receive: `{model, messages, stream: true, stream_options: {include_usage: true}, tools?, temperature?, max_tokens?, stop?, thinking?, reasoning_effort?}` (types.ts:13-30). The mock should echo/record `model`, `messages` (assert persona/cwd context landed), and `tools` per request for V-criterion evidence; response `model` field is not consumed by translate (types.ts:118-123).
- SSE framing is SPEC-STRICT (sse.ts:1-13): each event must be `data: <json>\n\n` (blank-line terminator required; unterminated tail at EOF = STREAM_CLOSED LlmError). Comments (`: ...`) are tolerated and only reported via onComment. The stream MUST end with `data: [DONE]\n\n`; EOF before it throws STREAM_CLOSED (sse.ts:39).
- Chunk shape (types.ts:118-146): `{"choices":[{"delta":{...},"finish_reason":null|"stop"|"tool_calls"|"length"}], "usage":{...}}`. `finish_reason` non-null ONLY on the terminal choice; no chunk may follow a finished chunk (translate.ts header + L193 fallback). `usage` may ride on the finish chunk and/or arrive as a trailing usage-only chunk (choices absent) — latest usage wins (translate.ts:186-188). First chunk conventionally carries `delta.role:"assistant"`.
- Text completion: 1..n `delta.content` chunks → terminal `finish_reason:"stop"` chunk → optional trailing usage-only chunk → `[DONE]`.
- Tool-call completion: `delta.tool_calls:[{index, id?, type:"function", function:{name?, arguments?}}]` fragments sharing `index` concatenate (id/name present on first fragment of the call, types.ts:144-156) → terminal `finish_reason:"tool_calls"` → `[DONE]`.
- No `reasoning_content` needed (thinking-mode only; types.ts:136-140). A non-thinking response is valid.
- Non-2xx: body `{"error":{"message","type","code"}}` (types.ts:178-180); adapter maps to LlmError (adapter.ts:663-671).
- Determinism: the mock may pick the reply from a script table keyed on (request #, last tool name / message marker). Keep every reply short and stable for snapshot-able session logs.
