# DEFECT — C1 fence `runOwned` releases the ownership guard before the awaited operation reaches `agent/created`

> **ARCHIVE NOTE (2026-09-26, Commit 4 re-run round)**: parent accepted the attribution and shipped the fix (branch tip `f3d5a71b` — the parent message quoted the same-tree recommit `a997af3`). This document is preserved unchanged as the defect record. The first (blocked) run's evidence was moved side-by-side to **`first-run-blocked/`** — in particular the decisive in-host observation log referenced below is now at `first-run-blocked/world-A/boot-1/instance.log` (run `11-58-14`); the two diagnostic homes `tests/homes/rst017-c4-2026-09-26T11-42-48-A` + `…T11-58-14-A` are retained in place.

- **Commit 4 (0.1.7 real-host restart regression kit) — blocking product defect, reported as-is per §17.16 (no bypass, no assertion downgrade). Parent adjudication required.**
- **Build under test**: task branch `task/team-restart-017rc1` @ `61419de337f2bec6f17abe7b4ca6750ce26cfb92` (accepted Commit 3; source AND committed dist both carry the defect — no build drift).
- **Host**: 0.1.7-rc.1 @ `46a7f68b09` (pristine test-use), fresh home, world A boot 1 (phase `create`).
- **First observed**: Commit 4 run 1 (`2026-09-26T11-42-48`, `world-A/setup-failure.json`); reproduced 5× on fresh homes (`11-48-34`, `11-49-18`, `11-51-27`, `11-56-46`, `11-58-14`).

## Symptom

Every fresh-home boot of the installed plugin fails during bootstrap:

```
[dsh-agent-team] bootstrap FAILED: TeamSessionActivationInterceptedError:
  dsh-agent-team: intercepted foreign Agent activation for Team-managed session "session-rst017c4-boot-<stamp>"
```

- p6t6 latches `setupError` = the same message → kit boot gate FATAL.
- The passive fence probe records exactly ONE `agent/created` for the boot root (`source:"startup"`) followed by the exact-generation `agent/disposed` 21 ms later (`world-A/boot-1/probe-events/fence-probe-events.jsonl`) — i.e. the vetoed create is the glue's OWN boot-root create, rolled back by upstream 0.1.7's `agent/created` veto → rollback → `agent/disposed` chain (guide §8, behaving as designed).
- **World-independent**: the failure occurs in bootstrap (before any world flow). All kit worlds (A–E) start with a fresh-home phase-`create` boot → identical signature. World C (the ordinary non-regression control) therefore cannot be evaluated under 61419de.

## Root cause (settled with in-host observation, zero product modification)

`runOwned` in `packages/runtime/src/plugin/team-session-activation.ts` (L407–424, identical in the committed dist `packages/runtime/dist/.../team-session-activation.js` L235–256) is a **synchronous** function:

```ts
runOwned<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
  const sid = String(sessionId)
  if (closed) { return Promise.reject(new TeamSessionActivationClosedError()) }
  ownedDepthBySession.set(sid, (ownedDepthBySession.get(sid) ?? 0) + 1)
  try {
    return operation()          // ← NOT awaited
  } finally {
    // decrement runs SYNCHRONOUSLY the moment operation() returns its promise
    const next = (ownedDepthBySession.get(sid) ?? 1) - 1
    if (next === 0) ownedDepthBySession.delete(sid)
    else ownedDepthBySession.set(sid, next)
  }
}
```

`finally` executes immediately when `operation()` returns its (pending) promise — i.e. after the **synchronous prefix** of the operation, NOT after its awaited lifetime. The guard is therefore held only for the sync prefix.

In the real 0.1.7 host, the glue's operation is `agents.create({sessionId, meta, setup})`. The public create chain (`packages/core/agent/lib/index.js:451 AgentRegistry.create` → `agent-loop/lib/index.js:1810 createAgent` → `1837 setupAndPublish` → `1861 initializeAgent` → `835 runMaintenance` → `1711 publish` → `agent/lib:572 announce` → **`ctx.serial(carrier, "agent/created", ...)`**, cordis `serial` = ordered, AWAITED listener dispatch) reaches the `agent/created` seam only **after multiple awaited hops** (`createStoredSession` → `setup` → `publish`) — long after the synchronous `finally` deleted the guard.

Fence decision at the seam (`beforeAgentCreated`, L266+): owner classified (resolver bound), `ownedDepthBySession.get(sid) === 0` (guard already released), no permit → **foreign branch → veto** of the Team's OWN activation.

### Decisive in-host evidence (run `11-58-14`, hook `diag-hook-c4.mjs`, `world-A/boot-1/instance.log`)

```
[c4diag-host] apply() entry #1                                  ← exactly ONE apply()
[c4diag-host] fence created #1 id=F1                            ← exactly ONE fence instance
[c4diag-host] bindOwnershipResolver called (fence #1)
[c4diag-017] AgentRegistry.create sessionId=session-rst017c4-boot-... CALLER-STACK:
    at Object.apply (cordis:120:36)                             ← the `agents` service proxy
    at agent-bindings.mjs:912:14                                ← createTeamAgent → agents.create
    at Object.runOwned (team-session-activation.js:241:24)      ← the guard IS on the stack
    at runOwnedActivation (agent-bindings.mjs:881:36)           ← fence-present branch
    at createTeamAgent (agent-bindings.mjs:911:18)
    at agent-bindings.mjs:2604:19                               ← boot() boot-root create
    at Object.boot (agent-bindings.mjs:2687:7)
    at Object.boot (root.js:1626:20)
    at async bootstrap (host.js:1279:13)
[c4diag-fence] beforeAgentCreated sid=... owner=... ownedDepth=0 permits=0 closed=false fenceId=F1 fenceMapAddr=M1
[c4diag-fence] VETO sid=...
```

The guard (`runOwned`, fence F1, same `ownedDepthBySession` map `M1`) was on the call stack when `agents.create` started, yet the fence's own `beforeAgentCreated` (same instance F1) reads `ownedDepth=0` at the seam — exactly the sync-`finally` release, nothing else.

### Ruled out (evidence)

- **Kit bug**: install S0–S3 pass; bare-clone tip == 61419de; installed dist byte-identical to worktree dist (`cmp`); probe rows passive + row-first; the veto wording is the production fence's exact string; the rejection propagates through bootstrap's awaited chain.
- **Two fence instances / double apply()**: diag shows ONE `apply()` entry, ONE `fence created`, one `fenceId=F1` on both the guard stack and the vetoing listener; one `remote mount: MOUNTED`, one skill registration.
- **Glue without fence (fallback direct create)**: caller stack shows `runOwnedActivation` → `runOwned` in the chain; dist glue wrapper present (4× `runOwnedActivation`, all 8 call sites wrapped); dist host passes `activationFence` (host.js:1047).
- **sid mismatch**: probe `agentId === sessionId`; fence log sid == guard sid.
- **0.1.7 upstream re-adoption**: fresh home, single create event, rejection inside the plugin's bootstrap; the `source:"startup"` tag is the glue's own public-create path (`createAgent → setupAndPublish(..., "startup", ...)`).
- **Fence unit semantics broken in general**: isolated repro against the actual dist module (`fence-semantics-repro.mjs`) shows owned-activation PASSES, foreign REJECTS with exact wording, ordinary PASSES — when the decision point sits in the operation's synchronous prefix (which is how the unit tests exercise it).

### Why the unit tests missed it

`packages/runtime/test/team-session-activation.test.ts` A3/A4 (and the isolated repro) use operations of the shape `async () => { await fence.beforeAgentCreated(...) }`. `beforeAgentCreated` is `async` but has **no internal await before its classification** — its body executes fully inside the synchronous prefix of `operation()`, i.e. inside the broken guard's lifetime. The real host shape — `agents.create` with the `agent/created` seam reached only after awaited hops (`createStoredSession` → `setup` → `publish` → `announce` → `serial`) — is not exercised by any fence unit test. (Test A4's "inner completion never clears the outer guard" assertion is likewise only true within sync-prefix semantics.)

## Fix (for parent adjudication — NOT applied by this round; no bypass attempted)

Make `runOwned` hold the guard across the operation's full awaited lifetime:

```ts
async runOwned<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
  const sid = String(sessionId)
  if (closed) return Promise.reject(new TeamSessionActivationClosedError())
  ownedDepthBySession.set(sid, (ownedDepthBySession.get(sid) ?? 0) + 1)
  try {
    return await operation()   // ← await: guard held until the operation settles
  } finally {
    const next = (ownedDepthBySession.get(sid) ?? 1) - 1
    if (next === 0) ownedDepthBySession.delete(sid)
    else ownedDepthBySession.set(sid, next)
  }
}
```

- Nested-guard semantics (A4's intent: inner completion leaves the outer guard at 1) are preserved under `await`.
- A regression test with the real host shape is required: `runOwned(sid, async () => { await delay(0); await fence.beforeAgentCreated({agent:{id:sid}}); })` must PASS (currently VETOes), plus the foreign-after-settle and nested variants.
- Rebuild dist + committed artifacts, re-run the Commit 4 kit (A–E + 20× race) — the kit, probe, and gate are ready and were not the cause of any failure.

## Severity

**Fatal for the 0.1.7 live path**: fresh homes cannot bootstrap (boot 1 of every world FATAL), and returning homes hit the same veto via `resumeTeamAgent` (same `runOwnedActivation` → same release; `beforeAgentCreated` does not distinguish `source`). The committed 61419de build cannot bring a Team root live on any home. The C1 fence that exists to protect Team sessions currently vetoes all of the Team's own activations.

## Commit 4 status consequence

- Worlds A–E: **blocked at boot 1** (identical signature; World C run pending as the empirical second-world data point).
- §13.6 assertion lists, gate-5 live closure, 20× race stress: **unevaluable** under 61419de.
- §17.16 deterministic green gate: **cannot be green** until the fix lands; reported as-is, parent adjudicates.
