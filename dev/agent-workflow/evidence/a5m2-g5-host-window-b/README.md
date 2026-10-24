# A5M2 G5 host-window (B-slot lineage, G5-family ports自理) — PREPARED, NOT FIRED (no GO; boot env absent = rc3 NOT_RUN)

Root 2026-10-24 dispatch: verify the already-implemented G5 tool over the real chain — `get_goal`
ALLOW + DENY pair, identical args, public wire only. No new features; nothing here ever started a
Host (both local passes were DRY, which is NOT_RUN by law).

## Executable entry (GO time)

    cd /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g5
    A5M2_G5_WINDOW=GRANTED \
    A5M2_G5_INSTALL_DIR=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/install-8077defc \
    A5M2_G5_RUNNER_SHA256=<driver sha below> \
      bash dev/agent-workflow/evidence/a5m2-g5-host-window-b/scripts/06-run-g5-window.sh
    # pre-proof (zero spawns, exits NOT_RUN rc3): A5M2_G5_DRY=1 replaces GRANTED

Ports: **3185 host / 3500 mock** — G5-family自理 pair (root order). A owns 3183/3498, B-Control owns
3184/3499: both untouched here; 3080 stable, 3180/3181 durable never touched. Pre-check only;
occupied => refuse rc3; foreign occupants never killed.

## Fixed inputs (center 2fb delivery, read-only re-verified per pass)

| item | value |
| --- | --- |
| product | `2fb129cfa23e138248fecc834a42c92238af95fe` (tip-equivalent 18c3327e6, test-only diff, dist subtree identical) |
| tgz | `.worktrees/pack-int/out-2fb129cf-20261024T135732Z/dsh-agent-team-0.1.1-alpha.2.tgz` = `8077defca120247f3f73dc61867c0b85d4fedfbf84a145284b2a165a2ee8958a` |
| fixture | `.worktrees/pack-int/install-8077defc`; lock `5dffdafa…90088`, pkg `4ef112fb…5f722` (equal before/after per pass; NEVER installed) |
| cold-import authority | product receipts `logs-2fb129cf-20261024T135732Z` (19-cold-*, 20-cold-necessary RC=0) — read-only, never rerun |
| dist quartet | g5-goal-service `8a98ee550cfb21a8…ab5a` (== this lane's delegate src byte-identical), g5-goal-wiring `c87f3db5aef3…c2e7`, agent-bindings `18da53bac214…96f6`, team-tool-plane `da97e8a45cf0…02f1` |
| blueprints | REAL `parseBlueprint`/`validateBlueprintDocument` from the pack pre-boot (anchor + saved `team.a5m2-g5-hw`) — not just syntax |
| driver | runner file sha256 recorded in the receipt; the commit carrying it is the lane tip |

## G5 assembly supply (this gate REPLACES the OLD full-tree static audit, removed per root order)

Read off the SAME quartet of pinned blobs before any boot: durable `familyRegistrations` +
`g5GoalsService`/`readNative` provider rows (agent-bindings), `GOAL_TOOL_DRIVER_REQUIRED` mirror
(g5-goal-service), `goalToolExecution` port-authentication law mirroring 639
`packages/goal/tool-goal/src/authority.ts:33-118` (g5-goal-wiring). `get_goal` native face
re-verified at 639 tool-goal/src/index.ts:196 (`parameters: {}` — the mock sends exactly `{}`);
execute → `goalToolExecution` → `goalValue(goals.get(agent))`.

## Criteria (positive/negative controls + ledger hygiene)

- **E0** member face carries the governed trio (MOUNTED barrier with polls recorded first).
- **E1 ALLOW (positive control = the governed row's REAL effect)**: same-requestId
  `control-allow-consumed` fact AND the served canonical projection `{"goal":null}`
  (goalValue(undefined), tool-goal index.ts:157-173) in the model-visible result.
- **E2 DENY (negative control = refusal face, EXACT)**: no `control-allow-consumed` fact, durable
  decision fact present, result carries NO served projection and the refusal face EXACTLY
  `APPROVAL_DENIED` (2fb plane-edge deny code, re-thrown verbatim by the G5 bridge as
  `code — detail`). Unknown refusal wording = FAIL, never regex-widened (root lesson ③).
- **E3 ledger hygiene**: exactly the two driven requests, exactly their two decisions, exactly one
  consumption (allow leg), zero abandons.
- **Lossless rejection law (root lesson ②)**: `status:"rejected"` on any governed result fails
  loudly with raw kept and the wait terminal — `isError=false` is never business success.
- **Collection (root lesson ①)**: dual-protocol tool_result harvest (Anthropic
  `user.content[].tool_result` by issued callId + OpenAI `role:tool`), counted per protocol into
  results.json `harvest`; per-request tool-array counts recorded (same-surface evidence); every
  exit path writes minimal `toolcalls.jsonl` (callId/step/tool/isError/text≤800/args≤800) — a
  mirror/driver-required refusal lands there verbatim if it ever appears.

## Supervision (unchanged laws)

HOME `tests/homes/a5m2-g5-hw-b-<UTCts>Z` never deleted, explicit pointer hand-off (no globbing),
64 MiB new-bytes budget; one boot max; TERM@300/KILL@320 OWN group only; cleanup = mock.close +
instance.stop + waitForPortFree reporting only this PGID's ports (no descendant claims); df bar
6442450944 B (root ruling, A-monitor precedent); rc 0/1/2/3 = green/CRIT-FAIL/FATAL/NOT_RUN;
**DRY = NOT_RUN rc3 always** (the wrapper FAILS the runner if dry exits 0); runs-*/window-*/HOME
retained, never committed. One window one GO, first error stops, history never reverse-inferred.

## Coverage law (unchanged, re-verified on 2fb dist)

managed = OWNERSHIP (GLUE-5 `a5PlaneOwnNames` → team-tool authority owner; 2fb agent-bindings
:6834/7270/7366/7600): the G5 trio is owned by the mounted rows, so worker `builtinToolDeny` =
A-window-2's measured 15 MINUS the trio = 12 names. The tested subject is never denied and nothing
is declared exempt. fsInstance ABSENT (no fs-governed family armed here).

## Open prerequisites (honest, pre-GO)

1. E2's `APPROVAL_DENIED` face and E1's exact serve bytes are code-pinned FIRST-WINDOW
   measurements: any other shape on the wire FAILS the window red with the raw in
   toolcalls.jsonl — pins tighten to measured bytes, never loosen.
2. First real boot also settles E0 trio visibility timing under the MOUNTED barrier and whether a
   goal-less world's get_goal frame wraps the projection (assertion is substring-based; the exact
   frame is recorded for the next pin).
3. A LIVE negative-control leg (a driver-required/mirror refusal driven on purpose) is NOT in this
   window: the read arm cannot produce it. Driving it needs an update_goal-arm leg under a fresh
   root GO; the capture channel (toolcalls.jsonl verbatim) is ready now.
4. Original G5 semantics beyond the get_goal pair (create/update arms, goal-round blocked
   delegate) stay 必交, queued; not scripted here (不自行扩大).
