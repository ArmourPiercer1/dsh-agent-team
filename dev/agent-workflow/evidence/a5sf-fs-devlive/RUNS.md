# RUNS — FS/Search DEV-LIVE pilot (4 starts)

Record class: **DEV-LIVE**. Development evidence only. Never a candidate claim, never `V@B`.
Every start: its own World home under `tests/homes/`, port from the `3180` family, a shared-ledger
row set (`budget-intent` + boot + `dev-live-outcome`), one held dev-live slot (max 2 machine-wide),
teardown receipt. No cumulative cap (owner ruling 2026-11-09); the count is data, not a budget.

Authorisation: `dev-live-grant.json` (`grantId=devlive-fs-search-1`, `scope=DEV-LIVE`,
`face="FS Provider"`, `world=u5a5sfdev1`). Version executed by all four starts:
`953b65a59cfdc4938c72e31f0db5f059dd3c0401` (origin/master at lane start); host pin
`639ed015397290b3745d163aafe02ffee4aa3f84`.

| # | Purpose | Cause of failure / fix | Result |
| --- | --- | --- | --- |
| 1 | First live measurement of the 11 accepted FS/Search rows + the 3 new dev-live rows (edit in/out, read_image) on current master. | **Driver defect (ours).** The abort re-judge asked the SEARCH completeness rule about the new `fs:edit-*` ids (`no search-live completeness rule for "fs:edit-in-lane"`), so the run aborted at `delegate-dispatch` after judging 11 rows. Fix: `judgeSettledRows` skips `EDIT_CASE_SET` as it already skipped `FS_CASE_SET`; abort path now preserves `failed`/`detail`. | FAIL, partial, aborted at `delegate-dispatch`. 11 PASS / 1 FAIL / 2 NOT_REACHED. Observations kept: all 6 search rows + 5 FS rows measured; `edit-in` PASS; `edit-out` refused by the host observation policy (see README §5); `read_image` refused by the route's model-declaration gate. |
| 2 | Re-run after the abort fix: does the run reach the cancellation window, teardown and row 6? | **Judge fixture defect (ours).** `fs:edit-outside-ceiling` compared the disk against a stale two-line `plantedContent` (the fixture had moved from `outsideFile` to its own `editOutside`), so an untouched file read as `disk_mutated_outside_ceiling`. Fix: one-line planted value; also judge the edit-outside refusal by its EFFECT and record the locus. | FAIL, complete, not partial. 12 PASS / 1 FAIL / 1 NOT_REACHED. The cancellation window, row 6 archive boundary and teardown all measured PASS. |
| 3 | Stability run 1 after the judge fix. | none | NOT_REACHED (worst case = the one unmeasured row), complete. **13 PASS / 0 FAIL / 1 NOT_REACHED.** |
| 4 | Stability run 2 (same driver, same head, fresh World). | none | NOT_REACHED, complete. **13 PASS / 0 FAIL / 1 NOT_REACHED**, verdict **and reason string identical to run 3 on all 14 rows** (`runs/INDEX.json` holds both tables). |

## What the four starts cost and what they bought

- 4 starts, 3 distinct defects found, 2 of them in OUR driver/judge, 1 in the fixture's own
  expectation. No product defect was found; no start was wasted on a condition that a zero-boot
  check could have caught (the preflight PASSed 18/18 on every start, and it runs before the spawn).
- Two consecutive starts (3 and 4) produced an identical 14-row table at reason granularity. That is
  the stability condition the task asked for; the DEV-LIVE result is recorded against runs 3+4, with
  runs 1+2 kept as the diagnostic history that produced it.
- No start exceeded the machine rules: one slot held at a time, teardown verified (`portReleased`,
  `homeDeleted`, `noOrphanProcess` inside row 6's conjunction), `:3080` and its home untouched, host
  checkout unmodified.

## Per-run artefacts

`runs/run-1` … `runs/run-4` each hold the console log, `run-record.json`, `oracle-samples.json`,
`fixtures.json`, the guard-fact stream, the consultations copy, the provider counter, the
`preflight-bundle.json` + `preflight.log` that gated that start, the per-start `grant.json` and the
plan projections. `runs/INDEX.json` maps run → world home → port → verdicts.
