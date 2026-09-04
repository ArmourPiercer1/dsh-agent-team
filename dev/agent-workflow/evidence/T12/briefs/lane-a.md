# T12 Lane A brief — Live Agent boundary closure (template, SP1/SP2 slots filled at dispatch)

Status: PENDING-PROBES (SP1 persona, SP2 descendant drain)
Worktree: D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\T12-A (branch task/T12-lane-a-live-boundary, base 7d07330)
Deps: installed.

## Defects (plan refs)
1. T12-B2 (plan §6-A1) — root-aware deterministic child Session identity
   - current: `childSessionIdFor(instanceId)` at agent-bindings.mjs L160 builds from instanceId only ('session-child-p6t6-' + instanceId.slice(5)).
   - fix: `childSessionIdFor(rootSessionId, instanceId)`; canonical tuple -> SHA-256 -> fixed-length stable suffix (e.g. session-team-child-<hex>). same pair stable; cross-root same instance distinct; restart stable; NO random UUID (cold reconciliation).
   - tests: same-pair stable; cross-root distinct; resume derives same child id.
2. T12-B3 (plan §6-A2) — external hard policy into real consumption resolver
   - current: `resolveConsumptionViews()` L229 builds fake empty external `{hard:{}, capabilityExists:{}}`; config.externalPolicyFacts (hard + capabilityExists) already exists on TeamPluginConfig.
   - fix: delete fake; consume config.externalPolicyFacts; schema normalization only, no second policy semantics.
   - acceptance: external hard DENY + team/member override ALLOW = actual Agent boundary DENY (not just projection).
3. T12-H1 (plan §6-A3) — nullable MCP contract
   - current: config allows mcpServer=null but live code dereferences config.mcpServer.name/.port (L245, L281-287).
   - fix: mcpServer===null => no Team MCP server configured; no dereference; no reconcile/create attempt; consumption view remains valid.
   - test: boot + member setup with mcpServer:null must not throw.
4. T12-M1 (plan §6-A4) — actual Agent cwd = effective workspace
   - current: child factory L418/L438 and root/materialize L485/L504 use `meta: { cwd: process.env.DSH_HOME }`.
   - fix: child `agents.create({ meta: { cwd: request.workspace } })` (activation adapter already passes request.workspace to the live child factory); root uses Team creation/TeamSession default/effective workspace; fallback only if contract explicitly specifies it; never DSH_HOME as normal workspace.
   - acceptance observed at ACTUAL agents.create boundary: Root cwd == Team effective root workspace; Child cwd == Member effective workspace (not via Projection).
5. T12-M2 (plan §6-A5) — persona into real DSH Agent
   - forbidden: rewrite persona resolver; duplicate persona logic into live file; only updating root.promptInstallations Map; model-answers persona check as sole test; private imports.
   - reuse: createPersonaRootAdapter (packages/runtime/agent-setup/persona/adapter.ts) — keep resolver; only wire ScopedPersonaPromptSurface -> actual public DSH Agent setup/prompt surface.
   - execution order: if public API requires persona at create/setup time: resolve effective persona -> create/setup real Agent with persona -> first work request (NOT patch after first request).
   - minimal seam allowed: tiny personaSurface/promptSurface on TeamAgentBindings implemented by live binding; root persona adapter keeps depending on the abstract surface.
   - acceptance at real Agent request boundary: effective persona installed before work; restore restores prior scoped state; complete:true still FATAL.
   - if public DSH surface cannot support it via legal create/setup params -> CORE_SEAM_BLOCKER (no 3h workaround).
   [SP1 SLOTS: exact setup(agentCtx) shape, systemPrompt.section API, wiring pseudo-code]
6. T12-M3 (plan §6-A6) — descendant drain no fake success
   - current: drainDescendants L616-626: `await handle.agent.whenIdle(); return { drained: 0, quiescent: true }` — no recursive discovery.
   - optimal (if public seam allows): enumerate descendants -> quiesce/cancel bottom-up -> await idle -> verify -> return actual drained count.
   - minimal safe (if no recursive enumerate seam): typed fail-closed `recursive-drain-unavailable`; archive/dispose paths that require recursive quiescence REFUSE completion. Never return fake quiescent:true.
   [SP2 SLOTS: EXISTS/MISSING verdicts for enumeration / per-descendant cancel / recursive drain await]

## Owned files
- packages/runtime/src/plugin/live/agent-bindings.mjs
- packages/runtime/src/plugin/types.ts (ADDITIVE ONLY)
- packages/runtime/test/* (new/updated targeted tests)
- packages/testkit/test/p4t6-session-event-scan.test.ts (pin update only: 543 + added files)
NOT: root.ts (Lane B), s6-principal.ts/s6-remote.ts/host.ts (Lane C), root-binding/*, activation/*, persona/adapter.ts (READ-ONLY reuse), domain/storage/contracts/remote/tools.

## Inter-lane
- Lane B (root.ts) will call the live binding interface for fresh create + handoff target create via a shared primitive. Keep the existing TeamAgentBindings surface stable; additive fields only; consume new fields defensively (undefined until Lane B lands).
- rootSessionId is available to the live binding via deps/root surface (verify how child factory request reaches it; the activation adapter passes rootSessionId into childSessionFactory.create).

## Chain / rules
- node scripts/run-tests.mjs runtime; tsc -p packages/runtime/tsconfig.json (separate). No pnpm run/exec, no vitest CLI. NodeNext/.js ext, erasable TS, no node: imports in .ts, .mjs stays JS.
- Known flake p6t1-parallel ~1/3.
- Stop rule 45min/defect -> BLOCKER, next defect.
- One commit per defect (T12-B2:, T12-B3:, T12-H1:, T12-M1:, T12-M2:, T12-M3:).
- Evidence: t12a-final-chain.log, t12a-tsc.log (UTF-8) in dev/agent-workflow/evidence/T12/.

## Report format
"LANE A RESULT:" per defect FIXED(commit, tests, assertions)/BLOCKED(file, tried, why); types.ts additive list; git diff --name-only; chain+tsc counts; flake notes; concerns.
