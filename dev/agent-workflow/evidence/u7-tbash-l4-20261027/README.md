# u7-tbash-l4-20261027 — governed `team_bash` positive spawn, live L4

Lane: U7 item deferred by U6 PR3 (#375): "the positive-effect leg lands as the named
U7 item (runner seam targeting the real team root + a lane-scoped grant design)".
Branch `task/u7-team-bash-l4-20261027`, worktree `.worktrees/u7-tbash`, base
`origin/master` @ `a264d2df0`. CORE PATCH BUDGET = 0. No protected-center file
(`dev/agent-workflow/ledgers/arc-a-protected-center.json`, 33 paths), no
`team-tool-plane.mjs`, `family-assembly.mjs` or `agent-bindings.mjs` line is touched.

## 1. Diagnosis (written BEFORE any change)

Inputs: the committed u6-pr3 records `run-u6proc-r2.json` … `run-u6proc-r5.json`
(boots u6prc6..u6prc9) and their digests
`u5-u6-proc-u6prc{6,7,8,9}-*.u6proc-evidence.json`
(`dev/agent-workflow/evidence/u6-pr3-20261026/c2/`), plus the later u7-t1 re-run
`u7-t1-20261026/c2/u5-u6-proc-u6prc10-*.u6proc-evidence.json`.

Measured, per record (`approveEvidence` + `bashExecutes`/`bashResults` + `controlDigest`):

| record | boot | head fixture | asker call answer | bridge forensic | rows on governed session | verdict cause |
| --- | --- | --- | --- | --- | --- | --- |
| r2 | u6prc6 | asker envelope w/o `request-control` | `a5p5-refused … APPROVAL_DENIED` (synchronous) | (not yet captured) | 0 | envelope gap |
| r3 | u6prc7 | same | same | `leg-deny durable control request failed: … 'request-control' … is outside the caller's mutation envelope` | 0 | envelope gap |
| r4 | u6prc8 | asker entry names `request-control`, team root does NOT | same | same line verbatim | 0 | envelope gap (team-root ceiling) |
| r5 | u6prc9 | team root + asker name `request-control` (`822da6379`) | **no answer — the call BLOCKED** (`laneDone.appr=false`) | `request-created` (a real row) | not observed: runner read the BOOT root | wrong-root observer |
| (u7-t1) | u6prc10 | r5 fixture reverted (`7861fb307`), observer fixed | `APPROVAL_DENIED` again | envelope line again | 0 (on the right root) | envelope gap |

Verdict: **not a family defect.** Two causes, layered, plus two judge artifacts.

1. **Grant-design / envelope gap (r2, r3, r4, and again u6prc10).** The PA bridge
   opens the durable ask row through `controlService.requestControl` and turns any
   failure into a deny (`packages/runtime/operation-permission/pa-control-bridge.ts:399-423`;
   the `return deny(\`durable control request failed: …\`)` at :422). The row
   was refused by the mutation-envelope boundary: the caller's effective envelope
   is `teamEnvelope.allow` intersected with the template entry
   (`packages/runtime/admission/envelope.ts:100-117` — a template entry can only
   NARROW the team-root list). The u6-proc main blueprint's team root never names
   `request-control` (`tests/world-factory/lib/u6-proc-assembly.mjs:218-224`), so
   the asker entry that does (`u6-proc-assembly.mjs:282`) is filtered out. The
   APPROVAL_DENIED the member saw is the bridge failing closed — correct product
   behaviour on a world that never granted the role the right to ask.
2. **Drive-script artifact, wrong root (r5).** With the envelope fixed (head
   `822da6379`), the row WAS created (`request-created`, pa-control-bridge.ts:424;
   leader notification turns 0→21) and the asker call blocked on it, exactly the
   synchronous-wait law. But the runner polled `/__p6t6/state` (boot-anchor scoped)
   and called `team.resolveControl` on `session-u6proc-root-<rs>` instead of the
   governed `session-u6proc-team-<rs>` (u6-pr3 README §"boot 4"). It never saw
   the row, never resolved it, and waited out its 120 s window
   (`approveEvidence.waitedMs=120237`). This is the #404 class (observer
   reading the wrong place). u7-t1 `7cbd7647f` already moved the observer to
   remote `team.getLedgerPage` on the create-echoed session
   (`tests/world-factory/suites/020-u6-proc.mjs:213-279`) but booted it on
   the reverted fixture, so the envelope cause came back (u6prc10).
3. **Judge artifact A — index pairing.** `judgeU6Proc` pairs `bashExecutes[i]`
   with `bashResults[i]` (`u6-proc-assembly.mjs:594`). When a call blocks (r5), every
   later result shifts one slot: r5 shows the APPR execute "answered" with the
   POS refusal and the LATE execute "answered" with the native `bash` output.
   That is where r5's `proc:exec-door-fail-closed` flip came from. A result must be
   joined to its call by `tool_use_id`, never by position.
4. **Judge artifact B — replay expectation.** `proc:approve-replay-refused` expects the
   identical second call to come back as a synchronous typed refusal
   (`u6-proc-assembly.mjs:750-756`). The bridge keys a row by
   `pa:<approvalCaseId>:<callId>` (`pa-control-bridge.ts:260-261, 395`) and the
   manifest binds `callId` (:388). A second invocation is therefore a NEW row
   that needs a NEW decision. It is not a reuse of the spent one. The refusal
   law is "the spent decision is not reusable; without a new approval there is
   no spawn", and the arm has to measure that on a second pending row.
   Separately, the FAIL `note` text in that judge (:746-748) is a fixed success
   sentence printed under every verdict; it should not be read as evidence.
5. **Collateral (u6-pr3 "mechanism 2").** Naming `request-control` at the team root
   also arms the LEADER ask lane, because a leader caller has no `callerMember`
   (`admission/resolve.ts:246-267`). The leader-entry branch at
   `envelope.ts:113-115` reads `memberEntry` keyed by `callerMember?.templateId`
   (:101), so it cannot narrow the leader. In u6-proc that broke the "other 9
   cases unchanged" constraint, because the leader there runs three exec
   commands. It is NOT a blocker for a lane-scoped world whose leader owns no
   shell lane at all.

## 2. Grant design (lane-scoped, test-profile data + runner policy)

No product grant type is added; none is needed. The product already gives exactly the
right scope: every `team_bash` call is its own PA case/row and the bridge consumes
one decision once. The lane scope is enforced by (a) the World and (b) the
human-seam resolver policy:

- **World (`tests/world-factory/lib/u7-tbash-assembly.mjs`)**: a NEW world, not the u6-proc
  one (so the u6-proc 9 cases stay byte-untouched). Leader: no shell rule, no
  `bash` exec token, no `team_resolve_control` (the human seam approves).
  `teamEnvelope.allow` names `request-control` (needed — cause 1); the ONE
  member template `asker` is `default: ask` with no shell rule (its effective
  envelope = send-message, report-progress, request-control). Plane root =
  `<home>/workspace` = the team root; every command writes ONE line there with
  `printf`.
- **Resolver policy (`decideResolution`, pure, C1-pinned)**: the runner resolves
  `allow` for exactly ONE row: the first pending `team_bash` row on the governed
  session whose outstanding asker call carries the pinned command A
  (`sha256(command)` pinned before boot), and only while no allow has ever been
  given. Every other row is resolved `deny`, whether it is A again, a different
  command, or anything else. A second `allow` is unexpressable.
- Approvals go through the human public seam only: `team.getLedgerPage` (read)
  plus `team.resolveControl` v4 (decide) on the create-echoed governed session
  id, which is identity-asserted against the boot root (cause 2 cannot come back).

## 3. Cases (`tbash:*`)

| case | law (all effects read from DISK, results joined by tool_use_id) |
| --- | --- |
| `tbash:mounted` | health + state + team.create ok + placement feed lists `team_bash` |
| `tbash:approve-spawn-once` | row A pending on the governed session → human allow ok → exactly 1 decision (`allow`) + exactly 1 `control-allow-consumed` for A → disk file holds exactly the claim line once → A's tool_result carries the ran-echo |
| `tbash:replay-refused` | identical command A again → a NEW row (≠ A's id) → no allow for it (deny) → typed refusal, disk still ONE line, consumptions still only A's; re-resolving A at the seam is refused |
| `tbash:other-command-refused` | different command B → new row, never consumed, deny → typed refusal, B file absent |
| `tbash:deny-zero-effect` | command D → human deny → 1 `deny` decision, 0 consumption, typed refusal, D file absent |
| `tbash:leak-check` | secret outside the team root appears in no corpus/host log; bytes unchanged; no allow ever issued beyond A |

See §4+ (appended after the boots) for the record, verdicts and boot ledger.
