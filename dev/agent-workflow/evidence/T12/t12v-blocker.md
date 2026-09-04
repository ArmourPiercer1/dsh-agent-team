# T12 vertical runner blocker

at: 2026-09-02T20:12:56.702Z
phases requested: smoke
see t12v-run.log for the full trace

## error

```
TypeError: file.endsWith is not a function
    at buildProductionRuntime (file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/packages/tools/harness/t12-vertical.mjs:432:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async runSmoke (file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/packages/tools/harness/t12-vertical.mjs:1409:3)
    at async main (file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/packages/tools/harness/t12-vertical.mjs:1287:7)
```

## status 2026-09-02T22:36Z — RUN #11 IN PROGRESS (interim; updated at settlement)

The trace above is STALE (T12-V7-era walk-shape bug, fixed in T12-V7 9db339a). Since then, the
2026-09-03 parent iteration directive drove three committed fixes; run #11 (nonce
mtkob35v2077d6) is the first run with all of them live:

- T12-V10 (952b003) — agent-bindings.mjs resume loop: structural guard for the v2 leader row,
  which carries NO childSessionId key. String(undefined) produced SessionId("undefined") and
  killed every A2 resume boot (runs #6-#10, 5th consecutive). RESTART was permanently
  "not evaluated"; with the guard, resume boots now proceed and the RESTART assertions are
  genuinely evaluated.
- T12-V11 (65e1982) — p6t6 harness row plugin.mjs L433: mcpServer is row-config-legal null
  (host.ts row validation accepts it), so world-B's mcpServer:null variant 500d the state route
  with "Cannot read properties of null (reading 'name')" (runs #6-#10). Now serverName: null.
  Parent-authorized harness-row bug fix.
- T12-V12 (de2c0a3) — runner: verbatim mock capture (full messages + full tools schema, no
  truncation) and calibration-time content assertions (T12-V13 infra): persona/model (V2-A),
  model-b (V2-B), mcp attempt/denial-relay/schema-omission (V3) are deferred checks evaluated
  against the FINAL capture + durable logs. Run #10's "system texts=[] / model=undefined /
  tools=[]" readings were deadline-timed lookups made while the latched turn had not yet
  reached the mock (burst settled ~957 s post-admission); the captured requests themselves
  carry the full prompt assembly (rec4: model=t12v-model-a, roles system/user/..., tools=10).
  V5 now asserts schemaVersion === 2 strictly per P8-S backend-contract-freeze.md.

Run #11 launch 2026-09-02T22:34:09Z: pre-flight all green (test-use pristine cd5ef81481,
ports free, fresh homes, :3080 pre 200); build + byte-identical glue + import probe LOADED
name=dsh-agent-team; A1 row toolCount=10; V1 pass=true at 22:34:19Z. Remaining expectation:
shipped-runtime window latch is INTERMITTENT — latency assertions may still fail honestly;
content/contract assertions now calibrate against the final capture. No open blocker; this
file's stale trace is superseded by the above.

## status 2026-09-02T23:25Z — RUN #11 SETTLED; T12-V14 COMMITTED; RUN #12 PENDING

Run #11 settled 23:21:06Z, exit 0, 4/8 scenarios, 74/84 assertions (run #10: 4/8, 63/84).
Verified deltas: T12-V10 A2 resume boot succeeded (RESTART 14/15 — sole fail is the
plan §12 literal precondition, unreachable by construction); V3 deferred content checks
all pass (real mcp tool-call attempt at req5, denial relayed at req6, model-boundary
tool schema omits the denied tool); V5 passes under strict schemaVersion===2 (P8-S
contract confirmed, no contradiction); V2-A persona/model calibrated pass (latched turn
settled late with full verbatim capture).

Two open items, both handled:

1. **T12-V14 (9ef78ca, committed)** — run #11 exposed a SECOND mcpServer-null deref in the
   p6t6 state route: T12-V11 fixed config.mcpServer.name (L433), then the route 500d at
   views.mcpView.allowed (L441) because with mcpServer:null the views object exists but
   mcpView is null (run #11 B1 23:05:43.630Z / C1 23:21:03.502Z, "Cannot read properties
   of null (reading 'allowed')"). Guarded; an mcp-less row now reports no mcp view fields.
   Live verification: run #12 (launched after this status).
2. **Window latch (shipped-runtime behavior, not a T12 bug)** — intermittent per-run and
   per-agent: V2-A settled 481 s past its 480 s deadline (content checks still pass via
   calibration), V3 denied-ack 2.2 s past deadline, V2-B and the LIFECYCLE SUBSPAWN turn
   latched their full 900 s windows (zero mock traffic — honest fails). Not fixable from
   the T12 lane (no CORE PATCH BUDGET); documented as the dominant remaining failure class.

No other blocker. t12v-run11-monitoring.md holds the full matrix + post bracket.

## status 2026-09-03T00:12Z — RUN #12 SETTLED; T12-V14 VERIFIED; LANE DELIVERABLES COMPLETE

Run #12 (nonce mtkq2htxfd7514) settled 00:10:06Z, exit 0: **4/8 scenarios, 75/84 assertions**
(run #11: 74/84; run #10: 63/84). T12-V14 verified in BOTH mcp-less worlds: V2-B state route
assertion PASS (well-formed body, memberCount 1) and C1 probe passed instantly (no 10 s 500
timeout). T12-V10 re-verified (A2 resume boot, second consecutive run). The subagent-turn
re-drive on resume reproduced (req9). Post bracket all green (porcelain 0 at HEAD 9ef78ca,
run.mjs byte-identical, test-use pristine, :3080 200, ports closed).

Remaining 9 failed assertions, all explained and lane-limit-bound:
- window latch (shipped-runtime, intermittent, no CORE PATCH budget): V2-A 480 s latency
  (turn settled 483 s late — calibrated content checks PASS), V2-B 900 s (no traffic —
  calibrated model-b check fails with explicit "never settled" reason), V3 480 s latency
  (denied-ack 2.1 s late — all 3 calibrated content checks PASS), LIFECYCLE SUBSPAWN 900 s
  (+3 dependent, drained=0 genuine numeric).
- RESTART §12 literal precondition (same instanceId under a different root): unreachable by
  construction (identity.ts L289-298); flagged for main-agent plan-vs-code adjudication.

No open blocker. Evidence: t12v-run12-all.txt, t12v-summary-run12.json,
t12v-mock-capture-run12.json, t12v-report-draft.md (iteration #2 section).

## status 2026-09-03T00:55Z — run #7 postmortem: owner pinned, T12-V16 committed, run #14 pending

The parent's three-item run #7 postmortem directive:

1. **RESUME BUG — fixed + verified** (T12-V10 952b003, live-verified runs #11+#12; run #13's
   restart1 leg is the third live confirmation, pending settlement).
2. **CAPTURE FIDELITY — answered definitively** (run #12 capture): persona YES verbatim in the
   child system prompt; mcp tool NO in any tools[] (hard DENY beats override ALLOW); scripted
   attempt + real deny relay captured verbatim. See report (split verdict per condition).
3. **WINDOW OWNER — PINNED: ROW-OWNED (our code), fixed in T12-V16 (50bcdbb).** The remote
   member.send was admission-only: the S6 facade committed the durable intent fact and returned
   {status:'executed'} with NO delivery phase; the only production drain was our own p6t6 state
   route (plugin.mjs, per request) — so every relay sat undelivered until the next state query
   (the 47 s–>1021 s windows; child genuinely idle; "non-idle hold" was an artifact). NOT core
   maintenance → NOT a P10 item: fixed in the row lane, zero core patches (s6-remote.ts 13th
   port + coordinator routing; root.ts wiring; runner outcome-shape adaptation). Runtime suite
   1087/1087 PASS; tsc clean. Full evidence chains: t12v-finding-360s-first-turn.md
   ("OWNER PINNED" section).

Live verification = run #14 (build,fresh1,restart1): expected V2-A ack within seconds of the
send (followup:enter at admission). Run #13 (pre-fix, instrumented T12-V15) settles first and
supplies the pre-fix burst/latency baseline + the restart1 leg for item 1. No budget
escalations anywhere.

## status 2026-09-03T01:15Z — RUN #14 SETTLED: WINDOW-LATCH CLASS GONE; NO OPEN BLOCKER

Run #14 (nonce `mtktg7nu58c6d0`, 00:58:06Z → 01:13:31Z, job pwsh-171, exit 0, 15 min 25 s)
settled **51/55**: V1 11/11 · V2 8/8 · V3 6/6 · V4 6/6 · V5 6/6 · LIFECYCLE 5/9 ·
RESTART 9/9. T12-V16 live-verified: V2 coordinator `status:'delivered'` at admission,
child turn 00:58:16.969 splice → +2 ms turn/start → 700 ms to model; V3 denied-ack
311 ms inside budget; correlate shows ZERO admission→drain gaps (glue A1=77/A2=26, all
millisecond-scale). The window-latch failure class (runs #5-#13) is gone.

Remaining 4 failures, all LIFECYCLE descendant family, are a DIFFERENT pinned cause —
structural, not timing: the vertical-slice composition (empty profile root, no agent
presets, two-row patch layer) gives every session only the 10 frozen team tools; the
model's scripted `subagent` call is honestly relayed `Error: unknown tool "subagent"`
(verbatim in t12v-mock-capture-run14.json seq9), so a subagent descendant cannot exist.
Archive/restore/follow-up all pass with a genuine `drained=0` through the full
quiescence-gate step chain. Documented in `t12v-finding-lifecycle-subagent.md`;
deliberately NOT fixed in-lane (would change what the slice tests — composition scope
decision for the parent / T12-decision.md). No budget escalations. Invariants held:
HEAD 50bcdbb, porcelain 0, run.mjs byte-identical vs 62c7c81, test-use pristine
cd5ef81481, :3080 pre/post 200, T12 ports closed.

NO OPEN BLOCKER. All three parent postmortem items closed: (1) resume bug fixed
(T12-V10) + verified 3 runs; (2) capture fidelity answered definitively (run #12);
(3) window owner pinned row-owned + fixed in-plugin (T12-V16) + verified run #14.

## status 2026-09-03T01:31Z — PARENT FINAL DIRECTIVE: both changes IN, RUN #16 launched

Parent final directive: (1) apply the resume fix in the literal form directed
(parent's "T12-V6"), (2) V3 denied-ack budget 480 s -> 600 s (parent's "T12-V7"),
(3) then ONE final full chain (parent's "run #9") with homes kept populated.

Done before launch:
- T12-V18 (8b3f9f5): agent-bindings.mjs resume loop now carries the directive's
  literal guard pair — `if (String(member.instanceId) === LEADER_INSTANCE_ID)
  continue` + `if (member.childSessionId === undefined || member.childSessionId
  === null) continue` — placed before any stringification, mirroring the
  create-path leader exclusion (L864-866); the T12-V10 typeof/empty structural
  guard retained immediately below as second line of defense. Behavior unchanged
  from T12-V17 (RESTART 9/9 in runs #11-#14); this is literal-form conformance
  for the final evidence, not a functional change.
- T12-V19 (ff7902d): V3 USE_MCP denied-ack wait 480_000 -> 600_000 (+ message +
  comment) — exactly one site. Every other budget unchanged (V1/V2-A/V4/
  RESTART/handoff 480 s; LIFECYCLE 900 s).
- tsc -p packages/runtime/tsconfig.json exit 0; HEAD ff7902d; porcelain 0;
  run.mjs byte-identical vs 62c7c81.
- Killed run #15 (my numbering) mid-LIFECYCLE-wait so both changes are in
  before the decisive chain; wiped its residual home A + partial A1/A2 logs.

RUN #16 (parent's "run #9") in progress: job pwsh-173, phases
build,fresh1,restart1 — the targeted restart1 (A2 on home a, phase=resume) is
the reachable RESTART-invariant demonstration GO conditions 4 and 14 need.
fresh2/handoff legs not re-run: unchanged code paths, already green in run #14
(51/55, only the structural LIFECYCLE descendant family failing) — the final
per-assertion matrix states the evidence source per assertion family.
Homes will be KEPT POPULATED after settlement (evidence; do not wipe).

Expectations: fresh1 V1-V4 green in seconds (post-T12-V16); V3 denied-ack green
with wide margin under the 600 s bound; LIFECYCLE 5/9 again (delivery + attempt
+ real deny relay pass; the 4 descendant-family assertions fail STRUCTURALLY —
composition has no subagent tool, verbatim `Error: unknown tool "subagent"`,
tools=10 on all 11 mock requests; pinned in t12v-finding-lifecycle-subagent.md;
final per parent directive); restart1 RESTART 9/9 with row health ok=true and no
setupError.

## status 2026-09-03T01:35Z — PARENT: DEFINITIVE FULL CHAIN ordered (my run #17 = parent's "run #10")

Parent rejects the older "shipped BUG #1" classification of the resume-loop
crash: the resume branch is T12-added glue (T12-B2 family), not upstream code;
CORE PATCH BUDGET = 0 constrains references/deepseek-harness-test-use only;
GO conditions 4 and 14 require a demonstrated bootable restart. Accepted —
and already satisfied: the fix is IN as T12-V18 (8b3f9f5) in the parent's
literal two-line form (leader skip + keyless-row guard before any
stringification, mirroring the create-branch exclusion L864-866; zero core
edits), and the V3 budget is IN as T12-V19 (ff7902d). No re-classification to
argue; the resume crash is carried as a vertical-phase T12-glue defect like
B1-B6/M1-M4/H1/H4.

State check vs the ordered steps:
- Step 1 (fix, "T12-V8"): already committed as T12-V18 8b3f9f5 — the two
  directed lines are present verbatim at agent-bindings.mjs L933-934, inside
  the resume for-loop, before the child-id stringification. (Parent's
  "~L880-902 / `const child = String(member.childSessionId)`" describes the
  pre-fix file; T12-V10/V17/V18 have since restructured that region, with the
  directed lines on top of the T12-V10 structural guard.)
- Step 2 (V3 480->600, "still unapplied"): already committed as T12-V19
  ff7902d (single site L1651). V2-A stays 480 s (L1583); V2-B (fresh2
  childAck) stays 900 s (L1971); LIFECYCLE waits stay 900 s (L1770/L1775).
  Verified by grep — no budget touched beyond the one directed.
- Step 3 (rebuild + smoke): covered by the runner's phase dispatch — `smoke`
  is a first-class phase (builds dist, boots a throwaway world on home A,
  asserts state/root-header/one real root turn, resets home A to empty).
- Step 4 (DEFINITIVE chain "run #10"): will be my run #17,
  `--phases smoke,build,fresh1,fresh2,restart1,handoff` (the full directed
  5-phase chain with the directed smoke first; the dispatch runs smoke, whose
  internal build already picks up the fixed glue, then the standalone build
  phase re-stamps tsc + import probe), fresh homes a/b/c, all brackets.
- Step 5 (report): run #17 becomes the definitive tally; run #16 (my
  numbering of the parent's "run #9") stays the prior data point — its
  evidence files remain untouched, run #17 files get run17 naming.

Sequencing: run #16 (job pwsh-173) must settle first (shared homes + ports
3181-3184; LIFECYCLE 900 s wait ends ~01:46:20Z, then the restart1 leg). At
settlement: archive run16 evidence (home-a copy, instances copy, dump renames,
correlate), wipe home A only (B/C already empty), then launch run #17.
Homes stay POPULATED after run #17 settles (directed). Expected run #17
settlement ~02:20-02:30Z (smoke ~1.5 min + fresh1 ~18 min dominated by the
900 s LIFECYCLE wait + fresh2/restart1/handoff).

## status 2026-09-03T01:50Z — run #16 SETTLED (definitive, exit 0, 51/55); T12-V21 in; run16b launched — NO OPEN BLOCKER

The 01:35Z plan above (launch a 5-phase run #17) is SUPERSEDED by parent msg 3:
the in-flight run IS the final run; homes must stay populated; no further full
chain. Executed instead:

1. **run #16 (job pwsh-173, = parent "run #11 IN FLIGHT") settled 01:46:27.753Z,
   exit 0, phases=build,fresh1,restart1, nonce mtkumols991e58** — the definitive
   tally on the final code (T12-V18 literal resume guard + T12-V19 600 s V3
   budget + T12-V20 wording):
   - V1 11/11 (1.0 s) · V2(world A) 8/8 (0.99 s, child ack ~0.2 s) ·
     V3 6/6 (0.71 s; mcp tool-call req5 01:31:18.597 → denied-ack req6
     01:31:18.705 = **108 ms**, wide margin under the 600 s budget) ·
     V4 6/6 (0.8 s) · V5 6/6 (33 ms) · LIFECYCLE 5/9 (904.8 s — the 4
     descendant-family assertions honest-fail STRUCTURALLY: composition gives
     no session a `subagent` tool; pinned final per parent) ·
     **RESTART 9/9 (3.0 s)** — the decisive leg: A2 boot 01:46:26.658
     (~2.1 s after A1 stop), `boot:root-ready phase=resume ms=52`,
     `boot:member-resume-start session-team-child-7052c693… member=
     inst-0dsioqp1gvac` (same child SessionId + same MemberInstance as the
     create side), setup 1–2 ms, follow-up delivered boundary-done ms=1 →
     RESTART_ACK req11 01:46:27.188.
   - Brackets: test-use pristine pre+post cd5ef81481…; :3080 200/200; phase
     failures []; exit 0. Post-run: ports 3181-3184/3492/3496 free; home A
     KEPT POPULATED (6 entries, as directed); homes B/C empty.
   - Archive: run16-home-a/ (pruned: sessions + storages + root files;
     profiles/ excluded — its node_modules is a symlink farm into test-use and
     fs.cpSync following it overflows the stack, 0xC0000409), run16-instances/
     (A1, A2), t12v-{summary,mock-capture,state,port3080-pre,post}-run16.*,
     t12v-run16.log (67 lines), t12v-run16-correlate.txt (268 lines).
2. **T12-V21 committed (c0b16f2)** — runner only: new `stateprobe` phase
   (throwaway probe homes/ports 3185/3186; SPROBE-B mcp-less + SPROBE-A
   mcp-configured; raw GET /__p6t6/state request+response recorded per world;
   8 assertions; evidence t12v-stateprobe-run16b-<nonce>.json) + fresh-home
   preflight made phase-conditional (A ← smoke|fresh1|restart1, B ←
   fresh2|handoff, C ← handoff; per-boot fail-closed in bootWorld stays
   unconditional). Syntax OK; 1 file changed +97/−5.
3. **run16b launched (job pwsh-174)** — `--phases build,stateprobe`: sanctioned
   tsc rebuild + the targeted defect-#7 closure probe. This is the ONLY
   post-settlement runner invocation.

State: **NO OPEN BLOCKER.** Remaining: settle run16b, record run16b evidence,
update report draft with the final matrices, one final split-verdict report.

## status 2026-09-03T01:56Z — ALL SETTLED (final)

- run16b attempt 1 (nonce mtkvb8scf3505a): 6/8 — 2 failures were an
  assertion-path bug in the probe (body.serverName top level vs the real
  governance.sessions.<root>.mcp path); recorded response bodies already
  showed the correct values. Evidence retained as-is.
- T12-V22 (3e7da91): probe assertions corrected. run16b attempt 2
  (nonce mtkvds5d91659e, job pwsh-175): **STATEPROBE 8/8 PASS, 12.5 s** —
  SPROBE-B mcp-less: 200 + mcp cell {"mounted":false,"serverName":null};
  SPROBE-A mcp-configured: 200 + serverName "t12vmini" + full view fields.
  **Defect #7 CLOSED.**
- Brackets after run16b: probe homes reset (0 entries); ports 3181-3186/
  3492/3496 free; :3080 200; test-use pristine; porcelain 0; HEAD 3e7da91;
  run.mjs byte-identical to 62c7c81; run homes A/B/C unchanged (A populated
  as directed).
- t12v-report-draft.md: ITERATION #3 (DEFINITIVE) appended — run #16 tally
  51/55, RESTART/V3/V2/LIFECYCLE per-assertion matrices, leg-coverage
  statement, defect #7 closure, accepted deviations, split verdict
  (RESTART GO, V3 GO, V1/V4/V5 GO, V2 A=GO/B=CONDITIONAL, LIFECYCLE 5/9 FINAL).
- One final split-verdict report sent to parent. Worktree final: HEAD
  3e7da91, porcelain 0, never pushed.
