# fix-report — Control authorization boundary (findings B / C / D / H)

- **Branch**: `fix/control-authz-boundary` (worktree `.worktrees/fix-control-authz`)
- **Base (baseline) HEAD**: `31ad828d06b5bcca858532f1930ac10c51c0f1bb` (= master) — recorded per protocol via `git rev-parse HEAD` on the pristine worktree before the baseline runs.
- **Fix commit**: `c4bb2c53` (single atomic multi-finding commit — the four findings share the `dispatchRecoveryIfOffered` path; B/D/C hunks interleave in the same function, so per-finding commits would have required fragile hunk surgery; the mission sanctions one coherent atomic multi-finding commit. C/D/H remain conceptually separable; see "Deviations".)
- **Scope**: findings **B (P1), C (P2), D (P1), H (P2)** only. No counter-evidence encountered (all four reproduced over the real chain). No other production surface touched.
- **RED-first**: each finding reproduced with NEW regression tests driving the REAL component chain — **exact label (per the external-review addendum's label-accuracy correction): live `createTeamRuntime` router + REAL `createControlService` (real validators, durable rows, wait bridge); the H suite additionally instantiates the REAL `createMessagingCoordinator`; the only fakes are the injected effect seams; the restart in D is the real durable primitive `restartP6T1World`. This is the component chain (Runtime + Control + MessagingCoordinator where applicable) — NOT the production root/S6 wiring; no production-root coverage is claimed by these suites.** RED captured on the pristine tree at `31ad828d` BEFORE any production change.

## Per-finding status (RED → GREEN)

| Finding | RED (pristine 31ad828d, true exit codes) | GREEN (post-fix) |
| --- | --- | --- |
| **B** (P1) — frozen review snapshot single source | `red-capture-2.log` EXIT=1: S1+S2 `payload1['requestToken']` undefined (lossy payload projection — no requestToken/toolName/arguments); S3 mutation-executes RED (the caller's mutated payload ran) | `green-focused-1.log`: 2/2 green (durable row fully represents the workDelivery + digest integrity + prompt-only change changes the digest + deny zero-effect; pending-approval mutation NEVER executes — the frozen snapshot runs) |
| **C** (P2) — terminal abandonment precedence + waiter settlement + final pre-effect check | `red-capture-2.log` EXIT=1: C1 hung 5005 ms (parked waiter on the abandoned row never settles); C2 resolved the STALE allow in 11 ms (pre-abandon decision); C4 `outcome.ok === true` in 44 ms (the wait→admission race executed the abandoned allow — zero-effect block never held). `red-capture-c3.log` EXIT=1: C3 resolved with the stale allow (the cascade consulted the decision before the abandon mark) — note: the pre-aborted-signal variant of C3 passed on old code (the pre-abort branch throws unconditionally) and was re-designed as a mid-wait abort race with a slow-poll waiter so the CASCADE path is the only settle path | `green-focused-1.log`: 4/4 green (C1 parked-waiter settle + typed block + zero work; C2 fresh await on the abandoned row settles rejected terminal `CONTROL_REQUEST_ABANDONED` bounded; C3 the cascade — the abandon mark wins over the stale decision; C4 every allow+abandon interleaving → the SAME typed `controlDecision: 'abandoned'` block, zero work) |
| **D** (P1) — restart-unique attempt identity (no approval replay) | `red-capture-2.log` EXIT=1: D1 + D2 both hung 5005 ms (vitest per-test timeout): the cold-restart retry re-derived the counter correlation `recovery:tok-d-stable:1`, hit the EXISTING decided/abandoned row by scope key and either re-armed the stale allow (D1 — work executed with no fresh Human) or awaited the abandoned row forever (D2) | `green-focused-1.log`: 2/2 green (D1 approved-then-crashed token — crash residue = durable allow, zero work — cold restart → NEW pending request with a NEW restart-unique (UUID) correlation, zero work before the fresh approval, then exactly-once work; D2 crashed-mid-wait abandoned row — cold restart → NEW pending request, never re-arms the abandoned row, exactly-once work after the fresh approval) |
| **H** (P2) — subject consistency (send-message) | `red-capture-2.log` EXIT=1: S1/S2/S3 failed (the template-subject + targetInstanceId combination the old mapping produced is rejected `CONTROL_REQUEST_MALFORMED` by the REAL validator — the request row is never created, the wait never starts; the suites timed out waiting for the row) + the evidence-guard test PASSED on old code by design (it pins the real validator's rejection) | `green-focused-1.log`: 4/4 green (the blocked Leader send-message creates the durable inline request with the RECIPIENT INSTANCE subject + the full message in the review payload + requestToken; deny ⇒ typed block + zero delivery; allow ⇒ exactly one delivery; abort ⇒ durable abandon + typed block + zero delivery) |

RED log note: `red-capture-1.log` (also in evidence) is the first RED attempt — all 12 tests failed on a test-file import bug (`makeActionRequest` not re-exported by the new helper) before it was fixed; it is kept as the raw record. The valid RED captures are `red-capture-2.log` (B/C/D/H) + `red-capture-c3.log` (C3 after its deterministic re-design).

**Second pass (external review of PR #49 — C = BLOCK: a TOCTOU the final snapshot does not close).** The C fix above had a residual race: the final pre-effect terminal check runs BEFORE the recursive `performAction`; after it, the gate re-probes with an `await` (holding the team chain) while `control.abandon` commits the durable abandon mark under the control service's OWN per-team lock — so a durable abandon landing AFTER the snapshot, DURING the re-probe await, was invisible to it, and the re-execution still committed the effect (the abandoned allow executed). The pre-effect check is now documented as the FAST PATH only; the race is closed at the EFFECT-ADMISSION BOUNDARY itself (see the dedicated section below). C5 RED: `red-toctou-1.log` (EXIT=1, `outcome.ok === true` — the effect still committed, exactly the review's prediction); C5 GREEN: `green-toctou-pins-1.log` (C suite 5/5).

## Files changed (commit `c4bb2c53`, 16 files, +1789/−91)

Production (the ONLY production surface changed):
- `packages/runtime/action-router/router.ts` — B: `deepFreezeCopyValue` + `freezeRequestSnapshot` (one frozen snapshot at dispatch time; subject, review payload, digest and the post-approval re-execution all read it); review payload extended to the COMPLETE normalized invocation (additive `toolName`/`requestToken`/`subject`/`arguments`/`execution`/delegation identity; same schema v1; digest formula unchanged); D: the process-local `recoveryDispatchSequence` counter replaced by `nextRecoveryAttemptId()` (restart-unique UUID nonce, platform-global crypto pattern with counter+timestamp fallback); H: `recoveryDispatchSubject` maps `send-message` + `targetInstanceId` → the recipient INSTANCE subject; C: the wait-catch settles on `CONTROL_REQUEST_ABANDONED` (typed terminal outcome) + the FINAL pre-effect check before the re-execution (post-settle signal abort → durable close + typed block; fresh `listControlState` abandonment read → the wait→admission race blocks the stale allow).
- `packages/runtime/control/service.ts` — C: `awaitControlDecision`'s poll checks the durable ABANDON mark FIRST (settle-reject `CONTROL_REQUEST_ABANDONED` — parked + cold waiter liveness; the terminal mark beats any pre-abandon stale decision); `inlineAbortCascade` consults the abandon mark BEFORE the decision (the S6 pin preserved: a decision WITHOUT an abandon mark still settles with the decision, no abandon fact).

Tests (new, 5 files / 12 tests):
- `packages/runtime/test/fix-control-authz-helpers.ts` (shared real-chain fixtures)
- `packages/runtime/test/fix-control-authz-b-frozen-snapshot.test.ts` (2)
- `packages/runtime/test/fix-control-authz-c-abandon-terminal.test.ts` (4)
- `packages/runtime/test/fix-control-authz-d-restart-fresh-human.test.ts` (2)
- `packages/runtime/test/fix-control-authz-h-send-message.test.ts` (4)

Tests (disclosed masking-test adjustments, 2 files — the mission allows adjusting masking tests ONLY where they assert the buggy behavior, and both did):
- `packages/runtime/test/recovery-leader-dispatch-review.test.ts` L83 — the old pin `recovery:req-recovery-review-1:1` asserted the BUGGY process-local counter identity (the `:1` suffix a cold-restart retry could re-derive — the D defect); now asserts the restart-unique nonce (UUID) identity.
- `packages/runtime/test/recovery-send-message-review.test.ts` L103 — same for `recovery:req-w3d-review-1:1`.
- Both tests use the lenient spy control service (no validator) — the masking the new real-chain suites remove; NO assertion was weakened (the correlation is asserted with the same specificity, against the new identity).

Scanner pin:
- `packages/testkit/test/p4t6-session-event-scan.test.ts` — pin 896 → 901 (+5 new scannable test files; NO new production .ts files — the fix edits the already-scanned router.ts + control/service.ts only; the scanner .mjs/.d.mts are byte-identical — DEC-1 precedent, w1a). Title note updated per precedent.

Dist mirror (committed per repo precedent — the install surface ships prebuilt artifacts):
- `packages/runtime/dist/packages/runtime/action-router/router.{js,js.map,d.ts.map}` + `packages/runtime/dist/packages/runtime/control/service.{js,js.map,d.ts.map}` — rebuilt via `tsc -p tsconfig.build.json`; exactly 6 files (the public `.d.ts` surface is unchanged); `node scripts/check-artifacts-committed.mjs` = OK (1372 files, committed artifacts match the fresh build, 1 glue placement).

## Files changed (second-pass commit `ca98a35e`, 17 files, +527/−22)

Production: `packages/runtime/control/service.ts` (new `commitEffectIfAuthorized` — the effect-admission boundary), `packages/runtime/control/types.ts` (interface method), `packages/runtime/admission/types.ts` (recovery marker `controlRequestId`), `packages/runtime/action-router/router.ts` (marker threading + the boundary wrap around `executeEffectLocked` + typed translation). Tests: the C suite (C5 added, 4→5), the B suite (digest-oracle correction, same 2 tests). Dist mirror: 11 files co-committed (this pass the public `.d.ts` surface changes — the new method + the new marker field).

## C escalation assessment (mission question: real unauthorized-execution race in the production signal/lock combination?)

**No arbitrary-UI unauthorized-execution race is demonstrated.** In production, the abandon path is the router abort, which carries the already-aborted signal; and the re-execution's gate + admission run inside the team lock (the `withTeamLock` Phase A), which independently blocks side effects. The finding's named code paths ARE real and were fixed + regression-pinned over the real chain:
1. **wait→admission race (router inline lane)** — the wait bridge settles on the decision it OBSERVED; a durable abandon landing AFTER that settle (allow+abandon both durable) let the old code execute the abandoned allow — demonstrated by C4 (old code: `outcome.ok === true`, the work committed);
2. **waiter liveness (service poll)** — a parked waiter on an abandoned row polled forever (no decision can ever land); a fresh waiter (cold restart retry) on an abandoned row with a pre-abandon decision resolved the STALE allow — demonstrated by C1/C2;
3. **cascade ordering (service)** — the inline-abort cascade consulted the decision before the abandon mark, so a stale allow won the signal cascade — demonstrated by C3.

The fix keeps the scope to the finding (terminal-mark precedence + waiter settlement + one final pre-effect check in the router's inline lane). No broader UI-side changes.

## Second pass — the abandon TOCTOU (external review BLOCK on C) + 3 evidence corrections

### The race (as localized by the external review)

The router's final pre-effect check (fresh `listControlState` abandonment read) runs BEFORE the recursive `performAction({ ...frozen, recovery: { scopeKeys, unavailableSubjects } })`. That re-execution's gate re-probes the environment-facts port with an `await` INSIDE the team-chain acquisition (router L761–818 region), while `control.abandon` commits the durable `control-request-abandoned` mark under the control service's OWN private per-team lock. A durable abandon landing in that window (after the snapshot, during the re-probe await) was invisible to the snapshot — and the re-execution carried only recovery scopes (no controlRequestId threaded for re-verification at the effect boundary), so the effect STILL committed. **Qualitative stance (accepted by the review): P2 SERVICE RACE (durable abandon during the admission window); no arbitrary-GUI unauthorized-execution vector is claimed** (the first-pass escalation assessment stands).

### C5 — the exact deterministic repro (RED first)

C5 joins the C suite (existing file — no new scannable file; the p4t6 pin 901 is unchanged):

1. A real control recovery follow-up, APPROVED through the real chain (the authz fixture — the real component chain, same world control service, same recording delivery port).
2. A pausable `environmentFacts` wrapper (one-shot barrier, armed immediately after the durable allow) parks the recursive admission's gate re-probe (`facts = await environmentFacts()` in `evaluateAllScopes` — requirement-gate.ts — the call LATER than the pre-dispatch snapshot). The test deterministically waits for the barrier hold before proceeding.
3. While the barrier holds: the REAL `abandonControlRequest` persistence (the human caller, the same requestId, a reason) — awaited to completion (its own control lock; the in-flight admission holds the team chain, not the control lock — the durable abandon commits NOW). The AbortSignal is NOT triggered.
4. The barrier releases (the gate resolves with its facts).
5. **RED (pre-fix code, `red-toctou-1.log` EXIT=1)**: `outcome.ok === true` — the effect STILL executed (team-work-admitted + delivery). **GREEN (post-fix, `green-toctou-pins-1.log`)**: the typed `COMPATIBILITY_BLOCKED` `controlDecision: 'abandoned'` block with the controlRequestId; ZERO `team-work-admitted`; ZERO delivery; the durable close stands (exactly one abandon mark; the stale allow decision row is closed by the terminal mark; derived request state `abandoned`).

### The fix — a truly serialized authorization/effect-admission boundary

The linearization point is a REAL serialization point, not another snapshot: the terminal-state check and the first-effect commit run as ONE unit under the SAME per-team lock the durable abandon write goes through.

- `control/service.ts` — new `commitEffectIfAuthorized<T>(rootSessionId, requestId, commitEffect)`: under the service's own `withTeamLock(teamLocks, root, …)` (the lock `abandonControlRequest` and the inline-abort cascade commit the terminal mark through), in one hold: (1) fresh durable terminal-state read; (2) abandon mark present → reject typed `CONTROL_REQUEST_ABANDONED` WITHOUT running the effect; (3) else run the caller's effect commit, still under the lock. **No new durable facts (no synthetic "consumed" mark — the linearization is the lock itself), no state change; transparent for a non-abandoned request.**
- `admission/types.ts` — the router-produced recovery marker gains `controlRequestId?` (never caller-set).
- `action-router/router.ts` — the recovery re-execution threads the reviewed request id through the marker; the gated chain work wraps EXACTLY `executeEffectLocked(ctx)` (the first durable effect commit — the work admission fact / the effect commit — AFTER the gate re-probe) in `commitEffectIfAuthorized`, translating the typed rejection into the recovery dispatch's typed `controlDecision: 'abandoned'` zero-effect block.

**Why it linearizes (authorization + first effect) against the durable abandon:** the abandon write and the [check + first-effect commit] unit both run under the same lock. Any durable abandon is therefore either (i) committed BEFORE the unit → the check sees the mark → zero admitted / zero effect (the typed abandoned block), or (ii) strictly AFTER the unit → the effect had already durably committed before the terminal mark — the legitimate late close (the CCR-4 semantics: a work commit that landed before a late close stands; the mark closes the request for the future). No abandon can land BETWEEN the check and the effect commit (both inside the one lock hold). The bounded residual (recorded): the gate's `recovery-incident-opened` AUDIT fact is written inside the gate (team-chain only, BEFORE the linearization point) — an abandoned attempt may leave that durable audit record; every authorization-critical effect (work admission / delivery / effect commit) is zeroed.

**Lock ordering / deadlock argument:** the only NEW acquisition direction is the router's team chain (a) → the control lock (b) (the router's gated chain work invokes the boundary unit after the gate, while holding its chain). Every (b) section (requestControl / resolveControl / abandonControlRequest / the inline-abort cascade / guardOperation / the boundary unit) NEVER acquires (a): the control service never takes the router's chain and never calls back into the router, and the unit's caller work (the effect commit) performs only storage-seam writes + port calls (no (b) re-entry — the inline effect path consults no other control operation). Consistent global order (a) → (b) → storage seam; no (b) → (a) path exists anywhere → no new lock cycles. `inline ≠ guarded` semantics are untouched (the unit fires only for the inline recovery marker; the guarded lane's own guard re-check is unchanged).

### Test correction (disclosed — the B digest FALSE ORACLE, per the addendum)

The S2 "change-only-the-prompt changes the digest" leg previously ALSO changed the `requestToken` (`tok-b-1` → `tok-b-2`) — and the token is part of the hashed payload — so the digest move was not attributable to the prompt. Corrected (before/after):

- **Before**: attempt 2 = `requestToken: 'tok-b-2'` + changed prompt → `digest2 ≠ digest1` (unattributable — the token move alone would change it).
- **After**: attempt 2 = the SAME `requestToken` + SAME `attachedContext` + every other field byte-identical, ONLY the prompt changed → `digest2 ≠ digest1` (the move is attributable to the work content — the rows are distinct only via the restart-unique nonce correlation); PLUS the complementary leg: attempt 3 = same work content byte-identical, ONLY the token changed → `digest3 ≠ digest1` (the full attribution pin). All three rows denied ⇒ typed zero-effect block, zero work. GREEN in `green-toctou-pins-1.log` (B 2/2).

### Evidence corrections (per the addendum)

1. **p6t1 re-capture with real output.** The three `p6t1-parallel-rerun-{1,2,3}.log` committed at `41e53c98` were 1-byte empty files: a botched first `sed` EOF-strip attempt (run before the perl re-strip) destroyed their content, and only the trailing bytes were verified before commit — disclosed. The "3/3 isolated green" claim was TRUE at the time (the per-run terminal echoes — `runN EXIT=0  Tests  9 passed (9)` — are in the session record), but the committed evidence was hollow. Re-captured at the new head; each log file STARTS with the exact command line as its first line (`$ cd /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/fix-control-authz && pnpm vitest run packages/runtime/test/p6t1-parallel.test.ts`), followed by the real full stdout+stderr and the true exit code line (`EXIT=0 (rerun N/3)`) — no exit-swallowing pipes. All 3: `Tests 9 passed (9)`, `EXIT=0 (rerun N/3)`.
2. **Label accuracy.** The 12-test focused capture (`green-focused-1.log`) is labeled exactly: **focused: Runtime + Control (+ real MessagingCoordinator in the H suite) instantiation — the component chain, NOT the production root/S6 wiring; 12 tests**. No production-root coverage is claimed by these suites (corrections applied to the RED-first line and the focused-surface section above).

### Gates at the new head (second pass — all green)

| Gate | Result | Log |
| --- | --- | --- |
| C suite (C1–C4 + **C5 TOCTOU**) | 5/5 GREEN | `green-toctou-pins-1.log` |
| Prior pins (B 2 incl. corrected digest attribution, D 2 both legs, H 4, S6 `control-inline-wait-abort` 10/10, recovery review 8/8) | 31/31 GREEN (7 files) | `green-toctou-pins-1.log` |
| Control family + p6t4 + p4t6 scanner @ 901 (unchanged — no new scannable file) | 171/171 GREEN (24 files) | `green-toctou-control-p6t4-1.log` |
| Full `pnpm vitest run` | 10F files / 401P (411); 20F tests / 4712P (4732); EXIT=1 — **failed-file SET DIFF vs the recorded baseline debt set = EMPTY except {p6t1-parallel} = the known flake family, 1 occurrence (within 0–2; signature identical: the N=5 parallel-activation test, `errors.length === 2`)**; 4732 = 4719 baseline + 12 first-pass tests + 1 C5 | `full-final-1.log` |
| `pnpm run lint` | 143 (118E/25W), EXIT=1 — **plain AND file-aware fingerprint set-diff vs the committed baseline = EMPTY** (zero new entries) | `lint-final-1.log` + `lint-final-fp-{plain,fileaware}.txt` |
| `pnpm typecheck` (runtime) | exit 0 | — |
| Dist mirror | rebuilt (`tsc -p tsconfig.build.json`), 11 files (router/service/admission-types/control-types `.js`/`.map`/`.d.ts`/`.d.ts.map` — the public `.d.ts` surface GAINED the `commitEffectIfAuthorized` method + the `controlRequestId` marker field this pass), CO-COMMITTED; `node scripts/check-artifacts-committed.mjs` = OK (1372 files) | — |

## Full-suite gate (valid environment)

Environment validity: the test-use checkout `tests/deepseek-harness-test-use` was verified valid before the baseline — pristine @ `46a7f68b0922371ce7144b668b90e377d8e799f4` (0.1.7-rc.1), `node_modules` present, `packages/boot/app-boot/lib/index.js` built. (The earlier `baseline-full.log` run — kept in evidence — was taken BEFORE this environment was valid and is NOT the cited baseline; its two extra failed files, `plugin-dsh-compat` + `a2c7-subtree-matcher`, were environmental — missing test-use build.)

| Run (both: `pnpm vitest run`) | Files | Tests | EXIT |
| --- | --- | --- | --- |
| BASELINE @ pristine `31ad828d` (`baseline-full-2.log`) | 9 failed / 398 passed (407) | 19 failed / 4700 passed (4719) | 1 |
| CHANGED @ `c4bb2c53` (`changed-full-1.log`) | 10 failed / 401 passed (411) | 20 failed / 4711 passed (4731) | 1 |

- **Failed-file SET DIFF (changed − baseline) = { `packages/runtime/test/p6t1-parallel.test.ts` }** — the KNOWN flake family (timing-sensitive parallel activations under full-suite load; the mission rule: same family = record, new signature = STOP). Evidence: 3/3 isolated re-runs GREEN on the changed tree (`p6t1-parallel-rerun-1/2/3.log`); the failing test is the P2 N=5 activation test with `errors.length === 2` (a load-timing signature, identical family to the closure-recorded P1/P2/P3 flake attributions). **No new signature — the guard clause did not trigger.**
- All 12 new tests GREEN in the full run (4731 = 4719 + 12; 20 failed = the exact baseline 19 + the 1 flake).
- Baseline failed set (exact historical debt, unchanged): t1-capability-schema (9) / t2-blueprint-hash (1) / d3-member-identity-context (1) / p6t3-mediation (5) / p6t3-restart (2) / p6t6-actions (1) + file-level collection: p8s3b-result-effects / t12a-b2-child-identity / t12a-glue-handoff-ports. None touched, none fixed (no debt fixing, no skips).

## Lint gate (valid environment)

| Run (both: `pnpm run lint`) | Problems | EXIT |
| --- | --- | --- |
| BASELINE (`baseline-lint-2.log`) | 143 (118 errors, 25 warnings) | 1 |
| CHANGED (`changed-lint-1.log`) | 143 (118 errors, 25 warnings) | 1 |

- **Plain fingerprint diff** (`baseline-lint-fp-plain.txt` vs `changed-lint-fp-plain.txt`): **identical** (143 lines, zero added/removed/shifted).
- **File-aware fingerprint diff** (per the refined protocol — `file|line|rule`, `baseline-lint-fp-fileaware.txt` vs `changed-lint-fp-fileaware.txt`): **identical** (zero new entries; zero shifts; zero deletions).
- `npx eslint` on the 10 touched files (`lint-touched-2.log`): zero errors in the new/adjusted test files; the only 2 hits are PRE-EXISTING baseline debt in the two production files (`router.ts:83 TeamBlueprint` unused, `service.ts:174 parseTemplateId` unused) — verified present at the base SHA `31ad828d` (baseline lint debt, not touched per protocol).
- `pnpm typecheck` (runtime package): clean (exit 0).

## Focused regression surface (all GREEN post-fix)

Label note (per the addendum): all focused captures below run the same REAL component chain as the new suites (live `createTeamRuntime` + REAL `createControlService` + real messaging coordinator where the suite wires it) — component-chain coverage, NOT production-root/S6 wiring.

- `focused-recovery.log` — 13 files (recovery-* / required-mcp / team+template-required-recovery / p6t1-recovery / leader-recovery / recovery-exit / remote-control-abandoned-code): 58/58 after the two disclosed pin adjustments.
- `focused-control.log` — 20 files (a4a 28 tests incl. the W2 guarded pins, c1-* 10, control-* 15 files incl. `control-inline-wait-abort` **S6 pin preserved** + the S3 late-allow-after-abandon pin, f9-* 22, the two adjusted review tests): 145/145.
- `focused-p6t4.log` — 6 files (p6t4-* control lifecycle): 32/32.
- `focused-p4t6.log` — scanner 10/10 @ pin 901.
- Second pass (TOCTOU batch) re-runs: B 2/2 (incl. the corrected digest attribution) + C 5/5 (incl. C5) + D 2/2 + H 4/4 + S6 10/10 + recovery review 8/8 (`green-toctou-pins-1.log`); control family + p6t4 + p4t6 = 24 files 171/171 (`green-toctou-control-p6t4-1.log`).

## Deviations / disclosures

1. **Atomic multi-finding commit** (not one commit per finding) — the mission's sanctioned alternative; rationale in the commit header section.
2. **2 masking-test adjustments** (disclosed above; both asserted the buggy D identity — the only permitted case).
3. **p4t6 pin 896 → 901** — sanctioned precedent (w1a: new test files count toward the pin; scanner byte-identical; title note updated).
4. **C3 re-design during RED** — the first C3 variant (pre-aborted signal) passed on the OLD code because the pre-abort branch throws unconditionally; the finding's actual decision-first path is the mid-wait abort cascade, so C3 was re-designed (slow-poll waiter → the cascade is the only settle path) and its RED captured separately (`red-capture-c3.log`). Disclosed here; the final C3 in evidence is the deterministic one.
5. **`git stash`/`git stash pop`** was used to run the valid baseline on the pristine tree (the worktree had to be pristine per protocol); the stash contained only this branch's WIP, was popped and fully restored before the CHANGED runs (verified: `git status` after pop = the exact 10-file change set; the committed diff = the staged change set).
6. `baseline-full.log` (first full run, degraded environment) is kept in evidence as the raw record but is explicitly NOT the cited baseline (parent protocol: a degraded-env run must not be cited).
7. **Second pass — the destroyed p6t1 re-capture logs** (disclosed above under "Evidence corrections"): a botched first `sed` EOF-strip attempt emptied the three rerun logs committed at `41e53c98`; only trailing bytes were verified before commit. Re-captured at the new head: each log starts with the exact command line, then the real full stdout+stderr and the true exit code (3/3 `EXIT=0`, `Tests 9 passed (9)`).
8. **Second pass — the B digest false-oracle test correction** (disclosed above under "Test correction"): a TEST correction (like the masking adjustments), with before/after recorded; no assertion weakened — the pin is STRICTER (the token is held constant for the attribution).
9. **Second pass — label correction**: the focused-green captures are component-chain coverage (Runtime + Control + MessagingCoordinator where applicable), NOT production-root wiring (the report wording corrected; the log entry records the same).
10. **Second pass — push**: the earlier "no push" red line was OVERRIDDEN by the parent's explicit instruction for this PR flow ("push the new HEAD (plain, no force)") — a PLAIN push of the new head to origin `fix/control-authz-boundary` was performed (PR #49 update); no force-push, no other ref touched.

## Red-line compliance

- CORE PATCH BUDGET = 0 — upstream / test-use zero-touch (test-use verified pristine @ `46a7f68b09` with a valid build).
- Push: the first pass performed NO push (branch was local at `c4bb2c53`/`41e53c98`). The second pass performed the ONE PLAIN push the parent explicitly instructed for this PR flow (the new head to origin `fix/control-authz-boundary` — PR #49 update; no force-push, no other ref).
- No :3080 / :3180 / ~/.dsh / host instances touched; no model/config changes.
- Scope = B/C/D/H only; no debt fixed; no existing test weakened or deleted (the 2 disclosed pin adjustments are identity updates, not weakenings).
- `dev/agent-workflow/graph.yaml` untouched.
- 1 task = 1 worktree = 1 writer (`.worktrees/fix-control-authz`); main tree + sibling worktrees untouched.
