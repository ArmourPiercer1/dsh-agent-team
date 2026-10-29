# U2 final gate captures (UTC 2026-10-25T10:59:14Z, tree=commit C + clean)

== tests/s2-authority suites ==
authority-dual-read.test.mjs: ALL GREEN (9 cases, actual count)
authority-snapshot-isolated.test.mjs: ALL GREEN (30 cases, actual count)
ci-snapshot-reader.test.mjs: ALL GREEN (13 cases, actual count)
consumer-candidate.test.mjs: ALL GREEN (11 cases, actual count)
current-authority-pointer.test.mjs: u2-current-authority: 25/25 passed
probe-candidate.test.mjs: ALL GREEN (7 cases, actual count)
sync-candidate-resolver.test.mjs: ALL GREEN (8 cases, actual count)

== a5 testkit (pointer production-entry controls incl.) ==
 Test Files  1 passed (1)
      Tests  35 passed (35)

== docs gates ==
docs:sync --check: docs=53 notes=4 plans=23(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
docs-sync exit=0
docs:probe base=origin/master head=8552597c3 changed=49 rules=md-links,derived-view,contracts-shape,terminology,claims-need-evidence,id-uniqueness,contract-anchors,doc-ownership-impact
docs:probe blocking=0 non_blocking=0 advisories=3 contracts=20 pairs compared
controls=94 failed=8  scope: static document checks only (no C1/C2/C3, no runtime behaviour)

== ci-pr-gate legs (pointer mode live) ==
DSH-CI-LEG leg=graph-parse verdict=pass seconds=0.5 detail=dev/agent-workflow/graph.yaml parses: OK mapping-keys 51
DSH-CI-LEG leg=state-freshness verdict=pass seconds=0.2 detail=pointer agrees both ways (round 58 = newest record = last log heading), records contiguous, a23e5c8f reachable (lag 167 commits); current contract ok (phase_id alpha5-tool-io-governance, baseline 9b2ee57bc5af…, matrix rows 26 claimed 0, drift 127 path(s))
DSH-CI-VERDICT pass pass=2 fail=0 skip=0 skipped=none legs=2 refused=0 refusedlegs=none seconds=0.6

== typecheck ==
packages/client typecheck: Done
typecheck exit=0

== commit D additions (lint closure, UTC 11:13:44Z) ==
npx eslint <six scripts>: exit=0
eslint: clean (exit 0)
lint-identities: 161 identity lines, 76 distinct (target .)
lint-identities: universe: 1335 file(s) linted, 0 of them gitignored (ESLint does not read .gitignore, so the identity set is a function of these files, not of git status)
a4p7 lint leg isolated: PASS (1 passed | 34 skipped)
post-D gates: controls=94 failed=8 (unchanged) | docs-sync blocking=0 | ci-pr-gate legs pass pass=2 | a5 35/35 | s2 pointer 25/25 + snapshot 30 + reader 13 + candidate 11

== CI on PR #365 (head bd30dfd077a8c7f7de3266d5029c4fa9582d2837, base master) ==
pr-gate pass 1m45s | census-runtime pass 17m35s (CI exercised the pointer-branch precheck: current-authority.mjs --print-baseline) | candidate-protection pass 13s
watched to terminal state UTC 2026-10-25T11:46:36Z; zero fix rounds; PR left UNMERGED (merge belongs to main agent)
