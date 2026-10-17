# Alpha.5 W7 (jobs wiring) — real Host Run Receipt

- run stamp: `2026-10-17T02-17-00`
- host baseline: `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (client hash `639ed01539`), tree `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w7/tests/deepseek-harness-test-use` porcelain-clean at W10c
- assembly under test: the jobs-gateway PUBLIC BARREL compiled from unmodified sources by the kit-local project (`tsconfig.lane.json` — the lane’s first tsc pass; the repo `tsconfig*.json` include is GLUE’s shared-file duty per WIRING-PHASE IF-5 and is NOT touched here), mounted by the `a5w7-jobs` row through the profile-patch seam beside the production `dsh-agent-team` row (this worktree’s built dist)
- port: `3184` (IF-2); the stable development instance :3080 only read, never operated — W10a
- world: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w7/tests/homes/a5w7-2026-10-17T02-17-00` — removed
- redaction: credentials redacted AT CAPTURE; the Host’s raw stdout is sealed and deleted; W10b scans every artifact for the raw launch token.
- storm fuse: model waits abort above 300 recorded requests; waits <= 180 s.

## absent-anchor (PROBE-GATED dimension, minimal reproduction)

- host tree `job_start`: pre-run **0** / post-run **NONZERO** hits (evidence `anchor-host-grep-pre.json` / `anchor-host-grep-post.json`; reproduction: `grep -rn job_start <test-use tree>` → 0). The live roster carries no job-start-shaped name (`anchor-runtime-roster.json`). The pinned Host exposes no host-side Jobs face and no public seam for a third-party row to move another scope’s Definition mid-session: the host-registry-shaped revocation therefore stays PROBE-GATED at fixture level (`a5p7-mcp-rebind-chain`, 6/6, cited not booked), and W5 proves the gateway law on the live assembly against a DISCLOSED row-local definition store. The absent-anchor fact is re-asserted, never papered over: this kit registers NO host tool and fakes no host Jobs capability.

## Gate G-g / cancellation semantics (G-g is OPEN — cited from PENDING-GATES, not claimed)

- G-g is OPEN (PENDING-GATES). Abort propagation is COOPERATIVE: the dispatch plane decides what happened; the jobs face mirrors the plane’s events and never promises that a Body stopped. W7b measures the shape live: an outcome across the drain boundary is recorded while the lease settle is refused and the release refuses forever after giveUp.

## criteria (verbatim)

| id | verdict | detail |
| --- | --- | --- |
| W0a | PASS | tsc exit=0 import=BARREL_OK/ |
| W0b | PASS | hits=0 head=639ed01539 porcelain=0 |
| W1a | PASS | port=3184 p6t6=true teamSession=true noToken=401 |
| W1b | FAIL | status=404 body=null |
| W2a | PASS | status=200 body={"type":"server-response","rpcId":"a5w7-y3u9qgwcz","result":{"ok":true,"value":{"data":{"path":"fresh-root","durable":{"teamSession":{"schemaVersion":1,"rootSessionId":"session-a5w7-team-2026-10-17T02-17- |
| W2b | PASS | issued=2 A={"instanceId":"inst-14yxb4z02fu0","templateId":"wa","childSessionId":"fallback-inst-14yxb4z02fu0"} B={"instanceId":"inst-0koqdgy1opdb","templateId":"wb","childSessionId":"fallback-inst-0koqdgy1opdb"} |
| W3a | FAIL | key=undefined admit=null |
| W3b | FAIL | b=null dup=null alarms=0 |
| W3c | FAIL | null |
| W4a | FAIL | A=[] B=[] refusedA={} |
| W4b | FAIL | C=null swapped=null |
| W4c | FAIL | detail= |
| W5a | FAIL | moved=[] a1=undefined a2=undefined b3=undefined |
| W5b | FAIL | admit=null settle=null old=null |
| W6 | FAIL | settled=0 drain=null release=null |
| W7a | FAIL | mutex=null draining=null |
| W7b | FAIL | m1=null blocked=null after=null window=undefined outstanding=null |
| W8 | FAIL | pre=0 post=0 head=639ed01539 porcelain=0 rosterJob=[] |
| W9 | PASS | offenders=[] mentions=10 |
| W10a | PASS | before=401 after=401 |
| W10b | PASS | [] |
| W10c | PASS | world=removed buildGone=true porcelain=0 |

FAILED: W1b, W3a, W3b, W3c, W4a, W4b, W4c, W5a, W5b, W6, W7a, W7b, W8
