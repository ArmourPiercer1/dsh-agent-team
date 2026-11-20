# UTE-0 rev2 evidence — the retirement gate as a licence checker

Task: `task/ute0-rev2-20261120`, based on `origin/master` `06de9751a`.
Scope: `scripts/ute-retirement-gate.mjs`, `scripts/ute-retirement-gate.test.mjs`,
`scripts/eb3-family-definitions.mjs`, `scripts/eb3-ci-negative-controls.mjs`,
`scripts/fixtures/ute-retirement-selftest/**`, and one refusal-code row in
`docs/plans/memo/ute-g1-20261120/RETIREMENT.md` §5.2.

Every transcript below is piped command output, not edited prose. The only
appended line is `exit=<n>` in `gate-refusal.txt`, produced by the same shell
invocation.

| file | what it is | command that produced it |
|---|---|---|
| `gate-refusal.txt` | The honest state of the committed ledger: `fs` is refused for unit coverage (`read_image` has no baseline vector, nothing to reproduce, no per-member control) and for two unapproved retirement-blocking semantic differences. Exit code is recorded on the last line. | `{ node scripts/ute-retirement-gate.mjs --all; echo "exit=$?"; } > gate-refusal.txt 2>&1` |
| `gate-fs-json.json` | The same refusal in the machine schema `ute-retirement-verdict/1`, including the census-derived `unit` (4 members), per-term `coverage` sets, and the additive `verdicts` view. Exit 1. | `node scripts/ute-retirement-gate.mjs --family fs --json > gate-fs-json.json 2>&1` |
| `mutants.txt` | The full `node --test` run for the gate: all positive/negative controls, the `UTE-MUTATION` control transcript lines, 14 real module mutations (`UTE-MUTANT … control=RED`, each removing one new rule from a copy of the module), and the final `UTE-RETIREMENT-GATE-MUTANTS total=14 red=14`. | `node --test scripts/ute-retirement-gate.test.mjs > mutants.txt 2>&1` |
| `negatives.txt` | The EB3 required-CI negative-control suite, now 35/35: C3 keeps its four Definition-replacement arms and the two new UTE-4 deletion arms `C3b retirement-deletion-unlicensed` (deleting `packages/tools/families/fs.mjs` while `fs` is not allowed → exactly `DEF_RETIREMENT_UNLICENSED`) and `C3c retirement-deletion-licensed` (the same class of deletion for an allowed fixture row → no such finding). | `node scripts/eb3-ci-negative-controls.mjs > negatives.txt 2>&1` |
| `family-definitions.txt` | The required `ci-fast` leg itself on the current tree: passes with zero findings, so the new deletion hook does not break the honest tree. | `node scripts/eb3-family-definitions.mjs > family-definitions.txt 2>&1` |

Additional offline check run for this change (not stored here):
`node scripts/docs-sync.mjs --check` → `docs:sync --check: … findings=0 blocking=0`, exit 0.

UNKNOWN / not claimed: the gate is a retirement evidence and licence checker,
not an independent authorisation service (RETIREMENT.md §3). It does not prove
the named approver is entitled to approve; that remains the protected branch,
PR review and CI record the reference points at.
