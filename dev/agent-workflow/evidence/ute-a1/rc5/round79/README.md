# Round 79 — the three D drivers re-run on BOTH hosts after the B6 change

Round 79 (2026-11-23) closes the rc.5 pre-dispatch Stop drift (`RC5-MIGRATION.md` §7). The code
change touches only observation/recording, but the drivers are the acceptance face, so all six
combinations were re-run at the code commit `274aec2cc` and compared with the round-78 rows.

Commands (run sequentially from the worktree, one host at a time):

```
node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs    --boots 2
node tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs --boots 2
node tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs --boots 2
# and the same three with TEAM_TEST_HOST=next
```

The `*.log` files are the drivers' complete stdout for that run (candidate row with
`host`/`pin`/`source`, the boot count, per-case verdict lines, the fact table and the final
`RESULT`). The in-place `dev/agent-workflow/evidence/d-boot-feasibility/**` trees were restored to
their round-78 state after each run (the drivers rewrite them; this round's transcripts are what is
kept), so nothing here silently replaces round-78 evidence.

## Verdicts

| driver | rc.2 (legacy) | rc.5 (next) |
| --- | --- | --- |
| `run-boot.mjs` | `RESULT PASS (2/2 boots; agreeing pair=true)` | `RESULT PASS (2/2 boots; agreeing pair=true)` |
| `run-boot-d2.mjs` | `RESULT PASS (2/2 boots; agreeing pair=true)` | `RESULT PASS (2/2 boots; agreeing pair=true)` |
| `run-boot-d3.mjs` | `RESULT evidence-complete=true allProven=true (2/2 boots; agreeing pair=true)` | `RESULT evidence-complete=true allProven=true (2/2 boots; agreeing pair=true)` |

Every counted fact is IDENTICAL to the round-78 table (`RC5-ACCEPTANCE.md` §2): allowFacts 2 /
denyFacts 0 / centreAdmissions 2 / centreExecutions 2 / transcriptSourceCount 2;
aAdmissions 9 / bAdmissions 9 / aGuardFacts 14 / bGuardFacts 14 / windowsOverlap true /
crossRefused true / stopSettlementState REFUSED / bAfterStopCompleted true;
aAdmissions 4 / bAdmissions 3 / inflightAfter UNKNOWN / collectStatus succeeded / both bash states
COMPLETED. Nothing regressed; no row differs between hosts and none between the two boots of a host.
