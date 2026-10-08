# A4-PR7 §7.6 gap lane — the three legs the closure proved do not exist

**Lane:** sole writer of one implementation lane, A4-PR7 (Alpha.4 hard governance), plan
[`alpha4-implementation-plan.md`](../../../../docs/plans/active/alpha4-permission-governance/alpha4-implementation-plan.md)
§7.6 · **branch:** `feat/a4-76-scenario-gaps` (**handed back unmerged, unpushed**) ·
**base:** `master @ 16022365` · **worktree:** `.worktrees/a4-76-scenario-gaps`.

[`../7-6-closure/SCENARIOS.md`](../7-6-closure/SCENARIOS.md) walked every §21 scenario row against
the nine-root registry and proved that three rows have **no leg anywhere in the tree**. This lane
writes exactly those three legs — nothing else in `packages/**`, and no production source. Each
leg asserts a law the ADR/spec **already states**, so the assertion is derived from the documents
(quoted verbatim in the leg's own header), never from observed behaviour.

| Row | The gap, in the closure's words | The leg | Legs | `expect(` |
| --- | --- | --- | --- | --- |
| 5 | the two literal §21.3 rows — *"applies to a descendant created **after** startup"* and *"**no** startup-time descendant enumeration"* — *"have no leg that performs the creation or asserts the absence"* | [`packages/runtime/test/a4p7-live-descendant-authority.test.ts`](../../../../packages/runtime/test/a4p7-live-descendant-authority.test.ts) | 3 | 42 |
| 6 | root identity drift → `mutation-stale` is pinned; the **complement** (*"same root + changed descendants → the proposal remains valid"*) *"had none"* | [`packages/runtime/test/a4p7-descendant-change-proposal-valid.test.ts`](../../../../packages/runtime/test/a4p7-descendant-change-proposal-valid.test.ts) | 2 | 22 |
| 17 | *"§21.10's other entries have restart legs; the governance-warning family has no restart leg."* | [`packages/runtime/test/a4p7-governance-warning-restart-reconstruction.test.ts`](../../../../packages/runtime/test/a4p7-governance-warning-restart-reconstruction.test.ts) | 3 | 47 |

**All three are green on the shipped product, and every one reddens under a construction-level
counterfactual mutant** installed in the product and then restored hash-verified. That is the point
of the lane: green that nobody tested against the forbidden implementation is not evidence.
**No product defect surfaced** — the three laws are honoured — but four findings about the
**evidence** are, and the first of them is a shipped 144-leg suite that cannot see a restart at all.

## Read in this order

| File | What it settles |
| --- | --- |
| [`FINDINGS.md`](FINDINGS.md) | **Verdict first**: no product defect on these three laws; the four findings (the PR6 family's blind spot, the restart-leg trap, the non-surgical mutant, the un-assertable-as-written prohibition), plus what is explicitly *not* a finding. |
| [`LEGS.md`](LEGS.md) | The three legs by `describe > test` identity, each against the verbatim document line it derives from; what Row 5 leg 2 **cannot** assert and what it asserts instead; what is real vs harness-owned in each world. |
| [`ROOT-CENSUS.md`](ROOT-CENSUS.md) | Nine-root census on the final tree, captured twice strictly sequentially, with the **identity-set** diff against the published baseline (NEW 0 / RESOLVED 0), the escalation check, and the named load flake. |
| [`FINAL-BATTERY.txt`](FINAL-BATTERY.txt) | The whole instrument battery in one file: three legs, both mutants' verdicts, the census, the merge gate at 29/29, typecheck, lint-identity diff, artifact/blueprint gates, and the `expect(` base→tip accounting proving no existing file lost an assertion. |
| [`transcripts/`](transcripts/) | The raw transcripts: [`mutant-row5-census-and-memo.txt`](transcripts/mutant-row5-census-and-memo.txt) (482 lines, two mutants), [`mutant-row6-descendant-census.txt`](transcripts/mutant-row6-descendant-census.txt), [`mutant-row17-acknowledgement-lives-in-the-heap.txt`](transcripts/mutant-row17-acknowledgement-lives-in-the-heap.txt), and the base-hash records. |
| [`scratch/`](scratch/) | Reproduction: the three mutant runners with their literal block files, the census driver, and every raw capture (`captures/*.txt`, `*.json`). Nothing here is a mutant — the mutated files were restored before commit, and the runners restore by byte-exact backup. |

## Discipline this lane was held to, and where the proof is

| Rule | Where it is discharged |
| --- | --- |
| Mandatory reading first (AGENTS.md): `docs/ROUTER_RULES.md` §0, plan §7.6 + ADR/spec authority, `docs/TEST_METHODS.md`, then `7-6-closure/{SCENARIOS,FINDINGS,README}.md` in full. | Done before any write; the closure's finding ids are cited in each leg header. |
| Fresh-worktree prerequisite (F5): `pnpm install --store-dir …` then `pnpm setup` **before** any census, because `packages/client/dist` is gitignored. | [`scratch/pnpm-install.log`](scratch/pnpm-install.log), [`scratch/pnpm-setup.log`](scratch/pnpm-setup.log) (both exit 0). |
| A red caused by the product not honouring the law is a **finding**, not something to assert away. | No such red occurred; the two reds that did occur were harness errors of mine and are named in `FINDINGS.md`. |
| Green on first honest write ⇒ prove non-vacuity with a **construction-level mutant**, restore hash-verified, never commit a mutant. | Three transcripts, base/mutated/restored SHA-256 per mutated file, `git status --porcelain` empty for the mutated paths. |
| Nine roots by name, captured **twice, strictly sequentially**, compared as **identity sets**, never counts. | [`ROOT-CENSUS.md`](ROOT-CENSUS.md), [`scratch/final-census.sh`](scratch/final-census.sh). |
| Absence claims need a registry query or a scoped grep that names its root. | Row 5 leg 3 walks four named directories; the family survey in `FINDINGS.md` §1 names the six files it checked; the module-level-state grep in §2 names its root and its exclusions. |
| No existing assertion may be weakened; `p4t6` extends by a **named list** with its own measured tie; the merge gate is untouched and must read 29/29. | `expect(` counts base→tip in `FINAL-BATTERY.txt`; `SCANNED_PATHS_A476GAPS` + `1039 - 1036` tie with the PRE-EXTEND RED captured; merge gate untouched. |
| Hand back **unmerged**, no push. | Branch tip recorded in `FINAL-BATTERY.txt` (a file cannot carry its own SHA, so the tip is recorded in the closure's established form). |
