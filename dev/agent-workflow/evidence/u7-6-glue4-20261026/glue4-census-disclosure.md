# U7-6 census disclosure — the p4t6 `.tmp-fault` scratch race (pre-existing, untouched by this PR)

## Observations (root vitest 626f / 7949l, three census captures + isolated runs)

| capture | new-red identities vs baseline | reading |
| --- | --- | --- |
| standalone `pnpm run test` (pre-commit) | p4t6 ABSENT; 10 reds = 9 baseline + a4p7 install-surface (transient: dist rebuilt, not yet committed — green at f7ddd48bd, gate leg `artifacts-at-head` pass, drift 0) | this PR adds NO new red under the root suite |
| census capture #2 (quiet tree, scratch cleared first) | `a5p4-lane-hygiene::self-typechecks` + `rc2-sanitize-evidence::S13` — both `STACK_TRACE_ERROR` timeouts | clock legs crossing vitest's 5000 ms default under census parallelism (the FINDINGS-named load class) |
| census capture #3 (quiet, `--only census`) | `p4t6::coverage` with `expected 1279 to be 1277` | the scan universe carried +2 files DURING the capture |

## The p4t6 mechanism (proven, not assumed)

* This PR adds ZERO new scannable files under `packages/**` — `git diff --name-status
  496a3980f..HEAD -- packages` is seven `M` lines plus dist mirrors (outside the scan).
  The booked total therefore stays 1277; the 1279 is universe inflation, not a booking miss.
* The +2 files are copies under `packages/testkit/test/.tmp-fault/a4-artifacts-nonempty/
  one-matching-file/packages/**` — fixture trees written DURING the same capture by the
  a4 artifact-scan tests (`scanSessionEventVocabulary` walks the live filesystem; the
  scratch dir is gitignored but real).
* Direct proof of the class: clear the scratch (`rm -rf packages/testkit/test/.tmp-fault`)
  → p4t6 10/10 PASS, twice (1277 == 1277).
* The race is pre-existing: the a4-pr7 lane's own records name it —
  `dev/agent-workflow/evidence/a4-pr7/ci-gate/FINDINGS.md` F8 (clock legs) and the
  `.gitignore` comment "the documented clear-the-scratch-residue remedy (dev/agent-workflow
  evidence, `.tmp-fault` flake class)"; the U6-PR5 lane recorded the same pattern
  (`census-attempt1-4newreds.log.txt` → `census-final-pass.log.txt`).

## Why this PR does NOT touch p4t6 or the scanner

Absorbing scratch copies into the pinned count would make the pin wrong for every clean
capture (the census recreates the scratch mid-run; ordering decides). The fix, when it is
done, belongs to the scan lane (exclude `.tmp-fault/` inside the scan, or pre-clean in a
global setup) — named here, not silently patched from a search-assurance PR.

## Local verdict ledger (for the PR body)

graph-parse PASS · state-freshness PASS · install SKIP (named: sandbox pnpm store index is
read-only in this environment — CI runners do a real frozen install) · blueprint-fence PASS ·
typecheck PASS · lint-identities PASS (new 0) · artifacts-at-head PASS (drift 0, 1799 files) ·
census: identity set = 9 baseline reds + only the documented scratch/clock legs named above;
zero red introduced by this change (standalone root suite proof line above).
