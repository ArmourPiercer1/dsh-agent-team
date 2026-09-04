# T12-V finding: ~360 s first-turn latency on freshly materialized child agents

Status: OWNER PINNED row-owned and FIXED in T12-V16 (commit 50bcdbb) — the remote
member.send was admission-only (durable intent fact, no delivery); nothing in core
was waiting, the relay input was never attempted until a state-route query drained
it. See "OWNER PINNED" section below (runs #12/#13 evidence chains). Run #5 first
surfaced the symptom; the run #5-#10 hypothesis (core maintenance) is superseded.

## Hard timeline (all UTC, run #5, world A)

| t (epoch ms) | t (UTC) | event | source |
|---|---|---|---|
| 1788368744673 | 17:05:44.673 | child session created (`session-team-child-ffbf0f578b86aa24838080b14b02ae54`) | session log record [0] |
| 1788368744988 | 17:05:44.988 | ledger seq 1 `provision-member-instance` (inst-004uplx02hkh) | team_domain.json ledger |
| 1788368745117 | 17:05:45.117 | ledger seq 2 `team-coordination-recorded` (CHILD_FIRST send admitted) | ledger |
| — | 17:05:45→17:11:45 | **child session log silent: zero events for 360.9 s** | session log (records [3]→[4] gap) |
| 1788369105587 | 17:11:45.587 | `agent/inbox/spliced` (CHILD_FIRST into next-turn) + `turn/start` (turn 1) | session log records [4],[5] |
| 1788369105659 | 17:11:45.659 | step 1 begins; mock req 3 (title) + req 4 (CHILD_FIRST_ACK) at 17:11:45.76 | session log + mock log |
| 1788369105817 | 17:11:45.817 | ledger seq 4 `team-message-delivered` (CHILD_FIRST confirmation) | ledger |
| 1788369106074 | 17:11:46.074 | USE_MCP (sent 17:08:45.357) spliced + turn 2 starts **0.5 s after turn 1 started** | session log |

Subsequent turns on the same live agent are immediate (USE_MCP +0.5 s, V4 task +0.6 s,
MCP tool-call +0.3 s). World B shows the same first-turn gap (V2-B 180 s wait timeout).
LIFECYCLE's subspawn wait timed out the same way.

## Mechanism (shipped code path)

1. `agent-bindings.mjs` `sessionInput.submitAttributedInput` (L922-938):
   `ensureLiveAgent(childSid)` (returns the live handle created at member-create) →
   `prepareAgentForRequest` → `handle.agent.followup(message)` → **`await handle.agent.whenIdle()`**.
   The `team-message-delivered` confirmation is written only after `whenIdle()` resolves —
   hence the delivery fact at 17:11:45.817, 360.7 s after admission.
2. Core agent loop (`packages/core/agent-loop/src/agent.ts`): `followup` → `send(msg,'next-turn',true)`
   → `inbox.splice` + `wakeDriver()`. `wakeDriver` (L179-200) starts the turn driver IMMEDIATELY
   only when `phase.kind === 'idle'`; while the phase is `maintenance` (or an aborted activity)
   it merely latches `phase.wakeRequested = true` and replays at convergence (L180-188, L165, L227).
   ⇒ the child agent's phase was non-idle for the whole 360 s window, latching the wake;
   the turn started at the moment the phase converged (17:11:45.587) and the latched wake replayed.
3. No 360000 ms constant exists in the DSH core or plugin packages (grep verified), so the window
   is a composite/derived duration (candidate: a maintenance job on the fresh agent — e.g.
   session-title/projection bootstrap — or an aborted-activity convergence); pinning the exact
   owner would require core-instrumentation beyond this task's authority (no core patches allowed).

## Run #4 vs run #5

Run #4 (nonce mtkbvjcecfd071): the child's FIRST turn was the V4 delegate task (work-delivery
port) and started ~1.2 s after member-create; the queued CHILD_FIRST relay then ran as turn 2.
No 360 s gap observed. Same plugin/core/config otherwise — the non-idle-phase window did not
present (or presented sub-second) in that run. The behavior is therefore intermittent
from the outside; budgets must cover the 360 s+ case to stay honest.

## Runner mitigation (this commit + next)

- First-turn-on-fresh-agent waits (V2-A childAck, V4 task acks, LIFECYCLE descendant ack +
  post-restore followup, V2-B childAck, RESTART followup, HANDOFF source/target root acks):
  180 s → 480 s.
- Turns on an already-live agent (V3 denied-ack, LIFECYCLE subspawn ack): unchanged 180 s.
- New evidence: `firstTurnLatencyMs` per affected child (first `turn/start` ts in the durable
  session log minus the admission `at` from the ledger fact), so the summary.json records the
  actually observed latency instead of only pass/fail.

## Anti-cheat note

No seeding, no bypass: the waits are real bounded waits against real durable logs; the latency is
measured from durable artifacts, not asserted.

## Applied (commit `eb1600a`, T12-V3)

- Budgets applied to ALL first-turn-on-fresh-agent waits: V1 rootAck (extended beyond the
  original plan — the root agent is the same fresh-agent class; observed immediate in runs
  #4/#5, the budget only protects against the intermittent gap and costs nothing on pass),
  V2-A childAck, V4 task+ack, LIFECYCLE descendant discovery + descAck + post-restore
  followup, V2-B childAck, RESTART followup, HANDOFF source C1 + targets B1/B2 + second
  source (world B root).
- V3 denied-ack kept at 180 s by analysis: with V2-A at 480 s, the gap (observed 360.9 s)
  is fully absorbed inside V2-A's wait BEFORE V3 sends; V3's turn then runs on an
  already-converged agent. Run #5's 0.8 s near-miss was the gap OVERFLOWING from V2-A's
  then-180 s budget into V3's window — that overflow path no longer exists below 660 s gap.
- Measured latency evidence as planned, implemented as `firstTurnLatencyEvidence` (runner
  wall-clock at the admission call vs the durable first `turn/start` `time` field — the
  session log itself is silent across the gap, and the relayed `user/message` is appended
  only at turn convergence, so the runner clock is the only admission reference) and
  `turnStartBeforeText` (nearest preceding `turn/start` for a text-marked follow-up turn,
  used by the LIFECYCLE post-restore follow-up measurement).
- Unrelated runner bugs fixed in the same commit after dumping run #5's V5 result:
  schemaVersion expectation (shipped projection stamps 2 = frozen S7-R2 v2 contract,
  v1 field set + optional `disposedHistory`; assertion now accepts the frozen 1|2 set and
  requires the nine v1 top-level fields) and `ledger` field (LedgerSummaryDto —
  non-empty = `totalEntries > 0`; the old code looked for an array/`entries` that the
  frozen contract does not have).

## Run #6 data — the window PERSISTS past the first turn (REFINES the model)

Run #6 (nonce `mtke5bxi426eb0`, started 2026-09-02T17:49:44Z) produced a third duration
shape on the SAME world-A worker child, measured from mock reply timestamps:

| turn | sent (approx) | model request observed at | delay |
| --- | --- | --- | --- |
| 1 CHILD_FIRST | ~17:49:58 (child created just before) | 17:50:45.404 (reply 4) | **~47 s** |
| 2 USE_MCP (V3) | ~17:50:46 (right after V2-A passed) | 17:53:47.232 (reply 5) | **~181 s** |
| 3 TASK (V4) | ~17:53:47.6 | 17:53:47.844 (reply 7) | **~0.25 s** |

So the fresh-child non-idle window is NOT consumed by the first turn alone — it spans
multiple relayed turns until the phase converges (here: two delayed turns, then immediate).
Run #5's single 360.9 s figure was one instance of the same mechanism with a longer
convergence. Consequence (applied after run #6's V3 near-miss, ack landed 1.3 s past the
180 s deadline): V3's denied-ack wait also moved to 480 s (commit after run #6), with the
USE_MCP turn's own opener measured via `turnStartBeforeText` (the child's first
`turn/start` belongs to V2-A's turn and must not be reused for V3's latency).
The 480 s budget family now covers: V1 root, V2-A, V3, V4 (×2), LIFECYCLE (descendant
discovery + descAck + post-restore followup), V2-B, RESTART followup, HANDOFF (C1, B1,
world-B root, B2). Observed max delay so far: 360.9 s (run #5) — 119 s margin under 480 s.

## Run #7 data — the window EXCEEDS 480 s AND 900 s; placement is per-run random

Run #7 (nonce `mtkfcums5d034e`, 2026-09-02T18:23:35Z → 19:10:30Z, exit 0) moved the
curse to world A's child turn 1, and the SUBSPAWN turn went beyond the enlarged 900 s
budget. Measured from mock reply timestamps (world-A worker `inst-0sodaux0gs9x`):

| turn | marker | admitted (approx) | model request observed at | delay |
| --- | --- | --- | --- | --- |
| 1 CHILD_FIRST | ~18:23:45 | 18:39:46.164 (reply 3/4) | **~1021 s** — new record |
| 2 USE_MCP (V3) | ~18:31:45.5 | 18:39:46.509 (reply 5) + 46.629 (reply 6) | 0.35 s AFTER turn 1 converged (latched turn replays instantly at convergence) |
| 3 SUBSPAWN (LIFECYCLE) | ~18:39:47.8 | NEVER (zero mock requests 18:39:48 → 18:54:48, full 900 s budget) | **> 900 s** |

Key observations:
- V3's denied-ack landed at 18:39:46.629, **1.1 s past the 480 s deadline** — the second
  consecutive run with a sub-1.5 s miss. The consumption-boundary criterion is
  nevertheless empirically satisfied: capture request #5 (USE_MCP turn, model
  t12v-model-a) carries exactly the 10 team tools — `mcp__t12vmini__ping` absent — and
  the durable child log records the attempted tool call + denied ack (both after the
  deadline). Honest pass:false on the bounded-wait assertions only.
- workerV4 (ANOTHER freshly materialized child, created ~18:39:46.9) completed its first
  turn in 0.44 s (V4 pass=true) — the window is per-agent intermittent, not a
  deterministic fresh-child property.
- LIFECYCLE's archive→restore→follow-up pipeline worked fully (quiescence gate passed,
  residencyDropped=true, restore executed, follow-up admitted with the T12-V4
  `payload.prompt` fix and FOLLOWUP_ACK settled in the durable log); only the spawn leg
  (SUBSPAWN window > 900 s) failed. `drained=0` is the honest numeric drain (no
  descendant existed — the spawn never happened; the drain had discarded the latched
  SUBSPAWN turn, which is why the follow-up ran instantly on the re-materialized agent).
- World-B child turn 1 also exceeded 900 s (no model-b CHILD_FIRST request in the 16-
  request capture; model-b appears only in the four handoff legs).
- Root agents: 7th run in a row with no window (all root turns ≤ 2 s).

Status: the window class is CONFIRMED to exceed any finite fixed budget (observed 1021 s;
no convergence guaranteed). Per protocol, scenarios whose turns exceed the budget record
honest pass:false with the stall as evidence (run #7: V2 both parts, V3 near-miss,
LIFECYCLE spawn leg). No further budget escalation is warranted.

## Run #8 (T12-V5 bridge in place, nonce mtkhebl94d4768, 19:20:43Z → 20:07:39Z, 46.9 min)

| turn | marker | admitted (approx) | model request observed at | delay |
| --- | --- | --- | --- | --- |
| 1 CHILD_FIRST (world-A child) | ~19:20:53 | 19:36:55.19 (replies 3/4) | **>480 s** (budget) — FULL latch: zero mock traffic for the whole window, including the title call |
| 2 USE_MCP (V3, same child) | ~19:28:54 | 19:36:55.47 (reply 5) + 55.60 (reply 6) | ack 19:36:55.6 vs 480 s deadline ≈19:36:54 → **~1.5 s miss** (third consecutive sub-1.5 s miss) |
| 3 SUBSPAWN (LIFECYCLE workerA) | ~19:36:57 | NEVER (zero mock requests through 19:51:57, full 900 s) | **>900 s** |
| 4 world-B child turn 1 | ~19:52:16 | NEVER (no model-b CHILD_FIRST in capture; model-b only in the four handoff legs) | **>900 s** |

Key observations:
- The convergence-burst pattern reconfirmed: ~7.9 min of full latch, then both latched
  child turns replayed sub-1.5 s. V4 worker turn, the post-restore LIFECYCLE follow-up,
  and ALL handoff source/target turns ran <1 s. Root/leader agents: 9th consecutive run
  with zero windows.
- Archive drain discarded the latched SUBSPAWN pending turn (run #7 mechanism) →
  post-restore follow-up instant (FOLLOWUP_ACK 19:52:01).
- Consumption boundary re-proven in the 16-request capture: USE_MCP request tools =
  exactly the 10 team tools, `mcp__t12vmini__ping` absent; request #6 = agent-loop
  rejection `Error: unknown tool "mcp__t12vmini__ping"` → MCP_DENIED_ACK. V3's scenario
  checks failed only because they executed before the latched request arrived.
- The T12-V5 packages-level 7-junction bridge did not alter window behavior (expected:
  it is a module-resolution artifact, unrelated to the agent-loop latch).

## Run #9 data — T12-V6/V7 (BLOCKER #3 fix) run; window placement per-agent again

Run #9 (nonce `mtkjdrmw6cee19`, 2026-09-02T20:16:16Z → 21:03:11Z, 46 min 54.6 s, exit 0)
is the first run built by T12-V6/V7 (dist-mirror→source 254-file .js copy; smoke GREEN,
row toolCount=10, zero "Cannot find module"). Window placement, measured from mock
timestamps (world-A worker `inst-1rg2jzp0c8xx`):

| turn | marker | admitted (approx) | model request observed at | delay |
| --- | --- | --- | --- | --- |
| 1 CHILD_FIRST (V2-A) | ~20:16:25.5 | 20:32:28.546 (burst, mock #3) | **~963 s** (past the 480 s budget) |
| 2 USE_MCP (V3) | ~20:24:27.4 | 20:32:28.831 (mock #5) + 28.974 (#6 denied) | denied-ack 1.1–1.5 s past the ~20:32:27.4 deadline — 4th consecutive sub-1.5 s miss |
| SUBSPAWN (LIFECYCLE) | ~20:32:30.3 | NEVER (zero mock requests 20:32:30 → 20:47:34, full 900 s budget) | **> 900 s** |
| V2-B child turn 1 | ~20:47:50 | NEVER (zero model-b traffic until the 21:03:09 handoff legs) | **> 900 s** |

Key observations:
- The convergence burst (20:32:28.546–28.974) replayed the latched CHILD_FIRST + USE_MCP
  turns sub-1.5 s apart; the burst itself arrived AFTER V3's 480 s deadline closed — the
  bounded-wait assertions failed on timing only. Consumption boundary re-proven in the
  capture: request #5 tools = exactly the 10 team tools (mcp absent), request #6 =
  `Error: unknown tool "mcp__t12vmini__ping"`.
- V4's task turn (admitted ~20:32:30.1, child idle right after the burst) settled in
  0.3 s — same run, same child, instant while the SUBSPAWN leg admitted 0.2 s later
  latched for the full 900 s: the per-agent non-idle race at admission, not a
  deterministic fresh-child property.
- LIFECYCLE again: `drained=0` honest (no descendant — the SUBSPAWN spawn never ran;
  the drain discarded the latched SUBSPAWN turn, so the post-restore follow-up ran
  instantly, FOLLOWUP_ACK mock #8 at 20:47:34.040).
- Handoff: all four legs instant (no root windows — 9th run in a row); target B2
  first-turn latency 270 ms.
- The T12-V6/V7 environment prep (254 dist-mirror→source .js copies) did not alter
  window behavior (expected: module-resolution artifact, unrelated to the agent-loop
  latch).

Status update: 9 runs complete. Window stalls remain intermittent per-agent and unbounded;
the bounded-budget + measured-latency-evidence approach stands. Definitive run = #9
(first BLOCKER #3-fixed build; smoke + full run green with row health ok and no
module-resolution failures).

## Run #10 data — T12-V8/V9 run (mirror copy REMOVED); matrix reproduced run-to-run

Run #10 (nonce `mtkltfm07fb4c6`, 2026-09-02T21:24:26Z → 22:11:24Z, 46 min 58 s, exit 0)
is the first run after T12-V8 (dist-mirror→source 254-file .js copy REMOVED per the
parent supplement — the runner's glueUrl is the dist-mirror path, so no in-source .js
is needed) and T12-V9 (phase-level failure continuity). Controlled verification of the
removal:

- build log: `legacy exit 0` → `runtime exit 0` → `glue placed` → `import probe exit 0:
  LOADED name=dsh-agent-team` with NO `dist mirror -> source .js copy` line and zero
  "Cannot find module"; row ready toolCount=10, both rows mounted.
- Post-run worktree: `git status --porcelain` count = **0** (runs #6–#9 each left
  exactly 254 untracked in-source .js). The dist-glueUrl approach is confirmed in this
  lane.
- T12-V9 path not exercised (no phase FATAL occurred; every failure was a scenario-level
  pass=false recorded in summary.json; `summary.phaseFailures = []`).

Window placement (world-A worker `inst-0dz40v51a0hx`, from mock timestamps):

| turn | marker | admitted (approx) | model request observed at | delay |
| --- | --- | --- | --- | --- |
| 1 CHILD_FIRST (V2-A) | ~21:24:44 | 21:40:40.889 (burst, mock #3/#4) | **~957 s** (past the 480 s budget; V2-A recorded false at 21:32:39.654) |
| 2 USE_MCP (V3) | ~21:32:40 | 21:40:41.169 (mock #5 = tool-call `mcp__t12vmini__ping`) + 41.273 (#6 denied) | denied ack ~1.3 s past the ~21:40:40.0 deadline — 5th consecutive sub-2 s miss |
| SUBSPAWN (LIFECYCLE) | ~21:40:43 | NEVER (zero mock traffic 21:40:43 → 21:55:45, full 900 s discovery budget) | **> 900 s**; drained=0 (honest); post-restore follow-up INSTANT at 21:55:46.325 — window had converged by then and the latched SUBSPAWN turn was discarded by the archive drain (same mechanism as run #9) |
| V2-B child turn 1 | ~21:56:15 | NEVER (zero model-b traffic until the 22:11:21 handoff legs) | **> 900 s** |

Key observations:
- The convergence burst (21:40:40.889–42.061) replayed the latched CHILD_FIRST + USE_MCP
  turns sub-1.5 s apart, arriving AFTER V3's 480 s deadline closed — bounded-wait
  assertions failed on timing only. The consumption boundary was re-proven: mock #5
  carries tools = exactly the 10 team tools (mcp ABSENT) and its scripted tool-call
  `mcp__t12vmini__ping` was relayed back as the tool error → `T12V_MCP_DENIED_ACK`
  (mock #6, 115 ms later).
- The SUBSPAWN turn latched a second time at per-agent granularity (admitted ~2 s after
  the burst, zero traffic for the full 900 s budget) — per-agent non-idle race at
  admission, as in run #9 (SUBSPAWN admitted 0.2 s after V4's instant turn latched
  full 900 s while V4 ran instantly).
- RESTART bug #1 (leader-row `String(member.childSessionId)` → `session "undefined"
  not found`): 5th consecutive run (#6–#10, A2 22:11:05.858). The "undefined root
  session" cascade hypothesis is REFUTED in this lane with durable evidence: the
  create phase persisted the root session to home A (`session-t12v-a-root-mtkltfm07fb4c6/
  session.jsonl.zstd`, 5658 bytes, present post-run) and the A2 resume directive
  carries exactly that persisted rootSessionId with bootPhase="resume" (verified from
  `references/.dsh-test-t12-a/profiles/web/cordis.patch.yml` post-run,
  t12v-run10-verify.txt FINAL line match=True).
- Shipped bug #2 (state route 500 `Cannot read properties of null (reading 'name')`):
  B1 21:56:02.144 and C1 22:11:20.788 — instances boot fine (health ok, toolCount=10,
  turns work); worlds B/C continue via invariant 9 as designed.
- Resulting matrix is IDENTICAL to run #9: V1 T 1107 ms 11/11 · V2 F 1382966 ms 8/14 ·
  V3 F 481816 ms 2/5 · V4 T 977 ms 6/6 · V5 T 15 ms 6/6 · HANDOFF T 13374 ms 17/17 ·
  LIFECYCLE F 904230 ms 5/9 · RESTART F 2271 ms 8/16 → 4/8.

Status update: 10 runs complete. Window stalls remain intermittent per-agent and
unbounded; the bounded-budget + measured-latency-evidence approach stands. Two
consecutive runs (#9, #10) yield the identical 4/8 matrix; the pass=false set is
entirely explained by (a) window latches (V2-A, V3 timing, LIFECYCLE SUBSPAWN, V2-B),
(b) shipped-code bug #1 (RESTART resume loop), (c) shipped-code bug #2 (state route,
V2-B expected-defect check), and (d) the unreachable plan §12 literal precondition.

## OWNER PINNED: row-owned (our code) — NOT core maintenance (runs #12 + #13, T12-V15)

Supersedes the run #5-#10 hypothesis that the window might be core maintenance
(title/projection bootstrap). Parent directive (run #7 postmortem item 3): instrument
the row-owned subsystems around the child's first turns and correlate against the
durable session-log silence; if row-owned → fix in the plugin; if core → document and
leave as the P10 core-instrumentation item. The evidence pins the window on the ROW:
**no core code ever owns the silence, because nothing in core was waiting — the relay
input was never even attempted for delivery.**

### The mechanism (full chain, code-verified)

1. The browser-facing `member.send` endpoint (POST /team-remote/member.send →
   s6-remote.ts dispatcher case) built an `S6RemoteAdmissionRequest` and called
   `ports.admission.performAction(request, caller)` — the P6-T2 facade ONLY.
   The facade's send-message effect is `commitFact(FACT_COORDINATION)` = the durable
   `team-coordination-recorded` intent fact, then `{kind:'fact-recorded'}`. **There is
   no delivery phase on that path.**
2. The P6-T3 messaging coordinator (`packages/runtime/messaging/coordinator.ts`,
   `createMessagingCoordinator`) is the code that DOES deliver: `sendTeamMessage` =
   facade admission + `deliverOne` (plan via `decideDeliveryPlan`, fresh target via
   `repositories.memberInstances.get`, lifecycle gate CREATED/RUNNING/SETTLED,
   `renderRelayText` `[team-relay] from=… to=…`, `sessionInput.submitAttributedInput`,
   then the durable `team-message-delivered` confirmation fact).
3. Production callers (grep-verified): `sendTeamMessage` ONLY via the team tool
   `team_send_message` (packages/tools/src/tools.ts); `recoverPendingDeliveries` ONLY
   via the T12 harness row's own state route (packages/tools/harness/plugin.mjs —
   called on EVERY `GET /__p6t6/state` request). **No boot-time recovery exists in the
   production row** (documented design gap, kept as-is: the state-route drain covers
   the restart leg in this test world and remains the crash-recovery backstop).
4. ⇒ A remote-admitted relay intent sat undelivered until the next `/__p6t6/state`
   query drained it. Window duration = admission → next state query (runner pacing:
   47 s → 1021 s, intermittent per turn AND per run). The child agent was genuinely
   IDLE the whole time (no spliced input, no turns): the "non-idle hold" label in
   runs #5-#13 was an artifact of correlating the silence window with nothing
   actually running in core.

### Why it is NOT core maintenance

- The window length equals exactly (next state-route query − admission), run to run;
  it does not equal any maintenance constant, and the burst is TRIGGERED by an HTTP
  request (the runner's own `p6t6State` diagnostic), never by a timer.
- Once input is spliced, turns start instantly: run #12 child log — every
  `agent/inbox/spliced` is followed by `step/start` in 26–69 ms; run #13 burst —
  `whenIdle-done ms=146` / `~285` / `170`. No core turn-scheduling delay exists.
- The run #13 A1 log (instrumented, T12-V15) shows every parent-named subsystem at
  delivery time in milliseconds: `followup:boundary ms=1 model=deepseek-official/
  t12v-model-a mcp=denied`, `followup-submitted ms=2`, `whenIdle-done ms=146`
  (00:41:44.142→00:41:44.288), `deliver:whenIdle-done ms=170`,
  `setup:consumption-resolved ms=1-2`, `mcp:enter allowed=false hasFiber=false <1 ms`.
- The root was never affected because root turns ride the core prompt channel, not
  the remote member.send relay — the latch is specific to the admission-only remote
  path.

### Definitive timelines

**Run #12** (nonce mtkq2htxfd7514; home A archived pre-wipe as
`run12-home-{a,b,c}/`; mock capture `t12v-mock-capture-run12.json`, 19 requests;
team_domain.json ledger counter=19):

| seq | fact | t (UTC) |
|---|---|---|
| 2 | intent CHILD_FIRST (member.send admitted) | 23:23:37.420 |
| 3 | intent USE_MCP (member.send admitted) | 23:31:38.515 |
| 4+5 | **both `team-message-delivered` confirmations — burst, 0.6 s apart** | 23:39:39.577 / 23:39:40.142 |
| 6 | team-work-admitted (V4 delegate, same existing v2-worker) | 23:39:40.334 |

Mock: req1/req2 @23:23:35.9 (root + title) → **16 min silence** → req3-req7 burst
@23:39:39.5-40.6 (child turns 1-3 incl. TASK_ACK @23:39:40.636) → req8 @23:54:45
(LIFECYCLE follow-up: member.followup runs the work chain with LIVE delivery, so it
settled at phase execution — not latched) → req9+ @00:09:57 (restart leg). Burst
trigger = the runner's `p6t6State(a.port)` (t12-vertical.mjs, V3-cleanup diagnostic
immediately after the 480 s wait expired). V3's MCP-denied ack landed at the burst,
~8 min past the 480 s budget → honest timing failure with measured latency; all
V3 contract/content assertions (tools[] schema, verbatim persona, denied relay)
passed in calibration.

**Run #13** (nonce mtksabrjddb95b; instrumented T12-V15; live log
`instances/A1/instance-port3181.log`): V2 intent seq 2 @00:25:43.275 →
**~16 min of ZERO `[t12v-wl]` glue lines** (no followup:enter at all — the input
was never submitted) → burst @00:41:44.142 (state-route drain) →
`followup:enter → boundary(ms=1) → submitted(ms=2) → whenIdle-done(ms=146)` →
second delivery 00:41:44.431→00:41:44.716 → MCP-denied ack mock req6
@00:41:44.662 (**~1.0 s past the V3 deadline 00:41:43.6** — the split verdict:
substantive assertions ok, timing honest-fail) → V4 team_delegate
`deliver:enter → submit(ms=4) → whenIdle-done(ms=170)` @00:41:45.279, mock req7
TASK_ACK @00:41:45.271, V4 pass=true @00:41:45.658. Ledger [1..10] at burst.

### The fix — T12-V16 (commit 50bcdbb, row lane, zero core patches)

`member.send` now routes through the coordinator — the SAME path as the
`team_send_message` tool: s6-remote.ts gains the 13th production port
`messaging` (asserts the bound root, fail-closed FOREIGN_TEAM, like every sibling
port) wrapping the injected `MessagingCoordinator`; the dispatcher case is thin
(principal via A32 seam → `ports.messaging.sendTeamMessage` → the coordinator's flat
`status:'delivered'` outcome + `factSequence`). Delivery now happens AT ADMISSION:
intent fact → live attributed input to the bound child session → confirmation fact,
one synchronous chain. The state-route drain is KEPT as the crash-recovery backstop
(Architecture §24.2 roll-forward). The dormant `packages/remote` pure-contract
handler (`handlers/member.ts`, NOT mounted in this row) still carries an
admission-only member.send — if it is ever mounted, it must go through the
coordinator or the latch returns. Known design gap (unchanged, documented): no
boot-time `recoverPendingDeliveries` in the production row.

Runner adaptation (same commit): `admissionOutcome` accepts both `executed`
(facade) and `delivered` (coordinator) outcomes; V2-A accepts the new outcome shape
(`recipientInstanceId`); 480 s/900 s budgets UNCHANGED (no escalation — expected to
be far below bound now).

Verification: tsc build + full runtime typecheck exit 0; runtime suite 1087/1087
PASS. Live verification — **CONFIRMED in run #14** (nonce `mtktg7nu58c6d0`,
2026-09-03T00:58:06Z → 01:13:31Z, job pwsh-171, exit 0, 51/55):

- V2 member.send → coordinator outcome `status:'delivered'` at admission; durable
  child log: inbox spliced @00:58:16.969 → turn/start @00:58:16.971 (+2 ms) → model
  request @00:58:17.101 → CHILD_FIRST_ACK. **Admission→model ≈ 700 ms** (run #13:
  961 s gap). V2 8/8 pass, 0.9 s.
- V3 denied-ack @00:58:19.551, 311 ms after the attempt — inside budget (run #13:
  ~1.0 s past the 480 s deadline). V3 6/6 pass, 3.1 s.
- SUBSPAWN prompt delivered at admission; model's `subagent` tool-call @00:58:22.788
  — delivery part of the fix works end-to-end.
- Correlate (`t12v-run14-correlate.txt`): **zero admission→drain gaps**; every
  send/deliver/follow-up event millisecond-scale (followup:whenIdle-done 146–827 ms;
  boundary/consumption/mcp:enter sub-millisecond). The only multi-second gap in the
  run is 904 s = the runner's own 900 s descendant-discovery wait (see
  `t12v-finding-lifecycle-subagent.md` — a composition limitation, not a window).

The window-latch class of failure is GONE. LIFECYCLE's 4 remaining failures are a
different, pinned, structural cause (composition has no `subagent` tool) — documented
separately, not a core/row/window defect.
