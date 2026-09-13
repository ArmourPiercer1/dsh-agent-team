# multi-MCP Task C — Phase 2 GREEN evidence (B-inclusive int tip)

- **Base (post-rebase)**: `bfc7693` = int/multi-mcp-quick-fix tip at GREEN
  time (M2b: Task D merged). B's I4 pick = `2d44809` (src) / `00a925b`
  (evidence) under it; parent-announced tip `b89021f` (M2a) is its
  direct parent. C commit re-based: `3bb5fa6` → `917b761` (RED artifacts)
  → phase-2 commit on top.
- **Date**: 2026-09-12 (session time 18:33 UTC-local)

## Gate A — the 8-file focused set (plan §7 / c-tests.md phase 2 Must-2)

Command (worktree root):
```
pnpm vitest run \
  packages/runtime/test/multi-mcp-wiring.test.ts \
  packages/runtime/test/t4a-capability-wiring.test.ts \
  packages/runtime/test/t12a-h1-nullable-mcp.test.ts \
  packages/runtime/test/t3-skills-mcp-adapter.test.ts \
  packages/runtime/test/p8s4b-mcp-facet.test.ts \
  packages/runtime/test/t12a-b3-external-deny.test.ts \
  packages/runtime/test/a2c2-permission-coverage.test.ts \
  packages/runtime/test/mcp-supply-config.test.ts
```

| file | tests | result |
| --- | --- | --- |
| multi-mcp-wiring.test.ts | 47 | 47/47 GREEN (was 33 failing on RED base) |
| t4a-capability-wiring.test.ts | 27 | 27/27 (unchanged — per-server helpers already; C7 regression pin) |
| t12a-h1-nullable-mcp.test.ts | 7 | 7/7 (H1-4 control now passes on the per-server shape) |
| t3-skills-mcp-adapter.test.ts | 11 | 11/11 |
| p8s4b-mcp-facet.test.ts | 11 | 11/11 (untouched) |
| t12a-b3-external-deny.test.ts | 4 | 4/4 (minimal adaptation green on both RED and GREEN) |
| a2c2-permission-coverage.test.ts | 18 | 18/18 |
| mcp-supply-config.test.ts | 39 | 39/39 (A's surface stable) |
| **total** | **164** | **164/164 — ALL GREEN, 8/8 files** |

Raw log: `green-gate-a-run.log` (this directory).

## Typecheck gates

- `pnpm --filter @dsh-agent-team/runtime typecheck` → **exit 0** (covers
  the new TS test file, the bridge `.d.mts`, and the t12a-b3 cast).
- `pnpm --filter @dsh-agent-team/tools typecheck` → **exit 0**.
  NOTE (report item): the tools tsconfig includes only `src`/`test`/
  `vitest.config.ts` — `packages/tools/harness/plugin.mjs` (the I5
  edit) has NO typed surface in this package; the syntax gate for it is
  `node --check` (passed) + the shape-defensive read (I5 block reads
  `views.mcpViews` / `state.mcpFibers.has` / `state.mcpActivationErrors.get`
  with object/Map guards, so the pre-B singular state degrades to
  `mcp: { servers: {} }` instead of crashing).

## One test-side fix during GREEN (NOT an assertion loosening)

First GREEN run: 163/164. The single failure was W1 6.1 "leader
mcpFibers keys = [A,B]" reading `[]`. Diagnosis (probe world + reading
B's glue): B's `close()` (agent-bindings.mjs L2782–2785) disposes AND
**clears** `state.mcpFibers`; my W1 deliberately runs `w1.binding.close()`
at module top level (the 6.10 dispose-count pin), so the live state
reference was legitimately empty by assertion time. Fix: capture a
PRE-CLOSE snapshot of the fiber keys (`w1LeaderFiberKeysBeforeClose`,
taken right after boot) and assert against it — the asserted value is
UNCHANGED (`[A, B]`), only the observation point moved before the
deliberate close. No B behavior was deviating from I4; I4's state
contract governs the live set during operation, and close-clearing is
B's documented disposal path.

Companion type-surface updates (all C-owned files, no behavior change):
- `t12a-live-bridge.d.mts`: `resolveConsumptionViews` return type updated
  to the I4 shape (`mcpViews` Record replaces the deleted singular
  `mcpView`); added the two public glue members the new test drives —
  `getConsumptionState(sessionId)` and
  `prepareAgentForRequest(sessionId, teamRootSid)`.
- `t12a-b3-external-deny.test.ts`: the view cast now goes through
  `unknown` (TS2352) — same read, same assertions.

## B implementation notes — handling

1. **port-null + policy-allow additionally records
   `state.mcpActivationErrors.set(name, msg)`** before throwing: my
   W7b assertions do NOT read `mcpActivationErrors` (they pin the error
   message naming B, the empty live fiber set, and the A-fiber
   rollback) — the extra recording is compatible and needs no test
   change; the I5 harness surface EXPOSES `activationError` conditionally,
   so the recorded port-null error will be visible in diagnostics.
2. **port-null error message = the I4 frozen string, verbatim**
   (`p6t6: the durable policy allows mcp server '<name>' but no mini-MCP
   port is configured (config.mcpServers port for '<name>')`): my W7b
   assertion checks the message contains the failing server name
   (`mcp-beta`) — compatible with the frozen string (verified in B's
   source, agent-bindings.mjs step 4).

No assertion was loosened anywhere; no B/I4 deviation was found —
all 47 matrix assertions pass against B's implementation as written.

## Regression pins preserved from RED

The legacy/zero-MCP controls that passed on the A-only RED base pass
UNCHANGED on the B-inclusive tip (6.2 legacy mounts, 6.3 zero-MCP, 6.4
A-helper, 6.9 resume machinery, 6.11 setup-succeeds, h1 zero-world
cases, t4a 27/27, t12a-b3, p8s4b) — B's per-server reconciler is a strict
generalization of the legacy behavior, as contracted.
