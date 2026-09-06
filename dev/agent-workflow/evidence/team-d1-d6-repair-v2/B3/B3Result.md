# B3 — D4-A1: existing Team UI mutation callbacks refresh the projection (v2)

- task_id: B3 (Wave B, Team D1-D6 repair v2; plan `docs/plans/active/TEAM_D1-D6_REPAIR_PLAN_V2.md` §1.4 D4-A1)
- model_route: qiyuan-self/qwen3.8-27b (verified at session start: runtime persona declares `qwen3.8-27b`; `C:\Users\user\.dsh\settings.yaml` `agent-default-model` = provider `qiyuan-self` / model `qwen3.8-27b`)
- branch/worktree: `task/team-d1-d6-v2-B3` / `.worktrees/team-d1-d6-v2-B3`
- base_sha: 0b968d7cd8c913ee7eb8cf714f0640f8ddcbbba4
- attempt: 1
- scope: EXISTING Team UI mutation callbacks only — each now refreshes the projection via the existing `pullProjection()` (the generation-safe store pull). NO new cross-layer signal, no push, no events, no polling, no remote/host changes (that is D4-A2, design-only, out of scope).

## Model-route verification (ROUTER_RULES §1.4)

- Runtime declaration (persona, resolved at session start): "You are a coding agent powered by the **qwen3.8-27b** model".
- Deployment default agent route (`C:\Users\user\.dsh\settings.yaml`, `agent-default-model`): provider `qiyuan-self`, model `qwen3.8-27b`; no override in the session header or preset.
- **Route verified: `qiyuan-self/qwen3.8-27b`** — matches the required route.

## Audit — ALL Team UI mutation callbacks (requirement 1)

The full set of UI-initiated Team mutation callbacks on the P9/T8 client surface, audited in the worktree at base `0b968d7`:

| # | UI mutation callback | Lane (file:line at base) | Pulled via `pullProjection` pre-fix? | B3 action |
|---|---|---|---|---|
| 1 | member create | `TeamMembers.tsx` dispatch success lane (:407) | ✓ | unchanged (already covered) |
| 2 | member send | same | ✓ | unchanged |
| 3 | member followup | same | ✓ | unchanged |
| 4 | member archive (via `TeamConfirmDialog` `[data-member-confirm-ok]`) | same | ✓ | unchanged |
| 5 | member restore | same | ✓ | unchanged |
| 6 | member dispose (via confirm dialog) | same | ✓ | unchanged |
| 7 | governance reprobe | `TeamGovernance.tsx` dispatch success lane (:219) | ✓ | unchanged |
| 8 | governance policyStateSet | same | ✓ | unchanged |
| 9 | governance overrideSet | same | ✓ | unchanged |
| 10 | governance overrideReset | same | ✓ | unchanged |
| 11 | governance compatibility.ack | `TeamGovernance.tsx` — action UI-disabled (wire gap: no client success callback exists to hook) | ✗ (no existing callback) | **listed, NOT built** → D4-A2 input (enabling the ack action + its callback is new UI, outside "existing callbacks") |
| 12 | standard create flow (`team.create` v2 → `openCreatedSession` → `team.admitInitialWork` v2) | `TeamCreationPanel.tsx` `runCreate` success lane | ✗ **GAP** (only the new session's TeamView cold-pull) | **FIXED**: pull exactly once on `{ ok: true }`, targeting the NEW team's id (invariant 9: minted Root id IS the TeamSession id) |
| 13 | `handoff.create` → stored state `completed` | `TeamCreationPanel.tsx` `invokeHandoffCreate` | ✗ **GAP** | **FIXED**: pull exactly once after `openCreatedSession(rootSessionId)` |
| 14 | `handoff.create` → stored state `completed-without-handoff` | same | ✗ **GAP** | **FIXED** (same lane as #13) |

Deliberately NO pull (reads / non-mutations, unchanged): `catalog.list`, `catalog.get`, `intent.probe`, `agentPresets.list`, `legacyInspect`, `compatibility.get`, `policyState.get`, `override.get`, `handoff.prepare`, ledger `refreshTeamLedger` retry, and the TeamView mount cold-fill (`ensureProjection` — single-flight mirror backfill; remains the backstop after the explicit pull). `handoff.create` non-terminal stored states (`awaiting-decision` — no team exists under the token yet, `creation-failed`, `canceled`) and all typed/transport failures: never pull (G5 discipline).

Stop condition check: every UI mutation path has an existing client-side success callback to hook, EXCEPT #11 (compatibility.ack — UI-disabled wire gap, listed as D4-A2 input, not built). No other stop condition triggered.

## Boundary statement (requirement 4)

**D4-A1 covers UI-initiated mutations only.** Agent/tool-originated mutations (agent-driven member actions and any host/remote write that does not pass through one of the React command callbacks above) are **NOT** covered by this task: they bypass every UI callback and leave the client projection stale until the existing backstops fire (connection-generation rebaseline pull, or the next `ensureProjection` cold-fill on mount, or F5). The design of a cross-layer mutation-invalidation signal for those sources is **D4-A2 (design-only, not started here)**. This task is therefore NOT "full live projection"; it closes the F5 gap for mutations the user performs in the Team UI, using the existing generation-safe pull only.

## Implementation (minimal, additive — 4 product files)

1. `packages/client/src/ui/TeamCreationPanel.tsx` — new optional prop `pullProjection?: (teamSessionId: string) => Promise<unknown>`; `runCreate` success lane: `void pullProjection?.(snap.rootSessionId)` before `onCreated?.()` (exactly once per terminal success, never on failure); `invokeHandoffCreate`: `void pullProjection?.(state.rootSessionId)` after `await openCreatedSession(...)` for `completed` / `completed-without-handoff` only. Fire-and-forget is safe: `TeamProjectionStore.pull()` settles typed errors into its own `lastError` and **never rejects** (generation guard: `assessProjectionSync` discards stale frames).
2. `packages/client/src/ui/TeamView.tsx` — `pullProjection` added to `TeamViewInjected` (required, like `ensureProjection`) and passed to the zero-state creation panel.
3. `packages/client/src/ui/NewTeamEntry.tsx` — `pullProjection` added to `NewTeamEntryInjected` (required) and passed to the overlay panel.
4. `packages/client/src/plugin/team-mount-core.ts` — the existing `pullProjection` constant (the generation-safe store pull, `team-mount-core.ts:518-520`) is now also injected into `viewInject` (conversation.view slot) and the `sidebar.footer.action` inject literal (the New Team entry); the S5-B `memberCommands` and S5-C `governance` faces already carried it.

No store changes, no transport changes, no remote/host changes, no new signals. The `pullProjection` prop is optional at the panel boundary, so every existing spec compiles and runs unchanged except the three fixture faces that gained the required mount-level member (additive one-line stubs).

## Tests (TDD — RED first, then minimal implementation, then GREEN)

New spec: `packages/client/test/team-d4-a1-ui-pull.client.spec.tsx` (jsdom, 14 tests) + extended `packages/client/test/client-plugin-mount.test.ts` (scenario E: mount-level wiring — `viewFace.pullProjection` hits the carrier exactly once; concurrent `ensureProjection` stays single-flight; the entry inject exposes the same pull; a typed-error pull never rejects).

Representative gap paths (requirement 3):
- **create-flow (min one)**: terminal success WITH initial work → pull exactly once, arg = the minted `session-…` root AND equal to the opened root (invariant 9 cross-check); create-only success → pull exactly once.
- **lifecycle (min one)**: member archive success → pull exactly once (LEADER id); member dispose typed failure → no pull. (send/followup/restore/create share the same already-covered dispatch lane, #407.)
- **governance command (min one)**: policy commit success → pull exactly once; draft-only edits do NOT pull; policy commit typed failure → no pull.
- **failure discipline**: typed create-stage failure → no pull, no `onCreated`; typed work-stage (admit) failure → no pull; handoff typed response failure / `creation-failed` / `awaiting-decision` → no pull.
- **no double-pull race regression**: the pre-fix "pull exactly once" assertions are the guard — each success path asserts `toHaveBeenCalledTimes(1)` (a second pull from a retried flow or a double success lane would fail them); the existing single-flight behavior of `ensureProjection` is re-asserted in scenario E. (No dedicated pre-existing double-pull race test existed; the exactly-once assertions are its equivalent.)
- **back-compat**: without the `pullProjection` prop the success flow still settles (T7/T8 behavior preserved).

### RED (captured BEFORE implementation)

Command (workdir `packages/client`): `pnpm vitest run test/team-d4-a1-ui-pull.client.spec.tsx test/client-plugin-mount.test.ts`

```
 Test Files  2 failed (2)
      Tests  4 failed | 10 passed (14)

 FAIL  > D4-A1 — standard create flow ... > terminal success (with initial work) pulls the NEW team projection exactly once
 FAIL  > D4-A1 — standard create flow ... > terminal success (create-only, no initial work) pulls exactly once
 FAIL  > D4-A1 — handoff.create ... > a stored `completed` state pulls the NEW team projection exactly once
 FAIL  > D4-A1 — handoff.create ... > a stored `completed-without-handoff` state pulls exactly once
  AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 ❯ test/client-plugin-mount.test.ts:619:18
    619|   await viewFace.pullProjection('t9')
       |                  ^ TypeError: viewFace.pullProjection is not a function
```

Exactly the four gap success paths fail (pull never called); the failure-lane and already-covered lifecycle/governance tests pass pre-fix (correct pre-fix behavior). Full transcript: `red-transcript.txt` (note: an earlier RED run failed on a fixture bug in the new spec itself — `emptyTeamIntentDraft` is a const, not a function — fixed inside the RED phase; the captured transcript is the definitive one).

### GREEN (after the minimal implementation)

Same command:

```
 ✓ test/client-plugin-mount.test.ts (33 tests) 5ms
 ✓ test/team-d4-a1-ui-pull.client.spec.tsx (14 tests) 2263ms
 Test Files  2 passed (2)
      Tests  47 passed (47)
```

Full client suite — `pnpm test` (the package test script, `vitest run`):

```
 Test Files  1 failed | 34 passed (35)
      Tests  1 failed | 526 passed (527)
```

Transcript: `green-transcript-full-suite.txt`. `pnpm typecheck` (tsc): exit 0.

**The single full-suite failure is PRE-EXISTING, not a B3 regression**: `test/team-creation-panel.client.spec.tsx > TeamCreationPanel > create happy path (TCM M4 two-stage v2) …` — the `expect(admitMock).toHaveBeenCalledTimes(0)` assert racing the open→admit microtask boundary. Verified by stashing ALL B3 changes and re-running that spec at base `0b968d7`: it fails identically (`Tests  1 failed | 18 passed (19)`, same test name). Transcript: `base-preexisting-failure.txt`. It is untouched by B3 (the panel change adds only a no-op `void pullProjection?.(...)` on the success lane when the prop is absent) and is out of B3's write scope (fixing it would mean rewriting that test's timing semantics).

## Changed files (1 commit)

- `packages/client/src/plugin/team-mount-core.ts`
- `packages/client/src/ui/NewTeamEntry.tsx`
- `packages/client/src/ui/TeamCreationPanel.tsx`
- `packages/client/src/ui/TeamView.tsx`
- `packages/client/test/team-d4-a1-ui-pull.client.spec.tsx` (new)
- `packages/client/test/client-plugin-mount.test.ts`
- `packages/client/test/new-team-entry.client.spec.tsx` (fixture face +1 member)
- `packages/client/test/team-legacy.client.spec.tsx` (fixture face +1 member)
- `packages/client/test/team-view.client.spec.tsx` (fixture face +1 member)
- `dev/agent-workflow/evidence/team-d1-d6-repair-v2/B3/B3Result.md` (new)
- `dev/agent-workflow/evidence/team-d1-d6-repair-v2/B3/red-transcript.txt` (new)
- `dev/agent-workflow/evidence/team-d1-d6-repair-v2/B3/green-transcript-full-suite.txt` (new)
- `dev/agent-workflow/evidence/team-d1-d6-repair-v2/B3/base-preexisting-failure.txt` (new)

Write scope honored: owned client files + client test files (extending existing patterns) + B3 evidence only. No upstream touch, no host instance, `:3080` / `D:\deepseek-harness` / `references/` untouched.

## TaskResult

- task_id: B3
- attempt: 1
- model_route: qiyuan-self/qwen3.8-27b
- elapsed_minutes: 21 (01:16:02 → 01:37 +08:00, within the 45-min timebox)
- base_sha: 0b968d7cd8c913ee7eb8cf714f0640f8ddcbbba4
- head_sha: the single commit of `task/team-d1-d6-v2-B3` on top of base (this file is inside that commit, so it cannot embed its own hash; the exact sha is carried in the task's structured_output `commit_sha`)
- changed_files: see "Changed files" (9 product/test files + 4 evidence files)
- tests_run: `pnpm vitest run test/team-d4-a1-ui-pull.client.spec.tsx test/client-plugin-mount.test.ts` (RED, then GREEN: 47/47) + `pnpm test` full client suite (527 tests) + `pnpm typecheck`
- tests_passed: new/extended: 47/47; full suite: 526/527 (the 1 failure is pre-existing at base — see "GREEN"); typecheck: clean
- verdict: PASS — D4-A1 complete: every EXISTING Team UI mutation callback now refreshes the projection via the existing `pullProjection()` on success (create flow + handoff.create gaps fixed; member/governance commands already covered and re-verified); failure lanes never pull; no double-pull regression.
- blocker_type: none
- remaining_risks: (1) Agent/tool-originated mutations remain stale until the existing backstops — D4-A2 design item (this is the intended boundary, not a defect); (2) `compatibility.ack` has no existing client callback (UI-disabled wire gap) → D4-A2 input, listed not built; (3) one pre-existing full-suite timing failure in `team-creation-panel.client.spec.tsx` (present at base, unrelated) should be fixed in a separate client task.
- commit_sha: (written by the committing step)
