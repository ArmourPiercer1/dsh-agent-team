# Step 4 — E2E harness rerun (brief §6.4 lockfile protocol) — reviewer 4

## Invocation
- command: `node packages/tools/harness/run.mjs --report-dir dev/agent-workflow/evidence/G6-REVIEW/reviewer-4/harness-output`
- workdir: D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G6-R4
- resolution (from harness log): repo root=D:\AgentDev\dsh-plugins\dsh-agent-team, hostTree=...references\deepseek-harness-test-use, dshHome=...references\.dsh-test-p6t6 (worktree has no references/ → REPO_ROOT = main repo, as designed)

## Lockfile protocol (brief §6.4)
- pre: lock ABSENT (checked 2026-08-30T21:29Z local 2026-08-31T05:29+08:00)
- pre probes: :3080=200; ports 3180,3181,3491-3495 all free
- test-use BEFORE: HEAD cd5ef8148158c3a752a658978873241fdf8e2bbc, status --porcelain 0 lines, working tree clean
- lock written: "reviewer-4 g6-review-r4 2026-08-31T05:29:27+08:00"
- job: pwsh-179 (background); node exit 0
- lock written by same job's `finally` block; verified REMOVED after completion

## Harness result (from harness-output/summary.json)
- pass: true, failures: []
- runStamp: p6t6-1788125367915 (my run; distinct from in-tree P6-T6 report)
- build.required: false (artifacts present from earlier task runs; bypass chain skipped per TEST_METHODS §2)
- rowMounted: p6t6-team-tools-boot1=true, p6t6-team-tools-boot2=true
- boots:
  - boot1: port 3180, row p6t6-team-tools, profile created+initialized (cordis.patch.yml), bootMarkerLine "dsh web: http://127.0.0.1:3180/?token=NYZVo5fcZ4RKMxygRKbjv3106jxnL6G3E_5Bc0Hgke8", healthBefore ok/ready/rootSessionId=session-p6t6root/liveSessions=[root, session-child-p6t6seedw1, session-child-p6t6seeds1]/toolCount=10, healthAfter adds scenario-created child sessions (0i9xle4180qy, 00n1eg415hhb, 1v2h6hs1webz, ...), stop killed=true portFree=true
  - boot2: port 3181 (restart over same DSH_HOME)
- ports released: mcp=3491 true, boot1=3180 true, boot2=3181 true
- stable3080: before {reachable true, status 200}, after {reachable true, status 200}
- pristine: before head cd5ef814… statusEmpty true diffEmpty true; after head cd5ef814… statusEmpty true diffEmpty true
- scenarios: all 7 selected E1..E7; per-scenario pass=true (assertion details in harness-output/E*.json)

## Independent post-harness re-verification (reviewer 4, not from summary.json)
- lock file: REMOVED (Test-Path false)
- :3080 after: 200
- ports 3180,3181,3491,3492,3493,3494,3495: all free (Get-NetTCPConnection -State Listen: 0 busy)
- test-use AFTER: HEAD cd5ef8148158c3a752a658978873241fdf8e2bbc; git status --porcelain empty; (git diff HEAD empty, re-verified by direct line inspection — an earlier `[bool](-notmatch)` probe printed False on $null handling; direct status/diff inspection is authoritative: "nothing to commit, working tree clean", 0 diff lines)

## Conclusion
E2E harness rerun PASS with all 7 scenarios (E1..E7) green on a real DSH test instance,
lockfile protocol observed on all exit paths, no impact on stable :3080 or test-use tree.
