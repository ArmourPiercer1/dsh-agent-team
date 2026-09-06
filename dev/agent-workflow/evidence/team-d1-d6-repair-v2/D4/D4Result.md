# D4 Result — D6 Team UI dedicated mode + real restart/reopen host acceptance (v2)

- task: D4 (Team D1-D6 repair v2, Wave D — D6 Team UI dedicated mode + restart)
- attempt: 1
- verdict: PASS
- blocker_type: none
- base: 2e28d0d131f716ee36c3e358f30b61811d85d973 (D3 commit)
- branch: task/team-d1-d6-v2-D4
- worktree: .worktrees/team-d1-d6-v2-D4
- model_route: qiyuan-self/qwen3.8-27b (runtime declaration "powered by the qwen3.8-27b
  model" + C:\Users\user\.dsh\settings.yaml agent-default-model {provider: qiyuan-self,
  model: qwen3.8-27b}; DSH_* env exposes no route label — same verification method D3 used)
- product code touched: NO (harness + evidence only; no src changes → no rebuild; see
  Install surface)
- elapsed_minutes: 33 (session start ~05:03, commit ~05:36; inside the 90-minute timebox)

## Form used (stated explicitly, per task card)

The repository has NO vitest-based host-boot pattern to reuse: every vitest config in this
repo is fully in-process (worker_threads pool, no child_process fork), and no repo test
spawns a DSH host child. The established host-scenario precedent is node .mjs runners in
`packages/tools/harness/` (T12 vertical closure: `t12-vertical.mjs` + `mock-deepseek.mjs`,
which committed ~300KB of raw mock-capture evidence). D4 therefore uses the task card's
permitted fallback form: a DURABLE node runner + raw evidence transcripts, reusing the T12
pattern (DshInstance boot/stop, zstd multi-frame session-log reader, remote wire helpers,
mock model with request capture).

Repeatability: `node packages/tools/harness/d4-restart-reopen.mjs --report-dir <dir>` from
the worktree root re-runs the whole 8-step scenario against the shared test home
(`references/.dsh-test`, port 3180, pristine test-use source). Each run mints a fresh nonce
and appends fresh roots/sessions; exit code 1 on any scenario failure.

## Requirements coverage (plan §12 D4 — the 8-step real restart/reopen scenario)

All steps executed on the REAL test host (DSH_HOME=`references/.dsh-test`, port 3180,
test-use pristine @ 76fda729), final green run `run-20260907-053257` (nonce
mtqbvsieefe5ee, 30.2s, S0–S8 + CLEANUP all pass, 36/36 assertions ok):

1. PREPARE — dynamic Team roots via the Team flow (S1):
   - boot 1 on the shared home with the row (production `dsh-agent-team` row + `p6t6-team-tools`
     observability row in `profiles/web/cordis.patch.yml`, directive boot=1/phase=create):
     create-or-open resolved to CREATE for the nonce row root ROOT_A
     (`session-d4v2-a-mtqbvsieefe5ee`); health `toolCount=10`, ROOT_A live.
   - the DYNAMIC root ROOT_B (`session-d4v2-b-mtqbvsieefe5ee`) minted via the
     browser-facing public remote channel `team.create` (contract v2; blueprint d4v2-bp rev 1,
     blueprintRevision sent as the wire NUMBER 1), workspace = the home's registered workspace
     (repo root). Response: fresh-root + durable TeamSession.
   - a REAL Leader turn on ROOT_B through the browser chat path (`api/session/prompt`,
     mode queue) → accepted, and the turn settled: the assistant message carrying the
     deterministic mock ack is durable in ROOT_B's native session log.
   - baseline tool registration: the REAL agent model request (mock capture seq=1) for that
     turn carries EXACTLY the ten team_* tools (`team_create_member`, `team_delegate`,
     `team_follow_up`, `team_inspect_config`, `team_list_members`, `team_list_templates`,
     `team_report_progress`, `team_request_control`, `team_resolve_control`,
     `team_send_message`), and the system prompt carries the scoped
     `[team-root-context rootSessionId=ROOT_B leaderInstanceId=inst-leader]` block.
2. CONFIRM durable rows + native session artifacts (S2):
   - row state: ROOT_A TeamSession + Leader member row (`inst-leader`);
   - `team.listRoots` (v3) enumerates BOTH new roots plus the 4 pre-existing home roots
     (multi-root host authority, read-only);
   - both wire rows carry the closed v3 shape `{rootSessionId, blueprintId, revision,
     defaultWorkspace?, createdAt, generation, memberCount}`; ROOT_B memberCount=0 (zero
     seeded members — the Leader is not a member);
   - `team_domain.json`: ROOT_A and ROOT_B each have TeamSession + Leader row + team-root
     binding durable (the remote create path writes the same canonical rows as the row boot);
   - NATIVE session artifacts under DSH_HOME for both roots (`sessions\--D-AgentDev-…--\
     session-d4v2-{a,b}-mtqbvsieefe5ee\session.jsonl.zstd`); ROOT_B session header cwd ==
     the row default workspace (session meta, not projection).
3. CLEAN STOP (S3): instance 1 killed, port 3180 free (`killed=true portFree=true`).
4. RESTART same DSH_HOME (S4):
   - directive boot=2/phase=resume; both rows remounted; `toolCount=10` after restart;
   - ROOT_A: `phase=resume`, SAME durable TeamSession id (a resume loads, never re-mints),
     re-activated live (row semantics);
   - ROOT_B: COLD after the restart (the row re-activates only its config root — the D2
     ensure precondition);
   - `team.listRoots` after restart enumerates the same set; the ROOT_A and ROOT_B wire
     rows are BYTE-IDENTICAL across the restart (D1 durable index, rebuilt from the same
     rows).
5. "以 Team 模式打开" on the dynamic root (S5): `team.ensureRootLive` (v3) on the COLD
   ROOT_B succeeds with the closed shape `{rootSessionId, mode:"team", live:true}`
   (provenance origin=team-remote, contractVersion=3); the native open of ROOT_B
   (`api/session/page` from the committed durable cursor, lastSeq=23) succeeds (24 records).
6. VERIFY (S6):
   - root history RENDERS: the boot-1 user turn (marker text) and its assistant reply
     (mock ack) both come back through `session/page` (24 records) — durable history
     survived the restart and the cold ensure;
   - Leader prompt reachable on the restarted host (`api/session/prompt` accepted) and the
     post-restart turn settles (ack durable);
   - the ten team_* tools are registered on the LIVE root agent after the ensure (REAL
     model request seq=3, same exact ten);
   - the scoped root Team context block is installed on the live agent (system prompt
     carries `[team-root-context rootSessionId=ROOT_B …]` — persona seam);
   - a REAL team_* tool call executes on the restarted host: `team_list_members`
     (requestToken `d4v2-list-1-…`) → `{status:"executed", action:"list-members",
     callerRole:"leader", effect:{kind:"members-listed", members:[inst-leader]}}`.
7. "以普通模式打开" (S7) — EXPLICIT ordinary, no ensure-live: the ordinary entry is a pure
   native open (`api/session/page`, zero `team.*` remote calls — ledger: ensureRootLive
   calls before=1 after=1, i.e. ZERO during the ordinary window), the session stays usable
   (Leader turn accepted + settles through the ordinary entry). Client-side badge/copy
   semantics are pinned by the D3 committed client unit tests (referenced in S7 notes).
8. Switch back to Team mode WITHOUT double registration (S8): a second
   `team.ensureRootLive` on the already-live root SUCCEEDS with the same closed v3 shape
   (no-op adoption — the D2 assertBoundRoot owns the root, so a double registration attempt
   would have failed typed OUTSIDE_TEAM/START_FAILED, not silently re-registered);
   the agents registry holds EXACTLY one agent for ROOT_B (liveSessions contains it once);
   exactly ONE durable session artifact for ROOT_B (no second session minted); a real
   `team_list_members` call still succeeds after the switch back.

BOUNDARY RECORD (per task card — plan §12 D4 不测试/不宣称):
the ordinary SESSION-LIST open is NOT auto-Team. This run exercised ONLY: the row
create/resume boot of ROOT_A (row semantics, its config root); the dynamic ROOT_B created
via `team.create` (v2); the explicit Team-mode entry (`team.ensureRootLive` v3 ×2 +
`session/page`) on ROOT_B; and the explicit ordinary-mode entry (`session/page`, zero
`team.*` remote calls) on ROOT_B. NO ordinary-list session was opened and NO team_*
availability is claimed for the ordinary list. (summary.json `boundary.entriesExercised` /
`boundary.notExercised` carry the machine-readable version.)

Hard-boundary compliance (verified pre AND post by the harness):
- `references/deepseek-harness-test-use` pristine at 76fda729799fe9b3848dbe2c211d4b231032b81e:
  HEAD unchanged, `git status --porcelain` empty, `git diff` empty (booted only, never written).
- stable :3080 / D:\deepseek-harness never touched (read-only reachability probe only: HTTP
  401 pre and post).
- NO host process left running: instance stopped in finally + exit handler; CLEANUP asserts
  port 3180 free (portFree=true).

## Changed files

- packages/tools/harness/d4-restart-reopen.mjs (NEW, ~1250 lines — the durable 8-step
  acceptance runner; reuses T12 patterns: DshInstance, zstd session-log reader, remote
  wire helpers, mock-deepseek.mjs; scenarios S0–S8 + CLEANUP; per-run summary.json +
  mock-capture.json + host/instance/git transcripts)
- dev/agent-workflow/evidence/team-d1-d6-repair-v2/D4/ (this result + red/green run
  transcripts: 4 harness-side RED runs + the final GREEN run with full mock capture)

## TDD red → green

All RED runs are HARNESS-side (the new runner's own bugs), in order; no product defect
surfaced at any point (see GREEN evidence — every product-behavior assertion passes):

- run-20260907-051720 (RED): `ENOENT` writing `git/git-head.log` — captureGitState (shared
  test-util) writes into the log dir without creating it. Harness fix: mkdir the git/git-post
  log dirs before capture.
- run-20260907-051738 (RED): `team.create` → `INVALID_BLUEPRINT_REVISION: blueprintRevision
  must be a positive integer, got "1"` — the remote v2 param is a NUMBER on the wire (the
  blueprint YAML doc keeps string "1"). Harness fix: send BLUEPRINT_REVISION_NUM=1.
- run-20260907-051820 (RED): `team.create` → `TEAM_CREATE_WORKSPACE_NOT_FOUND` for a scratch
  dir — team.create validates `workspace` against the registered-workspace registry
  (`DSH_HOME/storages/workspace.json`), and this shared home has exactly ONE registered
  workspace: the repo root. Harness fix: use the repo root as WORKSPACE.
- (run-20260907-051907, interrupted: mock 404 on `POST /v1/chat/completions` — the mock serves
  `/chat/completions` only; DEEPSEEK_BASE_URL must omit the `/v1` suffix (T12 precedent).
  run-20260907-052754, killed mid-run: superseded by the decide() fix below.)
- run-20260907-052352 (RED, near-green: S0/S2/S3/S4/S5/S7/S8/CLEANUP pass, 3 assertion
  failures) — all three diagnosed as harness artifacts:
  1. S1 "ten tools registered on the live ROOT_B agent": `tools=[]` — `toolTableOf` had
     matched the session-TITLE-GENERATION side call (which echoes the turn marker inside its
     input JSON and carries NO tool schema) instead of the real turn request. The real
     request (mock seq=1) carried all ten tools. Harness fix: skip title side calls
     ("Generate the session title …"), match the marker in ANY user message.
  2.-3. S6 "root history renders" (user turn + assistant ack): the page returned
     `records:[]` because `session/page` with `throughSeq:-1` is an EMPTY page, not "whole
     log" (upstream history.ts paginate(): `end = min(throughSeq+1, …) = 0` for -1); the
     browser client pages from a KNOWN committed cursor. Harness fix: read the last committed
     seq from the durable log and pass it as throughSeq.
  - Root cause common to 1. and 2.-3.: the harness appends a runtime-context snapshot as a
    SEPARATE user message AFTER the turn text on a session's first turn (durable-log fact:
    seq 7 turn text / seq 8 context snapshot), so "last user message" is not the marker
    message; the mock decide() and the ack checks were re-anchored (newest marker-bearing
    user message; ack pinned to `assistant/message` events, not any log substring — the
    session-title event would otherwise false-positive).
- GREEN (final): run-20260907-053257 — S0–S8 + CLEANUP all pass, 36/36 assertions ok,
  exit 0, 30.2s. (An intermediate green run-20260907-053130 verified the fixes before the
  final detail-string + ack-predicate tightening; pruned from the evidence dir.)

## GREEN evidence

- Final run: `dev/agent-workflow/evidence/team-d1-d6-repair-v2/D4/run-20260907-053257/`
  (summary.json = every assertion with detail; mock-capture.json = all 4 real agent model
  requests incl. full tools arrays + system prompts; instances/BOOT1|BOOT2 host logs +
  composed-profile dump; git/git-post = pristine test-use pre/post).
  Key values: S1 toolTableBoot1 seq=1 tools=[all ten]; S5 ensure `{mode:"team", live:true}`,
  lastSeq=23; S6 page records=24 (user marker + assistant ack both present), real
  team_list_members → members-listed [inst-leader]; S7 ensureRootLive before=1 after=1
  (zero in the ordinary window); S8 exactly one live agent + one durable artifact for
  ROOT_B, team tool call re-executes; CLEANUP portFree=true, test-use HEAD/porcelain/diff
  clean, :3080 probe 401.
- Red transcripts retained: run-20260907-051720 / 051738 / 051820 (harness setup bugs),
  run-20260907-052352 (the 3 assertion failures + full mock capture documenting the
  title-side-call and empty-page facts).

## Install surface

- NO src changes in D4: the commit adds only the harness runner + evidence. The runtime/
  remote/client sources are untouched from the D3 commit (base 2e28d0d); the dist artifacts
  that the test host booted (packages/runtime/dist/…/{host.js, root.js, s6-remote.js,
  live/agent-bindings.mjs}) were committed by D1–D3 and are verified present + loadable by
  S0 (dist import probe `LOADED name=dsh-agent-team`). No `pnpm build` / `pnpm
  build:composition` was run or needed (no install-surface changes).

## Remaining risks / notes

- The scenario asserts the HOST/remote/public-seam side of "以 Team 模式打开 / 以普通模式
  打开"; the actual browser UI flows (buttons, badge, copy) are pinned by the D2/D3 client
  unit suites (committed) — no browser was driven in D4 (the repo has no host-boot pattern
  that embeds a real browser, and the task card scoped D4 to the real restart/reopen
  scenario on the real test host).
- The shared home (`references/.dsh-test`) accumulates one extra root pair per run by
  design (nonce-fresh roots are durable and re-enumerated by later runs' listRoots — that
  multi-root evidence is asserted, not a leak to clean).
- No push performed (repo discipline); commit is local on the task branch, ready for the
  main Agent's cherry-pick flow.
