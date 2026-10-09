# master 760e7774 — the census disagreed with itself

Run `37897691322`, 479 s, `verdict=fail`. Excerpts below are taken from the uploaded artifact
`census-runtime-transcripts-7` with ANSI stripped.

```
captured 508f/6397l, 508f/6397l
NEW RED(S) 1: TEST packages/testkit/test/a4p75-composition-smoke-classification.test.ts::composition-smoke verdict against this repository never reports 
capture 1:   (+) packages/testkit/test/a4p75-composition-smoke-classification.test.ts (54 tests) 6453ms
capture 2:   (x) packages/testkit/test/a4p75-composition-smoke-classification.test.ts (54 tests | 1 failed)
composition-smoke live leg: this checkout has no built artifact for packages/client/dist/packages/client/src/plugin/client.js — HEAD 760e7774, 0 tracked file(s) changed vs HEAD, 1 untracked entr(ies) [counted from git-status entries: an untracked directory counts as one]; packages/client/dist/packages/client/src/plugin/client.js absent (b
```

Same tree, same runner, minutes apart: capture 1 grades the file green, capture 2 grades one of its 54
legs red while the build root it complains about carries 400 files. **The leg's verdict is not a
function of the tree under test.**

Not established here: which actor removed or rewrote that path between the reads, or whether the read
raced a placement still in flight.
