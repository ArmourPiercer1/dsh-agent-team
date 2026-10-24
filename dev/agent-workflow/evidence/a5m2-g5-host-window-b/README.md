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

Ports: **borrowed B slot 3184 host / 3499 mock** (`A5M2_G5_SLOT`, default B — root FINAL scheduling
2026-10-24: G6 borrows A 3183/3498; G5 borrows B; B-Control's own batches take priority, this
window queues after them). The borrow is exclusive and valid only while the slot owner runs no
Host: pre-check only, occupied => refuse rc3, occupant NEVER killed (collision reported to the
scheduler). Four drivers may prepare in parallel; the two slots are strictly exclusive at run time.
3080 stable, 3180/3181 durable never touched.

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

## Pre-boot identity law (root review ruling: the keyword "supply" gate is REMOVED)

The runner does NOT keyword-grep product sources for supply claims: the earlier
`GOAL_TOOL_DRIVER_REQUIRED`/`goalToolExecution` `includes()` checks matched COMMENT-ONLY occurrences
(service :835, wiring :56) and proved nothing — removed per root review (the old full-tree static
audit stays removed; necessary product tests are untouched). What remains is identity: the EXACT
dist quartet blob hashes (a byte identity of the pinned product, not a keyword census), the
fixture lock/pkg pins, and the REAL `parseBlueprint`/`validateBlueprintDocument` pass. The sole
supply authority is the governed rows' live behavior at boot over the public wire. Context facts
(read-only, non-gating): `get_goal` native face at 639 tool-goal/src/index.ts:196
(`parameters: {}` — the mock sends exactly `{}`); execute → `goalToolExecution` →
`goalValue(goals.get(agent))`; mirror law mirrors 639 `packages/goal/tool-goal/src/authority.ts:33-118`.

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

## Messages tool_result TEXT law (root protocol card; offline-proven)

Host639 `serialize.ts` (:64-65/:121) rides tool results as `content=[{type:'text',text:<as-text>}]`
(+`is_error`). The container array is never business JSON: `lib-tool-result-text.mjs` extracts text
blocks VERBATIM (foreign residue kept as `rawContainer` evidence; is_error + same-callId pairing
unchanged) and the criteria PARSE business facts — E1 `goal === null` parsed (not substring),
lossless `status:"rejected"` parsed-first. `08-messages-text-law.mjs` proves all of this offline on
the real wire shapes AND pins the root finding: the old whole-array `JSON.stringify` escaped the
quotes so a successful `get_goal` would have read red and `status:"rejected"` would have hidden
(9/9, zero Host).

## Path door (root exec card)

The host tree resolves through `tests/paths.mjs`'s OWN door (`testUseTree` + `DSH_TEST_USE_ROOT`,
pinned pre-import by `lib-pin-test-use-root.mjs`) to the FIXED 639 read-only base
`/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use` — HEAD re-verified
`== CLIENT_COMMIT_HASH` per pass. The nested worktree clone is retained pending the root/a356
ruling (paths.mjs :43-63): never used, never recreated, never deleted by this window.

## Supervision laws (root budget-enforcement card)



HOME `tests/homes/a5m2-g5-hw-b-<UTCts>Z` never deleted, explicit pointer hand-off (no globbing);
the 64 MiB budget (unique dev:inode bytes in this HOME, no symlink-deref — read-only shared
dependency targets never counted, this run's links>1 files counted once) + the 6442450944 B df
bar are enforced **IN FLIGHT** by the ONE watchdog: every 10s it samples the explicit HOME pointer
and df — disclosed as STOP-LOSS, not a hard quota (between-samples writes can transiently exceed;
exact accounting is post-exit); a breach, a non-decimal sample, or any sampling error terminates
the OWN PGID (`budget-breach.json`, window FAILED regardless of rc) — no
separate monitoring system. TERM@300 remains; once any termination is ARMED the parent NEVER
cancels the escalation — the watchdog drains the OWN PGID until the group is empty or 20s elapse,
then KILL (the old kill-watchdog-on-runner-exit that swallowed the follow-up KILL is gone); an
UNARMED watchdog is cancelled with nothing lost. Ports unclean post = hard FAIL. Cleanup =
mock.close + instance.stop + waitForPortFree reporting only this PGID's ports (no descendant
claims); foreign processes, other worlds and :3080 untouched; rc 0/1/2/3 = green/CRIT-FAIL/FATAL/NOT_RUN;
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
