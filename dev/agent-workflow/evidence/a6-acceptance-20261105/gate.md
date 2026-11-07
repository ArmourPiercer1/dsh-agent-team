# Gate record

## Closing-round acceptance HEAD — `28b61d4b2`

- Command: `CI=true node scripts/ci-pr-gate.mjs --full --store-dir "$PWD/.drill/pnpm-store"`
- Pristine host: `639ed015397290b3745d163aafe02ffee4aa3f84`
- Result: **9/9 PASS**, 0 skip, **298.7 s**
- Census: **677 files / 8833 legs** (one new cross-root marker test), `COUNTS
  MOVED, SET DID NOT`; identity set IDENTICAL to the published baseline
- Artifacts: `HEAD carries its own build` (1983 compared, 0 drift)
- Blueprint fence: kit identities re-recorded at L624/L813/L1785/L2475 (same
  four v5 fixtures; line shifts only)
- Log: `.drill/ci-gate-28b61d4b2.log` (untracked local artifact)
- Product delta: non-authorizing invocation settlement (A6-only bounded wait
  abandon; boot settlement of dead PA invocations), Inbox accepted/claimed
  crash rebuilds exactly one new wake, Sticky Stop marker owner readback.
- Intermediate attempts are recorded locally and were NOT accepted:
  `0a468812a`/`d3fe94ec4` failed lint/census/fence (unused local, A5 M1
  timeout semantics temporarily changed, stale fence line numbers). The
  passing commit restores A5 semantics (`deps.a6` guard) and updates the named
  ARC-A center override for `pa-control-bridge.ts`.

## Final acceptance HEAD — `fb6ccb4f4`

- Command: `CI=true node scripts/ci-pr-gate.mjs --full --store-dir "$PWD/.drill/pnpm-store"`
- Pristine host: `639ed015397290b3745d163aafe02ffee4aa3f84`
- Result: **9/9 PASS**, 0 skip, **292.6 s**
- Census: **677 files / 8832 legs** (two new marker unit tests), `COUNTS MOVED,
  SET DID NOT`, 0 new reds
- Artifacts: `HEAD carries its own build` (1983 compared, 0 drift)
- Blueprint fence: no new offending path; kit identities re-recorded at
  L619/L808/L1729/L2417 (same fixtures)
- Log: `.drill/ci-gate-fb6ccb4f4-r2.log` (untracked local artifact)
- `fb6ccb4f4` first run: 8/9, one flaky red in
  `alpha5-glob-backend.test.ts::X3` (the same test passed standalone, 53/53);
  the clean re-run above is the recorded verdict.
- Earlier: `d6c0e8528` 9/9 (290.6 s); `fedd641ed` aborted at fence (stale
  baseline), `a44d26484` 7/9 (uncommitted dist mirrors).
- Product delta since `1e50d55fc`: real resume re-plan (actual delegable legs,
  never an empty scan), atomic/existence-based Sticky Stop marker + unit tests.
  Boot recovery stays strictly own-root after the second review showed a
  cross-root version could touch another mounted Team's row.
- Earlier `1e50d55fc`: 9/9, 362.8 s (`.drill/ci-gate-1e50d55fc.log`).

## Previous acceptance HEAD — `fa87927fd`

`fa87927fd` was 9/9 (299.4 s) but its cross-root recovery was BLOCKed by the
second review (owner/generation namespace); it is superseded by `fedd641ed`.

## Earlier acceptance HEAD — `1e50d55fc`

- Command: `CI=true node scripts/ci-pr-gate.mjs --full --store-dir "$PWD/.drill/pnpm-store"`
- Pristine host: `639ed015397290b3745d163aafe02ffee4aa3f84`
- Result: **9/9 PASS**, 0 skip, **362.8 s**
- Census: **677 files / 8830 legs**, `COUNTS MOVED, SET DID NOT`, 0 new reds,
  0 collection errors
- Artifacts: `HEAD carries its own build` (1983 compared, 0 drift)
- Blueprint fence: no new offending path; kit identities L618/L807/L1626/L2264
  re-recorded in the open (same sources/fixtures)
- Log: `.drill/ci-gate-1e50d55fc.log` (untracked local artifact)
- The first attempt at product head `f68dc137c` was 6/9: the kit edit moved the
  two v5 identities (fence), the dist glue mirror was not yet placed
  (artifacts-at-head), and the dirty docs tree tripped the two A4-PR7 merge-gate
  census tests. `1e50d55fc` fixes all three and is the 9/9 above.
- Both runs isolated; the concurrent-census corruption caveat still applies.

## Earlier acceptance HEAD — `212c4fba2`

- Command: `CI=true node scripts/ci-pr-gate.mjs --full --store-dir "$PWD/.drill/pnpm-store"`
- Pristine host: `639ed015397290b3745d163aafe02ffee4aa3f84`
- Result: **9/9 PASS**, 0 skip, **375.9 s**
- Census: **677 files / 8830 legs**, `COUNTS MOVED, SET DID NOT`, identity set
  identical to `nine-root-u7-1-old-reds.md`, 0 new reds, 0 collection errors
- Log: `.drill/ci-gate-212c4fba2.log` (untracked local artifact)
- Earlier `a4453050f`: 9/9, 304.1 s (`.drill/ci-gate-a4453050f.log`)
- Both runs isolated; the concurrent-census corruption caveat still applies.

## Final recipient-probe HEAD

- HEAD: `a1868f878` (product fix `fd7a5d6c1` + recipient/refusal/Stop and four crash-window probes + fence re-record)
- Command: `CI=true node scripts/ci-pr-gate.mjs --full --store-dir "$PWD/.drill/pnpm-store"`
- Pristine host: `tests/deepseek-harness-test-use` -> main checkout symlink,
  `639ed015397290b3745d163aafe02ffee4aa3f84`
- Result: **9/9 PASS**, 0 skip, 322.5 s
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
after-consume probe moved the C1 identities to L615/L804/L1405/L2036 and was
9/9 at `516767b01`; the before-write probe moved them to L615/L804/L1456/L2087
and is 9/9 at `a1868f878`. The Sticky Stop audit is a source/docs-only
addition after that gate (no test or product bytes). The first attempt at `1135f381b`
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
