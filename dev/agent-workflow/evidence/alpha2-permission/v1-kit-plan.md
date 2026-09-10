# V1 live kit plan (draft, 2026-09-10 — finalize at V1 after A6 lands)

Author: main agent. Consumed by the V1 verification subagent.

## World

- New test home: references/.dsh-test-a2perm-<stamp> (the alpha1-hardening cap-*.mjs kit pattern, evidence/alpha1-hardening/cap-setup.mjs + cap-boot.mjs as the structural reference).
- Host: the BUILT test-use CLI (node apps/cli/lib/bin.js web --port <P> --no-open, DSH_HOME = the world home). Port: 3180 if free at V1 time, ELSE 3181 (3180 was occupied by a user tsx instance at kickoff; do not kill it). Mock DeepSeek :3493, mock MCP :3494 only if needed (alpha.2 file tools need NO MCP — skip 3494 unless the regression leg requires it).
- Plugin install: git+file:/// spec from the int branch worktree (the PBA proven pattern: local bare repo clone or direct git+file of the int worktree, branch int/alpha2-permission) into the world home's web profile.
- Team: leader + Member A (worker-a) + Member B (worker-b), seeded via the cap-setup rowConfig pattern (seedMembers with the two member templates).

## Blueprint (a2-permission-bp)

See a2perm-blueprint.yml (same file). VALIDATED (main agent, 2026-09-11, against int f8ed516 A1 parser via packages/runtime/dist/packages/domain/blueprint/src/index.js):
- `parseBlueprint` → OK. contentHash `sha256:b8bdcf7197e…` (stable across reparse).
- All three templates parse with `capabilities.permissions` present and DEEP-FROZEN (policy, each rule, each resource).
- leader + worker-a: default ask | allow read ./perm-a.txt | ask write ./perm-c.txt | deny read ./perm-b.txt.
- worker-b: default deny | allow/ask/deny all [].
- member count 2 (worker-a, worker-b); top-level revision "1".
- FIX APPLIED THIS SPAN: the on-disk file had the member capabilities sub-fields at the wrong indent (they parsed as unknown TEMPLATE fields, rejecting the blueprint). Rewrote a2perm-blueprint.yml with correct 2-space-per-level nesting; re-validated clean. If you edit the blueprint, re-run the parseBlueprint check before booting the live host.

Semantics per plan §12.1 + §13 L4:
- LEADER (templateId: leader): permissions default ask; allow read ./perm-a.txt; deny read ./perm-b.txt; ask write ./perm-c.txt. teamTools allow includes team_resolve_control + team_request_control + team_send_message + team_list_members (the leader needs resolve for the member-ask leg).
- MEMBER A (worker-a): same per-file lanes as the leader, default ask. teamTools allow [team_delegate, team_send_message].
- MEMBER B (worker-b): default DENY (covers file E: no match / default deny -> zero execution); no allow/ask/deny rules (empty arrays). teamTools allow [team_send_message].
- All three templates: skills deny, mcp deny, builtinToolDeny [] (isolate the permission axis from the alpha.1 axes).

Files on disk in the team workspace (defaultWorkspace = a dir under the world home, e.g. <home>/workspace):
- perm-a.txt (pre-created, known content) — the allow-read target
- perm-b.txt (pre-created) — the deny-read target
- perm-c.txt (pre-created with sentinel content) — the ask-write target
- perm-d.txt (pre-created) — no-match / default ask (member A + leader)
- perm-e.txt (pre-created) — no-match / default deny (member B)

## Scripted model turns (mock DeepSeek :3493)

The hardening kit's mock server returns scripted assistant turns; extend it with tool_calls turns. EXACT CONTRACT (verified main agent 2026-09-11, .worktrees/RC1/packages/tools/harness/mock-deepseek.mjs — 255 lines, DO NOT MODIFY, it is reference-only and test-use must stay pristine): `startMockModel({port, decide, log})`; per request the server calls `reply = decide({seq, req})` where `req` = the parsed OpenAI-style request (the kit can key on `req.messages` content, not just `seq`). Reply shapes: text = `{kind: 'text', content: string}`; tool-call = `{kind: 'tool-call', toolCalls: [{name, arguments, id?}]}` — `arguments` may be a STRING (raw JSON) or an OBJECT (the encoder stringifies it); SSE tool_calls delta encoding (fragmented arguments, finish_reason:'tool_calls', usage chunk, [DONE]) is ALREADY implemented (L205-223). So the V1 kit = a per-identity `decide` callback with the scripted sequence below (advance per identity; one turn each, in order). Per identity, the scripted sequence (one turn each, in order):

LEADER turn script:
1. call read {file_path: <ws>/perm-a.txt}          -> must SUCCEED (allow)
2. call read {file_path: <ws>/perm-b.txt}          -> must be DENIED (static deny; error result "Error: ..."; file unchanged)
3. call write {file_path: <ws>/perm-c.txt, content: "payload-1"}  -> ask -> creates a user-approval request (leader ask) -> the turn PAUSES at pre-execute
   [NEGATIVE: the LEADER tries to resolve its own user-approval request via team_resolve_control -> must be REJECTED (leader cannot self-resolve user-approval; resolver role set: user-approval is human-only)]
   [kit: FIND the requestId via remote team.getLedgerPage (category 'control' — entries pass through raw per the A4 report; a `control-request-recorded` entry's payload carries `requestId` + scope incl. operationFingerprint; a request is PENDING while no `control-decision-recorded` entry carries its requestId — the projection's pendingControlCount mirrors exactly this derivation, projection-source.ts L718-744). Then call team.resolveControl {teamSessionId: root, requestId, decision: "allow"}]
4. (same turn resumes) the write EXECUTES exactly once (perm-c.txt content == "payload-1")
5. call write {file_path: <ws>/perm-c.txt, content: "payload-1"} again (same file+content, NEW callId) -> ask again -> NEW request (the old decision was consumed)
   [kit: deny this one via team.resolveControl decision "deny"]
6. -> zero execution (perm-c.txt still "payload-1")

MEMBER A turn script (driven via member.send / team_delegate as in the hardening kit):
1. read ./perm-a.txt -> SUCCEEDS
2. read ./perm-b.txt -> DENIED (static)
3. write ./perm-c.txt "member-payload" -> ask -> LEADER-approval request
   [kit: the LEADER resolves it — scripted leader turn calling team_resolve_control {requestId, decision allow} (or the kit drives the leader session via the mock); assert the member's request kind is leader-approval AND that a member caller resolving its own request is rejected (self-approval forbidden — negative leg)]
4. write executes once
5. write ./perm-d.txt "d" -> ask -> default ask (no rule match) -> leader allows -> executes

MEMBER B turn script:
1. read ./perm-a.txt -> DENIED (default deny, no allow rule)
2. read ./perm-e.txt -> DENIED (default deny)
   [zero executions, no control rows created for member B at all (default deny does not ask)]

## Safety negatives (plan §12.6, live or t4a-level where noted)

- malformed path (file_path missing) -> deny, zero execution (t4a-level + live if the mock can script a bad arg)
- canonicalization failure (unresolvable path — e.g. a path the fs backend rejects) -> deny
- ask without decision -> no execution (the turn stays paused; assert tool body not run: file unchanged + no consumption row)
- double allow consumption forbidden (second consume -> allow-consumed block)
- scope/fingerprint mismatch (same file different payload after an allow -> old approval unusable)
- unsupported tool pass-through (e.g. a scripted web_fetch or team_send_message call runs WITHOUT creating control rows)

## Cold resume (plan §12.4)

- After the live checks: stop the host (kill + port-free), restart the SAME world home (bootPhase auto-adopt) -> assert:
  - static permission policy rebuilt (a new scripted member write to perm-c.txt asks AGAIN — new request, because the previous allow was consumed)
  - pending durable ControlRequest still visible in the projection (create one pending request, do NOT resolve it, restart, assert it is still listed)
  - existing decision preserved + existing consumption preserved (the consumed request from leg 4 still shows decision + consumption rows)
  - a tool call that was awaiting at process death is terminated (accepted alpha.2 behavior; no hang)

## Regression legs (plan §12.5, alpha.1 behavior unchanged)

- REUSE the alpha1-hardening FINAL worlds as the regression baseline where possible (the hardening6 world already proves create 27/27 + resume 16/16 on alpha.1). For alpha.2: run the caplegacy-style LEGACY probe on the NEW int build (shipped my-team-bp-1, no capabilities -> zero permission listeners -> toolCount=10, full catalog) — this is the "legacy Blueprint does not regress" live proof on the alpha.2 dist.
- t4a legacy suite + t1/t2/t3 focused suites on the int tree (unit level).

## Output artifacts (evidence/alpha2-permission/v1/)

- summary.md (the DoD table per plan §17, gate-by-gate)
- focused-tests.txt (all focused suite numbers)
- live-perm.json (the static-decision + allow-once + routing assertions, emitted by the kit)
- cold-resume.json (the 12.4 assertions)
- legacy-probe.json (the legacy regression probe)
- environment-cleanliness.txt (ports free, homes, test-use porcelain, :3080 zero-touch)
- the kit scripts themselves (a2perm-setup.mjs / a2perm-boot.mjs / a2perm-check.mjs / a2perm-legacy.mjs)
