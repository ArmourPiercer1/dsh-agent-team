[dated settlement, 2026-11-24T15:24:17Z]

Round 107 settlement for fc4bac62e2d91e0871804c7b2fed40419b4430a6.

Hosted census was exercised for the first time under the owner-approved ready flip at 646f353ea: `ci-census` PASS (2 captures, 599f/7422l, identical identity sets), `ci-fast`/`ci-product`/`ci-security`/`synthesize-merge-tree`/`pr-gate`/`candidate-protection` PASS. The single red was `ci-integration`: the `eb3-ci-required` positive control still pinned the literal `workflows=10` after round 105 added the candidate-acceptance workflow (population now 11).

Fixed by deriving the expectation from the tree (`workflowFiles().size`) while keeping a deliberate literal tripwire at 11, so a new workflow forces a manifest classification review instead of a silent count drift. No assertion relaxed.

Local at this head: ute-vnext-a1 251/248 pass + 3 disclosed skips; catalog 785 refused=0; cut-closure cut(0/148); p0-assets cut(148/148); docs-sync 0; 35 placements; ci-required workflows=11 findings=0; run-manifest records=546 findings=0; ci-pr-gate 10/10 (309.9 s) including a local 2-capture census.

Rulings in force: SCOPE-subprocess-ask APPROVED (process per-call ask UNSUPPORTED BY PRODUCT RULING, fail-closed, historical REFUTED preserved); P0-2 CLOSED under the lawful no-settlement boundary (SLICE-40/41/42). PR #822 stays DRAFT and unmerged; no auto-merge; no release or deploy.
