# C — capability matrix (2026-11-21, honest per-row status)

Statuses used, and they are not interchangeable:

- **MECHANISM** — the centre-side guarantee is implemented and has passing in-process arms.
- **PRODUCT-PROVEN** — the above AND a real product assembly exercised it end to end.
- **ENV-LIMITED** — the cell's guarantee is implemented and is PROVEN on a host that offers the
  physical capability, but the measured runner does NOT offer it, so on that runner the cell is
  unproven and the only admissible evidence is the product's fail-closed refusal (round 82; see the
  round-82 section at the end of this file). ENV-LIMITED is never counted as PROVEN.
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
| C-fs | FS family (`read`/`write`/`edit`/`read_image`/`grep`/`glob`) | **ROUND 79:** the A1 slice's pre-dispatch Stop semantics are closed on rc.5 — `SLICE-21`/`SLICE-30`/`SLICE-37` GREEN on both hosts (see the C-member (Stop) row). SLICE-1..30 on the pinned host: native definitions remounted per member, real read/write, lane refusals, observation policy both states, search family under ASK and Stop. **ROUND 61:** a governed Member now mounts its preset's own host modules into its realm BY DEFAULT (`mountGovernedNativeToolModules`), and the live driver's admitted native `read` produced 2 provider guard `allow` facts naming the member (`D-BOOT-FEASIBILITY.md` §13, `ADM-100`…`ADM-102`)  **ROUND 62 (D2 live driver, two boots, `D-BOOT-FEASIBILITY.md` §14, `d2/README.md`):** two governed Members ran with overlapping turns, each native `read` admitted in its OWN compiled lane, guard facts naming its own identity, separate centre ledgers; A's cross-member read refused `LANE_DENY` with zero B bytes and no Provider entry. The same driver also measured the durable overlay as restriction-only: grant-deny refuses, revoke re-admits. **ROUND 71 (judge semantics):** the judge was rewritten to the contract's own four directions — (a) the durable deny refuses the previously admitted call with `ADMISSION_OVERLAY_DENY`, zero body, settlement `REFUSED`, and a fact naming the overlay (`overlayOutcome=deny`, `laneDecision=allow`) plus a `policyGeneration`; (b) removing the deny restores the call (admitted + `COMPLETED`) as a NEW fact in the same call-id family; (c) an untouched in-lane read is admitted at every phase; (d) widening beyond the compiled ceiling is REFUSED — measured, the lane answered `changed:false`/`mutation-proposal-pending` and the widened locator stayed `LANE_DENY` with zero foreign bytes. `d2:revocation` is PROVEN on two agreeing boots; the old clause that demanded the overlay WIDEN was the defect (about the judge, not the product). **ROUND 63 (D3 live driver, two boots, §15):** the search face was NOT governable by the durable overlay — an in-lane `grep` whose LANE allowed it was denied: `laneDecision=allow`, `refusalCode=ADMISSION_OVERLAY_FAULT`, reason `canonicalization failed for tool "grep": tool-unsupported`. The closed permission vocabulary is `read/read_image/write/edit` + `bash/pwsh` (`operation-permission/types.ts:59-64`, `:90-93`; `canonical-operation.ts:260-267`), so `grep`/`glob` cannot be canonicalized. **ROUND 64 (shape B, §16):** the overlay now has NO OPINION on a face outside its vocabulary (`overlayOutcome=no-opinion`) and the compiled LANE alone judges it. Re-measured live, two agreeing boots: the in-lane `grep` is ADMITTED and RUNS (`decision=allow`, `overlayOutcome=no-opinion`, a real match at `team-b/corpus/huge-7.txt`, execution fact `completed`), while an out-of-lane `grep` is `LANE_DENY`. The search face is therefore LANE-GOVERNED ONLY: a durable overlay rule cannot restrict it. | MECHANISM (in-process, pinned host) + provider boundary DEV-LIVE (rounds 61–64); search face ADMITTED lane-only live (round 64); **ROUND 77: the rc.5 FS additions (`patchText`/`deleteFile`/`moveFile`) are confined too — SLICE-35 GREEN on rc.5 AND rc.2, `ADM-135`…`ADM-140`; still MECHANISM, not PRODUCT-PROVEN (no booted `apply_patch`/delete/move). See the round 77 section at the end of this file** |
| C-web | Web family (`web_fetch`) | SLICE-31/32: positive through the confined web face, negative with the transport never called | MECHANISM (in-process, pinned host) |
| C-subprocess | Subprocess family (`bash`) | **ROUND 75 — ADMITTED ON A COMPILED EXECUTION AUTHORIZATION, NOT ON A PATH LANE** (owner ruling `docs/reviews/20261122-1536.txt` §1). The centre's `process.exec` branch reads `toolBindings[].authorization` (allow/ask/deny) + `execution.executionBoundary` from the compiled per-tool answer and the composition's executor-readiness fact (`admission.ts:409-452`); the cwd is recorded as context and never consulted; `Binding.process`/`io.process` do not exist. Fitness check: the v4 grammar ALREADY carried both fields (`blueprint-v4.ts:193-204`) and the projection chain had been dropping them — carriage, not declaration (see `CONTRACT-CHANGE-REQUEST-process-lane.md`, now RESOLVED/superseded). Arms `ADM-125` (allow ⇒ runs + fact + COMPLETED), `ADM-126` (deny ⇒ `ADMISSION_EXECUTION_DENIED`, body never runs), `ADM-127` (ask ⇒ durable Control approval, then the body; a denied approval refuses), `ADM-128` (`ADMISSION_EXECUTOR_UNAVAILABLE` when the declared boundary has no READY executor; `trusted-host` vs `confined-subprocess` are different executors), `ADM-129` (an in-lane `grep` is admitted although the same binding's `bash` is DENIED), `ADM-130` (the OS profile the executor applies is compiled from the three lanes and an ask/dangerous lane is refused rather than widened). SLICE-33 now admits the shell under the compiled authorization and proves the PTY face's OWN fence still refuses an unregistered owner (`OWNER_NOT_LIVE`). **ROUND 76 LIVE (D3, `--boots 2`, DEV-LIVE, two agreeing boots):** `d3:persistent-subprocess` is **PROVEN** — the governed preset mounts the HOST's `dsh-tool-bash-persistent` (`backendType: a5sf-governed-shell`) beside the one-shot baseline, the world declares `toolBindings[]` for `bash` (`authorization: allow`, `executionBoundary: confined-subprocess`), the first call is admitted on `process.exec` and writes durable shell state, and a SECOND turn reuses the SAME shell and reads it back; the out-of-lane write is refused by the OS profile (`Read-only file system`, 0 bytes on disk) while the in-lane file is written. Round 75's REFUTED measurement is kept in **MEASURED (round 75)** as history. | MECHANISM (allow/deny/ask/executor arms in-process) + **DEV-LIVE PROVEN** persistent confined shell (round 76, two agreeing boots); no gated status, no real-model interleaving |
| C-pty | PTY family | same authority as C-subprocess: the governed realm installs the PTY face and declares `availableFaces.process`, so a `confined-subprocess` declaration has a ready executor; the face itself still refuses an unregistered owner (`SLICE-33`). **ROUND 76: the persistent-session positive control is PROVEN live** — two turns share one PTY shell under the OS profile (`d3:persistent-subprocess`, two agreeing boots) | MECHANISM + **DEV-LIVE PROVEN** (round 76, D3) |
| C-ptc | PTC escalation | **EXPLICITLY UNAVAILABLE (b)** — `run_code` is the PTC entry and the centre refuses it BEFORE the body with its own code `ADMISSION_PTC_UNAVAILABLE` (`admission.ts:405-407`), distinct from `ADMISSION_EXECUTION_UNAUTHORIZED` a plain shell carries. **ROUND 85 measured the four parts in order** (`PTC-FOUR-PART-FINDING.md`): (b) nested calls re-enter the registry scheduler on `scopeTarget(exec.agent)` and therefore this centre — **HOLDS**; (c) escalation goes through `approval/request` → ControlService durable ask + one-shot grant — **HOLDS**; (d) Stop follows `exec.signal` → `runController` → runtime signal → `handle.terminate()` and settles `CANCELLED` — **HOLDS**; (a) the WORKER's OS profile is the **HOST session policy**, not the member's compiled read/write lanes, and `danger-full-access` skips confinement — **FAILS** (`core/tools/src/index.ts:948-951`, `sandbox-policy:164-169`, `ptc-runtime-node/src/index.ts:224`). The refusal is narrowed to (a) and recorded as `CORE_SEAM_BLOCKER` (a per-execution policy seam). `ADM-87` proves the fact + settlement REFUSED/not-started + zero body on the real `installMemberCentre` composition, and the distinctness; `ADM-88` pins the closed table. The escalation ASK is unreachable for a governed member because the tool never executes. NOT PROVEN: a live governed `run_code` run (so no live nested/Stop arm), the `rootCallId`/`parentCallId` projection, and any host boot for PTC | MECHANISM (explicit unavailability, narrowed reason); worker-OS-profile seam BLOCKED |
| C-remote | Remote | *(Round 86 audit: an earlier version of this cell opened with "refused on a centre row" and listed `member.create`/`member.send`/`member.followup` as refused — that was the round-55 state, superseded twice; this cell is the current one.)* **RESTORED AS A GOVERNED MANAGEMENT CONTROL PLANE (round 74)**, per owner ruling `docs/reviews/20261122-1536.txt` §3. A centre-configured row BUILDS and INSTALLS the S6 plane again (`root.ts` → `createS6RemoteSurfaces`, `host.ts` mounts the `installed` seam); `POST /team-remote/team.create` mints a Team at runtime through the existing `createAndStartTeam()` + Principal + TeamDomain/Control gates. Commands are classified by ACTUAL EFFECT in ONE closed table (`s6-command-classification.ts`): control-plane read/creation/management commands are served; commands whose effect is agent-tool execution — `team.admitInitialWork`, `team.ensureRootLive`, `member.create`, `member.send`, `member.followup` — are REFUSED before params/ports with the existing `ADMISSION_REMOTE_UNAVAILABLE` on `team.control`, with a durable invocation-authority fact and a `REFUSED`/`not-started` settlement. An unclassified/missing command is NOT default-allowed (`isS6ControlPlaneCommand` false; the table↔catalog equality is pinned both ways). `ADM-86` drives the governed dispatcher (serves `catalog.list` and the delivery handovers, refuses the two root commands, unauthenticated context refused before the guard); E3 (`a3p4-pr4-production-entry-regression.test.ts`) proves `installed===true`, a served control read, the two root refusals with facts on the row's own ledger, AND — at the production port — that `member.followup` asks the facade for the `execution: 'async'` delivery receipt while `member.create` is the creation-only action. **ROUND 83 — THE PLANE MAY DELIVER WORK; IT MAY NEVER EXECUTE A TOOL.** A third effect class `work-delivery` (`S6_WORK_DELIVERY_COMMANDS = member.create/member.followup/member.send`) is served as a HANDOVER into the Member's own governed path: `member.create` = the ONE activation authority (creation only, no work chain); `member.send` = the messaging coordinator's durable intent + input ACCEPTANCE + confirmation (the acknowledgement is the outcome; it never awaits the turn); `member.followup` = the work facade with `execution: 'async'` (durable `team-work-admitted` receipt; Phase B/C run DETACHED inside the Team runtime). `team.admitInitialWork` and `team.ensureRootLive` STAY REFUSED: their only seams await the root turn / start an executor with no delivery acknowledgement, so neither can be expressed as a delivery (the refusal reason says exactly that, and stays under the 512-char settlement cap). **LIVE (D2, `--boots 2`, DEV-LIVE, two agreeing boots): `d2:remote-delivery` PROVEN** — the operator's `member.send` answered HTTP 200 with the coordinator's `delivered` acknowledgement (intent seq 39 / confirmation 40) and, AT that acknowledgement, ZERO admission facts and ZERO execution facts for the Member's call; the delivered prompt then ran in Member B's OWN turn and the centre wrote its `allow` (`fs.read`, B's `instanceId`+`agentId`, B's in-lane locator) into B's OWN `<instanceId>.facts.jsonl` AFTER the ack, with a `completed` execution and the file's bytes in the transcript; error paths measured on the same row: unknown member → `TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED`, archived member → `TEAM_RUNTIME_WORK_STATE_REJECTED` (both typed, zero provider requests), duplicate send → a SECOND durable coordination (at-least-once; no replay, no operator-side execution), restore → delivery served again, and Stop during a DELIVERED turn → `ADMISSION_STOPPED`, `REFUSED`/`not-started`, never a completion. The plane structurally has NO tool/provider port; the delivery ACK carries no tool result. LIMIT: a per-DSH_HOME authenticated operator (Connection Gate), NOT multi-user RBAC; `team.admitInitialWork`/`team.ensureRootLive` remain SERVED-NOWHERE through this plane. | MECHANISM (closed classification + delivery law) + in-process production-root arm + **live host boot, delivery boundary DEV-LIVE PROVEN (round 83)** |
| C-mcp | MCP | judged on the NETWORK axis with the SERVER as the locator (`net.mcp`, `ADM-33`): unset is not allow, deny is deny, a tool-level restriction narrows it, and a `mcp__` name with no server is refused as malformed rather than matched by prefix. WHICH servers exist stays the mount gate's decision. **ROUND 57 — A REAL MOUNT NOW REACHES THE CENTRE.** `ADM-96` starts the product's own mini-MCP server (real HTTP, `packages/runtime/root-binding/harness/mini-mcp.mjs`), computes the mount target with the product's `configuredMcpServers` → `filterMcpServers`, mounts it with the EXACT production call (`mcpClient.apply(ctx, <the seven-field streamable-http literal `reconcileMcpSet` passes>)` — the same call `mcpMountCtx.plugin(mcpClient, …)` makes), reads `mcp__p5t5mini__ping` off the resulting model-visible surface, and the ONE centre admits it on `net.mcp`/locator `p5t5mini`, records the fact (read back from disk), settles `ADMITTED → RUNNING → COMPLETED`, and the REAL server body answers `pong:mounted`. `ADM-97` (negatives): the same MOUNTED tool is `NETWORK_DENY` when the compiled TOOL-level answer denies it and `NETWORK_DENY` when the ceiling denies — zero body, `REFUSED` settlement in both (mounting is not permission) — while the other tool of that server still runs; `mcp__` and `mcp__<server>` are `ADMISSION_TOOL_UNBOUND` (no prefix matching); a configured-but-ungranted server is excluded by the mount gate and contributes NO name to the surface. **LIMIT, UNPROVEN at the centre:** the centre is NOT mount-aware — its binding is installed at the member bind (`agent-bindings.mjs:2006`) while `mcpMountTarget` is computed later per boundary (`agent-bindings.mjs:2241`), and `admission.ts:78-120` has no mount input — so a WELL-FORMED name for a never-mounted server is decided on the network axis alone (pinned by `ADM-97` step 5). The product excludes such a call at the TOOL REGISTRY, not at admission | MECHANISM (real mount → real body → ONE centre; NO host boot); centre-side unmounted-server refusal UNPROVEN |
| C-alpha6 | Alpha.6 review routing | *(Round 86 audit: this cell opened with "EXPLICITLY UNAVAILABLE (b)", the round-55/68 state. **Round 84 implemented the formal routing** — no new axis; a coherent row is admitted and each incoherent piece is refused and recorded. The live routed wake is the remaining gap. The round-55 text below is kept as history.)* **EXPLICITLY UNAVAILABLE (b)** — the opt-in is refused with its own code `ADMISSION_ALPHA6_UNAVAILABLE`, in TWO independent gates that name the same missing axis: the pure config rule (`centre-config.ts:73`, `ADM-34`) and, for a row that builds the root directly on a centre-configured row, a recorded refusal on `host.service` (`root.ts:2508`) followed by a typed boot refusal — no review wake is dispatched. Review routing decides who may review whom before any tool call, so the centre has no lane or locator for it, and the previous "needs a centreStatePath" shape bought a durable store outside the centre, not centre adjudication. `ADM-85` proves the recorded refusal + settlement REFUSED/not-started + zero wakes, with an ungoverned positive control. **ROUND 57 — the refusal is UNCONDITIONAL, and the machinery behind it is measured, not assumed.** `ADM-99` proves the config rule refuses the opt-in on EVERY row, including one with no `centreStatePath` (`centre-config.ts:73`; `host.ts:738` is the only production enforcement point) — so there is NO product-config path on which Alpha.6 is reachable at all, which is stronger than "a centre-configured row is refused". `ADM-98` proves the missing piece is NOT the Alpha.6 machinery: composed directly, `createAlpha6RootWiring` composes `mode:'alpha6'`, the ONE shared `createAlpha6RootRouter` takes a real decision off a durable control row (`route.kind='recipient'`, Officer, `routeRole='officer'`), and the real `dispatchLatch` + `createFileWakeIntentDirectory` persist a row that, re-read from disk through a FRESH directory object, names exactly the routed reviewer. **The missing seam is the CENTRE JOIN:** no axis/family in `admission.ts` (`TOOL_AXES`/`CENTRE_TOOL_NAMES`/`HOST_CAPABILITY_TOOL_NAMES`, `admission.ts:32`, `:57`, `:114`) can name a review-routing decision, so `ADM-99` drives one at the centre and gets `ADMISSION_TOOL_UNBOUND` with the fact recorded on the FALLBACK axis `fs.read` — a fabricated-axis record, not a review verdict. **The two lawful shapes:** (A) add a compiled review-routing axis to the member contract (the v4 ceiling is frozen → contract change) so the ONE centre judges the decision before the wake; or (B) rule that a record-only approval fact on the existing `host.service` axis IS adjudication and wire the PA approval-fact join (still UNPROVEN below). Neither is wiring-only, so the row stays explicit unavailability. NOT PROVEN: the PA approval-fact join. **ROUND 63 (D3 live driver, two boots, §15 / `d3/README.md`):** the typed refusal was measured on a REAL host boot with `alpha6ReviewRouting: true` — the host PROCESS boots and the ROW is refused inside plugin bootstrap (`ADMISSION_ALPHA6_UNAVAILABLE … no review-routing axis exists`, `centre-config.ts:73` at `host.ts:738`), with NOTHING live (no team root: `/__p6t6/state` 404, `liveMembers=0`, no decision, no wake-intent file, no fact file). The RECORDED-FACT writer (`createHostSurfaceRefusalPoint`) was unreachable at that entry because the gate ran before root construction — an honest limit of the host path, not a driver choice. **ROUND 68 (shape A, D3 live driver re-run, two boots) — the recorded-fact half is now REACHED at the same entry, and the refusal is unchanged.** `host.ts` passes `createAlpha6RowRefusalHook` (`vnext/row-refusal-entry.ts`) to `validateTeamPluginConfig`; the hook runs at the exact centre rule, BEFORE the unchanged typed throw, builds the product's own `createHostSurfaceRefusalPoint` (`host-surface-refusal.mjs`) through the shared constructor `createCentreHostSurfacePoint` (the same one `root.ts` uses), and writes the invocation-authority fact (`decision=deny`, `refusalCode=ADMISSION_ALPHA6_UNAVAILABLE`, axis `host.service`, `toolName=alpha6.review-routing`) plus the settlement (`REFUSED`, `dispatch`/`bodyOutcome` `not-started`, transitions `ADMITTED→REFUSED`). Measured live in BOTH boots: `refusalFactCount=1`, `refusalSettlement.state=REFUSED`, while the row is still refused with the same code and the host still boots with NOTHING live (`/__p6t6/state` 404, `liveMembers=0`, no decision, no wake-intent file). `no-silent-route` stays PROVEN: the probe now evaluates it as "no ROUTE-claiming fact" (`nonRefusalFactCount=0`), so a recorded refusal cannot be laundered into a silent route. New arms: `ADM-116` (refused AND recorded, fact + settlement read back from disk), `ADM-117` (positive control: a row without the opt-in validates/binds and writes nothing), `ADM-118` (covered-face fault elsewhere untouched: the shared point still records `remote`; a non-Alpha.6 centre violation writes nothing). **ROUND 84 — THE FORMAL ROUTING IS IMPLEMENTED; THE ROW IS NO LONGER UNCONDITIONALLY REFUSED.** The determination is recorded BEFORE the code (`ALPHA6-FORMAL-ROUTING.md`): three pieces were missing and **there is no `CORE_SEAM_BLOCKER`**. (1) ROUTING AXIS — none is lawful and none is needed: a routing decision executes nothing, so giving it a member I/O axis would be a fabricated record (`ADM-99` had already measured `ADMISSION_TOOL_UNBOUND` on the fallback `fs.read`); the decision stays a projection of the durable control row through the ONE shared policy (`review-router/router.ts:90`), measured by `ADM-142`. (2) WAKE — the old `deliverReviewWake` resolved the live agent and wrote a hand-built message, skipping everything P6-T3 built for `member.send`. It is now a governed DELIVERY (`vnext/review-wake-delivery.mjs`): durable `team-review-wake-routed` intent → `SessionInputPort.submitAttributedInput` (requirement verdict + machine attribution + inbox acceptance) → `team-review-wake-delivered` confirmation, in the SAME TeamDomain ledger with the SAME correlation token; `agent-bindings.mjs:4218` delegates to it and REFUSES to invent a recipient (no Member row / no bound child session ⇒ typed refusal before any write). (3) ENABLEMENT — `centre-config.ts#alpha6EnablementRefusal` admits a COHERENT row (authored v5 `reviewRouting.enabled === true`, non-empty `centreStatePath`, ABSOLUTE `alpha6WakeIntentPath`) and refuses each incoherent one with its OWN typed piece code (`ADMISSION_ALPHA6_ROUTING_REQUIRED` / `_CENTRE_REQUIRED` / `_WAKE_INTENT_PATH_REQUIRED`) under the unchanged `ADMISSION_ALPHA6_UNAVAILABLE` prefix, so `row-refusal-entry.ts` still records the refusal as a fact + `REFUSED`/`not-started` settlement. The Officer's approval and every tool it then calls are admitted by the ONE centre under the OFFICER's OWN binding (`ADM-144`: `team_resolve_control`, axis `team.control`; an unbound caller is `ADMISSION_NO_BINDING`). The management plane still DELIVERS and never executes (`ADM-143` measures zero tool executions during a wake). Stop is unchanged: the delivered wake is a MACHINE input, so it can never clear a human Sticky Stop (A56 predicate asserted in `ADM-143`/`a6-pr4-review-wake-glue`). **Arms:** `ADM-141` (positive enablement + each piece refused AND recorded), `ADM-142` (officer route, nothing executed), `ADM-143` (intent + confirmation + machine attribution + zero executions), `ADM-144` (Officer's own call admitted under its binding), `ADM-146` (duplicate ⇒ ONE confirmation; unknown recipient ⇒ typed refusal with zero facts), `a6-pr4-review-wake-glue` (real glue: one attributed inbox input + facts read back), `a6-pr7-merged-wake-host` (three asks ⇒ ONE inbox input), `a6-root-wiring` (a PRODUCTION root boots a coherent Alpha.6 row and merges three real transport rows into one wake). The REFUSAL path is kept green: `ADM-34`, `ADM-85`, `ADM-99`, `ADM-116…118` still prove denial + typed code + recorded fact + REFUSED settlement + zero wakes for an INCOHERENT row, and the D3 live driver's `alpha6` arm still measures the row refusal on a real host. **NOT PROVEN:** a LIVE host run of the ROUTED wake — the D3 world's blueprint is v4 with a single worker member and no Officer/approval case, so it can express only the refusal side, and no mock-model path resolves a control. The level stays MECHANISM; the live side remains the refusal shape (rounds 63/68). **ROUND 87 — THE LIVE ANSWER, AND A PRECISE BLOCKER (D4 probe, two agreeing DEV-LIVE boots, rc.2 `639ed015…`, HEAD `775be06d7`; `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md`).** The v5 world the task asked for IS expressible and was booted: `d4:enablement` **PROVEN** (coherent row admitted — `alpha6EnablementRefusal` returns `undefined`, host + TeamSession served, zero refusal facts), `d4:officer-up` **PROVEN** (Officer RUNNING instance with its own running child session), `d4:officer-binding` **PROVEN** (the Officer's OWN call admitted under ITS binding: 1 allow fact for its callId, settlement `ADMITTED→RUNNING→COMPLETED`), `d4:refusal` **PROVEN** (the same v5 doc without `reviewRouting` still refused by name, recorded, `REFUSED`, zero wakes). `d4:routed-wake` is **REFUTED by the product itself**: the worker's authored `ask` lane creates a real durable `leader-approval` row that carries **no `approvalCaseId` / `legOrdinal` / `reviewAuthority`**; the product's own `createAlpha6RootRouter.route()` answers `null` for it (`memberListCalls: 0`); **zero** `team-review-wake-routed` / `team-review-wake-delivered` facts, **zero** wake-intent files, the Officer is never woken, and the **Leader** receives the plain C1 ask (`[team-control … waiting for Leader approval`). TWO Team-side seams are missing and **neither is a `CORE_SEAM_BLOCKER`**: (1) **no live producer of a case-bearing ordinary ask** — `route()` needs the case identity (`alpha6/root-router.ts:209`), the case-less notifier branch wakes the Leader by design (`alpha6/notifier.ts:159-169`), the only live leg producer `requestApprovalLeg` (`control/service.ts:5607`) is called solely by the envelope-mutation lane (`governance/service.ts:1016`, excluded by `isDelegableOrdinaryToolAsk`, `review-router/policy.ts:68`), both ordinary-ask producers are case-less by construction (`src/plugin/vnext/admission-port.mjs:155-165`; `packages/tools/src/tools.ts:973-1000`), and the lane that minted ordinary legs was deleted by the A1 cut (`1617d5839` — its survivors are pure/test-only or consumption-only, `root.ts:3268`; `a4p7-live-descendant-authority.test.ts:579` states it in the repo's own words); minimal lawful fix = open the admission ask through the case-forming call with the identity Alpha.6 already requires (the "Alpha.6-aware ask lane" the J06 comment at `root-router.ts:212-216` anticipates), no new axis. (2) **no consumer for an `ask`-disposition call even after an allow** — the centre refused the granted call verbatim: "has the disposition 'ask', but this admission plane has no approval consumer (`resolveAskClassCall` has no production caller); refusing rather than auto-approving" (`member-io-policy/src/provider-capabilities.ts:315`, comment `:200-205` names **BL-30**; backlog `:559` BL-30 READY, `:562` BL-33's consumption half blocked on it). Duplicate-route and machine-wake-vs-Sticky-Stop stay unreachable with it (in-process `ADM-143`/`ADM-146` unchanged). No leg was fabricated, no control route was added to the harness, no wake file was written by the driver. | MECHANISM (formal routing implemented and proven over the real ports, including a production-root boot) + live host refusal/recorded-refusal DEV-LIVE (rounds 63/68) + **round-87 live: coherent enablement / Officer instance / Officer binding / refusal all PROVEN; the ROUTED wake REFUTED by the product's own router on the product's own case-less row**; live ROUTED wake still UNPROVEN — blocked on the two Team-side seams above (an Alpha.6-aware ask lane + BL-30), never on an upstream seam |
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
161 pass + 2 disclosed skips at that round (194 today); vitest population unchanged at 238).

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
**Round 62 repaired the surface instrument**: the surface judge is PROVEN with all six clauses.
**Round 71 repaired the denial instrument**: `d:member-read-denied` no longer demands the provider's
`IO_READ_DENIED` on the live path (the centre decides first). It measures the DECIDING CHANNEL —
`LANE_DENY` with ZERO provider guard facts for that exact call, or `IO_READ_DENIED` with its own guard
deny fact — plus zero secret bytes and not-ENOENT, and it carries a separate in-process `ADM-100`
clause for the provider channel. It is PROVEN on two agreeing boots. Both channels are evidenced at
their proper layers; neither replaces the other. Details: `D-BOOT-FEASIBILITY.md` §13-§14 and
`dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md`.

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
| an admitted-as-allow call refused by the recheck has no legal settlement state | **FIXED (round 73, owner-approved Option A)** — the settlement store appends a durable recheck deny (`recordRecheckDecision`) beside the untouched allow and settles `REFUSED`/`not-started` citing it; without the durable deny the old `SETTLEMENT_ADMISSION_MISMATCH` / `SETTLEMENT_CONTRACT_GAP` still holds. Arms `ADM-119`…`ADM-124`; see `CONTRACT-CHANGE-REQUEST-settlement-recheck.md` (RESOLVED) |

Two P2 classes are also closed (a gap in the compiled answer no longer inherits the ceiling; the ledger
no longer lets a caller rename a record kind or end a call twice). Three remain and are CONTRACT
questions rather than widenings: the third grant-id scheme (at round 28 there was no approval binder wired in the
product at all, so asks were refusals; round 51 wired the binder and the durable approval port for rows
with a `controlServiceRef`, `agent-bindings.mjs:688-706`), `agentId: sessionId` (two identities in one field), and the
synthetic `executionIdOf` join. None may be fixed by inventing a fourth scheme.

## CONTRACT_CHANGE_REQUEST — RESOLVED (round 75): there never was a missing declaration

`CONTRACT-CHANGE-REQUEST-process-lane.md` is now marked **RESOLVED / SUPERSEDED**. The Round-75
CONTRACT FITNESS CHECK proved that the v4 grammar already expresses process execution authorization
(`toolBindings[].authorization` + `execution.implementationOrigin/executionBoundary`,
`blueprint-v4.ts:193-204`) and that the defect was CARRIAGE: `projectToolIoRestriction` dropped both
fields and `bindingFromCompiledMember` never forwarded them, so the centre fell back to a
`Binding.process` path lane that no surface declared. No schema change was made; no fourth lane was
added; `io.process` does not exist.

The three previously-refused alternatives stay refused for the same reasons (judge on the write
lane; a second declaration source in the product realm; derive a lane from the boundary). What
changed is that tool-level EXECUTION authority is now carried end to end and the decision reads it
(`ADM-125`…`ADM-130`). PTC remains its own absence: `ADMISSION_PTC_UNAVAILABLE`, now narrowed (round 85) to the
WORKER's OS profile — nested calls, Control escalation and Stop were measured as holding
(`ADM-87`, `PTC-FOUR-PART-FINDING.md`).

## Round 55: the three rows that were neither wired nor named

`ADM-85`…`ADM-88` settle C-remote, C-alpha6 and C-ptc as **explicitly unavailable**, each with its
own code, its own existing axis and the product's own fact + settlement shapes:

| capability | code | axis recorded | where the refusal is taken | arm |
| --- | --- | --- | --- | --- |
| remote | `ADMISSION_REMOTE_UNAVAILABLE` | `team.control` | rounds 74/83: `root.ts` per-command hook (surface BUILT; only `agent-execution` commands refused — `team.admitInitialWork`, `team.ensureRootLive`; the member commands are `work-delivery` and served) | `ADM-86` |
| Alpha.6 review routing | `ADMISSION_ALPHA6_UNAVAILABLE` | `host.service` | `centre-config.ts:73` (config) + `root.ts:2496` (recorded + typed boot refusal) | `ADM-85`, `ADM-34` |
| PTC escalation | `ADMISSION_PTC_UNAVAILABLE` | `process.exec` | `admission.ts:405-407` (the ONE centre, before the body) | `ADM-87`, `ADM-88` |

The closed table is `host-surface-refusal.mjs`; an unknown capability throws rather than being
"refused generically". **ROUND 74 supersedes the remote half of this section:** the owner ruling restored
S6 Remote as a governed MANAGEMENT plane (control-plane commands served, agent-execution commands still
refused with the SAME code/axis and the SAME durable shapes), so the earlier "a centre row has no remote
API" disclosure no longer applies. The row remains explicit about what it does NOT buy: no multi-user RBAC,
and no S6 command may dispatch/execute a model tool — the per-command refusal is the boundary.


## MEASURED (round 63): the D3 live driver's four judges

`tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs --boots 2` — two identical boots
(`agreeing=true`), record class `DEV-LIVE`. Full detail: `dev/agent-workflow/evidence/ute-a1/
D-BOOT-FEASIBILITY.md` §15 and `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md`.

| judge | verdict | the hard fact |
| --- | --- | --- |
| `d3:persistent-subprocess` | **PROVEN** (round 76) | measured at round 63 as `ADMISSION_AXIS_UNSUPPORTED`, at round 75 as `ADMISSION_EXECUTION_UNAUTHORIZED`; **round 76 (two agreeing boots): both `bash` turns ADMITTED on `process.exec`, the state write succeeds in-lane, the second turn reads it back from the SAME shell, the out-of-lane write is refused by the OS profile, both settlements `ADMITTED→RUNNING→COMPLETED`**; preset shell rows `["tool-bash","tool-bash-persistent"]` |
| `d3:crash-cold-recovery` | **PROVEN** | real SIGKILL (`signal=SIGKILL`, pid gone), restart on the SAME home; in-flight `RUNNING`→`UNKNOWN` with no execution fact and one admission fact (never replayed); completed call's fact/settlement byte-identical; new call admitted with a NEW fact and `COMPLETED` |
| `d3:work-delivery` | **PROVEN** | delegate admitted → unit verbatim → terminal collect, identical after the cold restart, member calls in the member's ledger only |
| `d3:alpha6` | **PROVEN** | typed row refusal `ADMISSION_ALPHA6_UNAVAILABLE` on a booted host; no team root, no decision, no wake intent, no fact file (**round 68 re-run: the fact and settlement are now written at the host entry — `refusalFactCount=1`, `REFUSED`/`not-started`; the verdict is unchanged**) |

OVERALL stays FAIL because a REFUTED judge is a FAIL case by the runner's rule; `evidence-complete=true,
allProven=false`. NOT PROVEN here: any non-DEV-LIVE status, a persistent session, a live execution
authorization (the D3 world declares none), the Alpha.6 ROUTED path at a host entry (its recorded refusal is measured, round 68), a real-model interleaving.

## MEASURED (round 75): process execution authority is a DECLARATION, not a path lane

Owner ruling `docs/reviews/20261122-1536.txt` §1. Full fitness table and the resolved CCR:
`CONTRACT-CHANGE-REQUEST-process-lane.md`.

| what | where it now lives |
| --- | --- |
| declaration (unchanged grammar) | `blueprint-v4.ts:100,103,123,193-204` — `toolBindings[].authorization` + `execution` |
| carried through the projection | `member-io-policy/src/compile.ts:265-283` (`projectToolIoRestriction`) |
| carried into the realm binding | `team-services/src/product-assembly.ts` (`projectedRestrictionOf`, `derivedMembersOf`) |
| carried into the centre binding | `src/plugin/vnext/centre-install.mjs:64` (+ `executorReadinessOf`) |
| the decision | `src/plugin/vnext/admission.ts:409-452` |

Arms (`packages/runtime/test/vnext-admission.test.mjs`, leg `ute-vnext-a1`):

| arm | proposition |
| --- | --- |
| `ADM-125` | `authorization: allow` + a ready executor ⇒ the body RUNS, the fact is `allow` on `process.exec`, the settlement `COMPLETED`, and a different cwd changes nothing |
| `ADM-126` | `authorization: deny` ⇒ `ADMISSION_EXECUTION_DENIED` before the body, `REFUSED/not-started`; deny outranks the executor check |
| `ADM-127` | `authorization: ask` ⇒ exactly one durable Control request naming the tool and boundary, then the body under a one-shot grant; a DENIED approval refuses before the body |
| `ADM-128` | a declared boundary with no readiness fact (`UNKNOWN`) or `unavailable` ⇒ `ADMISSION_EXECUTOR_UNAVAILABLE`; `trusted-host` and `confined-subprocess` are different executors; absence of a declaration keeps `ADMISSION_EXECUTION_UNAUTHORIZED` |
| `ADM-129` | an in-lane `grep` is admitted on `fs.read` while the SAME binding's `bash` is `ADMISSION_EXECUTION_DENIED`; an out-of-lane `grep` is `LANE_DENY` |
| `ADM-130` | the OS profile the executor applies is compiled from the three lanes (`readPaths`/`writeOnlyPaths`/`networkProfile`), an outside path is not in it, and an `ask` lane is REFUSED (`PATH_LANE_UNSUPPORTED`) rather than widened. **Cannot prove here:** kernel enforcement (no child under Landlock) — that is the OS arms' and the boot's job |

Also updated: `SLICE-33` admits the shell under the compiled authorization and still proves the PTY
face refuses an unregistered owner; `u6-pr3-bl01-ask-door`'s negative control now uses
`authorization: deny` instead of a process lane; the B ladder's rung 5 negative control is
`ADMISSION_EXECUTION_UNAUTHORIZED`.

**Live (D3, `--boots 2`, two agreeing boots, DEV-LIVE).** `d3:persistent-subprocess` is **REFUTED**
with these exact clause details (both boots identical): `persistent-tool-mounted=false`
(mounted shell rows `["tool-bash"]`); both `bash` calls return
`Error: ADMISSION_EXECUTION_UNAUTHORIZED: tool "bash" has no compiled tool-level execution
authorization (toolBindings[].authorization + execution.executionBoundary)`; both facts are
`{axis: process.exec, decision: deny, refusalCode: ADMISSION_EXECUTION_UNAUTHORIZED}`; both
settlements are `REFUSED` with transitions `["ADMITTED","REFUSED"]`; the state file is never
written. The `crash` / `work` / `alpha6` judges stay PROVEN. The other D3 checks (porcelain empty,
host killed, ports released) pass.

Why the D3 world does not simply declare the authorization: the only `bash` module the preset mounts
is the one-shot `tool-bash`, whose body runs on the HOST's base `ctx.shell` (it injects
`['tools','shell','systemPrompt','shellEnv']`), NOT on the realm's confined subprocess/PTY face.
Authorizing it would run an unconfined shell — the exact regression this round forbids. The
product-correct swap is to mount `dsh-tool-bash-persistent` with `backendType: a5sf-governed-shell`
in place of `tool-bash`; it is left OUT because it changes the model-visible `bash` parameter
surface (`command` only, versus `command`/`description`/`workdir`/`timeoutMs`) for every governed
deployment and the D3 scripted model passes `description` — a composition change that needs its own
live verification, and one that must not be smuggled in behind an admission ruling.

### Round 76 supersedes the live half of the above

The swap this section deferred was made in round 76 and measured live: `d3:persistent-subprocess` is
now **PROVEN** in two agreeing boots. The paragraph above is kept verbatim as the round-75 record of
why the swap was not smuggled in behind the admission ruling; see **MEASURED (round 76)** below.

## MEASURED (round 76): the governed Member runs a PERSISTENT, CONFINED shell — `d3:persistent-subprocess` PROVEN

The round-75 refutation had two independent causes; both are now closed by DECLARED composition, not by
weakening a judge:

1. **The governed preset mounted only the one-shot `tool-bash`.** Its body injects the HOST's base
   `ctx.shell` (`['tools','shell','systemPrompt','shellEnv']`), so it can never resolve a realm face.
   Round 76 mounts the HOST's own `@deepseek-ai/dsh-tool-bash-persistent` (no shadow, no Team copy) as a
   TOP-LEVEL preset row in `cordis.patch.yml:363-368`, `config.backendType: a5sf-governed-shell` — the
   registered backend of the governed PTY face (`terminal-pty.ts`; the install default). The one-shot row
   stays as the SURFACE BASELINE the lane replaces (shape A needs a baseline name to swap: it requires a
   definition-identity change and an unchanged surface name set), exactly mirroring the `tool-fs` pattern.
   The persistent row is `disabled` on win32 (the governed shell is a Linux/darwin profile).
2. **The D3 world declared no `toolBindings[]` for `bash`.** The main blueprint now declares
   `tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs:309-321` →
   `{ owner: 'dsh.subprocess', name: 'bash', authorization: 'allow', io: {read: all, write: all, network: allow}, execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' } }`.
   The v4 grammar is UNCHANGED: no `io.process`, no new field, and the `io` lanes add no narrowing
   (`all` + empty deny) because process authority is not a path lane. `ask` is not the acceptance arm;
   `ask`/`deny` remain the in-process arms (`ADM-126`/`ADM-127`/`ADM-131`).

**DEPLOYMENT REQUIREMENT (measured, not a test hack).** The persistent row injects `terminals`, and a
preset binds only when every enabled row is ACTIVE: a pending row refuses the whole preset with
`RemoteError: agent-preset/invalid: tool-bash-persistent (@deepseek-ai/dsh-tool-bash-persistent): waiting
for terminals` and `team_create_member` fails with `TEAM_RUNTIME_DURABLE_WRITE_FAILED … waiting for
terminals` (measured 2026-11-22 in the D3 run, then reproduced in the D1 and D2 worlds, which compose the
same preset). A governed deployment must therefore compose `@deepseek-ai/dsh-terminal` on an ancestor
scope. The worlds add the HOST's own module with NO backend: it is INERT and FAIL-CLOSED
(`spawn('a5sf-governed-shell')` → `TerminalError('no PTY backend registered …', 'NO_BACKEND')`, zero
processes, `listBackends() === []`); the Member's live `bash` is the realm MOUNT of the same host module
on the governed face, which carries the backend. This is a product/deployment fact of the composition,
not a fixture the tests may skip.

Three runtime defects were found by making the path real, and fixed in-place (no core patch):

| where | defect | fix |
| --- | --- | --- |
| `packages/runtime/team-services/src/product-assembly.ts` (`projectedRestrictionOf`) | a `confined-subprocess` restriction was told it "has no realm face in this lane" even when the compiled answer HAS a confined process face (`availableFaces.process === true`) — measured as `REALM_DECLARATION_INVALID` at the durable write | `confinedProcessOwned` = boundary is `confined-subprocess` AND `faces.process === true`; that form is ACCEPTED as a process-class binding. A **narrower** process-class lane is still refused (`REALM_DECLARATION_INVALID`, message matches `/process-class/`) because no code path would enforce the narrowing (`ADM-133`, `ADM-134`) |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (`COMPILED_REALM_ANSWERS`) | the compiled answer the centre builds its admission binding from kept only `{members, bindings}` and DROPPED the mounted faces, so `executorReadinessOf` answered `unavailable` for a realm that HAD mounted the confined subprocess face → live `ADMISSION_EXECUTOR_UNAVAILABLE` on the realm-mounted `bash` | the stored answer carries `subprocess`/`terminal`/`web` verbatim; pinned by a new arm in `vnext-b-probe-ladder` (`answer.subprocess === subprocessFace`, `executorReadinessOf(answer)['confined-subprocess'] === 'ready'`) |
| `packages/runtime/team-services/src/mount.ts` (`mountA5sfRealm` binding loop) | a process-class `toolBindings[]` entry claimed `bash` for an IO binding realm (which isolates `fs` ONLY, so it can never host `terminals`/`subprocess`) → shape A's untargeted mount refused with `SERVICE_MOUNT_FAILED … registered UNCOVERED name(s) ["bash"]` | process-class bindings get NO IO realm; `compiled.bindings` remains the admission carrier (the centre reads it, not `mounted.bindings`) |

**Live (D3, `--boots 2`, DEV-LIVE, two agreeing boots, 2026-11-22T12:17-12:23Z).**
`RESULT evidence-complete=true allProven=true (2/2 boots; agreeing pair=true)`, exit 0. All four judges
PROVEN in BOTH boots (`persistent`, `crash`, `work`, `alpha6`), identical clause details:

| clause | measured |
| --- | --- |
| `bash-on-member-surface` | `bash` present once on the Member surface (34 tools) |
| `persistent-tool-mounted` | preset shell rows `["tool-bash","tool-bash-persistent"]`, `tool-bash-persistent=true` |
| `first-call-admitted` | `isError=false`, text `DBOOT_D3_STATE_WRITTEN` + `bash: …/workspace/team-b/d3-escape.txt: Read-only file system` + `DBOOT_D3_ESCAPE_REFUSED` |
| `state-written-by-shell` | `workspace/team-a/d3-persistent-state.txt` exists (32 bytes) |
| `second-turn-saw-state` | `isError=false`, text `DBOOT_D3_PERSISTENT_SHELL_STATE` + `DBOOT_D3_STATE_READ` (a SECOND turn reused the SAME shell) |
| `first-call-centre-fact` / `second-call-centre-fact` | `{axis: process.exec, decision: allow}` for both calls |
| `first/second-call-settled-completed` | `ADMITTED → RUNNING → COMPLETED` for both calls |

**Confinement is REAL, at the kernel level, and it was measured with both controls** (`confinement-probe.json`,
identical in both boots): the shell wrote the in-lane state file (`inLaneStateFileExists=true`,
`inLaneStateFileBytes=32`) and could NOT write the out-of-lane file (`outOfLaneFileExists=false`,
`outOfLaneFileBytes=0`), and the SHELL ITSELF reported the refusal (`Read-only file system`) while the
driver process — OUTSIDE the sandbox — read the disk and found nothing at the out-of-lane path. The parts:
the governed PTY's `spawn` is wrapped by the HOST `sandbox` provider (`terminal-bash` calls
`sandbox.confine(argv, policy)` with the Member's `narrowSandboxPolicy` write root = the deepest declared
write root containing the session cwd), whose Linux chain prefers **bubblewrap** (`bubblewrap 0.11.1`
verified usable on this host; a `--ro-bind / / --bind <in-lane>` profile refuses the out-of-lane write) and
falls back to the **Landlock LSM** launcher when bwrap's probe fails. The `Read-only file system` (EROFS)
the shell reported is that mount profile, not the shell's own `2>/dev/null`.

**The surface change, and every assertion moved to the new truth.** The model-visible `bash` is now the
persistent definition: parameters `{command}` only — `description`, `workdir` and `timeoutMs` are GONE
(`ADM-132` pins `Object.keys(schema.properties) === ['command']`, `required === ['command']`, and the
preset block has exactly one persistent row with `backendType: a5sf-governed-shell`).

| assertion | old truth | new truth |
| --- | --- | --- |
| `run-boot-d3.mjs` `bashCall` | sent `{command, description?, workdir?, timeoutMs?}` | sends `{command}` only (the schema rejects the rest; the driver is the model, so it must speak the surface) |
| `cordis.patch.yml` persona suffix | "`bash` runs one command per call" | "`bash` is PERSISTENT (`cd`/`export` are durable; there is no `workdir`/`timeoutMs`)" |
| `ADM-132` | did not exist | pins the persistent definition + the preset row |
| `vnext-b-probe-ladder` | asserted nothing about the stored answer's faces | asserts `answer.subprocess === subprocessFace`, `answer.terminal.mode === 'pty'`, `executorReadinessOf(answer)['confined-subprocess'] === 'ready'` |
| D3 `crash` judge clause `state-file-never-written` | absence-as-evidence: PASSED only because persistence was REFUTED | `state-file-survives-restart`: the same state file EXISTS and still contains the state bytes after the SIGKILL + cold restart (stronger; the judge proposition text is unchanged) |
| `run-boot.mjs`, `run-boot-d2.mjs` composed rows | 3 rows | 4 rows: the inert `@deepseek-ai/dsh-terminal` row (the deployment requirement above) |

**NOT PROVEN here:** DEV-LIVE is not a gate; no real-model interleaving; the `ask`/`deny` arms are
in-process only (`ADM-126`/`ADM-127`/`ADM-131`); no Windows deployment (the row is `disabled` on win32);
the persistent state is shell-local across two turns (not a tmux/Processo env proof); the governed realm
still needs the deployment to compose `@deepseek-ai/dsh-terminal` (the preset refuses to bind otherwise,
by design); and the `crash` judge's own proposition is about ledger/settlement durability, not about the
shell.
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
was 168 pass + 2 disclosed skips at that round (194 today); the vitest population stays 238.

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
| C-subprocess | no unconfined shell; fail-closed when no `toolBindings[]` authorization; a declared boundary needs a READY executor | `admission.ts:409-452` (`ADMISSION_EXECUTION_UNAUTHORIZED`/`_DENIED`/`ADMISSION_EXECUTOR_UNAVAILABLE`), `:405-407` (PTC, narrowed round 85 to the worker OS-profile seam); OS profile `team-services/src/subprocess.ts:1372` | `ADM-114`, `ADM-125`…`ADM-130`, `OS-1/2/3` |
| C-tools (Control) | one approval authority; current facts; one-shot spend | `admission-port.mjs:94,336-344,477`; `packages/runtime/control/service.ts` | `ADM-112` |
| C-member (Stop) | Stop is REFUSED/not-started, durable, non-replaying | `admission-port.mjs:336-344,477,801-802`; `settlement/execution-settlement.ts`;**ROUND 79 — the rc.5 pre-dispatch case**, which never reaches `admission-port` at all: the Stop is read from the host's own `ABORTED_BEFORE_DISPATCH` result at the executor completion boundary (`pre-dispatch-abort.mjs`, `execution-facts.mjs#observeExecutorCompletion`), recorded as an execution fact `aborted`/`abortPhase:'pre-dispatch'` keyed by the product ExecutionId; when an admission record exists the settle writer records `Stop(pre-dispatch)` + `CANCELLED` (`settlement-port.mjs#stoppedBeforeBody`), and when none exists it writes NO settlement and REPORTS `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` (no fabrication) | `ADM-113`; **`SLICE-21`/`SLICE-30`/`SLICE-37`, GREEN on rc.5 AND rc.2** |
| C-goal / C-skill / C-fork / dropped names | preserved host faces recorded on `host.service`; a dropped name is never silently admitted | `admission.ts:114-122`; `exit_plan_mode`/`team_skill`/`ask_user_question`/`present` unbound (`:316-319`) | `ADM-115` |

All six arms live in `packages/runtime/test/vnext-admission.test.mjs` and ride the `ute-vnext-a1` leg
(tests 194 / pass 192 / fail 0 / skipped 2 at this HEAD). Each arm first witnesses that the C14 body is gone
(`existsSync` = false), then proves its invariant POSITIVELY (the allowed case runs and settles) and
NEGATIVELY (the violating case is refused with its own code, before the body, with a CLOSED settlement).

**No invariant is left enforced only by a deleted component** — checked against the A0 tree, not assumed:
the five `confined-*` shadows were mounted by the realm row itself (`a5sf-realm-row.mjs` at A0,
`A5SF_CONFINED_FS_TOOL`), so a row with no realm never had them as enforcement either. **NOT PROVEN:**
product-entry (host-boot) enforcement of each invariant, network containment under a real model, and any
PRODUCT-PROVEN status. The ungoverned row stays outside the centre by design (see the corrected OPEN
section above).

## MEASURED (round 77): C-fs — the rc.5 FS additions are CONFINED (B5 closed)

**The gap, in the review's terms.** DSH 0.2.2-rc.5's `FileSystem` adds `patchText`, `deleteFile`,
`moveFile` (`packages/fs/fs/src/index.ts:325,345,368`). The Team confined provider overrode ten
methods ending at `editText`, so on rc.5 `apply_patch`, delete and move reached the backend with the
Member's lane never consulted. SLICE-35 is the invariant that goes red exactly for this; it was RED
on rc.5 at round 72b and named **7** un-overridden names (the three public methods + four TS-`private`
helpers of the rc.5 concrete provider).

**What is now measured.**

| property | evidence | host |
| --- | --- | --- |
| SLICE-35 (every path-touching base entry point is overridden) | `vnext-fs-slice.test.mjs` — PASS | **rc.5 AND rc.2** |
| SLICE-36 (the derivation detects an unconfined entry point) | same file — PASS, exact `deepEqual`, fixture adds three names the product does not cover | rc.5 AND rc.2 |
| `patchText` in-lane reaches the provider once / out-of-lane typed refusal, zero calls | `ADM-135` | both |
| `deleteFile` judged like a WRITE (write axis + `write ⇒ read`) | `ADM-136` | both |
| `moveFile` judges BOTH paths; out-of-lane destination refuses and removes nothing | `ADM-137` | both |
| cross-root move per the product's per-path rule (no invented ban) | `ADM-138` | both |
| a base without the three ⇒ typed `IO_POLICY_UNSUPPORTED`, no `TypeError`, no fallthrough | `ADM-139` | both |
| the REAL pinned provider: rc.5 performs the three; rc.2 refuses them typed with nothing changed | `ADM-140` | both |

**Falsifiability.** Renaming the `patchText` override makes SLICE-35 RED on rc.5 naming exactly that
method (mutation control recorded in `RC5-MIGRATION.md` §6.1). On rc.2 the three arms exercise the
identical code path; the only difference is that the base class has no method to delegate to, which
is the typed-refusal arm.

**Status stays MECHANISM.** Nothing here is a host boot: the provider is mounted in-process (spy
double for the lane arms, the real pinned `LocalFileSystem` for `ADM-140`) and the guard is the real
`createMemberFsGuard`. NOT PROVEN: a live `apply_patch`/delete/move through a booted Member; any
kernel boundary (the guard is in-process; the base provider's own TOCTOU is inherited, not closed);
`moveFile`'s version-guarded / patched-on-move path (only the unconditional case is exercised); and
the rc.5 lane's pre-existing reds (`ADM-96/97/101/102`, the `vnext-b-probe-ladder` hang) are
untouched by this round and remain open rc.5 drift. **Round 78 update: `ADM-100` is no longer red on
rc.5** — its world now mounts rc.5's `workingDirectory` service and executor and dispatches the batch
shape (assertions unchanged); it passes on both hosts.

**Deliberate non-change.** `MANAGED_FS_METHODS` (`member-io-policy/src/provider-capabilities.ts:51`)
was NOT grown by the three names: the install must keep accepting an rc.2 provider (which lacks
them), so capability is decided per call, and the refusal is typed. Growing that list would refuse
every rc.2 install — a compatibility break masquerading as a confinement fix.

---

## ROUND 78 (2026-11-22) — the same rows, measured on 0.2.2-rc.5

The three D drivers were made **host-selectable** (`TEAM_TEST_HOST=next`; one
selection authority, `tests/next-host/host-select.mjs`) and re-run against
`tests/deepseek-harness-next` (`dsh-v0.2.2-rc.5`, pin
`9c2670d3bce5275e0d1610272958121af87787bb`, ports 13000-13049, DSH_HOME suffix
`-next`). Full side-by-side tables, drift resolutions and limits:
`RC5-ACCEPTANCE.md`. Every row below was re-measured with two agreeing boots
on BOTH hosts and produced the same counted facts.

| C row | now measured on rc.5 | how |
| --- | --- | --- |
| C-tools | the 15 `team_*` tools on the real leader surface (49 tools total) | `run-boot` / `d2` / `d3` live boots |
| C-member | member create (`member-activated`, durable row) and the member's own centre judging its calls | `d2` two-member concurrency, `d3` delegate |
| C-work | delegate → member turn → collected body (`succeeded`), stable across a SIGKILL cold restart | `d3:work-delivery`, `d3:crash-cold-recovery` |
| C-fs | native `read` admitted in-lane with provider guard `allow` facts naming the member; out-of-lane refused with zero bytes | `d:member-read-*`, `d:guard-facts` |
| C-subprocess / C-pty | the persistent governed shell: two turns on the SAME shell, out-of-lane write refused by the OS profile | `d3:persistent-subprocess` |
| C-remote | `team.create` served; duplicate mints no root; unauthenticated refused; **round 83: `member.send` DELIVERED (acknowledgement with zero executions) and the Member's own turn admitted under its own binding; the two ROOT work commands stay refused** | `d:remote-creation` (rounds 74/83), `d2:remote-delivery` (round 83) |
| C-alpha6 | the same typed `ADMISSION_ALPHA6_UNAVAILABLE` refusal on a real rc.5 boot | `d3:alpha6` |
| ADM-100 (C-fs provider channel, in-process) | PASS on rc.5 after the world mounts `workingDirectory` + executor and uses the batch `tools.execute` shape; assertions unchanged | `TEAM_TEST_HOST=next node --test --test-name-pattern ADM-100 …` |

**Status stays what it was** (MECHANISM or DEV-LIVE, never PRODUCT-PROVEN): the
driver boots are DEV-LIVE, the model is the scripted mock, and the rest of the
238-suite vitest population was not run on rc.5. Rows NOT re-measured on rc.5:
C-web, C-ptc, C-mcp (live mount), C-goal, C-skill, C-fork, C-policy, and the
`apply_patch`/delete/move live face.

---

## ROUND 79 (2026-11-23) — rc.5 pre-dispatch cancellation (B6)

The A1 slice no longer reports 34/36 on rc.5: `SLICE-21`, `SLICE-30` and the new `SLICE-37` are GREEN
on **both** hosts, 38/38 for the whole file, with the two pre-existing arms' assertions untouched.
`SLICE-38` adds the DURABLE side of the same rule: the ledger refuses an execution it cannot bind
to an admission record, so the observer reports that refusal (`LEDGER_EXECUTION_UNBOUND`) and
writes no record at all.

Why it was red, and what changed — one paragraph: rc.5's batch scheduler cancels a call before
dispatch WITHOUT running the pipeline, so no `tools/result` fires; the product observed only that
event and therefore recorded nothing. The product now also reads the value `tools.execute` returns
(the host's own `ABORTED_BEFORE_DISPATCH` result, `batch.ts:271-280` → `index.ts:375-377`), writes
the SAME canonical execution fact (`aborted` / `abortPhase:'pre-dispatch'`) through ONE
ExecutionId-keyed dedupe map, and asks the settle writer to close the record as `CANCELLED` with a
pre-dispatch Stop when one exists. When no admission record exists (aborted before the admission
point) it records the fact, writes **no** settlement, and REPORTS
`SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` — the no-fabrication rule, made visible. The scheduler is
not intercepted or replaced and no tool event is fabricated.

Row statuses are unchanged: this is MECHANISM + lane evidence on two hosts, still not
PRODUCT-PROVEN, and the production `tools.execute` call site (the host agent loop's) is not wired —
see `RC5-MIGRATION.md` §7.5.


---

## ROUND 82 (2026-11-23) — the ENV-LIMITED cell: network-deny is a HOST capability, not a product switch

The hosted `ci-census` red (`OS-2`, `OS-3`, `ADM-66`, `SLICE-28`, cascade `ADM-70`) is ONE measured
environment absence, not five product defects: the confined process lane's `network: deny` profile is
admitted only on the product's own `--net-leg` proof (a fresh unprivileged
`CLONE_NEWUSER|CLONE_NEWNET` per confined child, verified by distinct namespace inodes and by kernel
errnos on tcp/udp while the listener counters do not move). The GitHub-hosted runner does not confirm
that proof, so the provider answers `network-destination: unsupported` and refuses every
`network=deny` spawn before any process. The confined subprocess face that `grep` runs through carries
the same profile, which is why the grep arms cascaded.

| C row | capability cell | local (capability present) | hosted `ci-census` (capability absent) | status |
| --- | --- | --- | --- | --- |
| C-subprocess | OS profile: network deny enforced (netns) | `A5SF-CAPABILITY network-deny=present` ⇒ `NET-DENY-CONFIRMED`; `OS-2`/`OS-3` kernel controls GREEN | `network-destination: unsupported`; `OS-2`/`OS-3` assert the FAIL-CLOSED refusal (`IO_POLICY_UNSUPPORTED`, no plan, no payload) | **PROVEN locally / ENV-LIMITED hosted** (`FAIL-CLOSED-CONTROL`, code `NETWORK_DENY_UNPROVEN`) |
| C-fs (search face, confined spawn) | in-ceiling `grep` runs on the confined face | `SLICE-28` + `ADM-66` GREEN (`Found 1 match`, settlement `COMPLETED`) | the spawn is refused (admission `allow`, execution `failed`, settlement `FAILED`, zero spawns); the lane refusal control still GREEN | **PROVEN locally / ENV-LIMITED hosted** (`ENV-BLOCK`, `NETWORK_DENY_UNPROVEN`) |
| C-subprocess (ladder order) | the 4-rung positive ladder order | `ADM-70` GREEN on `read→write→grep→web_fetch` | runnable-rung order and DURABLE admission order GREEN; the 4-rung positive ladder not claimed | **PROVEN locally / ENV-LIMITED hosted** (`ENV-BLOCK`) |

The five env-limited arms are named, stable and printed (`UTE-VNEXT-A1-ENV-LIMITED …`, aggregated as
`DSH-TEST-DISPATCH-ENV-LIMITED count=5 proven=0 env_blocks=3 fail_closed_controls=2`); they call
`t.skip` only after their assertions, so a fail-closed regression still turns them RED. They are NOT
passes and they do not raise any row's status. Every other row of this matrix is unaffected: the
absence is in the HOST's namespace provisioning, not in the centre, the compiled lanes, or the
provider's policy code.

**Product gap or runner limit?** Runner limit. `CLONE_NEWUSER|CLONE_NEWNET` is already what the
product's launcher does; there is no realm-provisioning option that can make a kernel/container that
refuses `unshare` enforce a namespace. The probe line and the exact failure mode are committed in
`dev/agent-workflow/evidence/ute-a1/ENV-LIMITED-CAPABILITY-20261123.md`.
