# Independent leak audit for both starts (written by hand, real UTC 2026-10-30T13:16Z)

Why this file exists: the p2 run's own `ui:leak-check` cell is recorded **FAIL**
(`teardown threw: world is not defined` — the lane's own `cleanup()` closure bug,
RCA in the reconstructed record). The verdict is NOT laundered; it stays FAIL.
What this file adds is the same audit performed by hand afterwards, so the
environment facts are on the record either way.

| check | expected | observed | source |
| --- | --- | --- | --- |
| boot ports released | closed | `3191 → 000`, `3192 → 000` (connection refused) | `curl` after both runs |
| mock provider ports released | closed | `13056 → 000`, `13057 → 000` | `curl` |
| stable dev instance untouched | read-only, never bound | `:3080 → 401` before start#1, between starts, and after start#2 | `curl` (probe only, never a boot target) |
| `~/.dsh` invariant | untouched | mtime `2026-10-28 13:45:42 +0000` (days before this lane) | `stat` |
| lane World homes removed | 0 left | `.worktrees/u7r3-uif4/tests/homes/` = **0 entries** (p2 torn down by the runner's World registry; p1's was removed by hand after copying its witnesses into `start1-p1-world-remnants/`) | `ls`/`find` |
| main-checkout World homes | no lane-created worlds | `tests/homes/u5p1*`, `u5p2*` → 0; the 8 entries that exist (a5m2-*, s1-*, .playwright-browsers) are all older than 2026-10-30 | `find tests/homes -newermt 2026-10-30` → 0 |
| host/product tree | tracked porcelain 0 | **0** tracked modifications before start#1, between starts, and after start#2 | `git status --porcelain --untracked-files=no` |
| untracked entries | disclosed | `.pnpm-store-lane/`, `.u7r3-tmp/` — sibling lanes, pre-existing at spawn, NOT git-ignored, left untouched | `git status --porcelain` |
| writes outside the World | none | every lane write is under `.worktrees/u7r3-uif4/` (lane branch files, `tests/homes/<world>`, this evidence dir) | this branch's diff |
| stray lane processes | none | the boot port and both mock ports refuse connections; the only process this lane ever killed was its own stuck start#1 process group (disclosed in `RCA-start1-abort.md`) | port probes + the kill record |

Residual risk stated plainly: because `world.teardown()` did not run inside the
suite on the p2 path, the lane cannot claim its OWN teardown receipts
(port-lease release + home deletion) as witnesses — the runner's registry did
that work, and the hand audit above confirms the end state. The code fix landed
on this branch (`world` hoisted above `cleanup()`), but re-verifying it live
would cost start #3, which the lane's budget rule reserves for ENV failures.
