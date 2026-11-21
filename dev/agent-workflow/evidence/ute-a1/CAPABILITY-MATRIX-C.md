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

## RED: the durable Alpha.4 permission overlay has no decision-side effect (round 31)

`a3p4-pr4-production-entry-regression` E3 is RED for a real reason, not a stale pin. The retired entry
installed a pre-execute adapter that consulted the **durable permission overlay** per call; the A1 cut
retired the adapter with the execution route, and the new centre judges a call against the compiled
binding lanes only. A `grantInstance` deny persisted after the member was bound therefore changes nothing
at execution time. This is a preserved product capability (Alpha.4 plane) and it is LOST in the new
assembly until the centre consumes it. Options and consequences are in
`MIGRATED-SUITE-STATUS.md`; the decision belongs with the Control allow/ask/deny wiring, because both ask
"what is the ONE place a durable restriction becomes a verdict".

## RED: admission is installed only when a realm is mounted (round 33)

The centre is installed inside `if (a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined)`, so a
member without a confined-provider realm gets NO admission point at all — its native tools run under the
host's mediation with no decision, no ledger and no settlement. That is not the "unwired controlled call
is explicitly refused" law; it is the tool not being covered. E3's world is such a world, which is why it
observes zero pre-execute legs. Small, security-relevant, and first in the repair order (see
`MIGRATED-SUITE-STATUS.md`).

## What the adversarial review found in the centre (round 28)

No P0. Seven P1s; the ones that mattered were all in the PRODUCT composition rather than in the
mechanism, which is why the mechanism-level arms could not see them:

| finding | state |
| --- | --- |
| settlement recorded the lane's raw answer, then overruled it (a refused call recovered as UNKNOWN) | FIXED — settles the enforced decision; the fact keeps both (`decision` + `laneDecision`) |
| `recoverUnsettled` ran over ONE shared settlement dir, so a member bind turned another member's live execution UNKNOWN | FIXED — per member |
| the post-approval recheck consulted a frozen binding, so it could only agree with itself | FIXED — live resolver; ADM-37 narrows the lane between the two consultations |
| realm disposer registered twice, so close STARTED it before the native tombstone was awaited | FIXED — ordering |
| a throwing ledger/settlement path escaped the listener instead of refusing | FIXED — three explicit deny codes, ADM-38 |
| the per-call memo served any dispatch with the same callId (a retry could inherit an allow) | FIXED — memo serves one execution object, ADM-38 |
| an admitted-as-allow call refused by the recheck has no legal settlement state | **ESCALATED** — `CONTRACT-CHANGE-REQUEST-settlement-recheck.md`; reported as `SETTLEMENT_CONTRACT_GAP` |

Two P2 classes are also closed (a gap in the compiled answer no longer inherits the ceiling; the ledger
no longer lets a caller rename a record kind or end a call twice). Three remain and are CONTRACT
questions rather than widenings: the third grant-id scheme (there is no approval binder wired in the
product at all, so asks are refusals), `agentId: sessionId` (two identities in one field), and the
synthetic `executionIdOf` join. None may be fixed by inventing a fourth scheme.

## CONTRACT_CHANGE_REQUEST (open)

`CONTRACT-CHANGE-REQUEST-process-lane.md` records why subprocess/PTY/PTC cannot be admitted: the v4
Blueprint member ceiling is `{read, write, network}` (frozen), the product realm declaration reuses
that shape, `execution.executionBoundary` says WHO executes and not WHAT the shell may touch, and
`shellClass` is an install-spec field the composition passes. There is no single-source declaration
for a process lane, and the three alternatives (judge on the write lane, declare it only in the
product realm, derive it from the boundary) are each a breach of the contract this round is
implementing. The families therefore stay EXPLICITLY REFUSED (`ADMISSION_AXIS_UNSUPPORTED`).
