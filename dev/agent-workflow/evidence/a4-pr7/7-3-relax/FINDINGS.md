# A4-PR7 §7.3 Option A — findings, literal outputs, and the instruments that lied

Branch `feat/a4-73-grammar-version-agnostic`, base `27ef3afc`, 2 commits, not pushed.

## A. Battery, literal

```
$ node scripts/verify-blueprint-version-clean.mjs      # run twice, byte-identical
$ cmp RUN1 RUN2 && echo BYTE-IDENTICAL
BYTE-IDENTICAL
5119cbf3a76b7860af33f950b410cbe5  verify-clean-RUN1.txt
5119cbf3a76b7860af33f950b410cbe5  verify-clean-RUN2.txt
(exit 1 both runs — the dirty set is Task 7.4's, unchanged by this branch)
scanned-in-scope: 753 tracked files
RESULT dirty(7 files, 51 sites)
RESULT unknown(0 files, 0 sites)
RESULT advisory(8 files, 10 sites)
RESULT refused(52 files, 115 sites)
RESULT prose(5 files, 5 sites)
RESULT adjudicated(16 files, 24 sites)
RESULT verdict: dirty-or-unknown (see the OFFENDING/UNKNOWN lines)
```

PRISTINE control (same script, base `27ef3afc`, before any edit): `scanned-in-scope: 751`,
`dirty(7 files, 51 sites)`, `unknown(0,0)`, `advisory(8,10)`, `refused(52,115)`,
`prose(5,5)`, `adjudicated(16,24)` — every gating number reproduced at base, and every
gating number unchanged on this branch. Only `scanned-in-scope` moved, 751 -> 753 (+2:
the two twins, new tracked files inside the scan's `packages/**/test/` scope).

```
$ pnpm exec vitest run <the 52-file universe, PRISTINE base 27ef3afc>
   Test Files  52 passed (52)
        Tests  777 passed (777)
  vitest_exit=0

$ pnpm exec vitest run <the 54-file universe, THIS tree>
   Test Files  54 passed (54)
        Tests  798 passed (798)
  vitest_exit=0

$ pnpm exec vitest run <battery 3 + 4>
   ✓ packages/testkit/test/p4t6-session-event-scan.test.ts (10 tests) 5ms
   ✓ packages/testkit/test/a4p7-blueprint-version-clean.test.ts (60 tests) 1033ms
   ✓ packages/testkit/test/a4p75-composition-smoke-classification.test.ts (54 tests) 3069ms
  (merge-gate: 26 legs; 25 pass, 1 refuse — identical refusal at pristine base, see D)

$ node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
  lint-identities: universe: 1107 file(s) linted, 0 of them gitignored (ESLint does not read .gitignore, so the identity set is a function of these files, not of git status)
  baseline dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt: 76 distinct; new 0, resolved 0

$ pnpm -r run typecheck          # bailing      -> exit 0, 0 x error TS
$ pnpm -r --no-bail run typecheck # non-bailing  -> exit 0, 0 x error TS (this tree)
$ pnpm -r --no-bail run typecheck # non-bailing  -> exit 0, 0 x error TS (pristine tree)
  8 of 8 packages that declare a typecheck script reported Done.
  The plan sentence "exactly 5 errors" describes the FLIP under the bailing
  invocation; nothing in the plan pins the unflipped non-bailing count, and this
  branch does not narrow any type, so 0 -> 0 is the expected and observed result.
```

## B. Universe population, per file

Re-derived with the dossier's predicate verbatim (`grep -rl
"teamRequirements\|V2_DOCUMENT_VERSION\|schemaVersion: 2" packages --include=*.test.ts`,
minus node_modules/dist/__probe): **52 files at base, 54 here** — the delta is exactly the
two twins (`comm -23` output). `base_sum=777`, `mine_sum=798 = 777 + 13 + 8`, and **every
one of the 52 shared files reports an identical per-file test count on both trees**
("shared files with DIFFERENT counts: NONE").

| file | base | this tree |
| --- | --- | --- |
| `packages/client/test/ledger-adapter.test.ts` | 32 | 32 |
| `packages/client/test/pr56-control-subject-payload.test.ts` | 42 | 42 |
| `packages/contracts/test/leader-instance-record.test.ts` | 13 | 13 |
| `packages/contracts/test/negative.test.ts` | 21 | 21 |
| `packages/domain/test/a4p1-blueprint-v3-governance.test.ts` | 20 | 20 |
| `packages/domain/test/a4p7-v3-identity-binds-grammar.test.ts` | — | 13  **(NEW)** |
| `packages/domain/test/blueprint-v1-frozen-resume.test.ts` | 4 | 4 |
| `packages/domain/test/t2-blueprint-v2-hash.test.ts` | 8 | 8 |
| `packages/domain/test/t2-blueprint-v2-requirements.test.ts` | 16 | 16 |
| `packages/legacy/test/p7t6-teammates-adapter.test.ts` | 22 | 22 |
| `packages/legacy/test/p7t7-legacy-read.test.ts` | 28 | 28 |
| `packages/runtime/test/a2c3-inspect-operation-permission.test.ts` | 14 | 14 |
| `packages/runtime/test/a3p5-glue-permission-receipt.test.ts` | 11 | 11 |
| `packages/runtime/test/a4p6-governance-warning-host-adapter.test.ts` | 7 | 7 |
| `packages/runtime/test/a4p6-governance-warning-service.test.ts` | 16 | 16 |
| `packages/runtime/test/a4p7-ceiling-no-context-refusal.test.ts` | 12 | 12 |
| `packages/runtime/test/a4p7-v3-grammar-enforced.test.ts` | — | 8  **(NEW)** |
| `packages/runtime/test/artifact-read-authority.test.ts` | 34 | 34 |
| `packages/runtime/test/artifact-read-digest-fact.test.ts` | 14 | 14 |
| `packages/runtime/test/boundary-committed-applied.test.ts` | 3 | 3 |
| `packages/runtime/test/consent-scope-hash-binding.test.ts` | 19 | 19 |
| `packages/runtime/test/control-guard-leader.test.ts` | 13 | 13 |
| `packages/runtime/test/f15-mcp-live-loss.test.ts` | 10 | 10 |
| `packages/runtime/test/leader-disable-no-requirements-initial-work.test.ts` | 5 | 5 |
| `packages/runtime/test/leader-recovery-next-boundary-exit.test.ts` | 1 | 1 |
| `packages/runtime/test/leader-template-required-boundary.test.ts` | 7 | 7 |
| `packages/runtime/test/mcp-blueprint-initial-grant.test.ts` | 32 | 32 |
| `packages/runtime/test/mcp-target-materialization-unit.test.ts` | 5 | 5 |
| `packages/runtime/test/mcp-target-materialization.test.ts` | 16 | 16 |
| `packages/runtime/test/model-blueprint-initial-routing.test.ts` | 23 | 23 |
| `packages/runtime/test/model-inspect-config.test.ts` | 7 | 7 |
| `packages/runtime/test/multi-mcp-wiring.test.ts` | 49 | 49 |
| `packages/runtime/test/p8s3-work-chain.test.ts` | 12 | 12 |
| `packages/runtime/test/p8s4b-cell-provenance.test.ts` | 10 | 10 |
| `packages/runtime/test/p8s4b-mcp-facet.test.ts` | 25 | 25 |
| `packages/runtime/test/p8s4b-model-consumption.test.ts` | 17 | 17 |
| `packages/runtime/test/p8s6-pagination.test.ts` | 9 | 9 |
| `packages/runtime/test/p8s6-principal.test.ts` | 20 | 20 |
| `packages/runtime/test/p8s6-remote-commands.test.ts` | 8 | 8 |
| `packages/runtime/test/persona-kind-provider-preflight.test.ts` | 14 | 14 |
| `packages/runtime/test/prf-inspect-same-source.test.ts` | 8 | 8 |
| `packages/runtime/test/requirement-d1-d3-decision-scoping.test.ts` | 42 | 42 |
| `packages/runtime/test/restart-effective-policy.test.ts` | 2 | 2 |
| `packages/runtime/test/shell-result-observer.test.ts` | 14 | 14 |
| `packages/runtime/test/startup-all-templates-real-authority.test.ts` | 3 | 3 |
| `packages/runtime/test/startup-consent-production.test.ts` | 8 | 8 |
| `packages/runtime/test/startup-preflight-production-create.test.ts` | 6 | 6 |
| `packages/runtime/test/startup-template-disable-production.test.ts` | 8 | 8 |
| `packages/runtime/test/t12a-b3-external-deny.test.ts` | 4 | 4 |
| `packages/runtime/test/t12a-h1-nullable-mcp.test.ts` | 7 | 7 |
| `packages/runtime/test/t4a-capability-wiring.test.ts` | 28 | 28 |
| `packages/runtime/test/template-disable-no-requirements-gate.test.ts` | 5 | 5 |
| `packages/storage/test/p4-01-schema-meta.test.ts` | 11 | 11 |
| `packages/testkit/test/t6-9-negative-matrix.test.ts` | 12 | 12 |

## C. Mutation table

Restore is `git checkout HEAD -- <path>` BEFORE applying, always (`scripts/mutate.sh`) — the
fix for the decision record's failure #4.

| mutation | one-line change | files that went red (full 54-file universe) | titles |
| --- | --- | --- | --- |
| M1-gate | `scope-requirements.ts`: `{` -> `if (blueprint.schemaVersion === 2) {` | `a4p7-v3-grammar-enforced.test.ts` only | "the template scopes EXIST at v3 only for templates that declare requirements"; "the template-scope inputs carry the declared requirement ids" |
| M2-hashomit | `validate.ts:1571`: `!== undefined` -> `!== undefined && core.schemaVersion !== 3` | `a4p7-v3-identity-binds-grammar.test.ts` only | "a declared teamRequirements puts the key into the hashable projection"; "the hash changes when a requirement flips complete true -> false"; "the hash changes when a requirement subject changes"; "the hash changes when a requirement id changes" |
| GREEN after restore | all mutations reverted from git | — | 54 files / 798 tests, vitest_exit=0, 0 failing titles |

The failing-FILE set under each mutation was taken from `FAIL` lines across the whole
universe and is exactly one file both times. So M1's and M2's blast radius in the
pre-existing suite is **empty** — the twins are the only witnesses, which is precisely the
hole the dossier measured (0 of 562) and came to close.

Note the twins are plane-specific by design: M2 (identity plane) leaves the enforcement
twin green, and M1 (enforcement plane) leaves the identity twin green. A single combined
test would have hidden which plane broke; two twins name it.

## D. Instruments that lied to me

1. **`git diff origin/master` accused me of editing the coordinator's files.** It listed
   `dev/agent-workflow/SESSION_ROUTER_LOG.md` and `graph.yaml` among "my" changes. I never
   touched them: `origin/master` moved to `b678db5b` (PR #160) mid-session, so the diff was
   the *inverse* of the coordinator's own commit — 12 insertions that my branch correctly
   lacks. Caught by (a) `git merge-base HEAD origin/master` = `27ef3afc`, (b) diffing against
   that real base, which lists my 9 files and no forbidden path, and (c) `git log
   HEAD..origin/master`, which names #160. Same failure the decision record logged as its #3,
   now reproduced for real. Consequence for the merge: my branch is a clean ancestor of
   current `origin/master` (`git merge-base --is-ancestor` passes); it just does not contain
   #160's log/graph lines.

2. **The version-clean scan flagged my own new test, and only after I staged it.** The scan
   reads `git ls-files`, so an untracked file is invisible to it: my first run said a clean
   `dirty(7,51)` with the v1 fixture still in the file. `git add`ing the twins flipped it to
   `scanned-in-scope: 753 / dirty(8 files, 52 sites)` with
   `OFFENDING packages/runtime/test/a4p7-v3-grammar-enforced.test.ts :: L187=v1`. The v1
   control leg was my own addition, not part of the dossier's spec, and it moved a §7.4-tracked
   number. I removed the two legs and recorded why in the file rather than laundering the
   literal past the predicate (a concatenated `'schemaVersion' + ': 1'` is exactly the
   mechanism the scan's own `advisory` caveat names). Re-checked after staging: gating numbers
   back to 7/51. **A scan that only sees tracked files will bless any fixture you have not yet
   added — run it after `git add`, not before.**

3. **My own enforcement twin had a type-erased bug that only the batch run showed.** I passed
   the YAML *string* `WITHOUT` to a helper typed for `TeamBlueprint`; `compatibilityRequirementsOf`
   threw `blueprint.requirements is not iterable`. Caught because I ran the file and read the
   output instead of trusting the draft. It also taught the useful lesson below (4).

4. **My commit message was stale relative to my own edit.** After deleting the v1 legs for
   reason (2) the enforcement twin had 8 tests, not the 10 in the message I had just written.
   The universe total (798, where I expected 800) is what exposed it: 777 + 13 + 10 = 800 did
   not match the observed 798, and the per-file table localised the 2-test gap to my own file.
   Commit amended to the measured numbers. **The universe total was the instrument that caught
   me** — a raw pass/fail would have said nothing.

5. **`mutate.sh`'s `set -u` left a mutation applied.** `revert` took no second argument, so
   `WHICH="$2"` aborted the script *before* its restore step, and the M2 hash-omit stayed in
   `validate.ts` while the script printed nothing. Caught by `git status --porcelain` + a
   `grep` for the mutated line before starting M1, not by the script's exit code. Fixed by
   defaulting `$2`, and the incident is why `apply` also restores first.

6. **The merge-gate's composition-smoke leg refuses, and it is not mine.** It reads `refused`
   because `packages/client/dist` does not exist — no `pnpm build` has run in this worktree.
   Run on the pristine base tree it fails the *same single leg* (`25 passed | 1 failed (26)`),
   so the count (26) and the failure are both base-equal. I did not run `pnpm build`: it is
   outside this brief's scoped battery, and emitting `dist/` would perturb the p4t6 scan
   population that this branch's own pin depends on.

7. **Two numbers carried in prose did not survive contact with the tree.** The dossier's "typecheck:
   exit 0, 9 projects green" — 8 packages declare a `typecheck` script and 8 reported `Done`;
   `packages/legacy` has none. And the dossier's "7 files, 7 lines (2 flip + 5 gates)" reads,
   under this brief's counting, as if a 7th relaxation site existed; it does not (README §1).
   Neither changes the decision; both are why every number in this evidence was re-measured.

## E. Known debt encountered, by identity

`packages/runtime/admission/requirement-gate.ts:62` `'classifyScope' is defined but never
used` — present at base (same rule, same line, same file) and present in the lint baseline
(line 51, `error @typescript-eslint/no-unused-vars packages/runtime/admission/requirement-gate.ts`).
Not introduced here: the identity diff reports `new 0, resolved 0`.

Universe debt: **none observed**, at base or on this branch — 777/777 and 798/798 with exit 0.
The base-debt list the brief carried (`t1-capability-schema` x9, `t2-blueprint-hash`,
`d3-member-identity-context`, `p6t3-restart` x2, `p8s3b-result-effects`, `p6t1-parallel`) did
not recur in this run: every one of those files is outside the 52-file universe predicate, so
this population has no reds to attribute and **no identity is unaccounted for**. They remain
open in the tree; this branch neither fixes nor worsens them, and I did not run the root suite
to re-measure them (out of scope, and the root `pnpm test` is forbidden here).
