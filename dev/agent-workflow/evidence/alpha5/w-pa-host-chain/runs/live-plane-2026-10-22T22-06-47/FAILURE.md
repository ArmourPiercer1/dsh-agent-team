# W-PA host chain — first real failure (verbatim)

* command: `node dev/agent-workflow/evidence/alpha5/w-pa-host-chain/run-pa-host-chain.mjs --plane (worktree /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-m1-kernel)`
* at: 2026-10-22T22:14:41.953Z
* criterion: A2.0 — team.create over the real wire bound the strict PA blueprint on a fresh root
* verbatim detail:

```
{"code":"MALFORMED_DTO","message":"permission policy $.members[0].capabilities.permissions.default must be one of ask | deny (a default of 'allow' is rejected: no silent privilege expansion), got \"allow\" (source: pahc-main.yaml)","details":{"method":"team.create","endpoint":"team.create","contractVersion":1,"requestToken":null,"reason":"domain-error","cause":{"code":"MALFORMED_DTO","message":"pe
```
