# Gate record

## Final recipient-probe HEAD

- HEAD: `4e569e757` (product fix `fd7a5d6c1` + handoff/human/exception/Stop probes + fence re-record)
- Command: `CI=true node scripts/ci-pr-gate.mjs --full --store-dir "$PWD/.drill/pnpm-store"`
- Pristine host: `tests/deepseek-harness-test-use` -> main checkout symlink,
  `639ed015397290b3745d163aafe02ffee4aa3f84`
- Result: **9/9 PASS**, 0 skip, 293.4 s
- Census: **677 files / 8830 legs**, `COUNTS MOVED, SET DID NOT`, identity set identical
  to the published baseline, 0 new reds, 0 collection errors

Leg verdicts: graph-parse, kit-home-guard, state-freshness, install, blueprint-fence,
typecheck, lint-identities, artifacts-at-head, census — all `pass`.

The first attempts at the human-, exception- and Stop-probe HEADs were 8/9 on
census because two gate runs overlapped; each isolated rerun is the 9/9 above. The first attempt at `1135f381b`
was 8/9 only on the blueprint fence: the handoff probe
shifted one v5 identity from L1815 to L1819. The fence baseline was re-recorded in the open
(same source/fixture) at `5b7381a34`, whose full gate is the 9/9 above. No assertion was
changed. Earlier census attempts hit the two known pre-existing 1 ms races
(`alpha5-glob-backend` X3, `alpha5-search-backend` P11); the final run is clean.

The C1 kit v5 identities moved to L598/L787/L1191/L1815 when the env-gated recipient
fixtures were added; `blueprint-fence-baseline-606a0be7.txt` was re-recorded in the open
for exactly those four identities (same sources/fixtures, no new offending content).

## Earlier product-gated HEAD

`b4d4d21e3fa9cef9db5ead895a47c479d925e7f4` was 9/9 (378.1 s, census 677/8830) after
the P1 review fixes. The later product delta is the transfer-event consumer (`fd7a5d6c1`),
covered by the gate above and the clean handoff Host run `a6-handoff-only-r6`; see the
acceptance matrix and `recipients.md`.
