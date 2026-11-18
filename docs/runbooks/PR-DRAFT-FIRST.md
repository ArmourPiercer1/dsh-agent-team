# PR-DRAFT-FIRST — the draft-first pull-request state machine

**Dated:** 2026-11-13 (real UTC, written `date -u`). **Source:** owner ruling, relayed by the
coordinating authority to the landing seat on 2026-11-13. **Status:** mandatory execution protocol for
every pull request that targets `master`; a dated addendum in `docs/ROUTER_RULES.md` §8.11 points
here. This document does not change CI configuration, branch protection or the Required contexts; it
changes **when** a PR is allowed to spend them.

## 1. Why this exists (measured cost, not preference)

The Ready round (`L2`) runs the full census: **24 minutes minimum and 30–40 minutes with queue** on
the shared runners. The aggregate re-runs on every head move, and a settlement is mechanically void
the moment the head advances (`docs/ROUTER_RULES.md` §8.5.6.2). A PR that is opened Ready and then
pushed to — to fix a finding, to forward-merge the base, to correct a citation — **re-pays the whole
census on every push** and rewrites its settlement each time. That is the behaviour this protocol
forbids. The draft round (`L1`) is roughly **2.5 minutes** and runs no census, so all repair loops
belong there.

The rule in one sentence: **spend L1 while the PR can still change; spend L2 exactly once, on the
head that will be merged.**

## 2. The state machine

```
        ┌──────────────────────────── push / repair loop (L1 only) ───────────────────────────┐
        │                                                                                     │
     [DRAFT] ── push ──▶ L1 ──▶ green? ──no──▶ fix, push again (still DRAFT, still L1) ───────┘
        │                        │
        │                        yes
        │                        ▼
        │             C1–C7 all hold? ──no──▶ back to the repair loop (never mark Ready early)
        │                        │
        │                        yes
        │                        ▼
        │             write dated settlement (current 40-hex head, run id, evidence paths)
        │                        │
        │                        ▼
        │             gh pr ready  ──▶ exactly one L2 on the frozen head
        │                        │
        │                        ▼
        │             pr-gate + ci-required + pr-settlement-gate success on the SAME head
        │                        │
        │                        ▼
        └──────────────▶ gh pr merge <n> --squash --match-head-commit <40-hex>
```

- A PR is **created as a draft** (`gh pr create --draft`). Never open Ready directly.
- In **DRAFT**, only L1 runs. Pushes are free of census cost; use them.
- `gh pr ready` is a **one-way gate for that head**: it triggers the aggregate's L2 because
  `ready_for_review` re-runs `ci-required` on the same head.
- **After `ready`: no more pushes.** The head is frozen (C7). The one permitted sequence after a
  Ready transition is the merge.
- If a change becomes necessary after Ready: **undo the state first** —
  `gh pr ready --undo <n>`, push, wait for L1, write a **new** dated settlement for the new head,
  then `gh pr ready <n>` again **once**. Do not push while Ready and hope; the settlement would die
  and the census would be paid twice.
- **One state change at a time** (draft / ready / label): a second transition while the first round
  is still running cancels the pending run and destroys the verdict
  (`docs/ROUTER_RULES.md` §8.10.3).

## 3. Entry criteria — C1–C7 (all required before `gh pr ready`)

| id | criterion | how it is checked |
| --- | --- | --- |
| **C1** | **Change complete.** No unpushed commits, no "fix it after CI" TODO, no placeholder in the docs/evidence the PR claims. | `git status` clean; `git rev-list --count @{u}..HEAD` = 0; self-read of the diff. |
| **C2** | **Synced with master.** The base is an ancestor of the head. | `git merge-base --is-ancestor origin/master HEAD`. If BEHIND, update **while draft** (`gh api -X PUT …/update-branch -f expected_head_sha=<40-hex>`); the head moves, so the settlement is void and L1 must be waited again. |
| **C3** | **L1 green.** `ci-fast`, `ci-integration`, `ci-security`, `ci-product` all pass and `ci-required-deferred` is success. | The draft-shape table in §4. `ci-required` failing and `ci-census` skipping are **expected** in draft, not reds. |
| **C4** | **Independent review PASS**, every finding closed with evidence. | A reviewer seat that did not author the change; each finding carries the command/evidence that closes it. If no independent seat was convened, say so in the settlement rather than implying one. |
| **C5** | **Docs/evidence updated** as the change requires (register, matrix, ledger, release notes, runbook). | Covered by L1: `ci-fast` runs the docs probe and `docs:sync --check`. |
| **C6** | **Settlement written before Ready.** A dated on-PR comment whose first line is a closed-set opener, covering the **current 40-hex head**, citing the L1 run id and the evidence paths. | `docs/ROUTER_RULES.md` §8.5.2/§8.5.6.2; the `pr-settlement-gate` machine verdict. |
| **C7** | **Head frozen.** No push, no force-push, no rebase after the settlement; `--match-head-commit` pins the merge to this exact sha. | The merge command itself refuses a moved head. |

## 4. Expected CI shape in draft (this is normal, not breakage)

| check | draft result | meaning |
| --- | --- | --- |
| `ci-fast`, `ci-integration`, `ci-security`, `ci-product` | **must pass** | the four real L1 layer verdicts |
| `ci-required-deferred` | **must pass** | the deferral/label leg is honest |
| `ci-census` | **skipping** (by design) | the census only runs when the PR is not a draft and not labelled `ci-defer-full` |
| `ci-required` | **failure** (fail-closed, by design) | the aggregate refuses to be green while a layer is skipped; it turns green on the Ready round |
| `pr-gate` | red only for a missing settlement | expected until C6 is written; any other `pr-gate` red is a real finding |

A red **anywhere else** in draft — or a red in one of the four layer jobs — is a real failure: read
the job log, fix in draft, push again. Stop and report instead of pushing if the red is outside the
PR's blast radius (CI infrastructure, branch protection, a Required-context change).

## 5. The Ready round — exactly once

1. Confirm C1–C7 in that order; record the head sha.
2. Post the settlement **first** (`**[dated settlement, <UTC>]**`, four elements of §8.5.2, the
   covered 40-hex, the L1 run id, evidence paths). A comment does not trigger a workflow, so this is
   free; the `ready_for_review` round is what reads it.
3. `gh pr ready <n>` — once. This starts the one L2.
4. Wait for the L2 to finish (expect ~24 min, up to ~40 with queue). Do **not** push, relabel, or
   toggle the draft state while it runs.
5. Verify `mergeStateStatus=CLEAN` and that `pr-gate`, `ci-required` and `pr-settlement-gate` are
   **success on the same head**; then merge:
   `gh pr merge <n> --squash --match-head-commit <40-hex>`.
6. If the census goes red: triage per `docs/ROUTER_RULES.md` §8.10.5 (same-head job rerun once, keep
   both transcripts); a second red is a regression — stop and report. To fix, `--undo` to draft,
   repair, and re-enter at step 1 with a **new** settlement. That is the only path that may exceed
   one L2, and it must be disclosed.

## 6. Interpretation table

| signal | meaning | action |
| --- | --- | --- |
| `ci-required` red while draft | fail-closed aggregate; a layer is deliberately skipped | ignore **only** if the four layers + deferred are green |
| `ci-required-deferred` red | the deferred/label leg itself is broken | real red; fix in draft |
| `ci-census` skipping in draft | correct tier | none |
| `ci-census` running/failing while draft | the draft tier did not switch, or a label is wrong | investigate before Ready |
| `BEHIND` | master moved past the head | update **while draft**, re-wait L1, rewrite settlement |
| `pr-gate` red, `pr-settlement-gate` red, no settlement comment | expected in draft | write the settlement before Ready |
| settlement red after Ready | the comment does not cover the current head (head moved) or the opener is malformed | do not merge; `--undo`, re-settle at the real head |
| `mergeStateStatus=BLOCKED` on a fully green Ready head | an unresolved review thread or a non-CI rule | resolve the thread; do not admin-merge |

## 7. Time discipline and hard limits

- **Budget the wall clock, not the attempt count.** Per PR: ≤ 2 hours against
  `docs/ROUTER_RULES.md` §8.10.8, and **exactly one L2** in the normal path. L1 rounds are cheap but
  not free: batch the repair loop, do not push one line at a time.
- **Never** `--no-tests`, never widen a union/law to go green, never move a test into a known-red
  baseline, never bypass the settlement, never merge with administrator rights.
- **Never** `ci-defer-full` on the final head; the label defers the census and a deferred census is
  not a merge verdict.
- **Never** force-push a branch that carries committed evidence (the evidence-binding law,
  `docs/ROUTER_RULES.md` §8.5.7); forward-merge only.
- **Never** cancel a run that is not superseded. Cancelling a superseded run that is holding the
  per-ref concurrency slot is permitted and must be noted on the PR.
- The merge verdict is exactly three contexts — `pr-gate`, `ci-required`, `pr-settlement-gate` — all
  green on the same head (`docs/ROUTER_RULES.md` §8.10.9). CI green alone is not a settlement.

## 8. Relationship to existing law

This runbook operationalises, and does not replace, `docs/ROUTER_RULES.md` §8.5 (settle-before-merge
and its machine gate), §8.10 (the three-tier L0/L1/L2 semantics) and §8.5.7 (evidence-binding: no
rebase on a branch that carries committed RUN records). Where this document and CI configuration
disagree, the configuration wins and the discrepancy is a finding to report, not something to edit
around.
