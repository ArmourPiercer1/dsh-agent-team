# C — capability matrix (2026-11-21, honest per-row status)

Statuses used, and they are not interchangeable:

- **MECHANISM** — the centre-side guarantee is implemented and has passing in-process arms.
- **PRODUCT-PROVEN** — the above AND a real product assembly exercised it end to end.
- **ENV-LIMITED** — the cell's guarantee is implemented and is PROVEN on a host that offers the
  physical capability, but the measured runner does NOT offer it, so on that runner the cell is
  unproven and the only admissible evidence is the product's fail-closed refusal (round 82; see the
  round-82 section at the end of this file). ENV-LIMITED is never counted as PROVEN.
- **UNPROVEN** — nothing here should be reported as working.

### Candidate-gate coverage — round 109 (NON-REQUIRED by owner ruling; NO level moves)

`scripts/candidate-acceptance-gate.mjs` runs the four D drivers as ONE executable layer per host
(`--boots 2`, host via `TEAM_TEST_HOST`, `--hosts both` for the pair) and emits one machine verdict.
The column below is a **coverage note, not a level**: it says which driver judge executes the row in
the gate and what the latest measurement says. **No cell moves to PRODUCT-PROVEN.** A row becomes
gate-backed only when the gate is REQUIRED by branch protection AND green at the final head; **the
gate stays NON-REQUIRED by owner ruling**, so a green gate here cannot upgrade anything.

**Round 109 — the dual-host gate is `pass` on BOTH pinned hosts in one run** (HEAD `41d579119` + the
round-109 arm; measured **83 m 48 s**): rc.2 31 judges / **30 proven** / 1 known-refuted / 0
env-limited; rc.5 31 / **30** / 1 / 0; totals **62 / 60 / 2 / 0**. The only non-PROVEN verdict is the
single enumerated `d4:ask-execute-process` (counted once per host). Machine verdict
`dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T17-17-46-158Z/verdict.json`.
The workflow now triggers on `pull_request: [labeled, synchronize, reopened]` for a labelled PR (so
every candidate HEAD gets its own result) and binds the check to `github.sha`; it is still not a
layer of `ci-required` and not a branch-protection context.

| C row | candidate-gate judge(s) | rc.2 | rc.5 |
| --- | --- | --- | --- |
| C-member | `d2:stop`, `d2:remote-delivery` | PROVEN | **PROVEN** (round 108: both judges green on rc.5, 2/2 boots; round 109 dual-host gate `pass`, `d2:remote-delivery` 20/20 clauses each boot, full typed replies recorded) |
| C-tools | `d4:ask-execute`, `d4:ask-execute-2` (write only), `d4:ask-denied`, `d4:ask-stopped` | PROVEN | PROVEN |
| C-fs | `d:member-read-admitted`, `d:member-read-denied`, `d:native-read-surface`, `d:guard-facts`, `d:centre-facts` | PROVEN | PROVEN |
| C-remote | `d:remote-creation`, `d2:multi-member-concurrency`, `d2:revocation` | PROVEN | PROVEN |
| C-subprocess | `d3:persistent-subprocess`, `d4:ask-execute-process` | PROVEN / **REFUTED** (enumerated) | PROVEN / **REFUTED** (enumerated) |
| C-pty | `d4:ask-execute-process` | **REFUTED** (enumerated) | **REFUTED** (enumerated) |
| C-alpha6 | `d4:routed-wake` + its seven sub-judges (`case-created`, `router-officer`, `wake-delivered`, `officer-decides`, `ask-executes-after-review`, `duplicate-route`, `sticky-stop`) | PROVEN | PROVEN |
| C-recovery | `d3:crash-cold-recovery` | PROVEN | PROVEN |
| C-work-delivery | `d3:work-delivery` | PROVEN | PROVEN |
| C-search (Shape B) | not covered by the D gate | — | — |
| OS negative controls | not covered by the D gate | — | — |

The only non-PROVEN verdict the gate may accept is the literal enumerated
`d4:ask-execute-process` (citation `SCOPE-subprocess-ask.md` §2/§4). Round-105 verdicts (historical):
rc.2 `pass` (31 judges / 30 proven / 1 known-refuted / 0 env-limited); rc.5 `fail` (31 / 29 / 1 / 0),
because the rc.5 `d2:remote-delivery` refutation was not exempt. **Round 109 supersedes that rc.5
`fail` with `pass` — on both hosts — after the round-108 product fix below; the exemption set was not
touched.**

**Round 108 closed that refutation with a product fix, not an allowance.** rc.5 renamed the public
`subagents.drainContinuableDescendants` to `subagents.drainDescendants`; the drain seam required only
the rc.2 name, so `member.archive` aborted at `drain-descendants` with zero durable writes and the
member stayed `SETTLED` (hence the observed `code=null` on the subsequent send). The seam now resolves
either public name (`stop-drain-lane.mjs` `resolveDrainSeam`), armed by M3-6/M3-7. rc.5 re-runs:
`d` 6/6 judges and `d2` 4/4 judges PROVEN on both boots; no judge was relaxed, skipped or exempted and
no id was added to `KNOWN_REFUTED`. The rc.5 column of the candidate gate is green (round 108 on
rc.5; round 109 on both hosts in one run — see `D-ACCEPTANCE-REPORT.md` and
`round109/README.md` for the exact verdict lines).

This worktree **does** boot the product at this HEAD (measured rounds 58–60, `D-BOOT-FEASIBILITY.md` §2/§11/
§12): the `node_modules` link resolves, `tsc` runs from the main install, and a real `dsh web` host serves a
centre-configured row. The earlier statement that the link points at a nonexistent pnpm store was true only
at the commit where it was observed and is corrected here. That changes the ENVIRONMENT fact only: no row
below is PRODUCT-PROVEN, and "boots" is not "the capability is proven".

| C row | capability | where the centre stands | status |
| --- | --- | --- | --- |
| C-tools | 15 `team_*` tools | declared centre-owned (`CENTRE_TOOL_NAMES`), admitted on authority not on a lane; `ADM-31` pins the closed list against `createTeamTools` in BOTH directions. **ROUND 56 — DRIVEN END TO END over the product's own surface** (`createTeamTools` over the real `TeamRuntime`, `TeamDomain`, `ControlService`): `ADM-89` admits all 15 in declared order on `team.control`, each with a durable authority fact (read back from disk) + execution fact + `COMPLETED` settlement and its PRODUCT body reached; `ADM-90` refuses all 15 for an unbound agent with `ADMISSION_NO_BINDING`, zero bodies/deliveries/creations, `REFUSED`/`not-started` settlements; `ADM-91` refuses an unlisted name (`team_delete_team`, `team_promote_member`) by `ADMISSION_TOOL_UNBOUND` while the same centre still admits a classified `read` on `fs.read` | MECHANISM (end-to-end in-process over the product tool surface; NO host boot). **ROUND 88 annotation: the Control half's ask→grant→EXECUTE leg had no production consumer (BL-30)** — the ask was produced and granted but refused after the grant; report §10 G2. **ROUND 95 UPDATE: that leg is now WIRED AND PROVEN LIVE FOR `write`/`writeText` ONLY** — `d4:ask-execute` is PROVEN on two agreeing booted rc.2 hosts (real durable ask → real Leader allow → one-shot consume → receipt verified → 27 real bytes on disk → `COMPLETED`), with deny and Stop negatives at `REFUSED`/`not-started` and zero bytes. This is `DEV-LIVE`, NOT PRODUCT-PROVEN, and every other tool/operation keeps R4. |
| C-member | Member lifecycle (create → archive) | tools preserved in the new assembly; `installMemberCentre` runs at the member bind, and a governed bind without `centreStatePath` is REFUSED. **ROUND 56:** `ADM-92` creates a member through `team_create_member` (real `member-activated` effect, durable row, Leader authority fact `team.control`/allow/`COMPLETED`); the member's OWN centre is installed through `installMemberExecution` at the child-session factory, and its calls are judged there (member ledger, member's `policyGeneration`) with the Leader's centre allowing the same locator the member's narrower lane denies. `ADM-93` archives through `team_archive_member` (production step ports: quiesce → settle-then-archive commits → `release-residency` disposes the member handle, which runs the centre's close): the member's pre-close fact survives, the durable row is `ARCHIVED`, and the next call is `ADMISSION_MEMBER_CLOSED` with a `REFUSED`/`not-started` settlement (transitions `ADMITTED → REFUSED`), never `UNKNOWN`; a second archive commits nothing, and the Leader's centre is unaffected  **ROUND 62 (D2 live driver, two boots, `D-BOOT-FEASIBILITY.md` §14):** a Member turn was STOPPED through the product's own public `session/cancel` RPC on the child session while it was parked at a durable `admission-ask` Control request; the centre's own `ADMISSION_STOPPED` is in the tool result and the `invocation-authority` fact, with a `REFUSED`/`not-started` settlement (no execution fact), never a completion and never `UNKNOWN`; a second Member's settlement stayed `COMPLETED` with zero stops. | MECHANISM (end-to-end in-process) + Stop DEV-LIVE (round 62; the archived member's PRODUCT ROUTE refuses earlier at the durable lifecycle gate — see "not proven") |
| C-work | work delivery (delegate → collect) | same as above: the tools are the centre's own surface, no fs/net lane applies. **ROUND 56:** `ADM-94` delegates through `team_delegate` (one synchronous unit, prompt delivered verbatim through the host work-delivery seam, `work-admitted` with `settled: true` and the member result) and collects it through `team_collect` (terminal `succeeded` entry with the same result, durable `settledSequence`); the collected work's own member calls are judged by THAT member's centre — its ledger, its generation, its lane (member `LANE_DENY` where the Leader allows) — and never appear in the Leader's ledger. `ADM-95` (negative) shows a refused delegation (`ADMISSION_NO_BINDING`) delivers nothing, admits no work unit and commits no lifecycle transition, and that the following collect is a zero-write read returning `unavailable` for that token. **ROUND 63 (D3 live driver, two boots, §15 / `d3/README.md`):** PROVEN on a real host boot — `team_delegate` admitted (`effect.kind=member-activated`, real instance/child session), the prompt delivered VERBATIM as the Member's first user message, the Member's final text and the collected `memberResult.body` both exactly `DBOOT_D3_DELIVERED_UNIT_ALPHA`, the collect entry terminal (`succeeded`, admitted 2 / settled 5) and BYTE-IDENTICAL when collected again AFTER a SIGKILL cold restart, the unit on disk in the team domain store, and every admission fact for the Member's calls in ITS ledger (no member call fact in any other centre ledger). | MECHANISM (in-process) + provider boundary DEV-LIVE (round 63) |
| C-fs | FS family (`read`/`write`/`edit`/`read_image`/`grep`/`glob`) | **ROUND 79:** the A1 slice's pre-dispatch Stop semantics are closed on rc.5 — `SLICE-21`/`SLICE-30`/`SLICE-37` GREEN on both hosts (see the C-member (Stop) row). SLICE-1..30 on the pinned host: native definitions remounted per member, real read/write, lane refusals, observation policy both states, search family under ASK and Stop. **ROUND 61:** a governed Member now mounts its preset's own host modules into its realm BY DEFAULT (`mountGovernedNativeToolModules`), and the live driver's admitted native `read` produced 2 provider guard `allow` facts naming the member (`D-BOOT-FEASIBILITY.md` §13, `ADM-100`…`ADM-102`)  **ROUND 62 (D2 live driver, two boots, `D-BOOT-FEASIBILITY.md` §14, `d2/README.md`):** two governed Members ran with overlapping turns, each native `read` admitted in its OWN compiled lane, guard facts naming its own identity, separate centre ledgers; A's cross-member read refused `LANE_DENY` with zero B bytes and no Provider entry. The same driver also measured the durable overlay as restriction-only: grant-deny refuses, revoke re-admits. **ROUND 71 (judge semantics):** the judge was rewritten to the contract's own four directions — (a) the durable deny refuses the previously admitted call with `ADMISSION_OVERLAY_DENY`, zero body, settlement `REFUSED`, and a fact naming the overlay (`overlayOutcome=deny`, `laneDecision=allow`) plus a `policyGeneration`; (b) removing the deny restores the call (admitted + `COMPLETED`) as a NEW fact in the same call-id family; (c) an untouched in-lane read is admitted at every phase; (d) widening beyond the compiled ceiling is REFUSED — measured, the lane answered `changed:false`/`mutation-proposal-pending` and the widened locator stayed `LANE_DENY` with zero foreign bytes. `d2:revocation` is PROVEN on two agreeing boots; the old clause that demanded the overlay WIDEN was the defect (about the judge, not the product). **ROUND 63 (D3 live driver, two boots, §15):** the search face was NOT governable by the durable overlay — an in-lane `grep` whose LANE allowed it was denied: `laneDecision=allow`, `refusalCode=ADMISSION_OVERLAY_FAULT`, reason `canonicalization failed for tool "grep": tool-unsupported`. The closed permission vocabulary is `read/read_image/write/edit` + `bash/pwsh` (`operation-permission/types.ts:59-64`, `:90-93`; `canonical-operation.ts:260-267`), so `grep`/`glob` cannot be canonicalized. **ROUND 64 (shape B, §16):** the overlay now has NO OPINION on a face outside its vocabulary (`overlayOutcome=no-opinion`) and the compiled LANE alone judges it. Re-measured live, two agreeing boots: the in-lane `grep` is ADMITTED and RUNS (`decision=allow`, `overlayOutcome=no-opinion`, a real match at `team-b/corpus/huge-7.txt`, execution fact `completed`), while an out-of-lane `grep` is `LANE_DENY`. The search face is therefore LANE-GOVERNED ONLY: a durable overlay rule cannot restrict it. **ROUND 98 (owner ruling `docs/reviews/20261124-0151.txt` §Search): Shape B is the DECLARED SUPPORT LEVEL for this generation and is NOT full dynamic permission governance** — a durable Overlay deny aimed at ordinary file reads does NOT automatically deny `grep`/`glob`; the Overlay returns `no-opinion` for tools outside its vocabulary. The required negative control is now MEASURED over the REAL search tool paths: `SLICE-39` allows a parent and DENIES a child, and the recursive `grep` returns no match and no child byte because the confined subprocess face refuses the inexpressible lane before any process exists (`PATH_NESTED_DENY_UNEXPRESSIBLE`) — the dangerous scope is FORBIDDEN, not filtered, and not merely root-checked. | MECHANISM (in-process, pinned host) + provider boundary DEV-LIVE (rounds 61–64); search face ADMITTED lane-only live (round 64) and the parent-allow/child-deny negative control GREEN (`SLICE-39`, round 98); **ROUND 77: the rc.5 FS additions (`patchText`/`deleteFile`/`moveFile`) are confined too — SLICE-35 GREEN on rc.5 AND rc.2, `ADM-135`…`ADM-140`; still MECHANISM, not PRODUCT-PROVEN (no booted `apply_patch`/delete/move). See the round 77 section at the end of this file**  *(Round 88, `bl-30-ask-consumer/README.md`)* The `ask` disposition of a compiled lane is still a REFUSAL at every Provider plane (`IO_ASK_REQUIRES_APPROVAL`), and the round-88 measurement shows why the designed consumer cannot be wired as a wiring change: `resolveAskClassCall` is satisfied only by a **guarded** durable allow, while the only production ask producer (the centre's admission lane) writes `executionCoupling: 'inline'`, which `guardOperation` refuses **by design** (`no-request`; `control/service.ts:4155-4165`, `:4289`), and the one-shot grant is already SPENT by the host tool guard before the body reaches the Provider (`admission-port.mjs:770-784`). Two arms now pin that boundary (`a5sf-approval-takeover.test.ts`: guarded = consumed once, inline = `no-request`/`APPROVAL_DENIED`/0 consumptions). **No product byte changed**; a lawful fix is an owner decision between flipping the coupling (breaks the Stop-cancels-the-ask law, `ADM-57`) and giving the OS plane a read port onto the centre's already-enforced decision. |
| C-web | Web family (`web_fetch`) | SLICE-31/32: positive through the confined web face, negative with the transport never called | MECHANISM (in-process, pinned host) |
| C-subprocess | Subprocess family (`bash`) | **ROUND 75 — ADMITTED ON A COMPILED EXECUTION AUTHORIZATION, NOT ON A PATH LANE** (owner ruling `docs/reviews/20261122-1536.txt` §1). The centre's `process.exec` branch reads `toolBindings[].authorization` (allow/ask/deny) + `execution.executionBoundary` from the compiled per-tool answer and the composition's executor-readiness fact (`admission.ts` process branch); the cwd is recorded as context and never consulted; `Binding.process`/`io.process` do not exist. Fitness check: the v4 grammar ALREADY carried both fields (`blueprint-v4.ts:193-204`) and the projection chain had been dropping them — carriage, not declaration (see `CONTRACT-CHANGE-REQUEST-process-lane.md`, now RESOLVED/superseded). Arms `ADM-125` (allow ⇒ runs + fact + COMPLETED), `ADM-126` (deny ⇒ `ADMISSION_EXECUTION_DENIED`, body never runs), `ADM-127` (ask ⇒ durable Control approval, then the body; a denied approval refuses — **in-process only: round 88 shows the production ask is `inline`, so after the grant the call is still refused with `IO_ASK_REQUIRES_APPROVAL`; the in-process arm does not survive into a product path — BL-30, report §10 G2**), `ADM-128` (`ADMISSION_EXECUTOR_UNAVAILABLE` when the declared boundary has no READY executor; `trusted-host` vs `confined-subprocess` are different executors), `ADM-129` (an in-lane `grep` is admitted although the same binding's `bash` is DENIED), `ADM-130` (the OS profile the executor applies is compiled from the three lanes and an ask/dangerous lane is refused rather than widened). SLICE-33 now admits the shell under the compiled authorization and proves the PTY face's OWN fence still refuses an unregistered owner (`OWNER_NOT_LIVE`). **ROUND 76 LIVE (D3, `--boots 2`, DEV-LIVE, two agreeing boots):** `d3:persistent-subprocess` is **PROVEN** — the governed preset mounts the HOST's `dsh-tool-bash-persistent` (`backendType: a5sf-governed-shell`) beside the one-shot baseline, the world declares `toolBindings[]` for `bash` (`authorization: allow`, `executionBoundary: confined-subprocess`), the first call is admitted on `process.exec` and writes durable shell state, and a SECOND turn reuses the SAME shell and reads it back; the out-of-lane write is refused by the OS profile (`Read-only file system`, 0 bytes on disk) while the in-lane file is written. Round 75's REFUTED measurement is kept in **MEASURED (round 75)** as history. **ROUND 99 — THE ASK LEG IS NOW CONSUMED ON THE PROCESS FACE:** the `process-exec` receipt is verified at the governed spawn point BEFORE any process exists (`subprocess.ts` `spawn`'s shell-invocation branch, before the provider call), bound to the tool + compiled `executionBoundary` + `implementationOrigin` + the composition's fixed shell class + the exact `commandSha256`; `ADM-174` (positive chain), `ADM-175` (cross-execution/cross-face/reuse), `ADM-176` (no widening: out-of-lane write refused by the OS, request `allowPaths` byte-identical to the lane-compiled profile), `ADM-177` (an ask receipt grants NO escalation: `danger-full-access` still clamps to `workspace-write`, a pure-ask lane stays `read-only`), `ADM-178` (deny wins before any receipt; revocation), `ADM-179` (command mismatch refused pre-spawn; post-spawn kernel denial settles by the real phase). Live: `d4:ask-execute-process` (row below). **SCOPE (2026-11-24, APPROVED BY OWNER, review `20261124-2120` ruling 1):** this generation promises **`allow`/`deny` only** for Subprocess/PTY; per-call `ask` for process execution is **UNSUPPORTED BY PRODUCT RULING** and remains fail-closed (the refusal below is the promise, not a pending fix; the same class as PTC, `ADR-ptc-unsupported.md`). The R3 receipt is not extended to the process face as a live promise. Wording + future preconditions: `SCOPE-subprocess-ask.md`. | MECHANISM (allow/deny/ask/executor arms in-process) + **DEV-LIVE PROVEN** persistent confined shell (round 76, two agreeing boots) + **DEV-LIVE PROCESS ASK CHAIN (round 99)**; no gated status, no real-model interleaving |
| C-pty | PTY family | same authority as C-subprocess: the governed realm installs the PTY face and declares `availableFaces.process`, so a `confined-subprocess` declaration has a ready executor; the face itself still refuses an unregistered owner (`SLICE-33`). **ROUND 76: the persistent-session positive control is PROVEN live** — two turns share one PTY shell under the OS profile (`d3:persistent-subprocess`, two agreeing boots). **ROUND 99: the PTY face verifies the SAME `process-exec` receipt before `raw.spawn` creates any process** (`terminal-pty.ts`: `PTY_PROCESS_DENIED` for a compiled `deny`, `PTY_PROCESS_RECEIPT_REFUSED` when the ask receipt does not cover this spawn). Its spawn point has no command text yet (the shell precedes it), so the PTY verifies everything EXCEPT `commandSha256`; the confined subprocess face verifies that too. `narrowSandboxPolicy` is untouched — a `danger-full-access` base still clamps to at most `workspace-write`, and a pure-ask lane stays `read-only` (`ADM-177`). **SCOPE (2026-11-24, APPROVED BY OWNER, review `20261124-2120` ruling 1):** the PTY face is covered by the same promise as C-subprocess — **`allow`/`deny` only**; per-call `ask` for process execution is **UNSUPPORTED BY PRODUCT RULING** and remains fail-closed (`SCOPE-subprocess-ask.md`). | MECHANISM + **DEV-LIVE PROVEN** (round 76, D3) + **DEV-LIVE PROCESS ASK CHAIN (round 99)** |
| C-ptc | PTC escalation | **UNSUPPORTED BY RULING — NOT SUPPORTED THIS GENERATION.** Owner ruling `docs/reviews/20261124-0151.txt` §PTC (2026-11-24), recorded as the amendment `ADR-ptc-unsupported.md` (the frozen A0 contract is CITED, never edited). A governed Member's `run_code` is refused TYPED before the body with its own code `ADMISSION_PTC_UNAVAILABLE` (`admission.ts` PTC branch; `host-surface-refusal.mjs` `ptc` row), is never offered in the shipped presentation's model-visible set (`tools.schemas`), and an accidental call through the host-RETAINED entry is still a typed refusal with ZERO worker start, zero confinement call and zero effect. BOTH durable surfaces carry the distinct status `unsupported-by-product-ruling` (invocation-authority + execution facts as a FIELD, and the settlement `terminalReason`), which is deliberately NOT "missing provider" and NOT "misconfigured". The ruling is a RULED SCOPE REDUCTION, not a deleted test: the two PTC POSITIVE arms are `NOT APPLICABLE — PRODUCT UNSUPPORTED` with a machine-visible marker (`ADM-69` B-ladder rung 6, `ADM-147` declared-world), each asserted by a companion marker arm (`ADM-80`, `ADM-148`) so neither can become a silent skip; the refusal negative controls are KEPT and strengthened (`ADM-76` out-of-lane, `ADM-79` retained entry on the real composition, `ADM-87` one centre, plus the declared-world probe in `ADM-147`). The measured basis is unchanged (round 85 `PTC-FOUR-PART-FINDING.md`; rc.5 correction: rc.5 resolves the worker policy from `sandboxPolicy.resolve({session})` and `additionalWritableRoots` only adds WRITABLE roots, so the Member's independent read/write/deny subtrees still cannot be expressed — `danger-full-access` skips confinement). DSH host PTC is NOT modified or deleted (host smokes untouched); native bash / persistent bash / PTY / Control / Stop are untouched. NOT PROVEN: nothing is claimed for a governed PTC run — PTC is verified ONLY as `run_code → typed refusal → zero worker execution → REFUSED/not-started`, and a future upstream per-execution policy seam is the documented revisit path | MECHANISM: ruled unsupported, typed refusal + status + zero worker proven; no positive claimed
| C-remote | Remote | *(Round 86 audit: an earlier version of this cell opened with "refused on a centre row" and listed `member.create`/`member.send`/`member.followup` as refused — that was the round-55 state, superseded twice; this cell is the current one.)* **RESTORED AS A GOVERNED MANAGEMENT CONTROL PLANE (round 74)**, per owner ruling `docs/reviews/20261122-1536.txt` §3. A centre-configured row BUILDS and INSTALLS the S6 plane again (`root.ts` → `createS6RemoteSurfaces`, `host.ts` mounts the `installed` seam); `POST /team-remote/team.create` mints a Team at runtime through the existing `createAndStartTeam()` + Principal + TeamDomain/Control gates. Commands are classified by ACTUAL EFFECT in ONE closed table (`s6-command-classification.ts`): control-plane read/creation/management commands are served; commands whose effect is agent-tool execution — `team.admitInitialWork`, `team.ensureRootLive`, `member.create`, `member.send`, `member.followup` — are REFUSED before params/ports with the existing `ADMISSION_REMOTE_UNAVAILABLE` on `team.control`, with a durable invocation-authority fact and a `REFUSED`/`not-started` settlement. An unclassified/missing command is NOT default-allowed (`isS6ControlPlaneCommand` false; the table↔catalog equality is pinned both ways). `ADM-86` drives the governed dispatcher (serves `catalog.list` and the delivery handovers, refuses the two root commands, unauthenticated context refused before the guard); E3 (`a3p4-pr4-production-entry-regression.test.ts`) proves `installed===true`, a served control read, the two root refusals with facts on the row's own ledger, AND — at the production port — that `member.followup` asks the facade for the `execution: 'async'` delivery receipt while `member.create` is the creation-only action. **ROUND 83 — THE PLANE MAY DELIVER WORK; IT MAY NEVER EXECUTE A TOOL.** A third effect class `work-delivery` (`S6_WORK_DELIVERY_COMMANDS = member.create/member.followup/member.send`) is served as a HANDOVER into the Member's own governed path: `member.create` = the ONE activation authority (creation only, no work chain); `member.send` = the messaging coordinator's durable intent + input ACCEPTANCE + confirmation (the acknowledgement is the outcome; it never awaits the turn); `member.followup` = the work facade with `execution: 'async'` (durable `team-work-admitted` receipt; Phase B/C run DETACHED inside the Team runtime). `team.admitInitialWork` and `team.ensureRootLive` STAY REFUSED: their only seams await the root turn / start an executor with no delivery acknowledgement, so neither can be expressed as a delivery (the refusal reason says exactly that, and stays under the 512-char settlement cap). **LIVE (D2, `--boots 2`, DEV-LIVE, two agreeing boots): `d2:remote-delivery` PROVEN** — the operator's `member.send` answered HTTP 200 with the coordinator's `delivered` acknowledgement (intent seq 39 / confirmation 40) and, AT that acknowledgement, ZERO admission facts and ZERO execution facts for the Member's call; the delivered prompt then ran in Member B's OWN turn and the centre wrote its `allow` (`fs.read`, B's `instanceId`+`agentId`, B's in-lane locator) into B's OWN `<instanceId>.facts.jsonl` AFTER the ack, with a `completed` execution and the file's bytes in the transcript; error paths measured on the same row: unknown member → `TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED`, archived member → `TEAM_RUNTIME_WORK_STATE_REJECTED` (both typed, zero provider requests), duplicate send → a SECOND durable coordination (at-least-once; no replay, no operator-side execution), restore → delivery served again, and Stop during a DELIVERED turn → `ADMISSION_STOPPED`, `REFUSED`/`not-started`, never a completion. The plane structurally has NO tool/provider port; the delivery ACK carries no tool result. LIMIT: a per-DSH_HOME authenticated operator (Connection Gate), NOT multi-user RBAC; `team.admitInitialWork`/`team.ensureRootLive` remain SERVED-NOWHERE through this plane. | MECHANISM (closed classification + delivery law) + in-process production-root arm + **live host boot, delivery boundary DEV-LIVE PROVEN (round 83)** |
| C-mcp | MCP | judged on the NETWORK axis with the SERVER as the locator (`net.mcp`, `ADM-33`): unset is not allow, deny is deny, a tool-level restriction narrows it, and a `mcp__` name with no server is refused as malformed rather than matched by prefix. WHICH servers exist stays the mount gate's decision. **ROUND 57 — A REAL MOUNT NOW REACHES THE CENTRE.** `ADM-96` starts the product's own mini-MCP server (real HTTP, `packages/runtime/root-binding/harness/mini-mcp.mjs`), computes the mount target with the product's `configuredMcpServers` → `filterMcpServers`, mounts it with the EXACT production call (`mcpClient.apply(ctx, <the seven-field streamable-http literal `reconcileMcpSet` passes>)` — the same call `mcpMountCtx.plugin(mcpClient, …)` makes), reads `mcp__p5t5mini__ping` off the resulting model-visible surface, and the ONE centre admits it on `net.mcp`/locator `p5t5mini`, records the fact (read back from disk), settles `ADMITTED → RUNNING → COMPLETED`, and the REAL server body answers `pong:mounted`. `ADM-97` (negatives): the same MOUNTED tool is `NETWORK_DENY` when the compiled TOOL-level answer denies it and `NETWORK_DENY` when the ceiling denies — zero body, `REFUSED` settlement in both (mounting is not permission) — while the other tool of that server still runs; `mcp__` and `mcp__<server>` are `ADMISSION_TOOL_UNBOUND` (no prefix matching); a configured-but-ungranted server is excluded by the mount gate and contributes NO name to the surface. **LIMIT, UNPROVEN at the centre:** the centre is NOT mount-aware — its binding is installed at the member bind (`agent-bindings.mjs:2006`) while `mcpMountTarget` is computed later per boundary (`agent-bindings.mjs:2241`), and `admission.ts:78-120` has no mount input — so a WELL-FORMED name for a never-mounted server is decided on the network axis alone (pinned by `ADM-97` step 5). The product excludes such a call at the TOOL REGISTRY, not at admission | MECHANISM (real mount → real body → ONE centre; NO host boot); centre-side unmounted-server refusal UNPROVEN |
| C-alpha6 | Alpha.6 review routing | *(Round 86 audit: this cell opened with "EXPLICITLY UNAVAILABLE (b)", the round-55/68 state. **Round 84 implemented the formal routing** — no new axis; a coherent row is admitted and each incoherent piece is refused and recorded. The live routed wake is the remaining gap. The round-55 text below is kept as history.)* **EXPLICITLY UNAVAILABLE (b)** — the opt-in is refused with its own code `ADMISSION_ALPHA6_UNAVAILABLE`, in TWO independent gates that name the same missing axis: the pure config rule (`centre-config.ts:73`, `ADM-34`) and, for a row that builds the root directly on a centre-configured row, a recorded refusal on `host.service` (`root.ts:2508`) followed by a typed boot refusal — no review wake is dispatched. Review routing decides who may review whom before any tool call, so the centre has no lane or locator for it, and the previous "needs a centreStatePath" shape bought a durable store outside the centre, not centre adjudication. `ADM-85` proves the recorded refusal + settlement REFUSED/not-started + zero wakes, with an ungoverned positive control. **ROUND 57 — the refusal is UNCONDITIONAL, and the machinery behind it is measured, not assumed.** `ADM-99` proves the config rule refuses the opt-in on EVERY row, including one with no `centreStatePath` (`centre-config.ts:73`; `host.ts:738` is the only production enforcement point) — so there is NO product-config path on which Alpha.6 is reachable at all, which is stronger than "a centre-configured row is refused". `ADM-98` proves the missing piece is NOT the Alpha.6 machinery: composed directly, `createAlpha6RootWiring` composes `mode:'alpha6'`, the ONE shared `createAlpha6RootRouter` takes a real decision off a durable control row (`route.kind='recipient'`, Officer, `routeRole='officer'`), and the real `dispatchLatch` + `createFileWakeIntentDirectory` persist a row that, re-read from disk through a FRESH directory object, names exactly the routed reviewer. **The missing seam is the CENTRE JOIN:** no axis/family in `admission.ts` (`TOOL_AXES`/`CENTRE_TOOL_NAMES`/`HOST_CAPABILITY_TOOL_NAMES`, `admission.ts:32`, `:57`, `:114`) can name a review-routing decision, so `ADM-99` drives one at the centre and gets `ADMISSION_TOOL_UNBOUND` with the fact recorded on the FALLBACK axis `fs.read` — a fabricated-axis record, not a review verdict. **The two lawful shapes:** (A) add a compiled review-routing axis to the member contract (the v4 ceiling is frozen → contract change) so the ONE centre judges the decision before the wake; or (B) rule that a record-only approval fact on the existing `host.service` axis IS adjudication and wire the PA approval-fact join (still UNPROVEN below). Neither is wiring-only, so the row stays explicit unavailability. NOT PROVEN: the PA approval-fact join. **ROUND 63 (D3 live driver, two boots, §15 / `d3/README.md`):** the typed refusal was measured on a REAL host boot with `alpha6ReviewRouting: true` — the host PROCESS boots and the ROW is refused inside plugin bootstrap (`ADMISSION_ALPHA6_UNAVAILABLE … no review-routing axis exists`, `centre-config.ts:73` at `host.ts:738`), with NOTHING live (no team root: `/__p6t6/state` 404, `liveMembers=0`, no decision, no wake-intent file, no fact file). The RECORDED-FACT writer (`createHostSurfaceRefusalPoint`) was unreachable at that entry because the gate ran before root construction — an honest limit of the host path, not a driver choice. **ROUND 68 (shape A, D3 live driver re-run, two boots) — the recorded-fact half is now REACHED at the same entry, and the refusal is unchanged.** `host.ts` passes `createAlpha6RowRefusalHook` (`vnext/row-refusal-entry.ts`) to `validateTeamPluginConfig`; the hook runs at the exact centre rule, BEFORE the unchanged typed throw, builds the product's own `createHostSurfaceRefusalPoint` (`host-surface-refusal.mjs`) through the shared constructor `createCentreHostSurfacePoint` (the same one `root.ts` uses), and writes the invocation-authority fact (`decision=deny`, `refusalCode=ADMISSION_ALPHA6_UNAVAILABLE`, axis `host.service`, `toolName=alpha6.review-routing`) plus the settlement (`REFUSED`, `dispatch`/`bodyOutcome` `not-started`, transitions `ADMITTED→REFUSED`). Measured live in BOTH boots: `refusalFactCount=1`, `refusalSettlement.state=REFUSED`, while the row is still refused with the same code and the host still boots with NOTHING live (`/__p6t6/state` 404, `liveMembers=0`, no decision, no wake-intent file). `no-silent-route` stays PROVEN: the probe now evaluates it as "no ROUTE-claiming fact" (`nonRefusalFactCount=0`), so a recorded refusal cannot be laundered into a silent route. New arms: `ADM-116` (refused AND recorded, fact + settlement read back from disk), `ADM-117` (positive control: a row without the opt-in validates/binds and writes nothing), `ADM-118` (covered-face fault elsewhere untouched: the shared point still records `remote`; a non-Alpha.6 centre violation writes nothing). **ROUND 84 — THE FORMAL ROUTING IS IMPLEMENTED; THE ROW IS NO LONGER UNCONDITIONALLY REFUSED.** The determination is recorded BEFORE the code (`ALPHA6-FORMAL-ROUTING.md`): three pieces were missing and **there is no `CORE_SEAM_BLOCKER`**. (1) ROUTING AXIS — none is lawful and none is needed: a routing decision executes nothing, so giving it a member I/O axis would be a fabricated record (`ADM-99` had already measured `ADMISSION_TOOL_UNBOUND` on the fallback `fs.read`); the decision stays a projection of the durable control row through the ONE shared policy (`review-router/router.ts:90`), measured by `ADM-142`. (2) WAKE — the old `deliverReviewWake` resolved the live agent and wrote a hand-built message, skipping everything P6-T3 built for `member.send`. It is now a governed DELIVERY (`vnext/review-wake-delivery.mjs`): durable `team-review-wake-routed` intent → `SessionInputPort.submitAttributedInput` (requirement verdict + machine attribution + inbox acceptance) → `team-review-wake-delivered` confirmation, in the SAME TeamDomain ledger with the SAME correlation token; `agent-bindings.mjs:4218` delegates to it and REFUSES to invent a recipient (no Member row / no bound child session ⇒ typed refusal before any write). (3) ENABLEMENT — `centre-config.ts#alpha6EnablementRefusal` admits a COHERENT row (authored v5 `reviewRouting.enabled === true`, non-empty `centreStatePath`, ABSOLUTE `alpha6WakeIntentPath`) and refuses each incoherent one with its OWN typed piece code (`ADMISSION_ALPHA6_ROUTING_REQUIRED` / `_CENTRE_REQUIRED` / `_WAKE_INTENT_PATH_REQUIRED`) under the unchanged `ADMISSION_ALPHA6_UNAVAILABLE` prefix, so `row-refusal-entry.ts` still records the refusal as a fact + `REFUSED`/`not-started` settlement. The Officer's approval and every tool it then calls are admitted by the ONE centre under the OFFICER's OWN binding (`ADM-144`: `team_resolve_control`, axis `team.control`; an unbound caller is `ADMISSION_NO_BINDING`). The management plane still DELIVERS and never executes (`ADM-143` measures zero tool executions during a wake). Stop is unchanged: the delivered wake is a MACHINE input, so it can never clear a human Sticky Stop (A56 predicate asserted in `ADM-143`/`a6-pr4-review-wake-glue`). **Arms:** `ADM-141` (positive enablement + each piece refused AND recorded), `ADM-142` (officer route, nothing executed), `ADM-143` (intent + confirmation + machine attribution + zero executions), `ADM-144` (Officer's own call admitted under its binding), `ADM-146` (duplicate ⇒ ONE confirmation; unknown recipient ⇒ typed refusal with zero facts), `a6-pr4-review-wake-glue` (real glue: one attributed inbox input + facts read back), `a6-pr7-merged-wake-host` (three asks ⇒ ONE inbox input), `a6-root-wiring` (a PRODUCTION root boots a coherent Alpha.6 row and merges three real transport rows into one wake). The REFUSAL path is kept green: `ADM-34`, `ADM-85`, `ADM-99`, `ADM-116…118` still prove denial + typed code + recorded fact + REFUSED settlement + zero wakes for an INCOHERENT row, and the D3 live driver's `alpha6` arm still measures the row refusal on a real host. **NOT PROVEN:** a LIVE host run of the ROUTED wake — the D3 world's blueprint is v4 with a single worker member and no Officer/approval case, so it can express only the refusal side, and no mock-model path resolves a control. The level stays MECHANISM; the live side remains the refusal shape (rounds 63/68). **ROUND 87 — THE LIVE ANSWER, AND A PRECISE BLOCKER (D4 probe, two agreeing DEV-LIVE boots, rc.2 `639ed015…`, HEAD `775be06d7`; `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md`).** The v5 world the task asked for IS expressible and was booted: `d4:enablement` **PROVEN** (coherent row admitted — `alpha6EnablementRefusal` returns `undefined`, host + TeamSession served, zero refusal facts), `d4:officer-up` **PROVEN** (Officer RUNNING instance with its own running child session), `d4:officer-binding` **PROVEN** (the Officer's OWN call admitted under ITS binding: 1 allow fact for its callId, settlement `ADMITTED→RUNNING→COMPLETED`), `d4:refusal` **PROVEN** (the same v5 doc without `reviewRouting` still refused by name, recorded, `REFUSED`, zero wakes). `d4:routed-wake` is **REFUTED by the product itself**: the worker's authored `ask` lane creates a real durable `leader-approval` row that carries **no `approvalCaseId` / `legOrdinal` / `reviewAuthority`**; the product's own `createAlpha6RootRouter.route()` answers `null` for it (`memberListCalls: 0`); **zero** `team-review-wake-routed` / `team-review-wake-delivered` facts, **zero** wake-intent files, the Officer is never woken, and the **Leader** receives the plain C1 ask (`[team-control … waiting for Leader approval`). TWO Team-side seams are missing and **neither is a `CORE_SEAM_BLOCKER`**: (1) **no live producer of a case-bearing ordinary ask** — `route()` needs the case identity (`alpha6/root-router.ts:209`), the case-less notifier branch wakes the Leader by design (`alpha6/notifier.ts:159-169`), the only live leg producer `requestApprovalLeg` (`control/service.ts:5607`) is called solely by the envelope-mutation lane (`governance/service.ts:1016`, excluded by `isDelegableOrdinaryToolAsk`, `review-router/policy.ts:68`), both ordinary-ask producers are case-less by construction (`src/plugin/vnext/admission-port.mjs:155-165`; `packages/tools/src/tools.ts:973-1000`), and the lane that minted ordinary legs was deleted by the A1 cut (`1617d5839` — its survivors are pure/test-only or consumption-only, `root.ts:3268`; `a4p7-live-descendant-authority.test.ts:579` states it in the repo's own words); minimal lawful fix = open the admission ask through the case-forming call with the identity Alpha.6 already requires (the "Alpha.6-aware ask lane" the J06 comment at `root-router.ts:212-216` anticipates), no new axis. (2) **no consumer for an `ask`-disposition call even after an allow** — the centre refused the granted call verbatim: "has the disposition 'ask', but this admission plane has no approval consumer (`resolveAskClassCall` has no production caller); refusing rather than auto-approving" (`member-io-policy/src/provider-capabilities.ts:315`, comment `:200-205` names **BL-30**; backlog `:559` BL-30 READY, `:562` BL-33's consumption half blocked on it). Duplicate-route and machine-wake-vs-Sticky-Stop stay unreachable with it (in-process `ADM-143`/`ADM-146` unchanged). No leg was fabricated, no control route was added to the harness, no wake file was written by the driver. | MECHANISM (formal routing implemented and proven over the real ports, including a production-root boot) + live host refusal/recorded-refusal DEV-LIVE (rounds 63/68) + **round-87 live: coherent enablement / Officer instance / Officer binding / refusal all PROVEN; the ROUTED wake REFUTED by the product's own router on the product's own case-less row**; live ROUTED wake still UNPROVEN — blocked on the two Team-side seams above (an Alpha.6-aware ask lane + BL-30), never on an upstream seam  **ROUND 97 (2026-11-24) — LEVEL: DEV-LIVE.** The live ROUTED wake is PROVEN end to end on two agreeing DEV-LIVE boots: a qualifying worker ask opened a real durable case, the product router selected the unique lawful Officer (self-ask still refused), the governed wake reached the Officer's own session with machine attribution and zero management-plane tool executions, the Officer settled the case under its own binding, and the worker's granted `write` executed AFTER the decision. Duplicate-route (one wake) and the human Sticky Stop outranking a machine wake were both measured live. See the ROUND 97 annotation at the end of this file; the level can be at most DEV-LIVE because no executable gate binds this row (PRODUCT-PROVEN needs `V@B=yes`). |
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

## DECIDED (round 98): realm-less admission = OPTION B — a governed member with no confined provider is REFUSED

**Owner ruling `docs/reviews/20261124-0151.txt` §Realmless (2026-11-24): OPTION B.** A governed Team
Member with NO enforceable confined provider is REFUSED, because an admission ALLOW taken against the
compiled ceiling cannot claim the access bound when the provider that executes the call is not itself
bound by that ceiling. The refusal is typed and stable: `MEMBER_CENTRE_UNWIRED` (kept — the accurate
alternative `ADMISSION_PROVIDER_UNCONFINED` was allowed by the ruling, but the existing code is the
identifier ADM-44, the D report and the escalation already use and is not part of the closed
`AdmissionRefusalCode`/`HOST_SURFACE_REFUSALS` tables; renaming would buy wording, not enforcement. The
reason prose states the accurate semantics).

**Round 98 closes the placement hole.** The round-35 check ran BEFORE the mount attempt and only asked
"did the row declare a realm source?"; a row that DID declare a source but whose provider compiled no
realm for this template (`compiledFor → undefined`, a v4 template outside `memberIoCeilings`) slipped
past it and ran unmediated. `memberAdmissionGate` (`centre-config.ts`) now runs on the MOUNT RESULT
after `mountMemberA5sfRealm`, refuses before `installMemberExecution`, the preset mount, the deny lane
and every tool body, and reports `{ mode, uteProtected }`.

**The ungoverned path is labelled, not implied.** A row that never configured `centreStatePath` keeps
DSH's own permission model, but the bindings REPORT it as `mode: 'ungoverned'`, `uteProtected: false`
(`admissionModeOf(sessionId)`, plus one `UTE-GOVERNANCE ungoverned` observation) — it is never reported
as UTE-protected.

**Arms:** `ADM-44` (the pure rule) and `ADM-44b` (gate on the mount result: governed+unconfined ⇒ typed
refusal + zero files written; governed+realm ⇒ `uteProtected: true`; ungoverned ⇒ allowed, reported
ungoverned/`uteProtected: false`; source-placement pin that the gate reads the MOUNT RESULT and runs
before the preset/tool surface). NOT PROVEN: a boot-level arm driving a live AgentSetup refusal (the
gate is proven in-process and the placement by a source-order pin).

## CLOSED (round 98): the centre is installed only for a mounted realm, and a governed member without one is refused

The centre composition still lives behind a mounted realm (`installMemberExecution` is inside
`if (a5sfRealm !== undefined)`), and that is now the ENFORCED contract rather than a shape a row can fall
through: after the mount attempt, `memberAdmissionGate` refuses a governed member whose realm did not
mount (the round-98 placement fix) with `MEMBER_CENTRE_UNWIRED` — so a row that asked for governance has
no unmediated call to make, and a row that never asked is explicitly reported `ungoverned`
(`uteProtected: false`), not counted as protected. Round 49 rebuilt E3's world to mount a declared
realm, so E3 no longer observes zero legs. A per-tool binding that targets the SEARCH module is refused
at composition because a binding realm owns no confined `subprocess` face (BL-17), so a narrower
per-tool search lane cannot become an enforced-looking-but-unenforced traversal.

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
| PTC escalation | `ADMISSION_PTC_UNAVAILABLE` | `process.exec` | `admission.ts` PTC branch (the ONE centre, before the body) | `ADM-87`, `ADM-88`; **round 92: NOT SUPPORTED BY PRODUCT RULING** — status `unsupported-by-product-ruling`, retained-entry arm `ADM-79`, `ADR-ptc-unsupported.md` |

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

**Residual, not hidden (ROUND 98 restatement):** the search face is governed by the LANE only. A durable
overlay rule cannot deny `grep`/`glob` (or `web_fetch`, …), because those faces are outside the overlay's
vocabulary; the lane ceiling is their entire governance. **Shape B is the DECLARED SUPPORT LEVEL for this
generation and is NOT full dynamic permission governance.** Full cross-tool dynamic revocation is Shape A's
scope (a search face with a subtree resource in the closed vocabulary), not a capability Shape B delivers.

## MEASURED (round 98): the parent-allow / child-deny recursive search negative control (Shape B)

Owner ruling `docs/reviews/20261124-0151.txt` §Search requires one negative control: "allow a parent
directory but DENY a child, and prove a recursive search does not read or return the protected child's
contents. If the current Provider/OS limits cannot guarantee that, forbid that dangerous search scope or
escalate to Shape A — do NOT merely check the root path passed to `grep`."

**Result: the dangerous scope is FORBIDDEN, over the REAL search tool paths — `SLICE-39` GREEN.**
`grep`/`glob` execute the packaged ripgrep through the Member realm's confined `subprocess` face, and that
face compiles the effective lane ONCE with `compileExecutionProfile`. Landlock is additive (no negative
rules), so a deny NESTED inside an allowed subtree is INEXPRESSIBLE
(`PATH_NESTED_DENY_UNEXPRESSIBLE`); `createConfinedSubprocessClass` remembers the refusal and every spawn
from that realm is refused before a process exists. The arm's pair:

| arm | world | measured |
| --- | --- | --- |
| POSITIVE CONTROL | parent allowed, NO child deny, real `grep`, real confined provider | the child's token is RETURNED (`secret.txt` match) — so the child really is reachable without the deny |
| NEGATIVE | same parent allowed, child DENIED | `grep` result is an error, **no token and not even the child path appears**, error is the launch refusal (`ripgrep launch failed`); the centre fact is `decision=allow` for the ROOT and the execution fact is `failed`; the protected file is unchanged |

The centre judges the ROOT (that is Shape B), and the PROVIDER refuses the inexpressible traversal — the
control cannot pass by only checking the root path. This is not per-file carving; a lane the OS cannot
express is refused wholesale for that realm (a shell on the same realm is refused too). Shape A remains the
only shape that can express a nested deny precisely.

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
| C-fs (search) | search-root bound; omitted path = workspace root; a nested deny forbids the whole confined search scope rather than being filtered | `admission.ts:35-36`, `:145-149`; overlay abstains (`overlay-decision.mjs:226-228`); `team-services/src/subprocess.ts` (`SUBPROCESS_PROFILE_REFUSED`), `team-sandbox/src/profile.ts` (`PATH_NESTED_DENY_UNEXPRESSIBLE`) | `ADM-110`, `ADM-16`, `ADM-105/106`, **`SLICE-39` (round 98)** |
| C-web | network allow/deny; no fs grant stands in | centre `admission.ts:349-357`; provider `team-services/src/web.ts` | `ADM-111` |
| C-subprocess | no unconfined shell; fail-closed when no `toolBindings[]` authorization; a declared boundary needs a READY executor | `admission.ts:409-452` (`ADMISSION_EXECUTION_UNAUTHORIZED`/`_DENIED`/`ADMISSION_EXECUTOR_UNAVAILABLE`), `:405-407` (PTC, narrowed round 85 to the worker OS-profile seam); OS profile `team-services/src/subprocess.ts:1372` | `ADM-114`, `ADM-125`…`ADM-130`, `OS-1/2/3` |
| C-tools (Control) | one approval authority; current facts; one-shot spend | `admission-port.mjs:94,336-344,477`; `packages/runtime/control/service.ts` | `ADM-112`. *(Round 88)* the ONE approval authority's one-shot spend is the invocation binder's capability, minted per `callId` and spent at the host tool guard; a durable INLINE allow is never a guard token, so no second consumer may be added at the Provider (`bl-30-ask-consumer/README.md` §3, arms in `a5sf-approval-takeover.test.ts`). |
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
| C-subprocess / C-pty (ask) | a `bash` whose disposition is `ask`: real Control ask → real allow → consumed grant → `process-exec` receipt → spawn under the confined profile → the in-lane write lands, the out-of-lane write produces nothing, `COMPLETED` | `d4:ask-execute-process` — **REFUTED at the backend lookup (`NO_BACKEND`) before the verifier; MECHANISM proven by `ADM-174`…`ADM-179`**. The real ask→approval→grant consumption DID occur; the PTY spawn then failed with `NO_BACKEND` **before any process existed**. Zero process, zero bytes, settlement **`FAILED`** (never `REFUSED`/`not-started`). **Process Ask is `UNSUPPORTED BY PRODUCT RULING` (owner, 2026-11-24) — the same class as PTC; `SCOPE-subprocess-ask.md` (APPROVED BY OWNER)** |
| C-remote | `team.create` served; duplicate mints no root; unauthenticated refused; **round 83: `member.send` DELIVERED (acknowledgement with zero executions) and the Member's own turn admitted under its own binding; the two ROOT work commands stay refused** | `d:remote-creation` (rounds 74/83), `d2:remote-delivery` (round 83) |
| C-alpha6 | the same typed `ADMISSION_ALPHA6_UNAVAILABLE` refusal on a real rc.5 boot | `d3:alpha6` |
| ADM-100 (C-fs provider channel, in-process) | PASS on rc.5 after the world mounts `workingDirectory` + executor and uses the batch `tools.execute` shape; assertions unchanged | `TEAM_TEST_HOST=next node --test --test-name-pattern ADM-100 …` |

**Status stays what it was** (MECHANISM or DEV-LIVE, never PRODUCT-PROVEN): the
driver boots are DEV-LIVE, the model is the scripted mock, and the rest of the
238-suite vitest population was not run on rc.5. Rows NOT re-measured on rc.5:
C-web, C-mcp (live mount), C-goal, C-skill, C-fork, C-policy, and the
`apply_patch`/delete/move live face. (C-ptc is not "not re-measured" any more: round 92's owner ruling
makes PTC NOT SUPPORTED this generation — the refusal chain is measured on rc.5-shaped code and
cites `ADR-ptc-unsupported.md`, and no positive claim is made.)

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

## ROUND 89 ANNOTATION — the ask/Control rows and C-alpha6 after rounds 87/88 (no upgrades)

This is an **annotation** pass over the levels above, not a re-grade. Every cell below **stays at its
stated level or is narrowed**; nothing is upgraded, and no row becomes PRODUCT-PROVEN.

| row | what changed in the measurement | level effect |
| --- | --- | --- |
| **C-tools** (the Control plane's 15 tools) | The 15 tools still execute end to end in process (`ADM-89`). What round 88 adds is the **member `ask`** half: the only production producer writes `executionCoupling:'inline'` (`admission-port.mjs:163`), an inline allow is never a guard token (`control/service.ts:4155-4165`, `:4289-4291`), the one-shot grant is already spent at the host tool guard (`admission-port.mjs:770-784`), and the confined Provider then refuses with `IO_ASK_REQUIRES_APPROVAL` (`provider-capabilities.ts:315`). | **MECHANISM, unchanged — with the Control ask→grant→execute leg explicitly NOT reachable in production.** Annotated inline in the C-tools row. |
| **C-subprocess** (`bash`, the `ask`-armed ladder) | `ADM-127` ("ask ⇒ durable Control approval, then the body") is an **in-process** arm. Round 88's two arms over the REAL `ControlService` measure the boundary: guarded ⇒ guard allows + 1 consumption + `resolveAskClassCall` ok; inline (= production) ⇒ `no-request` + `APPROVAL_DENIED` + 0 consumption rows. | **MECHANISM, unchanged — the `ask` arm is annotated as in-process-only and not a product execution path.** Annotated inline in the C-subprocess row. |
| **C-member** (Stop) | Round 88 changes nothing about Stop: the Stop-cancels-a-pending-ask law (`ADM-57`, the round-62 live arm) is exactly the law that keeps the production coupling `inline`, i.e. it is the **reason** BL-30 cannot be wired. | **Unchanged** (MECHANISM + Stop DEV-LIVE). No downgrade and no upgrade. |
| **C-alpha6** | Round 87's D4 probe is already carried in the row: coherent enablement / Officer up / Officer's own binding / incoherent-row refusal **PROVEN** on two agreeing boots; `d4:routed-wake` **REFUTED** because the product's own durable ordinary ask carries no `approvalCaseId`/`legOrdinal` and `alpha6/root-router.ts:209` returns `null`. | **MECHANISM, unchanged** — the live ROUTED wake stays UNPROVEN and is blocked on two Team-side seams (G1 no case-bearing ask producer, G2 BL-30), **never** on an upstream seam. |
| **C-env (five arms)** | The five ENV-LIMITED arms remain ENV-LIMITED: never counted as PASS, `t.skip` only after their assertions. | **Unchanged.** |

**Explicit non-claim.** Nothing in this section moves a row up. The only movement available to a reviewer
is **down or annotated**, and the two new seams are carried as open gaps `G1`/`G2` with the owner rulings
`R1`–`R4` in `D-ACCEPTANCE-REPORT.md` §10 and `OWNER-DECISIONS.md` (round-89 addendum).

## ROUND 93 ANNOTATION — C-alpha6 after R1: the case producer is REAL, the LIVE routed wake is still REFUTED (new reason G11)

An **annotation**, not a re-grade. `C-alpha6` **stays MECHANISM** for the live routed wake, and the
mechanism half is now stronger than the row above records.

| row | what round 93 changed | level effect |
| --- | --- | --- |
| **C-alpha6** | **R1 landed.** An ordinary ask that satisfies the CLOSED rule `ALPHA6-ORDINARY-CASE-Q` (enabled · declared ToolBinding · canonical operation identity · Leader rung · the shared delegable predicate) is converted into a REAL durable Alpha.6 case through the EXISTING `ControlService.requestApprovalLeg`, and the EXISTING router + round-84 governed delivery then select and wake the Officer — proven in-process over the real `ControlService`/router/latch (`ADM-149`, `ADM-150`). Non-qualifying asks keep the byte-identical plain Leader path (`ADM-151`), an unsourceable identity member is a TYPED refusal naming the field (`ADM-152`), and the Officer's own call is still never self-reviewed (`ADM-153`). | **MECHANISM (unchanged) for the LIVE cell** — `d4:routed-wake` is REFUTED on two agreeing boots, now for a NEWLY measured reason: a live v5 world cannot carry BOTH an ordinary `ask` and a trusted `ToolBinding` (`G11`), because the Alpha.5 binding-lane compiler collapses an `ask` path to an empty (deny) lane. R1 is NOT the blocker and no clause was weakened to hide it. |
| **C-tools / C-subprocess / C-member** | Unchanged by round 93: the producer adds no ITE axis, no admission duty, no provider consumer, so the `ask→grant→execute` boundary those rows annotate (`BL-30`) is exactly as it was. | **Unchanged.** |

**Explicit non-claim.** No row moves up. The two facts a reviewer may now rely on are (a) the CASE and the
ROUTE are product-real and pinned by five arms, and (b) the live routed wake still does not happen, for a
reason that is measured, named (`G11`), Team-side, and not papered over with a fabricated ToolBinding or a
defaulted authority scope. `R3` (`BL-30`) remains open: an approved `ask` call still cannot execute.

## ROUND 94 ANNOTATION — R3 PoC: `ask → grant → execute` is PROVEN at MECHANISM level for ONE operation (`write`)

An **annotation**, not a re-grade. No row becomes PRODUCT-PROVEN; `C-alpha6` stays MECHANISM (no live
boot), and the production mount still passes no Provider authority, so a real product turn keeps the
R4 refusal.

| row | what round 94 measured | level effect |
| --- | --- | --- |
| **C-tools** (the `ask` consumer half, BL-30) | The R3 ApprovedAskReceipt is REAL: the centre mints it only after the one-shot grant is consumed, delivers it through a dedicated execution-scoped ALS, and the confined Provider verifies member / binding / policy generation / binder+member epochs / canonical path / content digest / frozen bounds. Over the real `fs` Provider, real binder, real `ControlService` and real settlement store, `ADM-154` writes real bytes (`COMPLETED`); `ADM-155`…`ADM-161` refuse a second effect, a cross-path replay, a revoked Member, a closed receipt, a deny lane, a cross-Member read, and settle a post-body refusal as `FAILED` at the real phase. | **MECHANISM, narrowed for `write` only** — the `ask→grant→execute` leg is no longer "unreachable in every case", but it is NOT PRODUCT-PROVEN (host loop is a double; no boot; no production wiring). Every other tool still refuses. |
| **C-alpha6** | Unchanged: no live boot was re-run, so `d4:routed-wake` stays REFUTED. Separately, **G11 is fixed as a lane-algebra defect**: a legal pure-ask lane now survives the intersection (stays `ask`, never promoted), so a declared `ToolBinding` + ordinary ask CAN coexist in the compiled lane. That removes the G11 blocker for a future boot but does not itself prove the routed wake. | **MECHANISM, unchanged** — the live routed wake remains UNPROVEN; G11 is closed, the boot is not. |
| **C-subprocess / C-member / C-env** | Untouched. The receipt covers `writeText` only; no subprocess, network or Stop semantics changed. | **Unchanged.** |

**Explicit non-claim.** No arm in this round is a live product turn, and no row rises to PRODUCT-PROVEN.
The honest statement is: R3's mechanism is executable and all seven negative controls refuse; BL-30/G2
is narrowed to "`write` at mechanism level", and the remaining work is production wiring, a live boot,
and per-operation extension (each a separate ruling).

## ROUND 95 ANNOTATION — the R3 receipt is WIRED INTO THE PRODUCTION MOUNT and PROVEN LIVE for `write` (DEV-LIVE, not a gate)

An **annotation, not a re-grade**. `C-tools`' ask-consumer half rises to **DEV-LIVE for
`write`/`writeText` only**; `C-alpha6` stays MECHANISM and `d4:routed-wake` stays REFUTED; no row
becomes PRODUCT-PROVEN.

| row | what round 95 measured | level effect |
| --- | --- | --- |
| **C-tools** (Control ask → grant → EXECUTE, BL-30/G2) | The production mount passes the REAL invocation binder as the Provider's receipt authority (`agent-bindings.mjs:1771-1790`, only when the row's Control service is wired), through the realm row and mount into `createMemberFsGuard(policy, undefined, authority)`. The D4 driver boots a real rc.2 host where a Member's `write` with lane `ask` raises a real durable Control request, the Leader allows it through the real control path, the one-shot grant is consumed once, the Provider verifies the minted receipt for THAT execution and writes the approved 27 bytes; settlement `COMPLETED`. Deny-before-body and Stop-while-pending both leave zero bytes and `REFUSED`/`not-started`. The observer wrapper now forwards the optional operation context verbatim (it had dropped the content). | **DEV-LIVE, `write`/`writeText` only** — a booted product turn, not a CI gate; the other FS methods, subprocess and all other tools still refuse `IO_ASK_REQUIRES_APPROVAL` (R4). Never PRODUCT-PROVEN. |
| **C-alpha6** (routing) | Unchanged by R3: the ordinary ask still carries no approval CASE, so the product router selects no Officer and `d4:routed-wake` is REFUTED for the same reason (§10 G1). R3 evidence must not be read as routing evidence. | **MECHANISM, unchanged.** |
| **C-fs / C-subprocess / C-member / C-env** | Untouched. Only `writeText` gained a receipt verifier; bounds/`deny`/Stop semantics and every other face are unchanged. | **Unchanged.** |

**Explicit non-claim.** The evidence is `DEV-LIVE` (a real host boot, not a gate), so no row is
PRODUCT-PROVEN. BL-30/G2 is **closed for `write`/`writeText` only** — a deliberate, frozen scope; every
extension to another operation is a separate ruling, and Alpha.6 routing remains open.

## ROUND 96 ANNOTATION — the SAME receipt extended to `editText` / `patchText` / `deleteFile` / `moveFile` (MECHANISM + DEV-LIVE, subprocess still open)

Owner ruling: extend R3 method by method, each with its own proof, and do NOT assume an OS-sandbox
approval path inherits the FS proof. Round 96 therefore extends the ONE receipt to every FS mutation
the Provider exposes, and states the subprocess face as the next step instead of touching it.

| row | what round 96 measured | level effect |
| --- | --- | --- |
| **C-fs** (the five FS mutations) | The receipt operation is now a discriminated union (schema `/2`): `fs-write` (target + content sha256), `fs-edit` (target + the requested `oldString`/`newString`/`replaceAll` transformation), `fs-patch` (target + the exact `PatchHunk[]` payload), `fs-delete` (target only, `bytesReadBack:false`), `fs-move` (**both** paths). The verifier requires an exact method↔kind match first, then per-path binding/bounds resolution. Over the REAL confined Provider on the pinned hosts (rc.2 for `editText`, rc.5 for the other three), the REAL binder, the REAL durable `ControlService` and the REAL settlement store: `ADM-162` edit writes `gamma beta`, `ADM-166` delete removes the file (absence verified), `ADM-168` move publishes the bytes at the destination and the source is gone, `ADM-171` patch yields `one\nTWO\n`; each settles `COMPLETED`. Negatives: `ADM-163`/`ADM-172` (content/payload binding, zero bytes, `FAILED` at the body phase), `ADM-164`/`ADM-167` (cross-operation and cross-path, nothing changes), `ADM-165` (revoked + reuse), `ADM-169` ((a→b) cannot authorize (a→c)), `ADM-170` (deny on the move destination wins over a live receipt), `ADM-173` (a non-mutation approval mints no receipt). | **MECHANISM (all five), plus DEV-LIVE for TWO of them.** `write` and now `editText`/`patchText`/`deleteFile`/`moveFile` are executable and refuse every negative; the live D4 pair proves a SECOND real mutation with different bytes (`d4:ask-execute-2`). Never PRODUCT-PROVEN. |
| **C-subprocess** | **NOT TOUCHED IN ROUND 96, by ruling.** At round 96 no subprocess/PTY receipt existed and every subprocess ask still refused, because the OS plane's authority is a `SandboxExecutionPolicy`, not a file lane. **ROUND 99 SUPERSEDES THIS ROW** — see the round-99 section below: the process face has its own `process-exec` receipt, verified at the governed spawn point. | **R4 at round 96; EXTENDED in round 99.** |
| **C-tools** (ask-consumer half) | Unchanged in level: the half is now DEV-LIVE for `write` and MECHANISM for the four new methods (their tool shapes are declared, not shipped, so no live model can reach them this round). | **DEV-LIVE (`write`), MECHANISM (`edit`/`patch_text`/`delete_file`/`move_file`).** |
| **C-alpha6** | Unchanged: `d4:routed-wake` remains REFUTED; a receipt is never routing evidence. | **MECHANISM, unchanged.** |

**Explicit non-claim.** The four new methods are proven at the in-process production composition
point (real admission port, real Provider, real binder, real Control, real settlement) and two of
them live on a booted host; `apply_patch` (rc.5's multi-file tool) stays unbound, and the
subprocess/PTY plane stays R4 rectangularly.

## ROUND 97 ANNOTATION — C-alpha6 moves to **DEV-LIVE**: the routed review wake is PROVEN on a booted host

Round 84 implemented the formal routing; rounds 87/93/95 measured it and the live routed wake stayed
REFUTED for a sequence of precise reasons (case-less ordinary ask → G11 lane collapse → no R3 consumer).
Round 97 closes the LIVE half of that sequence. The D4 probe (`--boots 2`, two agreeing DEV-LIVE boots,
rc.2 `639ed015…`, HEAD `a7a7f08ca…`, world `u5a5sfdev1`, grant `devlive-fs-search-1`) measures the whole
chain as SEVEN named judges, each over durable bytes:

| judge | fact count | verdict |
| --- | --- | --- |
| `d4:case-created` | 9 clauses | PROVEN |
| `d4:router-officer` | 4 clauses | PROVEN |
| `d4:wake-delivered` | 6 clauses | PROVEN |
| `d4:officer-decides` | 5 clauses | PROVEN |
| `d4:ask-executes-after-review` | 6 clauses | PROVEN |
| `d4:duplicate-route` | 5 clauses | PROVEN |
| `d4:sticky-stop` | 5 clauses | PROVEN |
| **`d4:routed-wake`** | conjunction of the seven | **PROVEN** |

The eight pre-existing judges (`enablement`, `officer-up`, `officer-binding`, `refusal`, `ask-execute`,
`ask-execute-2`, `ask-denied`, `ask-stopped`) are byte-identical and still PROVEN; the negative arms
(deny / Stop-while-pending) still write zero bytes and settle `REFUSED`/`not-started`.

**Why DEV-LIVE and not PRODUCT-PROVEN.** This repository's record classes reserve `V@B=yes` for a
capability exercised by a BOUND executable gate (a suite leg with a verdict the CI gate reads). The D4
probe is a driver with its own evidence contract, not that gate, and the DEV-LIVE grant is a named
non-production world. The cell is therefore **DEV-LIVE** — a real booted product, a real router, a real
Officer session, real bytes — but not a gate-bound PRODUCT-PROVEN claim. No gate was fabricated to make
the level look higher.

**Evidence:** `dev/agent-workflow/evidence/d-boot-feasibility/d4/runs/boot0{1,2}/`
(`routed-judges.json`, `control-row-durable.json`, `route-probe.json`, `wake-measurement.json`,
`ask-execute{,-2}.json`, `duplicate-route.json`, `sticky-stop.json`, `officer-resolve-{first,second,third}.json`),
`probe.log`, `driver/run97-accept.log`.

**What remains open, unchanged by this round:** only FS mutations carry the R3 receipt
(`editText`/`patchText`/`deleteFile`/`moveFile` at mechanism level, `write`/`writeText` live); the
subprocess/PTY face and `apply_patch` still refuse at R4; the scripted model is the only double; and no
`CORE_SEAM_BLOCKER` was needed — no upstream patch, no new axis, no fabricated case identity.

## ROUND 99 ANNOTATION — the receipt reaches the PROCESS face (MECHANISM + DEV-LIVE)

Owner ruling: extend `ApprovedAskReceipt` to the process face (persistent `bash` / governed shell with
disposition `ask`), as a distinct operation kind `process-exec`. No FS method changed and no new tool
was created.

| row | what round 99 measured | level effect |
| --- | --- | --- |
| **C-subprocess / C-pty** | **LIVE: REFUTED (assembly gap, named above); MECHANISM: proven.** ONE new operation kind, `process-exec`, bound to `toolName`, the compiled `executionBoundary`, `implementationOrigin`, the composition's FIXED shell class, `commandSha256` and the authored `cwd` (context only). The verifier runs at the governed spawn point BEFORE any process exists — `subprocess.ts` before `provider.spawnStreaming`, `terminal-pty.ts` before `raw.spawn` — and `deny` is decided first. Over the REAL confined Provider, the REAL binder, the REAL durable `ControlService` and the REAL settlement store: `ADM-174` (ask → inline allow → consumed grant → receipt → spawn → real bytes → `COMPLETED`, one provider call), `ADM-175` (a receipt from another execution/face cannot spawn: no scope, `RECEIPT_OPERATION_MISMATCH`, then `RECEIPT_REUSED`; still one call), `ADM-176` (an out-of-lane write is refused by the OS — exit≠0, no file — and the request's `allowPaths` are the lane-compiled profile byte for byte), `ADM-177` (an ask receipt grants no escalation: `danger-full-access` still clamps to at most `workspace-write`, a pure-ask lane stays `read-only` with `writeRoot null`), `ADM-178` (compiled `deny` wins with ZERO provider calls; revocation refuses), `ADM-179` (a command different from the approved one is refused `RECEIPT_COMMAND_MISMATCH` before spawn with no bytes; a post-spawn kernel denial settles by its REAL phase, `COMPLETED`). | **MECHANISM (both process faces).** The receipt adds no writable/executable/kernel capability and no lane promotion. |
| **C-tools** (ask-consumer half) | The ask leg that BL-30 opened is consumed on the process face at MECHANISM level (the same one-shot grant + the same centre mint, with the operation identity supplied by the process preparation instead of the FS table). The live process arm reaches the tool with a consumed grant and then hits the assembly gap above, so no live process execution is claimed. | **MECHANISM for both process faces; live process execution BLOCKED (named gap).** |
| **C-alpha6** | Unchanged: a process ask is NOT an Alpha.6 case — the case vocabulary is the outstanding-operation canonicalizer, which cannot express a shell body — so the live process arm takes the plain Leader path. `d4:routed-wake` remains REFUTED; a receipt is never routing evidence. | **MECHANISM, unchanged.** |

**Live arm — REFUTED, and named as itself.** `d4:ask-execute-process` (D4 probe, booted rc.2
`639ed015…`) raises the REAL ask and completes the REAL approval, then measures the tool's own failure:
the worker's `bash` (`authorization: ask`) produces a durable Control request, the router qualifies it
as an Alpha.6 case, the Officer allows it through the real control path, the grant is consumed — and the
persistent `bash` tool then reports `no PTY backend registered for "a5sf-governed-shell"` from ITS OWN
backend lookup, before the governed PTY face's `spawn` runs. On that boot the receipt verifier was never
reached, so the live positive is NOT claimed: zero bytes, no process, `FAILED` (fail-closed). The
pre-existing judges are unchanged and still PROVEN, and the negative arms (deny / Stop-while-pending)
still write zero bytes. The blocker is an ASSEMBLY gap (the governed PTY face is not on the scope the
persistent tool resolves when the world declares a per-tool `bash` binding), not a receipt defect: the
same face mounts and serves in the v4 D3 world, and every receipt rule is proven in-process.

**Explicit non-claim.** `DEV-LIVE` is not a gate, and the process proof is a SPAWN-POINT proof: commands
typed into an ALREADY-RUNNING persistent session are not re-verified per command (there is no per-command
process to gate), and the PTY cannot compare `commandSha256` because its shell exists before any command
text does. Both limits are stated in `ADR-approved-ask-receipt.md` §"The PROCESS face". `apply_patch`
stays unbound (R4), and no `CORE_SEAM_BLOCKER` was needed — no upstream patch, no new axis, no second
authority.

## ROUND 102 (2026-11-24) — the D4 acceptance runs on the TARGET host (0.2.2-rc.5): the same 17 judges, identical facts

The table rows above are rc.2 measurements (plus round-78 rc.5 for the three D drivers). Round 102
closes the remaining **target-host** gap for the D4 probe: `probe-d4-routed-wake.mjs` is now
host-selectable through `tests/next-host/host-select.mjs` **including the realm `tool-fs` module it
mounts** (it used to be hardcoded to rc.2 — an rc.2 module in an rc.5 host, which rc.5's extra
`workingDirectory` injection makes measurable). Full evidence: `RC5-MIGRATION.md` §13 and
`D-ACCEPTANCE-REPORT.md` (the single current status table).

**rc.5 column, measured at `10d8a67aeb7e189011faf2c131a73aa33b76fac3`, `--boots 2`:**

| row (this matrix) | rc.2 | rc.5 (round 102) | level after this round |
| --- | --- | --- | --- |
| C-alpha6 (routed review wake: case → router → wake → decision → execute) | PROVEN (round 97) | **PROVEN** — 8 wake facts, 4 routed / 4 delivered, 0 management executions, 27 B / `sha256:ced10112…` | **DEV-LIVE** (unchanged; now on both hosts) |
| C-tools / C-fs `write` under an approval (R3 receipt) | PROVEN (round 95) | **PROVEN** — 27 B and 29 B writes, both `COMPLETED`, byte-identical to rc.2 | **DEV-LIVE** (unchanged; now on both hosts) |
| the two negative live arms (deny, Stop-while-pending) | PROVEN | **PROVEN** — zero bytes, `REFUSED` | DEV-LIVE (unchanged) |
| governed `bash` under an approval | **REFUTED** | **REFUTED, same three clauses** | **NOT-PRODUCT-PROVEN** — product assembly gap, not a host drift: `no PTY backend registered for "a5sf-governed-shell"`; the governed PTY face is only created when a PTY terminal spec is passed (`packages/runtime/team-services/src/install.ts:609-619`) and the v5 per-tool binding realm passes none |
| P0-2 pre-dispatch abort observation | MECHANISM | **MECHANISM** | **CLOSED BY OWNER RULING (round 106)** — the lawful no-settlement boundary is ruled and tested: `No Admission + No Body Start => No UTE Settlement (lawful)`; `Admission Exists => Terminal Settlement Required`; `Body started + unconfirmable => UNKNOWN`. Arms `SLICE-40`/`SLICE-41`/`SLICE-42`; `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` stays a report, never a settlement. The observer is still not wired into a booted host's own agent loop — a coverage limit, not an acceptance blocker |

**No level moves.** One measurement oracle was made deterministic (`d4:case-created`'s
"no decision yet" clause measured the Officer's speed — a decision landed 176 ms after creation vs a
300 ms poll — and is now an append-only-ledger ordering assertion, rc.2 and rc.5 alike). The two
`agreement.txt` files are byte-identical across hosts.
