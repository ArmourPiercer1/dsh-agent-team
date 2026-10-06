# A4-PR1 baseline closure

Base: `3c310342` (= master `d21effba`, all of A4-PR0). Reference set:
`dev/agent-workflow/evidence/a4-pr0/baseline-closure/failing-identities-pr0-run2.txt`
(22 identities). Tool: `scripts/fail-set.mjs` (identity grammar + diff, exit 1 on any NEW).

## Runs (this worktree, final tree)

| run | file | identities | diff vs the 22-identity reference |
| --- | --- | --- | --- |
| pre-work (before any PR1 edit) | `failing-identities-pr1-prework-run1.txt` | 25 | NEW=3 (all `p6t1-parallel`, P3 quota group) |
| **run 1** | `failing-identities-pr1-run1.txt` | 23 | NEW=1 (`p6t1-parallel::P2 N=5 … all succeed`) |
| **run 2** | `failing-identities-pr1-run2.txt` | 22 | **NEW=0 FIXED=0** — `fail-set diff` exit 0 |

Run 2 is the closure run: the failing-identity SET is identical to the reference,
identity-for-identity, with nothing fixed either (so nothing silently moved).
Raw vitest JSON reports were deleted after capture per the plan; the identity
lists above are the retained artifact.

## The `p6t1-parallel` disclosure

Three different `p6t1-parallel` identity sets were observed across four
observations of the SAME suite family — two of them on trees where PR1 code did
not exist yet (the pre-work run) :

* pre-work at base: 3 identities, the **P3 quota** group
  (`QUOTA_MEMBER_MAX_INSTANCES`, "exactly two activations succeed",
  "the final durable state holds EXACTLY two members and two COMMITTED operations");
* run 1 after PR1: 1 identity, the **P2** group (`N=5 … all succeed`);
* run 2 after PR1: **0** `p6t1` identities;
* targeted probe, `p6t1-flake-probe.txt`, three consecutive standalone runs of
  `packages/runtime/test/p6t1-parallel.test.ts` on the final tree:
  repeat 1 FAILED with 2 identities from the **P1** group ("two activated results
  with distinct instance ids and child Sessions", "two COMMITTED operations, two
  members, two distinct child Sessions"), repeats 2 and 3 PASSED 9/9.

A suite that returns three different subsets in four observations, including on
the untouched base, is nondeterministic on its own; it is not a PR1 regression.
Supporting structural argument: PR1 changes no code on that path — the parallel
activation lane does not import `authority-envelope`, `authority-ceiling`, or
`permission-plane`'s new reader, and the two kernel rewirings were pinned as
OBJECT IDENTITY (`matcherCovers`, `PERMISSION_EFFECT_PRECEDENCE`,
`PERMISSION_RESOURCE_MATCHER_KINDS`) precisely so a consumer cannot observe a
difference.

**Mismatch against the plan's allowance, reported not smoothed over:** the plan
records the flaky allowance as "`p6t1-parallel` ×2" and A1.2.4 names the **P1**
group. The standalone probe's failure (2 identities, P1 group) matches that
allowance exactly; the pre-work run's 3-identity **P3 quota** group and run 1's
1-identity **P2** group do NOT match its wording. The gate was therefore closed
on the strict criterion (identity diff NEW=0 against the 22-identity reference,
run 2) rather than on the allowance.

## Named-gate and build evidence

* `gates/named-gate.txt` — 11 files / 150 tests, all pass (the four plan-named
  PR1 files + `a3p3-permission-mutation-authority` + `a3p4-r4-authority-binding`
  + `a3p3-governance-lane-hygiene` + `a4pr0-*` ×3 + `a4pr0a-*` ×2 + `p4t6`).
* `gates/typecheck.txt` — `pnpm -r run typecheck`, exit 0, 8 packages report
  `Done` (Scope: 9 of 10 workspace projects; the tenth has no `typecheck` script).
* `gates/build-artifacts.txt` — `pnpm build && pnpm build:composition &&
  pnpm run check:artifacts`. The first two succeed; `check:artifacts` exits 1 by
  design until the rebuild output is staged, and its report is the drift list
  co-committed with this PR (see below).
* `gates/p4t6-RED.txt` / `gates/p4t6-GREEN.txt` — `expected 983 to be 978`, then
  equality at 983 (five new scannable files, arithmetic in the pin comment).
* Domain directory run (lane A): the 10 pre-existing blueprint failures only
  (9 × `t1-capability-schema`, 1 × `t2-blueprint-hash`), byte-identical to the
  pre-work capture.

## The dist drift this commit carries, and the part of it that is not PR1's

`check:artifacts` compares the committed install surface with the rebuild output.
This commit stages both categories it reported:

* **PR1's own drift** — `packages/runtime/dist/packages/domain/blueprint/**`,
  `…/dist/packages/runtime/governance/{index,permission-mutation}.*`,
  `…/dist/packages/runtime/src/plugin/permission-plane.*` (content drift), plus
  the new `…/dist/packages/domain/authority-envelope/src/*` and
  `…/dist/packages/runtime/governance/authority-ceiling.*` (produced, untracked).
* **A4-PR0's leftover** — `…/dist/packages/runtime/governance/proposal-codes.*`
  and `…/dist/packages/runtime/governance/proposal-store.*` are
  `produced-but-untracked` with NO git history for those paths: PR0 committed the
  two lane sources without their dist output. Consequence, stated plainly because
  it is a premise that turned out false: **`pnpm run check:artifacts` cannot exit
  0 on this branch at base**, independently of anything PR1 does. This commit
  stages them too — generated artifacts of already-tracked sources, zero source
  change — so the check passes for the whole tree. If the coordinator prefers PR0's
  artifacts to land in a separate commit, the eight `proposal-*` paths can be
  dropped from this commit without touching anything else; the trade is that the
  check goes red again for those sixteen files.
