# G5A Result — G5 live-host MEMBER E2E: 15.1 acceptance row "D1 member tools" + D2 live result + D3 member identity block (v2)

- task: G5A (Team D1-D6 repair v2 — G5 live-host member E2E; plan 15.1 acceptance row
  "D1 member tools": member base file/shell tools + the ten team_* tools + REAL tool calls +
  ordinary-session non-regression; plus live D2 structured-result and live D3 member-
  identity-block checks)
- attempt: 5 (GREEN on run 5; runs 1–4 RED — all harness-side, see TDD red → green)
- verdict: PASS
- blocker_type: none
- base: 3b53e400c7e1b163b62756b25bc7c60c35dcf023
- branch: task/team-d1-d6-v2-G5A
- worktree: .worktrees/team-d1-d6-v2-G5A
- model_route: qiyuan-self/qwen3.8-27b (verified — the runtime declares "powered by the
  qwen3.8-27b model"; A1/B1 precedent: the route is offered exclusively by provider
  qiyuan-self)
- product code touched: NO (RUNNER + EVIDENCE ONLY; no src changes → no rebuild; see
  Install surface)
- elapsed_minutes: ~75 (75-minute timebox; research + 4 red runs + final green run at local
  06:59; commit immediately after)

## Form used (stated explicitly, per task card)

Same durable-runner form as D4/T12: a node `.mjs` runner in `packages/tools/harness/` that
boots the REAL test host (DSH_HOME=`references/.dsh-test`, port 3180, pristine test-use
source @ 76fda729) with the production dist row mounted via the profile-patch seam, steers
ALL model calls (host + every agent) to an in-process deterministic mock over the real
dsh-llm adapter wire (SSE + agent loop + durable zstd session logs), and drives every turn
through PUBLIC seams only (remote `team.create`/`team.listRoots`, `api/session/prompt|
create|selectModel`, the p6t6 observability seam, the mock-captured model requests, and the
durable session logs).

Repeatability: `node packages/tools/harness/g5-member-e2e.mjs --report-dir <dir>` from the
worktree root re-runs the whole S0–S8 scenario. Each run mints a fresh nonce and appends
fresh roots/sessions to the shared home; exit 0 green / 1 red / 2 DEFERRED (port 3180 never
freed within the 20-minute allowance — not needed in any G5A run; the port was free at the
start of every run).

## Requirements coverage (15.1 row "D1 member tools" + live D2/D3)

All steps executed on the REAL test host; final green run `run-20260907-065856` (nonce
mtqeygl503f54c, 12.3s, S0–S8 all pass, **68/68 assertions ok**, exit 0):

1. S0 PRE-FLIGHT (8 assertions): test-use pristine BEFORE (HEAD 76fda729, porcelain empty,
   diff empty); stable :3080 reachable (read-only GET probe → 401); production dist
   artifacts present + dist import probe loads the plugin row; pnpm-style module-resolution
   junctions wired in the worktree (host tree untouched); shared-home pre-existing roots
   enumerated (prior runs' nonce roots — preserved, never destroyed); port 3180 free
   (immediate; no wait); the pre-created control file with the run-unique sentinel written
   into the member workspace.
2. S1 BOOT 1 + DYNAMIC TEAM ROOT (6): host boots on 3180 with the row (production
   `dsh-agent-team` dist row + `p6t6-team-tools` observability row in
   `profiles/web/cordis.patch.yml`; directive boot=1/phase=create) — row create-or-open
   resolved to CREATE for the directive root ROOT_A (`session-g5a-a-mtqeygl503f54c`);
   health `toolCount=10`, ROOT_A live; the DYNAMIC root ROOT_B
   (`session-g5a-b-mtqeygl503f54c`) minted over the browser-facing PUBLIC remote channel
   `team.create` (contract v2, `blueprintRevision` as wire number, response `.durable`);
   `team.listRoots` (v3) enumerates BOTH new roots plus all pre-existing home roots.
3. S2 MEMBER PROVISIONING via the canonical Leader `team_create_member` REAL turn (9): no
   remote member-creation method exists, so the member is created the way a Leader creates
   members — a real Leader turn on ROOT_B over `api/session/prompt` whose mock-replied
   `team_create_member` call EXECUTES: tool result `{status:"executed",
   action:"create-member", effect:{kind:"member-activated", instanceId:"inst-0lyf27z1dpne",
   admissionCode:"ADMISSION_OPEN"}}`; exactly ONE non-leader member row appears under
   ROOT_B; the member child session id equals `childSessionIdFor(ROOT_B, instanceId)`
   (`session-team-child-cf59aaf776c94dc15c1eab3026d9946f`); the member's NATIVE session
   artifact (durable zstd log) has cwd == the member workspace; liveSessions carries the
   child + the root; the pattern-sanctioned p6t6 observability seam `team_list_members`
   lists the new member.
4. S3 MEMBER TOOL TABLE from the REAL member model request (4): the mock capture of the
   member's first real model request (seq=6, model g5a-model) shows the member sees
   EXACTLY the ten `team_*` tools (`team_create_member`, `team_delegate`, `team_follow_up`,
   `team_inspect_config`, `team_list_members`, `team_list_templates`,
   `team_report_progress`, `team_request_control`, `team_resolve_control`,
   `team_send_message`) AND the standard preset base file/shell tools (`read`, `pwsh`
   present; 19 base tools enumerated in the evidence).
5. S4 MEMBER REAL TOOL CALLS — three real member turns, each over the public member-session
   prompt path on the child session (the session controller's `resolve()` PREFERS the live
   agent while the member is resident) (17):
   - (a) file read round-trip: captured tool call `read{file_path:<control file>}` (the
     agent actually issued it); the captured tool RESULT the agent saw contains the control
     sentinel (content round-trips); the durable member log carries the `tool/call` event
     (seq 24) and the CORRELATED `tool/result` (seq 25, via `data.message.source.callId`)
     with the sentinel.
   - (b) shell: captured tool call `pwsh{command:"pwd | Select-Object -ExpandProperty
     Path"}` (canonical pwd cmdlet expanded to the raw path — a plain `pwd` renders a table
     that truncates long win32 paths); the captured tool result IS the member workspace
     path (exact, case-insensitive); the durable pair (seq 50/51) agrees.
   - (c) real team_* call: captured `team_report_progress` carries the OWNING
     `rootSessionId=ROOT_B`, a FRESH unique `requestToken` (`g5a-memteam-<nonce>-tok`), and
     the member's OWN `instanceId`; captured + durable result (seq 76/77) is
     `{status:"progress-recorded", …}` (the activity-progress row landed in the team
     domain).
6. S5 D2 LIVE STRUCTURED RESULT — a delegated work item on the member (11): a real Leader
   turn on ROOT_B executes `team_delegate` (continue form on the EXISTING member instance,
   `requestToken=g5a-work-<nonce>-tok`, `delegationInstanceId=inst-0lyf27z1dpne`); the
   delegate tool call blocked until the member work turn settled. The Leader-facing ACTION
   RESULT — read through the same public seam the Leader model sees it (the Leader's own
   next real model request, mock capture seq=13, `role=tool` message) — carries the C1/C2
   frozen shape VERBATIM: `{status:"executed", action:"delegate", callerRole:"leader",
   effect:{kind:"work-admitted", …, memberResult:{requestToken:"g5a-work-<nonce>-tok",
   status:"succeeded", body:"G5A-WORK-BODY-<nonce>: … the control sentinel is
   G5A-CONTROL-TOKEN-<nonce>."}}, …}` (structured extraction via `parsed.effect`); the
   durable ROOT_B `tool/call`/`tool/result` (seq 48/49) carry the same payload; the member
   log carries the C2 frozen work-delivery prefix `[team-work
   requestToken=g5a-work-<nonce>-tok]` and the member business body as a real assistant
   message (the member actually did the work).
7. S6 D3 LIVE MEMBER IDENTITY (2): the member model request system text (mock capture
   seq=4, corroborated by the durable `request/header` record seq=12 — both agree) carries
   the EXACT B2 scoped block verbatim: `[team-member-context rootSessionId="session-g5a-b-
   mtqeygl503f54c" instanceId="inst-0lyf27z1dpne" role="member"]` + the fresh-requestToken
   rule line; and it does NOT carry the `[team-root-context` block (member, not root).
8. S7 ORDINARY SESSION NON-REGRESSION (7): an ordinary (non-team) session created over
   public `session/create`; session-local `selectModel` steers it to the mock-reachable
   provider (deepseek-official; the documented side effect — deployment default model
   move — is RESTORED to qiyuan-self/qwen3.8-27b afterwards and recorded); a basic turn
   completes; the ordinary session's REAL model request tool table has NO `team_*` tool
   while `read`/`pwsh` are present.
9. S8 CLEANUP (4): the test host stops (`killed=true portFree=true`), port 3180 free
   (re-probed); test-use pristine AFTER (HEAD 76fda729, porcelain empty, diff empty);
   stable :3080 still reachable (401 — untouched, read-only GET probes only); the full
   mock capture (`mock-capture.json`, 15 real model requests with full tools arrays +
   system prompts), the per-request classification dump (`debug-requests.json`), the
   remote-call ledger and `summary.json` are written to the report dir.

Hard-boundary compliance (verified pre AND post by the harness, and independently after
the run):
- `references/deepseek-harness-test-use` pristine at 76fda729799fe9b3848dbe2c211d4b231032b81e
  (HEAD unchanged, `git status --porcelain` empty, `git diff` empty — booted only, never
  written).
- stable :3080 / `D:\deepseek-harness` never touched (read-only GET probe only: HTTP 401
  pre and post; 401 post = the stable instance is alive and was never driven).
- NO host process left: independent process scan after the run found no test-use node
  host; port 3180 not connectable.
- Shared home accumulates the nonce-unique roots of every run BY DESIGN (never destroyed);
  the `team.listRoots` check tolerates and asserts on the pre-existing set.

## Changed files

- `packages/tools/harness/g5-member-e2e.mjs` (NEW, 1637 lines — the durable S0–S8
  acceptance runner; reuses the T12/D4 patterns: DshInstance boot/stop, profile-patch
  seam, zstd multi-frame session-log reader, remote wire helpers, `mock-deepseek.mjs`;
  per-run `summary.json` + `mock-capture.json` + `debug-requests.json` +
  `remote-call-ledger.json` + host/instance/git transcripts; exit 0/1/2)
- `dev/agent-workflow/evidence/team-d1-d6-repair-v2/G5/` (this result + 5 run transcripts:
  4 harness-side RED runs with full detail (incl. full mock captures in runs 3–4) + the
  final GREEN run)

## TDD red → green

All RED runs are HARNESS-side (bugs in the new runner), in order. No product defect
surfaced at any point — the durable logs of the red runs show every product behavior
(durable tool/call + tool/result events, the frozen D2 delegate result, the verbatim D3
identity block) working correctly; the reds were the runner reading its own evidence
wrong:

- run-20260907-064047 (RED): the mock `decide()` early-returned per-class defaults for the
  newest marker-less user message — the runtime-context snapshot the harness appends after
  the turn text on a session's first turn — so no tool calls were ever issued. Harness
  fix: marker-less user messages are SKIPPED (not defaulted); per-class defaults apply
  only after the newest-first marker scan.
- run-20260907-064418 (RED, S0/S1/S2/S3/S7 green; S4/S5/S6 red + S8 crash): S8 crashed in
  `captureGitState` (shared test util) — it writes into `git-post` without creating the
  dir (ENOENT `git-head.log`); the crash also suppressed `summary.json` +
  `mock-capture.json`, losing the per-check detail for that run. Harness fix: mkdir
  `git-post`; write the mock capture + ledger + a new per-request classification dump
  BEFORE the git step; crash-guard S8; `summary.json` always written.
- run-20260907-065333 (RED, S4+S5): with the capture + classification dump saved, the
  shared root causes were pinned (replayed offline against the saved
  `mock-capture.json`):
  1. `requestForMarker`'s session-class filter was INVERTED
     (`isMember ? cls === 'member' : cls !== 'member'` → continue) — it skipped exactly
     the matching records, so every capture-based lookup (member post-result requests AND
     the leader post-delegate request) returned null;
  2. durable `tool/result` correlation used `data.callId`, but on this event type the
     callId lives at `data.message.source.callId` (verified against the durable log
     shape) — every correlated-result lookup missed;
  3. durable `tool/call` `arguments` are JSON strings (Windows backslashes double-escape
     under `JSON.stringify`), so raw-path substring matches failed — replaced with
     parsed-args (`callArgsOf`) and result-text (`resultTextOf`) comparisons; wire
     content is normalized via `wireText` (string-or-array) and wire tool_call arguments
     via `toolCallArgs` (string-or-object).
  Harness fixes: filter de-inverted; `resultCallIdOf()`; the text/args helpers.
- run-20260907-065730 (RED, S4 only — 2 assertions): a plain `pwd` in pwsh renders a
  TABLE whose column width truncates long win32 paths, so the member workspace path never
  appeared in the output (the cwd was in fact correct — proven by the S2 session-artifact
  cwd check). Harness fix: the canonical `pwd` cmdlet expanded to its raw path string
  (`pwd | Select-Object -ExpandProperty Path`), compared exactly (case-insensitive)
  against the member workspace.
- GREEN (final): run-20260907-065856 — S0–S8 all pass, 68/68 assertions ok, exit 0, 12.3s.

## GREEN evidence

- Final run: `dev/agent-workflow/evidence/team-d1-d6-repair-v2/G5/run-20260907-065856/`
  (summary.json = every assertion with detail; mock-capture.json = all 15 real model
  requests incl. full tools arrays + system prompts; debug-requests.json = per-request
  classification; instances/BOOT1 host log + composed-profile dump; git/ + git/git-post =
  pristine test-use pre/post; member-workspace/ = the member's real workspace incl. the
  control file). Key values: member `inst-0lyf27z1dpne` / child
  `session-team-child-cf59aaf776c94dc15c1eab3026d9946f`; S3 tool table seq=6 (19 base
  tools + exactly the ten team_*); S4 capture seqs 6/8/10, durable pairs 24/25, 50/51,
  76/77; S5 Leader-facing result capture seq=13 (`via=parsed.effect`,
  `memberResult.status="succeeded"`, body = the member business body) + durable ROOT_B
  48/49; S6 capture seq=4 + durable request/header seq=12 (both carry the exact B2 block);
  S7 no team_* in the ordinary table + default model restored; S8 portFree=true, test-use
  HEAD/porcelain/diff clean, :3080 probe 401.
- Red transcripts retained: run-20260907-064047 / 064418 / 065333 / 065730 (harness bugs
  1–3 above; runs 3–4 include the full mock captures + classification dumps that pinned
  the root causes).

## Install surface

- NO src changes in G5A: the commit adds only the harness runner + evidence. The runtime/
  remote/client sources are untouched from the base (3b53e40); the dist artifacts the
  test host booted (`packages/runtime/dist/…/{host.js, live/agent-bindings.mjs}` + the
  top-level `root-binding/harness/seam.mjs`) are the committed D1–D4 build output,
  verified present + loadable by S0 (dist import probe). No `pnpm build` run or needed
  (no install-surface changes).

## Remaining risks / notes

- The member tool turns (S4) drive the member through the public member-session prompt
  path (`POST /api/session/prompt` on the child session; session-controller `resolve()`
  prefers the live team-composed agent while the member is resident — the member stayed
  resident the whole run, lifecycle SETTLED at the end). No remote member-creation method
  exists on the team-remote surface, so S2 provisions the member via the canonical
  Leader `team_create_member` real turn (the same path the Team UI drives for a Leader).
- The shared home (`references/.dsh-test`) accumulates one extra root pair (+1 member) per
  run by design (nonce-fresh roots are durable and re-enumerated by later runs'
  `team.listRoots` — that multi-root evidence is asserted, not a leak to clean).
- The S7 `selectModel` side effect (deployment default model) moved to
  deepseek-official during the ordinary turn and was RESTORED to qiyuan-self/qwen3.8-27b
  (recorded in S7 evidence).
- Not exercised (out of scope for this row): the member UI entry, `team.admitInitialWork`
  (the delegation went through `team_delegate` on the existing member), remote member
  creation (does not exist by design).
- No push performed (repo discipline); the commit is local on the task branch, ready for
  the main Agent's cherry-pick flow.
