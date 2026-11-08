# a5sf-pd33-preview-e2e — evidence for PD-33 (Alpha.5 Preview end-to-end)

> **Class: `DEV-LIVE`.** This is measured evidence from a real Host process with the
> shipped opt-in `a5sf-governed-member` preset, not candidate acceptance.
> No `V@B`, no grade, no Q7/Authority/Required-CI change. `CORE PATCH BUDGET = 0`.

## What was measured

One World per boot, two boots (`--boots 2`) that must agree item by item, one
composition, no row renames (see `runs/boot01/preset-effective.json`).

| Arm | What it measures |
| --- | --- |
| E2E | the Leader creates two Members in one turn, delegates to both, and recollects both in a second turn; Member A runs the governed I/O chain (read/grep/glob/write/edit/bash/skill/present) and hits three authorization refusals; Member B does a real `web_fetch`, one `web_search` in whichever shipped state the install graph provides, and a goal that converges after >= 3 automatic rounds; both Members are probed for the seven deferred tool names |
| S1 | stop during a round (user `session/cancel`) — 20 000 ms silent window on the Member's own durable log |
| S2 | stop at a round boundary (24-cancel burst) |
| gap | stop in the idle window between two rounds (6 probes) |
| S6 | cold recovery: SIGTERM, restart the same `DSH_HOME`, real `team_follow_up`, no automatic round |
| S7 | explicit `/goal resume` still works after recovery |
| S8 | an un-stopped goal keeps going (Member B), and `complete` ends it |
| shell-write-lane | the service axis for an out-of-lane `bash` write target (**expected REFUTED** today; the OS axis is what stops it) |

## Layout

```
driver.log                     append-only console transcript (all runs)
run-ledger.jsonl               u5 run ledger (DEV-LIVE, eligible=false)
runs/boot01|boot02/
  e2e.json                     the measured E2E numbers (per-call probes + facts)
  guard-facts.json             PD-33 calls only (the full sink stays in the World home)
  arms.json counters vs arms   lifecycle arms, all counters
  verdicts.json                per-case clauses with the measured detail strings
  run-record.json              u5-run-record/1, bindings.candidate.head, DEV-LIVE
  member-facts.json            per-Member durable goal facts
  preset-effective.json        the exact composition the run used
  precondition.json            assertShippedPresetMounted + install graph
  state-final.json             final Team state
  host-tree-porcelain-1.txt    pinned host tree must stay clean
  summary.txt / boot.log       run summary
appendix/                      generated tables used by the readiness report
```

The World's `DSH_HOME` and the full guard sink live under `tests/homes/uv…`
(gitignored, one World per boot); they are reproducible, not committed.

## Reproduce

```bash
# host-free composition check (no boot)
node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --plan

# one boot, E2E arms only
node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --arms e2e --boots 1

# the measured pair
node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --boots 2

# negative control: drop the opt-in realm key; the inherited host `web`
# tripwire must go non-zero and the governed-web clauses must redden
A5SF_PD33_MUTATE=no-realm node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --arms e2e --boots 1
```

## What this evidence does NOT claim

- Not a candidate acceptance (`eligible=false`), not a matrix grade, not `V@B`.
- `read_image` is on the governed surface but has **no live evidence on this
  HEAD** (#680 unmerged) — the roster says "face governed, live pending".
- `web_search`'s real backend arm is measured with 0 POSTs here because the
  Exa provider package is absent from this install graph; the shipped behaviour
  is the typed `WEB_PROVIDER_UNAVAILABLE`, and the real-POST arm is cited from
  PD-30 (#678), not re-measured here.
- A `REFUTED` case is a **measured product gap**, not a driver failure:
  `pd33:shell-write-lane` records that the shell guard admits `..` as a write
  target and only the OS sandbox stops it.
