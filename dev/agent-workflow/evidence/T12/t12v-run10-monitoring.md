# T12 run #10 monitoring (T12-V8 mirror-copy removal + T12-V9 phase continuity)

Run #10 (nonce `mtkltfm07fb4c6`, 2026-09-02T21:24:26Z → 22:11:24Z, 46 min 58 s, exit 0,
phases build,fresh1,fresh2,restart1,handoff) is the first full chain after the parent
supplement was applied: T12-V8 `ed56641` (dist-mirror→source 254-file .js copy REMOVED
from `buildProductionRuntime`; `relative` import pruned; the 254 untracked in-source .js
files deleted from the worktree) and T12-V9 `b125c06` (phase-level failure continuity:
per-phase try/catch → `summary.phaseFailures` + `t12v-phase-failures.json`, chain
continues; runner no longer writes `t12v-blocker.md`).

## Parent-supplement controlled checks

1. **Mirror-copy removal (item 1)** — VERIFIED in this lane:
   - build log (t12v-build-dist.log, 21:24:26.766 → 21:24:30.108): `legacy exit 0` →
     `runtime exit 0` → `glue placed` → `import probe exit 0: LOADED
     name=dsh-agent-team`. NO `dist mirror -> source .js copy` line; zero "Cannot find
     module"; A1 row ready toolCount=10, both rows mounted.
   - Post-run `git status --porcelain` count = **0** (runs #6–#9 each left 254 untracked
     in-source .js after the build).
   - glueUrl on disk (home A patch L4) =
     `file:///.../.worktrees/T12-V/packages/runtime/dist/packages/runtime/src/plugin/host.js`
     — the dist-mirror path, as the parent's "your dist-glueUrl approach works" assumed.
2. **Phase continuity (item 4)** — implemented; NOT exercised this run: no phase FATAL
   occurred, `summary.phaseFailures = []`, exit 0. All 8 scenarios reached and recorded
   (full matrix).
3. **Create-phase persistence + resume discovery (item 3)** — VERIFIED in this lane:
   - Root session persisted to home A during the create phase:
     `references/.dsh-test-t12-a/sessions/--C-agent-team-work-t12v-a--/session-t12v-a-root-mtkltfm07fb4c6/session.jsonl.zstd`
     (5658 bytes, present post-run; t12v-run10-verify.txt).
   - A2 resume directive (final state of `profiles/web/cordis.patch.yml` in home A):
     `rootSessionId: "session-t12v-a-root-mtkltfm07fb4c6"`, `bootPhase: "resume"` —
     exactly the persisted root (FINAL comparison match=True; undefinedPresent=False).
     The "undefined rootSessionId cascade" does NOT occur in this lane; the RESTART
     failure is the shipped leader-row bug (below), 5th consecutive run.

## Timeline (all UTC)

- 21:24:26 pre-flight: :3080 200; test-use pristine (cd5ef814…); all 6 ports free;
  fresh homes A/B/C asserted; junction bridges verified (5+1 runtime, 7 packages);
  mock on 3496; mini-MCP on 3492.
- 21:24:26.7 → 21:24:30.1 build (T12-V8 shape, see above).
- 21:24:37 A1 booted (3181), row ready toolCount=10. Mock #1 title (DEFAULT_ACK) +
  #2 ROOT_FIRST_ACK. **V1 pass=true** 21:24:38.128 (1107 ms).
- 21:24:44 V2-A member created (worker `inst-0dz40v51a0hx`); child first turn (CHILD_FIRST)
  admitted — LATCHED (zero mock traffic until the 21:40:40.889 burst).
- 21:32:39.654 **V2 (world-A part) pass=false** (`<ack not in child log within 480s>`).
- 21:32:40 V3: override.set (external hard DENY, mcpServer t12vmini) + member.send
  `T12V_USE_MCP_mtkltfm07fb4c6` admitted — LATCHED behind the same window.
- **21:40:40.889 → 21:40:42.061 convergence burst**: mock #3 title + #4 CHILD_FIRST_ACK
  (latched V2-A turn replayed), #5 = scripted TOOL-CALL `mcp__t12vmini__ping` (tools on
  #5 = exactly the 10 team tools, mcp ABSENT), #6 MCP_DENIED_ACK (115 ms after #5),
  #7 TASK_ACK.
- 21:40:41.471 **V3 pass=false** — denied ack #6 arrived ~1.3 s past the ~21:40:40.0
  480 s deadline (5th consecutive sub-2 s miss). Consumption boundary re-proven from
  the capture anyway.
- 21:40:42.449 **V4 pass=true** (977 ms; exact task text `T12_VERTICAL_TASK_mtkltfm07fb4c6`
  in the real child log; durable truth settled).
- 21:40:43 LIFECYCLE: SUBSPAWN turn (scripted `subagent` tool-call) admitted — LATCHED
  again (per-agent race, ~2 s after the burst). Descendant discovery: full 900 s budget,
  zero mock traffic, no descendant session.
- 21:55:45–21:55:46 archive (drained=0 — honest numeric; the latched SUBSPAWN turn was
  discarded by the drain) → restore → post-restore follow-up INSTANT: mock #8
  FOLLOWUP_ACK 21:55:46.325. **LIFECYCLE pass=false** 21:55:46.680 (5/9; the 4 fails =
  descendant trio + honest drained>=1).
- 21:55:46 **V5 pass=true** (15 ms; projection via the browser-facing public Remote,
  6/6). A1 stopped.
- 21:55:48 → 21:55:51 world B: throwaway profile boot (3183), B1 row ready toolCount=10.
- 21:56:02.144 **shipped bug #2** (B1 state route 500 `Cannot read properties of null
  (reading 'name')`) — recorded as evidence, continuing via invariant 9 (by design).
- 21:56:15 V2-B child first turn admitted — LATCHED (zero model-b traffic until the
  22:11:21 handoff legs).
- 22:11:03.585 **V2 pass=false** (8/14; the [B] child-turn + effective-model checks
  missed the 900 s budget; the [B] state-route check = the expected-defect assertion).
- 22:11:03.595 A2: "profile already initialized"; directive boot=2 phase=resume written
  (rootSessionId = persisted root, see controlled check 3).
- 22:11:05.666 A2 booted (3182) → **RESTART pass=false** 22:11:05.858: **shipped bug
  #1, 5th consecutive** — `setupError: session "undefined" not found` (leader-row
  `String(member.childSessionId)` with no structural guard). 8/16: the 8 no-collision
  invariants hold; 7 resume checks "not evaluated" + the unreachable plan §12 literal
  precondition recorded.
- 22:11:07 → 22:11:10 world C: throwaway profile boot (3184), C1 row ready toolCount=10.
- 22:11:20.788 **shipped bug #2** (C1 state route 500, same message) — recorded,
  continuing via invariant 9.
- 22:11:21.058 → 22:11:24.036 handoff: all four legs instant — mock #9/#10 (source C1,
  model-c), #11/#12 (leg-1 target, minted on the C instance, model-c), #13/#14 (source
  B, model-b), #15/#16 (leg-2 target, minted on the B instance, model-b).
- 22:11:24.105 **HANDOFF pass=true** (13374 ms, 17/17; prepare1CarriesC=true,
  prepare2CarriesC=true; same requestToken X from different sources → different target
  identities).
- 22:11:24 C1 stopped, B1 stopped; test-use post pristine (cd5ef814…, statusEmpty,
  diffEmpty); :3080 post 200; mock capture dumped (16 requests); mini + mock closed;
  summary written; exit 0.

## Final tally (run #10 — matrix identical to run #9)

| scenario | pass | durationMs | checks | notes |
| --- | --- | --- | --- | --- |
| V1 | **true** | 1107 | 11/11 | root session file + leader + zero synthetic members |
| V2 | false | 1382966 | 8/14 | A: 480 s window latch (burst replayed post-deadline); B: bug #2 expected-defect check + 900 s window latch |
| V3 | false | 481816 | 2/5 | denied ack ~1.3 s past deadline (5th consecutive); boundary proven by capture req #5/#6 |
| V4 | **true** | 977 | 6/6 | exact task text in real child log; durable truth settled |
| V5 | **true** | 15 | 6/6 | projection via browser-facing public Remote |
| HANDOFF | **true** | 13374 | 17/17 | all four legs instant; B5 composite holds |
| LIFECYCLE | false | 904230 | 5/9 | SUBSPAWN latched >900 s (zero traffic); drained=0 honest; post-restore follow-up instant |
| RESTART | false | 2271 | 8/16 | shipped bug #1 (5th consecutive) + unreachable §12 literal precondition; 8 no-collision invariants hold |

→ 4/8 pass. modelPath = mock-env (fallbackUsed=false, baseUrl
http://127.0.0.1:3496). port3080 pre/post = 200/200. testUsePristine = true.
phaseFailures = [] (T12-V9 path not needed this run).

## Windows observed (run #10)

| site | admitted | observed | class |
| --- | --- | --- | --- |
| V2-A child turn 1 | ~21:24:44 | 21:40:40.889 (burst) | full latch ~957 s > 480 s budget |
| V3 USE_MCP | ~21:32:40 | 21:40:41.169/41.273 (burst) | sub-2 s deadline miss |
| LIFECYCLE SUBSPAWN | ~21:40:43 | never (900 s budget, zero traffic) | full latch >900 s; discarded by archive drain |
| V2-B child turn 1 | ~21:56:15 | never (until 22:11:21 handoff legs) | full latch >900 s |

Root agents: 10th consecutive run with zero windows (V1 root 1.1 s; all handoff legs
≤270 ms first-turn).

## Consumption-boundary proof (V3, from the 16-request capture — t12v-run10-capture.txt)

- req #5 (21:40:41.169): model=t12v-model-a, msgs=5, tools = exactly the 10 team tools
  (`team_create_member, team_delegate, team_follow_up, team_inspect_config,
  team_list_members, team_list_templates, team_report_progress, team_request_control,
  team_resolve_control, team_send_message`) — **mcp ABSENT**; lastUser = the relayed
  `T12V_USE_MCP_…` request; **reply = tool-call `mcp__t12vmini__ping`** (scripted per the
  brief's script-table design).
- req #6 (21:40:41.273): the tool error relayed back → `T12V_MCP_DENIED_ACK`. The
  external hard DENY held at the actual consumption boundary (the model was handed no
  mcp tool, and the attempt was rejected in the real runtime).

## Artifacts

- t12v-run10-tally.txt, t12v-run10-capture.txt, t12v-run10-verify.txt (+
  t12v-capture-decode10.mjs, t12v-verify10.mjs)
- summary.json (run #10), t12v-run.log (run #10 = tail), t12v-build-dist.log,
  t12v-smoke/fresh1/fresh2/restart1/handoff-lifecycle logs, t12v-mock-capture.json
  (16 requests), t12v-state.json, t12v-testuse-pre/post.txt, t12v-port3080-pre/post.txt,
  instances/{A1,A2,B1,C1,SMOKE}/…
- NOTE: the run #9 raw DSH_HOME session logs (references/.dsh-test-t12-a|b|c) were wiped
  before run #10 (fail-closed freshness requirement). A pre-wipe archive attempt failed
  (Compress-Archive -LiteralPath misuse — relative names, not FullNames), so the raw
  run #9 zstd session logs were not preserved; all DERIVED run #9 evidence (tally,
  capture decode, monitoring timeline with extracted latencies, boot logs under
  instances/, summary.json, mock capture) remains intact in this directory. Run #10 raw
  homes are now in place (re-wipe before any run #11).
