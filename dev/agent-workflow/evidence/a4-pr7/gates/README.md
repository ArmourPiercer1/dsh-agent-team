# A4-PR7 raw gate captures

Unedited stdout of the commands whose numbers are quoted in the lane notes
(`../7-LANE-REPORT.md`, `../7-2-START-ENTRANCE-ENUMERATION.md`,
`../7-3-BLAST-RADIUS-AND-UNEXECUTED-FLIP.md`, `../7-6-ACCEPTANCE-RECEIPTS-PARTIAL.md`).
They live here rather than only in `.scratch/gates/` because `docs/ROUTER_RULES.md`
§1 forbids citing a number that is not durable, and `.scratch/**` is gitignored: a
receipt nobody can read after the session is a claim, not evidence.

Nothing here is curated. Each is the command's own bytes, including its failures.

## Which capture answers which claim

| file | the claim it supports |
| --- | --- |
| `base-run1.txt` | the whole-repo BASELINE failure identity set (9 files / 19 tests at `c7537872`-era base) that every "identity-identical to baseline" statement is diffed against. |
| `7-6-base-c1-repro.txt` | **base passes `c1-list-pending-control` (15/15)** under the identical command with `.tmp-fault` cleared — the half of the blocker record that proves the regression was introduced, not inherited. |
| `7-6-bisect-c1.txt` | the bisect that names `e68d2c74` as the first bad commit. |
| `7-6-head-c1-full.txt` | the real HEAD failure (`authority-scope-required` from `requestApprovalLeg`), i.e. the error the `team_domain already exists` residue was hiding. |
| `7-6-c1-after-fix.txt` | the same file at 15/15 after the fixture carries its `C1_AUTHORITY_SCOPE`. |
| `7-6-c1-siblings.txt` | the systemic sweep: the 10 unswept `operationFingerprint`-without-`authorityScope` candidates plus all of `packages/tools` — 21 passed, 1 failed, that one being `p6t6-actions` from the baseline set. |
| `7-6-full-test.txt` / `7-6-full-test-2.txt` | whole-repo runs before and after the fix; only `-2` is the post-fix acceptance receipt (9 failed files / 19 failed tests, identities = baseline). |
| `7-6-runtime-tools-2.txt` | the `packages/runtime` + `packages/tools` leg (7/9 = baseline subset identity-matched). |
| `7-6-lint-diff*.txt`, `7-6-lint-identities*.txt` | the lint identity diff against `lint-identities-0237d487.txt`: the first run reported `new 2` (both authored by this lane), the re-runs `new 0, resolved 0` at 76 distinct. |
| `7-6-typecheck*.txt` | `pnpm -r run typecheck`: 8/8 `typecheck: Done`, 0 `error TS`. |
| `7-2-*`, `7-1-*`, `7-0-*` | round-1 receipts: the 7.0 RED/production and mutation proofs, the 7.1 mutation proofs, the 7.2 runtime baseline (`7-2-runtime-full.txt`) and post-7.2 parity (`7-2-final-runtime.txt`), plus the p4t6 pin and root runs. |
| `7-3-*` | the flip was NOT executed; these are its measurements — the dry-run typecheck delta (5 `=== 2` errors), the dry-run test fallout, and the blast-radius path sets (`7-3-setA-v12-literal.txt` = every blueprint-shaped v1/v2 literal, `setB-red-refined` = the parser-calling files that go red, `setB2-noparse-refined` = the files that stay green while lying, `setC-envelope-aliases` = the A1-18 alias sites). |
| `7-5-scan-run.txt`, `7-5-offending-paths.txt` | the v3-only fence's own output (exit 1, `RESULT dirty(20 files, 49 sites)`, 114 files in scope) and the offending path set its deferral list enforces in both directions. |
| `run-7-0.sh` | the 7.0 gate driver, kept so the round is reproducible rather than reconstructed. |

## Round 3 (`r3-*`) — the seven fixes on `feat/a4-pr7-r4-fixes`, off `689b716c`

| file | the claim it supports |
| --- | --- |
| `run-r3-gates.sh` | the round-3 gate driver, same shape as `run-7-0.sh`, kept so the round is reproducible. |
| `r3-typecheck.txt` | `pnpm -r run typecheck` at `bbad57aa`: 8 × `Done`, 0 `error TS`. |
| `r3-full-test-run1.txt`, `r3-full-test-run2.txt`, `r3-final-runA.txt`, `r3-final-runB.txt` | four whole-repo runs: 19 / 21 / 19 / 19 failing tests. `r3-run1-failing-identities.txt` and `r3-run2-failing-identities.txt` are the sorted `FAIL` identity sets; their only difference is the two `p6t1-parallel` P1 tests, and the 19-set is identity-identical to `base-run1.txt`. |
| `r3-p6t1-flake-measurement.txt` | the refutation of §8's barrel rule: `p6t1-parallel` alone goes red 2 of 3 runs with no other lane file loaded; the same file is 3-of-3 green *together with* both `a4p7` lanes. |
| `r3-mutation-callsite-drop.txt` | the fix-2 wiring proof: deleting the threaded field **at the call site** (type kept) reddens S1/S2/S4 and leaves all 75 pre-existing tests green. |
| `r3-mutation-required-key-typecheck.txt` | with the key required (`7d047dcb`), the same deletion is a `TS2345` compile error. |
| `r3-mutation-M2-wrong-field.txt` | threading a real-but-wrong durable field (`authorityScope.matcher.resource`) **compiles clean** and reproduces the original fail-open `{"allowed":true}` — the mutant a type-only review cannot catch. |
| `r3-mutation-M1-neuter-meet.txt` | the reviewer's M1 (meet neutered at both sites, set still derived and evaluated) now reddens 7 of this branch's tests in the whole runtime package: 15 failed / 3859 passed, other 8 = baseline. Header records the exact substitution and why `if (false)` was unusable. |
| `r3-p4t6.txt`, `r3-a4pr0a-hygiene.txt`, `r3-client.txt`, `r3-lint-diff.txt`, `r3-lint-identities.txt` | p4t6 pin 10 passed from the repo root; a4pr0a + lane hygiene 35 passed; client lane 3 failed / 876 passed (baseline set, `packages/client` untouched by this branch); lint identities 160 lines / 76 distinct, `new 0, resolved 0`. |
| `r3-build.txt`, `r3-build-composition.txt`, `r3-check-artifacts.txt` | `pnpm build` exit 0; `build:composition` and `check:artifacts` exit 1 on 51 drifted dist files. |
| `r3-dist-drift-at-base.txt` | the drift is inherited: measured at `689b716c` (source exports `operationApprovalCandidatePoints`, committed dist does not contain it), with the 36-inherited / 15-mine split and the last commit to touch that dist file (`a1b2431b`, A4-PR4). |
