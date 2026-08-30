# G5 Gate (Round 2) — Review Report, Reviewer 3 (blind)

- **Gate**: G5, Phase 5 (Agent Binding / Member Lifecycle Substrate), round 2
- **Target**: `int/P5` @ `9f5bd12647e4ba8da35f19c31782e5e21384848c` (base `602590db1bb79ca45f505af636b13e331a209be4` = master after G4)
- **Reviewer worktree**: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G5-R3` (detached @ 9f5bd12, verified this phase)
- **Phase**: 3 of 3 — verdict. Phase-1 static analysis and phase-2 execution are embedded; all load-bearing facts below were re-verified against disk in this phase (fresh reads, fresh chain re-runs).

## Verdict: 投机通过 (speculative pass)

All eight G5 criteria PASS on my own evidence (code re-read at file:line, fresh leg2 + tsc re-run, on-disk harness summary as the harness truth). Findings are concrete, minor, non-structural, and do not threaten the invariants; the residual risks are documented harness stand-ins whose production mechanisms are owned by later tasks per the frozen plan.

## 0. Frozen-doc integrity (re-verified in this phase)

SHA-256 (raw bytes, CRLF as-is) of the four frozen docs in the MAIN worktree, recomputed during this phase:

| Doc | Expected | Computed | Match |
|---|---|---|---|
| …Detailed_Architecture_20260829.md | `030dfb8e…70c53` | `030DFB8EC55BAE30F35C2826C7E4E659C0E0B742D836018CE502F34017870C53` | ✓ |
| …Detailed_UI_Design_20260829.md | `3ef3ab69…c4981e` | `3EF3AB69ED2BD7879E4C15079A16C8DAE456B572690246A5C1F9CBB0C8C4981E` | ✓ |
| …Detailed_Development_Plan_20260829.md | `a05d237f…81d0f` | `A05D237F8515FD6467373632849AFE0C6A1AE63BC0EC298DE63B9D124D881D0F` | ✓ |
| …Task_Decomposition_and_Review_Method_20260829.md | `2b457cc0…e888a3` | `2B457CC033CA1B72AA781E072E0EF7FE55BC05D2F7EA25CC03C827D257E888A3` | ✓ |

`frozenDocCheck = ok` (phase-1 also cross-checked the provenance manifest `frozen_docs` section — the single allowed evidence exception).

## 1. Criteria table (G5, DevPlan §18.6) — criterion → my evidence → result

| # | Criterion | Evidence (re-verified by me in this phase) | Result |
|---|---|---|---|
| C1 | Root fresh bind | `root-binding/fresh-root.ts`: kind-conflict fail-closed L118–126; "record BEFORE binding" integrity rule L128–139 (binding-without-record = invariant-41 violation); `binder.bindFreshRoot(sessionId)` L195; `durable.wrote` L197. `binder/binder.ts` shared orchestration L244–407: read-only record load (never creates records, L262–264; missing → `BINDER_TARGET_NOT_FOUND` L296–299), idempotency no-op L328–333, finalize `{installed, admitted, admissionCode, emittedEvents}` L398–407, overlay faults wrapped `BINDER_OVERLAY_FAILED` L410–413. Harness on disk: S1 (boot1, 15 assertions, pass). | **PASS** |
| C2 | Root cold bind | `root-binding/cold-root.ts`: `binder.rehydrateColdRoot` sole authority L74–80; durable observation read-only and only when `noopReason !== 'ordinary'` L86–97; defensive throw on inconsistent durable view L89–95; `wrote: false` always L97. `binder.ts` cold path = `restoreScope` only (no slot apply/installOverlay; module contract L247–250). Harness on disk: S2 (boot2, 11 assertions, pass), plus T6 boot4 after real process kill. | **PASS** |
| C3 | Member fresh create setup | `member-residency/fresh-member.ts`: **L186 `await ports.sessionDurability.ensureDurable(childSessionId)` — unconditional, awaited, before the first durable write on every path** (the ad5e252 defect fix; fail-closed comment L177–185: a rejection propagates with zero durable writes). Step 4 record write/repair/verify L188–267 (spec conflict L246–257; `DISPOSED` terminal L259–265); step 5 binding put-or-verify, never re-pointed L269–300; `binder.bindFreshMember(childSessionId)` L313. Harness on disk: M1 (boot3, 11 assertions, pass). `ensureMaterialized` confirmed a real public upstream seam (`api-catalog.ts:1484`, `session-persistence(-sqlite)` public implementations, docs/subsystems/persistence.md:294). | **PASS** |
| C4 | Member cold resume setup | `member-residency/cold-member.ts`: `validateMemberIdentityInput` L94; absent → `{noopReason:'absent'}` zero-effect L100–103; binding pre-check → `RECORD_CONFLICT` before any effect L105–119+; `binder.rehydrateColdMember(member.childSessionId)` L140 (addressed ONLY by (rootSessionId, instanceId)); `wrote: false` always L142–146; write port never consulted. Harness on disk: M2 (boot4, 9 assertions, pass) + I1A (boot4, 5 assertions, pass — cold resume after real process kill). | **PASS** |
| C5 | Ordinary Agent unaffected | `binder/binder.ts` L251–260: unbound or `kind==='ordinary'` → zero-effect no-op `{bound:false, installed:false, noopReason:'ordinary', emittedEvents:[]}` for all four bind paths (shared orchestration L244); kind mismatch fails closed before any effect L268–272. Harness on disk: M5 (boot3, 6 assertions, pass — includes the subagent-channel negative probe). | **PASS** |
| C6 | Persona semantics correct | `agent-setup/persona/adapter.ts` L222–240+: `absent` → return, no scoped identity, no error (L224); otherwise evaluate via the real engine `evaluateCompatibility` (import L58 from `domain/compatibility` — the P3-T5 default, not overridden); non-PASS → `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` FATAL, "throw BEFORE any install effect and before the binder's admission decision" (L216–218, L233+); non-PASS without the frozen reason code → TypeError (L237+). Slot name `'persona'` L267–274. | **PASS** |
| C7 | Model future-boundary mutation correct | `agent-setup/model/overlay.ts` L152–156: `beginRequest` copies `source.current()` at call time — capture immutable for the request lifetime; "request N remains A; request N+1 uses B"; resolution never at install time (restart uses current source); `undefined` carried losslessly (L155); source fault fail-closed, no capture registered (L149–150); `drop` discards in-flight only (L178–180); `install` session-scoped ratchet (L125–129). | **PASS** |
| C8 | Runtime residency droppable without deleting Member | `member-residency/evict.ts`: SETTLED-only gate, lifecycle never changed L100–108; binding consistency L110–129; **SOLE effect `ports.residency.dropResidency(member.childSessionId)` L131–133** (handle absent = settled world, not an error); zero durable writes (write port absent from the function). Harness on disk: M3 (boot4, 8 assertions) + M4 (boot4, 6 assertions) — record + binding survive, single row, re-admit is cold path. | **PASS** |

## 2. Chain verification

- **leg2** (sanctioned `node scripts/run-tests.mjs`, no arg = all 9 packages) — **fresh re-run in this phase**: `929 passed, 0 failed, 929 total, 1499 ms`, exit 0. Matches embedded phase-2 (`{failed:0, pass:true, total:929}`) and the integrated truth (925 pre-I1A-fix + 4 new barrier tests).
- **tsc** (sanctioned direct `node node_modules/typescript/bin/tsc -p <pkg>/tsconfig.json`) — **fresh re-run in this phase**: contracts exit 0, domain exit 0, runtime exit 0, storage exit 0; zero diagnostics. Matches embedded phase-2.
- **Harness** (real-instance, serial, ports 3180/3181/3491, DSH_HOME `references/.dsh-test-p5t6` wiped+recreated) — **on-disk `g5-review-harness-output/summary.json` is the truth**; read in full this phase:

| Scenario | Boot | Port | Assertions | Pass | Failing |
|---|---|---|---|---|---|
| S1 (root fresh) | 1 | 3180 | 15 | ✓ | — |
| S2 (root cold) | 2 | 3181 | 11 | ✓ | — |
| M1 (member fresh) | 3 | 3180 | 11 | ✓ | — |
| M5 (ordinary unaffected + negative probe) | 3 | 3180 | 6 | ✓ | — |
| M2 (member cold resume) | 4 | 3181 | 9 | ✓ | — |
| I1A (real-process kill → cold resume) | 4 | 3181 | 5 | ✓ | — |
| M3 (evict SETTLED, record/binding survive) | 4 | 3181 | 8 | ✓ | — |
| M4 (double re-admit, cold path, no row dup) | 4 | 3181 | 6 | ✓ | — |
| I1C (member-record loss pre-boot) | 5 | 3180 | 6 | ✓ | — |
| I1B (schema-version corruption negative control) | 6 | 3181 | n/a (no scenario by design — `plugin.mjs:77`) | ✓ (expected loud failure) | — |

I1B detail (disk `i1.b`, L445–467 + `boots.boot6.setupFailure` L337–341): pre-boot `unit.version` corrupted to 999 with the original backed up (`run.mjs:196–206,745–747`); row setup failed **loudly** with `code: "SCHEMA_VERSION_MISMATCH"` via P4-T1's `openHandle` version gate (`packages/storage/repositories/team-domain.ts:101`, unchanged in the P5 delta — fresh `git diff --name-only 602590d..9f5bd12 -- packages/storage packages/contracts packages/domain` is empty); `fileUnchangedAfterFailedBoot: true` (no silent migration/rewrite); `setup-failure.json` present. `boot3.stop.killed:false` is the I1A crash-window mechanism (real kill, `i1aCrash: {armed:true, windowObserved:true}`), not a leak: `portFree: true`.

- **Embedded phase-2 JSON vs disk**: no disagreement on any value (leg2, tsc, all scenario flags, `failures: []`, top-level `pass: true`, selfChecks). The embedded blob is truncated mid-note and omits explicit I1B detail that the disk carries — a completeness difference, not a discrepancy.
- **Sanctioned-chain compliance**: only `node scripts/run-tests.mjs` and direct tsc used; no pnpm run/exec, no vitest CLI, no tsx/esbuild/vite. Unit matcher surface confined to `toBe/toEqual/toBeGreaterThan/toThrow` (phase-1 scan; my fresh leg2 run re-executed all 25 p5t* suites green).

## 3. Zero-core / private imports / owned boundaries (fresh checks this phase)

- **Zero-core**: `references/deepseek-harness-test-use` HEAD = `cd5ef8148158c3a752a658978873241fdf8e2bbc` with **empty** `git status --porcelain` (pristine, re-checked live). Disk `pristine.before/after` in the harness summary agree. P5 delta touches **zero** files under `packages/storage|contracts|domain`.
- **Private imports**: fresh grep — no `from 'node:'` / `require('node:')` in any `packages/runtime/**.ts` or the touched testkit test. Harness `.mjs` uses only public seams; `sessionPersistence.ensureMaterialized` verified against the public api-catalog (L1484) and public upstream implementations.
- **Owned boundaries**: all production/test changes inside the six task boundaries (phase-1 file accounting, 349 files = 277 evidence/workflow + 72 task + 2 cross-task). Both cross-task touches re-verified by diff: (a) `packages/runtime/tsconfig.json` `rootDir "."→"../.."` — build glue only, `noEmit:true`, zero production code; (b) `packages/testkit/test/p4t6-session-event-scan.test.ts` coverage assertion 190→258 (passes in my fresh leg2 run ⇒ live scanner ground truth is 258) plus a prose breakdown (see Finding F1). Main worktree HEAD `0338f8a` (branch `int/P5-agent-binding-binder`) is one workflow-record commit above 9f5bd12 and 9f5bd12 is its ancestor — the review target itself is unmodified.

## 4. Findings

| ID | Severity | Finding |
|---|---|---|
| F1 | minor (cosmetic) | `p4t6-session-event-scan.test.ts` prose comment breakdown sums to **257** while the (correct) assertion is **258** — an acknowledged worker miscount (commit 2f4d75f). The assertion is live-verified by my fresh leg2 run; no behavioral impact. |
| F2 | minor (documented scope stand-in) | M3 seeds lifecycle `SETTLED` through a row-owned repository seam (logged `harness-setup-*`) because no lifecycle-transition mechanism exists in P4/P5 scope (deferred task). Product writes are asserted separately as zero. C8's real-world behavior therefore rests on the later lifecycle mechanism preserving the residency≠lifecycle separation (Architecture §31); the gate's enforcement point (SETTLED-only, never-mutated) is verified in code. |
| F3 | minor (documented scope stand-in) | Blueprint transport is a per-boot directive file (`p5t5-directive.json` / `p5t6-directive.json`) — a stand-in for the durable blueprint snapshot store owned by a later task. The production-shaped controls under test (contentHash pin, immutability/generation checks) are in the delivered code. |
| F4 | minor (cosmetic) | I1B's error text reports "persisted at schema version **null**" although the harness corrupts the stamp to **999**: the P4 version-extraction reads the tampered stamp as null/missing. The assertion is on the frozen error code `SCHEMA_VERSION_MISMATCH` (matched) and on file immutability after the failed boot (matched); the wording is P4 error-text territory and non-structural. |
| F5 | observation (informational) | At phase-3 time, port **3080 has no listener**. The in-run record (disk `stable3080.before/after`, both HTTP 200) brackets the harness window; the post-run stopped state is outside that window and no action of mine (any phase) started/stopped/wrote the stable instance — only read-only probes. Recorded for completeness; no invariant impact. |

No finding threatens invariants 18 (composite identity), 19 (instance-first addressing), 23/24 (exactly one durable child session; binding never re-pointed), or 41 (TeamDomain sole durable control-plane authority) — all four re-confirmed in actual code this phase (identity derivation → record/binding addressing in `fresh-member.ts`/`cold-member.ts`/`evict.ts`; `wrote:false` construction + sole `dropResidency` effect; record-before-binding ordering).

## 5. Self-checks (all performed in this phase)

- My worktree HEAD = `9f5bd12…` (exact target); tracked tree clean — only untracked reviewer artifacts (`g5-*.log`, `g5-review-harness-output/`, `g5-review-rerun-leg2.log`).
- Test-use tree pristine @ `cd5ef81`, clean (live git check).
- Harness ports 3180/3181/3491–3495: **all free** after the phase-2 run (live check; also `ports.released` all-true on disk).
- Sanctioned tooling only; stable instance :3080 never started/stopped/written (see F5 for the post-run state observation).
- Leg2 + 4×tsc fresh re-run: green (see §2).

## 6. Blindness compliance statement

I did not read `dev/agent-workflow/SESSION_ROUTER_LOG.md`, `dev/agent-workflow/graph.yaml`, or any `dev/agent-workflow/evidence/**` file in any phase. The sole permitted exception (phase 1, per the brief) was the frozen_docs section of `dev/agent-workflow/evidence/provenance/file-manifest.json` for the manifest cross-check. In this phase I read only: the two protocol docs in my worktree, the frozen docs' hashes (main worktree), the delivered code/tests/harness sources in my worktree, git metadata (log/branch/diff/status/rev-parse/merge-base — not orchestration files), my own on-disk phase-2 outputs, and the pristine upstream test-use tree (read-only, for seam verification). I did not consult or wait for any other reviewer.
