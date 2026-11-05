# Gate record

## Final recipient-probe HEAD

- HEAD: `d255f6f39` (test/evidence-only after the product-gated `b4d4d21e`; no product file differs)
- Command: `CI=true node scripts/ci-pr-gate.mjs --full --store-dir "$PWD/.drill/pnpm-store"`
- Pristine host: `tests/deepseek-harness-test-use` -> main checkout symlink,
  `639ed015397290b3745d163aafe02ffee4aa3f84`
- Result: **9/9 PASS**, 0 skip, 310.6 s
- Census: **677 files / 8830 legs**, `COUNTS MOVED, SET DID NOT`, identity set identical
  to the published baseline, 0 new reds, 0 collection errors

Leg verdicts: graph-parse, kit-home-guard, state-freshness, install, blueprint-fence,
typecheck, lint-identities, artifacts-at-head, census — all `pass`.

The first attempt at this HEAD was 8/9: census reported the two known pre-existing
1 ms races (`alpha5-glob-backend` X3, `alpha5-search-backend` P11). The immediate rerun
was 9/9 with the same tree; no assertion was changed.

The C1 kit v5 identities moved to L598/L787/L1191/L1815 when the env-gated recipient
fixtures were added; `blueprint-fence-baseline-606a0be7.txt` was re-recorded in the open
for exactly those four identities (same sources/fixtures, no new offending content).

## Earlier product-gated HEAD

`b4d4d21e3fa9cef9db5ead895a47c479d925e7f4` was 9/9 (378.1 s, census 677/8830) after
the P1 review fixes; see the acceptance matrix and `recipients.md`.
