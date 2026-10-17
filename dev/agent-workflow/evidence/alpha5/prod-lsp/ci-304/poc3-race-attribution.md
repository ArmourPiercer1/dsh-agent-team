# poc3-probes PoC3-E leg-1 — census-load race attribution (2026-10-17)

## What the census saw

Nine-root census on HEAD `f4b8ca0b` (pair 1, capture 1 of 2):

```
FAIL packages/runtime/controlled-fs/test/poc3-probes.test.ts > PoC3-E fd continued-use after close
  > GUARDED: the lane holds no standing fd — a presented fd of a closed call is refused
AssertionError: expected 'fd-recycled' to be 'fd-closed'   // poc3-probes.test.ts:261
```

The GUARD HELD in the failing capture: line 258 (`res.ok === false`) passed — the stale fd was
REFUSED. What moved was the classification label: between the lane closing the fd and the leg
presenting it, another worker thread in the same process happened to open a file, the OS recycled
that lowest-free number, and the lane correctly reported `fd-recycled` instead of `fd-closed`.
Both labels are refusals; the leg asserts the narrower one.

## Why this is a process-wide race, not a product change

- The file itself documents exactly this race on its SIBLING leg (line 274-281): "The nine-root
  census runs this file's process alongside other files' tests (worker threads share the fd
  table), so the number may be momentarily held elsewhere — … Retry the open until recycling is
  OBSERVED". The sibling leg carries a 500-attempt bound; leg-1 has none.
- This lane (controlled-fs) was not touched by this branch: the fix commits are dist mirror
  (sandbox-provider face), bookkeeping tests, and the a5p5-dormant-audit. `git diff` over
  `packages/runtime/controlled-fs/**` between base and HEAD is empty.

## Measurements (this host, same tree as the red)

| probe | runs | poc3 failures |
| --- | --- | --- |
| solo (`vitest run poc3-probes.test.ts`) | 3 | 0 |
| coload with this lane's two REAL-Landlock suites (a5lsp2-streaming + a5lsp2-assembly, same vitest process) | 8 | 0 |
| full census captures (this branch, pre-walk-fix) | 4 | 1 (0.25) |
| full census captures (this branch, post-walk-fix) | 2 | 0 |

Coload logs: `coload-clean-*.log` excerpts retained in the census transcripts (`census-run-1-*`
contains the failing capture verbatim).

## Disposition (no check was moved, none was widened)

- poc3-probes.test.ts was NOT edited: it belongs to the controlled-fs (PR3) lane; the retry-bound
  fix pattern already exists in its own file (leg-2) and applying it to leg-1 (accept
  `fd-recycled` as an equally-guarded refusal under census load, or retry until `fd-closed` is
  observed) is the C-FS lane owner / coordinator's call, routed here as a named finding.
- This branch does not add itself to any family disclosure; the baseline was not touched.
- The residual CI risk is stated, not smoothed: a CI census can still sample this race
  (observed 1/4 full runs on this host); the re-sample protocol does NOT cover it (not a
  disclosed family), so a CI hit must be handled by its owner, not by this lane.
