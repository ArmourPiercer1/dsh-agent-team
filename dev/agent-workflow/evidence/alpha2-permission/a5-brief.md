# A5 dispatch brief — tools/pre-execute enforcement adapter (alpha.2)

You are implementing A5 (the pre-execute enforcement adapter) of the 0.1.1-alpha.2 plan.
Read first (mandatory, in this order):
1. docs/ROUTER_RULES.md
2. docs/TEST_METHODS.md
3. docs/plans/active/0.1.1-alpha.2-detailed-development-plan.md — sections 4, 7 (A2 contract), 8 (A3 contract), 9 (A4 contract), 10 (A5 — YOUR spec, authoritative), 13 (test layers).
4. A2/A3/A4 task reports + their export surfaces (they are ON INT — import from the merged code, do not re-derive): dev/agent-workflow/evidence/alpha2-permission/{a2,a3,a4}/.

## Your task

Worktree: .worktrees/alpha2-a5 (branch task/alpha2-a5-pre-execute), based on int/alpha2-permission tip AFTER A2+A3+A4 are merged. You are the single writer. Deliver the scoped `tools/pre-execute` listener that enforces the static parameter-aware permission policy SYNCHRONOUSLY through the durable Control plane.

Deliverable files:
- packages/runtime/operation-permission/pre-execute-adapter.ts — the listener factory (your main deliverable).
- packages/runtime/operation-permission/index.ts — ADD the adapter exports to the existing barrel (do not disturb A2/A3's exports).
- packages/runtime/test/a5a-pre-execute.test.ts (+ more a5a-* files as needed) — focused integration tests.
- If plan §10.5's minimal patch is required (see below), packages/runtime/control/service.ts may receive a MINIMAL guard-side change — document it in your report; do NOT introduce teamHardDeny.

## Upstream seam facts (verified by the main agent on references/deepseek-harness-test-use @ a66e470204 — read-only)

- The enforcement point is the AGENT-SCOPED waterfall event: `agentCtx.on('tools/pre-execute', async (exec, next) => PreToolDecision)`. `ctx.on` returns the disposer (upstream convention: registrations are effects). packages/core/tools/src/index.ts L144 (event), L581-584 (PreToolDecision), L1454-1498 (prepareExecution).
- PreToolDecision = { kind:'allow' } | { kind:'deny'; reason: string } | { kind:'ask'; reason?: string }.
- PIPELINE SEMANTICS (prepareExecution): the waterfall runs; if the final gate is 'ask' it routes to the native `ctx.get('approval')` service — YOU MUST NEVER RETURN 'ask': your listener resolves the ask internally (request -> await decision -> guard) and returns 'allow' or 'deny' itself. A 'deny' verdict materializes `Error: <reason>` as a tool error result BEFORE dispatch — the tool body NEVER executes (the zero-effect invariant, plan §10.3, is guaranteed by the pipeline when you return deny before calling next()).
- exec payload (ToolExecution, L307-377): { callId, rootCallId, name, arguments (parsed JSON, deep-frozen), agent?, signal (AbortSignal) }. `exec.agent.session.header.cwd` = the per-session workspace cwd (the upstream file tools' resolution convention — packages/fs/tool-fs/src/session-cwd.ts).
- The listener is installed per agent ctx (agent-scoped routing) — one listener per agent covers exactly that agent's calls.
- You do NOT touch the upstream tree. The adapter is plain in-repo TS; the only upstream surface it uses at RUNTIME (via the injected resolver, see below) is the public `ctx.fs.resolve(path, {cwd, signal}) -> FsTarget { targetKey, displayPath }` seam.

## Verified in-repo surfaces (import these)

A2 (packages/runtime/operation-permission/, same dir):
- canonicalizeOperation(input) — input shape: check A2's CanonicalizeOperationInput type (tool name + parsed arguments + resolveTarget). Returns CanonicalOperation { tool; resource {kind:'file'|'tool'; key; display}; fingerprint } ('sha256:'+hex).
- classifyPermissionTool(name) -> {kind:'file',tool} | {kind:'tool-level',tool} | {kind:'unsupported'}
- isPermissionToolName(name)
- BASH_TOOL_RESOURCE_KEY; FILE_PERMISSION_TOOL_VALUES; PERMISSION_TOOL_VALUES
- OperationPermissionError + isOperationPermissionError + canonicalizationFailed (typed fail-closed; every canonicalization failure must map to a deny)
- PathTargetResolver type: (path: string) => Promise<{key, display}> — the resolver CLOSURE is built by YOU (the adapter's install parameter), wrapping ctx.fs.resolve with the session cwd + exec.signal (see "Your adapter API" below). A2's module itself never imports upstream.

A3 (same dir):
- resolveOperationPermission(policy, operation, canonicalRules) -> { decision: 'allow'|'ask'|'deny'; provenance: {source:'rule'|'default'; effect; lane?; ruleIndex?} }
- CanonicalRules = { allow/ask/deny: readonly CanonicalRule[] } where CanonicalRule.resource = {kind:'exact'; key} | {kind:'any'} — YOU (the adapter) build canonicalRules by canonicalizing each exact rule's path via the SAME resolver once at install time (or lazily on first use with a cache — your design choice, document it; requirement: rules canonicalized against the SAME cwd basis as operations).
- read A3's module docs for the exact input contract (the canonicalRules input normalization is A3's documented contract).

A4 (packages/runtime/control/):
- ControlService methods (read A4's report for the FINAL shapes): requestControl({rootSessionId, caller, kind, targetInstanceId, actionName, toolName?, capabilityDomain?, correlation, summary?} — A4 adds operationFingerprint to this) -> ControlRequestRecord (has requestId).
- awaitControlDecision({rootSessionId, requestId, signal?}) -> resolves with the durable ControlDecision record when the decision appears; typed CONTROL_WAIT_ABORTED on signal abort; typed CONTROL_WAIT_CLOSED on plane close. Liveness-only (250ms poll, authority = durable rows).
- guardOperation(scope) -> ControlGuardVerdict { allowed; reason?; requestId?; decisionSequence? } — check-and-reserve (exactly-once consumption).
- ActionCaller = {kind:'human', humanId} | {kind:'instance', instanceId}.
- ControlRequestKind values: read packages/runtime/control/types.ts CONTROL_REQUEST_KIND_VALUES ('user-approval' / 'leader-approval').
- Resolver role set (CONTROL_RESOLVER_ROLES): member can never resolve; user-approval is human-only (the leader cannot self-resolve a user-approval); leader-approval is resolvable by a leader instance with the resolve-control op. You rely on the EXISTING resolver checks — do not re-implement them.

## Your adapter API (design — match this shape)

```ts
installParameterPermissionListener(
  agentCtx: { on(event: string, listener: (exec, next) => Promise<PreToolDecision>): () => void },
  params: {
    policy: TemplatePermissionPolicy          // the bound template's permissions (deep-frozen, A1-normalized)
    resolveTarget: PathTargetResolver          // built by the glue (A6) over ctx.fs.resolve with the session cwd; the adapter passes exec's file_path into it (the closure also binds exec.signal where feasible — document how you thread the signal: the resolver type takes (path) only, so the signal is bound in the closure per-call if A6's closure captures the exec context, or the adapter canonicalizes with a per-call resolver wrapper — YOUR design choice, document)
    controlService: ControlService             // A4's real service
    rootSessionId: string                      // the team root
    caller: ActionCaller                       // THIS agent's durable identity: {kind:'instance', instanceId} for both leader (its leader instance) and members
    targetInstanceId: string                   // the calling agent's instance id (same as caller.instanceId)
    isLeader: boolean                          // routing: member -> 'leader-approval'; leader -> 'user-approval'
    onObserve?: (obs: Record<string, unknown>) => void   // optional diagnostics hook (the A6 glue wires observations)
  },
): () => void   // the disposer (the agentCtx.on return)
```

## The pipeline (plan §10.2 — FROZEN)

1. `classifyPermissionTool(exec.name)`:
   - 'unsupported' -> `await next()` (pass-through; zero control rows; zero interference).
   - 'file' or 'tool-level' -> continue.
2. Canonicalize: `canonicalizeOperation(...)` (file tools: the resolver call; bash: tool-level, no resolver). On any OperationPermissionError / canonicalization failure -> return { kind:'deny', reason: <typed message> } (FAIL CLOSED, plan §7.5). NEVER next() after a canonicalization failure.
3. `resolveOperationPermission(policy, operation, canonicalRules)`:
   - decision 'allow' -> `await next()`
   - decision 'deny' -> return { kind:'deny', reason: ... } (include the provenance lane in the message for debuggability).
   - decision 'ask':
     a. requestId = await controlService.requestControl({ rootSessionId, caller, kind: isLeader ? 'user-approval' : 'leader-approval', targetInstanceId, actionName: 'parameter-permission', toolName: exec.name, correlation: exec.callId, operationFingerprint: operation.fingerprint, summary: <short human-readable op summary> })
        - correlation = exec.callId (the stable logical invocation id; DISTINCT from the fingerprint — A4 semantics: same file+payload+NEW callId = new request).
        - a requestControl rejection (typed ControlError) -> return {kind:'deny', reason: <the typed message>} (fail closed; do not swallow).
     b. decision = await controlService.awaitControlDecision({ rootSessionId, requestId, signal: exec.signal })
     c. decision.value 'deny' (or a stale-denied/external deny) -> return { kind:'deny', reason: 'the approval was denied' }
     d. decision.value 'allow' -> verdict = await controlService.guardOperation(<exact scope: rootSessionId, targetInstanceId, actionName 'parameter-permission', toolName exec.name, correlation exec.callId, operationFingerprint>)
        - verdict.allowed -> `await next()`
        - verdict.blocked -> return { kind:'deny', reason: verdict.reason } — IN THIS PATH a 'no-request' verdict is a consistency anomaly (you just created the request) -> fail closed (deny with a diagnostic reason). Do NOT reuse the team-tools SD-GUARD no-request-proceeds mapping here (that mapping belongs to the team_request_control tool autonomy semantics in packages/tools/src/guard.ts — a different consumer).
4. Zero-effect invariant (plan §10.3): on EVERY non-allow path the tool body is never invoked — you return before next() is awaited. On the allow path next() drives the rest of the waterfall to dispatch.
5. Cancellation (plan §10.4): if exec.signal aborts while awaiting the decision, awaitControlDecision settles with CONTROL_WAIT_ABORTED (A4) -> return {kind:'deny', reason: 'the approval wait was cancelled'} (or the abort-specific wording); no leaked promise, no later accidental execution, no unhandled rejection. Also: if the signal is ALREADY aborted before you start (check cheaply) -> deny without creating a request (document this choice).
6. External hard (plan §10.5): RECON (and record in your report): the ControlService allow-DECISION path probes the live externalPolicyFacts() provider before the decision row is written (packages/runtime/control/service.ts — search CONTROL_EXTERNAL_POLICY_DENIED); the last-mile guard checks team-exists + target-durable-live + unconsumed exact allow but does NOT re-probe external facts; in production the facts provider is the static config row. Ruling to verify and record: decision-time live check + decision->guard adjacency in ONE synchronous await chain + static facts provider => the "批准后、执行前再确认" requirement is satisfied for the current deployment; the residual window (policy change strictly between decision and guard) is documented. Do the minimal guard-side re-probe patch ONLY if you find an external await between decision and guard in the A5 path (there is none in your design — the guard call is the next statement) — otherwise NO control/ change at all (preferred).
7. Diagnostics: call onObserve (when provided) with structured rows at: canonicalized operation (tool + resource kind + fingerprint), resolved decision + provenance, request created (requestId + kind), decision arrived (value + sequences), guard verdict. Keep rows small (no full payloads/contents).

## Tests (plan §13 L2 — focused integration, packages/runtime/test/a5a-*.test.ts)

Test foundation (REUSE, do not reinvent): the P6-T4 control test world — see packages/runtime/test/f9-control-exactly-once.test.ts + packages/runtime/test/p6t4-helpers.ts:
- createP6T4World('a5a-N', ['leader', 'worker']) -> in-memory durable domain with seeded leader+worker instances (P6T4_ROOT, P6T4_SEEDS.leader.instanceId, P6T4_SEEDS.worker.instanceId)
- createP6T4Service(world) -> the REAL ControlService over that world
- humanCaller / leaderCaller / memberCaller fixtures
- A FAKE agent ctx: a tiny double { on(event, listener) { recorded = listener; return () => {} } } — drive the recorded listener with a synthetic exec { callId, name, arguments, agent: undefined, signal: new AbortController().signal } and a spy next that records calls. (The t12a bridge's AgentCtxDouble also records on() if you prefer the richer double.)
- A fake resolver: (path) => Promise.resolve({ key: 'file:///' + normalized(path), display: path }) — deterministic, no real fs. (Keys must be STABLE for the same path.)

Scenarios (at least):
1. allow executes: policy default deny + allow rule (exact key match) for read fileA -> listener returns allow, next called exactly once, ZERO control rows (no request created).
2. static deny zero execution: deny rule exact match -> {kind:'deny'}, next NOT called, no control rows.
3. full ask->allow path: default ask, no rule for write fileC (or an ask rule) -> request created (durable row, kind = leader-approval for a member / user-approval for the leader), the listener PAUSES at awaitControlDecision; the test resolves via service.resolveControl (memberCaller's request resolved by leaderCaller; leader's request resolved by humanCaller) -> the listener returns allow -> next called exactly once; the consumption row exists (exactly-once).
4. ask->deny: resolve with 'deny' -> {kind:'deny'}, next not called.
5. exactly-once: after the allowed execution in 3, a SECOND identical call (same file+content, NEW callId) -> a NEW request (the old one consumed); resolve it with deny -> zero second execution. (This is the allow-once core: same file+payload+new callId = new request; the old approval is NOT reusable.)
6. fingerprint mismatch: an approved write(fileC, 'payload-1'); then write(fileC, 'payload-2') with a new callId -> new request; a stale attempt reusing the old scope (same correlation impossible — new callId; instead assert the OLD decision cannot authorize the new fingerprint by calling guardOperation with the new fingerprint + old scope -> block reason scope-mismatch or the new request stays pending). Pin the exact durable semantics with A4's C-suite semantics.
7. member vs leader routing: member ask -> request kind 'leader-approval'; leader ask -> 'user-approval'.
8. member self-approval forbidden: a member-instance caller resolving its OWN leader-approval request via service.resolveControl -> rejected (existing resolver role set; assert the typed error) — the pending request stays pending.
9. leader self-approval on user-approval forbidden: a leader/instance caller resolving a user-approval request -> rejected (human-only).
10. cancellation: create the ask; abort the exec.signal BEFORE resolution -> the listener settles with deny (abort), next not called; NO unhandled rejection (the test completes cleanly; assert the world's control rows show the request pending + no decision — the request simply stays pending durably, which is acceptable alpha.2 behavior for a cancelled wait).
11. unsupported tool pass-through: exec.name 'web_fetch' (or 'team_send_message') -> next called, zero control rows, no canonicalization (the fake resolver is not called — assert via a call counter).
12. bash tool-level: policy ask lane [{tool bash, resource any}] -> bash exec -> ask (request created, kind by isLeader) -> resolve allow -> executes. bash with NO rule + default deny -> static deny, zero execution, no request.
13. canonicalization failure: the fake resolver throws for a path -> {kind:'deny'}, next not called, no request created. Malformed arguments (missing file_path on a write) -> same (A2's typed failure).
14. pre-aborted signal: signal already aborted + ask decision -> deny without creating a request (your documented choice).
15. disposer: calling the returned disposer makes a subsequent on() registration independent (the double tracks active listeners; after dispose the recorded listener is marked inactive if your double supports it — otherwise just assert the disposer returns the ctx.on result and is idempotent-safe).

## Build + gate (in order, in your worktree)

1. pnpm install --ignore-scripts
2. Focused: node scripts/run-tests.mjs runtime — capture baseline-vs-after; ZERO new failures (documented pre-existing set: the d1/d2/d3/d5 plain-node runner failures + the d5-instance-contract abort — anything new is yours to fix).
3. pnpm typecheck -> exit 0
4. pnpm build + pnpm build:composition; node scripts/check-artifacts-committed.mjs -> exit 0 (rebuild + COMMIT changed dist)
5. p4t6 pin: if the scan count changed (your new test files), update ONLY the pin value + explanatory comment in packages/testkit/test/p4t6-session-event-scan.test.ts (DEC-1; scanner .mjs byte-unchanged). Read the current pin first (it was updated by A1/A2/A3 — build on their numbers).

## Red lines

- CORE PATCH BUDGET = 0: no references/** edits, no upstream edits, no new deps.
- Do NOT touch root.ts / agent-bindings.mjs / host.ts (A6 territory). Do NOT re-implement A2/A3/A4 logic — compose their frozen APIs.
- No push. Commit source + tests + dist + evidence.
- Evidence: dev/agent-workflow/evidence/alpha2-permission/a5/ (report + baseline/after logs + the §10.5 recon finding).
- Working tree ends clean (or only your committed files).

## Report format (final message)

Structured: commits, files changed, exact test command + baseline/after numbers, the adapter export surface verbatim (function name + params shape + return), the §10.5 recon ruling (with the file/line evidence), any deviations, red-line status.
