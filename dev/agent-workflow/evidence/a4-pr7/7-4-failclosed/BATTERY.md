# The full battery, as run on this branch (literal outputs, nothing re-derived in prose)

Tip at measurement: after `020ce875` (runtime dist), the client-bundle artifacts commit, and
the two test/instrument commits; base merges `258d2b48` and `2162f6a7`.

## Fence — `node scripts/verify-blueprint-version-clean.mjs`, run after `git add`, three passes

`fence-1.txt`, `fence-2.txt`, `fence-3-postadd.txt` are **byte-identical** (`diff` empty), and
the tuples match master's exactly:

    RESULT dirty(6 files, 15 sites)
    RESULT unknown(0 files, 0 sites)
    RESULT advisory(6 files, 8 sites)
    RESULT refused(52 files, 115 sites)
    RESULT prose(5 files, 5 sites)
    RESULT adjudicated(16 files, 24 sites)
    RESULT verdict: dirty-or-unknown (see the OFFENDING/UNKNOWN lines)

Exit 1 is the state of the line, not of this branch: the tuples are master's tuples. The third
pass was taken after staging this directory specifically to test whether the lane's own prose
(v2/v3 appear in it constantly) moved a tuple — it did not.

## Merge gate — `packages/testkit/test/a4p7-merge-gate.test.ts`

**`Tests 29 passed (29)`** (`merge-gate-final.log`). Legs that carry weight for this lane:

* `the commit carries its own build, judged in a scratch worktree …` — green. It was RED twice
  before that: `verdict=stale drift=10` (I had run `pnpm -r run build` but not
  `pnpm build:composition`) and then `verdict=stale drift=1` on
  `packages/client/composition-shim/client-bundle.js`. Both readings taken from the
  `DSH-ARTIFACT-VERDICT …` token; controls `258d2b48 → ok drift=0`, `2162f6a7 → ok drift=0`
  (`artifact-provenance.log`) prove the drift was this lane's.
* `lint closes as an identity diff against the named baseline, not against a count` — green.
* `the client lane runs, and no failure appears outside the disclosed baseline` — green
  (the disclosed client-side skip is the suite's own, not this lane's).

## Named suites (leg counts, all green on this tip)

| suite | legs |
| --- | --- |
| `a4p7-ceiling-no-port-refusal` (new, this lane) | 6 passed |
| `a4p7-ceiling-refusal-wire` (new, this lane) | 5 passed |
| `a4p7-ceiling-port-assembly-pin` (PIN-3 inverted, PIN-5 strengthened) | 6 passed |
| `a4p7-ceiling-no-context-refusal` (the reader-abstention law, incl. leg 5) | 12 passed |
| `a4p7-carrier-width-under-ceiling` (prerequisite 2) | 8 passed |
| `a4p7-merge-gate` | 29 passed |
| `p4t6-session-event-scan` | 10 passed |

## Population census and the red-identity diff

Whole tree, `--reporter=json`, identities per `measurements.md`:

| run | files | registered legs | titled reds | collection-error files |
| --- | --- | --- | --- | --- |
| base side (this branch, both production edits backed out) | 502 | 6273 | 34 | 3 |
| landed side (same run pair) | 502 | 6273 | 78 | 3 |
| **final tip** (`final-census.log`) | 502 | 6273 | **73** | 3 |

Identity diff base→landed: **54 green→red, 10 red→green** (`pm-newreds.txt`,
`pm-resolved.txt`). Registration delta 0; the collection-error set is the same three files on
every side (`p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports`), so
nothing "resolved" into a collection death and nothing died into one.

Composition of the 73 reds at the final tip, by file (`final-reds.txt`):

| file | reds | whose |
| --- | --- | --- |
| `a3p4-permission-lifecycle-e2e` | 16 | this lane's bill |
| `a3p3-permission-mutation-authority` | 13 | this lane's bill |
| `a3p3-revoke-reveal-semantics` | 12 | this lane's bill |
| `a3p4-pr7-entry-exec-contract-regression` | 11 | this lane's bill |
| `a3p4-pr4-production-entry-regression` | 2 | this lane's bill (both root-direct) |
| `t1-capability-schema` | 9 | pre-existing — identical on the base side |
| `p6t3-mediation` | 5 | pre-existing — identical on the base side |
| `p6t3-restart` | 2 | pre-existing — identical on the base side |
| `p6t6-actions` | 1 | pre-existing — identical on the base side |
| `d3-member-identity-context` | 1 | pre-existing — identical on the base side |
| `t2-blueprint-hash` | 1 | pre-existing — identical on the base side |

54 + 19 = 73. The 19 fail with this lane's production edits backed out, so none of them is
attributable to it; `p6t1-parallel` (the disclosed load flake) was green in this particular
run and red in two earlier ones, which is why it is named rather than counted.

## Typecheck — both invocations, literally

    pnpm -r run typecheck                → exit 0, `error TS` count 0
    pnpm -r run typecheck --no-bail      → exit 1, `error TS` count 4   (all four: TS5023
                                            "Unknown compiler option '--no-bail'" — the flag
                                            reached tsc; the invocation, not the tree)
    pnpm --no-bail -r run typecheck      → exit 0, `error TS` count 0, 8 "typecheck: Done"

## Lint — `scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt`

    lint-identities: 160 identity lines, 76 distinct (target .)
    lint-identities: universe: 1114 file(s) linted, 0 of them gitignored
    baseline …: 76 distinct; new 0, resolved 0

Universe arithmetic, stated instead of asserted: 1109 (the figure circulated for a clean tree)
+ 3 files PR #179 added (`scripts/check-artifacts-at-head.mjs`,
`scripts/artifact-check-scratch.mjs`, `scripts/artifact-check-scratch.d.mts`) + 2 files this
lane adds = **1114**, which is what the run prints. The tracked-lintable delta of this branch
against `2162f6a7` is exactly +2 (`git ls-tree` 2021 → 2023).

## p4t6 referee

    node -e "import('./packages/testkit/fault-injection/session-event-scan.mjs').then(m=>console.log(m.scanSessionEventVocabulary({}).filesScanned)))"
    → p4t6 referee filesScanned = 1035

1033 at the merged base, 1035 with this lane's two instruments. The suite's total stays
derived (`983 + Σ named lists`), and this lane's tie is `len(SCANNED_PATHS_A474FAILCLOSED)
= 2 = 1035 - 1033`, with the pre-extend red captured in `p4t6-PRE-EXTEND-RED.txt`.

## Bite proofs (mutate → red → restore → verify by BLOB)

| mutation | legs that went red | restored blob verified |
| --- | --- | --- |
| `service.ts` ← `258d2b48` (change backed out) | N1, N3, N4, W2, PIN-3, PIN-5 (6 of 17) | `8c5cce23…` = committed blob, `git status` clean for the path |
| `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT` deleted from `REMOTE_BACKING_ERROR_CODES` | W1, W2, W3 (3 of 5), literal `Received: "internal-error"` | `11d0fd8d…` = committed blob |
