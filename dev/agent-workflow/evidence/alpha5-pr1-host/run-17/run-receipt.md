# Alpha.5 PR1 — real Host Run Receipt

- run stamp: `2026-10-16T07-25-14`
- host baseline: `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (client hash `639ed01539`), tree `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr1/tests/deepseek-harness-test-use` porcelain-clean at C7b
- glue under test: this worktree's built dist (`packages/runtime/dist/.../host.js`), mounted as the production `dsh-agent-team` row through the profile-patch seam only
- port: `3185` (the stable development instance :3080 only read, never operated — C7a)
- world: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr1/tests/homes/a5p1-2026-10-16T07-25-14` — removed
- redaction: every credential the kit itself captures (HTTP bodies, headers, log tails, the Host log lines it merges) is redacted at capture; the Host's own stdout is captured raw and redacted before `instance.log` is finalised (`host-stdout.raw` is deleted at the same step, and `sweep-worlds.mjs --scrub-raw` repairs it if a run is killed mid-flight). No credential is left in the evidence directory.
- storm fuse: every model wait aborts above 300 recorded requests; waits are <= 180 s

## dynRan, before and after

| | PoC (alpha.5 adapter P0, KIT H6) | this run (PR1 installed) |
| --- | --- | --- |
| undeclared / unbound tool, body | `hc-dyn-observation.dynRan = true` — the body ran | refused with `TEAM_TOOL_UNGOVERNED` text and no body effect (C2a/C2b) |

## criteria (verbatim)

| id | verdict | detail |
| --- | --- | --- |
| NEG1-CONTROL | PASS | native=1 bodies=NATIVE.grep (exit=0) |
| NEG1-SAFE | PASS | native=0 bodies= (exit=0) |
| NEG1-PARKED | PASS | native=0 adapter=0 teardown=EXECUTION_TERMINATION_UNCONFIRMED text=Error: team tool guard: "grep" is refused because this Agent's Tool Dispatcher is not ACTIVE (assembly-in-prog (exit=0) |
| NEG1-BODY | PASS | native=0 adapter=1 bodies=ADAPTER.grep (exit=0) |
| NEG1-MASK | PASS | parkedLifts=1 parkedFirstTeardown=EXECUTION_TERMINATION_UNCONFIRMED bodyLifts=0 bodyFirstTeardown=EXECUTION_TERMINATION_UNCONFIRMED nativeBeforeRelease=0 (exit=0) |
| NEG1-SEAM | PASS | postExecutedFired=true postExecutedAfterBodyReturn=true inFlightAtTeardown=1 bodyReturnedAtTeardown=false bodyReturnedAtSettled=true (exit=0) |
| NEG1-R4 | PASS | secondTeardown=EXECUTION_TERMINATION_UNCONFIRMED finalState=TOMBSTONED lateSettledRecorded=true lifts=0 native=0 adapter=1 (exit=0) |
| NEG1-STABLE | PASS | parked=ADAPTER.grep body=ADAPTER.grep (exit=0) |
| NEG1-LEAK | PASS | code=EXECUTION_TERMINATION_UNCONFIRMED guardSays=team tool guard: "grep" is refused because this Agent's Tool Dispatcher is not A resumed=Error: team tool guard: "grep" is refused because this Agent (exit=0) |
| C1a | PASS | port=3185 healthOk=true toolCount=15 teamSession=true noToken=401 |
| C1b | PASS | status=200 body={"type":"server-response","rpcId":"a5p1-9cl6uv56j5","result":{"ok":true,"value":{"data":{"path":"fresh-root","durable":{"teamSession":{"schemaVersion":1,"rootSessionId":"session-a5p1-team-2026-10-16T07-25 |
| C1c | PASS | created=2 delegated=3 executed=2 rejected=0 firstRejection= |
| C2a | PASS | asked=1 results=[{"err":true,"text":"Error: team tool guard: \"team_follow_up\" has no Team Tool Binding on this Agent (closed world: an un-governed tool never executes;"},{"err":true,"text":"Error: team tool guard: \"te |
| C2b | PASS | results=["Error: team tool guard: \"team_follow_up\" has no Team Tool Binding on this Agent (closed world: an un-governed tool never executes; declare i","Error: team tool guard: \"team_follow_up\" has no Team Tool Bindi |
| C3 | PASS | read=<path>/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr1/tests/homes/a5p1-2026-10-16T07-25-14/workspace/a5p1-se |
| C4 | PASS | legacyLaneSaw=[{"err":false,"text":"<path>/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr1/tests/homes/a5p1-2026-10-16T07-25-14/workspace/a5p1-seed.txt</pa"},{"err":false,"text":"<path>/srv/workspace/dsh-plugi |
| C4b | PASS | unexpected=[] |
| C5 | PASS | seen=true drift=[] results=["<path>/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr1/tests/homes/a5p1-2026-10","<path>/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr1/tests/homes/a5p1-2026-10"] |
| C1d | PASS | publishes=4 refused=0 |
| C6 | PASS | stopped=[] |
| C7a | PASS | before=401 after=401 |
| C7b | PASS |  |

All criteria pass.
