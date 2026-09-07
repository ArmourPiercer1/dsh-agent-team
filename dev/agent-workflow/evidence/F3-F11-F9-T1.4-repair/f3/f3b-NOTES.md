# F3-B (repair-r1) — evidence notes

Task: implement the F3-B package (Root initial-work lock scope, INV-9.1 /
N1) of the F3/F11/F9/T1.4 repair round.
Branch: `task/repair-r1-f3-root-initial-work` (worktree
`.worktrees/repair-r1-f3b`, base `68ff124` = F3-A tip; master is still
`9b582a1` — F3-A is not yet merged).
Execution: 1/3.
CORE PATCH BUDGET = 0 honored — all changes inside `packages/runtime` +
this evidence dir; no upstream, no active plans, no graph, no router log.

## Root cause (verified at 68ff124)

`createAdmitRootInitialWork` ran the WHOLE strategy — compatibility gate +
scan + admission fact + the `deliverRootWork` port call (the ROOT TURN) +
the terminal fact — end-to-end inside ONE `withTeamLock` acquisition of the
shared per-team chain. The production root (`root.ts` L778–814) wires the
SAME `coordination.chains` map into the router facade, the activity
ledger's guarded commit and this closure. The chain is non-re-entrant
(a second `run` for the same team from inside a held critical section
queues behind the caller's own pending tail). So the leader's own team
tools during the initial-work turn (`team_delegate` / `team_follow_up` /
`team_report_progress` → the router's effect phase → `withTeamLock` on the
same map — `router.ts` L143 `executeEffect(teamLocks, ctx)`) queued behind
the closure's own pending tail: deadlock (the N1 hang — the root sibling
of F3, which F3-A removed for the member work chain).

## Implementation — the three-phase lock split (INV-9.1, the F3-A pattern)

`packages/runtime/action-router/root-initial-work.ts` — the strategy is
now the orchestrator of three phase bodies (the scanner, the decision
table, the fingerprint, the fact payloads and every error builder are
byte-for-byte unchanged):

1. **Phase A — `admitRootInitialWorkLocked` (under the shared chain, one
   acquisition).** Validation + scan + the plan §15.6 decision table:
   `replay` (zero delivery, zero writes — the chain completes inside the
   acquisition) | typed rejection (`ROOT_WORK_PAYLOAD_MISMATCH` /
   `INITIAL_WORK_ALREADY_ADMITTED` — zero writes) | `owed` (fresh: the
   durable `team-work-admitted` fact committed by this Phase A; retry: the
   pre-existing admission, no second fact). In the production closure the
   compatibility gate runs INSIDE this same acquisition (the CR-8 analog:
   the gate may re-probe inline — a durable compatibility write — and a
   racing new-work admission for the same team must not interleave into
   its read→probe→re-read→admit window).
2. **Phase B — `deliverRootInitialWork` (NO shared chain, NO abort
   signal).** The `deliverRootWork` port call only — the ROOT TURN. This
   is where the leader's own team tools re-enter the router's facade and
   take the SAME chain freely — the N1 hang removed. The seam accepts no
   request signal at all (the S6 command surface), so there is no signal
   to gate anything.
3. **Phase C — `settleRootInitialWorkLocked` (re-acquires the SAME chain,
   WITHOUT any abort signal — N6).** The terminal `team-root-work-delivered`
   fact. It FRESH-READS the durable state first (the F3-A H3
   convergence pattern): a concurrent same-token delivery that already
   committed the terminal is never duplicated (zero writes; the existing
   terminal sequence is reported); a contradictory-fingerprint terminal
   (ledger corruption) fails closed with the typed mismatch, zero writes.

`completeRootInitialWorkAfterAdmission` runs Phase B (no chain) → Phase C
(`acquirePhaseC`: re-acquires the shared chain, no signal). On a delivery
fault the terminal is NOT written (this strategy's fail-closed writes
nothing — plan §15.7) and the typed `WORK_DELIVERY_FAILED` propagates:
throw-after-settle (N3) — the rejection always lands on the durable state
the same-token retry recovers from (admission retained, terminal absent);
never a half-committed terminal.

`executeRootInitialWorkLocked` is the THREE-PHASE ORCHESTRATOR (the direct
test seam): with `teamLocks` installed it performs the Phase A acquisition
itself and Phase C re-acquires it; without (the pre-F3-B tcm-m3 shape)
the phases run without the shared chain — that seam's behavior is
preserved exactly (the tcm-m3 suite is the proof). Both paths share the
SAME phase bodies — one scan, one admission algorithm, one delivery call,
one settlement owner. `RootInitialWorkDeps` gains the optional
`teamLocks: TeamOperationChainMap` (the closure always passes the
production map).

`createAdmitRootInitialWork` (the production closure, the contract's
`admitRootInitialWork` surface — signature and result shape UNCHANGED):
Phase A (gate + admission) in ONE `withTeamLock` acquisition → replay
short-circuit inside the lock → `completeRootInitialWorkAfterAdmission`
AFTER the acquisition releases.

### Documented semantic relaxation (H3-root — U6 sub-decision (i) class)

Because Phase B holds no chain, a CONCURRENT same-token admit can pass its
Phase A as an ADMITTED-ONLY RETRY while the first call's delivery is still
in flight (the pre-fix lock coupling made it a zero-delivery replay — that
serialization was the coupling this split removes). Both model-visible
deliveries run at-least-once: plan §15.7 is explicit that the ambiguous
window (admission durable, terminal not yet) is NOT claimed exactly-once,
and the model-visible text carries the requestToken so the model dedupes.
The durable state converges via the Phase C fresh-read — exactly ONE
admission fact and exactly ONE terminal fact for the token, no fake state
(this strategy owns none), no new error code. A concurrent DIFFERENT-token
call still gets the typed `INITIAL_WORK_ALREADY_ADMITTED` from its Phase A
scan (the one-slot rule is untouched). This is pinned by the LOCK-1
scenario of `tcm-m3-root-initial-work.test.ts`, updated to the documented
interleave: `modes 'fresh+retry'` (was `'fresh+replay'`), two model-visible
deliveries (was one), ONE admission fact + ONE terminal fact (unchanged),
`sameAdmittedSequence` (unchanged). The interleave is deterministic, not a
race: the first call's Phase C must acquire the chain behind the second
call's Phase A acquisition, so the second's scan always precedes the first
terminal commit.

### Lock-scope note for the gate

The F3-B file scope (task brief: only `root-initial-work.ts` + its focused
persistent tests/evidence) forbids touching
`packages/runtime/coordination/index.ts`. Its INV-9.1 note ("the member
work chain is the canonical LONG-HOLD case") remains accurate — "canonical"
leaves room for the sibling case, which is now documented in the
`root-initial-work.ts` module docs (LOCK TOPOLOGY section). If the gate
wants the "or the root turn" phrase in the coordination doc, that is a
one-line documentation follow-up for the main agent (out of this leaf's
scope).

## Test coverage (contract rows F3B-T1 + the F3-A pattern rows)

`packages/runtime/test/f3b-root-initial-work-lock-scope.test.ts` (NEW,
12 tests) — the PRODUCTION-WIRED seam: ONE shared chain map installed on
BOTH the runtime (router) and the activity ledger (the `root.ts`
production shape) plus the closure over the same map; real FileStorageSeam
worlds (leader + worker seeded); deterministic microtask+macrotask pump
(200,000 budget — a definitive hang verdict, no wall clock); the house
top-level-await / sync-it pattern; scratch self-cleaning at module start.

- **T1 (N1 re-entry — the deterministic re-entry regression; RED pre-fix
  = deadlock):** the leader's `team_report_progress` DURING the root
  initial-work turn (inside the fake `deliverRootWork`) → the router's
  facade → the SAME shared chain. Post-fix: resolves; the progress audit
  fact is durable; the admit settles `fresh` with one admission + one
  terminal fact in durable order; exactly one delivery; the worker row
  untouched.
- **T2 (the direct orchestrator seam):** the SAME re-entry through
  `executeRootInitialWorkLocked` with `teamLocks` installed (post-fix seam
  pin: the orchestrator acquires/releases/re-acquires — pre-fix the seam
  held no chain of its own and the row is vacuously green).
- **T3 (concurrent mutation during the ROOT TURN — the F3-T3 analog;
  RED pre-fix = deadlock):** while the root delivery is gated in flight,
  an unrelated same-team `report-progress` runs AND commits durably on the
  released chain; the outer admit then settles (one admission, one
  terminal, one delivery).
- **T4 (throw-after-settle + retry/replay on the shared chain — N3;
  GREEN pre-fix = behavior preserved):** a delivery fault yields
  `WORK_DELIVERY_FAILED` with the admission retained and NO terminal fact;
  the chain is not poisoned; the same-token retry redelivers and
  converges WITHOUT re-admitting (same admission sequence); the third call
  is a zero-delivery replay (two deliveries total: faulted + retry).

### Red-before-green (`f3b-red-before-green.txt`)

The modified SOURCE file was stashed (pre-fix `68ff124` behavior, new test
files in place) and the suites re-run:

- **RED pre-fix (deadlock → budget exhaustion):** f3b T1 (3 assertion
  failures: `resolved false`, `mode undefined`, `progressFacts 0`) and T3
  (`mutationResolved false` — the mutation never settles while the root
  delivery holds the chain).
- **GREEN pre-fix (behavior preserved, not changed by the split):** f3b
  T2 (the direct seam held no chain pre-fix — vacuously green), f3b T4
  (throw-after-settle + retry/replay already held), tcm-m3 17/18 (all
  except LOCK-1).
- **RED pre-fix (the documented interleave):** tcm-m3 LOCK-1 — actual
  `modes 'fresh+replay'` + one delivery (the pre-fix lock coupling) vs the
  new documented expectations `fresh+retry` + two deliveries.

Stash restored; post-fix everything green (`f3b-postimpl-focused.txt`).

### Focused non-regression (`f3b-postimpl-focused.txt`)

| suite | pre-fix (baseline) | post-fix |
| --- | --- | --- |
| `tcm-m3-root-initial-work.test.ts` | 18/18 (old LOCK-1 expectations) | **18/18** (LOCK-1 → the documented H3-root interleave) |
| `tcm-m3-root-work-glue.test.ts` | 9/9 | 9/9 |
| `p8s7r1-initial-work.test.ts` | 9/9 | 9/9 |
| `tcm-g1-s6-integration.test.ts` | 11/11 | 11/11 |
| `f3a-lock-scope.test.ts` (F3-A) | 7/7 | 7/7 |
| `f3b-root-initial-work-lock-scope.test.ts` (new) | — (red per red-check) | **12/12** |

Baseline: `f3b-baseline-focused.txt` (pre-fix, all five suites green).

### Full runtime package (`f3b-postimpl-full-runtime.txt`)

One process per test file (the d5 top-level crash kills any single-process
run — see f3/NOTES). **135 files (134 pre-existing + the new f3b suite),
ok=128, bad=7** — the SAME pre-existing shim-surface failure set as
`f3/postimpl-full-runtime.txt` (F3-A: 134 files, ok=127, bad=7):
`d1-member-base-tools` (3/6), `d1-s6-remote-v3` (6/14),
`d1-team-ownership-index` (5/16), `d2-s6-ensure-root-live` (5/10),
`d3-member-identity-context` (1/5), `d5-instance-contract` (2/9, top-level
crash), `pbf-default-artifact-urls` (3/9). **No new failures.**

### Typecheck / build (worktree `packages/runtime`)

- `tsc -p tsconfig.json` → exit 0
- `tsc -p tsconfig.build.json` → exit 0 (rebuilt the TRACKED runtime dist —
  the same-commit rebuild house rule; the dist diff is confined to the
  four `root-initial-work.{js,d.ts,maps}` artifacts of this module)

## Blockers / notes for the gate

1. **`vitest run` cannot execute in this sandbox session** (same blocker
   as F3-A, unchanged): vite 8 config load → `windowsSafeRealPathSync` →
   `exec("net use")` → synchronous `spawn EPERM`. All suite evidence here
   is via the repo's plain-node fallback (the SAME runner `f3/run-file.mjs`
   committed by F3-A). **Obligation: re-run the runtime package under real
   vitest in an unrestricted environment** (the shim runs the identical
   test bodies; the 7 pre-existing shim-surface red files use matchers
   outside the shim and pass under vitest in prior rounds' evidence).
2. The plain-node shim surface lacks `toBeUndefined`/`toContain`/
   `toBeDefined`/`toBeInstanceOf`/`toHaveLength`/async `it` — the 7 red
   files above are ALL pre-existing shim-surface gaps, identical to the
   F3-A baseline; this suite uses only shim-supported matchers.
3. Scratch hygiene: the suite self-cleans its four `f3b-*` scratch
   basenames at module start (a crashed red-check run leaves the old dirs
   behind — same pattern as f3a; test scratch is gitignored).
4. File scope: only `root-initial-work.ts` (+ its tracked dist artifacts,
   the house-rule same-commit rebuild), the two focused test files, and
   this evidence dir. `action-router/index.ts` is UNCHANGED (the new phase
   exports are module-level; the pre-existing index surface —
   `createAdmitRootInitialWork`, `executeRootInitialWorkLocked`, the types —
   is intact). `coordination/index.ts` untouched (see the lock-scope note
   above).

## Deliverables (this branch)

- `packages/runtime/action-router/root-initial-work.ts` (3-phase split,
  INV-9.1 / N1 + H3-root overlap docs)
- `packages/runtime/dist/packages/runtime/action-router/root-initial-work.{js,d.ts,js.map,d.ts.map}`
  (rebuilt runtime dist — same-commit rebuild rule)
- `packages/runtime/test/f3b-root-initial-work-lock-scope.test.ts`
  (F3B-T1..T4, new)
- `packages/runtime/test/tcm-m3-root-initial-work.test.ts` (LOCK-1 → the
  documented H3-root overlap interleave + header; every other scenario
  byte-for-byte unchanged)
- this evidence dir: `f3b-baseline-focused.txt`, `f3b-red-before-green.txt`,
  `f3b-postimpl-focused.txt`, `f3b-postimpl-full-runtime.txt`,
  `f3b-NOTES.md`

Not pushed (per red line; the main agent pushes after the gate).
