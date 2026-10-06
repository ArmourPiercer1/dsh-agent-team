# Gate 1 (P5-T5 root-binding, scenario S1) — attempt register

Written after the fact, from the files that still exist. The harness writes
`run.log`, `summary.json`, `S1.json` and `S1.error.json` INTO the `--report-dir`
it is given, so attempts 1–4 (which all shared this directory) overwrote each
other. Nothing below is reconstructed: what is marked LOST is gone.

| attempt | what happened | evidence that survives here | status |
| --- | --- | --- | --- |
| 1 | `S1: http=500`, `RootBindingError … blueprint catalog is absent` at `fresh-root.ts:217` | `wrapper.log`, `S1.error.json` was later overwritten → **run.log/summary.json LOST**; the error text is quoted in the PR-round report and in commit `3fb2a729` | LOST (partial) |
| 2 | `S1: http=500`, `ports.writes.putMemberInstance is not a function` (`fresh-root.ts:248`), 2.7 s | `wrapper-attempt2.log`; scenario files overwritten | LOST (partial) |
| 3 | `S1: http=500`, `Cannot read properties of undefined (reading 'map')` after **205.6 s** | `wrapper-attempt3.log`, `S1.error.json` (this attempt's, 18:46:19) | partial |
| 4 | scenario completed: **13/15 assertions**, 210 s | `wrapper-attempt4.log`, `S1.json` (18:48:19) + `done-S1.json` until attempt 5, `run.log` overwritten by attempt 5 | partial |
| 5 | **15/15 PASS**, `harness PASS`, 2.9 s, exit 0 | `attempt5/` (complete: `wrapper.log`, `run.log`, `S1.json`, `done-S1.json`, `summary.json`, `dump-config-boot1.txt`, `logs/`) | COMPLETE |

The two files that outlived their attempt by accident (`S1.error.json` from
attempt 3, `S1.json` from attempt 4) are the ones whose timestamps predate the
later runs; they are kept untouched. `attempt5/` is the first run recorded in a
directory of its own — per user instruction every later attempt gets one,
because the harness reuses fixed file names inside its report dir.

Consequence recorded so nobody re-reads this as a clean single-shot pass: the
gate was reached on the fifth attempt, after three harness-side defects were
removed (missing `blueprintCatalog`, missing `putMemberInstance`, and the two
stale 0.2 reads — transcript accessor and the versioned durable log name). The
unversioned-name and `.events` reads had been failing since well before this
upgrade (proved against the PR base in commit `3fb2a729`), and no assertion was
relaxed to get here: `15/15` includes the original model/selection event check
and the original "a final compressed session log was published" check, whose
label was corrected to name the artifact 0.2 actually writes.
**Not committed on purpose:** `attempt5/summary.json` (it records the ephemeral instance URL with its boot token) and everything under `attempt5/logs/`, `run.log`, `dump-config-boot1.txt`, `wrapper.log`. They stay local-untracked; the committed record is `S1.json` (assertions + phase timings), `done-S1.json` and this file.
