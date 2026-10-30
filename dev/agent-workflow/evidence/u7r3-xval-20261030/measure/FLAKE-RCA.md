# Flake RCA — the two full-family failures (u7r3-xval, 2026-10-30)

Observed during set B (`pnpm exec vitest run packages/runtime/test`, 466 files):

| row | mode | failed test | form |
| --- | --- | --- | --- |
| a+b-parallel-2 | A co-rotating | `u7-agentstate-fs-store-c1.test.ts` N2 "concurrent creators … cannot overshoot the bound" | expected 2 ok, got 1 (lock-wait timing; refused side never overshoots — the guarded safety property itself held) |
| b-rca3 | **SERIAL, alone** (RCA re-run, no co-rotation) | `a5-m1-auth-bridge.test.ts` B4-D3 "pipe held open past the death" | bounded-wait delta `-26803 >= 1950` failed (wall-clock assertion torn under load) |

Single-file re-runs after each event: N2 file **6/6 pass** (`logs/rca-n2-single-file-6x.log`), D3 file **3/3 pass** (`logs/rca-d3-single-file-3x.log`).

**Verdict: pre-existing suite-internal wall-clock sensitivity, NOT parallel co-rotation.**
Evidence: (1) the second failure occurred in a STANDALONE serial re-run with nothing else in flight — co-rotation cannot be its cause; (2) both failing tests are real-timer legs; the direction of both failures is the safe side (typed refusal / bounded-wait bookkeeping, never a contract violation: no overshoot, no double commit, no hang); (3) the risk ledger **R-413-1** (SESSION_ROUTER_LOG, 6 mentions) already registers this exact file/test-class as timing-heavy with "约 2/10 次单项瞬时失败" (≈2/10 transient single-item failures) under unmodified code, the failure class being "超时类而非错误结果" (timeout-class, not wrong results), with the standing obligation to move these legs to fake clocks in an independent small PR. Our flake density (2 of 5 full-family runs) is within that registered envelope.

**Consequences for this experiment:** P1's performance numbers are unaffected (wall/CPU/RSS are per-run `time -v` facts, independent of which assertion flaked — all 6 grid rows ±1.4% wall). No budget line is involved (no host boots in P1). No retry beyond what is recorded here was done; both flaked rows are kept in the table WITH their exit codes — failures are not washed out. Nothing here is acceptance-credit material (lane carries none); if a family gate needs a green census of this directory, run it isolated twice per R-413-1 or wait for the fake-clock PR.
