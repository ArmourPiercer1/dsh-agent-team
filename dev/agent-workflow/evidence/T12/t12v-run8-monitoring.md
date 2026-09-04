# T12 run #8 monitoring (T12-V5: packages-level 7-junction bridge)

- Job: pwsh-157, `--phases build,fresh1,fresh2,restart1,handoff`, cwd T12-V root.
- Prereqs verified pre-launch: homes a/b/c empty; ports 3181-3184/3496/3492 free (raw TCP probe); :3080 LISTENING; test-use head cd5ef814 clean; T12-V5 committed (5a2bbe1).
- Smoke (pwsh-156) GREEN: row ready toolCount=10; no setupError / ERR_MODULE_NOT_FOUND / Cannot find package (instance log + run log); state boot=1 phase=create members=["inst-leader"]; prompt accepted:true; root turn settled ~1.1 s; mock models=["t12v-model-a"]; HOME_A reset; test-use post clean; :3080 200.
- Budgets: standard 480 s; 900 s at LIFECYCLE descendant discovery, LIFECYCLE descAck, V2-B childAck. Hang rule: silence > worst-case-remaining + 3 min → kill + t12v-hang-run8.log.

## Timeline
| t (UTC) | event |
| --- | --- |
| 19:20:10Z | smoke start (pwsh-156) |
| 19:20:19Z | smoke GREEN: row ready toolCount=10; no setupError / module errors; prompt accepted; root turn ~1.1 s; HOME_A reset; exit 0 |
| 19:20:43Z | run #8 start (pwsh-157, nonce mtkhebl94d4768); both bridges verified in env setup |
| 19:20:51Z | A1 row ready toolCount=10, rowMounted true (boot ~4 s) |
| 19:20:52Z | V1 pass=true (root turn ~1 s) |
| 19:28:53Z | V2 (world A) pass=false — childAck hit the 480 s budget; ZERO mock requests the whole window (full latch, no title call either) |
| 19:36:55Z | window convergence burst ~7.9 min later: mock #3/#4 = latched CHILD_FIRST turn 1; mock #5 tool-call mcp__t12vmini__ping + #6 MCP_DENIED_ACK = latched USE_MCP turn → V3 pass=false (ack 19:36:55.6 vs 480 s deadline ≈19:36:54 — ~1.5 s near-miss, same class as run #7) |
| 19:36:56Z | V4 pass=true (TASK_ACK 0.45 s after convergence — instant replay pattern) |
| 19:36:57–19:51:57Z | LIFECYCLE SUBSPAWN leg: full 900 s discovery budget, ZERO mock requests (latched spawn turn — 4th run with a spawn-leg stall); no descendant |
| 19:52:01Z | LIFECYCLE pass=false (5/9); archive drain discarded the latched pending turn → post-restore FOLLOWUP_ACK instant (mock #8); V5 pass=true |
| 19:52:01Z | A1 stopped (runRestart1) |
| 19:52:06Z | B1 (world B) row ready toolCount=10 |
| 19:52:16Z | B1 state route 500 `Cannot read properties of null (reading 'name')` — shipped BUG #2 (plugin.mjs L433 mcpServer:null); recorded as evidence, continuing via invariant 9 (expected) |
| 20:07:18Z | V2 (world B part) pass=false — childAck missing after 900 s (full latch again); world B left alive for handoff |
| 20:07:21Z | A2 booted web-server-wise; row setup failed `setupError: session "undefined" not found` → RESTART pass=false (shipped BUG #1, 3rd consecutive run) |
| 20:07:26Z | C1 (handoff source world) row ready toolCount=10; state 500 (same BUG #2, world C) → invariant 9 |
| 20:07:36–39Z | handoff legs instant: C1 source HANDBACK_ACK (mock #10) + B1 target (mock #11+); B source + B2 target (mock #13–16) |
| 20:07:39Z | run #8 done, exit 0; mock capture 16 requests; summary written; test-use post clean; :3080 post 200 |

## Final tally (run #8 = definitive run)
V1 TRUE 1074ms 11/11 · V2 FALSE 1383234ms 8/14 · V3 FALSE 482041ms 2/5 · V4 TRUE 852ms 6/6 · V5 TRUE 29ms 6/6 · HANDOFF TRUE 13281ms 17/17 · LIFECYCLE FALSE 904943ms 5/9 · RESTART FALSE 3657ms 8/16 → 4/8 pass, identical classes to run #7, all honest with durable evidence.

## Windows observed (run #8)
- world-A child (worker): turn 1 (CHILD_FIRST) latched >480 s (zero mock traffic incl. title call); turn 2 (USE_MCP) latched too; both replayed ~19:36:55, sub-second each. Same per-agent intermittency as run #7.
- world-A LIFECYCLE workerA: SUBSPAWN turn latched the full 900 s (zero mock traffic); archive drain discarded it; post-restore follow-up instant.
- world-B child: first turn latched >900 s (V2-B).
- root agents (A1, B1, C1) + V4 worker + handoff sources/targets: instant, zero windows — 9th consecutive run with no root window.

## Consumption-boundary proof (V3, from the 16-request capture)
- USE_MCP request tools = exactly the 10 team tools (`team_create_member, team_delegate, team_follow_up, team_inspect_config, team_list_members, team_list_templates, team_report_progress, team_request_control, team_resolve_control, team_send_message`); `mcp__t12vmini__ping` ABSENT.
- Request #6: agent-loop rejection `Error: unknown tool "mcp__t12vmini__ping"` → MCP_DENIED_ACK. Denial empirically at the consumption boundary (V3 scenario check failed only on timing: the latched request arrived after the 480 s check window).
