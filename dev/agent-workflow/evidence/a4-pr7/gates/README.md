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
