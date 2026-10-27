S13 drift repair — measured receipts (2026-10-27)

pristine master 0ea67bee8 (main checkout, untouched): S13 FAIL 9929ms (vitest 5000ms default vs child's own 60_000ms budget)
worktree before repair: S13 FAIL 11528ms/17213ms (idle)
worktree after parent-timer repair (120_000ms, all assertions kept): S13 PASS 9690ms, file 13/13
mutation control: expect(r.status).toBe(0) -> toBe(1) => S13 RED (non-vacuous), reverted
a5-cancel-glob.test.ts (census capture-1 COLLECTION-OR-UNHANDLED): 26/26 GREEN solo on the same tree — load flake class; census re-capture decides.
