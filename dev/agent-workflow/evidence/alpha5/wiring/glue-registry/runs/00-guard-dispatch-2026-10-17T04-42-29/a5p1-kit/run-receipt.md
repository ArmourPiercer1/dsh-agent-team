# Alpha.5 PR1 — real Host Run Receipt

- run stamp: `2026-10-17T04-42-29`
- host baseline: `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (client hash `639ed01539`), tree `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-glue/tests/deepseek-harness-test-use` porcelain-clean at C7b
- glue under test: this worktree's built dist (`packages/runtime/dist/.../host.js`), mounted as the production `dsh-agent-team` row through the profile-patch seam only
- port: `3185` (the stable development instance :3080 only read, never operated — C7a)
- world: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-glue/tests/homes/a5p1-2026-10-17T04-42-29` — removed
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
| R1R-SHADOW | PASS | no-bind: nativeList=true verified=false reason=native-shadowed bodies=[] text="Error: team tool guard: "grep" is on the trusted native list, but this Agent res" \| explicit-bind: verified=true binding=team-own:A:grep bod |
| RW-CONTROL | PASS | v1=0 v2=1 resolution=V2 text=ran:grep@V2 (exit=0) |
| RW-NO-CHANGE-CHANNEL-UNSUPPORTED | PASS | refused=true code=IO_POLICY_UNSUPPORTED message=cannot subscribe to the public notification "tools/change": fixture: no tools/change channel on this Host — since the B3 ruling the cancellation of an (exit=0) |
| RW-PRE-EXECUTE-COVERED | PASS | withChange v1=0 v2=0 verifiedAfter=false \| noChange arm refused=true (exit=0) |
| RW-INNER-DOOR | PASS | v1=0 v2=0 innerDoorDenials=[] verifiedAfter=false text=Error: team tool guard: "grep" now resolves to a different ToolDefinition than the one its Binding pinned (def (exit=0) |
| RW-AFTER-DOOR-BODY-ZERO | PASS | v1=0 v2=0 code=ABORTED_BEFORE_DISPATCH issued=["grep:p00-c1"] verifiedAfter=false obs=third-party-execute-listener>legal-re-register (exit=0) |
| RW-TEARDOWN-NO-LEAK | PASS | pendingAfter=[] teardown={"ok":true,"code":null} state=RELEASED (exit=0) |
| RW-AFTER-NO-CHANGE | PASS | v1=1 v2=0 text=ran:grep@V1 issued=0 unvalidated=0 verifiedAfter=true (exit=0) |
| RW-ABORT-INSIDE-BODY-IS-TERMINATION | PASS | v1=1 code=ABORTED terminated=1/1 cancelledBeforeBody=0 text=Error: tool call aborted (exit=0) |
| RW-ISOLATION-NEIGHBOUR-TOOL | PASS | r1=1 v1=0 v2=0 issued=["grep:p00-c1"] watched=[] (exit=0) |
| RW-MULTI-CALL-ALL-CANCELLED | PASS | v1=1 v2=0 cancelled=1 terminated=1 late=0 issued=["grep:p00-c1","grep:p00-c2"] (exit=0) |
| RW-MCP-RESYNC-CANCELS-AND-REBIND-RESTORES | PASS | v1=0 cancelled=1 withdrawnThenRestored=false->true rebindOk=true thirdCallV2=1 rebindErr=null (exit=0) |
| RW-CHANGE-INERT-LOUD | PASS | v2(first)=1 unvalidated=1 issued=0 cancelled=0 channel=armed verifiedAtCallEdge=false (exit=0) |
| RW-INERT-ASSEMBLY-INDISTINGUISHABLE | PASS | installOk=true publishedOk=true channelBeforeInjection=armed (exit=0) |
| RW-CHANNEL-PROVEN-ON-FIRST-DELIVERY | PASS | delivered=proven inert=armed swallow=armed (exit=0) |
| RW-CHANGE-INERT-PINNED-UNTIL-REBIND | PASS | secondRefused=true secondV2=1 v2(first)=1 rebindOk=true thirdExec=true edge=false afterRebind=true rebindErr=null (exit=0) |
| RW-CHANGE-SWALLOWED-LOUD | PASS | v2(first)=1 unvalidated=1 alarms=1 issued=0 cancelled=0 callEdgeDrift=1 bindingRevised=1 control=2 proxy=2 channel=armed (exit=0) |
| RW-CHANGE-SWALLOWED-PINNED-UNTIL-REBIND | PASS | secondRefused=true secondV2=1 v2(first)=1 rebindOk=true thirdExec=true (exit=0) |
| RW-HOOKS-RESULT-IDENTITY | PASS | edges={"post":[{"callId":"p00-c1","code":"ABORTED_BEFORE_DISPATCH"}],"result":[{"callId":"p00-c1","code":"ABORTED_BEFORE_DISPATCH"}]} cancelled=1 (exit=0) |
| C1a | PASS | port=3185 healthOk=true toolCount=15 teamSession=true noToken=401 |
| C1b | PASS | status=200 body={"type":"server-response","rpcId":"a5p1-sczd7zl72v","result":{"ok":true,"value":{"data":{"path":"fresh-root","durable":{"teamSession":{"schemaVersion":1,"rootSessionId":"session-a5p1-team-2026-10-17T04-42 |
| C1c | PASS | created=2 delegated=3 executed=2 rejected=0 firstRejection= |
| C2a | PASS | asked=1 results=[{"err":true,"text":"Error: team tool guard: \"team_follow_up\" has no Team Tool Binding on this Agent (closed world: an un-governed tool never executes;"},{"err":true,"text":"Error: team tool guard: \"te |
| C2b | PASS | results=["Error: team tool guard: \"team_follow_up\" has no Team Tool Binding on this Agent (closed world: an un-governed tool never executes; declare i","Error: team tool guard: \"team_follow_up\" has no Team Tool Bindi |
| C3 | PASS | read=<path>/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-glue/tests/homes/a5p1-2026-10-17T04-42-29/workspace/a5p1-s |
| C4 | PASS | legacyLaneSaw=[{"err":false,"text":"<path>/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-glue/tests/homes/a5p1-2026-10-17T04-42-29/workspace/a5p1-seed.txt</p"},{"err":false,"text":"<path>/srv/workspace/dsh-plugi |
| C4b | PASS | unexpected=[] |
| C5 | PASS | seen=true drift=[] results=["<path>/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-glue/tests/homes/a5p1-2026-1","<path>/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-glue/tests/homes/a5p1-2026-1"] |
| C1d | PASS | publishes=4 refused=0 |
| C6 | PASS | stopped=[] |
| C7a | PASS | before=401 after=401 |
| C7b | PASS |  |

All criteria pass.
