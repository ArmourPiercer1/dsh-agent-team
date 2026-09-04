# T12 vertical run #11 monitoring (nonce mtkob35v2077d6)

Launched 2026-09-02T22:34:09Z (UTC) as background job pwsh-162 from worktree T12-V
(`node packages/tools/harness/t12-vertical.mjs`, no args — default phases
build,fresh1,fresh2,restart1,handoff). First run with all three parent-iteration fixes live.

## Pre-run bracket (all green)

- git T12-V: HEAD de2c0a3 (T12-V12); 65e1982 (T12-V11); 952b003 (T12-V10); porcelain empty.
- run.mjs vs base 62c7c81: no diff (byte-identical invariant holds).
- test-use: head cd5ef8148158c3a752a658978873241fdf8e2bbc, status empty, diff empty.
- ports free pre-run: 3496/3492/3181/3182/3183/3184 (raw TCP probe: all closed); :3080 OPEN.
- homes .dsh-test-t12-a/b/c wiped to ABSENT (run #10 logs discarded; derived run #10 evidence
  complete in this dir). Runner re-asserted "fresh homes A/B/C" at boot.
- run #10 artifacts snapshotted before overwrite: t12v-summary-run10.json,
  t12v-mock-capture-run10.json, t12v-state-run10.json.
- t12v-run.log offset at run #11 start: byte 42431 (runner self-logs; run #11 lines start
  at [2026-09-02T22:34:09.476Z]).

## Fixes under test (deltas vs run #10)

1. T12-V10: A2 resume boot must succeed (leader-row childSessionId guard). RESTART assertions
   genuinely evaluated (was: 7x "not evaluated — A2 resume boot failed").
2. T12-V11: world-B/C state route well-formed for mcpServer:null (was: deterministic 500).
3. T12-V12/V13: deferred calibration checks (V2-A persona/model, V2-B model-b, V3
   attempt/denial/schema) evaluated against FINAL mock capture + durable logs; V5 asserts
   schemaVersion === 2 strictly (P8-S contract freeze).

## Timeline

| time (UTC) | event |
| --- | --- |
| 22:34:09 | runner start; pre-flight green (3080=200, test-use pristine, ports free, fresh homes) |
| 22:34:09 | mock up 3496; mini-MCP up 3492 |
| 22:34:09–12 | build: legacy exit 0, runtime exit 0, glue byte-identical, import probe LOADED name=dsh-agent-team |
| 22:34:18 | A1 row ready toolCount=10; rowMounted dsh-agent-team+p6t6-team-tools |
| 22:34:19 | V1 pass=true |
| 22:42:21 | V2 (world A part) pass=false — 480 s deadline (latch inline again) |
| 22:50:22 | latched V2-A child turn settles (reqs 3-4: title + CHILD_FIRST) ~481 s past deadline |
| 22:50:23 | V3 sequence completes: req5 = real mcp__t12vmini__ping tool-call, req6 = denial-relay ack; V3 pass=false (denied-ack 2.2 s past 480 s deadline) |
| 22:50:24 | V4 pass=true (req7 TASK) |
| 23:05:28 | LIFECYCLE req8 FOLLOWUP settles ~4 s past 900 s deadline; LIFECYCLE pass=false (SUBSPAWN latched full window — no descendant created); V5 pass=true (strict schemaVersion===2) |
| 23:05:28–33 | A1 stopped; B1 profile via throwaway boot; B1 row ready toolCount=10 |
| 23:05:43 | B1 state route 500 — NEW error "Cannot read properties of null (reading 'allowed')" (T12-V11 fixed the first deref; second one at views.mcpView.allowed — T12-V14) |
| 23:20:45 | V2 (world B part) pass=false — 900 s, zero model-B traffic (latch); fresh2 done |
| 23:20:47 | A2 resume boot: row ready toolCount=10 — **T12-V10 VERIFIED** (no setupError); req10 = subagent tool-call (latched LIFECYCLE SUBSPAWN turn RE-DRIVEN on resume of the member child session), req11 title, req12 RESTART_ACK |
| 23:20:48 | A2 stopped; RESTART pass=false (14/15 — only the constructionally-unreachable literal precondition fails) |
| 23:20:50–53 | C1 profile via throwaway boot; row ready toolCount=10 |
| 23:21:03 | C1 state route 500 (same 'allowed' deref — consistent old code in this run) |
| 23:21:03–06 | handoff legs req13-20 (4x title+HANDBACK across model-b/model-c); :3080 post 200; capture dumped (20 reqs); summary written; runner done exit 0 |

## Expectations

- Shipped-runtime window latch is INTERMITTENT at run and per-agent level (10 prior runs).
  Latency assertions stay deadline-bound → honest pass:false if a turn latches past deadline.
- If a latched turn settles late (as in run #10: burst ~957 s), the deferred content checks
  now PASS where run #10 reported system texts=[] / model=undefined / tools=[].
- No budget escalation this run (parent directive: honest results).

## Post-run (filled at settlement 23:21Z)

**Matrix (run #11 vs run #10): 4/8 scenarios, 74/84 assertions (was 4/8, 63/84).**
Full per-assertion dump: t12v-run11-all.txt. Run #10 artifacts snapshotted as
t12v-summary-run10.json / t12v-mock-capture-run10.json / t12v-state-run10.json.

| scenario | run #11 | run #10 | notes |
| --- | --- | --- | --- |
| V1 | 11/11 PASS | 11/11 | stable |
| V2 | 10/14 | 8/14 | +2: deferred [A] persona + [A] model now PASS (latched turn settled late, full capture); fails: [A] 480 s latency, [B] state route (T12-V14), [B] 900 s latency, [B] model-b (turn never reached mock — honest) |
| V3 | 5/6 | 2/5 | +3: all deferred content checks PASS (log records mcp attempt; model attempted tool + agent loop relayed the denial via tool result; model-boundary tool schema omits the mcp tool, full 10-schema verbatim); fail: 480 s latency (denied-ack 2.2 s past deadline) |
| V4 | 6/6 PASS | 6/6 | stable |
| V5 | 6/6 PASS | 6/6 | now under STRICT schemaVersion === 2 (P8-S contract freeze) — production projection stamps 2; NO contract contradiction |
| HANDOFF | 17/17 PASS | 17/17 | stable |
| LIFECYCLE | 5/9 | 5/9 | SUBSPAWN latched full 900 s (no descendant); dependent origin/ack/drain fail honestly (drained=0 is a genuine numeric, quiescence gate respected) |
| RESTART | 14/15 | 8/16 | A2 resume boot SUCCEEDED (T12-V10 verified); 14 assertions genuinely evaluated and pass (no duplicate Agent/Team/member, projection resumes, same member instance/child session); sole fail = plan §12 LITERAL precondition (same instanceId under a different root) — unreachable by construction (identity.ts L289-298 bakes rootSessionId into the instance spec) |

**Calibration verdict on run #10's "system texts=[] / model=undefined / tools=[]":**
confirmed as deadline-timed-lookup artifacts, not production-wiring gaps. Run #11 req3 (the
CHILD_FIRST child turn) carries verbatim: model=t12v-model-a, system prompt 1789 chars
including "T12V worker persona world A", tools = full 10-scheme array with function
{name, description, parameters} objects (no truncation anywhere; max message content
1789 chars). The deferred checks now read the FINAL capture — they PASS when the latched
turn eventually settles and fail with an explicit "never settled" detail when it does not.

**New finding (evidence for the report):** on A2 RESUME (world A restart), the member child
session's latched SUBSPAWN turn from fresh1 (request that never completed before A1 was
stopped at 23:05:28) was RE-DRIVEN by the resumed agent: req10 at 23:20:47.463Z answered
`subagent` tool-call. Durable session state survives instance stop/restart and the resumed
agent loop continues the pending tool-call turn.

**State-route second deref (T12-V14):** T12-V11 removed the first null deref
(config.mcpServer.name); the route then 500d at views.mcpView.allowed (L441) — with
mcpServer:null the views object exists but mcpView is null. Guarded in T12-V14 (9ef78ca);
live verification = run #12.

**Post bracket (all green):** git T12-V porcelain empty (HEAD 9ef78ca incl. T12-V14),
run.mjs byte-identical vs base 62c7c81, test-use pristine cd5ef81481 (status+diff empty),
:3080 post 200, all T12 ports closed (sweep clean), capture 20 requests.
