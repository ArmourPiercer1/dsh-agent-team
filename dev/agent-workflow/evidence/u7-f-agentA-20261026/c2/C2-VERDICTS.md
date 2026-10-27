# C2 verdicts — u7-agent-control (world u5u7fa5-20261027T00-22-36Z, boot 5/5 declared cap)

Machine records: `run-u7fa5.json`, `run-u7fa5.log`, `*u7fa5*.u7fa-evidence.json`,
`budget-ledger.jsonl` (5 boots: u7fa1..u7fa5; per-boot reasons in boot-budget.md).
Stable instance :3080 untouched (read-only 401 probe, `stable-instance-unchanged` PASS).

| case | verdict | verbatim evidence |
| --- | --- | --- |
| ac:mounted | **PASS** | host placement-feed rows=[team_grep,team_glob,team_bash,**subagent,subagent_fork,send_message,interrupt_agent,list_agents,list_subagent_models,workflow**] on the production glue; pilot RANS on the governed session; zero mount/placement REFUSED lines |
| ac:enumerate-governed | **REFUSED** (authorized walk RAN; port leg typed — never flipped) | durable Control row `ctrl-1eoib0h1jnfsym0xbah8r0oe` toolName=list_agents summary=`PA ask case=tadm:session-u7fa-team-...:inst-1ckbckx0d6vt:sha256:e784e173...` settled ONCE by the runner (resolveControl v4, status 200) → grant CONSUMED → port answered: `Error: refused-agent-control agent-runtime-leg-unwired — no agent-runtime port answers this leg for this mount — the governed row refuses with zero reach, never a fake and never a bypass (leg 'listAgents')` — at this pin the only agentTeams provider is the upstream EXPERIMENTAL agent-team runtime, which carries no face for a vNext governed member roster; exposing the vNext roster face is the named follow-up round (same round as the callerAuthority injection) |
| ac:spawn-failclosed | **REFUSED** (DESIGNED production posture, live-proven) | `Error: refused-agent-control agent-control-amplification-refused — a child may not carry broader authority than its caller: the mount carries no caller-authority snapshot: a spawn with no bounded caller can never prove it stays inside it (fail closed)` — ZERO Control rows for the spawn, ZERO spawn (fence BEFORE PA) |
| ac:interrupt-foreign-zero | **PASS** | `Error: refused-agent-control agent-control-scope-foreign — target is outside this mount's scope (target names scope 'u7fa-foreign-scope-u5u7f', not this mount's own scope) — zero reach, nothing was probed` — ZERO Control rows opened, ZERO `agent-control-interrupt_agent RAN` witnesses |
| ac:leak-check | **PASS** | owned Pids dead, ports released, home released, leases released |
| stable-instance-unchanged | **PASS** | :3080 read-only probe 401 before/after |

Also proven live as a side witness (boot-4): the CLOSED grammar refuses
out-of-grammar payloads with zero reach (`agent-control-schema-refused —
unknown field 'message'`), and the deny-default posture reaches the family
verbatim (`template-default-deny`, boot-3) — the plane policy channel from the
blueprint template to the family row is REAL, not asserted.
