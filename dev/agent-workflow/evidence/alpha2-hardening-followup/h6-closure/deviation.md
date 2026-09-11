# H6 deviations log

## D1 (attempt 1, live world `2026-09-11T10-50-59`) — kit bug in the new L1 check; PRODUCT UNAFFECTED
- **Symptom**: live battery 154/155 — single FAIL `live-H6-L1-t0-zero-requests` (expected=10 actual=11).
- **Diagnosis**: the T0 request-count baseline was read from a STALE `/state` snapshot
  (`st` last refreshed in the N6 section, BEFORE the `a2-fp2` request was created). The
  count increment 10→11 was the pre-existing (then-resolved-deny) `a2-fp2` request, not
  the T0 read.
- **Product evidence (raw durable ledger, the authority)**: `h6-live-2026-09-11T10-50-59.json`
  → `controlLedger` has **zero** `control-request-recorded` facts for correlations
  `h6-l1-t0` and `h6-l1-t1`; the request sequence is `… a2-fp1, a2-fp2, h6-bashA, h6-bashB,
  h6-bashC` — the L1 reads created nothing. T1's zero-requests check (fresh baseline) PASSED.
  The static DENY + exact policy reason + zero-effect held at T0 AND T1 (all other L1
  checks green, incl. `live-H6-L1-t0-static-deny/static-reason`, `live-H6-L1-t1-still-static-deny`,
  `live-H6-L1-t1-zero-requests`, body-untouched ×2, retarget flip).
- **Fix**: `a2permhf-check.mjs` L1 block now refreshes `st = (await p6t6State()).body`
  BEFORE capturing the T0 baseline (kit-only change; no product code touched).
- **Disposal**: attempt-1 world removed (ephemeral, gitignored — junction unlinked via
  node fs first); attempt 2 = fresh world `2026-09-11T11-0x` with the fixed kit.
- **Verdict**: NO product deviation; H4/H5 behavior confirmed correct at attempt 1
  (the failed check was a measurement artifact).
