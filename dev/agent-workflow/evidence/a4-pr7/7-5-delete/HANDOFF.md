# HANDOFF — A4-PR7 §7.5 bullet 2 (the one deletion), graded against the plan

Branch `feat/a4-75-delete` @ `d2a0d12f` (+ this docs commit), base master
`2f06bb44`, single writer, worktree `.worktrees/a4-75-delete`.
Everything below is a graded claim with a citable artifact under
`dev/agent-workflow/evidence/a4-pr7/7-5-delete/`.

## The bullet, verbatim-scoped

> **The only deletion on this list** is the Alpha.3 existential authorization
> aggregate: `leaderEnvelopeCoverage` … together with its refusal text and the
> round-5 comment that treats a covering envelope rule *as* the authorization.
> **Conditional:** this deletion may not be executed until its three
> prerequisites land, because removing the aggregate today LOOSENS the limit.

**Grade: DONE — conditional DISCHARGED BY MEASUREMENT at this base.**

| sub-claim the bullet imposes | status | evidence |
| --- | --- | --- |
| the aggregate deleted | DONE | `leaderEnvelopeCoverage` + `PermissionRiseCoverage` + `coverage` param gone from `permission-mutation.ts`; dist drift shows the same in the shipped artifact (FINAL-BATTERY §8) |
| refusal text deleted | DONE | `expansion-region-uncovered` has zero producers; the CODE constant `EXPANSION_OUTSIDE_ENVELOPE` KEPT producer-less (frozen wire vocab, `remote/src/handlers/dispatch.ts:248`) — a producer lane may not delete wire vocabulary; leg-bill §A states this |
| round-5 "carrier is the WHOLE policy" comment deleted | DONE | replaced by the §7.5 supersession note (in-text evidence pointer); the same false claim inside leg titles/describes retired too (leg-bill §C) |
| prerequisite check (1) width priced | PRESENT + re-verified | `permissionRiseClaimedPoints` (cell ∧ claimed width); counterfactual: cell-only mutant reddens carrier-width legs 1/3/4 (FINAL-BATTERY §3) |
| prerequisite check (2) width pin committed | PRESENT | `a4p7-carrier-width-under-ceiling.test.ts` green on final tree |
| prerequisite check (3) no-context = refusal | PRESENT + re-verified | port-absent mutant reddens PIN-3/PIN-5 (FINAL-BATTERY §3) |
| "LOOSENS the limit" today? | MEASURED NO | mutant census NEW 36, ALL zero-commit shapes; construction measurement of all 7 entry legs (`transcripts/entry-measure-mutant.txt`); hard stop (a) did not fire. Round-23's 38 predates prereq legs; the mechanism (width) is now doubly owned |

## The sibling §7.5 bullets (not this lane; current state verified, NOT re-implemented)

* `effectiveAuthorityCeiling()` / `narrowingForApproval()` KEPT — verified
  untouched: `git diff 2f06bb44..HEAD` over `packages/domain/authority-envelope`
  and `governance/authority-ceiling.ts` is EMPTY; call sites (:54, :423) intact.
* `verify-blueprint-version-clean.mjs` + its testkit wrapper: already on master;
  this lane RAN it (fence shape = base, FINAL-BATTERY §7).
* `lint-identities.mjs` + root script entry: present on master; RAN with the
  authoritative baseline → new 0 resolved 0.
* `smoke:composition` three-state re-scope: 7.5-correction already merged;
  untouched here (this lane does not run Playwright lanes).

## Merge-condition table (7.6 legs this lane could run, run on the final tree)

| leg | verdict | artifact |
| --- | --- | --- |
| nine-root identity census vs baseline `nine-root-2162f6a7` | **NEW 0 / FIXED 0** (22-identity red set identical; p6t1 census-load flakes cleared green, disclosed not fixed) | `scratch/final.ids.txt`, `transcripts/final-vs-baseline.diff` |
| full typecheck (`-r`) | exit 0 | `transcripts/typecheck-all.txt` |
| lint identity-diff vs `lint-identities-0237d487.txt` | new 0 / resolved 0 | `transcripts/lint-diff.txt` |
| blueprint fence shape | identical to base `dirty(6,15) unknown(0,0) advisory(6,8) refused(52,115) prose(5,5) adjudicated(16,24)` | `transcripts/fence-final.txt` |
| artifacts same-commit | rebuild (11 drift sites = the 3 edited sources) committed together; `check:artifacts:head` **drift=0 compared=1508** at `d2a0d12f` | `transcripts/check-artifacts-head.txt` |
| p4t6 ledger | green inside census; zero new scannable-path files, total stays 1021 | `scratch/census-final.json` |
| targeted suites (14 files incl. neighbours) | 247/247 green | `transcripts/targeted-{1,2,3}.txt` |

## Disclosed temporary semantics (must travel with the merge)

1. **Ask-escalation reach**: leader drives above the carrier/hard ceiling on
   approval-wired lanes with a team-root binding now open durable approval asks
   (`mutation-proposal-pending`) where Alpha.3 refused terminally. This is the
   A4-PR5 escalation law extending to the carrier axis — more friction, never
   less authority. FINDINGS §4 row 3.
2. **Binding-less approval worlds** (E1/R5-ws/R8 fixtures): the ask mint faults
   `TEAM_RUNTIME_CALLER_NOT_FOUND` at admission (before any row), replacing the
   old terminal code. If product wants the ceiling CODE to survive a
   non-mintable ask, that is a NEW decision, not this lane's; today the drive
   fails closed either way (zero write, measured).
3. `PERMISSION_ENVELOPE_EXPANSION_DENIED` remains in wire vocabulary with zero
   producers; a later wire-vocab pass may retire it with its dispatch mapping.

## For the coordinator (not worker-editable per repo rules)

* §7.5 bullet 2's checkbox and §7.7's "the Alpha.3 existential aggregate removal
  is still owed" can be struck when this branch merges — the debt is paid with
  measurements at this base, not with the round-23 ones.
* `a4p7-merge-gate.test.ts` (dist.held-by-7-6-gate coupling) intentionally
  untouched (rule 10 of the lane brief).
