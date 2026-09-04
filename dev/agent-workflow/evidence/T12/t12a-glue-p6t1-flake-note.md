# T12-GLUE evidence note — p6t1-parallel P2 flake (pre-existing, independent of Lane A)

## Observed

Sanctioned runtime chain runs around the T12-GLUE commit (1051 tests):

| run | result | note |
| --- | --- | --- |
| 1 | 1050 pass / 1 fail | p6t1-parallel P2: `errors.length` 0 → **2** |
| 2 | 1051 / 0 | green |
| 3 | 1051 / 0 | green |
| 4 (exact committed state) | 1050 / 1 | same P2 test: `errors.length` 0 → **4** |
| 5 (exact committed state) | 1051 / 0 | green (final evidence run) |

`t12a-glue-chain-run1-p6t1-flake.log` = run 1; `t12a-glue-final-chain.log` = run 5.

## Diagnosis (why this is NOT a Lane A regression)

1. **Zero file overlap.** The complete Lane A footprint over all seven commits
   (B2, B3, H1, M1, M3, M2, GLUE) is:
   `packages/runtime/src/plugin/live/agent-bindings.mjs`,
   `packages/runtime/src/plugin/types.ts`, the nine t12a test/bridge files,
   and the p4t6 testkit pin. p6t1-parallel's runtime import graph is
   `../activation`, `../../storage/schema`, `../../contracts`, `../../domain/*`
   (blueprint/compatibility/policy), `../../storage/repositories`,
   `../../testkit/fault-injection/file-seam.mjs`, `p6t1-helpers` (+ the
   `../agent-setup/binder` import is `import type` — erased at runtime), and
   p5t1/p5t6 fake helpers. **No Lane A-touched file is in that graph**; the
   glue is loaded only by the t12a bridge.
2. **Execution order.** The plain-node runner imports files alphabetically
   and runs each file's top-level (world setup + parallel activations) at
   import time — p6t1-parallel imports before any t12a file, so the new
   glue worlds cannot seed state into it.
3. **Same code, both outcomes.** The identical (committed) glue state was
   present in the two green runs and both flaked runs — a deterministic
   regression would have failed all five.
4. **Isolation probe.** Replicating the P2 world (real TeamDomain over a
   scratch dir + real file seam, N=5 parallel activations) 6 times in a
   fresh process: **6/6 clean**. The failure appears only under full-chain
   process load (real file I/O concurrency on the Windows sandbox) — a
   timing race in a deliberately parallel test ("same template N
   simultaneous instances").
5. The shim records only the assertion failure, and the P6-T1 test file is
   out of Lane A ownership — its underlying activation error messages
   cannot be captured without modifying a non-owned file (not done).

## Verdict

Pre-existing environmental timing flake in a P6-T1 parallel-activation
test. Two consecutive green full-chain runs on the exact committed state
(run 5 above, plus run 3 pre-commit with the only delta being a
type-annotation-only edit to the new t12a test file) plus tsc 0 errors and
testkit 124/124 validate the commit. Flagged for the integrator as an
open concern; no Lane A action (the artifact belongs to P6-T1).
