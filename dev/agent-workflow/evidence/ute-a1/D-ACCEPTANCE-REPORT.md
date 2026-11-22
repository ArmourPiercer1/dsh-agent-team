# D acceptance report — UTE vNext A1 cut + centre (candidate)

**Worktree:** `.worktrees/vnext-a1-cut` · **Branch:** `vnext/a1-cut` ·
**HEAD:** `7b2db7ad7c877c49ec0d619b84c22776834883bc` · **Base for the cut:** `a19d1df01` (frozen A0,
PR #821) · **Record class of everything below:** in-process `MECHANISM` + `DEV-LIVE`. Never candidate
evidence, never a gate.

This is the single reviewable document for the candidate. It is written to be audited line by line:
every product claim carries a `file:line` or an evidence path, and every row that is not proven says
what would prove it.

> **Read this first, it is the conclusion.** The candidate implements **A1 + B + C** and carries **live
> D evidence** for the items listed in §3. It is **not a completed product acceptance**. Four items the
> owner's D paragraph names are **REFUTED** or unreachable at a product entry, and **no capability row
> is PRODUCT-PROVEN** (`CAPABILITY-MATRIX-C.md:71-74`). §6 lists them; §7 states the verdict without
> rounding up.

> **Round 66 addendum (C11).** Three node:test arms were added after the HEAD measurement in §1:
> `ADM-107`…`ADM-109` prove the **Team-owned** projection (`projection/**`) is preserved in the new
> assembly and derives only from durable TeamDomain facts (positive control: a real
> `team_create_member` is what the next reader sees, read back across a cold reopen; negatives: a
> centre-REFUSED mutation moves nothing, the live overlay invents nothing, an absent TeamSession fails
> closed, and a projection pass writes nothing). The §2 C11 row, §4.1 leg counts and §7 counts are
> refreshed for those arms; §1's HEAD/diff facts stay as measured. C11's **host**
> `sessionProjections.stateOf` half is still unproven and needs a live boot. Nothing is upgraded to
> PRODUCT-PROVEN.

---

## 1. HEAD, branch, and scope facts

| fact | value | how measured |
| --- | --- | --- |
| HEAD sha | `7b2db7ad7c877c49ec0d619b84c22776834883bc` | `git rev-parse HEAD` |
| branch | `vnext/a1-cut` | `git rev-parse --abbrev-ref HEAD` |
| commits since A0 `a19d1df01` | **132** | `git rev-list --count a19d1df01..HEAD` |
| working tree at measurement start | clean | `git status --porcelain` (empty) |
| diff vs A0 | 1567 files changed, +100460 / −79598 | `git diff --stat a19d1df01..HEAD` |
| file-status counts vs A0 | 1124 A · 363 D · 75 M · 2 R060 · 1 R094 · 1 R095 · 1 R096 | `git diff --name-status a19d1df01..HEAD \| awk '{print $1}' \| sort \| uniq -c` |

### 1.1 Cut closure (fresh runs, this HEAD, pasted verbatim)

```
$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
```

```
$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
```

Reading the two together, precisely:

- **146 files deleted** and **2 entries replaced** — the frozen A0 delete/replace set.
- **148 sources gone** (`deleted=148`): 146 deleted + the 2 replaced entries.
- **32 files kept**, out of **180** across **37** modules; **69,512** lines in the frozen census.
- `cut=cut(0/148)` means the closure gate finds **zero** frozen-set files still present, and
  `cut=cut(148/148)` in the assets gate means all 148 are accounted for. `prodRefs=0` = no surviving
  production import of a retired entry; `distResiduals=0` = no stale dist mirror of a deleted source;
  `dupNames=0` = no duplicate tool-name declarations.

### 1.2 Dist mirror placement count

```
$ node scripts/place-dist-glue.mjs
place-dist-glue: done (28 placement(s))
```

**28** byte-identical `.mjs`/`.py` placements (every line at the run reads `(byte-identical)`). This is a
*different measurement* from the frozen A0 figure: A0 counted **52 committed dist artifacts**, and the
closure gate cannot see the aggregated `packages/runtime/dist/packages/<other-pkg>/…` mirrors or `.mjs`
byte-copies — `CUT-BOUNDARY-ADDITIONS.md:27-32` explains the mapping. The two numbers are not comparable
and neither is quoted here as the other.

### 1.3 A0 frozen numbers (for comparison)

| measure | A0 frozen (`a19d1df01`) | this HEAD | source |
| --- | --- | --- | --- |
| modules / files / lines | 37 / 180 / 69,512 | unchanged (37 / 180 / 69,512) | `docs/plans/memo/ute-p0-20261121/01-ASSET-INVENTORY.md:8` |
| files deleted | 146 (wave 1 = 146, wave 2 = 0) | 146 deleted + 2 replaced = 148 sources gone | same; `ute-p0-assets` line above |
| entries replaced | 2 (`agent-bindings.mjs`, `root.ts`) | 2 (both replaced wholesale) | same |
| files kept | 32 | 32 | same |
| dist artifacts | 52 committed (A0 accounting) | + 28 current byte-copied placements (a different measure) | `CUT-BOUNDARY-ADDITIONS.md:27`; `place-dist-glue` line above |

---

## 2. The C1–C18 acceptance checklist

### 2.1 Where the list came from (authoritative, not reconstructed)

The owner's D requirement names "C1–C18 状态". The authoritative enumeration **exists** and is frozen:
`docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md`, section **"The list (A1 must dispose of
every row)"** (lines 30–52). It is the UTE P0 capability contract; the rule that makes it enforceable is
at `:86-90` ("A1 may not merge while a row is blank … 'dropped' must name the owner ruling"). Its own
phase split is at `:16-28`, and the "A1 must dispose of every row" framing is at `:30`.

**One structural detail, stated rather than smoothed over:** that table has **19 rows** — C1…C18 **plus
`C14b`**, because the owner split C14 into "drop the implementations" and "preserve the safety
invariants" (`06-CAPABILITY-CONTRACT.md:26`, `:54-63`, and the decision record at
`dev/agent-workflow/SESSION_ROUTER_LOG.md:9810`). So the 18 numbered criteria are all present, and C14b
is an additional sub-row of the same frozen contract. It is included below as its own row, labelled.

The **capability** and **disposition** columns below quote that table's wording verbatim. The **status**
and **what would prove it** columns are this report's honest measurement; they are not from the frozen
list.

### 2.2 The checklist (18 numbered rows + the contract's C14b split row)

Status vocabulary — these are not interchangeable:

- **MECHANISM** — the centre-side guarantee is implemented with passing in-process arms
  (`CAPABILITY-MATRIX-C.md:5`).
- **DEV-LIVE** — additionally measured on a real booted host by a live judge; a `DEV-LIVE` record is
  **not** a gate and upgrades no row (`CAPABILITY-MATRIX-C.md:7`, `:71-74`).
- **PRODUCT-PROVEN** — MECHANISM **and** a real product assembly exercised it end to end. **No row is in
  this state.**
- **REFUSED-BY-DESIGN** — the call is refused with its own typed code on its own axis; this is the A1 law
  working, not a defect (`CAPABILITY-MATRIX-C.md:72-74`).
- **DROPPED-AS-RULED** — deleted under an owner ruling named in the contract.
- **UNPROVEN** — nothing here should be reported as working.

| # | capability (verbatim) | disposition (verbatim) | status at this HEAD | evidence | what would prove it (if not PRODUCT-PROVEN) |
| --- | --- | --- | --- | --- | --- |
| **C1** | the **15** `team_*` tools (member/template/delegation/control board) | **preserve** — not the retired plane; the earlier draft credited the plane, which was wrong | MECHANISM + DEV-LIVE surface. The closed list is `CENTRE_TOOL_NAMES` (`packages/runtime/src/plugin/vnext/admission.ts:57-73`); `ADM-31` pins it against `createTeamTools` **in both directions**; `ADM-89/90/91` admit all 15 on `team.control`, refuse all 15 unbound, and refuse an unlisted name. Live: the booted centre row's model-visible surface carries all 15 (`ESCALATION-centre-row-creation-entrance.md:12`) | `packages/runtime/test/vnext-admission.test.mjs`; `ESCALATION-centre-row-creation-entrance.md:12` | a governed row that **creates and drives** the board end to end through a product entrance (GUI or remote) with a real model. Blocked today by the 405 in §6.2 |
| **C2** | member create / resume / archive | **preserve** | MECHANISM. `ADM-92` creates through `team_create_member` and installs the **member's own** centre at its bind; `ADM-93` archives through `team_archive_member` (production step ports: quiesce → settle-then-archive → `release-residency`), and the next call is `ADMISSION_MEMBER_CLOSED`. **DEV-LIVE (create only):** the D3 delegate produced a real `member-activated` effect with `instanceId`/`childSessionId` (`d3:work-delivery`, §15) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md` §15; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` | a live **archive** and a live **resume** on a booted host. Archive's live path currently refuses **earlier**, at the durable lifecycle gate (`LIFECYCLE_ADMISSION_CLOSED` / `memberResumeRefusal`) — `CAPABILITY-MATRIX-C.md:61-64`. Resume is not measured live at all |
| **C3** | work delegation + delivery receipts | **preserve** | **DEV-LIVE PROVEN** (`d3:work-delivery`, two agreeing boots). `team_delegate` → `effect.kind=member-activated`, prompt delivered **verbatim** as the Member's first user message, final text and `memberResult.body` both exactly `DBOOT_D3_DELIVERED_UNIT_ALPHA`; `team_collect` returns the terminal `succeeded` entry, **byte-identical when collected again after a SIGKILL cold restart**; the unit is on disk; every member call fact is in the member's own ledger. `ADM-94/95` carry the in-process positive and negative | `D-BOOT-FEASIBILITY.md:618-628`; `.../d-boot-feasibility/d3/README.md`; `packages/runtime/test/vnext-admission.test.mjs` | a **real-model** interleaving (the current model is the product's scripted mock, §6.7) and a delivery driven at a product entrance rather than the driver's boot-bound team |
| **C4** | Blueprint binding + identity generation | **preserve** (KEEP module) | MECHANISM. `ADM-26` maps a compiled member onto a binding by reference, never by re-interpretation; `TB-1…TB-6` pin the durable-row resolution and the four typed refusal reasons with **no** legacy degradation. Live: the round-60 path-3 boot binds a v4 blueprint at boot and reaches a governed Member (`CAPABILITY-MATRIX-C.md:137-141`) | `packages/runtime/test/vnext-admission.test.mjs`; `.../vnext-template-binding.test.mjs`; `CAPABILITY-MATRIX-C.md:137-141` | an identity generated for a member **created at runtime** on a governed row (needs the 405 entrance, §6.2) |
| **C5** | Control: ask / grant / deny / consume | **preserve** (KEEP module), fed by the three contracts | MECHANISM. `ADM-46…ADM-55` cover wiring, deny, expired, fault, the **real** `ControlService` (one request → one durable allow → one-shot spend), a real service deny, generation drift, incomplete identity, and the supply-chain pin. Live: `d2:stop` parked a Member turn at a durable `admission-ask` Control request `status=pending` and resolved it through the public `session/cancel` RPC | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:483-493` | a live **approval** (leader allows) and a live **consume** of the one-shot grant. Today the live ask is only exercised in its Stop terminal; the product wires no approval binder, so asks that reach the port are refusals (`PR-BODY-draft.md:313-314`) |
| **C6** | Officer assignment + ReviewCapability routing | **preserve** (KEEP module) — *and* the contract's own rule: if Alpha.6 is not wired, "the corresponding approval and auto-wake paths must be **explicitly disabled**, never silently fall back" (`06-CAPABILITY-CONTRACT.md:95-98`) | **REFUSED-BY-DESIGN**, and that is the contract-compliant state. `ADMISSION_ALPHA6_UNAVAILABLE` in two independent gates: `centre-config.ts:62-70` rejects the opt-in on **every** row (`ADM-34`, `ADM-99`), and `root.ts:2498-2512` records the refusal then types the boot refusal. **Live:** `d3:alpha6` **PROVEN** as the typed-refusal shape — no team root (`/__p6t6/state` 404), no decision, no wake intent, no fact file | `D-BOOT-FEASIBILITY.md:629-643`; `.../d3/README.md`; `packages/runtime/test/vnext-admission.test.mjs` | a compiled review-routing **axis** in the member contract, or an owner ruling that a record-only approval fact on `host.service` **is** adjudication (`CAPABILITY-MATRIX-C.md:119-123`) |
| **C7** | durable Wake intents + cold wake | **preserve** | MECHANISM, in-process only. `ADM-98` composes `createAlpha6RootWiring` directly, the ONE shared `createAlpha6RootRouter` takes a real `recipient` decision off a durable control row (Officer, `routeRole='officer'`), and the real `dispatchLatch` + `createFileWakeIntentDirectory` persist a row that a **fresh** reader sees naming exactly the routed reviewer | `packages/runtime/test/vnext-admission.test.mjs` | the same, reached at a **product entry**. Unreachable while C6's axis is missing: the config gate runs before root construction, so at a host entry the machinery is never built (§6.5) |
| **C8** | Stop (sticky, durable, non-replaying) | **preserve** | MECHANISM + **DEV-LIVE PROVEN** (`d2:stop`, two boots). Stop is the host's own `exec.signal` — no second stop mechanism. `ADM-56…ADM-62` cover Stop before the body, while an ask is pending, after the approval and before the body, lifecycle close with a call in flight, and the product composition's own close. Live: `POST /api/session/cancel` → tool result `ADMISSION_STOPPED`, centre fact `refusalCode=ADMISSION_STOPPED`, settlement `REFUSED`/`dispatch=not-started` with **no** execution fact, never `UNKNOWN`; a second Member completed with zero stops | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:483-493`; `.../d2/README.md` | Stop **under load** and a real Stop keypress; and the one open cell: a Stop that lands **after** an `allow` was recorded cannot be `REFUSED` under the frozen settlement contract (`CONTRACT-CHANGE-REQUEST-settlement-recheck.md`) |
| **C9** | remote entry (`s6-remote`, remote control surface) | **preserve** | **REFUSED-BY-DESIGN**, with a disclosed product cost. `ADMISSION_REMOTE_UNAVAILABLE` on `team.control`; the S6 plane is not built at all (`root.ts:4325` via `refuseHostSurfaceBefore`, `ADM-86`), while an ungoverned row still builds and dispatches (positive control). The cost: a centre-configured row has **no remote API** (`root.remoteDispatcher` absent) | `CAPABILITY-MATRIX-C.md:25`; `D-BOOT-FEASIBILITY.md:171-222`; `ESCALATION-centre-row-creation-entrance.md:17-24` | a declared axis for remote commands (contract change), or a non-remote creation route — shapes 1/2 of the escalation. Shape 3 (boot-created teams only) is what D currently measures |
| **C10** | MCP catalog + initial grant + live loss | **preserve** — "may land in C, but must never be enabled by default while unmanaged" (`06-CAPABILITY-CONTRACT.md:99`) | MECHANISM. `ADM-96` mounts the product's own real HTTP mini-MCP server through the **exact production call**, reads the tool off the model-visible surface, admits it on `net.mcp` with the **server** as locator, and the real body answers `pong:mounted`; `ADM-97` proves mounting ≠ permission, that a tool-level restriction narrows, and that a bare `mcp__` prefix is refused by name. `f15-mcp-live-loss` is green inside the 238-suite vitest population. Not enabled by default: the remote mount is `SKIPPED` on the centre row | `packages/runtime/test/vnext-admission.test.mjs`; `tests/checks/eb3-ute-migrated-suites.txt`; `D-BOOT-FEASIBILITY.md:171-222` | a **live mount at a host boot** (unknown at D: the row's remote mount is skipped) and a live server-loss observation. Also: the centre is **not mount-aware**, so a well-formed name for a never-mounted server is decided on the network axis alone (`ADM-97` step 5) |
| **C11** | state projections (`sessionProjections`) | **preserve** | **MECHANISM, measured (round 66).** The row names two owners. (a) The Team-owned projection (`projection/**`) is **PRESERVED in the new assembly** and proven to derive from the TeamDomain's own facts: `ADM-107` wires it exactly as the entry does — `createProjectionService(createTeamDomainReadPort(domain, readPortDeps), <live overlay>, { clock, schemaVersion: 2 })` (`root.ts:4275-4279`) — over the REAL durable `TeamDomain`, and asserts the identity core, every member row and the ledger summary field-by-field against the durable rows; a real `team_create_member` is then what the **next** reader sees (fresh port + service), and every durable value survives a **cold domain reopen**. `ADM-108` (negative) proves a mutation **REFUSED at the ONE centre** (`ADMISSION_NO_BINDING`, `LANE_DENY`) moves **nothing** — projection byte-identical, no new member row, no ledger entry, no generation move — with a same-world positive control. `ADM-109` (negative) proves the live overlay is **not a second authority** (a live handle invents no member; dropping one moves only residency, never lifecycle/creation/generation), that an absent TeamSession **fails closed** (`TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT`, never an invented empty team), and that a projection pass **writes nothing**. Falsified not assumed: stamping v1 and emptying the catalog template rows each turn the arms red. (b) The other named owner — the host's native `sessionProjections` service behind the `todo`/`goal` faces — is preserved **by construction, not by this cut**: neither the retired entry (`live/agent-bindings.mjs`, `root.ts` at `1617d5839^`) nor the new one references it (`grep -c sessionProjections` → **0** in all four files), so the entry replacement cannot have un-wired it; those faces stay bound on `host.service` (`ADM-32`). The Team-side uses are pass-through **reads** of the HOST's service, never a registration of its own: the PTY facade hands `ctx.get('sessionProjections')` to the pinned backend (`team-services/src/terminal-pty.ts:400`) and the P5-T5 real-instance harness restores the durable model selection with `stateOf(session, 'modelSelection')` (`root-binding/harness/plugin.mjs:969-982`) | `packages/runtime/test/vnext-admission.test.mjs` (`ADM-107`…`ADM-109`); `MIGRATED-SUITE-STATUS.md` "Round 66 (C11)" | (i) a **live boot** reading the Member's todo/goal projection state through the host's own `sessionProjections.stateOf` — that service is the HOST's, so no in-process arm can read it; (ii) a projection read at a **product entry** (`team.getProjection`), which a centre-configured row cannot reach today because the S6 plane is refused by design (C9). **The `sessionProjections.stateOf` half is NOT claimed here**, and no cell above is PRODUCT-PROVEN |
| **C12** | tool admission (guard, builtin deny, selector) | **preserve** (KEEP module) | MECHANISM + DEV-LIVE. `ADM-1…ADM-45` (lanes, deny precedence, unbound refusal, `ADMISSION_TOOL_UNBOUND`), `ADM-29/30` (tool restriction answers before the ceiling and only narrows), `ADM-31` (closed list matches `createTeamTools` both ways), `ADM-35` (a governed member refuses to run unrecorded), `ADM-44` (`MEMBER_CENTRE_UNWIRED`). Live: `d:centre-facts` PROVEN — 2 `fs.read` admissions (`allow` + `DENY/LANE_DENY`) and 2 execution facts, read back from disk | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:369-395` | a real model choosing tools adversarially (the mock is scripted), and a policy compiled at runtime rather than passed as an input (`CAPABILITY-MATRIX-C.md:66-67`) |
| **C13** | confined I/O faces (fs/web/subprocess/terminals/userQuestions) | **replace** with provider lanes | MECHANISM + DEV-LIVE for **fs and web**; **process family REFUSED**. fs: `d:guard-facts` **PROVEN** (2 `allow` facts, methods `stat`/`readText`, `memberIdentity=inst-0pe2z220bhfb`), `SLICE-1…SLICE-36`, and `d2:multi-member-concurrency` live. web: `SLICE-31/32` (transport reached / never reached), `ADM-67/74`. subprocess/PTY/PTC: `ADMISSION_AXIS_UNSUPPORTED` / `ADMISSION_PTC_UNAVAILABLE` (`admission.ts:318`), see §6.3 | `D-BOOT-FEASIBILITY.md:349-414`; `packages/runtime/test/vnext-fs-slice.test.mjs`; `packages/runtime/test/vnext-b-probe-ladder.test.mjs` | a process-lane declaration (CCR), a live `web_fetch` at a boot, and `userQuestions`/terminals beyond the PTY-owner refusal (`SLICE-33`) |
| **C14** | **old governed-family execution implementations**: each family's own tool body, its duplicated policy computation, and the historical per-family semantic-equivalence requirement … | **dropped** — the host rows own execution now, and the equivalence criterion is retired with the bodies; the differences that mattered were defects of the deleted body (`SD-SEARCH-1`) | **DROPPED-AS-RULED**, and closure holds: `deleted=148 prodRefs=0 distResiduals=0 dupNames=0` (fresh run, §1.1); no legacy Plane/Family Body/Kernel/PA Bridge is wrapped as an internal component and there is no legacy fallback (`PR-BODY-draft.md:8-10`) | `ute-cut-closure` line in §1.1; `CUT-BOUNDARY-ADDITIONS.md`; `docs/plans/memo/ute-p0-20261121/03-RETIRE-KEEP.md` | nothing — a drop is complete when the closure gate is green and the ruling is named, which it is (`06-CAPABILITY-CONTRACT.md:90`) |
| **C14b** *(the contract's split row, not a 19th criterion)* | **the safety invariants those families enforced**: path read/write upper bounds, network allow/deny, Control authority, Stop | **preserved** — never implied by C14's drop | **MECHANISM + DEV-LIVE.** The P1–P5 proofs (§3) plus the OS controls: `OS-1` Landlock ABI 7, `OS-2` **negative** (a confined payload CANNOT read outside its allow set), `OS-3` **positive** (the same payload CAN read inside it), and `SLICE-4` (without the realm mount the outside read **succeeds**, so the confinement arms are falsifiable) | §3; `packages/runtime/test/vnext-os-probe.test.mjs`; `packages/runtime/test/vnext-fs-slice.test.mjs` | a live OS-boundary measurement at a boot (today the OS probe runs in the node leg on the CI host); network containment under a real model |
| **C15** | `team_skill` | **preserve, re-homed** — Team skill provider into a host-shaped row | MECHANISM + **recorded LIMIT**. Bound on `host.service` (`ADM-32`); `skill` is in `HOST_CAPABILITY_TOOL_NAMES` (`admission.ts:110-119`); the governed preset mounts `a5sf-skill-provider` (`scripts/place-dist-glue.mjs` placement list). **Limit, not a confinement claim:** a skill file read by the host skill service is OUTSIDE the member's fs ceiling (`CAPABILITY-MATRIX-C.md:76-87`) | `packages/runtime/test/vnext-admission.test.mjs`; `CAPABILITY-MATRIX-C.md:29,76-87` | a D judge that has a governed Member invoke `team_skill` on a booted host and asserts the row is reachable — with the limit stated in the same evidence, not only here |
| **C16** | `subagent_fork` | **preserve, re-homed** — row over `subagent-fork-in-process` | MECHANISM. Bound as host capabilities (`subagent`, `send_message`, `interrupt_agent`, `admission.ts:110-119`, `ADM-32`); the **child's own** binding governs the child's tools (so the parent's ceiling is not a claim about the child) | `packages/runtime/test/vnext-admission.test.mjs`; `CAPABILITY-MATRIX-C.md:30` | a live fork at a boot, and an assertion that the child's own centre judges the child's calls — neither is measured in the D legs |
| **C17** | **Team's own `exit_plan_mode` tool** — not DSH plan mode, and not the goal tools | **dropped by owner ruling** — the host has only a `claude-code-mods` name mapping, and re-creating a plan-mode state machine is out of scope. `get_goal`/`create_goal`/`update_goal` are untouched | **DROPPED-AS-RULED**, provable by **absence**: zero `exit_plan_mode` references under `packages/runtime/src` and `packages/tools/src`, and it is in neither closed table (`admission.ts:32-41`, `:57-73`, `:110-119`). The goal tools **are** present on `host.service` | `grep -rn exit_plan_mode packages/runtime/src packages/tools/src` → no matches; `admission.ts:110-119` | nothing — the ruling is named and the absence is checkable |
| **C18** | `a5p5-tools` lane helpers (arg parsing, effects, render, spill) | **dropped** — dormant, nothing dispatched | **DROPPED-AS-RULED.** `packages/tools/a5p5-tools` no longer exists under `packages/tools/src` (only `builtin-deny.ts`, `guard.ts`, `index.ts`, `native-fs-binding.ts`, `tokens.ts`, `tool-selector.ts`, `tools.ts`, `types.ts`), it is absent from the migrated population, and the cut-closure run reports 148 sources gone with zero residual references | `ls packages/tools/src`; `grep a5p5 tests/checks/eb3-ute-migrated-suites.txt` → none; `ute-cut-closure` line in §1.1 | nothing — dormant-and-deleted with an empty dispatch path is the ruling's own completion criterion |

**Rows that are not proven, at a glance** (this is the honest subset a reviewer should carry forward):
**C1/C2/C4/C5/C6/C7/C9/C10/C15/C16** are MECHANISM at best and several are
REFUSED-BY-DESIGN by owner ruling; **C3/C8/C12/C13/C14b** carry DEV-LIVE evidence but are still not
PRODUCT-PROVEN. **C11 now has mechanism arms** (`ADM-107`…`ADM-109`, round 66) for the Team projection;
its host `sessionProjections.stateOf` half is still unproven and needs a live boot.
**No cell above says PRODUCT-PROVEN, and none may be upgraded by narration.**

---

## 3. The P1–P5 ladder and the OS negative controls

The P1–P5 obligation set is frozen in `docs/plans/memo/ute-p0-20261121/04-SEAMS.md:57-67`: "Each proof is
a *pair*: an assertion that must be green, and a mutation that must turn it red. A proof without its
mutation is a claim, not a test." The C14b row names them as the evidence that the safety invariants
survived the C14 drop (`06-CAPABILITY-CONTRACT.md:48`).

| proof | what the rung proves (verbatim obligation) | arms that carry it | live judge that carries it | negative control / must-red mutation | committed evidence |
| --- | --- | --- | --- | --- | --- |
| **P1** | **Binding monotonicity** (UTE-06): `EffectiveIO ⊆ AgentCeiling ∩ ToolRestriction` on every admitted call | `ADM-2` (out of lane is `LANE_DENY`; a write grant is never read as a read grant), `ADM-7` (deny wins), `ADM-29/30` (a TOOL restriction answers before the ceiling and **can only narrow**), `ADM-39` (an omitted axis does not inherit the ceiling), `ADM-45` (the durable overlay can only REMOVE authority), `ADM-52` (post-approval generation drift refuses) | `d:centre-facts` — one ledger holding `allow` **and** `deny/LANE_DENY` for the same member; `d2:multi-member-concurrency` — A's read of B's in-lane file is `LANE_DENY`, **zero** B bytes reach A, and **zero** guard facts exist for B's locator under A's identity | must-red mutation: widen one axis after approval ⇒ the same call refuses (`ADM-52`, `ADM-37`); live widening is refused by the overlay itself (`d2:revocation` step 3) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:452-461`; `.../d2/README.md` |
| **P2** | **Face completeness** (UTE-07): a tool with all required faces bound executes; a tool missing one face is refused **whole** | `ADM-4` (a tool with no declared axis is refused, never admitted by default), `ADM-18` (no compiled process lane ⇒ the subprocess family is EXPLICITLY unavailable), `ADM-33` (an MCP tool needs a **server** locator, no prefix matching), `ADM-78` (the binding IS the compiled answer; absent axes stay absent) | `d3:persistent-subprocess` — **REFUTED as a capability, and correct as a face-completeness witness**: `bash` is refused whole with `ADMISSION_AXIS_UNSUPPORTED` rather than run "without a shell lane" | must-red mutation: bind `faces.web = null` and assert the whole tool refuses, not "runs without web" (`04-SEAMS.md:63`); B's ladder rung 6 (`ADM-76`) is the live-shaped negative | `packages/runtime/test/vnext-b-probe-ladder.test.mjs` (`ADM-78`); `D-BOOT-FEASIBILITY.md:572-598` |
| **P3** | **Fail-closed** (UTE-09): provider absent ⇒ refuse | `ADM-3` (UNWIRED refuses; it does **not** fall through to the composition provider), `ADM-42` (a native module specifier is judged before it is imported), `ADM-83` (an unwritable ledger is a refusal), `ADM-102` (`GOVERNED_NATIVE_MODULE_*` typed refusal, **never** a base-provider fallback), `SLICE-9` (with no binding the in-ceiling call never reaches the provider) | `d:guard-facts` — `out-lane-never-reached-provider 0` guard facts; the refused call never enters the provider at all. Residual 1 of `FINDING-native-tool-provider.md` is exactly this law: the centre's `LANE_DENY` precedes the body | **negative control that makes it falsifiable:** `SLICE-4` — **without** the realm mount, the same outside read **SUCCEEDS**. Also `SLICE-17/18/19` (observation policy OFF accepts an unobserved overwrite; ON refuses it; a moved version is refused) | `packages/runtime/test/vnext-admission.test.mjs`; `packages/runtime/test/vnext-fs-slice.test.mjs`; `FINDING-native-tool-provider.md:91-115` |
| **P4** | **One fact** (UTE-15/17): one `ExecutionId`, one canonical outcome per physical attempt; a crash between emit and return leaves a recoverable fact | `ADM-21` (`ADMITTED → RUNNING → COMPLETED`), `ADM-79` (crash between the admission fact and the execution fact ⇒ a **new process** recovers `ADMITTED→UNKNOWN`, never `COMPLETED`), `ADM-80` (a callId with a durable fact is refused on a second attempt in a **fresh process**, before the body), `ADM-81` (a duplicate execution fact on disk is a refusal), `ADM-84` (an open settlement is classified `UNKNOWN` from disk with what is missing) | **`d3:crash-cold-recovery` — PROVEN.** A real `SIGKILL` (`signal=SIGKILL`, pid gone) and a restart on the **same** `DSH_HOME`: the in-flight `RUNNING` becomes `UNKNOWN` with **no execution fact** and one admission fact (never replayed); the completed call's fact/settlement are **byte-identical**; a new call is admitted with a **new** fact and completes | must-red mutation: kill the process after emit and assert recovery yields `unknown`/fact, never `succeeded` from memory (`04-SEAMS.md:65`); `ADM-79`'s control also completes a **different** call before dying, which stays `COMPLETED` (no blanket rewrite) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:599-617`; `.../d3/README.md` |
| **P5** | **Stop is durable and non-replaying** (UTE-18): after stop + cold start, facts are restored and nothing re-executes | `ADM-56` (Stop before the body ⇒ `REFUSED`/not-started, never `UNKNOWN`, never an execution), `ADM-57` (Stop while the ask is pending closes the durable request; a later approval cannot revive it), `ADM-58` (Stop **after** the approval and **before** the body spends nothing), `ADM-59` (lifecycle close refuses a new call with its own code), `ADM-60` (close with a call in flight: it still settles; a second dispose neither throws nor double-settles), `ADM-61` (close while an ask is pending abandons it), `ADM-62` (the product composition closes the member) | **`d2:stop` — PROVEN.** Through the product's own public `POST /api/session/cancel` on the child session, while parked at a durable `admission-ask`: tool result `Error: ADMISSION_STOPPED: …`, centre fact `refusalCode=ADMISSION_STOPPED`, settlement `REFUSED`/`dispatch=not-started`/`bodyOutcome=not-started` with **no execution fact**; never a completion and never `UNKNOWN`. Member B completed with zero stops | must-red mutation: restart and assert the previous call is **not** resumed; a resume attempt must red (`04-SEAMS.md:66`). The live negative is the **second Member**: it completes, so Stop is not a blanket. Re-reported in **both** boots — no single-boot concession | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:483-493`; `.../d2/README.md` |

**The honest gap in the P-ladder:** the "must-red mutation" half is recorded for P1/P2/P4/P5 as mutations
performed and reverted during those rounds (`PR-BODY-draft.md:113,161` — seven and six mutation edits
respectively, each reddening exactly its own arm). P3's mutation is the **missing-mount world**
(`SLICE-4`) rather than an edited source line. Nothing in this section is a substitute for a product
acceptance: P1–P5 are properties of the **binding and settlement**, which is what the contract says they
are (`04-SEAMS.md:69-73`).

### 3.1 OS negative controls (fresh, this HEAD)

Measured inside `ute-vnext-a1` (file `packages/runtime/test/vnext-os-probe.test.mjs`; leg definition
`dev/ci/eb3-ci-manifest.json` → `layers[4].legs[11]`, which sets `A5SF_REQUIRE_PINNED_HOST=1` and states
that "an OS enforcement claim is either measured with both controls or the leg is red"):

```
OS-1 measured landlock abiVersion=7
✔ OS-1 — the host answers the Landlock ABI the provider requires (32.884218ms)
✔ OS-2 — NEGATIVE CONTROL: a confined payload CANNOT read outside its allow set (3214.834264ms)
✔ OS-3 — POSITIVE CONTROL: the same payload CAN read inside its allow set (3194.526655ms)
```

The pair is load-bearing: a positive-only run would prove nothing about the boundary, and a
negative-only run would not distinguish "denied" from "broken". Both controls ran in this session's
`dispatch-tests --run --leg ute-vnext-a1` (§4). The OS probe needs `python3` and a Landlock-capable
kernel; both were present.

### 3.2 All live judges, actual verdicts (do not read the list as all-green)

| judge | verdict (both boots) | recorded at |
| --- | --- | --- |
| `d:member-read-admitted` | **PROVEN** | `D-BOOT-FEASIBILITY.md:369-395`; `.../d-boot-feasibility/runs/` |
| `d:guard-facts` | **PROVEN** (2 allow facts: `stat`, `readText`; `memberIdentity=inst-0pe2z220bhfb`) | same |
| `d:centre-facts` | **PROVEN** (2 `fs.read` admissions `allow` + `DENY/LANE_DENY`, 2 execution facts) | same |
| `d:native-read-surface` | **PROVEN** after the round-62 re-anchor (all six clauses; the `native-description` clause now reads the top-level field and `native-file-path-description` reads the parameter field) | `D-BOOT-FEASIBILITY.md:494-511` |
| `d:member-read-denied` | **REFUTED** — the clause requires the provider's `IO_READ_DENIED`, but the centre refuses **before** the provider (`LANE_DENY`), by design | `D-BOOT-FEASIBILITY.md:369-395`; `FINDING-native-tool-provider.md:93-99` |
| `d2:multi-member-concurrency` | **PROVEN** | `.../d-boot-feasibility/d2/README.md` |
| `d2:revocation` | **REFUTED** — the REQUIRED direction (revoke refuses a previously-succeeded call and a NEW policy generation appears) is not implementable at this HEAD; the **opposite** direction was measured live | `.../d2/README.md`; `FINDING-native-tool-provider.md:131-150` |
| `d2:stop` | **PROVEN** | `.../d2/README.md` |
| `d3:persistent-subprocess` | **REFUTED** — both `bash` turns refused `ADMISSION_AXIS_UNSUPPORTED` on `process.exec`; only the one-shot `tool-bash` is mounted (`--plan`: `present=true mounted=false`); `io.process` is rejected live as `unknown-field` | `D-BOOT-FEASIBILITY.md:572-598` |
| `d3:crash-cold-recovery` | **PROVEN** | `.../d3/README.md` |
| `d3:work-delivery` | **PROVEN** | `.../d3/README.md` |
| `d3:alpha6` | **PROVEN** (as the typed-refusal shape) | `.../d3/README.md` |

`overall=FAIL` for **both** live drivers (`run-boot.mjs`: 1 refuting judge; `run-boot-d3.mjs`: 1 of 4
refutes) is unchanged and honest: a REFUTED judge maps to a FAIL case, and `evidence-complete=true,
allProven=false` is the recorded state (`CAPABILITY-MATRIX-C.md:264-266`). A driver that exited 0 would
be the finding.

---

## 4. Required CI — gates and last measured output

All eight commands were run fresh at this HEAD in this worktree. Pasted verbatim.

### 4.1 `dispatch-tests --run --leg ute-vnext-a1`

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 173
ℹ pass 171
ℹ fail 0
ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
```

The **2 skips are disclosed and labelled**, never passes:

```
﹣ ADM-68 — BASH positive: NOT RUN (compiled process lane does not exist) — disclosed, never a pass
﹣ ADM-69 — RUN_CODE positive: NOT RUN (same compiled process lane) — disclosed, never a pass
VNEXT-B-LADDER rungs=read,write,grep,web_fetch,bash,run_code negatives=6/6 positives=4/6 blocked=bash,run_code reason=process-lane-contract-change-request
```

### 4.2 `test-catalog --max-uncollected 41 --max-excluded 7`

```
$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
test-catalog (test-catalog/1) — discovery + the node:test predicate the dispatcher resolves legs against
  tests=889 instruments=3 digest=sha256:3e409a68e913fbcb68f2ea73f1cb5068bc1690c6eabd4ddfcbd47ebf80694e67
  DISCOVERED_AND_COLLECTED 834
  EXCLUDED_WITH_REASON     14
  UNCOLLECTED              41
  by runner: node=146 none=7 vitest=736
DSH-TEST-CATALOG tests=889 digest=sha256:3e409a68e913fbcb68f2ea73f1cb5068bc1690c6eabd4ddfcbd47ebf80694e67 refused=0 findings=0
```

Note for the reviewer: `41` is the **ceiling**, and the measured `UNCOLLECTED` is exactly `41` — the
gate is green with zero headroom. It must not be read as "only 41 are uncollected by accident".

### 4.3 `ute-cut-closure --check`

```
$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
```

### 4.4 `ute-p0-assets --check`

```
$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
```

### 4.5 `docs-sync --check`

```
$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
AUTHORITY_SOURCE_BINDING {"kind":"authority-pointer","pointer_file":"dev/engineering/current-authority.json","snapshot_file":"dev/engineering/authority-snapshots/as20261109r1.json","snapshot_version":"as20261109r1","content_digest":"sha256:d85fdc1a78f055dc460799a6ff560daab541d0d7f96bb48294ff3dee76a398b3","pointer_digest_verified":true,"view_may_not_reverse_decide_authority":true}
LIMIT complete static check: no C1/C2/C3, no security negative, no runtime behaviour proof
```

### 4.6 `place-dist-glue`

```
$ node scripts/place-dist-glue.mjs
place-dist-glue: done (28 placement(s))
```

### 4.7 `eb3-ci-required`

```
$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0
```

### 4.8 `eb3-security-run --layer ci-integration --list-file …`

**The command as specified in the brief does not pass a real file**, and that is reported here rather than
silently swapped:

```
$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=REFUSED reason=suite list absent: tests/checks/ute-migrated-suites.txt
```

There is no `tests/checks/ute-migrated-suites.txt` in this tree; the population is declared in
`tests/checks/eb3-ute-migrated-suites.txt` (the `eb3-` prefix is in the committed filename, bound in
`20d5ee9b3`). With the file that exists, the leg is green:

```
$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
```

**The gate's refusal is itself a feature, not a wording problem:** the token runner refuses a list
shorter than its report, a listed-but-absent file, and an empty run
(`tests/checks/eb3-ute-migrated-suites.txt`, header comment). A typo in `--list-file` therefore cannot
grade green.

---

## 5. Host-modification authority

### 5.1 What was and was not done to the pinned host

The pinned host is `tests/deepseek-harness-test-use` (gitignored, its own git repo, detached). Check run
in this session:

```
$ git -C tests/deepseek-harness-test-use rev-parse HEAD
639ed015397290b3745d163aafe02ffee4aa3f84
$ git -C tests/deepseek-harness-test-use status --porcelain | wc -l
0
$ node -e "import('./tests/paths.mjs').then(m=>console.log(m.TEST_USE_BASELINE_SHA, m.DSH_BASELINE_VERSION))"
639ed015397290b3745d163aafe02ffee4aa3f84 0.2.0-rc.2
```

So: **pristine at the pinned SHA**, and the SHA equals `TEST_USE_BASELINE_SHA` from `tests/paths.mjs`
(version `0.2.0-rc.2`) — the single source of the pin, not a hard-coded copy.

What was **not** done, stated as facts rather than intentions:

- **No patch, no `git apply`, no `patch-package` / `pnpm patch` / postinstall rewrite, no vendored modified
  copy.** The host tree has **zero** porcelain entries before and after every boot; each D2/D3 evidence
  directory carries its own `host-tree-porcelain.txt` (`.../d-boot-feasibility/d2/`, `.../d3/`), and both
  READMEs record "porcelain empty before and after both boots".
- **No import of an upstream private/internal API.** The native-mount fix reaches upstream only through
  public seams: `compositionInventory()` and `readDocument()` on the `agentPresets` accessor
  (`FINDING-native-tool-provider.md:65-67`), and the host's own `mountHostModules` path.
- **No modification of the shared read-only baseline.** All code in this candidate lives under this
  repo's `packages/` and `scripts/`.

### 5.2 CORE PATCH BUDGET = 0 was honoured

`AGENTS.md` fixes the budget at zero and classes any path needing an upstream source patch as
`CORE_SEAM_BLOCKER`, not a TODO. Every gap found in D was therefore handled **without** a patch, in one
of three lawful shapes:

| gap | how it is carried | not a patch because |
| --- | --- | --- |
| subprocess / PTY / PTC | typed refusals + `CONTRACT-CHANGE-REQUEST-process-lane.md` | the host already offers the families; the missing piece is a **declaration source**, i.e. a product contract question |
| search face and the durable overlay | shape B implemented in this repo (`overlay-decision.mjs`, `admission-port.mjs`), shape A left open in `CONTRACT-CHANGE-REQUEST-search-face.md` | the change is to this repo's plugin and its fact shape, not to the host |
| Alpha.6 review routing | typed refusal + two lawful shapes (`CAPABILITY-MATRIX-C.md:119-123`) | needs a compiled axis or an owner ruling; nothing upstream |
| runtime team creation on a centre row | `ESCALATION-centre-row-creation-entrance.md` (405) | a ruling, not a patch (see §6.2) |
| admitted-then-refused settlement | `CONTRACT-CHANGE-REQUEST-settlement-recheck.md`; the centre reports `SETTLEMENT_CONTRACT_GAP` rather than fabricate a state | the frozen settlement contract has no legal state; relaxing it is an owner decision |

### 5.3 No DSH upstream patch exists

To be explicit, because "we did not need one" and "we did not write one" are different claims: **there is
no upstream patch in this candidate to apply, and none was stashed.** The cut's closure gate proves the
positive side — `prodRefs=0` means no surviving production import of a retired entry, and
`distResiduals=0` means no dist mirror of a deleted source survives (§1.1/§4.3). The host tree's empty
porcelain (§5.1) proves the negative side at measurement time.

---

## 6. Limits and unproven claims (the honest list)

Assembled from `CAPABILITY-MATRIX-C.md`, `FINDING-native-tool-provider.md`, the three CCRs,
`ESCALATION-centre-row-creation-entrance.md`, and the D-BOOT-FEASIBILITY sections. Each item names what
would prove it.

### 6.1 No PRODUCT-PROVEN row

Every row is `MECHANISM` or `UNPROVEN`; **none** is PRODUCT-PROVEN (`CAPABILITY-MATRIX-C.md:71-74`). A row
moves only with a real host boot line at a named commit — and even the `DEV-LIVE` boots that exist are not
gates (`CAPABILITY-MATRIX-C.md:7`). *Would prove a row:* a gate-grade run (not a driver record) that boots
the product at a named commit and drives that row end to end.

### 6.2 Runtime team creation returns **405** on a centre row

Measured: `[boot1] team.create status=405 ok=false null`. The driver's only creation entrance is the S6
remote plane (`tests/world-factory/lib/u6-fs-assembly.mjs:505`); C-remote refuses to build that plane on a
centre row (`root.ts:4324`) and therefore never installs its registration seam (`root.ts:4725`);
`host.ts:1638` correctly turns that into `skipped` rather than a boot failure — with no dispatcher there
is no route, hence 405. **Governance and runtime creation are mutually exclusive today**
(`ESCALATION-centre-row-creation-entrance.md:12-24`). The A/B control is clean: the *no-centre* arm got
`status=200` on the same driver and then refused the Member for want of a centre.

What D actually measures is **shape 3**: bind the v4 blueprint **at boot** and measure the boot-created
Team. That is a **MEASUREMENT-ONLY** concession and must stay labelled as a limit. *Would prove it:* shape
1 (a declared axis for a governed creation command — contract change) or shape 2 (a non-remote product
creation route through the centre).

### 6.3 The process lane is unavailable (persistent bash / PTY / PTC)

- `bash` / `pwsh` → `ADMISSION_AXIS_UNSUPPORTED` on `process.exec` (`ADM-18`, `ADM-75`, `d3:persistent-subprocess` REFUTED).
- `run_code` (PTC) → its **own** `ADMISSION_PTC_UNAVAILABLE` (`admission.ts:318`, `ADM-87/88`), because PTC's absence is the lane **plus** the escalation row's second authority.
- The v4 member ceiling is a **closed** io shape `{read, write, network}` (`packages/domain/blueprint/src/blueprint-v4.ts:187-197`); feeding `io.process` live yields `unknown-field — field 'process' is outside the closed io shape (read | write | network)`.
- The shipped governed preset mounts exactly one shell row, `tool-bash` (one-shot), never `dsh-tool-bash-persistent` (`--plan`: `present=true mounted=false`).
- B's rung-5/6 **positive controls are NOT RUN** (`ADM-68/69`, the 2 disclosed skips) — never passes.

*Would prove it:* a single-source process-lane declaration (contract change A) or a v5 schema (B), then a
positive control that spawns a real shell. **Not** a judge that fakes a shell.

### 6.4 The search face is lane-only governance

Shape B is implemented and measured live (round 64): the durable overlay has **no opinion** on a face
outside its closed vocabulary, so an in-lane `grep` is admitted and runs
(`decision=allow`, `overlayOutcome=no-opinion`, execution fact `completed`, a real match at
`team-b/corpus/huge-7.txt`), while an out-of-lane `grep` is `LANE_DENY`. The **residual** is the point:
**a durable overlay rule cannot deny `grep`/`glob` (or `web_fetch`, …)** — those faces are outside the
vocabulary, so the lane ceiling is their entire governance. The centre also judges the **search root** the
call names, not every file a scan opens (`CAPABILITY-MATRIX-C.md:295-299`;
`CONTRACT-CHANGE-REQUEST-search-face.md`). *Would prove it:* shape A — a search face with a subtree
resource in the closed vocabulary, plus a durable deny that reaches it.

### 6.5 Alpha.6 is unreachable at a host entry, and its routed path is unproven there

Two independent gates refuse the opt-in **on every row** (`centre-config.ts:62-70`, `root.ts:2498-2512`),
so there is **no product-config path on which Alpha.6 is reachable at all** — stronger than "a
centre-configured row is refused" (`ADM-99`). The machinery behind it is measured **in-process, composed
directly** (`ADM-98`: real router takes a `recipient` decision; real `dispatchLatch` +
`createFileWakeIntentDirectory` persist a row a fresh reader sees). At the **host entry** the
recorded-fact half is **unreachable**: the config gate runs before root construction, so
`createHostSurfaceRefusalPoint` is never built (`D-BOOT-FEASIBILITY.md:641-643`). `d3:alpha6` is PROVEN
**only as the typed-refusal shape**. *Would prove the routed path:* a compiled review-routing axis (or the
record-only ruling), and a boot where the gate sits below root construction so the fact can be written.

### 6.6 The overlay cannot widen authority — by design, not by defect

`overlay-decision.mjs:9` (deny-only), `admission-port.mjs:498-521` (consulted only when the compiled lane
allows; the only verdict is `ADMISSION_OVERLAY_DENY`), `permission-mutation.ts:435-436` (a revoke removes
restrictions and "never needs expansion authority"). Measured live through the ONE durable
`permissionOverlay` lane: pre-read admitted → `team_grant_permission` exact `read` deny (`changed:true`) →
same read `ADMISSION_OVERLAY_DENY` → `team_revoke_permission` (`changed:true`) → same read **admitted
again**; the untouched in-lane read still succeeds. The **REQUIRED** direction of `d2:revocation` ("revoke
refuses the previously-succeeded call with a NEW policy generation") is therefore **REFUTED** —
`centre-install.mjs:94` fixes the fact's `policyGeneration` to the COMPILED revision at bind.
**D's "permission revocation" acceptance must be stated in the contract's own terms:** revocation of
access = a durable deny (refused with zero body), restoration = removing that deny, widening beyond the
compiled ceiling = refused. A judge requiring the overlay to grant tests a capability the contract
forbids, and is REFUTED on purpose (`FINDING-native-tool-provider.md:131-150`).

### 6.7 The model is a scripted mock, not a real model

Every D record uses the product's **scripted mock model** over `dsh web` (D-BOOT-FEASIBILITY:59 `dsh web,
mock model, p6t6 directive`). Each round's "what this does NOT prove" names "a real-model interleaving
(scripted mock)" (`D-BOOT-FEASIBILITY.md:529`, `:678`, `:776`). So no claim here covers model-driven
choice, retries, or adversarial tool selection. *Would prove it:* the same judges with a real model, and
the interleaving recorded rather than scripted.

### 6.8 In-process vs live — the distinction, everywhere it matters

- `MECHANISM` arms run **in-process**. The named stand-ins decide nothing: the agent-context double, the
  member's live-agent handle (`dispose()` running the registered disposers), the child-session factory,
  and the work-delivery port (`CAPABILITY-MATRIX-C.md:54-59`, `:105-106`). The compiled member answer is an
  **input** (a ceiling), not a decision — so **policy COMPILATION is not exercised** anywhere
  (`CAPABILITY-MATRIX-C.md:67`, `:128`).
- `DEV-LIVE` boots are real host processes but **not gates**, and `overall=FAIL` for both drivers.
- Consequences that only exist in one class are stated per item: the archived member's **product route**
  refuses earlier at the durable lifecycle gate, so `ADM-93` proves the centre's own tombstone, not the
  product's refusal order (`CAPABILITY-MATRIX-C.md:61-64`); `IO_READ_DENIED` is unreachable on the live
  path by design and is proven **in-process** (`ADM-100`).

### 6.9 A realm-less member has no admission at all

The centre is installed only inside `if (a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined)`
(`CAPABILITY-MATRIX-C.md:191-199`). A member with `centreStatePath` but no confined-provider realm
therefore runs **unmediated and unreported** — not the "unwired call is explicitly refused" law, but the
tool not being covered. Rows that *asked* are refused `MEMBER_CENTRE_UNWIRED`; rows that never asked
remain outside the centre. The ruling is open in `ESCALATION-realmless-admission.md`. *Would prove it:*
the owner ruling (admit against the same compiled ceiling and say so, vs refuse), then a test in both
directions.

### 6.10 The settlement contract has no state for "admitted, then refused before the body"

`LEGAL_TRANSITIONS.ADMITTED` has no legal refusal when the cited decision is `allow`;
`REFUSED` would be `SETTLEMENT_ADMISSION_MISMATCH` (`execution-settlement.ts:932`); `CANCELLED` needs a
Stop; `UNKNOWN` asserts "the effect was not observed" when the body provably never ran. The centre reports
`SETTLEMENT_CONTRACT_GAP` and leaves the record `ADMITTED` rather than lie
(`CONTRACT-CHANGE-REQUEST-settlement-recheck.md`). Option A is recommended there and **not implemented**.
*Would prove it:* an owner ruling, then the state or the second decision reference.

### 6.11 `host.service` capabilities' I/O is outside the member's fs ceiling

Goal/Todo, Team Skill and Subagent are bound and recorded on `host.service`, but a skill file read by the
host skill service is **outside** the member's fs ceiling (`CAPABILITY-MATRIX-C.md:76-87`;
`admission.ts:100-108`). This is a **limit, not a confinement claim**, and it is repeated in C15 of §2.

### 6.12 The centre is not mount-aware

Its binding is installed at the member bind (`agent-bindings.mjs:1852`) while `mcpMountTarget` is computed
later per boundary (`agent-bindings.mjs:2049`), and `admission.ts:78-120` has no mount input. A
**well-formed** name for a never-mounted server is therefore decided on the network axis alone; the
product excludes such a call at the **tool registry**, not at admission (`ADM-97` step 5). *Would prove
it:* an admission-time mount input, i.e. a contract change.

### 6.13 `d:member-read-denied` is REFUTED as a judge clause (reported, not relaxed)

The clause requires the provider's typed `IO_READ_DENIED` on the live path. The centre decides **before**
execution, so the out-of-lane call never reaches the provider and the result carries the centre's
`LANE_DENY`. Making the judge pass would require running the provider **before** the centre — the wrong
order for a governance system. The provider-side typed refusal **is** proven in-process (`ADM-100`: zero
secret bytes). The clause is therefore a product-semantics finding, not a tolerance to widen
(`FINDING-native-tool-provider.md:93-99`).

### 6.14 Other measured-or-missing coverage

- **No Stop under load, no revocation under load, no multi-agent load beyond two Members.** `d2:stop` is a
  timing race by nature; it reproduced in both boots, but two agreeing boots is not load.
- **No real Stop keypress** (the public RPC was used).
- **`userQuestions` and terminals** are covered only by the PTY-owner refusal (`SLICE-33`), not by a
  positive.
- **C11 (state projections)** now has its Team-owned half measured (`ADM-107`…`ADM-109`, round 66): the
  projection is preserved in the new assembly and derives only from durable TeamDomain facts. What it still
  lacks is a **live boot** reading the HOST's `sessionProjections.stateOf` for a Member's todo/goal state —
  the host service, not the Team's (`§2` C11 row).
- **`test-catalog` is at its ceiling** (`UNCOLLECTED=41` exactly), so the collected population has zero
  headroom.
- **The boot-bound team is a measurement concession**, not the product's runtime creation path (§6.2).

---

## 7. Verdict

**What a reviewer may conclude.**

1. **The candidate implements A1 + B + C.** The A1 cut is closed by measurement, not by prose: 148 sources
   gone, `prodRefs=0`, `distResiduals=0`, `dupNames=0`, 28 byte-identical dist placements, and the 37/180/
   69,512-line frozen census unchanged (§1.1–§1.2). B and C are carried by `ADM-1…ADM-109` in the
   `ute-vnext-a1` node leg (**171 pass, 0 fail, 2 disclosed skips**) and by the 15 migrated capability
   suites (**238/238**, `verdict=PASS`) (§4).
2. **There is live D evidence for the listed items.** Four live judges are **PROVEN** at two agreeing
   boots each: `d:member-read-admitted`, `d:guard-facts`, `d:centre-facts`, `d:native-read-surface`
   (repaired, not deleted), `d2:multi-member-concurrency`, `d2:stop`, `d3:crash-cold-recovery`,
   `d3:work-delivery`, `d3:alpha6` (as the typed-refusal shape). The P1–P5 obligations each have a green
   assertion, a negative control, and a live carrier (§3).
3. **It is NOT a completed product acceptance**, and the refuted items are named rather than rounded up:
   - `d3:persistent-subprocess` **REFUTED** — no process lane exists (`ADMISSION_AXIS_UNSUPPORTED`); B's
     bash/`run_code` positives are **NOT RUN** (§6.3).
   - `d2:revocation` **REFUTED** in its REQUIRED direction — the overlay is deny-only by design (§6.6).
   - `d:member-read-denied` **REFUTED** as a clause — the provider is never entered, by design (§6.13).
   - **Runtime team creation is 405 on a centre row** — governance and runtime creation are mutually
     exclusive today (§6.2).
   - **Alpha.6 is unreachable at a host entry**, and its routed path is unproven there (§6.5).
   - **The search face is lane-only governance** — a durable overlay rule cannot deny it (§6.4).
   - **No row is PRODUCT-PROVEN**, and the model is a **scripted mock** (§6.1, §6.7).
   - **C11 (state projections)** has mechanism arms for its Team-owned projection (`ADM-107`…`ADM-109`,
     round 66), but its host `sessionProjections.stateOf` half is unproven and needs a live boot (§2.2).
4. **Therefore:** the honest description is *"A1+B+C implemented and measured, with D live evidence for
   the named, listed items — **not** a completed product acceptance."* The centre behaves as an A1 cut
   should: an unwired controlled call is **refused with a typed code**, not forwarded. That is a
   governance result, not a product-acceptance result, and the two must not be merged in any report,
   release note, or review summary.

**What would change this verdict** (in order): an owner ruling on the process lane (one declaration
source), a ruling on the settlement gap, a ruling/wiring for Alpha.6's review-routing axis, a governed
runtime creation entrance (shape 2, then 1), a real-model interleaving, and then a gate-grade product
acceptance run that boots at a named commit and drives each C row end to end.

**Nothing in this report authorises a merge, a release, or a deployment.** `master` is untouched by this
branch; the candidate must not auto-merge (`PR-BODY-draft.md:1-4`, `:320-322`).
