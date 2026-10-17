# Alpha.5 W7 (jobs wiring) — real Host Run Receipt

- run stamp: `2026-10-17T02-17-55`
- host baseline: `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (client hash `639ed01539`), tree `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w7/tests/deepseek-harness-test-use` porcelain-clean at W10c
- assembly under test: the jobs-gateway PUBLIC BARREL compiled from unmodified sources by the kit-local project (`tsconfig.lane.json` — the lane’s first tsc pass; the repo `tsconfig*.json` include is GLUE’s shared-file duty per WIRING-PHASE IF-5 and is NOT touched here), mounted by the `a5w7-jobs` row through the profile-patch seam beside the production `dsh-agent-team` row (this worktree’s built dist)
- port: `3184` (IF-2); the stable development instance :3080 only read, never operated — W10a
- world: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w7/tests/homes/a5w7-2026-10-17T02-17-55` — removed
- redaction: credentials redacted AT CAPTURE; the Host’s raw stdout is sealed and deleted; W10b scans every artifact for the raw launch token.
- storm fuse: model waits abort above 300 recorded requests; waits <= 180 s.

## absent-anchor (PROBE-GATED dimension, minimal reproduction)

- host tree `job_start`: pre-run **0** / post-run **0** hits (evidence `anchor-host-grep-pre.json` / `anchor-host-grep-post.json`; reproduction: `grep -rn job_start <test-use tree>` → 0). The live roster carries no job-start-shaped name (`anchor-runtime-roster.json`). The pinned Host exposes no host-side Jobs face and no public seam for a third-party row to move another scope’s Definition mid-session: the host-registry-shaped revocation therefore stays PROBE-GATED at fixture level (`a5p7-mcp-rebind-chain`, 6/6, cited not booked), and W5 proves the gateway law on the live assembly against a DISCLOSED row-local definition store. The absent-anchor fact is re-asserted, never papered over: this kit registers NO host tool and fakes no host Jobs capability.

## Gate G-g / cancellation semantics (G-g is OPEN — cited from PENDING-GATES, not claimed)

- G-g is OPEN (PENDING-GATES). Abort propagation is COOPERATIVE: the dispatch plane decides what happened; the jobs face mirrors the plane’s events and never promises that a Body stopped. W7b measures the shape live: an outcome across the drain boundary is recorded while the lease settle is refused and the release refuses forever after giveUp.

## criteria (verbatim)

| id | verdict | detail |
| --- | --- | --- |
| W0a | PASS | tsc exit=0 import=BARREL_OK/ |
| W0b | PASS | hits=0 head=639ed01539 porcelain=0 |
| W1a | PASS | port=3184 p6t6=true teamSession=true noToken=401 |
| W1b | PASS | status=200 body={"ok":true,"boot":1,"gateway":"assembled","generation":1,"publicExports":["createJobsGateway","createLeaseWindow","classifyDispatchEvent","jobOwnerKey","projectJobForViewer","redactCredentials","gatewayRe |
| W2a | PASS | status=200 body={"type":"server-response","rpcId":"a5w7-glndc9e9im","result":{"ok":true,"value":{"data":{"path":"fresh-root","durable":{"teamSession":{"schemaVersion":1,"rootSessionId":"session-a5w7-team-2026-10-17T02-17 |
| W2b | PASS | issued=2 A={"instanceId":"inst-12cg52f0vm4d","templateId":"wa","childSessionId":"session-team-child-716405e2fb0cac17395530cb2dbd197f","lifecycle":"CREATED"} B={"instanceId":"inst-18ol7ke0nbo8","templateId":"wb","childSes |
| W3a | PASS | key={"instanceId":"inst-12cg52f0vm4d","rootSessionId":"session-a5w7-team-2026-10-17T02-17-55"} admit={"ok":true,"job":{"jobId":"w7-a-1","ownerKey":"{\"instanceId\":\"inst-12cg52f0vm4d\",\"rootSessionId\":\"session-a5w7-t |
| W3b | PASS | b={"ok":false,"code":"owner-mismatch","detail":"this jobId is already owned by another member scope"} dup={"ok":false,"code":"duplicate-job","detail":"job w7-a-1 already admitted"} alarms=1 |
| W3c | PASS | {"ok":true,"keyAtAdmission":"{\"instanceId\":\"inst-18ol7ke0nbo8\",\"rootSessionId\":\"session-a5w7-team-2026-10-17T02-17-55\"}","keyAfterMutation":"{\"instanceId\":\"inst-18ol7ke0nbo8\",\"rootSessionId\":\"session-a5w7- |
| W4a | PASS | A=["w7-a-1","w7-a-2"] B=["w7-b-3","w7-b-4","w7-pin-1"] refusedA={"w7-pin-1":"owner-mismatch","w7-b-3":"owner-mismatch","w7-b-4":"owner-mismatch"} |
| W4b | PASS | C={"ok":true,"visible":[],"refused":[{"jobId":"w7-a-1","code":"owner-mismatch","detail":"this viewer is not the owning member scope of the job"},{"jobId":"w7-pin- swapped={"ok":true,"visible":[],"refused":[{"jobId":"w7-a |
| W4c | PASS | detail=this viewer is not the owning member scope of the job |
| W5a | PASS | moved=["w7-a-1"] a1=true a2=false b3=false |
| W5b | PASS | admit={"ok":true,"job":{"jobId":"w7-a-5","ownerKey":"{\"instanceId\":\"inst-12cg52f0vm4d\",\"rootSessionId\":\"session-a5w7-team-2026-10-17T02-17-55\"}","scopeKey":"a settle={"ok":true} old={"ok":true,"view":{"jobId":"w7 |
| W6 | PASS | settled=5 drain={"ok":true,"windowState":"DRAINING"} release={"ok":true,"windowState":"RELEASED"} |
| W7a | PASS | mutex={"ok":false,"code":"owner-mismatch","detail":"this jobId is already owned by another member scope"} draining={"ok":false,"code":"gateway-not-active","detail":"cannot acquire a lease while DRAINING: new work is refu |
| W7b | PASS | m1={"kind":"terminated-after-start","sideEffectPossible":true,"evidenceEvent":"dispatcher-call-terminated-after-body-start","abortIssuedBy":"lane-definition-move"} blocked={"ok":false,"code":"release-with-outstanding","d |
| W8 | PASS | pre=0 post=0 head=639ed01539 porcelain=0 rosterJob=[] |
| W9 | PASS | offenders=[] mentions=10 |
| W10a | PASS | before=401 after=401 |
| W10b | PASS | [] |
| W10c | PASS | world=removed buildGone=true porcelain=0 |

All criteria pass.
