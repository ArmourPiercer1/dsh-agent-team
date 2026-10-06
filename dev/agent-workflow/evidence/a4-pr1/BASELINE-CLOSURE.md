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

## The dist this commit carries, and why it is emitted (corrected on review)

`check:artifacts` compares the committed install surface with the rebuild output.
At this HEAD the build is clean: `gates/check-artifacts-postcommit.txt` records
exit 0, `OK: 1464 files` (base measured `OK: 1444 files`).

**What PR1 added, and the mechanism that put it there.** Two categories, one
cause — TypeScript emits every file in the program, and a `tsconfig` `include`
does not gate *transitive* emission (ADR A5-19 states this; X5-E5 predicts this
exact consequence for PR1 and rules that **PR1 owes a dist co-commit**, so the
co-commit is per plan, not a workaround):

* modules PR1 authored: `…/dist/packages/domain/authority-envelope/src/*` and
  `…/dist/packages/runtime/governance/authority-ceiling.*`;
* modules PR1 changed: `…/dist/packages/domain/blueprint/**`,
  `…/dist/packages/runtime/governance/{index,permission-mutation}.*`,
  `…/dist/packages/runtime/src/plugin/permission-plane.*`;
* modules PR1 **reached**: `…/dist/packages/runtime/governance/proposal-codes.*`
  and `…/dist/packages/runtime/governance/proposal-store.*` — **8 files**
  (4 each: `.js`, `.js.map`, `.d.ts`, `.d.ts.map`).

The reachability chain for the last category is worth writing down, because the
first draft of this section explained it wrongly:

1. `packages/runtime/governance/index.ts` gained a **value** re-export from
   `./authority-ceiling.js`, so the barrel's program now includes that module;
2. `authority-ceiling.ts:68` holds `import type { ProposalAuthorityPosition }
   from './proposal-store.js'` — deliberately **type-only** (X5-E1: vocabulary,
   not an edge), and `proposal-store.ts` in turn pulls `proposal-codes.ts`;
3. program membership, not `include`, decides emission ⇒ both proposal modules
   are emitted.

At base `d21effba` the same barrel mentioned `proposal` **zero** times and no
non-test source imported `proposal-store`, so neither module was in the program
and no dist for them existed. **Therefore `pnpm run check:artifacts` was
legitimately green at base, and this is where the record is corrected: the
earlier claim in this file — "PR0 committed the two lane sources without their
dist output", "check:artifacts cannot exit 0 at base" — is REFUTED.** PR0 left
nothing untracked; the files became owed only when PR1's barrel re-export made
them reachable. The count is 8, not 16: the first draft double-counted by
treating each `.map` as a separate artifact beyond its module.

**What this spends for PR5.** A4-6 anticipated these emission and assigned them
to PR5 ("PR5 co-commits the emitted proposal files"). PR5 now owes **0** of
them: they are in this commit, generated from already-tracked sources with zero
source change. Nobody should re-add them at PR5, and PR5's file list should be
read as discharged on this point.

### No new `governance → storage` edge, and why the hygiene allow-list did not move

The emission above is not an authorization edge, and the distinction is the
reason this PR needed **no change** to the storage allow-list at
`packages/runtime/test/a3p3-governance-lane-hygiene.test.ts` (`no
governance-lane module imports storage outside the allow-listed edge`):

* `authority-ceiling.ts` references `./proposal-store.js` under `import type`
  only. It is erased at emit: `grep -n "require(" \
  packages/runtime/dist/packages/runtime/governance/authority-ceiling.js` is
  **empty**, and the reference survives only in the `.d.ts` (`:51`). A caller
  also cannot smuggle a payload string into a parameter of that type — which is
  what invariant #16's principal-from-payload ban needs, and why the type-only
  form was chosen over a locally re-declared union.
* The one real `governance → storage` value edge in the tree is
  `proposal-store.ts:88`, which predates PR1 and is already the named, justified
  entry in the allow-list (the "derive an identity through the module that owns
  it" reasoning recorded there).
* PR1's own runtime import into `governance/` goes the other way and is
  **type-only in the direction that matters**: `permission-plane.ts` imports
  `AuthorityDocumentRead` from `../../governance/authority-ceiling.js` as a type
  (round-1 review SF1 needs that alias — the reader's three-way outcome and the
  ceiling adapter's slot type must be ONE type or the collapse reopens). The
  hygiene leg asserts that import is `import type` and that the module's only
  two importers are `governance/index.ts` and that file.

Both statements are machine-checked rather than asserted in prose: the storage
leg and the new `the module itself has exactly the importers PR1 gave it` leg
are in the 13/13 named-gate run in `gates/named-gate.txt`.
