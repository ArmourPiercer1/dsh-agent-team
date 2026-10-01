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

## Third pass — the two residual C defects (external re-review STILL BLOCK at `d100ada7`)

### Residual C-1 — the coordination (send-message) reentry bypassed the unit

The reviewed send-message reentry has impact `recoveryWork` (requirement-gate
classification — the recovery marker) and `spec.category = 'coordination'`, so
the router's gated-branch condition (`isNewWorkAdmission(spec) ||
impact === crossAgentTrigger`) is FALSE: it fell to the plain
`executeEffect(teamLocks, ctx)` fallback — NO gate, NO boundary unit. An
abandoned request could therefore still commit a coordination fact (zero
effects of ANY kind was not actually enforced).

**Fix (category-agnostic, at the effect boundary):** the unit is factored into
one helper, `commitReviewedEffect()` (router.ts), keyed ONLY on
`request.recovery?.controlRequestId !== undefined` — never on the spec
category — and the non-gated fallback now routes marker-carrying requests
through the SAME serialized path: `withTeamLock(chain (a))` →
`commitEffectIfAuthorized` (control lock (b)) → `executeEffectLocked`.
`executeEffect` (which acquires (a) itself) is NEVER called inside the unit —
that would be (b) → (a), a new lock cycle; the unit's caller always owns (a).

**Exact call sites changed (the full enumeration, per the review's demand):**

| # | Site (router.ts, new head) | Before | After |
| --- | --- | --- | --- |
| 1 | the gated-branch effect commit (the follow-up / delegate / create-member reentry — work admission) | inline `commitEffectIfAuthorized` wrap (pass-2 shape, no signal) | `commitReviewedEffect()` (same unit + the C-2 signal threaded) |
| 2 | the non-gated fallback (the send-message / any coordination reentry — the C-1 gap) | bare `executeEffect(teamLocks, ctx)` | `withTeamLock(chain) → commitReviewedEffect()` when `recovery.controlRequestId` present; bare `executeEffect` otherwise (byte-identical) |
| 3 | the unit itself (`commitEffectIfAuthorized`, control/service.ts) | mark check only | mark check + the C-2 live-signal check + persisted durable close (see below) |

The ONLY other effect-commit site in `performAction` is Phase B (`complete` —
the post-admission delivery outside the chain) — the documented bounded CCR-4
residual (the work was durably admitted before any close), unchanged.

### Residual C-2 — the live AbortSignal was not honored at the boundary

An abort landing after the wait settled (at ANY admission wait point — the
gate re-probe await, the control-lock queue) was never rechecked: the unit had
no signal parameter and only the pre-dispatch check existed (before the
reentry). The work was admitted with NO durable close.

**Fix (thread the live signal to the serialized final admission boundary):**
`commitEffectIfAuthorized` gains `signal?`; INSIDE THE SAME LOCK HOLD as the
terminal-state read: (1) abandon mark → typed reject (unchanged); (2) signal
aborted → **persist the abandon** (the durable close — the exactly-once
terminal mark, the same footprint as an explicit abandon; a later
late-abandon then no-ops on the already-terminal state) + typed reject
(new closed code `CONTROL_REQUEST_ADMISSION_ABORTED` — errors.ts; the
documented fail-closed exception where the durable write IS the rejection's
evidence); (3) else the effect commit runs — with NO signal check DURING the
commit: a post-commit abort is the legitimate late close (CCR-4 — the
settle semantics for already-committed effects are preserved: never
retroactively undone or re-marked). The router threads
`asAbortLike(request.signal)` through the unit on both paths.

### RED captures (both new repros, true exit codes — `red-toctou-2.log`)

- **C6** (residual C-1, the precise queued-lock race over the REAL
  MessagingCoordinator): a TEST-OWNED shared runtime-lock map (the router's
  `teamLocks` option) is held by the test; the blocked Leader send-message is
  allowed; the reentry is observed QUEUED behind the hold (the chain-map
  entry change — deterministic proof the pre-dispatch snapshot ran with NO
  mark); the real `abandonControlRequest` persists on the control lock;
  release. RED: `outcome.ok === true` (the coordination fact committed
  unchecked). GREEN: zero `team-coordination-recorded`, zero delivery, typed
  `abandoned` block + `controlRequestId`, the durable close stands.
- **C7** (residual C-2 leg a — the exact external repro): follow-up with a
  live `AbortController` signal; allow; the recursive environmentFacts is
  paused AFTER the router's pre-dispatch signal check (the gate re-probe);
  the signal is aborted ONLY (no explicit abandon); release. RED: the work is
  still admitted, NO durable close. GREEN: the typed `abandoned` block; the
  abandon IS persisted by the boundary (one mark — the same footprint as an
  explicit abandon); zero work / zero delivery.
- **C8** (residual C-2 leg b — abort while BLOCKED WAITING for the control
  lock): dual barriers — the reentry pinned in its gate re-probe while a
  separate toolName-bearing request's `resolveControl(allow)` holds the
  control lock across its external-policy probe (real occupancy); the
  re-probe is released (the unit queues on the control lock behind the
  occupancy), the signal aborts, the occupancy releases. RED: the work is
  admitted, no close. GREEN: the commit is rejected with the persisted
  durable close; zero work. (The outcome is deterministic for any abort
  before the unit's check — the check runs only after the occupancy
  releases, which the test controls; the queue placement is asserted by the
  barrier sequence.)

### Gates at the new head (third pass — all green)

| Gate | Result | Log |
| --- | --- | --- |
| C suite (C1–C5 + **C6/C7/C8**) | 8/8 GREEN | `green-focused-2.log` |
| Prior pins (B 2, D 2, H 4, S6 10/10, recovery review 8/8, a6a 52) | 86/86 GREEN (8 files) | `green-focused-2.log` |
| Control family + p6t4 + p4t6 scanner @ 901 (unchanged — C6–C8 joined the EXISTING C-suite file) | 119/119 GREEN (20 files) | re-run of the second-pass batch, no new failures |
| Full `pnpm vitest run` | 9F files / 402P (411); 19F tests / 4716P (4735); EXIT=1 — **failed-set diff vs the `31ad828d` debt set = EMPTY** (the exact 9 debt files / 19 debt tests; p6t1 flake 0 occurrences this run, within 0–2) | `full-final-2.log` |
| `pnpm exec eslint .` | 143 (118E/25W) — **plain AND file-aware fp diffs vs the committed baseline = EMPTY** (one transient `prefer-const` in the new C6 poll code was fixed before commit; fp clean at the committed bytes) | `lint-final-3.log` + `lint-3-fp-{plain,fileaware}.txt` |
| `pnpm run typecheck` (repo root, per-package lines + final status) | exit 0 (full legible log) | `typecheck-final-2.log` |
| Dist mirror | rebuilt (`tsc -p tsconfig.build.json`), 12 files (router/control service+types+errors `.js`/`.map`/`.d.ts`/`.d.ts.map` — the public `.d.ts` surface GAINED the `signal?` input + the new error code this pass), CO-COMMITTED | — |
| `pnpm run check:artifacts` (full 1372-file verification output) | OK: 1372 files (full legible log) | `check-artifacts-3.log` |

## Controlled master sync (per the parent's strategy correction: MERGE, not rebase)

Protocol: `git fetch origin master` → **`git merge origin/master`** (merge
commit on the fix branch — NO history rewrite → plain fast-forward push; the
pre-merge tip `414c9698` and `d100ada7` stay ancestors — the external already
saw `d100ada7`, so the new HEAD is a clean descendant and the delta is
exactly [the two residual fixes] + [the master merge] + [the sync
bookkeeping]). New base: **`2bfbca12c0b4b7260e8bc9b5b05cd339189c74e4`**
(PR #47 merged — E+G: effective-policy reset-tombstone canonical read +
s6-remote `override.get` latest-slot-winner/mixed-kind, + the
`remote-override-expected-generation` test file, governance-reset-tombstone
extensions, their evidence dir, their two router-log entries, their dist).

Merge commit: **`b45d7ff5`** (parents `414c9698` + `2bfbca12`).

### Conflict-resolution list (EVERY resolution — NEW UNREVIEWED CHANGES)

| # | File | Hunk | Resolution |
| --- | --- | --- | --- |
| 1 | `dev/agent-workflow/SESSION_ROUTER_LOG.md` | the file tail (both sides appended entries after the common base — the merge base predates ALL of them) | **KEPT BOTH SIDES** (protocol for the router log): the two `2026-09-29 (fix/effective-policy-reset-fallback)` entries (#47's E+G closure + mixed-kind closure) in their original order FIRST, then my three `2026-10-01` fix-control-authz entries (pass-1 / pass-2 / pass-3) — chronological. Byte-verified: each side's appended block is present in the resolved file exactly (substring check against both parents' file contents). |
| 2 | generated/artifact files (dist) | none conflicted (zero overlap: #47 touched `dist/.../effective-policy/*` + `dist/.../src/plugin/s6-remote.*`; this branch touched `dist/.../action-router/*` + `dist/.../control/*`) — the auto-merged union was then **REGENERATED from the merged source tree** per protocol: `packages/runtime` `pnpm run build` (tsc) + `packages/client` `pnpm run build` (tsc) + `pnpm run build:composition` (glue placement + client composition + `check-artifacts-committed`) — the regeneration produced **ZERO diff** against the auto-merged union (both sides' dists were current for their own source; the union IS the fresh build) | **REGENERATED + verified**: `pnpm run check:artifacts` = **OK 1372 files, EXIT=0** on the merged tree — "the merged dist is the canonical one" (no stale side kept: the check proves the committed/staged dist equals the fresh build of the MERGED source) |
| 3 | p4t6 scanner pin | the new #47 test file `remote-override-expected-generation.test.ts` — checked for scanner coverage | **PIN UNCHANGED (901)**: p4t6 runs 10/10 on the merged head — #47's new file is not in the scanner's scannable set (their own log confirms "p4t6 896 unchanged — zero new scannable files"; my 5 files from this branch keep 901) |
| 4 | every other file | auto-merged clean (no content overlap between the branches' change sets — source files are disjoint: #47 = effective-policy/s6-remote/governance tests; this branch = action-router/control/fix-control-authz tests + recovery-dispatch-helpers) | KEPT the merge (no manual resolution needed) |

Nothing from #47 was dropped, rewritten, or cherry-picked: the merge
carries their commits `ae51385b` / `958e96a3` / `5ada3453` / `80607c6b` /
`a509cffa` verbatim; their evidence dir
(`dev/agent-workflow/evidence/fix-effective-policy-reset/`, 39 files) is
in the tree untouched.

### Gates at the merged head (full re-test — the failed-set baseline REMAINS the `31ad828d` debt set; the #47 merge adds no failing tests — verified below)

| Gate | Result | Log |
| --- | --- | --- |
| Fix family + all prior pins (C 8, B 2, D 2, H 4, S6 10/10, recovery review 8/8, a6a 52) + control family + p6t4 + p4t6 @ 901 + #47's two suites (`remote-override-expected-generation`, `governance-reset-tombstone`) | **29 files / 228 tests GREEN**, EXIT=0 | `merged-focused-1.log` |
| Full `pnpm vitest run` | **9F files / 402P (411); 19F tests / 4728P (4747); EXIT=1 — failed SET DIFF vs the `31ad828d` debt set = EMPTY** (the exact 9 debt files / 19 debt tests; p6t1 flake 0 occurrences; #47 adds NO failing tests — 4747 = 4719 base + 13 this branch's new + 3 C6–C8 + 12 #47's new — arithmetic closes) | `merged-full-1.log` |
| `pnpm exec eslint .` | **142 (117E/25W), EXIT=1** — plain AND file-aware fp diffs vs the committed baseline = **exactly ONE deletion, zero additions/shifts**: `governance-reset-tombstone.test.ts 248:10 @typescript-eslint/no-unused-vars ('instanceSlotId' defined but never used)` — the PRE-EXISTING baseline debt #47 dropped when it deleted the dead test helper (documented in #47's own commit `ae51385b` + their log entry — a #47-introduced baseline change, NOT this branch's regression; recorded here per protocol as part of the new unreviewed changes) | `merged-lint-1.log` + `merged-fp-{plain,fileaware}.txt` |
| `pnpm run typecheck` (repo root, legible full log — per-package lines + final status, command line first, true exit last) | **EXIT=0** | `merged-typecheck-1.log` |
| `pnpm run check:artifacts` (legible full 1372-file verification output, command line first, true exit last) | **OK: 1372 files, EXIT=0** (also the `build:composition` step during the regeneration) | `merged-check-artifacts-1.log` |

## Residual P2 — the pre-first-durable-commit abort settlement (D1–D4) + the bounded C9 matrix

External review's residual P2 (the service race, NOT an arbitrary-GUI
unauthorized-execution claim): an invocation that aborts while QUEUED at a
pre-commit await settles with NO durable close — the Control allow stays
`decided`, no typed terminal, the waiter/retry world keeps polling a
request that can never resolve. One systematic settlement mechanism, no
per-hole catches (scope locked at D1–D4 + C9 exactly as designed):

- **D1 (action-router/effects.ts, `withTeamLock`)** — the map entry a
  later caller chains onto now settles only when BOTH the previous chain
  and this call have settled (the one-expression chain-tail fix): a
  cancelled waiter's tail keeps its queue slot — a later writer can never
  overtake the still-running holder (the reviewer's exact sequence:
  holder start → cancel waiter → later writer → holder end). The entry is
  still set SYNCHRONOUSLY per call (the C6/c9-serial entry-identity
  proofs are preserved).
- **D2 (action-router/router.ts, `performAction`)** — the systematic
  settle for an invocation that aborted BEFORE the effect commit,
  whichever pre-commit await the abort landed at (the runtime-chain queue,
  the pre-dispatch terminal snapshot at L632 (the `const terminalState =
  await controlService.listControlState(...)` statement — the `a2b3df79`
  position was L631, pre-D2), the gate re-probe, the
  unit's control-lock queue — gated AND fallback branches): the request
  is durably closed by the SAME unit the commit takes (a never-run
  `commitEffect`) and the invocation settles with the typed zero-effect
  abandon block. `effectCommitStarted` / `boundarySettled` tracking keeps
  the post-commit world byte-identical (a committed Phase A fact is never
  re-marked; `WORK_DELIVERY_FAILED` surfaces unchanged) and
  non-marker / non-aborted errors pass through untouched. Runs outside
  any chain hold (control lock alone) → no deadlock; composes
  idempotently with the pre-dispatch best-effort abandon and concurrent
  explicit abandons (exactly one mark).
- **D3 (activation/provider.ts + types.ts + errors.ts +
  admission/gate.ts + effects.ts wiring)** — the SECOND preflight on
  fresh create-member / delegate-create carried NO signal (an abort still
  created the member). `MemberActivationRequest` now threads the
  invocation signal + a marker-only `persistAbandonClose` callback; the
  provider checks FOUR pre-reservation boundary points (post-authority,
  post-v2-templateFacts, top of the provider-lock body, immediately
  pre-journal-reservation) and settles the close + rejects typed
  `ACTIVATION_REQUEST_ABORTED` (zero provisioning: no journal
  reservation, no child session, no member row). The gate maps it to the
  compatibility block (`status: 'ABORTED_PRE_RESERVATION'`); the router's
  `commitReviewedEffect` catch converts it — for marker requests — into
  the SAME typed abandon terminal as every other pre-commit settle
  (providerCode check). Non-marker creations get the typed abort with
  zero provisioning and no close (disclosed signal threading).
- **D4 (control/service.ts + types.ts)** — `persistAbandonCloseLocked` —
  the LOCK-FREE durable close for the pre-reservation boundary
  (precondition: the caller holds the control lock under the
  effect-admission unit; re-acquiring would deadlock). Resolves when the
  close is guaranteed (persisted here or already terminal); rejects only
  on the close persist fault (typed `DURABLE_WRITE_FAILED` — fail-closed).

**C9 (test/fix-control-authz-c-abandon-terminal.test.ts — pure addition
after C1–C8; C1–C8 byte-identical, verified: the only deleted line in the
file is the import line replaced by the extended import)**: the bounded
matrix — 4 actions (follow-up / delegate / create-member / send-message)
× 6 await points (decision-settle, terminal-snapshot L632 (L631 at
`a2b3df79` pre-D2), outer runtime
queue, outer gate success/reject, control queue, second preflight
[authority / provider-lock / external-facts]) × 2 pre-states + persist-
fault legs + post-commit rows = **60 rows + c9-serial** (the reviewer's
exact determinism sequence: map-identity proof captured BETWEEN the
holder and waiter calls — the entry is set synchronously per call).

| Leg | Result | Log |
| --- | --- | --- |
| GENUINE RED @ `a2b3df79` (pre-D1–D4) | **29 GREEN / 32 RED, EXIT=1** — the RED set is exactly the designed gap set: 4 terminal-snapshot no-mark + 8 outer-queue + 6 gate-reject + 12 second-preflight + 1 fault-preflight + 1 serial | `c9-red-baseline.log` |
| Focused file AFTER D1–D4 @ `b168870e` (+ envCall lint fix) | **69/69 GREEN, EXIT=0** (C1–C8 + 60 rows + c9-serial) — all 32 baseline-RED rows flipped GREEN; the 29 baseline-GREEN rows stayed green (no regression: post-commit rows still zero-mark via `effectCommitStarted`; decision-settle still the S6 race) | `c9-green-focused-1.log` / `c9-green-focused-3.log` |
| `pnpm run typecheck` (runtime) @ `b168870e` | **EXIT=0**. **RE-POINTED (r2 GATE-5 / r1 F2 / docs-delta #3 — one capture closes all three)**: the original claim cited `c9-green-focused-3.log` as its run context, which is a VITEST-ONLY log (no typecheck evidence in it). The authoritative fresh capture: `typecheck-b168870e-1.log` — CMD-first + true exit, `pnpm run typecheck` from `packages/runtime/` at a TEMP DETACHED worktree checked out at `b168870e` (the final committed bytes of the D1–D4 code head; node_modules symlinked from this worktree) | `typecheck-b168870e-1.log` |
| Full suite @ `b168870e` (2 runs) | **4788P/20F (4808)** and **4787P/21F (4808)** — the deterministic `31ad828d` debt set (19F + 3 collections) + ONE pre-existing load/timing flake rotating between `rmr-remote-mount-race` (run 1) and `p6t1-parallel` (run 2). Flake proven pre-existing: `p6t1-parallel` flakes 2/6 in isolation with the `a2b3df79` (pre-D1) production files restored in place (same 2 tests, same F/P pattern — the known flake family the #48 round already documented with its 0–2 envelope); `rmr` passes 3/3 isolated at this head. Neither flake involves the D1–D4 surface (no cancellation on the p6t1 parallel path; rmr is the remote connection-service bounded wait) | `full-b168870e-1.log` / `full-b168870e-2.log` |
| `pnpm exec eslint .` @ `b168870e` + envCall fix | **142 (117E/25W)** — fp-identical to the `a2b3df79` baseline except the +1 line shift in `router.ts` (the new `ACTIVATION_ERROR_CODES` import); the ONE new error (unused `envCall` counter in the C9 stub) was fixed and re-verified | `lint-b168870e-2.log` |
| dist @ `c948c62d` | regenerated (`pnpm -r run build` EXIT=0 + `build:composition` — its internal `check-artifacts-committed` step reported the then-uncommitted drift, as expected pre-commit) — 24 files, all under `packages/runtime/dist` for the D1–D4 modules; zero client/composition drift; `pnpm run check:artifacts` after the dist commit = **OK 1372, EXIT=0** | `build-b168870e-1.log` + `check-artifacts-c948c62d-1.log` |

## Controlled master sync round 2 (PR #46 + PR #48 — merge of `621fdba1`)

MASTER-MOVED mid-batch (user merged PR #48, authorized per-HEAD): new
master = **`621fdba1f9feaf7dc192f8c8e89e2b9c848881b7`** (parents
`8e18819c` + `73ed19d1`) carrying BOTH #46 (finding A: persona KIND
subject vs presetId — the requirement-facts provider kind path + 2 test
files) and #48 (findings I/J + I-residual: template availability gating
+ consent scope/hash binding — 3 test files + root.ts /
requirement-gate.ts / requirements/* / requirement-facts/* edits).
Re-verified `origin/master` = `621fdba1` immediately before merging.

Merge commit: **`0aef4d917657b5ceb0ebeb90a44fddf884cf7054`** (parents
`c948c62d4ac664bf63390018936db616d6663610` + `621fdba1`).

**Two-push disclosure (docs-delta #2)**: this sync round landed in TWO
plain pushes (zero force-push) — the checkpoint push
`a2b3df79`..`0aef4d91` (the merge itself, pushed as the PR checkpoint
per the parent's authorization) + the final bookkeeping push
`0aef4d91`..`bae0a7ae`. The PR #49 banner was updated at each head.
(The residual-3 batch — the next section — lands in ONE further plain
push from `bae0a7ae`.)

### Conflict-resolution list (EVERY resolution — NEW UNREVIEWED CHANGES)

Files that differ from BOTH parents after the merge (the complete set —
every other merged file is byte-identical to at least one parent):

| # | File | Hunk | Resolution |
| --- | --- | --- | --- |
| 1 | `dev/agent-workflow/SESSION_ROUTER_LOG.md` | the file tail (both sides appended entries after the common base `2bfbca12`) | **KEPT BOTH SIDES** verbatim, chronological: my four `2026-10-01` fix-control-authz entries (pass-1 / pass-2 / pass-3 / sync-1) FIRST, then the #48 + #46 entries (consent findings I+J, I residual, persona finding A, their sync entries) — byte-verified by the both-parents diff (the resolved file is the only file differing from both parents besides p4t6) |
| 2 | `packages/testkit/test/p4t6-session-event-scan.test.ts` | (a) the `it('coverage: …')` description string — both sides extended it; (b) the pin comment block + expects | (a) **KEPT BOTH SIDES**: master's extension (#48 consent + #46 persona clauses) with my `fix-control-authz` five-files clause appended after it; (b) **UNION of both comment blocks + NEW union comment, pin RECOMPUTED → 906**: `896` base + 2 `fix-persona-kind` files + 3 `fix-runtime-template-consent` files + 5 `fix-control-authz` files = 10 new scannable `.ts` files over the merge base — COMPUTED from the actual `git diff --name-status 31ad828d..621fdba1` (5 A-lines: the 2 persona + the 3 consent) + `31ad828d..c948c62d` (5 A-lines: my five) — union 10, disjoint. Scanner `.mjs`/`.d.mts` byte-identical (DEC-1 precedent). Probe FIRST (protocol): p4t6 ran 10/10 at the merged head BEFORE the bookkeeping commit — the scanner's authoritative count confirmed the computed 906 (old pins were 901 on BOTH sides — each side's own 896+5 union) |
| 3 | every other file | auto-merged clean — the two sides' change sets are DISJOINT (verified: #46/#48 touched `root.ts` / `requirement-gate.ts` / `requirement-facts/*` / `requirements/*` / `root-initial-work.ts` + their 5 test files + their evidence dir + their dist; this branch touched `action-router/{effects,router}` / `activation/*` / `admission/gate.ts` / `control/{service,types}` / my 5 test files + the shared spy + my dist + my evidence; zero `control/*` or `activation/*` files in the #46/#48 delta) | KEPT the merge (no manual resolution needed). dist: both sides' dists auto-merged (disjoint files); **REGENERATED from the merged source tree** (`pnpm -r run build` + `pnpm build:composition`) — the regeneration produced **ZERO diff** against the auto-merged union (clean tree after rebuild) — `pnpm run check:artifacts` = **OK 1372, EXIT=0** ("the merged dist is the canonical one") |

Nothing from #46/#48 was dropped, rewritten, or cherry-picked: their
commits land verbatim; the #46/#48 surface is **byte-identical to
master at the merged head** (verified: `git diff 621fdba1 0aef4d91 --
<persona/consent suites + root.ts + requirement-facts/ + requirements/ +
requirement-gate.ts + root-initial-work.ts>` = EMPTY — the A role
metadata survives byte-for-byte).

### Role-wiring re-audit on this branch's delta (per the MASTER-MOVED notice)

Question: does any file THIS branch added/changed construct a
requirement-scope (`RequirementFactScope` / `resolveFacts` template
scope) that would now need the #46/#48 closed-set `role`?

- Grep of all five new test files + the C file + the shared spy for
  `RequirementFactScope` / `resolveFacts` / `requirementFacts` /
  requirement `scope: {` / `kind: 'template'` requirement-scope
  constructions: the ONLY hit is `fix-control-authz-h-send-message.test.ts`
  L239 `subject: { kind: 'template', templateId: 'worker' }` — a
  **ControlSubject** (the control-request subject vocabulary, exercised
  INTENTIONALLY as the evidence-guard leg proving the real validator
  rejects the buggy template-subject-with-targetInstanceId shape with
  `CONTROL_REQUEST_MALFORMED`). The A contract governs the
  requirement-facts scope vocabulary, a DIFFERENT closed set; #46/#48
  touched ZERO `control/*` or `activation/*` files (verified from the
  master delta list), so the validator behavior that leg pins is
  unchanged at the merged tree (the suite re-ran GREEN there).
- The world fixtures the C9 matrix builds on (`p6t2-helpers.ts`,
  `fix-control-authz-helpers.ts`): `p6t2-helpers.ts` is unmodified on
  BOTH sides of the merge (not in either change set); the authz helpers
  construct CONTROL subjects only (same vocabulary audit).
- **Audit result: ZERO role-less requirement-template-scope
  constructions, ZERO `MALFORMED_DTO` exposure in this branch's delta.**
- Disposition confirmation: the merged-head focused run includes all
  five #46/#48 suites (114/114 GREEN with my C file — `merged2-focused-1.log`)
  and the full suite shows no new failures from the A-contract surface
  (failed set = the debt set + the documented flake family, below).

### Gates at the merged head `0aef4d91` (full re-test)

| Gate | Result | Log |
| --- | --- | --- |
| p4t6 probe (BEFORE bookkeeping — probe-first) | **10/10 GREEN @ pin 906**, EXIT=0 (the scanner's authoritative count confirmed the computed union) | `merged2-p4t6-1.log` |
| Focused: my C file (C1–C8 + C9 60 rows + c9-serial) + #46 persona suites (2) + #48 consent suites (3) | **6 files / 114 tests GREEN**, EXIT=0 | `merged2-focused-1.log` |
| Full `pnpm vitest run` | **10F files / 406P (416); 21F tests / 4837P (4858); EXIT=1** — failed set = the deterministic `31ad828d` debt set (t1-capability-schema 9 / t2-blueprint-hash 1 / d3-member-identity-context 1 / p6t3-mediation 5 / p6t3-restart 2 / p6t6-actions 1 = 19F + collections p8s3b-result-effects / t12a-b2-child-identity / t12a-glue-handoff-ports) + **`p6t1-parallel` 2F = the KNOWN flake family** (documented in the #48 round's own log entry with its 0–2 envelope: "p6t1-parallel 1–2F = 已知 flake 家族, 隔离重跑 ×3 全 9/9 GREEN"; pre-existence independently re-proven this batch by the in-place `a2b3df79`-files experiment — 2/6 isolated flakes WITHOUT the D1–D4 production changes; `rmr-remote-mount-race` passed this run). **SET DIFF vs the debt set = EMPTY except the documented flake family. Arithmetic closes exactly: 4858 = 4808 (this branch pre-merge) + 45 (the five NEW #46/#48 test files) + 5 (their +1 `requirement-facts.test.ts` + 4 `runtime-requirement-facts-provider.test.ts` — verified per-file against the pre-merge run's per-file counts; test-file count 411 + 5 = 416, zero missing/duplicate files)** | `merged2-full-1.log` |
| `pnpm exec eslint .` | **142 (117E/25W), EXIT=1** — same COUNT and same ISSUE SET as the `a2b3df79` baseline (file-aware fingerprint: zero additions, zero deletions); the only deltas are line-number shifts in 4 files — `action-router/router.ts` 83→84 (this branch's new `ACTIVATION_ERROR_CODES` import line — a pre-existing unused-import issue, shifted) + `requirement-facts/provider.ts` (3 shifted — #46/#48's own in-place edits) + `requirement-d1-d3-decision-scoping.test.ts` 340→341 + `runtime-requirement-facts-provider.test.ts` 42→44 (#46/#48's own test edits). **Zero new lint issues from this branch's delta or the merge** | `merged2-lint-1.log` + `merged2-fp-fileaware.txt` |
| `pnpm -r run typecheck` (repo root, legible full log) | **EXIT=0** | `merged2-typecheck-1.log` |
| dist regeneration + `pnpm run check:artifacts` | `pnpm -r run build` EXIT=0 + `pnpm build:composition` EXIT=0 — **ZERO diff** against the auto-merged union (clean tree after rebuild) — `check:artifacts` = **OK: 1372 files, EXIT=0** | `merged2-build-1.log` |

## Residual-3 — the pre-reservation REJECT region converges to the durable close + the one-shot close-failure contract + the marker move (NEW UNREVIEWED CHANGES)

Scope: the FROZEN bounded list (the parent's final ruling @ `bae0a7ae`,
which supersedes the earlier "converge each await site" phrasing), with
the folded panel findings of the same batch (r1 F1/F2, r2 GATE-4/5/6,
docs-delta #1–#4). Commits: RED `46e06794` (committed before any
production change, per the RED-first red line) → fix `753108be` →
dist `c650bd47` → this bookkeeping commit.

### The defect (verified in code at the pre-fix head)

The D3 preflight checks the abort signal at four CHECK POINTS — all
placed for the FULFILLMENT case (the await RESOLVED, then check). A
pre-reservation await that REJECTS while the signal is already aborted
(the legacy externalFacts probe, the v2 template-scope feed) escaped
RAW: the router's `effectCommitStarted` had flipped at the unit-closure
ENTRY (`router.ts` L817 @ `bae0a7ae` — BEFORE the provider preflight
even ran), so the D2 outer settle was deliberately skipped → zero
durable close; the request stayed `decided` with the raw error as its
settlement (the residual-3 hole: an abort at the pre-reservation
REJECT case settles with no close).
Defect (c), independently: with a one-shot close persist fault, the D2
catch RE-ATTEMPTED an already-failed boundary close — the second
`ledger.put` succeeded (the one-shot fault consumed), and the typed
abandon terminal MASKED the first close failure as a settled close.
The always-fail fault leg (c9-60) masked this in the matrix: an
always-faulting close rejects BOTH attempts identically, so the
terminal is indistinguishable.

### The frozen site list — verdicts (line numbers at `bae0a7ae`; the post-fix positions in parentheses)

| # | Site | Line @ `bae0a7ae` (post-fix) | Verdict | Disposition |
| --- | --- | --- | --- | --- |
| 1 | `authority.evaluate` await (the first preflight await — region START) | L721 (L782) | check1 (L728 @ base) fires BEFORE the `chainOk=false` handling (L731 @ base) → the returned-`chainOk=false` case is ALREADY COVERED (aborted → check1 settles first; non-aborted → original rethrow kept) | verify + record — no behavior change; the leg-1 region wraps it regardless |
| 2 | v2 template-scope feed awaits (`templateEnvironmentFactsReadForBlueprint` / `templateEnvironmentFactsForBlueprint`) | L771 / L777 (L833 / L839) | a REJECT jumps PAST check2 (L789 @ base) — UNCOVERED | covered by the leg-1 region convergence (reject while aborted → settle) |
| 3 | the provider lock acquisition (`withTeamLock`) | L987 (L1053) | check3 (L991 @ base) NORMAL — covers the FULFILLMENT case at the lock body top | verified, recorded, unchanged |
| 4 | the legacy externalFacts probe | L1023 (L1102) | may REJECT, or RESOLVE with bad facts so the policy/field validation THROWS — both escape PAST check4 (L1077 @ base) — UNCOVERED | covered by the leg-2 region convergence (reject/throw while aborted → settle) |
| 5 | check4 (immediately pre-reservation) | L1077 (L1152) | FULFILLMENT case | verified, unchanged |
| 6 | `coordinator.allocate` (the FIRST durable write) | L1090 (L1185) | the region END boundary — EXCLUDED by the frozen scope | the marker block flips at this boundary (immediately before the call) |

### The fix (production — exactly the frozen design)

- **(a) the pre-reservation region as ONE scoped region** —
  `activation/provider.ts`: a single convergence rule
  (`settlePreReservationIfAborted`, L767) applied at the TWO LEGS the
  provider-lock acquisition splits the region into. Leg 1 (pre-lock):
  `authority.evaluate` (L782) → the v2 template-scope feed awaits
  (L833/L839) → the sync classification/throws; leg 1 catch = L1048.
  Leg 2 (lock body): check3 (L1067) → steps 7–11 incl. the step-8
  `externalPolicyFacts` await (L1102) + validation → the
  provisionRequest literal; leg 2 catch = L1171. ANY reject /
  validation throw inside a leg converges to the EXISTING settle
  (the durable close + typed `ACTIVATION_REQUEST_ABORTED`
  zero-provisioning abort) when the signal is ALREADY ABORTED; a
  non-aborted reject keeps its normal failure path (the leg rethrows
  the original error unchanged — byte-identical behavior). Region
  START = L782 (the first preflight await); region END = strictly
  BEFORE L1185 (`coordinator.allocate` — the first durable write; the
  allocation and ALL later provisioning steps are EXCLUDED — an abort
  landing after the reservation is the legitimate late close, never
  retroactively undone). Boundary flags: `settleInFlight` (L765 — set
  synchronously before EVERY settle: the 4 check points + both leg
  catches) keeps a settle's own rejection from being re-converged
  (exactly one close attempt); `preReservationDone` (L766, set in the
  marker block L1183–1184 immediately before the allocation) ends the
  region for the reject path. Hoisting (type-scope only, zero behavior
  change): the single escaping pre-lock declaration
  (`compatibilityStatus`) + the region-produced / post-reservation-
  consumed declarations (`policy` / `fields` / `instanceId` /
  `coordinator` / `provisionRequest`) moved to the enclosing scope —
  assigned inside the region; every region catch path always throws,
  so the post-reservation steps only run after complete assignments.
- **(b) the abort-close callback write failure ESCAPES AS-IS** — no
  retry, no reclassification (the service-level
  `persistAbandonCloseLocked` already rejects as-is; the
  effects-level wrapper now marks the fault observed and rethrows the
  ORIGINAL error unchanged — the `c9R3ExternalFactsReject` one-shot
  leg asserts the injected fault text surfaces verbatim in the typed
  `TEAM_RUNTIME_DURABLE_WRITE_FAILED`).
- **(c) the one-shot close-failure fix** — the router D2 settle never
  re-attempts a failed close: the new `closeFaultObserved` flag
  (router.ts L749, set via `ctx.markCloseFaultObserved` from the
  `persistAbandonClose` wrapper's catch — effects.ts L1006/L1153 —
  mark + rethrow as-is) is a conjunct of BOTH D2 settle conditions
  (gated L1075, fallback L1136). Before: a second attempt would have
  succeeded on a one-shot fault and masked the first failure as a
  settled close; after: the first close failure is the TERMINAL
  outcome (one abandon `ledger.put` attempt — the one-shot test
  asserts `attempts() === 1` + the injected fault text in the
  terminal).
- **the marker move** (required so pre-reservation rejects don't
  falsely disable the outer-catch settle): `effectCommitStarted` no
  longer flips at the unit-closure ENTRY (the `commitEffect` closure
  at router.ts L817 @ `bae0a7ae` — the flip REMOVED; the non-marker
  branch's own flip, now L828, is pre-existing D2 behavior and stays).
  It flips at each effect's OWN first durable write instead: the
  activation effects via the new `MemberActivationRequest
  .markReservationStarted` (provider.ts L1184 — the provider calls it
  immediately before `coordinator.allocate`); follow-up +
  delegate-continued at `admitWorkOn` top (effects.ts L534/L554);
  SEND_MESSAGE before the coordination `commitFact`; REPORT_PROGRESS /
  REQUEST_CONTROL / RESOLVE_CONTROL before their coordination
  `commitFact`; runLifecycle after `requireFreshTarget` (before the
  ports await — a sync-only window: the non-activation marker effects
  keep their pre-move timing semantics, zero behavior change). Post-
  reservation the flag stays true (no retroactive undo); the provider
  preflight stays PRE-COMMIT (it runs before the marker fires).

### Before/after (representative lines)

```diff
// activation/provider.ts — region leg 1 (before: raw await, raw escapes)
-      const admission = await authority.evaluate({ ... })
+      try {
+        const admission = await authority.evaluate({ ... })
+        ... // v2 template-scope feed awaits (L833/L839), classification
+        compatibilityStatus = admission.status as CompatibilityStatus
+      } catch (error) {
+        throw await settlePreReservationIfAborted(error)  // L1048
+      }
```
```diff
// action-router/router.ts — the marker + the D2 gate (before/after)
-        commitEffect: () => {
-          effectCommitStarted = true           // ← unit-closure ENTRY flip (removed)
-          return executeEffectLocked(ctx)
-        },
+        commitEffect: () => executeEffectLocked(ctx),  // flip moves to each effect's own first durable write
...
-            !effectCommitStarted && !boundarySettled &&
+            !effectCommitStarted && !boundarySettled && !closeFaultObserved &&
             ...
```

### The RED (committed-bytes authoritative — per the user ruling)

| Capture | Head | Result | Log |
| --- | --- | --- | --- |
| **AUTHORITATIVE committed-bytes RED** — temp DETACHED worktree @ `a2b3df79` (the real pre-fix base: D1–D4 + C9, no residual-3 fix) + the FINAL committed test bytes + node_modules symlinked from this worktree | `a2b3df79` | **35F / 37P / 72** = 31 matrix rows + c9-serial + the 3 residual-3 rows | `c9-red-baseline-v2.log` |
| focused C file at the bookkeeping head (production still un-fixed) | `bae0a7ae` | **3F / 69P / 72** — only the new rows RED; the 69 pre-existing rows GREEN (incl. the 4 choreography-corrected rows — they stay green because they assert the OUTCOME, and the old and the corrected choreography both produced the right outcome via different paths; the correction is a SITE-PROOF fix, not an outcome change) | `c9-red-currenthead-1.log` |

The old `c9-red-baseline.log` (same head, earlier capture) is KEPT as
history, NEVER rewritten; its c9-serial line was captured with a
DIFFERENT (uncommitted dev) test body — see the F1 disclosure below.
`c9-red-baseline-v2.log` is the authoritative RED pin: the final
committed regression FAILS on the real pre-fix base with IDENTICAL
test bytes.

### The GREEN

| Capture | Result | Log |
| --- | --- | --- |
| focused C file at the fix head | **72/72 GREEN** (69 pre-existing + 3 residual-3 rows; C1–C8 + the untouched matrix rows byte-identical behavior) | `c9-green-1.log` |

### Gates at the fix head (all CMD-first + true exit)

| Gate | Result | Log |
| --- | --- | --- |
| Full `pnpm vitest run` (worktree ROOT — the full-suite protocol) | **4861 total** = 4858 (pre-batch) + 3 new rows. Capture 1: **22F / 4839P** = the deterministic debt set (t1-capability-schema 9 / t2-blueprint-hash 1 / d3-member-identity-context 1 / p6t3-mediation 5 / p6t3-restart 2 / p6t6-actions 1 = 19F + collections p8s3b-result-effects / t12a-b2-child-identity / t12a-glue-handoff-ports) + `p6t1-parallel` **3F** (the P3 quota-race rows — see the flake-envelope note below). Capture 2: **19F / 4842P = the debt set EXACTLY** (`p6t1-parallel` 9/9 that run) | `full-final-3.log` + `full-final-4.log` |
| `p6t1-parallel` isolated re-runs ×3 (flake-rotation check) | 1F / 8P → **9/9 → 9/9** (the rotating pre-existing flake family; no deterministic failure at this head) | `p6t1-rerun-{1,2,3}.log` |
| `pnpm exec eslint .` (worktree root) | **142 (117E/25W), EXIT=1** — file-aware fingerprint IDENTICAL to the `bae0a7ae` (merged2) fp: **zero additions, zero deletions, zero line shifts**. Vs the `a2b3df79` baseline: the one documented deletion (the #47 `governance-reset-tombstone.test.ts` debt — a #47-introduced baseline change) + 25 `Unused eslint-disable directive` warnings whose referenced rule this fp batch normalizes (the baseline file stored the quoted message tail `'@…')` for the same 25 warnings — same files, same counts) | `lint-final-4.log` + `lint-final-fp-fileaware-4.txt` |
| `pnpm run typecheck` (runtime) at the fix head | **EXIT=0** | `typecheck-3.log` |
| `pnpm run typecheck` (runtime) @ `b168870e` — the FRESH capture (r2 GATE-5 / r1 F2 / docs-delta #3, one capture closes all three; the old claim's cited log was vitest-only) | **EXIT=0** | `typecheck-b168870e-1.log` |
| dist regeneration + `pnpm run check:artifacts` | `pnpm -r run build` EXIT=0 — drift = 12 files, ALL under `packages/runtime/dist` for the 4 changed production modules (effects/router/provider/types × .js/.d.ts/.map); zero client/composition drift; `check:artifacts` after staging = **OK: 1372 files, EXIT=0** | `build-3.log` + `check-artifacts-3.log` |
| p4t6 probe | **10/10 GREEN @ pin 906** (this batch adds ZERO new scannable files — every change is in-place) | `p4t6-3.log` |

### Disclosures

- **F1 (r1) — the c9-serial committed-bytes RED + the user ruling
  (GOVERNING — supersedes r1's `sleep(1)` suggestion).** The
  committed c9-serial is NOT a deterministic RED on the old tail by
  its own bytes: the old (pre-fix) `withTeamLock` releases the waiter
  in a `.finally` chain such that the LATER WRITER's `withTeamLock`
  call completes its map-entry read 2 microtasks after its call,
  while the HOLDER's continuation (the `finally` → release path)
  needs only 1 microtask after the release — the holder ends 1
  microtask AHEAD of the later writer's entry on a cold queue: a
  one-microtask scheduling-luck pass. The old `c9-red-baseline.log`'s
  serial line was captured with an UNCOMMITTED DEV test body
  (a polling loop with a 3264ms fingerprint in the log) — that log is
  KEPT as history, NEVER rewritten, and is disclosed here;
  `c9-red-baseline-v2.log` (final committed bytes, `a2b3df79`) is the
  authoritative RED. The user ruling: the final committed regression
  MUST fail on the real pre-fix base with identical test bytes; NO
  arbitrary microtask/timing dependence (`sleep(1)` WITHDRAWN); use an
  EXPLICIT LATER-WRITER-ENTERED BARRIER (the asserted order
  holder-start → waiter-rejected → holder-end → later-writer-entered;
  broken base: entry observable while the holder is still running →
  the correct-ordering assertion FAILS deterministically; fixed base:
  entry structurally impossible before the holder ends → passes).
  Implementation note (the one deviation, disclosed per protocol): the
  LITERAL "wait for entered, then release" DEADLOCKS on the FIXED
  base — in the fixed code the later writer's entry is structurally
  impossible before the release (the D1 one-expression chain-tail
  fix), so a bare await on `laterEntered` would hang. The test
  therefore observes entry through a BOUNDED window (`withTimeout
  (laterEntered, 2000).then(() => true).catch(() => false)`):
  broken base → entry = a PENDING MICROTASK, and the spec event-loop
  ordering guarantees all pending microtasks drain before ANY timer
  callback → the window sees the overtake in ~1ms (observed: the
  assertion fails in 1ms, no window wait); fixed base → the window
  EXPIRES (observed 2003ms) → release → the correct order holds. The
  window length cannot change either outcome — for ANY window W ≫ the
  microtask-drain time: broken base → the entry (a pending microtask)
  is observed at a delay ≪ W, because the spec event-loop drains ALL
  pending microtasks before ANY timer callback, so the overtake is
  recorded long before W and the order assertion FAILS; fixed base →
  the entry is structurally impossible before the release, so the wait
  hits W's timeout → release → the correct order holds — no choice of
  W can flip either outcome (the two premises: microtask-before-timer
  is a language guarantee; structural impossibility is a code
  property). The final event-order assertion is UNCHANGED from the
  ruling. The CURRENT TAIL production fix STANDS unchanged (the
  entered barrier revealed NO defect in the production seriality
  logic — ruling item 5: report first, and there was nothing to
  report).
- **The false-C9-barrier choreography correction (rows
  c9-17 / c9-18 / c9-58 / c9-59 — the EXACT set).** Old body: the
  holder A released its own barrier and then FELL THROUGH into
  `bExtBarrier` — the holder occupied B's slot, so B was parked at
  CHECKPOINT 3 (the provider-lock top) instead of its step-8
  externalFacts probe: the rows passed on the WRONG site (false
  coverage of the externalFacts probe site). Corrected: the holder
  RETURNS after its own barrier; the abort is gated on B's EXPLICIT
  externalFacts-ENTERED event (B's own step-8 probe call — call #2 —
  parked, resolved = B is entered at its intended site: the per-row
  SITE PROOF). The `ppl` (provider-lock queue) branch keeps its
  `sleep(20)` (its site is the queue, not the probe). No other row
  changed; C1–C8 remain byte-identical.
- **The residual-3 rows (pure addition — 3 rows, the
  MatrixPoint union extended with the 3 new point names; the 60-row
  matrix untouched).** `c9-r3-1` = v2 template-scope feed REJECT:
  the v2 world variant (the `P6T2_V2_BLUEPRINT_SOURCE` — worker
  template with a structured requirement `worker-mcp-base` /
  `type: 'mcpServer'` / `complete: true` (a v2 closed-field: no
  `optional` in v2, so `complete: true` is structurally satisfied,
  never fatal) + the v1 flat `requirements` block stays legal in v2
  docs (the team scope stays compat-blocked, exactly like the
  existing v2 rows) + `scopeRequirementInputsOf` populates
  `templates['worker']` → `targetTemplateInputs` → the feed await is
  live); the feed port parks on B's call, the site proof fires, the
  preState abandon + `ac.abort()`, the port REJECTS → converges to
  the settle (the c9AssertClose outcome). `c9-r3-2` = the legacy
  externalFacts probe REJECT (park → site proof → abort → reject →
  settle, same assertions). `c9-r3-3` = the ONE-SHOT close-failure
  leg: the close persist fault is injected to fail EXACTLY ONCE
  (the `c9PatchAbandonPersistOneShotFault` counted wrapper — fails
  the first `control-request-abandoned` put, restores after);
  assertions: the terminal = the FIRST close fault verbatim (typed
  `TEAM_RUNTIME_DURABLE_WRITE_FAILED` carrying the injected text —
  NOT the typed abandon), zero work/delivery/coordination effects,
  member count at baseline, ZERO abandonment marks, and
  `attempts() === 1` (the D2 settle did NOT re-attempt the failed
  close).
- **r2 GATE-6 — the blanket log-annotation pass (committed logs are
  NEVER rewritten — annotated instead).** Every pre-standard log in
  this evidence directory (captured before the CMD-first + true-exit
  convention was adopted this batch) is annotated HERE with its exact
  command + true exit + capture context, so no reader has to
  reconstruct provenance: the 20 pre-standard logs (pass-1/pass-2/
  pass-3/sync-1/b168870e-era: `changed-*.log`, `red-toctou-*.log`,
  `baseline-full.log`, `baseline-lint-*.log`, `full-b168870e-*.log`,
  `lint-b168870e-*.log`, `build-b168870e-*.log`,
  `check-artifacts-c948c62d-*.log`, `c9-*.log` pre-v2,
  `changed-full-1.log`, `changed-lint-*.log` + their fp files) + 1
  MINOR correction: `lint-final-1.log`'s exit annotation said
  `LINT_EXIT=…` for the eslint invocation — the true exit is the
  same value (eslint exits 1 on lint findings); the label was
  normalized in the annotation, the log bytes untouched.
  `baseline-full-2.log` is the CITED full-suite debt-set baseline
  (the valid-environment one); `baseline-full.log` (the degraded-
  environment run) is already annotated as NOT the cited baseline.
  All captures from 08:03 onward (this batch + the merge round) are
  fully CMD-first + true-exit compliant in the committed bytes.
  The `*-fp-fileaware*.txt` files are DATA FINGERPRINTS (the file|
  line:col|rule triples) — the eslint command lives in the PAIRED
  lint log (`lint-*.log`), per the annotation protocol.
- **p6t1-parallel flake envelope**: capture 1 of this batch's full
  runs showed 3F (the P3 quota-race rows) — BEYOND the previously
  documented 0–2F envelope; capture 2 showed 19F (the debt set
  exactly, `p6t1-parallel` 9/9); isolated re-runs 1F → 0F → 0F.
  Same pre-existing rotating flake family (the rows ROTATE between
  runs — P1 N=2 rows in the first runtime-package run, P3 rows in
  full capture 1, none in capture 2; no deterministic failure at
  this head; the family's pre-existence was independently re-proven
  in the merge round by the in-place `a2b3df79`-files experiment).
- **r2 GATE-4 — `.tmp-c-test.diff`**: NOT present at the push head
  (verified by `find` across the repo root + all worktrees at
  bookkeeping time — already absent; the worktree is pristine apart
  from the batch's own committed files).
- **r1 F3 (NOTE — no action)**: the merge commit `0aef4d91`'s message
  quotes #48's "901" pin line while the MERGED pin is 906 (the union
  recompute documented in the sync-2 conflict table). The commit
  message text is historical (the #48 side's own number); the
  committed test bytes carry pin 906 and the probe confirmed 10/10.
- **docs-delta #1** — the four `L631` citations (this report's D2 +
  C9 bullets; the router log's D2 + C9 bullets) bumped to L632 (the
  `const terminalState = await controlService.listControlState(...)`
  statement's position post-D2; it was L631 at `a2b3df79` pre-D2).
  **docs-delta #2** — the two-push disclosure in the sync-2 section
  above. **docs-delta #4** — the fp-fileaware data-fingerprint note in
  the GATE-6 annotation above.

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
11. **Third pass — shared spy interface-surface completion** (`recovery-dispatch-helpers.ts`): the shared recovery-dispatch spy gained `commitEffectIfAuthorized` (transparent: it holds no durable abandon mark — empty `listControlState` — so it runs the effect commit, the real service's no-mark path). The C-1 fix routes the coordination reentry through the unit, which the spy must expose (previously the bypass masked the missing surface). A test-helper completion, NOT a weakening: the affected test (`recovery-send-message-review` #3, allow → exactly-one delivery) keeps its exact assertions and now exercises the real boundary path.

## Red-line compliance

- CORE PATCH BUDGET = 0 — upstream / test-use zero-touch (test-use verified pristine @ `46a7f68b09` with a valid build).
- Push: the first pass performed NO push (branch was local at `c4bb2c53`/`41e53c98`). The second pass performed the ONE PLAIN push the parent explicitly instructed for this PR flow (the new head to origin `fix/control-authz-boundary` — PR #49 update; no force-push, no other ref).
- No :3080 / :3180 / ~/.dsh / host instances touched; no model/config changes.
- Scope = B/C/D/H only; no debt fixed; no existing test weakened or deleted (the 2 disclosed pin adjustments are identity updates, not weakenings).
- `dev/agent-workflow/graph.yaml` untouched.
- 1 task = 1 worktree = 1 writer (`.worktrees/fix-control-authz`); main tree + sibling worktrees untouched.
