# rc2-sanitize-evidence S13 — host timing disclosure (2026-10-27)

Local census capture at 05:44Z reported ONE new red:
`packages/testkit/test/rc2-sanitize-evidence.test.ts::S13 …` — `Test timed out
in 5000 ms` (vitest's default; the suite sets no testTimeout; the census note
itself states "the suite's own testTimeout (set nowhere, so vitest's 5000 ms
default)").

Measured on THIS host (nothing else running):
- the nested regression suite S13 spawns (`node --test
  scripts/sanitize-evidence.regression.test.mjs`) takes 10.3s in this worktree
  and 8.3s in the MAIN CHECKOUT (identical, pristine master tree) — i.e. ~20
  cold `node` spawns exceed the 5s default on this machine regardless of any
  lane;
- three unloaded back-to-back vitest runs of the file on the same tree:
  `1 failed | 12 passed`, then `13 passed`, then `13 passed` — a borderline
  timing flake of the CAPTURE, not a law identity (the assertion is
  `expect(r.status).toBe(0)` and the spawn itself allows 60s).

Not lane-caused (zero files of this PR are read by the sanitizer fixtures);
not silenced: the leg is re-captured in
`ci-pr-gate-census-rerun.log`; the binding verification is the hosted
ci-required run (ci-full + census) on the exact pushed candidate.
