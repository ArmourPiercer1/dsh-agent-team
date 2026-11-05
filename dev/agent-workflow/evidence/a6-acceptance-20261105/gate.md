# Gate record

## Final recipient-probe HEAD

- HEAD: `516767b01` (product fix `fd7a5d6c1` + recipient/refusal/Stop/crash/allow/consume probes + fence re-record)
- Command: `CI=true node scripts/ci-pr-gate.mjs --full --store-dir "$PWD/.drill/pnpm-store"`
- Pristine host: `tests/deepseek-harness-test-use` -> main checkout symlink,
  `639ed015397290b3745d163aafe02ffee4aa3f84`
- Result: **9/9 PASS**, 0 skip, 320.3 s
- Census: **677 files / 8830 legs**, `COUNTS MOVED, SET DID NOT`, identity set identical
  to the published baseline, 0 new reds, 0 collection errors

Leg verdicts: graph-parse, kit-home-guard, state-freshness, install, blueprint-fence,
typecheck, lint-identities, artifacts-at-head, census — all `pass`.

The first attempts at the human-, exception- and Stop-probe HEADs were 8/9 on
census because two gate runs overlapped; each isolated rerun is the 9/9 above.
The review-comment HEAD first failed artifacts-at-head (the manual dist comment
had stale source maps) and census; after a real runtime rebuild and map commit,
`f2d74da4a` is 9/9. The crash probe then moved the C1 v5 identities to
L615/L804/L1379/L2010; `a6-crash-r4` proves a post-write SIGKILL, restart and
fail-closed human resolution. The fence baseline was re-recorded for the moved
identities and four stale `a6-assigned-officer-facts` entries; `60b1dd700` is
9/9 with no resolved identities. The after-allow crash probe moved the C1
identities again to L615/L804/L1400/L2031; `a432e49ea` was 9/9 on the isolated
rerun (first attempt 8/9 on the known `alpha5-glob-backend` X3 1 ms race). The
after-consume probe moved the C1 identities to L615/L804/L1405/L2036 and is 9/9
at `516767b01`. The first attempt at `1135f381b`
was 8/9 only on the blueprint fence: the handoff probe
shifted one v5 identity from L1815 to L1819. The fence baseline was re-recorded in the open
(same source/fixture) at `5b7381a34`, whose full gate is the 9/9 above. No assertion was
changed. Earlier census attempts hit the two known pre-existing 1 ms races
(`alpha5-glob-backend` X3, `alpha5-search-backend` P11); the final run is clean.

The C1 kit v5 identities moved to L615/L804/L1379/L2010 when the env-gated recipient,
human, exception and Stop fixtures were added; `blueprint-fence-baseline-606a0be7.txt` was re-recorded in the open
for exactly those four identities (same sources/fixtures, no new offending content).

## Earlier product-gated HEAD

`b4d4d21e3fa9cef9db5ead895a47c479d925e7f4` was 9/9 (378.1 s, census 677/8830) after
the P1 review fixes. The later product delta is the transfer-event consumer (`fd7a5d6c1`),
covered by the gate above and the clean handoff Host run `a6-handoff-only-r6`; see the
acceptance matrix and `recipients.md`.
