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
| C-ptc | PTC escalation | **EXPLICITLY UNAVAILABLE (b)** — `run_code` is the PTC entry and the centre refuses it BEFORE the body with its own code `ADMISSION_PTC_UNAVAILABLE` (`admission.ts:318`), distinct from the generic `ADMISSION_AXIS_UNSUPPORTED` a plain `bash` carries. The row is recorded on `process.exec` with the reason naming BOTH absences (no process lane — the open CCR — and the escalation row's grants minted outside the centre). `ADM-87` proves the fact + settlement REFUSED/not-started + zero body on the real `installMemberCentre` composition, and the distinctness; `ADM-88` pins the closed table. The escalation ASK is unreachable for a governed member because the tool never executes. NOT PROVEN: a refusal driven through `createPtcEscalationRouter` itself (no governed face is registered in this cut) and any host boot | MECHANISM (explicit unavailability); escalation-router refusal UNPROVEN |
| C-remote | Remote | **EXPLICITLY UNAVAILABLE (b)** — a row configured for the centre does not build the S6 command plane at all (`root.ts:4325`, via `refuseHostSurfaceBefore`): the refusal is written as a fact on the existing `team.control` axis and the product settlement closes it REFUSED/not-started. There is no remote-command axis in the compiled contract (the dispatcher is authorized by the server-derived principal, not by a member binding), so admitting it would need a new axis or a second authority. `ADM-86` drives the SAME product helper with a zeroed dispatcher and proves the ungoverned row still builds/dispatches (positive control). NOT PROVEN: a host boot; the disclosed product consequence is that a centre-configured row has no remote API (`root.remoteDispatcher` is absent) | MECHANISM (explicit unavailability); product entry wired, not booted |
| C-mcp | MCP | judged on the NETWORK axis with the SERVER as the locator (`net.mcp`, `ADM-33`): unset is not allow, deny is deny, a tool-level restriction narrows it, and a `mcp__` name with no server is refused as malformed rather than matched by prefix. WHICH servers exist stays the mount gate's decision | MECHANISM |
| C-alpha6 | Alpha.6 review routing | **EXPLICITLY UNAVAILABLE (b)** — the opt-in is refused with its own code `ADMISSION_ALPHA6_UNAVAILABLE`, in TWO independent gates that name the same missing axis: the pure config rule (`centre-config.ts:67`, `ADM-34`) and, for a row that builds the root directly on a centre-configured row, a recorded refusal on `host.service` (`root.ts:2500`) followed by a typed boot refusal — no review wake is dispatched. Review routing decides who may review whom before any tool call, so the centre has no lane or locator for it, and the previous "needs a centreStatePath" shape bought a durable store outside the centre, not centre adjudication. `ADM-85` proves the recorded refusal + settlement REFUSED/not-started + zero wakes, with an ungoverned positive control. NOT PROVEN: a host boot and the PA approval-fact join (D) | MECHANISM (explicit unavailability); PA join UNPROVEN |
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

## MEASURED (round 49): the durable Alpha.4 overlay reaches the centre — E3 green, still not PRODUCT-PROVEN

`a3p4-pr4-production-entry-regression` E3 is GREEN and the migrated suite is 238/238. The world was
rebuilt on the current contract (v4 `memberIoCeilings`, the row's `a5sfMemberPolicies` declaration,
`centreStatePath`, an opt-in real Cordis service scope in the bridge) and the centre now receives an
`overlayDecision` supplier over the SAME durable `permissionOverlay` port the mutation lane appends
through. The supplier is deny-only (ADM-45: consulted only when the lane allows; `deny | undefined`)
and reads/decodes the row per call, keyed on the overlay's own generation.

**What E3 proves:** no overlay row ⇒ the v4 compiled `write` ALLOW executes (`nextCalls === 1`); after
a persisted `grantInstance` deny through the production mutation lane, the same call is refused with
`ADMISSION_OVERLAY_DENY` and executes nothing (`nextCalls === 0`).

**What it does NOT prove:** no host boot line, so this is not PRODUCT-PROVEN and no row above is
upgraded. The world mounts a real declared realm, so it is NOT a witness for the realm-less admission
question below. Overlay `ask`/`allow` are outside the port; subtree containment is implemented but the
E3 probe is an exact deny. Full detail: `MIGRATED-SUITE-STATUS.md` §"Round 49 (current)".

## ESCALATED: a realm-less member has no admission at all (round 34)

`ESCALATION-realmless-admission.md` — the ceiling for such a member can come from the SAME compiler
(`createProductRealmProvider(...).compiledFor(member)`, which the realm mount itself calls), so compiling
without mounting is not a second policy. The question is what the product should DO: admit calls whose
provider is unconfined and say so, or refuse everything without a confined provider. Current state is
neither — the calls are unmediated and unreported.

## OPEN: admission is installed only when a realm is mounted (round 33; E3 no longer witnesses it)

The centre is installed inside `if (a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined)`, so a
member without a confined-provider realm gets NO admission point at all — its native tools run under the
host's mediation with no decision, no ledger and no settlement. That is not the "unwired controlled call
is explicitly refused" law; it is the tool not being covered. Round 49 rebuilt E3's world to mount a
declared realm, so E3 no longer observes zero legs and no longer acts as this defect's witness; the
defect itself is UNCHANGED and remains tracked by `ESCALATION-realmless-admission.md`. Small,
security-relevant, and still the first item in the repair order (see `MIGRATED-SUITE-STATUS.md`).

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
implementing. The families therefore stay EXPLICITLY REFUSED (`bash`/`pwsh`:
`ADMISSION_AXIS_UNSUPPORTED`; `run_code`: its own `ADMISSION_PTC_UNAVAILABLE`, because PTC's absence
is the lane PLUS the escalation row's second authority — round 55, `ADM-87`). The ruling is untouched.

## Round 55: the three rows that were neither wired nor named

`ADM-85`…`ADM-88` settle C-remote, C-alpha6 and C-ptc as **explicitly unavailable**, each with its
own code, its own existing axis and the product's own fact + settlement shapes:

| capability | code | axis recorded | where the refusal is taken | arm |
| --- | --- | --- | --- | --- |
| remote | `ADMISSION_REMOTE_UNAVAILABLE` | `team.control` | `root.ts:4325` (surface not built; `refuseHostSurfaceBefore`) | `ADM-86` |
| Alpha.6 review routing | `ADMISSION_ALPHA6_UNAVAILABLE` | `host.service` | `centre-config.ts:67` (config) + `root.ts:2500` (recorded + typed boot refusal) | `ADM-85`, `ADM-34` |
| PTC escalation | `ADMISSION_PTC_UNAVAILABLE` | `process.exec` | `admission.ts:318` (the ONE centre, before the body) | `ADM-87`, `ADM-88` |

The closed table is `host-surface-refusal.mjs`; an unknown capability throws rather than being
"refused generically". What this does NOT buy: a host boot (D), a router-side PTC refusal (no governed
face is registered), nor any claim that a governed row should keep its remote API — that trade-off is
disclosed in the C-remote row, not hidden.

