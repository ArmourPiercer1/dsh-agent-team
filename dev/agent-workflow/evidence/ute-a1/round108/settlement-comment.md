[dated settlement, 2026-11-24T17:13:32Z]

Settlement for `41d5791195d199190c8d808d321aaa8e4dbca030` (round 108 — the drain-seam fix and the two rc.5 re-runs). Parent chain: `acc72e58eef3e3d791dca3da2c13cbb3adf7feae` (fix) → `603ab8f4f` (docs/gates) → `41d579119` (post-commit gate logs). Fast-forward push `e30d22c60..41d579119`; no history rewrite, no merge, **PR stays DRAFT**.

**Why this round exists.** Review `20261124-2120` §3 (first P0) named the two rows the round-106 single table still carried as rc.5 gaps: `d:remote-creation` (never re-run on rc.5 since the round-91 judge repair) and `d2:remote-delivery` (no rc.5 verdict, plus the round-105 candidate-gate MEASURED refutation of `archived-member-refused-typed`). Both are now re-run on rc.5 and both are **PROVEN**.

## Disposition (single table, rc.5 column)

| row | before | after |
| --- | --- | --- |
| 5 `d:remote-creation` | PROVEN rc.2; rc.5 not re-run | **PROVEN rc.5** — 2/2 boots, 8/8 clauses each |
| 9 `d2:remote-delivery` | **REFUTED rc.5** (1 clause: `lifecycle=SETTLED code=null requestsAdded=0`) | **PROVEN rc.5** — 2/2 boots, **20/20** clauses; archived send refused typed `TEAM_RUNTIME_WORK_STATE_REJECTED`, `requestsAdded=0` |

## The refutation was a PRODUCT defect, not an rc.2-shaped judge

`member.archive` on rc.5 returned its own typed failure (`archiveOk=false`) and the durable row stayed `SETTLED`; the round-105 observation discarded that reply's error code, so only the consequence showed. The send was correct: `SETTLED` is work-accepting, so an un-archived member lawfully accepts a delivery — **the archive had never happened**.

Root cause: **rc.5 renamed the PUBLIC `subagents.drainContinuableDescendants` to `subagents.drainDescendants`** — same signature, same aggregate-after-settle contract, the very same `manager.drainDescendants` underneath. The drain seam hard-required the rc.2 name (`stop-drain-lane.mjs` pre-fix lines 194/201) → `recursive-drain-unavailable` → `LIFECYCLE_LIVE_EFFECT_FAILED` at `drain-descendants` → **zero durable writes**.

**Fix (CORE PATCH BUDGET = 0).** `resolveDrainSeam` (`stop-drain-lane.mjs:177`) resolves the seam by public name capability (`drainDescendants`, then `drainContinuableDescendants`) and passes parents verbatim; a host exposing neither still fails closed typed (`:241`). Arms **M3-6** (rc.5 name drives the same drain) and **M3-7** (neither name still refuses) in the already-collected `packages/runtime/test/t12a-m3-recursive-drain.test.ts` (7/7). The d2 driver records the archive reply's typed channel — **observation only; no predicate relaxed, no judge skipped, no timeout widened, no retry loop, `KNOWN_REFUTED` not extended**.

**Positive control.** On the same rc.5 boots the same `member.send` channel is accepted for a LIVE member (`ok=true`, `deliveredSeq=40`) and again after `member.restore`; it refuses exactly the ARCHIVED target. Nothing was relaxed into "nothing happened".

## Measured (rc.5, both `--boots 2`, `agreeing=true differing=[]`)

```
d    RESULT PASS — 6/6 judges (d:remote-creation 8/8 clauses each boot)
     allowFacts=2 denyFacts=0 centreAdmissions=2 centreExecutions=2 governedSurface=true
d2   RESULT PASS — 4/4 judges; d2:remote-delivery 20/20 each boot
     archived-member-refused-typed: archiveOk=true lifecycle=ARCHIVED
     code=TEAM_RUNTIME_WORK_STATE_REJECTED requestsAdded=0
```

## Gate block at `41d579119` (logs `dev/agent-workflow/evidence/ute-a1/round108/`)

```
candidate-acceptance-gate --hosts next   pass 31 judges / 30 proven / 1 known-refuted / 0 env-limited
                                         drivers=4 records=8 agreement=true (head acc72e58e)
dispatch-tests --run --leg ute-vnext-a1  251 tests / 248 pass / 0 fail / 3 skipped (leg digest unchanged)
test-catalog --max-uncollected 41 --max-excluded 7   tests=785 / uncollected 38 / excluded 14 / findings 0
ute-cut-closure --check                  pass cut(0/148) deleted=148 prodRefs=0 distResiduals=0
ute-p0-assets --check                    pass 37 modules / 180 files / 69,512 lines cut(148/148)
docs-sync --check                        docs=193 findings=0 blocking=0 contracts=20
place-dist-glue                          done (35 placement(s)), byte-identical
eb3-ci-required                          pass workflows=11 findings=0
bound vitest leg (ci-integration)        PASS 15 suites / 238 passed / 0 failed
UTE G1 nine-file argv                    89 tests / 89 pass / 0 fail / 0 skipped
ute-a1-window --check                    pass red=0/0 cut=(148/52)
eb3-run-manifest                         pass records=552 strict=0 incomplete=11 findings=0
ci-pr-gate --full --census-captures 2    PASS 10/10 (321.3 s; census 599f/7424l, identical identity sets)
```

**One flake disclosed, not hidden.** The first `ci-pr-gate --full` attempt (same argv) went red on the census leg: `u6-mcp-017-regression.test.ts` failed in **capture 1 only** with `ERA_NEGOTIATION_FAILED` → `ConnectTimeoutError` to the test's own `127.0.0.1:3985` (10 s); capture 2 passed, so the union graded red. The test passes alone in 77 ms, no listener/stray process existed, and the identical re-run is PASS 10/10. Nothing in this round touches MCP discovery.

**Population delta: zero new scannable files.** No test file added/removed; two `it` arms inside an already-collected file; no dispatch leg changed; catalog population and leg digest unchanged by construction; rc.2 verdicts untouched (no rc.2 run this round, no historical evidence edited).

**No row moves.** Both rows stay **DEV-LIVE** (the gate is non-required); nothing becomes PRODUCT-PROVEN; PR #822 remains DRAFT and unmerged.
