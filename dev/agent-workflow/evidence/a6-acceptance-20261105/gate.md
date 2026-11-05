# Gate record

## Final integrated HEAD

- HEAD: `48182b783554df08e40219c4079f0a0bb1d27075`
- Command: `CI=true DSH_CI_STORE_DIR="$PWD/.drill/pnpm-store" node scripts/ci-pr-gate.mjs --full`
- Pristine host: `tests/deepseek-harness-test-use` -> main checkout, `639ed015397290b3745d163aafe02ffee4aa3f84`
- Result: **9/9 PASS, 0 skips, 0 refused legs** (`DSH-CI-VERDICT pass`), 314.7 s
- Census: **677 files / 8821 legs**, `COUNTS MOVED, SET DID NOT`, 0 new reds, 0 collection errors

Leg verdicts: graph-parse, kit-home-guard, state-freshness, install, blueprint-fence,
typecheck, lint-identities, artifacts-at-head, census — all `pass`.

## Disclosed flake on the E2E-only HEAD

At `8ea3a0517924c5b244fc713317bd5e457ba77263`, full gate was **8/9**: the census leg
failed on a pre-existing 1 ms timing race, first `alpha5-glob-backend` X3, then
`alpha5-search-backend` P11 (`expected 'completed' to be 'cancelled'`). Each test passes
standalone on the same tree, and the same census passed standalone on that HEAD. The
integrated merge `48182b7` then passed the full gate 9/9. The failure is recorded here
rather than hidden; no product assertion was changed to obtain the green.

## Test corpus

`pnpm vitest run packages/runtime/test` (with the pristine host symlink):
**491 files / 6001 tests passed** on the E2E implementation tree before the final test
fold; the final integrated tree is covered by the census above.
