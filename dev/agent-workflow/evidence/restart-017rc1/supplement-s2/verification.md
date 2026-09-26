# Supplement S2 — host/root contract (PR #31 supplemental fix guide, §2/§4.3/§4.4)

Worktree: `.worktrees/team-restart-017rc1`, branch `task/team-restart-017rc1`, on S1 `58d30de`.
Review baseline = PR #31 head `449e1fc`; base master @ `7c23610`. CORE PATCH BUDGET = 0 (zero upstream changes).

## Changes

1. **`packages/runtime/src/plugin/host.ts`** — production activation-fence surface completeness check.
   After `createTeamSessionActivationFence()` and BEFORE any listener registration (same apply
   synchronous prefix): the 11 required fence methods
   (`runOwned, beforeAgentCreated, claimOwnedGeneration, releaseOwnedGeneration,
   onAgentDisposed, awaitRollback, getRollbackEpoch, recoverWriterConflict,
   permitOrdinaryOnce, bindOwnershipResolver, close`) must all be functions, else apply fails
   fast with `TeamPluginError(TEAM_PLUGIN_GLUE_UNAVAILABLE)` (existing code — no new error code).
   Closes the S1-era exposure where a fence object missing part of its surface would silently
   degrade host protection instead of failing at composition time.

2. **`packages/runtime/src/plugin/root.ts`** — `createS6RemoteSurfaces` options: the
   `prepareOrdinaryOpen` port is now a CONDITIONAL spread. Before this round the port object
   always existed (`live.allowOrdinaryActivationOnce?.(sid)` → no-op when the armer was absent)
   and the wire answered `{ rootSessionId, permitted: true }` while arming NOTHING — a FAKE
   SUCCESS (guide §2.4, the contract defect). Now: the port is exposed IFF
   `typeof live.allowOrdinaryActivationOnce === 'function'` (i.e. the host installed a glue
   carrying the fence — the armer is exposed on `agent-bindings.mjs` exactly when the
   `activationFence` dep is present). Absent armer → the s6-remote handler's existing typed
   fail-closed `TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE`. Remote contract stays v5
   (`prepareOrdinaryOpen` is a v5 catalog method; NO v6 bump).

3. **NEW `packages/runtime/test/team-session-startup-fence.test.ts`** (H1/H2, guide §4.3) —
   two-phase one-medium world: phase 1 full `hostEntry.apply` (bootPhase `create`, ungated
   seam) boots a TeamSession and closes its root; phase 2 `apply` with a GATED seam
   (`open` awaits a release promise) at bootPhase `create-or-open` — the apply call is NOT
   awaited: the synchronous prefix has registered the `agent/created` listener while the domain
   open hangs on the gate (the startup window: resolver not yet bound, ownershipReady not
   settled). Drives the created listener directly:
   - H1 (root SID, `source: 'resume'`): the activation PENDING does not settle in a 150 ms
     window (no pass before ownershipReady) and, after the gate releases + apply settles,
     rejects with the TYPED `TeamSessionActivationInterceptedError` (Team-managed, no claim,
     no permit — the veto);
   - H2 (ordinary SID, `source: 'startup'`): pending in the window (never passes BEFORE the
     barrier), then PASSES as unmanaged after bind.
   4/4 green. No sleep/backoff (the window probes are bounded settle-checks over captured
   promises; the gate release is a test-controlled promise).

4. **`packages/runtime/test/d2-s6-ensure-root-live.test.ts`** — R6a/R6b (guide §4.4): the
   PRODUCTION root wiring (`createTeamProductionRoot` over a real TeamSession row + stub glue,
   wire-driven through the registered remote dispatcher with the v5 version envelope):
   - R6a (stub glue WITHOUT the armer — the production stub has no fence deps, so
     `allowOrdinaryActivationOnce` is absent): `team.prepareOrdinaryOpen` →
     `{ok:false, error.code = TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE}` — NEVER
     `{permitted: true}` (the pre-round fake success is gone at the root level);
   - R6b (stub glue WITH a recording armer): → `{ok:true, value.data =
     {rootSessionId, permitted: true}}` and the armer was called EXACTLY once with the root
     SID. 20/20 green (18 pre-existing + 2 new).

5. **`packages/runtime/test/team-session-activation-glue.test.ts`** — §2.5 补测 G11/G12:
   - **G11 — the genuine ordinary owner (explicit permit then live) is still OUTSIDE_TEAM.**
     `fence.permitOrdinaryOnce(root)` (the `team.prepareOrdinaryOpen` host path) → the raw
     ordinary `agents.resume` of the Team-managed root PASSES (permit consumed) and goes live
     post-announce (it takes the writer). The permit pass mints NO rollback record (a pass is
     not a veto — `getRollbackEpoch` stays 0). The Team's `ensureLiveAgent` resume then hits
     the (scripted) typed writer-held rejection: `recoverWriterConflict` CANNOT confirm a
     handoff (no qualifying rollback after the baseline, bounded 50 ms window) → the ORIGINAL
     `SessionAlreadyOwnedError` propagates BY IDENTITY, NO retry, the Team installs NO live
     handle (no silent adopt), and the one-shot permit stays consumed (a second ordinary
     activation of the same root is vetoed again with
     `TeamSessionActivationInterceptedError`). This is the error the s6 mapping turns into
     OUTSIDE_TEAM — a genuine ordinary owner is never stolen.
   - **G12 — the Team-vs-Team race never ends OUTSIDE_TEAM.** Two CONCURRENT
     `ensureLiveAgent` callers for the same cold SID: the single-flight map yields ONE
     in-flight activation (one resume); the joiner receives the first caller's non-writer-held
     setup failure BY IDENTITY. The rejection matches NONE of the s6 mapping's OUTSIDE_TEAM
     tiers (not the typed `SessionAlreadyOwnedError`/`session/writer-held` markers, not the
     `^agent ".+" is already registered` registry-collision prefix, not the "already owned by
     an active write handle" compatibility message) — it lands in START_FAILED (tier e). The
     OUTSIDE_TEAM code stays reserved for a genuine ordinary owner.
   - §2.5 items 3+4 were already covered (verified, no new tests): foreign unknown root stays
     FOREIGN_TEAM = d2 R3 + the ensureRootLive bound-root guard; the missing ordinary-permit
     port stays typed unavailable = R4 complement (port level) + R6a (root level).
   18/18 green (G1–G10 + G11 + G12 + the two §6.2 static assertions).

## Verification battery

| Check | Command (all in the worktree) | Result |
| --- | --- | --- |
| Affected suites | `cd packages/runtime && npx vitest run test/d2-s6-ensure-root-live.test.ts test/team-session-startup-fence.test.ts test/team-session-activation.test.ts test/team-session-activation-glue.test.ts` (clean `.tmp-fault` in the same command) | 58/58 green (4 + 16 + 18 + 20) |
| Typecheck | `cd packages/runtime && npx tsc --noEmit -p tsconfig.json` | exit 0, zero output |
| Dist build | `pnpm --filter @dsh-agent-team/runtime build` | exit 0; diff = `host.js`/`root.js` + their `.d.ts.map`/`.js.map` only (the two changed modules); both S2 constructs verified present in the compiled output |
| Full runtime suite (S2 tree, run 1) | `npx vitest run` (clean scratch, same command) → `full-runtime-suite-s2.log` | 11F/2211P: debt set + p6t1-parallel P2 (1F) |
| Full runtime suite (S2 tree, run 2) | same → `full-runtime-suite-s2-rerun.log` | 11F/2211P: debt set + p6t1-parallel P3 (3F) |
| Full runtime suite (S1 HEAD control, x3) | `git stash push -u -- <5 S2 files>` → tree = `58d30de` → `npx vitest run` x3 (clean scratch each) → `full-runtime-suite-S1HEAD{,-r2,-r3}.log` → `git stash pop` | 3/3 runs: exact debt set (8F/2206P x2; 10F/2204P x1 = debt + **p6t1-parallel P1 2F on run 3**) |
| p6t1-parallel standalone (S2 tree) | `npx vitest run test/p6t1-parallel.test.ts` (clean scratch) | 9/9 green |

### p6t1-parallel triage (the only delta vs the debt baseline)

- Debt baseline (post-S1, verified): 6 failed files / 8 failed tests — `p6t3-mediation` 5F,
  `p6t3-restart` 2F, `d3-member-identity-context` D3-4 1F, file-level `p8s3b-result-effects`,
  `t12a-b2-child-identity`, `t12a-glue-handoff-ports`.
- Every full-suite run in this battery (S2 x2 + S1 HEAD x3) reproduced that debt set
  EXACTLY (same test names), plus a load-flapping `p6t1-parallel` failure in 3 of 5 runs:
  S2-r1 = P2 (1F: "five activated results…" `errors.length` 3≠0), S2-r2 = P3 (3F: the
  quota-race expectations), S1-r3 = P1 (2F: both P1 assertions).
- `p6t1-parallel` passes standalone (9/9) and its world is built on
  `createActivationProvider` (provider level) — it never calls `hostEntry.apply` nor
  `createTeamProductionRoot`, so it is CODE-PATH ORTHOGONAL to both S2 changes (host.ts
  surface check, root.ts conditional port).
- The flake reproduces on S1 HEAD under full-suite load (S1-r3) → **PRE-EXISTING load-sensitive
  flake in the P6-T1 parallel-admission timing** (same family as the F7-1/F-rc2 load flake
  recorded for this branch and for PR #30's master baseline), NOT an S2 regression.
- Verdict: zero NEW DETERMINISTIC failures from S2. The p6t1-parallel flake is recorded here
  and will be mentioned in the S6 final PR body (known-flaky list) as a follow-up.

## Red-line compliance (guide §8 + standing)

- No session.lock deletion, no sleep/backoff, no while-retry in production code (G11's 50 ms
  is the pre-existing `writerHandoffTimeoutMs` world option of the bridge double — the fence's
  own bounded window, exercised as designed).
- No substring-only writer authority (typed markers first; the compatibility message stays the
  LAST fallback tier — untouched).
- No silent adopt (G11 pins it: the permitted ordinary owner is never taken over; the Team
  ensure fails with the original typed error).
- `ownedDepth` is not PASS authority anywhere (S1 core; untouched by S2).
- No physical DSH_HOME scanning, no DOM hack, no private store, no reload repair.
- No upstream modifications (CORE PATCH BUDGET = 0); Remote contract stays v5 (no v6 bump).
- `:3080`/`:3180` untouched (probe-only standing rule); test-use pristine @ 46a7f68b untouched.
- Scratch discipline: `.tmp-fault` removed in the same command as every suite run.

## Next

S3 — client same-page characterization (EVIDENCE ONLY; guide §3.2 five questions →
GO/NO-GO; no B+ before an empirical NO-GO).
