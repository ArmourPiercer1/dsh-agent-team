# a5g6-install-face-render — first-test 5 s timeout under parallel load (disclosed)

Observed: twice, in the 41-file parallel regression at S3a (5e27df4b2) and S4
(20539aa70): `GLUE-6 LEG B … the trio definitions all carry a render that
returns an array of typed text blocks` → `Error: Test timed out in 5000ms.`
That test is the file's FIRST: it pays the cold dynamic import of the whole
plane graph (a5p5 .ts transforms) under vitest's default 5 s timeout while
~40 other files transform concurrently. Not an assertion failure; no assertion
in the file was changed by this branch.

Re-checked on the tree merged with #397 (master 21f3f5b08):
* head, the same 41-file parallel set + law suite + p4t6: 3 runs, 618/618
  each — a5g6 did not time out.
* master snapshot (git archive of 21f3f5b08), same parallel set: 3 runs,
  a5g6 did not time out either. (That snapshot showed 6 OTHER failures in
  every run, all from the snapshot itself — suites that `git show` history
  or resolve the pinned host checkout — not product behaviour; they pass on
  the real master/worktree.)
* isolated cold cost of that first test, 3 runs each: master 695/899/862 ms,
  head 831/900/957 ms (~+10%: the seam + three descriptor modules are extra
  imports in the same graph).

Reading: an intermittent load-dependent timeout of a cold-import test, made
slightly more likely by a ~10% larger import graph, not a behaviour change.
Not reproduced on master in 3 runs, so "pre-existing" is NOT claimed. This
lane does not raise the timeout (test-infra change, out of scope); flagged for
the CI owner with the numbers above.
