# C — capability matrix (2026-11-21, honest per-row status)

Statuses used, and they are not interchangeable:

- **MECHANISM** — the centre-side guarantee is implemented and has passing in-process arms.
- **PRODUCT-PROVEN** — the above AND a real product assembly exercised it end to end.
- **UNPROVEN** — nothing here should be reported as working.

This worktree cannot boot the product: `node_modules` links a pnpm store path that does not exist
here, so neither `tsc` nor a host boot can run. Every PRODUCT-PROVEN row below is therefore empty by
construction until D runs the real host; that is the honest state, not an omission.

| C row | capability | where the centre stands | status |
| --- | --- | --- | --- |
| C-tools | 15 `team_*` tools | declared centre-owned (`CENTRE_TOOL_NAMES`), admitted on authority not on a lane; `ADM-31` pins the closed list against `createTeamTools` in BOTH directions (a 16th tool would be refused as unbound, and the arm fails first) | MECHANISM |
| C-member | Member lifecycle (create → archive) | tools preserved in the new assembly; `installMemberCentre` runs at the member bind, and a governed bind without `centreStatePath` is REFUSED | MECHANISM (unverified end to end) |
| C-work | work delivery (delegate → collect) | same as above: the tools are the centre's own surface, no fs/net lane applies | MECHANISM (unverified end to end) |
| C-fs | FS family (`read`/`write`/`edit`/`read_image`/`grep`/`glob`) | SLICE-1..30 on the pinned host: native definitions remounted per member, real read/write, lane refusals, observation policy both states, search family under ASK and Stop | MECHANISM (in-process, pinned host) |
| C-web | Web family (`web_fetch`) | SLICE-31/32: positive through the confined web face, negative with the transport never called | MECHANISM (in-process, pinned host) |
| C-subprocess | Subprocess family (`bash`) | `process.exec` judged on the working directory; the PTY face mounts and refuses an unregistered owner (`OWNER_NOT_LIVE`); positive control needs a live host agent | MECHANISM, positive control UNPROVEN (D) |
| C-pty | PTY family | same face as C-subprocess; a session is only opened for a live registered agent | MECHANISM, positive control UNPROVEN (D) |
| C-ptc | PTC escalation | the escalation row survives the A0 boundary (`createPtcEscalationRouter`) but the centre has NOT been wired to it | UNPROVEN |
| C-remote | Remote | not wired to the centre; no arms | UNPROVEN |
| C-mcp | MCP | `mcp__*` tools have no `TOOL_AXES` entry, so the centre REFUSES them (`ADMISSION_TOOL_UNBOUND`) — explicit unavailability, not silent execution | UNPROVEN (explicitly unavailable) |
| C-alpha6 | Alpha.6 review routing | preserved in the assembly; no centre interaction, no arms | UNPROVEN |
| C-goal | Goal / Todo | host tools; no centre axis, so the centre refuses them by name. They are not in the closed centre list | UNPROVEN (explicitly unavailable) |
| C-skill | Team Skill | preserved; skill loading reads through the host `skill` service, NOT through the member's confined fs — a known ceiling hole to state in D | UNPROVEN |
| C-fork | Subagent Fork | preserved; no centre interaction, no arms | UNPROVEN |
| C-policy | observation policy two-state | SLICE-10/11 pin OFF (default) and ON on the pinned host | MECHANISM |

## What this table is for

It exists so no row can be silently upgraded by narration. A row moves to PRODUCT-PROVEN only with a
real host boot line at a named commit. The `UNPROVEN (explicitly unavailable)` rows are the ones the
centre currently refuses — which is the A1 law working, not a defect: an unwired controlled call is
refused rather than forwarded.
