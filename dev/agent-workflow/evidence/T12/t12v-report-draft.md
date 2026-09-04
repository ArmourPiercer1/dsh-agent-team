# T12 vertical-E2E — FINAL report

Runner: `packages/tools/harness/t12-vertical.mjs` (worktree `.worktrees/T12-V`, branch `task/T12-vertical-slice`)
Mock: `packages/tools/harness/mock-deepseek.mjs` (spec-strict DeepSeek SSE, zero deps)
Definitive run: **run #10**, nonce `mtkltfm07fb4c6` — 2026-09-02T21:24:26Z → 22:11:24Z (job pwsh-161, exit 0, 46 min 58 s)
Run #10 is the first full chain after the parent supplement (T12-V8 mirror-copy removal + T12-V9 phase continuity). Its 4/8 matrix is IDENTICAL to run #9 (nonce `mtkjdrmw6cee19`, 2026-09-02T20:16:16Z → 21:03:11Z, job pwsh-160, exit 0) — the pass/fail set is stable across two consecutive runs.
Prior runs kept for reference: run #8 `mtkhebl94d4768`, run #7 `mtkfcums5d034e`, run #6 snapshot `summary-run6-mtke5bxi426eb0.json`
Smoke (T12-V7 / BLOCKER #3 verification): pwsh-159 — **GREEN** (254-file dist-mirror→source copy, import probe `LOADED`, row ready toolCount=10, zero `setupError` / `Cannot find module`, root turn ~1.0 s, HOME_A reset, exit 0). The T12-V8 removal was verified WITHOUT a separate smoke: run #10's build phase (no mirror copy, import probe `LOADED`, toolCount=10) + post-run worktree clean (0 untracked) is the controlled check.

## ITERATION #2 (2026-09-03 parent directive) — runs #11/#12, corrective commits T12-V10…V14

This section supersedes the run #10 conclusions below where they conflict. The parent's
6-item directive drove two real shipped-plugin-code bug fixes (parent-authorized), the
capture-fidelity + assertion-calibration rework, and the strict contract assertion.

### Commits since run #10 (T12-V, on top of b125c06)

| commit | content |
| --- | --- |
| `952b003` T12-V10 | agent-bindings.mjs resume loop: structural guard for the v2 leader row (no childSessionId key). String(undefined) → SessionId("undefined") killed every A2 resume boot (runs #6–#10). |
| `65e1982` T12-V11 | plugin.mjs L433: null-guard `config.mcpServer?.name` (mcpServer:null is row-config-legal). |
| `de2c0a3` T12-V12 | runner: verbatim mock capture (full messages + full tools schema) + deferred calibration-time content assertions (T12-V13 infra) + V5 strict schemaVersion===2. |
| `9ef78ca` T12-V14 | plugin.mjs L441 block: guard `views.mcpView` null deref — the SECOND mcpServer-null deref, exposed by run #11 after T12-V11 removed the first. |

### Per-directive-item compliance

1. **RESTART discovery** — the directive's premise ("your discovery query is just not finding it")
   is REFUTED for this lane: the A2 directive carries the rootSessionId by construction (nonce-derived)
   and it is persisted (root session file present; directive match verified pre-run #11). The real
   failure was `agent-bindings.mjs` (our repo runtime glue, not upstream): the production create
   path mints the v2 leader row WITHOUT a childSessionId key, and the resume loop did
   `String(member.childSessionId)` → `SessionId("undefined")` → `setupError: session "undefined"
   not found` (5th consecutive at run #10 A2 22:11:05.858Z). Fixed (T12-V10); run #11 A2 resume
   boot succeeded (row ready toolCount=10, no setupError, 23:20:47Z) and RESTART went 8/16 → 14/15
   with every assertion genuinely evaluated.
2. **World-B state route 500** — fixed in two steps: T12-V11 (first deref, `.name`) then T12-V14
   (second deref, `views.mcpView.allowed`, exposed by run #11: B1 23:05:43.630Z / C1 23:21:03.502Z
   "Cannot read properties of null (reading 'allowed')"). Both committed as harness-row bug fixes
   under the parent's explicit authorization (superseding the old "do not edit plugin.mjs" text).
3. **Capture fidelity** — (a) FIXED: capture now records messages[].role/content verbatim + the
   FULL tools schema verbatim (was: content sliced at 4000, tools reduced to name strings). Run #11
   req3 proves the real requests carry the complete prompt assembly: model=t12v-model-a, system
   prompt 1789 chars incl. the worker persona, tools = 10 full {type, function{name,description,
   parameters}} schemas. (b) REFUTED as a V2 finding: "production wiring sends no tools / no system
   prompt" was a deadline-timed-lookup artifact — at the 480 s deadline the latched child turn had
   not yet reached the mock (settled 22:50:22, ~481 s past deadline). Deferred calibration checks now
   evaluate content against the FINAL capture: they PASS when the turn settles late and fail with an
   explicit "never settled" reason otherwise.
4. **V3 mcp attempt via tool_calls** — already scripted pre-directive; run #11 captured the full
   sequence: req5 = real `mcp__t12vmini__ping` tool-call (T12V_USE_MCP), req6 = agent-loop
   denial relay (tool result for the call id + T12V_MCP_DENIED_ACK). All three deferred content
   checks PASS: child log records the attempt at the consumption boundary; the model attempted and
   the real agent loop relayed the denial; the model-boundary tool schema OMITS the denied tool
   (hard DENY beats override ALLOW at the ACTUAL consumption boundary). V3 2/5 → 5/6 (sole fail:
   denied-ack 2.2 s past the 480 s inline deadline — same honest latency class as run #10's 1.3 s).
5. **V5 projection contract** — per P8-S backend-contract-freeze.md (production projection service
   stamps schemaVersion: 2; supported [1,2]), the assertion is now `sv === 2` STRICT. Run #11:
   PASSES — no contract contradiction. `ledgerEntries` was a misnomer in the directive: the DTO
   field is `ledger` (LedgerSummaryDto); non-empty = totalEntries > 0, passes (was passing run #10).
   V5 remains 6/6 with NO TeamDomain direct reads (public Remote only).
6. **LIFECYCLE descendant subagent** — already scripted (T12V_SUBSPAWN tool-call in the mock).
   Run #11: SUBSPAWN latched its full 900 s window (zero descendant traffic) → descendant/origin/
   ack/drain fail honestly (drained=0 is a genuine numeric; quiescence gate respected, no fake
   quiescent=true). 5/9, same as run #10. NEW finding: the latched SUBSPAWN turn was RE-DRIVEN on
   A2 RESUME (req10 subagent tool-call at 23:20:47.463Z) — durable session state survives instance
   stop/restart and the resumed agent loop continues the pending tool-call turn.

### Run #11 matrix (definitive for iteration #2; nonce mtkob35v2077d6, 22:34:09→23:21:06Z, exit 0)

| scenario | run #11 | run #10 | delta source |
| --- | --- | --- | --- |
| V1 | 11/11 ✅ | 11/11 | stable |
| V2 | 10/14 | 8/14 | +2 calibrated [A] persona/model (late-settling latch); fails: [A] 480 s latency, [B] state route (pre-T12-V14), [B] 900 s latch, [B] model-b never settled |
| V3 | 5/6 | 2/5 | +3 calibrated content (attempt/relay/schema); fail: 2.2 s past 480 s deadline |
| V4 | 6/6 ✅ | 6/6 | stable |
| V5 | 6/6 ✅ (strict sv=2) | 6/6 | contract-strict now, still passes |
| HANDOFF | 17/17 ✅ | 17/17 | stable |
| LIFECYCLE | 5/9 | 5/9 | SUBSPAWN latch (900 s) |
| RESTART | 14/15 | 8/16 | T12-V10; sole fail = §12 literal precondition unreachable by construction (identity.ts L289-298 bakes rootSessionId into the instance spec) |
| **TOTAL** | **4/8, 74/84** | **4/8, 63/84** | +11 assertions |

Remaining failure classes (all explained, none fixable from this lane without CORE PATCH budget):
(i) shipped-runtime window latch — INTERMITTENT per run and per agent (V2-A settled 481 s late;
V3 2.2 s late; V2-B + SUBSPAWN full 900 s); latency assertions stay deadline-bound (honest).
(ii) state route (pre-T12-V14 code in run #11 — fixed, verification = run #12).
(iii) RESTART literal precondition (plan-vs-code divergence, flagged for adjudication; all
observable no-collision invariants verified).

### Corrections to the directive's parent-lane figures

- "iteration #4 summary.json (25 failures)" — this lane's run #10 was 21 failed assertions
  (63/84); the 25 figure does not match any T12-V summary and appears to come from the parent's
  own lane (T12-int). T12-V run artifacts are unambiguous (t12v-run10-fails.txt).
- "working tree still has only the 2 untracked harness files" — T12-V porcelain was 0 before run
  #11 (everything committed through b125c06).
- "tools=[] and system texts=[]" — explained in item 3 above (deadline-timed lookups + capture
  fidelity gap, both now fixed); the production wiring DOES send full tools + system prompt.

### Run #12 (T12-V14 verification; SETTLED 2026-09-03T00:10:06Z, nonce mtkq2htxfd7514, exit 0)

Launched after T12-V14 (9ef78ca) commit; homes wiped; pre-flight green. Result: **4/8 scenarios,
75/84 assertions** (run #11: 74/84; run #10: 63/84). Per-assertion dump: t12v-run12-all.txt;
snapshots t12v-summary-run12.json / t12v-mock-capture-run12.json (19 clean requests) /
t12v-state-run12.json.

- **T12-V14 VERIFIED (both mcp-less worlds)**: V2's "[B] state route well-formed for the
  mcpServer:null row" = PASS with a well-formed state body (boot 3, phase create,
  rootSessionId=session-t12v-b-root-mtkq2htxfd7514, teamSession row, memberCount 1); C1's probe
  passed instantly (no 10 s timeout — the 500 path in run #11 took exactly 10 s). The
  mcpServer:null variant no longer crashes the state route.
- T12-V10 re-verified: A2 resume boot succeeded again (row ready toolCount=10, 00:09:57Z);
  RESTART 14/15 (sole fail = the constructionally-unreachable §12 literal precondition).
- Reproduced finding: the latched LIFECYCLE SUBSPAWN turn was RE-DRIVEN on A2 resume
  (req9 subagent tool-call, 00:09:57.379Z) — second consecutive run; durable session state
  survives instance stop/restart.
- Latch outcomes (intermittent, as documented): V2-A settled ~483 s past its 480 s deadline
  (calibrated content checks pass); V3 denied-ack 2.1 s past deadline (content checks pass);
  V2-B latched its full 900 s (zero model-b traffic — calibrated model-b check fails honestly);
  LIFECYCLE SUBSPAWN latched full 900 s (descendant/origin/ack/drain fail honestly, drained=0
  genuine numeric).
- Matrix stability: V1 11/11, V4 6/6, V5 6/6 (strict schemaVersion===2), HANDOFF 17/17 — all
  stable across runs #10/#11/#12.
- Post bracket: worktree porcelain 0 (HEAD 9ef78ca), run.mjs byte-identical, test-use pristine
  cd5ef81481, :3080 post 200, all T12 ports closed.

## Definition of done

1. ✅ runner + mock committed in T12-V; `git diff --name-only 62c7c81..HEAD` = ONLY new files + sanctioned yaml manifest edit; `run.mjs` byte-identical to base (re-verified after T12-V8/T12-V9: 0-line diff); worktree 0 untracked post-run #10.
2. ✅ `summary.json` — ALL 8 scenarios complete, each `{criterion, pass, durationMs, assertions[ok], evidence}`.
3. ✅ all evidence logs written (smoke/run/build/fresh1/fresh2/restart1/handoff-lifecycle), mock capture (16 requests, fully decoded), test-use pristine pre/post (head `cd5ef814…`, `pristine=true`), :3080 pre/post (`200`/`200`).
4. ✅ integrator directive #1 executed: seam-import blocker full root cause documented (`t12v-seam-rootcause.md`), 7-junction packages-level bridge created + made idempotent in the runner (T12-V5 `5a2bbe1`), smoke re-run green.
5. ✅ integrator directive #2 (BLOCKER #3) executed: root cause taken as diagnosed (source-tree glue load fails on two relative tsc-style `.js`-specifier imports; every tsconfig `noEmit:true`); fix = environment prep only — idempotent copy of all 254 `*.js` under `packages/runtime/dist/packages/` to their repo paths after the dist build (T12-V6 `25a7e39`, loop-shape fix T12-V7 `9db339a`); zero source/core edits; copied artifacts untracked (never committed); smoke re-run GREEN with row health ok:true and no setupError; **no new `Cannot find module` appeared** (the directive's stop-condition never triggered) → proceeded to the full 8-scenario run. Subsequently SUPERSEDED per the parent supplement: T12-V8 `ed56641` removed the copy (dist-glueUrl suffices in this lane), verified by run #10's build + clean worktree.
6. ✅ this report.

## Model path

**mock-env (primary, CONFIRMED).** `DEEPSEEK_BASE_URL=http://127.0.0.1:3496` + `DEEPSEEK_API_KEY=t12-mock-key`
exported to every instance launch; row `staticModel.provider='deepseek-official'` (llm-deepseek resolves
`DEEPSEEK_BASE_URL` → mock). Fallback `qiyuan-self/qwen3.8-27b` NOT used — run #9 summary
`modelPath.fallbackUsed = false`. Every model call in the 16-request capture went to the mock endpoint
(models seen: t12v-model-a / t12v-model-b / t12v-model-c — one per world row).

## Commits (T12-V only; base 62c7c81)

| commit | content |
| --- | --- |
| `cc545d3` T12-V1 | declare `yaml` in packages/runtime (production dist imports it; fresh installs lack stale symlink) — the sanctioned yaml manifest edit |
| `78c86c7` T12-V2 | t12-vertical.mjs runner + spec-strict mock DeepSeek SSE endpoint: 8 scenarios, real DSH instances, public Remote, durable-log discovery, invariant 9, dispatch-envelope unwrap, idempotent `packages/runtime/node_modules/@deepseek-ai` junction bridge (linkRuntimeNodeModules) |
| `eb1600a` T12-V3 | 180 s→480 s wait budgets for first-turn-on-fresh-agent + measured `firstTurnLatencyMs` evidence; V5 assertions fixed to frozen projection contract (schemaVersion 1\|2, `ledger` = LedgerSummaryDto) |
| `3b740fb` T12-V4 | run #6 postmortem: V3 denied-ack 180 s→480 s + per-turn opener latency (window persists past turn 1); V3 override.set shape fix (dispatch data IS the durable record); `member.followup` `payload.body`→`payload.prompt` (shipped contract rejects body — run #6 TEAM_RUNTIME_REQUEST_MALFORMED); 900 s budgets at the 3 sites with observed >480 s stalls |
| `5a2bbe1` T12-V5 | **integrator directive #1**: packages-level 7-junction `@deepseek-ai` bridge (`dsh-agent`, `dsh-llm`, `dsh-mcp-client`, `dsh-session`, `dsh-storage-domain`, `dsh-scope`, `dsh-system-prompt`) created idempotently in env setup via shared `ensureJunctions` helper (keep-if-realpath-matches, else re-link); runtime-level 5+1 bridge refactored onto the same helper, behavior unchanged; both gitignored worktree-only artifacts |
| `25a7e39` T12-V6 | **integrator directive #2 (BLOCKER #3)**: after the dist build and before any boot, idempotently copy every `*.js` under `packages/runtime/dist/packages/` back to its repo path (mirror root `dist/packages/` → repo `packages/`; skip `.d.ts`; mkdir -p; overwrite in place). The FINAL glue's two relative `.js`-specifier imports (blueprint L145, persona L146) resolve in BOTH glue placements; zero source/core edits; copied files are untracked build output |
| `9db339a` T12-V7 | fix T12-V6 loop: `walk()` yields `{path, name}` objects, not strings (smoke crashed `TypeError: file.endsWith is not a function` before copying anything); dry-run verified all 254 files map to repo paths incl. both BLOCKER #3 targets |
| `ed56641` T12-V8 | **parent supplement item 1**: REMOVE the T12-V6/V7 dist-mirror→source 254-file .js copy from `buildProductionRuntime` (this runner's glueUrl is the dist-mirror path, so the copy was never on its resolution path); prune now-dead `relative` import; delete the 254 untracked in-source .js from the worktree |
| `b125c06` T12-V9 | **parent supplement item 4**: phase-level failure continuity — each phase (smoke/build/fresh1/fresh2/restart1/handoff) in its own try/catch; a phase FATAL is recorded (`summary.phaseFailures` + `t12v-phase-failures.json`, log `PHASE <name> FATAL (continuing …)`) and the chain continues so each iteration yields a FULL pass/fail matrix; exit code 1 on any phase fatal; pre-flight (ports/homes/mock/bridges) still aborts hard; runner no longer writes `t12v-blocker.md` |

`git diff --name-only 62c7c81..HEAD` = {packages/runtime/package.json, pnpm-lock.yaml,
packages/tools/harness/mock-deepseek.mjs, packages/tools/harness/t12-vertical.mjs}.
`packages/tools/harness/run.mjs` byte-identical to base (re-verified post-T12-V8/T12-V9: 0-line diff).
Working tree clean — 0 untracked after run #10 (the 254 mirror copies are gone with T12-V8).

## Per-scenario results — FINAL (run #10, nonce mtkltfm07fb4c6; matrix identical to run #9 mtkjdrmw6cee19)

**Run #10 reproduced the matrix line-for-line** — same 4/8 pass/fail, same assertion
counts (V1 11/11, V2 8/14, V3 2/5, V4 6/6, V5 6/6, HANDOFF 17/17, LIFECYCLE 5/9,
RESTART 8/16), same three fail classes. Run #10 durations (ms): V1 1107, V2 1382966,
V3 481816, V4 977, V5 15, HANDOFF 13374, LIFECYCLE 904230, RESTART 2271. Run #10
timestamps: V2-A child turn latched ~21:24:44, convergence burst 21:40:40.889–42.061
(V3 denied ack 21:40:41.273, ~1.3 s past deadline — 5th consecutive sub-2 s miss);
LIFECYCLE SUBSPAWN latched ~21:40:43, zero traffic the full 900 s (post-restore
follow-up instant 21:55:46.325); V2-B child latched ~21:56:15, zero model-b traffic
until the 22:11:21 handoff legs; RESTART bug #1 A2 22:11:05.858 (5th consecutive);
bug #2 state-route 500 B1 21:56:02.144 / C1 22:11:20.788. Full run #10 timeline:
`t12v-run10-monitoring.md`. The detail table below records run #9 (the BLOCKER #3-fixed
build); every cell of it holds for run #10 with the substitutions above.

| scenario | pass | durationMs | assertions (ok/total) | notes |
| --- | --- | --- | --- | --- |
| V1 | **TRUE** | 1106 | 11/11 | fresh Root via production row create; durable TeamSession; leader `inst-leader`; root agent cwd==W_root (session meta); zero synthetic members; root turn ~1 s (9th run in a row: no window on root agents) |
| V2 | FALSE | 1383385 | 8/14 | world-A part: child turn 1 in non-idle window — **full latch >480 s with ZERO mock traffic** (no title call either); convergence burst at 20:32:28 replayed it ~16 min after admission → childAck timeout (honest); persona/model checks failed only by timing (the turn's request arrived after the single post-wait log read; the capture proves model=t12v-model-a + full prompt assembly). world-B part: child turn 1 **>900 s** (zero model-b traffic 20:47→21:03) + the expected KNOWN-DEFECT check (state route 500, plugin.mjs L433 null-deref on `mcpServer:null` row — body recorded; instance healthy, 10 tools, turns work; invariant 9 used for all B/C remote calls) |
| V3 | FALSE | 481941 | 2/5 | SUB-1.5 s timing miss (convergence burst 20:32:28.546–28.974 vs 480 s deadline ≈20:32:27.4 — 4th consecutive sub-1.5 s miss). **Criterion behavior empirically verified in the capture**: USE_MCP request (#5) tools = exactly the 10 team tools — `mcp__t12vmini__ping` ABSENT (denied at the model-consumption boundary); #5 reply = tool-call attempt, #6 = `Error: unknown tool "mcp__t12vmini__ping"` agent-loop rejection → MCP_DENIED_ACK. override.set PASSes with the T12-V4 shape fix; durable mcpDiag deny cell exact (`mounted:false`, `deniedBy:{by:'external',reason:'externalHardDeny'}`, override record referenced) |
| V4 | **TRUE** | 937 | 6/6 | exact task text reached the REAL child session log; real turn against the mock completed ~0.3 s after the convergence burst (child idle; per-agent intermittency); durable truth settled |
| V5 | **TRUE** | 22 | 6/6 | TeamProjection through the BROWSER-FACING public Remote (/team-remote) only — no TeamDomain direct reads on the test side; schemaVersion 2 + nine frozen v1 fields; ledger.totalEntries > 0; leader row present (v2 shape, no childSessionId key) |
| HANDOFF | **TRUE** | 13335 | 17/17 | plan §11.1 fully verified: source C1 (world C root) + requestToken X + context C → target B1 (minted handoff root under home C, model t12v-model-c, C in B1's durable root log — `prepare1CarriesC=true`); a DIFFERENT source (world-B root) + the SAME X → DIFFERENT target B2 (home B, model t12v-model-b, `prepare2CarriesC=true`, create2 completed with contextToken). Provenance + idempotent-key checks ok; all four legs in 13.3 s (target B2 first-turn latency 270 ms — root agents window-free) |
| LIFECYCLE | FALSE | 904246 | 5/9 | SUBSPAWN turn (workerA, admitted ~20:32:30.3) never reached the mock within the 900 s budget (zero requests 20:32:30→20:47:34) → no descendant (honest; 4th run with a spawn-leg stall). **Everything downstream worked for real**: archive executed (quiescence gate passed; the drain discarded the latched SUBSPAWN turn — the run #7/#8 mechanism), honest numeric `drained=0` (no descendant existed — the spawn never happened; the number is genuine, a non-numeric drain would fail the quiescence gate), residencyDropped=true, restore executed, follow-up admitted with the T12-V4 `payload.prompt` fix and FOLLOWUP_ACK settled in the durable log (instant — the drained latch left the re-materialized agent idle) |
| RESTART | FALSE | 2005 | 8/16 | EXPECTED honest fail on BOTH documented plan-vs-code divergences: (1) plan §12 literal same-instanceId-under-different-root precondition UNREACHABLE by construction (identity.ts L289-298: instanceId derives from rootSessionId — assertion fails by design and records the divergence); (2) shipped glue resume-loop bug (agent-bindings.mjs L883-890: `String(member.childSessionId)` on the v2 leader row → `agents.resume(SessionId("undefined"))` → boot `setupError: session "undefined" not found` — 4th consecutive run, A2 21:02:52). Durable evidence in summary: `resumeBootFailure` + `durableLeaderRow` (v2 row, no childSessionId key). No-collision invariants across the fresh #1/#2 roots all hold (8 ok) |

**Tally: 4/8 pass (V1, V4, V5, HANDOFF) — run #10 (definitive) and run #9, identical.**
Every fail is an honest pass:false with durable evidence. The fail classes are all
shipped-side or window-side (see deviations): window latches (V2-A, V3 timing,
LIFECYCLE SUBSPAWN, V2-B), shipped bug #1 (RESTART resume loop), shipped bug #2
(state route null-deref — V2-B expected-defect check), and the unreachable plan §12
literal precondition (RESTART).

## Parent supplement (post-run-#9 directive) — compliance status

1. **Mirror-copy removal — DONE (T12-V8 `ed56641`), verified in this lane.** The
   254-file dist-mirror→source .js copy was removed from `buildProductionRuntime`, the
   dead `relative` import pruned, and the 254 untracked in-source .js deleted. Run #10
   is the controlled check: build → `import probe exit 0: LOADED name=dsh-agent-team`
   with no mirror-copy step, A1 row ready toolCount=10, and post-run worktree porcelain
   count = 0. The parent's "your dist-glueUrl approach works" is confirmed here: this
   runner's boots always use the dist-mirror glueUrl (on-disk evidence: home A patch
   L4 `file:///.../packages/runtime/dist/.../plugin/host.js`).
2. **Mock text-only premise — REFUTED for this lane with durable evidence (see
   pushback below).** The mock script table ALREADY contains the spec-strict tool-call
   branches the brief's wire contract documents (brief L59–60: tool-call fragments share
   `index` → terminal `finish_reason:"tool_calls"` → `[DONE]`; L62: "the mock may pick
   the reply from a script table keyed on (request #, last tool name / message
   marker)"). Run #10 capture req #5 = `reply: tool-call mcp__t12vmini__ping` (tools on
   #5 = exactly the 10 team tools, mcp ABSENT) → req #6 = MCP_DENIED_ACK. Team
   operations in this brief's architecture are driven through the SHIPPED public seams
   (profile-patch row + per-boot directive = the run.mjs pattern the brief says to
   extend; tool seam `POST /__p6t6/tool`; browser-facing public Remote) — the brief does
   not assign team creation to the LLM, and the anti-cheat identity assertions (e.g.
   "no synthetic worker/scout rows", exact instanceId derivation) would race a
   model-driven create. The LLM's scripted actions are exactly where the brief requires
   model action: V3's MCP attempt (external deny at the ACTUAL consumption boundary) and
   LIFECYCLE's real subagent spawn. The "empty world / nothing durable" characterization
   does not match this lane: run #10 (and #9) show durable TeamSession + root/child
   session logs + projection consistency (V1 11/11, V4 6/6, V5 6/6, HANDOFF 17/17).
   The parent's iteration-#2 observations (T12-int lane, LLM-driven tools, genuinely
   undefined A2 root) describe a different lane; no such artifacts exist in this
   evidence dir.
3. **Create-phase persistence + resume discovery — VERIFIED in this lane (parent item 3
   check performed).** Run #10: root session persisted to home A during the create
   phase (`session-t12v-a-root-mtkltfm07fb4c6/session.jsonl.zstd`, 5658 bytes, present
   post-run) and the A2 resume directive carries exactly that persisted rootSessionId
   with bootPhase="resume" (`t12v-run10-verify.txt`: FINAL match=True,
   undefinedPresent=False; runner log "A2: profile already initialized"). The
   `session "undefined" not found` error in RESTART is the shipped leader-row bug —
   `String(member.childSessionId)` on the v2 leader row that has NO childSessionId key
   (agent-bindings.mjs boot() resume loop) — 5th consecutive run; it is NOT an
   undefined-root cascade in this lane.
4. **Phase-level failure continuity — DONE (T12-V9 `b125c06`).** Each phase runs in its
   own try/catch: a phase FATAL is recorded in `summary.phaseFailures` +
   `t12v-phase-failures.json` (and logged `PHASE <name> FATAL (continuing …)`), the
   chain continues to the remaining phases, and the exit code is 1. Run #10 did not
   exercise the path (`phaseFailures = []`, every fail was a recorded scenario-level
   pass:false) — the full 8-scenario matrix is present in summary.json.

## Seam-import blocker — directive #1 executed (T12-V5)

Full root cause: `t12v-seam-rootcause.md` (§1–5). Summary:

- **Mechanism**: the row's seam/glue load as dynamic `.mjs` in the DSH host; bare `@deepseek-ai/*` +
  `zod` imports resolve by Node's upward walk from the importing file. In a fresh worktree there is no
  `node_modules` to walk to, and the DSH upstream-resolver hook covers only `apps/cli/node_modules`-linked
  packages — with a measured double-candidate off-by-one making discovery itself null (hook = silent
  pass-through) in fresh worlds. ⇒ `Cannot find package '@deepseek-ai/dsh-storage-domain' from seam.mjs`.
- **T12 state at blocker time (machine-verified)**: the runner's existing runtime-level 5-junction bridge
  already neutralized it — zero resolution errors in all prior runs, all worlds booted toolCount=10. The
  directive's packages-level bridge was therefore applied as the prescribed defense-in-depth, not as a repair
  of a live T12 failure.
- **Applied**: 7 junctions in `.worktrees/T12-V/packages/node_modules/@deepseek-ai/` (dsh-agent, dsh-llm,
  dsh-mcp-client, dsh-session, dsh-storage-domain, dsh-scope, dsh-system-prompt) → test-use pnpm hoist
  (0.1.2-alpha.1 each; all verified resolving). Idempotent in the runner via the shared `ensureJunctions`
  helper (keep-if-realpath-matches, re-link stale/dangling, refuse non-junction occupants); the runtime-level
  5+1 bridge now runs on the same helper with unchanged behavior. Both placements coexist; Node's walk from
  `packages/runtime/**` still hits the runtime level first. Gitignored worktree-only artifacts; host tree
  untouched (CORE PATCH BUDGET = 0).
- **Smoke re-run (pwsh-156): boot ok** — `row ready — toolCount=10`, `rowMounted true`, state
  boot=1/phase=create/members=["inst-leader"], prompt accepted, root turn settled ~1.1 s, HOME_A reset,
  zero `setupError`/module errors in instance + run logs.

## BLOCKER #3 — glue source-tree import resolution — directive #2 executed (T12-V6/V7)

Full mechanism: `t12v-seam-rootcause.md` (§6). Summary (root cause taken as integrator-diagnosed):

- **Mechanism**: the seam itself loads fine under the runtime-level junctions (keep exactly as-is); the
  FINAL glue (`packages/runtime/src/plugin/live/agent-bindings.mjs`, a SOURCE `.mjs` under plain Node) has
  two relative tsc-style `.js`-specifier imports INTO the TS source tree — L145
  `../../../../domain/blueprint/src/index.js` and L146 `../../../agent-setup/persona/index.js`. A fresh
  worktree has only `.ts` there, and EVERY tsconfig is `noEmit:true` ⇒ no sanctioned tsc emits these
  in-source `.js` files ⇒ a boot that loads the glue from the SOURCE tree dies with
  `Cannot find module '.../packages/domain/blueprint/src/index.js'` (observed 00:02 local smoke fatal).
- **Fix (environment prep only — zero source/core edits)**: in `buildProductionRuntime`, after the dist
  build and before any boot, idempotently copy EVERY `*.js` under `packages/runtime/dist/packages/` to its
  corresponding repo path preserving the mirror layout (mirror root `dist/packages/` → repo `packages/`;
  all 254 `.js` files, same rule; skip `.d.ts`; create target dirs; overwrite if present). The dist mirror
  (rootDir = repo root) is a source-layout replica, so both glue placements (dist mirror — what this
  runner's glueUrl uses — and source) resolve identically, and the relative imports keep resolving after the
  copy. Copied files are untracked build output (same class as the junction bridges) — never committed.
- **T12-V7 correction**: the first T12-V6 smoke (pwsh-158) crashed with
  `TypeError: file.endsWith is not a function` — `walk()` (tests/characterization/lib/util.mjs) yields
  `{path, name}` objects, not strings. Loop adapted to `entry.path`; dry-run then verified 254 files incl.
  both BLOCKER #3 targets (`packages/domain/blueprint/src/index.js`, `packages/runtime/agent-setup/persona/index.js`).
- **Verification (directive criterion)**: smoke pwsh-159 GREEN — build stamped `254 files`, import probe
  `LOADED name=dsh-agent-team`, **row health ok:true, no setupError**, full one-turn ack, zero
  `Cannot find module` in smoke or full run #9 (the stop-condition never triggered). No further source
  paths hacked, no extra junctions added.
- **T12-V8 follow-up (parent supplement, item 1)**: the parent confirmed the dist-glueUrl approach works
  and ordered the mirror copy removed. T12-V8 (`ed56641`) removed it — this runner's boots always load the
  glue from the DIST mirror (`glueUrl` = `packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs`),
  where its relative `.js`-specifier imports resolve inside the dist tree itself; the in-source copies were
  never on this lane's resolution path (they only serve a SOURCE-URL glue boot, the legacy design). Verified
  in run #10: build WITHOUT the copy → `import probe exit 0: LOADED name=dsh-agent-team`, A1 row ready
  toolCount=10, and post-run worktree porcelain count = 0 (runs #6–#9 each left 254 untracked .js).
- **Disposition**: fresh-world build-output gap, not a repo code defect. The environment prep lives in the
  test runner (T12-V scope). P10 entries (with the seam-import item): give the glue a regular resolution
  story for its relative TS-source imports (emit or re-specifier) so fresh checkouts need no in-source `.js`.

## Deviations & documented divergences (with justification)

1. **Shipped-code BUG #2 — state route null-deref** (plugin.mjs L433: unconditional
   `teamRoot.config.mcpServer.name`; row validation legally accepts `mcpServer: null`) ⇒ worlds B and C
   state route 500s permanently (`Cannot read properties of null (reading 'name')` — run #9: B1 20:47:49,
   C1 21:03:07). Instances themselves boot and work (health ok, toolCount=10, turns settle). plugin.mjs is
   FINAL ⇒ not fixable in T12. Mitigation: lenient `p6t6StateProbe` + invariant 9 (teamSessionId ===
   rootSessionId) for all B/C remote calls; scored once in V2 as the expected defect check; divergence
   recorded with the 500 body as evidence.
2. **Fresh-world module-resolution gap** (upstream-resolver hook off-by-one + glue's relative TS-source
   imports with no in-source `.js` under `noEmit:true`) — compensated by the two gitignored junction bridges
   (runtime-level 5+1, packages-level 7 per directive #1) + the dist-mirror glue copy (T12-V2) + the
   T12-V6/V7 254-file dist-mirror→source `.js` copy. Zero source change, zero core patch. P10/decision entry.
3. **Shipped-runtime non-idle window** (agent-bindings.mjs `submitAttributedInput` → core `wakeDriver` latch;
   persists across turns until convergence; unbounded; per-agent intermittent) — run #9: world-A child
   full-latch >480 s (zero traffic; burst replayed latched turns at 20:32:28, sub-1.5 s apart); V3 4th
   consecutive sub-1.5 s deadline miss; LIFECYCLE spawn leg and world-B child turn >900 s (zero traffic);
   V4 instant (child idle after the burst) while the SUBSPAWN leg admitted 0.2 s later latched the full
   900 s — the per-agent non-idle race at admission. Mitigation: bounded budgets (480 s standard; 900 s at
   the three observed >480 s sites) + measured `firstTurnLatencyMs` / per-turn opener evidence in every
   scenario; honest pass:false when a window exceeds the budget. No further escalation (windows unbounded).
   See `t12v-finding-360s-first-turn.md` (runs #5–#9 tables).
4. **Shipped-code BUG #1 — RESTART resume loop** (agent-bindings.mjs L883-890) — `setupError: session
   "undefined" not found`, 4th consecutive run (run #9: A2 21:02:52). Honest pass:false with durable
   `resumeBootFailure` + `durableLeaderRow` evidence.
5. **RESTART plan-vs-code reachability divergence** (identity.ts L289-298) — the plan §12 literal
   same-instanceId-under-different-root precondition is unreachable via shipped template creation; recorded
   as an explicit assertion that fails by design.
6. **Deterministic local mock model** — the only sanctioned test-model stand-in (brief: "May use
   deterministic/local test model/provider — but ONLY through the real DSH Agent lifecycle"); every call
   went through the real dsh-llm deepseek-official adapter + SSE + agent loop + durable session logs.
7. **Documentation note** — summary `durationMs` values are milliseconds (early monitoring mislabeled them
   as seconds; corrected in run #6/#7 monitoring docs; no code issue).

## Runner-side defects found & fixed (NOT plan deviations)

1. dispatch `{data, provenance}` envelope unwrap (T12-V2 — single-point fix covers all remote consumers).
2. V5 projection contract: schemaVersion 2 + LedgerSummaryDto + v2 leader row shape (T12-V3).
3. V3 override.set value IS the durable record (no `{record}` wrapper) (T12-V4).
4. `member.followup` requires `payload.prompt` (non-empty string); shipped runtime rejects `payload.body`
   with TEAM_RUNTIME_REQUEST_MALFORMED (run #6 LIFECYCLE fatal) (T12-V4).
5. Bridge junction logic refactored into shared idempotent `ensureJunctions` (T12-V5).
6. BLOCKER #3 environment prep: 254-file dist-mirror→source `.js` copy in `buildProductionRuntime` (T12-V6);
   walk() yield-shape fix ({path, name}) after the pwsh-158 TypeError (T12-V7).

## Evidence (dev/agent-workflow/evidence/T12/)

Run #10 (definitive): `t12v-run.log` (tail), `t12v-build-dist.log` (T12-V8 shape — no mirror-copy line),
`t12v-fresh1.log`, `t12v-fresh2.log`, `t12v-restart1.log`, `t12v-handoff-lifecycle.log`, `summary.json`
(run #10, `phaseFailures=[]`), `t12v-state.json`, `t12v-mock-capture.json` (16 requests, decoded),
`t12v-testuse-pre.txt`/`t12v-testuse-post.txt` (head cd5ef814, status/diff empty pre AND post,
`pristine=true`), `t12v-port3080-pre.txt`/`t12v-port3080-post.txt` (200/200),
`instances/{A1,A2,B1,C1}/` (boot markers, dump-config), `t12v-run10-monitoring.md` (full timeline +
controlled checks + window table + tally), `t12v-run10-tally.txt`, `t12v-run10-capture.txt` (16-request
decode incl. req #5 tool-call reply), `t12v-run10-verify.txt` (root persistence + A2 directive +
phaseFailures verification).
Run #9 (reference): `t12v-run9-monitoring.md`, `t12v-run9-tally.txt`, `t12v-run9-capture.txt`,
`t12v-run9-evidence.txt`; smoke pwsh-159 (`t12v-smoke.log`).
`briefs/` (vertical-e2e.md = source of truth, integration-checklist.md, lane-a.md, lane-c.md),
`t12v-seam-rootcause.md` (directive #1 root cause + §6 BLOCKER #3 mechanism/fix), `T12-decision.md`.
Scratch diagnostics (untracked, by convention): `t12v-bridge-probe.mjs`, `t12v-tally.mjs`,
`t12v-run8-verify.mjs`, `t12v-copy-dryrun.mjs`, `t12v-capture-decode9.mjs`, `t12v-capture-compact9.mjs`,
`t12v-req5-inspect.mjs`, `t12v-evidence9.mjs`, `t12v-capture-decode10.mjs`, `t12v-verify10.mjs`,
plus the run #5–#7 probes.
Prior: `summary-run6-mtke5bxi426eb0.json` + capture snapshot, `t12v-run6-monitoring.md`,
`t12v-run7-monitoring.md`, `t12v-run8-monitoring.md`, `t12v-run8-tally.txt`,
`t12v-finding-360s-first-turn.md` (window diagnosis, runs #5–#10), `t12v-blocker.md` (parent's record of
the pwsh-158 TypeError — already fixed in T12-V7; preserved, never overwritten by the runner anymore
since T12-V9).
Homes `references/.dsh-test-t12-a|b|c` hold the RUN #10 session logs (wipe before any run #11).
NOTE: the raw run #9 DSH_HOME session logs were wiped before run #10 (fail-closed freshness); a pre-wipe
archive attempt failed (Compress-Archive -LiteralPath misuse), so the raw run #9 zstd logs were not
preserved — all DERIVED run #9 evidence above remains intact (monitoring timeline with extracted
latencies, capture decode, boot logs under instances/, summary + mock capture).

## Conclusion

The shipped-plugin vertical slice is fully exercised end-to-end through the real DSH Agent/Session runtime:
V1 (fresh Root), V4 (delegated real work), V5 (projection through the browser-facing public Remote), and
HANDOFF (plan §11.1, both legs, token-X distinctness) pass with 11/11, 6/6, 6/6, 17/17 assertions —
twice, on two consecutive runs (#9, #10, identical 4/8 matrix). V2/V3/LIFECYCLE/RESTART fail honestly and
only for shipped-side/window-side reasons: two confirmed shipped-code bugs (state-route null-deref;
resume-loop "undefined" session — 5th consecutive), one plan-vs-code reachability divergence, and the
unbounded shipped-runtime non-idle window (which, when it converges, re-proves the V3
consumption-boundary behavior in the capture). Anti-cheat held throughout: production row
create/resume paths, live agent-bindings.mjs, mock model only via the real lifecycle (with the scripted
tool-calls the brief's wire contract documents — req #5 tool-call in both #9 and #10 captures), no
TeamDomain direct fabrication, no seeded members, no hardcoded legacy ids. Both integrator directives
are fully executed: #1 (seam-import root cause + 7-junction packages-level bridge, T12-V5) and #2
(BLOCKER #3 environment prep, T12-V6/V7 — subsequently superseded per the parent supplement by T12-V8,
which removed the mirror copy after confirming the dist-glueUrl suffices). The parent supplement is
fully addressed: mirror copy removed + verified (item 1), phase-level failure continuity in place
(item 4, T12-V9), create-phase persistence + resume discovery verified in this lane (item 3), and the
mock text-only premise refuted with durable evidence (item 2 — see "Parent supplement" section).
Definitive run #10: exit 0, full 8-scenario matrix in summary.json, test-use pristine, :3080 200/200,
worktree clean (0 untracked).

## ITERATION #3 (2026-09-03, parent "Run #7 postmortem" directive) — owner pin + T12-V15/V16

This section supersedes the iteration #2 "remaining failure classes (i)" note: the window
latch is NO LONGER "not fixable from this lane without CORE PATCH budget". The parent's
three-item directive was executed in priority order.

### Item 1 — RESUME BUG: root-caused, fixed, verified (the path to GO)

- Root cause: `agent-bindings.mjs` resume loop — the production create path mints the v2
  leader row WITHOUT a `childSessionId` key; the loop did `String(member.childSessionId)`
  → `SessionId("undefined")` → `setupError: session "undefined" not found`, killing every
  A2 resume boot (runs #6–#10, 5th consecutive).
- Fix: T12-V10 (`952b003`) structural guard (skip members without a resolvable child
  session; leader rows are not resumed). Full call-site audit clean.
- Live verification (three consecutive runs): run #11 (A2 resume boot ok, RESTART 8/16 →
  14/15), run #12 (14/15; the 1 = RESTART literal precondition, see below), **run #13
  restart1 leg: RESTART 9/9 PASS** with the instrumented resume chain captured verbatim
  (A2 @00:56:52.111 `boot:enter phase=resume` → `setup:consumption-resolved ms=1` →
  `boot:root-ready ms=54` → `boot:member-resume-start` @52.165 → cold-member setup
  1–2 ms/step → `boot:member-resume-done` @52.17x → `deliver:whenIdle-done ms=106`
  @00:56:55.677 → mock req11 `T12V_RESTART_ACK` @00:56:55.672).
- RESTART literal precondition (same instanceId under a different root): still
  unreachable by construction (identity.ts L289-298 specString join → `inst-`+token(spec,12);
  no explicit-instanceId parameter) — flagged for plan-vs-code adjudication, not a bug.

### Item 2 — CAPTURE FIDELITY: definitive answer (run #12 capture, verbatim)

- **Persona: YES, verbatim.** Child req3 (first turn) system prompt line 7 =
  `T12V worker persona world A: you are the deterministic t12v-a worker.`; root req1 line 7 =
  `T12V leader persona world A: you lead the t12v a vertical E2E team.` (full system texts
  retained in `t12v-mock-capture-run12.json`; run #13 calibration: persona assertion PASS).
- **MCP tool in tools[]: NO — never.** Hard DENY beats override ALLOW: every child request
  carries exactly the 10 team tools, zero mcp entries (tools=10 at setup, `mcp=denied`
  consumption, `mcp:enter allowed=false hasFiber=false`).
- **Scripted attempt + real deny relay: captured verbatim.** req6 (run #12) tool_call
  `{"id":"call_t12v_mtkq2htxfd7514","name":"mcp__t12vmini__ping",...}` followed by
  `role:'tool'` `Error: unknown tool "mcp__t12vmini__ping"` — the denial happens at the
  model boundary (tool not registered), relayed as a real tool-result, not fabricated.
- Tool-call wire shape note: this DeepSeek-compatible endpoint captures
  `{id,name,arguments}` flat (not OpenAI `{function:{...}}`) — the runner's extractor
  handles both (T12-V12).

### Item 3 — WINDOW OWNER: PINNED ROW-OWNED → FIXED IN-PLUGIN (T12-V16)

Directive compliance: instrumented the row glue (T12-V15, 42 `[t12v-wl]` sites, log-only),
correlated against the durable session-log silence, and the owner is ROW-OWNED — so it is
FIXED in the plugin lane (zero core patches; NOT a P10 core-instrumentation item).

Mechanism (full chain in `t12v-finding-360s-first-turn.md` "OWNER PINNED" section):
the remote `member.send` was admission-ONLY (S6 facade → durable intent fact →
`{status:'executed'}`, no delivery phase); the P6-T3 messaging coordinator is the only
code that delivers, and its production triggers were the team tool (unreachable by the
runner) and our own p6t6 state route (per-request). Every relay therefore sat undelivered
until the next `/__p6t6/state` query: window = admission → next state query
(47 s → 1021 s, run #13: 961 s). The child was genuinely IDLE the whole time —
"non-idle hold" was an artifact. NOT core maintenance: the burst is triggered by an HTTP
request (never by a timer), and once input is spliced, turns start in 26–69 ms
(session-log) / 106–285 ms whenIdle (glue). All four parent-named subsystems measured
millisecond-scale at delivery time (run #13 A1 00:41:44.142–00:41:45.647:
boundary ms=1, submitted ms=2, whenIdle-done ms=146/170, consumption-resolved ms=1–2,
mcp:enter <1 ms).

Fix — **T12-V16 (`50bcdbb`)**: `member.send` now routes through the coordinator — the
SAME path as the `team_send_message` tool (s6-remote.ts gains the 13th production port
`messaging`, bound-root guard fail-closed like every sibling port; root.ts wires the
existing coordinator instance; the dispatcher case is thin; runner accepts the
`status:'delivered'` outcome shape). Delivery happens AT ADMISSION: intent fact → live
attributed input to the bound child session → confirmation fact, one synchronous chain.
The state-route drain is KEPT as the crash-recovery backstop (§24.2 roll-forward).
`member.followup`/delegate/follow-up already ran the work chain with live delivery
(run #13 V4: 170 ms) — unchanged. Runtime suite 1087/1087 PASS; tsc clean.
Known design gap (documented, unchanged): no boot-time `recoverPendingDeliveries` in the
production row; the dormant `packages/remote` pure-contract handler still carries an
admission-only member.send (documented: mounting it without the coordinator would
reintroduce the latch).

### Run #13 (pre-fix baseline, T12-V15 instrumented) — 49/55, cleanest split yet

Nonce `mtksabrjddb95b`, 2026-09-03T00:25:32Z → 00:56:56Z (job pwsh-167, exit 0, 31 min
24 s), phases build,fresh1,restart1. Matrix: **V1 11/11 · V2 7/8 · V3 5/6 · V4 6/6 ·
V5 6/6 · LIFECYCLE 5/9 · RESTART 9/9**. ALL SIX failures are the window-latch class
(V2/V3: the single timing assertion each — "ack within 480 s"; every substantive/contract
assertion PASSES. LIFECYCLE: the 4-failure cascade of the SUBSPAWN latch — no
descendant in 900 s → origin/ack/drain=0). Per the parent's split-verdict framing:
substantive assertions ok + timing assertions honest-fail with measured latency
(V2 961 s admission→drain; V3 denied-ack ~1.0 s PAST the 480 s budget — mock req6
@00:41:44.662 vs deadline 00:41:43.6).

### Run #14 (T12-V16 verification) — 51/55, window-latch class GONE

Nonce `mtktg7nu58c6d0`, 2026-09-03T00:58:06Z → 01:13:31Z (job pwsh-171, exit 0, 15 min
25 s), phases build,fresh1,restart1. Matrix: **V1 11/11 · V2 8/8 · V3 6/6 · V4 6/6 ·
V5 6/6 · LIFECYCLE 5/9 · RESTART 9/9 = 51/55**.

- **V2 pass=true in 0.9 s** (was 480 s honest-fail / 961 s measured pre-fix).
  Coordinator outcome verbatim: `{"status":"delivered","deliveryMode":"direct",
  "deliveredToInstanceId":"inst-1esq73x1qs9x",…}` — the T12-V16 13th-port path.
  Durable child log: inbox spliced @00:58:16.969 → turn/start @00:58:16.971 (+2 ms)
  → model request @00:58:17.101 → CHILD_FIRST_ACK. **Admission→model ≈ 700 ms.**
- **V3 pass=true in 3.1 s** (was ~1.0 s past the 480 s deadline pre-fix). External
  hard deny held at the consumption boundary: override ALLOW admitted (durable record
  `ovr-mcp-inst-1esq73x1qs9x-g0`), effective cell `mounted=false, deniedBy
  externalHardDeny`; model tool-call `mcp__t12vmini__ping` (req5 @00:58:19.239) failed
  in the real agent loop; MCP_DENIED_ACK (req6 @00:58:19.551) well inside budget.
- **V4 pass=true in 2 s** (delegate task text reached the durable child log, turn
  settled, durable truth committed).
- **LIFECYCLE 5/9 — the ONLY failures in the run, and they are NOT timing**: the
  SUBSPAWN delivery part of the fix works (prompt delivered at admission; model returned
  the scripted `subagent` tool-call, req8 @00:58:22.788) — but the runtime then honestly
  relayed `Error: unknown tool "subagent"` (req9 @00:58:23.416). Root cause pinned:
  the vertical-slice composition gives NO session a `subagent` tool — every one of the
  11 mock requests carries `tools=10` = exactly the frozen 10 shipped team tools; the
  profile root is an empty list, the home has no agent presets, and the patch layer
  inserts only the two harness rows (production team row + p6t6). So a subagent
  descendant can never exist in this composition; the 900 s discovery timeout and the
  honest `drained=0` are structural, not latency. Archive (quiescence gate passed,
  steps close-admission→interrupt→drain-descendants→wait-quiescence→release-residency
  →commit-archive, residencyDropped=true), restore (SETTLED, activityVersion 5),
  follow-up admitted + settled (FOLLOWUP_ACK @01:13:27.961) all PASS. This is a
  scenario/composition mismatch, not a core, row, or window defect — see
  `t12v-finding-lifecycle-subagent.md`. Not fixed in-lane: the row's 10-tool set is the
  frozen EXPECTED_TOOL_COUNT=10 and adding agent capabilities to the slice composition
  would change what is under test.
- **RESTART 9/9 in 3.1 s** (A2 cold boot 01:13:30.435, row ready 01:13:30.585,
  RESTART_ACK @01:13:31.011; same root/TeamSession/MemberInstance re-opened, zero
  duplicates, follow-up turn settled).
- Correlate (`t12v-run14-correlate.txt`, glue A1=77 / A2=26 lines): **no
  admission→drain gap anywhere** — every send/deliver/follow-up event is
  millisecond-scale; the only multi-second gap in the whole run is 904 s = the runner's
  OWN descendant-discovery wait (self-inflicted scenario timeout, expected given the
  structural cause above).
- **Split verdict (run #14)**: all substantive assertions pass; all timing assertions
  pass (V2 700 ms, V3 311 ms to denied-ack, LIFECYCLE SUBSPAWN relay <1 s); the 4
  LIFECYCLE descendant-family failures are honest and now proven structural
  (composition lacks the subagent tool), with measured + verbatim evidence. Budgets
  UNCHANGED (no escalation).

### Standing invariants (every run)

run.mjs byte-identical to base `62c7c81`; test-use tree pristine `cd5ef81481…`; :3080
pre/post 200; T12 ports closed post-run; worktree porcelain 0; zero core patches
(budget 0); commits T12-V10…T12-V16 on `task/T12-vertical-slice` only, never pushed.

---

# ITERATION #3 (parent final directive; 2026-09-03 01:29–01:53Z) — DEFINITIVE

This section supersedes all earlier iterations. Parent directive (three messages):
(1) the resume fix in the parent's LITERAL form; (2) V3 denied-ack budget 480 s →
600 s; (3) ONE final full chain with homes kept populated, final per-assertion
matrix, split verdict; the in-flight run IS the final run (no further full chain —
a single-run 5-phase tally would require wiping homes, offered on request only);
then a TARGETED state-route probe (parent "run11b" = my run16b) closes vertical
defect #7 on its own evidence.

## Commits of the final code (branch `task/T12-vertical-slice`, never pushed)

- **T12-V18 (`8b3f9f5`)** — `agent-bindings.mjs` resume loop: the parent's literal
  two lines (L933 leader-instance skip `String(member.instanceId) ===
  LEADER_INSTANCE_ID`; L934 keyless-row guard `childSessionId === undefined ||
  null`) on top of the T12-V10 structural guard / T12-V17 leader skip. This is
  T12-added row glue (T12-B2 family), NOT upstream code; core budget stays 0.
- **T12-V19 (`ff7902d`)** — runner: V3 denied-ack budget 480→600 s (single site,
  L1651); every other budget untouched (ten 480 s + two 900 s sites verified).
- **T12-V20 (`bf0373a`)** — runner: RESTART failure-path wording aligned with the
  accepted classification (T12-B2 glue defect, not a "shipped" defect);
  string-only, failure paths only.
- **T12-V21 (`c0b16f2`)** — runner: new `stateprobe` phase (throwaway probe
  homes `references/.dsh-test-t12-probe-a|b`, dedicated ports 3185/3186; boots
  SPROBE-B world-B variant mcpServer:null + SPROBE-A world-A style; records raw
  `GET /__p6t6/state` request + full response per world; 8 assertions; evidence
  `t12v-stateprobe-run16b-<nonce>.json`) + fresh-home preflight made
  phase-conditional (A ← smoke|fresh1|restart1, B ← fresh2|handoff, C ← handoff;
  per-boot fail-closed inside bootWorld stays unconditional).
- **T12-V22 (`3e7da91`)** — runner: stateprobe serverName assertions corrected to
  the real path `governance.sessions.<rootSessionId>.mcp.serverName` (first
  attempt's 2 failures were an assertion-path bug in the probe, not a system
  finding — both attempts' evidence retained).

## Definitive run: **run #16** (= parent "run #11 IN FLIGHT"), nonce
`mtkumols991e58`, 2026-09-03T01:31:08Z → 01:46:27.753Z, job pwsh-173, exit 0,
phases `build,fresh1,restart1` — **51/55**, zero phase failures

Build: tsc legacy exit 0 + runtime exit 0, T12-V18 glue placed, import probe
`LOADED name=dsh-agent-team`. A1 booted ~2 s; row ready toolCount=10;
rows `{dsh-agent-team:true, p6t6-team-tools:true}`. Mock: 11 requests captured
(`t12v-mock-capture-run16.json`); durable logs archived (`run16-home-a/`,
`run16-instances/`, `t12v-run16-correlate.txt`).

### Per-assertion matrix — RESTART (the verdict-deciding leg)

Resume part — run #16 on the final code, **9/9 in 3.01 s**:

| # | assertion | result |
|---|---|---|
| 1 | resume boot: same Team root (rootSessionId unchanged) | OK |
| 2 | resume boot: same durable TeamSession id | OK |
| 3 | resume boot: SAME MemberInstance re-opened (instanceId + childSessionId stable across restart) | OK |
| 4 | resume boot: NO duplicate members (each instanceId exactly once) | OK |
| 5 | resume boot: no duplicate root session materialization (exactly one root session log) | OK |
| 6 | resume boot: no duplicate child session materialization for the worker | OK |
| 7 | projection resumes after restart (same TeamSession, members intact) | OK |
| 8 | real follow-up turn admitted after restart | OK |
| 9 | restart follow-up turn settled against the mock (durable child log) | OK |

Durable correlation (`t12v-run16-correlate.txt`): A1 stopped 01:46:24.589 → A2
booted 01:46:26.658 (**2.07 s**) → `boot:root-ready session-t12v-a-root-mtkumols991e58
phase=resume ms=52` → `boot:member-resume-start session-team-child-7052c693304423b8d90e33dd3a830757
member=inst-0dsioqp1gvac` (the SAME child SessionId + SAME MemberInstance the
create side bound) → member setup 1–2 ms → follow-up `deliver:boundary-done ms=1`
→ RESTART_ACK (mock req11) 01:46:27.188. **Bootable restart demonstrated on the
final code** (parent GO conditions: "restart stable" and "no identity
duplication" — the latter = resume #4–#6 + identity #3–#5 below).

Identity part — last recorded by run #12 (the only recent chain that ran
fresh2; inherited into runs #13–#16 via persisted state): 5/6 + 1 honest
structural FAIL:

| # | assertion | result |
|---|---|---|
| 1 | fresh #1 worker is a REAL child session (durable log under home A) | OK |
| 2 | fresh #2 worker is a REAL child session (durable log under home B) | OK |
| 3 | distinct member instanceIds across the two roots (no instance collision) | OK |
| 4 | distinct child SessionIds across the two roots (no child SessionId collision) | OK |
| 5 | each child Session materialized exactly once under its home (no duplicate Agent bindings) | OK |
| 6 | precondition reachability: SAME member instanceId under a DIFFERENT root (plan §12 literal) | FAIL — **UNREACHABLE BY CONSTRUCTION** (honest): identity.ts derives instanceId as `inst-` + token(specString,12) with no explicit-instanceId parameter; the plan's literal precondition is unsatisfiable in the current code shape. Documented plan-vs-code divergence; separate issue, not a resume defect. |

Combined RESTART: **14/15 OK; the single FAIL is the documented-by-design
unreachable literal precondition** — identical verdict in every run since it was
first recorded.

### Per-assertion matrix — V3 (run #16, final code, 6/6 in 0.71 s; budget now 600 s)

| # | assertion | result |
|---|---|---|
| 1 | member override ALLOW mcp[t12vmini] admitted (durable override record returned) | OK |
| 2 | turn settled after the mcp tool call was handled by the real agent loop | OK |
| 3 | no mcp mount established: effective mcp cell mounted===false despite the override (external hard deny held) | OK |
| 4 | child session log records the mcp tool attempt at the consumption boundary | OK |
| 5 | the model ATTEMPTED the mcp tool and the real agent loop relayed the denial | OK |
| 6 | model request tool schema omits the mcp tool (denied at the model-consumption boundary) | OK |

Latency: mcp tool-call (mock req5) 01:31:18.597 → MCP_DENIED_ACK (req6)
01:31:18.705 = **108 ms** against the directed 600 s budget (was the ~482 s
burst pre-T12-V16). Wide margin — no budget pressure observed.

### Per-assertion matrix — V2

World A part — run #16 on the final code, **8/8 in 0.99 s** (child ack
~0.2 s after member.send admission — the T12-V16 window fix):
1. team_create_member executed (shipped tool via the production executeTool seam) — OK
2. effect carries instanceId + childSessionId (discovered, not hardcoded) — OK
3. child session log materialized under DSH_HOME (real DSH child Session) — OK
4. child session header cwd == W_child — OK
5. member.send delivered (coordinator outcome targets worker A) — OK
6. child turn settled against the mock — OK
7. persona installed and visible in the REAL prompt assembly — OK
8. effective model = row static selection (deepseek-official/t12v-model-a) — OK

World B part (mcpServer:null variant) — last recorded by run #12 (pre-T12-V16;
no final-code run included fresh2 — see "Leg coverage" below):
1. world B booted with mcpServer:null (instance up, row mounted, health ok) — OK
2. state route well-formed for the mcpServer:null row (T12-V11 guard) — OK
3. team_create_member executed under mcpServer:null — OK
4. child session header cwd == W_child (world B) — OK
5. child turn settled against the mock (no crash from mcpServer:null) — FAIL in run #12 (window-latch era; T12-V16 fixed exactly this delivery path — the world-A analog, same mechanism, is green on the final code)
6. effective model = t12v-model-b — FAIL in run #12 (same latch root cause: the turn never settled, so the model request never reached the mock)
Plus run16b SPROBE-B (final code, world-B variant, targeted probe): boot + row
mounted + health toolCount=10 + state route 200 + mcp cell
`{mounted:false, serverName:null}` — **4/4** (see defect #7 below).

### Per-assertion matrix — LIFECYCLE (run #16, 5/9, 904.8 s — FINAL, structural)

1. a real descendant session was created under the member child session — FAIL (structural)
2. descendant session header marks origin=subagent with parentSession == member child — FAIL (structural)
3. descendant turn settled against the mock — FAIL (structural)
4. member.archive executed (quiescence gate passed — a failed drain would have rejected it) — OK
5. archive reports an HONEST numeric drained count >= 1 — FAIL (structural; no descendant exists to drain, drained=0 is the HONEST number)
6. residency dropped on archive — OK
7. member.restore executed — OK
8. member.followup admitted after restore — OK
9. real follow-up turn settled on the restored member — OK (FOLLOWUP_ACK req10 01:46:24.128)

Structural cause (pinned, `t12v-finding-lifecycle-subagent.md`): the
vertical-slice composition gives NO session a `subagent` tool — every mock
request carries `tools=10` = exactly the frozen 10 shipped team tools; the
scripted `subagent` tool-call is relayed verbatim `Error: unknown tool
"subagent"`; a descendant can never exist in this composition. Not a core/row/
window defect; composition scope decision for parent. **FINAL per parent.**

### Remaining legs — V1, V4, V5 (run #16, final code)

V1 fresh Root: **11/11** (1.0 s) — create boot, durable TeamSession (teamSessionId
=== rootSessionId), zero synthetic members, REAL Root Agent under DSH_HOME with
cwd == W_root, prompt accepted, turn settled vs mock, mock-env model path, leader
persona in the real prompt assembly.
V4 delegate real work: **6/6** (0.8 s) — exact task text reached the REAL child
session log; real turn settled; model request carried the exact task text.
V5 Projection/Remote: **6/6** (33 ms) — team.getProjection through the
BROWSER-FACING public Remote `/team-remote` (test side never uses TeamDomain
direct reads as an assertion source); schemaVersion 2 (P8-S freeze); field set
matches the frozen v1 contract (superset for v2); real leader + discovered
worker in members; ledger non-empty.

### Leg coverage statement (honest)

The definitive run (per parent directive) was `build,fresh1,restart1`. Legs
covered on the final code: V1, V2-A, V3, V4, V5, LIFECYCLE, RESTART (resume) —
**51/55, all non-structural legs green, RESTART 9/9**. The fresh2 (V2-B) and
HANDOFF legs were last recorded by run #12 (09-02 23:23Z, pre-T12-V16): V2 11/14
(3 latch-era failures, exactly the defect T12-V16 fixed), HANDOFF **17/17**
(3.15 s). No post-T12-V16 run has included fresh2/handoff because every later
chain was the parent-directed `build,fresh1,restart1` shape. The world-A analog
of every latch-era failure is green on the final code (run #16), and run16b
SPROBE-B demonstrates the world-B variant itself is boot+row+state well-formed on
the final code. If parent wants a single-run 5-phase tally on the final code, it
requires wiping the kept-populated homes — offered on request.

## Vertical defect #7 (nullable-MCP state route) — CLOSED

Two read sites on the mcp-less path, both in the T12-added harness row
(`plugin.mjs` state route), both guarded in one pass, zero core edits:
site 1 `config.mcpServer.name` (T12-V11, `65e1982`); site 2
`views.mcpView.allowed` (T12-V14, `9ef78ca` — the parent's "new finding" from
the 09-02 run #11 B1 event, already fixed before the definitive run).

Targeted closure probe (parent step 4; my run16b): dedicated throwaway homes/
ports (3185/3186) so the kept-populated run homes could not be touched; raw
request/response recorded. **Final probe (nonce `mtkvds5d91659e`, T12-V22):
8/8 PASS in 12.5 s** — evidence `t12v-stateprobe-run16b-mtkvds5d91659e.json`:

- SPROBE-B (mcp-less world-B variant, mcpServer:null, port 3185): state route
  **200 (no 500)**; TEAM row state well-formed (rootSessionId/phase/
  teamSession); row health ok toolCount=10; **governance mcp cell =
  `{"mounted":false,"serverName":null}`** — the T12-V14 shape (mcp view fields
  omitted instead of 500).
- SPROBE-A (mcp-configured world-A style, mini-MCP at 3492, port 3186): state
  route 200; well-formed; health ok; **mcp cell = `{"mounted":false,
  "serverName":"t12vmini", "allowed":false, "source":{...}, ...}`** — real
  serverName + full view fields intact (denied state is correct here: external
  hard deny, no override on a fresh boot).
- First attempt (nonce `mtkvb8scf3505a`, retained as-is:
  `t12v-stateprobe-run16b-mtkvb8scf3505a.json`): 6/8 — the 2 failures were the
  probe asserting `body.serverName` (a path that does not exist); the recorded
  response bodies of that attempt already show the correct values. T12-V22
  corrected the assertion path; corrected run = the closure evidence above.

Observed surface artifact (NOT a defect, flagged for parent): the state route's
member projection serializes the leader row's `childSessionId`/`lifecycle` as
the string `"undefined"` (same `String(undefined)` pattern as the resume bug,
different surface — the p6t6 state route member list; read-only, response is
well-formed 200). Cosmetic; no fix applied (scope: the directed closure was the
500).

## Accepted deviations to record (parent msg 2)

- **T12-V8 (`ed56641`)** — mirror-copy drop (no 254-file dist-mirror→source
  copy). Consistent with the dist-glueUrl mechanism.
- **T12-V9 (`b125c06`)** — phase-level failure continuity (a fatal phase
  failure is recorded and the run continues to the remaining phases).
- **P9 kickoff memo flag**: production-boot recipe = dist build + dist-glueUrl +
  junction bridge (node_modules link farm); no in-source `.js` copies.

## Standing invariants (final state, verified after run16b)

run.mjs byte-identical to base `62c7c81` (git diff --quiet exit 0); test-use
tree pristine `cd5ef81481…` pre+post both sides (status+diff empty); :3080
probe-only 200 pre/post of every run; **run #16 homes KEPT POPULATED** (home A
6 entries — directed: the final run's homes are evidence; homes B/C empty);
probe homes reset to empty; ALL T12 ports free (3181–3184, 3185/3186 probe,
3492/3496); worktree porcelain 0; zero core patches (budget 0); HEAD
`3e7da91`; commits T12-V18…T12-V22 on `task/T12-vertical-slice` only, never
pushed; evidence in the MAIN repo `dev/agent-workflow/evidence/T12/`, never
git-added.

## SPLIT VERDICT

- **RESTART: GO** — 9/9 resume part on the final code in 3.01 s: bootable
  restart demonstrated (2.07 s to boot, same Team root / durable TeamSession /
  MemberInstance / child Session, zero duplicates, projection resumes, real
  follow-up turn settled). Identity part 5/6 + the 1 documented-by-design
  unreachable literal precondition (separate issue). RESTART decides the
  verdict: **the resume loop is fixed and stable on the final code.**
- **V3: GO** — 6/6 on the final code in 0.71 s; denied-ack 108 ms against the
  directed 600 s budget.
- **V1 / V4 / V5: GO** — 11/11, 6/6, 6/6 on the final code.
- **V2: A = GO** (8/8 final code); **B = CONDITIONAL** — boot/state-route/
  create/cwd legs OK (last recorded run #12 pre-T12-V16; run16b SPROBE-B
  confirms world-B variant boot+row+state well-formed on the final code); the
  two turn-settle-era failures were the latch T12-V16 fixed (world-A analog
  green on the final code). No fresh2 leg on the final code (see Leg coverage).
- **LIFECYCLE: 5/9 — FINAL** — delivery/attempt/real-deny/archive/restore/
  follow-up PASS; the 4 descendant-family assertions honest-fail STRUCTURALLY
  (composition has no `subagent` tool; verbatim `Error: unknown tool
  "subagent"`; tools=10 on all mock requests). If they honest-fail, that is
  final (parent). Composition scope decision for parent.

