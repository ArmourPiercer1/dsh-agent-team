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
| C-subprocess | Subprocess family (`bash`) | `process.exec` judged on the working directory; the PTY face mounts and refuses an unregistered owner (`OWNER_NOT_LIVE`); positive control needs a live host agent. BLOCKED on a CONTRACT_CHANGE_REQUEST: there is no declaration source for a process lane | MECHANISM, positive control UNPROVEN (D); product admission BLOCKED pending ruling |
| C-pty | PTY family | same face and same CONTRACT_CHANGE_REQUEST as C-subprocess | MECHANISM, positive control UNPROVEN (D); product admission BLOCKED pending ruling |
| C-ptc | PTC escalation | `run_code` is `process.exec`, so it shares the subprocess lane's CONTRACT_CHANGE_REQUEST; the escalation row (`createPtcEscalationRouter`) survives the A0 boundary but its adjudication is not wired to the centre | UNPROVEN; blocked on the same ruling |
| C-remote | Remote | not wired to the centre; no arms | UNPROVEN |
| C-mcp | MCP | judged on the NETWORK axis with the SERVER as the locator (`net.mcp`, `ADM-33`): unset is not allow, deny is deny, a tool-level restriction narrows it, and a `mcp__` name with no server is refused as malformed rather than matched by prefix. WHICH servers exist stays the mount gate's decision | MECHANISM |
| C-alpha6 | Alpha.6 review routing | preserved in the assembly; no centre interaction, no arms | UNPROVEN |
| C-goal | Goal / Todo | preserved as HOST CAPABILITIES (`get_goal`/`create_goal`/`update_goal`/`todo_write`), axis `host.service`, `ADM-32` | MECHANISM |
| C-skill | Team Skill | preserved as a host capability (`skill`, axis `host.service`, `ADM-32`); its file reads go through the host skill service, NOT the member's confined fs | MECHANISM + recorded LIMIT |
| C-fork | Subagent Fork | preserved as host capabilities (`subagent`, `send_message`, `interrupt_agent`, axis `host.service`, `ADM-32`); the CHILD's own binding governs the child's tools | MECHANISM |
| C-policy | observation policy two-state | SLICE-10/11 pin OFF (default) and ON on the pinned host | MECHANISM |

## What this table is for

It exists so no row can be silently upgraded by narration. A row moves to PRODUCT-PROVEN only with a
real host boot line at a named commit. The `UNPROVEN (explicitly unavailable)` rows are the ones the
centre currently refuses — which is the A1 law working, not a defect: an unwired controlled call is
refused rather than forwarded.

## The `host.service` judgement (recorded, not hidden)

Goal/Todo, Team Skill and Subagent are preserved by the 06 contract, and their I/O belongs to the
HOST's own services (the goal store, `$DSH_HOME/skills`, the subagent registry), not to the member's
workspace. Judging them by the member's fs lane would be wrong in both directions: it would refuse a
capability the contract preserves, and it would pretend the centre confines an I/O it does not see.

So the centre binds the CALL and records the fact with axis `host.service`, and states the limit
plainly: a skill file read by the host skill service is OUTSIDE the member's fs ceiling. That is a
D-report limit, not a claim of confinement. MCP is treated differently because its effects are
unknowable rather than merely out-of-lane: it stays refused by name.

## CONTRACT_CHANGE_REQUEST (open)

`CONTRACT-CHANGE-REQUEST-process-lane.md` records why subprocess/PTY/PTC cannot be admitted: the v4
Blueprint member ceiling is `{read, write, network}` (frozen), the product realm declaration reuses
that shape, `execution.executionBoundary` says WHO executes and not WHAT the shell may touch, and
`shellClass` is an install-spec field the composition passes. There is no single-source declaration
for a process lane, and the three alternatives (judge on the write lane, declare it only in the
product realm, derive it from the boundary) are each a breach of the contract this round is
implementing. The families therefore stay EXPLICITLY REFUSED (`ADMISSION_AXIS_UNSUPPORTED`).
