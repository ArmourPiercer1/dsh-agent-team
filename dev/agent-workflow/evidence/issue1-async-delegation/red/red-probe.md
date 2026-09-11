# Issue #1 — RED evidence (plan §20 RED-1)

**Captured on**: task branch `task/issue1-async-delegation`, base `master @ 27a6c36` (0.1.1-alpha.2 frozen), before ANY behavior change.
**Note on the exact tree state**: the only source delta present at capture time is the TYPE-LEVEL optional `execution` field on `TeamRuntimeActionRequest` (`packages/runtime/admission/types.ts` — erasable TS, zero runtime impact; the RED probe never passes the field, so it executes the byte-identical alpha.2 sync path).

## Probe

- Test: `packages/runtime/test/issue1-serial-blocking.test.ts`
- Runner: `pnpm vitest run issue1-serial-blocking` from `packages/runtime` (vitest 4.1.11, Node v24.20.0)
- Controlled fake `WorkDeliveryPort`: delivery per requestToken held at a gate; start timestamps recorded.

## Result (PASS 3/3 on the unmodified tree)

```text
[issue1 RED] timeline={"aDeliveryStart":1789115197190,"aCompleted":1789115197284,"bDeliveryStart":1789115197288,"bCompleted":1789115197295} leaderBlockedWhileAdeliveryInFlight=true

 ✓ test/issue1-serial-blocking.test.ts (3 tests) 2ms
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

## Proven old-design facts

1. **The leader's first `team_delegate` promise stays unresolved while its member's delivery is in flight** (`leaderBlockedWhileAdeliveryInFlight = true` after 75ms of in-flight delivery) — the leader's model context is blocked (router.ts L155 `await staged.complete()`).
2. **B's delivery starts only after A's delivery completed**: `bDeliveryStart (…288) >= aCompleted (…284)` — the leader could not even issue B before A returned; total ≈ T_A + T_B (serial), not max(T_A, T_B).
3. **The CCR-1 pin (sync default result)**: the awaited result still carries `memberResult` (succeeded + business body) with `settled: true` — the v2 D2 contract the repair must preserve for the sync path.

## Post-fix role

This file becomes the CHARACTERIZATION/regression pin for the preserved sync default (CCR-1): it must keep passing after the async mode lands (it never uses the new surface).

## Environment note (recorded per TEST_METHODS §5 precedent)

Real `vitest run` fails in the current workspace-write sandbox at config load: vite 8.2.2's `windowsSafeRealPathSync` first-run probe `exec("net use")` → `spawn EPERM` (the sandbox denies node-initiated piped-stdio child spawns; the error is thrown synchronously, not delivered to the exec callback). Workaround applied to the DISCARDABLE worktree `node_modules` only (gitignored, never repo/upstream source): the single `exec("net use", { windowsHide: true }, …)` probe in `node_modules/.pnpm/vite@8.2.2_…/vite/dist/node/chunks/node.js` is disabled by a local guard flag (`__dshSandboxNetUseDisabled`) — it only feeds a Windows network-drive mapping cache, irrelevant to local paths. Repo files untouched. The `scripts/run-tests.mjs` plain-node shim cannot replace vitest for the full gate: committed suites (e.g. `d5-instance-contract.test.ts`) use the real-vitest-only matcher surface (`toHaveLength`, `not.toContain`) and async `it`, which the shim's audited surface does not support (it crashes the shim runner on such files).
