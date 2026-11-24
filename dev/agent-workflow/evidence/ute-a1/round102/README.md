# Round 102 — the D4 acceptance on the TARGET host (rc.5), judge by judge

**Dated**: 2026-11-24 (real UTC) · branch `vnext/a1-cut` · PR #822 (DRAFT, unmerged) · measured at
`10d8a67aeb7e189011faf2c131a73aa33b76fac3`. The SINGLE current acceptance-status table is the first
section of `dev/agent-workflow/evidence/ute-a1/D-ACCEPTANCE-REPORT.md`; this directory is its
machine evidence.

## What was wrong, and what changed (two probe commits)

1. `5952c8482` — **the probe is host-selectable**. It already took tree/pin from
   `tests/next-host/host-select.mjs`, but mounted the governed realm's native `tool-fs` from the
   literal rc.2 path. rc.5's `tool-fs` injects `workingDirectory`, rc.2's does not
   (`tests/deepseek-harness-next/packages/fs/tool-fs/lib/index.js:2003-2008` vs
   `tests/deepseek-harness-test-use/packages/fs/tool-fs/lib/index.js:1176-1180`), so
   `TEAM_TEST_HOST=next` graded an rc.5 Host with an rc.2 module. It now derives from the SELECTED
   tree. Ports/home suffix/child loader/pin already followed the selector.
2. `10d8a67ae` — **one measurement oracle made deterministic**. `d4:case-created`'s
   `case-has-no-decision-yet` read the ledger AFTER the capture, so it measured the Officer's
   speed. Measured at `5952c84` boot 2 (rc.2): request fact sequence 9 at `…25.351Z`, decision
   sequence 12 at `…25.527Z` — 176 ms, faster than the probe's 300 ms poll — REFUTED a correct
   product. Replaced by `captured-case-precedes-any-decision` (append-only-ledger ordering:
   creation fact sequence, case id agreement, every decision strictly later). No wake, byte or
   settlement clause changed.

## Files

| file | what it is |
| --- | --- |
| `probe-d4-rc2-at-10d8a67.log` | rc.2 run at the measured HEAD (`--boots 2`), selector unset |
| `probe-d4-rc5-at-10d8a67.log` | rc.5 run at the measured HEAD (`TEAM_TEST_HOST=next --boots 2`) |
| `d4-rc2/`, `d4-rc5/` | per-host copies of the probe's own artifacts: `agreement.txt`, `agreement.json`, `results.json`, `probe.log`, `run-record-self-check.json`, `runs/boot0{1,2}/` |
| `probe-d4-rc2.log`, `probe-d4-rc5.log` | the FIRST rc.2/rc.5 pair (at `00ddf3a76`/`5952c84`), kept as the discovery record — the rc.2 pair is the one that reproduced the `case-has-no-decision-yet` race |
| `d4-rc2-round99-*.{txt,json}` | the round-99 rc.2 artifacts, preserved before the first run overwrote the live `d4/` tree |
| `head-at-start.txt`, `head-at-run.txt`, `head-measured.txt` | the HEAD each run recorded in its DEV-LIVE ledger (`bindings.teamSha`) |

## The two runs, verbatim result lines

```
rc.2: RESULT evidence-complete=true allBooted=true blocked=true runRecordsValid=true (2/2 boots; agreeing pair=true)
rc.5: RESULT evidence-complete=true allBooted=true blocked=true runRecordsValid=true (2/2 boots; agreeing pair=true)
```

`blocked=true` is the probe's own contract for a REFUTED judge (`d4:ask-execute-process`, product
assembly gap). The two `agreement.txt` files are byte-identical; see `RC5-MIGRATION.md` §13 for the
judge table and `D-ACCEPTANCE-REPORT.md` for the current status of every capability.
