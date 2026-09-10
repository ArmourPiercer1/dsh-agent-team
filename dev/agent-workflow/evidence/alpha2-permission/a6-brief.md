# A6 dispatch brief — production wiring (alpha.2, SINGLE integration writer)

You are implementing A6 (the production wiring) of the 0.1.1-alpha.2 plan — the LAST code task before V1.
Read first (mandatory, in this order):
1. docs/ROUTER_RULES.md
2. docs/TEST_METHODS.md
3. docs/plans/active/0.1.1-alpha.2-detailed-development-plan.md — sections 10 (A5), 11 (A6 — YOUR spec, authoritative), 12 (what V1 will verify — build against it).
4. A1–A5 task reports + export surfaces (all ON INT): dev/agent-workflow/evidence/alpha2-permission/{a1,a2,a3,a4,a5}/.

## Your task

Worktree: .worktrees/alpha2-a6 (branch task/alpha2-a6-production-wiring), based on int/alpha2-permission tip AFTER A5 is merged. You are the SINGLE integration writer. You compose the FROZEN A1–A5 APIs into the production lifecycle. You do NOT re-implement any of their logic.

Hotspots (the ONLY product files you may modify, per plan §11.1 + the verified assembly chain):
- packages/runtime/src/plugin/root.ts — the control service is created HERE (L936: createControlService({teamDomain, blueprintCatalog, externalPolicyFacts, now})); the team tools are created here (L1677-1684: createTeamTools({..., controlService: control, resolveCaller: live.resolveCaller, ...})).
- packages/runtime/src/plugin/host.ts — the glue construction site (L898: glue.createAgentBindings({agents, sessionPersistence, domain, config, teamToolsRef, now, subagents, agentPresets})). The control service must REACH the glue; the existing `teamToolsRef` pattern is the precedent: host.ts creates the ref object, the root fills .current after assembly, the glue reads it LAZILY inside agentSetup (by the time agentSetup runs for any agent, the root assembly — and thus the control service — exists).
- packages/runtime/src/plugin/live/agent-bindings.mjs — the live glue (plain JS, dynamically imported at host.ts L884; it imports in-repo modules via RELATIVE .js specifiers that resolve to dist mirror in production and TS source under the unit runner).
- ALLOWED auxiliary: packages/domain/policy/src (staticCapabilitiesOf) ONLY if the glue needs permissions surfaced through it — otherwise read template.capabilities?.permissions directly from the resolved blueprint in the glue (the bound blueprint object is already resolved by resolveStaticCapabilities). Choose the minimal clean option and document it.
- Rebuilt dist (pnpm build) is expected and committed; no other product files.

## Verified wiring facts (main agent, 2026-09-11 — verify as you land them)

agentSetup (agent-bindings.mjs L913, runs for BOTH create AND cold-resume, per agent):
1. liveAgentCtxs.set
2. resolveConsumptionViews
3. resolveStaticCapabilities (L815/L924) — fail-closed P0-1 'capability-template-unresolved'; the leader = LeaderTemplate; members resolve via their durable row (childSessionId -> templateId); the fresh-create window uses the templateId hint. THE BINDING POINT: this is where the bound template (and its capabilities, now including permissions) is known per agent.
   3a. VERIFIED (main agent, 2026-09-11): `staticCapabilitiesOf` (packages/domain/policy/src/static-capability-source.ts L66-81) does NOT project `permissions` — its return type carries only teamTools/builtinToolDeny/skills/mcp. So the `capabilities` value the glue already holds at L924 has NO permissions field. The minimal path (per the allowed-auxiliary note above): read `template.capabilities?.permissions` DIRECTLY from the bound blueprint in the glue — a small glue-local helper mirroring resolveStaticCapabilities' template resolution (leader: sessionId === teamRoot -> blueprint.leader; member: durable row templateId -> blueprint.members entry; fresh-create: templateIdHint), returning the deep-frozen policy or undefined (absent). Do NOT extend staticCapabilitiesOf (alpha.1 t1/t2/t3 suites pin its exact shape).
   3b. VERIFIED cwd sources (main agent, 2026-09-11): the glue passes `meta: { cwd }` on every create — root via `effectiveRootWorkspace(sid)` (L1690-1698: durable TeamSession row `defaultWorkspace` non-empty string, else `config.defaultWorkspace`; used at L1739); fresh members via `memberCwd` (L1427-1430: `request.workspace ?? config.defaultWorkspace`; other member paths L1485/L1509 use `config.defaultWorkspace`). t12a-m1-effective-cwd.test.ts PROVES `meta.cwd` reaches the actual agent cwd for root + members (M1-1..M1-5). The glue does NOT currently read the session header's cwd at setup time (only `sessionPersistence.ensureMaterialized` is used; no `agentCtx.agent` reads exist). RESOLVER CLOSURE DESIGN (your ruling, document it): the A5 adapter's `resolveTarget` is `(path) => Promise<{key, display}>` and may read `agentCtx` lazily per call — PREFERRED: the closure reads `agentCtx.agent?.session?.header?.cwd` at CALL time (the header is certainly materialized by pre-execute, and this single rule covers root + fresh + cold members uniformly — the cwd the file tools themselves resolve against, `exec.agent.session.header.cwd`, so rules and operations share the same basis by construction). ALTERNATIVE: capture at install time (only if you verify in the t12a world that `agentCtx.agent.session.header.cwd` is populated at the AgentSetup callback moment). Either way: the SAME closure serves rule canonicalization and operation canonicalization (A5's R1/R2 requirement).
4. installModelSelection (disposer)
5. member preset mount (members only, fresh/cold-member)
6. builtinToolDeny (selective only, BEFORE team tools — P0-3 ordering)
7. team tools register (reads teamToolsRef.current)
8. team skills
9. persona
10. MCP reconcile
11. applyBoundaryRecords

Disposers: the module-closure `toolDisposers` array (L434); every installer pushes its disposer; close() drains it (L2157: for (const d of toolDisposers.splice(0))). YOUR listener disposer goes into toolDisposers (lifecycle-owned).
governanceAuthority(asSessionId) (L2048): root session -> {kind:'operator'}; member session -> {kind:'member', instanceId}.
The instance id of the CALLING agent (RESOLVED, main agent 2026-09-11): for the ROOT session = `LEADER_INSTANCE_ID` (glue L215, the mirrored contracts constant 'inst-leader' — the plain-JS substrate mirrors it because it cannot import the TS contracts package; governanceAuthority already uses it at L2026). So the leader install: caller = { kind:'instance', instanceId: LEADER_INSTANCE_ID }, targetInstanceId = LEADER_INSTANCE_ID, isLeader = true. For MEMBER sessions: the resolved `instanceId` from resolveConsumptionViews (agentSetup L918 state.instanceId — the durable row truth). isLeader = (sessionId === teamRoot).

## The wiring (plan §11)

1. Per lifecycle (fresh root / fresh member / cold root / cold member), inside agentSetup AFTER resolveStaticCapabilities: extract the OPTIONAL permissions policy from the bound template (template.capabilities?.permissions).
2. ABSENT -> install NOTHING (zero listeners; alpha.1 behavior fully unchanged — this is the legacy path and must be byte-for-byte the old behavior: no extra registrations, no extra observations).
3. PRESENT -> build the adapter inputs:
   - policy: the template's permissions (deep-frozen A1-normalized object).
   - resolveTarget: a closure over the agent ctx's public fs seam — (path) => ctx.fs.resolve(path, { cwd: <this session's workspace cwd>, signal: <the per-call signal if you can bind it, else omit and document> }).then(t => ({ key: unbrand(t.targetKey), display: t.displayPath })). The session cwd source: for the root session = the team workspace (the same cwd the file tools resolve against — check how the glue knows it: the session header / config; for members = their session header cwd, the same convention the upstream file tools use (exec.agent.session.header.cwd)). If the cwd is only knowable per-call, design the closure to capture the session identity and resolve the cwd lazily from the session header (document the design; requirement: rules and operations canonicalized against the SAME cwd basis).
   - controlService: the ref-filled control service (the teamToolsRef pattern, extended to the control service).
   - rootSessionId, caller: ActionCaller = { kind: 'instance', instanceId: <this agent's instance id> }, targetInstanceId: <same instance id>, isLeader: <this agent is the root session>.
    - onObserve: wire to the glue's module-level `observations` array (VERIFIED main agent 2026-09-11: `const observations = []` at agent-bindings.mjs L437-438 — "noteworthy async observations"; push small structured rows via a closure that prefixes each row with a short parameter-permission stage marker — follow the existing logging style of the other installers, do not invent a new sink).
4. Install: const dispose = installParameterPermissionListener(agentCtx, {...}); toolDisposers.push(dispose).
5. Cold resume: agentSetup re-runs for every agent on resume -> the listener is REINSTALLED (a fresh one; the old lifecycle's disposer was drained at close). No module-level mutable authority (plan §11.3): all per-lifecycle state lives in closures created inside agentSetup.
6. Rule canonicalization: the adapter canonicalizes exact rules (A5's job, once at install or lazily). YOU provide the resolver it uses; ensure the rule-canonicalization cwd basis matches the operation cwd basis (same session workspace).
7. No dynamic mutation (plan §11.4): the policy is rebuilt from the bound template per lifecycle; no runtime context injection, no CAS, no snapshot coordinator. A blueprint revision change takes effect on the next lifecycle (boot/resume), same as every other capability facet.

## Tests (plan §13 L3 — t4a-level glue wiring, packages/runtime/test/)

REUSE the t4a-capability-wiring.test.ts foundation (the REAL live glue over the t12a-live-bridge doubles: buildCapabilityWorld(bootPhase) / createLiveWorld / withDshHome / the blueprintSource YAML fixture). VERIFIED test-foundation fact (main agent 2026-09-11): the t12a bridge's agent-ctx double (t12a-live-bridge.mjs L173-179) records EVERY on(event, listener) into the double's `listeners` array as { event, listener, active: true }; the returned disposer sets `active = false` (entries are NOT removed). So count ACTIVE entries filtered by event: listeners.filter(l => l.event === 'tools/pre-execute' && l.active). The double's on takes exactly (event, listener) — matching the adapter's call shape.
1. PERMISSIONS ABSENT (the existing t4a worlds): assert ZERO 'tools/pre-execute' listeners recorded on every agent ctx (the doubles record on() calls) — the legacy/alpha.1 worlds are untouched.
2. PERMISSIONS PRESENT: a new world whose blueprintSource YAML carries capabilities.permissions on the leader + a member -> after boot, the leader ctx AND that member ctx each have exactly ONE tools/pre-execute listener; a member WITHOUT permissions has zero.
3. COLD RESUME: the same world with bootPhase 'resume' -> the listeners are REINSTALLED (fresh listener instances; count the on() registrations across both phases: each phase installs its own; the close between phases drained the first).
4. CLOSE: binding.close() -> the listener disposers were called (the double marks listeners inactive, or assert toolDisposers drained — use whatever assertion the t4a dispose tests use for the other installers).
5. (If the t12a bridge world can reach it) a full ask path through the REAL control service: this needs the control service in the glue world — the bridge world's domain is in-memory; if wiring the real service into the t12a bridge exceeds the test's scope, mark it as A5-covered (the A5 suite already proves the full path with the real service) and assert only the INSTALL/dispose/routing-input wiring here. Document which leg each suite owns: A5 = pipeline+service semantics; A6 = install/uninstall/reinstall/lifecycle wiring.
6. The control service ref: assert the glue reads the ref lazily (a world booted with the ref filled AFTER construction still gets the service — mirroring how teamToolsRef is tested, if such a test exists; otherwise skip and document).

The blueprint YAML for the permissions worlds: extend the t12a/t4a blueprintSource pattern with a capabilities.permissions block (default ask, one allow rule, one deny rule, one ask rule — small; the V1 live kit has the full five-file matrix).

## Build + gate (in order, in your worktree)

1. pnpm install --ignore-scripts
2. Focused: node scripts/run-tests.mjs runtime (your new t4a-style suite + the EXISTING t4a-capability-wiring + t12a + f9-control suites — the whole runtime package) — baseline-vs-after, ZERO new failures.
3. pnpm typecheck -> exit 0 (root.ts is TS; the glue is .mjs — ensure the glue's imports resolve under the unit runner's .js->.ts hook).
4. pnpm build + pnpm build:composition; node scripts/check-artifacts-committed.mjs -> exit 0 (rebuild + COMMIT changed dist — the dist mirror of root.js/host.js/agent-bindings.mjs + the operation-permission dist + control dist changes from A4 must all be committed).
5. p4t6 pin: update ONLY the pin value + comment if the scan count changed (your new test file). Build on the A1–A5 pin numbers.

## Red lines

- CORE PATCH BUDGET = 0: no references/** edits, no upstream edits, no new deps.
- SINGLE WRITER: you are the only writer on the hotspots; A1–A5 files are read-only for you EXCEPT the one allowed control/ minimal patch IF A5's report flags §10.5 as requiring it (then you carry it into the final tree and document).
- The legacy/alpha.1 path must be behaviorally UNCHANGED (the absent-permissions leg of test 1 is the proof).
- No push. Commit source + tests + dist + evidence.
- Evidence: dev/agent-workflow/evidence/alpha2-permission/a6/ (report + logs + the wiring map: which lifecycle installs what).
- Working tree ends clean (or only your committed files).

## Report format (final message)

Structured: commits, files changed (per hotspot), exact test command + baseline/after numbers, the wiring map (lifecycle x facet table), the cwd/rule-canonicalization design ruling, the control-service ref design, any deviations, red-line status. V1 readiness statement.
