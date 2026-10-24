# C2 短接线说明 — per-run provider closure over the REAL public engine faces (root ruling 2026-10-25, no upstream change)

All faces measured at the pristine baseline (`tests/deepseek-harness-test-use`):

1. **Public engine entry**: `ctx.workflowEngine.start(request)`
   (tool-workflow/src/index.ts **:282** foreground, **:433** background —
   the ONLY consumer face; inject list :41 `['tools','workflowEngine',
   'systemPrompt']`).
2. **Per-run override IS public**: `WorkflowStartRequest.subagentProvider`
   → `resolveSubagentProvider(ctx, this.config.provider,
   request.subagentProvider)` (workflow-ptc/src/index.ts **:136**); the
   override beats the fixed config; name must be a non-empty normalized
   string (**:67/:71**). → The Team adapter sets a UNIQUE per-run name per
   start call; nothing upstream is touched.
3. **Real close/reclaim faces**: `WorkflowRun` (runtime-types.ts **:40-48**)
   = `{ id, meta, result: Promise<WorkflowResult>, cancel(reason?),
   dispose(): Promise<void> }`. The background path's OWN law proves the
   reclaim point: `run.result.then(async () => { await run.dispose() })`
   (:433 path) — the outer tool returns a JobHandle LONG before; so the
   per-run closure UNREGISTERS exactly when `run.result` settles (mapped,
   then dispose), NEVER at the outer return. Foreground: `finally`-side
   dispose likewise.
4. **Registration face (public)**: `subagents.registerProvider(name,
   provider)` → disposer (host subagents :512-527). Per-run closure is
   registered before `start` and disposed by the settle hook; collision →
   typed refuse (already implemented in the arm).
5. **Per-run correlation**: the closure CAPTURES this admitted call's REAL
   `exec.token` (the governedTokenLedger single-flight identity,
   team-tool-plane :2017-2027/:2885) — no ALS, no signal identity, no
   parentAgent WeakMap. PA plan keys ride the captured token.
6. **C1 settlement inside the closure**: activation-committed facts only
   (`rootSessionId`, the admitted member's durable `instanceId` via
   `durableMemberInstance` — never invented), the REAL `workDelivery`
   port (agent-bindings :8011 consumer: prepare → followup
   `[team-work requestToken=…]` → whenIdle → ensureMaterialized →
   readDeliveredWorkTurn), and `mapWorkDeliveryResult` (landed this round:
   succeeded+non-empty body → completed ContentBlocks; failed/
   unavailable/unknown NEVER success; token echoed, never re-mapped;
   unbound settlement refuses BEFORE creation).
7. **Feature preservation**: the row passes script/meta VERBATIM into the
   start request (原参数), foreground/background paths, cancel (engine's
   own run.cancel/signal propagation reaches the delivery's abort arm —
   measured in the consumer), result mapping above; no permission
   widening (restricted lane unchanged).
8. **ralph independent seam**: ralph resolves its provider from the FIXED
   plugin config (resolveSubagentProvider's `configured` lane, :136's
   `this.config.provider`) — mounted with its OWN registered closure name
   at plugin mount; the workflow per-run override never impersonates or
   shadows it (unique names, separate registration, collision refused).

Safety block (`CHILD_GOVERNANCE_FAIL_CLOSED`) stands until this wiring's
real supply lands end-to-end; unblocking is root's call at that point.
