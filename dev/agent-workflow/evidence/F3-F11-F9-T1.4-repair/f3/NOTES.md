# F3-A (repair-r1) — evidence notes

Task: implement the F3-A package (work chain lock scope, INV-9.1) of the
F3/F11/F9/T1.4 repair round.
Branch: `task/repair-r1-f3-lock-scope` (worktree `.worktrees/repair-r1-f3`, base `9b582a1`).
Execution: 1/3.
CORE PATCH BUDGET = 0 honored — all changes inside `packages/runtime` + this evidence dir.

## Root cause (verified)

The member work chain ran END-TO-END inside the router's per-team promise-chain
acquisition. The chain map is NON-REENTRANT (a second `run` for the same team
from inside a held critical section queues behind the caller's own pending
tail). In the production wiring the SAME shared map (`TeamOperationCoordinator`
chains) backs the router facade, the work chain, AND the activity ledger's
guarded commit. So a member's own `team_report_progress` during its work turn
queued behind the LEADER's still-pending follow-up tail on the same chain:
deadlock (F3).

## Implementation — the three-phase lock split (INV-9.1)

`packages/runtime/action-router/work-execution.ts` — `executeWorkChain` is now
the orchestrator of three exported phases:

1. **Phase A — `admitWorkLocked` (under the shared chain, WITH the request
   signal).** Fresh read, work-unit dedup scan, the replay shortcut (zero
   writes, zero delivery), CAS + `team-work-admitted` fact, and the
   activity-interval open (tolerating already-open for a resume). For the
   router-mediated new-work path Phase A runs INLINE inside the router's
   gate acquisition — the compatibility gate and admission stay in ONE
   acquisition (H5/CR-8 preserved); the abort signal governs the WAIT only.
   Output: `WorkChainPhaseA` = `{kind:'replay', result}` (chain done inside
   the lock) | `{kind:'admitted', mode, childSessionId, fromLifecycle,
   lifecycleCommitted, sequence}`.
2. **Phase B — `deliverWork` (NO shared chain).** The WorkDeliveryPort call
   only (model-visible prompt/context → the member's child session; the turn
   completion observed). The request signal may abort the live turn (pre-fix
   behavior kept). This is where the member's own team tools re-enter the
   router's facade and acquire the SAME chain freely — the F3 hang removed.
3. **Phase C — `settleWorkLocked` (re-acquires the SAME chain, WITHOUT the
   request signal — N6).** The interval close + `settleAdmittedWork`
   (single production settlement owner: fresh-read convergence — RUNNING →
   CAS RUNNING→SETTLED + settlement fact; already-SETTLED → the repair
   branch: own settlement fact, no state commit). The fail-closed path
   (`completeWorkChainAfterAdmission` catch): interval close +
   `failClosedSettle` in the SAME Phase C acquisition, THEN the typed
   `WORK_DELIVERY_FAILED` throw (N3: throw-after-settle; Phase C durability
   holds even when the request aborted during delivery — H4).

`packages/runtime/action-router/effects.ts` — the effect surface is staged:
`EffectContext` gains `teamLocks`; the full-wiring work admission
(`admitWorkOn`) and delegate-create/continue (`runDelegate`) run Phase A
inline (the caller's acquisition holds the chain) and return a
`WorkChainStage { complete: () => Promise<RuntimeActionEffect> }` for an
admitted unit (replays complete inside the lock). `mapWorkChainEffect` keeps
the frozen v2 D2 carriers (`memberResult`, `replayed`, `settled`,
`settledSequence`) byte-for-byte.

`packages/runtime/action-router/router.ts` — after the new-work acquisition
releases the chain, a `WorkChainStage` is completed OUTSIDE the lock
(`isWorkChainStage` guard; every other effect is plain data — no staging).
The P6-T2 evidence wiring (partial ports) is unchanged: it never stages.

`packages/runtime/action-router/index.ts` — exports `admitWorkLocked`,
`deliverWork`, `settleWorkLocked`, `completeWorkChainAfterAdmission`,
`isWorkChainStage`, `WorkChainPhaseA`, `WorkChainStage` (the direct test
seam of the phases).

`packages/runtime/coordination/index.ts` — COMMENTS ONLY: the work chain is
documented as the canonical long-hold instance of the strictly-sequential
acquisition rule (Phase A → release → Phase C; INV-9.1; H3 note).

### H3 overlap semantics (documented in `work-execution.ts` +
`coordination/index.ts`)

Because Phase B holds no chain, a second work unit for the SAME instance may
be admitted during the first's delivery. Each unit owns its admission fact +
activity interval (correlation = its own requestToken); BOTH settle via
fresh-read convergence in `settleAdmittedWork` — the first to settle commits
RUNNING→SETTLED, the other takes the already-SETTLED repair branch (own
settlement fact, no state commit, no duplicate fact). Both settlement facts
are durable; the member ends SETTLED. F3-T4 pins this exactly.

## Seam decisions

- **Root initial work is left to the separate F3-B leaf** (contract: include
  it "only if it remains within the F3-A owned seam"). The root initial-work
  path lives in `packages/runtime/action-router/root-initial-work.ts`
  (F3-B's file, explicitly separate); touching it would cross the seam.
  Nothing in F3-A's diff references it.
- No second lock map, no re-entrant coordinator, no coordinator bypass, no
  fire-and-forget progress, no gate move: Phase A (gate + CAS/fact) stays in
  the single acquisition; the replay/resume/full retry protocol is unchanged.
- The `executeWorkChain` direct test seam (p8s3 `runChainDirect`) passes no
  `teamLocks` → the optional field keeps those calls behavior-identical
  (phases run without the shared chain).

## Tests

### New: `packages/runtime/test/f3a-lock-scope.test.ts` (7 tests, F3-T1..T6)

Production-shaped wiring throughout: ONE shared `chains` map installed on
BOTH `createTeamRuntime({ teamLocks })` and `createActivityLedger({ teamLocks })`
(the production root shape), real durable world, fake model-visible delivery
port only. Deterministic hang detection = bounded event-loop pump
(microtask + `setTimeout(0)` ticks, NO wall clock): a true self-waiting
promise chain makes zero progress under any pumping.

- **T1 (re-entry)** — the member's `team_report_progress` DURING its own
  delivery resolves against the shared chain (the F3 deadlock regression);
  the progress row is durable before the follow-up settles; worker SETTLED;
  interval open/close on the token.
- **T2 (multiple progress)** — two consecutive follow-ups, each delivery
  reports two progress rows; the deterministic head+1 guard holds across
  turns (sequences 1,2 then 3,4, same subject); both succeed + settle; two
  admission facts; two interval pairs.
- **T3 (concurrent mutation)** — an unrelated same-team mutation
  (`archive-member` on the SETTLED scout — the only legal archive edge)
  runs AND commits durably while a follow-up delivery is gated in flight;
  then the follow-up settles.
- **T4 (H3 overlap)** — unit 2 admitted on the SAME instance during unit 1's
  gated delivery (fresh RUNNING: no CAS, own fact + interval); unit 2's
  Phase C converges first (commits RUNNING→SETTLED); unit 1's delivery then
  FAILS — its fail-closed settle takes the already-SETTLED repair branch
  (own `delivery-failed` fact, no state commit). Exactly one state commit
  pair, both settlement facts durable, member SETTLED, no deadlock.
- **T5a (N6 abort-wait)** — a pending chain holder (sentinel unit); a
  follow-up queues behind it and is aborted while waiting → rejects with
  the CALLER'S ABORT REASON (identity), not a TeamRuntimeError; NOTHING
  admitted (no admission fact, member row untouched); the chain stays
  usable (control follow-up settles).
- **T5b (N6 abort-during-delivery)** — abort at the delivery gate → the
  delivery rejects on the signal; Phase C runs WITHOUT the signal: the
  fail-closed settlement IS committed (delivery-failed fact + SETTLED +
  interval close) and only then does `WORK_DELIVERY_FAILED` propagate (N3).
- **T6 (N3 throw-after-settle)** — plain delivery fault →
  `WORK_DELIVERY_FAILED` with durable delivery-failed settlement already
  committed (state + fact + interval, no fake RUNNING), on the
  production-shaped wiring.

### Red-before-green (`f3/red-before-green.txt`)

The five modified SOURCE files were stashed (pre-fix `9b582a1` behavior,
new test file in place) and the suite re-run:

- **RED pre-fix (deadlock → budget exhaustion):** T1, T2, T3, T4.
- **GREEN pre-fix (behavior preserved, not changed by the split):**
  T5a (abort-wait semantics are pre-existing router-level), T5b, T6
  (throw-after-settle already held on the direct path).

Stash restored; post-fix all 7 green (`f3/postimpl-f3a-first.txt`).

### Focused non-regression (`f3/postimpl-focused.txt`)

| suite | pre-fix (baseline) | post-fix |
| --- | --- | --- |
| `p8s3-work-chain.test.ts` | 11/12 (1 shim-surface `toBeUndefined`) | **12/12** |
| `p8s5b-operation-fencing.test.ts` | 26/26 | 26/26 |
| `p6t5-progress.test.ts` | 14/14 | 14/14 |
| `p8s3b-result-effects.test.ts` | 14/16 (2 shim-surface `toBeUndefined`) | **16/16** |
| `tcm-m3-root-initial-work.test.ts` | 18/18 | 18/18 |
| `f3a-lock-scope.test.ts` (new) | — (red per red-check) | **7/7** |

### Full runtime package (`f3/postimpl-full-runtime.txt`)

One process per test file (the d5 top-level crash kills any single-process
run — see notes). Final result: **134 files, ok=127, bad=7** — the SAME
pre-existing shim-surface failure set as `f3/baseline-full-runtime.txt`
(baseline: 133 files, ok=124, bad=9): `d1-member-base-tools` (3/6),
`d1-s6-remote-v3` (6/14), `d1-team-ownership-index` (5/16),
`d2-s6-ensure-root-live` (5/10), `d3-member-identity-context` (1/5),
`d5-instance-contract` (2/9, top-level crash), `pbf-default-artifact-urls`
(3/9) — with `p8s3` and `p8s3b` now GREEN (they were only red on the
`toBeUndefined` shim gap) and the new `f3a-lock-scope` (7/7) GREEN. No new
failures.

### Typecheck / build (worktree `packages/runtime`)

- `tsc -p tsconfig.json` → exit 0
- `tsc -p tsconfig.build.json` → exit 0

## Test-portability normalizations (NOT behavior changes)

4 assertions normalized `toBeUndefined()` → `toBe(undefined)`
(p8s3-work-chain L1124/L1131, p8s3b-result-effects L1235/L1242):
semantically identical under vitest and the plain-node shim
(`Object.is(x, undefined)`), required because the shim surface has no
`toBeUndefined`.

## Blockers / notes for the gate

1. **`vitest run` cannot execute in this sandbox session.** vite 8 config
   load → `windowsSafeRealPathSync` → `exec("net use")` → synchronous
   `spawn EPERM` (verified from both the main repo and this worktree;
   documented in TEST_METHODS.md §5 lineage, P1-T5 D-05 evidence). All
   suite evidence here is via the repo's plain-node fallback
   (`scripts/run-tests-hooks.mjs` + `scripts/test-vitest-shim.mjs` + the
   per-file runner `f3/run-file.mjs`). **Obligation: re-run the runtime
   package under real vitest in an unrestricted environment** (the shim
   runs the identical test bodies; the 7 pre-existing shim-surface red
   files use matchers outside the shim and pass under vitest in prior
   rounds' evidence).
2. The plain-node shim surface lacks `toBeUndefined`/`toContain`/
   `toBeDefined`/`toBeInstanceOf`/`toHaveLength`/async `it` — the 7 red
   files above are ALL pre-existing shim-surface gaps, unrelated to F3-A
   (identical set pre- and post-fix).
3. Scratch hygiene: `packages/testkit/test/.tmp-fault/f3a-*` scratch dirs
   are destroyed in each scenario's `finally`; the suite additionally
   self-cleans its seven basenames at module start (deterministic
   basenames collide on re-run after any crashed process — one such
   stale dir was observed during this round's red-check sequence and is
   covered by the net). Test scratch is gitignored.
4. Build artifacts: `packages/runtime/dist` is TRACKED in this repo and
   the house rule is the same-commit rebuild (`fix(g3)` precedent:
   "commit rebuilt effects dist install-surface artifacts"). This branch
   carries the rebuilt runtime dist alongside the source (typecheck +
   `tsc -p tsconfig.build.json` both exit 0).

## Deliverables (this branch)

- `packages/runtime/action-router/work-execution.ts` (3-phase split,
  INV-9.1 + H3 docs)
- `packages/runtime/action-router/effects.ts` (staging, `WorkChainStage`,
  `teamLocks` on the context)
- `packages/runtime/action-router/router.ts` (staged completion outside the
  lock; docs)
- `packages/runtime/action-router/index.ts` (phase exports)
- `packages/runtime/coordination/index.ts` (INV-9.1 comment note)
- `packages/runtime/test/f3a-lock-scope.test.ts` (F3-T1..T6, new)
- `packages/runtime/test/p8s3-work-chain.test.ts`,
  `packages/runtime/test/p8s3b-result-effects.test.ts` (4 matcher
  normalizations only)
- `packages/runtime/dist/**` (rebuilt runtime dist — same-commit rebuild
  rule)
- this evidence dir: `run-file.mjs`, `baseline-focused.txt`,
  `baseline-full-runtime.txt`, `red-before-green.txt`,
  `postimpl-f3a-first.txt`, `postimpl-focused.txt`,
  `postimpl-full-runtime.txt`, `NOTES.md`

Not pushed (per red line; the main agent pushes after the gate).
