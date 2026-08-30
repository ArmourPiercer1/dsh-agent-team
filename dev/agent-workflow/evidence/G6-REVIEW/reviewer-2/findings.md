# G6-REVIEW reviewer-2 — findings

Reviewer: 2 (blind, leaf). Worktree `.worktrees/G6-R2` @ `54950fb60f60d2318cc2e10af800e37c50f87192`
(branch `g6-review-r2`). Delta `11b0584473c78e6d1aed179f3a06b5fb7fa0db2d..54950fb60f60d2318cc2e10af800e37c50f87192`
(17 commits, 179 files: 75 code + 104 evidence). No subagents spawned. No reviewed code modified.

## Findings

### F-1 — LOW — p4t6 scanner `packageDirs` window under a concurrent harness run
- **Location**: `packages/testkit/fault-injection/session-event-scan.mjs` (pre-P6, P4-T6 — NOT in the P6 delta) + the transient `packages/node_modules` junction farm created by `packages/tools/harness/run.mjs` during every harness run.
- **Description**: The scanner's file walk skips `node_modules`/`dist` at any depth (line 231), so the file
  inventory (330) and the denylist result are robust. But the top-level `packageDirs` enumeration
  (`readdirSync(packagesDir).filter(e => e.isDirectory())`, line 254) does not exclude a transient
  `packages/node_modules` directory. While a P6-T6 harness run is in flight (junction farm present,
  created/removed within the run), a full test chain executed concurrently in the SAME worktree sees
  `node_modules` in `packageDirs` and the p4t6 `coverage` assertion fails spuriously.
- **Observed (my run)**: I ran `node scripts/run-tests.mjs runtime tools testkit` in parallel with the
  harness in the same worktree: 559/560 passed, the single failure was exactly this assertion
  (`actual: ["client","contracts","domain","legacy","node_modules","remote",...]`). After the harness
  finished and the junction farm was removed, the isolated rerun `node scripts/run-tests.mjs testkit`
  passed 124/124 including the scan (10/10). The canonical full chain (run alone, clean state) passed
  1214/1214 with the scan green.
- **Assessment**: Not a P6-delta defect (scanner and harness junction behavior are as documented; the
  harness removes the farm in postflight; the farm is gitignored). The brief's lockfile protocol
  serializes harness-vs-harness runs but does not explicitly forbid unit-test runs concurrent with a
  harness run in the same worktree; the shared-worktree window is real. Residual risk is low and
  operationally avoidable (do not run the test chain in parallel with the harness in one worktree).
  No gate criterion is affected.

### F-2 — INFO — E2 harness scenario exercises label/template rejection live; absent-instanceId rejection is unit-pinned only
- **Location**: `packages/tools/harness/run.mjs` (E2) vs `packages/runtime/test/p6t2-addressing.test.ts`.
- **Description**: The live E2 evidence covers member-label tokens (2 attempts) and a template-id
  token (1 attempt), all rejected with `TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED` and zero side effects.
  The `INSTANCE_NOT_FOUND` path (a token that is neither label, template, nor known instance) is
  covered by the unit suite (p6t2-addressing, 12 tests, PASS) but has no live E2 attempt.
- **Assessment**: Criterion "every runtime action is instance-addressed" is still satisfied — the
  instanceId-first rule is enforced structurally in `admission/resolve.ts` (3 rejection sites) and the
  live rejections prove the facade path. Coverage note only.

### F-3 — INFO — harness performs a throwaway boot for profile initialization
- **Location**: `packages/tools/harness/run.mjs` (boot plan; "profile not initialized yet — running a
  throwaway boot to let the host create it").
- **Description**: Before boot 1 the harness starts a short-lived instance on port 3180 to let the
  host create the profile, then boots the real boot 1 on the same port. Documented in the harness
  header. No state concern (fresh DSH_HOME per run).
- **Assessment**: Recorded for completeness; no risk.

No HIGH findings. No MED findings.

## Verification record (all performed by this reviewer, reproducible)

1. **Frozen docs**: 4/4 sha256 match the brief and `dev/agent-workflow/evidence/provenance/file-manifest.json`
   `frozen_docs` (see `frozen-doc-hashes.txt`). No `FROZEN_DOC_HASH_MISMATCH`.
2. **Chain (own worktree, clean state)**:
   - `pnpm install --ignore-scripts` → exit 0 (`install.log`).
   - `node scripts/run-tests.mjs` (all 9 packages) → **1214 passed, 0 failed, 1214 total**, exit 0
     (`run-tests-full.log`). All p6t1/p6t2/p6t3/p6t4/p6t5/p6t6 suites + p4t6 scan PASS (see log lines 47-69, 93, 105-107).
   - `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` ×5 → contracts:0 domain:0
     storage:0 runtime:0 testkit:0 (`tsc-*.log`).
3. **Targeted reruns**: `node scripts/run-tests.mjs runtime tools testkit` → 559/560 (single failure =
   F-1 concurrency artifact; see `run-tests-targeted.log`); isolated `node scripts/run-tests.mjs testkit`
   → 124/124, exit 0 (`run-tests-testkit-isolated.log`).
4. **zero-core**:
   - test-use pristine BEFORE chain: HEAD `cd5ef8148158c3a752a658978873241fdf8e2bbc`,
     `git status --porcelain` empty.
   - test-use pristine AFTER harness: same HEAD, empty status (re-verified independently).
   - Delta import scan (75 code files, multi-line from clauses + side-effect + dynamic imports):
     specifiers are exclusively relative (456), `node:*` builtins, and `vitest` (test-only, repo-standard).
     Zero upstream/`@deepseek-ai/dsh-*` real imports (the 3 textual mentions are scanner fixtures/
     comments: `p6t6-bypass-scan.test.ts:109`, `p4t6-session-event-scan.test.ts:5,158`).
     No `patch-package` / `pnpm patch` / `postinstall` / vendored markers in the delta.
     (`import-scan.txt`, `import-specs.txt`, `scan-imports.mjs`.)
5. **owned-boundary**: all 75 code files fall inside the P6-T1..P6-T6 owned-paths
   (activation/**; admission+action-router; messaging; control; activity; tools/** + P6 e2e), with
   per-task test prefixes in the shared `packages/runtime/test` dir (consistent with each card's
   "输出物: … module; tests"). The single file outside owned-paths is
   `packages/testkit/test/p4t6-session-event-scan.test.ts` = the DEC-1 standing exception, verified:
   it-title ("330 files scanned") + enumeration comment (226+1+10+6+15+13+15+9+11+12+12=330) +
   assertion (`.toBe(330)` x2) are three-way consistent; the scanner
   (`packages/testkit/fault-injection/session-event-scan.mjs`) is NOT in the delta (byte-unchanged);
   my independent count of `.ts/.mts/.mjs` under `packages/` minus the 2 self-referential files = 330.
   (`testkit-scan-diff.txt`.)
6. **E2E harness (lockfile protocol honored)**: no lock present at start (other-reviewer window
   absent); wrote `references/.dsh-test-p6t6.lock` ("reviewer-2 2026-08-31T04:58:00"), ran
   `node packages/tools/harness/run.mjs --report-dir dev/agent-workflow/evidence/G6-REVIEW/reviewer-2/harness-output`,
   removed the lock in a `finally` (confirmed gone). Result: **pass=true, 0 failures, 7/7 scenarios**:
   E1 (14 assertions), E2 (3), E3 (6), E4 (5), E5 boot1-writes (11), E5 boot2-restart (13), E7 (2).
   Post-harness (independent): ports 3180/3181/3491-3495 all free; test-use pristine; stable :3080 = 200
   (pre-harness probe also 200). (`harness-output/*`.)
7. **Cross-task invariants (code review)**:
   - (a) ActivationProvider is the sole durable MemberInstance creation path (`createMemberInstance`
     is a pure domain factory; `commitInstance` callers = the provider's provisioning coordinator and
     P4-T4 storage retry tests only). Quota enforced ONLY at provider step 7 under `withTeamLock` on a
     fresh view counting committed members + in-flight PREPARED reservations
     (`activation/provider.ts:631-638`, `activation/checks.ts:437,498`); the router maps provider
     quota codes, it does not re-count (`admission/gate.ts:26-43`); admit-once via stable logical
     operation identity `(rootSessionId, source, requestToken)` with PREPARED/COMMITTED roll-forward
     and no re-admission (`activation/identity.ts`, `provider.ts:542`).
   - (b) `createTeamRuntime` facade is instanceId-first: label/template tokens rejected
     (`admission/resolve.ts:185,194,200`), live-proven by E2 (label x2 + template-id, zero side effects).
   - (c) Messaging two-record split: facade durable intent fact (`team-coordination-recorded`) + target
     Session receives ONLY ordinary attributed input via the injected public `SessionInputPort`
     (at-least-once + confirmation fact); no Team SessionEvent vocabulary (p4t6 scan green). Live:
     E5 factSequence=9 / deliveredSequence=10 (boot1), 20/21 (boot2 post-restart).
   - (d) Control: first decision authoritative (one decision row per request); invariant 45 — no
     cached authority (every consult is a durable ledger read); external hard policy probed LIVE before
     the decision row — allow cannot override (`reason: 'external-policy'` first,
     `CONTROL_EXTERNAL_POLICY_DENIED` even for leader/human allow); allow consumed exactly once
     (`control-allow-consumed` fact). Tool last-mile guard (`tools/src/guard.ts`): allowed→proceed
     exactly once, no-request→proceed (documented SD-GUARD deviation, facade still enforces
     authority/quota), every other reason fail-closed with zero side effects; live: E5 boot2
     retry blocked `allow-consumed`, fresh token executed.
   - (e) Activity: two-phase write (facade `report-progress` authority fact under the runtime lock,
     then guarded commit under the activity's own lock with a fresh durable re-read); out-of-order
     REJECT strict head+1 — `stale` (claimed ≤ head) never overwrites, `gap` (claimed > head+1) never
     silently filled (`ACTIVITY_SEQUENCE_STALE`); projection is pure — telemetry never decides
     lifecycle/workflow (`activity/projection.ts` determinism contract).
   - (f) Tool layer depends ONLY on the TeamRuntime public surface + public tool registration:
     `TeamToolsOptions` = facade + sanctioned satellites, "the tool layer itself writes nothing";
     imports in the 5 tool-layer src files are index-level (runtime/admission|control|messaging|activity,
     contracts) with zero storage-repository or agent/session-creation imports; registration via
     `agentCtx.tools.register`, execution via `ctx.tools.execute`; E7 bypass scan over exactly the 5
     committed tool-layer files: 25 specifiers, 0 violations; E2E driver reaches team actions only
     through HTTP → registered tool handlers (never TeamRuntime directly).
