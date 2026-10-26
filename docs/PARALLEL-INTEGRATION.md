# Parallel Family Contribution and short-transaction integration (EB4-E)

**State: `DELIVERED` for the rule documentation and the `integration-order.mjs` binding checker.**
Tool: [scripts/integration-order.mjs](../scripts/integration-order.mjs). Tests:
[tests/u7-3-devex/devex-integration.test.mjs](../tests/u7-3-devex/devex-integration.test.mjs).

This page documents the rule from the current plan (U7 bullet, EB4-E, verbatim):

> 并行的 Family Contribution 及短事务集成，分支局部 C2 不能替代合并后的 C2 — two independent
> Family worktrees wire in parallel in non-conflicting semantic regions of `agent-bindings.mjs`/
> `team-tool-plane.mjs`, each runs local real C2; the Integrator merges by short transactions into
> one candidate, re-runs C2 on the shared registration / teardown / authorization chain plus
> cross-tool security negatives; record waiting, conflict repair, CI p95, rework, and Reviewer load.

In English: **branch-local C2 cannot substitute for merged-head C2.**

## 1. Why the rule exists (mechanical, not ceremonial)

`agent-bindings.mjs` and `team-tool-plane.mjs` are shared surfaces. A C2 run on a family branch
measures the tree **without** the other family's contribution. That C2 is real evidence for that
branch, but it does not cover the merged candidate. Two things the branch-local C2 provably cannot
see:

* The other family's registration path going through the governance-center kernel alongside this
  family's (collision, `DUP_FAMILY_ID`, `NAME_COLLISION`, `STALE_GENERATION`).
* The cross-family security negatives: a permission for family A in a world that also has family B
  mounted may allow or deny differently than a world with only A.

The consequence is direct: a Reviewer who accepts a branch-local C2 as the candidate receipt is
accepting a claim about a tree that does not exist yet.

## 2. What counts as evidence, per class

The class vocabulary is the one `scripts/integration-order.mjs` computes per `u5-run-record/1`
binding (field `bindings.teamSha`):

| Class | Meaning | Usable for the candidate? |
| --- | --- | --- |
| `EXACT_MERGED_HEAD` | teamSha IS the candidate — the strongest form | Yes |
| `MERGED_ANCESTOR` | teamSha is behind the candidate (lag N commits) | No — it did not test the candidate; re-run |
| `BRANCH_LOCAL` | teamSha DESCENDS from the candidate (branch-only commits ahead) | **No — branch-local C2, the substitution EB4-E forbids** |
| `UNRELATED` | neither ancestor nor descendant | No — history diverged |
| `NO_TEAM_SHA` | no binding SHA in the record | No |
| `INCOMPLETE_RECORD` | no `overall`, zero cases, or no `finishedAt` | No — not delivery |

Records the scan refuses on size are listed under `NOT GRADED` with their byte count (see §4).

An `INCOMPLETE_RECORD` is important: a C2 run that was started but never finished has `overall:null`
and zero `cases`. That is not "C2 pending" — it is a record with no verdict. It is not delivery.

## 3. The integration order

1. Family A and Family B work in independent task worktrees; each writes to non-conflicting regions
   of the shared surfaces (ARC-A law L1 / L4 governs which regions; see
   [dev/agent-workflow/ledgers/arc-a-protected-center.json](../dev/agent-workflow/ledgers/arc-a-protected-center.json)
   for the digest-pinned protected set).
2. Each family runs real C2 on its own branch. This C2 is `BRANCH_LOCAL` relative to the future
   merged head; it proves the family's own contribution works in isolation and earns the C1 receipt.
3. The Integrator merges short transactions: one family at a time, each as a reviewable PR. The
   short-transaction candidate is the merge commit.
4. The Integrator (or a follow-up) re-runs C2 on the short-transaction candidate:
   * shared registration / teardown paths;
   * authorization chain for the combination;
   * cross-tool security negatives (a tool from family A refusing when family B is also mounted).
   This run is the candidate's `EXACT_MERGED_HEAD` C2. It is what a Reviewer accepts when they
   approve the merge.
5. Record conflict repair time, CI p95, rework rounds, and Reviewer load, per the plan. The WIP cap
   is changed by measurement, not by limiting shared-file authors.

## 4. Checking binding status

```bash
node scripts/integration-order.mjs --target origin/master
# prints one line per C2 record in dev/agent-workflow/evidence/**/
# with its class, suite, and (for MERGED_ANCESTOR) the lag

node scripts/integration-order.mjs --target origin/master --branch <family/branch> [--strict]
# --strict: exits 1 if ANY record is not EXACT_MERGED_HEAD for the target
# "unresolvable target" REFUSES exit 2 — absence is never a clean report
```

Two recorded runs, each quoted only from its own receipt (counts grow as evidence is merged, so the
command is the fact; re-run it for a current value):

| Receipt | Base | Records | MERGED_ANCESTOR | INCOMPLETE_RECORD | NO_TEAM_SHA | NOT GRADED | EXACT_MERGED_HEAD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [eb4de-receipts.txt](../dev/agent-workflow/evidence/u7-3-20261026/eb4de-receipts.txt) | `94890f090` | 40 | 27 | 11 | 2 | 6 | 0 |
| [eb4c-receipts-r2.txt](../dev/agent-workflow/evidence/u7-3-20261026/eb4c-receipts-r2.txt) | `c5e43f1d5` (pinned) | 45 | 32 | 11 | 2 | 11 | 0 |

Both end on the same rule line, e.g. at the later base:

```text
RULE branch-local C2 cannot substitute for merged-head C2: 32 record(s) do not bind the candidate; 0 do.
```

`NOT GRADED` lists files over the 512 KiB record cap by name and byte count — skipped loudly, never
silently; none of them is a `u5-run-record`.

`BRANCH_LOCAL` is reachable on real commits, not only in the self-test: this branch's own tip is a
descendant of `origin/master`, and a record bound to it classifies as `BRANCH_LOCAL … ahead of the
candidate by N commit(s)` (the receipt records the SHAs and N of the run). A record bound to a family branch reads exactly like that against the
merged head — which is why the class exists.

The fact that 0 records are `EXACT_MERGED_HEAD` at the current master head is the correct reading:
the prior-lane C2 evidence bound earlier SHAs, which are now merged ancestors. **This is not a red
for those lanes** — their C2 ran on the candidate for THEIR merge. It becomes a red only for a PR
that claims the evidence covers THIS tree.

Bounds (declared): ≤ 400 records scanned (`.json`, ≤ 512 KiB each), ≤ 40 rows per class, stdout ≤
24 KiB, no child process beyond `git`. Read-only; it is one pass over the evidence tree plus a
memoized git pair per distinct SHA.

Most `NOT GRADED` entries are vitest census captures under
`dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/` that are **tracked at master**, although that
directory's own
[UNTRACKED-SCRATCH.md](../dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/UNTRACKED-SCRATCH.md) says
such captures are "not to be committed". At `c5e43f1d5` there are 18 of them (9 `census-*` +
9 `census-comparison-*`, 32.1 MB), added by U7-6 `d41168bd0` (6 files) and `0b6ce0213` (2), U7-4a
`f6a119736` (6), and the U7-4a merge `30ed4ec0b` (4); U7-6 `4cbf414f6` un-tracked two others that had
been swept in the same way. The count grew while this page was being written, which is the point:
nothing stops it. This branch neither adds nor removes any of them. Here they only cost a
`NOT GRADED` line; whether they stay in git is the evidence owner's (EB4-A) call, not this checker's.

## 5. What this does not answer

* Whether any C2 run PASSED its own lanes (a binding check, not a lane-verdict check).
* Whether the protected-set is drift-free on the candidate (that is the L1 scan in
  [ARC-A fitness](../packages/runtime/test/u6-arc-a-fitness.test.ts)).
* Whether the cross-family security negatives were exercised (the Integrator's obligation, not
  statically checkable from the binding alone).

## 6. Related

* [DIAGNOSIS-CALL-CHAIN.md](./DIAGNOSIS-CALL-CHAIN.md) — attributing a refusal that appeared during
  a cross-family authorization run.
* [RELEASE.md](./RELEASE.md) — the release promotion procedure that requires the candidate tuple.
* [dev/agent-workflow/ledgers/arc-a-protected-center.json](../dev/agent-workflow/ledgers/arc-a-protected-center.json)
  — the digest-pinned protected-center set that governs what a family-addition PR may not touch.
