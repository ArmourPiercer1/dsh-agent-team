# Alpha.5 W7 (jobs wiring) — real Host Run Receipt

- run stamp: `2026-10-17T07-48-16`
- host baseline: `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (client hash `639ed01539`), tree `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-prod-pr7/tests/deepseek-harness-test-use` porcelain-clean at W10c
- assembly under test: the jobs-gateway PUBLIC BARREL = the COMMITTED repo dist (`packages/runtime/dist/packages/runtime/jobs-gateway/index.js` — the install-surface artifact; W0a proves a fresh build of the lane on the REPO BUILD PLANE is byte-identical to it, so the assembly under test IS the shipped production class, not a kit-local copy), mounted by the `a5w7-jobs` row through the profile-patch seam beside the production `dsh-agent-team` row (this worktree’s built dist). The row drives the production injection surface (pc-CONTRACT.md): `identity` = durable MemberInstance authority through the production assembly’s repositories (the GATEWAY refuses non-durable claims), `lease` = the assembly-owned window the gateway drives and teardown acts on, `resolveDefinition` = the row-local store (disclosed) doubling as the admit-time pinner (W5b’s recovery admission omits its pin and is pinned BY THE READER).
- port: `3184` (IF-2); the stable development instance :3080 only read, never operated — W10a
- world: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-prod-pr7/tests/homes/a5w7-2026-10-17T07-48-16` — removed
- redaction: credentials redacted AT CAPTURE; the Host’s raw stdout is sealed and deleted; W10b scans every artifact for the raw launch token.
- storm fuse: model waits abort above 300 recorded requests; waits <= 180 s.

## absent-anchor (PROBE-GATED dimension, minimal reproduction)

- host tree `job_start`: pre-run **0** / post-run **0** hits (evidence `anchor-host-grep-pre.json` / `anchor-host-grep-post.json`; reproduction: `grep -rn job_start <test-use tree>` → 0). The live roster carries no job-start-shaped name (`anchor-runtime-roster.json`). The pinned Host exposes no host-side Jobs face and no public seam for a third-party row to move another scope’s Definition mid-session: the host-registry-shaped revocation therefore stays PROBE-GATED at fixture level (`a5p7-mcp-rebind-chain`, 7/7 incl. the production-shape injection leg, cited not booked), and W5 proves the gateway law on the live assembly against a DISCLOSED row-local definition store. The absent-anchor fact is re-asserted, never papered over: this kit registers NO host tool and fakes no host Jobs capability.

## Gate G-g / cancellation semantics (G-g is OPEN — cited from PENDING-GATES, not claimed)

- G-g is OPEN (PENDING-GATES). Abort propagation is COOPERATIVE: the dispatch plane decides what happened; the jobs face mirrors the plane’s events and never promises that a Body stopped. W7b measures the shape live: an outcome across the drain boundary is recorded while the lease settle is refused and the release refuses forever after giveUp.

## criteria (verbatim)

| id | verdict | detail |
| --- | --- | --- |
| W0a | PASS | tsc exit=0 parity=IDENTICAL(12 emitted artifact files byte-identical to the committed mirror (maps excluded: the --outDir override rewrites source paths, a tsc artifact, not drift)) import=BARREL_OK/ |
| W0b | PASS | hits=0 head=639ed01539 porcelain=0 |
| W1a | PASS | port=3184 p6t6=true teamSession=true noToken=401 |
| W1b | PASS | status=200 body={"ok":true,"boot":1,"gateway":"assembled","generation":1,"publicExports":["createJobsGateway","createLeaseWindow","classifyDispatchEvent","jobOwnerKey","projectJobForViewer","redactCredentials","gatewayRe |
| W2a | PASS | status=200 body={"type":"server-response","rpcId":"a5w7-ek0r7r6v7d","result":{"ok":true,"value":{"data":{"path":"fresh-root","durable":{"teamSession":{"schemaVersion":1,"rootSessionId":"session-a5w7-team-2026-10-17T07-48 |
| W2b | PASS | issued=2 A={"instanceId":"inst-14ila5j1c2yd","templateId":"wa","childSessionId":"session-team-child-a68ba615b8359676ce0637fe869f95c1","lifecycle":"CREATED"} B={"instanceId":"inst-014kskq0utb7","templateId":"wb","childSes |
| W3a | PASS | key={"instanceId":"inst-14ila5j1c2yd","rootSessionId":"session-a5w7-team-2026-10-17T07-48-16"} admit={"ok":true,"job":{"jobId":"w7-a-1","ownerKey":"{\"instanceId\":\"inst-14ila5j1c2yd\",\"rootSessionId\":\"session-a5w7-t |
| W3b | PASS | b={"ok":false,"code":"owner-mismatch","detail":"this jobId is already owned by another member scope"} dup={"ok":false,"code":"duplicate-job","detail":"job w7-a-1 already admitted"} alarms=1 |
| W3c | PASS | {"ok":true,"keyAtAdmission":"{\"instanceId\":\"inst-014kskq0utb7\",\"rootSessionId\":\"session-a5w7-team-2026-10-17T07-48-16\"}","keyAfterMutation":"{\"instanceId\":\"inst-014kskq0utb7\",\"rootSessionId\":\"session-a5w7- |
| W4a | PASS | A=["w7-a-1","w7-a-2"] B=["w7-b-3","w7-b-4","w7-pin-1"] refusedA={"w7-pin-1":"owner-mismatch","w7-b-3":"owner-mismatch","w7-b-4":"owner-mismatch"} |
| W4b | PASS | C={"ok":true,"visible":[],"refused":[{"jobId":"w7-a-1","code":"owner-mismatch","detail":"this viewer is not the owning member scope of the job"},{"jobId":"w7-pin- swapped={"ok":true,"visible":[],"refused":[{"jobId":"w7-a |
| W4c | PASS | detail=this viewer is not the owning member scope of the job |
| W5a | PASS | moved=["w7-a-1"] a1=true a2=false b3=false |
| W5b | PASS | admit={"ok":true,"job":{"jobId":"w7-a-5","ownerKey":"{\"instanceId\":\"inst-14ila5j1c2yd\",\"rootSessionId\":\"session-a5w7-team-2026-10-17T07-48-16\"}","scopeKey":"a settle={"ok":true} old={"ok":true,"view":{"jobId":"w7 |
| W6 | PASS | settled=5 drain={"ok":true,"windowState":"DRAINING"} release={"ok":true,"windowState":"RELEASED"} assemblyOwnsWindow=true identitySourceInjected=true |
| W7a | PASS | mutex={"ok":false,"code":"owner-mismatch","detail":"this jobId is already owned by another member scope"} draining={"ok":false,"code":"gateway-not-active","detail":"cannot acquire a lease while DRAINING: new work is refu |
| W7b | PASS | m1={"kind":"terminated-after-start","sideEffectPossible":true,"evidenceEvent":"dispatcher-call-terminated-after-body-start","abortIssuedBy":"lane-definition-move"} blocked={"ok":false,"code":"release-with-outstanding","d |
| W8 | PASS | pre=0 post=0 head=639ed01539 porcelain=0 rosterJob=[] |
| W9 | PASS | offenders=[] mentions=10 |
| W10a | PASS | before=401 after=401 |
| W10b | PASS | [] |
| W10c | PASS | world=removed buildGone=true porcelain=0 |

All criteria pass.
