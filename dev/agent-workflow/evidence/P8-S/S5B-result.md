# P8-S5B TaskResult — operation fencing, R1..R6 verdicts (plan §19 Goal 3; CR-8)

## Verdict
**PASS** — one shared Team-level coordinator is IMPLEMENTED (single new seam
`packages/runtime/coordination`, wired by the production root through the
router facade, activity ledger and P7-T3 lifecycle service); R1, R2, R3, R4,
R6 are PROVEN sufficient by controlled-interleaving race tests; R5's
drift||new-work window is proven REAL at the true CR-8 seam (independent
compatibility-consultation sites) and CLOSED by the coordinator under
identical interleavings. No second Team authority, no new public seams,
read-only ops unblocked beyond current behavior, core patch budget 0.

## Verdict table
| race | window | verdict | evidence |
|---|---|---|---|
| R1 | follow-up \|\| archive-member | PROVE sufficient | branch-aware invariants, both serialization orders |
| R2 | follow-up \|\| dispose-member | PROVE sufficient | same; dispose in the P6T2 human envelope |
| R3 | restore-member \|\| follow-up | PROVE sufficient | same |
| R4 | create x3 @ quota boundary | PROVE sufficient | order-independent exact-limit counts (1 admit, 2 rejects) |
| R5 | drift \|\| new work | COORDINATOR IMPLEMENTED | grid: >=1 NO_STATE hit without, ZERO with |
| R6 | mutation \|\| next-step begin | PROVE sufficient | serialized: 1 admit + deterministic gen conflict; unserialized: lost-update evidence |

## R5 — the window and its closure
CR-8 named >=4 independent per-team lock maps + per-prober serialization.
Two facts locate the true window: router-mediated follow-ups give ZERO
NO_STATE hits across a 0..24 stagger sweep (the facade chain serializes
intra-router work), and a symmetric two-authority sweep (S = 0..32) also
gives ZERO (B's probe->put span is structurally shorter than A's
put->post-probe-re-read gap). The window opens when B's environment-facts
delivery lags A's (production shape: each site awaits its own facts port).

Method (in the test header): 2D CONTROLLED grid, S = 0..12 start stagger x
D = 0..6 facts-delivery microtask delay, FRESH real TeamDomain world per
cell, pure-microtask engine — deterministic, every cell reproduces the same
interleaving every run (no wall-clock, no native timers). Measured capture:
`tc-s5b-r5-grid-sweep.txt`. D shifts B one tick at a time through A's probe
lifecycle: dual-probe lost-update cells (D=0..3; e.g. (0,0) both probe,
final gen 2; (0,1..3) B's previous-get in A's delete->put gap, final gen 1);
the CR-8 HIT (S=0, D=4): `A=reprobe(no-state-after-reprobe)`,
`B=block(gen=3)`, probes 1/1 — B's probe-delete lands in A's put->re-read
gap; the row stays well-formed (final gen 3, drift-bound); then serialized
no-probe cells (D>=5).
Half A (no coordinator): safe set everywhere (never 'admit' — drifted facts
can never evaluate ok), >=1 NO_STATE_AFTER_REPROBE across the grid,
dual-probe cells exist, row well-formed everywhere. Half B (both admits
through ONE shared chain, IDENTICAL grid): ZERO NO_STATE, exactly one
re-probe per cell, final generation = initial + 1, both fail-closed blocks
— the window closed under exactly the interleavings that open it.

## Files changed (commit 1)
NEW `packages/runtime/coordination/index.ts` — `createTeamOperationCoordinator()`
(`readonly chains`; `run(rootSessionId, work)`; doc: CR-8 rationale,
non-re-entrancy, provider-subsumption proof).
WIRING (additive optional parameter; private defaults unchanged):
`admission/types.ts`, `action-router/effects.ts` (`executeEffectLocked`),
`action-router/router.ts` (ONE facade acquisition over the isNewWorkAdmission
gate + effect), `activity/types.ts`, `activity/ledger.ts`,
`lifecycle/index.ts`, `src/plugin/root.ts` (coordinator built once, wired
into lifecycle + teamRuntime + activity ledger; the ActivationProvider map
stays private — its ops are a strict subset of the chain-covered sites).
NEW `packages/runtime/test/p8s5b-operation-fencing.test.ts` (26 tests).
PIN `testkit/test/p4t6-session-event-scan.test.ts` 515 -> 517 (the two new
scanned files; scanner .mjs byte-frozen).

## Green list (worktree, base `be9e1d4f`)
- **B1** race tests 26/26 (method above, stated in the file header).
- **B2** fresh full chain: **1939/1939** (1913 base + 26 new;
  `tc-s5b-chain-full-1.log`). p6t1-parallel 9/9 (the ~1-in-3 baseline flake
  remains in force; file unmodified).
- **B3** dist rebuild (legacy tsc noCheck mirror -> runtime tsc
  tsconfig.build -> yaml junction; `tc-s5b-build-dist-1.log`) then full
  chain **1939/1939** (`tc-s5b-chain-full-2.log`).
- **B4** tsc 8-set separate invocations (client, contracts, domain, remote,
  runtime, storage, testkit, tools; legacy excluded): all exit 0.
- **B5** `git diff be9e1d4f -- packages/contracts packages/remote`: EMPTY.
- **B6** p4t6 pin 515 -> 517 (title clause + enumeration + counts).
- **B7** live **17/17** (E1-E7, W1/W2/W3/W5/W7, M1-M5), port 3181, fresh
  homes (`.dsh-test-p8s5b{-e}`; `tc-s5b-live-17-1.log`; reports in
  `packages/tools/harness/reports/p8s5b-20260902-013047/`). summary.json:
  `failures` key present, empty; 17/17 `pass:true`; required keys
  criterion/pass/durationMs/assertions/failing/http/evidence in all 17
  (+ `boot` in the 16 boot-bound ones; E7 is the harness's static
  bypass-scan criterion, `boot=undefined` by design — pre-existing shape).
  test-use byte-clean before/after (HEAD `cd5ef814`, porcelain empty);
  :3080 preflight 200 read-only; no lock file remains; `.tmp-fault` clean.

## Commits
- base: `be9e1d4f9d5357be0f97547280e25b1734610aa2`
- commit 1 (implementation): `c4d13a8bd4521073c1c6ad40b03ebeadbe1cab53`
- commit 2 (evidence): the branch tip at task completion (a commit cannot
  contain its own SHA, per the P6-T4 precedent).

## Open items
- The per-prober promise-chain lock inside `createCompatibilityProber`
  remains as defense-in-depth for single-site re-entrancy; the shared
  coordinator is the only cross-site Team serialization seam. No frozen
  compatibility/storage semantics changed; `p6t1-parallel.test.ts` untouched.
- No CORE_SEAM_BLOCKER / CONTRACT_CHANGE_REQUEST / ARCHITECTURE_DECISION_REQUIRED.

## Blockers
None.
