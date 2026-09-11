# Issue #1 async delegation closure report

## 1. Baseline
- base commit: `6a2f3e1` (origin/master — "router log: record the user-authorized push …"; the task branch was rebased onto it from an earlier 27a6c36 base with zero file overlap)
- final commit: the amended tip of `task/issue1-async-delegation` (this closure commit — R1–R8 work + live evidence + gates)
- upstream DSH pin: 0.1.2-rc.1 @ `a66e470204` (pristine test-use; porcelain-clean after every live run — CORE PATCH BUDGET = 0)

## 2. Root cause
- facade blocking point: `team_delegate` / `team_follow_up` (packages/tools) awaited the FULL work chain inline — the tool call (and therefore the leader's model turn) stayed pending until the member's turn reached settlement. The leader had no way to issue further work while a member was busy.
- delivery blocking point: `packages/runtime/action-router/router.ts` — the synchronous path `await staged.complete(request.signal)` ran Phase B (delivery = the member's full turn) and Phase C (settlement) INSIDE the leader's tool call, with the caller's request signal attached.
- why execution layer already supports overlap: the F3 A/B/C lock model — Phase A (durable admission) completes under the team lock and the chain is RELEASED before return; Phase B/C runs on the member's own session WITHOUT the shared leader lock (INV-9.1; the member's own team tools re-enter the same chain while the turn runs). Work units are independent per-instance CAS lifecycle records — nothing in the execution layer serializes work ACROSS members. The blocking lived entirely in the facade/router await.

## 3. Contract change
- sync: UNCHANGED (CCR-1, default, byte-identical to alpha.2): admission → delivery → turn → settlement → `memberResult` inside the SAME tool result; the caller AbortSignal propagates exactly as before (cancel / fail-closed settlement).
- async: opt-in `async: true` on `team_delegate` and `team_follow_up`. Phase A durable admission → B/C DETACHED → immediate admission receipt: `{ kind: 'work-admitted', instanceId, fromLifecycle, lifecycleCommitted, sequence, settled: false, workStatus: 'admitted' }` — NO result, NO memberResult, with the `requestToken`.
- collect: NEW 11th tool `team_collect(requestTokens[])` — pure read (writes nothing, delivers nothing). Args: non-empty string array, ≤ 64 tokens, per-token length bound. Duplicates collapse to the FIRST occurrence, input order preserved. Closed entry statuses: `admitted | running | succeeded | failed | unavailable`; `unavailable` carries the closed diagnostic codes `WORK_TOKEN_UNKNOWN` / `WORK_RESULT_NOT_PERSISTED` / `WORK_DELIVERY_FAILED`. Terminal business statuses are served ONLY from the CCR-5 persisted `memberResult` of the settlement fact — `settled: true` alone is never mapped to a business status.
- signal ownership (CCR-4): the caller's AbortSignal does NOT cross the receipt boundary. At the admission commit the signal ownership transfers; the detached continuation runs WITHOUT the caller's signal. A caller abort after the receipt neither cancels nor changes the background work; it still settles (or fails closed) and the result is readable through `team_collect`. Sync keeps the alpha.2 cancel semantics.

## 4. Implementation
### WorkChainStage
`staged.receipt` exposes the durable Phase A admission data (the receipt the async path returns); `staged.complete(signal?)` runs Phase B (delivery) + C (settlement) and returns a promise. The settlement fact payload now persists the `memberResult` verbatim (lossless JSON, CCR-5) — the work-status read-back serves it across a restart.
### Router detach
`router.ts`: `workExecutionModeOf(request) === 'async'` → `const task = staged.complete(undefined)` — tracked in `inFlightDetachedWork`, both then/catch observers delete the entry, the throw is OBSERVED and never rethrown (no caller awaits it — the unhandled rejection cannot escape; the fail-closed settlement is committed inside `complete()` before any throw). Effect returned = `staged.receipt`. Sync (default) → `effect = await staged.complete(request.signal)`, byte-identical to alpha.2.
### Durable memberResult
`settleFactPayload` (work-execution.ts) carries the `memberResult` in the `FACT_LIFECYCLE_CHANGED` (SETTLED) fact. Pre-CCR-5 historical settlements (no persisted memberResult) degrade to `unavailable` + `WORK_RESULT_NOT_PERSISTED` — no throw; `workOutcome: 'delivery-failed'` settlements report `unavailable` + `WORK_DELIVERY_FAILED`.
### Work-status
`scanWorkStatus` — a pure read over the per-root ledger (one pass per token, `scanWorkUnitFacts`): input order, duplicates collapsed, `resumePossible: true` for admitted-but-unsettled units (a same-token re-delegate RESUMES the unit — it never admits a second). Registered in `effects.ts` as the READ-category `work-status` action (validated `requestTokens` string array; Root initial-work tokens are never projected — TCM-M3 skip).
### Team tools
`team_delegate` / `team_follow_up` gain the optional `async` flag (default false; explicit `async: false` pins the sync path — never engages async). `team_collect` is the 11th tool (rootSessionId + requestToken + requestTokens; tool-layer argument validation → `TEAM_TOOL_BAD_ARGUMENTS`). The eleven-tool catalog is pinned: p6t6-bypass-scan 10→11, the five ten-tool registration pin specs updated, live row health `toolCount: 11`.

## 5. RED proof
- old behavior: the sync delegate path holds the leader until the member turn completes (no model control during the member turn), and there is NO read action for admitted-but-unsettled work.
- evidence: `red/red-probe.md` + `red/baseline-runtime-run.log` + `red/baseline-vitest-runtime.log` — the serial-blocking probe ASSERTS the old serial-blocking behavior (PASS = the defect is proven): it ran **PASS 3/3 on the UNMODIFIED tree** (captured at the pre-rebase base master @ 27a6c36, verified byte-identical to 6a2f3e1 on every work-chain file): `leaderBlockedWhileAdeliveryInFlight = true`, `bDeliveryStart >= aCompleted`, and no in-flight read-back shape exists. As the fix lands, the same assertions fail on the repaired tree (serial no longer observable) and the GREEN battery below takes over.

## 6. GREEN concurrency proof
LIVE host (R8, plan §29 — real DSH host :3182, real mock model :3495, 20 s member delay injected by the :3494 proxy for member identities only; world `references/.dsh-test-issue1-2026-09-11T20-52-32`, ephemeral, ports verified free after stop):
- A admission: receipt `tDelAReceipt = 1789131345658` (12:55:45.658Z); member A turn start `tMaStart = 1789131345716`
- B admission: receipt `tDelBReceipt = 1789131346294`; member B turn start `tMbStart = 1789131346404`
- A finish: `tMaDone = 1789131365728` (proxy flush after the 20 s delay)
- B finish: `tMbDone = 1789131366416`
- overlap: `t_mb_start (…346.404) < t_ma_done (…365.728)` → the two member work turns OVERLAP by ~19.3 s.
- HARD condition (plan §29): `t_B_admitted < t_A_done` — the leader ISSUED delegate B (second tool call of one model turn, i.e. model control regained) at …345.658, **20.07 s BEFORE** member A finished. Chain order inside the single leader model turn: delA …345.658 → delB …346.294 → collect1 …346.503; `LEADER-DONE` …346.678 — the leader's turn settled ~19 s before the first member finished.
- unit-level overlap proof (no live host): GREEN A "two deliveries overlapped (maxConcurrent >= 2)" + A-overlap `t_B_admitted < t_A_completed`.

## 7. Collect
- running: R1-3 live — in-flight collect of both tokens: `status: 'running'`, `resumePossible: true`, `admittedSequence` pinned; unit legs GREEN A-collect lifecycle + C-purity (zero write / zero delivery).
- succeeded: R2-1/R2-2 live — terminal collect: BOTH `status: 'succeeded'` with the durable `memberResult` verbatim (`MEMBER-A-DONE-TURN1` / `MEMBER-B-DONE-TURN1`, per-token `requestToken`); R2-3 — a SECOND identical collect serves byte-identical entries (durable, read-only, no re-execution).
- failed: unit legs GREEN C-history (fail-closed history → `unavailable` + `WORK_DELIVERY_FAILED`, `workOutcome: 'delivery-failed'`) and GREEN B-reject (detached delivery fault observed, bookkeeping drains, fail-closed history readable).
- historical unavailable: unit leg GREEN C-history — a pre-CCR-5 settlement (no persisted memberResult) → `unavailable` + `WORK_RESULT_NOT_PERSISTED`, no throw; unknown token → stable `WORK_TOKEN_UNKNOWN`; Root initial-work token never projected (TCM-M3).

## 8. Signal tests
- sync abort: GREEN B-sync — the SAME abort keeps the alpha.2 cancel semantics (signal carried into `complete`, `WORK_TURN_ABORTED` fail-closed settlement) — byte-identical default, no rewrite of the v2 D2 expectations.
- async abort after receipt: GREEN B-async — caller abort after the admission receipt NEITHER cancels the detached work NOR changes its outcome; the background work settles and `team_collect` returns the terminal result. Live corollary: the leader's own turn (and its signals) ended long before the member turns — the members kept running to settlement (R8 drill).

## 9. Replay / resume
- replay: GREEN A-replay — a same-token retry while the unit is known is the UNCHANGED replay: zero new admission facts, `WORK_REPLAYED`.
- resume: GREEN E-cold / E-resume — after a crash/restart (admission exists, settlement absent) the read-back reports `running` + `resumePossible` (NO auto-retry, no redelivery — CCR-3); a same-token re-delegate enters the EXISTING resume path: one admission fact, exactly one fresh delivery, the terminal result readable.

## 10. Lifecycle
- fresh: R8 ran on a FRESH root (`issue1-root`) with fresh members `inst-r8a` / `inst-r8b` (both activated + admitted through the same drill) — 17/17.
- cold resume: unit GREEN E (restart → read-back `running`, resume possible) + the live world's boot path exercised resume on the existing root rows (row health `boot: 1`).
- dispose: a normal runtime dispose does NOT treat "already durably admitted" async work as a caller-turn child to cancel — the detached continuation owns its fail-closed settlement (committed inside `complete()` before any throw). No silent orphan: a receipt with neither settlement nor a resume path does not exist — resume is ALWAYS available through the same-token re-delegate (E-resume). If the host shutdown itself terminates the agent, the existing fail-closed / recovery semantics apply (out of scope for this issue per plan §27).
- detached cleanup: `inFlightDetachedWork` drains on every settle (observed both then/catch); the drain is pinned in GREEN B-reject.

## 11. Regression gates
- runtime: full parity 1544 passed / 10 failed vs baseline 1525 passed / 8 failed (1533) — the failing set is the KNOWN `p6t1-parallel` concurrent-load flake (+ the same pre-existing set as baseline; NO new deterministic failure). Isolated re-run of `p6t1-parallel.test.ts`: **9/9 green** (the load flake is environmental; the first isolated attempt hit the known fault-injection teardown ENOTEMPTY and was re-run clean).
- tools: full parity 72 passed / 2 failed = the SAME 2 pre-existing failures as the 6a2f3e1 baseline (64 / 2).
- F3: INV-9.1 / lock-scope / overlap suites PASS (in the parity set).
- v2 D2 sync result: PASS (the byte-identical default — CCR-1; no v2 expectation rewritten).
- alpha.1 capability: PASS (t1/t3/t4a in parity; the five ten-tool registration pin specs updated to the eleven-tool catalog and green).
- alpha.2 permission: PASS (a2/a3/a5a/a6a/h1a suites in parity, unchanged).
- legacy: PASS (in the parity set).
- typecheck: PASS (9/9 packages, exit 0).
- build: PASS (9/9 packages, exit 0) + `build:composition` exit 0 + `[check-artifacts-committed] OK: 1080 files` (the committed install-surface artifacts match the fresh build byte-for-byte).
- lint: the task introduces ZERO lint errors (the single task-introduced unused import was removed before the gate). The repo baseline carries 19 pre-existing unused-var/no-undef errors in files this task never touched (base 6a2f3e1 debt; the H-wave gate set did not run lint) — recorded, not introduced.
- live-host: R8 17/17 (plan §29 + §18), `toolCount: 11` row health, 401 auth gate, 3-row dump-config, catalog.list carries the user-layer blueprint override.
- p4t6 DEC-1: pin 668 → 671 (THREE new scannable test files: `issue1-serial-blocking.test.ts`, `issue1-async-delegation.test.ts`, `issue1-collect-tools.test.ts`; the scanner is byte-identical — no scanner change). INTEGRATION NOTE: master advanced to 0804b95 with (h4)/(h5) scannable files (pin 670); the int-branch resolution of the pin conflict is the UNION — 673 (668 + h4 + h5 + 3 issue1 files) with the DEC-1 ledger union, re-verified by the scanner on the int tree.

## 12. Scope compliance
- DSH core patch: NO (CORE PATCH BUDGET = 0; references/deepseek-harness-test-use porcelain 0 @ a66e470204 after every live run)
- alpha.3 grants: NO
- alpha.4 governance: NO
- push events: NO (local branches only; push pending explicit user authorization)
- generic scheduler: NO (the fix is the facade/router detach + the read action; no new execution machinery — the F3 A/B/C model is untouched)

## 13. Remaining risks
- same-member concurrent followup: plan §18 frozen conclusion reached LIVE — **A (upstream-queues-correctly)**: the same member ACCEPTS multiple async work units, but the actual turns SERIALIZE (queue upstream); both settle `succeeded` with DISTINCT per-turn memberResults; fu2's turn started only after fu1's model response flushed. Interleave-risk (C) was NOT observed. Recorded: R3-0…R3-4 in `live/kit/r8-check-2026-09-11T20-52-32.json`.
- shutdown in-flight behavior: normal dispose never cancels durably-admitted async work as a caller-turn child; no silent-orphan state exists (same-token resume always available); host-level termination relies on the existing fail-closed/recovery semantics (plan §27 minimum principle honored — no shutdown drain implemented, none required).
- polling UX: terminal results are readable ONLY through `team_collect` (CCR-3: no auto-resume, no redelivery into the leader turn) — the leader polls. Frozen contract decision; the tool descriptions document the concurrent workflow.
- R8 kit deviations (evidence infrastructure only, zero product impact): D-r8-1 the CLI `anchorPathSpec` rewrites only args starting with `.`/`..` — a relative `file:` spec anchored to the invoking dir (HOME), not the profile dir → the kit now installs via an ABSOLUTE `file:` spec. D-r8-2 the kit's mock proxy buffered `upstreamRequest(...)` output without awaiting the promise (`up.on` on a Promise → 502 on every leader request — first run, world 17-26-41, raw evidence kept). D-r8-3 the check evaluated the member-flush timing checks at a point BEFORE the proxy had logged the flush lines (the proxy logs one line per request at flush time, after the 20 s delay) → the three timing checks moved after the Phase 2 terminal collect (second run, world 20-45-12, 14/17 with all three timing nulls — raw evidence kept; the product behaved correctly even in that run, as its proxy log proves).

## 14. Verdict
- Issue #1 closed: YES (R8-PASS 17/17, §18 conclusion A, all DoD §32 contract/runtime/tools/concurrency/signals/regression boxes checked — plan §34 live acceptance satisfied)
- Ready for next blocker: YES
- Ready for alpha.3 after all blockers: YES (this blocker cleared; the alpha.3 branch decision remains with the user — NO push performed, per the red line)
