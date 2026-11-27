# Round 107 — the new workflow's count tripwire (hosted `ci-integration` red), and the census run

## What turned red and why

The owner-approved ready flip triggered the full hosted set. `ci-census` **passed** (the draft skip was the only
previous bar). `ci-integration` went red on exactly one assertion:

```
✖ eb3-ci-required: the unmodified tree passes from the real CLI (positive control)
  AssertionError: expected 'EB3-CI-REQUIRED pass workflows=11 findings=0' to match /workflows=10/
```

Round 105 added `.github/workflows/candidate-acceptance.yml` and classified it in `dev/ci/eb3-ci-manifest.json`
(`knownNonRequired`, with its reason). The workflow population became 11, but the positive control still pinned the
literal `workflows=10`. The CLI was right; the test's pin was stale.

## The fix (not a relaxed assertion)

`scripts/eb3-ci-required.test.mjs` now derives the expected count from the tree's real workflow population
(`workflowFiles().size`) and keeps a **deliberate literal tripwire at 11**:

```js
const expected = workflowFiles().size
assert.equal(expected, 11, 'workflow population changed: classify the new workflow in dev/ci/eb3-ci-manifest.json')
assert.match(r.stdout, new RegExp(`EB3-CI-REQUIRED pass workflows=${String(expected)} findings=0`))
```

The test is strictly stronger than before: the CLI must grade exactly the files the test reads, and adding a workflow
now forces the classification review instead of silently failing on a number.

## Hosted census at `646f353ea1cb993f0c76fe7c99e40e7009bab7ec` (the owner-approved ready flip)

| job | verdict |
| --- | --- |
| `ci-census / census-runtime` | **PASS** (`EB3-LAYER layer=ci-census verdict=PASS`), 2 captures, 599f/7422l, identical identity sets |
| `ci-fast`, `ci-product`, `ci-security`, `synthesize-merge-tree` | PASS |
| `ci-integration` | FAIL — the stale-count assertion above (fixed here) |
| `ci-required` | FAIL — only because of `ci-integration` |
| `pr-gate`, `candidate-protection` | PASS |

The census artifact is scratch and lives outside the tree; the comparison JSON is kept in
`dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/`.

## Local gates at this head

```
DSH-TEST-DISPATCH ute-vnext-a1 exit=0 set=sha256:edd4f1c4…    (251/248 pass/0 fail/3 skip)
DSH-TEST-CATALOG tests=785 refused=0 findings=0
UTE-CUT-CLOSURE pass cut(0/148)   UTE-P0-ASSETS pass cut(148/148)
docs-sync findings=0 blocking=0   place-dist-glue 35 placements
EB3-CI-REQUIRED pass workflows=11 findings=0
EB3-RUN-MANIFEST pass records=546 strict=174 incomplete=11 findings=0
DSH-CI-VERDICT pass pass=10 fail=0 legs=10 seconds=309.9
```
