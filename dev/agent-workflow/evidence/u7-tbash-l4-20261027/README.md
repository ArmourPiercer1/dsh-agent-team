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

## 4. Boot ledger, verdicts, conclusions (appended after the boots)

Budget extended to 4 (one disclosed over the original budget of 3); all 4 spent, each boot was declared in `c2/boot-budget.jsonl` BEFORE it started. Boot 4 was the final permitted boot; no boot 5 is allowed. Boot 4 failed closed due to a runner `ReferenceError: projection is not defined` while recording projection diagnostics; the scope fix was committed after the last permitted boot and was not live-verified. No world for this lane remains in `tests/homes/` (all records carry `teardown.homeRemoved=true`).
`:3080` read 401 before and after boot 4 (`stableInstance.unchanged=true`,
`touched=false`). Host tree `639ed0153` at the end of boot 4.

### 4.1 Boot ledger

| boot | runId | world | team head | record | result | finding |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `u7tb-c2-mvqzfr6a` | `u5u7tb-20261027T17-51-44Z` | `080886835` | `c2/c2-verdicts-boot1.json` | FAIL 3/6 (mounted, deny-zero-effect, leak-check PASS) | **native shell row spelling.** The durable PA row for a model-facing `team_bash` call is governed under the NATIVE name `bash` (row summary `… rung=leader tool=bash effects=1`). The resolver only accepted `toolName === 'team_bash'`, so it denied row A (`reason: "not a team_bash row — outside this lane"`). The fail-closed resolver did exactly what it should: 0 allows, 0 consumptions, no file on disk. `replay-refused` / `other-command-refused` then FAIL because their laws assume an approved A exists (1 consumption, a spent row to re-resolve). This is a runner/resolver spelling finding, not a product defect. Fixed in `ca575560b` (`SHELL_ROW_TOOL_NAMES = ['team_bash','bash']`; the command hash stays the ONLY widening key), C1 RED→GREEN in `c1/RED2-native-spelling.log` / `c1/GREEN.log`. |
| 2 | `u7tb-c2-mvqzlr6k` | `u5u7tb-20261027T17-56-24Z` | `ca575560b` (tree clean) | `c2/c2-verdicts-boot2.json` | **PASS 6/6** | none |

Host logs: `c2/host-boot1.log` (898 B), `c2/host-boot2.log` (1221 B). The web token
is already `<redacted>`, and the only absolute paths are inside this worktree.
Mock excerpts (~53 KB each) contain only in-repo world paths and team request
tokens (`requestToken=u7tb-…`), which are not secrets. Every file is far under 1 MiB, so they are committed whole.
Boot 2 host log carries the spawn line verbatim:
`a5g7-shell: confined-shell ran realm=u7tb-realm-u5u7tb-20261027t17-56-24z call=team-inst-0tijb8f1ai8p-bash:hexec:… pid=255 exit=0 timedOut=false cancelled=false`.

### 4.2 Boot-2 verdicts (verbatim from `c2/c2-verdicts-boot2.json`)

Record bindings: `schema u5-run-record/1`, `overall PASS`, teamSha `ca575560be062be515f17ed5ac5752a276022f86`,
`teamTreeClean true`, hostSha `639ed015397290b3745d163aafe02ffee4aa3f84`, authority `as20261026r1`.

| case | verdict | key detail (verbatim fields) |
| --- | --- | --- |
| `tbash:mounted` | PASS | `healthOk/stateOk/createOk=true`, governedSession `session-u7tb-team-u5u7tb-20261027t17-56-24z`, placement feed `rows=[team_grep,team_glob,team_bash,pwsh,read,write,edit,read_image]`, launcherPin `1264ea58…` |
| `tbash:approve-spawn-once` | PASS | requestId `ctrl-18j9bg61eafrol1wn3alg03j`, decision `allow` ("the pinned command, first issue, no prior allow"), `decisions:["allow"]`, `consumptions:1`, `totalAllowsIssued:1`, `effectOnDisk:"U7TB_APPR_u5u7tb-20261027t17-56-24z\n"`, `effectLines:1`, toolResult `bash · exit=0 > U7TB_APPR_RAN` (`a5p5-meta {"kind":"shell","exitCode":0,…}`) |
| `tbash:replay-refused` | PASS | `sameCommandAsApproved:true`, `mode:"new-row-denied"`, replay row `ctrl-013cha70v2f10c1omhbut120` deny / 0 consumptions, `distinctFromApprovedRow:true`, seam re-allow of the spent row → `ok:false` `CONTROL_REQUEST_DECIDED` ("the first decision is authoritative"), `effectLinesAfterReplay:1`, toolResult `a5p5-refused kind=refused-admission code=APPROVAL_DENIED` |
| `tbash:other-command-refused` | PASS | commandHash `sha256:a3f0f2e3…` ≠ pinned `sha256:b673345f…`, row `ctrl-1ubitch1t5w80i1w9ya930k0` deny ("command hash differs from the one pinned grant"), 0 consumptions, `effectOnDisk:null`, `APPROVAL_DENIED` |
| `tbash:deny-zero-effect` | PASS | row `ctrl-1fmon9y1bvy2bh0k7hevc13n`, `decisions:["deny"]`, `consumptions:0`, `effectOnDisk:null`, `APPROVAL_DENIED` |
| `tbash:leak-check` | PASS | `inCorpus:false`, `inHostLog:false`, `bytesUnchanged:true`, `allowsIssued:1` |

### 4.3 Conclusions

1. **The u6-pr3 `proc:approve-spawn-once` failure was NOT a family defect.** On a world
   whose team root grants `request-control`, with the observer on the governed root, the
   unchanged product spawned exactly one confined process for exactly one human allow
   and consumed it exactly once. A replay, a different command and a denied command all
   produced zero effect. The u6-pr3 failure came from (§1): an **envelope gap**
   (team root never named `request-control`, so the bridge failed closed); a
   **wrong-root observer** (r5 polled and resolved on the boot root); and **two judge
   artifacts** (index pairing; a replay expectation that wants a synchronous refusal
   where the bridge correctly opens a NEW row). Boot 1 added one more runner-side
   finding: the governed row is spelled `bash`.
2. **Spelling scope.** The model-facing calls in this record are all `team_bash`
   (`mock-excerpt-boot2.json`: 4 × `"name": "team_bash"`). The PA row's native name
   `bash` is the governance key, not a model-facing spelling, so this record backs the
   `team_bash` ledger row only. The `bash` row (background native takeover) is untouched.
3. **Follow-ups on the OLD u6-proc suite. Not changed in this PR. Neither fix is
   trivial, because each changes the graded semantics of committed u6-proc records.**
   - F-1 `judgeU6Proc` pairs `bashExecutes[i]` with `bashResults[i]` by index
     (`tests/world-factory/lib/u6-proc-assembly.mjs:594`). It must join by `tool_use_id`,
     as `u7-tbash-assembly.mjs` does (C1 test "results join to calls by tool_use_id").
   - F-2 the `note` the judge attaches to `proc:approve-spawn-once`
     (`u6-proc-assembly.mjs:746-748`, whenever a positive-arm digest exists) is a fixed
     success sentence. It is printed under FAIL exactly as under PASS, so make it
     verdict-dependent or drop it. Related: the `proc:approve-replay-refused` law
     (:750-756) should also accept "new row, denied, 0 consumption" (the
     `tbash:replay-refused` law).
   - F-3 (from §1.5) a lane-scoped `request-control` at the team root also arms the
     leader ask lane (`envelope.ts:113-115`). Any u6-proc re-run that grants it must
     move the leader's exec commands off the ask path first.

### 4.4 Ledger change

`dev/agent-workflow/ledgers/u7-tool-acceptance.json`, row `team_bash`: L4-positive
DISCLOSED → PROVEN (`c2/c2-verdicts-boot2.json`, `tbash:approve-spawn-once`). L3-refusal
was already PROVEN (u6-proc r4 `proc:deny-zero-spawn`) and is re-cited to this record's
`tbash:deny-zero-effect`. L2-mounted is re-cited to `tbash:mounted` (a PASS record
whose mount case shows the `team_bash` placement row, instead of a FAIL-overall record).
The `bash` row is unchanged.
