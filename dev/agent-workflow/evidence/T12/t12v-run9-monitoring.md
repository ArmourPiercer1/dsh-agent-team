# T12 run #9 monitoring (T12-V6/V7: BLOCKER #3 dist-mirror→source .js copy)

- Smoke: pwsh-159 (T12-V7, nonce mtkjcq2t8d04b7), 20:15:27 → 20:15:37 UTC, exit 0 GREEN.
  - `== dist mirror -> source .js copy: 254 files ==` (20:15:29.983); import probe `LOADED name=dsh-agent-team` (20:15:30.774).
  - SMOKE row ready toolCount=10 (20:15:36.428); no setupError, no module errors anywhere.
  - state boot=1 phase=create root=session-t12v-a-root-mtkjcq2t8d04b7 members=["inst-leader"]; prompt accepted; root turn settled ~1.03 s (20:15:36.489 → 20:15:37.517, ack in durable root log).
  - mock models=["t12v-model-a"] requests=2; HOME_A reset; test-use post pristine; :3080 200.
- Full run: pwsh-160 (nonce mtkjdrmw6cee19), `--phases build,fresh1,fresh2,restart1,handoff`, 20:16:16.424 → 21:03:11.003 UTC (46 min 54.6 s), exit 0.
- Prereqs verified pre-launch: homes a/b/c empty; ports 3181-3184/3496/3492 free (raw TCP probe); :3080 LISTENING; test-use pre head cd5ef8148158c3a752a658978873241fdf8e2bbc statusEmpty=true diffEmpty=true; T12-V7 committed (9db339a).
- Budgets: standard 480 s; 900 s at LIFECYCLE descendant discovery, LIFECYCLE descAck, V2-B childAck. Hang rule: silence > worst-case-remaining + 3 min → kill + t12v-hang-run9.log. No hang; every silence was an in-budget latch window.

## Timeline (all UTC)
| t | event |
| --- | --- |
| 20:16:16.424 | run #9 start; homes asserted; bridges verified (runtime + packages 7-link); mock 3496 + mini 3492 up |
| 20:16:16.588–18.764 | build: legacy exit 0, runtime exit 0, glue placed, **254 dist-mirror→source .js copied** |
| ~20:16:18.9 | import probe `LOADED name=dsh-agent-team` |
| 20:16:24.411 | A1 row ready toolCount=10, rowMounted (boot ~5.6 s) |
| 20:16:24.676 | mock #1 V1 root turn (tools=10 team tools) + #2 title |
| 20:16:25.520 | **V1 pass=true** (1106 ms, 11/11) |
| 20:16:25 → 20:24:25 | V2-A childAck 480 s window: ZERO mock traffic (full latch, no title call either) |
| 20:24:27.226 | V2 (world A part) pass=false; V3 override.set updatedAt 20:24:27.239; member.send admitted ~20:24:27.4 (480 s deadline ~20:32:27.4) |
| 20:32:28.546–28.974 | **convergence burst** (~1.1–1.5 s past the V3 deadline): mock #3 CHILD_FIRST turn 1 + #4 title + #5 tool-call mcp__t12vmini__ping + #6 MCP_DENIED_ACK |
| 20:32:29.168 | V3 pass=false (481941 ms, 2/5) — sub-1.5 s miss, 4th consecutive run |
| 20:32:29.501 | mock #7 V4 TASK turn (child idle after burst) → 20:32:30.105 **V4 pass=true** (937 ms, 6/6) |
| ~20:32:30.3 | LIFECYCLE SUBSPAWN admitted → child non-idle at admission → latched; ZERO mock traffic for the full 900 s |
| 20:47:34.040 | mock #8 post-restore FOLLOWUP_ACK (archive discarded the latched SUBSPAWN turn → follow-up instant on re-materialized agent) |
| 20:47:34.351 | LIFECYCLE pass=false (904246 ms, 5/9; drained=0 honest) |
| 20:47:34.373 | **V5 pass=true** (22 ms, 6/6) — projection via public /team-remote |
| 20:47:34.412 | A1 stopped (portFree) |
| 20:47:35.988–37.866 | B1 (world B, 3183) throwaway boot + profile + boot |
| 20:47:39.091 | B1 row ready toolCount=10 |
| 20:47:49.167 | B1 state route 500 `Cannot read properties of null (reading 'name')` — SHIPPED-CODE BUG #2 (mcpServer:null); evidence recorded, invariant 9 continues |
| ~20:47:50 → 21:02:50 | V2-B childAck 900 s window: latched, ZERO mock traffic (no model-b request in the capture between 20:47 and 21:03) |
| 21:02:50.848 | V2 pass=false (1383385 ms total, 8/14) |
| 21:02:50.865–52.687 | A2 (3182) profile already initialized; directive boot=2 phase=resume; booted |
| 21:02:52.855 | RESTART pass=false (2005 ms, 8/16) — `setupError: session "undefined" not found` (SHIPPED-CODE BUG #1, agent-bindings.mjs L883-890) + precondition-unreachable by construction (identity.ts L289-298) |
| 21:02:52.856–56.300 | C1 (world C, 3184) throwaway boot + profile + boot |
| 21:02:57.448 | C1 row ready toolCount=10 |
| 21:03:07.528 | C1 state route 500 (bug #2, world C) — evidence recorded |
| 21:03:07.830–07.831 | mock #9/#10: handoff source C1 turn (HANDBACK_ACK) + title — root idle, instant |
| 21:03:09.055–09.056 | mock #11/#12: target B1 root first turn (context C carried; prepare1CarriesC=true) on the source's own instance (model t12v-model-c) + title |
| 21:03:09 | mock #13/#14: second-source world-B root first turn + title (model t12v-model-b) |
| 21:03:10.211/481 | target B2 admitted 21:03:10.211 → first turn/start 21:03:10.481 (**latency 270 ms**); mock #15/#16 at 21:03:10.696/.699 |
| 21:03:10.784 | **HANDOFF pass=true** (13335 ms, 17/17) — same requestToken X from different sources ⇒ different minted targets B1 ≠ B2 (prepare2CarriesC=true, create2 completed, contextToken handoff-ctx-8c9245e6…) |
| 21:03:10.821–10.855 | C1 stopped, B1 stopped (portFree both) |
| 21:03:10.998 | test-use post pristine; :3080 post 200; mock capture dumped (16 requests) |
| 21:03:11.003 | summary written; exit 0 |

## Final tally (run #9 = definitive run for T12-V6/V7)
| scenario | pass | durationMs | checks | verdict |
| --- | --- | --- | --- | --- |
| V1 | **TRUE** | 1106 | 11/11 | fresh Root, real DSH Agent, durable TeamSession |
| V2 | FALSE | 1383385 | 8/14 | V2-A 480 s full-latch (zero traffic); V2-B 900 s latch + state-route 500 = expected shipped defect (bug #2) |
| V3 | FALSE | 481941 | 2/5 | convergence burst 1.1–1.5 s past 480 s deadline; consumption boundary PROVEN in capture (below); mcpDiag deny cell exact |
| V4 | **TRUE** | 937 | 6/6 | delegated task text reached real child log, turn settled |
| LIFECYCLE | FALSE | 904246 | 5/9 | SUBSPAWN leg latched >900 s (zero traffic) ⇒ no descendant ⇒ drained=0 (honest); archive/restore/post-restore follow-up all real and green |
| V5 | **TRUE** | 22 | 6/6 | projection through browser-facing public Remote only |
| HANDOFF | **TRUE** | 13335 | 17/17 | all four legs instant (no windows on root agents, 9th run in a row); token X ⇒ distinct targets |
| RESTART | FALSE | 2005 | 8/16 | two documented divergences: precondition unreachable by construction; A2 resume boot `session "undefined"` setupError (bug #1) |

→ 4/8 pass (V1, V4, V5, HANDOFF) — same shape as run #8. modelPath mock-env (fallbackUsed=false); port3080 {pre:200, post:200}; testUsePristine pristine=true both brackets.

## Windows observed (run #9)
| site | window | outcome |
| --- | --- | --- |
| V2-A child turn 1 | full latch >480 s, ZERO traffic (incl. title) | converged in the 20:32:28 burst (8 min after V2's budget expired) |
| V3 USE_MCP turn | latched behind the same window | burst 20:32:28.546–28.974; denied-ack 1.1–1.5 s past the ~20:32:27.4 deadline |
| V4 task turn | none (child idle after burst) | 0.3 s |
| LIFECYCLE SUBSPAWN leg | full latch >900 s, ZERO traffic | no convergence inside budget; drain discarded the latched turn |
| V2-B child turn 1 | full latch >900 s, ZERO traffic | no convergence inside budget |
| HANDOFF (C1 source, B1 target, B source, B2 target) | none (all roots idle at materialization) | all ≤270 ms |

Root agents: 9th run in a row with zero windows. Per-agent intermittency holds (V4 instant while sibling leg latched 900 s).

## Consumption-boundary proof (V3, from the 16-request capture)
- Request #5 (USE_MCP turn, model t12v-model-a, `[team-relay] ... T12V_USE_MCP_mtkjdrmw6cee19`) `tools` = exactly the 10 team tools (`team_create_member, team_delegate, team_follow_up, team_inspect_config, team_list_members, team_list_templates, team_report_progress, team_request_control, team_resolve_control, team_send_message`); `mcp__t12vmini__ping` ABSENT.
- Request #5 reply = tool-call `mcp__t12vmini__ping`; request #6 = agent-loop rejection `Error: unknown tool "mcp__t12vmini__ping"` → MCP_DENIED_ACK. Denial at the ACTUAL consumption boundary.
- Durable mcpDiag (state route, world A): `{mounted:false, serverName:"t12vmini", allowed:false, source:{layer:"humanOverride", recordId:"ovr-mcp-inst-1rg2jzp0c8xx-g0"}, unavailable:false, deniedBy:{by:"external", reason:"externalHardDeny"}}` — the ALLOW override is recorded but the external hard deny holds; no mcp mount established.
- V3's three failed checks are timing artifacts of the same burst (ack text, tool-call log record, and the USE_MCP model request all landed ~1.1–1.5 s after the 480 s check window closed — v3AdmittedAt ≈ 20:24:27.4 from overrideSet.updatedAt 20:24:27.239 + member.send).

## BLOCKER #3 outcome (T12-V6 25a7e39 + T12-V7 9db339a)
- Root cause (integrator-diagnosed): source-tree glue load dies on two relative tsc-style .js-specifier imports (blueprint L145, persona L146); noEmit:true everywhere ⇒ no in-source .js in fresh worktrees.
- Fix: after the dist build, idempotently copy every *.js under `packages/runtime/dist/packages/` to its repo path (254 files, skip .d.ts, mkdir -p, overwrite). T12-V7 fixed the loop's walk() yield shape ({path, name}).
- Verified: dry-run mapped all 254 files incl. both BLOCKER #3 targets; smoke + full-run builds both stamped `254 files`; import probe LOADED; every row ready toolCount=10 with no setupError; **zero new "Cannot find module" in smoke or full run** (the directive's stop-condition never triggered).
- Copied .js files remain untracked build output: `git status --porcelain` = exactly 254 `??` entries, 0 tracked modifications; tracked diff vs base 62c7c81 = the 4 sanctioned files; run.mjs byte-identical (0-line diff).

## Artifacts
summary.json, t12v-run.log, t12v-build-dist.log, t12v-smoke.log, t12v-fresh1.log, t12v-fresh2.log, t12v-restart1.log, t12v-handoff-lifecycle.log, t12v-mock-capture.json (16 requests), t12v-state.json, t12v-testuse-pre/post.txt, t12v-port3080-pre/post.txt, instances/{SMOKE,A1,A2,B1,C1}/, t12v-run9-tally.txt, t12v-run9-capture.txt, t12v-run9-evidence.txt.
