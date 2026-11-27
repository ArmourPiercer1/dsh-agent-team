# Owner-approved ready flip — the complete hosted set, twice

Ruling 3 (review 20261124-2120) authorised ONE temporary ready flip to exercise `ci-census`, explicitly excluding
merge, auto-merge, release or deploy. Head froze at each attempt; a head change voids the census for that head.

## Attempt 1 — head `646f353ea1cb993f0c76fe7c99e40e7009bab7ec`

`ci-census` **PASS** (2 captures, 599f/7422l, identical identity sets). `ci-fast`, `ci-product`, `ci-security`,
`synthesize-merge-tree`, `pr-gate`, `candidate-protection` PASS. `ci-integration` **FAIL** on one stale assertion —
the `eb3-ci-required` positive control still pinned `workflows=10` after round 105 added the candidate-acceptance
workflow. Fixed in round 107 (derived expectation + literal tripwire at 11); see `README.md`.

## Attempt 2 — head `fc4bac62e` (all green)

| job | verdict |
| --- | --- |
| `synthesize-merge-tree` | success |
| `ci-fast` | success |
| `ci-product` | success |
| `ci-security` | success |
| `ci-integration` | **success** |
| `ci-census / census-runtime` | **success** — `EB3-LAYER layer=ci-census verdict=PASS` |
| `ci-required` | **success** (`ci-required-deferred` skipped by design on a non-mergeable PR) |
| `pr-gate` | success (incl. `pr-settlement-gate` for this head) |
| `candidate-protection` | success |

Runs: `ci-required` 45424962377 · `pr-gate` 45424962369 · `candidate-protection` 45424962349.

## What this does and does not mean

- The **Required CI set is fully green at a settled head** with the census executed, not skipped. That closes the
  "Required CI 尚未满足" bar of the previous review for this head.
- It does **not** merge, publish, deploy or lift the draft. The PR was converted back to DRAFT immediately after the
  set completed (`isDraft=true`, `state=OPEN`, `autoMergeRequest=null`, head `fc4bac62e`).
- It does **not** make any row PRODUCT-PROVEN: the candidate acceptance gate is still `knownNonRequired`, so a
  DEV-LIVE row stays DEV-LIVE until the owner decides to require that gate.

## Attempt 3 — head `a4a00fc81` (the settled head; all green, census executed)

Because attempt 2's evidence commit moved the head, the set was re-run at the settled head so that settlement,
census and Required CI all name one SHA.

| job | verdict |
| --- | --- |
| `synthesize-merge-tree` | success |
| `ci-fast` | success |
| `ci-product` | success |
| `ci-security` | success |
| `ci-integration` | **success** (the round-107 fix holds hosted) |
| `ci-census / census-runtime` | **success** — census executed, not skipped |
| `ci-required` | **success** |
| `pr-gate` | **success** (settlement gate for this head) |
| `candidate-protection` | **success** |

`ci-required` run 45429461306. Immediately afterwards the PR was converted back to **DRAFT**
(`isDraft=true`, `state=OPEN`, `autoMergeRequest=null`, head `a4a00fc81`). No merge, no auto-merge, no release, no
deploy; no force-push; port 3080 untouched.

Residual note: the superseded `ci-required`/`pr-gate` runs from the flip transition show `cancelled` — they were
superseded by the newer push, which is the normal GitHub concurrency behaviour, not a failed check.
