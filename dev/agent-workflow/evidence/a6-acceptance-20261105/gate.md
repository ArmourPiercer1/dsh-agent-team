# Gate record

## Final docs-inclusive HEAD

- HEAD: recorded after the rerun below (code merge `e63cfbdc9` + acceptance docs)
- Superseded green: `48182b783` + review-fix merge `e63cfbdc9` (before docs)
- Command: `CI=true DSH_CI_STORE_DIR="$PWD/.drill/pnpm-store" node scripts/ci-pr-gate.mjs --full`
- Pristine host: `tests/deepseek-harness-test-use` -> main checkout, `639ed015397290b3745d163aafe02ffee4aa3f84`
- Result: **see the run appended below** (the earlier 9/9 result on `48182b7`
  remains valid for the code tree before the review fixes)
- Census: **677 files / 8821 legs**, `COUNTS MOVED, SET DID NOT`, 0 new reds, 0 collection errors

Leg verdicts: graph-parse, kit-home-guard, state-freshness, install, blueprint-fence,
typecheck, lint-identities, artifacts-at-head, census — all `pass`.

## Disclosed flakes

The same two pre-existing 1 ms timing races (`alpha5-glob-backend` X3,
`alpha5-search-backend` P11, both `expected 'completed' to be 'cancelled'`) appear in
census captures across this tree. They pass standalone. The first full attempt at
`c26a9a00` was 8/9 for exactly those two; the immediate rerun was 9/9. The earlier
review-fix HEAD `e63cfbdc9` had the same flake pattern before this final HEAD. The
failures are recorded rather than hidden; no product assertion was changed.

## Test corpus

`pnpm vitest run packages/runtime/test` (with the pristine host symlink) on the reviewed
fix tree: **490 files / 6008 tests passed**. The final integrated tree is covered by the
census above.
