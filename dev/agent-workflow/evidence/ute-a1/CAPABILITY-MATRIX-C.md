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
| C-member | Member lifecycle (create → archive) | tools preserved in the new assembly; `installMemberCentre` runs at the member bind, and a governed bind without `centreStatePath` is REFUSED. **ROUND 56:** `ADM-92` creates a member through `team_create_member` (real `member-activated` effect, durable row, Leader authority fact `team.control`/allow/`COMPLETED`); the member's OWN centre is installed through `installMemberExecution` at the child-session factory, and its calls are judged there (member ledger, member's `policyGeneration`) with the Leader's centre allowing the same locator the member's narrower lane denies. `ADM-93` archives through `team_archive_member` (production step ports: quiesce → settle-then-archive commits → `release-residency` disposes the member handle, which runs the centre's close): the member's pre-close fact survives, the durable row is `ARCHIVED`, and the next call is `ADMISSION_MEMBER_CLOSED` with a `REFUSED`/`not-started` settlement (transitions `ADMITTED → REFUSED`), never `UNKNOWN`; a second archive commits nothing, and the Leader's centre is unaffected  **ROUND 62 (D2 live driver, two boots, `D-BOOT-FEASIBILITY.md` §14):** a Member turn was STOPPED through the product's own public `session/cancel` RPC on the child session while it was parked at a durable `admission-ask` Control request; the centre's own `ADMISSION_STOPPED` is in the tool result and the `invocation-authority` fact, with a `REFUSED`/`not-started` settlement (no execution fact), never a completion and never `UNKNOWN`; a second Member's settlement stayed `COMPLETED` with zero stops. | MECHANISM (end-to-end in-process) + Stop DEV-LIVE (round 62; the archived member's PRODUCT ROUTE refuses earlier at the durable lifecycle gate — see "not proven") |
| C-work | work delivery (delegate → collect) | same as above: the tools are the centre's own surface, no fs/net lane applies. **ROUND 56:** `ADM-94` delegates through `team_delegate` (one synchronous unit, prompt delivered verbatim through the host work-delivery seam, `work-admitted` with `settled: true` and the member result) and collects it through `team_collect` (terminal `succeeded` entry with the same result, durable `settledSequence`); the collected work's own member calls are judged by THAT member's centre — its ledger, its generation, its lane (member `LANE_DENY` where the Leader allows) — and never appear in the Leader's ledger. `ADM-95` (negative) shows a refused delegation (`ADMISSION_NO_BINDING`) delivers nothing, admits no work unit and commits no lifecycle transition, and that the following collect is a zero-write read returning `unavailable` for that token. **ROUND 63 (D3 live driver, two boots, §15 / `d3/README.md`):** PROVEN on a real host boot — `team_delegate` admitted (`effect.kind=member-activated`, real instance/child session), the prompt delivered VERBATIM as the Member's first user message, the Member's final text and the collected `memberResult.body` both exactly `DBOOT_D3_DELIVERED_UNIT_ALPHA`, the collect entry terminal (`succeeded`, admitted 2 / settled 5) and BYTE-IDENTICAL when collected again AFTER a SIGKILL cold restart, the unit on disk in the team domain store, and every admission fact for the Member's calls in ITS ledger (no member call fact in any other centre ledger). | MECHANISM (in-process) + provider boundary DEV-LIVE (round 63) |
| C-fs | FS family (`read`/`write`/`edit`/`read_image`/`grep`/`glob`) | SLICE-1..30 on the pinned host: native definitions remounted per member, real read/write, lane refusals, observation policy both states, search family under ASK and Stop. **ROUND 61:** a governed Member now mounts its preset's own host modules into its realm BY DEFAULT (`mountGovernedNativeToolModules`), and the live driver's admitted native `read` produced 2 provider guard `allow` facts naming the member (`D-BOOT-FEASIBILITY.md` §13, `ADM-100`…`ADM-102`)  **ROUND 62 (D2 live driver, two boots, `D-BOOT-FEASIBILITY.md` §14, `d2/README.md`):** two governed Members ran with overlapping turns, each native `read` admitted in its OWN compiled lane, guard facts naming its own identity, separate centre ledgers; A's cross-member read refused `LANE_DENY` with zero B bytes and no Provider entry. The same driver also measured the durable overlay as restriction-only: grant-deny refuses, revoke re-admits (the REQUIRED revoke-narrows direction is REFUTED). **ROUND 63 (D3 live driver, two boots, §15):** the search face was NOT governable by the durable overlay — an in-lane `grep` whose LANE allowed it was denied: `laneDecision=allow`, `refusalCode=ADMISSION_OVERLAY_FAULT`, reason `canonicalization failed for tool "grep": tool-unsupported`. The closed permission vocabulary is `read/read_image/write/edit` + `bash/pwsh` (`operation-permission/types.ts:59-64`, `:90-93`; `canonical-operation.ts:260-267`), so `grep`/`glob` cannot be canonicalized. **ROUND 64 (shape B, §16):** the overlay now has NO OPINION on a face outside its vocabulary (`overlayOutcome=no-opinion`) and the compiled LANE alone judges it. Re-measured live, two agreeing boots: the in-lane `grep` is ADMITTED and RUNS (`decision=allow`, `overlayOutcome=no-opinion`, a real match at `team-b/corpus/huge-7.txt`, execution fact `completed`), while an out-of-lane `grep` is `LANE_DENY`. The search face is therefore LANE-GOVERNED ONLY: a durable overlay rule cannot restrict it. | MECHANISM (in-process, pinned host) + provider boundary DEV-LIVE (rounds 61–64); search face ADMITTED lane-only live (round 64) |
| C-web | Web family (`web_fetch`) | SLICE-31/32: positive through the confined web face, negative with the transport never called | MECHANISM (in-process, pinned host) |
| C-subprocess | Subprocess family (`bash`) | `process.exec` judged on the working directory; the PTY face mounts and refuses an unregistered owner (`OWNER_NOT_LIVE`); positive control needs a live host agent. BLOCKED on a CONTRACT_CHANGE_REQUEST: there is no declaration source for a process lane. **ROUND 63 (D3 live driver, two boots, §15 / `d3/README.md`):** a governed Member called `bash` in TWO turns of ONE session on a REAL host boot; BOTH were refused at the ONE admission point with `ADMISSION_AXIS_UNSUPPORTED` on `process.exec` (durable fact `decision=deny`, settlement `ADMITTED→REFUSED`), the probe's state file was never written, and the shipped governed preset mounts only the ONE-SHOT `tool-bash` (never `dsh-tool-bash-persistent`; `--plan`: `present=true mounted=false`). The closed v4 ceiling was measured live too: `$.memberIoCeilings[0].io.process` → `unknown-field` "field 'process' is outside the closed io shape (read \| write \| network)" (`blueprint-v4.ts:187-197`). | MECHANISM, positive control UNPROVEN (D); live product admission MEASURED as the typed refusal (round 63, DEV-LIVE); BLOCKED pending ruling |
| C-pty | PTY family | same face and same CONTRACT_CHANGE_REQUEST as C-subprocess | MECHANISM, positive control UNPROVEN (D); product admission BLOCKED pending ruling |
| C-ptc | PTC escalation | **EXPLICITLY UNAVAILABLE (b)** — `run_code` is the PTC entry and the centre refuses it BEFORE the body with its own code `ADMISSION_PTC_UNAVAILABLE` (`admission.ts:326`), distinct from the generic `ADMISSION_AXIS_UNSUPPORTED` a plain `bash` carries. The row is recorded on `process.exec` with the reason naming BOTH absences (no process lane — the open CCR — and the escalation row's grants minted outside the centre). `ADM-87` proves the fact + settlement REFUSED/not-started + zero body on the real `installMemberCentre` composition, and the distinctness; `ADM-88` pins the closed table. The escalation ASK is unreachable for a governed member because the tool never executes. NOT PROVEN: a refusal driven through `createPtcEscalationRouter` itself (no governed face is registered in this cut) and any host boot | MECHANISM (explicit unavailability); escalation-router refusal UNPROVEN |
| C-remote | Remote | **EXPLICITLY UNAVAILABLE (b)** — a row configured for the centre does not build the S6 command plane at all (`root.ts:4325`, via `refuseHostSurfaceBefore`): the refusal is written as a fact on the existing `team.control` axis and the product settlement closes it REFUSED/not-started. There is no remote-command axis in the compiled contract (the dispatcher is authorized by the server-derived principal, not by a member binding), so admitting it would need a new axis or a second authority. `ADM-86` drives the SAME product helper with a zeroed dispatcher and proves the ungoverned row still builds/dispatches (positive control). NOT PROVEN: a host boot; the disclosed product consequence is that a centre-configured row has no remote API (`root.remoteDispatcher` is absent) | MECHANISM (explicit unavailability); product entry wired, not booted |
| C-mcp | MCP | judged on the NETWORK axis with the SERVER as the locator (`net.mcp`, `ADM-33`): unset is not allow, deny is deny, a tool-level restriction narrows it, and a `mcp__` name with no server is refused as malformed rather than matched by prefix. WHICH servers exist stays the mount gate's decision. **ROUND 57 — A REAL MOUNT NOW REACHES THE CENTRE.** `ADM-96` starts the product's own mini-MCP server (real HTTP, `packages/runtime/root-binding/harness/mini-mcp.mjs`), computes the mount target with the product's `configuredMcpServers` → `filterMcpServers`, mounts it with the EXACT production call (`mcpClient.apply(ctx, <the seven-field streamable-http literal `reconcileMcpSet` passes>)` — the same call `mcpMountCtx.plugin(mcpClient, …)` makes), reads `mcp__p5t5mini__ping` off the resulting model-visible surface, and the ONE centre admits it on `net.mcp`/locator `p5t5mini`, records the fact (read back from disk), settles `ADMITTED → RUNNING → COMPLETED`, and the REAL server body answers `pong:mounted`. `ADM-97` (negatives): the same MOUNTED tool is `NETWORK_DENY` when the compiled TOOL-level answer denies it and `NETWORK_DENY` when the ceiling denies — zero body, `REFUSED` settlement in both (mounting is not permission) — while the other tool of that server still runs; `mcp__` and `mcp__<server>` are `ADMISSION_TOOL_UNBOUND` (no prefix matching); a configured-but-ungranted server is excluded by the mount gate and contributes NO name to the surface. **LIMIT, UNPROVEN at the centre:** the centre is NOT mount-aware — its binding is installed at the member bind (`agent-bindings.mjs:2006`) while `mcpMountTarget` is computed later per boundary (`agent-bindings.mjs:2241`), and `admission.ts:78-120` has no mount input — so a WELL-FORMED name for a never-mounted server is decided on the network axis alone (pinned by `ADM-97` step 5). The product excludes such a call at the TOOL REGISTRY, not at admission | MECHANISM (real mount → real body → ONE centre; NO host boot); centre-side unmounted-server refusal UNPROVEN |
| C-alpha6 | Alpha.6 review routing | **EXPLICITLY UNAVAILABLE (b)** — the opt-in is refused with its own code `ADMISSION_ALPHA6_UNAVAILABLE`, in TWO independent gates that name the same missing axis: the pure config rule (`centre-config.ts:73`, `ADM-34`) and, for a row that builds the root directly on a centre-configured row, a recorded refusal on `host.service` (`root.ts:2496`) followed by a typed boot refusal — no review wake is dispatched. Review routing decides who may review whom before any tool call, so the centre has no lane or locator for it, and the previous "needs a centreStatePath" shape bought a durable store outside the centre, not centre adjudication. `ADM-85` proves the recorded refusal + settlement REFUSED/not-started + zero wakes, with an ungoverned positive control. **ROUND 57 — the refusal is UNCONDITIONAL, and the machinery behind it is measured, not assumed.** `ADM-99` proves the config rule refuses the opt-in on EVERY row, including one with no `centreStatePath` (`centre-config.ts:73`; `host.ts:738` is the only production enforcement point) — so there is NO product-config path on which Alpha.6 is reachable at all, which is stronger than "a centre-configured row is refused". `ADM-98` proves the missing piece is NOT the Alpha.6 machinery: composed directly, `createAlpha6RootWiring` composes `mode:'alpha6'`, the ONE shared `createAlpha6RootRouter` takes a real decision off a durable control row (`route.kind='recipient'`, Officer, `routeRole='officer'`), and the real `dispatchLatch` + `createFileWakeIntentDirectory` persist a row that, re-read from disk through a FRESH directory object, names exactly the routed reviewer. **The missing seam is the CENTRE JOIN:** no axis/family in `admission.ts` (`TOOL_AXES`/`CENTRE_TOOL_NAMES`/`HOST_CAPABILITY_TOOL_NAMES`, `admission.ts:32`, `:57`, `:114`) can name a review-routing decision, so `ADM-99` drives one at the centre and gets `ADMISSION_TOOL_UNBOUND` with the fact recorded on the FALLBACK axis `fs.read` — a fabricated-axis record, not a review verdict. **The two lawful shapes:** (A) add a compiled review-routing axis to the member contract (the v4 ceiling is frozen → contract change) so the ONE centre judges the decision before the wake; or (B) rule that a record-only approval fact on the existing `host.service` axis IS adjudication and wire the PA approval-fact join (still UNPROVEN below). Neither is wiring-only, so the row stays explicit unavailability. NOT PROVEN: the PA approval-fact join. **ROUND 63 (D3 live driver, two boots, §15 / `d3/README.md`):** the typed refusal was measured on a REAL host boot with `alpha6ReviewRouting: true` — the host PROCESS boots and the ROW is refused inside plugin bootstrap (`ADMISSION_ALPHA6_UNAVAILABLE … no review-routing axis exists`, `centre-config.ts:73` at `host.ts:738`), with NOTHING live (no team root: `/__p6t6/state` 404, `liveMembers=0`, no decision, no wake-intent file, no fact file). The RECORDED-FACT writer (`createHostSurfaceRefusalPoint`) was unreachable at that entry because the gate ran before root construction — an honest limit of the host path, not a driver choice. **ROUND 68 (shape A, D3 live driver re-run, two boots) — the recorded-fact half is now REACHED at the same entry, and the refusal is unchanged.** `host.ts` passes `createAlpha6RowRefusalHook` (`vnext/row-refusal-entry.ts`) to `validateTeamPluginConfig`; the hook runs at the exact centre rule, BEFORE the unchanged typed throw, builds the product's own `createHostSurfaceRefusalPoint` (`host-surface-refusal.mjs`) through the shared constructor `createCentreHostSurfacePoint` (the same one `root.ts` uses), and writes the invocation-authority fact (`decision=deny`, `refusalCode=ADMISSION_ALPHA6_UNAVAILABLE`, axis `host.service`, `toolName=alpha6.review-routing`) plus the settlement (`REFUSED`, `dispatch`/`bodyOutcome` `not-started`, transitions `ADMITTED→REFUSED`). Measured live in BOTH boots: `refusalFactCount=1`, `refusalSettlement.state=REFUSED`, while the row is still refused with the same code and the host still boots with NOTHING live (`/__p6t6/state` 404, `liveMembers=0`, no decision, no wake-intent file). `no-silent-route` stays PROVEN: the probe now evaluates it as "no ROUTE-claiming fact" (`nonRefusalFactCount=0`), so a recorded refusal cannot be laundered into a silent route. New arms: `ADM-116` (refused AND recorded, fact + settlement read back from disk), `ADM-117` (positive control: a row without the opt-in validates/binds and writes nothing), `ADM-118` (covered-face fault elsewhere untouched: the shared point still records `remote`; a non-Alpha.6 centre violation writes nothing). NOT PROVEN: a row with the opt-in but NO `centreStatePath` is still refused but unwritten (no durable directory exists); the PA approval-fact join stays unproven; no boot reaches the routed path. | MECHANISM (explicit unavailability) + live host refusal shape DEV-LIVE (round 63) + live RECORDED refusal DEV-LIVE (round 68); Alpha.6 decision machinery PROVEN when composed directly (`ADM-98`), CENTRE join UNPROVEN |
| C-goal | Goal / Todo | preserved as HOST CAPABILITIES (`get_goal`/`create_goal`/`update_goal`/`todo_write`), axis `host.service`, `ADM-32` | MECHANISM |
| C-skill | Team Skill | preserved as a host capability (`skill`, axis `host.service`, `ADM-32`); its file reads go through the host skill service, NOT the member's confined fs | MECHANISM + recorded LIMIT |
| C-fork | Subagent Fork | preserved as host capabilities (`subagent`, `send_message`, `interrupt_agent`, axis `host.service`, `ADM-32`); the CHILD's own binding governs the child's tools | MECHANISM |
| C-policy | observation policy two-state | SLICE-10/11 pin OFF (default) and ON on the pinned host | MECHANISM |

## MEASURED (round 56): C-tools / C-member / C-work driven END TO END over the product tool surface

The three rows above stopped being "unverified end to end" this round. `ADM-89`…`ADM-95` live in
`packages/runtime/test/vnext-admission.test.mjs` (node:test, the `ute-vnext-a1` leg at that round: 157 pass + 2
disclosed skips; 180 pass today; vitest population unchanged at 238).

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
161 pass + 2 disclosed skips at that round (180 today); vitest population unchanged at 238).

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
`admission.ts:394-405`). `centre-config.ts:73` refuses the opt-in on every row; `root.ts:2496-2510`
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
  the native marker is in the `file_path` parameter description — an instrument defect, **reported at
  round 60 and repaired in round 62** (the judge is now PROVEN, all six clauses).

So `C-fs` / `C-member` stay MECHANISM: the centre adjudicates the call, the provider path is not proven.
Full evidence, judge-by-judge: `D-BOOT-FEASIBILITY.md` §12.

**Round 61 updates exactly one of those bullets.** The admitted native `read` IS now served by the Member's
controlled provider: the same unmodified driver, two agreeing boots, `d:guard-facts` PROVEN with 2 allow
facts (`stat`, `readText`, `memberIdentity=inst-0pe2z220bhfb`). The fix is shape A — the preset's own host
modules are mounted into the member's isolated scope by default, with each row's own config, no shadow
definition, and typed fail-closed refusals (`FINDING-native-tool-provider.md`). **Still not upgraded to
PRODUCT-PROVEN** (a `DEV-LIVE` boot is not a gate), and (at round 61) two clauses were REFUTED: the
out-of-lane call is refused by the centre's `LANE_DENY` before the provider is entered (so `IO_READ_DENIED`
is unreachable on that path) and `d:native-read-surface`'s `native-description` clause read the wrong field.
**Round 62 repaired the instrument**: the surface judge is PROVEN with all six clauses, so only
`d:member-read-denied` remains REFUTED, by design. Details: `D-BOOT-FEASIBILITY.md` §13-§14.

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

## OPEN: admission is installed only when a realm is mounted (round 33; corrected round 67)

The centre is installed inside `if (a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined)`
(`agent-bindings.mjs:1942-1948`). **CORRECTED (round 67):** the original text of this section said a member
without a confined-provider realm "gets NO admission point at all — its native tools run under the host's
mediation". That is true only for a row that **never asked** for the centre. A row that set
`centreStatePath` and got no realm is **refused** by `memberCentreUnwiredViolation`
(`centre-config.ts:36-49`, called at `agent-bindings.mjs:1942-1944`, `ADM-44`), so it has no unmediated
call to make. Round 49 rebuilt E3's world to mount a declared realm, so E3 no longer observes zero legs.
The remaining item is the ungoverned (never-asked) row — unchanged by configuration, not covered by the
centre, and the reason C14b is not claimed for it (D report §2.3). The design question (admit a
realm-less member against the same compiled ceiling with an explicitly unconfined provider, or refuse)
is tracked by `ESCALATION-realmless-admission.md`, whose "What the code says" snippet predates the
round-35 refusal.

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
questions rather than widenings: the third grant-id scheme (at round 28 there was no approval binder wired in the
product at all, so asks were refusals; round 51 wired the binder and the durable approval port for rows
with a `controlServiceRef`, `agent-bindings.mjs:688-706`), `agentId: sessionId` (two identities in one field), and the
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
| Alpha.6 review routing | `ADMISSION_ALPHA6_UNAVAILABLE` | `host.service` | `centre-config.ts:73` (config) + `root.ts:2496` (recorded + typed boot refusal) | `ADM-85`, `ADM-34` |
| PTC escalation | `ADMISSION_PTC_UNAVAILABLE` | `process.exec` | `admission.ts:326` (the ONE centre, before the body) | `ADM-87`, `ADM-88` |

The closed table is `host-surface-refusal.mjs`; an unknown capability throws rather than being
"refused generically". What this does NOT buy: a host boot (D), a router-side PTC refusal (no governed
face is registered), nor any claim that a governed row should keep its remote API — that trade-off is
disclosed in the C-remote row, not hidden.


## MEASURED (round 63): the D3 live driver's four judges

`tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs --boots 2` — two identical boots
(`agreeing=true`), record class `DEV-LIVE`. Full detail: `dev/agent-workflow/evidence/ute-a1/
D-BOOT-FEASIBILITY.md` §15 and `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md`.

| judge | verdict | the hard fact |
| --- | --- | --- |
| `d3:persistent-subprocess` | **REFUTED** | two `bash` turns, both `ADMISSION_AXIS_UNSUPPORTED` on `process.exec`, settlements `ADMITTED→REFUSED`, no shell state; only the one-shot `tool-bash` mounted |
| `d3:crash-cold-recovery` | **PROVEN** | real SIGKILL (`signal=SIGKILL`, pid gone), restart on the SAME home; in-flight `RUNNING`→`UNKNOWN` with no execution fact and one admission fact (never replayed); completed call's fact/settlement byte-identical; new call admitted with a NEW fact and `COMPLETED` |
| `d3:work-delivery` | **PROVEN** | delegate admitted → unit verbatim → terminal collect, identical after the cold restart, member calls in the member's ledger only |
| `d3:alpha6` | **PROVEN** | typed row refusal `ADMISSION_ALPHA6_UNAVAILABLE` on a booted host; no team root, no decision, no wake intent, no fact file (**round 68 re-run: the fact and settlement are now written at the host entry — `refusalFactCount=1`, `REFUSED`/`not-started`; the verdict is unchanged**) |

OVERALL stays FAIL because a REFUTED judge is a FAIL case by the runner's rule; `evidence-complete=true,
allProven=false`. NOT PROVEN here: any non-DEV-LIVE status, a persistent session, a process-lane
declaration, the Alpha.6 ROUTED path at a host entry (its recorded refusal is measured, round 68), a real-model interleaving.

## MEASURED (round 64): shape B — the overlay abstains on the search face; the lane admits an in-lane `grep`

CCR: `CONTRACT-CHANGE-REQUEST-search-face.md` (shape B implemented, no contract change). Round 63 measured an
in-lane `grep` refused by the durable overlay (`ADMISSION_OVERLAY_FAULT`, `tool-unsupported`) although the
compiled lane allowed it. Shape B states the rule where the overlay answer is produced: the overlay governs
only the faces its closed vocabulary can express; for anything else it has NO OPINION (it neither denies nor
faults), and the compiled LANE alone judges the call. A canonicalization fault on a COVERED face still denies.

| where | change |
| --- | --- |
| `packages/runtime/src/plugin/vnext/overlay-decision.mjs` | vocabulary-membership check BEFORE canonicalization (`isPermissionToolName`); out-of-vocabulary ⇒ stored `noOpinion`, `decide()` returns `'no-opinion'`; covered tools canonicalize/fault exactly as before |
| `packages/runtime/src/plugin/vnext/admission-port.mjs` | `'no-opinion'` is an abstention (lane verdict stands); the fact records `overlayOutcome: 'deny' \| 'no-opinion' \| 'fault'`; lane-denied calls never consult the overlay and carry no outcome |
| `packages/runtime/src/plugin/vnext/admission.ts` | `InvocationAuthorityFacts.overlayOutcome` declared and projected |
| `packages/runtime/test/vnext-admission.test.mjs` | `ADM-103`…`ADM-106` (real centre + real supplier; only the overlay PORT is a declared-input double) |

The four arms: (a) covered tool + matching stored deny ⇒ `ADMISSION_OVERLAY_DENY`, `overlayOutcome=deny`
(positive control unchanged); (b) covered tool whose fs seam cannot canonicalize ⇒ `ADMISSION_OVERLAY_FAULT`,
`overlayOutcome=fault` (faults are not silenced); (c) in-lane `grep` ⇒ admitted, `overlayOutcome=no-opinion`,
fs seam never consulted; (d) out-of-lane `grep` ⇒ `LANE_DENY`, no `overlayOutcome`, never an overlay fault.

**Live re-measure** (`run-boot-d3.mjs --boots 2`, DEV-LIVE, two agreeing boots, `D-BOOT-FEASIBILITY.md`
§16): the D3 B Member's in-lane `grep` is now admitted and completes (`decision=allow`,
`overlayOutcome=no-opinion`, execution fact `outcome=completed`, tool result `Found 1 match …
team-b/corpus/huge-7.txt`), the fact is byte-identical before/after the cold restart, and the other three
judges are unchanged (`crash` / `work` / `alpha6` PROVEN, persistent subprocess still REFUTED). The node leg
was 168 pass + 2 disclosed skips at that round (180 today); the vitest population stays 238.

**Residual, not hidden:** the search face is governed by the LANE only. A durable overlay rule cannot deny
`grep`/`glob` (or `web_fetch`, …), because those faces are outside the overlay's vocabulary; the lane ceiling
is their entire governance. The centre also judges the search ROOT the call names, not every file the scan
opens. Shape A (adding a search face to the closed vocabulary with a subtree resource) remains the durable
answer and is still open.

## MEASURED (round 66): C11 — the Team-owned state projection (`projection/**`)

`06-CAPABILITY-CONTRACT.md:44` freezes C11 as capability "state projections (`sessionProjections`)",
where it lives "`projection/**` + `todo`/`goal` faces", disposition **preserve**. The row names two
owners and they are not the same thing, so they are measured separately.

| C row | capability | where the centre stands | status |
| --- | --- | --- | --- |
| C-projection | the Team's whole-projection read (`projection/**`) — the piece the cut could have un-wired | **PRESERVED in the new assembly.** All three arms live in `packages/runtime/test/vnext-admission.test.mjs` and ride the `ute-vnext-a1` leg. Each builds the projection the way the entry does — `createTeamDomainReadPort(domain, readPortDeps)` → `createProjectionService(…, <live overlay>, { clock, schemaVersion: 2 })`, the wiring at `root.ts:4275-4279` — over the REAL durable `TeamDomain`, the REAL catalog-backed template resolver, the REAL committed-policy-state resolver and the REAL live-residency overlay (`s6-live-overlay.ts`). **`ADM-107` (positive):** the identity core, every member row (instanceId / templateId / label / lifecycle / childSessionId / createdAt, including the leader's production shape and invariant-14 omission) and the ledger summary are asserted field-by-field against the durable rows; a real `team_create_member` through the product tool surface is what the **next** reader sees (a FRESH port + service), and every durable value (member, ledger counts, generation) survives a **cold domain reopen** through `restartP6T1World`. **`ADM-108` (negative):** a mutation REFUSED at the ONE centre (`ADMISSION_NO_BINDING`, `LANE_DENY`) leaves the projection **byte-identical** and the durable store untouched (no member row, no ledger entry, no generation move), with a same-world positive control that the same tool DOES move both. **`ADM-109` (negative):** the live overlay is not a second authority (a live handle with no durable row invents no member; dropping a real handle moves only `liveActivity`, never lifecycle / createdAt / generation / ledger), an absent TeamSession **fails closed** (`TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT`, never an invented empty team), and a projection pass **writes nothing** (`seam.writeCount` unchanged). **Falsifiability, measured:** setting the stamp to v1 reds `ADM-107`; returning zero template rows reds all three. NOT PROVEN: a projection read at a PRODUCT ENTRY (`team.getProjection` over S6) — a centre-configured row has no remote plane by design (C9) | MECHANISM (real TeamDomain → real read port → real fold; NO host boot) |
| C-sessionProjections | the HOST's native `sessionProjections` service behind the `todo`/`goal` faces | **Preserved by construction, not by this cut.** Neither the retired entry (`packages/runtime/src/plugin/live/agent-bindings.mjs` and `root.ts` at `1617d5839^`) nor the new one (`plugin/vnext/root.ts`, `plugin/vnext/agent-bindings.mjs`) references `sessionProjections` at all (`grep -c sessionProjections` → 0 in all four), so the entry replacement cannot have un-wired it, and the `todo`/`goal` faces stay bound on `host.service` (`ADM-32`). The Team-side uses are pass-through READS of the HOST's service, never a registration of its own: the PTY facade hands `ctx.get('sessionProjections')` to the pinned backend (`team-services/src/terminal-pty.ts:400`), and the P5-T5 real-instance harness restores the durable model selection with `stateOf(session, 'modelSelection')` (`root-binding/harness/plugin.mjs:969-982`). NOT PROVEN: reading `stateOf` for a Member's todo/goal state — that requires a real host boot and remains a D item | PRESERVED BY CONSTRUCTION; live read UNPROVEN |

**What round 66 does NOT establish.** No row is PRODUCT-PROVEN. The `sessionProjections.stateOf` read is a
host-boot measurement, not an in-process one; `todo`/`goal` state for a Member was not observed. The
projection arms use the product functions over the product's durable domain with the fixture seeded to the
production leader shape (`leaderChildSessionIsRoot`) — the fixture adjustment is disclosed in the arm
(`vnext-admission.test.mjs`, `cStage`), because the P6-T2 seed's synthetic leader child id is a shape
production never writes and the frozen DTO contract rightly rejects it.

## MEASURED (round 67): C14b — the safety invariants the C14 drop must not take

C14 drops eight governed-family bodies and the retired pre-execution/dispatch components
(`06-CAPABILITY-CONTRACT.md:40`, `:54-63`); C14b preserves the invariants those bodies enforced. The
drop→owner enumeration is `D-ACCEPTANCE-REPORT.md` §2.3. Matrix-side summary:

| C row | invariant (C14b) | owner now (file:line) | arm (positive + negative) |
| --- | --- | --- | --- |
| C-fs | path READ/WRITE upper bounds, authored AND resolved | centre `admission.ts:380-389`; provider `team-services/src/fs.ts:134,179` → `member-io-policy/src/provider-capabilities.ts:299-405` | `ADM-110` |
| C-fs (search) | search-root bound; omitted path = workspace root | `admission.ts:35-36`, `:145-149`; overlay abstains (`overlay-decision.mjs:226-228`) | `ADM-110`, `ADM-16`, `ADM-105/106` |
| C-web | network allow/deny; no fs grant stands in | centre `admission.ts:349-357`; provider `team-services/src/web.ts` | `ADM-111` |
| C-subprocess | no unconfined shell; fail-closed when no lane | `admission.ts:329-347` (`ADMISSION_AXIS_UNSUPPORTED`), `:326-328` (PTC); OS profile `team-services/src/subprocess.ts:1372` | `ADM-114`, `OS-1/2/3` |
| C-tools (Control) | one approval authority; current facts; one-shot spend | `admission-port.mjs:94,336-344,477`; `packages/runtime/control/service.ts` | `ADM-112` |
| C-member (Stop) | Stop is REFUSED/not-started, durable, non-replaying | `admission-port.mjs:336-344,477,801-802`; `settlement/execution-settlement.ts` | `ADM-113` |
| C-goal / C-skill / C-fork / dropped names | preserved host faces recorded on `host.service`; a dropped name is never silently admitted | `admission.ts:114-122`; `exit_plan_mode`/`team_skill`/`ask_user_question`/`present` unbound (`:316-319`) | `ADM-115` |

All six arms live in `packages/runtime/test/vnext-admission.test.mjs` and ride the `ute-vnext-a1` leg
(tests 182 / pass 180 / fail 0 / skipped 2 at this HEAD). Each arm first witnesses that the C14 body is gone
(`existsSync` = false), then proves its invariant POSITIVELY (the allowed case runs and settles) and
NEGATIVELY (the violating case is refused with its own code, before the body, with a CLOSED settlement).

**No invariant is left enforced only by a deleted component** — checked against the A0 tree, not assumed:
the five `confined-*` shadows were mounted by the realm row itself (`a5sf-realm-row.mjs` at A0,
`A5SF_CONFINED_FS_TOOL`), so a row with no realm never had them as enforcement either. **NOT PROVEN:**
product-entry (host-boot) enforcement of each invariant, network containment under a real model, and any
PRODUCT-PROVEN status. The ungoverned row stays outside the centre by design (see the corrected OPEN
section above).
