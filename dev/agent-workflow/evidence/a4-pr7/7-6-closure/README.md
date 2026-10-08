# §7.6 closure lane — what is in here

Evidence-only lane for plan §7.6 (code-merge gate), base `master @ 0e7004b6`, branch
`feat/a4-76-closure`. No production source, no `package.json`, no
`packages/testkit/test/a4p7-merge-gate.test.ts` was touched.

| file | what it answers |
| --- | --- |
| [`SCENARIOS.md`](SCENARIOS.md) | **the deliverable**: every scenario §7.6 names, mapped to the registered `describe > test` identities that actually assert it (read in the body, not by file name), with COVERED / PARTIAL / ABSENT and the searches that came up empty. 19 rows: 16 COVERED, 3 PARTIAL, 0 ABSENT. |
| [`ROOT-CENSUS.md`](ROOT-CENSUS.md) | the nine-root census on the final tree in the published form, the identity-set diff against `population-baseline/nine-root-2162f6a7.md`, the escalation check, the named load flake, and **what each test command actually loads** (root vs client lane vs `-r`). |
| [`FINAL-BATTERY.txt`](FINAL-BATTERY.txt) | the gate legs, each with its verdict, artifact pointer and state dependence. |
| [`FINDINGS.md`](FINDINGS.md) | F1–F8: the gate-claim gaps (one named file for nineteen obligations; three missing legs) and the measurement-process traps this lane hit, so the next lane does not pay for them twice. |
| [`transcripts/`](transcripts/) | every capture as it ran, including the quarantined overlapped attempt and the discarded `run test --` client invocation. |
| [`scratch/`](scratch/) | inputs and re-checkers: the 6277-leg registry (`registered-legs-before.tsv`), identity sets (`root-ids-*.txt`, `baseline-2162f6a7.ids.txt`), client name sets, vitest JSON reports, and the scripts that reproduce each number (`check-scenarios.mjs`, `client-names.mjs`, `client-diff.mjs`, `record-p4t6.sh`, `scan-list.mjs`, `final-census.sh`, `q.py`). |

Read order for a merge decision: **SCENARIOS.md → ROOT-CENSUS.md → FINAL-BATTERY.txt → FINDINGS.md**.
