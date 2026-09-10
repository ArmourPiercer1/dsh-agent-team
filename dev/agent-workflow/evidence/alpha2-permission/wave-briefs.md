# alpha.2 wave 2-5 briefs (main-agent prep, 2026-09-10)

Status note: wave 1 (A1/A2/A4) dispatched as subagents; this file holds the
prepared briefs for the dependent waves. Update statuses as waves land.

## A2 build-config facts (verified by main agent — the worker brief may not mention these)

- `packages/runtime/package.json` exports = ONLY `"."` -> ./dist/index.js. No per-module exports.
- `packages/runtime/tsconfig.build.json` compiles a LIST of top-level dirs from the package root (rootDir ../..): src, action-router, activation, activity, admission, agent-setup, compatibility, control, fork-reconciliation, handoff, lifecycle, member-residency, messaging, mutation, projection, root-binding, policy-adapter.ts. **A2 MUST add its new module dir (operation-permission) to this include list** or tsc emits no dist for it and the committed-dist gate fails.
- Module layout convention (mirror `control/`): `operation-permission/{index,types,errors?,canonical-operation,...}.ts` with an index.ts barrel. The runtime root `src/index.ts` exports ONLY the package identity — NO re-export needed there; consumers use relative imports (plugin code: `../../operation-permission/index.js` from src/plugin/; the glue agent-bindings.mjs: `../../../operation-permission/...js` from src/plugin/live/ — relative .js specifiers resolve to dist mirror in production, to TS source under the unit runner).
- Tests live in packages/runtime/test/ (the control module has no in-dir tests).

## A3 — Static Operation Permission Resolver (needs A1 + A2 on int)

Worktree: .worktrees/alpha2-a3 (branch task/alpha2-a3-static-resolver, base = int/alpha2-permission tip after A1+A2 merge).

VERIFIED SURFACES (main-agent reviewed the merged/finishing work):
- A1 (on int @ e38760b): import from `../../domain/blueprint/src/index.js` (relative, A2-style) — types `TemplatePermissionPolicy`, `PermissionRule`, `PermissionResource`, `PermissionTool`; constants `PERMISSION_TOOL_NAMES`, `PERMISSION_POLICY_DEFAULTS`, `PERMISSION_RESOURCE_KINDS`. Policy shape: `{ default: 'ask'|'deny'; allow/ask/deny: readonly PermissionRule[] }` (declaration-order normalized; exact.path trimmed).
- A2 (landing on int): import from `./types.js` + `./canonical-operation.js` (same operation-permission dir) — `CanonicalOperation` (has `tool`, `resource: { kind: 'file'|'tool'; key; display }`, `fingerprint`), `classifyPermissionTool` / `isPermissionToolName`, `BASH_TOOL_RESOURCE_KEY`, `PERMISSION_TOOL_VALUES`, `FILE_PERMISSION_TOOL_VALUES`. A2 is pure/seam-injected (no node: or upstream imports).
- A3 deliverable location: `packages/runtime/operation-permission/permission-resolver.ts` (+ its tests in packages/runtime/test/). The module dir is ALREADY in tsconfig.build.json include (A2) — no build-config change needed unless A3 adds new top-level dirs (it doesn't).

Spec: plan §8 (authoritative). Read A1's export surface (packages/domain/blueprint — TemplatePermissionPolicy / PermissionRule / PermissionTool + canonical-rule types per A1 report) and A2's CanonicalOperation export surface (packages/runtime/operation-permission — per A2 report).

Deliverable: pure module packages/runtime/operation-permission/permission-resolver.ts (+index export):
- resolveOperationPermission(policy, operation, canonicalRules) -> { decision: 'allow'|'ask'|'deny', provenance: { source: 'rule'|'default', effect, lane?, ruleIndex? } }
- canonicalRules = the policy's rules with exact.path replaced by the canonical key (the A5 adapter canonicalizes at policy build time per agent lifecycle; A3 receives ALREADY-canonicaled rules — A3 itself never resolves paths).
- Matcher: exact = canonical rule key === operation resource key (string equality on opaque keys); any = tool match only (plan §8.2). NO subtree, NO startsWith.
- Resolution: collect all matching rules across the three lanes; deny > ask > allow > policy.default (plan §8.3/6.4 frozen).
- Provenance: which lane/ruleIndex decided (for diagnostics/observation), or default.
- bash: tool-level — a bash rule with resource:any matches the bash operation (resource.kind 'tool'); a bash rule with resource:exact CANNOT exist for parameter matching (schema: bash only meaningful with any; if an exact bash rule appears, document + test the deterministic behavior: it never matches a tool-level operation key — record the ruling in the module docs).
- bash in the ALLOW lane: RESOLVED (A1 review, 2026-09-11) — A1's schema ACCEPTS a bash rule in the allow lane (plan §6.3's closed constraint list does not include a per-lane tool restriction; §4 scopes the minimal shell permission to ask/deny but §6.3 is the A1 contract and was satisfied). A3 ruling to implement + document in the resolver: a bash rule matches the tool-level bash operation in ANY lane (allow/ask/deny); deny>ask>allow priority applies; an exact-path bash rule NEVER matches (bash operations carry a tool-level resource, no parameter identity). The plan-4 "no positive parameter-level allow for bash" is enforced by the matcher, not the schema. Record this in the A3 module docs + the V1 report.
- Unsupported tools never reach A3 (the adapter gates them).
- Tests (plan §8.4): allow/ask/deny exact; any allow/ask/deny; deny>ask>allow; no match + default ask; no match + default deny; same raw spelling / same canonical resource (same key string); different canonical resource; provenance correctness (lane + ruleIndex for the winning rule; deterministic when multiple rules in the same lane match — pin the ruleIndex semantics, e.g. first in declaration order).

## A5 — tools/pre-execute Enforcement Adapter (needs A2 + A3 + A4 on int)

Worktree: .worktrees/alpha2-a5 (branch task/alpha2-a5-pre-execute, base = int tip after A3+A4 merge).

Spec: plan §10 (authoritative). Read A2/A3/A4 reports + exports; upstream seam facts below (verified by main agent on test-use @ a66e470204).

UPSTREAM SEAM FACTS (references/deepseek-harness-test-use, read-only):
- Agent-scoped waterfall event: agent.ctx.on('tools/pre-execute', async (exec, next) => PreToolDecision) — references/deepseek-harness-test-use/packages/core/tools/src/index.ts L144; ctx.on returns the disposer (upstream convention: registrations are effects; register() returns the disposer).
- PreToolDecision = { kind:'allow' } | { kind:'deny'; reason: string } | { kind:'ask'; reason?: string } (L581-584). The native 'ask' is routed by the pipeline to ctx.get('approval') (serviceAsk L1680-1720) — alpha.2 does NOT rely on that: the listener resolves the ask SYNCHRONOUSLY through the Team Control plane and returns allow/deny itself (plan §9/§10: no parallel approval protocol, no async approval).
- exec payload: { callId, rootCallId, name, arguments (parsed JSON deep-frozen), agent?, signal } (L307-377). exec.agent.session.header.cwd = per-session workspace cwd (the sessionResolveOptions convention in packages/fs/tool-fs/src/session-cwd.ts).
- The pipeline is agent-scoped (scoped-events routing on exec.agent) — one listener per agent ctx covers exactly that agent's calls.

Deliverable: scoped listener factory in packages/runtime/operation-permission/ (e.g. pre-execute-adapter.ts + index export), composing A2 (canonicalize) + A3 (resolve) + A4 (control service: requestControl/awaitControlDecision/guardOperation) — NO re-implementation of their logic:

installParameterPermissionListener(agentCtx, params: {
  policy: TemplatePermissionPolicy (raw, from the bound template),
  canonicalizePolicy: (policy) => Promise<canonicalRules> or the adapter builds them once at install time (decision: canonicalize the exact rules ONCE at install via the injected resolveTarget; document),
  resolveTarget: (path: string) => Promise<{key, display}>  // the adapter for ctx.fs.resolve(path, {cwd: sessionCwd(exec), signal}) — injected, unit-testable
  controlService, // A4 service (with awaitControlDecision)
  rootSessionId,  // the team root (scope's rootSessionId)
  targetInstanceId, // this agent's instance identity (leader instance id for the root session; member instance id for members)
  isLeader: boolean, // routing: member ask -> leader-approval; leader ask -> user-approval
  now?: () => number, // clock for diagnostics (if needed)
}): disposer

Pipeline (plan §10.2 FROZEN):
1. exec.name not a supported permission tool (read/read_image/write/edit/lsp/bash) -> await next() (pass through; zero interference).
2. Supported tool: canonicalize (A2) — bash = tool-level resource (no resolver); file tools = resolver call.
3. Canonicalization failure / malformed args -> return { kind:'deny', reason: <typed message> } (fail closed, plan §7.5). NEVER next().
4. resolveOperationPermission (A3) with the pre-built canonical rules:
   - allow -> await next()
   - deny  -> return { kind:'deny', reason: ... } (mention the provenance lane)
   - ask:
     a. createControlRequest (existing service API — kind: isLeader ? 'user-approval' : 'leader-approval'; scope: { rootSessionId, targetInstanceId, actionName: 'parameter-permission', toolName: exec.name, correlation: exec.callId, operationFingerprint: op.fingerprint } — check the exact requestControl signature in A4's service + the existing usage in packages/tools/src/tools.ts L828 for the established shape; REUSE the existing request-creation path semantics, no new request kinds)
     b. awaitControlDecision({ rootSessionId, requestId, signal: exec.signal }) (A4 waiter)
     c. decision deny -> return { kind:'deny', reason: 'the approval was denied' }
     d. decision allow -> guardOperation (A4, exact scope INCLUDING operationFingerprint + the SAME correlation): allowed:true -> await next(); any block reason -> return { kind:'deny', reason: ... }. In THIS path NO_REQUEST is a consistency anomaly (we just created the request) -> fail closed (deny with a diagnostic reason); do NOT import the team-tools SD-GUARD no-request-proceeds semantics.
5. Zero-effect invariant (plan §10.3): on every non-allow path the tool's execute() is never called — the listener returns before next() is awaited. (next() drives the rest of the waterfall toward dispatch; returning a deny verdict materializes the error result without dispatch.)
6. Cancellation (plan §10.4): exec.signal abort while awaiting the decision -> the waiter settles (A4 typed abort) -> the listener returns deny (or the pipeline's own abort semantics — document what the listener does; requirement: no leaked promise, no later accidental execution, no unhandled rejection).
7. External hard (plan §10.5): recon the existing ControlService decision-time external-hard check + whether the last-mile guard re-checks hard policy fresh; if the current service cannot guarantee "after approval, before execution, external hard re-confirmed", record it as the alpha.2 security blocker finding in the report + do the minimal patch IF necessary (NO teamHardDeny introduction).
   MAIN-AGENT PRE-RECON (verify, don't assume): control/service.ts L923-946 — the allow-DECISION path probes the LIVE `options.externalPolicyFacts()` provider before the decision row is written (external deny -> durable deny reason 'external-policy' + CONTROL_EXTERNAL_POLICY_DENIED; even a human allow fails closed). The guardOperation (last mile) checks team-exists + target-durable-live + unconsumed allow for the EXACT scope — it does NOT re-probe external facts. In production the facts provider is the static config row (`externalPolicyFacts: { hard: {}, capabilityExists: {} }` — root.ts createControlService L936-941). Ruling to verify: decision-time live check + decision->guard adjacency in ONE synchronous await chain + static facts provider => the "批准后、执行前再确认" requirement is satisfied for the current deployment; record it in the report as the §10.5 finding (with the residual-window note). Do the minimal guard-side re-probe patch ONLY if the worker finds the adjacency argument insufficient (e.g., an external await between decision and guard) — and in that case the control/ file edit is allowed since A4 is already merged to int.
8. Diagnostics: observations (the glue's observations.push pattern is A6's concern; the adapter should accept an optional onObserve callback or return structured outcomes the A6 glue can log — keep the adapter testable: inject onObserve).

Tests (focused integration, packages/runtime/test/a5a-*.test.ts style):
- fake agentCtx with an on() that records the listener + fake control service (A4-style in-memory durable rows) + fake resolver
- allow executes (next called, tool "executes" = spy)
- static deny zero execution
- ask -> request created (durable row present) -> human/leader resolve allow -> guard consumes -> next called exactly once
- ask -> deny decision -> zero execution
- second identical call after consumption: new request required (old one consumed -> guard allow-consumed -> deny; the model must retry = new request)
- fingerprint mismatch (same file different content) -> old approval not reusable
- member vs leader routing (leader-approval vs user-approval request kinds)
- member self-approval forbidden (a member-instance caller resolving its own request is rejected by the existing resolver role set — reuse existing behavior, test it)
- cancellation: signal abort while pending -> listener settles, zero execution, no leaked promise (the test process exits / no open handles)
- unsupported tool (e.g. web_fetch) -> next() pass-through, no control rows created
- bash with resource:any ask rule -> tool-level ask (request + wait + consume); bash with no rule -> default
- canonicalization failure (resolver throws / missing file_path) -> deny, zero execution

## A6 — Production Wiring (single integration writer; needs A5 on int)

Worktree: .worktrees/alpha2-a6 (branch task/alpha2-a6-production-wiring, base = int tip after A5 merge).

Hotspots (plan §11.1 + the verified assembly chain, the ONLY product files this task rewrites):
- packages/runtime/src/plugin/root.ts (the control service is created HERE, L936 createControlService; team tools L1677-1684)
- packages/runtime/src/plugin/host.ts (the glue construction site: L898 glue.createAgentBindings({agents, sessionPersistence, domain, config, teamToolsRef, now, subagents, agentPresets}) — the control service must reach the glue; the teamToolsRef pattern is the precedent: host.ts creates the ref, the root fills .current after assembly, the glue reads it lazily in agentSetup)
- packages/runtime/src/plugin/live/agent-bindings.mjs (agentSetup L913 + resolveStaticCapabilities L815 + toolDisposers L434/L2157 + governanceAuthority L2048)
(+ minimal domain/policy staticCapabilitiesOf extension IF the glue needs it — allowed, single writer; and rebuilt dist; no other product files)

Verified wiring facts (main agent, 2026-09-10, @ 3aa6838):
- root.ts L936: const control = createControlService({...}); L1677-1684: createTeamTools({..., controlService: control, resolveCaller: live.resolveCaller, ...}); teamToolsRef.current = tools (the glue reads teamToolsRef.current in agentSetup).
- The glue is built via createAgentBindings(deps) (agent-bindings.mjs L409); deps currently carry live/domain/config/teamToolsRef/agentPresets/teamSkillCatalog/etc. A6 adds the controlService (and whatever A5's adapter needs: onObserve -> observations.push) to the glue deps from root.ts.
- agentSetup (L913): the per-agent setup callback (create AND cold-resume both run it). Sequence: liveAgentCtxs.set -> resolveConsumptionViews -> resolveStaticCapabilities (L924, fail-closed P0-1) -> installModelSelection (disposer L936) -> member preset mount (L955-963, members only) -> builtinToolDeny (L978-981, BEFORE team tools, P0-3) -> team tools register (L985-998) -> team skills (L1004-1011) -> persona (L1017+) -> MCP mount (L1033-1039) -> applyBoundaryRecords.
- Disposer pattern: toolDisposers array (L434), pushed by every installer, drained at L2157 on close (for (const d of toolDisposers.splice(0))) — P0-2: real disposers saved + called.
- governanceAuthority(asSessionId) (L2048): root -> {kind:'operator'}; member -> {kind:'member', instanceId} — the A5 routing input (operator/leader ask -> user-approval; member ask -> leader-approval).
- staticCapabilitiesOf is imported from packages/domain/policy/src (L197) and also used at root.ts L1351 — if the glue needs permissions surfaced through it, extend it there (domain/policy) OR read template.capabilities?.permissions directly from the bound blueprint in the glue (the blueprint object is already resolved in resolveStaticCapabilities). Choose the minimal clean option; document.

A6 work (plan §11):
1. Each lifecycle (fresh root / fresh member / cold root / cold member): resolveStaticCapabilities already gives the bound template's capabilities; extract the OPTIONAL permissions policy (absent -> no listener installed at all — alpha.1 behavior fully unchanged, plan §11.2).
2. If present: build the canonical rules once per setup (via the ctx.fs.resolve wrapper with the session cwd — the cwd source: exec.agent.session.header.cwd is only available at CALL time; the RULES need canonical keys at INSTALL time with a workspace cwd — decision: use the session's workspace cwd available at setup (the session header / the config workspace the row was bound to; check how the glue knows the session workspace — effectiveRootWorkspace L1690 exists for the root; members use their session header cwd at call time for OPERATION canonicalization. For RULE canonicalization at install, use the same workspace root the tools resolve against (the session cwd). If the cwd is only knowable per-call, canonicalize rules lazily on first use + cache — document the chosen design; requirement: rules canonicalized against the SAME cwd basis as operations, else exact matching breaks).
3. Install A5's listener: agentCtx.on('tools/pre-execute', handler) -> push the returned disposer onto toolDisposers (lifecycle-owned: close drains it; cold resume re-runs agentSetup -> fresh install; no module-level mutable authority, plan §11.3).
4. No dynamic mutation (plan §11.4): the policy is rebuilt from the bound template per lifecycle; no runtime context injection, no CAS, no snapshot coordinator.
5. root.ts: pass the control service + the needed closures into the glue deps.
6. Tests: extend the t12a-style glue doubles / capability worlds (packages/runtime/test/t4a-*.test.ts pattern) to cover: permissions absent -> zero listeners installed (legacy world unchanged); permissions present -> listener installed on the agent scope; cold resume re-installs (a second agentSetup -> new listener, old disposer called); close drains the disposer; the full ask path through the REAL control service + fake agentCtx (or the t4a harness if it can drive a pre-execute event).
7. Rebuild dist (pnpm build) + check-artifacts-committed.

## V1 — Verification (after A6 on int)

- Focused test report: all alpha.2 suites (a1*/a2a*/a3*/a4a*/a5a*/t4a-permission) + alpha.1 regression suites (t1 11d/11e, t2, t3, t4a, t12a) + full typecheck 9/9 + pnpm build + build:composition + check-artifacts (dist committed, byte-reproducible) + lint.
- Live-host targeted smoke (L3/L4): extend the alpha1-hardening kit (dev/agent-workflow/evidence/alpha1-hardening/cap-*.mjs) into an alpha2 kit:
  - world with a permissions blueprint: file A allow read / file B deny read / file C ask write / file D default ask / file E default deny (plan §12.1) — model-driven tool calls via the mock DeepSeek (the hardening kit's mock server pattern) + direct pre-execute assertions via the kit's state/dump surfaces;
  - L4 real host: Leader + Member A + Member B, real AgentPreset, real fs tools, real Remote/F9 human decision if available (plan §12.3 routing: member ask -> leader; leader ask -> human);
  - exact allow-once (plan §12.2): first write executes; second consume allow-consumed; same file+payload+new callId -> new request; different payload -> old approval unusable;
  - cold resume (plan §12.4): static policy rebuilt; pending request still visible; decisions/consumptions preserved;
  - safety negatives (plan §12.6);
  - alpha.1 regression live (per-teammate team tools / builtin deny / skills / MCP / legacy / dispose) — reuse the hardening6 + caplegacy worlds as the regression baseline.
  - PORT: 3180 was occupied at kickoff by a user tsx instance (pid 104004, created 23:20) — check at V1 time; if still busy use 3181 (TEST_METHODS §4, recorded in evidence). 3493/3494 for mock DeepSeek / mock MCP as in the hardening kit.
- Version bump to 0.1.1-alpha.2 (all 10 package.json, same pattern as the alpha.1 bump) + INSTALL/README notes IF the install surface changed (it should not — no new lifecycle scripts).
- Evidence: dev/agent-workflow/evidence/alpha2-permission/v1/ (summary.md with the DoD table, focused-tests.txt, live-*.json, cold-resume.json, environment-cleanliness.txt).

## Merge discipline (all waves)

- task branch -> main agent cherry-pick -x to int/alpha2-permission (source + tests + dist + evidence), conflict-free expectation (disjoint paths across A1/A2/A4; A3/A5/A6 sequential on int tip).
- After each merge: main agent runs the int-tree gates (typecheck + affected tests + check-artifacts) before dispatching the next wave.
- p4t6 pin: each task updates its own if the scan count changed (DEC-1 pattern); the main agent verifies the pin test on int after merges.
