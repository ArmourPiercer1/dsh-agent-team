# C — capability matrix (2026-11-21, honest per-row status)

Statuses used, and they are not interchangeable:

- **MECHANISM** — the centre-side guarantee is implemented and has passing in-process arms.
- **PRODUCT-PROVEN** — the above AND a real product assembly exercised it end to end.
- **UNPROVEN** — nothing here should be reported as working.

This worktree **does** boot the product at this HEAD (measured rounds 58–60, `D-BOOT-FEASIBILITY.md` §2/§11/
§12): the `node_modules` link resolves, `tsc` runs from the main install, and a real `dsh web` host serves a
centre-configured row. The earlier statement that the link points at a nonexistent pnpm store was true only
at the commit where it was observed and is corrected here. That changes the ENVIRONMENT fact only: no row
below is PRODUCT-PROVEN, and "boots" is not "the capability is proven".

| C row | capability | where the centre stands | status |
| --- | --- | --- | --- |
| C-tools | 15 `team_*` tools | declared centre-owned (`CENTRE_TOOL_NAMES`), admitted on authority not on a lane; `ADM-31` pins the closed list against `createTeamTools` in BOTH directions. **ROUND 56 — DRIVEN END TO END over the product's own surface** (`createTeamTools` over the real `TeamRuntime`, `TeamDomain`, `ControlService`): `ADM-89` admits all 15 in declared order on `team.control`, each with a durable authority fact (read back from disk) + execution fact + `COMPLETED` settlement and its PRODUCT body reached; `ADM-90` refuses all 15 for an unbound agent with `ADMISSION_NO_BINDING`, zero bodies/deliveries/creations, `REFUSED`/`not-started` settlements; `ADM-91` refuses an unlisted name (`team_delete_team`, `team_promote_member`) by `ADMISSION_TOOL_UNBOUND` while the same centre still admits a classified `read` on `fs.read` | MECHANISM (end-to-end in-process over the product tool surface; NO host boot) |
| C-member | Member lifecycle (create → archive) | tools preserved in the new assembly; `installMemberCentre` runs at the member bind, and a governed bind without `centreStatePath` is REFUSED. **ROUND 56:** `ADM-92` creates a member through `team_create_member` (real `member-activated` effect, durable row, Leader authority fact `team.control`/allow/`COMPLETED`); the member's OWN centre is installed through `installMemberExecution` at the child-session factory, and its calls are judged there (member ledger, member's `policyGeneration`) with the Leader's centre allowing the same locator the member's narrower lane denies. `ADM-93` archives through `team_archive_member` (production step ports: quiesce → settle-then-archive commits → `release-residency` disposes the member handle, which runs the centre's close): the member's pre-close fact survives, the durable row is `ARCHIVED`, and the next call is `ADMISSION_MEMBER_CLOSED` with a `REFUSED`/`not-started` settlement (transitions `ADMITTED → REFUSED`), never `UNKNOWN`; a second archive commits nothing, and the Leader's centre is unaffected | MECHANISM (end-to-end in-process; the archived member's PRODUCT ROUTE refuses earlier at the durable lifecycle gate — see "not proven") |
| C-work | work delivery (delegate → collect) | same as above: the tools are the centre's own surface, no fs/net lane applies. **ROUND 56:** `ADM-94` delegates through `team_delegate` (one synchronous unit, prompt delivered verbatim through the host work-delivery seam, `work-admitted` with `settled: true` and the member result) and collects it through `team_collect` (terminal `succeeded` entry with the same result, durable `settledSequence`); the collected work's own member calls are judged by THAT member's centre — its ledger, its generation, its lane (member `LANE_DENY` where the Leader allows) — and never appear in the Leader's ledger. `ADM-95` (negative) shows a refused delegation (`ADMISSION_NO_BINDING`) delivers nothing, admits no work unit and commits no lifecycle transition, and that the following collect is a zero-write read returning `unavailable` for that token | MECHANISM (end-to-end in-process over the product tool surface; NO host boot) |
| C-fs | FS family (`read`/`write`/`edit`/`read_image`/`grep`/`glob`) | SLICE-1..30 on the pinned host: native definitions remounted per member, real read/write, lane refusals, observation policy both states, search family under ASK and Stop | MECHANISM (in-process, pinned host) |
| C-web | Web family (`web_fetch`) | SLICE-31/32: positive through the confined web face, negative with the transport never called | MECHANISM (in-process, pinned host) |
| C-subprocess | Subprocess family (`bash`) | `process.exec` judged on the working directory; the PTY face mounts and refuses an unregistered owner (`OWNER_NOT_LIVE`); positive control needs a live host agent. BLOCKED on a CONTRACT_CHANGE_REQUEST: there is no declaration source for a process lane | MECHANISM, positive control UNPROVEN (D); product admission BLOCKED pending ruling |
| C-pty | PTY family | same face and same CONTRACT_CHANGE_REQUEST as C-subprocess | MECHANISM, positive control UNPROVEN (D); product admission BLOCKED pending ruling |
| C-ptc | PTC escalation | **EXPLICITLY UNAVAILABLE (b)** — `run_code` is the PTC entry and the centre refuses it BEFORE the body with its own code `ADMISSION_PTC_UNAVAILABLE` (`admission.ts:318`), distinct from the generic `ADMISSION_AXIS_UNSUPPORTED` a plain `bash` carries. The row is recorded on `process.exec` with the reason naming BOTH absences (no process lane — the open CCR — and the escalation row's grants minted outside the centre). `ADM-87` proves the fact + settlement REFUSED/not-started + zero body on the real `installMemberCentre` composition, and the distinctness; `ADM-88` pins the closed table. The escalation ASK is unreachable for a governed member because the tool never executes. NOT PROVEN: a refusal driven through `createPtcEscalationRouter` itself (no governed face is registered in this cut) and any host boot | MECHANISM (explicit unavailability); escalation-router refusal UNPROVEN |
| C-remote | Remote | **EXPLICITLY UNAVAILABLE (b)** — a row configured for the centre does not build the S6 command plane at all (`root.ts:4325`, via `refuseHostSurfaceBefore`): the refusal is written as a fact on the existing `team.control` axis and the product settlement closes it REFUSED/not-started. There is no remote-command axis in the compiled contract (the dispatcher is authorized by the server-derived principal, not by a member binding), so admitting it would need a new axis or a second authority. `ADM-86` drives the SAME product helper with a zeroed dispatcher and proves the ungoverned row still builds/dispatches (positive control). NOT PROVEN: a host boot; the disclosed product consequence is that a centre-configured row has no remote API (`root.remoteDispatcher` is absent) | MECHANISM (explicit unavailability); product entry wired, not booted |
| C-mcp | MCP | judged on the NETWORK axis with the SERVER as the locator (`net.mcp`, `ADM-33`): unset is not allow, deny is deny, a tool-level restriction narrows it, and a `mcp__` name with no server is refused as malformed rather than matched by prefix. WHICH servers exist stays the mount gate's decision. **ROUND 57 — A REAL MOUNT NOW REACHES THE CENTRE.** `ADM-96` starts the product's own mini-MCP server (real HTTP, `packages/runtime/root-binding/harness/mini-mcp.mjs`), computes the mount target with the product's `configuredMcpServers` → `filterMcpServers`, mounts it with the EXACT production call (`mcpClient.apply(ctx, <the seven-field streamable-http literal `reconcileMcpSet` passes>)` — the same call `mcpMountCtx.plugin(mcpClient, …)` makes), reads `mcp__p5t5mini__ping` off the resulting model-visible surface, and the ONE centre admits it on `net.mcp`/locator `p5t5mini`, records the fact (read back from disk), settles `ADMITTED → RUNNING → COMPLETED`, and the REAL server body answers `pong:mounted`. `ADM-97` (negatives): the same MOUNTED tool is `NETWORK_DENY` when the compiled TOOL-level answer denies it and `NETWORK_DENY` when the ceiling denies — zero body, `REFUSED` settlement in both (mounting is not permission) — while the other tool of that server still runs; `mcp__` and `mcp__<server>` are `ADMISSION_TOOL_UNBOUND` (no prefix matching); a configured-but-ungranted server is excluded by the mount gate and contributes NO name to the surface. **LIMIT, UNPROVEN at the centre:** the centre is NOT mount-aware — its binding is installed at the member bind (`agent-bindings.mjs:1852`) while `mcpMountTarget` is computed later per boundary (`agent-bindings.mjs:2049`), and `admission.ts:78-120` has no mount input — so a WELL-FORMED name for a never-mounted server is decided on the network axis alone (pinned by `ADM-97` step 5). The product excludes such a call at the TOOL REGISTRY, not at admission | MECHANISM (real mount → real body → ONE centre; NO host boot); centre-side unmounted-server refusal UNPROVEN |
| C-alpha6 | Alpha.6 review routing | **EXPLICITLY UNAVAILABLE (b)** — the opt-in is refused with its own code `ADMISSION_ALPHA6_UNAVAILABLE`, in TWO independent gates that name the same missing axis: the pure config rule (`centre-config.ts:67`, `ADM-34`) and, for a row that builds the root directly on a centre-configured row, a recorded refusal on `host.service` (`root.ts:2500`) followed by a typed boot refusal — no review wake is dispatched. Review routing decides who may review whom before any tool call, so the centre has no lane or locator for it, and the previous "needs a centreStatePath" shape bought a durable store outside the centre, not centre adjudication. `ADM-85` proves the recorded refusal + settlement REFUSED/not-started + zero wakes, with an ungoverned positive control. **ROUND 57 — the refusal is UNCONDITIONAL, and the machinery behind it is measured, not assumed.** `ADM-99` proves the config rule refuses the opt-in on EVERY row, including one with no `centreStatePath` (`centre-config.ts:67`; `host.ts:705` is the only production enforcement point) — so there is NO product-config path on which Alpha.6 is reachable at all, which is stronger than "a centre-configured row is refused". `ADM-98` proves the missing piece is NOT the Alpha.6 machinery: composed directly, `createAlpha6RootWiring` composes `mode:'alpha6'`, the ONE shared `createAlpha6RootRouter` takes a real decision off a durable control row (`route.kind='recipient'`, Officer, `routeRole='officer'`), and the real `dispatchLatch` + `createFileWakeIntentDirectory` persist a row that, re-read from disk through a FRESH directory object, names exactly the routed reviewer. **The missing seam is the CENTRE JOIN:** no axis/family in `admission.ts` (`TOOL_AXES`/`CENTRE_TOOL_NAMES`/`HOST_CAPABILITY_TOOL_NAMES`, `admission.ts:32`, `:57`, `:114`) can name a review-routing decision, so `ADM-99` drives one at the centre and gets `ADMISSION_TOOL_UNBOUND` with the fact recorded on the FALLBACK axis `fs.read` — a fabricated-axis record, not a review verdict. **The two lawful shapes:** (A) add a compiled review-routing axis to the member contract (the v4 ceiling is frozen → contract change) so the ONE centre judges the decision before the wake; or (B) rule that a record-only approval fact on the existing `host.service` axis IS adjudication and wire the PA approval-fact join (still UNPROVEN below). Neither is wiring-only, so the row stays explicit unavailability. NOT PROVEN: a host boot and the PA approval-fact join | MECHANISM (explicit unavailability); Alpha.6 decision machinery PROVEN when composed directly (`ADM-98`), CENTRE join UNPROVEN |
| C-goal | Goal / Todo | preserved as HOST CAPABILITIES (`get_goal`/`create_goal`/`update_goal`/`todo_write`), axis `host.service`, `ADM-32` | MECHANISM |
| C-skill | Team Skill | preserved as a host capability (`skill`, axis `host.service`, `ADM-32`); its file reads go through the host skill service, NOT the member's confined fs | MECHANISM + recorded LIMIT |
| C-fork | Subagent Fork | preserved as host capabilities (`subagent`, `send_message`, `interrupt_agent`, axis `host.service`, `ADM-32`); the CHILD's own binding governs the child's tools | MECHANISM |
| C-policy | observation policy two-state | SLICE-10/11 pin OFF (default) and ON on the pinned host | MECHANISM |

## MEASURED (round 56): C-tools / C-member / C-work driven END TO END over the product tool surface

The three rows above stopped being "unverified end to end" this round. `ADM-89`…`ADM-95` live in
`packages/runtime/test/vnext-admission.test.mjs` (node:test, the `ute-vnext-a1` leg: 157 pass + 2
disclosed skips; vitest population unchanged at 238).

**What is REAL in the assembly** (`cStage` in that file):

- the tool surface is `createTeamTools` — the factory `root.ts` fills `teamToolsRef` with — over the
  REAL `createTeamRuntime`, the REAL durable `TeamDomain` (+ real repositories), the REAL
  `ControlService`, the REAL messaging coordinator and activity ledger. Every create / archive /
  delegate / collect runs the tool's own `execute` body; nothing re-implements a tool.
- the centre is the ONE composition point: `installMemberCentre` for the Leader, `installMemberExecution`
  for every member (binding from `bindingFromCompiledMember`, the durable fact ledger, the per-member
  settlement store, crash recovery, the native-mount lifecycle). No admission point is installed by
  hand and no lane is rebuilt.
- archive runs the PRODUCTION step-port row: `archiveMember` quiesces (close admission → interrupt →
  drain → quiescence) and then commits `settle-then-archive` through the real repository CAS; the
  `release-residency` step disposes the member handle, which is where the centre's lifecycle CLOSE runs
  (the same path `agent-bindings.mjs` wires via `onDispose` and the lifecycle via `live.residency`).
- every fact and settlement assertion is a READ-BACK FROM DISK through a FRESH ledger / store.

**What is a HOST STAND-IN (named, deciding nothing):** the agent-context double (which runs the host's
pre-execute → guard → body → `tools/result` order), the member's "live agent handle" (its `dispose()`
running the disposers `installMemberExecution` registered), the child-session factory (the member-bind
moment where a created member's centre is installed), and the work-delivery port (the host's
session-input seam). The compiled member answer is an INPUT (a ceiling), not a decision.

**NOT proven (honest limits):** no host boot, so no row is PRODUCT-PROVEN. The archived member's
PRODUCT ROUTE refuses at the durable lifecycle gate (`LIFECYCLE_ADMISSION_CLOSED` /
`memberResumeRefusal`) before the centre is reached — what `ADM-93` proves is the centre's own
tombstone on the member's layer (`ADMISSION_MEMBER_CLOSED`), which is the guarantee the row names. The
glue's own hop (that `agent-bindings` installs the member centre at every bind and that the residency
drop reaches the same disposer list) is pinned by source and by the existing composition arms, not
booted here. Policy COMPILATION is not exercised: the ceiling is an input.

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
D-report limit, not a claim of confinement. MCP is treated differently: it is a
declared network capability, so it is judged on the member's network axis with the server as the
locator (C-mcp), never silently admitted on its name.

## MEASURED (round 57): C-mcp's MOUNT path and C-alpha6's reachable path

`ADM-96`…`ADM-99` live in `packages/runtime/test/vnext-admission.test.mjs` (`ute-vnext-a1` leg:
161 pass + 2 disclosed skips; vitest population unchanged at 238).

**C-mcp — what is REAL.** The server is the product's own `mini-mcp.mjs` endpoint over real HTTP.
WHICH server exists is the product's `configuredMcpServers` → `filterMcpServers` (the mount gate).
The mount is the exact production call `mcpClient.apply(ctx, config)` with the byte-same
seven-field streamable-http literal `reconcileMcpSet` passes (`transport`, `serverName`, `url`,
`headers`, `toolCallTimeoutMs`, `failOnStartupError`, `reconnect`); `apply` is what the Cordis
`plugin(mcpClient, config)` call invokes. The judged name is read off the resulting model-visible
surface, and the body behind it is the real MCP round-trip — `pong:mounted` is the server's answer,
not a stub. The centre is `installMemberCentre` on the SAME ctx, with the binding projected by
`bindingFromCompiledMember` from a compiled answer. Facts and settlements are read back from disk
through fresh objects.

**C-mcp — the named stand-in.** The Cordis ctx double (the surface U6 pins for this plugin), which
decides nothing, and the host dispatch order (pre-execute → guard → body → `tools/result`).

**C-alpha6 — what is REAL.** `createAlpha6RootWiring` (the product's ONE opt-in assembly),
`createAlpha6RootRouter` (the ONE shared router, over the real closed-kind classifier the way
`root.ts:3125` wires it), `dispatchLatch` + `createFileWakeIntentDirectory` (the product's own
dispatcher and durable intent directory). The control row and member rows are INPUTS (values), not
decisions; the routing policy decides from them.

**C-alpha6 — the missing seam (file:line).** `admission.ts:32` (`TOOL_AXES`), `:57` (`CENTRE_TOOL_NAMES`), `:114`
(`HOST_CAPABILITY_TOOL_NAMES`): the centre's closed
vocabulary has no review-routing axis, so a review-routing subject is refused as
`ADMISSION_TOOL_UNBOUND` and RECORDED on the fallback axis `fs.read` (`invocationFactsOf`,
`admission.ts:394-405`). `centre-config.ts:67` refuses the opt-in on every row; `root.ts:2498-2512`
is the second gate for a directly-built centre-configured root. **Two lawful shapes:** (A) a compiled
review-routing axis added to the member contract (v4 ceiling frozen → contract change), judged by the
ONE centre before the wake; (B) a ruling that a record-only approval fact on `host.service` IS
adjudication, then wiring the PA approval-fact join. Neither is wiring-only; inventing review-routing
policy is out of bounds for this cut.

**NOT proven (round 57).** No host boot, so no row is PRODUCT-PROVEN. The centre is not mount-aware,
so a well-formed name for a never-mounted server is not refused BY THE CENTRE (the mount gate + the
tool registry are what exclude it) — stated above as a LIMIT and pinned by `ADM-97`. Policy
COMPILATION is not exercised (the compiled answer is an input).

## BLOCKING PRODUCT LIMIT (round 59, refined round 60): a centre row cannot create a team at runtime

`ESCALATION-centre-row-creation-entrance.md`. The centre row BOOTS (43 model-visible tools, remote mount
`SKIPPED` with the C-remote reason) but `POST /team-remote/team.create` is **405**: C-remote refuses to build
the plane, and that plane is the product's only runtime creation entrance. Governance and runtime creation are
mutually exclusive today. Nothing in this table may be read as "both work".

**Round 60 measures the escalation's path 3 (DEV-LIVE, not PRODUCT-PROVEN).** The driver binds the v4
blueprint at boot instead of calling the remote creation route, and the boot-created Team
(`root.ts:4888-4925`) does reach a governed Member on a real host: two agreeing boots, gate
`ADMISSION_OPEN`, a worker Member turn, and a durable centre ledger with 2 `fs.read` admission facts
(`allow` + `LANE_DENY`) and 2 execution facts. **What that does NOT buy, and this table does not claim:**

- runtime creation on a centre row is unchanged (still 405 — the measured Team is boot-created);
- the admitted native `read` was **not** served by the Member's controlled Provider: zero
  `a5sf-guard-consult/1` facts (the preset's `tool-fs` row resolves the base `fs`; only
  `a5sfNativeToolModules` re-mounts it into the member scope, and this row declares none);
- the out-of-lane refusal is the centre's typed **`LANE_DENY`**, not the realm provider's
  `IO_READ_DENIED`;
- one judge clause (`d:native-read-surface` `native-description`) reads the top-level `description` while
  the native marker is in the `file_path` parameter description — an instrument defect, reported unfixed.

So `C-fs` / `C-member` stay MECHANISM: the centre adjudicates the call, the provider path is not proven.
Full evidence, judge-by-judge: `D-BOOT-FEASIBILITY.md` §12.

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

