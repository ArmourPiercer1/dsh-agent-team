# Run #7 monitoring — nonce mtkfcums5d034e (job pwsh-135, launched 18:23:35Z)

Budgets in effect (T12-V4): 480 s standard ack waits; 900 s at LIFECYCLE-descendant-discovery,
LIFECYCLE-desc-ack, V2-B-child-ack. V3 denied-ack 480 s + per-turn opener latency evidence.
`member.followup` now sends `payload.prompt` (T12-V4).

## Observed timeline (UTC)

| t (UTC) | event |
| --- | --- |
| 18:23:35.189 | runner start; pre-brackets clean (:3080=200; test-use head=cd5ef814 status/diff empty); ports free; homes fresh |
| 18:23:38.711 | build: 3.4 s (incremental), glue placed byte-identical, import probe OK |
| 18:23:42.375 | A1 booted (2 s); row ready toolCount=10 at 18:23:43.571 |
| 18:23:43.825/43.827 | mock 1 (title) + mock 2 ROOT_FIRST_ACK — root turn instant (NO window on root, 4th run in a row) |
| 18:23:44.657 | **V1 pass=true** (~1 s) |
| 18:23:45.x | workerA created; CHILD_FIRST admitted (v2aAdmittedAt) |
| 18:23:45 → 18:39:45 | **ZERO mock requests for 480 s** — child turn 1 in window |
| 18:31:45.393 | **V2 (world A part) pass=false** — childAck 480 s timeout (honest stall) |
| 18:31:45.5 | V3: override.set (shape fix — record accepted), USE_MCP admitted (v3AdmittedAt) |
| 18:39:46.164 | mock 3 CHILD_FIRST_ACK — **turn 1 resolved at ~1021 s after admission** (record; run #6 max was >480 s) |
| 18:39:46.178/46.511 | mock 4 (USE_MCP title) + mock 5 **tool-call mcp__t12vmini__ping** — turn 2 ran 0.35 s after turn 1 converged (latched turn replays immediately at convergence) |
| 18:39:46.629 | mock 6 MCP_DENIED_ACK |
| 18:39:46.854 | **V3 pass=false** — denied-ack landed ~1.1 s past the 480 s deadline (deadline ≈18:39:45.5); same artifact class as run #6 (1.3 s). All substantive policy checks have their data (mock 5 tool-call + mock 6 denied-ack + durable child log) |
| 18:39:47.284/47.719 | mock 7 TASK_ACK; **V4 pass=true** (0.44 s) — workerV4 (another fresh child) had NO window: the window is per-agent intermittent, not per-fresh-child |
| 18:39:47.8 | LIFECYCLE SUBSPAWN admitted (lcAdmittedAt; discovery budget 900 s → deadline ≈18:54:48) |
| 18:39:48 → 18:54:48 | **ZERO mock requests for 900 s** — SUBSPAWN turn (turn 3 on workerA) in window > 900 s |
| 18:54:48 | discovery budget expired → no descendant (honest LIFECYCLE fail); archive/restore/follow-up flow continues |
| 18:54:51.709 | mock 8 **FOLLOWUP_ACK** — post-restore follow-up ran INSTANTLY (the archive drain had discarded the latched SUBSPAWN turn; re-materialized agent is idle) |
| 18:54:52.100 | **LIFECYCLE pass=false** (window > 900 s — accepted per protocol; full evidence in summary) |
| 18:54:52.109 | **V5 pass=true** |
| 18:54:52.146 | A1 stopped (portFree) |
| 18:54:56.331 | fresh2: B1 booted (world B) |
| 18:55:07.567 | B1 state route 500 — KNOWN DEFECT (plugin.mjs L433 null-deref, `mcpServer:null` row); recorded as evidence, continuing via invariant 9 (as designed) |
| ~18:55:1x | workerB created; CHILD_FIRST admitted (900 s budget → deadline ≈19:10:1x) |

## Per-turn window table (workerA, run #7)

| turn | marker | delay admission→mock |
| --- | --- | --- |
| 1 | CHILD_FIRST | ~1021 s |
| 2 | USE_MCP | 0.35 s (latched; replays at turn-1 convergence) |
| 3 | SUBSPAWN | > 900 s (never reached mock inside budget; drain discarded it) |

Contrast run #6 (same agent class): 47 s / 181 s / 0.25 s / >480 s. Window placement and size vary per run — the
intermittency is confirmed at run level AND per-turn level (V4's workerV4 turn was instant in run #7).

## Hang rule for remaining phases

- V2-B childAck deadline ≈ 19:10:1x (900 s from ≈18:55:1x)
- restart1: A2 boot fails fast (~1.6 s expected — shipped resume bug)
- handoff: world C boot (~2 s) + 4 legs (root turns instant in every run) ≈ ≤ 5 min
- Kill condition: silence beyond (worst-case remaining for current phase) + 3 min → kill + `t12v-hang-run7.log`
